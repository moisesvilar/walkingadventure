// Decide si un módulo se está ejecutando como programa principal, comparando
// rutas canónicas. Vive en un solo sitio y no copiado en cada script porque lo que
// se cierra aquí es una clase de defectos: el patrón ingenuo
// `process.argv[1] === fileURLToPath(import.meta.url)` compara una ruta sin
// resolver con otra ya resuelta, y basta con que la invocación atraviese un enlace
// simbólico —en macOS /tmp y /var lo son— para que el bloque principal no se
// ejecute nunca y el script salga 0 sin haber comprobado nada.

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Ruta absoluta y con los enlaces simbólicos resueltos.
 *
 * Si la ruta no existe se devuelve solo resuelta, sin lanzar: un guardián que
 * revienta al evaluarse es el mismo fallo que intenta evitar con otra cara, y una
 * ruta inexistente nunca puede coincidir con la de un módulo que sí está cargado.
 *
 * @param {string} ruta
 * @returns {string}
 */
export function rutaCanonica(ruta) {
  const absoluta = resolve(ruta);
  try {
    return realpathSync(absoluta);
  } catch {
    return absoluta;
  }
}

/**
 * Si el módulo que pregunta es el programa que se invocó.
 *
 * `invocado` se toma por parámetro para poder afirmarlo desde una prueba sin
 * tocar `process.argv`, que es global y compartido.
 *
 * @param {string} metaUrl  el `import.meta.url` del módulo que pregunta
 * @param {string|undefined} [invocado=process.argv[1]]
 * @returns {boolean}
 */
export function esPrincipal(metaUrl, invocado = process.argv[1]) {
  if (!invocado) return false;
  return rutaCanonica(fileURLToPath(metaUrl)) === rutaCanonica(invocado);
}
