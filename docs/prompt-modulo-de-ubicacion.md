# Encargo: la fila 48, el módulo de ubicación

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia). Antes de tocar nada lee `CLAUDE.md`, `.claude/rules/naming.md`, `game-design/seguridad-privacidad.md`, las entradas del 10 y 11 de agosto de 2026 de `docs/starting.md` y `pipeline/decisiones-orquestador.md` §6h. El bucle son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

Tu fila es la **48, `modulo-de-ubicacion`**, del bloque B7 de `docs/checklist.md` (`RF-BUCLE-001`, `RF-BUCLE-005`, `RF-BUCLE-006`, `RF-INFRA-004`, `RF-PRIV-002`).

## El defecto, medido

**La app no sabe leer el GPS.** `app/package.json` no declara ningún módulo de ubicación. Los dos contratos que lo esperan existen, están escritos y están probados contra dobles en `node --test`:

- `app/plataforma/ubicacion.js` — `creaProveedorDeUbicacion({ pidePermiso, leePosicion })`, el del arranque.
- `app/marcha/seguidor.js` — `creaSeguidorDePosicion({ lee })`, el del momento en marcha, que entrega posiciones **ya clasificadas** (andando · parada · vehículo · ambiguo).

Los dos reciben el módulo nativo **en `null`**. Por eso A1P4 funciona cayendo a elegir el punto a mano, y por eso no hay geofences, ni llegadas, ni posición en marcha: **B5 entera** depende de esto. Bloquea los flujos `en-marcha`, `llegada`, `visor`, `escena` y `descarte`.

## La dependencia, ya decidida

**`expo-location`.** Ratificada por el dueño del proyecto antes de abrir esta fila, así que no la vuelvas a debatir: recógela en la spec con su motivo. Las razones son que la app ya lleva `expo-haptics`, `expo-notifications` y `expo-file-system` —es la familia coherente— y que da el permiso «mientras se usa» que el diseño exige.

Es la **única** dependencia que esta fila puede añadir. Si al implementar descubres que hace falta otra, **no la metas**: párate y dilo.

## Lo que no se negocia, y aquí pesa más que en ninguna otra fila

`app/plataforma/ubicacion.js` ya lo tiene escrito en su cabecera, y son las tres cosas que su contrato promete:

- **Solo «mientras se usa».** El permiso permanente de fondo **no se pide nunca**, y ninguna pieza del juego lo necesita (`seguridad-privacidad.md` §2). Si te ves pidiéndolo, has tomado un atajo por el sitio equivocado.
- **No se guarda nada.** La posición viaja a la marca de A1P4 y de ahí al anclaje redondeado. Ni la posición, ni una traza, ni una marca de tiempo llegan a escribirse. El seguidor de marcha es el momento por el que más posiciones pasan, y **lo que sobrevive de todas ellas es nada**.
- **Ningún identificador persistente por instalación**, ni anónimo, ni «para depurar».

Y una distinción que el contrato defiende a propósito y que tienes que mantener: **denegar es una respuesta; no poder preguntar es una avería.** El proveedor no cae solo a elegir el punto a mano cuando no hay con qué pedir el permiso — eso sería la pieza que, al no estar, no protesta (§6h, ocho apariciones en este repo). Se arreglan en sitios distintos y se distinguen en pantalla.

Los escenarios `@privacidad` y `@determinismo` son **bloqueantes**: nada se entrega con uno en rojo.

## Dónde va el código

`CLAUDE.md` lo fija y no es negociable: **la bifurcación por sistema operativo vive solo en `app/plataforma/`**, por sufijo de fichero (`respaldo.ios.js` / `respaldo.android.js`), y **cada fichero de plataforma tiene su pareja con las mismas exportaciones**. Los módulos se **inyectan** en el registro, que es lo que permite montar un registro doblado o vacío y poner rojo «la app funciona aunque falten».

`RF-INFRA-004` mete además el rótulo del sistema en la ecuación: en marcha hace falta servicio en primer plano, y ya hay `app/plataforma/rotulo.ios.js` y `rotulo.android.js`. Mira qué prometen antes de escribir nada nuevo.

## Cómo se trabaja aquí

