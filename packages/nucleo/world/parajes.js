// Parajes: hitos no habitados para quests (game-design/parajes.md).
//
// Principios: el tipo fantástico está DESACOPLADO del anclaje real (un
// chiringuito puede ser una ruina); el anclaje solo aporta coordenadas y tierra
// firme. Asignación de tipo con sesgo suave, escenas como etiquetas con pesos,
// selección puntuando cerca-de-ruta y lejos-de-núcleos, y cruces/puentes del
// grafo viario como colchón garantizado en zonas pobres de datos.

import { dist, segIntersect, polygonBBox } from '../core/geo.js';
import { isSea } from './seamask.js';
import { makeRng, pick, shuffle } from '../core/rng.js';
import { SUFIJOS_DE_FASE } from '../core/semilla.js';
import { footprintRadius } from './settlements.js';
import { puntuaCandidatos, recortaPorTopes } from './anclajes.js';
import { crearIndiceDeNombres } from '../names/index.js';

// Tipos cuyo emplazamiento sale de un anclaje real; cruce y puente se derivan del grafo.
export const ANCHORED_TYPES = ['ruina', 'piedra', 'ermita', 'fuente', 'atalaya', 'monasterio'];

export const PARAJE_INFO = {
  ruina: { label: 'Ruina', scenes: { guarida: 0.4, emboscada: 0.2, misterio: 0.2, refugio: 0.2 } },
  piedra: { label: 'Piedra antigua', scenes: { ritual: 0.4, misterio: 0.4, revelación: 0.2 } },
  ermita: { label: 'Ermita', scenes: { refugio: 0.4, encuentro: 0.4, ritual: 0.2 } },
  fuente: { label: 'Fuente', scenes: { encuentro: 0.5, refugio: 0.3, misterio: 0.2 } },
  atalaya: { label: 'Atalaya', scenes: { revelación: 0.5, vigilancia: 0.3, encuentro: 0.2 } },
  cruce: { label: 'Cruce de caminos', scenes: { emboscada: 0.35, encuentro: 0.25, vigilancia: 0.2, peaje: 0.2 } },
  puente: { label: 'Puente', scenes: { peaje: 0.25, guarida: 0.2, emboscada: 0.2, encuentro: 0.2, duelo: 0.15 } },
  monasterio: { label: 'Monasterio', scenes: { refugio: 0.4, saber: 0.4, ritual: 0.2 } },
};

// Sesgo suave: si el lugar real "pega" con un tipo, ese tipo gana peso en el
// sorteo (probabilidad BIAS_P); el resto de veces manda el azar con diversidad.
const BIAS = {
  castillo: 'ruina', ruinas: 'ruina', monumento: 'ruina',
  'piedra antigua': 'piedra',
  iglesia: 'ermita', crucero: 'ermita',
  fuente: 'fuente', manantial: 'fuente',
  torre: 'atalaya', faro: 'atalaya', mirador: 'atalaya',
  monasterio: 'monasterio',
};
const BIAS_P = 0.65;

// Cupo por radio (interpolación lineal, saturado en 8: más parajes no añaden
// beats a una aventura de 3 h).
const COUNT_TIERS = [[250, 1], [500, 2], [1000, 4], [2000, 7], [5000, 8]];

export function parajeCountForRadius(r) {
  if (r <= COUNT_TIERS[0][0]) return COUNT_TIERS[0][1];
  const last = COUNT_TIERS[COUNT_TIERS.length - 1];
  if (r >= last[0]) return last[1];
  for (let i = 0; i < COUNT_TIERS.length - 1; i++) {
    const [r0, c0] = COUNT_TIERS[i];
    const [r1, c1] = COUNT_TIERS[i + 1];
    if (r >= r0 && r < r1) return Math.round(c0 + ((r - r0) / (r1 - r0)) * (c1 - c0));
  }
  return last[1];
}

// --- candidatos derivados del grafo viario (existen en cualquier mundo con carreteras) ---

const key = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;

