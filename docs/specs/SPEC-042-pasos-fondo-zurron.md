# SPEC-042 — Los pasos del día a día y el zurrón: opt-in explícito, sin GPS de fondo, y un resumen que se vacía al leerse

## Descripción

Por defecto, el mundo avanza con los kilómetros de una salida activa y con nada más. Quien quiera puede ampliarlo a los pasos de su día a día —el trabajo, la compra, el paseo con el perro— y entonces esos kilómetros acumulan **una reserva con tope de cinco pasos**, que se vacía narrada al empezar la siguiente salida. Eso es todo lo que hace el modo, y es **opt-in explícito, apagado de origen, con permisos de salud**: el juego es completo sin activarlo y ninguna pantalla insiste.

La forma en que los pasos llegan importa tanto como el modo. **Se leen al abrir la app**, de la app de salud del sistema, y nunca con GPS en segundo plano: `game-design/seguridad-privacidad.md` §2 repasó pieza por pieza y ninguna necesita más, así que **nunca se pide el permiso de ubicación permanente**, que es el más invasivo que existe en un móvil y el más difícil de justificar ante un padre. Lo que sostiene el permiso «mientras se usa» con la pantalla apagada es el rótulo del sistema de una salida abierta, que es de otra fila.

Y **el zurrón** (A2P2) es donde eso se cuenta: **solo aparece si el modo está activo y hay reserva que vaciar**. Es un contenedor con marco propio y entradas prestadas —lo único que se escribe nuevo es el envoltorio, «el mundo anduvo lo suyo»; cada entrada trae el texto de lo que la generó—, se redacta en **una única llamada agrupada al abrir la salida**, con fallback por entrada si falla, y **se vacía al leerse**. Ninguna entrada reprocha nada ni dice lo que el jugador se ha perdido: el mundo hizo lo suyo, tú no estabas y no pasa nada.

Anclas: **RF-RUMOR-002**, **RF-RUMOR-006** y **RF-PRIV-003** (`docs/prd.md` §4.3 y §4.11), con `game-design/quests.md` **decisión 4** (la fuente de kilómetros, la reserva y que un paso solo añade) y **decisión 3** (el resumen de apertura: marco propio, entradas prestadas, una única llamada agrupada) y `game-design/seguridad-privacidad.md` **§2** como fuentes que mandan sobre el PRD; el eje de variación **§2.4** del PRD lo resume. Prioridad **should**. Pantalla dibujada: **A2P2**, con la arista `A2P1 → A2P2` etiquetada «solo con pasos de fondo activos y reserva sin vaciar» y `A2P2 → A2P3`. Consume SPEC-011 (**el contador, la conversión de metros a pasos con el tramo y la reserva con su tope de cinco, su descarte sin deuda, su orden y su vaciado: se consumen tal cual y no se redefine ninguno**), SPEC-018 (**el contrato de la única llamada agrupada del zurrón, su esquema cerrado, su filtro de aptitud y el fallback por entrada: se consumen tal cual**), SPEC-012 (lo que un paso produce), SPEC-038 (la fila del interruptor en los ajustes y el registro de voz), SPEC-041 (a qué mapa se acreditan los kilómetros de fondo) y SPEC-016 (el estado y el registro de hechos).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparece el **lector de la app de salud**, inyectado y con doble en Node, y con él la marca de agua que evita contar dos veces, que **vive fuera del estado de la partida** a propósito. Está descrito en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el **motor de pasos**, la conversión de metros y la reserva con su tope (fila 11, consumidos resueltos y no reabiertos); **qué ocurre** en un paso —la propagación, la latencia y el nivel— (fila 12); la **cola de oportunidades y los micro-encuentros** (fila 19); el **contrato con el modelo**, su esquema, su filtro y su caché (fila 18, consumido resuelto); la **redacción** del envoltorio y de los textos de fallback (filas 17 y 18); la **detección de vehículo** (fila 31), que decide qué metros cuentan y aquí se consume; el **rótulo del sistema** y el servicio en primer plano (fila 30), que es lo que sostiene el permiso «mientras se usa» con la pantalla apagada; la **portada** y la lista de aventuras de hoy (fila 28), de las que aquí solo se consume que el zurrón se intercala entre ellas; y la **fila de ajustes** como elemento de A6P6 (fila 38), de la que aquí se implementa el comportamiento.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Encender el modo», «Los pasos se leen al abrir» y «El zurrón»; la **validación de entradas** en la lectura de salud que trae metros negativos o no numéricos, la ventana mal formada y la entrada de reserva sin paso; el **estado vacío** en la reserva vacía, el modo apagado, la lectura sin metros nuevos y la reserva cuyos pasos no produjeron nada; el **estado de error** en el permiso denegado, el permiso revocado después, la app de salud que no responde y la llamada agrupada que falla; y los **casos límite** en la reserva exactamente llena, los doce pasos sobre un tope de cinco, tres meses sin abrir la app, la lectura que solapa con una salida activa y el cierre de la app con el zurrón a medio leer.

