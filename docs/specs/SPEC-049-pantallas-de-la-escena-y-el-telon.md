# SPEC-049 — Las pantallas de la escena y el telón, y el cableado que las alcanza

## Descripción

Entrega las ocho pantallas que dos filas cerraron `done` sin escribir **ni una línea de `app/`**: la escena de un beat y lo que te llevas (A4P3 y A4P4, de SPEC-034) y la secuencia entera del telón (A5P1, A5P1B, A5P2, A5P2B, A5P3 y A5P4, de SPEC-036). Son las dos únicas filas de B5 y B6 que entregaron paquete y no pantalla, y por eso esta fila no cablea lo que existe —eso fue la 43 y la 44—: aquí se escriben las pantallas desde cero contra un núcleo entero, probado y en verde.

Y entrega **la mitad que las hace alcanzables, que es el cableado**. Medido con grep antes de escribir esto: nadie desde `app/` llama a `echaElTelon`, a `componeElTelon`, a `componeEscena`/`componeLoQueTeLlevas` de `quests/escena.js`, a `componeElDesenlace`, ni a **nada** de `packages/nucleo/partida/aventura-en-curso.js`. Sus únicos consumidores están en `test/nucleo/`. Con las pantallas escritas y sin ese cableado, la escena no tendría beat que pintar y el telón no tendría desenlace, ni oro, ni rumor, ni tinta: sería la decimotercera aparición de `pipeline/decisiones-orquestador.md` §6h, cometida por la fila que existe para cerrarla.

Lo tercero, y es lo que ninguna de las dos filas anteriores podía ver: **el camino entero ya está escrito y probado en Node**. `test/nucleo/bucle-completo.test.mjs` recorre una salida de punta a punta —acepta la aventura casteada, anda su lazo parándose en cada beat, atiende las escenas que esperan, resuelve los beats, compone el desenlace con `componeElDesenlace` + `repuestoDe` y echa el telón con `echaElTelon` + `piezasDeSerie()`— sobre las 102 aventuras de los cuatro mundos de referencia. **Ese fichero es el guion de lo que la app tiene que hacer**, y esta spec se apoya en él en lugar de inventar otra tubería.

