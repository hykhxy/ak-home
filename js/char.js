/* char.js — 「创造角色」:扮演原著博士 / 创建原创角色。
   存档 st.char = { v:1, mode:'doctor'|'custom'|null, custom:{...}, draft:{...} }
   数据见 data/talents.js(window.CHAR)。属性与天赋数值为本项目原创设计。 */
(() => {
'use strict';
const AK = window.AK, C = window.CHAR, $ = s => document.querySelector(s), esc = AK.esc, st = AK.st, cfg = C.cfg;
const ATTR = C.attrs, AKEYS = ATTR.map(a => a.k), DOC = C.doctor;
const clone = o => JSON.parse(JSON.stringify(o));
const blank = () => ({ name: '', code: '', gender: '不公开', gcustom: '', race: 'human', inf: 'none', origin: '罗德岛', tags: [], persona: '', build: 'avg', height: 170,
  look: '', coat: '', top: '', bottom: '', avatar: '', talents: [], alloc: Object.fromEntries(AKEYS.map(k => [k, 0])) });
const fill = o => { const b = blank(); const r = Object.assign(b, o || {}); r.alloc = Object.assign(b.alloc, (o && o.alloc) || {}); r.tags = (r.tags || []).slice(0, cfg.tagMax); r.talents = (r.talents || []).filter(id => C.talents.some(t => t.id === id)).slice(0, cfg.talentMax); return r; };

const S = st.char = (st.char && st.char.v === 1) ? st.char : { v: 1, mode: null, custom: null };
if (S.custom) S.custom = fill(S.custom);
const draft = { custom: fill(S.draft || S.custom) };
let step = S.mode || 'pick';

const race = id => C.races.find(r => r.id === id) || C.races[0];
const inf = id => C.infs.find(r => r.id === id) || C.infs[0];
const tal = id => C.talents.find(t => t.id === id);
const build = id => C.builds.find(b => b[0] === id) || C.builds[1];
const genderOf = p => p.gender === '自定义' ? (p.gcustom.trim() || '自定义') : p.gender;

/* ---------- 头像 ---------- */
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const svgUri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const DOC_AVA = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22394a"/><stop offset="1" stop-color="#0a1016"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#g)"/><path d="M8 100C10 74 32 64 50 64s40 10 42 36z" fill="#27353f"/><path d="M50 12c21 0 29 20 27 40-2 13-12 19-27 19S25 65 23 52C21 32 29 12 50 12z" fill="#3b4c5a"/>
<ellipse cx="50" cy="46" rx="14" ry="17" fill="#080c10"/><rect x="42" y="42" width="5" height="2.4" fill="#18d1ff"/><rect x="53" y="42" width="5" height="2.4" fill="#18d1ff"/><path d="M44 54h12" stroke="#2a3a47" stroke-width="2"/></svg>`);
const mkAva = n => { const ch = ([...(n || '').trim()][0]) || '?', h = hue(n || '?');
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},55%,38%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},50%,14%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><path d="M0 100L100 60V100z" fill="rgba(255,255,255,.07)"/><text x="50" y="66" font-size="52" font-weight="900" text-anchor="middle" fill="#fff" font-family="serif">${esc(ch)}</text></svg>`); };
const avaOf = (mode, p) => mode === 'doctor' ? DOC_AVA : (p.avatar || mkAva(p.name));

