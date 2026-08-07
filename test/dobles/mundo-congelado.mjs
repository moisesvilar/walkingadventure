// Sirve los mundos de OSM congelados de test/fixtures/osm/ como si fueran la
// respuesta de Overpass. Es el doble de la única frontera de datos del generador:
// el núcleo recibe `fetchData` inyectado, así que doblar es pasar otro argumento.
//
// Lee de disco y nunca abre una conexión: un fixture que consulta la red deja de
// ser un fixture.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OSM = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'osm');

const PARTES = ['manifiesto', 'geo', 'pois', 'callejero'];

// Caché del texto crudo, no del objeto: cada llamada hace su propio JSON.parse y
// por tanto recibe una copia nueva. Así quien recibe un mundo puede modificarlo
// sin envenenar la siguiente llamada, que es un criterio de aceptación explícito.
const crudo = new Map();

function texto(nombre, parte) {
  const clave = `${nombre}/${parte}`;
  if (!crudo.has(clave)) crudo.set(clave, readFileSync(join(OSM, nombre, `${parte}.json`), 'utf8'));
  return crudo.get(clave);
}

/** Nombres de los mundos congelados disponibles, en orden alfabético estable. */
export function mundosCongelados() {
  return readdirSync(OSM, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(OSM, e.name, 'manifiesto.json')))
    .map((e) => e.name)
    .sort();
}

/**
 * Un mundo congelado, listo para inyectar.
 *
 * @param {string} nombre  uno de los de `mundosCongelados()`
 * @param {{ ordenInvertido?: boolean }} [opciones]
 *   `ordenInvertido` devuelve exactamente los mismos elementos en el orden
 *   contrario. Existe para poder afirmar que la generación no depende del orden
 *   de llegada de los datos, que es una de las maneras de romper el determinismo
 *   sin que se note.
 * @returns {{ nombre: string, manifiesto: object, geo: object, pois: object, callejero: object }}
 */
export function mundoCongelado(nombre, opciones = {}) {
  const disponibles = mundosCongelados();
  if (!disponibles.includes(nombre)) {
    throw new Error(
      `no existe el mundo congelado "${nombre}". Disponibles: ${disponibles.join(', ')}`,
    );
  }

  const mundo = { nombre };
  for (const parte of PARTES) mundo[parte] = JSON.parse(texto(nombre, parte));

  if (opciones.ordenInvertido) {
    for (const parte of ['geo', 'pois', 'callejero']) {
      if (Array.isArray(mundo[parte].elements)) mundo[parte].elements.reverse();
    }
  }

  return mundo;
}

/**
 * El mismo mundo con la forma que el núcleo espera inyectada: tres funciones
 * asíncronas que devuelven la respuesta cruda de Overpass. Se separa de
 * `mundoCongelado` porque quien escribe una prueba de datos quiere el objeto y
 * quien monta el generador quiere las funciones.
 */
export function fetchDataCongelado(nombre, opciones = {}) {
  return {
    async geo() { return mundoCongelado(nombre, opciones).geo; },
    async pois() { return mundoCongelado(nombre, opciones).pois; },
    async callejero() { return mundoCongelado(nombre, opciones).callejero; },
  };
}
