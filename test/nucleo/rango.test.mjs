// SPEC-015 · El rango social de un núcleo: tres escalones con nombre, sin una sola
// cifra, y **derivados de lo que ese sitio ha oído** en lugar de guardados.
//
// Lo que aquí se mide con números, porque la spec lo afirma en voz alta y es lo más
// fácil de romper: `escalonPara` es no decreciente de 0 a 200 y `rango.js` no
// contiene ni una asignación a un estado, así que «el rango no baja» es una
// propiedad del cálculo y no un guardián; lo que devuelve `rangoEn` son dos claves y
// **cero cifras**; y con el mismo estado de partida, un mapa nuevo empieza en
// `forasteria` en todos sus núcleos sin que haya nada que trasladar.
//
// El caso del escalón no decreciente está escrito sobre el ordinal del enumerado a
// propósito: un cálculo que bajara —o una tabla de umbrales desordenada— lo pone en
// rojo, que es lo que se le pide a una prueba de una propiedad.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás
// van declarados como huecos de la batería en test/spec-test-map.json.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESCALONES_DE_RANGO,
  ESCALON_DE_PARTIDA,
  IDS_DE_TONO,
  MECANISMOS_DE_PROGRESION_QUE_BAJAN,
  TONOS_DE_RANGO,
  UMBRALES_DE_RANGO,
  escalonPara,
  rangoEn,
  tonoDe,
} from '../../packages/nucleo/partida/rango.js';
import * as moduloDeRango from '../../packages/nucleo/partida/rango.js';
import * as moduloDeMotes from '../../packages/nucleo/partida/motes.js';
import { congelaMotes, estadoDeMotes, levantaMotes, moteEn } from '../../packages/nucleo/partida/motes.js';
import { congelaNucleos, estadoDeNucleos, levantaNucleos } from '../../packages/nucleo/partida/nucleos.js';
import { castAll } from '../../packages/nucleo/quests/casting.js';
import { fuente, generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import {
  CADENA,
  LOS_CINCO_MODULOS,
  MAPA,
  OTRO_MAPA,
  RUMORES_PARA,
  SIGNOS,
  avanza,
  codigoDe,
  conRumores,
  desenlaceEn,
  cifrasDe,
  clavesDe,
  mapaDe,
  mundoLineal,
  oye,
  propagacionSobre,
} from './progresion-de-prueba.mjs';

/** El mapa activo de casi todas las pruebas: la cadena de seis núcleos. */
const MAPA_ACTIVO = mapaDe();

/** El ordinal de un escalón dentro de la escalera. Es lo que hace comparable «subir». */
const ordinalDe = (escalon) => ESCALONES_DE_RANGO.indexOf(escalon);

/** El rango de un núcleo del mapa de la cadena. */
const rangoDe = (nucleos, nucleo, { mapaId = MAPA, mapa = MAPA_ACTIVO } = {}) => rangoEn(nucleos, { mapaId, nucleo, mapa });

describe('La escalera: tres escalones con nombre y sin números', () => {
  test('La escalera de rango tiene exactamente tres escalones con nombre y es ordinal', () => {
    assert.deepEqual(ESCALONES_DE_RANGO, ['forasteria', 'nombradia', 'pertenencia']);
    assert.equal(ESCALONES_DE_RANGO.length, 3);
    assert.equal(ESCALON_DE_PARTIDA, ESCALONES_DE_RANGO[0], 'el escalón de partida no es el primero de la escalera');

    // Ordinal: la tabla de umbrales va en el mismo orden y sube en sentido estricto,
    // que es lo que hace que «más arriba» signifique algo.
    assert.deepEqual(UMBRALES_DE_RANGO.map((u) => u.escalon), ESCALONES_DE_RANGO);
    for (let i = 1; i < UMBRALES_DE_RANGO.length; i++) {
      assert.ok(UMBRALES_DE_RANGO[i].desde > UMBRALES_DE_RANGO[i - 1].desde, 'la escalera no sube en sentido estricto');
    }

    // Enumerada y no continua: entre dos escalones no hay ningún valor intermedio,
    // y un recuento cualquiera cae siempre en uno de los tres.
    for (let n = 0; n <= 200; n++) {
      assert.ok(ESCALONES_DE_RANGO.includes(escalonPara(n)), `el recuento ${n} ha caído fuera del enumerado`);
    }
    assert.throws(() => tonoDe('nombradia-y-media'), /nombradia-y-media/);
  });

  test('Las claves de los escalones no nombran ningún género gramatical', () => {
    // Los nombres del diseño —forastera · conocida · alguien de aquí— son lo que se
    // cuenta, no lo que se guarda: una clave marcada arrastraría el género de la
    // jugadora a un sitio donde no pinta nada.
    const CON_GENERO = ['forastero', 'forastera', 'conocido', 'conocida', 'vecino', 'vecina', 'nuestro', 'nuestra'];
    for (const escalon of [...ESCALONES_DE_RANGO, ...Object.values(TONOS_DE_RANGO)]) {
      for (const marcado of CON_GENERO) {
        assert.notEqual(escalon, marcado, `la clave "${escalon}" es una palabra con género y no una clave interna`);
        assert.equal(escalon.includes(marcado), false, `la clave "${escalon}" lleva dentro "${marcado}"`);
      }
    }
    // Y las claves del tono son una por escalón, para que la fila 18 tenga con qué
    // decidir la voz sin recibir ninguna palabra ya escrita.
    assert.deepEqual(Object.keys(TONOS_DE_RANGO).sort(), [...ESCALONES_DE_RANGO].sort());
    assert.equal(new Set(Object.values(TONOS_DE_RANGO)).size, ESCALONES_DE_RANGO.length);
  });

  test('El rango de un núcleo es un escalón y su tono, y ninguna cifra', () => {
    const nucleos = conRumores(RUMORES_PARA.nombradia);
    const rango = rangoDe(nucleos, 'Monfrida');

    assert.deepEqual(Object.keys(rango).sort(), ['escalon', 'tono']);
    assert.equal(rango.escalon, 'nombradia');
    assert.equal(rango.tono, TONOS_DE_RANGO.nombradia);
    assert.deepEqual(cifrasDe(rango), [], 'el rango entrega alguna cifra');
  });

  test('No hay ninguna barra ni lista de reputación', () => {
    // La mitad `@nucleo` y la más barata: no hay con qué pintar un medidor. Que
    // ninguna pantalla lo pinte es de las filas 32, 36 y 38.
    const nucleos = conRumores(RUMORES_PARA.nombradia);
    const rango = rangoDe(nucleos, 'Monfrida');
    for (const delator of ['recuento', 'cuantos', 'llegados', 'porcentaje', 'progreso', 'falta', 'siguiente', 'total']) {
      assert.equal(clavesDe(rango).includes(delator), false, `el rango entrega "${delator}"`);
    }
    assert.deepEqual(cifrasDe(rango), []);

    // Y no existe ninguna consulta que devuelva el rango de todos los núcleos a la
    // vez: se pregunta núcleo a núcleo, como en SPEC-012.
    const exportado = Object.keys(moduloDeRango).sort();
    assert.deepEqual(exportado.filter((n) => /^rangos|Todos|DeMapa|DelMapa/.test(n)), []);
    assert.equal(exportado.includes('rangoEn'), true, 'la consulta por núcleo es la que tiene que existir');
    for (const nombre of exportado) {
      const valor = moduloDeRango[nombre];
      if (typeof valor !== 'function' || nombre === 'rangoEn') continue;
      assert.equal(/todos|mapa$/i.test(nombre) && nombre !== 'exigeMapaDeNucleos', false, `"${nombre}" parece una consulta agregada por mapa`);
    }
  });

  test('Un escalón fuera del enumerado falla nombrando el valor recibido', () => {
    assert.throws(() => tonoDe('caciquil'), /"caciquil"/);
    assert.throws(() => tonoDe(null), /null/);
    assert.throws(() => escalonPara(-1), /-1/);
    assert.throws(() => escalonPara(1.5), /1\.5/);
  });

  test('No existe ninguna operación que baje el rango: no es estado, es cálculo', () => {
    // El rango no se guarda, así que no hay dónde escribir una bajada. Se afirma de
    // las dos maneras que lo hacen cierto: la superficie no expone ninguna, y el
    // módulo no contiene ni una asignación a un estado.
    for (const nombre of Object.keys(moduloDeRango)) {
      if (typeof moduloDeRango[nombre] !== 'function') continue;
      assert.equal(/baja|degrada|olvida|resta|fija|guarda|borra|reinicia/i.test(nombre), false, `"${nombre}" suena a una operación que baja o fija el rango`);
    }
    const codigo = codigoDe(fuente('packages/nucleo/partida/rango.js'));
    assert.deepEqual(codigo.match(/[A-Za-z_$][\w$]*(\.[\w$]+)+\s*=[^=]/g) ?? [], [], 'rango.js escribe en algún estado, y entonces ese estado puede desincronizarse');
  });

  test('Los mecanismos de esta entrega que pueden bajar son ninguno', () => {
    assert.deepEqual(MECANISMOS_DE_PROGRESION_QUE_BAJAN, []);
  });

  test('El escalón nunca baja al crecer lo que ha llegado, de cero a doscientos', () => {
    // La propiedad, y no un caso: si alguien cambia el cálculo por uno que baje —o
    // desordena la tabla de umbrales—, esto se pone rojo.
    for (let n = 1; n <= 200; n++) {
      assert.ok(
        ordinalDe(escalonPara(n)) >= ordinalDe(escalonPara(n - 1)),
        `oír un rumor más ha bajado el rango: ${escalonPara(n - 1)} con ${n - 1} y ${escalonPara(n)} con ${n}`,
      );
    }
    assert.equal(escalonPara(0), 'forasteria');
    assert.equal(escalonPara(200), 'pertenencia', 'la escalera tiene techo y el techo es el último escalón');
  });
});

describe('No hay niveles, hay rango social por núcleo', () => {
  test('El rango sube por lo que llega, no por lo que se pisa', () => {
    // Veinte pasos del mundo pasando por «Vilanova» sin hacer nada allí: no le llega
    // ni un rumor, así que sigue en el escalón de partida.
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    avanza(prop, 20);

    for (const nucleo of CADENA) {
      assert.deepEqual(rangoDe(nucleos, nucleo), { escalon: ESCALON_DE_PARTIDA, tono: TONOS_DE_RANGO[ESCALON_DE_PARTIDA] }, `en "${nucleo}" el rango se ha movido sin que llegara nada`);
    }
    assert.equal(rangoDe(nucleos, 'Vilanova').escalon, 'forasteria');
  });

  test('Se puede ser alguien en un pueblo donde no has estado', () => {
    // Un desenlace notable en «Monfrida». La jugadora no ha pisado los vecinos: la
    // noticia llega sola por el árbol de calzadas, y con ella el rango.
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 10);

    const subidos = CADENA.filter((n) => ordinalDe(rangoDe(nucleos, n).escalon) > 0);
    assert.ok(subidos.length >= 3, `la noticia solo ha llegado a ${subidos.length} núcleos y el caso no afirma nada`);
    assert.equal(subidos.includes('Vilanova'), true, 'en el vecino no ha subido el rango');
    assert.equal(subidos.includes('Cadaval'), true, 'la noticia no ha pasado del primer vecino');
    for (const nucleo of subidos) {
      assert.equal(rangoDe(nucleos, nucleo).escalon, 'nombradia', `en "${nucleo}" un solo rumor no ha dado el escalón que le toca`);
    }
  });

  test('El rango depende solo de lo que ha llegado a ese núcleo', () => {
    const nucleos = conRumores(RUMORES_PARA.nombradia, { nucleo: 'Monfrida' });
    const antes = JSON.stringify(rangoDe(nucleos, 'Monfrida'));

    // Lo que le llega a otro núcleo no le mueve nada al primero.
    conRumores(2, { nucleos, nucleo: 'Sanxil', desde: 90 });
    assert.equal(JSON.stringify(rangoDe(nucleos, 'Monfrida')), antes, 'lo que oyó otro pueblo ha movido este rango');

    // Y entre las entradas del cálculo no hay ni metros, ni pasos, ni geofences, ni
    // visitas: `rangoEn` recibe lo oído, el mapa y el núcleo, y nada más.
    const firma = codigoDe(fuente('packages/nucleo/partida/rango.js')).split('export function rangoEn')[1].split(')')[0];
    assert.equal(firma.includes('nucleos'), true);
    for (const prohibido of ['metros', 'pasos', 'paso', 'geofence', 'visitas', 'llegadas', 'tramo', 'km', 'distancia']) {
      assert.equal(firma.includes(prohibido), false, `el cálculo del rango recibe "${prohibido}"`);
    }
    const codigo = codigoDe(fuente('packages/nucleo/partida/rango.js'));
    for (const prohibido of ['geofence', 'visitas', 'metros', 'distancia', 'kilometros']) {
      assert.equal(codigo.includes(prohibido), false, `el cálculo del rango mira "${prohibido}"`);
    }
  });

  test('Avanza igual quien anda 6 km y quien anda 900 m', () => {
    // Dos jugadoras con tramos muy distintos terminan la misma aventura casteada a su
    // tramo. El rumor que nace es el mismo hecho, y donde ocurrió suben lo mismo.
    const corto = propagacionSobre(mundoLineal(CADENA), { tramo: 900 });
    const largo = propagacionSobre(mundoLineal(CADENA), { tramo: 6000 });
    corto.prop.nace(desenlaceEn('Monfrida'), 0);
    largo.prop.nace(desenlaceEn('Monfrida'), 0);

    assert.deepEqual(
      rangoDe(corto.nucleos, 'Monfrida'),
      rangoDe(largo.nucleos, 'Monfrida'),
      'quien anda 900 m y quien anda 6 km no suben lo mismo donde ocurrió',
    );
    assert.equal(rangoDe(corto.nucleos, 'Monfrida').escalon, 'nombradia');

    // Y con la aventura entera hecha tres veces, las dos llegan al escalón más alto.
    for (const { prop } of [corto, largo]) {
      prop.nace(desenlaceEn('Monfrida', { id: 'r2' }), 1);
      prop.nace(desenlaceEn('Monfrida', { id: 'r3' }), 2);
    }
    assert.deepEqual(rangoDe(corto.nucleos, 'Monfrida'), rangoDe(largo.nucleos, 'Monfrida'));
    assert.equal(rangoDe(largo.nucleos, 'Monfrida').escalon, 'pertenencia');
  });

  test('Un rumor de signo feo también sube el rango', () => {
    const feo = conRumores(1, { nucleo: 'Monfrida', signo: SIGNOS.FEO });
    const bueno = conRumores(1, { nucleo: 'Monfrida', signo: SIGNOS.BUENO });
    assert.equal(rangoDe(feo, 'Monfrida').escalon, 'nombradia', 'que te conozcan por algo feo también es que te conozcan');
    assert.deepEqual(rangoDe(feo, 'Monfrida'), rangoDe(bueno, 'Monfrida'), 'el signo cambia el escalón, y el rango mide cuánto te conocen y no cuánto te aprecian');
  });

  test('Un rumor oído en nivel 3 cuenta igual que uno oído en nivel 0', () => {
    const leyenda = conRumores(1, { nucleo: 'Monfrida', nivel: 3 });
    const fiel = conRumores(1, { nucleo: 'Monfrida', nivel: 0 });
    assert.deepEqual(rangoDe(leyenda, 'Monfrida'), rangoDe(fiel, 'Monfrida'));
    assert.equal(rangoDe(leyenda, 'Monfrida').escalon, 'nombradia');
  });

  test('El umbral de un escalón se alcanza, no se supera', () => {
    assert.equal(escalonPara(0), 'forasteria');
    assert.equal(escalonPara(RUMORES_PARA.nombradia), 'nombradia', 'el umbral de nombradía se supera en vez de alcanzarse');
    assert.equal(escalonPara(2), 'nombradia');
    assert.equal(escalonPara(RUMORES_PARA.pertenencia), 'pertenencia', 'el umbral de pertenencia se supera en vez de alcanzarse');

    // Y por la puerta de la consulta, que es la que usa el juego.
    assert.equal(rangoDe(conRumores(1), 'Monfrida').escalon, 'nombradia');
    assert.equal(rangoDe(conRumores(3), 'Monfrida').escalon, 'pertenencia');
  });

  test('Un paso solo añade', () => {
    // De lo que este escenario afirma, aquí se sostiene «ningún rango ha bajado», y
    // por construcción: cien pasos del mundo sin que llegue nada nuevo no mueven un
    // rango ya alcanzado, porque el rango no es estado que un paso pueda tocar.
    const { prop, nucleos } = propagacionSobre(mundoLineal(CADENA), { tramo: 2000 });
    prop.nace(desenlaceEn('Monfrida'), 0);
    avanza(prop, 10);
    const antes = CADENA.map((n) => rangoDe(nucleos, n));

    avanza(prop, 100, 11);
    const despues = CADENA.map((n) => rangoDe(nucleos, n));
    CADENA.forEach((n, i) => {
      assert.ok(ordinalDe(despues[i].escalon) >= ordinalDe(antes[i].escalon), `en "${n}" el rango ha bajado con los pasos del mundo`);
    });
    assert.deepEqual(despues, antes, 'cien pasos han movido un rango sin que llegara nada nuevo');
  });

  test('Consultar el rango dos veces sin que llegue nada devuelve lo mismo', () => {
    const nucleos = conRumores(2, { nucleo: 'Cadaval' });
    const primera = rangoDe(nucleos, 'Cadaval');
    for (let k = 0; k < 20; k++) rangoDe(nucleos, 'Cadaval');
    assert.deepEqual(rangoDe(nucleos, 'Cadaval'), primera, 'preguntar el rango lo cambia, y entonces no es función pura de lo oído');
    assert.equal(JSON.stringify(congelaNucleos(nucleos)).includes('escalon'), false, 'consultar el rango lo ha escrito en lo oído');
  });
});

