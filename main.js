// === Responsive resize: keep canvas centered and update camera ===
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
// main.js
// Entry point for your three.js experiments

console.log('Three.js experiments project is ready!');
// Import three.js like this:
// import * as THREE from 'three';

import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { depth } from 'three/src/nodes/TSL.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import { max } from 'three/tsl';
import { HemisphereLight } from 'three/webgpu';
//import { FBXLoader } from 'three/examples/jsm/Addons.js';
//import { OrbitControls } from 'three/examples/jsm/Addons.js';

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let spinVelocity = { x: 0, y: 0 };
let textMesh;
let castleModel;
let textFloatTime = 0; // will accumulate animation time
let floatingTextIdx = null; // the index of the active floating text

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.5, 1000 );
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor(0x000000, 0); // 0 alpha for transparency
camera.position.z = 50;

// const zones = [
//   { name: "home",  start: 0, hold: 0, cameraZ: 50 },
//   { name: "menu",  start: window.innerHeight * 2, hold: window.innerHeight * 0.8, cameraZ: 150 },
//   { name: "about", start: window.innerHeight * 3, hold: window.innerHeight * 0.8, cameraZ: 250 },
//   { name: "work",  start: window.innerHeight * 4, hold: window.innerHeight * 0.8, cameraZ: 350 },
//   { name: "social",start: window.innerHeight * 5, hold: window.innerHeight * 0.8, cameraZ: 450 },
// ];


const gradientBg = document.createElement('div');
gradientBg.id = 'gradient-bg';
gradientBg.style.position = 'fixed';
gradientBg.style.top = 0;
gradientBg.style.left = 0;
gradientBg.style.width = '100vw';
gradientBg.style.height = '100vh';
gradientBg.style.zIndex = 0;
gradientBg.style.pointerEvents = 'none';
document.body.appendChild(gradientBg);

// Renderer setup, unchanged
// renderer.domElement.style.position = 'relative';
renderer.domElement.style.zIndex = 1;
renderer.domElement.id = 'three-canvas';
document.body.appendChild(renderer.domElement);

/**
 * Set a 6-color linear gradient with custom stops.
 * @param {string[]} colors - Array of 6 color hex codes.
 * @param {string[]} stops - Array of 6 stop positions (percentages, e.g. '0%', '16%', '33%', ...).
 **/
function setGradientColors(colors, stops) {
  if (colors.length !== 6 || stops.length !== 6) {
    throw new Error('Provide exactly 6 colors and 6 stop positions');
  }
  // Build the CSS gradient string with stops
  const stopsString = colors.map((color, i) => `${color} ${stops[i]}`).join(', ');
  gradientBg.style.background = `linear-gradient(180deg, ${stopsString})`;
}

// Example: six colors with even spacing
const colors = ['#FFFFFF', '#004CFF', '#7720FA', '#FFC525', '#FF8C00', '#FF0000'];
const stops = ['0%', '35%', '51%', '62%', '69%', '83%'];
setGradientColors(colors, stops);

// To set uneven spacing, just change the stops array:
    // e.g., ['0%', '10%', '25%', '60%', '90%', '100%']




const ambientLight = new THREE.AmbientLight(0xff9c9c, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(-70, 60, 64);
directionalLight.rotation.set(45, -45, 0);
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0x111111, 2
    
 );
directionalLight2.position.set(40, 16.5, 0);
directionalLight2.rotation.set(0, 180, 0);
scene.add(directionalLight2);


const directionalLight3 = new THREE.DirectionalLight(0xffffff, 2);
directionalLight3.position.set(-100, 0, 50);
directionalLight3.rotation.set(100, 0, 0);
scene.add(directionalLight3);

scene.fog = new THREE.Fog( 0x231f1f, 50, 75 );





const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

mtlLoader.load('/models/castle/castle.mtl', (mtl) => {
  mtl.preload();
  objLoader.setMaterials(mtl);
  objLoader.load('/models/castle/castle4.obj', (root) => {
    root.scale.set(2.9, 2.9, 2.9);
    root.position.set(0, -5, 0);
    root.rotation.set(0, 150, 0);
    castleModel = root;
    scene.add(root);
  });
});


objLoader.load('/models/macwaters_text.obj', (object) => {
  object.traverse((child) => {
    if (child.isMesh) {
        child.material = new THREE.MeshPhongMaterial({
          color: 0x000000,
          specular: 0xffffff,
          shininess: 65,
         

        });
      }
  });
  object.scale.set(0.4, 0.4, 0.4);
  object.position.set(0, 16.5, 0);
  object.rotation.set(0.3, 0 , 0);
  scene.add(object);
  textMesh = object;
});


const mintextScale = 0.4; //smallest allowed scale for textMesh
const maxtextScale = 1.0; //largest allowed scale for textMesh

const mincastleScale = 1.5; //smallest allowed scale for textMesh
const maxcastleScale = 2.9; //largest allowed scale for textMesh

const startCubeZ = 100;
const endCubeZ = 0;

const startTextZ = 0;
const endTextZ = -20;

const startTextY = 16.5;
const endTextY =  30;

