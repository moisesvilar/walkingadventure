// SPEC-013 y SPEC-013-iter-1 · El arranque: qué núcleos alcanza de verdad quien
// juega, cuál es el par que cuenta el mismo suceso de dos maneras, la regla que hace
// que la primera aventura pase por los dos, y el estado que se cierra cuando lo que
// se cuenta en un sitio eres tú.
//
// La iteración 1 **deroga dos criterios de la base** —el del recorrido sintético que
// pasa por los dos y el del recorrido que no cabe en «alguno de los tamaños»— y aquí
// no se prueban ni con otro nombre: la cuarta cláusula es ahora que exista **una
// aventura del reparto con un beat en cada núcleo**.
//
// El bloque «La puesta en escena ocurre de verdad» es el que impide que el defecto
// vuelva a esconderse: no basta con que haya par, tiene que haber candidata que pase
// por los dos, y se mide sobre los mundos congelados de referencia. Un par sin
// candidata pone la prueba en rojo.
//
// Ninguna prueba de aquí toca la red, el reloj del sistema ni el azar: los datos de
// OSM salen de fixtures congelados y el azar viene siempre de la semilla.
//
// `docs/testing.md` no tiene ninguna característica sobre el prólogo, la composición
// ni la regla de la primera aventura, así que casi todo lo de aquí va declarado como
// hueco de la batería en `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  TAMANO_DE_LA_PRIMERA_SALIDA,
  VIAS_DE_CIERRE,
  aceptaPrimeraAventura,
  componeElPar,
  congelaArranque,
  estadoDeArranque,
  exigeParDelMapa,
  filtraPrimeraAventura,
  levantaArranque,
  llegaANucleo,
  nucleosAlcanzables,
  nucleosConReparto,
  pasaPorNucleo,
  repartoDelMapa,
} from '../../packages/nucleo/partida/arranque.js';
import { repartoDeAventuras } from '../../packages/nucleo/partida/aventuras.js';
import { PROTAGONISTAS, SIGNOS, hechosFieles } from '../../packages/nucleo/partida/deformacion.js';
import { estadoDeNucleos, loQueSeCuentaEn, sedimenta, versionQueLlego } from '../../packages/nucleo/partida/nucleos.js';
import { correPrologo } from '../../packages/nucleo/partida/prologo.js';
import { arbolDeCalzadas, estadoDeRumores, naceSuceso } from '../../packages/nucleo/partida/rumores.js';
import { fuente } from './mundo-de-prueba.mjs';
import { codigoDe } from './rumor-de-prueba.mjs';
import {
  CON_REPARTO_DE_SOBRA,
  ESCALERA,
  MAPA,
  PARTIDA,
  SEMILLA_A,
  SIN_REPARTO_SUFICIENTE,
  TRAMO,
  losOchoExtractos,
  mundoDeReferencia,
  mundoSintetico,
  prologoEscritoAMano,
} from './prologo-de-prueba.mjs';

/** La cadena de referencia de los mundos sintéticos. */
const CADENA = ['Albariza', 'Bermeda', 'Cobreira', 'Dorna'];

/** El casting de referencia: una aventura que pasa por los dos extremos y otra por el medio. */
const CASTING = [
  { id: 'a-los-extremos', en: ['Albariza', 'Dorna'] },
  { id: 'b-al-medio', en: ['Bermeda', 'Cobreira'] },
];

const mundoDeLaCadena = (extra = {}) => mundoSintetico({ nucleos: CADENA, casting: CASTING, ...extra });

/** Un par compuesto sobre un estado escrito a mano, con el reparto que se le diga. */
function compone({ mundo, sucesos, oyeron, alcanzables = null, reparto = null, tamano = TAMANO_DE_LA_PRIMERA_SALIDA, criterios = [] }) {
  const estado = prologoEscritoAMano({ mundo, sucesos, oyeron });
  return componeElPar({
    rumores: estado.rumores,
    nucleos: estado.nucleos,
    mapaId: MAPA,
    alcanzables: alcanzables ?? nucleosAlcanzables({ mundo, partida: PARTIDA, criterios }),
    mundo,
    tramoM: TRAMO,
    criterios,
    reparto,
    tamano,
  });
}

