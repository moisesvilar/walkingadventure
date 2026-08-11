// Limpia de lo **generado** lo que esta app no declara y que llega por las librerías.
//
// Existe por un agujero medido en SPEC-048: lo que va al binario no es `app.json`, es el
// manifiesto fusionado y el `Info.plist` generado, y ahí entran permisos, receptores y
// modos de fondo que nadie de esta app ha escrito. Todas las guardas de
// `app/plataforma/permisos.js` miraban `app.json`, así que por esa puerta no se veía nada.
//
// Hace tres cosas:
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
//
// **Lo que esto cierra y lo que no, dicho con precisión**, porque un comentario que promete
// más de lo que entrega es la forma de fallo de este repo escrita a mano:
//
// - Cierra la vía de `expo-task-manager`: su receptor ya no puede despertarse al arrancar
//   el móvil ni al actualizarse el paquete.
// - **No cierra la propiedad entera.** En el manifiesto fusionado sigue vivo el receptor
//   `NotificationsService` de **`expo-notifications`** con `BOOT_COMPLETED`, `REBOOT`,
//   `QUICKBOOT_POWERON` y `MY_PACKAGE_REPLACED`. Es de SPEC-023 y **no es de esta fila**:
//   queda fichado para quien lo recoja, y hasta entonces «nada de esta app se despierta con
//   la app cerrada» es cierto de la tarea de ubicación y no del paquete entero.
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
    }
    return configurado;
  });
};
