/* cg.js — 干员寻访 · 五星/六星出货 CG
   · 有「动态立绘」的干员(25 名六星)→ 播放官方 Spine 动态立绘(Idle 循环)
   · 其余五/六星干员 → 立绘 + Spine 基建小人(走入 → 互动 → 待机)的演出
   · 模型取自 isHarryh/Ark-Models(版权归鹰角网络),运行时用 Spine 3.8 WebGL
   · 文件按需从 jsDelivr 多线路 / GitHub 代理竞速下载;下载中或失败时先用静态立绘演出,不会卡住流程 */
(() => {
'use strict';
const AK = window.AK; if (!AK) return;
const RC = AK.RC, esc = AK.esc;
const SHA = 'e65fb9147846b64bcf2df956b8cd8da77a51b9b8';
/* Ark-Models 里「基础皮肤」的动态立绘(models_illust/dyn_illust_<key>) */
const DYN = new Set(['1012_skadi2', '1013_chen2', '1014_nearl2', '1015_aglna2', '1016_agoat2', '1023_ghost2', '1026_gvial2', '1028_texas2', '1035_wisdel', '1038_whitw2', '1041_angel2', '1044_hsgma2', '1045_svash2', '1052_kalts2', '113_cqbw', '2014_nian', '2015_dusk', '2023_ling', '2024_chyue', '2025_shu', '2026_yu', '2027_wang', '245_cello', '249_mlyss', '391_rosmon']);

/* ---------- 下载:多线路竞速(错开启动,先成功者胜出,其余中止) ---------- */
const encP = p => p.split('/').map(encodeURIComponent).join('/');
const RAW = p => `https://raw.githubusercontent.com/isHarryh/Ark-Models/${SHA}/${encP(p)}`;
const jsd = h => p => `https://${h}.jsdelivr.net/gh/isHarryh/Ark-Models@${SHA}/${encP(p)}`;
/* testingcf 对超过 50MB 的包返回 403,不用 */
const SRC = [jsd('fastly'), jsd('quantil'), jsd('cdn'), jsd('gcore'),
  p => 'https://gh-proxy.com/' + RAW(p), p => 'https://ghfast.top/' + RAW(p),
  p => 'https://ghproxy.harryh.cn/?q=' + encodeURIComponent(RAW(p)), RAW];
let pref = 0;
function getFile(path, kind, big) {
  return new Promise((ok, no) => {
    const n = SRC.length, acs = [], timers = []; let fin = false, fails = 0, nextK = 0;
    const done = (fn, v) => { if (fin) return; fin = true; timers.forEach(clearTimeout); acs.forEach(a => { try { a.abort(); } catch (e) { /* 忽略 */ } }); fn(v); };
    const launch = () => {
      if (fin || nextK >= n) return;
      const idx = (pref + nextK++) % n, ac = new AbortController(); acs.push(ac);
      const tm = setTimeout(() => ac.abort(), big ? 90000 : 40000); timers.push(tm);
      fetch(SRC[idx](path), { signal: ac.signal }).then(async r => {
        if (!r.ok) throw new Error(r.status);
        if (/text\/html/i.test(r.headers.get('content-type') || '')) throw new Error('html');
        const b = await r.arrayBuffer();
        if (b.byteLength < 16) throw new Error('empty');
        pref = idx; done(ok, kind === 'text' ? new TextDecoder().decode(b) : b);
      }).catch(() => { clearTimeout(tm); if (++fails >= n) done(no, new Error('all sources failed')); else launch(); });
    };
    const gap = big ? 4500 : 1200;
    for (let k = 0; k < n; k++) timers.push(setTimeout(launch, k * gap));
  });
}

/* ---------- Spine 运行时(按需加载) ---------- */
let spinePr = null;
function ensureSpine() {
  if (window.spine && window.spine.webgl) return Promise.resolve();
  if (spinePr) return spinePr;
  spinePr = new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = 'assets/lib/spine-webgl.js?v=9';
    s.onload = () => (window.spine && window.spine.webgl ? ok() : no(new Error('spine'))); s.onerror = () => no(new Error('spine load'));
    document.head.appendChild(s);
  });
  spinePr.catch(() => { spinePr = null; });
  return spinePr;
}

