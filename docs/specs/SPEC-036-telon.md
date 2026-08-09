# SPEC-036 — El telón: el mapa se entinta, la aventura acaba y lo hecho sale a andar

## Descripción

Entrega el momento que le da sentido a que en marcha no pasara nada. Durante la salida el juego no felicitó nada, no enseñó ni una cifra y no dijo que estabas descubriendo sitios: **todo eso se registró callado y se paga aquí, de una vez**. El telón se echa solo al volver al punto de partida o al dar la salida por terminada, sin notificación y sin ponerse delante; lo que espera es que lo leas, y al abrir la app es lo primero que hay.

Lo que esta fila fija, porque no se deduce de ninguna pantalla suelta, es **la secuencia y sus dos ramas**: el mapa entintado **siempre**, haya aventura o no y hayas vuelto entera o a mitad; después **el desenlace** si había aventura y la terminaste, o **el cierre en corto en su lugar** si volviste a mitad —ocupa el sitio del desenlace, no el del mapa—; después **lo que se pone en camino**, solo si el desenlace era notable y nunca detrás de un cierre en corto; y **la entrada del diario**, siempre, que cierra. Un paseo sin aventura es entonces el mapa y el diario, sin nada en medio: no es una pantalla distinta con su propio título, porque la diferencia entre un paseo y una aventura no es cómo se cierran, es que uno tiene desenlace y el otro no.

Y entrega **la capa de conocimiento**, que ninguna spec anterior toca y sin la cual el telón no tiene nada que enseñar. Cada elemento del mundo está en uno de cuatro niveles —*no lo sabes* · *lo ves* · *lo conoces* · *lo conoces bien*—, el nivel de partida lo decide la escala, y se sube de dos maneras: **con las piernas o con la boca de otro**. Un rumor puede rotularte un sitio donde no has puesto un pie. Lo importante es *cuándo* se cobra: **el conocimiento se apunta en silencio durante la salida y el entintado llega de golpe al telón**, que es lo que hace que mirar el móvil andando no aporte nada y que este momento tenga algo que enseñar. El pintado ya está preparado para recibirlo: `packages/nucleo/render/escena.js` reserva la capa 17 vacía a propósito, con el comentario de que la llena esta fila.

Lo demás son reglas de tono que se convierten en criterios. **Las tres tintas y ninguna leyenda**, porque la diferencia se ve. **El día sin descubrimientos enseña el mapa igual**, con un título que lo reconoce y suena a constatación y no a reproche —se descartó saltarse la pantalla, porque haría desaparecer el objeto central del juego justo el día en que menos apetece salir—. **El oro como cifra y el rango como frase**, que hace el trabajo de un medidor de reputación sin ser uno. **El rumor se ve salir y no se ve llegar**, y jamás se ve deformarse. Y **el hito de fin de arranque**, marcado una sola vez, cuando llegas a un núcleo donde lo que se cuenta eres tú: dice que el mundo cambió, no que el jugador aprobó.

Anclas: **RF-BUCLE-011**, **RF-BUCLE-012** y **RF-BUCLE-013** (`docs/prd.md` §4.7), **RF-MAPA-004** (§4.9), **RF-QUEST-013** (§4.2), **RF-DIARIO-005** y **RF-DIARIO-006** (§4.6, este último marcado **⚠ sin escenario**, así que sus criterios se escriben aquí por primera vez) y **RF-PROG-005** (§4.5). Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` §1, §4 y §8, `game-design/progresion.md` §1 y §2, `game-design/arranque.md` §3, y el artefacto 5 de `docs/pantallas/`, pantallas A5P1, A5P1B, A5P2, A5P2B, A5P3 y A5P4 del flujo.

Consume **SPEC-034** (la aventura en curso: cómo acabó, terminada o a medias, y con qué), **SPEC-012** (`naceRumor`, que ya sabe que un desenlace no notable y un cierre en corto no engendran ninguno), **SPEC-015** (`cierraSalidaDeProgresion`, el rango por núcleo y su tono, los objetos y el mote), **SPEC-016** (el registro de hechos, el diario y su clase «lo propio», que existe en el enumerado esperando a esta fila), **SPEC-013** (el estado del arranque, su condición de cierre y su marca única, que ya dejó dicho que «la página del diario y la cartela del hito son de la fila 36»), **SPEC-017** (el desenlace y el desenlace de repuesto de cada plantilla, con su declaración de rumor y su mote candidato), **SPEC-021** y **SPEC-026** (la lámina y la capa 17 reservada) y **SPEC-011** (los kilómetros de la salida, que ya mueven el reloj del mundo).

Y consume la **fila 30** (`rotulo-sistema`, RF-BUCLE-010), dueña de **cuándo** se cierra la salida —volver, el rótulo del sistema, o «dejarlo aquí» desde la portada—, y las **filas 28, 29 y 32**, **que no están en disco al escribir esta spec**: de ellas aquí solo se consume que existe una salida abierta con su identidad y su punto de partida. Si alguna la nombra de otra manera, manda ella y esto se ajusta por iteración. **Lo que esta fila sí entrega y ninguna otra reclama es el cierre en sí**: la operación que coordina, en una sola escritura y a todo o nada, los ganchos que cinco filas anteriores dejaron puestos esperando a alguien que los llamara.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparece el **calendario de la partida**, que dice qué día es hoy para la entrada del diario y para el día de la repisa. Está descrito en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** **cuándo** se cierra la salida y desde dónde (fila 30, RF-BUCLE-010 y RF-BUCLE-017), de la que aquí solo se consume el momento del cierre; el **rótulo persistente del sistema** y la tarjeta de a-medias de la portada (filas 30 y 28); el **mapa en marcha** con su marca y sus avisos (fila 29); la **propagación** de los rumores por las calzadas y su deformación (fila 12, ya entregada), de la que aquí solo se entrega el nacimiento visible; el **diario entero** con sus dos vistas, su triangulación y sus capítulos por mapa (fila 37, A6P2 a A6P4), del que aquí solo se entrega **la hoja de hoy**; la **repisa** y su lista de motes (fila 38, A6P5); el **pintado** de la lámina y los cinco estilos (fila 21), del que aquí solo se rellena la capa reservada; y la **segunda vía de cierre del arranque** que `arranque.md` dejó como pendiente 1 sin ratificar, que no se implementa ni se prepara.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`, y los que reproducen un escenario ya escrito llevan su nombre literal. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La secuencia del telón» y «El desenlace»; la **validación de entradas** en el cierre de una salida ya cerrada, el desenlace sin declaración de rumor y el nivel de conocimiento fuera de la escalera; el **estado vacío** en el día sin descubrimientos, el paseo sin aventura y el mapa sin ningún rumor nacido; el **estado de error** en «Nada degrada por falta de cableado» y en «El cierre es a todo o nada»; y los **casos límite** en el cierre en corto sin ningún beat resuelto, el rango que sube en dos núcleos a la vez, el hito que coincide con un cierre en corto y la salida cerrada dos veces.

