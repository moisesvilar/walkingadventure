# SPEC-041 — Una partida, muchos mapas: el activo lo decide dónde estás, y los nombres no chocan entre celdas

## Descripción

Viajar lejos abre un mapa nuevo dentro de la misma partida, y **no hay ningún selector**: el mapa activo lo decide dónde estás. La app abre el de tu sitio, y si llegas a algún lado que no toca con ninguno de los tuyos, ofrece levantar uno nuevo; al volver a casa vuelve el de casa sin preguntar nada. Es lo único coherente con un juego que va de andar, y de paso deja la portada limpia.

**Tú viajas entera**: personaje, oficio, repisa, diario y objetos son de la partida y no del sitio, y te acompañan. Lo que no viaja es el **rango**, y no hace falta ninguna regla nueva para que no viaje: es por núcleo, así que en un mapa donde nadie ha oído hablar de ti vuelves a ser forastera automáticamente. Y **el mundo de casa no avanza en tu ausencia**, porque el reloj son tus kilómetros y no el calendario: volver de tres semanas fuera es volver de tres días.

Esta fila entrega además dos piezas que el resto del proyecto dejó apuntadas. La primera es la **apertura de celdas dentro del móvil** por sus dos vías —por pisarla, porque el mundo tiene que existir donde estás, y como acontecimiento al completar la propia— con la costura de calzadas en el borde: SPEC-003 fijó el mecanismo y SPEC-026 lo dejó explícitamente fuera. La segunda es un hueco que SPEC-026 anotó por escrito: **la unicidad de nombres entre celdas vecinas** de un mismo mapa, que no aparece hasta que hay más de una celda. Se resuelve por construcción y no por consulta al vecino, que es la única forma de tenerla sin romper el determinismo.

Anclas: **RF-PERS-007**, **RF-MUNDO-004** y **RF-PROG-003** (`docs/prd.md` §4.10, §4.1 y §4.5), con `game-design/alcance-del-mundo.md` **§3** —una partida, muchos mapas, y ningún selector— y **§2** —las dos vías de apertura— como fuentes que mandan sobre el PRD. Consume SPEC-003 (**la semilla, la rejilla, el anclaje redondeado, la apertura por las dos vías y la costura: se consumen tal cual y no se redefine ninguna**), SPEC-009 (el índice por mapa y el documento por celda), SPEC-011 (el contador de pasos y la reserva, que ya son del mapa activo), SPEC-015 (**el rango y los motes por núcleo, y que el oro y los objetos son de la jugadora: el rango no viaja y no hace falta regla nueva**), SPEC-016 (el estado y su composición por áreas), SPEC-026 (el levantamiento de un mapa dentro del móvil, que aquí se reutiliza tal cual para las celdas nuevas), SPEC-037 (el capítulo del diario, que es donde se leen los mapas antiguos) y SPEC-039 (el almacén duradero, sin el cual varios mapas no sobreviven a cerrar la app).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí no la toca**: se usan el traedor de datos de OSM y el almacén que ya inyectan SPEC-026 y SPEC-039, con sus mismas firmas, y la resolución del mapa activo recibe la posición como argumento.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** la **generación de una celda** con toda su tubería y el presupuesto del minuto (fila 26 y B1, consumidos enteros); **cómo se pinta** la lámina (filas 21 y 22); la **portada** con sus tres puertas y su tarjeta de aventura a medias (fila 28), de la que aquí solo se entrega qué hacer cuando no hay mapa activo; el **permiso de ubicación** y su momento (fila 27); el **capítulo del diario** y sus tres vistas (fila 37), del que aquí solo se entrega la lista de mapas que lo alimenta; **exportar, importar y respaldar** (fila 39); **si un rumor cruza la costura entre dos celdas contiguas**, que es el pendiente 3 de `alcance-del-mundo.md` y sigue abierto; **si lo que se cuenta de ti puede llegar a mapas lejanas**, que es su pendiente 2 y aquí se resuelve por construcción sin ratificarlo como decisión de diseño; y **la poda de mapas**, pendiente 1 de `partida-guardada.md`.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El mapa activo lo decide dónde estás», «Levantar un mapa lejos», «El jugador viaja entero» y «Las celdas vecinas»; la **validación de entradas** en la posición mal formada, el identificador de mapa que la partida no tiene y el índice de celda fuera de la rejilla; el **estado vacío** en la partida sin ningún mapa, el mapa con una sola celda y la posición sin ningún mapa cerca; el **estado de error** en la apertura de celda sin red, la celda vecina que no da para un mundo jugable y el mapa cuyo índice declara una celda que el almacén no tiene; y los **casos límite** en el borde exacto entre dos mapas, la celda que se vuelve a pisar, el jugador que vive pegado a un borde, el repertorio de nombres agotado y las tres semanas fuera.

