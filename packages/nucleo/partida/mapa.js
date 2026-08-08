// Un mapa de la partida: su rejilla, el registro de las celdas que ya están
// abiertas y por cuál de las dos vías se abrieron, y las costuras entre las que se
// tocan. Lo generado se guarda aquí y no se vuelve a generar nunca; lo único que
// cambia al jugar es qué hay abierto, jamás lo que hay dentro.

import { congelaHondo } from '../core/congelar.js';
import { makeRng } from '../core/rng.js';
import { SUFIJOS_DE_FASE, exigeSemilla, semillaDeCelda } from '../core/semilla.js';
import { generaCelda } from '../world/celda.js';
import { coseCeldas, semillaDeCostura } from '../world/costura.js';
import {
  celdaEnPosicion,
  celdasContiguas,
  claveDeCelda,
  creaRejilla,
  exigeCelda,
  ordenCanonico,
} from '../world/rejilla.js';
import { CLASES, VERSION_FORMATO, VERSION_GENERADOR, compruebaVersion, escribe, esquemaDe, lee, texto } from './formato.js';
import { congelaCelda, levantaCelda } from './mundo.js';

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
    // El título y el idioma son del mapa y no de ninguna celda: los fija `registra`
    // al abrir la primera y `levantaIndice` los trae del documento. Un mapa sin
    // ninguna celda todavía no tiene ninguno que declarar, y ese nulo sí es un
    // estado del mundo.
    titulo: null,
    idioma: null,
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
  // El título y el idioma del mapa son los de la celda que ordena **primero por su
  // clave** y no los de la primera que se abrió: el índice no puede cambiar porque
  // las celdas se abran en otro orden. Se fijan aquí, al registrar, y no se derivan
  // al congelar: una celda de un mapa cargado es una ficha sin mundo, y derivarlos
  // de ella los perdía en silencio al reescribir el índice.
  let primera = null;
  for (const c of mapa.celdas) if (primera === null || c.clave < primera) primera = c.clave;
  if (primera === null || registro.clave < primera) {
    if (!registro.mundo) {
      throw new Error(`no se puede registrar la celda ${registro.clave} en el mapa ${mapa.id}: llega sin su mundo dentro`);
    }
    mapa.titulo = registro.mundo.title;
    mapa.idioma = registro.mundo.locale;
  }
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

// --- El índice del mapa, y el almacén ---------------------------------------
//
// Dos documentos por mapa, y la partición no es estética: abrir una celda vecina
// tiene que dejar la celda propia idéntica **byte a byte**, y eso no se puede
// afirmar si las dos viven en el mismo fichero. El índice es pequeño y se lee
// siempre; las celdas se leen cuando hacen falta y se escriben una sola vez.

/** Las claves con las que viven los documentos de un mapa dentro del almacén. */
export const CLAVES = Object.freeze({
  prefijoDeMapa: (id) => `mapa/${id}/`,
  indice: (id) => `mapa/${id}/indice.json`,
  celda: (id, clave) => `mapa/${id}/celda/${clave}.json`,
  prefijoDeCeldas: (id) => `mapa/${id}/celda/`,
});

const OPERACIONES_DEL_ALMACEN = ['lee', 'escribe', 'lista', 'borra'];

/**
 * El almacén de la partida, o un error que dice qué le falta.
 *
 * Cuatro operaciones y ninguna más —leer por clave, escribir por clave, listar por
 * prefijo y borrar—, y **la atomicidad de la escritura es suya**: escribir y
 * sustituir, nunca sobrescribir en sitio, para que un apagón a mitad no deje un
 * documento truncado donde había uno bueno. El núcleo se limita a producir y
 * consumir documentos, y sin almacén sigue funcionando entero en memoria.
 */
export function exigeAlmacen(almacen, donde) {
  if (!almacen) {
    throw new Error(`${donde} necesita el almacén de la partida inyectado: el núcleo no sabe dónde guarda el móvil`);
  }
  const faltan = OPERACIONES_DEL_ALMACEN.filter((op) => typeof almacen[op] !== 'function');
  if (faltan.length) {
    throw new Error(`${donde}: al almacén inyectado le faltan las operaciones ${faltan.join(', ')} (las cuatro son ${OPERACIONES_DEL_ALMACEN.join(', ')})`);
  }
  return almacen;
}

const ordenPorClave = (a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0);
const ordenDeCostura = (a, b) => (
  a.celdas[0] < b.celdas[0] ? -1 : a.celdas[0] > b.celdas[0] ? 1 : a.celdas[1] < b.celdas[1] ? -1 : a.celdas[1] > b.celdas[1] ? 1 : 0
);