/* ---------- 模型文件缓存(最多 5 个) ---------- */
const prep = new Map();
const keyOf = o => o.id.replace(/^char_/, '');
function warmModel(o) {
  const key = keyOf(o); if (prep.has(key)) return prep.get(key);
  const dyn = DYN.has(key), base = dyn ? `models_illust/dyn_illust_${key}/dyn_illust_char_${key}` : `models/${key}/build_char_${key}`;
  const pr = (async () => {
    const [atlasTxt, skel] = await Promise.all([getFile(base + '.atlas', 'text'), getFile(base + '.skel', 'buf')]);
    const png = await getFile(base + '.png', 'buf', dyn);
    const url = URL.createObjectURL(new Blob([png], { type: 'image/png' })), img = new Image();
    img.src = url; await img.decode();
    return { dyn, atlasTxt, skel, img, url };
  })();
  pr.catch(() => prep.delete(key));
  prep.set(key, pr);
  while (prep.size > 5) { const k = prep.keys().next().value, v = prep.get(k); prep.delete(k); v.then(m => URL.revokeObjectURL(m.url), () => 0); }
  return pr;
}

/* ---------- WebGL(全局一个画布,按场景复用) ---------- */
let GL = null;
function initGL() {
  if (GL) return GL;
  const cv = document.createElement('canvas'); cv.className = 'cg-gl';
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) throw new Error('no webgl');
  const ctx = new spine.webgl.ManagedWebGLRenderingContext(gl);
  GL = { cv, gl, ctx, r: new spine.webgl.SceneRenderer(cv, ctx) };
  return GL;
}

/* 取「可见」附件的顶点包围盒(去掉两端 3% 的离群点);getBounds 会把隐藏附件也算进去,范围大得离谱 */
function visBounds(sk) {
  const sp = spine, xs = [], ys = [];
  for (const sl of sk.drawOrder) {
    const a = sl.attachment; if (!a || sl.color.a < 0.05) continue; let v;
    if (a instanceof sp.RegionAttachment) { v = new Float32Array(8); a.computeWorldVertices(sl.bone, v, 0, 2); }
    else if (a instanceof sp.MeshAttachment) { v = new Float32Array(a.worldVerticesLength); a.computeWorldVertices(sl, 0, a.worldVerticesLength, v, 0, 2); }
    else continue;
    for (let i = 0; i < v.length; i += 2) { xs.push(v[i]); ys.push(v[i + 1]); }
  }
  if (xs.length < 4) return { x: -100, y: 0, w: 200, h: 300 };
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const n = xs.length, lo = Math.floor(n * .03), hi = Math.max(lo + 1, Math.floor(n * .97) - 1);
  return { x: xs[lo], y: ys[lo], w: xs[hi] - xs[lo], h: ys[hi] - ys[lo] };
}