/* ---------- 属性计算 ---------- */
function breakdown(p) {
  const o = {};
  AKEYS.forEach(k => {
    const l = [['基础', cfg.base], ['分配', p.alloc[k] || 0]];
    const r = race(p.race), f = inf(p.inf);
    if (r.m[k]) l.push(['种族·' + r.n, r.m[k]]);
    if (f.m[k]) l.push(['感染·' + f.n, f.m[k]]);
    p.talents.forEach(id => { const t = tal(id); if (t && t.mod[k]) l.push(['天赋·' + t.n, t.mod[k]]); });
    o[k] = l;
  });
  return o;
}
function attrsOf(mode, p) {
  if (mode === 'doctor') return Object.assign({}, DOC.stats);
  const bd = breakdown(p), o = {};
  AKEYS.forEach(k => { o[k] = Math.max(0, Math.min(cfg.cap, bd[k].reduce((s, x) => s + x[1], 0))); });
  return o;
}
function fxOf(mode, p) {
  if (mode === 'doctor') return Object.assign({}, DOC.fx);
  const f = {}; p.talents.forEach(id => { const t = tal(id); if (t) for (const k in t.fx) f[k] = (f[k] || 0) + t.fx[k]; }); return f;
}
const DER = [
  ['hp', '生命', 'HP', ''], ['atk', '攻击', 'ATK', ''], ['def', '防御', 'DEF', ''], ['res', '法术抗性', 'RES', '%'],
  ['rdp', '再部署时间', 'REDEPLOY', 's', 1], ['cost', '部署费用', 'COST', '', 1], ['blk', '阻挡数', 'BLOCK', ''], ['bonus', '全队战力加成', 'TEAM', '%'],
];
function derive(a, fx, bm) {
  const r = {
    hp: Math.round((1100 + a.phy * 140) * bm * (1 + (fx.hpP || 0) / 100)),
    atk: Math.round((180 + a.phy * 12 + a.art * 28) * (1 + (fx.atkP || 0) / 100)),
    def: Math.round(70 + a.phy * 13 + a.int * 9 + (fx.def || 0)),
    res: Math.min(60, Math.round(a.int * 1.5 + a.art * 1.5 + (fx.res || 0))),
    rdp: Math.max(15, Math.round(80 - a.per * 2.5 - a.cmd + (fx.rdp || 0))),
    cost: Math.max(5, Math.round(20 - a.cmd * .5 + (fx.cost || 0))),
    blk: Math.min(3, 1 + (a.phy >= 12 ? 1 : 0) + (fx.blk || 0)),
    bonus: Math.round((a.cmd * .8 + a.int * .4 + a.soc * .3) * 10) / 10,
  };
  r.score = Math.round(r.hp * .05 + r.atk * .6 + r.def * .8 + (80 - r.rdp) * 3 + (20 - r.cost) * 8 + r.blk * 20 + r.res * 4 + r.bonus * 10);
  return r;
}
const grade = s => s >= 1000 ? 'S' : s >= 850 ? 'A' : s >= 700 ? 'B' : s >= 550 ? 'C' : 'D';
const BASE_A = Object.fromEntries(AKEYS.map(k => [k, cfg.base]));
const BASE_D = derive(BASE_A, {}, 1);
/** 当前页面所处的数据(pick 步骤显示已保存的身份) */
function view() {
  const mode = step === 'pick' ? S.mode : step, p = step === 'custom' ? draft.custom : (S.custom || draft.custom);
  if (!mode) return { mode: null, a: BASE_A, d: BASE_D, p };
  const a = attrsOf(mode, p), bm = mode === 'doctor' ? 1 : build(p.build)[2];
  return { mode, p, a, d: derive(a, fxOf(mode, p), bm) };
}
const used = () => AKEYS.reduce((s, k) => s + (draft.custom.alloc[k] || 0), 0);

/* ---------- 全队战力加成:已保存角色提供 ---------- */
function savedBonus() {
  if (!S.mode) return 0;
  const p = S.custom || blank(), a = attrsOf(S.mode, p);
  return derive(a, fxOf(S.mode, p), 1).bonus;
}
const tp0 = AK.teamPower;
if (tp0) AK.teamPower = () => Math.round(tp0() * (1 + savedBonus() / 100));

/* ---------- 玩家信息 / 大厅同步 ---------- */
AK.player = () => {
  if (S.mode === 'doctor') return { mode: 'doctor', name: 'Doctor', title: '博士', avatar: DOC_AVA };
  if (S.mode === 'custom' && S.custom) return { mode: 'custom', name: S.custom.name, title: S.custom.name, avatar: avaOf('custom', S.custom), gender: genderOf(S.custom) };
  return { mode: null, name: 'Doctor', title: '博士', avatar: DOC_AVA };
};
function applyLobby() {
  const P = AK.player(), nm = $('#level .name'); if (nm) nm.textContent = P.name;
  const img = $('#chAva'), sub = $('#chCellN'), dot = $('#chDot'), ico = $('#chIco');
  if (img) { if (S.mode) { img.src = P.avatar; img.style.display = 'block'; if (ico) ico.style.display = 'none'; } else { img.style.display = 'none'; if (ico) ico.style.display = ''; } }
  if (sub) sub.textContent = S.mode === 'doctor' ? '扮演:博士' : S.mode === 'custom' ? P.name : '尚未创建';
  if (dot) { dot.classList.toggle('on', !S.mode); dot.textContent = '!'; }
}

