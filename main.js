// main.js — Mac Waters 3D site
//
// Two layers are drawn every frame:
//   1. the main 3D scene (castle, title, and later the about/work stations)
//   2. a "HUD" overlay with the small nav cubes, pinned to the screen

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { initDraggables, initSpringDrag, bringToFront } from './drag.js';
import { initTaskbar } from './taskbar.js';
import { initMedia } from './media.js';
import { typeIn, cancelTypeIn } from './typewriter.js';
import { initPlayers } from './player.js';
import { initScoreBooks } from './scorebook.js';

// --- Phone mode ---------------------------------------------------------------
// On phones the site becomes one long page: a landing page with the castle
// (spin it with a finger), which shrinks into a small header as you scroll, then
// every section stacked underneath, its windows flying in as they come on screen
// (no flying camera, no nav cubes, no taskbar window buttons; windows can be
// flung by their title bars and spring back). Everything for phones is marked "MOBILE" below, and
// the phone-only styles live under "html.mobile" at the end of style.css,
// so the desktop site is untouched.
const MOBILE_QUERY = window.matchMedia('(max-width: 700px), (pointer: coarse) and (max-height: 500px)');
const MOBILE = MOBILE_QUERY.matches;
if (MOBILE) document.documentElement.classList.add('mobile');
// crossing between phone and desktop size (e.g. resizing a browser window) reloads into the other mode
MOBILE_QUERY.addEventListener('change', () => location.reload());

if (!MOBILE) initDraggables(); // windows + pngs marked data-drag in index.html
else initSpringDrag();         // phones: fling windows by the title bar, they spring back
initMedia();      // videos: play per stop, hover-for-sound groups
initPlayers();    // playlist.exe music player(s)
initScoreBooks(); // scores.book page-turning score viewer(s)

const CONTACT_EMAIL = 'macarthur.waters@gmail.com';

// --- Asset paths (works with any Vite "base") -------------------------------
const BASE = import.meta.env.BASE_URL || '/';
const asset = (rel) => {
  const b = BASE.endsWith('/') ? BASE : BASE + '/';
  const r = rel.startsWith('/') ? rel.slice(1) : rel;
  return b + r;
};

// --- Renderer, scene, camera -------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 1000);
camera.position.z = 50;

// --- Performance settings ---------------------------------------------------
// Retina screens are sharp enough without extra edge-smoothing, and drawing at
// 1.5× instead of 2× is about half the pixels — a big memory/battery saving.
const PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.5);
const MAX_TEXTURE_SIZE = MOBILE ? 512 : 1024; // shrink bigger model textures to this when they load (phones: smaller, they're tiny on screen + phones have less memory)

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: window.devicePixelRatio < 2,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // transparent, so the CSS gradient shows through
renderer.autoClear = false;           // we clear manually so we can draw two layers
renderer.domElement.id = 'three-canvas';

// --- Background gradient (plain CSS behind the canvas) -----------------------
const gradientBg = document.createElement('div');
gradientBg.id = 'gradient-bg';
document.body.appendChild(gradientBg);

// MOBILE: an empty, screen-tall "landing page" box at the top of the page. The
// castle shows through it; scrolling past it shrinks the castle into the header.
const mobileHero = MOBILE ? document.createElement('div') : null;
if (MOBILE) {
  mobileHero.id = 'mobile-hero';
  document.body.prepend(mobileHero);
  // All the sections go inside one full-width box that trims anything poking out
  // the sides (windows waiting to fly in, flung windows), so the page can never
  // scroll sideways or zoom out.
  const page = document.createElement('div');
  page.id = 'mobile-page';
  mobileHero.after(page);
  document.querySelectorAll('body > .station-panel').forEach((panel) => page.appendChild(panel));
}
document.body.appendChild(renderer.domElement);

// The size the main 3D view is drawn at: the whole window. (On phones the height
// only updates when the width changes — i.e. turning the phone — so the castle
// doesn't jump when the address bar slides away while scrolling.)
let mobileViewSize = null;
function viewSize() {
  if (!MOBILE) return { w: window.innerWidth, h: window.innerHeight };
  if (!mobileViewSize || mobileViewSize.w !== window.innerWidth) {
    mobileViewSize = { w: window.innerWidth, h: window.innerHeight };
  }
  return mobileViewSize;
}
if (MOBILE) {
  const { w, h } = viewSize();
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function setGradientColors(colors, stops) {
  const stopsString = colors.map((color, i) => `${color} ${stops[i]}`).join(', ');
  gradientBg.style.background = `linear-gradient(180deg, ${stopsString})`;
}
setGradientColors(
  ['#FFFFFF', '#004CFF', '#7720FA', '#FFC525', '#FF8C00', '#FF0000'],
  ['0%', '35%', '51%', '62%', '69%', '83%']
);

// --- Scroll stations ---------------------------------------------------------
// start/hold are measured in screen-heights of scrolling.
// The camera eases to cameraZ and "holds" there for `hold` screens.
// Each stop with windows has a matching <section id="NAME-panel"> in index.html.

// HIDE A PROJECT: put its name here and it disappears everywhere — desktop icon,
// Start-menu entry, and its stop in the scroll (the other stops close up).
// Its content stays in index.html; delete the name here to bring it back.
const HIDDEN_STOPS = ['filmscoring', 'bookofhours'];

const ALL_ZONES = [
  { name: 'home',          start: 0,   hold: 0, cameraZ: 50 },
  { name: 'about',         start: 1.2, hold: 0, cameraZ: 150 },
  { name: 'work',          start: 2.4, hold: 0, cameraZ: 250 }, // the desktop of project icons
  // --- the projects ---
  { name: 'dreamvisions',  start: 3.6, hold: 0, cameraZ: 350 },
  { name: 'meditations',   start: 4.8, hold: 0, cameraZ: 450 },
  { name: 'live',          start: 6.0, hold: 0, cameraZ: 550 },  // LIVE.exe — solo sets
  { name: 'bookofhours',   start: 7.2, hold: 0, cameraZ: 650 },
  { name: 'tiktokbox',     start: 8.4, hold: 0, cameraZ: 750 },
  { name: 'violarecital',  start: 9.6, hold: 0, cameraZ: 850 },
  { name: 'shokwii',       start: 10.8, hold: 0, cameraZ: 950 },
  { name: 'filmscoring',   start: 12.0, hold: 0, cameraZ: 1050 },
  { name: 'composition',   start: 13.2, hold: 0, cameraZ: 1150 },
];

// The stops actually in use: hidden ones removed, the rest re-spaced evenly
// (same spacing as above) so there's no empty gap where a hidden one was.
const STOP_SPACING = { start: 1.2, cameraZ: 100 };
const ZONE_DEFS = ALL_ZONES
  .filter((z) => !HIDDEN_STOPS.includes(z.name))
  .map((z, i) => ({ ...z, start: i * STOP_SPACING.start, cameraZ: ALL_ZONES[0].cameraZ + i * STOP_SPACING.cameraZ }));

// Hidden stops: their Start-menu items and windows disappear, but their desktop
// icons stay as "coming soon" (a note in the hover preview, no click-through).
const COMING_SOON_NOTE = '[page under construction, coming soon]';
HIDDEN_STOPS.forEach((name) => {
  document.querySelectorAll(`[data-nav="${name}"]`).forEach((el) => {
    if (el.classList.contains('desk-icon')) {
      el.classList.add('coming-soon');
      el.setAttribute('aria-disabled', 'true');
    } else {
      (el.closest('li') || el).hidden = true;
    }
  });
  const panel = document.getElementById(`${name}-panel`);
  if (panel) panel.hidden = true;
});

// Shortcut names for links (none needed right now).
const ZONE_ALIASES = {};

// How scrolling settles:
//   'paged'      = one scroll gesture (wheel flick, trackpad swipe, arrow key) = one stop.
//                  Handled here in main.js, so it feels the same in Chrome, Safari, Firefox.
//   'mandatory'  = the browser's own snapping (smooth in Safari, stuttery in Chrome)
//   'proximity'  = snaps only when you stop close to a stop
//   'none'       = free scrolling, no snapping
const SCROLL_MODE = 'paged';
const SCROLL_SNAP = SCROLL_MODE === 'paged' ? 'none' : SCROLL_MODE;

let zones = [];

function buildZones() {
  const h = window.innerHeight;
  zones = ZONE_DEFS.map((z) => ({ ...z, start: z.start * h, hold: z.hold * h }));
  if (MOBILE) return; // phones: the stacked sections give the page its length, no snapping

  // Make the page exactly tall enough to reach the last station.
  const last = ZONE_DEFS[ZONE_DEFS.length - 1];
  const spacer = document.getElementById('scroll-spacer');
  if (spacer) spacer.style.height = `${(last.start + last.hold + 1) * 100}vh`;

  // One invisible snap point at the start of each stop.
  document.documentElement.style.scrollSnapType = SCROLL_SNAP === 'none' ? '' : `y ${SCROLL_SNAP}`;
  document.querySelectorAll('.snap-point').forEach((el) => el.remove());
  if (SCROLL_SNAP !== 'none') {
    zones.forEach((z) => {
      const marker = document.createElement('div');
      marker.className = 'snap-point';
      marker.style.top = `${z.start}px`;
      document.body.appendChild(marker);
    });
  }
}
buildZones();

let targetCameraZ = camera.position.z;

function updateCameraTarget() {
  if (MOBILE) return; // phones: the camera stays at the castle
  const scrollY = window.scrollY;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const next = zones[i + 1];
    const nextStart = next ? next.start : Infinity;
    if (scrollY >= z.start && scrollY < nextStart) {
      if (scrollY <= z.start + z.hold || !next) {
        targetCameraZ = z.cameraZ;
      } else {
        const progress = (scrollY - (z.start + z.hold)) / (nextStart - (z.start + z.hold));
        targetCameraZ = THREE.MathUtils.lerp(z.cameraZ, next.cameraZ, progress);
      }
      return;
    }
  }
}

// While flying to a stop via a link (cube, icon, menu), the stops you fly
// THROUGH stay hidden — only the destination shows itself.
let flyingTo = null;
let frozenStop = null; // a full-screen video is open on this stop (see 'Full-screen video' below)
let flightTimer = null;

