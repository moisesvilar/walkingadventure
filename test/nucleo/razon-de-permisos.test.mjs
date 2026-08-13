// SPEC-046 y SPEC-046-iter-1 · «¿Por qué me pides esto?»: la entrada del sistema, el plugin
//            que la traduce y el enlace que aparece, que es superficie pública de la app.
//
// El sistema puede preguntar por la razón de los permisos de salud desde fuera de la app, y
// esta fila decidió que esa pregunta aterriza en A6P6 —donde la fila de contar los pasos y su
// línea de aviso ya dicen exactamente eso—. La iteración 1 cambió **por dónde viaja la orden**
// y no a dónde llega: el intento no alcanza JavaScript por sí solo, así que un plugin propio
// lo reescribe a `walkingadventure://razon-de-permisos` y de ahí lo enruta la tubería de
// enlaces que ya existía.
//
// ## Qué se puede afirmar aquí y qué no, dicho para que nadie lo confunda con cobertura
//
// **Se ejecuta de verdad**: `app/plataforma/razon-de-permisos.js`, que no importa nada.
// **Se lee**: el plugin, que es CommonJS de Expo y **se verifica por su artefacto** —el
// `MainActivity.kt` generado y el `uses-sdk` del manifiesto fusionado—, no por su intención.
// Los dos artefactos viven fuera del repo (`app/android/` está gitignorado) y solo existen
// tras el prebuild, así que los casos que los miran **solo se registran cuando están**: un
// caso que pasa sin haber mirado nada es lo que la guarda del manifiesto existe para impedir,
// y aquí se sigue la misma doctrina.
//
// **No se puede afirmar aquí**: que el intento del sistema llegue de verdad. Eso es de
// `test/app/` y se midió en `wa-pixel` — con la salvedad, fichada por la propia fila, de que
// la puerta del `activity-alias` **no se pudo disparar desde `adb`**: exige
// `START_VIEW_PERMISSION_USAGE`, que es permiso de sistema. Lo que sí se verificó de esa
// puerta es que está registrada y a dónde apunta, y eso se afirma abajo sobre el manifiesto.
//
// Los casos con nombre de escenario son los de `docs/testing.md`. El resto va marcado como
// hueco de batería en `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { ANFITRION_DE_LA_RAZON, ENLACE_DE_LA_RAZON, esRazonDePermisos } from '../../app/plataforma/razon-de-permisos.js';
import { leeGancho, leeMetrosDeFondo } from '../../app/plataforma/gancho.js';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { fuente } from './mundo-de-prueba.mjs';

const EN_DESARROLLO = true;
const PLUGIN = fuente('app/plugins/lo-que-exige-health-connect.js');

/** El `MainActivity.kt` que deja el prebuild, si lo hay. Es el artefacto del plugin. */
function mainActivityGenerado() {
  const base = join(RAIZ_REPO, 'app', 'android', 'app', 'src', 'main', 'java');
  const pila = [base];
  while (pila.length) {
    const dir = pila.pop();
    let entradas;
    try {
      entradas = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entradas) {
      if (e.isDirectory()) pila.push(join(dir, e.name));
      else if (e.name === 'MainActivity.kt') return readFileSync(join(dir, e.name), 'utf8');
    }
  }
  return null;
}

const KOTLIN = mainActivityGenerado();

// ── El enlace, que es lo único que llega a JavaScript ───────────────────────────

