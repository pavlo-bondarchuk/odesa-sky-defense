import * as THREE from 'three';

export function createLighting(scene) {
  const hemi = new THREE.HemisphereLight(
    0x7fadd0,
    0x6f5747,
    1.7
  );
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(
    0xffb36b,
    4.8
  );

  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  scene.add(sun);

  const target = new THREE.Object3D();
  scene.add(target);
  sun.target = target;

  function update({
    delta,
    sun: sunState,
    weather,
    cloudFactor
  }) {
    const blend = 1 - Math.pow(0.025, delta);
    const radius = 260;
    const cosElevation = Math.cos(sunState.elevation);

    const targetPosition = new THREE.Vector3(
      Math.sin(sunState.azimuth) * cosElevation * radius,
      Math.max(-35, Math.sin(sunState.elevation) * radius),
      Math.cos(sunState.azimuth) * cosElevation * radius
    );

    sun.position.lerp(targetPosition, blend);

    const night = sunState.night;
    const golden = sunState.dawn || sunState.dusk;

    const targetSunIntensity =
      night
        ? 0.05
        : golden
          ? 2.3
          : 4.4 * (1 - cloudFactor * 0.58);

    const targetHemiIntensity =
      night
        ? 0.35
        : 1.25 * (1 - cloudFactor * 0.3);

    sun.intensity = THREE.MathUtils.lerp(
      sun.intensity,
      targetSunIntensity,
      blend
    );

    hemi.intensity = THREE.MathUtils.lerp(
      hemi.intensity,
      targetHemiIntensity,
      blend
    );

    const sunColor =
      golden
        ? new THREE.Color(0xffa45f)
        : weather.condition === 'overcast' ||
            weather.condition === 'rain'
          ? new THREE.Color(0xc8d0d4)
          : new THREE.Color(0xfff0d2);

    sun.color.lerp(sunColor, blend);

    const skyColor =
      night
        ? new THREE.Color(0x1b2942)
        : weather.condition === 'overcast' ||
            weather.condition === 'rain'
          ? new THREE.Color(0x7e8a96)
          : new THREE.Color(0x8bbce1);

    const groundColor =
      night
        ? new THREE.Color(0x181b22)
        : new THREE.Color(0x6b5c4c);

    hemi.color.lerp(skyColor, blend);
    hemi.groundColor.lerp(groundColor, blend);
  }

  return { hemi, sun, update };
}