// `glide: true` = a one-stop scroll (paged scrolling): nothing is flown THROUGH, so the
// stop you're leaving fades out naturally (rose shrinks, windows recede) instead of
// vanishing at once like it does for a long jump.
function scrollToZone(name, { glide = false } = {}) {
  const target = ZONE_ALIASES[name] || name;
  if (MOBILE) {
    // phones: a project opens as its own page (see showMobileProject); anything
    // else scrolls the main page to that section. Either way it's remembered, so Back returns here.
    const el = target === 'home' ? null : document.getElementById(`${target}-panel`);
    if (target !== 'home' && !el) return;
    if (!fromHistory) {
      const url = target === 'home' ? location.pathname + location.search : `#${target}`;
      history.pushState({ stop: target }, '', url);
    }
    fromHistory = false;
    if (PROJECT_STOPS.includes(target)) {
      showMobileProject(target);
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    const wasOnProject = !!mobileProject;
    showMobileProject(null);
    const behavior = wasOnProject ? 'instant' : 'smooth'; // coming back from a project: jump straight there
    // the work desktop is the end of the page: go all the way down, so every icon shows
    if (target === 'work') window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
    else if (el) el.scrollIntoView({ behavior, block: 'start' });
    else window.scrollTo({ top: 0, behavior });
    return;
  }
  const z = zones.find((zone) => zone.name === target);
  if (!z) return;
  clearTimeout(flightTimer);
  if (glide) {
    flyingTo = null;
  } else {
    flyingTo = z;
    flightTimer = setTimeout(() => { flyingTo = null; }, 4000); // safety net
  }
  window.scrollTo({ top: z.start, behavior: 'smooth' });
}

// Is this stop allowed to show right now?
function stopMayShow(name) {
  return !flyingTo || flyingTo.name === name;
}

// The flight is over once the page AND the (slightly lagging) camera arrive...
function checkArrival() {
  if (!flyingTo) return;
  const scrolled = Math.abs(window.scrollY - flyingTo.start) < 2;
  const cameraHere = Math.abs(camera.position.z - flyingTo.cameraZ) < 1;
  if (scrolled && cameraHere) flyingTo = null;
}
// ...or as soon as the visitor takes over the scrolling themselves.
// (In 'paged' mode the wheel + arrow keys ARE the flights, so only touch counts.)
(SCROLL_MODE === 'paged' ? ['touchstart'] : ['wheel', 'touchstart', 'keydown']).forEach((type) => {
  window.addEventListener(type, () => { flyingTo = null; }, { capture: true, passive: true });
});

// --- Browser Back/Forward + shareable links ------------------------------------
// Every stop has its own address: macwaters.studio/#about, /#work, /#meditations …
// (the castle is the plain address). Arriving at a stop adds it to the browser
// history, so Back/Forward fly between stops, links open straight to a project,
// and refreshing keeps you where you were.
const BASE_TITLE = document.title;                 // full title, shown on the castle page
const SHORT_TITLE = BASE_TITLE.split(' · ')[0];   // "MAC WATERS 🏰", used on the other stops
let currentStop = null;  // the stop the address bar currently shows
let fromHistory = false; // true while flying because of Back/Forward

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function stopLabel(name) {
  const btn = document.querySelector(`#start-menu [data-nav="${name}"]`);
  if (!btn) return name;
  return btn.textContent.replace(/[^\p{L}\p{N}_+.\- ]/gu, '').trim(); // drop the emoji
}

function stopFromHash() {
  const name = decodeURIComponent(location.hash.slice(1));
  return zones.some((z) => z.name === name) ? name : 'home';
}

// Called every frame: once you've settled on a new stop, record it.
function updateHistory() {
  if (MOBILE) return;   // phones handle this in scrollToZone
  if (flyingTo || frozenStop) return; // wait until a flight lands
  const here = zones.find((z) =>
    Math.abs(window.scrollY - z.start) < 2 && Math.abs(camera.position.z - z.cameraZ) < 1);
  if (!here || here.name === currentStop) return;

  const url = here.name === 'home' ? location.pathname + location.search : `#${here.name}`;
  if (currentStop === null || fromHistory) history.replaceState({ stop: here.name }, '', url);
  else history.pushState({ stop: here.name }, '', url);
  fromHistory = false;
  currentStop = here.name;
  document.title = here.name === 'home' ? BASE_TITLE : `${SHORT_TITLE} · ${stopLabel(here.name)}`;
}

// Back / Forward (or typing an address with #something) → fly there.
window.addEventListener('popstate', () => {
  fromHistory = true;
  scrollToZone(stopFromHash());
});

// Links that go nowhere yet (href="#" placeholders) shouldn't send you to the castle.
document.addEventListener('click', (e) => {
  if (e.target.closest('a[href="#"]')) e.preventDefault();
});

// Opening the site with an address like /#filmscoring: jump straight there
// (no flying through every stop on the way).
function jumpToStopFromAddress() {
  const name = stopFromHash();
  if (name === 'home') return;
  if (MOBILE) {
    if (PROJECT_STOPS.includes(name)) {
      showMobileProject(name);
      return;
    }
    // wait for images to settle the page's height, then jump to that section
    const go = () => document.getElementById(`${name}-panel`)?.scrollIntoView({ block: 'start' });
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
    return;
  }
  const z = zones.find((zone) => zone.name === name);
  window.scrollTo({ top: z.start, behavior: 'instant' });
  camera.position.z = z.cameraZ;
  targetCameraZ = z.cameraZ;
}

// Desktop icons get scattered a little differently every time the page loads,
// so they never sit in a perfect row. (Smaller scatter on phones.)
const ICON_SCATTER = { x: 30, y: 22 }; // max nudge in pixels, sideways / up-down (kept small so icons stay clear of work.txt)
function scatterIcons() {
  const small = window.innerWidth < 700;
  const sx = small ? ICON_SCATTER.x * 0.3 : ICON_SCATTER.x;
  const sy = small ? ICON_SCATTER.y * 0.3 : ICON_SCATTER.y;
  const rand = (max) => Math.round((Math.random() * 2 - 1) * max);
  document.querySelectorAll('.desktop .desk-icon').forEach((icon) => {
    icon.style.left = `${rand(sx)}px`;
    icon.style.top = `${rand(sy)}px`;
  });
}
if (!MOBILE) scatterIcons(); // phones: icons sit in a tidy grid

// --- work.txt previews ---------------------------------------------------------
// Hovering (or tabbing to) a desktop icon swaps work.txt to that project's title
// and types out its one-line description (data-blurb on the icon in index.html).
// Moving off the icons brings back the default text.
const BLURB_TYPE_SPEED = 350; // 0 = no typing effect, just show it (typing speed itself is TYPE.speed in typewriter.js)
const workBlurb = document.getElementById('work-blurb');
// phones: no hover, so the instructions say "tap" (edit the phone wording here)
const MOBILE_ICON_HINT = 'tap an icon for a preview; tap it again to open.';
if (MOBILE && workBlurb) {
  const hint = [...workBlurb.querySelectorAll('p')].find((p) => /hover/i.test(p.textContent));
  if (hint) hint.textContent = MOBILE_ICON_HINT;
}
const blurbDefault = workBlurb ? workBlurb.innerHTML : '';
let blurbFrame = null;
let blurbRestore = null;
let blurbShowing = null;
let blurbTextEl = null; // the description line currently showing

function showBlurb(icon) {
  if (!workBlurb) return;
  cancelTypeIn(workBlurb); // if the intro is still typing itself out, stop it
  clearTimeout(blurbRestore);
  if (blurbShowing === icon) return;
  blurbShowing = icon;
  cancelAnimationFrame(blurbFrame);

  const title = icon.querySelector('.desk-label')?.textContent.trim() || '';
  const text = icon.dataset.blurb || '';
  if (blurbTextEl) cancelTypeIn(blurbTextEl);
  workBlurb.innerHTML = '<h3 class="blurb-title"></h3><p class="blurb-text"></p>';
  const titleEl = workBlurb.querySelector('.blurb-title');
  titleEl.textContent = title;
  if (icon.dataset.year) {
    // bold title, then the year in plain text (data-year on the icon in index.html)
    const year = document.createElement('span');
    year.className = 'year';
    year.textContent = icon.dataset.year;
    titleEl.append(' ', year);
  }
  // The description: words wrapped in *asterisks* become italic.
  blurbTextEl = workBlurb.querySelector('.blurb-text');
  blurbTextEl.innerHTML = blurbToHtml(text);
  if (icon.classList.contains('coming-soon')) {
    blurbTextEl.insertAdjacentHTML('beforeend', `<br><span class="soon-note">${COMING_SOON_NOTE}</span>`);
  }
  if (BLURB_TYPE_SPEED) typeIn(blurbTextEl, 0); // types it out, italics and all (typewriter.js)
}

// data-blurb text → safe HTML: *like this* → <i>like this</i>
function blurbToHtml(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*([^*]+)\*/g, '<i>$1</i>');
}

function restoreBlurb() {
  if (!workBlurb) return;
  // a short pause, so gliding from one icon to the next doesn't flicker
  clearTimeout(blurbRestore);
  blurbRestore = setTimeout(() => {
    cancelAnimationFrame(blurbFrame);
    if (blurbTextEl) cancelTypeIn(blurbTextEl);
    blurbTextEl = null;
    blurbShowing = null;
    workBlurb.innerHTML = blurbDefault;
  }, 250);
}

document.querySelectorAll('.desk-icon').forEach((icon) => {
  icon.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showBlurb(icon); });
  icon.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') restoreBlurb(); });
  icon.addEventListener('focus', () => showBlurb(icon));
  icon.addEventListener('blur', restoreBlurb);
});

// Desktop icons on the work stop: click (or Enter) flies to that project.
// A "coming soon" icon (hidden project) just wiggles and shows its preview instead.
// Phones work like a real Windows desktop: the first tap selects an icon (navy
// label, and work.txt types out its preview), tapping it again opens it.
function selectIcon(icon) {
  document.querySelectorAll('.desk-icon.selected').forEach((other) => {
    if (other !== icon) other.classList.remove('selected');
  });
  icon.classList.add('selected');
  showBlurb(icon);
}

