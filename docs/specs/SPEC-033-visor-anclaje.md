# SPEC-033 — El visor del anclaje y la ficha de texto

## Descripción

Entrega el momento por el que existe el juego: llegas a un sitio, está el mundo delante, y arrastrando un tirador se cruza a la foto del lugar real con su nombre real en la cartela. **El chiste y la magia son el mismo** —que O Torreón Esquecido *es el chiringuito de Manolo*—, y esta fila decide cómo se enseña: qué lado abre, cómo se cruza, qué dice cada cartela, cuándo aparece solo y cuándo queda a un toque.

Y entrega la otra mitad, que es la que sostiene el momento cuando no hay imagen: **la ficha de texto**. Un paraje que te pilló de paso no tiene ilustración porque las ilustraciones solo existen para el reparto de la aventura aceptada, y el modo sin cobertura deja el mundo entero en ese estado. La ficha no es una pantalla de fallo: es nombre de fantasía, qué es en realidad y la escena —los tres datos que hacen el chiste—, y **no dice en ningún sitio que falte nada**, porque anunciarlo solo serviría para señalar algo que quien juega no puede arreglar.

Lo que hace difícil esta fila no es el arrastre: es que **hay tres presentaciones y una sola regla que elige entre ellas**, y esa regla tiene que ser determinista y comprobable sin dispositivo. Con ilustración y con foto, el visor completo. Con ilustración y sin foto —cruceiros, molinos, miradores, que son justamente los anclajes que ensanchan el vocabulario de escenas—, el visor **abre igual** y el arrastre descubre la cartela sobre fondo liso: se pierde la foto, no el momento. Sin ilustración, la ficha. Esa elección es una función pura del sitio, de los recursos residentes y de si ya habías estado, y por eso vive en el paquete y se afirma en `@nucleo`.

Anclas: **RF-BUCLE-007** y **RF-BUCLE-008** (`docs/prd.md` §4.7). Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` §2 (el visor como capa y no como paso, la segunda vez, la foto que se pide al crear el mapa y el caso sin foto) y el artefacto 4 de `docs/pantallas/`, pantallas A4P1, A4P2, A4P6 y A4P7 del flujo. Consume **SPEC-025** (las ilustraciones por su prompt de ficción, las fotos por su `place_id`, los dos estados `ausente`/`residente` y los motivos de ausencia ya declarados en `packages/nucleo/partida/recursos.js`), **SPEC-009** (el sitio del mundo congelado con su nombre de fantasía, su tipo y su anclaje real), **SPEC-006** (el tipo de paraje y su escena, que son lo que la ficha cuenta), **SPEC-016** (los sitios pisados, que es lo que distingue la primera vez de la segunda) y **SPEC-021** (la lámina, para la marca; el visor no la usa, pero comparte pantalla con ella).

Y consume la **fila 32** (`llegadas-geofence`, RF-BUCLE-005 y RF-BUCLE-006), que es la dueña de la secuencia de una llegada y de la validación del geofence, y **que no está en disco al escribir esta spec**: de ella aquí solo se consume que existe un momento «parada dentro del geofence de este sitio» y que hay un sitio identificado. Si la nombra de otra manera, manda ella y esto se ajusta por iteración.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparece el **lector de recursos binarios**, que dice si una ilustración o una foto están residentes y las entrega para pintarlas. Está descrito en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** la **validación de la llegada** y la **secuencia** visor → beat → lo que aquí se cuenta (fila 32, RF-BUCLE-005 y RF-BUCLE-006), de la que aquí solo se entrega el primer eslabón y la garantía de que se cierra dejando el resto debajo; la **escena del beat** con su botón, su texto y su ajuste de letra (fila 34, A4P3 y A4P4); **lo que aquí se cuenta** al llegar a un núcleo (fila 12, ya entregado, y su pantalla A4P5, de la fila 32); el **descarte del anclaje** que cuelga de la ficha (fila 35, A4P8), del que aquí solo se entrega **el sitio donde se toca**; la **generación y la descarga** de ilustraciones y fotos, sus lotes, sus presupuestos y su degradación silenciosa (fila 25, ya entregada), de la que aquí solo se consumen los estados y los motivos de ausencia; el **mapa en marcha** y su marca (fila 29); y la **capa de conocimiento** que sube un sitio de «lo ves» a «lo conoces» al mirarlo (fila 36, RF-BUCLE-012), que aquí se alimenta —esta fila declara qué se ha mirado— pero no se cobra.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`, y los que reproducen un escenario ya escrito llevan su nombre literal para que se puedan cruzar con un grep. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La presentación se elige sola» y «El arrastre»; la **validación de entradas** en el sitio sin nombre de fantasía, el recurso declarado residente que no está y la posición de tirador fuera de rango; el **estado vacío** en el sitio sin ilustración, el sitio sin foto y el mundo entero sin un solo recurso; el **estado de error** en «Ninguna pantalla llama fallo a esto» y en «Nada degrada por falta de cableado»; y los **casos límite** en la segunda visita, el sitio pisado en una salida anterior y el arrastre interrumpido a mitad.