describe('«Alcanzable» es por el grafo, no en línea recta', () => {
  test('Un núcleo es alcanzable si existe camino por el grafo desde el punto de partida', () => {
    const mundo = mundoDeLaCadena();
    assert.deepEqual(nucleosAlcanzables({ mundo, partida: PARTIDA }), CADENA.slice().sort());
  });

  test('Un núcleo a 400 m en línea recta al otro lado de una ría, sin camino por el grafo, no es alcanzable', () => {
    const mundo = mundoSintetico({ nucleos: CADENA, aislados: ['Illa da Ría'], casting: CASTING, separacionM: 800 });
    const alcanzables = nucleosAlcanzables({ mundo, partida: PARTIDA });
    const illa = mundo.settlements.find((s) => s.name === 'Illa da Ría');
    assert.ok(Math.hypot(illa.x - PARTIDA.x, illa.y - PARTIDA.y) < 500, 'la isla tiene que estar cerca en línea recta');
    assert.ok(!alcanzables.includes('Illa da Ría'), 'un núcleo sin camino por el grafo se ha dado por alcanzable');
  });

  test('Un núcleo a varios kilómetros pero unido por calzada es alcanzable', () => {
    const mundo = mundoSintetico({ nucleos: ['Albariza', 'Lonxe'], casting: [], separacionM: 12000 });
    assert.deepEqual(nucleosAlcanzables({ mundo, partida: PARTIDA }), ['Albariza', 'Lonxe']);
  });

  test('La alcanzabilidad se resuelve sobre el grafo que el filtro deja transitable', () => {
    // El filtro de SPEC-008 **evita y declara**: penaliza el tramo no apto en vez de
    // borrarlo, así que lo que hay que afirmar es que los criterios entran en la
    // medida y no que se ignoren. Un criterio inventado se rechaza nombrándolo, que
    // es la prueba de que llegan hasta el medidor en lugar de quedarse por el camino.
    const mundo = mundoSintetico({ cadenas: [['Albariza', 'Bermeda']], casting: [], tags: [ESCALERA] });
    assert.deepEqual(nucleosAlcanzables({ mundo, partida: PARTIDA, criterios: ['escalones'] }), ['Albariza', 'Bermeda']);
    assert.throws(() => nucleosAlcanzables({ mundo, partida: PARTIDA, criterios: ['teleporte'] }), /criterio desconocido/);

    const codigo = codigoDe(fuente('packages/nucleo/partida/arranque.js'));
    const dentro = codigo.split('export function nucleosAlcanzables')[1].split('\n}\n')[0];
    assert.ok(dentro.includes('medidorDeTrechos(grafo, normalizaCriterios(criterios))'), 'la alcanzabilidad no se mide con los criterios activos');
    // Y el prólogo se los pasa: la alcanzabilidad de la composición es la de esa
    // persona concreta, no la del grafo entero (RF-MUNDO-017).
    const prologo = codigoDe(fuente('packages/nucleo/partida/prologo.js'));
    assert.ok(/nucleosAlcanzables\(\{ mundo, partida: desde, criterios: activos/.test(prologo), 'el prólogo resuelve la alcanzabilidad sin los criterios de la jugadora');
  });

  test('La resolución de la alcanzabilidad no usa ninguna distancia en línea recta', () => {
    const codigo = codigoDe(fuente('packages/nucleo/partida/arranque.js'));
    for (const prohibido of ['Math.hypot', 'Math.sqrt', '** 2', 'distancia(']) {
      assert.ok(!codigo.includes(prohibido), `arranque.js calcula distancias con ${prohibido}`);
    }
    assert.ok(codigo.includes('medidorDeTrechos'), 'la alcanzabilidad no se mide sobre el grafo');
  });

  test('Un mapa sin punto de partida o sin grafo se niega nombrando lo que falta', () => {
    const mundo = mundoDeLaCadena();
    assert.throws(() => nucleosAlcanzables({ mundo, partida: null }), /punto de partida/);
    assert.throws(() => nucleosAlcanzables({ mundo: { settlements: [] }, partida: PARTIDA }), /grafo de calzadas/);
  });
});

describe('La condición de composición', () => {
  const SUCESOS = [{ id: 's1', catalogo: 'burro-perdido', origen: 'Albariza' }];

  test('El par compuesto son dos núcleos distintos, alcanzables, con el mismo suceso en niveles distintos', () => {
    const mundo = mundoDeLaCadena();
    const par = compone({
      mundo,
      sucesos: SUCESOS,
      oyeron: [{ nucleo: 'Dorna', suceso: 's1', nivel: 2 }],
    });
    assert.ok(par, 'no ha compuesto teniendo un par válido');
    assert.deepEqual(par.nucleos.slice().sort(), ['Albariza', 'Dorna']);
    assert.notEqual(par.niveles.Albariza, par.niveles.Dorna);
    assert.equal(par.suceso, 's1');
  });

  test('Dos núcleos que oyeron el mismo suceso en el mismo nivel no componen', () => {
    const mundo = mundoSintetico({ nucleos: CADENA, casting: [{ id: 'a', en: ['Bermeda', 'Dorna'] }] });
    const par = compone({
      mundo,
      sucesos: [{ id: 's1', origen: 'Albariza' }],
      oyeron: [{ nucleo: 'Bermeda', suceso: 's1', nivel: 2 }, { nucleo: 'Dorna', suceso: 's1', nivel: 2 }],
    });
    assert.equal(par, null, 'ha compuesto con dos versiones que no se contradicen');
  });

  test('Dos núcleos que oyeron sucesos distintos no componen', () => {
    const mundo = mundoSintetico({ nucleos: CADENA, casting: [{ id: 'a', en: ['Bermeda', 'Dorna'] }] });
    const par = compone({
      mundo,
      sucesos: [{ id: 's1', catalogo: 'burro-perdido', origen: 'Bermeda' }, { id: 's2', catalogo: 'campana-rajada', origen: 'Dorna' }],
      oyeron: [],
    });
    assert.equal(par, null, 'ha compuesto con dos sucesos distintos');
  });

  test('Un par con un núcleo que no es alcanzable no compone', () => {
    const mundo = mundoSintetico({
      nucleos: CADENA,
      aislados: ['Illa da Ría'],
      casting: [{ id: 'a', en: ['Albariza', 'Illa da Ría'] }],
    });
    const par = compone({
      mundo,
      sucesos: [{ id: 's1', origen: 'Albariza' }],
      oyeron: [{ nucleo: 'Illa da Ría', suceso: 's1', nivel: 2 }],
    });
    assert.equal(par, null, 'ha compuesto con un núcleo al que no se llega');
  });

  test('Un rumor en vuelo hacia un núcleo no cuenta como que ese núcleo lo oyó', () => {
    const mundo = mundoDeLaCadena();
    // Nadie ha sedimentado nada más que el origen: el frente sigue de camino.
    const par = compone({ mundo, sucesos: SUCESOS, oyeron: [] });
    assert.equal(par, null);
  });

  test('Con varios pares se elige por regla estable y no por orden de recorrido', () => {
    const mundo = mundoSintetico({
      nucleos: CADENA,
      casting: [{ id: 'a', en: ['Albariza', 'Bermeda'] }, { id: 'b', en: ['Albariza', 'Dorna'] }, { id: 'c', en: ['Bermeda', 'Dorna'] }],
    });
    const escenario = {
      mundo,
      sucesos: [{ id: 's1', catalogo: 'burro-perdido', origen: 'Albariza' }, { id: 's2', catalogo: 'campana-rajada', origen: 'Bermeda' }],
      oyeron: [
        { nucleo: 'Bermeda', suceso: 's1', nivel: 1 },
        { nucleo: 'Dorna', suceso: 's1', nivel: 3 },
        { nucleo: 'Dorna', suceso: 's2', nivel: 2 },
      ],
    };
    const par = compone(escenario);
    assert.equal(par.suceso, 's1', 'no se ha elegido el suceso de identidad menor');
    assert.deepEqual(par.nucleos.slice().sort(), ['Albariza', 'Bermeda'], 'no se ha elegido la pareja de identificadores menor');

    // Y no depende del orden en que lleguen los núcleos ni de cómo estén en el mundo.
    const alReves = { ...mundo, settlements: mundo.settlements.slice().reverse() };
    const otro = compone({ ...escenario, mundo: alReves, alcanzables: CADENA.slice().reverse() });
    assert.deepEqual(otro, par);
  });

  test('El par compuesto queda registrado en el estado de la partida con sus núcleos y su suceso', () => {
    const mundo = mundoDeLaCadena();
    const arranque = estadoDeArranque();
    correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO, partida: PARTIDA, arranque });
    assert.ok(arranque.par, 'esta cadena compone: si deja de componer, el caso ha dejado de probar lo que dice');
    assert.equal(arranque.par.nucleos.length, 2);
    assert.ok(typeof arranque.par.suceso === 'string' && arranque.par.suceso);
    assert.deepEqual(Object.keys(arranque.par.niveles).sort(), arranque.par.nucleos.slice().sort());
    const doc = congelaArranque(arranque);
    assert.deepEqual(Object.keys(doc.par).sort(), ['niveles', 'nucleos', 'suceso'], 'el par serializado lleva algo más que sus núcleos, su suceso y sus niveles');
  });

  test('El mismo mundo y la misma semilla gastan los mismos intentos y componen el mismo par', () => {
    const mundo = mundoDeLaCadena();
    const uno = correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO, partida: PARTIDA });
    const otro = correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO, partida: PARTIDA });
    assert.deepEqual(uno.par, otro.par);
    assert.equal(uno.diagnostico.intentos, otro.diagnostico.intentos);
  });

  test('Un par recibido con un núcleo que no existe en el mapa activo falla nombrando el núcleo', () => {
    const mundo = mundoDeLaCadena();
    assert.throws(() => exigeParDelMapa({ nucleos: ['Albariza', 'Fantasmiña'] }, mundo), /Fantasmiña/);
    assert.throws(() => exigeParDelMapa({ nucleos: ['Albariza', 'Albariza'] }, mundo), /repite el núcleo/);
    assert.throws(() => exigeParDelMapa({ nucleos: ['Albariza'] }, mundo), /son siempre dos núcleos/);
    assert.equal(exigeParDelMapa(null, mundo), null);
  });
});

