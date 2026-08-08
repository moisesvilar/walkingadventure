# SPEC-013 — El prólogo del mundo: la historia que ya había pasado antes de que llegaras

## Descripción

Un mundo recién generado está técnicamente completo y narrativamente muerto: tiene pueblos, calzadas, parajes y nombres, y no tiene nada que nadie pueda contarte. Esta spec entrega el **prólogo**: unos cuantos pasos del mundo ejecutados **antes de que la partida empiece**, con siembra propia del mundo, de modo que el día 1 se entra en una aldea y **ya están hablando de algo**. No inventa maquinaria: es la propagación de SPEC-012 corriendo sobre el motor de SPEC-011 con un contador y una siembra que no son los de la jugadora, y su resultado son versiones ya asentadas en los núcleos, rumores todavía en vuelo y la cola de entregas sembrada.

Y no se deja al azar. El prólogo **se compone**: se resiembra entero, con un tope declarado de intentos, hasta que **dos núcleos alcanzables hayan oído el mismo suceso en niveles distintos**. Esa es la puesta en escena del mejor truco del juego —que lo que se cuenta se deforma al viajar— colocada donde la jugadora va a tropezarse con ella en lugar de explicada en un tutorial. De ahí sale la otra mitad de esta entrega: **la primera aventura se elige también por dónde pasa**, y tiene que llevarla a esos dos núcleos. Solo la primera; después el mundo vuelve a ser azaroso, porque una puesta en escena permanente convierte un mundo en un guion.

Hay una frontera que esta spec tiene que dejar afilada y que es la más fácil de romper de todo el proyecto: **resembrar el prólogo no es resembrar el mundo**. El prólogo es una capa sobre el mundo ya generado, exactamente igual que el motor de pasos; puede correrse ocho veces seguidas y el documento congelado de cada celda sigue idéntico byte a byte, con los mismos nombres, los mismos anclajes y el mismo grafo. RF-MUNDO-005 —lo generado no se resiembra jamás— no se relaja aquí ni un milímetro.

No tiene interfaz de usuario propia. Corre al final de **A1P5**, la pantalla de la generación, cuya última línea lo anuncia sin explicarlo («…y mientras tanto, ahí fuera ya pasan cosas que nadie te ha contado»); y su consecuencia se ve en **A1P7**, la lista de la primera aventura. Las dos pantallas son de la fila 27, y el hito que cierra el arranque es de la fila 36. Aquí se entrega el dato vivo que todas ellas leen.

Anclas: **RF-MUNDO-015** (`docs/prd.md` §4.1) y **RF-QUEST-014** (§4.2), los dos marcados **⚠ sin escenario** en el PRD, con `game-design/arranque.md` **§1**, **§2** y **§3** como fuente que manda sobre el PRD, y `game-design/personaje.md` §3 para por qué la cola de entregas se precalienta. **RNF-DET-001** y **RNF-DET-003** aplican como invariante bloqueante, y **RNF-PER-001** —generar un mapa por debajo del minuto— es la razón de que el tope de intentos exista. Se apoya en SPEC-003 (la semilla del mapa y el mecanismo de semillas de fase), SPEC-007 y SPEC-008 (el grafo cosido y qué significa alcanzable), SPEC-009 (el mundo congelado y el área `partida/`), SPEC-010 (el casting, que aquí se filtra y no se reabre), SPEC-011 (el contador, la siembra `:tick:n` y los productores inyectados) y SPEC-012 (el nacimiento del rumor, su viaje, su nivel y lo que sedimenta en cada núcleo): **de esas dos últimas esta spec es consumidora, no autora**. Ejecuta k pasos de ese motor con siembra propia del mundo y no reescribe ni una de sus decisiones.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la toca, y de tres maneras**: el motor de SPEC-011 se instancia con un contador y una base de siembra propios del prólogo; el nacimiento de rumor de SPEC-012 se invoca con hechos ya estructurados y sin desenlace de aventura; y la cola de entregas de la fila 19 recibe entradas sembradas. Están descritas en «Frontera de inyección».
- **Fuera de alcance, y son ocho cosas que parecerían naturales aquí:** el **motor de pasos** con su contador, su semilla y su reserva (fila 11), y la **propagación, la deformación y lo que sedimenta en cada núcleo** (fila 12), que esta spec **consume ya resueltos**; el **casting** con su reparto de roles, su presupuesto de beats y su lazo (fila 10), del que aquí solo se filtra el resultado; el **catálogo de plantillas** y sus afinidades de oficio (fila 17); la **redacción** de cualquier texto —del prólogo, del rumor o del hito— y el contrato con el narrador (fila 18); la **mecánica de la cola de entregas**, sus dos tipos, su coste cero de desvío y su ciclo de abandono (fila 19), a la que aquí solo se le siembran entradas; las **pantallas A1P5 y A1P7** con su lista de aventuras del día y su tope de tres (filas 27 y 28); la **página del diario y la cartela del hito de fin de arranque**, con su texto y su tono (fila 36, RF-DIARIO-006), del que aquí solo se siembra la condición; y la **vista por historias del diario** y la puesta en escena de la primera coincidencia (filas 16 y 37). Esta spec entrega **el pasado del mundo, la garantía de que está compuesto y la regla de la primera aventura**, y nada más.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Cuándo corre el prólogo», «Los sucesos del prólogo», «La condición de composición» y «La primera aventura se elige por dónde pasa»; la **validación de entradas** en el mundo sin punto de partida, el tope de intentos que no es entero positivo, el par recibido con un núcleo que no existe y el suceso sin signo; el **estado vacío** en el mapa de un solo núcleo, el mapa sin ningún núcleo alcanzable, el mundo marcado como sin contenido jugable y la cola de entregas que nadie consume todavía; el **estado de error** en el mundo sin grafo, el paso del prólogo que falla a mitad, el tramo del mapa ausente y la aventura que dice pasar por un núcleo que no está en su cadena de beats; y los **casos límite** en el intento que cumple la condición justo en el último, en los dos pares empatados, en el suceso que alcanza los dos núcleos en el mismo nivel y en la primera aventura que se acepta y se abandona.

«Mundo congelado X» sigue significando el fixture `test/fixtures/osm/X/` de SPEC-001. **«Paso»** significa siempre paso del mundo, la unidad de SPEC-011; cuando haga falta distinguirlos, **«paso del prólogo»** es el que ejecuta esta spec antes de que la partida empiece, y **«paso de la partida»** el que ejecuta la jugadora andando. **«Suceso»** es lo que le ocurrió al mundo y da lugar a un rumor. **«El par compuesto»** son los dos núcleos alcanzables que oyeron el mismo suceso en niveles distintos.

