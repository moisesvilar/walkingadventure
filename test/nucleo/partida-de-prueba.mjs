// SPEC-009 · Lo que necesitan las pruebas de la partida guardada: celdas ya
// generadas sobre los mundos congelados, un almacén de mentira con las cuatro
// operaciones de la frontera, y las dos comparaciones que esta capa usa todo el
// rato —el texto entero y el contenido campo a campo—.
//
// Vive aquí y no en `test/dobles/` por lo mismo que `celda-de-prueba.mjs`: los
// dobles son de la frontera del núcleo (datos de OSM, GPS, reloj, proxy, red) y
// esto es andamiaje de prueba. Nada de aquí toca la red ni el reloj del sistema.

import { generaCelda } from '../../packages/nucleo/world/celda.js';
import { creaRejilla } from '../../packages/nucleo/world/rejilla.js';
import { SEMILLA_A, consultaDeFixture, coordenadaDe } from './celda-de-prueba.mjs';

/** Los cuatro mundos congelados de SPEC-001, que son los cuatro casos que el diseño distingue. */
export const LOS_CUATRO = ['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso'];

/** Las dos celdas sobre las que se afirma el ida y vuelta: la del arranque y una lejos del origen. */
export const DOS_CELDAS = [{ i: 0, j: 0 }, { i: 1, j: -2 }];

// Generar el urbano denso cuesta más de un segundo, y el ida y vuelta lo pide
// ocho veces. Las celdas salen congeladas de `generaCelda`, así que compartir la
// misma entre pruebas no puede contaminar a nadie: nadie puede modificarla.
const generadas = new Map();

/** La rejilla que corresponde a un mundo congelado, con el tramo que se le pida. */
export function rejillaDe(nombre, tramoM = 2000) {
  const { lat, lon } = coordenadaDe(nombre);
  return creaRejilla({ lat, lon, tramoM });
}

/**
 * La celda de un mundo congelado, ya generada. Memoizada por su clave completa:
 * dos pruebas que piden lo mismo reciben exactamente la misma celda.
 */
export async function celdaDeFixture(nombre, { celda = { i: 0, j: 0 }, tramoM = 2000, semilla = SEMILLA_A, ordenInvertido = false, places = null, demanda = null } = {}) {
  const clave = `${nombre}|${celda.i},${celda.j}|${tramoM}|${semilla}|${ordenInvertido}|${places ? JSON.stringify(places) : ''}|${demanda ? JSON.stringify(demanda) : ''}`;
  if (!generadas.has(clave)) {
    const rejilla = rejillaDe(nombre, tramoM);
    generadas.set(clave, await generaCelda({
      rejilla,
      semilla,
      mapaId: rejilla.id,
      celda,
      consultaOsm: consultaDeFixture(nombre, { ordenInvertido }),
      ...(places ? { places } : {}),
      ...(demanda ? { demanda } : {}),
    }));
  }
  return generadas.get(clave);
}

/**
 * Una respuesta de Places con dos sitios, para las celdas donde hace falta que el
 * pool tenga anclajes de Places: el barrio de tres calles no llega a la demanda con
 * lo que hay en OSM, y es ahí donde entran.
 */
export function placesDePrueba(nombre, { capturado = '2026-08-01' } = {}) {
  const { lat, lon } = coordenadaDe(nombre);
  return {
    capturado,
    resultados: [
      { place_id: 'ChIJ-A', types: ['restaurant'], name: 'Casa Manuela', location: { lat: lat + 0.001, lng: lon + 0.001 } },
      { place_id: 'ChIJ-B', types: ['park'], name: 'Parque do Sol', location: { lat: lat - 0.001, lng: lon - 0.001 } },
    ],
  };
}

/**
 * El almacén de la partida, en memoria: las cuatro operaciones de la frontera y
 * el registro de lo que se le pidió, que es lo que permite afirmar «al cargar el
 * mapa no se leyó ni una celda».
 */
export function almacenEnMemoria({ datos = new Map() } = {}) {
  const registro = [];
  return {
    datos,
    registro,
    operaciones: (tipo) => registro.filter((o) => o.op === tipo).map((o) => o.clave),
    async lee(clave) {
      registro.push({ op: 'lee', clave });
      return datos.has(clave) ? datos.get(clave) : null;
    },
    async escribe(clave, valor) {
      registro.push({ op: 'escribe', clave });
      datos.set(clave, valor);
    },
    async lista(prefijo) {
      registro.push({ op: 'lista', clave: prefijo });
      return [...datos.keys()].filter((k) => k.startsWith(prefijo)).sort();
    },
    async borra(clave) {
      registro.push({ op: 'borra', clave });
      datos.delete(clave);
    },
  };
}

/**
 * Un almacén que se cae al escribir. **No borra ni vacía nada antes de fallar**,
 * que es justo lo que hace un almacén real bien hecho: escribir y sustituir.
 */
export function almacenQueFallaAlEscribir({ mensaje = 'el disco está lleno', soloClavesQueContengan = null } = {}) {
  const almacen = almacenEnMemoria();
  const escribe = almacen.escribe.bind(almacen);
  almacen.escribe = async (clave, valor) => {
    if (soloClavesQueContengan == null || clave.includes(soloClavesQueContengan)) {
      almacen.registro.push({ op: 'escribe-fallida', clave });
      throw new Error(mensaje);
    }
    return escribe(clave, valor);
  };
  return almacen;
}

