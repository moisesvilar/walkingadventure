# SPEC-046-iter-1 — El suelo de aparatos que arrastra Health Connect, y el intento de razón traducido a enlace profundo

## Descripción

Iteración de **cambio de comportamiento** sobre la implementación de SPEC-046. La desencadenan dos premisas de la spec base que resultaron falsas al implementarla, las dos medidas contra la fuente y las dos ya decididas por el dueño. Ningún criterio de comportamiento de la base se deroga: el destino sigue siendo A6P6, los permisos siguen siendo `READ_DISTANCE` y `READ_STEPS`, y el zurrón, el motor y la reserva se quedan exactamente como están escritos. Lo que cambia es **cómo se llega** y **qué arrastra llegar**.

La primera premisa falsa es que esta fila no tocaba el suelo de aparatos. Lo toca: `react-native-health-connect` exige **minSdk 26** (`node_modules/react-native-health-connect/android/gradle.properties:2`) y el manifiesto fusionado de hoy declara `minSdkVersion="24"` (`node_modules/expo/android/build/intermediates/merged_manifest/debug/processDebugManifest/AndroidManifest.xml:5`), así que la rama **no compila**: el merger falla en `processDebugMainManifest`. La decisión del dueño es **subir a 26 con un plugin de configuración propio y ninguna dependencia nueva**, porque el suelo lo arrastra la fuente de salud ya ratificada —es la letra pequeña de aquella decisión, no una decisión de otra especie— y el coste está medido: Android 7.0 y 7.1, décimas de porcentaje de un parque de 2016, en un juego que además pide GPS fino y render Skia. Es **el primer cambio de suelo de aparatos del proyecto**, y como tal va a la bitácora con fecha y motivo.

La segunda premisa falsa es que el intento de razón de permisos llegaba a JavaScript. No llega: `IntentModule` devuelve `null` salvo que la acción sea `ACTION_VIEW` o NFC **y** el intento traiga `getData()` (`node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/intent/IntentModule.kt:59-68`), y el intento de razón no trae ninguna de las dos cosas; `react-native-health-connect` tampoco expone nada del intento de lanzamiento —su `app.plugin.js:12,38-40` solo **declara** el filtro—. La decisión del dueño es que **el mismo plugin reescriba el intento a enlace profundo**: si la acción es la de la razón de permisos, el intento se reescribe a `ACTION_VIEW` con `walkingadventure://razon-de-permisos`, y de ahí lo enruta la tubería que ya existe —`app/App.js:701` ya llama a `Linking.getInitialURL()`, `app/app.json:9` ya declara el esquema y `app/plataforma/gancho.js` ya es el gancho de enlaces con su anfitrión—. Cero dependencias nuevas y cero mecanismo nuevo en JavaScript.

Es **la primera vez que este repo inyecta código nativo propio**, y por eso tres de los cuatro criterios que siguen son del precedente más que del mecanismo: lo que se escriba aquí es el molde de la próxima vez. El Kotlin traduce y no decide, se verifica por su artefacto igual que el manifiesto, y el enlace que aparece pasa a ser **superficie pública de la app** y se declara como tal en la arista de `docs/flujo.md`.

Y la iteración recoge una tercera cosa que no es una premisa sino una consecuencia: **el total de la batería bajó de 2825 a 2819 y eso no es una mejora**. Sin compilación no hay manifiesto fusionado, así que el bloque de Android no se registró —`test/reports/manifiesto-generado.estado.json` dice `android.mirado: false`— y el rojo ajeno de `BOOT_COMPLETED` **no está verde: está sin mirar**. La fila no se da por medida hasta que ese bloque vuelva a registrarse y el total vuelva a su tamaño.

**Lo que NO cambia:** el destino (A6P6), los dos permisos de salud, la retirada de `ACTIVITY_RECOGNITION` y de `NSHealthShareUsageDescription`, la línea de `docs/iphone.md`, la privacidad, el determinismo, la frontera del núcleo, y todos los criterios del zurrón, el motor y la reserva.

## Alcance de implementación

