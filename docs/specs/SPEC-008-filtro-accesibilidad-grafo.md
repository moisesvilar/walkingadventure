# SPEC-008 — El filtro de accesibilidad sobre el grafo

## Descripción

Marca cada tramo del grafo viario con lo que los datos de OSM permiten afirmar sobre él —escalones, firme, bordillos, paso— y aplica sobre esa marca los caminos que el jugador ha dicho que evita. El filtro **evita y declara, nunca borra**: el mundo entero sigue existiendo y dibujándose, lo que cambia es por dónde te mandan; y cuando no hay por dónde rodear, se pasa por ahí y se dice con nombre propio y motivo concreto, para que decidas tú.

Es la spec donde el proyecto elige decir la verdad antes que fingir cobertura. De ahí sus tres afirmaciones incómodas: lo que nos inventamos nosotros —lo cosido y lo `fallback`— **no se promete transitable**, y por eso hace falta un tercer estado y no dos; **las cuestas no se prometen** porque no hay modelo de elevación; y cuando el filtro deja el mundo sin reparto, el juego **ofrece** alejarse un tramo más y no lo impone.

No tiene interfaz de usuario. Entrega marcas y datos de declaración que consumen las filas que sí pintan pantalla: la lista de aventuras y su ficha (fila 28, `portada-antes-de-salir`), el momento en marcha y el desvío (fila 29, `en-marcha-mapa-avisos`), y la elección de «caminos que evitar» de los ajustes (fila 38, `repisa-ajustes`) más su primera declaración en el arranque (fila 27, `onboarding-arranque`).

Ancla: **RF-MUNDO-017** (`docs/prd.md` §4.1), con `game-design/accesibilidad.md` §2 como fuente —que manda sobre el PRD—, el encuadre del propio documento y **RNF-ACC-001** y **RNF-ACC-003** (§5.4) como los invariantes que no se pueden romper, **RF-QUEST-012** (§4.2) porque el filtro es una de las dos cosas que disparan el estirón, y el riesgo 8 (§8) como la razón por la que las cuestas se declaran en vez de cubrirse.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Fuera de alcance, y conviene que se lea antes de empezar:** ninguna pantalla, ningún texto de interfaz y ninguna redacción. Esta spec entrega el nombre propio del tramo y el motivo en clave; la frase que lee el jugador la escribe la fila que pinta. Tampoco entra aquí el ajuste de «caminos que evitar» (fila 38) ni su primera declaración en el arranque (fila 27): el conjunto de criterios llega **inyectado**. Tampoco el casting de quests (fila 10), que consume la ruta filtrada pero no la implementa.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «Evitar sin borrar» y «Declarar lo evitado y lo no prometido»; la validación de entradas, en el conjunto de criterios inyectado y en los tags mal formados de OSM; el estado vacío, en el jugador sin ningún criterio marcado y en el mundo cuyos datos no traen ni un tag de accesibilidad; el estado de error, en el tramo personal ausente, el criterio desconocido y el grafo vacío; y los casos límite, en la única salida que es una escalera, el grafo entero de suposición, el mundo mínimo de 250 m y el rodeo que se pasa del tope.

### Los tags que hacen falta

- **Dado** el mundo de una celda, **cuando** se pide su callejero, **entonces** la consulta trae los tags `highway`, `surface`, `smoothness`, `width`, `kerb` y `wheelchair` de cada vía.
- **Dado** el mundo de una celda, **cuando** se pide su callejero, **entonces** la consulta trae también los nodos con `kerb` o `barrier=kerb`, que es donde OSM mapea los bordillos.
- **Dado** el callejero recibido, **cuando** se parsea, **entonces** cada tramo del grafo conserva los tags de accesibilidad de su vía de origen.
- **Dado** un tramo cuyo `width` viene con unidad (`0.9 m`, `90 cm`), **cuando** se parsea, **entonces** se interpreta como metros y no se descarta.
- **Dado** un tramo cuyo `width` no es un número interpretable, **cuando** se parsea, **entonces** se trata como si el tag no viniera.

### Los cuatro criterios y el tercer estado