Anclas: **RF-QUEST-004** y **RF-BUCLE-011**, que le llegan declarados por escrito desde la fila 44 (`docs/checklist.md`, fila 84, y SPEC-044 §«Los dos RF que esta fila no entrega»); más **RF-PJ-009**, **RF-BUCLE-012** y **RF-BUCLE-013**. Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` §4, §8 y §9, `game-design/quests.md` §2 y decisión 3, `game-design/personaje.md` §4, `game-design/lenguaje.md`, los artefactos 4 y 5 de `docs/pantallas/` y el diagrama de `docs/flujo.md`, cuyas aristas de A5 son decisiones de diseño cerradas y no se reinterpretan aquí.

Consume, sin rediseñarlo: **SPEC-034** (`quests/escena.js` y `partida/aventura-en-curso.js`), **SPEC-036** (`partida/telon.js`, `partida/cierre-de-salida.js` y `partida/conocimiento.js`), **SPEC-010** (el beat casteado y el casting determinista), **SPEC-017** (los textos y los dos repuestos de cada plantilla), **SPEC-028** (`partida/salida-abierta.js` y la aceptación de una entrada de la lista), **SPEC-030** (`partida/salidas.js`: las cuatro situaciones, el telón que espera y la marca de leído), **SPEC-032** y **SPEC-044** (la máquina de una salida, la secuencia de una llegada y su paso de beat), **SPEC-047** (la partida en disco y sus cortes) y el arreglo de **§6v** (`quests/desenlace.js`, que sí existe).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**, por cuatro sitios: el **reloj de pared** de SPEC-034, el **calendario de la partida** de SPEC-036, la **plantilla del catálogo** de la aventura aceptada y el **paquete de idioma** del mapa. Está descrito en «Frontera de inyección». Los cuatro entran por `app/nucleo/piezas.js`, como las nueve filas anteriores (§6u).
- **Ninguna dependencia nueva.** Esta fila se monta sobre lo que ya hay. Si al implementar apareciera una, **no se mete**: se para y se dice, con el nombre de la dependencia y de la pieza que la pedía.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el **zurrón y la fuente de salud** (fila 46); la **siembra de partida jugada en el dispositivo** (fichada en §6z, sin dueño); el **lector de recursos binarios del visor**, que no tiene fila y del que esta spec solo declara que la escena **no puede depender de él**; el **diario entero** con sus dos vistas (fila 37, A6P2 a A6P4), del que aquí solo se usa la arista A5P4 → A6P2 que ya existe; la **repisa** y la **pantalla de ajustes** con sus filas de valor (fila 38, A6P5 y A6P6), de la que aquí solo se consume la escala de tamaño de texto que `quests/escena.js` ya declara; la **composición** de las ocho pantallas, que la escriben `quests/escena.js` y `partida/telon.js` y aquí solo se pinta; y el **motor de pasos de la partida** (`creaMotorDeLaPartida`), que tampoco tiene llamador en `app/` y cuya ausencia se ficha en «Fronteras y huecos, con dueño» en vez de resolverse de paso.

## Criterios de aceptación

Van en `Dado / cuando / entonces`, el mismo Gherkin español de `docs/testing.md`, y los que reproducen un escenario ya escrito llevan su nombre literal. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La escena de un beat en pantalla», «Lo que te llevas» y «La secuencia del telón en pantalla»; la **validación de entradas** en el tamaño de letra fuera de la escala, el beat que no es el que toca y el telón que se pide dos veces; el **estado vacío** en el paseo sin aventura, el día sin descubrimientos y la escena sin cara; el **estado de error** en «Nada degrada por falta de cableado» y en la llegada cuyo beat viene nulo; y los **casos límite** en la app cerrada a mitad de escena, la app cerrada a mitad de telón, las dos llegadas encadenadas sin pasar por el mapa y el hito que coincide con un cierre en corto.

Los criterios de **`@determinismo` y `@privacidad` son bloqueantes**: nada se entrega con uno en rojo.

Casi todo se afirma en `@nucleo` sobre los cuatro mundos de referencia y las secuencias de posiciones que ya usa `test/nucleo/bucle-completo.test.mjs`. Lo que necesita dispositivo está marcado y es poco: que la escena tenga una sola acción tocable, que el tamaño de letra recorra la escala con toques, y que el telón se recorra entero con el dedo hasta poder abrir otra salida.

«Catálogo» significa las treinta plantillas de `packages/nucleo/quests/templates.js`. «Mundo de referencia» significa uno de los extractos congelados de `test/fixtures/mundos-referencia/`.

### La escena de un beat en pantalla — A4P3

- **Dado** una llegada cuyo paso vigente es un beat, **cuando** se monta, **entonces** lo que se ve es la escena y no el hueco declarado que dejó la fila 44.
- **Dado** esa escena, **cuando** se enumeran sus elementos, **entonces** están el nombre de fantasía del sitio, el titular del tipo de escena, la línea de situación, el cuerpo del texto y el cierre por resultado, exactamente como los compone `componeEscena`.
- **Dado** esa escena, **cuando** se cuentan sus acciones tocables, **entonces** hay exactamente una, y su rótulo es el verbo que declara el marco de la escena y nunca «Continuar». *(Escenario «El visor es una capa y debajo está el beat», en su mitad de escena; `@app` para lo tocable.)*
- **Dado** un beat con una cara del reparto, **cuando** se compone la escena, **entonces** se ven el nombre y el puesto de quien habla y su parlamento entrecomillado.
- **Dado** un beat cuya escena no tiene a nadie, **cuando** se compone, **entonces** el bloque de la cara no existe, el cuerpo se pinta como párrafo y ningún otro elemento cambia de sitio.
- **Dado** cualquier escena, **cuando** se busca un retrato de la cara, **entonces** no hay ninguno.
- **Dado** cualquier escena, **cuando** se busca una flecha de volver, una barra, una segunda acción o un salto al paso siguiente, **entonces** no hay ninguno: lo que `LO_QUE_LA_ESCENA_NO_LLEVA` enumera se puede poner rojo elemento a elemento.
- **Dado** un beat con disparador de franja resuelto fuera de ella, **cuando** se pinta la escena, **entonces** no hay ni aviso de franja ni reloj en pantalla, y lo único distinto es qué variante se lee.
- **Dado** un beat con disparador `con_objeto`, **cuando** se pinta la escena por cualquiera de sus dos vías, **entonces** no hay candado, ni «necesitas», ni lista de requisitos.
- **Dado** la escena en pantalla, **cuando** se enumeran sus elementos y el registro de cada uno, **entonces** el único de registro de aplicación es el ajuste de tamaño de letra y todo lo demás es voz del mundo.
- **Dado** la escena, **cuando** se toca el ajuste de tamaño de letra, **entonces** el texto cambia de tamaño en el sitio, sin abrir panel, sin recargar nada y sin salir de la escena. *(`@app`.)*
- **Dado** el ajuste tocado tantas veces como escalones tiene la escala más una, **cuando** se lee el escalón vigente, **entonces** es el de origen: el recorrido es cíclico.
- **Dado** un escalón elegido, **cuando** se sale de la escena y se entra en otra, **entonces** sigue puesto.
- **Dado** un tamaño de letra fuera de la escala declarada, **cuando** se aplica, **entonces** falla nombrando el valor y la escala entera.
- **Dado** la etiqueta y la ayuda del ajuste, **cuando** se leen, **entonces** no aparece ninguna mención de accesibilidad, de dificultad de lectura ni de modo alguno.
- **Dado** cualquier texto que la escena pinta, **cuando** se busca en él una cifra, **entonces** no hay ninguna.

### Lo que te llevas — A4P4

- **Dado** la escena resuelta, **cuando** se toca su única acción, **entonces** lo siguiente que se ve es lo que te llevas, y no el mapa ni ninguna pantalla anterior. *(Arista `A4P3 → A4P4` de `docs/flujo.md`.)*
- **Dado** esa pantalla, **cuando** se enumeran sus elementos, **entonces** están el rótulo «Llevas encima», lo que se lleva, el párrafo que empuja al siguiente y —salvo en el último beat— el nombre del sitio siguiente con su línea de calzadas y su marca.
- **Dado** el último beat de la cadena, **cuando** se compone lo que te llevas, **entonces** no hay bloque de sitio siguiente y la acción es la misma.
- **Dado** esa pantalla, **cuando** se busca cualquier cifra —cuánto falta, cuántos beats quedan, cuánto oro se lleva—, **entonces** no hay ninguna.
- **Dado** lo que te llevas en un sitio que es un núcleo, **cuando** se toca «Seguir andando», **entonces** el paso siguiente es lo que allí se cuenta. *(Aristas `A4P4 → NUCLEO → A4P5`.)*
- **Dado** lo que te llevas en un sitio que no es un núcleo, **cuando** se toca «Seguir andando», **entonces** se vuelve al momento en marcha. *(Arista `NUCLEO → A3P1`.)*
- **Dado** un tramo del guiado sin nombre propio, **cuando** se pinta la línea de calzadas, **entonces** simplemente no se nombra, y ningún texto lo llama falta.

### La aventura en curso, cableada en la app

Es lo que hoy no existe y sin lo cual A4P3 no tiene beat que pintar.

- **Dado** una entrada de la lista de hoy que se acepta, **cuando** se acepta, **entonces** queda una aventura en curso en el estado, con su cadena de beats casteada, su beat en curso puesto en el primero y su hecho `aventura-aceptada` anexado.
- **Dado** una aventura en curso y una llegada cuyo paso vigente es su beat, **cuando** se cierra ese paso, **entonces** el beat queda resuelto y el beat en curso pasa a ser el siguiente.
- **Dado** una llegada que ofrece un beat que **no** es el que toca, **cuando** se recorre, **entonces** el beat se queda esperando a la llegada que sí le toque y la app no falla, con el mecanismo que `partida/llegadas.js` ya trae y sin reimplementarlo.
- **Dado** la misma escena compuesta dos veces por cerrarse y abrirse la app, **cuando** se resuelve el beat la segunda vez, **entonces** no cambia nada y no se duplica ningún hecho.
- **Dado** el último beat de la cadena resuelto, **cuando** se pregunta por la aventura en curso, **entonces** está lista para cerrarse como terminada.
- **Dado** una salida con aventura aceptada, **cuando** se cierra y se vuelve a abrir la app antes de terminarla, **entonces** la aventura sigue en curso por el mismo beat y **el beat que la llegada ofrece no llega nulo**. *(Deuda `pipeline/decisiones-orquestador.md` §10g.)*
- **Dado** el reparto casteado tras reabrir la app, **cuando** se compara con el de antes de cerrarla, **entonces** es idéntico beat a beat: se recupera del mundo congelado y de la plantilla que el estado ya guarda, y no se persiste ninguna cadena de textos. *(`@determinismo`, bloqueante.)*
- **Dado** una salida sin ninguna aventura aceptada, **cuando** se monta la capa de llegadas, **entonces** el reparto sigue declarándose vacío explícitamente, como hasta ahora.
- **Dado** el estado de una aventura en curso guardado, **cuando** se inspecciona, **entonces** no contiene ninguna coordenada ni ninguna marca de tiempo. *(`@privacidad`, bloqueante.)*

### La secuencia del telón en pantalla

Reproduce la secuencia que `componeElTelon` ya compone; ninguna pantalla la reordena.

- **Dado** un telón sin leer, **cuando** se abre la app, **entonces** lo primero que se ve es el telón de aquella salida, y no la portada. *(Escenario «El telón espera a que lo leas».)*
- **Dado** cualquier telón, **cuando** se mira su primera pantalla, **entonces** es el mapa; y **cuando** se mira la última, **entonces** es la entrada del diario.
- **Dado** una salida con aventura terminada y desenlace notable, **cuando** se recorre el telón, **entonces** las pantallas son, en este orden, el mapa, el desenlace, lo que se pone en camino y la entrada del diario. *(Aristas `A5P1 → A5P2 → A5P3 → A5P4`.)*
- **Dado** una salida con aventura terminada y desenlace **no** notable, **cuando** se recorre, **entonces** son el mapa, el desenlace y la entrada del diario. *(Escenario «El rumor solo aparece si el desenlace era notable»; arista `A5P2 → A5P4`.)*
- **Dado** una salida que se cerró a mitad de la aventura, **cuando** se recorre, **entonces** en el sitio del desenlace va el cierre en corto, y después la entrada del diario y nunca lo que se pone en camino. *(Escenarios «El cierre en corto ocupa el sitio del desenlace» y «Un cierre en corto no genera rumor»; arista `A5P2B → A5P4`.)*
- **Dado** un paseo sin ninguna aventura, **cuando** se recorre, **entonces** son el mapa y la entrada del diario, sin nada en medio. *(Escenario «Un paseo sin aventura tiene telón completo menos desenlace»; arista `A5P1 → A5P4`.)*
- **Dado** un día sin ningún ascenso, **cuando** se pinta la primera pantalla, **entonces** es la misma pantalla con el título del día sin tinta, la lista de ascensos vacía, los nombres de los sitios por los que se pasó y la línea que constata el día. *(Escenario «Un día sin descubrir nada enseña el mapa igual»; arista `A5P1 ⇢ A5P1B → A5P4`.)*
- **Dado** el paseo sin aventura y la salida con aventura, **cuando** se comparan los títulos de sus primeras pantallas, **entonces** son el mismo.
- **Dado** cualquier pantalla del telón salvo la última, **cuando** se cuentan sus acciones, **entonces** hay exactamente una, «Seguir», y no hay flecha de volver.
- **Dado** la entrada del día, **cuando** se cuentan sus acciones, **entonces** hay exactamente dos: «Ver el diario entero» y «Cerrar». *(Aristas `A5P4 → A6P2` y `A5P4 → A6P1`.)*
- **Dado** el desenlace, **cuando** se cuentan las cifras de toda la pantalla, **entonces** la única es la del oro.
- **Dado** el desenlace de un rango que no se movió, **cuando** se pinta, **entonces** no hay frase de rango y no se sustituye por ninguna que diga que no subió.
- **Dado** la pantalla de lo que se pone en camino, **cuando** se inspecciona lo que se le entregó para pintar, **entonces** lleva el núcleo de origen y nada más: ni destinos, ni saltos, ni nivel, ni el árbol de calzadas. *(Escenario «El telón no enseña la propagación».)*
- **Dado** el mapa del telón, **cuando** se busca una leyenda de tintas o cualquier explicación de qué significa cada una, **entonces** no hay ninguna.
- **Dado** el mapa del telón, **cuando** se compara con el mismo mundo pintado en marcha, **entonces** el mundo es idéntico y solo cambia el pintado. *(`@determinismo`, bloqueante.)*
- **Dado** un telón con hito, **cuando** se recorre, **entonces** la cartela aparece **una sola vez** entre el desenlace y la entrada del diario, sin acción propia más que cerrarse y sin quedar en ningún sitio consultable.
- **Dado** un hito que coincide con un cierre en corto, **cuando** se recorre el telón, **entonces** la cartela aparece igual.

### El telón se echa, y quién lo echa

Es la otra mitad del cableado, y hoy hay dos cierres de salida que no se hablan.

- **Dado** una salida que se cierra por volver al punto de partida, **cuando** se cierra, **entonces** la vida de la salida queda con el telón sin leer y el registro de la salida abierta **sigue abierto**, esperando a que el telón se eche.
- **Dado** «dejarlo aquí» desde la portada, **cuando** se toca, **entonces** ocurre exactamente lo mismo que al volver a casa, y el registro de la salida abierta **no** se cierra por su cuenta antes de que el telón se eche.
- **Dado** cualquiera de las tres vías de cierre, **cuando** se monta la pantalla del telón, **entonces** el telón se echa **una sola vez**, con las seis piezas de serie cableadas, y lo que se pinta es lo que `echaElTelon` devolvió.
- **Dado** el telón ya echado, **cuando** se vuelve a pedir echarlo, **entonces** no se entinta dos veces ni se ingresa el oro dos veces.
- **Dado** una aventura terminada, **cuando** se echa el telón, **entonces** su desenlace se compone desde la plantilla del catálogo y la aventura casteada, y el telón enseña el desenlace y no el cierre en corto.
- **Dado** una aventura cerrada a mitad, **cuando** se echa el telón, **entonces** el texto que se pinta es el de repuesto que la plantilla declara, elegido por si se consiguió algo, y nunca uno redactado en `app/`.
- **Dado** el telón echado, **cuando** se mira la partida, **entonces** se ha congelado en ese mismo corte.
- **Dado** el telón echado, **cuando** se mira la app, **entonces** no ha saltado ninguna notificación y la app no se ha puesto en primer plano. *(Escenario «Volver a casa cierra la salida».)*

### El telón se marca leído con una sola acción, y nunca deja la app encallada

Aplicación directa de `pipeline/decisiones-orquestador.md` §10h y de la regla de SPEC-030.

- **Dado** la entrada del día, **cuando** se toca «Cerrar», **entonces** el telón queda marcado como leído y se llega a la portada.
- **Dado** la entrada del día, **cuando** se toca «Ver el diario entero», **entonces** el telón queda marcado como leído igual y se llega al diario.
- **Dado** **todas** las salidas de la última pantalla del telón, **cuando** se recorren una a una, **entonces** cada una deja el telón marcado como leído y una salida nueva se puede abrir. *(Es el criterio que impide la app muerta de §10h.)*
- **Dado** el telón a medio leer, **cuando** se avanza de pantalla, **entonces** el telón **no** queda marcado como leído: lo marca un toque de quien lo lee y nunca el paso de nada.
- **Dado** un telón sin leer, **cuando** se intenta echar a andar, **entonces** no se abre ninguna salida y el motivo que se enseña es el que ya declara el vocabulario cerrado, `telon-pendiente`.
- **Dado** el telón marcado como leído, **cuando** se echa a andar, **entonces** la salida se abre.
- **Dado** el árbol de la app, **cuando** se busca el hueco `telon-sin-pantalla` con su acción `telon-cerrar`, **entonces** no queda ninguno: la fila 48 lo dejó puesto y esta lo sustituye.
- **Dado** el árbol de la app, **cuando** se busca el hueco `llegada-hueco` para el paso de beat, **entonces** no queda ninguno.

### El conocimiento se cobra al telón

- **Dado** una salida durante la cual se ha llegado a sitios nuevos, **cuando** se mira el mapa a mitad de camino, **entonces** está como al salir de casa y solo se ha movido la marca. *(Escenario «El mapa no cambia durante la salida».)*
- **Dado** esa misma salida, **cuando** se echa el telón, **entonces** los sitios a los que se llegó aparecen entintados y la lista dice a qué escalón han subido, en palabras del mundo. *(Escenario «El mapa se entinta al echar el telón».)*
- **Dado** esa lista, **cuando** se busca en ella un porcentaje, un kilómetro, un tiempo o una barra, **entonces** no hay ninguno.
- **Dado** una salida a mitad de la cual se cerró y se volvió a abrir la app, **cuando** se echa el telón, **entonces** los sitios a los que ya se había llegado siguen entintándose: lo pendiente se reconstruye de las llegadas que el estado ya guarda y no se pierde con el proceso.
- **Dado** una salida sin ninguna llegada validada, **cuando** se echa el telón, **entonces** la lista de ascensos está vacía y no se sustituye por ninguna disculpa.

### Nada degrada por falta de cableado

Aplicación directa de `pipeline/decisiones-orquestador.md` §6h.

- **Dado** la escena sin el reloj de pared cableado, **cuando** se compone la de un beat de franja, **entonces** falla nombrando el reloj y no resuelve la llegada como si fuera dentro.
- **Dado** la escena sin la vista de tenencia cableada, **cuando** se compone la de un beat `con_objeto`, **entonces** falla nombrando la tenencia.
- **Dado** el cierre de la salida sin alguna de sus seis piezas, **cuando** se ejecuta, **entonces** falla nombrando la pieza que falta y no echa un telón al que le falta algo.
- **Dado** el cierre sin el calendario cableado, **cuando** se ejecuta, **entonces** falla nombrando el calendario y no apunta el día cero.
- **Dado** el cierre sin la plantilla del catálogo de la aventura terminada, **cuando** se ejecuta, **entonces** falla nombrándola y no echa un telón sin desenlace.
- **Dado** una escena cuyo beat llega nulo o recortado, **cuando** se monta la pantalla, **entonces** se enseña la avería con su motivo literal y **el paso no se salta en silencio**.
- **Dado** el telón que no se puede echar, **cuando** se monta su pantalla, **entonces** se enseña la avería con su motivo literal y la única acción sigue marcando el telón como leído, de modo que la app nunca queda encallada.
- **Dado** la app cerrada entre echar el telón y marcarlo como leído, **cuando** se vuelve a abrir, **entonces** el telón **no** se echa otra vez y lo que se enseña es su última pantalla —la entrada del día, recompuesta del diario— con sus dos salidas, que marcan el telón como leído. Está declarado en «Decisiones asumidas» y no es un hueco.
- **Dado** dos geofences solapados que validan en la misma parada, **cuando** se cierra la primera llegada, **entonces** la escena de la segunda aparece sin pasar por el mapa y sin fallar. *(§10j.)*
- **Dado** la escena de un beat en un sitio sin ilustración, **cuando** se recorre la llegada, **entonces** la escena se alcanza igual: no depende del visor. *(Arista `LLEGA → A4P3` de `docs/flujo.md`; deuda 3 del encargo.)*

### Determinismo, frontera del núcleo y privacidad

- **Dado** `packages/nucleo/`, **cuando** se enumeran sus imports, **entonces** no aparece ni React Native ni ningún módulo de Expo. *(`@determinismo`, bloqueante.)*
- **Dado** el código de `packages/nucleo/`, **cuando** se busca `Math.random`, `Date.now` o `new Date`, **entonces** no hay ninguno. *(`@determinismo`, bloqueante.)*
- **Dado** un clon limpio sin `node_modules`, **cuando** se ejecuta la batería de `@nucleo` enumerando sus ficheros, **entonces** arranca entera y pasa. *(Criterio duro, §6u.)*
- **Dado** el mismo estado y las mismas entradas dos veces, **cuando** se compone el telón, **entonces** los dos son idénticos, frase de rango incluida. *(`@determinismo`, bloqueante.)*
- **Dado** una salida entera recorrida y su telón echado, **cuando** se inspecciona lo que la partida escribe, **entonces** no hay ninguna coordenada, ninguna marca de tiempo y ningún minuto del día. *(`@privacidad`, bloqueante.)*
- **Dado** una escena compuesta y un beat resuelto, **cuando** se cuentan las peticiones de red, **entonces** cero. *(`@privacidad`, bloqueante.)*
- **Dado** el telón entero, **cuando** se inspecciona el tráfico saliente, **entonces** no sale ninguna petición. *(`@privacidad`, bloqueante.)*
- **Dado** el paquete, **cuando** se busca quién compone la escena y el telón, **entonces** están en `packages/nucleo/` y llegan inyectados a la app; ningún texto nuevo se redacta en `app/`.
- **Dado** los textos que la app pinta, **cuando** se buscan las palabras del vocabulario de reproche, del de propagación y del de logro, **entonces** no aparece ninguna, con las mismas comprobaciones que el paquete ya exporta.

### Las guardas de recuento que esta fila mueve

Son guardas de contrato con lista escrita a mano, y moverlas es un acto con registro.

- **Dado** `test/nucleo/pantallas-huerfanas.test.mjs`, hoy en **una** (`zurron.jsx`, de la fila 46), **cuando** se mide al terminar esta fila, **entonces** sigue en una: las pantallas nuevas quedan alcanzables desde `App.js` y **el recuento no sube**. Si subiera, se dice con el número delante y el dueño de cada una escrito.
- **Dado** `test/nucleo/contratos-sin-llamador.test.mjs`, **cuando** se mide al terminar, **entonces** ni `echaElTelon`, ni `componeElTelon`, ni `componeEscena` de quests, ni `componeLoQueTeLlevas`, ni `componeElDesenlace`, ni las tres transiciones de `aventura-en-curso.js` siguen sin llamador de producción.
- **Dado** la columna de `test/nucleo/limite-declarado.test.mjs`, hoy en **siete**, **cuando** se mide al terminar, **entonces** `escena.yaml` sale y quedan **seis**; y si no puede salir —porque no se puede garantizar dónde nace el mundo ni qué sitio tiene beat—, **se dice con el número delante y con el motivo medido**, nunca con el previsto.
- **Dado** `node scripts/verifica-flujo.mjs`, **cuando** se ejecuta al terminar, **entonces** sigue en verde: no se añade ni se quita ninguna pantalla de `docs/pantallas/` y no se cambia ninguna arista del diagrama.

## UX Design

### Wireframe textual

**Ninguna pantalla se dibuja de nuevo y ninguna se añade a `docs/pantallas/`.** Las ocho están en los artefactos 4 y 5 y sus composiciones están escritas, campo a campo, en `packages/nucleo/quests/escena.js` y `packages/nucleo/partida/telon.js`. Lo que sigue es lo que hay que pintar y en qué orden; si al montarlo apareciera un defecto de composición, se arregla como defecto de la fila dueña y se anota, no se rehace la pantalla. **Layout 1 — Estándar** en las ocho: superficie a sangre sobre el papel `#efe3c0`, sin barra de pestañas, sin cabecera de navegación y sin flecha de atrás.

