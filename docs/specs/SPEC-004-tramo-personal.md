# SPEC-004 — El tramo personal

## Descripción

El tramo es lo que cada jugadora anda en media hora, y es la unidad de la que cuelga el tamaño de todo lo demás: la celda, los cupos de la celda, hasta dónde manda una salida y cada cuánto avanza el mundo. Se declara una vez en el arranque eligiendo un sitio al que se llega, no un número de kilómetros, y a partir de ahí el juego lo corrige solo midiendo el ritmo al que se anda — sin las paradas, sin el vehículo, sin la velocidad ambigua — y **sin comentarlo nunca**.

Esta spec entrega el dato, la medición, la corrección y las dos perillas que hasta ahora compartían nombre: la que dimensiona **lo que existe** (la celda y sus cupos, congelados al generarse) y la que dimensiona **hasta dónde te mandan** (el tamaño de la salida, en tramos). Cambiar el tramo mueve la segunda y nunca la primera: un mundo ya generado no se redimensiona jamás.

No tiene interfaz propia. La pantalla donde se pregunta (`A1P2`, «Tu tramo») la implementa la fila 27 del checklist, `onboarding-arranque`, y el tramo **no aparece en ajustes** como una perilla numérica: lo que se cambia allí es la misma respuesta de sitios.

Anclas: **RF-PJ-004** (`docs/prd.md` §4.8), **RF-MUNDO-007** (§4.1), **RNF-ACC-001** y **RNF-ACC-003** (§5.4), con `game-design/accesibilidad.md` §1, §2 y §4 como fuente — manda sobre el PRD —, `game-design/parametros-mundo.md` y `game-design/parajes.md` para los cupos, y `game-design/bucle-jugable.md` §9 para qué se hace cuando la detección duda.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la toca**: la medición recibe de fuera la traza ya clasificada, y el detalle está en «Frontera de inyección».
- **Fuera de alcance, y son cuatro cosas que parecerían naturales aquí:** la pantalla `A1P2` y su redacción (fila 27, `onboarding-arranque`); la detección de vehículo, que esta spec **consume ya resuelta** y no implementa (fila 31, `deteccion-vehiculo`); el motor de pasos que convierte tramos andados en pasos del mundo (fila 11, `motor-pasos`); y la generación de parajes que honra los cupos que aquí se calculan (fila 6, `parajes-cobertura-escenas`). Esta spec entrega **los números y la unidad**, no quien los gasta.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «El tramo declarado», «La corrección del tramo» y «Los cupos de la celda»; la validación de entradas, en las opciones fuera de catálogo, los tamaños de salida desconocidos y las trazas mal formadas; el estado vacío, en la salida sin un solo metro andando, la partida recién creada sin ninguna salida completada y el catálogo de plantillas vacío; el estado de error, en el tramo ausente al dimensionar, la traza sin clasificar y el cupo pedido sobre una celda que no declara su tamaño; y los casos límite, en el suelo de los 250 m, el techo, la salida entera en autobús, la parada de veinte minutos y el cambio de tramo con un mundo ya en disco.

### El tramo declarado

- **Dado** el catálogo de respuestas del arranque, **cuando** se enumera, **entonces** son cuatro y cada una está expresada como un sitio al que se llega, sin ninguna cifra de distancia ni de tiempo.
- **Dado** cada una de las cuatro respuestas, **cuando** se traduce a tramo, **entonces** devuelve un número de metros por media hora, y las cuatro están ordenadas de menor a mayor sin empates.
- **Dado** la respuesta más corta del catálogo, **cuando** se traduce a tramo, **entonces** su valor es mayor o igual que el suelo declarado.
- **Dado** una respuesta que no está en el catálogo, **cuando** se traduce a tramo, **entonces** falla con un error que nombra lo recibido y enumera las cuatro válidas.
- **Dado** una partida recién creada sin respuesta declarada, **cuando** se pide el tramo, **entonces** falla nombrando el dato que falta, en lugar de devolver un valor por defecto.
- **Dado** el tramo de una partida, **cuando** se serializa la partida, **entonces** viaja con el personaje y no con el mundo.
- **Dado** dos partidas con la misma semilla de mundo y tramos distintos, **cuando** se comparan sus mundos generados con el mismo tamaño de celda en metros, **entonces** los mundos son idénticos byte a byte.

### La medición del ritmo

