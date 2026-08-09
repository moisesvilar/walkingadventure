# SPEC-034 — La escena de un beat, y la aventura en curso

## Descripción

Entrega lo que pasa cuando llegas a un sitio del lazo: **la escena**. Un lugar, un disparador, lo que allí ocurre y lo que te llevas, con **un solo botón**, porque los beats son lineales de inicio y dibujar dos opciones prometería una ramificación que el diseño aplazó a propósito. La escena es el momento de más texto de todo el juego y por eso es donde vive el **modo compañía**: todo está escrito para leerse en voz alta, y el **ajuste de tamaño de letra** se cuela aquí como único registro de aplicación en el momento, porque dos personas leyendo de un móvil lo necesitan.

Y entrega, porque sin ello la escena no tiene a qué avanzar, **la aventura en curso**: el estado que guarda qué aventura se aceptó, por qué beat va, cuáles quedaron resueltos y cómo acabó —terminada o a medias—. El paquete sabía castear una aventura desde SPEC-010 y sabía cerrarla en progresión desde SPEC-015, pero **entre esas dos cosas no había nada**: el área `aventuras` de `packages/nucleo/partida/estado.js` está declarada sin esquema y sus cuatro tipos de hecho se reconocen sin poder reproducirse. Esta fila la llena. Es un entregable que el checklist no nombra y que se declara aquí en lugar de colarse: **la fila 34 entrega el motor de la aventura en curso**, y las filas 28, 32 y 36 lo consumen por sus tres extremos.

Lo tercero, y es lo que más fácil sería perder: **la franja es propiedad del beat y llegar tarde no cancela nada**. Una cita al caer la tarde es una propiedad de la escena y no una agenda de nadie; llegar fuera de la franja **cambia la variante del texto y resuelve el beat igual**, con el mismo resultado y el mismo beat siguiente. `packages/nucleo/quests/aventura.js` ya trae la franja entera dentro del beat y deja `variantes.fuera` en `null` esperando a esta fila. Aquí se llena y se hace comprobable, que es lo que RF-QUEST-004 pide y lo que `docs/prd.md` marca como **⚠ sin escenario**.

Anclas: **RF-QUEST-004** (`docs/prd.md` §4.2) y **RF-PJ-009** (§4.8, marcado **⚠ sin escenario**, así que sus criterios se escriben aquí por primera vez). Las fuentes que mandan sobre el PRD son `game-design/quests.md` §2 (la estructura de beats y «lineal de inicio»), `game-design/personaje.md` §4 (el modo compañía) y el artefacto 4 de `docs/pantallas/`, pantallas A4P3 y A4P4 del flujo. Consume **SPEC-010** (`beatCasteado`, `guiadoDeBeat`, los tres disparadores, las cinco franjas y el horario diurno), **SPEC-017** (los textos de plantilla del catálogo, ya reescritos en cómico-cálido), **SPEC-018** (el texto del LLM cuando lo hay, su clave y su origen, y el fallback de plantilla), **SPEC-015** (los objetos-llave: `resuelveBifurcacion`, la tenencia y las dos vías que abren la misma puerta), **SPEC-014** (la cara que habla y su puesto) y **SPEC-016** (el registro de hechos, donde ya están declarados `aventura-aceptada`, `aventura-cerrada`, `aventura-abandonada` y `decision-en-aventura`).

