// SPEC-001-iter-1 · El veredicto del runner no depende del entorno ni de la forma
// de la salida.
//
// La spec base pedía que un verde significase algo; esta iteración cierra las dos
// maneras de que no lo significase. Una: el runner heredaba `NODE_TEST_CONTEXT`,
// `node --test` cambiaba la forma de su salida, los tres `grep` del resumen no
// encontraban nada, los recuentos caían a cero y el veredicto salía PASS con un
// caso en rojo dentro del fichero que el propio report adjunta. Otra: el PASS se
// deducía de la ausencia de señales de fallo, así que no entender lo recibido no
// concluía nada malo.
//
// De ahí la forma de casi todo lo de aquí: se le da al runner una salida de
// `node --test` fabricada y se afirma qué hace con ella. Se fabrica con un `node`
// de mentira delante en el PATH que delega en el de verdad para todo lo demás —es
// lo único que permite sustituir esa salida sin romper los otros tres subprocesos
// del runner— y no falseando el runner, que es el que está a prueba.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { creaSandbox, entornoLimpio, entornoDentroDeNodeTest } from './andamiaje-sandbox.mjs';

/** Una cadena como argumento literal de /bin/sh. */
function sh(valor) {
  return `'${String(valor).replace(/'/g, "'\\''")}'`;
}

/** Resumen TAP con los tres recuentos que el runner busca. */
function resumen({ tests, pass, fail }) {
  return ['TAP version 13', 'ok 1 - un caso cualquiera', '1..1', `# tests ${tests}`, `# pass ${pass}`, `# fail ${fail}`, ''].join('\n');
}

/**
 * Planta un `node` (y opcionalmente un `maestro`) de mentira en <sandbox>/bin.
 *
 * El `node` delega en el de verdad con `exec` salvo cuando el primer argumento es
 * `--test`, en cuyo caso escupe la salida que pida la prueba y termina con el
 * código que pida. Así se puede afirmar qué hace el runner con un resumen que no
 * reconoce sin tocar el runner y sin romper `node -p`, `node --help` ni los dos
 * scripts de veredicto, que siguen ejecutándose de verdad.
 *
 * @param {object} caja  el sandbox
 * @param {object} [opciones]
 * @param {string|null} [opciones.salidaTest=null]  qué imprime `node --test`
 * @param {number} [opciones.codigoTest=0]          con qué código termina
 * @param {string|null} [opciones.registro=null]    fichero donde anotar el entorno de cada invocación
 * @param {boolean} [opciones.conMaestro=false]     planta también un maestro de mentira
 * @returns {string} la ruta del directorio que hay que poner delante en el PATH
 */
function plantaBinDeMentira(caja, { salidaTest = null, codigoTest = 0, registro = null, conMaestro = false } = {}) {
  const bin = join(caja.raiz, 'bin');
  mkdirSync(bin, { recursive: true });

  // Se anota siempre la invocación, aunque no haya ninguna variable que listar:
  // sin la línea de cabecera no se podría distinguir «el entorno venía limpio» de
  // «este subproceso no llegó a lanzarse».
  const anota = registro
    ? `{ echo "--- $0 $*"; env | grep -E '^(NODE_TEST_[A-Za-z0-9_]*|NODE_OPTIONS)=' || true; } >> ${sh(registro)}\n`
    : '';

  let guion = `#!/bin/sh\n${anota}`;
  if (salidaTest !== null) {
    const fichero = join(bin, 'salida-node-test.txt');
    writeFileSync(fichero, salidaTest);
    guion += `if [ "$1" = "--test" ]; then cat ${sh(fichero)}; exit ${codigoTest}; fi\n`;
  }
  guion += `exec ${sh(process.execPath)} "$@"\n`;

  writeFileSync(join(bin, 'node'), guion);
  chmodSync(join(bin, 'node'), 0o755);

  if (conMaestro) {
    // El maestro de mentira DEJA SU INFORME JUNIT, y no es un detalle: desde que
    // el runner distingue los tres estados de @app, una salida sin informe
    // reconocible ya no es un flujo verde sino «no se pudo ejecutar», y con ella
    // el veredicto entero vale 2. Un maestro que solo hace `exit 0` dejó de ser un
    // maestro que ejecutó algo, así que aquí escribe el informe que afirma que sí.
    const junit = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<testsuites>',
      '  <testsuite name="flujos del sandbox" tests="1" failures="0">',
      '    <testcase name="Un flujo de ejemplo del andamiaje que pasa"/>',
      '  </testsuite>',
      '</testsuites>',
      '',
    ].join('\n');
    writeFileSync(join(bin, 'informe-maestro.xml'), junit);
    writeFileSync(
      join(bin, 'maestro'),
      [
        '#!/bin/sh',
        anota.trimEnd(),
        'SALIDA=""',
        'while [ $# -gt 0 ]; do',
        '  if [ "$1" = "--output" ]; then SALIDA="$2"; fi',
        '  shift',
        'done',
        `[ -n "$SALIDA" ] && cat ${sh(join(bin, 'informe-maestro.xml'))} > "$SALIDA"`,
        'exit 0',
        '',
      ].join('\n'),
    );
    chmodSync(join(bin, 'maestro'), 0o755);
  }

  return bin;
}

