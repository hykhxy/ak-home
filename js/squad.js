/* squad.js — 编队:4 队 × 12 格,点击 / 拖拽编入,职业·稀有度·搜索筛选,队伍统计,队长与编入语音 */
(() => {
'use strict';
const AK = window.AK, $ = s => document.querySelector(s), esc = AK.esc;
const st = AK.st, OPS = AK.OPS, PROF = AK.PROF;
const F = { p: 'ALL', r: -1, q: '' };
let sel = 0, inited = false;

const cur = () => st.squads[st.team];
const members = () => cur().ids.map(id => id && AK.op(id)).filter(Boolean);
AK.team = members;
AK.leader = () => { const m = cur().ids.find(Boolean); return m ? AK.op(m) : null; };
AK.teamPower = () => Math.round(members().reduce((s, o) => s + (o.st.hp || 0) * .08 + (o.st.atk || 0) * .9 + (o.st.def || 0) * 1.2 + o.r * 60, 0));

/* ---------- 台词 ---------- */
function speak(opId, title) { const l = AK.line(opId, title); if (l) AK.say(opId, l); }

/* ---------- 编队操作 ---------- */
function place(opId, slot) {
  const ids = cur().ids, from = ids.indexOf(opId);
  if (from >= 0) { [ids[from], ids[slot]] = [ids[slot], ids[from]]; }
  else ids[slot] = opId;
  AK.save(); AK.emit('team');
}
function add(opId) {
  const ids = cur().ids;
  if (ids.includes(opId)) { remove(ids.indexOf(opId)); return; }
  let slot = ids[sel] ? ids.findIndex(x => !x) : sel;
  if (slot < 0) { AK.toast('队伍已满(12 / 12),先移出一名干员'); return; }
  place(opId, slot);
  speak(opId, slot === 0 ? '任命队长' : '编入队伍');
  const nx = ids.findIndex(x => !x); sel = nx < 0 ? slot : nx;
  renderAll(slot);
}
function remove(i) { cur().ids[i] = null; sel = i; AK.save(); AK.emit('team'); renderAll(); }
function leader(i) {
  const ids = cur().ids; if (!ids[i] || i === 0) return;
  [ids[0], ids[i]] = [ids[i], ids[0]]; AK.save(); AK.emit('team'); renderAll(0);
  speak(ids[0], '任命队长');
}
function autoFill() {
  const used = new Set(), out = [];
  const pool = OPS.slice().sort((a, b) => b.r - a.r || (b.st.atk + b.st.hp / 6) - (a.st.atk + a.st.hp / 6));
  const take = o => { if (o && !used.has(o.id) && out.length < 12) { used.add(o.id); out.push(o.id); } };
  take(OPS.find(o => o.id === 'char_002_amiya'));
  for (const p of Object.keys(PROF)) take(pool.find(o => o.p === p && !used.has(o.id)));
  pool.forEach(take);
  while (out.length < 12) out.push(null);
  cur().ids = out; AK.save(); AK.emit('team'); sel = 0; renderAll();
  speak(out[0], '任命队长');
}

/* ---------- 渲染 ---------- */
function renderBar() {
  const h = $('#sqBar'); h.innerHTML = '';
  st.squads.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'chip' + (i === st.team ? ' on' : '');
    const n = s.ids.filter(Boolean).length;
    b.innerHTML = `${esc(s.name)} <i>${n}/12</i>`; b.title = '双击重命名';
    b.addEventListener('click', () => { st.team = i; AK.save(); sel = Math.max(0, cur().ids.findIndex(x => !x)); renderAll(); });
    b.addEventListener('dblclick', () => { const v = prompt('队伍名称', s.name); if (v && v.trim()) { s.name = v.trim().slice(0, 8); AK.save(); renderBar(); } });
    h.appendChild(b);
  });
  const sp = document.createElement('span'); sp.style.flex = 1; h.appendChild(sp);
  [['一键编队', autoFill], ['清空', () => { cur().ids = Array(12).fill(null); sel = 0; AK.save(); AK.emit('team'); renderAll(); }]].forEach(([t, f]) => {
    const b = document.createElement('button'); b.className = 'chip alt'; b.textContent = t; b.addEventListener('click', f); h.appendChild(b);
  });
}
function renderGrid(pop) {
  const g = $('#sqGrid'), ids = cur().ids;
  g.innerHTML = ids.map((id, i) => {
    const o = id && AK.op(id), no = String(i + 1).padStart(2, '0');
    if (!o) return `<div class="sqslot empty${i === sel ? ' sel' : ''}" data-i="${i}"><span class="no">${no}</span><span class="plus">+</span><span class="hint">点击右侧干员加入</span></div>`;
    return `<div class="sqslot filled${i === sel ? ' sel' : ''}${i === pop ? ' pop' : ''}" data-i="${i}" draggable="true" style="--rc:${AK.RC[o.r]}">
      <div class="pt"></div><img src="assets/portrait/${o.id}.png" onerror="this.onerror=null;this.src='assets/avatar/${o.id}.png'" alt="" draggable="false">
      <span class="no">${no}</span>${i === 0 ? '<span class="ldr">队长</span>' : '<button class="ld" data-ld title="设为队长">★ 队长</button>'}
      <button class="x" data-x title="移出">×</button><span class="st">${AK.stars(o.r)}</span>
      <div class="nm">${esc(o.n)}</div><div class="pf">${PROF[o.p] || ''} · 费用 ${o.st.cost}</div><div class="rb"></div></div>`;
  }).join('');
  $('#sqCnt').textContent = ids.filter(Boolean).length;
}
function renderStat() {
  const m = members(), box = $('#sqStat'), n = m.length || 1;
  const pc = {}; m.forEach(o => pc[o.p] = (pc[o.p] || 0) + 1);
  const sum = k => m.reduce((s, o) => s + (o.st[k] || 0), 0);
  const L = AK.leader(), lq = L && AK.line(L.id, '任命队长');
  box.innerHTML = `
    <div class="sh"><b>队伍统计</b><span>${esc(cur().name)} · 战力 <em id="sqPow">${AK.teamPower().toLocaleString()}</em></span></div>
    <div class="sbars">${Object.keys(PROF).map(p => `<div class="sb"><span>${PROF[p]}</span><div class="bar"><i style="width:${(pc[p] || 0) / 12 * 100 * 2}%"></i></div><b>${pc[p] || 0}</b></div>`).join('')}</div>
    <div class="sn">
      <div><small>平均星级</small><b>${m.length ? (m.reduce((s, o) => s + o.r + 1, 0) / n).toFixed(1) : '—'}</b></div>
      <div><small>总部署费用</small><b>${sum('cost')}</b></div>
      <div><small>平均生命</small><b>${m.length ? Math.round(sum('hp') / n) : '—'}</b></div>
      <div><small>平均攻击</small><b>${m.length ? Math.round(sum('atk') / n) : '—'}</b></div>
    </div>
    <div class="slq">${L ? `<img src="${AK.avatar(L.id)}" alt=""><div><small>队长 · ${esc(L.n)}</small><p>${esc(lq ? lq[1] : '……')}</p></div><button class="btn alt" id="sqPlay">▶ 语音</button>` : '<div class="none">队伍为空,从右侧选择干员加入</div>'}</div>`;
  const pb = $('#sqPlay'); if (pb) pb.addEventListener('click', () => lq && AK.say(L.id, lq));
}
function match(o) {
  if (F.p !== 'ALL' && o.p !== F.p) return false;
  if (F.r >= 0 && o.r !== F.r) return false;
  if (F.q) { const q = F.q.toLowerCase(); if (!(o.n.toLowerCase().includes(q) || o.e.toLowerCase().includes(q) || (o.na || '').includes(q))) return false; }
  return true;
}
let rosterList = [];
function renderRoster() {
  const box = $('#sqRoster'), ids = cur().ids;
  rosterList = OPS.filter(match).sort((a, b) => b.r - a.r || a.n.localeCompare(b.n, 'zh'));
  box.innerHTML = rosterList.map((o, k) => {
    const at = ids.indexOf(o.id);
    return `<div class="card pk${at >= 0 ? ' in' : ''}" data-id="${o.id}" draggable="true" style="--rc:${AK.RC[o.r]};--i:${Math.min(k, 30)}"><div class="pt"></div><img loading="lazy" decoding="async" src="assets/portrait/${o.id}.png" onerror="this.onerror=null;this.src='assets/avatar/${o.id}.png'" alt="" draggable="false"><span class="st">${AK.stars(o.r)}</span><span class="mk" style="display:${at >= 0 ? 'block' : 'none'}">${at >= 0 ? (at === 0 ? '队长' : String(at + 1).padStart(2, '0')) : ''}</span><div class="nm">${esc(o.n)}</div><div class="pf">${PROF[o.p] || ''}</div><div class="rb"></div></div>`;
  }).join('') || '<div class="empty">没有符合条件的干员</div>';
}
function renderAll(pop) { renderBar(); renderGrid(pop); renderStat(); renderRoster(); }

