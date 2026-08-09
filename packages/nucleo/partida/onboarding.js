// La secuencia del arranque: los siete pasos que van de abrir la app por primera vez
// a salir a andar, qué recoge cada uno, cuáles admiten volver atrás, qué queda
// precubierto y cómo se reanuda cuando la app se cierra a mitad.
//
// Se llama `onboarding.js` y no `arranque.js` a propósito: `partida/arranque.js` ya
// existe y habla de otra cosa —el arco narrativo que termina cuando lo que se cuenta
// en un pueblo eres tú (`arranque.md` §3)—. Dos módulos con el mismo nombre y dos
// significados distintos es una confusión barata de evitar aquí, y es el mismo trato
// que `names/aptitud-de-texto.js` le dio a `world/aptitud.js`.
//
// Vive en el paquete y no en la pantalla porque **es estado y secuencia, no dibujo**:
// en la máquina donde se implementa esto no hay simulador, así que un orden de pasos
// que solo se pudiera recorrer en un dispositivo no se pondría rojo nunca
// (`pipeline/decisiones-orquestador.md` §6o). Y porque la lista de campos que el
// arranque recoge tiene que ser cerrada para que «no se pregunta la edad» se pueda
// afirmar sin abrir siete pantallas.
//
// **Nada degrada por falta de cableado** (§6h): las piezas se comprueban al construir
// y no al usarlas. Un arranque sin proveedor de ubicación que cayera en silencio a la
// vía de elegir el punto a mano sería exactamente la pieza que, al no estar, no
// protesta.

import { congelaHondo } from '../core/congelar.js';
import { creaSemilla, exigeSemilla } from '../core/semilla.js';
import { creaFiltroDeAptitud } from '../names/aptitud-de-texto.js';
import { exigeNombres } from '../names/index.js';
import { anclaje, creaRejilla, idDeMapa } from '../world/rejilla.js';
import { AJUSTES_DE_ORIGEN, estadoDeAjustes } from './ajustes.js';
import {
  CLASES,
  VERSION_FORMATO,
  VERSION_GENERADOR,
  campos,
  compruebaVersion,
  declaraEsquema,
  escribe,
  lista,
  texto as textoCanonico,
  uno,
} from './formato.js';
import {
  GENERO_DE_ORIGEN,
  estadoDePersonaje,
  fijaElOficio,
  marcaOficio,
  ponGenero,
  ponNombre,
  ponTramo,
  precargaNombre,
  sugerenciasDeNombre,
} from './personaje.js';
import { IDS_DE_RESPUESTA, declaraTramo, exigeTramo } from './tramo.js';

/** Los siete pasos, en el orden en que se recorren. Vocabulario cerrado. */
export const PASOS = congelaHondo([
  'quien-eres',
  'tu-tramo',
  'el-permiso',
  'donde-se-levanta',
  'la-generacion',
  'tu-mapa',
  'la-primera-aventura',
]);

/**
 * Los pasos que admiten volver atrás, y por tanto los que llevan flecha y contador.
 *
 * Los cinco primeros. La flecha no es una comodidad: es lo que hace que denegar el
 * permiso y arrepentirse del nombre no sean puertas cerradas. Y su ausencia a partir
 * de A1P5 es la forma que toma en la interfaz el único invariante irreversible del
 * juego —lo generado no se resiembra jamás (`bucle-jugable.md` §5)—.
 */
export const PASOS_CON_VUELTA = congelaHondo(PASOS.slice(0, 5));

/** Sobre cuánto va el contador. Cinco, que son los pasos con vuelta: un contador que siguiera subiendo sin flecha prometería algo que no existe. */
export const TOTAL_DEL_CONTADOR = PASOS_CON_VUELTA.length;

/**
 * La lista **cerrada** de campos que el arranque recoge, y ninguno más.
 *
 * Que sea cerrada y viva aquí es lo que permite afirmar «no se pregunta la edad» sin
 * recorrer siete pantallas en un dispositivo, y lo que hace que añadir una pregunta
 * nueva se vea en el diff en lugar de aparecer en un componente.
 */
export const CAMPOS_DEL_ARRANQUE = congelaHondo([
  'nombre',
  'genero',
  'oficio',
  'respuestaDeTramo',
  'origenDelPunto',
  'anclaje',
]);

