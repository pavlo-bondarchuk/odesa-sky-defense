import * as THREE from 'three';
import { project } from './osm.js';

function seeded(id) {
  const x = Math.sin(Number(id) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function getHeight(tags, id) {
  const levels = Number(tags?.['building:levels']);

  if (Number.isFinite(levels) && levels > 0) {
    return THREE.MathUtils.clamp(levels * 2.7, 5, 24);
  }

  return 6 + Math.floor(seeded(id) * 5) * 2.2;
}

export function createBuildings(elements, heightAt) {
  const group = new THREE.Group();
  group.name = 'osm-buildings';

  const palette = [
    0xc2b3a0,
    0xbba993,
    0xd0c3ae,
    0xa99b8a,
    0xc9b79f
  ];

  const nightMaterials = [];
  const warmWindows = [];
  const coolWindows = [];
  const MAX_WINDOWS = 18000;

  for (const element of elements) {
    if (!element.tags?.building || !element.geometry?.length) continue;
    if (element.geometry.length < 4) continue;

    const shape = new THREE.Shape();

    element.geometry.forEach((point, index) => {
      const p = project(point.lat, point.lon);

      if (index === 0) shape.moveTo(p.x, -p.z);
      else shape.lineTo(p.x, -p.z);
    });

    const height = getHeight(element.tags, element.id);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false
    });

    geometry.rotateX(-Math.PI / 2);

    const seed = seeded(element.id);
    const material = new THREE.MeshStandardMaterial({
      color: palette[Math.abs(Number(element.id)) % palette.length],
      roughness: 0.9,
      metalness: 0.01,
      emissive: new THREE.Color(0x151a20),
      emissiveIntensity: 0
    });

    material.userData.nightWeight =
      seed > 0.38
        ? 0.018 + seed * 0.025
        : 0;

    nightMaterials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const first = project(
      element.geometry[0].lat,
      element.geometry[0].lon
    );

    const baseY = heightAt(first.x, first.z);
    mesh.position.y = baseY;

    if (
      warmWindows.length / 3 < MAX_WINDOWS &&
      seed > 0.22
    ) {
      const floors = THREE.MathUtils.clamp(
        Math.floor(height / 2.8),
        2,
        8
      );

      const geometryPoints =
        element.geometry.map((point) =>
          project(point.lat, point.lon)
        );

      for (let edge = 0; edge < geometryPoints.length - 1; edge += 1) {
        const a = geometryPoints[edge];
        const b = geometryPoints[edge + 1];

        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = Math.hypot(dx, dz);

        if (length < 2.5) continue;

        const nx = -dz / length;
        const nz = dx / length;

        const columns = THREE.MathUtils.clamp(
          Math.floor(length / 4.2),
          1,
          4
        );

        for (let floor = 1; floor <= floors; floor += 1) {
          for (let column = 1; column <= columns; column += 1) {
            const localSeed =
              seeded(
                Number(element.id) +
                edge * 131 +
                floor * 17 +
                column * 7
              );

            if (localSeed < 0.58) continue;

            const t = column / (columns + 1);
            const x =
              THREE.MathUtils.lerp(a.x, b.x, t) +
              nx * 0.09;
            const z =
              THREE.MathUtils.lerp(a.z, b.z, t) +
              nz * 0.09;
            const y =
              baseY +
              floor * 2.65 -
              0.55;

            const target =
              localSeed > 0.9
                ? coolWindows
                : warmWindows;

            target.push(x, y, z);

            if (
              warmWindows.length / 3 +
              coolWindows.length / 3 >=
              MAX_WINDOWS
            ) break;
          }

          if (
            warmWindows.length / 3 +
            coolWindows.length / 3 >=
            MAX_WINDOWS
          ) break;
        }

        if (
          warmWindows.length / 3 +
          coolWindows.length / 3 >=
          MAX_WINDOWS
        ) break;
      }
    }

    group.add(mesh);
  }

  function makeWindows(
    positions,
    color,
    size
  ) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        positions,
        3
      )
    );

    const material = new THREE.PointsMaterial({
      color,
      size,
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

    points.renderOrder = 28;
    group.add(points);

    return material;
  }

  const warmWindowMaterial = makeWindows(
    warmWindows,
    0xffc56d,
    0.58
  );

  const coolWindowMaterial = makeWindows(
    coolWindows,
    0xc8ddff,
    0.5
  );

  group.userData.nightMaterials = nightMaterials;
  group.userData.windowMaterials = [
    warmWindowMaterial,
    coolWindowMaterial
  ];

  return group;
}
