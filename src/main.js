import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createTerrain } from './world/terrain.js';
import { createCoast } from './world/coast.js';
import { createMetropolitanLayer } from './world/metropolitan.js';
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

const camera = new THREE.PerspectiveCamera(44, 1, 1, 5000);

const cameraState = {
  target: new THREE.Vector3(0, 0, 0),
  yaw: -0.65,
  pitch: CONFIG.camera.pitch,
  distance: CONFIG.camera.startDistance,
  moveVelocity: new THREE.Vector3()
};

const keys = new Set();

const pointerState = {
  active: false,
  pointerId: null,
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

const coast = createCoast({
  heightAt: terrain.heightAt,
  coastX: terrain.coastX,
  seaLevel: terrain.seaLevel
});
scene.add(coast.group);

let city = createFallbackCity(terrain.heightAt);
scene.add(city);

let metropolitan = null;

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

    return createMetropolitanLayer(
      terrain.heightAt
    );
  })
  .then((metroLayer) => {
    if (!metroLayer) return;

    metropolitan = metroLayer;
    scene.add(metropolitan);

    const source =
      metropolitan.userData.source === 'osm-metro'
        ? 'METRO OSM'
        : 'METRO FALLBACK';

    cityStatus.textContent +=
      ` · ${source}`;
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
  const inputForward =
    (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
    (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);

  const inputStrafe =
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
    (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);

  const moveInput = new THREE.Vector3(
    inputStrafe,
    0,
    inputForward
  );

  if (moveInput.lengthSq() > 1) {
    moveInput.normalize();
  }

  const forward = new THREE.Vector3(
    -Math.sin(cameraState.yaw),
    0,
    -Math.cos(cameraState.yaw)
  );

  const right = new THREE.Vector3(
    Math.cos(cameraState.yaw),
    0,
    -Math.sin(cameraState.yaw)
  );

  const desiredDirection = new THREE.Vector3()
    .addScaledVector(forward, moveInput.z)
    .addScaledVector(right, moveInput.x);

  const speedMultiplier =
    keys.has('ShiftLeft') || keys.has('ShiftRight')
      ? CONFIG.camera.sprintMultiplier
      : 1;

  const desiredVelocity =
    desiredDirection.lengthSq() > 0
      ? desiredDirection
          .normalize()
          .multiplyScalar(
            CONFIG.camera.moveSpeed *
            speedMultiplier
          )
      : new THREE.Vector3();

  const moveBlend =
    1 - Math.pow(
      CONFIG.camera.moveDamping,
      delta
    );

  cameraState.moveVelocity.lerp(
    desiredVelocity,
    moveBlend
  );

  cameraState.target.addScaledVector(
    cameraState.moveVelocity,
    delta
  );

  cameraState.target.y = terrain.heightAt(
    cameraState.target.x,
    cameraState.target.z
  );

  const horizontal =
    cameraState.distance *
    Math.cos(cameraState.pitch);

  const height =
    cameraState.distance *
    Math.sin(cameraState.pitch);

  const cameraX =
    cameraState.target.x +
    Math.sin(cameraState.yaw) *
    horizontal;

  const cameraZ =
    cameraState.target.z +
    Math.cos(cameraState.yaw) *
    horizontal;

  const terrainY =
    terrain.heightAt(
      cameraX,
      cameraZ
    );

  camera.position.set(
    cameraX,
    Math.max(
      cameraState.target.y + height,
      terrainY + CONFIG.camera.minTerrainClearance
    ),
    cameraZ
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
  const movementKeys = [
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ShiftLeft',
    'ShiftRight'
  ];

  if (movementKeys.includes(event.code)) {
    event.preventDefault();
  }

  keys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

window.addEventListener('blur', () => {
  keys.clear();
  cameraState.moveVelocity.set(0, 0, 0);
});

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;

  pointerState.active = true;
  pointerState.pointerId = event.pointerId;
  pointerState.x = event.clientX;
  pointerState.y = event.clientY;

  canvas.style.cursor = 'grabbing';
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!pointerState.active) return;

  const dx = event.clientX - pointerState.x;
  const dy = event.clientY - pointerState.y;

  pointerState.x = event.clientX;
  pointerState.y = event.clientY;

  cameraState.yaw -=
    dx * CONFIG.camera.orbitSensitivity;

  cameraState.pitch = THREE.MathUtils.clamp(
    cameraState.pitch +
      dy * CONFIG.camera.pitchSensitivity,
    CONFIG.camera.minPitch,
    CONFIG.camera.maxPitch
  );
});

function endPointer(event) {
  if (
    pointerState.pointerId !== null &&
    event.pointerId !== pointerState.pointerId
  ) {
    return;
  }

  pointerState.active = false;
  pointerState.pointerId = null;
  canvas.style.cursor = 'grab';

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

  const rawDelta =
    event.deltaY !== 0
      ? event.deltaY
      : event.deltaX;

  const zoomDelta =
    event.ctrlKey
      ? rawDelta * CONFIG.camera.pinchZoomSpeed
      : rawDelta * CONFIG.camera.wheelZoomSpeed;

  cameraState.distance = THREE.MathUtils.clamp(
    cameraState.distance + zoomDelta,
    CONFIG.camera.minDistance,
    CONFIG.camera.maxDistance
  );
}, { passive: false });

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

canvas.style.cursor = 'grab';
canvas.style.touchAction = 'none';

resize();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  updateCamera(delta);
  environment.update(delta);

  const environmentState =
    environment.getState();

  const nightFactor =
    environmentState.sun?.nightFactor ?? 0;

  city.userData.updateNight?.(
    nightFactor
  );

  metropolitan?.userData.updateNight?.(
    nightFactor
  );

  coast.updateNight?.({
    nightFactor,
    celestial: environmentState.celestial,
    weather: environmentState.weather
  });

  renderer.render(scene, camera);
}

animate();