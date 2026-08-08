// El grafo viario de una celda: el callejero de OSM cosido por donde el dato llega
// roto, con toda arista que no existe en OSM marcada como suposición nuestra. Se
// construye **una sola vez** y lo comparten el pegado de puntos al viario, el
// trazado de calzadas y el enlace de parajes.

import { dist } from '../core/geo.js';

/**
 * Distancia máxima que se considera «hueco en los datos» y no separación real.
 *
 * En un mundo real medido salían 109 componentes conexas, muchas a 9-50 m unas de
 * otras y la red entera del norte a 157 m del resto. No son carreteras distintas:
 * a los ways les faltan nodos compartidos, o el corte del bounding box parte la
 * conexión. El umbral es **inclusivo** (a exactamente 180 m se cose) y va **en
 * metros y no en tramos**: mide un defecto del dato de OSM, no una distancia
 * jugable, y en tramos el mismo callejero daría grafos distintos a dos personas.
 *
 * Se exporta porque la costura del borde entre celdas usa este mismo umbral: dos
 * umbrales distintos producirían costuras que dependen de por qué lado se miran.
 */
export const COSER_MAX = 180;

/**
 * Los tres valores de la marca de suposición. **Enumerado y no booleano**: el
 * filtro de accesibilidad trata igual a las dos marcas —ninguna se promete
 * transitable— pero la propagación de rumores solo penaliza `fallback`, porque
 * cruzar un hueco de 22 m que OSM no trae no es lo mismo que cruzar por donde no
 * hay camino que conozcamos.
 */
export const SUPOSICIONES = Object.freeze({
  /** La arista existe en OSM entre dos nodos consecutivos de un way. */
  NINGUNA: null,
  /** Une dos nodos reales de OSM que el dato no traía unidos. */
  COSIDA: 'cosida',
  /** Recta trazada donde el grafo no ofrecía camino. */
  FALLBACK: 'fallback',
});

/** Los valores admitidos de la marca, para validarla en un solo sitio. */
export const MARCAS_DE_SUPOSICION = Object.freeze([SUPOSICIONES.NINGUNA, SUPOSICIONES.COSIDA, SUPOSICIONES.FALLBACK]);

/** Tope para enganchar un punto al viario. En metros, por lo mismo que `COSER_MAX`. */
export const SNAP_MAX = 2000;

/** Tope de desplazamiento de un punto hasta la red principal. También en metros. */
export const MOVER_MAX = 1200;

/** Hasta dónde se busca la componente vecina cuando ya no queda nada que coser. */
const ANILLOS_DE_BUSQUEDA = 40;

// Dos nodos más cerca que esto son el mismo sitio: la proyección de la misma
// coordenada de OSM da el mismo número, y por debajo del milímetro no hay dato
// que distinguir. Por encima, dos coordenadas con el mismo identificador son dos
// sitios distintos y eso es un error del dato que hay que declarar.
const MISMO_PUNTO_M = 0.001;

/**
 * Orden estable de los nodos del grafo: los ids de OSM por número y las claves de
 * coordenada por texto. Recorrer las claves de un Map en orden de inserción dejaba
 * que el orden de llegada de los ways decidiera los empates de distancia.
 */