«Mundo de referencia» significa uno de los ocho extractos congelados de `test/fixtures/mundos-referencia/`. «Catálogo» significa las treinta plantillas de `packages/nucleo/quests/templates.js`.

### La secuencia del telón, que es una y tiene dos ramas

- **Dado** una salida con aventura terminada y desenlace notable, **cuando** se echa el telón, **entonces** las pantallas son, en este orden: el mapa, el desenlace, lo que se pone en camino, y la entrada del diario.
- **Dado** una salida con aventura terminada y desenlace **no** notable, **cuando** se echa el telón, **entonces** son el mapa, el desenlace y la entrada del diario, y no aparece lo que se pone en camino. (Escenario «El rumor solo aparece si el desenlace era notable».)
- **Dado** un jugador que se vuelve a mitad de una aventura, **cuando** se echa el telón, **entonces** ve el mapa entintado, en lugar del desenlace ve el cierre en corto, y después la entrada del diario. (Escenario «El cierre en corto ocupa el sitio del desenlace».)
- **Dado** un jugador que salió a andar sin coger nada, **cuando** vuelve a casa, **entonces** ve el mapa y la entrada del diario, y no ve desenlace ni rumor. (Escenario «Un paseo sin aventura tiene telón completo menos desenlace».)
- **Dado** cualquiera de esas cuatro salidas, **cuando** se compara la primera pantalla, **entonces** siempre es el mapa, y **cuando** se compara la última, **entonces** siempre es la entrada del diario.
- **Dado** el paseo sin aventura, **cuando** se lee el título de su primera pantalla, **entonces** es el mismo que el de una salida con aventura: no hay una pantalla distinta con título propio para el paseo.
- **Dado** una salida cerrada, **cuando** se cierra otra vez, **entonces** falla nombrando la salida y su estado, y no vuelve a entintar nada ni a ingresar el oro dos veces.
- **Dado** el telón echado y no leído, **cuando** se abre la app dos días después, **entonces** lo primero que se ve es el telón de aquella salida. (Escenario «El telón espera a que lo leas».)
- **Dado** el telón de una salida, **cuando** se echa, **entonces** no salta ninguna notificación y la app no se pone en primer plano. (Escenario «Volver a casa cierra la salida».)

### El conocimiento se cobra al telón, no en marcha

