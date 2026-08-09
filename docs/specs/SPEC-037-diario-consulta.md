# SPEC-037 — El diario que se consulta: el capítulo de cada mapa, la triangulación puesta en escena y la vista por historias

## Descripción

El diario ya guarda lo que la jugadora oye y no lo corrige nunca (SPEC-016). Lo que falta es **leerlo**, y leerlo tiene tres formas que esta fila entrega y que no son intercambiables. La primera es el **capítulo**: cada mapa de la partida es un capítulo con sus días y su lámina dentro, y ahí es donde se leen los sitios donde ya no estás — se leen, no se juegan desde el sofá. La segunda es **la escena de la primera coincidencia**: la primera vez que alguien le cuenta a la jugadora una segunda versión de algo que ya tenía apuntado, el juego pone las dos juntas, en el sitio, sin explicar nada y sin decir cuál es la buena. Ocurre **una sola vez** en toda la partida. La tercera es **la vista por historias**, que no está desde el principio: se abre justo después de esa escena, y agrupa las versiones de un mismo suceso **por cuándo se oyeron, nunca por fidelidad**.

El orden es el punto de la decisión y no un detalle de implementación. Agrupar desde el primer día regalaría el mejor truco del juego —que dos relatos sean el mismo dejaría de ser algo que se descubre para ser algo que te dicen—; no agrupar nunca dejaría medio juego en algo que ocurre y que casi nadie llega a ver. Por eso el descubrimiento va primero y la comodidad después, y por eso esta spec gasta la mitad de sus criterios en afirmar **qué no se enseña**: ni el nivel de deformación, ni una etiqueta de fiabilidad, ni cuál de las versiones es la verdadera, ni un orden que insinúe cualquiera de las tres cosas.

Anclas: **RF-DIARIO-002**, **RF-DIARIO-003** y **RF-DIARIO-004** (`docs/prd.md` §4.6), con `game-design/quests.md` **decisión 3** —el párrafo de las dos maneras de leer el diario, del 6-ago-2026— y `game-design/alcance-del-mundo.md` **§3** —un capítulo por mapa— como fuentes que mandan sobre el PRD. Las pantallas están dibujadas: **A6P2** (el diario, por días), **A6P3** (la primera vez que triangulas) y **A6P4** (el diario, por historias), en `docs/pantallas/pantallas-6-de-consulta.html`. Consume SPEC-016 entera y **no redefine nada suyo**: la entrada del diario con su identidad de suceso, su lugar y su momento; la regla de no sobrescribir; la proyección de lectura que no lleva nivel ni signo; y el **marcador de una sola vez**, que SPEC-016 reservó en el sobre del estado explícitamente para que esta fila lo encienda sin tocar el formato. Consume además SPEC-009 (el índice del mapa y su título), SPEC-011 (el paso del mundo como momento) y SPEC-021 (la lámina, para pintar el mapa de un capítulo).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí no la toca**: se usa el almacén que SPEC-009 ya inyecta, no se lee el reloj y no aparece ninguna entrada nueva.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** la **entrada del día que cierra el telón** y la clase «lo propio» en primera persona (fila 36, RF-DIARIO-005), que aquí se **consume** y se pinta pero no se escribe; el **hito de fin de arranque** (fila 36, RF-DIARIO-006); **qué se cuenta al llegar a un núcleo** y cuándo aflora (fila 32), que es lo que dispara la escena pero no es esta entrega; la **propagación**, el nivel y el signo (fila 12, consumidos resueltos); la **redacción** de cualquier texto de rumor y su filtro de aptitud (filas 17 y 18); la **repisa y los ajustes** (fila 38); **exportar, importar y migrar** la partida (fila 39); **la lista de mapas de la partida, cuál está activo y la unicidad de nombres entre celdas** (fila 41), de la que aquí solo se consume la lista ya construida; y el **algoritmo de colocación de rótulos** y el **pintado** de la lámina de un capítulo (filas 21 y 22), que se consumen enteros.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Los capítulos», «El diario por días», «La primera coincidencia se pone en escena» y «El diario por historias»; la **validación de entradas** en el mapa que no existe en la partida, la identidad de suceso desconocida, la entrada sin momento y el intento de encender el marcador dos veces; el **estado vacío** en la partida con un solo mapa, el capítulo sin ningún día, el suceso con una sola versión y el diario recién creado; el **estado de error** en el capítulo cuyo documento de celda no está en el almacén, la entrada que apunta a un sitio que el mundo congelado no tiene y la lámina que no se puede pintar; y los **casos límite** en las dos versiones oídas en el mismo paso, la tercera versión de un suceso, el capítulo de mil días, la segunda coincidencia después de la primera y la jugadora que triangula y cierra la app antes de leer la escena.

