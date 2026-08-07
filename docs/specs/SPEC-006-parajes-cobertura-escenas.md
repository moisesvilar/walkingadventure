# SPEC-006 — Los parajes y la cobertura de escenas

## Descripción

Los parajes son los hitos no habitados de una celda: la ruina donde acampa el bandido, el cruce donde esperar al anochecer, la atalaya desde la que se ve algo que no encaja. Esta spec decide cuántos hay en cada celda y de qué tipo son, y lo decide en este orden: **primero los tipos que hacen falta para que el mundo cubra las escenas que piden las quests, y solo después qué lugar real les toca debajo**. Esa inversión es la decisión de fondo: la cobertura manda sobre la afinidad del anclaje, porque una atalaya que resulta ser un bar es infinitamente mejor que una celda sin ningún sitio desde el que vigilar.

El cupo tiene dos límites de naturaleza distinta y no intercambiables: un **suelo derivado del catálogo** (escenas distintas que piden las plantillas ÷ escenas que garantiza un paraje), que es aritmética y no gusto, y un **techo por ritmo**, que es lo que cabe en una salida sin que los hitos dejen de ser hitos. Ambos se calculan una vez por celda, en tramos y no en metros, y se congelan con ella.

No tiene interfaz. Nada de lo que decide esta spec sale a pantalla: los parajes se ven en el mapa (SPEC-021) y se juegan al llegar (SPEC-032, SPEC-033), y el déficit de cobertura, cuando lo hay, es dato interno que consume el casting.

Anclas: **RF-MUNDO-007** (cupos por celda: suelo derivado, techo por ritmo) y **RF-MUNDO-008** (ocho tipos y cobertura de escenas), `docs/prd.md` §4.1, con `game-design/parajes.md` como fuente que manda sobre el PRD y sobre esta spec, y `game-design/parametros-mundo.md` para el techo por ritmo.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la hay**: el vocabulario de escenas entra como parámetro, y el porqué está en «La dependencia circular, declarada».
- **Fuera de alcance, porque lo entregan otras filas del checklist y esta spec las consume sin respecificarlas**: el pool de anclajes libres, sus filtros y la regla del reconocimiento (SPEC-005, `pool-anclajes-filtros`); el grafo viario cosido y los ramales con nombre (SPEC-007); el tamaño de la celda y la semilla (SPEC-003); el tramo personal y su medición (SPEC-004); el catálogo de plantillas (SPEC-017); el casting de quests (SPEC-010); y el pintado de los parajes en el mapa (SPEC-021). Si al implementar hace falta un dato de cualquiera de ellas, entra como parámetro, nunca como lógica reimplementada aquí.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «El cupo de la celda» y «La elección de tipos por cobertura»; la validación de entradas, en el vocabulario y la taxonomía que llegan mal formados; el estado vacío, en la celda sin anclajes elegibles, el vocabulario vacío y el grafo sin cruces ni puentes; el estado de error, en el vocabulario sin inyectar y en la escena que ninguna taxonomía cubre; y los casos límite, en el suelo por encima del techo, el barrio de tres calles, el tag masivo y el pool permutado.

### El cupo de la celda: suelo derivado y techo por ritmo

- **Dado** el vocabulario de escenas de paraje que piden los roles del catálogo, **cuando** se calcula el suelo de la celda, **entonces** es el cociente, redondeado hacia arriba, entre el número de escenas distintas del vocabulario y las escenas que se garantiza que cubre un paraje.
- **Dado** un vocabulario al que se añade una escena que ningún paraje ya previsto cubre, **cuando** se recalcula el suelo, **entonces** sube sin tocar el código del generador.
- **Dado** un vocabulario del que se retiran escenas hasta dejarlo por debajo del cociente anterior, **cuando** se recalcula el suelo, **entonces** baja en la misma proporción.
- **Dado** el módulo que calcula el cupo, **cuando** se inspecciona, **entonces** no contiene ninguna cifra de suelo escrita a mano: el suelo siempre sale del vocabulario recibido.
- **Dado** el alcance de la celda expresado en tramos, **cuando** se calcula el techo por ritmo, **entonces** sale de la interpolación de `parametros-mundo.md` reexpresada en tramos, y satura en ocho.
- **Dado** el suelo y el techo de una celda, **cuando** se fija el cupo objetivo, **entonces** es el mayor de los dos.
- **Dado** una celda cuyo techo por ritmo es menor que el suelo derivado, **cuando** se generan los parajes, **entonces** se colocan tantos como pide el suelo y no tantos como pide el techo.
- **Dado** una celda pequeña con anclajes de sobra, **cuando** se generan los parajes, **entonces** su número queda entre el suelo derivado y el cupo objetivo, nunca por encima.
- **Dado** dos jugadoras con tramos personales distintos y celdas del mismo tamaño en tramos, **cuando** se generan sus parajes, **entonces** las dos celdas reciben el mismo cupo aunque midan metros distintos.
- **Dado** una celda ya generada, **cuando** la jugadora cambia de tramo o el juego se lo corrige midiendo, **entonces** el cupo de esa celda no se recalcula y sus parajes no cambian.
- **Dado** una celda, **cuando** se genera, **entonces** el cupo se calcula una sola vez y queda registrado en su ficha junto al suelo y al techo que lo produjeron.