### Encender el modo, que viene apagado

- **Dado** una instalación nueva, **cuando** se abren los ajustes, **entonces** «contar los pasos del día a día» está desactivado.
- **Dado** una instalación nueva, **cuando** se recorre el juego entero sin activarlo, **entonces** es completo: ninguna aventura, ninguna pantalla y ningún aviso dependen del modo.
- **Dado** el modo apagado, **cuando** se recorren todas las pantallas del juego, **entonces** no aparece en ninguna una invitación a encenderlo, salvo la propia fila de ajustes.
- **Dado** un jugador que enciende el interruptor, **cuando** lo toca, **entonces** se le pide el permiso de salud en contexto, explicando para qué.
- **Dado** el permiso concedido, **cuando** se lee el interruptor, **entonces** está encendido y desde ese momento los kilómetros del día a día cuentan.
- **Dado** el permiso denegado, **cuando** se lee el interruptor, **entonces** está apagado y se dice una vez, en voz de aplicación y dentro de los ajustes, que sin ese permiso no se puede.
- **Dado** el permiso denegado, **cuando** se vuelve a los ajustes más tarde, **entonces** el interruptor sigue apagado y no se reintenta pedir el permiso solo.
- **Dado** el modo encendido y el permiso revocado después desde el sistema, **cuando** se abre la app, **entonces** el interruptor pasa a apagado y se dice, en lugar de seguir encendido sin leer nada.
- **Dado** el interruptor, **cuando** se lee su valor, **entonces** refleja lo que realmente ocurre y nunca lo que el jugador pidió.
- **Dado** un jugador que apaga el modo, **cuando** lo apaga, **entonces** dejan de leerse pasos y la reserva que hubiera queda como estaba, sin borrarse ni ejecutarse.
- **Dado** un jugador que apaga y vuelve a encender el modo, **cuando** se leen los pasos, **entonces** no se recuperan los kilómetros del tiempo apagado.
- **Dado** el núcleo, **cuando** se busca cómo sabe si el modo está activo, **entonces** lo recibe como dato de la partida y no consulta ninguna capa de la plataforma.

### Los pasos se leen al abrir, y nunca de fondo

Bloqueante (`@privacidad`, RF-PRIV-003).