/**
 * Un valor comparable campo a campo.
 *
 * Los `Map` se comparan como diccionarios y **no por su orden de inserción**: ese
 * orden es lo único que un mundo levantado no reproduce —el grafo se reconstruye
 * recorriendo `nodeIds`, que sí sale idéntico— y afirmar sobre él contradiría el
 * escenario bloqueante «El orden de iteración no depende del orden de inserción»,
 * que dice que nada puede depender de por dónde se insertó. Lo que sí se compara
 * es el orden de cada lista de adyacencia, que es el que decide los empates de
 * Dijkstra.
 */
export function canoniza(valor) {
  if (valor === null || typeof valor !== 'object') {
    return typeof valor === 'number' && Object.is(valor, -0) ? '-0' : valor;
  }
  if (valor instanceof Map) {
    return { '#map': [...valor.entries()].map(([k, v]) => [String(k), canoniza(v)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)) };
  }
  if (valor instanceof Set) return { '#set': [...valor].map(canoniza) };
  if (ArrayBuffer.isView(valor)) return { '#bytes': Array.from(valor) };
  if (Array.isArray(valor)) return valor.map(canoniza);
  const out = {};
  for (const clave of Object.keys(valor).sort()) out[clave] = canoniza(valor[clave]);
  return out;
}

/** Las diferencias campo a campo entre dos valores, con su ruta. Lista vacía si son iguales. */
export function diferencias(a, b, ruta = 'mundo', out = [], tope = 20) {
  if (out.length >= tope) return out;
  const tipo = (v) => (v === null ? 'null' : Array.isArray(v) ? 'lista' : typeof v);
  if (tipo(a) !== tipo(b)) {
    out.push(`${ruta}: ${tipo(a)} en el generado y ${tipo(b)} en el levantado`);
    return out;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) {
      out.push(`${ruta}: ${a.length} elementos en el generado y ${b.length} en el levantado`);
      return out;
    }
    a.forEach((v, i) => diferencias(v, b[i], `${ruta}[${i}]`, out, tope));
    return out;
  }
  if (a !== null && typeof a === 'object') {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    const soloA = ka.filter((k) => !kb.includes(k));
    const soloB = kb.filter((k) => !ka.includes(k));
    if (soloA.length) out.push(`${ruta}: solo en el generado ${soloA.join(', ')}`);
    if (soloB.length) out.push(`${ruta}: solo en el levantado ${soloB.join(', ')}`);
    for (const k of ka.filter((k) => kb.includes(k))) diferencias(a[k], b[k], `${ruta}.${k}`, out, tope);
    return out;
  }
  if (!Object.is(a, b)) out.push(`${ruta}: ${JSON.stringify(a)} en el generado y ${JSON.stringify(b)} en el levantado`);
  return out;
}

/**
 * Recorre un documento entero y llama a `visita(ruta, valor)` en cada nodo.
 *
 * Es la forma de afirmar una ausencia sobre un documento —«en ningún campo hay una
 * posición del jugador»— sin depender de que el esquema se lea a mano.
 */
export function recorreDocumento(valor, visita, ruta = 'documento') {
  visita(ruta, valor);
  if (valor === null || typeof valor !== 'object') return;
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => recorreDocumento(v, visita, `${ruta}[${i}]`));
    return;
  }
  for (const [clave, v] of Object.entries(valor)) recorreDocumento(v, visita, `${ruta}.${clave}`);
}

/** Todas las hojas de texto de un documento, con su ruta. */
export function textosDe(doc) {
  const out = [];
  recorreDocumento(doc, (ruta, valor) => {
    if (typeof valor === 'string') out.push({ ruta, valor });
  });
  return out;
}

/** Los bytes que ocupa un documento escrito, sin comprimir. */
export function bytesDe(texto) {
  return Buffer.byteLength(texto, 'utf8');
}

export const KB = 1024;
export const MB = 1024 * 1024;

/** Una copia modificable de un objeto congelado, con los mismos hijos. */
export const modificable = (objeto, cambios = {}) => ({ ...objeto, ...cambios });

/** Un registro de celda con su mundo alterado en un solo campo, para las pruebas de validación. */
export function celdaConMundoAlterado(registro, cambios) {
  return modificable(registro, { mundo: modificable(registro.mundo, cambios) });
}

/**
 * Convierte una secuencia del GPS simulado en la traza clasificada que el núcleo
 * recibe. Es el mismo clasificador de juguete que usa `ritmo.test.mjs`: quien
 * clasifica de verdad es la fila 31, que todavía no existe.
 */
export function trazaDesdeRecorrido(posiciones) {
  const R_TIERRA = 6371000;
  const rad = Math.PI / 180;
  const metrosEntre = (a, b) => {
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const lat = ((a.lat + b.lat) / 2) * rad;
    const x = dLon * Math.cos(lat);
    return Math.sqrt(dLat * dLat + x * x) * R_TIERRA;
  };
  const segmentos = [];
  for (let k = 1; k < posiciones.length; k++) {
    const metros = metrosEntre(posiciones[k - 1], posiciones[k]);
    const duracionS = (posiciones[k].tMs - posiciones[k - 1].tMs) / 1000;
    const ultimo = segmentos[segmentos.length - 1];
    if (ultimo && ultimo.clasificacion === posiciones[k].modo) {
      ultimo.metros += metros;
      ultimo.duracionS += duracionS;
    } else {
      segmentos.push({ metros, duracionS, clasificacion: posiciones[k].modo });
    }
  }
  return segmentos;
}