### Cuándo corre el prólogo y qué deja detrás

- **Dado** un mapa recién generado y todavía sin partida, **cuando** termina la generación, **entonces** el prólogo se ejecuta antes de que la partida quede disponible para jugar.
- **Dado** el prólogo terminado, **cuando** se revisan los núcleos alcanzables del mapa, **entonces** en al menos uno de ellos hay algo que contar.
- **Dado** el prólogo terminado, **cuando** se lee el contador de pasos de la partida para ese mapa, **entonces** marca cero.
- **Dado** el prólogo terminado, **cuando** se lee el diario de la jugadora, **entonces** está vacío: el pasado del mundo está en los núcleos y solo entra en el diario yendo.
- **Dado** el prólogo terminado, **cuando** se revisan los rumores del mapa, **entonces** puede haber rumores todavía en vuelo, y siguen viajando con los pasos que la jugadora ande.
- **Dado** un rumor que quedó en vuelo al terminar el prólogo, **cuando** la jugadora anda un paso, **entonces** ese rumor avanza como cualquier otro, sin ningún trato especial.
- **Dado** el prólogo terminado, **cuando** se busca alguna cifra suya expuesta a la capa de presentación —pasos ejecutados, intentos gastados, sucesos sembrados—, **entonces** no existe ninguna.
- **Dado** el prólogo, **cuando** se inspecciona su implementación, **entonces** no llama a ningún narrador, no pide ninguna imagen y no necesita red.
- **Dado** un dispositivo sin cobertura una vez descargados los datos de OSM, **cuando** corre el prólogo, **entonces** termina entero y sin degradación.

### La siembra es del mundo, no de la partida

- **Dado** el paso `n` del intento `i` del prólogo, **cuando** se pide su semilla, **entonces** se deriva de lo mismo que sembró el mundo, con el mecanismo de semillas de fase de SPEC-003 y un sufijo propio que incluye el número de intento y el número de paso.
- **Dado** dos partidas creadas con la misma semilla, en el mismo sitio y con el mismo tramo, **cuando** se comparan sus prólogos, **entonces** son idénticos: los mismos sucesos, en los mismos núcleos y en los mismos niveles.
- **Dado** dos partidas con la misma semilla y distinto oficio, **cuando** se comparan sus prólogos, **entonces** son idénticos: el oficio no entra en la siembra del prólogo.
- **Dado** dos partidas con la misma semilla y distinto nombre o género gramatical del personaje, **cuando** se comparan sus prólogos, **entonces** son idénticos.
- **Dado** el prólogo, **cuando** se inspecciona lo que entra en su siembra, **entonces** no entra ninguna fecha, ninguna hora, ningún dato del dispositivo ni ningún estado de la partida.
- **Dado** el prólogo de un mapa, **cuando** se compara con el prólogo de otro mapa de la misma partida, **entonces** sus semillas son distintas.
- **Dado** el frente de un rumor del prólogo, **cuando** avanza, **entonces** avanza el tramo con el que se dimensionó el mapa y no el tramo vivo de la jugadora.
- **Dado** un mapa con su prólogo ya corrido, **cuando** el tramo de la jugadora cambia, **entonces** el prólogo no se recalcula ni se reescribe.
- **Dado** los módulos de esta entrega, **cuando** se inspecciona su implementación, **entonces** no aparece `Math.random()`, ni `Date.now()`, ni `new Date()`, ni ninguna iteración cuyo resultado dependa del orden de inserción de un `Set` o un `Map`.

### Los sucesos del prólogo: de quién no son

- **Dado** el prólogo, **cuando** se siembran sus sucesos, **entonces** cada uno nace en un núcleo del mapa, en nivel 0, y con la misma forma de rumor que fija SPEC-012.
- **Dado** los sucesos de un prólogo, **cuando** se pregunta quién los protagoniza, **entonces** ninguno los protagoniza la jugadora.
- **Dado** el prólogo terminado, **cuando** se pregunta a cualquier núcleo qué se cuenta allí de la jugadora, **entonces** no se cuenta nada de ella en ninguno.
- **Dado** los sucesos de un prólogo, **cuando** se leen sus signos morales, **entonces** cada uno es uno de los dos valores del enumerado cerrado de SPEC-012 y lo fija el código, nunca un texto.
- **Dado** un suceso del prólogo, **cuando** viaja y se deforma, **entonces** usa la misma escalera de cuatro niveles y la misma invariante de signo que cualquier rumor de la partida, sin ninguna excepción.
- **Dado** los sucesos de un prólogo, **cuando** se cuentan, **entonces** su número sale del parámetro declarado y nacen en núcleos distintos mientras haya núcleos donde repartirlos.
- **Dado** un mapa con menos núcleos que sucesos a sembrar, **cuando** corre el prólogo, **entonces** se siembran los que caben y no falla.
- **Dado** un suceso del prólogo, **cuando** se lee su texto, **entonces** puede no existir todavía y el nivel, el signo y los hechos están completos igual.
- **Dado** el catálogo de sucesos del prólogo, **cuando** se enumera, **entonces** es cerrado, y ninguno de sus miembros contradice el contenido apto para menores.

### La condición de composición y la resiembra

- **Dado** un prólogo terminado que cumple la condición, **cuando** se lee el par compuesto, **entonces** son dos núcleos distintos, los dos alcanzables, que oyeron el mismo suceso en niveles distintos.
- **Dado** un intento de prólogo que no deja ningún par así, **cuando** se evalúa la condición, **entonces** el prólogo entero se resiembra y se vuelve a ejecutar.
- **Dado** un intento resembrado, **cuando** se compara con el anterior, **entonces** difiere, porque el número de intento entra en la siembra.
- **Dado** una resiembra, **cuando** se mira qué se conserva del intento anterior, **entonces** no se conserva nada: lo que quedó en los núcleos y en los rumores del intento fallido se descarta entero.
- **Dado** el primer intento que cumple la condición, **cuando** se evalúa, **entonces** el prólogo termina ahí y no se ejecuta ningún intento más.
- **Dado** dos parejas de núcleos que cumplen la condición en el mismo intento, **cuando** se elige el par compuesto, **entonces** se elige una sola, por una regla declarada y estable que no depende del orden de recorrido.
- **Dado** un suceso que alcanzó dos núcleos en el mismo nivel, **cuando** se evalúa la condición con ese par, **entonces** no la cumple: hacen falta niveles distintos.
- **Dado** dos núcleos que oyeron sucesos distintos, **cuando** se evalúa la condición con ese par, **entonces** no la cumple: tiene que ser el mismo suceso.
- **Dado** dos núcleos que oyeron el mismo suceso en niveles distintos, pero uno de ellos no es alcanzable, **cuando** se evalúa la condición, **entonces** no la cumple.
- **Dado** el par compuesto elegido, **cuando** se busca dónde queda registrado, **entonces** queda en el estado de la partida, con la identidad de los dos núcleos y la del suceso que comparten.
- **Dado** el mismo mundo congelado y la misma semilla, **cuando** se compone el prólogo dos veces desde cero, **entonces** se gasta el mismo número de intentos y sale el mismo par compuesto.

