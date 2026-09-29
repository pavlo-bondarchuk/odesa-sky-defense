import * as THREE from 'three';

function cloudMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    color: 0xf4dfcf,
    transparent: true,
    opacity,
    depthWrite: false
  });
}

function makeCloud(scale, opacity) {
  const group = new THREE.Group();
  const material = cloudMaterial(opacity);

  for (let i = 0; i < 7; i += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      material
    );
    puff.scale.set(
      7 + Math.random() * 8,
      2.3 + Math.random() * 3,
      4 + Math.random() * 7
    );
    puff.position.set(
      i * 7 - 21 + Math.random() * 4,
      Math.random() * 2,
      Math.random() * 7 - 3.5
    );
    group.add(puff);
  }

  group.scale.setScalar(scale);
  return group;
}

export function createClouds(scene) {
  const clouds = [];

  for (let i = 0; i < 13; i += 1) {
    const cloud = makeCloud(
      0.7 + Math.random() * 0.9,
      0.08 + Math.random() * 0.1
    );

    cloud.position.set(
      -300 + Math.random() * 600,
      70 + Math.random() * 80,
      -300 + Math.random() * 600
    );

    scene.add(cloud);
    clouds.push(cloud);
  }

  function update(delta) {
    for (const cloud of clouds) {
      cloud.position.x += delta * 1.6;

      if (cloud.position.x > 340) {
        cloud.position.x = -340;
      }
    }
  }

  return { clouds, update };
}