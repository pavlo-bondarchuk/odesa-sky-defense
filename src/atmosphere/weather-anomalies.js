import * as THREE from 'three';

export function createWeatherAnomalies(scene) {
  const flash = new THREE.HemisphereLight(
    0xd9ecff,
    0x6a7482,
    0
  );

  scene.add(flash);

  let stormClock = 0;
  let nextFlash = 3;
  let flashLife = 0;

  function update(delta, {
    condition,
    windGusts = 0,
    precipitation = 0
  }) {
    const storm = condition === 'storm';

    if (storm) {
      stormClock += delta;

      if (stormClock >= nextFlash) {
        stormClock = 0;
        nextFlash = 2.5 + Math.random() * 8;
        flashLife = 0.11 + Math.random() * 0.14;
        flash.intensity = 5.5 + Math.random() * 4.5;
      }
    } else {
      stormClock = 0;
      nextFlash = 3;
    }

    if (flashLife > 0) {
      flashLife -= delta;
      flash.intensity *= Math.pow(0.0008, delta);
    } else {
      flash.intensity = THREE.MathUtils.lerp(
        flash.intensity,
        0,
        1 - Math.pow(0.005, delta)
      );
    }

    return {
      gustFactor: THREE.MathUtils.clamp(
        windGusts / 55,
        0,
        1.4
      ),
      wetness: THREE.MathUtils.clamp(
        precipitation / 4,
        0,
        1
      )
    };
  }

  return { update };
}
