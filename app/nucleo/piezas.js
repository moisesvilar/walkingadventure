// El único sitio de la app donde la orquestación del mapa y la de la salida cogen el
// generador. Reúne lo que cada una necesita y lo entrega como una pieza más, igual que
// `plataforma/index.js` reúne los módulos de plataforma para inyectarlos en el registro.
//
// Existe por una razón medida (SPEC-020): mientras `app/mapa/levantamiento.js` y
// `app/salida/preparacion.js` citaban `@walkingadventure/nucleo` por su cuenta, cinco
// ficheros de `test/nucleo/` dejaban de cargar en cuanto faltaba `node_modules` —sesenta
// y siete casos que ni se descubrían—, y el guardián de SPEC-001 no lo veía porque solo
// mira los imports directos de `test/nucleo/` y `test/dobles/`, nunca el cierre
// transitivo por `app/`. Reunir aquí las importaciones deja las dos orquestaciones
// alcanzables desde `node --test` sin resolver nada instalado, y a la vez mantiene lo que
// pide SPEC-020: la app consume el generador **por el nombre del paquete**, jamás por una
// ruta relativa.
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
  creaMapa,
  guardaMapa,
  listaMapas,
  pisa,
} from '@walkingadventure/nucleo/partida/mapa.js';
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
