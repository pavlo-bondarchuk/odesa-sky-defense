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
  }

  return group;
}