- Esta iteración define **únicamente el código de producción** del delta: el plugin de configuración que sube el suelo de aparatos y traduce el intento de razón, la lectura del enlace profundo nuevo, y la arista de `docs/flujo.md` que lo declara. Nada de lo que la spec base ya entregó se rehace.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- **Frontera del núcleo: sin cambios.** `packages/nucleo/` no se toca, no aparece ninguna entrada ni salida nueva que inyectar, y lo que cruza del lector al núcleo siguen siendo metros. **Dependencias: ninguna nueva.** `expo-build-properties` se propuso y **se descartó** —`withGradleProperties` viene dentro de `expo`, que ya es dependencia—; `react-native-health-connect` sigue siendo la única dependencia que esta fila trajo.
- **Fuera de alcance de esta iteración**, aunque el delta los roce: el resto de las claves de compilación de Android (`targetSdk`, `compileSdk`, versión de Kotlin), que no las arrastra Health Connect y no se tocan «ya que estamos»; cualquier lógica de producto del lado nativo más allá de traducir la acción del intento; el rojo de `BOOT_COMPLETED` de `expo-notifications`, que esta fila solo tiene que volver a **mirar**, no arreglar; y HealthKit en iOS, donde ni el suelo ni el intento tienen nada que ver.

## Criterio de aceptación modificado

Van en el mismo Gherkin español de `docs/testing.md`. **Ningún criterio de la spec base se deroga**, y por eso no aparece la fórmula de derogación en ningún sitio de este documento: lo que sigue son criterios **nuevos** y dos criterios de la base que se **refinan añadiendo exigencia**, nunca quitándola.

### Los criterios de la base que se mantienen, y que es fácil confundir con este delta

Se citan textuales porque el delta se parece a ellos y hay que poder distinguirlos:

> **Dado** el manifiesto fusionado de Android, **cuando** se revisa, **entonces** declara el filtro de intención de la razón de permisos de salud, y su destino es la actividad principal de la app.

Sigue vigente palabra por palabra: el filtro apunta a `MainActivity` y eso no cambia. Lo que la spec base decía en sus notas técnicas —«y desde ella la app enruta a A6P6»— era **mecanismo**, no criterio, y es lo único que esta iteración sustituye.

> **Dado** una partida abierta y lista, **cuando** el sistema dispara ese intento, **entonces** la app abre **A6P6** y no la portada.

> **Dado** una instalación recién hecha, sin partida o con el arranque a medias, **cuando** el sistema dispara ese intento, **entonces** la app cae al arranque de siempre y **no** monta A6P6 sobre una partida que no existe.

Los dos siguen vigentes tal cual. La guarda de la arista es la misma; lo que cambia es por qué tubería viaja la orden.

### El suelo de aparatos sube a 26, y se verifica sobre el artefacto

- **Dado** el manifiesto fusionado de Android, **cuando** se revisa su `uses-sdk`, **entonces** declara `minSdkVersion="26"`. La verificación es **sobre el artefacto generado y no sobre la intención**: leer el plugin y darlo por bueno no vale.
- **Dado** la app con el cambio puesto, **cuando** se compila e instala en `wa-pixel`, **entonces** compila, instala y arranca — y hasta que eso ocurra, el bloqueo de compilación **no se da por resuelto**. `@app`
- **Dado** el suelo declarado, **cuando** se busca de dónde sale, **entonces** sale de **un plugin de configuración propio de este repo**, del mismo mecanismo y en el mismo sitio que `app/plugins/retira-permisos-prohibidos.js`, y **sin ninguna dependencia nueva**.
- **Dado** ese plugin, **cuando** se lee, **entonces** lleva **el porqué escrito dentro** —que lo arrastra Health Connect— con el coste medido al lado: Android 7.0 y 7.1, décimas de porcentaje de un parque de 2016.
- **Dado** `docs/prd.md`, **cuando** se busca un mínimo de Android, **entonces** **no lo fija ninguno**: RNF-COM-001 (`docs/prd.md:286`) solo habla de una base React Native + Expo para las dos plataformas. **No hay contradicción y el PRD no se toca.** Queda escrito aquí para que nadie lo vuelva a buscar.
- **Dado** las demás claves de compilación de Android —`targetSdk`, `compileSdk`, versión de Kotlin—, **cuando** se comparan con las de antes del cambio, **entonces** están igual: lo que sube es el suelo y nada más.
- **Dado** `docs/starting.md`, **cuando** se lee la entrada de esta fila, **entonces** anota este cambio como **el primer cambio de suelo de aparatos del proyecto**, con fecha y con el motivo, y no como una línea más del cableado.