function openIcon(icon) {
  if (MOBILE && !icon.classList.contains('selected')) {
    selectIcon(icon);
    return;
  }
  if (icon.classList.contains('coming-soon')) {
    showBlurb(icon); // (on phones there's no hover, so tapping shows the note)
    icon.classList.remove('nope');
    void icon.offsetWidth; // restart the wiggle if tapped again
    icon.classList.add('nope');
    return;
  }
  if (icon.classList.contains('selected')) {
    icon.classList.remove('selected');
    restoreBlurb(); // so work.txt shows its intro again when you come back
  }
  scrollToZone(icon.dataset.nav);
}

// phones: tapping anywhere that isn't an icon un-selects it (and work.txt goes back to its intro)
// ("click" = a real tap, so just scrolling past doesn't clear it)
if (MOBILE) {
  document.addEventListener('click', (e) => {
    if (e.target.closest('.desk-icon')) return;
    const selected = document.querySelectorAll('.desk-icon.selected');
    if (!selected.length) return;
    selected.forEach((icon) => icon.classList.remove('selected'));
    restoreBlurb();
  });
}

document.querySelectorAll('.desk-icon[data-nav]').forEach((icon) => {
  icon.addEventListener('click', () => openIcon(icon));
  icon.addEventListener('animationend', () => icon.classList.remove('nope'));
  icon.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openIcon(icon);
    }
  });
});

// Start menu links: a stop name, or "contact" for email.
// (On phones the taskbar keeps only the start button + clock; the window buttons are hidden in style.css.)
initTaskbar({
  onNavigate: (name) => {
    if (name === 'contact') window.location.href = `mailto:${CONTACT_EMAIL}`;
    else scrollToZone(name);
  },
});

// --- Lights + fog (same in both layers) -------------------------------------
// Directional lights only care about direction, so they light things the
// same way wherever the camera travels.
function addLightsAndFog(target) {
  target.add(new THREE.AmbientLight(0xff9c9c, 1.5));

  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(-70, 60, 64);
  target.add(key);

  const dim = new THREE.DirectionalLight(0x111111, 2);
  dim.position.set(40, 16.5, 0);
  target.add(dim);

  const fill = new THREE.DirectionalLight(0xffffff, 2);
  fill.position.set(-100, 0, 50);
  target.add(fill);

  // Anything 50+ units from the camera starts sinking into the dark; by 75 it's a silhouette.
  target.fog = new THREE.Fog(0x231f1f, 50, 75);
}
addLightsAndFog(scene);

// --- Memory savers for loaded models -----------------------------------------
// Shrink any model texture bigger than MAX_TEXTURE_SIZE (a 2048px texture uses
// 4× the memory of a 1024px one, and in a small header you can't tell).
function shrinkTextures(root, max = MAX_TEXTURE_SIZE) {
  const keys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of materials) {
      for (const key of keys) {
        const tex = m[key];
        const img = tex && tex.image;
        if (!img || !img.width || tex.userData.shrunk) continue;
        if (img.width <= max && img.height <= max) continue;
        const s = max / Math.max(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * s);
        canvas.height = Math.round(img.height * s);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        if (img.close) img.close(); // free the full-size decoded image
        tex.image = canvas;
        tex.userData.shrunk = true;
        tex.needsUpdate = true;
      }
    }
  });
}

// Once a model's shape has been sent to the graphics card, the browser doesn't
// need its own copy any more — drop it. (Measure sizes BEFORE calling this.)
function freeGeometryCopies(root) {
  const drop = function () { this.array = null; };
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const g = obj.geometry;
    g.computeBoundingBox();
    g.computeBoundingSphere();
    Object.values(g.attributes).forEach((attr) => attr.onUpload(drop));
    if (g.index) g.index.onUpload(drop);
  });
}

// --- Castle (Draco-compressed GLB) -------------------------------------------
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(asset('draco/'));
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// --- Intro: fade in once everything's loaded ----------------------------------
// The 3D scene stays hidden (html.loading, see style.css) until the castle and the
// MACWATERS title have downloaded AND been prepared for the graphics card; then the
// castle, title and cubes all fade in together — no popping in, no stutter.
const INTRO = {
  giveUpAfter: 10, // seconds: show the site anyway if loading takes longer than this
};
let introDone = false;

// called when each model finishes; reveals the scene once both are in
function introCheck() {
  if (introDone || !titleMesh || !castleModel) return;
  // Prepare every material + texture now (hidden), so the first visible frames don't hitch.
  try { renderer.compile(scene, camera); } catch { /* fine — it just happens on first draw */ }
  // let a few (invisible) frames draw, then fade everything in
  let frames = 0;
  const wait = () => (++frames < 4 ? requestAnimationFrame(wait) : finishIntro());
  requestAnimationFrame(wait);
}

function finishIntro() {
  if (introDone) return;
  introDone = true;
  document.documentElement.classList.remove('loading');
}
setTimeout(finishIntro, INTRO.giveUpAfter * 1000);

// Uses castle_lite.glb if it exists (a lighter version — see MEDIA_GUIDE.md),
// otherwise falls back to the original castle_web.glb.
const CASTLE_FILES = ['models/castle/castle_lite.glb', 'models/castle/castle_web.glb'];

let castleModel = null;
let castleBox = null; // the castle's size, measured once it loads (unscaled)

function loadCastle(files) {
  gltfLoader.load(
    asset(files[0]),
    (gltf) => {
      castleModel = gltf.scene;
      castleBox = new THREE.Box3().setFromObject(castleModel); // measure before moving it
      shrinkTextures(castleModel);
      freeGeometryCopies(castleModel);
      castleModel.position.set(0, -5, -50); // (relative to the camera — same spot as before)
      castleModel.scale.setScalar(2.9);
      castleModel.rotation.set(0, 150, 0);
      camera.add(castleModel); // travels with the camera, so it can become part of the header
      dracoLoader.dispose();   // done decoding — release its helper workers
      introCheck();
    },
    undefined,
    (err) => {
      if (files.length > 1) loadCastle(files.slice(1));
      else { console.error('failed to load castle:', err); finishIntro(); }
    }
  );
}
loadCastle(CASTLE_FILES);

// --- MACWATERS title ---------------------------------------------------------
// true  = the title rides along with the camera and settles at the top of the
//         screen as a header on every page
// false = the title stays behind at the castle like before
const TITLE_AS_HEADER = true;
const TITLE_HEADER = {
  top: 0.92,    // where its top edge sits: 1 = touching the top of the screen, 0.8 = lower
  scale: 0.21,  // its size as a header (it starts at 0.4 on the landing page; the castle scales with it)
};
const TITLE_DISTANCE = 50; // how far in front of the camera the header floats

let titleMesh = null;
let titleBox = null; // the model's size, measured once it loads (unscaled)
scene.add(camera); // lets things be attached to the camera
// (macwaters_text.glb is a lighter conversion of the original macwaters_text.obj)
gltfLoader.load(asset('models/macwaters_text.glb'), (gltf) => {
  const object = gltf.scene;
  object.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshPhongMaterial({ color: 0x000000, specular: 0xffffff, shininess: 65 });
    }
  });
  titleBox = new THREE.Box3().setFromObject(object); // measure before scaling
  freeGeometryCopies(object);
  object.scale.setScalar(0.4);
  object.rotation.set(0.3, 0, 0);
  if (TITLE_AS_HEADER) {
    object.position.set(0, 16.5, -TITLE_DISTANCE); // same starting spot, but measured from the camera
    camera.add(object);
  } else {
    object.position.set(0, 16.5, 0);
    scene.add(object);
  }
  titleMesh = object;
  updateIntroMotion();
  introCheck();
}, undefined, (err) => {
  console.error('failed to load title:', err);
  finishIntro();
});

// The title's letters form a tilted, spinning ring, so the part nearest the
// camera looks biggest and sits highest on screen. Walk around the ring and find
// the height that keeps every point of its top edge below TITLE_HEADER.top.
function titleHeaderY(scale, top = headerTop()) {
  if (!titleBox) return 16.5;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tilt = titleMesh.rotation.x;
  const cz = (titleBox.min.z + titleBox.max.z) / 2;
  const rz = (titleBox.max.z - titleBox.min.z) / 2;
  const yTop = titleBox.max.y * scale;

  let best = Infinity;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const z = (cz + rz * Math.cos(a)) * scale;
    const yTilted = yTop * Math.cos(tilt) - z * Math.sin(tilt);
    const zTilted = yTop * Math.sin(tilt) + z * Math.cos(tilt);
    const depth = TITLE_DISTANCE - zTilted;
    best = Math.min(best, top * tanHalf * depth - yTilted);
  }
  return best;
}

// MOBILE: two arrangements of the MACWATERS ring (with the castle inside it).
// Scrolling down the landing page glides from the first to the second.
//   fill = the ring's width as a fraction of the screen width
//   top  = where its top edge sits (1 = top of the screen, 0 = middle)
//   tilt = how far the castle tips toward you (degrees)
const TITLE_MOBILE = {
  landing: { fill: 1.0, top: 0.7, tilt: 10 },  // the landing page: big, centered
  header:  { fill: 0.5,  top: 0.97, tilt: 22 }, // a small logo pinned at the top
  scrollToHeader: 0.7, // how much of the landing page you scroll before it's fully a header (1 = all of it)
};
// The castle on the phone landing page: big, with the ring circling its tower tops (like desktop).
const CASTLE_MOBILE_LANDING = {
  fill: 1.0,   // castle width as a fraction of the ring's width (desktop is about 1.1)
  poke: 0.052,  // how far the tower tops rise above the middle of the ring (fraction of the ring's width)
};
let mobileIntro = 0;       // 0 = landing arrangement, 1 = header (eases toward the scroll)
let mobileIntroTarget = 0;
const mobileEase = () => THREE.MathUtils.smoothstep(mobileIntro, 0, 1);