### La elección de tipos por cobertura

- **Dado** un vocabulario de escenas y un cupo, **cuando** se generan los parajes, **entonces** los tipos se eligen antes de mirar ningún anclaje real.
- **Dado** el mismo mundo con el pool de anclajes permutado, **cuando** se generan los parajes, **entonces** la secuencia de tipos elegida es la misma.
- **Dado** un cupo que alcanza para cubrir el vocabulario, **cuando** se generan los parajes, **entonces** toda escena del vocabulario aparece en al menos un paraje colocado.
- **Dado** varios tipos candidatos para el mismo hueco, **cuando** se elige, **entonces** gana el que cubre más escenas todavía pendientes.
- **Dado** dos tipos que cubren exactamente las mismas escenas pendientes, **cuando** se elige, **entonces** el empate lo rompe el azar de la fase y no el orden de la tabla de tipos.
- **Dado** un rol que declara un peso mínimo para su escena, **cuando** se comprueba la cobertura, **entonces** solo cuenta como cubierta por un tipo cuyo peso para esa escena alcanza ese mínimo.
- **Dado** un rol que declara escenas alternativas, **cuando** se construye el vocabulario, **entonces** cada alternativa cuenta como una escena distinta a cubrir.
- **Dado** el vocabulario ya cubierto y huecos libres hasta el cupo, **cuando** se eligen los tipos restantes, **entonces** se reparten buscando diversidad y no se repite ningún tipo mientras queden tipos sin usar.
- **Dado** una escena del vocabulario que ningún tipo de la taxonomía cubre, **cuando** se generan los parajes, **entonces** se registra como hueco de taxonomía en la ficha de la celda y la generación continúa con el resto del vocabulario.
- **Dado** un vocabulario vacío, **cuando** se generan los parajes, **entonces** el suelo es cero y el cupo lo fija el techo por ritmo.

### La asignación de anclaje: sesgo suave y sacrificio

- **Dado** un tipo elegido y anclajes elegibles afines a ese tipo, **cuando** se le asigna anclaje, **entonces** el afín gana peso en el sorteo sin ganarlo siempre.
- **Dado** un tipo elegido y ningún anclaje afín disponible, **cuando** se le asigna anclaje, **entonces** se le asigna el mejor puntuado de los que quedan y el tipo no cambia.
- **Dado** un mundo donde ningún anclaje real tiene afinidad con la vigilancia, **cuando** se generan los parajes, **entonces** existe al menos un paraje con escena de vigilancia y su anclaje real puede ser cualquier cosa, incluido un bar.
- **Dado** dos anclajes reales de la misma clase en la misma celda, **cuando** se generan los parajes, **entonces** pueden salir con tipos distintos.
- **Dado** una celda cuyo pool trae cincuenta anclajes de una misma clase, **cuando** se generan los parajes, **entonces** el reparto de tipos es el mismo que con un pool diverso del mismo tamaño.
- **Dado** el generador de parajes, **cuando** se inspecciona, **entonces** ninguna etiqueta de OSM ni tipo de lugar de Places determina por sí solo el tipo de un paraje.
- **Dado** un anclaje consumido por un paraje, **cuando** se consulta el pool, **entonces** queda marcado como tomado y ninguna otra fase lo vuelve a usar.
- **Dado** un paraje anclado a un lugar real, **cuando** se lee su ficha, **entonces** conserva el nombre y la clase del lugar real, separados del nombre y el tipo fantásticos.

### Cruces y puentes: el colchón que no depende de OSM

