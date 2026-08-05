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
