(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RM = matchMedia('(prefers-reduced-motion:reduce)').matches;
const EASE = 'cubic-bezier(.16,1,.3,1)';
const AK = window.AK;
const OPS = AK.OPS, ITEMS = AK.ITEMS, VOICES = AK.VOICES;
const RC = AK.RC;
const PROF = { PIONEER: '先锋', WARRIOR: '近卫', TANK: '重装', SNIPER: '狙击', CASTER: '术师', MEDIC: '医疗', SUPPORT: '辅助', SPECIAL: '特种' };
const POS = { MELEE: '近战位', RANGED: '远程位', ALL: '全域' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = r => '★'.repeat(r + 1);
const dur = ms => RM ? 1 : ms;

/* ================= 舞台缩放 ================= */
const stage = $('#stage');
function fit() { stage.style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; }
addEventListener('resize', fit); fit();

/* ================= 主色 → CSS 变量(@property 过渡) ================= */
const root = document.documentElement;
function setTone(hex) {
  const n = parseInt(hex.slice(1), 16);
  root.style.setProperty('--tr', (n >> 16) & 255);
  root.style.setProperty('--tg', (n >> 8) & 255);
  root.style.setProperty('--tb', n & 255);
}

/* ================= 视差 / 3D 倾斜 / 光斑 ================= */
const layers = $$('.px[data-depth]'), tilt = $('#tilt'), flare = $('#flare');
let tx = 0, ty = 0, cx = 0, cy = 0, mx = innerWidth / 2, my = innerHeight / 2, fx = mx, fy = my;
addEventListener('pointermove', e => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; mx = e.clientX; my = e.clientY; });
let view = 'lobby';
(function loop() {
  cx += (tx - cx) * .06; cy += (ty - cy) * .06; fx += (mx - fx) * .12; fy += (my - fy) * .12;
  for (const l of layers) { const d = +l.dataset.depth; l.style.transform = `translate3d(${(-cx * d * innerWidth).toFixed(2)}px,${(-cy * d * innerHeight).toFixed(2)}px,0)`; }
  if (!RM) tilt.style.transform = `perspective(1500px) rotateY(${(cx * 3.2).toFixed(3)}deg) rotateX(${(-cy * 1.8).toFixed(3)}deg)`;
  flare.style.transform = `translate(${fx.toFixed(1)}px,${fy.toFixed(1)}px)`;
  flare.style.opacity = view === 'lobby' ? .9 : .35;
  requestAnimationFrame(loop);
})();

/* ================= 尘埃粒子 ================= */
const cv = $('#dust'), g = cv.getContext('2d'); let P = [];
function rs() { cv.width = innerWidth; cv.height = innerHeight; P = Array.from({ length: 80 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 1.8 + .4, vx: (Math.random() - .5) * .25, vy: -Math.random() * .35 - .05, a: Math.random() * .5 + .15, p: Math.random() * 6 })); }
addEventListener('resize', rs); rs();
(function dust(t) {
  g.clearRect(0, 0, cv.width, cv.height);
  const col = `rgb(${getComputedStyle(root).getPropertyValue('--tr') | 0},${getComputedStyle(root).getPropertyValue('--tg') | 0},${getComputedStyle(root).getPropertyValue('--tb') | 0})`;
  for (const p of P) {
    if (!RM) { p.x += p.vx; p.y += p.vy; }
    if (p.y < -5) { p.y = cv.height + 5; p.x = Math.random() * cv.width; }
    if (p.x < -5) p.x = cv.width + 5; if (p.x > cv.width + 5) p.x = -5;
    g.globalAlpha = p.a * (.6 + .4 * Math.sin(t / 900 + p.p)); g.fillStyle = p.r > 1.4 ? col : '#cfeaff';
    g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
  }
  requestAnimationFrame(dust);
})(0);

