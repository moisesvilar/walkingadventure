// El pool de anclajes reales de una celda: qué lugar del mundo real entra en el
// juego, cuál se cae por no ser apto o por no aportar reconocimiento, y quién se
// lo lleva. Tres etapas, y el orden lo obliga la tubería: la admisión ocurre antes
// de los núcleos, la puntuación cuando ya hay núcleos y calzadas, y el tope de
// diversidad al final, sobre los candidatos que se le ofrecen a la fase que reparte.

import { makeProjector, dist, pointPolylineDist } from '../core/geo.js';
import { makeRng } from '../core/rng.js';
import { SUFIJOS_DE_FASE } from '../core/semilla.js';
import { claveOsm, comparaClaveOsm, ordenaPorClave } from './clave-osm.js';
import { footprintRadius } from './settlements.js';
import { isSea } from './seamask.js';

/**
 * Catálogo de admisión: lista **cerrada** de etiquetas `clave=valor`.
 *
 * Sin comodines a propósito. Admitir una clave entera (`historic=*`) deja entrar
 * lo que OSM invente mañana bajo esa clave, y con ello se cuela cualquier cosa sin
 * que nadie lo decida. El orden importa: gana la primera regla que casa.
 *
 * Tres campos, tres usos distintos:
 *   kind   — etiqueta del lugar real ("📍 Restos del Acueducto Romano (ruinas)")
 *            y clave del sesgo suave de tipo de paraje (BIAS en parajes.js).
 *   cat    — 'emplazamiento' | 'local': las aldeas prefieren emplazamientos y
 *            las granjas locales (settlements.js).
 *   weight — peso en el clúster que decide dónde nacen ciudades y pueblos.
 *
 * Nota de dimensionado: fuentes y manantiales entran con peso bajo a propósito.
 * Son anclaje de paraje, no motivo para fundar una ciudad, y en casco urbano hay
 * tantas que con peso alto desplazarían el clúster de la ciudad hacia ellas.
 */
export const CATALOGO_ADMISION = [
  { etiqueta: 'shop=mall', kind: 'centro comercial', cat: 'local', weight: 5 },
  { etiqueta: 'historic=castle', kind: 'castillo', cat: 'emplazamiento', weight: 5 },
  { etiqueta: 'amenity=monastery', kind: 'monasterio', cat: 'emplazamiento', weight: 5 },
  { etiqueta: 'historic=monastery', kind: 'monasterio', cat: 'emplazamiento', weight: 5 },
  { etiqueta: 'historic=ruins', kind: 'ruinas', cat: 'emplazamiento', weight: 4 },
  { etiqueta: 'historic=city_gate', kind: 'ruinas', cat: 'emplazamiento', weight: 4 },
  { etiqueta: 'historic=archaeological_site', kind: 'piedra antigua', cat: 'emplazamiento', weight: 4 },
  { etiqueta: 'leisure=park', kind: 'parque', cat: 'emplazamiento', weight: 4 },
  { etiqueta: 'historic=monument', kind: 'monumento', cat: 'emplazamiento', weight: 4 },
  { etiqueta: 'historic=memorial', kind: 'monumento', cat: 'emplazamiento', weight: 4 },
  { etiqueta: 'man_made=lighthouse', kind: 'faro', cat: 'emplazamiento', weight: 3 },
  { etiqueta: 'amenity=place_of_worship', kind: 'iglesia', cat: 'emplazamiento', weight: 3 },
  { etiqueta: 'tourism=viewpoint', kind: 'mirador', cat: 'emplazamiento', weight: 3 },
  { etiqueta: 'historic=wayside_cross', kind: 'crucero', cat: 'emplazamiento', weight: 2 },
  { etiqueta: 'historic=wayside_shrine', kind: 'crucero', cat: 'emplazamiento', weight: 2 },
  { etiqueta: 'man_made=tower', kind: 'torre', cat: 'emplazamiento', weight: 2 },
  { etiqueta: 'natural=spring', kind: 'manantial', cat: 'emplazamiento', weight: 2 },
  { etiqueta: 'amenity=library', kind: 'biblioteca', cat: 'local', weight: 2 },
  { etiqueta: 'amenity=fountain', kind: 'fuente', cat: 'emplazamiento', weight: 1 },
  { etiqueta: 'amenity=restaurant', kind: 'restaurante', cat: 'local', weight: 1 },
  { etiqueta: 'amenity=cafe', kind: 'cafetería', cat: 'local', weight: 1 },
  { etiqueta: 'amenity=ice_cream', kind: 'heladería', cat: 'local', weight: 1 },
  { etiqueta: 'amenity=fast_food', kind: 'comida rápida', cat: 'local', weight: 1 },
];