/* ---------- 状态 ---------- */
const isDirty = () => step === 'doctor' ? S.mode !== 'doctor' : step === 'custom' ? (S.mode !== 'custom' || JSON.stringify(S.custom) !== JSON.stringify(draft.custom)) : false;
const persistDraft = () => { S.draft = clone(draft.custom); AK.save(); };

/* ---------- 左侧渲染 ---------- */
const chips = (arr, cur, act, extra = '') => arr.map(([v, n, tip]) => `<button class="ch-chip${cur === v ? ' on' : ''}" data-ch="${act}" data-v="${esc(v)}"${tip ? ` title="${esc(tip)}"` : ''}${extra}>${esc(n)}</button>`).join('');
const sec = (no, t, en, inner) => `<section class="ch-sec"><h3><b>${no}</b>${t}<em>${en}</em></h3>${inner}</section>`;
const fld = (label, inner, cls = '') => `<label class="ch-f ${cls}"><small>${label}</small>${inner}</label>`;

function pickHtml() {
  const cur = m => S.mode === m ? '<span class="ch-cur">当前身份</span>' : '';
  return `<div class="ch-pick">
    <div class="ch-pc doc" data-ch="mode" data-m="doctor">${cur('doctor')}
      <img src="${DOC_AVA}" alt=""><div><small>ROLE · ORIGINAL</small><b>扮演原著博士</b>
      <p>罗德岛高层,三大创始人之一。失忆的指挥官,没有个人战斗能力,却是整艘陆行舰的大脑。</p>
      <p class="d">跳过全部填写,直接按公开资料载入博士的全部设定、天赋与属性。</p><span class="go">选择 ▸</span></div></div>
    <div class="ch-pc cus" data-ch="mode" data-m="custom">${cur('custom')}
      <img src="${S.mode === 'custom' && S.custom ? avaOf('custom', S.custom) : mkAva('新')}" alt=""><div><small>ROLE · CUSTOM</small><b>原创角色</b>
      <p>写下属于你自己的故事:姓名、性别、性格、样貌与衣着,上传或链接头像,挑选天赋并分配属性。</p>
      <p class="d">填写完成后点「保存角色」即可写入存档,下次进入自动载入。</p><span class="go">选择 ▸</span></div></div>
  </div>
  <div class="ch-tip">没有对错之分——你选择的身份会显示在大厅的玩家名牌上,其属性中的「全队战力加成」会作用于编队战力。</div>`;
}
function doctorHtml() {
  const kv = l => `<div class="ch-kv">${l.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>`;
  return `<div class="ch-lock">🔒 以下为原著设定,扮演博士时不可修改</div>
  ${sec('01', '档案', 'DOSSIER', kv(DOC.profile))}
  ${sec('02', '性格', 'PERSONA', `<p class="ch-p">${esc(DOC.persona)}</p>`)}
  ${sec('03', '外观', 'APPEARANCE', kv(DOC.look) + '<p class="ch-p dim">官方没有公开博士的面容与具体衣着,此处仅为玩家社区的常见形象,仅供参考。</p>')}
  ${sec('04', '经历', 'HISTORY', `<div class="ch-tl">${DOC.story.map(([k, v]) => `<div><b>${esc(k)}</b><p>${esc(v)}</p></div>`).join('')}</div>`)}
  ${sec('05', '天赋', 'TALENTS', `<div class="ch-tgrid">${DOC.talents.map(t => `<div class="ch-tc on"><b>${esc(t.n)}</b><small>${esc(t.en)}</small><p>${esc(t.d)}</p></div>`).join('')}</div>`)}
  <div class="ch-note">${esc(DOC.note)}</div>`;
}
function customHtml() {
  const p = draft.custom, K = ATTR;
  const bd = breakdown(p), a = attrsOf('custom', p), left = cfg.pool - used();
  const ident = `<div class="ch-idrow">
      <div class="ch-avabox"><img id="chAvaPrev" src="${avaOf('custom', p)}" alt="">
        <div class="ch-avabtn"><button class="btn alt" data-ch="upload">上传本地图片</button><button class="btn alt" data-ch="clearAva"${p.avatar ? '' : ' disabled'}>清除</button></div>
        <div class="ch-url"><input class="ch-in" id="chUrl" placeholder="或粘贴图片外链 https://…" spellcheck="false"><button class="btn" data-ch="applyUrl">应用</button></div>
        <small>图片会裁成正方形;本地图片会压缩后保存在浏览器中。</small></div>
      <div class="ch-grid2">
        ${fld('姓名 *', `<input class="ch-in" data-f="name" maxlength="12" value="${esc(p.name)}" placeholder="例如:林夜(最多 12 字)">`)}
        ${fld('代号 / 称号', `<input class="ch-in" data-f="code" maxlength="16" value="${esc(p.code)}" placeholder="选填,例如:引路人">`)}
        ${fld('性别', `<div class="ch-chips">${chips(C.genders.map(g => [g, g]), p.gender, 'gender')}</div>${p.gender === '自定义' ? `<input class="ch-in" data-f="gcustom" maxlength="8" value="${esc(p.gcustom)}" placeholder="自行填写" style="margin-top:8px">` : ''}`, 'w2')}
        ${fld('种族', `<div class="ch-chips">${chips(C.races.map(r => [r.id, r.n, r.d]), p.race, 'race')}</div>`, 'w2')}
        ${fld('矿石病感染', `<div class="ch-chips">${chips(C.infs.map(r => [r.id, r.n, r.d]), p.inf, 'inf')}</div>`, 'w2')}
        ${fld('出身 / 所属', `<select class="ch-in ch-sel" data-f="origin">${C.origins.map(o => `<option${o === p.origin ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`)}
      </div></div>`;
  const persona = `<div class="ch-f"><small>性格特点(可多选,最多 ${cfg.tagMax} 个) <b>${p.tags.length}/${cfg.tagMax}</b></small>
      <div class="ch-chips">${C.tagList.map(t => `<button class="ch-chip${p.tags.includes(t) ? ' on' : ''}" data-ch="tag" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
      ${fld('性格补充', `<textarea class="ch-in ch-ta" data-f="persona" maxlength="200" rows="3" placeholder="用几句话描述你的角色:说话的方式、习惯、在意的事……">${esc(p.persona)}</textarea>`)}`;
  const look = `<div class="ch-grid3">
      ${fld('身材', `<div class="ch-chips">${C.builds.map(([v, n]) => `<button class="ch-chip${p.build === v ? ' on' : ''}" data-ch="build" data-v="${v}">${n}</button>`).join('')}</div>`, 'w3')}
      ${fld('身高(cm)', `<input class="ch-in" type="number" min="120" max="230" data-f="height" value="${esc(p.height)}">`)}
      ${fld('样貌描述', `<textarea class="ch-in ch-ta" data-f="look" maxlength="200" rows="2" placeholder="发色、瞳色、面部特征、伤疤、耳尾等">${esc(p.look)}</textarea>`, 'w2')}
      ${[['coat', '外套'], ['top', '上衣'], ['bottom', '下衣']].map(([f, n]) => fld(n, `<input class="ch-in" data-f="${f}" maxlength="30" value="${esc(p[f])}" placeholder="自行填写,或点下方建议"><div class="ch-sug">${C.sug[f].map(s => `<button data-ch="sug" data-f="${f}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>`)).join('')}
    </div>`;
  const tal_ = `<div class="ch-tcount">已选 <b>${p.talents.length}</b> / ${cfg.talentMax}</div><div class="ch-tgrid">${C.talents.map(t => {
    const on = p.talents.includes(t.id), md = Object.entries(t.mod).map(([k, v]) => `<i class="${v > 0 ? 'u' : 'd'}">${(K.find(x => x.k === k) || {}).n}${v > 0 ? '+' : ''}${v}</i>`).join('');
    return `<div class="ch-tc${on ? ' on' : ''}" data-ch="talent" data-v="${t.id}"><div class="th"><b>${esc(t.n)}</b><em>${esc(t.tag)}</em></div><small>${esc(t.en)}</small><p>${esc(t.d)}</p><div class="tm">${md}</div></div>`;
  }).join('')}</div>`;
  const attrs = `<div class="ch-pts"><div>可分配点数 <b id="chLeft" class="${left === 0 ? 'z' : ''}">${left}</b> / ${cfg.pool}</div>
      <div class="ch-chips">${C.presets.map(([v, n]) => `<button class="ch-chip" data-ch="preset" data-v="${v}">${n}</button>`).join('')}<button class="ch-chip alt" data-ch="clearPts">清零</button></div></div>
    <div class="ch-arows">${K.map(x => {
      const al = p.alloc[x.k] || 0, md = bd[x.k].slice(2).map(([s, v]) => `<i class="${v > 0 ? 'u' : 'd'}" title="${esc(s)}">${esc(s.split('·')[1] || s)} ${v > 0 ? '+' : ''}${v}</i>`).join('');
      return `<div class="ch-ar" data-k="${x.k}"><div class="n"><b>${x.n}</b><small>${x.en}</small></div>
        <div class="st"><button data-ch="minus" data-k="${x.k}"${al <= 0 ? ' disabled' : ''}>−</button><b>${al}</b><button data-ch="plus" data-k="${x.k}"${(left <= 0 || al >= cfg.maxAlloc || a[x.k] >= cfg.cap) ? ' disabled' : ''}>+</button></div>
        <div class="bar"><i style="width:${a[x.k] / cfg.cap * 100}%"></i></div><div class="v"><b>${a[x.k]}</b></div>
        <div class="d">${esc(x.d)}</div><div class="m">基础 ${cfg.base}${al ? ` · 分配 +${al}` : ''}${md}</div></div>`;
    }).join('')}</div>`;
  return sec('01', '头像与身份', 'IDENTITY', ident) + sec('02', '性格特点', 'PERSONALITY', persona) + sec('03', '身材样貌与衣着', 'APPEARANCE', look)
    + sec('04', '天赋', 'TALENTS', tal_) + sec('05', '属性分配', 'ATTRIBUTES', attrs);
}
function renderBody() {
  const box = $('#chBody'), y = box.scrollTop;
  box.innerHTML = step === 'pick' ? pickHtml() : step === 'doctor' ? doctorHtml() : customHtml();
  box.scrollTop = y;
}

/* ---------- 右侧面板 ---------- */
const R = 100, ang = i => (-90 + i * 60) * Math.PI / 180;
const pt = (i, v) => [Math.cos(ang(i)) * v / cfg.cap * R, Math.sin(ang(i)) * v / cfg.cap * R];
const pts = vals => vals.map((v, i) => pt(i, v).map(n => n.toFixed(1)).join(',')).join(' ');
function radarSvg() {
  const rings = [5, 10, 15, 20].map(v => `<polygon points="${pts(AKEYS.map(() => v))}" class="g"/>`).join('');
  const axes = AKEYS.map((k, i) => { const [x, y] = pt(i, cfg.cap), [lx, ly] = pt(i, cfg.cap + 4.6); return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/><text x="${lx.toFixed(1)}" y="${(ly + 5).toFixed(1)}" text-anchor="middle">${ATTR[i].n}</text>`; }).join('');
  return `<svg class="ch-radar" viewBox="-150 -140 300 280">${rings}<g class="ax">${axes}</g><polygon id="chRadB" points="${pts(AKEYS.map(() => cfg.base))}" class="b"/><polygon id="chRad" points="${pts(AKEYS.map(() => 0))}" class="c"/><g id="chRadD">${AKEYS.map(() => '<circle r="3.4"/>').join('')}</g></svg>`;
}
function renderSide() {
  const v = view();
  $('#chSide').innerHTML = `<div class="ch-side">
    <div class="ch-id"><img id="chsAva" class="ch-ava" alt=""><div class="ci"><small id="chsMode"></small><b id="chsName"></b><em id="chsSub"></em><div class="ch-tags" id="chsTags"></div></div></div>
    <div class="ch-score"><div><small>综合评分</small><b id="chsScore">0</b><i id="chsScoreD"></i></div><span id="chsGrade" class="gr">C</span></div>
    <div class="hd2">属性雷达 <span class="lg"><i class="a"></i>当前 <i class="b"></i>基准(各项 ${cfg.base})</span></div>${radarSvg()}
    <div class="ch-ab">${ATTR.map(x => `<div id="chsA_${x.k}"><span>${x.n}</span><div class="bar"><i></i></div><b>0</b><em></em></div>`).join('')}</div>
    <div class="hd2">战斗面板 <span class="lg">相对基准</span></div>
    <div class="ch-dv">${DER.map(([k, n, en, u]) => `<div id="chsD_${k}"><small>${n}<i>${en}</i></small><b>0</b><em></em></div>`).join('')}</div>
    <div class="btns ch-sb"><button class="btn go" data-ch="save" id="chSave2">保存角色</button><button class="btn alt" data-ch="reset">重置</button></div>
    <div class="note" id="chsNote"></div></div>`;
  rv = null; lastD = null; identSide(); updateStats(true);
}
function identSide() {
  const v = view(), P = v.p, doc = v.mode === 'doctor', set = (id, t) => { const e = $(id); if (e) e.textContent = t; };
  if (!$('#chsName')) return;
  $('#chsAva').src = v.mode ? avaOf(v.mode, P) : mkAva('?');
  set('#chsMode', step === 'pick' ? (v.mode ? '已保存身份' : '尚未创建') : doc ? '扮演原著博士' : '原创角色');
  set('#chsName', !v.mode ? '— —' : doc ? 'Doctor' : (P.name.trim() || '未命名'));
  set('#chsSub', !v.mode ? '请在左侧选择身份' : doc ? '博士 · DOCTOR · 权限等级 8' : (P.code.trim() || '— 暂无代号 —'));
  $('#chsTags').innerHTML = (!v.mode ? [] : doc ? ['罗德岛高层', '战术指挥', '性别未公开'] : [genderOf(P), race(P.race).n, inf(P.inf).n, P.origin, build(P.build)[1] + ' ' + P.height + 'cm']).map(t => `<span>${esc(t)}</span>`).join('');
  set('#chsNote', doc ? '博士的属性与天赋为按公开设定改编的玩法数值,并非官方数据。' : '属性由「基础 5 + 分配 + 种族 + 感染 + 天赋」叠加而成,单项上限 ' + cfg.cap + '。');
  const b = $('#chSave2'); if (b) b.style.display = step === 'pick' ? 'none' : '';
}
let rv = null, lastD = null, raf = 0;
function setRadar(vals) {
  const poly = $('#chRad'), dots = [...document.querySelectorAll('#chRadD circle')]; if (!poly) return;
  const from = rv ? rv.slice() : vals.map(() => 0), t0 = performance.now(); cancelAnimationFrame(raf);
  const draw = c => { poly.setAttribute('points', pts(c)); dots.forEach((d, i) => { const [x, y] = pt(i, c[i]); d.setAttribute('cx', x.toFixed(1)); d.setAttribute('cy', y.toFixed(1)); }); };
  const loop = t => { const p = Math.min(1, (t - t0) / 420), e = 1 - Math.pow(1 - p, 3); rv = vals.map((x, i) => from[i] + (x - from[i]) * e); draw(rv); if (p < 1) raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  setTimeout(() => { rv = vals.slice(); draw(rv); }, 480);
}
const flash = el => { if (!el) return; el.classList.remove('fl'); void el.offsetWidth; el.classList.add('fl'); };
const dlt = (n, low, u = '') => { if (!n) return ['', '']; const good = low ? n < 0 : n > 0; const f = Math.round(n * 10) / 10; return [(f > 0 ? '▲ +' : '▼ ') + f + u, good ? 'up' : 'dn']; };
function updateStats(first) {
  if (!$('#chsName')) return;
  const v = view(), vals = AKEYS.map(k => v.a[k]);
  setRadar(vals);
  AKEYS.forEach((k, i) => {
    const row = $('#chsA_' + k), d = v.a[k] - cfg.base;
    row.querySelector('i').style.width = v.a[k] / cfg.cap * 100 + '%'; row.querySelector('b').textContent = v.a[k];
    const em = row.querySelector('em'); em.textContent = d ? (d > 0 ? '+' : '') + d : ''; em.className = d > 0 ? 'up' : d < 0 ? 'dn' : '';
  });
  DER.forEach(([k, n, en, u, low]) => {
    const el = $('#chsD_' + k), val = v.d[k], b = el.querySelector('b'), em = el.querySelector('em');
    const [t, c] = dlt(val - BASE_D[k], low, u);
    b.textContent = (k === 'bonus' ? '+' : '') + val + u; em.textContent = t; em.className = c;
    if (lastD && lastD[k] !== val) flash(el);
  });
  const sd = v.d.score - BASE_D.score, g = $('#chsGrade'), sc = $('#chsScore');
  if (lastD && lastD.score !== v.d.score) { flash(sc); flash(g); }
  sc.textContent = v.d.score; g.textContent = v.mode ? grade(v.d.score) : '—'; g.dataset.g = grade(v.d.score);
  const sdE = $('#chsScoreD'); sdE.textContent = sd ? (sd > 0 ? '▲ +' : '▼ ') + sd : ''; sdE.className = sd > 0 ? 'up' : sd < 0 ? 'dn' : '';
  lastD = Object.assign({}, v.d);
}

/* ---------- 顶栏状态 ---------- */
function updateHead() {
  const dirty = isDirty(), save = $('#chSave');
  $('#chSwitch').style.display = step === 'pick' ? 'none' : '';
  save.style.display = step === 'pick' ? 'none' : '';
  save.textContent = step === 'doctor' ? (S.mode === 'doctor' ? '已在扮演博士' : '确认扮演博士') : '保存角色';
  save.disabled = step === 'doctor' ? S.mode === 'doctor' : false;
  const b2 = $('#chSave2'); if (b2) { b2.textContent = save.textContent; b2.disabled = save.disabled; }
  const dt = $('#chDirty'); dt.textContent = step === 'pick' ? '' : step === 'custom' ? (dirty ? '● 有未保存的修改' : S.mode === 'custom' ? '✓ 已保存' : '尚未保存') : (S.mode === 'doctor' ? '✓ 已保存' : '尚未保存');
  dt.className = 'ch-dirty' + (dirty ? ' dirty' : '');
}
function refreshAll() { renderBody(); renderSide(); updateHead(); }
function refreshForm() { renderBody(); identSide(); updateStats(); updateHead(); }

/* ---------- 操作 ---------- */
function save() {
  if (step === 'doctor') { S.mode = 'doctor'; }
  else if (step === 'custom') {
    const p = draft.custom; p.name = p.name.trim();
    if (!p.name) { AK.toast('请先填写角色姓名'); const i = document.querySelector('[data-f="name"]'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } return; }
    if (p.gender === '自定义' && !p.gcustom.trim()) { AK.toast('请填写自定义性别'); return; }
    const left = cfg.pool - used(); S.mode = 'custom'; S.custom = clone(p);
    if (left > 0) setTimeout(() => AK.toast(`提示:还有 ${left} 点属性未分配,可随时回来修改`), 900);
  }
  S.draft = null; AK.save(); applyLobby(); updateHead(); identSide(); AK.toast(step === 'doctor' ? '已确认:你将扮演博士' : `角色「${S.custom.name}」已保存`); AK.emit('char');
  AK.beep && AK.beep(520, 880, .15, 'triangle', .05);
}
function toAvatar(src, cors) {
  return new Promise((res, rej) => {
    const im = new Image(); if (cors) im.crossOrigin = 'anonymous';
    im.onload = () => { try { const w = im.naturalWidth, h = im.naturalHeight, s = Math.min(w, h), c = document.createElement('canvas'); c.width = c.height = 256;
      c.getContext('2d').drawImage(im, (w - s) / 2, (h - s) * .15, s, s, 0, 0, 256, 256); res(c.toDataURL('image/jpeg', .86)); } catch (e) { rej(e); } };
    im.onerror = () => rej(new Error('load')); im.src = src;
  });
}
function setAvatar(u) { draft.custom.avatar = u; persistDraft(); const i = $('#chAvaPrev'); if (i) i.src = avaOf('custom', draft.custom); identSide(); updateHead(); const b = document.querySelector('[data-ch="clearAva"]'); if (b) b.disabled = !u; }
function onFile(f) {
  if (!f) return; if (!/^image\//.test(f.type)) { AK.toast('请选择图片文件'); return; }
  const rd = new FileReader();
  rd.onload = () => toAvatar(rd.result).then(u => { setAvatar(u); AK.toast('头像已更新'); }).catch(() => AK.toast('图片读取失败'));
  rd.readAsDataURL(f);
}
async function applyUrl() {
  const u = ($('#chUrl').value || '').trim(); if (!/^https?:\/\//i.test(u) && !/^data:image\//i.test(u)) { AK.toast('请输入以 http(s):// 开头的图片链接'); return; }
  AK.toast('正在加载图片…');
  try { setAvatar(await toAvatar(u, true)); AK.toast('头像已更新(已转存到本地)'); return; } catch (e) { /* 跨域受限则退回直接引用 */ }
  const ok = await new Promise(r => { const im = new Image(); im.onload = () => r(true); im.onerror = () => r(false); im.src = u; });
  if (ok) { setAvatar(u); AK.toast('头像已更新(外链直接引用,链接失效时会显示默认头像)'); } else AK.toast('无法加载该链接,请检查地址是否为图片');
}
function setAlloc(k, n) { draft.custom.alloc[k] = n; persistDraft(); refreshForm(); }
function onClick(e) {
  const b = e.target.closest('[data-ch]'); if (!b || b.disabled) return; const a = b.dataset.ch, ds = b.dataset, p = draft.custom;
  const upd = () => { persistDraft(); refreshForm(); };
  if (a === 'mode') { step = ds.m; refreshAll(); AK.beep && AK.beep(400, 700, .1, 'triangle', .04); }
  else if (a === 'switch') { step = 'pick'; refreshAll(); }
  else if (a === 'save') save();
  else if (a === 'reset') {
    if (step === 'custom') { if (!confirm('放弃本页的修改,恢复到上次保存的内容吗?')) return; draft.custom = fill(S.custom); S.draft = null; AK.save(); refreshAll(); AK.toast('已重置'); }
    else { step = 'pick'; refreshAll(); }
  }
  else if (a === 'gender') { p.gender = ds.v; upd(); }
  else if (a === 'race') { p.race = ds.v; upd(); }
  else if (a === 'inf') { p.inf = ds.v; upd(); }
  else if (a === 'build') { p.build = ds.v; upd(); }
  else if (a === 'tag') { const i = p.tags.indexOf(ds.v); if (i >= 0) p.tags.splice(i, 1); else if (p.tags.length >= cfg.tagMax) { AK.toast(`最多选择 ${cfg.tagMax} 个性格标签`); return; } else p.tags.push(ds.v); upd(); }
  else if (a === 'talent') { const i = p.talents.indexOf(ds.v); if (i >= 0) p.talents.splice(i, 1); else if (p.talents.length >= cfg.talentMax) { AK.toast(`最多选择 ${cfg.talentMax} 个天赋,请先取消一个`); return; } else p.talents.push(ds.v); upd(); }
  else if (a === 'plus') { if (cfg.pool - used() <= 0) return; setAlloc(ds.k, (p.alloc[ds.k] || 0) + 1); }
  else if (a === 'minus') setAlloc(ds.k, Math.max(0, (p.alloc[ds.k] || 0) - 1));
  else if (a === 'preset') { const pr = C.presets.find(x => x[0] === ds.v); AKEYS.forEach(k => { p.alloc[k] = Math.min(cfg.maxAlloc, pr[2][k] || 0); }); upd(); }
  else if (a === 'clearPts') { AKEYS.forEach(k => { p.alloc[k] = 0; }); upd(); }
  else if (a === 'sug') { p[ds.f] = ds.v; const i = document.querySelector(`[data-f="${ds.f}"]`); if (i) i.value = ds.v; persistDraft(); updateHead(); }
  else if (a === 'upload') $('#chFile').click();
  else if (a === 'clearAva') { setAvatar(''); }
  else if (a === 'applyUrl') applyUrl();
}
function onInput(e) {
  const f = e.target.dataset && e.target.dataset.f; if (!f || !(f in draft.custom)) return;
  let v = e.target.value; if (f === 'height') { v = Math.max(0, Math.min(230, parseInt(v, 10) || 0)); }
  draft.custom[f] = v; persistDraft(); identSide(); updateHead();
}
function onChange(e) {
  if (e.target.id === 'chFile') { onFile(e.target.files[0]); e.target.value = ''; return; }
  if (e.target.dataset && e.target.dataset.f === 'height') { let v = parseInt(e.target.value, 10) || 170; v = Math.max(120, Math.min(230, v)); draft.custom.height = v; e.target.value = v; persistDraft(); identSide(); updateHead(); }
  if (e.target.dataset && e.target.dataset.f === 'origin') { draft.custom.origin = e.target.value; persistDraft(); identSide(); updateHead(); }
}
let inited = false;
function init() {
  inited = true; const v = $('#v-char');
  v.addEventListener('click', onClick); v.addEventListener('input', onInput); v.addEventListener('change', onChange);
}
AK.enter.char = () => { if (!inited) init(); step = S.mode || 'pick'; if (step === 'custom') draft.custom = fill(S.draft || S.custom); refreshAll(); };
AK.charApi = { view, derive, attrsOf, savedBonus };
applyLobby();
})();