- **Dado** un jugador que atraviesa territorio que no conocía, **cuando** mira el mapa a mitad de camino, **entonces** el mapa está como al salir de casa y solo se ha movido su marca. (Escenario «El mapa no cambia durante la salida».)
- **Dado** esa misma salida, **cuando** se compara el estado de conocimiento al salir y a mitad de camino, **entonces** es idéntico: lo que hay a mitad es una anotación pendiente y no un cambio de nivel.
- **Dado** esa misma salida, **cuando** se echa el telón, **entonces** todos los ascensos pendientes se aplican de una vez.
- **Dado** un jugador que ha descubierto dos sitios nuevos durante la salida, **cuando** se echa el telón, **entonces** el mapa muestra los dos sitios recién entintados y la lista dice de qué nivel a qué nivel han subido, en palabras del mundo. (Escenario «El mapa se entinta al echar el telón».)
- **Dado** esa lista, **cuando** se busca en ella un porcentaje, un kilómetro, un tiempo o una barra, **entonces** no hay ninguno.
- **Dado** un sitio al que se llega por primera vez, **cuando** se echa el telón, **entonces** sube a «lo conoces».
- **Dado** un sitio al que ya se conocía y al que se vuelve, **cuando** se echa el telón, **entonces** sube a «lo conoces bien», sin haber hecho nada especial allí.
- **Dado** un sitio del que llega un rumor que lo nombra y en el que no se ha estado nunca, **cuando** se echa el telón, **entonces** sube a «lo conoces»: se sube con las piernas o con la boca de otro.
- **Dado** un sitio ya en «lo conoces bien», **cuando** se vuelve a él, **entonces** no sube más: la escalera tiene cuatro escalones y el último es el último.
- **Dado** el nivel de partida de un mundo de referencia recién generado, **cuando** se consulta, **entonces** los picos, la costa, los bosques, los núcleos y las calzadas están en «lo ves» y los parajes y los servicios, en «no lo sabes».
- **Dado** un nivel de conocimiento fuera de la escalera, **cuando** se intenta aplicar, **entonces** falla nombrando el valor y enumerando los cuatro.
- **Dado** el estado de conocimiento, **cuando** se castea el catálogo, **entonces** el reparto es el mismo con conocimiento y sin él: el casting no mira lo descubierto. (Es RF-QUEST-002, y aquí se afirma desde el lado del que sí lo mueve.)

### Las tres tintas, y ninguna leyenda

- **Dado** el mapa del telón, **cuando** se recorren sus elementos, **entonces** cada uno está pintado con una de tres tintas y ninguna otra.
- **Dado** un elemento que subió de nivel en esta salida, **cuando** se pinta, **entonces** lleva la tinta de lo de hoy.
- **Dado** un elemento en «lo conoces» o «lo conoces bien» que no subió hoy, **cuando** se pinta, **entonces** lleva la tinta de lo sabido.
- **Dado** un elemento en «lo ves» o en «no lo sabes», **cuando** se pinta, **entonces** lleva la tinta de lo no sabido, a lápiz.
- **Dado** el mapa del telón, **cuando** se busca una leyenda, un rótulo de tinta o cualquier explicación de qué significa cada una, **entonces** no hay ninguna.
- **Dado** el plan de capas del render, **cuando** se pinta el telón, **entonces** la capa reservada del entintado ya no está vacía.
- **Dado** el mismo mundo pintado con las tres tintas y pintado en marcha, **cuando** se comparan los dos, **entonces** el mundo es idéntico y solo cambia el pintado: entintar no resiembra ni mueve nada.
- **Dado** un estilo cualquiera de los cinco, **cuando** se pinta el telón, **entonces** las tres tintas salen del estilo y ningún color vive en el código de dibujo. (Es RF-MAPA-001 aplicado a esta capa.)

### El día sin descubrimientos enseña el mapa igual

- **Dado** un jugador que anda su ruta de siempre sin descubrir nada, **cuando** se echa el telón, **entonces** el mapa aparece igual, el título reconoce que hoy no ha visto nada nuevo, y ningún texto se lo reprocha. (Escenario «Un día sin descubrir nada enseña el mapa igual».)
- **Dado** ese mismo telón, **cuando** se mira el mapa, **entonces** no hay ni un elemento con la tinta de lo de hoy.
- **Dado** ese mismo telón, **cuando** se lee la lista de ascensos, **entonces** está vacía y no se sustituye por ninguna disculpa.
- **Dado** el título del día flojo y el del día con descubrimientos, **cuando** se buscan en los dos las palabras del vocabulario de reproche, **entonces** no aparece ninguna.
- **Dado** un título que contuviera una de esas palabras, **cuando** se ejecuta la comprobación, **entonces** falla nombrando el título y la palabra: el criterio se puede poner rojo.
- **Dado** el día flojo, **cuando** se comprueba si el reloj del mundo avanzó, **entonces** avanzó igual: los kilómetros mueven el mundo con aventura o sin ella.

### El desenlace: el oro como cifra, el rango como frase

- **Dado** una aventura terminada, **cuando** se compone el desenlace, **entonces** lleva el texto del desenlace de su plantilla, lo que se gana en oro, los objetos que quedan, y la frase del rango.
- **Dado** ese desenlace, **cuando** se lee la cantidad de oro, **entonces** es la que declaró el desenlace y coincide con lo que la bolsa ingresó.
- **Dado** ese desenlace, **cuando** se cuentan las cifras que aparecen en toda la pantalla, **entonces** la única es la del oro.
- **Dado** ese desenlace, **cuando** se busca una barra de reputación, un contador de puntos, una experiencia o un nivel, **entonces** no hay ninguno.
- **Dado** un desenlace en el que el rango subió en un núcleo, **cuando** se lee la frase del rango, **entonces** nombra ese núcleo y dice el cambio con palabras, sin escalón escrito ni número.
- **Dado** un desenlace en el que el rango subió en más de un núcleo, **cuando** se lee, **entonces** hay **una sola frase** y nombra un solo núcleo, elegido de forma determinista.
- **Dado** un desenlace en el que el rango no se movió en ninguna parte, **cuando** se compone, **entonces** no hay frase de rango y no se sustituye por una que diga que no subió.
- **Dado** el mismo desenlace compuesto dos veces con el mismo estado, **cuando** se comparan, **entonces** son idénticos, frase de rango incluida.
- **Dado** un objeto que el desenlace entrega, **cuando** se compone la pantalla, **entonces** aparece con de quién viene y no como requisito de nada. (Es RF-PROG-006 visto desde aquí.)

