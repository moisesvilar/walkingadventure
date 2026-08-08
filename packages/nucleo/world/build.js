// Construcción completa de un mundo a partir de las consultas OSM.
// Tubería canónica del generador: la comparten la app y las herramientas
// headless, y es la única. Misma tubería, mismos mundos.

import { parseGeo, parseStreets } from './osm.js';
import { construyePool } from './anclajes.js';
import { buildSeaMask, computeDisplayRadius } from './seamask.js';
import { generateSettlements, countsForRadius, SERVICES } from './settlements.js';
import { buildRoutes, linkParajes, tramosSupuestos, validaTramos } from './routes.js';
import { construyeGrafo, pegarAViario, validaGrafo } from './grafo.js';
import { generateParajes, parajeCountForRadius } from './parajes.js';
import { TRAMO_DE_REFERENCIA_M, techoDeParajes, vocabularioDeEscenas } from './cupos.js';
import { sueloDeVocabulario } from './escenas.js';
import { castAll } from '../quests/casting.js';
import { localeFor, namesFor, crearIndiceDeNombres } from '../names/index.js';
import { makeRng } from '../core/rng.js';
import { SUFIJOS_DE_FASE } from '../core/semilla.js';

const ORDEN_DE_NUCLEOS = ['ciudad', 'pueblo', 'aldea', 'granja'];

/**
 * Las vías con las que se construye el grafo: las carreteras del terreno más el
 * callejero, en el mismo saco y sin repetir.
 *
 * Las dos consultas se solapan a propósito —`unclassified` y `track` salen en las
 * dos—, así que un way puede llegar dos veces; se descarta por su clave estable de
 * OSM y no por su geometría. El orden es el de las dos colecciones, que ya salen
 * ordenadas por esa misma clave desde el parseo.
 *
 * Se exporta para que nadie la vuelva a reescribir a mano: quien construya el grafo
 * fuera de esta tubería —una herramienta, una prueba— tiene que meter las mismas
 * vías, y una copia de esta unión es otra oportunidad de divergir.
 */
export function viasDelGrafo(geo) {
  const vistas = new Set();
  const out = [];
  for (const via of [...geo.roads, ...(geo.callejero ?? [])]) {
    if (via.osmId) {
      if (vistas.has(via.osmId)) continue;
      vistas.add(via.osmId);
    }
    out.push(via);
  }
  return out;
}

/**
 * Cuántos anclajes va a pedir este mundo, **leyendo** las declaraciones de las
 * fases que se los van a gastar en vez de copiar sus números: los cupos de núcleos
 * y los servicios garantizados de `settlements.js` y el cupo de parajes de
 * `parajes.js`. Es lo que usa el pool cuando nadie le inyecta una demanda, y sale
 * del radio del mundo y de nada más — nunca del tramo de quien juega, que
 * dimensiona los cupos de la celda pero jamás su contenido.
 */
