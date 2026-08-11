// La guarda del **manifiesto generado**: lo que de verdad acaba dentro del binario, en las
// dos plataformas, contrastado contra lo que `app/plataforma/permisos.js` declara.
//
// ## Por qué existe, y es el hallazgo más caro de la fila 48
//
// Todas las guardas de permisos de este repo miraban `app/app.json`. `app.json` es el
// fichero de **entrada**: lo que va al APK es el `AndroidManifest.xml` **fusionado** con el
// de cada librería, y lo que va al IPA es el `Info.plist` **generado** por los config
// plugins. Entre uno y otro entran permisos, receptores y modos de fondo que nadie de esta
// app ha escrito, y por esa puerta no se veía nada.
//
// Dos cosas se midieron el 11-ago-2026 y las dos llevaban tiempo dentro:
//
// - **`RECEIVE_BOOT_COMPLETED` estaba en el APK desde SPEC-023.** Lo inyecta el
//   `AndroidManifest.xml` de `expo-notifications`, y con él un receptor,
//   `NotificationsService`, escuchando `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` y
//   `MY_PACKAGE_REPLACED`. El permiso estaba en `LO_QUE_NUNCA_SE_DECLARA` y la guarda
//   pasaba en verde: la promesa llevaba rota casi treinta filas sin que nada protestara.
// - **`fetch` en `UIBackgroundModes` de iOS**, empujado incondicionalmente por el config
//   plugin de `expo-task-manager`. Ese sí lo metió la fila 48, y lo cerró en el mismo
//   plugin — pero tampoco lo habría visto ninguna prueba.
//
// Es `pipeline/decisiones-orquestador.md` §6h en el sitio donde más caro sale: la pieza
// que, al no estar, no protesta, puesta encima de la promesa que más pesa del proyecto.
//
// ## Cómo está escrita, y las cuatro condiciones que se le exigieron
//
// **1 · Lista blanca, no lista de prohibidos.** Una lista de prohibidos solo protege de lo
// que ya se te ocurrió. Aquí **todo permiso del manifiesto fusionado que no esté declarado
// pone rojo**, aunque nadie lo hubiera imaginado: es lo único que caza a la librería número
// doce. Lo declarado son dos cosas y no una: lo que `permisos.js` dice que la app pide, y
// `ARRASTRE_DE_LIBRERIA`, escrito **a mano y aquí**. Que el arrastre no viva en
// `permisos.js` es deliberado: aquel fichero declara lo que la app le pide a quien juega, y
// meterle veintiséis permisos de insignia de lanzador haría mentir a la declaración de
// privacidad por el otro lado. Que esté escrito a mano también: si se descubriera solo,
// aceptar el permiso de la librería siguiente no costaría nada, que es justo lo que pasó.
//
// **2 · Las dos plataformas.** `LO_QUE_NUNCA_SE_DECLARA` tiene entradas de iOS, y una
// guarda que solo leyera Android las dejaría todas sin mirar **en verde**. El `Info.plist`
// generado entra en la misma guarda y con el mismo trato.
//
// **3 · La ausencia se registra, nunca se cuenta como verde.** `app/android/` y `app/ios/`
// están gitignorados y los dos artefactos solo existen después de compilar o de
// `prebuild`. Un `if (existe)` que se saltara las comprobaciones dejaría esta guarda en
// verde sin haber mirado nada — §6h otra vez, y en el peor sitio. Así que **los casos que
// no pueden mirar no se registran**: en un clon sin compilar esta guarda aporta un caso
// —el de constancia— en lugar de los siete, y el número cambia a la vista. Además se
// escribe `test/reports/manifiesto-generado.estado.json`, que `scripts/qa-tester-run.sh`
// lee y publica **arriba, en el veredicto**: quien lee «PASS» tiene que ver en la misma
// pantalla que la promesa de privacidad no llegó a comprobarse.
//
// **4 · Las listas no se pueden vaciar sin protestar.** Una guarda que itera una lista pasa
// trivialmente si mañana alguien la deja en cero, o si quita justo la entrada que estorba.
//
// ## Cómo se generan los dos artefactos
//
//   Android · `cd app && npx expo run:android` (o cualquier compilación) deja
//     `app/android/app/build/intermediates/merged_manifest/debug/processDebugMainManifest/AndroidManifest.xml`.
//   iOS · `cd app && npx expo prebuild --platform ios --no-install --skip-dependency-update expo`
//     deja `app/ios/<proyecto>/Info.plist` **sin Xcode ni CocoaPods**: los config plugins se
//     evalúan en Node y lo que pide Xcode es lo de después. Medido: no ensucia `git status`.
//
// Las dos dependen de `node_modules`, así que la guarda sigue registrando ausencia cuando
// no puede mirar. Lo que cambia es cuántas veces puede mirar, no la doctrina.
//
// **Nada de esto tiene escenario en `docs/testing.md`** salvo «La app no pide el permiso de
// ubicación permanente», que aquí se afirma sobre lo generado en vez de sobre lo declarado.
// El resto va marcado como hueco de batería en `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import {
  LO_QUE_NUNCA_SE_DECLARA,
  MODOS_DE_FONDO,
  PERMISOS_QUE_SE_PIDEN,
  PERMISOS_QUE_UNA_LIBRERIA_EXIGE,
} from '../../app/plataforma/permisos.js';

