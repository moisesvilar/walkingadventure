// SPEC-012 · Lo que necesitan las pruebas de la propagación de rumores: mundos
// sintéticos con el árbol de calzadas escrito a mano —para poder fijar los metros y
// las marcas de suposición de cada tramo—, los dos mundos reales sobre los que se
// mide con dato de OSM, y los desenlaces con los que nace un rumor.
//
// Vive aquí y no en `test/dobles/` por lo mismo que `partida-de-prueba.mjs`: los
// dobles son de la frontera del núcleo (datos de OSM, GPS, reloj, proxy) y esto es
// andamiaje. Nada de aquí toca la red ni el reloj del sistema: el mundo avanza con
// los pasos que la prueba pide y el azar sale siempre de la semilla.

import { arbolDeCalzadas, creaPropagacionDeRumores, estadoDeRumores } from '../../packages/nucleo/partida/rumores.js';
import { estadoDeNucleos, loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { SUPOSICIONES } from '../../packages/nucleo/world/grafo.js';
import { TEMPLATES } from '../../packages/nucleo/quests/templates.js';
import { SEMILLA_A, SEMILLA_B } from './celda-de-prueba.mjs';
import { celdaDeFixture } from './partida-de-prueba.mjs';

export { SEMILLA_A, SEMILLA_B };

/** El mapa activo de casi todas las pruebas. Los dos mapas conviven en «Dos mapas». */
export const MAPA = 'casa';

/**
 * Los dos mundos reales sobre los que se mide con dato de OSM, y por qué son estos:
 * en `barrio-tres-calles` con tramo de 2 km, la celda del origen trae una calzada
 * **cosida** de 1717 m y la celda `1,-2` cae fuera del extracto, así que todas sus
 * calzadas son **fallback** —una de ellas de 2153 m—. Son los dos casos que la
 * penalización distingue, medidos y no fabricados.
 *
 * Los **nombres** de esos núcleos no se escriben en ninguna prueba y salen siempre de
 * `aristasDe`, `origenReal` y `saltosDesde`: desde SPEC-041 el reparto del repertorio
 * por celda cambia cómo se llama cada sitio del extracto, y siete casos escritos con el
 * nombre de un núcleo se ponían rojos por un renombrado sin que nada del comportamiento
 * hubiera cambiado. Lo que estas pruebas afirman es de la calzada —sus metros y su
 * marca— y del árbol, no de cómo se llame el pueblo del otro lado.
 */
export const CELDA_COSIDA = { i: 0, j: 0 };
export const CELDA_SIN_CALZADA_REAL = { i: 1, j: -2 };

/** El mundo real de una celda del barrio de tres calles, con su árbol ya leído. */
export async function mundoReal(celda = CELDA_COSIDA) {
  const registro = await celdaDeFixture('barrio-tres-calles', { celda, tramoM: 2000 });
  return { mundo: registro.mundo, registro, arbol: arbolDeCalzadas(registro.mundo) };
}

// --- Lo medido de un mundo real, sin escribir ningún nombre -------------------

/**
 * Las aristas del árbol de un mundo, cada una con lo que la propagación mira de ella:
 * sus metros, si cruza el monte y qué marcas de suposición llevan sus tramos.
 *
 * En orden estable por identificador y sin repetir una arista por sus dos sentidos, para
 * que elegir «la cosida» o «la más larga» dé siempre la misma en dos ejecuciones.
 */
export function aristasDe(mundo, arbol = arbolDeCalzadas(mundo)) {
  const vistas = new Set();
  const aristas = [];
  for (const r of mundo?.routes ?? []) {
    if (r?.ramal) continue;
    const a = r?.from?.name;
    const b = r?.to?.name;
    if (typeof a !== 'string' || typeof b !== 'string' || a === b) continue;
    if (!arbol.tiene(a) || !arbol.tiene(b)) continue;
    const clave = [a, b].sort().join('|');
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const marcas = [...new Set((r.tramos ?? []).map((t) => t.suposicion ?? SUPOSICIONES.NINGUNA))];
    aristas.push({
      a,
      b,
      metros: Math.round(arbol.metrosDe(a, b)),
      cruzaElMonte: arbol.cruzaElMonteDe(a, b),
      cosida: marcas.includes(SUPOSICIONES.COSIDA),
      fallback: marcas.includes(SUPOSICIONES.FALLBACK),
      limpia: marcas.every((m) => m === SUPOSICIONES.NINGUNA),
    });
  }
  return aristas.sort((x, y) => (`${x.a}|${x.b}` < `${y.a}|${y.b}` ? -1 : 1));
}

/**
 * La única arista que cumple una condición, o un fallo que dice qué había.
 *
 * Existe para que una prueba que pide «la calzada cosida de esta celda» se ponga roja
 * cuando deja de haber exactamente una, en vez de elegir en silencio la primera y medir
 * otra cosa.
 */
export function laUnicaArista(aristas, cumple, que) {
  const candidatas = aristas.filter(cumple);
  if (candidatas.length !== 1) {
    const vistas = aristas.map((e) => `${e.a}↔${e.b} ${e.metros} m${e.cosida ? ' cosida' : ''}${e.fallback ? ' fallback' : ''}`).join('; ');
    throw new Error(`se esperaba una sola arista ${que} y hay ${candidatas.length}. Las de esta celda son: ${vistas}`);
  }
  return candidatas[0];
}

/**
 * El núcleo desde el que nace el rumor en un mundo real: el primero por orden estable
 * **que tenga por dónde contarlo**. Un origen aislado dejaría los casos de la
 * propagación afirmando sobre un rumor que no viaja a ninguna parte.
 */
export function origenReal(arbol) {
  const origen = arbol.nucleos.find((n) => arbol.vecinos(n).length > 0);
  if (!origen) throw new Error('ningún núcleo de esta celda tiene vecinos por calzada: no hay rumor que pueda viajar');
  return origen;
}

/** Los saltos de calzada desde un núcleo hasta cada uno de los demás, por anchura. */
export function saltosDesde(arbol, origen) {
  const saltos = new Map([[origen, 0]]);
  const cola = [origen];
  while (cola.length) {
    const actual = cola.shift();
    for (const vecino of arbol.vecinos(actual)) {
      if (saltos.has(vecino)) continue;
      saltos.set(vecino, saltos.get(actual) + 1);
      cola.push(vecino);
    }
  }
  return saltos;
}

/** El primer núcleo, por orden estable, que está a exactamente `n` saltos del origen. */
export function aSaltos(arbol, origen, n) {
  const saltos = saltosDesde(arbol, origen);
  const cual = arbol.nucleos.find((id) => saltos.get(id) === n);
  if (!cual) throw new Error(`ningún núcleo de esta celda está a ${n} saltos de "${origen}": el caso no mediría nada`);
  return cual;
}

// --- Mundos sintéticos ------------------------------------------------------

/**
 * Un núcleo con la forma mínima que el árbol necesita: su nombre, que es su
 * identificador, y su posición, que solo usa el enganche de un paraje.
 */
function nucleo(name, x = 0, y = 0) {
  return { name, x, y, type: 'aldea', services: [] };
}

/**
 * Una calzada entre dos núcleos, troceada en tramos con su longitud y su marca.
 *
 * Los tramos se escriben a mano a propósito: lo que estas pruebas afirman es cómo
 * se lee la marca de cada tramo y cómo se suman los metros, y con un trazado
 * generado no se podría fijar ni lo uno ni lo otro.
 *
 * @param {object} opciones
 *   `metros` la longitud total; `trozos` en cuántos tramos se reparte; `suposicion`
 *   la marca de todos ellos, o una lista con la de cada uno.
 */
function calzada(a, b, { metros = 1000, trozos = 1, suposicion = SUPOSICIONES.NINGUNA } = {}) {
  const marcas = Array.isArray(suposicion) ? suposicion : new Array(trozos).fill(suposicion);
  const cuantos = marcas.length;
  const tramos = marcas.map((marca, i) => ({
    metros: metros / cuantos,
    suposicion: marca,
    desde: { x: (metros / cuantos) * i, y: 0 },
    hasta: { x: (metros / cuantos) * (i + 1), y: 0 },
  }));
  return { from: a, to: b, name: `Calzada de ${a.name} a ${b.name}`, pts: [], nodos: [], tramos };
}

/**
 * Un mundo sintético a partir de una lista de aristas `[desde, hasta, opciones]`.
 *
 * Los núcleos se crean por orden de aparición y se colocan en fila; sus posiciones
 * solo importan para colgar un paraje, porque la latencia se mide **sobre la
 * longitud de las calzadas** y nunca en línea recta.
 */
export function mundoDe(aristas, { parajes = [], sueltos = [] } = {}) {
  const porNombre = new Map();
  const pide = (name) => {
    if (!porNombre.has(name)) porNombre.set(name, nucleo(name, porNombre.size * 1000, 0));
    return porNombre.get(name);
  };
  const routes = aristas.map(([a, b, opciones]) => calzada(pide(a), pide(b), opciones));
  for (const name of sueltos) pide(name);
  const losParajes = parajes.map((p, i) => ({ name: p.name, x: p.x ?? 0, y: p.y ?? i * 10, kind: 'ruina' }));
  for (const p of parajes) {
    if (!p.cuelgaDe) continue;
    routes.push({
      from: losParajes.find((x) => x.name === p.name),
      to: pide(p.cuelgaDe),
      ramal: true,
      name: `Senda de ${p.name}`,
      pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
      nodos: [],
      tramos: [{ metros: 50, suposicion: SUPOSICIONES.NINGUNA, desde: { x: 0, y: 0 }, hasta: { x: 0, y: 0 } }],
    });
  }
  return { settlements: [...porNombre.values()], routes, parajes: losParajes };
}

/** Una cadena de núcleos, cada uno a `metros` del siguiente. El caso más legible. */
export function mundoLineal(nombres, { metros = 1000, suposicion = SUPOSICIONES.NINGUNA } = {}) {
  const aristas = [];
  for (let i = 0; i + 1 < nombres.length; i++) aristas.push([nombres[i], nombres[i + 1], { metros, suposicion }]);
  return mundoDe(aristas);
}

// --- Desenlaces y propagación ------------------------------------------------

/** Una plantilla del catálogo por su identificador. */
export function plantillaDe(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`el catálogo no trae la plantilla "${id}"`);
  return t;
}