**La escena — A4P3.** De arriba abajo, con los datos que devuelve `componeEscena`:

```
  ‹sitio›                          serif pequeño, arriba — el nombre de fantasía
  ‹titular›                        serif grande — «Hay alguien esperando»
  ‹situacion›                      serif normal, uno o dos renglones; ausente cuando el
                                   cuerpo es la propia prosa de la plantilla
  ‹cara.nombre›, ‹cara.puesto›     versalitas, una línea, SIN RETRATO; ausente sin cara
  «‹cuerpo.texto›»                 el bloque largo: parlamento entrecomillado con cara,
                                   párrafo sin ella. Es lo que escala el tamaño de letra
  ‹cierre›                         un renglón que remata el gesto

  [A ⌃] Tamaño del texto           abajo a la izquierda, SANS — el único registro de
                                   aplicación de la pantalla. Cada toque avanza un escalón
  [ ‹accion.verbo› ]               abajo, ancho completo — la única acción
```

**Lo que te llevas — A4P4.** De arriba abajo, con lo que devuelve `componeLoQueTeLlevas`: el **rótulo** «Llevas encima» en versalitas; **lo que se lleva** en serif grande con su renglón de detalle; el **párrafo de empuje**; el **nombre del sitio siguiente** destacado, con su línea de calzadas debajo y su marca; y abajo la única acción, «Seguir andando». Sin bloque de sitio siguiente en el último beat de la cadena.