**«Proyección»** significa siempre la superficie de lectura de SPEC-016, la que no lleva nivel ni signo: todo lo que esta spec pinta sale de ahí y de ningún otro sitio. **«Fuente»** de una versión es el núcleo o la cara que la contó, tal como SPEC-016 la guarda en la clave.

### Los capítulos: uno por mapa

- **Dado** una partida con dos mapas, **cuando** se piden los capítulos del diario, **entonces** hay exactamente dos y ninguno más.
- **Dado** los capítulos, **cuando** se lee cada uno, **entonces** declara el identificador de su mapa, el título del mundo que ese mapa tiene en su índice y cuántos días de diario contiene.
- **Dado** los capítulos, **cuando** se abre el diario, **entonces** el que viene abierto es el del mapa activo, sin que nadie lo elija.
- **Dado** los capítulos, **cuando** se leen en orden, **entonces** el del mapa activo va primero y los demás salen por un criterio declarado y estable, nunca por el orden en que se abrieron sus documentos.
- **Dado** un capítulo, **cuando** se lee su subtítulo, **entonces** sale de un vocabulario cerrado de dos valores —el mapa donde vives y un mapa donde estuviste— y nunca de una fecha del calendario real.
- **Dado** un capítulo que no es el del mapa activo, **cuando** se lee su proyección, **entonces** no ofrece ninguna acción que empiece una salida, acepte una aventura o cambie el mapa activo.
- **Dado** un capítulo que no es el del mapa activo, **cuando** se recorre entero, **entonces** trae sus días, sus caras conocidas y su lámina, y nada más.
- **Dado** un capítulo de un mapa cuyo documento de celda no está en el almacén, **cuando** se abre, **entonces** falla nombrando la celda que falta, en lugar de enseñar un capítulo a medias.
- **Dado** una partida con un solo mapa, **cuando** se piden los capítulos, **entonces** hay uno y la lista no se presenta como una elección.
- **Dado** un identificador de mapa que la partida no tiene, **cuando** se pide su capítulo, **entonces** falla nombrando el identificador.
- **Dado** un capítulo recién creado, sin ningún día, **cuando** se abre, **entonces** se obtiene un capítulo vacío y no un error.
- **Dado** el capítulo de casa con cientos de días y el de unas vacaciones con seis, **cuando** se comparan sus proyecciones, **entonces** tienen la misma forma y ninguna se completa con relleno para igualar a la otra.

### El diario por días

- **Dado** un capítulo abierto, **cuando** se piden sus días, **entonces** salen del más reciente al más antiguo y el criterio es el día de diario, no ningún otro.
- **Dado** un día con lo propio y lo oído, **cuando** se lee, **entonces** las dos clases llegan separadas y declaradas, sin que la proyección las mezcle en una sola lista.
- **Dado** una entrada de lo oído, **cuando** se lee, **entonces** trae el sitio donde se oyó y el día, y el texto que la cuenta.
- **Dado** una entrada cuyo texto del narrador no existe, **cuando** se lee, **entonces** trae el texto de la plantilla y se lee igual.
- **Dado** un jugador que nunca ha oído dos versiones de lo mismo, **cuando** abre el diario, **entonces** solo puede leerlo por días.
- **Dado** ese mismo jugador, **cuando** se busca en la pantalla una manera de leerlo por historias, **entonces** no existe: no está desactivada, no está.
- **Dado** cualquier entrada de la vista por días, **cuando** se inspecciona, **entonces** no lleva nivel, ni porcentaje, ni etiqueta de fiabilidad, ni marca de cuál es la buena.
- **Dado** una entrada que apunta a un sitio que el mundo congelado del mapa no contiene, **cuando** se proyecta, **entonces** falla nombrando el sitio, en lugar de pintar una entrada sin lugar.

### La primera coincidencia se pone en escena

