// SPEC-039 · Lo que hace falta para tener delante **una partida entera**: dos mapas
// con su índice y sus celdas, el estado con su personaje y su diario, el registro de
// hechos y un recurso binario residente con su texto de narrador dentro.
//
// Existe porque casi todos los criterios de esta fila —exportar, importar, medir,
// comprobar que no hay rastro de ubicación— empiezan por la misma frase: «dada una
// partida con dos mapas». Escribirla a mano en cada fichero garantizaba que las cuatro
// copias divergieran, y una partida de prueba que no es la misma en dos ficheros hace
// que «byte a byte» deje de significar nada.
//
// Nada de aquí toca la red ni el reloj: los mundos son sintéticos, el azar sale de la
// semilla y los bytes del binario están escritos a mano.

import { CLAVES, abreCelda, creaMapa, guardaCelda, guardaIndice, guardaMapa } from '../../packages/nucleo/partida/mapa.js';
import { estadoInicial } from '../../packages/nucleo/partida/estado.js';
import { anexa, hecho, registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { aplicaHechos, guardaPartida } from '../../packages/nucleo/partida/reconstruccion.js';
import { declaraIlustracion, declaraTexto, recursosVacios } from '../../packages/nucleo/partida/recursos.js';
import { creaAlmacenDeBinarios } from '../../app/recursos/almacen-de-binarios.js';
import { VERSION_FORMATO, texto as textoCanonico } from '../../packages/nucleo/partida/formato.js';
import {
  CLASES_DE_PARTE,
  NOMBRE_DEL_MANIFIESTO,
  componeExportacion,
  importaPartida,
  manifiestoDe,
  medidaPorClaseDeParte,
  nombreDeFichero,
  parteDeDocumento,
  validaManifiesto,
} from '../../packages/nucleo/partida/exportacion.js';
import { CADENA_DEL_FORMATO, migra } from '../../packages/nucleo/partida/migracion.js';
import { SEMILLA_A, consultaSintetica } from './celda-de-prueba.mjs';
import { hechosDeUnaSalida } from './diario-de-prueba.mjs';
import { almacenEnMemoria } from './partida-de-prueba.mjs';

export { SEMILLA_A };
export { almacenEnMemoria };

/**
 * El generador armado como la pieza que `creaCopia` exige en su `DEL_NUCLEO`, y el
 * nombre del manifiesto que exige el contenedor.
 *
 * Es el mismo objeto que arma `app/nucleo/piezas.js` para la app —`NUCLEO_DE_LA_COPIA`
 * y `NUCLEO_DEL_CONTENEDOR`—, con la diferencia deliberada de siempre: allí las
 * importaciones citan el paquete por su nombre y aquí van por ruta relativa. Es lo que
 * deja estas pruebas arrancando sin resolver ningún especificador instalado, y por eso
 * el bundle se arma aquí en vez de importarse de `piezas.js`.
 */
export const NUCLEO_DE_LA_COPIA = Object.freeze({
  VERSION_FORMATO,
  textoCanonico,
  CLASES_DE_PARTE,
  NOMBRE_DEL_MANIFIESTO,
  componeExportacion,
  importaPartida,
  manifiestoDe,
  medidaPorClaseDeParte,
  nombreDeFichero,
  parteDeDocumento,
  validaManifiesto,
  CADENA_DEL_FORMATO,
  migra,
});

/** Lo único que el contenedor necesita del núcleo: cómo se llama la primera parte. */
export const NUCLEO_DEL_CONTENEDOR = Object.freeze({ NOMBRE_DEL_MANIFIESTO });

/** El mapa de casa y el de las vacaciones. Dos anclajes lejanos: dos identificadores. */
export const ANCLAJE_DE_CASA = Object.freeze({ lat: 42.407163, lon: -8.809274 });
export const ANCLAJE_DE_VACACIONES = Object.freeze({ lat: 43.362343, lon: -8.411540 });

/** Los bytes del recurso binario residente. Escritos a mano: ni azar ni reloj. */
export const BYTES_DE_ILUSTRACION = Object.freeze([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03]);

/** El texto del narrador que viaja dentro del documento de la celda. */
export const TEXTO_DEL_NARRADOR = 'La aldea suena a campanas incluso cuando calla.';

/**
 * La capa de recursos de una celda: un texto del narrador cacheado y una ilustración
 * residente que cita el binario por su referencia.
 */
export function recursosDePrueba(referencia) {
  const capa = recursosVacios();
  capa.textos = [declaraTexto({ clave: 'nucleo:Monfrida', texto: TEXTO_DEL_NARRADOR, origen: 'llm' })];
  capa.ilustraciones = [declaraIlustracion({ elemento: 'nucleo:Monfrida', prompt: 'una aldea de piedra al amanecer', recurso: referencia })];
  return capa;
}

/** Un mapa con una celda abierta y guardado entero en el almacén. */
export async function mapaGuardado({ almacen, arranque, semilla = SEMILLA_A, tramoM = 2000, recursos = null }) {
  const mapa = creaMapa({ semilla, ...arranque, tramoM });
  const consultaOsm = consultaSintetica(mapa.rejilla);
  await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
  if (recursos) {
    await guardaCelda(mapa, { i: 0, j: 0 }, { almacen, recursos });
    await guardaIndice(mapa, { almacen });
  } else {
    await guardaMapa(mapa, { almacen });
  }
  return mapa;
}

/**
 * Una partida entera: dos mapas, el estado con personaje y diario, el registro de
 * hechos y un recurso binario residente.
 *
 * El almacén y el de binarios entran por fuera para poder montar la misma partida
 * sobre el de memoria y sobre el duradero, que es la mitad de lo que esta fila viene
 * a comprobar.
 */
export async function partidaCompleta({ almacen = almacenEnMemoria(), binarios = creaAlmacenDeBinarios(), semilla = SEMILLA_A } = {}) {
  const referencia = binarios.guarda('monfrida-amanecer', Uint8Array.from(BYTES_DE_ILUSTRACION));

  const casa = await mapaGuardado({ almacen, arranque: ANCLAJE_DE_CASA, semilla, recursos: recursosDePrueba(referencia) });
  const vacaciones = await mapaGuardado({ almacen, arranque: ANCLAJE_DE_VACACIONES, semilla });

  const estado = estadoInicial({ semilla });
  estado.personaje.nombre = 'Sabela';
  estado.personaje.oficio = 'botica';
  estado.personaje.oficioPermanente = true;

  const registro = registroInicial();
  const lote = hechosDeUnaSalida({ mapa: casa.id, dia: 1, paso: 1 });
  anexa(registro, lote);
  aplicaHechos(estado, lote.map((h) => hecho(h)));

  await guardaPartida({ estado, registro, almacen });

  return { almacen, binarios, estado, registro, casa, vacaciones, referencia, semilla };
}

/**
 * Los días de juego de la partida con la que se mide el tamaño del fichero.
 *
 * Mil, que es la cifra que pide el criterio de tamaño de SPEC-039, y son mil de verdad:
 * tres hechos por salida, uno por día. Va aquí y no dentro de una prueba porque medir
 * el fichero y comprobar el presupuesto de SPEC-016 son dos afirmaciones sobre **la
 * misma** partida, y dos fixtures parecidos harían que dejaran de serlo.
 */
export const DIAS_DE_LA_PARTIDA_LARGA = 1000;

/** Anexa las salidas de los días 2..n a una partida ya montada, y la deja guardada. */
export async function conSalidasHastaElDia(partida, dia = DIAS_DE_LA_PARTIDA_LARGA) {
  for (let d = 2; d <= dia; d += 1) {
    const lote = hechosDeUnaSalida({ mapa: partida.casa.id, dia: d, paso: d });
    anexa(partida.registro, lote);
    aplicaHechos(partida.estado, lote.map((h) => hecho(h)));
  }
  await guardaPartida({ estado: partida.estado, registro: partida.registro, almacen: partida.almacen });
  return partida;
}

/** Las claves de mapa de una partida, para poder afirmar que están las de los dos. */
export function clavesDeMapa(mapa) {
  return [CLAVES.indice(mapa.id), CLAVES.celda(mapa.id, '0,0')];
}

/** Un volcado ordenado del almacén, que es lo que se compara «byte a byte». */
export async function volcado(almacen, prefijos = ['arranque/', 'camara/', 'mapa/', 'partida/']) {
  const salida = [];
  for (const prefijo of prefijos) {
    for (const clave of await almacen.lista(prefijo)) salida.push([clave, await almacen.lee(clave)]);
  }
  return salida.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