**El telón — A5P1, A5P1B, A5P2, A5P2B, A5P3 y A5P4.** Una pantalla por elemento de `telon.pantallas`, en su orden, cada una con su estado del vocabulario cerrado y su acción «Seguir», salvo la última:

```
  mapa / mapa-sin-tinta   ‹situacion› versalitas · ‹titulo› serif grande · la LÁMINA con
                          las tres tintas y sin leyenda · ‹ascensos› una línea por elemento
                          con su nombre y su escalón en palabras del mundo, o
                          ‹porDondeSePaso› sin escalón al lado cuando no hubo tinta, con
                          ‹linea› debajo · [ Seguir ]
  desenlace               ‹aventura› versalitas · ‹titular› · ‹parrafo› · ‹oro.cantidad›
                          con su renglón · ‹objetos› uno por línea con su procedencia ·
                          ‹rango.texto› en una línea, ausente si no se movió · [ Seguir ]
  cierre-en-corto         igual, con ‹titular› «Se resolvió sin ti», el ‹parrafo› de
                          repuesto y ‹cierre› al final · [ Seguir ]
  rumor                   ‹rotulo› versalitas · ‹titular› · ‹consecuencia› · un FRAGMENTO
                          de la lámina centrado en ‹sale.origen›, sin ninguna línea hacia
                          ningún sitio y sin más núcleos rotulados · ‹espera› · [ Seguir ]
  diario                  ‹rotulo› versalitas · ‹dia› · ‹titulo› · ‹propio.texto› en serif
                          y primera persona · ‹oido› aparte, entrecomillado y con su
                          autoridad visible · [ Ver el diario entero ] [ Cerrar ]
```