- **Dado** un jugador con la versión de tres campanas apuntada, **cuando** llega a un núcleo donde se cuenta otra versión de lo mismo, **entonces** el juego enseña las dos versiones juntas.
- **Dado** esa escena, **cuando** se lee su texto entero, **entonces** no explica en ningún sitio que las noticias se deforman.
- **Dado** esa escena, **cuando** se lee, **entonces** no dice cuál de las dos es la buena, y ninguna de las dos lleva marca, orden ni tipografía que la distinga como más fiel.
- **Dado** esa escena, **cuando** se leen sus dos versiones, **entonces** la primera es la que se acaba de oír, con el sitio donde se está, y la segunda es la que ya estaba apuntada, con su sitio y hace cuántos días de diario se oyó.
- **Dado** esa escena, **cuando** se busca de dónde salen sus dos textos, **entonces** son los de las dos entradas del diario y no un texto nuevo redactado para la ocasión.
- **Dado** esa escena, **cuando** se cuentan sus acciones, **entonces** hay una sola, la que la cierra, y no hay ninguna manera de descartarla sin leerla.
- **Dado** una partida en la que la escena ya ocurrió, **cuando** el jugador oye una segunda versión de otro suceso cualquiera, **entonces** la escena no vuelve a ocurrir nunca.
- **Dado** una partida en la que la escena nunca ha ocurrido, **cuando** se apunta una entrada cuyo suceso ya tenía una versión de otra fuente, **entonces** el marcador queda pendiente y la escena se debe.
- **Dado** una escena pendiente y una app que se cierra antes de enseñarla, **cuando** se vuelve a abrir, **entonces** la escena sigue pendiente y se enseña en la siguiente llegada, con las mismas dos versiones.
- **Dado** una escena enseñada y cerrada, **cuando** se lee el marcador, **entonces** está hecho, y no se puede volver a poner en pendiente por ninguna ruta pública.
- **Dado** dos versiones del mismo suceso oídas de la **misma** fuente, **cuando** se apuntan, **entonces** no hay coincidencia que poner en escena, porque SPEC-016 no las guarda como dos entradas.
- **Dado** dos versiones de dos sucesos distintos oídas en el mismo paso, **cuando** se apuntan, **entonces** el marcador no se enciende: coincidir es tener dos versiones **del mismo** suceso.
- **Dado** dos versiones del mismo suceso apuntadas en el mismo paso, **cuando** se resuelve cuál va arriba en la escena, **entonces** el criterio está declarado y da el mismo resultado en dos ejecuciones iguales.
- **Dado** la escena, **cuando** se busca dónde ocurre, **entonces** ocurre en la llegada a un núcleo y nunca al abrir el diario en casa.

### El diario por historias, que se gana

- **Dado** un jugador que acaba de triangular por primera vez, **cuando** abre el diario, **entonces** puede leerlo por días o por historias.
- **Dado** la vista por historias, **cuando** se leen las versiones de un suceso, **entonces** aparecen agrupadas por su identidad de suceso, sin comparar ningún texto.
- **Dado** tres versiones de un suceso, oídas en los días 22, 23 y 29, **cuando** el jugador las mira en la vista por historias, **entonces** aparecen en el orden 22, 23, 29.
- **Dado** esas tres versiones, **cuando** se busca en la vista un orden por fidelidad, por nivel o por fuente, **entonces** no existe ninguno.
- **Dado** la vista por historias, **cuando** se recorre entera, **entonces** ninguna versión lleva etiqueta, porcentaje ni marca de cuál es la buena.
- **Dado** dos versiones oídas en el mismo día, **cuando** se ordenan, **entonces** desempata el paso del mundo, y si también empata, un criterio declarado y estable.
- **Dado** la lista de historias de un capítulo, **cuando** se lee su orden, **entonces** sale de un criterio declarado sobre el momento de la versión más reciente de cada suceso, y no del orden de inserción.
- **Dado** un suceso con una sola versión, **cuando** se abre la vista por historias, **entonces** aparece igual, con su única versión, y no se esconde.
- **Dado** lo que se cuenta de la propia jugadora, **cuando** se abre la vista por historias, **entonces** aparece con el mismo formato que cualquier otro suceso y sin sección aparte.
- **Dado** la vista por historias abierta, **cuando** se vuelve a la vista por días, **entonces** las dos conviven y ninguna sustituye a la otra.
- **Dado** el cierre de un hilo con varias versiones, **cuando** se lee, **entonces** su texto se compone en tiempo de ejecución a partir de cuántas fuentes distintas lo contaron, y no hay ninguna cifra escrita a mano.
- **Dado** una identidad de suceso que el diario no tiene, **cuando** se piden sus versiones, **entonces** falla nombrando la identidad.
- **Dado** la vista por historias de un capítulo que no es el activo, **cuando** se abre, **entonces** enseña las historias de ese mapa y ninguna de otro.

