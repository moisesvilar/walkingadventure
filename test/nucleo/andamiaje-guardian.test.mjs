// SPEC-001-iter-1 · El guardián de ejecución directa y la línea de veredicto.
//
// Lo que se cierra aquí es una clase entera, no dos casos: un script del
// andamiaje que sale 0 sin haber comprobado nada. Tenía dos caras. Una, el
// guardián ingenuo `process.argv[1] === fileURLToPath(import.meta.url)`, que
// compara una ruta sin resolver con otra que el cargador ya resolvió: basta con
// que la invocación atraviese un enlace simbólico —en macOS /tmp y /var lo son,
// así que basta con ejecutar desde un temporal— para que el bloque principal no
// corra nunca y el proceso termine con el 0 por defecto. Otra, el mismo patrón
// ausente en `captura-fixtures.mjs`, que llamaba a `principal(...)` en el cuerpo
// del módulo y disparaba una captura contra la red con solo importarlo.
//
// Casi todo se afirma ejecutando de verdad, y no leyendo el código: la única
// manera de saber si un guardián se dispara es dispararlo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { esPrincipal, rutaCanonica } from '../../scripts/guardian-principal.mjs';
import { creaSandbox, entornoLimpio, entornoDentroDeNodeTest, sinSelloNiDuraciones, RAIZ_REPO } from './andamiaje-sandbox.mjs';

// Los scripts del andamiaje que se pueden ejecutar directamente. `overpass-setup.sh`
// y los `verifica-*.mjs` son herramientas del prototipo y quedan fuera por spec;
// `qa-tester-run.sh` es bash y no tiene guardián que compartir.
const EJECUTABLES = ['valida-spec-test-map.mjs', 'comprueba-nucleo.mjs', 'captura-fixtures.mjs'];

// Los que además emiten un veredicto por su cuenta y cuyo código recoge el runner.
const CON_VEREDICTO = ['valida-spec-test-map.mjs', 'comprueba-nucleo.mjs'];

/** Un enlace simbólico a un directorio, fuera del árbol enlazado, y su limpieza. */
function enlaceA(destino) {
  const casa = mkdtempSync(join(tmpdir(), 'wa-enlace-'));
  const enlace = join(casa, 'espejo');
  symlinkSync(destino, enlace, 'dir');
  return { enlace, borra: () => rmSync(casa, { recursive: true, force: true }) };
}

/** Ejecuta un script con Node y devuelve código y salidas juntas. */
function corre(caja, argv, extra = {}) {
  const r = caja.ejecutaNode(argv, extra);
  return { codigo: r.codigo, salida: `${r.stdout}${r.stderr}`, stdout: r.stdout, stderr: r.stderr };
}