// Cruces: puntos compartidos por 2+ rutas nombradas. Dentro del tramo común de
// cada par se elige el punto más alejado de todo núcleo ("en despoblado").
function crossingCandidates(routes, settlements, radius) {
  const real = routes.filter((r) => !r.fallback);
  const byKey = new Map();
  real.forEach((r, ri) => {
    // se excluyen los extremos: son las posiciones de los glifos de los núcleos
    for (const p of r.pts.slice(1, -1)) {
      const k = key(p);
      if (!byKey.has(k)) byKey.set(k, { p, routes: new Set() });
      byKey.get(k).routes.add(ri);
    }
  });

  const minSettDist = (p) => Math.min(Infinity, ...settlements.map((s) => dist(p, s)));
  const byPair = new Map();
  // Por clave y no por orden de inserción: de este recorrido sale qué punto
  // representa a cada par de calzadas, que es una decisión de generación.
  const puntos = [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v);
  for (const { p, routes: rs } of puntos) {
    if (rs.size < 2) continue;
    const ids = [...rs].sort((a, b) => a - b);
    for (let i = 0; i < ids.length - 1; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const pk = `${ids[i]}-${ids[j]}`;
        const d = minSettDist(p);
        const cur = byPair.get(pk);
        if (!cur || d > cur.d) byPair.set(pk, { p, d });
      }
    }
  }

  const sep = Math.max(150, radius * 0.1);
  const out = [];
  for (const { p, d } of [...byPair.values()].sort((a, b) => b.d - a.d || (key(a.p) < key(b.p) ? -1 : 1))) {
    if (d < 80) continue; // pegado a un núcleo: no es un cruce "en despoblado"
    if (out.every((c) => dist(c, p) >= sep)) out.push({ x: p.x, y: p.y, type: 'cruce' });
  }
  return out;
}

// Puentes: segmentos de ruta que cruzan un río.
function bridgeCandidates(routes, rivers, settlements, radius) {
  const sep = Math.max(150, radius * 0.1);
  const out = [];
  for (const r of routes) {
    if (r.fallback) continue;
    const pts = r.pts.slice(1, -1); // sin los conectores a los glifos
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const bb = { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y) };
      for (const { pts: cauce } of rivers) {
        const rb = polygonBBox(cauce);
        if (rb.minX > bb.maxX || rb.maxX < bb.minX || rb.minY > bb.maxY || rb.maxY < bb.minY) continue;
        for (let j = 0; j < cauce.length - 1; j++) {
          const hit = segIntersect(a, b, cauce[j], cauce[j + 1]);
          if (!hit) continue;
          if (settlements.some((s) => dist(hit, s) < 80)) continue;
          if (out.every((c) => dist(c, hit) >= sep)) out.push({ x: hit.x, y: hit.y, type: 'puente' });
        }
      }
    }
  }
  return out;
}

/**
 * freeAnchors: POIs reales no consumidos por núcleos/servicios.
 * settlements, routes, geo, radius, seaMask: mundo ya generado.
 * names: paquete de nombres del idioma del mundo.
 * indice: índice de nombres del mundo, compartido con las demás familias.
 * pool: el registro de uso único de la celda, si quien genera lo lleva; los
 *   parajes anclados avisan de lo que consumen para que conste quién se lo llevó.
 * reparto: dónde anotar que esta fase tuvo que saltarse los topes de diversidad,
 *   si quien genera lo lleva. Lo declara el mundo y no el pool, porque desde
 *   SPEC-005-iter-1 el pool no aplica topes y no puede declarar algo que no es suyo.
 */
