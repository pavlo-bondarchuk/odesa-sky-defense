import * as THREE from 'three';

export function createLighting(scene) {
  const hemi = new THREE.HemisphereLight(0x7fadd0, 0x6f5747, 1.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffb36b, 4.8);
  sun.position.set(-130, 105, 160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  scene.add(sun);

  return { hemi, sun };
}