**La cartela del hito.** No es una pantalla de la secuencia: es una **capa** que aparece una sola vez entre el desenlace y la entrada del diario, con el papel, un filete y las dos líneas que `telon.hito` trae. Se cierra tocando y la secuencia sigue donde estaba.

**Y una ausencia que es la pieza:** en ninguna de las ocho hay flecha de atrás, barra, indicador de en qué pantalla vas, ni manera de saltar. La escena encadena y el telón se lee una vez.

### Pantallas y elementos utilizados

```
Pantallas que esta fila entrega, y que hoy no existen en app/:
  A4P3   pantalla 3 · artefacto 4 — La escena                    (composición: quests/escena.js)
  A4P4   pantalla 4 · artefacto 4 — Lo que te llevas             (composición: quests/escena.js)
  A5P1   pantalla 1 · artefacto 5 — El mapa se entinta           (composición: partida/telon.js)
  A5P1B  pantalla 1B · artefacto 5 — Cuando no descubriste nada  (composición: partida/telon.js)
  A5P2   pantalla 2 · artefacto 5 — El desenlace                 (composición: partida/telon.js)
  A5P2B  pantalla 2B · artefacto 5 — El cierre en corto          (composición: partida/telon.js)
  A5P3   pantalla 3 · artefacto 5 — Lo que se pone en camino     (composición: partida/telon.js)
  A5P4   pantalla 4 · artefacto 5 — La entrada del día           (composición: partida/telon.js)

Pantallas ya escritas que esta fila alcanza y no compone:
  A4P5  pantalla 5 · artefacto 4 — Lo que aquí se cuenta   app/pantallas/lo-que-se-cuenta.js (dueña: 32)
  A4P7  pantalla 7 · artefacto 4 — La ficha de texto       app/pantallas/ficha.js            (dueña: 33)
  A6P1  pantalla 1 · artefacto 6 — La portada, sin barra   app/pantallas/portada.jsx         (dueña: 28)
  A6P2  pantalla 2 · artefacto 6 — El diario, por días     app/pantallas/diario.jsx          (dueña: 37)

Huecos declarados que esta fila borra:
  app/App.js               `telon-sin-pantalla` y su acción `telon-cerrar`   (los puso la fila 48)
  app/pantallas/llegada.js `llegada-hueco` para el paso de beat, y `nombraElPaso` con él
                                                                            (lo puso la fila 44)

Elementos del proyecto que se usan: la voz del mundo en serif, la sans de la voz de la
aplicación para el único control de aplicación de la escena, la placa de rótulo, las
versalitas, el filete de la cartela, la lámina y sus cinco estilos, y las marcas de
`app/pantallas/marca.js`.

Elemento que se usa y hoy no está pasado: la lámina con entintado. `packages/nucleo/render/
escena.js` ya acepta `entintado` y `telon` y ya declara las tres tintas como claves de estilo
en los cinco estilos; `app/render/lamina.jsx` **no se los pasa**. Lo que esta fila añade es el
paso de esas dos propiedades, no ningún color: ni uno vive en el código de dibujo.
```