export function generateParajes(freeAnchors, settlements, routes, geo, radius, seedStr, seaMask, names, indice = crearIndiceDeNombres(), pool = null, reparto = null) {
  const rng = makeRng(seedStr + SUFIJOS_DE_FASE.parajes);
  const target = parajeCountForRadius(radius);

  // Elegibilidad de anclajes: en tierra y dentro del mundo. Estar dentro del radio
  // urbano de un núcleo ya NO excluye: `parajes.md` dice «se penalizan», y como
  // filtro duro dejaba el pool vacío en una celda pequeña y urbana. La penalización
  // vive en la puntuación, que ordena sin excluir.
  const outsideTowns = (p) => settlements.every((s) => dist(p, s) > footprintRadius(s.type, radius) * 1.05);
  const eligible = freeAnchors.filter((a) => Math.hypot(a.x, a.y) < radius * 0.95 && !isSea(seaMask, a));

  // Etapa 2 del pool: cerca de ruta suma, dentro del radio urbano resta y el nombre
  // propio desempata. No consume azar de esta fase — el desempate lo trae cada
  // anclaje de la suya —, así que puntuar dos veces da el mismo orden.
  const puntuados = puntuaCandidatos(eligible, { settlements, routes, radius });

  // Etapa 3: el tope de diversidad, sobre los candidatos que se le ofrecen a esta
  // fase y solo si sobran. Aquí es donde tiene sentido —hay un cupo con el que
  // compararse—; en la admisión del pool recortaba materia prima del mundo entero.
  const recorte = recortaPorTopes(puntuados, target);
  const scored = recorte.candidatos;
  if (reparto && recorte.relajado) {
    reparto.relajaciones.push({
      fase: 'parajes',
      cupo: target,
      candidatos: puntuados.length,
      recuperados: recorte.recuperados,
      motivo: 'respetar los topes de diversidad dejaba menos candidatos que el cupo de la fase',
    });
  }

  // Candidatos del grafo (colchón garantizado sin Overpass).
  const graphCands = shuffle(rng, [
    ...crossingCandidates(routes, settlements, radius),
    ...bridgeCandidates(routes, geo.rivers ?? [], settlements, radius),
  ]).filter((c) => outsideTowns(c) && !isSea(seaMask, c));

  // Reparto: se reservan hasta 2 huecos para cruces/puentes; el resto, anclajes.
  // Si faltan anclajes, el grafo rellena; si falta todo, se acepta el déficit.
  const graphFloor = Math.min(2, graphCands.length, target);
  const sep = Math.max(120, radius * 0.1);
  const placed = [];

  const tryPlace = (cand, type, real, origin) => {
    if (!placed.every((p) => dist(p, cand) >= sep)) return false;
    placed.push({ type, x: cand.x, y: cand.y, real, origin });
    // El anclaje se marca como consumido solo cuando el paraje se coloca de verdad:
    // un candidato que no cabe no gasta nada. Los cruces y puentes del grafo no
    // pasan por aquí porque no traen anclaje ninguno.
    if (pool && origin === 'anclaje' && cand.osmId) pool.tomar(cand.osmId, 'paraje');
    return true;
  };

  // La ficha del lado real. Para los anclajes de Places viaja además su
  // identificador y el contenido refrescable: es lo único suyo que se puede
  // guardar, y la capa de ficción no depende de ello.
  const fichaReal = (a) => ({
    name: a.name,
    kind: a.kind,
    osmId: a.osmId ?? null,
    ...(a.fuente === 'places' ? { placeId: a.placeId ?? null, refrescable: a.refrescable ?? null } : {}),
  });

  // 1) anclajes hasta (target - graphFloor), con tipo por sesgo suave + diversidad
  let cycle = shuffle(rng, ANCHORED_TYPES);
  const nextType = (biasType) => {
    if (biasType && rng() < BIAS_P) {
      cycle = cycle.filter((t) => t !== biasType);
      if (!cycle.length) cycle = shuffle(rng, ANCHORED_TYPES.filter((t) => t !== biasType));
      return biasType;
    }
    if (!cycle.length) cycle = shuffle(rng, ANCHORED_TYPES);
    return cycle.shift();
  };
  // Los anclajes ya gastados por esta fase, para que la tercera vuelta no vuelva a
  // ofrecer uno colocado: repetirlo sería consumir dos veces el mismo lugar real.
  const usados = new Set();
  const marca = (a) => usados.add(a.osmId ?? `${a.x},${a.y}`);
  const gastado = (a) => usados.has(a.osmId ?? `${a.x},${a.y}`);

  for (const { a } of scored) {
    if (placed.length >= target - graphFloor) break;
    const type = nextType(BIAS[a.kind]);
    if (tryPlace(a, type, fichaReal(a), 'anclaje')) marca(a);
  }

  // 2) cruces/puentes del grafo hasta completar el cupo
  for (const c of graphCands) {
    if (placed.length >= target) break;
    tryPlace(c, c.type, null, 'grafo');
  }

  // 3) si el grafo no dio y quedan anclajes, seguir con anclajes
  for (const { a } of scored) {
    if (placed.length >= target) break;
    if (gastado(a)) continue;
    if (tryPlace(a, nextType(BIAS[a.kind]), fichaReal(a), 'anclaje')) marca(a);
  }

  // nombres únicos y ficha final; el conjunto de usados es el del mundo entero y
  // no uno local de la fase, que dejaba que un paraje se llamase como un núcleo
  return placed.map((p) => {
    const name = indice.fija(() => names.parajeName(rng, p.type), (base, k) => names.variantName(base, k), 8);
    const info = PARAJE_INFO[p.type];
    return { ...p, name, label: info.label, scenes: info.scenes };
  });
}