### «Alcanzable» es por el grafo, no en línea recta

- **Dado** un núcleo, **cuando** se pregunta si es alcanzable, **entonces** la respuesta sale de si existe camino por el grafo de calzadas desde el punto de partida de la jugadora.
- **Dado** un núcleo a 400 m en línea recta al otro lado de una ría, sin ningún camino por el grafo, **cuando** se pregunta si es alcanzable, **entonces** no lo es.
- **Dado** un núcleo a varios kilómetros pero unido por calzada, **cuando** se pregunta si es alcanzable, **entonces** lo es.
- **Dado** el filtro de accesibilidad de la jugadora, **cuando** se resuelve la alcanzabilidad, **entonces** se resuelve sobre el grafo que ese filtro deja transitable, y no sobre el grafo entero.
- **Dado** un par de núcleos alcanzables, **cuando** se evalúa la condición de composición, **entonces** además se comprueba que existe un recorrido que pasa por los dos y cabe en alguno de los tamaños de salida declarados.
- **Dado** un par que cumple lo del mismo suceso y los niveles distintos pero cuyo recorrido no cabe en ningún tamaño declarado, **cuando** se evalúa la condición, **entonces** no la cumple, y el prólogo se resiembra.
- **Dado** la resolución de la alcanzabilidad, **cuando** se inspecciona su implementación, **entonces** no usa ninguna distancia en línea recta entre núcleos.

### El tope de intentos y qué pasa al agotarlo

- **Dado** el tope de intentos, **cuando** se busca de dónde sale, **entonces** hay una sola constante declarada, con su valor por defecto y su justificación escrita.
- **Dado** un mundo en el que la condición no se cumple nunca, **cuando** corre el prólogo, **entonces** se ejecutan como mucho los intentos del tope y el proceso termina.
- **Dado** el tope agotado, **cuando** se lee el estado del mapa, **entonces** conserva el prólogo del último intento: el mundo tiene pasado igualmente, solo que sin par compuesto.
- **Dado** el tope agotado, **cuando** se lee el par compuesto, **entonces** no hay ninguno, y eso es un valor declarado y no un error.
- **Dado** el tope agotado, **cuando** se mira lo que ve la jugadora, **entonces** no hay ningún aviso, ningún texto y ninguna pantalla que mencione que faltó algo.
- **Dado** el tope agotado, **cuando** se compone la lista de la primera aventura, **entonces** se compone con la regla normal del casting y el día no se queda vacío.
- **Dado** un tope que no es un entero positivo, **cuando** se lanza el prólogo, **entonces** falla nombrando el valor recibido, en lugar de correr sin tope.
- **Dado** el prólogo, **cuando** se busca en su implementación un bucle que dependa de que la condición acabe cumpliéndose, **entonces** no existe: el número de intentos está acotado por construcción.

### Resembrar el prólogo no es resembrar el mundo

- **Dado** un mundo congelado, **cuando** el prólogo se resiembra ocho veces, **entonces** el documento de cada celda sigue idéntico byte a byte.
- **Dado** el mismo caso, **cuando** se comparan los nombres de núcleos, calzadas y parajes, **entonces** son los mismos después de la última resiembra que antes de la primera.
- **Dado** el mismo caso, **cuando** se comparan los anclajes reales gastados y los libres, **entonces** son los mismos.
- **Dado** el mismo caso, **cuando** se compara el grafo de calzadas con sus marcas de suposición, **entonces** es el mismo.
- **Dado** los módulos de esta entrega, **cuando** se inspeccionan sus imports, **entonces** no importan `buildWorld` ni ninguna fase de la generación.
- **Dado** la tubería de generación, **cuando** se enumeran sus fases, **entonces** el prólogo no es una de ellas.
- **Dado** un prólogo ejecutado, **cuando** se inspecciona lo que ha escrito, **entonces** escribe solo en el estado de la partida y nunca en el mundo congelado.
- **Dado** un mapa con su prólogo corrido, **cuando** se vuelve a generar la celda con la misma semilla y los mismos datos de OSM, **entonces** sale idéntica: el prólogo no entra en la generación.

### Cuánto dura el prólogo

- **Dado** el prólogo de un intento, **cuando** todos los núcleos alcanzables han oído al menos un suceso, **entonces** el intento deja de dar pasos, aunque queden pasos de su tope sin gastar.
- **Dado** un mapa en el que algún núcleo alcanzable nunca llega a oír nada, **cuando** el intento agota su tope de pasos, **entonces** termina ahí y no es un error.
- **Dado** el tope de pasos del prólogo, **cuando** se busca de dónde sale, **entonces** hay una sola constante declarada, con su valor por defecto y su justificación escrita, y ninguna fase lo recalcula por su cuenta.
- **Dado** un prólogo terminado, **cuando** se revisan los niveles de lo que sedimentó en los núcleos alcanzables que oyeron algo, **entonces** al menos uno lo oyó por debajo del nivel máximo: el mundo no suena entero a leyenda.
- **Dado** dos mapas de tamaños distintos, **cuando** corren sus prólogos, **entonces** el número de pasos gastado puede ser distinto, porque el criterio es la cobertura y no la cifra.
- **Dado** el prólogo, **cuando** se mide lo que tarda sobre un mundo congelado, **entonces** cabe holgadamente dentro del presupuesto de la generación de un mapa.

### La cola de entregas queda sembrada

