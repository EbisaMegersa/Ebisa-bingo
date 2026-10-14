/* ============================================================
   Ebisa Bingo — backend (Cloudflare Worker + D1)
   75-ball • 300 cartelas/room • manual daub • server-verified
   Works in Telegram (verified account) AND any browser (guest)
   Secrets: BOT_TOKEN, WEBAPP_URL   |   D1 binding: DB
   ============================================================ */

const DRAW_MS = 4000;        // ms between balls
const COUNTDOWN_MS = 10000;  // countdown once 2+ players seated
const RESULTS_MS = 10000;    // winner screen before reset
const STALE_MS = 30000;      // force-reset if draws ever stall
const WIN_POINTS = 5;
const TOTAL_CARTELAS = 300;
const MAX_PER_PLAYER = 3;
const MAX_ROOMS = 20;

/* The 12 winning lines of a 5x5 card as 25-bit masks.
   Cell index = row*5 + col. Center (bit 12) = FREE. */
const LINES = (() => {
  const L = [];
  for (let r = 0; r < 5; r++) L.push([0,1,2,3,4].map(c => r*5 + c));  // 5 rows
  for (let c = 0; c < 5; c++) L.push([0,1,2,3,4].map(r => r*5 + c));  // 5 cols
  L.push([0,6,12,18,24], [4,8,12,16,20]);                             // 2 diagonals
  return L.map(cells => cells.reduce((a, i) => a | (1 << i), 0));
})();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    if (url.pathname === '/telegram-webhook') return handleWebhook(request, env);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    return json({ ok: false, error: 'not_found' }, 404);
  }
};

/* ---------- helpers ---------- */
const CH = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type,x-init-data,x-guest-token' };
function cors(r) { for (const k in CH) r.headers.set(k, CH[k]); return r; }
function json(o, s = 200) { return cors(new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } })); }
const now = () => Date.now();
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

/* ---------- Telegram auth (verifies initData signature) ---------- */
async function checkInitData(initData, token) {
  try {
    const p = new URLSearchParams(initData);
    const hash = p.get('hash'); if (!hash) return null;
    p.delete('hash'); p.delete('signature');
    const dcs = [...p.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, v]) => k + '=' + v).join('\n');
    const te = new TextEncoder();
    const mk = k => crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const secret = await crypto.subtle.sign('HMAC', await mk(te.encode('WebAppData')), te.encode(token));
    if (hex(await crypto.subtle.sign('HMAC', await mk(secret), te.encode(dcs))) !== hash) return null;
    const u = JSON.parse(p.get('user') || 'null');
    return (u && u.id) ? u : null;
  } catch (e) { return null; }
}

/* ---------- bot webhook ---------- */
async function tgCall(env, method, body) {
  await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function handleWebhook(request, env) {
  const upd = await request.json().catch(() => null);
  const m = upd && upd.message;
  if (m && m.text && m.text.startsWith('/start')) {
    await tgCall(env, 'sendMessage', {
      chat_id: m.chat.id,
      text: '🎱 Welcome to Ebisa Bingo!\n\n• 75-ball bingo in live rooms\n• Claim up to 3 cartelas out of 300\n• Round auto-starts at 2+ players\n• Tap called numbers on your cartela to DAUB them\n• First full line = BINGO! +5 points',
      reply_markup: { inline_keyboard: [[{ text: '▶️ PLAY EBISA BINGO', web_app: { url: env.WEBAPP_URL || '' } }]] }
    });
  }
  return new Response('ok');
}

/* ---------- game core ---------- */
function makeCard() {
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]]; // B I N G O columns
  const cells = new Array(25).fill(0);
  for (let c = 0; c < 5; c++) {
    const pool = []; for (let n = ranges[c][0]; n <= ranges[c][1]; n++) pool.push(n);
    shuffle(pool);
    const rows = c === 2 ? [0,1,3,4] : [0,1,2,3,4]; // center stays 0 = FREE
    rows.forEach((r, i) => { cells[r*5 + c] = pool[i]; });
  }
  return cells;
}
const newRound = () => JSON.stringify(shuffle([...Array(75)].map((_, i) => i + 1)));

