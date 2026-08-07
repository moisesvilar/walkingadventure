// SPEC-001 · Estructura y frontera del andamiaje.
//
// Afirma lo que hace ejecutable a todo lo demás: cero dependencias, los ficheros
// versionados de verdad (precedente: un .gitignore sin anclar se tragó un módulo
// entero y ningún test lo detectó), y ninguna atadura al paquete, a la app ni a
// la configuración de la máquina.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

const PROHIBIDOS = [/^packages\/nucleo\//, /^app\//, /^react-native/, /^expo/, /^@react-native/, /^@expo/];

/** Todos los módulos JS de un directorio, recursivo y en orden estable. */
function modulos(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...modulos(p));
    else if (/\.(mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Los especificadores de todos los import/export ... from de un módulo. */
function importes(fuente) {
  const out = [];
  for (const m of fuente.matchAll(/(?:^|\n)\s*(?:import|export)[^\n]*?from\s+['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of fuente.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);
  for (const m of fuente.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)) out.push(m[1]);
  return out;
}

// Los módulos y scripts que forman el andamiaje. `overpass-setup.sh`,
// `verifica-*.mjs`, `headless.mjs` y `casting-report.mjs` son del prototipo y no
// entran: esta spec no los toca. `test/nucleo/` tampoco: eso son los casos de
// prueba, que sí pueden mirar el entorno para lanzar un subproceso.
const ANDAMIAJE = [
  ...modulos(join(RAIZ_REPO, 'test', 'dobles')),
  ...modulos(join(RAIZ_REPO, 'test', 'fixtures')),
  join(RAIZ_REPO, 'scripts', 'qa-tester-run.sh'),
  join(RAIZ_REPO, 'scripts', 'captura-fixtures.mjs'),
  join(RAIZ_REPO, 'scripts', 'valida-spec-test-map.mjs'),
  join(RAIZ_REPO, 'scripts', 'comprueba-nucleo.mjs'),
  // El guardián compartido llegó con SPEC-001-iter-1 y es andamiaje como los
  // demás: si se quedara fuera de esta lista, el único módulo que los otros tres
  // importan sería también el único sin comprobar.
  join(RAIZ_REPO, 'scripts', 'guardian-principal.mjs'),
];

describe('Estructura y frontera del andamiaje', () => {
  test('node --test test/nucleo/ arranca sin instalar ninguna dependencia', () => {
    // No se invoca `node --test test/nucleo/` de verdad porque eso es
    // precisamente lo que ejecuta este fichero: se afirma la propiedad que hace
    // que arranque sin instalar nada, que es que no hay nada que instalar y que
    // ningún módulo pide un paquete de fuera.
    assert.equal(existsSync(join(RAIZ_REPO, 'package.json')), false, 'el repo no tiene package.json a propósito');
    assert.equal(existsSync(join(RAIZ_REPO, 'node_modules')), false, 'el repo no tiene node_modules');

    const externos = [];
    for (const f of [...modulos(join(RAIZ_REPO, 'test', 'nucleo')), ...modulos(join(RAIZ_REPO, 'test', 'dobles'))]) {
      for (const spec of importes(readFileSync(f, 'utf8'))) {
        const interno = spec.startsWith('node:') || spec.startsWith('.') || spec.startsWith('/');
        if (!interno) externos.push(`${relative(RAIZ_REPO, f)} → ${spec}`);
      }
    }
    assert.deepEqual(externos, [], 'las pruebas y los dobles solo importan builtins de node: o rutas relativas');
  });

  test('Los cuatro fixtures, los cinco dobles, el esquema y el runner están versionados', () => {
    const r = spawnSync('git', ['ls-files'], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, 'git ls-files tiene que funcionar en el repo');
    const versionados = new Set(r.stdout.split('\n').filter(Boolean));

    const esperados = [
      ...['costero', 'urbano-denso', 'barrio-tres-calles', 'suelo-250m'].flatMap((m) =>
        ['manifiesto', 'geo', 'pois', 'callejero'].map((p) => `test/fixtures/osm/${m}/${p}.json`),
      ),
      'test/dobles/mundo-congelado.mjs',
      'test/dobles/gps-simulado.mjs',
      'test/dobles/reloj-mundo.mjs',
      'test/dobles/proxy.mjs',
      'test/dobles/inspector-red.mjs',
      'test/spec-test-map.schema.json',
      'scripts/qa-tester-run.sh',
    ];

    const faltan = esperados.filter((p) => !versionados.has(p));
    assert.deepEqual(faltan, [], 'hay ficheros del andamiaje sin versionar (mira .gitignore: en este repo ya pasó)');
  });

  test('Ningún módulo de fixtures ni de dobles importa del paquete, de la app, de React Native ni de Expo', () => {
    const infracciones = [];
    for (const f of [...modulos(join(RAIZ_REPO, 'test', 'fixtures')), ...modulos(join(RAIZ_REPO, 'test', 'dobles'))]) {
      for (const spec of importes(readFileSync(f, 'utf8'))) {
        if (PROHIBIDOS.some((re) => re.test(spec))) infracciones.push(`${relative(RAIZ_REPO, f)} → ${spec}`);
      }
    }
    assert.deepEqual(infracciones, [], 'el andamiaje se entrega antes que packages/nucleo/ y no puede depender de él');
  });

  test('Ningún módulo del andamiaje lee variables de entorno ni ficheros .env', () => {
    const infracciones = [];
    for (const f of ANDAMIAJE) {
      const fuente = readFileSync(f, 'utf8');
      const rel = relative(RAIZ_REPO, f);
      // Patrones de código, no de prosa: los comentarios de estos ficheros hablan
      // de «.env» a propósito y no deben contar como infracción.
      if (/process\.env\b/.test(fuente)) infracciones.push(`${rel}: usa process.env`);
      if (/\bdotenv\b/.test(fuente)) infracciones.push(`${rel}: usa dotenv`);
      if (/(^|\n)\s*(?:source|\.)\s+[^\n]*\.env\b/.test(fuente)) infracciones.push(`${rel}: hace source de un .env`);
      if (/readFileSync\([^)]*\.env['"]/.test(fuente)) infracciones.push(`${rel}: lee un fichero .env`);
      for (const m of fuente.matchAll(/\$\{?([A-Z][A-Z0-9_]*)\}?/g)) {
        if (/(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/.test(m[1])) infracciones.push(`${rel}: lee $${m[1]}`);
      }
    }
    assert.deepEqual(infracciones, [], 'el andamiaje no depende de la configuración de la máquina que lo ejecuta');
  });

  test('Existen test/nucleo/, test/app/ y test/reports/ aunque estén vacíos', () => {
    for (const dir of ['test/nucleo', 'test/app', 'test/reports']) {
      const ruta = join(RAIZ_REPO, dir);
      assert.equal(existsSync(ruta), true, `falta el directorio ${dir}`);
      assert.equal(statSync(ruta).isDirectory(), true, `${dir} tiene que ser un directorio`);
    }
  });
});
