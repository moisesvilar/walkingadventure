// Núcleos de población ficticios a partir de anclajes reales (POIs), con cupos
// exactos por radio y servicios anclados a POIs reales únicos.

import { cuantizaPunto, dist, pointInPolygon, polygonBBox, polygonArea } from '../core/geo.js';
import { isSea } from './seamask.js';
import { makeRng, randInt, shuffle } from '../core/rng.js';
import { SUFIJOS_DE_FASE } from '../core/semilla.js';
import { POI_LABELS, crearIndiceDeNombres } from '../names/index.js';
import { comparaClaveOsm } from './clave-osm.js';

// Servicios de cada tipo de núcleo (fixed siempre; extra según tamaño). Exportada
// para que `cupos.js` cuente servicios leyendo esta declaración en vez de copiarla:
// dos tablas que dicen lo mismo se desincronizan a la primera.
export const SERVICES = {
  ciudad: { fixed: ['posada', 'taberna', 'boticario', 'armeria', 'conjureria', 'mercado'], extra: [] },
  pueblo: { fixed: ['posada', 'taberna'], extra: ['boticario', 'armeria', 'conjureria', 'mercado'] },
  aldea: { fixed: ['taberna'], extra: ['posada', 'boticario'] },
  granja: { fixed: [], extra: ['posada'] },
};

function serviceKinds(rng, type) {
  const def = SERVICES[type];
  const kinds = def.fixed.slice();
  const nExtra = type === 'pueblo' ? randInt(rng, 1, 2) : type === 'aldea' ? randInt(rng, 0, 1) : type === 'granja' ? (rng() < 0.25 ? 1 : 0) : 0;
  kinds.push(...shuffle(rng, def.extra).slice(0, nExtra));
  return kinds;
}

function clusterScore(anchor, anchors, radius) {
  let s = 0;
  for (const a of anchors) {
    if (dist(anchor, a) <= radius) s += a.weight;
  }
  return s;
}

function farFromAll(p, placed, minDist) {
  return placed.every((s) => dist(p, s) >= minDist);
}

// Tierra firme: ni el punto ni un anillo a su alrededor tocan mar (descarta islotes).
function isFirmLand(p, seaMask, ring = 400) {
  if (isSea(seaMask, p)) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (isSea(seaMask, { x: p.x + Math.cos(a) * ring, y: p.y + Math.sin(a) * ring })) return false;
  }
  return true;
}

function inWater(p, lakes) {
  for (const { pts } of lakes) {
    const bb = polygonBBox(pts);
    if (p.x < bb.minX || p.x > bb.maxX || p.y < bb.minY || p.y > bb.maxY) continue;
    if (pointInPolygon(p, pts)) return true;
  }
  return false;
}

// Radio urbano: los servicios se anclan a POIs reales dentro de esta distancia.
const FOOTPRINT = { ciudad: 600, pueblo: 400, aldea: 250, granja: 150 };

export function footprintRadius(type, worldRadius) {
  const k = Math.max(0.3, Math.min(3, worldRadius / 2000));
  return FOOTPRINT[type] * k;
}

// Cupos EXACTOS por radio: [ciudades, pueblos, aldeas, granjas].
// Entre tramos se interpola linealmente; por encima de 20 km se mantiene el último.
const COUNT_TIERS = [
  [500, [1, 1, 1, 2]],
  [1000, [1, 1, 2, 3]],
  [2000, [1, 2, 3, 4]],
  [5000, [1, 3, 4, 5]],
  [10000, [2, 5, 7, 5]],
  [20000, [2, 9, 14, 20]],
];

export function countsForRadius(r) {
  if (r < 250) return [1, 1, 1, 1];
  if (r < 500) return [1, 1, 1, 2];
  const last = COUNT_TIERS[COUNT_TIERS.length - 1];
  if (r >= last[0]) return last[1].slice();
  for (let i = 0; i < COUNT_TIERS.length - 1; i++) {
    const [r0, c0] = COUNT_TIERS[i];
    const [r1, c1] = COUNT_TIERS[i + 1];
    if (r >= r0 && r < r1) {
      const t = (r - r0) / (r1 - r0);
      return c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
    }
  }
  return [1, 1, 1, 1];
}

