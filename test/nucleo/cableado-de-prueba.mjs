// Los dos bundles del núcleo que SPEC-049 mete por la puerta, armados **por ruta relativa**,
// y el andar de un lazo entero **por la capa de la app**.
//
// Existe por lo de siempre (§6u de `pipeline/decisiones-orquestador.md`): `app/nucleo/piezas.js`
// cita el paquete por su nombre —`@walkingadventure/nucleo`— y no resuelve sin `node_modules`,
// y la batería de núcleo tiene que arrancar entera en un clon limpio sin instalar nada. Así que
// las pruebas arman el mismo bundle por su ruta, y que las dos listas digan lo mismo se
// comprueba leyendo la fuente, que es lo que impide que esta se quede atrás.
//
// Aquí no se dobla nada: son las funciones de verdad del paquete y las capas de verdad de la
// app. Lo único que cambia respecto a producción es por dónde se importan y de dónde salen las
// posiciones — que aquí se fabrican en vez de venir del sensor.
//
// **El lazo se anda, no se teletransporta**, por la misma razón que en
// `test/nucleo/bucle-completo.test.mjs`: entre beat y beat se emiten posiciones clasificadas
// `andando` a cinco kilómetros por hora y en cada beat una parada de la permanencia entera. Es
// lo único que hace que el geofence, la permanencia y la guarda del sitio ya visitado
// participen de verdad. La diferencia con aquel fichero es la que esta fila vino a cerrar:
// allí se llamaba a `creaLlegadas` y a `resuelveBeat` del paquete, y aquí se llama a
// `creaLasLlegadas` y a `creaLaAventuraEnCurso` de `app/`, que es lo que la app monta.

