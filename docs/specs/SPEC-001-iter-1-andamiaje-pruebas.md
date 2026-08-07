# SPEC-001-iter-1 — El veredicto no puede depender del entorno ni de cómo se invoque

## Descripción

Iteración de corrección de defecto sobre la implementación de SPEC-001. La desencadena el report `test/reports/SPEC-001-run-20260807T223412Z.md`, que dio FAIL con 11 casos en rojo de 73, y sobre todo el veredicto de quien orquesta el bucle, que reprodujo dos de esos fallos a mano fuera de las pruebas y comprobó que no son defectos de las pruebas sino del andamiaje.

Los dos defectos son de la misma familia, y esa familia es exactamente la que la spec base declaró que había que impedir: **un resultado verde que en realidad no ejecutó nada**. Uno hace que `scripts/valida-spec-test-map.mjs` no valide nada y salga 0 en silencio cuando su ruta pasa por un enlace simbólico; el otro hace que `scripts/qa-tester-run.sh` dé PASS con una prueba en rojo si hereda `NODE_TEST_CONTEXT` del proceso que lo lanza. En los dos casos el andamiaje contesta que todo va bien sin haber comprobado nada.

Lo que cambia, en una frase: el andamiaje pasa a decidir si es el programa principal comparando rutas canónicas, sanea el entorno que entrega a sus subprocesos, y solo emite PASS cuando puede afirmar que ejecutó algo y lo entendió. La spec base ya tenía las dos piezas que apuntan a esto —`test/nucleo/` vacío no es PASS, y el código 2 para «no se pudo ejecutar»—; lo que le faltó fue exigir que el veredicto sea **robusto frente al entorno y frente a la forma de la invocación**, que es lo que esta iteración añade.

Lo que no cambia: nada del comportamiento funcional del andamiaje. Los cuatro fixtures, el GPS simulado, el reloj de mundo, los cinco dobles, el inspector de tráfico, el esquema del mapa de cobertura, el formato del report y los tres códigos de salida se quedan como están. Tampoco entra aquí el defecto de la prueba del GPS simulado que aparece en el mismo report: ese es un defecto de prueba y lo corrige `wa-qa-dev` por su cuenta.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse; aquí, el delta es una corrección de robustez sobre los scripts del andamiaje ya entregado: cómo deciden que se les está ejecutando directamente, con qué entorno lanzan sus subprocesos y bajo qué condiciones tienen permitido emitir PASS.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- **No hay cambios en la frontera de inyección del núcleo ni en las dependencias.** El andamiaje sigue sin importar de `packages/nucleo/`, de `app/`, de React Native ni de Expo, y sigue sin dependencias de runtime: todo lo que hace falta está en `node:fs`, `node:path`, `node:url` y bash.
- **Fuera de alcance** (solo el delta): no se rehace el andamiaje —fixtures, dobles, GPS simulado, reloj de mundo e inspector se quedan intactos salvo por el guardián de ejecución directa—; no cambian los tres códigos de salida ya definidos ni su significado; no cambia el orden ni el formato de las seis secciones del report, más allá de las líneas de infraestructura que esta iteración añade; no se toca `test/nucleo/**` ni `test/spec-test-map.json`, que siguen siendo de `wa-qa-dev`, y en particular no se corrige aquí el fallo de la prueba del GPS simulado; no se tocan `scripts/verifica-flujo.mjs` ni `scripts/verifica-gherkin.mjs`, que son herramientas del prototipo y no forman parte del andamiaje.

## Defecto a corregir

### Síntoma

Dos síntomas independientes con la misma consecuencia, los dos reproducidos a mano fuera de las pruebas por quien orquesta.

**Uno.** `scripts/valida-spec-test-map.mjs`, invocado por una ruta que atraviesa un enlace simbólico, no imprime nada, no valida nada y sale con código 0. En macOS `/tmp` y `/var` son enlaces simbólicos, así que basta con ejecutarlo desde un árbol copiado a un temporal. Medido:

