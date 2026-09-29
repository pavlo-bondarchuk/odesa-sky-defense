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

  const districts = [
    { x: -410, z: 40, cols: 17, rows: 11, sx: 19, sz: 18 },
    { x: -250, z: -330, cols: 14, rows: 9, sx: 20, sz: 19 },
    { x: -30, z: -390, cols: 13, rows: 8, sx: 21, sz: 20 },
    { x: 260, z: -300, cols: 9, rows: 7, sx: 20, sz: 21 },
    { x: -430, z: 300, cols: 12, rows: 8, sx: 23, sz: 20 }
  ];

  const items = [];

  for (const district of districts) {
    for (let ix = 0; ix < district.cols; ix += 1) {
      for (let iz = 0; iz < district.rows; iz += 1) {
        const seed = seeded(
          district.x * 11 +
          district.z * 7 +
          ix * 31 +
          iz * 17
        );

        if (seed < 0.16) continue;

        const x =
          district.x +
          (ix - district.cols * 0.5) * district.sx;

        const z =
          district.z +
          (iz - district.rows * 0.5) * district.sz;

        items.push({
          x,
          z,
          w: 7 + seed * 10,
          d: 7 + seeded(seed * 500) * 12,
          h:
            seed > 0.76
              ? 24 + seed * 18
              : 7 + seed * 12
        });
      }
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x737b7e,
    roughness: 0.98
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

  items.forEach((item, index) => {
    position.set(
      item.x,
      heightAt(item.x, item.z) + item.h * 0.5,
      item.z
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
  });

  group.add(mesh);

  const roadMaterial = new THREE.LineBasicMaterial({
    color: 0x51595d,
    transparent: true,
    opacity: 0.82
  });

  function addRoad(points) {
    const positions = [];

    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];

      positions.push(
        a.x,
        heightAt(a.x, a.z) + 0.14,
        a.z,
        b.x,
        heightAt(b.x, b.z) + 0.14,
        b.z
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

    group.add(
      new THREE.LineSegments(
        geometry,
        roadMaterial
      )
    );
  }

  const districtCenters = districts.map(
    (district) => ({
      x: district.x,
      z: district.z
    })
  );

  addRoad([
    { x: -620, z: 360 },
    { x: -430, z: 300 },
    { x: -260, z: 120 },
    { x: -80, z: 20 },
    { x: 120, z: -120 },
    { x: 320, z: -300 }
  ]);

  addRoad([
    { x: -520, z: -420 },
    { x: -250, z: -330 },
    { x: -30, z: -390 },
    { x: 260, z: -300 },
    { x: 500, z: -180 }
  ]);

  for (const district of districts) {
    const halfW =
      district.cols * district.sx * 0.5;

    const halfD =
      district.rows * district.sz * 0.5;

    for (let row = -2; row <= 2; row += 1) {
      const z =
        district.z +
        row * halfD * 0.34;

      addRoad([
        {
          x: district.x - halfW * 0.55,
          z
        },
        {
          x: district.x + halfW * 0.55,
          z
        }
      ]);
    }

    for (let col = -2; col <= 2; col += 1) {
      const x =
        district.x +
        col * halfW * 0.34;

      addRoad([
        {
          x,
          z: district.z - halfD * 0.55
        },
        {
          x,
          z: district.z + halfD * 0.55
        }
      ]);
    }
  }

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
    group.userData.objectCount = fallback.children.length;

    group.userData.updateNight = () => {};
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
