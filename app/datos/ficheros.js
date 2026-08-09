// El contrato del sistema de ficheros que el almacén duradero necesita: seis
// operaciones sobre rutas, y ninguna decisión encima.
//
// Está separado del almacén a propósito. El almacén sabe de **claves de partida** —qué
// es una clave válida, cómo se ordena una lista, y que escribir es escribir aparte y
// sustituir—; el sistema de ficheros sabe de **rutas**, y de quién se las da: en el
// móvil es el de Expo, en Node el de la biblioteca estándar. Con la frontera aquí, la
// escritura atómica se comprueba contra un sistema de ficheros de verdad sin dispositivo,
// que es lo que pedía SPEC-039: `node --test` y el disco real.
//
// **Su ausencia es error de construcción**, no un modo degradado: una app que juega
// perfectamente y pierde la partida al cerrar es la degradación silenciosa más cara
// posible, y es exactamente el estado en el que SPEC-026 dejó las cosas.

/** Las seis operaciones. Lista cerrada: el almacén no usa ninguna más. */
export const OPERACIONES_DE_FICHEROS = Object.freeze(['lee', 'escribe', 'mueve', 'borra', 'entradas', 'creaDirectorio']);

/**
 * El sistema de ficheros inyectado, o un error que dice **qué le falta**.
 *
 * @param {object} ficheros lo que se ha inyectado
 * @param {string} donde quién lo pide, para que el error sirva de algo
 */
export function exigeFicheros(ficheros, donde) {
  if (!ficheros) {
    throw new Error(
      `${donde} necesita el sistema de ficheros del dispositivo inyectado: sin él la partida no dura más que la sesión, ` +
      'y caer al almacén en memoria sería perderla al cerrar sin que nada proteste',
    );
  }
  const faltan = OPERACIONES_DE_FICHEROS.filter((op) => typeof ficheros[op] !== 'function');
  if (faltan.length) {
    throw new Error(`${donde}: al sistema de ficheros inyectado le faltan las operaciones ${faltan.join(', ')} (las seis son ${OPERACIONES_DE_FICHEROS.join(', ')})`);
  }
  return ficheros;
}
