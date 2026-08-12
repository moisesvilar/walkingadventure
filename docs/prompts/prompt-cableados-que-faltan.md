# Encargo: la fila 50, los cableados que faltan

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida). Antes de tocar nada lee `CLAUDE.md` —incluidas las trampas conocidas y las del aparato—, `.claude/rules/naming.md`, `docs/flujo.md`, y de `pipeline/decisiones-orquestador.md` los apartados **§6h**, **§10-bis**, **§11** y **§12**. El bucle son las cuatro skills **del repo** —`.claude/skills/wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

Tu fila es la **50, `cableados-que-faltan`** (SPEC-050, rama `pipeline/SPEC-050-cableados-que-faltan`), del bloque B7. Rationale: RF-QUEST-010, RF-QUEST-016, RF-MUNDO-004, RF-PRIV-004 — los requisitos de las filas 19, 41 y 35 cuya entrega quedó a medias por el mismo patrón.

## Por qué existe esta fila

Los tres hallazgos de la 49 que comparten forma — §6h en su variante de cableado, que ya va por catorce apariciones: **pieza escrita, probada y sin llamador** — y que cambian el juego que se ve. Ninguno pide dependencia nueva ni decisión previa del dueño, las guardas que los vigilan ya existen, y cada cableado se verifica dentro de un recorrido del bucle que la 49 ya condujo dos veces. No escribes pantallas nuevas ni mecanismo nuevo: **coses lo que hay**, y lo que aprendas cosiendo vale tanto como la costura.

Etiquetado de premisas, como manda §10-bis: lo **medido hoy** lo midió quien orquesta el 12-ago-2026 con grep a repo entero antes de escribir esto; lo **medido por la 49** lo midió esa fila en el aparato y va con su firma (§11f, §12); lo **heredado** no se ha re-medido y lo verificas tú antes de usarlo. Seis sesiones de seis encontraron algo falso en su encargo, y fue siempre lo más valioso.

## Cableado 1 · Los micro-encuentros (deuda de la fila 19)

**Medido hoy**: `siembraLaCola` (`packages/nucleo/partida/entregas.js:225`) solo tiene llamadores en tests y en el método `siembra()` del propio productor (`entregas.js:498`). Nada de `app/` la llama.

La mitad consumidora **sí está montada**: `app/marcha/llegadas.js:168` crea `creaMicroEncuentros` sobre `estado.entregas`. Lo que nunca ocurre es la siembra: `componePrimeraLista` (`app/mapa/primera-lista.js`) corre el prólogo y devuelve `prologo` entero con el aviso escrito en su contrato —«la cola sembrada... es de la partida y quien llama tiene que guardarlo: perderlo dejaría el mundo sin pasado»— y quien llama es `arranque-montado.jsx`, que hoy no siembra. Mira también qué pasa al levantar un mapa que no es el primero (SPEC-041): si ese camino corre su prólogo, la siembra le toca igual.

**Medido por la 49 en aparato**: en un teléfono no salta ningún micro-encuentro — la mitad del canal de entregas, nunca vista en un dispositivo. Y es la cuarta medida del motivo de `escena.yaml` en `test/nucleo/limite-declarado.test.mjs` («sin llamador de `siembraLaCola` no puede saltar ningún micro-encuentro»): si tu cableado la cambia, **ese motivo se actualiza en el mismo commit**.

**Medido por la 49, instrumentación** (§12a): `ESQUEMAS` de `formato.js` se puebla al importar cada módulo de área — si mides en Node, importa primero el módulo del área o el error «clase de documento desconocida» te parecerá defecto y es falso.

## Cableado 2 · El ofrecimiento (deuda de SPEC-041)

**Medido hoy**: `NUCLEO_DEL_OFRECIMIENTO` (`app/nucleo/piezas.js:195`) no lo importa ningún fichero; `hayQueOfrecerMapa` y `componeOfrecimiento` (`packages/nucleo/partida/mapas.js:220` y `:234`) no tienen llamador desde `app/`. `antes-de-salir.jsx` acepta `ofrecimiento` como propiedad (línea 69) y monta `PantallaOfrecimiento` cuando llega, y quien la monta nunca se la pasa: **A2P0 existe, está probada y es inalcanzable**. La guarda `test/nucleo/piezas-sin-consumidor.test.mjs` lo fija en `BLOQUES_SIN_CONSUMIDOR`; al cablearlo, la entrada se retira de esa lista **en el mismo commit**, y la lista queda vacía.

**El nodo de A2P0 en `docs/flujo.md` está pendiente desde §6y y añadirlo es cambio de diseño: se propone al dueño, no se hace por cuenta propia.** La propuesta se la haces tú en tu ventana, con bloque ask, y ojo con el paquete completo: `scripts/verifica-flujo.mjs` compara el diagrama contra los HTML de `docs/pantallas/` y A2P0 no tiene HTML, así que el nodo solo puede no bastar — lo que haga falta (artefacto de diseño, entrada en `docs/pantallas.md`) es parte de lo que el dueño decide. Lo que salga, hecho o fichado, queda escrito.

**Heredado de la 44, verifícalo antes de apoyarte en ello**: el ancla del arranque no la gobierna el fijo simulado (`app/plataforma/ubicacion.js:122`, accuracy Balanced) — forzar «lejos de todos tus mapas» en el emulador puede no ser trivial. Si A2P0 no se puede ver en el aparato, el límite se mide y se escribe, no se finge.

## Cableado 3 · A4P8 tapado (deuda de SPEC-035)

**Medido por la 49 en el aparato** (§11f, §12d — heredado para ti: requiere emulador para re-medirlo): la capa de descarte desborda 1080×2400, los cinco motivos empujan y los dos últimos salen con cotas degeneradas (`y2 < y1`) **encima de «Marcarlo»**; el toque solo entra por una franja de 30 px. Tercera aparición de la trampa del pliegue. El descarte costó tres costuras y no se puede usar con el dedo.

El arreglo es de `app/pantallas/descarte.jsx`: que los cinco motivos quepan o haya desplazamiento, y que **el centro del botón pulse**. Al verificar por `adb`, lee las cotas del nodo y desconfía de los degenerados — así estaba tapado.

`descarte.yaml` sigue en límite declarado **por otro motivo** (llegar a la puerta no es gobernable, fila 44): este cableado no lo saca y no se pretende que lo haga. Si algo cambia al medirlo, se escribe.

## Cómo se trabaja aquí

Fila a fila, `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`, cada rol en su contexto. Y estas no se negocian:

- **Nunca se edita una prueba para que pase.** Si prueba y código discrepan, alguien decide cuál está mal y **lo escribe en el propio fichero**.
- **Nada se da por bueno sin verificarlo**, ni lo que diga un subagente ni lo que diga este prompt. Si algo de aquí no se sostiene, dilo y para.
- **Las decisiones del dueño se preguntan en tu ventana, con bloque ask, una pregunta viva a la vez.** Nunca la misma pregunta por dos canales: ya produjo dos respuestas contradictorias y una parada (§11d).
- **Desconfía de la conclusión que te ahorra trabajo.** «No se puede verificar en esta máquina» estuvo a punto de dejar pasar un fallo de privacidad.
- **Todo se declara.** Cada ambigüedad se resuelve con la opción más razonable y se deja escrita.
- **No estires la fila.** El zurrón es la 46; `escena.cara` (0 de 506 beats sobre rol humano, SPEC-017) tiene fila corta propia; la caída del servicio en primer plano tiene hilo fichado (§12b) y no es tuya — si te tropieza, `adb logcat` filtrado por el task manager **antes** de abrir la salida, y se ficha con lo capturado.

## Lo que no se puede romper

- **Determinismo.** Nada de `Math.random()`, `Date.now()` ni `new Date()` en `packages/nucleo/`.
- **`packages/nucleo/` no importa React Native ni Expo.** La E/S se inyecta.
- **La batería de núcleo arranca sin `node_modules`.** Criterio duro.
- **Sin dependencias nuevas.** Esta fila no necesita ninguna: si aparece una, te paras y lo dices.
- **Privacidad**: nada nuevo sale del móvil por esta fila. `@determinismo` y `@privacidad` son bloqueantes.
- **Contenido apto para menores** y tono cómico-cálido en cualquier texto que toques; los textos se leen en voz alta (`game-design/lenguaje.md`).
- **Las guardas vivas te vigilan a ti**: `pantallas-huerfanas.test.mjs` (hoy 1, `zurron.jsx` — no puede subir), `contratos-sin-llamador.test.mjs`, `piezas-sin-consumidor.test.mjs` (queda vacía al cerrar tu fila), `limite-declarado.test.mjs` (hoy **8**; un flujo solo sale si recorre de verdad, y un motivo que tu cableado cambie se corrige en el mismo commit), la guarda del manifiesto generado y las aristas de `verifica-flujo.mjs`. Si una se pone roja contigo, está haciendo su trabajo.
- **Rojos actuales, todos con dueño**: 1 de núcleo (`BOOT_COMPLETED`, SPEC-023) y 2 de `@app` (`empezar-de-nuevo-copia`: `Share.dismissedAction` es de iOS; `zurron`: fila 46). Un rojo nuevo solo se acepta nombrando defecto, dueño y fila.

## Cómo ejecutar

```bash
emulator -avd wa-pixel -no-window -gpu swiftshader_indirect &
cd app && JAVA_HOME=/opt/homebrew/opt/openjdk@17 npx expo run:android   # con el JDK 26 revienta en jlink; y OJO: abre la app sola al instalar
EXPO_PUBLIC_PROXY=http://10.0.2.2:8138 npx expo start
TOPE_DIARIO_GASTO=5 VERIFICADOR_ATESTACION=/ruta/al/verificador-local.mjs node server/arranca.mjs