function headerScale() {
  if (!MOBILE || !titleBox) return TITLE_HEADER.scale;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const halfW = tanHalf * TITLE_DISTANCE * camera.aspect;
  const halfH = tanHalf * TITLE_DISTANCE;
  const fill = THREE.MathUtils.lerp(TITLE_MOBILE.landing.fill, TITLE_MOBILE.header.fill, mobileEase());
  // (on a sideways phone, don't let it get wider than the screen is tall)
  const width = Math.min(2 * halfW * fill, 2 * halfH * fill * 1.2);
  return width / (titleBox.max.x - titleBox.min.x);
}
function headerTop() {
  if (!MOBILE) return TITLE_HEADER.top;
  return THREE.MathUtils.lerp(TITLE_MOBILE.landing.top, TITLE_MOBILE.header.top, mobileEase());
}

// As you start scrolling, the title rises and the castle sinks back.
// It happens over the scroll from the castle to the next stop.
function updateIntroMotion() {
  const introScroll = zones[1] ? zones[1].start : window.innerHeight;
  // phones: always in the small "header" arrangement (castle inside the ring)
  const progress = MOBILE ? 1 : Math.min(window.scrollY / introScroll, 1);
  if (titleMesh && TITLE_AS_HEADER) {
    const s = headerScale();
    const headerY = titleHeaderY(s);
    titleMesh.position.y = THREE.MathUtils.lerp(16.5, headerY, progress);
    titleMesh.scale.setScalar(THREE.MathUtils.lerp(0.4, s, progress));
  } else if (titleMesh) {
    titleMesh.position.z = THREE.MathUtils.lerp(0, -20, progress);
    titleMesh.position.y = THREE.MathUtils.lerp(16.5, 30, progress);
  }
}

// On the first scroll, the castle shrinks and rises into the MACWATERS ring,
// becoming a little logo in the header that you can still drag to spin.
const CASTLE_HOME = { x: 0, y: -5, z: -50, scale: 2.9 }; // landing-page spot (relative to camera)
const CASTLE_HEADER = {
  fill: 0.55,    // castle width as a fraction of the ring's width
  maxTop: 0.95,  // never taller than this (1 = the top edge of the screen)
  yOffset: 0,    // nudge it up (+) or down (-) inside the ring
  tilt: 22,      // degrees it tips its top toward you, so you see less of its underside
};

// Where the MACWATERS ring ends up as a header: its middle and its width.
function titleRingHeader() {
  const s = headerScale();
  if (!titleBox || !titleMesh) return { cy: 24, width: 45 };
  return {
    cy: titleHeaderY(s) + ((titleBox.min.y + titleBox.max.y) / 2) * s,
    width: (titleBox.max.x - titleBox.min.x) * s,
  };
}

const castleHeaderPos = new THREE.Vector3();
const castleHomePos = new THREE.Vector3(CASTLE_HOME.x, CASTLE_HOME.y, CASTLE_HOME.z);

function updateCastle() {
  if (!castleModel || !castleBox) return;
  const homeZ = ZONE_DEFS[0].cameraZ;
  const nextZ = ZONE_DEFS[1].cameraZ;
  const p = MOBILE ? 1 : THREE.MathUtils.clamp((camera.position.z - homeZ) / (nextZ - homeZ), 0, 1);
  const eased = THREE.MathUtils.smoothstep(p, 0, 1);

  // Size it to fit inside the ring, but never taller than the screen allows.
  const ring = titleRingHeader();
  const size = castleBox.getSize(new THREE.Vector3());
  const centerY = (castleBox.min.y + castleBox.max.y) / 2;
  const targetCY = ring.cy + CASTLE_HEADER.yOffset;
  const screenTop = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * TITLE_DISTANCE * CASTLE_HEADER.maxTop;
  let s = (ring.width * CASTLE_HEADER.fill) / Math.max(size.x, size.z);
  s = Math.min(s, (2 * (screenTop - targetCY)) / size.y);

  castleHeaderPos.set(0, targetCY - centerY * s, -TITLE_DISTANCE);

  if (MOBILE) {
    // phones: glide from the big landing castle (ring around its towers) to the header logo
    const e = mobileEase();
    const sLanding = (ring.width * CASTLE_MOBILE_LANDING.fill) / Math.max(size.x, size.z);
    const towerTop = ring.cy + ring.width * CASTLE_MOBILE_LANDING.poke;
    castleLandingPos.set(0, towerTop - castleBox.max.y * sLanding, -TITLE_DISTANCE);
    castleModel.position.lerpVectors(castleLandingPos, castleHeaderPos, e);
    castleModel.scale.setScalar(THREE.MathUtils.lerp(sLanding, s, e));
    const tilt = THREE.MathUtils.lerp(TITLE_MOBILE.landing.tilt, TITLE_MOBILE.header.tilt, e);
    castleModel.rotation.x = THREE.MathUtils.degToRad(tilt);
    return;
  }

  castleModel.position.lerpVectors(castleHomePos, castleHeaderPos, eased);
  castleModel.scale.setScalar(THREE.MathUtils.lerp(CASTLE_HOME.scale, s, eased));
  castleModel.rotation.x = THREE.MathUtils.degToRad(CASTLE_HEADER.tilt) * eased;
}
const castleLandingPos = new THREE.Vector3();

// =============================================================================
// ABOUT station — floating rose head + bio window (the window lives in index.html)
// =============================================================================
const ABOUT_Z = ZONE_DEFS.find((z) => z.name === 'about').cameraZ;
const ROSE_DISTANCE = 30;             // how far in front of the camera it floats
const ROSE_GROW_RANGE = 45;           // how early (camera distance) it starts growing in
let roseScale = 1;

// Resting rotation, in degrees — use this to make the rose face forward.
// The cursor-following is added on top of this.
const ROSE_ROTATION = { x: 0, y: 180, z: 0 };

const roseGroup = new THREE.Group(); // moves + follows the cursor
const roseSpin = new THREE.Group();  // the click-to-swap spin happens here
const rosePivot = new THREE.Group(); // holds the fixed resting rotation
roseGroup.add(roseSpin);
roseSpin.add(rosePivot);
const roseBase = new THREE.Vector3();
let roseNativeHeight = 1;

// MOBILE: the rose gets its own little 3D view, placed in the about section
// between about_mac.txt and upcoming.txt (the slot is made here, sized in style.css).
// ROSE_MOBILE_SIZE = the rose's height as a fraction of its box (smaller = more room to turn without being cut off)
const ROSE_MOBILE_SIZE = 0.75;
let roseView = null; // { slot, renderer, scene, camera, onScreen }
if (MOBILE) {
  // a row: the rose on the left, the sticker photo of me on the right
  const row = document.createElement('div');
  row.id = 'rose-row';
  const slot = document.createElement('div');
  slot.id = 'rose-slot';
  slot.setAttribute('aria-label', 'a rose with eyes (tap it)');
  row.appendChild(slot);
  const sticker = document.querySelector('#about-panel .about-photo');
  if (sticker) row.appendChild(sticker);
  document.querySelector('#about-panel .about-window')?.after(row);
  const roseRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: window.devicePixelRatio < 2 });
  roseRenderer.setPixelRatio(PIXEL_RATIO);
  roseRenderer.setClearColor(0x000000, 0);
  slot.appendChild(roseRenderer.domElement);
  const roseScene = new THREE.Scene();
  addLightsAndFog(roseScene); // (defined further down; function declarations work before their line)
  const roseCamera = new THREE.PerspectiveCamera(75, 1, 0.5, 200);
  roseCamera.position.set(0, 0, ROSE_DISTANCE);
  roseScene.add(roseGroup);
  roseView = { slot, renderer: roseRenderer, scene: roseScene, camera: roseCamera, onScreen: false };
  new IntersectionObserver(([entry]) => { roseView.onScreen = entry.isIntersecting; }).observe(slot);
  roseRenderer.domElement.addEventListener('click', () => startSwapSpin(clock.getElapsedTime()));
} else {
  scene.add(roseGroup);
}

function sizeRoseView() {
  if (!roseView) return;
  const w = roseView.slot.clientWidth || 1;
  const h = roseView.slot.clientHeight || 1;
  roseView.renderer.setSize(w, h);
  roseView.camera.aspect = w / h;
  roseView.camera.updateProjectionMatrix();
}
sizeRoseView();
// re-fit whenever the rose's box changes size (e.g. after a style.css edit, or turning the phone)
if (roseView) new ResizeObserver(() => sizeRoseView()).observe(roseView.slot);

function applyRoseRotation() {
  const d = THREE.MathUtils.degToRad;
  rosePivot.rotation.set(d(ROSE_ROTATION.x), d(ROSE_ROTATION.y), d(ROSE_ROTATION.z));
}

// Rose head colors — change these freely. Keys are the material names
// inside rose_head_2.obj; the comment says which part each one is.
const ROSE_COLORS = {
  aiStandardSurface1SG1: '#c8102e', // petals
  aiStandardSurface2SG1: '#0a0a0a', // eyeballs
  aiStandardSurface3SG1: '#f2f2f2', // irises
  aiStandardSurface4SG1: '#2f6b2a', // petal base
  aiStandardSurface5SG1: '#3f8f3a', // neck leaves
  aiStandardSurface7SG1: '#2e6b2b', // leaf stems
};
const ROSE_ROUGHNESS = 0.55; // 0 = glossy, 1 = matte

const roseMaterials = {};
function roseMaterial(name) {
  if (!roseMaterials[name]) {
    roseMaterials[name] = new THREE.MeshStandardMaterial({
      name,
      color: ROSE_COLORS[name] || '#ff00ff', // bright pink = a part with no color set
      roughness: ROSE_ROUGHNESS,
      metalness: 0,
      side: THREE.DoubleSide, // petals are single sheets, so draw both faces
    });
  }
  return roseMaterials[name];
}

new OBJLoader().load(asset('models/rose_head_2.obj'), (rose) => {
  // Swap in our own materials (a mesh can have one material or a list of them).
  rose.traverse((child) => {
    if (!child.isMesh) return;
    child.material = Array.isArray(child.material)
      ? child.material.map((m) => roseMaterial(m.name))
      : roseMaterial(child.material.name);
  });

  // Re-center the model so it turns around its own middle.
  const box = new THREE.Box3().setFromObject(rose);
  rose.position.sub(box.getCenter(new THREE.Vector3()));
  roseNativeHeight = box.getSize(new THREE.Vector3()).y;
  freeGeometryCopies(rose);
  rosePivot.add(rose);
  applyRoseRotation();
  layoutAbout();
  fitHeadToRose();
});

