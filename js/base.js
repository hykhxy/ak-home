/* base.js — 基建:16 个空地 + 控制中枢;制造 / 贸易 / 发电 / 宿舍 / 会客 / 办公 / 加工;干员技能(源自 building_data)、心情、电力、无人机、订单。
   时间流速:1 游戏小时 = 现实 60 秒(界面上有标注)。技能数值由说明文字解析,带「条件」的技能按 50% 保守折算。 */
(() => {
'use strict';
const AK = window.AK, B = window.BASE, $ = s => document.querySelector(s), esc = AK.esc, st = AK.st, RM = B.rooms;
const HOUR = 60000, MOOD_MAX = 24, NSLOT = 16, DRONE_MAX = 200, DRONE_H = .25, CRED_CAP = 360, HIRE_H = 20;
const TYPES = ['CONTROL', 'POWER', 'MANUFACTURE', 'TRADING', 'DORMITORY', 'MEETING', 'HIRE', 'WORKSHOP'];
const META = {
  CONTROL: { c: '#e5502a', en: 'CONTROL CENTER' }, POWER: { c: '#7ac943', en: 'POWER PLANT' }, MANUFACTURE: { c: '#f2c230', en: 'FACTORY' },
  TRADING: { c: '#3da9f4', en: 'TRADING POST' }, DORMITORY: { c: '#29c5b3', en: 'DORMITORY' }, MEETING: { c: '#ee6fa5', en: 'RECEPTION ROOM' },
  HIRE: { c: '#a37bf0', en: 'OFFICE' }, WORKSHOP: { c: '#f08a2c', en: 'WORKSHOP' },
};
const OFFERS = [['3131', 2, 40], ['3132', 1, 80], ['2002', 4, 60], ['7001', 1, 150], ['3105', 1, 300]];
const WTY = { F_BUILDING: '建材', F_SKILL: '技能', F_EVOLVE: '精英化' };

/* ================= 状态 ================= */
const FM = id => B.manu.find(f => f.id === id);
const goldF = () => B.manu.find(f => f.ty === 'gold');
function mkRoom(t) { return { t, lv: 1, ops: [], acc: 0, rc: t === 'MANUFACTURE' ? goldF().id : null, n: 0, ords: [], nx: 0, store: 0 }; }
function initState() {
  const s = { v: 1, t: Date.now(), ctrl: mkRoom('CONTROL'), slots: Array(NSLOT).fill(null), mood: {}, drone: 40, credit: 0, tc: {} };
  s.slots[0] = mkRoom('POWER'); s.slots[1] = mkRoom('MANUFACTURE'); s.slots[2] = mkRoom('TRADING'); s.slots[3] = mkRoom('DORMITORY');
  return s;
}
const S = st.base = (st.base && st.base.v === 1) ? st.base : initState();
S.slots = S.slots.slice(0, NSLOT); while (S.slots.length < NSLOT) S.slots.push(null);
// 清理已不存在的干员
const clean = r => { if (r) r.ops = r.ops.filter(id => AK.opIdx(id) >= 0); }; clean(S.ctrl); S.slots.forEach(clean);

const R = k => k === 'C' ? S.ctrl : S.slots[k];
const allRooms = () => [['C', S.ctrl], ...S.slots.map((r, i) => r ? [i, r] : null).filter(Boolean)];
const phase = r => RM[r.t].ph[r.lv - 1];
const mood = id => S.mood[id] === undefined ? MOOD_MAX : S.mood[id];
const setMood = (id, v) => { S.mood[id] = Math.max(0, Math.min(MOOD_MAX, v)); if (S.mood[id] >= MOOD_MAX) delete S.mood[id]; };
const have = id => { const it = AK.item(id); return it ? AK.qty(it) : 0; };
const itName = id => (AK.item(id) || { n: id }).n;
const itImg = id => { const it = AK.item(id); return it ? `assets/item/${it.i}.png` : ''; };
const count = (t, lv = 1) => S.slots.filter(r => r && r.t === t && r.lv >= lv).length + (t === 'CONTROL' && S.ctrl.lv >= lv ? 1 : 0);
const fmtN = n => n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(Math.floor(n));
const f1 = n => (Math.round(n * 10) / 10).toString();
const fmtH = h => { const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)}h${AK.p2(m % 60)}m` : `${m}m`; };

/* ================= 干员技能 ================= */
const skCache = new Map();
const maxPhase = o => o.r >= 3 ? 2 : o.r === 2 ? 1 : 0;   // 假设干员均为满级:4★以上精二,3★精一
function skills(opId) {
  if (skCache.has(opId)) return skCache.get(opId);
  const o = AK.op(opId), res = [], sl = B.ops[opId];
  if (o && sl) sl.forEach(ent => { let pick = null; ent.forEach(([ph, , bi]) => { if (ph <= maxPhase(o)) pick = B.buffs[bi]; }); if (pick) res.push(pick); });
  skCache.set(opId, res); return res;
}
const skillsFor = (opId, t) => skills(opId).filter(b => b.rt === t);
const locOf = id => { for (const [k, r] of allRooms()) if (r.ops.includes(id)) return [k, r]; return null; };
const locName = id => { const l = locOf(id); if (!l) return ''; const [k, r] = l; if (k === 'C') return '控制中枢'; const same = S.slots.filter(x => x && x.t === r.t); return RM[r.t].n + (same.length > 1 ? ' ' + (same.indexOf(r) + 1) : ''); };
const roomName = (k, r) => k === 'C' ? RM.CONTROL.n : RM[r.t].n + (S.slots.filter(x => x && x.t === r.t).length > 1 ? ' ' + (S.slots.filter(x => x && x.t === r.t).indexOf(r) + 1) : '');

/* ================= 数值模型 ================= */
function power() {
  let p = 0, u = 0; allRooms().forEach(([, r]) => { const e = phase(r).el; if (e > 0) p += e; else u -= e; });
  return { p, u, pen: Math.max(0, 1 - Math.max(0, u - p) * .01) };
}
function ctrlFx() {
  let cp = 0, ct = 0, cm = 0;
  S.ctrl.ops.filter(id => mood(id) > 0).forEach(id => skillsFor(id, 'CONTROL').forEach(b => {
    if (b.cp) cp = Math.max(cp, b.cp); if (b.ct) ct = Math.max(ct, b.ct);
    if (b.mc !== undefined && b.ms_ === 'g') cm += -b.mc;
  }));
  return { cp, ct, cm };
}
function speedOf(r, pw = power(), cf = ctrlFx()) {
  const live = r.ops.filter(id => mood(id) > 0), n = live.length;
  const sum = (key, flt) => { let s = 0; live.forEach(id => skillsFor(id, r.t).forEach(b => { if (b[key] !== undefined && (!flt || flt(b))) s += b[key]; })); return s; };
  let s = 0;
  if (r.t === 'MANUFACTURE') { const f = FM(r.rc); s = 1 + .01 * n + sum('pr', b => !b.g || !f || b.g === f.ty) / 100 + cf.cp / 100; }
  else if (r.t === 'TRADING') s = 1 + .01 * n + sum('tr') / 100 + cf.ct / 100;
  else if (r.t === 'POWER') s = 1 + .05 * n + sum('dr') / 100;
  else if (r.t === 'MEETING') s = 1 + .05 * n + sum('ms') / 100;
  else if (r.t === 'HIRE') s = 1 + .05 * n + sum('hs') / 100;
  else if (r.t === 'WORKSHOP') s = 1 + sum('wk') / 100;
  else s = 1;
  return { n, live, s: n ? s * (r.t === 'POWER' ? 1 : pw.pen) : 0 };
}
const rollOrder = lv => { const w = [[.6, .4, 0], [.3, .45, .25], [.2, .35, .45]][Math.min(2, lv - 1)], x = Math.random(); return x < w[0] ? 2 : x < w[0] + w[1] ? 3 : 4; };

function produce(r, h, pw, cf) {
  const sp = speedOf(r, pw, cf); if (!sp.n) return;
  if (r.t === 'POWER') { S.drone = Math.min(DRONE_MAX, S.drone + 3 * h * sp.s); return; }
  if (r.t === 'MANUFACTURE') {
    const f = FM(r.rc); if (!f) return; const cap = RM.MANUFACTURE.cap[r.lv - 1];
    r.acc += 3600 * sp.s * h; r.lack = false;
    while (r.acc >= f.cp) {
      if ((r.n + 1) * f.w > cap) { r.acc = f.cp; break; }
      if (f.co.length && !f.co.every(([id, c]) => have(id) >= c)) { r.acc = f.cp; r.lack = true; break; }
      f.co.forEach(([id, c]) => AK.addItem(id, -c));
      r.n++; r.acc -= f.cp; if (f.ty === 'gold') AK.event('prodgold', f.c); else if (f.ty === 'exp') AK.event('prodexp', f.c);
    }
  } else if (r.t === 'TRADING') {
    const lim = RM.TRADING.lim[r.lv - 1]; if (!r.nx) r.nx = rollOrder(r.lv);
    r.acc += 3600 * sp.s * h;
    while (r.ords.length < lim && r.acc >= B.orderPts[r.nx]) { r.acc -= B.orderPts[r.nx]; r.ords.push(r.nx); r.nx = rollOrder(r.lv); }
    if (r.ords.length >= lim) r.acc = Math.min(r.acc, B.orderPts[r.nx]);
  } else if (r.t === 'MEETING') {
    r.store = Math.min(CRED_CAP, r.store + 20 * (1 + .25 * (r.lv - 1)) * sp.s * h);
  } else if (r.t === 'HIRE') {
    r.acc += sp.s * h; while (r.acc >= HIRE_H) { r.acc -= HIRE_H; if (r.store < 3) r.store++; else r.acc = HIRE_H; if (r.store >= 3) break; }
  }
}
function dormStep(r, h) {
  const ids = r.ops, base = RM.DORMITORY.rec[r.lv - 1] / 100; let roomMr = 0; const lows = [], bonus = {};
  ids.forEach(id => skillsFor(id, 'DORMITORY').forEach(b => { if (b.mr === undefined) return; if (b.mr_ === 'r') roomMr += b.mr; else if (b.mr_ === 'l') lows.push([id, b.mr]); }));
  lows.forEach(([id, v]) => { let t = null; ids.forEach(j => { if (j !== id && mood(j) < MOOD_MAX && (!t || mood(j) < mood(t))) t = j; }); if (t) bonus[t] = Math.max(bonus[t] || 0, v); });
  ids.forEach(id => {
    if (mood(id) >= MOOD_MAX) return;
    let rec = base + roomMr + (bonus[id] || 0);
    skillsFor(id, 'DORMITORY').forEach(b => { if (b.mr !== undefined && b.mr_ === 's') rec += b.mr; });
    setMood(id, mood(id) + rec * h);
    if (mood(id) >= MOOD_MAX) AK.event('dorm', 1);
  });
}
function step(h) {
  const pw = power(), cf = ctrlFx();
  allRooms().forEach(([, r]) => {
    if (r.t === 'DORMITORY') { dormStep(r, h); return; }
    const live = r.ops.filter(id => mood(id) > 0); let roomMc = 0;
    live.forEach(id => skillsFor(id, r.t).forEach(b => { if (b.mc !== undefined && b.ms_ === 'r') roomMc += b.mc; }));
    produce(r, h, pw, cf);
    live.forEach(id => {
      let d = 1 + roomMc - cf.cm; skillsFor(id, r.t).forEach(b => { if (b.mc !== undefined && b.ms_ === 's') d += b.mc; });
      setMood(id, mood(id) - Math.max(0, d) * h);
    });
  });
}
let saveT = 0;
function tick() {
  const now = Date.now(); let dt = (now - S.t) / HOUR; S.t = now; if (dt <= 0) return;
  dt = Math.min(dt, 240); while (dt > 1e-6) { const h = Math.min(dt, .1); step(h); dt -= h; }
  if (now - saveT > 4000) { saveT = now; AK.save(); }
}

/* ================= 操作 ================= */
const afford = items => items.every(([id, c]) => have(id) >= c);
const pay = items => items.forEach(([id, c]) => AK.addItem(id, -c));
const ctrlLv = () => S.ctrl.lv;
function speak(opId, place) {
  const ls = (AK.VOICES[opId] || []).filter(l => l[3] === place); if (ls.length) AK.say(opId, ls[Math.floor(Math.random() * ls.length)]);
}
function unassign(id) { const l = locOf(id); if (l) l[1].ops = l[1].ops.filter(x => x !== id); }
function assign(k, id, quiet) {
  const r = R(k); if (!r || r.ops.includes(id)) return false;
  if (r.ops.length >= phase(r).st) { AK.toast('该设施已满员'); return false; }
  unassign(id); r.ops.push(id); AK.save(); if (!quiet) speak(id, 'BUILDING_PLACE'); return true;
}
function build(slot, t) {
  const T = RM[t], items = T.ph[0].it;
  if (count(t) >= T.mx) { AK.toast(`${T.n}已达上限 (${T.mx})`); return; }
  if (!afford(items)) { AK.toast('建造材料不足'); return; }
  pay(items); S.slots[slot] = mkRoom(t); AK.save(); AK.emit('mission'); AK.beep && AK.beep(500, 1200, .2, 'triangle', .05); AK.toast(`已建造「${T.n}」`);
}
function upgrade(k) {
  const r = R(k), T = RM[r.t];
  if (r.lv >= T.ph.length) return; if (k !== 'C' && r.lv >= ctrlLv()) { AK.toast('设施等级不能超过控制中枢等级'); return; }
  const items = T.ph[r.lv].it; if (!afford(items)) { AK.toast('升级材料不足'); return; }
  pay(items); r.lv++; AK.save(); AK.emit('mission'); AK.beep && AK.beep(500, 1400, .22, 'triangle', .05); AK.toast(`「${T.n}」升至 Lv.${r.lv}`);
}
function demolish(k) {
  const r = R(k); if (!r || k === 'C') return;
  if (!confirm(`拆除「${RM[r.t].n}」?驻守干员将回到待命,仓库内未收取的产物会丢失(不返还建材)。`)) return;
  S.slots[k] = null; if (sel === k) sel = null; AK.save(); AK.emit('mission');
}
function takeManu(r) {
  if (r.t !== 'MANUFACTURE' || r.n <= 0) return null; const f = FM(r.rc), n = r.n * f.c; r.n = 0; AK.event('manu', 1); return [['MATERIAL', f.it, n]];
}
function takeStore(r) {
  if (r.t === 'MEETING') { const n = Math.floor(r.store); if (n < 1) return null; r.store -= n; S.credit += n; AK.event('credit', 1); AK.event('creditpt', n); return []; }
  if (r.t === 'HIRE') { const n = r.store; if (n < 1) return null; r.store = 0; return [['TKT', '7001', n]]; }
  return null;
}
function takeOrders(r) {
  if (r.t !== 'TRADING') return null; let pay_ = 0, done = 0;
  while (r.ords.length && have('3003') >= r.ords[0]) { const n = r.ords.shift(); AK.addItem('3003', -n); pay_ += n * B.gold; done++; }
  if (!done) return null; AK.event('order', done); return [['GOLD', '4001', pay_]];
}
const TAKERS = [takeManu, takeStore, takeOrders];
function collectRoom(r, title) {
  const out = []; let hit = false;
  TAKERS.forEach(f => { const x = f(r); if (x) { hit = true; out.push(...x); } });
  if (!hit) { AK.toast(r.t === 'TRADING' ? (r.ords.length ? '赤金不足,无法交付订单' : '暂无订单') : '暂无可收取的产出'); return; }
  AK.save(); if (out.length) AK.grant(out, title || '基建收获'); else AK.toast('已收取信用'); renderAll();
}
function collectAll() {
  const out = []; let hit = false;
  allRooms().forEach(([, r]) => TAKERS.forEach(f => { const x = f(r); if (x) { hit = true; out.push(...x); } }));
  if (!hit) { AK.toast('没有可收获的产出'); return; }
  AK.save(); if (out.length) AK.grant(out, '基建收获'); else AK.toast('已收取信用'); renderAll();
}
function useDrone(k, n) {
  const r = R(k); if (S.drone < n) { AK.toast('无人机不足'); return; }
  if (!speedOf(r).n) { AK.toast('该设施没有可工作的干员'); return; }
  S.drone -= n; produce(r, n * DRONE_H, power(), ctrlFx()); AK.save(); AK.beep && AK.beep(900, 500, .12, 'sawtooth', .03); renderAll();
}
function craft(r, fid, times) {
  const f = B.work.find(x => x.id === fid); if (!f) return;
  if (!speedOf(r).n) { AK.toast('加工站需要干员进驻'); return; }
  const rw = []; let done = 0;
  for (let i = 0; i < times; i++) {
    if (!afford(f.co) || have('4001') < f.g) break;
    pay(f.co); AK.addItem('4001', -f.g); rw.push(['MATERIAL', f.it, f.c]); done++;
    const bonus = f.xr + sumRoom(r, 'wk') / 100;
    if (f.xg.length && Math.random() < bonus) { const tot = f.xg.reduce((s, g) => s + g[2], 0); let x = Math.random() * tot, g = f.xg[0]; for (const e of f.xg) { x -= e[2]; if (x <= 0) { g = e; break; } } rw.push(['MATERIAL', g[0], g[1]]); }
  }
  if (!done) { AK.toast('材料或龙门币不足'); return; }
  AK.grant(rw, '加工完成'); renderAll();
}
const sumRoom = (r, key) => { let s = 0; r.ops.filter(id => mood(id) > 0).forEach(id => skillsFor(id, r.t).forEach(b => { if (b[key] !== undefined) s += b[key]; })); return s; };
function buy(i) {
  const [id, c, cost] = OFFERS[i]; if (S.credit < cost) { AK.toast('信用不足'); return; }
  S.credit -= cost; AK.event('shop', 1); AK.grant([['MATERIAL', id, c]], '信用交易所'); renderAll();
}
function touch(id) {
  const now = Date.now(); speak(id, 'BUILDING_TOUCHING');
  if (now - (S.tc[id] || 0) > 8000) { S.tc[id] = now; AK.event('trust', 1); }
}

/* ---------- 智能排班 ---------- */
function score(id, r) {
  const o = AK.op(id), t = r.t, f = t === 'MANUFACTURE' ? FM(r.rc) : null; let s = 0;
  skillsFor(id, t).forEach(b => {
    if (t === 'MANUFACTURE' && (!b.g || !f || b.g === f.ty)) s += (b.pr || 0);
    if (t === 'TRADING') s += (b.tr || 0);
    if (t === 'POWER') s += (b.dr || 0) * .5;
    if (t === 'MEETING') s += (b.ms || 0);
    if (t === 'HIRE') s += (b.hs || 0);
    if (t === 'WORKSHOP') s += (b.wk || 0) * .5;
    if (t === 'CONTROL') s += (b.cp || 0) * 3 + (b.ct || 0) * 2 + (b.ms_ === 'g' ? -b.mc * 400 : 0);
    if (t === 'DORMITORY' && b.mr !== undefined) s += b.mr * (b.mr_ === 's' ? 12 : 30);
    if (b.mc !== undefined && t !== 'DORMITORY' && b.ms_ === 'r') s += -b.mc * 40;
    if (b.mc !== undefined && t !== 'DORMITORY' && b.ms_ === 's') s += -b.mc * 12;
  });
  return s + o.r * .01;
}
function autoShift() {
  allRooms().forEach(([, r]) => r.ops = []);
  const used = new Set(), pool = AK.OPS.map(o => o.id);
  const take = (k, r, minMood, filler) => {
    const need = phase(r).st; const cand = pool.filter(id => !used.has(id) && mood(id) >= minMood).map(id => [id, score(id, r)]).sort((a, b) => b[1] - a[1]);
    cand.filter(x => x[1] > .5).slice(0, need).forEach(([id]) => { r.ops.push(id); used.add(id); });
    if (filler && !r.ops.length) { const f = pool.filter(id => !used.has(id) && mood(id) >= 12).sort((a, b) => AK.op(a).r - AK.op(b).r || AK.hash(a) - AK.hash(b))[0]; if (f) { r.ops.push(f); used.add(f); } }
  };
  take('C', S.ctrl, 8, false);
  const order = ['MANUFACTURE', 'TRADING', 'POWER', 'MEETING', 'HIRE', 'WORKSHOP'];
  order.forEach(t => S.slots.forEach((r, k) => { if (r && r.t === t) take(k, r, 8, t !== 'WORKSHOP'); }));
  const dorms = S.slots.map((r, k) => r && r.t === 'DORMITORY' ? [k, r] : null).filter(Boolean).sort((a, b) => b[1].lv - a[1].lv);
  dorms.forEach(([, r]) => { // 先放一名照料型干员
    const c = pool.filter(id => !used.has(id) && mood(id) >= 8).map(id => [id, score(id, r)]).sort((a, b) => b[1] - a[1])[0];
    if (c && c[1] > 3) { r.ops.push(c[0]); used.add(c[0]); }
  });
  const tired = pool.filter(id => !used.has(id) && mood(id) < MOOD_MAX).sort((a, b) => mood(a) - mood(b));
  dorms.forEach(([, r]) => { while (r.ops.length < phase(r).st && tired.length) { const id = tired.shift(); r.ops.push(id); used.add(id); } });
  AK.save(); const n = allRooms().reduce((s, [, r]) => s + r.ops.length, 0);
  AK.toast(`智能排班完成:共 ${n} 名干员进驻`); renderAll();
}

/* ================= 渲染:地图 ================= */
let sel = null, inited = false;
const moodCls = m => m <= 0 ? 'z' : m < 6 ? 'lo' : m < 12 ? 'mid' : 'hi';
function avatars(r, max) {
  let h = r.ops.map(id => `<span class="bs-av ${moodCls(mood(id))}" data-id="${id}" title="${esc(AK.op(id).n)}"><img src="${AK.avatar(id)}" alt="" loading="lazy"><em><i style="width:${mood(id) / MOOD_MAX * 100}%"></i></em></span>`).join('');
  for (let i = r.ops.length; i < max; i++) h += '<span class="bs-av vac"></span>';
  return h;
}
function summary(r) {
  const sp = speedOf(r), eff = `${Math.round(sp.s * 100)}%`;
  switch (r.t) {
    case 'MANUFACTURE': { const f = FM(r.rc), cap = RM.MANUFACTURE.cap[r.lv - 1]; return { t1: `${r.n * f.w}/${cap}`, p: Math.min(1, r.acc / f.cp), t2: r.lack ? '缺少原料' : `效率 ${eff}` }; }
    case 'TRADING': { const lim = RM.TRADING.lim[r.lv - 1]; return { t1: `订单 ${r.ords.length}/${lim}`, p: r.nx ? Math.min(1, r.acc / B.orderPts[r.nx]) : 0, t2: `效率 ${eff}` }; }
    case 'POWER': return { t1: `无人机 ${Math.floor(S.drone)}/${DRONE_MAX}`, p: S.drone / DRONE_MAX, t2: sp.n ? `+${f1(3 * sp.s)}/h` : '无人驻守' };
    case 'DORMITORY': { const rest = r.ops.filter(id => mood(id) < MOOD_MAX).length; return { t1: `休息中 ${rest}/${r.ops.length}`, p: r.ops.length ? r.ops.reduce((s, id) => s + mood(id), 0) / MOOD_MAX / r.ops.length : 0, t2: `平均心情` }; }
    case 'MEETING': return { t1: `信用 ${Math.floor(r.store)}/${CRED_CAP}`, p: r.store / CRED_CAP, t2: `效率 ${eff}` };
    case 'HIRE': return { t1: `联络 ${r.store}/3`, p: Math.min(1, r.acc / HIRE_H), t2: `效率 ${eff}` };
    case 'WORKSHOP': return { t1: sp.n ? '可加工' : '无人驻守', p: sp.n ? 1 : 0, t2: `副产物 +${Math.round(sumRoom(r, 'wk'))}%` };
    case 'CONTROL': { const cf = ctrlFx(); return { t1: `制造 +${cf.cp}%  贸易 +${cf.ct}%`, p: r.ops.length / phase(r).st, t2: `心情消耗 -${f1(cf.cm)}` }; }
  }
  return { t1: '', p: 0, t2: '' };
}
function icon(r) {
  if (r.t === 'MANUFACTURE') return `<img class="bs-pi" src="${itImg(FM(r.rc).it)}" alt="">`;
  if (r.t === 'TRADING') return `<img class="bs-pi" src="${itImg('4001')}" alt="">`;
  if (r.t === 'POWER') return '<svg class="bs-pi" viewBox="0 0 24 24"><path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>';
  if (r.t === 'MEETING') return `<img class="bs-pi" src="${itImg('7001')}" style="opacity:.0" alt=""><svg class="bs-pi" viewBox="0 0 24 24"><path fill="currentColor" d="M4 5h16v11H9l-5 4zm4 4v2h8V9z"/></svg>`;
  return '';
}
function roomCard(k, r) {
  const T = RM[r.t], ph = phase(r), s = summary(r), m = META[r.t];
  if (k === 'C') return `<div class="bs-room bs-ctrl${sel === 'C' ? ' on' : ''}" data-k="C" style="--c:${m.c}">
    <div class="bs-rh"><small>${m.en}</small><b>${T.n}</b><em>Lv.${r.lv}</em></div>
    <div class="bs-rb"><div class="bs-t1">${s.t1}</div><div class="bs-bar"><i style="width:${s.p * 100}%"></i></div><div class="bs-t2">${s.t2}</div></div>
    <div class="bs-ops">${avatars(r, ph.st)}</div></div>`;
  return `<div class="bs-room${sel === k ? ' on' : ''}" data-k="${k}" style="--c:${m.c}">
    <div class="bs-rh"><b>${roomName(k, r)}</b><em>Lv.${r.lv}</em><span class="bs-el ${ph.el > 0 ? 'p' : ''}">⚡${ph.el > 0 ? '+' : ''}${ph.el}</span></div>
    <div class="bs-rb">${icon(r)}<div class="bs-rt"><div class="bs-t1">${s.t1}</div><div class="bs-bar"><i style="width:${s.p * 100}%"></i></div><div class="bs-t2">${s.t2}</div></div></div>
    <div class="bs-ops">${avatars(r, ph.st)}</div><span class="bs-stripe"></span></div>`;
}
function renderMap() {
  $('#bsMap').innerHTML = roomCard('C', S.ctrl) + '<div class="bs-grid">' + S.slots.map((r, k) => r ? roomCard(k, r)
    : `<div class="bs-room bs-empty${sel === k ? ' on' : ''}" data-k="${k}"><div class="bs-plus">＋</div><small>空地 · 点击建造</small></div>`).join('') + '</div>';
}
function tickMap() {
  document.querySelectorAll('#bsMap .bs-room[data-k]').forEach(el => {
    const k = el.dataset.k === 'C' ? 'C' : +el.dataset.k, r = R(k); if (!r) return;
    const s = summary(r), a = el.querySelector('.bs-t1'); if (!a) return;
    a.textContent = s.t1; el.querySelector('.bs-t2').textContent = s.t2; el.querySelector('.bs-bar i').style.width = (s.p * 100) + '%';
    el.querySelectorAll('.bs-av[data-id]').forEach(v => { const m = mood(v.dataset.id); v.className = 'bs-av ' + moodCls(m); v.querySelector('i').style.width = (m / MOOD_MAX * 100) + '%'; });
  });
}
function renderStat() {
  const pw = power();
  $('#bsStat').innerHTML = `<span class="${pw.p < pw.u ? 'bad' : ''}" title="电力不足时,所有设施效率每缺 1 点 -1%">⚡ 电力 <b>${pw.p}</b> / ${pw.u}</span><span>无人机 <b id="bsDr">${Math.floor(S.drone)}</b>/${DRONE_MAX}</span><span>信用 <b>${Math.floor(S.credit)}</b></span><span class="dim">1 游戏小时 = 1 分钟</span>`;
}

/* ================= 渲染:详情 ================= */
const costHtml = items => items.length ? items.map(([id, c]) => `<span class="bs-cost${have(id) >= c ? '' : ' no'}" title="${esc(itName(id))}"><img src="${itImg(id)}" alt=""><b>${c}</b><small>${fmtN(have(id))}</small></span>`).join('') : '<span class="dim">无</span>';
function opRow(r, id) {
  const o = AK.op(id), m = mood(id), sk = skillsFor(id, r.t);
  return `<div class="bs-op" data-id="${id}"><img class="bs-ava" src="${AK.avatar(id)}" alt="" data-a="touch" title="点击互动">
    <div class="bs-oi"><div class="bs-on"><b>${esc(o.n)}</b><small>${AK.stars(o.r)}</small></div>
    <div class="bs-mood"><i data-l="mood:${id}" class="${moodCls(m)}" style="width:${m / MOOD_MAX * 100}%"></i></div><span class="bs-mt" data-l="moodt:${id}">心情 ${f1(m)}/${MOOD_MAX}</span>
    <div class="bs-sk">${sk.length ? sk.map(b => `<span class="bs-tag${b.c ? ' c' : ''}" title="${esc(b.d)}">${esc(b.n)}</span>`).join('') + `<p>${esc(sk[0].d)}</p>` : '<span class="dim">无本设施技能</span>'}</div></div>
    <button class="bs-x" data-a="out" title="移出">×</button></div>`;
}
function detailHtml(k) {
  if (k === null) {
    const rs = allRooms(), ops = rs.reduce((s, [, r]) => s + r.ops.length, 0), tired = Object.keys(S.mood).filter(id => mood(id) < 6).length, pw = power();
    return `<div class="iDet bs-d"><div class="bs-dh"><small>INFRASTRUCTURE</small><b>基建概览</b></div>
      <div class="bs-kv"><div><small>设施</small><b>${rs.length}</b></div><div><small>驻守干员</small><b>${ops}</b></div><div><small>疲劳干员</small><b>${tired}</b></div></div>
      <p class="bs-desc">点击左侧设施查看详情、更换干员、切换配方。<br>「智能排班」会按干员基建技能自动分配,并把疲劳干员送回宿舍;「收获全部」收取制造站产物、会客室信用、办公室联络,并用库存赤金交付贸易站订单。</p>
      <div class="hd2">电力</div><div class="pbar"><i style="width:${Math.min(100, pw.u ? pw.p / pw.u * 100 : 100)}%"></i></div>
      <p>供电 <b>${pw.p}</b>,耗电 <b>${pw.u}</b>${pw.p < pw.u ? `,缺口 ${pw.u - pw.p},所有设施效率 -${pw.u - pw.p}%` : ',供电充足。'}</p>
      <div class="note">说明:这是对原游戏基建的简化复刻。技能数值取自游戏数据并由描述文字解析,带条件的技能按 50% 保守折算;所有干员视为满级;训练室、回收站、活动室未实现。</div></div>`;
  }
  const r = R(k);
  if (!r) { // 空地:建造菜单
    return `<div class="iDet bs-d"><div class="bs-dh"><small>EMPTY LOT</small><b>空地</b></div><p class="bs-desc">选择要建造的设施。设施等级不能超过控制中枢等级。</p>` +
      TYPES.filter(t => t !== 'CONTROL').map(t => {
        const T = RM[t], n = count(t), ok = n < T.mx && afford(T.ph[0].it);
        return `<div class="bs-bd" style="--c:${META[t].c}"><div class="bs-bh"><b>${T.n}</b><small>已建 ${n}/${T.mx} · ⚡${T.ph[0].el > 0 ? '+' : ''}${T.ph[0].el} · 进驻 ${T.ph[0].st}</small></div><p>${esc(T.d)}</p>
        <div class="bs-bf"><div class="bs-costs">${costHtml(T.ph[0].it)}</div><button class="btn go" data-a="build" data-t="${t}"${ok ? '' : ' disabled'}>建造</button></div></div>`;
      }).join('') + '</div>';
  }
  const T = RM[r.t], ph = phase(r), m = META[r.t], sp = speedOf(r), pw = power();
  let h = `<div class="iDet bs-d" style="--c:${m.c}"><div class="bs-dh"><small>${m.en}</small><b>${roomName(k, r)}</b><em>Lv.${r.lv}</em></div><p class="bs-desc">${esc(T.d)}</p>
    <div class="bs-kv"><div><small>电力</small><b>${ph.el > 0 ? '+' : ''}${ph.el}</b></div><div><small>进驻</small><b>${r.ops.length}/${ph.st}</b></div><div><small>效率</small><b data-l="eff">${Math.round(sp.s * 100)}%</b></div></div>`;
  if (pw.pen < 1 && r.t !== 'POWER') h += `<div class="bs-warn">⚡ 电力缺口 ${pw.u - pw.p},效率 -${pw.u - pw.p}%</div>`;
  if (r.t === 'MANUFACTURE') {
    const f = FM(r.rc), cap = RM.MANUFACTURE.cap[r.lv - 1];
    h += `<div class="hd2">生产配方</div><div class="bs-rc">${B.manu.filter(x => x.lv <= r.lv).map(x => `<button class="bs-rcb${x.id === r.rc ? ' on' : ''}" data-a="rc" data-id="${x.id}" title="${x.co.length ? '消耗:' + x.co.map(([i, c]) => itName(i) + '×' + c).join(' ') : ''}"><img src="${itImg(x.it)}" alt=""><span>${esc(itName(x.it))}</span><small>${fmtH(x.cp / 3600 / Math.max(.01, sp.s || 1))}/件</small></button>`).join('')}</div>
      <div class="bs-prog"><div class="bs-bar"><i data-l="prog" style="width:${Math.min(1, r.acc / f.cp) * 100}%"></i></div><span data-l="progt">${r.lack ? '缺少原料' : '生产中'}</span></div>
      <div class="bs-line"><span>仓库 <b data-l="stock">${r.n * f.w}/${cap}</b>(${r.n * f.c} 件)</span><div><button class="btn go" data-a="collect"${r.n ? '' : ' disabled'}>收取</button><button class="btn alt" data-a="drone" title="消耗 10 架无人机,立即获得 ${10 * DRONE_H} 游戏小时产量">无人机 ×10</button></div></div>`;
  } else if (r.t === 'TRADING') {
    const lim = RM.TRADING.lim[r.lv - 1];
    h += `<div class="hd2">订单 <span data-l="ordn">${r.ords.length}/${lim}</span></div><div class="bs-ords">${r.ords.length ? r.ords.map(n => `<div class="bs-ord"><img src="${itImg('3003')}" alt=""><b>赤金 ×${n}</b><span>→</span><img src="${itImg('4001')}" alt=""><b>${n * B.gold}</b></div>`).join('') : '<div class="dim">暂无订单,等待客户上门…</div>'}</div>
      <div class="bs-prog"><div class="bs-bar"><i data-l="prog" style="width:${r.nx ? Math.min(1, r.acc / B.orderPts[r.nx]) * 100 : 0}%"></i></div><span>下一笔订单</span></div>
      <div class="bs-line"><span>库存赤金 <b>${fmtN(have('3003'))}</b></span><div><button class="btn go" data-a="collect"${r.ords.length ? '' : ' disabled'}>交付订单</button><button class="btn alt" data-a="drone">无人机 ×10</button></div></div>`;
  } else if (r.t === 'POWER') {
    h += `<div class="hd2">无人机</div><div class="bs-line"><span>充能速度 <b>${f1(3 * sp.s)}</b> /小时 · 储备 <b data-l="drn">${Math.floor(S.drone)}</b>/${DRONE_MAX}</span></div>
      <p class="bs-desc">无人机可在制造站或贸易站使用,每 10 架立即补足 ${10 * DRONE_H} 游戏小时的产量。发电站不受电力不足影响。</p>`;
  } else if (r.t === 'DORMITORY') {
    h += `<div class="hd2">休息</div><p class="bs-desc">每名干员基础恢复 <b>${f1(RM.DORMITORY.rec[r.lv - 1] / 100)}</b> 心情/小时,另加干员技能。心情恢复满的干员可在智能排班时被换出。</p>`;
  } else if (r.t === 'MEETING') {
    h += `<div class="hd2">接待信用</div><div class="bs-prog"><div class="bs-bar"><i data-l="prog" style="width:${r.store / CRED_CAP * 100}%"></i></div><span data-l="progt">${Math.floor(r.store)}/${CRED_CAP}</span></div>
      <div class="bs-line"><span>已有信用 <b>${Math.floor(S.credit)}</b></span><button class="btn go" data-a="collect"${r.store >= 1 ? '' : ' disabled'}>收取信用</button></div>
      <div class="hd2">信用交易所</div><div class="bs-offers">${OFFERS.map(([id, c, cost], i) => `<div class="bs-offer"><img src="${itImg(id)}" alt=""><b>${esc(itName(id))} ×${c}</b><button class="btn ${S.credit >= cost ? 'go' : 'alt'}" data-a="buy" data-i="${i}">${cost} 信用</button></div>`).join('')}</div>`;
  } else if (r.t === 'HIRE') {
    h += `<div class="hd2">人脉联络</div><div class="bs-prog"><div class="bs-bar"><i data-l="prog" style="width:${Math.min(1, r.acc / HIRE_H) * 100}%"></i></div><span>每 ${HIRE_H} 游戏小时 1 份</span></div>
      <div class="bs-line"><span>待收取 <b>${r.store}</b>/3 份招聘许可</span><button class="btn go" data-a="collect"${r.store ? '' : ' disabled'}>收取</button></div>`;
  } else if (r.t === 'WORKSHOP') {
    const fs = B.work.filter(x => x.lv <= r.lv && x.ty !== 'F_EVOLVE').concat(B.work.filter(x => x.lv <= r.lv && x.ty === 'F_EVOLVE'));
    h += `<div class="hd2">加工 · 副产物概率 ${Math.round((fs.length ? 0 : 0) + sumRoom(r, 'wk'))}%+</div><p class="bs-desc">需要至少 1 名干员进驻;每次加工消耗材料与龙门币,并有概率额外获得副产物。</p><div class="bs-wk">` +
      fs.map(x => { const ok = afford(x.co) && have('4001') >= x.g && sp.n > 0; return `<div class="bs-wf"><img src="${itImg(x.it)}" alt=""><div><b>${esc(itName(x.it))} ×${x.c}</b><small>${WTY[x.ty] || ''} · 龙门币 ${x.g}</small><div class="bs-costs">${costHtml(x.co)}</div></div><button class="btn ${ok ? 'go' : 'alt'}" data-a="craft" data-id="${x.id}"${ok ? '' : ' disabled'}>加工</button></div>`; }).join('') + '</div>';
  } else if (r.t === 'CONTROL') {
    const cf = ctrlFx();
    h += `<div class="hd2">全局加成</div><div class="bs-kv"><div><small>制造站生产力</small><b>+${cf.cp}%</b></div><div><small>贸易站订单效率</small><b>+${cf.ct}%</b></div><div><small>全员心情消耗</small><b>-${f1(cf.cm)}</b></div></div>`;
  }
  h += `<div class="hd2">进驻干员</div><div class="bs-staff">${r.ops.map(id => opRow(r, id)).join('')}${r.ops.length < ph.st ? `<button class="bs-add" data-a="pick">＋ 进驻干员(${r.ops.length}/${ph.st})</button>` : ''}</div>`;
  // 升级 / 拆除
  const mx = T.ph.length;
  h += '<div class="hd2">设施</div>';
  if (r.lv >= mx) h += '<p class="dim">已升至最高等级。</p>';
  else {
    const items = T.ph[r.lv].it, capOk = k === 'C' || r.lv < ctrlLv(), ok = capOk && afford(items), nx = T.ph[r.lv];
    h += `<div class="bs-up"><div>升至 <b>Lv.${r.lv + 1}</b> · ⚡${nx.el > 0 ? '+' : ''}${nx.el} · 进驻 ${nx.st}${T.cap ? ' · 仓库 ' + T.cap[r.lv] : ''}${T.lim ? ' · 订单 ' + T.lim[r.lv] : ''}</div><div class="bs-costs">${costHtml(items)}</div>
      ${capOk ? '' : '<div class="bs-warn">需先提升控制中枢等级</div>'}<button class="btn go" data-a="up"${ok ? '' : ' disabled'}>升级</button></div>`;
  }
  if (k !== 'C') h += '<div class="btns"><button class="btn alt" data-a="demo">拆除设施</button></div>';
  return h + '</div>';
}
let lastSig = '';
const sigOf = k => { const r = k === null ? null : R(k); return k + '|' + (r ? [r.lv, r.ops.join(), r.n, r.ords.join(), r.rc, r.store, Math.floor(S.credit), r.lack, power().pen < 1].join() : S.slots.map(x => x ? x.t : '-').join('')); };
function renderDetail() {
  const box = $('#bsDet'), sc = box.querySelector('.iDet'), top = sc ? sc.scrollTop : 0;
  box.innerHTML = detailHtml(sel); const n = box.querySelector('.iDet'); if (n) n.scrollTop = top; lastSig = sigOf(sel);
}
function liveDetail() {
  const r = sel === null ? null : R(sel); if (!r) return;
  if (sigOf(sel) !== lastSig) { renderDetail(); return; }
  const box = $('#bsDet'), set = (k, fn) => box.querySelectorAll(`[data-l="${k}"]`).forEach(fn);
  const sp = speedOf(r); set('eff', e => e.textContent = Math.round(sp.s * 100) + '%');
  const s = summary(r); set('prog', e => e.style.width = (s.p * 100) + '%');
  if (r.t === 'MANUFACTURE') { const f = FM(r.rc); set('stock', e => e.textContent = `${r.n * f.w}/${RM.MANUFACTURE.cap[r.lv - 1]}`); }
  if (r.t === 'POWER') set('drn', e => e.textContent = Math.floor(S.drone));
  if (r.t === 'MEETING') set('progt', e => e.textContent = `${Math.floor(r.store)}/${CRED_CAP}`);
  r.ops.forEach(id => { const m = mood(id); set('mood:' + id, e => { e.style.width = (m / MOOD_MAX * 100) + '%'; e.className = moodCls(m); }); set('moodt:' + id, e => e.textContent = `心情 ${f1(m)}/${MOOD_MAX}`); });
}
function renderAll() { renderStat(); renderMap(); renderDetail(); dot(); }

/* ================= 选人面板 ================= */
const P = { k: null, q: '', only: true, tired: false };
function openPick(k) { P.k = k; P.q = ''; renderPick(); $('#bsPick').classList.add('on'); const i = $('#bpQ'); if (i) { i.value = ''; i.focus(); } }
function closePick() { $('#bsPick').classList.remove('on'); P.k = null; }
function renderPick() {
  const r = R(P.k); if (!r) { closePick(); return; }
  const q = P.q.trim().toLowerCase();
  let list = AK.OPS.map(o => ({ o, s: score(o.id, r), has: skillsFor(o.id, r.t).length > 0 }));
  if (P.only) list = list.filter(x => x.has);
  if (P.tired) list = list.filter(x => mood(x.o.id) >= 8);
  if (q) list = list.filter(x => x.o.n.toLowerCase().includes(q) || (x.o.e || '').toLowerCase().includes(q));
  list.sort((a, b) => b.s - a.s || b.o.r - a.o.r);
  const total = list.length; list = list.slice(0, 120);
  const box = $('#bsPick');
  if (!box.firstElementChild) box.innerHTML = `<div class="bp-bd" data-a="pclose"></div><div class="bp-box"><div class="bp-h"><b id="bpT"></b><span id="bpN"></span><input class="search" id="bpQ" placeholder="搜索干员名称" autocomplete="off"><label class="tg"><input type="checkbox" id="bpOnly"> 仅有本设施技能</label><label class="tg"><input type="checkbox" id="bpTired"> 排除疲劳</label><button class="so-x" data-a="pclose">×</button></div><div class="bp-g" id="bpG"></div></div>`;
  $('#bpT').textContent = `${roomName(P.k, r)} · 选择进驻干员`; $('#bpN').textContent = `${r.ops.length}/${phase(r).st} · 共 ${total} 人${total > 120 ? '(显示前 120)' : ''}`;
  $('#bpOnly').checked = P.only; $('#bpTired').checked = P.tired;
  $('#bpG').innerHTML = list.map(({ o, has }) => {
    const here = r.ops.includes(o.id), lc = locName(o.id), m = mood(o.id), sk = skillsFor(o.id, r.t);
    return `<div class="bp-c${here ? ' here' : ''}" data-id="${o.id}" style="--rc:${AK.RC[Math.min(o.r, 5)]}"><img src="${AK.avatar(o.id)}" alt="" loading="lazy"><div class="bp-i"><b>${esc(o.n)}</b><small>${AK.stars(o.r)}${lc ? ` · <em>${esc(lc)}</em>` : ''}</small>
      <div class="bs-mood"><i class="${moodCls(m)}" style="width:${m / MOOD_MAX * 100}%"></i></div>
      <p>${sk.length ? esc(sk.map(b => b.n).join(' / ')) + '：' + esc(sk[0].d.replace(/^进驻[^，]*时，/, '')) : '<span class="dim">无本设施技能</span>'}</p></div>${here ? '<span class="bp-ok">✓ 已进驻</span>' : ''}</div>`;
  }).join('') || '<div class="empty">没有符合条件的干员</div>';
}

/* ================= 事件 ================= */
function init() {
  inited = true;
  $('#bsMap').addEventListener('click', e => {
    const av = e.target.closest('.bs-av[data-id]'); if (av) { touch(av.dataset.id); }
    const c = e.target.closest('.bs-room'); if (!c) return; const k = c.dataset.k === 'C' ? 'C' : +c.dataset.k;
    sel = k; document.querySelectorAll('#bsMap .bs-room').forEach(x => x.classList.toggle('on', x === c)); renderDetail();
  });
  $('#bsDet').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, r = sel === null ? null : R(sel);
    if (a === 'build') { build(sel, b.dataset.t); renderAll(); }
    else if (!r) return;
    else if (a === 'pick') openPick(sel);
    else if (a === 'out') { unassign(b.closest('.bs-op').dataset.id); AK.save(); renderAll(); }
    else if (a === 'touch') touch(b.closest('.bs-op').dataset.id);
    else if (a === 'rc') { if (r.n > 0 && b.dataset.id !== r.rc) { AK.toast('请先收取仓库里的产物再切换配方'); return; } if (b.dataset.id !== r.rc) { r.rc = b.dataset.id; r.acc = 0; AK.save(); renderAll(); } }
    else if (a === 'collect') collectRoom(r, r.t === 'TRADING' ? '订单报酬' : '基建收获');
    else if (a === 'drone') useDrone(sel, 10);
    else if (a === 'buy') buy(+b.dataset.i);
    else if (a === 'craft') craft(r, b.dataset.id, e.shiftKey ? 5 : 1);
    else if (a === 'up') { upgrade(sel); renderAll(); }
    else if (a === 'demo') { demolish(sel); renderAll(); }
  });
  $('#bsPick').addEventListener('click', e => {
    if (e.target.closest('[data-a="pclose"]')) { closePick(); return; }
    const c = e.target.closest('.bp-c'); if (!c) return; const id = c.dataset.id, r = R(P.k);
    if (r.ops.includes(id)) { unassign(id); AK.save(); }
    else if (!assign(P.k, id)) return;
    renderPick(); renderAll(); if (phase(r).st <= r.ops.length) closePick();
  });
  $('#bsPick').addEventListener('input', e => { if (e.target.id === 'bpQ') { P.q = e.target.value; renderPick(); const i = $('#bpQ'); i.focus(); i.setSelectionRange(P.q.length, P.q.length); } });
  $('#bsPick').addEventListener('change', e => { if (e.target.id === 'bpOnly') { P.only = e.target.checked; renderPick(); } else if (e.target.id === 'bpTired') { P.tired = e.target.checked; renderPick(); } });
  $('#bsAuto').addEventListener('click', autoShift);
  $('#bsAll').addEventListener('click', collectAll);
  AK.sub('inv', () => { if (AK.view() === 'base') { renderStat(); if (sel !== null && R(sel) && R(sel).t === 'WORKSHOP') renderDetail(); } });
}

/* ================= 红点 / 循环 ================= */
function readyN() {
  let n = 0; allRooms().forEach(([, r]) => {
    if (r.t === 'MANUFACTURE' && r.n > 0) n++; else if (r.t === 'TRADING' && r.ords.length && have('3003') >= r.ords[0]) n++;
    else if (r.t === 'MEETING' && r.store >= 100) n++; else if (r.t === 'HIRE' && r.store > 0) n++;
  }); return n;
}
function dot() { const d = $('#bsDot'); if (!d) return; const n = readyN(); d.classList.toggle('on', n > 0); d.textContent = n > 9 ? '9+' : n || ''; }
setInterval(() => {
  tick(); dot();
  if (AK.view() === 'base' && inited) { renderStat(); tickMap(); liveDetail(); if ($('#bsPick').classList.contains('on')) { /* 选人面板不自动刷新,避免打断操作 */ } }
}, 1000);
AK.base = { count, ready: readyN, state: S, assign, autoShift, tick };
AK.enter.base = () => { if (!inited) init(); tick(); sel = sel !== null && (sel === 'C' || R(sel) !== undefined) ? sel : null; renderAll(); };
tick(); dot();
})();

