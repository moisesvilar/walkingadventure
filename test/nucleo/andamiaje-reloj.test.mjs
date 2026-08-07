// SPEC-001 · El reloj de mundo.
//
// El mundo avanza con los kilómetros del jugador, no con el calendario. Lo que se
// afirma aquí es lo que sostiene esa regla desde el andamiaje: que se avanza
// pidiéndolo, que el motor recibe los pasos uno a uno y numerados (el contenido
// de un paso lo decide su número), y que dejar pasar tiempo real no mueve nada.
//
// El motor de pasos de verdad llega con SPEC-011; aquí se inyecta un espía, que
// es justo el contrato que el reloj declara.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { creaRelojDeMundo } from '../dobles/reloj-mundo.mjs';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

function espia() {
  const recibidos = [];
  const fn = (n) => recibidos.push(n);
  fn.recibidos = recibidos;
  return fn;
}

describe('El reloj de mundo', () => {
  test('Un reloj de mundo recién creado marca cero pasos', () => {
    assert.equal(creaRelojDeMundo({ motorDePasos: espia() }).pasos(), 0);
    assert.equal(creaRelojDeMundo().pasos(), 0, 'sin motor tampoco inventa pasos');
  });

  test('Pedirle avanzar siete pasos da al motor siete avances consecutivos numerados del uno al siete', () => {
    const motor = espia();
    const reloj = creaRelojDeMundo({ motorDePasos: motor });

    assert.equal(reloj.avanza(7), 7);
    assert.deepEqual(motor.recibidos, [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(reloj.pasos(), 7);

    // Y la numeración continúa: un paso solo añade, nunca reinicia.
    reloj.avanza(3);
    assert.deepEqual(motor.recibidos, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(reloj.pasos(), 10);
  });

  test('Un objeto con paso(n) sirve igual que una función como motor de pasos', () => {
    // El motor real será un objeto y una prueba casi siempre quiere una función:
    // si solo valiera una de las dos formas, las pruebas de rumores tendrían que
    // envolverlo, y envolver un motor es una manera silenciosa de perder pasos.
    const recibidos = [];
    const reloj = creaRelojDeMundo({ motorDePasos: { paso: (n) => recibidos.push(n) } });
    reloj.avanza(3);
    assert.deepEqual(recibidos, [1, 2, 3]);
  });

  test('Pasar tiempo real sin pedirle nada deja el reloj de mundo donde estaba', async () => {
    const motor = espia();
    const reloj = creaRelojDeMundo({ motorDePasos: motor });
    reloj.avanza(4);

    const antesDeEsperar = reloj.pasos();
    await new Promise((listo) => setTimeout(listo, 25));

    assert.equal(reloj.pasos(), antesDeEsperar);
    assert.deepEqual(motor.recibidos, [1, 2, 3, 4], 'el motor no puede haber recibido nada mientras nadie pedía');
  });

  test('Un reloj de mundo sin motor inyectado falla nombrando la dependencia que falta', () => {
    for (const dependencias of [undefined, {}, { motorDePasos: null }]) {
      assert.throws(
        () => creaRelojDeMundo(dependencias).avanza(1),
        (e) => {
          assert.match(e.message, /motorDePasos/);
          return true;
        },
      );
    }
  });

  test('Pedir avanzar un número de pasos que no es un entero positivo falla con un error explícito', () => {
    const reloj = creaRelojDeMundo({ motorDePasos: espia() });
    for (const n of [0, -1, 2.5, '3', NaN, undefined, null]) {
      assert.throws(
        () => reloj.avanza(n),
        (e) => {
          assert.match(e.message, /entero positivo/);
          return true;
        },
        `avanza(${String(n)}) tenía que fallar`,
      );
    }
    assert.equal(reloj.pasos(), 0, 'una llamada inválida no puede haber movido el reloj');
  });

  test('El reloj de mundo no usa temporizadores ni ninguna lectura del reloj del sistema', () => {
    const fuente = readFileSync(join(RAIZ_REPO, 'test', 'dobles', 'reloj-mundo.mjs'), 'utf8');
    const prohibidos = [
      /\bsetTimeout\s*\(/,
      /\bsetInterval\s*\(/,
      /\bsetImmediate\s*\(/,
      /Date\.now\s*\(/,
      /new\s+Date\b/,
      /performance\.now\s*\(/,
      /process\.hrtime\b/,
    ];
    for (const prohibido of prohibidos) {
      assert.equal(prohibido.test(fuente), false, `reloj-mundo.mjs usa ${prohibido}`);
    }
  });
});