/* ================= 音效(WebAudio 合成) ================= */
let ac = null, muted = false;
function actx() { return ac = ac || new (window.AudioContext || window.webkitAudioContext)(); }
function beep(f1, f2, d, type = 'square', vol = .04) {
  if (muted) return;
  try { const a = actx(), o = a.createOscillator(), gn = a.createGain(), t = a.currentTime;
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + d);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(gn).connect(a.destination); o.start(t); o.stop(t + d); } catch (e) {}
}
function whoosh() {
  if (muted) return;
  try { const a = actx(), len = a.sampleRate * .7, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(); s.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, a.currentTime); f.frequency.exponentialRampToValueAtTime(5200, a.currentTime + .35); f.frequency.exponentialRampToValueAtTime(700, a.currentTime + .7);
    const gn = a.createGain(); gn.gain.setValueAtTime(.0001, a.currentTime); gn.gain.linearRampToValueAtTime(.1, a.currentTime + .18); gn.gain.exponentialRampToValueAtTime(.0001, a.currentTime + .7);
    s.connect(f).connect(gn).connect(a.destination); s.start(); } catch (e) {}
}
AK.beep = beep; AK.whoosh = whoosh; AK.muted = () => muted;
const HOVER_SEL = '.cell,.sbtn,.activity,.plus,.back,.chip,.btn,.card,.itm,.arrow,#eliteBtn,[data-name]';
let lastHover = null;
document.addEventListener('pointerover', e => { const el = e.target.closest(HOVER_SEL); if (el && el !== lastHover) beep(1500, 1100, .04, 'square', .018); lastHover = el; });
const clickSnd = () => { beep(500, 900, .08, 'square', .04); setTimeout(() => beep(1200, 1200, .05, 'triangle', .03), 60); };

/* ================= toast / 涟漪 ================= */
let tt; function toast(s) { AK.toast(s); }
AK.toast = function (s) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1700); }
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.cell,.sbtn,.activity,.plus,.back,.btn,.chip,.arrow,#eliteBtn,[data-name]'); if (!el) return;
  clickSnd();
  const host = el.closest('.cell,.sbtn,.activity,.btn,.back,.chip') || el;
  const r = host.getBoundingClientRect(), k = host.offsetWidth / (r.width || 1);
  const rp = document.createElement('i'); rp.className = 'ripple';
  const sz = Math.max(host.offsetWidth, host.offsetHeight) * 2.2;
  rp.style.cssText = `left:${(e.clientX - r.left) * k}px;top:${(e.clientY - r.top) * k}px;width:${sz}px;height:${sz}px`;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.style.overflow = host.style.overflow || 'hidden';
  host.appendChild(rp); setTimeout(() => rp.remove(), 600);
});
document.addEventListener('click', e => {
  const act = e.target.closest('[data-act]'); if (act && AK.act && AK.act[act.dataset.act]) { AK.act[act.dataset.act](); return; }
  const go = e.target.closest('[data-go]'); if (go) { navigate(go.dataset.go); return; }
  const nm = e.target.closest('[data-name]'); if (nm && nm.dataset.name) toast(`「${nm.dataset.name}」· 演示界面,未接入功能`);
});

