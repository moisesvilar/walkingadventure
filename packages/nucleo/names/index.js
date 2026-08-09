// Selección del paquete de nombres según la ubicación del mundo.
// Decisión de diseño (game-design/parajes.md): el idioma de los nombres depende
// de dónde se genera el mundo. Por ahora: Galicia → gallego, resto → castellano.

import { es } from './es.js';
import { gl } from './gl.js';

// Bounding aproximado de Galicia; a futuro, límites administrativos de OSM.
export function localeFor(lat, lon) {
  return lat > 41.75 && lat < 43.85 && lon > -9.4 && lon < -6.6 ? 'gl' : 'es';
}

export function namesFor(locale) {
  return locale === 'gl' ? gl : es;
}

/**
 * Índice de nombres de un mundo: uno solo, creado en build.js y compartido por las
 * cinco familias que nombran (núcleos, granjas, servicios, parajes y calzadas).
 *
 * Antes cada fase llevaba su propio conjunto de nombres usados —o ninguno, en el
 * caso de los núcleos y los servicios—, así que una granja podía llamarse igual
 * que otra y un paraje igual que un núcleo sin que nadie lo notase. La unicidad es
 * del mundo entero, no de la familia.
 *
 * No es un estado global del paquete a propósito: dos mundos generados en el mismo
 * proceso tienen que poder salir sin contaminarse.
 */
export function crearIndiceDeNombres() {
  const usados = new Set();
  return {
    tomado: (nombre) => usados.has(nombre),

    /**
     * Reserva un nombre concreto si está libre. Devuelve si lo consiguió.
     *
     * Existe para la capa de nombres propuestos por el narrador (SPEC-018), que no
     * sortea nada: trae un nombre ya escrito y lo único que puede hacer es tomarlo o
     * quedarse con el que había. `fija` no sirve ahí porque su contrato es
     * «devuélveme un nombre libre pase lo que pase», y aquí no adoptar es la
     * respuesta correcta.
     */
    reserva(nombre) {
      if (typeof nombre !== 'string' || !nombre) return false;
      if (usados.has(nombre)) return false;
      usados.add(nombre);
      return true;
    },

    /**
     * Fija un nombre libre y lo reserva.
     *
     * `sortea()` es el sorteo de la familia que nombra, y se reintenta con la
     * cadena de azar de esa fase y no con una compartida: si todas las familias
     * desempataran con el mismo generador, tocar una fase desplazaría el azar de
     * las demás. Agotados los intentos, `desambigua(intento)` lo resuelve con la
     * regla del paquete de idioma, que sí garantiza un nombre libre porque los
     * nombres que produce crecen sin repetirse.
     */
    fija(sortea, desambigua, intentos = 8) {
      let nombre = '';
      for (let t = 0; t < intentos; t++) {
        nombre = sortea();
        if (!usados.has(nombre)) {
          usados.add(nombre);
          return nombre;
        }
      }
      const base = nombre;
      for (let k = 0; ; k++) {
        nombre = desambigua(base, k);
        if (!usados.has(nombre)) {
          usados.add(nombre);
          return nombre;
        }
      }
    },
  };
}

// Etiquetas de UI (siempre en castellano: es el idioma de la interfaz,
// independiente del idioma de los nombres de fantasía).
export const POI_LABELS = {
  posada: 'Posada — descansar y pasar la noche',
  taberna: 'Taberna — hablar con aldeanos y obtener trabajos',
  boticario: 'Boticario — plantas curativas y remedios',
  armeria: 'Armería y herrero — armas y armaduras',
  conjureria: 'Conjurería — libros y pergaminos mágicos',
  mercado: 'Mercado — provisiones y objetos varios',
};
