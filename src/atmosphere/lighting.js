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

  const moon = new THREE.DirectionalLight(
    0x9fb9d8,
    0
  );
  moon.castShadow = false;
  scene.add(moon);

  const moonTarget = new THREE.Object3D();
  scene.add(moonTarget);
  moon.target = moonTarget;

  const cityAmbient = new THREE.AmbientLight(
    0x5e6c7f,
    0
  );
  scene.add(cityAmbient);

  function update({
    delta,
    sun: sunState,
    weather,
    cloudFactor,
    celestial
  }) {
    const blend = 1 - Math.pow(0.025, delta);
    const radius = 260;

    const sunAltitude =
      celestial?.sun?.altitude ??
      sunState.elevation;

    const sunAzimuth =
      celestial?.sun?.azimuth ??
      sunState.azimuth;

    const cosElevation =
      Math.cos(sunAltitude);

    const targetPosition = new THREE.Vector3(
      -Math.sin(sunAzimuth) *
        cosElevation *
        radius,
      Math.sin(sunAltitude) * radius,
      Math.cos(sunAzimuth) *
        cosElevation *
        radius
    );

    sun.position.lerp(targetPosition, blend);

    const night = sunState.night;
    const golden = sunState.dawn || sunState.dusk;

    const nightFactor =
      sunState.nightFactor ?? (night ? 1 : 0);

    const sunAboveHorizon =
      THREE.MathUtils.smoothstep(
        sunAltitude,
        -0.055,
        0.08
      );

    const targetSunIntensity =
      sunAboveHorizon *
      (
        golden
          ? THREE.MathUtils.lerp(
              2.0,
              0.18,
              nightFactor
            )
          : 4.4 * (1 - cloudFactor * 0.58)
      );

    const targetHemiIntensity =
      THREE.MathUtils.lerp(
        1.25 * (1 - cloudFactor * 0.3),
        0.68,
        nightFactor
      );

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

    const moonAltitude =
      celestial?.moon?.altitude ?? -1;

    const moonVisible =
      THREE.MathUtils.smoothstep(
        moonAltitude,
        -0.08,
        0.18
      );

    const moonFraction =
      celestial?.moon?.fraction ?? 0;

    const moonCloudLoss =
      1 - cloudFactor * 0.62;

    const targetMoonIntensity =
      1.25 *
      moonVisible *
      moonFraction *
      moonCloudLoss *
      nightFactor;

    moon.intensity = THREE.MathUtils.lerp(
      moon.intensity,
      targetMoonIntensity,
      blend
    );

    if (celestial?.moon) {
      const radius = 240;
      const horizontal = Math.cos(celestial.moon.altitude);

      const moonPosition = new THREE.Vector3(
        -Math.sin(celestial.moon.azimuth) *
          horizontal *
          radius,
        Math.sin(celestial.moon.altitude) *
          radius,
        Math.cos(celestial.moon.azimuth) *
          horizontal *
          radius
      );

      moon.position.lerp(moonPosition, blend);
    }

    cityAmbient.intensity =
      THREE.MathUtils.lerp(
        cityAmbient.intensity,
        0.18 + nightFactor * 0.28,
        blend
      );
  }

  return {
    hemi,
    sun,
    moon,
    cityAmbient,
    update
  };
}