/* ================= 时钟 / 数字滚动 ================= */
const p2 = n => String(n).padStart(2, '0');
function tick() { const d = new Date(); $('#clock').textContent = `${d.getFullYear()}/${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; }
tick(); setInterval(tick, 1000);
function count(el, to, d = 1200, delay = 0, fmt = v => v) {
  const t0 = performance.now() + delay;
  (function f(t) { const k = Math.min(Math.max((t - t0) / d, 0), 1), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(to * e)); if (k < 1) requestAnimationFrame(f); })(performance.now());
}
function lobbyIntro(delay = 900) {
  const ring = $('#lvring'); ring.style.transition = 'none'; ring.style.strokeDashoffset = 301.6; ring.getBoundingClientRect();
  ring.style.transition = ''; ring.style.strokeDashoffset = 301.6 * (1 - .64);
  count($('#lvnum'), 64, 1200, delay);
  count($('#san'), AK.san(), 1300, delay + 200);
  $$('.res b').forEach((b, i) => count(b, +b.dataset.n, 1100, delay - 100 + i * 120));
}

/* ================= 大厅:干员看板 ================= */
const slots = [$('#slotA'), $('#slotB')];
let front = 0, seq = 0, cur = 0, elite = false, variant = 0, settlePending = null, lines = [], lineIdx = 0, tk;
const art = (op, e0) => `assets/art/${op.id}${e0 ? '_e0' : ''}.webp`;
const loadImg = src => new Promise(res => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

function say(s) {
  const el = $('#vtxt'); el.textContent = ''; let i = 0; clearInterval(tk);
  tk = setInterval(() => { el.textContent = s.slice(0, ++i); if (i >= s.length) clearInterval(tk); }, 34);
}
function buildName(op) {
  const nm = $('#npNm'); nm.innerHTML = '';
  [...op.n].forEach((ch, i) => { const s = document.createElement('span'); s.textContent = ch; s.style.animationDelay = (i * 55 + 120) + 'ms'; nm.appendChild(s); });
  $('#npNo').textContent = op.no || op.id;
  $('#npEn').textContent = (op.e || '').toUpperCase();
  const st = $('#npStars'); st.textContent = stars(op.r); st.style.color = RC[op.r];
  $('#npProf').textContent = PROF[op.p] || op.p;
  $('#npNa').textContent = op.na || '—';
  $('#npNa').style.display = op.na ? '' : 'none';
  $('#pager').innerHTML = `<b>${String(cur + 1).padStart(3, '0')}</b> / ${String(OPS.length).padStart(3, '0')}`;
}

async function showOp(i, { dir = 1, first = false, keepElite = false } = {}) {
  const my = ++seq;
  i = (i + OPS.length) % OPS.length;
  const op = OPS[i];
  if (!keepElite) elite = false;
  const useE0 = elite && op.e0;
  const col = useE0 ? op.c0 : op.c;
  const im = await loadImg(art(op, useE0));
  if (my !== seq) return;
  if (settlePending) settlePending();
  cur = i; localStorage.setItem('ak.op', op.id);

  const fs = slots[front], bs = slots[1 - front]; front = 1 - front;
  const img = document.createElement('img'); img.src = art(op, useE0); img.draggable = false; img.alt = op.n;
  bs.innerHTML = ''; bs.appendChild(img); bs.style.zIndex = 2; fs.style.zIndex = 1;
  bs.style.opacity = 1;

  let v = first ? -1 : (variant++ % 3);
  const anims = [];
  const ease = EASE;
  const O = (el, kf, o) => { const a = el.animate(kf, { easing: ease, fill: 'both', ...o, duration: dur(o.duration) }); anims.push(a); return a; };
  if (v === -1) {
    O(bs, [{ opacity: 0, transform: 'translateX(-70px)', filter: 'brightness(2.4) blur(6px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 1100 });
  } else if (v === 0) {
    const a = dir > 0 ? ['polygon(0 0,0 0,-25% 100%,-25% 100%)', 'polygon(0 0,125% 0,100% 100%,-25% 100%)']
                       : ['polygon(100% 0,100% 0,125% 100%,125% 100%)', 'polygon(-25% 0,100% 0,125% 100%,0 100%)'];
    O(bs, [{ clipPath: a[0], transform: `translateX(${-90 * dir}px)`, filter: 'brightness(2.3)' }, { clipPath: a[1], transform: 'none', filter: 'brightness(1)' }], { duration: 850 });
    O(fs, [{ transform: 'none', opacity: 1, filter: 'none' }, { transform: `translateX(${70 * dir}px) scale(.96)`, opacity: 0, filter: 'blur(8px) brightness(.6)' }], { duration: 700 });
  } else if (v === 1) {
    O(bs, [{ opacity: 0, transform: 'translateY(80px) scale(1.07)', filter: 'brightness(3) blur(12px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 950 });
    O(fs, [{ opacity: 1, transform: 'none', filter: 'none' }, { opacity: 0, transform: 'translateY(-34px) scale(.97)', filter: 'blur(8px)' }], { duration: 600 });
  } else {
    O(bs, [
      { opacity: 0, transform: 'translateX(46px) skewX(-8deg)', filter: 'brightness(3) saturate(0)' },
      { opacity: 1, offset: .14, transform: 'translateX(-20px) skewX(4deg)', filter: 'brightness(2) hue-rotate(45deg)' },
      { opacity: .25, offset: .28, transform: 'translateX(16px)', filter: 'brightness(1.6)' },
      { opacity: 1, offset: .42, transform: 'translateX(-7px)', filter: 'brightness(1.4) hue-rotate(-35deg)' },
      { opacity: .7, offset: .56, transform: 'translateX(3px)', filter: 'brightness(1.2)' },
      { opacity: 1, transform: 'none', filter: 'none' }], { duration: 760, easing: 'linear' });
    O(fs, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'linear' });
  }
  const settle = () => {
    if (settlePending !== settle) return; settlePending = null;
    anims.forEach(a => a.cancel()); fs.innerHTML = ''; fs.style.opacity = 0; bs.style.opacity = 1;
  };
  settlePending = settle;
  Promise.all(anims.map(a => a.finished)).then(settle).catch(() => {});

  // 光影:扫光 / 闪光 / 光环 / 地面光 / 主色
  setTone(col);
  if (!first && !RM) {
    $('#sweep').animate([{ transform: 'translateX(-70%)', opacity: 0 }, { opacity: .55, offset: .35 }, { transform: 'translateX(330%)', opacity: 0 }], { duration: 1100, easing: 'ease-in-out' });
    $('#flash').animate([{ opacity: 0 }, { opacity: .75, offset: .12 }, { opacity: 0 }], { duration: 750, easing: 'ease-out' });
    $('#halo').animate([{ transform: 'scale(.8) rotate(-12deg)', opacity: .1 }, { transform: 'none', opacity: 1 }], { duration: 1000, easing: EASE });
    $('#floor').animate([{ opacity: .1, transform: 'scaleX(.6)' }, { opacity: 1, transform: 'none' }], { duration: 900, easing: EASE });
    whoosh();
  }
  buildName(op);
  const eb = $('#eliteBtn');
  eb.style.display = op.e0 ? '' : 'none';
  eb.textContent = useE0 ? '切换 · 精英二' : '切换 · 精英零';
  curLine = null;
  lines = [op.qt, op.us, op.ds && op.ds.replace(/[‹›]/g, '')].filter(Boolean); lineIdx = 0;
  const vl = VOICES[op.id] || [];
  const intro = vl.find(l => l[0] === '任命助理');
  if (intro && !first) { curLine = intro; sayLine(op.id, intro); }
  else say(intro ? intro[1] : (lines[0] || '博士,请下达指示。'));
  AK.emit('op', i);
  // 预取邻居
  const pre = k => { const o = OPS[(i + k + OPS.length) % OPS.length]; const im = new Image(); im.src = art(o, false); };
  setTimeout(() => { pre(1); pre(-1); }, 900);
}
const nextOp = d => showOp(cur + d, { dir: d });
$('#nextOp').addEventListener('click', () => nextOp(1));
$('#prevOp').addEventListener('click', () => nextOp(-1));
$('#eliteBtn').addEventListener('click', () => { elite = !elite; showOp(cur, { keepElite: true, dir: 1 }); });
/* 大厅台词:点击立绘随机播放「交谈 / 戳一下」等真实台词,逐字打出并按设置朗读 */
let curLine = null, talkQ = [];
function sayLine(opId, line) {
  const el = $('#vtxt'); clearInterval(tk); el.textContent = ''; $('#voiceBox').dataset.t = 'VOICE · ' + line[0];
  const text = line[1];
  const r = AK.vox.play(opId, line, { quiet: true, onTick: p => { el.textContent = text.slice(0, Math.ceil(p * text.length)); }, onEnd: () => { el.textContent = text; } });
  if (!r) say(text);
}
function pickTalk() {
  const op = OPS[cur], vl = (VOICES[op.id] || []).filter(l => l[3] === 'HOME_SHOW' || l[3] === 'BUILDING_TOUCHING' || l[3] === 'HOME_WAIT' || l[3] === 'GREETING');
  if (!vl.length) return null;
  if (!talkQ.length || talkQ.opId !== op.id) { talkQ = vl.map((l, i) => i).sort(() => Math.random() - .5); talkQ.opId = op.id; }
  return vl[talkQ.pop()];
}
$('#charHit').addEventListener('click', () => {
  const op = OPS[cur], l = pickTalk();
  if (l) { curLine = l; sayLine(op.id, l); }
  else { if (!lines.length) return; lineIdx = (lineIdx + 1) % lines.length; say(lines[lineIdx]); }
  beep(700, 1000, .1, 'triangle', .04); $('#flash').animate([{ opacity: 0 }, { opacity: .35 }, { opacity: 0 }], { duration: 500 });
});

/* ================= 页面转场 ================= */
const TITLES = Object.assign({ ops: ['干员', 'OPERATOR'], depot: ['仓库', 'DEPOT'], lobby: ['罗德岛', 'RHODES ISLAND'] }, AK.TITLES);
const P_IN = x => `polygon(0 0,${x + 30}% 0,${x}% 100%,-30% 100%)`;
const P_OUT = x => `polygon(${x}% 0,130% 0,130% 100%,${x - 30}% 100%)`;
let navBusy = false, prevView = 'lobby';
async function navigate(name, arg) {
  if (name === 'back') name = prevView || 'lobby';
  if (navBusy || name === view || !$('#v-' + name)) return;
  navBusy = true; prevView = view; AK.vox.stop();
  const [tb, ts] = TITLES[name];
  $('#wtB').textContent = tb; $('#wtS').textContent = ts;
  const wipe = $('#wipe'); wipe.classList.add('on');
  whoosh();
  const o = { easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' };
  const A = $('#wipeC').animate([{ clipPath: P_IN(-30) }, { clipPath: P_IN(100) }], { ...o, duration: dur(420) });
  const B = $('#wipeD').animate([{ clipPath: P_IN(-30) }, { clipPath: P_IN(100) }], { ...o, duration: dur(460), delay: dur(110) });
  const tAn = [
    $('#wtB').animate([{ clipPath: 'inset(0 100% 0 0)', transform: 'translateX(-40px)' }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }], { duration: dur(520), delay: dur(420), easing: EASE, fill: 'both' }),
    $('#wtS').animate([{ opacity: 0, letterSpacing: '1.4em' }, { opacity: 1, letterSpacing: '.7em' }], { duration: dur(520), delay: dur(520), easing: EASE, fill: 'both' }),
    $('#wtI').animate([{ width: '0px' }, { width: '300px' }], { duration: dur(480), delay: dur(560), easing: EASE, fill: 'both' })];
  await B.finished;
  // 中点:切换视图
  $$('.view').forEach(v => v.classList.remove('on'));
  $('#v-' + name).classList.add('on');
  view = name;
  $('#hint').style.display = name === 'lobby' ? '' : 'none';
  if (name === 'lobby') { lobbyIntro(1000); say(lines[0] || ''); }
  if (name === 'ops') enterOps();
  if (name === 'depot') enterDepot();
  if (AK.enter[name]) AK.enter[name](arg);
  if (name === 'squad' && AK.leader && AK.leader()) setTone(AK.leader().c);
  else if (name !== 'ops' && name !== 'voice') setTone((OPS[cur] && (elite && OPS[cur].e0 ? OPS[cur].c0 : OPS[cur].c)) || '#18d1ff');
  await sleep(dur(520));
  const oo = { easing: 'cubic-bezier(.7,0,.2,1)', fill: 'forwards' };
  $('#wtB').animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur(250), fill: 'forwards' });
  $('#wtS').animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur(250), fill: 'forwards' });
  $('#wtI').animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur(250), fill: 'forwards' });
  const B2 = $('#wipeD').animate([{ clipPath: P_OUT(0) }, { clipPath: P_OUT(130) }], { ...oo, duration: dur(520) });
  const A2 = $('#wipeC').animate([{ clipPath: P_OUT(0) }, { clipPath: P_OUT(130) }], { ...oo, duration: dur(520), delay: dur(130) });
  await A2.finished;
  document.getAnimations().forEach(a => { if (a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#wipe')) a.cancel(); });
  wipe.classList.remove('on');
  navBusy = false;
}

/* ================= 干员页 ================= */
let oInit = false, oSel = 0, oFilter = { p: 'ALL', r: -1, q: '' };
function chipRow(host, items, onPick, init) {
  const h = $(host);
  items.forEach(([val, label]) => {
    const b = document.createElement('button'); b.className = 'chip' + (val === init ? ' on' : ''); b.textContent = label; b.dataset.v = val;
    b.addEventListener('click', () => { h.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b)); onPick(val); });
    h.appendChild(b);
  });
}
function opMatches(o) {
  if (oFilter.p !== 'ALL' && o.p !== oFilter.p) return false;
  if (oFilter.r >= 0 && o.r !== oFilter.r) return false;
  const q = oFilter.q; if (!q) return true;
  return (o.n + ' ' + o.e + ' ' + o.id + ' ' + o.no + ' ' + o.tg.join(' ') + ' ' + (PROF[o.p] || '') + ' ' + o.na + ' ' + o.sp).toLowerCase().includes(q);
}
function renderOps() {
  const grid = $('#oGrid'); grid.innerHTML = '';
  const list = []; OPS.forEach((o, i) => { if (opMatches(o)) list.push(i); });
  $('#oCnt').textContent = list.length; $('#oTot').textContent = OPS.length;
  if (!list.length) { grid.innerHTML = '<div class="empty">没有符合条件的干员</div>'; return; }
  const frag = document.createDocumentFragment();
  list.forEach((idx, k) => {
    const o = OPS[idx], d = document.createElement('div');
    d.className = 'card' + (idx === oSel ? ' sel' : '') + (idx === cur ? ' main' : ''); d.dataset.i = idx;
    d.style.setProperty('--rc', RC[o.r]); d.style.setProperty('--i', Math.min(k, 28));
    d.innerHTML = `<div class="pt"></div><img loading="lazy" decoding="async" src="assets/portrait/${o.id}.png" onerror="this.onerror=null;this.src='assets/avatar/${o.id}.png'" alt=""><span class="mk">看板</span><span class="st">${stars(o.r)}</span><div class="nm">${esc(o.n)}</div><div class="pf">${PROF[o.p] || ''} · ${esc(o.e)}</div><div class="rb"></div>`;
    frag.appendChild(d);
  });
  grid.appendChild(frag);
}
let maxSt = null;
function renderDetail(idx, anim = true) {
  const o = OPS[idx], box = $('#oDet'); oSel = idx;
  if (!maxSt) { maxSt = { hp: 1, atk: 1, def: 1 }; OPS.forEach(x => { for (const k in maxSt) maxSt[k] = Math.max(maxSt[k], x.st[k] || 0); }); }
  const st = o.st || {};
  const bar = (lb, k) => `<div><div class="stt">${lb}<b>${st[k] ?? '—'}</b></div><div class="stb"><i data-w="${Math.min(100, (st[k] || 0) / maxSt[k] * 100)}"></i></div></div>`;
  box.innerHTML = `
   <div class="dArt"><div class="bigno">${esc(o.no || '')}</div><img src="${art(o, false)}" alt=""></div>
   <div class="dBody">
    <div class="nm">${esc(o.n)}</div><div class="en">${esc((o.e || '').toUpperCase())}</div>
    <div class="row"><span class="stars" style="color:${RC[o.r]}">${stars(o.r)}</span><span class="tag">${PROF[o.p] || o.p}</span><span class="tag">${POS[o.pos] || ''}</span>${o.na ? `<span class="tag">${esc(o.na)}</span>` : ''}</div>
    <div class="row">${o.tg.map(t => `<span class="tag" style="font-size:15px">${esc(t)}</span>`).join('')}</div>
    <div class="ds">${esc(o.ds).replace(/‹(.*?)›/g, '<em>$1</em>')}</div>
    ${o.qt ? `<div class="qt">${esc(o.qt)}</div>` : ''}
    <div class="sts">${bar('生命上限', 'hp')}${bar('攻击', 'atk')}${bar('防御', 'def')}<div><div class="stt">法术抗性<b>${st.res ?? '—'}</b></div></div><div><div class="stt">部署费用<b>${st.cost ?? '—'}</b></div></div><div><div class="stt">阻挡数<b>${st.blk ?? '—'}</b></div></div></div>
    <div class="note" style="margin-top:14px;font:400 12px/1.5 var(--sans);color:#6f8291">数值为精二满级基础面板(不含潜能 / 信赖 / 模组)</div>
    <div class="btns"><button class="btn" id="btnSet">设为看板</button><button class="btn alt" id="btnArt">查看立绘</button></div>
   </div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => box.querySelectorAll('.stb i').forEach(i => i.style.width = i.dataset.w + '%')));
  $('#btnSet').addEventListener('click', () => { showOp(idx, { dir: 1 }); toast(`已设为看板:${o.n}`); $$('#oGrid .card').forEach(c => c.classList.toggle('main', +c.dataset.i === idx)); });
  $('#btnArt').addEventListener('click', () => { showOp(idx, { dir: 1 }); navigate('lobby'); });
  if (anim && !RM) {
    box.querySelector('.dArt img').animate([{ opacity: 0, transform: 'translateX(-50%) translateX(30px)', filter: 'brightness(2.5) blur(6px)' }, { opacity: 1, transform: 'translateX(-50%)', filter: 'none' }], { duration: 650, easing: EASE });
  }
  setTone(o.c);
}
function selectCard(idx) {
  $$('#oGrid .card.sel').forEach(c => c.classList.remove('sel'));
  const el = $(`#oGrid .card[data-i="${idx}"]`); if (el) el.classList.add('sel');
  renderDetail(idx);
}
function enterOps() {
  if (!oInit) {
    oInit = true;
    chipRow('#oProf', [['ALL', '全部'], ...Object.entries(PROF)], v => { oFilter.p = v; renderOps(); }, 'ALL');
    chipRow('#oRar', [[-1, '全部'], [5, '★6'], [4, '★5'], [3, '★4'], [2, '★3'], [1, '★2'], [0, '★1']], v => { oFilter.r = +v; renderOps(); }, -1);
    let t; $('#oSearch').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { oFilter.q = e.target.value.trim().toLowerCase(); renderOps(); }, 90); });
    $('#oGrid').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) selectCard(+c.dataset.i); });
    $('#oGrid').addEventListener('dblclick', e => { const c = e.target.closest('.card'); if (c) { showOp(+c.dataset.i, { dir: 1 }); toast(`已设为看板:${OPS[+c.dataset.i].n}`); $$('#oGrid .card').forEach(x => x.classList.toggle('main', x === c)); } });
  }
  oSel = cur; renderOps(); renderDetail(oSel, false);
  const el = $(`#oGrid .card[data-i="${oSel}"]`); if (el) el.scrollIntoView({ block: 'center' });
}

