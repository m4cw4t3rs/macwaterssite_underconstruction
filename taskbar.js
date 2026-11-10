// taskbar.js — a 90s-style taskbar along the bottom of the screen.
//
//  [ start ]  [ about_mac.txt ] [ upcoming.txt ]            🚧 3:14 PM
//
// - Start opens a little menu of links (castle / about / work / contact).
// - The middle shows one button per window at the current stop
//   (any .win-window inside the .station-panel that's currently visible).
//   Pressed-in = open. Click a closed one to reopen it, an open one to bring it forward.
// - The right side is a "system tray" with a clock.

import { bringToFront } from './drag.js';

export function initTaskbar({ onNavigate }) {
  const bar = document.getElementById('taskbar');
  const menu = document.getElementById('start-menu');
  if (!bar || !menu) return;

  const startBtn = bar.querySelector('.tb-start');
  const tasks = bar.querySelector('.tb-tasks');
  const clock = bar.querySelector('.tb-clock');

  // Clicks on the taskbar/menu shouldn't fall through to the 3D scene.
  bar.addEventListener('click', (e) => e.stopPropagation());
  menu.addEventListener('click', (e) => e.stopPropagation());

  // --- Start menu ---
  const setMenu = (open) => {
    menu.hidden = !open;
    startBtn.classList.toggle('pressed', open);
    startBtn.setAttribute('aria-expanded', String(open));
    if (!open) menu.querySelectorAll('.sm-has-sub.open').forEach((li) => setSub(li, false));
  };

  // Cascading sub-menus: open on hover (desktop) or by tapping the ▸ arrow.
  const setSub = (li, open) => {
    li.classList.toggle('open', open);
    li.querySelector('.sm-arrow')?.setAttribute('aria-expanded', String(open));
  };
  menu.querySelectorAll('.sm-has-sub').forEach((li) => {
    li.querySelector('.sm-arrow')?.addEventListener('click', () => setSub(li, !li.classList.contains('open')));
  });
  startBtn.addEventListener('click', () => setMenu(menu.hidden));
  window.addEventListener('click', () => setMenu(false)); // click anywhere else closes it
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  menu.querySelectorAll('[data-nav]').forEach((item) => {
    item.addEventListener('click', () => {
      setMenu(false);
      onNavigate(item.dataset.nav);
    });
  });

  // --- Window buttons ---
  function refresh() {
    const panel = document.querySelector('.station-panel.visible');
    const windows = panel ? [...panel.querySelectorAll('.win-window')] : [];

    tasks.replaceChildren(...windows.map((win) => {
      const btn = document.createElement('button');
      const title = win.querySelector('.win-titlebar span')?.textContent.trim() || 'window';
      btn.className = 'tb-task' + (win.classList.contains('closed') ? '' : ' pressed');
      btn.textContent = title;
      btn.title = title;
      btn.addEventListener('click', () => {
        win.classList.remove('closed');
        bringToFront(win);
        refresh();
      });
      return btn;
    }));
  }

  // Rebuild the buttons whenever a stop appears/disappears or a window opens/closes.
  const watcher = new MutationObserver(refresh);
  document.querySelectorAll('.station-panel').forEach((panel) => {
    watcher.observe(panel, { attributes: true, attributeFilter: ['class'], subtree: true });
  });
  refresh();

  // --- Clock ---
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 15000);
}