- **Dado** el prólogo terminado, **cuando** se lee la cola de entregas del mapa, **entonces** no está vacía.
- **Dado** las entradas sembradas, **cuando** se leen, **entonces** tienen la misma forma que las que la cola produce durante la partida, sin ningún campo propio del prólogo.
- **Dado** el número de entradas sembradas, **cuando** se busca de dónde sale, **entonces** hay una sola constante declarada con su valor por defecto.
- **Dado** las entradas sembradas, **cuando** se cuenta cuántas son de cada tipo, **entonces** hay al menos un encargo suelto, para que un día sin aventura del oficio no sea un día vacío.
- **Dado** una entrada sembrada por el prólogo, **cuando** se comprueba si sigue su ciclo normal, **entonces** lo sigue: se ofrece, se puede ignorar y sedimenta como cualquier otra.
- **Dado** el prólogo, **cuando** se revisa qué aventuras ha dejado, **entonces** no ha dejado ninguna: las aventuras salen de castear plantillas contra el mundo.
- **Dado** una cola de entregas que nadie consume todavía, **cuando** se lee, **entonces** devuelve sus entradas y no un error.

### La primera aventura se elige por dónde pasa

- **Dado** un par compuesto y la primera lista de aventuras de la partida, **cuando** se compone, **entonces** sus candidatas son las que castean **y además** pasan por los dos núcleos del par.
- **Dado** una aventura candidata, **cuando** se comprueba si pasa por un núcleo del par, **entonces** la respuesta es que tiene al menos un beat situado en ese núcleo.
- **Dado** una aventura cuyo recorrido cruza un núcleo del par sin ningún beat allí, **cuando** se comprueba si pasa por él, **entonces** no pasa.
- **Dado** un mundo donde castean ocho plantillas y solo dos pasan por los dos núcleos, **cuando** se compone la primera lista, **entonces** las candidatas son esas dos.
- **Dado** un mundo donde ninguna plantilla casteada pasa por los dos núcleos, **cuando** se compone la primera lista, **entonces** se compone con la regla normal del casting y el día no se queda vacío.
- **Dado** el mismo caso, **cuando** se mira lo que ve la jugadora, **entonces** ningún texto menciona que la puesta en escena no se pudo hacer.
- **Dado** la primera aventura ya aceptada, **cuando** se compone la segunda lista de la partida, **entonces** la regla de paso ya no se aplica y las candidatas son las que castean, sin más.
- **Dado** una salida sin aceptar ninguna aventura, **cuando** se compone la lista siguiente, **entonces** la regla de paso sigue vigente: no la consume salir a andar.
- **Dado** una primera aventura aceptada y abandonada a mitad, **cuando** se compone la lista siguiente, **entonces** la regla de paso ya no se aplica.
- **Dado** un mapa sin par compuesto, **cuando** se compone su primera lista, **entonces** la regla de paso no se aplica en absoluto.
- **Dado** el filtro de la primera aventura, **cuando** se comprueba con qué se combina, **entonces** se aplica **encima** del filtro de oficio y del casting, y no los sustituye ni los relaja.
- **Dado** una aventura que dice pasar por un núcleo que no está en su cadena de beats, **cuando** se valida el filtro, **entonces** falla nombrando el núcleo, en lugar de aceptarla.

### El arranque queda abierto y su hito se marca una sola vez

- **Dado** una partida recién creada con su prólogo corrido, **cuando** se lee el estado del arranque, **entonces** está abierto.
- **Dado** el arranque abierto, **cuando** la jugadora llega a un núcleo donde lo que se cuenta es ella, contado por otros, **entonces** la condición de fin de arranque queda cumplida.
- **Dado** la condición cumplida, **cuando** se vuelve a llegar a ese núcleo o a cualquier otro donde se cuente algo suyo, **entonces** no se vuelve a cumplir: se marca una sola vez y no vuelve.
- **Dado** el arranque abierto y un núcleo donde lo único que se cuenta son sucesos del prólogo, **cuando** la jugadora llega, **entonces** la condición no se cumple: los sucesos del prólogo no la protagonizan.
- **Dado** el arranque abierto y un núcleo donde lo que se cuenta es la versión fiel que ella misma vio ocurrir, **cuando** llega, **entonces** la condición no se cumple: hace falta que se lo cuenten otros.
- **Dado** la condición cumplida, **cuando** se busca qué entrega esta spec al respecto, **entonces** entrega el estado y su marca única, y ningún texto, ninguna cartela y ninguna página de diario.
- **Dado** el estado del arranque, **cuando** se serializa la partida y se vuelve a cargar, **entonces** vuelve con el mismo valor y el hito no se vuelve a marcar.
- **Dado** el estado del arranque, **cuando** se busca alguna forma de reabrirlo, **entonces** no existe.

### El prólogo de un mapa que no es el primero

- **Dado** un mapa nuevo levantado cuando el mundo crece por los bordes, **cuando** se genera, **entonces** también corre su prólogo y sus núcleos nacen con algo que contar.
- **Dado** un mundo efímero levantado de vacaciones, **cuando** se genera, **entonces** también corre su prólogo.
- **Dado** un mapa que no es el primero de la partida, **cuando** corre su prólogo, **entonces** no se evalúa la condición de composición y no hay resiembra.
- **Dado** un mapa que no es el primero, **cuando** se compone su primera lista de aventuras, **entonces** la regla de paso no se aplica.
- **Dado** un mapa que no es el primero, **cuando** se lee el estado del arranque, **entonces** no lo reabre.
- **Dado** el prólogo de un mapa, **cuando** siembra sus sucesos, **entonces** ninguno alcanza los núcleos de otro mapa de la partida.

### Determinismo, persistencia y errores