/* ================= 仓库页 ================= */
let iInit = false, iSel = -1, iFilter = { t: 'ALL', r: -1, q: '' };
const TYPE = { MATERIAL: '养成材料', CONSUME: '消耗品', NORMAL: '货币 / 凭证' };
const RN = ['白', '绿', '蓝', '紫', '金', '橙'];
const qty = it => AK.qty(it);
const fmtN = n => n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '万' : String(n);
function itMatches(it) {
  if (iFilter.t !== 'ALL' && it.t !== iFilter.t) return false;
  if (iFilter.r >= 0 && it.r !== iFilter.r) return false;
  const q = iFilter.q; return !q || (it.n + ' ' + it.u + ' ' + it.d + ' ' + it.id).toLowerCase().includes(q);
}
function renderItems() {
  const grid = $('#iGrid'); grid.innerHTML = '';
  const list = []; ITEMS.forEach((it, i) => { if (itMatches(it)) list.push(i); });
  $('#iCnt').textContent = list.length; $('#iTot').textContent = ITEMS.length;
  if (!list.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1">没有符合条件的道具</div>'; return; }
  const frag = document.createDocumentFragment();
  list.forEach((idx, k) => {
    const it = ITEMS[idx], d = document.createElement('div');
    d.className = 'itm' + (idx === iSel ? ' sel' : ''); d.dataset.i = idx;
    d.style.setProperty('--rc', RC[Math.min(it.r, 5)]); d.style.setProperty('--i', Math.min(k, 30));
    d.innerHTML = `<div class="bg"></div><div class="rb"></div><img loading="lazy" decoding="async" src="assets/item/${it.i}.png" alt=""><span class="q">${fmtN(qty(it))}</span><div class="n">${esc(it.n)}</div>`;
    frag.appendChild(d);
  });
  grid.appendChild(frag);
}
function renderItemDetail(idx) {
  iSel = idx; const it = ITEMS[idx], rc = RC[Math.min(it.r, 5)];
  const box = $('#iDet');
  box.innerHTML = `<div class="iDet" style="--rc:${rc}">
    <div class="big"><img src="assets/item/${it.i}.png" alt=""></div>
    <div class="nm">${esc(it.n)}</div>
    <div class="sub"><span style="color:${rc}">${RN[Math.min(it.r, 5)]}色品质</span><span>${TYPE[it.t] || ''}</span><span>持有 ${qty(it).toLocaleString()}</span></div>
    ${it.d ? `<div class="hd">DESCRIPTION</div><p style="color:#9fb4c4;font-style:italic">${esc(it.d)}</p>` : ''}
    ${it.u ? `<div class="hd">USAGE</div><p>${esc(it.u)}</p>` : ''}
    ${it.o ? `<div class="hd">OBTAIN</div><p>${esc(it.o)}</p>` : ''}
    <div class="note">道具 ID:${esc(it.id)} · 持有数量为演示用的伪随机数据,并非真实账号。</div></div>`;
  if (!RM) box.querySelector('.big').animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0)' }], { duration: 520, easing: EASE });
}
function enterDepot() {
  if (!iInit) {
    iInit = true;
    chipRow('#iType', [['ALL', '全部'], ...Object.entries(TYPE)], v => { iFilter.t = v; renderItems(); }, 'ALL');
    chipRow('#iRar', [[-1, '全部'], ...RN.map((n, i) => [i, n]).reverse()], v => { iFilter.r = +v; renderItems(); }, -1);
    let t; $('#iSearch').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { iFilter.q = e.target.value.trim().toLowerCase(); renderItems(); }, 90); });
    $('#iGrid').addEventListener('click', e => { const c = e.target.closest('.itm'); if (!c) return; $$('#iGrid .itm.sel').forEach(x => x.classList.remove('sel')); c.classList.add('sel'); renderItemDetail(+c.dataset.i); });
    iSel = Math.max(0, ITEMS.findIndex(x => x.y === 'GOLD'));
  }
  renderItems(); renderItemDetail(iSel);
}

