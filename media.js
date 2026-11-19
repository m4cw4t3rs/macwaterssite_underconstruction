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

  // --- Phones (main.js adds the "mobile" class) ---
  // Every video gets the phone's own play / sound / full-screen controls, and the
  // silent loops play only while they're on screen. The desktop extras (hover for
  // sound, tap to skip) are switched off so taps on the controls do what they say.
  if (document.documentElement.classList.contains('mobile')) {
    initMobileMedia();
    return;
  }

  // --- Play only while the stop is visible ---
  document.querySelectorAll('.station-panel').forEach((panel) => {
    const videos = [...panel.querySelectorAll('video')];
    if (!videos.length) return;
    const sync = () => {
      const here = panel.classList.contains('visible');
      videos.forEach((v) => {
        if (here) {
          // Only silent loops (videos marked `muted` in index.html) start by themselves;
          // videos with sound wait for the visitor to press play.
          if (v.defaultMuted) {
            v.preload = 'auto';
            v.play().catch(() => {});
          }
        } else {
          v.pause();
          if (v.dataset.soundGroup) setMuted(v, true);
        }
      });
    };
    new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
    sync();
  });

  // --- Window videos: sound tag + full-screen button ---
  // Every video in a window plays silently on its own (hover for sound). The ⛶
  // button in the title bar opens it full screen WITH sound and the usual player
  // controls (scrub, pause…). Leaving full screen puts it back to the silent loop.
  // <video data-fs-restart> = start from the beginning when opened full screen.
  const isFullscreen = (v) =>
    document.fullscreenElement === v || document.webkitFullscreenElement === v || v.webkitDisplayingFullscreen;
  let fsVideo = null;

  document.querySelectorAll('.win-window .win-body.media video').forEach((video) => {
    const win = video.closest('.win-window');
    const titlebar = win.querySelector('.win-titlebar');
    const closeBtn = titlebar?.querySelector('[data-close]');

    // the 🔇/🔊 tag in the title bar and the "hover for sound" tag (added if index.html doesn't have them)
    if (video.dataset.soundGroup && titlebar && !titlebar.querySelector('.sound-badge')) {
      const badge = document.createElement('span');
      badge.className = 'sound-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = '🔇';
      titlebar.insertBefore(badge, closeBtn);
    }
    if (video.dataset.soundGroup && !video.parentElement.querySelector('.sound-hint')) {
      const hint = document.createElement('div');
      hint.className = 'sound-hint';
      hint.setAttribute('aria-hidden', 'true');
      hint.innerHTML = '<span class="hint-before">🔈 click for sound</span>' +
        '<span class="hint-hover">🔈 hover for sound</span><span class="hint-tap">🔈 tap for sound</span>';
      video.after(hint);
    }

    if (!titlebar) return;
    const fs = document.createElement('button');
    fs.className = 'win-btn win-fs';
    fs.type = 'button';
    fs.title = 'full screen';
    fs.setAttribute('aria-label', 'watch full screen');
    fs.textContent = '⛶';
    titlebar.insertBefore(fs, closeBtn);

    fs.addEventListener('click', () => {
      allowSound();
      if (video.hasAttribute('data-fs-restart')) video.currentTime = 0;
      fsVideo = video;
      video.controls = true;
      setMuted(video, false);
      video.play().catch(() => {});
      const open = video.requestFullscreen || video.webkitRequestFullscreen;
      try {
        if (open) open.call(video)?.catch?.(() => {});
        else video.webkitEnterFullscreen?.();
      } catch { video.webkitEnterFullscreen?.(); }
    });
  });

  // back from full screen → silent loop again (unless the mouse is still over the window)
  const leftFullscreen = () => {
    const v = fsVideo;
    if (!v || isFullscreen(v)) return;
    fsVideo = null;
    v.controls = false;
    const win = v.closest('.win-window');
    if (!win?.matches(':hover')) setMuted(v, true);
    if (v.paused && v.closest('.station-panel')?.classList.contains('visible')) v.play().catch(() => {});
  };
  document.addEventListener('fullscreenchange', leftFullscreen);
  document.addEventListener('webkitfullscreenchange', leftFullscreen);
  document.querySelectorAll('video').forEach((v) => v.addEventListener('webkitendfullscreen', leftFullscreen));

  // --- Only one sound at a time ---
  // A video with sound starting → tell the music player (and other videos) to hush.
  document.querySelectorAll('video').forEach((v) => {
    v.addEventListener('play', () => {
      if (!v.muted) document.dispatchEvent(new CustomEvent('site-sound', { detail: { source: v } }));
    });
  });
  // Another sound started → mute hover-for-sound videos, pause any other playing video.
  document.addEventListener('site-sound', (e) => {
    const source = e.detail?.source;
    document.querySelectorAll('video').forEach((v) => {
      if (v === source || v.muted) return;
      if (v.dataset.soundGroup && source instanceof HTMLVideoElement && source.dataset.soundGroup === v.dataset.soundGroup) return;
      if (v.dataset.soundGroup) setMuted(v, true);
      else v.pause();
    });
  });

  // --- Clip switchers: one video window, a row of buttons to pick the clip ---
  // <div data-clips> holding a <video> + buttons with data-src (and data-poster).
  document.querySelectorAll('[data-clips]').forEach((box) => {
    const video = box.querySelector('video');
    const tabs = [...box.querySelectorAll('[data-src]')];
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        video.poster = tab.dataset.poster || '';
        video.src = tab.dataset.src;
        video.play().catch(() => {});
      });
    });
  });

  // --- Cycling videos: click the video to skip to the next section ---
  // <video data-cycle data-sources="a.mp4 b.mp4 c.mp4" data-posters="a.jpg b.jpg c.jpg">
  // Plays muted (hover for sound, like the meditations). Click = next section;
  // each section also rolls into the next when it ends, and it wraps around.
  // On a phone: the first tap turns the sound on, taps after that skip.
  document.querySelectorAll('video[data-cycle]').forEach((video) => {
    const sources = video.dataset.sources.trim().split(/\s+/);
    const posters = (video.dataset.posters || '').trim().split(/\s+/);
    const win = video.closest('.win-window');
    const counter = win?.querySelector('.cycle-count');
    let index = 0;

    const show = (i) => {
      index = (i + sources.length) % sources.length;
      video.poster = posters[index] || '';
      video.src = sources[index];
      if (counter) counter.textContent = `${index + 1}/${sources.length}`;
      if (win?.closest('.station-panel')?.classList.contains('visible')) video.play().catch(() => {});
    };

    video.addEventListener('click', () => {
      if (isFullscreen(video)) return; // full screen: the player's own controls handle clicks
      // still silent (first click, or a phone tap) → turn the sound on first
      if (video.muted) {
        setMuted(video, false);
        video.play().catch(() => {});
        return;
      }
      show(index + 1);
    });
    video.addEventListener('ended', () => show(index + 1));
    if (counter) counter.textContent = `1/${sources.length}`;
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
        if (e.pointerType === 'mouse' && !isFullscreen(video) && fsVideo !== video) setMuted(video, true);
      });
      // Click / tap: toggle this video's sound (this also counts as the
      // visitor's first click, so it works right away).
      video.addEventListener('click', () => {
        allowSound();
        if (isFullscreen(video)) return; // full screen: the player's own controls handle clicks
        if (video.hasAttribute('data-cycle')) return; // handled below (click = skip)
        if (video.muted) solo(video);
        else setMuted(video, true);
      });
    });
  });
}