**«Mapa»** es una rejilla con su anclaje y sus celdas abiertas, tal como lo define SPEC-003; su identificador es su anclaje redondeado. **«Celda»** es una celda de esa rejilla. **«Mapa activo»** es el que la posición decide, nunca uno elegido.

### El mapa activo lo decide dónde estás

- **Dado** un jugador con dos mapas, uno de casa y otro de vacaciones, **cuando** abre la app estando en casa, **entonces** se abre el mapa de casa sin preguntar nada.
- **Dado** ese mismo jugador, **cuando** abre la app estando en el sitio de vacaciones, **entonces** se abre el de vacaciones sin preguntar nada.
- **Dado** una posición dentro de una celda abierta de un mapa, **cuando** se resuelve el mapa activo, **entonces** es ese mapa.
- **Dado** una posición dentro de la rejilla de un mapa pero en una celda que aún no se ha abierto, **cuando** se resuelve el mapa activo, **entonces** es ese mapa, y la celda queda declarada como pendiente de abrir.
- **Dado** una posición fuera de la rejilla de un mapa pero a menos del alcance declarado de su borde, **cuando** se resuelve el mapa activo, **entonces** sigue siendo ese mapa.
- **Dado** la misma posición preguntada dos veces, **cuando** se resuelve el mapa activo, **entonces** se obtiene siempre el mismo.
- **Dado** una posición equidistante de dos mapas de la partida, **cuando** se resuelve el mapa activo, **entonces** se resuelve por un criterio declarado y estable, y no por el orden en que se levantaron.
- **Dado** el alcance declarado con el que una posición sigue siendo de un mapa, **cuando** se busca de dónde sale, **entonces** está expresado en tramos del jugador y no en metros absolutos.
- **Dado** una posición mal formada, **cuando** se resuelve el mapa activo, **entonces** falla nombrando lo que llegó.
- **Dado** una partida sin ningún mapa, **cuando** se resuelve el mapa activo, **entonces** no hay ninguno y no es un error.
- **Dado** la superficie pública de esta entrega, **cuando** se busca una operación que fije el mapa activo a mano, **entonces** no existe.
- **Dado** el jugador que recorre todas las pantallas, **cuando** las revisa, **entonces** no hay ninguna manera de cambiar el mapa activo a mano.
- **Dado** el catálogo de ajustes, **cuando** se recorre, **entonces** no contiene ninguna fila de mapas.

### Levantar un mapa lejos de todos

- **Dado** un jugador a 300 km de todos sus mapas, **cuando** abre la app, **entonces** se le ofrece levantar un mapa nuevo.
- **Dado** ese ofrecimiento, **cuando** se lee, **entonces** está en voz de mundo y no menciona la red, los mapas guardados ni ninguna distancia.
- **Dado** ese ofrecimiento, **cuando** se enumeran sus acciones, **entonces** son levantar un mapa aquí y dejarlo estar, y ninguna más.
- **Dado** ese ofrecimiento, **cuando** se mira lo que sigue disponible, **entonces** el diario, la repisa y los ajustes lo están, y salir a andar no.
- **Dado** un jugador que acepta, **cuando** el mapa se levanta, **entonces** se ancla a la coordenada redondeada de allí y entra en la lista de mapas de la partida.
- **Dado** un mapa nuevo levantado, **cuando** se resuelve el mapa activo, **entonces** es el nuevo, sin que nadie lo elija.
- **Dado** un jugador que rechaza el ofrecimiento, **cuando** vuelve a abrir la app en el mismo sitio, **entonces** se le vuelve a ofrecer, y no queda ninguna marca de haberlo rechazado.
- **Dado** un jugador lejos de todos y sin conexión, **cuando** se ofrece levantar un mapa, **entonces** no se levanta y el momento lo dice en voz de mundo, sin nombrar la red.
- **Dado** una posición donde la celda no da para un mundo jugable, **cuando** se intenta levantar, **entonces** se declara, como fija SPEC-026, en lugar de entregar un mapa vacío.
- **Dado** una partida con dos mapas, **cuando** se listan, **entonces** cada uno declara su anclaje, su título, sus celdas abiertas, su contador de pasos y sus rangos.

### Las celdas vecinas, por sus dos vías

