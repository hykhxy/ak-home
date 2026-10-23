/* sortie.js — 出击:选关 → 编队预览 → 模拟作战 → 结算。消耗理智、掉落物资、驱动任务事件、触发"行动出发 / 部署 / 作战中 / 结束行动"语音 */
(() => {
'use strict';
const AK = window.AK, $ = s => document.querySelector(s), esc = AK.esc, st = AK.st, MIS = AK.MIS;
st.cleared = st.cleared || {};
const rnd = (a, b) => a + Math.random() * (b - a), rint = (a, b) => Math.floor(rnd(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];

/* ---------- 关卡表(取自任务数据里出现的关卡名) ---------- */
const SR = /通关(?:主线|标准实战环境)?([A-Za-z]*\d*-\d+)/, seen = new Set(), names = [], mainSet = new Set();
MIS.main.concat(MIS.sub).forEach(m => {
  if (/任意/.test(m.d)) return; const x = SR.exec(m.d); if (!x) return;
  if (!seen.has(x[1])) { seen.add(x[1]); names.push(x[1]); }
});
MIS.main.forEach(m => { const x = SR.exec(m.d); if (x && !/任意/.test(m.d)) mainSet.add(x[1]); });
const parse = n => { const m = /^([A-Za-z]*)(\d*)-(\d+)$/.exec(n); return { L: m[1], c: m[2] === '' ? 0 : +m[2], i: +m[3] }; };
const key = n => { const p = parse(n); return p.L === 'TR' ? [0, 0, p.i, ''] : p.L === '' ? [1, p.c, p.i, ''] : [2, p.c, p.i, p.L]; };
names.sort((a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 4; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; });
const COST = [6, 6, 9, 10, 12, 15, 15, 18, 18, 21];
const STAGES = [];
names.forEach((n, idx) => {
  const p = parse(n), main = mainSet.has(n) && p.L !== 'TR';
  const grp = p.L === 'TR' ? '教学关卡' : p.L === '' ? (p.c === 0 ? '序章' : `第 ${p.c} 章`) : p.L === 'S' ? `支线 · 第 ${p.c} 章` : '特殊关卡';
  STAGES.push({ id: n, grp, main, boss: main, cost: p.L === 'TR' ? 0 : p.L === '' ? COST[Math.min(p.c, 9)] : 15 + Math.min(p.c, 8), rec: 2200 + idx * 240, kill: [40 + idx * 3, 90 + idx * 3], cat: main ? 'main' : 'other' });
});
STAGES.unshift({ id: 'R-07', grp: '静默回廊', main: false, boss: true, cost: 12, rec: 3600, kill: [80, 150], cat: 'other', title: '静默回廊' });
STAGES.push({ id: 'EXT-1', grp: '剿灭作战', main: false, boss: false, cost: 25, rec: 9000, kill: [280, 470], cat: 'other', title: '切尔诺伯格 · 剿灭' });
const stageBy = new Map(STAGES.map(s => [s.id, s]));
AK.STAGES = STAGES;

/* ---------- 掉落池 ---------- */
const MATS = AK.ITEMS.filter(i => i.t === 'MATERIAL' && /^3\d{3}$/.test(i.id));
const EXPS = ['2001', '2002', '2003', '2004'].map(AK.item).filter(Boolean);
function drops(s, stars) {
  const r = []; const f = stars === 3 ? 1.15 : .9;
  if (s.cost > 0) {
    r.push(['GOLD', '4001', Math.round(s.cost * rnd(55, 70) * f / 10) * 10]);
    const ex = EXPS[Math.min(EXPS.length - 1, Math.floor(s.cost / 9))]; if (ex) r.push(['CARD_EXP', ex.id, rint(1, 2 + Math.floor(s.cost / 10))]);
    const tier = Math.min(4, 1 + Math.floor(s.cost / 7)), pool = MATS.filter(i => i.r <= tier && i.r >= Math.max(1, tier - 2));
    if (pool.length) for (let k = rint(1, 2); k > 0; k--) { const it = pick(pool); r.push(['MATERIAL', it.id, rint(1, 2)]); }
    if (stars === 3 && Math.random() < .35 && AK.item('4001')) r.push(['MATERIAL', pick(MATS).id, 1]);
  } else r.push(['GOLD', '4001', 120]);
  return r;
}

/* ---------- 弹窗 DOM ---------- */
const stageEl = AK.stageEl || $('#stage');
const root = document.createElement('div'); root.id = 'sortie';
root.innerHTML = `<div class="so-bd"></div><div class="so-box">
  <div class="so-h"><b>作战</b><small>OPERATION</small><span class="so-san">理智 <em id="soSan">0</em> / 135</span><button class="so-x" id="soX">×</button></div>
  <div class="so-body"><div class="so-left"><div class="frow" id="soCats"></div><div class="so-list" id="soList"></div></div><div class="so-right" id="soRight"></div></div></div>`;
document.getElementById('stage').appendChild(root);
let sel = STAGES.find(s => s.id === st.stage) || STAGES[0], cat = 'all', running = false, assist = false, built = false;

const power = () => AK.teamPower ? AK.teamPower() : 0;
const members = () => (AK.team ? AK.team() : []);
const stars3 = n => '★'.repeat(n) + '☆'.repeat(3 - n);

function buildCats() {
  const h = $('#soCats'); h.innerHTML = '';
  AK.chipRow(h, [['all', '全部'], ['main', '主线'], ['other', '其他']], v => { cat = v; renderList(true); }, cat);
}
function renderList(keep) {
  const l = STAGES.filter(s => cat === 'all' || s.cat === cat), box = $('#soList');
  let last = '';
  box.innerHTML = l.map(s => {
    const g = s.grp !== last ? `<div class="so-g">${esc(s.grp)}</div>` : ''; last = s.grp; const c = st.cleared[s.id] || 0;
    return `${g}<div class="so-st${s === sel ? ' on' : ''}" data-id="${s.id}"><b>${s.id}</b><span>${esc(s.title || '')}</span><i class="cl">${c ? stars3(c) : ''}</i><em>⚡${s.cost}</em></div>`;
  }).join('');
  const on = box.querySelector('.on'); if (on && !keep) on.scrollIntoView({ block: 'center' });
}
function renderRight() {
  const s = sel, m = members(), pw = power(), cost = s.cost, san = AK.san();
  const ok = san >= cost && m.length > 0, ratio = pw / s.rec;
  $('#soSan').textContent = san;
  $('#soRight').innerHTML = `
    <div class="so-t"><b>${s.id}</b><span>${esc(s.title || s.grp)}</span>${s.main ? '<i class="tg2">主线</i>' : ''}${st.cleared[s.id] ? `<i class="cl">${stars3(st.cleared[s.id])}</i>` : ''}</div>
    <div class="so-m">
      <div><small>消耗理智</small><b class="${san >= cost ? '' : 'bad'}">${cost}</b></div>
      <div><small>推荐战力</small><b>${s.rec.toLocaleString()}</b></div>
      <div><small>当前战力</small><b class="${ratio >= 1 ? 'good' : ratio >= .65 ? '' : 'bad'}">${pw.toLocaleString()}</b></div>
      <div><small>预计歼灭</small><b>${s.kill[0]}–${s.kill[1]}</b></div></div>
    <div class="so-tm"><div class="sh2"><b>${esc(st.squads[st.team].name)}</b><button class="btn alt" id="soEdit">编队 ▸</button></div>
      <div class="so-av">${st.squads[st.team].ids.map((id, i) => id ? `<img src="${AK.avatar(id)}" alt="" title="${esc(AK.op(id).n)}" class="${i === 0 ? 'ld' : ''}">` : '<span></span>').join('')}</div></div>
    <label class="so-as"><input type="checkbox" id="soAs" ${assist ? 'checked' : ''}> 使用好友助战 <small>(完成「好友助战」类任务)</small></label>
    <div class="so-d"><small>可能掉落</small><span>龙门币 · 作战记录 · ${s.cost >= 15 ? '中阶' : '基础'}养成材料</span></div>
    <div class="so-go"><button class="btn go big" id="soStart" ${ok ? '' : 'disabled'}>${m.length === 0 ? '编队为空' : san < cost ? '理智不足' : '开始行动'}</button></div>`;
  $('#soEdit').addEventListener('click', () => { close(true); AK.nav('squad'); });
  $('#soAs').addEventListener('change', e => { assist = e.target.checked; });
  $('#soStart').addEventListener('click', start);
}
function open(o) {
  o = o && typeof o === 'object' && !(o instanceof Event) ? o : {};
  if (running) return;
  if (!built) { built = true; buildCats(); $('#soX').addEventListener('click', () => close()); root.querySelector('.so-bd').addEventListener('click', () => close());
    $('#soList').addEventListener('click', e => { const r = e.target.closest('.so-st'); if (!r || running) return; sel = stageBy.get(r.dataset.id); st.stage = sel.id; AK.save(); AK.emit('stage'); renderList(true); renderRight(); }); }
  if (o.stage && stageBy.has(o.stage)) { sel = stageBy.get(o.stage); if (cat !== 'all' && sel.cat !== cat) { cat = 'all'; buildCats(); } }
  if (o.assist) assist = true;
  root.classList.add('on'); renderList(); renderRight();
}
function close(force) { if (running && !force) return; root.classList.remove('on'); }
AK.act = AK.act || {}; AK.act.sortie = open;
addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('on')) { e.stopImmediatePropagation(); e.preventDefault(); close(); } }, true);
AK.sub('san', () => { if (root.classList.contains('on') && !running) renderRight(); });
AK.sub('team', () => { if (root.classList.contains('on') && !running) renderRight(); });
AK.sub('stage', () => { const sp = document.querySelector('#op .cur2 span'); if (sp) sp.innerHTML = `${esc(sel.id)} &nbsp;${esc(sel.title || sel.grp)}`; });
setTimeout(() => AK.emit('stage'), 0);

