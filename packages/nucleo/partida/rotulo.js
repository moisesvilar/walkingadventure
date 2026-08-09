// El rótulo del sistema, como **datos**: la línea que se lee en la pantalla de
// bloqueo, la única acción que se puede tocar mientras se anda, y el plazo tras el
// cual se retira solo.
//
// Aquí no se pinta nada. Quien lo pinta es la capa de plataforma —un servicio en
// primer plano con notificación persistente en Android, una Actividad en Vivo en
// iOS—, y por eso lo que este módulo entrega es una línea y una acción y no una
// vista: es lo que permite afirmar en `node --test` que el rótulo no lleva ni una
// cifra, que es la condición con la que `seguridad-privacidad.md` §2 acepta que la
// app siga leyendo la ubicación con la pantalla apagada.
//
// La austeridad no es minimalismo: es el precio del permiso «mientras se usa». Cada
// dato de más aquí es una razón para sacar el móvil, y el momento en marcha existe
// para no darla.

import { congelaHondo } from '../core/congelar.js';
import { infraccionesDeTexto } from '../names/lenguaje.js';
import { cuentaParaElMotorDePasos } from './ritmo.js';

/**
 * El plazo tras el cual el rótulo se retira solo: **noventa minutos de tiempo del
 * sensor sin un solo metro propio**.
 *
 * El número lo pone esta capa porque `bucle-jugable.md` §9 dice «un buen rato» y nada
 * más. Sesenta minutos retiraría el rótulo en mitad de una comida, que §8 protege
 * explícitamente; cuatro horas dejan un servicio nuestro corriendo media tarde sin que
 * nadie ande, que es lo que §9 prohíbe. Y noventa cabe cómodamente por debajo del tope
 * de vida de una Actividad en Vivo — esa holgura es `revisaElPlazo()`, no un comentario.
 */
export const PLAZO_DE_RETIRADA_MS = 90 * 60 * 1000;

/**
 * El tope de vida que el sistema impone a una Actividad en Vivo de iOS: ocho horas
 * activa. Es el más corto de las dos plataformas —el servicio en primer plano de
 * Android no tiene tope declarado, lo mata la memoria y no un reloj— y por eso es
 * contra este contra el que se compara el plazo del juego.
 */
export const TOPE_DE_ACTIVIDAD_EN_VIVO_MS = 8 * 60 * 60 * 1000;

/** Los topes de vida por plataforma. `null` significa «sin tope de reloj», no «infinito». */
export const TOPES_DE_PLATAFORMA_MS = congelaHondo({
  ios: TOPE_DE_ACTIVIDAD_EN_VIVO_MS,
  android: null,
});

/** El tope más corto de las dos plataformas, que es el que manda sobre el plazo. */
export const TOPE_MAS_CORTO_MS = TOPE_DE_ACTIVIDAD_EN_VIVO_MS;

/**
 * El literal de la única acción del rótulo. **Fijo y el mismo en las dos
 * plataformas**: lo que difiere entre iOS y Android es el ciclo de vida, nunca el
 * texto, y Maestro localiza el rótulo en la pantalla de bloqueo por este literal.
 */
export const ACCION_DEL_ROTULO = congelaHondo({
  id: 'rotulo-terminar',
  texto: 'Dar la salida por terminada',
});

/**
 * Las acciones que el rótulo **no** tiene, nombradas para que su ausencia se pueda
 * poner roja. Cualquier segunda acción convierte el rótulo en un panel y da una razón
 * para sacar el móvil.
 */
export const ACCIONES_QUE_EL_ROTULO_NO_TIENE = congelaHondo([
  'pausar',
  'ver-el-mapa',
  'descartar',
  'abrir-la-app',
  'saltar-el-beat',
]);

/**
 * Las palabras de esfuerzo que ninguna línea del rótulo puede llevar. Van como
 * palabras y no como conceptos a propósito: comprobar que la palabra no aparece es
 * barato y es exactamente el criterio.
 */
export const PALABRAS_DE_ESFUERZO = congelaHondo([
  'kilómetro', 'kilómetros', 'km', 'metro', 'metros', 'minuto', 'minutos', 'hora', 'horas',
  'ritmo', 'paso', 'pasos', 'progreso', 'restante', 'restantes', 'faltan', 'falta',
  'calorías', 'velocidad', 'racha', 'porcentaje',
]);

/** Lo que el rótulo no enseña nunca, más allá de las cifras. Es la lista de A3P1. */
export const LO_QUE_EL_ROTULO_NO_LLEVA = congelaHondo([
  'distancia-recorrida',
  'distancia-que-falta',
  'tiempo',
  'ritmo',
  'numero-de-beats',
  'progreso',
  'oro',
  'reputacion',
  'estado-de-un-nucleo',
  'miniatura-del-mapa',
]);

/**
 * Que el plazo del juego cabe por debajo del tope de plataforma más corto.
 *
 * Es una **comprobación y no un comentario**: si alguien sube el plazo por encima del
 * tope, el rótulo se apagaría solo antes de que el juego lo retirase y la retirada por
 * el sistema pasaría a ser el caso normal en lugar de la excepción del riesgo 4.
 */
export function revisaElPlazo({ plazoMs = PLAZO_DE_RETIRADA_MS, topeMs = TOPE_MAS_CORTO_MS } = {}) {
  if (!(plazoMs > 0)) throw new Error(`el plazo de retirada del rótulo llegó como ${plazoMs} ms y hacen falta milisegundos positivos`);
  if (!(plazoMs < topeMs)) {
    throw new Error(
      `el plazo de retirada del rótulo (${plazoMs} ms) no cabe por debajo del tope de vida más corto de las dos plataformas (${topeMs} ms): ` +
      'el sistema apagaría el rótulo antes que el juego, y la retirada por el sistema dejaría de ser la excepción',
    );
  }
  return congelaHondo({ cabe: true, plazoMs, topeMs, holguraMs: topeMs - plazoMs });
}

