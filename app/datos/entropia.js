// El origen de entropía de la semilla de la partida: el único azar de verdad del
// proyecto, y por eso vive en la app y entra en el núcleo por la firma.
//
// Dentro de `packages/nucleo/` el azar sin semilla está prohibido (RNF-DET-001) y
// `creaSemilla` lo hace cumplir exigiendo que la entropía llegue de fuera. Quien la
// trae es el arranque, una sola vez por partida: a partir de ahí, todo lo que ocurre
// cuelga de la semilla resultante y no se vuelve a sortear nada.
//
// **De dónde sale se declara**, no se supone. `crypto.getRandomValues` no está en
// todos los motores donde esto corre, y un respaldo silencioso a `Math.random` dejaría
// dos calidades de semilla indistinguibles desde fuera. Aquí se dice cuál se usó.

/** Los orígenes posibles, en orden de preferencia. */
export const ORIGENES = Object.freeze(['crypto', 'math']);

/** Cuántos símbolos pide `creaSemilla`. Se le dan de sobra y él coge los que necesita. */
const VALORES = 15;

/**
 * Un origen de entropía, con su procedencia declarada.
 *
 * @returns `{ origen, valores }` — `valores` es la secuencia de enteros que
 *   `creaSemilla` acepta, y `origen` dice de dónde salieron.
 */
export function entropiaDelDispositivo(fuente = globalThis.crypto) {
  if (fuente && typeof fuente.getRandomValues === 'function') {
    const bytes = new Uint8Array(VALORES);
    fuente.getRandomValues(bytes);
    return { origen: 'crypto', valores: Array.from(bytes) };
  }
  // Sin generador criptográfico se usa el del motor y **se dice**. Para una semilla de
  // setenta y cinco bits que solo tiene que no repetirse entre instalaciones, la
  // calidad basta; lo que no basta es no saber cuál se usó.
  const valores = [];
  for (let i = 0; i < VALORES; i++) valores.push(Math.floor(Math.random() * 256));
  return { origen: 'math', valores };
}