export function comparaNodo(a, b) {
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

/** Caminos mínimos desde `src` sobre el grafo ya construido. */
export function dijkstra(grafo, src) {
  const adj = grafo.adj;
  const d = new Map([[src, 0]]);
  const prev = new Map();
  const heap = new MinHeap();
  heap.push(0, src);
  while (heap.size) {
    const [du, u] = heap.pop();
    if (du > (d.get(u) ?? Infinity)) continue;
    for (const a of adj.get(u) ?? []) {
      const nd = du + a.metros;
      if (nd < (d.get(a.hasta) ?? Infinity)) {
        d.set(a.hasta, nd);
        prev.set(a.hasta, u);
        heap.push(nd, a.hasta);
      }
    }
  }
  return { dist: d, prev };
}

/** La cadena de nodos de `src` a `dst`, o null si no hay camino. */
export function reconstruye(prev, src, dst) {
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
 * La arista que une dos nodos contiguos, o null si no existe.
 *
 * Con aristas paralelas —dos ways que unen el mismo par de nodos— gana la más
 * corta, y a igualdad de longitud la que no es suposición: si hay camino real, el
 * tramo no puede presentarse como inventado.
 */
export function aristaEntre(grafo, a, b) {
  let mejor = null;
  for (const arista of grafo.adj.get(a) ?? []) {
    if (arista.hasta !== b) continue;
    if (
      mejor === null
      || arista.metros < mejor.metros
      || (arista.metros === mejor.metros && mejor.suposicion !== null && arista.suposicion === null)
    ) mejor = arista;
  }
  return mejor;
}

// Union-find con compresión de caminos: la conectividad del grafo se consulta
// tantas veces al coser que recorrerla sería el coste dominante.
function conjuntos(nodeIds) {
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
  return { find, une };
}

// Rejilla del tamaño del hueco máximo: solo se comparan nodos de celdas vecinas.
function rejillaDeNodos(coord, nodeIds, lado) {
  const grid = new Map();
  for (const id of nodeIds) {
    const p = coord.get(id);
    const k = `${Math.floor(p.x / lado)},${Math.floor(p.y / lado)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(id);
  }
  return grid;
}

/**
 * Cose los trozos sueltos del grafo viario.
 *
 * Se unen por orden de menor a mayor hueco (Kruskal), así que dos trozos se cosen
 * por su pareja más próxima y por una sola arista, y nunca se crean atajos dentro
 * de una componente. Por encima del umbral se asume que la separación es de verdad
 * y se deja como está — y se declara en el informe, que es lo que distingue un dato
 * malo de una separación real.
 *
 * Dos ways con `layer` distinto no se cosen entre sí aunque sus nodos caigan por
 * debajo del umbral: un puente que pasa por encima de una carretera tiene nodos a
 * pocos metros en planta, y coserlos inventa un enlace que no existe. Sin `layer`
 * declarado se asume el mismo nivel.
 */
function coseHuecos({ coord, capas, nodeIds, umbralM, une, find, anade }) {
  const grid = rejillaDeNodos(coord, nodeIds, umbralM);

  const pares = [];
  for (const id of nodeIds) {
    const p = coord.get(id);
    const ci = Math.floor(p.x / umbralM), cj = Math.floor(p.y / umbralM);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        for (const otro of grid.get(`${ci + di},${cj + dj}`) ?? []) {
          if (comparaNodo(otro, id) <= 0) continue;
          if (find(id) === find(otro)) continue;
          if (!compartenNivel(capas.get(id), capas.get(otro))) continue;
          const d = dist(p, coord.get(otro));
          if (d <= umbralM) pares.push([d, id, otro]);
        }
      }
    }
  }
  // El empate de distancia lo rompe el identificador de nodo y no el orden de
  // llegada de los ways: dos callejeros con los mismos datos en otro orden tienen
  // que coserse igual.
  pares.sort((a, b) => a[0] - b[0] || comparaNodo(a[1], b[1]) || comparaNodo(a[2], b[2]));

  const cosidas = [];
  for (const [d, a, b] of pares) {
    if (!une(a, b)) continue;
    anade(a, b, d, SUPOSICIONES.COSIDA, null);
    cosidas.push({ desde: a, hasta: b, metros: d });
  }
  return cosidas;
}

function compartenNivel(a, b) {
  for (const nivel of a) if (b.includes(nivel)) return true;
  return false;
}

/**
 * Componentes conexas del grafo, de mayor a menor. La mayor es «la red»: si un
 * núcleo cae sobre un trozo de carretera suelto, estar pegado al asfalto no le
 * sirve de nada, porque desde ahí no se llega a ninguna parte.
 */
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
      for (const a of adj.get(u) ?? []) {
        if (!de.has(a.hasta)) { de.set(a.hasta, c); pila.push(a.hasta); }
      }
    }
    tam.push(n);
  }
  let mayor = -1;
  for (let c = 0; c < tam.length; c++) if (mayor === -1 || tam[c] > tam[mayor]) mayor = c;
  return { de, tam, mayor };
}

/**
 * La separación mínima que quedó sin coser, en metros, o null si no queda ninguna
 * otra componente al alcance de la búsqueda.
 *
 * Solo se mira desde los nodos que **no** son de la componente mayor: toda pareja
 * de componentes distintas tiene al menos un extremo fuera de la mayor, así que no
 * se pierde ninguna y el coste deja de depender del tamaño de la red principal.
 */
function separacionMinima({ coord, nodeIds, de, mayor, umbralM }) {
  const sueltos = nodeIds.filter((id) => de.get(id) !== mayor);
  if (!sueltos.length) return null;
  const grid = rejillaDeNodos(coord, nodeIds, umbralM);

  let mejor = Infinity;
  for (const id of sueltos) {
    const p = coord.get(id);
    const c = de.get(id);
    const ci = Math.floor(p.x / umbralM), cj = Math.floor(p.y / umbralM);
    let local = Infinity;
    for (let k = 1; k <= ANILLOS_DE_BUSQUEDA; k++) {
      for (let di = -k; di <= k; di++) {
        for (let dj = -k; dj <= k; dj++) {
          // solo el anillo nuevo: lo de dentro ya se miró en la vuelta anterior
          if (Math.max(Math.abs(di), Math.abs(dj)) !== k) continue;
          for (const otro of grid.get(`${ci + di},${cj + dj}`) ?? []) {
            if (de.get(otro) === c) continue;
            const d = dist(p, coord.get(otro));
            if (d < local) local = d;
          }
        }
      }
      // completo para toda distancia menor que k celdas: lo que quede fuera está
      // más lejos que eso y no puede mejorar lo encontrado
      if (local <= k * umbralM) break;
    }
    if (local < mejor) mejor = local;
  }
  return Number.isFinite(mejor) ? mejor : null;
}

/**
 * Construye el grafo viario a partir de las vías ya parseadas —callejero y
 * carreteras, en el mismo saco— y lo cose.
 *
 * Cada vía es `{ pts, nodes, layer, rasgo }`: los identificadores de nodo de OSM
 * son la clave de intersección, y sin ellos los nodos se identifican por su
 * coordenada redondeada al metro, que es estable entre ejecuciones.
 *
 * @param {Array} vias
 * @param {{ umbralM?: number }} [opciones]
 * @returns el grafo, con su informe. **Toda arista lleva su marca de suposición**:
 *   nula si viene de dos nodos consecutivos de un way real, `'cosida'` si la puso
 *   el cosido. Que el campo sea obligatorio es todo el mecanismo que impide que la
 *   marca se pierda aguas abajo.
 */
export function construyeGrafo(vias, opciones = {}) {
  const umbralM = opciones.umbralM ?? COSER_MAX;
  if (typeof umbralM !== 'number' || !Number.isFinite(umbralM) || umbralM <= 0) {
    throw new Error(`umbralM inválido (${umbralM}): el umbral de cosido es un número positivo de metros`);
  }

  const coord = new Map();
  const capas = new Map();
  const adj = new Map();
  let aristas = 0;
  const anade = (a, b, metros, suposicion, rasgo) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ hasta: b, metros, suposicion, rasgo: rasgo ?? null });
  };
  const anadeAmbos = (a, b, metros, suposicion, rasgo) => {
    anade(a, b, metros, suposicion, rasgo);
    anade(b, a, metros, suposicion, rasgo);
    aristas++;
  };

  for (const via of vias ?? []) {
    const pts = via?.pts ?? [];
    if (!pts.length) continue;
    // Los identificadores de nodo de OSM son la clave de intersección; sin ellos
    // los nodos se identifican por su coordenada redondeada al metro, que es
    // estable entre ejecuciones. La diferencia importa para el conflicto de más
    // abajo: dos puntos distintos dentro del mismo metro **son** el mismo nodo por
    // construcción de esa clave, y tratarlos como un choque haría fallar cualquier
    // polilínea densa que llegue sin ids.
    const deOsm = !!(via.nodes && via.nodes.length === pts.length);
    const ids = deOsm ? via.nodes : pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`);
    const nivel = Number.isFinite(via.layer) ? via.layer : 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const p = pts[i];
      const ya = coord.get(id);
      if (ya === undefined) {
        coord.set(id, p);
        capas.set(id, [nivel]);
      } else {
        // Fusionar dos sitios que no son el mismo produce un grafo que miente sin
        // avisar, y es exactamente la clase de fallo silencioso que este módulo
        // existe para cerrar.
        if (deOsm && dist(ya, p) > MISMO_PUNTO_M) {
          throw new Error(
            `el nodo "${id}" llega en dos coordenadas distintas (${ya.x.toFixed(2)},${ya.y.toFixed(2)} y ${p.x.toFixed(2)},${p.y.toFixed(2)}): dos sitios no pueden compartir identificador`,
          );
        }
        const lista = capas.get(id);
        if (!lista.includes(nivel)) { lista.push(nivel); lista.sort((x, y) => x - y); }
      }
    }
    for (let i = 0; i < ids.length - 1; i++) {
      const metros = dist(pts[i], pts[i + 1]);
      if (metros <= 0) continue; // dos puntos en la misma coordenada no son una arista
      anadeAmbos(ids[i], ids[i + 1], metros, SUPOSICIONES.NINGUNA, via.rasgo ?? null);
    }
  }

  const nodeIds = [...coord.keys()].sort(comparaNodo);
  const { find, une } = conjuntos(nodeIds);
  for (const [u, lista] of adj) for (const a of lista) une(u, a.hasta);

  const cosidas = coseHuecos({ coord, capas, nodeIds, umbralM, une, find, anade: anadeAmbos });

  const { de, tam, mayor } = componentes(adj, nodeIds);
  const aisladas = tam
    .map((nodos, c) => ({ componente: c, nodos }))
    .filter((c) => c.componente !== mayor)
    .sort((a, b) => b.nodos - a.nodos || a.componente - b.componente)
    .map((c) => ({ nodos: c.nodos }));

  const grafo = {
    coord,
    capas,
    adj,
    nodeIds,
    umbralM,
    // Qué componente es cada nodo y cuál es la red principal: lo consultan el
    // pegado al viario y el trazado, y recalcularlo en cada fase sería otra
    // oportunidad de divergir.
    de,
    mayor,
    informe: {
      nodos: nodeIds.length,
      aristas,
      componentes: tam.length,
      cosidas: cosidas.length,
      metrosCosidos: cosidas.map((c) => c.metros),
      componentesAisladas: aisladas,
      separacionMinimaSinCoserM: separacionMinima({ coord, nodeIds, de, mayor, umbralM }),
      alcanceDeBusquedaM: ANILLOS_DE_BUSQUEDA * umbralM,
      umbralM,
    },
  };
  return grafo;
}

