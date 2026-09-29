import * as THREE from 'three';
import { loadOsm } from './osm.js';
import { createBuildings } from './buildings.js';
import { createRoads } from './roads.js';

function boxBuilding(x, z, w, d, h, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9
    })
  );

  mesh.position.set(x, h * 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createFallbackCity(heightAt) {
  const group = new THREE.Group();
  group.name = 'fallback-city';

  const roads = [];
  const roadMaterial = new THREE.MeshBasicMaterial({
    color: 0x454b4f
  });

  for (let x = -90; x <= 90; x += 30) {
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.12, 210),
      roadMaterial
    );
    road.position.set(x, heightAt(x, 0) + 0.08, 0);
    group.add(road);
    roads.push(road);
  }

  for (let z = -90; z <= 90; z += 30) {
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(210, 0.12, 4.5),
      roadMaterial
    );
    road.position.set(0, heightAt(0, z) + 0.08, z);
    group.add(road);
    roads.push(road);
  }

  for (let ix = -3; ix <= 2; ix += 1) {
    for (let iz = -3; iz <= 2; iz += 1) {
      const x = ix * 30 + 15;
      const z = iz * 30 + 15;
      const h = 7 + ((ix - iz + 12) % 4) * 2.4;
      const building = boxBuilding(
        x,
        z,
        18,
        18,
        h,
        (ix + iz) % 2 ? 0xc4b39d : 0xb5a28d
      );
      building.position.y = heightAt(x, z) + h * 0.5;
      group.add(building);
    }
  }

  return group;
}

export async function createOsmCity(heightAt) {
  const data = await loadOsm();

  const roads = createRoads(data.elements, heightAt);
  const buildings = createBuildings(data.elements, heightAt);

  const group = new THREE.Group();
  group.name = 'odesa-city';
  group.add(roads, buildings);

  const objectCount =
    roads.children.length +
    buildings.children.length;

  if (objectCount < 20) {
    throw new Error(`OSM city returned too few objects: ${objectCount}`);
  }

  group.userData.objectCount = objectCount;
  return group;
}