### El intento de razón se traduce a enlace profundo, y el Kotlin no decide nada

- **Dado** el intento de razón de permisos de salud, **cuando** llega a la actividad principal, **entonces** se reescribe a `ACTION_VIEW` con `walkingadventure://razon-de-permisos`, y de ahí lo enruta la tubería de enlaces que ya existe.
- **Dado** el Kotlin inyectado, **cuando** se lee, **entonces** reescribe **esa acción concreta y nada más**, y lleva el porqué dentro: `IntentModule` solo deja pasar `ACTION_VIEW`; esto **traduce, no decide**.
- **Dado** el lado nativo, **cuando** se busca lógica de producto en él, **entonces** no hay ninguna: **a dónde ir se decide en JavaScript**, que es donde las guardas lo ven. Ni la guarda de partida, ni la elección de pantalla, ni ninguna condición del juego viven en Kotlin.
- **Dado** el `MainActivity` parcheado, **cuando** se mira **tras el prebuild**, **entonces** el parche está aplicado y se puede leer: el plugin se verifica **por su artefacto**, igual que el manifiesto.
- **Dado** el aparato con la app instalada y **partida abierta**, **cuando** se dispara el intento por la puerta real (`adb shell am start -a androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`), **entonces** se abre **A6P6** y se escribe qué se vio. `@app`
- **Dado** el mismo aparato **recién limpiado** (`adb shell pm clear com.walkingadventure.app`) y reinstalado, **cuando** se dispara el mismo intento, **entonces** se ve **el arranque de siempre** y se escribe qué se vio: esa es la guarda de la arista. `@app`
- **Dado** la app **ya abierta** con partida lista, **cuando** el sistema dispara el intento, **entonces** también se abre A6P6. Es el estado en el que más veces va a ocurrir de verdad, y la actividad es `singleTask` (`app/android/app/src/main/AndroidManifest.xml:29`): un intento que solo se traduce en el arranque en frío deja este caso sin cubrir.
- **Dado** las dos puertas que el manifiesto declara hoy —el filtro de `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` sobre la actividad principal y el `activity-alias ViewPermissionUsageActivity` de `android.intent.action.VIEW_PERMISSION_USAGE` que también apunta a ella—, **cuando** se comprueba cuál de las dos traduce el plugin, **entonces** **las dos**, o se declara por escrito cuál queda fuera y por qué. Ninguna de las dos trae `getData()`, así que ninguna de las dos llega hoy a JavaScript.

### `walkingadventure://razon-de-permisos` es superficie pública, y se declara

- **Dado** el enlace `walkingadventure://razon-de-permisos`, **cuando** se pregunta quién puede dispararlo, **entonces** la respuesta es **cualquier aplicación del sistema**, y eso se declara en lugar de suponerse: el filtro de la razón está `exported` y el esquema es público.
- **Dado** ese enlace disparado por cualquiera, **cuando** llega, **entonces** lo peor que puede pasar es **abrir los ajustes o el arranque**: la guarda de partida ya decidida es lo que lo hace inofensivo, y no se añade ninguna comprobación de quién lo mandó.
- **Dado** ese enlace, **cuando** se compara con los dos ganchos de andamiaje, **entonces** se distingue de ellos por escrito: los ganchos de prueba son **inertes en producción** y este **no lo es ni puede serlo**, porque es la puerta por la que el sistema pregunta por qué se piden los permisos. La cabecera del módulo que lo reconoce dice esa diferencia con su motivo, y ese módulo **no es el de los ganchos de andamiaje**: compartir fichero habría sido compartir la regla de inertidad, que es lo único que hace del gancho una puerta que no es trasera.
- **Dado** ese enlace, **cuando** se busca qué escribe, **entonces** no escribe nada: navega y solo navega. No acredita metros, no toca la reserva y no cambia ningún ajuste.
- **Dado** `docs/flujo.md`, **cuando** se lee la arista hacia A6P6, **entonces** su condición **nombra el enlace y quién lo dispara**, no solo la razón de permisos: la arista es donde se declara la superficie pública.
- **Dado** `docs/flujo.md`, **cuando** se cuentan sus aristas, **entonces** hay **96** donde antes había **94** —medido: 72 continuas y 22 punteadas—, y `node scripts/verifica-flujo.mjs` pasa con 41 pantallas y ninguna suelta. La arista vuelve a entrar, así que el recuento de la spec base **no cambia por esta iteración**.

