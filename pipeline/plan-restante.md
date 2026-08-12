# Plan de lo que falta, y cómo se orquesta

Documento de relevo de la orquestación (12-ago-2026). Escrito para que una sesión orquestadora nueva arranque de aquí sin necesitar la conversación en la que nació. La memoria del proyecto es esto, la bitácora (`docs/starting.md`), el registro (`pipeline/decisiones-orquestador.md`, §1–§12) y el checklist — nunca una sesión.

## Estado al escribir esto

Actualizado al cierre de la fila 50 (12-ago-2026, tarde). `main` en `7d3c5ac` más el cierre del cotejo, limpia y subida. B7 entero en `done` salvo la 46. Última suite (cotejo de la 50, `SUITE-run-20260812T124409Z`, **desde aparato limpio**, que ahora es precondición declarada): **@nucleo 2825 · 2821 pasan · 1 falla · 3 saltados** — el único rojo es el fichado (`BOOT_COMPLETED`, dueño SPEC-023) —; **@app 20 ejecutados · 8 pasan · 4 fallan · 8 de límite declarado**. Los cuatro rojos, leídos con su motivo: `empezar-de-nuevo-copia` (`Share.dismissedAction` es de iOS) y `zurron` (fila 46) siguen fichados; `en-marcha` y `telon` son **rojo esperado desde aparato limpio** — el proveedor de ubicación frío no da posición puntual al abrir la salida; no es regresión, la atribución medida está en §13b y la trampa en `CLAUDE.md`. **El juego se juega y ya con el canal entero**: la cola se siembra al nacer la partida, A2P0 es alcanzable (vista a 500 km del mapa de casa) y el descarte se marca con el dedo.

## Las tareas, en orden

### 1 · ~~Fila 50 — «los cableados que faltan»~~ → **hecha** (12-ago-2026)

Cerrada y cotejada: los tres cableados entregados y verificados en `wa-pixel` (cola sembrada leída con `run-as`, A2P0 vista en Madrid a 500 km con el topónimo por la ruta ciega, «Marcarlo» pulsando en el centro), más lo que el encargo no sabía — el prólogo entero se tiraba, no solo la cola; A2P0 estaba rota por orden de hooks; y la primera versión del arreglo de A4P8 la habría dado por buena su propia prueba. A2P0 entró en el diseño (41 pantallas, 94 aristas). El relato en la entrada XXXIV de la bitácora y en §11–§13 del registro; los dos rojos nuevos de la suite **no son regresión** (§13b).

### 2 · Fila 46 — el zurrón (siguiente, y empieza con una decisión del dueño)

La fuente nativa de salud es dependencia nueva que ninguna spec nombra (`app/plataforma/salud.js` lo declara). En Android el camino natural es Health Connect, pero es elección de producto, como lo fue `expo-location` en la 48. **Ratificarla en el prompt antes de lanzar** es lo que hizo despegar limpia a la 48. Cierra B7 entero, apaga el rojo de `zurron.yaml` y la última pantalla huérfana (`zurron.jsx`). Ojo: los pasos de fondo en emulador no se simulan fácil — el contrato con dobles más el estado leído con `run-as` será parte de la verificación.

### 3 · `escena.cara` — fila corta de núcleo (en el hueco que convenga)

0 de 506 beats caen sobre un rol humano (fichado por la 49, dueño SPEC-017), así que `escena.cara` es siempre nula. Corre en Node, no necesita emulador. Es lo que hace que las escenas tengan caras — mundo vivo.

### 4 · Fichadas sin fila, a propósito

- **Causa raíz de la versión global** (§11e): `VERSION_FORMATO` es global a las ocho clases de documento; subirla por una invalida las demás. Decisión de esquema, mejor con calma.
- **El telón por regreso** (§12b): el servicio en primer plano se cae a mitad de salida. Hay hipótesis con hilo barato **que no necesita dispositivo**: `cadenciaDeMuestreo` con una posición en el punto de partida y el índice real de geofences — si devuelve `por-distancia`, la hipótesis tiene pata y pasa a fila. Quien persiga la caída: `adb logcat` filtrado por el task manager desde **antes** de abrir la salida.
- **El lector de recursos del visor**: sin dueño natural hasta decidir de dónde salen las ilustraciones. Mientras, toda llegada resuelve a ficha o a lo-que-se-cuenta, y `visor.yaml` sigue en la columna.
- **Decisiones de diseño sin tomar**, en `docs/pendientes.md`: el botón atrás del sistema, abandonar quema la plantilla, y marcar un sitio del lazo en curso no te libra de él.
- **El salto a iPhone**, que el dueño quiere «más pronto que tarde» en cuanto Android esté verificado: el inventario vivo está en `docs/iphone.md` — lo preparado, las tres decisiones de dependencia que exigirá (HealthKit, App Attest, Actividad en Vivo), los rojos que lo esperan (`empezar-de-nuevo-copia`) y la tabla de procedimientos de aparato que hay que re-medir. Toda fila que fiche algo con forma de iOS lo anota allí; el paso cero es instalar Xcode, que esta máquina no tiene.

