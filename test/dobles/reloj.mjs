// Reloj inyectable del servidor. No es el reloj de mundo de `reloj-mundo.mjs`: aquel
// avanza por kilómetros andados, este es el `{ahora}` que el proxy usa para dos cosas y
// nada más —decidir a qué día natural suma un contador y caducar fichas, retos y lotes—.
//
// Existe porque la spec del proxy prohíbe el reloj real en las pruebas y porque hay
// afirmaciones que sólo se pueden escribir moviendo el tiempo a mano: que una ficha
// caduca a los siete días, que la métrica cambia de día, que las fichas gastadas se
// barren cuando su época muere. Esperar a que eso pase de verdad no es una prueba lenta,
// es una prueba imposible.

/** Un instante fijo y declarado, para que dos ejecuciones empiecen en el mismo sitio. */
export const ORIGEN = Date.UTC(2026, 2, 15, 9, 0, 0);

export const SEGUNDO = 1000;
export const MINUTO = 60 * SEGUNDO;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

/**
 * @param {number} [desde=ORIGEN] instante inicial en milisegundos.
 * @returns {{ahora: () => number, avanza: (ms: number) => number, fija: (ms: number) => number}}
 *   `ahora` es la única forma que el proxy ve: el resto son mandos de la prueba.
 */
export function creaReloj(desde = ORIGEN) {
  let t = desde;
  return {
    ahora: () => t,
    /** Mueve el reloj hacia delante. Nunca hacia atrás: un reloj que retrocede oculta caducidades. */
    avanza(ms) {
      if (!Number.isFinite(ms) || ms < 0) throw new Error(`el reloj sólo avanza: llegó ${ms}`);
      t += ms;
      return t;
    },
    /** Coloca el reloj en un instante concreto, para empezar un día natural exacto. */
    fija(ms) {
      t = ms;
      return t;
    },
  };
}
