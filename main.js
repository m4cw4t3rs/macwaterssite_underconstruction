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

initDraggables(); // windows + pngs marked data-drag in index.html

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

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
const ZONE_DEFS = [
  { name: 'home',  start: 0, hold: 0,   cameraZ: 50 },
  { name: 'about', start: 2, hold: 0.8, cameraZ: 150 },
  { name: 'work',  start: 3, hold: 0.8, cameraZ: 250 },
];
let zones = [];

function buildZones() {
  const h = window.innerHeight;
  zones = ZONE_DEFS.map((z) => ({ ...z, start: z.start * h, hold: z.hold * h }));

  // Make the page exactly tall enough to reach the last station.
  const last = ZONE_DEFS[ZONE_DEFS.length - 1];
  const spacer = document.getElementById('scroll-spacer');
  if (spacer) spacer.style.height = `${(last.start + last.hold + 1) * 100}vh`;
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

function scrollToZone(name) {
  const z = zones.find((zone) => zone.name === name);
  if (z) window.scrollTo({ top: z.start, behavior: 'smooth' });
}

// --- Lights ------------------------------------------------------------------
scene.add(new THREE.AmbientLight(0xff9c9c, 1.5));

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(-70, 60, 64);
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0x111111, 2);
directionalLight2.position.set(40, 16.5, 0);
scene.add(directionalLight2);

const directionalLight3 = new THREE.DirectionalLight(0xffffff, 2);
directionalLight3.position.set(-100, 0, 50);
scene.add(directionalLight3);

scene.fog = new THREE.Fog(0x231f1f, 50, 75);

// --- Castle (Draco-compressed GLB) -------------------------------------------
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(asset('draco/'));
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

let castleModel = null;
gltfLoader.load(
  asset('models/castle/castle_web.glb'),
  (gltf) => {
    castleModel = gltf.scene;
    castleModel.position.set(0, -5, 0);
    castleModel.scale.setScalar(2.9);
    castleModel.rotation.set(0, 150, 0);
    scene.add(castleModel);
  },
  undefined,
  (err) => console.error('failed to load castle:', err)
);

// --- MACWATERS title ---------------------------------------------------------
let titleMesh = null;
new OBJLoader().load(asset('models/macwaters_text.obj'), (object) => {
  object.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshPhongMaterial({ color: 0x000000, specular: 0xffffff, shininess: 65 });
    }
  });
  object.scale.setScalar(0.4);
  object.position.set(0, 16.5, 0);
  object.rotation.set(0.3, 0, 0);
  scene.add(object);
  titleMesh = object;
});

// As you start scrolling, the title rises and the castle sinks back.
const INTRO_SCROLL = 1000; // pixels over which this happens

function updateIntroMotion() {
  const progress = Math.min(window.scrollY / INTRO_SCROLL, 1);
  if (titleMesh) {
    titleMesh.position.z = THREE.MathUtils.lerp(0, -20, progress);
    titleMesh.position.y = THREE.MathUtils.lerp(16.5, 30, progress);
  }
  if (castleModel) {
    castleModel.position.z = THREE.MathUtils.lerp(0, -50, progress);
  }
}

// =============================================================================
// ABOUT station — floating rose head + bio window (the window lives in index.html)
// =============================================================================
const ABOUT_Z = ZONE_DEFS.find((z) => z.name === 'about').cameraZ;
const ROSE_DISTANCE = 30;             // how far in front of the camera it floats
const aboutPanel = document.getElementById('about-panel');

// Resting rotation, in degrees — use this to make the rose face forward.
// The cursor-following is added on top of this.
const ROSE_ROTATION = { x: 0, y: 180, z: 0 };

const roseGroup = new THREE.Group(); // moves + follows the cursor
const rosePivot = new THREE.Group(); // holds the fixed resting rotation
roseGroup.add(rosePivot);
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
  rosePivot.add(rose);
  applyRoseRotation();
  layoutAbout();
});

// Place the rose head relative to what the camera can see at the about stop:
// to the right of the bio window on wide screens, above it on tall phones.
function layoutAbout() {
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * ROSE_DISTANCE;
  const halfW = halfH * camera.aspect;
  const portrait = camera.aspect < 1;
  roseBase.set(
    portrait ? 0 : halfW * 0.5,
    portrait ? halfH * 0.5 : -halfH * 0.05,
    ABOUT_Z - ROSE_DISTANCE
  );
  const targetHeight = portrait ? halfH * 0.5 : halfH * 0.65;
  roseGroup.scale.setScalar(targetHeight / roseNativeHeight);
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

function updateAbout(t) {
  roseGroup.position.set(roseBase.x, roseBase.y + Math.sin(t * 1.4) * 0.6, roseBase.z);

  // Look toward the cursor, measured from where the rose sits on screen.
  let lookX = 0;
  let lookY = 0;
  if (pointer.x !== OFFSCREEN) {
    roseScreen.copy(roseGroup.position).project(camera); // -1..1 screen coords
    const mx = (pointer.x / window.innerWidth) * 2 - 1;
    const my = -(pointer.y / window.innerHeight) * 2 + 1;
    lookX = THREE.MathUtils.clamp(mx - roseScreen.x, -1, 1);
    lookY = THREE.MathUtils.clamp(my - roseScreen.y, -1, 1);
  }
  roseTilt.x += (-lookY * ROSE_LOOK.nod - roseTilt.x) * ROSE_LOOK.ease;
  roseTilt.y += (lookX * ROSE_LOOK.turn - roseTilt.y) * ROSE_LOOK.ease;

  roseGroup.rotation.x = roseTilt.x;
  roseGroup.rotation.y = roseTilt.y + t * ROSE_LOOK.autoSpin;

  // Bio window flies in once the camera has (nearly) arrived.
  if (aboutPanel) {
    aboutPanel.classList.toggle('visible', Math.abs(camera.position.z - ABOUT_Z) < 12);
  }
}

document.getElementById('about-close')?.addEventListener('click', () => scrollToZone('home'));

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
    pos: (w, h, s) => [s * 1.3 + w * 0.06, 70 + s * 0.8], // bottom left (nudged right), above the marquee
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

window.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});
document.documentElement.addEventListener('mouseleave', () => {
  pointer.x = OFFSCREEN;
  pointer.y = OFFSCREEN;
});

window.addEventListener('click', (e) => {
  // Ignore the click that ends a castle drag.
  if (didDrag) {
    didDrag = false;
    return;
  }
  const item = navItemAt({ x: e.clientX, y: e.clientY });
  if (item) item.onClick();
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

  updateAbout(t);

  // Castle keeps spinning a little after you let go.
  if (castleModel && !isDragging) {
    castleModel.rotation.y += spinVelocity;
    spinVelocity *= 0.95;
    if (Math.abs(spinVelocity) < 0.0001) spinVelocity = 0;
  }

  // Nav cubes: hover state, spin, grow, floating labels.
  const hoveredItem = navItemAt(pointer);
  renderer.domElement.style.cursor = hoveredItem ? 'pointer' : '';

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
renderer.setAnimationLoop(animate);
onScroll();