«Mundo de referencia» significa uno de los ocho extractos congelados de `test/fixtures/mundos-referencia/`. **«Residente» y «ausente»** son los dos estados que ya declara `packages/nucleo/partida/recursos.js` y no hay un tercero.

### La presentación se elige sola, y hay exactamente tres

- **Dado** un sitio con ilustración residente y foto residente que no se había pisado, **cuando** se resuelve qué enseña su llegada, **entonces** la presentación es el visor con sus dos lados y abre por el lado de la ficción.
- **Dado** un sitio con ilustración residente y **sin** foto, **cuando** se resuelve, **entonces** la presentación sigue siendo el visor, abre por la ficción, y su lado real es la cartela sobre fondo liso.
- **Dado** un sitio **sin** ilustración, **cuando** se resuelve, **entonces** la presentación es la ficha de texto, tenga o no tenga foto.
- **Dado** cualquier sitio de cualquiera de los ocho mundos de referencia y cualquier combinación de recursos residentes, **cuando** se resuelve su presentación, **entonces** el resultado es una de esas tres y nunca ninguna otra ni ninguna vacía.
- **Dado** el mismo sitio, los mismos recursos y el mismo registro de sitios pisados, **cuando** se resuelve la presentación dos veces, **entonces** las dos resoluciones son idénticas.
- **Dado** un sitio cuya ilustración está declarada residente y cuyo binario no está en el almacén, **cuando** se resuelve, **entonces** falla nombrando el sitio y el recurso, en lugar de abrir un visor con un lado en blanco.
- **Dado** un sitio sin nombre de fantasía, **cuando** se pide su presentación, **entonces** falla nombrando el sitio, y no devuelve una cartela vacía.

### El visor abre por la ficción la primera vez

Reproduce el escenario homónimo de `docs/testing.md`.

- **Dado** un sitio con ilustración que no se conocía, **cuando** se abre la app parada dentro de su geofence, **entonces** se ve la ilustración de fantasía y el nombre inventado.
- **Dado** ese mismo visor recién abierto, **cuando** se mira el tirador, **entonces** está en el borde del lado de la ficción.
- **Dado** ese mismo visor recién abierto, **cuando** se lee su cartela, **entonces** dice el tipo del sitio y su nombre de fantasía, y no dice el nombre real.
- **Dado** un jugador que atraviesa el geofence de un sitio **sin pararse**, **cuando** sigue andando, **entonces** el visor no se abre. (Escenario «El visor no aparece nunca andando».)

### El arrastre descubre el sitio real

- **Dado** el visor abierto por el lado de la ficción, **cuando** se arrastra el tirador hasta el final, **entonces** aparece la foto del lugar real y la cartela dice el nombre real. (Escenario «Arrastrar descubre el sitio real».)
- **Dado** un sitio del que Places no tiene foto, **cuando** se arrastra el tirador hasta el final, **entonces** aparece la cartela con el nombre real sobre fondo liso. (Escenario «Sin foto de Places, el visor abre igual».)
- **Dado** el tirador en cualquier posición intermedia, **cuando** se lee qué cartela está puesta, **entonces** es la de ficción hasta el punto de cruce y la real a partir de él, y nunca las dos a la vez.
- **Dado** un arrastre soltado antes del punto de cruce, **cuando** se suelta, **entonces** el tirador vuelve al lado de la ficción y la cartela no ha cambiado.
- **Dado** una posición de tirador fuera del rango declarado, **cuando** se pide la cartela que corresponde, **entonces** falla nombrando el valor recibido.

### El visor es una capa y no un paso

