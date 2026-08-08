// El tamaño de una salida: la otra perilla, la que dimensiona **hasta dónde te
// mandan**. Se declara en tramos y en beats —nunca en metros— y solo se traduce a
// metros contra el tramo de quien juega, cada vez que se ofrece. La que dimensiona
// **lo que existe** es el tramo de la celda, y son dos entradas distintas.

import { congelaHondo } from '../core/congelar.js';
import { exigeTramoM } from './tramo.js';

/**
 * Los tres tamaños, cada uno con su palabra del mundo y su medida en tramos.
 *
 * Los beats salen de `parametros-mundo.md` §1 y §3 —un beat cada 10-15 min, paseo
 * ~1 h, aventura ~2 h, jornada ~3 h— y son **los mismos para todo el mundo**: es lo
 * que hace que dos jugadoras muy distintas reciban aventuras del mismo tamaño en
 * pasos. Ninguno lleva metros: los metros los pone el tramo de cada cual.
 */
export const TAMANOS_DE_SALIDA = congelaHondo([
  { id: 'paseo', tramos: 2, beats: 4 },
  { id: 'aventura', tramos: 4, beats: 8 },
  { id: 'jornada', tramos: 6, beats: 12 },
]);

/**
 * Cuántos beats admite cada tamaño: paseo 4-6, aventura 6-10, jornada 10-14,
 * literalmente los de `game-design/quests.md` §3.
 *
 * Va **aparte del catálogo** y no como dos campos más de cada entrada: el catálogo
 * es lo que se ofrece —una palabra, sus tramos y sus beats— y el rango es lo que
 * verifica quien castea. Pero vive en este módulo a propósito, para que el casting
 * no tenga ninguna cifra de beats escrita a mano: dos tablas del mismo número en
 * dos ficheros es como se desincronizan.
 */
export const RANGO_DE_BEATS = congelaHondo({
  paseo: { minimo: 4, maximo: 6 },
  aventura: { minimo: 6, maximo: 10 },
  jornada: { minimo: 10, maximo: 14 },
});

/** Los identificadores válidos, en el orden del catálogo. */
export const IDS_DE_TAMANO = congelaHondo(TAMANOS_DE_SALIDA.map((t) => t.id));

function exigeTamano(tamano) {
  const id = typeof tamano === 'string' ? tamano : tamano?.id;
  const encontrado = TAMANOS_DE_SALIDA.find((t) => t.id === id);
  if (!encontrado) {
    const visto = typeof tamano === 'string' ? `"${tamano}"` : JSON.stringify(tamano);
    throw new Error(`tamaño de salida desconocido ${visto}: los tres declarados son ${IDS_DE_TAMANO.join(', ')}`);
  }
  return encontrado;
}

/**
 * Dimensiona una salida contra un tramo concreto.
 *
 * @param tamano  el identificador del catálogo, o la entrada entera.
 * @param tramo   los metros por media hora, o el estado del tramo del personaje.
 * @returns `{ tamano, tramos, beats, metros, metrosPorBeat, tramosPorBeat }`, congelado.
 *   `metrosPorBeat` nunca supera un tramo: media hora entre dos beats es el techo
 *   de `parametros-mundo.md` §1, y con estos números se cumple por construcción.
 */
export function dimensionaSalida(tamano, tramo) {
  const declarado = exigeTamano(tamano);
  const tramoM = exigeTramoM(tramo, 'dimensionaSalida');
  const metros = declarado.tramos * tramoM;
  return congelaHondo({
    tamano: declarado.id,
    tramos: declarado.tramos,
    beats: declarado.beats,
    metros,
    metrosPorBeat: metros / declarado.beats,
    tramosPorBeat: declarado.tramos / declarado.beats,
  });
}

/**
 * Cuántos beats admite un tamaño: `{ minimo, maximo }`.
 *
 * Es lo que el casting comprueba contra la plantilla, y sale de aquí a propósito:
 * el tamaño lo declara la plantilla y quien lo verifica no puede tener su propia
 * tabla de rangos.
 */
export function rangoDeBeats(tamano) {
  return RANGO_DE_BEATS[exigeTamano(tamano).id];
}

/**
 * Los tres tamaños ya dimensionados contra un tramo. Es lo que se ofrece: al
 * cambiar el tramo cambian los metros y no cambia ni un beat, que es exactamente la
 * diferencia entre esta perilla y la que dimensiona el mundo.
 */
export function salidasOfrecidas(tramo) {
  return congelaHondo(TAMANOS_DE_SALIDA.map((t) => dimensionaSalida(t.id, tramo)));
}
