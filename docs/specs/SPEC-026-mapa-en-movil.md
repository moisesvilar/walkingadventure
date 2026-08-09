# SPEC-026 — El mapa real, generado y pintado en el móvil

## Descripción

Cierra B4 juntando por primera vez todo lo que las cinco filas anteriores dejaron suelto: unas coordenadas reales entran por arriba, el Overpass del proyecto devuelve el terreno, los POIs y el callejero, el núcleo genera la celda, el documento se congela, los rótulos se colocan sin pisarse y Skia pinta la lámina. **Y todo eso tarda menos de un minuto en un móvil**, que es el entregable demostrable del bloque según el PRD §9 y el objetivo que se fijó al dibujar la pantalla de la generación.

Hasta aquí la app enseñaba un título de mundo sorteado sobre una semilla literal (SPEC-020) y el render sabía pintar mundos congelados de fichero (SPEC-021). Lo que no existía era la **capa que trae datos reales al móvil** ni la orquestación que encadena las fases dentro de él. Esta fila entrega esas dos cosas, más la **cámara** con la que se mira la lámina —arrastrar y acercar, con el norte siempre arriba— y el **instrumento que mide el minuto**, sin el cual el presupuesto de rendimiento es una intención y no un criterio.

Hay un invariante que manda sobre todos los demás y que conviene decir antes que nada: **el mapa que se pinta es el mundo congelado, no uno regenerado**. Levantar un mapa ocurre una vez; a partir de ahí, abrir la app, arrastrar, acercar, alejar, cambiar de estilo, girar el móvil o cerrar y volver leen el documento y jamás vuelven a llamar al generador ni a OpenStreetMap. Es RF-MUNDO-005 aplicado al sitio donde más fácil sería romperlo.

Anclas: **RF-MUNDO-001** (`docs/prd.md` §4.1) y **RNF-PER-001** (§5.5), con **RF-MAPA-005** en lo que toca al norte, **RNF-DET-001** y **RNF-DET-003** como invariantes bloqueantes, y **RF-PERS-001** (§4.10) como consecuencia: a partir de que el documento se escribe, el mapa deja de depender de OSM para siempre. Las fuentes que mandan sobre el PRD son `game-design/alcance-del-mundo.md` §2 (la rejilla de celdas anclada a coordenada redondeada) y `game-design/arquitectura.md`. Consume SPEC-003 (la celda y su semilla), SPEC-009 (el documento congelado), SPEC-020 (el proyecto de Expo y la frontera del paquete), SPEC-021 (la lámina y los cinco estilos), SPEC-022 (la colocación de rótulos), SPEC-023 (el proxy) y la fila 24 (el Overpass del proyecto), **que no está en disco al escribir esta spec**: de ella aquí solo se consume la ruta por la que llegan los datos, y si la nombra de otra manera, manda ella y esto se ajusta por iteración.

**Sobre RF-MUNDO-012, que el checklist asigna a esta fila:** ya está cumplido y verificado, y **esta spec no lo respecifica**. Está en «Lo que esta fila no respecifica».

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparecen el **traedor de datos de OSM** y el **cronómetro**, los dos inyectados y los dos con doble en Node. Están descritos en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** las **siete pantallas del onboarding** con su navegación, su progreso, su reanudación y sus textos —incluidas A1P4 «Dónde se levanta», con su pin arrastrable y su círculo de alcance, A1P5 «La generación» con sus fases en voz de mundo y A1P6 «Tu mapa, el día uno» con su párrafo del trato— que son la fila 27 (RF-PJ-001 a RF-PJ-008) y de las que aquí solo se entrega **lo que hay por debajo**; el **permiso de ubicación** y la alternativa de elegir el punto a mano (fila 27, RF-PJ-005); el **encuadre en marcha**, la marca de posición y los avisos sobre el mapa (fila 29, RF-MAPA-005 en lo que no sea el norte); las **tres tintas y el entintado al telón** (fila 36, RF-MAPA-004) —esta spec pinta con el conocimiento que el documento traiga y no lo cambia—; la **apertura de celdas vecinas** y el cosido en el borde (fila 41, RF-MUNDO-004); **levantar y operar el Overpass del proyecto** (fila 24, RF-INFRA-003); las **ilustraciones y las fotos** (fila 25); el **algoritmo de colocación de rótulos** (fila 22) y el **pintado** (fila 21), que aquí se consumen enteros; y la **pantalla de ajustes** donde vive la fila «Cómo se pinta» (fila 38).

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Levantar un mapa de punta a punta» y «La lámina en el móvil»; la **validación de entradas** en la coordenada fuera de rango, la respuesta de OSM que no es la esperada y el documento de una versión que el juego no entiende; el **estado vacío** en la celda en mitad del mar, la celda sin ningún POI y el arranque sin ningún mapa levantado; el **estado de error** en «Cuando la red no está» y en «Nada degrada por falta de cableado»; y los **casos límite** en el presupuesto del minuto, la app que se cierra a mitad de la generación, la celda urbana densa y el zoom donde el mundo entero cabe en cuatrocientos píxeles.

