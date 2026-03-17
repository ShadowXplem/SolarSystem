import './style.css'

import * as THREE from 'three'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

import * as OrbitCalcs from './orbitCalculations.js';
import { CelestialBody } from './CelestialBody.js';

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000)

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.set(150, 150, 150);

renderer.render(scene, camera);

//Const and variable
// gravitational parameter can be configured through the orbitCalculations module
OrbitCalcs.setGravitationalConstants({ g: 0.1, mass: 10000 }); // default central body
const dt = 1;
let timeWarpFactor = 1; // 1x is normal speed
const orbitPredictor = new OrbitCalcs.Orbit_Prediction(OrbitCalcs.getGravitationalParameter());

//Sun
const SunGeometry = new THREE.SphereGeometry(15, 32, 32);
const Sunmaterial = new THREE.MeshStandardMaterial({
  color: 0xFFFF00,        // bright yellow
  emissive: 0xFFD700,     // golden glow
  emissiveIntensity: 1, // make it bright
  metalness: 0.2,
  roughness: 0.4,
  mass: 10000,
});
const Sun = new THREE.Mesh(SunGeometry, Sunmaterial);
scene.add(Sun);

//Planets
const Planetmaterial = new THREE.MeshStandardMaterial({ color: 0xFF6347 });
const Planet = new CelestialBody({
  initialPosition: new THREE.Vector3(200, 0, 0),
  initialVelocity: new THREE.Vector3(0, 0, -2.24),
  radius: 15,
  mass: 200,
  material: Planetmaterial,
  predictor: orbitPredictor
});
Planet.addToScene(scene);

const Planet2material = new THREE.MeshStandardMaterial({ color: 0x00BFFF });
const Planet2 = new CelestialBody({
  initialPosition: new THREE.Vector3(-400, 0, 0),
  initialVelocity: new THREE.Vector3(0, 0, 1.6),
  radius: 10,
  mass: 100,
  material: Planet2material,
  predictor: orbitPredictor
});
Planet2.addToScene(scene);

//Moon
const Moon1material = new THREE.MeshStandardMaterial({ color: 0x00BFFF });
const Moon1 = new CelestialBody({
  initialPosition: new THREE.Vector3(150, 0, 0),
  initialVelocity: new THREE.Vector3(0, 0, 1.6),
  radius: 10,
  mass: 100,
  material: Moon1material,
  predictor: orbitPredictor
});
Moon1.addToScene(scene);

// Configure Moon1 to orbit the first planet (Planet)
Moon1.orbitCenter = Planet;
{
  const rel = Moon1.position.clone().sub(Planet.position);
  Moon1.orbitRadius = rel.length();
  Moon1.orbitAngle = Math.atan2(rel.z, rel.x);
}

let Celestial_Body = [Sun, Planet.mesh, Planet2.mesh, Moon1.mesh];

//user
let velocityInput = document.querySelector('#velocity');
velocityInput.value = Planet.velocity.length();
velocityInput.addEventListener('change', (event) => {
  const newSpeed = parseFloat(event.target.value);
  if (isNaN(newSpeed)) return;

  // Find which body is currently selected
  const targetInstance = getInstanceFromMesh(focusTarget);
  if (!targetInstance) return; // ignore changes when Sun is selected

  // If the velocity is currently zero, pick a default direction
  let dir = targetInstance.velocity.clone();
  if (dir.length() === 0) dir = new THREE.Vector3(1, 0, 0);
  const newVelocity = dir.normalize().multiplyScalar(newSpeed);
  targetInstance.velocity.copy(newVelocity);
  // Recalculate orbit for that body
  if (typeof targetInstance.calculateOrbit === 'function') {
    targetInstance.calculateOrbit();
  }
});

let timeWarpInput = document.querySelector('#time-warp');
timeWarpInput.value = timeWarpFactor;