- **Dado** un jugador que pisa una celda vecina no abierta de su mapa, **cuando** el mundo tiene que existir donde está, **entonces** la celda se abre.
- **Dado** una celda vecina abierta por pisarla, **cuando** se compara el documento de la celda propia antes y después, **entonces** es idéntico byte a byte.
- **Dado** la señal de celda completada, **cuando** se abre una vecina como acontecimiento, **entonces** la vecina que se abre sale de la semilla y es la misma en dos ejecuciones iguales.
- **Dado** la misma celda abierta por pisarla en una partida y por acontecimiento en otra, con la misma semilla y los mismos datos, **cuando** se comparan, **entonces** su contenido es idéntico y solo difiere el motivo registrado.
- **Dado** dos celdas contiguas abiertas, **cuando** se generan sus calzadas, **entonces** están cosidas en el borde que comparten.
- **Dado** dos celdas contiguas abiertas en un orden y, en otra ejecución, en el orden inverso, **cuando** se comparan sus costuras, **entonces** son idénticas.
- **Dado** una celda ya abierta, **cuando** el jugador la vuelve a pisar, **entonces** se lee del almacén y no se consulta OSM.
- **Dado** la apertura de una celda sin conexión, **cuando** se intenta, **entonces** no se abre a medias: o hay documento completo o no hay documento.
- **Dado** una celda abierta, **cuando** se cierra y se vuelve a abrir la app, **entonces** sigue abierta y su documento se lee del almacén.
- **Dado** un jugador que vive pegado al borde de su celda, **cuando** anda cien metros y cambia de celda, **entonces** la nueva se abre y el juego sigue sin interrupción.
- **Dado** un índice de celda fuera de la rejilla del mapa, **cuando** se pide abrirla, **entonces** falla nombrando el índice.

### Los nombres no chocan entre celdas vecinas

- **Dado** dos celdas contiguas del mismo mapa, **cuando** se recogen los nombres de sus núcleos, servicios, parajes, calzadas y ramales, **entonces** no hay ninguno repetido.
- **Dado** todas las celdas abiertas de un mapa, **cuando** se recogen todos sus nombres, **entonces** no hay ninguno repetido.
- **Dado** dos celdas contiguas, **cuando** cada una se genera sin conocer a la otra, **entonces** sus nombres siguen sin repetirse: la unicidad no depende de consultar al vecino.
- **Dado** una celda, **cuando** se genera con vecinas abiertas y cuando se genera sin ninguna, **entonces** los dos documentos son idénticos byte a byte.
- **Dado** dos mapas distintos de la misma partida, **cuando** se comparan sus nombres, **entonces** pueden repetirse: la unicidad es por mapa, como el índice.
- **Dado** una celda cuyo reparto del repertorio se agota, **cuando** se nombra un elemento más, **entonces** cae a la forma construida declarada, que incorpora la celda, y no a un nombre repetido.
- **Dado** la forma construida, **cuando** también colisiona, **entonces** falla nombrando el paquete de idioma y el elemento, en lugar de repetir un nombre en silencio.
- **Dado** el índice de nombres de un mapa, **cuando** se serializa y se vuelve a cargar, **entonces** vuelve entero y abrir una celda más sigue sin repetir ninguno.
- **Dado** un mapa en una coordenada de Galicia y otro en una del interior, **cuando** se comparan sus nombres, **entonces** los primeros salen del paquete gallego y los segundos del castellano, celda a celda.

### El jugador viaja entero y el rango no

- **Dado** un jugador que levanta un mapa nuevo lejos, **cuando** llega allí, **entonces** conserva personaje, oficio, repisa, diario y objetos.
- **Dado** ese mismo jugador, **cuando** llega a los núcleos del mapa nuevo, **entonces** es forastera en todos ellos.
- **Dado** ese mismo jugador, **cuando** se consulta su bolsa de oro desde el mapa nuevo, **entonces** es la misma: el oro es lo que se lleva encima.
- **Dado** ese mismo jugador, **cuando** se consultan los motes en el mapa nuevo, **entonces** no hay ninguno.
- **Dado** el código de esta entrega, **cuando** se buscan rutas que copien rangos, motes o lo que se cuenta de un mapa a otro, **entonces** no existe ninguna: el rango no viaja porque es por núcleo y no porque nadie lo impida.
- **Dado** un jugador que vuelve a casa después de estar fuera, **cuando** llega a sus núcleos de siempre, **entonces** le siguen conociendo con el rango que dejó.
- **Dado** un objeto obtenido en el mapa de vacaciones, **cuando** se abre la repisa en casa, **entonces** está.
- **Dado** una entrada de diario de un mapa, **cuando** se lee el diario del otro, **entonces** no aparece: cada capítulo es de su mapa.

