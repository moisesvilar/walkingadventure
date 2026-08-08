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
// Qué del mundo real entra en el juego —el catálogo de admisión, el filtro de
// tipos problemáticos y los topes— ya no está aquí: es el pool de `anclajes.js`,
// y este módulo solo le sirve de puerta para los POIs.

import { makeProjector } from '../core/geo.js';
import { claveOsm, ordenaPorClave } from './clave-osm.js';
import { construyePool } from './anclajes.js';

export { claveOsm, comparaClaveOsm } from './clave-osm.js';

function wayToPoints(el, proj) {
  if (!el.geometry) return null;
  return el.geometry.map((g) => proj.toXY(g.lat, g.lon));
}

function isClosed(el) {
  const g = el.geometry;
  return g && g.length > 3 && g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;
}

const MAJOR_HIGHWAYS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];

// Superficies que se leen como camino de tierra. Sesgan el nombre de un ramal, no
// deciden nada más: es un rasgo de la senda, no una clasificación del viario.
const SUPERFICIES_DE_TIERRA = ['ground', 'dirt', 'earth', 'unpaved', 'gravel', 'compacted', 'fine_gravel'];

/**
 * El nivel de una vía. Lo usa el cosido del grafo para no unir un puente con la
 * carretera que pasa por debajo: en planta sus nodos están a pocos metros, y
 * coserlos inventa un enlace que no existe. Sin el tag, mismo nivel.
 */
function nivelDeVia(t) {
  const n = parseInt(t.layer, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * El rasgo de una vía —`'escalones'`, `'tierra'`, `'estrecho'`— o nulo. Sesga el
 * nombre del ramal que la recorra. Los tags que lo alimentan no se piden todavía en
 * la consulta de callejero, así que hoy llega nulo casi siempre y el nombre sale
 * igual sin él.
 */
function rasgoDeVia(t) {
  if (t.highway === 'steps') return 'escalones';
  if (t.surface && SUPERFICIES_DE_TIERRA.includes(t.surface)) return 'tierra';
  if (t.highway === 'path' || t.width === '1' || t.highway === 'footway') return 'estrecho';
  return null;
}

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
      // (grafo.js). Solo sirven si vienen alineados 1:1 con la geometría.
      out.roads.push({
        pts,
        nodes: el.nodes && el.nodes.length === pts.length ? el.nodes : null,
        level: MAJOR_HIGHWAYS.includes(t.highway) ? 'principal' : 'pista',
        layer: nivelDeVia(t),
        rasgo: rasgoDeVia(t),
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

/**
 * El callejero. Además de pintarse, **alimenta el grafo viario**: es donde están
 * los huecos cortos que hay que coser antes de trazar, así que sale con los mismos
 * campos que las carreteras de `parseGeo` —ids de nodo, nivel y rasgo— y no solo
 * con su geometría.
 */
export function parseStreets(json, lat0, lon0) {
  const proj = makeProjector(lat0, lon0);
  const out = [];
  for (const el of json.elements || []) {
    if (el.type !== 'way') continue;
    const pts = wayToPoints(el, proj);
    if (!pts || pts.length < 2) continue;
    const t = el.tags || {};
    out.push({
      pts,
      nodes: el.nodes && el.nodes.length === pts.length ? el.nodes : null,
      level: STREET_KINDS.includes(t.highway) ? 'calle' : 'senda',
      layer: nivelDeVia(t),
      rasgo: rasgoDeVia(t),
      name: t.name || null,
      osmId: claveOsm(el, pts),
    });
  }
  return ordenaPorClave(out);
}

/**
 * Los anclajes admitidos de una respuesta de POIs: el pool de `anclajes.js` sin su
 * registro de uso único.
 *
 * Se conserva aquí, con la firma de siempre, porque es la puerta por la que la app
 * y las pruebas piden los anclajes; quien genera un mundo entero usa
 * `construyePool` directamente, que además le devuelve el registro.
 */
export function parsePois(json, lat0, lon0, opciones = {}) {
  return construyePool({ ...opciones, poiJson: json, lat0, lon0 }).anclajes;
}