/** El entorno sucio con el que se reproduce el defecto, más un PATH dado. */
function entornoSucio(bin = null) {
  const env = {
    ...entornoDentroDeNodeTest(),
    NODE_TEST_CONTEXT: 'child-v8',
    NODE_TEST_ALGO_MAS: 'lo-que-sea',
    NODE_OPTIONS: '--no-warnings',
  };
  if (bin) env.PATH = `${bin}:${process.env.PATH}`;
  return env;
}

/** La primera línea con contenido del report, sin el sello. */
function veredictoDe(report) {
  const primera = report.split('\n').find((l) => l.trim().length > 0);
  return primera.replace(/\d{8}T\d{6}Z/, '<SELLO>');
}

/** El trozo del report que va de la sección 3 a la 4. */
function infraestructura(report) {
  const desde = report.indexOf('## 3 · Infraestructura ausente');
  const hasta = report.indexOf('## 4 · Resultados de @nucleo');
  assert.ok(desde !== -1 && hasta > desde, 'el report no trae las secciones 3 y 4 en orden');
  return report.slice(desde, hasta);
}

describe('El runner sanea el entorno que entrega a sus subprocesos', () => {
  test('Todos los subprocesos del runner reciben un entorno sin NODE_TEST_* ni NODE_OPTIONS', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', flujos: 1 });
    t.after(() => caja.borra());

    const registro = join(caja.raiz, 'entorno-de-los-subprocesos.txt');
    const bin = plantaBinDeMentira(caja, { registro, conMaestro: true });

    const r = caja.corre(['SPEC-001'], { env: entornoSucio(bin) });
    assert.equal(r.codigo, 0, r.stderr);

    const visto = readFileSync(registro, 'utf8');
    const heredadas = visto.split('\n').filter((l) => /^(NODE_TEST_|NODE_OPTIONS=)/.test(l));
    assert.deepEqual(heredadas, [], 'algún subproceso vio una variable que el runner tenía que haber retirado');

    // Y que estuvieran los cuatro: una lista vacía también cumpliría lo de arriba.
    const invocaciones = visto.split('\n').filter((l) => l.startsWith('--- '));
    for (const esperado of ['comprueba-nucleo.mjs', '--test', 'valida-spec-test-map.mjs', 'maestro']) {
      assert.ok(
        invocaciones.some((l) => l.includes(esperado)),
        `no consta que el runner lanzase ${esperado}; invocaciones vistas:\n${invocaciones.join('\n')}`,
      );
    }
  });

  test('Con NODE_TEST_CONTEXT heredada y una prueba en rojo, el runner termina con código 1', (t) => {
    const caja = creaSandbox({ pruebas: 'falla' });
    t.after(() => caja.borra());

    // Es la reproducción literal del defecto: antes daba 0 con el caso en rojo.
    const sucio = caja.corre(['SPEC-001'], { env: entornoSucio() });
    assert.equal(sucio.codigo, 1, sucio.stderr);
    assert.match(sucio.report, /# FAIL/);

    const limpio = caja.corre(['SPEC-001'], { env: entornoLimpio() });
    assert.equal(limpio.codigo, 1, 'y desde una shell limpia tiene que dar exactamente lo mismo');
  });

  test('El mismo árbol da el mismo veredicto desde una shell limpia y desde dentro de otro node --test', (t) => {
    for (const pruebas of ['pasa', 'falla', 'ninguna']) {
      const caja = creaSandbox({ pruebas });
      t.after(() => caja.borra());

      const limpio = caja.corre(['SPEC-001'], { env: entornoLimpio() });
      const dentro = caja.corre(['SPEC-001'], { env: entornoDentroDeNodeTest() });

      assert.equal(dentro.codigo, limpio.codigo, `con pruebas=${pruebas} el código cambia según quién lance el runner`);
      assert.equal(
        veredictoDe(dentro.report),
        veredictoDe(limpio.report),
        `con pruebas=${pruebas} el veredicto cambia según quién lance el runner`,
      );
    }
  });

  test('El report nombra las variables heredadas que el runner retiró', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const sucio = caja.corre(['SPEC-001'], { env: entornoSucio() });
    const seccion = infraestructura(sucio.report);
    for (const variable of ['NODE_TEST_CONTEXT', 'NODE_TEST_ALGO_MAS', 'NODE_OPTIONS']) {
      assert.ok(seccion.includes(variable), `la sección de infraestructura no nombra ${variable}`);
    }

    // Y cuando no había nada que retirar, se dice también: el silencio no
    // distingue «no había» de «no se miró».
    const limpio = caja.corre(['SPEC-001'], { env: entornoLimpio() });
    assert.match(infraestructura(limpio.report), /Entorno de partida limpio/);
  });

  test('El saneamiento se cuenta en el report y no por la salida estándar', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001'], { env: entornoSucio() });
    assert.equal(r.stdout, `${r.reportRel}\n`);
    assert.equal(r.stdout.includes('NODE_TEST_CONTEXT'), false);
  });
});

