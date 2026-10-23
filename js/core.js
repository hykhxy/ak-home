/* core.js — 共享状态 / 存档 / 任务事件 / 语音引擎 / 奖励弹窗。先于 app.js 加载。 */
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const OPS = window.OPS || [], ITEMS = window.ITEMS || [], VOICES = window.VOICES || {}, CVS = window.CVS || {}, MIS = window.MISSIONS || {};
const AK = window.AK = { OPS, ITEMS, VOICES, CVS, MIS, enter: {}, on: {}, muted: () => false };

/* ---------- 常量 / 小工具 ---------- */
AK.RC = ['#b0b0b0', '#9ad24c', '#18b6f2', '#c78bf0', '#f7c33c', '#ff7a1a'];
AK.RN = ['白', '绿', '蓝', '紫', '金', '橙'];
AK.PROF = { PIONEER: '先锋', WARRIOR: '近卫', TANK: '重装', SNIPER: '狙击', CASTER: '术师', MEDIC: '医疗', SUPPORT: '辅助', SPECIAL: '特种' };
AK.POS = { MELEE: '近战位', RANGED: '远程位', ALL: '全域' };
AK.TITLES = { squad: ['编队', 'SQUAD'], task: ['任务', 'MISSION'], voice: ['角色语音', 'VOICE'], base: ['基建', 'INFRASTRUCTURE'], event: ['活动', 'EVENT'], char: ['创造角色', 'CREATE CHARACTER'], gacha: ['干员寻访', 'HEADHUNTING'] };
AK.esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
AK.stars = r => '★'.repeat(r + 1);
AK.sleep = ms => new Promise(r => setTimeout(r, ms));
AK.p2 = n => String(n).padStart(2, '0');
const opMap = new Map(OPS.map((o, i) => [o.id, i])), itemMap = new Map(ITEMS.map(i => [i.id, i]));
AK.opIdx = id => opMap.has(id) ? opMap.get(id) : -1;
AK.op = id => OPS[opMap.get(id)];
AK.item = id => itemMap.get(String(id));
AK.avatar = id => `assets/avatar/${id}.png`;
AK.portrait = id => `assets/portrait/${id}.png`;
AK.chipRow = (host, items, onPick, init) => {
  const h = typeof host === 'string' ? $(host) : host;
  items.forEach(([val, label]) => {
    const b = document.createElement('button'); b.className = 'chip' + (val === init ? ' on' : ''); b.textContent = label; b.dataset.v = val;
    b.addEventListener('click', () => { h.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b)); onPick(val); });
    h.appendChild(b);
  });
};
const hashStr = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
AK.hash = hashStr;

/* ---------- 事件总线 ---------- */
const L = {};
AK.sub = (n, f) => (L[n] = L[n] || []).push(f);
AK.emit = (n, a) => (L[n] || []).forEach(f => { try { f(a); } catch (e) { console.error(e); } });

/* ---------- 存档 ---------- */
const KEY = 'ak.state.v2';
function defaultSquads() {
  const ids = [], used = new Set();
  const pick = o => { if (o && !used.has(o.id) && ids.length < 12) { used.add(o.id); ids.push(o.id); } };
  pick(OPS.find(o => o.id === 'char_002_amiya'));
  for (const p of ['PIONEER', 'WARRIOR', 'TANK', 'SNIPER', 'CASTER', 'MEDIC', 'SUPPORT', 'SPECIAL']) pick(OPS.find(o => o.p === p && o.r === 4 && !used.has(o.id)) || OPS.find(o => o.p === p && !used.has(o.id)));
  while (ids.length < 12) ids.push(null);
  return [0, 1, 2, 3].map(i => ({ name: `第 ${i + 1} 队`, ids: i === 0 ? ids.slice() : Array(12).fill(null) }));
}
const def = () => ({
  v: 2, san: { v: 128, t: Date.now() }, inv: {}, team: 0, squads: defaultSquads(), stage: 'R-07', assist: false,
  mission: { dk: '', wk: '', daily: {}, weekly: {}, perm: {}, claimed: {}, pts: { daily: 0, weekly: 0 }, ptc: { daily: [], weekly: [] } },
  tts: { on: false, rate: 1, pitch: 1, voice: '', lang: 'CN' }, stats: { sorties: 0, kills: 0 },
});
let st;
try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { st = null; }
const base = def();
st = st && st.v === 2 ? Object.assign(base, st, { mission: Object.assign(base.mission, st.mission || {}), tts: Object.assign(base.tts, st.tts || {}) }) : base;
// 清理已不存在的干员
st.squads.forEach(s => { s.ids = (s.ids || []).slice(0, 12).map(id => (id && opMap.has(id)) ? id : null); while (s.ids.length < 12) s.ids.push(null); });
AK.st = st;
let sv = 0;
AK.save = () => { clearTimeout(sv); sv = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }, 200); };
AK.resetAll = () => { localStorage.removeItem(KEY); location.reload(); };

