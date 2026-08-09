// El regreso: cuándo volver al punto de partida echa el telón. Dos condiciones —
// haberse alejado medio tramo y quedarse dentro del radio de regreso el tiempo de
// permanencia— y **ninguna consulta a la clasificación de la traza**.
//
// Esa ausencia es el contenido de este módulo tanto como sus dos condiciones.
// `bucle-jugable.md` §8: «volver es una cuestión de dónde estás, no de cuántos
// kilómetros pusiste tú». Por eso aquí no se importa nada de `ritmo.js`, la
// clasificación no aparece en ninguna firma y no hay dónde colarla: es lo que hace
// que «volver a casa en autobús echa el telón igual» se pueda poner rojo en lugar de
// prometerse en un comentario.
//
// Y la asimetría, que es la contraria a la del plazo del rótulo: **en la duda no se
// cierra**. Un cierre que no ocurre se arregla con un toque en el rótulo; un cierre
// de más no se arregla con nada.

import { congelaHondo } from '../core/congelar.js';
import { makeProjector } from '../core/geo.js';
import { SUELO_TRAMO_M, exigeTramoM } from './tramo.js';

/**
 * Cuánto hay que alejarse para que la salida pueda cerrarse, **en tramos**.
 *
 * Medio tramo, de `accesibilidad.md` §1: ninguna unidad de juego se calibra en metros
 * absolutos. Son ~1 km para quien anda 2 km en media hora y ~150 m —elevados al suelo
 * de moverse— para quien anda 300, que en los dos casos es «haber salido de casa de
 * verdad». Sin esta condición, abrir la salida en casa la cerraría al instante.
 */
export const TRAMOS_DE_ALEJAMIENTO = 0.5;

/**
 * El radio dentro del cual se cuenta que se ha vuelto. **En metros, y a propósito**:
 * es una tolerancia de sensor y no una unidad de juego, así que no se escala con el
 * tramo. Cincuenta metros cubren un portal y un patio.
 */
export const RADIO_DE_REGRESO_M = 50;

/**
 * Cuánto hay que quedarse dentro del radio. El minuto es lo que distingue «he
 * llegado» de «he pasado por delante» a mitad de un lazo, y es más exigente que los
 * veinte segundos de una llegada porque aquí equivocarse cuesta una aventura viva.
 */
export const PERMANENCIA_S = 60;

/** La permanencia en milisegundos, que es la unidad en la que llegan las marcas. */
export const PERMANENCIA_MS = PERMANENCIA_S * 1000;

/**
 * Lo que esta comprobación **no** mira, declarado para poder afirmarlo. Es la lista
 * contra la que se comprueba que volver en autobús echa el telón igual.
 */
export const LO_QUE_EL_REGRESO_NO_MIRA = congelaHondo([
  'clasificacion-de-la-traza',
  'deteccion-de-vehiculo',
  'metros-andados',
  'ritmo',
]);

/**
 * La distancia de alejamiento en metros para un tramo concreto, **nunca por debajo
 * del suelo de moverse**: medio tramo de quien anda 300 m en media hora serían 150 m,
 * y 150 m no es haber salido de casa en ningún barrio.
 */
export function distanciaDeAlejamientoM(tramo) {
  const tramoM = exigeTramoM(tramo, 'la distancia de alejamiento del regreso');
  return Math.max(SUELO_TRAMO_M, TRAMOS_DE_ALEJAMIENTO * tramoM);
}

/**
 * Un punto de partida, validado. Falla **nombrando lo recibido**: una salida abierta
 * sobre un punto que no es una coordenada nunca podría cerrarse por regreso, y eso se
 * descubriría al volver a casa y no ver el telón.
 */
export function exigeCoordenada(punto, quien = 'el punto de partida') {
  if (!punto || typeof punto !== 'object' || !Number.isFinite(punto.lat) || !Number.isFinite(punto.lon)) {
    throw new Error(`${quien} tiene que ser una coordenada { lat, lon } y llegó ${JSON.stringify(punto) ?? String(punto)}`);
  }
  if (punto.lat < -90 || punto.lat > 90 || punto.lon < -180 || punto.lon > 180) {
    throw new Error(`${quien} está fuera del mundo: llegó ${JSON.stringify(punto)}`);
  }
  return { lat: punto.lat, lon: punto.lon };
}

