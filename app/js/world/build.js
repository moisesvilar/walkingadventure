// Construcción completa de un mundo a partir de las consultas OSM.
// Compartida por la app (app/js/main.js) y las herramientas headless
// (test/casting-report.mjs): misma tubería, mismos mundos.

import { parseGeo, parsePois } from '../data/overpass.js';
import { buildSeaMask, computeDisplayRadius } from './seamask.js';
import { generateSettlements } from './settlements.js';
import { buildRoutes, linkParajes, pegarAViario } from './routes.js';
import { generateParajes } from './parajes.js';
import { castAll } from '../quests/casting.js';
import { localeFor, namesFor } from '../names/index.js';
import { makeRng } from '../core/rng.js';

/**
 * fetchData(lat, lon, radius) → { geoJson, poiJson } (el llamante decide caché).
 * onStatus(clave) se espera entre fases: 'fetch' | 'terrain' | 'coast' | 'mask'
 * | 'settlements' | 'routes' | 'parajes'.
 */
export async function buildWorld({ lat, lon, rBase, seed, fetchData, onStatus = async () => {} }) {
  const names = namesFor(localeFor(lat, lon));

  await onStatus('fetch');
  let data = await fetchData(lat, lon, rBase);
  await onStatus('terrain');
  let geo = parseGeo(data.geoJson, lat, lon);
  let anchors = parsePois(data.poiJson, lat, lon);

  // Zona costera: consulta ampliada + máscara tierra/mar + radio dinámico,
  // para que el borde del mapa no corte bahías ni rías por la mitad.
  let radius = rBase;
  let seaMask = null;
  if (geo.coastlines.length) {
    const extraMax = Math.max(500, rBase * 0.3);
    const margin = Math.max(200, rBase * 0.2);
    const rMax = rBase + extraMax;
    const rFetch = rMax + 1500;
    await onStatus('coast');
    data = await fetchData(lat, lon, rFetch);
    geo = parseGeo(data.geoJson, lat, lon);
    anchors = parsePois(data.poiJson, lat, lon);
    await onStatus('mask');
    seaMask = buildSeaMask(geo.coastlines, rFetch, Math.max(40, Math.min(200, rFetch / 140)));
    radius = computeDisplayRadius(seaMask, {
      rBase,
      rMax,
      rOceanTest: rFetch - 500,
      margin,
      step: Math.max(50, Math.round(rBase * 0.025)),
    });
  }

  await onStatus('settlements');
  const { settlements, freeAnchors } = generateSettlements(anchors, geo, radius, seed, seaMask, names);
  await onStatus('routes');
  // pegar al viario ANTES de trazar: si un núcleo no cuelga de la red principal, el
  // trazado no tendría más remedio que unirlo con una recta por la que no se puede andar
  const movidos = pegarAViario(settlements, geo.roads);
  const routes = buildRoutes(settlements, geo.roads, seed, names);
  await onStatus('parajes');
  const parajes = generateParajes(freeAnchors, settlements, routes, geo, radius, seed, seaMask, names);
  // los parajes se enganchan a la red DESPUÉS de existir: hasta aquí no se sabe dónde
  // están, y algunos nacen precisamente de los cruces de las calzadas
  movidos.push(...pegarAViario(parajes.filter((p) => p.origin !== 'grafo'), geo.roads));
  routes.push(...linkParajes(parajes, routes, settlements, geo.roads));

  const world = {
    seed,
    radius,
    baseRadius: rBase,
    origin: { lat, lon },
    locale: names.locale,
    geo,
    anchors,
    settlements,
    routes,
    parajes,
    movidos, // núcleos y parajes desplazados hasta el viario, para poder auditarlo
    seaMask,
    title: names.worldTitle(makeRng(seed + ':title')),
  };
  world.casting = castAll(world);
  return world;
}