describe('El rango no viaja entre mapas', () => {
  test('El rango no viaja entre mapas', () => {
    // Alguien de aquí en el mapa de casa...
    const { nucleos, motes } = { nucleos: conRumores(RUMORES_PARA.pertenencia, { nucleo: 'Monfrida' }), motes: estadoDeMotes() };
    assert.equal(rangoDe(nucleos, 'Monfrida').escalon, 'pertenencia');

    // ...y forastera en todos los núcleos del mapa nuevo, con el mismo estado de
    // partida y sin ninguna regla de traslado ni ninguna conversión: no hay nada que
    // trasladar, porque el rango se deriva de lo que ese mapa ha oído, y no ha oído
    // nada.
    const otroMapa = mapaDe(['Aldeia', 'Bouzas', 'Reboredo']);
    for (const nucleo of otroMapa.nucleos) {
      assert.deepEqual(
        rangoEn(nucleos, { mapaId: OTRO_MAPA, nucleo, mapa: otroMapa }),
        { escalon: 'forasteria', tono: TONOS_DE_RANGO.forasteria },
        `en "${nucleo}" del mapa nuevo no se empieza de cero`,
      );
    }
    assert.deepEqual(Object.keys(moduloDeRango).filter((n) => /traslad|convier|convers|migra|import/i.test(n)), []);
    assert.equal(moteEn(nucleos, { mapaId: OTRO_MAPA, nucleo: otroMapa.nucleos[0], mapa: otroMapa, motes }), null);
  });

  test('Un rumor que viaja en un mapa no mueve el rango de los núcleos del otro', () => {
    const nucleos = estadoDeNucleos();
    const otroMapa = mapaDe(['Aldeia', 'Bouzas', 'Reboredo']);
    const antes = otroMapa.nucleos.map((n) => rangoEn(nucleos, { mapaId: OTRO_MAPA, nucleo: n, mapa: otroMapa }));

    conRumores(RUMORES_PARA.pertenencia, { nucleos, nucleo: 'Monfrida', mapaId: MAPA });
    assert.equal(rangoDe(nucleos, 'Monfrida').escalon, 'pertenencia');
    assert.deepEqual(otroMapa.nucleos.map((n) => rangoEn(nucleos, { mapaId: OTRO_MAPA, nucleo: n, mapa: otroMapa })), antes);
  });

  test('En un mapa nuevo no hay ningún mote', () => {
    const { nucleos, motes } = { nucleos: estadoDeNucleos(), motes: estadoDeMotes() };
    oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r1', candidato: 'la-del-paquete', motes });
    const otroMapa = mapaDe(['Aldeia', 'Bouzas']);
    for (const nucleo of otroMapa.nucleos) {
      assert.equal(moteEn(nucleos, { mapaId: OTRO_MAPA, nucleo, mapa: otroMapa, motes }), null, `en "${nucleo}" del mapa nuevo ya hay un mote`);
    }
  });

  test('Pedir el rango de un núcleo contra otro mapa activo falla nombrando el mapa', () => {
    const nucleos = conRumores(1, { nucleo: 'Monfrida' });
    const otroMapa = mapaDe(['Aldeia', 'Bouzas']);
    assert.throws(() => rangoEn(nucleos, { mapaId: OTRO_MAPA, nucleo: 'Monfrida', mapa: otroMapa }), new RegExp(OTRO_MAPA));
    assert.throws(() => rangoEn(nucleos, { mapaId: OTRO_MAPA, nucleo: 'Monfrida', mapa: otroMapa }), /Monfrida/);
  });
});

