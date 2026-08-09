// SPEC-020 · El andamiaje de la app de Expo: dónde vive cada mitad del
// repositorio, cómo alcanza la app el paquete compartido, qué pinta la pantalla
// de andamiaje y qué le pasó al prototipo web al mudarse.
//
// Casi todo se afirma leyendo el repositorio, y es deliberado: esta fila no
// entrega juego, entrega una disposición y una frontera. Lo que sí se ejecuta es
// el sorteo del título de mundo, que es lo único que demuestra RF-INFRA-001 sin
// datos de OSM — y se ejecuta contra el paquete, por ruta relativa, porque una
// prueba de @nucleo no puede importar `@walkingadventure/nucleo` sin depender de
// una instalación, que es justo lo que esta spec prohíbe.
//
// **Nada de esto tiene escenario en docs/testing.md** —la batería describe qué
// hace el juego, no cómo está repartido el código— salvo «No se usa ninguna
// fuente de azar ni de tiempo del sistema», del que aquí vive la mitad que
// compara el título de la app con el de Node. Todo lo demás va marcado como hueco
// de batería en test/spec-test-map.json.
//
// Lo que NO se puede afirmar aquí: que la app arranque de verdad. Eso es de
// `test/app/`, y en esta máquina no hay dispositivo donde instalarla.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { localeFor, namesFor } from '../../packages/nucleo/names/index.js';
import { makeRng } from '../../packages/nucleo/core/rng.js';
import { SUFIJOS_DE_FASE } from '../../packages/nucleo/core/semilla.js';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { fuente, hay } from './mundo-de-prueba.mjs';

const APP_JSON = JSON.parse(fuente('app/app.json'));

/**
 * Los dos flujos de Maestro **de esta fila**. Se nombran y no se descubren leyendo el
 * directorio: `test/app/` crece con cada fila que entrega pantalla, y una prueba de
 * SPEC-020 que comparase el directorio entero se pondría roja por lo que hace otra.
 */
const FLUJOS_DE_ESTA_FILA = ['test/app/andamiaje.yaml', 'test/app/gancho-capacidad-ausente.yaml'];
const APP_PAQUETE = JSON.parse(fuente('app/package.json'));
const RAIZ_PAQUETE = JSON.parse(fuente('package.json'));

/** La semilla de andamiaje, literal en la spec y literal aquí. */
const SEMILLA = '42.40,-8.81#1';

/** Lo que nunca es código del repo. */
const NO_ES_CODIGO = new Set(['node_modules', '.expo', 'ios', 'android', 'dist', '.git']);

function ficherosDe(dir, filtro = () => true, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.isDirectory()) {
      if (!NO_ES_CODIGO.has(e.name)) ficherosDe(join(dir, e.name), filtro, out);
    } else if (filtro(e.name)) {
      out.push(join(dir, e.name).slice(RAIZ_REPO.length + 1));
    }
  }
  return out;
}

/** Los módulos de la app, sin dependencias instaladas ni artefactos. */
function modulosDeLaApp() {
  return ficherosDe(join(RAIZ_REPO, 'app'), (n) => /\.(js|mjs|jsx)$/.test(n));
}

/**
 * El título de mundo, sorteado en Node exactamente como lo sortea la tubería.
 * Es la referencia contra la que se compara el de la app.
 */
function tituloEnNode(semilla = SEMILLA) {
  const [lat, lon] = semilla.split('#')[0].split(',').map(Number);
  return namesFor(localeFor(lat, lon)).worldTitle(makeRng(semilla + SUFIJOS_DE_FASE.titulo));
}

// ── La disposición del repositorio tras estrenar la app ──────────────────────────