```
meta   = /private/var/folders/.../scripts/p.mjs
argv1  = /var/folders/.../scripts/p.mjs
iguales= false
```

El runner lo llama y recoge su código de salida en `MAPA_RC`, así que un mapa de cobertura mentiroso —o directamente ausente— pasa por bueno y el report lo registra como validación correcta.

**Dos.** `scripts/qa-tester-run.sh` da PASS con una prueba en rojo si hereda `NODE_TEST_CONTEXT`. Reproducido:

```
NODE_TEST_CONTEXT=child-v8 bash scripts/qa-tester-run.sh SPEC-001   → rc=0, con un caso fallando
bash scripts/qa-tester-run.sh SPEC-001                              → rc=1, correcto
```

Es la situación normal cuando el runner se ejecuta desde dentro de otro `node --test`, que es precisamente como lo ejercitan las pruebas del propio andamiaje. Los casos «Con una prueba que falla, el runner termina con código 1», «El report de un fallo trae el nombre literal del caso y la salida literal del fallo», «Sin ningún flujo en `test/app/`, el report lo registra y las de `@nucleo` se ejecutan igual», «Con ficheros sin commitear, el report lo registra como aviso y la ejecución continúa» y «La primera línea de contenido del report dice PASS o FAIL y coincide con el código de salida» salen en rojo en el report por esta causa.

### Causa raíz

**Uno — el guardián de ejecución directa compara rutas que no son comparables.** En `scripts/valida-spec-test-map.mjs`, línea 93:

```js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
```

`import.meta.url` llega con los enlaces simbólicos ya resueltos por el cargador de módulos; `process.argv[1]` llega absoluto pero sin resolver. Cuando la ruta de invocación atraviesa un enlace simbólico, las dos cadenas difieren, la condición es falsa y el bloque que imprime el veredicto y fija `process.exitCode` no se ejecuta nunca. El proceso termina con el 0 por defecto: no es que valide y apruebe, es que no llega a validar.

El mismo patrón, con el mismo defecto, está en `scripts/comprueba-nucleo.mjs`, línea 75. Ahí es peor: su código de salida sí decide el veredicto del runner (`if [ "$NUCLEO_RC" -ne 0 ]; then FALLO=1; fi`), de modo que una regresión de la frontera del núcleo —el hallazgo que la spec base manda poner por delante de todo lo demás— quedaría sin detectar y sin dejar rastro en el report.

`scripts/captura-fixtures.mjs` es la otra cara de la misma familia y también hay que tocarlo: no tiene guardián de ninguna clase, llama a `principal(process.argv.slice(2))` en el cuerpo del módulo, y por tanto importarlo desde cualquier sitio dispara una captura contra la red.

**Dos — el runner no sanea el entorno y su veredicto depende de la forma de la salida.** `scripts/qa-tester-run.sh` lanza `node --test --test-reporter=tap ...` heredando el entorno tal cual. Con `NODE_TEST_CONTEXT` presente, Node entiende que ya está dentro de una ejecución de pruebas y cambia la forma de la salida: el resumen TAP que el runner busca con

```sh
NUCLEO_TOTAL="$(grep '^# tests ' "$TMP/nucleo-run.txt" | tail -1 | awk '{print $3}')"
```

deja de aparecer con ese formato. Los tres `grep` no encuentran nada, los tres recuentos caen a su valor por defecto —`NUCLEO_TOTAL="${NUCLEO_TOTAL:-0}"` y compañía—, y el runner sigue adelante con `EJECUTADO=1` y `FALLO` sin tocar. El resultado es el peor posible: `CODIGO=0`, `VEREDICTO=PASS`, con un caso en rojo dentro del fichero de salida que el propio report adjunta.

Detrás del recuento hay una segunda causa, más de fondo, y es la que convierte esto en una clase de defectos y no en un caso: **el runner deduce PASS de la ausencia de señales de fallo**. Si no reconoce lo que recibe, no concluye nada malo. Un veredicto solo puede ser verde por afirmación —ejecuté esto, lo entendí, y salió bien—, nunca por silencio.

