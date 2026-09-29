import * as THREE from 'three';
import { project } from './osm.js';

const METRO_SNAPSHOT_URL = './data/odesa-metro.json';

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

function bounds(geometry) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const point of geometry) {
    const p = project(point.lat, point.lon);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }

  return {
    width: Math.max(2.8, maxX - minX),
    depth: Math.max(2.8, maxZ - minZ)
  };
}

async function loadMetroSnapshot() {
  try {
    const response = await fetch(
      METRO_SNAPSHOT_URL,
      { cache: 'no-cache' }
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (
      !Array.isArray(data?.elements) ||
      data.elements.length < 100
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function createOuterBuildings(elements, heightAt) {
  const candidates = [];

  for (const element of elements) {
    if (!element.tags?.building || !element.geometry?.length) continue;

    const center = centroid(element.geometry);
    const radius = Math.hypot(center.x, center.z);

    if (radius < 230) continue;

    const size = bounds(element.geometry);
    const seed = seeded(element.id);

    const levels = Number(
      element.tags?.['building:levels']
    );

    const height =
      Number.isFinite(levels) && levels > 0
        ? THREE.MathUtils.clamp(levels * 2.45, 4.5, 38)
        : THREE.MathUtils.lerp(5, 18, seed);

    candidates.push({
      x: center.x,
      z: center.z,
      width: THREE.MathUtils.clamp(size.width, 3, 24),
      depth: THREE.MathUtils.clamp(size.depth, 3, 30),
      height,
      id: Number(element.id)
    });
  }

  const MAX_BUILDINGS = 26000;
  const items = candidates.slice(0, MAX_BUILDINGS);

  const geometry = new THREE.BoxGeometry(1, 1, 1);

  const material = new THREE.MeshStandardMaterial({
    color: 0x7f8587,
    roughness: 0.96,
    metalness: 0.01,
    vertexColors: true
  });

  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    items.length
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const color = new THREE.Color();

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const seed = seeded(item.id + 41);

    position.set(
      item.x,
      heightAt(item.x, item.z) + item.height * 0.5,
      item.z
    );

    scale.set(
      item.width,
      item.height,
      item.depth
    );

    matrix.compose(
      position,
      quaternion,
      scale
    );

    mesh.setMatrixAt(i, matrix);

    const base =
      seed > 0.7
        ? 0x7d817d
        : seed > 0.38
          ? 0x8e8a80
          : 0x70797d;

    color.set(base);
    mesh.setColorAt(i, color);
  }

  mesh.castShadow = false;
  mesh.receiveShadow = true;

  return mesh;
}

function createOuterRoads(elements, heightAt) {
  const positions = [];
  const majorPositions = [];

  for (const element of elements) {
    if (!element.tags?.highway || !element.geometry?.length) continue;

    const type = element.tags.highway;
    const isRoad = [
      'motorway',
      'trunk',
      'primary',
      'secondary',
      'tertiary',
      'residential',
      'living_street',
      'service'
    ].includes(type);

    if (!isRoad) continue;

    const target =
      ['motorway', 'trunk', 'primary', 'secondary']
        .includes(type)
        ? majorPositions
        : positions;

    for (let i = 0; i < element.geometry.length - 1; i += 1) {
      const a = project(
        element.geometry[i].lat,
        element.geometry[i].lon
      );
      const b = project(
        element.geometry[i + 1].lat,
        element.geometry[i + 1].lon
      );

      if (
        Math.hypot(a.x, a.z) < 220 &&
        Math.hypot(b.x, b.z) < 220
      ) {
        continue;
      }

      target.push(
        a.x,
        heightAt(a.x, a.z) + 0.12,
        a.z,
        b.x,
        heightAt(b.x, b.z) + 0.12,
        b.z
      );
    }
  }

  function makeLines(data, color, opacity) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        data,
        3
      )
    );

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity
    });

    return new THREE.LineSegments(
      geometry,
      material
    );
  }

  return {
    regular: makeLines(
      positions,
      0x444b4f,
      0.72
    ),
    major: makeLines(
      majorPositions,
      0x656d70,
      0.92
    )
  };
}

