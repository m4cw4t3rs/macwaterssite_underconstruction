// typewriter.js — text "types itself out" when a window appears.
//
// The window keeps its full size the whole time: letters that haven't been
// typed yet are just invisible, so nothing jumps around. Links, bold text,
// lists, and drawn headings (Old London) are left intact.

export const TYPE = {
  speed: 350,      // letters per second
  maxSeconds: 2.5, // long text speeds up so it never takes longer than this
};

const running = new WeakMap(); // element → function that finishes it instantly

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Type out all the text inside `el`, starting after `delay` seconds.
export function typeIn(el, delay = 0) {
  cancelTypeIn(el);
  if (!TYPE.speed || reducedMotion()) return;

  // Every bit of visible text, in reading order (skip drawn headings + hidden text).
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.closest('svg, .sr-only, .caret')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  if (!nodes.length) return;

  // Split each piece of text into "typed so far" + "still invisible".
  const items = nodes.map((node) => {
    const shown = document.createTextNode('');
    const rest = document.createElement('span');
    rest.className = 'tw-rest';
    rest.textContent = node.nodeValue;
    node.replaceWith(shown, rest);
    // split into whole characters so emoji never get cut in half mid-typing
    return { node, shown, rest, chars: Array.from(node.nodeValue), typed: 0 };
  });

  const caret = document.createElement('span');
  caret.className = 'caret tw-caret';
  caret.textContent = '▌';

  const total = items.reduce((sum, it) => sum + it.chars.length, 0);
  const speed = Math.max(TYPE.speed, total / TYPE.maxSeconds);
  let start = null;
  let frame = null;
  let timer = null;

  const finish = () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    caret.remove();
    items.forEach((it) => {
      if (it.shown.parentNode) {
        it.shown.replaceWith(it.node); // put the original text back, untouched
        it.rest.remove();
      }
    });
    running.delete(el);
  };

  const step = (now) => {
    if (start === null) start = now;
    let budget = Math.floor(((now - start) / 1000) * speed);
    let caretPlaced = false;
    for (const it of items) {
      const len = it.chars.length;
      const k = Math.max(0, Math.min(len, budget));
      if (it.typed !== k) {
        it.typed = k;
        it.shown.nodeValue = it.chars.slice(0, k).join('');
        it.rest.textContent = it.chars.slice(k).join('');
      }
      if (!caretPlaced && k < len && it.rest.parentNode) {
        it.rest.before(caret);
        caretPlaced = true;
      }
      budget -= len;
    }
    if (budget >= 0) finish();
    else frame = requestAnimationFrame(step);
  };

  running.set(el, finish);
  timer = setTimeout(() => { frame = requestAnimationFrame(step); }, delay * 1000);
}

// Stop typing and show all the text right away.
export function cancelTypeIn(el) {
  const finish = running.get(el);
  if (finish) finish();
}
