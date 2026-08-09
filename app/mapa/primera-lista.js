// Lo que se cuenta el día uno: el prólogo corrido sobre el mundo recién levantado, el
// reparto filtrado por el oficio de quien juega y la regla de la primera aventura
// aplicada encima.
//
// Vive en `app/` y no en el paquete por lo mismo que el levantamiento: es
// orquestación, encadena tres capas del núcleo y no aporta ninguna regla propia. Lo
// único suyo es la palabra con la que cada tamaño se dice en pantalla, que es texto y
// por eso no está en el núcleo.
//
// El orden importa y no es negociable: **castear, filtrar por oficio, y solo después
// la regla del arranque**. La regla se aplica encima y nunca en lugar del casting —una
// aventura que no castea no se ofrece por mucho que pase por los dos núcleos— y
// degrada abriendo: si ninguna pasa por los dos, se ofrece la lista normal, porque un
// día uno vacío sería peor que la puesta en escena que se pierde.

import { filtraPrimeraAventura } from '@walkingadventure/nucleo/partida/arranque.js';
import { repartoDeAventuras } from '@walkingadventure/nucleo/partida/aventuras.js';
import { correPrologo } from '@walkingadventure/nucleo/partida/prologo.js';
import { MEDIDA_DE_TAMANO, medidaDe } from '@walkingadventure/nucleo/partida/guion-de-antes-de-salir.js';
import { CATALOGO } from '@walkingadventure/nucleo/quests/catalogo.js';
import { plantillasDeOficio } from '@walkingadventure/nucleo/quests/oficios.js';

/**
 * La medida de cada tamaño **en palabra del mundo**, reexportada del núcleo.
 *
 * Vivió aquí mientras solo la usaba A1P7. Desde SPEC-028 la lista de hoy dice exactamente lo
 * mismo, y dos copias del mismo texto acabarían diciendo cosas distintas: ahora es una pieza
 * del guion de antes de salir, donde además se revisa que no lleve ninguna distancia.
 */
export { MEDIDA_DE_TAMANO };

/**
 * El punto desde el que se resuelve la alcanzabilidad del prólogo.
 *
 * Es **el anclaje**, que en el marco métrico del documento es el origen, y es exactamente lo
 * único que el arranque conservó: la posición donde se soltó la marca no se guarda en ninguna
 * parte (RF-PRIV-002). No es «suponer el centro del mapa» —eso sería inventárselo teniendo
 * otra cosa—: es usar el único punto que existe.
 */
export const PUNTO_DEL_ANCLAJE = Object.freeze({ x: 0, y: 0 });

/** La plantilla del catálogo con ese identificador, o un error que la nombra. */
function plantillaDe(id) {
  const encontrada = CATALOGO.find((p) => p.id === id);
  if (!encontrada) {
    throw new Error(`el reparto ofrece la plantilla "${id}" y el catálogo no la tiene: la lista del día uno se compone desde el catálogo y no desde el casting`);
  }
  return encontrada;
}

/** Una tarjeta de aventura: lo que A1P7 pinta y nada más. */
function tarjetaDe(aventura) {
  const plantilla = plantillaDe(aventura.plantilla);
  const medida = medidaDe(plantilla.tamano);
  return Object.freeze({
    id: plantilla.id,
    titulo: plantilla.titulo,
    gancho: plantilla.gancho,
    tamano: plantilla.tamano,
    medida,
  });
}

/**
 * Compone la lista del día uno.
 *
 * @param {object} opciones
 *   `semilla` la de la partida; `mapaId` el anclaje del mapa; `mundo` el documento
 *   recién levantado; `tramoM` el tramo declarado; `oficio` el de quien juega;
 *   `criterios` los caminos que se evitan; `sinContenidoJugable` la marca de la celda.
 * @returns `{ hayLista, aventuras, prologo, motivo }`. El prólogo vuelve entero porque
 *   su estado —los rumores sedimentados, el par compuesto, la cola sembrada— es de la
 *   partida y quien llama tiene que guardarlo: perderlo dejaría el mundo sin pasado.
 */
export function componePrimeraLista({
  semilla,
  mapaId,
  mundo,
  tramoM,
  oficio,
  criterios = [],
  sinContenidoJugable = false,
}) {
  const prologo = correPrologo({
    semilla,
    mapaId,
    mundo,
    tramoM,
    partida: PUNTO_DEL_ANCLAJE,
    criterios,
    primerMapa: true,
    sinContenidoJugable,
  });

  const reparto = repartoDeAventuras({ mundo, criterios, tramo: tramoM, tamano: 'aventura' });
  if (!reparto.hayReparto) {
    return Object.freeze({ hayLista: false, aventuras: [], prologo, motivo: reparto.motivo });
  }

  // El oficio filtra **lo que se ofrece**, nunca lo que existe: el mundo es el mismo
  // para dos personas con oficios distintos, y lo que cambia es esta lista.
  const suyas = new Set(plantillasDeOficio(oficio, CATALOGO).map((p) => p.id));
  const candidatas = reparto.aventuras.filter((a) => a.cabe && suyas.has(a.plantilla));
  const primeras = filtraPrimeraAventura({ aventuras: candidatas, arranque: prologo.arranque, mundo });

  return Object.freeze({
    hayLista: primeras.length > 0,
    aventuras: Object.freeze(primeras.map(tarjetaDe)),
    prologo,
    motivo: null,
  });
}
