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
  PERMISOS_DE_SALUD,
  PERMISOS_QUE_SE_PIDEN,
  PERMISOS_QUE_UNA_LIBRERIA_EXIGE,
  VIAS_DE_DESPERTAR,
  VIAS_NEUTRALIZADAS,
  viasSinMecanismoMedido,
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

/** El receptor de `expo-notifications`, que SPEC-052 sustituye conservando su entrega. */
const RECEPTOR_DE_AVISOS = 'expo.modules.notifications.service.NotificationsService';

/**
 * La acción con la que `expo-notifications` entrega cada aviso, y **lo único que el
 * reemplazo conserva**.
 *
 * Aquí está la mitad de la exigencia que no se ve en la guarda de arranque: a este receptor
 * se le descubre **por la acción declarada en su filtro** —`NotificationsService.kt:403-406`,
 * `queryBroadcastReceivers(Intent(intent.action).setPackage(…))`—, así que un reemplazo sin
 * ella dejaría la app compilando, verde en la guarda de arranque y **sin ninguna
 * notificación funcionando**. El mismo rigor que puso rojo lo que faltaba tiene que poner
 * rojo un reemplazo que entregue de menos.
 */
const ACCION_DE_ENTREGA_DE_AVISOS = 'expo.modules.notifications.NOTIFICATION_EVENT';

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
    // `enabled` y `exported` se leen **de la etiqueta de apertura** y no del bloque entero:
    // dentro puede haber un `<service>` o un `<meta-data>` con los mismos atributos, y
    // atribuírselos al receptor sería afirmar sobre otra cosa. Ausentes valen `null`, que no
    // es lo mismo que el valor por defecto de Android: lo que se exige aquí es que estén
    // escritos, porque `tools:node="replace"` sustituye la declaración entera.
    const finCabecera = texto.indexOf('>', desde);
    const cabecera = finCabecera === -1 ? bloque : texto.slice(desde, finCabecera + 1);
    receptores.push({
      clase: nombre ? nombre[1] : '(sin nombre)',
      habilitado: (cabecera.match(/android:enabled="([^"]+)"/) ?? [, null])[1],
      exportado: (cabecera.match(/android:exported="([^"]+)"/) ?? [, null])[1],
      acciones: [...bloque.matchAll(/<action[^>]*?android:name="([^"]+)"/gs)].map((a) => a[1]),
    });
  }
  return receptores;
}

/**
 * Los receptores que el sistema despierta con la app cerrada, nombrando clase y acción.
 *
 * Sale de dentro del caso para que se le pueda aplicar a un manifiesto de ejemplo: una
 * comprobación que solo existe dentro de su `test` no se puede poner roja a propósito, y
 * entonces nadie sabe si detecta lo que dice detectar.
 */
function receptoresQueDespiertan(xml) {
  return receptoresDelManifiesto(xml)
    .map((r) => ({ clase: r.clase, acciones: r.acciones.filter((a) => ACCIONES_QUE_DESPIERTAN.includes(a)) }))
    .filter((r) => r.acciones.length > 0)
    .map((r) => `${r.clase} ← ${r.acciones.join(', ')}`);
}

/**
 * Lo que le falta o le sobra al reemplazo del receptor de avisos, como lista de problemas.
 *
 * **Las dos direcciones son rojo, y la de «entrega de menos» es la que esta fila estrena**:
 * un reemplazo sin acciones deja la guarda de arranque en verde —no escucha nada, tampoco el
 * arranque— y rompe todas las notificaciones en uso. Por eso se afirma la lista exacta de
 * acciones y no la ausencia de las seis.
 */
function problemasDelReceptorDeAvisos(xml) {
  const suyos = receptoresDelManifiesto(xml).filter((r) => r.clase === RECEPTOR_DE_AVISOS);
  const problemas = [];
  if (suyos.length !== 1) {
    problemas.push(
      `hay ${suyos.length} receptores "${RECEPTOR_DE_AVISOS}" y tiene que haber exactamente uno: ` +
      'dos significa que el reemplazo no sustituyó al de la librería, y ninguno que la librería lo renombró y aquí quedó un fantasma',
    );
  }
  for (const receptor of suyos) {
    if (!receptor.acciones.includes(ACCION_DE_ENTREGA_DE_AVISOS)) {
      problemas.push(
        `"${RECEPTOR_DE_AVISOS}" no declara "${ACCION_DE_ENTREGA_DE_AVISOS}": a este receptor se le descubre por la acción de su ` +
        'filtro, así que sin ella la app compila, pasa la guarda de arranque y no entrega ni un aviso',
      );
    }
    const sobran = receptor.acciones.filter((a) => a !== ACCION_DE_ENTREGA_DE_AVISOS);
    if (sobran.length) problemas.push(`"${RECEPTOR_DE_AVISOS}" declara acciones que el reemplazo no conserva: ${sobran.join(', ')}`);
    if (receptor.habilitado !== 'true') problemas.push(`"${RECEPTOR_DE_AVISOS}" no queda habilitado: android:enabled="${receptor.habilitado}"`);
    if (receptor.exportado !== 'false') problemas.push(`"${RECEPTOR_DE_AVISOS}" no queda sin exportar: android:exported="${receptor.exportado}"`);
  }
  return problemas;
}

// ── Las vías de despertar: receptores **y servicios**, contra la lista cerrada ──
//
// SPEC-053. La propiedad que `app/plataforma/permisos.js` promete desde SPEC-030 es la
// **ancha** —«nada de esta app se despierta con la app cerrada»— y lo que esta guarda
// comprobaba era la **estrecha**, «nada se despierta al arrancar el móvil», y encima solo
// sobre los receptores: `receptoresQueDespiertan` recorta bloques `<receiver …>` y nada más,
// así que **los servicios no entraban en el barrido por construcción** — no por lista de
// tolerados—. Por esas dos puertas a la vez vivían las tres piezas de FCM.
//
// Lo que cierra la diferencia no es una acción más en la lista: es enumerar **todos** los
// receptores y **todos** los servicios del manifiesto fusionado y contrastarlos contra
// `VIAS_DE_DESPERTAR`, que es el dato en producción con su veredicto escrito. El juicio de
// si un componente puede levantar el proceso se escribe allí; aquí solo se contrasta. Una
// guarda que lo decidiera sola sería una guarda con criterio propio, y **un componente que
// llegue sin estar nombrado pone la batería roja**, venga de quien venga.