// --- Click the rose: it whirls around and turns into my head (click again to
// turn back). Drop the scan in public/models/ as mac_head.glb — until that file
// exists, clicking just does the spin.
const HEAD_FILE = 'models/mac_head.glb';
const HEAD_ROTATION = { x: 0, y: 0, z: 0 }; // resting rotation (degrees) so the face looks forward
const HEAD_SIZE = 1.0;                       // height relative to the rose (1 = same height)
const SWAP_SPIN = {
  turns: 2,        // full turns per click
  duration: 1.1,   // seconds
};

const headPivot = new THREE.Group();
headPivot.visible = false;
roseSpin.add(headPivot);
let headModel = null;
let headNativeHeight = 1;
let showingHead = false;
let swapStart = -1;     // clock time the current spin began (-1 = not spinning)
let swapDone = true;    // has this spin's model swap happened yet?

function fitHeadToRose() {
  if (!headModel) return;
  headModel.scale.setScalar((roseNativeHeight / headNativeHeight) * HEAD_SIZE);
}

gltfLoader.load(
  asset(HEAD_FILE),
  (gltf) => {
    const head = gltf.scene;
    shrinkTextures(head);
    const box = new THREE.Box3().setFromObject(head);
    const center = box.getCenter(new THREE.Vector3());
    headNativeHeight = box.getSize(new THREE.Vector3()).y || 1;
    // Wrap so re-centering and scaling don't fight each other.
    const inner = new THREE.Group();
    head.position.sub(center);
    inner.add(head);
    headModel = inner;
    freeGeometryCopies(head);
    const d = THREE.MathUtils.degToRad;
    headPivot.rotation.set(d(HEAD_ROTATION.x), d(HEAD_ROTATION.y), d(HEAD_ROTATION.z));
    headPivot.add(headModel);
    fitHeadToRose();
  },
  undefined,
  () => console.info(`No ${HEAD_FILE} yet — the rose will spin but not swap.`)
);

function startSwapSpin(t) {
  if (swapStart >= 0) return; // already spinning
  swapStart = t;
  swapDone = false;
}

// Called every frame from updateAbout.
function updateSwapSpin(t) {
  if (swapStart < 0) return;
  const p = Math.min((t - swapStart) / SWAP_SPIN.duration, 1);
  const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // ease in-out
  roseSpin.rotation.y = eased * Math.PI * 2 * SWAP_SPIN.turns;
  // Pinch to nothing at the midpoint so the swap itself is hidden.
  roseSpin.scale.setScalar(Math.max(1 - Math.pow(Math.sin(Math.PI * p), 6), 0.001));

  if (!swapDone && p >= 0.5) {
    swapDone = true;
    if (headModel) {
      showingHead = !showingHead;
      rosePivot.visible = !showingHead;
      headPivot.visible = showingHead;
    }
  }
  if (p >= 1) {
    swapStart = -1;
    roseSpin.rotation.y = 0;
    roseSpin.scale.setScalar(1);
  }
}

// Is a screen point over the rose/head? (Uses a sphere around it — the exact
// mesh shape is freed from memory after upload, see freeGeometryCopies.)
const roseRay = new THREE.Raycaster();
const roseNdc = new THREE.Vector2();
const roseHitSphere = new THREE.Sphere();
function roseAt(p) {
  if (!roseGroup.visible || p.x === OFFSCREEN) return false;
  roseNdc.set((p.x / window.innerWidth) * 2 - 1, -(p.y / window.innerHeight) * 2 + 1);
  roseRay.setFromCamera(roseNdc, camera);
  roseHitSphere.set(roseGroup.position, roseNativeHeight * roseGroup.scale.x * 0.45);
  return roseRay.ray.intersectsSphere(roseHitSphere);
}

// Place the rose head relative to what the camera can see at the about stop:
// to the right of the bio window on wide screens, above it on tall phones.
// Where the rose head sits on a laptop/desktop screen.
//   x: 0 = center, 1 = right edge   (-1 = left edge)
//   y: 0 = middle, 1 = top edge     (-1 = bottom edge)
const ROSE_SPOT = { x: 0.36, y: -0.22 };

function layoutAbout() {
  if (roseView) {
    // phones: centered in its own view, filling most of its height
    const halfH = Math.tan(THREE.MathUtils.degToRad(roseView.camera.fov / 2)) * ROSE_DISTANCE;
    roseBase.set(0, 0, 0);
    roseScale = (halfH * 2 * ROSE_MOBILE_SIZE) / roseNativeHeight;
    return;
  }
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * ROSE_DISTANCE;
  const halfW = halfH * camera.aspect;
  const portrait = camera.aspect < 1;
  roseBase.set(
    portrait ? 0 : halfW * ROSE_SPOT.x,
    portrait ? halfH * 0.5 : halfH * ROSE_SPOT.y,
    ABOUT_Z - ROSE_DISTANCE
  );
  const targetHeight = portrait ? halfH * 0.5 : halfH * 0.65;
  roseScale = targetHeight / roseNativeHeight;
}
layoutAbout();

// How the rose head follows the cursor.
const ROSE_LOOK = {
  turn: 0.9,      // how far it turns left/right (radians at the screen edge)
  nod: 0.5,       // how far it tilts up/down
  ease: 0.08,     // 0–1: lower = lazier, higher = snappier
  autoSpin: 0,    // set to e.g. 0.35 to bring back the slow spin
  touchHoldMs: 3000, // phones: how long it keeps looking at your last touch before drifting off
};

// phones: where the screen was last touched (the rose looks there)
let touchLook = null;
if (MOBILE) {
  const remember = (e) => {
    if (e.pointerType === 'mouse') return;
    touchLook = { x: e.clientX, y: e.clientY, time: performance.now() };
  };
  window.addEventListener('pointerdown', remember, { passive: true });
  window.addEventListener('pointermove', remember, { passive: true });
}

const roseTilt = new THREE.Vector2(); // eases toward the mouse
const roseScreen = new THREE.Vector3();

// How close the camera has to be to a stop for its windows to fly in
// (and how far past it before they sink away).
const LEAVE_DISTANCE = 12;

// A stop's 2D windows are in one of three states:
//   'offstage' — waiting off the sides of the screen (before you arrive)
//   'visible'  — flown in
//   'receded'  — sunk back into the dark (after you've moved on)
// Coming back from 'receded', they're snapped offstage first (no animation)
// so they always fly in from the sides, the same way every time.
function setPanelState(panel, state) {
  const current = panel.dataset.state || 'offstage';
  if (current === state) return;

  if (current === 'receded' && state === 'visible') {
    panel.classList.add('no-anim');
    panel.classList.remove('receded');
    void panel.offsetWidth; // let the browser register the offstage spot
    panel.classList.remove('no-anim');
  }

  panel.classList.toggle('visible', state === 'visible');
  panel.classList.toggle('receded', state === 'receded');
  panel.dataset.state = state;

  // Text windows type themselves out as they arrive (see typewriter.js),
  // starting just after each window's own fly-in delay.
  const textBodies = panel.querySelectorAll('.win-window .win-body:not(.media)');
  textBodies.forEach((body) => {
    if (state === 'visible') {
      const win = body.closest('.win-window');
      const delay = parseFloat(getComputedStyle(win).getPropertyValue('--delay')) || 0;
      typeIn(body, 0.25 + delay);
    } else {
      cancelTypeIn(body);
    }
  });
}

