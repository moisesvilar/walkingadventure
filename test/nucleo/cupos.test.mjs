// SPEC-004 · Los cupos de una celda, en tramos y calculados una sola vez.
//
// Dónde acaba esta fila y empieza la siguiente, porque es la confusión que ya ha
// costado dos reatribuciones: **aquí se calcula** el suelo de parajes derivado del
// catálogo y se congela con la celda; **quien lo gasta es la fila 6**
// (`parajes-cobertura-escenas`), que hoy sigue generando parajes con
// `parajeCountForRadius`. Por eso ninguna prueba de este fichero cuenta parajes
// generados: todas miran el número que esta fila entrega, no el mundo que otra
// fila tendrá que montar con él.
//
// Nada de aquí consume azar ni red: los mundos salen de los fixtures congelados.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESCENAS_POR_PARAJE,
  TRAMO_DE_REFERENCIA_M,
  cuposDeCelda,
  escenasPedidasPorElCatalogo,
  sueloDeParajes,
} from '../../packages/nucleo/world/cupos.js';
import { TEMPLATES } from '../../packages/nucleo/quests/templates.js';
import { countsForRadius } from '../../packages/nucleo/world/settlements.js';
import { creaRejilla } from '../../packages/nucleo/world/rejilla.js';
import { abreCelda, celdaAbierta, creaMapa } from '../../packages/nucleo/partida/mapa.js';
import { declaraTramo, tramoEnMetros } from '../../packages/nucleo/partida/tramo.js';
import { salidasOfrecidas } from '../../packages/nucleo/partida/salida.js';
import { SEMILLA_A, consultaDeFixture, coordenadaDe, serializado } from './celda-de-prueba.mjs';
import { fuente, modulosDelPaquete } from './mundo-de-prueba.mjs';

const RADIOS_EN_TRAMOS = [0.05, 0.125, 0.2, 0.25, 0.4, 0.5, 0.75, 1, 1.5, 2, 3, 5, 8, 12];