### El mundo de casa no avanza en tu ausencia

- **Dado** un jugador que pasa tres semanas fuera andando en otro mapa, **cuando** vuelve a casa, **entonces** el mundo de casa ha avanzado solo con los kilómetros que anduvo allí.
- **Dado** ese mismo jugador, **cuando** se compara el contador de pasos del mapa de casa antes de irse y al volver, **entonces** es el mismo.
- **Dado** kilómetros andados en el mapa activo, **cuando** se convierten en pasos, **entonces** avanza el contador de ese mapa y ninguno más.
- **Dado** una partida con dos mapas, **cuando** se leen sus reservas de pasos de fondo, **entonces** cada mapa tiene la suya y no se mezclan.
- **Dado** kilómetros de fondo que llegan con la app cerrada, **cuando** se acreditan al abrir, **entonces** van al mapa activo en ese momento, que es el del sitio donde está el jugador.
- **Dado** un mapa que lleva meses sin visitarse, **cuando** se vuelve a él, **entonces** su estado es exactamente el que se dejó y nada ha caducado.
- **Dado** un mapa que lleva meses sin visitarse, **cuando** se busca una penalización, un decaimiento o una pérdida de rango por ausencia, **entonces** no hay ninguna.

### Los mapas antiguos se leen y no se juegan

- **Dado** un jugador con un mapa de vacaciones del año pasado, **cuando** abre el diario, **entonces** ve un capítulo por mapa.
- **Dado** ese capítulo antiguo, **cuando** se abre, **entonces** dentro están sus días y su mapa.
- **Dado** ese capítulo antiguo, **cuando** se busca una manera de jugar en él desde casa, **entonces** no hay ninguna.
- **Dado** la lista de mapas de la partida, **cuando** se busca dónde se enseña fuera del diario, **entonces** no se enseña en ningún sitio.

### Determinismo

Bloqueante (`@determinismo`, RNF-DET-003).

- **Dado** la misma semilla y los mismos datos de OSM, **cuando** se abre la misma celda dos veces, **entonces** los dos documentos son idénticos byte a byte.
- **Dado** dos mapas de la misma partida, **cuando** se comparan las semillas de la misma celda y la misma fase, **entonces** son distintas.
- **Dado** el mismo estado y la misma posición, **cuando** se resuelve el mapa activo dos veces, **entonces** el resultado es el mismo y nada se escribe.
- **Dado** el código que esta fila añade, **cuando** se busca en él, **entonces** no aparece `Math.random`, `Date.now` ni ninguna lectura del reloj del sistema dentro de nada que participe en la generación.

## UX Design

La interfaz de esta fila es una sola pantalla y su ausencia en todas las demás. Conviene decirlo así porque **lo más importante que entrega es lo que no dibuja**: no hay selector, no hay lista de mapas, no hay migas de pan con el nombre del mapa y no hay ninguna transición que anuncie que has cambiado de mundo.

### Wireframe textual

**Sin mapa activo — el ofrecimiento.** Ocurre al abrir la app lejos de todos los mapas de la partida. Sustituye a la portada, **no se superpone a ella**, porque una portada necesita un mapa y aquí no hay ninguno. De arriba abajo: un rótulo en sans versalitas con el sitio donde estás dicho como lugar y no como coordenada; un titular en serif de una línea que dice, en voz de mundo, que aquí no llega ninguno de tus mapas; un párrafo corto que dice que se puede levantar uno; y, empujadas abajo, la acción principal **«Levantar un mapa aquí»** y, como texto sin caja, **«Dejarlo estar»**. Debajo, las **tres puertas** de siempre —el diario, la repisa y los ajustes— con sus cuentas, porque siguen teniendo sentido: el diario es precisamente donde se leen los mapas donde ya no estás.

Lo que **no** hay en esta pantalla: ninguna distancia a ningún mapa, ninguna lista de los mapas que tienes, ningún «volver a casa» y ningún mapa dibujado de fondo.

**«Dejarlo estar»** deja la misma pantalla, con las tres puertas disponibles y sin salida a andar. No lleva a la portada de otro mapa: no se juega donde no estás.