Fila a fila, con `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, cada rol en su contexto. Reglas que no se negocian:

- **Nunca se edita una prueba para que pase.** Si prueba y código discrepan, alguien decide cuál está mal y **lo escribe en el propio fichero**.
- **Nada se da por bueno sin verificarlo**, ni lo que diga un subagente ni lo que diga este prompt. El código de salida 2 del runner (`no se pudo ejecutar`) **no es verde**.
- **Todo se declara.** Cada ambigüedad se resuelve con la opción más razonable y se deja escrita.
- **Si la premisa de este encargo no se sostiene contra lo que ves, dilo y para.** Las tres sesiones anteriores dieron sus mejores hallazgos así: midieron la premisa que les di, era falsa en parte, y lo dijeron. Una de ellas corrigió su propio número a peor. Eso vale más que la fila entregada.
- **No estires la fila.** Las pantallas de la escena y el telón son la 49, y el zurrón la 46. Si algo pide una de ellas, fíchalo.

## Lo que no se puede romper

- **Determinismo.** Nada de `Math.random()`, `Date.now()` ni `new Date()` dentro de `packages/nucleo/`.
- **`packages/nucleo/` no importa React Native ni Expo**, nunca. La E/S se inyecta. Esta fila trae un módulo nativo: si algo suyo se cuela en el paquete, has roto la frontera.
- **La batería de núcleo arranca sin `node_modules`.** Criterio duro: *el día que la red de seguridad del determinismo dependa de un `node_modules`, deja de ser una red.*

## Cómo ejecutar

```bash
emulator -avd wa-pixel -no-window -gpu swiftshader_indirect &
cd app && npx expo run:android      # obligatorio tras añadir la dependencia: es compilación nativa
EXPO_PUBLIC_PROXY=http://10.0.2.2:8138 npx expo start
TOPE_DIARIO_GASTO=5 VERIFICADOR_ATESTACION=/ruta/al/verificador-local.mjs node server/arranca.mjs

bash scripts/qa-tester-run.sh SUITE
maestro test test/app/<flujo>.yaml
```

El GPS del emulador se simula: `adb emu geo fix <lon> <lat>` mueve el aparato, que es como vas a poder recorrer una llegada sin salir a la calle.

**`node --test test/nucleo/` no funciona en Node 24**: enumera los ficheros, `node --test $(find test/nucleo -type f -name '*.test.mjs' | sort)`.

Trampas del dispositivo, todas medidas y todas en la bitácora: un `console.warn` levanta LogBox y **se come el toque** de la acción principal; `SafeAreaView` de `react-native` no hace nada en Android; una marca de 0×0 no existe para la automatización; las pantallas con lista variable empujan su acción bajo el pliegue. Y `adb` se cae más o menos un flujo por tanda, siempre distinto, en menos de un segundo y sin mensaje de aserción — la sesión de la fila 47 dejó escrito cómo separar esa caída de un fallo de verdad, léelo antes de perseguir un rojo raro.

## Cuándo está hecho

1. **El diálogo del permiso sale en el emulador**, y sale **solo el de «mientras se usa»**. Compruébalo mirando el manifiesto generado, no solo la pantalla: si ahí aparece el permiso de fondo, la fila está mal aunque nadie lo pida.
2. **Denegar y no poder preguntar se ven distintos en pantalla**, y cada uno lleva a su sitio.
3. **A1P4 coge la posición de verdad** en lugar de caer a elegir el punto a mano.
4. **Una llegada recorrida de principio a fin en el emulador**, moviendo el GPS con `adb emu geo fix`: se anda, se entra en el geofence, y el juego lo detecta. Es el primer momento en la vida del proyecto en que esto se puede intentar.
5. **La columna de límite declarado de `@app` baja**, con los flujos que salgan de ella retirados de `test/nucleo/limite-declarado.test.mjs`. Hoy está en 9. **Si no baja, dilo con el número delante**: la sesión anterior corrigió el suyo a peor y eso fue lo mejor que hizo.
6. **Ni una traza guardada.** Que una prueba lo exija, no que un comentario lo prometa.
7. Anotado en `docs/starting.md` con fecha, qué se decidió, qué se implementó y **con qué se verificó** — recorridos y coordenadas concretas, nunca «funciona».

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