function updateAbout(t) {
  if (roseView) {
    // phones: it looks toward wherever you last touched the screen, and after a
    // few seconds drifts back to gently looking around on its own
    roseGroup.visible = true;
    roseGroup.scale.setScalar(roseScale);
    roseGroup.position.set(0, Math.sin(t * 1.4) * 0.6, 0);
    let lookX = Math.sin(t * 0.35) * 0.55;
    let lookY = Math.sin(t * 0.5) * 0.3;
    if (touchLook && performance.now() - touchLook.time < ROSE_LOOK.touchHoldMs) {
      const r = roseView.slot.getBoundingClientRect();
      lookX = THREE.MathUtils.clamp((touchLook.x - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1);
      lookY = THREE.MathUtils.clamp(-(touchLook.y - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1);
    }
    roseTilt.x += (-lookY * ROSE_LOOK.nod - roseTilt.x) * ROSE_LOOK.ease;
    roseTilt.y += (lookX * ROSE_LOOK.turn - roseTilt.y) * ROSE_LOOK.ease;
    roseGroup.rotation.x = roseTilt.x;
    roseGroup.rotation.y = roseTilt.y;
    updateSwapSpin(t);
    return;
  }
  // The rose rides just in front of the camera: it grows in as you arrive at
  // the about stop and shrinks away as you leave (in either direction).
  const fromStop = Math.abs(camera.position.z - ABOUT_Z);
  const arrive = stopMayShow('about')
    ? THREE.MathUtils.smoothstep(1 - fromStop / ROSE_GROW_RANGE, 0, 1)
    : 0;
  roseGroup.visible = arrive > 0.001;
  roseGroup.scale.setScalar(roseScale * arrive);
  roseGroup.position.set(
    roseBase.x,
    roseBase.y + Math.sin(t * 1.4) * 0.6,
    camera.position.z - ROSE_DISTANCE
  );

  // Look toward the cursor, measured from where the rose sits on screen.
  let lookX = 0;
  let lookY = 0;
  if (cursor.x !== OFFSCREEN) {
    roseScreen.copy(roseGroup.position).project(camera); // -1..1 screen coords
    const mx = (cursor.x / window.innerWidth) * 2 - 1;
    const my = -(cursor.y / window.innerHeight) * 2 + 1;
    lookX = THREE.MathUtils.clamp(mx - roseScreen.x, -1, 1);
    lookY = THREE.MathUtils.clamp(my - roseScreen.y, -1, 1);
  }
  roseTilt.x += (-lookY * ROSE_LOOK.nod - roseTilt.x) * ROSE_LOOK.ease;
  roseTilt.y += (lookX * ROSE_LOOK.turn - roseTilt.y) * ROSE_LOOK.ease;

  roseGroup.rotation.x = roseTilt.x;
  roseGroup.rotation.y = roseTilt.y + t * ROSE_LOOK.autoSpin;
  updateSwapSpin(t);
}

// Every stop with a matching "<name>-panel" element in index.html gets the
// same behavior: windows fly in on arrival, sink away (shrink, blur, fade)
// when you move on, and anything you closed reopens when you come back.
const stationPanels = ZONE_DEFS
  .map((z) => ({ name: z.name, cameraZ: z.cameraZ, el: document.getElementById(`${z.name}-panel`) }))
  .filter((s) => s.el);

// "◀ back to desktop" button: shows on every project stop (everything after
// "work" in ZONE_DEFS), hidden on the castle, about, and the desktop itself.
const PROJECT_STOPS = ZONE_DEFS.slice(ZONE_DEFS.findIndex((z) => z.name === 'work') + 1).map((z) => z.name);
const backButton = document.getElementById('back-to-desktop');
backButton?.addEventListener('click', (e) => {
  e.stopPropagation();
  scrollToZone('work');
});

// MOBILE: every section is always "visible" (so videos, players etc. work), and
// each window swoops in as it scrolls onto the screen — from the same side it
// flies in from on desktop (data-fly), or from below. Its text types itself out
// the first time. Scroll back up past it and it resets, so it flies in again.
// "back to desktop" shows once you've scrolled down into the projects.
const firstProjectPanel = document.getElementById(`${PROJECT_STOPS[0]}-panel`);
let mobileCheckReveals = () => {}; // (phones: set below)
if (MOBILE) {
  stationPanels.forEach(({ el }) => {
    el.classList.add('visible');
    el.dataset.state = 'visible';
  });

  // (Checked by height on the page only — a window waiting off the side of the
  // screen still counts as "here" once its row scrolls into view.)
  const REVEAL_AT = 0.88; // flies in once its top passes this far down the screen (1 = bottom edge)
  const typed = new WeakSet();
  const reveals = [];
  const checkReveals = () => {
    const h = window.innerHeight;
    reveals.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.height) return; // closed / hidden
      if (r.top < h * REVEAL_AT && r.bottom > 0) {
        if (el.classList.contains('in-view')) return;
        el.classList.add('in-view');
        if (!typed.has(el)) {
          typed.add(el);
          el.querySelectorAll('.win-body:not(.media)').forEach((body) => typeIn(body, 0.2));
        }
      } else if (r.top > h && !el.classList.contains('dragging')) {
        el.classList.remove('in-view'); // it's below the screen again → ready to fly in again
      }
    });
  };
  mobileCheckReveals = checkReveals;
  window.addEventListener('scroll', checkReveals, { passive: true });
  window.addEventListener('resize', checkReveals);
  window.addEventListener('load', checkReveals);
  document.addEventListener('click', () => requestAnimationFrame(checkReveals)); // e.g. past.txt opening
  requestAnimationFrame(checkReveals);

  document.querySelectorAll('.station-panel > *, #work-panel .desk-icon').forEach((el) => {
    if (el.classList.contains('desktop')) return; // its icons animate one by one instead
    if (!el.dataset.fly) {
      el.dataset.fly = el.classList.contains('about-window') ? 'left'
        : el.classList.contains('news-window') ? 'right'
        : el.id === 'rose-row' ? 'zoom'
        : 'up';
    }
    el.classList.add('reveal');
    reveals.push(el);
  });
}
// MOBILE project pages: the main page ends at the work desktop. Tapping an icon
// (or a project in the start menu) swaps the page for just that project, under
// the small castle header; "◀ back to desktop" swaps back.
let mobileProject = null; // the project page showing (null = the main page)
if (MOBILE) {
  PROJECT_STOPS.forEach((name) => document.getElementById(`${name}-panel`)?.classList.add('project-stop'));
}
function showMobileProject(name) {
  const el = name ? document.getElementById(`${name}-panel`) : null;
  document.querySelectorAll('.station-panel.project-showing').forEach((p) => p.classList.remove('project-showing'));
  mobileProject = el ? name : null;
  document.documentElement.classList.toggle('project-open', !!el);
  if (el) {
    el.classList.add('project-showing');
    el.querySelectorAll('.reveal').forEach((r) => r.classList.remove('in-view')); // so its windows fly in fresh
    mobileIntro = mobileIntroTarget = 1; // castle straight to the header
  }
  onScroll();
  requestAnimationFrame(() => mobileCheckReveals());
}

function updateMobileBackButton() {
  if (!backButton || !firstProjectPanel) return;
  const onProject = !!mobileProject;
  if (backButton.classList.contains('visible') === onProject) return;
  backButton.classList.toggle('visible', onProject);
  backButton.tabIndex = onProject ? 0 : -1;
}

function updateStations() {
  if (MOBILE) return updateMobileBackButton();
  const camZ = camera.position.z;
  let onProject = false;
  for (const { name, cameraZ, el } of stationPanels) {
    const arrived = Math.abs(camZ - cameraZ) < LEAVE_DISTANCE && stopMayShow(name);
    if (arrived && PROJECT_STOPS.includes(name)) onProject = true;
    // Leaving = camera moved on past it, OR you clicked away to another stop
    // while it was showing. Either way it fades and sinks (never flies off).
    const clickedAway = !stopMayShow(name) && el.dataset.state === 'visible';
    const leaving = camZ > cameraZ + LEAVE_DISTANCE || clickedAway || (el.dataset.state === 'receded' && !arrived);
    if (arrived && el.dataset.state !== 'visible') {
      // arriving reopens any windows you closed — except ones marked data-start-closed
      // (like past.txt), which go back to closed until you open them again
      el.querySelectorAll('.win-window.closed:not([data-start-closed])').forEach((w) => w.classList.remove('closed'));
      el.querySelectorAll('.win-window[data-start-closed]').forEach((w) => w.classList.add('closed'));
    }
    setPanelState(el, arrived ? 'visible' : leaving ? 'receded' : 'offstage');
  }
  if (backButton && backButton.classList.contains('visible') !== onProject) {
    backButton.classList.toggle('visible', onProject);
    backButton.tabIndex = onProject ? 0 : -1;
  }
}

document.getElementById('about-close')?.addEventListener('click', () => scrollToZone('home'));

// Any × button marked data-close just closes its own window (until reload).
document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => btn.closest('.win-window')?.classList.add('closed'));
});

// A button marked data-open="ID" opens that (closed) window and brings it to the front
// — e.g. "past shows ↗" in upcoming.txt opens past.txt.
document.querySelectorAll('[data-open]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const win = document.getElementById(btn.dataset.open);
    if (!win) return;
    const wasClosed = win.classList.contains('closed');
    win.classList.remove('closed');
    bringToFront(win);
    if (wasClosed) {
      win.classList.remove('pop');
      void win.offsetWidth; // restart the little pop-open animation
      win.classList.add('pop');
      win.querySelectorAll('.win-body:not(.media)').forEach((body) => typeIn(body, 0.1));
    }
  });
});

// --- Drag to spin the castle -------------------------------------------------
let isDragging = false;
let didDrag = false; // true if the mouse actually moved while held down
let dragStart = { x: 0, y: 0 };
let lastPointer = { x: 0, y: 0 };
let spinVelocity = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
  isDragging = true;
  didDrag = false;
  dragStart = { x: e.clientX, y: e.clientY };
  lastPointer = { x: e.clientX, y: e.clientY };
  spinVelocity = 0;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging || !castleModel) return;
  if (Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 5) didDrag = true;
  const deltaX = e.clientX - lastPointer.x;
  castleModel.rotation.y += deltaX * 0.01;
  spinVelocity = deltaX * 0.01;
  lastPointer = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

// MOBILE: spin the castle with a finger — swipe sideways to spin, swipe up/down
// still scrolls the page (style.css sets touch-action: pan-y on the canvas).
if (MOBILE) {
  const canvas = renderer.domElement;
  let touchX = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return; // (the mouse version is above)
    // touching a cube: it pops and spins (see MOBILE_CUBE_TAP)
    if (mobileCubeShow > 0.5 && !mobileProject) {
      const item = navItemAt({ x: e.clientX, y: e.clientY });
      if (item) {
        item.tappedAt = clock.getElapsedTime();
        item.spinKick = MOBILE_CUBE_TAP.spin;
      }
    }
    touchX = e.clientX;
    isDragging = true;
    spinVelocity = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (touchX === null || !castleModel) return;
    const deltaX = e.clientX - touchX;
    castleModel.rotation.y += deltaX * 0.012;
    spinVelocity = deltaX * 0.012;
    touchX = e.clientX;
  });
  const endTouch = () => { touchX = null; isDragging = false; };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch); // the phone decided it's a scroll
}

// =============================================================================
// HUD nav cubes — small, spinning, pinned to the screen
// =============================================================================
const hudScene = new THREE.Scene();
// Orthographic camera measured in screen pixels: (0,0) is the bottom-left corner.
const hudCamera = new THREE.OrthographicCamera(0, window.innerWidth, window.innerHeight, 0, -1000, 1000);

hudScene.add(new THREE.AmbientLight(0xff9c9c, 1.5));
const hudLight = new THREE.DirectionalLight(0xffffff, 2);
hudLight.position.set(-1, 1, 1);
hudScene.add(hudLight);

// Where each cube sits. pos() gets screen width, height, and cube size in px.
// labelSide says which side of the cube its word appears on.
const NAV_ITEMS = [
  {
    label: 'about',
    color: 0xff0000,
    labelSide: 'right',
    pos: (w, h, s) => [s * 1.3, h - s * 1.3],          // top left
    onClick: () => scrollToZone('about'),
  },
  {
    label: 'work',
    color: 0x00ff00,
    labelSide: 'left',
    pos: (w, h, s) => [w - s * 1.3, h * 0.68],          // mid-top right
    onClick: () => scrollToZone('work'),
  },
  {
    label: 'contact',
    color: 0x0000ff,
    labelSide: 'right',
    pos: (w, h, s) => [s * 1.3 + w * 0.06, 58 + s * 0.8], // bottom left (nudged right), above the taskbar
    onClick: () => { window.location.href = `mailto:${CONTACT_EMAIL}`; },
  },
];