async function createRoom(env) {
  const r = await env.DB.prepare("INSERT INTO rooms (status,draw_order,drawn) VALUES ('WAITING',?,'[]')").bind(newRound()).run();
  const id = r.meta.last_row_id, stmts = [];
  for (let i = 0; i < TOTAL_CARTELAS; i += 50) {
    const chunk = [];
    for (let k = 0; k < 50 && i + k < TOTAL_CARTELAS; k++)
      chunk.push('(' + id + ',' + (i + k + 1) + ",'" + JSON.stringify(makeCard()) + "',4096)");
    stmts.push(env.DB.prepare('INSERT INTO cartelas (room_id,idx,cells,marked) VALUES ' + chunk.join(',')));
  }
  await env.DB.batch(stmts);
  return id;
}
/* new round: fresh cartelas + fresh ball order, players stay seated */
async function resetRoom(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM cartelas WHERE room_id=?').bind(id),
    env.DB.prepare("UPDATE rooms SET status='WAITING',round_no=round_no+1,drawn='[]',drawn_count=0,next_draw_at=0,start_at=0,reset_at=0,winner_name=NULL,winner_cartela=NULL,winner_user=NULL,draw_order=? WHERE id=?").bind(newRound(), id),
  ]);
}
/* draw one ball — atomic guard so concurrent polls can't double-draw */
async function drawOne(env, id, t) {
  const g = await env.DB.prepare("UPDATE rooms SET next_draw_at=?,drawn_count=drawn_count+1 WHERE id=? AND status='DRAWING' AND next_draw_at<=?").bind(t + DRAW_MS, id, t).run();
  if (!g.meta.changes) return;
  const room = await env.DB.prepare('SELECT * FROM rooms WHERE id=?').bind(id).first();
  const num = JSON.parse(room.draw_order)[room.drawn_count - 1];
  const drawn = JSON.parse(room.drawn); drawn.push(num);
  await env.DB.prepare('UPDATE rooms SET drawn=? WHERE id=?').bind(JSON.stringify(drawn), id).run();
  if (room.drawn_count >= 75) { // all balls out, nobody bingod
    await env.DB.prepare("UPDATE rooms SET status='FINISHED',winner_name='Nobody',winner_cartela=NULL,winner_user=NULL,reset_at=? WHERE id=?").bind(now() + RESULTS_MS, id).run();
  }
}
async function tickRoom(env, id) {
  const room = await env.DB.prepare('SELECT * FROM rooms WHERE id=?').bind(id).first();
  if (!room) return null;
  const t = now();
  if (room.status === 'WAITING' || room.status === 'COUNTDOWN') {
    const cnt = (await env.DB.prepare('SELECT COUNT(*) n FROM players WHERE room_id=?').bind(id).first()).n;
    if (room.status === 'WAITING' && cnt >= 2) {          // auto-start countdown
      await env.DB.prepare("UPDATE rooms SET status='COUNTDOWN',start_at=? WHERE id=? AND status='WAITING'").bind(t + COUNTDOWN_MS, id).run();
      room.status = 'COUNTDOWN'; room.start_at = t + COUNTDOWN_MS;
    } else if (room.status === 'COUNTDOWN' && cnt < 2) {  // not enough players
      await env.DB.prepare("UPDATE rooms SET status='WAITING',start_at=0 WHERE id=?").bind(id).run();
      room.status = 'WAITING';
    } else if (room.status === 'COUNTDOWN' && t >= room.start_at) { // go!
      await env.DB.batch([
        env.DB.prepare("UPDATE rooms SET status='DRAWING',drawn_count=0,drawn='[]',next_draw_at=? WHERE id=? AND status='COUNTDOWN'").bind(t, id),
        env.DB.prepare('UPDATE users SET games=games+1 WHERE telegram_id IN (SELECT user_id FROM players WHERE room_id=?)').bind(id),
      ]);
      room.status = 'DRAWING'; room.next_draw_at = t;
    }
    return room;
  }
  if (room.status === 'DRAWING') {
    if (t - room.next_draw_at > STALE_MS) { await resetRoom(env, id); return { status: 'WAITING' }; }
    if (t >= room.next_draw_at) await drawOne(env, id, t);
    return room;
  }
  if (room.status === 'FINISHED' && t >= room.reset_at) { await resetRoom(env, id); return { status: 'WAITING' }; }
  return room;
}
async function ensureRooms(env) {
  const n = (await env.DB.prepare('SELECT COUNT(*) n FROM rooms').first()).n;
  if (n === 0) { await createRoom(env); await createRoom(env); }
}

