/* event.js — 常驻活动「泰拉纪事」:仿明日方舟活动页的结构(概览 / 档案 / 问答 / 任务 / 兑换),内容为泰拉世界观概述。
   文本见 data/lore.js(原创转述)。活动货币「纪事印记」存于 st.event。 */
(() => {
'use strict';
const AK = window.AK, L = window.LORE, $ = s => document.querySelector(s), esc = AK.esc, st = AK.st;
const E = st.event = (st.event && st.event.v === 1) ? st.event : { v: 1, read: {}, rounds: 0, correct: 0, perfect: 0, tokens: 0, claimed: {}, bought: {} };
const TABS = [['home', '概览'], ['lore', '纪事档案'], ['quiz', '泰拉问答'], ['task', '活动任务'], ['shop', '印记兑换']];
const CATC = { world: '#18d1ff', nation: '#ff9d3c', faction: '#c78bf0', history: '#9ad24c' };
const byId = new Map(L.entries.map(e => [e.id, e]));
const catName = c => (L.cats.find(x => x[0] === c) || [])[1];
const readN = c => L.entries.filter(e => E.read[e.id] && (!c || e.c === c)).length;
const totalN = c => L.entries.filter(e => !c || e.c === c).length;
let tab = 'home', cat = 'all', sel = null, inited = false, Q = null;

/* ---------- 货币 / 奖励 ---------- */
const addTk = n => { E.tokens += n; AK.save(); };
const MISSIONS = [
  { id: 'r5', d: '阅读 5 篇纪事', v: () => readN(), n: 5, tk: 20, rw: [['M', '4001', 20000]] },
  { id: 'r15', d: '阅读 15 篇纪事', v: () => readN(), n: 15, tk: 40, rw: [['M', '2002', 5], ['M', '4001', 30000]] },
  { id: 'rall', d: '读完全部纪事', v: () => readN(), n: totalN(), tk: 120, rw: [['M', '7001', 3], ['M', '3105', 1]] },
  ...L.cats.map(([c, n]) => ({ id: 'c_' + c, d: `读完「${n}」类全部纪事`, v: () => readN(c), n: totalN(c), tk: 30, rw: [['M', '2001', 6]] })),
  { id: 'q1', d: '完成 1 轮泰拉问答', v: () => E.rounds, n: 1, tk: 10, rw: [['M', '4001', 10000]] },
  { id: 'q5', d: '完成 5 轮泰拉问答', v: () => E.rounds, n: 5, tk: 40, rw: [['M', '2003', 3]] },
  { id: 'cor', d: '累计答对 40 题', v: () => E.correct, n: 40, tk: 60, rw: [['M', '3003', 20]] },
  { id: 'perf', d: '在一轮问答中全部答对', v: () => E.perfect, n: 1, tk: 50, rw: [['M', '7001', 2]] },
];
const SHOP = [
  ['4001', 50000, 30, 10], ['2002', 10, 40, 10], ['2003', 5, 80, 5], ['3003', 20, 60, 10],
  ['7001', 2, 100, 5], ['3133', 2, 120, 5], ['4006', 3, 200, 3], ['3105', 1, 150, 3],
];
const grantList = rw => rw.map(([, id, c]) => ['MATERIAL', id, c]);
const itemOf = id => AK.item(id) || { n: id, i: id, r: 0 };
const rwHtml = rw => rw.map(([, id, c]) => `<span class="ev-rw" title="${esc(itemOf(id).n)}"><img src="assets/item/${itemOf(id).i}.png" alt=""><b>${c.toLocaleString()}</b></span>`).join('');

/* ---------- 工具 ---------- */
const relOps = (e, fb) => (e.na || fb) ? AK.OPS.filter(o => o.na === (e.na || '罗德岛') && o.r >= 4).sort((a, b) => b.r - a.r || AK.hash(a.id) % 97 - AK.hash(b.id) % 97).slice(0, 4) : [];
const snippet = e => e.p[0].length > 54 ? e.p[0].slice(0, 54) + '…' : e.p[0];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const claimable = () => MISSIONS.filter(m => !E.claimed[m.id] && m.v() >= m.n).length;

/* ---------- 概览 ---------- */
function viewHome() {
  const un = shuffle(L.entries.filter(e => !E.read[e.id])).slice(0, 3);
  return `<div class="ev-hero"><div class="ev-kv"><span class="ev-tg">常驻活动 · PERMANENT</span><b>泰拉纪事</b><em>CHRONICLES OF TERRA</em>
      <p>走进罗德岛的资料库,翻阅关于泰拉大地的纪事:天灾、源石、感染者,以及各个国度与势力。读完档案,再用问答检验自己,换取印记与物资。</p>
      <div class="ev-go"><button class="btn go" data-ev="goto" data-t="lore">开始阅读</button><button class="btn" data-ev="goto" data-t="quiz">泰拉问答</button></div></div>
    <div class="ev-globe"><i></i><i></i><i></i></div></div>
    <div class="ev-tiles">
      <div><small>纪事阅读</small><b>${readN()}<span>/${totalN()}</span></b><div class="pbar"><i style="width:${readN() / totalN() * 100}%"></i></div></div>
      <div><small>问答 · 累计答对</small><b>${E.correct}<span>题 · ${E.rounds} 轮</span></b></div>
      <div><small>纪事印记</small><b>${E.tokens}</b></div>
      <div><small>可领取任务</small><b>${claimable()}</b></div></div>
    <div class="hd2" style="margin:18px 0 8px">推荐阅读</div>
    <div class="ev-cards">${un.length ? un.map(card).join('') : '<div class="empty" style="padding:30px 0">已全部读完,真是博学的博士。</div>'}</div>`;
}
function card(e) {
  return `<div class="ev-card${sel === e.id ? ' on' : ''}${E.read[e.id] ? ' read' : ''}" data-ev="open" data-id="${e.id}" style="--c:${CATC[e.c]}">
    <div class="ev-ch"><em>${catName(e.c)}</em><small>${e.tag}</small></div><b>${e.t}</b><span class="ev-en">${e.en}</span><p>${esc(snippet(e))}</p>
    <i class="ev-ck">${E.read[e.id] ? '✓ 已读' : '未读'}</i></div>`;
}
/* ---------- 档案 ---------- */
function viewLore() {
  const l = L.entries.filter(e => cat === 'all' || e.c === cat);
  return `<div class="ev-sub">${[['all', '全部']].concat(L.cats.map(c => [c[0], c[1]])).map(([k, n]) => `<button class="chip${cat === k ? ' on' : ''}" data-ev="cat" data-k="${k}">${n} <i>${k === 'all' ? readN() + '/' + totalN() : readN(k) + '/' + totalN(k)}</i></button>`).join('')}</div>
    <div class="ev-cards">${l.map(card).join('')}</div>`;
}
/* ---------- 问答 ---------- */
function viewQuiz() {
  if (!Q) return `<div class="ev-qstart"><b>泰拉问答</b><p>每轮从题库中随机抽取 10 题。答对一题 +5 印记与 1000 龙门币;全部答对再奖励 20 印记。题目全部基于「纪事档案」,答错时可跳转到对应档案复习。</p>
      <div class="ev-tiles"><div><small>累计答对</small><b>${E.correct}</b></div><div><small>已完成</small><b>${E.rounds}<span>轮</span></b></div><div><small>全对次数</small><b>${E.perfect}</b></div></div>
      <button class="btn go big" data-ev="qstart">开始答题</button></div>`;
  if (Q.i >= Q.list.length) {
    const tk = Q.ok * 5 + (Q.ok === Q.list.length ? 20 : 0);
    return `<div class="ev-qstart"><b>本轮结束</b><div class="ev-score">${Q.ok}<span>/ ${Q.list.length}</span></div>
      <p>获得 <b style="color:var(--orange)">${tk}</b> 纪事印记与 ${(Q.ok * 1000).toLocaleString()} 龙门币${Q.ok === Q.list.length ? '——满分!' : '。'}</p>
      ${Q.wrong.length ? `<div class="hd2">建议复习</div><div class="ev-rev">${[...new Set(Q.wrong)].map(id => `<button class="btn alt" data-ev="open" data-id="${id}" data-t="lore">${esc(byId.get(id).t)}</button>`).join('')}</div>` : ''}
      <div class="ev-go"><button class="btn go" data-ev="qstart">再来一轮</button><button class="btn alt" data-ev="qexit">返回</button></div></div>`;
  }
  const q = Q.list[Q.i], picked = Q.pick;
  return `<div class="ev-quiz"><div class="ev-qh"><span>第 ${Q.i + 1} / ${Q.list.length} 题</span><div class="pbar"><i style="width:${Q.i / Q.list.length * 100}%"></i></div><span>答对 ${Q.ok}</span></div>
    <div class="ev-qq">${esc(q.q)}</div>
    <div class="ev-qo">${q.o.map((o, i) => `<button class="ev-opt${picked === null ? '' : i === q.a ? ' right' : i === picked ? ' wrong' : ' dim'}" data-ev="ans" data-i="${i}"${picked === null ? '' : ' disabled'}><b>${'ABCD'[i]}</b>${esc(o)}</button>`).join('')}</div>
    ${picked === null ? '' : `<div class="ev-qf"><span class="${picked === q.a ? 'ok' : 'no'}">${picked === q.a ? '回答正确!' : '回答错误,正确答案是 ' + 'ABCD'[q.a]}</span>
      <button class="btn alt" data-ev="open" data-id="${q.r}" data-t="lore">查看档案「${esc(byId.get(q.r).t)}」</button><button class="btn go" data-ev="qnext">${Q.i + 1 >= Q.list.length ? '查看结果' : '下一题 ▸'}</button></div>`}</div>`;
}
/* ---------- 任务 ---------- */
function viewTask() {
  const l = MISSIONS.map((m, i) => ({ m, i, s: E.claimed[m.id] ? 3 : m.v() >= m.n ? 0 : 1 })).sort((a, b) => a.s - b.s || a.i - b.i);
  return `<div class="ev-tasks">${l.map(({ m, s }) => { const v = Math.min(m.n, m.v()); return `<div class="tk ${s === 3 ? 'claimed' : s === 0 ? 'ready' : 'doing'}">
    <div class="tkl"><div class="tkt"><em>活动</em>${esc(m.d)}</div><div class="tkb"><i style="width:${v / m.n * 100}%"></i></div><small>${s === 3 ? '已完成' : v + ' / ' + m.n}</small></div>
    <div class="tkr"><span class="ev-rw tkn"><b>印记 ${m.tk}</b></span>${rwHtml(m.rw)}</div>
    ${s === 0 ? `<button class="btn go" data-ev="claim" data-id="${m.id}">领取</button>` : s === 3 ? '<button class="btn alt" disabled>已领取</button>' : '<button class="btn alt" disabled>进行中</button>'}</div>`; }).join('')}</div>`;
}
/* ---------- 兑换 ---------- */
function viewShop() {
  return `<div class="ev-shop">${SHOP.map(([id, c, cost, lim], i) => { const it = itemOf(id), left = lim - (E.bought[i] || 0), ok = left > 0 && E.tokens >= cost;
    return `<div class="ev-sitem" style="--rc:${AK.RC[Math.min(it.r, 5)]}"><img src="assets/item/${it.i}.png" alt=""><b>${esc(it.n)}</b><span>×${c.toLocaleString()}</span><small>限购 ${left}/${lim}</small>
      <button class="btn ${ok ? 'go' : 'alt'}" data-ev="buy" data-i="${i}"${left > 0 ? '' : ' disabled'}>${left > 0 ? '印记 ' + cost : '已售罄'}</button></div>`; }).join('')}</div>`;
}
const VIEWS = { home: viewHome, lore: viewLore, quiz: viewQuiz, task: viewTask, shop: viewShop };

/* ---------- 右侧栏 ---------- */
function side() {
  const e = sel && byId.get(sel);
  if (tab === 'lore' || (e && (tab === 'home' || tab === 'quiz'))) {
    if (!e) return `<div class="iDet"><div class="hd2">纪事档案</div><p>点击左侧的档案卡片阅读。首次阅读每篇可获得 3 枚纪事印记。</p><div class="note">文字为本项目对《明日方舟》世界观的原创概述,细节请以游戏内与官方资料为准。</div></div>`;
    const ops = relOps(e), art = relOps(e, true);
    return `<div class="iDet ev-d" style="--c:${CATC[e.c]}"><div class="ev-art"><span>${e.en}</span>${art.slice(0, 3).map((o, i) => `<img src="assets/portrait/${o.id}.png" onerror="this.onerror=null;this.src='assets/avatar/${o.id}.png'" style="--k:${i}" alt="" title="${esc(o.n)}">`).join('')}</div>
      <div class="ev-dh"><em>${catName(e.c)} · ${e.tag}</em><b>${e.t}</b></div>${e.p.map(p => `<p>${esc(p)}</p>`).join('')}
      ${ops.length ? `<div class="hd2" style="margin-top:16px">相关干员</div><div class="ev-ops">${ops.map(o => `<span title="${esc(o.n)}"><img src="${AK.avatar(o.id)}" alt=""><small>${esc(o.n)}</small></span>`).join('')}</div>` : ''}
      <div class="note">${E.read[e.id] ? '✓ 已阅读' : ''} 本页为原创概述,仅供学习。</div></div>`;
  }
  if (tab === 'quiz') return `<div class="iDet"><div class="hd2">答题规则</div><p>10 题一轮,答对 +5 印记与 1000 龙门币;满分额外 +20 印记并记录一次「全对」。</p><div class="pbig"><b>${E.tokens}</b><span>印记</span></div></div>`;
  if (tab === 'task') return `<div class="iDet"><div class="hd2">活动任务</div><div class="pbig"><b>${MISSIONS.filter(m => E.claimed[m.id]).length}</b><span>/ ${MISSIONS.length}</span></div><div class="pbar"><i style="width:${MISSIONS.filter(m => E.claimed[m.id]).length / MISSIONS.length * 100}%"></i></div><p>阅读纪事、完成问答即可推进;任务奖励包含纪事印记与物资。</p><div class="btns"><button class="btn go" data-ev="claimall">一键领取</button></div></div>`;
  if (tab === 'shop') return `<div class="iDet"><div class="hd2">印记兑换</div><div class="pbig"><b>${E.tokens}</b><span>纪事印记</span></div><p>印记来自阅读纪事(每篇首次 3 枚)、问答与活动任务。</p></div>`;
  return `<div class="iDet"><div class="hd2">活动说明</div><p>「泰拉纪事」是常驻的资料型活动:通过阅读、答题、完成任务获得纪事印记,并在兑换页换取物资。</p>
    <p>活动结构仿照明日方舟的限时活动页(概览 / 内容 / 任务 / 商店),内容为泰拉世界观的原创介绍。</p><div class="note">世界观设定版权归鹰角网络;文字为本项目转述概括,可能与游戏内细节有出入。</div></div>`;
}

/* ---------- 渲染 ---------- */
function renderTabs() {
  $('#evTabs').innerHTML = '<span class="lb">活动</span>' + TABS.map(([k, n]) => `<button class="chip${tab === k ? ' on' : ''}" data-ev="tab" data-t="${k}">${n}${k === 'task' && claimable() ? ' <i style="color:#ff5e3a">●</i>' : ''}</button>`).join('');
  $('#evTk').textContent = E.tokens;
}
function render() { renderTabs(); $('#evBody').innerHTML = VIEWS[tab](); $('#evSide').innerHTML = side(); dot(); }
function dot() { const a = $('#evDot'); if (!a) return; const n = claimable(); a.classList.toggle('on', n > 0); a.textContent = n > 9 ? '9+' : n || ''; const r = $('#evProg'); if (r) r.textContent = `阅读 ${readN()}/${totalN()}`; }

/* ---------- 操作 ---------- */
function open(id) {
  const e = byId.get(id); if (!e) return; sel = id;
  if (!E.read[id]) { E.read[id] = 1; addTk(3); AK.toast(`首次阅读「${e.t}」 +3 纪事印记`); AK.emit('mission'); }
  AK.save();
}
function doClaim(m) {
  if (E.claimed[m.id] || m.v() < m.n) return null; E.claimed[m.id] = 1; addTk(m.tk); return grantList(m.rw).concat([]);
}
function onClick(e) {
  const b = e.target.closest('[data-ev]'); if (!b) return; const a = b.dataset.ev, ds = b.dataset;
  if (a === 'tab') { tab = ds.t; if (tab !== 'quiz') Q = Q && Q.i >= Q.list.length ? null : Q; render(); }
  else if (a === 'goto') { tab = ds.t; render(); }
  else if (a === 'cat') { cat = ds.k; render(); }
  else if (a === 'open') { if (ds.t) tab = ds.t; open(ds.id); render(); $('#evSide').firstElementChild && ($('#evSide').firstElementChild.scrollTop = 0); }
  else if (a === 'qstart') { Q = { list: shuffle(L.quiz).slice(0, 10).map(q => { const idx = shuffle(q.o.map((t, i) => i)); return { q: q.q, o: idx.map(i => q.o[i]), a: idx.indexOf(q.a), r: q.r }; }), i: 0, ok: 0, pick: null, wrong: [] }; render(); }
  else if (a === 'qexit') { Q = null; render(); }
  else if (a === 'ans') {
    if (!Q || Q.pick !== null) return; const q = Q.list[Q.i]; Q.pick = +ds.i;
    if (Q.pick === q.a) { Q.ok++; AK.beep && AK.beep(700, 1100, .12, 'triangle', .05); } else { Q.wrong.push(q.r); AK.beep && AK.beep(300, 160, .18, 'sawtooth', .04); }
    render();
  } else if (a === 'qnext') {
    Q.i++; Q.pick = null;
    if (Q.i >= Q.list.length) {
      const tk = Q.ok * 5 + (Q.ok === Q.list.length ? 20 : 0);
      E.rounds++; E.correct += Q.ok; if (Q.ok === Q.list.length) E.perfect++; addTk(tk); AK.save(); AK.emit('mission');
      if (Q.ok) AK.grant([['GOLD', '4001', Q.ok * 1000]], `问答奖励 · 答对 ${Q.ok} 题`);
    }
    render();
  } else if (a === 'claim') { const m = MISSIONS.find(x => x.id === ds.id), r = doClaim(m); if (r) { AK.grant(r, `活动任务 · 印记 +${m.tk}`); render(); } }
  else if (a === 'claimall') {
    const all = []; let tk = 0, n = 0; MISSIONS.forEach(m => { const r = doClaim(m); if (r) { all.push(...r); tk += m.tk; n++; } });
    if (!n) { AK.toast('没有可领取的任务'); return; } AK.grant(all, `一键领取 · ${n} 项 · 印记 +${tk}`); render();
  } else if (a === 'buy') {
    const i = +ds.i, [id, c, cost, lim] = SHOP[i];
    if ((E.bought[i] || 0) >= lim) return; if (E.tokens < cost) { AK.toast('纪事印记不足'); return; }
    E.tokens -= cost; E.bought[i] = (E.bought[i] || 0) + 1; AK.save(); AK.grant([['MATERIAL', id, c]], '印记兑换'); render();
  }
}
function init() { inited = true; $('#v-event').addEventListener('click', onClick); }
AK.enter.event = () => { if (!inited) init(); render(); };
AK.sub('mission', () => { if (AK.view() === 'event') render(); else dot(); });
AK.event_ = { claimable };
dot();
})();
