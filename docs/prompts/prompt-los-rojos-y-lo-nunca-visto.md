# Encargo: la fila 53, los rojos y lo nunca visto

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida). Antes de tocar nada lee `CLAUDE.md` **entero y con calma** — esta fila pisa todas las trampas del aparato que ahí viven, incluidas las tres nuevas: el proveedor frío, el prebuild que no corre sobre `app/android/` existente, y `timeout` que no existe en macOS —, `.claude/rules/naming.md`, `game-design/bucle-jugable.md`, `game-design/seguridad-privacidad.md`, y de `pipeline/decisiones-orquestador.md` los apartados **§12**, **§13**, **§14**, **§15** y **§16**. El bucle son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

**Cada fase se lanza como subagente** (herramienta Agent), con la instrucción de seguir la skill del repo correspondiente, y tu ventana principal se queda solo con la orquestación: encargos cortos, veredictos y decisiones. **No implementes ni escribas la spec en tu ventana principal**, y los volcados largos van a disco y se leen con grep.

**Recursos (§14e): esta fila SÍ toma el emulador — con el protocolo entero.** Eres la primera fila con aparato desde que el método lo regula: declara la toma antes del primer `adb` (con `pgrep` contra el patrón, no de memoria, y cubre a tus subagentes), el aparato es tuyo en exclusiva hasta tu cierre, y ante un proceso ajeno posible, **preguntar antes de matar**. El árbol también es un recurso: lo tomas con la fila y lo sueltas al declarar el hash final e inmóvil — el cotejo corre en un worktree propio sobre él. Trampa heredada que te muerde seguro: **en el árbol principal, un cambio de config plugin exige `npx expo prebuild --platform android --no-install --skip-dependency-update expo` antes de compilar**, o la guarda medirá el manifiesto viejo con `mirado: true` puesto.

Tu fila es la **53, `los-rojos-y-lo-nunca-visto`** (SPEC-053, rama `pipeline/SPEC-053-los-rojos-y-lo-nunca-visto`), del bloque B8. Rationale: RF-BUCLE-001, RF-BUCLE-011, RF-BUCLE-007, RF-PERS-006, RF-PJ-009, RF-PRIV-003.

## Por qué existe esta fila

Es la primera fila con aparato tras cerrar el checklist de 52, y junta todo lo que se acumuló con esa etiqueta: los tres rojos de `@app` (todos ajenos a sus filas, todos leídos, ninguno arreglado), las dos cosas que **nadie ha visto nunca en un teléfono** (la cara de un beat en A4P3, y el comportamiento real del visor), y la segunda vía de despertar que la 52 dejó fichada. Si sale entera, `@app` queda sin rojos o con uno, y el proyecto entero — núcleo y aparato — dice la verdad en verde.

## Las tres decisiones del dueño, ya tomadas (13-ago-2026, ratificadas antes de lanzar)

**1 · La apertura cae a la última posición conocida con cota de frescura.** Hoy abrir una salida exige posición puntual y el proveedor frío la niega (trampa de `CLAUDE.md`, §13b: «Current location is unavailable» con fijo fresco en `gps` y `fused` — medido en dos cotejos). La decisión: la apertura intenta la puntual y, si no llega, acepta la última conocida **si es más fresca que una cota** — el número lo fijas midiendo (del orden de 1–2 minutos: bastante para un portal con mal cielo, poco para fijar un punto de partida viejo) y lo dejas escrito con su porqué. El motivo honesto de «sin una posición no hay punto de partida» se conserva para cuando ni siquiera haya última fresca. Cierra la entrada del proveedor frío en `docs/pendientes.md` y pide iterar la spec de la apertura (la de la 44/48 que corresponda).

**2 · El punto de partida cuenta como sitio para la cadencia — solo para la cadencia.** Medido por quien orquesta el 13-ago (sonda en worktree, números en `pipeline/plan-restante.md` §5): en el punto de partida `(0,0)`, `cadenciaDeMuestreo` devuelve `por-distancia` en **6 de 8 mundos de referencia** (geofence más cercano a 19–191 m del borde) — quien está parado en casa no recibe fijos, la parada no acumula y **el telón por regreso no puede saltar**; en los otros 2 funciona **por accidente** (un geofence pisa el anclaje: −8 y −21 m). La decisión: el punto de partida entra al índice que decide la cadencia, y **no** se convierte en sitio jugable — ni geofence de llegada, ni anclaje, ni escena. Toca `bucle-jugable` (una línea con fecha) y la iteración de spec que corresponda (SPEC-032 o la de la 44).

