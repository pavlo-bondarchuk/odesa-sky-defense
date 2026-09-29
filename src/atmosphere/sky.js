import * as THREE from 'three';

function createMoonMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      phase: { value: 0.5 },
      brightness: { value: 0.75 }
    },
    vertexShader: `
      varying vec3 vNormal;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position =
          projectionMatrix *
          modelViewMatrix *
          vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform float phase;
      uniform float brightness;

      void main() {
        vec3 n = normalize(vNormal);

        float terminator =
          mix(-1.0, 1.0, phase);

        float light =
          smoothstep(
            terminator - 0.18,
            terminator + 0.18,
            n.x
          );

        float edge =
          pow(
            clamp(n.z * 0.5 + 0.5, 0.0, 1.0),
            0.35
          );

        vec3 moonColor =
          mix(
            vec3(0.34, 0.36, 0.39),
            vec3(0.92, 0.93, 0.88),
            light
          );

        float alpha =
          smoothstep(-0.04, 0.08, n.z);

        gl_FragColor =
          vec4(
            moonColor * brightness * edge,
            alpha
          );
      }
    `
  });
}

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

        vec3 horizon =
          mix(
            lowColor,
            horizonColor,
            smoothstep(0.32, 0.58, h)
          );

        vec3 color =
          mix(
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

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(6.2, 32, 20),
    createMoonMaterial()
  );
  moon.visible = false;
  scene.add(moon);

  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 128;
  haloCanvas.height = 128;

  const haloContext = haloCanvas.getContext('2d');
  const haloGradient = haloContext.createRadialGradient(
    64,
    64,
    3,
    64,
    64,
    62
  );

  haloGradient.addColorStop(0, 'rgba(215,230,255,0.58)');
  haloGradient.addColorStop(0.22, 'rgba(185,210,245,0.24)');
  haloGradient.addColorStop(1, 'rgba(160,195,235,0)');

  haloContext.fillStyle = haloGradient;
  haloContext.fillRect(0, 0, 128, 128);

  const haloTexture = new THREE.CanvasTexture(haloCanvas);

  const moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture,
      color: 0xbfd7ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );

  moonHalo.scale.set(34, 34, 1);
  moonHalo.visible = false;
  scene.add(moonHalo);

  const starsGeometry = new THREE.BufferGeometry();
  const stars = [];

  for (let i = 0; i < 360; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(
      THREE.MathUtils.lerp(0.08, 1, Math.random())
    );
    const radius = 520;

    stars.push(
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.cos(phi) * radius,
      Math.sin(phi) * Math.sin(theta) * radius
    );
  }

  starsGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(stars, 3)
  );

  const starField = new THREE.Points(
    starsGeometry,
    new THREE.PointsMaterial({
      color: 0xd9e7ff,
      size: 1.15,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );
  scene.add(starField);

  function update({
    delta,
    topColor,
    horizonColor,
    lowColor,
    sun,
    celestial
  }) {
    const blend = 1 - Math.pow(0.02, delta);

    material.uniforms.topColor.value.lerp(topColor, blend);
    material.uniforms.horizonColor.value.lerp(horizonColor, blend);
    material.uniforms.lowColor.value.lerp(lowColor, blend);

    const radius = 310;

    const sunAltitude =
      celestial?.sun?.altitude ??
      sun.elevation;

    const sunAzimuth =
      celestial?.sun?.azimuth ??
      sun.azimuth;

    const sunHorizontal =
      Math.cos(sunAltitude);

    sunDisc.position.set(
      -Math.sin(sunAzimuth) * sunHorizontal * radius,
      Math.sin(sunAltitude) * radius,
      Math.cos(sunAzimuth) * sunHorizontal * radius
    );

    sunDisc.visible =
      sunDisc.position.y > -14;

    sunDisc.material.opacity =
      THREE.MathUtils.lerp(
        sunDisc.material.opacity,
        sun.dawn || sun.dusk ? 0.92 : 0.74,
        blend
      );

    sunDisc.scale.setScalar(
      sun.dawn || sun.dusk ? 1.16 : 1
    );

    if (celestial?.moon) {
      const moonAltitude = celestial.moon.altitude;
      const moonAzimuth = celestial.moon.azimuth;
      const moonHorizontal = Math.cos(moonAltitude);

      moon.position.set(
        -Math.sin(moonAzimuth) *
          moonHorizontal *
          radius,
        Math.sin(moonAltitude) * radius,
        Math.cos(moonAzimuth) *
          moonHorizontal *
          radius
      );

      moon.visible =
        moon.position.y > -8 &&
        (sun.night || sun.daylight < 0.45);

      moonHalo.position.copy(moon.position);
      moonHalo.visible = moon.visible;

      const moonVisibility =
        THREE.MathUtils.clamp(
          celestial.moon.fraction *
          (0.35 + (sun.nightFactor ?? 0) * 0.65),
          0,
          1
        );

      moonHalo.material.opacity =
        THREE.MathUtils.lerp(
          moonHalo.material.opacity,
          moonVisibility * 0.52,
          blend
        );

      moonHalo.scale.setScalar(
        26 + moonVisibility * 18
      );

      moon.material.uniforms.phase.value =
        celestial.moon.phase;

      moon.material.uniforms.brightness.value =
        THREE.MathUtils.lerp(
          moon.material.uniforms.brightness.value,
          sun.night ? 1.05 : 0.52,
          blend
        );
    }

    starField.material.opacity =
      THREE.MathUtils.lerp(
        starField.material.opacity,
        sun.night ? 0.64 : 0,
        blend
      );
  }

  return {
    sky,
    sunDisc,
    moon,
    moonHalo,
    starField,
    update
  };
}