/** Qué campos recoge cada paso. Los dos últimos no recogen nada: enseñan. */
export const CAMPOS_POR_PASO = congelaHondo({
  'quien-eres': ['nombre', 'genero', 'oficio'],
  'tu-tramo': ['respuestaDeTramo'],
  'el-permiso': ['origenDelPunto'],
  'donde-se-levanta': ['anclaje'],
  'la-generacion': [],
  'tu-mapa': [],
  'la-primera-aventura': [],
});

/** Por dónde pudo llegar el punto de partida. Denegar el permiso no es una puerta cerrada: es la otra vía. */
export const ORIGENES_DEL_PUNTO = congelaHondo(['permiso', 'a-mano']);

/** Las piezas que hay que cablear. Sin una, esto no se construye. */
export const PIEZAS_DEL_ARRANQUE = congelaHondo(['ubicacion', 'entropia', 'locale', 'puntoPorDefecto']);

const QUE_HACE = Object.freeze({
  ubicacion: 'es quien pide el permiso «mientras se usa» y entrega la posición; sin él, seguir por la vía de elegir el punto a mano sería una caída silenciosa y no una elección',
  entropia: 'es el único azar de verdad del proyecto y por eso entra por la firma; sin él habría que fabricar la semilla con el reloj, que es lo que RNF-DET-001 prohíbe',
  locale: 'decide de qué paquete de idioma salen las sugerencias de nombre; sin él saldrían del castellano sin decirlo, y el nombre dejaría de pegar con el sitio',
  puntoPorDefecto: 'es dónde empieza la marca cuando no hay permiso; el paquete no conoce ninguna geografía y no se la puede inventar',
});

/** Un paso del vocabulario cerrado, o un error que lo nombra y enumera los siete. */
export function exigePaso(paso) {
  if (!PASOS.includes(paso)) {
    throw new Error(`paso del arranque desconocido ${JSON.stringify(paso) ?? String(paso)}: los siete son ${PASOS.join(', ')}`);
  }
  return paso;
}

/** Si un paso lleva flecha de atrás y contador. */
export function llevaVuelta(paso) {
  return PASOS_CON_VUELTA.includes(exigePaso(paso));
}

/**
 * El contador de un paso: `{ n, de }`, o `null` en los dos últimos.
 *
 * Desde que el mapa existe no se vuelve, así que ahí no hay ni flecha ni contador.
 */
export function contadorDe(paso) {
  if (!llevaVuelta(paso)) return null;
  return congelaHondo({ n: PASOS.indexOf(paso) + 1, de: TOTAL_DEL_CONTADOR });
}

/** El estado de un arranque recién empezado, sin ninguna respuesta contestada. */
export function estadoDeOnboarding({ semilla }) {
  return {
    semilla: exigeSemilla(semilla),
    paso: PASOS[0],
    ronda: 0,
    sugerencias: [],
    personaje: estadoDePersonaje(),
    respuestaDeTramo: null,
    origenDelPunto: null,
    anclaje: null,
    cerrado: false,
  };
}

// --- Lo que queda contestado ------------------------------------------------------

/**
 * Lo que el arranque lleva contestado, campo a campo de la lista cerrada.
 *
 * Es lo que la pantalla usa para **precubrir** al retroceder y al reanudar, y es lo
 * único que se guarda: ni la posición que devolvió el proveedor, ni la posición donde
 * se soltó la marca, ni ninguna marca de tiempo.
 */
export function precubierto(estado) {
  return congelaHondo({
    nombre: estado?.personaje?.nombre ?? null,
    genero: estado?.personaje?.genero ?? GENERO_DE_ORIGEN,
    oficio: estado?.personaje?.oficio ?? null,
    respuestaDeTramo: estado?.respuestaDeTramo ?? null,
    origenDelPunto: estado?.origenDelPunto ?? null,
    anclaje: estado?.anclaje ? { lat: estado.anclaje.lat, lon: estado.anclaje.lon } : null,
  });
}

/** Los campos que todavía no se han contestado, en el orden de la lista cerrada. */
export function sinContestar(estado) {
  const puesto = precubierto(estado);
  return CAMPOS_DEL_ARRANQUE.filter((campo) => puesto[campo] === null);
}

// --- La reanudación ----------------------------------------------------------------