### Cambio requerido

Tres ajustes, quirúrgicos y sin patrones nuevos:

1. **Guardián canónico compartido.** Todo script del andamiaje que se pueda ejecutar directamente decide si es el programa principal comparando la ruta canónica de `process.argv[1]` con la canónica del propio módulo, con los enlaces simbólicos resueltos en los dos lados y tolerando que la ruta no exista. Se escribe una vez, en un módulo auxiliar bajo `scripts/`, y lo usan `valida-spec-test-map.mjs`, `comprueba-nucleo.mjs` y `captura-fixtures.mjs` —este último pasa a tener guardián, que hoy no tiene.
2. **Un validador que no valida no sale 0.** Los dos scripts que emiten veredicto por su cuenta imprimen siempre una línea de veredicto reconocible, y el runner comprueba que esa línea está antes de dar por buena su ejecución. Si no está, es «no se pudo ejecutar», no «todo bien».
3. **Entorno saneado y veredicto por afirmación en el runner.** El runner elimina del entorno que entrega a sus subprocesos las variables que pueden cambiar la forma de la salida de `node --test` —al menos `NODE_TEST_CONTEXT` y `NODE_OPTIONS`—, deja constancia en el report de cuáles quitó, y solo emite PASS cuando reconoció el resumen, el número de casos ejecutados es mayor que cero y ni el resumen ni el código del subproceso señalan fallo.

## Criterios de aceptación

Criterios nuevos, todos aditivos: esta iteración **no deroga ningún criterio de la spec base**. Están escritos para cerrar la clase entera —cualquier verde emitido sin haber ejecutado o sin haber entendido lo ejecutado— y no solo los dos casos reproducidos.

### Cómo un script decide que es el programa principal

- **Dado** cualquier script del andamiaje que se pueda ejecutar directamente, **cuando** se inspecciona cómo decide si es el programa principal, **entonces** compara rutas canónicas con los enlaces simbólicos resueltos en los dos lados, y no dos cadenas sin resolver.
- **Dado** `scripts/valida-spec-test-map.mjs`, **cuando** se ejecuta por su ruta real y por una ruta equivalente que atraviesa un enlace simbólico, **entonces** las dos ejecuciones imprimen lo mismo y devuelven el mismo código de salida.
- **Dado** `scripts/comprueba-nucleo.mjs`, **cuando** se ejecuta por su ruta real y por una ruta equivalente que atraviesa un enlace simbólico, **entonces** las dos ejecuciones imprimen lo mismo y devuelven el mismo código de salida.
- **Dado** un script del andamiaje invocado por una ruta relativa, por una ruta con `..` en medio o por un enlace simbólico que apunta directamente al fichero, **cuando** se ejecuta, **entonces** se reconoce como programa principal en los tres casos.
- **Dado** cualquier script del andamiaje, **cuando** se importa como módulo en lugar de ejecutarlo, **entonces** no ejecuta su cuerpo principal, no escribe nada por la salida estándar y no fija ningún código de salida.
- **Dado** `scripts/captura-fixtures.mjs`, **cuando** se importa desde otro módulo, **entonces** no captura ningún fixture y no abre ninguna conexión de red.
- **Dado** un proceso sin `process.argv[1]` o con un `process.argv[1]` que apunta a algo que no existe, **cuando** se evalúa el guardián, **entonces** decide que el script no es el programa principal y no lanza ninguna excepción.

### Un script que no llega a validar nunca sale 0 en silencio

