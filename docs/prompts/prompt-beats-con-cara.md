# Encargo: la fila 51, los beats con cara

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida). Antes de tocar nada lee `CLAUDE.md`, `.claude/rules/naming.md`, `game-design/quests.md`, `game-design/npcs.md`, `game-design/lenguaje.md`, y de `pipeline/decisiones-orquestador.md` los apartados **§6h**, **§10-bis** y **§14**. El bucle son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

**Cada fase se lanza como subagente** (herramienta Agent), con la instrucción de seguir la skill del repo correspondiente, y tu ventana principal se queda solo con la orquestación: encargos cortos, veredictos y decisiones. **No implementes ni escribas la spec en tu ventana principal**, y los volcados largos van a disco y se leen con grep. Esta instrucción viene en el encargo que pega el dueño para que cuente como petición directa suya.

**Recursos, por decisión del dueño (§14e): esta fila NO toma el emulador.** Todo lo tuyo corre en Node. Si en algún momento algo pareciera pedir el aparato, paras y lo preguntas en tu ventana — no lo tomas. Y las dos reglas del recurso compartido rigen también para ti: antes de dar por libre cualquier cosa, `pgrep` contra el patrón (no memoria de lo lanzado, y cubre a tus subagentes), y ante un proceso ajeno posible, **preguntar antes de matar**. El cotejo del cierre correrá en un worktree propio del hash que declares; tu obligación es declarar el hash y no mover la rama después.

Tu fila es la **51, `beats-con-cara`** (SPEC-051, rama `pipeline/SPEC-051-beats-con-cara`). Rationale: RF-QUEST-009 y RF-PJ-009, más RF-INFRA-007 por la segunda entrega. Es la fila corta de núcleo que el plan (`pipeline/plan-restante.md` §3) tenía fichada.

## Por qué existe esta fila

**`escena.cara` es siempre nula y el bloque de quien habla no se ha pintado nunca en ningún mundo.** Fichado por la fila 49 (dueño del hueco: SPEC-017) y medido de cero hoy, 13-ago-2026, por quien orquesta:

- **20 plantillas del catálogo ya declaran un rol humano** — el matiz que cambia la fila: no es que falten roles, es que **ningún beat cae sobre ellos**. 0 de 506 beats casteados en los cuatro mundos de referencia tienen `lugar.tipo === 'humano'`.
- **La composición está entera y esperando**: `packages/nucleo/quests/escena.js:469` compone `cara` (con `exigeCara`) cuando el beat cae sobre humano, `desenlace.js:72` la mira desde SPEC-017, y la pantalla A4P3 tiene el bloque de quien habla que nunca se ha visto. La forma de §6h otra vez: pieza escrita, probada y sin que nadie la alimente.
- **La guarda que te espera**: `test/nucleo/escena-cableada.test.mjs` (~línea 370) fija los tres números —20 plantillas con rol humano, 506 beats, **0** humanos— **a propósito para ponerse roja el día que esto cambie**, y su comentario dice qué toca entonces: «alguien mire si la cara llega a pantalla». Cuando se ponga roja contigo está haciendo su trabajo: se actualiza con los números nuevos **medidos**, nunca se edita para pasar, y la mitad de «la cara llega» se cumple, no se borra.

Con esta fila, las escenas tienen caras: mundo vivo. Es la diferencia entre llegar a un sitio y llegar donde alguien.

## La segunda entrega: la guarda de los plugins nativos

Decisión del dueño (§14e): los plugins de `app/plugins/` pasan a tener **guarda de lista cerrada**, al estilo de `piezas-sin-consumidor.test.mjs` — cada plugin nombrado a mano con su cometido declarado, y rojo ante uno nuevo o uno cambiado de forma hasta que alguien lo nombre. «Traduce, no decide» sigue siendo revisión humana; la guarda garantiza que ningún plugin entre sin conversación. Hoy son dos: `retira-permisos-prohibidos.js` y `lo-que-exige-health-connect.js` (léelo: es el molde). La escribe `wa-qa-dev`, vive en `test/nucleo/`, y arranca sin `node_modules` como todo lo de allí.

## Cómo se trabaja aquí

