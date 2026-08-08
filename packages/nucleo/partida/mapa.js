// Un mapa de la partida: su rejilla, el registro de las celdas que ya están
// abiertas y por cuál de las dos vías se abrieron, y las costuras entre las que se
// tocan. Lo generado se guarda aquí y no se vuelve a generar nunca; lo único que
// cambia al jugar es qué hay abierto, jamás lo que hay dentro.

import { makeRng } from '../core/rng.js';
import { SUFIJOS_DE_FASE, exigeSemilla, semillaDeCelda } from '../core/semilla.js';
import { generaCelda } from '../world/celda.js';
import { coseCeldas } from '../world/costura.js';
import {
  celdaEnPosicion,
  celdasContiguas,
  claveDeCelda,
  creaRejilla,
  exigeCelda,
  ordenCanonico,
} from '../world/rejilla.js';

/**
 * Levanta un mapa.
 *
 * La coordenada exacta entra por aquí y **no sale**: lo que queda registrado es el
 * anclaje redondeado de la rejilla, que además es el identificador del mapa dentro
 * de la partida.
 *
 * @param {{ semilla: string, lat?: number, lon?: number, anclaje?: object, tramoM: number }} opciones
 */
export function creaMapa({ semilla, lat, lon, anclaje, tramoM }) {
  const semillaPartida = exigeSemilla(semilla);
  const rejilla = creaRejilla({ lat, lon, anclaje, tramoM });
  return {
    semilla: semillaPartida,
    id: rejilla.id,
    anclaje: rejilla.anclaje,
    rejilla,
    celdas: [],
    costuras: [],
  };
}

const claveDeCostura = (a, b) => {
  const [p, q] = ordenCanonico(a, b);
  return `${claveDeCelda(p)}|${claveDeCelda(q)}`;
};

/** Las celdas abiertas, en orden estable por su clave. Un mapa recién levantado devuelve una lista vacía. */
export function celdasAbiertas(mapa) {
  return mapa.celdas.slice().sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0));
}

/** El registro de una celda si está abierta, o `null`. */
export function celdaAbierta(mapa, celda) {
  exigeCelda(celda);
  const clave = claveDeCelda(celda);
  return mapa.celdas.find((c) => c.clave === clave) ?? null;
}

/** Las costuras calculadas, en orden estable. */
export function costuras(mapa) {
  return mapa.costuras.slice().sort((a, b) => (a.celdas[0] + a.celdas[1] < b.celdas[0] + b.celdas[1] ? -1 : 1));
}

/**
 * En qué celda cae una posición y en qué situación está esa celda respecto del mapa.
 *
 * `estado` vale `'abierta'`, `'contigua'` (cerrada pero tocando a una abierta),
 * `'inicial'` (el mapa todavía no tiene ninguna celda abierta) o `'fuera'`, que es
 * la respuesta honesta a una posición que este mapa no contiene: quien pregunta
 * decide entonces si levanta otro mapa, y aquí no se abre nada.
 */
export function resuelvePosicion(mapa, lat, lon) {
  const celda = celdaEnPosicion(mapa.rejilla, lat, lon);
  const clave = claveDeCelda(celda);
  if (celdaAbierta(mapa, celda)) return { celda, clave, estado: 'abierta' };
  if (!mapa.celdas.length) return { celda, clave, estado: 'inicial' };
  const tocaAlgo = celdasContiguas(celda).some((v) => celdaAbierta(mapa, v));
  return { celda, clave, estado: tocaAlgo ? 'contigua' : 'fuera' };
}

// Registra una celda ya generada y cose lo que toque. Las costuras se calculan una
// vez, al aparecer el segundo lado del borde: recalcular una costura existente al
// abrir una tercera celda la haría cambiar sin que nadie hubiera tocado su borde.
function registra(mapa, registro) {
  mapa.celdas.push(registro);
  for (const vecina of celdasContiguas(registro.celda)) {
    const otra = celdaAbierta(mapa, vecina);
    if (!otra) continue;
    const clave = claveDeCostura(registro.celda, vecina);
    if (mapa.costuras.some((c) => `${c.celdas[0]}|${c.celdas[1]}` === clave)) continue;
    mapa.costuras.push(coseCeldas({ rejilla: mapa.rejilla, a: registro, b: otra, semilla: mapa.semilla, mapaId: mapa.id }));
  }
  return registro;
}

/**
 * Abre una celda por la vía que diga `motivo`.
 *
 * Si ya estaba abierta se devuelve la que hay y no se genera nada. Si la consulta
 * de datos falla, se propaga el error y **no queda ninguna celda a medias**: el
 * registro solo se toca cuando hay un mundo entero que registrar.
 */
export async function abreCelda(mapa, celda, { motivo = 'pisada', consultaOsm, onStatus, tramoM } = {}) {
  exigeCelda(celda);
  const yaEstaba = celdaAbierta(mapa, celda);
  if (yaEstaba) return { registro: yaEstaba, generada: false };

  const registro = await generaCelda({
    rejilla: mapa.rejilla,
    semilla: mapa.semilla,
    mapaId: mapa.id,
    celda,
    motivo,
    consultaOsm,
    onStatus,
    tramoM,
  });
  return { registro: registra(mapa, registro), generada: true };
}

/**
 * El jugador pisa una posición.
 *
 * Abre la celda si hace falta, porque el mundo tiene que existir donde estás —y eso
 * cubre a quien vive pegado a un borde—. Si la posición no la contiene este mapa,
 * no se genera nada y se dice.
 */
export async function pisa(mapa, lat, lon, { consultaOsm, onStatus, tramoM } = {}) {
  const donde = resuelvePosicion(mapa, lat, lon);
  if (donde.estado === 'abierta') return { ...donde, registro: celdaAbierta(mapa, donde.celda), generada: false };
  if (donde.estado === 'fuera') {
    return { ...donde, registro: null, generada: false, mensaje: `ninguna celda de este mapa contiene esa posición (sería la ${donde.clave})` };
  }
  const { registro, generada } = await abreCelda(mapa, donde.celda, { motivo: 'pisada', consultaOsm, onStatus, tramoM });
  return { ...donde, registro, generada };
}

/**
 * Llega la señal de que una celda se ha completado.
 *
 * La recompensa es abrir una vecina, y **la elige la semilla**: es acontecimiento y
 * no decisión (`alcance-del-mundo.md` §2), y tiene que salir igual en dos
 * ejecuciones iguales. Si no queda ninguna vecina cerrada, no hay acontecimiento
 * que anunciar y no se genera nada.
 */
export async function completaCelda(mapa, celda, { consultaOsm, onStatus, tramoM } = {}) {
  exigeCelda(celda);
  const cerradas = celdasContiguas(celda).filter((v) => !celdaAbierta(mapa, v));
  if (!cerradas.length) return { acontecimiento: false, registro: null, celda: null };

  const semillaAcontecimiento = semillaDeCelda(mapa.semilla, mapa.id, celda) + SUFIJOS_DE_FASE.acontecimiento;
  const rng = makeRng(semillaAcontecimiento);
  // Las contiguas llegan ya en orden canónico, así que el sorteo no depende de en
  // qué orden se abrieron las demás.
  const elegida = cerradas[Math.floor(rng() * cerradas.length)];
  const { registro } = await abreCelda(mapa, elegida, { motivo: 'acontecimiento', consultaOsm, onStatus, tramoM });
  return { acontecimiento: true, registro, celda: elegida };
}
