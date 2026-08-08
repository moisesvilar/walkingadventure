// Lo que se cuenta en cada núcleo: las versiones que ese sitio oyó, con su nivel y
// su signo. Es la forma que toma «la reputación es lo que llegó, no lo que se
// hizo», y por eso se pregunta **núcleo a núcleo y nunca por mapa**.
//
// La ausencia de una consulta del mapa entero es la pieza, no un descuido: el PRD
// excluye el panel del estado del mundo y el design system prohíbe el medidor de
// reputación, y lo que no sale del núcleo no se puede pintar por descuido. Es el
// mismo argumento con el que SPEC-011 no expone el contador de pasos.

import { congelaHondo } from '../core/congelar.js';
import { exigeNivel, exigeSigno } from './deformacion.js';
import { exigeMapaId } from './pasos.js';

/**
 * Lo sedimentado de una partida: un registro por mapa y nada más.
 *
 * Viaja con la partida y **nunca dentro del documento congelado de una celda**: el
 * documento describe el mundo, que no cambia porque a alguien le llegue una
 * noticia (SPEC-009). Y va por mapa porque la propagación es sobre el árbol de un
 * mapa, y dos mapas no comparten árbol.
 */
export function estadoDeNucleos() {
  return { mapas: {} };
}

/** El registro de un mapa, creándolo si es la primera vez. */
export function nucleosDeMapa(estado, mapaId) {
  const id = exigeMapaId(mapaId, 'lo que se cuenta en los núcleos');
  if (!estado || typeof estado !== 'object' || !estado.mapas || typeof estado.mapas !== 'object') {
    throw new Error('el estado de los núcleos llega mal formado: se espera lo que devuelve estadoDeNucleos(), un objeto con "mapas"');
  }
  if (!Object.prototype.hasOwnProperty.call(estado.mapas, id)) estado.mapas[id] = {};
  return estado.mapas[id];
}

function exigeNucleoId(nucleo, quien) {
  if (typeof nucleo !== 'string' || !nucleo) {
    throw new Error(`${quien}: falta el identificador del núcleo y llegó ${JSON.stringify(nucleo) ?? String(nucleo)}`);
  }
  return nucleo;
}

/**
 * Una versión bien formada de lo que se cuenta en un sitio.
 *
 * El **texto viaja aparte y puede faltar**: sin él, el dato sigue completo —nivel,
 * signo y hechos— y quien lo cuente puede caer al texto de la plantilla, que es
 * para lo que la versión lleva de qué plantilla salió.
 */
export function versionQueLlego({ rumor, plantilla = null, origen, nivel, signo, hechos, ejes = [], texto = null, oidoEn = null }) {
  if (typeof rumor !== 'string' || !rumor) {
    throw new Error(`una versión sin identidad de rumor no se puede guardar: llegó ${JSON.stringify(rumor) ?? String(rumor)}`);
  }
  return congelaHondo({
    rumor,
    plantilla,
    origen: origen ?? null,
    nivel: exigeNivel(nivel, `el nivel de la versión del rumor "${rumor}"`),
    signo: exigeSigno(signo, `el signo de la versión del rumor "${rumor}"`),
    hechos,
    ejes: ejes.slice(),
    texto,
    oidoEn,
  });
}

/**
 * Sedimenta en un núcleo la versión que le llegó.
 *
 * **No sustituye ni caduca nada**: dos rumores distintos conviven, y un núcleo que
 * ya oyó uno no lo vuelve a oír por otra rama. Lo sedimentado no se degrada con los
 * pasos, no se olvida y no se reescribe con una versión más veraz — eso último es
 * la regla del diario (fila 16) y aquí se sostiene el dato del que cuelga.
 */
export function sedimenta(estado, { mapaId, nucleo, loQueLlego }) {
  const registro = nucleosDeMapa(estado, mapaId);
  const id = exigeNucleoId(nucleo, 'sedimentar lo que se cuenta');
  const lista = Object.prototype.hasOwnProperty.call(registro, id) ? registro[id] : (registro[id] = []);
  const ya = lista.find((v) => v.rumor === loQueLlego.rumor);
  if (ya) return ya;
  lista.push(loQueLlego);
  return loQueLlego;
}

/**
 * Qué se cuenta de la jugadora en un núcleo: las versiones que **ese** núcleo oyó,
 * cada una con su nivel y su signo.
 *
 * Un núcleo que no ha oído nada devuelve una lista vacía, que no es un error: no
 * hay nada que contar es una respuesta.
 */
export function loQueSeCuentaEn(estado, { mapaId, nucleo }) {
  const registro = nucleosDeMapa(estado, mapaId);
  const id = exigeNucleoId(nucleo, 'preguntar qué se cuenta');
  return congelaHondo((registro[id] ?? []).slice());
}

/** Si un núcleo ya oyó un rumor concreto. Lo consulta el frente para no repetirse. */
export function haOido(estado, { mapaId, nucleo, rumor }) {
  return loQueSeCuentaEn(estado, { mapaId, nucleo }).some((v) => v.rumor === rumor);
}

/**
 * Lo que se le entrega a la capa que pinta: **sin el nivel de deformación y sin los
 * ejes que lo delatan**.
 *
 * El design system lo dice con todas las letras —«ningún nivel de deformación de un
 * rumor: es dato vivo interno y no sale a pantalla en ningún sitio»— y sostener
 * «el nivel no sale nunca a pantalla» es mucho más barato si el dato no llega hasta
 * allí que si llega y se confía en que nadie lo pinte.
 */
export function paraLaCapaQuePinta(versiones) {
  const lista = Array.isArray(versiones) ? versiones : [versiones];
  return congelaHondo(lista.map((v) => ({
    rumor: v.rumor,
    plantilla: v.plantilla,
    origen: v.origen,
    signo: v.signo,
    hechos: v.hechos,
    texto: v.texto,
  })));
}

/**
 * Lo sedimentado en forma serializable, con mapas y núcleos en **orden declarado**.
 *
 * Dos partidas con lo mismo oído tienen que escribir el mismo texto aunque los
 * núcleos se hayan enterado en otro orden.
 */
export function congelaNucleos(estado) {
  const mapas = {};
  for (const mapaId of Object.keys(estado?.mapas ?? {}).sort()) {
    const registro = estado.mapas[mapaId];
    const nucleos = {};
    for (const nucleo of Object.keys(registro).sort()) {
      nucleos[nucleo] = registro[nucleo].map((v) => ({
        rumor: v.rumor,
        plantilla: v.plantilla,
        origen: v.origen,
        nivel: v.nivel,
        signo: v.signo,
        hechos: v.hechos,
        ejes: v.ejes.slice(),
        texto: v.texto,
        oidoEn: v.oidoEn,
      }));
    }
    mapas[mapaId] = nucleos;
  }
  return { mapas };
}

/** Lo sedimentado de vuelta de su documento, con nivel y signo intactos. */
export function levantaNucleos(doc) {
  const estado = estadoDeNucleos();
  for (const mapaId of Object.keys(doc?.mapas ?? {}).sort()) {
    const registro = nucleosDeMapa(estado, mapaId);
    const guardado = doc.mapas[mapaId] ?? {};
    for (const nucleo of Object.keys(guardado).sort()) {
      registro[nucleo] = (guardado[nucleo] ?? []).map((v) => versionQueLlego(v));
    }
  }
  return estado;
}

// Y lo que este módulo **no** exporta, dicho en voz alta porque es la decisión:
// no hay ninguna función que devuelva el estado de todos los núcleos de un mapa a
// la vez. El panel del estado del mundo se evita mejor no exportando el dato que
// confiando en que nadie lo pinte.