/** La plantilla notable de referencia y la única que no lo es, declaradas por su nombre. */
export const PLANTILLA_NOTABLE = 'entrega-sospechosa';
export const PLANTILLA_NO_NOTABLE = 'peregrinaje';

/**
 * El desenlace que SPEC-010 entrega al terminar una aventura, con lo poco que la
 * propagación mira de él: de qué plantilla salió, dónde ocurrió y, si la partida
 * ofreció otra salida, con qué signo.
 */
export function desenlaceEn(lugar, { plantilla = PLANTILLA_NOTABLE, id = 'r1', signo, cierreEnCorto, tipo = 'nucleo' } = {}) {
  return {
    id,
    plantilla: typeof plantilla === 'string' ? plantillaDe(plantilla) : plantilla,
    lugar: { tipo, id: lugar },
    // `signo === undefined` y no `!signo`: el desenlace tiene que poder traer un
    // signo vacío o cero para que la validación se pueda probar de verdad.
    ...(signo === undefined ? {} : { signo }),
    ...(cierreEnCorto === undefined ? {} : { cierreEnCorto }),
  };
}

/**
 * Una propagación lista para usar sobre un mundo, con su estado y lo sedimentado a
 * la vista para que la prueba pueda afirmar sobre los dos.
 */
export function propagacionSobre(mundo, { tramo = 2000, mapaId = MAPA, semilla = SEMILLA_A, estado = estadoDeRumores(), nucleos = estadoDeNucleos(), arbol = null } = {}) {
  const elArbol = arbol ?? arbolDeCalzadas(mundo);
  const prop = creaPropagacionDeRumores({ semilla, mapaId, arbol: elArbol, estado, nucleos, tramo });
  return { prop, estado, nucleos, arbol: elArbol, mapaId };
}