/** El filtro por el que se descubren los dos servicios de mensajería, y la unidad que se cierra. */
const FILTRO_DE_MENSAJERIA = 'com.google.firebase.MESSAGING_EVENT';

/** El filtro del receptor de c2dm: la puerta por la que un push levanta el proceso. */
const FILTRO_DE_C2DM = 'com.google.android.c2dm.intent.RECEIVE';

/**
 * Los bloques de una etiqueta del manifiesto, con lo que hace falta saber de cada uno.
 *
 * Analizador propio y no una librería de XML, por lo de siempre: la batería corre sin
 * `node_modules`. Se busca **el final de la etiqueta de apertura primero** y solo entonces si
 * se cierra sola, que es lo que evita recortar el bloque en el primer `<action …/>` de dentro
 * y dejarlo sin sus acciones — que son justo lo que se viene a leer.
 */
function bloquesDe(xml, etiqueta) {
  const texto = sinComentarios(xml);
  const bloques = [];
  const abre = new RegExp(`<${etiqueta}(?=[\\s>/])`, 'g');
  let m;
  while ((m = abre.exec(texto)) !== null) {
    const finCabecera = texto.indexOf('>', m.index);
    if (finCabecera === -1) break;
    const cabecera = texto.slice(m.index, finCabecera + 1);
    const cierre = texto.indexOf(`</${etiqueta}>`, finCabecera);
    const hasta = cabecera.endsWith('/>') || cierre === -1 ? finCabecera + 1 : cierre + `</${etiqueta}>`.length;
    const bloque = texto.slice(m.index, hasta);
    bloques.push({
      clase: (cabecera.match(/android:name="([^"]+)"/) ?? [, '(sin nombre)'])[1],
      habilitado: (cabecera.match(/android:enabled="([^"]+)"/) ?? [, null])[1],
      exportado: (cabecera.match(/android:exported="([^"]+)"/) ?? [, null])[1],
      permiso: (cabecera.match(/android:permission="([^"]+)"/) ?? [, null])[1],
      acciones: [...bloque.matchAll(/<action[^>]*?android:name="([^"]+)"/gs)].map((a) => a[1]),
    });
  }
  return bloques;
}

/**
 * Todo lo que el sistema puede alcanzar por su cuenta: **los receptores y los servicios**.
 *
 * Los dos y no uno, que es la mitad del agujero que esta fila cierra. Los `provider` quedan
 * fuera a propósito y está dicho en `VIAS_DE_DESPERTAR`: los tres del manifiesto fusionado
 * son `exported="false"`, así que ningún proceso ajeno puede consultarlos; el día que uno se
 * exporte, es una vía nueva y entra por la lista.
 */
function componentesDelManifiesto(xml) {
  return [
    ...bloquesDe(xml, 'receiver').map((b) => ({ ...b, tipo: 'receptor' })),
    ...bloquesDe(xml, 'service').map((b) => ({ ...b, tipo: 'servicio' })),
  ];
}

/** Cómo se nombra un componente en un mensaje de fallo: clase, tipo y el filtro que lo descubre. */
function comoSeLlama(componente) {
  const filtro = componente.acciones.length ? ` ← ${componente.acciones.join(', ')}` : '';
  return `${componente.clase} (${componente.tipo})${filtro}`;
}

/**
 * Los componentes del manifiesto que **la lista cerrada no nombra**.
 *
 * Sale de dentro del caso para que se le pueda aplicar a un manifiesto de ejemplo: una
 * comprobación que solo existe dentro de su `test` no se puede poner roja a propósito, y
 * entonces nadie sabe si detecta lo que dice detectar.
 */
function componentesSinNombrar(xml, vias = VIAS_DE_DESPERTAR) {
  const nombradas = new Set(vias.map((v) => `${v.tipo}:${v.clase}`));
  return componentesDelManifiesto(xml)
    .filter((c) => !nombradas.has(`${c.tipo}:${c.clase}`))
    .map(comoSeLlama);
}

/**
 * Quién atiende una acción en el manifiesto, receptor o servicio.
 *
 * **La unidad de neutralización es el filtro y no la clase**, y esto es lo que lo mide:
 * neutralizar solo el servicio de Expo deja al de Firebase resolviendo en su lugar por el
 * mismo filtro y con la misma prioridad relativa, así que la vía se cierra por la pareja o no
 * se cierra. `ServiceStarter.resolveServiceClassName` resuelve con `PackageManager.resolveService`
 * sobre `MESSAGING_EVENT` y solo entonces hace `setClassName` — leído sobre bytecode con `javap`.
 */
function quienAtiende(xml, accion) {
  return componentesDelManifiesto(xml)
    .filter((c) => c.acciones.includes(accion))
    .map((c) => `${c.clase} (${c.tipo})`);
}

/**
 * La actividad principal y el `activity-alias`, con las acciones que cada uno declara.
 *
 * Hace falta desde la fila 46: la razón de permisos de salud entra por **dos puertas** —el
 * filtro de la actividad para Android 13 y anteriores, y el alias de uso de permisos para
 * Android 14 en adelante— y lo que hay que poder afirmar es que las dos llevan al mismo
 * sitio. Analizador propio y no una librería, por lo de siempre: la batería corre sin
 * `node_modules`.
 */
function puertasDeLaActividad(xml) {
  const texto = sinComentarios(xml);
  const puertas = [];
  for (const etiqueta of ['activity', 'activity-alias']) {
    // `<activity\b` casa también con `<activity-alias`, así que la etiqueta se cierra con lo
    // que puede seguirla de verdad: espacio, salto o el propio `>`.
    const abre = new RegExp(`<${etiqueta}(?=[\\s>])`, 'g');
    let m;
    while ((m = abre.exec(texto)) !== null) {
      // Primero dónde acaba **la etiqueta de apertura**, y solo entonces si se cierra sola.
      // Buscar el primer `/>` desde el principio recortaría el bloque en el primer `<action …/>`
      // de dentro y dejaría el filtro sin sus acciones, que es justo lo que se viene a leer.
      const finCabecera = texto.indexOf('>', m.index);
      const cabecera = texto.slice(m.index, finCabecera + 1);
      const cierre = texto.indexOf(`</${etiqueta}>`, finCabecera);
      const hasta = cabecera.endsWith('/>') || cierre === -1 ? finCabecera + 1 : cierre + `</${etiqueta}>`.length;
      const bloque = texto.slice(m.index, hasta);
      puertas.push({
        etiqueta,
        clase: (cabecera.match(/android:name="([^"]+)"/) ?? [, '(sin nombre)'])[1],
        destino: (cabecera.match(/android:targetActivity="([^"]+)"/) ?? [, null])[1],
        acciones: [...bloque.matchAll(/<action[^>]*?android:name="([^"]+)"/gs)].map((a) => a[1]),
      });
    }
  }
  return puertas;
}