/**
 * anchors: POIs reales proyectados. geo: features geográficas. radius: metros.
 * names: paquete de nombres del idioma del mundo (packages/nucleo/names/).
 * indice: índice de nombres del mundo, compartido por las cinco familias que
 * nombran; por defecto uno propio, para que la fase se pueda ejercitar suelta.
 * pool: el registro de uso único de la celda, si quien genera lo lleva; cada
 * núcleo y cada servicio declara ahí el anclaje que consume y con qué papel.
 * Devuelve { settlements, freeAnchors }: los anclajes no consumidos quedan
 * disponibles para los parajes.
 */
export function generateSettlements(anchors, geo, radius, seedStr, seaMask = null, names, indice = crearIndiceDeNombres(), pool = null) {
  // Con sufijo de fase, como las demás. Hasta aquí esta fase derivaba su generador
  // de la semilla pelada: no era un fallo de determinismo, pero la dejaba compartir
  // flujo con cualquiera que llegara con la misma cadena y contradecía la regla de
  // que tocar una fase no desplaza el azar de las otras (RNF-DET-001).
  const rng = makeRng(seedStr + SUFIJOS_DE_FASE.nucleos);
  const settlements = [];
  const lakes = geo.lakes.filter((l) => polygonArea(l.pts) > 40000); // ignora estanques

  const f = Math.max(0.005, Math.min(1, radius / 20000));
  const SEP = { ciudad: 2500 * f, pueblo: 2000 * f, aldea: 1500 * f, granja: 1200 * f };
  const firmRing = Math.min(400, radius * 0.4);
  const [nCiudades, nPueblos, nAldeas, nGranjas] = countsForRadius(radius);

  // Anclajes válidos: dentro del radio y NUNCA en el mar (locales en muelles,
  // errores de máscara...).
  const usable = anchors.filter((a) => Math.hypot(a.x, a.y) < radius * 0.93 && !isSea(seaMask, a));
  const taken = new Set(); // anclajes consumidos por núcleos o servicios
  let candidatos = usable.slice();

  const count = (t) => settlements.filter((x) => x.type === t).length;
  const okTerrain = (p) => !inWater(p, lakes) && isFirmLand(p, seaMask, firmRing);

  // La ficha del lado real de un anclaje. Para los que vienen de Places viaja
  // además su identificador y el contenido refrescable, que es lo único suyo que se
  // puede guardar; la capa de ficción no depende de nada de eso.
  const fichaReal = (a) => ({
    name: a.name,
    kind: a.kind,
    osmId: a.osmId ?? null,
    ...(a.fuente === 'places' ? { placeId: a.placeId ?? null, refrescable: a.refrescable ?? null } : {}),
  });

  // El nombre pasa por el índice del mundo: hasta esta iteración ni los núcleos ni
  // las granjas comprobaban nada y salían mundos con dos «Casal da Colmea».
  const makeSettlement = (type, pos, anchor) => ({
    type,
    x: pos.x,
    y: pos.y,
    name: indice.fija(
      () => (type === 'granja' ? names.farmName(rng) : names.townName(rng)),
      (base, k) => names.variantName(base, k),
    ),
    anchor: anchor ? fichaReal(anchor) : null,
    services: [],
  });

  // Asigna a cada servicio un POI real libre y cercano, con separación mínima
  // entre elegidos (relajable) para que los marcadores no se solapen.
  const assignServices = (s) => {
    const kinds = serviceKinds(rng, s.type);
    const fpr = footprintRadius(s.type, radius);
    // Empate a distancia: lo rompe la clave estable de OSM y no el orden en que
    // llegaron los anclajes, que es lo que hacía la ordenación estable de
    // JavaScript cuando dos POIs caían exactamente a la misma distancia.
    const near = usable
      .filter((a) => !taken.has(a))
      .map((a) => ({ a, d: dist(a, s) }))
      .filter((x) => x.d <= fpr)
      .sort((x, y) => x.d - y.d || comparaClaveOsm(x.a.osmId, y.a.osmId));

    const pickSpaced = (minSep) => {
      const chosen = [];
      for (const c of near) {
        if (chosen.length >= kinds.length) break;
        if (chosen.every((o) => dist(o.a, c.a) >= minSep)) chosen.push(c);
      }
      return chosen;
    };
    let sel = [];
    for (const k of [0.18, 0.09, 0.045, 0]) {
      sel = pickSpaced(fpr * k);
      if (sel.length >= kinds.length) break;
    }

    s.services = kinds.slice(0, sel.length).map((kind, i) => {
      const a = sel[i].a;
      taken.add(a);
      const name = indice.fija(() => names.poiName(rng, kind), (base, k) => names.variantName(base, k));
      if (pool && a.osmId) pool.tomar(a.osmId, 'servicio', name);
      return {
        kind,
        label: POI_LABELS[kind],
        name,
        x: a.x,
        y: a.y,
        real: fichaReal(a),
      };
    });
    candidatos = candidatos.filter((a) => !taken.has(a));
  };

  const place = (type, pos, anchor) => {
    const s = makeSettlement(type, pos, anchor);
    if (anchor) {
      taken.add(anchor);
      if (pool && anchor.osmId) pool.tomar(anchor.osmId, 'nucleo', s.name);
    }
    settlements.push(s);
    assignServices(s);
    return s;
  };

  // Relleno aleatorio en tierra firme para garantizar el cupo; relaja la
  // separación si no cabe.
  const fillRandom = (type, target) => {
    let attempts = 0;
    let sep = SEP[type];
    while (count(type) < target && attempts < 900) {
      attempts++;
      if (attempts % 300 === 0) sep /= 2;
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius * 0.9;
      // A la rejilla de precisión, como todo punto en metros: este no viene del
      // proyector, así que si no se cuantiza aquí entra sin cuantizar al documento.
      const p = cuantizaPunto({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
      if (!farFromAll(p, settlements, sep)) continue;
      if (!okTerrain(p)) continue;
      place(type, p, null);
    }
  };

  // Ciudades: los clústeres de anclajes con más peso, bien separadas entre sí.
  const citySep = Math.max(SEP.ciudad, radius * 0.35);
  for (let i = 0; i < nCiudades && candidatos.length; i++) {
    let best = null, bestScore = -1;
    for (const a of candidatos) {
      if (i > 0 && !farFromAll(a, settlements.filter((x) => x.type === 'ciudad'), citySep)) continue;
      const sc = clusterScore(a, candidatos, 2000 * f);
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    if (!best) break;
    place('ciudad', best, best);
    candidatos = candidatos.filter((a) => dist(a, best) > 3000 * f);
  }
  fillRandom('ciudad', nCiudades);

  // Pueblos: siguientes clústeres.
  for (let i = 0; i < nPueblos && candidatos.length; i++) {
    let best = null, bestScore = -1;
    for (const a of candidatos) {
      if (!farFromAll(a, settlements, SEP.pueblo)) continue;
      const sc = clusterScore(a, candidatos, 1200 * f);
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    if (!best) break;
    place('pueblo', best, best);
    candidatos = candidatos.filter((a) => dist(a, best) > 1800 * f);
  }
  fillRandom('pueblo', nPueblos);

  // Aldeas: anclajes sueltos, preferimos emplazamientos (iglesias, miradores...).
  const aldeaCandidates = shuffle(rng, candidatos).sort((a, b) => (b.cat === 'emplazamiento') - (a.cat === 'emplazamiento'));
  for (const a of aldeaCandidates) {
    if (count('aldea') >= nAldeas) break;
    if (taken.has(a)) continue;
    if (!farFromAll(a, settlements, SEP.aldea)) continue;
    place('aldea', a, a);
  }
  fillRandom('aldea', nAldeas);

  // Granjas: ancladas a locales reales restantes; relleno en tierra firme si faltan.
  const farmCandidates = shuffle(rng, candidatos).sort((a, b) => (b.cat === 'local') - (a.cat === 'local'));
  for (const a of farmCandidates) {
    if (count('granja') >= nGranjas) break;
    if (taken.has(a)) continue;
    if (!farFromAll(a, settlements, SEP.granja)) continue;
    place('granja', a, a);
  }
  fillRandom('granja', nGranjas);

  return { settlements, freeAnchors: usable.filter((a) => !taken.has(a)) };
}