### Nada de esto es un panel del mundo

- **Dado** cualquiera de las tres vistas, **cuando** se recorre entera, **entonces** no aparece ningún dato del mundo que la jugadora no haya oído.
- **Dado** un núcleo del que la jugadora no ha oído nada, **cuando** se recorre el diario, **entonces** no aparece.
- **Dado** cualquiera de las tres vistas, **cuando** se buscan cifras, **entonces** las únicas que existen son cuentas de cuánto hay dentro —los días de un capítulo— y ninguna de distancia, tiempo, ritmo, pasos ni progreso.
- **Dado** el diario entero, **cuando** se busca una barra de reputación o una lista de escalones, **entonces** no hay ninguna.

### Determinismo y persistencia

Bloqueante (`@determinismo`, RNF-DET-003).

- **Dado** el mismo estado de partida, **cuando** se proyecta el diario dos veces, **entonces** las dos proyecciones son idénticas.
- **Dado** el mismo estado, **cuando** se piden los capítulos, los días y las historias, **entonces** ninguna de las tres consultas escribe nada en el estado.
- **Dado** un marcador encendido, **cuando** se serializa la partida y se vuelve a cargar, **entonces** vuelve encendido y la vista por historias sigue disponible.
- **Dado** el código que esta fila añade, **cuando** se busca en él, **entonces** no aparece `Math.random`, `Date.now` ni ninguna lectura del reloj del sistema.
- **Dado** la proyección del diario, **cuando** se comparan los documentos congelados del mapa antes y después de leerla, **entonces** son idénticos byte a byte.

## UX Design

### Wireframe textual

Tres pantallas, las tres ya dibujadas en el artefacto 6, y ninguna se rediseña aquí: esta sección dice qué dato ocupa cada hueco.

**A6P2 — El diario, por días.** Layout de pantalla de consulta: rótulo de vuelta «‹ Volver» arriba a la izquierda, titular «Tu diario» en serif. Debajo, la **tira de capítulos**, uno por mapa: el del mapa activo con filete grueso y los demás con filete tenue; cada capítulo lleva el **título del mundo** en serif y, debajo y en sans pequeño, **«N días · donde vives»** o **«N días · donde estuviste»**. Debajo de la tira, el rótulo **«Los últimos días»** y la lista de días del capítulo abierto, del más reciente al más antiguo. Cada día es una hoja separada por línea de puntos: arriba el **día** en sans versalitas —«Jueves · día 23»—, y dentro, lo propio en primera persona y, aparte y con filete a la izquierda en itálica, lo oído. Cuando el capítulo tiene ya una historia con dos versiones y el marcador está hecho, al pie aparece la acción **«Ver por historias»**. No hay buscador, no hay filtro y no hay calendario.

**A6P3 — La primera vez que triangulas.** No cuelga de la portada: aparece dentro de la llegada a un núcleo, encima de lo que allí se cuenta. Rótulo en sans **«En ‹núcleo› se habla de»**, titular en serif con el **nombre del suceso**. Debajo, las dos versiones, cada una en su caja de papel con borde fino: la primera con el sitio y el momento **«Aquí, hoy»** y su texto entre comillas en itálica; entre las dos, centrada, en versalitas rojas y sin punto final, la línea **«— esto ya lo habías oído —»**; la segunda con **«En ‹núcleo›, hace N días»** y su texto. Al pie, en serif y sin ningún adorno, **«No así.»** y una sola acción, **«Apuntarlo»**, que la cierra y devuelve a la llegada. Ni un texto explicativo, ni una marca sobre ninguna de las dos, ni una manera de saltarla.

