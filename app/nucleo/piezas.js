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
// SPEC-049. Las dos mitades del beat —el motor que lo resuelve y la composición de sus dos
// pantallas— y las cuatro piezas del cierre. El `componeEscena` de `quests/` se renombra
// aquí: hay dos con ese nombre en el paquete —el que compone la escena de un beat y el que
// compone la escena de la lámina— y son cosas distintas.
import {
  componeEscena as componeLaEscenaDelBeat,
  componeLoQueTeLlevas,
  sinEscena,
  varianteDelBeat,
  ESCALA_DE_TEXTO,
  ESTADOS_DE_ESCENA,
  IDS_DE_TAMANO_DE_TEXTO,
  LO_QUE_LA_ESCENA_NO_LLEVA,
  TAMANO_DE_TEXTO_DE_ORIGEN,
  TESTIDS as TESTIDS_DE_LA_ESCENA,
  TEXTOS_DEL_TAMANO,
  exigeTamanoDeTexto,
  factorDeTamano,
  siguienteTamanoDeTexto,
} from '@walkingadventure/nucleo/quests/escena.js';
import { aventuraEnCurso, resuelveBeat } from '@walkingadventure/nucleo/partida/aventura-en-curso.js';
import {
  apuntaHaberEstado,
  entintadoDelMundo,
  libroDePendientes,
} from '@walkingadventure/nucleo/partida/conocimiento.js';
import { identidadDeCara } from '@walkingadventure/nucleo/partida/npcs.js';
import { vistaDeTenencia } from '@walkingadventure/nucleo/partida/objetos.js';
import { namesFor } from '@walkingadventure/nucleo/names/index.js';
import { echaElTelon, piezasDeSerie } from '@walkingadventure/nucleo/partida/cierre-de-salida.js';
import { componeElTelon } from '@walkingadventure/nucleo/partida/telon.js';
import { componeElDesenlace, repuestoDe } from '@walkingadventure/nucleo/quests/desenlace.js';
import { CATALOGO } from '@walkingadventure/nucleo/quests/catalogo.js';
import { salidaAbierta } from '@walkingadventure/nucleo/partida/salida-abierta.js';
import { entradasDe, proyeccion } from '@walkingadventure/nucleo/partida/diario.js';
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
import { congelaEstado, estadoInicial, levantaEstado } from '@walkingadventure/nucleo/partida/estado.js';
import { cuantosHechos, levantaRegistro, registroInicial } from '@walkingadventure/nucleo/partida/hechos.js';
import { CLAVES_DE_PARTIDA, cargaPartida, guardaPartida } from '@walkingadventure/nucleo/partida/reconstruccion.js';
import {
  CLAVE_DE_PROCEDENCIA,
  PROCEDENCIAS,
  documentoDeProcedencia,
  exigeSinImportacionAMedias,
} from '@walkingadventure/nucleo/partida/exportacion.js';
import { lee } from '@walkingadventure/nucleo/partida/formato.js';
import {
  ACCIONES as ACCIONES_DEL_ZURRON,
  MOTIVOS_SIN_ZURRON,
  TESTIDS as TESTIDS_DEL_ZURRON,
  TOPE_DE_ENTRADAS,
  abreElZurron,
  vaciaElZurron,
} from '@walkingadventure/nucleo/partida/zurron.js';
import { AJUSTES_DE_ORIGEN, cambiaAjuste } from '@walkingadventure/nucleo/partida/ajustes.js';
import {
  abreSalida,
  dejarloAqui,
  disponibilidadDelRotulo,
  estadoDelRotulo,
  marcaElTelonComoLeido,
  queOfreceAlAbrirLaApp,
  recibePosicion,
  reconciliaConElRotulo,
  retomaLaSalida,
  salidaEnCurso,
  situacionDeSalida,
  terminaDesdeElRotulo,
} from '@walkingadventure/nucleo/partida/salidas.js';
import { CADENCIAS, cadenciaDeMuestreo, creaLlegadas, sitiosConPosicion } from '@walkingadventure/nucleo/partida/llegadas.js';
import { PRESENTACIONES, creaVisor } from '@walkingadventure/nucleo/partida/visor.js';
import { creaCapaDeDescartes } from '@walkingadventure/nucleo/partida/descartes.js';
import { creaMicroEncuentros } from '@walkingadventure/nucleo/partida/microencuentros.js';
import { loQueSeCuentaEn } from '@walkingadventure/nucleo/partida/nucleos.js';
import { estadoDeMapa } from '@walkingadventure/nucleo/partida/pasos.js';
import { pisaSitio } from '@walkingadventure/nucleo/partida/estado.js';
import { cierraLaEscena } from '@walkingadventure/nucleo/partida/triangulacion.js';
import { MODOS, TIPOS_DE_PASO } from '@walkingadventure/nucleo/partida/secuencia.js';
import { componeRotulo } from '@walkingadventure/nucleo/partida/rotulo.js';
import { creaDetectorDeTransporte } from '@walkingadventure/nucleo/partida/transporte.js';
import { makeProjector } from '@walkingadventure/nucleo/core/geo.js';
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
 * Lo que `creaPartidaGuardada` enumera en `DEL_NUCLEO`, ni una función más.
 *
 * SPEC-047 entra por la misma puerta y por la misma razón que las cinco filas anteriores
 * (§6u): que la partida se congele solo cuando ha cambiado, que un documento migrado se
 * levante antes de escribirse y que uno ilegible dé la cara en vez de caer al estado
 * inicial tienen que poder leerse desde `node --test` sin resolver nada instalado, que es
 * el único sitio donde se pueden poner rojos.
 *
 * `congelaEstado` y `levantaEstado` viajan aquí por su nombre y no escondidos dentro de
 * `guardaPartida`/`cargaPartida`, porque la orquestación los llama de verdad: el primero
 * produce el sello con el que se decide si hace falta escribir, el segundo prueba que un
 * documento migrado se puede levantar **antes** de sustituir al bueno con él.
 */
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

