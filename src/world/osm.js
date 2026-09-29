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

const CACHE_DB = 'odesa-sky-defense';
const CACHE_STORE = 'osm';
const CACHE_KEY = 'historic-centre-v1';
const SNAPSHOT_URL = './data/odesa-osm.json';

export function project(lat, lon) {
  return {
    x: (lon - CENTER.lon) * METERS_PER_LON * SCALE,
    z: -(lat - CENTER.lat) * METERS_PER_LAT * SCALE
  };
}

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

function buildQuery() {
  return `
[out:json][timeout:60];
(
  way["building"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["highway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;
`;
}

function valid(data) {
  return Array.isArray(data?.elements) && data.elements.length > 100;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCache() {
  try {
    const db = await openDb();

    return await new Promise((resolve) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const request = tx.objectStore(CACHE_STORE).get(CACHE_KEY);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeCache(data) {
  try {
    const db = await openDb();

    await new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put(
        {
          savedAt: Date.now(),
          data
        },
        CACHE_KEY
      );

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('OSM cache write failed', error);
  }
}

async function readSnapshot() {
  try {
    const response = await fetch(SNAPSHOT_URL, {
      cache: 'no-cache'
    });

    if (!response.ok) return null;

    const data = await response.json();
    return valid(data) ? data : null;
  } catch {
    return null;
  }
}

async function fetchEndpoint(endpoint, query) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    25000
  );

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
      throw new Error(
        `${endpoint} returned ${response.status}`
      );
    }

    const data = await response.json();

    if (!valid(data)) {
      throw new Error(
        `${endpoint} returned insufficient OSM data`
      );
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
  const snapshot = await readSnapshot();

  if (snapshot) {
    return {
      ...snapshot,
      source: 'bundled-snapshot'
    };
  }

  const cached = await readCache();

  if (valid(cached?.data)) {
    return {
      ...cached.data,
      source: 'indexeddb-cache'
    };
  }

  const query = buildQuery();
  const errors = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const data = await fetchEndpoint(endpoint, query);
      writeCache(data);
      return data;
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  throw new Error(
    'All Overpass endpoints failed: ' +
    errors.join(' | ')
  );
}
