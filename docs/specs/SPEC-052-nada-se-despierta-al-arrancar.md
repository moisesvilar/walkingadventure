# SPEC-052 — Nada se despierta al arrancar el móvil

## Descripción

Hoy el sistema despierta esta app al encender el móvil. No lo hace nada que la app haya escrito: lo hace el receptor `NotificationsService` que `expo-notifications` declara en su propio manifiesto, y que al fusionarse escucha `BOOT_COMPLETED`, `REBOOT`, los dos `QUICKBOOT_POWERON` y `MY_PACKAGE_REPLACED`. Está dentro desde SPEC-023 y es la deuda más vieja del repo que sigue viva: la guarda «Nada de esta app se despierta al arrancar el móvil» (`test/nucleo/manifiesto-generado.test.mjs:430`) **nació roja a propósito** en la fila 48, con el dueño escrito, y es el único fallo de la batería de núcleo.

Esta fila la pone verde de verdad, y por el sitio por donde se cierra de verdad: el plugin de configuración nativa sustituye ese receptor por uno que **conserva su acción de entrega y pierde las cinco de arranque**. Lo que la app hace con las notificaciones no cambia ni un ápice — la capa de avisos sigue entregando en primer plano y sin disparador —, y lo que desaparece es que el sistema tenga por dónde levantarla con la app cerrada.

El origen de diseño es `game-design/seguridad-privacidad.md` §2 y RF-PRIV-003 («solo mientras se usa»; los pasos se leen al abrir y con la app cerrada no corre nada). La fila del checklist cita RNF-PRIV-001, que es el requisito del proxy sin identificadores y no cubre esta propiedad; queda dicho en «Decisiones asumidas» y la columna no la toca esta spec.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `wa-qa-dev` y los ejecuta `wa-qa-tester` contra el código ya commiteado, en un paso posterior del bucle de QA de este repo. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Aquí hay un matiz que hace falta decir en voz alta**: `test/nucleo/plugins-declarados.test.mjs` se va a poner rojo con esta entrega, porque la huella SHA-256 del plugin cambia. Ese fichero es de `test/**` y lo actualiza `wa-qa-dev`, **no el implementador**. La guarda está haciendo su trabajo: la huella se renombra con el cometido al día, y **no se ablanda, ni se borra la exigencia, ni se le añade tolerancia**.

## Criterios de aceptación

### El receptor de notificaciones deja de escuchar el arranque

- GIVEN el manifiesto fusionado de Android de una compilación de depuración WHEN se enumeran todos sus receptores con las acciones que declaran THEN ninguno declara ninguna de las seis acciones de `ACCIONES_QUE_DESPIERTAN` (`BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON`, el `QUICKBOOT_POWERON` de HTC, `MY_PACKAGE_REPLACED` y `LOCKED_BOOT_COMPLETED`).
- GIVEN ese mismo manifiesto fusionado WHEN se busca el receptor `expo.modules.notifications.service.NotificationsService` THEN aparece declarado exactamente una vez.
- GIVEN ese receptor en el manifiesto fusionado WHEN se leen las acciones de sus `intent-filter` THEN son exactamente `['expo.modules.notifications.NOTIFICATION_EVENT']`.
- GIVEN ese receptor en el manifiesto fusionado WHEN se leen sus atributos THEN sigue habilitado y sin exportar (`android:enabled="true"`, `android:exported="false"`).

### Lo que ya estaba cerrado no se pierde

- GIVEN el manifiesto fusionado WHEN se busca el receptor de `expo-task-manager` THEN sigue siendo único y sin ninguna acción de arranque.
- GIVEN el manifiesto fusionado WHEN se enumeran sus `uses-permission` THEN `android.permission.RECEIVE_BOOT_COMPLETED` sigue declarado.
- GIVEN la entrada de `RECEIVE_BOOT_COMPLETED` en `PERMISOS_QUE_UNA_LIBRERIA_EXIGE` WHEN se lee su `aCambio` THEN nombra los **dos** receptores neutralizados y sigue conteniendo literalmente la expresión «receptor de tareas se sustituye».
- GIVEN esa misma entrada WHEN se lee su `porQueNoSeQuita` THEN sigue nombrando el trabajo persistido de `JobScheduler`.
- GIVEN el `Info.plist` generado de iOS WHEN se leen sus `UIBackgroundModes` THEN siguen siendo exactamente `['location']`.
- GIVEN la guarda «Nada de esta app se despierta al arrancar el móvil» WHEN se lee su código tras esta fila THEN sigue afirmando las seis acciones sobre todos los receptores, sin lista de tolerados, sin excepción por clase y sin `skip`.