### La fila no se da por medida hasta que el bloque de Android vuelva a registrarse

- **Dado** `test/reports/manifiesto-generado.estado.json`, **cuando** se lee tras la tanda que cierre esta fila, **entonces** dice `android.mirado: true` y `completo: true`. Con `android.mirado: false` la guarda **deja constancia de que no miró nada**, y una guarda que no miró no es un verde.
- **Dado** el total de la batería, **cuando** se compara con las **2825** pruebas de antes de esta fila, **entonces** ha vuelto a su tamaño. **Bajar a 2819 no es una mejora**: es el bloque de Android que no se registró porque sin compilación no hay manifiesto fusionado.
- **Dado** el rojo ajeno del receptor de `BOOT_COMPLETED` de `expo-notifications`, **cuando** se declara su estado, **entonces** se dice que **no está verde: está sin mirar**, y vuelve a mirarse en cuanto el manifiesto se regenere. Sigue sin ser de esta fila y sigue sin arreglarse aquí, pero se mide.
- **Dado** cualquier tanda de `@app` cuyos números vayan a compararse, **cuando** se declara su precondición, **entonces** dice que se corrió tras `adb shell pm clear com.walkingadventure.app` y reinstalación. La precondición se declara junto a los números o los números no dicen nada.

### Lo que la implementación ya ratificó, y que el reparto de la base no nombraba

Dos ajustes que el implementador ya hizo y que quedan **ratificados** aquí para que el reparto de rutas de la spec base no siga incompleto:

- **Dado** `app/salida/pasos-de-fondo.js`, **cuando** se enumeran los métodos que expone `creaPasosDeFondo`, **entonces** está **`pide(fila, quiere)`**, que es el que `ConsultaMontada` ya llamaba y el que la orquestación no exportaba: era un desajuste de contrato que la spec base fichó, y su arreglo es esa ruta, que el reparto de la base no nombraba.
- **Dado** `app/plataforma/permisos.js`, **cuando** se lee `PERMISOS_QUE_SE_PIDEN`, **entonces** el campo `android` admite **una cadena o una lista**, porque los de salud son dos y Health Connect concede por tipo de dato. Los permisos declarados siguen siendo exactamente los de la base y ninguno más.

### La cláusula de salida, que se conserva

- **Dado** el parche nativo, **cuando** resulta frágil en el aparato —no se aplica en el prebuild, o el orden con el plugin de la librería lo pisa—, **entonces** **se para y se vuelve con la medida delante**: el plan pasa a ser el destino en la actividad principal sin pantalla, el hueco se ficha en `docs/pendientes.md`, y no se improvisa una tercera vía sobre la marcha.
- **Dado** esa salida, **cuando** se toma, **entonces** lo que se trae de vuelta es **la medida**, no la conclusión: qué se aplicó, qué no, y en qué orden corrieron los plugins.

## UX Design — ajuste puntual

### Wireframe textual (parte afectada)

**Ninguna pantalla cambia, y ninguna se dibuja.** El wireframe de A2P2 y el de la fila del interruptor de A6P6 de la spec base valen enteros, sin una línea de diferencia: este delta es la tubería por la que llega la orden, y la orden ya tenía destino.

Lo único que se ajusta de la sección UX de SPEC-046 es **la etiqueta de una de las dos aristas nuevas de `docs/flujo.md`**, y mantiene todo lo demás —el nodo de entrada que no es pantalla, la caída al arranque, la cautela de no tocar el subgrafo de la llegada, y el recuento de 94 a 96—. Queda así: la arista hacia **A6P6** declara, además de la razón de permisos y la condición de partida, **el enlace por el que viaja y que cualquier aplicación puede dispararlo**; la arista hacia **A1P1** conserva su condición de caída sin partida lista tal como estaba escrita.

