import * as THREE from 'three';
import { CONFIG } from '../config.js';

const SEA_LEVEL = CONFIG.world.seaLevel;
const CURVATURE_RADIUS = 12000;

export function coastX(z) {
  return (
    118 +
    Math.sin(z * 0.008) * 10 +
    Math.sin(z * 0.021 + 1.4) * 4
  );
}

function earthCurvature(x, z) {
  const r2 = x * x + z * z;
  return -r2 / (2 * CURVATURE_RADIUS);
}

function reliefHeight(x, z) {
  const coast = coastX(z);
  const inland = coast - x;

  const plateau =
    THREE.MathUtils.smoothstep(inland, 12, 185) * 18;

  const cityRidge =
    Math.exp(
      -(
        Math.pow((x + 65) / 150, 2) +
        Math.pow((z - 20) / 210, 2)
      )
    ) * 7.5;

  const historicHill =
    Math.exp(
      -(
        Math.pow((x + 15) / 95, 2) +
        Math.pow((z + 30) / 115, 2)
      )
    ) * 4.5;

  const rolling =
    Math.sin(x * 0.012) * 0.75 +
    Math.cos(z * 0.011) * 0.65 +
    Math.sin((x + z) * 0.007) * 0.5;

  const coastDrop =
    -THREE.MathUtils.smoothstep(x - coast, -8, 42) * 12;

  const portTerrace =
    x > coast - 26 &&
    x < coast + 24
      ? -4.8
      : 0;

  return (
    plateau +
    cityRidge +
    historicHill +
    rolling +
    coastDrop +
    portTerrace
  );
}

export function heightAt(x, z) {
  const coast = coastX(z);
  const curvature = earthCurvature(x, z);

  if (x > coast + 18) {
    return SEA_LEVEL - 3.2 + curvature * 0.14;
  }

  return reliefHeight(x, z) + curvature;
}

function terrainColor(x, z, y) {
  const coast = coastX(z);
  const inland = coast - x;

  if (x > coast + 2) {
    return new THREE.Color(0x35484b);
  }

  if (inland < 20) {
    return new THREE.Color(0x89765f);
  }

  if (y > 20) {
    return new THREE.Color(0x747768);
  }

  if (y > 10) {
    return new THREE.Color(0x6f7564);
  }

  return new THREE.Color(0x686f60);
}

export function createTerrain() {
  const group = new THREE.Group();
  group.name = 'terrain';

  const geometry = new THREE.PlaneGeometry(
    CONFIG.world.width * 1.85,
    CONFIG.world.depth * 1.85,
    150,
    150
  );
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = heightAt(x, z);

    positions.setY(i, y);

    const color = terrainColor(x, z, y);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3)
  );
  geometry.computeVertexNormals();

  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.98,
      metalness: 0
    })
  );

  ground.receiveShadow = true;
  group.add(ground);

  const horizonGeometry = new THREE.RingGeometry(
    CONFIG.world.width * 0.68,
    CONFIG.world.width * 1.45,
    96,
    1
  );

  horizonGeometry.rotateX(-Math.PI / 2);

  const horizon = new THREE.Mesh(
    horizonGeometry,
    new THREE.MeshBasicMaterial({
      color: 0x26343d,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );

  horizon.position.y = -16;
  horizon.renderOrder = -5;
  group.add(horizon);

  return {
    group,
    heightAt,
    coastX,
    seaLevel: SEA_LEVEL
  };
}