const startCastleZ = 0;
const endCastleZ = -50;


const maxScroll = 1000; //pixels over which scaling occurs

// window.addEventListener('scroll', () => {
//   if (textMesh && castleModel && cube1 && cube2 && cube3) {
//     const scrollY = window.scrollY || window.pageYOffset;
//     const progress = Math.min(scrollY / maxScroll, 1);

//     const textScale = maxtextScale - progress * (maxtextScale - mintextScale);
//     //const castleScale = maxcastleScale - progress * (maxcastleScale - mincastleScale);
//     const textZ = startTextZ - progress * (startTextZ - endTextZ);
//     const textY = startTextY + progress * (endTextY - startTextY);
//     const castleZ = startCastleZ - progress * (startCastleZ - endCastleZ);
//     const cubeZ = startCubeZ - progress * (startCubeZ - endCubeZ);
   

   

//     textMesh.position.z = textZ;
//     textMesh.position.y = textY;
//     castleModel.position.z = castleZ;
//     cube1.position.z = cubeZ;
//     cube2.position.z = cubeZ;
//     cube3.position.z = cubeZ;
    
    
//   }
// });
let scrollTimeout;
let targetCameraZ = camera.position.z;

// window.addEventListener('scroll', () => {
//   clearTimeout(scrollTimeout);
//   const scrollY = window.scrollY;

//   for (let i = 0; i < zones.length; i++) {
//     const z = zones[i];
//     const nextStart = zones[i + 1]?.start ?? Infinity;

//     if (scrollY >= z.start && scrollY < nextStart) {
//       // === Sticky hold ===
//       if (scrollY <= z.start + z.hold) {
//         targetCameraZ = z.cameraZ;
//       }
//       // === Transition to next zone ===
//       else {
//         const progress = (scrollY - (z.start + z.hold)) / (nextStart - (z.start + z.hold));
//         const nextZ = zones[i + 1]?.cameraZ ?? z.cameraZ;
//         targetCameraZ = THREE.MathUtils.lerp(z.cameraZ, nextZ, progress);
//       }
//       break;
//     }
//   }
// });



renderer.domElement.addEventListener('mousedown', function(e) {
  isDragging = true;
  previousMousePosition.x = e.clientX;
  previousMousePosition.y = e.clientY;
  spinVelocity.x = 0;
  spinVelocity.y = 0;
});

renderer.domElement.addEventListener('mousemove', function(e) {
  if (!isDragging) return;

  const deltaX = e.clientX - previousMousePosition.x;
  const deltaY = e.clientY - previousMousePosition.y;

  if (castleModel) {
    castleModel.rotation.y += deltaX * 0.01;
    //castleModel.rotation.x += deltaY * 0.01;

    // Store velocity for inertia
    //spinVelocity.x = deltaY * 0.01;
    spinVelocity.y = deltaX * 0.01;
  }

  previousMousePosition.x = e.clientX;
  previousMousePosition.y = e.clientY;
});

renderer.domElement.addEventListener('mouseup', function(e) {
  isDragging = false;
});

//text setup

const fontLoader = new FontLoader();
let cubeTexts = [] // store [mesh, text] pairs

fontLoader.load('/fonts/Old London_Regular.json', (font) => {
  const texts = [
    {label: "about", color: 0xff0000},
    {label: "work", color: 0x00ff00},
    {label: "social", color: 0x0000ff}
  ];
  
  texts.forEach((obj, idx) => {
    const textGeo = new TextGeometry(obj.label, {
       font: font,
    size: 6,
    strokeColor: 0x000000,
    strokeWeight: 0.5,
    height: 0.5,
    depth: 0.5,
    curveSegments: 8,
    bevelEnabled: false,
    bevelThickness: 1,
    bevelSize: 0.1,
    bevelOffset: 0,
    bevelSegments: 5,
    });
    textGeo.center();

    const textMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0,
      metalness: 0,
      
    });

    const mesh = new THREE.Mesh(textGeo, textMat);
    mesh.visible = false;
    scene.add(mesh);
    cubeTexts[idx] = mesh;
    });
  });

// === CUBE SETUP ===
const cubeGeometry = new THREE.BoxGeometry( 15, 15, 15 );
const material1 = new THREE.MeshPhongMaterial( { color: 0xFF0000, opacity: 0.6, transparent: true } );
const material2 = new THREE.MeshPhongMaterial( { color: 0x00FF00, opacity: 0.6, transparent: true } );
const material3 = new THREE.MeshPhongMaterial( { color: 0x0000FF, opacity: 0.6, transparent: true } );


const cube1 = new THREE.Mesh( cubeGeometry, material1 );
cube1.position.set(-35, 15, 100);
cube1.userData.baseScale = 1;
const cube2 = new THREE.Mesh( cubeGeometry, material2 );
cube2.position.set(35, 7.5, 100);
cube2.userData.baseScale = 1;
const cube3 = new THREE.Mesh( cubeGeometry, material3 );
cube3.position.set(-3, -17, 100);
cube3.scale.set(1.2, 1.2, 1.2); // slightly larger
cube3.userData.baseScale = 1.2;

