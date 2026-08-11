# Encargo: la fila 44, la navegación en la calle

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida). Antes de tocar nada lee `CLAUDE.md` —incluidas las trampas conocidas—, `.claude/rules/naming.md`, `docs/flujo.md`, y de `pipeline/decisiones-orquestador.md` los apartados **§6h**, **§6r**, **§6v**, **§7** y **§8**. El bucle son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

Tu fila es la **44, `navegacion-en-la-calle`**, del bloque B7 (`RF-BUCLE-005`, `RF-BUCLE-007`, `RF-BUCLE-011`, `RF-QUEST-004`, `RF-PRIV-004`).

## Dónde empiezas, que es mejor sitio del que parece

La fila 48 acaba de cerrarse y te deja el terreno hecho: **la app lee el GPS**, `app/plataforma/ubicacion.js`, `app/marcha/seguidor.js` y `app/plataforma/posiciones.js` tienen llamador de verdad, el rótulo del sistema está montado en Android, y **el momento en marcha se recorre entero en el emulador — 103 s medidos**. Ya no estás bloqueada por nada.

En el paquete tienes hecho y probado `packages/nucleo/partida/llegadas.js`: `geofenceDe`, `distanciaAlGeofence`, `sitiosConPosicion`, `RADIO_DE_GEOFENCE_M`, `PERMANENCIA_S`, y los vocabularios cerrados `LO_QUE_VALIDAR_NO_EXIGE`, `LO_QUE_UNA_LLEGADA_EMITE` y `LO_QUE_UNA_LLEGADA_NO_EMITE`. Y en `app/pantallas/` ya existen `llegada.js`, `visor.js`, `lo-que-se-cuenta.js`, `descarte.jsx`, `sitios-marcados.jsx`, `ficha.js` y `ofrecimiento.jsx`.

Lo que falta es lo de siempre en este proyecto: **el camino que las une**. `docs/flujo.md` lo declara y manda sobre lo que se te ocurra — si una transición no está allí, o la propones y se añade al documento (que es cambio de diseño y se trata como tal) o no existe.

## Las cuatro deudas que heredas, y que son tuyas desde el minuto uno

Están en `pipeline/decisiones-orquestador.md` §8, verificadas contra la fuente. No son sugerencias: son el estado real del terreno que pisas.

**a · `descongelada` no lo afirma ninguna prueba.** La palabra aparece **solo** dentro de `app/marcha/salida.js`, ni una vez en `test/`. Es la red que la 48 puso contra el estado congelado, y su propio comentario dice que si salta, **lo que se abra no está en la partida que se congela**: la salida se ve en pantalla y se pierde al guardar. Una red que al dispararse no protesta. **Ciérrala con una prueba que exija `descongelada === false` en el camino normal**; es una línea y es lo primero que haría yo.

**b · `sitio` va siempre a `null`, y lo rellenas tú.** `app/marcha/seguidor.js:125`. El contrato promete `{clasificacion, x, y, sitio}` y el cuarto campo es estructuralmente nulo hasta que tu geofence lo resuelva. Y ojo: **nada se pone rojo si aterrizas y te olvidas**. Es la misma forma que el `anclaje: null` de §6p, que se cerró exponiendo `sitiosSinAnclajeReal()`; aquí no hay equivalente y lo tienes que traer tú.

**c · La costura que más miedo da: el reloj de permanencia contra el hueco del segundo plano.** `regreso.js:126` hace `dentroDesdeMs = dentro ? (previa.dentroDesdeMs ?? tMs) : null`, o sea que **el reloj se reinicia entero en cuanto llega una posición fuera del radio**; y la 48 decidió que al volver del segundo plano se vuelve a anclar en vez de coser el hueco. Juntas: alguien parado dentro de un geofence, la app pasa a segundo plano, vuelve, y la primera posición cae un metro fuera por ruido del GPS → permanencia a cero y la llegada no valida. **Cuidado con las dos constantes homónimas**: `PERMANENCIA_S` son 20 s en `llegadas.js` y **60 s en `regreso.js`**, y el reinicio vive en la segunda, así que la ventana de exposición es la larga. No está medido. Si ves llegadas que no validan «a veces» y sin patrón, **mira aquí antes que en el geofence**.

**d · Y el número que nadie ha medido y que deberías medir tú antes de dar la fila por buena:** `RADIO_DE_GEOFENCE_M = 40` contra `ERROR_MAXIMO_FIABLE_M = 30` de `transporte.js`. En el emulador el GPS es perfecto y esto no dice nada; en una calle estrecha real el error se va a 30-50 m, así que **una fracción de las posiciones se descarta por poco fiable justo donde más falta hace**. Nadie sabe qué fracción. Si el número sale feo, es una decisión de diseño y se escala, no se ajusta una constante por tu cuenta.

## Un aviso de contabilidad, que en este repo ha costado caro

Tu fila declara `RF-QUEST-004` y `RF-BUCLE-011`, y **las dos son de la escena del beat (A4P3) y del telón (A5), que son la fila 49**. No las entregues: entrégale a la 49 lo que le toca y **di explícitamente en el checklist qué RF entrega esta fila y cuáles pasan a la 49**.

