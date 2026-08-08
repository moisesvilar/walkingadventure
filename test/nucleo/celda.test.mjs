// SPEC-003 · La generación de una celda: una celda es un mapa entero, es función
// de la semilla y de los datos de OSM, y una vez generada no se vuelve a generar.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales,
// aplicados aquí a una celda en vez de a un mundo suelto: es la misma afirmación
// sobre la unidad nueva que estrena esta spec. Nada toca la red ni el reloj.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { MARGEN_BORDE_M, generaCelda } from '../../packages/nucleo/world/celda.js';
import { creaRejilla, limitesDeCelda } from '../../packages/nucleo/world/rejilla.js';
import { semillaDeCelda } from '../../packages/nucleo/core/semilla.js';
import { abreCelda, celdasAbiertas, creaMapa } from '../../packages/nucleo/partida/mapa.js';
import { parseGeo, parsePois } from '../../packages/nucleo/world/osm.js';
import { generateSettlements } from '../../packages/nucleo/world/settlements.js';
import { generateParajes } from '../../packages/nucleo/world/parajes.js';
import { buildRoutes, pegarAViario } from '../../packages/nucleo/world/routes.js';
import { localeFor, namesFor } from '../../packages/nucleo/names/index.js';
import { mundoCongelado } from '../dobles/mundo-congelado.mjs';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import {
  SEMILLA_A,
  consultaDeFixture,
  consultaQueFalla,
  consultaVacia,
  coordenadaDe,
  nodosSinCongelar,
  serializado,
} from './celda-de-prueba.mjs';

const LOS_CUATRO = ['barrio-tres-calles', 'costero', 'suelo-250m', 'urbano-denso'];

/** La rejilla y el identificador de mapa que corresponden a un mundo congelado. */
function rejillaDe(nombre, tramoM = 2000) {
  const { lat, lon } = coordenadaDe(nombre);
  return creaRejilla({ lat, lon, tramoM });
}

function generaDe(nombre, { celda = { i: 0, j: 0 }, semilla = SEMILLA_A, tramoM = 2000, consultaOsm, ordenInvertido = false } = {}) {
  const rejilla = rejillaDe(nombre, tramoM);
  return generaCelda({
    rejilla,
    semilla,
    mapaId: rejilla.id,
    celda,
    consultaOsm: consultaOsm ?? consultaDeFixture(nombre, { ordenInvertido }),
  });
}