- **Dado** cualquier script del andamiaje que emite un veredicto, **cuando** se ejecuta directamente, **entonces** escribe siempre al menos una línea de veredicto reconocible antes de terminar, cualquiera que sea el resultado.
- **Dado** `scripts/valida-spec-test-map.mjs`, **cuando** termina sin haber llegado a validar, **entonces** sale con un código distinto de 0 y explica por qué no pudo validar.
- **Dado** `scripts/comprueba-nucleo.mjs`, **cuando** termina sin haber llegado a comprobar la frontera, **entonces** sale con un código distinto de 0 y explica por qué no pudo comprobarla.
- **Dado** el runner, **cuando** un script de validación termina con código 0 pero sin línea de veredicto reconocible, **entonces** el report lo registra como «no se pudo validar» y nunca como validación correcta.
- **Dado** el runner, **cuando** es la comprobación de la frontera del núcleo la que termina sin veredicto reconocible, **entonces** la ejecución no puede terminar en PASS.
- **Dado** el mapa de cobertura sin validar por cualquier motivo, **cuando** se lee el report, **entonces** eso sigue apareciendo en la sección de infraestructura y nunca como una prueba en rojo, igual que en la spec base.

### El runner sanea el entorno que entrega a sus subprocesos

- **Dado** el runner, **cuando** lanza `node --test`, **entonces** lo hace con un entorno del que ha eliminado al menos `NODE_TEST_CONTEXT` y `NODE_OPTIONS`.
- **Dado** el runner, **cuando** lanza cualquiera de sus subprocesos —la comprobación de núcleo, la validación del mapa, `node --test` y Maestro—, **entonces** todos reciben el mismo entorno saneado.
- **Dado** `NODE_TEST_CONTEXT` en el entorno de partida y una prueba de `test/nucleo/` que falla, **cuando** se ejecuta el runner, **entonces** termina con código 1, exactamente igual que desde una shell limpia.
- **Dado** el mismo árbol de trabajo, **cuando** se ejecuta el runner desde una shell limpia y desde dentro de otro `node --test`, **entonces** el veredicto y el código de salida son los mismos en las dos ejecuciones.
- **Dado** que el runner ha eliminado alguna variable heredada, **cuando** se lee el report, **entonces** la sección de infraestructura nombra cuáles quitó.
- **Dado** el runner, **cuando** termina, **entonces** su salida estándar sigue conteniendo la ruta del report y nada más: el saneamiento se cuenta en el report, no por la salida estándar.

### El veredicto no depende de la forma de la salida de `node --test`

- **Dado** el runner, **cuando** decide PASS, **entonces** solo lo hace habiendo reconocido el resumen de la ejecución, con al menos un caso ejecutado, con cero fallos en el resumen y con código 0 del subproceso; si falta cualquiera de las cuatro condiciones, no hay PASS.
- **Dado** una salida de `node --test` en la que el runner no reconoce el resumen esperado, **cuando** termina, **entonces** el resultado es «no se pudo ejecutar» con código 2, nunca PASS.
- **Dado** una salida cuyo resumen no se reconoce, **cuando** se lee el report, **entonces** trae la salida literal completa de la ejecución y dice qué esperaba encontrar y no encontró.
- **Dado** ficheros de prueba en `test/nucleo/` y un resumen que declara cero casos ejecutados, **cuando** termina el runner, **entonces** no da PASS: había pruebas y no se ejecutó ninguna.
- **Dado** una discrepancia entre el código de salida de `node --test` y el resumen que el runner reconoce, **cuando** se emite el veredicto, **entonces** se elige el peor de los dos y la discrepancia queda registrada en el report.
- **Dado** un report cuya primera línea de contenido dice PASS, **cuando** se leen los resultados de `@nucleo`, **entonces** el recuento de casos ejecutados es mayor que cero.

### Robustez de la clase entera

- **Dado** cualquier pieza del andamiaje que emita un veredicto, **cuando** se ejecuta cuatro veces sobre el mismo árbol —por ruta real y por ruta con enlace simbólico, desde una shell limpia y desde dentro de otro `node --test`—, **entonces** las cuatro ejecuciones dan el mismo veredicto y el mismo código de salida.
- **Dado** el andamiaje entregado, **cuando** se enumeran los scripts que se pueden ejecutar directamente, **entonces** todos deciden si son el programa principal de la misma manera, sin variantes por script.

### Criterios de la base que se mantienen