/** Dónde deja Gradle el manifiesto fusionado de la compilación de depuración. */
const MANIFIESTO_ANDROID = join(
  RAIZ_REPO, 'app', 'android', 'app', 'build', 'intermediates',
  'merged_manifest', 'debug', 'processDebugMainManifest', 'AndroidManifest.xml',
);

/** Dónde deja `expo prebuild` el `Info.plist`. El nombre del proyecto no se da por supuesto. */
function rutaDelInfoPlist() {
  const ios = join(RAIZ_REPO, 'app', 'ios');
  let entradas;
  try {
    entradas = readdirSync(ios).sort();
  } catch {
    return null;
  }
  for (const nombre of entradas) {
    const candidato = join(ios, nombre, 'Info.plist');
    try {
      if (statSync(candidato).isFile()) return candidato;
    } catch { /* sigue probando */ }
  }
  return null;
}

/** Dónde queda constancia de qué se pudo mirar. Lo lee el runner y lo publica arriba. */
const CONSTANCIA = join(RAIZ_REPO, 'test', 'reports', 'manifiesto-generado.estado.json');

/**
 * El arrastre de las librerías: lo que aparece en el manifiesto fusionado, **no lo pide
 * esta app** y se ha mirado uno a uno.
 *
 * Escrito a mano y con dueño por entrada, igual que `pantallas-huerfanas.test.mjs` y
 * `limite-declarado.test.mjs`, y por lo mismo: lo que hace valer una lista no es la lista,
 * es que añadirle la entrada número veintisiete obligue a enfrentarse a ella. **Las dos
 * direcciones son rojo**: uno que aparezca y no esté aquí, y uno de aquí que ya no
 * aparezca. Bajar el número es un acto con registro.
 *
 * Ninguno de estos pide nada a quien juega: no son permisos peligrosos de Android, no
 * salen en el diálogo del sistema y no dan acceso a datos. Los de insignia son de
 * `ShortcutBadger`, que `expo-notifications` arrastra para pintar el número en el icono del
 * lanzador; retirarlos a ciegas sería temerario y por eso el plugin **detecta todo y retira
 * solo lo decidido**. Los dos de almacenamiento llegan con `maxSdkVersion` puesto, así que
 * en Android 13 y superiores no existen.
 */
