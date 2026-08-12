# Encargo: la fila 46, la fuente de salud y el zurrón

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida). Antes de tocar nada lee `CLAUDE.md` —incluidas las trampas conocidas y las del aparato, que esta fila pisa todas—, `.claude/rules/naming.md`, `docs/specs/SPEC-043-iter-1-navegacion-de-consulta.md` (de ahí sale tu fila), y de `pipeline/decisiones-orquestador.md` los apartados **§6h**, **§10-bis** y **§13**. El bucle son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

**Cada fase se lanza como subagente** (herramienta Agent), con la instrucción de seguir la skill del repo correspondiente, y tu ventana principal se queda solo con la orquestación: encargos cortos, veredictos y decisiones. **No implementes ni escribas la spec en tu ventana principal**, y los volcados largos (suites, ficheros, jerarquías) van a disco y se leen con grep. Esta instrucción viene en el encargo que pega el dueño precisamente para que cuente como petición directa suya; la fila 50 la recibió por mensaje y no pudo obedecerla (§13c).

Tu fila es la **46, `fuente-de-salud-y-zurron`** (SPEC-046, rama `pipeline/SPEC-046-fuente-de-salud-y-zurron`), del bloque B7. Rationale: RF-RUMOR-002, RF-RUMOR-006, RF-PRIV-003. Es la última fila abierta de B7: al cerrarla, el bloque entero queda en `done`.

## La decisión del dueño, ya tomada (12-ago-2026, ratificada antes de lanzar)

**La fuente nativa de salud es Health Connect, solo Android: `react-native-health-connect` es la única dependencia nueva autorizada.** La pareja iOS queda como doble declarado —sonda con `disponible: false` y su motivo—, siguiendo la convención de `app/plataforma/` (cada fichero de plataforma tiene su pareja con las mismas exportaciones, y la app funciona aunque falte). Hoy ningún iPhone puede verificar más, y una dependencia inverificable no entra. Si por el camino aparece la necesidad de cualquier otra dependencia, te paras y lo dices.

## Por qué existe esta fila

Sale de `SPEC-043-iter-1`: recoge lo que el zurrón necesita y la navegación no dio. Son tres piezas y ninguna sirve sola —la fuente nativa de salud, el motor de pasos montado y el registro de hechos de la partida—, más el gancho `metrosDeFondo` con el que dejar una reserva puesta desde el dispositivo. Cierra el rojo fichado de `zurron.yaml` y la última pantalla huérfana del repo.

## Lo que ya está hecho, para que no lo reconstruyas

**Medido hoy** (12-ago, grep antes de escribir esto — y tú lo vuelves a medir antes de usarlo):

- `app/plataforma/lector-de-salud.js` (fila 42): el permiso, la ventana, los metros y la marca de agua, enteros y probados. La fuente nativa le llega **inyectada**. Sus decisiones de privacidad están escritas dentro y no se renegocian: metros (o pasos × `ZANCADA_M`, constante y no personalizable) en una ventana, **nada con recorrido**, lectura única al abrir, primera ventana de un día, y la marca de agua fuera de la partida y fuera de la copia (`CLAVE_DE_LA_MARCA`).
- `app/plataforma/salud.js`: la capacidad, hoy con `montado: false` y el motivo escrito — tu fila es exactamente lo que ese motivo espera.
- `app/salida/pasos-de-fondo.js`: el interruptor de los ajustes, que hoy recibe su callback a `null` porque el zurrón no está montado (§6z).
- `app/pantallas/zurron.jsx`: escrita y **huérfana** (la última de las 32; la guarda fija el recuento en 1). `antes-de-salir.jsx` ya acepta `zurron` como propiedad y ya tiene la acción `alZurron` (línea 212): la costura es que quien monta se los pase, la misma forma que A2P0 en la fila 50.
- El motor de pasos del núcleo (`packages/nucleo/partida/kilometros.js`, `kilometrosDeFondo`, `tamanoDeLaReserva`) está en `app/nucleo/piezas.js` y `pasos-de-fondo.js` ya lo consume.