Y consume las **filas 28 y 32**, **que no están en disco al escribir esta spec**: de la 28 se consume el momento en que una aventura se acepta, y de la 32, la validación de la llegada y el sitio donde ocurre. Si alguna de ellas ya entregó parte del estado de la aventura en curso, **manda ella** y esta fila lo extiende en lugar de duplicarlo; el ajuste sería por iteración.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparece el **reloj de pared**, que dice en qué minuto del día se resuelve un beat y es lo único que decide si se llegó dentro de la franja. Está descrito en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** la **lista de aventuras y su aceptación en pantalla** (fila 28, A2P3 y A2P4), de la que aquí solo se entrega el estado que la aceptación escribe; la **preparación** con sus ilustraciones y sus textos (filas 25 y 18, ya entregadas); la **validación del geofence y la secuencia de una llegada** (fila 32, RF-BUCLE-005 y RF-BUCLE-006); el **visor del anclaje** y la **ficha de texto** (fila 33), que van por encima y por debajo de esta pantalla pero no dentro; **lo que aquí se cuenta** al llegar a un núcleo (fila 32, A4P5); el **cierre de la salida y el telón** con su desenlace, su cierre en corto, su rumor y su diario (fila 36), del que aquí solo se entrega **la declaración de cómo acabó la aventura**; el **micro-encuentro con lugar diferido** y su cola (fila 19, ya entregada) y su ofrecimiento en marcha (fila 29); la **pantalla de ajustes** donde el tamaño de letra vive también como ajuste permanente (fila 38, A6P6), de la que aquí solo se consume la escala; y la **ramificación de beats**, que es exclusión 9 del PRD y no se implementa ni se prepara.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`, y los que reproducen un escenario ya escrito llevan su nombre literal. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Recorrer una aventura de punta a punta» y «La escena»; la **validación de entradas** en el beat que no es el que toca, la aventura ya cerrada que recibe un beat y el tamaño de letra fuera de la escala; el **estado vacío** en la aventura sin ningún beat resuelto y la salida sin ninguna aventura aceptada; el **estado de error** en «Nada degrada por falta de cableado»; y los **casos límite** en la franja cruzada, la llegada fuera de franja, el beat `con_objeto` sin el objeto, el mismo beat resuelto dos veces y la aventura que se deja a medias en el primer beat.

«Catálogo» significa las treinta plantillas de `packages/nucleo/quests/templates.js`. «Mundo de referencia» significa uno de los ocho extractos congelados de `test/fixtures/mundos-referencia/`.

### La cadena es lineal, y eso se comprueba sobre el catálogo entero

- **Dado** cualquier plantilla del catálogo casteada sobre cualquiera de los ocho mundos de referencia, **cuando** se recorre su cadena de beats, **entonces** cada beat apunta a un único beat siguiente y solo el último no apunta a ninguno.
- **Dado** esa misma cadena, **cuando** se cuenta cuántas continuaciones ofrece un beat resuelto, **entonces** es exactamente una.
- **Dado** un beat con disparador `con_objeto` resuelto con el objeto y el mismo beat resuelto sin él, **cuando** se comparan, **entonces** el resultado y el beat siguiente son el mismo y solo cambia el texto de la vía. (Es RF-PROG-006, y aquí se afirma desde la escena.)
- **Dado** una plantilla que declarase dos beats siguientes para un mismo beat, **cuando** se valida, **entonces** falla nombrando la plantilla y el beat: el criterio se puede poner rojo.
- **Dado** una aventura recorrida entera, **cuando** se cuenta cuántas decisiones se le pidieron a quien juega, **entonces** cero: ningún beat pregunta nada, y el hecho `decision-en-aventura` no se emite en ninguna aventura del catálogo.

### La franja es del beat, y llegar tarde no cancela nada

RF-QUEST-004 está marcado **⚠ sin escenario (franjas)** en el PRD: estos criterios lo cubren.

- **Dado** un beat con disparador de franja y una llegada **dentro** de su franja, **cuando** se resuelve, **entonces** el beat queda resuelto con la variante de dentro.
- **Dado** ese mismo beat y una llegada **fuera** de su franja, **cuando** se resuelve, **entonces** el beat queda resuelto igual, con la variante de fuera, y el resultado y el beat siguiente son idénticos a los de la llegada dentro.
- **Dado** las dos resoluciones del mismo beat, dentro y fuera, **cuando** se comparan sus efectos sobre la partida —objetos, oro, hechos y avance de la cadena—, **entonces** no difieren en nada.
- **Dado** el texto de la variante de fuera de cualquier beat de franja del catálogo, **cuando** se busca en él el vocabulario de reproche, **entonces** no aparece ninguna de sus palabras.
- **Dado** un beat de franja cuya variante de fuera no está escrita en la plantilla, **cuando** se valida la plantilla, **entonces** falla nombrando la plantilla y el beat, en lugar de resolver el beat con el texto de dentro como si nada.
- **Dado** la franja `noche`, que cruza la medianoche, **cuando** se resuelve un beat suyo a las 23:30 y otro a las 02:00, **entonces** las dos llegadas cuentan como dentro.
- **Dado** una aventura con un beat de franja, **cuando** se recorre entera llegando siempre fuera de franja, **entonces** la aventura termina y su desenlace es el de una aventura terminada, no un cierre en corto.
- **Dado** todas las plantillas del catálogo con beats de franja, **cuando** se resuelven sus cadenas llegando siempre fuera de franja, **entonces** ninguna queda bloqueada en ningún beat.

### La aventura en curso: aceptar, recorrer y declarar cómo acabó

- **Dado** una partida sin ninguna aventura en curso, **cuando** se acepta una aventura casteada, **entonces** queda en curso con su cadena de beats, su beat en curso puesto en el primero y ningún beat resuelto.
- **Dado** una aventura en curso, **cuando** se resuelve el beat que toca, **entonces** el beat en curso pasa a ser el siguiente y el resuelto queda anotado con su vía y su variante.
- **Dado** una aventura en curso, **cuando** se resuelve un beat que **no** es el que toca, **entonces** falla nombrando el beat que llegó y el que se esperaba, y no se avanza.
- **Dado** una aventura en curso, **cuando** se resuelve dos veces el mismo beat, **entonces** la segunda no cambia nada y no duplica ningún hecho.
- **Dado** una aventura en curso con el último beat resuelto, **cuando** se cierra, **entonces** queda declarada **terminada** con el desenlace de su plantilla.
- **Dado** una aventura en curso con beats sin resolver, **cuando** se cierra, **entonces** queda declarada **a medias**, con cuántos beats se resolvieron y qué se llegó a conseguir.
- **Dado** una aventura ya cerrada, **cuando** se le pide resolver un beat, **entonces** falla nombrando la aventura y su estado.
- **Dado** cualquiera de esas tres transiciones, **cuando** se mira el registro de hechos, **entonces** hay exactamente un hecho `aventura-aceptada`, uno `aventura-cerrada` o uno `aventura-abandonada` según corresponda, con el identificador de la aventura dentro.
- **Dado** una partida guardada con una aventura en curso, **cuando** se congela y se vuelve a levantar, **entonces** el estado de la aventura vuelve idéntico y el beat en curso es el mismo. (Bloqueante con RF-PERS-001.)
- **Dado** una partida guardada con una aventura en curso, **cuando** se reconstruye desde el registro de hechos, **entonces** el área `aventuras` se reproduce en lugar de declararse no reproducible.
- **Dado** una aventura aceptada y la misma partida reproducida dos veces con las mismas entradas, **cuando** se comparan los dos estados, **entonces** son idénticos byte a byte. (Bloqueante, `@determinismo`, RNF-DET-003.)

### La escena

- **Dado** un beat resuelto en un sitio con una cara del reparto, **cuando** se compone su escena, **entonces** lleva el título del sitio, la línea de situación, el nombre y el puesto de quien habla, su parlamento, y el cierre de la escena.
- **Dado** esa misma escena, **cuando** se cuentan sus acciones, **entonces** hay exactamente una que avanza. (Escenario derivado de A4P3, «Un solo botón».)
- **Dado** esa misma escena, **cuando** se busca un retrato de la cara, **entonces** no hay ninguno: los retratos son exclusión 6 del PRD.
- **Dado** un beat cuyo texto del LLM está residente, **cuando** se compone la escena, **entonces** el texto que se enseña es el del LLM y su origen queda declarado.
- **Dado** ese mismo beat sin el texto del LLM, **cuando** se compone la escena, **entonces** se enseña el texto de la plantilla, con la misma composición, y ningún texto de la pantalla menciona que falte nada.
- **Dado** el resultado del beat, **cuando** se compone la pantalla de lo que te llevas, **entonces** lleva lo que se lleva, la información que empuja al siguiente y el **nombre** del sitio siguiente con su marca en el mapa. (A4P4.)
- **Dado** esa misma pantalla, **cuando** se busca en ella cualquier cifra, **entonces** no hay ninguna: ni cuánto falta, ni cuántos beats quedan, ni cuánto oro se lleva.
- **Dado** el último beat de una aventura, **cuando** se resuelve, **entonces** la pantalla de lo que te llevas no nombra ningún sitio siguiente y la aventura queda lista para cerrarse.

### Modo compañía: escrito para leerse en voz alta

RF-PJ-009 está marcado **⚠ sin escenario** en el PRD: estos criterios lo cubren.

- **Dado** todos los textos de escena del catálogo y todos los textos del LLM adoptados, **cuando** se buscan en ellos cifras, abreviaturas, siglas y símbolos que no se leen en voz alta, **entonces** no aparece ninguno.
- **Dado** un texto que contuviera uno de ellos, **cuando** se ejecuta la comprobación, **entonces** falla nombrando el texto y lo que encontró: el criterio se puede poner rojo.
- **Dado** todos los textos de escena del catálogo, **cuando** se buscan ranuras sin resolver, **entonces** no queda ninguna: la concordancia de género la resolvió el paquete de idioma antes de llegar a la pantalla.
- **Dado** la escena en pantalla, **cuando** se enumeran sus elementos y el registro de cada uno, **entonces** el único de registro de aplicación es el ajuste de tamaño de letra, y todo lo demás es voz del mundo.
- **Dado** la escena, **cuando** se cambia el tamaño de letra, **entonces** el texto de la escena cambia de tamaño sin salir de la escena y sin recargar nada.
- **Dado** ese cambio, **cuando** se sale de la escena y se entra en otra, **entonces** el tamaño elegido sigue puesto, y es el mismo valor que enseña la pantalla de ajustes.
- **Dado** un tamaño de letra fuera de la escala declarada, **cuando** se aplica, **entonces** falla nombrando el valor y la escala.
- **Dado** el ajuste de tamaño de letra, **cuando** se lee su etiqueta y su ayuda, **entonces** no aparece ninguna mención de accesibilidad, de dificultad de lectura ni de modo alguno.

### Nada degrada por falta de cableado

Aplicación directa de `pipeline/decisiones-orquestador.md` §6h.

- **Dado** el motor de la aventura en curso sin el reloj de pared cableado, **cuando** se resuelve un beat de franja, **entonces** falla nombrando el reloj, y no resuelve todas las llegadas como si fueran dentro.
- **Dado** el motor sin la vista de tenencia cableada, **cuando** se resuelve un beat `con_objeto`, **entonces** falla nombrando la tenencia, y no elige la vía alternativa por defecto.
- **Dado** el motor sin el registro de hechos cableado, **cuando** se acepta una aventura, **entonces** falla nombrando el registro.
- **Dado** una escena compuesta, **cuando** se inspecciona qué recibió, **entonces** recibió el beat casteado entero de SPEC-010 y no una copia recortada de su texto.
- **Dado** el área `aventuras` del estado, **cuando** se consultan las áreas que no reproducen, **entonces** ya no está entre ellas.

### Privacidad y red

- **Dado** una escena compuesta y un beat resuelto, **cuando** se cuenta cuántas peticiones de red se hicieron, **entonces** cero: en marcha no se invoca al LLM ni a nada. (RF-QUEST-008.)
- **Dado** el estado de una aventura en curso guardado, **cuando** se inspecciona, **entonces** no contiene ninguna coordenada: los lugares son identificadores de sitios del mundo congelado. (RF-PRIV-002.)

## UX Design

### Wireframe textual

**La escena — A4P3.** Pantalla completa, voz del mundo, sin cabecera de aplicación y sin flecha de volver. De arriba abajo:

- El **nombre de fantasía del sitio** en serif, pequeño y en la parte alta, que sitúa sin encabezar.
- El **titular de la escena** en serif grande —«Hay alguien esperando»—, que es lo que pasa aquí.
- La **línea de situación** en serif normal, un renglón o dos —«Sentada en el muro, con la caja en el regazo como si pesara más de lo que pesa.»—.
- La **cara que habla**: su nombre y su puesto en una línea en versalitas —«Sabela, la que reparte el correo»—, **sin retrato**, y debajo su **parlamento entrecomillado**, que es el bloque de texto más largo de la pantalla.
- El **cierre de la escena**, un renglón que remata el gesto —«Te la da con las dos manos, que es más de lo que hace falta para una caja de ese tamaño.»—.
- Abajo a la izquierda, el **ajuste de tamaño de letra**: una `A` pequeña con la etiqueta «Tamaño del texto», en sans, que es la única cosa de la pantalla que no es voz del mundo. Tocarla recorre la escala.
- Abajo, ocupando el ancho, **la única acción**, escrita con el verbo de lo que se hace y nunca «Continuar» —«Coger la caja»—.

**La escena sin cara.** Un beat cuya escena no tiene a nadie —un hallazgo, una visión, una emboscada— pierde el bloque de la cara y conserva todo lo demás, con el parlamento sustituido por el párrafo de la escena. La composición no cambia de sitio ningún otro elemento.

**Lo que te llevas — A4P4.** Pantalla completa, misma voz. De arriba abajo: el **rótulo** «Llevas encima» en versalitas; **lo que se lleva** en serif grande —«Una caja que no se abre hasta Monfrida»— con un renglón de detalle debajo; el **párrafo de información** que empuja al siguiente sitio; el **nombre del sitio siguiente** destacado, con su **línea de guiado por nombres de calzada** debajo —«Por el Camiño do Sal se llega antes.»—; y abajo la única acción, **«Seguir andando»**. Si el beat era el último de la cadena, no hay bloque de sitio siguiente y la acción es la misma.

**El ajuste de tamaño de letra.** No abre panel ni pantalla: cada toque avanza un escalón de la escala y vuelve al principio al pasarse. El texto de la escena cambia en el sitio. No hay número, no hay porcentaje y no hay previsualización.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec entrega:
  A4P3  pantalla 3 · artefacto 4 — La escena
  A4P4  pantalla 4 · artefacto 4 — Lo que te llevas

Pantallas que alimenta por debajo, sin ser su dueña:
  A2P4  pantalla 4 · artefacto 2 — La ficha            (dueña: fila 28)
  A4P6  pantalla 6 · artefacto 4 — La segunda vez      (dueña: fila 32)
  A5P2  pantalla 2 · artefacto 5 — El desenlace        (dueña: fila 36)
  A5P2B pantalla 2B · artefacto 5 — El cierre en corto (dueña: fila 36)
  A6P6  pantalla 6 · artefacto 6 — Los ajustes         (dueña: fila 38)

Elementos del proyecto que se usan: la tipografía serif de la voz del mundo, la
sans de la voz de la aplicación, la marca del mapa para el sitio siguiente.

Elemento nuevo: la escala de tamaño de texto — un vocabulario cerrado de escalones
con nombre, compartido entre la escena y los ajustes. Se declara aquí porque es
aquí donde se usa por primera vez, y la fila 38 la consume tal cual.
```

