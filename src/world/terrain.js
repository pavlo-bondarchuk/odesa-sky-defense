import * as THREE from 'three';
import { CONFIG } from '../config.js';

function heightAt(x, z) {
  const coastalSlope = THREE.MathUtils.smoothstep(-z, 20, 220) * 8.5;
  const rolling =
    Math.sin(x * 0.016) * 1.2 +
    Math.cos(z * 0.013) * 1.0 +
    Math.sin((x + z) * 0.011) * 0.75;

  const plateau = Math.exp(
    -(
      Math.pow((x + 110) / 95, 2) +
      Math.pow((z - 70) / 80, 2)
    )
  ) * 11;

  return coastalSlope + rolling + plateau;
}

export function createTerrain() {
  const group = new THREE.Group();
  group.name = 'terrain';

  const geometry = new THREE.PlaneGeometry(
    CONFIG.world.width,
    CONFIG.world.depth,
    90,
    90
  );
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = heightAt(x, z);
    positions.setY(i, y);

    const h = THREE.MathUtils.clamp((y + 3) / 18, 0, 1);
    const low = new THREE.Color(0x6a745f);
    const high = new THREE.Color(0x93937f);
    const color = low.lerp(high, h);
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
      roughness: 0.96,
      metalness: 0.01
    })
  );

  ground.receiveShadow = true;
  group.add(ground);

  const grid = new THREE.GridHelper(430, 18, 0x667067, 0x535d57);
  grid.position.y = 0.12;
  grid.material.transparent = true;
  grid.material.opacity = 0.1;
  group.add(grid);

  return { group, heightAt };
}