/**
 * Los tipos que no entran nunca, por familias (RF-MUNDO-010,
 * `game-design/seguridad-privacidad.md` §3).
 *
 * Es un filtro **sobre el dato**, no una omisión de la consulta. La aptitud para
 * menores se conseguía hasta ahora no pidiendo bares: el día que alguien ampliara
 * la consulta, la garantía desaparecía sin que nada se pusiera rojo. La consulta
 * puede seguir siendo estrecha —eso es ancho de banda—, pero quien garantiza es
 * esto.
 *
 * `abandoned:*` **no** está aquí y es deliberado: lo abandonado es material de
 * ruina (`parajes.md`), lo demolido y lo en obras no existe como sitio al que ir.
 */
export const TIPOS_PROBLEMATICOS = [
  {
    familia: 'adultos',
    etiquetas: [
      'amenity=bar', 'amenity=pub', 'amenity=nightclub', 'amenity=stripclub',
      'amenity=casino', 'amenity=gambling', 'amenity=brothel',
      'leisure=adult_gaming_centre',
      'shop=erotic', 'shop=alcohol', 'shop=tobacco', 'shop=bookmaker',
    ],
    prefijos: [],
  },
  {
    familia: 'industria',
    etiquetas: [
      'landuse=industrial', 'landuse=quarry',
      'man_made=works', 'man_made=wastewater_plant', 'man_made=silo', 'man_made=chimney',
      'amenity=fuel',
    ],
    prefijos: [],
  },
  {
    familia: 'obras',
    etiquetas: ['landuse=construction', 'building=construction', 'highway=construction'],
    prefijos: ['demolished:'],
  },
  {
    familia: 'privado',
    etiquetas: [
      'access=private', 'access=no',
      'building=house', 'building=residential', 'building=apartments',
    ],
    prefijos: [],
  },
];

/**
 * Etiquetas que se caen por no aportar reconocimiento, con medición delante.
 *
 * `amenity=drinking_water` da 3 nombradas de 186 en A Coruña y 0 de 16 en Toledo
 * (nota del 4-ago-2026 de `parajes.md`): es mobiliario urbano, y con peso propio
 * monopolizaba los parajes de vigilancia y revelación. La regla general de abajo
 * ya lo dejaría fuera; sigue nombrado aquí para que reintroducirlo cueste borrar
 * una línea que explica por qué no.
 */
export const ETIQUETAS_SIN_RECONOCIMIENTO = ['amenity=drinking_water'];

/**
 * Tope de cuántos candidatos puede aportar una sola etiqueta `clave=valor`.
 *
 * **No recorta el pool**, y eso es lo que cambió en SPEC-005-iter-1: aplicado en la
 * admisión amputaba la materia prima del mundo antes de que existieran núcleos y
 * calzadas —45 anclajes a 26 en el costero— y la casteabilidad se hundía. El tope
 * vive ahora en el reparto, sobre los candidatos que se le ofrecen a cada fase.
 */
export const TOPE_POR_ETIQUETA = 0.25;

/** Tope por `kind`, más laxo a propósito: varias etiquetas legítimas lo comparten. */
export const TOPE_POR_KIND = 0.40;

/** Descarte de una etiqueta entera: más de estas entradas y menos de esa fracción nombradas. */
export const ENTRADAS_PARA_EXIGIR_NOMBRE = 20;
export const FRACCION_NOMBRADAS_MINIMA = 0.10;

/** Radio con el que se considera que un sitio de Places y uno de OSM son el mismo. */
export const RADIO_DEDUPLICACION_M = 25;