/* ================= 键盘 ================= */
addEventListener('keydown', e => {
  const inp = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (e.key === 'Escape') { if (inp) e.target.blur(); else if (view !== 'lobby') navigate('lobby'); return; }
  if (inp) return;
  const k = e.key.toLowerCase();
  if (k === 'm') { muted = !muted; toast(muted ? '音效已关闭' : '音效已开启'); }
  else if (k === '/' && view !== 'lobby') { e.preventDefault(); const sb = { ops: '#oSearch', depot: '#iSearch', squad: '#sqSearch', voice: '#vcSearch' }[view]; if (sb) $(sb).focus(); }
  else if (view === 'lobby' && !navBusy) {
    if (e.key === 'ArrowRight') nextOp(1); else if (e.key === 'ArrowLeft') nextOp(-1);
    else if (k === 'e' && OPS[cur].e0) $('#eliteBtn').click();
    else if (k === 'v') navigate('voice'); else if (k === 't') navigate('task'); else if (k === 'q') navigate('squad');
  }
});

AK.nav = navigate; AK.setTone = setTone; AK.art = art; AK.showOp = showOp; AK.curIdx = () => cur; AK.curOp = () => OPS[cur];
AK.view = () => view; AK.isNavBusy = () => navBusy; AK.stageEl = stage; AK.RM = RM; AK.dur = dur; AK.EASE = EASE;
AK.sub('san', () => { if (view === 'lobby') $('#san').textContent = AK.san(); });
AK.sub('inv', () => { if (view === 'depot') renderItems(); });