### El cierre en corto

- **Dado** una aventura cerrada a mitad **sin haber conseguido nada**, **cuando** se compone el cierre en corto, **entonces** el texto es el de repuesto que cuenta cómo acabó sin ti.
- **Dado** una aventura cerrada a mitad **habiendo conseguido algo**, **cuando** se compone, **entonces** el texto es el de repuesto que cierra con lo que sí se consiguió.
- **Dado** todas las plantillas del catálogo, **cuando** se comprueban sus desenlaces de repuesto, **entonces** las treinta traen los dos textos, y una que no los trajera hace fallar la carga del catálogo nombrándola.
- **Dado** los sesenta textos de repuesto del catálogo, **cuando** se buscan en ellos las palabras del vocabulario de reproche, **entonces** no aparece ninguna.
- **Dado** una aventura cerrada en corto, **cuando** el mundo avanza diez pasos, **entonces** no existe ningún rumor sobre ella en ningún núcleo. (Escenario «Un cierre en corto no genera rumor».)
- **Dado** una aventura cerrada en corto cuya plantilla declara su desenlace **notable**, **cuando** se echa el telón, **entonces** tampoco nace rumor: manda el cierre en corto sobre la declaración.
- **Dado** un cierre en corto, **cuando** se recorre la secuencia del telón, **entonces** después viene la entrada del diario y nunca lo que se pone en camino.
- **Dado** una aventura cerrada en corto con **cero** beats resueltos, **cuando** se echa el telón, **entonces** el cierre en corto aparece igual, con el texto de cómo acabó sin ti.
- **Dado** un cierre en corto, **cuando** se mira si el mapa se entintó, **entonces** se entintó igual: volverse a mitad no anula lo andado.

### El rumor se ve salir, no llegar

- **Dado** un desenlace notable, **cuando** aparece la pantalla de lo que se pone en camino, **entonces** se ve que algo ha salido del núcleo, pero no se ve a qué núcleos llegará, ni cuándo, ni con qué nivel. (Escenario «El telón no enseña la propagación».)
- **Dado** esa pantalla, **cuando** se inspecciona lo que se le entregó para pintar, **entonces** lleva el núcleo de origen y nada más: ni destinos, ni saltos, ni nivel, ni el árbol de calzadas.
- **Dado** esa pantalla, **cuando** se buscan en ella las palabras del vocabulario de propagación, **entonces** no aparece ninguna.
- **Dado** el rumor recién nacido, **cuando** se consulta su nivel en el estado, **entonces** existe y es cero, y ninguna proyección de pantalla lo lleva dentro.
- **Dado** el rumor recién nacido y el mismo mundo dos veces con la misma semilla, **cuando** se comparan, **entonces** nacen iguales. (Bloqueante, `@determinismo`, RNF-DET-003.)

### La entrada del día

- **Dado** cualquier telón, **cuando** llega a su última pantalla, **entonces** hay una entrada del diario y cierra el telón.
- **Dado** una salida con aventura y con algo oído por el camino, **cuando** se compone la entrada, **entonces** lo propio va en primera persona y lo oído va aparte y entrecomillado.
- **Dado** esa entrada, **cuando** se comparan las dos partes, **entonces** tienen distinta autoridad declarada: lo que se hizo se sabe, lo que contaron no.
- **Dado** una versión oída y deformada, **cuando** se apunta, **entonces** queda como se oyó y el nivel de deformación no aparece en la entrada. (Es RF-DIARIO-001, ya entregado, y aquí se afirma desde la hoja de hoy.)
- **Dado** un día en el que se oye la versión buena de algo ya apuntado torcido, **cuando** se compone la entrada, **entonces** conviven las dos y ninguna se marca como la correcta.
- **Dado** un paseo sin aventura y sin nada oído, **cuando** se compone la entrada, **entonces** existe igual y dice lo que se anduvo en palabras del mundo, sin cifras.
- **Dado** la entrada del día escrita, **cuando** se abre el diario entero, **entonces** está allí, en el día que corresponde. (Arista A5P4 → A6P2.)
- **Dado** la clase «lo propio» del diario, **cuando** se consulta quién la escribe, **entonces** la escribe esta capa y solo esta.

### El hito de fin de arranque

RF-DIARIO-006 está marcado **⚠ sin escenario** en el PRD: estos criterios lo cubren.

- **Dado** un jugador que llega a un núcleo donde lo que allí se cuenta es él, **cuando** se echa el telón de esa salida, **entonces** aparece la cartela del hito y queda una página del diario.
- **Dado** ese mismo jugador, **cuando** juega veinte salidas más, **entonces** la cartela no vuelve a aparecer ni una vez.
- **Dado** el texto de la cartela y el de la página, **cuando** se buscan en ellos las palabras de la escalera de logro —*tutorial*, *completado*, *nivel*, *logro*, *desbloqueado*, *enhorabuena*, *dominas*—, **entonces** no aparece ninguna.
- **Dado** un texto del hito que contuviera una de esas palabras, **cuando** se ejecuta la comprobación, **entonces** falla nombrando el texto y la palabra.
- **Dado** el texto de la cartela, **cuando** se lee, **entonces** dice que el mundo cambió y no que el jugador aprobó.
- **Dado** un hito que coincide con una salida cerrada en corto, **cuando** se echa el telón, **entonces** la cartela aparece igual: el hito es del mundo y no del desempeño.
- **Dado** el estado del arranque ya cerrado, **cuando** se reconstruye la partida desde el registro de hechos, **entonces** sigue cerrado y la cartela no se vuelve a enseñar.
- **Dado** un jugador cuyo arranque no ha cerrado, **cuando** se echa cualquier telón, **entonces** no aparece ninguna cartela ni ninguna insinuación de que falte algo por llegar.

