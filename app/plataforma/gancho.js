// El gancho para poner una capacidad en rojo: un enlace profundo, no un control.
// `testing-framework.md` ya admite ganchos de prueba expuestos por la app, y un
// enlace profundo funciona igual en las dos plataformas sin añadir código nativo
// ni un botón que habría que esconder en producción.
//
//   walkingadventure://andamiaje?ausentes=haptico,notificaciones
//
// Dos reglas que no se relajan: es INERTE en una compilación de producción, y no
// escribe nada en el almacenamiento del dispositivo. Un gancho que sobrevive al
// reinicio o que llega a producción es una puerta trasera que cambia el
// comportamiento de la app.

import { CAPACIDADES } from './capacidades.js';

/** El anfitrión del enlace. Cualquier otro no es el gancho de andamiaje. */
export const ANFITRION = 'andamiaje';

const VACIO = { ausentes: [], noReconocidos: [] };

/**
 * Lee el enlace sin usar ningún analizador de URL de plataforma: el formato es
 * fijo y conocido, y un analizador de más es una dependencia que la spec no
 * nombra. Devuelve siempre la misma forma, también cuando no hay enlace.
 *
 * @param {string|null} url   el enlace con el que se abrió la app.
 * @param {boolean} enDesarrollo  si esta es una compilación de desarrollo.
 */
export function leeGancho(url, enDesarrollo) {
  if (!enDesarrollo) return VACIO;
  if (typeof url !== 'string' || !url) return VACIO;

  const sinEsquema = url.replace(/^[a-zA-Z][\w+.-]*:\/\//, '');
  const [ruta, consulta = ''] = sinEsquema.split('?');
  if (ruta.replace(/\/+$/, '') !== ANFITRION) return VACIO;

  const pedidas = [];
  for (const par of consulta.split('&')) {
    if (!par) continue;
    const [clave, valor = ''] = par.split('=');
    if (clave !== 'ausentes' && clave !== 'ausente') continue;
    for (const nombre of decodeURIComponent(valor).split(',')) {
      const limpio = nombre.trim();
      if (limpio) pedidas.push(limpio);
    }
  }

  const ausentes = [];
  const noReconocidos = [];
  for (const nombre of pedidas) {
    // El orden de salida es el de CAPACIDADES y no el del enlace: el estado de la
    // app no puede depender de en qué orden se escribieron los parámetros.
    if (CAPACIDADES.includes(nombre)) {
      if (!ausentes.includes(nombre)) ausentes.push(nombre);
    } else if (!noReconocidos.includes(nombre)) {
      noReconocidos.push(nombre);
    }
  }
  ausentes.sort((a, b) => CAPACIDADES.indexOf(a) - CAPACIDADES.indexOf(b));
  return { ausentes, noReconocidos };
}
