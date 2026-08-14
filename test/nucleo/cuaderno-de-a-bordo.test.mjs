// SPEC-054 · El cuaderno no tiene escenarios en docs/testing.md. Estos casos nuevos
// conservan literalmente los criterios que miden y quedan declarados como huecos en el mapa.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { creaCuadernoDeABordo, TIPOS_DEL_CUADERNO, TOPE_DEL_CUADERNO } from '../../app/desarrollo/cuaderno-de-a-bordo.js';

function plataforma({ recuperado = { encendido: false, contenido: '', secuencia: 0 }, fallaAlEscribir = false } = {}) {
  let texto = recuperado.contenido ?? '';
  let marca = recuperado.encendido;
  const escritos = [];
  const compartidos = [];
  const ficheros = {
    async leeEstado() { return { encendido: marca, contenido: texto, secuencia: recuperado.secuencia ?? 0 }; },
    async marcaEncendido() { marca = true; },
    async escribeCuaderno(nuevo) {
      if (fallaAlEscribir) throw new Error('disco lleno');
      texto = nuevo;
      escritos.push(nuevo);
    },
    async borraTodo() { marca = false; texto = ''; },
  };
  const anterior = () => {};
  let manejador = anterior;
  const errores = {
    getGlobalHandler: () => manejador,
    setGlobalHandler: (nuevo) => { manejador = nuevo; },
    reportError: (error) => manejador(error, false),
  };
  const cuaderno = creaCuadernoDeABordo({
    ficheros,
    errores,
    hermes: { hasPromise: () => true, enablePromiseRejectionTracker() {} },
    reloj: () => new Date('2026-08-14T10:00:00.000Z'),
    comparte: async ({ contenido }) => compartidos.push(contenido),
  });
  return { cuaderno, escritos, compartidos, anterior, manejador: () => manejador, contenido: () => texto, marca: () => marca };
}

const lineas = (texto) => texto.trimEnd().split('\n').filter(Boolean).map(JSON.parse);

