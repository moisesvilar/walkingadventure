// Limpia del manifiesto fusionado lo que esta app no quiere y que llega por las librerías.
//
// Existe por un agujero medido en SPEC-048 y que no era de esta fila: los
// `AndroidManifest.xml` de las librerías se fusionan con el de la app, así que un permiso o
// un disparador pueden acabar en el APK sin que nadie los haya escrito. La guarda de
// `app/plataforma/permisos.js` mira `app.json`, y por ahí no se ve nada.
//
// Hace dos cosas, y la segunda es la importante:
//
// 1. **Retira los permisos prohibidos** con `tools:node="remove"`, que es la única forma de
//    que la fusión los respete. Hoy ninguna de las librerías inyecta los dos primeros; la
//    retirada va igual, porque una defensa que solo existe cuando ya te han entrado no es
//    una defensa.
// 2. **Sustituye el receptor de `expo-task-manager` por uno sin disparadores de arranque.**
//    La librería lo declara escuchando `BOOT_COMPLETED` y `MY_PACKAGE_REPLACED`, y eso es
//    literalmente que el sistema despierte a la app con la app cerrada, que es la propiedad
//    que `TAREAS_QUE_LA_APP_DEFINE` protege. Las posiciones se le entregan con un intent
//    **explícito** —`TaskManagerUtils` lo construye con la clase, no con la acción—, así
//    que quitarle el filtro entero no le quita nada de lo que esta app usa. Medido leyendo
//    `TaskManagerUtils.java:180` y comprobado en el emulador el 11-ago-2026.
//
// Lo que este plugin **no** puede hacer, y va dicho porque es el límite de esta fila:
// `RECEIVE_BOOT_COMPLETED` no se puede retirar. `expo-task-manager` programa la entrega de
// cada posición como un trabajo **persistido** de `JobScheduler`
// (`TaskManagerUtils.java:205`, `setPersisted(true)` clavado), y Android exige ese permiso
// para persistir un trabajo: sin él la app **revienta** en cuanto llega la primera posición
// —`IllegalArgumentException: Requested job cannot be persisted`, medido—. Así que el
// permiso se declara, con su motivo, en `app.json` y en `permisos.js`.

const { withAndroidManifest } = require('expo/config-plugins');

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

module.exports = function retiraPermisosProhibidos(config) {
  return withAndroidManifest(config, (configurado) => {
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