describe('El sistema puede preguntar por qué se piden los permisos de salud', () => {
  test('El intento de la razón se traduce a un enlace y no decide nada más', () => {
    // El enlace se reconoce, y solo él. Lo que **no** hace este módulo es decidir a dónde
    // lleva: eso es de `App.js`, que es donde las guardas de este repo lo pueden ver.
    assert.equal(esRazonDePermisos(ENLACE_DE_LA_RAZON), true);
    assert.equal(esRazonDePermisos(`${ENLACE_DE_LA_RAZON}/`), true, 'una barra final deja de reconocerse, y el sistema no promete no ponerla');
    for (const otro of ['walkingadventure://andamiaje', 'walkingadventure://andamiaje?metrosDeFondo=6000', 'walkingadventure://razon-de-permisos-de-otra-cosa', '', null, undefined, 42]) {
      assert.equal(esRazonDePermisos(otro), false, `"${otro}" se reconoce como la razón de permisos y no lo es`);
    }

    // Y **el mismo literal en los dos sitios**, que es lo único que ata el plugin —CommonJS,
    // cargado por Expo— con el módulo de la app —ESM—. Sin este cruce, cambiar uno dejaría al
    // otro reconociendo un enlace que nadie dispara, y no se notaría hasta el aparato.
    assert.match(PLUGIN, new RegExp(`ENLACE_DE_LA_RAZON = '${ENLACE_DE_LA_RAZON}'`), 'el plugin traduce a un enlace distinto del que la app reconoce');
    assert.equal(ENLACE_DE_LA_RAZON, `walkingadventure://${ANFITRION_DE_LA_RAZON}`);

    // El Kotlin **traduce y no decide**: reescribe esas dos acciones y nada más, y ninguna
    // condición del juego vive ahí. Se afirma por ausencia sobre el texto que el plugin
    // inyecta, que es lo que acaba dentro del aparato.
    const traduccion = PLUGIN.slice(PLUGIN.indexOf('const TRADUCCION'), PLUGIN.indexOf('function conElMinimoDeAndroid'));
    for (const logica of [/partida/i, /ajustes/i, /A6P6/, /portada/i, /SharedPreferences/, /getSharedPreferences/]) {
      assert.doesNotMatch(traduccion.replace(/\/\/[^\n]*/g, ''), logica, `el Kotlin inyectado decide algo del juego (${logica}), y a dónde ir se decide en JavaScript`);
    }
    // Las dos acciones, que son la misma pregunta vista desde dos versiones de Android.
    assert.match(PLUGIN, /androidx\.health\.ACTION_SHOW_PERMISSIONS_RATIONALE/);
    assert.match(PLUGIN, /android\.intent\.action\.VIEW_PERMISSION_USAGE/);
    // Y las dos entradas, porque con `singleTask` el intento llega por `onCreate` con la app
    // muerta y por `onNewIntent` con la app viva. Traducir solo una haría que la razón de
    // permisos funcionara o no según algo que quien juega no puede ver ni explicar.
    assert.match(PLUGIN, /onNewIntent/, 'el plugin no traduce el intento que llega con la app viva');
    assert.match(PLUGIN, /super\.onCreate\(null\)/, 'el plugin no engancha la traducción en el arranque en frío');
  });

  test('El enlace de la razón de permisos no escribe nada', () => {
    // Navega y solo navega: no acredita metros, no toca la reserva y no cambia ningún ajuste.
    // La manera de afirmarlo sin dispositivo es que el módulo que lo reconoce **no exporta
    // nada más** y que el enlace no entra por los dos ganchos que sí escriben.
    const exportados = [...fuente('app/plataforma/razon-de-permisos.js').matchAll(/(?:^|\n)export\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]).sort();
    assert.deepEqual(exportados, ['ANFITRION_DE_LA_RAZON', 'ENLACE_DE_LA_RAZON', 'esRazonDePermisos']);
    const codigo = fuente('app/plataforma/razon-de-permisos.js').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    for (const escribe of [/escribe\(/, /almacen/, /cambiaAjuste/, /reserva/]) {
      assert.doesNotMatch(codigo, escribe, `el módulo de la razón de permisos escribe algo (${escribe}), y lo único que hace es navegar`);
    }

    // Y no lo lee ninguno de los dos ganchos de andamiaje: **son cosas distintas y por eso
    // viven en ficheros distintos**. El gancho es inerte en producción; esta entrada tiene que
    // funcionar precisamente en producción, que es donde el sistema pregunta.
    assert.deepEqual(leeGancho(ENLACE_DE_LA_RAZON, EN_DESARROLLO), { ausentes: [], noReconocidos: [] });
    assert.deepEqual(leeMetrosDeFondo(ENLACE_DE_LA_RAZON, EN_DESARROLLO), { metros: null, motivo: null });
    assert.equal(esRazonDePermisos('walkingadventure://andamiaje?ausentes=salud'), false);

    // La cabecera del módulo dice esa diferencia con su motivo. No es documentación de
    // cortesía: es lo único que impide que el día de mañana alguien lo mude a `gancho.js` y
    // se lleve por delante la regla de inertidad, que es lo que hace del gancho una puerta
    // que no es trasera.
    const cabecera = fuente('app/plataforma/razon-de-permisos.js').slice(0, fuente('app/plataforma/razon-de-permisos.js').indexOf('export const'));
    assert.match(cabecera, /inerte/, 'el módulo de la razón de permisos no declara en qué se diferencia del gancho de andamiaje');
    assert.match(cabecera, /producción/, 'no dice que esta entrada sí funciona en producción');
  });

  test('La guarda de partida de la razón de permisos vive en JavaScript', () => {
    // Hueco de batería, y entra con la fila 46 en su segunda vuelta: `test/app/zurron.yaml`
    // recorre esta guarda en el aparato, pero desde que ese flujo es de límite declarado su
    // verde ya no es la única red — así que lo que el aparato afirma se afirma también aquí,
    // que es donde el rojo es posible sin emulador.
    //
    // Lo que se mide es que la decisión está **en `App.js` y no en el Kotlin**: se espera a
    // que la apertura resuelva —decidir antes sería decidir a cara o cruz—, con partida se va
    // a los ajustes, y sin partida no se monta nada y se queda el arranque de siempre.
    const raiz = fuente('app/App.js');
    const efecto = raiz.slice(raiz.indexOf('if (!razonDePermisos'), raiz.indexOf('if (!razonDePermisos') + 400);
    assert.ok(efecto.startsWith('if (!razonDePermisos'), 'App.js no tiene ningún efecto que atienda la razón de permisos');
    assert.match(efecto, /APERTURAS\.ABRIENDO/, 'la razón de permisos se resuelve sin esperar a que la apertura sepa si hay partida');
    assert.match(efecto, /if \(partida\) setConsulta\('ajustes'\)/, 'con partida abierta la razón de permisos no lleva a los ajustes');
    // Y sin partida **no se monta nada**: no hay rama que abra ninguna consulta sin ella.
    assert.doesNotMatch(efecto.replace(/if \(partida\) setConsulta\('ajustes'\);/, ''), /setConsulta\(/, 'hay un camino que monta una consulta sin partida abierta');
    // La guarda vive aquí y no en el lado nativo, que es lo que el Kotlin declara no hacer.
    assert.doesNotMatch(PLUGIN, /setConsulta|APERTURAS/, 'la guarda de partida se ha bajado al plugin, y ahí ninguna prueba de este repo la ve');
  });

  test('El plugin dice qué lo arrastra y cuánto cuesta', () => {
    // Hueco de batería: es una propiedad del fichero y no del juego. Va aquí porque es la
    // otra mitad de «se verifica por su artefacto»: el artefacto dice **qué** quedó puesto y
    // el plugin tiene que decir **por qué**, o el día que alguien lo baje no encontrará el
    // motivo en ninguna parte.
    assert.match(PLUGIN, /Health Connect/, 'el plugin no dice qué arrastra el suelo de aparatos');
    assert.match(PLUGIN, /Android 7\.0 y 7\.1/, 'el plugin no dice a qué aparatos deja fuera, que es el coste medido');
    assert.match(PLUGIN, /android\.minSdkVersion/, 'el plugin no escribe la propiedad con la que el proyecto de Expo fija el mínimo');
    assert.match(PLUGIN, /MINIMO_DE_ANDROID = '26'/, 'el suelo que el plugin escribe ya no es 26');
    // Y sin ninguna dependencia nueva: las dos palancas vienen dentro de `expo`.
    // Sobre el código y no sobre el texto: la cabecera nombra `expo-build-properties` para
    // decir que se descartó, y eso es una buena explicación y no un fallo.
    const codigo = PLUGIN.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    const requires = [...codigo.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
    assert.deepEqual(requires, ['expo/config-plugins'], `el plugin trae dependencias nuevas: ${requires.join(', ')}`);
    assert.doesNotMatch(codigo, /expo-build-properties/, 'ha vuelto `expo-build-properties`, que se descartó por nombre: era una segunda librería para escribir una línea');
  });
});

// ── El artefacto del plugin, solo si el prebuild lo ha dejado ───────────────────
//
// Mismo trato que la guarda del manifiesto: **no se envuelve en un `if` dentro del cuerpo**.
// Un caso que pasa sin haber mirado el `MainActivity.kt` generado sería exactamente la clase
// de verde que esta fila no puede permitirse, porque el parche vive fuera del repo y se
// regenera en cada `expo prebuild`. Si no está, este bloque no se registra y el recuento de la
// batería lo dice.

if (KOTLIN !== null) {
  describe('El parche del intento está en el MainActivity generado', () => {
    test('El parche del intento está en el MainActivity generado', () => {
      assert.match(KOTLIN, /SPEC-046/, 'el MainActivity generado no trae la marca del parche: el plugin no se ha aplicado');
      assert.match(KOTLIN, /traduceLaRazonDePermisos/, 'el MainActivity generado no trae la función que traduce el intento');
      assert.match(KOTLIN, new RegExp(ENLACE_DE_LA_RAZON.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'el MainActivity generado traduce a un enlace distinto del que la app reconoce');
      // Una sola vez: el parche es idempotente por su marca, y dos copias serían dos
      // reescrituras del mismo intento con el prebuild corrido dos veces.
      assert.equal(KOTLIN.split('traduceLaRazonDePermisos').length - 1, 3, 'el parche aparece un número de veces distinto del esperado: la declaración, la llamada del arranque en frío y la de la app viva');
      assert.match(KOTLIN, /override fun onNewIntent/, 'el MainActivity generado no atiende el intento que llega con la app viva');
    });
  });
}