Fila a fila, `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, **cada fase en su subagente**. Y estas no se negocian:

- **Nunca se edita una prueba para que pase.** La guarda del 0 de 506 está diseñada para ponerse roja contigo; actualizarla con números medidos y con la comprobación que su comentario exige no es editarla para pasar — borrarle la exigencia sí lo sería.
- **Nada se da por bueno sin verificarlo**, ni lo que diga un subagente ni lo que diga este prompt. Ocho sesiones de ocho encontraron algo falso en su encargo; si algo de aquí no se sostiene, dilo y para.
- **El diseño manda.** Los beats sobre caras tienen que obedecer `quests.md` y `npcs.md` (la cara hereda el anclaje del sitio, las franjas son de la escena, el testigo es fiel); un texto nuevo del catálogo pasa por `lenguaje.md` — SPEC-018 ya encontró seis textos con voz de aplicación, no estrenes el séptimo. Si el cambio contradice un documento, el documento se actualiza también, y si es decisión nueva, se pregunta en tu ventana, con bloque ask, una viva a la vez.
- **La salud del generador se mide antes y después.** Tocar plantillas o casting mueve la casteabilidad: los números de `test/headless.mjs` y, si el server está levantado, `node test/casting-report.mjs` (tubería completa contra mundos reales) se escriben antes y después. Una bajada sin motivo medido delante es un no.
- **Todo se declara. No estires la fila.** El aparato no es tuyo; que la cara se vea con el dedo en A4P3 es verificación de una fila con emulador y se ficha, no se hace de paso.
- **`pipeline/state.json` y la columna `Estado` no los tocas**: `done` lo declara el cotejo de quien orquesta.

## Lo que no se puede romper

- **Determinismo.** `makeRng(seed + ':sufijo')` por fase; nada de `Math.random()`, `Date.now()` ni orden de inserción no controlado. `@determinismo` es bloqueante, y cambiar el casting no puede desplazar el azar de otras fases.
- **`packages/nucleo/` no importa React Native ni Expo**, y **la batería de núcleo arranca sin `node_modules`**.
- **Sin dependencias nuevas.** Ninguna. Esta fila es de datos y lógica pura.
- **Contenido apto para menores** y textos que se leen en voz alta.
- **Las guardas vivas**: pantallas huérfanas **0** (no puede subir), `piezas-sin-consumidor` vacía, contratos sin llamador **2**, límite declarado **9** (esta fila no debería moverlo), manifiesto generado con `mirado: true` — recuerda la trampa del total que baja: sin compilar, 2865 se convierte en 2859 y no es una tanda mejor.
- **Los rojos actuales, todos ajenos y leídos**: 1 de núcleo (`BOOT_COMPLETED`, SPEC-023) y 3 de `@app` (`empezar-de-nuevo-copia`, `en-marcha`, `telon` — §13b y §14c). Ni uno nuevo sin defecto, dueño y fila.

## Cómo ejecutar

```bash
node --test $(find test/nucleo -type f -name '*.test.mjs' | sort)   # node --test test/nucleo/ NO funciona en Node 24
node test/headless.mjs
node server.mjs &   # solo si vas a correr casting-report
node test/casting-report.mjs
bash scripts/qa-tester-run.sh SPEC-051 > salida.log 2>&1; echo $?   # NUNCA con | tail; etiquetas: SPEC-051, SPEC-051-iter-M o SUITE
```

## Cuándo está hecho

1. **Beats sobre roles humanos en los mundos de referencia, con los números medidos**: el 0 de 506 deja de ser 0, la guarda de `escena-cableada.test.mjs` queda actualizada con los números nuevos y su exigencia cumplida — `escena.cara` llega no nula hasta donde el andamiaje de Node permita afirmarlo (la composición y el montado de A4P3 con su bloque de quien habla pintado en el árbol de componentes). Lo que solo un aparato pueda firmar, declarado como límite con su motivo.
2. **La casteabilidad no baja**, con los números de antes y después escritos (headless siempre; casting-report si el server está). Si baja y hay motivo de diseño, el motivo medido delante y el documento que lo ampare.
3. **Los textos nuevos del catálogo pasan por `lenguaje.md`** y por las reglas duras que ya vigilan el catálogo.
4. **La guarda de plugins entregada y en verde**: lista cerrada con los dos de hoy nombrados y su cometido, roja ante uno nuevo sin nombrar. Es la segunda entrega y no se recorta.
5. **La suite entera sin rojos nuevos**: base @nucleo 2865 · 2861 · 1 · 3 y @app 20 · 8 · 3 · 9, con la precondición de aparato limpio si la corres entera (o decláralo y la corre el cotejo).
6. **Checklist y bitácora**: la fila 51 dice qué entregó, `docs/starting.md` lleva fecha, decisiones, números de casteabilidad y semillas concretas, y las notas de SPEC-017/SPEC-034 quedan al día si tu fila las salda.
7. Declaras el **hash final** y no mueves la rama después: el cotejo corre en worktree propio sobre ese hash.

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
