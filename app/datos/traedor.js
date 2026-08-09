// El traedor de datos de OSM: la frontera por la que el mundo real entra en el
// móvil. Recibe una celda —sus límites y el margen de borde que la costura necesita—
// y devuelve los tres bloques ya repartidos con la forma que el núcleo consume.
//
// Es la entrada que `generaCelda` pide inyectada (`consultaOsm`), así que doblarla
// es pasar otro argumento: los cuatro extractos congelados de `test/fixtures/osm/`
// entran por aquí igual que entra el Overpass del proyecto. Detrás está la ruta de
// generación del proxy, y este módulo no decide si responde el Overpass propio o un
// mirror: eso es de la fila 24 y se resuelve aguas arriba.
//
// **Sin cliente no se construye.** Un traedor que se monta a medias y falla al
// primer mapa es la forma de fallo que este repositorio ya ha pagado cinco veces
// (§6h): la pieza que, al no estar, no protesta.

import { celdaDeLimites, consultaDeCelda, reparteRespuesta } from './consulta-osm.js';

/**
 * Monta el traedor.
 *
 * @param {object} deps
 * @param {{pideGeneracion: (consulta: {ql: string}) => Promise<{elements: object[], deCache?: boolean}>}} deps.cliente
 * @param {(suceso: object) => void} [deps.observa]  se le cuenta cada consulta: qué
 *   celda, qué radio, cuántos elementos y si vino de caché. Es lo que permite
 *   afirmar «esto no ha pedido nada a OSM» sin instrumentar la red.
 * @returns {(peticion: {celda: object, limites: object, margenM: number}) => Promise<object>}
 *   la función `consultaOsm` que `generaCelda` espera, con los tres bloques y
 *   `deCache`: `true` servida de caché, `false` pedida aguas arriba, `null` no dicho.
 */
export function creaTraedorDeOsm({ cliente, observa = null }) {
  if (!cliente || typeof cliente.pideGeneracion !== 'function') {
    throw new Error(
      'el traedor de datos de OSM se construye con el cliente del proxy y no arranca sin él: ' +
      'es quien convierte una celda en la consulta que trae el terreno, los anclajes y el callejero',
    );
  }
  if (observa !== null && typeof observa !== 'function') {
    throw new Error('el observador del traedor, si se pasa, es una función: observa(suceso)');
  }

  return async function consultaOsm({ celda, limites, margenM }) {
    if (!limites) throw new Error('consultaOsm necesita los límites de la celda que se está generando');
    const parametros = celdaDeLimites(limites, margenM);
    const ql = consultaDeCelda(parametros);
    const { elements, deCache } = await cliente.pideGeneracion({ ql });
    const bloques = reparteRespuesta({ elements });
    // Si la respuesta vino de la caché del proxy viaja **con los bloques**, y no solo
    // al observador: es lo que permite que la medida del minuto diga si la caché
    // estaba fría, que es lo único que hace comparable un número con otro. Y si el
    // cliente no lo dice, aquí se declara desconocido en vez de darlo por falso.
    const vinoDeCache = typeof deCache === 'boolean' ? deCache : null;
    if (observa) {
      observa({
        celda: celda ? { i: celda.i, j: celda.j } : null,
        radioM: parametros.radio_m,
        elementos: elements.length,
        deCache: vinoDeCache,
        terreno: bloques.geoJson.elements.length,
        anclajes: bloques.poiJson.elements.length,
        callejero: bloques.callejeroJson.elements.length,
      });
    }
    return { ...bloques, deCache: vinoDeCache };
  };
}