- **Dado** los permisos que la app solicita, **cuando** se revisan, **entonces** solo pide la ubicación «mientras se usa».
- **Dado** la configuración declarada de la app, **cuando** se revisa, **entonces** no declara ningún modo de fondo de ubicación.
- **Dado** la configuración declarada de la app, **cuando** se revisa, **entonces** no declara ninguna tarea periódica que lea la ubicación ni la salud con la app cerrada.
- **Dado** el modo encendido, **cuando** se abre la app, **entonces** se leen los metros acumulados desde la última lectura y se convierten en pasos.
- **Dado** el modo encendido, **cuando** la app está cerrada, **entonces** no se lee nada, no se ejecuta ningún paso y no se consume batería por este motivo.
- **Dado** una lectura de salud, **cuando** se inspecciona qué pide, **entonces** pide metros caminados o pasos en una ventana, y nunca posiciones, rutas ni ejercicios con recorrido.
- **Dado** una lectura de salud terminada, **cuando** se recorre el estado y el registro de la partida, **entonces** no ha entrado en ellos ninguna marca del reloj real.
- **Dado** dos aperturas seguidas de la app, **cuando** se leen los pasos en la segunda, **entonces** no se vuelven a contar los metros ya contados en la primera.
- **Dado** una salida activa en curso, **cuando** se leen los pasos del día a día, **entonces** los metros de la ventana de esa salida no se cuentan dos veces.
- **Dado** una lectura que devuelve metros negativos o no numéricos, **cuando** se procesa, **entonces** falla nombrando el valor recibido y no se ejecuta ningún paso.
- **Dado** la app de salud que no responde, **cuando** se abre la app, **entonces** el juego sigue igual, no se lee nada y ninguna pantalla lo llama fallo.
- **Dado** la lectura de salud, **cuando** se busca dónde vive la marca de la última lectura, **entonces** está fuera del estado de la partida, y el estado sigue sin ninguna marca del reloj real.
- **Dado** una jugadora que no ha abierto la app en tres meses, **cuando** la abre, **entonces** la reserva contiene cinco pasos como mucho y el contador ha avanzado cinco, no noventa.
- **Dado** esa misma jugadora, **cuando** compara lo que ve con la de tres días, **entonces** ve lo mismo.
- **Dado** los pasos ejecutados desde el fondo, **cuando** se comparan con los de una salida activa, **entonces** son de la misma naturaleza y llevan el mismo número correlativo del mismo contador.
- **Dado** kilómetros de fondo acreditados, **cuando** se busca a qué mapa van, **entonces** van al mapa activo en el momento de abrir la app.

### El zurrón: cuándo aparece y cuándo no

- **Dado** un jugador con el modo de pasos de fondo apagado, **cuando** abre la app, **entonces** no aparece la pantalla del zurrón.
- **Dado** el modo encendido y la reserva vacía, **cuando** abre la salida, **entonces** no aparece la pantalla del zurrón.
- **Dado** el modo encendido y la reserva con pasos, **cuando** abre la salida, **entonces** el zurrón aparece antes de lo que hay hoy.
- **Dado** el modo apagado, **cuando** se abre la salida, **entonces** no se hace ninguna llamada del zurrón.
- **Dado** una reserva con pasos cuyos pasos no produjeron nada narrable, **cuando** se abre la salida, **entonces** no aparece el zurrón, no se hace ninguna llamada y la reserva se vacía igual.
- **Dado** un zurrón leído y cerrado, **cuando** se vuelve a abrir la salida el mismo día, **entonces** no vuelve a aparecer.
- **Dado** el zurrón, **cuando** se busca desde dónde más se puede llegar a él, **entonces** solo se llega al abrir la salida, y nunca desde los ajustes, el diario ni la repisa.
- **Dado** el zurrón, **cuando** se cuentan sus entradas, **entonces** son como mucho cinco, por el tope de la reserva.
- **Dado** el zurrón, **cuando** se lee cada entrada, **entonces** dice dónde ocurrió y qué ocurrió, y ninguna reprocha nada ni dice lo que el jugador se ha perdido.
- **Dado** el zurrón, **cuando** se buscan cifras, **entonces** no hay ninguna: ni pasos, ni distancia, ni días, ni cuántas cosas han pasado.
- **Dado** el zurrón, **cuando** se enumeran sus acciones, **entonces** hay una sola, la que lo cierra y sigue hacia lo que hay hoy.
- **Dado** el zurrón, **cuando** se lee su registro de voz, **entonces** es el del mundo, como el resto del bucle.

### El zurrón: cómo se redacta y cómo se vacía

