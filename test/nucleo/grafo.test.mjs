// SPEC-007 · El grafo de calzadas: cosido del callejero y ramales con nombre.
//
// Lo que se afirma aquí es que el grafo del que cuelgan el trazado, el casting y el
// filtro es honesto: los huecos cortos del callejero se cosen antes de trazar, toda
// arista que no existe en OSM lleva su marca —un enumerado de tres valores, no un
// booleano, y su ausencia es un error de construcción—, lo que no se cose se declara
// en lugar de unirse con una recta por el monte, y **todos** los ramales a parajes
// nacen con nombre del idioma del mundo.
//
// Los casos que salen de docs/testing.md llevan su nombre literal; los demás van
// marcados como hueco de la batería en test/spec-test-map.json. Los datos son de dos
// clases a propósito: sintéticos cuando hace falta un hueco de una distancia exacta
// —ningún fixture trae dos componentes separadas por 180 m clavados— y los mundos
// congelados de SPEC-001 cuando lo que se mide es el dato real de OSM.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mundoCongelado } from '../dobles/mundo-congelado.mjs';
import { LOS_CUATRO, LAS_DOS_SEMILLAS, fuente, generaMundo, nombresDelMundo, semillaDe } from './mundo-de-prueba.mjs';

import {
  COSER_MAX,
  MARCAS_DE_SUPOSICION,
  MOVER_MAX,
  SUPOSICIONES,
  aristaEntre,
  construyeGrafo,
  nodoMasCercano,
  pegarAViario,
  validaGrafo,
} from '../../packages/nucleo/world/grafo.js';
import { buildRoutes, linkParajes, tramosSupuestos, validaTramos } from '../../packages/nucleo/world/routes.js';
import { parseStreets } from '../../packages/nucleo/world/osm.js';
import { namesFor } from '../../packages/nucleo/names/index.js';
import { SUFIJOS_DE_FASE } from '../../packages/nucleo/core/semilla.js';

const SEMILLA = '42.40,-8.81#1';

/** Una vía sintética: identificadores de nodo de OSM y puntos en metros. */
function via(nodes, puntos, extra = {}) {
  return { pts: puntos.map(([x, y]) => ({ x, y })), nodes, ...extra };
}

/** Todas las aristas del grafo, en orden estable y con su marca. */
function aristas(grafo) {
  const out = [];
  for (const id of grafo.nodeIds) {
    for (const a of grafo.adj.get(id) ?? []) out.push({ desde: id, hasta: a.hasta, metros: a.metros, suposicion: a.suposicion });
  }
  return out;
}

const cosidas = (grafo) => aristas(grafo).filter((a) => a.suposicion === SUPOSICIONES.COSIDA);

/** Dos componentes separadas por el hueco pedido, en línea. */
function dosComponentes(huecoM, extraA = {}, extraB = {}) {
  return [
    via([1, 2], [[0, 0], [100, 0]], extraA),
    via([3, 4], [[100 + huecoM, 0], [200 + huecoM, 0]], extraB),
  ];
}

/** Un núcleo sintético: lo mínimo que miran el trazado y el nombrado. */
const nucleo = (name, x, y, type = 'aldea') => ({ name, type, x, y, services: [] });

/** Un paraje sintético. `origin` decide si ya nace sobre la red. */
const paraje = (name, x, y, origin = 'anclaje') => ({ name, type: 'ruina', x, y, origin });

/**
 * Los prefijos de nombre de ramal que produce un paquete de idioma, sacados del
 * propio paquete y no de una lista escrita a mano: enumerar el sorteo es lo único
 * que hace que la prueba siga valiendo cuando se añada una forma nueva.
 */
function prefijosDeRamal(names) {
  const prefijos = new Set();
  for (const rasgo of [null, 'escalones', 'tierra', 'estrecho']) {
    for (let k = 0; k < 40; k++) {
      const nombre = names.ramalName(() => k / 40, '<DIR>', '<HASTA>', rasgo);
      prefijos.add(nombre.split('<')[0]);
    }
  }
  prefijos.add(names.ramalName(null, null, '<HASTA>', null).split('<')[0]);
  return [...prefijos];
}

