// El colocador provisional de rótulos: cada rótulo se queda en el anclaje de su
// elemento, exactamente como hace el prototipo. **Puede solapar, y se declara**:
// el algoritmo que garantiza que ninguna caja pisa a otra es de la fila 22
// (RF-MAPA-003) y entra por este mismo argumento, sin tocar ni el módulo que
// compone la escena ni el que ejecuta el dibujo. Esa es toda la deuda de SPEC-021.

/** Lo que este colocador promete y lo que no, como dato y no como comentario. */
export const COLOCADOR_SIMPLE = Object.freeze({
  id: 'simple',
  provisional: true,
  puedeSolapar: true,
  motivo: 'coloca cada rótulo en su anclaje, como el prototipo; el que no solapa es de la fila 22',
});

/**
 * Coloca todos los rótulos de una lámina de una vez.
 *
 * @param {Array<{ id: string, ancla: { x: number, y: number } }>} rotulos todos los
 *   del mapa, con su rol, su texto, su anclaje y la medida de su caja.
 * @returns {Array<{ id: string, x: number, y: number }>} la posición de todos.
 */
export function colocadorSimple(rotulos) {
  return rotulos.map((rotulo) => ({ id: rotulo.id, x: rotulo.ancla.x, y: rotulo.ancla.y }));
}

/**
 * Cuántos pares de cajas se solapan con las posiciones dadas.
 *
 * No lo usa el pintado: existe para que la deuda sea medible en lugar de
 * declarada, y para que la fila 22 tenga contra qué comparar.
 */
export function solapes(rotulos, puestos) {
  const porId = new Map(puestos.map((p) => [p.id, p]));
  const cajas = rotulos
    .filter((r) => porId.has(r.id))
    .map((r) => {
      const { x, y } = porId.get(r.id);
      return { id: r.id, x0: x - r.medida.ancho / 2, x1: x + r.medida.ancho / 2, y0: y, y1: y + r.medida.alto };
    });
  let cuenta = 0;
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) cuenta++;
    }
  }
  return cuenta;
}
