import * as THREE from 'three';
import { project } from './osm.js';

function seeded(value) {
  const x = Math.sin(Number(value) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function centroid(geometry) {
  let x = 0;
  let z = 0;

  for (const point of geometry) {
    const p = project(point.lat, point.lon);
    x += p.x;
    z += p.z;
  }

  const count = Math.max(1, geometry.length);

  return {
    x: x / count,
    z: z / count
  };
}

function collectRoadSamples(elements, step = 24) {
  const samples = [];

  for (const element of elements) {
    if (!element.tags?.highway || !element.geometry?.length) continue;

    const allowed = [
      'primary',
      'secondary',
      'tertiary',
      'residential',
      'living_street',
      'service'
    ];

    if (!allowed.includes(element.tags.highway)) continue;

    const points = element.geometry.map((point) => {
      const p = project(point.lat, point.lon);
      return new THREE.Vector3(p.x, 0, p.z);
    });

    if (points.length < 2) continue;

    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal'
    );

    const count = Math.max(
      1,
      Math.floor(curve.getLength() / step)
    );

    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);

      samples.push({
        x: p.x,
        z: p.z,
        tangent,
        id: Number(element.id) + i * 17
      });
    }
  }

  return samples;
}

function createTrees(elements, heightAt) {
  const samples = collectRoadSamples(elements, 30);
  const positions = [];

  for (const sample of samples) {
    const seed = seeded(sample.id);

    if (seed < 0.36) continue;

    const side = seed > 0.68 ? 1 : -1;
    const offset = 4.8 + seeded(sample.id + 3) * 3.8;

    const nx = -sample.tangent.z;
    const nz = sample.tangent.x;

    const x = sample.x + nx * offset * side;
    const z = sample.z + nz * offset * side;

    positions.push({
      x,
      y: heightAt(x, z),
      z,
      scale: 0.72 + seeded(sample.id + 9) * 0.75
    });
  }

  const count = Math.min(positions.length, 1800);

  const trunkGeometry = new THREE.CylinderGeometry(
    0.13,
    0.18,
    1.7,
    5
  );

  const crownGeometry = new THREE.ConeGeometry(
    0.85,
    2.5,
    7
  );

  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c3827,
    roughness: 0.95
  });

  const crownMaterial = new THREE.MeshStandardMaterial({
    color: 0x314c34,
    roughness: 0.98
  });

  const trunks = new THREE.InstancedMesh(
    trunkGeometry,
    trunkMaterial,
    count
  );

  const crowns = new THREE.InstancedMesh(
    crownGeometry,
    crownMaterial,
    count
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();

  for (let i = 0; i < count; i += 1) {
    const item = positions[i];

    position.set(
      item.x,
      item.y + 0.85 * item.scale,
      item.z
    );

    scale.setScalar(item.scale);

    matrix.compose(
      position,
      quaternion,
      scale
    );

    trunks.setMatrixAt(i, matrix);

    position.y =
      item.y + 2.15 * item.scale;

    scale.set(
      item.scale,
      item.scale,
      item.scale
    );

    matrix.compose(
      position,
      quaternion,
      scale
    );

    crowns.setMatrixAt(i, matrix);
  }

  trunks.castShadow = true;
  trunks.receiveShadow = true;
  crowns.castShadow = true;
  crowns.receiveShadow = true;

  return { trunks, crowns };
}

