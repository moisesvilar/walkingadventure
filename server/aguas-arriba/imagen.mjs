// El cliente del proveedor de imágenes. Es la llamada que de verdad cuesta dinero y
// por eso es la que se cachea: una imagen es función de su prompt de ficción y del
// formato, y es igual para todo el mundo que pida lo mismo.

import { FalloDeAguasArriba, json, pideAguasArriba } from './comun.mjs';

export const SE_CACHEA = true;

export function creaClienteDeImagen({ fetch, url, clave, config }) {
  return {
    ruta: 'imagen',
    seCachea: SE_CACHEA,
    async pide({ prompt, formato }) {
      return pideAguasArriba({
        ruta: 'imagen',
        config,
        llama: () =>
          json(fetch, url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
            body: JSON.stringify({ prompt, ...formato }),
          }),
        valida: (datos) => {
          if (!datos || typeof datos.datos_base64 !== 'string' || !datos.datos_base64) return null;
          if (typeof datos.formato !== 'string') return null;
          if (!Number.isInteger(datos.ancho) || !Number.isInteger(datos.alto)) return null;
          // Solo el binario y sus dimensiones. Ni quién la pidió, ni cuántas veces, ni cuándo.
          return { formato: datos.formato, ancho: datos.ancho, alto: datos.alto, datos_base64: datos.datos_base64 };
        },
      });
    },
  };
}

export { FalloDeAguasArriba };
