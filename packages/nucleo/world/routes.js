// Red vertebral: rutas reales entre núcleos sobre el grafo viario OSM.
// Camino más corto entre asentamientos + árbol de expansión mínima; cada ruta
// recibe un nombre de fantasía del paquete de idioma del mundo.

import { dist } from '../core/geo.js';
import { makeRng } from '../core/rng.js';
import { crearIndiceDeNombres } from '../names/index.js';

// Orden estable de los nodos del grafo: los ids de OSM por número y las claves de
// coordenada por texto. Recorrer las claves de un Map en orden de inserción dejaba
// que el orden de llegada de los ways decidiera los empates de distancia.
function comparaNodo(a, b) {
  const na = typeof a === 'number', nb = typeof b === 'number';
  if (na !== nb) return na ? -1 : 1;
  if (na) return a - b;
  return a < b ? -1 : a > b ? 1 : 0;
}

class MinHeap {
  constructor() { this.a = []; }
  push(d, id) {
    const a = this.a;
    a.push([d, id]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

function dijkstra(adj, src) {
  const d = new Map([[src, 0]]);
  const prev = new Map();
  const heap = new MinHeap();
  heap.push(0, src);
  while (heap.size) {
    const [du, u] = heap.pop();
    if (du > (d.get(u) ?? Infinity)) continue;
    for (const [v, w] of adj.get(u) ?? []) {
      const nd = du + w;
      if (nd < (d.get(v) ?? Infinity)) {
        d.set(v, nd);
        prev.set(v, u);
        heap.push(nd, v);
      }
    }
  }
  return { dist: d, prev };
}

function reconstruct(prev, src, dst) {
  const path = [dst];
  let cur = dst;
  while (cur !== src) {
    cur = prev.get(cur);
    if (cur == null) return null;
    path.push(cur);
  }
  return path.reverse();
}

// Grafo viario compartido por el trazado de calzadas y por el enlace de parajes:
// nodos por id OSM (o por coordenada si el way no trae ids).
function buildGraph(roads) {
  const coord = new Map();
  const adj = new Map();
  const addAdj = (a, b, w) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push([b, w]);
  };
  for (const r of roads ?? []) {
    const ids = r.nodes ?? r.pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`);
    for (let i = 0; i < ids.length; i++) if (!coord.has(ids[i])) coord.set(ids[i], r.pts[i]);
    for (let i = 0; i < ids.length - 1; i++) {
      const w = dist(r.pts[i], r.pts[i + 1]);
      if (w <= 0) continue;
      addAdj(ids[i], ids[i + 1], w);
      addAdj(ids[i + 1], ids[i], w);
    }
  }
  const nodeIds = [...coord.keys()].sort(comparaNodo);
  coserHuecos(coord, adj, addAdj, nodeIds);
  return { coord, adj, nodeIds };
}

// Distancia máxima que se considera "hueco en los datos" y no separación real.
const COSER_MAX = 180;

/**
 * Cose los trozos sueltos del grafo viario.
 *
 * El callejero de OSM llega troceado: en un mundo real medido salían 109 componentes,
 * muchas a 9-50 m unas de otras y la red entera del norte a 157 m del resto. No son
 * carreteras distintas — es que a los ways les faltan nodos compartidos, o el corte del
 * bounding box parte la conexión. Sin coser, el trazado se veía obligado a unir esos
 * núcleos con rectas por el monte.
 *
 * Se unen por orden de menor a mayor hueco (Kruskal), así que dos trozos se cosen por su
 * punto más próximo y nunca se crean atajos largos. Por encima de COSER_MAX se asume que
 * la separación es de verdad y se deja como está.
 */
function coserHuecos(coord, adj, addAdj, nodeIds) {
  const padre = new Map(nodeIds.map((id) => [id, id]));
  const find = (a) => {
    while (padre.get(a) !== a) { padre.set(a, padre.get(padre.get(a))); a = padre.get(a); }
    return a;
  };
  const une = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    padre.set(ra, rb);
    return true;
  };
  for (const [u, vs] of adj) for (const [v] of vs) une(u, v);

  // rejilla del tamaño del hueco máximo: solo se comparan nodos de celdas vecinas
  const grid = new Map();
  for (const id of nodeIds) {
    const p = coord.get(id);
    const k = `${Math.floor(p.x / COSER_MAX)},${Math.floor(p.y / COSER_MAX)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(id);
  }

  const pares = [];
  for (const id of nodeIds) {
    const p = coord.get(id);
    const ci = Math.floor(p.x / COSER_MAX), cj = Math.floor(p.y / COSER_MAX);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (const otro of grid.get(`${ci + di},${cj + dj}`) ?? []) {
          if (otro <= id || find(id) === find(otro)) continue;
          const d = dist(p, coord.get(otro));
          if (d <= COSER_MAX) pares.push([d, id, otro]);
        }
      }
    }
  }
  pares.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1) || (a[2] < b[2] ? -1 : 1));

  let cosidos = 0;
  for (const [d, a, b] of pares) {
    if (!une(a, b)) continue;
    addAdj(a, b, d);
    addAdj(b, a, d);
    cosidos++;
  }
  return cosidos;
}

