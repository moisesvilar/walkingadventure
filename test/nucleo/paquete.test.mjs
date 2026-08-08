// SPEC-002 · El paquete compartido: su disposición, su frontera con la plataforma
// y lo que se ha quedado fuera de él.
//
// Todo lo de aquí se afirma leyendo el repositorio, no generando mundos: son las
// reglas que hacen que el núcleo siga siendo ejecutable en Node y que la frontera
// deje de ser una costumbre para pasar a ser comprobable. Ninguna de estas
// comprobaciones existe en docs/testing.md — la batería describe qué hace el
// juego, no cómo está repartido el código —, así que van marcadas como hueco en
// test/spec-test-map.json.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { NUCLEO, fuente, hay, modulosDelPaquete } from './mundo-de-prueba.mjs';

const PAQUETE_JSON = JSON.parse(fuente('packages/nucleo/package.json'));

// Los builtins que un módulo del núcleo podría querer y no puede tener: si el
// paquete importa cualquiera de estos, deja de correr dentro de la app.
const BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'https', 'module',
  'net', 'os', 'path', 'process', 'stream', 'timers', 'tls', 'url', 'util', 'worker_threads', 'zlib',
]);

function importsDe(modulo) {
  const texto = fuente(modulo);
  const rutas = [];
  for (const m of texto.matchAll(/(?:^|\n)\s*(?:import|export)[^\n]*?from\s+['"]([^'"]+)['"]/g)) rutas.push(m[1]);
  for (const m of texto.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) rutas.push(m[1]);
  return rutas;
}

function ficherosDe(dir, filtro = () => true, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) ficherosDe(p, filtro, base, out);
    else if (filtro(e.name)) out.push(p);
  }
  return out;
}