/** Quién puede consumir un anclaje. Un NPC no está: heredar no es consumir. */
export const ROLES_CONSUMIDORES = ['nucleo', 'servicio', 'paraje'];

/**
 * Tipos de Google Places traducidos a la misma etiqueta `clave=valor` de OSM.
 *
 * Traducir en lugar de tener dos catálogos es lo que hace que el filtro de tipos
 * problemáticos y los topes se apliquen igual a las dos fuentes sin escribirlos
 * dos veces.
 */
export const TIPOS_DE_PLACES = {
  restaurant: 'amenity=restaurant',
  cafe: 'amenity=cafe',
  coffee_shop: 'amenity=cafe',
  ice_cream_shop: 'amenity=ice_cream',
  fast_food_restaurant: 'amenity=fast_food',
  meal_takeaway: 'amenity=fast_food',
  library: 'amenity=library',
  church: 'amenity=place_of_worship',
  mosque: 'amenity=place_of_worship',
  synagogue: 'amenity=place_of_worship',
  hindu_temple: 'amenity=place_of_worship',
  place_of_worship: 'amenity=place_of_worship',
  park: 'leisure=park',
  national_park: 'leisure=park',
  shopping_mall: 'shop=mall',
  monument: 'historic=monument',
  historical_landmark: 'historic=monument',
  historical_place: 'historic=monument',
  castle: 'historic=castle',
  observation_deck: 'tourism=viewpoint',
  // Los problemáticos también se traducen: si no, entrarían por la puerta de atrás.
  bar: 'amenity=bar',
  pub: 'amenity=pub',
  night_club: 'amenity=nightclub',
  casino: 'amenity=casino',
  liquor_store: 'shop=alcohol',
  tobacco_shop: 'shop=tobacco',
  adult_entertainment_store: 'shop=erotic',
  strip_club: 'amenity=stripclub',
  gas_station: 'amenity=fuel',
};

function paresDeEtiqueta(etiqueta) {
  const i = etiqueta.indexOf('=');
  return [etiqueta.slice(0, i), etiqueta.slice(i + 1)];
}

/**
 * La familia problemática de un elemento, o `null` si no lo es.
 *
 * Manda sobre el catálogo de admisión: un elemento que casa con los dos no entra.
 */
export function familiaProblematica(tags) {
  const t = tags || {};
  // Las claves se recorren ordenadas y no por orden de inserción: de aquí sale una
  // decisión de generación y el orden de llegada no puede entrar en ella.
  const claves = Object.keys(t).sort();
  for (const familia of TIPOS_PROBLEMATICOS) {
    for (const etiqueta of familia.etiquetas) {
      const [clave, valor] = paresDeEtiqueta(etiqueta);
      if (t[clave] === valor) return familia.familia;
    }
    for (const prefijo of familia.prefijos) {
      if (claves.some((c) => c.startsWith(prefijo))) return familia.familia;
    }
  }
  return null;
}

/** La entrada del catálogo que admite a un elemento, o `null`. Gana la primera que casa. */
export function entradaDeAdmision(tags) {
  const t = tags || {};
  for (const entrada of CATALOGO_ADMISION) {
    const [clave, valor] = paresDeEtiqueta(entrada.etiqueta);
    if (t[clave] === valor) return entrada;
  }
  return null;
}

// Los elementos malformados —sin tipo y sin identificador— son un fallo de la capa
// de datos, no un páramo: una celda sin POIs es legítima y una fuente sin
// identificadores no se puede usar sin romper el uso único.
function exigeElementoValido(el, i, fuente) {
  if (!el || typeof el !== 'object') {
    throw new Error(`la fuente ${fuente} trae un elemento que no es un objeto en la posición ${i}: ${JSON.stringify(el)}`);
  }
  if (el.type == null && el.id == null) {
    throw new Error(
      `la fuente ${fuente} trae un elemento sin tipo ni identificador en la posición ${i}: ${JSON.stringify(el).slice(0, 200)}`,
    );
  }
}