Ese añadido no es cosmético: la arista es el único sitio del repo donde queda escrito que la app tiene una puerta pública nueva, y un enlace que solo vive en un plugin de Kotlin es exactamente el tipo de superficie que nadie vuelve a mirar.

### data-testid

**Ninguno nuevo.** El delta no añade ni un elemento localizable: A6P6 y A2P2 se alcanzan por los identificadores que la spec base ya declara, y el enlace profundo no pinta nada propio. `ajustes-pasos-de-fondo` y `ajustes-pasos-de-fondo-aviso` siguen siendo los que una prueba usa para afirmar que se llegó a A6P6 por esta puerta.

### Patrón de interacción

Una decisión nueva, y solo una:

- **El enlace profundo no es una puerta del juego y no se documenta como tal.** Regla: `docs/flujo.md` dibuja las puertas que quien juega puede tocar, y esta no la toca nadie desde dentro de la app — la abre el sistema desde fuera, igual que los rombos del diagrama no son pantallas. Por eso entra como arista de un nodo que no es pantalla y no como acción de ninguna, y por eso su condición dice **quién la dispara** en lugar de qué hay que pulsar. Ninguna pantalla del juego enseña ni menciona ese enlace.

Las tres decisiones de interacción que la spec base añadió —el interruptor que repinta sin salir y volver a entrar, la orquestación que atiende solo su fila, y el zurrón como paso obligado— siguen exactamente como están.

## Notas técnicas

### Lo medido el 12-ago-2026, contra la fuente de esta rama

| Lo que se dijo | Lo medido | Dónde |
| --- | --- | --- |
| Health Connect exige minSdk 26 | **Cierto.** `HealthConnect_minSdkVersion=26` | `node_modules/react-native-health-connect/android/gradle.properties:2` |
| El manifiesto fusionado declara 24 | **Cierto.** `<uses-sdk android:minSdkVersion="24" />` | `node_modules/expo/android/build/intermediates/merged_manifest/debug/processDebugManifest/AndroidManifest.xml:5` |
| El intento de razón no llega a JavaScript | **Cierto.** `IntentModule` devuelve `null` sin `ACTION_VIEW`/NFC **y** `getData()` | `.../com/facebook/react/modules/intent/IntentModule.kt:59-68` |
| La librería no expone el intento de lanzamiento | **Cierto.** Solo declara el filtro y el alias | `node_modules/react-native-health-connect/app.plugin.js:12,38-40` |
| La tubería de enlaces ya existe | **Cierto.** `Linking.getInitialURL()` y `addEventListener('url')` | `app/App.js:701-702`; esquema en `app/app.json:9` |
| `docs/flujo.md` tiene 94 aristas | **Cierto.** 72 continuas y 22 punteadas | `docs/flujo.md`, bloque mermaid |
| El PRD fija un mínimo de Android | **FALSO.** RNF-COM-001 solo habla de base React Native + Expo | `docs/prd.md:286` |
| El bloque de Android del manifiesto se midió | **FALSO.** `android.mirado: false`, `completo: false` | `test/reports/manifiesto-generado.estado.json` |
| `pide` faltaba en la orquestación | **Ya resuelto.** `async pide(fila, quiere)` | `app/salida/pasos-de-fondo.js:152` |
| `android` de un permiso era una cadena | **Ya resuelto.** Admite lista | `app/plataforma/permisos.js:87,262-265` |

### Por qué `withGradleProperties` es la palanca correcta aquí, medido

Esto merece escribirse porque en Expo 57 la cadena no es obvia y una palanca equivocada se descubre después de una compilación entera:

`app/android/gradle.properties` **no tiene hoy ninguna clave de minSdk**, y `app/android/build.gradle` tampoco declara un bloque `ext`: el valor sale del plugin `expo-root-project`, que hace `extra.setIfNotExist("minSdkVersion") { versionCatalogs.getVersionOrDefault("minSdk", "24") }` (`node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin/src/main/kotlin/expo/modules/plugin/ExpoRootProjectPlugin.kt:53`). Y ese catálogo **sí se deja sobrescribir por una propiedad de Gradle**: `ExpoAutolinkingSettingsExtension.kt:117` mapea `android.minSdkVersion` sobre la entrada `minSdk` del catálogo `expoLibs`. Es decir, `android.minSdkVersion=26` en `gradle.properties` llega hasta `rootProject.ext.minSdkVersion` y de ahí a `app/build.gradle:93`, y se propaga a todos los módulos de Expo y de React Native, no solo a la aplicación. Eso es exactamente lo que `withGradleProperties` escribe, y por eso el plugin propio basta y `expo-build-properties` sobra.