/** El `minSdkVersion` que declara el manifiesto fusionado, que es **el artefacto**. */
function minimoDeAndroid(xml) {
  const m = sinComentarios(xml).match(/<uses-sdk[^>]*?android:minSdkVersion="(\d+)"/s);
  return m ? Number(m[1]) : null;
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

// ── La guarda de la guarda, sobre manifiestos de ejemplo ────────────────────────
//
// Estos casos **sí se registran siempre**, y no contradicen la doctrina de arriba: no
// miran ningún artefacto, miran la lectura con la que se mira el artefacto. Que una
// comprobación detecte lo que dice detectar solo se sabe poniéndola roja a propósito, y eso
// se hace con un manifiesto escrito a mano — con el artefacto de verdad no se puede, porque
// el artefacto está bien.

/** Un manifiesto mínimo con un receptor y las acciones que se le quieran poner. */
function manifiestoDeEjemplo(clase, acciones, atributos = 'android:enabled="true" android:exported="false"') {
  const filtro = acciones.length
    ? `<intent-filter android:priority="-1">${acciones.map((a) => `<action android:name="${a}" />`).join('')}</intent-filter>`
    : '';
  return `<manifest><application><receiver android:name="${clase}" ${atributos}>${filtro}</receiver></application></manifest>`;
}

describe('La lectura del manifiesto detecta lo que dice detectar', () => {
  test('Un receptor que vuelve a declarar el arranque se señala con su clase y su acción', () => {
    // El día que `expo-notifications` renombre su receptor, el reemplazo del plugin escribirá
    // un fantasma y el real aparecerá con sus seis acciones. Eso se ve aquí y no en el
    // plugin, que escribe en el manifiesto de la app y ni siquiera ve la declaración de la
    // librería: por eso la detección tiene que estar medida.
    const ejemplo = manifiestoDeEjemplo(RECEPTOR_DE_AVISOS, [ACCION_DE_ENTREGA_DE_AVISOS, 'android.intent.action.BOOT_COMPLETED']);
    assert.deepEqual(receptoresQueDespiertan(ejemplo), [`${RECEPTOR_DE_AVISOS} ← android.intent.action.BOOT_COMPLETED`]);

    // Y las seis, una a una: una lista que se quedara con cinco pasaría igual de verde.
    for (const accion of ACCIONES_QUE_DESPIERTAN) {
      assert.deepEqual(
        receptoresQueDespiertan(manifiestoDeEjemplo('com.ejemplo.Receptor', [accion])),
        [`com.ejemplo.Receptor ← ${accion}`],
        `la lectura no señala "${accion}", que es una de las seis con las que el sistema despierta a una app cerrada`,
      );
    }
  });

  test('Un reemplazo del receptor de notificaciones que entrega de menos se pone rojo', () => {
    // **El caso que esta fila estrena.** Un receptor sin ninguna acción no escucha el
    // arranque, así que la guarda de arriba lo daría por bueno — y la app se quedaría sin
    // notificaciones. Las tres formas de entregar de menos van medidas.
    const sinFiltro = problemasDelReceptorDeAvisos(manifiestoDeEjemplo(RECEPTOR_DE_AVISOS, []));
    assert.deepEqual(receptoresQueDespiertan(manifiestoDeEjemplo(RECEPTOR_DE_AVISOS, [])), [], 'el ejemplo escucharía el arranque, y entonces no mediría lo que viene a medir');
    assert.equal(sinFiltro.length, 1, `un receptor de avisos sin ninguna acción tiene que dar un problema y ha dado ${sinFiltro.length}`);
    assert.match(sinFiltro[0], /no declara "expo\.modules\.notifications\.NOTIFICATION_EVENT"/);

    // Sobrarle acciones también, que es la regresión del otro lado.
    const conArranque = problemasDelReceptorDeAvisos(
      manifiestoDeEjemplo(RECEPTOR_DE_AVISOS, [ACCION_DE_ENTREGA_DE_AVISOS, 'android.intent.action.REBOOT']),
    );
    assert.equal(conArranque.length, 1);
    assert.match(conArranque[0], /declara acciones que el reemplazo no conserva/);

    // Y perder la forma: habilitado y sin exportar se escriben porque `tools:node="replace"`
    // sustituye la declaración entera y lo que no se escriba desaparece.
    const sinForma = problemasDelReceptorDeAvisos(manifiestoDeEjemplo(RECEPTOR_DE_AVISOS, [ACCION_DE_ENTREGA_DE_AVISOS], 'android:exported="true"'));
    assert.deepEqual(sinForma.map((p) => /habilitado|exportar/.test(p)), [true, true]);

    // Duplicado y ausente, que son las dos formas de que el reemplazo no haya sustituido nada.
    const dos = `<manifest><application>${manifiestoDeEjemplo(RECEPTOR_DE_AVISOS, [ACCION_DE_ENTREGA_DE_AVISOS])}${manifiestoDeEjemplo(RECEPTOR_DE_AVISOS, [ACCION_DE_ENTREGA_DE_AVISOS])}</application></manifest>`;
    assert.match(problemasDelReceptorDeAvisos(dos)[0], /hay 2 receptores/);
    assert.match(problemasDelReceptorDeAvisos(manifiestoDeEjemplo('com.ejemplo.Otro', []))[0], /hay 0 receptores/);

    // Y el manifiesto tal y como lo escribe el plugin: ningún problema. Es lo que separa
    // «la comprobación es exigente» de «la comprobación es imposible de cumplir».
    assert.deepEqual(problemasDelReceptorDeAvisos(manifiestoDeEjemplo(RECEPTOR_DE_AVISOS, [ACCION_DE_ENTREGA_DE_AVISOS])), []);
  });

  test('La guarda de arranque sigue afirmando las seis acciones sobre todos los receptores', () => {
    // Una guarda que nació roja y hoy está verde es justo la que más fácil se ablanda: basta
    // una lista de tolerados, una excepción por clase o un `skip` para que siga en verde sin
    // afirmar nada. Esto lo lee de su propio código, que es donde se ablandaría.
    assert.deepEqual([...ACCIONES_QUE_DESPIERTAN], [
      'android.intent.action.BOOT_COMPLETED',
      'android.intent.action.REBOOT',
      'android.intent.action.QUICKBOOT_POWERON',
      'com.htc.intent.action.QUICKBOOT_POWERON',
      'android.intent.action.MY_PACKAGE_REPLACED',
      'android.intent.action.LOCKED_BOOT_COMPLETED',
    ], 'la lista de acciones que despiertan ya no es la de las seis: quitarle una es dejar de mirar por esa puerta');

    const propia = readFileSync(join(RAIZ_REPO, 'test', 'nucleo', 'manifiesto-generado.test.mjs'), 'utf8');
    // Sin comentarios: este fichero explica el defecto con nombre y apellidos, y buscar la
    // clase del receptor en la explicación convertiría el relato en un fallo.
    const codigo = propia.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    // Se busca la **declaración entera** y no el nombre suelto: el nombre suelto aparece
    // también aquí dentro, en esta misma línea, y entonces esto se leería a sí mismo.
    const encabezado = "\n    test('Nada de esta app se despierta al arrancar el móvil', () => {";
    const desde = codigo.indexOf(encabezado);
    assert.notEqual(desde, -1, 'la guarda de arranque ha cambiado de nombre o de sitio: el nombre del caso es lo que la cruza con la batería');
    const cuerpo = codigo.slice(desde, codigo.indexOf('\n    test(', desde + 1));

    assert.match(cuerpo, /receptoresQueDespiertan\(XML_ANDROID\)/, 'la guarda de arranque ya no lee todos los receptores del manifiesto fusionado');
    assert.match(cuerpo, /deepEqual\(\s*receptoresQueDespiertan\(XML_ANDROID\),\s*\[\],/, 'la guarda de arranque ya no exige que la lista de despertadores esté vacía');
    assert.doesNotMatch(cuerpo, /skip/, 'la guarda de arranque se ha saltado con un skip');
    assert.doesNotMatch(cuerpo, /expo\.modules|NotificationsService|TaskBroadcastReceiver/, 'la guarda de arranque nombra una clase en su código: una excepción por clase es una lista de tolerados con otro nombre');
    // Y el nombre de una lista de tolerados, sobre el código **sin las cadenas**: el mensaje
    // de fallo dice en prosa que no se añade nada a ninguna lista de tolerados, y buscar la
    // palabra sobre el texto entero convertiría esa frase en el fallo que viene a evitar.
    const sinCadenas = cuerpo.replace(/'(?:[^'\\]|\\.)*'/g, "''");
    assert.doesNotMatch(sinCadenas, /tolerad|salvo|excepto/i, 'la guarda de arranque admite excepciones');
  });
});

// ── La lista cerrada de vías de despertar, y la lectura que la contrasta ────────
//
// Estos casos **se registran siempre**: no miran ningún artefacto, miran la lista declarada
// en producción y la lectura con la que se mira el artefacto. En un clon sin compilar son lo
// único que puede afirmarse de esta propiedad, y en uno compilado son lo que dice que el
// contraste de abajo detecta lo que dice detectar.

/** Un componente de ejemplo, con la etiqueta, los atributos y las acciones que se le pongan. */
function componenteDeEjemplo(etiqueta, clase, acciones = [], atributos = 'android:exported="false"') {
  const filtro = acciones.length
    ? `<intent-filter android:priority="-1">${acciones.map((a) => `<action android:name="${a}" />`).join('')}</intent-filter>`
    : '';
  return `<${etiqueta} android:name="${clase}" ${atributos}>${filtro}</${etiqueta}>`;
}

/** Un manifiesto mínimo con los componentes que se le pasen. */
function manifiestoConComponentes(...componentes) {
  return `<manifest><application>${componentes.join('')}</application></manifest>`;
}

describe('Las vías por las que el sistema puede despertar esta app están enumeradas una a una', () => {
  test('La lista de vías de despertar nombra cada una con su mecanismo y su motivo', () => {
    // Lo que separa una lista cerrada de una lista de tolerados es que sus motivos se puedan
    // distinguir de excusas. Cada entrada dice clase, tipo, cómo se la descubre, quién la
    // declara, si su mecanismo está **medido o solo declarado** y por qué está — y si puede
    // levantar el proceso o no, que es el juicio que se escribe donde vive el dato.
    assert.ok(VIAS_DE_DESPERTAR.length > 0, 'la lista de vías de despertar está vacía: así no podría ponerse roja nunca');
    for (const via of VIAS_DE_DESPERTAR) {
      assert.ok(via.clase && via.clase.includes('.'), `una vía se declara sin clase: ${JSON.stringify(via)}`);
      assert.ok(['receptor', 'servicio'].includes(via.tipo), `la vía "${via.clase}" declara el tipo "${via.tipo}" y los dos que el sistema alcanza son receptor y servicio`);
      assert.ok(via.descubrimiento, `la vía "${via.clase}" no dice cómo se la descubre`);
      assert.ok(via.quienLaDeclara, `la vía "${via.clase}" no dice quién la declara`);
      assert.ok(['medido', 'declarado'].includes(via.mecanismo), `la vía "${via.clase}" declara el mecanismo "${via.mecanismo}" y solo hay dos: medido o declarado`);
      assert.equal(typeof via.puedeDespertar, 'boolean', `la vía "${via.clase}" no dice si puede levantar el proceso`);
      assert.ok(via.porque && via.porque.length >= 60, `la vía "${via.clase}" no explica por qué está: son ${via.porque?.length ?? 0} caracteres`);
      assert.equal(Object.isFrozen(via), true, `la vía "${via.clase}" se puede cambiar en caliente, y entonces la lista no es cerrada`);
    }
    const clases = VIAS_DE_DESPERTAR.map((v) => `${v.tipo}:${v.clase}`);
    assert.equal(new Set(clases).size, clases.length, 'la lista repite una vía, y un nombre repetido esconde una que falta');

    // **Y las declaradas sin medir se cuentan con el número delante**, en vez de disolverse
    // en una frase: nombrar un adyacente no es aprobarlo, es dejarlo contado para que la fila
    // que lo mida lo pueda quitar de la cuenta. De las diez de hoy, tres están medidas.
    assert.equal(VIAS_DE_DESPERTAR.length, 10, `la lista tiene ${VIAS_DE_DESPERTAR.length} vías y las contadas son 10: crecer o menguar es un acto con registro`);
    assert.equal(
      viasSinMecanismoMedido().length,
      7,
      `hay ${viasSinMecanismoMedido().length} vías con el mecanismo declarado y sin medir, y las contadas son 7. ` +
      'Bajar el número es la buena noticia y se hace con la medida delante; subirlo, también, pero se dice.',
    );
    for (const via of viasSinMecanismoMedido()) {
      // El énfasis en negrita se quita antes de mirar: estos motivos llevan `**no**` dentro y
      // buscar la frase sobre el texto crudo la partiría por la mitad.
      assert.match(
        via.porque.replace(/\*/g, ''),
        /[Ss]in medir|no est[aá] medido|no se ha (comprobado|le[ií]do|hecho)/,
        `la vía "${via.clase}" está sin medir y no lo dice en su motivo. Una lista cerrada cuyos motivos no se distinguen de excusas es una lista de tolerados con otro nombre.`,
      );
    }

    // Los tres adyacentes que la fila 53 obligó a nombrar están, cada uno con su motivo: si
    // salen de la lista, vuelve a abrirse el agujero que esta fila cierra.
    for (const clase of [
      'androidx.health.platform.client.impl.sdkservice.HealthDataSdkService',
      'androidx.profileinstaller.ProfileInstallReceiver',
      'com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService',
    ]) {
      assert.ok(VIAS_DE_DESPERTAR.some((v) => v.clase === clase), `"${clase}" ha salido de la lista de vías sin que nadie lo mida`);
    }

    // Y la lista **no admite excepciones ni tolerados**: todo lo que está, está explicado.
    const fuente = readFileSync(join(RAIZ_REPO, 'app', 'plataforma', 'permisos.js'), 'utf8');
    const declaracion = fuente.slice(fuente.indexOf('export const VIAS_DE_DESPERTAR'), fuente.indexOf('export const VIAS_NEUTRALIZADAS'));
    const sinCadenasNiComentarios = declaracion.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    assert.doesNotMatch(sinCadenasNiComentarios, /tolerad|salvo|excepto|skip/i, 'la lista de vías admite excepciones');
  });

  test('Las tres piezas de FCM se declaran retiradas y la pareja se cierra entera', () => {
    // La marca de retirada que el plugin escribe **empareja por `android:name`**, así que un
    // nombre mal escrito no falla: no hace nada. Por eso las clases viven también aquí, en
    // producción, y por eso el contraste con el manifiesto fusionado es lo que lo detecta.
    assert.equal(VIAS_NEUTRALIZADAS.length, 3, `se declaran ${VIAS_NEUTRALIZADAS.length} piezas retiradas y son tres: el receptor de c2dm y los dos servicios de mensajería`);
    for (const via of VIAS_NEUTRALIZADAS) {
      assert.ok(['receptor', 'servicio'].includes(via.tipo));
      assert.ok(['directa', 'indirecta'].includes(via.evidencia), `la pieza "${via.clase}" no dice si la evidencia de su descubrimiento es directa o indirecta`);
      assert.ok(via.porque && via.porque.length >= 60, `la pieza "${via.clase}" no explica por qué se retira`);
    }
    // **Los dos servicios comparten el filtro**, que es lo que obliga a cerrar la pareja.
    const porElFiltro = VIAS_NEUTRALIZADAS.filter((v) => v.filtro === FILTRO_DE_MENSAJERIA);
    assert.deepEqual(
      porElFiltro.map((v) => v.clase).sort(),
      ['com.google.firebase.messaging.FirebaseMessagingService', 'expo.modules.notifications.service.ExpoFirebaseMessagingService'],
      'los dos servicios que declaran el filtro de mensajería no están los dos retirados: cerrar solo uno deja al otro resolviendo en su lugar',
    );
    assert.ok(VIAS_NEUTRALIZADAS.some((v) => v.filtro === FILTRO_DE_C2DM), 'el receptor de c2dm no está entre las piezas retiradas');
    // Y ninguna de las tres está a la vez en la lista de vías vivas: retirada y viva a la vez
    // sería una contradicción que nadie leería.
    const enLasDos = VIAS_NEUTRALIZADAS.filter((n) => VIAS_DE_DESPERTAR.some((v) => v.clase === n.clase));
    assert.deepEqual(enLasDos.map((v) => v.clase), [], 'una pieza retirada aparece también como vía viva');
  });

  test('Un servicio exportado con filtro que la lista no nombra se señala con su clase y su filtro', () => {
    // **El caso que esta fila estrena, y el que dice que el barrido ya no se salta los
    // servicios.** Con el artefacto de verdad no se puede medir, porque el artefacto está
    // bien: se mide con un manifiesto escrito a mano.
    const ejemplo = manifiestoConComponentes(
      componenteDeEjemplo('service', 'com.ejemplo.ServicioNuevo', ['com.ejemplo.BIND'], 'android:exported="true"'),
    );
    assert.deepEqual(componentesSinNombrar(ejemplo), ['com.ejemplo.ServicioNuevo (servicio) ← com.ejemplo.BIND']);

    // Un receptor nuevo también, que es la puerta que ya se miraba; y los dos a la vez.
    const conReceptor = manifiestoConComponentes(
      componenteDeEjemplo('receiver', 'com.ejemplo.ReceptorNuevo', ['com.ejemplo.ALGO'], 'android:exported="true"'),
      componenteDeEjemplo('service', 'com.ejemplo.ServicioNuevo'),
    );
    assert.deepEqual(componentesSinNombrar(conReceptor), [
      'com.ejemplo.ReceptorNuevo (receptor) ← com.ejemplo.ALGO',
      'com.ejemplo.ServicioNuevo (servicio)',
    ]);

    // Y uno que **sí** está nombrado no se señala: es lo que separa «la comprobación es
    // exigente» de «la comprobación es imposible de cumplir».
    const nombrado = VIAS_DE_DESPERTAR.find((v) => v.tipo === 'servicio');
    assert.deepEqual(componentesSinNombrar(manifiestoConComponentes(componenteDeEjemplo('service', nombrado.clase))), []);
    // Y la lectura no se conforma con la clase: un receptor con el nombre de un servicio
    // declarado sigue sin estar nombrado, porque el tipo es parte de la vía.
    assert.deepEqual(componentesSinNombrar(manifiestoConComponentes(componenteDeEjemplo('receiver', nombrado.clase))), [`${nombrado.clase} (receptor)`]);
  });

  test('Un manifiesto con solo el servicio de Expo neutralizado se pone rojo', () => {
    // **La vía se cierra por la pareja y no por la pieza.** Los dos servicios se descubren
    // por acción sobre el mismo filtro, así que retirar solo el de Expo —prioridad −1— deja
    // al de Firebase —prioridad −500— resolviendo en su lugar. Este ejemplo es exactamente
    // ese arreglo a medias, y tiene que salir rojo nombrando quién se queda atendiendo.
    const aMedias = manifiestoConComponentes(
      componenteDeEjemplo('service', 'com.google.firebase.messaging.FirebaseMessagingService', [FILTRO_DE_MENSAJERIA], 'android:exported="false"'),
    );
    assert.deepEqual(
      quienAtiende(aMedias, FILTRO_DE_MENSAJERIA),
      ['com.google.firebase.messaging.FirebaseMessagingService (servicio)'],
      'la lectura no ve quién sigue atendiendo el filtro de mensajería con el servicio de Expo ya retirado',
    );
    // Y ese servicio, además, no está nombrado en la lista de vías vivas: las dos guardas se
    // ponen rojas por el mismo manifiesto, y cada una por su motivo.
    assert.deepEqual(componentesSinNombrar(aMedias), ['com.google.firebase.messaging.FirebaseMessagingService (servicio) ← com.google.firebase.MESSAGING_EVENT']);

    // Con la pareja cerrada entera no queda nadie atendiendo, que es la forma que se entrega.
    assert.deepEqual(quienAtiende(manifiestoConComponentes(componenteDeEjemplo('service', 'com.ejemplo.Otro')), FILTRO_DE_MENSAJERIA), []);
    // Y el receptor de c2dm por su lado: mientras exista alguien con ese filtro, un mensaje
    // de push levanta el proceso.
    const conC2dm = manifiestoConComponentes(
      componenteDeEjemplo('receiver', 'com.google.firebase.iid.FirebaseInstanceIdReceiver', [FILTRO_DE_C2DM], 'android:exported="true"'),
    );
    assert.deepEqual(quienAtiende(conC2dm, FILTRO_DE_C2DM), ['com.google.firebase.iid.FirebaseInstanceIdReceiver (receptor)']);
  });

  test('La lectura de vías enumera los servicios y no solo los receptores', () => {
    // La regresión que esta fila viene a impedir, y que se ablandaría sola: bastaría con que
    // el barrido volviera a mirar solo `<receiver>` para que un servicio con filtro pasara
    // en verde sin que nadie hubiera decidido nada. Se afirma sobre la lectura, midiendo un
    // manifiesto donde **lo único que hay es un servicio**.
    const soloServicio = manifiestoConComponentes(componenteDeEjemplo('service', 'com.ejemplo.SoloServicio', ['com.ejemplo.BIND']));
    assert.equal(componentesDelManifiesto(soloServicio).length, 1, 'la lectura no ve un manifiesto que solo tiene un servicio');
    assert.equal(componentesDelManifiesto(soloServicio)[0].tipo, 'servicio');
    assert.deepEqual(receptoresQueDespiertan(soloServicio), [], 'la guarda de arranque ve el servicio, y entonces este caso no mide la diferencia entre las dos');
    assert.equal(componentesSinNombrar(soloServicio).length, 1, 'el servicio sin nombrar no se señala');

    // Y las dos etiquetas conviven: un manifiesto con receptor y servicio da los dos, con su
    // tipo y sus atributos leídos de **la cabecera** y no del bloque entero.
    const mixto = manifiestoConComponentes(
      componenteDeEjemplo('receiver', 'com.ejemplo.R', [], 'android:enabled="true" android:exported="false"'),
      componenteDeEjemplo('service', 'com.ejemplo.S', [], 'android:exported="true" android:permission="android.permission.BIND_JOB_SERVICE"'),
    );
    const leidos = componentesDelManifiesto(mixto);
    assert.deepEqual(leidos.map((c) => `${c.tipo}:${c.clase}`), ['receptor:com.ejemplo.R', 'servicio:com.ejemplo.S']);
    assert.equal(leidos[0].habilitado, 'true');
    assert.equal(leidos[1].exportado, 'true');
    assert.equal(leidos[1].permiso, 'android.permission.BIND_JOB_SERVICE');
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
        // `android` es **uno o varios** desde SPEC-046-iter-1: los de Health Connect son dos
        // y se conceden por tipo de dato. Sin normalizar, la lista se metía una cadena con
        // los dos pegados y la lista blanca dejaba de blanquear los que sí pide la app; lo
        // tapaba que `app.json` los enumere también, que es tapar una guarda con otra.
        ...PERMISOS_QUE_SE_PIDEN.flatMap((p) => [].concat(p.android ?? []).map(conPrefijo)),
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
      // **Esta guarda nació roja en la fila 48, y SPEC-052 la puso verde por donde se cierra
      // de verdad.** El receptor `NotificationsService` de `expo-notifications` escuchaba
      // `BOOT_COMPLETED`, `REBOOT`, los dos `QUICKBOOT_POWERON` y `MY_PACKAGE_REPLACED` en
      // el manifiesto fusionado **desde SPEC-023**, y se trató como en la fila 47 la guarda
      // de la partida sin cablear: roja a propósito, con nombre, sin excepción, sin lista de
      // tolerados y sin `skip`, hasta que la fila que montara las notificaciones lo cerrara.
      // La fila 52 lo cerró sustituyendo su declaración con `tools:node="replace"` sin las
      // cinco acciones de arranque.
      //
      // **Lo que la fila 52 no hizo fue ablandar esto**, y es lo que hay que seguir sin
      // hacer: la exigencia es la misma que cuando estaba roja —las seis acciones sobre
      // **todos** los receptores, sin excepción por clase—, y quien venga a dejarla verde
      // por otro camino tiene que enfrentarse a ella. La guarda de al lado
      // (`La guarda de arranque sigue afirmando las seis acciones…`) afirma justo eso sobre
      // este código.
      //
      // El permiso a solas es inerte; lo que despierta es el receptor, y por eso lo que se
      // afirma es el receptor. Los dos que declaraban acciones de arranque están
      // neutralizados en `app/plugins/retira-permisos-prohibidos.js`: el de
      // `expo-task-manager` sin `intent-filter`, y el de `expo-notifications` con un filtro
      // de una sola acción, la de entrega — que un reemplazo mudo pasaría este caso es
      // justamente por lo que existe «El receptor de notificaciones conserva su acción de
      // entrega y ninguna más».
      assert.deepEqual(
        receptoresQueDespiertan(XML_ANDROID),
        [],
        'hay receptores en el APK a los que el sistema despierta con la app cerrada. Los dos conocidos vienen de ' +
        '`expo-task-manager` y de `expo-notifications` y se neutralizan en `app/plugins/retira-permisos-prohibidos.js` ' +
        'sustituyendo su declaración con `tools:node="replace"`. Si aparece uno nuevo, es de una librería que nadie ha mirado: ' +
        'no se añade a ninguna lista de tolerados, se neutraliza igual.',
      );
    });

    test('Nada de esta app se despierta con la app cerrada, y la lista de vías lo enumera', () => {
      // **La propiedad ancha, por fin comprobada entera.** Hasta SPEC-053 esto se afirmaba
      // de boca —`permisos.js` lo promete desde SPEC-030— y lo que se medía era la estrecha
      // y solo sobre receptores. Aquí se enumeran **todos** los receptores y **todos** los
      // servicios del manifiesto fusionado y se contrastan contra la lista cerrada.
      //
      // Las dos direcciones son rojo, igual que con el arrastre de permisos: uno que aparezca
      // sin estar nombrado —es de una librería que nadie ha mirado, y se mira— y uno de la
      // lista que ya no aparezca —bajar el número es la buena noticia y también es un acto—.
      const sinNombrar = componentesSinNombrar(XML_ANDROID);
      assert.deepEqual(
        sinNombrar,
        [],
        `estos componentes del manifiesto fusionado pueden ser alcanzados por el sistema y nadie los ha nombrado: ${sinNombrar.join(' · ')}. ` +
        'Se miran uno a uno y se añaden a VIAS_DE_DESPERTAR en `app/plataforma/permisos.js`, con su tipo, su filtro, quién los declara, ' +
        'si su mecanismo está medido y por qué están. No se añade nada a ninguna lista de tolerados.',
      );

      const enElManifiesto = new Set(componentesDelManifiesto(XML_ANDROID).map((c) => `${c.tipo}:${c.clase}`));
      const yaNoEstan = VIAS_DE_DESPERTAR.filter((v) => !enElManifiesto.has(`${v.tipo}:${v.clase}`)).map((v) => v.clase);
      assert.deepEqual(
        yaNoEstan,
        [],
        `estas vías están declaradas y ya no aparecen en el manifiesto fusionado: ${yaNoEstan.join(', ')}. ` +
        'Bajar el número es la buena noticia: se quitan de la lista a mano.',
      );
    });

    test('Las tres piezas de FCM no llegan al manifiesto fusionado, y la pareja queda cerrada', () => {
      // La marca de retirada empareja por `android:name`, así que un nombre mal escrito **no
      // falla: no hace nada**, y eso solo se ve aquí. Las tres tienen que haber desaparecido.
      const clases = new Set(componentesDelManifiesto(XML_ANDROID).map((c) => c.clase));
      const vivas = VIAS_NEUTRALIZADAS.filter((v) => clases.has(v.clase)).map((v) => v.clase);
      assert.deepEqual(
        vivas,
        [],
        `estas piezas se declaran retiradas en VIAS_NEUTRALIZADAS y siguen en el manifiesto fusionado: ${vivas.join(', ')}. ` +
        'La retirada se escribe con `tools:node="remove"` en `app/plugins/retira-permisos-prohibidos.js` y empareja por el nombre exacto de la clase.',
      );

      // Y **por el filtro, que es la unidad de neutralización**: mientras alguien atienda
      // `MESSAGING_EVENT` la vía sigue abierta, sea quien sea la clase que lo haga. Es lo
      // que hace que cerrar solo el servicio de Expo no valga.
      assert.deepEqual(
        quienAtiende(XML_ANDROID, FILTRO_DE_MENSAJERIA),
        [],
        'alguien sigue atendiendo el filtro de mensajería de Firebase: la vía se cierra por la pareja y no por la pieza',
      );
      assert.deepEqual(
        quienAtiende(XML_ANDROID, FILTRO_DE_C2DM),
        [],
        'alguien sigue atendiendo el mensaje de c2dm, que es la puerta por la que un push levanta el proceso',
      );
    });

    test('El receptor de notificaciones conserva su acción de entrega y ninguna más', () => {
      // La otra mitad de la fila 52, y la que impide que el arreglo se pase de frenada: el
      // reemplazo que se le escribe a `expo-notifications` **sustituye la declaración
      // entera**, así que lo que no se copie desaparece del binario. Perder la acción de
      // entrega dejaría la app compilando, esta guarda y la de arriba en verde, y ninguna
      // notificación funcionando — `doWork` sin receptor encontrado escribe «No service
      // capable of handling notifications found» y no entrega nada.
      assert.deepEqual(
        problemasDelReceptorDeAvisos(XML_ANDROID),
        [],
        'el reemplazo del receptor de notificaciones no tiene la forma decidida en SPEC-052: un filtro con una sola acción, ' +
        'la de entrega, habilitado y sin exportar.',
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
      // Y desde SPEC-052 son **dos**: el a-cambio que sostiene este permiso ya no es el
      // receptor de tareas a solas, porque quien inyecta el permiso es precisamente
      // `expo-notifications`. Un a-cambio que solo nombrara uno estaría admitiendo el
      // permiso por media promesa.
      assert.match(impuesto.aCambio, /los dos receptores/, 'el a-cambio no dice que sean dos los receptores neutralizados, y desde SPEC-052 lo son');
      assert.match(impuesto.aCambio, /notificaciones/, 'el a-cambio no nombra el receptor de notificaciones, que es el que inyecta este permiso y el que escuchaba el arranque desde SPEC-023');
      // Y desde SPEC-053 el a-cambio cierra en **la propiedad ancha**, que es la que este
      // fichero promete desde el principio: no solo «nada se despierta al arrancar el móvil»
      // sino «nada de esta app se despierta con la app cerrada». Un a-cambio que cerrara en
      // la estrecha estaría admitiendo el permiso por media promesa otra vez.
      assert.match(impuesto.aCambio, /con la app cerrada/, 'el a-cambio sigue cerrando en la propiedad estrecha, y lo que permisos.js promete es la ancha');
      assert.match(impuesto.aCambio, /FCM|push/i, 'el a-cambio no nombra las tres piezas de FCM que esta fila retira');

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

    test('El manifiesto no declara ningún permiso de salud fuera de los dos', () => {
      // Bloqueante (`@privacidad`, RF-PRIV-003), y sobre el APK y no sobre `app.json`: el
      // plugin de `react-native-health-connect` puede añadir permisos de salud por su cuenta
      // y en el fichero de entrada no se verían.
      const permisos = permisosDelManifiesto(XML_ANDROID);
      const deSalud = permisos.filter((p) => p.includes('.health.'));
      assert.deepEqual(
        deSalud,
        PERMISOS_DE_SALUD.map((p) => p.permiso),
        `el APK pide permisos de salud que no son los dos declarados: ${deSalud.join(', ')}. ` +
        'Los dos que se piden son el de distancia, que alimenta los metros, y el de pasos, que es la caída cuando la fuente no tiene distancia.',
      );

      // Y **el que se retiró**: `ACTIVITY_RECOGNITION` estuvo declarado hasta esta fila y no
      // es el permiso de Health Connect — es el del reconocimiento de actividad del sistema,
      // la vía de Google Fit y de los sensores en crudo—. Un permiso peligroso que se pide y
      // no se usa es rojo, y comprobarlo sobre el fusionado es la única forma de saber que
      // ninguna librería lo reintroduce.
      assert.equal(permisos.includes('android.permission.ACTIVITY_RECOGNITION'), false, 'el APK pide ACTIVITY_RECOGNITION, que no es de Health Connect y que esta app no usa');

      // Nada de lo que Health Connect añade al manifiesto es un permiso ni un receptor: la
      // comprobación de disponibilidad necesita un bloque `<queries>` y el aviso de la razón
      // necesita un destino, y ninguno de los dos despierta nada.
      assert.match(sinComentarios(XML_ANDROID), /<queries>/, 'no hay bloque <queries>: la comprobación de si la app de salud está instalada no podría responder');
    });

    test('Las dos puertas de la razón de permisos llevan a la actividad principal', () => {
      // Son la misma pregunta vista desde dos versiones de Android, y las dos tienen que
      // aterrizar en la actividad principal. Traducir una sola daría verde en un emulador que
      // fuerce la acción vieja y rojo en cualquier móvil moderno.
      const puertas = puertasDeLaActividad(XML_ANDROID);
      const principal = puertas.find((p) => p.etiqueta === 'activity' && /MainActivity$/.test(p.clase));
      assert.ok(principal, 'el manifiesto fusionado no declara la actividad principal');
      assert.equal(
        principal.acciones.includes('androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'),
        true,
        'la actividad principal no declara el filtro de la razón de permisos de salud: en Android 13 y anteriores el sistema no tendría a dónde preguntar',
      );

      const alias = puertas.find((p) => p.etiqueta === 'activity-alias' && p.acciones.includes('android.intent.action.VIEW_PERMISSION_USAGE'));
      assert.ok(alias, 'no hay activity-alias con la acción de uso de permisos: en Android 14 en adelante el sistema no tendría a dónde preguntar');
      assert.equal(alias.destino, principal.clase, 'el alias de uso de permisos no apunta a la actividad principal, que es la que traduce el intento');
      // Y la app sigue teniendo el esquema por el que viaja el enlace traducido: sin él, el
      // plugin reescribiría el intento a una URL que nadie sabe abrir.
      assert.match(sinComentarios(XML_ANDROID), /android:scheme="walkingadventure"/, 'el manifiesto no declara el esquema por el que viaja el enlace de la razón de permisos');
    });

    test('El suelo de aparatos que la fuente de salud exige está en el artefacto', () => {
      // **Sobre el artefacto y no sobre la intención**: leer el plugin y darlo por bueno no
      // vale, porque la cadena que lleva de `gradle.properties` al `uses-sdk` pasa por el
      // catálogo de versiones de Expo y una palanca equivocada se descubre después de una
      // compilación entera.
      assert.equal(
        minimoDeAndroid(XML_ANDROID),
        26,
        'el mínimo de Android del manifiesto fusionado no es 26, que es el que exige androidx.health.connect. Con 24 la fusión de manifiestos falla y no hay APK.',
      );
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

    test('El Info.plist generado no declara ninguna clave de uso de salud', () => {
      // La otra mitad de «El manifiesto no declara ningún permiso de salud fuera de los dos»,
      // y va aquí porque el bloque de iOS solo se registra si hay `Info.plist`: el criterio se
      // cubre con dos casos a propósito, uno por artefacto.
      //
      // `NSHealthShareUsageDescription` estuvo en `app.json` hasta la fila 46 y salió por
      // decisión del dueño: mientras iOS no tenga fuente es una cadena de uso sin uso, y
      // dejarle a esta guarda un falso positivo consentido justo en la plataforma que estrena
      // mirada sería socavarla el mismo día que empieza a servir. Vuelve el día que alguien
      // monte HealthKit, y ese día pasa por las reglas de lenguaje.
      const deSalud = Object.keys(PLIST).filter((c) => /Health/i.test(c));
      assert.deepEqual(deSalud, [], `el Info.plist generado declara claves de salud y iOS no tiene fuente: ${deSalud.join(', ')}`);
      // Y la de escritura sigue sin declararse nunca, ni cuando la haya: esta app no escribe
      // en la app de salud del sistema.
      assert.equal('NSHealthUpdateUsageDescription' in PLIST, false, 'el Info.plist declara el permiso de escritura de salud, que no se declara nunca');
    });

    test('No hay ninguna tarea de fondo programada en iOS', () => {
      // `TAREAS_PERIODICAS` está vacía, y en iOS la manera de tener una sin que se note es
      // `BGTaskSchedulerPermittedIdentifiers`. Se afirma la ausencia de la clave entera:
      // una lista vacía tampoco vale, porque declararla es el paso previo a llenarla.
      assert.equal('BGTaskSchedulerPermittedIdentifiers' in PLIST, false, 'el Info.plist generado declara identificadores de tarea de fondo');
    });
  });
}