function createOuterLights(elements, heightAt) {
  const positions = [];

  for (const element of elements) {
    if (!element.tags?.highway || !element.geometry?.length) continue;

    const type = element.tags.highway;

    if (
      ![
        'primary',
        'secondary',
        'tertiary',
        'residential'
      ].includes(type)
    ) {
      continue;
    }

    const step = type === 'primary' ? 3 : 5;

    for (
      let i = 0;
      i < element.geometry.length;
      i += step
    ) {
      const p = project(
        element.geometry[i].lat,
        element.geometry[i].lon
      );

      if (Math.hypot(p.x, p.z) < 220) continue;

      positions.push(
        p.x,
        heightAt(p.x, p.z) + 2.5,
        p.z
      );
    }
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
    color: 0xffc76d,
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

  points.renderOrder = 20;

  return { points, material };
}

function createProceduralOutskirts(heightAt) {
  const group = new THREE.Group();
  group.name = 'procedural-outskirts';

  const items = [];
  const lightPositions = [];
  const roadSegments = [];

  const zones = [
    { cx: -420, cz: 40, rx: 230, rz: 300, density: 0.72, towers: 0.2 },
    { cx: -250, cz: -330, rx: 260, rz: 230, density: 0.78, towers: 0.28 },
    { cx: -30, cz: -400, rx: 260, rz: 210, density: 0.74, towers: 0.22 },
    { cx: 235, cz: -310, rx: 190, rz: 190, density: 0.6, towers: 0.32 },
    { cx: -430, cz: 310, rx: 230, rz: 210, density: 0.62, towers: 0.16 },
    { cx: -150, cz: 250, rx: 260, rz: 190, density: 0.7, towers: 0.2 },
    { cx: 80, cz: 180, rx: 210, rz: 180, density: 0.66, towers: 0.2 }
  ];

  const grid = 18;

  for (let x = -760; x <= 520; x += grid) {
    for (let z = -620; z <= 580; z += grid) {
      const r = Math.hypot(x, z);

      if (r < 235) continue;

      let influence = 0;
      let towerChance = 0;

      for (const zone of zones) {
        const dx = (x - zone.cx) / zone.rx;
        const dz = (z - zone.cz) / zone.rz;
        const d = dx * dx + dz * dz;

        if (d < 1) {
          const local = (1 - d) * zone.density;
          influence = Math.max(influence, local);
          towerChance = Math.max(
            towerChance,
            (1 - d) * zone.towers
          );
        }
      }

      const corridorA =
        Math.abs(z - (0.58 * x - 75)) < 90
          ? 0.28
          : 0;

      const corridorB =
        Math.abs(z + (0.28 * x + 240)) < 100
          ? 0.22
          : 0;

      influence = Math.max(
        influence,
        corridorA,
        corridorB
      );

      if (influence <= 0) continue;

      const seed = seeded(
        x * 17.17 +
        z * 31.31
      );

      if (seed > influence + 0.18) continue;

      const jitterX =
        (seeded(seed * 2001) - 0.5) * 6;

      const jitterZ =
        (seeded(seed * 3001) - 0.5) * 6;

      const px = x + jitterX;
      const pz = z + jitterZ;

      const towerSeed = seeded(seed * 5001);
      const highRise =
        towerSeed < towerChance;

      const h = highRise
        ? 24 + seeded(seed * 7001) * 34
        : 5.5 + seeded(seed * 8001) * 13;

      const w =
        highRise
          ? 9 + seeded(seed * 9001) * 9
          : 6 + seeded(seed * 10001) * 10;

      const d =
        highRise
          ? 10 + seeded(seed * 11001) * 10
          : 7 + seeded(seed * 12001) * 12;

      items.push({
        x: px,
        z: pz,
        w,
        d,
        h,
        seed
      });

      if (
        seeded(seed * 13001) > 0.76
      ) {
        lightPositions.push(
          px,
          heightAt(px, pz) + 2.4,
          pz
        );
      }
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);

  const material = new THREE.MeshStandardMaterial({
    color: 0x737b7e,
    roughness: 0.98,
    vertexColors: true
  });

  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    items.length
  );

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  items.forEach((item, index) => {
    position.set(
      item.x,
      heightAt(item.x, item.z) + item.h * 0.5,
      item.z
    );

    const angle =
      (seeded(item.seed * 14001) - 0.5) * 0.22;

    quaternion.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      angle
    );

    scale.set(
      item.w,
      item.h,
      item.d
    );

    matrix.compose(
      position,
      quaternion,
      scale
    );

    mesh.setMatrixAt(index, matrix);

    const shade = seeded(item.seed * 15001);

    color.set(
      shade > 0.7
        ? 0x7c8588
        : shade > 0.35
          ? 0x687176
          : 0x596469
    );

    mesh.setColorAt(index, color);
  });

  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);

  function addRoad(points) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];

      roadSegments.push(
        a.x,
        heightAt(a.x, a.z) + 0.16,
        a.z,
        b.x,
        heightAt(b.x, b.z) + 0.16,
        b.z
      );
    }
  }

  addRoad([
    { x: -760, z: 450 },
    { x: -520, z: 315 },
    { x: -300, z: 145 },
    { x: -85, z: 20 },
    { x: 145, z: -135 },
    { x: 410, z: -325 }
  ]);

  addRoad([
    { x: -700, z: -470 },
    { x: -470, z: -390 },
    { x: -250, z: -330 },
    { x: -35, z: -395 },
    { x: 230, z: -310 },
    { x: 500, z: -170 }
  ]);

  addRoad([
    { x: -560, z: 540 },
    { x: -410, z: 320 },
    { x: -250, z: 120 },
    { x: -160, z: -100 },
    { x: -150, z: -330 }
  ]);

  for (let z = -520; z <= 420; z += 72) {
    addRoad([
      { x: -650, z },
      { x: 350, z: z + 28 }
    ]);
  }

  for (let x = -600; x <= 300; x += 86) {
    addRoad([
      { x, z: -540 },
      { x: x + 12, z: 470 }
    ]);
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      roadSegments,
      3
    )
  );

  const roadMaterial = new THREE.LineBasicMaterial({
    color: 0x596166,
    transparent: true,
    opacity: 0.72
  });

  group.add(
    new THREE.LineSegments(
      roadGeometry,
      roadMaterial
    )
  );

  const lightGeometry = new THREE.BufferGeometry();
  lightGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      lightPositions,
      3
    )
  );

  const lightMaterial = new THREE.PointsMaterial({
    color: 0xffc977,
    size: 1.15,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const lights = new THREE.Points(
    lightGeometry,
    lightMaterial
  );

  lights.renderOrder = 19;
  group.add(lights);

  group.userData.updateNight = (factor) => {
    lightMaterial.opacity =
      THREE.MathUtils.clamp(
        (factor - 0.18) / 0.72,
        0,
        0.78
      );
  };

  group.userData.objectCount = items.length;

  return group;
}
export async function createMetropolitanLayer(heightAt) {
  const group = new THREE.Group();
  group.name = 'odesa-metropolitan';

  const data = await loadMetroSnapshot();

  if (!data) {
    const fallback = createProceduralOutskirts(heightAt);
    group.add(fallback);

    group.userData.source = 'procedural';
    group.userData.objectCount =
      fallback.userData.objectCount || 0;

    group.userData.updateNight = (factor) => {
      fallback.userData.updateNight?.(factor);
    };
    return group;
  }

  const buildings = createOuterBuildings(
    data.elements,
    heightAt
  );

  const roads = createOuterRoads(
    data.elements,
    heightAt
  );

  const lights = createOuterLights(
    data.elements,
    heightAt
  );

  group.add(
    roads.regular,
    roads.major,
    buildings,
    lights.points
  );

  group.userData.source = 'osm-metro';
  group.userData.objectCount =
    buildings.count || 0;

  group.userData.updateNight = (factor) => {
    lights.material.opacity =
      THREE.MathUtils.clamp(
        (factor - 0.16) / 0.72,
        0,
        0.82
      );
  };

  return group;
}