### data-testid

Los dos que `design-system.md` pide siempre son el estado del momento y el mapa; el mapa no está en esta pantalla, así que de ella cuelga el estado:

- `escena-estado` — el estado del momento, con un valor de un vocabulario cerrado: `escena`, `lo-que-te-llevas`, `sin-escena`
- `escena` — el contenedor de la escena, para afirmar composición
- `escena-cara` — el bloque de quien habla, ausente cuando no hay nadie
- `escena-accion` — la única acción que avanza
- `escena-tamano-texto` — el control de tamaño de letra
- `escena-texto` — el bloque de texto largo, sobre el que se afirma que el tamaño cambió
- `lo-que-te-llevas` — la pantalla del resultado
- `siguiente-sitio` — el nombre del sitio siguiente, ausente en el último beat

Sin más: el nombre del sitio, el titular, el parlamento y la línea de guiado son texto único dentro de sus contenedores.

### Patrón de interacción

- **Un solo botón, y con el verbo de lo que se hace.** Regla: `quests.md` §2, lineal de inicio, y exclusión 9 del PRD; «Continuar» sería un botón de aplicación y además desperdiciaría la única línea de acción que tiene la pantalla para contar algo.
- **La escena no se puede abandonar por atrás.** Regla: `bucle-jugable.md` §2, la llegada encadena y no se navega; una flecha de volver convertiría la secuencia en un menú y dejaría un beat a medio resolver, que es un estado que el motor no tiene.
- **El ajuste de tamaño de letra es un toque cíclico y no un control con panel.** Regla: `design-system.md`, ningún control de más y el mínimo de aplicación posible en este momento; un panel o un deslizador convertiría el único elemento de aplicación tolerado en una pantalla de ajustes dentro del juego.
- **El tamaño elegido persiste y es el mismo de los ajustes.** Regla: `personaje.md` §4, el modo compañía es una condición de la partida y no de una escena; dos valores distintos para lo mismo sería el bug que la pantalla de ajustes destaparía el primer día.
- **La franja no se anuncia nunca.** Regla: `quests.md` §2 y `bucle-jugable.md` §9; ni «llegaste tarde», ni «vuelve más tarde», ni un reloj en pantalla. Lo único que cambia es el texto, y quien juega no tiene por qué enterarse de que había una franja.
- **El objeto-llave tampoco se anuncia.** Regla: RF-PROG-006, la llave abre otra puerta al mismo beat; no hay «necesitas X», no hay candado y no hay lista de requisitos, porque el beat se resuelve por las dos vías.
- **Decisión no cubierta por el design system:** qué pasa si la app se cierra con la escena abierta y sin resolver. Se resuelve **dejando el beat sin resolver y la escena disponible**, igual que si no se hubiera mirado, porque la escena queda disponible y espera (`bucle-jugable.md`, momento 3) y resolver un beat por haber mirado convertiría abrir la app en una acción de juego.
- **Decisión no cubierta por el design system:** cuántos escalones tiene la escala de tamaño de texto. Se resuelve con **tres**, con nombre y sin cifras, porque es el mínimo que hace la diferencia visible a un brazo de distancia y el máximo que cabe en un toque cíclico sin que haya que contar cuántas veces se ha tocado.