describe('La disposición del repositorio tras estrenar la app', () => {
  test('app/ es el proyecto de Expo y prototipo/ es el prototipo web', () => {
    assert.equal(hay('app/app.json'), true, 'app/ no es un proyecto de Expo: falta app.json');
    assert.equal(hay('app/package.json'), true);
    assert.equal(hay('app/index.js'), true, 'falta el punto de entrada de la app');
    assert.equal(hay('prototipo/index.html'), true, 'prototipo/ no es el prototipo web: falta index.html');
    assert.equal(hay('prototipo/js/main.js'), true);
  });

  test('En app/ no queda ningún fichero del prototipo web', () => {
    for (const resto of ['app/index.html', 'app/style.css', 'app/js/render', 'app/js/main.js', 'app/js/data']) {
      assert.equal(hay(resto), false, `${resto} sigue en app/: la mudanza dejó algo atrás`);
    }
  });

  test('app/package.json declara exactamente las dependencias que la spec nombra', () => {
    // Lista cerrada de «Las dependencias que entran». Cualquier añadido que ninguna
    // spec nombre tiene que ponerse rojo aquí: es la única barrera contra que una
    // app vacía se llene de librerías que nadie pidió.
    //
    // **Cómo se abre la lista**: una dependencia entra cuando la spec de la fila que
    // la trae la nombra en su reparto, y entra en la misma iteración que el código
    // que la usa — nunca «por si acaso» ni por comodidad de quien implementa. Al
    // abrirla, el paquete pasa de `fuera` a `permitidas` citando la fila que lo
    // autoriza, y `fuera` conserva a los demás con el motivo por el que esperan.
    //
    // `@shopify/react-native-skia` entra por **SPEC-021**, que porta el pintado del
    // mapa a Skia: `app/render/skia.js` ejecuta la escena sobre un lienzo de Skia y
    // `app/render/lamina.jsx` lo monta. Sigue sin ser obligatoria porque el render
    // recibe Skia inyectado (`app/render/enlace-skia.js`) y por eso se compone y se
    // ejercita en Node sin ella; el día que se declare, esta lista ya no lo impide.
    const permitidas = new Set([
      'expo', 'react', 'react-native', 'expo-haptics', 'expo-notifications', 'expo-linking', '@walkingadventure/nucleo',
      '@shopify/react-native-skia', // SPEC-021: el pintado del mapa
    ]);
    const declaradas = Object.keys(APP_PAQUETE.dependencies ?? {});
    for (const d of declaradas) {
      assert.equal(permitidas.has(d), true, `app/package.json declara "${d}", que la spec no nombra`);
    }
    for (const obligatoria of ['expo', 'react', 'react-native', 'expo-haptics', 'expo-notifications', '@walkingadventure/nucleo']) {
      assert.equal(declaradas.includes(obligatoria), true, `falta la dependencia "${obligatoria}"`);
    }
    // Lo que la spec deja fuera con su fila, nombrado para que el rojo explique por qué.
    const fuera = {
      'react-navigation': 'navegación, fila 27',
      'expo-router': 'navegación, fila 27',
      'expo-font': 'tipografías propias, fila 27',
      axios: 'cliente HTTP, fila 26',
      '@react-native-async-storage/async-storage': 'almacenamiento de partida, fila 39',
      'expo-task-manager': 'servicio en primer plano, fila 30',
    };
    for (const [paquete, fila] of Object.entries(fuera)) {
      assert.equal(declaradas.includes(paquete), false, `"${paquete}" no entra en esta fila (${fila})`);
    }
  });

  test('El package.json de la raíz declara el espacio de trabajo y ninguna dependencia de runtime', () => {
    assert.deepEqual(RAIZ_PAQUETE.workspaces, ['app', 'packages/*']);
    for (const campo of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      assert.deepEqual(RAIZ_PAQUETE[campo] ?? {}, {}, `la raíz declara ${campo}`);
    }
    assert.equal(RAIZ_PAQUETE.private, true, 'el espacio de trabajo tiene que ser privado');
  });

  test('git ls-files app trae el código de la app y ningún artefacto de compilación', () => {
    const r = spawnSync('git', ['ls-files', 'app'], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, 'git ls-files ha fallado');
    const versionados = r.stdout.split('\n').filter(Boolean);

    for (const esperado of ['app/app.json', 'app/package.json', 'app/index.js', 'app/App.js', 'app/pantallas/andamiaje.js', 'app/plataforma/registro.js']) {
      assert.equal(versionados.includes(esperado), true, `${esperado} existe pero no está versionado`);
    }
    const artefactos = versionados.filter((f) => /(^|\/)(node_modules|\.expo|ios|android|dist)\//.test(f));
    assert.deepEqual(artefactos, [], 'hay artefactos de compilación versionados');

    // Y el código que está en disco está versionado: el precedente de la regla de
    // .gitignore sin anclar que se tragó un módulo entero es de este repo.
    const enDisco = modulosDeLaApp();
    assert.ok(enDisco.length > 0, 'no hay código de app/ que comprobar');
    for (const f of enDisco) assert.equal(versionados.includes(f), true, `${f} existe en disco pero no está versionado`);
  });

  test('Todas las reglas de .gitignore van ancladas con barra inicial', () => {
    // El precedente es de este repo: `data/` sin anclar hacía match con
    // `app/js/data/` y se tragó un módulo que nunca llegó a commitearse.
    const sinAnclar = [];
    for (const linea of fuente('.gitignore').split('\n')) {
      const regla = linea.trim();
      if (!regla || regla.startsWith('#')) continue;
      const cuerpo = regla.startsWith('!') ? regla.slice(1) : regla;
      if (!cuerpo.startsWith('/')) sinAnclar.push(regla);
    }
    assert.deepEqual(sinAnclar, ['.DS_Store'], 'hay reglas sin anclar además de la de .DS_Store, que es global a propósito');
  });

  test('Estrenar la app no ha tocado ni un fichero de archive/', () => {
    const commit = spawnSync('git', ['log', '--format=%H', '-1', '--grep', 'feat(SPEC-020)', '--fixed-strings'], {
      cwd: RAIZ_REPO,
      encoding: 'utf8',
    }).stdout.trim();
    assert.match(commit, /^[0-9a-f]{40}$/, 'no se encuentra el commit de la app');

    const tocados = spawnSync('git', ['show', '--name-only', '--format=', commit, '--', 'archive/'], {
      cwd: RAIZ_REPO,
      encoding: 'utf8',
    }).stdout.trim();
    assert.equal(tocados, '', `estrenar la app ha tocado archive/:\n${tocados}`);

    const sucios = spawnSync('git', ['status', '--porcelain', '--', 'archive/'], { cwd: RAIZ_REPO, encoding: 'utf8' }).stdout.trim();
    assert.equal(sucios, '', `hay cambios sin commitear en archive/:\n${sucios}`);
  });
});

// ── El núcleo va dentro de la app ───────────────────────────────────────────────

describe('El núcleo va dentro de la app', () => {
  test('El identificador de aplicación es com.walkingadventure.app en las dos plataformas', () => {
    assert.equal(APP_JSON.expo.ios.bundleIdentifier, 'com.walkingadventure.app');
    assert.equal(APP_JSON.expo.android.package, 'com.walkingadventure.app');
    // El mismo que declaran los flujos de Maestro: si divergen, el flujo lanza otra app.
    for (const flujo of ficherosDe(join(RAIZ_REPO, 'test', 'app'), (n) => /\.ya?ml$/.test(n))) {
      assert.match(fuente(flujo), /^appId: com\.walkingadventure\.app$/m, `${flujo}: no lanza la app de este proyecto`);
    }
  });

  test('El título que sortea la app coincide con el que produce el mismo paquete en Node', () => {
    // Es la mitad de dispositivo del escenario «No se usa ninguna fuente de azar ni
    // de tiempo del sistema»: el mismo paquete, la misma semilla, el mismo
    // resultado dentro del móvil. Aquí se afirma la referencia de Node y que la app
    // la calcula igual; que el móvil la pinte lo comprueba test/app/andamiaje.yaml,
    // y por eso el literal de ese flujo tiene que ser este y no otro.
    const esperado = tituloEnNode();
    assert.equal(esperado, 'Reinos de Vaeloria');
    assert.equal(localeFor(42.4, -8.81), 'gl');

    const flujo = fuente('test/app/andamiaje.yaml');
    assert.ok(flujo.includes(`«${esperado}»`), `el flujo de Maestro no espera «${esperado}»: la app y Node han divergido`);
    assert.ok(flujo.includes(`semilla ${SEMILLA} · idioma gl`), 'el flujo no comprueba la semilla y el idioma que muestra la pantalla');

    // Y la app lo sortea llamando al paquete, sin copiar nada del generador.
    const andamiaje = fuente('app/nucleo/andamiaje.js');
    assert.ok(andamiaje.includes(`SEMILLA_DE_ANDAMIAJE = '${SEMILLA}'`), 'la app no usa la semilla de andamiaje literal de la spec');
    assert.match(andamiaje, /namesFor\(idiomaDeAndamiaje\(semilla\)\)/);
    assert.match(andamiaje, /worldTitle\(makeRng\(semilla \+ SUFIJOS_DE_FASE\.titulo\)\)/);
    assert.match(andamiaje, /localeFor\(lat, lon\)/, 'el idioma tiene que salir de localeFor, no de un literal de pantalla');
    assert.doesNotMatch(andamiaje, new RegExp(esperado), 'el título está escrito a mano en la app en vez de sortearse');
  });

  test('Dos sorteos con la misma semilla dan el mismo título', () => {
    assert.equal(tituloEnNode(), tituloEnNode());
    // Y una semilla distinta da otro mundo, que es lo que hace que lo de arriba
    // signifique algo.
    assert.notEqual(tituloEnNode(), tituloEnNode('42.40,-8.81#2'));
  });

  test('Los imports con los que app/ consume el generador citan el paquete por su nombre', () => {
    // Es el cierre del pendiente que SPEC-002 dejó anotado para esta fila. La misma
    // afirmación vive en paquete.test.mjs desde el lado del paquete; aquí se mira
    // desde el lado de la app, que es de donde tiene que salir el nombre.
    let vistos = 0;
    for (const fichero of modulosDeLaApp()) {
      for (const m of fuente(fichero).matchAll(/(?:^|\n)\s*(?:import|export)[^\n]*?from\s+['"]([^'"]+)['"]/g)) {
        const ruta = m[1];
        const relativo = ruta.startsWith('.') || ruta.startsWith('/');
        if (!relativo && ruta.includes('nucleo')) {
          vistos += 1;
          assert.match(ruta, /^@walkingadventure\/nucleo\//, `${fichero}: alcanza el paquete por "${ruta}" y no por su nombre`);
        }
        // Y ninguna ruta relativa sale de app/: la app no alcanza el paquete
        // saltando directorios, que es lo que el espacio de trabajo viene a evitar.
        assert.doesNotMatch(ruta, /\.\.\/\.\.\//, `${fichero}: importa "${ruta}", una ruta relativa que sale de app/`);
      }
    }
    assert.ok(vistos > 0, 'ningún módulo de app/ consume el paquete');
    assert.equal(APP_PAQUETE.dependencies['@walkingadventure/nucleo'], '*', 'el paquete no está declarado como dependencia del espacio de trabajo');
  });

  test('El empaquetador tiene declarado lo que hace resoluble el paquete por su nombre', () => {
    // Las dos trampas que la spec nombra: sin carpeta vigilada, un cambio en el
    // núcleo no recarga; sin resolución por exportaciones, las subrutas del paquete
    // fallan con un error que parece de fichero inexistente y no lo es.
    const metro = fuente('app/metro.config.js');
    assert.match(metro, /watchFolders/, 'Metro no vigila el paquete: los cambios del núcleo no recargarían');
    assert.match(metro, /nodeModulesPaths/, 'Metro no busca en los dos node_modules del espacio de trabajo');
    assert.match(metro, /unstable_enablePackageExports\s*=\s*true/, 'sin resolución por exportaciones las subrutas del paquete fallan');
    const nucleoJson = JSON.parse(fuente('packages/nucleo/package.json'));
    for (const subruta of ['./core/*', './names/*', './world/*']) {
      assert.ok(nucleoJson.exports[subruta], `el paquete no exporta ${subruta}`);
    }
  });

  test('El arranque de la app no abre ninguna conexión de red', () => {
    // La app no consume datos reales hasta la fila 26: no hay capa de datos, y por
    // tanto no hay ninguna puerta de red que se pueda abrir al arrancar.
    for (const fichero of modulosDeLaApp()) {
      const texto = fuente(fichero);
      for (const [nombre, patron] of [['fetch', /\bfetch\s*\(/], ['XMLHttpRequest', /\bXMLHttpRequest\b/], ['WebSocket', /\bWebSocket\b/], ['axios', /\baxios\b/]]) {
        assert.equal(patron.test(texto), false, `${fichero}: abre la puerta de red "${nombre}"`);
      }
    }
  });

  test('Ningún módulo de app/ duplica lógica que ya vive en el paquete compartido', () => {
    // Una copia del generador dentro de la app es la manera de que el móvil y Node
    // dejen de dar el mismo mundo sin que nadie lo note.
    const duplicables = [/function\s+worldTitle\b/, /function\s+makeRng\b/, /function\s+localeFor\b/, /function\s+buildWorld\b/, /mulberry32/];
    for (const fichero of modulosDeLaApp()) {
      const texto = fuente(fichero);
      for (const patron of duplicables) {
        assert.equal(patron.test(texto), false, `${fichero}: reimplementa algo del paquete (${patron})`);
      }
    }
    for (const area of ['core', 'world', 'names', 'quests', 'partida']) {
      assert.equal(hay(`app/${area}`), false, `app/${area}/ es una copia del paquete`);
    }
  });

  test('La frontera del núcleo sigue intacta con la app dentro del repositorio', () => {
    const r = spawnSync(process.execPath, [join(RAIZ_REPO, 'scripts', 'comprueba-nucleo.mjs')], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `la comprobación de la frontera ha fallado:\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /^VEREDICTO: intacta/m);

    // Y la frontera se comprueba en las dos direcciones: el paquete no importa de
    // app/ (paquete.test.mjs) y la app no mete plataforma en el paquete.
    const nucleoJson = JSON.parse(fuente('packages/nucleo/package.json'));
    for (const campo of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      assert.deepEqual(nucleoJson[campo] ?? {}, {}, `el paquete declara ${campo}: deja de tener cero dependencias`);
    }
  });

  test('Estrenar la app no añade ninguna comprobación de infraestructura saltada al report', () => {
    // La sección 3 del report se alimenta de dos veredictos, y los dos tienen que
    // decir que comprobaron algo. Un «no se pudo validar» ahí no tiñe de rojo, y
    // por eso es justo el sitio donde una comprobación nueva se puede quedar
    // saltada para siempre sin que nadie lo note.
    const frontera = spawnSync(process.execPath, [join(RAIZ_REPO, 'scripts', 'comprueba-nucleo.mjs')], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(frontera.status, 0);
    const veredictoFrontera = frontera.stdout.split('\n').find((l) => l.startsWith('VEREDICTO: '));
    assert.ok(veredictoFrontera, 'la comprobación de la frontera no escribió su veredicto');
    assert.doesNotMatch(veredictoFrontera, /sin-paquete|no-comprobada/, 'la frontera se registraría como comprobación saltada');

    const mapa = spawnSync(process.execPath, [join(RAIZ_REPO, 'scripts', 'valida-spec-test-map.mjs')], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(mapa.status, 0, `el mapa de cobertura no valida:\n${mapa.stdout}`);
    const veredictoMapa = mapa.stdout.split('\n').find((l) => l.startsWith('VEREDICTO: '));
    assert.ok(veredictoMapa, 'el validador del mapa no escribió su veredicto');
    assert.doesNotMatch(veredictoMapa, /sin-mapa|no-validado/, 'el mapa se registraría como comprobación saltada');
  });

  test('La suite de núcleo y las herramientas headless arrancan sin instalar nada', () => {
    // El criterio duro de esta fila. Se afirma como propiedad y no ejecutando `npm
    // ci` en un árbol limpio: lo que hay que impedir es que alguien meta una
    // dependencia en el camino, y eso se ve en los imports. El día que un módulo
    // alcanzable desde `test/headless.mjs` o desde `test/nucleo/` cite un
    // especificador que haya que resolver, esto se pone rojo.
    const alcanzables = [
      'test/headless.mjs',
      ...ficherosDe(join(RAIZ_REPO, 'test', 'nucleo'), (n) => /\.mjs$/.test(n)),
      ...ficherosDe(join(RAIZ_REPO, 'test', 'dobles'), (n) => /\.mjs$/.test(n)),
      ...ficherosDe(join(RAIZ_REPO, 'packages', 'nucleo'), (n) => /\.(js|mjs)$/.test(n)),
    ];
    const externos = [];
    for (const fichero of alcanzables) {
      const texto = fuente(fichero);
      const rutas = [];
      for (const m of texto.matchAll(/(?:^|\n)\s*(?:import|export)[^\n]*?from\s+['"]([^'"]+)['"]/g)) rutas.push(m[1]);
      for (const m of texto.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) rutas.push(m[1]);
      for (const ruta of rutas) {
        const interno = ruta.startsWith('.') || ruta.startsWith('/') || ruta.startsWith('node:');
        if (!interno) externos.push(`${fichero} → ${ruta}`);
      }
    }
    assert.deepEqual(externos, [], 'la red de seguridad del determinismo ha pasado a depender de una instalación');

    // Y lo empírico que sí se puede afirmar aquí: headless arranca y termina verde.
    const r = spawnSync(process.execPath, [join(RAIZ_REPO, 'test', 'headless.mjs')], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `headless ha fallado:\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /Todo OK/);
  });
});

// ── Una sola base para iOS y Android ────────────────────────────────────────────

describe('Una sola base para iOS y Android', () => {
  test('Fuera de app/plataforma/ no hay ninguna bifurcación por sistema operativo', () => {
    const bifurca = [/Platform\.OS/, /Platform\.select/, /\bisIOS\b/, /\bisAndroid\b/];
    for (const fichero of modulosDeLaApp()) {
      if (fichero.startsWith('app/plataforma/')) continue;
      const texto = fuente(fichero);
      for (const patron of bifurca) {
        assert.equal(patron.test(texto), false, `${fichero}: bifurca por sistema operativo fuera de app/plataforma/`);
      }
      assert.doesNotMatch(fichero, /\.(ios|android|native|web)\.[a-z]+$/, `${fichero}: fichero con sufijo de plataforma fuera de app/plataforma/`);
    }
  });

  test('Cada fichero con sufijo de plataforma tiene su pareja en la otra', () => {
    const conSufijo = modulosDeLaApp().filter((f) => /\.(ios|android)\.js$/.test(f));
    assert.ok(conSufijo.length > 0, 'no hay ningún fichero por plataforma: la comprobación de RNF-COM-001 sería vacía');
    for (const fichero of conSufijo) {
      const pareja = fichero.replace(/\.(ios|android)\.js$/, (m) => (m === '.ios.js' ? '.android.js' : '.ios.js'));
      assert.equal(hay(pareja), true, `${fichero} no tiene pareja: ${pareja}`);
    }
  });

  test('Las dos implementaciones de una pareja exportan exactamente los mismos nombres', () => {
    const exportados = (fichero) => {
      const out = [];
      for (const m of fuente(fichero).matchAll(/(?:^|\n)export\s+(?:const|let|function|async function|class)\s+([A-Za-z_$][\w$]*)/g)) out.push(m[1]);
      return out.sort();
    };
    for (const fichero of modulosDeLaApp().filter((f) => /\.ios\.js$/.test(f))) {
      const pareja = fichero.replace(/\.ios\.js$/, '.android.js');
      assert.deepEqual(exportados(fichero), exportados(pareja), `${fichero} y ${pareja} no exportan lo mismo`);
    }
  });

  test('El respaldo tiene una implementación por plataforma y las dos responden a la misma sonda', () => {
    // La partición es real y no decorativa: en iOS entrar en la copia del sistema
    // depende del directorio, y en Android de lo que declara el manifiesto. Un
    // fichero de plataforma vacío haría vacía también la comprobación de RNF-COM-001.
    const ios = fuente('app/plataforma/respaldo.ios.js');
    const android = fuente('app/plataforma/respaldo.android.js');
    for (const texto of [ios, android]) {
      assert.match(texto, /nombre:\s*'respaldo'/);
      assert.match(texto, /async sonda\(\)/);
      assert.match(texto, /export const MECANISMO/);
    }
    assert.match(ios, /iCloud|documentos/i, 'la implementación de iOS no nombra su mecanismo real');
    assert.match(android, /allowBackup/, 'la implementación de Android no nombra su mecanismo real');
    assert.notEqual(
      ios.match(/export const MECANISMO = '([^']+)'/)[1],
      android.match(/export const MECANISMO = '([^']+)'/)[1],
      'las dos plataformas declaran el mismo mecanismo: la partición sería decorativa',
    );
    // Y android.allowBackup está declarado de verdad en el manifiesto de Expo.
    assert.equal(APP_JSON.expo.android.allowBackup, true);
  });

  test('El módulo de respaldo se importa sin extensión, que es como Metro elige la plataforma', () => {
    // Con `./respaldo.js` la selección por plataforma no ocurre y las dos
    // implementaciones sobran. Es la única importación sin extensión de la app y va
    // documentada como tal.
    const indice = fuente('app/plataforma/index.js');
    assert.match(indice, /from '\.\/respaldo'/);
    assert.doesNotMatch(indice, /from '\.\/respaldo\.js'/);
    assert.match(indice, /MODULOS_DE_PLATAFORMA = \[salud, haptico, notificaciones, respaldo\]/);
  });
});

// ── La pantalla de andamiaje ────────────────────────────────────────────────────

describe('La pantalla de andamiaje', () => {
  const PANTALLA = () => fuente('app/pantallas/andamiaje.js');

  test('La pantalla declara todos los identificadores que la spec nombra', () => {
    const declarados = [
      'pantalla-andamiaje',
      'titulo-de-mundo',
      'nucleo-error',
      'capacidades',
      'capacidades-vacio',
      'gancho-no-reconocido',
    ];
    const texto = PANTALLA();
    for (const id of declarados) {
      assert.ok(texto.includes(`testID="${id}"`), `la pantalla no declara el identificador "${id}"`);
    }
    // Las cuatro filas se declaran por plantilla, una por capacidad.
    assert.match(texto, /testID=\{`capacidad-\$\{c\.nombre\}`\}/, 'las filas de capacidad no llevan su identificador');
  });

  test('Los flujos de Maestro localizan la pantalla solo por los identificadores declarados', () => {
    // Si un flujo se agarra a un identificador que la spec no declara, o el flujo
    // inventa un selector frágil o la spec tiene un hueco. Las dos cosas hay que verlas.
    //
    // Se recorren **los flujos de esta fila** y no todo `test/app/`: cada spec declara
    // sus identificadores, y una lista de aquí que tuviera que crecer con cada fila
    // nueva dejaría de decir nada de SPEC-020. Los flujos de las demás filas los
    // comprueba la prueba de su propia fila.
    const declarados = new Set([
      'pantalla-andamiaje', 'titulo-de-mundo', 'nucleo-error', 'capacidades', 'capacidades-vacio',
      'gancho-no-reconocido', 'capacidad-salud', 'capacidad-haptico', 'capacidad-notificaciones', 'capacidad-respaldo',
    ]);
    assert.equal(FLUJOS_DE_ESTA_FILA.length, 2, 'faltan los flujos de @app de esta fila');
    for (const flujo of FLUJOS_DE_ESTA_FILA) {
      for (const m of fuente(flujo).matchAll(/^\s*id:\s*'([^']+)'/gm)) {
        assert.equal(declarados.has(m[1]), true, `${flujo}: usa el identificador "${m[1]}", que la spec no declara`);
      }
    }
  });

  test('La pantalla no tiene ningún control tocable', () => {
    const texto = PANTALLA();
    for (const control of [/onPress/, /<Button\b/, /<Pressable\b/, /TouchableOpacity/, /TouchableHighlight/, /<Switch\b/, /<TextInput\b/]) {
      assert.equal(control.test(texto), false, `la pantalla tiene un control tocable (${control})`);
    }
    // Y el flujo lo afirma también desde el dispositivo, que es donde importa.
    assert.match(fuente('test/app/andamiaje.yaml'), /assertNotVisible/);
  });

  test('La pantalla no enseña ninguna cifra de distancia, tiempo, ritmo, pasos ni progreso', () => {
    // Los literales de la pantalla no pueden traer cifras de esfuerzo: la única
    // cifra admitida es la coordenada de la semilla, que es un dato de la partida.
    const texto = PANTALLA();
    const literales = [...texto.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter(Boolean);
    for (const literal of literales) {
      assert.doesNotMatch(literal, /\d+\s*(km|m\b|min|pasos|%)/i, `la pantalla enseña una cifra de esfuerzo: "${literal}"`);
    }
    for (const prohibido of [/distancia/i, /ritmo/i, /progreso/i, /kilómetro/i]) {
      assert.equal(prohibido.test(texto), false, `la pantalla habla de esfuerzo (${prohibido})`);
    }
  });

  test('La pantalla dice que es andamiaje y que desaparece cuando llegue el arranque de verdad', () => {
    const texto = PANTALLA();
    assert.match(texto, /Andamiaje\. Esto no es el juego/);
    assert.match(texto, /desaparece cuando llegue el arranque de verdad/);
    // Habla como aplicación de principio a fin; la única voz de mundo es el título.
    assert.match(texto, /fontFamily: 'serif'/, 'el título sorteado tiene que ir en serif: es voz del mundo');
    assert.match(texto, /tituloDeMundo: \{ fontFamily: 'serif'/);
  });

  test('Cada fila de capacidad dice el nombre, el estado y, si no está disponible, el motivo', () => {
    const texto = PANTALLA();
    assert.match(texto, /ETIQUETAS\[c\.nombre\]/, 'la fila no muestra el nombre en castellano');
    assert.match(texto, /estadoLegible\(c\)/, 'la fila no muestra el estado');
    assert.match(texto, /c\.motivo \? <Text[^>]*>\{c\.motivo\}<\/Text> : null/, 'la fila no muestra el motivo cuando no está disponible');
  });

  test('Cuando el núcleo falla al sortear, la pantalla lo dice en lugar de quedarse en blanco', () => {
    const texto = PANTALLA();
    assert.match(texto, /try \{\s*titulo = tituloDeAndamiaje\(\);\s*\} catch/, 'el fallo del núcleo no está recogido');
    assert.match(texto, /El núcleo no respondió/);
    assert.match(texto, /\{errorDelNucleo\}/, 'no se enseña el mensaje del error');
    // Y la pantalla se pinta entera igual: la lista de capacidades no cuelga del título.
    const trasElError = texto.split('nucleo-error')[1];
    assert.match(trasElError, /testID="capacidades"/, 'la lista de capacidades depende de que el núcleo respondiera');
  });

  test('La pantalla de andamiaje no entra en docs/flujo.md y el diagrama sigue en verde', () => {
    // No es ninguna de las cuarenta pantallas dibujadas: es una pantalla de
    // herramienta, y la fila 27 la sustituye por la primera del onboarding.
    assert.doesNotMatch(fuente('docs/flujo.md'), /andamiaje/i, 'la pantalla de herramienta se ha colado en el diagrama de las cuarenta');
    const r = spawnSync(process.execPath, [join(RAIZ_REPO, 'scripts', 'verifica-flujo.mjs')], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `verifica-flujo ha fallado:\n${r.stdout}${r.stderr}`);
  });

  test('La app monta la pantalla sin enrutador y con los módulos inyectados', () => {
    const app = fuente('app/App.js');
    assert.match(app, /<PantallaAndamiaje/, 'la raíz no monta la pantalla de andamiaje');
    assert.match(app, /modulos=\{MODULOS_DE_PLATAFORMA\}/, 'los módulos de plataforma no se inyectan');
    for (const enrutador of [/NavigationContainer/, /createStackNavigator/, /expo-router/]) {
      assert.equal(enrutador.test(app), false, `la app monta un enrutador (${enrutador}), y esta fila no lo lleva`);
    }
  });
});

// ── El primer flujo de nivel @app ───────────────────────────────────────────────

describe('El primer flujo de nivel @app', () => {
  test('Hay un comando único y documentado que produce una compilación de desarrollo', () => {
    assert.equal(APP_PAQUETE.scripts.ios, 'expo run:ios');
    assert.equal(APP_PAQUETE.scripts.android, 'expo run:android');
    assert.match(fuente('README.md'), /expo run:ios/, 'el README no documenta cómo producir la compilación de desarrollo');
  });

  test('Los flujos de Maestro de esta fila existen y son los dos que la spec pide', () => {
    // Los dos de SPEC-020 tienen que estar. Que en `test/app/` haya además los de otras
    // filas no es asunto de esta prueba: lo era cuando esta fila era la única con
    // flujos, y comparar el directorio entero convertía cada fila nueva en un rojo aquí.
    const flujos = ficherosDe(join(RAIZ_REPO, 'test', 'app'), (n) => /\.ya?ml$/.test(n));
    for (const flujo of FLUJOS_DE_ESTA_FILA) {
      assert.ok(flujos.includes(flujo), `falta el flujo de @app "${flujo}"`);
    }
    // El del gancho es el que hace que «la app funciona aunque falten» se pueda
    // poner rojo desde el dispositivo, y por eso fuerza las tres degradables a la vez.
    const gancho = fuente('test/app/gancho-capacidad-ausente.yaml');
    assert.match(gancho, /openLink: 'walkingadventure:\/\/andamiaje\?ausentes=haptico,notificaciones,respaldo'/);
    assert.match(gancho, /openLink: 'walkingadventure:\/\/andamiaje\?ausentes=telepatia'/);
    assert.match(gancho, /launchApp:\n\s+clearState: false/, 'el flujo no comprueba que el gancho no persiste nada');
  });

  test('El esquema del enlace profundo que usan los flujos es el que declara la app', () => {
    assert.equal(APP_JSON.expo.scheme, 'walkingadventure');
    for (const flujo of ficherosDe(join(RAIZ_REPO, 'test', 'app'), (n) => /\.ya?ml$/.test(n))) {
      for (const m of fuente(flujo).matchAll(/openLink:\s*'([a-z]+):\/\//g)) {
        assert.equal(m[1], APP_JSON.expo.scheme, `${flujo}: abre un esquema que la app no declara`);
      }
    }
  });
});

// ── Qué pasa con el prototipo web ───────────────────────────────────────────────

describe('El prototipo web sobrevive a la mudanza', () => {
  test('El servidor sirve los estáticos de prototipo/ y conserva su proxy', () => {
    const servidor = fuente('server.mjs');
    assert.match(servidor, /new URL\('\.\/prototipo\/', import\.meta\.url\)/, 'el servidor sigue sirviendo desde app/');
    assert.match(servidor, /\/api\/overpass/, 'el proxy de Overpass tiene que seguir donde estaba');
  });

  test('casting-report toma el transporte de prototipo/ y todo lo demás del paquete', () => {
    const texto = fuente('test/casting-report.mjs');
    assert.match(texto, /from '\.\.\/prototipo\/js\/data\/overpass\.js'|import\('\.\.\/prototipo\/js\/data\/overpass\.js'\)/);
    for (const m of texto.matchAll(/import\('(\.\.\/[^']+)'\)/g)) {
      const ruta = m[1];
      const esperado = ruta.includes('overpass') ? '../prototipo/' : '../packages/nucleo/';
      assert.ok(ruta.startsWith(esperado), `casting-report importa "${ruta}", que no viene de ${esperado}`);
    }
  });

  test('Los ganchos de depuración del prototipo siguen siendo los mismos', () => {
    const main = fuente('prototipo/js/main.js');
    for (const gancho of ['go', 'preset', 'demo', 'style', 'world']) {
      assert.match(main, new RegExp(`\\b${gancho}\\b`), `el prototipo ha perdido el gancho __wa.${gancho}`);
    }
    assert.match(main, /__wa/, 'el prototipo ha perdido el objeto de depuración');
  });

  test('CLAUDE.md y README.md ya no dicen que app/ es el prototipo web', () => {
    // Una guía que miente sobre dónde está el prototipo cuesta más que una línea de
    // diff: es lo primero que lee el siguiente agente. Se comprueba por las rutas
    // que la mudanza dejó falsas, no por la prosa, que puede decirse de mil maneras.
    for (const doc of ['CLAUDE.md', 'README.md']) {
      const texto = fuente(doc);
      for (const ruta of ['app/js/render', 'app/js/data', 'app/js/main.js', 'app/index.html', 'app/style.css']) {
        assert.equal(texto.includes(ruta), false, `${doc}: sigue citando ${ruta}, que ya no existe`);
      }
      for (const ruta of ['prototipo/js/render', 'prototipo/js/main.js']) {
        assert.equal(texto.includes(ruta), true, `${doc}: no dice dónde vive ahora ${ruta}`);
      }
      assert.match(texto, /`app\/`[^\n]*(Expo|React Native)/, `${doc}: no dice que app/ es la app`);
    }
    // Y el árbol de la app está descrito, que es lo que la hace navegable.
    assert.match(fuente('CLAUDE.md'), /app\/plataforma\//);
  });
});
