// SPEC-001 · El mapa de cobertura y su esquema.
//
// El mapa es lo que permite ver de un vistazo qué parte de la batería escrita
// antes de implementar está viva. Lo que se afirma aquí es que no puede mentir:
// un nivel inventado, un fichero que no existe o un escenario que ya no está en
// docs/testing.md rompen la validación, y una entrada sin escenario solo pasa si
// viene declarada como hueco. Un hueco silencioso es indistinguible de un olvido.
//
// La validación corre sobre el sandbox por la misma razón que el runner: el
// validador calcula su raíz desde su propia ubicación, así que darle otra raíz es
// la única manera de probar los casos malos sin ensuciar el mapa de verdad.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { creaSandbox, CASO_QUE_PASA, ESCENARIO_DE_LA_BATERIA, RAIZ_REPO } from './andamiaje-sandbox.mjs';

/** Una entrada válida de la que partir, para cambiarle una cosa cada vez. */
function entradaBuena(cambios = {}) {
  return {
    spec: 'SPEC-001',
    criterio: 'Un criterio cualquiera de la spec',
    nivel: '@nucleo',
    fichero: 'test/nucleo/ejemplo.test.mjs',
    caso: CASO_QUE_PASA,
    escenario: ESCENARIO_DE_LA_BATERIA,
    ...cambios,
  };
}

function valida(caja) {
  const r = spawnSync(process.execPath, [join(caja.raiz, 'scripts', 'valida-spec-test-map.mjs')], {
    cwd: caja.raiz,
    encoding: 'utf8',
  });
  return { codigo: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

describe('El mapa de cobertura y su esquema', () => {
  test('El esquema declara spec, criterio, nivel, fichero, nombre del caso y escenario que lo respalda', () => {
    const esquema = JSON.parse(readFileSync(join(RAIZ_REPO, 'test', 'spec-test-map.schema.json'), 'utf8'));
    const entrada = esquema.$defs.entrada;

    assert.deepEqual(entrada.required, ['spec', 'criterio', 'nivel', 'fichero', 'caso']);
    for (const campo of ['spec', 'criterio', 'nivel', 'fichero', 'caso', 'escenario', 'hueco_de_bateria']) {
      assert.ok(entrada.properties[campo], `el esquema no declara "${campo}"`);
      assert.ok(entrada.properties[campo].description, `"${campo}" se declara sin decir qué es`);
    }
    assert.deepEqual(entrada.properties.nivel.enum, ['@nucleo', '@app', '@red', '@manual']);
    assert.equal(entrada.additionalProperties, false, 'un campo de más tiene que romper, no colarse');
  });

  test('Una entrada con un nivel que no es de los cuatro rompe la validación nombrando la entrada', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [entradaBuena({ nivel: '@integracion' })] } });
    t.after(() => caja.borra());

    const r = valida(caja);
    assert.equal(r.codigo, 1);
    assert.match(r.salida, /@integracion/);
    assert.match(r.salida, /Un caso de ejemplo del andamiaje que pasa/, 'no nombra la entrada que falla');
  });

  test('Una entrada que apunta a un fichero de pruebas que no existe rompe la validación nombrando el fichero', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [entradaBuena({ fichero: 'test/nucleo/no-existe.test.mjs' })] } });
    t.after(() => caja.borra());

    const r = valida(caja);
    assert.equal(r.codigo, 1);
    assert.match(r.salida, /test\/nucleo\/no-existe\.test\.mjs/);
    assert.match(r.salida, /no existe/);
  });

  test('Una entrada que cita un escenario que no está en docs/testing.md rompe la validación nombrando el escenario', (t) => {
    const inventado = 'Un escenario que nadie ha escrito nunca';
    const caja = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [entradaBuena({ escenario: inventado })] } });
    t.after(() => caja.borra());

    const r = valida(caja);
    assert.equal(r.codigo, 1);
    assert.match(r.salida, new RegExp(inventado));
    assert.match(r.salida, /docs\/testing\.md/);
  });

  test('Una entrada sin escenario se acepta solo si viene marcada como hueco de la batería', (t) => {
    const sinDeclarar = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [entradaBuena({ escenario: undefined })] } });
    t.after(() => sinDeclarar.borra());
    const malo = valida(sinDeclarar);
    assert.equal(malo.codigo, 1, 'un hueco silencioso no puede pasar');
    assert.match(malo.salida, /hueco_de_bateria/);

    const declarado = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [entradaBuena({ escenario: undefined, hueco_de_bateria: true })] } });
    t.after(() => declarado.borra());
    const bueno = valida(declarado);
    assert.equal(bueno.codigo, 0, bueno.salida);
    assert.match(bueno.salida, /todas v[áa]lidas/);
  });

  test('Si test/spec-test-map.json todavía no existe, la validación lo informa y no es un error', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', mapa: null });
    t.after(() => caja.borra());

    const r = valida(caja);
    assert.equal(r.codigo, 0, 'no tener mapa todavía no es un fallo');
    assert.match(r.salida, /todav[íi]a no existe/);
  });

  test('El resultado de validar el mapa sale en el report como aviso de infraestructura y nunca como prueba en rojo', (t) => {
    const caja = creaSandbox({ pruebas: 'pasa', mapa: { entradas: [entradaBuena({ nivel: '@integracion' })] } });
    t.after(() => caja.borra());

    const r = caja.corre(['SPEC-001']);
    assert.equal(r.codigo, 0, 'un mapa incompleto no es una regresión del juego');
    assert.match(r.report, /# PASS/);

    const infraestructura = r.report.indexOf('## 3 · Infraestructura ausente');
    const resultados = r.report.indexOf('## 4 · Resultados de @nucleo');
    const problema = r.report.indexOf('@integracion');

    assert.ok(problema > infraestructura && problema < resultados, 'el problema del mapa no está en la sección de infraestructura');
    assert.match(r.report.slice(infraestructura, resultados), /Mapa de cobertura/);
    assert.match(r.report.slice(resultados), /Estado: OK/);
  });

  test('El mapa de cobertura de verdad del repo es válido contra su esquema', () => {
    const r = spawnSync(process.execPath, [join(RAIZ_REPO, 'scripts', 'valida-spec-test-map.mjs')], {
      cwd: RAIZ_REPO,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  });
});
