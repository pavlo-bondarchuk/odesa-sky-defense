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
  group.userData.baseOpacity = opacity;
  group.userData.seed = Math.random() * Math.PI * 2;
  return group;
}

export function createClouds(scene) {
  const clouds = [];

  for (let i = 0; i < 20; i += 1) {
    const cloud = makeCloud(
      0.65 + Math.random() * 1.1,
      0.08 + Math.random() * 0.12
    );

    cloud.position.set(
      -340 + Math.random() * 680,
      76 + Math.random() * 95,
      -340 + Math.random() * 680
    );

    scene.add(cloud);
    clouds.push(cloud);
  }

  function update(
    delta,
    {
      cloudFactor = 0.2,
      windSpeed = 8,
      windDirection = 180,
      night = false
    } = {}
  ) {
    const angle =
      THREE.MathUtils.degToRad(
        windDirection - 180
      );

    const speed =
      THREE.MathUtils.clamp(
        windSpeed * 0.11,
        0.45,
        5.5
      );

    const vx = Math.sin(angle) * speed;
    const vz = Math.cos(angle) * speed;

    clouds.forEach((cloud, index) => {
      cloud.position.x += vx * delta;
      cloud.position.z += vz * delta;

      if (cloud.position.x > 390) cloud.position.x = -390;
      if (cloud.position.x < -390) cloud.position.x = 390;
      if (cloud.position.z > 390) cloud.position.z = -390;
      if (cloud.position.z < -390) cloud.position.z = 390;

      const visibility =
        THREE.MathUtils.clamp(
          cloudFactor * 1.35 -
          index / clouds.length * 0.25,
          0,
          1
        );

      cloud.visible = visibility > 0.02;

      for (const puff of cloud.children) {
        const targetOpacity =
          cloud.userData.baseOpacity *
          (0.25 + visibility * 3.2);

        puff.material.opacity =
          THREE.MathUtils.lerp(
            puff.material.opacity,
            targetOpacity,
            1 - Math.pow(0.025, delta)
          );

        const targetColor =
          night
            ? new THREE.Color(0x68758a)
            : cloudFactor > 0.72
              ? new THREE.Color(0xbfc3c4)
              : new THREE.Color(0xf3e5d6);

        puff.material.color.lerp(
          targetColor,
          1 - Math.pow(0.025, delta)
        );
      }
    });
  }

  return { clouds, update };
}