**Del registro de hechos de la partida** manda lo que diga `SPEC-043-iter-1`; si al medirlo encuentras que algo de lo que declara ya existe o ya no es verdad, lo dices con la medida delante — seis de seis sesiones encontraron algo así y fue siempre lo más valioso.

## Privacidad, que es la mitad de esta fila

`@privacidad` es bloqueante y RF-PRIV-003 es tuyo. En concreto:

- A Health Connect se le pide **lo mínimo que mueve un contador**: registros de distancia o de pasos en una ventana. Ni entrenamientos, ni sesiones con ruta, ni frecuencias, ni nada del cuerpo.
- Los permisos de Health Connect entran en el manifiesto fusionado, y **la guarda del manifiesto generado los va a ver** (`manifiesto-generado.test.mjs`, mira las dos plataformas). Los que pidas quedan declarados y justificados; uno que no uses es rojo tuyo.
- Nada del zurrón sale del móvil, y la marca de agua sigue fuera de la copia: el precio de esa decisión está escrito en el propio lector y se conserva.

## Cómo se trabaja aquí

Fila a fila, `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, **cada fase en su subagente**. Y estas no se negocian:

- **Nunca se edita una prueba para que pase.** Si prueba y código discrepan, alguien decide cuál está mal y **lo escribe en el propio fichero** (precedente en la 50: su propia prueba exigía el estado roto).
- **Nada se da por bueno sin verificarlo**, ni lo que diga un subagente ni lo que diga este prompt. Si algo de aquí no se sostiene, dilo y para.
- **Las decisiones del dueño se preguntan en tu ventana, con bloque ask, una pregunta viva a la vez.** La fuente de salud ya está decidida; lo que surja de nuevo, se pregunta, no se resuelve de paso.
- **Todo se declara.** Cada ambigüedad se resuelve con la opción más razonable y se deja escrita.
- **No estires la fila.** `escena.cara` tiene fila corta propia; el visor con su spread fichado no es tuyo; la decisión del proveedor frío (`docs/pendientes.md`) tampoco. Lo que pida una de esas, se ficha.
- **`pipeline/state.json` y la columna `Estado` del checklist no los tocas**: son de quien orquesta, y `done` lo declara el cotejo independiente, no la propia fila (`naming.md`).

## Lo que no se puede romper

- **Determinismo.** Nada de `Math.random()`, `Date.now()` ni `new Date()` en `packages/nucleo/` — y ojo aquí: el reloj real de la ventana de salud vive en `app/`, del lado del lector, **nunca cruza al núcleo** (SPEC-016: ni el estado ni el registro llevan marca del reloj real). Lo que cruza son metros, un número.
- **`packages/nucleo/` no importa React Native ni Expo.** La E/S se inyecta.
- **La batería de núcleo arranca sin `node_modules`.** Criterio duro.
- **La dependencia nueva es una y está autorizada arriba.** La lista cerrada de dependencias la vigila; declárala donde la lista manda.
- **Contenido apto para menores** y textos que se leen en voz alta, si tocas alguno.
- **Las guardas vivas te vigilan a ti**: `pantallas-huerfanas.test.mjs` (hoy 1, `zurron.jsx` — tu fila lo deja en **0**, y ese cero es histórico: es la primera vez desde que existe la guarda), `contratos-sin-llamador.test.mjs`, `piezas-sin-consumidor.test.mjs` (vacía, no puede dejar de estarlo), `limite-declarado.test.mjs` (hoy **8** — `zurron.yaml` no está ahí: su rojo es rojo de verdad y tu fila lo apaga), la guarda del manifiesto generado y las aristas de `verifica-flujo.mjs`. Tocar el zurrón puede tocar `docs/flujo.md`: si cambias una pantalla, el diagrama va en el mismo commit.
- **Los rojos actuales, todos con lectura escrita**: 1 de núcleo (`BOOT_COMPLETED`, SPEC-023), `empezar-de-nuevo-copia` (iOS), y `en-marcha` + `telon`, que son **rojo esperado desde aparato limpio** (proveedor de ubicación frío, §13b y la trampa de `CLAUDE.md`) — no son tuyos y no intentes arreglarlos de paso. Un rojo nuevo solo se acepta nombrando defecto, dueño y fila.

## Cómo ejecutar

```bash
emulator -avd wa-pixel -no-window -gpu swiftshader_indirect &
cd app && JAVA_HOME=/opt/homebrew/opt/openjdk@17 npx expo run:android   # JDK 17, no 26; y abre la app sola al instalar
EXPO_PUBLIC_PROXY=http://10.0.2.2:8138 npx expo start
TOPE_DIARIO_GASTO=5 VERIFICADOR_ATESTACION=/ruta/al/verificador-local.mjs node server/arranca.mjs