### La premisa que sostiene la neutralización

- GIVEN todo el código vivo de `app/` y `packages/` WHEN se buscan las llamadas que programan una notificación THEN todas la programan con `trigger: null` y ninguna con disparador futuro.
- GIVEN ese mismo código WHEN se buscan las llamadas que consultan, cancelan o reprograman notificaciones ya programadas THEN no hay ninguna.
- GIVEN la capa de avisos con el notificador de Expo montado y el permiso concedido WHEN entrega un aviso THEN lo entrega al momento y sin disparador, como antes de esta fila.

### Lo que el plugin declara de sí mismo

- GIVEN la cabecera de `app/plugins/retira-permisos-prohibidos.js` WHEN se lee THEN nombra `expo.modules.notifications.NOTIFICATION_EVENT` como lo que el reemplazo conserva, con el motivo medido: el receptor se descubre por la acción de su filtro.
- GIVEN esa misma cabecera WHEN se busca la afirmación de que la vía de `expo-notifications` sigue abierta THEN ya no está: el texto literal «No cierra la propiedad entera» ha desaparecido del fichero.
- GIVEN `test/nucleo/plugins-declarados.test.mjs` tras la actualización de `wa-qa-dev` WHEN corre contra el plugin cambiado THEN la huella nombrada coincide con la del código nuevo y el `cometido` declarado nombra los dos receptores neutralizados.

### Cuando falta el artefacto, o cuando la librería cambie de forma

- GIVEN un clon sin compilar, sin manifiesto fusionado y sin `Info.plist` generado WHEN corre la batería de núcleo THEN los casos de esta spec **no se registran** y `test/reports/manifiesto-generado.estado.json` dice `mirado: false`, en vez de pasar en verde.
- GIVEN un manifiesto de ejemplo en el que el receptor de notificaciones vuelve a declarar `BOOT_COMPLETED` WHEN se le aplica la lectura de receptores de la guarda THEN lo señala nombrando la clase y la acción.
- GIVEN un manifiesto de ejemplo en el que el receptor de notificaciones aparece sin ninguna acción WHEN se le aplica la comprobación de la acción de entrega THEN se pone rojo, porque un reemplazo que entrega de menos rompe todas las notificaciones en uso.

## Notas técnicas

**Qué se toca, y son dos ficheros.**

1. `app/plugins/retira-permisos-prohibidos.js` — el punto nuevo (sustituir el receptor de `expo-notifications`) y la reescritura de la cabecera.
2. `app/plataforma/permisos.js:139` — el `aCambio` de la entrada de `RECEIVE_BOOT_COMPLETED`.

Nada más. Sin dependencias nuevas: `withAndroidManifest` viene dentro de `expo` y ya está importado. Sin cambios en la frontera del núcleo, que no se entera de nada de esto: el paquete compartido no importa React Native ni Expo, y la batería sigue arrancando en un clon limpio.

**Por qué el reemplazo conserva `NOTIFICATION_EVENT`, y por qué esto no es el molde copiado.** Al gemelo de `expo-task-manager` se le pudo quitar el `intent-filter` entero porque sus posiciones se le entregan con un intent **explícito por clase** (`node_modules/expo-task-manager/android/src/main/java/expo/modules/taskManager/TaskManagerUtils.java:180`). `expo-notifications` funciona al revés: `NotificationsService.kt:403-406` (`findDesignatedBroadcastReceiver`) descubre su propio receptor con `queryBroadcastReceivers(Intent(intent.action).setPackage(context.packageName))`, o sea **por la acción declarada en el filtro**, y `doWork` (`:386-393`) sin receptor encontrado escribe «No service capable of handling notifications found» y no entrega nada. Todas las entregas en tiempo de ejecución viajan con `NOTIFICATION_EVENT_ACTION` (`NotificationsService.kt:32` y una veintena de sitios). Un reemplazo sin filtro dejaría la app compilando, verde en la guarda de arranque y **sin ninguna notificación funcionando**. De ahí la exigencia nueva y afirmada: el mismo rigor que puso rojo lo que faltaba tiene que poner rojo un reemplazo que entregue de menos, y se comprueba **sobre el manifiesto fusionado**, que es el artefacto.