describe('El ciclo y el formato del cuaderno', () => {
  test('Encender, reiniciar y apagar conserva la sesión hasta que apagar borra fichero y marca', async () => {
    const uno = plataforma();
    await uno.cuaderno.inicia();
    await uno.cuaderno.enciende();
    assert.equal(uno.marca(), true);
    assert.equal(lineas(uno.contenido())[0].datos.accion, 'iniciada');

    const previo = uno.contenido();
    const dos = plataforma({ recuperado: { encendido: true, contenido: previo, secuencia: 1 } });
    await dos.cuaderno.inicia();
    assert.deepEqual(lineas(dos.contenido()).map((r) => r.datos.accion), ['iniciada', 'reanudada']);
    await dos.cuaderno.apaga();
    assert.equal(dos.contenido(), '');
    assert.equal(dos.marca(), false);
    await dos.cuaderno.observa('marca', { nombre: 'salida-averia', valor: 'no debe entrar' });
    assert.equal(dos.contenido(), '');
    assert.equal(dos.manejador(), dos.anterior);
  });

  test('Cada acontecimiento es una línea JSON válida, ordenada y con vocabulario cerrado', async () => {
    const p = plataforma();
    await p.cuaderno.enciende();
    await Promise.all([
      p.cuaderno.observa('posicion', { lat: 42.4, lon: -8.81, precisionM: null }),
      p.cuaderno.observa('cadencia', { anterior: 'distancia', elegida: 'tiempo', motivo: 'geofence' }),
      p.cuaderno.observa('tipo-inventado', { secreto: true }),
    ]);
    const registros = lineas(p.contenido());
    assert.deepEqual(registros.map((r) => r.secuencia), [1, 2, 3, 4]);
    assert.ok(registros.every((r) => r.version === 1 && r.instante === '2026-08-14T10:00:00.000Z'));
    assert.ok(registros.every((r) => TIPOS_DEL_CUADERNO.includes(r.tipo)));
    assert.equal(registros.at(-1).tipo, 'averia-del-cuaderno');
    assert.equal(registros[1].datos.precisionM, null);
  });

  test('Un dato que no puede convertirse a JSON deja una avería serializable y permite seguir', async () => {
    const p = plataforma();
    await p.cuaderno.enciende();
    const circular = {}; circular.elMismo = circular;
    await p.cuaderno.observa('posicion', circular);
    await p.cuaderno.observa('marca', { nombre: 'salida-averia', valor: 'sin-averia' });
    const registros = lineas(p.contenido());
    assert.equal(registros[1].tipo, 'averia-del-cuaderno');
    assert.equal(registros[1].datos.tipoOriginal, 'posicion');
    assert.equal(registros[2].tipo, 'marca');
  });

  test('El cuaderno conserva cabecera y cola, declara descartes y nunca supera 5 MiB', async () => {
    const p = plataforma();
    await p.cuaderno.enciende();
    const carga = 'á'.repeat(900_000);
    for (let i = 0; i < 4; i += 1) await p.cuaderno.observa('marca', { nombre: `m${i}`, valor: carga });
    const bytes = Buffer.byteLength(p.contenido(), 'utf8');
    const registros = lineas(p.contenido());
    assert.ok(bytes <= TOPE_DEL_CUADERNO);
    assert.equal(registros[0].tipo, 'sesion');
    assert.ok(registros.some((r) => r.tipo === 'truncado' && r.datos.descartadas > 0));
  });

  test('Una sola línea desmesurada se sustituye por truncado y no deja JSON parcial', async () => {
    const p = plataforma();
    await p.cuaderno.enciende();
    await p.cuaderno.observa('posicion', { lat: 42.4, mensaje: 'x'.repeat(TOPE_DEL_CUADERNO + 1000) });
    assert.ok(Buffer.byteLength(p.contenido(), 'utf8') <= TOPE_DEL_CUADERNO);
    assert.equal(lineas(p.contenido()).at(-1).tipo, 'truncado');
  });

  test('Escrituras casi simultáneas no mezclan, parten ni sobrescriben líneas', async () => {
    const p = plataforma();
    await p.cuaderno.enciende();
    await Promise.all(Array.from({ length: 40 }, (_, i) => p.cuaderno.observa('marca', { nombre: `m${i}`, valor: i })));
    const registros = lineas(p.contenido());
    assert.equal(registros.length, 41);
    assert.deepEqual(registros.map((r) => r.secuencia), Array.from({ length: 41 }, (_, i) => i + 1));
  });

  test('Una escritura fallida se contiene y queda visible como avería del cuaderno', async () => {
    const p = plataforma({ fallaAlEscribir: true });
    await p.cuaderno.enciende();
    assert.match(p.cuaderno.estado().averia, /disco lleno/);
    assert.equal(p.cuaderno.estado().encendido, true);
  });
});

describe('Los errores globales y compartir', () => {
  test('El manejador global registra error y rechazo antes de delegar y se restaura sin duplicados', async () => {
    const p = plataforma();
    await p.cuaderno.enciende();
    const instalado = p.manejador();
    await p.cuaderno.enciende();
    assert.equal(p.manejador(), instalado);
    instalado(new Error('boom'), true);
    const rechazo = new Error('Uncaught (in promise)'); rechazo.cause = 'razón plana';
    instalado(rechazo, false);
    await p.cuaderno.observa('marca', { nombre: 'barrera', valor: true });
    const registros = lineas(p.contenido());
    const error = registros.find((r) => r.tipo === 'error-global');
    const promesa = registros.find((r) => r.tipo === 'rechazo-global');
    assert.equal(error.datos.mensaje, 'boom');
    assert.match(error.datos.pila, /boom/);
    assert.equal(promesa.datos.mensaje, 'razón plana');
    assert.equal(promesa.datos.pila, null);
    await p.cuaderno.apaga();
    assert.equal(p.manejador(), p.anterior);
  });

  test('Compartir conserva intactos el contenido y el estado, y vacío no se comparte', async () => {
    const p = plataforma();
    await assert.rejects(() => p.cuaderno.compartir(), /Todavía no hay nada/);
    await p.cuaderno.enciende();
    const antes = p.contenido();
    await p.cuaderno.compartir();
    assert.deepEqual(p.compartidos, [antes]);
    assert.equal(p.contenido(), antes);
    assert.equal(p.cuaderno.estado().encendido, true);
  });
});
