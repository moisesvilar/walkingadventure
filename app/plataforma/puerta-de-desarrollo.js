// La puerta de desarrollo: el enlace profundo que lleva al andamiaje.
//
// El andamiaje y el mapa suelto **no son pantallas del juego** —no salen en `docs/flujo.md`
// y no pueden salir, porque el diagrama son las cuarenta pantallas de los seis artefactos
// de diseño— y por eso su puerta no es navegación: es una puerta declarada de desarrollo,
// como ya lo era el paso a la revisión del render. La distinción que gobierna esto está en
// `pipeline/decisiones-orquestador.md` §6y: **verificar una pantalla del juego por una
// puerta que ningún jugador usa es deuda; verificar una herramienta de desarrollo por la
// puerta de desarrollo es la puerta correcta.**
//
//   walkingadventure://desarrollo
//
// Las dos reglas del gancho de capacidades valen aquí igual y por lo mismo: es INERTE en
// una compilación de producción, y no escribe nada en el almacenamiento del dispositivo.
// Una puerta que sobrevive al reinicio o que llega a producción es una puerta trasera.
//
// **Anfitrión propio y no el del gancho**, que es una decisión y no un capricho.
// `walkingadventure://andamiaje` ya significa una cosa —poner una capacidad en rojo— y
// `test/nucleo/plataforma.test.mjs` fija que ese enlace **sin parámetros no hace nada**.
// Darle un segundo significado habría obligado a ablandar esa prueba para abrirse camino,
// que es justo lo que no se hace aquí. Se apagan con la misma llave y hacen cosas
// distintas, así que son dos módulos.

/** El anfitrión del enlace. Cualquier otro no es la puerta. */
export const ANFITRION = 'desarrollo';

/**
 * Si el enlace es el de la puerta de desarrollo.
 *
 * No lee parámetros y no le importan: la puerta abre o no abre, y no lleva nada dentro.
 * Un enlace con basura detrás abre igual, que es lo que se espera de algo que se teclea a
 * mano en una terminal.
 *
 * @param {string|null} url  el enlace con el que se abrió la app, o el que llegó después.
 * @param {boolean} enDesarrollo  si esta es una compilación de desarrollo.
 */
export function esPuertaDeDesarrollo(url, enDesarrollo) {
  if (!enDesarrollo) return false;
  if (typeof url !== 'string' || !url) return false;
  const sinEsquema = url.replace(/^[a-zA-Z][\w+.-]*:\/\//, '');
  // El mismo recorte que el gancho: se parte por el primer `?` y se quitan las barras
  // finales. Aquí no hay analizador de URL de plataforma por lo mismo que allí — el
  // formato es fijo y conocido, y uno de más es una dependencia que nadie ha nombrado.
  const [ruta] = sinEsquema.split('?');
  return ruta.replace(/\/+$/, '') === ANFITRION;
}
