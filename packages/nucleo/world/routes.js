// Red vertebral: rutas reales entre núcleos sobre el grafo viario ya cosido, y
// ramales con nombre desde cada paraje hasta esa red. Cada tramo de cada ruta
// declara si es camino de OSM o suposición nuestra; el grafo lo construye
// `grafo.js` una sola vez y aquí se recibe hecho.

import { dist } from '../core/geo.js';
import { makeRng } from '../core/rng.js';
import { SUFIJOS_DE_FASE } from '../core/semilla.js';
import { crearIndiceDeNombres } from '../names/index.js';
import { APTITUD_SUPUESTA } from './aptitud.js';
import {
  COSER_MAX,
  MARCAS_DE_SUPOSICION,
  SNAP_MAX,
  SUPOSICIONES,
  aristaEntre,
  comparaNodo,
  dijkstra,
  exigeGrafo,
  nodoMasCercano,
  reconstruye,
} from './grafo.js';

// Se reexportan porque son la frontera que el resto del paquete ya consumía desde
// aquí —la costura del borde entre celdas y el margen de la celda usan el umbral,
// y la tubería pega los puntos al viario— y partirla en dos imports no aporta nada.
export { COSER_MAX, SUPOSICIONES, construyeGrafo, pegarAViario, validaGrafo } from './grafo.js';

/**
 * Los tramos de una ruta a partir de la cadena de nodos que la recorre.
 *
 * La marca **baja al nivel de tramo** y no se queda en la ruta: una calzada de 3 km
 * que cruza 22 m cosidos no es una calzada inventada, y marcarla entera como
 * suposición haría que el filtro de accesibilidad descartara media red.
 */
function tramosDeCamino(grafo, ids) {
  const tramos = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const a = ids[i], b = ids[i + 1];
    const arista = aristaEntre(grafo, a, b);
    const pa = grafo.coord.get(a), pb = grafo.coord.get(b);
    tramos.push({
      desde: { x: pa.x, y: pa.y },
      hasta: { x: pb.x, y: pb.y },
      nodos: [a, b],
      metros: arista ? arista.metros : dist(pa, pb),
      suposicion: arista ? arista.suposicion : SUPOSICIONES.FALLBACK,
      rasgo: arista ? arista.rasgo : null,
      // El nombre y la marca de aptitud viajan con el tramo, no se le vuelven a
      // preguntar al grafo: quien declara un camino evitado necesita las dos y no
      // tiene por qué conocer la estructura interna del grafo.
      nombre: arista ? arista.nombre ?? null : null,
      aptitud: arista ? arista.aptitud : APTITUD_SUPUESTA,
    });
  }
  return tramos;
}

/** El tramo único de una ruta que se resolvió en recta porque no había camino. */
function tramoRecto(desde, hasta) {
  return [{
    desde: { x: desde.x, y: desde.y },
    hasta: { x: hasta.x, y: hasta.y },
    nodos: [],
    metros: dist(desde, hasta),
    suposicion: SUPOSICIONES.FALLBACK,
    rasgo: null,
    nombre: null,
    aptitud: APTITUD_SUPUESTA,
  }];
}

/**
 * El resumen que la ruta declara de lo que contienen sus tramos, para que nadie
 * tenga que volver a preguntarle al grafo: `cosida` dice «esto está unido en la
 * realidad y el dato no lo trae», `fallback` dice «por aquí no hay camino que
 * conozcamos». Solo la segunda es «cruza un trozo sin calzada real».
 */
function resumeSuposiciones(tramos) {
  const cosida = tramos.some((t) => t.suposicion === SUPOSICIONES.COSIDA);
  const fallback = tramos.some((t) => t.suposicion === SUPOSICIONES.FALLBACK);
  return { cosida, fallback, ninguna: !cosida && !fallback };
}

/** Marca de la ruta entera, derivada de sus tramos y nunca puesta a mano. */
function conMarcas(ruta, tramos) {
  const resumen = resumeSuposiciones(tramos);
  return { ...ruta, tramos, suposiciones: resumen, cosida: resumen.cosida, fallback: resumen.fallback };
}

/**
 * Los tramos de un mundo que son suposición nuestra, con la ruta a la que
 * pertenecen. Se pide aquí y no recorriendo el grafo: quien filtra o penaliza no
 * tiene por qué conocer la estructura interna del módulo del grafo.
 */