- **Dado** un tramo con `highway=steps`, **cuando** se marca su aptitud, **entonces** queda **no apto** para el criterio de escalones.
- **Dado** un tramo con cualquier otro valor de `highway`, **cuando** se marca su aptitud, **entonces** queda **apto** para el criterio de escalones.
- **Dado** un tramo con `surface` de la lista dura o `smoothness` bueno, **cuando** se marca su aptitud, **entonces** queda **apto** para el criterio de firme.
- **Dado** un tramo con `surface` de la lista blanda o `smoothness` malo, **cuando** se marca su aptitud, **entonces** queda **no apto** para el criterio de firme.
- **Dado** un tramo sin `surface` ni `smoothness`, **cuando** se marca su aptitud, **entonces** queda en **no se sabe** para el criterio de firme, que no es ni apto ni no apto.
- **Dado** un tramo con un bordillo rebajado o a ras, **cuando** se marca su aptitud, **entonces** queda **apto** para el criterio de bordillos.
- **Dado** un tramo con un bordillo levantado o de más de tres centímetros, **cuando** se marca su aptitud, **entonces** queda **no apto** para el criterio de bordillos.
- **Dado** un tramo sin ningún dato de bordillo, **cuando** se marca su aptitud, **entonces** queda en **no se sabe** para el criterio de bordillos.
- **Dado** un tramo con `wheelchair=no` o con una anchura menor de noventa centímetros, **cuando** se marca su aptitud, **entonces** queda **no apto** para el criterio de paso.
- **Dado** un tramo con `wheelchair=limited`, **cuando** se marca su aptitud, **entonces** queda en **no se sabe** para el criterio de paso.
- **Dado** un tramo con un valor que no está en ninguna de las listas conocidas, **cuando** se marca su aptitud, **entonces** queda en **no se sabe** para ese criterio y no se inventa una aptitud.
- **Dado** cualquier tramo del grafo, **cuando** se lee su marca, **entonces** los cuatro criterios tienen uno de exactamente tres valores y ninguno queda sin marcar.

### Lo que nos inventamos: la suposición nunca es apta

- **Dado** un tramo con marca de suposición —cosido o `fallback`—, **cuando** se marca su aptitud, **entonces** queda en **no se sabe** para los cuatro criterios.
- **Dado** un tramo cosido que une dos vías asfaltadas y anchas, **cuando** se marca su aptitud, **entonces** sigue en **no se sabe** y no hereda la aptitud de ninguna de las dos.
- **Dado** un jugador con cualquier criterio activo, **cuando** se traza un lazo que atraviesa un tramo de suposición, **entonces** ese tramo no cuenta como apto en ningún punto del trazado.
- **Dado** un lazo trazado enteramente por tramos de suposición, **cuando** se entrega, **entonces** llega con todos ellos declarados como no prometidos.

### Evitar sin borrar: el trazado

- **Dado** un jugador que evita escalones y un mundo donde el camino corto pasa por unas escaleras, **cuando** se traza el lazo de una aventura, **entonces** la ruta entregada no pasa por las escaleras.
- **Dado** el mismo mundo y el mismo jugador, **cuando** se inspecciona el grafo después de trazar, **entonces** el tramo de las escaleras sigue en el grafo con su peso real.
- **Dado** el mismo mundo y el mismo jugador, **cuando** se pide qué hay que dibujar, **entonces** las escaleras siguen entre lo que se dibuja, igual que sin filtro.
- **Dado** un jugador con criterios activos, **cuando** existe una ruta sin ningún tramo no apto, **entonces** se entrega esa ruta aunque sea más larga que la corta.
- **Dado** dos rutas sin tramos no aptos, **cuando** se elige entre ellas, **entonces** se entrega la que atraviesa menos tramos en «no se sabe».
- **Dado** dos rutas sin tramos no aptos y con los mismos tramos en «no se sabe», **cuando** se elige entre ellas, **entonces** se entrega la más corta.
- **Dado** un rodeo que evita todo lo no apto pero alarga el lazo más de medio tramo del jugador, **cuando** se traza, **entonces** se entrega la ruta corta con sus tramos difíciles declarados, y no el rodeo.
- **Dado** un núcleo cuya única salida es una escalera, **cuando** se traza un lazo que pasa por él, **entonces** el lazo se traza por la escalera.
- **Dado** ese mismo lazo, **cuando** se entrega, **entonces** el núcleo sigue siendo alcanzable y no ha quedado descolgado del reparto.
- **Dado** un jugador sin ningún criterio marcado, **cuando** se traza un lazo, **entonces** la ruta es exactamente la misma que sin filtro.
- **Dado** un jugador sin ningún criterio marcado, **cuando** se entrega el lazo, **entonces** no lleva ninguna declaración de camino evitado.
- **Dado** un conjunto de criterios que contiene uno desconocido, **cuando** se pide un trazado, **entonces** falla con un error que nombra el criterio recibido y enumera los válidos.
- **Dado** un jugador sin tramo personal declarado ni estimado, **cuando** se pide un trazado con criterios activos, **entonces** falla con un error que nombra la dependencia que falta, en lugar de suponer un tope de rodeo.
- **Dado** un grafo sin ningún tramo, **cuando** se pide un trazado, **entonces** se devuelve que no hay reparto en lugar de un error.