- **Dado** el mismo mundo congelado y la misma semilla, **cuando** se corre el prólogo dos veces desde cero, **entonces** los sucesos, los núcleos alcanzados, los niveles, el par compuesto y la cola sembrada son idénticos.
- **Dado** un prólogo corrido, **cuando** se serializa la partida y se vuelve a cargar, **entonces** vuelven lo sedimentado en cada núcleo, los rumores en vuelo con su frente, el par compuesto, la cola sembrada y el estado del arranque.
- **Dado** una partida cargada de un respaldo, **cuando** se lee su prólogo, **entonces** no se vuelve a ejecutar.
- **Dado** un paso del prólogo que falla al aplicarse, **cuando** se lee el estado del intento, **entonces** no ha avanzado: un paso se aplica entero o no se aplica.
- **Dado** un intento que falla a mitad, **cuando** se lee el mapa, **entonces** el mundo congelado sigue intacto y el fallo se nombra sin dejar un prólogo a medias asentado.
- **Dado** un mapa sin punto de partida declarado, **cuando** se lanza el prólogo, **entonces** falla nombrando el punto que falta, en lugar de suponer el centro del mapa.
- **Dado** un mapa sin grafo de calzadas, **cuando** se lanza el prólogo, **entonces** falla nombrando lo que falta.
- **Dado** un mapa sin el tramo con el que se dimensionó, **cuando** se lanza el prólogo, **entonces** falla nombrando el tramo que falta, en lugar de suponer uno por defecto.
- **Dado** un par recibido con un núcleo que no existe en el mapa activo, **cuando** se valida, **entonces** falla nombrando el núcleo.
- **Dado** un mapa con un solo núcleo, **cuando** corre el prólogo, **entonces** se siembra un suceso, no hay par compuesto y no falla.
- **Dado** un mapa sin ningún núcleo alcanzable desde el punto de partida, **cuando** corre el prólogo, **entonces** termina sin par compuesto y no falla.
- **Dado** un mapa marcado como sin contenido jugable, **cuando** corre el prólogo, **entonces** no siembra nada y no falla.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/prologo.js` | la ejecución de un intento —siembra de sucesos, pasos hasta la cobertura o el tope—, el bucle acotado de intentos y el resultado que se asienta |
| `packages/nucleo/partida/sucesos-prologo.js` | el catálogo cerrado de sucesos del mundo, su anclaje a núcleos y la construcción de sus hechos estructurados y su signo |
| `packages/nucleo/partida/arranque.js` | el par compuesto y su elección, la alcanzabilidad por grafo, el filtro de la primera aventura y su consumo, y el estado del arranque con su marca única |

Las tres viven en `partida/` por la misma razón que las de SPEC-011 y SPEC-012: **lo que el prólogo deja es estado sobre un mundo congelado, no parte del mundo**. Las áreas del paquete están fijadas desde SPEC-002 y esta entrega no abre ninguna nueva.

### Frontera de inyección

Tres entradas nuevas, y ninguna sensor:

- **El motor de pasos de SPEC-011, instanciado con contador y base de siembra propios.** El motor ya recibe de quien construye la partida su contador y su base; el prólogo le da los suyos —contador que empieza en uno y muere al terminar el intento, base derivada de la del mundo con el sufijo del prólogo— y **ninguna decisión del motor se reabre**: mismos productores, mismo catálogo cerrado de efectos aditivos, misma regla de que un paso se aplica entero o no se aplica. Al terminar el prólogo, el contador de la partida para ese mapa sigue en cero.
- **El nacimiento de rumor de SPEC-012, invocado con hechos ya estructurados.** SPEC-012 modela el rumor como identidad, núcleo de origen, semilla, signo y hechos; su nacimiento hoy se dispara desde el desenlace notable de una aventura. Aquí hace falta la misma pieza **sin aventura detrás**: el prólogo construye los hechos y el signo desde su catálogo y los entrega. No cambia la forma del rumor ni su viaje ni su deformación; solo entra por otra puerta.
- **La cola de entregas de la fila 19**, que recibe entradas sembradas con su forma propia. Mientras esa fila no exista, el prólogo las deja en la lista declarada que la fila 19 consumirá, y **no define su ciclo de vida**: ni el coste cero de desvío, ni el cooldown, ni la doble oferta, ni la sedimentación.

Y todo lo demás lo recibe como argumento de quien levanta el mapa: el mundo congelado con sus núcleos y su grafo (SPEC-007, SPEC-008, SPEC-009), el tramo con el que se dimensionó el mapa (SPEC-003), el punto de partida de la jugadora y la marca de si este es el primer mapa de la partida.

Hacia fuera entrega tres cosas: **el estado asentado del prólogo** (lo que se cuenta en cada núcleo y los rumores en vuelo, en la forma de SPEC-012), **el par compuesto o su ausencia**, y **el estado del arranque con el predicado de la primera aventura**. No entrega ni un texto destinado a mostrarse.

### Los parámetros, que son criterio y no cifra

`arranque.md` pendiente 2 y `docs/prd.md` §7 dicen lo mismo: hay criterio y no hay número, y el número sale midiendo. Así que van como **parámetros declarados una sola vez, con valor por defecto y justificación escrita**, y los criterios de aceptación afirman el criterio y no el valor — el mismo tratamiento que SPEC-003 le dio al lado de celda.

| Parámetro | Por defecto | Criterio que sí está cerrado |
| --- | --- | --- |
| `TOPE_PASOS_PROLOGO` | 12 | «dura lo que tarde en haber algo que contar en cada núcleo, y ni un paso más»: el intento **para en cuanto todos los núcleos alcanzables han oído algo**, y el tope solo evita que un mapa raro lo alargue sin fin |
| `SUCESOS_PROLOGO` | 3 | hacen falta al menos dos sucesos vivos para que la condición de composición tenga margen, y pocos para que el día 1 no suene a que ha pasado de todo |
| `INTENTOS_PROLOGO` | 8 | el prólogo cabe dentro del minuto de RNF-PER-001; ocho intentos de doce pasos sobre datos en memoria son milisegundos, y el tope existe por la garantía de terminación, no por el coste |
| `ENTREGAS_PROLOGO` | 2 | `personaje.md` §3: que un día sin aventura del oficio no sea un día vacío; una oportunidad y un encargo suelto bastan |

Un detalle que quita miedo al «museo» de `arranque.md` §1: como el frente se para al entregar el rumor en nivel 3 (SPEC-012) y el nivel se fija al llegar, alargar el prólogo **no envejece lo que ya sedimentó cerca**. Subir el tope solo hace que oigan algo núcleos más lejanos, y siempre a nivel alto. El riesgo de que todo suene a leyenda está acotado por la escalera, no por el parámetro.

**Cómo se cierra el pendiente:** corriendo prólogos sobre los cuatro fixtures de SPEC-001 con tramos de 2 km, 1 km y el suelo, y midiendo tres cosas: cuántos pasos hacen falta para cubrir todos los núcleos alcanzables, en cuántos intentos se cumple la condición de composición, y qué reparto de niveles queda. El número que salga se anota en `game-design/arranque.md` (pendiente 2, tachado con su resultado) y la iteración, en `docs/starting.md`. Hasta entonces los valores por defecto son supuestos declarados, no decisiones de diseño cerradas.

### La condición de composición, entera

Un intento cumple si existe un suceso `S` y dos núcleos `A ≠ B` tales que:

1. **Los dos oyeron `S`** —está sedimentado en los dos, no en vuelo hacia ellos—.
2. **En niveles distintos.** Mismo nivel no compone: la gracia es que las dos versiones se contradigan.
3. **Los dos son alcanzables**, que significa que existe camino por el grafo de calzadas desde el punto de partida, sobre el grafo que el filtro de accesibilidad de la jugadora deja transitable. Nunca distancia en línea recta: el precedente está en SPEC-007, donde media red parecía desconectada por huecos de 9-50 m, y en SPEC-008, donde el filtro cambia por dónde se manda a cada persona.
4. **Existe un recorrido que pasa por los dos y cabe en alguno de los tamaños de salida declarados.** Sin esta cuarta cláusula, RF-QUEST-014 puede ser imposible de cumplir con un par perfectamente válido, y la puesta en escena se cae sin que nada lo declare.

Si hay varios pares, se elige uno por regla estable declarada —el suceso de identidad menor y, dentro de él, la pareja de identificadores de núcleo menor— y no por orden de recorrido, que es exactamente el tipo de dependencia de orden que `CLAUDE.md` prohíbe.

**La resiembra descarta el intento entero.** No se conserva nada del anterior: ni los sucesos, ni lo sedimentado, ni los frentes, ni la cola. Componer conservando trozos convertiría el prólogo en una búsqueda con memoria y haría que el resultado dependiera del camino, no de la semilla.

### Resembrar el prólogo no es resembrar el mundo

Es la frontera que esta spec existe para no romper, y conviene decirla en la forma en que se puede verificar:

| Lo que se resiembra | Lo que no se toca jamás |
| --- | --- |
| los sucesos del prólogo y sus hechos | los núcleos, sus anclajes reales y sus servicios |
| lo que sedimentó en cada núcleo | los parajes, sus tipos y sus escenas |
| los frentes de los rumores en vuelo | el grafo de calzadas y sus marcas de suposición |
| las entradas sembradas en la cola | los nombres de todo, y el título del mundo |
| el par compuesto | el documento congelado de cada celda, byte a byte |

RF-MUNDO-005 habla de **generación**, y el prólogo es capa, igual que el motor de pasos: la garantía no se hereda de la letra del requisito, se afirma aquí con sus propios criterios. Por eso hay ACs que comparan el documento congelado antes y después de ocho resiembras, y por eso los módulos de esta entrega no pueden importar `buildWorld`.

### La primera aventura, y por qué «pasar por» es tener un beat allí

RF-QUEST-014 dice que la primera aventura tiene que pasar por los dos núcleos del par. «Pasar por» se resuelve como **tener al menos un beat situado en cada uno**, y no como que el trazado los cruce, por una razón mecánica: lo que se cuenta en un núcleo aflora al **llegar y pararse dentro del geofence** (fila 32, RF-BUCLE-006). Cruzar un pueblo de largo no dispara nada, y la puesta en escena se perdería justo donde tenía que ocurrir.

El filtro se aplica **encima** del casting y del filtro de oficio, nunca en lugar de ellos: una aventura que no castea no se ofrece por mucho que pase por los dos núcleos. Y **degrada abriendo**, no cerrando: si ninguna candidata pasa por los dos, la lista se compone con la regla normal. Un día vacío por una puesta en escena sería peor que la puesta en escena que se pierde, y `docs/testing.md` ya lo dice con otras palabras en «Un día con una sola aventura no es un día roto».

La regla se consume **al aceptar la primera aventura**, no al terminarla. Reimponerla tras un abandono repetiría el guion, y `arranque.md` §2 es categórico: «esto es del arranque y solo del arranque». Salir a andar sin coger nada no la consume, porque no ha habido primera aventura todavía.

### El hito de fin de arranque: dónde está la frontera

`arranque.md` §3 fija el criterio —el arranque termina cuando llegas a un núcleo y **lo que allí se cuenta eres tú**, contado por otros y no exactamente como fue— y que se marca una sola vez. El reparto es este:

| Aquí, fila 13 | Fila 36, `telon` (RF-DIARIO-006) |
| --- | --- |
| el estado del arranque, abierto de origen | la página del diario y la cartela |
| la condición que lo cierra, evaluada al llegar a un núcleo | el texto, su tono cómico-cálido y su regla de redacción |
| que se marque una vez y no se pueda reabrir | cuándo y dónde se enseña |
| que los sucesos del prólogo no puedan dispararlo | que no se parezca a un «tutorial completado» |

Y queda **abierto y no lo cierra esta spec**: el pendiente 1 de `arranque.md` —quién tarda un mes en producir algo notable y no llega nunca a ese momento—. La propuesta escrita y sin ratificar es que el arranque también cierre cuando la jugadora ya ha visto el truco. El estado que aquí se entrega tiene que poder cerrarse por más de una vía sin cambiar de forma, pero **la segunda vía no se implementa** mientras el diseño no la ratifique.

### Lo que consume de otras specs y no respecifica

- **SPEC-003** entrega la semilla del mapa y el mecanismo de semillas de fase. El prólogo añade su sufijo y no inventa otro mecanismo.
- **SPEC-007 y SPEC-008** entregan el grafo cosido con sus marcas de suposición y el filtro que evita y declara. La alcanzabilidad se resuelve sobre eso; aquí no se cose, no se traza y no se filtra nada.
- **SPEC-009** entrega el mundo congelado y establece que el documento de celda describe el mundo y no crece. El prólogo no entra ahí ni cuando sedimenta.
- **SPEC-010** entrega la aventura casteada con su cadena de beats. Aquí solo se filtra el resultado por dónde tiene beats; el reparto de roles, el presupuesto y el lazo no se tocan.
- **SPEC-011** entrega el contador, la siembra, el catálogo cerrado de efectos aditivos y la regla del paso atómico. Se consumen; lo único nuevo es instanciar el motor con un contador y una base que no son los de la partida.
- **SPEC-012** entrega el nacimiento, el viaje, la escalera de cuatro niveles, la invariante del signo y lo que sedimenta por núcleo. **Nada de eso se reabre**: los sucesos del prólogo son rumores normales que nacen por otra puerta y viajan con las mismas reglas.

### Escenarios de `docs/testing.md`, y la verdad sobre la cobertura

**El PRD marca RF-MUNDO-015 y RF-QUEST-014 como ⚠ sin escenario, y esta spec lo confirma: `docs/testing.md` no tiene ni una característica sobre el prólogo, ni sobre la condición de composición, ni sobre la regla de la primera aventura, ni sobre el hito de fin de arranque.** Un `grep` de «prólogo», «arranque», «primera aventura», «hito» y «triangular» sobre la batería devuelve una sola coincidencia relacionada, y es de otra cosa: «Borrar lleva al arranque» (fila 40). Así que **prácticamente todos los criterios de esta spec quedan sin escenario que los respalde**, y `wa-qa-dev` tendrá que marcarlos como hueco declarado en `test/spec-test-map.json` en lugar de citar un escenario inexistente.

Lo que sí existe, citado literal, es de las características vecinas, y sostiene los bordes de esta spec sin cubrir su centro:

- De **«Triangular se descubre jugando y luego se facilita»** (`@app @rumores`), que es la característica más cercana y describe lo que el prólogo pone en escena: «Al principio el diario solo se lee por días», «La primera coincidencia se pone en escena», «A partir de ahí se abre la vista por historias» y «Las versiones se ordenan por cuándo se oyeron». Los cuatro son de las filas 16 y 37, y **ninguno dice cómo llega la jugadora a tener dos versiones el día 1** — que es justo lo que esta spec garantiza.
- De **«El rumor nace donde ocurrió y viaja por el árbol de calzadas»** (`@nucleo @rumores`): «Nace fiel y en el sitio», «Avanza un tramo por paso del mundo», «La deformación cuenta saltos, no kilómetros», «Dos núcleos a la misma distancia pueden recibir versiones distintas» y «El rumor se agota solo». Son de la fila 12 y aquí se consumen; **«Dos núcleos a la misma distancia pueden recibir versiones distintas» es lo más parecido que hay a la condición de composición, y afirma que *puede* ocurrir, no que se *garantice*.**
- De **«El mundo avanza con los kilómetros del jugador, no con el calendario»**: «Un tramo andado es un paso del mundo» y «El contenido de un paso lo decide su número», que son de la fila 11 y aquí se consumen con otro contador y otra siembra.
- De **«Una quest se castea contra el mundo o no se ofrece»**: «El casting es determinista», «Una plantilla sin candidatos no se ofrece» y «Todo lazo casteado se cierra», sobre los que el filtro de la primera aventura se apoya sin modificarlos.
- De **«Antes de salir es el único momento que pide atención»**: «Un día con una sola aventura no es un día roto» y «Se ofrecen tres aventuras como mucho», que son de la fila 28 y son la razón de que el filtro degrade abriendo.
- De **«Lo generado no se resiembra jamás»**: «Abrir una celda vecina no toca la celda propia», «Cambiar el tramo del jugador no redimensiona un mundo ya generado» y «Cambiar el estilo de pintado no resiembra nada». La resiembra del prólogo es el cuarto caso de esa lista y **no está en ella**.

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería, no de esta spec. Es la lista más larga que ha producido ninguna spec de este pipeline, y es consecuencia directa del doble ⚠ del PRD:

- **Nada describe el prólogo.** Ni que exista, ni cuándo corre, ni que el contador de la partida siga en cero después, ni que el diario arranque vacío pese a que el mundo tenga pasado.
- **Nada describe la condición de composición ni la resiembra.** «Dos núcleos a la misma distancia pueden recibir versiones distintas» es una posibilidad, no una garantía, y es el escenario más cercano que hay.
- **Nada afirma que resembrar el prólogo no resiembra el mundo.** «Lo generado no se resiembra jamás» enumera tres agresiones —celda vecina, cambio de tramo, cambio de estilo— y esta es la cuarta y la única que se ejecuta ocho veces seguidas.
- **Nada describe el tope de intentos ni qué se hace al agotarlo.** Es la decisión con más consecuencias de esta spec: sin tope, la app se cuelga en la pantalla más frágil del juego.
- **Nada define «alcanzable».** El proyecto tiene precedente medido de que la línea recta miente (SPEC-007, 109 componentes conexas), y la batería no lo afirma en ningún sitio para los núcleos.
- **Nada describe la regla de la primera aventura.** Ni el filtro, ni que se aplique encima del casting, ni que degrade abriendo, ni que se consuma una sola vez.
- **Nada describe el hito de fin de arranque.** RF-DIARIO-006 está marcado ⚠ sin escenario en el PRD y la batería lo confirma; falta también que los sucesos del prólogo no puedan dispararlo, que es el error más fácil de cometer al implementarlo.
- **Nada afirma que el prólogo se siembra con el mundo y no con la partida.** Que dos personas con la misma semilla oigan el mismo pasado, y que el oficio y el nombre no lo muevan, es una propiedad verificable y no está escrita.
- **Nada afirma que la cola de entregas queda sembrada.** RF-QUEST-016 también está ⚠ sin escenario, y el precalentamiento es la mitad de la respuesta al día sin aventura del oficio.

## Decisiones asumidas

- **El prólogo engendra sus propios sucesos, de un catálogo cerrado, y ninguno lo protagoniza la jugadora** → asumido (alternativa: ejecutar pasos sin sembrar nada, que es lo que dice la letra de RF-MUNDO-015). Regla: `arranque.md` §1 dice «hay rumores circulando, versiones ya deformadas asentadas en cada núcleo, cosas que ocurrieron antes de que tú llegaras», y sin sucesos un paso no produce nada; que no la protagonicen es lo que impide que el hito de `arranque.md` §3 se dispare el día 1 por accidente.
- **La siembra del prólogo se deriva de lo que sembró el mundo, con sufijo propio, y no del estado de la partida** → asumido (alternativa: la siembra de partida de SPEC-011, que es la del motor). Regla: `arranque.md` §1, «se siembra con la semilla del mundo y su propio sufijo, así que dos personas con la misma semilla oirían el mismo pasado; es una propiedad del lugar, como los nombres».
- **El frente de un rumor del prólogo avanza el tramo con el que se dimensionó el mapa, no el tramo vivo de la jugadora** → asumido (alternativa: el tramo vigente, como hacen los pasos de la partida en SPEC-011). Regla: el prólogo es propiedad del mapa; con el tramo vivo, corregirlo más tarde reescribiría un pasado ya asentado, y SPEC-011 ya decidió que ningún paso ejecutado se recalcula.
- **El intento para en cuanto todos los núcleos alcanzables han oído algo, y `TOPE_PASOS_PROLOGO` es un techo, no un objetivo** → asumido (alternativa: ejecutar siempre k pasos exactos). Regla: `arranque.md` §1, «dura lo que tarde en haber algo que contar en cada núcleo, y ni un paso más»; con k fijo, la cifra pendiente de medir se convertiría en la regla en vez de en el tope.
- **`TOPE_PASOS_PROLOGO` = 12, `SUCESOS_PROLOGO` = 3, `ENTREGAS_PROLOGO` = 2 por defecto** → asumidos como supuestos de trabajo, con los criterios afirmados en los ACs y las cifras no. Regla: `arranque.md` pendiente 2 y `docs/prd.md` §7 dicen que el número sale midiendo; precedente exacto, `LADO_CELDA_EN_TRAMOS` en SPEC-003.
- **`INTENTOS_PROLOGO` = 8, y al agotarlo se conserva el prólogo del último intento y se sigue sin par compuesto** → asumido (alternativas: bucle sin tope, que es una app colgada en la pantalla más frágil del juego; o dejar el mapa sin prólogo, que devuelve un mundo mudo el día 1; o pedir a la jugadora que reintente, que la obligaría a saber que existe una puesta en escena). Regla: RNF-PER-001 pone la generación por debajo del minuto y `arranque.md` §2 dice que el juego «no dice nada»; fallar abriendo —mundo con pasado, sin puesta en escena y en silencio— es la única salida que no rompe ninguna de las dos.
- **La resiembra descarta el intento entero, sin conservar nada** → asumido (alternativa: conservar los sucesos que ya habían compuesto y volver a tirar solo los demás). Regla: RF-MUNDO-015 dice «se resiembra el prólogo», no «se completa»; conservar trozos haría que el resultado dependiera del camino recorrido y no de la semilla, que es la definición de romper el determinismo.
- **«Alcanzable» es existir camino por el grafo desde el punto de partida, sobre el grafo que deja transitable el filtro de accesibilidad** → asumido (alternativas: distancia en línea recta, o el grafo entero sin filtrar). Regla: `arranque.md` §2 dice «alcanzables» y SPEC-007 tiene el precedente medido de 109 componentes conexas donde la línea recta miente; usar el grafo sin filtrar compondría el par en dos pueblos a los que esa persona concreta no puede ir, que es exactamente lo que RF-MUNDO-017 existe para evitar.
- **La condición de composición exige además que exista un recorrido por los dos que quepa en algún tamaño de salida declarado** → asumido (alternativa: quedarse con las tres cláusulas literales del PRD). Regla: sin ella, RF-QUEST-014 puede ser imposible de cumplir con un par válido, y el fallo aparecería en la fila 28 sin que nada lo hubiera declarado; es la misma clase de comprobación que el casting ya hace con el lazo y el presupuesto.
- **Con varios pares posibles, se elige por regla estable declarada y no por orden de recorrido** → asumido (alternativa: el primero que aparezca al recorrer los núcleos). Regla: `CLAUDE.md`, nada de iteración con orden dependiente de inserción; el primero que aparece cambia si cambia el orden de un `Map`.
- **«Pasar por un núcleo» es tener al menos un beat allí** → asumido (alternativa: que el trazado lo cruce). Regla: lo que se cuenta en un núcleo aflora al pararse dentro del geofence (RF-BUCLE-006, fila 32); cruzar de largo no dispara nada y la puesta en escena se perdería.
- **El filtro de la primera aventura degrada abriendo: si ninguna candidata pasa por los dos, se ofrece la lista normal** → asumido (alternativa: no ofrecer nada hasta que aparezca una, o relajar el casting para forzarla). Regla: «Un día con una sola aventura no es un día roto» y el design system —ningún texto se disculpa—; y relajar el casting produciría una aventura que no cierra el lazo, que RF-QUEST-002 prohíbe.
- **La regla de la primera aventura se consume al aceptarla, no al terminarla, y salir a andar sin nada no la consume** → asumido (alternativas: consumirla al completar la aventura, o al componer la primera lista). Regla: `arranque.md` §2, «esto es del arranque y solo del arranque»; reimponerla tras un abandono repetiría el guion, y consumirla al componer la lista la perdería para quien ese día no salga.
- **La condición de composición, la resiembra y la regla de la primera aventura son solo del primer mapa de la partida; el prólogo corre en todos** → asumido (alternativa: componer en todos los mapas). Regla: `arranque.md` §1 dice que el mecanismo sirve para los tres arranques —partida, mapa nuevo por los bordes y mundo efímero— y §2 dice que la puesta en escena es del arranque y solo del arranque.
- **El estado del arranque se cierra por la vía de `arranque.md` §3 y solo por esa, aunque el estado admita más de una** → asumido (alternativa: implementar ya la segunda vía propuesta en el pendiente 1). Regla: `arranque.md` pendiente 1 dice «propuesta pendiente de ratificar», y `docs/prd.md` §7 lo lista como fleco abierto; implementar lo no ratificado es inventar producto.
- **Lo que el prólogo deja vive en el estado de la partida, no en el documento congelado, y su condición de «propiedad del lugar» la garantiza el determinismo** → asumido (alternativa: guardarlo con el mundo congelado, que es donde vive el árbol por el que viajan sus rumores). Regla: SPEC-009 fija que el documento de celda describe el mundo y no crece al andar, y SPEC-012 ya puso ahí lo sedimentado; que dos personas con la misma semilla oigan el mismo pasado se sostiene sobre la siembra, no sobre dónde se guarda.
- **El prólogo instancia el motor de SPEC-011 con contador propio, y el contador de la partida queda en cero** → asumido (alternativa: usar el contador de la partida y arrancar la partida en k). Regla: `arranque.md` §1, «el prólogo no es tiempo tuyo: tu contador sigue empezando en cero»; y con el contador compartido, la siembra `:tick:n` de los primeros pasos de la jugadora colisionaría con la del prólogo.
- **La cola de entregas se siembra con entradas de la forma de la fila 19, sin ningún campo que las marque como del prólogo** → asumido (alternativa: un tipo propio de entrada «de arranque»). Regla: `personaje.md` §3 dice que el precalentamiento carga la cola, no que cree otra; una entrada distinguible acabaría tratada distinto y el arranque volvería a parecer un guion.
- **El prólogo no deja ninguna aventura preparada** → asumido (alternativa: castear también en el prólogo y dejar la primera lista hecha). Regla: `personaje.md` §3 lo dice con todas las letras — «el prólogo no genera aventuras: salen de castear plantillas contra el mundo que hay».
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-012.
- **Sin `## UX Design` y sin comportamiento responsive** → asumido: esta spec no dibuja pantalla; A1P5 y A1P7 son de la fila 27 y la cartela del hito es de la fila 36 (alternativa: especificar aquí la línea de la generación y la lista del día 1). Regla: decisión 3 de `pipeline/decisiones-orquestador.md` y el design system, que prohíbe rediseñar una pantalla ya dibujada.