describe('El veredicto del runner no depende de la forma de la salida de node --test', () => {
  test('El PASS exige resumen reconocido, al menos un caso, cero fallos y código 0', (t) => {
    const casos = [
      { que: 'las cuatro condiciones', salida: resumen({ tests: 1, pass: 1, fail: 0 }), rc: 0, codigo: 0, veredicto: 'PASS' },
      { que: 'sin resumen reconocible', salida: 'TAP version 13\nok 1 - algo\n', rc: 0, codigo: 2, veredicto: 'FAIL' },
      { que: 'con cero casos ejecutados', salida: resumen({ tests: 0, pass: 0, fail: 0 }), rc: 0, codigo: 2, veredicto: 'FAIL' },
      { que: 'con un fallo en el resumen', salida: resumen({ tests: 2, pass: 1, fail: 1 }), rc: 0, codigo: 1, veredicto: 'FAIL' },
      { que: 'con código distinto de 0 del subproceso', salida: resumen({ tests: 1, pass: 1, fail: 0 }), rc: 3, codigo: 1, veredicto: 'FAIL' },
    ];

    for (const caso of casos) {
      const caja = creaSandbox({ pruebas: 'pasa' });
      t.after(() => caja.borra());

      const bin = plantaBinDeMentira(caja, { salidaTest: caso.salida, codigoTest: caso.rc });
      const r = caja.corre(['SPEC-001'], { env: entornoSucio(bin) });

      assert.equal(r.codigo, caso.codigo, `${caso.que}: ${r.stderr}`);
      assert.match(r.report, new RegExp(`^# ${caso.veredicto} `), caso.que);
    }
  });

  test('Una salida de node --test cuyo resumen no se reconoce vale 2 y nunca PASS', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const rara = 'esto no es TAP\nni se le parece\n';
    const bin = plantaBinDeMentira(caja, { salidaTest: rara, codigoTest: 0 });
    const r = caja.corre(['SPEC-001'], { env: entornoSucio(bin) });

    assert.equal(r.codigo, 2, 'no reconocer la salida es «no se pudo ejecutar», no «falló» y desde luego no PASS');
    assert.equal(r.report.includes('# PASS'), false);
    assert.match(r.report, /no se pudo ejecutar/);
  });

  test('Cuando el resumen no se reconoce, el report trae la salida literal y dice qué esperaba encontrar', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const rara = 'una salida rarísima que hay que poder leer entera en el report\n';
    const bin = plantaBinDeMentira(caja, { salidaTest: rara, codigoTest: 0 });
    const r = caja.corre(['SPEC-001'], { env: entornoSucio(bin) });

    assert.ok(r.report.includes(rara.trim()), 'el report no trae la salida literal de la ejecución');
    assert.match(r.report, /no reconocido/);
    for (const esperada of ['# tests <n>', '# pass <n>', '# fail <n>']) {
      assert.ok(r.report.includes(esperada), `el report no dice que esperaba la línea ${esperada}`);
    }
  });

  test('Con ficheros de prueba y un resumen que declara cero casos, el runner no da PASS', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    const bin = plantaBinDeMentira(caja, { salidaTest: resumen({ tests: 0, pass: 0, fail: 0 }), codigoTest: 0 });
    const r = caja.corre(['SPEC-001'], { env: entornoSucio(bin) });

    assert.equal(r.codigo, 2, 'había pruebas y no se ejecutó ninguna: eso no es verde');
    assert.equal(r.report.includes('# PASS'), false);
    assert.match(r.report, /0 casos ejecutados/);
    assert.match(r.report, /1 fichero\(s\) de prueba/);
  });

  test('Ante una discrepancia entre el código de node --test y su resumen se toma el peor de los dos y queda registrada', (t) => {
    const casos = [
      { que: 'código 3 con cero fallos en el resumen', salida: resumen({ tests: 1, pass: 1, fail: 0 }), rc: 3 },
      { que: 'código 0 con un fallo en el resumen', salida: resumen({ tests: 2, pass: 1, fail: 1 }), rc: 0 },
    ];

    for (const caso of casos) {
      const caja = creaSandbox({ pruebas: 'pasa' });
      t.after(() => caja.borra());

      const bin = plantaBinDeMentira(caja, { salidaTest: caso.salida, codigoTest: caso.rc });
      const r = caja.corre(['SPEC-001'], { env: entornoSucio(bin) });

      assert.equal(r.codigo, 1, `${caso.que}: el peor de los dos es rojo`);
      assert.match(r.report, /\*\*Discrepancia:\*\*/, caso.que);
      assert.match(r.report, /peor de los dos/, caso.que);
    }
  });

  test('Un report que dice PASS trae un recuento de casos mayor que cero', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    for (const env of [entornoLimpio(), entornoSucio()]) {
      const r = caja.corre(['SPEC-001'], { env });
      assert.equal(r.codigo, 0, r.stderr);
      assert.match(r.report, /^# PASS /);

      const casos = r.report.match(/- Casos: (\d+) · pasan: (\d+) · fallan: (\d+)/);
      assert.notEqual(casos, null, 'un report en PASS tiene que traer el recuento');
      assert.ok(Number(casos[1]) > 0, `un PASS con ${casos[1]} casos ejecutados es un verde que no ejecutó nada`);
      assert.equal(Number(casos[3]), 0);
    }
  });
});

