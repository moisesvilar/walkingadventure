// El seguidor de posición doblado: la frontera que SPEC-029 estrena para el momento en
// marcha. Doblarlo es lo de siempre en este proyecto —no se intercepta nada, se pasa otro
// argumento—, y lo que hace falta es que sean **tres y no uno**, porque el momento tiene
// que separar tres situaciones que se arreglan en sitios distintos:
//
// - **el que entrega un recorrido guionizado**, que es el caso normal y el que permite
//   recorrer el mismo camino dos veces y comparar lo que salió;
// - **el que deja de responder**, que devuelve `null` y no un error: el mapa se queda como
//   estaba y ninguna pantalla lo cuenta como avería del mundo;
// - **el que entrega velocidad de vehículo**, que se aparta de la validación de llegada.
//
// Y un cuarto que no es una situación sino una avería: **el que no está cableado**, que no
// trae `posicion()` y hace fallar la construcción del momento. Se dobla aparte a propósito,
// porque confundirlo con el que no responde es exactamente la confusión que el momento
// existe para no tener.
//
// Los cuatro llevan el recuento de lecturas. Sin él, «el mapa se quedó como estaba» sería
// fe: no hay manera de afirmar que se preguntó y no se obtuvo, frente a no haber preguntado.
//
// **Ninguno guarda una traza.** Lo que entregan es la posición de turno y nada más: no hay
// lista que crezca, y eso es parte de lo que se dobla, porque el contrato de privacidad
// (RF-PRIV-002) vive justo en esta frontera.
//
// Nada de aquí toca la red, el reloj ni el azar.

/** Las clasificaciones que el núcleo admite. Escritas, no importadas: un doble no importa del paquete. */
export const CLASIFICACIONES = Object.freeze(['andando', 'parada', 'vehiculo', 'ambiguo']);

/** Un punto del guion, con lo único que el seguidor entrega: clasificación, punto y sitio. */
export const paso = (clasificacion, x, y, sitio = null) => ({ clasificacion, x, y, sitio });

/** El recorrido de referencia: cuatro puntos andando hacia el este, sin sitio debajo. */
export const RECORRIDO = Object.freeze([
  paso('andando', 0, 0),
  paso('andando', 120, 0),
  paso('andando', 240, 0),
  paso('andando', 360, 0),
]);

function conRecuento(lee) {
  let lecturas = 0;
  return {
    montado: true,
    motivo: null,
    /** Cuántas veces se le ha pedido la posición. Lo que permite afirmar que sí se preguntó. */
    lecturas: () => lecturas,
    posicion() {
      lecturas += 1;
      return lee(lecturas);
    },
  };
}

/**
 * Un seguidor que recorre el guion que se le da, un punto por lectura, y **se queda en el
 * último**: quedarse quieto al final es lo que hace un recorrido, y agotarse lanzando
 * convertiría el final del guion en una avería que no existe.
 */
export function seguidorGuionizado(guion = RECORRIDO) {
  if (!Array.isArray(guion) || !guion.length) {
    throw new Error('el seguidor guionizado se monta con al menos un punto: sin guion no hay recorrido que reproducir');
  }
  return conRecuento((n) => {
    const p = guion[Math.min(n - 1, guion.length - 1)];
    return { clasificacion: p.clasificacion, x: p.x, y: p.y, sitio: p.sitio ?? null };
  });
}

/**
 * Un seguidor que responde `cuantas` veces y **deja de responder** después.
 *
 * Devuelve `null` y no lanza: dejar de responder es una respuesta prevista —un túnel, una
 * plaza con edificios altos— y el mapa se queda como estaba.
 */
export function seguidorQueDejaDeResponder({ guion = RECORRIDO, cuantas = 1 } = {}) {
  return conRecuento((n) => {
    if (n > cuantas) return null;
    const p = guion[Math.min(n - 1, guion.length - 1)];
    return { clasificacion: p.clasificacion, x: p.x, y: p.y, sitio: p.sitio ?? null };
  });
}

/**
 * Un seguidor en vehículo: entrega la clasificación ya hecha, como exige SPEC-004. El
 * núcleo no la calcula y este doble no la deduce de una velocidad: la declara.
 */
export function seguidorEnVehiculo({ x = 0, y = 0, sitio = null } = {}) {
  return conRecuento(() => ({ clasificacion: 'vehiculo', x, y, sitio }));
}

/** Un seguidor parado sobre un sitio, que es la posición desde la que abrir enseña la escena. */
export function seguidorParado({ x = 0, y = 0, sitio = null } = {}) {
  return conRecuento(() => ({ clasificacion: 'parada', x, y, sitio }));
}

/**
 * Un seguidor **que no está cableado**: no trae `posicion()`.
 *
 * No devuelve `null` ni lanza al leer, porque eso sería hacer pasar por una respuesta lo
 * que es una pieza que falta. El momento tiene que fallar al construirse, nombrándola.
 */
export function seguidorSinCablear() {
  return { montado: false, motivo: 'no cableado en esta prueba' };
}

/** Un seguidor que entrega una clasificación que no está en el enumerado. */
export function seguidorQueClasificaMal(clasificacion = 'corriendo') {
  return conRecuento(() => ({ clasificacion, x: 0, y: 0, sitio: null }));
}

/** Un seguidor que entrega una posición sin punto donde pintar la marca. */
export function seguidorSinPunto() {
  return conRecuento(() => ({ clasificacion: 'andando', x: null, y: undefined, sitio: null }));
}
