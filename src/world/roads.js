import * as THREE from 'three';
import { project } from './osm.js';

function roadWidth(tags) {
  const type = tags?.highway;

  if (['primary', 'secondary'].includes(type)) return 2.8;
  if (['tertiary', 'residential'].includes(type)) return 2.1;
  if (['service', 'living_street'].includes(type)) return 1.5;

  return 1.1;
}

export function createRoads(elements, heightAt) {
  const group = new THREE.Group();
  group.name = 'osm-roads';

  const asphalt = new THREE.MeshBasicMaterial({
    color: 0x454b4f,
    side: THREE.DoubleSide
  });

  const lampPositions = [];

  for (const element of elements) {
    if (!element.tags?.highway || !element.geometry?.length) continue;
    if (element.geometry.length < 2) continue;

    const points = element.geometry.map((point) => {
      const p = project(point.lat, point.lon);
      return new THREE.Vector3(
        p.x,
        heightAt(p.x, p.z) + 0.08,
        p.z
      );
    });

    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const geometry = new THREE.TubeGeometry(
      curve,
      Math.max(8, points.length * 3),
      roadWidth(element.tags),
      5,
      false
    );

    const road = new THREE.Mesh(geometry, asphalt);
    road.scale.y = 0.05;
    road.receiveShadow = true;
    group.add(road);

    const major =
      ['primary', 'secondary', 'tertiary', 'residential']
        .includes(element.tags.highway);

    if (major) {
      const samples = Math.max(
        2,
        Math.floor(curve.getLength() / 14)
      );

      for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;
        const p = curve.getPointAt(t);

        lampPositions.push(
          p.x,
          p.y + 2.8,
          p.z
        );
      }
    }
  }

  const lampGeometry = new THREE.BufferGeometry();
  lampGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(lampPositions, 3)
  );

  const lampMaterial = new THREE.PointsMaterial({
    color: 0xffd58b,
    size: 1.25,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const lamps = new THREE.Points(
    lampGeometry,
    lampMaterial
  );

  lamps.renderOrder = 25;
  group.add(lamps);

  group.userData.nightLampMaterial = lampMaterial;
  return group;
}