function admiteDeOsm(poiJson, proj, cuenta) {
  const elementos = Array.isArray(poiJson?.elements) ? poiJson.elements : [];
  const anclajes = [];
  for (let i = 0; i < elementos.length; i++) {
    const el = elementos[i];
    exigeElementoValido(el, i, 'OSM');
    const t = el.tags || {};

    const familia = familiaProblematica(t);
    if (familia) { cuenta.problematicos[familia] += 1; continue; }

    const entrada = entradaDeAdmision(t);
    if (!entrada) { cuenta.fueraDelCatalogo += 1; continue; }
    if (ETIQUETAS_SIN_RECONOCIMIENTO.includes(entrada.etiqueta)) { cuenta.sinReconocimiento += 1; continue; }

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) { cuenta.sinCoordenada += 1; continue; }

    const p = proj.toXY(lat, lon);
    anclajes.push({
      ...p,
      osmId: claveOsm(el, [p]),
      fuente: 'osm',
      name: t.name || null,
      etiqueta: entrada.etiqueta,
      kind: entrada.kind,
      cat: entrada.cat,
      weight: entrada.weight,
    });
  }
  return ordenaPorClave(anclajes);
}

// Un resultado de Places se convierte a las etiquetas de OSM que le corresponden y
// a partir de ahí se le aplica exactamente lo mismo que a un elemento de OSM.
function tagsDePlaces(tipos) {
  const t = {};
  for (const tipo of [...(tipos ?? [])].sort()) {
    const etiqueta = TIPOS_DE_PLACES[tipo];
    if (!etiqueta) continue;
    const [clave, valor] = paresDeEtiqueta(etiqueta);
    if (t[clave] === undefined) t[clave] = valor;
  }
  return t;
}

function candidatosDePlaces(places, proj, cuenta) {
  const bruto = Array.isArray(places) ? places : Array.isArray(places?.resultados) ? places.resultados : [];
  const capturadoFuente = Array.isArray(places) ? null : places?.capturado ?? null;
  const candidatos = [];
  for (const r of bruto) {
    if (!r || typeof r !== 'object') { cuenta.placesInvalidos += 1; continue; }
    const placeId = r.place_id ?? r.placeId ?? null;
    // Sin identificador estable no se puede garantizar el uso único ni volver a
    // pedir el contenido refrescable, que son las dos cosas por las que Places está
    // aquí. Se descarta en lugar de sintetizar un identificador por posición.
    if (!placeId) { cuenta.placesSinIdentificador += 1; continue; }

    const tags = tagsDePlaces(r.types ?? r.tipos);
    const familia = familiaProblematica(tags);
    if (familia) { cuenta.problematicos[familia] += 1; continue; }
    const entrada = entradaDeAdmision(tags);
    if (!entrada) { cuenta.fueraDelCatalogo += 1; continue; }
    if (ETIQUETAS_SIN_RECONOCIMIENTO.includes(entrada.etiqueta)) { cuenta.sinReconocimiento += 1; continue; }

    const lat = r.lat ?? r.location?.lat ?? r.location?.latitude ?? null;
    const lon = r.lon ?? r.lng ?? r.location?.lng ?? r.location?.longitude ?? null;
    if (lat == null || lon == null) { cuenta.sinCoordenada += 1; continue; }

    const p = proj.toXY(lat, lon);
    const nombre = r.name ?? r.nombre ?? null;
    candidatos.push({
      ...p,
      osmId: `places:${placeId}`,
      placeId,
      fuente: 'places',
      name: nombre,
      etiqueta: entrada.etiqueta,
      kind: entrada.kind,
      cat: entrada.cat,
      weight: entrada.weight,
      // Capa del lado real: de Places solo el identificador se puede guardar
      // indefinidamente, así que el nombre y la coordenada viajan marcados como
      // refrescables y con la fecha en que se capturaron —inyectada, que el núcleo
      // no lee el reloj—. La capa de ficción no depende de nada de esto.
      refrescable: {
        nombre,
        lat,
        lon,
        capturado: r.capturado ?? capturadoFuente ?? null,
      },
    });
  }
  // Por identificador y no por orden de llegada: de aquí sale qué entra a rellenar.
  return candidatos.sort((a, b) => (a.osmId < b.osmId ? -1 : a.osmId > b.osmId ? 1 : 0));
}