**3 · La propiedad de despertar se ensancha, con lista cerrada, y FCM se neutraliza.** La 52 midió la segunda vía (§16c): receptores FCM de `expo-notifications` (`FirebaseInstanceIdReceiver` con `exported="true"` + dos servicios de `MESSAGING_EVENT`), fuera de `ACCIONES_QUE_DESPIERTAN`, **inertes hoy** (sin `google-services.json`, sin llamadas de token — medido en tres direcciones). La decisión: la guarda pasa a afirmar la propiedad ancha de `permisos.js` («nada se despierta **con la app cerrada**») con una **lista cerrada de vías de despertar** — cada receptor o servicio capaz de despertar el proceso, nombrado con su motivo, rojo el que llegue sin nombrar —, y los receptores FCM **se neutralizan hoy**: no se usan, y vuelven declarados el día que el producto adopte push. Antes de elegir la forma de neutralización, **mide cómo se descubren** — la lección de la 52 es que el gemelo por-clase admite quitar el filtro entero y el por-acción no, y nadie ha medido aún de qué familia son estos. Es la segunda entrega de la fila y no se recorta.

## Las dos mediciones de la fila, con sus premisas etiquetadas

**A · ¿`empezar-de-nuevo-copia` y el botón atrás son el mismo pendiente?** Lo medido: el flujo se creía de iOS (`Share.dismissedAction`, entrada XXVIII) y **se reproduce en Android** en dos tandas independientes (fila 46), cayendo tras el `back` que cancela la hoja de compartir, con el arranque en pantalla. Y el pendiente del botón atrás (10-ago, `docs/pendientes.md`): pulsarlo donde no hay vuelta declarada **se lleva la app entera**. La sospecha etiquetada de la 46 (§14c): que el `back` de la hoja del sistema se lleve la app — el mismo pendiente con otro traje. **Mídelo con `logcat` delante**: si es el mismo, las dos entradas de `pendientes.md` se unifican y la decisión de diseño que falta (qué hace el botón atrás) se trae al dueño con la medida; si es otra cosa, defecto, dueño y fila. El rojo idealmente se apaga; si su arreglo pide la decisión de diseño, se trae en vez de inventarla.

**B · La caída del servicio en primer plano** (§12b): dos veces sin provocarla en la 49, nunca cazada con log. Tu fila conduce salidas de verdad, así que: **`adb logcat` filtrado por el task manager arrancado ANTES de abrir cada salida**, siempre. Si la caída aparece, se atribuye con el log delante; si no aparece en tus recorridos, se declara cuántos condujiste y limpio.

## Lo nunca visto, que esta fila ve

- **La cara de un beat en A4P3, con el dedo** (§15d): conduce un recorrido hasta un beat con cara (los 69 existen desde la 51; qué sitio lo tiene no es gobernable — ramifica o conduce a mano como la 49, con las coordenadas escritas) y comprueba que el bloque de quien habla pinta el rótulo del puesto y no la clave. Primera lectura humana de esa pantalla.
- **El visor con su spread** (`app/pantallas/visor.js`, fichado desde la 50): mide las cotas del nodo en el aparato. Si el spread no posiciona — como en el descarte —, el arreglo son las cuatro anclas explícitas (precedente de la fila 50, trampa en `CLAUDE.md`) y su prueba corregida sin exigir el spread; si resulta más gordo, se ficha con la medida.

## Cómo se trabaja aquí

