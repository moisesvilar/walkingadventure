// Consulta Overpass (OpenStreetMap) y parseo a features locales en metros.

import { makeProjector } from './geo.js';

const MIRRORS = [
  '/api/overpass', // proxy local con caché en disco (server.mjs); cae a los públicos si no está
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runQuery(ql) {
  let lastErr;
  for (let round = 0; round < 3; round++) {
    if (round > 0) await sleep(4000 * round); // backoff entre rondas
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(ql),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: AbortSignal.timeout(45000), // Overpass puede encolar sin responder
        });
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr;
}

export async function fetchGeoFeatures(lat, lon, radius) {
  const a = `(around:${radius},${lat},${lon})`;
  // La costa va en su propio out SIN límite: si se trunca, la máscara
  // tierra/mar queda con huecos y clasifica mal. El resto (bosques sobre todo)
  // sí se limita.
  const ql = `
[out:json][timeout:90];
way["natural"="coastline"]${a};
out geom;
(
  way["natural"="water"]${a};
  way["waterway"~"^(river|canal)$"]${a};
  way["landuse"="forest"]${a};
  way["natural"="wood"]${a};
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|track)$"]${a};
  node["natural"="peak"]${a};
);
out geom 8000;`;
  return runQuery(ql);
}

// Callejero local de un núcleo (se pide bajo demanda al hacer zoom).
export async function fetchStreets(lat, lon, radius) {
  const a = `(around:${radius},${lat},${lon})`;
  const ql = `
[out:json][timeout:60];
way["highway"~"^(residential|living_street|pedestrian|service|unclassified|track|path|footway|cycleway|steps)$"]${a};
out geom 3000;`;
  return runQuery(ql);
}

export async function fetchPois(lat, lon, radius) {
  const a = `(around:${radius},${lat},${lon})`;
  const ql = `
[out:json][timeout:90];
(
  nwr["amenity"="place_of_worship"]${a};
  nwr["historic"~"^(monument|memorial|castle|ruins|archaeological_site)$"]${a};
  nwr["tourism"="viewpoint"]${a};
  nwr["leisure"="park"]${a};
  nwr["shop"="mall"]${a};
  nwr["amenity"~"^(cafe|restaurant|ice_cream|fast_food|library)$"]${a};
);
out center 4000;`;
  return runQuery(ql);
}

// --- parseo ---

function wayToPoints(el, proj) {
  if (!el.geometry) return null;
  return el.geometry.map((g) => proj.toXY(g.lat, g.lon));
}

function isClosed(el) {
  const g = el.geometry;
  return g && g.length > 3 && g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;
}

const MAJOR_HIGHWAYS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];

export function parseGeo(json, lat0, lon0) {
  const proj = makeProjector(lat0, lon0);
  const out = { coastlines: [], lakes: [], rivers: [], forests: [], peaks: [], roads: [] };
  for (const el of json.elements || []) {
    const t = el.tags || {};
    if (el.type === 'node' && t.natural === 'peak') {
      out.peaks.push({ ...proj.toXY(el.lat, el.lon), ele: parseFloat(t.ele) || 0, name: t.name });
      continue;
    }
    if (el.type !== 'way') continue;
    const pts = wayToPoints(el, proj);
    if (!pts || pts.length < 2) continue;
    if (t.natural === 'coastline') out.coastlines.push(pts);
    else if (t.natural === 'water') out.lakes.push(pts);
    else if (t.waterway) out.rivers.push(pts);
    else if ((t.landuse === 'forest' || t.natural === 'wood') && isClosed(el)) out.forests.push(pts);
    else if (t.highway) {
      out.roads.push({
        pts,
        nodes: el.nodes && el.nodes.length === pts.length ? el.nodes : null,
        level: MAJOR_HIGHWAYS.includes(t.highway) ? 'principal' : 'pista',
        name: t.name || null,
      });
    }
  }
  return out;
}

// Callejero local → dos niveles visuales: calles y sendas.
const STREET_KINDS = ['residential', 'living_street', 'pedestrian', 'service', 'unclassified'];

export function parseStreets(json, lat0, lon0) {
  const proj = makeProjector(lat0, lon0);
  const out = [];
  for (const el of json.elements || []) {
    if (el.type !== 'way') continue;
    const pts = wayToPoints(el, proj);
    if (!pts || pts.length < 2) continue;
    const t = el.tags || {};
    out.push({ pts, level: STREET_KINDS.includes(t.highway) ? 'calle' : 'senda' });
  }
  return out;
}

// Categorías de POI y peso para decidir dónde nacen los asentamientos.
const POI_KINDS = [
  { match: (t) => t.shop === 'mall', kind: 'centro comercial', cat: 'local', weight: 5 },
  { match: (t) => t.historic === 'castle', kind: 'castillo', cat: 'emplazamiento', weight: 5 },
  { match: (t) => t.leisure === 'park', kind: 'parque', cat: 'emplazamiento', weight: 4 },
  { match: (t) => ['monument', 'memorial', 'ruins', 'archaeological_site'].includes(t.historic), kind: 'monumento', cat: 'emplazamiento', weight: 4 },
  { match: (t) => t.amenity === 'place_of_worship', kind: 'iglesia', cat: 'emplazamiento', weight: 3 },
  { match: (t) => t.tourism === 'viewpoint', kind: 'mirador', cat: 'emplazamiento', weight: 3 },
  { match: (t) => t.amenity === 'library', kind: 'biblioteca', cat: 'local', weight: 2 },
  { match: (t) => t.amenity === 'restaurant', kind: 'restaurante', cat: 'local', weight: 1 },
  { match: (t) => t.amenity === 'cafe', kind: 'cafetería', cat: 'local', weight: 1 },
  { match: (t) => t.amenity === 'ice_cream', kind: 'heladería', cat: 'local', weight: 1 },
  { match: (t) => t.amenity === 'fast_food', kind: 'comida rápida', cat: 'local', weight: 1 },
];

export function parsePois(json, lat0, lon0) {
  const proj = makeProjector(lat0, lon0);
  const anchors = [];
  for (const el of json.elements || []) {
    const t = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const def = POI_KINDS.find((k) => k.match(t));
    if (!def) continue;
    anchors.push({
      ...proj.toXY(lat, lon),
      name: t.name || null,
      kind: def.kind,
      cat: def.cat,
      weight: def.weight,
    });
  }
  return anchors;
}