/* ---------- 事件 ---------- */
function init() {
  inited = true;
  AK.chipRow('#sqProf', [['ALL', '全部'], ...Object.entries(PROF)], v => { F.p = v; renderRoster(); }, 'ALL');
  AK.chipRow('#sqRar', [[-1, '全部星级'], [5, '★6'], [4, '★5'], [3, '★4'], [2, '★3'], [1, '★2'], [0, '★1']].map(([v, l]) => [v, l]), v => { F.r = +v; renderRoster(); }, -1);
  // chipRow 的 val 来自 dataset(字符串),初值比较用 ===,手动补默认选中
  $('#sqRar').querySelector('.chip').classList.add('on');
  $('#sqSearch').addEventListener('input', e => { F.q = e.target.value.trim(); renderRoster(); });
  $('#sqRoster').addEventListener('click', e => { const c = e.target.closest('.pk'); if (c) add(c.dataset.id); });
  $('#sqGrid').addEventListener('click', e => {
    const s = e.target.closest('.sqslot'); if (!s) return; const i = +s.dataset.i;
    if (e.target.closest('[data-x]')) { remove(i); return; }
    if (e.target.closest('[data-ld]')) { leader(i); return; }
    sel = i; renderGrid();
    const id = cur().ids[i]; if (id) speak(id, i === 0 ? '任命队长' : '编入队伍');
  });
  // 拖拽:干员→格子 / 格子→格子(交换)
  document.addEventListener('dragstart', e => {
    const s = e.target.closest && e.target.closest('.sqslot.filled'), c = e.target.closest && e.target.closest('.pk');
    if (s) e.dataTransfer.setData('text/plain', 's:' + s.dataset.i); else if (c) e.dataTransfer.setData('text/plain', 'o:' + c.dataset.id); else return;
    e.dataTransfer.effectAllowed = 'move';
  });
  const grid = $('#sqGrid');
  grid.addEventListener('dragover', e => { const s = e.target.closest('.sqslot'); if (s) { e.preventDefault(); e.stopPropagation(); document.querySelectorAll('.sqslot.over').forEach(x => x !== s && x.classList.remove('over')); s.classList.add('over'); } });
  grid.addEventListener('dragleave', e => { const s = e.target.closest('.sqslot'); if (s && !s.contains(e.relatedTarget)) s.classList.remove('over'); });
  grid.addEventListener('drop', e => {
    const s = e.target.closest('.sqslot'); if (!s) return; e.preventDefault(); e.stopPropagation();
    document.querySelectorAll('.sqslot.over').forEach(x => x.classList.remove('over'));
    const t = e.dataTransfer.getData('text/plain'), i = +s.dataset.i, ids = cur().ids;
    if (t.startsWith('s:')) { const f = +t.slice(2); if (f !== i) { [ids[f], ids[i]] = [ids[i], ids[f]]; AK.save(); AK.emit('team'); sel = i; renderAll(i); } }
    else if (t.startsWith('o:')) { const id = t.slice(2); if (ids[i] !== id) { place(id, i); sel = i; renderAll(i); speak(id, i === 0 ? '任命队长' : '编入队伍'); } }
  });
  // 阻止主页面的"拖入图片替换立绘"覆盖层
  grid.addEventListener('dragenter', e => e.stopPropagation());
}

AK.enter.squad = () => { if (!inited) init(); const nx = cur().ids.findIndex(x => !x); sel = nx < 0 ? 0 : nx; renderAll(); };
AK.sub('team', () => { if (AK.view() === 'squad') return; });
})();
