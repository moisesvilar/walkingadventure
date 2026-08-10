// Una partida, muchos mapas, y **ningún selector**: el mapa activo lo decide dónde
// estás. Aquí viven la lista de mapas de la partida, la resolución del mapa activo
// desde una posición, el alcance declarado con el que una posición sigue siendo de un
// mapa, y el desempate cuando dos se tocan.
//
// Lo más importante que hay en este módulo es lo que **no** hay: ninguna operación que
// fije el mapa activo a mano. No es un olvido —`alcance-del-mundo.md` §3 descarta el
// selector— y por eso el mapa activo no se guarda como preferencia: se resuelve cada
// vez desde la posición, y así no puede quedarse pegado a un mapa antiguo ni
// desincronizarse de dónde está quien juega.
//
// Y otra ausencia, esta de código: no hay ni una función que copie rangos, motes ni lo
// que se cuenta de un mapa a otro. El rango no viaja porque es por núcleo (SPEC-015),
// no porque nadie lo impida; el oro, los objetos, el personaje y el diario son de la
// partida y viajan sin que aquí haya que moverlos.

import { congelaHondo } from '../core/congelar.js';
import { celdaEnPosicion, claveDeCelda, limitesDeCelda, proyectorDeRejilla } from '../world/rejilla.js';
import { CLAVES, celdasAbiertas, compruebaIndice, exigeAlmacen } from './mapa.js';
import { lee } from './formato.js';
import { REGISTROS } from './guion-de-arranque.js';

/**
 * Hasta dónde una posición sigue perteneciendo a un mapa, medido **desde el borde de
 * lo que tiene abierto y en tramos de quien anda**, no en metros absolutos.
 *
 * En tramos porque la celda va en tramos (`alcance-del-mundo.md` §2) y porque un
 * umbral en metros no significa lo mismo para quien anda 300 m por tramo que para
 * quien anda 2 km. Y existe porque una rejilla tiene bordes y la gente no: con alcance
 * cero, cruzar la calle equivocada al final del mapa ofrecería levantar un mapa nuevo
 * pegado al de casa, que es la peor respuesta posible.
 *
 * Un tramo, que es media hora andando: lo bastante para que el borde no se note y lo
 * bastante poco para que un viaje de verdad sí lo cruce.
 */
export const ALCANCE_EN_TRAMOS = 1;

/** Lo que devuelve la resolución cuando la partida no tiene ningún mapa cerca. Ni error ni vacío. */
export const SIN_MAPA_ACTIVO = 'ninguno';

/**
 * Las tres respuestas de la resolución, y no hay una cuarta.
 *
 * `dentro` la posición cae en lo que el mapa tiene abierto o en su rejilla; `alcance`
 * cae fuera pero a menos del alcance declarado del borde; `ninguno` ni una cosa ni la
 * otra, y entonces se ofrece levantar uno.
 */
export const RESOLUCIONES = congelaHondo(['dentro', 'alcance', 'ninguno']);

/** El estado de la apertura de una celda vecina. Vocabulario cerrado de A2P1. */
export const ESTADOS_DE_APERTURA = congelaHondo(['inactiva', 'abriendo', 'abierta', 'no-se-pudo']);

/** Los localizadores de esta fila. No hay ninguno de selector, de lista ni de cambio de mapa. */
export const TESTIDS = congelaHondo({
  momento: 'momento',
  mapaActivo: 'mapa-activo',
  ofrecimiento: 'ofrecer-levantar-mapa',
  levantar: 'levantar-mapa-aqui',
  dejarlo: 'dejarlo-estar',
  apertura: 'celda-apertura',
});

/** El momento del bucle en el que se ofrece levantar un mapa. El mismo de la portada. */
export const MOMENTO = 'antes-de-salir';

/**
 * Las dos acciones del ofrecimiento, y ninguna más.
 *
 * No hay «volver a casa» ni ninguna distancia a ningún mapa: enseñar a cuánto está
 * casa invita a intentar jugar allí desde aquí, que es justo lo que
 * `alcance-del-mundo.md` §3 descarta —leerlos sí, jugarlos desde el sofá no—.
 */