El implementador no tiene que fiarse de este párrafo: **la verificación sigue siendo el `uses-sdk` del manifiesto fusionado**, que es el artefacto.

### El plugin, y por qué es uno y no dos

Un solo plugin nuevo en `app/plugins/`, con las dos modificaciones dentro, porque **las dos las arrastra la misma decisión**: subir el suelo y traducir el intento son la letra pequeña de haber elegido Health Connect, y separarlas en dos ficheros repartiría un motivo entre dos sitios. Sigue el patrón de `app/plugins/retira-permisos-prohibidos.js` en todo: CommonJS con `require`, se registra en la lista `plugins` de `app/app.json`, y **abre con el porqué escrito** — con la misma honestidad de aquel, que dice lo que cierra y lo que no.

- **El suelo**, con `withGradleProperties` de `expo/config-plugins`, que ya está entre las dependencias.
- **El intento**, con `withMainActivity` de `expo/config-plugins`, que entrega el `MainActivity.kt` generado. `app/android/` está en `.gitignore` y lo produce el prebuild, así que el parche **tiene que** vivir en el plugin: editar el fichero a mano se pierde en el siguiente `expo run:android`.

Dos cautelas de mecánica, que son las que la cláusula de salida contempla: el plugin propio tiene que aplicarse **después** del de `react-native-health-connect` para no encontrarse la actividad a medio configurar —el orden es el de la lista de `app/app.json`, donde hoy `react-native-health-connect` va el último—, y la reescritura tiene que cubrir la entrada en frío y la entrada con la app viva, porque la actividad es `singleTask`.

### Reparto de rutas — solo el delta

| Ruta | Qué entrega |
| --- | --- |
| `app/plugins/lo-que-exige-health-connect.js` | el suelo de aparatos a 26 y la traducción del intento de razón, con el porqué y el coste medido dentro |
| `app/app.json` | el plugin nuevo registrado, después del de Health Connect |
| `app/plataforma/razon-de-permisos.js` | el reconocimiento del enlace `walkingadventure://razon-de-permisos`, **no inerte en producción**, con la diferencia respecto al gancho declarada en la cabecera |
| `app/App.js` | el destino de ese enlace: A6P6 con partida lista, el arranque de siempre sin ella |
| `docs/flujo.md` | las dos aristas de la spec base, con el enlace y quién lo dispara escritos en la que va a A6P6 |
| `docs/starting.md` | la entrada de la fila, con el primer cambio de suelo de aparatos del proyecto anotado como tal |
| `packages/nucleo/` | **nada**, igual que en la spec base |

### Retrocompatibilidad

- **Partidas existentes: intactas.** El delta no toca ni el estado, ni el registro, ni el formato de la partida en disco, ni la marca de agua de la lectura. Una partida guardada antes de esta iteración se abre igual después.
- **Aparatos con Android 7.0 y 7.1: dejan de estar soportados.** Es el cambio, y es el que va a la bitácora. En la práctica no hay ninguno instalado —no hay app publicada— y el aparato de pruebas es `wa-pixel`.
- **La app sin Health Connect instalado sigue degradando igual**: el interruptor no se enciende y lo dice. El suelo de aparatos no cambia esa rama ni una línea.
- **Los dos ganchos de andamiaje siguen inertes en producción.** El enlace nuevo no lo es, y por eso va aparte y con su motivo escrito, en lugar de colgarse del mismo anfitrión.

### Verificación manual sugerida

