// main.js — Mac Waters 3D site
//
// Two layers are drawn every frame:
//   1. the main 3D scene (castle, title, and later the about/work stations)
//   2. a "HUD" overlay with the small nav cubes, pinned to the screen

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { initDraggables } from './drag.js';
import { initTaskbar } from './taskbar.js';
import { initMedia } from './media.js';
import { typeIn, cancelTypeIn } from './typewriter.js';
import { initPlayers } from './player.js';
import { initScoreBooks } from './scorebook.js';

initDraggables(); // windows + pngs marked data-drag in index.html
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
const MAX_TEXTURE_SIZE = 1024; // shrink bigger model textures to this when they load

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
document.body.appendChild(renderer.domElement);

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
const ZONE_DEFS = [
  { name: 'home',          start: 0,   hold: 0, cameraZ: 50 },
  { name: 'about',         start: 1.2, hold: 0, cameraZ: 150 },
  { name: 'work',          start: 2.4, hold: 0, cameraZ: 250 }, // the desktop of project icons
  // --- the projects ---
  { name: 'dreamvisions',  start: 3.6, hold: 0, cameraZ: 350 },
  { name: 'meditations',   start: 4.8, hold: 0, cameraZ: 450 },
  { name: 'bookofhours',   start: 6.0, hold: 0, cameraZ: 550 },
  { name: 'tiktokbox',     start: 7.2, hold: 0, cameraZ: 650 },
  { name: 'violarecital',  start: 8.4, hold: 0, cameraZ: 750 },
  { name: 'shokwii',       start: 9.6, hold: 0, cameraZ: 850 },
  { name: 'filmscoring',   start: 10.8, hold: 0, cameraZ: 950 },
  { name: 'composition',   start: 12.0, hold: 0, cameraZ: 1050 },
];

// Shortcut names for links (none needed right now).
const ZONE_ALIASES = {};

// How scrolling settles:
//   'mandatory'  = always comes to rest on a stop (never in between)
//   'proximity'  = snaps only when you stop close to a stop
//   'none'       = free scrolling, no snapping
const SCROLL_SNAP = 'mandatory';

let zones = [];

function buildZones() {
  const h = window.innerHeight;
  zones = ZONE_DEFS.map((z) => ({ ...z, start: z.start * h, hold: z.hold * h }));

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
let flightTimer = null;

function scrollToZone(name) {
  const target = ZONE_ALIASES[name] || name;
  const z = zones.find((zone) => zone.name === target);
  if (!z) return;
  flyingTo = z;
  clearTimeout(flightTimer);
  flightTimer = setTimeout(() => { flyingTo = null; }, 4000); // safety net
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
['wheel', 'touchstart', 'keydown'].forEach((type) => {
  window.addEventListener(type, () => { flyingTo = null; }, { capture: true, passive: true });
});

// --- Browser Back/Forward + shareable links ------------------------------------
// Every stop has its own address: macwaters.studio/#about, /#work, /#meditations …
// (the castle is the plain address). Arriving at a stop adds it to the browser
// history, so Back/Forward fly between stops, links open straight to a project,
// and refreshing keeps you where you were.
const BASE_TITLE = document.title;
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
  if (flyingTo) return; // wait until a flight lands
  const here = zones.find((z) =>
    Math.abs(window.scrollY - z.start) < 2 && Math.abs(camera.position.z - z.cameraZ) < 1);
  if (!here || here.name === currentStop) return;

  const url = here.name === 'home' ? location.pathname + location.search : `#${here.name}`;
  if (currentStop === null || fromHistory) history.replaceState({ stop: here.name }, '', url);
  else history.pushState({ stop: here.name }, '', url);
  fromHistory = false;
  currentStop = here.name;
  document.title = here.name === 'home' ? BASE_TITLE : `${BASE_TITLE} · ${stopLabel(here.name)}`;
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
scatterIcons();

// --- work.txt previews ---------------------------------------------------------
// Hovering (or tabbing to) a desktop icon swaps work.txt to that project's title
// and types out its one-line description (data-blurb on the icon in index.html).
// Moving off the icons brings back the default text.
const BLURB_TYPE_SPEED = 350; // letters per second (0 = no typing effect, just show it)
const workBlurb = document.getElementById('work-blurb');
const blurbDefault = workBlurb ? workBlurb.innerHTML : '';
let blurbFrame = null;
let blurbRestore = null;
let blurbShowing = null;

function showBlurb(icon) {
  if (!workBlurb) return;
  cancelTypeIn(workBlurb); // if the intro is still typing itself out, stop it
  clearTimeout(blurbRestore);
  if (blurbShowing === icon) return;
  blurbShowing = icon;
  cancelAnimationFrame(blurbFrame);

  const title = icon.querySelector('.desk-label')?.textContent.trim() || '';
  const text = icon.dataset.blurb || '';
  workBlurb.innerHTML = '<h3 class="blurb-title"></h3><p class="blurb-text"><span></span><span class="caret">▌</span></p>';
  workBlurb.querySelector('.blurb-title').textContent = title;
  const out = workBlurb.querySelector('.blurb-text span');

  if (!BLURB_TYPE_SPEED) {
    out.textContent = text;
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const n = Math.min(text.length, Math.floor(((now - start) / 1000) * BLURB_TYPE_SPEED));
    out.textContent = text.slice(0, n);
    if (n < text.length) blurbFrame = requestAnimationFrame(step);
  };
  blurbFrame = requestAnimationFrame(step);
}

function restoreBlurb() {
  if (!workBlurb) return;
  // a short pause, so gliding from one icon to the next doesn't flicker
  clearTimeout(blurbRestore);
  blurbRestore = setTimeout(() => {
    cancelAnimationFrame(blurbFrame);
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
document.querySelectorAll('.desk-icon[data-nav]').forEach((icon) => {
  icon.addEventListener('click', () => scrollToZone(icon.dataset.nav));
  icon.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToZone(icon.dataset.nav);
    }
  });
});

// Start menu links: a stop name, or "contact" for email.
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
    },
    undefined,
    (err) => {
      if (files.length > 1) loadCastle(files.slice(1));
      else console.error('failed to load castle:', err);
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
  top: 0.9,     // where its top edge sits: 1 = touching the top of the screen, 0.8 = lower
  scale: 0.28,  // its size as a header (it starts at 0.4)
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
});