**Al volver a un sitio conocido**, la portada aparece con el mapa de ese sitio y **sin ninguna transición, aviso ni mensaje de bienvenida**. La ausencia de anuncio es la decisión: el mapa activo lo decide dónde estás, y anunciarlo lo convertiría en un cambio de contexto de aplicación.

**Al abrir una celda vecina**, no hay pantalla propia: ocurre dentro del momento en que se está —en marcha o antes de salir— y se cuenta con las mismas fases de la generación que ya usa A1P5, sin cifras. Si ocurre en marcha, no se enseña nada: la regla de que en marcha no hay nada que tocar no tiene excepciones.

### Pantallas y elementos utilizados

```
Pantalla nueva que esta spec entrega:
  el ofrecimiento de levantar un mapa, sin nodo propio en docs/flujo.md
  todavía: cuelga de A2P1/A6P1 como el estado en que la portada no se
  puede componer. Al implementarla hay que anotarla en docs/flujo.md,
  porque tocar una pantalla obliga a tocarlo.

Pantallas de otras filas con las que encaja:
  A6P1  pantalla 1 · artefacto 6 — La portada, sin barra    (dueña: fila 28)
  A2P1  pantalla 1 · artefacto 2 — La portada               (dueña: fila 28)
  A1P5  pantalla 5 · artefacto 1 — La generación            (dueña: fila 27)
  A6P2  pantalla 2 · artefacto 6 — El diario, por días      (dueña: fila 37)

Elementos del proyecto que se usan: las tres puertas de la portada, la lista de
fases de la generación, la tipografía serif de la voz del mundo.

Elemento nuevo: ninguno visual. El elemento nuevo es de datos —el mapa activo—
y su rasgo definitorio es que no tiene control.
```

### data-testid

- `momento` — el momento del bucle, con valor `antes-de-salir`
- `mapa-activo` — el identificador del mapa activo, o `ninguno`; es el localizador del que cuelga todo lo demás de esta fila
- `ofrecer-levantar-mapa` — la pantalla del ofrecimiento, que **no existe** si hay mapa activo
- `levantar-mapa-aqui` — la acción principal del ofrecimiento
- `dejarlo-estar` — la salida del ofrecimiento
- `celda-apertura` — el estado de la apertura de una celda vecina, con un vocabulario cerrado: `inactiva`, `abriendo`, `abierta`, `no-se-pudo`

Sin más. **No hay ningún `data-testid` de selector de mapas, de lista de mapas ni de cambio de mapa**, y esa ausencia es una afirmación: si alguna vez hace falta uno, es que el selector ha vuelto por la puerta de atrás.

### Patrón de interacción

