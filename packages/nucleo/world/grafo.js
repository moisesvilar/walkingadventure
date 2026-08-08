// El grafo viario de una celda: el callejero de OSM cosido por donde el dato llega
// roto, con toda arista que no existe en OSM marcada como suposición nuestra. Se
// construye **una sola vez** y lo comparten el pegado de puntos al viario, el
// trazado de calzadas y el enlace de parajes.

import { dist } from '../core/geo.js';
import { APTITUD_SUPUESTA, aptitudDeVia, combinaBordillos, conBordillos, cuentaAptitudes, validaAptitud } from './aptitud.js';

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
//
// Con la rejilla de `PRECISION_M` esto es en la práctica una igualdad exacta: dos
// puntos cuantizados o son el mismo o están a un metro. Sigue diciendo lo que
// quería decir, pero su número ya no tiene significado propio.
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
 * Los bordillos de OSM por identificador de nodo.
 *
 * Se combinan cuando un nodo llega dos veces con valores distintos, y la
 * combinación no depende del orden de llegada: el no apto gana siempre, así que
 * servir los mismos bordillos al revés da el mismo índice.
 */
function indiceDeBordillos(bordillos) {
  const idx = new Map();
  for (const b of bordillos ?? []) {
    if (b?.nodo == null || b.aptitud == null) continue;
    const ya = idx.get(b.nodo);
    idx.set(b.nodo, ya == null ? b.aptitud : combinaBordillos(ya, b.aptitud));
  }
  return idx;
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
    // Lo cosido nace en «no se sabe» en los cuatro criterios y **no hereda** la
    // aptitud de las dos vías que une: es suposición nuestra, y una suposición no
    // se promete transitable por muy asfaltado que esté lo de al lado.
    anade(a, b, { metros: d, suposicion: SUPOSICIONES.COSIDA, rasgo: null, nombre: null, aptitud: APTITUD_SUPUESTA });
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
 * @param {{ umbralM?: number, bordillos?: Array }} [opciones]  `bordillos` son los
 *   nodos de bordillo de OSM ya parseados (`parseBordillos`), que se cruzan con los
 *   nodos de las vías. Sin ellos el criterio de bordillos se queda en «no se sabe»,
 *   que es la verdad y no un fallo: nadie ha dicho nada de ese cruce.
 * @returns el grafo, con su informe. **Toda arista lleva su marca de suposición y
 *   su marca de aptitud**: la primera nula si viene de dos nodos consecutivos de un
 *   way real y `'cosida'` si la puso el cosido; la segunda con los cuatro criterios
 *   siempre presentes. Que los dos campos sean obligatorios es todo el mecanismo
 *   que impide que se pierdan aguas abajo.
 */
export function construyeGrafo(vias, opciones = {}) {
  const umbralM = opciones.umbralM ?? COSER_MAX;
  if (typeof umbralM !== 'number' || !Number.isFinite(umbralM) || umbralM <= 0) {
    throw new Error(`umbralM inválido (${umbralM}): el umbral de cosido es un número positivo de metros`);
  }

  const bordillos = indiceDeBordillos(opciones.bordillos);

  const coord = new Map();
  const capas = new Map();
  const adj = new Map();
  let aristas = 0;
  const marcas = [];
  const anade = (a, b, datos) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ hasta: b, ...datos });
  };
  const anadeAmbos = (a, b, datos) => {
    anade(a, b, datos);
    anade(b, a, datos);
    aristas++;
    marcas.push(datos.aptitud);
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
    // La marca de la vía se calcula una vez por vía y no una vez por arista: los
    // tags son de la vía entera. Lo único que baja al tramo son los bordillos, que
    // en OSM viven en el nodo del cruce y por eso solo afectan a las dos aristas
    // que lo tocan.
    const marcaDeLaVia = aptitudDeVia(via.filtrables);
    const nombre = via.name ?? null;
    for (let i = 0; i < ids.length - 1; i++) {
      // El mismo nodo dos veces seguidas no es una arista. Lo que se descarta es el
      // **lazo sobre sí mismo** y no la arista de longitud cero: con la rejilla de
      // `PRECISION_M`, dos nodos distintos de OSM separados por menos de medio metro
      // caen en la misma coordenada, y tirar su arista partiría una vía real por la
      // mitad para que el cosido la volviera a unir después como suposición nuestra.
      // Un camino real degradado a conjetura es exactamente el fallo silencioso que
      // este módulo existe para cerrar.
      if (ids[i] === ids[i + 1]) continue;
      const metros = dist(pts[i], pts[i + 1]);
      const enExtremos = [bordillos.get(ids[i]) ?? null, bordillos.get(ids[i + 1]) ?? null];
      anadeAmbos(ids[i], ids[i + 1], {
        metros,
        suposicion: SUPOSICIONES.NINGUNA,
        rasgo: via.rasgo ?? null,
        // El nombre propio del camino, que es lo que hace declarable un tramo
        // difícil: sin él no se puede nombrar lo que se evita, y declarar «un
        // tramo del camino» es no declarar nada.
        nombre,
        aptitud: conBordillos(marcaDeLaVia, enExtremos),
      });
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
      // El reparto de la marca sobre las aristas: cuánto del mundo es dato y
      // cuánto es silencio de OSM. Se declara porque «no se sabe» es el estado
      // masivo en el callejero real, y un mundo que no lo enseñe invita a
      // confundirlo con apto.
      aptitud: cuentaAptitudes(marcas),
      bordillosDeNodo: bordillos.size,
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
      // Y su marca de aptitud, por lo mismo: los cuatro criterios con uno de los
      // tres valores, o error de construcción. Un criterio que falta no es un «no
      // lo sé», es una pieza que se perdió por el camino.
      validaAptitud(arista.aptitud, `la arista ${id} ↔ ${arista.hasta}`);
    }
  }
  return grafo;
}

