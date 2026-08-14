# Encargo: la fila 55, el rótulo vivo de iOS

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida, **con el proyecto entero en verde** — 2975 · 2972 · 0 · 3 y @app 22 · 13 · 0 · 9, PASS del runner; tu fila no puede ser la que lo pierda). Antes de tocar nada lee `CLAUDE.md` entero, `.claude/rules/naming.md`, `docs/iphone.md`, `docs/feedback-testing-14-ago.md`, `app/plataforma/rotulo.ios.js` **entero, incluida su cabecera**, `app/plataforma/capacidades.js` y `packages/nucleo/partida/rotulo.js`. El bucle son las cuatro skills **del repo** —`wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario. **Cada fase se lanza como subagente** (herramienta Agent); tu ventana principal solo orquesta, y los volcados largos van a disco y se leen con grep. Las preguntas al dueño, en tu ventana, con bloque ask, de una en una.

Tu fila es la **55, `rotulo-vivo-ios`** (SPEC-055, rama `pipeline/SPEC-055-rotulo-vivo-ios`), del bloque B8. Rationale: la mitad iOS de RF-BUCLE-001, RF-INFRA-004 y RF-PRIV-002 (los de la fila 48, que dejó esta pareja como límite declarado). Ratificada por el dueño el 14-ago-2026.

## Por qué existe esta fila

Hoy la app corrió en un iPhone por primera vez (el estreno está en `docs/feedback-testing-14-ago.md`), y la pantalla de capacidades dijo la verdad que tenía escrita: **«Rótulo del sistema — no montada… hasta entonces, en iOS una salida no se abre.»** El dueño lo leyó en su aparato y lo dictó: se resuelve **antes de su primer paseo real**. Esta fila es la que la cabecera de `rotulo.ios.js` lleva esperando desde la 48: «quien lo cierre será la fila que nombre ese módulo».

## La dependencia, ratificada

**Módulo nativo propio, en el repo** — decisión del dueño del 14-ago-2026, con las alternativas delante (librería externa y mixto, descartadas): un módulo Expo local en Swift con su **widget extension de ActivityKit** (target propio compilado dentro de la app), gestionado por **config plugin propio** en `app/plugins/`. Consecuencias que no son opcionales: la guarda de plugins declarados (lista cerrada + huella SHA-256 + `nombraAlMenos`) se amplía con el plugin nuevo **en la misma fila**, y el `Info.plist` que mira la guarda del manifiesto tiene que salir del prebuild, no de una edición a mano.

## El contrato ya está escrito — se cumple, no se reinventa

- `rotulo.ios.js` define el mecanismo y el ciclo de vida; **el módulo nativo entra por la firma de `creaRotulo`**, como todo en `app/plataforma/`. Los textos de la línea y de la única acción los compone `packages/nucleo/partida/rotulo.js` — el widget no redacta nada.
- **`permisoPermanente: false` es sagrado**: ni `NSLocationAlwaysAndWhenInUseUsageDescription` ni `NSLocationAlwaysUsageDescription` aparecen jamás (`seguridad-privacidad.md` §2, exclusión 12). La Actividad en Vivo más el modo de ubicación en segundo plano son precisamente lo que permite no pedirlos.
- **El tope de vida real de la Actividad se mide, no se cita** (riesgo 4 del PRD): `revisaElPlazo()` compara contra él al importar, y la retirada por el sistema es un motivo propio distinto del plazo. Verificar ese tope en aparato es parte de la fila, no un detalle.
- `capacidades.js` declara que la ausencia del rótulo no admite degradar en silencio — al montarlo de verdad, esa declaración cambia de estado por el camino previsto.

## Trampas medidas hoy, en el estreno (14-ago-2026)

- **El equipo personal de firma no admite push**: el prebuild mete `aps-environment` en los entitlements (herencia del plugin de notificaciones) y con él Xcode no puede crear el perfil — hoy se retiró **a mano del artefacto generado**, que es un parche de sesión y no una solución. Tu fila compila iOS con prebuild y va a pisar esto: resuélvelo **declaradamente** (que el prebuild no lo introduzca en desarrollo, con su porqué escrito), no con otra edición a mano.
- **La trampa del prebuild de la 52 vale igual en iOS**: sobre un `app/ios/` existente, `expo run:ios` no repite prebuild — un cambio de config plugin exige `npx expo prebuild --platform ios` explícito antes de compilar, o mides el artefacto de ayer.
- **El aparato de verificación es el iPhone del dueño** (iPhone 17, UDID clásico `00008150-00047C4E3C2A401C`), y es un recurso con dueño: se coordina con él en tu ventana. La receta que hoy funciona: Metro con `EXPO_PUBLIC_PROXY=http://192.168.1.137:8138` desde `app/`, portátil e iPhone en la misma Wi-Fi, `server/arranca.mjs` vivo en el 8138. La firma ya está montada (equipo `A85NK975FC`, modo de desarrollador activo).
- **Los procedimientos iOS de la tabla de `docs/iphone.md` están sin medir** (`simctl`, contenedores, logs): lo que uses, mídelo y déjalo escrito allí — esta fila estrena esa columna.
- El **cuaderno de a bordo** (fila 54) está montado y funciona en iOS: es tu instrumento para ver qué hace la app en el aparato sin logcat — enciéndelo antes de medir y pide al dueño el JSONL cuando te haga falta.

## Cómo se trabaja aquí

Las de siempre, sin excepción: nunca se edita una prueba para que pase; nada se da por bueno sin verificarlo; todo se declara; no estires la fila (HealthKit es la 56, las teselas de A1P4 tienen su pendiente, y el bundle horneado para pasear sin Metro no es tuyo); `state.json` y la columna `Estado` no se tocan; el código de la app solo lo toca `wa-dev`, los tests solo `wa-qa-dev`.

## Cuándo está hecho

1. **El rótulo vive en la pantalla de bloqueo del iPhone del dueño**: abrir una salida la enseña con su línea y su única acción, cerrarla (o el telón) la retira, y la retirada por el sistema —si aparece— se distingue del plazo. Verificado con el dueño delante, porque el aparato es suyo.
2. **En iOS una salida se abre** — la consecuencia declarada deja de declararse, por el camino que `capacidades.js` prevé, y sin tocar ni una promesa de permisos: el manifiesto sigue sin `NSLocationAlways*`, afirmado por la guarda.
3. **El tope de vida real medido** (o acotado con el método escrito si el sistema no lo enseña entero), y `revisaElPlazo()` comparando contra el número medido.
4. **La guarda de plugins declarados ampliada** con el plugin propio y su huella, y el manifiesto iOS saliendo de prebuild limpio — incluida la resolución declarada del `aps-environment`.
5. **El PASS se mantiene**: núcleo en 0 fallos con `mirado: true` en ambas plataformas y `completo: true`, @app 22 · 13 · 0 · 9 o mejor, límite declarado en 9, ninguna guarda peor sin motivo medido.
6. **`docs/iphone.md` al día** (el rótulo pasa a preparado-y-medido; los procedimientos que midieras, a su tabla), **checklist y bitácora al día**, y el **hash final declarado e inmóvil** — el último hash ejecutable probado literal en la bitácora, con como mucho un commit documental encima (convención de la 54, §18b del registro).

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