describe('Los cupos de la celda, calculados una vez', () => {
  test('Los cupos de una celda dependen de su tamaño en tramos y no de un radio en metros absolutos', () => {
    // La misma celda en tramos, medida por dos jugadoras que andan muy distinto:
    // en metros son dos celdas de tamaños muy diferentes y los cupos son los
    // mismos. Es justo lo que un cupo calibrado en metros no cumple.
    for (const radioEnTramos of RADIOS_EN_TRAMOS) {
      const unos = cuposDeCelda({ radioEnTramos });
      const otros = cuposDeCelda({ ladoEnTramos: radioEnTramos * 2 });
      assert.equal(serializado(otros), serializado(unos), `${radioEnTramos} tramos: declarar el lado en vez del radio da otros cupos`);
    }
    // Y la función no tiene por dónde recibir metros: no hay parámetro que los
    // acepte, así que no puede depender de ellos.
    const cupos = cuposDeCelda({ radioEnTramos: 1, radioM: 250, ladoM: 500 });
    assert.equal(serializado(cupos), serializado(cuposDeCelda({ radioEnTramos: 1 })), 'unos metros colados por la puerta han cambiado los cupos');
    assert.equal('radioM' in cupos, false);
  });

  test('El suelo de parajes cubre el vocabulario de escenas', () => {
    // El escenario de la batería, en la mitad que esta fila entrega: se cuentan
    // las escenas distintas que piden los roles, se dividen entre las que lleva un
    // paraje y ese cociente es el suelo del cupo de cualquier celda. La otra
    // mitad —que los parajes generados lleguen a ese suelo— es de la fila 6.
    const escenas = escenasPedidasPorElCatalogo();
    assert.ok(escenas.length > 0, 'el catálogo vivo no pide ni una escena de paraje');
    assert.deepEqual([...escenas].sort(), escenas, 'las escenas no salen en orden estable');
    assert.equal(new Set(escenas).size, escenas.length, 'las escenas se cuentan repetidas');

    const cociente = Math.ceil(escenas.length / ESCENAS_POR_PARAJE);
    const { suelo } = sueloDeParajes();
    assert.equal(suelo, cociente, 'el suelo no es el cociente del catálogo');
    // Con el catálogo de hoy: siete escenas distintas entre dos por paraje, cuatro.
    assert.equal(escenas.length, 7, `el catálogo vivo pide ${escenas.length} escenas y no las siete de las que sale el 4`);
    assert.equal(suelo, 4);

    for (const radioEnTramos of RADIOS_EN_TRAMOS) {
      const { parajes } = cuposDeCelda({ radioEnTramos });
      assert.equal(parajes.suelo, cociente, `${radioEnTramos} tramos: el suelo no es el del catálogo`);
      assert.ok(parajes.cupo >= cociente, `${radioEnTramos} tramos: el cupo (${parajes.cupo}) queda por debajo del suelo derivado (${cociente})`);
      assert.equal(parajes.escenasPedidas, escenas.length);
      assert.equal(parajes.escenasPorParaje, ESCENAS_POR_PARAJE);
    }
  });

  test('Un catálogo que se ensancha sube el suelo solo, sin tocar ninguna constante', () => {
    const ancho = [
      ...TEMPLATES,
      {
        id: 'plantilla-de-prueba',
        roles: {
          uno: { tipo: 'paraje', escena: 'naufragio' },
          dos: { tipo: 'paraje', escena: ['trueque', 'vigía'] },
          tres: { tipo: 'servicio', kind: 'taberna' },
        },
        beats: [],
      },
    ];
    const antes = sueloDeParajes();
    const despues = sueloDeParajes(ancho);
    assert.equal(despues.escenas.length, antes.escenas.length + 3, 'las escenas nuevas no se han contado');
    assert.ok(despues.suelo > antes.suelo, `el suelo no ha subido al ensanchar el catálogo: ${antes.suelo} → ${despues.suelo}`);
    assert.equal(despues.suelo, Math.ceil(despues.escenas.length / ESCENAS_POR_PARAJE));

    // Y sube en los cupos de una celda nueva, que es donde se nota.
    const cupos = cuposDeCelda({ radioEnTramos: 0.25, plantillas: ancho });
    assert.equal(cupos.parajes.suelo, despues.suelo);
    assert.ok(cupos.parajes.cupo >= despues.suelo);
    // Un rol de paraje sin escena no inventa vocabulario.
    const sinEscena = sueloDeParajes([{ id: 'x', roles: { uno: { tipo: 'paraje' } }, beats: [] }, ...TEMPLATES]);
    assert.equal(sinEscena.escenas.length, antes.escenas.length);
  });

  test('El cupo por ritmo es un techo, no un objetivo', () => {
    // El escenario de la batería, en la mitad que esta fila entrega: el número que
    // se le pide a una celda pequeña con anclajes de sobra queda entre el suelo
    // derivado y el techo por ritmo, los dos incluidos. Contar los parajes
    // realmente generados es de la fila 6.
    const { suelo } = sueloDeParajes();
    for (const radioEnTramos of RADIOS_EN_TRAMOS) {
      const { parajes } = cuposDeCelda({ radioEnTramos });
      const minimo = Math.min(parajes.suelo, parajes.techo);
      const maximo = Math.max(parajes.suelo, parajes.techo);
      assert.ok(parajes.cupo >= minimo && parajes.cupo <= maximo, `${radioEnTramos} tramos: el cupo ${parajes.cupo} se sale de [${minimo}, ${maximo}]`);
      assert.equal(parajes.suelo, suelo);
      assert.ok(parajes.techo >= 1, `${radioEnTramos} tramos: el techo por ritmo es ${parajes.techo}`);
    }
    // Con el techo por encima del suelo, el cupo es el techo y no más: más hitos
    // no añaden beats a una salida.
    const grande = cuposDeCelda({ radioEnTramos: 2 });
    assert.ok(grande.parajes.techo > grande.parajes.suelo, 'la celda grande no tiene el techo por encima del suelo');
    assert.equal(grande.parajes.cupo, grande.parajes.techo);
  });

  test('Una celda cuyo techo por ritmo queda por debajo del suelo derivado se queda con el suelo', () => {
    const pequena = cuposDeCelda({ radioEnTramos: 0.125 });
    assert.ok(pequena.parajes.techo < pequena.parajes.suelo, 'la celda más pequeña no tiene el techo por debajo del suelo');
    assert.equal(pequena.parajes.cupo, pequena.parajes.suelo, 'cuando chocan no ha ganado el suelo');
  });

  test('El techo de parajes satura y no crece indefinidamente con el tamaño de la celda', () => {
    const dos = cuposDeCelda({ radioEnTramos: 2 }).parajes;
    for (const radioEnTramos of [2, 4, 10, 100, 1000]) {
      const { parajes } = cuposDeCelda({ radioEnTramos });
      assert.equal(parajes.techo, dos.techo, `${radioEnTramos} tramos: el techo ha crecido a ${parajes.techo}`);
      assert.equal(parajes.cupo, dos.cupo, `${radioEnTramos} tramos: el cupo ha crecido a ${parajes.cupo}`);
    }
    // Y crece hasta ahí: no es una constante disfrazada.
    assert.ok(cuposDeCelda({ radioEnTramos: 0.25 }).parajes.techo < dos.techo);
  });

  test('Los cupos de núcleos con el tramo de referencia coinciden con la tabla del prototipo', () => {
    assert.equal(TRAMO_DE_REFERENCIA_M, 2000, 'el tramo de referencia ya no es el que calibró las tablas de hoy');
    for (const radioM of [100, 249, 250, 300, 499, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000, 30000]) {
      const cupos = cuposDeCelda({ radioEnTramos: radioM / TRAMO_DE_REFERENCIA_M });
      const [ciudad, pueblo, aldea, granja] = countsForRadius(radioM);
      assert.deepEqual(
        { ciudad: cupos.nucleos.ciudad, pueblo: cupos.nucleos.pueblo, aldea: cupos.nucleos.aldea, granja: cupos.nucleos.granja },
        { ciudad, pueblo, aldea, granja },
        `radio ${radioM} m: los cupos reexpresados en tramos no dan los del prototipo`,
      );
      assert.equal(cupos.nucleos.total, ciudad + pueblo + aldea + granja);
    }
  });

  test('Los cupos calculados dos veces son idénticos y el cálculo no consume azar', () => {
    for (const radioEnTramos of RADIOS_EN_TRAMOS) {
      const primera = cuposDeCelda({ radioEnTramos });
      for (let k = 0; k < 3; k++) {
        assert.equal(serializado(cuposDeCelda({ radioEnTramos })), serializado(primera), `${radioEnTramos} tramos: dos cálculos dan cupos distintos`);
      }
      assert.equal(Object.isFrozen(primera), true, 'los cupos no se entregan congelados');
    }
    // No consume azar: el módulo no tiene generador al que pedirle nada, ni
    // recorre ningún conjunto sin ordenar antes.
    const texto = fuente('packages/nucleo/world/cupos.js');
    for (const azar of [/makeRng/, /Math\s*\.\s*random/, /\brng\s*\(/]) {
      assert.equal(azar.test(texto), false, `el cálculo de cupos consume azar (${azar})`);
    }
  });

  test('Un catálogo de plantillas vacío falla nombrando el catálogo', () => {
    for (const vacio of [[], undefined && [], null, 'TEMPLATES', {}]) {
      if (vacio === undefined) continue;
      assert.throws(
        () => cuposDeCelda({ radioEnTramos: 1, plantillas: vacio }),
        (e) => {
          assert.match(e.message, /catálogo de plantillas/, `el error no nombra el catálogo: ${e.message}`);
          return true;
        },
        `se han calculado cupos con el catálogo ${JSON.stringify(vacio)}`,
      );
    }
    // Un catálogo con plantillas pero sin una sola escena de paraje tampoco vale un
    // suelo de cero: el suelo no se puede derivar de él.
    assert.throws(
      () => cuposDeCelda({ radioEnTramos: 1, plantillas: [{ id: 'sin-parajes', roles: { uno: { tipo: 'servicio', kind: 'taberna' } }, beats: [] }] }),
      /ni una escena de paraje/,
    );
    assert.throws(() => sueloDeParajes([]), /catálogo de plantillas/);
  });

  test('Una celda sin tamaño declarado falla nombrando el dato que falta', () => {
    for (const sinTamano of [{}, undefined, { radioEnTramos: 0 }, { radioEnTramos: -1 }, { radioEnTramos: '1' }, { ladoEnTramos: NaN }]) {
      assert.throws(
        () => cuposDeCelda(sinTamano),
        (e) => {
          assert.match(e.message, /la celda no declara su tamaño/, `el error no dice qué falta: ${e.message}`);
          assert.match(e.message, /radioEnTramos/, `el error no nombra el dato: ${e.message}`);
          return true;
        },
        `se han calculado cupos con ${JSON.stringify(sinTamano)}`,
      );
    }
  });
});

describe('El tramo no redimensiona lo que ya existe', () => {
  /** Un mapa con la celda 0,0 ya abierta con el tramo largo. */
  async function mapaConCeldaAbierta(nombre = 'urbano-denso', tramoM = 2000) {
    const { lat, lon } = coordenadaDe(nombre);
    const mapa = creaMapa({ semilla: SEMILLA_A, lat, lon, tramoM });
    const { registro } = await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm: consultaDeFixture(nombre), tramoM });
    return { mapa, registro };
  }

  test('Cambiar el tramo del jugador no redimensiona un mundo ya generado', async () => {
    const { mapa, registro } = await mapaConCeldaAbierta();
    const antes = serializado(registro);
    const cuposAntes = serializado(registro.cupos);

    // La jugadora se mide de nuevo y le sale un tramo mucho más corto.
    const viejo = tramoEnMetros(2000);
    const nuevo = tramoEnMetros(600);

    // Abrir otra celda con el tramo nuevo, que es lo que de verdad pasa al jugar.
    await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm: consultaDeFixture('urbano-denso'), tramoM: nuevo.estimadoM });

    const despues = celdaAbierta(mapa, { i: 0, j: 0 });
    assert.equal(serializado(despues), antes, 'el mundo ya generado ha cambiado al cambiar el tramo');
    assert.equal(serializado(despues.cupos), cuposAntes, 'los cupos congelados de la celda se han recalculado');
    assert.equal(despues.tramoM, 2000, 'la celda vieja ha cambiado de tramo');

    // Pero las aventuras que se ofrecen mandan a sitios más cercanos.
    const ofrecidasAntes = salidasOfrecidas(viejo);
    const ofrecidasDespues = salidasOfrecidas(nuevo);
    for (let k = 0; k < ofrecidasAntes.length; k++) {
      assert.equal(ofrecidasDespues[k].tamano, ofrecidasAntes[k].tamano);
      assert.ok(
        ofrecidasDespues[k].metros < ofrecidasAntes[k].metros,
        `la salida "${ofrecidasAntes[k].tamano}" no manda más cerca tras bajar el tramo`,
      );
      assert.equal(ofrecidasDespues[k].beats, ofrecidasAntes[k].beats, 'la salida ha cambiado de número de beats');
    }
  });

  test('Una celda nueva se dimensiona con el tramo nuevo y la vieja sigue con el suyo', async () => {
    const { mapa } = await mapaConCeldaAbierta();
    const vieja = celdaAbierta(mapa, { i: 0, j: 0 });
    await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm: consultaDeFixture('urbano-denso'), tramoM: 600 });
    const nueva = celdaAbierta(mapa, { i: 1, j: 0 });

    assert.equal(vieja.tramoM, 2000);
    assert.equal(nueva.tramoM, 600, 'la celda nueva no se ha dimensionado con el tramo nuevo');
    assert.equal(serializado(nueva.cupos), serializado(cuposDeCelda({ radioEnTramos: mapa.rejilla.radioInscritoM / 600 })), 'los cupos de la celda nueva no salen de su tramo');
    assert.notEqual(serializado(nueva.cupos), serializado(vieja.cupos), 'las dos celdas tienen los mismos cupos con tramos distintos');
    // La geometría no se mueve: mover el lado rompería los índices y las costuras.
    assert.equal(nueva.ladoM, vieja.ladoM, 'la celda nueva mide otro lado');
  });

  test('Las celdas conservan su tamaño y sus cupos al serializar y volver a cargar la partida', async () => {
    const { mapa } = await mapaConCeldaAbierta();
    await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm: consultaDeFixture('urbano-denso'), tramoM: 600 });

    const guardada = serializado(mapa);
    const cargada = JSON.parse(guardada);
    assert.equal(serializado(cargada), guardada, 'la partida no sobrevive a una vuelta por disco');
    for (const original of mapa.celdas) {
      const vuelta = cargada.celdas.find((c) => c.clave === original.clave);
      assert.ok(vuelta, `la celda ${original.clave} no ha vuelto de la carga`);
      assert.equal(vuelta.tramoM, original.tramoM, `la celda ${original.clave} ha perdido el tramo con el que se generó`);
      assert.equal(serializado(vuelta.cupos), serializado(original.cupos), `la celda ${original.clave} ha perdido sus cupos`);
    }
    assert.deepEqual(cargada.celdas.map((c) => c.tramoM).sort((a, b) => a - b), [600, 2000], 'las dos celdas no conservan tramos distintos');
  });

  test('El módulo de cupos solo se invoca al crear una celda', () => {
    const llaman = modulosDelPaquete().filter((m) => m !== 'packages/nucleo/world/cupos.js' && /\bcuposDeCelda\s*\(/.test(fuente(m)));
    assert.deepEqual(llaman, ['packages/nucleo/world/celda.js'], `los cupos se calculan fuera de la generación de una celda: ${llaman.join(', ')}`);

    // Y dentro de celda.js se calculan una sola vez, en la generación.
    const texto = fuente('packages/nucleo/world/celda.js');
    assert.equal((texto.match(/cuposDeCelda\s*\(/g) ?? []).length, 1, 'celda.js calcula los cupos más de una vez');
    // Abrir una partida, cambiar el tramo o pintar no pasan por aquí: ni mapa.js ni
    // el módulo del tramo lo importan.
    for (const modulo of ['packages/nucleo/partida/mapa.js', 'packages/nucleo/partida/tramo.js', 'packages/nucleo/partida/salida.js']) {
      assert.equal(/cupos\.js/.test(fuente(modulo)), false, `${modulo} importa el módulo de cupos`);
    }
  });

  test('Leer los cupos de una celda abierta no los recalcula', async () => {
    const { mapa, registro } = await mapaConCeldaAbierta();
    const antes = serializado(registro.cupos);
    for (let k = 0; k < 5; k++) {
      assert.equal(serializado(celdaAbierta(mapa, { i: 0, j: 0 }).cupos), antes, 'leer los cupos los ha cambiado');
    }
    // Volver a pisar la celda tampoco: ya estaba abierta y no se genera nada.
    const consulta = consultaDeFixture('urbano-denso');
    const otra = await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm: consulta, tramoM: 600 });
    assert.equal(otra.generada, false, 'la celda se ha vuelto a generar');
    assert.equal(consulta.llamadas.length, 0, 'se han vuelto a pedir datos de una celda ya abierta');
    assert.equal(serializado(otra.registro.cupos), antes, 'los cupos se han recalculado con el tramo nuevo');
    assert.equal(Object.isFrozen(registro.cupos), true, 'los cupos de una celda registrada no están congelados');
  });

  test('Los cupos que se congelan son los del tramo con el que se abrió la celda', async () => {
    for (const tramoM of [600, 2000]) {
      const { mapa, registro } = await mapaConCeldaAbierta('barrio-tres-calles', tramoM);
      assert.equal(registro.tramoM, tramoM);
      assert.equal(
        serializado(registro.cupos),
        serializado(cuposDeCelda({ radioEnTramos: mapa.rejilla.radioInscritoM / tramoM })),
        `con tramo ${tramoM} los cupos congelados no son los de su tamaño en tramos`,
      );
      // Con el tramo de la rejilla, la celda mide un tramo de radio por
      // construcción, así que los cupos son los del radio de un tramo.
      assert.equal(serializado(registro.cupos), serializado(cuposDeCelda({ radioEnTramos: 1 })));
    }
  });

  test('Una celda abierta sin decir el tramo se dimensiona con el de la rejilla', async () => {
    const { lat, lon } = coordenadaDe('barrio-tres-calles');
    const mapa = creaMapa({ semilla: SEMILLA_A, lat, lon, tramoM: 900 });
    const { registro } = await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm: consultaDeFixture('barrio-tres-calles') });
    assert.equal(registro.tramoM, 900, 'sin tramo declarado la celda no cae en el de la rejilla');
    assert.equal(serializado(registro.cupos), serializado(cuposDeCelda({ radioEnTramos: 1 })));
    // Y el estado del tramo del personaje sirve tal cual donde se pide un número.
    assert.equal(declaraTramo('par-de-manzanas').estimadoM, 700);
  });
});