/* ---------- 理智 / 库存 ---------- */
const SAN_MAX = 135, SAN_MS = 6 * 60 * 1000;
AK.SAN_MAX = SAN_MAX;
AK.san = () => Math.min(SAN_MAX, st.san.v + Math.floor((Date.now() - st.san.t) / SAN_MS));
AK.spendSan = n => { const c = AK.san(); if (c < n) return false; st.san = { v: c - n, t: Date.now() }; AK.save(); AK.emit('san'); return true; };
function qtyBase(it) {
  if (it.y === 'GOLD') return 1284560; if (it.y === 'DIAMOND') return 1250; if (it.y === 'DIAMOND_SHD') return 8800;
  const b = [2400, 1200, 600, 220, 80, 30][it.r] || 30;
  return 1 + hashStr(it.id) % b;
}
AK.qty = it => qtyBase(it) + (st.inv[it.id] || 0);
AK.addItem = (id, n) => { st.inv[id] = (st.inv[id] || 0) + n; AK.save(); AK.emit('inv'); };

/* ---------- 任务事件 ---------- */
const shift = (t = Date.now()) => new Date(t - 4 * 3600e3);
const dayKey = d => `${d.getFullYear()}-${AK.p2(d.getMonth() + 1)}-${AK.p2(d.getDate())}`;
const weekKey = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dayKey(x); };
AK.isWeekend = () => { const g = shift().getDay(); return g === 0 || g === 6; };
AK.nextReset = () => {
  const n = new Date(), d = new Date(n); d.setHours(4, 0, 0, 0); if (d <= n) d.setDate(d.getDate() + 1);
  const w = new Date(n); w.setHours(4, 0, 0, 0); w.setDate(w.getDate() + ((8 - w.getDay()) % 7 || 7)); if (w <= n) w.setDate(w.getDate() + 7);
  // 距离下个周一 04:00
  const wk = new Date(n); wk.setHours(4, 0, 0, 0); let add = (1 - wk.getDay() + 7) % 7; if (add === 0 && wk <= n) add = 7; wk.setDate(wk.getDate() + add);
  return { daily: d - n, weekly: wk - n };
};
AK.rollover = () => {
  const m = st.mission, g = shift(), dk = dayKey(g), wk = weekKey(g);
  if (m.dk !== dk) {
    m.dk = dk; m.daily = {}; m.pts.daily = 0; m.ptc.daily = [];
    Object.keys(m.claimed).forEach(k => { if (k.startsWith('daily:')) delete m.claimed[k]; });
  }
  if (m.wk !== wk) {
    m.wk = wk; m.weekly = {}; m.pts.weekly = 0; m.ptc.weekly = [];
    Object.keys(m.claimed).forEach(k => { if (k.startsWith('weekly:')) delete m.claimed[k]; });
  }
};
AK.rollover();
const EVT = [
  [/单次作战达到\d+歼灭数/, 'maxkill'], [/击败.*?敌方领袖|歼灭.*?敌方领袖/, 'boss'], [/累计歼灭任意\d+名敌兵/, 'kill'], [/好友助战/, 'assist'],
  [/^通关任意关卡|通关任意关卡\d+次$/, 'stage'], [/干员强化/, 'upgrade'], [/信用商店中购买/, 'shop'],
  [/信用点/, 'creditpt'], [/制造站生产\d+件(?:基础|初级|中级|高级)?作战记录/, 'prodexp'], [/制造站生产\d+件赤金/, 'prodgold'],
  [/收取.*?信用/, 'credit'], [/公开招募/, 'recruit'], [/增加信赖/, 'trust'], [/收取.*制造站/, 'manu'],
  [/订单/, 'order'], [/宿舍中恢复心情/, 'dorm'], [/访问.*好友的基建/, 'visit'],
];
const STAGE_RE = /通关(?:主线|标准实战环境)?([A-Za-z]*\d*-\d+)/;
AK.evtOf = m => {
  if (m._e) return m._e;
  let e = null;
  const hv = /拥有(?:至少)?(\d+)间Lv\.(\d)的(制造站|贸易站|发电站|会客室|加工站|办公室)/.exec(m.d);
  if (hv) return m._e = `have:${{ 制造站: 'MANUFACTURE', 贸易站: 'TRADING', 发电站: 'POWER', 会客室: 'MEETING', 加工站: 'WORKSHOP', 办公室: 'HIRE' }[hv[3]]}:${hv[2]}`;
  const sm = STAGE_RE.exec(m.d);
  if (sm && /^(CompleteMainStage|CompleteStage|CompleteAnyStage)$/.test(m.t) && !/任意/.test(m.d)) e = 'stage:' + sm[1];
  if (!e) for (const [re, k] of EVT) if (re.test(m.d)) { e = k; break; }
  return m._e = e || 'manual';
};
AK.EVT_NAME = { stage: '通关关卡', boss: '击败领袖', kill: '歼灭敌兵', assist: '好友助战', upgrade: '干员强化', shop: '信用商店购买', credit: '收取信用', recruit: '公开招募', trust: '基建互动', manu: '收取制造产物', order: '完成订单', dorm: '宿舍恢复心情', visit: '访问好友基建', creditpt: '收取信用点', prodgold: '生产赤金', prodexp: '生产作战记录' };
AK.event = (evt, n = 1) => {
  AK.rollover(); const m = st.mission;
  for (const sc of ['daily', 'weekly', 'perm']) m[sc][evt] = evt === 'maxkill' ? Math.max(m[sc][evt] || 0, n) : (m[sc][evt] || 0) + n;
  AK.save(); AK.emit('mission');
};
/** 任务目标值(单次歼灭类取描述里的数字) */
AK.target = m => { if (AK.evtOf(m) === 'maxkill') { const x = /达到(\d+)歼灭/.exec(m.d); return x ? +x[1] : m.n; } return m.n || 1; };
/** 任务当前进度 scope: daily|weekly|perm */
AK.prog = (scope, m) => {
  const e = AK.evtOf(m), s = st.mission[scope] || {};
  if (e.startsWith('have:')) { const [, t, lv] = e.split(':'); return Math.min(AK.target(m), AK.base ? AK.base.count(t, +lv) : 0); }
  return Math.min(AK.target(m), (e === 'manual' ? s['m:' + m.id] : s[e]) || 0);
};
AK.manualAdvance = (scope, m) => { // 演示:无法自动推进的任务,一键补满
  const e = AK.evtOf(m), need = AK.target(m) - AK.prog(scope, m); if (need <= 0 || e.startsWith('have:')) return;
  if (e === 'manual') { const s = st.mission[scope]; s['m:' + m.id] = AK.target(m); AK.save(); AK.emit('mission'); }
  else AK.event(e, e === 'maxkill' ? AK.target(m) : need);
};

