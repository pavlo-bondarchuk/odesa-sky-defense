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
      roughness: 0.88,
      metalness: 0.02,
      emissive:
        seed > 0.3
          ? new THREE.Color(
              seed > 0.82
                ? 0xcfdcff
                : 0xffc977
            )
          : new THREE.Color(0x000000),
      emissiveIntensity: 0
    });

    material.userData.nightWeight =
      seed > 0.3
        ? 0.18 + seed * 0.38
        : 0;

    nightMaterials.push(material);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const first = project(
      element.geometry[0].lat,
      element.geometry[0].lon
    );

    mesh.position.y = heightAt(first.x, first.z);

    group.add(mesh);
  }

  group.userData.nightMaterials = nightMaterials;
  return group;
}
