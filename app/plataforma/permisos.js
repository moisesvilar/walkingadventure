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
//
// Y lo que SPEC-053 añade, que es una anchura de más que llevaba aquí desde el principio: lo
// que este fichero promete es la propiedad **ancha** —«nada de esta app se despierta con la
// app cerrada»— y lo que se estaba comprobando era la **estrecha**, «nada se despierta al
// arrancar el móvil», y encima solo sobre los receptores. Los servicios no entraban en el
// barrido por construcción, y por esas dos puertas a la vez se colaban tres piezas de FCM
// capaces de levantar el proceso. `VIAS_DE_DESPERTAR` es la lista cerrada que cierra la
// diferencia: **todos** los receptores y **todos** los servicios del manifiesto fusionado,
// uno a uno, con su mecanismo y con si ese mecanismo está medido o solo declarado.

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
    aCambio: 'los dos receptores que escuchaban el arranque se neutralizan: el receptor de tareas se sustituye sin BOOT_COMPLETED ni MY_PACKAGE_REPLACED, y el de notificaciones de expo-notifications por uno que solo conserva su acción de entrega; y desde SPEC-053 se retiran enteras las tres piezas de FCM que quedaban —el receptor de c2dm y los dos servicios que declaran MESSAGING_EVENT—, así que nada de esta app se despierta con la app cerrada: ni al arrancar el móvil ni por un mensaje de push',
    dueña: 'fila 48 del checklist, ensanchada por la 53',
  }),
]);

/**
 * **Las vías por las que el sistema puede levantar este proceso, una a una y con lista
 * cerrada**: todos los receptores y todos los servicios del manifiesto fusionado, nombrados
 * con su clase, su tipo, el filtro que los descubre, quién los declara y su motivo.
 *
 * Es lo que hace afirmable la propiedad **ancha** que este fichero promete desde SPEC-030 —
 * **«nada de esta app se despierta con la app cerrada»**— y no solo la estrecha de «nada se
 * despierta al arrancar el móvil», que era lo único comprobado hasta SPEC-053. La diferencia
 * entre las dos tenía dos puertas y las dos estaban abiertas a la vez: la guarda solo miraba
 * **acciones de arranque** y solo sobre **receptores**, así que un servicio con filtro no
 * entraba en el barrido por construcción. Por ahí vivían las tres piezas de FCM.
 *
 * **La lista enumera también lo que no despierta**, y es deliberado: decidir si un componente
 * puede levantar el proceso es exactamente el juicio que hay que escribir, y una guarda que
 * lo decidiera sola sería una guarda con criterio propio. Aquí está el dato con su veredicto;
 * allí, el contraste. Un receptor o un servicio que aparezca en el manifiesto sin estar en
 * esta lista pone la batería roja, y no hay excepción por clase ni tolerado sin motivo.
 *
 * **`mecanismo` dice si eso está medido o solo declarado, y se cuenta con el número delante:
 * de las diez vías de hoy, tres tienen el mecanismo medido y las otras siete están
 * declaradas sin medir.** Se dice así porque una lista cerrada cuyos motivos no se distinguen
 * de excusas es una lista de tolerados con otro nombre; el recuento vivo lo da
 * `viasSinMecanismoMedido()`, para que el número no pueda quedarse viejo en una frase.
 * Nombrar un adyacente **no es aprobarlo**: es dejarlo contado para que la fila que lo mida
 * lo pueda quitar de las siete en vez de heredarlo disuelto.
 *
 * Lo que esta lista **no** enumera, dicho para que la ausencia no se lea como olvido: los
 * `provider`. Los tres del manifiesto fusionado —el de ficheros de Expo, el de arranque de
 * AndroidX y el de Firebase— son `exported="false"`, así que ningún proceso ajeno puede
 * consultarlos y levantar este; si alguno se exportara, sería una vía nueva y entraría aquí.
 */