- **Dado** una reserva con cinco pasos por narrar, **cuando** se abre la salida, **entonces** el envoltorio y los textos de sus entradas se piden en una sola llamada agrupada.
- **Dado** esa llamada, **cuando** se cuenta cuántas veces se llama al modelo por el zurrón, **entonces** es una y no una por entrada.
- **Dado** el envoltorio que no se pudo redactar, **cuando** se lee el resumen, **entonces** cada entrada trae el texto de la plantilla que la generó y el resumen se lee igual.
- **Dado** la llamada agrupada que falla entera, **cuando** se abre el zurrón, **entonces** aparece con el envoltorio de plantilla y las entradas de plantilla, y ninguna pantalla menciona la red.
- **Dado** una salida abierta sin conexión, **cuando** aparece el zurrón, **entonces** dice lo mismo que con conexión y nada indica que falte nada.
- **Dado** la llamada agrupada, **cuando** se busca cuándo ocurre, **entonces** ocurre al abrir la salida y nunca durante la caminata.
- **Dado** un zurrón leído hasta el final, **cuando** se confirma, **entonces** la reserva queda vacía.
- **Dado** un zurrón enseñado y una app que se cierra antes de confirmarlo, **cuando** se vuelve a abrir la salida, **entonces** el zurrón vuelve con las mismas entradas y la reserva sigue sin vaciarse.
- **Dado** el vaciado de la reserva, **cuando** se observa cómo ocurre, **entonces** se escribe con el hecho que lo registra, entero o nada.
- **Dado** una reserva vaciada, **cuando** llegan kilómetros de fondo nuevos, **entonces** los pasos que se ejecutan salen solo de los nuevos y no se recupera nada de lo descartado.
- **Dado** las entradas del zurrón, **cuando** se leen en orden, **entonces** salen en el orden en que se ejecutaron sus pasos.
- **Dado** las noticias que el zurrón cuenta, **cuando** se cierra, **entonces** siguen sedimentadas en sus núcleos y se pueden oír llegando allí: el zurrón no consume lo que cuenta.

### Determinismo

Bloqueante (`@determinismo`, RNF-DET-003).

- **Dado** la misma reserva, **cuando** se compone el zurrón dos veces con el mismo doble del narrador, **entonces** las dos composiciones son idénticas.
- **Dado** la misma reserva, **cuando** se compone el zurrón sin narrador y con narrador, **entonces** las entradas son las mismas y solo cambia la piel.
- **Dado** los mismos metros leídos, **cuando** se convierten en pasos dos veces, **entonces** se ejecutan los mismos pasos con los mismos números.
- **Dado** el código que esta fila añade, **cuando** se busca en él, **entonces** no aparece `Math.random` ni `Date.now` dentro de nada que participe en la generación.

## UX Design

### Wireframe textual

**A2P2 — El zurrón.** Se llega desde la portada al abrir la salida —«Ver qué se cuenta hoy»— y solo si el modo está activo y hay reserva. Layout de pantalla de antes de salir, a pantalla completa, en serif y en voz de mundo.

De arriba abajo: un rótulo en sans versalitas, **«Mientras no estabas»**; el **envoltorio** como titular en serif, de una o dos líneas, que es el único texto nuevo de la pantalla; y debajo, de una a cinco **entradas**, cada una con su **sitio** en sans versalitas —«En Monfrida», «Por el camino de la costa»— y su **texto** en serif, sin comillas y sin firma. Entre entradas, aire y nada más: ni iconos, ni líneas, ni numeración. Al pie, una línea de cierre en serif tenue y, empujada abajo, la única acción: **«Seguir»**.

Lo que **no** hay: ninguna cifra —ni de pasos, ni de días, ni de cuántas cosas han pasado—, ningún indicador de cuántas entradas quedan, ninguna manera de tocar una entrada para saber más, ningún «no te lo pierdas la próxima vez» y ninguna mención al modo que lo hizo posible.

**Estados.** No hay estado vacío: si no hay nada que contar, la pantalla no aparece. No hay estado de carga visible: la llamada agrupada ocurre al abrir la salida, con la misma espera que la preparación ya tiene, y si falla no se nota porque el zurrón se lee igual con textos de plantilla.