describe('Cómo un script del andamiaje decide que es el programa principal', () => {
  test('Todos los scripts ejecutables del andamiaje deciden que son el programa principal de la misma manera', () => {
    const infracciones = [];
    for (const script of EJECUTABLES) {
      const fuente = readFileSync(join(RAIZ_REPO, 'scripts', script), 'utf8');
      if (!/from\s+'\.\/guardian-principal\.mjs'/.test(fuente)) infracciones.push(`${script}: no usa el guardián compartido`);
      if (!/if\s*\(esPrincipal\(import\.meta\.url\)\)/.test(fuente)) infracciones.push(`${script}: no decide con esPrincipal(import.meta.url)`);
      // La variante ingenua, en cualquiera de sus dos órdenes.
      if (/process\.argv\[1\]\s*===|===\s*process\.argv\[1\]/.test(fuente)) infracciones.push(`${script}: compara process.argv[1] a mano`);
    }
    assert.deepEqual(infracciones, [], 'tres copias del guardián son tres oportunidades de que una diverja');

    // Y que el módulo compartido esté versionado. En este repo un `.gitignore`
    // con una ruta sin anclar ya se tragó un módulo entero sin que ningún test lo
    // notara; un guardián que importan los tres scripts y que no viaja con ellos
    // los deja a los tres sin arrancar.
    const versionados = spawnSync('git', ['ls-files', 'scripts/guardian-principal.mjs'], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(versionados.status, 0, 'git ls-files tiene que funcionar en el repo');
    assert.equal(versionados.stdout.trim(), 'scripts/guardian-principal.mjs', 'el guardián compartido no está versionado');
  });

  test('El guardián compara rutas canónicas con los enlaces simbólicos resueltos en los dos lados', (t) => {
    const casa = mkdtempSync(join(tmpdir(), 'wa-guardian-'));
    t.after(() => rmSync(casa, { recursive: true, force: true }));

    const real = join(casa, 'de-verdad.mjs');
    writeFileSync(real, 'export const nada = 1;\n');
    const enlace = join(casa, 'atajo.mjs');
    symlinkSync(real, enlace);

    // Enlace por el lado de `process.argv[1]`, que es como llega la invocación…
    assert.equal(esPrincipal(pathToFileURL(real).href, enlace), true);
    // …y por el lado de `import.meta.url`, que es como llegaría si el árbol
    // entero colgase de un enlace. Con `path.resolve` a secas fallarían las dos.
    assert.equal(esPrincipal(pathToFileURL(enlace).href, real), true);

    assert.equal(rutaCanonica(enlace), realpathSync(real));
    // Y un fichero distinto sigue sin ser el principal, que es lo que se pide.
    const otro = join(casa, 'otro.mjs');
    writeFileSync(otro, 'export const nada = 2;\n');
    assert.equal(esPrincipal(pathToFileURL(real).href, otro), false);
  });

  for (const script of CON_VEREDICTO) {
    test(`scripts/${script} da lo mismo por su ruta real que por una ruta con enlace simbólico`, (t) => {
      const caja = creaSandbox({ pruebas: 'pasa', nucleoRoto: true, mapa: { entradas: [] } });
      t.after(() => caja.borra());

      const real = realpathSync(caja.raiz);
      const { enlace, borra } = enlaceA(real);
      t.after(borra);

      const porLaReal = corre(caja, [join(real, 'scripts', script)], { cwd: real });
      const porElEnlace = corre(caja, [join(enlace, 'scripts', script)], { cwd: enlace });

      assert.match(porLaReal.stdout, /^VEREDICTO: /m, `${script} no imprimió veredicto ni por la ruta real`);
      assert.equal(porElEnlace.stdout, porLaReal.stdout, `${script} imprime cosas distintas según la ruta de invocación`);
      assert.equal(porElEnlace.codigo, porLaReal.codigo, `${script} devuelve códigos distintos según la ruta de invocación`);
    });
  }

  test('Un script del andamiaje se reconoce como principal por ruta relativa, con .. en medio y por un enlace al fichero', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [] } });
    t.after(() => caja.borra());

    // Un enlace que apunta directamente al fichero, no al directorio.
    symlinkSync(join(caja.raiz, 'scripts', 'valida-spec-test-map.mjs'), join(caja.raiz, 'atajo.mjs'));

    const referencia = corre(caja, [join(realpathSync(caja.raiz), 'scripts', 'valida-spec-test-map.mjs')]);
    assert.match(referencia.stdout, /^VEREDICTO: /m);

    for (const invocacion of [
      'scripts/valida-spec-test-map.mjs',
      'scripts/../scripts/valida-spec-test-map.mjs',
      'atajo.mjs',
    ]) {
      const r = corre(caja, [invocacion]);
      assert.match(r.stdout, /^VEREDICTO: /m, `invocado como "${invocacion}" no se reconoció como programa principal`);
      assert.equal(r.stdout, referencia.stdout, `invocado como "${invocacion}" imprime otra cosa`);
      assert.equal(r.codigo, referencia.codigo, `invocado como "${invocacion}" devuelve otro código`);
    }
  });

  test('Importar un script del andamiaje no ejecuta su cuerpo principal, no escribe nada y no fija código de salida', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [] } });
    t.after(() => caja.borra());

    for (const script of EJECUTABLES) {
      // El envoltorio importa el script siendo él el programa principal: así el
      // guardián se evalúa de verdad contra un argv[1] que existe y no coincide,
      // en vez de contra el argv[1] ausente de un `node -e`.
      caja.escribe(
        'envoltorio.mjs',
        [
          // La red, cortada de entrada: si algún día un guardián dejara de
          // dispararse, esta prueba falla en un segundo en vez de quedarse los
          // cuatro minutos de timeout de la captura esperando a Overpass.
          "globalThis.fetch = () => { throw new Error('la red está cortada en esta prueba'); };",
          `await import('./scripts/${script}');`,
          "process.stderr.write(`EXITCODE=${String(process.exitCode)}\\n`);",
          '',
        ].join('\n'),
      );

      const r = corre(caja, ['envoltorio.mjs']);
      assert.equal(r.stdout, '', `importar ${script} escribió por la salida estándar: ${r.stdout}`);
      assert.match(r.stderr, /EXITCODE=undefined/, `importar ${script} fijó un código de salida`);
      assert.equal(r.codigo, 0, `importar ${script} terminó en ${r.codigo}: ${r.stderr}`);
    }
  });

  test('Importar scripts/captura-fixtures.mjs no captura ningún fixture ni abre ninguna conexión de red', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa' });
    t.after(() => caja.borra());

    // Prueba hermética por construcción: el inspector en modo estricto corta
    // cualquier salida por `fetch` antes de que exista y nombra el destino, y el
    // contador de encima registra el intento aunque el corte lo tumbe. Afirmar
    // esto leyendo el código sería fe: hace falta que nadie llegue a salir.
    const inspector = pathToFileURL(join(RAIZ_REPO, 'test', 'dobles', 'inspector-red.mjs')).href;
    caja.escribe(
      'envoltorio-red.mjs',
      [
        `import { creaInspectorDeRed } from '${inspector}';`,
        '',
        'const inspector = creaInspectorDeRed({ estricto: true });',
        'const cortada = globalThis.fetch;',
        'let intentos = 0;',
        'globalThis.fetch = (...args) => { intentos++; return cortada(...args); };',
        '',
        'let error = null;',
        "try { await import('./scripts/captura-fixtures.mjs'); } catch (e) { error = e; }",
        '',
        'inspector.suelta();',
        "process.stderr.write(`INTENTOS=${intentos}\\nERROR=${error ? error.message : 'ninguno'}\\nEXITCODE=${String(process.exitCode)}\\n`);",
        '',
      ].join('\n'),
    );

    const r = corre(caja, ['envoltorio-red.mjs']);
    assert.equal(r.stdout, '', 'importar la captura escribió por la salida estándar');
    assert.match(r.stderr, /INTENTOS=0/, 'importar la captura intentó salir a la red');
    assert.match(r.stderr, /ERROR=ninguno/, r.stderr);
    assert.match(r.stderr, /EXITCODE=undefined/);
    assert.equal(
      existsSync(join(caja.raiz, 'test', 'fixtures')),
      false,
      'importar la captura creó el destino de los fixtures',
    );
  });

  test('El guardián decide que no es principal, sin lanzar, cuando no hay argv[1] o apunta a algo que no existe', (t) => {
    const inventada = join(tmpdir(), 'wa-no-existe-jamas', 'ni-esto.mjs');

    // Ni ausente, ni vacío, ni inexistente lanzan, y ninguno es el principal.
    // Se pasa `null` y no `undefined` porque `undefined` activa el parámetro por
    // defecto —que es leer `process.argv[1]` de verdad— y aquí se está afirmando
    // lo contrario. La ausencia real se afirma más abajo, en un proceso sin argv[1].
    for (const invocado of [null, '', inventada]) {
      assert.equal(esPrincipal(import.meta.url, invocado), false, `invocado=${JSON.stringify(invocado)}`);
    }
    assert.doesNotThrow(() => rutaCanonica(inventada));
    assert.equal(rutaCanonica(inventada), inventada);

    // Y en un proceso de verdad sin argv[1]: `node -e` no lo tiene.
    const caja = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [] } });
    t.after(() => caja.borra());

    for (const script of EJECUTABLES) {
      const url = pathToFileURL(join(caja.raiz, 'scripts', script)).href;
      const guion = [
        "globalThis.fetch = () => { throw new Error('la red está cortada en esta prueba'); };",
        `await import(${JSON.stringify(url)});`,
        "process.stderr.write('VIVO\\n');",
      ].join('\n');
      const r = corre(caja, ['--input-type=module', '-e', guion]);
      assert.equal(r.codigo, 0, `sin argv[1], importar ${script} reventó: ${r.stderr}`);
      assert.equal(r.stdout, '', `sin argv[1], ${script} se ejecutó igualmente`);
      assert.match(r.stderr, /VIVO/);
    }
  });
});