El motivo es que ya pasó dos veces: SPEC-034 y SPEC-036 se cerraron en `done` **sin tocar un solo fichero de `app/`**, y el fallo no fue de nadie en concreto, fue que la definición de hecho de una fila de pantalla no exigía la pantalla. Una fila que cierra cubriendo un RF que no entregó es un agujero que tarda meses en salir. La 48 ya dejó un hueco declarado de una sola acción para el telón: mira cómo lo hizo y sigue ese patrón.

## Cómo se trabaja aquí

Fila a fila, `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, cada rol en su contexto. Y estas no se negocian:

- **Nunca se edita una prueba para que pase.** Si prueba y código discrepan, alguien decide cuál está mal y **lo escribe en el propio fichero**.
- **Nada se da por bueno sin verificarlo**, ni lo que diga un subagente ni lo que diga este prompt. Las cuatro sesiones anteriores dieron sus mejores hallazgos midiendo la premisa que les di y encontrándola falsa en parte; una encontró así **un fallo de privacidad que iba a salir en el paquete**. Si algo de aquí no se sostiene, dilo y para.
- **Desconfía de la conclusión que te ahorra trabajo.** «Esto no se puede verificar en esta máquina» fue la frase que estuvo a punto de dejar pasar ese fallo. Es la que hay que mirar dos veces.
- **Todo se declara.** Cada ambigüedad se resuelve con la opción más razonable y se deja escrita.

## Lo que no se puede romper

- **Determinismo.** Nada de `Math.random()`, `Date.now()` ni `new Date()` en `packages/nucleo/`.
- **`packages/nucleo/` no importa React Native ni Expo.** La E/S se inyecta.
- **La batería de núcleo arranca sin `node_modules`.** Criterio duro.
- **Sin dependencias nuevas** que no nombre una spec. Si hace falta una, te paras y lo dices: la 48 pidió una segunda y la decisión la tomó el dueño, no la sesión.
- **Privacidad, y aquí toca de lleno**: `RF-PRIV-004` es tuyo —el anclaje que no vale lo descarta quien juega, con un gesto **reversible** que anota **sin resembrar**—. Y sigue en pie todo lo demás: **ninguna traza de ubicación se guarda**, ni un identificador persistente por instalación, y el anclaje real no entra en ninguna llamada de red. `@determinismo` y `@privacidad` son bloqueantes.

## Cómo ejecutar

```bash
emulator -avd wa-pixel -no-window -gpu swiftshader_indirect &
cd app && npx expo run:android
EXPO_PUBLIC_PROXY=http://10.0.2.2:8138 npx expo start
TOPE_DIARIO_GASTO=5 VERIFICADOR_ATESTACION=/ruta/al/verificador-local.mjs node server/arranca.mjs

bash scripts/qa-tester-run.sh SUITE > salida.log 2>&1; echo $?
maestro test test/app/<flujo>.yaml
adb emu geo fix <lon> <lat>     # mover el aparato: así se recorre una llegada sin salir a la calle
```

**Dos trampas del instrumental, las dos medidas.** `bash scripts/qa-tester-run.sh X | tail -3` **devuelve el código de `tail`**, así que un 2 —«no se pudo ejecutar», que no es verde— se lee como un 0 limpio: redirige y mira `$?`. Y `node --test test/nucleo/` no funciona en Node 24: enumera los ficheros.

**Trampas del dispositivo**, todas medidas y en la bitácora: un `console.warn` levanta LogBox y **se come el toque** de la acción principal; `SafeAreaView` de `react-native` no hace nada en Android; **una marca de 0×0 no existe** para la automatización —la 48 se encontró seis apiladas en `[0,0][3,3]`—; las pantallas con lista variable empujan su acción bajo el pliegue. Y `adb` se cae más o menos un flujo por tanda, sin mensaje de aserción y en menos de un segundo; §7 explica cómo separar esa caída de un fallo de verdad.

## Cuándo está hecho

1. **Una llegada recorrida entera en el emulador**, moviendo el GPS con `adb emu geo fix`: en marcha → entrar en el geofence → llegada → visor → lo que se cuenta. Con las coordenadas escritas, no «funciona».
2. **El descarte de un anclaje, hecho y deshecho**, comprobando que anota y **no resiembra** el mundo.
3. **`descongelada` afirmado** y **`sitio` dejando de ser `null`**, con algo que se ponga rojo si mañana vuelve a serlo.
4. **La columna de límite declarado baja de 8**. Lo honesto que puede salir son tres —`llegada`, `visor`, `descarte`—; `escena` es de la 49, `diario` y `repisa` piden la siembra fichada en la 47, `mapas` pide dos mapas y el ofrecimiento, y `ajustes-filas-de-valor` es de la 38. **Si sale menos, dilo con el número delante**: la sesión de la 47 corrigió el suyo a peor y fue lo mejor que hizo, y la de la 48 avisó de que un número no se movería antes de que nadie se lo preguntara.
5. **La suite no gana rojos que no sean tuyos y con dueño escrito.** Hoy hay uno de núcleo —el receptor de arranque de `expo-notifications`, de SPEC-023— y dos de `@app` —`empezar-de-nuevo-copia` y `zurron`—. Si añades uno, que nombre el defecto, la fila que lo arregla y por qué no es tuyo.
6. Anotado en `docs/starting.md` con fecha, qué se decidió, qué se implementó y **con qué se verificó**.

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
