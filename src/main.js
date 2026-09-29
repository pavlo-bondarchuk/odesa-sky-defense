import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createTerrain } from './world/terrain.js';
import {
  createFallbackCity,
  createOsmCity
} from './world/city.js';
import { createLighting } from './atmosphere/lighting.js';
import { createSky } from './atmosphere/sky.js';
import { createClouds } from './atmosphere/clouds.js';
import { createPrecipitation } from './atmosphere/precipitation.js';
import { createSunRays } from './atmosphere/sun-rays.js';
import { createWeatherAnomalies } from './atmosphere/weather-anomalies.js';
import { createEnvironmentManager } from './environment/environment-manager.js';

const canvas = document.querySelector('#game');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(
  0x9c8e82,
  CONFIG.atmosphere.fogNear,
  CONFIG.atmosphere.fogFar
);

const camera = new THREE.PerspectiveCamera(44, 1, 1, 1100);

const cameraState = {
  target: new THREE.Vector3(0, 0, 0),
  yaw: -0.65,
  pitch: CONFIG.camera.pitch,
  distance: CONFIG.camera.startDistance
};

const keys = new Set();

const pointerState = {
  active: false,
  x: 0,
  y: 0
};

const sky = createSky(scene);
const lighting = createLighting(scene);
const clouds = createClouds(scene);
const precipitation = createPrecipitation(scene, camera);
const sunRays = createSunRays(scene);
const anomalies = createWeatherAnomalies(scene);

const environment = createEnvironmentManager({
  scene,
  renderer,
  sky,
  lighting,
  clouds,
  precipitation,
  sunRays,
  anomalies,
  statusElement: document.querySelector('#environmentStatus')
});
const terrain = createTerrain();
scene.add(terrain.group);

let city = createFallbackCity(terrain.heightAt);
scene.add(city);

const cityStatus = document.querySelector('#cityStatus');
const cityLoader = document.querySelector('#cityLoader');
const cityLoaderLabel = document.querySelector('#cityLoaderLabel');
const cityLoaderBar = document.querySelector('#cityLoaderBar');

cityStatus.textContent =
  `FALLBACK · ${city.children.length} OBJECTS`;

cityLoader.hidden = false;
cityLoaderLabel.textContent = 'Loading detailed Odesa map';
cityLoaderBar.style.transform = 'scaleX(0.05)';

function updateCityLoader({
  progress = 0,
  label = 'Loading city'
}) {
  cityLoader.hidden = false;
  cityLoaderLabel.textContent = label;
  cityLoaderBar.style.transform =
    `scaleX(${THREE.MathUtils.clamp(progress, 0.03, 1)})`;
}

createOsmCity(terrain.heightAt, updateCityLoader)
  .then((osmCity) => {
    scene.remove(city);
    city = osmCity;
    scene.add(city);

    cityStatus.textContent =
      `OSM · ${osmCity.userData.objectCount} OBJECTS`;

    cityLoaderLabel.textContent = 'Detailed city ready';
    cityLoaderBar.style.transform = 'scaleX(1)';

    setTimeout(() => {
      cityLoader.hidden = true;
    }, 900);
  })
  .catch((error) => {
    console.warn('OSM city load failed', error);
    cityStatus.textContent =
      'FALLBACK · OSM OFFLINE';

    cityLoaderLabel.textContent =
      'Detailed map unavailable — fallback active';

    cityLoaderBar.style.transform = 'scaleX(1)';

    setTimeout(() => {
      cityLoader.hidden = true;
    }, 2200);
  });

cameraState.target.y = terrain.heightAt(
  cameraState.target.x,
  cameraState.target.z
);

function updateCamera(delta) {
  const pan = new THREE.Vector3();

  if (keys.has('KeyW') || keys.has('ArrowUp')) pan.z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) pan.z += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) pan.x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) pan.x += 1;

  if (pan.lengthSq()) {
    pan.normalize();
    const sin = Math.sin(cameraState.yaw);
    const cos = Math.cos(cameraState.yaw);
    const worldX = pan.x * cos - pan.z * sin;
    const worldZ = pan.x * sin + pan.z * cos;

    cameraState.target.x += worldX * CONFIG.camera.panSpeed * delta;
    cameraState.target.z += worldZ * CONFIG.camera.panSpeed * delta;
    cameraState.target.y = terrain.heightAt(
      cameraState.target.x,
      cameraState.target.z
    );
  }

  if (keys.has('KeyQ')) cameraState.yaw += CONFIG.camera.rotationSpeed * delta;
  if (keys.has('KeyE')) cameraState.yaw -= CONFIG.camera.rotationSpeed * delta;

  const horizontal =
    cameraState.distance * Math.cos(cameraState.pitch);

  const height =
    cameraState.distance * Math.sin(cameraState.pitch);

  camera.position.set(
    cameraState.target.x + Math.sin(cameraState.yaw) * horizontal,
    height,
    cameraState.target.z + Math.cos(cameraState.yaw) * horizontal
  );

  camera.lookAt(cameraState.target);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);

window.addEventListener('keydown', (event) => {
  keys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

canvas.addEventListener('pointerdown', (event) => {
  pointerState.active = true;
  pointerState.x = event.clientX;
  pointerState.y = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!pointerState.active) return;

  const dx = event.clientX - pointerState.x;
  const dy = event.clientY - pointerState.y;

  pointerState.x = event.clientX;
  pointerState.y = event.clientY;

  cameraState.yaw -= dx * 0.006;

  cameraState.pitch = THREE.MathUtils.clamp(
    cameraState.pitch + dy * 0.0045,
    0.48,
    1.28
  );
});

function endPointer(event) {
  pointerState.active = false;

  if (
    canvas.hasPointerCapture &&
    canvas.hasPointerCapture(event.pointerId)
  ) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('wheel', (event) => {
  event.preventDefault();

  if (event.ctrlKey) {
    cameraState.distance = THREE.MathUtils.clamp(
      cameraState.distance + event.deltaY * 0.65,
      CONFIG.camera.minDistance,
      CONFIG.camera.maxDistance
    );

    return;
  }

  const scale =
    cameraState.distance / CONFIG.camera.startDistance;

  const panX = event.deltaX * 0.055 * scale;
  const panZ = event.deltaY * 0.055 * scale;

  const sin = Math.sin(cameraState.yaw);
  const cos = Math.cos(cameraState.yaw);

  cameraState.target.x +=
    panX * cos - panZ * sin;

  cameraState.target.z +=
    panX * sin + panZ * cos;

  cameraState.target.y = terrain.heightAt(
    cameraState.target.x,
    cameraState.target.z
  );
}, { passive: false });

resize();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  updateCamera(delta);
  environment.update(delta);

  renderer.render(scene, camera);
}

animate();