describe('La cuarta cláusula: el par tiene que ser un par por el que se pueda pasar', () => {
  const ESCENARIO = {
    sucesos: [{ id: 's1', origen: 'Albariza' }],
    oyeron: [{ nucleo: 'Dorna', suceso: 's1', nivel: 2 }],
  };

  test('Sin una aventura del reparto con un beat en cada núcleo, el par no vale', () => {
    const conAventura = compone({ mundo: mundoSintetico({ nucleos: CADENA, casting: [{ id: 'a', en: ['Albariza', 'Dorna'] }] }), ...ESCENARIO });
    assert.ok(conAventura, 'con una aventura que pasa por los dos tiene que componer');

    const sinAventura = compone({ mundo: mundoSintetico({ nucleos: CADENA, casting: [] }), ...ESCENARIO });
    assert.equal(sinAventura, null, 'ha compuesto un par por el que no pasa ninguna aventura');
  });

  test('Dos núcleos que alojan beats en aventuras distintas no componen', () => {
    const mundo = mundoSintetico({
      nucleos: CADENA,
      casting: [{ id: 'a', en: ['Albariza', 'Bermeda'] }, { id: 'b', en: ['Cobreira', 'Dorna'] }],
    });
    const par = compone({ mundo, ...ESCENARIO });
    assert.equal(par, null, 'hace falta una sola aventura que pase por los dos, no una por núcleo');
  });

  test('Un par de núcleos donde ninguna aventura del reparto sitúa un beat no compone y el prólogo resiembra', () => {
    // El caso medido: granjas y aldeas sin servicios, que es donde el par salía antes.
    const mundo = mundoSintetico({ nucleos: CADENA, casting: [{ id: 'a', en: ['Bermeda', 'Cobreira'] }] });
    assert.deepEqual(nucleosConReparto({ mundo, reparto: repartoDelMapa({ mundo, tramoM: TRAMO }) }), ['Bermeda', 'Cobreira']);
    const par = compone({ mundo, ...ESCENARIO });
    assert.equal(par, null);
    // Y con dos núcleos con reparto, el prólogo gasta intentos en lugar de rendirse.
    const resultado = correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO, partida: PARTIDA });
    assert.ok(resultado.diagnostico.intentos >= 1);
    assert.equal(resultado.diagnostico.conReparto, 2);
  });

  test('«Aventura del reparto» es la que castea y cuyo lazo cabe en el tamaño de la primera salida', () => {
    // El lazo entre los dos extremos mide 7200 m: cabe en «aventura» (8000) y no en
    // «paseo» (4000), con un tramo de 2 km.
    const mundo = mundoSintetico({ nucleos: CADENA, casting: [{ id: 'a', en: ['Albariza', 'Dorna'] }], separacionM: 1200 });
    assert.deepEqual(repartoDelMapa({ mundo, tramoM: TRAMO, tamano: 'aventura' }).map((a) => a.plantilla), ['a']);
    assert.deepEqual(repartoDelMapa({ mundo, tramoM: TRAMO, tamano: 'paseo' }), []);
    // Una plantilla que no castea no es del reparto por mucho que tenga beats allí.
    const noCastea = mundoSintetico({ nucleos: CADENA, casting: [{ id: 'a', en: ['Albariza', 'Dorna'], ok: false }], separacionM: 1200 });
    assert.deepEqual(repartoDelMapa({ mundo: noCastea, tramoM: TRAMO }), []);
  });

  test('«Pasa por el núcleo» es el mismo predicado que aplica el filtro de la primera aventura', () => {
    const codigo = codigoDe(fuente('packages/nucleo/partida/arranque.js'));
    assert.equal((codigo.match(/export function pasaPorNucleo/g) ?? []).length, 1, 'hay más de un predicado de «pasar por»');
    const dentroDeCompone = codigo.split('export function componeElPar')[1].split('\n}\n')[0];
    assert.ok(dentroDeCompone.includes('pasaPorNucleo('), 'la cuarta cláusula no usa pasaPorNucleo');
    const dentroDelFiltro = codigo.split('export function filtraPrimeraAventura')[1].split('\n}\n')[0];
    assert.ok(dentroDelFiltro.includes('pasaPorNucleo('), 'el filtro no usa pasaPorNucleo');
    // Y el ayudante que medía el recorrido sintético se fue con la cláusula que lo
    // justificaba: la cuarta cláusula ya no decide por metros.
    assert.ok(!codigo.includes('recorridoQuePasaPorLosDos'), 'sigue habiendo un recorrido sintético decidiendo la composición');
  });

  test('El par compuesto trae la identidad de la aventura que pasa por los dos', () => {
    const mundo = mundoSintetico({ nucleos: CADENA, casting: [{ id: 'a-la-que-avala', en: ['Albariza', 'Dorna'] }] });
    const par = compone({ mundo, ...ESCENARIO });
    assert.equal(par.avalada, 'a-la-que-avala');
    assert.equal(par.tamano, TAMANO_DE_LA_PRIMERA_SALIDA);
    // Y es diagnóstico, no estado: no se serializa con la partida.
    assert.deepEqual(Object.keys(congelaArranque({ ...estadoDeArranque(), par }).par).sort(), ['niveles', 'nucleos', 'suceso']);
  });

  test('Con varios pares que cumplen las cuatro cláusulas se elige por la regla estable, no por cuál tenga más aventuras', () => {
    const mundo = mundoSintetico({
      nucleos: CADENA,
      casting: [
        { id: 'a', en: ['Albariza', 'Bermeda'] },
        { id: 'b', en: ['Cobreira', 'Dorna'] },
        { id: 'c', en: ['Cobreira', 'Dorna'] },
        { id: 'd', en: ['Cobreira', 'Dorna'] },
      ],
    });
    const par = compone({
      mundo,
      sucesos: [{ id: 's1', origen: 'Albariza' }],
      oyeron: [
        { nucleo: 'Bermeda', suceso: 's1', nivel: 1 },
        { nucleo: 'Cobreira', suceso: 's1', nivel: 2 },
        { nucleo: 'Dorna', suceso: 's1', nivel: 3 },
      ],
    });
    assert.deepEqual(par.nucleos.slice().sort(), ['Albariza', 'Bermeda'], 'ha ganado el par con más aventuras en vez del menor');
    assert.equal(par.avalada, 'a');
  });

  test('La cláusula lee el casting que ya viaja con el mundo y no castea de nuevo', () => {
    const codigo = codigoDe(fuente('packages/nucleo/partida/arranque.js'));
    for (const castear of ['casteaCatalogo', 'casteaPlantilla', 'castAll', 'castTemplate']) {
      assert.ok(!codigo.includes(castear), `arranque.js castea con ${castear} al componer el par`);
    }
    // Y cuando el reparto llega hecho, es el que se usa: un mundo sin casting compone
    // igual si se le pasa el reparto que ya se trazó una vez.
    const mundo = mundoSintetico({ nucleos: CADENA, casting: [{ id: 'a', en: ['Albariza', 'Dorna'] }] });
    const reparto = repartoDelMapa({ mundo, tramoM: TRAMO });
    const sinCasting = { ...mundo, casting: [] };
    assert.ok(compone({ mundo: sinCasting, ...ESCENARIO, reparto }), 'no se ha usado el reparto que se le pasó');
    assert.equal(compone({ mundo: sinCasting, ...ESCENARIO }), null, 'ha compuesto sin reparto ninguno');
  });

  test('El filtro de oficio no entra en la condición de composición', () => {
    const codigo = codigoDe(fuente('packages/nucleo/partida/arranque.js'));
    assert.ok(!codigo.includes('oficio'), 'el oficio entra en la composición y el prólogo dejaría de ser propiedad del lugar');
    const firma = codigo.split('export function repartoDelMapa')[1].split(')')[0];
    assert.ok(!firma.includes('oficio'), 'repartoDelMapa recibe el oficio');
  });
});

