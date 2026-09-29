import * as THREE from 'three';

export function createSky(scene) {
  const geometry = new THREE.SphereGeometry(780, 32, 18);

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x416b98) },
      horizonColor: { value: new THREE.Color(0xf5a46b) },
      lowColor: { value: new THREE.Color(0xf6cf9a) }
    },
    vertexShader: `
      varying vec3 vWorld;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = normalize(world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 lowColor;

      void main() {
        float h = clamp(vWorld.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = mix(
          lowColor,
          horizonColor,
          smoothstep(0.32, 0.58, h)
        );
        vec3 color = mix(
          horizon,
          topColor,
          smoothstep(0.5, 0.92, h)
        );
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const sky = new THREE.Mesh(geometry, material);
  scene.add(sky);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(7.5, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffcf86,
      transparent: true,
      opacity: 1
    })
  );
  scene.add(sunDisc);

  function update({ delta, topColor, horizonColor, lowColor, sun }) {
    const blend = 1 - Math.pow(0.02, delta);

    material.uniforms.topColor.value.lerp(topColor, blend);
    material.uniforms.horizonColor.value.lerp(horizonColor, blend);
    material.uniforms.lowColor.value.lerp(lowColor, blend);

    const radius = 310;
    const cosElevation = Math.cos(sun.elevation);

    sunDisc.position.set(
      Math.sin(sun.azimuth) * cosElevation * radius,
      Math.sin(sun.elevation) * radius,
      Math.cos(sun.azimuth) * cosElevation * radius
    );

    sunDisc.visible =
      sun.daylight > 0.04 &&
      sunDisc.position.y > -12;

    sunDisc.material.opacity =
      THREE.MathUtils.lerp(
        sunDisc.material.opacity,
        sun.dawn || sun.dusk ? 0.88 : 0.72,
        blend
      );

    sunDisc.scale.setScalar(
      sun.dawn || sun.dusk ? 1.18 : 1
    );
  }

  return { sky, sunDisc, update };
}
