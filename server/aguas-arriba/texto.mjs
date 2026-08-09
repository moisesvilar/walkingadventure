// El cliente del proveedor de texto. La clave vive aquí y no sale nunca: ni en una
// respuesta, ni en un mensaje de error, ni en la superficie de escritura.
//
// Qué lleva el prompt y qué se valida de su respuesta **no es de este módulo**: es el
// contrato de `packages/nucleo/quests/prompt.js` y `narrador.js`. Aquí solo se exige la
// forma del sobre, que es lo que permite que con LLM y sin LLM la estructura sea
// idéntica.

import { FalloDeAguasArriba, json, pideAguasArriba } from './comun.mjs';

/** El texto no se cachea en el servidor: es la única categoría que describe la aventura de alguien. */
export const SE_CACHEA = false;

export function creaClienteDeTexto({ fetch, url, clave, config, modelo = 'texto' }) {
  return {
    ruta: 'texto',
    seCachea: SE_CACHEA,
    async pide({ prompt, idioma, tono }) {
      return pideAguasArriba({
        ruta: 'texto',
        config,
        llama: () =>
          json(fetch, url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
            body: JSON.stringify({ modelo, prompt, idioma, tono }),
          }),
        valida: (datos) => (datos && typeof datos.texto === 'string' && datos.texto.trim() ? { texto: datos.texto } : null),
      });
    },
  };
}

export { FalloDeAguasArriba };
