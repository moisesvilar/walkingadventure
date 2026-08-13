// Limpia de lo **generado** lo que esta app no declara y que llega por las librerías.
//
// Existe por un agujero medido en SPEC-048: lo que va al binario no es `app.json`, es el
// manifiesto fusionado y el `Info.plist` generado, y ahí entran permisos, receptores y
// modos de fondo que nadie de esta app ha escrito. Todas las guardas de
// `app/plataforma/permisos.js` miraban `app.json`, así que por esa puerta no se veía nada.
//
// Hace cinco cosas:
//
// 1. **Retira los permisos prohibidos de Android** con `tools:node="remove"`, que es la
//    única forma de que la fusión los respete. Hoy ninguna de las librerías inyecta los
//    dos; la retirada va igual, porque una defensa que solo existe cuando ya te han
//    entrado no es una defensa.
// 2. **Deja los modos de fondo de iOS en los declarados, por lista blanca.** Es lo que
//    esta fila metió sin verlo: el plugin de `expo-task-manager` empuja `fetch` en
//    `UIBackgroundModes` **incondicionalmente**
//    (`node_modules/expo-task-manager/plugin/build/withTaskManager.js:8-14`), y `fetch` es
//    tarea periódica con otro nombre — lo dice el comentario de `MODOS_DE_FONDO`, que es
//    la lista que esto respeta—. Va por lista blanca y no por lista de prohibidos a
//    propósito: el día que otra librería empuje `processing` o `remote-notification`, se
//    cae sola sin que nadie tenga que acordarse de añadirla.
// 3. **Sustituye el receptor de `expo-task-manager` por uno sin disparadores de arranque.**
//    La librería lo declara escuchando `BOOT_COMPLETED` y `MY_PACKAGE_REPLACED`, y eso es
//    que el sistema despierte a la app con la app cerrada. Las posiciones se le entregan
//    con un intent **explícito** —`TaskManagerUtils.java:180` lo construye con la clase, no
//    con la acción—, así que quitarle el filtro entero no le quita nada de lo que esta app
//    usa. Medido y comprobado en el emulador el 11-ago-2026.
// 4. **Sustituye el receptor de `expo-notifications` por uno que solo conserva su acción de
//    entrega.** La librería lo declara con seis acciones en el mismo filtro
//    (`node_modules/expo-notifications/android/src/main/AndroidManifest.xml`): la de entrega
//    y las cinco de arranque —`BOOT_COMPLETED`, `REBOOT`, los dos `QUICKBOOT_POWERON` y
//    `MY_PACKAGE_REPLACED`—. El reemplazo se queda con la primera y pierde las cinco.
//
//    **Y aquí no vale el molde del punto 3, por una diferencia medida.** Al receptor de
//    tareas se le pudo quitar el filtro entero porque se le entrega por clase; a este se le
//    descubre **por la acción de su filtro**: `NotificationsService.kt:403-406`
//    (`findDesignatedBroadcastReceiver`) busca con
//    `queryBroadcastReceivers(Intent(intent.action).setPackage(context.packageName))`, y
//    `doWork` (`:386-393`) sin receptor encontrado escribe «No service capable of handling
//    notifications found» y no entrega nada. Un reemplazo sin `intent-filter` dejaría la app
//    compilando, verde en la guarda de arranque y **sin ninguna notificación funcionando**.
//
// 5. **Retira enteras las tres piezas de FCM**, que son las que quedaban capaces de levantar
//    este proceso por un mensaje de push: el receptor de c2dm
//    (`com.google.firebase.iid.FirebaseInstanceIdReceiver`) y **los dos** servicios que
//    declaran el filtro `com.google.firebase.MESSAGING_EVENT` — el de Firebase y el de Expo—.
//    Las tres llegan con el AAR de `firebase-messaging`, que arrastra
//    `node_modules/expo-notifications/android/build.gradle:43`, y el de Expo lo declara además
//    `node_modules/expo-notifications/android/src/main/AndroidManifest.xml:6-12`.
//
//    **Se cierra la pareja y no la pieza**, que es el criterio: los dos servicios se descubren
//    **por acción** —`ServiceStarter.resolveServiceClassName` resuelve con
//    `PackageManager.resolveService` sobre `MESSAGING_EVENT` y solo entonces hace
//    `setClassName`, leído sobre bytecode con `javap`—, así que neutralizar solo el de Expo
//    (prioridad −1) deja al de Firebase (prioridad −500) resolviendo en su lugar por el mismo
//    filtro. Del receptor de c2dm la evidencia de descubrimiento por acción es **indirecta** y
//    va etiquetada así: nadie del lado app escribe su nombre, pero el emisor vive en Play
//    Services y no se ha leído.
//
//    **Aquí no vale el molde del punto 4, y por la razón contraria a la de allí.** En SPEC-052
//    la acción estaba **en uso** —la entrega de avisos— y quitarle el filtro habría dejado la
//    app muda en silencio; aquí **la acción no la usa nadie**, medido en tres direcciones: no
//    hay `google-services.json` en ningún sitio del árbol, no hay `googleServicesFile` en
//    `app.json`, y no hay una sola llamada a `getExpoPushTokenAsync` ni a
//    `getDevicePushTokenAsync`. Por eso se quita el bloque entero con `tools:node="remove"` en
//    vez de sustituirlo conservando el filtro: quitar el bloque cierra a la vez el
//    descubrimiento por acción y el descubrimiento por clase, y es lo que hace que la
//    evidencia indirecta del receptor de c2dm no decida la forma.
//
//    **Cómo vuelven, el día que el producto adopte push.** Las tres se declaran otra vez, y no
//    con un ajuste de configuración nativa: hace falta el fichero de servicios de Firebase
//    declarado en `app.json`, el token pedido **explícitamente** desde el código de la app, y
//    la vía nombrada en `VIAS_DE_DESPERTAR` de `app/plataforma/permisos.js` con su motivo. Eso
//    es **una decisión de producto con su propia fila**, no un descuido que haya que deshacer
//    aquí. Quien lea esto dentro de un año: las piezas no se cayeron solas ni las quitó una
//    limpieza; se quitaron porque estaban instaladas y muertas, y volver a ponerlas es abrir
//    una vía por la que el sistema puede levantar la app con la app cerrada.
//
// **Lo que esto cierra y lo que no, dicho con precisión**, porque un comentario que promete
// más de lo que entrega es la forma de fallo de este repo escrita a mano:
//
// - Cierra las dos vías por las que el sistema podía levantar esta app con la app cerrada al
//   arrancar el móvil: el receptor de `expo-task-manager` y el de `expo-notifications`. Son
//   los dos únicos receptores que declaraban acciones de arranque en el manifiesto fusionado.
// - Y cierra la vía de push entera, que era la anchura de más entre lo que `permisos.js`
//   promete —«nada de esta app se despierta con la app cerrada»— y lo que se estaba
//   comprobando —«nada se despierta al arrancar el móvil»—.
// - **No promete nada sobre lo que declare una librería futura**, ni siquiera sobre estas
//   dos si cambian de forma: este fichero escribe en
//   `app/android/app/src/main/AndroidManifest.xml`, donde la declaración de la librería ni
//   siquiera es visible, así que aquí no hay ancla que comprobar ni sitio donde gritar. Lo
//   que detecta una regresión es la guarda sobre el manifiesto **fusionado**
//   (`test/nucleo/manifiesto-generado.test.mjs`), que enumera todos los receptores **y todos
//   los servicios** y los contrasta contra `VIAS_DE_DESPERTAR` de
//   `app/plataforma/permisos.js`, que es una lista cerrada y no una lista de conocidos. Si
//   mañana `expo-notifications` renombra su receptor, aquí quedará un reemplazo fantasma y el
//   real aparecerá con sus acciones: eso se ve allí, no aquí.
// - Lo que la app hace con las notificaciones **no cambia**: sigue entregando en primer
//   plano y sin disparador. Lo que desaparece es el arranque, no la entrega.
//
// Y lo que este plugin **no puede** hacer, que es el otro límite de la fila:
// `RECEIVE_BOOT_COMPLETED` no se puede retirar. `expo-task-manager` programa la entrega de
// cada posición como un trabajo **persistido** de `JobScheduler`
// (`TaskManagerUtils.java:205`, `setPersisted(true)` clavado), y Android exige ese permiso
// para persistir un trabajo: sin él la app **revienta** en cuanto llega la primera posición
// —`IllegalArgumentException: Requested job cannot be persisted`, medido—. Así que el
// permiso se declara, con su motivo, en `app.json` y en `permisos.js`.