describe('El grafo viario, construido una vez', () => {
  test('El grafo se construye una vez y lo comparten el pegado, el trazado y el enlace', async () => {
    // Lo estático: en la tubería hay una sola construcción y las tres fases reciben
    // ese mismo grafo. Tres construcciones del mismo callejero son tres cosidos y
    // tres oportunidades de divergir.
    const texto = fuente('packages/nucleo/world/build.js');
    assert.equal((texto.match(/construyeGrafo\s*\(/g) ?? []).length, 1, 'build.js no construye el grafo exactamente una vez');
    assert.match(texto, /pegarAViario\(settlements, grafo\)/, 'el pegado al viario no recibe el grafo ya construido');
    assert.match(texto, /buildRoutes\(settlements, grafo,/, 'el trazado no recibe el grafo ya construido');
    assert.match(texto, /linkParajes\(parajes, routes, settlements, grafo,/, 'el enlace de parajes no recibe el grafo ya construido');

    // Y lo dinámico, que es lo que lo afirma: un grafo manipulado antes de
    // inyectarlo cambia el trazado. Si alguna fase se construyera el suyo, no.
    const names = namesFor('es');
    const grafo = construyeGrafo([via([1, 2, 3], [[0, 0], [100, 0], [200, 0]])]);
    grafo.coord.get(2).y = 77;
    const routes = buildRoutes([nucleo('Uno', 0, 0), nucleo('Dos', 200, 0)], grafo, SEMILLA, names);
    assert.equal(routes.length, 1);
    assert.ok(routes[0].pts.some((p) => p.y === 77), 'el trazado no ha usado el grafo que se le inyectó');
  });

  test('Construir dos veces el mismo callejero da el mismo grafo', () => {
    const vias = () => [...dosComponentes(40), via([5, 6], [[0, 300], [100, 300]])];
    const a = construyeGrafo(vias());
    const b = construyeGrafo(vias());
    assert.deepEqual(aristas(b), aristas(a), 'dos construcciones dan aristas, pesos o marcas distintas');
    assert.deepEqual(b.nodeIds, a.nodeIds, 'dos construcciones dan nodos distintos');
    assert.deepEqual(b.informe, a.informe, 'dos construcciones dan informes distintos');
  });

  test('Cada par de nodos consecutivos de un way da una arista bidireccional con la distancia real', () => {
    const grafo = construyeGrafo([via([1, 2, 3], [[0, 0], [30, 40], [30, 140]])]);
    assert.equal(grafo.informe.aristas, 2, 'un way de tres nodos tiene que dar dos aristas');
    assert.equal(aristaEntre(grafo, 1, 2).metros, 50, 'el peso no es la distancia real entre los dos nodos');
    assert.equal(aristaEntre(grafo, 2, 1).metros, 50, 'la arista no es bidireccional');
    assert.equal(aristaEntre(grafo, 2, 3).metros, 100);
    assert.equal(aristaEntre(grafo, 1, 3), null, 'hay arista entre dos nodos que no son consecutivos');
  });

  test('Dos ways que comparten identificador de nodo quedan en la misma componente sin coser nada', () => {
    const grafo = construyeGrafo([
      via([1, 2], [[0, 0], [100, 0]]),
      via([2, 3], [[100, 0], [100, 900]]),
    ]);
    assert.equal(grafo.informe.componentes, 1, 'dos ways que comparten nodo no han quedado en la misma componente');
    assert.equal(grafo.informe.cosidas, 0, 'se ha cosido algo que ya estaba unido por un nodo compartido');
    assert.equal(grafo.nodeIds.length, 3, 'el nodo compartido no se ha compartido');
  });

  test('El informe declara nodos, componentes, cosidas y separación mínima sin coser', () => {
    const grafo = construyeGrafo([...dosComponentes(40), via([7, 8], [[0, 2000], [100, 2000]])]);
    const { informe } = grafo;
    assert.equal(informe.nodos, grafo.nodeIds.length);
    assert.equal(informe.cosidas, 1, 'no se ha declarado el hueco corto cosido');
    assert.equal(informe.componentes, 2, 'no se han declarado las componentes que quedan');
    assert.deepEqual(informe.componentesAisladas, [{ nodos: 2 }], 'no se declara el tamaño de la componente aislada');
    assert.ok(informe.separacionMinimaSinCoserM > COSER_MAX, 'la separación mínima sin coser tiene que estar por encima del umbral');
    assert.equal(informe.umbralM, COSER_MAX, 'el informe no dice con qué umbral se cosió');
  });
});

describe('El callejero troceado de OSM se cose antes de trazar', () => {
  test('Los huecos cortos se cosen', async () => {
    // El escenario, con su hueco de 40 m.
    const grafo = construyeGrafo(dosComponentes(40));
    const unidas = cosidas(grafo);
    assert.equal(grafo.informe.componentes, 1, 'dos componentes a 40 m no han quedado conectadas');
    assert.equal(unidas.length / 2, 1, 'no se han unido por exactamente una arista cosida');
    assert.equal(unidas[0].metros, 40, 'el peso de la arista cosida no es la distancia real');
    assert.equal(unidas[0].suposicion, SUPOSICIONES.COSIDA);

    // Y el dato real: el callejero de barrio-tres-calles, que el manifiesto declara
    // en cuatro componentes con huecos de 239, 22, 104 y 22 m.
    const congelado = mundoCongelado('barrio-tres-calles');
    const { lat, lon } = congelado.manifiesto.coordenada;
    const real = construyeGrafo(parseStreets(congelado.callejero, lat, lon));
    const metros = real.informe.metrosCosidos.map((m) => Math.round(m * 10) / 10);
    assert.deepEqual(metros, [21.9, 104.1], 'no se han cosido los dos huecos cortos del fixture');
    for (const m of real.informe.metrosCosidos) assert.ok(m <= COSER_MAX, `se ha cosido un hueco de ${m} m, por encima del umbral`);
  });

  test('Los huecos largos no se cosen', () => {
    const grafo = construyeGrafo(dosComponentes(400));
    assert.deepEqual(cosidas(grafo), [], 'se han cosido dos componentes separadas por 400 m');
    assert.equal(grafo.informe.componentes, 2, 'dos componentes a 400 m tienen que seguir separadas');

    // El hueco largo del fixture: 239 m, por encima del umbral, y declarado.
    const congelado = mundoCongelado('barrio-tres-calles');
    const { lat, lon } = congelado.manifiesto.coordenada;
    const real = construyeGrafo(parseStreets(congelado.callejero, lat, lon));
    assert.equal(real.informe.componentes, 2, 'el hueco de 239 m del fixture se ha cosido');
    assert.equal(Math.round(real.informe.separacionMinimaSinCoserM * 100) / 100, 239.46, 'no se declara la separación que quedó sin coser');
  });

  test('Lo cosido y lo inventado queda marcado', async () => {
    // El mundo entero, con las dos clases de suposición sobre la mesa: cada arista
    // que no existe en OSM lleva su marca, y las dos marcas son distinguibles.
    const w = await generaMundo('barrio-tres-calles', semillaDe('barrio-tres-calles', '1'));
    assert.ok(w.grafo.cosidas > 0, 'este mundo no cose nada: no se está comprobando nada');

    const grafo = construyeGrafo(parseStreets(mundoCongelado('costero').callejero, 42.402, -8.809));
    for (const a of aristas(grafo)) {
      assert.ok(MARCAS_DE_SUPOSICION.includes(a.suposicion), `la arista ${a.desde} ↔ ${a.hasta} no lleva una marca conocida`);
    }
    assert.doesNotThrow(() => validaGrafo(grafo));

    // Y aguas abajo: en el mundo generado, todo tramo declarado como suposición lo
    // está con una de las dos marcas, y ninguna es un booleano.
    for (const t of w.suposiciones) {
      assert.ok([SUPOSICIONES.COSIDA, SUPOSICIONES.FALLBACK].includes(t.suposicion), `un tramo supuesto lleva la marca ${JSON.stringify(t.suposicion)}`);
    }
    assert.notEqual(SUPOSICIONES.COSIDA, SUPOSICIONES.FALLBACK, 'las dos marcas tienen que ser distinguibles');
    assert.deepEqual(MARCAS_DE_SUPOSICION, [null, 'cosida', 'fallback'], 'la marca no es el enumerado de tres valores declarado');
    for (const v of MARCAS_DE_SUPOSICION) assert.notEqual(typeof v, 'boolean', 'la marca no puede ser un booleano');
  });

  test('El umbral es inclusivo: a 180 m se cose y a 180,01 no', () => {
    assert.equal(COSER_MAX, 180, 'el umbral de cosido ha cambiado de valor');
    assert.equal(construyeGrafo(dosComponentes(180)).informe.cosidas, 1, 'a exactamente el umbral no se ha cosido');
    assert.equal(construyeGrafo(dosComponentes(180.01)).informe.cosidas, 0, 'se ha cosido un hueco por encima del umbral');
  });

  test('Dos componentes con varias parejas por debajo del umbral se cosen por la más próxima y una sola vez', () => {
    const grafo = construyeGrafo([
      via([1, 2], [[0, 0], [0, 50]]),
      via([3, 4], [[30, 0], [45, 50]]),
    ]);
    const unidas = cosidas(grafo).filter((a) => a.desde < a.hasta);
    assert.equal(unidas.length, 1, 'dos componentes se han cosido por más de una arista');
    assert.equal(unidas[0].metros, 30, 'no se han cosido por su pareja más próxima');
  });

  test('El cosido nunca crea un atajo dentro de una componente', () => {
    // Una U cuyos extremos quedan a 10 m: están unidos dando la vuelta, así que
    // coserlos sería inventar un atajo que la realidad no tiene.
    const grafo = construyeGrafo([via([1, 2, 3, 4], [[0, 0], [0, 200], [10, 200], [10, 0]])]);
    assert.equal(grafo.informe.componentes, 1);
    assert.deepEqual(cosidas(grafo), [], 'se ha cosido un atajo dentro de una componente');
  });

  test('Dos ways con layer distinto no se cosen, y sin layer declarado se tratan al mismo nivel', () => {
    const puente = construyeGrafo(dosComponentes(10, { layer: 0 }, { layer: 1 }));
    assert.deepEqual(cosidas(puente), [], 'se ha cosido un puente con la carretera que pasa por debajo');
    assert.equal(puente.informe.componentes, 2);

    const llano = construyeGrafo(dosComponentes(10));
    assert.equal(llano.informe.cosidas, 1, 'sin layer declarado no se ha asumido el mismo nivel');
  });

  test('Dos ways que se cruzan en el plano sin compartir nodo no quedan conectados', () => {
    const grafo = construyeGrafo([
      via([1, 2], [[-500, 0], [500, 0]]),
      via([3, 4], [[0, -500], [0, 500]]),
    ]);
    assert.equal(grafo.informe.componentes, 2, 'un cruce en el plano ha conectado dos ways que no comparten nodo');
    assert.deepEqual(cosidas(grafo), []);
  });

  test('El umbral está en metros y no se redimensiona con el tramo del jugador', async () => {
    const texto = fuente('packages/nucleo/world/grafo.js');
    assert.match(texto, /export const COSER_MAX = 180;/, 'el umbral ha dejado de ser una constante en metros');
    assert.equal(/tramo/i.test(texto.split('export const COSER_MAX')[1].split('\n')[0]), false);
    // Y en los mundos generados, que es donde el tramo entra en juego: el umbral
    // declarado es el mismo en los cuatro, con sus radios distintos.
    for (const nombre of LOS_CUATRO) {
      const w = await generaMundo(nombre, semillaDe(nombre, '1'));
      assert.equal(w.grafo.umbralM, COSER_MAX, `${nombre}: el umbral de cosido no es el declarado en metros`);
    }
  });

  test('Un callejero de una sola componente ya conexa no cose ninguna arista', () => {
    const grafo = construyeGrafo([via([1, 2, 3], [[0, 0], [100, 0], [200, 0]])]);
    assert.equal(grafo.informe.cosidas, 0);
    assert.equal(grafo.informe.componentes, 1);
    assert.deepEqual(grafo.informe.metrosCosidos, []);
  });
});

describe('Lo que no se cose y se declara', () => {
  test('La componente que queda aislada se declara con su tamaño y su separación', () => {
    const congelado = mundoCongelado('barrio-tres-calles');
    const { lat, lon } = congelado.manifiesto.coordenada;
    const grafo = construyeGrafo(parseStreets(congelado.callejero, lat, lon));
    assert.deepEqual(grafo.informe.componentesAisladas, [{ nodos: 144 }], 'la componente aislada no se declara con su tamaño');
    assert.ok(
      grafo.informe.separacionMinimaSinCoserM > COSER_MAX,
      'la separación declarada tiene que estar por encima del umbral: si no, es que no se cosió algo que se podía coser',
    );
  });

  test('Un núcleo sobre una componente aislada se mueve a la red principal y el desplazamiento queda registrado', () => {
    const grafo = construyeGrafo([
      via([1, 2, 3], [[0, 0], [200, 0], [400, 0]]),
      via([9, 10], [[0, 600], [50, 600]]),
    ]);
    assert.equal(grafo.informe.componentes, 2, 'el escenario necesita una componente aislada');
    const punto = nucleo('Aislado', 0, 600);
    const movidos = pegarAViario([punto], grafo);
    assert.equal(movidos.length, 1, 'el núcleo sobre la componente aislada no se ha movido a la red principal');
    assert.equal(movidos[0].metros, 600, 'el desplazamiento no queda registrado en metros');
    assert.deepEqual({ x: punto.x, y: punto.y }, { x: 0, y: 0 }, 'el núcleo no ha acabado sobre la red principal');
  });

  test('Un núcleo más lejos que el tope de desplazamiento se queda donde está', () => {
    const lejos = MOVER_MAX + 100;
    const grafo = construyeGrafo([
      via([1, 2, 3], [[0, 0], [200, 0], [400, 0]]),
      via([9, 10], [[0, lejos], [50, lejos]]),
    ]);
    const punto = nucleo('Isla', 0, lejos);
    assert.deepEqual(pegarAViario([punto], grafo), [], 'se ha arrastrado a la fuerza un núcleo más lejos que el tope');
    assert.deepEqual({ x: punto.x, y: punto.y }, { x: 0, y: lejos }, 'el núcleo se ha movido pese a estar fuera del tope');
  });

  test('Dos núcleos que el grafo no puede conectar se unen con un tramo recto marcado fallback', () => {
    const grafo = construyeGrafo([
      via([1, 2], [[0, 0], [100, 0]]),
      via([3, 4], [[0, 900], [100, 900]]),
    ]);
    const routes = buildRoutes([nucleo('Uno', 0, 0), nucleo('Dos', 0, 900)], grafo, SEMILLA, namesFor('es'));
    assert.equal(routes.length, 1);
    assert.equal(routes[0].tramos.length, 1);
    assert.equal(routes[0].tramos[0].suposicion, SUPOSICIONES.FALLBACK, 'la recta entre dos núcleos sin camino no se marca como suposición');
    assert.equal(routes[0].suposiciones.fallback, true, 'la calzada no declara que cruza un trozo sin calzada real');
    assert.equal(routes[0].suposiciones.ninguna, false);
  });
});

describe('La marca de suposición', () => {
  test('Toda arista lleva su marca declarada, y es nula si existe en OSM', () => {
    const grafo = construyeGrafo(dosComponentes(40));
    for (const a of aristas(grafo)) {
      assert.equal(Object.prototype.hasOwnProperty.call(a, 'suposicion'), true, `la arista ${a.desde} ↔ ${a.hasta} no declara el campo`);
    }
    assert.equal(aristaEntre(grafo, 1, 2).suposicion, SUPOSICIONES.NINGUNA, 'una arista de un way real no lleva la marca nula');
    assert.equal(aristaEntre(grafo, 2, 3).suposicion, SUPOSICIONES.COSIDA, 'la arista que puso el cosido no se marca como cosida');
  });

  test('Una arista sin marca o con una marca desconocida hace fallar la validación nombrándola', () => {
    const sinCampo = construyeGrafo(dosComponentes(40));
    delete sinCampo.adj.get(1)[0].suposicion;
    assert.throws(() => validaGrafo(sinCampo), (e) => {
      assert.match(e.message, /1 ↔ 2/, 'el error no nombra la arista');
      assert.match(e.message, /suposici/i);
      return true;
    });

    const marcaRara = construyeGrafo(dosComponentes(40));
    marcaRara.adj.get(1)[0].suposicion = true;
    assert.throws(() => validaGrafo(marcaRara), (e) => {
      assert.match(e.message, /1 ↔ 2/);
      assert.match(e.message, /true/);
      return true;
    });
  });

  test('Las dos marcas son valores distintos y ninguna es un booleano', () => {
    assert.equal(SUPOSICIONES.NINGUNA, null);
    assert.equal(SUPOSICIONES.COSIDA, 'cosida');
    assert.equal(SUPOSICIONES.FALLBACK, 'fallback');
    assert.equal(Object.isFrozen(SUPOSICIONES), true, 'el enumerado de marcas se puede modificar por detrás');
    assert.equal(new Set(MARCAS_DE_SUPOSICION).size, 3, 'las tres marcas tienen que ser tres valores distintos');
  });
});

describe('La marca aguas abajo', () => {
  test('Cada tramo lleva su marca sin volver a consultar el grafo', async () => {
    const w = await generaMundo('urbano-denso', semillaDe('urbano-denso', '1'));
    let tramos = 0;
    for (const r of w.routes) {
      assert.ok(Array.isArray(r.tramos), `la ruta "${r.name}" no declara sus tramos`);
      for (const t of r.tramos) {
        assert.equal(Object.prototype.hasOwnProperty.call(t, 'suposicion'), true, `un tramo de "${r.name}" no declara su marca`);
        assert.ok(MARCAS_DE_SUPOSICION.includes(t.suposicion), `un tramo de "${r.name}" lleva una marca desconocida`);
        tramos++;
      }
    }
    assert.ok(tramos > 0, 'este mundo no tiene tramos: no se está comprobando nada');
    assert.doesNotThrow(() => validaTramos(w.routes));
  });

  test('Un tramo sin marca hace fallar la validación nombrándolo', () => {
    const grafo = construyeGrafo([via([1, 2, 3], [[0, 0], [100, 0], [200, 0]])]);
    const routes = buildRoutes([nucleo('Uno', 0, 0), nucleo('Dos', 200, 0)], grafo, SEMILLA, namesFor('es'));
    assert.ok(routes[0].tramos.length > 0);
    delete routes[0].tramos[0].suposicion;
    assert.throws(() => validaTramos(routes), (e) => {
      assert.match(e.message, /tramo 1/, 'el error no nombra el tramo');
      assert.match(e.message, new RegExp(routes[0].name), 'el error no nombra la ruta');
      return true;
    });
  });

  test('Una calzada que atraviesa una arista cosida lo declara, y la que no atraviesa ninguna también', () => {
    const names = namesFor('es');
    const conCosido = construyeGrafo(dosComponentes(40));
    const cruza = buildRoutes([nucleo('Uno', 0, 0), nucleo('Dos', 240, 0)], conCosido, SEMILLA, names);
    assert.equal(cruza[0].suposiciones.cosida, true, 'una calzada que atraviesa una arista cosida no lo declara');
    assert.equal(cruza[0].suposiciones.fallback, false, 'lo cosido no es lo inventado y no se puede declarar como tal');
    assert.equal(cruza[0].tramos.filter((t) => t.suposicion === SUPOSICIONES.COSIDA).length, 1);

    const limpio = construyeGrafo([via([1, 2, 3], [[0, 0], [100, 0], [200, 0]])]);
    const recta = buildRoutes([nucleo('Uno', 0, 0), nucleo('Dos', 200, 0)], limpio, SEMILLA, names);
    assert.deepEqual(recta[0].suposiciones, { cosida: false, fallback: false, ninguna: true }, 'una calzada sin aristas inventadas declara suposiciones que no tiene');
  });

  test('Solo la calzada con un tramo fallback declara que cruza un trozo sin calzada real', () => {
    const names = namesFor('es');
    const grafo = construyeGrafo([...dosComponentes(40), via([7, 8], [[0, 3000], [100, 3000]])]);
    const routes = buildRoutes(
      [nucleo('Uno', 0, 0), nucleo('Dos', 240, 0), nucleo('Tres', 0, 3000)],
      grafo,
      SEMILLA,
      names,
    );
    const conFallback = routes.filter((r) => r.suposiciones.fallback);
    const conCosida = routes.filter((r) => r.suposiciones.cosida && !r.suposiciones.fallback);
    assert.equal(conFallback.length, 1, 'no hay exactamente una calzada que cruce un trozo sin calzada real');
    assert.equal(conCosida.length, 1, 'no hay exactamente una calzada que solo atraviese lo cosido');
    assert.equal(conCosida[0].suposiciones.fallback, false, 'la calzada cosida se presenta como inventada');
  });

  test('La lista de tramos supuestos del mundo se obtiene sin recorrer el grafo', async () => {
    const w = await generaMundo('urbano-denso', semillaDe('urbano-denso', '1'));
    assert.ok(Array.isArray(w.suposiciones), 'el mundo no publica sus tramos supuestos');
    assert.deepEqual(w.suposiciones, tramosSupuestos(w.routes), 'la lista publicada no es la que sale de las rutas');
    for (const t of w.suposiciones) {
      assert.notEqual(t.suposicion, SUPOSICIONES.NINGUNA, 'un tramo real se declara como suposición');
      assert.equal(typeof t.ramal, 'boolean', 'un tramo supuesto no dice si es de un ramal o de una calzada');
    }
    const supuestos = w.routes.flatMap((r) => r.tramos).filter((t) => t.suposicion !== SUPOSICIONES.NINGUNA);
    assert.equal(w.suposiciones.length, supuestos.length, 'la lista publicada se deja tramos supuestos fuera');
  });

  test('Lo que nos inventamos no se promete como transitable', async () => {
    // El filtro que decide qué se evita es de la fila 8 y aquí no existe. Lo que sí
    // se puede afirmar —y es lo que ese filtro necesita— es que ninguna arista
    // inventada se presenta como camino real: toda la lleva marcada, la marca
    // sobrevive hasta el tramo y el mundo la publica sin que nadie tenga que
    // recorrer el grafo.
    let inventados = 0;
    for (const nombre of LOS_CUATRO) {
      const w = await generaMundo(nombre, semillaDe(nombre, '1'));
      for (const r of w.routes) {
        for (const t of r.tramos) {
          if (t.suposicion === SUPOSICIONES.NINGUNA) continue;
          inventados++;
          assert.ok(
            w.suposiciones.some((s) => s.desde.x === t.desde.x && s.desde.y === t.desde.y && s.hasta.x === t.hasta.x && s.hasta.y === t.hasta.y),
            `${nombre}: un tramo inventado de "${r.name}" no aparece en la lista de suposiciones del mundo`,
          );
        }
        const resumen = r.suposiciones;
        assert.equal(
          resumen.ninguna,
          r.tramos.every((t) => t.suposicion === SUPOSICIONES.NINGUNA),
          `${nombre}: la ruta "${r.name}" se declara real teniendo tramos inventados`,
        );
      }
    }
    assert.ok(inventados > 0, 'ningún mundo trae tramos inventados: no se está comprobando nada');
  });
});

describe('Los ramales a parajes y su nombre', () => {
  test('Todos los ramales de todos los mundos llevan nombre', async () => {
    let ramales = 0;
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, n));
        for (const r of w.routes.filter((r) => r.ramal)) {
          ramales++;
          assert.equal(typeof r.name, 'string', `${nombre}#${n}: un ramal nace sin nombre`);
          assert.notEqual(r.name.trim(), '', `${nombre}#${n}: un ramal nace con el nombre vacío`);
        }
      }
    }
    assert.ok(ramales > 0, 'ningún mundo produce ramales: no se está comprobando nada');
  });

  test('Un ramal resuelto en recta también lleva nombre', () => {
    // Un paraje al que no se llega por el grafo: su ramal es la recta al núcleo más
    // cercano, y aun así tiene que poder ofrecerse por su nombre.
    const grafo = construyeGrafo([via([1, 2], [[0, 0], [100, 0]])]);
    const names = namesFor('es');
    const settlements = [nucleo('Uno', 0, 0)];
    const ramales = linkParajes([paraje('La Ruina Gris', 0, 5000)], [], settlements, grafo, SEMILLA, names);
    assert.equal(ramales.length, 1, 'el paraje sin camino no ha recibido su ramal');
    assert.equal(ramales[0].tramos[0].suposicion, SUPOSICIONES.FALLBACK, 'el ramal en recta no se marca como suposición');
    assert.equal(typeof ramales[0].name, 'string');
    assert.notEqual(ramales[0].name.trim(), '', 'el ramal en recta ha nacido sin nombre');
  });

  test('Cada paraje que no nace del grafo recibe exactamente un ramal, y el que nace del grafo ninguno', () => {
    const grafo = construyeGrafo([via([1, 2, 3], [[0, 0], [100, 0], [200, 0]])]);
    const names = namesFor('es');
    const settlements = [nucleo('Uno', 0, 0)];
    const parajes = [paraje('La Ruina Gris', 100, 30), paraje('El Cruce Viejo', 100, 0, 'grafo'), paraje('La Fuente Seca', 200, 20)];
    const ramales = linkParajes(parajes, [], settlements, grafo, SEMILLA, names);
    assert.equal(ramales.length, 2, 'no hay un ramal por cada paraje que no nace del grafo');
    assert.deepEqual(ramales.map((r) => r.from.name).sort(), ['La Fuente Seca', 'La Ruina Gris']);
    assert.equal(ramales.every((r) => r.ramal === true), true, 'un ramal no se declara como tal');
  });

  test('No hay dos nombres iguales en un mundo', async () => {
    // El mismo escenario de la batería, ahora con los ramales dentro del índice: es
    // lo que esta fila añade, y donde el «acepta la repetida» del prototipo se vería.
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, n));
        const vistos = new Set();
        const repetidos = [];
        for (const nom of nombresDelMundo(w)) {
          if (vistos.has(nom)) repetidos.push(nom);
          vistos.add(nom);
        }
        assert.deepEqual(repetidos, [], `${nombre}#${n}: nombres repetidos en el mundo`);

        const otros = new Set([
          ...w.settlements.map((s) => s.name),
          ...w.settlements.flatMap((s) => s.services).map((v) => v.name),
          ...w.parajes.map((p) => p.name),
          ...w.routes.filter((r) => !r.ramal).map((r) => r.name),
        ]);
        for (const r of w.routes.filter((r) => r.ramal)) {
          assert.equal(otros.has(r.name), false, `${nombre}#${n}: el ramal "${r.name}" se llama como otro elemento del mundo`);
        }
      }
    }
  });

  test('Agotadas las formas libres, el ramal recibe la forma construida sobre el nombre del paraje', () => {
    // Se le agota el repertorio a mano: el índice llega con todas las formas libres
    // tomadas, así que solo queda la caída, que es única por construcción.
    const names = namesFor('es');
    const grafo = construyeGrafo([via([1, 2], [[0, 0], [100, 0]])]);
    const usados = new Set();
    const indice = {
      tomado: (n) => usados.has(n),
      fija(sortea, desambigua, intentos = 8) {
        for (let t = 0; t < intentos; t++) sortea();
        let nombre = '';
        for (let k = 0; ; k++) {
          nombre = desambigua('', k);
          if (!usados.has(nombre)) { usados.add(nombre); return nombre; }
        }
      },
    };
    const ramales = linkParajes([paraje('El Fuso de la Vieja', 100, 40)], [], [nucleo('Uno', 0, 0)], grafo, SEMILLA, names, indice);
    assert.equal(ramales[0].name, names.ramalName(null, null, 'El Fuso de la Vieja', null), 'la caída no es la forma sobre el nombre del paraje');
    assert.equal(/\d/.test(ramales[0].name), false, 'el nombre del ramal se ha desambiguado con una cifra');
  });

  test('El idioma sale de la ubicación', async () => {
    // Los ramales salen del mismo paquete de idioma que resolvió el resto del
    // mundo: gallego en Galicia y castellano fuera. Los prefijos se enumeran del
    // propio paquete, no de una lista escrita a mano.
    for (const [mundo, idioma, otro] of [['costero', 'gl', 'es'], ['urbano-denso', 'es', 'gl']]) {
      const w = await generaMundo(mundo, semillaDe(mundo, '1'));
      assert.equal(w.locale, idioma, `${mundo}: el mundo no usa el paquete de idioma ${idioma}`);
      const ramales = w.routes.filter((r) => r.ramal);
      assert.ok(ramales.length > 0, `${mundo}: sin ramales no se puede afirmar de qué idioma salen`);

      const propios = prefijosDeRamal(namesFor(idioma));
      const ajenos = prefijosDeRamal(namesFor(otro)).filter((p) => !propios.includes(p));
      for (const r of ramales) {
        assert.ok(propios.some((p) => r.name.startsWith(p)), `${mundo}: el ramal "${r.name}" no sale del paquete ${idioma}`);
        assert.equal(ajenos.some((p) => r.name.startsWith(p)), false, `${mundo}: el ramal "${r.name}" sale del paquete ${otro}`);
      }
    }
  });

  test('El nombre de un ramal es un nombre propio de senda y no un identificador ni un número de orden', async () => {
    for (const nombre of LOS_CUATRO) {
      for (const n of LAS_DOS_SEMILLAS) {
        const w = await generaMundo(nombre, semillaDe(nombre, n));
        for (const r of w.routes.filter((r) => r.ramal)) {
          assert.equal(/\d/.test(r.name), false, `${nombre}#${n}: el ramal "${r.name}" lleva una cifra`);
          assert.equal(/ramal|acceso|senda de acceso/i.test(r.name), false, `${nombre}#${n}: "${r.name}" describe su función en vez de nombrar`);
          assert.match(r.name, /^[A-ZÁÉÍÓÚÑ]/, `${nombre}#${n}: "${r.name}" no empieza como un nombre propio`);
        }
      }
    }
  });

  test('El rasgo del callejero sesga el nombre del ramal y su ausencia no lo impide', () => {
    const names = namesFor('gl');
    const conRasgo = names.ramalName(() => 0.999, '<DIR>', '<HASTA>', 'escalones');
    const formasConRasgo = new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((v) => names.ramalName(() => v, '<DIR>', '<HASTA>', 'escalones')));
    const formasSinRasgo = new Set([0, 0.2, 0.4, 0.6, 0.8, 0.99].map((v) => names.ramalName(() => v, '<DIR>', '<HASTA>', null)));
    assert.ok(typeof conRasgo === 'string' && conRasgo.length > 0);
    assert.notDeepEqual([...formasConRasgo].sort(), [...formasSinRasgo].sort(), 'el rasgo no sesga las formas del nombre');
    for (const f of formasSinRasgo) assert.equal(typeof f, 'string', 'sin rasgo el nombre no se genera igual');
  });

  test('Un paquete de idioma sin ramalName falla nombrando la función que falta y el paquete que la incumple', () => {
    const cojo = { ...namesFor('es'), locale: 'xx' };
    delete cojo.ramalName;
    const grafo = construyeGrafo([via([1, 2], [[0, 0], [100, 0]])]);
    assert.throws(
      () => linkParajes([paraje('La Ruina Gris', 100, 40)], [], [nucleo('Uno', 0, 0)], grafo, SEMILLA, cojo),
      (e) => {
        assert.match(e.message, /ramalName/, 'el error no nombra la función que falta');
        assert.match(e.message, /xx/, 'el error no nombra el paquete que la incumple');
        return true;
      },
    );
  });
});