describe('La puesta en escena ocurre de verdad, y se mide', () => {
  /** La primera lista del día 1: lo que castea y cabe, con la regla del arranque encima. */
  function primeraLista(mundo, arranque, { tamano = TAMANO_DE_LA_PRIMERA_SALIDA } = {}) {
    const reparto = repartoDeAventuras({ mundo, tramo: TRAMO, tamano });
    const lista = reparto.hayReparto ? reparto.aventuras.filter((a) => a.cabe) : [];
    return { lista, candidatas: filtraPrimeraAventura({ aventuras: lista, arranque, mundo }) };
  }

  for (const { nombre, semilla, clave } of losOchoExtractos()) {
    test(`En ${clave} un par compuesto trae siempre una candidata que pasa por los dos`, async () => {
      const mundo = await mundoDeReferencia(nombre, semilla);
      const arranque = estadoDeArranque();
      const resultado = correPrologo({ semilla: SEMILLA_A, mapaId: 'referencia', mundo, tramoM: TRAMO, partida: PARTIDA, arranque });
      const { lista, candidatas } = primeraLista(mundo, arranque);

      if (resultado.par) {
        // Lo que la iteración existe para impedir: un par que se compone y por el que
        // no pasa nadie. Si esto se pone en rojo, la puesta en escena ha vuelto a ser
        // vacía.
        const pasan = lista.filter((a) => resultado.par.nucleos.every((n) => pasaPorNucleo(a, n)));
        assert.ok(pasan.length >= 1, `${clave} compone el par ${resultado.par.nucleos.join(' + ')} y ninguna candidata pasa por los dos`);
        assert.deepEqual(candidatas.map((a) => a.plantilla), pasan.map((a) => a.plantilla), `${clave} no ha entregado la lista filtrada`);
        assert.ok(candidatas.length <= lista.length);
        for (const a of candidatas) {
          for (const nucleo of resultado.par.nucleos) assert.ok(pasaPorNucleo(a, nucleo), `${a.plantilla} no tiene beat en ${nucleo}`);
        }
        assert.ok(lista.some((a) => a.plantilla === resultado.par.avalada), `la aventura que avala el par (${resultado.par.avalada}) no está en el reparto`);
      } else {
        // Sin par, la lista es la normal del casting: degradar es abrir, no cerrar.
        assert.deepEqual(candidatas.map((a) => a.plantilla), lista.map((a) => a.plantilla), `${clave} ha filtrado la lista sin par compuesto`);
      }
    });
  }

  for (const nombre of CON_REPARTO_DE_SOBRA) {
    for (const semilla of ['1', '2']) {
      test(`El mundo congelado ${nombre}#${semilla} compone su par y pone la escena de verdad`, async () => {
        const mundo = await mundoDeReferencia(nombre, semilla);
        const arranque = estadoDeArranque();
        const resultado = correPrologo({ semilla: SEMILLA_A, mapaId: 'referencia', mundo, tramoM: TRAMO, partida: PARTIDA, arranque });
        assert.ok(resultado.par, `${nombre}#${semilla} castea seis de seis y tiene que componer: si no, es un defecto que escalar`);
        const { lista, candidatas } = primeraLista(mundo, arranque);
        assert.ok(candidatas.length >= 1 && candidatas.length <= lista.length);
        assert.ok(
          candidatas.every((a) => resultado.par.nucleos.every((n) => pasaPorNucleo(a, n))),
          `${nombre}#${semilla} ha entregado la lista degradada en vez de la filtrada`,
        );
      });
    }
  }

  test('Los mundos de referencia sin par componen su lista con la regla normal y sin ningún aviso', async () => {
    for (const nombre of SIN_REPARTO_SUFICIENTE) {
      for (const semilla of ['1', '2']) {
        const mundo = await mundoDeReferencia(nombre, semilla);
        const arranque = estadoDeArranque();
        const resultado = correPrologo({ semilla: SEMILLA_A, mapaId: 'referencia', mundo, tramoM: TRAMO, partida: PARTIDA, arranque });
        const reparto = repartoDeAventuras({ mundo, tramo: TRAMO, tamano: TAMANO_DE_LA_PRIMERA_SALIDA });
        const lista = reparto.hayReparto ? reparto.aventuras.filter((a) => a.cabe) : [];
        const candidatas = filtraPrimeraAventura({ aventuras: lista, arranque, mundo });
        if (!resultado.par) {
          assert.deepEqual(candidatas.map((a) => a.plantilla), lista.map((a) => a.plantilla));
          if (reparto.hayReparto) assert.ok(candidatas.length > 0, `${nombre}#${semilla} se queda sin día teniendo reparto`);
        }
        const texto = JSON.stringify({ par: resultado.par, arranque: congelaArranque(arranque) }).toLowerCase();
        for (const disculpa of ['no se pudo', 'faltó', 'lo sentimos', 'sin puesta en escena']) {
          assert.ok(!texto.includes(disculpa), `${nombre}#${semilla} menciona "${disculpa}"`);
        }
      }
    }
  });

  test('El prólogo de un mundo de referencia es idéntico corrido dos veces', async () => {
    const mundo = await mundoDeReferencia('costero', '1');
    const uno = correPrologo({ semilla: SEMILLA_A, mapaId: 'referencia', mundo, tramoM: TRAMO, partida: PARTIDA });
    const otro = correPrologo({ semilla: SEMILLA_A, mapaId: 'referencia', mundo, tramoM: TRAMO, partida: PARTIDA });
    assert.deepEqual(uno.par, otro.par);
    assert.equal(uno.diagnostico.intentos, otro.diagnostico.intentos);
    assert.deepEqual(uno.diagnostico.pasos, otro.diagnostico.pasos);
  });

  test('Con un tamaño de salida menor que aquel con el que se validó el par, puede degradar en silencio', () => {
    // El lazo de la única aventura que pasa por los dos mide 7200 m: se validó con
    // «aventura» y no cabe en «paseo».
    const mundo = mundoSintetico({ nucleos: CADENA, casting: [{ id: 'a', en: ['Albariza', 'Dorna'] }], separacionM: 1200 });
    const par = compone({ mundo, sucesos: [{ id: 's1', origen: 'Albariza' }], oyeron: [{ nucleo: 'Dorna', suceso: 's1', nivel: 2 }] });
    assert.ok(par);
    const arranque = { ...estadoDeArranque(), par };
    const reparto = repartoDeAventuras({ mundo, tramo: TRAMO, tamano: 'paseo' });
    const lista = reparto.hayReparto ? reparto.aventuras.filter((a) => a.cabe) : [];
    assert.deepEqual(lista, [], 'con el tamaño menor no cabe ninguna');
    assert.deepEqual(filtraPrimeraAventura({ aventuras: lista, arranque, mundo }), [], 'degrada abriendo y en silencio');
  });
});

