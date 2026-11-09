// media.js — videos inside windows.
//
// - Videos only play while their stop is on screen (saves battery + memory),
//   and pause when you move on.
// - <video data-sound-group="NAME">: every video in the same group plays at
//   once, muted. Hovering one (or tapping it on a phone) turns ITS sound on
//   and mutes the others. Moving the mouse away mutes it again.
// - Browsers block sound until the visitor has clicked/tapped something on the
//   page, so before that the little tag says "click for sound".

export function initMedia() {
  let soundAllowed = navigator.userActivation?.hasBeenActive ?? false;
  const allowSound = () => {
    soundAllowed = true;
    document.body.classList.add('sound-ok');
  };
  if (soundAllowed) allowSound();
  window.addEventListener('pointerdown', allowSound, { capture: true, once: true });
  window.addEventListener('keydown', allowSound, { capture: true, once: true });

  // --- Play only while the stop is visible ---
  document.querySelectorAll('.station-panel').forEach((panel) => {
    const videos = [...panel.querySelectorAll('video')];
    if (!videos.length) return;
    const sync = () => {
      const here = panel.classList.contains('visible');
      videos.forEach((v) => {
        if (here) {
          v.preload = 'auto';
          v.play().catch(() => {});
        } else {
          v.pause();
          setMuted(v, true);
        }
      });
    };
    new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
    sync();
  });

  // --- Sound groups ---
  const groups = {};
  document.querySelectorAll('video[data-sound-group]').forEach((v) => {
    (groups[v.dataset.soundGroup] ||= []).push(v);
  });

  Object.values(groups).forEach((videos) => {
    const solo = (video) => {
      if (!soundAllowed) return;
      videos.forEach((v) => setMuted(v, v !== video));
      if (video.paused) video.play().catch(() => {});
    };

    videos.forEach((video) => {
      const win = video.closest('.win-window') || video;
      win.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') solo(video);
      });
      win.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse') setMuted(video, true);
      });
      // Click / tap: toggle this video's sound (this also counts as the
      // visitor's first click, so it works right away).
      video.addEventListener('click', () => {
        allowSound();
        if (video.muted) solo(video);
        else setMuted(video, true);
      });
    });
  });
}

function setMuted(video, muted) {
  video.muted = muted;
  const win = video.closest('.win-window');
  if (!win) return;
  win.classList.toggle('sound-on', !muted);
  const badge = win.querySelector('.sound-badge');
  if (badge) badge.textContent = muted ? '🔇' : '🔊';
}