cube1.userData.targetScale = cube1.userData.baseScale;
cube2.userData.targetScale = cube2.userData.baseScale;
cube3.userData.targetScale = cube3.userData.baseScale;
scene.add( cube1 );
scene.add( cube2 );
scene.add( cube3 );

// Add black edges to the cube and store references
function addEdgesToCube(cube) {
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineBasicMaterial({ color: 0x000000 })
  );
  cube.add(edge);
  return edge;
}
const edge1 = addEdgesToCube(cube1);
const edge2 = addEdgesToCube(cube2);
const edge3 = addEdgesToCube(cube3);

const cubes = [cube1, cube2, cube3];
const edges = [edge1, edge2, edge3];

// === HOVER ANIMATION SETUP ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredCube = null;
let hoveredEdge = null;

// Track mouse position for raycasting
renderer.domElement.addEventListener('mousemove', (event) => {
  // Normalize mouse coordinates (-1 to +1)
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
});

// === ANIMATION LOOP ===
camera.position.z = 50;

function showTextForCube(idx, cube) {
  cubeTexts.forEach((textMesh, i) => {
    if (i === idx) {
      // Position directly in front of the cube (offset along the Z axis)
      textMesh.position.copy(cube.position);
      textMesh.position.y += 0;     // A bit above the cube (optional)
      textMesh.position.z -= 0;     // In front of the cube, toward the camera
      textMesh.visible = true;
      floatingTextIdx = idx;
      textFloatTime = 0;
    } else {
      textMesh.visible = false;
    }
  });
}

function animate() {

  const cameraEase = 0.08;

  camera.position.z += (targetCameraZ - camera.position.z) * cameraEase;

  // Cube rotation
  cube1.rotation.x += -0.002; cube1.rotation.y += 0.001;
  cube2.rotation.x += 0.0025; cube2.rotation.y += -0.0012;
  cube3.rotation.x += 0.002;  cube3.rotation.y += 0.0013;
  //textMesh.x += 0.005;

  if (textMesh) {
    textMesh.rotation.y -= 0.001;
  }

  if (floatingTextIdx !== null && cubeTexts[floatingTextIdx]) {
  textFloatTime += 0.045; // speed of the float; tweak as you like!
  const basePosY = cubes[floatingTextIdx].position.y; // match cube’s position
  const amplitude = 0.8;   // how high it floats, tweak for your style
  // Bob up and down with a sine wave
  cubeTexts[floatingTextIdx].position.y = basePosY + Math.sin(textFloatTime) * amplitude;
}

  // === HOVER LOGIC ===
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(cubes);

  if (intersects.length > 0) {
    const targetCube = intersects[0].object;
    const targetEdge = targetCube.children.find(child => child.type === 'LineSegments');
    const idx = cubes.indexOf(targetCube);
    if (hoveredCube !== targetCube) {
            showTextForCube(idx, targetCube);

      // Restore previous
      if (hoveredCube && hoveredEdge) {
        hoveredCube.userData.targetScale = hoveredCube.userData.baseScale;
        if (hoveredEdge) hoveredEdge.material.color.set(0x000000);
      }
      hoveredCube = targetCube;
      hoveredEdge = targetEdge;
      hoveredCube.userData.targetScale = hoveredCube.userData.baseScale * 1.2;
      if (hoveredEdge) hoveredEdge.material.color.set(0xffffff);
    }
  } else if (hoveredCube && hoveredEdge) {
    hoveredCube.userData.targetScale = hoveredCube.userData.baseScale;
    if (hoveredEdge) hoveredEdge.material.color.set(0x000000);
    hoveredCube = null;
    hoveredEdge = null;

    cubeTexts.forEach(mesh => mesh.visible = false);
    floatingTextIdx = null; // reset floating text index
  }

  renderer.domElement.addEventListener('click', () => {
  if (hoveredCube) {
    const idx = cubes.indexOf(hoveredCube);
    const sectionIds = ['about', 'media', 'social'];
    const targetId = sectionIds[idx];

    // Hide all sections
    document.querySelectorAll('.info-section').forEach(sec => sec.classList.remove('visible'));

    // Show target
    const targetEl = document.getElementById(`section-${targetId}`);
    if (targetEl) targetEl.classList.add('visible');
  }
});


  

  // Smoothly animate scale for all cubes
  cubes.forEach(cube => {
    if (!cube.userData.targetScale) cube.userData.targetScale = 1;
    cube.scale.lerp(
      new THREE.Vector3(
        cube.userData.targetScale,
        cube.userData.targetScale,
        cube.userData.targetScale
      ),
      0.1
    );
  });

  // Inertia spin for text
  if (castleModel) {
    if (!isDragging) {
      castleModel.rotation.x += spinVelocity.x;
      castleModel.rotation.y += spinVelocity.y;

      // Apply friction
      spinVelocity.x *= 0.95;
      spinVelocity.y *= 0.95;

      if (Math.abs(spinVelocity.x) < 0.0001) spinVelocity.x = 0;
      if (Math.abs(spinVelocity.y) < 0.0001) spinVelocity.y = 0;
    }
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