«Mundo de referencia» significa uno de los ocho extractos congelados de `test/fixtures/mundos-referencia/`. «Coordenada real de referencia» significa una de las cuatro con las que se capturaron los extractos de OSM: costero, urbano denso, barrio de tres calles y suelo de 250 m.

### Levantar un mapa de punta a punta, dentro del móvil

- **Dado** una coordenada real de referencia y ningún mapa levantado, **cuando** se levanta el mapa, **entonces** la celda se ancla a la coordenada redondeada y no a la coordenada exacta que entró.
- **Dado** ese mismo levantamiento, **cuando** termina, **entonces** hay un documento de celda escrito en el móvil que se puede volver a levantar sin tocar la red.
- **Dado** la misma coordenada y la misma semilla, **cuando** se levanta el mapa en el móvil y en Node con los mismos datos de OSM, **entonces** los dos documentos son idénticos byte a byte.
- **Dado** un mapa levantado en el móvil, **cuando** se recogen los nombres de sus núcleos, servicios, parajes, calzadas y ramales, **entonces** no hay ninguno repetido.
- **Dado** un mapa levantado en el móvil en una coordenada de Galicia y otro en una del interior, **cuando** se comparan sus nombres, **entonces** los primeros salen del paquete gallego y los segundos del castellano.
- **Dado** un mapa ya levantado, **cuando** se vuelve a abrir la app, **entonces** se pinta desde el documento y no se hace ninguna petición a OSM.
- **Dado** un mapa ya levantado, **cuando** se pide levantarlo otra vez en la misma coordenada, **entonces** no se resiembra: se abre el que ya existe.

### El minuto, medido de punta a punta

El presupuesto es de RNF-PER-001 y se mide sobre el **dispositivo de referencia declarado** y contra el Overpass del proyecto, con la caché del proxy fría. Lo que entra en el minuto es lo que la jugadora espera mirando la pantalla: consulta, parseo, generación, congelación, colocación de rótulos y primer pintado. Lo que no entra es el diálogo de permiso ni el tiempo que se pasa arrastrando el pin, porque los decide ella.

- **Dado** el dispositivo de referencia, la caché del proxy fría y una coordenada real de referencia, **cuando** se levanta el mapa, **entonces** desde que se confirma la coordenada hasta que la lámina está pintada pasa menos de un minuto.
- **Dado** las cuatro coordenadas reales de referencia, **cuando** se mide cada una, **entonces** ninguna pasa del minuto, y el reparto del tiempo entre consulta, generación, colocación y pintado queda declarado fase a fase.
- **Dado** una medida que se pasa del minuto, **cuando** se ejecuta la comprobación, **entonces** falla nombrando la coordenada y la fase que se lo comió.
- **Dado** la celda urbana densa, que es la peor de las cuatro, **cuando** se mide, **entonces** también cabe en el minuto.
- **Dado** la misma medida con la caché del proxy caliente, **entonces** queda declarada aparte y no sustituye a la medida en frío.
- **Dado** un cronómetro doblado que devuelve tiempos por encima del presupuesto, **cuando** se ejecuta la comprobación del minuto, **entonces** falla: el criterio se puede poner rojo.

### La lámina en el móvil

