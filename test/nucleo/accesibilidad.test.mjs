// SPEC-008 · El filtro sobre el grafo: evita y declara, nunca borra.
//
// Lo que se afirma aquí es que el mundo entero sigue existiendo con el filtro puesto
// —el grafo conserva todas sus aristas y el mapa se dibuja igual—, que lo único que
// cambia es por dónde te mandan, que lo que no se puede rodear se atraviesa y se
// dice con nombre propio y motivo en clave, y que los tres estados de cada criterio
// son tres de verdad: colapsar «no se sabe» a apto es convertir el silencio de OSM
// en una promesa, y por este mundo se camina.
//
// Los casos que salen de docs/testing.md llevan su nombre literal; los demás van
// marcados como hueco de la batería en test/spec-test-map.json.
//
// Los datos son de dos clases a propósito. Sintéticos cuando hace falta una
// geometría exacta —ningún fixture trae una escalera con un rodeo de longitud
// elegida— y los cuatro mundos congelados de SPEC-001 cuando lo que se mide es el
// dato real de OSM. Y hay un tercer caso, que se declara en vez de disimularse: los
// **bordillos no se pueden verificar sobre dato real**, porque los cuatro fixtures
// se capturaron pidiendo solo ways y en OSM el bordillo vive en el nodo del cruce.
// Ese criterio se prueba sintético y su límite tiene caso propio abajo.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import { LOS_CUATRO, fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

import {
  ANCHURA_MINIMA_M,
  APTITUDES,
  APTITUD_SUPUESTA,
  CRITERIOS,
  MOTIVOS,
  MOTIVOS_POR_CRITERIO,
  MOTIVO_DE_SUPOSICION,
  TAGS_QUE_HACEN_FALTA,
  VALORES_DE_APTITUD,
  aptitudDeVia,
  cuentaAptitudes,
  interpretaMetros,
  validaAptitud,
} from '../../packages/nucleo/world/aptitud.js';
import { SUPOSICIONES, aristaEntre, construyeGrafo, tramosDificilesSinNombre, validaGrafo } from '../../packages/nucleo/world/grafo.js';
import { parseBordillos, parseStreets } from '../../packages/nucleo/world/osm.js';
import {
  MOTIVOS_DE_FALTA,
  TOPE_DE_RODEO_EN_TRAMOS,
  normalizaCriterios,
  trazaLazo,
} from '../../packages/nucleo/partida/filtro.js';
import { TRAMOS_DEL_ESTIRON, aceptaElEstiron, repartoDeAventuras } from '../../packages/nucleo/partida/aventuras.js';

// ── Andamiaje sintético ─────────────────────────────────────────────────────────

/** Una vía sintética: identificadores de nodo de OSM, puntos en metros y sus tags. */
function via(nodes, puntos, extra = {}) {
  return { pts: puntos.map(([x, y]) => ({ x, y })), nodes, ...extra };
}

