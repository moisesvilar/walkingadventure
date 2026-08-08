// Parseo de la respuesta de OpenStreetMap a features locales en metros.
//
// Vive en el núcleo y no en la capa de datos porque es una función pura de la que
// depende el mundo entero: con ella dentro se puede afirmar sobre datos congelados
// que la generación no cambia si los elementos llegan en otro orden. El transporte
// (construir la consulta y pedirla) se queda fuera, en app/js/data/overpass.js.
//
// Es también donde se ordena: cada colección sale ordenada por la clave estable
// del elemento de OSM del que nace, y ninguna fase posterior la reordena para
// poder decidir. Sin esto, el orden en que Overpass devuelve los elementos entraba
// en la generación como un dato encubierto y el mundo cambiaba con él.
//
// Es también la frontera donde se decide QUÉ del mundo real entra en el juego,
// incluido el filtro de aptitud para menores: los locales de adultos no tienen
// regla que los reconozca y por tanto se descartan aquí.

import { makeProjector } from '../core/geo.js';

function wayToPoints(el, proj) {
  if (!el.geometry) return null;
  return el.geometry.map((g) => proj.toXY(g.lat, g.lon));
}

// Orden canónico de OSM. Se compara el tipo por este rango y no alfabéticamente
// porque es el orden en que OSM y Overpass enumeran el mundo; alfabético metería
// las relaciones entre los nodos y los ways sin que nadie lo espere al leer.
const RANGO_TIPO = { node: 0, way: 1, relation: 2 };

/**
 * Clave estable de un elemento de OSM: `tipo/id`, la misma forma que ya viaja con
 * los anclajes y lo único único de verdad en OSM, porque un node y un way pueden
 * compartir número.
 *
 * Los elementos sin identificador utilizable —OSM no lo garantiza y una respuesta
 * recortada puede traerlos— caen a una clave derivada de su geometría proyectada
 * y redondeada al metro. La regla es la misma en las tres funciones de parseo a
 * propósito: dos ejecuciones sobre los mismos datos le asignan la misma clave.
 */
export function claveOsm(el, pts) {
  if (el.type && el.id != null) return `${el.type}/${el.id}`;
  return `geom/${(pts ?? []).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(';')}`;
}

/**
 * Orden total sobre las claves de OSM: primero el tipo por el orden canónico,
 * después el identificador como número.
 *
 * Comparar `tipo/id` como texto pondría `way/1000` antes que `way/99`, que no es
 * un orden que nadie pueda predecir leyendo los datos. Las claves derivadas de la
 * geometría van al final y se comparan como texto: no tienen número que comparar.
 */
export function comparaClaveOsm(a, b) {
  const ca = a ?? '', cb = b ?? '';
  const ra = RANGO_TIPO[ca.slice(0, ca.indexOf('/'))] ?? 3;
  const rb = RANGO_TIPO[cb.slice(0, cb.indexOf('/'))] ?? 3;
  if (ra !== rb) return ra - rb;
  if (ra !== 3) {
    const na = Number(ca.slice(ca.indexOf('/') + 1));
    const nb = Number(cb.slice(cb.indexOf('/') + 1));
    if (na !== nb) return na - nb;
  }
  return ca < cb ? -1 : ca > cb ? 1 : 0;
}

// Ordena en el sitio una colección de entidades ya parseadas por su clave estable.
// Se hace aquí, en el borde del núcleo, y no en cada fase: el orden de llegada de
// Overpass no puede entrar en la generación como un dato encubierto, y repartir la
// ordenación por las fases garantiza que la próxima fase que se añada se olvide.
function ordenaPorClave(lista) {
  return lista.sort((a, b) => comparaClaveOsm(a.osmId, b.osmId));
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
      const p = proj.toXY(el.lat, el.lon);
      out.peaks.push({ ...p, ele: parseFloat(t.ele) || 0, name: t.name, osmId: claveOsm(el, [p]) });
      continue;
    }
    if (el.type !== 'way') continue;
    const pts = wayToPoints(el, proj);
    if (!pts || pts.length < 2) continue;
    const osmId = claveOsm(el, pts);
    // Costa, lagos y bosques viajan como objeto y no como array de puntos pelado:
    // una propiedad colgada de un array no sobrevive a JSON.stringify y el
    // identificador desaparecería en silencio en cuanto el mundo se serializa. Es
    // el mismo motivo por el que los ríos ya eran objetos.
    if (t.natural === 'coastline') out.coastlines.push({ pts, osmId });
    else if (t.natural === 'water') out.lakes.push({ pts, osmId });
    else if (t.waterway) {
      // el tipo se conserva para poder pintar solo los principales: OSM llama `river`
      // al cauce con nombre y `stream` al regato, y en el mapa base solo interesan los
      // primeros. Va como campo de un objeto y no colgado del array de puntos, porque
      // una propiedad pegada a un array no sobrevive a JSON.stringify y desaparecía en
      // silencio en cuanto el mundo se serializa.
      out.rivers.push({ pts, kind: t.waterway, osmId });
    }
    else if ((t.landuse === 'forest' || t.natural === 'wood') && isClosed(el)) out.forests.push({ pts, osmId });
    else if (t.highway) {
      // nodes: ids OSM reales; son la clave de intersección del grafo viario
      // (routes.js). Solo sirven si vienen alineados 1:1 con la geometría.
      out.roads.push({
        pts,
        nodes: el.nodes && el.nodes.length === pts.length ? el.nodes : null,
        level: MAJOR_HIGHWAYS.includes(t.highway) ? 'principal' : 'pista',
        name: t.name || null,
        osmId,
      });
    }
  }
  for (const coleccion of Object.values(out)) ordenaPorClave(coleccion);
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
    out.push({ pts, level: STREET_KINDS.includes(t.highway) ? 'calle' : 'senda', osmId: claveOsm(el, pts) });
  }
  return ordenaPorClave(out);
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
    // El identificador de OSM viaja con el anclaje. Sirve para dos cosas: afirmar
    // desde fuera que ningún lugar real alimenta dos elementos de fantasía —la
    // regla de anclaje único— y ordenar esta lista, que es lo que impide que el
    // orden de llegada de Overpass decida qué anclaje se lleva cada núcleo.
    const p = proj.toXY(lat, lon);
    anchors.push({
      ...p,
      osmId: claveOsm(el, [p]),
      name: t.name || null,
      kind: def.kind,
      cat: def.cat,
      weight: def.weight,
    });
  }
  return ordenaPorClave(anchors);
}
