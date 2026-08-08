// El filtro de la salida: los caminos que quien juega dice que evita entran aquí,
// al trazar el lazo, y en ningún otro sitio.
//
// **Evita y declara, nunca borra.** El grafo conserva todas sus aristas y el mapa
// se dibuja entero (`game-design/accesibilidad.md` §2); lo único que cambia es por
// dónde te mandan. Y cuando no hay por dónde rodear —o rodear cuesta más de lo que
// vale—, se pasa por ahí y se dice con nombre propio y motivo concreto, porque tú
// sabes de tu barrio más que OSM.
//
// Es la otra mitad de `world/aptitud.js`, y la separación es lo que hace compatible
// «el mundo entero existe» con «lo generado no se resiembra»: la marca es del mundo
// y se calcula al generar la celda; los criterios son de quien juega y entran aquí.

import { comparaNodo, exigeGrafo, nodoMasCercano, SNAP_MAX, SUPOSICIONES } from '../world/grafo.js';
import { APTITUDES, APTITUD_SUPUESTA, CRITERIOS, MOTIVOS_POR_CRITERIO, MOTIVO_DE_SUPOSICION } from '../world/aptitud.js';
import { dist } from '../core/geo.js';
import { exigeTramoM } from './tramo.js';

export { CRITERIOS, MOTIVOS_POR_CRITERIO, MOTIVO_DE_SUPOSICION };

/**
 * Cuánto puede alargar un lazo el rodeo, medido **en tramos de quien juega** y no
 * en metros: un tope en metros absolutos significa cosas distintas para dos
 * personas, por la misma razón que los cupos se reexpresan en tramos.
 *
 * Y va en la dirección que parece contraintuitiva: pasado el tope se usa la ruta
 * corta **y se declara**, porque un rodeo de dos kilómetros para esquivar tres
 * escalones es peor respuesta que decir la verdad y dejar decidir.
 */
export const TOPE_DE_RODEO_EN_TRAMOS = 0.5;

/**
 * Por qué no hay reparto. Vive aquí porque el trazado ya puede devolver uno de los
 * tres —un mundo sin viario no es un error, es una respuesta— y dos catálogos de
 * motivos se desincronizarían.
 */
export const MOTIVOS_DE_FALTA = Object.freeze({
  /** Los criterios han dejado el mundo sin ni un lazo que quepa. */
  FILTRO: 'filtro',
  /** El mundo es pequeño, y decir «es por tus ajustes» sería mentir. */
  MUNDO: 'mundo',
  /** No hay callejero con el que trazar nada. */
  SIN_VIARIO: 'sin-viario',
});

/**
 * El conjunto de criterios, normalizado: sin repetidos y en el orden del catálogo.
 *
 * Se ordena para que el orden de llegada no cambie el resultado — es la misma regla
 * que impide recorrer un `Set` por orden de inserción — y un criterio desconocido
 * falla nombrándolo y enumerando los válidos, en vez de ignorarse en silencio y
 * dejar a alguien creyendo que evita algo.
 */
export function normalizaCriterios(criterios) {
  if (criterios == null) return [];
  const lista = Array.isArray(criterios) ? criterios : [...criterios];
  const vistos = new Set();
  for (const c of lista) {
    if (!CRITERIOS.includes(c)) {
      throw new Error(`criterio desconocido ${JSON.stringify(c)}: los cuatro declarados son ${CRITERIOS.join(', ')}`);
    }
    vistos.add(c);
  }
  return CRITERIOS.filter((c) => vistos.has(c));
}

/**
 * El primer criterio activo por el que un tramo no es apto, o null.
 *
 * «Primero» es el orden del catálogo y no el de llegada: con dos criterios
 * incumplidos, el motivo que se declara tiene que ser el mismo en dos ejecuciones.
 */
export function motivoNoApto(aptitud, criterios) {
  for (const c of criterios) {
    if (aptitud?.[c] === APTITUDES.NO_APTO) return MOTIVOS_POR_CRITERIO[c];
  }
  return null;
}

function noSeSabeAlgo(aptitud, criterios) {
  for (const c of criterios) if (aptitud?.[c] === APTITUDES.NO_SE_SABE) return true;
  return false;
}