describe('El rango no filtra nada de lo que se ofrece', () => {
  test('Una aventura se castea igual en un núcleo donde se está en el escalón de partida', async () => {
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    // El casting no recibe el rango, ni lo consulta: castear con la partida entera en
    // el escalón de partida da exactamente el mismo reparto que castear sin nada.
    const antes = JSON.stringify(castAll(mundo));
    conRumores(RUMORES_PARA.pertenencia, { nucleo: mundo.settlements[0].name });
    assert.equal(JSON.stringify(castAll(mundo)), antes, 'el reparto ha cambiado con el rango');

    const codigo = codigoDe(fuente('packages/nucleo/quests/casting.js'));
    for (const prohibido of ['rangoEn', 'escalon', 'ESCALONES_DE_RANGO', 'tonoDe', 'precioDe']) {
      assert.equal(codigo.includes(prohibido), false, `el casting mira "${prohibido}" y entonces el rango filtra el catálogo`);
    }
  });
});

describe('Determinismo de lo que se deriva', () => {
  test('Los rangos calculados dos veces desde cero salen idénticos', () => {
    const construye = () => {
      const nucleos = estadoDeNucleos();
      conRumores(3, { nucleos, nucleo: 'Monfrida' });
      conRumores(1, { nucleos, nucleo: 'Cadaval', desde: 50 });
      return CADENA.map((n) => rangoDe(nucleos, n));
    };
    assert.equal(JSON.stringify(construye()), JSON.stringify(construye()));
  });

  test('Dos partidas que oyeron lo mismo en orden distinto tienen los mismos rangos y los mismos motes', () => {
    const llegadas = [
      { nucleo: 'Monfrida', rumor: 'r1', nivel: 0, candidato: 'la-del-paquete' },
      { nucleo: 'Monfrida', rumor: 'r2', nivel: 2, candidato: 'la-que-cruzou' },
      { nucleo: 'Monfrida', rumor: 'r3', nivel: 1, candidato: 'la-del-paquete' },
      { nucleo: 'Cadaval', rumor: 'r2', nivel: 3, candidato: 'la-que-cruzou' },
    ];
    const partida = (orden) => {
      const nucleos = estadoDeNucleos();
      const motes = estadoDeMotes();
      for (const i of orden) oye(nucleos, { ...llegadas[i], mapaId: MAPA, motes });
      return JSON.stringify({
        rangos: CADENA.map((n) => rangoDe(nucleos, n)),
        motes: CADENA.map((n) => moteEn(nucleos, { mapaId: MAPA, nucleo: n, mapa: MAPA_ACTIVO, motes })),
      });
    };
    assert.equal(partida([0, 1, 2, 3]), partida([3, 2, 1, 0]));
    assert.equal(partida([0, 1, 2, 3]), partida([2, 0, 3, 1]));
  });

  test('Los rangos y los motes vuelven a salir de lo oído sin haber estado guardados aparte', () => {
    const nucleos = estadoDeNucleos();
    const motes = estadoDeMotes();
    oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r1', nivel: 1, candidato: 'la-del-paquete', motes });
    oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r2', nivel: 2, candidato: 'la-del-paquete', motes });
    const antes = CADENA.map((n) => ({ rango: rangoDe(nucleos, n), mote: moteEn(nucleos, { mapaId: MAPA, nucleo: n, mapa: MAPA_ACTIVO, motes }) }));

    const docNucleos = JSON.parse(JSON.stringify(congelaNucleos(nucleos)));
    const docMotes = JSON.parse(JSON.stringify(congelaMotes(motes)));
    // Lo guardado es lo oído y la declaración del candidato: ni un escalón, ni un
    // tono, ni un mote ya resuelto.
    for (const delator of ['escalon', 'tono', 'rango']) {
      assert.equal(JSON.stringify(docNucleos).includes(delator), false, `el documento de lo oído guarda "${delator}"`);
      assert.equal(JSON.stringify(docMotes).includes(delator), false, `el documento de los motes guarda "${delator}"`);
    }

    const vueltos = levantaNucleos(docNucleos);
    const vueltosMotes = levantaMotes(docMotes);
    const despues = CADENA.map((n) => ({ rango: rangoEn(vueltos, { mapaId: MAPA, nucleo: n, mapa: MAPA_ACTIVO }), mote: moteEn(vueltos, { mapaId: MAPA, nucleo: n, mapa: MAPA_ACTIVO, motes: vueltosMotes }) }));
    assert.deepEqual(despues, antes);
  });

  test('Ningún módulo de la progresión usa azar, reloj ni orden de inserción', () => {
    for (const ruta of LOS_CINCO_MODULOS) {
      const codigo = codigoDe(fuente(ruta));
      for (const prohibido of ['Math.random', 'Date.now', 'new Date', 'performance.now', 'process.env', 'navigator']) {
        assert.equal(codigo.includes(prohibido), false, `${ruta} usa ${prohibido}`);
      }
      // Ni iteración cuyo resultado dependa del orden de inserción: donde se recorre
      // un diccionario, se recorre por claves ordenadas.
      const recorridos = codigo.match(/Object\.keys\([^)]*\)(\.\w+\([^)]*\))?/g) ?? [];
      for (const recorrido of recorridos) {
        assert.ok(recorrido.includes('.sort('), `${ruta} recorre ${recorrido} sin ordenar, y eso depende del orden de inserción`);
      }
      assert.equal(/for\s*\(\s*const\s+\w+\s+of\s+new (Set|Map)/.test(codigo), false, `${ruta} itera un Set o un Map recién construido`);
    }
  });

  test('Ningún módulo de la progresión importa buildWorld ni ninguna fase de la generación', () => {
    for (const ruta of LOS_CINCO_MODULOS) {
      const codigo = codigoDe(fuente(ruta));
      for (const fase of ['buildWorld', 'generateSettlements', 'generateParajes', 'buildRoutes', 'construyeGrafo', 'generaCelda', 'fetchData']) {
        assert.equal(codigo.includes(fase), false, `${ruta} importa o menciona la fase ${fase}`);
      }
    }
    assert.equal(Object.keys(moduloDeMotes).length > 0, true);
  });
});

describe('Vacíos y entradas inválidas del rango', () => {
  test('Un núcleo que no existe en el mapa activo falla nombrando el núcleo', () => {
    const nucleos = conRumores(1);
    assert.throws(() => rangoDe(nucleos, 'Cambados'), /"Cambados"/);
    assert.throws(() => rangoDe(nucleos, ''), /rango se pide de un núcleo/);
    assert.throws(() => rangoEn(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', mapa: null }), /arbolDeCalzadas/);
  });

  test('Un mapa sin ningún núcleo no tiene rangos y no falla', () => {
    const vacio = mapaDe([]);
    assert.deepEqual(vacio.nucleos, []);
    assert.deepEqual(vacio.nucleos.map((n) => rangoEn(estadoDeNucleos(), { mapaId: MAPA, nucleo: n, mapa: vacio })), []);
    assert.deepEqual(IDS_DE_TONO, ['de-casa', 'de-fuera', 'de-oidas']);
  });
});
