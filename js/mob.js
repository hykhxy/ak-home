/* 手机端:把桌面的"右侧详情面板"改成底部抽屉(.detail.open),仅在 body.mob 下生效 */
(() => {
'use strict';
const stage = document.getElementById('stage');
const body = document.body;
const mob = () => body.classList.contains('mob');

/* 点击这些元素后,打开对应的详情抽屉 */
const AUTO = [
  ['#oGrid .card', 'oDet'],
  ['#iGrid .itm', 'iDet'],
  ['#bsMap .bs-room', 'bsDet'],
  ['#evBody .ev-card', 'evSide'],
  ['#sqGrid .sqslot.empty', 'sqPick'],
];

const bd = document.createElement('div'); bd.id = 'sheetBd';
const bx = document.createElement('button'); bx.id = 'sheetX'; bx.type = 'button'; bx.setAttribute('aria-label', '关闭'); bx.textContent = '✕';
stage.append(bd, bx);

function closeSheet() {
  document.querySelectorAll('.detail.open').forEach(d => d.classList.remove('open'));
  body.classList.remove('sheet');
}
function openSheet(id) {
  if (!mob()) return;
  const el = document.getElementById(id); if (!el) return;
  closeSheet(); el.classList.add('open'); body.classList.add('sheet');
}
bd.addEventListener('click', closeSheet);
bx.addEventListener('click', closeSheet);

/* 捕获阶段判断(此时元素还没被重绘替换),延后一拍再开,让原有的选中/渲染逻辑先跑完 */
document.addEventListener('click', e => {
  if (!mob()) return;
  const t = e.target; if (!t || !t.closest) return;
  const sb = t.closest('[data-sheet]');
  if (sb) { const id = sb.dataset.sheet; setTimeout(() => openSheet(id), 0); return; }
  for (const [sel, id] of AUTO) if (t.closest(sel)) { setTimeout(() => openSheet(id), 0); return; }
}, true);

/* 切页 / 缩放回桌面 / Esc 时收起抽屉 */
let lastView = AK.view && AK.view();
setInterval(() => { const v = AK.view && AK.view(); if (v !== lastView) { lastView = v; closeSheet(); } if (!mob() && body.classList.contains('sheet')) closeSheet(); }, 300);
addEventListener('keydown', e => { if (e.key === 'Escape' && body.classList.contains('sheet')) { e.stopImmediatePropagation(); e.preventDefault(); closeSheet(); } }, true);

/* 锁死页面滚动:聚焦输入框等会让 body/html 被程序滚动,导致整个舞台上移 */
const unscroll = () => { if (!mob()) return; if (body.scrollTop) body.scrollTop = 0; const de = document.documentElement; if (de.scrollTop) de.scrollTop = 0; if (scrollY) scrollTo(0, 0); };
addEventListener('scroll', unscroll, true);
body.addEventListener('scroll', unscroll);

/* 首次进入手机端:弹出"建议横屏"引导(任何关闭都记住,以后不再弹) */
const GKEY = 'ak.landGuide';
const gGet = () => { try { return localStorage.getItem(GKEY); } catch (e) { return window.__akLG; } };
const gSet = () => { try { localStorage.setItem(GKEY, '1'); } catch (e) {} window.__akLG = '1'; };
const guide = document.createElement('div'); guide.id = 'landGuide';
guide.innerHTML = '<div class="lg-box"><div class="lg-ph"></div><div class="lg-t">建议横屏体验<small>LANDSCAPE MODE</small></div>' +
  '<div class="lg-s">本界面按横向 16:9 设计,横屏下信息更完整、画面更接近原作。<br>也可随时点主界面右下的<b>「公开招募」</b>切换横屏 / 竖屏。</div>' +
  '<button class="lg-go" type="button">点击横屏 ▸</button><button class="lg-no" type="button">先竖屏逛逛</button></div>';
document.body.appendChild(guide);
const hideGuide = () => { guide.classList.remove('on'); gSet(); };
guide.querySelector('.lg-go').addEventListener('click', () => { hideGuide(); AK.rotate && AK.rotate(); });
guide.querySelector('.lg-no').addEventListener('click', hideGuide);
guide.addEventListener('click', e => { if (e.target === guide) hideGuide(); });
if (mob() && !gGet()) {
  let n = 0;
  const iv = setInterval(() => {
    if (!mob() || ++n > 120) { clearInterval(iv); return; }
    const ld = document.getElementById('loader');
    if (ld && !ld.classList.contains('done') && getComputedStyle(ld).display !== 'none' && getComputedStyle(ld).visibility !== 'hidden') return;
    if (AK.view && AK.view() !== 'lobby') return;
    clearInterval(iv); setTimeout(() => { if (mob() && !gGet()) guide.classList.add('on'); }, 1200);
  }, 400);
}

AK.closeSheet = closeSheet; AK.openSheet = openSheet;
})();
