# Encargo: la fila 49, las pantallas de la escena y el telón

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida). Antes de tocar nada lee `CLAUDE.md` —incluidas las trampas conocidas—, `.claude/rules/naming.md`, `docs/flujo.md`, `game-design/quests.md` y `game-design/bucle-jugable.md`, y de `pipeline/decisiones-orquestador.md` los apartados **§6h**, **§8** y **§9**. El bucle son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

Tu fila es la **49, `pantallas-de-la-escena-y-el-telon`**, del bloque B7 (`RF-QUEST-004`, `RF-PJ-009`, `RF-BUCLE-011`, `RF-BUCLE-012`, `RF-BUCLE-013`). Recibe además, declarados por escrito desde la fila 44, `RF-QUEST-004` y `RF-BUCLE-011` — el checklist lo dice.

## Por qué existe esta fila, y en qué se distingue de las anteriores

SPEC-034 (la escena del beat) y SPEC-036 (el telón) se cerraron en `done` **sin tocar un solo fichero de `app/`**: entregaron el paquete con sus pruebas y nadie escribió las pantallas. Son las dos únicas filas de B5/B6 con cero app, y el checklist lo declara desde entonces. Así que aquí no se cablea lo que existe, como en la 43 o la 44: **se escriben A4P3, A4P4 y A5P1–A5P4 desde cero**, contra un núcleo que ya está entero y probado.

Con esta fila cerrada, el juego tiene por primera vez **el bucle completo en un teléfono**: salir, llegar, jugar el beat, volver a casa, echar el telón. Ese es el tamaño de lo que estás cerrando, y también la razón de que la verificación de esta fila sea el recorrido entero y no sus trozos.

## Lo que ya está hecho, para que no lo reconstruyas

**En el núcleo**, todo probado en Node: `partida/telon.js` (estados del telón, y los vocabularios cerrados de reproche, propagación y logro con sus `exige*` — los textos del telón tienen reglas de lenguaje duras y ya están vigiladas), `partida/cierre-de-salida.js` (`echaElTelon`, `PIEZAS_DEL_CIERRE`, `AREAS_QUE_TOCA_EL_CIERRE`), `partida/capitulos.js`, y la composición de la escena del beat que dejó SPEC-034 (su spec en `docs/specs/` dice dónde). La secuencia de la llegada ya trae el paso `beat` cuando lo hay (`partida/secuencia.js`), y la capa de llegadas de la 44 lo sirve en el móvil.

**En la app**, dos ganchos esperándote: `app/App.js:577` monta un hueco declarado `telon-sin-pantalla` con su `telon-cerrar` cuando la salida ofrece telón — es el hueco de una sola acción que dejó la 48, y tu fila lo sustituye por A5 de verdad—. Y `app/marcha/salida.js` distingue `telon-pendiente` de `ya-hay-salida`: **un telón sin leer bloquea abrir otra salida a propósito**, así que mientras tu pantalla no exista la app se encalla ahí — eres tú quien la desencalla.

**En el diagrama**, `docs/flujo.md` declara el camino entero y ahora se verifica **por aristas** (la guarda de la 44): `A4P3 → A4P4 → NUCLEO`, y `A3P1 → A5P1` con las variantes `A5P1B`, `A5P2`, `A5P2B`, `A5P3` y `A5P4`, cada una con su condición. Las condiciones de esas aristas **son decisiones de diseño cerradas** —el cierre en corto no genera rumor nunca; el desenlace no notable tampoco; A5P1B es el atajo de un día sin novedad— y las pantallas las obedecen, no las reinterpretan.

## Las deudas heredadas que te tocan de lleno

Verificadas y escritas en §8 y en el cierre de la 44 (`docs/starting.md`, 11-ago):

1. **El reparto casteado no sobrevive a cerrar la app.** El estado guarda la aventura por su identificador y no su cadena de beats: al reabrir, la secuencia conserva su paso de beat pero **el beat de dentro se pierde**. Mientras el telón se eche en la misma sesión no te toca; en cuanto pruebes cerrar y reabrir con una aventura a medias, te vas a dar de bruces con esto. **Persistirlo es decisión de diseño**: si tu fila la necesita, se escala con la evidencia delante, no se resuelve de paso.
2. **El ancla del mapa no es gobernable desde un flujo** (`ubicacion.js:122`, `getCurrentPositionAsync` no obedece al fijo simulado en el arranque; durante la salida sí, metro a metro). Consecuencia para tu flujo de `@app`: **no puedes garantizar dónde nace el mundo ni qué sitio tiene beat**, así que el flujo de la escena tendrá que ramificar por las formas declaradas, como hizo `llegada.yaml` — léelo antes de escribir el tuyo, esa prueba ya pagó ese peaje y documenta cómo.
3. **El visor no se abre en el móvil** (sin lector de recursos, toda llegada resuelve a ficha o a lo-que-se-cuenta). A tu escena no le estorba —el beat va después del visor cuando lo hay, y sin ilustración la escena es lo primero—, pero no dependas del visor para llegar a ella.

## Cómo se trabaja aquí

