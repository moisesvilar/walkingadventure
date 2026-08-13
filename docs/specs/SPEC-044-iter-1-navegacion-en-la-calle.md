# SPEC-044-iter-1 — El punto de partida cuenta para la cadencia, y solo para la cadencia

## Descripción

Iteración de **cambio de comportamiento** sobre la implementación de SPEC-044. La desencadena una decisión de producto del dueño del proyecto, tomada el **13-ago-2026**, con la medida delante: en el punto de partida `(0,0)`, `cadenciaDeMuestreo` devuelve **`por-distancia` en 6 de los 8 mundos de referencia** —con el geofence más cercano entre 19,0 y 191,4 m del borde— y `por-tiempo` en los otros 2 **por accidente de trazado**, porque un sitio pisa el anclaje (−8,0 m en suelo-250m semilla 2, −21,0 m en urbano-denso semilla 2). Quien vuelve a casa y se para deja de recibir fijos —**medido el 13-ago-2026: cero fijos en 5 min 56 s** con cadencia `por-distancia` y quien juega parada—, la permanencia del regreso no acumula y **el telón por regreso no puede saltar**.

**Qué cambia.** La decisión de cadencia deja de tomarse solo contra los geofences del mapa activo: **el punto de partida de la salida abierta entra como segunda razón para muestrear por tiempo**, con el radio del regreso y la misma histéresis que ya usan los sitios. **Qué no cambia, y es la mitad importante de la decisión**: el punto de partida **no se convierte en sitio jugable**. No entra al índice de geofences, no valida ninguna llegada, no consume anclaje, no produce escena y no aparece en el mapa como sitio. Entra **por la firma de la decisión**, no por el índice, y esa forma es la que hace imposible confundir las dos cosas por descuido.

**Por qué esta spec y no SPEC-032.** La cadencia es de SPEC-044 y está declarado en las dos direcciones: SPEC-044 la convirtió de constante en respuesta del paquete y se la trajo a su alcance de frontera («la **cadencia de la suscripción** deja de ser una constante para ser una respuesta del paquete»), tiene sus seis ACs de cadencia, su reparto de rutas, su decisión de diseño razonada y su marca observable `salida-cadencia`; y **SPEC-032-iter-1 la declara explícitamente fuera del suyo** («la cadencia por tiempo y su histéresis… todo eso es SPEC-044 y aquí se cita»). SPEC-032 es la dueña del geofence, del radio y de la permanencia de una llegada, y ninguna de las tres se toca aquí.

Lo que **no** cambia tampoco: el radio de geofence, la permanencia de una llegada, la ventana de deriva, el umbral de precisión, la cadencia por distancia de SPEC-048, los cinco segundos de la cadencia por tiempo y los veinte metros de histéresis. Ninguna dependencia nueva.

## Alcance de implementación

- Esta iteración define **únicamente el código de producción** del delta: el punto de partida como parámetro de la decisión de cadencia, con su radio y su razón declarada, y su paso desde la orquestación de la salida.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `wa-qa-dev` y los ejecuta `wa-qa-tester` contra el código ya commiteado, en un paso posterior del bucle de QA de este repo. Cualquier test que el implementador entregue será descartado o reemplazado.
- **Sí hay cambio de la frontera del núcleo, y es pequeño**: `cadenciaDeMuestreo` gana un parámetro con nombre para el punto de partida, en metros del mundo, y su respuesta gana la razón. **`sitiosConPosicion` no se toca.** **Ninguna dependencia nueva.**
- **Fuera de alcance del delta**: la cota de frescura de la apertura y el re-anclaje, que son de **SPEC-048-iter-1**; el radio del regreso y su reloj de permanencia (`packages/nucleo/partida/regreso.js`), que son de SPEC-030 y aquí solo se **leen**; y el radio de geofence, la permanencia y la ventana de deriva, que son de SPEC-032 y su iteración.

## Criterio de aceptación modificado

### ACs nuevos

