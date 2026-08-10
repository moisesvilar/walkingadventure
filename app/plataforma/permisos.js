// Lo que la app declara pedir y lo que **no declara**, escrito como dato para que una
// prueba pueda leerlo y contrastarlo contra `app/app.json`.
//
// RF-PRIV-003 tiene una mitad que se cumple no haciendo nada, y esa es exactamente la que
// nadie ve romperse: el permiso permanente no se pide porque no está declarado, y una
// tarea periódica se cuela sin pedir ningún permiso nuevo. Un criterio que solo se puede
// comprobar leyendo el manifiesto a ojo no se pone rojo nunca
// (`pipeline/decisiones-orquestador.md` §6o), así que la lista es cerrada y la revisión
// corre en `node --test`.
//
// La distinción que SPEC-030 dejó afinada y que aquí no se reabre: **el modo de fondo de
// ubicación no es el permiso permanente**. `UIBackgroundModes: ["location"]` es lo que
// hace que la app cuente como «en uso» con la pantalla apagada durante una salida abierta,
// que es precisamente lo que `seguridad-privacidad.md` §2 pide para no tener que pedir el
// otro. Lo que esta fila añade es que **no hay ningún modo ni tarea de fondo por los pasos
// del día a día**: se leen al abrir y no hay nada que corra con la app cerrada.

/** Los permisos que la app pide, cada uno con cuándo se pide y quién lo posee. */
export const PERMISOS_QUE_SE_PIDEN = Object.freeze([
  Object.freeze({
    id: 'ubicacion-mientras-se-usa',
    ios: 'NSLocationWhenInUseUsageDescription',
    android: 'ACCESS_FINE_LOCATION',
    cuando: 'al levantar el primer mapa',
    dueña: 'fila 27 del checklist',
  }),
  Object.freeze({
    id: 'notificaciones',
    ios: null,
    android: 'POST_NOTIFICATIONS',
    cuando: 'al abrir la primera salida, con el rótulo del sistema',
    dueña: 'fila 30 del checklist',
  }),
  Object.freeze({
    id: 'salud-lectura',
    ios: 'NSHealthShareUsageDescription',
    android: 'android.permission.ACTIVITY_RECOGNITION',
    // En contexto y solo entonces: al encender el interruptor de los ajustes, nunca al
    // instalar y nunca al abrir. Denegarlo no se reintenta (`quests.md` decisión 4: el
    // juego es completo sin el modo).
    cuando: 'al encender «contar los pasos del día a día» en los ajustes',
    dueña: 'fila 42 del checklist',
  }),
]);

/**
 * Lo que la app **no declara**, nombrado para que la ausencia se pueda poner roja.
 *
 * El primero es la exclusión 12 del PRD y el más caro de todos; los demás son las puertas
 * por las que se colaría trabajo de fondo sin pedir ningún permiso nuevo.
 */
export const LO_QUE_NUNCA_SE_DECLARA = Object.freeze([
  'ACCESS_BACKGROUND_LOCATION',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSLocationAlwaysUsageDescription',
  'NSHealthUpdateUsageDescription',
  'BGTaskSchedulerPermittedIdentifiers',
  'RECEIVE_BOOT_COMPLETED',
  'SCHEDULE_EXACT_ALARM',
]);

/**
 * Los modos de fondo declarados de iOS, **uno y con su motivo**.
 *
 * Se admite exactamente esta lista: un `processing`, un `fetch` o un `remote-notification`
 * colados ahí son tarea periódica con otro nombre.
 */
export const MODOS_DE_FONDO = Object.freeze([
  Object.freeze({
    id: 'location',
    porque: 'sostiene «mientras se usa» con la pantalla apagada durante una salida abierta (SPEC-030), y muere con ella',
    dueña: 'fila 30 del checklist',
  }),
]);

/**
 * Las tareas periódicas declaradas: **ninguna, y por eso la lista existe**.
 *
 * Los pasos del día a día se leen al abrir la app. Con la app cerrada no se lee nada, no
 * se ejecuta ningún paso y no se consume batería por este motivo.
 */
export const TAREAS_PERIODICAS = Object.freeze([]);

/** Los identificadores de módulo de Expo que traerían fondo, y que esta app no monta. */
export const MODULOS_DE_FONDO_QUE_NO_SE_MONTAN = Object.freeze([
  'expo-background-fetch',
  'expo-background-task',
  'expo-task-manager',
]);

/**
 * Revisa un manifiesto de Expo contra lo declarado aquí y devuelve lo que incumple, como
 * datos. Nunca lanza: quien lo llame decide si eso es un error o un informe.
 */
export function revisaLaDeclaracion(manifiesto) {
  const problemas = [];
  const expo = manifiesto?.expo ?? {};
  const infoPlist = expo.ios?.infoPlist ?? {};
  const permisos = expo.android?.permissions ?? [];
  const texto = JSON.stringify(manifiesto ?? {});

  for (const prohibido of LO_QUE_NUNCA_SE_DECLARA) {
    if (texto.includes(prohibido)) problemas.push({ clave: prohibido, que: 'está declarado, y esta app no lo declara nunca' });
  }

  const modos = infoPlist.UIBackgroundModes ?? [];
  const declarados = MODOS_DE_FONDO.map((m) => m.id);
  for (const modo of modos) {
    if (!declarados.includes(modo)) problemas.push({ clave: modo, que: `es un modo de fondo que nadie declara: los declarados son ${declarados.join(', ') || '(ninguno)'}` });
  }

  for (const permiso of PERMISOS_QUE_SE_PIDEN) {
    if (permiso.ios && infoPlist[permiso.ios] === undefined) {
      problemas.push({ clave: permiso.id, que: `iOS no declara "${permiso.ios}", que es lo que explica para qué se pide` });
    }
    if (permiso.android && !permisos.includes(permiso.android)) {
      problemas.push({ clave: permiso.id, que: `Android no declara "${permiso.android}"` });
    }
  }

  return problemas;
}
