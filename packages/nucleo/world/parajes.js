// Parajes: hitos no habitados para quests (game-design/parajes.md).
//
// Principios: el tipo fantástico está DESACOPLADO del anclaje real (un
// chiringuito puede ser una ruina); el anclaje solo aporta coordenadas y tierra
// firme. Desde el desempate del 5-ago-2026 el orden está invertido: **primero los
// tipos que cubren el vocabulario de escenas y después el anclaje**, con sesgo
// suave y sacrificando la afinidad —nunca la cobertura— cuando no hay afín.
// Cruces y puentes del grafo viario participan en la cobertura en igualdad de
// condiciones, y son el único colchón de una celda sin anclajes.

import { dist, segIntersect, polygonBBox } from '../core/geo.js';
import { isSea } from './seamask.js';
import { makeRng, pick, shuffle } from '../core/rng.js';
import { SUFIJOS_DE_FASE } from '../core/semilla.js';
import { footprintRadius } from './settlements.js';
import { puntuaCandidatos, recortaPorTopes } from './anclajes.js';
import { escenasQueCubre, normalizaVocabulario, sueloDeVocabulario } from './escenas.js';
import { crearIndiceDeNombres } from '../names/index.js';

// Tipos cuyo emplazamiento sale de un anclaje real; cruce y puente se derivan del grafo.
export const ANCHORED_TYPES = ['ruina', 'piedra', 'ermita', 'fuente', 'atalaya', 'monasterio'];

/** Los tipos cuya posición la da el grafo viario: su tipo viene dado por su origen. */
export const GRAPH_TYPES = ['cruce', 'puente'];

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
//
// Estar «en despoblado» dejó de ser un filtro duro y pasó a ser una preferencia,
// por el mismo motivo por el que ya lo era para los anclajes: `parajes.md` dice
// «se penalizan», y como corte dejaba sin ningún candidato a las celdas pequeñas
// —medido en `suelo-250m`, donde los dos únicos cruces caen dentro de la huella
// de un núcleo— que son justo las que dependen del colchón del grafo. Lo único
// que sigue siendo corte es estar encima del glifo de un núcleo.

const key = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;

/** Pegado a un núcleo: ni es un hito ni se distingue del propio pueblo. */
const PEGADO_A_NUCLEO_M = 40;

/** A partir de aquí un candidato del grafo se considera en despoblado y se prefiere. */
const EN_DESPOBLADO_M = 80;

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
    if (d < PEGADO_A_NUCLEO_M) continue; // encima del glifo: no es un cruce, es el pueblo
    if (out.every((c) => dist(c, p) >= sep)) {
      out.push({ x: p.x, y: p.y, type: 'cruce', enDespoblado: d >= EN_DESPOBLADO_M });
    }
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
          const dNucleo = Math.min(Infinity, ...settlements.map((s) => dist(hit, s)));
          if (dNucleo < PEGADO_A_NUCLEO_M) continue;
          if (out.every((c) => dist(c, hit) >= sep)) {
            out.push({ x: hit.x, y: hit.y, type: 'puente', enDespoblado: dNucleo >= EN_DESPOBLADO_M });
          }
        }
      }
    }
  }
  return out;
}

/**
 * El orden de tipos de la taxonomía, estable y sin depender de ningún `Object.keys`
 * de inserción: de esta lista sale a qué tipos se les pregunta qué cubren.
 */
const TIPOS_EN_ORDEN = [...ANCHORED_TYPES, ...GRAPH_TYPES].sort();

/**
 * Las escenas del vocabulario que ningún tipo de la taxonomía sabe decir.
 *
 * No es un fallo: es un hueco de taxonomía que se declara en la ficha de la celda
 * y que el casting consume para no ofrecer plantillas imposibles. La generación
 * continúa con el resto del vocabulario.
 */
function huecosDeTaxonomia(vocabulario) {
  return vocabulario
    .filter(({ escena, pesoMinimo }) => !TIPOS_EN_ORDEN.some((t) => (PARAJE_INFO[t].scenes[escena] ?? 0) >= pesoMinimo))
    .map(({ escena }) => escena);
}