export const ACCIONES = congelaHondo([
  { id: 'levantar', testid: TESTIDS.levantar, orden: 1, peso: 'principal' },
  { id: 'dejarlo', testid: TESTIDS.dejarlo, orden: 2, peso: 'texto' },
]);

/** Las tres puertas siguen: el diario es precisamente donde se leen los mapas donde ya no estás. */
export const PUERTAS = congelaHondo(['diario', 'repisa', 'ajustes']);

/**
 * El guion del ofrecimiento. Va como dato por lo mismo que los otros dos guiones del
 * proyecto: sin simulador, un criterio de contenido que solo se lea en pantalla no se
 * pone rojo nunca. Aquí habla el mundo: ni la red, ni los mapas guardados, ni una
 * distancia.
 */
export const GUION = congelaHondo([
  { id: 'sitio', registro: REGISTROS.MUNDO, texto: null, de: 'el sitio donde estás, dicho como lugar y no como coordenada' },
  { id: 'titular', registro: REGISTROS.MUNDO, texto: 'Hasta aquí no llega ninguno de tus mapas' },
  { id: 'cuerpo', registro: REGISTROS.MUNDO, texto: 'Si esto va a ser sitio tuyo, se puede levantar uno.' },
  { id: 'levantar', registro: REGISTROS.MUNDO, texto: 'Levantar un mapa aquí' },
  { id: 'dejarlo', registro: REGISTROS.MUNDO, texto: 'Dejarlo estar' },
  { id: 'no-se-pudo', registro: REGISTROS.MUNDO, texto: 'Hoy este sitio no se deja dibujar. Vuelve a intentarlo en otro momento.' },
]);

/** El texto de una pieza del guion, o un error que la nombra. */
export function textoDelGuion(id) {
  const pieza = GUION.find((p) => p.id === id);
  if (!pieza) {
    throw new Error(`el guion del ofrecimiento no declara la pieza "${id}": las suyas son ${GUION.map((p) => p.id).join(', ')}`);
  }
  if (pieza.texto === null) {
    throw new Error(`la pieza "${id}" del guion del ofrecimiento no trae texto propio: su contenido sale de ${pieza.de}`);
  }
  return pieza.texto;
}

// --- El alcance y la extensión de un mapa -------------------------------------

/** El alcance de un mapa en metros: el tramo de quien anda hoy, por los tramos declarados. */
export function alcanceM(mapa, tramoM = null) {
  const tramo = Number.isFinite(tramoM) && tramoM > 0 ? tramoM : mapa.rejilla.tramoM;
  return tramo * ALCANCE_EN_TRAMOS;
}

/**
 * El rectángulo que ocupa un mapa, en metros desde su propio anclaje.
 *
 * Es la envolvente de sus **celdas abiertas** y no una rejilla infinita: una rejilla no
 * tiene bordes, así que sin esto no habría ningún sitio en el mundo que no fuera de
 * todos los mapas a la vez. Un mapa sin ninguna celda abierta ocupa la celda de su
 * anclaje, que es donde se levantó.
 */
export function extensionDeMapa(mapa) {
  const abiertas = celdasAbiertas(mapa);
  const celdas = abiertas.length ? abiertas.map((c) => c.celda) : [{ i: 0, j: 0 }];
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const celda of celdas) {
    const { metros } = limitesDeCelda(mapa.rejilla, celda);
    minX = Math.min(minX, metros.minX);
    minY = Math.min(minY, metros.minY);
    maxX = Math.max(maxX, metros.maxX);
    maxY = Math.max(maxY, metros.maxY);
  }
  return { minX, minY, maxX, maxY, celdas: celdas.length };
}

function exigePosicion(lat, lon, quien) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error(`${quien} necesita una posición válida y llegó lat=${JSON.stringify(lat) ?? String(lat)}, lon=${JSON.stringify(lon) ?? String(lon)}`);
  }
}

/**
 * A qué distancia del mapa está una posición: cero si cae dentro de su extensión, y si
 * no, lo que haya hasta el borde más cercano.
 */