/* ---------- 全屏舞台内的覆盖层容器 ---------- */
const stageEl = $('#stage');
const mk = (cls, html, id) => { const d = document.createElement('div'); if (id) d.id = id; d.className = cls; d.innerHTML = html; stageEl.appendChild(d); return d; };

/* ---------- 奖励弹窗 ---------- */
const rwPop = mk('', '', 'rwPop');
AK.grant = (list, title = '获得物资', silent = false) => {
  const merged = new Map();
  list.forEach(([t, id, c]) => merged.set(String(id), (merged.get(String(id)) || 0) + c));
  const rows = [];
  merged.forEach((c, id) => { const it = AK.item(id); if (!it) return; AK.addItem(id, c); rows.push([it, c]); });
  if (silent || !rows.length) return rows;
  rwPop.innerHTML = `<div class="rw-box"><div class="rw-h">${AK.esc(title)}<small>ITEMS ACQUIRED</small></div><div class="rw-g">${rows.map(([it, c], i) => `<div class="rw-i" style="--rc:${AK.RC[Math.min(it.r, 5)]};--i:${i}"><img src="assets/item/${it.i}.png" alt=""><b>×${c.toLocaleString()}</b><span>${AK.esc(it.n)}</span></div>`).join('')}</div><div class="rw-f">点击任意处关闭</div></div>`;
  rwPop.classList.add('on'); AK.beep && AK.beep(600, 1400, .18, 'triangle', .05);
  const close = () => { rwPop.classList.remove('on'); rwPop.removeEventListener('click', close); };
  setTimeout(() => rwPop.addEventListener('click', close), 350);
  return rows;
};