bash scripts/qa-tester-run.sh SUITE > salida.log 2>&1; echo $?     # NUNCA con | tail: se traga el código de salida
maestro test test/app/<flujo>.yaml
adb emu geo fix <lon> <lat>     # mover el aparato durante la salida sí obedece, metro a metro
adb shell run-as com.walkingadventure.app cat files/partida/partida/estado.json   # el estado real, sin depender de la UI
adb exec-out run-as com.walkingadventure.app cat <ruta>   # para JSON grande: con shell sale corrompido
```

`node --test test/nucleo/` no funciona en Node 24: enumera los ficheros (`scripts/qa-tester-run.sh` ya lo hace). `ANDROID_HOME=$HOME/Library/Android/sdk`, y `platform-tools` y `emulator` no están en el PATH. El resto de trampas del aparato —LogBox se come el toque con un solo `console.warn`, `SafeAreaView` de `react-native` no hace nada en Android, marcas de 0×0, el pliegue, `setLocation` de Maestro sale 0 y no mueve el aparato— están en `CLAUDE.md` y en los comentarios de `limite-declarado.test.mjs`.

## Cuándo está hecho

1. **La cola se siembra de verdad**: tras un arranque en `wa-pixel`, el estado leído con `run-as` enseña las entradas del prólogo encoladas — eso es afirmable siempre, no depende del azar del ancla. Y un micro-encuentro **visto en pantalla** dentro de un recorrido real con las coordenadas escritas; si la reproducibilidad del sitio no lo permite (las cuatro medidas de `escena.yaml`), el límite queda medido y escrito con lo que sí se afirmó.
2. **A2P0 es alcanzable por código**: quien monta antes-de-salir pasa `ofrecimiento` cuando `hayQueOfrecerMapa` lo pide, `piezas-sin-consumidor.test.mjs` se queda con la lista vacía, y la pantalla se ve en el aparato — o el límite del ancla queda medido y escrito.
3. **El nodo de A2P0 en `docs/flujo.md` está decidido por el dueño en tu ventana**: hecho con su verificación en verde, o fichado con su motivo.
4. **«Marcarlo» se pulsa tocando el centro del botón** a 1080×2400, con las cotas del nodo sanas, verificado en el aparato dentro de un recorrido que llegue a A4P8 por A4P7.
5. **La suite entera sin rojos nuevos**: los números se comparan contra los de arriba (2787 de núcleo con su único rojo fichado; los 2 de `@app` fichados; límite declarado en 8 salvo motivo medido).
6. **El checklist dice qué quedó saldado**: las notas de las filas 19 y 41 dejan de decir «sin llamador»/«sin importador», y la de la 35 refleja que A4P8 se puede usar.
7. Anotado en `docs/starting.md` con fecha, qué se decidió, qué se implementó y **con qué se verificó** (coordenadas y semillas concretas, no «funciona»).

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
