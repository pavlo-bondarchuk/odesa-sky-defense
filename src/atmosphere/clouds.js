import * as THREE from 'three';

function cloudMaterial(opacity, tone = 0xf4dfcf) {
  return new THREE.MeshBasicMaterial({
    color: tone,
    transparent: true,
    opacity,
    depthWrite: false
  });
}

function makeCloud({
  scale,
  opacity,
  altitude,
  layer,
  puffCount
}) {
  const group = new THREE.Group();
  const material = cloudMaterial(opacity);

  for (let i = 0; i < puffCount; i += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      material.clone()
    );

    const elongation =
      layer === 'high'
        ? 1.9
        : layer === 'low'
          ? 1.25
          : 1.5;

    puff.scale.set(
      (7 + Math.random() * 10) * elongation,
      1.8 + Math.random() * 4,
      4 + Math.random() * 8
    );

    puff.position.set(
      i * 6 - puffCount * 3 + Math.random() * 5,
      Math.random() * 3,
      Math.random() * 10 - 5
    );

    group.add(puff);
  }

  group.scale.setScalar(scale);
  group.position.y = altitude;
  group.userData = {
    baseOpacity: opacity,
    seed: Math.random() * Math.PI * 2,
    layer,
    baseScale: scale,
    altitude
  };

  return group;
}

export function createClouds(scene) {
  const clouds = [];
  const specs = [
    { count: 8, layer: 'high', altitude: 145, opacity: 0.055, scale: 1.15, puffs: 6 },
    { count: 10, layer: 'mid', altitude: 112, opacity: 0.08, scale: 0.95, puffs: 8 },
    { count: 8, layer: 'low', altitude: 78, opacity: 0.11, scale: 0.78, puffs: 9 }
  ];

  for (const spec of specs) {
    for (let i = 0; i < spec.count; i += 1) {
      const cloud = makeCloud({
        scale: spec.scale * (0.75 + Math.random() * 0.55),
        opacity: spec.opacity * (0.75 + Math.random() * 0.5),
        altitude: spec.altitude + Math.random() * 18,
        layer: spec.layer,
        puffCount: spec.puffs
      });

      cloud.position.x = -380 + Math.random() * 760;
      cloud.position.z = -380 + Math.random() * 760;

      scene.add(cloud);
      clouds.push(cloud);
    }
  }

  function update(
    delta,
    {
      cloudFactor = 0.2,
      windSpeed = 8,
      windDirection = 180,
      windGusts = 10,
      humidity = 65,
      night = false
    } = {}
  ) {
    const angle = THREE.MathUtils.degToRad(
      windDirection - 180
    );

    const gustFactor = THREE.MathUtils.clamp(
      windGusts / Math.max(1, windSpeed),
      1,
      2.4
    );

    clouds.forEach((cloud, index) => {
      const layerFactor =
        cloud.userData.layer === 'high'
          ? 1.45
          : cloud.userData.layer === 'low'
            ? 0.72
            : 1;

      const speed =
        THREE.MathUtils.clamp(
          windSpeed * 0.095 * layerFactor,
          0.35,
          6.2
        );

      const gustPulse =
        1 +
        Math.sin(
          performance.now() * 0.00055 +
          cloud.userData.seed
        ) *
          0.18 *
          (gustFactor - 1);

      cloud.position.x +=
        Math.sin(angle) * speed * gustPulse * delta;
      cloud.position.z +=
        Math.cos(angle) * speed * gustPulse * delta;

      cloud.position.y =
        cloud.userData.altitude +
        Math.sin(
          performance.now() * 0.00022 +
          cloud.userData.seed
        ) *
          (cloud.userData.layer === 'low' ? 2.2 : 1.1);

      cloud.rotation.y +=
        delta *
        0.0025 *
        layerFactor;

      if (cloud.position.x > 430) cloud.position.x = -430;
      if (cloud.position.x < -430) cloud.position.x = 430;
      if (cloud.position.z > 430) cloud.position.z = -430;
      if (cloud.position.z < -430) cloud.position.z = 430;

      const humidityFactor =
        THREE.MathUtils.clamp(
          (humidity - 35) / 65,
          0,
          1
        );

      const layerBias =
        cloud.userData.layer === 'low'
          ? 0.16
          : cloud.userData.layer === 'high'
            ? -0.08
            : 0;

      const visibility =
        THREE.MathUtils.clamp(
          cloudFactor * 1.45 +
          humidityFactor * 0.22 +
          layerBias -
          index / clouds.length * 0.1,
          0,
          1
        );

      cloud.visible = visibility > 0.015;

      const breathe =
        1 +
        Math.sin(
          performance.now() * 0.00033 +
          cloud.userData.seed
        ) * 0.035;

      cloud.scale.setScalar(
        cloud.userData.baseScale *
        breathe *
        (0.9 + visibility * 0.18)
      );

      for (const puff of cloud.children) {
        const targetOpacity =
          cloud.userData.baseOpacity *
          (0.2 + visibility * 4.2);

        puff.material.opacity =
          THREE.MathUtils.lerp(
            puff.material.opacity,
            targetOpacity,
            1 - Math.pow(0.02, delta)
          );

        const targetColor =
          night
            ? new THREE.Color(0x596679)
            : cloudFactor > 0.78
              ? new THREE.Color(0xaeb5bb)
              : cloud.userData.layer === 'high'
                ? new THREE.Color(0xf1e5dc)
                : new THREE.Color(0xe7dfd6);

        puff.material.color.lerp(
          targetColor,
          1 - Math.pow(0.025, delta)
        );
      }
    });
  }

  return { clouds, update };
}
