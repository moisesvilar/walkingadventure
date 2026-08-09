// El mundo con el que se pinta la lámina en el dispositivo. Es el equivalente de
// `__wa.demo()` en el prototipo: datos de OSM **inventados y deterministas** que se
// meten por la misma puerta por la que entran los reales —`fetchData` inyectado en
// `buildWorld`— para que el mundo lo construya la tubería canónica y no una copia.
// Aquí no hay ni una fase de generación: hay terreno, callejero y locales, y nada
// más.
//
// Existe porque los ocho extractos de referencia viven en `test/fixtures/` y la app
// no alcanza `test/`; y porque la capa de datos de verdad no llega hasta la fila 26.
// Cuando llegue, esta pantalla pinta mundos reales y este fichero se va.
//
// **No abre ninguna puerta de red**: `sirveDatos` es una función pura que devuelve
// el mismo objeto siempre.

import { buildWorld } from '@walkingadventure/nucleo/world/build.js';
import { makeProjector } from '@walkingadventure/nucleo/core/geo.js';

/** La semilla del mundo de revisión, literal: mismo sitio, mismo mundo, siempre. */
export const SEMILLA_DE_REVISION = '42.40,-8.81#7';

/** El radio de partida, en metros. Da un mundo del tamaño de los de referencia. */
const RADIO_M = 900;

const { lat: LAT, lon: LON } = coordenadaDe(SEMILLA_DE_REVISION);

function coordenadaDe(semilla) {
  const [lat, lon] = semilla.split('#')[0].split(',').map(Number);
  return { lat, lon };
}

const proyector = makeProjector(LAT, LON);

/** Un nodo de OSM colocado en metros desde el centro. */
function nodo(id, x, y, tags) {
  const { lat, lon } = proyector.toLatLon({ x, y });
  return { type: 'node', id, lat, lon, tags };
}

/** Una vía de OSM con su geometría en metros desde el centro. */
function via(id, puntos, tags) {
  return {
    type: 'way',
    id,
    nodes: puntos.map((_, i) => id * 1000 + i),
    geometry: puntos.map((p) => proyector.toLatLon(p)),
    tags,
  };
}

/** Una polilínea muestreada de una función paramétrica. */
function linea(n, f) {
  return Array.from({ length: n }, (_, i) => f(i));
}

/**
 * Una mancha cerrada: el mismo truco que el terreno sintético del prototipo, con el
 * radio modulado para que no salga un círculo perfecto. Cierra repitiendo el primer
 * punto, que es lo que `parseGeo` mira para dar un bosque por cerrado.
 */
function mancha(cx, cy, rx, ry, n = 24) {
  const borde = linea(n, (i) => {
    const a = (i / n) * Math.PI * 2;
    const w = 0.75 + 0.25 * Math.abs(Math.sin(a * 3));
    return { x: cx + Math.cos(a) * rx * w, y: cy + Math.sin(a) * ry * w };
  });
  return [...borde, borde[0]];
}

/**
 * Los locales y emplazamientos, repartidos en espiral. Las etiquetas son las del
 * catálogo de admisión de `anclajes.js` y todos van con nombre, porque un anclaje
 * sin nombre no se reconoce sobre el terreno y el pool lo descarta.
 */
const ETIQUETAS_DE_ANCLAJE = [
  { tags: { amenity: 'cafe' }, nombre: 'Cafetería' },
  { tags: { amenity: 'restaurant' }, nombre: 'Restaurante' },
  { tags: { amenity: 'place_of_worship' }, nombre: 'Igrexa' },
  { tags: { leisure: 'park' }, nombre: 'Parque' },
  { tags: { historic: 'monument' }, nombre: 'Monumento' },
  { tags: { natural: 'spring' }, nombre: 'Fonte' },
  { tags: { historic: 'ruins' }, nombre: 'Ruínas' },
  { tags: { tourism: 'viewpoint' }, nombre: 'Miradoiro' },
  { tags: { historic: 'wayside_cross' }, nombre: 'Cruceiro' },
  { tags: { amenity: 'library' }, nombre: 'Biblioteca' },
];

