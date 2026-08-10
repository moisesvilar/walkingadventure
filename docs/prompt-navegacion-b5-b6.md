# Encargo: cablear la navegación de B5 y B6 en `app/`

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y al día con `origin/main`). Antes de tocar nada, lee `CLAUDE.md`, `.claude/rules/naming.md` y `pipeline/informe-final.md` §8. El bucle del pipeline son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario: aquellas asumen un stack web con Supabase, shadcn y Playwright que aquí no existe.

## Qué está hecho y qué no

Las 42 filas de `docs/checklist.md` están en `done` y la batería de núcleo está en verde: **2603 casos, 2600 pasan, 0 fallan, 3 saltados**. Todo el juego —llegadas, geofences, visor, escena, telón, diario, repisa, mapas múltiples, respaldo— está implementado y probado **en Node**.

Lo que falta es la puerta. `app/App.js` no tiene máquina de estados: tiene cuatro banderas (`enArranque`, `partida`, `salida`, más los pasos provisionales) y con eso encadena exactamente esto:

```
arranque (A1P1…A1P7) → portada (A2P1) → lo que hay hoy (A2P3) → en marcha (A3P1)
```

Y ahí se acaba. **Doce pantallas están escritas, montadas y sin camino**: `ficha`, `preparacion`, `ofrecimiento`, `llegada`, `visor`, `descarte`, `sitios-marcados`, `lo-que-se-cuenta`, `diario`, `repisa`, `ajustes`, `empezar-de-nuevo`, más `zurron` y `mapas`. Existen en `app/pantallas/`; no se pueden abrir en un teléfono.

Eso se ve en los flujos de Maestro. Doce de los dieciséis llevan el marcador `# @limite-declarado`: **su verde afirma que su pantalla sigue sin existir**, no que funcione. El runner los cuenta en una casilla aparte y `test/nucleo/limite-declarado.test.mjs` fija la lista exacta. El recuento de hoy, medido:

| | |
| --- | --- |
| Ejecutados | 16 |
| Recorren la app y pasan | 2 (`arranque`, `antes-de-salir`) |
| Rojos | 2 — uno real (`zurron`: no hay puerta a los ajustes) y uno por caída de `adb` |
| Solo comprueban su límite | 12 |

**Tu encargo es que esa columna de doce baje**, y que baje porque hay camino, no porque se quite el marcador.

## La decisión que hay que tomar la primera, y por escrito

Los doce flujos entran por identificadores de **pasos provisionales** que vivían en la pantalla de andamiaje y que hoy son inalcanzables, porque desde SPEC-027 la app abre en el arranque:

| Flujo | Entra por |
| --- | --- |
| `ajustes`, `empezar-de-nuevo` | `paso-ajustes` |
| `diario` | `paso-diario` |
| `repisa` | `paso-repisa` |
| `llegada`, `visor`, `descarte` | `paso-llegada` |
| `escena` | `paso-escena` |
| `en-marcha` | `paso-marcha` |
| `mapa` | `paso-mapa` |
| `andamiaje`, `gancho-capacidad-ausente` | `pantalla-andamiaje` |
| `mapas` | `portada` |

Hay dos caminos y **no son equivalentes**:

- **(a) Devolver la tira de pasos provisionales** a algún sitio alcanzable. Barato, y deja doce pantallas verificadas por una puerta que ningún jugador usa. Es deuda con forma de verde.
- **(b) Cablear la navegación de verdad** que declara `docs/flujo.md` —que es la fuente normativa del recorrido, con sus 40 pantallas y sus aristas etiquetadas— y **reescribir los flujos para que entren por donde entra una persona**.

**Recomendación: (b)**, y los pasos provisionales se retiran al hacerlo. La razón está medida en este repo: durante toda la ejecución del checklist el patrón que más caro salió fue *una pieza que, al no estar, no protesta* (siete apariciones, `pipeline/decisiones-orquestador.md` §6h), y una puerta de servicio que solo abre la prueba es exactamente eso. Si eliges (a), o una mezcla, **decláralo por escrito con su motivo** antes de escribir código.

`docs/flujo.md` manda sobre lo que se te ocurra: si una transición no está declarada allí, no te la inventes — o la propones y se añade al documento, que es lo mismo que hacer un cambio de diseño y hay que tratarlo como tal.

## Cómo se trabaja aquí