Se citan porque son los confundibles con los nuevos, y ninguno se relaja:

- «**Dado** `test/nucleo/` con pruebas que pasan, **cuando** se ejecuta `scripts/qa-tester-run.sh SPEC-001`, **entonces** termina con código 0.» Sigue vigente: el camino feliz no se endurece, solo se exige que sea verdad.
- «**Dado** una ejecución cualquiera, **cuando** el runner termina, **entonces** su salida estándar contiene la ruta del report y nada más.» Sigue vigente sin excepción.
- «**Dado** `test/nucleo/` sin ninguna prueba, **cuando** se ejecuta el runner, **entonces** termina con un código distinto de 0 y el report dice que no había pruebas que ejecutar.» Sigue vigente y es el precedente del que salen los criterios nuevos.
- «**Dado** un árbol de trabajo sin cambios, **cuando** se ejecuta el runner dos veces seguidas, **entonces** los dos reports difieren solo en el sello de tiempo y en las duraciones.» Sigue vigente: la línea de variables saneadas es la misma para dos ejecuciones desde el mismo entorno de partida.

## Notas técnicas

- **Ficheros afectados**: `scripts/valida-spec-test-map.mjs` (guardián, línea 93; código de salida cuando no valida), `scripts/comprueba-nucleo.mjs` (guardián, línea 75; mismo tratamiento), `scripts/captura-fixtures.mjs` (pasa a tener guardián: hoy llama a `principal(...)` en el cuerpo del módulo), `scripts/qa-tester-run.sh` (saneamiento del entorno, reconocimiento del resumen, condición de PASS, dos líneas nuevas en la sección 3 del report) y un módulo auxiliar nuevo bajo `scripts/` con el guardián compartido.
- **Antes / después del guardián**: antes, `process.argv[1] === fileURLToPath(import.meta.url)`, que compara una ruta sin resolver con una resuelta; después, comparación de las dos rutas canonizadas, con los enlaces simbólicos resueltos en ambos lados y tolerancia a que la ruta no exista —en cuyo caso se compara la ruta tal cual, sin lanzar.
- **Antes / después del runner**: antes, los recuentos caen a `0` cuando el `grep` del resumen no encuentra nada y la ejecución continúa como si todo estuviera bien; después, no encontrar el resumen es una condición terminal de «no se pudo ejecutar» con código 2, y el PASS exige las cuatro afirmaciones del primer criterio de su bloque.
- **Qué composición se mantiene explícitamente**: el reparto de rutas de la spec base no se toca —`test/fixtures/**`, `test/dobles/**`, `test/spec-test-map.schema.json` y los scripts siguen siendo de `wa-dev`; `test/nucleo/**`, `test/app/**` y `test/spec-test-map.json` siguen siendo solo de `wa-qa-dev`. El orden de las seis secciones del report se mantiene. Los tres códigos de salida mantienen su significado: `0` PASS, `1` FAIL, `2` no se pudo ejecutar.
- **Impacto en la frontera del núcleo**: ninguno. El andamiaje sigue sin importar de `packages/nucleo/` —que además sigue sin existir hasta SPEC-002— y sin leer variables de entorno propias; el saneamiento es del entorno que el runner **entrega**, no de entorno que el andamiaje **lea**.
- **Sin i18n ni tracking**: el andamiaje no tiene interfaz ni telemetría.
- **Retrocompatibilidad**: total para quien invoca. El contrato de `wa-qa-tester` no cambia —sigue distinguiendo 0 de no-0— y la salida estándar del runner sigue siendo solo la ruta del report. Las pruebas que `wa-qa-dev` ya escribió siguen valiendo tal cual: lo que cambia es que ahora pueden pasar, porque el runner deja de mentir cuando se le ejecuta desde dentro de otro `node --test`. El único cambio observable en la salida es la línea nueva de variables saneadas en la sección de infraestructura del report, que no es rojo.
- **Dependencias**: SPEC-001 (`docs/specs/SPEC-001-andamiaje-pruebas.md`), la spec base de la que esto es corrección. Ninguna dependencia de runtime nueva: `realpath` está en `node:fs` y el saneamiento del entorno se hace con las herramientas de bash que el runner ya usa. No depende de SPEC-002 ni de SPEC-011.
- **Verificación manual tras la entrega**, cuatro pasos:
  1. Copiar o enlazar el árbol de forma que su ruta atraviese un enlace simbólico y ejecutar `node <ruta-con-symlink>/scripts/valida-spec-test-map.mjs`: debe imprimir el mismo veredicto que por la ruta real.
  2. `NODE_TEST_CONTEXT=child-v8 bash scripts/qa-tester-run.sh SPEC-001` con al menos un caso en rojo: debe devolver `1`, igual que `bash scripts/qa-tester-run.sh SPEC-001` desde una shell limpia.
  3. Comprobar que el report de esa ejecución nombra en su sección de infraestructura las variables que se sanearon.
  4. `node -e "import('./scripts/captura-fixtures.mjs')"`: no debe imprimir nada, no debe capturar nada y no debe intentar salir a la red.