- **No hay selector, y su ausencia es la funcionalidad.** Regla: `alcance-del-mundo.md` §3 y el escenario «No existe ningún selector de mapas». El mapa activo se resuelve al abrir y al andar, nunca se elige, y por eso esta spec no tiene ningún control que describir.
- **Volver a casa no se anuncia.** Regla: `design-system.md`, dentro del juego lo que solo se puede decir como aplicación es señal de rediseñar el momento; un «bienvenida de vuelta a As Terras de Vilanova» es una pantalla de aplicación disfrazada, y además convierte en evento algo que tiene que ser invisible.
- **El ofrecimiento sustituye a la portada en lugar de superponerse.** Regla: la portada de `alcance-del-mundo.md` §3 y del artefacto 2 tiene un mapa dentro; sin mapa activo no hay portada que enseñar, y superponer un diálogo sobre un mapa que no es el de donde estás enseñaría un sitio en el que no se puede jugar.
- **Las tres puertas siguen disponibles sin mapa activo.** Regla: los mapas antiguos se leen desde el diario, y estar lejos de casa es exactamente cuando eso tiene sentido; quitarlas dejaría al jugador con una sola acción irreversible y nada más.
- **Rechazar el ofrecimiento no se recuerda.** Regla: recordar la negativa es media memoria de estado de aplicación y crea un caso —«¿por qué ya no me lo ofrece?»— que no tiene forma de resolverse en voz de mundo.
- **Abrir una celda vecina en marcha no enseña nada.** Regla: `docs/testing.md`, «La pantalla del mapa no tiene ni un control» y `bucle-jugable.md`, momento 2; el mundo tiene que existir donde estás, y eso es trabajo del juego, no un aviso.
- **Decisión no cubierta por el design system:** hasta dónde una posición sigue siendo de un mapa. Se resuelve **con un alcance declarado, expresado en tramos del jugador**, medido desde el borde de la rejilla: dentro, el mapa sigue siendo el suyo y lo que falta es abrir celdas; fuera, se ofrece levantar uno nuevo. En tramos y no en metros porque la rejilla también se dimensiona en tramos (`alcance-del-mundo.md` §2) y un umbral en metros no significa lo mismo para dos personas.
- **Decisión no cubierta por el design system:** qué hacer cuando dos mapas de la partida se solapan o quedan pegados. Se resuelve **eligiendo el que contiene la posición y, si empatan, el de anclaje que ordena primero**, y no ofreciendo nunca elegir: un desempate visible sería un selector con otro nombre.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/mapas.js` | la lista de mapas de la partida, la resolución del mapa activo desde una posición, el alcance declarado en tramos y el desempate |
| `packages/nucleo/world/rejilla.js` (se extiende) | el reparto del repertorio de nombres por celda y la forma construida de reserva |
| `packages/nucleo/names/index.js` (se extiende) | el índice de nombres **por mapa** y su reparto determinista por celda |
| `app/` — la apertura de celdas | el cableado de la tubería de SPEC-026 para una celda vecina, con su costura y su congelación |
| `app/` — el ofrecimiento | la pantalla que sustituye a la portada cuando no hay mapa activo |

El reparto está elegido para que **casi todo sea afirmable en `@nucleo`**. La resolución del mapa activo, el desempate, el alcance en tramos, la ausencia de una operación que fije el mapa a mano, la unicidad de nombres entre celdas generadas por separado, la identidad byte a byte de una celda con y sin vecinas, el contador por mapa y que el rango no viaje son propiedades de datos y de funciones puras, todas comprobables con `node --test` y los extractos de OSM congelados. Lo único que necesita dispositivo es la pantalla del ofrecimiento y que abrir una celda en marcha no enseñe nada.

### La unicidad entre celdas, resuelta por construcción

Es el hueco que SPEC-026 dejó anotado, y tiene una trampa que conviene ver antes de elegir cómo resolverlo. La solución obvia —al generar una celda, mirar los nombres de las vecinas ya abiertas y evitar repetir— **rompe el determinismo del proyecto**: el contenido de una celda pasaría a depender de qué celdas se abrieron antes, dos jugadoras con la misma semilla tendrían mundos distintos según por dónde anduvieran, y el criterio de SPEC-003 de que abrir una celda vecina no toca la propia se volvería imposible de sostener en cuanto la costura empujara un renombrado.

Así que se resuelve al revés: **el repertorio de cada paquete de idioma se reparte entre las celdas de un mapa con una función determinista de la semilla de partida, el identificador del mapa y el índice de celda**. Cada celda dibuja de su parte y no puede pisar la de nadie. Las consecuencias, que son las que se afirman:

- Una celda generada **sin conocer a sus vecinas** ya es única contra todas ellas.
- Una celda es **idéntica byte a byte** se genere antes o después que sus vecinas.
- El índice de nombres **por mapa** de SPEC-002-iter-1 sigue siendo la fuente de verdad al cargar, pero deja de ser lo que **produce** la unicidad: pasa a ser lo que la **comprueba**. Si alguna vez el reparto fallara, el índice lo caza y falla nombrando el elemento, en lugar de dejar dos «Casal da Colmea» en el mismo mapa como ya ocurrió en `costero#2`.
- El **agotamiento** del reparto tiene salida declarada: la forma construida que incorpora la celda, el mismo patrón que SPEC-007 usó para los ramales sin forma libre. Y si esa también colisiona, se falla nombrando el paquete: nunca se repite en silencio.

La unicidad es **por mapa** y no por partida, igual que el índice: dos mapas distintos pueden tener una «Fonte Vella» cada uno, y eso no molesta a nadie porque nunca se ven juntos. Aquí, además, sirve de refuerzo al pendiente 2 de `alcance-del-mundo.md` —si lo que se cuenta de ti puede llegar a mapas lejanas—: no puede, porque no comparten árbol de calzadas, y esta spec no lo ratifica como decisión de diseño; solo constata que su código no abre ninguna vía.

### El mapa activo, y por qué el alcance va en tramos

La resolución tiene tres respuestas y no más:

1. La posición cae **dentro de la rejilla** de un mapa → ese mapa, y si su celda no está abierta, se abre por pisarla.
2. La posición cae **fuera de toda rejilla pero dentro del alcance declarado** desde el borde de una → ese mapa, y la celda del borde se abre.
3. **Ninguna de las dos** → no hay mapa activo y se ofrece levantar uno.

