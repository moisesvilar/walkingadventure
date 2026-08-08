// Generar una celda: la rejilla decide dónde y cómo de grande, y la tubería
// canónica de `build.js` decide qué hay dentro. Una celda es un mapa entero, no un
// fragmento de mapa, y una vez generada no se vuelve a generar jamás.

import { buildWorld } from './build.js';
import { COSER_MAX } from './routes.js';
import { cuposDeCelda } from './cupos.js';
import { centroDeCelda, exigeCelda, claveDeCelda, limitesDeCelda } from './rejilla.js';
import { congelaHondo } from '../core/congelar.js';
import { exigeSemilla, semillaDeCelda } from '../core/semilla.js';

/**
 * Margen de borde que se pide de más al consultar OSM alrededor de una celda.
 *
 * Es el umbral de cosido y no un número propio: sin él, las dos celdas de un borde
 * verían callejeros cortados justo donde hay que coserlos y la costura no tendría
 * con qué trabajar.
 */
export const MARGEN_BORDE_M = COSER_MAX;

/** Las dos vías por las que puede existir una celda. El motivo es dato de la partida, no del mundo. */
export const MOTIVOS_DE_APERTURA = ['pisada', 'acontecimiento'];

/**
 * Genera el mundo de una celda.
 *
 * @param {object} opciones
 *   `rejilla` la del mapa; `semilla` la de la partida; `mapaId` el identificador
 *   del mapa (su anclaje); `celda` el índice `{ i, j }`; `motivo` por cuál de las
 *   dos vías se abre; `consultaOsm({ celda, limites, margenM })` la consulta de
 *   datos inyectada —el llamante decide caché y red—; `demanda` cuántos anclajes
 *   pide la celda, inyectada y opcional; `places` la fuente de relleno ya
 *   descargada, también opcional; `onStatus` se pasa tal cual
 *   a la tubería; `tramoM` el tramo de quien juega **hoy**, con el que se
 *   dimensionan los cupos de esta celda y solo de esta.
 * @returns el registro de la celda, congelado.
 */
export async function generaCelda({ rejilla, semilla, mapaId, celda, motivo = 'pisada', consultaOsm, demanda = null, places = null, onStatus, tramoM }) {
  if (!rejilla) throw new Error('generaCelda necesita la rejilla del mapa');
  exigeCelda(celda);
  const semillaPartida = exigeSemilla(semilla);
  if (typeof consultaOsm !== 'function') {
    throw new Error('generaCelda necesita que se le inyecte consultaOsm({ celda, limites, margenM }) → { geoJson, poiJson }');
  }
  if (!MOTIVOS_DE_APERTURA.includes(motivo)) {
    throw new Error(`motivo de apertura desconocido "${motivo}": los declarados son ${MOTIVOS_DE_APERTURA.join(' y ')}`);
  }

  const limites = limitesDeCelda(rejilla, celda);
  const centro = centroDeCelda(rejilla, celda);
  const semillaCelda = semillaDeCelda(semillaPartida, mapaId, celda);

  // Los cupos se calculan **aquí y una sola vez**, con el tramo de hoy: la
  // geometría de la rejilla no se mueve nunca —eso rompería los índices y las
  // costuras—, pero una celda abierta después de recalibrar el tramo mide otra cosa
  // en tramos y por eso le tocan otros cupos. Los de las celdas ya abiertas no se
  // vuelven a mirar jamás.
  const tramoDeLaCelda = Number.isFinite(tramoM) && tramoM > 0 ? tramoM : rejilla.tramoM;
  const cupos = cuposDeCelda({ radioEnTramos: rejilla.radioInscritoM / tramoDeLaCelda });

  // La frontera de datos cambia de forma sin cambiar de naturaleza: la tubería
  // sigue pidiendo por centro y radio, y aquí se traduce a los límites de la celda
  // más el margen de borde, que es lo que la consulta por celda necesita saber.
  const fetchData = async (lat, lon, radius) => {
    const margenM = MARGEN_BORDE_M + Math.max(0, radius - rejilla.radioInscritoM);
    return consultaOsm({ celda: { i: celda.i, j: celda.j }, limites, margenM });
  };

  const mundo = await buildWorld({
    lat: centro.lat,
    lon: centro.lon,
    rBase: rejilla.radioInscritoM,
    seed: semillaCelda,
    fetchData,
    // La demanda de anclajes **llega inyectada y no se deriva de `cupos`**, aunque
    // los cupos estén aquí al lado: los cupos los dimensiona el tramo de quien
    // juega, y el contenido del mundo no puede depender del tramo —dos partidas con
    // la misma semilla y tramos distintos generan el mismo mundo (SPEC-004)—. Un
    // pool alimentado por los cupos ataría lo segundo a lo primero.
    ...(demanda ? { demanda } : {}),
    // El alcance de la celda **en tramos de la rejilla**, que es de lo que sale el
    // techo de parajes por ritmo. Sale de la geometría —lado entre tramo con el que
    // se levantó el mapa, una constante de la rejilla— y no del tramo de quien juega
    // hoy, a propósito: `accesibilidad.md` §1 dice que el tramo cambia hasta dónde
    // te manda una quest y **nunca qué existe**, así que recalibrar no puede añadir
    // ni quitar un paraje. El suelo, en cambio, sale del catálogo y no del tamaño.
    radioEnTramos: rejilla.radioInscritoM / rejilla.tramoM,
    vocabulario: cupos.parajes.vocabulario,
    // La fuente de relleno es opcional y su ausencia es el caso normal: sin ella la
    // celda se genera igual y queda registrada como generada sin relleno.
    ...(places ? { places } : {}),
    ...(onStatus ? { onStatus } : {}),
  });

  // Una celda vacía se registra igual: el mundo tiene que existir donde estás, y
  // una celda que no se registra se volvería a intentar generar en cada paso.
  const sinContenidoJugable = mundo.geo.roads.length === 0 && mundo.anchors.length === 0;

  return congelaHondo({
    celda: { i: celda.i, j: celda.j },
    clave: claveDeCelda(celda),
    ladoM: rejilla.ladoM,
    radioInscritoM: rejilla.radioInscritoM,
    anclaje: { lat: rejilla.anclaje.lat, lon: rejilla.anclaje.lon },
    semillaPartida,
    semillaCelda,
    mapaId,
    motivo,
    limites,
    centro,
    tramoM: tramoDeLaCelda,
    cupos,
    sinContenidoJugable,
    mundo,
  });
}