const CUANTOS_ANCLAJES = 72;

function anclajes() {
  return Array.from({ length: CUANTOS_ANCLAJES }, (_, i) => {
    const a = (i / CUANTOS_ANCLAJES) * Math.PI * 2 * 5;
    const r = 70 + (i % 14) * 55;
    const { tags, nombre } = ETIQUETAS_DE_ANCLAJE[i % ETIQUETAS_DE_ANCLAJE.length];
    return nodo(100000 + i, Math.cos(a) * r, Math.sin(a) * r, { ...tags, name: `${nombre} ${i + 1}` });
  });
}

/** El terreno: costa al suroeste, bosques, un lago, un río, picos y carreteras. */
function terreno() {
  const recta = (fx, fy) => linea(33, (i) => ({ x: fx(i - 16), y: fy(i - 16) }));
  return [
    // Costa: con ella la tubería pide la segunda vuelta y monta la máscara de mar,
    // que es la capa donde más se juegan los cinco estilos.
    via(200001, linea(30, (i) => ({ x: -900 + i * 62, y: -620 - Math.sin(i / 4) * 70 })), { natural: 'coastline' }),
    via(200002, mancha(-430, 330, 300, 210), { landuse: 'forest' }),
    via(200003, mancha(360, -420, 260, 240), { natural: 'wood' }),
    via(200004, mancha(-250, -480, 200, 150), { landuse: 'forest' }),
    via(200005, mancha(430, 300, 110, 85, 18), { natural: 'water' }),
    via(200006, recta((k) => k * 50 + 25, (k) => -k * 50 + 300), { waterway: 'river', name: 'Río de Proba' }),
    via(200007, recta((k) => k * 55, () => 0), { highway: 'secondary' }),
    via(200008, recta(() => 0, (k) => k * 55), { highway: 'tertiary' }),
    via(200009, recta((k) => k * 45, (k) => k * 45), { highway: 'track', surface: 'gravel' }),
    nodo(200101, -620, -170, { natural: 'peak', ele: '900', name: 'Alto da Proba' }),
    nodo(200102, -500, -260, { natural: 'peak', ele: '1400' }),
    nodo(200103, -700, -330, { natural: 'peak', ele: '700' }),
    nodo(200104, 620, 90, { natural: 'peak', ele: '1100' }),
    nodo(200105, 700, -60, { natural: 'peak', ele: '600' }),
  ];
}

/** El callejero: una retícula corta alrededor del centro, que es la que se cose. */
function callejero() {
  const vias = [];
  let id = 300000;
  for (let i = -3; i <= 3; i++) {
    vias.push(via(id++, linea(9, (k) => ({ x: (k - 4) * 60, y: i * 60 })), { highway: 'residential' }));
    vias.push(via(id++, linea(9, (k) => ({ x: i * 60, y: (k - 4) * 60 })), { highway: 'residential' }));
  }
  return vias;
}

const DATOS = Object.freeze({
  geoJson: { elements: [...terreno()] },
  poiJson: { elements: anclajes() },
  callejeroJson: { elements: callejero() },
});

/** La puerta por la que la tubería pide datos. Pura: ni red, ni disco, ni reloj. */
function sirveDatos() {
  return Promise.resolve(DATOS);
}

/**
 * El documento de celda con el que se pinta la lámina. Misma tubería que la real:
 * lo único que cambia es de dónde salen los datos de OSM.
 */
export function mundoDeRevision(semilla = SEMILLA_DE_REVISION) {
  const { lat, lon } = coordenadaDe(semilla);
  return buildWorld({ lat, lon, rBase: RADIO_M, seed: semilla, fetchData: sirveDatos });
}