Fila a fila, `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, **cada fase en su subagente**. Y estas no se negocian:

- **Nunca se edita una prueba para que pase.** Los verdes de `en-marcha`/`telon` tienen que ser **reproducibles desde aparato limpio y frío** — tres tandas seguidas, no una buena —, porque un verde que depende del calentamiento es el rojo de otro día (precedente: `llegada.yaml`).
- **Nada se da por bueno sin verificarlo.** Diez encargos, diez premisas falsas encontradas — incluidas dos de quien orquesta. Si algo de aquí no se sostiene, dilo y para.
- **El diseño manda**: las decisiones 1 y 2 tocan documentos (`bucle-jugable`, las specs iteradas, `pendientes.md`) y esos cambios van en la fila, con fecha. Lo que sea decisión nueva no listada aquí, se pregunta en tu ventana, con bloque ask, una viva a la vez.
- **Todo se declara. No estires la fila.** El lector de recursos del visor sigue sin dueño; `VERSION_FORMATO` global es decisión de esquema aparte; la sospecha del `typeof` (§15d) tiene su grep pendiente y no es tuya salvo que te tropiece.
- **`pipeline/state.json` y la columna `Estado` no los tocas**: `done` lo declara el cotejo de quien orquesta.

## Lo que no se puede romper

- **Privacidad**: nada nuevo sale del móvil, `@privacidad` y `@determinismo` bloqueantes, y la batería de núcleo **se mantiene en 0 fallos** — la 52 la dejó 100 % verde por primera vez y tu fila no puede ser la que lo pierda sin nombrar defecto, dueño y fila.
- **Sin dependencias nuevas.** Los plugins con lo que `expo` trae; ante un requisito de compilación, primero `app/plugins/` (método, punto 11).
- **Las guardas vivas**: huérfanas **0**, `piezas-sin-consumidor` vacía, contratos sin llamador **2**, límite declarado **9** (si tu fila saca alguno — `llegada.yaml` podría salir si la apertura con cota lo hace reproducible —, sale solo recorriendo de verdad y retirándolo de la lista en el mismo commit), `plugins-declarados` con huella y `nombraAlMenos` (tocarás plugins: renombra diciendo qué cambió), y el manifiesto con `mirado: true` **tras prebuild forzado** en árbol principal.
- **Los textos que toques** pasan por `lenguaje.md`; contenido apto para menores.

## Cómo ejecutar

```bash
emulator -avd wa-pixel -no-window -gpu swiftshader_indirect &
adb shell pm clear com.walkingadventure.app    # SIEMPRE antes de una tanda cuyos números se comparen
cd app && npx expo prebuild --platform android --no-install --skip-dependency-update expo   # OBLIGATORIO tras cambiar un plugin
cd app && JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk npx expo run:android
EXPO_PUBLIC_PROXY=http://10.0.2.2:8138 npx expo start
adb emu geo fix <lon> <lat>                    # en bucle cada 2 s para tandas; un fijo suelto envejece
adb logcat --pid=$(adb shell pidof com.walkingadventure.app) &   # ANTES de abrir cada salida (§12b)
bash scripts/qa-tester-run.sh SPEC-053 > salida.log 2>&1; echo $?   # NUNCA con | tail
adb shell run-as com.walkingadventure.app cat files/partida/partida/estado.json
```

Las demás trampas — LogBox, marcas 0×0, cotas degeneradas con `adb input tap` (Maestro no), el pliegue, `setLocation` que no mueve, permisos `granted=true` que no prueban petición, los flujos que dejan el aparato tocado — están en `CLAUDE.md` y se releen antes de medir, no después de chocar.

## Cuándo está hecho

1. **`en-marcha.yaml` y `telon.yaml` verdes desde aparato limpio y frío, tres tandas seguidas**, con la cota de frescura fijada midiendo y escrita con su porqué. La entrada del proveedor frío de `pendientes.md`, cerrada con su línea.
2. **La cadencia en el punto de partida sale `por-tiempo` en los 8 mundos de referencia** (prueba de núcleo con los números de la sonda como base), y **el telón por regreso visto en el aparato** — o su límite declarado con el `logcat` armado y lo observado escrito.
3. **La guarda de vías de despertar entregada**: lista cerrada con todas las vías nombradas y motivo, los receptores FCM neutralizados con la forma que su mecanismo de descubrimiento exija (medido antes de elegir), y el manifiesto fusionado sin ninguna vía sin nombrar — sobre artefacto con prebuild forzado.
4. **La medición A resuelta**: mismo pendiente (entradas unificadas + decisión traída al dueño) o defecto con dueño y fila — y el rojo de `empezar-de-nuevo-copia` apagado si no exige la decisión de diseño; si la exige, traída, no inventada.
5. **La cara vista y el visor medido**, con coordenadas, cotas y lo observado escritos. Lo que no se pueda firmar, declarado como límite con su motivo.
6. **La suite entera declarada con su precondición**: núcleo en 0 fallos, `@app` mejor que 20 · 8 · 3 · 9, y ningún número peor sin motivo medido.
7. **Documentos al día**: `bucle-jugable` y las specs iteradas con las decisiones 1 y 2 fechadas, `pendientes.md` sin las entradas cerradas, bitácora con fecha, decisiones, coordenadas y números, y el **hash final declarado e inmóvil**.

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