/* ================= 拖入图片临时替换立绘 ================= */
let dc = 0;
const isFileDrag = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
addEventListener('dragenter', e => { if (!isFileDrag(e)) return; e.preventDefault(); dc++; $('#drop').classList.add('on'); });
addEventListener('dragleave', e => { if (!isFileDrag(e)) return; dc--; if (dc <= 0) { dc = 0; $('#drop').classList.remove('on'); } });
addEventListener('dragover', e => { if (isFileDrag(e)) e.preventDefault(); });
addEventListener('drop', e => {
  if (!isFileDrag(e)) return;
  e.preventDefault(); dc = 0; $('#drop').classList.remove('on');
  const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/')); if (!f) return;
  const img = slots[front].querySelector('img'); if (img) { img.src = URL.createObjectURL(f); toast('立绘已临时替换(刷新恢复)'); }
});

/* ================= 启动 / 真实加载进度 ================= */
(async function boot() {
  const lb = $('#lbar'), lp = $('#lp'), ls = $('#ls');
  if (!OPS.length) { ls.textContent = '未找到 data/operators.js,请先运行资源脚本。'; return; }
  const saved = localStorage.getItem('ak.op');
  let start = OPS.findIndex(o => o.id === saved); if (start < 0) start = Math.max(0, OPS.findIndex(o => o.id === 'char_002_amiya'));
  const targets = [start, (start + 1) % OPS.length, (start - 1 + OPS.length) % OPS.length].map(i => art(OPS[i], false));
  let done = 0; const t0 = performance.now();
  const upd = () => { const p = Math.round(done / targets.length * 100); lb.style.width = p + '%'; lp.textContent = p + '%'; };
  await Promise.all(targets.map(async src => { ls.textContent = 'LOADING ' + src.split('/').pop(); await loadImg(src); done++; upd(); }));
  if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, sleep(1200)]);
  await sleep(Math.max(0, 700 - (performance.now() - t0)));
  $('#loader').classList.add('done');
  cur = start;
  await showOp(start, { first: true });
  lobbyIntro(900);
  setTimeout(() => { $('#hint').style.opacity = .35; }, 9000);
})();
})();
