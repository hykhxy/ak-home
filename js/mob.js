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

AK.closeSheet = closeSheet; AK.openSheet = openSheet;
})();
