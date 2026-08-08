// Congelar de verdad lo que ya está generado: un objeto entregado al llamante no
// puede volverse la puerta por la que se modifica lo que hay registrado en la
// partida. `Object.freeze` solo protege el primer nivel, y un mundo es hondo.

/**
 * Congela un valor y todo lo que cuelga de él, en sitio.
 *
 * Se congela en lugar de copiar a propósito: una copia por entrega convertiría
 * «lo generado no se resiembra» en «lo generado se duplica cada vez que alguien
 * lo mira», y el mundo de una celda no es pequeño.
 */
export function congelaHondo(valor) {
  if (valor === null || typeof valor !== 'object' || Object.isFrozen(valor)) return valor;
  // Las vistas sobre un ArrayBuffer —la máscara tierra/mar es un Uint8Array— no se
  // pueden congelar con elementos dentro: `Object.freeze` lanza. Se dejan como
  // están en lugar de copiarlas a un array normal, que multiplicaría por ocho lo
  // que ocupa la máscara para proteger un dato que ninguna fase reescribe.
  if (ArrayBuffer.isView(valor)) return valor;
  Object.freeze(valor);
  for (const v of Object.values(valor)) congelaHondo(v);
  return valor;
}
