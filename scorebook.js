// scorebook.js — the book of scores (scores.book on the Concert Music stop).
//
// Each piece is an <li> in index.html with a folder of page images
// (p01.jpg, p02.jpg, …) and a page count. Shows two pages side by side like
// an open book (one page on phones). Click a page to see it full size.

export function initScoreBooks() {
  document.querySelectorAll('[data-scorebook]').forEach(setupBook);
}

const narrow = window.matchMedia('(max-width: 700px)');

// true = clicking a page opens it full size in a new tab; false = pages aren't clickable
const CLICK_PAGE_TO_ENLARGE = false;

function setupBook(root) {
  const scores = [...root.querySelectorAll('.book-scores li')].map((li) => {
    const folder = li.dataset.folder || '';
    return {
      title: li.dataset.title || 'score',
      folder: folder.endsWith('/') ? folder : `${folder}/`,
      pages: Math.max(1, parseInt(li.dataset.pages, 10) || 1),
      pdf: li.dataset.pdf || '',
      ext: li.dataset.ext || 'jpg',
      // data-orientation="landscape" → wide pages, shown one at a time at full width
      landscape: li.dataset.orientation === 'landscape',
    };
  });
  if (!scores.length) return;

  const select = root.querySelector('.book-select');
  const pdfLink = root.querySelector('.book-pdf');
  const spread = root.querySelector('.book-spread');
  const count = root.querySelector('.book-count');

  scores.forEach((s, i) => select.add(new Option(s.title, String(i))));

  // two page slots, each: <a><img></a> + a "p. N" label shown if the image is missing
  const slots = [0, 1].map(() => {
    const page = document.createElement('div');
    page.className = 'book-page';
    const link = document.createElement(CLICK_PAGE_TO_ENLARGE ? 'a' : 'span');
    if (CLICK_PAGE_TO_ENLARGE) {
      link.target = '_blank';
      link.rel = 'noopener';
    }
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.addEventListener('error', () => page.classList.add('missing'));
    img.addEventListener('load', () => page.classList.remove('missing'));
    const label = document.createElement('span');
    label.className = 'pg-label';
    link.append(img);
    page.append(link, label);
    spread.append(page);
    return { page, link, img, label };
  });

  let current = 0; // which piece
  let first = 1;   // the page number on the left

  const perSpread = () => (narrow.matches || scores[current].landscape ? 1 : 2);
  const pagePath = (s, n) => `${s.folder}p${String(n).padStart(2, '0')}.${s.ext}`;

  function render() {
    const s = scores[current];
    const per = perSpread();
    spread.classList.toggle('single', per === 1);
    spread.classList.toggle('landscape', s.landscape);
    first = Math.min(Math.max(1, first), s.pages);
    first -= (first - 1) % per; // keep spreads lined up: 1–2, 3–4, …

    slots.forEach((slot, k) => {
      const n = first + k;
      const show = k < per && n <= s.pages;
      slot.page.classList.toggle('blank', !show);
      slot.page.hidden = k >= per;
      if (!show) return;
      const src = pagePath(s, n);
      slot.page.classList.remove('missing');
      if (slot.img.getAttribute('src') !== src) slot.img.src = src;
      if (CLICK_PAGE_TO_ENLARGE) slot.link.href = src;
      slot.label.textContent = `${s.title}\np. ${n}`;
      slot.img.alt = `${s.title}, page ${n}`;
    });

    const last = Math.min(first + per - 1, s.pages);
    count.textContent = first === last ? `p. ${first} / ${s.pages}` : `p. ${first}–${last} / ${s.pages}`;
    pdfLink.hidden = !s.pdf;
    if (s.pdf) pdfLink.href = s.pdf;
  }

  function turn(dir) {
    const s = scores[current];
    const next = first + dir * perSpread();
    if (next < 1 || next > s.pages) return;
    spread.classList.add('turning');
    setTimeout(() => {
      first = next;
      render();
      spread.classList.remove('turning');
    }, 140);
  }

  root.querySelector('[data-act="prev"]').addEventListener('click', () => turn(-1));
  root.querySelector('[data-act="next"]').addEventListener('click', () => turn(1));
  select.addEventListener('change', () => {
    current = Number(select.value);
    first = 1;
    render();
  });
  narrow.addEventListener('change', render);

  render();
}