- **Dado** un mundo de referencia y el estilo Reino, **cuando** se pinta en el móvil, **entonces** se ve la lámina con su terreno, su mar, sus calzadas, sus núcleos y sus parajes.
- **Dado** la lámina pintada, **cuando** se recorren sus rótulos, **entonces** ninguna pareja de cajas se solapa.
- **Dado** la lámina pintada, **cuando** se arrastra, **entonces** la cámara se mueve y el mundo no.
- **Dado** la lámina pintada, **cuando** se acerca y se aleja, **entonces** cambia la escala y no cambia ni un nombre, ni un tipo, ni una posición del mundo.
- **Dado** la lámina en cualquier posición de la cámara y a cualquier acercamiento, **cuando** se mira, **entonces** el norte está arriba.
- **Dado** un gesto de rotación con dos dedos, **cuando** se hace sobre la lámina, **entonces** no ocurre nada: la cámara no tiene rotación.
- **Dado** la lámina pintada, **cuando** se cambia el estilo desde donde se cambie, **entonces** el mundo sigue idéntico byte a byte y solo cambian colores, grosores y tipografías.
- **Dado** un arrastre y un acercamiento cualesquiera, **cuando** se cuenta cuántas veces se ha llamado al generador, **entonces** cero.
- **Dado** una cámara alejada hasta que la celda entera cabe en la pantalla, **cuando** se pinta, **entonces** los rótulos que no caben se sacrifican por orden y los que quedan siguen sin pisarse.
- **Dado** el mapa cerrado y vuelto a abrir, **cuando** se pinta, **entonces** la cámara vuelve al encuadre que dejó y el documento no se ha tocado.

### Cuando la red no está o los datos no llegan

- **Dado** ningún mapa levantado y ninguna conexión, **cuando** se pide levantar uno, **entonces** no se levanta y el momento lo dice en voz de mundo, sin nombrar la red.
- **Dado** un mapa ya levantado y ninguna conexión, **cuando** se abre la app, **entonces** el mapa se pinta entero.
- **Dado** el Overpass del proyecto caído, **cuando** se pide levantar un mapa, **entonces** no se levanta a medias: o hay documento completo o no hay documento.
- **Dado** una respuesta de OSM que no encaja con lo que se pidió, **cuando** se parsea, **entonces** falla nombrando lo que llegó y no genera un mundo pobre en silencio.
- **Dado** una coordenada en mitad del mar, **cuando** se levanta el mapa, **entonces** la generación termina y el resultado declara que la celda no da para un mundo jugable, en lugar de entregar una celda vacía que parece un mundo.
- **Dado** una celda sin ningún POI utilizable, **cuando** se levanta, **entonces** el mundo se genera con lo que hay y la carencia queda declarada.
- **Dado** la app cerrada a mitad de la generación, **cuando** se vuelve a abrir, **entonces** no hay ningún documento a medias escrito, y levantar el mapa empieza otra vez.
- **Dado** un documento de una versión de formato que el juego no entiende, **cuando** se abre, **entonces** se dice y no se pinta media lámina.

### Nada degrada por falta de cableado

Aplicación directa de `pipeline/decisiones-orquestador.md` §6h, que en este repo ha salido cinco veces y tres de ellas por el mismo sitio: el callejero que no llegaba al grafo.

- **Dado** la orquestación del levantamiento sin traedor de datos cableado, **cuando** se construye, **entonces** falla nombrando la pieza que falta.
- **Dado** la orquestación sin colocador de rótulos cableado, **cuando** se construye, **entonces** falla nombrando el colocador, y no pinta con rótulos superpuestos.
- **Dado** la orquestación sin medidor de texto cableado, **cuando** se construye, **entonces** falla nombrando el medidor.
- **Dado** un levantamiento en el móvil, **cuando** se inspecciona qué recibió `buildWorld`, **entonces** recibió el grafo viario cosido y no la lista de vías en crudo.
- **Dado** un mapa levantado en el móvil, **cuando** se cuentan las componentes conexas de su grafo y sus aristas cosidas, **entonces** salen los mismos números que en Node con los mismos datos: el cosido de SPEC-007 está vivo dentro del móvil y no es código muerto.
- **Dado** un mapa levantado en el móvil, **cuando** se cuentan sus parajes que nacen de cruces y puentes, **entonces** no son cero en las cuatro coordenadas de referencia.

### Determinismo dentro del dispositivo

Bloqueante (`@determinismo`, RNF-DET-003).

