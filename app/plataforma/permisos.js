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
// otro. Lo que SPEC-042 añadió es que **no hay ningún modo ni tarea de fondo por los pasos
// del día a día**: se leen al abrir y no hay nada que corra con la app cerrada.
//
// Y lo que SPEC-048 cambia, que es el sustituto por la propiedad: hasta esta fila la guarda
// era una lista de módulos prohibidos, y valía mientras nada legítimo necesitara ninguno.
// `expo-task-manager` sí lo necesita —es con lo que se define la tarea del servicio en
// primer plano que sostiene «mientras se usa» con la pantalla apagada—, así que sale de la
// lista y entra `TAREAS_QUE_LA_APP_DEFINE`, **enumerada una a una** con su motivo y su
// dueña. La propiedad protegida pasa de «no está el módulo que podría hacerlo» a «está
// enumerado todo lo que hace, y nada de ello lee con la app cerrada», que es más fuerte:
// registrar una tarea sin declararla es error de construcción y no un descuido silencioso.

/**
 * Los dos permisos de Health Connect, y **ninguno más** (RF-PRIV-003).
 *
 * Están aquí y no dentro de `salud.android.js` porque este es el sitio donde vive lo que la
 * app declara pedir: la pareja de plataforma solo exporta la fuente y su sonda, y la lista
 * de lo que se pide tiene que poder leerse igual desde la mitad de iOS, donde no hay fuente.
 *
 * Cada uno dice **quién lo consume**, que es lo que impide que sobre alguno: el de distancia
 * alimenta `metrosEnVentana` y el de pasos alimenta `pasosEnVentana`, que es la caída cuando
 * la fuente no tiene distancia. Health Connect concede por tipo de dato y quien juega puede
 * dar uno y no el otro, así que los dos se usan y ninguno está pedido de más.
 *
 * Y lo que **no** se pide, dicho aquí para que la ausencia se pueda poner roja: ni
 * entrenamientos, ni sesiones con ruta, ni frecuencia cardíaca, ni ningún registro del
 * cuerpo, ni nada con recorrido.
 */
export const PERMISOS_DE_SALUD = Object.freeze([
  Object.freeze({
    permiso: 'android.permission.health.READ_DISTANCE',
    registro: 'Distance',
    alimenta: 'metrosEnVentana',
    porque: 'son los metros caminados de la ventana, que es lo que el motor convierte con el tramo personal',
  }),
  Object.freeze({
    permiso: 'android.permission.health.READ_STEPS',
    registro: 'Steps',
    alimenta: 'pasosEnVentana',
    porque: 'son los pasos de la ventana cuando la fuente no tiene distancia, convertidos con una zancada constante y no personalizable',
  }),
]);

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
    // **Sin clave de iOS, y es una decisión de la fila 46**: mientras iOS no tenga fuente
    // de salud, `NSHealthShareUsageDescription` sería una cadena de uso sin uso, y dejarle
    // a la guarda del manifiesto un falso positivo consentido justo en la plataforma que
    // estrena mirada sería socavarla el mismo día que empieza a servir. Vuelve el día que
    // alguien monte HealthKit, y ese día pasa por las reglas de lenguaje
    // (`docs/iphone.md`, decisión 1).
    ios: null,
    // **Los dos de Health Connect y ninguno más.** `ACTIVITY_RECOGNITION` estuvo aquí hasta
    // la fila 46 y no era este permiso: es el del reconocimiento de actividad del sistema,
    // la vía de Google Fit y de los sensores en crudo, y esta app no lo usa. Un permiso
    // peligroso que se pide y no se usa es rojo, así que salió de aquí y de `app.json`.
    android: PERMISOS_DE_SALUD.map((p) => p.permiso),
    // En contexto y solo entonces: al encender el interruptor de los ajustes, nunca al
    // instalar y nunca al abrir. Denegarlo no se reintenta (`quests.md` decisión 4: el
    // juego es completo sin el modo).
    cuando: 'al encender «contar los pasos del día a día» en los ajustes',
    dueña: 'fila 42 del checklist, cableada por la 46',
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
  'SCHEDULE_EXACT_ALARM',
]);

/**
 * Los permisos que **una librería exige y la app declara a la fuerza**, con lo que se hace
 * a cambio para que la propiedad que protegían siga en pie.
 *
 * Existe por un hallazgo de SPEC-048 que hay que contar entero, porque contradice lo que
 * esta lista decía antes:
 *
 * - `RECEIVE_BOOT_COMPLETED` estaba en `LO_QUE_NUNCA_SE_DECLARA`, y **ya estaba en el APK**
 *   desde SPEC-023: lo inyecta el `AndroidManifest.xml` de `expo-notifications` al
 *   fusionarse. La guarda no lo veía porque solo leía `app.json`, así que la promesa
 *   llevaba rota sin que nada protestara. El manifiesto generado es donde hay que mirar.
 * - Y **no se puede quitar**: `expo-task-manager` programa la entrega de cada posición como
 *   un trabajo persistido de `JobScheduler` con `setPersisted(true)` clavado en el código,
 *   y Android exige ese permiso para persistir un trabajo. Retirado con `tools:node="remove"`,
 *   la app revienta al llegar la primera posición con `IllegalArgumentException: Requested
 *   job cannot be persisted`. Medido en el emulador el 11-ago-2026.
 *
 * Lo que se hace a cambio, que es lo que mantiene en pie la propiedad de verdad —«nada de
 * esta app se despierta con la app cerrada»—: el plugin `plugins/retira-permisos-prohibidos.js`
 * **sustituye los dos receptores que escuchaban el arranque**. El de tareas, por uno sin
 * ningún `intent-filter`, porque sus posiciones se le entregan por clase. El de
 * `expo-notifications` —que es, además, quien inyecta este permiso en el manifiesto—, por uno
 * que conserva su acción de entrega y pierde las cinco de arranque: a ese se le descubre por
 * la acción de su filtro, así que dejarlo sin filtro lo habría dejado mudo en vez de dormido
 * (SPEC-052). Con eso el permiso está declarado y no hay nada que pueda dispararse al
 * arrancar el móvil. El sustituto se cambia por la propiedad, igual que con el módulo de fondo.
 */