const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

/**
 * Lo que se retira del manifiesto fusionado. Es la parte de Android de
 * `LO_QUE_NUNCA_SE_DECLARA` de `app/plataforma/permisos.js`; los demás de aquella lista son
 * claves de `Info.plist` y no tienen nada que retirar aquí.
 *
 * La lista se escribe aquí y no se importa de `permisos.js` por mecánica y no por diseño:
 * los plugins de configuración los carga Expo con `require` desde CommonJS, y `permisos.js`
 * es un módulo ESM. Que estén en dos sitios es comprobable con un cruce de listas.
 */
const PERMISOS_QUE_SE_RETIRAN = [
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.SCHEDULE_EXACT_ALARM',
];

/** El receptor de tareas, reescrito sin los disparadores de arranque del sistema. */
const RECEPTOR_DE_TAREAS = 'expo.modules.taskManager.TaskBroadcastReceiver';

/** El receptor de notificaciones, reescrito sin los disparadores de arranque del sistema. */
const RECEPTOR_DE_NOTIFICACIONES = 'expo.modules.notifications.service.NotificationsService';

/**
 * La acción con la que `expo-notifications` se entrega cada aviso, y **lo único que el
 * reemplazo del receptor conserva**: el receptor se descubre por la acción declarada en su
 * filtro (`NotificationsService.kt:403-406`), así que quitársela no lo dejaría dormido, lo
 * dejaría mudo. El porqué medido está en la cabecera.
 */