/* ---------- 语音引擎 ---------- */
const sayBox = mk('', '<img alt=""><div class="sb-b"><div class="sb-n"></div><div class="sb-t"></div></div>', 'sayBox');
let sayTimer = 0;
const vox = AK.vox = (() => {
  const pack = new Map();
  let timer = 0, audio = null, rid = 0, level = 0, ctx = null, an = null, srcNode = null, data = null, active = null;
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const stop = () => {
    clearInterval(timer); timer = 0; rid++;
    if (audio) { audio.pause(); audio.onended = null; audio = null; }
    if (synth) try { synth.cancel(); } catch (e) {}
    level = 0; const a = active; active = null; if (a && a.onStop) a.onStop();
  };
  function ensureCtx() {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); an = ctx.createAnalyser(); an.fftSize = 512; data = new Uint8Array(an.fftSize); an.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function ttsVoice() { if (!synth) return null; const vs = synth.getVoices(); return vs.find(v => v.name === st.tts.voice) || vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null; }
  AK.ttsVoices = () => synth ? synth.getVoices().filter(v => /^zh/i.test(v.lang)) : [];
  /* ---- 游戏原声:整合语音 .ogg + VCLIPS 切片(WebAudio 解码后按起止时间播放) ---- */
  const CL = window.VCLIPS || {}, bufs = new Map(); let gn = null, curSrc = null;
  const clipOf = (opId, vid, lang) => { const lg = lang || st.tts.lang; if (!lg || lg === 'off') return null; const c = CL[opId] && CL[opId][lg] && CL[opId][lg][vid]; return c ? { lg, s: c[0], e: c[1] } : null; };
  /* 线上部署时语音不随站点托管(约1.5GB):依次尝试本地 assets/voice → jsDelivr 多线路(isHarryh/Ark-Voice,CORS 开放) */
  const VOICE_DIR = { JP: 'voice', CN: 'voice_cn' };
  const VOICE_HOSTS = ['fastly.jsdelivr.net', 'quantil.jsdelivr.net', 'testingcf.jsdelivr.net', 'cdn.jsdelivr.net'];
  let hostPref = 0;
  async function fetchTry(url, ms) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
    try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error(r.status); return await r.arrayBuffer(); } finally { clearTimeout(t); }
  }
  async function fetchVoice(opId, lg) {
    const L = lg.toUpperCase(), isLocalHost = /^(localhost|127\.|\[::1\]|192\.168\.|10\.)/.test(location.hostname) || location.protocol === 'file:';
    if (isLocalHost) { try { return await fetchTry(`assets/voice/${L.toLowerCase()}/${opId}.ogg`, 15000); } catch (e) { /* 回退线上 */ } }
    const path = `/gh/isHarryh/Ark-Voice@79584841f7a28f9d029ec2dc1b72444bce87eb1e/${VOICE_DIR[L]}/${opId}.ogg`;
    for (let i = 0; i < VOICE_HOSTS.length; i++) {
      const h = VOICE_HOSTS[(hostPref + i) % VOICE_HOSTS.length];
      try { const ab = await fetchTry('https://' + h + path, 30000); hostPref = (hostPref + i) % VOICE_HOSTS.length; return ab; } catch (e) { /* 下一条线路 */ }
    }
    throw new Error('voice unavailable');
  }
  function getBuf(opId, lg) {
    const k = lg + '/' + opId; if (bufs.has(k)) { const v = bufs.get(k); bufs.delete(k); bufs.set(k, v); return v; }
    const pr = fetchVoice(opId, lg).then(ab => ctx.decodeAudioData(ab));
    pr.catch(() => bufs.delete(k)); bufs.set(k, pr);
    while (bufs.size > 6) bufs.delete(bufs.keys().next().value);
    return pr;
  }
  /** line = [title,text,cat,place,voiceId]. o: {quiet, onTick(p), onEnd(), onStart(kind)} */
  function play(opId, line, o = {}) {
    stop(); const my = rid; const text = line[1], vid = line[4];
    const file = pack.get(opId + '/' + vid);
    const clip = !file && clipOf(opId, vid, o.lang);
    const canTts = st.tts.on && synth && !AK.muted();
    const kind = file ? 'file' : clip ? 'game' : canTts ? 'tts' : (o.quiet ? null : 'blip');
    if (!kind) return null;
    const t0 = performance.now(), rate = st.tts.rate || 1;
    let est = Math.max(1100, text.length * (kind === 'blip' ? 105 : 240) / rate), p = 0, last = -1, finished = false, g0 = 0, gdur = 0;
    if (clip) { gdur = clip.e - clip.s; est = gdur * 1000 + 600; }
    const fin = () => { if (finished || my !== rid) return; finished = true; clearInterval(timer); timer = 0; level = 0; active = null; curSrc = null; o.onTick && o.onTick(1); o.onEnd && o.onEnd(); };
    active = { onStop: () => { if (curSrc) { try { curSrc.onended = null; curSrc.stop(); } catch (e) {} curSrc = null; } o.onStop && o.onStop(); } };
    o.onStart && o.onStart(kind);
    const base = 190 + (hashStr(opId) % 260);
    if (kind === 'game') {
      ensureCtx(); if (!gn) { gn = ctx.createGain(); gn.connect(an); }
      gn.gain.value = AK.muted() ? 0 : 1;
      getBuf(opId, clip.lg).then(buf => {
        if (my !== rid) return;
        const src = ctx.createBufferSource(); src.buffer = buf; src.connect(gn); curSrc = src; src.onended = () => { if (my === rid) fin(); };
        const go = () => { if (my !== rid) return; g0 = performance.now(); src.start(0, clip.s, Math.max(.2, gdur)); };
        if (ctx.state === 'running') go(); else ctx.resume().then(go).catch(go);
      }).catch(() => { if (my !== rid) return; fin(); });
    } else if (kind === 'file') {
      try {
        ensureCtx(); audio = new Audio(URL.createObjectURL(file)); const node = ctx.createMediaElementSource(audio); node.connect(an);
        audio.onended = fin; audio.onerror = fin; audio.play().catch(fin);
      } catch (e) { fin(); }
    } else if (kind === 'tts') {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-CN'; u.rate = rate; u.pitch = st.tts.pitch || 1;
      const v = ttsVoice(); if (v) u.voice = v;
      u.onboundary = e => { if (e.charIndex != null) p = Math.max(p, e.charIndex / text.length); };
      u.onend = fin; u.onerror = fin; synth.speak(u);
    }
    timer = setInterval(() => {
      if (my !== rid) return;
      const t = performance.now() - t0;
      if (kind === 'game') p = g0 ? Math.min(.99, (performance.now() - g0) / 1000 / gdur) : 0;
      else if (kind === 'file' && audio && audio.duration) p = audio.currentTime / audio.duration;
      else if (kind === 'blip') p = Math.min(1, t / est);
      else p = Math.max(p, Math.min(.97, t / est));
      if (kind === 'game' && t > 12000 && !g0) { fin(); return; }
      if ((kind === 'file' || kind === 'game') && an) { an.getByteTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) { const x = (data[i] - 128) / 128; s += x * x; } level = Math.min(1, Math.sqrt(s / data.length) * 4); }
      else level = (.25 + .75 * Math.abs(Math.sin(t / 70) * Math.sin(t / 233))) * (p < 1 ? 1 : 0);
      const ci = Math.floor(p * text.length);
      if (kind === 'blip' && ci !== last && ci % 2 === 0 && ci < text.length) { const f = base + (text.charCodeAt(ci) % 9) * 38; AK.beep && AK.beep(f, f * 1.06, .045, 'square', .012); }
      last = ci; o.onTick && o.onTick(p);
      if (kind === 'blip' && p >= 1) fin();
    }, 33);
    return { kind, stop };
  }
  return {
    play, stop, level: () => level, isPlaying: () => !!active,
    loadPack(files) {
      let n = 0;
      [...files].forEach(f => {
        const parts = (f.webkitRelativePath || f.name).split('/'); const m = /^(.+)\.(wav|mp3|ogg|m4a|flac)$/i.exec(parts[parts.length - 1]);
        if (!m) return; let cid = parts.length >= 2 ? parts[parts.length - 2] : '';
        if (!opMap.has(cid)) { const mm = /^(char_[^_]+_[^_]+(?:_[^_]+)*?)_(CN_\d+|JP_\d+|\w+_\d+)$/.exec(m[1]); if (mm && opMap.has(mm[1])) { cid = mm[1]; pack.set(cid + '/' + mm[2], f); n++; } return; }
        pack.set(cid + '/' + m[1], f); n++;
      });
      return n;
    },
    packSize: () => pack.size,
    has: (opId, vid) => pack.has(opId + '/' + vid) || !!clipOf(opId, vid),
    clip: clipOf,
    langsOf: opId => Object.keys(CL[opId] || {}),
    preload: (opId, lg) => { lg = lg || st.tts.lang; if (!lg || lg === 'off' || !(CL[opId] && CL[opId][lg])) return null; try { ensureCtx(); return getBuf(opId, lg).catch(() => {}); } catch (e) { return null; } },
  };
})();
AK.line = (opId, title) => {
  const arr = (VOICES[opId] || []).filter(l => l[0] === title || l[0].startsWith(title));
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
};
/** 在舞台底部弹出干员台词气泡并发声 */
AK.say = (opId, line, o = {}) => {
  const op = AK.op(opId); if (!op || !line) return;
  sayBox.querySelector('img').src = AK.avatar(opId);
  sayBox.querySelector('.sb-n').textContent = `${op.n} · ${line[0]}`;
  const tx = sayBox.querySelector('.sb-t'); tx.textContent = ''; sayBox.classList.add('on'); clearTimeout(sayTimer);
  const text = line[1];
  const hide = () => { sayTimer = setTimeout(() => sayBox.classList.remove('on'), 1800); };
  const r = vox.play(opId, line, { onTick: p => { tx.textContent = text.slice(0, Math.ceil(p * text.length)); }, onEnd: () => { tx.textContent = text; hide(); } });
  if (!r) { tx.textContent = text; hide(); }
};
})();