### data-testid

**No se inventa ninguno.** Los de la escena salen de `TESTIDS` de `packages/nucleo/quests/escena.js`, que el paquete ya declara como dato; los del telón son los que **SPEC-036 declaró por escrito** en su propia sección de `data-testid`, y se reutilizan literalmente. Que los primeros vivan en el paquete y los segundos solo en la spec es una asimetría real y queda anotada en «Fronteras y huecos, con dueño».

De `quests/escena.js`, `TESTIDS`:

- `escena-estado` — el estado del momento, con un valor de `ESTADOS_DE_ESCENA`: `escena`, `lo-que-te-llevas`, `sin-escena`
- `escena` — el contenedor de la escena
- `escena-cara` — el bloque de quien habla, ausente cuando no hay nadie
- `escena-accion` — la única acción que avanza
- `escena-tamano-texto` — el control de tamaño de letra
- `escena-texto` — el bloque de texto largo, sobre el que se afirma que el tamaño cambió
- `lo-que-te-llevas` — la pantalla del resultado
- `siguiente-sitio` — el nombre del sitio siguiente, ausente en el último beat

De SPEC-036:

- `telon-estado` — el estado del momento, con un valor de `ESTADOS_DEL_TELON`: `mapa`, `mapa-sin-tinta`, `desenlace`, `cierre-en-corto`, `rumor`, `diario`
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

Y los que ya existen y esta fila **mantiene** alcanzables desde su lado: `momento-estado` (el momento «al parar»), `llegada`, `llegada-secuencia`, `llegada-paso` y `salida-situacion`, con el mismo valor y el mismo sitio que hoy. Las marcas van apartadas con `marcaSuperpuesta(n)`, como manda `app/pantallas/marca.js`: una marca de 0×0 no existe para la automatización, y varias apiladas en el mismo punto tampoco.

### Patrón de interacción

- **Un solo botón en la escena, y con el verbo de lo que se hace.** Regla: `quests.md` §2, cadena lineal de inicio, y exclusión 9 del PRD; «Continuar» sería un botón de aplicación y desperdiciaría la única línea de acción que la pantalla tiene para contar algo.
- **Ni la escena ni el telón se pueden abandonar hacia atrás.** Regla: `bucle-jugable.md` §2 para la llegada, que encadena y no se navega, y §8 para el telón, que es una secuencia y no un menú. Una flecha de volver dejaría un beat a medio resolver, que es un estado que el motor no tiene.
- **El ajuste de tamaño de letra es un toque cíclico y no un control con panel.** Regla: `design-system.md`, el mínimo de aplicación posible en este momento; y `personaje.md` §4, dos personas leyendo del mismo móvil. Un panel convertiría el único elemento de aplicación tolerado en una pantalla de ajustes dentro del juego.
- **La franja no se anuncia y el objeto-llave tampoco.** Regla: `quests.md` §2 y RF-PROG-006. Lo único que cambia es el texto, y las dos vías resuelven el mismo beat.
- **El telón no se puede saltar, pero tampoco atrapa.** Regla: `design-system.md`, el telón es momento de pantalla permitida; la última pantalla ofrece las dos salidas naturales y ninguna intermedia ofrece salir, para no partir la lectura por la mitad.
- **Las dos salidas de la última pantalla marcan el telón como leído, y ninguna otra cosa lo marca.** Regla: SPEC-030 y §10h. Es un toque de quien lo lee, nunca el paso de nada; y si alguna salida no marcara, la app quedaría sin poder abrir ninguna salida, que es un fallo silencioso con forma de app muerta.
- **Las tres tintas se ven y no se explican.** Regla: `bucle-jugable.md` §8, «sin leyenda, porque la diferencia se ve».
- **El rumor se pinta saliendo y su fragmento de mapa no tiene destino.** Regla: `quests.md` decisión 3 y `bucle-jugable.md` §8.
- **La escena se alcanza sin visor.** Regla: la arista `LLEGA → A4P3` de `docs/flujo.md` —un sitio sin ilustración pero con beat no tiene visor que abrir— y la deuda 3 del encargo: hoy, sin lector de recursos, **toda** llegada resuelve a ficha o a lo que se cuenta, así que una escena que dependiera del visor sería inalcanzable en el aparato.
- **Decisión no cubierta por el design system:** qué se ve si la app muere entre echar el telón y marcarlo como leído. Se resuelve **enseñando la última pantalla de la secuencia, la entrada del día, recompuesta desde el diario**, con sus dos salidas intactas; porque el diario es lo único de la secuencia que el estado guarda entero, porque es la pantalla que `bucle-jugable.md` §8 declara que siempre está y cierra, y porque cualquier otra respuesta o mentiría sobre lo que pasó o dejaría la app encallada.
- **Decisión no cubierta por el design system:** qué pasa si la app se cierra con la escena abierta y sin resolver. Se resuelve **dejando el beat sin resolver y la escena disponible**, que es lo que ya decidió SPEC-034 y lo que la secuencia guardada de la llegada ya sostiene.

## Notas técnicas

### El guion, que ya está escrito

