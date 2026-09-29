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

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

function buildQuery() {
  return `
[out:json][timeout:25];
(
  way["building"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["highway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;
`;
}

async function fetchEndpoint(endpoint, query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json'
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${endpoint} returned ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.elements) || data.elements.length < 20) {
      throw new Error(`${endpoint} returned insufficient OSM data`);
    }

    return {
      ...data,
      source: endpoint
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadOsm() {
  const query = buildQuery();
  const errors = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      return await fetchEndpoint(endpoint, query);
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  throw new Error(
    'All Overpass endpoints failed: ' + errors.join(' | ')
  );
}