**La fila de ajustes.** En A6P6, grupo «El mundo», fila **«Contar los pasos del día a día»**, tipo interruptor, valor **no** de origen. Al encenderla se pide el permiso de salud del sistema; si se deniega, la fila vuelve a **no** y bajo ella aparece una línea en voz de aplicación —es el único sitio donde eso está permitido— diciendo que sin ese permiso no se puede contar. La línea no ofrece ir a los ajustes del sistema ni insiste después.

### Pantallas y elementos utilizados

```
Pantalla ya dibujada que esta spec implementa:
  A2P2  pantalla 2 · artefacto 2 — El zurrón     (dueña: esta fila)

Pantallas de otras filas con las que encaja:
  A2P1  pantalla 1 · artefacto 2 — La portada    (dueña: fila 28)
  A2P3  pantalla 3 · artefacto 2 — Lo que hay hoy (dueña: fila 28)
  A6P6  pantalla 6 · artefacto 6 — Los ajustes   (dueña: fila 38)

Elementos del proyecto que se usan: la tipografía serif de la voz del mundo, el
rótulo en sans versalitas, la fila de ajuste de tipo interruptor.

Elemento nuevo: la entrada de zurrón —sitio y texto—, que es el mismo componente
para las cinco y no tiene variantes por tipo de cosa contada.
```

### data-testid

- `momento` — el momento del bucle, con valor `antes-de-salir`
- `zurron` — la pantalla entera, que **no existe** si el modo está apagado o la reserva vacía
- `zurron-envoltorio` — el titular, para poder afirmar que cae al de plantilla cuando la llamada falla
- `zurron-entrada` — cada entrada, con el número del paso que la generó
- `zurron-seguir` — la única acción
- `ajustes-pasos-de-fondo` — la fila del interruptor, que SPEC-038 declara y esta fila hace funcionar
- `ajustes-pasos-de-fondo-aviso` — la línea que aparece solo si el permiso se deniega o se revoca

Sin más: los textos de las entradas son texto único y se localizan por su contenido.

### Patrón de interacción