export const VIAS_DE_DESPERTAR = Object.freeze([
  Object.freeze({
    clase: 'expo.modules.taskManager.TaskBroadcastReceiver',
    tipo: 'receptor',
    filtro: null,
    descubrimiento: 'por clase',
    quienLaDeclara: 'expo-task-manager, reescrito por plugins/retira-permisos-prohibidos.js',
    mecanismo: 'medido',
    puedeDespertar: false,
    porque: 'sin ningún intent-filter y sin exportar desde SPEC-048: las posiciones se le entregan con un intent explícito construido con la clase (TaskManagerUtils.java:180), así que nadie de fuera puede alcanzarlo',
  }),
  Object.freeze({
    clase: 'expo.modules.notifications.service.NotificationsService',
    tipo: 'receptor',
    filtro: 'expo.modules.notifications.NOTIFICATION_EVENT',
    descubrimiento: 'por acción',
    quienLaDeclara: 'expo-notifications, reescrito por plugins/retira-permisos-prohibidos.js',
    mecanismo: 'medido',
    puedeDespertar: false,
    porque: 'conserva solo su acción de entrega —las cinco de arranque se las quitó SPEC-052— y no está exportado; quien la emite es la propia app, con setPackage, y esta app entrega los avisos en primer plano y sin disparador, así que no hay alarma pendiente que lo despierte',
  }),
  Object.freeze({
    clase: 'androidx.profileinstaller.ProfileInstallReceiver',
    tipo: 'receptor',
    filtro: 'androidx.profileinstaller.action.INSTALL_PROFILE (y SKIP_FILE, SAVE_PROFILE, BENCHMARK_OPERATION)',
    descubrimiento: 'por acción',
    quienLaDeclara: 'androidx.profileinstaller, transitiva de AndroidX',
    mecanismo: 'declarado',
    puedeDespertar: true,
    porque: 'está exportado y con filtro, así que el sistema puede alcanzarlo; lo que lo acota es que exige android.permission.DUMP, que solo tienen la shell y el sistema, y lo que hace es instalar el perfil de arte compilado. Sin medir: no se ha comprobado qué levanta ni cuándo lo dispara el sistema',
  }),
  Object.freeze({
    clase: 'com.google.android.datatransport.runtime.scheduling.jobscheduling.AlarmManagerSchedulerBroadcastReceiver',
    tipo: 'receptor',
    filtro: null,
    descubrimiento: 'por clase',
    quienLaDeclara: 'com.google.android.datatransport, que llega con firebase-messaging a través de expo-notifications',
    mecanismo: 'declarado',
    puedeDespertar: true,
    porque: 'no está exportado y no declara filtro, pero la propia librería lo programa con AlarmManager por intent explícito, y una alarma pendiente sí levanta el proceso. Con FCM retirado no tiene nada que transportar; sin medir: no se ha comprobado si llega a programar alguna alarma en esta app',
  }),
  Object.freeze({
    clase: 'expo.modules.location.services.LocationTaskService',
    tipo: 'servicio',
    filtro: null,
    descubrimiento: 'por clase',
    quienLaDeclara: 'expo-location',
    mecanismo: 'medido',
    puedeDespertar: false,
    porque: 'es el servicio en primer plano de una salida abierta: lo arranca la app al abrirla y lo para al cerrarla o al retirarse el rótulo, no está exportado y no tiene filtro. Es lo que sostiene «mientras se usa» con la pantalla apagada (SPEC-030 y SPEC-048), y muere con la salida',
  }),
  Object.freeze({
    clase: 'expo.modules.taskManager.TaskJobService',
    tipo: 'servicio',
    filtro: null,
    descubrimiento: 'por vínculo del planificador',
    quienLaDeclara: 'expo-task-manager',
    mecanismo: 'declarado',
    puedeDespertar: true,
    porque: 'lo vincula JobScheduler con BIND_JOB_SERVICE cuando dispara el trabajo con el que se entrega cada posición, y ese trabajo va con setPersisted(true) clavado, que es por lo que RECEIVE_BOOT_COMPLETED no se puede quitar. Lo medido es que sin el permiso la app revienta; lo que **no** está medido es si un trabajo persistido sobrevive al reinicio y levanta el proceso sin salida abierta',
  }),
  Object.freeze({
    clase: 'androidx.health.platform.client.impl.sdkservice.HealthDataSdkService',
    tipo: 'servicio',
    filtro: 'androidx.health.platform.client.ACTION_BIND_SDK_SERVICE',
    descubrimiento: 'por acción',
    quienLaDeclara: 'androidx.health:health-connect-client, a través de react-native-health-connect',
    mecanismo: 'declarado',
    puedeDespertar: true,
    porque: 'está exportado y con filtro, así que quien resuelva esa acción puede vincularlo; es la mitad de la app del contrato con Health Connect, que vincula en los dos sentidos. Sin medir: no se ha comprobado quién lo vincula ni con qué app cerrada',
  }),
  Object.freeze({
    clase: 'com.google.firebase.components.ComponentDiscoveryService',
    tipo: 'servicio',
    filtro: null,
    descubrimiento: 'ninguno: solo portador de meta-data',
    quienLaDeclara: 'firebase-common, que llega con firebase-messaging a través de expo-notifications',
    mecanismo: 'declarado',
    puedeDespertar: false,
    porque: 'no está exportado y no declara filtro: existe solo para que Firebase lea del PackageManager las meta-data de sus registrars, y nunca se arranca. Sin medir: la lectura del bytecode que lo confirmaría no se ha hecho',
  }),
  Object.freeze({
    clase: 'com.google.android.datatransport.runtime.backends.TransportBackendDiscovery',
    tipo: 'servicio',
    filtro: null,
    descubrimiento: 'ninguno: solo portador de meta-data',
    quienLaDeclara: 'com.google.android.datatransport, que llega con firebase-messaging a través de expo-notifications',
    mecanismo: 'declarado',
    puedeDespertar: false,
    porque: 'la misma forma que el anterior: sin exportar, sin filtro y con una sola meta-data que nombra el backend. Sin medir, por la misma razón',
  }),
  Object.freeze({
    clase: 'com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService',
    tipo: 'servicio',
    filtro: null,
    descubrimiento: 'por vínculo del planificador',
    quienLaDeclara: 'com.google.android.datatransport, que llega con firebase-messaging a través de expo-notifications',
    mecanismo: 'declarado',
    puedeDespertar: true,
    porque: 'lo vincula JobScheduler con BIND_JOB_SERVICE cuando dispara el trabajo que la propia librería programa para reenviar telemetría. Con FCM retirado no tiene nada que reenviar; sin medir: no se ha comprobado si llega a programar algún trabajo en esta app',
  }),
]);