describe('La primera aventura se elige por dónde pasa', () => {
  const PAR = { suceso: 's1', nucleos: ['Albariza', 'Dorna'], niveles: { Albariza: 0, Dorna: 2 } };
  const conPar = () => ({ ...estadoDeArranque(), par: PAR });

  const aventura = (plantilla, nucleos, extra = {}) => ({
    plantilla,
    beats: nucleos.map((n) => ({ lugar: { tipo: 'nucleo', nombre: n, en: null } })),
    ...extra,
  });

  test('Las candidatas de la primera lista son las que castean y además pasan por los dos', () => {
    const lista = [
      aventura('pasa-por-los-dos', ['Albariza', 'Bermeda', 'Dorna']),
      aventura('solo-por-uno', ['Albariza', 'Bermeda']),
      aventura('por-ninguno', ['Bermeda', 'Cobreira']),
    ];
    assert.deepEqual(filtraPrimeraAventura({ aventuras: lista, arranque: conPar() }).map((a) => a.plantilla), ['pasa-por-los-dos']);
  });

  test('Pasar por un núcleo es tener al menos un beat allí, también por servicio o persona', () => {
    const porServicio = { plantilla: 'x', beats: [{ lugar: { tipo: 'servicio', nombre: 'A Taberna do Pan', en: 'Albariza' } }] };
    assert.equal(pasaPorNucleo(porServicio, 'Albariza'), true);
    assert.equal(pasaPorNucleo(porServicio, 'Dorna'), false);
    const enParaje = { plantilla: 'x', beats: [{ lugar: { tipo: 'paraje', nombre: 'A Fraga Vella', en: null } }] };
    assert.equal(pasaPorNucleo(enParaje, 'Albariza'), false, 'un paraje no está en ningún núcleo');
  });

  test('Una aventura cuyo recorrido cruza un núcleo sin ningún beat allí no pasa por él', () => {
    // El trazado la lleva por Bermeda, y sin beat allí no dispara nada: cruzar de
    // largo no es pasar (RF-BUCLE-006).
    const cruza = { plantilla: 'x', beats: [{ lugar: { tipo: 'nucleo', nombre: 'Albariza', en: null } }], lazo: { pasaPorEncimaDe: ['Bermeda'] } };
    assert.equal(pasaPorNucleo(cruza, 'Bermeda'), false);
  });

  test('Con ocho que castean y dos que pasan por los dos, las candidatas son esas dos', () => {
    const lista = [
      ...['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((id) => aventura(id, ['Bermeda', 'Cobreira'])),
      aventura('p1', ['Albariza', 'Dorna']),
      aventura('p2', ['Dorna', 'Albariza', 'Cobreira']),
    ];
    assert.deepEqual(filtraPrimeraAventura({ aventuras: lista, arranque: conPar() }).map((a) => a.plantilla), ['p1', 'p2']);
  });

  test('Si ninguna pasa por los dos, la lista se compone con la regla normal y el día no se queda vacío', () => {
    const lista = [aventura('c1', ['Bermeda']), aventura('c2', ['Cobreira'])];
    const candidatas = filtraPrimeraAventura({ aventuras: lista, arranque: conPar() });
    assert.deepEqual(candidatas.map((a) => a.plantilla), ['c1', 'c2']);
    assert.ok(candidatas.length > 0);
  });

  test('Aceptar la primera aventura consume la regla y la segunda lista vuelve a ser la completa', () => {
    const arranque = conPar();
    const lista = [aventura('pasa', ['Albariza', 'Dorna']), aventura('no-pasa', ['Bermeda'])];
    assert.equal(filtraPrimeraAventura({ aventuras: lista, arranque }).length, 1);
    aceptaPrimeraAventura(arranque);
    assert.equal(arranque.reglaDePaso, false);
    assert.deepEqual(filtraPrimeraAventura({ aventuras: lista, arranque }).map((a) => a.plantilla), ['pasa', 'no-pasa']);
  });

  test('Salir a andar sin aceptar ninguna aventura no consume la regla', () => {
    const arranque = conPar();
    const lista = [aventura('pasa', ['Albariza', 'Dorna']), aventura('no-pasa', ['Bermeda'])];
    filtraPrimeraAventura({ aventuras: lista, arranque });
    filtraPrimeraAventura({ aventuras: lista, arranque });
    assert.equal(arranque.reglaDePaso, true, 'componer la lista o salir a andar no puede consumir la regla');
    assert.equal(filtraPrimeraAventura({ aventuras: lista, arranque }).length, 1);
  });

  test('Una primera aventura aceptada y abandonada a mitad no reimpone la regla', () => {
    const arranque = conPar();
    aceptaPrimeraAventura(arranque);
    // Abandonar no toca el arranque: no hay ninguna vía para reabrir la regla.
    const codigo = codigoDe(fuente('packages/nucleo/partida/arranque.js'));
    assert.ok(!/reglaDePaso = true/.test(codigo), 'hay una forma de reimponer la regla de paso');
    const lista = [aventura('no-pasa', ['Bermeda'])];
    assert.deepEqual(filtraPrimeraAventura({ aventuras: lista, arranque }).map((a) => a.plantilla), ['no-pasa']);
  });

  test('Sin par compuesto la regla de paso no se aplica en absoluto', () => {
    const lista = [aventura('c1', ['Bermeda'])];
    assert.deepEqual(filtraPrimeraAventura({ aventuras: lista, arranque: estadoDeArranque() }), lista);
    assert.deepEqual(filtraPrimeraAventura({ aventuras: lista, arranque: null }), lista);
  });

  test('El filtro se aplica encima del casting y del filtro de oficio, y no los sustituye', () => {
    // Lo que entra ya está casteado y filtrado por oficio: aquí solo se quita.
    const lista = [aventura('pasa', ['Albariza', 'Dorna'])];
    const soloDelOficio = [];
    assert.deepEqual(filtraPrimeraAventura({ aventuras: soloDelOficio, arranque: conPar() }), [], 'el filtro ha metido una aventura que su oficio no recibe');
    const candidatas = filtraPrimeraAventura({ aventuras: lista, arranque: conPar() });
    assert.ok(candidatas.every((a) => lista.includes(a)), 'el filtro ha inventado una candidata');
  });

  test('Una aventura que dice pasar por un núcleo que no está en su cadena de beats falla nombrándolo', () => {
    const mentirosa = aventura('la-que-miente', ['Albariza', 'Dorna'], { pasaPor: ['Bermeda'] });
    assert.throws(
      () => filtraPrimeraAventura({ aventuras: [mentirosa], arranque: conPar() }),
      (e) => e.message.includes('Bermeda') && e.message.includes('la-que-miente'),
    );
  });

  test('Un par que cita un núcleo que no existe en el mapa activo falla al filtrar', () => {
    const mundo = mundoDeLaCadena();
    const arranque = { ...estadoDeArranque(), par: { suceso: 's1', nucleos: ['Albariza', 'Fantasmiña'], niveles: {} } };
    assert.throws(() => filtraPrimeraAventura({ aventuras: [], arranque, mundo }), /Fantasmiña/);
  });
});

describe('El arranque queda abierto y su hito se marca una sola vez', () => {
  /** Un mapa con un rumor protagonizado por la jugadora, ya sedimentado en dos sitios. */
  function mapaDondeTeCuentan({ nivel = 2, protagonista = PROTAGONISTAS.JUGADORA } = {}) {
    const mundo = mundoDeLaCadena();
    const arbol = arbolDeCalzadas(mundo);
    const rumores = estadoDeRumores();
    const nucleos = estadoDeNucleos();
    const hechos = hechosFieles(
      { asunto: 'lo-que-hizo-en-el-puente', escala: { veces: 1 }, detalle: { con: 'la panadera', lugar: 'Albariza', motivo: 'una riada' } },
      { lugar: 'Albariza', protagonista },
    );
    naceSuceso({ estado: rumores, nucleos, mapaId: MAPA, arbol, id: 'suyo', origen: 'Albariza', signo: SIGNOS.BUENO, hechos });
    sedimenta(nucleos, {
      mapaId: MAPA,
      nucleo: 'Dorna',
      loQueLlego: versionQueLlego({ rumor: 'suyo', origen: 'Albariza', nivel, signo: SIGNOS.BUENO, hechos }),
    });
    return { rumores, nucleos };
  }

  test('Una partida recién creada con su prólogo corrido tiene el arranque abierto', () => {
    const arranque = estadoDeArranque();
    correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo: mundoDeLaCadena(), tramoM: TRAMO, partida: PARTIDA, arranque });
    assert.equal(arranque.abierto, true);
    assert.equal(arranque.marcado, false);
    assert.equal(arranque.reglaDePaso, true);
  });

  test('Llegar a un núcleo donde lo que se cuenta es ella, contado por otros, cumple la condición', () => {
    const { rumores, nucleos } = mapaDondeTeCuentan();
    const arranque = estadoDeArranque();
    const r = llegaANucleo({ arranque, rumores, nucleos, mapaId: MAPA, nucleo: 'Dorna', n: 7 });
    assert.equal(r.cumplida, true);
    assert.equal(r.marca, true);
    assert.equal(arranque.abierto, false);
    assert.equal(arranque.cerradoPor, VIAS_DE_CIERRE.TE_CUENTAN);
    assert.equal(arranque.cerradoEn, 7);
  });

  test('La condición se marca una sola vez y no vuelve', () => {
    const { rumores, nucleos } = mapaDondeTeCuentan();
    const arranque = estadoDeArranque();
    llegaANucleo({ arranque, rumores, nucleos, mapaId: MAPA, nucleo: 'Dorna' });
    const otra = llegaANucleo({ arranque, rumores, nucleos, mapaId: MAPA, nucleo: 'Dorna' });
    assert.equal(otra.cumplida, false);
    assert.equal(otra.marca, false);
    assert.equal(arranque.marcado, true);
  });

  test('Un núcleo donde solo se cuentan sucesos del prólogo no cumple la condición', () => {
    const mundo = mundoDeLaCadena();
    const arranque = estadoDeArranque();
    const r = correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO, partida: PARTIDA, arranque });
    for (const nucleo of CADENA) {
      if (!loQueSeCuentaEn(r.nucleos, { mapaId: MAPA, nucleo }).length) continue;
      const llegada = llegaANucleo({ arranque, rumores: r.rumores, nucleos: r.nucleos, mapaId: MAPA, nucleo });
      assert.equal(llegada.cumplida, false, `el hito se ha disparado en "${nucleo}" con un suceso del prólogo`);
    }
    assert.equal(arranque.abierto, true);
  });

  test('La versión fiel que ella misma vio ocurrir no cumple la condición', () => {
    const { rumores, nucleos } = mapaDondeTeCuentan();
    const arranque = estadoDeArranque();
    // «Albariza» es donde ocurrió: allí está la versión de nivel 0, la que no cuenta nadie.
    const r = llegaANucleo({ arranque, rumores, nucleos, mapaId: MAPA, nucleo: 'Albariza' });
    assert.equal(r.cumplida, false);
    assert.equal(arranque.abierto, true);
  });

  test('La condición entrega el estado y su marca, y ningún texto ni cartela ni página de diario', () => {
    const { rumores, nucleos } = mapaDondeTeCuentan();
    const arranque = estadoDeArranque();
    const r = llegaANucleo({ arranque, rumores, nucleos, mapaId: MAPA, nucleo: 'Dorna' });
    assert.deepEqual(Object.keys(r).sort(), ['cerradoPor', 'cumplida', 'marca']);
    const codigo = codigoDe(fuente('packages/nucleo/partida/arranque.js'));
    for (const prohibido of ['cartela', 'diario', 'telon']) {
      assert.ok(!codigo.includes(prohibido), `arranque.js entrega "${prohibido}", que es de la fila 36`);
    }
  });

  test('El estado del arranque se serializa y vuelve con el mismo valor, y el hito no se remarca', () => {
    const { rumores, nucleos } = mapaDondeTeCuentan();
    const arranque = estadoDeArranque();
    llegaANucleo({ arranque, rumores, nucleos, mapaId: MAPA, nucleo: 'Dorna', n: 3 });
    const vuelto = levantaArranque(JSON.parse(JSON.stringify(congelaArranque(arranque))));
    assert.equal(vuelto.abierto, false);
    assert.equal(vuelto.marcado, true);
    assert.equal(vuelto.cerradoPor, VIAS_DE_CIERRE.TE_CUENTAN);
    assert.equal(vuelto.cerradoEn, 3);
    const otra = llegaANucleo({ arranque: vuelto, rumores, nucleos, mapaId: MAPA, nucleo: 'Dorna' });
    assert.equal(otra.marca, false);
  });

  test('No existe ninguna forma de reabrir el arranque', () => {
    const codigo = codigoDe(fuente('packages/nucleo/partida/arranque.js'));
    assert.ok(!/abierto = true/.test(codigo.split('export function estadoDeArranque')[1].split('\n}\n').slice(1).join('')), 'hay una reapertura del arranque');
    assert.ok(!codigo.includes('reabre'), 'arranque.js declara una reapertura');
    const { rumores, nucleos } = mapaDondeTeCuentan();
    const arranque = levantaArranque({ abierto: false, cerradoPor: VIAS_DE_CIERRE.TE_CUENTAN, marcado: true, reglaDePaso: false, par: null });
    llegaANucleo({ arranque, rumores, nucleos, mapaId: MAPA, nucleo: 'Dorna' });
    assert.equal(arranque.abierto, false);
  });

  test('La vía de cierre es un enumerado, para que la segunda del pendiente 1 quepa sin cambiar de forma', () => {
    assert.deepEqual(Object.values(VIAS_DE_CIERRE), ['te-cuentan']);
    const { rumores, nucleos } = mapaDondeTeCuentan();
    const arranque = estadoDeArranque();
    llegaANucleo({ arranque, rumores, nucleos, mapaId: MAPA, nucleo: 'Dorna' });
    assert.ok(Object.values(VIAS_DE_CIERRE).includes(arranque.cerradoPor));
  });
});