const ARRASTRE_DE_LIBRERIA = Object.freeze([
  Object.freeze({ permiso: 'android.permission.ACCESS_NETWORK_STATE', quien: 'react-native / expo-modules-core', porque: 'saber si hay red antes de pedir; el juego funciona sin ella' }),
  Object.freeze({ permiso: 'android.permission.INTERNET', quien: 'react-native', porque: 'la única red del juego es la generación del mapa por el proxy' }),
  Object.freeze({ permiso: 'android.permission.READ_APP_BADGE', quien: 'expo-notifications (ShortcutBadger)', porque: 'la insignia del icono del lanzador' }),
  Object.freeze({ permiso: 'android.permission.READ_EXTERNAL_STORAGE', quien: 'expo-file-system', porque: 'abrir una copia con el selector del sistema; llega con maxSdkVersion' }),
  Object.freeze({ permiso: 'android.permission.SYSTEM_ALERT_WINDOW', quien: 'react-native, solo en depuración', porque: 'el menú de desarrollo flotante; no está en una compilación de lanzamiento' }),
  Object.freeze({ permiso: 'android.permission.VIBRATE', quien: 'expo-haptics', porque: 'la capa de bolsillo de los avisos (accesibilidad.md §3)' }),
  Object.freeze({ permiso: 'android.permission.WAKE_LOCK', quien: 'expo-notifications (Firebase)', porque: 'entregar una notificación con la pantalla apagada' }),
  Object.freeze({ permiso: 'android.permission.WRITE_EXTERNAL_STORAGE', quien: 'expo-file-system', porque: 'guardar una copia con el selector del sistema; llega con maxSdkVersion' }),
  Object.freeze({ permiso: 'com.anddoes.launcher.permission.UPDATE_COUNT', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador Apex' }),
  Object.freeze({ permiso: 'com.google.android.c2dm.permission.RECEIVE', quien: 'expo-notifications (Firebase)', porque: 'recibir el mensaje que dispara una notificación' }),
  Object.freeze({ permiso: 'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE', quien: 'expo-notifications (Play Services)', porque: 'lo declara la biblioteca de Play; esta app no lee el referrer' }),
  Object.freeze({ permiso: 'com.htc.launcher.permission.READ_SETTINGS', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de HTC' }),
  Object.freeze({ permiso: 'com.htc.launcher.permission.UPDATE_SHORTCUT', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de HTC' }),
  Object.freeze({ permiso: 'com.huawei.android.launcher.permission.CHANGE_BADGE', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de Huawei' }),
  Object.freeze({ permiso: 'com.huawei.android.launcher.permission.READ_SETTINGS', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de Huawei' }),
  Object.freeze({ permiso: 'com.huawei.android.launcher.permission.WRITE_SETTINGS', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de Huawei' }),
  Object.freeze({ permiso: 'com.majeur.launcher.permission.UPDATE_BADGE', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador Solid' }),
  Object.freeze({ permiso: 'com.oppo.launcher.permission.READ_SETTINGS', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de OPPO' }),
  Object.freeze({ permiso: 'com.oppo.launcher.permission.WRITE_SETTINGS', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de OPPO' }),
  Object.freeze({ permiso: 'com.sec.android.provider.badge.permission.READ', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de Samsung' }),
  Object.freeze({ permiso: 'com.sec.android.provider.badge.permission.WRITE', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de Samsung' }),
  Object.freeze({ permiso: 'com.sonyericsson.home.permission.BROADCAST_BADGE', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de Sony' }),
  Object.freeze({ permiso: 'com.sonymobile.home.permission.PROVIDER_INSERT_BADGE', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador de Sony' }),
  Object.freeze({ permiso: 'com.walkingadventure.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION', quien: 'androidx.core', porque: 'permiso propio del paquete para que sus receptores dinámicos no queden exportados' }),
  Object.freeze({ permiso: 'me.everything.badger.permission.BADGE_COUNT_READ', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador EverythingMe' }),
  Object.freeze({ permiso: 'me.everything.badger.permission.BADGE_COUNT_WRITE', quien: 'expo-notifications (ShortcutBadger)', porque: 'insignia en el lanzador EverythingMe' }),
]);

/**
 * Las acciones con las que el sistema **despierta a una app cerrada**.
 *
 * Un receptor con cualquiera de estas es exactamente lo que «nada de esta app se despierta
 * con la app cerrada» promete que no existe, y es la propiedad de la que
 * `RECEIVE_BOOT_COMPLETED` es solo el permiso: el permiso a solas es inerte.
 */
const ACCIONES_QUE_DESPIERTAN = Object.freeze([
  'android.intent.action.BOOT_COMPLETED',
  'android.intent.action.REBOOT',
  'android.intent.action.QUICKBOOT_POWERON',
  'com.htc.intent.action.QUICKBOOT_POWERON',
  'android.intent.action.MY_PACKAGE_REPLACED',
  'android.intent.action.LOCKED_BOOT_COMPLETED',
]);

/** Un permiso con su prefijo, para poder comparar `POST_NOTIFICATIONS` con el fusionado. */
function conPrefijo(nombre) {
  return nombre.includes('.') ? nombre : `android.permission.${nombre}`;
}

/** El XML sin comentarios: lo comentado no va al binario y contarlo sería un falso rojo. */
function sinComentarios(xml) {
  return xml.replace(/<!--[\s\S]*?-->/g, '');
}

/** Los `uses-permission` del manifiesto fusionado, sin repetir y en orden estable. */
function permisosDelManifiesto(xml) {
  const texto = sinComentarios(xml);
  const nombres = [...texto.matchAll(/<uses-permission[^>]*?android:name="([^"]+)"/gs)].map((m) => m[1]);
  return [...new Set(nombres)].sort();
}

/**
 * Los receptores del manifiesto fusionado con las acciones que escuchan.
 *
 * Analizador propio y no una librería de XML, por lo de siempre: la batería corre sin
 * `node_modules`. Lo que hace falta saber es exactamente esto —qué clase escucha qué
 * acción— y para eso llega con recortar cada bloque `<receiver …>…</receiver>`.
 */
function receptoresDelManifiesto(xml) {
  const texto = sinComentarios(xml);
  const receptores = [];
  const abre = /<receiver\b/g;
  let m;
  while ((m = abre.exec(texto)) !== null) {
    const desde = m.index;
    // O el bloque se cierra con `</receiver>` o es una etiqueta vacía `/>`.
    const cierre = texto.indexOf('</receiver>', desde);
    const vacia = texto.indexOf('/>', desde);
    const siguiente = texto.indexOf('<receiver', desde + 1);
    let hasta;
    if (cierre !== -1 && (siguiente === -1 || cierre < siguiente)) hasta = cierre + '</receiver>'.length;
    else hasta = vacia === -1 ? texto.length : vacia + 2;
    const bloque = texto.slice(desde, hasta);
    const nombre = bloque.match(/android:name="([^"]+)"/);
    receptores.push({
      clase: nombre ? nombre[1] : '(sin nombre)',
      acciones: [...bloque.matchAll(/<action[^>]*?android:name="([^"]+)"/gs)].map((a) => a[1]),
    });
  }
  return receptores;
}

/** Los tipos de servicio en primer plano declarados, que es la otra mitad del rótulo. */
function tiposDeServicioEnPrimerPlano(xml) {
  const texto = sinComentarios(xml);
  const tipos = [...texto.matchAll(/android:foregroundServiceType="([^"]+)"/g)].flatMap((m) => m[1].split('|'));
  return [...new Set(tipos)].sort();
}

/**
 * Un `Info.plist` XML leído a mano: claves de primer nivel a cadena, lista de cadenas o
 * booleano. Sin dependencias y sin `plutil`, que no existe fuera de macOS.
 */
function leePlist(xml) {
  const dict = xml.slice(xml.indexOf('<dict>') + '<dict>'.length, xml.lastIndexOf('</dict>'));
  const claves = {};
  const patron = /<key>([^<]+)<\/key>\s*([\s\S]*?)(?=<key>|$)/g;
  let m;
  while ((m = patron.exec(dict)) !== null) {
    const clave = m[1];
    const valor = m[2].trim();
    if (valor.startsWith('<array>')) {
      claves[clave] = [...valor.matchAll(/<string>([\s\S]*?)<\/string>/g)].map((s) => s[1]);
    } else if (valor.startsWith('<true/>') || valor.startsWith('<false/>')) {
      claves[clave] = valor.startsWith('<true/>');
    } else {
      const cadena = valor.match(/^<string>([\s\S]*?)<\/string>/);
      claves[clave] = cadena ? cadena[1] : valor;
    }
  }
  return claves;
}

// ── Lo que se pudo mirar, y la constancia que lo dice ───────────────────────────

const RUTA_IOS = rutaDelInfoPlist();
const HAY_ANDROID = existsSync(MANIFIESTO_ANDROID);
const HAY_IOS = RUTA_IOS !== null;

const XML_ANDROID = HAY_ANDROID ? readFileSync(MANIFIESTO_ANDROID, 'utf8') : null;
const PLIST = HAY_IOS ? leePlist(readFileSync(RUTA_IOS, 'utf8')) : null;

/**
 * La constancia, escrita **siempre y antes de nada**.
 *
 * No es un adorno: es lo que impide que «no compilado» y «compilado y limpio» acaben en la
 * misma casilla del report. `scripts/qa-tester-run.sh` borra este fichero antes de lanzar
 * la batería y lo lee después, así que su ausencia también significa algo —que esta guarda
 * no llegó a ejecutarse— y también sale arriba.
 */
try {
  mkdirSync(join(RAIZ_REPO, 'test', 'reports'), { recursive: true });
  writeFileSync(CONSTANCIA, `${JSON.stringify({
    android: {
      mirado: HAY_ANDROID,
      ruta: 'app/android/app/build/intermediates/merged_manifest/debug/processDebugMainManifest/AndroidManifest.xml',
      comoSeGenera: 'cd app && npx expo run:android',
    },
    ios: {
      mirado: HAY_IOS,
      ruta: RUTA_IOS ? RUTA_IOS.slice(RAIZ_REPO.length + 1) : 'app/ios/<proyecto>/Info.plist',
      comoSeGenera: 'cd app && npx expo prebuild --platform ios --no-install --skip-dependency-update expo',
    },
    completo: HAY_ANDROID && HAY_IOS,
  }, null, 2)}\n`, 'utf8');
} catch {
  // Que no se pueda escribir la constancia no tumba la batería: el runner lo lee como
  // «no dejó constancia», que es el mismo estado y con el mismo trato.
}

describe('La guarda del manifiesto generado deja constancia de qué pudo mirar', () => {
  test('La guarda del manifiesto generado deja constancia de qué pudo mirar', () => {
    // Este caso existe, se ejecuta siempre y **no comprueba ningún manifiesto**: comprueba
    // que las listas contra las que se compara siguen en pie. Es lo único que se puede
    // afirmar en un clon sin compilar, y decirlo con un caso propio es lo que hace que el
    // recuento de esta guarda cambie a la vista entre «se miró» y «no se pudo mirar».
    assert.ok(LO_QUE_NUNCA_SE_DECLARA.length > 0, 'la lista de lo que nunca se declara está vacía: así no podría ponerse roja nunca');
    assert.ok(MODOS_DE_FONDO.length > 0, 'no hay ningún modo de fondo declarado: la lista blanca de iOS se quedaría sin blanco');
    assert.ok(ARRASTRE_DE_LIBRERIA.length > 0, 'el arrastre de librería está vacío: la lista blanca lo admitiría todo');
    for (const entrada of ARRASTRE_DE_LIBRERIA) {
      assert.ok(entrada.quien && entrada.porque, `el arrastre "${entrada.permiso}" no dice de quién es ni para qué está`);
    }
    assert.equal(new Set(ARRASTRE_DE_LIBRERIA.map((a) => a.permiso)).size, ARRASTRE_DE_LIBRERIA.length, 'hay un permiso repetido en el arrastre: un nombre repetido esconde uno que falta');

    // Y los dos que esta fila hace peligrosos siguen nombrados en alguna de las dos listas
    // de `permisos.js`. Que uno se pueda mudar de la lista dura a la de impuestos es
    // correcto —`RECEIVE_BOOT_COMPLETED` lo hizo, con su motivo—; que desaparezca de las
    // dos, no: sería dejar de mirarlo sin decirlo.
    const nombrados = new Set([...LO_QUE_NUNCA_SE_DECLARA, ...PERMISOS_QUE_UNA_LIBRERIA_EXIGE.map((p) => p.id)]);
    for (const peligroso of ['ACCESS_BACKGROUND_LOCATION', 'RECEIVE_BOOT_COMPLETED']) {
      assert.equal(nombrados.has(peligroso), true, `"${peligroso}" no está nombrado en ninguna de las dos listas de permisos.js`);
    }

    // La constancia se escribió, y dice lo que se pudo mirar. Sin ella el runner no puede
    // distinguir «no compilado» de «compilado y limpio», que es lo que esto viene a evitar.
    assert.equal(existsSync(CONSTANCIA), true, 'la guarda no ha dejado constancia de qué pudo mirar');
    const constancia = JSON.parse(readFileSync(CONSTANCIA, 'utf8'));
    assert.equal(constancia.android.mirado, HAY_ANDROID);
    assert.equal(constancia.ios.mirado, HAY_IOS);
  });
});

// ── Android, sobre el manifiesto fusionado ──────────────────────────────────────
//
// Los casos de aquí abajo **solo se registran si hay manifiesto**. No se saltan con `skip`
// ni se envuelven en un `if` dentro del cuerpo: un caso que pasa sin haber mirado nada es
// exactamente lo que esta guarda existe para impedir.

if (HAY_ANDROID) {
  describe('El manifiesto fusionado de Android', () => {
    test('La app no pide el permiso de ubicación permanente', () => {
      // El mismo escenario de la batería que `pasos-de-fondo.test.mjs` afirma sobre
      // `app.json`, aquí sobre lo que de verdad va al APK. Es la mitad que faltaba: el
      // plugin de `expo-location` añade `ACCESS_BACKGROUND_LOCATION` en cuanto alguien
      // encienda la ubicación de fondo, y en `app.json` no se vería.
      const permisos = permisosDelManifiesto(XML_ANDROID);
      assert.equal(permisos.includes('android.permission.ACCESS_BACKGROUND_LOCATION'), false, 'el APK pide el permiso de ubicación permanente, que es la exclusión 12 del PRD');
      assert.equal(permisos.includes('android.permission.ACCESS_FINE_LOCATION'), true, 'el APK no pide la ubicación «mientras se usa»: sin ella no hay salida que abrir');
    });

    test('Ningún permiso prohibido llega al manifiesto fusionado', () => {
      const permisos = permisosDelManifiesto(XML_ANDROID);
      const colados = LO_QUE_NUNCA_SE_DECLARA
        .map(conPrefijo)
        .filter((p) => permisos.includes(p));
      assert.deepEqual(
        colados,
        [],
        `estos permisos están en LO_QUE_NUNCA_SE_DECLARA y aparecen en el manifiesto fusionado: ${colados.join(', ')}. ` +
        '«Viene de la librería» no es una explicación: es la descripción del fallo. Se retiran con `tools:node="remove"` en ' +
        '`app/plugins/retira-permisos-prohibidos.js`, o se mueven a PERMISOS_QUE_UNA_LIBRERIA_EXIGE con su motivo y su a-cambio.',
      );
    });

    test('Todo permiso del manifiesto fusionado está declarado, y todo lo declarado sigue apareciendo', () => {
      // La lista blanca, que es la pieza que caza a la librería número doce. Las dos
      // direcciones son rojo: lo que aparece sin estar declarado, y lo declarado que ya no
      // aparece — para que quitar una entrada sea un acto y no una limpieza silenciosa.
      const permisos = permisosDelManifiesto(XML_ANDROID);
      const deLaApp = new Set([
        ...(JSON.parse(readFileSync(join(RAIZ_REPO, 'app', 'app.json'), 'utf8')).expo?.android?.permissions ?? []).map(conPrefijo),
        ...PERMISOS_QUE_SE_PIDEN.filter((p) => p.android).map((p) => conPrefijo(p.android)),
        ...PERMISOS_QUE_UNA_LIBRERIA_EXIGE.map((p) => conPrefijo(p.id)),
      ]);
      const admitidos = new Set([...deLaApp, ...ARRASTRE_DE_LIBRERIA.map((a) => a.permiso)]);

      const sinDeclarar = permisos.filter((p) => !admitidos.has(p));
      assert.deepEqual(
        sinDeclarar,
        [],
        `estos permisos están en el APK y nadie los ha declarado: ${sinDeclarar.join(', ')}. ` +
        'Si los pide la app, van a `app/app.json` y a `permisos.js`; si los arrastra una librería, se miran uno a uno y se ' +
        'añaden a ARRASTRE_DE_LIBRERIA con quién los trae y para qué. Lo que no vale es que lleguen sin que nadie lo vea.',
      );

      const yaNoEstan = ARRASTRE_DE_LIBRERIA.map((a) => a.permiso).filter((p) => !permisos.includes(p));
      assert.deepEqual(
        yaNoEstan,
        [],
        `estos permisos están declarados como arrastre de librería y ya no aparecen en el manifiesto: ${yaNoEstan.join(', ')}. ` +
        'Bajar el número es la buena noticia: quítalos de la lista.',
      );
    });

    test('Nada de esta app se despierta al arrancar el móvil', () => {
      // **Esta guarda nace roja, y ese es el punto.** El receptor `NotificationsService`
      // de `expo-notifications` escucha `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` y
      // `MY_PACKAGE_REPLACED` en el manifiesto fusionado, y lo hace **desde SPEC-023**: no
      // lo trae la fila 48, que lo único que hizo fue sacarlo a la luz. Es un defecto real,
      // pre-existente y con dueño, y se trata como se trató en la fila 47 la guarda de la
      // partida sin cablear: roja a propósito, con nombre, sin excepción, sin lista de
      // tolerados y sin `skip`, hasta que la fila que monte las notificaciones lo cierre.
      //
      // El permiso a solas es inerte; lo que despierta es el receptor, y por eso lo que se
      // afirma es el receptor. `app/plugins/retira-permisos-prohibidos.js` ya sustituye el
      // de `expo-task-manager` por uno sin `intent-filter`, así que la vía de la tarea de
      // ubicación está cerrada; la de las notificaciones, no.
      const despertadores = receptoresDelManifiesto(XML_ANDROID)
        .map((r) => ({ clase: r.clase, acciones: r.acciones.filter((a) => ACCIONES_QUE_DESPIERTAN.includes(a)) }))
        .filter((r) => r.acciones.length > 0);
      assert.deepEqual(
        despertadores.map((r) => `${r.clase} ← ${r.acciones.join(', ')}`),
        [],
        'hay receptores en el APK a los que el sistema despierta con la app cerrada. Dueño conocido: ' +
        '`expo.modules.notifications.service.NotificationsService` viene de `expo-notifications` y entró con SPEC-023; ' +
        'no es de SPEC-048, que solo lo sacó a la luz. Se cierra sustituyendo su declaración con `tools:node="replace"` sin ' +
        'esos `intent-filter`, como ya se hace con el receptor de `expo-task-manager`.',
      );
    });

    test('Lo que se hace a cambio de un permiso impuesto se cumple de verdad', () => {
      // Un permiso que una librería impone se admite **solo** porque a cambio se hace algo
      // que mantiene en pie la propiedad que protegía. Si el a-cambio no se cumple, el
      // permiso está admitido por una promesa y no por un hecho, que es peor que no tener
      // la lista.
      //
      // Lo que se afirma aquí es **el a-cambio, exactamente y sin estirarlo**: el receptor
      // de `expo-task-manager` queda sin ningún disparador de arranque. Que el paquete
      // entero siga teniendo uno es el caso de arriba y no este, a propósito: dos casos
      // rojos por la misma causa se leerían como dos defectos y hay uno.
      const impuesto = PERMISOS_QUE_UNA_LIBRERIA_EXIGE.find((p) => p.id === 'RECEIVE_BOOT_COMPLETED');
      if (!impuesto) return; // Si sale de la lista, el caso de arriba lo cubre entero.
      assert.match(impuesto.aCambio, /receptor de tareas se sustituye/, 'el a-cambio declarado ha cambiado: hay que volver a medir qué protege');

      const deTareas = receptoresDelManifiesto(XML_ANDROID).filter((r) => /taskManager/i.test(r.clase));
      assert.equal(deTareas.length, 1, `se esperaba un único receptor de tareas en el manifiesto fusionado y hay ${deTareas.length}`);
      assert.deepEqual(
        deTareas[0].acciones.filter((a) => ACCIONES_QUE_DESPIERTAN.includes(a)),
        [],
        `${deTareas[0].clase} vuelve a escuchar disparadores de arranque: el a-cambio con el que se admitió ` +
        'RECEIVE_BOOT_COMPLETED era precisamente sustituirlo sin ellos, y sin eso el permiso está admitido por una promesa.',
      );
      // Y el permiso sigue ahí porque no se puede quitar, que es la otra mitad del trato:
      // `expo-task-manager` persiste el trabajo de `JobScheduler` con `setPersisted(true)`
      // y sin el permiso la app revienta al llegar la primera posición. Medido.
      assert.match(impuesto.porQueNoSeQuita, /JobScheduler|persist/i);
      assert.equal(permisosDelManifiesto(XML_ANDROID).includes('android.permission.RECEIVE_BOOT_COMPLETED'), true);
    });

    test('El único servicio en primer plano es el de la ubicación', () => {
      // El rótulo del sistema es un servicio en primer plano de tipo `location` y **nada
      // más**: un `dataSync` o un `mediaPlayback` colados aquí serían otra cosa corriendo
      // con la app cerrada, con otro permiso y sin que nadie lo hubiera decidido.
      assert.deepEqual(tiposDeServicioEnPrimerPlano(XML_ANDROID), ['location']);
    });
  });
}

// ── iOS, sobre el `Info.plist` generado ─────────────────────────────────────────

if (HAY_IOS) {
  describe('El Info.plist generado de iOS', () => {
    test('Las claves de ubicación son la de «mientras se usa» y ninguna más', () => {
      assert.ok(PLIST.NSLocationWhenInUseUsageDescription, 'el Info.plist no explica para qué se pide la ubicación «mientras se usa»');
      for (const permanente of ['NSLocationAlwaysAndWhenInUseUsageDescription', 'NSLocationAlwaysUsageDescription']) {
        assert.equal(permanente in PLIST, false, `el Info.plist declara "${permanente}", que es el permiso permanente y la exclusión 12 del PRD`);
      }
    });

    test('Ninguna clave prohibida llega al Info.plist generado', () => {
      const colados = LO_QUE_NUNCA_SE_DECLARA.filter((clave) => clave in PLIST);
      assert.deepEqual(
        colados,
        [],
        `estas claves están en LO_QUE_NUNCA_SE_DECLARA y aparecen en el Info.plist generado: ${colados.join(', ')}. ` +
        'Se retiran en `app/plugins/retira-permisos-prohibidos.js`, no se aceptan porque las ponga un config plugin.',
      );
    });

    test('Los modos de fondo de iOS son exactamente los declarados', () => {
      // Por **lista blanca** y no por lista de prohibidos, que es lo que la fila 48 tuvo
      // que aprender pagando: el config plugin de `expo-task-manager` empuja `fetch`
      // incondicionalmente, y `fetch` es tarea periódica con otro nombre. Con lista blanca,
      // el día que otra librería empuje `processing` o `remote-notification` esto se cae
      // solo, sin que nadie tenga que acordarse de añadirlo a ninguna lista.
      const declarados = MODOS_DE_FONDO.map((m) => m.id);
      const enElPlist = PLIST.UIBackgroundModes ?? [];
      const colados = enElPlist.filter((m) => !declarados.includes(m));
      assert.deepEqual(colados, [], `el Info.plist generado declara modos de fondo que nadie ha decidido: ${colados.join(', ')}`);
      assert.deepEqual([...enElPlist], declarados, 'los modos de fondo generados no son exactamente los declarados en MODOS_DE_FONDO');
    });

    test('No hay ninguna tarea de fondo programada en iOS', () => {
      // `TAREAS_PERIODICAS` está vacía, y en iOS la manera de tener una sin que se note es
      // `BGTaskSchedulerPermittedIdentifiers`. Se afirma la ausencia de la clave entera:
      // una lista vacía tampoco vale, porque declararla es el paso previo a llenarla.
      assert.equal('BGTaskSchedulerPermittedIdentifiers' in PLIST, false, 'el Info.plist generado declara identificadores de tarea de fondo');
    });
  });
}
