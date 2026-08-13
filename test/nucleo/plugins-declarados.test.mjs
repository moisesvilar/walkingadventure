// **La lista cerrada de `app/plugins/`**: cada plugin de configuración nativa nombrado a
// mano, con su cometido declarado en una frase, y rojo ante uno nuevo, uno cambiado de forma
// o uno retirado.
//
// ## Por qué existe
//
// Decidida por el dueño en `pipeline/decisiones-orquestador.md` §14e·3, y es el freno del
// único sitio de este repo donde se escribe código que **no corre en JavaScript**: un plugin
// de Expo reescribe el manifiesto de Android, el `Info.plist` y `MainActivity.kt`, y lo que
// escribe acaba dentro del binario. Ninguna guarda de este repo lo veía: `app.json` no dice
// lo que sale fusionado, y las pruebas de plataforma miran módulos de JavaScript.
//
// Los dos de hoy son la razón de la forma. `lo-que-exige-health-connect.js` es **el molde**
// (§14a): traduce un intento del sistema a un enlace profundo y **se aparta** —a dónde lleva
// ese enlace lo decide `app/App.js`, que es donde las guardas lo pueden ver—, y **falla a
// gritos** si la plantilla de Expo cambia en vez de aplicar su parche a ciegas. Ese es el
// listón, y esta guarda existe para que cualquiera que añada un tercero tenga que decir por
// escrito si lo cumple.
//
// ## Lo que esta guarda garantiza, y lo que no
//
// **«Traduce, no decide» sigue siendo revisión humana.** Esta guarda no lee Kotlin ni sabe
// distinguir una traducción de una decisión de producto: lo que garantiza es **la
// conversación** —que nadie meta, cambie o retire un plugin nativo sin que alguien tenga que
// venir aquí a nombrarlo y a escribir qué hace—, no la ausencia de lógica de producto en
// Kotlin. Eso lo sigue mirando una persona, y si algún día se automatiza será otra guarda.
//
// ## Las tres direcciones de rojo, como en `piezas-sin-consumidor` y `pantallas-huerfanas`
//
// - **Rojo 1** · un plugin **nuevo** que nadie ha nombrado. Es la dirección que obliga: no se
//   puede meter código que reescribe el proyecto nativo en silencio.
// - **Rojo 2** · un plugin de la lista que **ha cambiado de forma** — otro nombre de función,
//   otros `mods` de Expo, u otro cuerpo. Cambiar lo que se le hace al binario es un acto con
//   registro, y volver a nombrarlo aquí es el registro.
// - **Rojo 3** · un plugin de la lista que **ya no existe**. Retirar uno también es un acto
//   con registro y no una limpieza silenciosa.
//
// ## Dos decisiones de este fichero
//
// - **Los plugins se leen como texto y no se importan nunca.** Hacen `require('expo/config-
//   plugins')` desde CommonJS, así que importarlos ataría la batería de núcleo a
//   `node_modules` — y la red de seguridad del determinismo deja de serlo el día que necesite
//   una instalación. Aquí no se importa ni React Native, ni Expo, ni nada de `app/`.
// - **La huella ignora los comentarios.** Un comentario no es la forma: estos ficheros llevan
//   su porqué dentro y a veces media página, y una huella que se moviera al aclarar una frase
//   habría convertido la guarda en ruido a la tercera vez. Lo que se fija es el código.
//
// **Nada de esto tiene escenario en `docs/testing.md`**, y es coherente: la batería describe
// qué hace el juego, no qué le hace su compilación al proyecto nativo. Va como hueco de
// batería en el mapa.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';

const PLUGINS = 'app/plugins';
const APP_JSON = 'app/app.json';

/**
 * Los plugins de configuración nativa que esta app declara, **uno a uno y a mano**.
 *
 * `cometido` es la frase que dice qué hace, y se escribe aquí y no se deriva del fichero: una
 * descripción que se leyera sola pasaría con cualquier cosa. `exporta` es el nombre de la
 * función que Expo llama, `mods` son los ganchos de `expo/config-plugins` que usa —que es lo
 * que dice **qué parte del proyecto nativo toca**— y `huella` es el resumen de su código sin
 * comentarios.
 *
 * `nombraAlMenos` son las piezas que el cometido tiene que nombrar, y existe desde SPEC-052
 * por lo que pasó allí: el plugin pasó de neutralizar **un** receptor a neutralizar **dos**,
 * y el cometido se habría podido renombrar sin decirlo —la huella cambia igual— dejando una
 * frase que describe el plugin de la fila anterior. Con la lista delante, actualizar la
 * huella obliga a mirar si lo escrito sigue siendo verdad. Lo que no puede es sustituir a
 * quien lee el cambio: los dos campos los escribe la misma mano, igual que la huella.
 */