/**
 * Lo que `creaLaSalida` enumera en su `DEL_NUCLEO`, ni una función más.
 *
 * SPEC-048 entra por la misma puerta que las siete filas anteriores (§6u): que haya una
 * sola suscripción al sensor, que el plazo retire el rótulo sin cerrar la salida, que
 * cerrar lo retire en la misma transición y que volver a casa en autobús cierre igual
 * tienen que poder leerse desde `node --test` sin resolver nada instalado, que es el único
 * sitio donde se pueden poner rojos.
 *
 * `makeProjector` viaja aquí y no dentro de `seguidor.js` por lo mismo y por una razón
 * más: los metros del mundo se calculan **una vez y en el núcleo**, porque `geo.js`
 * cuantiza al proyectar y una trigonometría paralela en la app daría puntos que no cuadran
 * con los del mundo congelado.
 */
export const NUCLEO_DE_LA_SALIDA = Object.freeze({
  abreSalida,
  recibePosicion,
  reconciliaConElRotulo,
  retomaLaSalida,
  dejarloAqui,
  terminaDesdeElRotulo,
  marcaElTelonComoLeido,
  queOfreceAlAbrirLaApp,
  situacionDeSalida,
  estadoDelRotulo,
  salidaEnCurso,
  componeRotulo,
  disponibilidadDelRotulo,
  creaDetectorDeTransporte,
  makeProjector,
  // SPEC-044, y por la misma puerta que las ocho filas anteriores (§6u): que fuera de un
  // geofence la cadencia siga siendo la de SPEC-048, que dentro pase a ser por tiempo y que
  // la histéresis impida cambiarla en cada muestra del borde tienen que poder leerse desde
  // `node --test` sin resolver nada instalado.
  sitiosConPosicion,
  cadenciaDeMuestreo,
  CADENCIAS,
});

/**
 * Lo que `creaLasLlegadas` enumera en su `DEL_NUCLEO`, ni una función más.
 *
 * SPEC-044 entra por la misma puerta que las nueve filas anteriores (§6u): que una parada
 * dentro del geofence valide, que atravesarlo andando no, que la secuencia se recorra entera
 * y en orden, que un paso sin pantalla se enseñe en vez de saltarse y que marcar un anclaje
 * no resiembre el mapa tienen que poder leerse desde `node --test` sin resolver nada
 * instalado, que es el único sitio donde se pueden poner rojos.
 */
