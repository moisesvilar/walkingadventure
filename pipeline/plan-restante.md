# Plan de lo que falta, y cómo se orquesta

Documento de relevo de la orquestación (12-ago-2026). Escrito para que una sesión orquestadora nueva arranque de aquí sin necesitar la conversación en la que nació. La memoria del proyecto es esto, la bitácora (`docs/starting.md`), el registro (`pipeline/decisiones-orquestador.md`, §1–§12) y el checklist — nunca una sesión.

## Estado al escribir esto

`main` en `5d3042a`, limpia y subida. B7 con las filas 43, 44, 45, 47, 48 y 49 en `done`, todas verificadas por cotejo independiente. Última suite (12-ago, `SUITE-run-20260812T080830Z`): **@nucleo 2787 · 2783 pasan · 1 falla · 3 saltados** — el único rojo es el fichado (`BOOT_COMPLETED` de `expo-notifications`, dueño SPEC-023) —; **@app 20 ejecutados · 10 pasan · 2 fallan · 8 de límite declarado**, y los dos rojos tienen dueño (`empezar-de-nuevo-copia`: `Share.dismissedAction` es de iOS; `zurron`: fila 46). **El juego se juega**: arranque → mapa → aventura → llegada → beat → telón → portada del día siguiente, en `wa-pixel`, con la primera migración de formato (v1 → v2) funcionando.

## Las tareas, en orden

### 1 · Fila 50 — «los cableados que faltan» (siguiente, sin decisiones previas)

Los tres hallazgos de la 49 que son la misma forma —pieza escrita, probada y sin llamador— y que cambian el juego que se ve:

- **Micro-encuentros**: `siembraLaCola` sin llamador (deuda de la fila 19). En un teléfono no salta ningún micro-encuentro: la mitad del canal de entregas, nunca vista en un aparato.
- **El ofrecimiento**: `NUCLEO_DEL_OFRECIMIENTO` sin importador (de la 41). A2P0 inalcanzable, y `docs/flujo.md` tiene pendiente su nodo desde §6y — añadirlo es cambio de diseño, se propone.
- **A4P8 tapado**: nodos degenerados (`y2 < y1`) sobre el botón se comen el toque y «Marcarlo» no se puede pulsar. Sin esto, el descarte —que costó tres costuras— no se usa con el dedo.

Por qué primero: cero dependencias nuevas, cero decisiones del dueño, la guarda de piezas-sin-consumidor los vigila ya, y cada cableado se verifica dentro de un recorrido del bucle que ya se sabe conducir. La mejor relación valor/riesgo de todo lo pendiente. **El prompt hay que escribirlo** (no existe aún), con el patrón de los anteriores: `docs/prompt-*.md`, autocontenido, premisas etiquetadas como medidas o heredadas.

### 2 · Fila 46 — el zurrón (después, y empieza con una decisión del dueño)

La fuente nativa de salud es dependencia nueva que ninguna spec nombra (`app/plataforma/salud.js` lo declara). En Android el camino natural es Health Connect, pero es elección de producto, como lo fue `expo-location` en la 48. **Ratificarla en el prompt antes de lanzar** es lo que hizo despegar limpia a la 48. Cierra B7 entero, apaga el rojo de `zurron.yaml` y la última pantalla huérfana (`zurron.jsx`). Ojo: los pasos de fondo en emulador no se simulan fácil — el contrato con dobles más el estado leído con `run-as` será parte de la verificación.

### 3 · `escena.cara` — fila corta de núcleo (en el hueco que convenga)

0 de 506 beats caen sobre un rol humano (fichado por la 49, dueño SPEC-017), así que `escena.cara` es siempre nula. Corre en Node, no necesita emulador. Es lo que hace que las escenas tengan caras — mundo vivo.

### 4 · Fichadas sin fila, a propósito

- **Causa raíz de la versión global** (§11e): `VERSION_FORMATO` es global a las ocho clases de documento; subirla por una invalida las demás. Decisión de esquema, mejor con calma.
- **El telón por regreso** (§12b): el servicio en primer plano se cae a mitad de salida. Hay hipótesis con hilo barato **que no necesita dispositivo**: `cadenciaDeMuestreo` con una posición en el punto de partida y el índice real de geofences — si devuelve `por-distancia`, la hipótesis tiene pata y pasa a fila. Quien persiga la caída: `adb logcat` filtrado por el task manager desde **antes** de abrir la salida.
- **El lector de recursos del visor**: sin dueño natural hasta decidir de dónde salen las ilustraciones. Mientras, toda llegada resuelve a ficha o a lo-que-se-cuenta, y `visor.yaml` sigue en la columna.
- **Decisiones de diseño sin tomar**, en `docs/pendientes.md`: el botón atrás del sistema, abandonar quema la plantilla, y marcar un sitio del lazo en curso no te libra de él.

## Cómo se orquesta (el método, destilado de seis filas)

1. **Una fila, una sesión nueva**, con prompt autocontenido en `docs/prompt-*.md` (commiteado y subido antes de lanzar). La sesión usa las skills del repo (`wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`) como subagentes, cada rol en su contexto.
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
- Pantallas huérfanas: **1** (`zurron.jsx`).
- Rojos con dueño: 1 de núcleo + 2 de `@app`. Un rojo nuevo solo se acepta nombrando defecto, dueño y fila.
- Y el patrón §6h va por **catorce apariciones**: la pieza que al no estar no protesta. Las guardas que lo cazan —pantallas huérfanas, contratos sin llamador, piezas sin consumidor, límite declarado, manifiesto generado, aristas del flujo— son el mejor activo del repo después del propio juego.
