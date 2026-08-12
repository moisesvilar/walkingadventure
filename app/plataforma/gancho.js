// El gancho para poner una capacidad en rojo: un enlace profundo, no un control.
// `testing-framework.md` ya admite ganchos de prueba expuestos por la app, y un
// enlace profundo funciona igual en las dos plataformas sin añadir código nativo
// ni un botón que habría que esconder en producción.
//
//   walkingadventure://andamiaje?ausentes=haptico,notificaciones
//   walkingadventure://andamiaje?metrosDeFondo=6000
//
// Dos reglas que no se relajan: es INERTE en una compilación de producción, y no
// escribe nada en el almacenamiento del dispositivo. Un gancho que sobrevive al
// reinicio o que llega a producción es una puerta trasera que cambia el
// comportamiento de la app.
//
// **`metrosDeFondo` matiza la segunda regla, y se dice en lugar de colarse** (fila 46):
// esos metros sí dejan reserva puesta, porque el gancho es **una fuente de metros y no un
// escritor de estado** — lo que escribe es exactamente lo que habría escrito una lectura
// real de la app de salud, por el mismo camino y con el mismo tope. Y **respeta el
// interruptor**: con el modo apagado o sin fuente no acredita nada, que es lo que impide
// que una prueba verifique un camino que el juego no tiene.
//
// El segundo parámetro va en una función aparte y no dentro de `leeGancho` a propósito: son
// dos ganchos con vidas distintas —uno decide qué capacidades se sondean y el otro alimenta
// una lectura— y juntarlos obligaría a quien solo quiere uno a mirar el otro.

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

/** El parámetro de los metros de fondo. Uno solo, y con el mismo anfitrión. */
export const PARAMETRO_DE_METROS = 'metrosDeFondo';

/** Lo que se devuelve cuando el enlace no trae metros: ninguno, y sin motivo que declarar. */
const SIN_METROS = Object.freeze({ metros: null, motivo: null });

/**
 * Lee `metrosDeFondo` del enlace. **Inerte en producción**, como el otro.
 *
 * @returns `{ metros, motivo }`. `metros` en nulo con `motivo` en nulo es «el enlace no
 *   traía ninguno»; `metros` en nulo **con motivo** es «traía uno y no vale», que se declara
 *   en lugar de acreditar cero como si se hubiera leído.
 */
export function leeMetrosDeFondo(url, enDesarrollo) {
  if (!enDesarrollo) return SIN_METROS;
  if (typeof url !== 'string' || !url) return SIN_METROS;

  const sinEsquema = url.replace(/^[a-zA-Z][\w+.-]*:\/\//, '');
  const [ruta, consulta = ''] = sinEsquema.split('?');
  if (ruta.replace(/\/+$/, '') !== ANFITRION) return SIN_METROS;

  let crudo = null;
  for (const par of consulta.split('&')) {
    if (!par) continue;
    const [clave, valor = ''] = par.split('=');
    if (clave === PARAMETRO_DE_METROS) crudo = decodeURIComponent(valor).trim();
  }
  if (crudo === null) return SIN_METROS;

  const metros = Number(crudo);
  if (crudo === '' || !Number.isFinite(metros) || metros < 0) {
    return Object.freeze({
      metros: null,
      motivo: `el gancho de metros de fondo llegó como ${JSON.stringify(crudo)}: hacen falta metros finitos y no negativos, y con eso no se acredita nada`,
    });
  }
  return Object.freeze({ metros, motivo: null });
}