describe('Un script del andamiaje que emite veredicto lo escribe siempre', () => {
  test('scripts/valida-spec-test-map.mjs escribe su línea de veredicto pase lo que pase', (t) => {
    const situaciones = [
      { que: 'sin mapa', opciones: { mapa: null }, estado: 'sin-mapa', codigo: 0 },
      { que: 'con un mapa válido', opciones: { mapa: { entradas: [] } }, estado: 'valido', codigo: 0 },
      { que: 'con un mapa que no es JSON', opciones: { mapa: '{no soy json' }, estado: 'invalido', codigo: 1 },
      { que: 'con un mapa inválido', opciones: { mapa: { entradas: [{ spec: 'SPEC-001' }] } }, estado: 'invalido', codigo: 1 },
      { que: 'sin batería que consultar', opciones: { mapa: { entradas: [] }, bateria: null }, estado: 'no-validado', codigo: 2 },
    ];

    for (const situacion of situaciones) {
      const caja = creaSandbox({ pruebas: 'pasa', ...situacion.opciones });
      t.after(() => caja.borra());

      const r = corre(caja, ['scripts/valida-spec-test-map.mjs']);
      assert.match(r.stdout, /^VEREDICTO: /m, `${situacion.que}: no escribió línea de veredicto`);
      assert.match(r.stdout, new RegExp(`^VEREDICTO: ${situacion.estado} — .+`, 'm'), situacion.que);
      assert.equal(r.codigo, situacion.codigo, `${situacion.que}: ${r.salida}`);
    }
  });

  test('scripts/valida-spec-test-map.mjs que no llega a validar sale con un código distinto de 0 y explica por qué', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [] }, bateria: null });
    t.after(() => caja.borra());

    const r = corre(caja, ['scripts/valida-spec-test-map.mjs']);
    assert.notEqual(r.codigo, 0, 'no haber validado no puede parecerse a «válido»');
    assert.equal(r.codigo, 2, 'y tampoco a «inválido»: son tres desenlaces distintos');
    assert.match(r.stdout, /VEREDICTO: no-validado/);
    assert.match(r.stdout, /no se pudo validar el mapa/);
    assert.match(r.stdout, /testing\.md/, 'no dice qué se lo impidió');
  });

  test('scripts/comprueba-nucleo.mjs escribe su línea de veredicto pase lo que pase', (t) => {
    const situaciones = [
      { que: 'sin paquete todavía', opciones: {}, estado: 'sin-paquete', codigo: 0 },
      { que: 'con regresión de frontera', opciones: { nucleoRoto: true }, estado: 'regresion', codigo: 1 },
      { que: 'con el paquete ilegible', opciones: { nucleoIlegible: true }, estado: 'no-comprobada', codigo: 2 },
    ];

    for (const situacion of situaciones) {
      const caja = creaSandbox({ pruebas: 'pasa', ...situacion.opciones });
      t.after(() => caja.borra());

      const r = corre(caja, ['scripts/comprueba-nucleo.mjs']);
      assert.match(r.stdout, new RegExp(`^VEREDICTO: ${situacion.estado} — .+`, 'm'), `${situacion.que}: ${r.salida}`);
      assert.equal(r.codigo, situacion.codigo, `${situacion.que}: ${r.salida}`);
    }

    // Y con una frontera intacta de verdad, que es el caso que más importa que
    // no se confunda con «no comprobé».
    const sana = creaSandbox({ pruebas: 'pasa' });
    t.after(() => sana.borra());
    mkdirSync(join(sana.raiz, 'packages', 'nucleo'), { recursive: true });
    writeFileSync(join(sana.raiz, 'packages', 'nucleo', 'mundo.mjs'), 'export const mundo = 1;\n');

    const r = corre(sana, ['scripts/comprueba-nucleo.mjs']);
    assert.match(r.stdout, /^VEREDICTO: intacta — /m, r.salida);
    assert.equal(r.codigo, 0);
  });

  test('scripts/comprueba-nucleo.mjs que no llega a comprobar la frontera sale con un código distinto de 0 y explica por qué', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', nucleoIlegible: true });
    t.after(() => caja.borra());

    const r = corre(caja, ['scripts/comprueba-nucleo.mjs']);
    assert.notEqual(r.codigo, 0, '«no comprobé» no puede parecerse a «está intacta»');
    assert.equal(r.codigo, 2);
    assert.match(r.stdout, /VEREDICTO: no-comprobada/);
    assert.match(r.stdout, /no se pudo comprobar la frontera/);
  });
});