export function demandaDeAnclajes(radius, cupoParajes = null) {
  const cuentas = countsForRadius(radius);
  const nucleos = cuentas.reduce((a, b) => a + b, 0);
  let servicios = 0;
  ORDEN_DE_NUCLEOS.forEach((tipo, i) => { servicios += SERVICES[tipo].fixed.length * cuentas[i]; });
  // El cupo de parajes ya no es solo el techo por ritmo: desde SPEC-006 lleva
  // debajo el suelo derivado del catálogo, y pedir menos anclajes que huecos hay
  // que llenar es pedir de menos justo en las celdas pobres.
  const parajes = cupoParajes?.cupo ?? parajeCountForRadius(radius);
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
 *
 * `radioEnTramos` es el alcance de la celda medido en tramos, con el que se calcula
 * el techo de parajes por ritmo. Lo trae la **geometría de la rejilla**, que no se
 * mueve nunca, y no el tramo de quien juega hoy: `accesibilidad.md` §1 dice que el
 * tramo cambia hasta dónde te manda una quest, **nunca qué existe**. Sin él se
 * deduce del radio con el tramo de referencia, que es la misma cuenta para quien
 * anda 2 km. `vocabulario` son las escenas que el catálogo le pide a un paraje: es
 * la frontera de inyección de SPEC-006 y su valor de arranque se lee de las
 * plantillas hasta que exista el catálogo de verdad. Orquestar es pasarlo; la fase
 * de parajes no lo importa.
 */
export async function buildWorld({ lat, lon, rBase, seed, fetchData, demanda = null, places = null, radioEnTramos = null, vocabulario = null, onStatus = async () => {} }) {
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
  // El callejero es **opcional** y su ausencia es un caso normal: quien no lo
  // inyecta genera el mundo igual, solo que el grafo se queda con las carreteras.
  // Cuando llega, es la fuente principal de los huecos cortos que hay que coser.
  geo.callejero = data.callejeroJson ? parseStreets(data.callejeroJson, lat, lon) : [];

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
    geo.callejero = data.callejeroJson ? parseStreets(data.callejeroJson, lat, lon) : [];
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

  // El vocabulario de escenas y el cupo de parajes, resueltos antes del pool porque
  // el cupo dice cuántos anclajes hay que pedir. El vocabulario inyectado manda; su
  // valor de arranque sale de las plantillas del prototipo. El techo es por ritmo y
  // el suelo por aritmética, y cuando chocan gana el suelo.
  const vocabularioDeParajes = vocabulario ?? vocabularioDeEscenas();
  const enTramos = Number.isFinite(radioEnTramos) && radioEnTramos > 0 ? radioEnTramos : radius / TRAMO_DE_REFERENCIA_M;
  const suelo = sueloDeVocabulario(vocabularioDeParajes);
  const techo = techoDeParajes(enTramos);
  const cupoDeParajes = { cupo: Math.max(suelo, techo), suelo, techo, vocabulario: vocabularioDeParajes };

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
    // formas. Sin ninguna, el déficit sería siempre cero y el relleno de Places no
    // sabría cuánto le toca cubrir.
    demanda: demanda ?? demandaDeAnclajes(radius, cupoDeParajes),
    places,
    seaMask,
  });
  const anchors = pool.anclajes;

  await onStatus('settlements');
  const { settlements, freeAnchors } = generateSettlements(anchors, geo, radius, seed, seaMask, names, indiceNombres, pool);
  await onStatus('routes');
  // El grafo viario, **una sola vez**: lo comparten el pegado de puntos al viario,
  // el trazado de calzadas y el enlace de parajes. Construirlo dentro de cada fase
  // —como hacía el prototipo, tres veces sobre el mismo callejero— son tres
  // cosidos y tres oportunidades de divergir, y es además la fase más cara del
  // generador. El callejero entra aquí con las carreteras: es donde están los
  // huecos cortos que hay que coser antes de trazar.
  const grafo = validaGrafo(construyeGrafo(viasDelGrafo(geo)));
  // pegar al viario ANTES de trazar: si un núcleo no cuelga de la red principal, el
  // trazado no tendría más remedio que unirlo con una recta por la que no se puede andar
  const movidos = pegarAViario(settlements, grafo);
  const routes = buildRoutes(settlements, grafo, seed, names, indiceNombres);
  await onStatus('parajes');
  // Dónde se anota que una fase tuvo que saltarse los topes de diversidad. Lo
  // declara el mundo y no el pool: desde SPEC-005-iter-1 el pool no aplica topes,
  // y quien reparte es el único que sabe si le faltaban candidatos para su cupo.
  const reparto = { relajaciones: [] };
  // La ficha de cobertura: suelo, techo, cupo y qué escenas quedaron sin cubrir.
  // Dato interno que consume el casting; no sale a ninguna pantalla.
  const coberturaParajes = {};
  const parajes = generateParajes(freeAnchors, settlements, routes, geo, radius, seed, seaMask, names, indiceNombres, pool, reparto, {
    cupo: cupoDeParajes,
    vocabulario: vocabularioDeParajes,
    ficha: coberturaParajes,
    // El mismo grafo que se pegó y se trazó, y por la misma razón: los cruces son
    // bifurcaciones de la red viaria, no coincidencias entre las calzadas que
    // acabamos de dibujar. Con el callejero dentro del grafo, dos calzadas dejan de
    // compartir tramo salvo a la salida del pueblo.
    grafo,
  });
  // los parajes se enganchan a la red DESPUÉS de existir: hasta aquí no se sabe dónde
  // están, y algunos nacen precisamente de los cruces de las calzadas
  movidos.push(...pegarAViario(parajes.filter((p) => p.origin !== 'grafo'), grafo));
  routes.push(...linkParajes(parajes, routes, settlements, grafo, seed, names, indiceNombres));
  // Ninguna capa aguas abajo puede perder la marca en silencio, y esto es lo que lo
  // hace comprobable: un tramo sin marca es un error de construcción, no un dato
  // que falte.
  validaTramos(routes);

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
    // El informe del grafo: cuántos nodos, cuántas componentes quedan, cuántas
    // aristas se cosieron y cuál es la separación mínima que quedó sin coser. Lo
    // último es lo que distingue un dato malo de una separación de verdad.
    grafo: grafo.informe,
    // Y la lista de tramos que son suposición nuestra, para que el filtro y la
    // propagación de rumores no tengan que recorrer el grafo para saberlo.
    suposiciones: tramosSupuestos(routes),
    // El pool, ya con lo que cada fase consumió: cuántos anclajes se admitieron, qué
    // se descartó y por qué, y si la celda se generó sin relleno de Places. Va como
    // dato plano y se calcula al final a propósito.
    pool: pool.resumen(),
    // Y aparte, lo que el reparto tuvo que saltarse: vacío cuando los candidatos
    // sobraban, que es el caso normal.
    reparto,
    coberturaParajes,
    seaMask,
    title: names.worldTitle(makeRng(seed + SUFIJOS_DE_FASE.titulo)),
  };
  world.casting = castAll(world);
  return world;
}
