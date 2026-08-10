// El único sitio de la app donde las orquestaciones que no generan nada cogen el
// generador. Reúne lo que cada una necesita y lo entrega como una pieza más, igual que
// `plataforma/index.js` reúne los módulos de plataforma para inyectarlos en el registro.
//
// Existe por una razón medida (SPEC-020): mientras `app/mapa/levantamiento.js` y
// `app/salida/preparacion.js` citaban `@walkingadventure/nucleo` por su cuenta, cinco
// ficheros de `test/nucleo/` dejaban de cargar en cuanto faltaba `node_modules` —sesenta
// y siete casos que ni se descubrían—, y el guardián de SPEC-001 no lo veía porque solo
// mira los imports directos de `test/nucleo/` y `test/dobles/`, nunca el cierre
// transitivo por `app/`. Reunir aquí las importaciones deja las orquestaciones
// alcanzables desde `node --test` sin resolver nada instalado, y a la vez mantiene lo que
// pide SPEC-020: la app consume el generador **por el nombre del paquete**, jamás por una
// ruta relativa.
//
// SPEC-039 estrenó la misma regresión y por eso hay tres bloques más abajo: `copia.js`,
// `empaquetador.js` y `reglas-de-respaldo.js` citaban el paquete por su cuenta y dejaban
// sin verificar el fichero de partida entero —los 175 264 B, las dos exportaciones
// idénticas, el fichero truncado, el aviso de sustitución y la cobertura del respaldo—,
// que solo se pudo afirmar leyendo su fuente. La lección es la de siempre: **quien
// orquesta recibe el generador, quien lo monta lo importa**, y quien lo monta es este
// fichero.
//
// Quien quiera un núcleo doblado —o a medias, para comprobar que se protesta al
// construir— arma el suyo con otras funciones; por eso son objetos de datos y no un
// singleton escondido.

import { componeEscena } from '@walkingadventure/nucleo/render/escena.js';
import { ESTILO_POR_DEFECTO } from '@walkingadventure/nucleo/render/estilos.js';
import {
  CLAVES,
  cargaCelda,
  cargaMapa,
  celdaAbierta,
  celdasAbiertas,
  completaCelda,
  creaMapa,
  guardaCelda,
  guardaIndice,
  guardaMapa,
  listaMapas,
  pisa,
  resuelvePosicion,
} from '@walkingadventure/nucleo/partida/mapa.js';
import {
  ACCIONES as ACCIONES_DEL_OFRECIMIENTO,
  ALCANCE_EN_TRAMOS,
  ESTADOS_DE_APERTURA,
  SIN_MAPA_ACTIVO,
  TESTIDS as TESTIDS_DE_MAPAS,
  componeOfrecimiento,
  hayQueOfrecerMapa,
  listaDeMapas,
  resuelveMapaActivo,
} from '@walkingadventure/nucleo/partida/mapas.js';
import { claveDeCelda, creaRejilla } from '@walkingadventure/nucleo/world/rejilla.js';
import {
  PRESUPUESTO_PREPARACION_MS,
  declaraAusencia,
  declaraIlustracion,
  declaraTexto,
  ordenaRecursos,
  planDeIlustraciones,
  recursosVacios,
} from '@walkingadventure/nucleo/partida/recursos.js';
import { componePreparacion, resumenDeLaPreparacion } from '@walkingadventure/nucleo/partida/preparacion.js';
import { redactaAventura } from '@walkingadventure/nucleo/quests/narrador.js';
import { VERSION_FORMATO, texto as textoCanonico } from '@walkingadventure/nucleo/partida/formato.js';
import {
  CLASES_DE_PARTE,
  NOMBRE_DEL_MANIFIESTO,
  PREFIJOS_DE_LA_PARTIDA,
  componeExportacion,
  importaPartida,
  manifiestoDe,
  medidaPorClaseDeParte,
  nombreDeFichero,
  parteDeDocumento,
  validaManifiesto,
} from '@walkingadventure/nucleo/partida/exportacion.js';
import { CADENA_DEL_FORMATO, migra } from '@walkingadventure/nucleo/partida/migracion.js';
import {
  ACCIONES as ACCIONES_DEL_ZURRON,
  MOTIVOS_SIN_ZURRON,
  TESTIDS as TESTIDS_DEL_ZURRON,
  TOPE_DE_ENTRADAS,
  abreElZurron,
  vaciaElZurron,
} from '@walkingadventure/nucleo/partida/zurron.js';
import { AJUSTES_DE_ORIGEN, cambiaAjuste } from '@walkingadventure/nucleo/partida/ajustes.js';
import { kilometrosDeFondo, tamanoDeLaReserva } from '@walkingadventure/nucleo/partida/kilometros.js';
import { REGISTROS, coloca, textoConRegistro } from '@walkingadventure/nucleo/lenguaje/registro.js';
import {
  ACCIONES,
  DESTINO_TRAS_BORRAR,
  ESTADOS_DE_EMPEZAR,
  SITIO,
  TESTIDS,
  borraPartida,
  componeEmpezarDeNuevo,
  exigeSinBorradoAMedias,
  hayBorradoAMedias,
  loQueSePierde,
  mapasDeLaPartida,
  terminaBorradoPendiente,
} from '@walkingadventure/nucleo/partida/borrado.js';