1. `cd app && npx expo prebuild --platform android --no-install --skip-dependency-update expo` y mirar dos artefactos: el `MainActivity.kt` generado, que tiene que traer el parche, y el `uses-sdk` del manifiesto fusionado tras compilar, que tiene que decir 26.
2. `adb shell pm clear com.walkingadventure.app`, reinstalar, y disparar `adb shell am start -a androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` **sin haber arrancado partida**: tiene que verse el arranque de siempre.
3. Abrir partida, dejar la app viva, y disparar el mismo intento: tiene que verse A6P6 con la fila «Contar los pasos del día a día». Repetirlo con la app en segundo plano.
4. Volver a correr la batería entera y comprobar que `test/reports/manifiesto-generado.estado.json` dice `android.mirado: true` y que el total ha vuelto a 2825, con la precondición de aparato limpio declarada junto a los números.

## Decisiones asumidas

Las **dos decisiones del dueño** —subir el suelo a 26 con plugin propio y sin dependencias, y reescribir el intento a enlace profundo— no están aquí a propósito: están tomadas, no asumidas, y viven con su motivo en la descripción y en los criterios.

- **Un solo plugin nuevo con las dos modificaciones dentro** → asumido (alternativa: dos plugins, uno por modificación). Regla: las dos las arrastra la misma decisión ya ratificada, y `retira-permisos-prohibidos.js` ya es el precedente de un plugin que hace tres cosas con un motivo común; repartir un motivo entre dos ficheros es cómo se pierde el porqué.
- **El reconocimiento del enlace vive en un módulo propio, `app/plataforma/razon-de-permisos.js`, y no dentro de `app/plataforma/gancho.js`** → asumido (alternativa: exportarlo aparte desde `gancho.js`, que es el módulo de enlaces que ya existe). Regla: `gancho.js` declara en su cabecera que **todo lo suyo es inerte en producción**, y esta entrada tiene que funcionar precisamente en producción, que es donde el sistema pregunta; compartir fichero habría sido compartir esa regla o enmendarla, y esa regla es lo único que impide que el gancho sea una puerta trasera. El módulo nuevo copia de `gancho.js` lo que sí comparten: leer la URL sin analizador de plataforma, porque el formato es fijo y un analizador de más es una dependencia que nadie ha pedido.
- **El plugin traduce las dos puertas de la razón de permisos** —el filtro de la actividad y el `activity-alias` de `VIEW_PERMISSION_USAGE`— → asumido (alternativa: solo la del filtro). Regla: ninguna de las dos trae `getData()`, así que ninguna llega hoy a JavaScript, y en Android 14 en adelante la puerta real es el alias; traducir una sola dejaría el criterio verde en el emulador y rojo en el aparato de alguien. Si por lo que sea solo se traduce una, **se declara cuál queda fuera y por qué**, que es lo que pide el criterio.
- **La reescritura cubre la entrada en frío y la entrada con la app viva** → asumido (alternativa: solo el arranque en frío, que es lo que la decisión del dueño nombra literalmente). Regla: la actividad es `singleTask` (`app/android/app/src/main/AndroidManifest.xml:29`), así que con la app abierta el intento no pasa por el arranque; y «con partida abierta» es justo el estado del criterio que más veces va a ocurrir de verdad. Es una precisión del mecanismo, no una ampliación del destino.
- **El plugin se llama por lo que Health Connect exige y no por lo que hace cada mitad** (`lo-que-exige-health-connect.js`) → asumido (alternativa: un nombre por cada modificación, que obligaría a los dos ficheros). Regla: `.claude/rules/naming.md` y el español de dominio del repo; el nombre del precedente (`retira-permisos-prohibidos`) nombra el motivo y no el mecanismo.
- **`targetSdk`, `compileSdk` y la versión de Kotlin no se tocan** → asumido (alternativa: alinearlos de paso con los que declara la librería). Regla: «no estires la fila»; lo que la dependencia **exige** es el suelo, y lo demás compila hoy. Alinearlos sería otro cambio de suelo sin medida y sin decisión.
- **El total de la batería vuelve a 2825 como criterio, y no «al menos 2819»** → asumido (alternativa: aceptar el número nuevo como línea base). Regla: el bloque que falta no desapareció, se dejó de mirar; una línea base que absorbe una guarda apagada es cómo un rojo se convierte en un verde sin que nadie mienta.
- **Sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`: esto es una app de móvil y la pantalla es la que es.
