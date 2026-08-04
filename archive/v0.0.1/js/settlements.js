// Generación de núcleos de población ficticios a partir de los anclajes reales (POIs).

import { dist, pointInPolygon, polygonBBox, polygonArea } from './geo.js';
import { isSea } from './seamask.js';
import { makeRng, randInt, shuffle } from './rng.js';
import { townName, farmName, poiName, POI_LABELS } from './names.js';

// Servicios que ofrece cada tipo de núcleo (fixed siempre; extra según tamaño).
const SERVICES = {
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

// Tierra firme: ni el punto ni un anillo a su alrededor tocan el mar.
// Descarta tanto el mar abierto como los islotes demasiado pequeños.
function isFirmLand(p, seaMask, ring = 400) {
  if (isSea(seaMask, p)) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (isSea(seaMask, { x: p.x + Math.cos(a) * ring, y: p.y + Math.sin(a) * ring })) return false;
  }
  return true;
}

function inWater(p, lakes) {
  for (const lake of lakes) {
    const bb = polygonBBox(lake);
    if (p.x < bb.minX || p.x > bb.maxX || p.y < bb.minY || p.y > bb.maxY) continue;
    if (pointInPolygon(p, lake)) return true;
  }
  return false;
}

function makeSettlement(rng, type, pos, anchor) {
  return {
    type,
    x: pos.x,
    y: pos.y,
    name: type === 'granja' ? farmName(rng) : townName(rng),
    anchor: anchor ? { name: anchor.name, kind: anchor.kind } : null,
    services: [],
  };
}

// Radio urbano de cada tipo de núcleo: los servicios se anclan a POIs reales
// dentro de esta distancia. Escala suavemente con el tamaño del mundo.
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
 * anchors: POIs reales proyectados a metros.
 * geo: features geográficas parseadas (para evitar agua).
 * radius: radio del mundo en metros.
 *
 * Cada servicio (posada, taberna, botica...) queda anclado a un POI real
 * concreto cerca del núcleo, con sus coordenadas y el nombre del lugar real.
 */
export function generateSettlements(anchors, geo, radius, seedStr, seaMask = null) {
  const rng = makeRng(seedStr);
  const settlements = [];
  const lakes = geo.lakes.filter((l) => polygonArea(l) > 40000); // ignora estanques

  // Separaciones pensadas para 20 km, escaladas al radio (con suelo).
  const f = Math.max(0.005, Math.min(1, radius / 20000));
  const SEP = { ciudad: 2500 * f, pueblo: 2000 * f, aldea: 1500 * f, granja: 1200 * f };
  const firmRing = Math.min(400, radius * 0.4);
  const [nCiudades, nPueblos, nAldeas, nGranjas] = countsForRadius(radius);

  // Anclajes válidos: dentro del radio y NUNCA en el mar (un anclaje puede caer
  // en agua por errores de máscara o por locales flotantes/en muelles).
  const usable = anchors.filter((a) => Math.hypot(a.x, a.y) < radius * 0.93 && !isSea(seaMask, a));
  const taken = new Set(); // anclajes ya consumidos (núcleos o servicios)
  let pool = usable.slice();

  const count = (t) => settlements.filter((x) => x.type === t).length;
  const okTerrain = (p) => !inWater(p, lakes) && isFirmLand(p, seaMask, firmRing);

  // Asigna a cada servicio del núcleo un POI real libre y cercano.
  // Entre los candidatos se exige una separación mínima (proporcional al radio
  // urbano) para que los marcadores no se solapen; si no hay POIs suficientes
  // tan espaciados, se relaja progresivamente antes de renunciar a servicios.
  const assignServices = (s) => {
    const kinds = serviceKinds(rng, s.type);
    const fpr = footprintRadius(s.type, radius);
    const near = usable
      .filter((a) => !taken.has(a))
      .map((a) => ({ a, d: dist(a, s) }))
      .filter((x) => x.d <= fpr)
      .sort((x, y) => x.d - y.d);

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
      return {
        kind,
        label: POI_LABELS[kind],
        name: poiName(rng, kind),
        x: a.x,
        y: a.y,
        real: { name: a.name, kind: a.kind },
      };
    });
    pool = pool.filter((a) => !taken.has(a));
  };

  const place = (type, pos, anchor) => {
    const s = makeSettlement(rng, type, pos, anchor);
    if (anchor) taken.add(anchor);
    settlements.push(s);
    assignServices(s);
    return s;
  };

  // Relleno aleatorio en tierra firme para garantizar el cupo cuando los
  // anclajes no dan; relaja la separación si no cabe.
  const fillRandom = (type, target) => {
    let attempts = 0;
    let sep = SEP[type];
    while (count(type) < target && attempts < 900) {
      attempts++;
      if (attempts % 300 === 0) sep /= 2;
      const ang = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius * 0.9;
      const p = { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
      if (!farFromAll(p, settlements, sep)) continue;
      if (!okTerrain(p)) continue;
      place(type, p, null);
    }
  };

  // Ciudades: los clústeres de anclajes con más peso, bien separadas entre sí.
  const citySep = Math.max(SEP.ciudad, radius * 0.35);
  for (let i = 0; i < nCiudades && pool.length; i++) {
    let best = null, bestScore = -1;
    for (const a of pool) {
      if (i > 0 && !farFromAll(a, settlements.filter((x) => x.type === 'ciudad'), citySep)) continue;
      const sc = clusterScore(a, pool, 2000 * f);
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    if (!best) break;
    place('ciudad', best, best);
    pool = pool.filter((a) => dist(a, best) > 3000 * f);
  }
  fillRandom('ciudad', nCiudades);

  // Pueblos: siguientes clústeres.
  for (let i = 0; i < nPueblos && pool.length; i++) {
    let best = null, bestScore = -1;
    for (const a of pool) {
      if (!farFromAll(a, settlements, SEP.pueblo)) continue;
      const sc = clusterScore(a, pool, 1200 * f);
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    if (!best) break;
    place('pueblo', best, best);
    pool = pool.filter((a) => dist(a, best) > 1800 * f);
  }
  fillRandom('pueblo', nPueblos);

  // Aldeas: anclajes sueltos, preferimos emplazamientos (iglesias, miradores...).
  const aldeaCandidates = shuffle(rng, pool).sort((a, b) => (b.cat === 'emplazamiento') - (a.cat === 'emplazamiento'));
  for (const a of aldeaCandidates) {
    if (count('aldea') >= nAldeas) break;
    if (taken.has(a)) continue;
    if (!farFromAll(a, settlements, SEP.aldea)) continue;
    place('aldea', a, a);
  }
  fillRandom('aldea', nAldeas);

  // Granjas: ancladas a locales reales restantes; relleno en tierra firme si faltan.
  const farmCandidates = shuffle(rng, pool).sort((a, b) => (b.cat === 'local') - (a.cat === 'local'));
  for (const a of farmCandidates) {
    if (count('granja') >= nGranjas) break;
    if (taken.has(a)) continue;
    if (!farFromAll(a, settlements, SEP.granja)) continue;
    place('granja', a, a);
  }
  fillRandom('granja', nGranjas);

  return settlements;
}