export function distanciaAlMapa(mapa, lat, lon) {
  exigePosicion(lat, lon, 'la distancia a un mapa');
  const p = proyectorDeRejilla(mapa.rejilla).toXY(lat, lon);
  const e = extensionDeMapa(mapa);
  const dx = Math.max(e.minX - p.x, 0, p.x - e.maxX);
  const dy = Math.max(e.minY - p.y, 0, p.y - e.maxY);
  return Math.hypot(dx, dy);
}

// --- El mapa activo -----------------------------------------------------------

/**
 * Resuelve el mapa activo desde una posición. **No escribe nada y no abre nada**:
 * dice qué mapa es y qué celda toca, y quien llama decide si la abre.
 *
 * El desempate cuando dos mapas se solapan o quedan pegados es el declarado: primero
 * el que contiene la posición, después el más cercano, y a igualdad **el anclaje que
 * ordena primero** —que es el identificador del mapa desde SPEC-003—. Nunca el más
 * reciente ni el último usado: eso sería memoria de preferencia, y preguntar sería un
 * selector con otro nombre.
 *
 * @param {Array} mapas los de la partida, ya levantados.
 * @param {{ lat: number, lon: number, tramoM?: number }} donde
 */
export function resuelveMapaActivo(mapas, { lat, lon, tramoM = null } = {}) {
  exigePosicion(lat, lon, 'la resolución del mapa activo');
  if (!Array.isArray(mapas)) {
    throw new Error(`la resolución del mapa activo necesita la lista de mapas de la partida y llegó ${JSON.stringify(mapas) ?? String(mapas)}`);
  }
  // Una partida sin ningún mapa no es un error: es el primer día, o es que se está
  // lejos de todos. Las dos se contestan igual y quien pregunta decide qué hacer.
  const candidatos = [];
  for (const mapa of mapas) {
    const distanciaM = distanciaAlMapa(mapa, lat, lon);
    const limite = alcanceM(mapa, tramoM);
    if (distanciaM > limite) continue;
    candidatos.push({ mapa, distanciaM, dentro: distanciaM === 0, alcanceM: limite });
  }
  if (!candidatos.length) {
    return congelaHondo({ estado: 'ninguno', mapaId: SIN_MAPA_ACTIVO, mapa: null, celda: null, clave: null, distanciaM: null, pendienteDeAbrir: false });
  }
  candidatos.sort((a, b) => (
    a.dentro !== b.dentro ? (a.dentro ? -1 : 1)
      : a.distanciaM !== b.distanciaM ? a.distanciaM - b.distanciaM
        : a.mapa.id < b.mapa.id ? -1 : a.mapa.id > b.mapa.id ? 1 : 0
  ));
  const elegido = candidatos[0];
  const mapa = elegido.mapa;
  // La celda es la de la posición aunque esta caiga fuera de la extensión: la rejilla
  // sí es infinita, y lo que hay que abrir para que el mundo exista donde estás es
  // exactamente la celda que te contiene.
  const celda = celdaEnPosicion(mapa.rejilla, lat, lon);
  const clave = claveDeCelda(celda);
  const abierta = mapa.celdas.some((c) => c.clave === clave);
  return {
    estado: elegido.dentro ? 'dentro' : 'alcance',
    mapaId: mapa.id,
    mapa,
    celda,
    clave,
    distanciaM: elegido.distanciaM,
    alcanceM: elegido.alcanceM,
    // Se declara, no se abre: abrir consulta datos y esto es una función pura que se
    // puede preguntar dos veces sin que pase nada.
    pendienteDeAbrir: !abierta,
  };
}

/**
 * Si hay que ofrecer levantar un mapa. Es la misma pregunta que «no hay mapa activo»,
 * dicha en la palabra de la pantalla.
 */
export function hayQueOfrecerMapa(resolucion) {
  return resolucion.estado === 'ninguno';
}