**A6P4 — El diario, por historias.** Rótulo de vuelta **«‹ Tu diario»**, titular **«Lo que se cuenta»**. Debajo, la lista de historias del capítulo abierto; cada historia es el nombre del suceso en serif y, debajo, sus versiones en orden de cuándo se oyeron, cada una con su **sitio y su día** en sans versalitas y su texto entre comillas en itálica. Al pie de cada historia con más de una versión, **el cierre del hilo**, una línea compuesta en tiempo de ejecución a partir de cuántas fuentes distintas la contaron. Al pie de la pantalla, **«Ver por días»**. Ninguna versión lleva icono, color, orden ni tipografía distinta de las demás.

**Estados vacíos.** Un capítulo sin días enseña su título y una sola línea en voz de mundo diciendo que ahí todavía no hay nada apuntado. La vista por historias no tiene estado vacío: no se puede abrir sin haber triangulado, y triangular implica que hay al menos una historia con dos versiones.

**Estado de error.** Si el documento de una celda del capítulo no está, el capítulo no se abre y lo dice en voz de mundo, sin nombrar el almacén ni el fichero.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec implementa:
  A6P2  pantalla 2 · artefacto 6 — El diario, por días            (dueña: esta fila)
  A6P3  pantalla 3 · artefacto 6 — La primera vez que triangulas  (dueña: esta fila)
  A6P4  pantalla 4 · artefacto 6 — El diario, por historias       (dueña: esta fila)

Pantallas de otras filas con las que encaja:
  A6P1  pantalla 1 · artefacto 6 — La portada, sin barra          (dueña: fila 28)
  A4P5  pantalla 5 · artefacto 4 — Lo que aquí se cuenta          (dueña: fila 32)
  A5P4  pantalla 4 · artefacto 5 — La entrada del día             (dueña: fila 36)

Elementos del proyecto que se usan: la placa de pergamino, el filete, la lámina y
su cartela (para el mapa de un capítulo), la tipografía serif de la voz del mundo.

Elementos nuevos, los tres de datos y ninguno decorativo:
  - la tira de capítulos, con el activo marcado por filete y no por selector
  - la caja de versión, que es el mismo componente en A6P3 y en A6P4
  - el cierre del hilo, línea compuesta en tiempo de ejecución