export const NUCLEO_DE_LAS_LLEGADAS = Object.freeze({
  creaLlegadas,
  creaVisor,
  creaCapaDeDescartes,
  creaMicroEncuentros,
  loQueSeCuentaEn,
  estadoDeMapa,
  pisaSitio,
  cierraLaEscena,
  PRESENTACIONES,
  TIPOS_DE_PASO,
  MODOS,
});

/**
 * Lo que `creaLaAventuraEnCurso` enumera en su `DEL_NUCLEO`, ni una función más.
 *
 * SPEC-049 entra por la misma puerta que las diez filas anteriores (§6u): que cerrar el paso
 * de un beat resuelva **el que toca**, que uno que no toca se quede esperando sin que la app
 * falle, que la escena se componga con su cara y su cierre por resultado y que resolver dos
 * veces el mismo beat no duplique ningún hecho tienen que poder leerse desde `node --test` sin
 * resolver nada instalado, que es el único sitio donde se pueden poner rojos.
 */
export const NUCLEO_DE_LA_AVENTURA_EN_CURSO = Object.freeze({
  aventuraEnCurso,
  resuelveBeat,
  componeEscena: componeLaEscenaDelBeat,
  componeLoQueTeLlevas,
  identidadDeCara,
  namesFor,
  vistaDeTenencia,
});

/**
 * Lo que `echaElTelonDeLaSalida` enumera en su `DEL_NUCLEO`, ni una función más.
 *
 * SPEC-049 entra por la misma puerta que las diez filas anteriores (§6u): que el telón se
 * eche **una sola vez** por las tres vías, que el desenlace se componga desde la plantilla del
 * catálogo y la aventura casteada, que un cierre en corto use el repuesto que la plantilla
 * declara y que la ausencia de una de las seis piezas falle nombrándola tienen que poder
 * leerse desde `node --test` sin resolver nada instalado.
 *
 * `CATALOGO` viaja aquí y no se importa dentro del cierre porque es **la plantilla de la
 * aventura aceptada** una de las cuatro entradas de la frontera de inyección de esta fila: sin
 * ella el cierre echaría un telón sin desenlace, y lo que la spec pide es que falle nombrándola.
 */
export const NUCLEO_DEL_CIERRE_DE_SALIDA = Object.freeze({
  echaElTelon,
  piezasDeSerie,
  componeElTelon,
  componeElDesenlace,
  repuestoDe,
  salidaAbierta,
  aventuraEnCurso,
  entradasDe,
  proyeccion,
  entintadoDelMundo,
  namesFor,
  estadoDeMapa,
  CATALOGO,
});

/**
 * Lo que la escena de un beat y lo que te llevas necesitan del núcleo para pintarse: el
 * vocabulario cerrado, los identificadores y la escala de tamaño de texto.
 *
 * Va aparte del bloque de las llegadas porque lo consume la pantalla y no la orquestación:
 * lo que la capa compone es el dato, y esto es con lo que se dibuja y se recorre la escala.
 */
export const NUCLEO_DE_LA_ESCENA = Object.freeze({
  sinEscena,
  varianteDelBeat,
  ESCALA_DE_TEXTO,
  ESTADOS_DE_ESCENA,
  IDS_DE_TAMANO_DE_TEXTO,
  LO_QUE_LA_ESCENA_NO_LLEVA,
  TAMANO_DE_TEXTO_DE_ORIGEN,
  TESTIDS: TESTIDS_DE_LA_ESCENA,
  TEXTOS_DEL_TAMANO,
  exigeTamanoDeTexto,
  factorDeTamano,
  siguienteTamanoDeTexto,
});

/** Lo que `mundoDeLaPartida` enumera en su `DEL_NUCLEO`, ni una función más. */
export const NUCLEO_DEL_MUNDO_GUARDADO = Object.freeze({
  listaMapas,
  cargaMapa,
  cargaCelda,
  celdasAbiertas,
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
