// Monta mundos del paquete compartido sobre los datos de OSM congelados, y
// extrae de ellos lo mismo que guardan los extractos de referencia.
//
// Existe para que ninguna prueba de generación vuelva a escribir la frontera de
// inyección a mano: el núcleo no llama a nada, así que doblar es pasar otro
// argumento, y ese argumento es siempre el mismo. Nada de aquí toca la red ni el
// reloj: los datos salen de test/fixtures/osm/ y el azar, de la semilla.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { buildWorld } from '../../packages/nucleo/world/build.js';
import { mundoCongelado } from '../dobles/mundo-congelado.mjs';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

export const NUCLEO = join(RAIZ_REPO, 'packages', 'nucleo');
export const REFERENCIA = join(RAIZ_REPO, 'test', 'fixtures', 'mundos-referencia');

/** Los cuatro mundos congelados, en el orden estable en que los sirve el doble. */
export const LOS_CUATRO = ['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso'];

/** Las dos semillas de referencia de cada mundo congelado. */
export const LAS_DOS_SEMILLAS = ['1', '2'];

/** Un extracto de referencia commiteado, tal cual está en disco. */
export function leeExtracto(nombre, semilla) {
  return JSON.parse(readFileSync(join(REFERENCIA, `${nombre}-semilla-${semilla}.json`), 'utf8'));
}

/** La semilla con la que se capturó un extracto. Se lee de su cabecera y no se
 *  duplica aquí: la verdad de con qué se generó cada mundo la tiene el extracto. */
export function semillaDe(nombre, semilla) {
  return leeExtracto(nombre, semilla).cabecera.semilla;
}

/**
 * Genera un mundo con el paquete a partir de un mundo congelado.
 *
 * `fetchData` se construye aquí y siempre sirve el mismo mundo congelado a todas
 * las llamadas, incluida la segunda vuelta que la tubería pide en costa.
 *
 * @param {string} nombre  uno de `LOS_CUATRO`
 * @param {string} seed    la semilla completa, `"lat,lon#n"`
 * @param {object} [opciones]
 *   `ordenInvertido` sirve los mismos elementos en el orden contrario;
 *   `onStatus` se pasa tal cual a la tubería;
 *   `transforma(datos)` permite cambiar lo que devuelve `fetchData`;
 *   `rBase` sobreescribe el radio del manifiesto.
 * @returns {Promise<object>} el mundo, más `llamadas` con lo que se pidió.
 */
export async function generaMundo(nombre, seed, opciones = {}) {
  const { ordenInvertido = false, onStatus, transforma, rBase } = opciones;
  const manifiesto = mundoCongelado(nombre).manifiesto;
  const llamadas = [];

  const fetchData = async (lat, lon, radius) => {
    llamadas.push({ lat, lon, radius });
    const datos = mundoCongelado(nombre, { ordenInvertido });
    // El callejero se sirve **siempre**: es la tercera parte del mundo congelado y
    // donde están los huecos cortos que el grafo tiene que coser. Sin él la tubería
    // construía el grafo solo con las carreteras del terreno, y los escenarios del
    // cosido pasaban a mirar un grafo que nunca veía el dato que los provoca.
    const crudo = { geoJson: datos.geo, poiJson: datos.pois, callejeroJson: datos.callejero };
    return transforma ? transforma(crudo) : crudo;
  };

  const world = await buildWorld({
    lat: manifiesto.coordenada.lat,
    lon: manifiesto.coordenada.lon,
    rBase: rBase ?? manifiesto.radio_m,
    seed,
    fetchData,
    ...(onStatus ? { onStatus } : {}),
  });

  world.llamadas = llamadas;
  return world;
}

const metros = (n) => Math.round(n);

// Orden estable del extracto: tipo, nombre y posición. No es el orden en que la
// generación produce los elementos a propósito — un extracto que dependiera del
// orden interno dejaría de comparar mundos y pasaría a comparar implementaciones.
function ordenaEstable(lista) {
  return lista
    .map((e) => ({
      clave: `${e.tipo}|${e.nombre ?? ''}|${e.x ?? e.desde[0]},${e.y ?? e.desde[1]}`,
      e,
    }))
    .sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0))
    .map((x) => x.e);
}