function startSpine(host, m) {
  const g = initGL(), sp = spine;
  const atlas = new sp.TextureAtlas(m.atlasTxt, () => new sp.webgl.GLTexture(g.ctx, m.img));
  const loader = new sp.AtlasAttachmentLoader(atlas), u8 = new Uint8Array(m.skel);
  const data = u8[0] === 0x7B ? new sp.SkeletonJson(loader).readSkeletonData(JSON.parse(new TextDecoder().decode(u8))) : new sp.SkeletonBinary(loader).readSkeletonData(u8);
  const sk = new sp.Skeleton(data), st = new sp.AnimationState(new sp.AnimationStateData(data));
  const has = nm => data.findAnimation(nm), pick = re => (data.animations.find(a => re.test(a.name)) || {}).name;
  let walk = 0;
  if (m.dyn) {
    const start = pick(/^start$/i), idle = pick(/^idle$/i) || data.animations[0].name;
    if (start) { st.setAnimation(0, start, false); st.addAnimation(0, idle, true, 0); } else st.setAnimation(0, idle, true);
  } else {
    const mv = has('Move') ? 'Move' : null; walk = mv ? 1.15 : 0;
    st.setAnimation(0, mv || (has('Relax') ? 'Relax' : data.animations[0].name), true);
  }
  sk.setToSetupPose(); st.update(0.4); st.apply(sk); sk.updateWorldTransform();
  const B = visBounds(sk);
  host.appendChild(g.cv);
  const mob = document.body.classList.contains('mob');
  let raf = 0, last = performance.now(), t = 0, stage2 = false, alive = true;
  const loop = now => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    const cw = host.clientWidth, ch = host.clientHeight; if (!cw || !ch) return;
    const K = Math.min(1.6, Math.max(1, window.devicePixelRatio || 1)), W = Math.round(cw * K), H = Math.round(ch * K);
    if (g.cv.width !== W || g.cv.height !== H) { g.cv.width = W; g.cv.height = H; }
    let s, px, py;
    if (m.dyn) {
      s = mob ? ch / B.h * 1.02 : Math.min(cw / B.w, ch / B.h) * 1.06;
      px = cw / 2 - (B.x + B.w / 2) * s; py = ch / 2 - (B.y + B.h / 2) * s;
    } else {
      s = ch * (mob ? .25 : .3) / B.h;
      const tx = cw * (mob ? .3 : .24), floor = ch * (mob ? .075 : .06);
      let ex = 1;
      if (walk && t < walk) { const k = t / walk; ex = 1 - Math.pow(1 - k, 3); } else if (walk && !stage2) {
        stage2 = true; if (has('Interact')) { st.setAnimation(0, 'Interact', false); st.addAnimation(0, has('Relax') ? 'Relax' : 'Default', true, 0); }
        else if (has('Relax')) st.setAnimation(0, 'Relax', true);
      }
      const from = -B.w * s - 40, cx = from + (tx - from) * ex;
      px = cx - (B.x + B.w / 2) * s; py = floor - B.y * s;
    }
    sk.x = px; sk.y = py; sk.scaleX = sk.scaleY = s;
    st.update(dt); st.apply(sk); sk.updateWorldTransform();
    const gl = g.gl, r = g.r;
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    r.camera.position.x = cw / 2; r.camera.position.y = ch / 2; r.camera.setViewport(cw, ch); r.camera.update();
    r.begin(); r.drawSkeleton(sk, true); r.end();
  };
  raf = requestAnimationFrame(loop);
  return { stop() { alive = false; cancelAnimationFrame(raf); try { atlas.dispose(); } catch (e) { /* 忽略 */ } if (g.cv.parentNode) g.cv.parentNode.removeChild(g.cv); } };
}

/* ---------- 演出 ---------- */
const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const el = () => document.getElementById('cgv');
let skipAll = false, curEnd = null;

