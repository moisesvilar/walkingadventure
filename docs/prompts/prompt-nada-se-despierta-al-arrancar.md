# Encargo: la fila 52, nada se despierta al arrancar

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida). Antes de tocar nada lee `CLAUDE.md` —incluidas las trampas del runner: una tanda sin aparato se invoca con `--nucleo-only`, y `timeout` no existe en este macOS—, `.claude/rules/naming.md`, `game-design/seguridad-privacidad.md`, y de `pipeline/decisiones-orquestador.md` los apartados **§6h**, **§10-bis** y **§15**. El bucle son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

**Cada fase se lanza como subagente** (herramienta Agent), con la instrucción de seguir la skill del repo correspondiente, y tu ventana principal se queda solo con la orquestación: encargos cortos, veredictos y decisiones. **No implementes ni escribas la spec en tu ventana principal**, y los volcados largos van a disco y se leen con grep. Esta instrucción viene en el encargo que pega el dueño para que cuente como petición directa suya.

**Recursos (§14e): esta fila NO toma el emulador para su trabajo.** Todo corre en Node más una compilación (`expo run:android` con `JAVA_HOME=/opt/homebrew/opt/openjdk@17`, y el prebuild de iOS) para regenerar los artefactos que la guarda mira. Hay un único paso opcional que sí tomaría el aparato — el reinicio de comprobación del final — y si lo haces, **lo declaras antes con la lista de `pgrep` delante**, aunque el emulador esté libre. Las dos reglas del recurso compartido rigen: `pgrep` contra el patrón, y ante un proceso ajeno posible, preguntar antes de matar. Declara el hash final e inmóvil al cerrar: el cotejo corre en un worktree propio sobre él.

Tu fila es la **52, `nada-se-despierta-al-arrancar`** (SPEC-052, rama `pipeline/SPEC-052-nada-se-despierta-al-arrancar`), del bloque B8. Rationale: RNF-PRIV-001. Ratificada por el dueño el 13-ago-2026 como la siguiente del plan.

## Por qué existe esta fila

**Es la deuda más vieja que sigue viva, y el único rojo de la batería de núcleo.** La app lleva desde SPEC-023 despertándose al arrancar el móvil: `expo-notifications` declara `RECEIVE_BOOT_COMPLETED` y un receptor que escucha `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` y `MY_PACKAGE_REPLACED`. La guarda «Nada de esta app se despierta al arrancar el móvil» (`test/nucleo/manifiesto-generado.test.mjs`) **nació roja a propósito** con ese dueño escrito, en vez de nacer tolerándolo (fila 48). Tu fila la pone verde de verdad. El premio no es pequeño: **2906 casos y cero fallos, la primera batería 100 % verde del proyecto.**

## El molde ya existe, y está medido (13-ago, por quien orquesta)

**El punto 3 de `app/plugins/retira-permisos-prohibidos.js` ya hizo exactamente esto con el gemelo de `expo-task-manager`**: sustituyó su receptor por uno sin disparadores de arranque, tras medir que las posiciones se entregan con un intent **explícito** (`TaskManagerUtils.java:180` lo construye con la clase, no con la acción), así que quitarle el filtro no le quitaba nada — medido y comprobado en el emulador el 11-ago. Léelo entero antes de la spec: la cabecera declara «lo que esto cierra y lo que no», y lo que no cierra es tu fila.

**La medición central de tu fila es la misma pregunta sobre `expo-notifications`**: qué pierde la app si su receptor no escucha el arranque. Lo que hace ese receptor al arrancar el móvil es restaurar notificaciones programadas que hubieran quedado pendientes. El diseño dice que aquí no debería haber ninguna: «no hay nada que corra con la app cerrada» (el lector de salud lee al abrir; `seguridad-privacidad.md` §2), y los avisos del juego viajan por la capa de avisos en primer plano. **Pero eso se mide, no se hereda**: busca si algún camino de `app/` programa notificaciones con disparador futuro (`scheduleNotificationAsync` con trigger no nulo, o equivalente) que un reinicio dejaría huérfanas. Si no hay ninguno, el receptor no protege nada y se neutraliza con el molde del punto 3. **Si aparece uno, paras y lo traes**: decidir si esa notificación sobrevive a un reinicio sería decisión de producto, no un detalle.

Lo demás que está medido hoy:

- La app **usa** `expo-notifications` (`app/plataforma/notificaciones.js`, `notificador.js`): la neutralización es del **receptor de arranque y del permiso**, nunca de la librería ni de las notificaciones en uso.
- `RECEIVE_BOOT_COMPLETED` tendrá que salir también de donde la guarda de permisos lo tenga contemplado (`permisos.js:119` lo menciona desde SPEC-023; las listas del manifiesto — `LO_QUE_NUNCA_SE_DECLARA`, `ARRASTRE_DE_LIBRERIA` — tienen las dos direcciones vigiladas: quitar una entrada es un acto, no una limpieza silenciosa).
- **La guarda de plugins (`plugins-declarados.test.mjs`) se pondrá roja contigo** al tocar `retira-permisos-prohibidos.js`: su huella SHA-256 cambia. Está haciendo su trabajo — se renombra la huella con el cometido actualizado, nunca se ablanda la guarda.

## Cómo se trabaja aquí

Fila a fila, `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, **cada fase en su subagente**. Y estas no se negocian:

- **Nunca se edita una prueba para que pase.** La guarda roja se apaga arreglando el manifiesto, y las huellas se renombran con su cometido; borrar una exigencia sería editarla para pasar.
- **Nada se da por bueno sin verificarlo**, ni lo que diga un subagente ni lo que diga este prompt. Nueve sesiones de nueve encontraron algo falso en su encargo; si algo de aquí no se sostiene, dilo y para.
- **Los plugins traducen y retiran, no deciden**: nada de lógica de producto en lo generado, que es la convención que la guarda de lista cerrada custodia. El molde de los errores a gritos (ancla ausente = parar, no aplicar a ciegas) se conserva.
- **Todo se declara. No estires la fila.** El proveedor frío, la cara en pantalla y el botón atrás son de la 53; lo que pida una de esas, se ficha.
- **`pipeline/state.json` y la columna `Estado` no los tocas**: `done` lo declara el cotejo de quien orquesta.

## Lo que no se puede romper

- **Sin dependencias nuevas.** Ninguna. `withAndroidManifest` y compañía vienen dentro de `expo`.
- **Determinismo**, frontera del núcleo sin React Native, y la batería arrancando sin `node_modules`.
- **Las notificaciones en uso siguen funcionando**: lo que la capa de avisos entrega en primer plano no puede perder nada — y eso se afirma, no se supone.
- **Las guardas vivas**: huérfanas **0**, `piezas-sin-consumidor` vacía, contratos sin llamador **2**, límite declarado **9**, plugins **2 con su huella**, manifiesto con `mirado: true` en las dos plataformas y `completo: true` — recuerda que sin compilar el total baja y **no es una tanda mejor**.
- **Los rojos de `@app`, ajenos y leídos** (`empezar-de-nuevo-copia`, `en-marcha`, `telon` — §13b y §14c): no son tuyos y no se arreglan de paso.

## Cómo ejecutar

```bash
node --test $(find test/nucleo -type f -name '*.test.mjs' | sort)   # node --test test/nucleo/ NO funciona en Node 24
cd app && JAVA_HOME=/opt/homebrew/opt/openjdk@17 npx expo run:android    # regenera el manifiesto fusionado (JDK 26 revienta en jlink)
cd app && npx expo prebuild --platform ios --no-install --skip-dependency-update expo   # regenera el Info.plist
bash scripts/qa-tester-run.sh SPEC-052 --nucleo-only > salida.log 2>&1; echo $?   # NUNCA con | tail; sin --nucleo-only el runner TOMA el emulador
```

**Paso opcional de oro, con turno declarado**: tras compilar con el receptor neutralizado, `adb reboot` al emulador y comprobar con `dumpsys`/`logcat` que el proceso de la app **no aparece** tras el arranque. Es la verificación que ninguna otra fila ha podido hacer; si la haces, las órdenes y lo observado quedan escritos. Si no, el criterio del manifiesto basta y se declara el límite.

## Cuándo está hecho

1. **La guarda «Nada de esta app se despierta al arrancar el móvil» está verde de verdad**: el manifiesto fusionado sin `RECEIVE_BOOT_COMPLETED` y sin receptor con disparadores de arranque, medido sobre el artefacto compilado — y la guarda no se ablandó para conseguirlo.
2. **La batería de núcleo en 0 fallos** — los 2906 (más los que tu fila añada) con `mirado: true` en las dos plataformas. Primera vez; dilo en la bitácora con esas palabras.
3. **La medición de qué protege el receptor queda escrita**: o «nada programa con disparador futuro, medido así», o la parada con el hallazgo delante.
4. **Las notificaciones en uso, afirmadas**: la capa de avisos sigue entregando (sus pruebas en verde), y `plugins-declarados` verde con la huella renombrada y el cometido al día.
5. **La suite no pierde nada por el camino**: `@app` sigue en 20 · 8 · 3 · 9 si la tocas (no deberías necesitarla), y ninguna guarda baja de número sin motivo medido.
6. **Checklist y bitácora al día**, con la nota de SPEC-023 saldada, y el **hash final declarado e inmóvil**.

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