`test/nucleo/bucle-completo.test.mjs` recorre en Node exactamente lo que la app tiene que hacer, y esta fila no inventa otra tubería. En orden:

1. `acepta(estado.aventuras, { aventura: casteada, mapaId, registro, dia, paso })` al aceptar una entrada de la lista.
2. La capa de llegadas se monta con `reparto: { beats }` de esa aventura casteada.
3. Cada llegada validada ofrece su beat; con el que toca, `resuelveBeat(estado.aventuras, { beat, reloj, tenencia })`.
4. Al terminar la cadena, `componeElDesenlace({ plantilla, aventura, salida })` y `repuestoDe(plantilla)`.
5. `echaElTelon({ estado, registro, calendario, mundo, mapaId, salida, paso, via, pendientes, lugar, aventura, desenlace, repuesto, idioma, porDondeSePaso, piezas: piezasDeSerie() })`.
6. Se pinta `resultado.telon.pantallas`, en su orden, y `resultado.telon.hito` como capa.

### Las cinco costuras que hay que coser, verificadas contra la fuente

Ninguna es una pantalla, y las cinco impiden que las pantallas funcionen.

1. **Nadie acepta la aventura en el motor.** `aceptaLaEntrada` (`partida/lo-que-hay-hoy.js:314`) anota la aventura en el registro de la **salida abierta** y **no** llama a `acepta` de `aventura-en-curso.js`. Consecuencia medida: `estado.aventuras.enCurso` es siempre `null`, `resuelveBeat` es inalcanzable y `echaElTelon` compondría siempre el telón de un paseo sin aventura, con o sin aventura aceptada.
2. **La salida abierta se cierra sin echar el telón.** `app/pantallas/antes-de-salir.jsx:148` llama a `cierraLaSalida(estado.aventuras, { via })` directamente. `echaElTelon` exige que esa misma salida siga abierta y, si no lo está, falla con «su telón ya se echó». Hay que dejar que sea el cierre quien la cierre —lo hace en su paso 9— y que «dejarlo aquí» y volver a casa entren por la misma puerta.
3. **Dos identidades de salida distintas.** `antes-de-salir.jsx` usa `mapa/dN/sN` (`identidadDeSalida`) sobre el área `aventuras` y `App.js:83` usa `mapa/sN` (`identidadDeLaSalida`) sobre el área `salidas`. `echaElTelon` compara la identidad que recibe con la que está abierta en `aventuras`, así que las dos tienen que ser la misma, y hay una sola manera de conseguirlo: una función y no dos.
4. **El libro de pendientes no lo llena nadie.** `apuntaHaberEstado` no tiene ningún llamador de producción, así que la lista de ascensos del telón sería siempre vacía y RF-BUCLE-012 no se cumpliría nunca. Se llena en la capa de llegadas de la salida, con cada llegada validada; y se **reconstruye** de las llegadas que el área `llegadas` ya guarda de esta salida cuando el proceso muere a mitad, en lugar de perderse.
5. **El reparto casteado no sobrevive a cerrar la app** (§10g). `App.js:333` cae a `REPARTO_SIN_AVENTURA` al reabrir. La cadena **no se persiste**: se recupera del mundo congelado y de la plantilla que `estado.aventuras.enCurso` ya guarda, porque el casting es determinista y `world.casting` se deriva del documento. Es la misma vía por la que `partida/aventuras.js:77` vuelve a castear cuando hay descartes.

### Frontera de inyección

Cuatro entradas, y ninguna es una dependencia nueva. Las cuatro entran por `app/nucleo/piezas.js`, con su bloque enumerado y su `DEL_NUCLEO`, como las nueve filas anteriores (§6u): sin eso, lo que esta fila entrega dejaría de poder afirmarse en `node --test` sin instalar nada.

1. **El reloj de pared** (SPEC-034) — devuelve el minuto del día y decide qué variante de escena se lee. **El minuto se usa y no se guarda.** Su doble ya existe en `test/dobles/reloj-de-pared.mjs`.
2. **El calendario de la partida** (SPEC-036) — qué día es hoy. Ya está montado en `app/datos/calendario.js` y `App.js` lo usa; aquí llega al cierre.
3. **La plantilla del catálogo** de la aventura aceptada — de ella salen el desenlace, los dos repuestos, el mote y la declaración de rumor. `antes-de-salir.jsx` ya la resuelve con `plantillaDe(id)`; aquí hace falta también al cerrar, y se resuelve por el `plantilla` que el estado guarda.
4. **El paquete de idioma del mapa** — lo exige `echaElTelon` para la capa de NPCs.

Y una salida hacia el resto del juego: **el telón echado**, que es lo que `App.js` pinta cuando `queOfrece()` dice `telon`.

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `app/pantallas/escena.js` | A4P3 y A4P4, pintadas desde lo que `componeEscena` y `componeLoQueTeLlevas` devuelven |
| `app/pantallas/telon.jsx` | las seis pantallas del telón y la capa del hito, una por estado del vocabulario cerrado |
| `app/pantallas/telon-montado.jsx` | el punto de montaje: echa el telón una vez, recorre sus pantallas y marca el leído |
| `app/pantallas/llegada-montada.jsx` | inyecta la pantalla del beat por su tipo de paso, que es la puerta que `PantallaLlegada` ya tiene abierta |
| `app/pantallas/llegada.js` | se le quita el hueco `llegada-hueco` y `nombraElPaso` con él |
| `app/marcha/llegadas.js` | resolver el beat que toca al cerrar su paso, y apuntar el ascenso pendiente de cada llegada validada |
| `app/marcha/salida.js` | el libro de pendientes de la salida y el cierre que echa el telón por las tres vías |
| `app/pantallas/antes-de-salir.jsx` | dejar de cerrar la salida abierta por su cuenta y aceptar la aventura en el motor |
| `app/App.js` | sustituir el hueco del telón por su pantalla, y unificar la identidad de la salida |
| `app/render/lamina.jsx` | pasar `entintado` y `telon` a `componeEscena` del render |
| `app/nucleo/piezas.js` | los dos bloques nuevos, enumerados |

`packages/nucleo/quests/escena.js`, `quests/desenlace.js`, `partida/telon.js`, `partida/cierre-de-salida.js`, `partida/aventura-en-curso.js`, `partida/conocimiento.js` y `partida/salidas.js` **no cambian de comportamiento**: de ellos se consume lo que ya entregan.

### Fronteras y huecos, con dueño

Se anotan aquí porque son reales y ninguno se resuelve de paso.