describe('El paquete compartido y su disposición', () => {
  test('El paquete tiene las cuatro áreas: core, world, names y quests', () => {
    const areas = readdirSync(NUCLEO, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const area of ['core', 'names', 'quests', 'world']) assert.ok(areas.includes(area), `falta el área ${area}/`);
  });

  test('Cualquier módulo del paquete arranca en Node sin instalar ninguna dependencia', () => {
    assert.equal(hay('packages/nucleo/node_modules'), false, 'el paquete no puede traer node_modules');
    assert.equal(hay('node_modules'), false, 'el repo no instala dependencias');

    const imports = modulosDelPaquete()
      .map((m) => `await import(${JSON.stringify(join(RAIZ_REPO, m))});`)
      .join('\n');
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', imports], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `importar el paquete falla:\n${r.stderr}`);
  });

  test('packages/nucleo/package.json declara "type": "module"', () => {
    assert.equal(PAQUETE_JSON.type, 'module');
  });

  test('packages/nucleo/package.json no declara ninguna dependencia de runtime', () => {
    for (const campo of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      assert.deepEqual(PAQUETE_JSON[campo] ?? {}, {}, `el paquete declara ${campo}`);
    }
  });

  test('git ls-files trae todos los módulos del paquete: ninguna regla de .gitignore se traga uno', () => {
    // El precedente es real: una regla sin anclar se tragó app/js/data/overpass.js
    // entero y ningún test lo detectó, porque ninguno lo importaba.
    const r = spawnSync('git', ['ls-files', 'packages/nucleo'], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, 'git ls-files ha fallado');
    const versionados = new Set(r.stdout.split('\n').filter(Boolean));

    const enDisco = ficherosDe(NUCLEO, (n) => /\.(js|mjs|json)$/.test(n)).map((p) => p.slice(RAIZ_REPO.length + 1));
    assert.ok(enDisco.length > 0, 'no hay nada en el paquete que comprobar');
    for (const f of enDisco) assert.equal(versionados.has(f), true, `${f} existe en disco pero no está versionado`);
  });

  test('No hay ningún fichero .ts ni .tsx en el paquete', () => {
    assert.deepEqual(ficherosDe(NUCLEO, (n) => /\.tsx?$/.test(n)), []);
  });

  test('Todos los imports del paquete citan la extensión del fichero', () => {
    for (const modulo of modulosDelPaquete()) {
      for (const ruta of importsDe(modulo)) {
        assert.match(ruta, /\.(js|mjs|json)$/, `${modulo}: importa "${ruta}" sin extensión`);
      }
    }
  });

  test('Cada módulo del paquete abre explicando qué hace, en español', () => {
    // Comprobación de forma, no de estilo: que el módulo abra con su comentario y
    // que ese comentario esté escrito en español. Que los nombres de dominio lo
    // estén se revisa a ojo, y así queda dicho en el mapa de cobertura.
    const ESPANOL = /\b(el|la|los|las|de|que|para|con|por|no|se|un|una)\b/i;
    for (const modulo of modulosDelPaquete()) {
      const primeras = fuente(modulo).split('\n').slice(0, 3).join(' ');
      assert.match(primeras, /^\s*\/\//, `${modulo}: no abre con un comentario que diga qué hace`);
      assert.match(primeras, ESPANOL, `${modulo}: el comentario de cabecera no está en español`);
    }
  });

  test('packages/nucleo/partida/ todavía no existe', () => {
    // Su contenido lo entrega la fila 9 del checklist, y git no versiona
    // directorios vacíos: crearlo ahora sería código muerto que habría que borrar.
    assert.equal(hay('packages/nucleo/partida'), false);
  });
});

describe('La frontera dura con la plataforma', () => {
  test('Ningún módulo del paquete importa de React Native ni de Expo', () => {
    const prohibidos = /^(react-native|expo|@react-native|@expo|react-native-.*|expo-.*)/;
    for (const modulo of modulosDelPaquete()) {
      for (const ruta of importsDe(modulo)) {
        assert.equal(prohibidos.test(ruta), false, `${modulo}: importa "${ruta}", que es de React Native o Expo`);
      }
    }
  });

  test('Ningún módulo del paquete importa un builtin de Node', () => {
    for (const modulo of modulosDelPaquete()) {
      for (const ruta of importsDe(modulo)) {
        assert.equal(ruta.startsWith('node:'), false, `${modulo}: importa "${ruta}", que es un builtin de Node`);
        assert.equal(BUILTINS.has(ruta), false, `${modulo}: importa "${ruta}", que es un builtin de Node`);
      }
    }
  });

  test('Ningún módulo del paquete importa de app/, server.mjs, scripts/ ni test/', () => {
    for (const modulo of modulosDelPaquete()) {
      for (const ruta of importsDe(modulo)) {
        assert.equal(
          /(^|\/)(app|scripts|test)\//.test(ruta) || /server\.mjs$/.test(ruta),
          false,
          `${modulo}: importa "${ruta}", que está fuera del paquete`,
        );
      }
    }
  });

  test('En el paquete no aparece ninguna puerta de la plataforma: fetch, XMLHttpRequest, WebSocket, localStorage, document ni window', () => {
    // `fetch` se busca como llamada y no como palabra: `fetchData` es justo lo
    // contrario de una puerta abierta —es la dependencia inyectada— y tiene que
    // seguir pudiendo llamarse así.
    const puertas = [
      ['fetch', /\bfetch\s*\(/],
      ['XMLHttpRequest', /\bXMLHttpRequest\b/],
      ['WebSocket', /\bWebSocket\b/],
      ['localStorage', /\blocalStorage\b/],
      ['document', /\bdocument\b/],
      ['window', /\bwindow\b/],
    ];
    for (const modulo of modulosDelPaquete()) {
      const texto = fuente(modulo);
      for (const [nombre, patron] of puertas) {
        assert.equal(patron.test(texto), false, `${modulo}: usa la puerta de la plataforma "${nombre}"`);
      }
    }
  });

  test('scripts/comprueba-nucleo.mjs ya no informa de que el paquete no existe y termina con código 0', () => {
    const r = spawnSync(process.execPath, [join(RAIZ_REPO, 'scripts', 'comprueba-nucleo.mjs')], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `la comprobación de la frontera ha fallado:\n${r.stdout}${r.stderr}`);
    assert.doesNotMatch(r.stdout, /todavía no existe/, 'sigue diciendo que el paquete no existe');
  });

  test('El veredicto de la frontera del núcleo deja de ser una comprobación saltada', () => {
    // Es la línea que el runner recoge y publica en el report: mientras diga
    // «sin-paquete», el report registra la frontera como comprobación saltada.
    const r = spawnSync(process.execPath, [join(RAIZ_REPO, 'scripts', 'comprueba-nucleo.mjs')], { cwd: RAIZ_REPO, encoding: 'utf8' });
    const veredicto = r.stdout.split('\n').find((l) => l.startsWith('VEREDICTO: '));
    assert.ok(veredicto, 'la comprobación no ha escrito su línea de veredicto');
    assert.doesNotMatch(veredicto, /sin-paquete/, 'la frontera sigue sin comprobarse: no hay paquete que comprobar');
    assert.match(veredicto, /^VEREDICTO: intacta/);
  });
});

describe('Lo que se queda fuera del paquete', () => {
  test('app/js ya no tiene core, world, names ni quests', () => {
    for (const area of ['core', 'world', 'names', 'quests']) {
      assert.equal(hay(`app/js/${area}`), false, `app/js/${area}/ sigue ahí: el generador se ha duplicado, no movido`);
    }
  });

  test('Los imports con los que app/ consume el generador apuntan todos a packages/nucleo/', () => {
    const dellApp = ficherosDe(join(RAIZ_REPO, 'app'), (n) => /\.(js|mjs)$/.test(n)).map((p) => p.slice(RAIZ_REPO.length + 1));
    const modulosDelNucleo = /(core|world|names|quests)\/(rng|geo|build|osm|seamask|settlements|routes|parajes|index|es|gl|casting|templates)\.js$/;
    let vistos = 0;
    for (const fichero of dellApp) {
      for (const ruta of importsDe(fichero)) {
        if (!modulosDelNucleo.test(ruta)) continue;
        vistos += 1;
        assert.match(ruta, /packages\/nucleo\//, `${fichero}: importa "${ruta}", que no es el paquete`);
      }
    }
    assert.ok(vistos > 0, 'ningún fichero de app/ consume el generador: algo se ha perdido por el camino');
  });

  test('app/js/data/overpass.js conserva la construcción de las consultas y el transporte', () => {
    const texto = fuente('app/js/data/overpass.js');
    for (const exportado of ['fetchGeoFeatures', 'fetchPois', 'fetchStreets']) {
      assert.match(texto, new RegExp(`export\\s+(async\\s+)?function\\s+${exportado}\\b`), `falta ${exportado}`);
    }
    assert.match(texto, /\[out:json\]/, 'la construcción de la consulta Overpass tiene que quedarse aquí');
  });

  test('app/js/data/overpass.js ya no contiene el parseo de la respuesta de OSM', () => {
    const texto = fuente('app/js/data/overpass.js');
    for (const parseo of ['parseGeo', 'parseStreets', 'parsePois']) {
      assert.doesNotMatch(texto, new RegExp(`function\\s+${parseo}\\b`), `${parseo} sigue en la capa de datos`);
    }
  });

  test('En el paquete no aparece ningún texto de consulta de Overpass', () => {
    for (const modulo of modulosDelPaquete()) {
      const texto = fuente(modulo);
      assert.doesNotMatch(texto, /\[out:json\]/, `${modulo}: lleva una consulta de Overpass`);
      assert.doesNotMatch(texto, /\baround:\d/, `${modulo}: lleva una consulta de Overpass`);
    }
  });

  test('node test/headless.mjs sigue terminando en verde', () => {
    const r = spawnSync(process.execPath, [join(RAIZ_REPO, 'test', 'headless.mjs')], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `headless ha fallado:\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /Todo OK/);
  });

  test('El porte no ha tocado ni un fichero de archive/', () => {
    // archive/ son instantáneas congeladas: cualquier búsqueda global devuelve
    // resultados duplicados desde ahí, y por eso el porte tenía que dejarlas
    // intactas en lugar de usarlas como fuente.
    const commit = spawnSync('git', ['log', '--format=%H', '-1', '--grep', 'feat(SPEC-002)', '--fixed-strings'], {
      cwd: RAIZ_REPO,
      encoding: 'utf8',
    }).stdout.trim();
    assert.match(commit, /^[0-9a-f]{40}$/, 'no se encuentra el commit del porte');

    const tocados = spawnSync('git', ['show', '--name-only', '--format=', commit, '--', 'archive/'], {
      cwd: RAIZ_REPO,
      encoding: 'utf8',
    }).stdout.trim();
    assert.equal(tocados, '', `el porte ha tocado archive/:\n${tocados}`);

    const sucios = spawnSync('git', ['status', '--porcelain', '--', 'archive/'], { cwd: RAIZ_REPO, encoding: 'utf8' }).stdout.trim();
    assert.equal(sucios, '', `hay cambios sin commitear en archive/:\n${sucios}`);
  });
});