export function tramosSupuestos(routes) {
  const out = [];
  for (const r of routes ?? []) {
    for (const t of r.tramos ?? []) {
      if (t.suposicion === SUPOSICIONES.NINGUNA) continue;
      out.push({ ruta: r.name ?? null, ramal: !!r.ramal, ...t });
    }
  }
  return out;
}

/**
 * Comprueba que todo tramo de toda calzada y de todo ramal lleva su marca. Un tramo
 * sin marca es un error de construcción, no un «no lo sé», y falla nombrándolo.
 */
export function validaTramos(routes) {
  for (const r of routes ?? []) {
    if (!Array.isArray(r.tramos)) {
      throw new Error(`la ${r.ramal ? 'ramal' : 'calzada'} "${r.name ?? 'sin nombre'}" no declara sus tramos`);
    }
    r.tramos.forEach((t, i) => {
      if (!Object.prototype.hasOwnProperty.call(t, 'suposicion')) {
        throw new Error(`el tramo ${i + 1} de "${r.name ?? 'sin nombre'}" no declara su marca de suposición`);
      }
      if (!MARCAS_DE_SUPOSICION.includes(t.suposicion)) {
        throw new Error(`el tramo ${i + 1} de "${r.name ?? 'sin nombre'}" declara una marca desconocida: ${JSON.stringify(t.suposicion)}`);
      }
    });
  }
  return routes;
}

/**
 * settlements: núcleos generados. `grafoViario`: el grafo **ya construido** con
 * `construyeGrafo`; pasar aquí una lista de vías es un error de construcción y falla
 * nombrándolo. names: paquete de nombres. indice: índice de nombres del mundo,
 * compartido con las demás familias.
 *
 * Devuelve rutas [{from, to, pts, nodos, tramos, suposiciones, fallback, name}] que
 * conectan todos los núcleos (tramo `fallback` = recta punteada si no hay camino).
 */
export function buildRoutes(settlements, grafoViario, seedStr, names, indice = crearIndiceDeNombres()) {
  const grafo = exigeGrafo(grafoViario);
  if (settlements.length < 2) return [];
  const rng = makeRng(seedStr + SUFIJOS_DE_FASE.calzadas);

  const n = settlements.length;
  const snap = settlements.map((s) => nodoMasCercano(grafo, s, SNAP_MAX));

  const sp = settlements.map((_, i) => (snap[i] != null ? dijkstra(grafo, snap[i]) : null));

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
      routes.push(conMarcas(
        { from: settlements[fi], to: settlements[fj], pts: [settlements[fi], settlements[fj]], nodos: [] },
        tramoRecto(settlements[fi], settlements[fj]),
      ));
      inTree[fj] = true;
      continue;
    }

    const ids = reconstruye(sp[bi].prev, snap[bi], snap[bj]);
    const pts = ids ? ids.map((id) => grafo.coord.get(id)) : [];
    // el camino llega visualmente hasta los glifos de los núcleos
    routes.push(conMarcas(
      {
        from: settlements[bi],
        to: settlements[bj],
        pts: [{ x: settlements[bi].x, y: settlements[bi].y }, ...pts, { x: settlements[bj].x, y: settlements[bj].y }],
        nodos: ids ?? [],
      },
      ids ? tramosDeCamino(grafo, ids) : tramoRecto(settlements[bi], settlements[bj]),
    ));
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

/** Cuántas formas libres se prueban antes de caer a la forma sobre el nombre del paraje. */
const INTENTOS_DE_NOMBRE_DE_RAMAL = 8;

/**
 * El rasgo del ramal —`'escalones'`, `'tierra'`, `'estrecho'`— si el callejero lo
 * declara. Sesga la forma del nombre, no la determina, y hoy puede llegar nulo: los
 * tags que lo alimentan todavía no se piden en la consulta de callejero, y el
 * nombre sale igual sin él.
 */