## Decisiones asumidas

- **Cómo se canonizan las rutas** → asumido `realpathSync` de `node:fs` sobre los dos lados, con reserva a la ruta sin resolver si el fichero no existe (alternativa: comparar por inodo con `statSync`, o usar `path.resolve` a secas). Regla: cero dependencias, mismo comportamiento en macOS y en Linux, y `path.resolve` no resuelve enlaces simbólicos, que es justo el defecto que se corrige.
- **El guardián se escribe una sola vez y se comparte** → asumido un módulo auxiliar bajo `scripts/`, importado por los tres scripts (alternativa: repetir las tres líneas en cada uno). Regla: lo que se cierra aquí es una clase de defectos, y tres copias son tres oportunidades de que una diverja; el precedente es que el mismo patrón estaba copiado en dos scripts y falló en los dos.
- **Qué variables se sanean** → asumido eliminar `NODE_TEST_CONTEXT`, `NODE_OPTIONS` y cualquier otra `NODE_TEST_*` heredada (alternativa: arrancar los subprocesos con un entorno en blanco tipo `env -i`). Regla: un entorno en blanco se llevaría por delante `PATH` y `HOME` y haría el runner inejecutable en máquinas normales; la lista mínima es la que cambia la forma de la salida de `node --test`.
- **Una salida de `node --test` que no se reconoce vale 2 y no 1** → asumido (alternativa: tratarlo como FAIL con código 1). Regla: la misma que sostiene el 2 de la spec base, «no se pudo ejecutar» no es «falló», y quien orquesta necesita distinguirlos para saber si tiene que arreglar el código o la máquina.
- **`valida-spec-test-map.mjs` gana un tercer código de salida** → asumido `2` para «no llegué a validar», conservando `0` para válido o sin mapa y `1` para inválido (alternativa: no tocar sus códigos y confiar solo en la línea de veredicto). Regla: el runner ya recoge su código en `MAPA_RC` y lo publica en el report; un código que no distingue «válido» de «no validé» es exactamente el fallo que se está corrigiendo.
- **Un mapa que no se pudo validar sigue sin poner el report en rojo** → asumido, se queda en infraestructura como aviso (alternativa: hacerlo bloqueante). Regla: la spec base lo dice explícitamente, un mapa incompleto no es una regresión del juego. La comprobación de la frontera del núcleo sí es bloqueante, y ahí la ausencia de veredicto sí impide el PASS.
- **La línea de variables saneadas va en la sección 3 del report** → asumido, junto a Maestro y al mapa de cobertura (alternativa: sección nueva). Regla: la sección 3 es «lo que no se pudo montar en esta máquina» y una variable heredada que se retira es exactamente eso, sin tocar el orden de secciones que la base fija como operativo.
- **Sin sección de UX ni de comportamiento responsive** → asumido: esta iteración no tiene interfaz, igual que la spec base.
