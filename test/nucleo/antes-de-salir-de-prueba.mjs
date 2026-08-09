// SPEC-028 · Lo que necesitan las pruebas del momento «antes de salir»: el calendario
// inyectado, un personaje y un mapa escritos a mano, los mundos sintéticos donde el
// reparto sale exacto, y los mundos congelados ya generados y memoizados.
//
// Vive aquí y no en `test/dobles/` por lo mismo que `entrega-de-prueba.mjs` y
// `rumor-de-prueba.mjs`: los dobles son de la frontera del núcleo —datos de OSM, GPS,
// reloj, proxy— y esto es andamiaje. Nada de aquí toca la red ni el reloj del sistema:
// el día se declara, los sitios se escriben y el azar sale siempre de la semilla.
//
// Los mundos son de dos clases a propósito, con el mismo criterio que
// `accesibilidad.test.mjs`. **Sintéticos** cuando hace falta un reparto de tamaño
// exacto —ningún fixture produce un mundo con una sola plantilla que castee, ni uno
// donde el filtro deje el alcance justo por debajo—, y **los cuatro congelados** cuando
// lo que se mide es el dato real de OSM.

import { construyeGrafo } from '../../packages/nucleo/world/grafo.js';
import {
  PRESUPUESTO_PREPARACION_MS,
  declaraAusencia,
  declaraIlustracion,
  declaraTexto,
  ordenaRecursos,
  planDeIlustraciones,
  recursosVacios,
} from '../../packages/nucleo/partida/recursos.js';
import { componePreparacion, resumenDeLaPreparacion } from '../../packages/nucleo/partida/preparacion.js';
import { redactaAventura } from '../../packages/nucleo/quests/narrador.js';
import { generaMundo, semillaDe, LOS_CUATRO, LAS_DOS_SEMILLAS } from './mundo-de-prueba.mjs';

/**
 * El generador, armado como la pieza que `creaPreparacion` exige en su `DEL_NUCLEO`.
 *
 * El mismo objeto que arma `app/nucleo/piezas.js` para la app, pero por ruta relativa:
 * la app cita el paquete por su nombre y estas pruebas no pueden resolver nada
 * instalado, que es el criterio duro de SPEC-020.
 */
export const NUCLEO_DE_LA_PREPARACION = Object.freeze({
  PRESUPUESTO_PREPARACION_MS,
  declaraAusencia,
  declaraIlustracion,
  declaraTexto,
  ordenaRecursos,
  planDeIlustraciones,
  recursosVacios,
  componePreparacion,
  resumenDeLaPreparacion,
  redactaAventura,
});

/** El día de casi todas estas pruebas. Un entero, nunca una fecha. */
export const DIA = 23;

/**
 * El calendario de la partida, parado en un día.
 *
 * Es el doble de la única entrada nueva de esta fila. Se escribe como objeto con
 * `dia()` y no como entero porque es exactamente lo que el núcleo exige: un número
 * admite el cero por defecto sin que nadie lo note, y un objeto ausente no.
 */
export const calendarioEn = (dia = DIA) => ({ dia: () => dia });

/** Quien juega: nombre, oficio y la palabra con la que se dice ese oficio. */
export const PERSONAJE = Object.freeze({
  nombre: 'Sabela',
  oficio: 'taberna',
  oficioDicho: 'tabernera',
  genero: 'f',
});

/** El mapa levantado, con lo poco que la portada le pide: su identificador y su título. */
export const MUNDO = Object.freeze({ mapaId: 'casa', titulo: 'Reinos de Vaeloria' });

/** El mapa de la cola de entregas de estas pruebas. */
export const MAPA = 'casa';

// ── Mundos sintéticos ───────────────────────────────────────────────────────────

/** Una vía sintética: identificadores de nodo de OSM, puntos en metros y sus tags. */
const via = (nodes, puntos, extra = {}) => ({ pts: puntos.map(([x, y]) => ({ x, y })), nodes, ...extra });

const ASFALTO = { highway: 'residential', surface: 'asphalt' };
const ESCALERA = { highway: 'steps' };

/**
 * El mundo donde castea **una sola plantilla**, y de un oficio concreto.
 *
 * `la-posada-sin-sitio` es la única del catálogo con afinidad exclusiva de taberna, así
 * que este mundo sirve para las dos cosas que hacen falta: un día con una sola aventura
 * —que no es un día roto— y un oficio para el que esa plantilla no existe nunca.
 */
export function mundoDeUnaSola({ plantilla = 'la-posada-sin-sitio' } = {}) {
  const viario = construyeGrafo([
    via([1, 2], [[0, 0], [300, 0]], { name: 'Rúa da Pousada', filtrables: ASFALTO }),
    via([2, 3], [[300, 0], [300, 300]], { name: 'Corredoira do Souto', filtrables: ASFALTO }),
    via([3, 1], [[300, 300], [0, 0]], { name: 'Camiño Vello', filtrables: ASFALTO }),
  ]);
  const casting = [{
    ok: true,
    tpl: { id: plantilla },
    beats: [
      { lugar: { x: 0, y: 0, nombre: 'A Pousada do Corvo' } },
      { lugar: { x: 300, y: 0, nombre: 'O Cruceiro Branco' } },
      { lugar: { x: 300, y: 300, nombre: 'A Fonte Vella' } },
    ],
  }];
  return { viario, casting };
}