function rasgoDeRamal(tramos) {
  for (const t of tramos) if (t.rasgo) return t.rasgo;
  return null;
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
 * **Todos nacen con nombre**, y del paquete de idioma del mundo: un camino sin nombre
 * no se puede ni ofrecer como desvío ni declarar como evitado. El registro no es el de
 * una calzada —una senda, una corredoira, una escalinata— y la unicidad está
 * garantizada, no intentada: agotadas las formas libres se cae a la forma construida
 * sobre el nombre del paraje, que es única porque el nombre del paraje lo es y cada
 * paraje recibe como mucho un ramal. Nunca con un sufijo numérico, que rompe la voz
 * del mundo.
 */
export function linkParajes(parajes, routes, settlements, grafoViario, seedStr, names, indice = crearIndiceDeNombres()) {
  const grafo = exigeGrafo(grafoViario);
  if (!parajes?.length) return [];
  if (!grafo.nodeIds.length) return [];

  // la red a la que hay que llegar: los nodos por los que ya pasa una calzada, más los
  // propios núcleos (para el caso de un mundo con una sola calzada, o ninguna)
  const enRed = new Set(routes.flatMap((r) => r.nodos ?? []));
  for (const s of settlements) {
    const id = nodoMasCercano(grafo, s, SNAP_MAX);
    if (id != null) enRed.add(id);
  }
  if (!enRed.size) return [];

  const ramales = [];
  for (const p of parajes) {
    if (p.origin === 'grafo') continue; // ya está en un cruce de la red
    const desde = nodoMasCercano(grafo, p, SNAP_MAX);
    let ruta = null;
    let ids = null;
    if (desde != null) {
      const { dist: d, prev } = dijkstra(grafo, desde);
      let mejor = null, md = Infinity;
      // el recorrido del conjunto va ordenado: de él sale a qué punto de la red se
      // engancha el paraje, y eso no puede depender del orden de inserción
      for (const id of [...enRed].sort(comparaNodo)) {
        const v = d.get(id);
        if (v != null && v < md) { md = v; mejor = id; }
      }
      if (mejor != null) {
        ids = reconstruye(prev, desde, mejor);
        if (ids) ruta = ids.map((id) => grafo.coord.get(id));
      }
    }

    if (ruta) {
      ramales.push(conMarcas(
        { from: p, to: null, pts: [{ x: p.x, y: p.y }, ...ruta], nodos: [], ramal: true },
        tramosDeCamino(grafo, ids),
      ));
    } else {
      // sin camino: recta al núcleo más cercano, igual que hacen las calzadas
      let cerca = null, cd = Infinity;
      for (const s of settlements) {
        const v = dist(p, s);
        if (v < cd) { cd = v; cerca = s; }
      }
      if (cerca) {
        ramales.push(conMarcas(
          { from: p, to: cerca, pts: [{ x: p.x, y: p.y }, { x: cerca.x, y: cerca.y }], nodos: [], ramal: true },
          tramoRecto(p, cerca),
        ));
      }
    }
  }

  nombraRamales(ramales, seedStr, names, indice);
  return ramales;
}

/**
 * Nombra los ramales ya trazados, con **sufijo de azar propio**: cambiar esta fase
 * no puede desplazar los nombres de las calzadas.
 */
function nombraRamales(ramales, seedStr, names, indice) {
  if (!ramales.length) return; // sin ramales no se le pide nada al paquete de idioma
  if (!names || typeof names.ramalName !== 'function') {
    throw new Error(
      `el paquete de idioma "${names?.locale ?? 'desconocido'}" no implementa ramalName(rng, dirWord, hastaName, rasgo), que la interfaz común de names/ exige para nombrar los ramales`,
    );
  }
  const rng = makeRng(seedStr + SUFIJOS_DE_FASE.ramales);
  for (const r of ramales) {
    const fin = r.pts[r.pts.length - 1];
    const dx = fin.x - r.from.x, dy = fin.y - r.from.y;
    const hasta = r.from.name ?? null;
    const rasgo = rasgoDeRamal(r.tramos);
    // La caída garantizada: la forma sobre el nombre del paraje. Se pide sin rng a
    // propósito —es función del nombre, no del azar— y solo si esa también
    // estuviera tomada se le encadena un epíteto de sitio, nunca una cifra. Un
    // paraje sin nombre no puede sostener esa forma, así que ahí se desambigua
    // sobre lo último sorteado; no ocurre con los parajes que genera la tubería.
    const desambigua = hasta
      ? (base, k) => (k === 0 ? names.ramalName(null, null, hasta, rasgo) : names.variantName(names.ramalName(null, null, hasta, rasgo), k - 1))
      : (base, k) => names.variantName(base, k);
    r.name = indice.fija(
      () => names.ramalName(rng, names.directionWord(rng, dx, dy), hasta, rasgo),
      desambigua,
      INTENTOS_DE_NOMBRE_DE_RAMAL,
    );
  }
}
