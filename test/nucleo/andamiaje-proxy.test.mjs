// SPEC-001 · El doble del proxy.
//
// Tres modos y los tres hacen falta. «Responde» sostiene el camino con LLM;
// «falla siempre» es lo que permite afirmar que una salida entera funciona sin
// red; «responde mal» es lo que impide que una respuesta del modelo se dé por
// buena solo porque llegó — campo desconocido, dato vivo, contenido no apto y
// nombre que choca con el índice del mundo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { creaDobleDelProxy, respuestasFijas, respuestasDefectuosas, MODOS, TIPOS } from '../dobles/proxy.mjs';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';

describe('El doble del proxy', () => {
  test('En modo responde devuelve la respuesta fija que declara su fixture para texto, imagen y Places', async () => {
    const proxy = creaDobleDelProxy({ modo: 'responde' });
    const fijas = respuestasFijas();

    assert.deepEqual(await proxy.texto({ prompt: 'el puente' }), fijas.texto);
    assert.deepEqual(await proxy.imagen({ prompt: 'el puente' }), fijas.imagen);
    assert.deepEqual(await proxy.places({ anclaje: 'el puente' }), fijas.places);

    // La forma importa: es lo que permite afirmar «con LLM y sin LLM la
    // estructura es idéntica» comparando contra el fallback.
    assert.equal(typeof fijas.texto.texto, 'string');
    assert.ok(fijas.imagen.datos_base64.length > 0);
    assert.ok(fijas.places.foto.atribucion.length > 0);
  });

  test('En modo responde, pedir dos veces lo mismo devuelve exactamente lo mismo', async () => {
    const proxy = creaDobleDelProxy({ modo: 'responde' });
    for (const tipo of TIPOS) {
      const a = await proxy[tipo]({ prompt: 'lo mismo' });
      const b = await proxy[tipo]({ prompt: 'lo mismo' });
      assert.deepEqual(a, b, tipo);
      assert.notEqual(a, b, `${tipo}: cada llamada tiene que dar una copia nueva, no la misma referencia`);
    }
  });

  test('En modo falla siempre, todas las peticiones fallan sin devolver ninguna respuesta parcial', async () => {
    const proxy = creaDobleDelProxy({ modo: 'falla-siempre' });
    for (const tipo of TIPOS) {
      await assert.rejects(
        () => proxy[tipo]({ prompt: 'da igual' }),
        (e) => {
          assert.match(e.message, /falla-siempre/);
          assert.match(e.message, new RegExp(tipo));
          return true;
        },
        tipo,
      );
    }
    // Aunque falle, deja constancia de qué se pidió: sin eso no se puede afirmar
    // que una salida sin red pidió lo que tenía que pedir y siguió adelante.
    assert.deepEqual(proxy.peticiones().map((p) => p.tipo), TIPOS);
  });

  test('En modo responde mal devuelve una respuesta del catálogo de respuestas defectuosas', async () => {
    const catalogo = respuestasDefectuosas();

    const porTipo = creaDobleDelProxy({ modo: 'responde-mal' });
    const texto = await porTipo.texto({ prompt: 'el puente' });
    assert.ok(catalogo.some((e) => JSON.stringify(e.respuesta) === JSON.stringify(texto)), 'la respuesta no sale del catálogo');

    // Y se puede pedir un defecto concreto: sortearlo haría el doble
    // irreproducible, que es lo contrario de lo que hace falta aquí.
    const elegido = creaDobleDelProxy({ modo: 'responde-mal', defecto: 'no-apto' });
    const noApto = await elegido.texto({ prompt: 'el puente' });
    assert.deepEqual(noApto, catalogo.find((e) => e.id === 'no-apto').respuesta);

    await assert.rejects(
      () => creaDobleDelProxy({ modo: 'responde-mal', defecto: 'inexistente' }).texto({}),
      (e) => {
        assert.match(e.message, /inexistente/);
        return true;
      },
    );
  });

  test('El catálogo de respuestas defectuosas cubre campo desconocido, dato vivo, contenido no apto y nombre que choca', () => {
    const catalogo = respuestasDefectuosas();
    const motivos = catalogo.map((e) => e.motivo);

    for (const motivo of ['campo-desconocido', 'dato-vivo', 'no-apto', 'nombre-que-choca']) {
      assert.ok(motivos.includes(motivo), `falta una respuesta defectuosa con motivo "${motivo}"`);
    }

    // El dato vivo tiene que traer dato vivo de verdad, o el escenario «El modelo
    // no escribe ningún dato vivo» no prueba nada.
    const vivo = catalogo.find((e) => e.motivo === 'dato-vivo');
    const camposVivos = Object.keys(vivo.respuesta).filter((k) => /horario|telefono|tel[ée]fono|valoracion|valoración|precio/i.test(k));
    assert.ok(camposVivos.length >= 2, 'la respuesta con dato vivo tiene que traer varios campos vivos');

    // Y el nombre que choca tiene que declarar cuál es, para poder sembrar el
    // índice del mundo con él.
    const choca = catalogo.find((e) => e.motivo === 'nombre-que-choca');
    assert.equal(typeof choca.nombre_propuesto, 'string');
    assert.ok(choca.nombre_propuesto.length > 0);

    for (const entrada of catalogo) {
      assert.ok(TIPOS.includes(entrada.tipo), `la entrada "${entrada.id}" declara un tipo desconocido: ${entrada.tipo}`);
    }
  });

  test('Crear el doble con un modo que no es ninguno de los tres falla enumerando los modos válidos', () => {
    assert.throws(
      () => creaDobleDelProxy({ modo: 'a-ratos' }),
      (e) => {
        assert.match(e.message, /a-ratos/);
        for (const modo of MODOS) assert.match(e.message, new RegExp(modo));
        return true;
      },
    );
  });

  test('El doble del proxy no abre ninguna conexión de red real en ninguno de sus modos', async () => {
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      for (const tipo of TIPOS) {
        await creaDobleDelProxy({ modo: 'responde' })[tipo]({ prompt: 'x' });
        await creaDobleDelProxy({ modo: 'responde-mal' })[tipo]({ prompt: 'x' }).catch(() => {});
        await creaDobleDelProxy({ modo: 'falla-siempre' })[tipo]({ prompt: 'x' }).catch(() => {});
      }
      assert.deepEqual(inspector.peticiones(), []);
    } finally {
      inspector.suelta();
    }
  });

  test('El doble del proxy devuelve el registro de peticiones en el orden en que llegaron', async () => {
    const proxy = creaDobleDelProxy({ modo: 'responde' });
    await proxy.places({ anclaje: 'primero' });
    await proxy.texto({ prompt: 'segundo' });
    await proxy.imagen({ prompt: 'tercero' });

    const registro = proxy.peticiones();
    assert.deepEqual(registro.map((p) => p.tipo), ['places', 'texto', 'imagen']);
    assert.deepEqual(registro.map((p) => p.indice), [0, 1, 2]);
    assert.deepEqual(registro.map((p) => p.peticion.anclaje ?? p.peticion.prompt), ['primero', 'segundo', 'tercero']);
  });
});
