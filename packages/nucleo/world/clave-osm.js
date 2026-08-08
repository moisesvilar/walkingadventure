// La clave estable de un elemento de OpenStreetMap y su orden total.
//
// Vive suelta y no dentro de `osm.js` porque la necesitan tanto el parseo como el
// pool de anclajes, y `osm.js` consume el pool: dejarla allí obligaría a un ciclo
// de imports entre los dos módulos.

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

/**
 * Ordena en el sitio una colección de entidades ya parseadas por su clave estable.
 *
 * Se hace en el borde del núcleo y no en cada fase: el orden de llegada de
 * Overpass no puede entrar en la generación como un dato encubierto, y repartir la
 * ordenación por las fases garantiza que la próxima fase que se añada se olvide.
 */
export function ordenaPorClave(lista) {
  return lista.sort((a, b) => comparaClaveOsm(a.osmId, b.osmId));
}