//Light
const AmbientLight = new THREE.AmbientLight(0xffffff, 0.03);
const pointLight = new THREE.PointLight(0xffffff, 100000);
pointLight.position.set(0, 0, 0);
scene.add(AmbientLight, pointLight);

//Helpers
const LightHelper = new THREE.PointLightHelper(pointLight);
const Grid = new THREE.GridHelper(900, 6);
scene.add(LightHelper, Grid);

//Raycasting and Mouse Tracking
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let focusTarget = null; // This will hold the object we want to follow

//Camera Control
const controls = new OrbitControls(camera, renderer.domElement);
let delta = new THREE.Vector3();
let previousPlanetPosition = new THREE.Vector3();
focusTarget = Sun;
let isAnimatingToTarget = false;
controls.minDistance = focusTarget.geometry.parameters.radius * 2;

function onMouseClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(Celestial_Body);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    isAnimatingToTarget = true;
    focusTarget = clickedObject;
    // Update the velocity input to reflect the newly selected body (or disable for Sun)
    const inst = getInstanceFromMesh(focusTarget);
    if (inst) {
      velocityInput.disabled = false;
      velocityInput.value = inst.velocity.length();
    } else {
      velocityInput.disabled = true;
      velocityInput.value = 0;
    }
  }
}
// Listen for clicks on the canvas
renderer.domElement.addEventListener('click', onMouseClick);
renderer.render(scene, camera);

// Helper: get CelestialBody instance from a mesh (returns null for Sun)
function getInstanceFromMesh(mesh) {
  if (mesh === Planet.mesh) return Planet;
  if (mesh === Planet2.mesh) return Planet2;
  if (mesh === Moon1.mesh) return Moon1;
  return null;
}

//UI
function updateUI() {
  if (!focusTarget) return;

  const targetInstance = getInstanceFromMesh(focusTarget);
  const targetName = targetInstance ? "Planet" : "Sun";
  const distance = focusTarget.position.length();

  document.getElementById('info-name').innerText = targetName;
  document.getElementById('info-distance').innerText = distance.toFixed(2);

  if (targetInstance) {
    const speed = targetInstance.velocity.length();
    document.getElementById('info-velocity').innerText = speed.toFixed(3);

    const eVec = OrbitCalcs.Eccentricity_Vector(targetInstance.mesh.position, targetInstance.velocity);
    document.getElementById('info-eccentricity').innerText = eVec.length().toFixed(4);

    if (document.activeElement !== velocityInput) {
      velocityInput.disabled = false;
      velocityInput.value = speed.toFixed(2);
    }
  } else {
    // Sun logic
    document.getElementById('info-velocity').innerText = "0.000";
    document.getElementById('info-eccentricity').innerText = "0.0000";
    velocityInput.disabled = true;
  }
}


function animate() {
  requestAnimationFrame(animate)

  previousPlanetPosition.copy(focusTarget.position);

  const LockCheck = controls.target.distanceTo(focusTarget.position) < 0.1; //Checking if the camera is looking toward the object

  const timeStep = dt * timeWarpFactor;
  timeWarpFactor = timeWarpInput.value;


  Planet.update(timeStep);
  Planet2.update(timeStep);

  if (focusTarget !== Sun) {
    delta.copy(focusTarget.position).sub(previousPlanetPosition);
    camera.position.add(delta);
    controls.target.add(delta);

    if (isAnimatingToTarget) {
      controls.target.lerp(focusTarget.position, 0.1);
    }
    if (LockCheck) {
      isAnimatingToTarget = false;
    }
  } else {
    if (isAnimatingToTarget) {
      controls.target.lerp(focusTarget.position, 0.1);
    }
    if (LockCheck) {
      isAnimatingToTarget = false;
    }
  }

  updateUI();


  if (focusTarget !== Sun) {
    console.log(OrbitCalcs.Eccentricity_Vector(focusTarget.position, getInstanceFromMesh(focusTarget).velocity).length());
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();