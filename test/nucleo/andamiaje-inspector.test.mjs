// SPEC-001 · El inspector de tráfico saliente.
//
// La afirmación más difícil del proyecto es una negativa: que algo no sale del
// móvil. No se puede probar leyendo el código, y por eso el inspector no es un
// mock sino un observador con modo estricto. Lo que se afirma aquí es lo que hace
// creíbles a los escenarios de @privacidad: que registra entero lo que sale, que
// mira destino, cabeceras y cuerpo al preguntar, que corta lo que no envuelve, y
// que al soltar deja la frontera exactamente como estaba.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';

const COORDENADA = '42.402,-8.809';

describe('El inspector de tráfico saliente', () => {
  test('Tres peticiones quedan registradas en orden con su destino, su método, sus cabeceras y su cuerpo', async () => {
    const inspector = creaInspectorDeRed();
    const salida = inspector.envuelve(async (destino, opciones) => ({ ok: true, destino, opciones }));

    await salida('https://proxy.local/llm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"prompt":"uno"}' });
    await salida('https://proxy.local/imagen', { method: 'POST', headers: { 'X-Sin-Identificar': 'sí' }, body: '{"prompt":"dos"}' });
    await salida('https://proxy.local/places');

    const registro = inspector.peticiones();
    assert.equal(registro.length, 3);
    assert.deepEqual(registro.map((p) => p.destino), [
      'https://proxy.local/llm',
      'https://proxy.local/imagen',
      'https://proxy.local/places',
    ]);
    assert.deepEqual(registro.map((p) => p.metodo), ['POST', 'POST', 'GET']);
    assert.deepEqual(registro[0].cabeceras, { 'Content-Type': 'application/json' });
    assert.deepEqual(registro.map((p) => p.cuerpo), ['{"prompt":"uno"}', '{"prompt":"dos"}', undefined]);
    assert.deepEqual(registro.map((p) => p.indice), [0, 1, 2]);
  });

  test('Preguntar si algo contiene un texto mira todos los destinos, todas las cabeceras y todos los cuerpos', async () => {
    const enDestino = creaInspectorDeRed();
    await enDestino.envuelve(async () => ({ ok: true }))(`https://proxy.local/mapa?en=${COORDENADA}`, { method: 'GET' });
    assert.equal(enDestino.contiene(COORDENADA), true, 'no mira el destino');

    const enCabecera = creaInspectorDeRed();
    await enCabecera.envuelve(async () => ({ ok: true }))('https://proxy.local/llm', { method: 'POST', headers: { 'X-Origen': COORDENADA } });
    assert.equal(enCabecera.contiene(COORDENADA), true, 'no mira las cabeceras');

    const enCuerpo = creaInspectorDeRed();
    await enCuerpo.envuelve(async () => ({ ok: true }))('https://proxy.local/llm', { method: 'POST', body: JSON.stringify({ desde: COORDENADA }) });
    assert.equal(enCuerpo.contiene(COORDENADA), true, 'no mira el cuerpo');

    const limpio = creaInspectorDeRed();
    await limpio.envuelve(async () => ({ ok: true }))('https://proxy.local/llm', { method: 'POST', body: '{"prompt":"una taberna con nombre inventado"}' });
    assert.equal(limpio.contiene(COORDENADA), false, 'dice que sí cuando no salió nada');
  });

  test('Un inspector que no ha visto ninguna petición devuelve una lista vacía y no un error', () => {
    const inspector = creaInspectorDeRed();
    assert.deepEqual(inspector.peticiones(), []);
    assert.equal(inspector.contiene('lo que sea'), false);
  });

  test('En modo estricto, una salida a red por un camino no envuelto se corta con un error que nombra el destino', () => {
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      assert.throws(
        () => globalThis.fetch('https://tracker.example/telemetria?lat=42.402'),
        (e) => {
          assert.match(e.message, /tracker\.example/);
          assert.match(e.message, /estricto/);
          return true;
        },
      );
      // Lo que se corta no se registra como salida: no salió.
      assert.deepEqual(inspector.peticiones(), []);
    } finally {
      inspector.suelta();
    }
  });

  test('En modo estricto, soltar la frontera la deja exactamente como estaba antes de envolverla', () => {
    const antes = Object.getOwnPropertyDescriptor(globalThis, 'fetch');

    const inspector = creaInspectorDeRed({ estricto: true });
    assert.notEqual(globalThis.fetch, antes.value, 'en estricto la frontera tiene que estar envuelta');
    inspector.suelta();

    const despues = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    assert.deepEqual(despues, antes);
    assert.equal(globalThis.fetch, antes.value);

    // Y soltar dos veces no vuelve a tocar nada.
    inspector.suelta();
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'fetch'), antes);
  });

  test('El inspector guarda el cuerpo tal cual llegó, sin recortarlo ni normalizarlo', async () => {
    const inspector = creaInspectorDeRed();
    const salida = inspector.envuelve(async () => ({ ok: true }));

    const cuerpoLargo = `{"prompt":"${'a'.repeat(5000)}",  "espacios":   "  con  huecos  ",\n"salto":"sí"}`;
    await salida('https://proxy.local/llm', { method: 'POST', body: cuerpoLargo });

    const guardado = inspector.peticiones()[0].cuerpo;
    assert.equal(guardado, cuerpoLargo);
    assert.equal(guardado.length, cuerpoLargo.length, 'el cuerpo se recortó');
  });
});