Fila a fila, con el bucle `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, y cada rol en su propio contexto. Quien orquesta es el único que escribe `pipeline/state.json`, la columna `Estado` de `docs/checklist.md` y el veredicto entre defecto de prueba y defecto de código. Reglas que no se negocian:

- **Nunca se edita una prueba para que pase.** Si una prueba y el código discrepan, alguien decide cuál está mal y lo escribe. Si la prueba estaba equivocada, se arregla **explicando por qué en el propio fichero**, no en silencio.
- **Nada se da por bueno sin verificarlo.** Ni lo que diga un subagente ni lo que diga este prompt. El código de salida 2 del runner (`no se pudo ejecutar`) **no es verde**.
- **Todo se declara.** Cada ambigüedad se resuelve con la opción más razonable y se deja escrita.

## Las trampas del dispositivo, que ya costaron cuatro rondas

Están todas en `docs/starting.md`, entrada del 10-ago-2026. Las cuatro que te van a morder si no las sabes:

1. **Un `console.warn` levanta LogBox**, que es una franja al pie que **no aparece en el árbol de accesibilidad** y **se come el toque** de la acción principal. Costó que la app no pasara de A1P6, y el diagnóstico fácil («la app no repinta») era falso. Si la app avisa de algo en desarrollo, tienes un botón muerto.
2. **`SafeAreaView` de `react-native` no hace nada en Android.** Usa `app/plataforma/area-segura.jsx`.
3. **Una marca de 0×0 no existe** para ninguna automatización de interfaz: sale con `visible: false` y Maestro la salta. Si una prueba tiene que verla, tiene que medir algo (`app/pantallas/marca.js`).
4. **Las pantallas con lista de longitud variable desbordan**: la acción principal se va bajo el pliegue según cuántas aventuras casteen. Son `ScrollView`; la prueba tiene que bajar.

Y una de entorno: **`adb` se cae más o menos un flujo por tanda**, siempre distinto, y sale rojo en menos de un segundo y sin mensaje de aserción. No es la app. No lo arregles a ciegas ni lo declares infraestructura de forma automática, que sería justo el agujero que el runner existe para tapar.

## Cómo ejecutar

```bash
# el emulador (créalo si no existe: AVD wa-pixel, API 35)
emulator -avd wa-pixel -no-window -gpu swiftshader_indirect &
cd app && npx expo run:android            # compilación de desarrollo instalable
EXPO_PUBLIC_PROXY=http://10.0.2.2:8138 npx expo start   # Metro; el 10.0.2.2 es el host desde el emulador
# el proxy ciego, en el 8138. Se niega a arrancar sin las dos variables, y es a propósito:
# sin tope de gasto, y con un verificador que acepta a cualquiera, sería un proxy con las
# claves abiertas. Para desarrollo vale un verificador de usar y tirar **fuera del repo**,
# un módulo que exporte `creaVerificador()` devolviendo `{ async verifica() { return { valida: true, motivo: null }; } }`.
TOPE_DIARIO_GASTO=5 VERIFICADOR_ATESTACION=/ruta/al/verificador-local.mjs node server/arranca.mjs

bash scripts/qa-tester-run.sh SUITE       # la batería entera, y lo único que hay que leer
bash scripts/qa-tester-run.sh SUITE --app-only
maestro test test/app/<flujo>.yaml        # un flujo suelto, para iterar
```

`JAVA_HOME=/opt/homebrew/opt/openjdk` y `ANDROID_HOME=$HOME/Library/Android/sdk`; el runner los resuelve solo y declara en el report cuáles usó.

**Ojo con la batería de núcleo:** `node --test test/nucleo/` **no funciona en Node 24** —trata el directorio como fichero y falla con `MODULE_NOT_FOUND`—. Hay que enumerar los ficheros: `node --test $(find test/nucleo -type f -name '*.test.mjs' | sort)`.

## Lo que no se puede romper

- **Determinismo.** Nada de `Math.random()`, `Date.now()` ni `new Date()` dentro de `packages/nucleo/`: `makeRng(seed + ':sufijo')`, con sufijo distinto por fase.
- **`packages/nucleo/` no importa React Native ni Expo**, nunca. La E/S se inyecta.
- **La batería de núcleo arranca sin `node_modules`.** Es criterio duro: el día que la red de seguridad del determinismo dependa de una instalación, deja de ser una red.
- **Sin dependencias nuevas** que no nombre una spec. Si de verdad hace falta una, se declara y se decide, no se cuela.
- **Privacidad**: del móvil salen solo las coordenadas al generar el mundo y prompts sin ningún dato real. Ningún identificador persistente por instalación, ni anónimo, ni «para depurar». Ningún rastro de ubicación, ni en la partida ni en el respaldo. Los escenarios `@determinismo` y `@privacidad` son bloqueantes.
- **Contenido apto para menores**, que es principio de especificación y no un detalle.

## Cuándo está hecho

No cuando compile: cuando se pueda **medir**.

1. `bash scripts/qa-tester-run.sh SUITE` con **la columna de límite declarado bajada**, cada flujo que sale de ella recorriendo su pantalla de verdad, y su entrada retirada de `test/nucleo/limite-declarado.test.mjs`. Un flujo que tarda diez segundos no ha recorrido nada: los que recorren pasan del minuto.
2. **`zurron.yaml` en verde**, que es el rojo real de hoy y muere en `paso-ajustes`.
3. La batería de núcleo intacta —2600 pasando, 0 fallando— **con y sin `node_modules`**.
4. Una **partida completa jugada en el dispositivo**, de puerta a puerta: salir a andar, llegar a un sitio, abrir el visor, jugar un beat, echar el telón, mirar el diario, volver a abrir la app y que la partida siga ahí. Las dos veces que alguien recorrió el camino entero en este proyecto encontró lo que ninguna prueba unitaria veía —la segunda descubrió que **ninguna aventura se podía terminar**, 102 de 102—, y no es casualidad: los defectos viven en las costuras entre filas.
5. Anotado en `docs/starting.md` con fecha, qué se decidió, qué se implementó y **con qué se verificó** — mundos y pantallas concretas, nunca «funciona».

Y lo último, que es lo que más vale cuando alguien lea el resultado dentro de un año: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
