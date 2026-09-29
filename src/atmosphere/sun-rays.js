import * as THREE from 'three';

export function createSunRays(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const material = new THREE.MeshBasicMaterial({
    color: 0xffd9a2,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  for (let i = 0; i < 7; i += 1) {
    const geometry = new THREE.ConeGeometry(
      10 + i * 2.5,
      230 + i * 18,
      10,
      1,
      true
    );

    const ray = new THREE.Mesh(
      geometry,
      material.clone()
    );

    ray.rotation.z = Math.PI / 2;
    ray.scale.z = 0.25 + i * 0.04;
    ray.userData.seed = i * 1.37;
    group.add(ray);
  }

  function update(delta, {
    sunPosition,
    sunlight,
    cloudFactor,
    dusk,
    dawn
  }) {
    const targetOpacity =
      sunlight *
      (dusk || dawn ? 0.22 : 0.08) *
      (0.35 + cloudFactor * 0.9);

    group.visible = targetOpacity > 0.008;
    group.position.copy(sunPosition).multiplyScalar(0.58);
    group.lookAt(0, 30, 0);

    group.children.forEach((ray, index) => {
      const pulse =
        0.82 +
        Math.sin(
          performance.now() * 0.00045 +
          ray.userData.seed
        ) * 0.18;

      ray.material.opacity =
        THREE.MathUtils.lerp(
          ray.material.opacity,
          targetOpacity *
            pulse *
            (1 - index * 0.07),
          1 - Math.pow(0.03, delta)
        );
    });
  }

  return { update };
}
