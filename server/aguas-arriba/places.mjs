// El cliente de Google Places. Solo la foto y la atribución que Places exige: son
// públicas, son las mismas para todo el mundo y la caché las comparte entre quien pase
// por ahí, que es lo que amortigua el coste de pedirlas todas al crear el mapa.
//
// La entrada de caché lleva el binario y la atribución, y nada más. Un `place_id`
// cacheado ya dice que alguien generó un mapa que contiene ese sitio; añadirle cuándo
// o cuántas veces convertiría ese bit en un registro.

import { FalloDeAguasArriba, json, pideAguasArriba } from './comun.mjs';

export const SE_CACHEA = true;

export function creaClienteDePlaces({ fetch, url, clave, config }) {
  return {
    ruta: 'places',
    seCachea: SE_CACHEA,
    async pide({ place_id }) {
      return pideAguasArriba({
        ruta: 'places',
        config,
        llama: () =>
          json(fetch, `${url}?place_id=${encodeURIComponent(place_id)}`, {
            method: 'GET',
            headers: { 'X-Goog-Api-Key': clave },
          }),
        valida: (datos) => {
          const foto = datos && datos.foto;
          if (!foto || typeof foto.referencia !== 'string') return null;
          if (typeof foto.atribucion !== 'string' || !foto.atribucion) return null;
          if (!Number.isInteger(foto.ancho) || !Number.isInteger(foto.alto)) return null;
          return { foto: { referencia: foto.referencia, atribucion: foto.atribucion, ancho: foto.ancho, alto: foto.alto } };
        },
      });
    },
  };
}

export { FalloDeAguasArriba };
