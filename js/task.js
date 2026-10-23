/* task.js — 任务:日常 / 周常 / 主线 / 支线。进度由出击等事件驱动,活跃度宝箱,04:00 重置,小红点 */
(() => {
'use strict';
const AK = window.AK, $ = s => document.querySelector(s), esc = AK.esc, st = AK.st, MIS = AK.MIS;
const TABS = [['daily', '日常'], ['weekly', '周常'], ['main', '主线'], ['sub', '支线']];
const SCOPE = { daily: 'daily', weekly: 'weekly', main: 'perm', sub: 'perm' };
const AUTO = /^(stage|kill|boss|assist|maxkill)(:|$)/;
const BASEEV = /^(manu|order|credit|creditpt|dorm|trust|prodgold|prodexp|shop|have:.+)$/;
const TAG = e => /^stage/.test(e) ? '关卡' : AUTO.test(e) ? '作战' : BASEEV.test(e) ? '基建' : e === 'manual' ? '养成' : '系统';
let tab = 'daily', inited = false;

const listOf = t => t === 'daily' ? MIS.daily[AK.isWeekend() ? 'we' : 'wd'].m : t === 'weekly' ? MIS.weekly.m : MIS[t] || [];
const chestsOf = t => (t === 'daily' ? MIS.daily[AK.isWeekend() ? 'we' : 'wd'].rw : t === 'weekly' ? MIS.weekly.rw : null);
const isClaimed = (t, id) => !!st.mission.claimed[t + ':' + id];
const anyClaimed = id => ['daily', 'weekly', 'main', 'sub'].some(t => isClaimed(t, id));
const byId = new Map(); ['main', 'sub'].forEach(t => MIS[t].forEach(m => byId.set(m.id, m)));
['wd', 'we'].forEach(k => MIS.daily[k].m.forEach(m => byId.set(m.id, m))); MIS.weekly.m.forEach(m => byId.set(m.id, m));
function state(t, m) {
  if (isClaimed(t, m.id)) return 'claimed';
  if (m.pre.some(p => !anyClaimed(p))) return 'locked';
  return AK.prog(SCOPE[t], m) >= AK.target(m) ? 'ready' : 'doing';
}
const ORDER = { ready: 0, doing: 1, locked: 2, claimed: 3 };
const thresholds = t => { const cs = chestsOf(t) || []; let a = 0; return cs.map(c => (a += c.c)); };
const pts = t => st.mission.pts[t] || 0;
const chestReady = (t, i) => !st.mission.ptc[t].includes(i) && pts(t) >= thresholds(t)[i];

function readyCount(t) {
  let n = listOf(t).filter(m => state(t, m) === 'ready').length;
  const cs = chestsOf(t); if (cs) cs.forEach((_, i) => { if (chestReady(t, i)) n++; });
  return n;
}
const totalReady = () => TABS.reduce((s, [t]) => s + readyCount(t), 0);

/* ---------- 领取 ---------- */
function claimM(t, m) {
  if (state(t, m) !== 'ready') return null;
  st.mission.claimed[t + ':' + m.id] = 1;
  if (t === 'daily' || t === 'weekly') st.mission.pts[t] = pts(t) + (m.pt || 0);
  return m.r || [];
}
function claimChest(t, i) {
  if (!chestReady(t, i)) return null;
  st.mission.ptc[t].push(i); return chestsOf(t)[i].r || [];
}
function done(rewards, title) {
  AK.save(); AK.emit('mission'); render();
  if (rewards.length) AK.grant(rewards, title); else AK.toast('已领取(无物资奖励,活跃度已累计)');
}

/* ---------- 渲染 ---------- */
function rewardHtml(list) {
  return list.map(([ty, id, c]) => { const it = AK.item(id); if (!it) return ''; return `<span class="rwi" title="${esc(it.n)}" style="--rc:${AK.RC[Math.min(it.r, 5)]}"><img src="assets/item/${it.i}.png" alt="" loading="lazy"><b>${c >= 10000 ? (c / 10000) + '万' : c}</b></span>`; }).join('');
}
function renderTabs() {
  const h = $('#tkTabs'); h.innerHTML = '<span class="lb">类型</span>';
  TABS.forEach(([t, l]) => {
    const b = document.createElement('button'); b.className = 'chip' + (t === tab ? ' on' : '');
    const n = readyCount(t); b.innerHTML = `${l}${n ? `<i class="nb">${n}</i>` : ''}`;
    b.addEventListener('click', () => { tab = t; $('#tkWrap').scrollTop = 0; render(); }); h.appendChild(b);
  });
}
function renderInfo() {
  const l = listOf(tab), c = l.filter(m => isClaimed(tab, m.id)).length;
  const txt = { daily: AK.isWeekend() ? '周末任务表 · 每日 04:00 重置' : '工作日任务表 · 每日 04:00 重置', weekly: '每周一 04:00 重置', main: '主线进度:在「出击」中通关对应关卡', sub: '支线:先完成前置任务才会解锁' }[tab];
  $('#tkInfo').innerHTML = `<span class="lb">说明</span><span class="tki">${txt}</span><span class="tki dim">已领取 ${c} / ${l.length}</span><span class="tki rst" id="tkRst"></span>`;
  tickRst();
}
function renderList() {
  const l = listOf(tab).map((m, i) => ({ m, i, s: state(tab, m) })).sort((a, b) => ORDER[a.s] - ORDER[b.s] || a.i - b.i);
  const sc = SCOPE[tab], showPt = tab === 'daily' || tab === 'weekly';
  $('#tkList').innerHTML = l.map(({ m, s }, k) => {
    const e = AK.evtOf(m), p = AK.prog(sc, m), t = AK.target(m), auto = AUTO.test(e) || BASEEV.test(e);
    const pre = s === 'locked' ? m.pre.map(x => byId.get(x)).filter(Boolean).filter(x => !anyClaimed(x.id))[0] : null;
    const btn = s === 'ready' ? '<button class="btn go" data-a="claim">领取</button>'
      : s === 'claimed' ? '<button class="btn alt" disabled>已领取</button>'
      : s === 'locked' ? '<button class="btn alt" disabled>未解锁</button>'
      : auto ? '<button class="btn" data-a="go">前往 ▸</button>' : '<button class="btn alt" data-a="demo" title="该任务依赖基建 / 养成系统,本复刻不含;点击模拟完成">演示完成</button>';
    return `<div class="tk ${s}" data-id="${m.id}" style="--i:${Math.min(k, 24)}">
      <div class="tkl"><div class="tkt"><em>${TAG(e)}</em>${esc(m.d)}</div>
        <div class="tkb"><i style="width:${p / t * 100}%"></i></div>
        <small>${s === 'locked' && pre ? '前置:' + esc(pre.d) : s === 'claimed' ? '已完成' : `${p} / ${t}`}${!auto && s !== 'claimed' && s !== 'locked' ? ' · 需手动模拟' : ''}</small></div>
      ${showPt ? `<div class="tkp">+${m.pt}<small>活跃</small></div>` : ''}
      <div class="tkr">${rewardHtml(m.r || []) || '<span class="none">—</span>'}</div>${btn}</div>`;
  }).join('') || '<div class="empty">暂无任务</div>';
}
function renderSide() {
  const box = $('#tkSide'), cs = chestsOf(tab), l = listOf(tab);
  if (cs) {
    const th = thresholds(tab), mx = th[th.length - 1], p = pts(tab);
    box.innerHTML = `<div class="iDet"><div class="hd2">${tab === 'daily' ? '日常' : '周常'}活跃度</div>
      <div class="pbig"><b>${p}</b><span>/ ${mx}</span></div><div class="pbar"><i style="width:${Math.min(1, p / mx) * 100}%"></i></div>
      <div class="chests">${cs.map((c, i) => { const cl = st.mission.ptc[tab].includes(i), rd = !cl && p >= th[i]; return `<div class="chest ${cl ? 'claimed' : rd ? 'ready' : ''}" data-ch="${i}"><small>${th[i]}</small><div class="ri">${rewardHtml(c.r)}</div><span>${cl ? '已领取' : rd ? '领取' : '未达成'}</span></div>`; }).join('')}</div>
      <div class="note">活跃度由已领取的任务累计,达到阈值后可领取对应奖励。阈值按档位累加计算(原游戏数据只给出每档所需增量)。</div></div>`;
  } else {
    const c = l.filter(m => isClaimed(tab, m.id)).length, rd = l.filter(m => state(tab, m) === 'ready').length;
    box.innerHTML = `<div class="iDet"><div class="hd2">${tab === 'main' ? '主线' : '支线'}进度</div>
      <div class="pbig"><b>${c}</b><span>/ ${l.length}</span></div><div class="pbar"><i style="width:${c / l.length * 100}%"></i></div>
      <div class="sn2"><div><small>可领取</small><b>${rd}</b></div><div><small>累计出击</small><b>${st.stats.sorties}</b></div><div><small>累计歼灭</small><b>${st.stats.kills.toLocaleString()}</b></div></div>
      <div class="note">通关类任务需要在「出击」中选择对应关卡完成;带「基建」标签的任务在基建页完成;养成等没有对应系统的任务可点击「演示完成」模拟。</div>
      <div class="btns"><button class="btn alt" id="tkReset">重置全部进度</button></div></div>`;
    $('#tkReset').addEventListener('click', () => { if (confirm('将清除所有存档(编队、库存、任务进度),确定吗?')) AK.resetAll(); });
  }
}
function render() { AK.rollover(); renderTabs(); renderInfo(); renderList(); renderSide(); $('#tkReady').textContent = totalReady(); dot(); }

/* ---------- 倒计时 / 红点 ---------- */
const hms = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${AK.p2(Math.floor(s / 3600))}:${AK.p2(Math.floor(s % 3600 / 60))}:${AK.p2(s % 60)}`; };
function tickRst() {
  const el = $('#tkRst'); if (!el) return; const n = AK.nextReset();
  el.textContent = tab === 'weekly' ? `距周常重置 ${Math.floor(n.weekly / 86400e3)} 天 ${hms(n.weekly % 86400e3)}` : tab === 'daily' ? `距日常重置 ${hms(n.daily)}` : '';
}
function dot() { const n = totalReady(); const d = $('#tkDot'); if (d) { d.classList.toggle('on', n > 0); d.textContent = n > 9 ? '9+' : n || ''; } }
setInterval(() => {
  const before = st.mission.dk + st.mission.wk; AK.rollover();
  if (AK.view() === 'task') { tickRst(); if (before !== st.mission.dk + st.mission.wk) render(); } dot();
}, 1000);

/* ---------- 交互 ---------- */
function init() {
  inited = true;
  $('#tkList').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'), row = e.target.closest('.tk'); if (!b || !row) return;
    const m = byId.get(row.dataset.id); if (!m) return;
    if (b.dataset.a === 'claim') { const r = claimM(tab, m); if (r) { row.classList.add('flash'); done(r, '任务奖励'); } }
    else if (b.dataset.a === 'demo') { AK.manualAdvance(SCOPE[tab], m); }
    else if (b.dataset.a === 'go') {
      const ev = AK.evtOf(m), sm = /^stage:(.+)$/.exec(ev);
      if (BASEEV.test(ev)) { AK.nav('base'); return; }
      AK.act.sortie({ stage: sm ? sm[1] : null, assist: ev === 'assist' });
    }
  });
  $('#tkSide').addEventListener('click', e => {
    const c = e.target.closest('.chest'); if (!c) return;
    const r = claimChest(tab, +c.dataset.ch); if (r) done(r, '活跃度奖励');
  });
  $('#tkAll').addEventListener('click', () => {
    const all = []; let n = 0;
    listOf(tab).forEach(m => { const r = claimM(tab, m); if (r) { n++; all.push(...r); } });
    const cs = chestsOf(tab); if (cs) cs.forEach((_, i) => { const r = claimChest(tab, i); if (r) { n++; all.push(...r); } });
    if (!n) { AK.toast('没有可领取的任务'); return; }
    done(all, `一键领取 · ${n} 项`);
  });
}
AK.sub('mission', () => { if (AK.view() === 'task') render(); else dot(); });
AK.enter.task = () => { if (!inited) init(); render(); };
dot();
})();
