// Las piezas del generador que SPEC-047 inyecta, armadas **por ruta relativa**.
//
// Existe por la misma razón que `copia-de-prueba.mjs` y por el criterio duro de §6u: la
// batería de núcleo tiene que arrancar en un clon limpio sin instalar nada, y
// `app/nucleo/piezas.js` cita `@walkingadventure/nucleo` por el nombre del paquete.
// Importarlo desde aquí dejaría este fichero —y con él todo lo que de verdad se puede
// afirmar de la fila 47— sin cargar en cuanto faltara `node_modules`, y el guardián de
// SPEC-001 no lo vería porque solo mira los imports directos.
//
// Son las mismas funciones, cogidas del mismo sitio: lo único que cambia es cómo se
// nombran los ficheros.

import { congelaEstado, estadoInicial, levantaEstado } from '../../packages/nucleo/partida/estado.js';
import { cuantosHechos, levantaRegistro, registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { CLAVES_DE_PARTIDA, cargaPartida, guardaPartida } from '../../packages/nucleo/partida/reconstruccion.js';
import {
  CLAVE_DE_PROCEDENCIA,
  PROCEDENCIAS,
  documentoDeProcedencia,
  exigeSinImportacionAMedias,
} from '../../packages/nucleo/partida/exportacion.js';
import { CADENA_DEL_FORMATO, migra } from '../../packages/nucleo/partida/migracion.js';
import { VERSION_FORMATO, lee, texto as textoCanonico } from '../../packages/nucleo/partida/formato.js';
import { cargaCelda, cargaMapa, celdasAbiertas, listaMapas } from '../../packages/nucleo/partida/mapa.js';

/** Lo que `creaPartidaGuardada` enumera en `DEL_NUCLEO`, ni una función más. */
export const NUCLEO_DE_LA_PARTIDA_GUARDADA = Object.freeze({
  CLAVES_DE_PARTIDA,
  CLAVE_DE_PROCEDENCIA,
  PROCEDENCIAS,
  CADENA_DEL_FORMATO,
  VERSION_FORMATO,
  congelaEstado,
  levantaEstado,
  levantaRegistro,
  registroInicial,
  estadoInicial,
  guardaPartida,
  cargaPartida,
  cuantosHechos,
  migra,
  documentoDeProcedencia,
  exigeSinImportacionAMedias,
  lee,
  textoCanonico,
});

/** Lo que `mundoDeLaPartida` enumera en su `DEL_NUCLEO`, ni una función más. */
export const NUCLEO_DEL_MUNDO_GUARDADO = Object.freeze({ listaMapas, cargaMapa, cargaCelda, celdasAbiertas });