- **Dado** el visor abierto en un sitio con beat, **cuando** se cierra el visor, **entonces** aparece la escena. (Escenario «El visor es una capa y debajo está el beat».)
- **Dado** el visor abierto en un sitio sin beat, **cuando** se cierra el visor, **entonces** aparece la ficha del sitio.
- **Dado** el visor abierto, **cuando** se toca fuera de él, **entonces** se cierra igual que con la flecha, y lo que queda debajo es lo mismo.
- **Dado** una llegada completa a un sitio, **cuando** se cuenta cuántas veces hubo que tocar algo para llegar a lo que se había venido a hacer, **entonces** el visor no añade ninguna: cerrarlo es la única y existe también sin él.

### La segunda vez no se abre solo, y queda a un toque

- **Dado** un sitio que ya se había pisado, **cuando** se llega y se abre la app, **entonces** la presentación no abre el visor sola y lo deja disponible con un toque. (Escenario «La segunda vez el visor no se abre solo».)
- **Dado** ese mismo sitio, **cuando** se toca la acción de volver a mirarlo, **entonces** se abre el mismo visor, con los mismos dos lados y el mismo tirador en el borde.
- **Dado** un sitio pisado en una salida anterior y no en esta, **cuando** se llega, **entonces** cuenta como segunda vez: el registro de sitios pisados no se vacía al echar el telón.
- **Dado** la llegada a un sitio nuevo, **cuando** se resuelve la presentación, **entonces** se resuelve contra el registro de sitios pisados **anterior a esta llegada**, y la anotación de que se ha pisado se hace después.
- **Dado** una misma llegada resuelta dos veces sin salir de ella —la app se cierra y se vuelve a abrir sin moverse—, **cuando** se compara, **entonces** la presentación es la misma las dos veces y el visor no vuelve a abrirse solo.

### La ficha de texto, que es la misma con imagen que sin cobertura

- **Dado** un paraje que no es beat de ninguna aventura, **cuando** se para dentro de su geofence, **entonces** ve el nombre de fantasía, qué es en realidad y la escena. (Escenario «Llegar sin haber venido a nada da la ficha del sitio».)
- **Dado** esa misma ficha, **cuando** se recorre su texto entero, **entonces** ningún texto lo llama error ni falta.
- **Dado** un mundo entero sin un solo recurso residente —el modo sin cobertura—, **cuando** se resuelven las presentaciones de todos sus sitios, **entonces** todas son la ficha de texto y ninguna difiere en composición de la ficha de un sitio que sí tenía foto.
- **Dado** una ficha de paraje, **cuando** se compara «qué es en realidad» con el tipo de fantasía, **entonces** pueden no tener nada que ver, y eso no es un fallo: el tipo está desacoplado del anclaje a propósito.
- **Dado** un sitio cuyo anclaje real no tiene nombre en OSM, **cuando** se compone su ficha, **entonces** la línea de «qué es en realidad» dice lo que es por su etiqueta y no queda vacía ni dice que se desconoce.

### Ninguna pantalla llama fallo a esto

Aplicación directa de RNF-RED-001 y del principio de fallback digno. El vocabulario prohibido es una lista cerrada y se comprueba sobre **todos** los textos que esta capa produce, no sobre una muestra.

- **Dado** todos los textos que esta capa produce —cartelas, ficha y la acción de volver a mirar— sobre los ocho mundos de referencia y en los dos idiomas, **cuando** se buscan en ellos las palabras del vocabulario prohibido, **entonces** no aparece ninguna.
- **Dado** un texto de esta capa que contuviera una de esas palabras, **cuando** se ejecuta la comprobación, **entonces** falla nombrando el texto y la palabra: el criterio se puede poner rojo.
- **Dado** el sitio sin foto, **cuando** se lee todo lo que se enseña en el lado real, **entonces** no hay ninguna mención de la foto, de la red, ni de que el lado esté incompleto.
- **Dado** la ficha de texto, **cuando** se lee entera, **entonces** no hay ninguna acción de reintentar, ninguna de descargar y ninguna de conectarse.

### Nada degrada por falta de cableado

Aplicación directa de `pipeline/decisiones-orquestador.md` §6h.