- **Dado** una celda sin ningún anclaje elegible y con dos rutas nombradas que se cruzan, **cuando** se generan los parajes, **entonces** hay al menos un paraje de cruce.
- **Dado** un candidato salido del grafo, **cuando** se coloca, **entonces** su tipo viene dado por su origen —cruce o puente— y no pasa por el sorteo de tipos.
- **Dado** que el tipo que más escenas pendientes cubre es cruce o puente y el grafo ofrece candidato, **cuando** se elige el hueco, **entonces** se coloca ahí antes que en un anclaje real.
- **Dado** el fixture del barrio de tres calles, **cuando** se generan los parajes, **entonces** se alcanza el suelo derivado usando cruces y puentes, sacrificando la afinidad del anclaje y nunca la cobertura.
- **Dado** una celda sin anclajes elegibles, sin cruces y sin puentes, **cuando** se generan los parajes, **entonces** la generación no falla: coloca los que puede y declara en la ficha de la celda las escenas que quedaron sin cubrir.
- **Dado** una celda con déficit de cobertura declarado, **cuando** se recorre la app entera, **entonces** ese déficit no aparece en ninguna pantalla.

### Colocación, nombres y ficha del paraje

- **Dado** los candidatos puntuados, **cuando** se ordenan, **entonces** puntúa más alto el que está cerca de una calzada nombrada que el que no lo está.
- **Dado** un anclaje dentro del radio urbano de un núcleo, **cuando** se filtran los elegibles, **entonces** queda descartado.
- **Dado** un anclaje que cae en el mar o fuera de la celda, **cuando** se filtran los elegibles, **entonces** queda descartado.
- **Dado** dos candidatos a menos de la separación mínima, **cuando** se colocan, **entonces** solo se coloca uno de los dos.
- **Dado** un paraje colocado, **cuando** se le pone nombre, **entonces** sale del paquete de idioma del mundo y no choca con ningún otro nombre del índice global.
- **Dado** un paraje colocado, **cuando** se lee su ficha, **entonces** trae tipo, etiqueta visible, escenas con sus pesos, posición, origen —anclaje o grafo— y el anclaje real si lo tiene.
- **Dado** los pesos de escena de un tipo, **cuando** se comparan con `game-design/parajes.md`, **entonces** coinciden exactamente para los ocho tipos.

### Determinismo y frontera

- **Dado** la misma semilla y los mismos datos de OSM, **cuando** se generan los parajes dos veces, **entonces** salen idénticos.
- **Dado** el generador de parajes, **cuando** se inspecciona su azar, **entonces** usa un rng propio con el sufijo de fase de los parajes y ninguna otra fuente.
- **Dado** el mismo fixture servido con el orden de llegada invertido, **cuando** se generan los parajes, **entonces** el resultado es el mismo.
- **Dado** el generador sin vocabulario de escenas inyectado, **cuando** se le pide generar, **entonces** falla con un error que nombra la dependencia que falta, en lugar de asumir un suelo.
- **Dado** el generador de parajes, **cuando** se inspecciona, **entonces** no usa `Math.random`, ni el reloj del sistema, ni ninguna iteración cuyo orden dependa del orden de inserción.

## Notas técnicas

### La dependencia circular, declarada

El suelo del cupo sale del catálogo de plantillas, y el catálogo es la fila 17 del checklist (`catalogo-plantillas`), que todavía no existe. Es circular solo en apariencia, y la salida es no depender del catálogo sino de lo que el catálogo declara:

- El generador **recibe el vocabulario de escenas de paraje como parámetro**: el conjunto de escenas que piden los roles de tipo paraje, con su peso mínimo si lo declaran. No importa `quests/templates.js` ni ningún módulo del catálogo.
- Con eso, el suelo es una **función pura del vocabulario y de la taxonomía**, y sube solo cuando el catálogo se ensancha, que es exactamente la regla viva que pide `parajes.md`.
- **Valor de arranque**, derivado de las seis plantillas de `app/js/quests/templates.js` para que la celda sea jugable antes de que exista la fila 17: los roles de tipo paraje piden siete escenas distintas —guarida, encuentro, misterio, vigilancia, revelación, emboscada y ritual—, y con dos escenas garantizadas por paraje el suelo es cuatro. Es el mismo cuatro que ya está escrito en `parajes.md`, y por eso los criterios de aceptación afirman la relación y no la cifra: si mañana el catálogo pide once escenas, el suelo pasa a seis sin que nadie edite nada.

Esta es la **frontera de inyección nueva** que anuncia el tercer bullet del alcance. Quien orquesta la tubería (`build.js` portado, SPEC-002) es quien pasa el vocabulario; mientras la fila 17 no exista, lo construye leyendo las plantillas del prototipo.