- **El zurrón no se puede consultar: se lee una vez y se va.** Regla: `quests.md` decisión 4, «se vacía narrada al empezar la siguiente salida»; un zurrón consultable sería el panel del estado del mundo que `design-system.md` prohíbe, y convertiría lo que se oye llegando a los sitios en una bandeja de entrada.
- **Una sola acción y ninguna manera de saltarlo.** Regla: el tope de cinco lo fija «lo que cabe en un resumen legible»; con cinco entradas como máximo, un botón de saltar solo serviría para que nadie lo lea.
- **Ninguna entrada se puede tocar.** Regla: `quests.md` decisión 3, «el resumen es un contenedor y no una unidad narrativa»; y `design-system.md`, el aviso se lee de un vistazo y nunca lleva un «toca para saber más». Lo que el zurrón cuenta sigue sedimentado en sus núcleos y se atiende yendo, que es el juego.
- **El interruptor no miente.** Regla: §6h; un interruptor encendido que en realidad no lee nada porque el permiso se revocó es exactamente una pieza que, al no estar, no protesta. El valor mostrado es el efectivo, no el pedido.
- **El permiso se pide al encender y solo entonces.** Regla: `seguridad-privacidad.md` §2, «el permiso se pide en contexto, explicando para qué, y nunca al instalar»; y `quests.md` §8, es opt-in explícito y no una casilla que llega marcada.
- **Denegar no se insiste.** Regla: `quests.md` decisión 4, el juego es completo sin el modo; una segunda petición convertiría una función opcional en una condición.
- **Decisión no cubierta por el design system:** cuándo se vacía la reserva. Se resuelve **al confirmar «Seguir»**, en la misma escritura que registra el hecho, de modo que cerrar la app a mitad devuelve el mismo zurrón. Vaciarla al componerlo perdería lo único que el mundo hizo mientras el jugador no estaba, y perderlo en silencio.
- **Decisión no cubierta por el design system:** qué pasa si la reserva tiene pasos pero ninguno produjo nada. Se resuelve **no enseñando el zurrón, no llamando al modelo y vaciando la reserva igual**, porque una pantalla que dice «no pasó nada» es peor que ninguna pantalla y además gasta una llamada.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/zurron.js` | la decisión de si hay zurrón, la composición de sus entradas desde la reserva, el orden, el vaciado con su hecho y la caída a plantilla |
| `packages/nucleo/partida/kilometros.js` (se consume) | la conversión, la reserva y su tope, todo de SPEC-011: no se toca |
| `app/` — el lector de salud | la petición del permiso, la lectura al abrir, la ventana y la marca de agua |
| `app/` — la pantalla A2P2 | el zurrón, que pinta lo compuesto y no calcula nada |
| `app/` — la fila de ajustes | el interruptor, su valor efectivo y su línea de aviso |

El reparto está elegido para que **casi todo sea afirmable en `@nucleo`**: si hay zurrón o no, cuántas entradas trae, su orden, que sean como mucho cinco, que caigan a plantilla cuando el narrador falla, que se llame una sola vez, que la reserva se vacíe con su hecho y entera, y que la composición sea idéntica con y sin narrador son propiedades de datos, comprobables con `node --test` y los dobles de SPEC-018. La lectura de salud se comprueba con su doble. Lo único que necesita dispositivo es que el permiso se pida en contexto y que el interruptor refleje una revocación hecha desde fuera.

### Frontera de inyección

Una entrada nueva, con doble en Node:

- **Lector de la app de salud** — recibe una ventana y devuelve **metros caminados**. Dobles: uno que devuelve una cantidad fija, uno que no responde, uno que devuelve valores inválidos y uno que simula un permiso revocado.

Detrás de esa firma hay dos decisiones que conviene dejar escritas. **Se piden metros, no pasos**, cuando la app de salud los tiene, porque el motor de SPEC-011 convierte metros con el tramo personal y no cuenta zancadas; si solo hay pasos, se convierten con una **longitud de zancada declarada como constante única y no personalizable**, porque personalizarla exigiría datos del cuerpo y `docs/testing.md` afirma que nada del personaje afecta al cuerpo. Y **no se pide nada con recorrido**: ni entrenamientos con ruta, ni ubicaciones, ni sesiones con mapa. Lo que se pide es lo mínimo que hace falta para mover un contador.

### La marca de agua, y por qué vive fuera de la partida

Para no contar dos veces los mismos metros hace falta saber hasta dónde se leyó, y eso es una marca del reloj real. SPEC-016 afirma que en el estado y en el registro **no hay ninguna marca de tiempo del reloj real**, y ese criterio no se negocia: es lo que hace la partida comparable byte a byte y reproducible en `node --test`.

Así que la marca de agua **vive en el área de la app y no en la partida**. Lo que cruza la frontera hacia el núcleo son **metros ya acotados**, un número. Consecuencias declaradas: la marca no entra en la copia del sistema ni en el fichero exportado, así que restaurar una partida en un móvil nuevo empieza a contar desde la primera lectura de ese móvil y no recupera los kilómetros del anterior. Es aceptable —un paso es tiempo del mundo, no una recompensa, y que la reserva se desborde no le quita nada a nadie— y es preferible a meter la vida real de la jugadora dentro de la partida.

La app resta además las **ventanas de salida activa**, para que los metros que ya movieron el mundo andando no lo muevan otra vez como pasos de fondo.

### Qué se lleva la reserva y qué se lleva el zurrón

SPEC-011 es explícita: los pasos de la reserva **ya se ejecutaron**, con su número correlativo y su azar, en el momento en que llegaron los metros. Lo que la reserva guarda es **lo que queda por narrar**. Esta spec no ejecuta ni un paso: coge lo que ya ocurrió y lo cuenta.

De ahí sale el caso de la reserva con pasos y sin nada que contar. Un paso puede no producir nada narrable —`quests.md` decisión 4 dice que un paso *puede* crear un rumor, una oportunidad o una razón para volver, no que siempre lo haga—, y cinco pasos vacíos no son una pantalla. Se vacía la reserva sin enseñar nada y sin gastar una llamada, y el mundo ha avanzado igual.

### La llamada, que es la única excepción declarada

`quests.md` decisión 3 dice que el LLM se invoca al crear la aventura, y hace **una sola excepción**: los pasos de fondo ocurren con la app cerrada, así que sus textos no existen todavía y se generan en una única llamada agrupada **al abrir la salida, nunca durante la caminata**. SPEC-018 ya fijó ese contrato, con su esquema, su filtro y su fallback por entrada; aquí solo se cablea y se afirma lo que se ve desde fuera: una llamada y no cinco, ninguna si no hay reserva, y un zurrón que se lee igual si la llamada se cae entera.

Esa última propiedad es la que hace que el zurrón cumpla RNF-RED-001 sin ninguna pantalla que hable de la red: **sin cobertura, el zurrón dice lo mismo**, con el envoltorio de plantilla y las entradas de plantilla, y nada indica que falte nada.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

- De **«Antes de salir es el único momento que pide atención»** (`@app @bucle`): **«El zurrón solo aparece si hay reserva que vaciar»**, entero, del que SPEC-018 sostenía solo la mitad de datos; y **«Sin cobertura, la preparación dice lo mismo»**, en lo que toca al zurrón.
- De **«El juego es apto por diseño y no distingue a un menor»** (`@app`): **«Los pasos de fondo vienen apagados»**, entero, incluido «y el juego es completo sin activarlo».
- De **«En marcha no hay nada que tocar»** (`@app`): **«La app no pide el permiso de ubicación permanente»**, entero, que hasta ahora no tenía dueño.
- De **«El mundo avanza con los kilómetros del jugador, no con el calendario»** (`@nucleo @rumores`): **«Estar un mes sin salir no acumula mundo pendiente»** y **«La reserva de pasos de fondo tiene tope de cinco»**, de los que esta fila entrega la mitad que faltaba —la fuente real de los kilómetros— y la comprobación de que volver tras tres meses enseña lo mismo que tras tres días.
- De **«El árbitro es el código y el narrador es el LLM»**: **«Sin red, la aventura funciona entera»**, aplicado al zurrón.
- **Frontera, que esta spec consume y no implementa:** **«Un paso solo añade»** y **«El contenido de un paso lo decide su número»** (fila 11), **«Sedimentar no se reprocha»** (fila 19) y **«La salida sigue viva con el móvil bloqueado»** (fila 30).

### Huecos de la batería que esta spec deja al descubierto

1. **Que el juego sea completo con el modo apagado no tiene aserción posible tal como está escrito.** «Y el juego es completo sin activarlo» es una frase de un escenario que nada persigue; la forma verificable es que ninguna pantalla fuera de ajustes lo mencione y que ninguna aventura dependa de él.
2. **El permiso de salud no tiene escenario.** Ni que se pida en contexto, ni que denegarlo deje el interruptor apagado, ni que revocarlo después lo apague — que es el caso donde el interruptor podría mentir.
3. **Que no exista ningún modo de fondo declarado no tiene escenario.** «La app no pide el permiso de ubicación permanente» cubre el permiso, no la declaración de capacidades de fondo, que es por donde se cuela una tarea periódica sin que nadie pida un permiso nuevo.
4. **No contar dos veces los mismos metros no tiene escenario**, ni entre dos aperturas ni contra una salida activa.
5. **El zurrón cerrado a medias no tiene escenario**, y es el caso que decide si lo único que el mundo hizo en tu ausencia se pierde en silencio.
6. **La reserva con pasos y sin nada que contar no tiene escenario.**

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN`). Regla: `CLAUDE.md` y el grep que cruza specs y batería.
- **Sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`.
- **La marca de agua de la lectura de salud vive fuera del estado de la partida** → asumido (alternativa: guardarla en el estado, con la fecha real que necesita). Regla: SPEC-016 afirma que ni el estado ni el registro llevan marcas del reloj real, y ese criterio es lo que hace la partida reproducible y comparable byte a byte; el precio declarado es que restaurar en un móvil nuevo no recupera los kilómetros del anterior. Es la decisión más discutible de esta spec.
- **Se piden metros a la app de salud, y si solo hay pasos se convierten con una zancada constante y no personalizable** → asumido (alternativa: pedir la altura o la longitud de zancada del jugador). Regla: `docs/testing.md`, «Nada del personaje afecta al cuerpo», y `seguridad-privacidad.md` §1: no se piden datos del cuerpo para mover un contador.
- **La reserva se vacía al confirmar «Seguir», no al componer el zurrón** → asumido (alternativa: vaciarla al leerla del motor). Regla: §6h; vaciar al componer pierde en silencio lo único que el mundo hizo en ausencia del jugador si la app muere entre la composición y la pantalla.
- **Una reserva cuyos pasos no produjeron nada no enseña zurrón, no llama al modelo y se vacía igual** → asumido (alternativa: enseñar un zurrón que diga que no pasó nada, o dejar la reserva llena hasta que algo pase). Regla: `quests.md` decisión 4, un paso solo añade y no siempre añade; una pantalla que dice que no pasó nada es peor que ninguna, y dejar la reserva llena bloquearía el tope para siempre.
- **El interruptor muestra el estado efectivo y se apaga solo si el permiso se revoca** → asumido (alternativa: mantenerlo encendido y fallar en silencio al leer). Regla: §6h; un interruptor encendido que no lee nada es la definición de degradación silenciosa.
- **Denegar el permiso se dice una vez, dentro de los ajustes, y no se vuelve a insistir** → asumido (alternativa: reintentar al abrir, o llevar a los ajustes del sistema). Regla: `quests.md` decisión 4, el juego es completo sin el modo; insistir convierte lo opcional en condición.
- **Apagar el modo no borra ni ejecuta la reserva pendiente** → asumido (alternativa: vaciarla al apagar). Regla: los pasos ya se ejecutaron y el contador ya avanzó, así que borrar lo pendiente de narrar perdería lo ocurrido sin deshacerlo; si se vuelve a encender, se cuenta lo que quedó.
- **La app resta las ventanas de salida activa antes de acreditar metros de fondo** → asumido (alternativa: contarlos igual, aceptando el doble conteo). Regla: `quests.md` decisión 4 separa explícitamente las dos fuentes; contar dos veces los mismos metros haría avanzar el mundo el doble por andar con la app abierta, que es justo lo contrario del reparto decidido.
- **El zurrón no se puede consultar después ni llegar a él desde ningún otro sitio** → asumido (alternativa: dejarlo accesible desde la portada hasta que se lea). Regla: `quests.md` decisión 3, es un resumen de apertura que se vacía; y un zurrón consultable es el panel del estado del mundo que `design-system.md` descarta.
- **Ninguna entrada del zurrón es tocable** → asumido (alternativa: tocar una entrada para ir a lo que cuenta). Regla: `design-system.md`, el aviso se lee de un vistazo y nunca lleva un «toca para saber más»; y lo que cuenta sigue sedimentado en su núcleo, así que atenderlo es ir andando, que es el juego entero.
- **El zurrón se intercala entre la portada y lo que hay hoy, y no se puede saltar** → asumido (alternativa: ofrecerlo como una tarjeta en la portada). Regla: `docs/flujo.md` dibuja `A2P1 → A2P2 → A2P3`; y con cinco entradas como mucho, un botón de saltar solo garantizaría que no se lea.
- **Los kilómetros de fondo se acreditan al mapa activo al abrir** → asumido, consumido de SPEC-041 y no redecidido aquí (alternativa: repartirlos por dónde se anduvieron). Regla: repartirlos exige un histórico de posiciones, que RF-PRIV-002 prohíbe.