**Lo que declara la librería, medido el 13-ago-2026** (`node_modules/expo-notifications/android/src/main/AndroidManifest.xml`): un receptor `.service.NotificationsService`, `enabled=true`, `exported=false`, con un `intent-filter` de `priority="-1"` y seis acciones. El reemplazo conserva la forma y pierde las cinco de arranque.

**Por qué `RECEIVE_BOOT_COMPLETED` no se retira, verificado de cero el 13-ago-2026.** `setPersisted(true)` sigue clavado en `TaskManagerUtils.java:205`, y `app/plataforma/posiciones.js:301,316` sigue llamando a `startLocationUpdatesAsync`: sin el permiso la app revienta con `IllegalArgumentException: Requested job cannot be persisted`. El permiso se queda en `PERMISOS_QUE_UNA_LIBRERIA_EXIGE`, y dos guardas **hoy verdes** dependen de que siga (`manifiesto-generado.test.mjs:482` afirma que está; `:408` lo admite en la lista blanca porque está en esa lista). Ninguna guarda verde puede enrojecer con esta fila.

**El `aCambio` tiene una restricción literal.** `manifiesto-generado.test.mjs:468` hace `assert.match(impuesto.aCambio, /receptor de tareas se sustituye/)`. El texto nuevo tiene que cubrir los dos receptores **y seguir casando con esa expresión**, o la guarda enrojece por el sitio equivocado. Es la única cadena contractual del fichero.

**Que no protege nada, medido y no heredado.** La única llamada que programa notificación en código vivo es `app/plataforma/notificador.js:95`, con `trigger: null` literal e incondicional. Cero apariciones de `cancelScheduledNotificationAsync`, `getAllScheduledNotificationsAsync`, `DateTrigger`, `DailyTrigger` o `repeats` en `app/` y `packages/`; `expo-notifications` lo importan solo `app/plataforma/notificaciones.js:8` y `app/marcha/salida-montada.js:18`, este último únicamente para el permiso. `SCHEDULE_EXACT_ALARM` ya se retira. O sea: **el receptor de arranque de `expo-notifications` no protege ninguna notificación real de esta app**, porque restaurar programadas tras un reinicio no tendría nada que restaurar. Los criterios de «la premisa que sostiene la neutralización» convierten esa medición en rojo: el día que alguien programe con disparador futuro, la neutralización deja de ser inocua y hay que decidirlo como producto, no descubrirlo en un reinicio.

**Dónde escribe el plugin, y por qué aquí no cabe el grito.** `withAndroidManifest` opera sobre `app/android/app/src/main/AndroidManifest.xml`, **no sobre el fusionado**: la declaración de la librería no es visible desde ahí, así que no hay ancla que comprobar y el molde de «ancla ausente = parar» de `lo-que-exige-health-connect.js` no se puede aplicar a este punto. La detección vive donde sí puede vivir: en las guardas sobre el manifiesto fusionado, que ya tienen las dos direcciones. Si mañana la librería renombra o retira su receptor, el reemplazo escribe un receptor fantasma y el real aparece con sus acciones de arranque — y el primer criterio de esta spec se pone rojo. Queda dicho para que nadie lo lea como un olvido.

**El plugin traduce y retira; no decide.** Nada de lógica de producto en lo generado. La lista de acciones que se quitan se escribe como dato, con su motivo, igual que las dos listas que ya viven en el fichero.

**Cómo se regeneran los artefactos** (los dos hacen falta, y sin ellos el total de la batería baja y eso **no es una tanda mejor**):

```bash
cd app && JAVA_HOME=/opt/homebrew/opt/openjdk@17 npx expo run:android
cd app && npx expo prebuild --platform ios --no-install --skip-dependency-update expo
```