describe('Determinismo del grafo', () => {
  test('El callejero en orden invertido da el mismo grafo cosido y los mismos nombres de ramal', async () => {
    for (const nombre of LOS_CUATRO) {
      const semilla = semillaDe(nombre, '1');
      const natural = await generaMundo(nombre, semilla);
      const invertido = await generaMundo(nombre, semilla, { ordenInvertido: true });
      assert.deepEqual(invertido.grafo, natural.grafo, `${nombre}: el informe del grafo cambia con el orden de llegada del callejero`);
      const ramales = (w) => w.routes.filter((r) => r.ramal).map((r) => `${r.from.name}|${r.name}`);
      assert.deepEqual(ramales(invertido), ramales(natural), `${nombre}: los nombres de los ramales cambian con el orden de llegada`);
      assert.deepEqual(invertido.suposiciones, natural.suposiciones, `${nombre}: las marcas cambian con el orden de llegada`);
    }
  });

  test('El desempate de cosido se resuelve por identificador de nodo y no por orden de llegada', () => {
    // Dos parejas candidatas exactamente a la misma distancia: la componente del
    // medio puede coserse por arriba o por abajo, y quien decide es el nodo.
    const vias = [
      via([10, 11], [[0, 0], [100, 0]]),
      via([20, 21], [[0, 140], [100, 140]]),
      via([30, 31], [[0, 280], [100, 280]]),
    ];
    const derecho = cosidas(construyeGrafo(vias)).map((a) => `${a.desde}-${a.hasta}@${a.metros}`).sort();
    const alReves = cosidas(construyeGrafo([...vias].reverse())).map((a) => `${a.desde}-${a.hasta}@${a.metros}`).sort();
    assert.deepEqual(alReves, derecho, 'el cosido depende del orden de llegada de los ways');
  });

  test('Dos nodos del viario a la misma distancia de un punto se desempatan por identificador', () => {
    const vias = [via([7, 8], [[-50, 0], [50, 0]])];
    const grafo = construyeGrafo(vias);
    const alReves = construyeGrafo([via([8, 7], [[50, 0], [-50, 0]])]);
    assert.equal(nodoMasCercano(grafo, { x: 0, y: 0 }), 7, 'el empate no se rompe por el identificador de nodo menor');
    assert.equal(nodoMasCercano(alReves, { x: 0, y: 0 }), 7, 'el empate depende del orden de llegada de los puntos');
  });

  test('La fase de ramales siembra con su propio sufijo, distinto del de las calzadas', () => {
    assert.notEqual(SUFIJOS_DE_FASE.ramales, SUFIJOS_DE_FASE.calzadas, 'los ramales comparten sufijo de azar con las calzadas');
    const texto = fuente('packages/nucleo/world/routes.js');
    assert.match(texto, /makeRng\(seedStr \+ SUFIJOS_DE_FASE\.ramales\)/, 'la fase de ramales no siembra con su propio sufijo');
    assert.match(texto, /makeRng\(seedStr \+ SUFIJOS_DE_FASE\.calzadas\)/, 'la fase de calzadas no siembra con su propio sufijo');
  });

  test('Cambiar la fase de ramales no renombra las calzadas', () => {
    const names = namesFor('es');
    const grafo = construyeGrafo([via([1, 2, 3], [[0, 0], [200, 0], [400, 0]])]);
    const settlements = [nucleo('Uno', 0, 0), nucleo('Dos', 400, 0)];
    const parajes = [paraje('La Ruina Gris', 200, 40)];

    const calzadasDe = (semillaRamales) => {
      const routes = buildRoutes(settlements, grafo, SEMILLA, names);
      const antes = routes.map((r) => r.name);
      linkParajes(parajes, routes, settlements, grafo, semillaRamales, names);
      return antes;
    };
    assert.deepEqual(calzadasDe(`${SEMILLA}:otra-implementacion`), calzadasDe(SEMILLA), 'alterar la fase de ramales cambia los nombres de las calzadas');
  });

  test('Ni el grafo ni los ramales usan azar ni reloj del sistema', () => {
    for (const modulo of ['packages/nucleo/world/grafo.js', 'packages/nucleo/world/routes.js']) {
      const texto = fuente(modulo);
      assert.equal(/\bMath\.random\s*\(/.test(texto), false, `${modulo}: usa Math.random()`);
      assert.equal(/\bDate\.now\s*\(|\bnew\s+Date\b|\bperformance\.now\s*\(/.test(texto), false, `${modulo}: lee el reloj del sistema`);
      // Recorrer un Set o un Map sin ordenar deja que el orden de inserción decida:
      // los dos recorridos que hay están ordenados a mano y así tienen que seguir.
      for (const m of texto.matchAll(/for \(const \w+ of \[\.\.\.(\w+)\]([^)]*)\)/g)) {
        assert.match(m[2], /\.sort\(/, `${modulo}: se recorre "${m[1]}" sin ordenar`);
      }
    }
  });
});

describe('Mundos sin nada que coser', () => {
  test('Un callejero vacío da un grafo sin nodos y sin cosidos, y no falla', () => {
    for (const entrada of [[], null, undefined]) {
      const grafo = construyeGrafo(entrada);
      assert.deepEqual(grafo.nodeIds, []);
      assert.equal(grafo.informe.nodos, 0);
      assert.equal(grafo.informe.cosidas, 0);
      assert.equal(grafo.informe.componentes, 0);
      assert.equal(grafo.informe.separacionMinimaSinCoserM, null);
    }
  });

  test('Sin callejero, todas las calzadas salen marcadas fallback', () => {
    const grafo = construyeGrafo([]);
    const routes = buildRoutes([nucleo('Uno', 0, 0), nucleo('Dos', 400, 0)], grafo, SEMILLA, namesFor('es'));
    assert.equal(routes.length, 1);
    assert.equal(routes[0].suposiciones.fallback, true, 'sin callejero la calzada no se declara inventada');
    assert.equal(routes[0].tramos.every((t) => t.suposicion === SUPOSICIONES.FALLBACK), true);
  });

  test('Un mundo con un solo núcleo no traza ninguna calzada y no falla', () => {
    assert.deepEqual(buildRoutes([nucleo('Uno', 0, 0)], construyeGrafo([via([1, 2], [[0, 0], [100, 0]])]), SEMILLA, namesFor('es')), []);
    assert.deepEqual(buildRoutes([], construyeGrafo([]), SEMILLA, namesFor('es')), []);
  });

  test('Sin parajes no se produce ningún ramal ni se le pide nada al paquete de idioma', () => {
    let pedidos = 0;
    const espia = { ...namesFor('es'), ramalName: (...args) => { pedidos++; return namesFor('es').ramalName(...args); } };
    const grafo = construyeGrafo([via([1, 2], [[0, 0], [100, 0]])]);
    assert.deepEqual(linkParajes([], [], [nucleo('Uno', 0, 0)], grafo, SEMILLA, espia), []);
    assert.deepEqual(linkParajes(null, [], [nucleo('Uno', 0, 0)], grafo, SEMILLA, espia), []);
    assert.equal(pedidos, 0, 'se le ha pedido un nombre al paquete de idioma sin ramales que nombrar');
  });

  test('Un mundo cuyos parajes son todos de origen grafo no produce ningún ramal', () => {
    let pedidos = 0;
    const espia = { ...namesFor('es'), ramalName: (...args) => { pedidos++; return namesFor('es').ramalName(...args); } };
    const grafo = construyeGrafo([via([1, 2, 3], [[0, 0], [100, 0], [200, 0]])]);
    const parajes = [paraje('El Cruce Viejo', 100, 0, 'grafo'), paraje('El Puente Roto', 200, 0, 'grafo')];
    assert.deepEqual(linkParajes(parajes, [], [nucleo('Uno', 0, 0)], grafo, SEMILLA, espia), []);
    assert.equal(pedidos, 0, 'se ha nombrado un ramal que no existe');
  });
});

describe('Entradas inválidas', () => {
  test('Un umbral de cosido que no es un número positivo falla nombrando el parámetro', () => {
    // `null` y `undefined` no entran en la lista a propósito: significan «no lo he
    // aportado» y caen al umbral por defecto, que es lo que hace que construir el
    // grafo sin opciones siga valiendo.
    for (const umbralM of [0, -1, NaN, Infinity, '180', false, {}]) {
      assert.throws(
        () => construyeGrafo(dosComponentes(40), { umbralM }),
        (e) => {
          assert.match(e.message, /umbralM/, `el error de ${JSON.stringify(umbralM)} no nombra el parámetro`);
          return true;
        },
        `un umbral de ${JSON.stringify(umbralM)} no ha fallado`,
      );
    }
  });

  test('Un way de un solo punto aporta su nodo y ninguna arista', () => {
    const grafo = construyeGrafo([via([1], [[0, 0]])]);
    assert.deepEqual(grafo.nodeIds, [1]);
    assert.equal(grafo.informe.aristas, 0, 'un way de un solo punto ha producido una arista');
  });

  test('Dos puntos en la misma coordenada no producen una arista de peso cero', () => {
    const grafo = construyeGrafo([via([1, 2], [[10, 10], [10, 10]])]);
    const reales = aristas(grafo).filter((a) => a.suposicion === SUPOSICIONES.NINGUNA);
    assert.deepEqual(reales, [], 'se ha añadido una arista de OSM de peso cero');
  });

  test('Un way sin identificadores de nodo se identifica por coordenada de forma estable', () => {
    const sinIds = () => [{ pts: [{ x: 0.4, y: 0.4 }, { x: 100, y: 0 }] }];
    const a = construyeGrafo(sinIds());
    const b = construyeGrafo(sinIds());
    assert.deepEqual(b.nodeIds, a.nodeIds, 'los nodos sin identificador no salen iguales entre ejecuciones');
    assert.deepEqual(a.nodeIds, ['0,0', '100,0'], 'los nodos sin identificador no se claven a la coordenada redondeada al metro');
  });

  test('Dos ways con el mismo identificador en coordenadas distintas fallan nombrando el identificador', () => {
    assert.throws(
      () => construyeGrafo([via([1, 2], [[0, 0], [100, 0]]), via([2, 3], [[500, 500], [600, 500]])]),
      (e) => {
        assert.match(e.message, /"2"/, 'el error no nombra el identificador en conflicto');
        return true;
      },
    );
  });

  test('Una lista de parajes nula devuelve una lista vacía de ramales sin fallar', () => {
    const grafo = construyeGrafo([via([1, 2], [[0, 0], [100, 0]])]);
    assert.deepEqual(linkParajes(null, [], [nucleo('Uno', 0, 0)], grafo, SEMILLA, namesFor('es')), []);
    assert.deepEqual(linkParajes(undefined, [], [], grafo, SEMILLA, namesFor('es')), []);
  });
});