/**
 * El valor de un campo obligatorio del objeto que se está congelando, o un error
 * que lo nombra.
 *
 * Al **escribir** un documento, un campo ausente es un error y no un `null`. Un nulo
 * de la ruta de congelado solo es legítimo cuando el esquema lo declara anulable y
 * su valor nulo es un estado del mundo —una vía sin nombre, un mapa sin ninguna
 * celda abierta—, nunca un estado de la carga. Sin esta distinción, «no lo tengo
 * cargado» se escribe en disco como «no existe» y el dato ya no se puede recuperar.
 */
function exigeCampo(objeto, campo, donde) {
  if (objeto == null || !Object.prototype.hasOwnProperty.call(objeto, campo)) {
    throw new Error(`${donde}: falta el campo "${campo}" en el objeto de origen, y al escribir un documento un campo ausente es un error y no un null`);
  }
  return objeto[campo];
}

/** La ficha de una celda dentro del índice: lo que se sabe de ella sin cargarla. */
function fichaDeCelda(registro) {
  // Los cinco campos por su nombre y ninguno derivado del mundo: una ficha los tiene
  // todos, así que el índice de un mapa cargado se escribe igual que el de uno
  // generado. Si falta uno, se falla nombrándolo en vez de escribir un nulo.
  const donde = `la ficha de la celda ${registro?.clave ?? 'sin clave'}`;
  const celda = exigeCampo(registro, 'celda', donde);
  return {
    clave: exigeCampo(registro, 'clave', donde),
    i: exigeCampo(celda, 'i', donde),
    j: exigeCampo(celda, 'j', donde),
    motivo: exigeCampo(registro, 'motivo', donde),
    sinContenidoJugable: exigeCampo(registro, 'sinContenidoJugable', donde),
  };
}

/**
 * El índice de un mapa en documento.
 *
 * Su identificador es el anclaje redondeado de SPEC-003 y no una coordenada más
 * fina, y **la semilla de la partida no aparece**: con el mundo congelado la semilla
 * ya no reproduce nada, y repetirla en cada documento multiplicaría las ocasiones de
 * filtrar el único dato que quien juega puede llegar a enseñarle a alguien. Por lo
 * mismo se cae la semilla de cada costura, que se deriva de ella: se recompone al
 * cargar, con la semilla que ya tiene quien abre la partida.
 */
export function congelaIndice(mapa) {
  if (!mapa?.rejilla) throw new Error('congelaIndice necesita un mapa levantado con creaMapa');
  const celdas = mapa.celdas.map(fichaDeCelda).sort(ordenPorClave);
  const doc = {
    version: VERSION_FORMATO,
    generador: VERSION_GENERADOR,
    clase: CLASES.INDICE,
    id: mapa.id,
    anclaje: { lat: mapa.anclaje.lat, lon: mapa.anclaje.lon },
    // Del propio mapa y **nunca de `celda.mundo`**: las celdas de un mapa cargado
    // son fichas sin mundo, y atravesarlas escribía nulos que no distinguían «este
    // mapa no tiene ninguna celda» de «esta celda no se ha leído todavía».
    titulo: exigeCampo(mapa, 'titulo', `el índice del mapa ${mapa.id}`),
    idioma: exigeCampo(mapa, 'idioma', `el índice del mapa ${mapa.id}`),
    ladoM: mapa.rejilla.ladoM,
    tramoM: mapa.rejilla.tramoM,
    tramoPedidoM: mapa.rejilla.tramoPedidoM,
    tramoRecortadoAlSuelo: mapa.rejilla.tramoRecortadoAlSuelo,
    tramoSueloM: mapa.rejilla.tramoSueloM,
    ladoEnTramos: mapa.rejilla.ladoEnTramos,
    radioInscritoM: mapa.rejilla.radioInscritoM,
    celdas,
    costuras: mapa.costuras
      .map((c) => ({
        celdas: [c.celdas[0], c.celdas[1]],
        contiguas: c.contiguas,
        umbralM: c.umbralM,
        borde: c.borde ? { eje: c.borde.eje, en: c.borde.en } : null,
        aristas: c.aristas.map((a) => ({
          desde: { celda: a.desde.celda, clave: a.desde.clave, lat: a.desde.lat, lon: a.desde.lon },
          hasta: { celda: a.hasta.celda, clave: a.hasta.clave, lat: a.hasta.lat, lon: a.hasta.lon },
          metros: a.metros,
          suposicion: a.suposicion,
        })),
      }))
      .sort(ordenDeCostura),
  };
  escribe(doc, esquemaDe(CLASES.INDICE), 'documento indice-de-mapa');
  return congelaHondo(doc);
}