### Declarar lo evitado y lo no prometido

- **Dado** un lazo que rodea un tramo no apto, **cuando** se entrega, **entonces** lleva una declaración por cada tramo evitado.
- **Dado** una declaración de tramo evitado, **cuando** se lee, **entonces** trae el nombre propio del camino evitado.
- **Dado** una declaración de tramo evitado, **cuando** se lee, **entonces** trae el motivo en clave —escalones, firme, bordillo o paso— y no un texto redactado.
- **Dado** una declaración de tramo evitado, **cuando** se lee, **entonces** trae el punto del recorrido en el que la ruta se separa de lo evitado, para que el desvío se pueda ofrecer donde toca.
- **Dado** un tramo no apto que el lazo atraviesa porque no había rodeo, **cuando** se entrega el lazo, **entonces** ese tramo llega declarado con su nombre y su motivo, igual que uno evitado.
- **Dado** un tramo de suposición que el lazo atraviesa, **cuando** se entrega el lazo, **entonces** llega declarado como no prometido, distinguible de un tramo declarado por no apto.
- **Dado** un tramo difícil sin nombre propio en el grafo, **cuando** se va a declarar, **entonces** la entrega falla nombrando el tramo sin nombre, en vez de declarar un camino que no se puede nombrar.
- **Dado** un lazo sin nada que evitar ni nada que no prometer, **cuando** se entrega, **entonces** sus dos listas de declaración llegan vacías y no ausentes.

### Las cuestas no se prometen

- **Dado** un mundo con datos de OSM que traen `incline` en algunas vías, **cuando** se marca la aptitud del grafo, **entonces** ningún criterio se deriva de `incline`.
- **Dado** cualquier tramo del grafo, **cuando** se lee su marca de aptitud, **entonces** no existe ningún criterio de pendiente, cuesta ni desnivel.
- **Dado** cualquier lazo entregado, **cuando** se leen sus declaraciones, **entonces** ningún motivo en clave se refiere a la pendiente.
- **Dado** el conjunto de criterios que el filtro admite, **cuando** se enumera, **entonces** son exactamente cuatro y ninguno es la pendiente.

### Sin reparto: el estirón se ofrece

- **Dado** un mundo donde el filtro deja menos de un lazo posible, **cuando** el jugador pide aventuras, **entonces** se entrega que no hay reparto, con el filtro como motivo.
- **Dado** ese mismo caso, **cuando** se lee lo entregado, **entonces** trae la oferta de alejarse un tramo más, con cuántos tramos se sugiere alejarse.
- **Dado** ese mismo caso, **cuando** no se responde nada a la oferta, **entonces** el alcance de la salida sigue siendo el mismo y nada se ha ampliado solo.
- **Dado** ese mismo caso, **cuando** se acepta la oferta, **entonces** se vuelve a repartir con el alcance ampliado y el filtro sigue igual de activo.
- **Dado** un mundo sin reparto por el filtro, **cuando** se entrega la falta de reparto, **entonces** no se genera ni se resiembra nada del mundo.
- **Dado** un mundo del suelo de 250 m con criterios activos que dejan fuera casi todo, **cuando** el jugador pide aventuras, **entonces** se ofrece el estirón en vez de devolver una lista vacía sin explicación.
- **Dado** un mundo donde el filtro sí deja al menos un lazo, **cuando** el jugador pide aventuras, **entonces** no se ofrece ningún estirón.