/**
 * La secuencia de tipos que se va a colocar, **antes de mirar ningún anclaje real**.
 *
 * Gana el tipo que cubre más escenas todavía pendientes; los empates los rompe el
 * azar de la fase y no el orden de la tabla. Cubierto el vocabulario, los huecos
 * que quedan se reparten buscando diversidad, sin repetir ninguno mientras queden
 * tipos sin usar. No consulta el pool: por eso permutarlo no cambia la secuencia.
 *
 * `disponibles` es cuántos huecos puede llenar cada origen —anclajes reales, cruces
 * y puentes—, que es lo único del mundo que entra aquí.
 */
function secuenciaDeTipos(rng, cupo, vocabulario, disponibles) {
  const quedan = { ...disponibles };
  const usados = new Set();
  const secuencia = [];
  const hueco = (tipo) => (GRAPH_TYPES.includes(tipo) ? tipo : 'anclaje');

  // Las escenas que ningún tipo sabe decir se apartan antes de empezar: dejarlas
  // dentro haría que todos los tipos empataran a cero y el reparto se decidiera por
  // azar puro en vez de por cobertura. Se declaran como hueco de taxonomía.
  const sinTipo = new Set(huecosDeTaxonomia(vocabulario));
  let porCubrir = vocabulario.filter(({ escena }) => !sinTipo.has(escena));

  for (let i = 0; i < cupo; i++) {
    const candidatos = TIPOS_EN_ORDEN.filter((t) => quedan[hueco(t)] > 0);
    if (!candidatos.length) break;

    const cubre = new Map(candidatos.map((t) => [t, escenasQueCubre(PARAJE_INFO[t].scenes, porCubrir).length]));
    const mejor = Math.max(...candidatos.map((t) => cubre.get(t)));

    let elegibles;
    if (mejor > 0) {
      elegibles = candidatos.filter((t) => cubre.get(t) === mejor);
    } else {
      // Vocabulario ya cubierto: los huecos restantes se reparten por diversidad.
      const sinUsar = candidatos.filter((t) => !usados.has(t));
      elegibles = sinUsar.length ? sinUsar : candidatos;
    }

    const tipo = pick(rng, elegibles);
    const cubiertas = new Set(escenasQueCubre(PARAJE_INFO[tipo].scenes, porCubrir));
    porCubrir = porCubrir.filter(({ escena }) => !cubiertas.has(escena));
    usados.add(tipo);
    quedan[hueco(tipo)] -= 1;
    secuencia.push(tipo);
  }

  return secuencia;
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
 * opciones: la frontera de inyección de SPEC-006.
 *   `vocabulario` las escenas que el catálogo le pide a un paraje, con su peso
 *     mínimo. **Llega inyectado y no importado**: esta fase no depende del catálogo.
 *   `cupo` la ficha de cupo ya resuelta —`{ cupo, suelo, techo }`—, calculada una
 *     vez por celda y congelada con ella. Sin ella se deriva del vocabulario
 *     recibido y del techo por ritmo del radio, que es la misma cuenta con el
 *     tramo de referencia.
 *   `ficha` objeto donde anotar suelo, techo, cupo y déficit de cobertura, si quien
 *     genera lo lleva. Es dato interno: no sale a ninguna pantalla.
 */
export function generateParajes(freeAnchors, settlements, routes, geo, radius, seedStr, seaMask, names, indice = crearIndiceDeNombres(), pool = null, reparto = null, opciones = {}) {
  const rng = makeRng(seedStr + SUFIJOS_DE_FASE.parajes);

  // El vocabulario decide el suelo y el techo por ritmo decide el máximo; cuando
  // chocan gana el suelo, porque un techo que se come el suelo devuelve el problema
  // que el suelo vino a resolver (`parajes.md`, 5-ago-2026).
  const vocabulario = normalizaVocabulario(opciones.cupo?.vocabulario ?? opciones.vocabulario);
  const techo = opciones.cupo?.techo ?? parajeCountForRadius(radius);
  const suelo = opciones.cupo?.suelo ?? sueloDeVocabulario(vocabulario);
  const target = opciones.cupo?.cupo ?? Math.max(suelo, techo);

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

  // Candidatos del grafo. Ya no son una cuota fija de dos huecos: participan en la
  // cobertura en igualdad de condiciones, y en una celda sin anclajes son lo único
  // que hay. El mar sí excluye —no hay puente al que se pueda ir andando—; estar
  // dentro de la huella de un núcleo solo posterga.
  const delGrafo = shuffle(rng, [
    ...crossingCandidates(routes, settlements, radius),
    ...bridgeCandidates(routes, geo.rivers ?? [], settlements, radius),
  ]).filter((c) => !isSea(seaMask, c));
  const graphCands = [
    ...delGrafo.filter((c) => c.enDespoblado && outsideTowns(c)),
    ...delGrafo.filter((c) => !(c.enDespoblado && outsideTowns(c))),
  ];

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

  // 1) Los TIPOS, antes de mirar ningún anclaje. Es la inversión del desempate del
  // 5-ago-2026: la cobertura manda sobre la afinidad.
  const secuencia = secuenciaDeTipos(rng, target, vocabulario, {
    anclaje: scored.length,
    cruce: graphCands.filter((c) => c.type === 'cruce').length,
    puente: graphCands.filter((c) => c.type === 'puente').length,
  });

  // 2) Y ahora el anclaje de cada uno. Los anclajes ya gastados por esta fase se
  // marcan para no ofrecer dos veces el mismo lugar real.
  const usados = new Set();
  const clave = (a) => a.osmId ?? `${a.x},${a.y}`;
  const disponibles = () => scored.filter(({ a }) => !usados.has(clave(a)));
  const delGrafoLibres = new Set(graphCands);

  const colocaEnGrafo = (tipo) => {
    for (const c of graphCands) {
      if (!delGrafoLibres.has(c) || c.type !== tipo) continue;
      delGrafoLibres.delete(c);
      if (tryPlace(c, tipo, null, 'grafo')) return true;
    }
    return false;
  };

  // Sesgo suave: si hay algún anclaje real que «pega» con el tipo, gana peso en el
  // sorteo (probabilidad BIAS_P) sin ganarlo siempre. Si no lo hay, se le da el
  // mejor puntuado de los que quedan y **el tipo no cambia**: que una atalaya sea
  // un bar es mejor que quedarse sin ningún sitio desde el que vigilar.
  const colocaEnAnclaje = (tipo) => {
    const libres = disponibles();
    if (!libres.length) return false;
    const afines = libres.filter(({ a }) => BIAS[a.kind] === tipo);
    const orden = afines.length && rng() < BIAS_P
      ? [...afines, ...libres.filter(({ a }) => BIAS[a.kind] !== tipo)]
      : libres;
    for (const { a } of orden) {
      usados.add(clave(a));
      if (tryPlace(a, tipo, fichaReal(a), 'anclaje')) return true;
    }
    return false;
  };

  for (const tipo of secuencia) {
    if (GRAPH_TYPES.includes(tipo)) colocaEnGrafo(tipo);
    else colocaEnAnclaje(tipo);
  }

  // nombres únicos y ficha final; el conjunto de usados es el del mundo entero y
  // no uno local de la fase, que dejaba que un paraje se llamase como un núcleo
  const parajes = placed.map((p) => {
    const name = indice.fija(() => names.parajeName(rng, p.type), (base, k) => names.variantName(base, k), 8);
    const info = PARAJE_INFO[p.type];
    return { ...p, name, label: info.label, scenes: info.scenes };
  });

  // 3) La ficha de cobertura de la celda: los tres números que la produjeron y lo
  // que quedó sin cubrir. Es dato interno que consume el casting para no ofrecer
  // plantillas imposibles, y no sale a ninguna pantalla.
  if (opciones.ficha) {
    const cubiertas = new Set(
      parajes.flatMap((p) => escenasQueCubre(p.scenes, vocabulario)),
    );
    Object.assign(opciones.ficha, {
      suelo,
      techo,
      cupo: target,
      colocados: parajes.length,
      escenasPedidas: vocabulario.map((e) => e.escena),
      escenasCubiertas: [...cubiertas].sort(),
      deficit: vocabulario.map((e) => e.escena).filter((e) => !cubiertas.has(e)),
      huecosDeTaxonomia: huecosDeTaxonomia(vocabulario),
    });
  }

  return parajes;
}