## Notas técnicas

### Frontera de inyección

Una entrada nueva, con doble en Node:

1. **Reloj de pared** — devuelve el minuto del día en que se resuelve un beat. Está inyectado porque el paquete no lee el reloj del sistema (es la misma razón por la que el día llega como argumento en SPEC-015 y SPEC-016), y porque sin doble no se podría afirmar en `@nucleo` que llegar fuera de franja resuelve el beat igual. Dobles: uno dentro de cada franja del catálogo y uno fuera de todas. **El minuto no se guarda**: se usa para elegir la variante y se descarta, porque un histórico de a qué hora estuviste dónde es exactamente lo que RF-PRIV-002 prohíbe.

### El motor de la aventura en curso

Es lo que esta fila añade al paquete y conviene decir qué forma tiene, porque tres filas lo van a consumir:

- **El área `aventuras`** deja de estar declarada sin esquema. Guarda, por mapa, la aventura en curso —identificador, plantilla, cadena de beats casteada, beat en curso, beats resueltos con su vía y su variante— y las cerradas de la salida. Se congela y se levanta con el mismo lenguaje de esquema de SPEC-009, y **se reproduce** desde sus cuatro tipos de hecho, que ya estaban declarados desde SPEC-016 esperando este momento.
- **Tres transiciones y ninguna más**: aceptar, resolver el beat que toca, y cerrar. Cerrar devuelve **cómo acabó** —terminada o a medias— y con qué, que es exactamente lo que la fila 36 necesita para elegir entre el desenlace y el desenlace de repuesto, y lo que SPEC-012 ya sabe leer para decidir si nace rumor.
- **Ninguna transición inventa contenido.** El desenlace, el repuesto, el mote candidato y la declaración de rumor son de la plantilla y viajan tal cual; este motor los transporta y no los redacta.
- **Nada de esto es una fase de generación.** Es capa sobre el mundo congelado, como el motor de pasos, la propagación y el rango: no toca la tubería y no puede resembrar nada.