- **Dado** una traza de una salida con sus segmentos clasificados, **cuando** se mide el ritmo, **entonces** solo entran en la media los segmentos clasificados como andando.
- **Dado** una salida con veinte minutos parados en medio y el mismo ritmo antes y después, **cuando** se mide el ritmo, **entonces** el resultado es el mismo que el de la salida sin la parada.
- **Dado** un segmento cuya velocidad está por debajo del umbral de andar, **cuando** se mide el ritmo, **entonces** se trata como parada y no entra en la media, aunque llegue clasificado como andando.
- **Dado** una traza con un tramo a velocidad de vehículo, **cuando** se mide el ritmo, **entonces** esos metros no entran en la media.
- **Dado** una traza con 800 m a velocidad ambigua, **cuando** se mide el ritmo, **entonces** esos 800 m no entran en la media.
- **Dado** los mismos 800 m ambiguos, **cuando** se pregunta al núcleo si cuentan para el motor de pasos y para validar geofences, **entonces** la respuesta es que sí, y es la contraria a la de la medición.
- **Dado** una salida entera en autobús, **cuando** se mide el ritmo, **entonces** la salida no aporta ninguna medida y no se registra como salida medida.
- **Dado** una traza sin ningún segmento, **cuando** se mide el ritmo, **entonces** devuelve que no hay medida, no un cero.
- **Dado** una traza con un segmento sin clasificar, **cuando** se mide el ritmo, **entonces** falla nombrando el segmento en lugar de suponer que se andaba.
- **Dado** una traza con marcas de tiempo desordenadas o con una duración negativa, **cuando** se mide el ritmo, **entonces** falla con un error explícito.
- **Dado** una salida cuyos metros andando quedan por debajo del mínimo útil, **cuando** se mide el ritmo, **entonces** la salida no aporta medida.
- **Dado** la misma traza, **cuando** se mide dos veces, **entonces** las dos medidas son idénticas y ninguna lee el reloj del sistema.

### La corrección del tramo, en silencio

- **Dado** un tramo declarado de 2 km y una salida medida en 1,2 km por media hora, **cuando** se incorpora la medida, **entonces** el tramo estimado baja y queda entre los dos valores, nunca fuera.
- **Dado** un tramo declarado de 2 km, **cuando** se completan cinco salidas medidas en 1,2 km por media hora, **entonces** el tramo estimado queda a menos de un 10 % de 1,2 km.
- **Dado** una partida sin ninguna salida medida, **cuando** se pide el tramo estimado, **entonces** devuelve exactamente el declarado.
- **Dado** una serie de medidas, **cuando** se incorporan en el mismo orden dos veces, **entonces** el tramo estimado resultante es idéntico.
- **Dado** una medida por debajo del suelo, **cuando** se incorpora, **entonces** el tramo estimado se queda en el suelo y no baja de ahí.
- **Dado** una medida por encima del techo, **cuando** se incorpora, **entonces** el tramo estimado se queda en el techo.
- **Dado** una jugadora cuyo tramo acaba de bajar, **cuando** se recorren todos los textos que el núcleo puede producir, **entonces** ninguno menciona el tramo, ni su cambio, ni cuánto se ha andado.
- **Dado** el módulo del tramo, **cuando** se inspecciona su superficie pública, **entonces** no exporta ningún texto destinado a mostrarse dentro del juego.
- **Dado** el tramo estimado, **cuando** se busca dónde se expone, **entonces** ninguna consulta del núcleo devuelve su valor en metros a una capa de presentación.

### El suelo de moverse

- **Dado** el paquete, **cuando** se lee el suelo, **entonces** es una constante única de la que salen tanto el mínimo del tramo como el mínimo de la celda, y no hay dos números distintos que digan lo mismo.
- **Dado** la declaración del suelo que consume la ficha de la tienda, **cuando** se lee, **entonces** dice el límite concreto y dice que por debajo de ahí no hay juego que montar.
- **Dado** la misma declaración, **cuando** se lee, **entonces** no promete nada sobre las cuestas.
- **Dado** cualquier texto que el núcleo produce para mostrarse dentro del juego, **cuando** se busca la declaración del suelo, **entonces** no aparece en ninguno: se dice antes de instalar y no dentro.
- **Dado** cualquier texto que el núcleo produce para mostrarse dentro del juego, **cuando** se busca la palabra «accesibilidad», **entonces** no aparece.
- **Dado** un tramo en el suelo, **cuando** se dimensiona una celda y se calculan sus cupos, **entonces** salen el mínimo absoluto de núcleos y el suelo de parajes, y la celda sigue siendo jugable.
- **Dado** un tramo en el suelo, **cuando** se dimensiona una salida de cualquier tamaño, **entonces** la salida se dimensiona igual que para cualquier otro tramo, con el mismo número de beats.