// Se ejecuta al importar: es la única manera de que la comparación no dependa de que
// alguien se acuerde de llamarla.
revisaElPlazo();

/**
 * Si una posición reinicia el plazo. **Se lee del mismo sitio que lo lee el motor de
 * pasos** y no se reimplementa: andando cuenta, ambiguo cuenta, vehículo no cuenta y
 * parada tampoco.
 *
 * La asimetría juega a favor: un falso ambiguo mantiene el rótulo puesto un rato de
 * más, que no le quita nada a nadie; un falso vehículo lo retiraría antes de tiempo.
 */
export function reiniciaElPlazo(clasificacion) {
  return cuentaParaElMotorDePasos(clasificacion);
}

/**
 * Si el plazo se ha agotado. Compara **dos marcas del sensor**, nunca el reloj del
 * sistema: es lo que permite afirmar noventa minutos en `node --test` sin esperarlos.
 */
export function plazoAgotado({ ultimoPropioMs, tMs, plazoMs = PLAZO_DE_RETIRADA_MS }) {
  if (!Number.isInteger(ultimoPropioMs) || !Number.isInteger(tMs)) {
    throw new Error(
      `el plazo del rótulo se mide entre dos marcas del sensor y llegaron ultimoPropioMs=${JSON.stringify(ultimoPropioMs)} y tMs=${JSON.stringify(tMs)}`,
    );
  }
  return tMs - ultimoPropioMs >= plazoMs;
}

/**
 * Pasa una línea del rótulo por el cribado: **ni una cifra y ni una palabra de
 * esfuerzo**. Falla nombrando la línea en lugar de dejarla llegar a la pantalla de
 * bloqueo, que es donde nadie la revisaría.
 */
export function revisaLineaDelRotulo(linea, quien = 'la línea del rótulo', { locale = 'es' } = {}) {
  if (typeof linea !== 'string' || !linea) {
    throw new Error(`${quien} llega como ${JSON.stringify(linea) ?? String(linea)} y el rótulo la necesita escrita`);
  }
  const digito = linea.match(/\d/);
  if (digito) {
    throw new Error(`${quien} lleva un dígito ("${digito[0]}"): el rótulo no enseña ninguna cifra — "${linea}"`);
  }
  const cifras = infraccionesDeTexto(linea, { locale }).filter((i) => i.familia === 'cifras');
  if (cifras.length) {
    throw new Error(`${quien} lleva una cifra ("${cifras[0].fragmento}"): el rótulo no enseña ninguna, ni siquiera escrita — "${linea}"`);
  }
  const bajado = linea.toLocaleLowerCase('es');
  for (const palabra of PALABRAS_DE_ESFUERZO) {
    if (new RegExp(`(^|[^\\p{L}])${palabra}([^\\p{L}]|$)`, 'iu').test(bajado)) {
      throw new Error(`${quien} dice "${palabra}", que es una palabra de esfuerzo: el rótulo dice hacia dónde vas y nada más — "${linea}"`);
    }
  }
  return linea;
}

/**
 * Compone el rótulo: **una línea y una acción**.
 *
 * Con aventura aceptada la línea nombra el sitio del beat vigente —«Vas hacia
 * Monfrida.»—; sin aventura, la salida abierta desde «salir a andar sin más» dice por
 * dónde se anda —«Andando por ‹mundo›.»—. Ninguna otra variante, y ninguna lleva un
 * número.
 *
 * El nombre del destino y el del mundo **llegan hechos**: los produjo el paquete de
 * idioma del mundo, así que en un mundo gallego el rótulo dice el nombre gallego sin
 * que este módulo sepa en qué idioma está.
 *
 * @param {object} opciones
 *   `destino` el nombre del sitio del beat vigente, o `null`; `mundo` el título del
 *   mundo, que es lo que se dice cuando no hay aventura.
 * @returns `{ linea, accion, acciones, tocables, dibuja }`, congelado.
 */
export function componeRotulo({ destino = null, mundo = null, locale = 'es' } = {}) {
  if (destino != null && (typeof destino !== 'string' || !destino)) {
    throw new Error(`el destino del rótulo llegó como ${JSON.stringify(destino) ?? String(destino)}: o es el nombre de un sitio del mundo, o no hay ninguno`);
  }
  if (destino == null && (typeof mundo !== 'string' || !mundo)) {
    throw new Error(
      'el rótulo de una salida sin aventura dice por dónde se anda y no llegó el título del mundo: sin él la línea quedaría vacía, ' +
      'y un rótulo sin línea es un servicio corriendo sin decir para qué',
    );
  }

  const linea = destino ? `Vas hacia ${destino}.` : `Andando por ${mundo}.`;
  revisaLineaDelRotulo(linea, 'la línea compuesta del rótulo', { locale });

  return congelaHondo({
    linea,
    // El nombre de la aplicación lo pone el sistema y no se compone aquí.
    accion: { ...ACCION_DEL_ROTULO },
    acciones: [{ ...ACCION_DEL_ROTULO }],
    // Exactamente una, y es el criterio.
    tocables: 1,
    // Devuelve datos: quien lo pinta es la plataforma.
    dibuja: false,
  });
}
