// El proveedor de ubicación doblado: los tres que el arranque tiene que distinguir.
//
// Es la frontera que SPEC-027 estrena, y doblarla es lo de siempre en este proyecto:
// no se intercepta nada, se pasa otro argumento. Lo que sí hace falta es que sean
// **tres y no dos**, porque el arranque tiene que separar tres situaciones que se
// arreglan en sitios distintos: conceder, denegar —que es una respuesta prevista y
// continúa por la vía manual— y no poder preguntar, que es una avería.
//
// Los tres llevan el recuento de veces que se les ha pedido el permiso. Sin él, «se
// pasó a A1P4 sin haber pedido ningún permiso» sería fe: no hay manera de afirmar una
// ausencia mirando el estado de después.
//
// Nada de aquí toca la red, el reloj ni el azar.

/** La posición fija que devuelve el que concede. Arbitraria y constante. */
export const POSICION_CONCEDIDA = Object.freeze({ lat: 42.4037, lon: -8.8113 });

/** Un punto por defecto para la vía manual, distinto del anterior a propósito. */
export const PUNTO_POR_DEFECTO = Object.freeze({ lat: 42.4312, lon: -8.6444 });

function conRecuento(pide) {
  const peticiones = [];
  return {
    montado: true,
    motivo: null,
    /** Cuántas veces se ha pedido el permiso. Lo que permite afirmar que no se pidió. */
    peticiones: () => peticiones.length,
    async pide() {
      peticiones.push(true);
      return pide();
    },
  };
}

/** Concede el permiso y entrega una posición fija. */
export function ubicacionQueConcede(posicion = POSICION_CONCEDIDA) {
  return conRecuento(() => ({ concedido: true, posicion: { lat: posicion.lat, lon: posicion.lon } }));
}

/**
 * Deniega. Devuelve `concedido: false` **sin error**: denegar es una respuesta
 * prevista y el arranque tiene que continuar, no rescatar a nadie.
 */
export function ubicacionQueDeniega() {
  return conRecuento(() => ({ concedido: false, posicion: null }));
}

/**
 * Lanza al pedir el permiso. No es haber denegado: es no poder preguntar, y la
 * pantalla lo dice sin cerrar la vía manual.
 */
export function ubicacionQueLanza(mensaje = 'el diálogo del sistema no se pudo abrir') {
  return conRecuento(() => {
    throw new Error(mensaje);
  });
}