### El cierre es a todo o nada

Misma forma que `cierraSalidaDeProgresion` de SPEC-015 y que el cierre de la capa de NPCs de SPEC-014: se valida y se calcula todo primero, y solo cuando no queda nada que pueda fallar se escribe.

- **Dado** un cierre de salida en el que una de las escrituras falla, **cuando** se ejecuta, **entonces** ni el conocimiento, ni la bolsa, ni la repisa, ni los motes, ni el diario, ni los rumores han cambiado.
- **Dado** ese mismo fallo, **cuando** se lee el error, **entonces** nombra qué pieza no encajó.
- **Dado** un cierre correcto, **cuando** se mira el registro de hechos, **entonces** los hechos de todas las áreas que tocó están anexados, y el estado va detrás del registro y no delante.
- **Dado** una partida cerrada y guardada, **cuando** se congela y se vuelve a levantar, **entonces** el conocimiento vuelve idéntico, elemento a elemento.
- **Dado** una partida, **cuando** se reconstruye desde el registro, **entonces** el conocimiento se reproduce en lugar de declararse no reproducible.
- **Dado** dos partidas con la misma semilla y las mismas entradas, **cuando** se cierran las mismas salidas, **entonces** los dos estados son idénticos byte a byte. (Bloqueante, `@determinismo`, RNF-DET-003.)

### Nada degrada por falta de cableado

Aplicación directa de `pipeline/decisiones-orquestador.md` §6h.

- **Dado** el cierre de salida sin el nacimiento de rumor cableado, **cuando** se ejecuta con un desenlace notable, **entonces** falla nombrando la pieza, y no cierra la salida sin que salga nada.
- **Dado** el cierre sin la progresión cableada, **cuando** se ejecuta, **entonces** falla nombrando la pieza, y no entrega un desenlace sin oro.
- **Dado** el cierre sin el diario cableado, **cuando** se ejecuta, **entonces** falla nombrando el diario, y no echa un telón sin entrada.
- **Dado** el cierre sin el calendario cableado, **cuando** se ejecuta, **entonces** falla nombrando el calendario, y no apunta el día cero.
- **Dado** el pintado del telón sin el estado de conocimiento cableado, **cuando** se pinta, **entonces** falla nombrando el estado, y no pinta todo con la tinta de lo no sabido.
- **Dado** el cierre de salida, **cuando** se inspecciona qué recibió, **entonces** recibió la aventura en curso de la fila 34 con su declaración de cómo acabó, y no un booleano de «terminada».

## UX Design

### Wireframe textual

**El mapa se entinta — A5P1.** Pantalla completa, voz del mundo. De arriba abajo: el **rótulo de situación** en versalitas —«Ya estás en casa»—; el **título** en serif grande —«Hoy has ensanchado el mapa»—; la **lámina** ocupando el grueso de la pantalla, con las tres tintas puestas y **sin leyenda**, en la que se leen los nombres de lo que subió; la **lista de ascensos** debajo, una línea por elemento con su **nombre** y, a la derecha, **a qué nivel ha subido en palabras del mundo** —«lo conoces», «lo conoces bien», «entero»—; y abajo, ocupando el ancho, **«Seguir»**. Ni una cifra en toda la pantalla.

**Cuando no descubriste nada — A5P1B.** La misma pantalla, con el título cambiado —«Hoy no has visto nada que no supieras»—, la lámina sin una sola tinta de hoy, la lista de ascensos sustituida por los **nombres de los sitios por los que se pasó**, sin nivel a la derecha, y una línea de cierre que sitúa el día sin juzgarlo —«Andaste por sitios tuyos. El mundo, mientras, anduvo lo suyo.»—. La acción es la misma.

**El desenlace — A5P2.** De arriba abajo: el **título de la aventura** en versalitas; el **titular del desenlace** en serif grande —«Acabó como acaban estas cosas»—; el **párrafo del desenlace**, que es el texto que el LLM escribió antes de salir o el de la plantilla; el **bloque de lo que se gana**, en dos partes: el **oro** como cantidad con su renglón de detalle —«Once monedas · y una comida»— y los **objetos**, uno por línea, con su renglón de procedencia —«La llave del molino viejo · dice que la vas a necesitar»—; la **frase del rango**, en serif y en una línea —«En Monfrida ya saben quién eres. En el resto del mapa, todavía no.»—; y abajo, **«Seguir»**.

