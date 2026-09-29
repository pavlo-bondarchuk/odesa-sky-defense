import * as THREE from 'three';

export function createCoast({
  heightAt,
  coastX,
  seaLevel
}) {
  const group = new THREE.Group();
  group.name = 'coast-port';

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 1200, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x285d6a,
      roughness: 0.28,
      metalness: 0.08,
      transparent: true,
      opacity: 0.93
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(390, seaLevel, 0);
  sea.receiveShadow = true;
  group.add(sea);

  const portMaterial = new THREE.MeshStandardMaterial({
    color: 0x6a655d,
    roughness: 0.92
  });

  const pierMaterial = new THREE.MeshStandardMaterial({
    color: 0x766858,
    roughness: 0.9
  });

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x4d5355,
    roughness: 0.95
  });

  for (let i = 0; i < 9; i += 1) {
    const z = -220 + i * 55;
    const coast = coastX(z);

    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(34, 0.7, 42),
      portMaterial
    );

    apron.position.set(
      coast + 1,
      heightAt(coast, z) + 0.28,
      z
    );

    apron.receiveShadow = true;
    apron.castShadow = true;
    group.add(apron);

    const length = 72 + (i % 4) * 18;

    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.8, 8),
      pierMaterial
    );

    pier.position.set(
      coast + 22 + length * 0.5,
      seaLevel + 0.3,
      z + (i % 2 ? 9 : -7)
    );

    pier.castShadow = true;
    pier.receiveShadow = true;
    group.add(pier);

    const seawall = new THREE.Mesh(
      new THREE.BoxGeometry(4, 3.5, 44),
      edgeMaterial
    );

    seawall.position.set(
      coast + 18,
      seaLevel + 1.2,
      z
    );

    group.add(seawall);
  }

  const breakwater = new THREE.Mesh(
    new THREE.BoxGeometry(190, 1.8, 9),
    edgeMaterial
  );
  breakwater.position.set(
    245,
    seaLevel + 0.55,
    165
  );
  breakwater.rotation.y = -0.18;
  group.add(breakwater);

  const innerBreakwater = breakwater.clone();
  innerBreakwater.scale.x = 0.72;
  innerBreakwater.position.set(
    215,
    seaLevel + 0.55,
    -155
  );
  innerBreakwater.rotation.y = 0.16;
  group.add(innerBreakwater);

  const quayLights = new THREE.Group();
  const lightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd69a,
    transparent: true,
    opacity: 0
  });

  const glowPositions = [];

  for (let i = 0; i < 22; i += 1) {
    const z = -250 + i * 24;
    const x = coastX(z) + 10;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.15, 3.4, 6),
      new THREE.MeshStandardMaterial({
        color: 0x3b4245,
        roughness: 0.9
      })
    );

    post.position.set(
      x,
      heightAt(x, z) + 1.7,
      z
    );

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      lightMaterial
    );

    lamp.position.set(
      x,
      heightAt(x, z) + 3.5,
      z
    );

    quayLights.add(post, lamp);

    glowPositions.push(
      x,
      heightAt(x, z) + 3.5,
      z
    );
  }

  group.add(quayLights);

  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      glowPositions,
      3
    )
  );

  const glowMaterial = new THREE.PointsMaterial({
    color: 0xffc76b,
    size: 2.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const portGlow = new THREE.Points(
    glowGeometry,
    glowMaterial
  );

  portGlow.renderOrder = 30;
  group.add(portGlow);

  const industrialGlowMaterial = new THREE.PointsMaterial({
    color: 0xcfe7ff,
    size: 5.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const industrialGlow = new THREE.Points(
    glowGeometry.clone(),
    industrialGlowMaterial
  );

  industrialGlow.renderOrder = 29;
  group.add(industrialGlow);

  const seaMaterial = sea.material;
  const baseSeaColor = new THREE.Color(0x285d6a);
  const nightSeaColor = new THREE.Color(0x102b38);

  function updateNight(factor) {
    const night = THREE.MathUtils.clamp(
      factor,
      0,
      1
    );

    lightMaterial.opacity =
      THREE.MathUtils.clamp(
        (night - 0.08) / 0.76,
        0,
        1
      );

    glowMaterial.opacity =
      THREE.MathUtils.clamp(
        (night - 0.04) / 0.62,
        0,
        1
      );

    industrialGlowMaterial.opacity =
      THREE.MathUtils.clamp(
        (night - 0.12) / 0.7,
        0,
        0.28
      );

    seaMaterial.color.copy(
      baseSeaColor.clone().lerp(
        nightSeaColor,
        night * 0.72
      )
    );

    seaMaterial.emissive = new THREE.Color(
      0x102432
    );

    seaMaterial.emissiveIntensity =
      night * 0.08;
  }

  return {
    group,
    sea,
    quayLights,
    portGlow,
    industrialGlow,
    updateNight
  };
}