/* ---------- API ---------- */
async function handleApi(request, env, url) {
  const path = url.pathname;
  if (path === '/api/ping') return json({ ok: true });

  /* auth: Telegram user OR browser guest */
  let isGuest = false;
  let tgu = await checkInitData(request.headers.get('x-init-data') || '', env.BOT_TOKEN);
  if (tgu) {
    const n = ((tgu.first_name || '') + ' ' + (tgu.last_name || '')).trim() || ('Player' + tgu.id);
    await env.DB.prepare('INSERT INTO users (telegram_id,name) VALUES (?,?) ON CONFLICT(telegram_id) DO UPDATE SET name=excluded.name').bind(tgu.id, n).run();
    tgu = { id: tgu.id, name: n };
  } else {
    isGuest = true;
    const tok = request.headers.get('x-guest-token') || '';
    if (tok.length < 32) return json({ ok: false, error: 'auth_failed' }, 401);
    let g = await env.DB.prepare('SELECT telegram_id,name FROM users WHERE token=?').bind(tok).first();
    if (!g) {
      const h = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tok)));
      const gid = Number((BigInt('0x' + h.slice(0, 12)) % 999999999999n) + 9000000000000n);
      await env.DB.prepare('INSERT OR IGNORE INTO users (telegram_id,name,token) VALUES (?,?,?)').bind(gid, 'Guest-' + String(gid).slice(-4), tok).run();
      g = await env.DB.prepare('SELECT telegram_id,name FROM users WHERE token=?').bind(tok).first();
    }
    tgu = { id: g.telegram_id, name: g.name };
  }
  const name = tgu.name;

  /* lobby */
  if (path === '/api/lobby' && request.method === 'GET') {
    const rooms = (await env.DB.prepare('SELECT * FROM rooms ORDER BY id').all()).results, out = [];
    for (const r of rooms) {
      try { await tickRoom(env, r.id); } catch (e) {}
      const cnt = (await env.DB.prepare('SELECT COUNT(*) n FROM players WHERE room_id=?').bind(r.id).first()).n;
      const mine = (await env.DB.prepare('SELECT COUNT(*) n FROM players WHERE room_id=? AND user_id=?').bind(r.id, tgu.id).first()).n;
      out.push({ id: r.id, status: r.status, players: cnt, in_room: !!mine, round_no: r.round_no });
    }
    const me = await env.DB.prepare('SELECT name,points,games,wins FROM users WHERE telegram_id=?').bind(tgu.id).first();
    return json({ ok: true, rooms: out, me, isGuest });
  }

  /* join a room (auto-picks the fullest open room; no room creation) */
  if (path === '/api/join' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const mine = (await env.DB.prepare('SELECT room_id FROM players WHERE user_id=?').bind(tgu.id).all()).results;
    if (mine.length) return json({ ok: true, room_id: mine[0].room_id, already: true });
    let rid = body.room_id | 0;
    if (rid) {
      const r = await env.DB.prepare('SELECT status FROM rooms WHERE id=?').bind(rid).first();
      if (!r) return json({ ok: false, error: 'Room not found' }, 404);
      if (r.status !== 'WAITING' && r.status !== 'COUNTDOWN') return json({ ok: false, error: 'That room is live — wait for the next one' });
    } else {
      const rooms = (await env.DB.prepare('SELECT id,status FROM rooms').all()).results, open = [];
      for (const r of rooms) if (r.status === 'WAITING' || r.status === 'COUNTDOWN') {
        const c = (await env.DB.prepare('SELECT COUNT(*) n FROM players WHERE room_id=?').bind(r.id).first()).n;
        open.push({ id: r.id, n: c });
      }
      open.sort((a, b) => b.n - a.n);
      if (open.length) rid = open[0].id;
      else {
        if (rooms.length >= MAX_ROOMS) return json({ ok: false, error: 'All rooms are live — wait a moment' });
        rid = await createRoom(env);
      }
    }
    const pick = await env.DB.prepare('SELECT idx FROM cartelas WHERE room_id=? AND claimed_by IS NULL ORDER BY RANDOM() LIMIT 1').bind(rid).first();
    if (!pick) return json({ ok: false, error: 'All 300 cartelas are taken' });
    const claim = await env.DB.prepare('UPDATE cartelas SET claimed_by=? WHERE room_id=? AND idx=? AND claimed_by IS NULL').bind(tgu.id, rid, pick.idx).run();
    if (!claim.meta.changes) return json({ ok: false, error: 'Too slow — retry' });
    await env.DB.prepare('INSERT INTO players (room_id,user_id,name) VALUES (?,?,?)').bind(rid, tgu.id, name).run();
    const cnt = (await env.DB.prepare('SELECT COUNT(*) n FROM players WHERE room_id=?').bind(rid).first()).n;
    const r0 = await env.DB.prepare('SELECT status FROM rooms WHERE id=?').bind(rid).first();
    if (cnt >= 2 && r0.status === 'WAITING')
      await env.DB.prepare("UPDATE rooms SET status='COUNTDOWN',start_at=? WHERE id=? AND status='WAITING'").bind(now() + COUNTDOWN_MS, rid);
    return json({ ok: true, room_id: rid, cartela_idx: pick.idx });
  }

  /* claim extra cartela */
  if (path === '/api/addcartela' && request.method === 'POST') {
    const body = await request.json().catch(() => ({})), rid = body.room_id | 0;
    const st = await env.DB.prepare('SELECT status FROM rooms WHERE id=?').bind(rid).first();
    if (!st || (st.status !== 'WAITING' && st.status !== 'COUNTDOWN')) return json({ ok: false, error: 'Round already started' });
    const have = (await env.DB.prepare('SELECT COUNT(*) n FROM cartelas WHERE room_id=? AND claimed_by=?').bind(rid, tgu.id).first()).n;
    if (have >= MAX_PER_PLAYER) return json({ ok: false, error: 'Max ' + MAX_PER_PLAYER + ' cartelas per player' });
    const pick = await env.DB.prepare('SELECT idx FROM cartelas WHERE room_id=? AND claimed_by IS NULL ORDER BY RANDOM() LIMIT 1').bind(rid).first();
    if (!pick) return json({ ok: false, error: 'All 300 cartelas taken' });
    const c = await env.DB.prepare('UPDATE cartelas SET claimed_by=? WHERE room_id=? AND idx=? AND claimed_by IS NULL').bind(tgu.id, rid, pick.idx).run();
    if (!c.meta.changes) return json({ ok: false, error: 'Retry' });
    return json({ ok: true, cartela_idx: pick.idx });
  }

  /* DAUB — the heart of the bingo logic.
     Server verifies: round live → number actually called → number on YOUR cartela → not already marked.
     Then checks all 12 lines. First complete line wins the round. */
  if (path === '/api/daub' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const rid = body.room_id | 0, idx = body.cartela_idx | 0, num = body.number | 0;
    const room = await env.DB.prepare('SELECT * FROM rooms WHERE id=?').bind(rid).first();
    if (!room || room.status !== 'DRAWING') return json({ ok: false, error: 'Round is not live' });
    const drawn = JSON.parse(room.drawn);
    if (!drawn.includes(num)) return json({ ok: false, error: 'Number ' + num + ' not called yet' });
    const card = await env.DB.prepare('SELECT id,cells,marked FROM cartelas WHERE room_id=? AND idx=? AND claimed_by=?').bind(rid, idx, tgu.id).first();
    if (!card) return json({ ok: false, error: 'Not your cartela' });
    const bit = JSON.parse(card.cells).indexOf(num);
    if (bit < 0) return json({ ok: false, error: 'Number not on this cartela' });
    const marked = card.marked | (1 << bit);
    await env.DB.prepare('UPDATE cartelas SET marked=? WHERE id=?').bind(marked, card.id).run();
    const line = LINES.find(L => (marked & L) === L);
    if (line) {
      // status='DRAWING' in WHERE = first-completed-line wins, races are safe
      const w = await env.DB.prepare("UPDATE rooms SET status='FINISHED',winner_name=?,winner_cartela=?,winner_user=?,reset_at=? WHERE id=? AND status='DRAWING'")
        .bind(name, idx, tgu.id, now() + RESULTS_MS, rid).run();
      if (w.meta.changes) {
        await env.DB.prepare('UPDATE users SET points=points+?,wins=wins+1 WHERE telegram_id=?').bind(WIN_POINTS, tgu.id).run();
        return json({ ok: true, marked, win: true, points: WIN_POINTS });
      }
      return json({ ok: true, marked, win: false }); // someone beat you by a split second
    }
    return json({ ok: true, marked, win: false });
  }

  /* leave (only before round starts) */
  if (path === '/api/leave' && request.method === 'POST') {
    const body = await request.json().catch(() => ({})), rid = body.room_id | 0;
    const st = await env.DB.prepare('SELECT status FROM rooms WHERE id=?').bind(rid).first();
    if (st && (st.status === 'WAITING' || st.status === 'COUNTDOWN')) {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM players WHERE room_id=? AND user_id=?').bind(rid, tgu.id),
        env.DB.prepare('UPDATE cartelas SET claimed_by=NULL WHERE room_id=? AND claimed_by=?').bind(rid, tgu.id),
      ]);
      const cnt = (await env.DB.prepare('SELECT COUNT(*) n FROM players WHERE room_id=?').bind(rid).first()).n;
      if (cnt < 2) await env.DB.prepare("UPDATE rooms SET status='WAITING',start_at=0 WHERE id=? AND status='COUNTDOWN'").bind(rid).run();
    }
    return json({ ok: true });
  }

  /* full room state for the polling client */
  if (path === '/api/state' && request.method === 'GET') {
    const rid = +(url.searchParams.get('room') || 0);
    const room0 = await env.DB.prepare('SELECT * FROM rooms WHERE id=?').bind(rid).first();
    if (!room0) return json({ ok: false, error: 'no_room' }, 404);
    await tickRoom(env, rid);
    const fresh = await env.DB.prepare('SELECT * FROM rooms WHERE id=?').bind(rid).first();
    const in_room = !!(await env.DB.prepare('SELECT 1 x FROM players WHERE room_id=? AND user_id=?').bind(rid, tgu.id).first());
    const cartelas = (await env.DB.prepare('SELECT idx,cells,marked FROM cartelas WHERE room_id=? AND claimed_by=? ORDER BY idx').bind(rid, tgu.id).all()).results
      .map(c => ({ idx: c.idx, cells: JSON.parse(c.cells), marked: c.marked }));
    const players = (await env.DB.prepare('SELECT name FROM players WHERE room_id=? ORDER BY rowid').bind(rid).all()).results.map(p => p.name);
    return json({ ok: true, win_points: WIN_POINTS, max_cartelas: MAX_PER_PLAYER,
      room: { id: rid, status: fresh.status, round_no: fresh.round_no, drawn: JSON.parse(fresh.drawn),
        start_at: fresh.start_at, reset_at: fresh.reset_at, winner_name: fresh.winner_name,
        winner_cartela: fresh.winner_cartela, players },
      you: { in_room, cartelas } });
  }

  /* rename guest account */
  if (path === '/api/setname' && request.method === 'POST') {
    if (!isGuest) return json({ ok: false, error: 'Telegram users keep their Telegram name' });
    const b = await request.json().catch(() => ({}));
    const n = String(b.name || '').trim().slice(0, 20);
    if (!n) return json({ ok: false, error: 'Name required' });
    await env.DB.prepare('UPDATE users SET name=? WHERE telegram_id=?').bind(n, tgu.id).run();
    return json({ ok: true, name: n });
  }

  if (path === '/api/leaderboard' && request.method === 'GET') {
    const list = (await env.DB.prepare('SELECT name,points,wins FROM users ORDER BY points DESC LIMIT 20').all()).results;
    return json({ ok: true, list });
  }
  return json({ ok: false, error: 'not_found' }, 404);
}