/**
 * El mundo donde el filtro deja el reparto sin ni un lazo que quepa.
 *
 * Con un tramo de 200 m el alcance de una aventura son 800 m: el lazo corto mide 760 y
 * cabe, el rodeo mide 840 y no, y con un tramo más de alcance —1000 m— el rodeo vuelve a
 * caber. Es el único caso en el que la falta de reparto se puede atribuir al filtro sin
 * mentir, y por eso hace falta construirlo: ningún fixture lo produce.
 */
export function mundoSinRepartoPorElFiltro({ plantilla = 'entrega-sospechosa' } = {}) {
  const h = Math.sqrt(8000); // 2·√(190² + h²) = 420 m por salto
  const viario = construyeGrafo([
    via([1, 2], [[0, 0], [380, 0]], { name: 'A Escalinata da Fonte', filtrables: ESCALERA }),
    via([1, 30, 2], [[0, 0], [190, h], [380, 0]], { name: 'Rúa do Rodeo', filtrables: ASFALTO }),
  ]);
  const casting = [{
    ok: true,
    tpl: { id: plantilla },
    beats: [
      { lugar: { x: 0, y: 0, nombre: 'A Fonte Vella' } },
      { lugar: { x: 380, y: 0, nombre: 'O Cruceiro Branco' } },
    ],
  }];
  return { viario, casting };
}

/** El tramo con el que ese mundo se queda sin reparto por el filtro. */
export const TRAMO_SIN_REPARTO = 200;

/**
 * El tramo con el que ese mismo mundo no llega **ni estirado**: 4 tramos son 600 m y 5
 * son 750, y el lazo más corto mide 760. Es lo que permite afirmar que un segundo
 * estirón no se encadena solo.
 */
export const TRAMO_QUE_NO_LLEGA = 150;

/** El tramo de quien juega en los mundos congelados. */
export const TRAMO = 1500;

// ── Mundos congelados ───────────────────────────────────────────────────────────

const generados = new Map();

/**
 * Un mundo congelado ya generado, memoizado por su clave.
 *
 * Los mundos salen congelados de la tubería, así que compartir el mismo entre pruebas no
 * puede contaminar a nadie; y generar el urbano denso cuesta más de un segundo.
 */
export async function mundoCongeladoGenerado(nombre, semilla = '1') {
  const clave = `${nombre}|${semilla}`;
  if (!generados.has(clave)) generados.set(clave, await generaMundo(nombre, semillaDe(nombre, semilla)));
  return generados.get(clave);
}

/** Los ocho mundos reales —cuatro fixtures por dos semillas—, en orden estable. */
export async function losOchoMundos() {
  const out = [];
  for (const nombre of LOS_CUATRO) {
    for (const semilla of LAS_DOS_SEMILLAS) out.push({ nombre: `${nombre}#${semilla}`, mundo: await mundoCongeladoGenerado(nombre, semilla) });
  }
  return out;
}

// ── Comparaciones ───────────────────────────────────────────────────────────────

/** Todas las aristas de un grafo, una vez por par de nodos y en orden estable. */
function aristasUnicas(grafo) {
  const out = [];
  const vistas = new Set();
  for (const id of grafo.nodeIds) {
    for (const a of grafo.adj.get(id) ?? []) {
      const clave = String(id) < String(a.hasta) ? `${id}|${a.hasta}` : `${a.hasta}|${id}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      out.push({ desde: id, hasta: a.hasta, ...a });
    }
  }
  return out;
}

/**
 * La huella de un grafo, en texto.
 *
 * Es lo que permite afirmar «el estirón no ha resembrado nada» comparando antes y
 * después sin comparar objetos con Maps dentro, que serializados dan `{}` y dejarían
 * pasar cualquier regresión.
 */
export function huellaDelGrafo(grafo) {
  const nodos = grafo.nodeIds.map((id) => `${id}@${grafo.coord.get(id).x.toFixed(3)},${grafo.coord.get(id).y.toFixed(3)}`);
  const aristas = aristasUnicas(grafo).map((a) => `${a.desde}|${a.hasta}|${a.metros.toFixed(3)}|${a.nombre}|${a.suposicion}|${JSON.stringify(a.aptitud)}`);
  return JSON.stringify({ nodos, aristas, informe: grafo.informe });
}

/**
 * Todas las cadenas que hay dentro de una composición, con la ruta donde viven.
 *
 * Es lo que convierte «ningún texto de estas cinco pantallas lleva una cifra de
 * distancia» en una comprobación sobre lo que de verdad se pinta, y no solo sobre el
 * guion: un texto compuesto a partir de dos piezas correctas puede llevar una cifra que
 * ninguna de las dos llevaba.
 */
export function textosDe(valor, ruta = '') {
  if (typeof valor === 'string') return [{ ruta: ruta || '(raíz)', texto: valor }];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => textosDe(v, `${ruta}[${i}]`));
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => textosDe(v, ruta ? `${ruta}.${k}` : k));
  }
  return [];
}
