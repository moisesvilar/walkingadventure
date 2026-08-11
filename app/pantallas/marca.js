// Las marcas del sistema de diseño: el estado del momento, el paso en curso, el motivo de
// un fallo, el volcado de una colocación. No son interfaz —no se leen, no se tocan, no
// ocupan sitio en la composición— pero **sí tienen que ser observables**, porque su único
// cometido es que una prueba las pueda alcanzar (`design-system.md`: «un identificador por
// elemento que una prueba necesite alcanzar»).
//
// Nacieron como `{ width: 0, height: 0 }` y eso las hacía inobservables: un nodo de cero por
// cero llega al árbol de accesibilidad de Android con `Rect(0, 0 - 0, 0)` y `visible: false`,
// y Maestro lo descarta con «Skipping invisible child» antes de que ningún selector lo vea.
// `assertVisible` sobre ellas no podía pasar nunca, en ninguna máquina. Se resuelve por el
// lado de hacerlas observables y no por el de quitar las afirmaciones de los flujos: una
// marca que ninguna prueba puede leer no es una marca, es un comentario.
//
// Un punto de un píxel independiente de densidad, sin fondo ni contenido: no se ve, no se
// toca y no desplaza nada, porque va fuera del flujo. Un tamaño mayor tampoco haría falta y
// uno menor volvería al mismo sitio.

/** El estilo de una marca dentro del flujo de su pantalla. */
export const MARCA = { width: 1, height: 1 };

/**
 * El estilo de una marca superpuesta, la que no debe empujar a nada de su alrededor.
 *
 * `top` y `left` van explícitos y no por la posición estática que le tocaría en el flujo:
 * medido, una absoluta sin anclar dentro de un contenedor centrado llegaba al árbol con el
 * rectángulo dado la vuelta —`Rect(63, 507 - 3, 510)`, con el borde derecho a la izquierda
 * del izquierdo— y volvía a salir como `visible: false`. Anclada a la esquina del contenedor
 * el rectángulo es siempre el mismo y siempre legible.
 */
export const MARCA_SUPERPUESTA = { position: 'absolute', top: 0, left: 0, width: 1, height: 1 };

/**
 * El estilo de **una marca superpuesta entre varias**, apartada de sus hermanas.
 *
 * Es la misma forma de fallo que arriba, un paso más allá y descubierta el 11-ago-2026: seis
 * marcas del momento en marcha caían las seis en el mismo `[0,0][3,3]`, apiladas, y Maestro
 * descarta como invisible todo lo que tapa un hermano. Que sean 1×1 no basta si están todas
 * en el mismo punto: **ninguna de las seis se podía afirmar**. Arreglar 0×0 y dejar el
 * apilamiento es arreglar la mitad del problema.
 *
 * Cada una se aparta un punto independiente de densidad a la derecha, así que sus rectángulos
 * no se tocan. Sigue sin verse, sigue sin tocarse y sigue sin desplazar nada, porque va fuera
 * del flujo; un punto por marca es un coste que no existe.
 *
 * `fila` es para las marcas de un **envoltorio**, que viven en otro contenedor y no pueden
 * coordinar su numeración con las de la pantalla que envuelven: con `fila: 1` no chocan con
 * las de dentro sea cual sea el número que aquellas usen.
 */
export function marcaSuperpuesta(n = 0, { fila = 0 } = {}) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`una marca superpuesta se aparta por su número de orden y llegó ${JSON.stringify(n) ?? String(n)}`);
  }
  return { position: 'absolute', top: fila, left: n, width: 1, height: 1 };
}