```

### data-testid

Los dos que `design-system.md` pide siempre son aquí el estado del momento y el mapa del capítulo:

- `momento` — el momento del bucle, con valor `de-consulta` en A6P2 y A6P4 y `al-parar` en A6P3, que es donde ocurre
- `diario-vista` — la manera de leerlo, con un vocabulario cerrado: `dias`, `historias`
- `diario-capitulos` — la tira de capítulos
- `diario-capitulo` — cada capítulo, con el identificador de su mapa
- `diario-capitulo-activo` — el capítulo abierto, para afirmar que es el del mapa activo sin que nadie lo elija
- `diario-capitulo-lamina` — la lámina del mapa de un capítulo
- `diario-dias` — la lista de días
- `diario-dia` — cada hoja de un día
- `diario-ver-por-historias` — la acción que abre la segunda manera, que **no existe** hasta que el marcador está hecho
- `diario-ver-por-dias` — la vuelta
- `diario-historias` — la lista de historias
- `diario-historia` — cada historia, con la identidad de su suceso
- `diario-version` — cada caja de versión, en las dos pantallas donde aparece
- `triangulacion-escena` — la escena entera de A6P3
- `triangulacion-apuntarlo` — su única acción

Sin más: los títulos, los nombres de los sucesos y los textos de las versiones son texto único y se localizan por su contenido. **Ningún `data-testid` lleva el nivel, el signo ni nada derivado de ellos**, porque un identificador de prueba que exponga el nivel lo saca a pantalla por la puerta de atrás.

### Patrón de interacción

- **La tira de capítulos no es un selector de mapas.** Regla: `alcance-del-mundo.md` §3 y el escenario «No existe ningún selector de mapas». Abrir el capítulo de otro mapa cambia lo que se **lee**, nunca el mapa activo, y por eso los capítulos que no son el activo no ofrecen ninguna acción de juego. Es la diferencia entre un cajón de láminas —descartado— y un tomo con capítulos.
- **La segunda manera de leer no se desactiva: no existe.** Regla: el escenario «Al principio el diario solo se lee por días» dice «no existe ninguna vista por historias». Una pestaña gris con un candado enseñaría que hay algo que descubrir, que es exactamente lo que la decisión protege.
- **La escena de A6P3 es modal y no se puede saltar.** Regla: `quests.md` decisión 3, «se pone en escena, no se explica»; ocurre una sola vez en toda la partida y su valor entero está en que se lea. Se cierra con su única acción, no con un gesto de descarte ni con el botón de atrás del sistema.
- **La escena ocurre en el sitio, no en casa.** Regla: `docs/flujo.md`, la arista `A4P5 → A6P3`; y la nota del artefacto 6, «la pantalla vive en este artefacto porque es lo que cambia el diario, no porque se consulte».
- **Nada de esto tiene animación de revelado.** Regla: `design-system.md`, dentro del juego no se habla como aplicación; una celebración por desbloquear una vista es voz de aplicación y además convierte un descubrimiento en un logro, que la lista de «qué NO lleva ninguna pantalla» prohíbe.
- **El orden de las versiones nunca es una opción de la interfaz.** Regla: `quests.md` decisión 3, ordenarlas de más fiel a más torcida sería enseñar el nivel por la puerta de atrás. No hay control de orden porque solo existe un orden.
- **Decisión no cubierta por el design system:** qué capítulo viene abierto al entrar en el diario. Se resuelve **con el del mapa activo**, porque el mapa activo ya lo decide dónde estás y elegir capítulo por defecto sería la primera forma de selector; y porque el capítulo de casa es el que tiene los días de hoy.
- **Decisión no cubierta por el design system:** en la escena de A6P3, cuál de las dos versiones va arriba. Se resuelve **con la que se acaba de oír**, porque la escena ocurre en el sitio y el sitio es el presente; poner arriba la más antigua leería como una corrección, que es justo lo que el diario no hace nunca.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/diario.js` (se extiende) | los capítulos, los días de un capítulo, las historias de un capítulo, el orden de cada lista y el cierre del hilo como dato |
| `packages/nucleo/partida/triangulacion.js` | la detección de la primera coincidencia, los tres estados del marcador, la composición de la escena y la regla de una sola vez |
| `app/` — las tres pantallas | A6P2, A6P3 y A6P4, que pintan lo anterior y no calculan nada |

`diario.js` **se extiende y no se duplica**: la entrada, su clave, la regla de no sobrescribir y la proyección sin nivel son de SPEC-016 y siguen siendo suyas. Lo que esta fila añade son **consultas de lectura**, todas puras y todas sobre el estado ya cargado.

El reparto está elegido para que **casi todo sea afirmable en `@nucleo`**: la agrupación por suceso, los tres órdenes, la ausencia de nivel en la proyección, los tres estados del marcador, la regla de una sola vez y la composición de la escena son funciones puras sobre el estado, sin pantalla y sin simulador. Lo que solo se puede ver con Maestro es que la escena sea modal y que la acción de historias no esté dibujada — dos afirmaciones, no treinta.

### Los tres estados del marcador, y por qué son tres y no dos

SPEC-016 reservó en el sobre un «marcador de una sola vez» sin decidir cuándo se enciende. Aquí se decide, y con **tres** valores en lugar de dos: `nunca`, `pendiente` y `hecho`.

1. Al apuntar una entrada cuyo suceso ya tenía otra versión **de otra fuente**, y solo si el marcador está en `nunca`, pasa a `pendiente` y se guarda **qué dos entradas** componen la escena.
2. La escena se enseña; al cerrarla, el marcador pasa a `hecho`.
3. La vista por historias existe **si y solo si** el marcador está en `hecho`.

El estado intermedio existe porque la escena ocurre en la calle, con el móvil en la mano y la batería al 4 %. Con dos estados, cerrar la app entre la detección y la pantalla tendría dos finales igual de malos: o la vista por historias aparece sin que la escena se haya visto —regalando el truco, que es lo que la decisión de diseño existe para impedir— o la escena se pierde para siempre. Con tres, la escena se debe y se paga en la siguiente llegada, con las dos mismas versiones guardadas.

### Qué es coincidir, exactamente