### El encuadre: ni la palabra ni una opción peor

- **Dado** todo lo que esta capa entrega hacia fuera —claves, valores, motivos y nombres—, **cuando** se inspecciona, **entonces** no aparece la palabra «accesibilidad» en ninguno.
- **Dado** el mismo mundo y el mismo jugador con y sin criterios activos, **cuando** se pide el reparto de aventuras, **entonces** el número de aventuras ofrecidas es el mismo salvo que se dispare la falta de reparto.
- **Dado** el mismo mundo y la misma aventura con y sin criterios activos, **cuando** se castea, **entonces** tiene el mismo número de beats.
- **Dado** un jugador con criterios activos, **cuando** se lee el mundo generado, **entonces** tiene los mismos núcleos, parajes, servicios y nombres que el de un jugador sin criterios.
- **Dado** un jugador con criterios activos, **cuando** se enumera lo que se dibuja del mapa, **entonces** es idéntico a lo que se dibuja sin criterios.

### Determinismo y no resiembra

- **Dado** una misma semilla, unos mismos datos de OSM y un mismo conjunto de criterios, **cuando** se traza el mismo lazo dos veces, **entonces** las dos rutas son idénticas.
- **Dado** un mismo conjunto de criterios recibido en distinto orden, **cuando** se traza el mismo lazo, **entonces** la ruta es la misma.
- **Dado** un mundo ya generado, **cuando** el jugador cambia sus criterios, **entonces** el mundo no se resiembra.
- **Dado** un mundo ya generado, **cuando** el jugador cambia sus criterios, **entonces** las calzadas dibujadas y sus nombres siguen siendo los mismos.
- **Dado** el marcado de aptitud del grafo, **cuando** se ejecuta, **entonces** no consulta el conjunto de criterios del jugador en ningún punto.
- **Dado** el filtro, **cuando** se inspecciona su implementación, **entonces** no usa ninguna fuente de azar ni de tiempo del sistema.

## Notas técnicas

### Las dos mitades, que es la decisión que sostiene todo lo demás

El filtro se parte en dos, y confundirlas rompe `RF-MUNDO-005` (lo generado no se resiembra jamás):

1. **El marcado de aptitud es del mundo.** Sale de los tags de OSM, no depende de ningún jugador, y se calcula una vez al generar la celda. Dos personas con filtros distintos ven exactamente el mismo grafo marcado.
2. **El filtro es de la salida.** Los criterios del jugador entran al **trazar el lazo** y al **castear a dónde te mandan**, nunca al generar. Por eso cambiar «caminos que evitar» en los ajustes no toca el mapa: las calzadas dibujadas son las mismas y con los mismos nombres.

Esto es lo que hace compatible «el mundo entero existe y se dibuja» de `accesibilidad.md` §2 con el invariante de no resiembra.

### Frontera de inyección

Esta spec **sí** toca la frontera del núcleo, en tres sitios:

- **La consulta de callejero** pasa a pedir los tags de accesibilidad y los nodos de bordillo. Hoy `fetchStreets` pide `way["highway"~...]` y `out geom`, que ya trae tags, pero **`parseStreets` los tira todos** y **los bordillos ni se piden**, porque en OSM viven en nodos (`kerb=*`, `barrier=kerb`) y `out geom` de un way no trae tags de sus nodos. Hace falta añadir la consulta de nodos y cruzarlos con la geometría de las vías.
- **Cambiar el texto de la consulta invalida la caché entera** del proxy, porque la clave es el hash del QL (`CLAUDE.md`, trampas conocidas). La primera ejecución después de este cambio pagará minutos contra los mirrors públicos: es esperado, no es un cuelgue. Los fixtures de `test/fixtures/osm/` se capturaron con la consulta vieja y **no traen estos tags**; recapturarlos rompería la regla de SPEC-001 de que un fixture no se regenera, así que hace falta un fixture nuevo (ver huecos, abajo).
- **El conjunto de criterios y el tramo personal llegan inyectados**, no se leen de ningún almacén. El tramo lo entrega la fila 4 (`tramo-personal`) y el conjunto de criterios, las filas 27 y 38. Sin tramo no hay tope de rodeo y la llamada falla; sin criterios, el filtro es la identidad.