Fila a fila, `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, cada rol en su contexto. Y estas no se negocian:

- **Nunca se edita una prueba para que pase.** Si prueba y código discrepan, alguien decide cuál está mal y **lo escribe en el propio fichero**.
- **Nada se da por bueno sin verificarlo**, ni lo que diga un subagente ni lo que diga este prompt. Las cinco sesiones anteriores dieron sus mejores hallazgos midiendo la premisa que les di y encontrándola falsa en parte. Si algo de aquí no se sostiene, dilo y para.
- **Desconfía de la conclusión que te ahorra trabajo.** «No se puede verificar en esta máquina» estuvo a punto de dejar pasar un fallo de privacidad.
- **Todo se declara.** Cada ambigüedad se resuelve con la opción más razonable y se deja escrita.
- **No estires la fila.** El zurrón es la 46; la siembra de partida jugada es de la 47 y está fichada; el lector de recursos del visor no tiene fila y no la abres tú de paso. Lo que pida una de esas, se ficha.

## Lo que no se puede romper

- **Determinismo.** Nada de `Math.random()`, `Date.now()` ni `new Date()` en `packages/nucleo/`.
- **`packages/nucleo/` no importa React Native ni Expo.** La E/S se inyecta.
- **La batería de núcleo arranca sin `node_modules`.** Criterio duro.
- **Sin dependencias nuevas.** Esta fila no debería necesitar ninguna: si aparece una, te paras y lo dices.
- **Los textos del telón tienen reglas de lenguaje vigiladas** (`telon.js`: reproche, propagación, logro). Las pantallas pintan lo que el núcleo compone; si un texto nuevo hace falta, pasa por los `exige*` y por las reglas de `game-design/lenguaje.md`. Tono cómico-cálido, contenido apto para menores, y los textos se leen en voz alta.
- **Privacidad**: nada nuevo sale del móvil por esta fila. `@determinismo` y `@privacidad` son bloqueantes.
- **Las guardas vivas te vigilan a ti**: `pantallas-huerfanas.test.mjs` (hoy 1, `zurron.jsx` — tus pantallas nuevas tienen que quedar importadas desde `App.js`, y el recuento no puede subir), `contratos-sin-llamador.test.mjs`, `limite-declarado.test.mjs` (la lista exacta, hoy 7), y la guarda de aristas de `verifica-flujo.mjs`. Si una se pone roja contigo, está haciendo su trabajo.

## Cómo ejecutar

```bash
emulator -avd wa-pixel -no-window -gpu swiftshader_indirect &
cd app && npx expo run:android
EXPO_PUBLIC_PROXY=http://10.0.2.2:8138 npx expo start
TOPE_DIARIO_GASTO=5 VERIFICADOR_ATESTACION=/ruta/al/verificador-local.mjs node server/arranca.mjs

bash scripts/qa-tester-run.sh SUITE > salida.log 2>&1; echo $?     # NUNCA con | tail: se traga el código de salida
maestro test test/app/<flujo>.yaml
adb emu geo fix <lon> <lat>     # mover el aparato durante la salida sí obedece, metro a metro
```

`node --test test/nucleo/` no funciona en Node 24: enumera los ficheros. Trampas de dispositivo medidas, todas en la bitácora: LogBox se come el toque de la acción principal si la app emite un solo `console.warn`; `SafeAreaView` de `react-native` no hace nada en Android (usa `app/plataforma/area-segura.jsx`); una marca de 0×0 no existe para la automatización (usa `app/pantallas/marca.js`, y ojo con las pantallas a sangre: la 44 encontró marcas cayendo bajo la barra de estado); las listas variables empujan la acción bajo el pliegue; y `adb` se cae un flujo por tanda sin mensaje — §7 dice cómo separarlo de un fallo real.

## Cuándo está hecho

1. **El bucle completo recorrido en `wa-pixel`, con las coordenadas escritas**: arranque o partida persistida → salir con una aventura → llegar al beat moviendo el GPS → **A4P3 → A4P4** → seguir andando → volver al punto de partida → **A5P1 → (su variante) → A5P4** → y la portada del día siguiente reflejando lo cerrado. Es la primera vez que ese recorrido es posible; lo que encuentres en las costuras vale más que las pantallas.
2. **Las tres variantes del telón, las tres**: aventura terminada (con y sin desenlace notable), vuelta a mitad —cierre en corto, **cero oro, cero rumor**, que es decisión de diseño—, y salir sin coger nada. La variante A5P1B si el día no dio nada nuevo.
3. **Un telón pendiente desencallado**: la app que se cerró debiendo un telón lo ofrece al abrir, se lee, y entonces —y no antes— se puede abrir otra salida. El hueco `telon-sin-pantalla` de `App.js` desaparece sustituido por tu pantalla.
4. **`escena.yaml` sale de la columna de límite declarado** (hoy 7 → 6), retirado de la lista del contrato, ramificando por formas declaradas como `llegada.yaml`. Si no puede salir, dilo con el motivo medido delante — ya van dos sesiones que corrigieron su número a peor y fue lo mejor que hicieron.
5. **La suite no gana rojos que no sean tuyos y con dueño escrito.** Hoy: 1 de núcleo (BOOT_COMPLETED, SPEC-023) y 2 de `@app` (`empezar-de-nuevo-copia`, `zurron`).
6. **El checklist dice qué entregaste**: RF-QUEST-004 y RF-BUCLE-011 dejan de estar en tránsito, y las notas de SPEC-034/SPEC-036 quedan saldadas o actualizadas.
7. Anotado en `docs/starting.md` con fecha, qué se decidió, qué se implementó y **con qué se verificó**.

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