- **Dado** la misma semilla y los mismos datos de OSM, **cuando** se levanta el mapa dos veces en el móvil, **entonces** los dos documentos son idénticos byte a byte.
- **Dado** los mismos datos de OSM llegando en distinto orden, **cuando** se levanta el mapa, **entonces** el documento es el mismo.
- **Dado** el código que la app añade en esta fila, **cuando** se busca en él, **entonces** no aparece `Math.random` ni `Date.now` dentro de nada que participe en la generación.
- **Dado** dos jugadoras con tramos distintos y la misma semilla, **cuando** levantan el mapa, **entonces** generan el mismo mundo.

## Lo que esta fila no respecifica

### RF-MUNDO-012 ya está cumplido y verificado

El checklist asigna **RF-MUNDO-012 (nombres únicos e idioma por ubicación)** a esta fila, que es de render. El desfase se detectó al escribir SPEC-007 y quedó anotado. Se declara aquí y no se arrastra más: **el requisito está implementado y verificado desde B1**, y esta spec no lo vuelve a especificar.

| Qué lo cumple | Dónde | Qué lo verifica |
| --- | --- | --- |
| Índice de nombres del mundo entero, no por familia | **SPEC-002-iter-1**, `packages/nucleo/names/` | `test/nucleo/generacion.test.mjs` → «No hay dos nombres iguales en un mundo» |
| `localeFor` una vez por mundo, con la interfaz completa del paquete de idioma | **SPEC-002**, `packages/nucleo/names/index.js` | `test/nucleo/generacion.test.mjs` → «El idioma sale de la ubicación», con los dos ejemplos de `docs/testing.md` |
| `ramalName` y la unicidad de los nombres de ramal como garantía, no como intento | **SPEC-007**, `packages/nucleo/world/grafo.js` | `test/nucleo/grafo.test.mjs` → «Todos los ramales de todos los mundos llevan nombre», «Agotadas las formas libres, el ramal recibe la forma construida sobre el nombre del paraje», «Un paquete de idioma sin `ramalName` falla nombrando la función que falta y el paquete que la incumple» |

Los tres grupos están en verde en el último report de suite completa del repo. Lo único que esta fila añade sobre el requisito es **dónde se afirma**: los dos criterios de la sección «Levantar un mapa de punta a punta» que comprueban unicidad e idioma **sobre el mundo generado dentro del móvil**, que es una afirmación que ninguna prueba de B1 podía hacer y que puede ponerse roja si la app cablea el paquete de idioma de otra manera. No es una redefinición de la regla: es la misma regla comprobada al otro lado de la frontera.

Lo que sí queda pendiente y no es de esta fila: la unicidad **entre celdas vecinas** de un mismo mapa, que aparece cuando se abren celdas y es de la fila 41 (RF-MUNDO-004).

## UX Design

### Wireframe textual

**La lámina, a pantalla completa.** Es el momento «de consulta» del mapa antes de que exista el bucle: sin barra de pestañas, sin cabecera y sin nada encima del dibujo. De borde a borde: el papel, el mar, la tierra, los bosques, los ríos, la costa, el callejero, las calzadas con su filete, los picos, los parajes, los núcleos con su placa de pergamino y sus puntos rojos, y el marco con la brújula, la cartela del título del mundo y la escala. Todo eso lo dibuja SPEC-021 y ninguno de esos elementos se decide aquí; lo que se decide aquí es que **no hay nada más en la pantalla**. Ni botones flotantes, ni un control de zoom, ni un botón de centrar, ni una leyenda: acercar y arrastrar son gestos, y el resto vive fuera.

**El estado de antes de levantar.** Cuando todavía no hay ningún mapa, la pantalla enseña el sitio vacío con una sola acción, **«Levantar el mapa aquí»**, en voz de mundo. Ese estado y su composición definitiva son de A1P4, de la fila 27; aquí existe en su forma mínima para que el flujo se pueda recorrer entero de punta a punta y se pueda medir el minuto.

**El estado de mientras se levanta.** Una lista de fases, una por línea, con marca de completada, con los literales que la pantalla ya dibujada usa: **«Mirando qué hay por ahí» · «Separando la tierra del agua» · «Repartiendo la gente» · «Trazando las calzadas» · «Buscando los sitios con historia» · «Poniéndole nombre a todo»**. Ni una barra con porcentaje, ni un contador, ni una estimación de segundos. La composición definitiva de esa pantalla es A1P5, de la fila 27; lo que esta fila entrega es **que el generador declare en qué fase va**, que es lo que hace que esa lista pueda existir sin inventarse nada.

