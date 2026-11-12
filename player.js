// player.js — the 90s music player (playlist.exe on the Concert Music stop).
//
// Tracks are the <li data-src="..."> items in index.html. Click a track to
// play it; it moves on to the next one when a track ends. It keeps playing
// while you browse the site, stops if you close its window, and pauses if
// another sound starts (e.g. you hover a GUIDED_MEDITATIONS video).

export function initPlayers() {
  document.querySelectorAll('[data-player]').forEach(setupPlayer);
}

const fmt = (s) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

function setupPlayer(root) {
  const audio = new Audio();
  audio.preload = 'none';

  const items = [...root.querySelectorAll('.player-list li')];
  const now = root.querySelector('.player-now');
  const time = root.querySelector('.player-time');
  const progress = root.querySelector('.player-progress');
  const bar = root.querySelector('.player-bar');
  const playBtn = root.querySelector('[data-act="play"]');
  let index = -1;

  const title = () => (index >= 0 ? items[index].textContent.trim() : '');

  function load(i) {
    if (!items.length) return;
    index = (i + items.length) % items.length;
    items.forEach((li, k) => li.classList.toggle('active', k === index));
    audio.src = items[index].dataset.src;
    now.textContent = title();
    bar.style.width = '0%';
    time.textContent = '0:00';
  }

  function play() {
    if (index < 0) load(0);
    // let everything else on the site know a sound is starting
    document.dispatchEvent(new CustomEvent('site-sound', { detail: { source: audio } }));
    audio.play().catch(() => { now.textContent = `⚠ can’t play: ${title()}`; });
  }

  playBtn.addEventListener('click', () => (audio.paused ? play() : audio.pause()));
  root.querySelector('[data-act="next"]').addEventListener('click', () => { load(index + 1); play(); });
  root.querySelector('[data-act="prev"]').addEventListener('click', () => {
    if (audio.currentTime > 3) audio.currentTime = 0; // like a CD player: restart, then go back
    else { load(index - 1); play(); }
  });
  items.forEach((li, i) => li.addEventListener('click', () => { load(i); play(); }));

  // click / arrow keys on the progress bar to jump around
  progress.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const r = progress.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });
  progress.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') audio.currentTime += 5;
    if (e.key === 'ArrowLeft') audio.currentTime -= 5;
  });

  audio.addEventListener('play', () => { playBtn.textContent = '⏸'; });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; });
  audio.addEventListener('timeupdate', () => {
    time.textContent = fmt(audio.currentTime);
    if (audio.duration) bar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  });
  audio.addEventListener('ended', () => { load(index + 1); play(); });
  audio.addEventListener('error', () => {
    if (index >= 0) now.textContent = `⚠ file not found: ${title()}`;
  });

  // another sound on the site started → pause
  document.addEventListener('site-sound', (e) => {
    if (e.detail?.source !== audio) audio.pause();
  });

  // closing the window stops the music
  const win = root.closest('.win-window');
  if (win) {
    new MutationObserver(() => {
      if (win.classList.contains('closed')) audio.pause();
    }).observe(win, { attributes: true, attributeFilter: ['class'] });
  }
}