adb shell pm clear com.walkingadventure.app   # ANTES de cualquier tanda cuyos números se comparen; luego reinstalar
bash scripts/qa-tester-run.sh SUITE > salida.log 2>&1; echo $?     # NUNCA con | tail
maestro test test/app/zurron.yaml
adb shell run-as com.walkingadventure.app cat files/partida/partida/estado.json
adb exec-out run-as com.walkingadventure.app cat <ruta>   # JSON grande: con shell sale corrompido
```

`node --test test/nucleo/` no funciona en Node 24: enumera los ficheros. `ANDROID_HOME=$HOME/Library/Android/sdk`, `platform-tools` y `emulator` fuera del PATH. El resto de trampas —LogBox, `SafeAreaView`, marcas 0×0, el pliegue, cotas degeneradas, `setLocation` que no mueve, el proveedor frío— están en `CLAUDE.md`.

**Sobre verificar los pasos de fondo, heredado del plan y a medir por ti**: el emulador no simula pasos fácil. La sospecha de quien orquesta es que la verificación real será por capas — el contrato del lector con dobles en Node, la sonda de capacidad con la fuente real montada en el aparato, la reserva dejada por `metrosDeFondo` leída con `run-as`, y la lectura de Health Connect de verdad **solo si el emulador lo permite** (wa-pixel puede traer el módulo del sistema o necesitar la app de Health Connect; hay APIs para escribir registros sintéticos — mídelo antes de darlo por imposible **y antes de darlo por hecho**). Si la lectura real no se puede firmar en esta máquina, se declara como límite con lo que sí se afirmó, igual que hace `limite-declarado`.

## Cuándo está hecho

1. **La sonda de salud dice la verdad nueva**: con la fuente montada, `salud.sonda()` declara `montado` y `disponible` de verdad; sin permiso o sin Health Connect, lo declara con su motivo — y el gancho de capacidad ausente sigue en pie (la app funciona aunque falte, `gancho-capacidad-ausente.yaml` lo afirma).
2. **El interruptor de los ajustes se enciende de verdad** y su callback deja de ser `null`: encenderlo con fuente disponible lee al abrir; encenderlo sin fuente es imposible por construcción, no un toggle que miente.
3. **El zurrón se ve y deja de ser huérfano**: `zurron.jsx` montada desde la portada (`alZurron` ya existe), **pantallas huérfanas 1 → 0**, y `zurron.yaml` pasa en verde recorriendo de verdad, desde aparato limpio.
4. **La reserva funciona de punta a punta**: `metrosDeFondo` deja reserva desde el dispositivo, visible en el zurrón y leída con `run-as`, y el motor la consume como dice el diseño (`game-design/` manda sobre cupos y topes; antes de cambiar un número, lee el documento).
5. **La suite entera desde aparato limpio no gana rojos**: base 2825 · 2821 · 1 · 3 de núcleo y 20 flujos con los cuatro rojos leídos arriba — `zurron.yaml` sale del rojo, así que @app mejora; si algún número tuyo da peor, el motivo medido delante.
6. **El checklist y la bitácora dicen qué entregaste**: la fila 46 salda sus tres piezas, B7 queda entero, y `docs/starting.md` lleva fecha, decisiones, implementación y verificación con coordenadas y semillas concretas. `docs/pendientes.md` no gana deudas nuevas sin decir por qué.
7. La dependencia queda declarada donde la lista cerrada manda, el manifiesto fusionado justifica cada permiso nuevo, y `@determinismo` + `@privacidad` en verde.

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