function initMobileMedia() {
  const videos = [...document.querySelectorAll('.station-panel video')];

  videos.forEach((v) => {
    // window videos get controls (incl. full screen); the little decorative loop photos don't
    if (v.closest('.win-body')) v.controls = true;
  });

  // Silent loops start when at least half on screen and pause when scrolled away.
  const watcher = new IntersectionObserver((entries) => {
    entries.forEach(({ target: v, isIntersecting }) => {
      if (isIntersecting) {
        if (v.defaultMuted && v.muted) {
          v.preload = 'auto';
          v.play().catch(() => {});
        }
      } else if (!document.fullscreenElement && !v.webkitDisplayingFullscreen) {
        v.pause();
      }
    });
  }, { threshold: 0.5 });
  videos.forEach((v) => watcher.observe(v));

  // Only one sound at a time: un-muting or playing a video with sound pauses/mutes the others.
  const hushOthers = (source) => {
    videos.forEach((v) => {
      if (v === source || v.muted || v.paused) return;
      if (v.defaultMuted) v.muted = true;
      else v.pause();
    });
    document.dispatchEvent(new CustomEvent('site-sound', { detail: { source } }));
  };
  videos.forEach((v) => {
    v.addEventListener('play', () => { if (!v.muted) hushOthers(v); });
    v.addEventListener('volumechange', () => { if (!v.muted && !v.paused) hushOthers(v); });
  });
  // the music player (playlist.exe) starting → quiet the videos
  document.addEventListener('site-sound', (e) => {
    if (e.detail?.source instanceof HTMLVideoElement) return;
    videos.forEach((v) => {
      if (v.muted || v.paused) return;
      if (v.defaultMuted) v.muted = true;
      else v.pause();
    });
  });

  // Clip switchers (DreamVisions+ excerpts): the buttons still pick the clip.
  document.querySelectorAll('[data-clips]').forEach((box) => {
    const video = box.querySelector('video');
    const tabs = [...box.querySelectorAll('[data-src]')];
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        video.poster = tab.dataset.poster || '';
        video.src = tab.dataset.src;
        video.play().catch(() => {});
      });
    });
  });

  // Multi-part videos (TikTokBox): a "next part" button under the video,
  // and each part still rolls into the next when it ends.
  document.querySelectorAll('video[data-cycle]').forEach((video) => {
    const sources = video.dataset.sources.trim().split(/\s+/);
    const posters = (video.dataset.posters || '').trim().split(/\s+/);
    const counter = video.closest('.win-window')?.querySelector('.cycle-count');
    let index = 0;

    const bar = document.createElement('div');
    bar.className = 'clip-tabs';
    const next = document.createElement('button');
    next.className = 'player-btn clip-tab';
    bar.appendChild(next);
    video.after(bar);

    const label = () => {
      next.textContent = `part ${index + 1}/${sources.length} · next ⏭`;
      if (counter) counter.textContent = `${index + 1}/${sources.length}`;
    };
    const show = (i, play) => {
      const wasMuted = video.muted;
      index = (i + sources.length) % sources.length;
      video.poster = posters[index] || '';
      video.src = sources[index];
      video.muted = wasMuted;
      label();
      if (play) video.play().catch(() => {});
    };
    next.addEventListener('click', () => show(index + 1, true));
    video.addEventListener('ended', () => show(index + 1, true));
    label();
  });
}

function setMuted(video, muted) {
  if (!muted && video.muted) {
    // tell the music player (and anything else) that a video's sound just started
    document.dispatchEvent(new CustomEvent('site-sound', { detail: { source: video } }));
  }
  video.muted = muted;
  const win = video.closest('.win-window');
  if (!win) return;
  win.classList.toggle('sound-on', !muted);
  const badge = win.querySelector('.sound-badge');
  if (badge) badge.textContent = muted ? '🔇' : '🔊';
}