- **Dado** la composición de una llegada sin lector de recursos cableado, **cuando** se construye, **entonces** falla nombrando la pieza que falta.
- **Dado** la composición de una llegada sin el registro de sitios pisados cableado, **cuando** se construye, **entonces** falla nombrando el registro, y no trata todas las llegadas como primeras.
- **Dado** un sitio cuyos recursos se consultan, **cuando** se inspecciona qué recibió la resolución de la presentación, **entonces** recibió el inventario de recursos del mundo congelado y no una lista vacía por defecto.
- **Dado** una resolución de presentación, **cuando** se cuenta cuántas peticiones de red se hicieron, **entonces** cero: aquí no se llama a la red para nada.

### Privacidad

Bloqueante (`@privacidad`, RNF-PRIV-001).

- **Dado** una llegada a un sitio con visor abierto y arrastrado hasta el final, **cuando** se inspecciona el tráfico saliente, **entonces** no sale ninguna petición.
- **Dado** el registro que esta capa escribe al mirar un sitio, **cuando** se inspecciona, **entonces** es el identificador del sitio y el momento, y ninguna coordenada.

## UX Design

### Wireframe textual

**El visor, lado de la ficción — A4P1.** Capa a pantalla completa por encima de lo que haya debajo. De arriba abajo: la **flecha de cierre** `▾` centrada en el borde superior; la **imagen** ocupando el alto, que es la ilustración de ficción; el **tirador** `◂ ▸` pegado al borde de la imagen por el lado desde el que se arrastra; y abajo la **cartela** sobre placa de pergamino con tres líneas: el **tipo** en pequeño y en versalitas —«Paraje · vigilancia»—, el **nombre de fantasía** en serif grande, y una línea de invitación —«Arrastra para ver qué hay de verdad.»—. Nada más: ni botón de cerrar en texto, ni indicador de página, ni contador.

**El visor, arrastrado — A4P2.** La misma capa con la imagen cruzada a la foto real, la flecha de cierre en su sitio y el tirador desplazado. La cartela cambia y pasa a tres líneas: un **rótulo de encabezado** —«Y en realidad»—, el **nombre real** en serif grande, y una línea de remate escrita a costa del desajuste y nunca del sitio —«Cierra a las ocho. La torre lleva ahí bastante menos de lo que dicen.»—. La línea de invitación desaparece: ya se arrastró.

**El visor sin foto.** Idéntico, con el lado real pintado como **fondo liso** del papel del estilo en lugar de la foto, y la cartela con las mismas tres líneas. No hay ningún hueco de imagen dibujado, ningún icono de imagen rota y ninguna leyenda.

**La segunda vez — A4P6.** El visor no es la capa que abre. Lo que abre es lo que ha cambiado, y el visor queda en **una acción de texto** con el nombre del sitio —«Volver a mirar la torre»— colocada junto a la acción de seguir. Tocarla abre exactamente la capa de A4P1.

**La ficha de texto — A4P7.** Pantalla, no capa. De arriba abajo: el **tipo** en versalitas —«Paraje · refugio»—, el **nombre de fantasía** en serif grande, la línea de **qué es en realidad** —«En realidad: el lavadero municipal.»—, el párrafo de **la escena**, y una línea que sitúa la visita sin explicarla —«No has venido a nada. Simplemente pasabas.»—. Abajo, dos acciones: **«Este sitio no pega»** en tono discreto, que lleva a A4P8 y es de la fila 35, y **«Seguir andando»**, que cierra el momento.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec entrega:
  A4P1  pantalla 1 · artefacto 4 — El visor, lado de la ficción
  A4P2  pantalla 2 · artefacto 4 — El visor, arrastrado
  A4P7  pantalla 7 · artefacto 4 — La ficha de texto

Pantallas que alimenta por debajo, sin ser su dueña:
  A4P6  pantalla 6 · artefacto 4 — La segunda vez        (dueña: fila 32)
  A4P8  pantalla 8 · artefacto 4 — El sitio que no pega  (dueña: fila 35)
  A4P3  pantalla 3 · artefacto 4 — La escena             (dueña: fila 34)

Elementos del proyecto que se usan: la cartela sobre placa de pergamino, la
tipografía serif de la voz del mundo, el papel del estilo activo.