El alcance existe porque una rejilla tiene bordes y la gente no: sin él, cruzar la calle equivocada al final del mapa ofrecería levantar un mapa nuevo pegado al de casa, que es la peor respuesta posible. Va en tramos porque la celda va en tramos, y porque quien anda 300 m por tramo y quien anda 2 km necesitan bordes distintos para la misma experiencia.

Lo que no hay es memoria: el mapa activo **no se guarda como preferencia**. Se resuelve cada vez desde la posición, y por eso no puede quedarse pegado a un mapa antiguo ni desincronizarse de dónde está el jugador. Lo que sí se guarda, porque es de otra naturaleza, es **cuál fue el último mapa activo**, y solo para acreditar los kilómetros de fondo que llegan con la app cerrada.

### El reloj de cada mapa, y los kilómetros de fondo

SPEC-011 ya dice que el contador y la reserva son del mapa activo. Aquí eso se convierte en la propiedad que el diseño promete: **el mundo de casa no avanza en tu ausencia**, no porque se congele, sino porque su reloj son tus kilómetros **allí** y allí no has andado.

El caso que hay que decidir es el de los pasos de fondo, que llegan con la app cerrada y sin saber en qué mapa estabas: se acreditan **al mapa activo en el momento de abrir**, que es cuando se leen (`seguridad-privacidad.md` §2). Es una aproximación y se declara como tal: quien anda tres semanas de vacaciones acredita esos pasos al mapa de vacaciones, y quien vuelve a casa el mismo día que abre la app los acredita a casa. La alternativa —repartirlos entre mapas según dónde estuvo— exige un histórico de posiciones, que es exactamente lo que RF-PRIV-002 prohíbe. La privacidad manda y la aproximación se acepta.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

- De **«Una partida, muchos mapas, y ningún selector»** (`@app`), que es la característica propia de esta fila y que esta spec cubre entera: **«El mapa activo lo decide dónde estás»**, **«Llegar a un sitio nuevo ofrece levantar un mapa»**, **«No existe ningún selector de mapas»**, **«Los mapas antiguos se leen desde el diario»** —la mitad de la lista de mapas; la del capítulo es de la fila 37—, **«El jugador viaja entero»** y **«El mundo de casa no avanza en tu ausencia»**.
- De **«Lo generado no se resiembra jamás»** (`@nucleo`): **«Abrir una celda vecina no toca la celda propia»**, que hasta ahora solo se afirmaba en Node y aquí se afirma sobre el móvil.
- De **«No hay niveles, hay rango social por núcleo»**: **«El rango no viaja entre mapas»**, entero.
- De **«Los nombres son únicos y del idioma del sitio»**: **«No hay dos nombres iguales en un mundo»**, que hasta ahora se afirmaba sobre una celda y aquí pasa a afirmarse sobre un mapa con varias.
- **Frontera, que esta spec consume y no implementa:** **«Se puede ser alguien en un pueblo donde no has estado»** (fila 12), **«Cambiar el tramo del jugador no redimensiona un mundo ya generado»** (fila 4) y **«La copia guardada se puede volver a abrir»** (fila 39).

### Huecos de la batería que esta spec deja al descubierto