/**
 * A qué paso se vuelve al reabrir la app.
 *
 * Si se cerró durante la generación se vuelve a **A1P4** con todo contestado, y no se
 * reanuda la generación donde iba: reanudarla exigiría persistir una generación
 * parcial, que es justo lo que SPEC-026 prohíbe —o hay documento completo o no hay
 * documento—. `arranque.md` lo dice igual: «al volver aparece en el paso anterior con
 * lo que ya había contestado precubierto».
 *
 * Los dos últimos pasos tampoco se reanudan en su sitio, y por el mismo motivo: si el
 * mapa no llegó a escribirse, enseñarlo sería enseñar un mapa que no existe.
 */
export function pasoAlReanudar(paso) {
  const donde = exigePaso(paso);
  if (donde === 'la-generacion' || donde === 'tu-mapa' || donde === 'la-primera-aventura') return 'donde-se-levanta';
  return donde;
}

// --- Serialización -------------------------------------------------------------------

/**
 * El esquema del arranque a medio contestar.
 *
 * Cerrado por los dos lados, como el del estado: un campo que nadie declara —una
 * posición exacta de quien juega, por ejemplo— hace fallar la escritura nombrándolo
 * en vez de viajar de polizón hasta el disco. Y lo que sí lleva es el **anclaje
 * redondeado**, que es lo mismo que ya guarda el índice de un mapa.
 */
export const ESQUEMA_ARRANQUE_EN_CURSO = campos({
  version: 'entero',
  generador: 'texto',
  clase: 'texto',
  semilla: 'texto',
  paso: 'texto',
  ronda: 'entero',
  sugerencias: lista('texto'),
  personaje: campos({
    nombre: 'texto?',
    genero: 'texto',
    oficio: 'texto?',
    oficioPermanente: 'booleano',
    tramo: uno(['nulo', campos({ respuesta: 'texto?', declaradoM: 'numero', estimadoM: 'numero', salidasMedidas: 'entero' })]),
  }),
  respuestaDeTramo: 'texto?',
  origenDelPunto: 'texto?',
  anclaje: uno(['nulo', campos({ lat: 'numero', lon: 'numero' })]),
});

declaraEsquema(CLASES.ARRANQUE, ESQUEMA_ARRANQUE_EN_CURSO);

/** La clave con la que el arranque a medias vive en el almacén. Una sola: no hay dos arranques a la vez. */
export const CLAVE_DEL_ARRANQUE = 'arranque/en-curso';

/** El arranque en documento, validado contra el esquema cerrado al escribirlo. */
export function congelaOnboarding(estado) {
  const personaje = estado?.personaje ?? estadoDePersonaje();
  const doc = {
    version: VERSION_FORMATO,
    generador: VERSION_GENERADOR,
    clase: CLASES.ARRANQUE,
    semilla: exigeSemilla(estado?.semilla),
    paso: exigePaso(estado?.paso),
    ronda: Number.isInteger(estado?.ronda) ? estado.ronda : 0,
    sugerencias: (estado?.sugerencias ?? []).slice(),
    personaje: {
      nombre: personaje.nombre ?? null,
      genero: personaje.genero ?? GENERO_DE_ORIGEN,
      oficio: personaje.oficio ?? null,
      oficioPermanente: personaje.oficioPermanente === true,
      tramo: personaje.tramo
        ? {
          respuesta: personaje.tramo.respuesta ?? null,
          declaradoM: personaje.tramo.declaradoM,
          estimadoM: personaje.tramo.estimadoM,
          salidasMedidas: personaje.tramo.salidasMedidas,
        }
        : null,
    },
    respuestaDeTramo: estado?.respuestaDeTramo ?? null,
    origenDelPunto: estado?.origenDelPunto ?? null,
    anclaje: estado?.anclaje ? { lat: estado.anclaje.lat, lon: estado.anclaje.lon } : null,
  };
  escribe(doc, ESQUEMA_ARRANQUE_EN_CURSO, 'documento arranque-en-curso');
  return congelaHondo(doc);
}

/** El texto canónico del arranque a medias. */
export function textoDeOnboarding(estado) {
  return textoCanonico(congelaOnboarding(estado));
}

/**
 * El arranque de vuelta de su documento, **ya reanudado**: el paso que devuelve es el
 * de `pasoAlReanudar`, no el que se guardó. Reanudar es la operación, no una lectura
 * seguida de una corrección que alguien pueda olvidarse de hacer.
 */