**El cierre en corto — A5P2B, en el sitio de A5P2.** Misma composición, con el titular cambiado —«Se resolvió sin ti»—, el párrafo del desenlace de repuesto, el bloque de lo que se gana reducido a lo que se llegó a conseguir, y **sin frase de rango si no se movió**. Cierra con una línea que reconoce el día sin reprocharlo —«Y hoy has andado, que es lo que mueve el mundo.»— y la misma acción.

**Lo que se pone en camino — A5P3.** De arriba abajo: el **rótulo** en versalitas —«Y ahora»—; el **titular** en serif grande, que dice qué se cuenta y dónde —«Lo de la caja ya se cuenta en Monfrida»—; una **línea de consecuencia** —«De ahí sale por donde salen estas cosas. Tú ya no puedes hacer nada.»—; un **fragmento de la lámina** centrado en el núcleo de origen, con su nombre y con la marca de que algo sale de él, **sin ninguna línea hacia ningún otro sitio, sin flechas de dirección y sin más núcleos rotulados**; una **línea de espera** —«Ya te enterarás de cómo lo cuentan.»—; y abajo, **«Seguir»**.

**La entrada del día — A5P4.** De arriba abajo: el **rótulo** en versalitas —«Tu diario»—; el **día** —«Jueves · el día 23»—; el **título de la hoja**, que es el de la aventura o el del día si no la hubo; el bloque de **lo propio**, en serif y en primera persona; el bloque de **lo oído**, separado, entrecomillado y con distinta autoridad visible; y abajo, **dos acciones**: **«Ver el diario entero»**, que lleva al artefacto 6, y **«Cerrar»**, que devuelve a la portada.

**La cartela del hito.** No es una pantalla más de la secuencia: es una **capa** que aparece **una sola vez**, entre el desenlace y el diario, con el fondo del papel, un filete, y dos o tres líneas en serif que dicen que ahora hay quien cuenta cosas de ti. Se cierra tocando, y la secuencia sigue donde estaba. La página que deja en el diario es parte de la entrada de ese día.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec entrega:
  A5P1   pantalla 1 · artefacto 5 — El mapa se entinta
  A5P1B  pantalla 1B · artefacto 5 — Cuando no descubriste nada
  A5P2   pantalla 2 · artefacto 5 — El desenlace
  A5P2B  pantalla 2B · artefacto 5 — El cierre en corto
  A5P3   pantalla 3 · artefacto 5 — Lo que se pone en camino
  A5P4   pantalla 4 · artefacto 5 — La entrada del día

Pantallas que alimenta por debajo, sin ser su dueña:
  A6P1  pantalla 1 · artefacto 6 — La portada, sin barra  (dueña: fila 28)
  A6P2  pantalla 2 · artefacto 6 — El diario, por días    (dueña: fila 37)
  A6P5  pantalla 5 · artefacto 6 — La repisa              (dueña: fila 38)

Elementos del proyecto que se usan: la lámina y sus cinco estilos, la cartela, el
filete, la placa de pergamino, la tipografía serif de la voz del mundo.

Elementos nuevos:
  · Las tres tintas — tres claves de estilo para la capa 17 del plan de capas, que
    SPEC-021 dejó reservada vacía nombrando a esta fila.
  · La cartela del hito — capa de una sola aparición, sin acción más que cerrarse.