### El vocabulario de reproche y el de la lectura en voz alta

Dos listas cerradas, escritas como dato, que convierten dos reglas de tono en criterios que pueden ponerse rojos:

- **Reproche**, para las variantes de fuera de franja: *tarde*, *no llegaste*, *te has retrasado*, *ya no*, *podrías haber*, *si hubieras*, *has perdido*. La variante de fuera cuenta lo que pasó mientras tanto, nunca lo que quien juega dejó de hacer.
- **Lectura en voz alta**, para todo texto de escena: dígitos, `%`, `km`, `/`, paréntesis de aclaración, siglas en mayúsculas y abreviaturas con punto. Es la forma comprobable de «escrito para leerse en voz alta», y hereda de SPEC-017 la prohibición de números dentro de la prosa en lugar de reabrirla.

### Qué no se prepara para la ramificación

La ramificación de beats es exclusión 9 del PRD. Eso significa que aquí **no** se deja un hueco para dos opciones, ni un campo `opciones` vacío, ni un botón secundario oculto: el hecho `decision-en-aventura` sigue declarado en el catálogo de hechos porque quitarlo rompería la reconstrucción de partidas futuras, pero ninguna transición de este motor lo emite, y hay un criterio que lo afirma. Preparar la rama sería tomar la decisión por la vía de los hechos, que es el error que el PRD documenta con los retratos de NPC.