const ACCION_DE_ENTREGA_DE_AVISOS = 'expo.modules.notifications.NOTIFICATION_EVENT';

/**
 * La prioridad del filtro original, copiada tal cual. El reemplazo sustituye la declaración
 * entera, así que lo que no se copie se pierde: conservar la forma y perder solo lo decidido
 * es la superficie de cambio mínima.
 */
const PRIORIDAD_DEL_FILTRO = '-1';

/**
 * Las tres piezas de FCM que se retiran enteras, con el tipo de nodo por el que entran al
 * manifiesto. **Las tres y no dos**: los dos servicios comparten el filtro
 * `com.google.firebase.MESSAGING_EVENT` y se descubren por él, así que quitar solo uno deja al
 * otro resolviendo en su lugar. La unidad de neutralización es **el filtro**, no la clase.
 *
 * El orden es el del manifiesto fusionado, y el porqué medido de cada una está en la cabecera.
 * Los nombres se escriben literales aquí porque es lo único que la fusión de manifiestos sabe
 * casar: `tools:node="remove"` empareja por `android:name`, así que un nombre mal escrito no
 * falla, **no hace nada** — y eso lo ve la guarda del manifiesto fusionado, no este fichero.
 */
const PIEZAS_DE_FCM_QUE_SE_RETIRAN = [
  { nodo: 'receiver', nombre: 'com.google.firebase.iid.FirebaseInstanceIdReceiver' },
  { nodo: 'service', nombre: 'com.google.firebase.messaging.FirebaseMessagingService' },
  { nodo: 'service', nombre: 'expo.modules.notifications.service.ExpoFirebaseMessagingService' },
];

/**
 * El prefijo del espacio de nombres sin el que **nada de este fichero funciona**: `tools:node`
 * es lo único que hace que la fusión retire o sustituya lo que declara una librería.
 *
 * Se comprueba y se grita en vez de aplicarse a ciegas, que es el listón que puso el hermano
 * de este fichero (`lo-que-exige-health-connect.js`): sin el prefijo declarado, la retirada de
 * los permisos y de las tres piezas de FCM se escribiría igual y **no retiraría nada**, y el
 * fallo aparecería como una vía de despertar viva en una guarda que corre mucho más tarde.
 */
const ESPACIO_DE_NOMBRES_TOOLS = 'xmlns:tools';

/**
 * Los modos de fondo de iOS que esta app declara, y **ningún otro**: es la lista blanca
 * contra la que se filtra `UIBackgroundModes` en el `Info.plist` generado.
 *
 * Son los `id` de `MODOS_DE_FONDO` de `app/plataforma/permisos.js`, copiados aquí por la
 * misma mecánica que la lista de permisos —los plugins se cargan con `require` desde
 * CommonJS y `permisos.js` es ESM—, y el cruce de las dos listas es comprobable.
 */
const MODOS_DE_FONDO_DECLARADOS = ['location'];

