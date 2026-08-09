// Monta el proxy ciego entero en memoria, con todo lo que la frontera de inyección
// permite doblar: los cuatro proveedores de aguas arriba, el verificador de atestación,
// el reloj y la generación de claves de ficha.
//
// Existe porque cablear el proxy son ocho piezas y hacerlo a mano en cada caso es la
// forma conocida de que dos pruebas acaben probando montajes distintos. Aquí se monta
// una vez, y lo que cada prueba cambia es lo que esa prueba mira.
//
// Sin red, sin credenciales y sin reloj real: es la propiedad que hace que el proxy sea
// afirmable con `node --test`, y la que hay que romper para que estas pruebas dejen de
// valer.

import { cargaConfig } from '../../server/config.mjs';
import { creaProxy } from '../../server/proxy.mjs';

import { creaAguasArribaDobladas } from './aguas-arriba.mjs';
import { creaVerificadorDoblado, generaClave1024 } from './atestacion.mjs';
import { creaReloj } from './reloj.mjs';

/**
 * El entorno mínimo con el que el proxy arranca: sólo el parámetro obligatorio.
 *
 * `TOPE_DIARIO_GASTO` está a un número holgado y no a uno realista a propósito: las
 * pruebas que verifican el tope lo bajan ellas, y las que no lo verifican no deberían
 * chocar con él sin querer y dar por buena una respuesta «no hay» que llegó por el
 * motivo equivocado.
 */
export const ENTORNO_MINIMO = Object.freeze({ TOPE_DIARIO_GASTO: '100000' });

/**
 * @param {object} [opciones]
 * @param {object} [opciones.entorno]  se funde sobre `ENTORNO_MINIMO`. Valores en texto,
 *   como los lee `cargaConfig` del entorno de verdad.
 * @param {object} [opciones.reloj]
 * @param {object} [opciones.verificador]
 * @param {object} [opciones.aguasArriba]
 * @param {object} [opciones.almacenes]  por entrada declarada; lo que falte va en memoria.
 * @param {Array} [opciones.escriturasExtra]  para poder afirmar que una escritura sin
 *   declarar impide arrancar.
 */
export function montaProxy({
  entorno = {},
  reloj = creaReloj(),
  verificador = creaVerificadorDoblado(),
  aguasArriba = creaAguasArribaDobladas(),
  almacenes = {},
  escriturasExtra = [],
  generaClave = generaClave1024,
} = {}) {
  const config = cargaConfig({ ...ENTORNO_MINIMO, ...entorno });
  const proxy = creaProxy({ config, reloj, verificador, aguasArriba, almacenes, escriturasExtra, generaClave });
  return { proxy, config, reloj, verificador, aguasArriba };
}

/** Atajo: una petición de contenido con su ficha y, si hace falta, su lote. */
export function peticionDe(tipo, { ficha = null, lote = null, ...campos } = {}) {
  const cuerpo = { peticion: campos };
  if (ficha) cuerpo.ficha = ficha;
  if (lote) cuerpo.lote = lote;
  return { ruta: `/${tipo}`, cuerpo };
}

/** Las peticiones de ejemplo de cada ruta, para que dos pruebas no inventen prompts distintos. */
export const EJEMPLOS = Object.freeze({
  texto: Object.freeze({ prompt: 'el puente viejo', idioma: 'es', tono: 'sobrio' }),
  imagen: Object.freeze({ prompt: 'el puente viejo', formato: { tipo: 'png', ancho: 512, alto: 512 } }),
  places: Object.freeze({ place_id: 'ChIJfixture0001' }),
  generacion: Object.freeze({ consulta: { ql: '[out:json];node(42.40,-8.82,42.41,-8.80);out;' } }),
});

/** Agrupa el recorrido de la superficie por entrada: `{entrada: [claves]}`. */
export function porEntrada(recorrido) {
  const salida = {};
  for (const { entrada, clave } of recorrido) (salida[entrada] ??= []).push(clave);
  return salida;
}

/** Cuántas filas hay escritas en cada entrada. Es lo que se compara con la cifra declarada. */
export function conteoPorEntrada(recorrido) {
  const salida = {};
  for (const { entrada } of recorrido) salida[entrada] = (salida[entrada] ?? 0) + 1;
  return salida;
}

/**
 * Todo lo escrito, en texto plano y de una pieza: claves, valores y nombres de entrada.
 *
 * Es el instrumento de los criterios `@privacidad`, y su forma es deliberada. Afirmar
 * «no se guarda la IP» campo a campo obliga a saber qué campos hay, y lo que hay que
 * poder afirmar es lo contrario: que no aparece **en ningún sitio**, incluidos los sitios
 * que nadie previó. Un buscador sobre el volcado entero se pone rojo también cuando el
 * dato se cuela por una vía nueva.
 */
export function todoLoEscrito(recorrido) {
  return JSON.stringify(recorrido);
}