// MOBILE: the cubes sit in a row under the castle on the landing page, with their
// words underneath, and shrink away as you scroll down.
// List the ones to show, left to right (e.g. drop 'contact' and add the castle game here later).
const MOBILE_CUBES = {
  items: ['about', 'work', 'contact'],
  y: 0.4,            // how high the row sits: 0 = bottom of the screen, 1 = top
  size: 0.13,        // cube size as a fraction of the screen width
  goneBy: 0.35,      // fully shrunk away once this much of the way to the header (0–1)
  labelSize: 0.95,   // the words' height compared to a cube (bigger = bigger words)
};
let mobileCubeShow = 1; // 1 = full size (landing page), 0 = gone

// MOBILE: tapping a cube — it pops bigger, does a quick spin, its edges flash white,
// then (after `delay` seconds, so you see it) takes you to its page.
const MOBILE_CUBE_TAP = {
  pop: 0.45,      // how much bigger it gets at the peak (0.45 = 45% bigger)
  popTime: 0.35,  // seconds for the pop to grow and settle back
  spin: 0.35,     // the spin kick (it slows down by itself)
  delay: 0.32,    // seconds before the page changes
};

const labelLayer = document.createElement('div');
labelLayer.id = 'nav-labels';
document.body.appendChild(labelLayer);

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const edgeGeometry = new THREE.EdgesGeometry(cubeGeometry);

NAV_ITEMS.forEach((item, i) => {
  item.cube = new THREE.Mesh(
    cubeGeometry,
    new THREE.MeshPhongMaterial({ color: item.color, opacity: 0.6, transparent: true })
  );
  item.edge = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: 0x000000 }));
  item.cube.add(item.edge);
  item.cube.rotation.set(0.5 + i, 0.6 + i, 0); // start each at a different angle
  item.cube.userData.item = item;
  hudScene.add(item.cube);

  // The word next to the cube is a plain HTML element layered over the canvas.
  // It starts as italic text, then gets swapped for Old London letter shapes.
  item.labelEl = document.createElement('div');
  item.labelEl.className = 'nav-label';
  item.labelEl.innerHTML = `<span class="nav-label-float">${item.label}</span>`;
  labelLayer.appendChild(item.labelEl);
});

// Touch screens have no hover, so show the labels all the time there.
const alwaysShowLabels = window.matchMedia('(hover: none)').matches;

let cubeSize = 50;

function layoutHud() {
  const { w, h } = viewSize(); // (= the window size on desktop)
  cubeSize = THREE.MathUtils.clamp(Math.min(w, h) * 0.07, 36, 64);

  hudCamera.right = w;
  hudCamera.top = h;
  hudCamera.updateProjectionMatrix();

  if (MOBILE) {
    // phones: one evenly spaced row, words centered underneath
    cubeSize = THREE.MathUtils.clamp(Math.min(w, h) * MOBILE_CUBES.size, 32, 64);
    const shown = MOBILE_CUBES.items.map((name) => NAV_ITEMS.find((it) => it.label === name)).filter(Boolean);
    NAV_ITEMS.forEach((item) => {
      const i = shown.indexOf(item);
      item.mobileHidden = i < 0;
      item.cube.visible = i >= 0;
      if (i < 0) {
        item.x = item.y = -99999; // (off screen, never tappable)
        item.labelEl.style.display = 'none';
        return;
      }
      item.x = (w * (i + 1)) / (shown.length + 1);
      item.y = h * MOBILE_CUBES.y;
      item.cube.position.set(item.x, item.y, 0);
      const el = item.labelEl.style;
      el.display = '';
      el.top = `${h - item.y + cubeSize * 0.8}px`;
      el.left = `${item.x}px`;
      el.right = 'auto';
      el.height = `${cubeSize * MOBILE_CUBES.labelSize}px`;
      el.fontSize = `${cubeSize * MOBILE_CUBES.labelSize * 0.7}px`;
      el.transform = 'translate(-50%, 0)';
    });
    return;
  }

  const gap = cubeSize * 0.75 + 12; // half a grown cube + breathing room
  NAV_ITEMS.forEach((item) => {
    const [x, y] = item.pos(w, h, cubeSize);
    item.x = x;
    item.y = y;
    item.cube.position.set(x, y, 0);

    const el = item.labelEl.style;
    el.top = `${h - y}px`;
    el.height = `${cubeSize * 0.9}px`;
    el.fontSize = `${cubeSize * 0.6}px`;
    if (item.labelSide === 'right') {
      el.left = `${x + gap}px`;
      el.right = 'auto';
    } else {
      el.right = `${w - x + gap}px`;
      el.left = 'auto';
    }
  });
}

// Turn a word into an SVG drawing using the glyph outlines in a typeface.js
// font file (the same file the 3D title text used).
function wordToSvg(font, text) {
  let x = 0;
  let d = '';
  for (const ch of text) {
    const glyph = font.glyphs[ch];
    if (!glyph) continue;
    const t = (glyph.o || '').trim().split(/\s+/);
    let i = 0;
    const pt = () => `${+t[i++] + x} ${-t[i++]}`; // font y points up, SVG y points down
    while (i < t.length) {
      const cmd = t[i++];
      if (cmd === 'm') d += `M${pt()}`;
      else if (cmd === 'l') d += `L${pt()}`;
      else if (cmd === 'q') { const end = pt(); const c = pt(); d += `Q${c} ${end}`; }
      else if (cmd === 'b') { const end = pt(); const c1 = pt(); const c2 = pt(); d += `C${c1} ${c2} ${end}`; }
      else if (cmd === 'z') d += 'Z';
    }
    x += glyph.ha;
  }
  const { yMin, yMax } = font.boundingBox;
  const pad = 40;
  return `<svg viewBox="${-pad} ${-yMax - pad} ${x + pad * 2} ${yMax - yMin + pad * 2}" aria-hidden="true">` +
    `<path d="${d}"/></svg>`;
}

fetch(asset('fonts/Old London_Regular.json'))
  .then((res) => res.json())
  .then((font) => {
    NAV_ITEMS.forEach((item) => {
      item.labelEl.firstChild.innerHTML = wordToSvg(font, item.label);
    });
    // Any element marked data-oldlondon in index.html (e.g. your name) gets drawn
    // in Old London too. The real text stays underneath for search engines.
    // Characters the font doesn't have (like emoji) are left as normal text.
  })
  .catch((err) => console.warn('Old London font did not load — using plain text labels.', err));

layoutHud();

// --- Pointer → which nav cube is under it? ------------------------------------
// Simple screen-space check: a generous circle around each cube, plus the
// word and the gap next to it once the word is showing.
const OFFSCREEN = -99999;
const pointer = { x: OFFSCREEN, y: OFFSCREEN }; // in page pixels, (0,0) = top left

function navItemAt(p) {
  const h = viewSize().h; // (= the window height on desktop)
  for (const item of NAV_ITEMS) {
    const cx = item.x;
    const cy = h - item.y;
    if (Math.hypot(p.x - cx, p.y - cy) < cubeSize * 0.8) return item;

    if (item.labelEl.classList.contains('visible')) {
      const r = item.labelEl.getBoundingClientRect();
      const minX = Math.min(cx, r.left) - 8;
      const maxX = Math.max(cx, r.right) + 8;
      if (p.x >= minX && p.x <= maxX && p.y >= r.top - 8 && p.y <= r.bottom + 8) return item;
    }
  }
  return null;
}

// Where the mouse is anywhere on the page (the rose head watches this one,
// even when you're over a window or the taskbar).
const cursor = { x: OFFSCREEN, y: OFFSCREEN };

window.addEventListener('pointermove', (e) => {
  cursor.x = e.clientX;
  cursor.y = e.clientY;
  // Only count the mouse as "over the scene" when it isn't on a window, menu, etc.
  if (e.target !== renderer.domElement) {
    pointer.x = OFFSCREEN;
    pointer.y = OFFSCREEN;
    return;
  }
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});
document.documentElement.addEventListener('mouseleave', () => {
  pointer.x = OFFSCREEN;
  pointer.y = OFFSCREEN;
  cursor.x = OFFSCREEN;
  cursor.y = OFFSCREEN;
});

window.addEventListener('click', (e) => {
  if (MOBILE) {
    // phones: only the cube row on the landing page (the rose has its own tap handler)
    if (e.target !== renderer.domElement || mobileCubeShow < 0.5 || mobileProject) return;
    const item = navItemAt({ x: e.clientX, y: e.clientY });
    if (!item) return;
    if (!item.tappedAt) { item.tappedAt = clock.getElapsedTime(); item.spinKick = MOBILE_CUBE_TAP.spin; }
    setTimeout(() => item.onClick(), MOBILE_CUBE_TAP.delay * 1000);
    return;
  }
  // Ignore the click that ends a castle drag.
  if (didDrag) {
    didDrag = false;
    return;
  }
  if (e.target !== renderer.domElement) return; // clicked a window, not the scene
  const item = navItemAt({ x: e.clientX, y: e.clientY });
  if (item) item.onClick();
  else if (roseAt({ x: e.clientX, y: e.clientY })) startSwapSpin(clock.getElapsedTime());
});

// --- Scroll hint -------------------------------------------------------------
const scrollHint = document.getElementById('scroll-hint');

function onScroll() {
  if (frozenStop) return; // full-screen video open
  if (MOBILE) {
    const landing = mobileHero.offsetHeight * TITLE_MOBILE.scrollToHeader || 1;
    mobileIntroTarget = mobileProject ? 1 : THREE.MathUtils.clamp(window.scrollY / landing, 0, 1);
  }
  updateCameraTarget();
  updateIntroMotion();
  if (scrollHint) scrollHint.classList.toggle('hidden', window.scrollY > 40);
}
window.addEventListener('scroll', onScroll, { passive: true });

// --- Paged scrolling (SCROLL_MODE = 'paged') -----------------------------------
// The wheel/trackpad doesn't scroll the page directly: a gesture moves exactly one
// stop, with a smooth glide. Trackpad "momentum" after a swipe is ignored, so one
// swipe never skips two stops. Scrolling inside a window with its own scrollbar
// (a long text box) still scrolls that window first.
const PAGED = {
  threshold: 30,   // how much wheel movement counts as "go to the next stop"
  quietMs: 180,    // after landing, the wheel must rest this long before the next move…
  maxLockMs: 1100, // …or this long has passed since the move started
};

