// Red vertebral: rutas reales entre núcleos de población sobre el grafo viario OSM.
// Se calcula el camino más corto entre asentamientos y se conectan todos con un
// árbol de expansión mínima; cada ruta recibe un nombre de fantasía.

import { dist } from './geo.js';
import { makeRng } from './rng.js';
import { roadName, directionWord } from './names.js';

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

/**
 * settlements: núcleos generados. roads: ways viarios de parseGeo.
 * Devuelve rutas [{from, to, pts, fallback, name}] que conectan todos los
 * núcleos (fallback = línea recta punteada si no hay camino en el grafo).
 */
export function buildRoutes(settlements, roads, seedStr) {
  if (settlements.length < 2) return [];
  const rng = makeRng(seedStr + ':routes');

  // grafo: nodos por id OSM (o por coordenada si no vienen ids)
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

  const nodeIds = [...coord.keys()];
  const n = settlements.length;

  // anclar cada núcleo a su nodo viario más cercano (con tope: un núcleo muy
  // lejos de toda carretera —una isla— va por fallback recto, no por rodeos)
  const SNAP_MAX = 2000;
  const snap = settlements.map((s) => {
    let best = null, bd = Infinity;
    for (const id of nodeIds) {
      const d = dist(coord.get(id), s);
      if (d < bd) { bd = d; best = id; }
    }
    return bd <= SNAP_MAX ? best : null;
  });

  // caminos más cortos desde cada núcleo
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
      // sin camino en el grafo: conectar en línea recta al núcleo del árbol más cercano
      let fj = settlements.findIndex((_, j) => !inTree[j]);
      let fi = 0, fd = Infinity;
      for (let i = 0; i < n; i++) {
        if (!inTree[i]) continue;
        const d = dist(settlements[i], settlements[fj]);
        if (d < fd) { fd = d; fi = i; }
      }
      routes.push({ from: settlements[fi], to: settlements[fj], pts: [settlements[fi], settlements[fj]], fallback: true });
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
      fallback: false,
    });
    inTree[bj] = true;
  }

  // nombres únicos con sabor: dirección predominante o destino
  const used = new Set();
  for (const r of routes) {
    const dx = r.to.x - r.from.x, dy = r.to.y - r.from.y;
    let name = '';
    for (let t = 0; t < 10; t++) {
      name = roadName(rng, directionWord(rng, dx, dy), r.to.type !== 'granja' ? r.to.name : null);
      if (!used.has(name)) break;
    }
    used.add(name);
    r.name = name;
  }
  return routes;
}