- **El motor de pasos de la partida no tiene llamador en `app/`.** `creaMotorDeLaPartida` solo se usa en `test/`, así que el mundo no avanza, los rumores no propagan y la vía de ascenso «la boca de otro» no puede apuntar nada. Esta fila cablea la vía de las piernas, que es la que sus llegadas producen, y **declara la otra como pendiente**: es del motor de pasos y no de una pantalla.
- **El lector de recursos binarios del visor no tiene fila.** Mientras no exista, toda llegada resuelve a ficha o a lo que se cuenta. No estorba a la escena —sin ilustración la escena es lo primero, y así lo declara `docs/flujo.md`— pero mantiene a `visor.yaml` en la columna de límite declarado, que no es de esta fila.
- **`partida/telon.js` no declara sus `data-testid` como dato**, al contrario que `quests/escena.js`. Esta fila reutiliza literalmente la lista que SPEC-036 escribió y **no la mueve al paquete**, para no cambiar el comportamiento de un módulo que está en verde; cerrarlo por contrato, como se hizo con la escena, queda anotado y es barato.
- **La composición del telón no se persiste.** Vive lo que dura su lectura. La consecuencia está declarada arriba con su comportamiento; si el dueño quiere que sobreviva a que el sistema mate el proceso a mitad de la lectura, es un cambio de esquema del estado y **se escala con la evidencia delante**, no se resuelve aquí.
- **Los kilómetros fantasma de §10a siguen sin medir.** No es de esta fila y no se toca; queda dicho porque el telón es la primera pantalla donde un kilómetro de más se convertiría en un paso del mundo visible.

## Decisiones asumidas

- **El telón se echa al montarse su pantalla, y no en la misma transición que cierra la salida** → asumido (alternativa: echarlo al cerrar y persistir la composición en el estado). Regla: `salidas.js` ya sostiene «cerrada sin leer» durante días, y el telón es lo primero que la app enseña al abrirse (SPEC-030), así que nada de lo que el cierre escribe es observable antes de que su pantalla se monte. La alternativa obliga a guardar la composición entera —el entintado del mapa incluido— dentro de `AREA_SALIDAS`, que declara «ni un campo más», y eso es un cambio de esquema que se decide con evidencia y no de paso.
- **Si la app muere entre echar el telón y marcarlo como leído, se enseña la entrada del día recompuesta del diario** → asumido (alternativas: volver a echar el telón, que entintaría dos veces e ingresaría el oro dos veces; enseñar una pantalla de avería sin acción, que dejaría la app encallada). Regla: §10h y `bucle-jugable.md` §8 —la entrada del diario cierra todo telón y es la única pieza de la secuencia que el estado guarda entera—.
- **El reparto casteado se recupera del mundo congelado y no se persiste** → asumido (alternativa: guardar la cadena de beats dentro del área `aventuras`). Regla: el casting es determinista sobre el documento congelado y `partida/aventuras.js` ya vuelve a castear por este mismo motivo; persistir la cadena metería textos de plantilla en la partida, la haría crecer y duplicaría un dato que el documento ya determina.
- **El libro de pendientes de conocimiento se reconstruye de las llegadas validadas de la salida** → asumido (alternativa: persistirlo como área nueva; alternativa peor: dejarlo morir con el proceso). Regla: `conocimiento.js` lo pone fuera del estado a propósito, para que «el mapa no cambia durante la salida» sea comprobable; y el área `llegadas` ya guarda el sitio de cada llegada de esta salida, así que reconstruirlo es derivarlo y no inventárselo.
- **La aventura se acepta en el motor en el mismo sitio donde hoy se anota en la salida abierta** → asumido (alternativa: aceptarla al salir a andar). Regla: SPEC-034 dice que el estado lo escribe la aceptación, y `docs/flujo.md` pone la arista en `A2P4 → A2P5`; aceptarla más tarde dejaría A2P5 preparando una aventura que el motor no conoce.
- **Las tres vías de cierre echan el telón por la misma puerta** → asumido (alternativa: que «dejarlo aquí» siga con su camino propio en `antes-de-salir.jsx`). Regla: `bucle-jugable.md` §8, «no es una salida de emergencia sino la misma puerta en otro sitio»; y dos caminos serían dos sitios donde equivocarse con la identidad de la salida.
- **Una sola función de identidad de salida** → asumido (alternativa: traducir una identidad a la otra al cerrar). Regla: `echaElTelon` compara identidades y falla nombrándolas; tener dos y traducirlas es la forma exacta de fallo que §6h describe, con el agravante de que el fallo saldría al cerrar la salida y no al abrirla.
- **La escena se inyecta en `PantallaLlegada` por su tipo de paso, y no se monta como una ruta nueva** → asumido (alternativa: un enrutador). Regla: `app/pantallas/llegada.js` ya acepta `pantallas` por tipo de paso y su ausencia de rutas es la pieza —no hay manera de llegar a A4P5 sin haber llegado al sitio—; una ruta abriría esa puerta.
- **El telón se monta en `App.js`, en el sitio del hueco de la fila 48, y no cuelga de la portada** → asumido (alternativa: montarlo desde `antes-de-salir.jsx`). Regla: el telón manda sobre la portada y esa decisión es de SPEC-030; el hueco está exactamente ahí, con su condición ya escrita.
- **El fragmento de lámina de A5P3 se pinta con la misma lámina y una vista centrada en el núcleo de origen** → asumido (alternativa: un elemento gráfico propio). Regla: SPEC-036 lo resolvió así y `app/render/lamina.jsx` ya acepta una `vista`; un elemento propio duplicaría el pintado y podría enseñar lo que la decisión prohíbe.
- **La escala de tamaño de texto de la escena es la que el paquete declara, y no se guarda todavía en los ajustes** → asumido (alternativa: persistirla en el área de ajustes). Regla: SPEC-034 la declara para que la fila 38 la consuma tal cual, y la pantalla de ajustes es de esa fila; aquí el escalón vive lo que dura la sesión, que es lo que el criterio «al entrar en otra escena sigue puesto» exige, y persistirlo es de la 38.
- **Ningún texto nuevo se escribe en `app/`, tampoco los de avería** → asumido (alternativa: redactar una línea de disculpa cuando el telón no se puede echar). Regla: `lenguaje.md` y `design-system.md` —dentro del juego, cualquier cosa que solo se pueda decir como aplicación es señal de rediseñar el momento—; la avería enseña el motivo literal que el núcleo produce, que es lo mismo que ya hacen `llegada-sin-cablear` y `en-marcha-sin-cablear`.
