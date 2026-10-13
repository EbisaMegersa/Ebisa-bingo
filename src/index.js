<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Ebisa Bingo</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{--bg:#0f1220;--panel:#1a1f35;--line:#2a3050;--txt:#eef1ff;--dim:#8b93b8;--acc:#fbbf24}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{background:var(--bg);color:var(--txt);font-family:-apple-system,'Segoe UI',Roboto,sans-serif;padding-bottom:30px}
.screen{display:none;padding:14px;max-width:520px;margin:0 auto}.screen.active{display:block}
h1{font-size:26px}.logo{color:var(--acc)}.sub{color:var(--dim);font-size:13px;margin:4px 0 14px}
.btn{display:block;width:100%;border:0;border-radius:14px;padding:15px;font-size:16px;font-weight:700;margin:8px 0;color:#1a1300;background:var(--acc)}
.btn.sec{background:var(--panel);color:var(--txt);border:1px solid var(--line)}
.btn.danger{background:#3a1d24;color:#ff8fa3;border:1px solid #5c2733}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px;margin:10px 0}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.tag{font-size:11px;padding:3px 8px;border-radius:99px;background:#2b3355;color:var(--dim)}
.tag.g{color:#9ef3b6;background:#14351f}.tag.y{color:#ffe08a;background:#3a3113}.tag.r{color:#ffa1a1;background:#3a1d24}
.stat3{display:flex;gap:8px;margin:10px 0}
.stat3>div{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center}
.stat3 b{font-size:20px;display:block;color:var(--acc)}.stat3 span{font-size:11px;color:var(--dim)}
.roomrow{display:flex;justify-content:space-between;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;margin:8px 0}
.roomrow button{background:var(--acc);border:0;border-radius:10px;padding:10px 16px;font-weight:700}
.lb{display:flex;justify-content:space-between;padding:9px 4px;border-bottom:1px solid var(--line);font-size:14px}
.ball{width:74px;height:74px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;margin:6px auto;box-shadow:0 6px 18px rgba(0,0,0,.5);animation:popin .35s}
.ball small{font-size:11px;opacity:.85}.ball b{font-size:26px}
@keyframes popin{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.15)}100%{transform:scale(1)}}
.hist{display:flex;gap:6px;margin:10px 0}
.hist>div{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:5px;text-align:center}
.hist h5{font-size:11px;color:var(--dim)}.hist p{font-size:12px;line-height:1.5;min-height:18px}
.cardwrap{margin:12px 0}.cardtitle{font-size:12px;color:var(--acc);margin-bottom:5px;letter-spacing:1px}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.grid .h{background:#232a4a;color:var(--acc);font-weight:800;text-align:center;border-radius:8px;padding:6px 0}
.cell{aspect-ratio:1;background:var(--panel);border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;cursor:pointer}
.cell.free{color:var(--acc);cursor:default}
.cell.on{background:#22c55e;color:#04220f;border-color:#22c55e;animation:popin .3s;cursor:default}
.cell.hot{border-color:var(--acc);color:var(--acc);animation:pulse 1s infinite}
@keyframes pulse{50%{transform:scale(1.07)}}
.banner{background:linear-gradient(135deg,#f59e0b,#f97316);color:#1a1300;border-radius:14px;padding:14px;text-align:center;font-weight:800;margin:10px 0}
.banner.grey{background:#2a3050;color:var(--dim)}
.count{font-size:40px;font-weight:800;text-align:center;color:var(--acc);margin:8px 0}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.chips span{font-size:12px;background:#232a4a;border:1px solid var(--line);border-radius:99px;padding:4px 10px}
.waitdots{text-align:center;color:var(--dim);padding:16px}
.small{font-size:12px;color:var(--dim)}.back{background:none;border:0;color:var(--acc);font-size:14px;padding:6px 0}
#confetti{position:fixed;inset:0;pointer-events:none;overflow:hidden}
#confetti span{position:absolute;top:-12px;width:9px;height:14px;animation:fall 2.8s linear forwards}
@keyframes fall{to{transform:translateY(105vh) rotate(660deg)}}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#000c;color:#fff;padding:10px 18px;border-radius:99px;font-size:13px;z-index:9}
</style>
</head>
<body>

<div id="s-load" class="screen active"><p class="waitdots">Connecting…</p></div>

<div id="s-home" class="screen">
  <h1>🎱 <span class="logo">EBISA</span> BINGO</h1>
  <p class="sub">75-ball live rooms • tap to daub • first line wins</p>
  <div class="stat3">
    <div><b id="st-pts">0</b><span>POINTS</span></div>
    <div><b id="st-wins">0</b><span>WINS</span></div>
    <div><b id="st-games">0</b><span>ROUNDS</span></div>
  </div>
  <button class="btn" onclick="quickJoin()">🎮 JOIN GAME</button>
  <div class="panel"><div class="row"><b>Rooms</b><span class="small">auto-refresh</span></div><div id="rooms"></div></div>
  <div class="panel"><b>🏆 Leaderboard</b><div id="lb"></div></div>
</div>

<div id="s-room" class="screen">
  <button class="back" onclick="leaveRoom()">‹ Back</button>
  <div class="row"><b id="r-title"></b><span class="tag" id="r-status"></span></div>
  <div id="r-body"></div>
</div>

<div id="confetti"></div>

<script>
const API = 'PASTE_YOUR_WORKER_URL';   /* e.g. 'https://ebisa-bingo-backend.yourname.workers.dev' */
const MAXC = 3, LT = ['B','I','N','G','O'];
const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }
const INIT = (tg && tg.initData) || '';
let me = null, inRoom = null, pollT = null, state = null;
let lastDrawnLen = 0, lastStatus = '', daubBusy = false;
let autoD = localStorage.getItem('ebisaAuto') === '1';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); $(id).classList.add('active'); }
function haptic(t, d) { try { t === 'n' ? tg.HapticFeedback.notificationOccurred(d) : tg.HapticFeedback.impactOccurred(d); } catch (e) {} }
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }
function confetti() {
  const cols = ['#fbbf24','#22c55e','#3b82f6','#ef4444','#a855f7'];
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + 'vw'; s.style.background = cols[i % 5];
    s.style.animationDelay = (Math.random() * 1.2) + 's';
    $('confetti').appendChild(s); setTimeout(() => s.remove(), 4200);
  }
}
async function api(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', 'x-init-data': INIT } });
  const d = await r.json().catch(() => ({ ok: false, error: 'bad_response' }));
  if (!r.ok || d.ok === false) throw d; return d;
}

/* ---------- home ---------- */
function boot() { show('s-load'); loadHome(); }
async function loadHome() {
  try { const d = await api('/api/lobby'); me = d.me; renderHome(d); }
  catch (e) {
    if ($('s-load').classList.contains('active'))
      $('s-load').innerHTML = '<p class="waitdots">⚠️ ' + (e.error || 'Cannot connect') + '.<br>Open this app from the bot in Telegram.</p>';
    else toast('Reconnecting…');
  }
}
setInterval(() => { if (inRoom === null && $('s-home').classList.contains('active')) loadHome(); }, 6000);

async function renderHome(d) {
  $('st-pts').textContent = me.points; $('st-wins').textContent = me.wins; $('st-games').textContent = me.games;
  $('rooms').innerHTML = d.rooms.map(r => {
    const tag = r.status === 'WAITING' ? '<span class="tag g">OPEN</span>'
      : r.status === 'COUNTDOWN' ? '<span class="tag y">STARTING</span>'
      : r.status === 'DRAWING' ? '<span class="tag r">LIVE</span>' : '<span class="tag">ENDING</span>';
    return '<div class="roomrow"><div><b>Room ' + r.id + '</b> ' + tag +
      '<br><span class="small">' + r.players + ' player' + (r.players === 1 ? '' : 's') + ' • round ' + r.round_no + '</span></div>' +
      (r.in_room ? '<button onclick="enterRoom(' + r.id + ')">ENTER</button>'
        : (r.status === 'WAITING' || r.status === 'COUNTDOWN') ? '<button onclick="joinRoom(' + r.id + ')">JOIN</button>'
        : '<span class="small">…</span>') + '</div>';
  }).join('');
  try {
    const l = await api('/api/leaderboard');
    $('lb').innerHTML = l.list.map((u, i) =>
      '<div class="lb"><span>' + (['🥇','🥈','🥉'][i] || (i + 1) + '.') + ' ' + esc(u.name) + '</span><span><b>' + u.points + '</b> pts</span></div>'
    ).join('') || '<p class="small">No players yet.</p>';
  } catch (e) {}
  show('s-home');
}

async function quickJoin() { try { const d = await api('/api/join', { method: 'POST', body: '{}' }); enterRoom(d.room_id); } catch (e) { toast(e.error || 'No open room'); loadHome(); } }
async function joinRoom(id) { try { await api('/api/join', { method: 'POST', body: JSON.stringify({ room_id: id }) }); enterRoom(id); } catch (e) { toast(e.error || 'Cannot join'); loadHome(); } }
async function addCartela() { try { await api('/api/addcartela', { method: 'POST', body: JSON.stringify({ room_id: inRoom }) }); poll(); } catch (e) { toast(e.error || 'Failed'); } }
async function leaveRoom() {
  clearInterval(pollT);
  if (inRoom) { try { await api('/api/leave', { method: 'POST', body: JSON.stringify({ room_id: inRoom }) }); } catch (e) {} }
  inRoom = null; state = null; boot();
}

/* ---------- room ---------- */
function enterRoom(id) {
  inRoom = id; state = null; lastDrawnLen = 0; lastStatus = '';
  show('s-room'); clearInterval(pollT); poll(); pollT = setInterval(poll, 1500);
}
async function poll() {
  if (!inRoom) return;
  let d; try { d = await api('/api/state?room=' + inRoom); } catch (e) { return; }
  state = d;
  if (autoD) await autoDaub();
  if (!daubBusy) renderRoom();
}

/* tap a number = daub it (optimistic, server verifies) */
async function daub(idx, num) {
  if (!state) return;
  const c = state.you.cartelas.find(x => x.idx === idx);
  if (!c) return;
  const i = c.cells.indexOf(num);
  if (i < 0 || ((c.marked >> i) & 1)) return;
  if (!state.room.drawn.includes(num)) { haptic('n', 'error'); toast('Number ' + num + ' not called yet'); return; }
  c.marked |= (1 << i); daubBusy = true; haptic('i', 'medium'); renderRoom();
  try {
    const d = await api('/api/daub', { method: 'POST', body: JSON.stringify({ room_id: inRoom, cartela_idx: idx, number: num }) });
    if (d.win) { haptic('n', 'success'); }
  } catch (e) {
    c.marked &= ~(1 << i); toast(e.error || 'Daub failed');
  }
  daubBusy = false; poll();
}
/* optional: auto-tap for you */
async function autoDaub() {
  if (daubBusy || !state || state.room.status !== 'DRAWING') return;
  daubBusy = true;
  try {
    for (const c of state.you.cartelas)
      for (const n of state.room.drawn) {
        const i = c.cells.indexOf(n);
        if (i >= 0 && !((c.marked >> i) & 1)) {
          c.marked |= (1 << i); haptic('i', 'light');
          try { await api('/api/daub', { method: 'POST', body: JSON.stringify({ room_id: inRoom, cartela_idx: c.idx, number: n }) }); }
          catch (e) { c.marked &= ~(1 << i); }
        }
      }
  } finally { daubBusy = false; }
}
function toggleAuto() { autoD = !autoD; localStorage.setItem('ebisaAuto', autoD ? '1' : '0'); renderRoom(); }

function cardHTML(c, drawnSet) {
  let g = LT.map(l => '<div class="h">' + l + '</div>').join('');
  c.cells.forEach((n, i) => {
    if (n === 0) { g += '<div class="cell free on">★</div>'; return; }
    const marked = (c.marked >> i) & 1;
    const hot = !marked && drawnSet.has(n);
    g += '<div class="cell' + (marked ? ' on' : '') + (hot ? ' hot' : '') + '" onclick="daub(' + c.idx + ',' + n + ')">' + n + '</div>';
  });
  return '<div class="cardwrap"><div class="cardtitle">CARTELA #' + c.idx + '</div><div class="grid">' + g + '</div></div>';
}

function renderRoom() {
  if (!state) return;
  const r = state.room, you = state.you;
  $('r-title').textContent = 'ROOM ' + r.id + ' • ROUND ' + r.round_no;
  if (!you.in_room) { clearInterval(pollT); inRoom = null; toast('You left the room'); boot(); return; }
  const drawnSet = new Set(r.drawn);
  let html = '';

  if (r.status === 'WAITING') {
    html = '<div class="panel"><div class="row"><b>⏳ Waiting for players</b><span class="tag g">' + r.players.length + ' SEATED</span></div>'
      + '<p class="small" style="margin-top:8px">'
      + (r.players.length < 2 ? 'Need at least 2 players — round starts automatically when someone joins.' : 'Get ready…')
      + '</p><div class="chips">' + r.players.map(p => '<span>' + esc(p) + '</span>').join('') + '</div></div>';
  } else if (r.status === 'COUNTDOWN') {
    html = '<div class="panel" style="text-align:center"><div class="small">ROUND STARTING IN</div><div class="count">'
      + Math.max(0, Math.ceil((r.start_at - Date.now()) / 1000)) + 's</div>'
      + '<div class="chips" style="justify-content:center">' + r.players.map(p => '<span>' + esc(p) + '</span>').join('') + '</div></div>';
  } else if (r.status === 'DRAWING') {
    if (r.drawn.length > lastDrawnLen) haptic('i', 'rigid');
    const n = r.drawn[r.drawn.length - 1], lt = LT[Math.floor((n - 1) / 15)];
    const col = { B: '#3b82f6', I: '#ef4444', N: '#94a3b8', G: '#22c55e', O: '#eab308' }[lt];
    const by = { B: [], I: [], N: [], G: [], O: [] };
    r.drawn.forEach(x => by[LT[Math.floor((x - 1) / 15)]].push(x));
    html = '<div class="ball" style="background:' + col + '"><small>' + lt + '</small><b>' + n + '</b></div>'
      + '<div class="hist">' + LT.map(l => '<div><h5>' + l + '</h5><p>' + by[l].join(' ') + '</p></div>').join('') + '</div>';
  } else if (r.status === 'FINISHED') {
    const someoneWon = r.winner_name && r.winner_name !== 'Nobody';
    if (lastStatus !== 'FINISHED' && someoneWon) { haptic('n', 'success'); confetti(); }
    html = someoneWon
      ? '<div class="banner">🏆 ' + esc(r.winner_name) + ' wins!<br><span style="font-size:13px">Cartela #' + r.winner_cartela + ' • +' + state.win_points + ' pts • next round soon…</span></div>'
      : '<div class="banner grey">No BINGO this round — reshuffling cartelas…</div>';
  }

  html += '<div class="row" style="margin-top:6px"><span class="small">Your cartelas: ' + you.cartelas.length + '/' + MAXC + '</span>'
    + (you.cartelas.length < MAXC && (r.status === 'WAITING' || r.status === 'COUNTDOWN')
      ? '<button class="btn sec" style="width:auto;padding:8px 14px;margin:0" onclick="addCartela()">+ Add cartela</button>' : '') + '</div>';
  if (r.status === 'DRAWING')
    html += '<button class="btn sec" onclick="toggleAuto()">🤖 AUTO-DAUB: ' + (autoD ? 'ON' : 'OFF') + '</button>'
      + '<p class="small" style="text-align:center">Tap the glowing numbers on your cartela to daub them!</p>';
  html += you.cartelas.map(c => cardHTML(c, drawnSet)).join('');
  if (r.status === 'WAITING') html += '<button class="btn danger" onclick="leaveRoom()">Leave room</button>';

  $('r-status').textContent = r.status;
  $('r-status').className = 'tag ' + (r.status === 'WAITING' ? 'g' : r.status === 'COUNTDOWN' ? 'y' : r.status === 'DRAWING' ? 'r' : '');
  $('r-body').innerHTML = html;
  lastDrawnLen = r.drawn.length; lastStatus = r.status;
}

boot();
</script>
</body>
</html>