### Lo que consume de SPEC-007 y no respecifica

`SPEC-007-grafo-cosido-ramales` (RF-MUNDO-013, RF-MUNDO-014) entrega dos cosas de las que esta depende y que **no se redefinen aquí**:

- **La marca de suposición** sobre toda arista que no existe en OSM: las que cose `coserHuecos` hasta 180 m y los tramos `fallback` que traza `buildRoutes` cuando no hay camino. Esta spec la lee y la traduce a «no se sabe» en los cuatro criterios. No la calcula.
- **El nombre de los ramales**, que hoy nacen sin él (`linkParajes` devuelve `name: null`). Sin nombre no hay declaración posible, y por eso hay un criterio de aceptación que hace fallar la entrega en vez de declarar un camino sin nombre.

### La forma de la marca y del dato entregado

Tres piezas, y conviene que el implementador las separe porque las consumen agentes distintos:

- **La marca de aptitud**, por tramo del grafo: los cuatro criterios (`escalones`, `firme`, `bordillos`, `paso`), cada uno con uno de tres valores. El tercer valor es tan de primera clase como los otros dos: colapsarlo a dos es el error fácil de esta spec, y es exactamente lo que convierte «no lo sé» en una promesa.
- **La ruta filtrada**, que devuelve el recorrido más dos listas: los tramos **evitados o atravesados a la fuerza** (nombre, motivo en clave, punto del recorrido donde la ruta se separa) y los tramos **no prometidos** (nombre, y la suposición como motivo). Las dos listas existen siempre, vacías cuando no hay nada que declarar.
- **La falta de reparto**, que devuelve el motivo y la oferta del estirón con cuántos tramos se sugiere alejarse. Es un dato, no una acción: quien decide es el jugador, y quien pinta la oferta es la fila 28 sobre la pantalla «Lo que hay hoy» (`A2P3` de `docs/flujo.md`). El desvío y la declaración en marcha los pinta la fila 29 sobre `A3P5`, «El desvío».

Sobre el tope de rodeo: se expresa **en tramos del jugador**, no en metros, por la misma razón que `accesibilidad.md` §1 obliga a reexpresar los cupos —un tope en metros absolutos significa cosas distintas para dos personas—. Y va en la dirección que parece contraintuitiva a primera vista: pasado el tope se usa la ruta corta y se declara, porque un rodeo de dos kilómetros para esquivar tres escalones es peor respuesta que decir la verdad y dejar decidir. `accesibilidad.md` §2 lo dice explícito: **tú sabes de tu barrio más que OSM**, y una escalera puede tener al lado una rampa que nadie ha mapeado.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Ninguno se implementa aquí —son de `wa-qa-dev`—, y **no se duplican**: la batería se escribió antes que el código y esta spec la referencia por su nombre literal.

De la característica **«El filtro sobre el grafo evita y declara, nunca borra»** (`@nucleo @accesibilidad`, fuente `accesibilidad.md` §2):

- «El trazado rodea lo que el filtro evita»
- «El camino evitado se declara con nombre propio»
- «Lo que nos inventamos no se promete como transitable»
- «Si el filtro deja el mundo sin reparto, se ofrece el estirón»

De **«El callejero troceado de OSM se cose antes de trazar»** (`@nucleo @casting`), que es de SPEC-007 pero cuya marca esta spec consume y no puede contradecir:

- «Lo cosido y lo inventado queda marcado»

De **«El mundo es una función de la semilla y de los datos de OSM»** (`@nucleo @determinismo`, bloqueante), aplicada al trazado con filtro:

- «Cada fase usa su propio sufijo de azar»

Y **«El mundo mínimo todavía compone un lazo»**, que es el caso donde el estirón se dispara con más facilidad.

### Huecos de cobertura detectados

Se anotan aquí porque afectan a lo que `wa-qa-dev` podrá afirmar, y ninguno se resuelve inventando un escenario en esta spec:

1. **No hay fixture con tags de accesibilidad.** Los cuatro de SPEC-001 se capturaron con la consulta vieja, que no los conserva, y un fixture no se regenera. Hace falta uno nuevo —callejero con escaleras, firme de tierra y nodos de bordillo— o los criterios de marcado solo se podrán probar con datos sintéticos, que es peor porque el caso raro de OSM es justo lo que hay que ver.
2. **La batería no tiene escenario para el tope de rodeo.** «El trazado rodea lo que el filtro evita» cubre que se rodea; nada cubre qué pasa cuando el rodeo es absurdo y hay que pasar y declarar. Es la mitad menos obvia de «evita y declara» y merece escenario propio en `docs/testing.md`.
3. **La batería no tiene escenario para «ninguna opción es peor juego»** (RNF-ACC-001). Se puede afirmar comparando el reparto con y sin filtro, y no hay ningún escenario que lo haga.
4. **La batería no tiene escenario para el tercer estado.** «Lo que nos inventamos no se promete como transitable» cubre la suposición, pero no el tramo real sin tags, que es el caso masivo en OSM y donde colapsar a dos estados pasa desapercibido.
5. **El nombre de los tramos difíciles que no son ramales.** RF-MUNDO-014 nombra los ramales a parajes; un tramo de callejero suelto marcado como difícil puede no pertenecer a ninguna calzada nombrada, y entonces no hay con qué declararlo. Aquí se resuelve haciendo fallar la entrega, que es lo honesto, pero la solución de verdad —nombrar todo tramo difícil en la fase de nombrado del mundo— es de SPEC-007 o de una iteración suya.
6. **El umbral de anchura y el tope de rodeo no están en `game-design/`.** Los noventa centímetros y el medio tramo son defaults de esta spec (abajo); si el diseño los quiere otros, se corrigen en `accesibilidad.md` y se itera, no al revés.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y coherencia con SPEC-001.
- **Sin sección de comportamiento responsive** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz.
- **Cuatro criterios y no seis** → asumido `escalones`, `firme`, `bordillos` y `paso` (alternativa: un criterio por tag, con `smoothness` y `width` sueltos). Regla: RF-MUNDO-017 enumera cuatro; `accesibilidad.md` §2 enumera seis **tags**, que son evidencia, no criterios. `smoothness` alimenta `firme` y `width` alimenta `paso`.
- **El cuarto criterio se llama `paso` y no `silla`** → asumido (alternativa: `silla`, que es lo que dice el tag `wheelchair`). Regla: encuadre de `accesibilidad.md` y RNF-ACC-001, esto no es un modo; un criterio llamado «silla» reintroduce por la puerta de atrás el modo aparte que el documento entero niega.
- **`wheelchair=limited` es «no se sabe» y no «no apto»** → asumido (alternativa: tratarlo como no apto, por prudencia). Regla: `accesibilidad.md` §2, «tú sabes de tu barrio más que OSM»; convertir un «con condiciones» en una negativa decide por el jugador, que es justo lo que el documento prohíbe.
- **Umbral de anchura en noventa centímetros** → asumido para marcar `paso` como no apto (alternativa: no usar `width` en absoluto, o un umbral distinto). Regla: `accesibilidad.md` §2 lista `width` entre lo filtrable de verdad, pero no fija número; se declara aquí para que se pueda corregir en un sitio.
- **Bordillo apto por debajo de tres centímetros** → asumido, con `kerb=flush` y `kerb=lowered` como apto y `kerb=raised` como no apto (alternativa: solo `flush`). Regla: el documento no fija altura; tres centímetros es el corte con el que OSM documenta `kerb=lowered`.
- **La ausencia de tag no es aptitud, salvo en escalones** → asumido: `highway` viene siempre y una vía que no es `steps` no tiene escalones, así que ahí la ausencia sí afirma; en firme, bordillos y paso la ausencia es «no se sabe» (alternativa: presumir apto por defecto, que daría mapas mucho más útiles y mucho más mentirosos). Regla: `accesibilidad.md` §2, decir la verdad antes que fingir cobertura.
- **La elección de ruta es lexicográfica y no por penalización con constantes** → asumido: primero menos tramos no aptos, después menos tramos en «no se sabe», después más corta (alternativa: multiplicar el peso de las aristas malas por un factor). Regla: una constante multiplicativa hace que la garantía dependa del número elegido y no se pueda afirmar en un test; el orden lexicográfico sí se afirma.
- **Tope de rodeo de medio tramo del jugador por lazo** → asumido (alternativa: sin tope, o tope en metros absolutos). Regla: `accesibilidad.md` §1, el tramo es la unidad personal y un tope en metros no significa lo mismo para dos personas; sin tope, evitar tres escalones puede costar dos kilómetros, que es peor respuesta para quien el filtro pretende ayudar.
- **Pasado el tope se usa la ruta corta y se declara** → asumido (alternativa: usar el rodeo largo igualmente, o no ofrecer la aventura). Regla: `accesibilidad.md` §2, el juego dice la verdad y no decide por ti.
- **Un tramo difícil sin nombre hace fallar la entrega** → asumido (alternativa: declararlo como «un tramo del camino», sin nombre). Regla: `accesibilidad.md` §2, «los caminos difíciles necesitan nombre, porque hay que poder nombrarlos al declararlos»; una declaración anónima incumple el escenario «El camino evitado se declara con nombre propio» y lo haría en silencio.
- **El motivo se entrega en clave y no redactado** → asumido `escalones | firme | bordillo | paso | suposicion` (alternativa: que el núcleo devuelva la frase ya escrita). Regla: `CLAUDE.md` y el design system, la redacción sale del paquete de idioma del mundo y cambia con el idioma; y el registro del texto lo decide el momento que lo pinta, que es de otra fila.
- **La falta de reparto es un dato y no una acción** → asumido: se entrega la oferta y no se amplía nada hasta que alguien la acepta (alternativa: reintentar solo con el alcance ampliado y avisar después). Regla: RF-QUEST-012 y `bucle-jugable.md` §7, el estirón se ofrece y nunca se impone; ampliar solo es imponer con aviso.
- **La sugerencia del estirón es de un tramo** → asumido (alternativa: calcular cuánto haría falta para que sí haya reparto). Regla: `bucle-jugable.md` §7 dice literalmente «alejarse un tramo más»; calcular el mínimo suficiente obligaría a repartir varias veces antes de preguntar.
- **El marcado de aptitud se calcula al generar la celda y se guarda con el mundo** → asumido (alternativa: calcularlo al trazar cada lazo). Regla: RF-MUNDO-005; si se calcula al trazar, acaba dependiendo del filtro sin que nadie lo note, y el mundo deja de ser función de la semilla y los datos.
- **El filtro no toca `buildRoutes` ni las calzadas dibujadas** → asumido: entra en el trazado del lazo de una salida y en el casting (alternativa: filtrar también el trazado de calzadas del mapa). Regla: `accesibilidad.md` §2, «el mundo entero existe y se dibuja»; filtrar las calzadas haría que dos jugadores vieran mapas distintos del mismo sitio y resembraría el mundo al cambiar un ajuste.
- **El conjunto de criterios se normaliza antes de usarse** → asumido: se ordena para que el orden de llegada no cambie el resultado (alternativa: usarlo tal cual llega). Regla: `CLAUDE.md`, determinismo por encima de todo, y la prohibición de depender del orden de inserción.
- **Los bordillos se piden como nodos y se cruzan con la geometría de las vías** → asumido (alternativa: leer solo `kerb` en ways, que es como está mapeado en una minoría de casos). Regla: en OSM el bordillo vive en el nodo del cruce; pedir solo ways deja el criterio de bordillos permanentemente en «no se sabe», que es cumplir la spec sin servir de nada.
