import * as THREE from 'three';

export function createPrecipitation(scene, camera) {
  const count = 1000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 180;
    positions[i * 3 + 1] = Math.random() * 100;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 180;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xc9e8ff,
    size: 0.65,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });

  const points = new THREE.Points(
    geometry,
    material
  );

  points.visible = false;
  scene.add(points);

  function update(delta, state) {
    const raining =
      state.condition === 'rain' ||
      state.condition === 'storm';

    const snowing =
      state.condition === 'snow';

    const targetOpacity =
      raining
        ? 0.52 + state.strength * 0.3
        : snowing
          ? 0.72
          : 0;

    material.opacity = THREE.MathUtils.lerp(
      material.opacity,
      targetOpacity,
      1 - Math.pow(0.02, delta)
    );

    points.visible = material.opacity > 0.01;

    if (!points.visible) return;

    material.color.set(
      snowing
        ? 0xf6fbff
        : 0xb8dfff
    );

    material.size = snowing ? 1.2 : 0.48;

    const attr = geometry.attributes.position;
    const fallSpeed = snowing ? 7 : 42;

    for (let i = 0; i < count; i += 1) {
      let y = attr.getY(i);
      y -= fallSpeed * delta;

      if (y < 0) {
        y = 85 + Math.random() * 35;
        attr.setX(i, (Math.random() - 0.5) * 180);
        attr.setZ(i, (Math.random() - 0.5) * 180);
      }

      attr.setY(i, y);
    }

    attr.needsUpdate = true;

    points.position.x = camera.position.x;
    points.position.z = camera.position.z;
    points.position.y = camera.position.y - 35;
  }

  return { update };
}