/** El texto canónico del índice de un mapa. */
export function textoDeIndice(mapa) {
  return texto(congelaIndice(mapa));
}

/**
 * La rejilla de un mapa ya guardado, **leída y no recalculada**.
 *
 * Recalcularla ataría la geometría de un mapa existente a la constante de lado que
 * tenga instalada quien juega, y eso movería los índices de todas sus celdas.
 */
function rejillaDelIndice(d) {
  return Object.freeze({
    anclaje: Object.freeze({ lat: d.anclaje.lat, lon: d.anclaje.lon }),
    id: d.id,
    tramoM: d.tramoM,
    tramoPedidoM: d.tramoPedidoM,
    tramoRecortadoAlSuelo: d.tramoRecortadoAlSuelo,
    tramoSueloM: d.tramoSueloM,
    ladoM: d.ladoM,
    radioInscritoM: d.radioInscritoM,
    ladoEnTramos: d.ladoEnTramos,
  });
}

/**
 * Levanta un mapa desde su índice.
 *
 * Las celdas llegan como **fichas y no como registros**: se sabe cuáles están
 * abiertas y por qué vía, y no se lee ni una hasta que haga falta. Una ficha se
 * distingue de un registro por `cargada`, y pedirle el mundo a una ficha falla
 * nombrando la celda en vez de devolver un mapa a medias.
 */
export function levantaIndice(doc, { semilla } = {}) {
  const d = typeof doc === 'string' ? lee(doc, 'el índice del mapa') : compruebaIndice(doc);
  const semillaPartida = exigeSemilla(semilla);
  const rejilla = rejillaDelIndice(d);
  return {
    semilla: semillaPartida,
    id: d.id,
    anclaje: rejilla.anclaje,
    rejilla,
    titulo: d.titulo,
    idioma: d.idioma,
    celdas: d.celdas.map((c) => ({
      clave: c.clave,
      celda: { i: c.i, j: c.j },
      motivo: c.motivo,
      sinContenidoJugable: c.sinContenidoJugable,
      cargada: false,
    })),
    costuras: d.costuras.map((c) => {
      const [p, q] = c.celdas;
      const aIndice = (clave) => {
        const [i, j] = clave.split(',').map(Number);
        return { i, j };
      };
      return {
        celdas: [p, q],
        umbralM: c.umbralM,
        // La semilla de la costura se recompone con la de la partida, que es lo que
        // permite que no viaje en el documento.
        semilla: semillaDeCostura(semillaPartida, d.id, aIndice(p), aIndice(q)),
        contiguas: c.contiguas,
        borde: c.borde ? { ...c.borde } : null,
        aristas: c.aristas.map((a) => ({
          desde: { ...a.desde },
          hasta: { ...a.hasta },
          metros: a.metros,
          suposicion: a.suposicion,
        })),
      };
    }),
  };
}

/** Comprueba un índice ya parseado: la versión primero, el esquema cerrado después. */
export function compruebaIndice(doc, donde = 'el índice del mapa') {
  compruebaVersion(doc, donde);
  escribe(doc, esquemaDe(CLASES.INDICE), donde);
  return doc;
}

/** Si lo que hay registrado para una celda es su mundo entero o solo su ficha. */
export function estaCargada(registro) {
  return !!registro && registro.cargada !== false && !!registro.mundo;
}

/**
 * El mundo de una celda abierta, o un error que nombra la celda.
 *
 * Existe para que una ficha no pueda pasar por un registro: devolver un mundo vacío
 * porque el documento todavía no se ha leído es exactamente la degradación
 * silenciosa que este proyecto ya ha pagado.
 */
export function mundoDeCelda(mapa, celda) {
  const registro = celdaAbierta(mapa, celda);
  if (!registro) throw new Error(`la celda ${claveDeCelda(celda)} no está abierta en el mapa ${mapa.id}`);
  if (!estaCargada(registro)) {
    throw new Error(`la celda ${claveDeCelda(celda)} del mapa ${mapa.id} está abierta pero su documento no se ha cargado todavía: cárgala con cargaCelda antes de pedirle el mundo`);
  }
  return registro.mundo;
}

// --- Guardar y cargar -------------------------------------------------------

