const BBOX = {
  south: 46.470,
  west: 30.718,
  north: 46.491,
  east: 30.750
};

const CENTER = {
  lat: (BBOX.south + BBOX.north) * 0.5,
  lon: (BBOX.west + BBOX.east) * 0.5
};

const SCALE = 0.11;
const METERS_PER_LAT = 111320;
const METERS_PER_LON =
  Math.cos(CENTER.lat * Math.PI / 180) * 111320;

export function project(lat, lon) {
  return {
    x: (lon - CENTER.lon) * METERS_PER_LON * SCALE,
    z: -(lat - CENTER.lat) * METERS_PER_LAT * SCALE
  };
}

function overpassUrl() {
  const query = `
[out:json][timeout:40];
(
  way["building"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["highway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;
`;

  return 'https://overpass-api.de/api/interpreter?data=' +
    encodeURIComponent(query);
}

export async function loadOsm() {
  const response = await fetch(overpassUrl(), {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`OSM request failed: ${response.status}`);
  }

  return response.json();
}