function scene(it, idx, total, poolName) {
  return new Promise(res => {
    const box = el(), o = it.op, r = it.r, tc = RC[r], key = keyOf(o), dyn = DYN.has(key);
    box.style.setProperty('--tc', tc); box.style.setProperty('--tcrgb', hex2rgb(tc).join(','));
    box.style.setProperty('--ocrgb', hex2rgb(o.c || '#18d1ff').join(','));
    box.className = 'on r' + r + (dyn ? ' dyn' : ' chibi');
    const stars = Array.from({ length: r + 1 }, (_, k) => `<i style="--k:${k}">★</i>`).join('');
    const sparks = Array.from({ length: 26 }, () => `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(3 + Math.random() * 4).toFixed(1)}s;--l:${(-Math.random() * 6).toFixed(1)}s;--s:${(4 + Math.random() * 9).toFixed(0)}px"></i>`).join('');
    box.innerHTML = `<div class="cg-bg"></div><div class="cg-rays"></div>
      <img class="cg-art" src="${AK.art(o)}" alt="" draggable="false">
      <div class="cg-glwrap"></div><div class="cg-fx">${sparks}</div>
      <div class="cg-bar"><b>HEADHUNTING</b><span>${esc(poolName || '')}</span></div>
      <div class="cg-info">
        <div class="cg-stars">${stars}</div>
        <div class="cg-en">${esc(o.e || '')}</div>
        <div class="cg-nm">${esc(o.n)}</div>
        <div class="cg-meta"><span>${esc(AK.PROF[o.p] || o.p || '')}</span>${o.na ? `<span>${esc(o.na)}</span>` : ''}${it.up ? '<span class="up">UP</span>' : ''}<span class="${it.isNew ? 'new' : 'pot'}">${it.isNew ? 'NEW' : '潜能 ' + it.pot}</span></div>
        ${o.qt ? `<div class="cg-qt">${esc(o.qt)}</div>` : ''}
      </div>
      <div class="cg-hud"><span class="cg-cnt">${idx + 1} / ${total}</span>${total > 1 ? '<button class="cg-skip" type="button">跳过全部 ▸▸</button>' : '<button class="cg-skip" type="button">跳过 ▸▸</button>'}</div>
      <div class="cg-load">动态立绘载入中…</div><div class="cg-hint">点击继续</div><div class="cg-flash"></div>`;
    const t0 = performance.now(); let alive = true, ctl = null; const timers = [];
    const tm = (fn, ms) => timers.push(setTimeout(fn, ms));
    const end = all => {
      if (!alive) return; alive = false; curEnd = null; timers.forEach(clearTimeout);
      if (ctl) ctl.stop(); box.onclick = null; if (all) skipAll = true; res();
    };
    curEnd = end;
    /* 音效:冲击 + 逐星升调 */
    if (AK.beep) {
      AK.beep(160, 1400, .55, 'sawtooth', .06);
      for (let k = 0; k <= r; k++) tm(() => AK.beep(520 + k * 130, 900 + k * 180, .14, 'triangle', .05), 800 + k * 150);
      if (r >= 5) tm(() => AK.beep(220, 2200, .9, 'sawtooth', .05), 1000);
    }
    tm(() => box.classList.add('hint'), 1800);
    const loadEl = box.querySelector('.cg-load');
    (async () => {
      try {
        await ensureSpine();
        const m = await warmModel(o);
        if (!alive) return;
        ctl = startSpine(box.querySelector('.cg-glwrap'), m);
        box.classList.add('gl');
      } catch (e) {
        if (alive) { box.classList.add('nogl'); loadEl.textContent = '网络受限 · 已显示静态立绘'; tm(() => { loadEl.style.opacity = 0; }, 3500); }
      }
    })();
    /* 预取后面要播放的下一个模型 */
    if (it._next) warmModel(it._next).catch(() => 0);
    box.onclick = e => {
      if (e.target.closest('.cg-skip')) { end(true); return; }
      if (performance.now() - t0 > 1100) end(false);
    };
  });
}

let running = false;
function onKey(e) {
  if (!curEnd) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); curEnd(true); }
  else if (e.key === ' ' || e.key === 'Enter') { e.stopImmediatePropagation(); e.preventDefault(); curEnd(false); }
}
/** items: [{op,r,up,isNew,pot}](r>=4) → Promise,全部播放或被跳过后 resolve */
async function run(items, pool) {
  if (running) return; running = true; skipAll = false;
  window.addEventListener('keydown', onKey, true);
  const box = el();
  try {
    items.forEach((x, i) => { x._next = items[i + 1] ? items[i + 1].op : null; });
    for (let i = 0; i < items.length && !skipAll; i++) {
      await scene(items[i], i, items.length, pool && pool.n);
      if (i < items.length - 1 && !skipAll) await new Promise(r => setTimeout(r, 120));
    }
  } finally {
    window.removeEventListener('keydown', onKey, true);
    box.className = ''; box.innerHTML = ''; running = false;
  }
}
AK.cg = { run, warm: () => ensureSpine().catch(() => 0), DYN, supported: () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl')); } catch (e) { return false; } } };
})();
