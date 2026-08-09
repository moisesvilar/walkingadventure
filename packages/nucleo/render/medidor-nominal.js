// El medidor nominal: mide un texto con anchos fijos por carácter, sin tipografías
// y sin plataforma. No sustituye al de Skia —el que mide de verdad es el de la
// app—: existe para poder componer escenas en Node, que es lo que hace verificable
// casi toda SPEC-021 en una máquina sin simulador, y para que la medida sea la
// misma entre dos ejecuciones y entre dos revisiones.

/**
 * Avance de cada clase de carácter en fracción del tamaño de la tipografía. Los
 * tres tramos salen de mirar una tipografía con serifa: las versalitas y las
 * mayúsculas ocupan más que las minúsculas, y el espacio y la puntuación bastante
 * menos. No pretende clavar ninguna tipografía real: pretende ser estable.
 */
export const AVANCES = Object.freeze({ estrecho: 0.3, normal: 0.52, ancho: 0.72 });

const ESTRECHOS = ' .,;:!¡|\'`ilí·-';
const ANCHOS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZmwMW@%';

function avance(letra) {
  if (ESTRECHOS.includes(letra)) return AVANCES.estrecho;
  if (ANCHOS.includes(letra)) return AVANCES.ancho;
  return AVANCES.normal;
}

/** Proporción del tamaño que ocupa la caja alta, y la que cuelga por debajo de la línea base. */
export const ASCENSO = 0.78;
export const DESCENSO = 0.22;

/**
 * Mide un texto.
 *
 * @param {string} texto
 * @param {{ familia: string, tamano: number, tracking?: number }} tipografia
 * @returns {{ ancho: number, alto: number, ascenso: number, descenso: number }}
 */
export function medidorNominal(texto, tipografia) {
  if (typeof texto !== 'string') throw new Error('medidorNominal: el texto tiene que ser una cadena');
  if (!tipografia || typeof tipografia.familia !== 'string' || !Number.isFinite(tipografia.tamano)) {
    throw new Error('medidorNominal: la tipografía tiene que traer familia y tamaño');
  }
  const letras = [...texto];
  let ancho = 0;
  for (const letra of letras) ancho += avance(letra) * tipografia.tamano;
  if (tipografia.tracking && letras.length > 1) ancho += tipografia.tracking * (letras.length - 1);
  const alto = tipografia.tamano * (ASCENSO + DESCENSO);
  return { ancho, alto, ascenso: tipografia.tamano * ASCENSO, descenso: tipografia.tamano * DESCENSO };
}