describe('La generación de una celda', () => {
  test('Dos generaciones con la misma semilla dan el mismo mundo', async () => {
    for (const nombre of LOS_CUATRO) {
      for (const celda of [{ i: 0, j: 0 }, { i: -2, j: 3 }]) {
        const a = await generaDe(nombre, { celda });
        const b = await generaDe(nombre, { celda });
        assert.equal(serializado(a), serializado(b), `${nombre} celda ${celda.i},${celda.j}: dos generaciones no dan la misma celda`);
      }
    }
  });

  test('El orden de iteración no depende del orden de inserción', async () => {
    for (const nombre of LOS_CUATRO) {
      const natural = await generaDe(nombre);
      const invertido = await generaDe(nombre, { ordenInvertido: true });
      assert.equal(
        serializado(invertido),
        serializado(natural),
        `${nombre}: la celda cambia si los datos de OSM llegan en otro orden`,
      );
    }
  });

  test('No se usa ninguna fuente de azar ni de tiempo del sistema', async () => {
    // El reloj se congela en dos instantes muy separados y se compara la celda
    // entera: una lectura del reloj dentro de la generación se vería aquí aunque
    // el análisis estático no la hubiera cazado.
    const DateReal = globalThis.Date;
    const performanceReal = globalThis.performance;
    const congelaReloj = (instante) => {
      class DateCongelada extends DateReal {
        constructor(...args) {
          super(...(args.length ? args : [instante]));
        }
        static now() {
          return instante;
        }
      }
      globalThis.Date = DateCongelada;
      globalThis.performance = { ...performanceReal, now: () => instante };
    };

    try {
      const celdas = {};
      for (const instante of [0, 1893456000000]) {
        congelaReloj(instante);
        for (const nombre of LOS_CUATRO) {
          const s = serializado(await generaDe(nombre));
          if (celdas[nombre] === undefined) celdas[nombre] = s;
          else assert.equal(s, celdas[nombre], `${nombre}: la celda cambia con el reloj del sistema`);
        }
      }
    } finally {
      globalThis.Date = DateReal;
      globalThis.performance = performanceReal;
    }
  });

  test('Cada fase usa su propio sufijo de azar', async () => {
    // Se rehacen las fases a mano con la semilla de la celda y se altera solo la
    // de parajes: si compartieran flujo de azar, los núcleos y las calzadas
    // saldrían distintos. Mundo sin costa a propósito, para que la tubería no dé
    // la segunda vuelta y las fases se puedan reproducir de una.
    const nombre = 'urbano-denso';
    const rejilla = rejillaDe(nombre);
    const celda = { i: 0, j: 0 };
    const registro = await generaDe(nombre, { celda });
    const semillaCelda = semillaDeCelda(SEMILLA_A, rejilla.id, celda);
    assert.equal(registro.semillaCelda, semillaCelda, 'la celda no se siembra con la semilla de celda declarada');

    const congelado = mundoCongelado(nombre);
    const { lat, lon } = registro.centro;
    const radio = rejilla.radioInscritoM;
    const names = namesFor(localeFor(lat, lon));
    const geo = parseGeo(congelado.geo, lat, lon);
    const anchors = parsePois(congelado.pois, lat, lon);

    const { settlements, freeAnchors } = generateSettlements(anchors, geo, radio, semillaCelda, null, names);
    pegarAViario(settlements, geo.roads);
    const routes = buildRoutes(settlements, geo.roads, semillaCelda, names);
    const parajes = generateParajes(freeAnchors, settlements, routes, geo, radio, `${semillaCelda}:otra-implementacion`, null, names);

    assert.notDeepEqual(
      parajes.map((p) => p.name),
      registro.mundo.parajes.map((p) => p.name),
      'la fase de parajes alterada tenía que dar otros parajes; si no, no se está comparando nada',
    );
    assert.deepEqual(
      settlements.map((s) => `${s.name}|${s.type}|${Math.round(s.x)},${Math.round(s.y)}`),
      registro.mundo.settlements.map((s) => `${s.name}|${s.type}|${Math.round(s.x)},${Math.round(s.y)}`),
      'los núcleos de la celda cambian al alterar la fase de parajes',
    );
    const calzadas = (rutas) => rutas.filter((r) => !r.ramal).map((r) => `${r.name}|${r.pts.length}`);
    assert.deepEqual(calzadas(routes), calzadas(registro.mundo.routes), 'las calzadas de la celda cambian al alterar la fase de parajes');
  });

  test('Una celda generada lleva registrados su índice, su lado, el anclaje, la semilla de partida y el mapa', async () => {
    const nombre = 'costero';
    const rejilla = rejillaDe(nombre);
    const celda = { i: 1, j: -2 };
    const registro = await generaDe(nombre, { celda });

    assert.deepEqual(registro.celda, celda);
    assert.equal(registro.clave, '1,-2');
    assert.equal(registro.ladoM, rejilla.ladoM);
    assert.equal(registro.radioInscritoM, rejilla.radioInscritoM);
    assert.deepEqual(registro.anclaje, rejilla.anclaje);
    assert.equal(registro.semillaPartida, SEMILLA_A);
    assert.equal(registro.mapaId, rejilla.id);
    assert.equal(registro.semillaCelda, semillaDeCelda(SEMILLA_A, rejilla.id, celda));
    assert.deepEqual(registro.limites, limitesDeCelda(rejilla, celda));
    assert.ok(registro.mundo && Array.isArray(registro.mundo.settlements), 'la celda no trae su mundo');
    assert.equal(typeof registro.sinContenidoJugable, 'boolean');
    assert.ok(['pisada', 'acontecimiento'].includes(registro.motivo));

    // La consulta de datos se pide por límites de celda más el margen del borde,
    // que es el umbral de cosido y no un número propio.
    const consulta = consultaDeFixture(nombre);
    await generaDe(nombre, { celda, consultaOsm: consulta });
    assert.ok(consulta.llamadas.length >= 1, 'no se ha consultado ningún dato');
    for (const peticion of consulta.llamadas) {
      assert.deepEqual(peticion.celda, celda, 'la consulta no dice de qué celda es');
      assert.deepEqual(peticion.limites, limitesDeCelda(rejilla, celda), 'la consulta no lleva los límites de la celda');
      assert.ok(peticion.margenM >= MARGEN_BORDE_M, `el margen de borde pedido (${peticion.margenM}) es menor que el umbral de cosido`);
    }
  });

  test('Una celda sin ninguna calle ni ningún anclaje dentro se crea igual y queda marcada como sin contenido jugable', async () => {
    const rejilla = rejillaDe('urbano-denso');
    const celda = { i: 9, j: 9 };
    const registro = await generaCelda({
      rejilla,
      semilla: SEMILLA_A,
      mapaId: rejilla.id,
      celda,
      consultaOsm: consultaVacia(),
    });

    assert.equal(registro.sinContenidoJugable, true, 'una celda sin calles ni anclajes no se ha marcado');
    assert.deepEqual(registro.celda, celda, 'la celda vacía no se ha creado');
    assert.deepEqual(registro.limites, limitesDeCelda(rejilla, celda), 'la celda vacía no trae sus límites');
    assert.deepEqual(registro.mundo.geo.roads, []);
    assert.deepEqual(registro.mundo.anchors, []);

    // Y una celda con datos dentro no se marca, para que la marca signifique algo.
    const llena = await generaDe('urbano-denso');
    assert.equal(llena.sinContenidoJugable, false, 'una celda con calles y anclajes se ha marcado como vacía');
  });

  test('Una consulta de datos que falla a mitad no deja ninguna celda a medias registrada como abierta', async () => {
    const { lat, lon } = coordenadaDe('urbano-denso');
    const mapa = creaMapa({ semilla: SEMILLA_A, lat, lon, tramoM: 2000 });

    await assert.rejects(
      () => abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm: consultaQueFalla() }),
      /Overpass no contesta/,
    );
    assert.deepEqual(celdasAbiertas(mapa), [], 'ha quedado una celda registrada como abierta después de fallar la consulta');
    assert.deepEqual(mapa.costuras, [], 'ha quedado una costura de una celda que no llegó a existir');

    // Y el mapa sigue siendo usable: la misma celda se abre bien cuando los datos
    // vuelven, sin arrastrar nada de la vez que falló.
    const { registro } = await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm: consultaDeFixture('urbano-denso') });
    assert.equal(celdasAbiertas(mapa).length, 1);
    assert.equal(serializado(registro), serializado(await generaDe('urbano-denso')), 'la celda abierta tras el fallo no es la que tocaba');
  });

  test('Pedir otra vez una celda ya generada devuelve la que existe y no genera nada nuevo', async () => {
    const { lat, lon } = coordenadaDe('barrio-tres-calles');
    const mapa = creaMapa({ semilla: SEMILLA_A, lat, lon, tramoM: 2000 });
    const consulta = consultaDeFixture('barrio-tres-calles');

    const primera = await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm: consulta });
    assert.equal(primera.generada, true);
    const consultasTrasLaPrimera = consulta.llamadas.length;
    assert.ok(consultasTrasLaPrimera > 0, 'la primera generación no ha pedido datos');

    const segunda = await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm: consulta });
    assert.equal(segunda.generada, false, 'se ha vuelto a generar una celda ya abierta');
    assert.equal(segunda.registro, primera.registro, 'no se ha devuelto la celda que ya existía, sino otra igual');
    assert.equal(consulta.llamadas.length, consultasTrasLaPrimera, 'se han pedido datos para una celda que ya estaba');
    assert.equal(celdasAbiertas(mapa).length, 1, 'la celda se ha registrado dos veces');
  });

  test('Una celda entregada al llamante no se puede modificar por detrás', async () => {
    const registro = await generaDe('urbano-denso');
    const antes = serializado(registro);

    assert.throws(() => { registro.motivo = 'acontecimiento'; }, TypeError, 'se ha podido cambiar el motivo de apertura');
    assert.throws(() => { registro.mundo.settlements.push({ name: 'Intrusa' }); }, TypeError, 'se ha podido meter un núcleo en una celda entregada');
    assert.throws(() => { registro.mundo.settlements[0].name = 'Otro nombre'; }, TypeError, 'se ha podido renombrar un núcleo de una celda entregada');
    assert.throws(() => { registro.limites.metros.minX = 0; }, TypeError, 'se han podido mover los límites de una celda entregada');
    assert.equal(serializado(registro), antes, 'la celda registrada ha cambiado');

    // Congelada hasta el fondo, no solo por arriba: un mundo es hondo y
    // `Object.freeze` solo protege el primer nivel.
    assert.deepEqual(nodosSinCongelar(registro), [], 'hay partes de la celda sin congelar');
  });

  // Aquí vivía «El mundo mínimo todavía compone un lazo», retirado de esta suite.
  // No se ha ablandado ni se ha marcado como pendiente: lo que exigía —que la celda
  // del tramo suelo castee al menos una plantilla con lazo cerrado— depende del suelo
  // de parajes derivado del catálogo, y eso es RF-MUNDO-007, que el checklist asigna
  // a las filas 4 (`tramo-personal`) y 6 (`parajes-cobertura-escenas`) y no a esta.
  // Lo hereda `docs/specs/SPEC-006-parajes-cobertura-escenas.md`; hoy no tiene prueba
  // viva y el hueco se ve por ausencia en `test/spec-test-map.json`. Es la segunda
  // fila seguida que lo hereda: en SPEC-002 se retiró por el mismo motivo.
  //
  // La medida que lo motiva, para que no haya que recalcularla: con `tramoM` = 250 m
  // (el tramo suelo), las celdas de `barrio-tres-calles` y `suelo-250m` castean cero
  // plantillas con lazo cerrado —la primera con 1 paraje, la segunda con 0—, y
  // `parajeCountForRadius` da 1 paraje con el radio inscrito de esa celda y 2 a 500 m,
  // cuando el cociente del catálogo vivo pide 3.

  test('Generar una celda entera no abre ninguna conexión de red', async () => {
    // La consulta de datos entra inyectada; si el núcleo tuviera otra puerta, el
    // inspector en modo estricto la cortaría y la generación fallaría.
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      for (const nombre of LOS_CUATRO) await generaDe(nombre);
      assert.deepEqual(inspector.peticiones(), []);
    } finally {
      inspector.suelta();
    }
  });
});
