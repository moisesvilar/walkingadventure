// El cliente de Overpass, que es la única ruta que ve coordenadas.
//
// No es una llamada de pago a un tercero: el Overpass del proyecto es nuestro y existe
// por fricción, no por ahorro. Se cuenta igual en la métrica porque un lote de mapa
// tiene que poder compararse entero, y se le imputa el coste declarado de su ruta.
//
// Su caché viene **apagada**: encendida, el disco pasa a contener un mapa de qué zonas
// se han generado alguna vez. Está escrito con esas palabras en server/DESPLIEGUE.md.

import { FalloDeAguasArriba, pideAguasArriba } from './comun.mjs';

export const SE_CACHEA = true; // solo si CACHE_GENERACION lo enciende a propósito

export function creaClienteDeGeneracion({ fetch, url, config }) {
  return {
    ruta: 'generacion',
    seCachea: SE_CACHEA,
    async pide({ consulta }) {
      return pideAguasArriba({
        ruta: 'generacion',
        config,
        llama: async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'data=' + encodeURIComponent(consulta.ql ?? ''),
          });
          if (!res || res.ok !== true) throw new Error('respuesta no ok');
          const texto = await res.text();
          // Overpass responde 200 con una página de error XML cuando su base de datos
          // no está. Se distingue del «no es JSON» genérico porque el arreglo es otro:
          // no reintentar, sino revisar el contenedor.
          if (texto.startsWith('<')) throw new Error('sin datos servibles');
          return JSON.parse(texto);
        },
        valida: (datos) => (datos && Array.isArray(datos.elements) ? { elements: datos.elements } : null),
      });
    },
  };
}

export { FalloDeAguasArriba };