/**
 * El coste de una arista: `[tramos no aptos, tramos en «no se sabe», metros]`.
 *
 * La elección es **lexicográfica y no una penalización con constantes**: primero
 * menos tramos no aptos, después menos «no se sabe», y solo entonces más corta. Con
 * un factor multiplicativo la garantía dependería del número elegido y no se podría
 * afirmar en una prueba; el orden sí se afirma.
 */
function costeDeArista(arista, criterios) {
  if (!criterios.length) return [0, 0, arista.metros];
  if (motivoNoApto(arista.aptitud, criterios)) return [1, 0, arista.metros];
  return [0, noSeSabeAlgo(arista.aptitud, criterios) ? 1 : 0, arista.metros];
}

const suma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const compara = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

// Montículo con comparador: el de `grafo.js` ordena por un número y aquí el coste
// es un vector de tres. No se generaliza aquel para no tocar el camino que ya usan
// el trazado de calzadas y el enlace de parajes.
class Monticulo {
  constructor() { this.a = []; }
  push(coste, id) {
    const a = this.a;
    a.push([coste, id]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (compara(a[p][0], a[i][0]) <= 0) break;
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
        if (l < a.length && compara(a[l][0], a[m][0]) < 0) m = l;
        if (r < a.length && compara(a[r][0], a[m][0]) < 0) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

/**
 * El camino de coste lexicográfico mínimo entre dos nodos, o null si no hay
 * ninguno. Devuelve también qué arista se usó en cada paso: con aristas paralelas,
 * reconstruir el camino preguntando cuál es «la mejor» daría otra distinta de la
 * que se recorrió.
 *
 * El empate lo rompe el identificador del nodo anterior y no el orden de la lista
 * de adyacencia: dos callejeros con los mismos datos en otro orden tienen que dar
 * la misma ruta.
 */
function caminoMinimo(grafo, src, dst, criterios) {
  const coste = new Map([[src, [0, 0, 0]]]);
  const previo = new Map();
  const porDonde = new Map();
  const monticulo = new Monticulo();
  monticulo.push([0, 0, 0], src);
  while (monticulo.size) {
    const [cu, u] = monticulo.pop();
    const actual = coste.get(u);
    if (actual && compara(cu, actual) > 0) continue;
    for (const arista of grafo.adj.get(u) ?? []) {
      const nuevo = suma(cu, costeDeArista(arista, criterios));
      const previoCoste = coste.get(arista.hasta);
      const cmp = previoCoste === undefined ? -1 : compara(nuevo, previoCoste);
      if (cmp < 0) {
        coste.set(arista.hasta, nuevo);
        previo.set(arista.hasta, u);
        porDonde.set(arista.hasta, arista);
        monticulo.push(nuevo, arista.hasta);
      } else if (cmp === 0 && comparaNodo(u, previo.get(arista.hasta)) < 0) {
        // mismo coste: gana el nodo anterior menor, que no depende del orden de
        // llegada de los ways. No se reencola: el coste no ha mejorado.
        previo.set(arista.hasta, u);
        porDonde.set(arista.hasta, arista);
      }
    }
  }
  if (!coste.has(dst)) return null;

  const nodos = [dst];
  const aristas = [];
  let cur = dst;
  while (cur !== src) {
    aristas.push(porDonde.get(cur));
    cur = previo.get(cur);
    if (cur == null) return null;
    nodos.push(cur);
  }
  nodos.reverse();
  aristas.reverse();
  return { nodos, aristas, coste: coste.get(dst) };
}

/** La clave de una arista sin dirección: es la identidad del tramo, ida o vuelta. */
const claveDeTramo = (a, b) => (comparaNodo(a, b) <= 0 ? `${a}|${b}` : `${b}|${a}`);

function tramosDelCamino(grafo, camino) {
  const tramos = [];
  for (let i = 0; i < camino.nodos.length - 1; i++) {
    const a = camino.nodos[i], b = camino.nodos[i + 1];
    const arista = camino.aristas[i];
    const pa = grafo.coord.get(a), pb = grafo.coord.get(b);
    tramos.push({
      desde: { x: pa.x, y: pa.y },
      hasta: { x: pb.x, y: pb.y },
      nodos: [a, b],
      clave: claveDeTramo(a, b),
      metros: arista.metros,
      suposicion: arista.suposicion,
      rasgo: arista.rasgo ?? null,
      nombre: arista.nombre ?? null,
      aptitud: arista.aptitud,
    });
  }
  return tramos;
}

/** El tramo recto de un salto que el grafo no sabe resolver: suposición nuestra, como en las calzadas. */
function tramoRecto(desde, hasta) {
  return {
    desde: { x: desde.x, y: desde.y },
    hasta: { x: hasta.x, y: hasta.y },
    nodos: [],
    clave: `recta|${Math.round(desde.x)},${Math.round(desde.y)}|${Math.round(hasta.x)},${Math.round(hasta.y)}`,
    metros: dist(desde, hasta),
    suposicion: SUPOSICIONES.FALLBACK,
    rasgo: null,
    nombre: null,
    // Una recta por donde no hay camino es suposición nuestra de la primera a la
    // última: no se promete apta en ninguno de los cuatro criterios.
    aptitud: APTITUD_SUPUESTA,
  };
}

// Un salto del lazo, resuelto de las dos maneras: como si no hubiera criterios y
// con ellos. Las dos hacen falta siempre —la primera es la referencia contra la que
// se mide el rodeo y de la que salen los tramos evitados—, y con la lista de
// criterios vacía son literalmente la misma, que es lo que hace que un jugador sin
// nada marcado reciba exactamente la ruta de siempre.
function resuelveSalto(grafo, a, b, criterios) {
  const na = nodoMasCercano(grafo, a, SNAP_MAX);
  const nb = nodoMasCercano(grafo, b, SNAP_MAX);
  const recta = () => ({ tramos: [tramoRecto(a, b)], puntos: [{ x: b.x, y: b.y }], nodos: [] });
  if (na == null || nb == null) return { corto: recta(), filtrado: recta() };
  if (na === nb) {
    const vacio = { tramos: [], puntos: [{ x: b.x, y: b.y }], nodos: [] };
    return { corto: vacio, filtrado: vacio };
  }

  const arma = (camino) => {
    if (!camino) return recta();
    const tramos = tramosDelCamino(grafo, camino);
    const puntos = camino.nodos.map((id) => ({ x: grafo.coord.get(id).x, y: grafo.coord.get(id).y }));
    return { tramos, puntos: [...puntos, { x: b.x, y: b.y }], nodos: camino.nodos };
  };

  const corto = arma(caminoMinimo(grafo, na, nb, []));
  const filtrado = criterios.length ? arma(caminoMinimo(grafo, na, nb, criterios)) : corto;
  return { corto, filtrado };
}

const metrosDe = (salto) => salto.tramos.reduce((t, x) => t + x.metros, 0);

/**
 * Traza el lazo de una salida sobre el grafo de la celda, aplicando los criterios.
 *
 * @param {object} opciones
 *   `grafo` el grafo viario ya construido y marcado; `puntos` los lugares por los
 *   que pasa el lazo, en orden; `criterios` los caminos que se evitan, que llegan
 *   **inyectados** desde los ajustes y no se leen de ningún almacén; `tramo` el
 *   tramo personal, del que sale el tope de rodeo; `cerrado` cierra el lazo sobre
 *   su primer punto, que es lo que hace que un lazo sea un lazo.
 * @returns `{ trazado: true, recorrido, tramos, metros, ... , declaraciones }` con
 *   sus **dos listas de declaración siempre presentes**, vacías cuando no hay nada
 *   que declarar; o `{ trazado: false, hayReparto: false, motivo }` cuando no hay
 *   viario con el que trazar, que es una respuesta y no un error.
 */
export function trazaLazo({ grafo, puntos, criterios = [], tramo = null, cerrado = true }) {
  const viario = exigeGrafo(grafo);
  // Los criterios se validan antes que nada: uno desconocido es un error de
  // construcción de quien llama, no una particularidad de este mundo.
  const activos = normalizaCriterios(criterios);
  // Sin tramo no hay tope de rodeo, y suponer uno sería decidir por quien juega
  // cuánto le compensa rodear. Sin criterios no hace falta: no se rodea nada.
  const tramoM = activos.length ? exigeTramoM(tramo, 'el trazado del lazo con caminos que evitar') : null;

  if (!viario.nodeIds.length) {
    return { trazado: false, hayReparto: false, motivo: MOTIVOS_DE_FALTA.SIN_VIARIO, criterios: activos };
  }

  const lugares = (puntos ?? []).map((p) => ({ x: p.x, y: p.y }));
  if (lugares.length && cerrado) {
    const primero = lugares[0], ultimo = lugares[lugares.length - 1];
    if (primero.x !== ultimo.x || primero.y !== ultimo.y) lugares.push({ ...primero });
  }
  if (lugares.length < 2) {
    return {
      trazado: true,
      criterios: activos,
      recorrido: lugares,
      tramos: [],
      metros: 0,
      metrosSinCriterios: 0,
      rodeoM: 0,
      rodeoDescartadoM: 0,
      topeDeRodeoM: tramoM == null ? null : TOPE_DE_RODEO_EN_TRAMOS * tramoM,
      rodeoDentroDelTope: true,
      declaraciones: { caminos: [], noPrometidos: [] },
    };
  }

  const saltos = [];
  for (let i = 0; i < lugares.length - 1; i++) saltos.push(resuelveSalto(viario, lugares[i], lugares[i + 1], activos));

  const metrosCortos = saltos.reduce((t, s) => t + metrosDe(s.corto), 0);
  const metrosFiltrados = saltos.reduce((t, s) => t + metrosDe(s.filtrado), 0);
  const topeDeRodeoM = tramoM == null ? null : TOPE_DE_RODEO_EN_TRAMOS * tramoM;
  const rodeoM = metrosFiltrados - metrosCortos;
  // El tope se mide sobre el lazo entero y no sobre cada salto: lo que alarga la
  // salida es la suma, y medir por salto dejaría pasar diez rodeos pequeños.
  const rodeoDentroDelTope = topeDeRodeoM == null || rodeoM <= topeDeRodeoM;
  const elegidos = saltos.map((s) => (rodeoDentroDelTope ? s.filtrado : s.corto));

  // El recorrido y, con él, en qué posición del recorrido está cada nodo: es lo que
  // permite decir dónde se separa la ruta de lo que evita, y por tanto dónde se
  // puede ofrecer el desvío.
  const recorrido = [lugares[0]];
  const tramos = [];
  const indiceDeNodo = new Map();
  const inicioDeSalto = [];
  for (let i = 0; i < elegidos.length; i++) {
    inicioDeSalto.push(recorrido.length - 1);
    const salto = elegidos[i];
    for (let k = 0; k < salto.puntos.length; k++) {
      const indice = recorrido.length;
      recorrido.push(salto.puntos[k]);
      const nodo = salto.nodos[k];
      if (nodo != null && !indiceDeNodo.has(nodo)) indiceDeNodo.set(nodo, indice);
    }
    tramos.push(...salto.tramos);
  }

  const declaraciones = declara({ saltos, elegidos, criterios: activos, indiceDeNodo, inicioDeSalto });

  return {
    trazado: true,
    criterios: activos,
    recorrido,
    tramos,
    metros: rodeoDentroDelTope ? metrosFiltrados : metrosCortos,
    // La ruta de siempre, para poder decir cuánto ha costado el rodeo sin volver a
    // trazar. Con la lista de criterios vacía es exactamente la misma.
    metrosSinCriterios: metrosCortos,
    rodeoM: rodeoDentroDelTope ? rodeoM : 0,
    // Lo que habría costado rodear cuando se ha decidido no hacerlo: se declara en
    // vez de descartarse en silencio, que es de lo que va toda esta capa.
    rodeoDescartadoM: rodeoDentroDelTope ? 0 : rodeoM,
    topeDeRodeoM,
    rodeoDentroDelTope,
    declaraciones,
  };
}

/**
 * Las dos listas de declaración de un lazo ya elegido.
 *
 * `caminos` lleva los tramos difíciles: los que se han **evitado** y los que se han
 * atravesado a la fuerza porque no había rodeo o porque rodear se pasaba del tope.
 * Los dos se declaran igual —nombre propio, motivo en clave y el punto del
 * recorrido donde la cosa ocurre— y se distinguen por `evitado`. `noPrometidos`
 * lleva lo que nos inventamos nosotros, que no es difícil: es que no lo sabemos.
 */
function declara({ saltos, elegidos, criterios, indiceDeNodo, inicioDeSalto }) {
  const caminos = [];
  const noPrometidos = [];
  const enElLazo = new Set();
  for (const salto of elegidos) for (const t of salto.tramos) enElLazo.add(t.clave);

  for (let i = 0; i < elegidos.length; i++) {
    // Un tramo sin nodos —la recta de donde no hay camino— se sitúa donde arranca
    // el salto: es lo único que se puede decir de él con verdad.
    const arranque = inicioDeSalto[i];
    // Lo atravesado, en el orden en que se pisa.
    for (const t of elegidos[i].tramos) {
      const donde = {
        indice: (t.nodos.length ? indiceDeNodo.get(t.nodos[0]) : undefined) ?? arranque,
        punto: { x: t.desde.x, y: t.desde.y },
      };
      const motivo = motivoNoApto(t.aptitud, criterios);
      if (motivo) caminos.push(declaraCamino(t, motivo, false, donde));
      if (t.suposicion !== SUPOSICIONES.NINGUNA) {
        noPrometidos.push({
          // Un tramo cosido no tiene nombre propio porque no es un camino de OSM:
          // es un hueco que hemos cruzado nosotros, y se declara por lo que es. Por
          // eso aquí no se exige nombre y en un camino difícil sí.
          nombre: t.nombre ?? null,
          motivo: MOTIVO_DE_SUPOSICION,
          suposicion: t.suposicion,
          punto: donde.punto,
          indice: donde.indice,
          metros: t.metros,
        });
      }
    }

    // Y lo evitado: lo que la ruta corta habría pisado y esta no pisa.
    const corta = saltos[i].corto.tramos;
    for (let k = 0; k < corta.length; k++) {
      const t = corta[k];
      if (enElLazo.has(t.clave)) continue;
      const motivo = motivoNoApto(t.aptitud, criterios);
      if (!motivo) continue;
      caminos.push(declaraCamino(t, motivo, true, separacion(corta, k, indiceDeNodo, inicioDeSalto[i])));
    }
  }

  return { caminos, noPrometidos };
}

// Dónde se separa la ruta de lo que evita: el último nodo que las dos comparten
// antes del tramo evitado. Es lo que permite ofrecer el desvío donde toca y no al
// principio del lazo.
function separacion(corta, k, indiceDeNodo, porDefecto) {
  for (let j = k; j >= 0; j--) {
    const indice = indiceDeNodo.get(corta[j].nodos[0]);
    if (indice !== undefined) return { indice, punto: { x: corta[j].desde.x, y: corta[j].desde.y } };
  }
  return { indice: porDefecto, punto: { x: corta[0].desde.x, y: corta[0].desde.y } };
}

function declaraCamino(tramo, motivo, evitado, donde) {
  if (!tramo.nombre) {
    // Falla en vez de declarar «un tramo del camino». Una declaración anónima no
    // se puede ofrecer ni discutir, y sobre todo incumple en silencio: el camino
    // difícil hay que poder nombrarlo (`accesibilidad.md` §2). Nombrar todo tramo
    // difícil al generar el mundo es de la fila del grafo, no de aquí.
    const [a, b] = tramo.nodos;
    throw new Error(
      `el tramo ${a} ↔ ${b} (${Math.round(tramo.desde.x)},${Math.round(tramo.desde.y)} → ` +
      `${Math.round(tramo.hasta.x)},${Math.round(tramo.hasta.y)}) no tiene nombre propio en el grafo y hay que ` +
      `declararlo por "${motivo}": un camino que no se puede nombrar no se declara a medias`,
    );
  }
  return {
    nombre: tramo.nombre,
    motivo,
    // Evitado o atravesado a la fuerza: se declaran los dos y con la misma forma,
    // porque los dos son información para decidir. Lo que cambia es este campo.
    evitado,
    // Dónde ocurre: en lo evitado, el punto en que la ruta se separa de lo que
    // esquiva —que es donde se puede ofrecer el desvío—; en lo atravesado, dónde
    // empieza el tramo.
    punto: donde.punto,
    indice: donde.indice,
    metros: tramo.metros,
  };
}