if (!MOBILE && SCROLL_MODE === 'paged') {
  let pending = 0;     // wheel movement collected so far
  let lockedAt = 0;    // when the current glide started (0 = not gliding)
  let lockTarget = 0;  // where that glide is headed
  let lastWheel = 0;
  let prevAbs = 0;     // size of the previous wheel event (to tell momentum from a new swipe)

  const currentIndex = () => {
    let best = 0;
    zones.forEach((z, i) => {
      if (Math.abs(z.start - window.scrollY) < Math.abs(zones[best].start - window.scrollY)) best = i;
    });
    return best;
  };

  const go = (dir) => {
    const i = Math.min(zones.length - 1, Math.max(0, currentIndex() + dir));
    if (Math.abs(zones[i].start - window.scrollY) < 2) return;
    lockedAt = performance.now();
    lockTarget = zones[i].start;
    scrollToZone(zones[i].name, { glide: true });
  };

  // Is the mouse over a window that scrolls on its own (a long text box)?
  // 'scroll' = it can still move this way (let it); 'edge' = it's at its top/bottom
  // (do nothing — scrolling inside a window never moves you to another stop);
  // null = not over a scrolling window (page the site as usual).
  const innerScroller = (target, dy) => {
    for (let el = target; el && el !== document.body; el = el.parentElement) {
      if (!(el instanceof HTMLElement)) continue;
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return 'scroll';
        if (dy < 0 && el.scrollTop > 0) return 'scroll';
        return 'edge';
      }
    }
    return null;
  };

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey || frozenStop) return; // pinch-zoom, or a full-screen video is open
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const inner = innerScroller(e.target, dy);
    if (inner === 'scroll') return;
    e.preventDefault();
    if (inner === 'edge') return;

    const now = performance.now();
    const quiet = now - lastWheel;
    const abs = Math.abs(dy);
    lastWheel = now;
    if (lockedAt) {
      const arrived = Math.abs(window.scrollY - lockTarget) < 2;
      const stillGliding = !arrived && now - lockedAt < PAGED.maxLockMs;
      // landed: a pause, or a clearly bigger push (a fresh swipe, not leftover momentum), unlocks
      const freshSwipe = abs > prevAbs * 1.5 && abs > 10;
      if (stillGliding || (quiet <= PAGED.quietMs && !freshSwipe)) {
        prevAbs = abs;
        return;
      }
      lockedAt = 0;
      pending = 0;
    }
    prevAbs = abs;
    if (quiet > PAGED.quietMs) pending = 0;
    pending += dy;
    if (Math.abs(pending) >= PAGED.threshold) {
      const dir = Math.sign(pending);
      pending = 0;
      go(dir);
    }
  }, { passive: false });

  // keyboard: arrows / Page Up / Page Down / space (not while typing or using a control)
  window.addEventListener('keydown', (e) => {
    if (frozenStop) return; // full-screen video: keys belong to the player
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const down = ['ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey);
    const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    if (!down && !up) return;
    if (e.key === ' ' && e.target.closest?.('button, a, [role="button"], [role="slider"]')) return;
    e.preventDefault();
    go(down ? 1 : -1);
  });

  // dragging the scrollbar (or anything else) and letting go between stops → settle on the nearest
  let settleTimer = null;
  window.addEventListener('scroll', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (flyingTo || frozenStop) return;
      const z = zones[currentIndex()];
      if (Math.abs(z.start - window.scrollY) > 2) scrollToZone(z.name, { glide: true });
    }, 220);
  }, { passive: true });
}

// --- Resize ------------------------------------------------------------------
// --- Full-screen video: hold everything still while it's open ------------------
// Going full screen resizes the browser window, which normally re-lays-out the
// stops and moves the scroll position — the stop (and the video inside it) would
// fly away, leaving a black screen. So: freeze on the way in, and on the way out
// re-measure and land back exactly on the same stop.
const anyFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

document.addEventListener('video-fullscreen', () => {
  if (MOBILE) return;
  let best = zones[0];
  zones.forEach((z) => { if (Math.abs(z.start - window.scrollY) < Math.abs(best.start - window.scrollY)) best = z; });
  frozenStop = best.name;
  // safety net: if full screen never actually opened, unfreeze
  setTimeout(() => { if (frozenStop && !anyFullscreen()) unfreeze(); }, 1500);
});

function unfreeze() {
  if (!frozenStop || anyFullscreen() || unfreezing) return;
  unfreezing = true;
  const name = frozenStop;
  // Leaving full screen, the browser window takes a moment to get back to its normal
  // size (and may nudge the scroll position on the way). Stay frozen until the size
  // has stopped changing for a few frames, THEN re-measure and land on the stop.
  let lastW = 0;
  let lastH = 0;
  let still = 0;
  let frames = 0;
  const settle = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    still = w === lastW && h === lastH ? still + 1 : 0;
    lastW = w;
    lastH = h;
    if (still < 8 && ++frames < 90) { requestAnimationFrame(settle); return; }
    unfreezing = false;
    frozenStop = null;
    onResize();
    const z = zones.find((zone) => zone.name === name);
    if (!z) return;
    window.scrollTo({ top: z.start, behavior: 'instant' });
    camera.position.z = z.cameraZ;
    targetCameraZ = z.cameraZ;
    onScroll();
  };
  requestAnimationFrame(settle);
}
let unfreezing = false;
document.addEventListener('fullscreenchange', unfreeze);
document.addEventListener('webkitfullscreenchange', unfreeze);

window.addEventListener('resize', () => {
  if (frozenStop) return; // full-screen video open (see above)
  onResize();
});

function onResize() {
  const { w, h } = viewSize();
  sizeRoseView();
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  buildZones();
  layoutHud();
  layoutAbout();
  onScroll();
}

// --- Animation loop ----------------------------------------------------------
const growTarget = new THREE.Vector3();
const clock = new THREE.Clock();

function animateMobile(t) {
  // the landing → header glide eases along behind the scroll
  mobileIntro += (mobileIntroTarget - mobileIntro) * 0.12;
  if (Math.abs(mobileIntroTarget - mobileIntro) < 0.0005) mobileIntro = mobileIntroTarget;
  updateIntroMotion();

  if (titleMesh) titleMesh.rotation.y -= 0.001;
  updateCastle();
  updateAbout(t);
  updateStations();

  // castle keeps spinning a little after your finger lets go
  if (castleModel && !isDragging) {
    castleModel.rotation.y += spinVelocity;
    spinVelocity *= 0.95;
    if (Math.abs(spinVelocity) < 0.0001) spinVelocity = 0;
  }

  // the cube row: full size on the landing page, shrinking away as you scroll
  mobileCubeShow = mobileProject ? 0 : 1 - THREE.MathUtils.smoothstep(mobileIntro, 0, MOBILE_CUBES.goneBy);
  const hoveredItem = mobileCubeShow > 0.5 ? navItemAt(pointer) : null;
  NAV_ITEMS.forEach((item, i) => {
    if (item.mobileHidden) return;
    // tap: a spin kick that winds down, and a quick pop (grow, then settle)
    const kick = item.spinKick || 0;
    item.cube.rotation.x += [-0.002, 0.0025, 0.002][i] * 2 + kick;
    item.cube.rotation.y += [0.001, -0.0012, 0.0013][i] * 2 + kick * 0.7;
    item.spinKick = kick * 0.9;
    let pop = 0;
    if (item.tappedAt) {
      const p = (t - item.tappedAt) / MOBILE_CUBE_TAP.popTime;
      if (p >= 1.6) item.tappedAt = 0;
      else pop = Math.sin(Math.PI * Math.min(p, 1)) * MOBILE_CUBE_TAP.pop;
    }
    item.edge.material.color.set(item.tappedAt ? 0xffffff : 0x000000);
    const size = Math.max(cubeSize * ((item === hoveredItem ? 1.2 : 1) + pop) * mobileCubeShow, 0.001);
    item.cube.scale.lerp(growTarget.set(size, size, size), pop ? 0.5 : 0.2);
    item.labelEl.classList.toggle('visible', mobileCubeShow > 0.5);
  });

  renderer.clear();
  renderer.render(scene, camera);
  if (mobileCubeShow > 0.001) {
    renderer.clearDepth(); // the cubes always draw on top
    renderer.render(hudScene, hudCamera);
  }
  // the rose only draws while its spot in the about section is on screen (saves battery)
  if (roseView?.onScreen) roseView.renderer.render(roseView.scene, roseView.camera);
}

function animate() {
  const t = clock.getElapsedTime();
  if (MOBILE) return animateMobile(t);

  // Camera eases toward its scroll target.
  camera.position.z += (targetCameraZ - camera.position.z) * 0.08;

  if (titleMesh) titleMesh.rotation.y -= 0.001;

  updateCastle();
  checkArrival();
  updateHistory();
  updateAbout(t);
  updateStations();

  // Castle keeps spinning a little after you let go.
  if (castleModel && !isDragging) {
    castleModel.rotation.y += spinVelocity;
    spinVelocity *= 0.95;
    if (Math.abs(spinVelocity) < 0.0001) spinVelocity = 0;
  }

  // Nav cubes: hover state, spin, grow, floating labels.
  const hoveredItem = navItemAt(pointer);
  renderer.domElement.style.cursor = hoveredItem || roseAt(pointer) ? 'pointer' : '';

  NAV_ITEMS.forEach((item, i) => {
    const isHovered = item === hoveredItem;

    item.cube.rotation.x += [-0.002, 0.0025, 0.002][i] * 2;
    item.cube.rotation.y += [0.001, -0.0012, 0.0013][i] * 2;

    const size = cubeSize * (isHovered ? 1.2 : 1);
    item.cube.scale.lerp(growTarget.set(size, size, size), 0.1);
    item.edge.material.color.set(isHovered ? 0xffffff : 0x000000);

    // Fade the word in/out (the float animation lives in style.css).
    item.labelEl.classList.toggle('visible', isHovered || alwaysShowLabels);
  });

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth(); // so the HUD always draws on top
  renderer.render(hudScene, hudCamera);
}
jumpToStopFromAddress();
renderer.setAnimationLoop(animate);
onScroll();
