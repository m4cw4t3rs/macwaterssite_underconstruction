// drag.js — makes things draggable, 90s-desktop style.
//
// In index.html:
//   data-drag              → this element can be dragged
//   data-drag-handle       → (optional, inside it) only this part starts a drag,
//                            e.g. a window's title bar. Without one, grab anywhere.
//
// Dragging uses the CSS `translate` property, so it stacks on top of any
// fly-in `transform` animation instead of fighting it.

let topZ = 10;

// Put an element on top of the other draggable things.
export function bringToFront(el) {
  el.style.zIndex = ++topZ;
}

export function initDraggables(root = document) {
  root.querySelectorAll('[data-drag]').forEach(makeDraggable);
  root.querySelectorAll('[data-resize]').forEach(makeResizable);
}

// data-resize → adds a size grip (◢) in the bottom-right corner. Dragging it
// changes the window's width; video/images inside keep their own shape, so the
// height follows along and the aspect ratio never changes.
function makeResizable(el) {
  const grip = document.createElement('div');
  grip.className = 'size-grip';
  grip.setAttribute('aria-hidden', 'true');
  el.appendChild(grip);

  const MIN_WIDTH = 160;
  let start = null;

  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // If the window is pinned by its right edge, re-pin it by its left edge
    // so it grows toward the grip instead of away from it.
    const rect = el.getBoundingClientRect();
    const parentRect = el.offsetParent ? el.offsetParent.getBoundingClientRect() : { left: 0 };
    const t = (getComputedStyle(el).translate || 'none').split(' ');
    const tx = t[0] === 'none' ? 0 : parseFloat(t[0]) || 0;
    el.style.left = `${rect.left - parentRect.left - tx}px`;
    el.style.right = 'auto';

    start = { x: e.clientX, y: e.clientY, width: rect.width, aspect: rect.width / rect.height };
    grip.setPointerCapture(e.pointerId);
    bringToFront(el);
    el.classList.add('dragging'); // keeps embedded players from grabbing the mouse
  });

  grip.addEventListener('pointermove', (e) => {
    if (!start) return;
    // Use whichever direction you pulled further (sideways or down).
    const byX = e.clientX - start.x;
    const byY = (e.clientY - start.y) * start.aspect;
    const grow = Math.abs(byX) > Math.abs(byY) ? byX : byY;
    const max = window.innerWidth * 0.9;
    el.style.width = `${Math.min(max, Math.max(MIN_WIDTH, start.width + grow))}px`;
  });

  const end = (e) => {
    if (!start) return;
    start = null;
    el.classList.remove('dragging');
    if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}

function makeDraggable(el) {
  const handle = el.querySelector('[data-drag-handle]') || el;
  handle.classList.add('drag-handle');

  let offset = { x: 0, y: 0 };  // how far it's been moved so far
  let start = null;             // pointer + offset at the start of a drag
  let moved = false;

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;              // left click / touch only
    if (e.target.closest('button, a')) return; // let buttons and links work
    e.preventDefault();

    start = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    moved = false;
    handle.setPointerCapture(e.pointerId);
    bringToFront(el);
    el.classList.add('dragging');
  });

  handle.addEventListener('pointermove', (e) => {
    if (!start) return;
    let x = start.ox + (e.clientX - start.x);
    let y = start.oy + (e.clientY - start.y);
    if (Math.hypot(x - start.ox, y - start.oy) > 3) moved = true;

    // Keep at least a bit of it on screen so it can always be grabbed again.
    el.style.translate = `${x}px ${y}px`;
    const r = el.getBoundingClientRect();
    const keep = 60;
    if (r.right < keep) x += keep - r.right;
    if (r.left > window.innerWidth - keep) x -= r.left - (window.innerWidth - keep);
    if (r.top < 0) y -= r.top;
    if (r.top > window.innerHeight - 30) y -= r.top - (window.innerHeight - 30);

    offset = { x, y };
    el.style.translate = `${x}px ${y}px`;
  });

  const end = (e) => {
    if (!start) return;
    start = null;
    el.classList.remove('dragging');
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);

    // Swallow the click that follows a drag, so dropping something on a
    // nav cube doesn't also trigger the cube.
    if (moved) {
      const swallow = (ev) => ev.stopPropagation();
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 100);
    }
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}