/** Avanza `cuantos` pasos de propagación y devuelve los efectos de cada uno. */
export function avanza(prop, cuantos, desde = 1) {
  const efectos = [];
  for (let k = 0; k < cuantos; k++) efectos.push(prop.produce(desde + k, null));
  return efectos;
}

/**
 * El código de un módulo sin sus comentarios ni sus cadenas de texto.
 *
 * Hace falta porque estos módulos **explican sus decisiones en prosa**, que es la
 * convención del repo: `deformacion.js` menciona al narrador precisamente para
 * decir que no depende de ninguno, y `rumores.js` nombra `buildWorld` para decir
 * que no lo importa. Una prueba que buscara esas palabras en el fichero entero
 * castigaría exactamente el comentario que `CLAUDE.md` pide escribir.
 */
export function codigoDe(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, "''");
}

/**
 * El nivel con el que un núcleo oyó un rumor, o `null` si no lo ha oído.
 *
 * Se resuelve con la **consulta por núcleo**, que es la única que hay: preguntar
 * leyendo el estado por dentro habría dejado sin ejercitar justamente la superficie
 * que la spec dice que es la pieza.
 */
export function nivelEn(nucleos, mapaId, nucleo, rumor = 'r1') {
  const v = loQueSeCuentaEn(nucleos, { mapaId, nucleo }).find((x) => x.rumor === rumor);
  return v ? v.nivel : null;
}
