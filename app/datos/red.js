// La puerta de red de la app: **el único módulo que nombra la que trae la
// plataforma**. Todo lo demás de la capa de datos —el cliente del proxy, el traedor
// de OSM— la recibe inyectada, con el mismo patrón que `enlace-real.js` para Skia y
// que `fetchData` en `buildWorld`. Esa es la razón de que la capa entera se pueda
// ejercitar en `node --test` contra un doble, sin simulador y sin red.
//
// Aquí no se decide ni una cabecera, ni un plazo, ni una dirección: solo se entrega
// la función. Si esta referencia se extendiera a otro fichero, la propiedad de
// arriba se perdería sin que nada se pusiera rojo.

/**
 * La puerta de red de esta compilación, o un error que dice que no la hay.
 *
 * Un entorno sin ella —un empaquetador antiguo, una prueba en un runtime pelado—
 * tiene que decirlo al montar y no al primer intento de levantar un mapa: un fallo
 * de cableado y una avería de la red se arreglan en sitios distintos y no se pueden
 * parecer.
 */
export function puertaDeRed(global = globalThis) {
  const puerta = global && global.fetch;
  if (typeof puerta !== 'function') {
    throw new Error('esta compilación no trae puerta de red: no hay con qué pedirle los datos de OSM al proxy');
  }
  return puerta.bind(global);
}

/** Si esta compilación tiene puerta de red. La ausencia se declara, no se disimula. */
export function hayPuertaDeRed(global = globalThis) {
  return typeof (global && global.fetch) === 'function';
}