## Decisiones asumidas

- **Esta fila entrega el motor de la aventura en curso, que el checklist no le asigna** → asumido (alternativa: dejarlo a la fila 28 o a la 36 y que la escena avance sobre un estado inexistente). Regla: `interaction-format.md` obliga a abortar solo ante ambigüedad de producto, y aquí no la hay —el PRD describe aceptar, recorrer y cerrar en RF-QUEST-003, RF-QUEST-013 y RF-BUCLE-010—, solo falta de dueño. Se declara en lugar de colarse, y si la fila 28 ya lo entregó, manda ella.
- **El minuto del reloj se usa y no se guarda** → asumido (alternativa: anotar en el hecho del beat si se llegó dentro o fuera). Regla: RF-PRIV-002; saber a qué hora estuviste en un sitio concreto es histórico de posiciones con otro nombre, y la variante ya viaja en el estado sin necesidad del minuto.
- **La variante de fuera de franja es obligatoria en toda plantilla con beat de franja** → asumido (alternativa: dejarla opcional y caer al texto de dentro). Regla: §6h; un campo opcional hace indistinguibles «no la escribí» y «no hace falta», y caer al texto de dentro produciría escenas que hablan de una hora que no es.
- **Resolver dos veces el mismo beat es inocuo en lugar de un error** → asumido (alternativa: fallar). Regla: `bucle-jugable.md` §9, pasar cerca de un beat valida igual y es un regalo; y la app puede componer la misma escena dos veces por cerrarse y abrirse. Fallar convertiría una situación normal en un error, mientras que resolver el beat que **no** toca sí falla, porque eso sí es un cableado mal hecho.
- **La escala de tamaño de texto tiene tres escalones con nombre y sin cifras** → asumido (alternativa: un deslizador continuo, o heredar el tamaño del sistema operativo). Regla: `design-system.md`, ninguna cifra en pantalla y el mínimo de aplicación; heredar el del sistema se descarta porque el modo compañía es un ajuste del momento y no del dispositivo, y quien lee en voz alta a otra persona no va a cambiar el tamaño de toda su vida digital para eso.
- **La escena no se puede abandonar hacia atrás** → asumido (alternativa: una flecha de volver al mapa). Regla: `bucle-jugable.md` §2, la llegada encadena; y el mapa se alcanza igualmente terminando el beat, que es un toque.
- **Cerrar una aventura con cero beats resueltos la declara a medias y no la borra** → asumido (alternativa: tratarla como si no se hubiera aceptado). Regla: `bucle-jugable.md` §4, el cierre en corto da un final digno también a quien no llegó a empezar, y borrarla dejaría el hilo colgando que la decisión existe para evitar.