// Nodo viario más cercano a un punto, con tope: lo que está demasiado lejos de toda
// carretera no se engancha por un rodeo absurdo, se resuelve con una recta.
function snapTo(nodeIds, coord, p, max) {
  let best = null, bd = Infinity;
  for (const id of nodeIds) {
    const d = dist(coord.get(id), p);
    // el empate a distancia lo rompe el propio nodo, no el orden de la lista
    if (d < bd || (d === bd && comparaNodo(id, best) < 0)) { bd = d; best = id; }
  }
  return bd <= max ? best : null;
}

const SNAP_MAX = 2000;

// Componentes conexas del grafo viario, de mayor a menor. La mayor es "la red": si un
// núcleo cae sobre un trozo de carretera suelto, estar pegado al asfalto no le sirve de
// nada, porque desde ahí no se llega a ninguna parte.
function componentes(adj, nodeIds) {
  const de = new Map();
  const tam = [];
  for (const id of nodeIds) {
    if (de.has(id)) continue;
    const c = tam.length;
    const pila = [id];
    de.set(id, c);
    let n = 0;
    while (pila.length) {
      const u = pila.pop();
      n++;
      for (const [v] of adj.get(u) ?? []) {
        if (!de.has(v)) { de.set(v, c); pila.push(v); }
      }
    }
    tam.push(n);
  }
  return { de, tam, mayor: tam.indexOf(Math.max(0, ...tam)) };
}

/**
 * Pega al viario los puntos que, de no hacerlo, quedarían unidos al resto del mapa por
 * una recta punteada: los mueve al nodo más cercano de la red principal.
 *
 * Es un desplazamiento deliberado y acotado. Un mapa por el que se camina no puede
 * prometer un camino que no existe, y entre mover un núcleo doscientos metros o dibujar
 * una raya por el monte, mover es lo honesto. El tope (`maxMove`) evita el disparate de
 * arrastrar a tierra firme un núcleo que está en una isla: ese sigue con su recta.
 *
 * Devuelve [{ punto, metros }] con lo que se ha movido, para poder contarlo.
 */
export function pegarAViario(puntos, roads, maxMove = 1200) {
  const { coord, adj, nodeIds } = buildGraph(roads);
  if (!nodeIds.length) return [];
  const { de, mayor } = componentes(adj, nodeIds);
  const principales = nodeIds.filter((id) => de.get(id) === mayor);
  if (!principales.length) return [];

  const movidos = [];
  for (const p of puntos) {
    const actual = snapTo(nodeIds, coord, p, SNAP_MAX);
    if (actual != null && de.get(actual) === mayor) continue; // ya cuelga de la red

    let mejor = null, md = Infinity;
    for (const id of principales) {
      const d = dist(coord.get(id), p);
      if (d < md || (d === md && comparaNodo(id, mejor) < 0)) { md = d; mejor = id; }
    }
    if (mejor == null || md > maxMove) continue; // demasiado lejos: se queda como está

    const q = coord.get(mejor);
    movidos.push({ punto: p, metros: Math.round(md) });
    p.x = q.x;
    p.y = q.y;
  }
  return movidos;
}

/**
 * settlements: núcleos generados. roads: ways viarios de parseGeo. names:
 * paquete de nombres. indice: índice de nombres del mundo, compartido con las
 * demás familias. Devuelve rutas [{from, to, pts, nodos, fallback, name}] que
 * conectan todos los núcleos (fallback = recta punteada si no hay camino).
 */