/** Escribe el índice del mapa. El error del almacén se propaga tal cual. */
export async function guardaIndice(mapa, { almacen }) {
  exigeAlmacen(almacen, 'guardaIndice');
  await almacen.escribe(CLAVES.indice(mapa.id), textoDeIndice(mapa));
  return mapa;
}

/**
 * Escribe el documento de una celda.
 *
 * Si el almacén falla al escribir, el error se propaga y **el documento anterior
 * sigue intacto**: aquí no se borra nada antes de escribir, y sustituir en un solo
 * paso es cosa del almacén.
 */
export async function guardaCelda(mapa, celda, { almacen, recursos = null } = {}) {
  exigeAlmacen(almacen, 'guardaCelda');
  const registro = celdaAbierta(mapa, celda);
  if (!estaCargada(registro)) {
    throw new Error(`no se puede guardar la celda ${claveDeCelda(celda)} del mapa ${mapa.id}: no está abierta con su mundo dentro`);
  }
  const documento = congelaCelda(registro, { recursos });
  await almacen.escribe(CLAVES.celda(mapa.id, registro.clave), texto(documento));
  return documento;
}

/** El mapa entero al almacén: su índice y todas las celdas que tenga cargadas. */
export async function guardaMapa(mapa, { almacen } = {}) {
  exigeAlmacen(almacen, 'guardaMapa');
  for (const registro of celdasAbiertas(mapa)) {
    if (estaCargada(registro)) await guardaCelda(mapa, registro.celda, { almacen });
  }
  await guardaIndice(mapa, { almacen });
  return mapa;
}

/**
 * Carga un mapa: **se lee el índice y ninguna celda**.
 *
 * Antes de devolver nada se comprueba que el almacén tiene el documento de cada
 * celda que el índice declara. Si falta uno, se falla nombrando la celda: un mapa a
 * medias es peor que ninguno, porque lo que falta ya no se puede regenerar.
 */
export async function cargaMapa({ almacen, id, semilla } = {}) {
  exigeAlmacen(almacen, 'cargaMapa');
  if (!id) throw new Error('cargaMapa necesita el identificador del mapa, que es su anclaje redondeado');
  const crudo = await almacen.lee(CLAVES.indice(id));
  if (crudo == null) throw new Error(`el almacén no tiene el índice del mapa ${id}`);
  const mapa = levantaIndice(lee(crudo, `el índice del mapa ${id}`), { semilla });

  const presentes = new Set(await almacen.lista(CLAVES.prefijoDeCeldas(id)));
  for (const ficha of mapa.celdas) {
    const clave = CLAVES.celda(id, ficha.clave);
    if (!presentes.has(clave)) {
      throw new Error(`el índice del mapa ${id} declara la celda ${ficha.clave} y el almacén no tiene su documento (${clave})`);
    }
  }
  return mapa;
}

/**
 * Lee el documento de una celda y sustituye su ficha por el registro entero.
 *
 * Es lo que hace que una celda ya abierta se lea del almacén y **no se consulte
 * OSM**: levantar no pide nada a nadie.
 */
export async function cargaCelda(mapa, celda, { almacen } = {}) {
  exigeAlmacen(almacen, 'cargaCelda');
  exigeCelda(celda);
  const clave = claveDeCelda(celda);
  const i = mapa.celdas.findIndex((c) => c.clave === clave);
  if (i < 0) throw new Error(`la celda ${clave} no está abierta en el mapa ${mapa.id}`);
  if (estaCargada(mapa.celdas[i])) return mapa.celdas[i];

  const crudo = await almacen.lee(CLAVES.celda(mapa.id, clave));
  if (crudo == null) throw new Error(`el almacén no tiene el documento de la celda ${clave} del mapa ${mapa.id}`);
  const registro = levantaCelda(lee(crudo, `el documento de la celda ${clave}`), { semilla: mapa.semilla });
  mapa.celdas[i] = registro;
  return registro;
}

/**
 * Los mapas de la partida, por su identificador y en orden estable.
 *
 * Un almacén sin ningún mapa devuelve una lista vacía y no un error: no tener
 * mapas todavía es un estado normal de una partida, no una avería.
 */
export async function listaMapas({ almacen } = {}) {
  exigeAlmacen(almacen, 'listaMapas');
  const claves = await almacen.lista('mapa/');
  const ids = new Set();
  for (const clave of claves ?? []) {
    const m = /^mapa\/([^/]+)\/indice\.json$/.exec(clave);
    if (m) ids.add(m[1]);
  }
  return [...ids].sort();
}