- **Dado** una salida abierta y quien juega en el punto de partida, **cuando** se pide la cadencia del muestreo, **entonces** es **por tiempo**, aunque no haya ningún geofence de sitio debajo.
- **Dado** los ocho mundos de referencia de `test/nucleo/mundo-de-prueba.mjs`, **cuando** se pide la cadencia en el punto de partida de cada uno, **entonces** sale por tiempo en **los ocho**.
- **Dado** una cadencia por tiempo decidida por el punto de partida, **cuando** se lee la respuesta, **entonces** **no nombra ningún sitio** y declara que la razón es el punto de partida.
- **Dado** una posición que está a la vez dentro del geofence de un sitio y cerca del punto de partida, **cuando** se decide la cadencia, **entonces** sale por tiempo una sola vez y el sitio nombrado es el sitio real.
- **Dado** quien se aleja del punto de partida, **cuando** la última posición queda a más del radio del regreso más el margen de cercanía, **entonces** la cadencia vuelve a ser por distancia.
- **Dado** una posición en el borde de ese radio que entra y sale por el ruido del fijo, **cuando** se decide la cadencia, **entonces** la histéresis impide cambiar de cadencia en cada muestra, igual que con los geofences de sitio.
- **Dado** una partida sin salida abierta, **cuando** se pide la cadencia, **entonces** se decide solo con los geofences del mapa activo, sin punto de partida y sin fallar.
- **Dado** quien vuelve al punto de partida tras haberse alejado y se queda quieta el tiempo declarado, **cuando** llegan las posiciones, **entonces** llegan con la cadencia por tiempo y la permanencia del regreso acumula hasta cerrar la salida.
- **Dado** el índice que devuelve `sitiosConPosicion`, **cuando** se enumera, **entonces** contiene exactamente los núcleos, sus servicios y los parajes, y **no** el punto de partida.
- **Dado** quien se queda en el punto de partida el tiempo de permanencia de una llegada, en un sitio donde no hay ningún sitio del mundo, **entonces** **no se valida ninguna llegada** y no queda ninguna escena esperando.
- **Dado** el mapa pintado durante una salida, **cuando** se enumeran sus elementos, **entonces** el punto de partida no aparece como sitio.
- **Dado** la superficie del paquete, **cuando** se busca por dónde entra el punto de partida a la decisión, **entonces** entra **por la firma** y no metiéndolo en el índice de geofences.

### ACs de la base que se mantienen, y son los confundibles

> «**Dado** una salida que se abre con quien juega ya parada dentro de un geofence, **cuando** se abre, **entonces** la cadencia por tiempo se decide con el punto de partida y no espera a un fijo que no va a llegar.»

Sigue entero, y esta iteración lo generaliza: la cadencia se sigue decidiendo con el punto de partida antes de arrancar el servicio, y ahora el punto de partida es además **una razón por sí mismo** y no solo el punto contra el que se miden los sitios.

> «**Dado** la cadencia por tiempo activa, **cuando** se inspecciona lo que se guarda, **entonces** no se guarda ninguna posición más que antes: lo que sobrevive sigue siendo la última, sobrescrita.» *(`@privacidad`, bloqueante.)*

Sigue entero. Este delta no guarda nada nuevo: el punto de partida ya estaba en el estado desde SPEC-030.

> «**Dado** la cadencia por tiempo activa, **cuando** se lee la línea del rótulo del sistema, **entonces** dice exactamente lo mismo que fuera del geofence.» *(`@privacidad`, bloqueante.)*

Sigue entero, y ahora cubre también el caso de estar en casa: acercarse al punto de partida no cambia lo que se lee en la pantalla de bloqueo.

### AC derogado

El criterio «**Dado** la decisión de cadencia, **cuando** se inspecciona dónde vive, **entonces** es una función del paquete sobre la última posición y los geofences del mapa activo, y la app solo la aplica» **queda obsoleto y debe entenderse derogado** por esta iteración. El comportamiento esperado del implementador y de la suite QA es el del criterio nuevo:

- **Dado** la decisión de cadencia, **cuando** se inspecciona dónde vive, **entonces** es una función del paquete sobre la última posición, los geofences del mapa activo **y el punto de partida de la salida abierta**, y la app solo la aplica.

Lo derogado es **dónde mira**, no dónde vive: la decisión sigue siendo del paquete y la app sigue sin decidir nada.

## UX Design — ajuste puntual

Ninguna pantalla se recompone y ninguna arista de `docs/flujo.md` cambia.

### data-testid

`salida-cadencia` **no cambia**: sigue con el vocabulario cerrado `por-distancia` · `por-tiempo`, que es lo que hace afirmable desde el aparato que el muestreo cambia. La razón —sitio o punto de partida— se afirma en `@nucleo` sobre la respuesta de la función, y **no** se añade marca nueva: sería una marca por dato interno, no por elemento que una prueba necesite alcanzar.

### Patrón de interacción

- **El punto de partida entra a la cadencia y no al juego.** El índice de geofences alimenta a la vez la cadencia y las llegadas; meter el punto ahí convertiría el portal de casa en un sitio al que se llega, con su escena y su ficha, y eso no lo ha decidido nadie. La separación es **de forma**: con el punto entrando por la firma, hacerlo mal exige escribirlo aposta.
- **El radio es el del regreso y no el de geofence.** Lo que se compra es que la permanencia del regreso pueda acumular, y esa permanencia se cuenta dentro de 50 m (`packages/nucleo/partida/regreso.js:35` y `:52`). Con los 40 m del geofence quedaría un anillo de diez metros dentro del cual se cuenta el regreso y no llegan fijos, que es el agujero de hoy en pequeño.
- **El coste sigue acotado.** SPEC-044 acotó la cadencia rápida a estar dentro de un geofence en vez de a un halo, por gasto. Aquí se añade **un** círculo más por salida, el de casa, y solo mientras hay salida abierta: el orden de magnitud del gasto no cambia.

## Notas técnicas

### Ficheros afectados

- `packages/nucleo/partida/llegadas.js` — `cadenciaDeMuestreo` gana el parámetro con nombre del punto de partida (en metros del mundo) y su respuesta gana la razón; usa `RADIO_DE_REGRESO_M` leído del módulo del regreso, no un número nuevo. **`sitiosConPosicion` (`:305-317`) no se toca**, y hay AC que lo afirma.
- `app/marcha/salida.js` — las tres llamadas a `cadenciaDeMuestreo` (`:239`, `:434`, `:509`) pasan el punto de partida de la salida abierta, en metros del mundo, con la misma proyección que ya usa `enMetros`. El índice se sigue construyendo una vez (`:168`) y no cambia.

**Composición que se mantiene explícitamente**: el criterio de «el más cercano» para nombrar sitio; la histéresis asimétrica —entrar cuesta el radio, salir el radio más el margen—; que por distancia `segundos` sea `null` y por tiempo lo sea `metros`; y que la app vuelva a pedir la suscripción con las opciones nuevas **sin pararla en medio**.

**Impacto en el estado de partida**: ninguno por este delta. El punto de partida ya vive en `AREA_SALIDAS` desde SPEC-030. **Impacto en la frontera del núcleo**: sí, un parámetro más en la firma. **Retrocompatibilidad**: el parámetro es opcional y su ausencia da exactamente el comportamiento de hoy, que es lo que necesitan las llamadas sin salida abierta.

### La premisa, ya medida: esto es condición necesaria y no una mejora de latencia

Hasta el 13-ago-2026 todo esto descansaba en una afirmación **leída y no medida**: que con la cadencia por distancia a diez metros alguien parado no recibe fijos (`packages/nucleo/partida/llegadas.js:218-222`). **Ya está medida en el emulador `wa-pixel`**, y sale confirmada quedándose corta:

- **Parada, cadencia `por-distancia`: cero fijos en 5 min 56 s.** Nueve muestras con `ultimaMarcaMs` congelada **en el mismo milisegundo**; el primer fijo llegó a los **355,8 s**, y solo al mover la posición. El comentario del módulo dice «un fijo en trescientos segundos»; lo medido es **ninguno en trescientos cincuenta y seis**.
- **Contraprueba, parada dentro de un geofence con cadencia `por-tiempo`:** la marca avanza en **cada muestra** (+25 a +35 s) y `ultimoPropioMs` **no se mueve ni un milisegundo**. Llegan posiciones y ninguna cuenta como metro propio: el mecanismo hace exactamente lo que dice, medido en las dos direcciones. De paso, la permanencia validó y la escena saltó sola.

Así que este delta **no** es una mejora de latencia: es **condición necesaria para que el regreso pueda cerrarse**, y se cita con el número en lugar de con la lectura. Al tocar el comentario de `llegadas.js:218-222` se actualiza con la medida nueva —acierta en el fondo y se queda corto en el número—, en vez de borrar la vieja.

**Precondición de cualquier medida de este tipo en el emulador**, medida el mismo día y contraria a lo que dice `CLAUDE.md` §13b: **`adb emu geo fix` no inyecta nada si nadie pide posición**. Con el bucle corriendo cada 2 s durante 4 minutos, `dumpsys location` seguía enseñando el fijo del arranque del emulador y el Event Log no tenía un evento desde el boot; en cuanto otra app pidió posición, apareció el fijo del bucle con edad 0,6 s. Un `dumpsys` con fijo viejo **no prueba** que el bucle esté parado. El detalle completo está en SPEC-053.

### Verificación manual tras la entrega

**Precondición en el emulador**: el bucle de `adb emu geo fix` tiene que estar corriendo **y** hay que comprobarlo pidiendo posición, no leyendo `dumpsys location` a secas — el GPS del emulador es bajo demanda y un `dumpsys` con fijo viejo solo dice que nadie ha pedido.

1. Abrir una salida y leer `salida-cadencia` sin moverse: dice `por-tiempo`.
2. Alejarse más del radio del regreso más el margen: pasa a `por-distancia`.
3. Volver al punto de partida y quedarse quieta: vuelve a `por-tiempo` y, al minuto, cae el telón.
4. Comprobar que quedarse en el punto de partida **no** abre ninguna llegada ni deja ninguna escena esperando.

### Dependencias

La spec base **SPEC-044**; **SPEC-032** y su iteración, de donde vienen el geofence, la permanencia y `sitiosConPosicion`, que aquí no se tocan; **SPEC-030**, de donde vienen el punto de partida, el radio del regreso y su reloj; **SPEC-048** y su iteración 1, que entregan la única suscripción y el punto de partida bien anclado; y **SPEC-053**, la fila que entrega este delta con sus mediciones.

## Decisiones asumidas

- **Gherkin español** en los ACs nuevos, como la base → asumido, sin cambio.
- **El punto de partida entra por la firma y no al índice** → asumido (alternativa: meterlo en `sitiosConPosicion` con un tipo especial y filtrarlo en las llegadas). Regla: un filtro que hay que acordarse de poner es la forma de fallo que este repo ya ha pagado; la separación tiene que ser de forma y no de disciplina.
- **El radio es `RADIO_DE_REGRESO_M` y se lee, no se copia** → asumido (alternativa: `RADIO_DE_GEOFENCE_M`, por simetría; o una constante nueva). Regla: lo que se compra es que la permanencia del regreso acumule, y dos números que significan lo mismo se desincronizan.
- **La respuesta declara la razón en vez de inventar un nombre de sitio** → asumido (alternativa: devolver un sitio llamado «el punto de partida»). Regla: en este juego a un sitio se le nombra y el nombre es su identificador; un sitio fantasma en la respuesta acabaría en algún índice, que es exactamente lo que la decisión del dueño prohíbe.
- **Sin marca observable nueva para la razón** → asumido (alternativa: exponerla junto a `salida-cadencia`). Regla: el design system pide un identificador por elemento que una prueba **necesite alcanzar**, y la razón se afirma sobre la función pura sin aparato.