**El estado de cuando no se puede levantar.** Una línea en voz de mundo que dice que hoy no se puede levantar el mapa aquí, y la misma acción para volver a intentarlo. Ninguna mención de la red, del servidor, de un código de error ni de un reintento automático.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec alimenta por debajo:
  A1P4  pantalla 4 · artefacto 1 — Dónde se levanta        (dueña: fila 27)
  A1P5  pantalla 5 · artefacto 1 — La generación           (dueña: fila 27)
  A1P6  pantalla 6 · artefacto 1 — Tu mapa, el día uno     (dueña: fila 27)
  A3P2  pantalla 2 · artefacto 3 — Si miras                (dueña: fila 29)

Elementos del proyecto que se usan: la lámina, la cartela, el marco, la brújula, la
escala, la placa de los rótulos de núcleo, el halo de los rótulos de paraje.

Elemento nuevo: la cámara de la lámina — centro, radio y tamaño, sin rotación.
No es un componente visible: es el estado con el que se pinta, y se declara aquí
porque SPEC-021 lo expone y deja a esta fila quién lo mueve.
```

### data-testid

Los dos que `design-system.md` pide siempre son aquí el estado del momento y el mapa, y de ellos cuelga todo lo demás:

- `mapa-estado` — el estado del momento, con un valor de un vocabulario cerrado: `sin-mapa`, `levantando`, `pintado`, `no-se-pudo`
- `mapa-lamina` — la lámina pintada, el contenedor sobre el que se hacen los gestos
- `mapa-camara` — el centro, el radio y el tamaño con los que se está pintando, para poder afirmar que un gesto movió la cámara y no el mundo
- `levantar-mapa` — la acción de levantar el mapa
- `generacion-fases` — la lista de fases, para afirmar que están todas y en orden

Sin más: el título del mundo, los nombres de los núcleos y el texto del estado de fallo son texto único y se localizan por su contenido.

### Patrón de interacción

- **Arrastrar y acercar son gestos, y no hay controles.** Regla: `design-system.md`, «Qué NO lleva ninguna pantalla» y el momento «de consulta»; un par de botones de más y menos convertiría la lámina en un mapa de aplicación, que es justo lo contrario de lo que el estilo Reino existe para ser.
- **La cámara no rota, y el gesto de rotación se ignora en silencio.** Regla: `docs/testing.md`, «El norte está siempre arriba», y RF-MAPA-005. Ignorar en silencio, y no rebotar con una animación, porque una animación de rechazo es la app hablando.
- **La espera de la generación se cuenta en fases y no en cifras.** Regla: `design-system.md`, ninguna cifra de progreso; y `docs/pantallas.md`, «por debajo del minuto, una lista de fases basta y no hace falta entretener a nadie». Que la lista baste es exactamente lo que el presupuesto del minuto sostiene: si el minuto se rompe, esta decisión de UX se cae con él.
- **Levantar el mapa es irreversible y se dice antes, no después.** Regla: `alcance-del-mundo.md` §2 y RF-MUNDO-005; el flujo ya marca esa arista como el punto desde el que no se vuelve. Aquí eso significa que no hay ninguna acción de «regenerar» en ninguna pantalla, y que su ausencia es deliberada.
- **El fallo al levantar habla como mundo, no como aplicación.** Regla: `design-system.md`, los dos registros; con la excepción declarada de que este momento cae **antes** del botón de «salir a andar» y por tanto está dentro del onboarding, donde el registro es de aplicación. Se resuelve con el registro de la pantalla que lo aloja, que decide la fila 27; lo que esta fila fija es que el texto **no nombre la red** en ninguno de los dos registros, porque eso no es registro sino información que nadie puede usar.
- **Decisión no cubierta por el design system:** qué encuadre inicial toma la cámara al terminar de generar. Se resuelve **encuadrando la celda entera con margen**, porque el primer mensaje de A1P6 es que esto es tu barrio con otra ropa y eso solo se ve entero; abrir acercada obligaría a alejar para entender la lámina.

## Notas técnicas

### Frontera de inyección

Dos entradas nuevas, las dos con doble en Node:

1. **Traedor de datos de OSM** — recibe la celda —centro y radio— y devuelve terreno, POIs y callejero ya parseados a la forma que el núcleo consume. Detrás está la ruta de generación del proxy y el Overpass del proyecto (fila 24), y esta spec no decide cuál de los dos responde. Dobles: los cuatro extractos congelados de `test/fixtures/osm/`, un doble que falla siempre y otro que responde algo que no encaja.
2. **Cronómetro** — el que mide el minuto. Está inyectado por dos razones: porque `packages/nucleo/` no lee el reloj del sistema y la orquestación vive en la frontera, y porque un presupuesto que solo se puede medir en un dispositivo real no se puede poner rojo en la suite.

El **colocador de rótulos** y el **medidor de texto** ya entraron con SPEC-021 y SPEC-022 y aquí solo se cablean; lo que esta spec añade es que su ausencia sea error de construcción.

### El dispositivo de referencia y qué se mide

El minuto no significa nada sin decir sobre qué. Se declara un **dispositivo de referencia de gama media** y se mide sobre él, y las medidas se registran fase a fase para que un incumplimiento futuro nombre a su culpable en lugar de decir «va lento». Las cuatro coordenadas son las mismas con las que se capturaron los extractos de OSM, así que la medida en dispositivo y la reproducción en Node comparten datos de entrada y son comparables.

El reparto por fases es además la única forma honesta de repartir el presupuesto entre filas: la consulta la sostiene la fila 24, la generación la sostienen B1 y B2, la colocación la sostiene la fila 22 y el pintado la fila 21. Si el minuto se rompe, se rompe en una fase con dueño.

### Lo que llega y lo que se congela

La secuencia dentro del móvil es la de `build.js`, sin variantes: datos → máscara de mar y radio → núcleos y servicios → pegado al viario → grafo cosido → calzadas → parajes → ramales → filtro de accesibilidad → casting → congelación. Lo que esta fila añade no es una fase: es el **cableado completo y comprobable** de esa tubería dentro del dispositivo, con la garantía —criterio explícito— de que a `buildWorld` le llega el grafo cosido y no la lista de vías, que es la degradación silenciosa que ya apareció tres veces.

## Decisiones asumidas

- **El minuto se mide desde que se confirma la coordenada hasta que la lámina está pintada** → asumido (alternativa: medir solo la generación, o incluir también el diálogo de permiso). Regla: RNF-PER-001 sale de A1P5, que es lo que la jugadora ve esperando; el permiso lo decide ella y no puede entrar en un presupuesto de rendimiento.
- **La medida canónica es con la caché del proxy fría** → asumido (alternativa: medir en caliente, que es lo que verá la mayoría). Regla: el objetivo se fijó para que la espera no caiga en el onboarding, y en el onboarding la caché de esa celda está fría por definición; la medida en caliente se registra aparte para no perderla.
- **El dispositivo de referencia se declara y la comprobación se puede ejecutar con un cronómetro doblado** → asumido (alternativa: que el criterio del minuto solo exista como revisión manual). Regla: §6o de `pipeline/decisiones-orquestador.md`; un criterio que solo se puede comprobar a mano y en un despacho no se pone rojo nunca, y por tanto no mide nada.
- **La cámara guarda su encuadre entre aperturas de la app** → asumido (alternativa: volver siempre al encuadre inicial). Regla: la cámara es estado de pantalla y no del mundo, así que guardarla no toca ningún invariante; y volver al encuadre inicial cada vez castiga a quien estaba mirando una esquina.
- **Una celda que no da para un mundo jugable se declara en lugar de entregarse vacía** → asumido (alternativa: entregar la celda con lo que salga, que es lo que hoy hace la tubería con un mundo pobre). Regla: §6h; una celda en mitad del mar que devuelve un documento válido y vacío es exactamente una pieza que, al no estar, no protesta. Qué hace la app con esa declaración —ofrecer otro sitio, ofrecer el estirón— es de la fila 27.
- **El gesto de rotación se ignora sin ninguna respuesta visible** → asumido (alternativa: una animación de rebote que diga que no se puede). Regla: `design-system.md`, dentro del juego cualquier cosa que solo se pueda decir como aplicación es señal de rediseñar el momento; y el norte arriba no es una restricción que haya que explicar, es cómo son los mapas de este juego.
- **La orquestación del levantamiento vive en `app/` y no en el paquete** → asumido (alternativa: una función del paquete que lo encadene todo con la E/S inyectada). Regla: RF-INFRA-001, el paquete no habla con la red; encadenar consulta, generación, escritura y pintado es precisamente la frontera, y meterla dentro obligaría a inyectarle media plataforma.
