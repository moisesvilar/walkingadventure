# Encargo: la fila 47, la partida persistida

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia). Antes de tocar nada lee `CLAUDE.md`, `.claude/rules/naming.md`, la entrada del 10-ago-2026 (XXVIII) de `docs/starting.md` y `pipeline/decisiones-orquestador.md` §6h. El bucle son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

Tu fila es la **47, `partida-persistida`**, del bloque B7 de `docs/checklist.md` (`RF-PERS-001`, `RF-PERS-002`, `RF-PERS-003`, `RF-PERS-008`).

## El defecto, medido

**La partida no se guarda nunca.** `congelaEstado` y `levantaEstado` existen en `packages/nucleo/partida/estado.js`, están probados, y **no se llaman desde ningún sitio de `app/`**: solo desde `test/`. `App.js` construye `estadoInicial({ semilla })` en cada arranque y el estado vive en memoria de React.

`PREFIJOS_DE_LA_PARTIDA` son cuatro —`arranque/`, `camara/`, `mapa/`, `partida/`—. La app escribe tres. **El cuarto, que es donde vive lo jugado, no lo escribe nadie**; `partida/` solo se lee, en `app/datos/copia.js`, para decidir si hay algo que exportar.

Consecuencias, y conviene tenerlas delante porque son el motivo de la fila:

- Al cerrar la app se pierden **diario, repisa, oro, motes, aventuras, entregas, rumores y NPCs**. Sobreviven el personaje, la semilla y los mapas levantados.
- **Una copia exportada hoy sale sin documento de partida.** El respaldo funciona y no respalda nada de lo jugado. Eso afecta a la fila 39, que está en `done` porque entregó el mecanismo: no la reabras, pero ten claro que su máquina lleva desde entonces sin que nadie la alimente.

Es el patrón §6h —una pieza que, al no estar, no protesta— y esta vez con una fila en `done` encima. Ya protesta: `test/nucleo/partida-persistida.test.mjs` tiene **tres casos en rojo a propósito**, puestos para que la ausencia sea error de construcción. **Tu fila termina cuando esos tres se ponen verdes por el cableado, jamás tocando la prueba.**

## Lo que hay que construir, y lo que ya está

Casi todo el mecanismo existe y está probado en Node. Lo que falta es el cableado y las decisiones de cuándo.

Ya hecho, en el paquete: `congelaEstado` / `levantaEstado` (`partida/estado.js`), la exportación y sus prefijos (`partida/exportacion.js`), la migración con su cadena de versiones (`partida/migracion.js`: `migra`, `compruebaCadena`, `VERSION_FORMATO`), la compactación (`partida/compactacion.js`: `medidaDeLaPartida`, `sella`). Y en la app: `app/datos/almacen-duradero.js`, `app/datos/copia.js`, `app/datos/reglas-de-respaldo.js`.

Lo que tienes que decidir y cablear:

1. **Cuándo se congela.** No en cada cambio de estado —eso es escribir en disco a cada paso— y no solo al cerrar, porque a una app la mata el sistema sin avisar. Piensa en los momentos del juego que ya existen (cerrar el arranque, echar el telón, cerrar una salida) y en el ciclo de vida de la app. Decláralo con su motivo.
2. **Levantar al arrancar**, antes de pintar nada, y **qué pasa si el documento no se puede levantar**. Aquí manda una regla que el repo ya aplicó en el borrado a medias (SPEC-040): una partida a medio leer que se abre, parece jugable y falla más tarde es la degradación silenciosa más cara posible. Un documento ilegible o de una versión que la cadena no cubre tiene que dar la cara, no caer al estado inicial en silencio.
3. **La migración de una partida vieja**, que es la mitad de `RF-PERS-003` y donde está el trabajo de verdad: el formato va a cambiar y la cadena existe para eso.

## Y de propina, lo que esto desbloquea

Levantar un documento al arrancar es lo que permite que `diario`, `repisa`, `empezar-de-nuevo` y parte de `mapas` tengan **contenido que una partida del día uno no tiene** —objetos, motes, dos versiones del mismo suceso, dos mapas—. Hoy esas pantallas abren y sus flujos de Maestro no pueden pasar del principio, y por eso siguen en la columna de límite declarado.