### Las dos perillas: el tramo y el tamaño de la salida

- **Dado** los tamaños de salida, **cuando** se enumeran, **entonces** son tres, cada uno con una palabra del mundo y su medida en tramos, y ninguno lleva metros.
- **Dado** un tamaño de salida y un tramo, **cuando** se dimensiona la salida, **entonces** devuelve el número de tramos, el número de beats y los metros que le corresponden a ese tramo.
- **Dado** dos jugadoras con tramos de 2 km y de 600 m, **cuando** cada una pide una salida de tamaño «paseo», **entonces** las dos salidas tienen el mismo número de beats.
- **Dado** las mismas dos salidas, **cuando** se comparan sus metros, **entonces** la de 600 m mide aproximadamente la tercera parte de la otra.
- **Dado** una salida dimensionada, **cuando** se mira la separación entre dos beats consecutivos, **entonces** ninguna supera media hora al ritmo de esa jugadora.
- **Dado** un tamaño de salida que no está en el catálogo, **cuando** se dimensiona, **entonces** falla enumerando los tres válidos.
- **Dado** el dimensionado de una salida, **cuando** se le pasa un tramo ausente o no numérico, **entonces** falla nombrando el dato que falta.
- **Dado** el paquete entero, **cuando** se busca una función que reciba a la vez el tamaño de la celda y el tamaño de la salida como si fueran lo mismo, **entonces** no existe: son dos entradas distintas con dos nombres distintos.

### Los cupos de la celda, calculados una vez

- **Dado** una celda con su tamaño declarado en tramos, **cuando** se calculan sus cupos, **entonces** el cálculo depende del tamaño en tramos y nunca de un radio en metros absolutos.
- **Dado** el catálogo de plantillas, **cuando** se cuentan las escenas distintas que piden sus roles y se dividen entre las escenas que lleva un paraje, **entonces** el suelo de parajes de cualquier celda es mayor o igual que ese cociente, redondeado hacia arriba.
- **Dado** un catálogo de plantillas que se ensancha con escenas nuevas, **cuando** se recalculan los cupos de una celda nueva, **entonces** el suelo de parajes sube solo, sin tocar ninguna constante.
- **Dado** una celda pequeña con anclajes de sobra, **cuando** se calculan sus cupos, **entonces** el cupo de parajes queda entre el suelo derivado y el techo por ritmo, ambos incluidos.
- **Dado** una celda cuyo techo por ritmo queda por debajo del suelo derivado, **cuando** se calculan sus cupos, **entonces** manda el suelo.
- **Dado** una celda grande, **cuando** se calculan sus cupos de parajes, **entonces** el techo satura y no crece indefinidamente con el tamaño.
- **Dado** una celda dimensionada con el tramo de referencia, **cuando** se calculan sus cupos de núcleos, **entonces** coinciden con los que da hoy la tabla del prototipo para el radio equivalente.
- **Dado** los mismos parámetros de celda, **cuando** se calculan los cupos dos veces, **entonces** los dos resultados son idénticos y el cálculo no consume azar.
- **Dado** una celda ya generada, **cuando** se lee su registro, **entonces** sus cupos están guardados en él y no se vuelven a calcular al leerlos.
- **Dado** un catálogo de plantillas vacío, **cuando** se calculan los cupos, **entonces** falla nombrando el catálogo en lugar de devolver un suelo de cero.
- **Dado** una celda sin tamaño declarado, **cuando** se piden sus cupos, **entonces** falla nombrando el dato que falta.

### El tramo no redimensiona lo que ya existe

