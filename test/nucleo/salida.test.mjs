// SPEC-004 · El tamaño de una salida: la perilla que dimensiona **hasta dónde te
// mandan**, separada de la que dimensiona **lo que existe**.
//
// Lo que se afirma aquí es sobre todo una separación: que los beats son los
// mismos para todo el mundo y los metros no, y que en el paquete no queda ninguna
// función que reciba el tamaño de la celda y el tamaño de la salida como si
// fueran el mismo parámetro —que es lo que hacía `PRESETS` en el prototipo—.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  IDS_DE_TAMANO,
  TAMANOS_DE_SALIDA,
  dimensionaSalida,
  salidasOfrecidas,
} from '../../packages/nucleo/partida/salida.js';
import {
  IDS_DE_RESPUESTA,
  SEGUNDOS_POR_TRAMO,
  declaraTramo,
  tramoDeRespuesta,
  tramoEnMetros,
} from '../../packages/nucleo/partida/tramo.js';
import { fuente, modulosDelPaquete } from './mundo-de-prueba.mjs';

describe('Los dos tamaños que no son el mismo', () => {
  test('Los tres tamaños de salida son palabras del mundo con su medida en tramos, sin metros', () => {
    assert.equal(TAMANOS_DE_SALIDA.length, 3, 'los tamaños de salida no son tres');
    assert.deepEqual([...IDS_DE_TAMANO], ['paseo', 'aventura', 'jornada']);

    for (const tamano of TAMANOS_DE_SALIDA) {
      assert.deepEqual(Object.keys(tamano).sort(), ['beats', 'id', 'tramos'], `${tamano.id} declara algo más que su palabra, sus tramos y sus beats`);
      assert.ok(Number.isInteger(tamano.tramos) && tamano.tramos > 0, `${tamano.id}: los tramos no son un entero positivo`);
      assert.ok(Number.isInteger(tamano.beats) && tamano.beats > 0, `${tamano.id}: los beats no son un entero positivo`);
      // Ninguno lleva metros: los metros los pone el tramo de cada cual.
      for (const campo of ['metros', 'metrosM', 'km', 'distanciaM']) {
        assert.equal(campo in tamano, false, `${tamano.id} lleva "${campo}": el catálogo no puede traer metros`);
      }
    }
    // Y están ordenados de menor a mayor, que es lo que hace que el catálogo se
    // pueda ofrecer tal cual.
    for (let k = 1; k < TAMANOS_DE_SALIDA.length; k++) {
      assert.ok(TAMANOS_DE_SALIDA[k].tramos > TAMANOS_DE_SALIDA[k - 1].tramos, 'los tamaños no van de menor a mayor');
      assert.ok(TAMANOS_DE_SALIDA[k].beats > TAMANOS_DE_SALIDA[k - 1].beats);
    }
  });

  test('Dos jugadores con tramos distintos reciben aventuras del mismo tamaño en pasos', () => {
    // El escenario de la batería, ahora entero: la mitad geométrica ya la afirma
    // rejilla.test.mjs sobre el tamaño de la celda; esta es la de los beats.
    const largo = tramoEnMetros(2000);
    const corto = tramoEnMetros(600);

    const suya = dimensionaSalida('paseo', largo);
    const nuestra = dimensionaSalida('paseo', corto);
    assert.equal(suya.beats, nuestra.beats, 'las dos salidas no tienen el mismo número de beats');
    assert.equal(suya.tramos, nuestra.tramos, 'las dos salidas no miden los mismos tramos');
    assert.notEqual(suya.metros, nuestra.metros, 'las dos salidas miden lo mismo en metros: el tramo no dimensiona nada');

    // Y la distancia real de la segunda es aproximadamente la tercera parte.
    const proporcion = nuestra.metros / suya.metros;
    assert.ok(Math.abs(proporcion - 1 / 3) < 0.05, `la salida corta mide ${(proporcion * 100).toFixed(0)} % de la larga y no una tercera parte`);
    assert.equal(proporcion, 600 / 2000, 'los metros no escalan exactamente con el tramo');
  });

  test('Avanza igual quien anda 6 km y quien anda 900 m', () => {
    // Lo que esta fila puede afirmar del escenario: ninguna de las cuatro
    // respuestas del arranque da menos juego que otra. La misma salida trae los
    // mismos beats y los mismos tramos para las cuatro, y solo cambian los metros.
    // Que además suban lo mismo de rango es de la fila del rango social, que no
    // existe todavía.
    for (const tamano of IDS_DE_TAMANO) {
      const dimensionadas = IDS_DE_RESPUESTA.map((id) => dimensionaSalida(tamano, declaraTramo(id)));
      const beats = new Set(dimensionadas.map((s) => s.beats));
      const tramos = new Set(dimensionadas.map((s) => s.tramos));
      assert.equal(beats.size, 1, `${tamano}: las cuatro respuestas dan distinto número de beats (${[...beats].join(', ')})`);
      assert.equal(tramos.size, 1, `${tamano}: las cuatro respuestas dan distinto número de tramos`);
      assert.equal(new Set(dimensionadas.map((s) => s.metros)).size, 4, `${tamano}: dos respuestas mandan a la misma distancia`);

      // Y los metros van en el mismo orden que los tramos declarados: quien anda
      // menos no recibe una salida más larga por serlo.
      const metros = dimensionadas.map((s) => s.metros);
      for (let k = 1; k < metros.length; k++) assert.ok(metros[k] > metros[k - 1], `${tamano}: los metros no siguen al tramo`);
    }
  });

  test('Ninguna separación entre dos beats consecutivos supera media hora al ritmo de esa jugadora', () => {
    for (const id of [...IDS_DE_RESPUESTA]) {
      const tramo = declaraTramo(id);
      for (const tamano of IDS_DE_TAMANO) {
        const salida = dimensionaSalida(tamano, tramo);
        assert.ok(salida.tramosPorBeat <= 1, `${id}/${tamano}: entre dos beats hay ${salida.tramosPorBeat} tramos, más de media hora`);
        assert.ok(salida.metrosPorBeat <= tramo.estimadoM, `${id}/${tamano}: entre dos beats hay ${salida.metrosPorBeat} m y el tramo son ${tramo.estimadoM} m`);
        // Y en segundos, que es lo que significa «media hora».
        const segundosPorBeat = (salida.metrosPorBeat / tramo.estimadoM) * SEGUNDOS_POR_TRAMO;
        assert.ok(segundosPorBeat <= SEGUNDOS_POR_TRAMO, `${id}/${tamano}: ${Math.round(segundosPorBeat)} s entre beats`);
        assert.equal(salida.metros, salida.tramos * tramo.estimadoM);
      }
    }
  });

  test('Un tamaño de salida fuera del catálogo falla enumerando los tres válidos', () => {
    for (const malo of ['excursion', '', 'PASEO', undefined, null, 4, {}, { id: 'paseíto' }]) {
      assert.throws(
        () => dimensionaSalida(malo, 2000),
        (e) => {
          assert.match(e.message, /tamaño de salida desconocido/, `el error no dice qué pasa: ${e.message}`);
          for (const id of IDS_DE_TAMANO) assert.match(e.message, new RegExp(id), `el error no enumera "${id}": ${e.message}`);
          return true;
        },
        `se ha aceptado el tamaño ${JSON.stringify(malo)}`,
      );
    }
  });

  test('Dimensionar una salida con un tramo ausente o no numérico falla nombrando el dato que falta', () => {
    for (const malo of [undefined, null, '2000', NaN, Infinity, 0, -600, true]) {
      assert.throws(
        () => dimensionaSalida('paseo', malo),
        (e) => {
          assert.match(e.message, /tramoM|tramo declarado/, `el error no nombra el dato que falta: ${e.message}`);
          return true;
        },
        `se ha dimensionado una salida con el tramo ${JSON.stringify(malo)}`,
      );
    }
    // Un objeto que no trae el tramo falla nombrando el tramo declarado, no
    // devolviendo un valor por defecto.
    assert.throws(() => dimensionaSalida('paseo', {}), /falta el tramo declarado/);
    assert.throws(() => salidasOfrecidas(undefined), /tramoM/);
  });

  test('Las tres salidas ofrecidas se dimensionan con el tramo de quien pregunta y se entregan congeladas', () => {
    const tramo = declaraTramo('otro-barrio');
    const ofrecidas = salidasOfrecidas(tramo);
    assert.equal(ofrecidas.length, 3);
    assert.deepEqual(ofrecidas.map((s) => s.tamano), [...IDS_DE_TAMANO]);
    for (const salida of ofrecidas) {
      assert.equal(salida.metros, dimensionaSalida(salida.tamano, tramo).metros);
      assert.equal(Object.isFrozen(salida), true, `la salida ${salida.tamano} no se entrega congelada`);
    }
    // Un número suelto vale igual que el estado del tramo: es la misma puerta.
    assert.equal(salidasOfrecidas(1200)[0].metros, ofrecidas[0].metros);
    assert.equal(dimensionaSalida('paseo', tramoDeRespuesta('otro-barrio')).metros, ofrecidas[0].metros);
  });

  test('No existe ninguna función que reciba el tamaño de la celda y el tamaño de la salida como si fueran lo mismo', () => {
    // El prototipo mezclaba las dos cosas en `PRESETS`, con un solo nombre. Aquí
    // se comprueba por el nombre del parámetro: una firma que reciba a la vez el
    // tamaño en tramos de una celda y el tamaño de una salida sería la vuelta.
    for (const modulo of modulosDelPaquete()) {
      const texto = fuente(modulo);
      assert.equal(/\bPRESETS\b/.test(texto), false, `${modulo} trae de vuelta PRESETS, que mezclaba las dos perillas`);
      for (const firma of texto.matchAll(/(?:function\s+\w+|=>)?\s*\(([^)]*)\)/g)) {
        const parametros = firma[1];
        const dimensionaCelda = /\b(radioEnTramos|ladoEnTramos)\b/.test(parametros);
        const dimensionaSalidaTambien = /\b(tamanoDeSalida|tamañoDeSalida|tamano|preset)\b/.test(parametros);
        assert.equal(
          dimensionaCelda && dimensionaSalidaTambien,
          false,
          `${modulo}: una firma recibe el tamaño de la celda y el de la salida a la vez → (${parametros.trim()})`,
        );
      }
    }

    // Y los dos catálogos son dos, con dos nombres distintos y sin intersección de
    // identificadores: ningún «paseo» que sea a la vez un tamaño de celda.
    const compartidos = IDS_DE_TAMANO.filter((id) => IDS_DE_RESPUESTA.includes(id));
    assert.deepEqual(compartidos, [], `los dos catálogos comparten identificadores: ${compartidos.join(', ')}`);
  });
});