const LOS_PLUGINS = [
  {
    fichero: 'lo-que-exige-health-connect.js',
    exporta: 'loQueExigeHealthConnect',
    mods: ['withGradleProperties', 'withMainActivity'],
    huella: 'c20ce1b5fd379984',
    cometido: 'Sube el mínimo de Android a 26, que es lo que exige Health Connect, y traduce a un enlace profundo las dos acciones con las que el sistema pregunta por la razón de los permisos de salud, que sin traducir no llegan nunca a JavaScript.',
    nombraAlMenos: ['Health Connect', 'enlace profundo'],
  },
  {
    fichero: 'retira-permisos-prohibidos.js',
    exporta: 'retiraPermisosProhibidos',
    mods: ['withAndroidManifest', 'withInfoPlist'],
    huella: '1e093aec465233d0',
    cometido: 'Limpia del manifiesto fusionado y del Info.plist generado lo que esta app no declara y llega por las librerías: los dos permisos prohibidos de Android, los modos de fondo de iOS fuera de la lista blanca, las acciones de arranque de los dos receptores que las escuchaban — el receptor de tareas, que se queda sin ningún intent-filter, y el receptor de notificaciones, que conserva solo su acción de entrega — y, desde SPEC-053, las tres piezas de FCM, que se retiran enteras porque los dos servicios se descubren por el filtro MESSAGING_EVENT y cerrar solo uno deja al otro resolviendo en su lugar; y grita si el manifiesto generado no declara el espacio de nombres tools, sin el cual nada de esto retira nada.',
    nombraAlMenos: [
      'permisos prohibidos', 'modos de fondo', 'receptor de tareas', 'receptor de notificaciones',
      // Lo que la fila 53 le añade, y por lo mismo que la 52 estrenó este campo: el plugin
      // pasó de neutralizar dos receptores a neutralizar dos receptores **y tres piezas de
      // FCM**, y sin nombrarlas aquí el cometido podría renombrarse sin decirlo. La unidad
      // que hay que nombrar es el filtro y no la clase, porque es lo que decide la forma.
      'piezas de FCM', 'MESSAGING_EVENT', 'tools',
    ],
  },
];

const texto = (ruta) => readFileSync(join(RAIZ_REPO, ruta), 'utf8');

/**
 * La huella de un plugin: su código **sin comentarios** y con los espacios normalizados.
 *
 * Se resume con SHA-256 y se guardan dieciséis caracteres, que es de sobra para que un cambio
 * de código no pase desapercibido y poco bastante para que la lista siga siendo legible.
 */
function huellaDe(fuente) {
  const sinComentarios = fuente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha256').update(sinComentarios).digest('hex').slice(0, 16);
}

/** Los ficheros de plugin que hay hoy en el directorio, en orden estable. */
const ficherosDePlugin = () => readdirSync(join(RAIZ_REPO, PLUGINS)).filter((n) => n.endsWith('.js')).sort();