**El documento sembrado lo produce el núcleo, no una mano escribiendo JSON**: se juegan N días en headless y se congela. Si lo escribes a mano, diverge de lo que el juego produce de verdad y la prueba pasa a verificar tu JSON en vez del juego. Si al hacerlo ves que la siembra pide más de lo que esta fila abarca, **dilo y déjalo fichado** en lugar de estirar la fila.

## Cómo se trabaja aquí

Fila a fila, con `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, cada rol en su contexto. Reglas que no se negocian:

- **Nunca se edita una prueba para que pase.** Si prueba y código discrepan, alguien decide cuál está mal y **lo escribe en el propio fichero**. Los tres rojos de la guarda no se tocan: se apagan cableando.
- **Nada se da por bueno sin verificarlo**, ni lo que diga un subagente ni lo que diga este prompt. El código de salida 2 del runner (`no se pudo ejecutar`) **no es verde**.
- **Todo se declara.** Cada ambigüedad se resuelve con la opción más razonable y se deja escrita.
- **Si la premisa de este encargo no se sostiene contra lo que ves, dilo y para.** Las dos sesiones anteriores encontraron sus mejores hallazgos justo así: la premisa que les di era falsa en parte, la midieron y lo dijeron. Vale más eso que la fila entregada.

## Lo que no se puede romper

- **Determinismo.** Nada de `Math.random()`, `Date.now()` ni `new Date()` dentro de `packages/nucleo/`: `makeRng(seed + ':sufijo')`, sufijo distinto por fase.
- **`packages/nucleo/` no importa React Native ni Expo**, nunca. La E/S se inyecta.
- **La batería de núcleo arranca sin `node_modules`.** Criterio duro.
- **Sin dependencias nuevas** que no nombre una spec. Si hace falta una, se declara y se decide fuera de esta fila.
- **Privacidad**, y aquí pesa más que en ninguna otra fila porque tocas lo que se escribe en disco: **ningún rastro de ubicación se guarda, ni en la partida ni en el respaldo**; ningún identificador persistente por instalación, ni anónimo, ni «para depurar»; el anclaje real no entra en ninguna llamada de red. Los escenarios `@determinismo` y `@privacidad` son bloqueantes: nada se entrega con uno en rojo.

## Cómo ejecutar

```bash
emulator -avd wa-pixel -no-window -gpu swiftshader_indirect &
cd app && npx expo run:android
EXPO_PUBLIC_PROXY=http://10.0.2.2:8138 npx expo start
TOPE_DIARIO_GASTO=5 VERIFICADOR_ATESTACION=/ruta/al/verificador-local.mjs node server/arranca.mjs

bash scripts/qa-tester-run.sh SUITE
maestro test test/app/<flujo>.yaml
```

**`node --test test/nucleo/` no funciona en Node 24**: hay que enumerar los ficheros, `node --test $(find test/nucleo -type f -name '*.test.mjs' | sort)`.

Trampas del dispositivo que ya costaron una ronda cada una, todas en la bitácora: un `console.warn` levanta LogBox y **se come el toque** de la acción principal; `SafeAreaView` de `react-native` no hace nada en Android; una marca de 0×0 no existe para la automatización; las pantallas con lista variable empujan su acción bajo el pliegue. Y `adb` se cae más o menos un flujo por tanda, siempre distinto, en menos de un segundo y sin mensaje de aserción.

## Cuándo está hecho

1. **Los tres casos de `test/nucleo/partida-persistida.test.mjs` en verde**, apagados por el cableado. La batería entera sin más rojos que los que ya estaban fichados con su fila.
2. **Medido en el emulador**: se juega algo que deje huella —una llegada, una entrada de diario, un cambio en la repisa—, se mata la app con `adb shell am force-stop`, se vuelve a abrir y **sigue ahí**. No vale «debería»: el recorrido, hecho.
3. **Una copia exportada trae el documento de partida**, y al importarla la partida vuelve. Es lo que la fila 39 prometió y nunca pudo cumplir.
4. **Una partida de una versión anterior se migra o da la cara**, nunca cae al estado inicial en silencio.
5. La columna de límite declarado de `@app` **baja**, y baja porque hay contenido, con los flujos que salgan de ella retirados de `test/nucleo/limite-declarado.test.mjs`. Si no baja, dilo con el número delante.
6. Anotado en `docs/starting.md` con fecha, qué se decidió, qué se implementó y **con qué se verificó** — pantallas y recorridos concretos, nunca «funciona».

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