export const PERMISOS_QUE_UNA_LIBRERIA_EXIGE = Object.freeze([
  Object.freeze({
    id: 'RECEIVE_BOOT_COMPLETED',
    quienLoExige: 'expo-task-manager, para persistir el trabajo de JobScheduler con el que entrega cada posición',
    porQueNoSeQuita: 'sin él la app revienta al recibir la primera posición: JobScheduler rechaza un trabajo persistido sin este permiso',
    aCambio: 'los dos receptores que escuchaban el arranque se neutralizan: el receptor de tareas se sustituye sin BOOT_COMPLETED ni MY_PACKAGE_REPLACED, y el de notificaciones de expo-notifications por uno que solo conserva su acción de entrega, así que nada se despierta al arrancar el móvil',
    dueña: 'fila 48 del checklist',
  }),
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

/**
 * Los identificadores de módulo de Expo que traerían fondo, y que esta app no monta.
 *
 * **`expo-task-manager` salió de esta lista en SPEC-048, y el motivo va escrito aquí para
 * que nadie tenga que reconstruirlo desde un diff**: entra a sostener el servicio en primer
 * plano de una salida abierta, que es exactamente lo que `seguridad-privacidad.md` §2 nombra
 * como la razón de **no** pedir el permiso permanente. No entra a leer con la app cerrada, y
 * lo que impide que acabe haciéndolo es `TAREAS_QUE_LA_APP_DEFINE`: la lista de módulos era
 * un sustituto de esa propiedad, y el sustituto se cambia por la propiedad, no se afloja.
 *
 * Los dos que quedan sí son fondo con otro nombre y no tienen ningún uso legítimo aquí: los
 * pasos del día a día se leen al abrir, y con la app cerrada no se lee nada.
 */
export const MODULOS_DE_FONDO_QUE_NO_SE_MONTAN = Object.freeze([
  'expo-background-fetch',
  'expo-background-task',
]);

/**
 * Las tareas que la app **define**, una a una, al estilo de `MODOS_DE_FONDO`.
 *
 * Exactamente una, y muere con la salida: la del servicio en primer plano que sostiene la
 * lectura de posiciones mientras hay una salida abierta. No es periódica —no la despierta
 * ningún planificador, la alimenta el propio sensor mientras el servicio corre— y no existe
 * fuera de una salida abierta: se arranca al abrirla y se para al cerrarla o al retirarse el
 * rótulo por plazo.
 *
 * Registrar una tarea que no esté aquí es **error de construcción** y no un descuido:
 * `exigeTareaDeclarada` es por donde pasa el registro, y sin entrada no hay tarea.
 */
export const TAREAS_QUE_LA_APP_DEFINE = Object.freeze([
  Object.freeze({
    id: 'salida-abierta',
    porque: 'es la tarea del servicio en primer plano de una salida abierta: sostiene «mientras se usa» con la pantalla apagada (SPEC-030) y muere con la salida',
    dueña: 'fila 48 del checklist',
  }),
]);

/**
 * Las dependencias nativas que esta app monta para leer la ubicación, con para qué está
 * cada una y qué fila la trajo. Dos, y ninguna más.
 */
export const DEPENDENCIAS_DE_UBICACION = Object.freeze([
  Object.freeze({
    id: 'expo-location',
    porque: 'pide el permiso «mientras se usa», entrega la posición del arranque y arranca el servicio en primer plano con la notificación persistente del rótulo',
    dueña: 'fila 48 del checklist',
  }),
  Object.freeze({
    id: 'expo-task-manager',
    porque: 'define la tarea a la que el servicio en primer plano entrega las posiciones; es lo único que hace, y sin ella no hay servicio que sostenga «mientras se usa»',
    dueña: 'fila 48 del checklist',
  }),
]);

/**
 * Exige que una tarea esté declarada antes de registrarla. Falla nombrándola y enumerando
 * las declaradas: una tarea que se registra sin declararse es trabajo de fondo que nadie
 * ha decidido, y es la puerta que esta guarda existe para cerrar.
 */
export function exigeTareaDeclarada(id, quien = 'el registro de una tarea') {
  const declarada = TAREAS_QUE_LA_APP_DEFINE.find((t) => t.id === id);
  if (!declarada) {
    throw new Error(
      `${quien}: la tarea "${id}" no está declarada en TAREAS_QUE_LA_APP_DEFINE, y registrar una sin declararla es trabajo de fondo que nadie ha decidido. ` +
      `Las declaradas son ${TAREAS_QUE_LA_APP_DEFINE.map((t) => t.id).join(', ') || '(ninguna)'}`,
    );
  }
  return declarada;
}

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
    // `android` es uno o varios: Health Connect concede por tipo de dato, así que un solo
    // permiso no basta para describir lo que se pide. Se normaliza aquí en lugar de tener
    // dos campos, que serían dos sitios donde olvidarse de mirar.
    for (const cual of [].concat(permiso.android ?? [])) {
      if (!permisos.includes(cual)) {
        problemas.push({ clave: permiso.id, que: `Android no declara "${cual}"` });
      }
    }
  }

  return problemas;
}
