// Monta la orquestación del levantamiento del móvil sobre datos que no salen de la
// red: los cuatro extractos congelados de SPEC-001 entran por la misma frontera que
// usaría el Overpass del proyecto, y el reloj es el inyectable de `test/dobles/`.
//
// Existe por lo mismo que `mundo-de-prueba.mjs` y `celda-de-prueba.mjs`: cablear las
// cinco piezas a mano en cada prueba las convertiría en cinco cableados distintos, y
// el criterio que más importa de esta fila —que nada degrada por falta de cableado—
// dejaría de decir nada si cada prueba cableara a su manera.
//
// Nada de aquí toca la red, el reloj del sistema ni el disco de la partida: el
// almacén es el de memoria que la propia app inyecta, el reloj se avanza a mano y
// los datos de OSM se leen de fixtures.

import { creaAlmacenEnMemoria } from '../../app/datos/almacen.js';
import { creaCronometro } from '../../app/mapa/cronometro.js';
import { creaLevantamiento } from '../../app/mapa/levantamiento.js';
import { seSolapan } from '../../packages/nucleo/core/cajas.js';
import { HOLGURA } from '../../packages/nucleo/core/rotulos.js';
import { colocadorDeRotulos } from '../../packages/nucleo/render/colocador.js';
import { medidorNominal } from '../../packages/nucleo/render/medidor-nominal.js';
import { creaReloj } from '../dobles/reloj.mjs';
import { SEMILLA_A, SEMILLA_B, consultaDeFixture, coordenadaDe } from './celda-de-prueba.mjs';

/**
 * La semilla de partida de estas pruebas, y otra distinta. Salen de
 * `celda-de-prueba.mjs` y se reexportan para que una prueba de esta fila no tenga que
 * saber de dónde sale el azar de otra.
 */
export { SEMILLA_A as SEMILLA_DE_PRUEBA, SEMILLA_B as OTRA_SEMILLA };

/** El hueco de una pantalla de móvil, el mismo con el que mide el resto de la suite. */
export const TAMANO = Object.freeze({ ancho: 390, alto: 780 });

/**
 * El tramo declarado con el que se levantan los mapas de estas pruebas.
 *
 * Se fija aquí y no en cada prueba porque el tramo dimensiona los cupos de la celda:
 * dos pruebas con tramos distintos compararían mundos distintos sin decirlo.
 */
export const TRAMO_M = 700;

/** Las cuatro coordenadas reales de referencia, las mismas que capturaron los extractos. */
export const LAS_CUATRO = Object.freeze(['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso']);

/** La peor de las cuatro, y la que gobierna el presupuesto del minuto. */
export const LA_QUE_GOBIERNA = 'urbano-denso';

/** Un extracto de Galicia y otro del interior, para el idioma. */
export const EN_GALICIA = 'costero';
export const EN_EL_INTERIOR = 'urbano-denso';

/**
 * Monta el levantamiento con las cinco piezas cableadas.
 *
 * @param {object} [opciones]
 *   `consultaOsm` el traedor doblado; `nombre` el extracto que sirve si no se pasa
 *   traedor; `almacen` para reutilizar uno ya escrito; `reloj` el inyectable.
 * @returns {{ levantamiento, almacen, reloj, cronometro, consultaOsm }}
 */
export function montaLevantamiento({ nombre = 'costero', consultaOsm, almacen, reloj } = {}) {
  const elReloj = reloj ?? creaReloj();
  const elAlmacen = almacen ?? creaAlmacenEnMemoria();
  const elTraedor = consultaOsm ?? consultaDeFixture(nombre);
  const cronometro = creaCronometro({ ahora: elReloj.ahora });
  const levantamiento = creaLevantamiento({
    consultaOsm: elTraedor,
    almacen: elAlmacen,
    cronometro,
    colocador: colocadorDeRotulos,
    medidor: medidorNominal,
  });
  return { levantamiento, almacen: elAlmacen, reloj: elReloj, cronometro, consultaOsm: elTraedor };
}

/**
 * Levanta el mapa de un extracto en su coordenada real y devuelve el banco entero.
 *
 * Devuelve las piezas y no solo el resultado a propósito: casi todo lo que esta fila
 * afirma se afirma **después** de levantar —que reabrir no consulta, que arrastrar no
 * genera, que el documento no se toca—, y para eso hace falta el mismo banco.
 */
export async function levantaFixture(nombre = 'costero', opciones = {}) {
  const { desplaza = null, tamano = TAMANO, tramoM = TRAMO_M, ...resto } = opciones;
  const banco = montaLevantamiento({ nombre, ...resto });
  const c = coordenadaDe(nombre);
  const punto = desplaza ? { lat: c.lat + desplaza.lat, lon: c.lon + desplaza.lon } : { lat: c.lat, lon: c.lon };
  const resultado = await banco.levantamiento.levanta({
    ...punto,
    semilla: opciones.semilla ?? SEMILLA_A,
    tramoM,
    tamano,
    ...(opciones.estilo ? { estilo: opciones.estilo } : {}),
    ...(opciones.onFases ? { onFases: opciones.onFases } : {}),
  });
  return { ...banco, resultado, punto, coordenada: c, tamano, tramoM };
}

/** Todos los nombres de fantasía de un mundo levantado en el móvil. */
export function nombresDeLaCelda(documento) {
  return [
    ...documento.settlements.map((s) => s.name),
    ...documento.settlements.flatMap((s) => s.services).map((v) => v.name),
    ...documento.parajes.map((p) => p.name),
    ...documento.routes.map((r) => r.name),
  ].filter((n) => n != null);
}

/** Las cajas colocadas de una escena, con su identificador y su rol. */
export function cajasDe(escena) {
  return escena.colocacion.map((c) => ({ id: c.id, rol: c.rol, caja: c.caja }));
}

/** Las parejas de rótulos que se pisan. Vacía es la única respuesta aceptable. */
export function parejasQueSePisan(cajas) {
  const pares = [];
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      if (seSolapan(cajas[i].caja, cajas[j].caja, HOLGURA)) pares.push(`${cajas[i].id} ↔ ${cajas[j].id}`);
    }
  }
  return pares;
}

/**
 * `consultaOsm` que responde algo que no encaja con lo que se pidió.
 *
 * No es «devuelve poco»: es que la respuesta no trae la forma que el reparto espera,
 * que es lo que tiene que fallar nombrando lo que llegó en vez de generar un mundo
 * pobre en silencio.
 */
export function consultaQueNoEncaja(loQueLlega = { resultados: [] }) {
  const llamadas = [];
  const fn = async (peticion) => {
    llamadas.push(peticion);
    return loQueLlega;
  };
  fn.llamadas = llamadas;
  return fn;
}

/**
 * Un cliente del proxy doblado, para ejercitar el traedor de verdad.
 *
 * `pideGeneracion` es lo único que el traedor le pide, así que doblarlo es esto: la
 * frontera existe entera y se puede recorrer sin abrir una conexión.
 */
export function clienteDoblado({ elements = [], deCache = false, falla = null } = {}) {
  const consultas = [];
  return {
    consultas: () => consultas.map((q) => q),
    async pideGeneracion({ ql }) {
      consultas.push(ql);
      if (falla) throw falla instanceof Error ? falla : new Error(String(falla));
      return { elements, deCache };
    },
  };
}

/** Serialización completa: la única comparación que afirma «idéntico byte a byte». */
export const serializado = (valor) => JSON.stringify(valor);

/** La escena sin su pintura: lo que tiene que sobrevivir a un cambio de estilo. */
export function geometriaDe(escena) {
  return escena.primitivas.map(({ pintura, ...resto }) => resto);
}