Coincidir es **tener dos entradas del mismo suceso con fuentes distintas**. No es que dos textos se parezcan, no es que dos rumores hablen del mismo núcleo y no es que dos versiones tengan niveles distintos. La identidad de suceso viaja en cada entrada desde SPEC-016 precisamente para que esto sea una consulta sobre datos y no una comparación de prosa.

Volver al mismo núcleo no coincide, porque SPEC-016 no añade una segunda entrada. La versión de un testigo directo **sí** coincide con la del pueblo, porque la fuente es otra y entra como entrada aparte — y no la corrige, que es la propiedad que `npcs.md` protege.

### El cierre del hilo, y por qué no está escrito aquí

La pantalla dibujada remata la historia de las campanas con «Tres sitios, tres campanas distintas». Ese texto **no se copia**: depende de un número que solo existe en la maqueta, y `game-design/lenguaje.md` lo prohíbe explícitamente. Lo que esta spec entrega es el **dato** —cuántas fuentes distintas contaron la historia— y el hueco donde encaja; la forma concreta de la frase es una plantilla parametrizada, y escribirla es de la fila 17, con su fallback y su filtro de aptitud como cualquier otro texto.

### Lo que el capítulo de un mapa antiguo puede y no puede

`alcance-del-mundo.md` §3 lo dice en una línea —«leerlos sí, jugarlos desde el sofá no»— y aquí se convierte en una propiedad de la proyección, no en una comprobación repartida por la interfaz: **la proyección de un capítulo que no es el del mapa activo no contiene ninguna acción**. Así, que no se pueda jugar en él no depende de que ninguna pantalla dibuje un botón, sino de que el dato no traiga con qué dibujarlo. Es la misma forma de blindaje que SPEC-016 aplicó al nivel de deformación.

La lámina del capítulo se pinta con el render de SPEC-021 sobre el documento congelado de ese mapa, con el conocimiento que el documento traiga: un mapa antiguo se ve como se quedó.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Se referencian por su nombre literal, no se duplican.

- De **«Triangular se descubre jugando y luego se facilita»** (`@app`), que es la característica propia de esta fila y que esta spec cubre entera: **«Al principio el diario solo se lee por días»**, **«La primera coincidencia se pone en escena»**, **«A partir de ahí se abre la vista por historias»** y **«Las versiones se ordenan por cuándo se oyeron»**, de la que SPEC-016 sostenía solo la mitad de datos.
- De **«El diario registra lo oído, no lo cierto»**: **«El nivel de deformación no sale nunca a pantalla»**, que aquí se afirma sobre las tres vistas, que es donde de verdad podría escaparse.
- De **«Una partida, muchos mapas, y ningún selector»**: **«Los mapas antiguos se leen desde el diario»**, del que esta fila sostiene la mitad del diario —el capítulo, sus días, su lámina y la ausencia de acciones— y la fila 41 sostiene la del mapa activo.
- **Frontera, que esta spec consume y no implementa:** **«Un paseo sin aventura tiene telón completo menos desenlace»** (fila 36), **«Lo que aquí se cuenta cierra la llegada a un núcleo»** (fila 32) y **«El testigo directo es fiel y no corrige al pueblo»** (filas 12 y 14).

### Huecos de la batería que esta spec deja al descubierto

