// Construcción completa de un mundo a partir de las consultas OSM.
// Tubería canónica del generador: la comparten la app y las herramientas
// headless, y es la única. Misma tubería, mismos mundos.

import { parseGeo } from './osm.js';
import { construyePool } from './anclajes.js';
import { buildSeaMask, computeDisplayRadius } from './seamask.js';
import { generateSettlements, countsForRadius, SERVICES } from './settlements.js';
import { buildRoutes, linkParajes, pegarAViario } from './routes.js';
import { generateParajes, parajeCountForRadius } from './parajes.js';
import { castAll } from '../quests/casting.js';
import { localeFor, namesFor, crearIndiceDeNombres } from '../names/index.js';
import { makeRng } from '../core/rng.js';
import { SUFIJOS_DE_FASE } from '../core/semilla.js';

const ORDEN_DE_NUCLEOS = ['ciudad', 'pueblo', 'aldea', 'granja'];

/**
 * Cuántos anclajes va a pedir este mundo, **leyendo** las declaraciones de las
 * fases que se los van a gastar en vez de copiar sus números: los cupos de núcleos
 * y los servicios garantizados de `settlements.js` y el cupo de parajes de
 * `parajes.js`. Es lo que usa el pool cuando nadie le inyecta una demanda, y sale
 * del radio del mundo y de nada más — nunca del tramo de quien juega, que
 * dimensiona los cupos de la celda pero jamás su contenido.
 */
export function demandaDeAnclajes(radius) {
  const cuentas = countsForRadius(radius);
  const nucleos = cuentas.reduce((a, b) => a + b, 0);
  let servicios = 0;
  ORDEN_DE_NUCLEOS.forEach((tipo, i) => { servicios += SERVICES[tipo].fixed.length * cuentas[i]; });
  const parajes = parajeCountForRadius(radius);
  return { total: nucleos + servicios + parajes, suelo: parajes };
}

/**
 * fetchData(lat, lon, radius) → { geoJson, poiJson } (el llamante decide caché).
 * onStatus(clave) se espera entre fases: 'fetch' | 'terrain' | 'coast' | 'mask'
 * | 'settlements' | 'routes' | 'parajes'.
 *
 * `demanda` —cuántos anclajes pide la celda, `{ total, suelo }`— llega inyectada:
 * los cupos son de `cupos.js` y duplicarlos aquí garantizaría que las dos copias se
 * desincronicen. `places` es la fuente de relleno, **opcional**: su ausencia es un
 * caso normal y el mundo se genera igual, solo que con el pool de OSM.
 */
export async function buildWorld({ lat, lon, rBase, seed, fetchData, demanda = null, places = null, onStatus = async () => {} }) {
  // El núcleo no llama a la red por su cuenta: si nadie le inyecta `fetchData`,
  // el fallo tiene que decirlo por su nombre y antes de empezar. Con la frontera
  // ya comprobable, un TypeError a mitad de la primera fase esconde el motivo.
  if (typeof fetchData !== 'function') {
    throw new Error('buildWorld necesita que se le inyecte fetchData(lat, lon, radius) → { geoJson, poiJson }');
  }

  const names = namesFor(localeFor(lat, lon));
  // Un solo índice de nombres para todo el mundo, creado aquí y repartido a las
  // fases: la unicidad es del mundo entero y no de cada familia. Se crea en la
  // orquestación y no en un módulo con estado propio para que dos mundos
  // generados en el mismo proceso no se contaminen.
  const indiceNombres = crearIndiceDeNombres();

  await onStatus('fetch');
  let data = await fetchData(lat, lon, rBase);
  await onStatus('terrain');
  let geo = parseGeo(data.geoJson, lat, lon);

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

  // El pool se construye una sola vez y con los datos definitivos: en costa, eso es
  // después de la segunda vuelta y de la máscara. La máscara entra en la admisión
  // porque un local en el mar no es un sitio al que se pueda ir; el radio de dibujo
  // no, porque se decide aquí mismo y el filtro por radio ya vive en las fases que
  // lo conocen.
  const pool = construyePool({
    poiJson: data.poiJson,
    lat0: lat,
    lon0: lon,
    semilla: seed,
    // La demanda llega inyectada si quien construye la sabe; si no, la que se
    // deduce del radio, que es la que las fases de abajo van a pedir de todas
    // formas. Sin ninguna, el déficit sería siempre cero y los topes no tendrían
    // contra qué relajarse.
    demanda: demanda ?? demandaDeAnclajes(radius),
    places,
    seaMask,
  });
  const anchors = pool.anclajes;

  await onStatus('settlements');
  const { settlements, freeAnchors } = generateSettlements(anchors, geo, radius, seed, seaMask, names, indiceNombres, pool);
  await onStatus('routes');
  // pegar al viario ANTES de trazar: si un núcleo no cuelga de la red principal, el
  // trazado no tendría más remedio que unirlo con una recta por la que no se puede andar
  const movidos = pegarAViario(settlements, geo.roads);
  const routes = buildRoutes(settlements, geo.roads, seed, names, indiceNombres);
  await onStatus('parajes');
  const parajes = generateParajes(freeAnchors, settlements, routes, geo, radius, seed, seaMask, names, indiceNombres, pool);
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
    // El pool, ya con lo que cada fase consumió: cuántos anclajes se admitieron, qué
    // se descartó y por qué, si los topes hubo que relajarlos y si la celda se generó
    // sin relleno de Places. Va como dato plano y se calcula al final a propósito.
    pool: pool.resumen(),
    seaMask,
    title: names.worldTitle(makeRng(seed + SUFIJOS_DE_FASE.titulo)),
  };
  world.casting = castAll(world);
  return world;
}
