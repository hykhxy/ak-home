/* gacha.js — 干员寻访(模拟抽卡,纯本地演示,不涉及真实账号/充值)
   卡池:标准 / 轮换壹 / 轮换贰(UP 干员按"周"确定性选取) · 保底 · 十连保底 4★ · 逐张翻牌动画 · 记录 · 每日补给 */
(() => {
'use strict';
const AK = window.AK; if (!AK) return;
const $ = s => document.querySelector(s);
const OPS = AK.OPS, st = AK.st, RC = AK.RC, esc = AK.esc;
const pool_ = r => OPS.filter(o => o.r === r && /招募寻访/.test(o.ob || ''));
const L6 = pool_(5), L5 = pool_(4), L4 = pool_(3), L3 = pool_(2);
if (!L6.length) return;

/* ---------- 确定性随机(同一周内 UP 不变) ---------- */
const mulberry = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const seedPick = (arr, n, key, ban = []) => {
  const r = mulberry(AK.hash(key)), a = arr.filter(o => !ban.includes(o));
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
const WK = Math.floor(Date.now() / (7 * 864e5));
const r1u6 = seedPick(L6, 2, 'r1-6-' + WK), r1u5 = seedPick(L5, 3, 'r1-5-' + WK);
const POOLS = [
  { id: 'std', n: '标准寻访', en: 'STANDARD HEADHUNTING', up6: [], up5: [], show: seedPick(L6, 3, 'show-' + WK), d: '常驻寻访 · 全部「招募寻访」干员出率均等,无概率提升。' },
  { id: 'r1', n: '轮换寻访 · 壹', en: 'ROTATION I', up6: r1u6, up5: r1u5, d: '本周轮换 · 两名六星干员共享 70% 的六星出率,三名五星干员共享 50% 的五星出率。' },
  { id: 'r2', n: '轮换寻访 · 贰', en: 'ROTATION II', up6: seedPick(L6, 1, 'r2-6-' + WK, r1u6), up5: seedPick(L5, 2, 'r2-5-' + WK, r1u5), d: '本周轮换 · 一名六星干员占 70% 的六星出率,两名五星干员共享 50% 的五星出率。' },
];
const UP6 = .7, UP5 = .5, BASE = [.02, .08, .5, .4];
const PITY_AT = 50, COST1 = 600, COST10 = 6000;

/* ---------- 存档 ---------- */
const G = st.gacha = Object.assign({ pity: {}, rec: [], own: {}, tot: 0, s6: 0, s5: 0, sup: '', pool: 'r1' }, st.gacha || {});
const poolOf = id => POOLS.find(p => p.id === id) || POOLS[1];
let cur = poolOf(G.pool), busy = false;
const pityOf = p => G.pity[p.id] || 0;
const p6Now = pity => pity >= PITY_AT ? Math.min(1, BASE[0] + (pity - PITY_AT + 1) * .02) : BASE[0];

/* ---------- 抽取 ---------- */
function rollRarity(pity) {
  const p6 = p6Now(pity), k = (1 - p6) / (1 - BASE[0]), x = Math.random();
  if (x < p6) return 5;
  if (x < p6 + BASE[1] * k) return 4;
  if (x < p6 + (BASE[1] + BASE[2]) * k) return 3;
  return 2;
}
function pickOp(pool, r) {
  const list = r === 5 ? L6 : r === 4 ? L5 : r === 3 ? L4 : L3;
  const up = r === 5 ? pool.up6 : r === 4 ? pool.up5 : [];
  if (up.length && Math.random() < (r === 5 ? UP6 : UP5)) return { op: up[Math.floor(Math.random() * up.length)], up: true };
  const rest = up.length ? list.filter(o => !up.includes(o)) : list;
  return { op: rest[Math.floor(Math.random() * rest.length)], up: false };
}
function doPull(pool, n) {
  const out = []; let pity = pityOf(pool);
  for (let i = 0; i < n; i++) {
    let r = rollRarity(pity);
    if (n === 10 && i === 9 && !out.some(x => x.r >= 3) && r < 3) r = 3; // 十连保底:至少 1 个四星以上
    pity = r === 5 ? 0 : pity + 1;
    const { op, up } = pickOp(pool, r);
    const had = G.own[op.id] || 0;
    const pot = had ? Math.min(6, had + 1) : 1;
    G.own[op.id] = pot;
    out.push({ op, r, up, isNew: !had, pot, dup: !!had });
    G.rec.unshift({ t: Date.now(), p: pool.id, id: op.id, r, up });
    G.tot++; if (r === 5) G.s6++; if (r === 4) G.s5++;
  }
  G.pity[pool.id] = pity; G.rec.length = Math.min(G.rec.length, 200);
  AK.save(); return out;
}

/* ---------- 货币 ---------- */
const IT = { t1: AK.item('7003'), t10: AK.item('7004'), gem: AK.item('4003'), ore: AK.item('4002'), gold: AK.item('4001') };
const q = it => it ? AK.qty(it) : 0;
function payPlan(n) {
  const tk = n === 1 ? IT.t1 : IT.t10, need = n === 1 ? COST1 : COST10;
  if (q(tk) >= 1) return { ok: true, tk, label: `消耗 ${tk.n} ×1` + `(持有 ${q(tk)})` };
  return { ok: q(IT.gem) >= need, gem: need, label: `消耗 合成玉 ×${need.toLocaleString()}` + (q(IT.gem) >= need ? '' : '(不足)') };
}
function pay(plan) { if (plan.tk) AK.addItem(plan.tk.id, -1); else AK.addItem(IT.gem.id, -plan.gem); }

/* ---------- 界面 ---------- */
const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const star = r => '★'.repeat(r + 1);
function renderCur() {
  const cell = (it, label) => it ? `<span class="gc-c"><img src="assets/item/${it.i}.png" alt=""><b>${q(it).toLocaleString()}</b><i>${label}</i></span>` : '';
  $('#gcCur').innerHTML = cell(IT.t1, '寻访凭证') + cell(IT.t10, '十连凭证') + cell(IT.gem, '合成玉');
  const a = payPlan(1), b = payPlan(10);
  $('#gcC1').textContent = a.label; $('#gcC10').textContent = b.label;
  $('#gcP1').classList.toggle('off', !a.ok); $('#gcP10').classList.toggle('off', !b.ok);
  const dk = (AK.st.mission && AK.st.mission.dk) || '';
  const d = $('#gcDaily'); d.textContent = G.sup === dk ? '补给已领取' : '每日补给'; d.classList.toggle('off', G.sup === dk);
}
function renderTabs() {
  $('#gcTabs').innerHTML = POOLS.map(p => {
    const lead = (p.up6[0] || p.show[0]), pit = pityOf(p);
    return `<button class="gc-tab${p === cur ? ' on' : ''}" data-p="${p.id}"><img src="${AK.avatar(lead.id)}" alt=""><span><b>${esc(p.n)}</b><em>${p.up6.length ? '六星 UP · ' + p.up6.map(o => esc(o.n)).join(' / ') : '常驻 · 无 UP'}</em></span><i>${pit}</i></button>`;
  }).join('');
}
function renderBanner() {
  const p = cur, arts = p.up6.length ? p.up6 : p.show, c = hex2rgb(arts[0].c || '#18d1ff');
  const bn = $('#gcBanner'); bn.style.setProperty('--gr', c.join(','));
  const pos = arts.length === 1 ? [[730, 1]] : arts.length === 2 ? [[580, .9], [900, 1]] : [[480, .78], [760, 1], [1040, .78]];
  bn.innerHTML = `<div class="gc-sky"></div><div class="gc-ring"></div>
    ${arts.map((o, i) => `<img class="gc-art" style="--x:${pos[i][0]}px;--k:${pos[i][1]};--i:${i}" src="${AK.art(o)}" alt="${esc(o.n)}" draggable="false">`).join('')}
    <div class="gc-ttl"><em>${esc(p.en)}</em><b>${esc(p.n)}</b><p>${esc(p.d)}</p></div>
    <div class="gc-ups">${p.up6.length || p.up5.length ? `${p.up6.map(o => `<span class="u6"><i>★6 UP</i>${esc(o.n)}</span>`).join('')}${p.up5.map(o => `<span class="u5"><i>★5 UP</i>${esc(o.n)}</span>`).join('')}` : `<span class="u0"><i>常驻</i>${p.show.map(o => esc(o.n)).join(' · ')} 等</span>`}</div>`;
}
function renderInfo() {
  const p = cur, pit = pityOf(p), p6 = p6Now(pit + 0) , nxt = pit >= PITY_AT ? p6Now(pit) : BASE[0];
  const pct = Math.min(100, pit / PITY_AT * 100);
  $('#gcInfo').innerHTML = `<div class="gc-hd">保底进度 <small>PITY</small></div>
    <div class="gc-pity"><div class="gc-pbar"><i style="width:${pct}%"></i><s style="left:100%"></s></div><div class="gc-pt"><b>${pit}</b><span>/ ${PITY_AT} 抽未出六星</span></div></div>
    <p class="gc-pp">当前六星基础概率 <b>${(nxt * 100).toFixed(0)}%</b>${pit >= PITY_AT ? ' · <em>已进入概率提升</em>' : ` · 再 ${PITY_AT - pit} 抽后每抽 +2%`}</p>
    <div class="gc-rates">${[5, 4, 3, 2].map((r, i) => `<div style="--rc:${RC[r]}"><b>${star(r)}</b><span>${(BASE[i] * 100).toFixed(0)}%</span></div>`).join('')}</div>
    <div class="gc-hd">累计 <small>STATS</small></div>
    <div class="gc-stat"><div><small>总寻访</small><b>${G.tot}</b></div><div style="--rc:${RC[5]}"><small>六星</small><b>${G.s6}</b></div><div style="--rc:${RC[4]}"><small>五星</small><b>${G.s5}</b></div><div><small>已拥有干员</small><b>${Object.keys(G.own).length}</b></div></div>`;
}
function renderAll() { renderCur(); renderTabs(); renderBanner(); renderInfo(); AK.setTone && AK.setTone((cur.up6[0] || cur.show[0]).c || '#18d1ff'); }

function selectPool(id) {
  if (busy) return; const p = poolOf(id); if (p === cur && $('#gcBanner').innerHTML) return;
  cur = p; G.pool = id; AK.save(); renderAll();
  if (!AK.RM) $('#gcBanner').animate([{ opacity: .2, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: AK.EASE });
}
$('#gcTabs').addEventListener('click', e => { const b = e.target.closest('.gc-tab'); if (b) selectPool(b.dataset.p); });

/* ---------- 弹窗(记录 / 概率) ---------- */
const modal = $('#gcModal');
function openModal(html) { modal.innerHTML = `<div class="gc-mb"><button class="gc-mx" aria-label="关闭">✕</button>${html}</div>`; modal.classList.add('on'); }
modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.gc-mx')) modal.classList.remove('on'); });
$('#gcRec').addEventListener('click', () => {
  const rows = G.rec.map(r => { const o = AK.op(r.id); if (!o) return ''; const p = poolOf(r.p), d = new Date(r.t); return `<div class="gc-row" style="--rc:${RC[r.r]}"><i>${star(r.r)}</i><b>${esc(o.n)}${r.up ? '<u>UP</u>' : ''}</b><span>${esc(p.n)}</span><small>${AK.p2(d.getMonth() + 1)}/${AK.p2(d.getDate())} ${AK.p2(d.getHours())}:${AK.p2(d.getMinutes())}</small></div>`; }).join('');
  openModal(`<div class="gc-mh">寻访记录 <small>最近 ${G.rec.length} 条 · 总 ${G.tot} 抽</small></div><div class="gc-list">${rows || '<div class="gc-none">还没有寻访记录</div>'}</div>`);
});
$('#gcRate').addEventListener('click', () => {
  const lst = (a, c) => a.length ? a.map(o => `<span style="color:${c}">${esc(o.n)}</span>`).join('、') : '—';
  openModal(`<div class="gc-mh">概率说明 <small>RATES</small></div><div class="gc-tx">
    <p><b>基础概率</b>:★6 ${BASE[0] * 100}% · ★5 ${BASE[1] * 100}% · ★4 ${BASE[2] * 100}% · ★3 ${BASE[3] * 100}%。</p>
    <p><b>六星保底</b>:连续 ${PITY_AT} 抽未出六星后,第 ${PITY_AT + 1} 抽起六星概率每抽 +2%,直至必出;保底计数每个卡池独立,出六星后清零。</p>
    <p><b>十连保底</b>:十次寻访至少包含 1 名四星及以上干员。</p>
    <p><b>UP</b>:出六星时有 ${UP6 * 100}% 为本池 UP 六星;出五星时有 ${UP5 * 100}% 为本池 UP 五星。</p>
    <p><b>重复干员</b>:再次获得已拥有的干员,潜能 +1(最高 6)。</p>
    <p><b>卡池 ${esc(cur.n)}</b><br>六星 UP:${lst(cur.up6, RC[5])}<br>五星 UP:${lst(cur.up5, RC[4])}</p>
    <p class="n">本页为学习用的模拟抽卡:数据只保存在本机浏览器,与真实游戏账号无关,不涉及任何付费。奖池范围取自「获得方式含招募寻访」的干员(★6 ${L6.length} · ★5 ${L5.length} · ★4 ${L4.length} · ★3 ${L3.length})。</p></div>`);
});
$('#gcDaily').addEventListener('click', () => {
  AK.rollover(); const dk = AK.st.mission.dk;
  if (G.sup === dk) { AK.toast('今日补给已领取'); return; }
  G.sup = dk; AK.save();
  AK.grant([['', IT.gem.id, 6000], ['', IT.t1.id, 2], ['', IT.t10.id, 1]], '每日补给'); renderCur();
});

/* ---------- 结果动画 ---------- */
const res = $('#gcRes');
function playResult(list, n) {
  busy = true;
  const top = Math.max(...list.map(x => x.r)), tc = RC[top];
  res.style.setProperty('--tc', tc); res.style.setProperty('--tcrgb', hex2rgb(tc).join(','));
  res.className = 'on r' + top + (n === 1 ? ' one' : '');
  res.innerHTML = `<div class="gr-bg"></div><div class="gr-line"></div><div class="gr-hd"><b>${top >= 5 ? '六星干员' : top === 4 ? '五星干员' : '寻访结果'}</b><small>HEADHUNTING · ${esc(cur.n)}</small></div>
    <div class="gr-cards">${list.map((x, i) => {
      const o = x.op, src = n === 1 ? AK.art(o) : AK.portrait(o.id);
      return `<div class="gr-card r${x.r}" style="--rc:${RC[x.r]};--i:${i}"><div class="gr-beam"></div><div class="gr-in"><img src="${src}" alt="" draggable="false"><div class="gr-st">${star(x.r)}</div><div class="gr-nm"><b>${esc(o.n)}</b><span>${esc(AK.PROF[o.p] || o.p)}${x.up ? ' · UP' : ''}</span></div><div class="gr-tag${x.isNew ? ' new' : ''}">${x.isNew ? 'NEW' : '潜能 ' + x.pot}</div></div></div>`;
    }).join('')}</div>
    <div class="gr-foot"><button class="btn go big" id="grOk">确认</button></div><div class="gr-skip">点击任意处跳过动画</div>`;
  const cards = [...res.querySelectorAll('.gr-card')]; let k = 0, timer = 0, done = false;
  const reveal = i => {
    const c = cards[i]; if (!c || c.classList.contains('show')) return; c.classList.add('show');
    const r = list[i].r; AK.beep && (r >= 5 ? AK.beep(500, 1800, .5, 'sawtooth', .06) : r === 4 ? AK.beep(600, 1300, .3, 'triangle', .05) : AK.beep(800 + r * 100, 900 + r * 120, .08, 'square', .03));
  };
  const finish = () => { if (done) return; done = true; clearInterval(timer); cards.forEach((_, i) => reveal(i)); res.classList.add('fin'); };
  const startCards = () => {
    const gap = n === 1 ? 0 : (top >= 5 ? 190 : 140);
    reveal(0); k = 1;
    if (n === 1) { setTimeout(finish, 700); return; }
    timer = setInterval(() => { if (k >= cards.length) { setTimeout(finish, 500); clearInterval(timer); return; } reveal(k++); }, gap);
  };
  AK.beep && AK.beep(200, 900, .6, 'sawtooth', .05);
  const wait = AK.RM ? 10 : (top >= 5 ? 1500 : top === 4 ? 1100 : 800);
  const t0 = setTimeout(startCards, wait);
  res.onclick = e => {
    if (e.target.closest('#grOk')) { close(); return; }
    clearTimeout(t0); if (!done) { cards.forEach((_, i) => reveal(i)); finish(); }
  };
  function close() { res.className = ''; res.innerHTML = ''; res.onclick = null; busy = false; renderAll(); }
}

function pull(n) {
  if (busy) return;
  const plan = payPlan(n);
  if (!plan.ok) { AK.toast('合成玉不足 · 可点「每日补给」领取'); return; }
  pay(plan);
  const list = doPull(cur, n);
  AK.emit && AK.emit('gacha', list);
  playResult(list, n);
}
$('#gcP1').addEventListener('click', () => pull(1));
$('#gcP10').addEventListener('click', () => pull(10));
AK.sub('inv', () => { if (AK.view() === 'gacha') renderCur(); });

/* 背景图:加载成功后再淡入(没有图时保持原来的渐变背景) */
{ const im = new Image(); im.onload = () => { const b = document.getElementById('bgimg'); if (b) b.classList.add('on'); }; im.src = 'assets/bg/city.jpg'; }

AK.enter.gacha = () => { AK.rollover(); busy = false; res.className = ''; res.innerHTML = ''; modal.classList.remove('on'); renderAll(); };
})();