- **Dado** un mundo generado con un tramo declarado de 2 km, **cuando** la jugadora cambia su tramo a 600 m, **entonces** el mundo sigue idéntico byte a byte.
- **Dado** el mismo cambio, **cuando** se leen los cupos de la celda ya generada, **entonces** son los que se congelaron al generarla.
- **Dado** el mismo cambio, **cuando** se dimensionan las salidas que se ofrecen, **entonces** mandan a sitios más cercanos que antes del cambio.
- **Dado** el mismo cambio, **cuando** se genera una celda nueva, **entonces** la celda nueva se dimensiona con el tramo nuevo, y la vieja sigue con el suyo.
- **Dado** una partida con celdas dimensionadas con tramos distintos, **cuando** se serializa y se vuelve a cargar, **entonces** cada celda conserva el tamaño y los cupos con los que se generó.
- **Dado** el módulo de cupos, **cuando** se inspecciona quién lo llama, **entonces** solo se invoca al crear una celda, nunca al abrir una partida, al cambiar el tramo ni al pintar.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/tramo.js` | catálogo de las cuatro respuestas, traducción a metros, suelo, techo, tramo declarado y estimado de una partida |
| `packages/nucleo/partida/ritmo.js` | medición del ritmo de una salida a partir de la traza clasificada, y la incorporación de esa medida al tramo estimado |
| `packages/nucleo/partida/salida.js` | los tres tamaños de salida en tramos, con sus beats, y el dimensionado a metros contra un tramo concreto |
| `packages/nucleo/world/cupos.js` | cupos de una celda —núcleos, servicios y parajes— a partir del tamaño en tramos y del catálogo de plantillas |

`app/js/world/settlements.js` y `app/js/world/parajes.js` son del prototipo y esta spec no los toca: `countsForRadius` y `parajeCountForRadius` se portan reexpresados, no se editan en su sitio.

### Frontera de inyección

Esta spec **sí** toca la frontera del núcleo, por un lado y solo por ese: la medición del ritmo recibe la traza de una salida **ya clasificada segmento a segmento** en andando, parada, vehículo o ambigua. El núcleo no mira sensores, no decide qué es un vehículo y no tiene reloj: recibe una lista de segmentos con metros, duración y clasificación, y devuelve un número. Quien clasifica es la fila 31 (`deteccion-vehiculo`); mientras no exista, la entrada la produce el GPS simulado de SPEC-001, que ya sabe marcar posiciones como de vehículo y como ambiguas.

La asimetría de `bucle-jugable.md` §9 se implementa **aquí y en un solo sitio**, porque es donde se rompe si se dispersa: el núcleo expone qué se hace con la duda para cada uno de los tres efectos, y son distintos. Medir el tramo **excluye** lo ambiguo; contar kilómetros y validar geofences **cuentan y validan** en la duda. Los dos consumidores de esa regla —el motor de pasos (fila 11) y las llegadas por geofence (fila 32)— la leen de este módulo en lugar de reimplementarla.

### Los cupos, reexpresados en tramos

`accesibilidad.md`, «Lo que esto obliga a hacer», pide reexpresar los cupos de `parametros-mundo.md` en tramos y no en metros, porque un cupo calibrado en metros absolutos deja de significar lo mismo para dos personas distintas. La conversión se hace con **2 000 m como tramo de referencia**, que es el tramo con el que se calibraron las tablas de hoy, de modo que los números actuales se conservan exactamente para quien anda 2 km en media hora y escalan solos para quien anda 300 m.

Los anclajes de parajes quedan así, con el tamaño de celda medido en tramos:

| Radio de celda (tramos) | Techo por ritmo |
| --- | --- |
| 0,125 | 1 |
| 0,25 | 2 |
| 0,5 | 4 |
| 1 | 6 |
| ≥ 2 | 8 (satura) |

Y el suelo no está en esta tabla porque no se elige: sale de contar el catálogo. Techo por ritmo, suelo por aritmética, y cuando chocan gana el suelo (`parajes.md`, «El suelo del cupo se deriva, no se intuye»).

### La perilla que se parte en dos

Hasta ahora `PRESETS` del prototipo mezclaba dos cosas con un solo nombre: el radio con el que se genera el mundo y el tamaño de la aventura que se ofrece. `accesibilidad.md` §1 lo convierte en requisito, no en limpieza pendiente. Quedan separadas así:

- **El tramo** dimensiona **lo que existe**: el tamaño de la celda y sus cupos. Se congela al generar cada celda.
- **El tamaño de la salida** —paseo, aventura, jornada— dimensiona **hasta dónde te mandan**: se declara en tramos y se traduce a metros con el tramo de quien juega, cada vez que se ofrece una salida.

Cuántos tramos mide una celda (la `k` de `alcance-del-mundo.md`) **no lo fija esta spec**: es el pendiente 1 de §7 del PRD y lo resuelve la fila 3, `rejilla-celdas-semilla`, midiendo sobre mundos reales. Aquí se consume el tamaño de celda ya decidido y se le calculan los cupos.

### Escenarios de la batería que respaldan esta spec

Ninguno se implementa aquí —son de `wa-qa-dev`—, pero los criterios de arriba están escritos para que se puedan cubrir sin inventarse casos nuevos. Por nombre literal:

- De **«El tramo es una unidad personal y se corrige midiendo»** (`@nucleo @accesibilidad`): «Dos jugadores con tramos distintos reciben aventuras del mismo tamaño en pasos», «El tramo se ajusta con lo andado», «El ajuste no se comenta nunca», «Las paradas no cuentan para medir el ritmo».
- De **«Lo generado no se resiembra jamás»** (`@nucleo @determinismo`): «Cambiar el tramo del jugador no redimensiona un mundo ya generado».
- De **«El mundo de una celda es jugable por construcción»** (`@nucleo @casting`): «El suelo de parajes cubre el vocabulario de escenas», «El cupo por ritmo es un techo, no un objetivo», «El mundo mínimo todavía compone un lazo».
- De **«El vehículo se aparta del reloj del mundo y de la validación»** (`@app @accesibilidad`): «La medición del tramo sí excluye la velocidad ambigua» y «En la duda, cuenta», que son las dos caras de la asimetría y por eso se citan juntas. La parte de esos dos escenarios que esta spec puede afirmar es `@nucleo`: dada una traza clasificada, qué entra en la media y qué cuenta.
- De **«El mundo avanza con los kilómetros del jugador, no con el calendario»** (`@nucleo @rumores`): «Un tramo andado es un paso del mundo», que consume el tramo de aquí aunque el motor sea de la fila 11.
- De **«No hay niveles, hay rango social por núcleo»**: «Avanza igual quien anda 6 km y quien anda 900 m», que es la comprobación de que ninguna opción es peor juego.
- Adyacente, de **«El filtro sobre el grafo evita y declara, nunca borra»**: «El camino evitado se declara con nombre propio», que contiene la única aserción escrita de que la palabra «accesibilidad» no aparece en ningún texto. Esta spec la sostiene por su lado, sobre los textos del núcleo.

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería, no de esta spec, y `wa-qa-dev` los cubrirá con casos sin escenario de respaldo (marcados como hueco en el mapa):

- **RNF-ACC-001 no tiene característica propia.** La afirmación «la palabra accesibilidad no aparece en la interfaz» solo existe dentro de un escenario del filtro del grafo, que es de otra spec y de otro momento del juego.
- **RNF-ACC-003 no tiene escenario.** Que el suelo se declare antes de instalar no es automatizable como está —vive en la ficha de la tienda— y lo más cerca que se puede llegar es afirmar que la declaración existe en el paquete y que no aparece en ningún texto de dentro. Debería añadirse a la lista de `@manual`.
- **Nada verifica que las dos perillas estén separadas.** Es el requisito más caro de esta spec y no hay ni un escenario que lo afirme.
- **Nada verifica que los cupos se congelen al generar.** «Cambiar el tramo del jugador no redimensiona un mundo ya generado» comprueba el mundo byte a byte, que es la consecuencia, pero no que los cupos guardados no se recalculen.
- **El catálogo de las cuatro respuestas no tiene escenario**: ni su número, ni el orden, ni que ninguna esté por debajo del suelo.
- **«El tramo se ajusta con lo andado» no fija la velocidad de convergencia.** Dice «baja hacia 1,2 km» sin decir en cuánto, así que el caso tiene que tomar el número de esta spec.
- **Nada verifica el suelo ni el techo de la estimación**, que es justo donde una media móvil se va de madre.

## Decisiones asumidas

- **Las cuatro respuestas y sus metros por media hora** → asumido «A la vuelta de la esquina» 300 m, «A un par de manzanas» 700 m, «Al otro barrio» 1 200 m, «Al pueblo de al lado» 2 000 m, con la tercera preseleccionada (alternativa: tres opciones, o cinco). Regla: son las cuatro literales de la pantalla `A1P2` de `docs/pantallas/pantallas-1-arranque.html`, con la tercera ya marcada en la maqueta; los metros se calzan a los presets de `parametros-mundo.md` (paseo 0,7 km, aventura 1,2 km, jornada 1,9 km) para no inventar una escala paralela.
- **El tramo es media hora por definición** → asumido que el tramo se guarda como metros por media hora y que la media hora nunca se parametriza (alternativa: guardar una velocidad en m/s). Regla: `accesibilidad.md` §1 define el tramo como «lo que tú andas en media hora» y `quests.md` decisión 4 lo ata a un paso del mundo; una velocidad suelta invitaría a enseñar ritmo, que es lo que el diseño prohíbe.
- **Suelo del tramo: 250 m** → asumido el mismo número que el suelo de radio de `accesibilidad.md` §4, como constante única (alternativa: dos constantes, una de tramo y otra de radio de celda). Regla: `accesibilidad.md` §4 mide el límite sobre el radio, y con la celda dimensionada en tramos dos constantes distintas se desincronizarían a la primera.
- **Techo del tramo: 4 000 m** → asumido (alternativa: sin techo). Regla: 8 km/h sostenidos ya no es andar, y sin techo una traza mal clasificada dispara el mundo entero de un tirón.
- **La corrección es una media móvil exponencial con α = 0,4 sobre el declarado** → asumido, y con eso cinco salidas a 1,2 km desde 2 km dejan la estimación en ~1,26 km (alternativa: media de las últimas N salidas). Regla: `docs/testing.md`, «El tramo se ajusta con lo andado», pide que baje *hacia* el valor medido y no que salte a él; una exponencial converge sin que una salida rara mande.
- **Mínimo útil por salida: 400 m andando** → asumido, por debajo de eso la salida no aporta medida (alternativa: contar cualquier salida). Regla: `accesibilidad.md` §1, «mide el ritmo andando, no el reloj de la salida»; una salida de cien metros mide ruido.
- **Umbral de parada: por debajo de 0,5 m/s** → asumido, y se aplica **además** de la clasificación que llega de fuera (alternativa: fiarse solo del clasificador). Regla: la parada del café es la que nombra el escenario «Las paradas no cuentan para medir el ritmo», y el detector de la fila 31 distingue vehículo, no descanso.
- **Los tamaños de salida, en tramos y beats** → asumido paseo 2 tramos / 4 beats, aventura 4 / 8, jornada 6 / 12 (alternativa: dejar los beats al casting). Regla: `parametros-mundo.md` §1 y §3 —paseo ~1 h, aventura ~2 h, jornada ~3 h, un beat cada 10-15 min— y el escenario «Dos jugadores con tramos distintos reciben aventuras del mismo tamaño en pasos», que exige que el número de beats sea el mismo para todo el mundo.
- **Tramo de referencia para reexpresar los cupos: 2 000 m** → asumido (alternativa: recalibrar las tablas desde cero). Regla: es el tramo con el que `parametros-mundo.md` calibró los cupos de hoy; con cualquier otro, los números actuales dejarían de salir y habría que rejustificar decisiones cerradas.
- **El suelo de parajes se cuenta del catálogo en tiempo de generación** → asumido, en lugar de la constante 4 que da el catálogo de hoy (alternativa: fijar 4). Regla: `parajes.md`, «es una regla viva: si el catálogo crece, el suelo sube solo».
- **La declaración del suelo vive en el paquete como dato** → asumido `packages/nucleo/partida/tramo.js` exportando el texto que la ficha de la tienda consume (alternativa: solo en `docs/`). Regla: si el texto no está donde está la constante, el día que cambie el número la ficha seguirá diciendo el viejo, y es justo el dato que `accesibilidad.md` §4 pide decir claro.
- **Cambiar el tramo dimensiona las celdas futuras** → asumido (alternativa: congelar el tramo de la partida entera al crearla). Regla: `bucle-jugable.md` §5 y `alcance-del-mundo.md` §2 dicen que lo generado no se resiembra, no que no se pueda generar distinto; y `accesibilidad.md` §1 dice que el tramo afecta a hasta dónde te mandan, lo que en una celda nueva incluye su tamaño.
- **El núcleo no expone el tramo en metros a la presentación** → asumido, la consulta pública devuelve tamaños de salida y cupos, nunca el número (alternativa: exponerlo y confiar en que nadie lo pinte). Regla: design system, «ninguna cifra de distancia, tiempo, ritmo, pasos»; lo que no sale del núcleo no se puede pintar por descuido.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep.
- **Sin `## UX Design` y sin comportamiento responsive** → asumido: esta spec no dibuja pantalla, la `A1P2` es de la fila 27 y el tramo no aparece en ajustes como perilla numérica (alternativa: especificar aquí la pantalla). Regla: decisión 3 de `pipeline/decisiones-orquestador.md` y el design system, que prohíbe rediseñar una pantalla ya dibujada.