// The title's letters form a tilted, spinning ring, so the part nearest the
// camera looks biggest and sits highest on screen. Walk around the ring and find
// the height that keeps every point of its top edge below TITLE_HEADER.top.
function titleHeaderY(scale) {
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
    best = Math.min(best, TITLE_HEADER.top * tanHalf * depth - yTilted);
  }
  return best;
}

// As you start scrolling, the title rises and the castle sinks back.
// It happens over the scroll from the castle to the next stop.
function updateIntroMotion() {
  const introScroll = zones[1] ? zones[1].start : window.innerHeight;
  const progress = Math.min(window.scrollY / introScroll, 1);
  if (titleMesh && TITLE_AS_HEADER) {
    const headerY = titleHeaderY(TITLE_HEADER.scale);
    titleMesh.position.y = THREE.MathUtils.lerp(16.5, headerY, progress);
    titleMesh.scale.setScalar(THREE.MathUtils.lerp(0.4, TITLE_HEADER.scale, progress));
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
  const s = TITLE_HEADER.scale;
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
  const p = THREE.MathUtils.clamp((camera.position.z - homeZ) / (nextZ - homeZ), 0, 1);
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
  castleModel.position.lerpVectors(castleHomePos, castleHeaderPos, eased);
  castleModel.scale.setScalar(THREE.MathUtils.lerp(CASTLE_HOME.scale, s, eased));
  castleModel.rotation.x = THREE.MathUtils.degToRad(CASTLE_HEADER.tilt) * eased;
}

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
scene.add(roseGroup);

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
};

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

function updateStations() {
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
      el.querySelectorAll('.win-window.closed').forEach((w) => w.classList.remove('closed'));
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
  const w = window.innerWidth;
  const h = window.innerHeight;
  cubeSize = THREE.MathUtils.clamp(Math.min(w, h) * 0.07, 36, 64);

  hudCamera.right = w;
  hudCamera.top = h;
  hudCamera.updateProjectionMatrix();

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
    document.querySelectorAll('[data-oldlondon]').forEach((el) => {
      const text = el.textContent.trim();
      const runs = []; // [{ inFont: true/false, text }]
      for (const ch of text) {
        const inFont = Boolean(font.glyphs[ch]);
        const last = runs[runs.length - 1];
        if (last && last.inFont === inFont) last.text += ch;
        else runs.push({ inFont, text: ch });
      }
      const drawn = runs
        .map((r) => (r.inFont ? wordToSvg(font, r.text) : `<span class="ol-plain" aria-hidden="true">${r.text}</span>`))
        .join('');
      el.innerHTML = `<span class="sr-only">${text}</span>${drawn}`;
      el.classList.add('ol-drawn');
    });
  })
  .catch((err) => console.warn('Old London font did not load — using plain text labels.', err));

layoutHud();

// --- Pointer → which nav cube is under it? ------------------------------------
// Simple screen-space check: a generous circle around each cube, plus the
// word and the gap next to it once the word is showing.
const OFFSCREEN = -99999;
const pointer = { x: OFFSCREEN, y: OFFSCREEN }; // in page pixels, (0,0) = top left

function navItemAt(p) {
  const h = window.innerHeight;
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
  updateCameraTarget();
  updateIntroMotion();
  if (scrollHint) scrollHint.classList.toggle('hidden', window.scrollY > 40);
}
window.addEventListener('scroll', onScroll, { passive: true });

// --- Resize ------------------------------------------------------------------
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  buildZones();
  layoutHud();
  layoutAbout();
  onScroll();
});

// --- Animation loop ----------------------------------------------------------
const growTarget = new THREE.Vector3();
const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();

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