/**
 * Metros entre dos coordenadas, con la proyección local del propio punto de partida.
 * A la escala de un barrio la equirrectangular no se distingue de nada mejor, y es la
 * que ya usa todo el generador.
 */
export function metrosEntre(a, b) {
  const p = makeProjector(a.lat, a.lon).toXY(b.lat, b.lon);
  return Math.hypot(p.x, p.y);
}

/** La vigilancia de una salida recién abierta: ni se alejó, ni lleva nada dentro. */
export function estadoDeRegreso() {
  return { seAlejo: false, dentroDesdeMs: null };
}

/**
 * Avanza la vigilancia con una posición.
 *
 * **La firma no tiene clasificación y no la va a tener**: eso es lo que garantiza que
 * el autobús cierre igual. Lo que entra es dónde estás y cuándo, y nada más.
 *
 * @param {object} vigilancia  lo que devuelve `estadoDeRegreso()`, o lo que dejó la
 *   posición anterior. Se devuelve una vigilancia nueva y no se muta la recibida.
 * @param {object} opciones
 *   `partida` la coordenada anotada al abrir; `alejamientoM` lo que hay que alejarse;
 *   `lat`, `lon` y `tMs` la posición y su marca de tiempo del sensor.
 * @returns `{ vigilancia, distanciaM, dentro, seAlejo, permanenciaMs, haVuelto }`.
 */
export function avanzaElRegreso(vigilancia, { partida, alejamientoM, lat, lon, tMs }) {
  const origen = exigeCoordenada(partida, 'el punto de partida de la salida');
  if (!Number.isFinite(alejamientoM) || alejamientoM <= 0) {
    throw new Error(`la distancia de alejamiento del regreso llegó como ${alejamientoM} m y hacen falta metros positivos`);
  }
  if (!Number.isInteger(tMs)) {
    throw new Error(`la marca de tiempo de la posición llegó como ${JSON.stringify(tMs) ?? String(tMs)} y el regreso compara marcas, nunca el reloj del sistema`);
  }
  const previa = vigilancia ?? estadoDeRegreso();
  const distanciaM = metrosEntre(origen, exigeCoordenada({ lat, lon }, 'la posición recibida'));

  const seAlejo = previa.seAlejo === true || distanciaM > alejamientoM;
  const dentro = distanciaM <= RADIO_DE_REGRESO_M;
  // Salir del radio borra el reloj de permanencia: pasar por delante de casa dos
  // veces no suma un minuto entre las dos.
  const dentroDesdeMs = dentro ? (previa.dentroDesdeMs ?? tMs) : null;
  const permanenciaMs = dentro ? tMs - dentroDesdeMs : 0;

  return congelaHondo({
    vigilancia: { seAlejo, dentroDesdeMs },
    distanciaM,
    dentro,
    seAlejo,
    permanenciaMs,
    // Las dos condiciones, y las dos hacen falta. Con `>=` se cierra al cumplirse el
    // minuto justo, que es lo que dice «quedarse el tiempo de permanencia».
    haVuelto: seAlejo && dentro && permanenciaMs >= PERMANENCIA_MS,
  });
}

/** La vigilancia de vuelta de su documento, con los dos campos validados. */
export function levantaRegreso(doc) {
  const seAlejo = doc?.seAlejo === true;
  const dentroDesdeMs = doc?.dentroDesdeMs;
  if (dentroDesdeMs != null && !Number.isInteger(dentroDesdeMs)) {
    throw new Error(`la vigilancia del regreso vuelve con "dentroDesdeMs" ${JSON.stringify(dentroDesdeMs)} y es una marca del sensor o nada`);
  }
  return { seAlejo, dentroDesdeMs: dentroDesdeMs ?? null };
}