### Qué se porta y qué se refina de `app/js/world/parajes.js`

Destino: `packages/nucleo/world/parajes.js`. Se porta tal cual la parte que ya está bien y se refina la que contradice el desempate del 5 de agosto:

| Pieza | Qué pasa con ella |
| --- | --- |
| `PARAJE_INFO` (ocho tipos con pesos) y `ANCHORED_TYPES` | se portan sin tocar un peso |
| `crossingCandidates` y `bridgeCandidates` | se portan; siguen saliendo del grafo, sin Overpass |
| Puntuación cerca-de-ruta, exclusión de mar, de fuera de mundo y del radio urbano, separación mínima | se portan |
| `parajeCountForRadius` con sus tramos en metros | **se refina**: el cupo pasa a calcularse en tramos, con suelo derivado y techo por ritmo, una vez por celda |
| El orden anclaje → tipo del bucle actual | **se invierte**: tipos por cobertura primero, anclaje después |
| `graphFloor = min(2, ...)`, la reserva fija de dos huecos para el grafo | **desaparece**: cruces y puentes entran cuando la cobertura o la escasez los piden, no por cuota |
| `BIAS` y `BIAS_P` | se portan como sesgo del sorteo de anclaje, no del de tipo, y siguen sin ser una regla dura |

El módulo del prototipo se queda donde está: la app vieja sigue funcionando hasta que se retire, y esta spec no la toca.

### Por qué el techo se reexpresa en tramos

`parametros-mundo.md` da el techo en metros de radio (250 → 1, 500 → 2, 1000 → 4, 2000 → 7, saturando en 8) porque se calibró antes de que el tramo fuera personal. La tabla no cambia de forma: cambia de unidad. El tramo con el que está calibrada es el de referencia de `accesibilidad.md` —los 2 km que el tramo dejó de ser—, así que los mismos escalones expresados en tramos de alcance de celda son 0,125 → 1, 0,25 → 2, 0,5 → 4, 1 → 7, y saturación en 8. Quien anda 300 m por tramo recibe el mismo techo en una celda mucho más pequeña en metros, que es la regla de `accesibilidad.md` aplicada al cupo.

El tamaño de la celda en tramos lo fija SPEC-003 y sigue siendo un pendiente declarado del PRD (§7.1). Esta spec no lo decide: recibe el alcance de la celda ya expresado en tramos y lo usa.

### El déficit de cobertura es dato interno

Cuando una celda no llega a cubrir el vocabulario —barrio sin anclajes, sin cruces y sin puentes—, la ficha de la celda registra qué escenas quedaron sin cubrir. Ese dato lo consume el casting (SPEC-010) para no ofrecer plantillas imposibles, y **no sale a pantalla en ningún sitio**: el design system prohíbe cualquier panel del estado del mundo, y una celda pobre se nota jugando, no leyendo un informe.

### Escenarios de la batería que verifican esta spec

Ninguno se implementa aquí —son de `wa-qa-dev`—, pero esta spec está escrita para que se puedan escribir sin añadirle nada. De `docs/testing.md`, característica «El mundo de una celda es jugable por construcción»: «El suelo de parajes cubre el vocabulario de escenas», «El cupo por ritmo es un techo, no un objetivo», «La cobertura de escenas manda sobre la afinidad del anclaje», «Un tag masivo no monopoliza un tipo de paraje» y «El mundo mínimo todavía compone un lazo». De «Los anclajes reales son de uso único»: «Ningún anclaje aparece dos veces» y «Los parajes reparten lo que los núcleos no gastaron». De «Los nombres son únicos y del idioma del sitio»: «No hay dos nombres iguales en un mundo». De «El mundo es una función de la semilla y de los datos de OSM»: «Dos generaciones con la misma semilla dan el mismo mundo», «Cada fase usa su propio sufijo de azar», «No se usa ninguna fuente de azar ni de tiempo del sistema» y «El orden de iteración no depende del orden de inserción». De «Lo generado no se resiembra jamás»: «Cambiar el tramo del jugador no redimensiona un mundo ya generado».

**Huecos de cobertura detectados**, que son de la batería y no de esta spec: no hay ningún escenario que verifique el sacrificio del anclaje cuando el tipo elegido no tiene afín —«La cobertura de escenas manda sobre la afinidad del anclaje» afirma el resultado pero no el orden—, ni el déficit declarado cuando la celda no llega al suelo ni con cruces ni con puentes, ni que el reparto de tipos sea independiente del histograma del pool (el escenario del tag masivo verifica el filtro del pool, que es de SPEC-005, no el reparto). Los tres se marcan como hueco al registrar el mapa de cobertura.