## Cómo se orquesta (el método, destilado de seis filas)

1. **Una fila, una sesión nueva**, con prompt autocontenido en `docs/prompts/prompt-*.md` (commiteado y subido antes de lanzar). Y desde la 50, dicho sin sutilezas porque «cada rol en su contexto» no bastó: **el encargo ordena explícitamente lanzar cada fase (`wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`) como subagente con su propio contexto**, con la ventana principal solo para encargos cortos, veredictos y decisiones — y esa orden tiene que viajar **dentro del prompt que pega el dueño**, porque una sesión puede tener prohibida la herramienta de agentes salvo petición directa suya y un mensaje de quien orquesta no lo es (§13c). Si una sesión ya corre sin subagentes: volcados a disco y grep, nunca en la ventana.
2. **En los encargos, lo medido y lo heredado van etiquetados distinto** (§10-bis). Un negativo no se hereda: se mide de cero o se marca como sospecha. Y la sesión receptora verifica la premisa antes de usarla — seis de seis encontraron algo falso en la suya, y fue siempre lo más valioso.
3. **Una pregunta viva a la vez, en la ventana de quien ejecuta** (§11d). Si quien orquesta necesita una decisión del dueño sobre una fila, se la manda a la sesión para que la pregunte ella. Nunca un AskUserQuestion en paralelo: ya produjo dos respuestas contradictorias y una parada.
4. **Las decisiones del dueño se dan en la ventana de la sesión, nunca por relevo.** Un relato fiel de una decisión no es la decisión (§9b). Las condiciones de trabajo que acompañan sí pueden ir por mensaje.
5. **El emulador tiene un solo dueño a la vez** (§10e). Quien orquesta no lanza la suite mientras una fila lo tiene; el cotejo espera al cierre.
6. **Quien orquesta no commitea mientras una fila tiene el checkout** — el árbol es compartido. Si es urgente, commit en la rama que esté y empuje por hash a main (`git push origin <hash>:main`).
7. **Al cierre de cada fila: cotejo independiente** — correr la suite entera, comparar contra los números declarados, y solo entonces dar por buena la fila (el merge lo suele hacer la sesión).
8. **Antes de cerrar una sesión, la pregunta de despedida**: «¿queda algo en tu cabeza que no esté en el repo?» — callejones probados, sospechas etiquetadas, terreno ajeno que chirrió, operativa, costuras con lo que venga. Ha producido §8, §10 y §12; lo verificable se verifica antes de escribirlo.
9. **El código de salida del runner nunca se lee a través de una tubería**, la etiqueta solo admite `SPEC-NNN`, `SPEC-NNN-iter-M` o `SUITE`, y un exit 2 no es verde. Las trampas del aparato (JDK 17, `exec-out`, `expo run:android` abre la app sola, nodos degenerados) están en `CLAUDE.md`.
10. **La cuenta de `gh` se desconfigura sola** (algo la cambia a `moisesvvi`): si el push da 403, `gh auth switch --user moisesvilar && gh auth setup-git`, y avisar al dueño de cuál queda activa.

## El termómetro

- Columna de límite declarado: **8** (la lista exacta vive en `test/nucleo/limite-declarado.test.mjs`). Bajarla es la medida de progreso real; ojo con `llegada.yaml`, que volvió a entrar porque su verde no era reproducible (§ cierre de la 49).
- Pantallas huérfanas: **1** (`zurron.jsx`). `BLOQUES_SIN_CONSUMIDOR`: **vacía** desde la 50.
- Rojos: 1 de núcleo (SPEC-023) + 4 de `@app` — 2 fichados (`empezar-de-nuevo-copia`, `zurron`) y 2 **esperados desde aparato limpio** (`en-marcha`, `telon`: proveedor de ubicación frío, §13b; la decisión de producto que los cerraría está en `docs/pendientes.md`). Un rojo nuevo solo se acepta nombrando defecto, dueño y fila.
- Y el patrón §6h sumó con la 50 sus apariciones más profundas hasta ahora —el prólogo entero producido y tirado, `levanta()` sin correr prólogo, una pantalla rota que nunca pudo protestar porque nadie llegaba—: la pieza que al no estar no protesta. Las guardas que lo cazan —pantallas huérfanas, contratos sin llamador, piezas sin consumidor, límite declarado, manifiesto generado, aristas del flujo— son el mejor activo del repo después del propio juego.