describe('Los plugins que reescriben el proyecto nativo están nombrados uno a uno', () => {
  test('La lista de plugins es exactamente la que hay, con su cometido declarado', () => {
    const hay = ficherosDePlugin();
    const nombrados = LOS_PLUGINS.map((p) => p.fichero).sort();

    // **Rojo 1**: un plugin nuevo que nadie ha nombrado.
    const sinNombrar = hay.filter((f) => !nombrados.includes(f));
    assert.deepEqual(
      sinNombrar,
      [],
      `estos ficheros de ${PLUGINS}/ no están nombrados en esta guarda: ${sinNombrar.join(', ')}. ` +
      'Un plugin reescribe el manifiesto, el Info.plist o MainActivity y eso acaba dentro del binario: se nombra aquí con su cometido en una frase, ' +
      'y de paso alguien mira si traduce o si decide.',
    );

    // **Rojo 3**: uno de la lista que ya no existe.
    const desaparecidos = nombrados.filter((f) => !hay.includes(f));
    assert.deepEqual(
      desaparecidos,
      [],
      `estos plugins están nombrados aquí y ya no existen en ${PLUGINS}/: ${desaparecidos.join(', ')}. ` +
      'Retirar uno es un acto con registro y no una limpieza silenciosa: se quita de la lista a mano.',
    );

    // Y son los dos de hoy, ni uno más. El número va escrito para que crecer se vea.
    assert.deepEqual(nombrados, ['lo-que-exige-health-connect.js', 'retira-permisos-prohibidos.js']);
    assert.equal(new Set(nombrados).size, nombrados.length, 'la lista repite un fichero, y un nombre repetido esconde uno que falta');

    // El cometido es una frase de verdad y no un hueco: sin él la entrada sería un permiso
    // en blanco para cualquier cosa que el fichero haga.
    for (const p of LOS_PLUGINS) {
      assert.equal(typeof p.cometido, 'string');
      assert.ok(p.cometido.length >= 60, `el cometido declarado de "${p.fichero}" son ${p.cometido.length} caracteres y no dice qué hace`);
      assert.match(p.cometido, /\.$/, `el cometido de "${p.fichero}" no es una frase terminada`);

      // Y nombra las piezas que toca, una a una. Sin esto, «se actualiza el cometido si hace
      // falta» es una recomendación; con esto, quitarle una pieza al plugin o añadírsela
      // obliga a tocar las dos declaraciones y a decir cuál.
      assert.ok(
        Array.isArray(p.nombraAlMenos) && p.nombraAlMenos.length > 0,
        `"${p.fichero}" no declara qué piezas tiene que nombrar su cometido, y entonces el cometido puede decir cualquier cosa`,
      );
      for (const pieza of p.nombraAlMenos) {
        assert.ok(p.cometido.includes(pieza), `el cometido de "${p.fichero}" no nombra "${pieza}", que es una de las piezas del proyecto nativo que toca`);
      }
    }
  });

  test('Ningún plugin ha cambiado de forma sin que alguien lo vuelva a nombrar', () => {
    // **Rojo 2**, por los tres lados que dicen qué le hace al proyecto nativo: qué función
    // exporta, qué ganchos de Expo usa y qué código tiene.
    for (const p of LOS_PLUGINS) {
      const fuente = texto(`${PLUGINS}/${p.fichero}`);

      assert.match(
        fuente,
        new RegExp(`module\\.exports\\s*=\\s*function ${p.exporta}\\b`),
        `"${p.fichero}" ya no exporta la función "${p.exporta}" que esta guarda nombra`,
      );

      const usados = [...fuente.matchAll(/\bwith[A-Z][A-Za-z]*\(/g)].map((m) => m[0].slice(0, -1));
      const declarados = [...new Set(usados)].sort();
      assert.deepEqual(
        declarados,
        [...p.mods].sort(),
        `"${p.fichero}" toca otras partes del proyecto nativo que las nombradas: usa ${declarados.join(', ')} y aquí están declaradas ${p.mods.join(', ')}`,
      );

      assert.equal(
        huellaDe(fuente),
        p.huella,
        `el código de "${p.fichero}" ha cambiado y su huella ya no es la nombrada. ` +
        'Cambiar lo que se le hace al binario es un acto con registro: se mira el cambio, se actualiza el cometido si hace falta y se pone la huella nueva.',
      );
    }
  });

  test('Los plugins nombrados son los que la app carga, y los carga por su ruta', () => {
    // La otra mitad, y es §6h del derecho y del revés: un plugin escrito que nadie declara en
    // `app.json` no corre —y sería código nativo muerto que alguien creería activo—, y uno
    // declarado que no existe rompe la compilación mucho más tarde y lejos.
    const app = texto(APP_JSON);
    for (const p of LOS_PLUGINS) {
      assert.ok(app.includes(`./plugins/${p.fichero}`), `"${p.fichero}" no lo declara ${APP_JSON}: está escrito y no corre`);
    }
    const declarados = [...app.matchAll(/\.\/plugins\/([A-Za-z0-9._-]+\.js)/g)].map((m) => m[1]).sort();
    assert.deepEqual(
      [...new Set(declarados)],
      LOS_PLUGINS.map((p) => p.fichero).sort(),
      `${APP_JSON} carga plugins que esta guarda no nombra, o deja de cargar alguno que sí`,
    );
  });

  test('La guarda no importa nada de Expo, de React Native ni de la app', () => {
    // Arranca en un clon limpio sin instalar nada: los plugins se leen como texto y no se
    // importan nunca, porque hacen `require('expo/config-plugins')` y eso ataría la batería
    // de núcleo a `node_modules`.
    const propia = texto('test/nucleo/plugins-declarados.test.mjs');
    const imports = [...propia.matchAll(/^import[^;]*from\s+'([^']+)';/gm)].map((m) => m[1]);
    for (const especificador of imports) {
      assert.ok(
        especificador.startsWith('node:') || especificador.startsWith('./') || especificador.startsWith('../'),
        `esta guarda importa "${especificador}", que hay que instalar: la batería de núcleo arranca en un clon limpio`,
      );
    }
    assert.ok(!/from '(expo|react-native)/.test(propia), 'esta guarda importa Expo o React Native');
    assert.ok(!new RegExp(`import[^;]*${PLUGINS}`).test(propia), 'esta guarda importa un plugin en vez de leerlo: los plugins son CommonJS y piden expo/config-plugins');
  });
});