/**
 * Comprueba que ninguna arista se ha construido sin su marca de suposición.
 *
 * Es lo que hace comprobable que la marca no se puede perder en silencio: con un
 * campo opcional, perderla y no haberla tenido nunca son indistinguibles.
 */
export function validaGrafo(grafo) {
  if (!grafo || !(grafo.adj instanceof Map)) throw new Error('validaGrafo necesita un grafo construido con construyeGrafo');
  for (const id of grafo.nodeIds) {
    for (const arista of grafo.adj.get(id) ?? []) {
      if (!Object.prototype.hasOwnProperty.call(arista, 'suposicion')) {
        throw new Error(`la arista ${id} ↔ ${arista.hasta} no declara su marca de suposición`);
      }
      if (!MARCAS_DE_SUPOSICION.includes(arista.suposicion)) {
        throw new Error(`la arista ${id} ↔ ${arista.hasta} declara una marca de suposición desconocida: ${JSON.stringify(arista.suposicion)}`);
      }
    }
  }
  return grafo;
}

/**
 * El grafo, venga ya construido o haya que construirlo de una lista de vías.
 *
 * Existe para que el grafo se construya **una vez por celda** y se inyecte a las
 * tres fases que lo usan, sin romper a quien todavía le pasa el callejero: tres
 * cosidos del mismo callejero son tres oportunidades de divergir.
 */