```

### data-testid

Los dos que `design-system.md` pide siempre son el estado del momento y el mapa, y los dos son aquí de primera importancia:

- `telon-estado` — el estado del momento, con un valor de un vocabulario cerrado: `mapa`, `mapa-sin-tinta`, `desenlace`, `cierre-en-corto`, `rumor`, `diario`
- `telon-mapa` — la lámina del telón, sobre la que se afirman las tintas
- `telon-ascensos` — la lista de ascensos, para afirmar que está y que puede estar vacía
- `telon-titulo` — el título de la primera pantalla, que es lo que cambia el día flojo
- `desenlace-oro` — la cantidad de oro
- `desenlace-rango` — la frase del rango, ausente cuando no se movió
- `desenlace-objetos` — el bloque de objetos
- `rumor-sale` — el fragmento de lámina de A5P3, para afirmar qué lleva y qué no
- `diario-del-dia` — la entrada del día
- `diario-lo-propio` y `diario-lo-oido` — los dos bloques con distinta autoridad
- `hito-arranque` — la cartela del hito, para afirmar que aparece una vez y no vuelve

Sin más: los títulos, los párrafos, los nombres de sitio y las líneas de cierre son texto único dentro de sus contenedores.

### Patrón de interacción

- **Una sola acción por pantalla y siempre hacia delante.** Regla: `bucle-jugable.md` §8, el telón es una secuencia y no un menú; no hay flecha de volver en ninguna de las seis, porque el telón se lee una vez y lo que quede por consultar vive en el diario.
- **La secuencia no se puede saltar, pero tampoco atrapa.** Regla: `design-system.md`, el momento del telón es de pantalla permitida; la última pantalla ofrece cerrar y también ir al diario entero, que son las dos salidas naturales, y ninguna pantalla intermedia ofrece salir para no partir la lectura por la mitad.
- **Las tres tintas se ven y no se explican.** Regla: `bucle-jugable.md` §8, «sin leyenda, porque la diferencia se ve»; una leyenda convertiría el mapa ganado en un cuadro de mandos, que es la clase de pantalla que `design-system.md` prohíbe entera.
- **El día flojo cambia el título y no la pantalla.** Regla: `bucle-jugable.md` §8, se descartó saltarse la pantalla; y la línea se escribe como constatación, la misma cuerda floja que el ajuste del tramo, que tampoco se comenta jamás.
- **El oro es un dato con su cifra, no un marcador que sube.** Regla: `progresion.md` §1, el oro se gasta y sin verlo no se puede decidir en qué; por eso aparece como cantidad ganada y no como saldo total con animación de incremento, que sería exactamente la barra que el juego se niega a tener.
- **El rango es una frase y nunca una lista.** Regla: `progresion.md` §1, «una pantalla que enumerase tus tres escalones en cada pueblo sería la barra que este apartado se niega a tener, solo que escrita con palabras»; de ahí que sea una sola frase aunque el rango se haya movido en dos sitios.
- **El rumor se pinta saliendo y el fragmento de mapa no tiene destino.** Regla: `quests.md` decisión 3 y `bucle-jugable.md` §8; cualquier línea, flecha o segundo núcleo rotulado sería el panel del estado del mundo que la portada se negó a tener.
- **La cartela del hito interrumpe una vez y no pide nada.** Regla: `arranque.md` §3, se marca narrativamente y una sola vez; sin acción propia, sin «aceptar» y sin quedar en ningún sitio consultable, porque un hito consultable es un logro.
- **Decisión no cubierta por el design system:** dónde va la cartela del hito dentro de la secuencia. Se resuelve **entre el desenlace y el diario**, porque el hito habla de lo que el mundo dice de ti y eso es lo que acaba de contar el desenlace; ponerla delante del mapa la convertiría en la protagonista del telón y detrás del diario llegaría cuando ya se cerró.
- **Decisión no cubierta por el design system:** cuánto de la lámina se ve en A5P3. Se resuelve con **un fragmento centrado en el núcleo de origen** y no con la lámina entera, porque la lámina entera invita a buscar hacia dónde va el rumor, que es exactamente lo que la decisión prohíbe enseñar.

## Notas técnicas

### Frontera de inyección

Una entrada nueva, con doble en Node:

1. **Calendario de la partida** — devuelve qué día es hoy, un entero no negativo, el mismo con el que ya cuentan el diario y la repisa. Está inyectado porque el paquete no lee el reloj del sistema, y es la razón por la que `cierraSalidaDeProgresion` y `entradaDeDiario` reciben hoy el día como argumento sin que nadie se lo diera. Dobles: uno fijo y uno que avanza.

Lo demás **ya está cableado por otras filas y aquí solo se coordina**: el nacimiento del rumor (SPEC-012), la progresión (SPEC-015), el diario y el registro (SPEC-016), el estado del arranque (SPEC-013) y el motor de pasos (SPEC-011).

### La capa de conocimiento

Es lo que esta fila añade al paquete, y es capa sobre el mundo generado, como el motor de pasos y la propagación: **no toca la tubería, no importa ninguna fase de generación y no puede resembrar nada**.

- **Cuatro niveles**, catálogo cerrado y ordenado: *no lo sabes* · *lo ves* · *lo conoces* · *lo conoces bien*. Un nivel fuera del catálogo falla nombrándolo.
- **El nivel de partida lo decide la escala**, no la partida: lo que se ve de lejos nace en «lo ves» —picos, costa, bosques, núcleos y calzadas— y lo pequeño en «no lo sabes». Se deriva del mundo congelado y no se guarda elemento a elemento; **el estado guarda solo lo que ha subido**, que es lo que hace que la partida no crezca con el tamaño del mapa.
- **Dos vías de ascenso y ninguna más**: haber estado —que es lo que apunta la fila 33 al mirar un sitio— y que un rumor lo nombre —que es lo que ya sedimenta SPEC-012—. Volver a un sitio ya conocido sube al último escalón.
- **Un libro de pendientes por salida.** Durante la salida los ascensos se apuntan y no se aplican; `echaElTelon` los aplica todos de una vez. Eso es lo que hace comprobable «el mapa no cambia durante la salida» sin depender de que nadie se acuerde de no pintar.
- **Un área nueva del estado**, declarada con `declaraArea` como las quince que ya hay, con su esquema, su congelado, su levantado y su reproducción desde hechos, y con su tipo de hecho propio para el ascenso. No sube la versión de formato: la vía canónica de SPEC-016 existe precisamente para esto.

### Las tres tintas y la capa 17

`packages/nucleo/render/escena.js` declara el plan de capas como dato y reserva la número 17, `entintado`, vacía, con el comentario de que la llena esta fila «en lugar de reabrir el orden». Aquí se llena, y las tres tintas entran como **claves de estilo** —una por tinta— en el objeto de datos de cada uno de los cinco estilos, de modo que ningún color viva en el código de dibujo. La correspondencia entre nivel y tinta es de esta fila y va escrita como dato: subió hoy → la tinta de hoy; «lo conoces» o «lo conoces bien» sin subir hoy → la de lo sabido; «lo ves» o «no lo sabes» → la de lo no sabido.

### El cierre de la salida, que es lo que nadie reclamaba

Cinco filas dejaron ganchos con forma de cierre esperando a que alguien los llamara: `cierraSalidaDeProgresion` (SPEC-015), el cierre de la cola de entregas (SPEC-019), el cierre de la capa de NPCs (SPEC-014), `naceRumor` (SPEC-012) y el apunte del diario (SPEC-016). Ninguna spec los coordina. Esta lo hace, con la misma forma que todos ellos: **se valida y se calcula entero, y solo cuando no queda nada que pueda fallar se escribe**. El orden es el de SPEC-016 —registro, estado, marca de aplicación— y la secuencia interna es: aplicar el conocimiento pendiente, resolver cómo acabó la aventura, ingresar la progresión, hacer nacer el rumor si procede, apuntar el diario y cerrar el arranque si toca.

Y una frontera que conviene decir en voz alta: **esta fila no decide cuándo se cierra la salida**. Eso es de la fila 30. Aquí se decide qué pasa cuando se cierra.

### Los vocabularios que hacen comprobables los tonos

Tres listas cerradas, escritas como dato, cada una con su comprobación sobre todos los textos que la capa produce:

- **Reproche**, para el título del día flojo, el cierre en corto y sus sesenta textos de repuesto: *no llegaste*, *te volviste*, *abandonaste*, *dejaste*, *poco*, *deberías*, *podrías haber*, *la próxima vez*, *inténtalo*.
- **Propagación**, para la pantalla del rumor: *llegará*, *llegar a*, *dentro de*, *saltos*, *nivel*, *abultado*, *trastocado*, *leyenda*, *fiel*, *deformación*, y cualquier nombre de núcleo que no sea el de origen.
- **Logro**, para el hito: *tutorial*, *completado*, *nivel*, *logro*, *desbloqueado*, *enhorabuena*, *dominas*, *aprendiste*.

Son lo que convierte tres reglas de tono en criterios que pueden ponerse rojos, que es la diferencia entre una regla y una intención.

## Decisiones asumidas

- **Esta fila entrega la capa de conocimiento entera, que el checklist no nombra** → asumido (alternativa: dejarla a la fila 29, que pinta el mapa en marcha). Regla: RF-BUCLE-012 y RF-MAPA-004 están los dos en esta fila, y el conocimiento se cobra aquí; la fila 29 pinta con el estado que haya y no lo mueve, que es justo lo que su criterio «el mapa no cambia durante la salida» exige.
- **El estado guarda solo los ascensos, y el nivel de partida se deriva del mundo** → asumido (alternativa: guardar el nivel de cada elemento). Regla: RNF de tamaño de la partida y la forma de SPEC-016; guardar un nivel por elemento haría crecer la partida con el mapa y duplicaría un dato que el documento congelado ya determina.
- **La correspondencia entre cuatro niveles y tres tintas es «subió hoy / sabido / no sabido»** → asumido (alternativa: una tinta por nivel, que serían cuatro). Regla: `bucle-jugable.md` §8 dice tres tintas y las nombra; y con cuatro habría que explicar la diferencia entre «lo conoces» y «lo conoces bien» en el mapa, que es exactamente la leyenda que la decisión prohíbe.
- **La frase del rango nombra un solo núcleo aunque el rango se haya movido en varios** → asumido (alternativa: una frase por núcleo). Regla: `progresion.md` §1, una lista de pueblos sería la barra escrita con palabras; el desempate es determinista —el escalón más alto, y a igualdad el orden canónico del mapa— para que la pantalla no dependa del orden de iteración.
- **El texto de repuesto se elige por si se consiguió algo, no por cuántos beats se resolvieron** → asumido (alternativa: un umbral de beats). Regla: `bucle-jugable.md` §4, «dos líneas contando cómo acabó sin él, o cerrando con lo que sí consiguió»; un umbral inventaría una cifra que la plantilla no declara.
- **Un cierre en corto no genera rumor aunque su plantilla declare el desenlace notable** → asumido (alternativa: dejar mandar la declaración). Regla: RF-QUEST-013 y `bucle-jugable.md` §4, nadie comenta que el jugador no fuese; el código de SPEC-012 ya lo cumple y aquí se afirma para que no se pueda romper por el otro lado.
- **La cartela del hito va entre el desenlace y el diario, y no deja nada consultable fuera de la página del diario** → asumido (alternativa: una sección propia en el diario o en la repisa). Regla: `arranque.md` §3, se marca narrativamente y nunca como un «tutorial completado»; algo consultable con su propio sitio es un logro con otro nombre.
- **La entrada del día existe también en un paseo sin nada oído ni hecho** → asumido (alternativa: no escribirla). Regla: RF-DIARIO-005, «cierra todo telón»; y el diario es la otra cara del mapa, así que un día sin hoja sería un día que no pasó.
- **El telón no se puede saltar pero tampoco atrapa: la última pantalla ofrece dos salidas** → asumido (alternativa: una sola). Regla: la arista A5P4 → A6P2 del flujo existe y hay que honrarla; y quien acaba de leer que le contaron algo torcido va a querer el diario, no la portada.
- **La entrada de la fila 30 llega como el momento del cierre y esta fila no lo detecta** → asumido (alternativa: detectar aquí la vuelta a casa). Regla: RF-BUCLE-010 está asignado a la fila 30; detectarlo aquí duplicaría la lógica de geofence del punto de partida y metería la ubicación en una capa que no la necesita.