1. **La unicidad de nombres entre celdas vecinas no tiene escenario.** «No hay dos nombres iguales en un mundo» habla de un mundo generado de una vez; el caso que esta fila abre —dos celdas generadas por separado, en cualquier orden— no está escrito, y es el que ya se rompió una vez en este repo.
2. **Que una celda sea idéntica con y sin vecinas abiertas no tiene escenario**, y es la propiedad que impide que el determinismo dependa del itinerario del jugador.
3. **El contador por mapa solo tiene un escenario y es de otra característica**, como ya anotó SPEC-011: que cada mapa lleve su contador y su reserva no está afirmado en ningún sitio.
4. **El alcance desde el borde de un mapa no tiene escenario.** «A 300 km» y «estando en casa» son los dos extremos; el caso interesante —a un paso del borde— no está.
5. **A qué mapa se acreditan los kilómetros de fondo no tiene escenario**, y es la única aproximación declarada de esta spec.
6. **El ofrecimiento de levantar un mapa no tiene nodo en `docs/flujo.md`.** Al implementarlo hay que anotarlo, porque `scripts/verifica-flujo.mjs` compara el diagrama con las pantallas dibujadas y esta no lo está.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN`). Regla: `CLAUDE.md` y el grep que cruza specs y batería.
- **Sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`.
- **La unicidad entre celdas se garantiza repartiendo el repertorio por celda, y no consultando a las vecinas** → asumido (alternativa: al generar, evitar los nombres de las celdas ya abiertas). Regla: consultar al vecino haría que el contenido de una celda dependiera del orden de apertura, rompiendo RNF-DET-001 y el criterio de SPEC-003 de que abrir una vecina no toca la propia. Es la decisión más discutible de esta spec, porque encoge el repertorio disponible por celda a cambio de conservar el determinismo, y por eso lleva detrás la forma construida de reserva y el fallo nombrado.
- **La unicidad es por mapa y no por partida** → asumido (alternativa: única en toda la partida). Regla: el índice de SPEC-002-iter-1 ya es por mundo, dos mapas nunca se ven juntos, y exigir unicidad global agotaría el repertorio por un problema que nadie tiene.
- **El índice de nombres pasa a comprobar la unicidad en lugar de producirla** → asumido (alternativa: quitarlo, ya que el reparto la garantiza). Regla: §6h; si el reparto se rompe, sin el índice nadie se entera, y el precedente de `costero#2` dice que se rompe.
- **El mapa activo se resuelve desde la posición cada vez y no se guarda como preferencia** → asumido (alternativa: guardar el último y usarlo mientras no cambie). Regla: `alcance-del-mundo.md` §3, «el mapa activo lo decide dónde estás»; guardarlo crea un estado que puede desincronizarse de la realidad y que es, funcionalmente, un selector con memoria.
- **Se guarda cuál fue el último mapa activo, solo para acreditar los kilómetros de fondo** → asumido (alternativa: no guardarlo y descartar los pasos de fondo si no se sabe dónde ocurrieron). Regla: hace falta un mapa al que acreditar y descartarlos castigaría al jugador por haber cerrado la app; el dato es un identificador de mapa —un anclaje redondeado— y no una posición, así que no toca RF-PRIV-002.
- **Los kilómetros de fondo se acreditan al mapa activo en el momento de abrir la app** → asumido (alternativa: repartirlos entre mapas según dónde se anduvieron). Regla: repartirlos exige un histórico de posiciones, que RF-PRIV-002 prohíbe; la aproximación se declara en lugar de disimularse.
- **El alcance con el que una posición sigue perteneciendo a un mapa se expresa en tramos** → asumido (alternativa: en metros absolutos, o cero alcance —solo dentro de la rejilla—). Regla: `accesibilidad.md` §1 y `alcance-del-mundo.md` §2, la geografía del juego se dimensiona en tramos; con cero alcance, cruzar la calle al final del mapa ofrecería levantar uno nuevo pegado al de casa.
- **Rechazar el ofrecimiento no se recuerda y se vuelve a ofrecer** → asumido (alternativa: no volver a ofrecer en ese sitio). Regla: recordar la negativa crea un estado invisible que solo se puede explicar como aplicación; y el coste de volver a ofrecer es una pantalla que se cierra con un toque.
- **Sin mapa activo, las tres puertas siguen y salir a andar no** → asumido (alternativa: enseñar la portada del último mapa). Regla: `alcance-del-mundo.md` §3, «leerlos sí, jugarlos desde el sofá no»; enseñar la portada de casa estando a 300 km ofrecería salir a andar en un mundo donde no estás.
- **Volver a un mapa conocido no se anuncia** → asumido (alternativa: una línea de bienvenida). Regla: `alcance-del-mundo.md` §3, «al volver a casa vuelve el de casa sin preguntar nada», y `design-system.md`, ningún texto de aplicación dentro del juego.
- **Abrir una celda vecina en marcha ocurre sin enseñar nada** → asumido (alternativa: una pantalla de generación como la del arranque). Regla: `bucle-jugable.md`, momento 2, en marcha no hay nada que tocar y ninguna excepción; el mundo tiene que existir donde estás, y eso no es un evento del jugador.
- **El desempate entre dos mapas es por el anclaje que ordena primero** → asumido (alternativa: preguntar, o el más recientemente usado). Regla: preguntar es un selector; «el más reciente» es memoria de preferencia; el anclaje es estable y ya es el identificador del mapa desde SPEC-003.
- **Esta spec no ratifica el pendiente 2 de `alcance-del-mundo.md`** → asumido: se constata que su código no abre ninguna vía para que lo que se cuenta de ti llegue a un mapa lejano, y se deja la ratificación a `game-design/` (alternativa: darlo por decidido aquí). Regla: `CLAUDE.md`, el diseño manda sobre el código, y cerrar un pendiente de diseño en una spec es cerrarlo donde nadie lo lee.