/** Lo que `creaLevantamiento` enumera en `DEL_NUCLEO`, ni una función más. */
export const NUCLEO_DEL_LEVANTAMIENTO = Object.freeze({
  componeEscena,
  ESTILO_POR_DEFECTO,
  CLAVES,
  cargaCelda,
  cargaMapa,
  celdaAbierta,
  celdasAbiertas,
  creaMapa,
  guardaMapa,
  listaMapas,
  pisa,
  claveDeCelda,
  creaRejilla,
  // SPEC-041. Otra vez por aquí y por lo mismo (§6u): el mapa activo, la apertura de
  // celdas vecinas y la lista de mapas tienen que poder leerse desde `node --test` sin
  // resolver nada instalado, que es el único sitio donde «no existe ninguna operación
  // que fije el mapa activo» y «el contador es por mapa» se pueden poner rojos.
  completaCelda,
  guardaCelda,
  guardaIndice,
  resuelvePosicion,
  resuelveMapaActivo,
  listaDeMapas,
  ESTADOS_DE_APERTURA,
  SIN_MAPA_ACTIVO,
});

/** Lo que la pantalla del ofrecimiento necesita del núcleo, ni una función más. */
export const NUCLEO_DEL_OFRECIMIENTO = Object.freeze({
  ACCIONES_DEL_OFRECIMIENTO,
  TESTIDS_DE_MAPAS,
  ALCANCE_EN_TRAMOS,
  SIN_MAPA_ACTIVO,
  componeOfrecimiento,
  hayQueOfrecerMapa,
});

/** Lo que `creaPreparacion` enumera en su `DEL_NUCLEO`, ni una función más. */
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

/**
 * Lo que `creaZurron` enumera en su `DEL_NUCLEO`, ni una función más.
 *
 * SPEC-042 entra por la misma puerta y por lo mismo (§6u): si hay zurrón, cuántas entradas
 * trae, que sean como mucho cinco, que caigan a plantilla cuando el narrador falla y que la
 * reserva se vacíe con su hecho y entera tienen que poder leerse desde `node --test` sin
 * resolver nada instalado, que es el único sitio donde se pueden poner rojos.
 */
export const NUCLEO_DEL_ZURRON = Object.freeze({
  abreElZurron,
  vaciaElZurron,
  TESTIDS: TESTIDS_DEL_ZURRON,
  ACCIONES: ACCIONES_DEL_ZURRON,
  TOPE_DE_ENTRADAS,
  MOTIVOS_SIN_ZURRON,
});

/** Lo que `creaPasosDeFondo` enumera en su `DEL_NUCLEO`, ni una función más. */
export const NUCLEO_DE_LOS_PASOS_DE_FONDO = Object.freeze({
  kilometrosDeFondo,
  tamanoDeLaReserva,
  AJUSTES_DE_ORIGEN,
  cambiaAjuste,
});

/** Lo único que el contenedor necesita del núcleo: cómo se llama el manifiesto. */
export const NUCLEO_DEL_CONTENEDOR = Object.freeze({ NOMBRE_DEL_MANIFIESTO });

/** Lo que `creaCopia` enumera en `DEL_NUCLEO`, ni una función más. */
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

/**
 * Lo que las reglas de respaldo necesitan: la lista única de prefijos de la partida.
 *
 * Va por aquí y no por un import propio precisamente porque la gracia de las reglas es
 * derivar de esa lista y no copiarla; lo que no puede es arrastrar el paquete consigo.
 */
export const NUCLEO_DEL_RESPALDO = Object.freeze({ PREFIJOS_DE_LA_PARTIDA });

/**
 * Lo que `creaEmpezarDeNuevo` enumera en `DEL_NUCLEO`, ni una función más.
 *
 * SPEC-040 vuelve a pasar por la misma puerta y por la misma razón (§6u): la frase que
 * enumera lo que se pierde y el encadenado del borrado con la copia tienen que poder
 * leerse desde `node --test` sin resolver nada instalado, que es el único sitio donde
 * «no enumera ceros» y «si la copia falla no se borra» se pueden poner rojos.
 */
export const NUCLEO_DE_EMPEZAR_DE_NUEVO = Object.freeze({
  REGISTROS,
  coloca,
  textoConRegistro,
  ESTADOS_DE_EMPEZAR,
  TESTIDS,
  ACCIONES,
  DESTINO_TRAS_BORRAR,
  SITIO,
  componeEmpezarDeNuevo,
  loQueSePierde,
  mapasDeLaPartida,
  borraPartida,
  terminaBorradoPendiente,
  exigeSinBorradoAMedias,
  hayBorradoAMedias,
});
