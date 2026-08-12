# El día del iPhone

Inventario de lo que hará falta para llevar la app a un iPhone, recogido mientras se verifica en Android para que el encargo de ese día salga de aquí y no de memoria. No es bitácora ni checklist: cuando llegue el día, de aquí salen **una o más filas del checklist** con sus specs, por el bucle de siempre. Se actualiza cada vez que una fila fiche algo con forma de iOS.

Lo medido lleva su fecha; lo demás es sospecha y **se mide de cero ese día** (§10-bis del registro: nada se hereda sin re-medir).

## Lo que ya está preparado (medido el 12-ago-2026)

- **La arquitectura ya bifurca por plataforma.** `app/plataforma/` trabaja por parejas de sufijo con las mismas exportaciones, y el registro de módulos se inyecta — montar un registro doblado es lo que permite probar «la app funciona aunque falten» sin tocar iOS.
- **`rotulo.ios.js` está escrito**: una Actividad en Vivo en la pantalla de bloqueo más el modo de ubicación en segundo plano, con la advertencia del riesgo 4 del PRD dentro (el sistema le impone un tope de vida a la Actividad). Escrito, nunca ejecutado.
- **`respaldo.ios.js` está escrito**: la copia es la de iCloud del directorio de documentos, con el mecanismo declarado y nada excluido (`isExcludedFromBackup` no se usa). Escrito, nunca ejecutado.
- **La guarda del manifiesto ya mira iOS en cada suite**: `expo prebuild --platform ios --no-install` genera el `Info.plist` sin necesitar Xcode y `manifiesto-generado.test.mjs` lo revisa. Es el único trozo de iOS que se verifica hoy de verdad.
- **Los asserts de los flujos de Maestro son multiplataforma** (testIDs), pero sus *procedimientos* no: `adb`, `pm clear`, `geo fix`, `run-as` y `logcat` son Android, y en iOS cada uno tiene un equivalente distinto que habrá que medir.

## Las decisiones que ese día exigirá del dueño

Como `expo-location` en la fila 48 y Health Connect en la 46: dependencias nativas que se ratifican **en el prompt, antes de lanzar**.

1. **HealthKit** para la fuente de salud. La fila 46 deja la pareja iOS como doble declarado (`disponible: false` con su motivo); qué módulo la rellena es elección de producto. Las restricciones del lector no cambian de plataforma: metros o pasos en ventana, nada con recorrido, zancada constante.
2. **App Attest** para la atestación del proxy. `app/plataforma/atestacion.js` lo declara: hoy no hay módulo, la política es `solo-cache` y ninguna pantalla lo menciona; el día que entre, ese fichero se parte en `.ios`/`.android` como el rótulo — está escrito dentro del propio módulo.
3. **El módulo nativo de la Actividad en Vivo**, si el que traiga Expo/`rotulo.ios.js` no basta. Verificar el tope de vida real es parte de la fila, no un detalle: de él cuelga que no haga falta el permiso de ubicación permanente (`seguridad-privacidad.md` §2, exclusión 12).

## Los rojos y deudas que esperan a iOS

- **`empezar-de-nuevo-copia.yaml`, rojo fichado desde la entrada XXVIII**: `Share.dismissedAction` es de iOS. Es el único rojo del repo cuya resolución *necesita* un aparato iOS delante.
- **Ninguna pantalla se ha visto nunca en un iPhone** (§12e). La revisión visual entera es terreno nuevo: área segura, pliegue, tipografías, y las 41 pantallas. Las trampas medidas en Android (LogBox, marcas 0×0, cotas degeneradas, el pliegue) tendrán equivalentes propios que nadie ha medido.
- **Los background modes del `Info.plist`** merecen el mismo rasero que `BOOT_COMPLETED` en Android: la guarda ya mira el artefacto; revisar qué despierta la app y por qué es parte del salto.

## Las verificaciones que cambian de forma (sospechas, medir ese día)

| En Android hoy | En iOS, previsiblemente |
| --- | --- |
| `adb emu geo fix` (y el bucle cada 2 s) | `xcrun simctl location` o GPX de Xcode; cadencia y obediencia sin medir |
| `adb shell pm clear` (aparato limpio) | desinstalar / `simctl erase`; qué borra exactamente, sin medir |
| `adb (exec-out) run-as ... cat files/...` | `simctl get_app_container` + leer el contenedor; sin medir |
| `adb logcat` | `simctl spawn log stream` / Console; sin medir |
| el proveedor frío (trampa de `CLAUDE.md`, §13b) | ¿existe un equivalente en Core Location del simulador? sin medir |
| `JAVA_HOME=17` y las variables del SDK | **esta máquina no tiene Xcode** (solo Command Line Tools; `xcodebuild` falla — medido el 12-ago-2026). Instalarlo es el paso cero |

## Cómo se ejecutará, cuando toque

Una o más filas nuevas del checklist, por el bucle de siempre y con el método del relevo (`pipeline/plan-restante.md`): prompt autocontenido que **ratifique las dependencias antes de lanzar**, subagente por fase, premisas etiquetadas como medidas o heredadas, y cotejo independiente al cierre. Este documento alimenta ese prompt. Una propuesta de troceo, que ese día se revisa: primero *compilar y ver* (Xcode, simulador, las 41 pantallas, la revisión visual), después *las capacidades* (rótulo vivo, salud, atestación — una fila cada una, que cada una trae su dependencia), y al final *la batería* (los procedimientos de la tabla, y sacar a `empezar-de-nuevo-copia` del rojo).