// Un tag solo entra si aporta reconocimiento: una etiqueta con muchas entradas de
// las que casi ninguna tiene nombre es mobiliario urbano, y el sentido del anclaje
// es el guiño de identificar el lugar real. Es la generalización de la medición de
// `drinking_water`, para que el próximo tag masivo no haya que descubrirlo a mano.
function descartaEtiquetasSinNombre(anclajes, cuenta) {
  const total = new Map();
  const nombradas = new Map();
  for (const a of anclajes) {
    total.set(a.etiqueta, (total.get(a.etiqueta) ?? 0) + 1);
    if (a.name) nombradas.set(a.etiqueta, (nombradas.get(a.etiqueta) ?? 0) + 1);
  }
  const fuera = new Set();
  for (const etiqueta of [...total.keys()].sort()) {
    const n = total.get(etiqueta);
    const conNombre = nombradas.get(etiqueta) ?? 0;
    if (n > ENTRADAS_PARA_EXIGIR_NOMBRE && conNombre / n < FRACCION_NOMBRADAS_MINIMA) {
      fuera.add(etiqueta);
      cuenta.etiquetasSinNombre.push({ etiqueta, entradas: n, nombradas: conNombre });
    }
  }
  if (!fuera.size) return anclajes;
  cuenta.sinReconocimiento += anclajes.filter((a) => fuera.has(a.etiqueta)).length;
  return anclajes.filter((a) => !fuera.has(a.etiqueta));
}

function normalizaDemanda(demanda) {
  if (demanda == null) return { total: 0, suelo: 0 };
  if (typeof demanda === 'number') return { total: Math.max(0, demanda), suelo: Math.max(0, demanda) };
  return { total: Math.max(0, demanda.total ?? 0), suelo: Math.max(0, demanda.suelo ?? demanda.total ?? 0) };
}

/**
 * Etapa 1 del pool: la admisión.
 *
 * @param {object} opciones
 *   `poiJson` la respuesta cruda de OSM, obligatoria; `lat0`/`lon0` el centro de
 *   la celda; `semilla` la de la celda, de la que sale el desempate del orden;
 *   `demanda` cuántos anclajes hacen falta —`{ total, suelo }` o un número—, que
 *   **llega inyectada** porque los cupos son de otras fases; `places` la fuente de
 *   relleno, opcional y cuya ausencia es un caso normal; `placesActivo`, el
 *   interruptor de SPEC-025, que apagado deja el pool en OSM sin cambiar nada más;
 *   `radio` y `seaMask`, si
 *   quien construye ya los conoce, para no admitir lo que cae fuera del mundo o en
 *   el mar.
 * @returns el pool, con su registro de uso único.
 */