Elemento nuevo: el tirador del visor — la posición de cruce entre los dos lados,
expresada de 0 (ficción) a 1 (real), con su punto de cruce declarado. No es un
componente heredado de ninguna spec anterior y se declara aquí.
```

### data-testid

Los dos que `design-system.md` pide siempre son aquí el estado del momento y el mapa; el mapa queda debajo y no lo toca esta fila, así que de ella cuelga el estado. **Cuatro de estos identificadores ya los declaró SPEC-025** —`visor-anclaje`, `visor-lado-real`, `visor-cartela` y `ficha-texto`— y aquí se conservan literales en lugar de renombrarse: cambiarlos rompería las pruebas de aquella fila sin ganar nada.

- `llegada-estado` — el estado del momento al parar, con un valor de un vocabulario cerrado: `visor`, `visor-sin-foto`, `ficha`, `visor-a-un-toque`
- `visor-anclaje` — la capa entera, para afirmar que está y que se cierra *(ya declarado en SPEC-025)*
- `visor-lado-real` — el lado real, el que aparece al arrastrar, con o sin foto *(ya declarado en SPEC-025)*
- `visor-cartela` — la cartela, para leer qué nombre dice *(ya declarado en SPEC-025)*
- `ficha-texto` — la ficha de texto entera *(ya declarado en SPEC-025)*
- `visor-tirador` — el tirador, sobre el que se hace el gesto
- `visor-cerrar` — la flecha `▾`
- `visor-abrir` — la acción de «volver a mirar», la que existe solo la segunda vez

Sin más: el tipo, el nombre de fantasía, el nombre real, la línea de «en realidad» y el párrafo de la escena son texto único dentro de sus contenedores y se localizan por su contenido.

### Patrón de interacción

- **El visor es una capa modal sin botón de aceptar.** Regla: `bucle-jugable.md` §2 y el artefacto 4, «el visor es una capa y no un paso». Se cierra con la flecha o tocando fuera, y las dos salidas son equivalentes; no hay confirmación porque no hay nada que confirmar y una confirmación lo convertiría en el trámite que la decisión evita.
- **El arrastre es un slider de dos posiciones estables, no un carrusel.** Regla: el momento es una revelación y no una galería; soltar antes del cruce devuelve al lado de la ficción, soltar después lo lleva al real, y no hay terceras láminas. Un carrusel prometería más lados de los que hay.
- **La invitación se escribe, no se anima.** Regla: `design-system.md`, ningún control tocable de más y ninguna pedagogía; el tirador en el borde ya enseña que hay algo debajo, y la línea de la cartela lo dice en voz de mundo. Nada de flechas parpadeantes ni de tutoriales.
- **La segunda vez el visor es una acción con el nombre del sitio, no un icono.** Regla: `design-system.md`, la voz del mundo; «Volver a mirar la torre» es del mundo y un icono de lupa es de la aplicación, y este momento no admite el registro de aplicación.
- **La ausencia de foto no se representa: se sustituye.** Regla: `bucle-jugable.md` §2, «se pierde la foto, no el momento», y RNF-RED-001; un placeholder de imagen es exactamente el anuncio de falta que la decisión prohíbe.
- **La ficha no es un estado vacío del visor: es una pantalla del juego.** Regla: `design-system.md`, el fallback digno; por eso lleva las mismas tipografías, la misma jerarquía y las mismas acciones que cualquier otra pantalla del momento, y no una ilustración gris con un texto de disculpa.
- **Decisión no cubierta por el design system:** dónde queda el tirador cuando el visor se reabre a un toque. Se resuelve **volviendo al borde de la ficción**, porque abrir por el lado real regalaría la revelación a quien ya la tenía y convertiría la acción en una consulta de datos; quien vuelve a mirar quiere volver a ver el cruce.
- **Decisión no cubierta por el design system:** qué pasa si el gesto se suelta exactamente en el punto de cruce. Se resuelve **cayendo al lado real**, porque el gesto ya recorrió lo suficiente y devolverlo a la ficción se lee como un rechazo del sistema.

## Notas técnicas

### Frontera de inyección

Una entrada nueva, con doble en Node:

1. **Lector de recursos binarios** — recibe una clave de recurso —la de ilustración por su prompt, la de foto por su `place_id`, las dos ya declaradas en `packages/nucleo/partida/recursos.js`— y responde si está residente y entrega el binario para pintarlo. Está inyectado porque el paquete no lee del disco del dispositivo, y porque es lo que permite afirmar en `@nucleo` los tres casos de presentación sin un solo fichero de imagen. Dobles: uno con los dos recursos, uno con solo la ilustración, uno con nada, y uno que declara residente lo que luego no entrega.

El **inventario de recursos** del mundo congelado ya llega con el documento (SPEC-009 y SPEC-025) y aquí solo se lee.

### Dónde vive la decisión

La elección de presentación, la composición de las dos cartelas y la composición de la ficha **son funciones puras del paquete**: entran el sitio del mundo congelado, el inventario de recursos, la respuesta del lector y el registro de sitios pisados; sale una descripción de qué enseñar. Lo que vive en `app/` es el gesto, el pintado y el ciclo de vida de la capa. Esa raya es lo que hace que casi todos los criterios de esta fila se puedan afirmar en `@nucleo` sin simulador, que es una restricción real de esta máquina y no una preferencia.

### El vocabulario prohibido

La lista cerrada de palabras que ningún texto de esta capa puede contener, que es lo que convierte «sin anunciar que falte nada» en algo comprobable en lugar de en una intención: *error*, *fallo*, *no disponible*, *sin conexión*, *sin cobertura*, *reintentar*, *cargar*, *descargar*, *imagen no*, *foto no*, *falta*, *pendiente*. Va escrita en el código como dato y se comprueba sobre todo lo que la capa produce, incluidos los textos de plantilla del catálogo que la ficha reutiliza. Si algún día un texto legítimo necesitara una de esas palabras, se cambia la lista y se dice por qué, que es justo el debate que se quiere obligar a tener.

### Qué anota esta capa y qué no

Mirar un sitio deja **una anotación por su identificador**: el sitio queda pisado y, cuando la fila 36 exista, sube de «lo ves» a «lo conoces». Lo que esta capa no hace es cobrarlo: el entintado llega de golpe al telón y aquí no se dibuja nada en el mapa, no vibra nada y no se felicita nada. Es la misma frontera que ya respetan el motor de pasos y la propagación.

## Decisiones asumidas

- **El punto de cruce del tirador está en la mitad del recorrido y soltar en él cae al lado real** → asumido (alternativa: un cruce más cerca del final, que obligaría a un arrastre casi completo). Regla: el gesto tiene que sentirse ganado pero nunca costoso; a mitad del recorrido la revelación llega con un movimiento y no con un forcejeo, y `design-system.md` prohíbe cualquier respuesta que se lea como un rechazo.
- **La presentación se resuelve contra el registro de sitios pisados anterior a la llegada, y la anotación se escribe después** → asumido (alternativa: anotar al validar el geofence, antes de resolver). Regla: si se anotara antes, la primera visita se resolvería como segunda y el visor no se abriría nunca solo — es la clase de degradación silenciosa de §6h, y por eso el orden va como criterio y no como comentario.
- **El registro de sitios pisados no se vacía al echar el telón** → asumido (alternativa: que «la segunda vez» sea dentro de la misma salida). Regla: `bucle-jugable.md` §5, profundizar es el premio de la rutina y ocurre por volver otro día; reiniciarlo por salida repetiría la ceremonia cada mañana, que es exactamente lo que la decisión evita.
- **Tocar fuera y la flecha son la misma salida, sin diferencia de comportamiento** → asumido (alternativa: que tocar fuera cierre y la flecha además haga algo). Regla: `design-system.md`, ningún control de más; dos salidas con efectos distintos obligarían a explicar cuál es cuál.
- **El sitio sin foto pinta el papel del estilo activo como fondo liso** → asumido (alternativa: un color plano fijo). Regla: `bucle-jugable.md` §2 pide que no se note como carencia, y el papel del estilo es lo que ya sostiene toda la lámina: un color ajeno al estilo se leería como un hueco.
- **La ficha de texto no ofrece volver a mirar nada** → asumido (alternativa: dejar la acción de visor deshabilitada). Regla: `design-system.md`, no se anuncia lo que falta; una acción deshabilitada es el anuncio más ruidoso que hay.
- **La línea de remate de la cartela real sale de la plantilla o del catálogo y nunca del LLM en marcha** → asumido (alternativa: pedirla al preparar la salida junto a los demás textos). Regla: RF-QUEST-008, dos puntos de invocación y ninguno en la calle; y `seguridad-privacidad.md` §1, el nombre real no entra en ninguna llamada, así que un texto que juegue con el nombre real solo puede escribirse aquí dentro.