describe('Un script que no llega a validar nunca sale 0 en silencio, y el runner lo nota', () => {
  test('Un validador del mapa que sale 0 sin línea de veredicto se registra como no se pudo validar', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    // Un validador mudo: sale 0 y no dice nada. Es exactamente lo que hacía el de
    // verdad cuando su guardián no se disparaba.
    caja.escribe('scripts/valida-spec-test-map.mjs', '// mudo a propósito\nprocess.exitCode = 0;\n');

    const r = caja.corre(['SPEC-001'], { env: entornoSucio() });
    assert.equal(r.codigo, 0, 'un mapa sin validar sigue sin ser una regresión del juego');

    const seccion = infraestructura(r.report);
    assert.match(seccion, /no se pudo validar/);
    // Y con esas palabras: que el código fuera 0 no lo convierte en una
    // validación buena, que es justo la confusión que se está cerrando.
    assert.match(seccion, /tampoco cuenta como validación correcta/);

    // El contraste, sobre el mismo árbol con el validador de verdad: ahí sí
    // aparece la forma afirmativa y no aparece la excusa.
    caja.borra();
    const buena = creaSandbox({ pruebas: 'pasa' });
    t.after(() => buena.borra());
    const ok = buena.corre(['SPEC-001'], { env: entornoSucio() });
    assert.equal(infraestructura(ok.report).includes('no se pudo validar'), false);
  });

  test('Sin línea de veredicto en la comprobación de la frontera, la ejecución no puede terminar en PASS', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    caja.escribe('scripts/comprueba-nucleo.mjs', '// muda a propósito\nprocess.exitCode = 0;\n');

    const r = caja.corre(['SPEC-001'], { env: entornoSucio() });
    assert.notEqual(r.codigo, 0, 'sin comprobar la frontera no hay PASS posible');
    assert.equal(r.codigo, 2, 'y no es un fallo de pruebas: es que no se comprobó');
    assert.equal(r.report.includes('# PASS'), false);
    assert.match(r.report, /No se pudo comprobar la frontera/);
  });

  test('Un mapa que no se pudo validar sigue apareciendo en infraestructura y nunca como prueba en rojo', (t) => {
    // Sin docs/testing.md el validador no llega a validar y sale 2. El runner lo
    // recoge en MAPA_RC, y eso no puede teñir de rojo la ejecución.
    const caja = creaSandbox({ pruebas: 'pasa', bateria: null, mapa: { entradas: [] } });
    t.after(() => caja.borra());

    assert.equal(existsSync(join(caja.raiz, 'docs', 'testing.md')), false);

    const r = caja.corre(['SPEC-001'], { env: entornoSucio() });
    assert.equal(r.codigo, 0);
    assert.match(r.report, /^# PASS /);

    const seccion = infraestructura(r.report);
    assert.match(seccion, /Mapa de cobertura/);
    assert.match(seccion, /no se pudo validar/);
    assert.match(r.report.slice(r.report.indexOf('## 4 · Resultados de @nucleo')), /Estado: OK/);
  });
});