export function exigeGrafo(viasOgrafo, opciones = {}) {
  if (viasOgrafo && !Array.isArray(viasOgrafo) && viasOgrafo.adj instanceof Map) return viasOgrafo;
  return construyeGrafo(viasOgrafo ?? [], opciones);
}

/**
 * Nodo viario más cercano a un punto, con tope: lo que está demasiado lejos de
 * toda carretera no se engancha por un rodeo absurdo, se resuelve con una recta.
 */
export function nodoMasCercano(grafo, p, max = SNAP_MAX) {
  let best = null, bd = Infinity;
  for (const id of grafo.nodeIds) {
    const d = dist(grafo.coord.get(id), p);
    // el empate a distancia lo rompe el propio nodo, no el orden de la lista
    if (d < bd || (d === bd && comparaNodo(id, best) < 0)) { bd = d; best = id; }
  }
  return bd <= max ? best : null;
}

/**
 * Pega al viario los puntos que, de no hacerlo, quedarían unidos al resto del mapa
 * por una recta punteada: los mueve al nodo más cercano de la red principal.
 *
 * Es un desplazamiento deliberado y acotado. Un mapa por el que se camina no puede
 * prometer un camino que no existe, y entre mover un núcleo doscientos metros o
 * dibujar una raya por el monte, mover es lo honesto. El tope (`maxMove`) evita el
 * disparate de arrastrar a tierra firme un núcleo que está en una isla: ese sigue
 * con su recta.
 *
 * Devuelve [{ punto, metros }] con lo que se ha movido, para poder contarlo.
 */
export function pegarAViario(puntos, viasOgrafo, maxMove = MOVER_MAX) {
  const grafo = exigeGrafo(viasOgrafo);
  if (!grafo.nodeIds.length) return [];
  const principales = grafo.nodeIds.filter((id) => grafo.de.get(id) === grafo.mayor);
  if (!principales.length) return [];

  const movidos = [];
  for (const p of puntos) {
    const actual = nodoMasCercano(grafo, p, SNAP_MAX);
    if (actual != null && grafo.de.get(actual) === grafo.mayor) continue; // ya cuelga de la red

    let mejor = null, md = Infinity;
    for (const id of principales) {
      const d = dist(grafo.coord.get(id), p);
      if (d < md || (d === md && comparaNodo(id, mejor) < 0)) { md = d; mejor = id; }
    }
    if (mejor == null || md > maxMove) continue; // demasiado lejos: se queda como está

    const q = grafo.coord.get(mejor);
    movidos.push({ punto: p, metros: Math.round(md) });
    p.x = q.x;
    p.y = q.y;
  }
  return movidos;
}
