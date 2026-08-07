// Parseo de la respuesta de OpenStreetMap a features locales en metros.
//
// Vive en el núcleo y no en la capa de datos porque es una función pura de la que
// depende el mundo entero: con ella dentro se puede afirmar sobre datos congelados
// que la generación no cambia si los elementos llegan en otro orden. El transporte
// (construir la consulta y pedirla) se queda fuera, en app/js/data/overpass.js.
//
// Es también la frontera donde se decide QUÉ del mundo real entra en el juego,
// incluido el filtro de aptitud para menores: los locales de adultos no tienen
// regla que los reconozca y por tanto se descartan aquí.

import { makeProjector } from '../core/geo.js';

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
      // primeros. Va como campo de un objeto y no colgado del array de puntos, porque
      // una propiedad pegada a un array no sobrevive a JSON.stringify y desaparecía en
      // silencio en cuanto el mundo se serializa.
      out.rivers.push({ pts, kind: t.waterway });
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
    // El identificador de OSM viaja con el anclaje (`tipo/id`, que es lo único
    // único de verdad en OSM: un node y un way pueden compartir número). No lo usa
    // la generación: existe para poder afirmar desde fuera que ningún lugar real
    // alimenta dos elementos de fantasía, que es la regla de anclaje único.
    anchors.push({
      ...proj.toXY(lat, lon),
      osmId: el.type && el.id != null ? `${el.type}/${el.id}` : null,
      name: t.name || null,
      kind: def.kind,
      cat: def.cat,
      weight: def.weight,
    });
  }
  return anchors;
}