/**
 * Lo que sobrevive a una comparación honesta con el prototipo: título, idioma,
 * radio, recuentos y, para cada núcleo, servicio, paraje y calzada, su nombre, su
 * tipo, sus coordenadas al metro y el identificador de OSM de su anclaje. Es
 * exactamente la forma de `test/fixtures/mundos-referencia/`, sin la cabecera.
 */
export function extraeReferencia(world) {
  const nucleos = ordenaEstable(
    world.settlements.map((s) => ({
      nombre: s.name,
      tipo: s.type,
      x: metros(s.x),
      y: metros(s.y),
      anclaje: s.anchor?.osmId ?? null,
    })),
  );
  const servicios = ordenaEstable(
    world.settlements
      .flatMap((s) => s.services)
      .map((v) => ({
        nombre: v.name,
        tipo: v.kind,
        x: metros(v.x),
        y: metros(v.y),
        anclaje: v.real?.osmId ?? null,
      })),
  );
  const parajes = ordenaEstable(
    world.parajes.map((p) => ({
      nombre: p.name,
      tipo: p.type,
      x: metros(p.x),
      y: metros(p.y),
      anclaje: p.real?.osmId ?? null,
    })),
  );
  const calzadas = ordenaEstable(
    world.routes.map((r) => ({
      nombre: r.name ?? null,
      tipo: r.ramal ? 'ramal' : 'calzada',
      desde: [metros(r.pts[0].x), metros(r.pts[0].y)],
      hasta: [metros(r.pts[r.pts.length - 1].x), metros(r.pts[r.pts.length - 1].y)],
      puntos: r.pts.length,
      recta: !!r.fallback,
    })),
  );

  return {
    titulo: world.title,
    idioma: world.locale,
    radio_dibujo_m: world.radius,
    recuentos: {
      nucleos: nucleos.length,
      servicios: servicios.length,
      parajes: parajes.length,
      calzadas: calzadas.length,
    },
    nucleos,
    servicios,
    parajes,
    calzadas,
    casting: world.casting
      .map((c) => ({ plantilla: c.tpl.id, castea: c.ok }))
      .sort((a, b) => (a.plantilla < b.plantilla ? -1 : 1)),
  };
}

/** Todos los nombres de fantasía de un mundo: núcleos, servicios, parajes y calzadas. */
export function nombresDelMundo(world) {
  return [
    ...world.settlements.map((s) => s.name),
    ...world.settlements.flatMap((s) => s.services).map((v) => v.name),
    ...world.parajes.map((p) => p.name),
    ...world.routes.map((r) => r.name),
  ].filter((n) => n != null);
}

/** Los identificadores de OSM de los anclajes que consume un mundo, con su dueño. */
export function anclajesDelMundo(world) {
  const out = [];
  for (const s of world.settlements) {
    if (s.anchor?.osmId) out.push({ osmId: s.anchor.osmId, de: `núcleo ${s.name}` });
    for (const v of s.services) if (v.real?.osmId) out.push({ osmId: v.real.osmId, de: `servicio ${v.name}` });
  }
  for (const p of world.parajes) if (p.real?.osmId) out.push({ osmId: p.real.osmId, de: `paraje ${p.name}` });
  return out;
}

/** Los módulos del paquete, en rutas relativas a la raíz del repo y en orden estable. */
export function modulosDelPaquete(dir = NUCLEO) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...modulosDelPaquete(p));
    else if (/\.(mjs|js)$/.test(e.name)) out.push(relative(RAIZ_REPO, p));
  }
  return out;
}

/** El texto de un fichero del repo, por ruta relativa. */
export function fuente(rutaRelativa) {
  return readFileSync(join(RAIZ_REPO, rutaRelativa), 'utf8');
}

/** Si existe algo con ese nombre dentro del repo. */
export function hay(rutaRelativa) {
  try {
    statSync(join(RAIZ_REPO, rutaRelativa));
    return true;
  } catch {
    return false;
  }
}
