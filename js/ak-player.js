/* =====================================================================
   阿米娅的小曲 · 播放器 (Shadow DOM, 无依赖)
   - 阿米娅 Q 版小人: 听歌时随歌词"吐"出一个个字
   - 光标换成小阿米娅; 触屏时一个小阿米娅跟着手指滑动, 带星星拖尾
   - data-mode="float"(默认): 右下角悬浮小人, 点开弹窗播放器(可拖动)
   - data-mode="page": 整页播放器 (player.html)
   - data-cursor="off": 不改光标
   ===================================================================== */
(function () {
  'use strict';
  if (window.__akmp) return; window.__akmp = 1;
  var cs = document.currentScript;
  var SRC = (cs && cs.src) || '';
  var BASE = SRC.replace(/js\/[^\/?#]*([?#].*)?$/, '');
  if (!BASE || BASE === SRC) BASE = 'https://hykhxy.github.io/ak-home/';
  var MODE = (cs && cs.getAttribute('data-mode')) || 'float';
  var CURSOR = !(cs && cs.getAttribute('data-cursor') === 'off');
  var IMG = BASE + 'assets/mascot/amiya.webp', CUR = BASE + 'assets/mascot/cursor.png', TINY = BASE + 'assets/mascot/tiny.png';

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem('akmp.' + k); localStorage.setItem('akmp.' + k, v); } catch (e) { return null; } }
  function $(s, r) { return (r || root).querySelector(s); }
  function fmt(t) { t = Math.max(0, Math.floor(t || 0)); var m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }

  /* ---------- 全局光标: 小阿米娅 ---------- */
  if (CURSOR) {
    var cst = document.createElement('style');
    cst.textContent = '*,*::before,*::after{cursor:url(' + CUR + ') 10 6,auto!important}';
    document.head.appendChild(cst);
  }

  var T = null, root, host;
  function boot() {
    T = window.AK_TRACKS || [];
    if (!T.length) return;
    build();
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;margin:0;padding:0;cursor:url(' + CUR + ') 10 6,auto!important;-webkit-tap-highlight-color:transparent}',
    'button{font:inherit;color:inherit;background:none;border:0}',
    '.w{font:14px/1.5 system-ui,-apple-system,"Microsoft YaHei",sans-serif;color:#e8f0f6;--ac:#18d1ff}',
    /* 悬浮小人 */
    '.fab{position:fixed;z-index:2147483000;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));width:64px;height:64px;touch-action:none;user-select:none;-webkit-user-select:none}',
    '.fab .ring{position:absolute;inset:-3px;border-radius:50%;border:2px dashed var(--ac);opacity:.0;animation:spin 8s linear infinite}',
    '.on .fab .ring{opacity:.8}',
    '.fab img{position:absolute;left:50%;bottom:0;width:62px;height:auto;margin-left:-31px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.55));transform-origin:50% 100%;animation:bob 3.2s ease-in-out infinite;pointer-events:none}',
    '.on .fab img{animation:bob .9s ease-in-out infinite}',
    '.fab .nt{position:absolute;right:-2px;top:-6px;font-size:18px;color:var(--ac);opacity:0;text-shadow:0 0 6px #000}',
    '.on .fab .nt{animation:nt 1.6s ease-in infinite}',
    '@keyframes nt{0%{opacity:0;transform:translate(0,8px) rotate(-10deg)}30%{opacity:1}100%{opacity:0;transform:translate(10px,-22px) rotate(14deg)}}',
    '@keyframes bob{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-4px) scale(1.02,.98)}}',
    '@keyframes spin{to{transform:rotate(360deg)}}',
    /* 弹窗 */
    '.pn{display:none;position:fixed;z-index:2147483001;right:12px;bottom:calc(86px + env(safe-area-inset-bottom));width:min(392px,calc(100vw - 24px));max-height:calc(100dvh - 110px);overflow:hidden;flex-direction:column;',
    '  background:linear-gradient(165deg,rgba(17,26,35,.97),rgba(8,12,17,.97));border:1px solid rgba(255,255,255,.14);border-top:3px solid var(--ac);box-shadow:0 18px 50px rgba(0,0,0,.65),0 0 0 4px rgba(24,209,255,.05);backdrop-filter:blur(8px);animation:pop .28s cubic-bezier(.2,.8,.2,1)}',
    '.open .pn{display:flex}',
    '@keyframes pop{from{opacity:0;transform:translateY(14px) scale(.96)}}',
    '.hd{flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;background:linear-gradient(90deg,rgba(24,209,255,.14),transparent);border-bottom:1px solid rgba(255,255,255,.1)}',
    '.hd b{font-size:14px;letter-spacing:.24em;color:#fff}.hd em{font:600 10px/1 Oswald,system-ui;letter-spacing:.3em;color:var(--ac);font-style:normal}',
    '.hd .x{margin-left:auto;width:30px;height:30px;font-size:16px;color:#9fb2bf}.hd .x:hover{color:#fff}',
    '.bd{overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(24,209,255,.5) transparent}',
    /* 舞台: 小人 + 气泡 */
    '.st{position:relative;display:flex;align-items:flex-end;gap:6px;min-height:150px;padding:12px 14px 4px;overflow:hidden;background:radial-gradient(circle at 30% 100%,color-mix(in srgb,var(--ac) 22%,transparent),transparent 60%)}',
    '.am{position:relative;flex:none;width:112px;height:140px;transform-origin:50% 100%}',
    '.am img{position:absolute;left:0;bottom:0;width:112px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.6))}',
    '.am.talk{animation:talk .42s ease-out}',
    '@keyframes talk{0%{transform:scale(1,1)}25%{transform:scale(1.08,.9)}55%{transform:scale(.96,1.07) translateY(-4px)}100%{transform:scale(1,1)}}',
    '.am.idle{animation:bob 3.4s ease-in-out infinite}',
    '.bbw{position:relative;flex:1;min-width:0;align-self:flex-start;margin-top:6px}',
    '.bb{position:relative;min-height:56px;padding:9px 12px;border-radius:14px 14px 14px 2px;background:rgba(255,255,255,.95);color:#16202a;font-size:15px;line-height:1.55;font-weight:600;word-break:break-all;box-shadow:0 4px 14px rgba(0,0,0,.4)}',
    '.bb::before{content:"";position:absolute;left:-7px;bottom:10px;border:7px solid transparent;border-right-color:rgba(255,255,255,.95);border-left:0}',
    '.bb span{display:inline-block;animation:spit .5s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--d,0ms)}',
    '@keyframes spit{0%{opacity:0;transform:translate(var(--x),var(--y)) scale(.1) rotate(var(--r))}60%{opacity:1}100%{opacity:1;transform:none}}',
    '.fl{position:absolute;left:78px;bottom:58px;font-weight:800;font-size:15px;color:var(--ac);text-shadow:0 0 6px rgba(0,0,0,.8);pointer-events:none;animation:fly 1.5s ease-out forwards}',
    '@keyframes fly{0%{opacity:0;transform:translate(0,0) scale(.4)}15%{opacity:1}100%{opacity:0;transform:translate(var(--fx),var(--fy)) scale(1.2) rotate(var(--fr))}}',
    '.vz{position:absolute;left:0;right:0;bottom:0;height:22px;display:flex;align-items:flex-end;gap:3px;padding:0 14px;opacity:.55;pointer-events:none}',
    '.vz i{flex:1;height:3px;background:linear-gradient(0deg,var(--ac),transparent);transform-origin:50% 100%}',
    '.on .vz i{animation:eq .9s ease-in-out infinite alternate}',
    '@keyframes eq{from{height:3px}to{height:20px}}',
    /* 信息/进度/控制 */
    '.tt{padding:8px 16px 0}.tt b{display:block;font-size:17px;letter-spacing:.06em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tt span{font-size:12px;color:#9fb2bf}',
    '.pg{display:flex;align-items:center;gap:8px;padding:6px 16px 0;font:600 11px/1 Oswald,system-ui;color:#9fb2bf}',
    'input[type=range]{-webkit-appearance:none;appearance:none;flex:1;height:22px;background:none;touch-action:none}',
    'input[type=range]::-webkit-slider-runnable-track{height:4px;background:linear-gradient(90deg,var(--ac) var(--p,0%),rgba(255,255,255,.18) var(--p,0%))}',
    'input[type=range]::-moz-range-track{height:4px;background:rgba(255,255,255,.18)}input[type=range]::-moz-range-progress{height:4px;background:var(--ac)}',
    'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;background:#fff;border:2px solid var(--ac);box-shadow:0 0 8px var(--ac)}',
    'input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid var(--ac)}',
    '.ct{display:flex;align-items:center;justify-content:center;gap:6px;padding:4px 10px 8px}',
    '.ct button{width:44px;height:44px;border-radius:50%;font-size:18px;color:#dfe8ee;transition:background .15s,transform .1s}',
    '.ct button:hover{background:rgba(255,255,255,.1)}.ct button:active{transform:scale(.9)}',
    '.ct .pp{width:54px;height:54px;font-size:22px;background:var(--ac);color:#06121a;box-shadow:0 0 16px color-mix(in srgb,var(--ac) 60%,transparent)}.ct .pp:hover{background:var(--ac);filter:brightness(1.12)}',
    '.ct .md{font-size:12px;font-weight:700;letter-spacing:.05em;color:var(--ac);border:1px solid var(--ac);border-radius:14px;width:44px;height:28px}',
    '.vo{display:flex;align-items:center;gap:4px;width:92px;font-size:12px;color:#9fb2bf}.vo input{width:64px}',
    /* 歌词 / 列表 */
    '.sec{margin:2px 14px 0;padding:3px 0;font:700 10px/1 Oswald,system-ui;letter-spacing:.34em;color:var(--ac);border-bottom:1px solid rgba(255,255,255,.1)}',
    '.ly{height:104px;margin:4px 8px 0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;text-align:center;mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent)}',
    '.ly::-webkit-scrollbar{display:none}',
    '.lr{padding:3px 10px;font-size:13px;line-height:1.6;color:#7e929e;transition:color .25s,transform .25s}.lr.on{color:#fff;font-weight:700;font-size:15px;transform:scale(1.03)}',
    '.lr.no{padding:34px 0;color:#6f8390}',
    '.pl{padding:2px 6px 8px}',
    '.pi{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;text-align:left;border-left:3px solid transparent}',
    '.pi:hover{background:rgba(255,255,255,.06)}.pi.on{background:color-mix(in srgb,var(--c) 14%,transparent);border-left-color:var(--c)}',
    '.pi i{flex:none;width:20px;font:700 12px/1 Oswald,system-ui;font-style:normal;color:#7e929e;text-align:center}.pi.on i{color:var(--c)}',
    '.pi div{flex:1;min-width:0}.pi b{display:block;font-size:14px;font-weight:600;color:#e8f0f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pi span{font-size:11px;color:#8aa0ad}',
    '.pi u{flex:none;font:600 11px/1 Oswald,system-ui;text-decoration:none;color:#7e929e}',
    /* 触屏跟手小人 + 星星 */
    '.fg{position:fixed;z-index:2147483647;left:0;top:0;width:44px;height:44px;margin:-34px 0 0 -22px;pointer-events:none;opacity:0;transition:opacity .25s;will-change:transform}',
    '.fg.s{opacity:1}.fg img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 2px 5px rgba(0,0,0,.6));animation:wig .5s ease-in-out infinite alternate}',
    '@keyframes wig{from{transform:rotate(-8deg)}to{transform:rotate(8deg)}}',
    '.sp{position:fixed;z-index:2147483646;pointer-events:none;font-size:14px;color:#ffd23f;text-shadow:0 0 6px #ff7a2e;animation:sp .8s ease-out forwards}',
    '@keyframes sp{from{opacity:1;transform:translate(0,0) scale(1) rotate(0)}to{opacity:0;transform:translate(var(--sx),var(--sy)) scale(.3) rotate(var(--sr))}}',
    /* 整页模式 */
    ':host(.page){position:fixed;inset:0;display:block;overflow:auto;background:radial-gradient(circle at 70% 10%,#18324a,#070b10 70%)}',
    ':host(.page) .fab{display:none}:host(.page) .pn{display:flex;position:relative;right:auto;bottom:auto;margin:0 auto;top:0;width:min(440px,100%);max-height:none;min-height:100dvh;border-left:0;border-right:0;animation:none}',
    ':host(.page) .ly{height:150px}',
    /* 手机: 底部抽屉 */
    '@media (max-width:600px){',
    ' .pn{right:0;left:0;bottom:0;width:100%;max-height:86dvh;border-left:0;border-right:0;border-radius:14px 14px 0 0;padding-bottom:env(safe-area-inset-bottom)}',
    ' .vo{display:none}.fab{width:58px;height:58px}.fab img{width:56px;margin-left:-28px}',
    ' .st{min-height:132px}.am,.am img{width:96px}.am{height:120px}.bb{font-size:15px}',
    ' .ly{height:92px}:host(.page) .pn{max-height:none;border-radius:0}',
    '}',
    '@media (prefers-reduced-motion:reduce){.fab img,.am.idle,.on .vz i,.fab .ring{animation:none!important}.bb span{animation-duration:.01s!important}}'
  ].join('\n');

  var cur = 0, audio, playing = false, lrc = null, li = -1, mode = 'list', raf = 0, order = [];
  var el = {};

  function build() {
    host = document.createElement('div'); host.id = 'ak-mp';
    if (MODE === 'page') host.className = 'page';
    root = host.attachShadow({ mode: 'open' });
    var list = T.map(function (t, i) {
      return '<button class="pi" data-i="' + i + '" style="--c:' + t.color + '"><i>' + (i + 1) + '</i><div><b>' + esc(t.title) + '</b><span>' + esc(t.artist) + '</span></div><u>' + fmt(t.dur) + '</u></button>';
    }).join('');
    var bars = ''; for (var k = 0; k < 28; k++) bars += '<i style="animation-delay:-' + (Math.random() * 0.9).toFixed(2) + 's;animation-duration:' + (0.5 + Math.random() * 0.7).toFixed(2) + 's"></i>';
    root.innerHTML = '<style>' + CSS + '</style>' +
      '<div class="w' + (MODE === 'page' ? ' open' : '') + '" id="w">' +
      '<div class="fab" id="fab" title="阿米娅的小曲"><div class="ring"></div><img src="' + IMG + '" alt=""><span class="nt">♪</span></div>' +
      '<div class="pn" id="pn">' +
      '<div class="hd"><b>阿米娅的小曲</b><em>MUSIC PLAYER</em>' + (MODE === 'page' ? '' : '<button class="x" id="cl" aria-label="关闭">✕</button>') + '</div>' +
      '<div class="bd">' +
      '<div class="st"><div class="am idle" id="am"><img src="' + IMG + '" alt=""></div><div class="bbw"><div class="bb" id="bb">博士，要一起听歌吗？点一下播放键吧。</div></div><div class="vz">' + bars + '</div></div>' +
      '<div class="tt"><b id="ti"></b><span id="ar"></span></div>' +
      '<div class="pg"><span id="tc">0:00</span><input type="range" id="sk" min="0" max="1000" value="0" aria-label="进度"><span id="td">0:00</span></div>' +
      '<div class="ct"><button class="md" id="md" title="列表循环">循环</button><button id="pv" aria-label="上一首">⏮</button><button class="pp" id="pp" aria-label="播放">▶</button><button id="nx" aria-label="下一首">⏭</button><div class="vo">音量<input type="range" id="vl" min="0" max="100" value="80" aria-label="音量"></div></div>' +
      '<div class="sec">LYRICS · 歌词</div><div class="ly" id="ly"></div>' +
      '<div class="sec">PLAYLIST · ' + T.length + ' 首</div><div class="pl" id="pl">' + list + '</div>' +
      '</div></div>' +
      '<div class="fg" id="fg"><img src="' + TINY + '" alt=""></div></div>';
    document.body.appendChild(host);
    ['w', 'fab', 'pn', 'cl', 'am', 'bb', 'ti', 'ar', 'tc', 'td', 'sk', 'md', 'pv', 'pp', 'nx', 'vl', 'ly', 'pl', 'fg'].forEach(function (id) { el[id] = root.getElementById(id); });

    audio = new Audio(); audio.preload = 'metadata'; audio.crossOrigin = 'anonymous';
    var v = parseInt(ls('vol') || '80', 10); audio.volume = v / 100; el.vl.value = v; paint(el.vl);
    audio.addEventListener('ended', function () { next(true); });
    audio.addEventListener('play', function () { setPlaying(true); });
    audio.addEventListener('pause', function () { setPlaying(false); });
    audio.addEventListener('loadedmetadata', function () { el.td.textContent = fmt(audio.duration); });
    audio.addEventListener('error', function () { say('这首歌没加载出来……换一首试试？', true); });

    el.pp.onclick = function () { if (audio.paused) { if (!audio.src) load(cur); audio.play().catch(function () { say('浏览器没让我出声，再点一下播放键吧。', true); }); } else audio.pause(); };
    el.pv.onclick = function () { go(-1); }; el.nx.onclick = function () { go(1); };
    el.md.onclick = function () { mode = mode === 'list' ? 'one' : mode === 'one' ? 'shuffle' : 'list'; ls('mode', mode); modeUi(); };
    el.sk.oninput = function () { if (audio.duration) audio.currentTime = el.sk.value / 1000 * audio.duration; paint(el.sk); };
    el.vl.oninput = function () { audio.volume = el.vl.value / 100; ls('vol', el.vl.value); paint(el.vl); };
    el.pl.onclick = function (e) { var b = e.target.closest('.pi'); if (!b) return; var i = +b.dataset.i; if (i === cur && audio.src) { el.pp.onclick(); return; } load(i); audio.play().catch(function () { }); };
    el.ly.onclick = function (e) { var r = e.target.closest('.lr'); if (r && r.dataset.t) { audio.currentTime = +r.dataset.t; } };
    if (el.cl) el.cl.onclick = function () { el.w.classList.remove('open'); };
    el.am.onclick = function () { el.pp.onclick(); };
    mode = ls('mode') || 'list'; modeUi();
    var qt = parseInt((location.search.match(/[?&]t=(\d+)/) || [])[1], 10);   /* ?t=N 选第 N 首(1 起) */
    load(qt >= 1 && qt <= T.length ? qt - 1 : Math.min(+(ls('cur') || 0), T.length - 1), true);
    fab(); touchFx(); mediaKeys();
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function paint(r) { r.style.setProperty('--p', (r.value - r.min) / (r.max - r.min) * 100 + '%'); }
  function modeUi() { el.md.textContent = mode === 'one' ? '单曲' : mode === 'shuffle' ? '随机' : '循环'; el.md.title = mode === 'one' ? '单曲循环' : mode === 'shuffle' ? '随机播放' : '列表循环'; }

  function load(i, quiet) {
    cur = (i + T.length) % T.length; ls('cur', cur);
    var t = T[cur];
    audio.src = BASE + t.file; li = -1;
    lrc = t.lrc && t.lrc.length ? t.lrc : null;
    el.w.style.setProperty('--ac', t.color);
    el.ti.textContent = t.title; el.ar.textContent = t.artist; el.td.textContent = fmt(t.dur); el.tc.textContent = '0:00'; el.sk.value = 0; paint(el.sk);
    el.ly.innerHTML = lrc ? lrc.map(function (r) { return r[1] ? '<div class="lr" data-t="' + r[0] + '">' + esc(r[1]) + '</div>' : '<div class="lr" data-t="' + r[0] + '">♪</div>'; }).join('') : '<div class="lr no">♪ 暂无歌词，听听旋律吧 ♪</div>';
    [].forEach.call(el.pl.children, function (b, k) { b.classList.toggle('on', k === cur); });
    if (!quiet) say(lrc ? '《' + t.title + '》，开始啦。' : '《' + t.title + '》～这首没有歌词，我哼给你听。', true);
    if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: [{ src: IMG, sizes: '277x360', type: 'image/webp' }] }); } catch (e) { } }
  }
  function go(d) { var wasPlaying = !audio.paused; load(mode === 'shuffle' && d > 0 ? rnd() : cur + d); if (wasPlaying || d) audio.play().catch(function () { }); }
  function rnd() { if (T.length < 2) return 0; var n; do { n = Math.floor(Math.random() * T.length); } while (n === cur); return n; }
  function next() { if (mode === 'one') { audio.currentTime = 0; audio.play().catch(function () { }); } else { load(mode === 'shuffle' ? rnd() : cur + 1); audio.play().catch(function () { }); } }

  function setPlaying(p) {
    playing = p; el.w.classList.toggle('on', p); el.pp.textContent = p ? '⏸' : '▶'; el.am.classList.toggle('idle', !p);
    cancelAnimationFrame(raf); if (p) tick();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = p ? 'playing' : 'paused';
  }
  function tick() {
    var t = audio.currentTime, d = audio.duration || T[cur].dur || 1;
    el.tc.textContent = fmt(t); el.sk.value = Math.min(1000, t / d * 1000); paint(el.sk);
    if (lrc) {
      var i = -1, lo = 0, hi = lrc.length - 1;
      while (lo <= hi) { var m = (lo + hi) >> 1; if (lrc[m][0] <= t + 0.12) { i = m; lo = m + 1; } else hi = m - 1; }
      if (i !== li) { li = i; lyric(i); }
    } else if (li !== -2) { li = -2; say('♪ ～ ♪ ～', false); }
    if (playing) raf = requestAnimationFrame(tick);
  }
  function lyric(i) {
    var rows = el.ly.children;
    [].forEach.call(rows, function (r, k) { r.classList.toggle('on', k === i); });
    if (i < 0) { say('♪', false); return; }
    var txt = lrc[i][1];
    if (rows[i]) { var r = rows[i]; el.ly.scrollTo({ top: r.offsetTop - el.ly.clientHeight / 2 + r.clientHeight / 2, behavior: 'smooth' }); }
    say(txt || '♪ ～', false);
  }

  /* ---------- 阿米娅"吐"歌词 ---------- */
  function say(text, quiet) {
    var chars = Array.from(text), step = Math.min(46, 900 / Math.max(chars.length, 1));
    el.bb.textContent = '';
    chars.forEach(function (c, i) {
      var s = document.createElement('span'); s.textContent = c === ' ' ? '\u00a0' : c;
      s.style.setProperty('--d', (i * step) + 'ms'); s.style.setProperty('--x', (-50 - Math.random() * 40) + 'px'); s.style.setProperty('--y', (34 + Math.random() * 30) + 'px'); s.style.setProperty('--r', (Math.random() * 120 - 60) + 'deg');
      el.bb.appendChild(s);
    });
    if (!el.w.classList.contains('open') && MODE !== 'page') return;
    el.am.classList.remove('talk'); void el.am.offsetWidth; el.am.classList.add('talk');
    if (!quiet) { var n = Math.min(5, chars.length); for (var k = 0; k < n; k++) flyer(chars[Math.floor(Math.random() * chars.length)], k); }
  }
  function flyer(c, k) {
    if (!c || c === ' ') return;
    var f = document.createElement('div'); f.className = 'fl'; f.textContent = c;
    f.style.setProperty('--fx', (30 + Math.random() * 90) + 'px'); f.style.setProperty('--fy', (-50 - Math.random() * 60) + 'px'); f.style.setProperty('--fr', (Math.random() * 60 - 30) + 'deg'); f.style.animationDelay = (k * 90) + 'ms';
    el.am.parentNode.appendChild(f); setTimeout(function () { f.remove(); }, 1800 + k * 90);
  }

  /* ---------- 悬浮小人: 点击开合 + 拖动 ---------- */
  function fab() {
    if (MODE === 'page') return;
    var f = el.fab, sx, sy, ox, oy, moved, down = false;
    var pos = (ls('pos') || '').split(',');
    if (pos.length === 2) place(+pos[0], +pos[1]);
    function place(r, b) { var w = innerWidth - f.offsetWidth - 4, h = innerHeight - f.offsetHeight - 4; f.style.right = Math.min(Math.max(4, r), w) + 'px'; f.style.bottom = Math.min(Math.max(4, b), h) + 'px'; }
    f.addEventListener('pointerdown', function (e) { down = true; moved = false; sx = e.clientX; sy = e.clientY; var r = f.getBoundingClientRect(); ox = innerWidth - r.right; oy = innerHeight - r.bottom; try { f.setPointerCapture(e.pointerId); } catch (x) { } });
    f.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx, dy = e.clientY - sy; if (!moved && Math.abs(dx) + Math.abs(dy) < 7) return; moved = true; place(ox - dx, oy - dy); });
    f.addEventListener('pointerup', function (e) {
      if (!down) return; down = false;
      if (moved) { var r = f.getBoundingClientRect(); ls('pos', Math.round(innerWidth - r.right) + ',' + Math.round(innerHeight - r.bottom)); return; }
      el.w.classList.toggle('open'); if (el.w.classList.contains('open')) { say(el.bb.textContent || '博士，要一起听歌吗？', true); }
    });
    addEventListener('resize', function () { var r = f.getBoundingClientRect(); place(innerWidth - r.right, innerHeight - r.bottom); });
  }

  /* ---------- 手指滑动: 小阿米娅跟手 + 星星拖尾; 点击: 星星迸开 ---------- */
  function touchFx() {
    var fg = el.fg, last = 0, hide = 0;
    function spark(x, y, n, far) {
      for (var i = 0; i < n; i++) {
        var s = document.createElement('div'); s.className = 'sp'; s.textContent = Math.random() < .5 ? '✦' : '✧';
        var a = Math.random() * 6.283, d = (far ? 26 : 12) + Math.random() * (far ? 34 : 20);
        s.style.left = x + 'px'; s.style.top = y + 'px';
        s.style.setProperty('--sx', Math.cos(a) * d + 'px'); s.style.setProperty('--sy', (Math.sin(a) * d + (far ? 0 : 14)) + 'px'); s.style.setProperty('--sr', (Math.random() * 240 - 120) + 'deg');
        s.style.fontSize = (9 + Math.random() * 10) + 'px';
        root.getElementById('w').appendChild(s); setTimeout(function (e) { e.remove(); }.bind(null, s), 850);
      }
    }
    function follow(e) {
      if (e.pointerType === 'mouse') return;
      fg.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; fg.classList.add('s'); clearTimeout(hide);
      var n = Date.now(); if (n - last > 45) { last = n; spark(e.clientX, e.clientY, 1, false); }
    }
    function end(e) { if (e.pointerType === 'mouse') return; clearTimeout(hide); hide = setTimeout(function () { fg.classList.remove('s'); }, 700); }
    addEventListener('pointerdown', function (e) { follow(e); if (e.pointerType === 'mouse') spark(e.clientX, e.clientY, 5, true); else spark(e.clientX, e.clientY, 6, true); }, true);
    addEventListener('pointermove', follow, true);
    addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
  }

  function mediaKeys() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', function () { audio.play(); });
      navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { go(-1); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { go(1); });
    } catch (e) { }
  }

  /* 所有变量和函数都声明完之后再启动 */
  function start() { if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot); }
  if (window.AK_TRACKS) start();
  else { var sc = document.createElement('script'); sc.src = BASE + 'js/ak-music.js'; sc.onload = start; document.head.appendChild(sc); }
})();