export function levantaOnboarding(doc, donde = 'el arranque a medio contestar') {
  compruebaVersion(doc, donde);
  escribe(doc, ESQUEMA_ARRANQUE_EN_CURSO, donde);
  const estado = estadoDeOnboarding({ semilla: doc.semilla });
  estado.paso = pasoAlReanudar(doc.paso);
  estado.ronda = doc.ronda;
  estado.sugerencias = doc.sugerencias.slice();
  estado.personaje.nombre = doc.personaje.nombre;
  estado.personaje.genero = doc.personaje.genero;
  estado.personaje.oficio = doc.personaje.oficio;
  estado.personaje.oficioPermanente = doc.personaje.oficioPermanente;
  estado.personaje.tramo = doc.personaje.tramo ? { ...doc.personaje.tramo } : null;
  estado.respuestaDeTramo = doc.respuestaDeTramo;
  estado.origenDelPunto = doc.origenDelPunto;
  estado.anclaje = doc.anclaje ? { lat: doc.anclaje.lat, lon: doc.anclaje.lon } : null;
  return estado;
}

// --- La máquina --------------------------------------------------------------------

function exigePieza(piezas, nombre, bien) {
  if (!bien) {
    throw new Error(
      `el arranque se construye sin ${nombre} y no arranca sin él: ${QUE_HACE[nombre]}. ` +
      `Las piezas son ${PIEZAS_DEL_ARRANQUE.join(', ')}`,
    );
  }
  return piezas[nombre];
}

/**
 * Monta el arranque con sus piezas cableadas.
 *
 * @param {object} piezas
 * @param {{ pide: () => Promise<{concedido: boolean, posicion: ?{lat:number,lon:number}}> }} piezas.ubicacion
 *   el proveedor de ubicación. Pide el permiso «mientras se usa», dice si lo
 *   concedieron y, si lo concedieron, entrega una posición. Nunca guarda nada.
 * @param {(() => number) | ArrayLike<number>} piezas.entropia  el origen de entropía
 *   de la semilla, tal y como lo exige `creaSemilla`.
 * @param {string} piezas.locale  el idioma del que salen las sugerencias de nombre.
 * @param {{lat:number, lon:number}} piezas.puntoPorDefecto  dónde empieza la marca por
 *   la vía manual.
 * @param {object} [piezas.filtro]  el filtro de aptitud; el del locale por defecto.
 * @param {string} [piezas.semilla]  una semilla ya creada, para reanudar sin gastar entropía.
 */