export function construyePool({ poiJson, lat0, lon0, semilla = null, demanda = null, places = null, radio = null, seaMask = null, placesActivo = true } = {}) {
  const proj = makeProjector(lat0, lon0);
  const cuenta = {
    // Las familias se declaran todas y en el orden del filtro: si se fueran
    // creando según van apareciendo, el orden de las claves de este objeto
    // dependería del orden de llegada de los elementos y el mundo serializado
    // cambiaría con él.
    problematicos: Object.fromEntries(TIPOS_PROBLEMATICOS.map((f) => [f.familia, 0])),
    fueraDelCatalogo: 0,
    sinReconocimiento: 0,
    sinCoordenada: 0,
    fueraDelRadio: 0,
    enMar: 0,
    duplicadosDePlaces: 0,
    placesSinIdentificador: 0,
    placesInvalidos: 0,
    etiquetasSinNombre: [],
  };

  let anclajes = admiteDeOsm(poiJson, proj, cuenta);

  if (Number.isFinite(radio) && radio > 0) {
    const dentro = anclajes.filter((a) => Math.hypot(a.x, a.y) <= radio);
    cuenta.fueraDelRadio = anclajes.length - dentro.length;
    anclajes = dentro;
  }
  if (seaMask) {
    const enTierra = anclajes.filter((a) => !isSea(seaMask, a));
    cuenta.enMar = anclajes.length - enTierra.length;
    anclajes = enTierra;
  }

  anclajes = descartaEtiquetasSinNombre(anclajes, cuenta);

  // Places solo cubre déficit: no sustituye ninguna fase, y una celda que ya llega
  // a su demanda con OSM no admite ni una entrada suya (`parajes.md`).
  const exigido = normalizaDemanda(demanda);
  // El interruptor de Places (SPEC-025) apagado se comporta **exactamente** como no
  // haber ofrecido fuente de relleno: el pool se queda en OSM y el mundo se genera
  // igual, sin un estado nuevo que las pantallas pudieran llegar a distinguir.
  const ofreceRelleno = placesActivo && places != null;
  let deOsm = anclajes.length;
  let admitidosDePlaces = 0;
  if (ofreceRelleno && exigido.total > anclajes.length) {
    const candidatos = candidatosDePlaces(places, proj, cuenta);
    const rellenados = [];
    for (const c of candidatos) {
      if (deOsm + rellenados.length >= exigido.total) break;
      const mismoSitio = anclajes.some((a) => a.kind === c.kind && dist(a, c) <= RADIO_DEDUPLICACION_M);
      if (mismoSitio) { cuenta.duplicadosDePlaces += 1; continue; }
      if (rellenados.some((r) => r.kind === c.kind && dist(r, c) <= RADIO_DEDUPLICACION_M)) { cuenta.duplicadosDePlaces += 1; continue; }
      rellenados.push(c);
    }
    admitidosDePlaces = rellenados.length;
    anclajes = [...anclajes, ...rellenados];
  }

  // Aquí ya no se recorta nada: lo que pasó el filtro de tipos problemáticos, el
  // catálogo, el descarte por falta de nombre, el radio y la máscara entra entero.
  // El pool sigue contando cuánto aporta cada etiqueta y cada `kind` —es lo que
  // consume quien reparte—, pero no decide con ello.
  deOsm = anclajes.filter((a) => a.fuente === 'osm').length;
  admitidosDePlaces = anclajes.length - deOsm;

  // El desempate del orden es lo único que la semilla decide aquí: dos semillas
  // distintas admiten exactamente el mismo conjunto. Se reparte recorriendo la
  // lista ya ordenada por clave estable, para que el orden de llegada de Overpass
  // no lo mueva.
  const rng = semilla ? makeRng(semilla + SUFIJOS_DE_FASE.anclajes) : null;
  for (const a of anclajes) a.desempate = rng ? rng() : 0;

  return creaPool({
    anclajes,
    demanda: exigido,
    relleno: { fuente: ofreceRelleno ? 'places' : null, admitidos: admitidosDePlaces, sinRelleno: !ofreceRelleno || admitidosDePlaces === 0 },
    deOsm,
    descartes: cuenta,
  });
}

function cuentaPor(anclajes, campo) {
  const m = new Map();
  for (const a of anclajes) m.set(a[campo], (m.get(a[campo]) ?? 0) + 1);
  return [...m.keys()].sort().map((clave) => ({ clave, n: m.get(clave) }));
}

/**
 * El pool con su registro de uso único.
 *
 * Tomar es irreversible dentro de la generación de la celda y transversal a las
 * dos etapas: cualquier fase puede tomar, y tomar dos veces el mismo anclaje es un
 * error y no un no-op silencioso. Un fallo silencioso ahí produce mundos con el
 * mismo bar de taberna y de ruina sin que nada se ponga rojo.
 */
