// Consulta Overpass (OpenStreetMap) y parseo a features locales en metros.
//
// Única capa que habla con el exterior. El resto del generador solo ve features
// ya proyectadas a metros respecto al origen del mundo, así que es también la
// frontera donde se decide QUÉ del mundo real entra en el juego (incluido el
// filtro de aptitud para menores: nada de bares de copas ni locales de adultos).

import { makeProjector } from '../core/geo.js';

// El proxy local (server.mjs) cachea en disco para siempre y añade el
// User-Agent que exigen los mirrors; los públicos son el plan B si no está.
// En Node no vale la ruta relativa: las herramientas headless inyectan la URL
// absoluta en globalThis.__WA_PROXY__ (ver test/casting-report.mjs).
const MIRRORS = [
  globalThis.__WA_PROXY__ ?? '/api/overpass',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const IS_BROWSER = typeof window !== 'undefined';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runQuery(ql) {
  let lastErr;
  for (let round = 0; round < 3; round++) {
    if (round > 0) await sleep(4000 * round); // backoff entre rondas
    for (const url of MIRRORS) {
      try {
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        // Etiqueta OSM: sin User-Agent válido algunos mirrors responden 406. En
        // navegador es cabecera prohibida (se ignora), así que solo en Node.
        if (!IS_BROWSER) headers['User-Agent'] = 'walking-adventure-prototype/0.1 (dev local)';
        const res = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(ql),
          headers,
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

// --- consultas ---

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
  way["waterway"~"^(river|stream|canal)$"]${a};
  way["landuse"="forest"]${a};
  way["natural"="wood"]${a};
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|track)$"]${a};
  node["natural"="peak"]${a};
);
out geom 8000;`;
  return runQuery(ql);
}

// Anclajes reales. v0.1 amplía la consulta de v0.0.1 con manantiales, fuentes,
// torres, faros, cruceiros y monasterios: más anclajes libres para los parajes
// y material para el sesgo suave de tipo (game-design/parajes.md).
// Los locales se restringen a los aptos para menores (principio de la spec).
//
// Excluido a propósito `amenity=drinking_water`, que parajes.md sí lista para el
// tipo Fuente: medido sobre los 4 mundos de referencia, es mobiliario urbano sin
// nombre (A Coruña 186 anclajes, 3 con nombre; Toledo 16, ninguno). No aporta
// reconocimiento —el sentido del anclaje es el guiño de identificar el lugar
// real— y su volumen monopoliza el sesgo `fuente`, matando la diversidad de
// tipos que pide el propio documento ("mejor uno de cada que cinco fuentes"):
// con él dentro, Toledo y A Coruña se quedaban sin ningún paraje de vigilancia
// o revelación. `amenity=fountain` y `natural=spring` sí entran: son hitos con
// nombre.
export async function fetchPois(lat, lon, radius) {
  const a = `(around:${radius},${lat},${lon})`;
  const ql = `
[out:json][timeout:90];
(
  nwr["amenity"="place_of_worship"]${a};
  nwr["amenity"="monastery"]${a};
  nwr["historic"~"^(monument|memorial|castle|ruins|city_gate|archaeological_site|wayside_cross|wayside_shrine|monastery)$"]${a};
  nwr["tourism"="viewpoint"]${a};
  nwr["man_made"~"^(tower|lighthouse)$"]${a};
  nwr["natural"="spring"]${a};
  nwr["amenity"="fountain"]${a};
  nwr["leisure"="park"]${a};
  nwr["shop"="mall"]${a};
  nwr["amenity"~"^(cafe|restaurant|ice_cream|fast_food|library)$"]${a};
);
out center 6000;`;
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
    else if (t.waterway) {
      // el tipo se conserva para poder pintar solo los principales: OSM llama `river`
      // al cauce con nombre y `stream` al regato, y en el mapa base solo interesan los
      // primeros. El array sigue siendo de puntos para quien solo necesita la geometría.
      pts.kind = t.waterway;
      out.rivers.push(pts);
    }
    else if ((t.landuse === 'forest' || t.natural === 'wood') && isClosed(el)) out.forests.push(pts);
    else if (t.highway) {
      // nodes: ids OSM reales; son la clave de intersección del grafo viario
      // (routes.js). Solo sirven si vienen alineados 1:1 con la geometría.
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

// Categorías de POI. Tres campos, tres usos distintos:
//   kind   — etiqueta del lugar real ("📍 Restos del Acueducto Romano (ruinas)")
//            y clave del sesgo suave de tipo de paraje (BIAS en parajes.js).
//   cat    — 'emplazamiento' | 'local': las aldeas prefieren emplazamientos y
//            las granjas locales (settlements.js).
//   weight — peso en el clúster que decide dónde nacen ciudades y pueblos.
// El orden importa: gana la primera regla que hace match.
// Nota de dimensionado: fuentes y manantiales entran con peso bajo a propósito.
// Son anclaje de paraje, no motivo para fundar una ciudad, y en casco urbano hay
// tantas que con peso alto desplazarían el clúster de la ciudad hacia ellas.
const POI_KINDS = [
  { match: (t) => t.shop === 'mall', kind: 'centro comercial', cat: 'local', weight: 5 },
  { match: (t) => t.historic === 'castle', kind: 'castillo', cat: 'emplazamiento', weight: 5 },
  { match: (t) => t.amenity === 'monastery' || t.historic === 'monastery', kind: 'monasterio', cat: 'emplazamiento', weight: 5 },
  { match: (t) => ['ruins', 'city_gate'].includes(t.historic), kind: 'ruinas', cat: 'emplazamiento', weight: 4 },
  { match: (t) => t.historic === 'archaeological_site', kind: 'piedra antigua', cat: 'emplazamiento', weight: 4 },
  { match: (t) => t.leisure === 'park', kind: 'parque', cat: 'emplazamiento', weight: 4 },
  { match: (t) => ['monument', 'memorial'].includes(t.historic), kind: 'monumento', cat: 'emplazamiento', weight: 4 },
  { match: (t) => t.man_made === 'lighthouse', kind: 'faro', cat: 'emplazamiento', weight: 3 },
  { match: (t) => t.amenity === 'place_of_worship', kind: 'iglesia', cat: 'emplazamiento', weight: 3 },
  { match: (t) => t.tourism === 'viewpoint', kind: 'mirador', cat: 'emplazamiento', weight: 3 },
  { match: (t) => ['wayside_cross', 'wayside_shrine'].includes(t.historic), kind: 'crucero', cat: 'emplazamiento', weight: 2 },
  { match: (t) => t.man_made === 'tower', kind: 'torre', cat: 'emplazamiento', weight: 2 },
  { match: (t) => t.natural === 'spring', kind: 'manantial', cat: 'emplazamiento', weight: 2 },
  { match: (t) => t.amenity === 'library', kind: 'biblioteca', cat: 'local', weight: 2 },
  { match: (t) => ['fountain', 'drinking_water'].includes(t.amenity), kind: 'fuente', cat: 'emplazamiento', weight: 1 },
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