export function creaArranque({ ubicacion, entropia, locale, puntoPorDefecto, filtro = null, semilla = null }) {
  const piezas = { ubicacion, entropia, locale, puntoPorDefecto };
  exigePieza(piezas, 'ubicacion', ubicacion && typeof ubicacion === 'object' && typeof ubicacion.pide === 'function');
  exigePieza(piezas, 'entropia', typeof entropia === 'function' || (entropia && typeof entropia.length === 'number'));
  exigePieza(piezas, 'locale', typeof locale === 'string' && locale.length > 0);
  exigePieza(
    piezas,
    'puntoPorDefecto',
    puntoPorDefecto && Number.isFinite(puntoPorDefecto.lat) && Number.isFinite(puntoPorDefecto.lon),
  );

  // El paquete se resuelve al construir y no al pedir sugerencias: un idioma sin
  // paquete tiene que fallar antes de que nadie vea una pantalla, no en mitad de ella.
  const paquete = exigeNombres(locale);
  const aptitud = filtro ?? creaFiltroDeAptitud({ locale });

  let estado = estadoDeOnboarding({ semilla: semilla ?? creaSemilla(entropia) });
  // La marca vive **solo en memoria** mientras se arrastra: lo que sobrevive es el
  // anclaje redondeado, y nada más (RF-PRIV-002).
  let marca = null;

  function sortea() {
    estado.sugerencias = sugerenciasDeNombre({ semilla: estado.semilla, locale, paquete, ronda: estado.ronda });
    precargaNombre(estado.personaje, estado.sugerencias[0]);
    return estado.sugerencias;
  }

  function vaA(paso) {
    estado.paso = exigePaso(paso);
    return vista();
  }

  function vista() {
    return congelaHondo({
      paso: estado.paso,
      contador: contadorDe(estado.paso),
      atras: llevaVuelta(estado.paso) && PASOS.indexOf(estado.paso) > 0,
      cerrado: estado.cerrado,
      sugerencias: estado.sugerencias,
      precubierto: precubierto(estado),
      marca: marca ? { lat: marca.lat, lon: marca.lon } : null,
      sinContestar: sinContestar(estado),
    });
  }

  return {
    /** El estado vivo. Se entrega tal cual porque quien lo guarda es de fuera. */
    estado: () => estado,

    vista,

    /** La semilla de la partida, creada una sola vez con la entropía inyectada. */
    semilla: () => estado.semilla,

    /**
     * El proveedor de ubicación tal como llegó.
     *
     * Se publica para que A1P3 pueda decir **por qué** no se puede pedir el permiso
     * cuando no hay con qué: un «Permitir» que no responde y no explica nada es peor
     * que un «Permitir» apagado con su motivo al lado.
     */
    proveedorDeUbicacion: () => ubicacion,

    /**
     * Abre el arranque: sortea las primeras sugerencias y precarga el nombre.
     *
     * **Resortear no ocurre al volver atrás**: si el sorteo estuviera aquí y aquí se
     * volviera, retroceder cambiaría el nombre que alguien ya había aceptado.
     */
    empieza() {
      if (!estado.sugerencias.length) sortea();
      return vista();
    },

    /** Otras cuatro sugerencias, y el campo se rellena con la primera. */
    resortea() {
      estado.ronda += 1;
      sortea();
      return vista();
    },

    /** Escribe el nombre a mano. Devuelve el veredicto; un nombre que no pasa no se guarda. */
    escribeNombre(texto) {
      return ponNombre(estado.personaje, texto, { filtro: aptitud });
    },

    /** Cambia el género gramatical. No siembra nada: el mundo generado no depende de él. */
    eligeGenero(genero) {
      ponGenero(estado.personaje, genero);
      return vista();
    },

    /** Marca el oficio. Se puede cambiar mientras el arranque no se haya cerrado. */
    eligeOficio(oficio) {
      marcaOficio(estado.personaje, oficio);
      return vista();
    },

    /** Responde el tramo con uno de los cuatro identificadores de SPEC-004. */
    respondeTramo(respuesta) {
      const id = typeof respuesta === 'string' ? respuesta : respuesta?.id;
      // `declaraTramo` ya enumera las cuatro al fallar; se llama antes de tocar el
      // estado para que una respuesta desconocida no deje el arranque a medias.
      const tramo = declaraTramo(id);
      estado.respuestaDeTramo = tramo.respuesta;
      ponTramo(estado.personaje, id);
      return vista();
    },

    /**
     * Pide el permiso de ubicación. Concedido, la marca arranca en la posición que
     * entregó el proveedor; denegado, **el arranque continúa** por la vía de elegir el
     * punto a mano y sin pantalla intermedia: una pantalla de rescate convertiría la
     * denegación en un problema que hay que resolver, y aquí no lo es.
     */
    async pideElPermiso() {
      const respuesta = await ubicacion.pide();
      if (respuesta?.concedido && respuesta.posicion && Number.isFinite(respuesta.posicion.lat) && Number.isFinite(respuesta.posicion.lon)) {
        estado.origenDelPunto = 'permiso';
        marca = { lat: respuesta.posicion.lat, lon: respuesta.posicion.lon };
      } else {
        estado.origenDelPunto = 'a-mano';
        marca = { lat: puntoPorDefecto.lat, lon: puntoPorDefecto.lon };
      }
      return vaA('donde-se-levanta');
    },

    /** «Prefiero elegir el punto a mano»: se pasa a A1P4 sin haber pedido ningún permiso. */
    eligeAMano() {
      estado.origenDelPunto = 'a-mano';
      marca = { lat: puntoPorDefecto.lat, lon: puntoPorDefecto.lon };
      return vaA('donde-se-levanta');
    },

    /** Arrastra la marca. Vive en memoria y no se guarda: lo que sobrevive es el anclaje. */
    mueveLaMarca(lat, lon) {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error(`la marca se mueve a una coordenada válida y llegó lat=${lat}, lon=${lon}`);
      }
      marca = { lat, lon };
      return vista();
    },

    /** Dónde está la marca ahora mismo. Diagnóstico de pantalla, nunca estado guardado. */
    marca: () => (marca ? congelaHondo({ lat: marca.lat, lon: marca.lon }) : null),

    /**
     * El radio del círculo de alcance de A1P4, en metros.
     *
     * **Sale del tramo y de nada más**, y se deriva de la rejilla en vez de clavarse:
     * es el radio inscrito de la celda que se va a levantar, así que si el lado de
     * celda cambia al medirlo, el círculo se mueve solo. Con un tramo en el suelo, la
     * rejilla lo recorta y el círculo se dibuja igual: la pantalla no menciona ni el
     * suelo ni ninguna limitación.
     */
    radioDeAlcanceM() {
      if (!estado.respuestaDeTramo) {
        throw new Error(`el círculo de alcance sale del tramo declarado y todavía no hay ninguno: las cuatro respuestas son ${IDS_DE_RESPUESTA.join(', ')}`);
      }
      const tramo = exigeTramo(estado.personaje, 'el círculo de alcance de A1P4');
      const punto = marca ?? puntoPorDefecto;
      return creaRejilla({ lat: punto.lat, lon: punto.lon, tramoM: tramo.declaradoM }).radioInscritoM;
    },

    /**
     * Confirma el punto: **el mapa se ancla a la coordenada redondeada** de donde se
     * soltó la marca, no a la exacta. Es la única decisión irreversible del arranque, y
     * a partir de aquí no hay flecha de atrás.
     */
    confirmaElPunto() {
      if (!marca) {
        throw new Error('no hay marca que confirmar: el punto de partida llega del proveedor de ubicación o de la vía manual, y nunca se supone');
      }
      estado.anclaje = anclaje(marca.lat, marca.lon);
      return vaA('la-generacion');
    },

    /** El identificador del mapa que se va a levantar: su anclaje, y nada más. */
    mapaId: () => (estado.anclaje ? idDeMapa(estado.anclaje) : null),

    /** El mapa ya está pintado: se pasa a enseñarlo. */
    mapaPintado: () => vaA('tu-mapa'),

    /** La generación no se pudo completar: se vuelve a A1P4 con todo contestado. */
    noSePudoLevantar: () => vaA('donde-se-levanta'),

    /** Avanza al paso siguiente. El último no avanza: se cierra. */
    avanza() {
      const i = PASOS.indexOf(estado.paso);
      if (i < PASOS.length - 1) vaA(PASOS[i + 1]);
      return vista();
    },

    /**
     * Vuelve al paso anterior con **lo contestado precubierto**.
     *
     * En el primer paso no se sale de la app ni se pierde nada: no hay paso anterior y
     * la pantalla lo dice quedándose. Y desde que el mapa existe no se vuelve, así que
     * los dos últimos no tienen atrás.
     */
    atras() {
      const i = PASOS.indexOf(estado.paso);
      if (i <= 0 || !llevaVuelta(estado.paso)) return vista();
      return vaA(PASOS[i - 1]);
    },

    /**
     * Cierra el arranque: **sella el oficio** y entrega lo que la partida necesita.
     *
     * La permanencia empieza aquí y no al pulsar «Seguir» en A1P1, porque hasta A1P4
     * hay flecha de atrás y fijar el oficio antes de que exista mundo haría de esa
     * flecha una promesa falsa.
     */
    cierra() {
      for (const campo of sinContestar(estado)) {
        throw new Error(`el arranque no se puede cerrar: falta "${campo}" de la lista cerrada (${CAMPOS_DEL_ARRANQUE.join(', ')})`);
      }
      fijaElOficio(estado.personaje);
      estado.cerrado = true;
      return congelaHondo({
        semilla: estado.semilla,
        personaje: {
          nombre: estado.personaje.nombre,
          genero: estado.personaje.genero,
          oficio: estado.personaje.oficio,
          oficioPermanente: true,
          tramo: { ...estado.personaje.tramo },
        },
        ajustes: estadoDeAjustes(),
        anclaje: { lat: estado.anclaje.lat, lon: estado.anclaje.lon },
        mapaId: idDeMapa(estado.anclaje),
        tramoM: estado.personaje.tramo.declaradoM,
        origenDelPunto: estado.origenDelPunto,
      });
    },

    /** El documento con el que se reanuda. Se guarda tras cada paso contestado. */
    congela: () => congelaOnboarding(estado),

    /** El texto canónico del documento, que es lo que va al almacén. */
    texto: () => textoDeOnboarding(estado),

    /** Reanuda desde un documento guardado. La marca vuelve al centro del anclaje, que es lo único que sobrevive. */
    reanuda(doc) {
      estado = levantaOnboarding(doc);
      marca = estado.anclaje ? { lat: estado.anclaje.lat, lon: estado.anclaje.lon } : null;
      return vista();
    },

    /** Los ajustes con los que nace la partida. Se declaran aquí para que se vean sin abrir ninguna pantalla. */
    ajustesDeOrigen: () => AJUSTES_DE_ORIGEN,
  };
}