/**
 * **Las vías que se retiran del manifiesto fusionado, y no se sustituyen**: las tres piezas
 * de FCM que `plugins/retira-permisos-prohibidos.js` quita enteras con `tools:node="remove"`.
 *
 * Está aquí y no solo en el plugin porque es lo que hace afirmable que la vía siga cerrada:
 * lo que el plugin escribe es una marca de retirada, y una marca con el nombre mal escrito no
 * falla, **no hace nada**. Ninguna de estas clases puede aparecer en el manifiesto fusionado.
 *
 * **La unidad de neutralización es el filtro y no la clase**, y ese es el criterio que se
 * puede torcer: los dos servicios comparten `com.google.firebase.MESSAGING_EVENT` y se
 * descubren por él, así que quitar solo el de Expo dejaría al de Firebase resolviendo en su
 * lugar por el mismo filtro. Se cierra la pareja o no se cierra nada.
 *
 * **Por qué se puede cerrar hoy, y en qué se diferencia de SPEC-052.** Allí la acción estaba
 * en uso —la entrega de avisos— y quitar el filtro habría dejado la app muda en silencio.
 * Aquí no la usa nadie, medido en tres direcciones: no hay `google-services.json` en el
 * árbol, no hay `googleServicesFile` en `app.json` y no hay una sola llamada a
 * `getExpoPushTokenAsync` ni a `getDevicePushTokenAsync`. **El día que alguien pida un token,
 * esa premisa deja de ser cierta y hay que reabrir estas tres vías**, declarándolas aquí en
 * `VIAS_DE_DESPERTAR` con su motivo: es una decisión de producto con su propia fila, no un
 * ajuste de configuración nativa.
 */
export const VIAS_NEUTRALIZADAS = Object.freeze([
  Object.freeze({
    clase: 'com.google.firebase.iid.FirebaseInstanceIdReceiver',
    tipo: 'receptor',
    filtro: 'com.google.android.c2dm.intent.RECEIVE',
    descubrimiento: 'por acción',
    quienLaDeclara: 'firebase-messaging 25.0.1, que arrastra node_modules/expo-notifications/android/build.gradle:43',
    evidencia: 'indirecta',
    porque: 'estaba exportado, con el permiso c2dm.permission.SEND y el filtro de recepción: es la puerta por la que un mensaje de push levanta el proceso. La evidencia de que se descubre por acción es indirecta y va etiquetada así: nadie del lado app escribe su nombre, pero el emisor vive en Play Services y no se ha leído. La forma elegida no depende de eso: quitar el bloque entero cierra a la vez el descubrimiento por acción y el de por clase',
  }),
  Object.freeze({
    clase: 'com.google.firebase.messaging.FirebaseMessagingService',
    tipo: 'servicio',
    filtro: 'com.google.firebase.MESSAGING_EVENT',
    descubrimiento: 'por acción',
    quienLaDeclara: 'firebase-messaging 25.0.1, que arrastra node_modules/expo-notifications/android/build.gradle:43',
    evidencia: 'directa',
    porque: 'declaraba el filtro de mensajería con prioridad -500. Leído sobre bytecode con javap: ServiceStarter.resolveServiceClassName resuelve con PackageManager.resolveService sobre MESSAGING_EVENT y solo entonces hace setClassName, así que es el filtro y no la clase lo que lo hace alcanzable',
  }),
  Object.freeze({
    clase: 'expo.modules.notifications.service.ExpoFirebaseMessagingService',
    tipo: 'servicio',
    filtro: 'com.google.firebase.MESSAGING_EVENT',
    descubrimiento: 'por acción',
    quienLaDeclara: 'expo-notifications, en android/src/main/AndroidManifest.xml:6-12',
    evidencia: 'directa',
    porque: 'el mismo filtro con prioridad -1, que es el que ganaba al de Firebase. La misma resolución por acción, así que retirarlo solo a él habría dejado la vía abierta con el de -500 atendiéndola',
  }),
]);

/**
 * Las vías cuyo mecanismo está **declarado y no medido**, para que el número se pueda decir
 * con el número delante en vez de disolverse en una frase.
 *
 * Es lo que separa una lista cerrada de una lista de tolerados: mientras estas estén contadas,
 * la fila que mida una la puede sacar de la cuenta; si el recuento se pierde, lo declarado sin
 * medir se vuelve indistinguible de lo comprobado.
 */
export function viasSinMecanismoMedido() {
  return VIAS_DE_DESPERTAR.filter((via) => via.mecanismo !== 'medido');
}

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