import { creaLaAventuraEnCurso } from '../../app/marcha/aventura.js';
import { creaElCasting } from '../../app/marcha/casting.js';
import { creaLasLlegadas, repartoDeLaAventuraEnCurso } from '../../app/marcha/llegadas.js';
import { acepta, aventuraEnCurso, resuelveBeat } from '../../packages/nucleo/partida/aventura-en-curso.js';
import { echaElTelon, piezasDeSerie } from '../../packages/nucleo/partida/cierre-de-salida.js';
import { apuntaHaberEstado, libroDePendientes } from '../../packages/nucleo/partida/conocimiento.js';
import { anclajesDe, hayDescartes, vistaDeAnclajes, vistaDeDescartes } from '../../packages/nucleo/partida/descartes.js';
import { entradasDe, proyeccion } from '../../packages/nucleo/partida/diario.js';
import { estadoInicial } from '../../packages/nucleo/partida/estado.js';
import { registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { PARADA_DENTRO_MS, sitiosConPosicion } from '../../packages/nucleo/partida/llegadas.js';
import { identidadDeCara } from '../../packages/nucleo/partida/npcs.js';
import { SIN_OBJETOS, vistaDeTenencia } from '../../packages/nucleo/partida/objetos.js';
import { estadoDeMapa } from '../../packages/nucleo/partida/pasos.js';
import { abreSalida, salidaAbierta, VIAS_DE_CIERRE } from '../../packages/nucleo/partida/salida-abierta.js';
import { MOTIVOS_DE_CIERRE, telonPendiente } from '../../packages/nucleo/partida/salidas.js';
import { componeElTelon } from '../../packages/nucleo/partida/telon.js';
import { creaDetectorDeTransporte } from '../../packages/nucleo/partida/transporte.js';
import { CATALOGO } from '../../packages/nucleo/quests/catalogo.js';
import { componeElDesenlace, repuestoDe } from '../../packages/nucleo/quests/desenlace.js';
import { castAll } from '../../packages/nucleo/quests/casting.js';
import { componeEscena, componeLoQueTeLlevas } from '../../packages/nucleo/quests/escena.js';
import { namesFor } from '../../packages/nucleo/names/index.js';
import { relojDePared } from '../dobles/reloj-de-pared.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { NUCLEO_DE_LAS_LLEGADAS } from './llegadas-de-prueba.mjs';
import { celdaDeFixture } from './partida-de-prueba.mjs';

/** Lo mismo que `NUCLEO_DEL_CASTING` de `app/nucleo/piezas.js`, ni una función más. */
export const NUCLEO_DEL_CASTING = Object.freeze({
  castAll,
  vistaDeDescartes,
  vistaDeAnclajes,
  hayDescartes,
});

/** El resolutor del casting vigente, montado como lo monta `App.js`. */
export const elCasting = () => creaElCasting({ nucleo: NUCLEO_DEL_CASTING });

/** Lo mismo que `NUCLEO_DE_LA_AVENTURA_EN_CURSO` de `app/nucleo/piezas.js`, ni una función más. */
export const NUCLEO_DE_LA_AVENTURA_EN_CURSO = Object.freeze({
  aventuraEnCurso,
  resuelveBeat,
  componeEscena,
  componeLoQueTeLlevas,
  identidadDeCara,
  namesFor,
  vistaDeTenencia,
});

/** Lo mismo que `NUCLEO_DEL_CIERRE_DE_SALIDA` de `app/nucleo/piezas.js`, ni una función más. */
export const NUCLEO_DEL_CIERRE_DE_SALIDA = Object.freeze({
  echaElTelon,
  piezasDeSerie,
  componeElTelon,
  componeElDesenlace,
  repuestoDe,
  salidaAbierta,
  aventuraEnCurso,
  telonPendiente,
  libroDePendientes,
  apuntaHaberEstado,
  sitiosConPosicion,
  entradasDe,
  proyeccion,
  estadoDeMapa,
  namesFor,
  CATALOGO,
  VIAS_DE_CIERRE,
  MOTIVOS_DE_CIERRE,
});

/** El minuto del día con el que se resuelven los beats de franja. Fijo e inyectado. */
export const MEDIODIA = 12 * 60;

/** A cinco kilómetros por hora, que es el ritmo con el que este juego se anda. */
const VELOCIDAD_MS = 1.39;

/** Desde dónde se sale: lo bastante lejos del primer beat para no estar ya dentro. */
const LEJOS_M = 300;

/** El fijo bueno de la tabla de §9c, que es lo que sostiene la ventana corta de parada. */
const FIJO_BUENO_M = 3;

/** El día del calendario con el que se juega. Llega inyectado: el núcleo no lee el reloj. */
export const DIA = 1;

/** Posiciones de quien anda de un punto a otro, clasificadas «andando». */
function andaDesde(desde, hasta, tMs, { cadaMs = 2000 } = {}) {
  const dx = hasta.x - desde.x;
  const dy = hasta.y - desde.y;
  const metros = Math.hypot(dx, dy);
  if (metros < 1) return [];
  const duracionS = metros / VELOCIDAD_MS;
  const posiciones = [];
  for (let t = cadaMs; t < duracionS * 1000; t += cadaMs) {
    const recorrido = ((t / 1000) * VELOCIDAD_MS) / metros;
    posiciones.push({ x: desde.x + dx * recorrido, y: desde.y + dy * recorrido, tMs: tMs + t, precisionM: FIJO_BUENO_M, clasificacion: 'andando' });
  }
  posiciones.push({ x: hasta.x, y: hasta.y, tMs: tMs + Math.round(duracionS * 1000), precisionM: FIJO_BUENO_M, clasificacion: 'andando' });
  return posiciones;
}

/** Posiciones de quien se para en un punto el tiempo de permanencia entero. */
function seParaEn(punto, tMs, { cadaMs = 5000, duracionMs = PARADA_DENTRO_MS } = {}) {
  const posiciones = [];
  for (let t = cadaMs; t <= duracionMs; t += cadaMs) posiciones.push({ x: punto.x, y: punto.y, tMs: tMs + t, precisionM: FIJO_BUENO_M, clasificacion: 'parada' });
  return posiciones;
}

/** La aventura casteada de una plantilla dentro de un mundo congelado, o `null`. */
export const casteadaDe = (mundo, plantilla) => (mundo?.casting ?? []).find((c) => c.ok && c.plantilla === plantilla) ?? null;

/** La primera aventura casteada que cumple lo que pida el caso. */
export function unaAventuraDe(mundo, cumple = () => true) {
  return (mundo.casting ?? []).find((c) => c.ok && cumple(c)) ?? null;
}

/**
 * Una partida abierta sobre un mundo de fixture, con su salida abierta y —si se pide— su
 * aventura aceptada en el motor, **por el mismo camino que `antes-de-salir.jsx`**: se abre el
 * registro de la salida con la identidad que compone `app/marcha/identidad.js` y se acepta la
 * casteada que el mundo congelado trae.
 */
export async function partidaAbierta({ nombre = 'costero', plantilla = null, cumple = null, salida = 'casa/s1' } = {}) {
  const celda = await celdaDeFixture(nombre);
  const mundo = celda.mundo;
  const casteada = plantilla ? casteadaDe(mundo, plantilla) : cumple ? unaAventuraDe(mundo, cumple) : null;
  const estado = estadoInicial({ semilla: SEMILLA_A });
  const registro = registroInicial();
  abreSalida(estado.aventuras, { salida, mapaId: celda.mapaId, ...(casteada ? { aventura: casteada.aventura.id } : {}) });
  if (casteada) {
    acepta(estado.aventuras, {
      aventura: casteada.aventura,
      mapaId: celda.mapaId,
      registro,
      dia: DIA,
      paso: estadoDeMapa(estado.pasos, celda.mapaId).n,
      // Contra qué sitios marcados se casteó, por la misma puerta que `antes-de-salir.jsx`.
      descartes: anclajesDe(vistaDeDescartes(estado.anclajes, celda.mapaId)),
    });
  }
  return { celda, mundo, cupos: celda.cupos, mapaId: celda.mapaId, salida, estado, registro, casteada };
}

/**
 * La capa de llegadas de la app con su motor de aventura en curso colgado, montada como la
 * monta `App.js`: el reparto **recuperado del mundo congelado** y no traído con la salida.
 */
export function capaDeLaApp({ mundo, cupos = null, mapaId, salida, estado, registro, reloj = relojDePared(MEDIODIA), conMotor = true }) {
  const reparto = repartoDeLaAventuraEnCurso({ mundo, aventuras: estado.aventuras });
  const aventura = conMotor
    ? creaLaAventuraEnCurso({ nucleo: NUCLEO_DE_LA_AVENTURA_EN_CURSO, mundo, estado, reparto, reloj })
    : null;
  const llegadas = creaLasLlegadas({
    nucleo: NUCLEO_DE_LAS_LLEGADAS,
    mundo,
    cupos,
    mapaId,
    salida,
    estado,
    registro,
    detector: creaDetectorDeTransporte(),
    reparto,
    dia: DIA,
    aventura,
  });
  return { llegadas, aventura, reparto };
}

/**
 * Anda el lazo de la aventura aceptada **por la capa de la app**, de la primera parada a la
 * última, atendiendo las escenas que esperan como las atiende una persona: mirar lo que
 * espera, leerlo entero y cerrar su paso.
 *
 * @returns `{ terminada, resueltos, montajes, validadas }`. `montajes` son los montajes de
 *   paso de beat que se compusieron por el camino, que es donde vive A4P3.
 */
export function andaElLazoConLaApp({ mundo, cupos = null, casteada, mapaId, salida, estado, registro, reloj = relojDePared(MEDIODIA), hastaBeat = null }) {
  const { llegadas, aventura } = capaDeLaApp({ mundo, cupos, mapaId, salida, estado, registro, reloj });
  const beats = casteada.aventura.beats;
  const montajes = [];
  const validadas = [];

  let tMs = 0;
  let donde = { x: beats[0].lugar.x + LEJOS_M, y: beats[0].lugar.y + LEJOS_M };

  for (const beat of beats.slice(0, hastaBeat ?? beats.length)) {
    const destino = { x: beat.lugar.x, y: beat.lugar.y };
    const camino = andaDesde(donde, destino, tMs);
    if (camino.length) tMs = camino[camino.length - 1].tMs;
    const quieta = seParaEn(destino, tMs);
    tMs = quieta[quieta.length - 1].tMs;
    donde = destino;

    for (const llegada of llegadas.comprueba([...camino, ...quieta]).validadas) validadas.push(llegada);

    let vueltas = 0;
    while (llegadas.espera()) {
      if (++vueltas > beats.length * 8) throw new Error(`las escenas de "${casteada.plantilla}" no se acaban de cerrar: ${vueltas} vueltas`);
      let paso;
      do {
        const montaje = llegadas.montaje();
        if (montaje?.beat) montajes.push(montaje);
        paso = llegadas.avanza();
      } while (!paso.cerrada);
    }
  }

  const enCurso = aventuraEnCurso(estado.aventuras);
  return {
    llegadas,
    aventura,
    montajes,
    validadas,
    terminada: enCurso !== null && enCurso.beatEnCurso === null,
    resueltos: enCurso?.resueltos.length ?? 0,
  };
}

/** La tenencia vacía, para las composiciones que no van por un beat de objeto. */
export { SIN_OBJETOS };