export function buildRoutes(settlements, roads, seedStr, names, indice = crearIndiceDeNombres()) {
  if (settlements.length < 2) return [];
  const rng = makeRng(seedStr + ':routes');

  const { coord, adj, nodeIds } = buildGraph(roads);
  const n = settlements.length;
  const snap = settlements.map((s) => snapTo(nodeIds, coord, s, SNAP_MAX));

  const sp = settlements.map((_, i) => (snap[i] != null ? dijkstra(adj, snap[i]) : null));

  // árbol de expansión mínima (Prim) sobre distancias de ruta
  const inTree = new Array(n).fill(false);
  inTree[0] = true;
  const routes = [];
  for (let k = 1; k < n; k++) {
    let bi = -1, bj = -1, bw = Infinity;
    for (let i = 0; i < n; i++) {
      if (!inTree[i] || !sp[i]) continue;
      for (let j = 0; j < n; j++) {
        if (inTree[j]) continue;
        const w = sp[i].dist.get(snap[j]) ?? Infinity;
        if (w < bw) { bw = w; bi = i; bj = j; }
      }
    }

    if (bi === -1) {
      // sin camino en el grafo: recta al núcleo del árbol más cercano
      let fj = settlements.findIndex((_, j) => !inTree[j]);
      let fi = 0, fd = Infinity;
      for (let i = 0; i < n; i++) {
        if (!inTree[i]) continue;
        const d = dist(settlements[i], settlements[fj]);
        if (d < fd) { fd = d; fi = i; }
      }
      routes.push({ from: settlements[fi], to: settlements[fj], pts: [settlements[fi], settlements[fj]], nodos: [], fallback: true });
      inTree[fj] = true;
      continue;
    }

    const ids = reconstruct(sp[bi].prev, snap[bi], snap[bj]);
    const pts = ids ? ids.map((id) => coord.get(id)) : [];
    // el camino llega visualmente hasta los glifos de los núcleos
    routes.push({
      from: settlements[bi],
      to: settlements[bj],
      pts: [{ x: settlements[bi].x, y: settlements[bi].y }, ...pts, { x: settlements[bj].x, y: settlements[bj].y }],
      nodos: ids ?? [],
      fallback: false,
    });
    inTree[bj] = true;
  }

  // nombres únicos: dirección predominante o destino. El conjunto de usados es el
  // del mundo entero, así que una calzada tampoco puede llamarse como un servicio.
  for (const r of routes) {
    const dx = r.to.x - r.from.x, dy = r.to.y - r.from.y;
    r.name = indice.fija(
      () => names.roadName(rng, names.directionWord(rng, dx, dy), r.to.type !== 'granja' ? r.to.name : null),
      (base, k) => names.variantName(base, k),
      10,
    );
  }
  return routes;
}

/**
 * Ramales: engancha cada paraje a la red de calzadas, para que desde cualquier punto
 * marcado en el mapa se pueda llegar caminando a los demás por un camino pintado.
 *
 * Los parajes nacidos del grafo (cruces y puentes) ya están sobre una calzada y se
 * saltan. Para el resto se busca el camino real más corto hasta el punto de la red más
 * próximo — no hasta el núcleo más cercano en línea recta, que daría rodeos absurdos —,
 * y solo si no hay camino se traza la recta punteada.
 *
 * Devuelve rutas con la misma forma que buildRoutes, marcadas `ramal: true` y sin
 * nombre: son sendas de acceso, no calzadas con historia.
 */
export function linkParajes(parajes, routes, settlements, roads) {
  if (!parajes?.length) return [];
  const { coord, adj, nodeIds } = buildGraph(roads);
  if (!nodeIds.length) return [];

  // la red a la que hay que llegar: los nodos por los que ya pasa una calzada, más los
  // propios núcleos (para el caso de un mundo con una sola calzada, o ninguna)
  const enRed = new Set(routes.flatMap((r) => r.nodos ?? []));
  for (const s of settlements) {
    const id = snapTo(nodeIds, coord, s, SNAP_MAX);
    if (id != null) enRed.add(id);
  }
  if (!enRed.size) return [];

  const ramales = [];
  for (const p of parajes) {
    if (p.origin === 'grafo') continue; // ya está en un cruce de la red
    const desde = snapTo(nodeIds, coord, p, SNAP_MAX);
    let ruta = null;
    if (desde != null) {
      const { dist: d, prev } = dijkstra(adj, desde);
      let mejor = null, md = Infinity;
      // el recorrido del conjunto va ordenado: de él sale a qué punto de la red se
      // engancha el paraje, y eso no puede depender del orden de inserción
      for (const id of [...enRed].sort(comparaNodo)) {
        const v = d.get(id);
        if (v != null && v < md) { md = v; mejor = id; }
      }
      if (mejor != null) {
        const ids = reconstruct(prev, desde, mejor);
        if (ids) ruta = ids.map((id) => coord.get(id));
      }
    }

    if (ruta) {
      ramales.push({ from: p, to: null, pts: [{ x: p.x, y: p.y }, ...ruta], nodos: [], ramal: true, fallback: false, name: null });
    } else {
      // sin camino: recta al núcleo más cercano, igual que hacen las calzadas
      let cerca = null, cd = Infinity;
      for (const s of settlements) {
        const v = dist(p, s);
        if (v < cd) { cd = v; cerca = s; }
      }
      if (cerca) ramales.push({ from: p, to: cerca, pts: [{ x: p.x, y: p.y }, { x: cerca.x, y: cerca.y }], nodos: [], ramal: true, fallback: true, name: null });
    }
  }
  return ramales;
}