describe('Robustez de la clase entera', () => {
  test('Las cuatro invocaciones de cada pieza que emite veredicto dan el mismo veredicto y el mismo código', (t) => {
    const caja = creaSandbox({ pruebas: 'falla', nucleoRoto: true, mapa: { entradas: [] } });
    t.after(() => caja.borra());

    const real = realpathSync(caja.raiz);
    const { enlace, borra } = enlaceA(real);
    t.after(borra);

    const entornos = [
      ['shell limpia', entornoLimpio()],
      ['dentro de otro node --test', entornoDentroDeNodeTest()],
    ];

    for (const script of CON_VEREDICTO) {
      const vistos = [];
      for (const raiz of [real, enlace]) {
        for (const [comoSeLlama, env] of entornos) {
          const r = corre(caja, [join(raiz, 'scripts', script)], { cwd: raiz, env });
          vistos.push({ como: `${raiz === real ? 'ruta real' : 'ruta con enlace'} · ${comoSeLlama}`, salida: r.stdout, codigo: r.codigo });
        }
      }
      assert.equal(vistos.length, 4);
      for (const visto of vistos.slice(1)) {
        assert.equal(visto.salida, vistos[0].salida, `${script} dice otra cosa por ${visto.como}`);
        assert.equal(visto.codigo, vistos[0].codigo, `${script} devuelve otro código por ${visto.como}`);
      }
      assert.match(vistos[0].salida, /^VEREDICTO: /m, `${script} no llegó a emitir veredicto en ninguna de las cuatro`);
    }

    // Y el runner, que es la tercera pieza con veredicto. Se invoca a mano y no
    // con `caja.corre` porque lo que está a prueba es precisamente la ruta de
    // invocación, y `caja.corre` siempre usa la del sandbox.
    const delRunner = [];
    for (const raiz of [real, enlace]) {
      for (const [comoSeLlama, env] of entornos) {
        const r = spawnSync('bash', [join(raiz, 'scripts', 'qa-tester-run.sh'), 'SPEC-001'], {
          cwd: raiz,
          encoding: 'utf8',
          env,
        });
        const rel = (r.stdout ?? '').trim();
        const ruta = rel ? join(raiz, rel) : null;
        delRunner.push({
          como: `${raiz === real ? 'ruta real' : 'ruta con enlace'} · ${comoSeLlama}`,
          codigo: r.status,
          veredicto: sinSelloNiDuraciones(ruta && existsSync(ruta) ? readFileSync(ruta, 'utf8') : '')
            .split('\n')
            .find((l) => l.trim().length > 0),
        });
      }
    }
    for (const visto of delRunner.slice(1)) {
      assert.equal(visto.codigo, delRunner[0].codigo, `el runner devuelve otro código por ${visto.como}`);
      assert.equal(visto.veredicto, delRunner[0].veredicto, `el runner da otro veredicto por ${visto.como}`);
    }
  });
});