/** Cómo se llama en un mensaje de error lo que ha llegado donde iba el grafo. */
function describe(valor) {
  if (valor === null) return 'null';
  if (valor === undefined) return 'undefined';
  if (Array.isArray(valor)) return `una lista de ${valor.length} vías`;
  if (typeof valor !== 'object') return `un ${typeof valor}`;
  return `un objeto sin adj (claves: ${Object.keys(valor).join(', ') || 'ninguna'})`;
}

/**
 * El grafo viario ya construido, o un error que nombra lo que ha llegado.
 *
 * **Exige el grafo y no lo construye**, y es deliberado. Aceptar también la lista
 * de vías hacía que pasar `geo.roads` donde iba el grafo cosido no fallara nunca:
 * degradaba en silencio a un grafo pobre, construido tres veces y sin el callejero.
 * El mismo cableado a medias apareció tres veces en una semana y las tres pasó por
 * verde. Es el mismo criterio que la marca de suposición de las aristas: con un
 * contrato opcional, «lo he perdido» y «nunca lo tuve» son indistinguibles.
 */
export function exigeGrafo(grafo) {
  if (grafo && !Array.isArray(grafo) && grafo.adj instanceof Map) return grafo;
  throw new Error(
    `se esperaba el grafo viario ya construido y ha llegado ${describe(grafo)}: ` +
    'constrúyelo una sola vez por celda con construyeGrafo(vias) y pásalo a las fases que lo usan',
  );
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
export function pegarAViario(puntos, grafoViario, maxMove = MOVER_MAX) {
  const grafo = exigeGrafo(grafoViario);
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
    // `md` sale de `dist` y ya está en la rejilla de precisión: redondear aquí otra
    // vez sería inventarse un segundo criterio de redondeo.
    movidos.push({ punto: p, metros: md });
    p.x = q.x;
    p.y = q.y;
  }
  return movidos;
}