1. **La característica «Triangular se descubre jugando y luego se facilita» está etiquetada `@app` entera**, y con Maestro ausente (`pipeline/decisiones-orquestador.md` §4) eso significa cerrar la fila sin una sola verificación ejecutable. Tres de sus cuatro escenarios son afirmables en `@nucleo` sobre la proyección y el marcador, sin pantalla: el desdoble es decisión de quien mantiene la batería.
2. **Que la escena ocurra una sola vez en toda la partida no tiene escenario.** Es la mitad de RF-DIARIO-002 y la única que puede romperse en silencio meses después de la primera.
3. **El capítulo de un mapa antiguo sin acciones no tiene escenario propio.** «Pero no puede jugar en él desde casa» es una línea de un escenario `@app` que ninguna aserción persigue.
4. **El estado intermedio del marcador —triangular y cerrar la app antes de leer la escena— no tiene escenario**, y es el caso que decide si el truco se regala.
5. **El orden de la lista de historias** no está afirmado en ningún sitio; el escenario existente ordena las versiones **dentro** de una historia, no las historias entre sí.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-026.
- **Sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`: esto es una app de móvil y la pantalla es la que es.
- **El marcador tiene tres estados y no dos** → asumido (alternativa: encendido o apagado, encendiéndolo al detectar la coincidencia). Regla: §6h, nada degrada en silencio; con dos estados, morir entre la detección y la pantalla o regala la vista por historias sin la escena o pierde la escena para siempre, y las dos cosas ocurren sin que nada proteste. Es la decisión más discutible de esta spec.
- **La vista por historias se abre con el marcador en `hecho` y no en `pendiente`** → asumido (alternativa: abrirla al detectar). Regla: el escenario dice «un jugador que **acaba de triangular**», y triangular es haber visto las dos versiones juntas, no que el código lo haya notado.
- **En la escena va arriba la versión que se acaba de oír** → asumido (alternativa: orden cronológico, la antigua arriba). Regla: la pantalla dibujada lo hace así —«Aquí, hoy» primero, luego «— esto ya lo habías oído —»— y poner la antigua arriba leería como una corrección, que el diario no hace nunca.
- **El subtítulo de un capítulo sale de un vocabulario cerrado de dos valores y no de una fecha** → asumido (alternativa: «el verano pasado», como en la maqueta). Regla: SPEC-016 no guarda ninguna marca del reloj real en el estado y RF-PRIV-002 lo respalda; una fecha del calendario obligaría a añadir a la partida un dato sobre la vida de la jugadora que el juego no necesita. El texto de la maqueta se declara maqueta.
- **El capítulo abierto por defecto es el del mapa activo, y el orden de los demás es declarado y estable** → asumido (alternativa: recordar el último capítulo abierto). Regla: recordar una elección es media memoria de selector, y `alcance-del-mundo.md` §3 descarta el selector; además al volver a casa vuelve el de casa sin preguntar nada.
- **Un capítulo que no es el del mapa activo no trae acciones en su proyección** → asumido (alternativa: traerlas y que la pantalla no las pinte). Regla: es el mismo blindaje que SPEC-016 aplicó al nivel; una regla que solo vive en la capa que dibuja se rompe la primera vez que alguien dibuja otra pantalla.
- **Coincidir es dos entradas del mismo suceso con fuentes distintas** → asumido (alternativa: cualquier segunda entrada del mismo suceso). Regla: SPEC-016 no guarda una segunda entrada del mismo núcleo, así que la alternativa sería inalcanzable; y con la fuente en el criterio, la versión del testigo directo cuenta como coincidencia, que es lo que hace que triangular tenga dos caminos.
- **La escena se enseña en la llegada, y si la app muere, se debe** → asumido (alternativa: enseñarla la próxima vez que se abra el diario). Regla: `docs/flujo.md` la coloca colgando de A4P5, y la nota de la pantalla dibujada insiste en que ocurre en el sitio; enseñarla en casa la convertiría en una notificación de logro.
- **El cierre del hilo se compone en tiempo de ejecución a partir del número de fuentes distintas, y su redacción es de la fila 17** → asumido (alternativa: copiar el texto de la maqueta). Regla: `lenguaje.md`, ningún texto puede depender de un número que solo existe en la maqueta.
- **La lista de historias se ordena por el momento de la versión más reciente de cada suceso** → asumido (alternativa: por la primera vez que se oyó cada suceso, o por número de versiones). Regla: ordenar por número de versiones premiaría triangular y convertiría el diario en un marcador; ordenar por la más reciente es lo mismo que hace la vista por días un nivel más arriba, y no insinúa nada sobre fidelidad.
- **Un suceso con una sola versión aparece igual en la vista por historias** → asumido (alternativa: enseñar solo los que tienen dos o más). Regla: esconderlos convertiría la vista en una lista de «lo que ya has triangulado», que es un marcador de progreso; y la maqueta la titula «Lo que se cuenta», no «lo que has cazado».
- **Las tres vistas se calculan como proyecciones puras sobre el estado ya cargado, sin caché** → asumido (alternativa: materializar la agrupación por suceso en el estado). Regla: materializar añadiría un campo derivado que puede quedar desincronizado con las entradas, que es exactamente la clase de doble verdad que SPEC-016 existe para no repetir; si el capítulo de mil días midiese lento, la palanca es un índice en memoria, no un campo en el documento.