/**
 * Compone el ofrecimiento de levantar un mapa.
 *
 * Sustituye a la portada y **no se superpone a ella**: una portada lleva un mapa
 * dentro y aquí no hay ninguno, así que enseñar la de casa estando a trescientos
 * kilómetros ofrecería salir a andar en un mundo donde no estás.
 *
 * @param {{ sitio: string, sinRed?: boolean }} opciones `sitio` es el lugar donde
 *   estás dicho con palabras, nunca una coordenada.
 */
export function componeOfrecimiento({ sitio, sinRed = false } = {}) {
  if (typeof sitio !== 'string' || !sitio) {
    throw new Error(`el ofrecimiento de levantar un mapa se compone sobre el sitio donde estás, dicho como lugar, y llegó ${JSON.stringify(sitio) ?? String(sitio)}`);
  }
  return congelaHondo({
    momento: MOMENTO,
    testid: TESTIDS.ofrecimiento,
    mapaActivo: SIN_MAPA_ACTIVO,
    sitio,
    titular: textoDelGuion('titular'),
    cuerpo: textoDelGuion('cuerpo'),
    // El momento en que no se pudo dibujar el mundo se dice en voz de mundo y sin
    // nombrar la red: lo que no funciona hoy es el sitio, no la conexión.
    aviso: sinRed ? textoDelGuion('no-se-pudo') : null,
    acciones: ACCIONES.map((a) => ({ ...a, texto: textoDelGuion(a.id) })),
    puertas: [...PUERTAS],
    // Las tres puertas siguen; salir a andar no: no se juega donde no estás.
    seSaleAAndar: false,
    // Rechazar no se recuerda: volver a abrir la app aquí vuelve a ofrecerlo, y no
    // queda ninguna marca. Recordar la negativa es media memoria de estado de
    // aplicación y crea un «¿por qué ya no me lo ofrece?» sin respuesta en voz de mundo.
    seRecuerdaElRechazo: false,
  });
}

// --- La lista de mapas de la partida ------------------------------------------

/**
 * Los mapas de la partida, cada uno con lo que declara de sí mismo.
 *
 * Es lo que alimenta el capítulo por mapa del diario (SPEC-037) y **no se enseña en
 * ningún otro sitio**: una lista de mapas fuera del diario es el selector volviendo por
 * la puerta de atrás.
 *
 * `pasos` es el estado de pasos de la partida, opcional: de él salen el contador y la
 * reserva **de cada mapa**, que es lo que sostiene que el mundo de casa no avanza en tu
 * ausencia. `rangos` llega inyectado por lo mismo que el resto: el rango se deriva de
 * lo que se ha oído en cada núcleo y esta capa no lo calcula.
 */
export async function listaDeMapas({ almacen, pasos = null, rangos = null } = {}) {
  exigeAlmacen(almacen, 'listaDeMapas');
  const claves = ((await almacen.lista('mapa/')) ?? []).filter((c) => /^mapa\/[^/]+\/indice\.json$/.test(c)).sort();
  const mapas = [];
  for (const clave of claves) {
    const id = /^mapa\/([^/]+)\/indice\.json$/.exec(clave)[1];
    const crudo = await almacen.lee(clave);
    if (crudo == null) throw new Error(`el almacén declara el índice del mapa ${id} y no lo puede leer`);
    const doc = compruebaIndice(lee(crudo, `el índice del mapa ${id}`), `el índice del mapa ${id}`);
    const registro = pasos?.mapas?.[id] ?? null;
    mapas.push({
      id,
      anclaje: { lat: doc.anclaje.lat, lon: doc.anclaje.lon },
      titulo: doc.titulo,
      idioma: doc.idioma,
      celdas: doc.celdas.map((c) => c.clave),
      // El contador y la reserva son **de este mapa y de ninguno más**: por eso volver
      // de tres semanas fuera es volver de tres días.
      pasos: registro ? registro.n : 0,
      enLaReserva: registro ? registro.reserva.length : 0,
      // Los rangos son por núcleo y de este mapa. No se copian de ningún otro: en un
      // mapa donde nadie ha oído hablar de ti vuelves a ser forastera, y eso ocurre
      // solo porque no hay nada que traer.
      rangos: rangos?.[id] ?? null,
    });
  }
  return congelaHondo(mapas);
}
