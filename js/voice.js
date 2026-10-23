/* voice.js — 角色语音:任意干员台词浏览、分类、搜索、逐字播放 + 波形;朗读(浏览器 TTS) / 导入语音包 / 提示音三种发声方式 */
(() => {
'use strict';
const AK = window.AK, $ = s => document.querySelector(s), esc = AK.esc, st = AK.st, OPS = AK.OPS, VOICES = AK.VOICES, CVS = AK.CVS;
const CATS = [['all', '全部'], ['home', '日常 / 基建'], ['battle', '作战'], ['other', '其他']];
const CVL = { cn: '中', jp: '日', kr: '韩', en: '英' };
let idx = 0, cat = 'all', q = '', list = [], cur = -1, inited = false, raf = 0, hist = new Array(110).fill(0), playing = false;

const op = () => OPS[idx];
const linesOf = () => VOICES[op().id] || [];

function filter() {
  const all = linesOf(), qq = q.toLowerCase();
  list = all.map((l, i) => [l, i]).filter(([l]) => (cat === 'all' || l[2] === cat) && (!qq || l[0].toLowerCase().includes(qq) || l[1].toLowerCase().includes(qq)));
  $('#vcCnt').textContent = list.length;
}
function renderTabs() {
  const h = $('#vcTabs'); h.innerHTML = '';
  const all = linesOf();
  CATS.forEach(([v, l]) => {
    const n = v === 'all' ? all.length : all.filter(x => x[2] === v).length;
    const b = document.createElement('button'); b.className = 'chip' + (v === cat ? ' on' : ''); b.innerHTML = `${l}<i>${n}</i>`;
    b.addEventListener('click', () => { cat = v; cur = -1; renderTabs(); renderList(); }); h.appendChild(b);
  });
  const sp = document.createElement('span'); sp.style.flex = 1; h.appendChild(sp);
  const lgs = AK.vox.langsOf(op().id), LN = { CN: '中文原声', JP: '日语原声' };
  if (lgs.length) {
    const lb = document.createElement('span'); lb.className = 'lb'; lb.textContent = '配音'; h.appendChild(lb);
    [...lgs.filter(x => LN[x]).map(x => [x, LN[x]]), ['off', '无原声']].forEach(([v, l]) => {
      const b = document.createElement('button'); b.className = 'chip' + ((st.tts.lang || 'CN') === v ? ' on' : ''); b.textContent = l;
      b.addEventListener('click', () => { st.tts.lang = v; AK.save(); renderTabs(); renderList(); AK.vox.preload(op().id, v === 'off' ? null : v); }); h.appendChild(b);
    });
  } else { const lb = document.createElement('span'); lb.className = 'lb'; lb.textContent = '该干员暂无原声(使用朗读 / 提示音)'; h.appendChild(lb); }
  const imp = document.createElement('label'); imp.className = 'chip alt imp'; imp.title = '选择一个按 干员ID/CN_001.wav 命名的语音文件夹(如从游戏解包得到),即可播放真实配音';
  imp.innerHTML = `导入语音包<input type="file" id="vcPack" webkitdirectory multiple hidden>`; h.appendChild(imp);
  imp.querySelector('input').addEventListener('change', e => {
    const n = AK.vox.loadPack(e.target.files); AK.toast(n ? `已导入 ${n} 个音频,带 ♪ 标记的台词将播放真实配音` : '未识别到音频:文件需放在「干员ID」文件夹内,以 CN_001.wav 这类语音编号命名');
    renderList();
  });
}
function renderList() {
  filter(); const o = op(), box = $('#vcList');
  box.innerHTML = list.map(([l, i], k) => `<div class="vl${k === cur ? ' on' : ''}" data-k="${k}" style="--i:${Math.min(k, 20)}"><span class="n">${AK.p2(k + 1)}</span><em>${esc(l[0])}</em><p>${esc(l[1])}</p>${AK.vox.has(o.id, l[4]) ? '<span class="ps" title="有配音">♪</span>' : ''}</div>`).join('') || '<div class="empty">没有符合条件的台词</div>';
}
function renderInfo() {
  const o = op(), cv = CVS[o.id] || {}, all = linesOf();
  $('#vcInfo').innerHTML = `<div class="vi-n"><b>${esc(o.n)}</b><span>${esc(o.e)}</span></div>
    <div class="vi-s"><span style="color:${AK.RC[o.r]}">${AK.stars(o.r)}</span><span>${AK.PROF[o.p] || ''}</span><span>${esc(o.na || '')}</span></div>
    <div class="vi-cv">${Object.keys(CVL).map(k => (cv[k] && cv[k].length) ? `<div><small>CV·${CVL[k]}</small><b>${esc(cv[k].join(' / '))}</b></div>` : '').join('') || '<div><small>CV</small><b>—</b></div>'}</div>
    <div class="vi-c"><span>共 <b>${all.length}</b> 条</span><span>日常 <b>${all.filter(x => x[2] === 'home').length}</b></span><span>作战 <b>${all.filter(x => x[2] === 'battle').length}</b></span></div>
    <div class="vi-i">${AK.cur ? '' : ''}${(idx + 1)} / ${OPS.length}</div>`;
}
let artSeq = 0;
function setOp(i, dir = 1, silent) {
  idx = (i + OPS.length) % OPS.length; const o = op(); const my = ++artSeq;
  AK.vox.stop(); cur = -1; cat = cat; q = ''; $('#vcSearch').value = '';
  const img = $('#vcImg'), nm = new Image(); nm.onload = () => {
    if (my !== artSeq) return; img.src = nm.src;
    img.animate([{ opacity: 0, transform: `translateX(${dir * 60}px)` }, { opacity: 1, transform: 'none' }], { duration: AK.dur(520), easing: AK.EASE });
  }; nm.src = AK.art(o, false);
  AK.setTone(o.c); $('#vcAva').src = AK.avatar(o.id);
  setPlayerIdle();
  renderTabs(); renderList(); renderInfo();
  if (!silent) localStorage.setItem('ak.vcop', o.id);
}
function setPlayerIdle() {
  $('#plTitle').textContent = op().n; $('#plSub').textContent = '请选择一条台词'; $('#plText').textContent = '点击右侧台词开始播放 · 空格键播放 / 停止 · ↑↓ 切换台词 · ←→ 切换干员';
  $('#plPlay').textContent = '▶ 播放'; playing = false;
}

/* ---------- 播放 ---------- */
const KIND = { file: '真实配音(导入)', game: '游戏原声', tts: '浏览器朗读', blip: '提示音(未导入配音)' };
function play(k) {
  if (k < 0 || k >= list.length) return;
  cur = k; const [l] = list[k], o = op(), text = l[1];
  document.querySelectorAll('#vcList .vl.on').forEach(x => x.classList.remove('on'));
  const row = $(`#vcList .vl[data-k="${k}"]`); if (row) { row.classList.add('on'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  $('#plTitle').textContent = `${o.n} · ${l[0]}`; $('#plText').innerHTML = `<em></em>${esc(text)}`;
  AK.vox.preload(o.id);
  const r = AK.vox.play(o.id, l, {
    onStart: kind => { playing = true; $('#plPlay').textContent = '■ 停止'; $('#plSub').textContent = KIND[kind] || ''; },
    onTick: p => { const n = Math.ceil(p * text.length); $('#plText').innerHTML = `<em>${esc(text.slice(0, n))}</em>${esc(text.slice(n))}`; },
    onEnd: () => { playing = false; $('#plPlay').textContent = '▶ 播放'; },
    onStop: () => { playing = false; $('#plPlay').textContent = '▶ 播放'; },
  });
  if (!r) { $('#plText').textContent = text; }
}
function toggle() { if (playing) AK.vox.stop(); else play(cur < 0 ? 0 : cur); }

/* ---------- 波形 ---------- */
function wave() {
  raf = 0; if (AK.view() !== 'voice') return;
  const cv = $('#plWave'), c = cv.getContext('2d'), W = cv.width, H = cv.height;
  hist.push(AK.vox.level()); hist.shift(); c.clearRect(0, 0, W, H);
  const n = hist.length, bw = W / n, col = getComputedStyle(document.documentElement).getPropertyValue('--tone').trim() || '#18d1ff';
  for (let i = 0; i < n; i++) {
    const v = hist[i], h = Math.max(2, v * H * .95), x = i * bw;
    c.fillStyle = i > n - 6 ? '#fff' : col; c.globalAlpha = .35 + .65 * (i / n);
    c.fillRect(x + 1, (H - h) / 2, Math.max(2, bw - 3), h);
  }
  c.globalAlpha = 1; raf = requestAnimationFrame(wave);
}

/* ---------- TTS 设置 ---------- */
function fillVoices() {
  const sel = $('#plVoice'), vs = AK.ttsVoices ? AK.ttsVoices() : [];
  sel.innerHTML = vs.length ? vs.map(v => `<option value="${esc(v.name)}"${v.name === st.tts.voice ? ' selected' : ''}>${esc(v.name)}</option>`).join('') : '<option value="">(无中文语音)</option>';
  sel.disabled = !vs.length;
}

function init() {
  inited = true;
  $('#vcList').addEventListener('click', e => { const r = e.target.closest('.vl'); if (r) play(+r.dataset.k); });
  $('#plPlay').addEventListener('click', toggle);
  $('#vcPrev').addEventListener('click', () => setOp(idx - 1, -1));
  $('#vcNext').addEventListener('click', () => setOp(idx + 1, 1));
  $('#vcSearch').addEventListener('input', e => { q = e.target.value.trim(); cur = -1; renderList(); });
  $('#vcSearch').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return; const v = e.target.value.trim().toLowerCase(); if (!v) return;
    const i = OPS.findIndex(o => o.n.toLowerCase() === v || o.n.toLowerCase().includes(v) || o.e.toLowerCase().includes(v));
    if (i >= 0 && i !== idx) { setOp(i, i > idx ? 1 : -1); }
  });
  const tts = $('#plTts'), rate = $('#plRate'), pitch = $('#plPitch'), sel = $('#plVoice');
  tts.checked = !!st.tts.on; rate.value = st.tts.rate; pitch.value = st.tts.pitch;
  if (!('speechSynthesis' in window)) { tts.disabled = true; tts.parentElement.title = '当前浏览器不支持语音合成'; }
  else { fillVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', fillVoices); }
  tts.addEventListener('change', () => { st.tts.on = tts.checked; AK.save(); AK.toast(tts.checked ? '已开启朗读:使用浏览器内置语音合成(音色非原配音)' : '已关闭朗读'); });
  rate.addEventListener('input', () => { st.tts.rate = +rate.value; AK.save(); });
  pitch.addEventListener('input', () => { st.tts.pitch = +pitch.value; AK.save(); });
  sel.addEventListener('change', () => { st.tts.voice = sel.value; AK.save(); });
  addEventListener('keydown', e => {
    if (AK.view() !== 'voice' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.metaKey || e.ctrlKey) return;
    if (e.key === ' ') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); play(Math.min(list.length - 1, cur + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); play(Math.max(0, cur - 1)); }
    else if (e.key === 'ArrowRight') setOp(idx + 1, 1); else if (e.key === 'ArrowLeft') setOp(idx - 1, -1);
  });
}

AK.enter.voice = () => {
  if (!inited) init();
  const sv = localStorage.getItem('ak.vcop');
  idx = (typeof AK.curIdx === 'function') ? AK.curIdx() : 0; if (!OPS[idx]) idx = 0;
  cat = 'all'; setOp(idx, 1, true);
  if (!raf) raf = requestAnimationFrame(wave);
};
})();