export function creaPool({ anclajes = [], demanda = { total: 0, suelo: 0 }, relleno = null, deOsm = null, descartes = null } = {}) {
  const consumidos = new Map();
  const excluidos = new Set();

  const identificador = (x) => (typeof x === 'string' ? x : x?.osmId ?? null);

  const pool = {
    anclajes,
    demanda,
    relleno,
    descartes,
    get deficit() {
      return Math.max(0, demanda.total - anclajes.length);
    },
    libres() {
      return anclajes.filter((a) => !consumidos.has(a.osmId) && !excluidos.has(a.osmId));
    },
    estaTomado(x) {
      const id = identificador(x);
      return id != null && consumidos.has(id);
    },
    consumidoPor(x) {
      const id = identificador(x);
      return id == null ? null : consumidos.get(id) ?? null;
    },
    tomar(x, rol, nombre = null) {
      const id = identificador(x);
      if (!id) throw new Error('tomar necesita el identificador del anclaje: sin él no se puede garantizar el uso único');
      if (!ROLES_CONSUMIDORES.includes(rol)) {
        throw new Error(`rol consumidor desconocido "${rol}": los declarados son ${ROLES_CONSUMIDORES.join(', ')}`);
      }
      const duenno = consumidos.get(id);
      if (duenno) {
        throw new Error(
          `el anclaje ${id} ya lo consumió ${duenno.rol}${duenno.nombre ? ` "${duenno.nombre}"` : ''} y ahora lo pide ${rol}${nombre ? ` "${nombre}"` : ''}: los anclajes son de uso único`,
        );
      }
      consumidos.set(id, { rol, nombre });
      return true;
    },
    // Lo que el jugador descarta deja de estar disponible sin resembrar nada: lo ya
    // colocado sigue donde estaba, y esto solo saca al anclaje del reparto futuro.
    excluir(x) {
      const id = identificador(x);
      if (!id) throw new Error('excluir necesita el identificador del anclaje');
      excluidos.add(id);
      return true;
    },
    estaExcluido(x) {
      const id = identificador(x);
      return id != null && excluidos.has(id);
    },
    tomados() {
      return [...consumidos.keys()].sort(comparaClaveOsm).map((osmId) => ({ osmId, ...consumidos.get(osmId) }));
    },
    resumen() {
      return {
        admitidos: anclajes.length,
        deOsm: deOsm ?? anclajes.filter((a) => a.fuente === 'osm').length,
        dePlaces: anclajes.filter((a) => a.fuente === 'places').length,
        demanda,
        deficit: pool.deficit,
        relleno,
        porEtiqueta: cuentaPor(anclajes, 'etiqueta'),
        porKind: cuentaPor(anclajes, 'kind'),
        tomados: pool.tomados(),
        excluidos: [...excluidos].sort(comparaClaveOsm),
        descartes,
      };
    },
  };
  return pool;
}

/**
 * Puntos de la etapa 2.
 *
 * El de nombre es mayor que el desempate a propósito: si no, el azar podría
 * adelantar a un anclaje sin nombre sobre uno con nombre a igualdad de distancias,
 * que es justo lo que el criterio prohíbe.
 *
 * La penalización de estar dentro del radio urbano es mayor en magnitud que la
 * suma de todo lo demás, y también a propósito: deja a esos anclajes **detrás de
 * cualquiera** que esté fuera, que es lo que el filtro duro conseguía, pero sin
 * excluirlos —cuando no queda otro, se usan—. Un número pequeño los mezclaba con
 * los de fuera y llenaba de parajes el casco urbano de un mundo denso.
 */
export const PUNTOS = {
  rutaCerca: 2,
  rutaMedia: 1,
  nombre: 1,
  dentroDeNucleo: -100,
  desempate: 0.8,
};

/**
 * Etapa 2 del pool: la puntuación de los candidatos libres.
 *
 * Cerca de una ruta suma —a un paraje al que no lleva ningún camino no se va— y
 * dentro del radio urbano de un núcleo resta. **Resta, no excluye**: `parajes.md`
 * dice «se penalizan», y como filtro duro deja el pool vacío en una celda pequeña
 * y urbana. El desempate sale del anclaje, que lo trae de la fase del pool: así
 * puntuar dos veces da exactamente el mismo orden.
 */
export function puntuaCandidatos(anclajes, { settlements = [], routes = [], radius = 0 } = {}) {
  const trazadas = routes.filter((r) => !r.fallback).map((r) => r.pts);
  return anclajes
    .map((a) => {
      const dRuta = trazadas.length ? Math.min(...trazadas.map((pts) => pointPolylineDist(a, pts))) : Infinity;
      const dentroDeNucleo = settlements.some((s) => dist(a, s) <= footprintRadius(s.type, radius) * 1.05);
      const puntos =
        (dRuta < 100 ? PUNTOS.rutaCerca : dRuta < 300 ? PUNTOS.rutaMedia : 0) +
        (a.name ? PUNTOS.nombre : 0) +
        (dentroDeNucleo ? PUNTOS.dentroDeNucleo : 0) +
        (a.desempate ?? 0) * PUNTOS.desempate;
      return { a, puntos, dRuta, dentroDeNucleo };
    })
    // el empate lo rompe la clave estable de OSM, nunca el orden de llegada
    .sort((x, y) => y.puntos - x.puntos || comparaClaveOsm(x.a.osmId, y.a.osmId));
}