/* ---------- 模拟作战 ---------- */
const sleep = AK.sleep;
async function start() {
  const s = sel, team = members(); if (running || !team.length) return;
  if (!AK.spendSan(s.cost)) { AK.toast('理智不足'); return; }
  running = true; const cost = s.cost;
  const leader = team[0], other = () => pick(team);
  const ratio = power() / s.rec;
  const win = Math.random() < Math.min(.98, Math.max(.2, .3 + ratio * .6));
  const stars = !win ? 0 : Math.random() < Math.min(.95, Math.max(.1, (ratio - .7) * 1.4 + .3)) ? 3 : rint(1, 2);
  const kills = win ? rint(s.kill[0], s.kill[1]) : rint(Math.floor(s.kill[0] * .2), Math.floor(s.kill[0] * .7));
  const R = $('#soRight'), T = AK.dur(5600);
  R.innerHTML = `<div class="so-t"><b>${s.id}</b><span>行动中…</span></div>
    <div class="so-run"><div class="rn-k"><small>歼灭</small><b id="rnK">0</b></div><div class="rn-bar"><i id="rnB"></i></div>
    <div class="rn-t"><span id="rnT">DEPLOYING</span><span id="rnP">0%</span></div><div class="rn-log" id="rnL"></div></div>`;
  const log = t => { const d = document.createElement('div'); d.textContent = t; $('#rnL').prepend(d); };
  const say = (o, title) => { const l = AK.line(o.id, title); if (l) AK.say(o.id, l); };
  log(`[${AK.p2(new Date().getHours())}:${AK.p2(new Date().getMinutes())}] 编队 ${esc(st.squads[st.team].name)} 出发,队长 ${leader.n}`);
  say(leader, '行动出发');
  const marks = [[.12, '行动开始', '部队抵达战区'], [.3, '部署', '干员部署完毕'], [.55, '作战中', '遭遇敌方精锐'], [.78, '选中干员', '战况胶着,调整阵型']];
  let mi = 0; const t0 = performance.now();
  await new Promise(res => {
    const tk = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / T);
      $('#rnB').style.width = p * 100 + '%'; $('#rnP').textContent = Math.round(p * 100) + '%';
      $('#rnK').textContent = Math.round(kills * (win ? p : Math.min(p, .8)) * (1 - Math.pow(1 - p, 3) * .15));
      $('#rnT').textContent = p < .3 ? 'DEPLOYING' : p < .8 ? 'ENGAGED' : 'CLEARING';
      while (mi < marks.length && p >= marks[mi][0]) { const [, title, txt] = marks[mi++]; log(txt); say(other(), title); }
      if (!win && p > .72) { clearInterval(tk); res(); }
      if (p >= 1) { clearInterval(tk); res(); }
    }, 60);
  });
  // ---- 结算 ----
  let rewards = [];
  if (win) {
    rewards = drops(s, stars);
    if (!st.cleared[s.id] || st.cleared[s.id] < stars) st.cleared[s.id] = stars;
  } else { st.san = { v: Math.min(AK.SAN_MAX, AK.san() + cost), t: Date.now() }; AK.emit('san'); }
  st.stats.sorties++; st.stats.kills += kills; AK.save();
  if (win) {
    AK.event('stage', 1); AK.event('stage:' + s.id, 1); if (s.boss) AK.event('boss', 1);
    if (assist) AK.event('assist', 1);
  }
  AK.event('kill', kills); AK.event('maxkill', kills);
  const rows = AK.grant(rewards, '', true);
  say(leader, !win ? '行动失败' : stars === 3 ? '3星结束行动' : '非3星结束行动');
  R.innerHTML = `<div class="so-t"><b>${s.id}</b><span>${win ? '行动结束' : '行动失败'}</span></div>
    <div class="so-res ${win ? 'win' : 'lose'}"><div class="rs-st">${win ? [1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}" style="--k:${i}">★</i>`).join('') : '<b>MISSION FAILED</b>'}</div>
      <div class="so-m"><div><small>歼灭敌人</small><b>${kills}</b></div><div><small>评价</small><b>${win ? (stars === 3 ? '3 星 · 完美' : stars + ' 星') : '败北'}</b></div><div><small>${win ? '消耗理智' : '理智返还'}</small><b>${win ? cost : '+' + cost}</b></div><div><small>剩余理智</small><b>${AK.san()}</b></div></div>
      ${rows.length ? `<div class="so-rw">${rows.map(([it, c], i) => `<div class="rw-i" style="--rc:${AK.RC[Math.min(it.r, 5)]};--i:${i}"><img src="assets/item/${it.i}.png" alt=""><b>×${c.toLocaleString()}</b><span>${esc(it.n)}</span></div>`).join('')}</div>` : '<div class="so-rw none">未获得物资</div>'}
      <div class="so-go"><button class="btn alt" id="soBack">返回</button><button class="btn go" id="soAgain">再次出击</button></div></div>`;
  running = false;
  $('#soBack').addEventListener('click', () => { close(); });
  $('#soAgain').addEventListener('click', () => renderRight());
  AK.beep && (win ? AK.beep(700, 1500, .25, 'triangle', .06) : AK.beep(300, 120, .3, 'sawtooth', .05));
}
})();
