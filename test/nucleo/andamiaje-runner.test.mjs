// SPEC-001 · El runner de pruebas.
//
// Todo esto corre sobre el sandbox de `andamiaje-sandbox.mjs`, que es el runner
// de verdad sobre un repo de mentira: ejecutarlo contra este árbol sería
// ejecutarse a sí mismo sin fondo.
//
// La afirmación que más importa no es que dé verde cuando todo pasa, sino que no
// lo dé cuando no se ejecutó nada. Un bucle desatendido que confunde «pasó» con
// «no había nada» avanza sobre un pipeline muerto, y por eso el código 2 tiene
// tantos casos como el 0 y el 1 juntos.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { creaSandbox, sinSelloNiDuraciones, CASO_QUE_FALLA, MENSAJE_DEL_FALLO } from './andamiaje-sandbox.mjs';

/** Índice de una sección del report, para poder afirmar en qué orden van. */
function seccion(report, titulo) {
  const i = report.indexOf(titulo);
  assert.notEqual(i, -1, `el report no tiene la sección ${titulo}`);
  return i;
}

describe('El runner de pruebas', () => {
  test('Con pruebas que pasan, el runner termina con código 0', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    assert.equal(r.codigo, 0, r.stderr);
    assert.match(r.report, /# PASS/);
  });

  test('El runner escribe test/reports/<ETIQUETA>-run-<sello>.md con el sello en formato YYYYMMDDTHHMMSSZ', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-003-iter-2']);
    assert.match(r.reportRel, /^test\/reports\/SPEC-003-iter-2-run-\d{8}T\d{6}Z\.md$/);
    assert.deepEqual(caja.reports().filter((f) => f.endsWith('.md')), [r.reportRel.split('/').pop()]);
  });

  test('Por la salida estándar del runner sale la ruta del report y nada más', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    assert.equal(r.stdout, `${r.reportRel}\n`);
    assert.equal(r.stdout.trim().split('\n').length, 1);
  });

  test('Con una prueba que falla, el runner termina con código 1', (t) => {
    const caja = creaSandbox({ pruebas: 'falla' });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    assert.equal(r.codigo, 1);
    assert.match(r.report, /# FAIL/);
  });

  test('El report de un fallo trae el nombre literal del caso y la salida literal del fallo', (t) => {
    const caja = creaSandbox({ pruebas: 'falla' });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    assert.ok(r.report.includes(CASO_QUE_FALLA), 'falta el nombre literal del caso');
    assert.ok(r.report.includes(MENSAJE_DEL_FALLO), 'falta la salida literal del fallo');
    assert.match(r.report, /not ok/);
  });

  test('Con Maestro ausente, el report registra la ausencia en infraestructura y no entre los resultados', { skip: hayMaestro() && 'Maestro está instalado en esta máquina' }, (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    const infraestructura = seccion(r.report, '## 3 · Infraestructura ausente');
    const resultadosNucleo = seccion(r.report, '## 4 · Resultados de @nucleo');
    const ausencia = r.report.indexOf('Maestro no está instalado');

    assert.notEqual(ausencia, -1, 'el report no dice que Maestro falta');
    assert.ok(ausencia > infraestructura && ausencia < resultadosNucleo, 'la ausencia de Maestro no está en la sección de infraestructura');
    assert.match(r.report.slice(infraestructura, resultadosNucleo), /no es rojo/i);
  });

  test('Con Maestro ausente y las pruebas de @nucleo en verde, el runner sin acotar nivel termina con código 0', { skip: hayMaestro() && 'Maestro está instalado en esta máquina' }, (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    assert.equal(r.codigo, 0, 'la infraestructura ausente no puede teñir de rojo lo que sí se ejecutó');
  });

  test('Con Maestro ausente, el runner con --app-only termina con un código distinto de 0', { skip: hayMaestro() && 'Maestro está instalado en esta máquina' }, (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', flujos: 1 });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001', '--app-only']);
    assert.notEqual(r.codigo, 0, 'no haber ejecutado nada nunca es verde');
    assert.equal(r.codigo, 2, 'y no es un fallo de pruebas, es que no se pudo ejecutar');
  });

  test('Sin ninguna prueba en test/nucleo/, el runner termina con código distinto de 0 y lo dice en el report', (t) => {
    const caja = creaSandbox({ pruebas: 'ninguna' });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    assert.notEqual(r.codigo, 0);
    assert.equal(r.codigo, 2);
    assert.match(r.report, /no hab[íi]a pruebas que ejecutar/);
  });

  test('Sin ningún flujo en test/app/, el report lo registra y las de @nucleo se ejecutan igual', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', flujos: 0 });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    assert.match(r.report, /`test\/app\/` no contiene ningún flujo/);
    assert.match(r.report, /Casos: 1 · pasan: 1 · fallan: 0/);
    assert.equal(r.codigo, 0);
  });

  test('Un import que falla en packages/nucleo/ mencionando React Native encabeza el report', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', nucleoRoto: true });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    assert.equal(r.codigo, 1, 'una regresión de núcleo es rojo');

    const regresion = seccion(r.report, '## 2 · Regresión de núcleo');
    const infraestructura = seccion(r.report, '## 3 · Infraestructura ausente');
    const resultados = seccion(r.report, '## 4 · Resultados de @nucleo');
    const hallazgo = r.report.indexOf('react-native');

    assert.notEqual(hallazgo, -1, 'el report no nombra el import prohibido');
    assert.ok(hallazgo > regresion && hallazgo < infraestructura, 'el hallazgo no está en la sección que va primera');
    assert.ok(regresion < infraestructura && infraestructura < resultados, 'el orden de secciones no es el operativo');
  });

  test('Una etiqueta que no es SPEC-NNN, SPEC-NNN-iter-M ni SUITE falla antes de ejecutar nada', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    for (const etiqueta of ['spec-001', 'SPEC-1', 'SPEC-0001', 'suite', 'SPEC-001-iter', 'lo-que-sea']) {
      const r = caja.corre([etiqueta]);
      assert.notEqual(r.codigo, 0, `"${etiqueta}" no puede dar verde`);
      assert.notEqual(r.codigo, 1, `"${etiqueta}" no es un fallo de pruebas, es que no se pudo ejecutar`);
      assert.equal(r.codigo, 2, `"${etiqueta}"`);
      assert.match(r.stderr, /etiqueta mal formada|Uso:/);
    }
    assert.deepEqual(caja.reports().filter((f) => f.endsWith('.md')), [], 'no se pudo ejecutar: no hay report que escribir');

    // Y las tres formas buenas sí arrancan.
    for (const etiqueta of ['SPEC-001', 'SPEC-042-iter-3', 'SUITE']) {
      assert.equal(caja.corre([etiqueta]).codigo, 0, etiqueta);
    }
  });

  test('El runner sin argumento de etiqueta falla mostrando el modo de empleo', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const r = caja.corre([]);
    assert.equal(r.codigo, 2);
    assert.match(r.stderr, /falta la etiqueta/i);
    assert.match(r.stderr, /Uso: scripts\/qa-tester-run\.sh <ETIQUETA>/);
    assert.match(r.stderr, /--nucleo-only/);
    assert.match(r.stderr, /--app-only/);
  });

  test('Con una versión de Node anterior a la 20, el runner falla antes de ejecutar nada nombrando la versión mínima', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    // Un `node` de mentira delante en el PATH: es la única manera de afirmar la
    // comprobación sin tener instalado un Node viejo.
    const bin = join(caja.raiz, 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'node'), '#!/bin/sh\necho "18.20.8"\n');
    chmodSync(join(bin, 'node'), 0o755);

    const r = caja.corre(['SPEC-001'], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
    assert.equal(r.codigo, 2);
    assert.match(r.stderr, /18\.20\.8/);
    assert.match(r.stderr, /\b20\b/);
    assert.deepEqual(caja.reports().filter((f) => f.endsWith('.md')), [], 'no tenía que haber llegado a escribir report');
  });

  test('Con test/reports/ inexistente, el runner lo crea y escribe el report igual', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', conReports: false });
    t.after(() => caja.borra());

    assert.equal(existsSync(join(caja.raiz, 'test', 'reports')), false);
    const r = caja.corre(['SPEC-001']);
    assert.equal(r.codigo, 0);
    assert.equal(existsSync(join(caja.raiz, 'test', 'reports')), true);
    assert.ok(r.report.length > 0);
  });

  test('Dos ejecuciones seguidas sobre el mismo árbol dan reports que solo difieren en el sello y las duraciones', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const primero = caja.corre(['SPEC-001']);
    const segundo = caja.corre(['SPEC-001']);

    assert.equal(primero.codigo, 0);
    assert.equal(segundo.codigo, 0);
    assert.equal(sinSelloNiDuraciones(primero.report), sinSelloNiDuraciones(segundo.report));
  });

  test('El runner no lee ningún .env, no exige credenciales y no necesita conexión', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    // Un .env envenenado en la raíz: si algo lo leyera, el valor acabaría en el
    // report o cambiaría el resultado.
    caja.escribe('.env', 'WA_TOKEN=no-debe-aparecer-en-ningun-sitio\nWA_OVERPASS=https://no.existe/\n');

    // Y un entorno pelado: sin credenciales, sin proxy, sin nada.
    const env = { PATH: process.env.PATH, HOME: process.env.HOME };
    if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;

    const r = caja.corre(['SPEC-001'], { env });
    assert.equal(r.codigo, 0, r.stderr);
    assert.equal(r.report.includes('no-debe-aparecer-en-ningun-sitio'), false);
  });

  test('Con ficheros sin commitear, el report lo registra como aviso y la ejecución continúa', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', conGit: true });
    t.after(() => caja.borra());

    if (!existsSync(join(caja.raiz, '.git'))) return t.skip('no hay git en esta máquina');

    const r = caja.corre(['SPEC-001']);
    assert.equal(r.codigo, 0, 'un árbol sucio es un aviso, no un fallo');
    assert.match(r.report, /## 6 · Estado de git \(aviso\)/);
    assert.match(r.report, /Hay ficheros sin commitear/);
    assert.match(r.report, /Casos: 1 · pasan: 1/, 'la ejecución tenía que continuar');
  });

  test('La primera línea de contenido del report dice PASS o FAIL y coincide con el código de salida', (t) => {
    const casos = [
      { opciones: { pruebas: 'pasa' }, codigo: 0, veredicto: 'PASS' },
      { opciones: { pruebas: 'falla' }, codigo: 1, veredicto: 'FAIL' },
      { opciones: { pruebas: 'ninguna' }, codigo: 2, veredicto: 'FAIL' },
      { opciones: { pruebas: 'pasa', nucleoRoto: true }, codigo: 1, veredicto: 'FAIL' },
    ];

    for (const caso of casos) {
      const caja = creaSandbox(caso.opciones);
      t.after(() => caja.borra());

      const r = caja.corre(['SPEC-001']);
      assert.equal(r.codigo, caso.codigo, JSON.stringify(caso.opciones));
      const primeraLinea = r.report.split('\n').find((l) => l.trim().length > 0);
      assert.match(primeraLinea, new RegExp(`^# ${caso.veredicto} — SPEC-001 — \\d{8}T\\d{6}Z$`), JSON.stringify(caso.opciones));
      assert.match(r.report, new RegExp(`- Resultado: \\*\\*${caso.veredicto}\\*\\*`));
      assert.match(r.report, new RegExp(`- Código de salida: \`${caso.codigo}\``));
    }
  });
});

/** Si Maestro está en el PATH. Tres criterios lo dan por ausente y hay que declararlo. */
function hayMaestro() {
  const dirs = (process.env.PATH ?? '').split(':').filter(Boolean);
  return dirs.some((d) => existsSync(join(d, 'maestro')));
}