// Preferencia al recortar: primero los mejor puntuados, a igualdad los que tienen
// nombre —el punto por nombre ya lo premia, pero a igualdad de puntos manda
// explícitamente— y el empate final lo rompe la clave estable, nunca el orden de
// llegada.
function ordenDelRecorte(x, y) {
  if (x.puntos !== y.puntos) return y.puntos - x.puntos;
  const nx = x.a.name ? 1 : 0, ny = y.a.name ? 1 : 0;
  if (nx !== ny) return ny - nx;
  return comparaClaveOsm(x.a.osmId, y.a.osmId);
}

/**
 * Etapa 3: el tope de diversidad, aplicado sobre los candidatos que se le ofrecen a
 * una fase que reparte y **solo sobre su excedente**.
 *
 * Tres decisiones, y las tres salen de que aplicarlo antes hacía daño:
 *   - se mide sobre los candidatos ofrecidos, no sobre los que la fase elige: con
 *     cupos de 4 o 5, el 25 % de lo elegido es un anclaje por etiqueta, un tope
 *     tan duro que volvería a competir con la jugabilidad;
 *   - si los candidatos no llegan al cupo no se descarta ninguno: recortar donde
 *     ya falta es exactamente el defecto que esta iteración corrige;
 *   - la relajación es inmediata y sin escalera: se recuperan los mejores
 *     descartados hasta cubrir el cupo, y quien reparte lo declara. La escalera de
 *     escalones anterior recortaba otra vez antes de comprobar, así que relajaba
 *     tarde y no relajaba nunca.
 *
 * @param {Array<{a: object, puntos: number}>} candidatos los de `puntuaCandidatos`.
 * @param {number} cupo cuántos elementos va a colocar la fase.
 * @returns `{ candidatos, relajado, recortados, recuperados }`, con los
 *   supervivientes **en el orden en que llegaron**: recortar ordena a quién se
 *   conserva, no en qué orden se reparte.
 */
export function recortaPorTopes(candidatos, cupo, { topeEtiqueta = TOPE_POR_ETIQUETA, topeKind = TOPE_POR_KIND } = {}) {
  const n = candidatos.length;
  const sinRecorte = { candidatos, relajado: false, recortados: 0, recuperados: 0 };
  if (n === 0 || n <= cupo) return sinRecorte;

  const limiteEtiqueta = Math.max(1, Math.floor(n * topeEtiqueta));
  const limiteKind = Math.max(1, Math.floor(n * topeKind));

  const porEtiqueta = new Map();
  const porKind = new Map();
  const vivos = new Set();
  const descartados = [];
  for (const c of [...candidatos].sort(ordenDelRecorte)) {
    const ne = porEtiqueta.get(c.a.etiqueta) ?? 0;
    const nk = porKind.get(c.a.kind) ?? 0;
    if (ne >= limiteEtiqueta || nk >= limiteKind) { descartados.push(c); continue; }
    porEtiqueta.set(c.a.etiqueta, ne + 1);
    porKind.set(c.a.kind, nk + 1);
    vivos.add(c.a.osmId);
  }

  // El recorte se detiene en el cupo: los descartados vienen ya en orden de
  // preferencia, así que recuperar es recorrerlos hasta cubrirlo.
  let recuperados = 0;
  for (const c of descartados) {
    if (vivos.size >= cupo) break;
    vivos.add(c.a.osmId);
    recuperados += 1;
  }

  return {
    candidatos: candidatos.filter((c) => vivos.has(c.a.osmId)),
    relajado: recuperados > 0,
    recortados: n - vivos.size,
    recuperados,
  };
}