function createParkedCars(elements, heightAt) {
  const samples = collectRoadSamples(elements, 34);
  const cars = [];

  for (const sample of samples) {
    const seed = seeded(sample.id + 101);

    if (seed < 0.54) continue;

    const side = seed > 0.77 ? 1 : -1;
    const offset = 2.7 + seeded(sample.id + 102) * 0.8;

    const nx = -sample.tangent.z;
    const nz = sample.tangent.x;

    cars.push({
      x: sample.x + nx * offset * side,
      z: sample.z + nz * offset * side,
      rotation: Math.atan2(
        sample.tangent.x,
        sample.tangent.z
      ),
      id: sample.id
    });
  }

  const count = Math.min(cars.length, 1200);

  const geometry = new THREE.BoxGeometry(
    1.55,
    0.62,
    3.1
  );

  const material = new THREE.MeshStandardMaterial({
    color: 0x82909b,
    roughness: 0.72,
    metalness: 0.08
  });

  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    count
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < count; i += 1) {
    const car = cars[i];
    const sizeSeed = seeded(car.id + 150);

    position.set(
      car.x,
      heightAt(car.x, car.z) + 0.38,
      car.z
    );

    quaternion.setFromAxisAngle(
      axis,
      car.rotation
    );

    scale.set(
      0.82 + sizeSeed * 0.26,
      0.88 + sizeSeed * 0.12,
      0.82 + sizeSeed * 0.3
    );

    matrix.compose(
      position,
      quaternion,
      scale
    );

    mesh.setMatrixAt(i, matrix);
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

function createRoofDetails(elements, heightAt) {
  const details = [];

  for (const element of elements) {
    if (!element.tags?.building || !element.geometry?.length) continue;

    const seed = seeded(element.id + 500);

    if (seed < 0.4) continue;

    const center = centroid(element.geometry);

    const levels = Number(
      element.tags?.['building:levels']
    );

    const buildingHeight =
      Number.isFinite(levels) && levels > 0
        ? THREE.MathUtils.clamp(levels * 2.7, 5, 24)
        : 6 + Math.floor(seeded(element.id) * 5) * 2.2;

    details.push({
      x: center.x,
      z: center.z,
      y:
        heightAt(center.x, center.z) +
        buildingHeight +
        0.35,
      id: Number(element.id)
    });
  }

  const count = Math.min(details.length, 2500);

  const geometry = new THREE.BoxGeometry(
    0.9,
    0.7,
    1.1
  );

  const material = new THREE.MeshStandardMaterial({
    color: 0x555d61,
    roughness: 0.86,
    metalness: 0.05
  });

  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    count
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (let i = 0; i < count; i += 1) {
    const item = details[i];
    const seed = seeded(item.id + 700);

    position.set(item.x, item.y, item.z);

    scale.set(
      0.65 + seed * 1.3,
      0.55 + seed * 1.05,
      0.65 + seeded(item.id + 701) * 1.3
    );

    matrix.compose(
      position,
      quaternion,
      scale
    );

    mesh.setMatrixAt(i, matrix);
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

function createCourtyardLights(elements, heightAt) {
  const positions = [];

  for (const element of elements) {
    if (!element.tags?.building || !element.geometry?.length) continue;

    const seed = seeded(element.id + 900);

    if (seed < 0.78) continue;

    const center = centroid(element.geometry);

    positions.push(
      center.x,
      heightAt(center.x, center.z) + 2.6,
      center.z
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  const material = new THREE.PointsMaterial({
    color: 0xffd59a,
    size: 1.15,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(
    geometry,
    material
  );

  points.renderOrder = 27;

  return {
    points,
    material
  };
}

export function createCityDetails(elements, heightAt) {
  const group = new THREE.Group();
  group.name = 'city-details';

  const trees = createTrees(elements, heightAt);
  group.add(trees.trunks, trees.crowns);

  const parkedCars = createParkedCars(
    elements,
    heightAt
  );
  group.add(parkedCars);

  const roofDetails = createRoofDetails(
    elements,
    heightAt
  );
  group.add(roofDetails);

  const courtyardLights =
    createCourtyardLights(
      elements,
      heightAt
    );

  group.add(courtyardLights.points);

  group.userData.updateNight = (factor) => {
    courtyardLights.material.opacity =
      THREE.MathUtils.clamp(
        (factor - 0.2) / 0.7,
        0,
        0.72
      );
  };

  return group;
}