### Los fixtures que hacen falta

Los cuatro de SPEC-001 sirven sin ampliarlos: `barrio-tres-calles` y `suelo-250m` son las celdas pobres donde el suelo y el colchón del grafo se rompen; `urbano-denso` trae las cincuenta fuentes de agua potable declaradas en su inventario y sirve para el tag masivo; `costero` sirve para la exclusión de mar.

## Decisiones asumidas

- **Escenas garantizadas por paraje** → asumido **dos**, que es el divisor con el que `parajes.md` calcula su suelo de cuatro (alternativa: tres, que es el mínimo real de la tabla de tipos y daría suelo tres). Regla: la taxonomía garantiza dos porque nada asegura que el tipo colocado sea el de más escenas, y el documento de diseño manda sobre la aritmética optimista.
- **Las escenas alternativas de un rol cuentan como escenas distintas del vocabulario** → asumido (alternativa: contar el grupo como una sola escena a cubrir). Regla: es como `parajes.md` llega a siete escenas contando por separado vigilancia y revelación del rol `alto`. Es la lectura conservadora: cubrir de más nunca deja una quest sin castear.
- **La cobertura se mide sobre el vocabulario del catálogo entero, no filtrado por oficio** → asumido (alternativa: cubrir solo lo que pide el oficio de la jugadora). Regla: `personaje.md` §3 dice que el oficio filtra el catálogo, pero la celda se genera una vez y se congela, así que dimensionarla por el oficio actual la dejaría coja al cambiar de aventura.
- **El cupo objetivo es el mayor entre suelo y techo** → asumido (alternativa: recortar el suelo al techo en celdas pequeñas). Regla: `parajes.md`, «el cupo por ritmo sigue mandando como techo; esto solo pone un suelo por debajo del cual el mundo no es jugable» — un techo que se come el suelo devuelve el problema que el suelo vino a resolver.
- **El tramo de referencia para reexpresar el techo es de 2 km** → asumido (alternativa: recalibrar la tabla midiendo sobre mundos reales). Regla: `accesibilidad.md` §1 dice que el tramo «deja de ser 2 km», así que 2 km es exactamente la constante con la que se calibró `parametros-mundo.md`; recalibrar es trabajo de SPEC-003 cuando se mida el tamaño de celda.
- **El déficit de cobertura se declara y la generación continúa** → asumido (alternativa: fallar al generar la celda). Regla: el barrio de tres calles es un caso previsto del diseño, no un error; una celda pobre se juega peor, no se deja de jugar.
- **El generador falla si no recibe vocabulario** → asumido (alternativa: asumir el suelo de arranque por defecto). Regla: precedente de SPEC-001 con el reloj de mundo sin motor; un default silencioso convierte un olvido de cableado en un mundo mal dimensionado que nadie detecta.
- **El sesgo suave se aplica al sorteo de anclaje y no al de tipo** → asumido (alternativa: mantenerlo en el sorteo de tipo con menos peso). Regla: si el sesgo sigue tocando el tipo, el volumen del pool vuelve a decidir el reparto y se reabre justo el problema de `amenity=drinking_water`.
- **La probabilidad del sesgo se mantiene en el valor del prototipo** → asumido, con la afinidad ganando peso sin ganar siempre (alternativa: recalibrarla midiendo). Regla: `parajes.md` pide «sorpresa casi siempre, y de vez en cuando el guiño»; el valor actual ya produce eso y cambiarlo sin medir es ruido.
- **Cruces y puentes participan en la cobertura en igualdad de condiciones** → asumido (alternativa: usarlos solo como relleno cuando faltan anclajes, como hoy). Regla: sus escenas —peaje, duelo, vigilancia— no las cubre ningún otro tipo con ese peso, y reservarlos a relleno dejaría esas escenas sin cubrir en celdas ricas en anclajes.
- **La ficha de la celda registra suelo, techo, cupo y déficit** → asumido (alternativa: devolver solo la lista de parajes). Regla: sin esos tres números, ni el casting puede decidir qué ofrecer ni una prueba puede afirmar que el cupo se calculó una sola vez.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep.
- **Sin sección de comportamiento responsive ni bloque de UX Design** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz: no dibuja ninguna pantalla de `docs/pantallas/` y no define ningún `data-testid`.