**Batería y escenarios.** Base medida el 13-ago-2026 sobre `d2e6025`: **2906 · 2902 · 1 · 3**, con el único fallo en la guarda de arranque y `manifiesto-generado.estado.json` con `mirado: true` en las dos plataformas y `completo: true`. En `docs/testing.md` **no hay escenario** para esta guarda: el caso «Nada de esta app se despierta al arrancar el móvil» ya existe en `test/spec-test-map.json` como hueco de batería (hoy bajo SPEC-046), y el criterio nuevo de la acción conservada no tiene escenario que reutilizar. Si `wa-qa-dev` juzga que merece uno, iría bajo `@nucleo @privacidad` junto a «Los plugins que reescriben el proyecto nativo están nombrados uno a uno» (`docs/testing.md:1574`) — **esta spec no lo escribe**, que es de su fase.

## Fuera de alcance

- **La fila 53 entera**: el proveedor de ubicación frío, la cara en la pantalla del teléfono y el botón atrás. Lo que aparezca por aquí y sea de una de esas, se ficha y no se hace.
- **El punto 3 del plugin** (el receptor de `expo-task-manager`) no se toca: su reemplazo sin `intent-filter` está medido y funcionando desde el 11-ago-2026.
- **Los rojos de `@app`** (`empezar-de-nuevo-copia`, `en-marcha`, `telon`): ajenos, leídos y no se arreglan de paso.
- **`quienLoExige` de la entrada de `RECEIVE_BOOT_COMPLETED`** se queda como está: dice `expo-task-manager` porque es quien lo **necesita**, aunque quien lo **declara** en el manifiesto sea `expo-notifications`. Las dos cosas son ciertas y el fichero ya cuenta la historia entera en su comentario.
- **Las notificaciones push y la vía de Firebase**: esta app no las usa, y su servicio (`ExpoFirebaseMessagingService`) no escucha ninguna acción de arranque.

## Decisiones asumidas

- Spec sin interfaz → sin `## UX Design` ni sus cinco subsecciones (`spec-instructions.md` fase 2, «feature backend-only: solo bloque PO»). Nada de esta fila se ve en pantalla. Alternativa: describir la pantalla de ajustes que enseña los permisos, que ni cambia ni la toca esta entrega.
- El reemplazo **conserva la forma del receptor original** —`enabled`, `exported` y el `priority="-1"` del filtro— y solo pierde las cinco acciones de arranque. Alternativa: escribir únicamente `name` y `exported`, como hace el reemplazo del receptor de tareas. Regla: `tools:node="replace"` sustituye la declaración entera, así que copiar el original menos lo decidido es la superficie de cambio mínima y la que menos se puede equivocar.
- La comprobación de que nada programa con disparador futuro entra como **criterio con guarda**, y no como medición escrita en un comentario. Alternativa: dejarlo en la cabecera del plugin. Regla: es la premisa que hace inocua la neutralización, y una premisa que no puede ponerse roja es la forma de fallo de este repo (`decisiones-orquestador.md` §6o).
- Los criterios sobre la cabecera del plugin se afirman con **dos marcadores literales** —que aparezca `NOTIFICATION_EVENT`, que desaparezca «No cierra la propiedad entera»— y no sobre la redacción entera. Alternativa: revisión humana sin caso. Regla: una aserción sobre prosa libre es ruido a la tercera vez; una sobre dos cadenas concretas mide justo lo que cambió de verdad.
- El origen de diseño que se cita es **RF-PRIV-003 y `seguridad-privacidad.md` §2**, aunque la fila del checklist declare RNF-PRIV-001 (que es el proxy sin identificadores y no cubre esta propiedad). Alternativa: forzar la lectura de RNF-PRIV-001. Regla: la columna `Rationale` la mantiene el humano y esta spec no la escribe; queda fichado para quien la revise.
- Si al implementar apareciera **cualquier** camino que programe una notificación con disparador futuro, la entrega se **para** y se trae el hallazgo: que ese aviso sobreviva a un reinicio sería una decisión de producto y no un detalle de configuración nativa.