module.exports = function retiraPermisosProhibidos(config) {
  // Los modos de fondo primero, para que el filtro quede registrado y se aplique después
  // de lo que empujen los plugins de las librerías. Si alguno se colara igual, lo que hay
  // que mirar es el `Info.plist` generado y no este fichero.
  const conModosDeFondo = withInfoPlist(config, (configurado) => {
    const modos = configurado.modResults.UIBackgroundModes;
    if (!Array.isArray(modos)) return configurado;
    const limpios = modos.filter((modo) => MODOS_DE_FONDO_DECLARADOS.includes(modo));
    // Sin ninguno declarado se quita la clave entera: un array vacío no dice «ninguno», dice
    // que alguien empezó a declarar modos de fondo y se dejó la lista a medias.
    if (limpios.length === 0) delete configurado.modResults.UIBackgroundModes;
    else configurado.modResults.UIBackgroundModes = limpios;
    return configurado;
  });

  return withAndroidManifest(conModosDeFondo, (configurado) => {
    const manifiesto = configurado.modResults.manifest;

    // Sin el prefijo `tools` declarado, todo lo que sigue se escribe igual y no retira nada.
    // Se grita aquí, con el fichero delante, en vez de dejar que aparezca dentro de un año
    // como una vía de despertar viva en una guarda que corre al final de la compilación.
    if (!manifiesto.$?.[ESPACIO_DE_NOMBRES_TOOLS]) {
      throw new Error(
        `el AndroidManifest.xml generado no declara "${ESPACIO_DE_NOMBRES_TOOLS}", y sin ese prefijo ni los permisos prohibidos se retiran ni las tres piezas de FCM desaparecen: ` +
        'la plantilla de Expo ha cambiado y esto hay que volver a medirlo en vez de aplicarlo a ciegas',
      );
    }

    manifiesto['uses-permission'] = manifiesto['uses-permission'] ?? [];

    for (const permiso of PERMISOS_QUE_SE_RETIRAN) {
      const declarado = manifiesto['uses-permission'].filter((p) => p.$?.['android:name'] === permiso);
      for (const entrada of declarado) entrada.$['tools:node'] = 'remove';
      if (!declarado.length) {
        manifiesto['uses-permission'].push({ $: { 'android:name': permiso, 'tools:node': 'remove' } });
      }
    }

    const aplicacion = (manifiesto.application ?? [])[0];
    if (aplicacion) {
      aplicacion.receiver = (aplicacion.receiver ?? []).filter((r) => r.$?.['android:name'] !== RECEPTOR_DE_TAREAS);
      // `tools:node="replace"` sustituye la declaración de la librería entera por esta, sin
      // ningún `intent-filter`: el receptor sigue recibiendo las posiciones porque se le
      // llama por su clase, y deja de poder despertarse al arrancar el móvil.
      aplicacion.receiver.push({
        $: { 'android:name': RECEPTOR_DE_TAREAS, 'android:exported': 'false', 'tools:node': 'replace' },
      });

      aplicacion.receiver = aplicacion.receiver.filter((r) => r.$?.['android:name'] !== RECEPTOR_DE_NOTIFICACIONES);
      // Aquí el reemplazo **sí lleva filtro**, y con una sola acción: la de entrega. Se copia
      // la forma del original —habilitado, sin exportar, prioridad del filtro— porque
      // `tools:node="replace"` sustituye la declaración entera y lo que no se escriba aquí
      // desaparece del binario. Lo que se pierde son las cinco acciones de arranque.
      aplicacion.receiver.push({
        $: {
          'android:name': RECEPTOR_DE_NOTIFICACIONES,
          'android:enabled': 'true',
          'android:exported': 'false',
          'tools:node': 'replace',
        },
        'intent-filter': [
          {
            $: { 'android:priority': PRIORIDAD_DEL_FILTRO },
            action: [{ $: { 'android:name': ACCION_DE_ENTREGA_DE_AVISOS } }],
          },
        ],
      });

      // Y las tres piezas de FCM, **enteras**. Aquí no hay reemplazo que escribir: el nodo se
      // declara solo como marca de retirada, sin atributos y sin filtro, y desaparece del
      // manifiesto fusionado. Es lo que cierra a la vez el descubrimiento por acción —que es
      // el medido para los dos servicios— y el descubrimiento por clase.
      for (const pieza of PIEZAS_DE_FCM_QUE_SE_RETIRAN) {
        const nodos = (aplicacion[pieza.nodo] ?? []).filter((n) => n.$?.['android:name'] !== pieza.nombre);
        nodos.push({ $: { 'android:name': pieza.nombre, 'tools:node': 'remove' } });
        aplicacion[pieza.nodo] = nodos;
      }
    }
    return configurado;
  });
};