/** Todas las aristas del grafo, una vez por par de nodos y en orden estable. */
function aristasUnicas(grafo) {
  const out = [];
  const vistas = new Set();
  for (const id of grafo.nodeIds) {
    for (const a of grafo.adj.get(id) ?? []) {
      const clave = String(id) < String(a.hasta) ? `${id}|${a.hasta}` : `${a.hasta}|${id}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      out.push({ desde: id, hasta: a.hasta, ...a });
    }
  }
  return out;
}

/**
 * La huella de un grafo: nodos, coordenadas y aristas con su marca, en texto.
 *
 * Es lo que permite afirmar «esto no se ha resembrado» comparando antes y después
 * sin comparar objetos con Maps dentro, que serializados dan `{}` y harían pasar
 * cualquier regresión.
 */
function huellaDelGrafo(grafo) {
  const nodos = grafo.nodeIds.map((id) => `${id}@${grafo.coord.get(id).x.toFixed(3)},${grafo.coord.get(id).y.toFixed(3)}`);
  const aristas = aristasUnicas(grafo).map((a) => `${a.desde}|${a.hasta}|${a.metros.toFixed(3)}|${a.nombre}|${a.suposicion}|${JSON.stringify(a.aptitud)}`);
  return JSON.stringify({ nodos, aristas, informe: grafo.informe });
}

const ASFALTO = { highway: 'residential', surface: 'asphalt' };
const SIN_FIRME = { highway: 'residential' };
const ESCALERA = { highway: 'steps' };

const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

/**
 * El grafo del desempate: cuatro maneras de ir del nodo 1 al 2, elegidas para que
 * el orden lexicográfico se pueda leer del resultado y no de una constante.
 *
 *   directo (escalera)   300,0 m · escalones no apto
 *   por 12 (sin firme)   302,7 m · firme en «no se sabe»
 *   por 11 (asfalto)     316,2 m · los cuatro criterios afirmados o irrelevantes
 *   por 10 (asfalto)     500,0 m
 */
function grafoDelDesempate() {
  return construyeGrafo([
    via([1, 2], [[0, 0], [300, 0]], { name: 'A Escalinata do Souto', filtrables: ESCALERA }),
    via([1, 10, 2], [[0, 0], [150, 200], [300, 0]], { name: 'Rúa Longa', filtrables: ASFALTO }),
    via([1, 11, 2], [[0, 0], [150, 50], [300, 0]], { name: 'Rúa do Medio', filtrables: ASFALTO }),
    via([1, 12, 2], [[0, 0], [150, 20], [300, 0]], { name: 'Corredoira Vella', filtrables: SIN_FIRME }),
  ]);
}

const EXTREMOS = [{ x: 0, y: 0 }, { x: 300, y: 0 }];

/** El grafo del tope: una escalera de 100 m y un rodeo de 1000 m para esquivarla. */
function grafoDelTope() {
  const h = Math.sqrt(247500); // 2·√(50² + h²) = 1000 m clavados
  return construyeGrafo([
    via([1, 2], [[0, 0], [100, 0]], { name: 'A Escalinata do Muíño', filtrables: ESCALERA }),
    via([1, 40, 2], [[0, 0], [50, h], [100, 0]], { name: 'Rúa do Rodeo', filtrables: ASFALTO }),
  ]);
}

/**
 * El mundo sintético donde el filtro deja el reparto sin ni un lazo que quepa.
 *
 * Con un tramo de 200 m el alcance de una aventura son 800 m: el lazo corto mide
 * 760 y cabe, el rodeo mide 840 y no, y el rodeo entero (80 m) está por debajo del
 * tope. Es el único caso en el que la falta de reparto se puede atribuir al filtro
 * sin mentir, y por eso hace falta construirlo: ningún fixture lo produce.
 */
function mundoSinRepartoPorElFiltro() {
  const h = Math.sqrt(8000); // 2·√(190² + h²) = 420 m por salto
  const viario = construyeGrafo([
    via([1, 2], [[0, 0], [380, 0]], { name: 'A Escalinata da Fonte', filtrables: ESCALERA }),
    via([1, 30, 2], [[0, 0], [190, h], [380, 0]], { name: 'Rúa do Rodeo', filtrables: ASFALTO }),
  ]);
  const casting = [{ ok: true, tpl: { id: 'la-que-no-cabe' }, beats: [{ lugar: { x: 0, y: 0 } }, { lugar: { x: 380, y: 0 } }] }];
  return { viario, casting };
}

const TRAMO_DEL_MUNDO_SIN_REPARTO = 200;

// ── Los tags, los cuatro criterios y el tercer estado ────────────────────────────

describe('Los tags que hacen falta y los cuatro criterios', () => {
  test('La consulta de callejero pide los tags de las vías y los nodos de bordillo', () => {
    // El transporte de Overpass es del prototipo web, que SPEC-020 mudó de app/ a
    // prototipo/. Solo cambia dónde está el fichero: la consulta es la misma.
    const texto = fuente('prototipo/js/data/overpass.js');
    const consulta = texto.split('export async function fetchStreets')[1];
    assert.ok(consulta, 'no hay consulta de callejero que inspeccionar');
    assert.match(consulta, /node\["kerb"\]/, 'la consulta no pide los nodos con kerb, que es donde OSM mapea los bordillos');
    assert.match(consulta, /node\["barrier"="kerb"\]/, 'la consulta no pide los nodos con barrier=kerb');
    assert.match(consulta, /out geom/, 'sin "out geom" la respuesta no trae ni geometría ni tags de las vías');
    assert.match(consulta, /steps/, 'la consulta de callejero no pide las escaleras: sin ellas el criterio de escalones no ve nada');
  });

  test('Cada tramo del grafo conserva los tags de accesibilidad de su vía de origen', () => {
    const json = {
      elements: [{
        type: 'way',
        id: 7,
        nodes: [1, 2],
        geometry: [{ lat: 42.4, lon: -8.8 }, { lat: 42.401, lon: -8.8 }],
        tags: { highway: 'footway', surface: 'gravel', smoothness: 'bad', width: '0,9 m', kerb: 'raised', wheelchair: 'limited', name: 'A Corredoira', incline: '12%' },
      }],
    };
    const [calle] = parseStreets(json, 42.4, -8.8);
    for (const tag of TAGS_QUE_HACEN_FALTA) {
      assert.ok(calle.filtrables[tag] !== undefined, `el parseo tira el tag "${tag}", y sin él el marcado no tiene de qué salir`);
    }
    const grafo = construyeGrafo([calle]);
    const arista = aristaEntre(grafo, 1, 2);
    assert.deepEqual(arista.aptitud, aptitudDeVia(calle.filtrables), 'la arista no lleva la marca de los tags de su vía');
  });

  test('La anchura con unidad se interpreta en metros y la que no es un número se trata como si no viniera', () => {
    assert.equal(interpretaMetros('0.9 m'), 0.9);
    assert.equal(interpretaMetros('0,9 m'), 0.9);
    assert.equal(interpretaMetros('90 cm'), 0.9);
    assert.equal(interpretaMetros('1.2'), 1.2, 'sin unidad son metros, que es lo que documenta OSM');
    for (const raro of ['narrow', '1;2', '', 'ancho', '-3', null, undefined, {}]) {
      assert.equal(interpretaMetros(raro), null, `"${JSON.stringify(raro)}" no es un número interpretable y no se puede convertir en anchura`);
    }
    assert.equal(aptitudDeVia({ highway: 'footway', width: 'narrow' }).paso, APTITUDES.NO_SE_SABE, 'una anchura ilegible se ha leído como estrecha');
    assert.equal(aptitudDeVia({ highway: 'footway', width: '80 cm' }).paso, APTITUDES.NO_APTO);
    assert.equal(aptitudDeVia({ highway: 'footway', width: `${ANCHURA_MINIMA_M} m` }).paso, APTITUDES.APTO);
  });

  test('Los cuatro criterios tienen tres valores y la ausencia de tag solo afirma en escalones', () => {
    assert.deepEqual(CRITERIOS, ['escalones', 'firme', 'bordillos', 'paso']);
    assert.deepEqual(VALORES_DE_APTITUD, [APTITUDES.APTO, APTITUDES.NO_APTO, APTITUDES.NO_SE_SABE]);

    assert.equal(aptitudDeVia(ESCALERA).escalones, APTITUDES.NO_APTO);
    assert.equal(aptitudDeVia({ highway: 'residential' }).escalones, APTITUDES.APTO, 'una vía que no es steps no tiene escalones');

    assert.equal(aptitudDeVia({ highway: 'path', surface: 'asphalt' }).firme, APTITUDES.APTO);
    assert.equal(aptitudDeVia({ highway: 'path', smoothness: 'good' }).firme, APTITUDES.APTO);
    assert.equal(aptitudDeVia({ highway: 'path', surface: 'ground' }).firme, APTITUDES.NO_APTO);
    assert.equal(aptitudDeVia({ highway: 'path', smoothness: 'horrible' }).firme, APTITUDES.NO_APTO);
    assert.equal(aptitudDeVia({ highway: 'path' }).firme, APTITUDES.NO_SE_SABE, 'sin surface ni smoothness el firme no se sabe, y no se presume');
    assert.equal(aptitudDeVia({ highway: 'path', surface: 'compacted' }).firme, APTITUDES.NO_SE_SABE, 'un valor que no está en ninguna de las dos listas no puede inventar aptitud');
    assert.equal(aptitudDeVia({ highway: 'path', smoothness: 'intermediate' }).firme, APTITUDES.NO_SE_SABE);

    assert.equal(aptitudDeVia({ highway: 'footway', kerb: 'flush' }).bordillos, APTITUDES.APTO);
    assert.equal(aptitudDeVia({ highway: 'footway', kerb: 'lowered' }).bordillos, APTITUDES.APTO);
    assert.equal(aptitudDeVia({ highway: 'footway', kerb: 'raised' }).bordillos, APTITUDES.NO_APTO);
    assert.equal(aptitudDeVia({ highway: 'footway', 'kerb:height': '0.02' }).bordillos, APTITUDES.APTO);
    assert.equal(aptitudDeVia({ highway: 'footway', 'kerb:height': '12 cm' }).bordillos, APTITUDES.NO_APTO);
    assert.equal(aptitudDeVia({ highway: 'footway' }).bordillos, APTITUDES.NO_SE_SABE, 'sin dato de bordillo no hay bordillo que prometer');
    assert.equal(aptitudDeVia({ highway: 'footway', kerb: 'yes' }).bordillos, APTITUDES.NO_SE_SABE, 'kerb=yes dice que hay bordillo y calla su altura');

    assert.equal(aptitudDeVia({ highway: 'footway', wheelchair: 'no' }).paso, APTITUDES.NO_APTO);
    assert.equal(aptitudDeVia({ highway: 'footway', wheelchair: 'yes' }).paso, APTITUDES.APTO);
    assert.equal(aptitudDeVia({ highway: 'footway', wheelchair: 'limited' }).paso, APTITUDES.NO_SE_SABE, '«con condiciones» no es una negativa: convertirlo decide por quien juega');
    assert.equal(aptitudDeVia({ highway: 'footway' }).paso, APTITUDES.NO_SE_SABE);

    // Y ninguna marca sale a medias: los cuatro criterios, siempre, con uno de tres.
    for (const tags of [{}, ESCALERA, ASFALTO, SIN_FIRME, { highway: 'footway', surface: 'sett', wheelchair: 'designated' }]) {
      assert.doesNotThrow(() => validaAptitud(aptitudDeVia(tags)));
      assert.deepEqual(Object.keys(aptitudDeVia(tags)).sort(), [...CRITERIOS].sort());
    }
    for (const rota of [null, {}, { escalones: 'apto' }, { escalones: 'quizá', firme: 'apto', bordillos: 'apto', paso: 'apto' }]) {
      assert.throws(() => validaAptitud(rota, 'la arista de prueba'), /la arista de prueba/, 'una marca a medias tiene que fallar nombrando lo que falta');
    }
  });

  test('El bordillo del nodo del cruce baja a las dos aristas que lo tocan', () => {
    // Sintético y no de fixture a propósito: los cuatro mundos congelados se
    // capturaron pidiendo solo ways, así que no traen ni un nodo de bordillo. El
    // límite tiene caso propio más abajo.
    const json = {
      elements: [
        { type: 'node', id: 2, lat: 42.4005, lon: -8.8, tags: { kerb: 'raised' } },
        { type: 'node', id: 3, lat: 42.4006, lon: -8.8, tags: { barrier: 'kerb' } },
      ],
    };
    const bordillos = parseBordillos(json, 42.4, -8.8);
    assert.equal(bordillos.length, 2, 'los nodos de bordillo no se están leyendo de la respuesta del callejero');
    assert.equal(bordillos.find((b) => b.nodo === 2).aptitud, APTITUDES.NO_APTO);
    assert.equal(bordillos.find((b) => b.nodo === 3).aptitud, APTITUDES.NO_SE_SABE, 'barrier=kerb dice que hay bordillo y calla su altura');

    const calle = via([1, 2, 3, 4], [[0, 0], [10, 0], [20, 0], [30, 0]], { name: 'Rúa dos Bordos', filtrables: ASFALTO });
    const grafo = construyeGrafo([calle], { bordillos });
    assert.equal(aristaEntre(grafo, 1, 2).aptitud.bordillos, APTITUDES.NO_APTO, 'el bordillo del nodo 2 no ha bajado a la arista 1↔2');
    assert.equal(aristaEntre(grafo, 2, 3).aptitud.bordillos, APTITUDES.NO_APTO, 'la evidencia negativa tiene que ganar a la que no dice nada');
    assert.equal(aristaEntre(grafo, 3, 4).aptitud.bordillos, APTITUDES.NO_SE_SABE);
    assert.equal(grafo.informe.bordillosDeNodo, 2, 'el informe no declara cuántos bordillos de nodo entraron');

    // Y el orden de llegada de los nodos no cambia el índice: la combinación es
    // conmutativa, que es lo que hace que dos respuestas iguales den el mismo grafo.
    const alReves = construyeGrafo([calle], { bordillos: [...bordillos].reverse() });
    assert.equal(huellaDelGrafo(grafo), huellaDelGrafo(alReves));
  });
});

// ── Evita y declara, nunca borra ────────────────────────────────────────────────

describe('El filtro sobre el grafo evita y declara, nunca borra', () => {
  test('El trazado rodea lo que el filtro evita', async () => {
    const grafo = grafoDelDesempate();
    const antes = huellaDelGrafo(grafo);
    const lazo = trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['escalones', 'firme'], tramo: 2000, cerrado: false });

    assert.equal(lazo.trazado, true);
    assert.equal(lazo.tramos.some((t) => t.nombre === 'A Escalinata do Souto'), false, 'la ruta pasa por las escaleras que se estaban evitando');
    assert.deepEqual(lazo.tramos.map((t) => t.nodos), [[1, 11], [11, 2]], 'la ruta no es la que el orden lexicográfico obliga a elegir');
    assert.ok(cerca(lazo.metrosSinCriterios, 300), 'la ruta corta de referencia no es la de siempre');
    assert.ok(lazo.metros > lazo.metrosSinCriterios, 'rodear tiene que costar metros: si no, no se está rodeando nada');

    // Y las escaleras siguen existiendo: el grafo entero, arista por arista, con su
    // peso real y su marca. Evitar no es borrar.
    assert.equal(huellaDelGrafo(grafo), antes, 'el trazado ha modificado el grafo');
    const escalera = aristaEntre(grafo, 1, 2);
    assert.equal(escalera.metros, 300, 'la arista evitada ha perdido su peso real');
    assert.equal(escalera.aptitud.escalones, APTITUDES.NO_APTO);
    assert.equal(grafo.informe.aristas, 7, 'el grafo ha perdido aristas al filtrar');

    // Sobre dato real, la misma afirmación con números: el mundo con más caminos
    // difíciles de los cuatro congelados conserva todas sus aristas.
    const w = await generaMundo('urbano-denso', semillaDe('urbano-denso', '1'));
    assert.equal(w.grafo.aristas, 14734, 'urbano-denso ya no tiene las 14.734 aristas medidas');
    const noAptas = aristasUnicas(w.viario).filter((a) => CRITERIOS.some((c) => a.aptitud[c] === APTITUDES.NO_APTO));
    assert.equal(noAptas.length, 728, 'urbano-denso ya no tiene las 728 aristas no aptas medidas');
    assert.ok(w.geo.callejero.some((c) => c.filtrables.highway === 'steps'), 'el mundo real ya no trae escaleras que dibujar');
    for (const c of CRITERIOS) {
      const reparto = w.grafo.aptitud[c];
      assert.equal(reparto.apto + reparto.noApto + reparto.noSeSabe, w.grafo.aristas, `el reparto de "${c}" no suma todas las aristas del grafo`);
    }
  });

  test('El camino evitado se declara con nombre propio', () => {
    const grafo = grafoDelDesempate();
    const lazo = trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['escalones', 'firme'], tramo: 2000, cerrado: false });

    assert.equal(lazo.declaraciones.caminos.length, 1, 'el camino evitado no se ha declarado, o se ha declarado dos veces');
    const [declaracion] = lazo.declaraciones.caminos;
    assert.equal(declaracion.nombre, 'A Escalinata do Souto', 'la declaración no trae el nombre propio del camino evitado');
    assert.equal(declaracion.motivo, MOTIVOS_POR_CRITERIO.escalones, 'el motivo no es el de escalones');
    assert.ok(MOTIVOS.includes(declaracion.motivo), 'el motivo no está en el catálogo de motivos en clave');
    assert.equal(/\s/.test(declaracion.motivo), false, 'el motivo llega redactado en vez de en clave: la frase la escribe quien pinta');
    assert.equal(declaracion.evitado, true);
    assert.equal(typeof declaracion.indice, 'number', 'la declaración no dice en qué punto del recorrido la ruta se separa');
    assert.ok(declaracion.indice >= 0 && declaracion.indice < lazo.recorrido.length, 'el punto de separación cae fuera del recorrido');
    assert.deepEqual(declaracion.punto, lazo.recorrido[declaracion.indice], 'el punto declarado no es el del índice que lo acompaña');

    // Y no aparece la palabra en nada de lo que sale de aquí.
    assert.equal(/accesibilidad/i.test(JSON.stringify(lazo)), false, 'la palabra «accesibilidad» ha salido en el lazo entregado');
  });

  test('Lo que nos inventamos no se promete como transitable', () => {
    // Dos vías asfaltadas y anchas separadas 50 m: el cosido las une, y lo cosido
    // no hereda la aptitud de ninguna de las dos.
    const grafo = construyeGrafo([
      via([1, 2], [[0, 0], [100, 0]], { name: 'Rúa da Fonte', filtrables: { ...ASFALTO, width: '4 m', wheelchair: 'yes' } }),
      via([3, 4], [[150, 0], [250, 0]], { name: 'Rúa do Campo', filtrables: { ...ASFALTO, width: '4 m', wheelchair: 'yes' } }),
    ]);
    assert.equal(grafo.informe.cosidas, 1, 'no se ha cosido nada: no se está comprobando nada');
    const cosida = aristaEntre(grafo, 2, 3);
    assert.equal(cosida.suposicion, SUPOSICIONES.COSIDA);
    assert.deepEqual(cosida.aptitud, APTITUD_SUPUESTA, 'lo cosido hereda la aptitud de lo que une');
    for (const c of CRITERIOS) assert.equal(cosida.aptitud[c], APTITUDES.NO_SE_SABE);
    assert.equal(aristaEntre(grafo, 1, 2).aptitud.firme, APTITUDES.APTO, 'las vías que se cosen sí tenían firme afirmado: el contraste es el caso');

    const lazo = trazaLazo({ grafo, puntos: [{ x: 0, y: 0 }, { x: 250, y: 0 }], criterios: CRITERIOS, tramo: 2000, cerrado: false });
    const supuestos = lazo.tramos.filter((t) => t.suposicion !== SUPOSICIONES.NINGUNA);
    assert.ok(supuestos.length > 0, 'el lazo no atraviesa ninguna suposición: no se está comprobando nada');
    for (const t of supuestos) {
      for (const c of CRITERIOS) assert.equal(t.aptitud[c], APTITUDES.NO_SE_SABE, `un tramo de suposición se da por "${t.aptitud[c]}" en "${c}"`);
    }
    assert.equal(lazo.declaraciones.noPrometidos.length, supuestos.length, 'no todos los tramos de suposición llegan declarados');
    for (const n of lazo.declaraciones.noPrometidos) {
      assert.equal(n.motivo, MOTIVO_DE_SUPOSICION, 'lo no prometido se declara con un motivo de camino difícil');
      assert.notEqual(n.motivo, MOTIVOS_POR_CRITERIO.escalones);
      assert.ok([SUPOSICIONES.COSIDA, SUPOSICIONES.FALLBACK].includes(n.suposicion), 'lo no prometido no dice de qué clase de suposición viene');
    }
    assert.deepEqual(lazo.declaraciones.caminos, [], 'nada era no apto aquí: lo supuesto no es difícil, es que no se sabe');

    // Y un lazo entero por donde el grafo no llega: todo él, no prometido.
    const lejos = trazaLazo({ grafo, puntos: [{ x: 100000, y: 0 }, { x: 100300, y: 0 }], criterios: CRITERIOS, tramo: 2000, cerrado: false });
    assert.ok(lejos.tramos.length > 0);
    assert.equal(lejos.tramos.every((t) => t.suposicion === SUPOSICIONES.FALLBACK), true);
    assert.equal(lejos.declaraciones.noPrometidos.length, lejos.tramos.length, 'un lazo trazado entero sobre suposición no llega entero declarado');
  });

  test('El trazado elige por orden lexicográfico y no por una constante de penalización', () => {
    const grafo = grafoDelDesempate();

    // Con firme entre los criterios: gana la asfaltada de 316 m sobre la de 302 sin
    // firme conocido (menos «no se sabe» manda) y sobre la de 500 (a igualdad de
    // estados, la más corta).
    const conFirme = trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['escalones', 'firme'], tramo: 2000, cerrado: false });
    assert.deepEqual(conFirme.tramos.map((t) => t.nodos), [[1, 11], [11, 2]]);
    assert.ok(conFirme.metros > 302.7 && conFirme.metros < 500, 'la ruta elegida no es la del medio: el orden no se está aplicando');

    // Y sin firme entre los criterios, la misma ruta de 302 m vuelve a ser válida:
    // lo que cambia el resultado son los criterios, no una constante escondida.
    const soloEscalones = trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['escalones'], tramo: 2000, cerrado: false });
    assert.deepEqual(soloEscalones.tramos.map((t) => t.nodos), [[1, 12], [12, 2]]);
  });

  test('Pasado el tope, se pasa por el camino difícil y se declara', () => {
    const grafo = grafoDelTope();

    // Tramo de 4 km: el tope son 2 km y el rodeo de 900 m cabe de sobra.
    const rodeando = trazaLazo({ grafo, puntos: [{ x: 0, y: 0 }, { x: 100, y: 0 }], criterios: ['escalones'], tramo: 4000, cerrado: false });
    assert.equal(rodeando.rodeoDentroDelTope, true);
    assert.ok(cerca(rodeando.metros, 1000, 1e-6));
    assert.equal(rodeando.declaraciones.caminos[0].evitado, true);
    assert.equal(rodeando.rodeoDescartadoM, 0);

    // Tramo de 1 km: el tope son 500 m, el rodeo cuesta 900 y no compensa. Se pasa
    // por la escalera y se dice, que es la mitad menos obvia de «evita y declara».
    const pasando = trazaLazo({ grafo, puntos: [{ x: 0, y: 0 }, { x: 100, y: 0 }], criterios: ['escalones'], tramo: 1000, cerrado: false });
    assert.equal(pasando.rodeoDentroDelTope, false);
    assert.equal(pasando.topeDeRodeoM, TOPE_DE_RODEO_EN_TRAMOS * 1000);
    assert.ok(cerca(pasando.metros, 100));
    assert.ok(cerca(pasando.rodeoDescartadoM, 900), 'lo que habría costado rodear no se declara: se ha descartado en silencio');
    assert.equal(pasando.rodeoM, 0);
    assert.deepEqual(pasando.tramos.map((t) => t.nombre), ['A Escalinata do Muíño']);
    assert.equal(pasando.declaraciones.caminos.length, 1);
    assert.deepEqual(
      { nombre: pasando.declaraciones.caminos[0].nombre, motivo: pasando.declaraciones.caminos[0].motivo, evitado: pasando.declaraciones.caminos[0].evitado },
      { nombre: 'A Escalinata do Muíño', motivo: MOTIVOS_POR_CRITERIO.escalones, evitado: false },
      'el tramo atravesado a la fuerza no se declara igual que uno evitado',
    );
  });

  test('El núcleo cuya única salida es una escalera sigue siendo alcanzable', () => {
    const grafo = construyeGrafo([
      via([20, 21], [[0, 0], [80, 0]], { name: 'A Escalinata da Vila', filtrables: ESCALERA }),
      via([21, 22, 23], [[80, 0], [180, 0], [280, 0]], { name: 'Rúa Maior', filtrables: ASFALTO }),
    ]);
    const lazo = trazaLazo({ grafo, puntos: [{ x: 0, y: 0 }, { x: 280, y: 0 }], criterios: CRITERIOS, tramo: 4000, cerrado: false });

    assert.equal(lazo.trazado, true, 'el núcleo ha quedado descolgado del reparto por no tener otra salida');
    assert.deepEqual(lazo.recorrido[lazo.recorrido.length - 1], { x: 280, y: 0 }, 'el lazo no llega al destino');
    assert.equal(lazo.tramos.some((t) => t.nombre === 'A Escalinata da Vila'), true, 'no hay otra salida: el lazo tiene que trazarse por la escalera');
    const declarada = lazo.declaraciones.caminos.find((c) => c.nombre === 'A Escalinata da Vila');
    assert.ok(declarada, 'se ha pasado por la escalera sin declararla');
    assert.equal(declarada.evitado, false);
    assert.equal(declarada.motivo, MOTIVOS_POR_CRITERIO.escalones);
  });

  test('Sin ningún criterio marcado la ruta es la de siempre y no lleva ninguna declaración', () => {
    const grafo = grafoDelDesempate();
    const sinCriterios = trazaLazo({ grafo, puntos: EXTREMOS, criterios: [], tramo: 2000, cerrado: false });
    const sinNada = trazaLazo({ grafo, puntos: EXTREMOS, cerrado: false });

    assert.deepEqual(sinCriterios.tramos.map((t) => t.nodos), [[1, 2]], 'sin criterios el trazado ya no es el camino corto');
    assert.equal(JSON.stringify(sinCriterios), JSON.stringify(sinNada), 'una lista de criterios vacía no está siendo la identidad');
    assert.deepEqual(sinCriterios.declaraciones, { caminos: [], noPrometidos: [] });
    assert.equal(sinCriterios.metros, sinCriterios.metrosSinCriterios);
    // Las dos listas existen siempre: vacías, no ausentes. Con un campo que falta,
    // «no había nada que declarar» y «se me perdió» son indistinguibles.
    assert.ok(Array.isArray(sinCriterios.declaraciones.caminos));
    assert.ok(Array.isArray(sinCriterios.declaraciones.noPrometidos));
  });

  test('Un criterio desconocido, un tramo personal ausente y un grafo vacío se distinguen entre sí', () => {
    const grafo = grafoDelDesempate();

    assert.throws(
      () => trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['pendiente'], tramo: 2000 }),
      (e) => /pendiente/.test(e.message) && CRITERIOS.every((c) => e.message.includes(c)),
      'un criterio desconocido tiene que fallar nombrándolo y enumerando los válidos',
    );
    assert.throws(() => normalizaCriterios(['escalones', 'cuesta']), /cuesta/);

    assert.throws(
      () => trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['escalones'], tramo: null }),
      /tramo/i,
      'sin tramo personal no hay tope de rodeo: hay que fallar nombrando la dependencia, no suponer un tope',
    );
    // Y sin criterios no hace falta: no se rodea nada, así que no hay tope que fijar.
    assert.doesNotThrow(() => trazaLazo({ grafo, puntos: EXTREMOS, criterios: [], tramo: null }));

    const vacio = trazaLazo({ grafo: construyeGrafo([]), puntos: EXTREMOS, criterios: ['escalones'], tramo: 2000 });
    assert.deepEqual(
      { trazado: vacio.trazado, hayReparto: vacio.hayReparto, motivo: vacio.motivo },
      { trazado: false, hayReparto: false, motivo: MOTIVOS_DE_FALTA.SIN_VIARIO },
      'un grafo sin tramos es una respuesta, no un error',
    );
  });

  test('Una arista de peso cero no deja el trazado dando vueltas', () => {
    // Caso nuevo de SPEC-009-iter-1, y el más pequeño que reproduce el defecto que
    // destapó la cuantización. Desde que los metros van en la rejilla del metro,
    // dos nodos de OSM distintos a menos de medio metro comparten coordenada y su
    // arista pesa cero —legítimamente: a esta resolución es la verdad, y §6l
    // decidió conservarla—. El desempate de `caminoMinimo` reasigna `previo`
    // cuando dos caminos empatan en coste, y con un coste cero ese empate puede
    // darse **en los dos sentidos de la misma arista**: `previo[2] = 3` y
    // `previo[3] = 2`. La cadena de predecesores deja de ser un árbol y la
    // reconstrucción del camino no llega nunca al origen.
    //
    // Se ejecuta en otro proceso y con el montón acotado a propósito: el fallo es
    // un bucle que llena la memoria, así que dentro del runner se llevaría por
    // delante todo el fichero en lugar de dar un rojo. Con el defecto vivo, el
    // hijo muere; arreglado, sale en cero y en menos de un segundo.
    // El guion del hijo importa por ruta calculada en tiempo de ejecución, no por
    // especificador literal, y no es un rodeo estético: la guarda de
    // `andamiaje-estructura.test.mjs` lee el texto de estos ficheros y exige que
    // todo import sea de `node:` o relativo, que es lo que sostiene que la suite
    // corra en un Node pelado. Un literal con la raíz interpolada dentro de una
    // cadena la haría saltar, y la guarda tiene razón: no distingue —ni debe— un
    // import de este módulo de uno escrito para otro proceso.
    const guion = `
      const raiz = ${JSON.stringify(RAIZ_REPO)};
      const { construyeGrafo } = await import(raiz + '/packages/nucleo/world/grafo.js');
      const { trazaLazo, CRITERIOS } = await import(raiz + '/packages/nucleo/partida/filtro.js');
      // Los nodos 2 y 3 caen en la misma coordenada. El identificador del origen
      // (9) es mayor que el de 3, que es lo que hace que el desempate reasigne.
      const grafo = construyeGrafo([{ nodes: [9, 2, 3], pts: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }] }]);
      trazaLazo({ grafo, puntos: [{ x: 0, y: 0 }, { x: 100, y: 0 }], criterios: CRITERIOS, tramo: 2000, cerrado: false });
    `;
    const hijo = spawnSync(process.execPath, ['--max-old-space-size=64', '--input-type=module', '-e', guion], { encoding: 'utf8' });
    assert.equal(
      hijo.status,
      0,
      `el trazado no termina sobre una arista de peso cero: la cadena de predecesores tiene un ciclo. ${(hijo.stderr ?? '').split('\n').slice(0, 3).join(' | ')}`,
    );
  });
});

// ── Lo cosido y lo inventado, visto desde la aptitud ─────────────────────────────

describe('El callejero troceado de OSM se cose antes de trazar', () => {
  test('Lo cosido y lo inventado queda marcado', async () => {
    // La misma afirmación que en test/nucleo/grafo.test.mjs, por el otro lado: allí
    // se comprueba que toda arista inventada lleva su marca de suposición; aquí, que
    // esa marca se traduce a «no se sabe» en los cuatro criterios y no se pierde por
    // el camino. Sobre los cuatro mundos reales, no sobre uno sintético.
    let cosidas = 0;
    for (const nombre of LOS_CUATRO) {
      const w = await generaMundo(nombre, semillaDe(nombre, '1'));
      assert.doesNotThrow(() => validaGrafo(w.viario), `${nombre}: el grafo tiene aristas sin marca`);
      for (const a of aristasUnicas(w.viario)) {
        if (a.suposicion === SUPOSICIONES.NINGUNA) continue;
        cosidas++;
        assert.deepEqual(a.aptitud, APTITUD_SUPUESTA, `${nombre}: la arista supuesta ${a.desde} ↔ ${a.hasta} se da por apta en algún criterio`);
        assert.equal(a.nombre, null, `${nombre}: una arista cosida no es un camino de OSM y no puede tener nombre propio`);
      }
      // Y aguas abajo: ningún tramo de ruta declarado como suposición se promete.
      for (const t of w.suposiciones) {
        assert.deepEqual(t.aptitud ?? APTITUD_SUPUESTA, APTITUD_SUPUESTA, `${nombre}: un tramo supuesto de las rutas se promete transitable`);
      }
    }
    assert.ok(cosidas > 0, 'ningún mundo trae aristas cosidas: no se está comprobando nada');

    // El número que lo hace concreto: en urbano-denso, las 19 aristas cosidas son
    // exactamente las 19 que quedan en «no se sabe» para escalones, que es el único
    // criterio donde la ausencia de tag sí afirma.
    const urbano = await generaMundo('urbano-denso', semillaDe('urbano-denso', '1'));
    assert.equal(urbano.grafo.cosidas, 19);
    assert.equal(urbano.grafo.aptitud.escalones.noSeSabe, 19, 'hay tramos reales sin poder afirmar escalones: eso es otro problema');
  });
});

// ── Las cuestas ─────────────────────────────────────────────────────────────────

describe('Las cuestas no se prometen', () => {
  test('Ningún criterio se deriva de incline y ninguno es la pendiente', async () => {
    assert.equal(CRITERIOS.length, 4, 'los criterios que el filtro admite son exactamente cuatro');
    for (const palabra of [/pendiente/i, /cuesta/i, /desnivel/i, /incline/i, /slope/i]) {
      assert.equal(palabra.test(JSON.stringify(CRITERIOS)), false, `hay un criterio de pendiente: ${palabra}`);
      assert.equal(palabra.test(JSON.stringify(MOTIVOS)), false, `hay un motivo en clave que habla de la pendiente: ${palabra}`);
    }
    assert.equal(TAGS_QUE_HACEN_FALTA.includes('incline'), false, 'incline entra en el marcado y no hay modelo de elevación que lo sostenga');

    // El tag puede venir en el dato; lo que no puede es cambiar la marca.
    const conCuesta = aptitudDeVia({ ...ASFALTO, incline: '15%' });
    assert.deepEqual(conCuesta, aptitudDeVia(ASFALTO), 'incline está cambiando la marca de aptitud');

    const json = {
      elements: [{ type: 'way', id: 9, nodes: [1, 2], geometry: [{ lat: 42.4, lon: -8.8 }, { lat: 42.401, lon: -8.8 }], tags: { ...ASFALTO, incline: '15%' } }],
    };
    const [calle] = parseStreets(json, 42.4, -8.8);
    assert.equal(calle.filtrables.incline, undefined, 'el parseo conserva incline entre los tags filtrables');

    // Y en un mundo real, ningún motivo declarado habla de cuestas.
    const w = await generaMundo('suelo-250m', semillaDe('suelo-250m', '1'));
    const reparto = repartoDeAventuras({ mundo: w, criterios: CRITERIOS, tramo: 1500 });
    for (const a of reparto.aventuras) {
      for (const c of a.lazo.declaraciones.caminos) assert.ok(MOTIVOS.includes(c.motivo), `motivo fuera del catálogo: ${c.motivo}`);
    }
  });
});

// ── Sin reparto: el estirón se ofrece ───────────────────────────────────────────

describe('El filtro sobre el grafo evita y declara, nunca borra · el estirón', () => {
  test('Si el filtro deja el mundo sin reparto, se ofrece el estirón', () => {
    const mundo = mundoSinRepartoPorElFiltro();
    const antes = huellaDelGrafo(mundo.viario);
    const peticion = { mundo, criterios: ['escalones'], tramo: TRAMO_DEL_MUNDO_SIN_REPARTO, tamano: 'aventura' };

    const sinCriterios = repartoDeAventuras({ ...peticion, criterios: [] });
    assert.equal(sinCriterios.hayReparto, true, 'sin criterios este mundo sí reparte: es lo que permite atribuir la falta al filtro');

    const falta = repartoDeAventuras(peticion);
    assert.equal(falta.hayReparto, false);
    assert.equal(falta.motivo, MOTIVOS_DE_FALTA.FILTRO, 'la falta de reparto no se atribuye al filtro');
    assert.equal(falta.estiron.tramosMas, TRAMOS_DEL_ESTIRON, 'la oferta no dice cuántos tramos se sugiere alejarse');
    assert.equal(falta.estiron.alcanceEnTramos, 5, 'la oferta no dice hasta dónde llegaría el alcance ampliado');
    assert.equal(falta.estiron.aceptado, false, 'la oferta llega dada por aceptada: el estirón se ofrece y no se impone');

    // No responder no amplía nada: el mismo reparto vuelve a dar el mismo alcance.
    const otraVez = repartoDeAventuras(peticion);
    assert.equal(JSON.stringify(otraVez), JSON.stringify(falta), 'algo se ha ampliado solo entre dos peticiones idénticas');
    assert.equal(huellaDelGrafo(mundo.viario), antes, 'entregar la falta de reparto ha tocado el mundo');

    // Y aceptarla reparte con el alcance ampliado, con el filtro igual de activo.
    const estirado = aceptaElEstiron(peticion);
    assert.equal(estirado.hayReparto, true);
    assert.equal(estirado.alcanceEnTramos, 5);
    assert.deepEqual(estirado.criterios, ['escalones'], 'al aceptar el estirón el filtro se ha apagado');
    assert.equal(estirado.aventuras.every((a) => a.lazo.tramos.every((t) => t.nombre !== 'A Escalinata da Fonte')), true, 'el lazo estirado vuelve a pasar por lo que se evitaba');
    assert.equal(huellaDelGrafo(mundo.viario), antes, 'aceptar el estirón ha generado o resembrado algo del mundo');
  });

  test('El mundo mínimo todavía compone un lazo', async () => {
    // El suelo de 250 m con los cuatro criterios activos: es donde el estirón se
    // dispara con más facilidad, y aun así el reparto sale.
    const w = await generaMundo('suelo-250m', semillaDe('suelo-250m', '1'));
    const reparto = repartoDeAventuras({ mundo: w, criterios: CRITERIOS, tramo: 1500, tamano: 'aventura' });
    assert.equal(reparto.hayReparto, true, 'el mundo mínimo se ha quedado sin ni un lazo con el filtro puesto');
    assert.ok(reparto.aventuras.some((a) => a.cabe), 'ninguna aventura del mundo mínimo cabe en el alcance');
    assert.equal(reparto.estiron, undefined, 'se ofrece el estirón en un mundo donde el filtro sí deja lazos');
  });
});

// ── El encuadre: ni la palabra ni una opción peor ───────────────────────────────

describe('El encuadre: ni la palabra ni una opción peor', () => {
  test('La palabra «accesibilidad» no aparece en nada de lo que el núcleo entrega', async () => {
    const grafo = grafoDelDesempate();
    const lazo = trazaLazo({ grafo, puntos: EXTREMOS, criterios: CRITERIOS, tramo: 2000, cerrado: false });
    const mundo = mundoSinRepartoPorElFiltro();
    const falta = repartoDeAventuras({ mundo, criterios: ['escalones'], tramo: TRAMO_DEL_MUNDO_SIN_REPARTO });
    // El mundo real de este caso pasa de `barrio-tres-calles` a `suelo-250m`, y no
    // es una rebaja: lo que se afirma es qué palabras entrega la capa, no cuál de
    // los cuatro mundos las entrega. Con el casting de SPEC-010 —trechos medidos
    // sobre el grafo— el reparto elige otros lugares, y el único lazo del barrio
    // pasa ahora por un tramo difícil **sin nombre propio**, así que la entrega
    // falla por la deuda §6i-a en vez de devolver un reparto que mirar. Esa deuda
    // sigue viva y tiene su propio caso más abajo, con su número; aquí hace falta
    // un mundo que entregue, y `suelo-250m` entrega sus dos lazos.
    const w = await generaMundo('suelo-250m', semillaDe('suelo-250m', '1'));
    const reparto = repartoDeAventuras({ mundo: w, criterios: CRITERIOS, tramo: 1500 });

    let mensajes = '';
    try { trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['pendiente'], tramo: 2000 }); } catch (e) { mensajes += e.message; }
    try { trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['escalones'], tramo: null }); } catch (e) { mensajes += e.message; }

    const entregado = JSON.stringify([
      lazo, falta, reparto, CRITERIOS, MOTIVOS, VALORES_DE_APTITUD, MOTIVOS_DE_FALTA, aristasUnicas(grafo).map((a) => a.aptitud), mensajes,
    ]);
    for (const palabra of [/accesibilidad/i, /accesible/i, /discapac/i, /minusval/i, /silla/i, /wheelchair/i]) {
      assert.equal(palabra.test(entregado), false, `la capa entrega la palabra ${palabra}, y esto no es un modo aparte`);
    }
    // El mundo entero tampoco la nombra: el filtro no deja rastro en lo generado.
    assert.equal(/accesibilidad/i.test(JSON.stringify(w.geo.callejero.map((c) => c.name))), false);
    assert.equal(/accesibilidad/i.test(JSON.stringify(w.routes.map((r) => r.name))), false);
  });

  test('Ninguna opción es peor juego: mismas aventuras, mismos beats y el mismo mundo', async () => {
    // `barrio-tres-calles` sale y entra `urbano-denso`, por el mismo motivo que el
    // caso anterior: con los trechos medidos sobre el grafo (SPEC-010) el reparto
    // del barrio cae sobre un tramo difícil sin nombre y la entrega falla por la
    // deuda §6i-a, que tiene su caso aparte. El cambio **amplía** lo que se mide:
    // urbano-denso entrega seis aventuras con sus cuatro criterios donde el barrio
    // aportaba una sola.
    for (const nombre of ['urbano-denso', 'suelo-250m']) {
      const w = await generaMundo(nombre, semillaDe(nombre, '1'));
      const huella = huellaDelGrafo(w.viario);
      const dibujado = JSON.stringify({ callejero: w.geo.callejero, routes: w.routes, parajes: w.parajes, settlements: w.settlements });

      const sin = repartoDeAventuras({ mundo: w, criterios: [], tramo: 1500 });
      const con = repartoDeAventuras({ mundo: w, criterios: CRITERIOS, tramo: 1500 });

      assert.equal(con.aventuras.length, sin.aventuras.length, `${nombre}: el filtro ha cambiado el número de aventuras ofrecidas`);
      assert.deepEqual(con.aventuras.map((a) => a.plantilla), sin.aventuras.map((a) => a.plantilla), `${nombre}: el filtro ha cambiado qué plantillas se ofrecen`);
      assert.deepEqual(con.aventuras.map((a) => a.beats.length), sin.aventuras.map((a) => a.beats.length), `${nombre}: el filtro ha cambiado el número de beats`);
      assert.deepEqual(con.aventuras.map((a) => a.beats), sin.aventuras.map((a) => a.beats), `${nombre}: el filtro ha cambiado a dónde te mandan`);

      // Y el mundo: ni el grafo ni lo que se dibuja se han movido.
      assert.equal(huellaDelGrafo(w.viario), huella, `${nombre}: el grafo ha cambiado al aplicar el filtro`);
      assert.equal(JSON.stringify({ callejero: w.geo.callejero, routes: w.routes, parajes: w.parajes, settlements: w.settlements }), dibujado, `${nombre}: lo que se dibuja ha cambiado al aplicar el filtro`);
    }
  });

  test('El marcado de aptitud es del mundo y no consulta el conjunto de criterios', () => {
    // La marca se calcula al generar la celda: `buildWorld` no recibe criterios, y
    // ni `aptitud.js` ni `grafo.js` importan nada del lado de la partida. Si el
    // marcado dependiera del filtro, cambiar un ajuste resembraría el mundo.
    const firma = fuente('packages/nucleo/world/build.js').split('export async function buildWorld(')[1].split(')')[0];
    assert.equal(/criterio/i.test(firma), false, 'buildWorld recibe criterios: el marcado ha dejado de ser del mundo');
    for (const modulo of ['packages/nucleo/world/aptitud.js', 'packages/nucleo/world/grafo.js']) {
      const texto = fuente(modulo);
      assert.equal(/from '\.\.\/partida\//.test(texto), false, `${modulo}: el marcado importa del lado de la partida`);
    }
    // Y es función pura de los tags: los mismos tags dan la misma marca siempre.
    const tags = { ...ASFALTO, width: '2 m' };
    assert.deepEqual(aptitudDeVia(tags), aptitudDeVia({ ...tags }));
    assert.deepEqual(cuentaAptitudes([aptitudDeVia(tags)]).firme, { apto: 1, noApto: 0, noSeSabe: 0 });
  });
});

// ── Determinismo ────────────────────────────────────────────────────────────────

describe('El mundo es una función de la semilla y de los datos de OSM · el trazado con filtro', () => {
  test('No se usa ninguna fuente de azar ni de tiempo del sistema', () => {
    for (const modulo of ['packages/nucleo/partida/filtro.js', 'packages/nucleo/partida/aventuras.js', 'packages/nucleo/world/aptitud.js']) {
      const texto = fuente(modulo);
      assert.equal(/\bMath\.random\s*\(/.test(texto), false, `${modulo}: usa Math.random()`);
      assert.equal(/\bDate\.now\s*\(|\bnew\s+Date\b|\bperformance\.now\s*\(/.test(texto), false, `${modulo}: lee el reloj del sistema`);
    }
  });

  test('Dos trazados con la misma semilla, los mismos datos y los mismos criterios son idénticos', () => {
    const grafo = grafoDelDesempate();
    const a = trazaLazo({ grafo, puntos: EXTREMOS, criterios: CRITERIOS, tramo: 2000, cerrado: false });
    const b = trazaLazo({ grafo, puntos: EXTREMOS, criterios: CRITERIOS, tramo: 2000, cerrado: false });
    assert.equal(JSON.stringify(a), JSON.stringify(b), 'dos trazados iguales no dan la misma ruta');
  });

  test('El orden de llegada de los criterios no cambia la ruta', () => {
    const grafo = grafoDelDesempate();
    const orden = trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['escalones', 'firme'], tramo: 2000, cerrado: false });
    const alReves = trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['firme', 'escalones'], tramo: 2000, cerrado: false });
    const conRepetidos = trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['firme', 'escalones', 'firme'], tramo: 2000, cerrado: false });
    assert.equal(JSON.stringify(alReves), JSON.stringify(orden), 'el orden de llegada de los criterios cambia el resultado');
    assert.equal(JSON.stringify(conRepetidos), JSON.stringify(orden), 'un criterio repetido cambia el resultado');
    assert.deepEqual(normalizaCriterios(['paso', 'escalones', 'paso']), ['escalones', 'paso'], 'los criterios no se normalizan al orden del catálogo');
  });

  test('Cambiar los criterios no resiembra el mundo ni renombra las calzadas', async () => {
    const w = await generaMundo('suelo-250m', semillaDe('suelo-250m', '1'));
    const huella = huellaDelGrafo(w.viario);
    const calzadas = JSON.stringify(w.routes.map((r) => ({ name: r.name, tramos: r.tramos.length })));
    const mundo = JSON.stringify(w);

    for (const criterios of [[], ['escalones'], ['firme', 'paso'], CRITERIOS]) {
      repartoDeAventuras({ mundo: w, criterios, tramo: 1500 });
      assert.equal(huellaDelGrafo(w.viario), huella, `criterios ${JSON.stringify(criterios)}: el grafo se ha movido`);
      assert.equal(JSON.stringify(w.routes.map((r) => ({ name: r.name, tramos: r.tramos.length }))), calzadas, `criterios ${JSON.stringify(criterios)}: las calzadas o sus nombres han cambiado`);
    }
    assert.equal(JSON.stringify(w), mundo, 'el mundo entero ha cambiado al cambiar los criterios');
  });
});

// ── Los dos límites que este filtro declara en vez de disimular ─────────────────

describe('Lo que este filtro todavía no puede afirmar', () => {
  test('Sobre los cuatro mundos congelados el criterio de bordillos no se puede verificar', async () => {
    // No es un fallo del marcado: los cuatro fixtures de SPEC-001 se capturaron con
    // la consulta vieja, que pedía solo ways, y en OSM el bordillo vive en el nodo
    // del cruce. Un fixture no se regenera, así que el criterio queda probado con
    // datos sintéticos —arriba— y sin verificar sobre dato real. Este caso existe
    // para que el hueco se vea, no para taparlo.
    for (const nombre of LOS_CUATRO) {
      const w = await generaMundo(nombre, semillaDe(nombre, '1'));
      assert.equal(w.grafo.bordillosDeNodo, 0, `${nombre}: ha aparecido un nodo de bordillo; si se han recapturado los fixtures, este límite ya no aplica y hay que retirarlo`);
      assert.equal(w.grafo.aptitud.bordillos.noApto, 0, `${nombre}: sin nodos de bordillo no puede haber ninguno afirmado no apto`);
    }
    // La única evidencia de bordillo en todo el dato real congelado es un tag de vía
    // en urbano-denso: una arista apta de 14.734. Con eso no se prueba un criterio.
    const urbano = await generaMundo('urbano-denso', semillaDe('urbano-denso', '1'));
    assert.deepEqual(urbano.grafo.aptitud.bordillos, { apto: 1, noApto: 0, noSeSabe: 14733 });
  });

  test('Todo tramo difícil se declara con nombre propio, y un grafo sin nombrar hace fallar la entrega', async () => {
    // **La deuda de §6i-a está cerrada.** Este caso se llamaba «Un tramo difícil sin
    // nombre propio hace fallar la entrega nombrando el tramo» y medía cuántos lazos
    // reales no se podían entregar porque el grafo no sabía nombrar el tramo que
    // rodeaban: eran 4 de 15, y era la única regresión esperada del repo, con la
    // frase escrita de que el día que se nombrase todo tramo difícil este caso se
    // pondría rojo y habría que actualizarlo. Ese día ha llegado: SPEC-017 nombra
    // toda vía anónima con algún tramo difícil **al construir el grafo**, que es
    // donde SPEC-007 dejó el dueño, y sobre dato real ya no falla ninguno.
    //
    // Lo que el caso afirma ahora es la propiedad, no la deuda, y son dos mitades.
    // La de abajo, sobre los cuatro mundos congelados: **cero** lazos sin entregar
    // por falta de nombre, y ni un solo tramo difícil anónimo en ningún grafo. La de
    // arriba, sobre un grafo construido a mano sin pasar por el nombrador: la
    // entrega sigue fallando **nombrando el tramo**, porque declarar «un tramo del
    // camino» incumpliría en silencio el escenario del nombre propio. Sin esa
    // mitad, la de abajo sería un cero que no demuestra nada.
    const grafo = construyeGrafo([
      via([1, 2], [[0, 0], [300, 0]], { filtrables: ESCALERA }), // sin name, como nacen los ramales
      via([1, 11, 2], [[0, 0], [150, 50], [300, 0]], { name: 'Rúa do Medio', filtrables: ASFALTO }),
    ]);
    assert.throws(
      () => trazaLazo({ grafo, puntos: EXTREMOS, criterios: ['escalones'], tramo: 2000, cerrado: false }),
      (e) => /no tiene nombre propio/.test(e.message) && e.message.includes('1') && e.message.includes('2') && e.message.includes('escalones'),
      'un tramo difícil sin nombre se está declarando a medias en vez de hacer fallar la entrega',
    );

    // Y sobre dato real, con número. La trayectoria de la deuda, para que se lea
    // entera: 15/3 medido con SPEC-008 → 15/4 con SPEC-010, que al medir los trechos
    // sobre el grafo movió el reparto y con él qué lazos tropezaban → **84/0** con
    // SPEC-017, que nombra todo tramo difícil al generar. El denominador sube de 15 a
    // 84 porque el catálogo pasa de 6 a 30 plantillas: hay muchos más lazos que
    // entregar y ninguno se queda sin nombre, que es más fuerte que el cero de antes.
    //
    // El suelo del catálogo es umbral y el de los fallos es igualdad, y la asimetría
    // es deliberada: cuántos lazos castea cada mundo puede mejorar y no debe poner
    // rojo nada, pero **un solo** lazo que vuelva a no entregarse por falta de nombre
    // es la deuda reabriéndose, y eso tiene que verse el mismo día.
    const medido = { costero: { lazos: 29, fallan: 0 }, 'urbano-denso': { lazos: 29, fallan: 0 }, 'barrio-tres-calles': { lazos: 9, fallan: 0 }, 'suelo-250m': { lazos: 17, fallan: 0 } };
    let lazos = 0, fallan = 0;
    for (const nombre of LOS_CUATRO) {
      const w = await generaMundo(nombre, semillaDe(nombre, '1'));
      const candidatas = (w.casting ?? []).filter((c) => c.ok);
      let sinNombre = 0;
      for (const c of candidatas) {
        try {
          trazaLazo({ grafo: w.viario, puntos: c.beats.map((b) => ({ x: b.lugar.x, y: b.lugar.y })), criterios: CRITERIOS, tramo: 1500 });
        } catch (e) {
          assert.match(e.message, /no tiene nombre propio/, `${nombre}: la entrega falla por otra cosa que no es el nombre`);
          sinNombre++;
        }
      }
      assert.equal(sinNombre, 0, `${nombre}: ${sinNombre} lazo(s) no se pueden entregar por falta de nombre, y la deuda de §6i-a estaba cerrada`);
      assert.ok(
        candidatas.length >= medido[nombre].lazos,
        `${nombre}: castea ${candidatas.length} lazos y su suelo medido son ${medido[nombre].lazos}`,
      );
      // Y la raíz, no solo el síntoma: no queda ni un tramo difícil anónimo en el
      // grafo. Sin esto, el cero de arriba podría venir de que el reparto esquiva
      // por casualidad los tramos que siguen sin nombre.
      assert.deepEqual(
        tramosDificilesSinNombre(w.viario),
        [],
        `${nombre}: el grafo trae tramos difíciles sin nombre propio, y SPEC-017 los nombra a todos al generar`,
      );
      lazos += candidatas.length;
      fallan += sinNombre;
    }
    assert.equal(fallan, 0, 'ha vuelto a haber lazos que no se pueden entregar por falta de nombre: la deuda de §6i-a se ha reabierto');
    assert.ok(lazos >= 84, `solo se han entregado ${lazos} lazos sobre los cuatro mundos y el suelo medido son 84: el caso está mirando muy poco`);
  });
});
