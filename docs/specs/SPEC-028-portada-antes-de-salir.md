# SPEC-028 — La portada y lo que se decide antes de salir

## Descripción

Lo que se ve al abrir la app cualquier día que no sea el primero, y las cuatro pantallas que van de ahí a tener la salida lista. La portada dice dónde estás, quién eres, qué hay hoy y por dónde se sale; la lista ofrece las aventuras que el mundo puede montar con lo que tiene, como mucho tres; la ficha es lo único que hay que decidir en todo el juego con la pantalla delante; y la preparación gasta los segundos de red que quedan y promete que a partir de ahí el juego se calla.

Es el único momento que pide atención, y por eso es también donde más fácil sería meter cosas que el diseño descartó por escrito: un panel del estado del mundo, un marcador de reputación, una barra de pestañas, un formulario de cuánto ando hoy. Esta spec entrega la pantalla **y la lista cerrada de lo que la compone**, que es la única forma de que esas ausencias se puedan poner rojas en lugar de vigilarse a ojo.

Anclas: **RF-BUCLE-002, RF-QUEST-011, RF-QUEST-012** (`docs/prd.md` §4.7 y §4.2) y **RNF-RED-001** (§5). Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` §3 y §4 y los cuatro momentos. Las pantallas están dibujadas en `docs/pantallas/pantallas-2-antes-de-salir.html` y encadenadas en `docs/flujo.md` como **A2P1 … A2P5**. Consume SPEC-008 (la falta de reparto y la oferta del estirón como dato), SPEC-010 (el casting y la forma de la aventura casteada), SPEC-015 (el oro y el rango, que se notan en cómo te hablan y no en un medidor), SPEC-017 (el catálogo y la afinidad de oficio), SPEC-018 (el gancho que escribe el narrador y su fallback de plantilla), SPEC-019 (la cola de entregas y el recado suelto que comparte lista), SPEC-025 (las ilustraciones de la preparación y los cuatro `data-testid` que ya declaró para esta fila) y SPEC-027 (el personaje, su oficio y su tramo).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparece el **calendario de la partida**, inyectado, porque el día es un dato que el núcleo no lee del reloj y que la portada, la rotación del recado y la lista de hoy necesitan. Está descrito en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** la **pantalla del zurrón** A2P2 con su contenedor, su tope de cinco y su llamada agrupada, que es la fila 42 —de ella aquí solo se entrega **la puerta**: bajo qué condición la portada la ofrece, y que con los pasos de fondo apagados de origen no se ofrezca nunca—; el **momento en marcha** y sus avisos (fila 29); el **rótulo del sistema** desde el que también se cierra una salida (fila 30); las **llegadas por geofence** (fila 32) y la **escena** (fila 34); el **telón** con su mapa entintado, su desenlace y su **cierre en corto** (fila 36), del que aquí solo se entrega la **puerta** de «dejarlo aquí»; el **diario** (fila 37), la **repisa y los ajustes** (fila 38) y los **mapas múltiples** (fila 41), que aquí son tres puertas y una ausencia de selector; la **generación de ilustraciones y textos** de la preparación (filas 18 y 25), que aquí se consume entera; y el **casting** (fila 10) y el **catálogo** (fila 17), que aquí se consumen y no se tocan.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`, y reutilizan literalmente los nombres de escenario que ya existen allí: «Se ofrecen tres aventuras como mucho», «Un día con una sola aventura no es un día roto», «Cada aventura declara su tamaño con una palabra», «Salir a andar sin nada es una opción de primer nivel», «Sin cobertura, la preparación dice lo mismo», «El zurrón solo aparece si hay reserva que vaciar», «La tarjeta de a medias solo existe con la salida abierta», «Si el filtro deja el mundo sin reparto, se ofrece el estirón», «No hay ninguna barra ni lista de reputación», «No existe ningún selector de mapas», «Sin red, la aventura funciona entera».

Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La portada» y «Lo que hay hoy»; la **validación de entradas** en la aventura que ya no existe cuando se acepta, en el recado que ya se aceptó en otra salida y en el tamaño de salida desconocido; el **estado vacío** en el día sin ninguna aventura que castee y en la partida sin ninguna entrada en la cola; el **estado de error** en la preparación sin cobertura, en la preparación que se pasa de su presupuesto y en la portada sin calendario cableado; y los **casos límite** en el día con una sola aventura, en el mundo que solo compone lista con el estirón, en la salida abierta desde hace días y en la lista donde el recado ocupa el tercer sitio.

### Dónde se puede poner rojo cada criterio

En la máquina donde se escribe esta spec **no hay simulador** (`pipeline/decisiones-orquestador.md` §4), así que **ningún flujo `@app` se puede ejecutar**. La regla que se aplica aquí, y que decide dónde se escribe cada criterio, es la misma que en SPEC-027: *todo lo que sea estado, secuencia o contenido se afirma en `@nucleo`, y en `@app` queda solo lo que de verdad necesita pantalla*.

La pieza que lo hace posible es **la composición de la portada y la de la lista de hoy como datos del núcleo**: dos funciones que, dado el estado de la partida y el mundo, devuelven **qué bloques hay y en qué orden**, con un vocabulario cerrado de bloques. Con eso, «no hay panel del mundo», «no hay marcador de reputación», «no hay barra de pestañas», «no hay selector de mapas», «la tarjeta de a medias solo existe con la salida abierta» y «la lista trae tres como mucho» dejan de ser inspecciones visuales y pasan a ser igualdades contra una lista cerrada. Sin eso serían criterios que se cumplen casi siempre y no miden nada (§6o), porque una ausencia solo se puede afirmar contra una enumeración de lo que sí hay.

- **`@nucleo`** — la composición de la portada y su vocabulario cerrado de bloques; la composición de la lista de hoy, su tope y la mezcla con el recado; la tarjeta de a medias y su condición; qué dispara «dejarlo aquí»; la oferta del estirón y qué pasa al aceptarla y al no aceptarla; la ficha de la aventura y qué nombra y qué no; el origen de cada texto (`llm` o `plantilla`) y que la pantalla no lo distinga; los tres tamaños dichos en palabra del mundo; y que ningún texto de estas cinco pantallas lleve una cifra de distancia.
- **`@app`** — que las cinco pantallas se monten en orden en un dispositivo, que las tres puertas lleven a sus tres destinos, que «Salir a andar sin más» sea un botón y no una nota al pie, y que la preparación termine y deje salir.
- **`@manual`** — que la preparación se sienta de segundos y no de minutos en un dispositivo real con red lenta.

### La portada

- **Dado** una partida con un mapa levantado y ninguna salida abierta, **cuando** se compone la portada, **entonces** sus bloques son exactamente: la miniatura del mapa con su día, la identidad de quien juega, las acciones de salir, y las tres puertas. Ninguno más.
- **Dado** la portada compuesta, **cuando** se busca un bloque de estado del mundo, **entonces** no existe ninguno, y el vocabulario de bloques no tiene forma de expresarlo.
- **Dado** la portada compuesta, **cuando** se busca un medidor de reputación, una barra o una lista de pueblos con puntuación, **entonces** no existe ninguno, y el rango solo aparece dicho dentro de una frase cuando toca decirlo.
- **Dado** la portada compuesta, **cuando** se cuentan sus destinos de navegación, **entonces** son tres —diario, repisa, ajustes— y cuelgan de la portada, no de una barra de pestañas.
- **Dado** la portada compuesta, **cuando** se busca un selector de mapas, **entonces** no existe: el mapa activo lo decide dónde estás.
- **Dado** la portada compuesta, **cuando** se leen sus acciones de salir, **entonces** «Salir a andar sin más» está al mismo nivel que «Ver qué se cuenta hoy», y no como nota al pie de ninguna otra.
- **Dado** la miniatura del mapa, **cuando** se pinta, **entonces** enseña lo entintado contra lo que sigue a lápiz, y ningún porcentaje.
- **Dado** la identidad de quien juega, **cuando** se lee, **entonces** trae el nombre del personaje y su oficio, y ninguna cifra.
- **Dado** una partida con el modo de pasos de fondo apagado, **cuando** se compone la portada, **entonces** no aparece la puerta del zurrón.
- **Dado** una partida con el modo de pasos de fondo encendido y la reserva vacía, **cuando** se compone la portada, **entonces** tampoco aparece: la puerta existe cuando hay algo que vaciar y no antes.
- **Dado** una portada sin calendario cableado, **cuando** se compone, **entonces** falla nombrando la pieza que falta, y no supone el día uno.

### La aventura a medias

- **Dado** un jugador que abandonó una aventura y llegó a casa, **cuando** abre la app, **entonces** no hay ninguna tarjeta de aventura a medias, y la aventura ya está cerrada porque el cierre en corto se disparó al llegar.
- **Dado** una salida todavía abierta, **cuando** se compone la portada, **entonces** aparece **arriba** una tarjeta que dice dónde se dejó y ofrece dos cosas: seguir con ella, o dejarlo aquí.
- **Dado** la tarjeta de a medias en pantalla, **cuando** se leen el resto de bloques, **entonces** siguen todos ahí: se puede mirar el diario o salir a andar sin ella.
- **Dado** la tarjeta de a medias, **cuando** se elige «dejarlo aquí», **entonces** la salida se cierra por la misma vía que llegar a casa, con el mismo cierre en corto, y no por una vía de emergencia distinta.
- **Dado** la tarjeta de a medias, **cuando** se elige seguir, **entonces** se pasa a andar con la misma salida abierta y sin volver a preparar nada.
- **Dado** una salida abierta desde hace días, **cuando** se abre la app, **entonces** la tarjeta sigue ahí igual y ningún texto menciona cuánto tiempo lleva.
- **Dado** una salida cerrada por cualquiera de las dos vías, **cuando** se vuelve a componer la portada, **entonces** la tarjeta ha desaparecido y no queda ninguna salida abierta.

### Lo que hay hoy

- **Dado** un mundo donde castean ocho plantillas para este oficio, **cuando** el jugador abre la lista de hoy, **entonces** ve tres como mucho.
- **Dado** un mundo donde castea una sola plantilla, **cuando** el jugador abre la lista de hoy, **entonces** ve una, y ningún texto se disculpa por ello.
- **Dado** la lista de hoy, **cuando** se lee cada entrada, **entonces** cada aventura muestra una palabra del mundo y un tiempo aproximado, y ninguna muestra una distancia.
- **Dado** una partida con un recado suelto pendiente, **cuando** se compone la lista, **entonces** el recado comparte lista con las aventuras, mide «un momento» y **ocupa un sitio del tope de tres**, nunca añade un cuarto.
- **Dado** la lista de hoy, **cuando** se comprueba de dónde salen las aventuras, **entonces** el catálogo llegó ya filtrado por la afinidad del oficio y hay plantillas que con este personaje no aparecen nunca.
- **Dado** la lista de hoy, **cuando** se lee su última línea, **entonces** dice que se puede salir a andar sin coger ninguna.
- **Dado** el mismo mundo, el mismo día y la misma partida, **cuando** se compone la lista dos veces, **entonces** sale la misma, en el mismo orden.
- **Dado** un día sin ninguna aventura que castee y sin recado pendiente, **cuando** se compone la lista, **entonces** se entrega la falta de reparto con su motivo, no una lista vacía que parece una lista.

### El estirón se ofrece y nunca se impone

- **Dado** un mundo donde el filtro deja menos de un lazo posible, **cuando** el jugador pide aventuras, **entonces** el juego dice que por aquí cerca no hay hoy gran cosa que contar, y ofrece alejarse un tramo más, pero no lo impone.
- **Dado** la oferta del estirón en pantalla, **cuando** no se acepta, **entonces** la lista se queda como estaba y «salir a andar sin más» sigue disponible.
- **Dado** la oferta del estirón, **cuando** se acepta, **entonces** se compone otra lista con un tramo más de alcance, y esa segunda lista se ofrece igual que la primera.
- **Dado** el estirón aceptado, **cuando** se compara el mundo, **entonces** es idéntico byte a byte: el estirón alarga hasta dónde te mandan y nunca resiembra qué existe.
- **Dado** el estirón aceptado y una segunda falta de reparto, **cuando** se compone, **entonces** no se encadena un segundo estirón automático: el alcance de más es de un tramo y se declara.
- **Dado** la oferta del estirón, **cuando** se lee su texto, **entonces** habla como mundo, no lleva ninguna cifra y no menciona ningún filtro ni la palabra accesibilidad.

### La ficha de la aventura

- **Dado** una aventura de la lista, **cuando** se abre su ficha, **entonces** enseña la forma del lazo entera y nombra **solo la primera parada**; las demás están dibujadas y sin nombre.
- **Dado** la ficha, **cuando** se lee su pie, **entonces** dice la palabra del mundo, el tiempo aproximado y **«vuelves donde empiezas»**, y ninguna distancia.
- **Dado** la ficha de una aventura cuyo lazo no cierra, **cuando** se intenta componer, **entonces** falla: SPEC-010 garantiza que todo lazo casteado cierra, y una ficha que dijera «vuelves donde empiezas» sobre un lazo abierto estaría mintiendo.
- **Dado** la ficha, **cuando** se lee su gancho, **entonces** es el que escribió el narrador si lo hubo y el de plantilla si no, y la pantalla es la misma en los dos casos.
- **Dado** la ficha, **cuando** se elige «Otra cosa», **entonces** se vuelve a la lista con las mismas entradas y sin haber aceptado nada.
- **Dado** la ficha, **cuando** se elige «Me la quedo», **entonces** la aventura queda aceptada y se pasa a la preparación.
- **Dado** una aventura aceptada, **cuando** se vuelve a la lista, **entonces** ya no se puede aceptar una segunda: hay una salida y una aventura.
- **Dado** una entrada de la lista que ya no existe en el estado cuando se acepta, **cuando** se intenta aceptar, **entonces** falla nombrando la entrada, y no acepta una aventura distinta en su lugar.
- **Dado** un recado suelto ya aceptado en otra salida, **cuando** se intenta aceptar otra vez, **entonces** falla nombrando el recado.

### La preparación, y la red que no está

- **Dado** una aventura aceptada, **cuando** se abre la preparación, **entonces** enseña las tres líneas que SPEC-025 fija y la frase que dice que a partir de ahí se puede meter el móvil en el bolsillo.
- **Dado** la preparación, **cuando** termina, **entonces** deja salir a andar, y esa es la última pantalla que pide atención hasta pararse en algún sitio.
- **Dado** un jugador sin conexión, **cuando** acepta una aventura y llega a la pantalla de preparación, **entonces** el texto es el mismo que con conexión, y ninguna pantalla menciona la falta de red.
- **Dado** un jugador sin conexión, **cuando** sale y recorre la aventura entera, **entonces** funciona entera: los textos salen de plantilla y el visor cae a ficha de texto.
- **Dado** una preparación sin cobertura, **cuando** se inspecciona el dato que queda guardado, **entonces** cada texto lleva su origen anotado como plantilla: **el silencio es hacia quien juega, nunca hacia el dato**.
- **Dado** una preparación con cliente de imágenes sin cablear, **cuando** se construye, **entonces** falla nombrando la pieza que falta, y no se comporta como una preparación sin cobertura: **la falta de red es un estado del mundo y la falta de cableado es una avería, y se distinguen** (§6h).
- **Dado** una preparación que se pasa de su presupuesto, **cuando** se cumple, **entonces** se sale igual con lo que haya, con lo que falte anotado como ausente y su motivo, y sin que la pantalla lo mencione.

### Lo que ninguna de las cinco pantallas lleva

- **Dado** todos los textos de A2P1 a A2P5, **cuando** se buscan cifras de distancia, ritmo, pasos, calorías, tiempo de esfuerzo, porcentaje de progreso o racha, **entonces** no aparece ninguna. El oro sí es un número y sí se enseña donde toque, porque es una moneda que se gasta.
- **Dado** todos los textos de A2P1 a A2P5, **cuando** se leen, **entonces** hablan como mundo: ninguno menciona la aplicación, la red ni los permisos.
- **Dado** todos los textos de A2P1 a A2P5, **cuando** se generan diez mundos distintos, **entonces** ninguno se vuelve falso en ninguno de ellos.
- **Dado** todos los textos de A2P1 a A2P5, **cuando** se pasan por el filtro de aptitud, **entonces** ninguno cae por masculino genérico evitable ni por morfología inventada.

### Determinismo

Bloqueante (`@determinismo`, RNF-DET-002).

- **Dado** la misma partida, el mismo mundo y el mismo día, **cuando** se compone la portada y la lista de hoy dos veces, **entonces** salen idénticas.
- **Dado** el código que esta fila añade, **cuando** se busca en él, **entonces** no aparece `Math.random` ni `Date.now`: el día llega inyectado.

## Lo que esta fila no respecifica

| Cosa | De quién es | Qué se consume aquí |
| --- | --- | --- |
| El tope de tres y la mezcla del recado en la lista | SPEC-019 | `listaDeHoy` y la medida «un momento» |
| La cola de entregas y el ciclo de dos ofertas | SPEC-019 | las entradas pendientes, para poblar el recado |
| El casting, los beats y el lazo cerrado | SPEC-010 | la aventura casteada, para pintar la ficha |
| La falta de reparto y el estirón de un tramo | SPEC-008 | el dato; aquí se convierte en oferta |
| El gancho del narrador y su fallback | SPEC-018 | el texto y su origen anotado |
| Las tres líneas de la preparación, su presupuesto y sus cuatro `data-testid` | SPEC-025 | la pantalla entera por debajo |
| El rango dicho en una frase, y que no haya medidor | SPEC-015 | la derivación; aquí solo se decide dónde no aparece |
| El personaje, su oficio y su tramo | SPEC-027 | la identidad de la portada y el filtro del catálogo |
| El zurrón, su tope de cinco y su llamada agrupada | fila 42 | nada: aquí solo la condición de la puerta |
| El cierre en corto y el telón | fila 36 | nada: aquí solo la puerta de «dejarlo aquí» |
| El diario, la repisa y los ajustes | filas 37 y 38 | nada: aquí solo tres puertas |

## UX Design

### Wireframe textual

Cinco pantallas, en el orden de `docs/flujo.md`. Todas son del momento **antes de salir**: la pantalla está permitida, se puede leer, elegir y esperar, y aquí manda la voz del mundo.

**A2P1 · La portada.** Layout de una columna, con la miniatura arriba y las acciones abajo. De arriba abajo:

1. **La miniatura del mapa**, con su línea de encabezado: «Tu mapa · día 23», el título del mundo debajo en serif, y bajo él, en una línea, la identidad: nombre del personaje y oficio. La miniatura enseña de un vistazo lo entintado contra lo que sigue a lápiz.
2. **La tarjeta de a medias**, y solo si hay una salida abierta: título «Lo dejaste a medias», el nombre de la aventura, una línea que dice dónde se quedó, y dos acciones dentro de la tarjeta — «Seguir con la entrega» como primaria y «dejarlo aquí» como secundaria. Es una tarjeta, no una pantalla: no secuestra nada de lo que hay debajo.
3. **Las acciones de salir**, apiladas y del mismo peso: «Ver qué se cuenta hoy» y «Salir a andar sin más». Si hay reserva del zurrón que vaciar, la primera lleva a A2P2; si no, lleva directamente a A2P3.
4. **Las tres puertas**, en una fila al pie: «El diario», «La repisa», «Ajustes». Fila, no barra de pestañas: cuelgan de la portada y no compiten con ella.

**A2P2 · El zurrón.** De la fila 42. Aquí solo existe la arista que lleva a ella y la condición que la hace existir.

**A2P3 · Lo que hay hoy.** Título en serif «Lo que se cuenta hoy», subtítulo «Por aquí hay quien necesita algo», y debajo la **lista de hoy**: como mucho tres entradas, cada una una tarjeta con título, gancho de una o dos líneas y, al pie, su **medida en palabra del mundo** con su equivalencia orientativa —«Una aventura · unas dos horas», «Un paseo · una hora», «Un momento» para el recado—. Bajo la lista, la línea que dice que se puede salir a andar sin coger ninguna.

Cuando no hay reparto, la lista se sustituye por **la oferta del estirón**: una frase en voz de mundo que dice que por aquí cerca no hay hoy gran cosa que contar, y una acción para alejarse un tramo más. Debajo, la misma línea de siempre sobre salir a andar sin coger nada, que es lo que hace que la oferta no sea la única salida.

**A2P4 · La ficha.** El **lazo dibujado** ocupa la mitad superior: los puntos del recorrido numerados, con **solo el primero rotulado** —«TABERNA DA COROA»— y los demás como puntos sin nombre. Debajo, el título de la aventura, el **gancho** entre comillas y en serif, y bajo él la línea de pie: «Una aventura · unas dos horas · vuelves donde empiezas». Debajo, una línea que dice por dónde se empieza y que el resto te lo irán diciendo. Al pie, dos acciones: **«Me la quedo»** como primaria y **«Otra cosa»** como secundaria, que devuelve a la lista.

**A2P5 · La preparación.** La entrega SPEC-025 por debajo y aquí no se rediseña: título «Preparando la salida», su coletilla, las tres líneas fijas, la frase de contrato y el botón «Listo. Vamos.». Lo que esta fila fija es **que la pantalla dice lo mismo con red y sin ella**, y que de ella se sale a andar.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec entrega enteras:
  A2P1  pantalla 1 · artefacto 2 — La portada
  A2P3  pantalla 3 · artefacto 2 — Lo que hay hoy
  A2P4  pantalla 4 · artefacto 2 — La ficha

Pantalla que esta spec alimenta por debajo, sin rediseñar:
  A2P5  pantalla 5 · artefacto 2 — La preparación          (dueña: fila 25)

Pantalla de la que solo se entrega la puerta:
  A2P2  pantalla 2 · artefacto 2 — El zurrón               (dueña: fila 42)

Elementos del proyecto que se usan y no se rediseñan:
  la lámina en miniatura y sus tintas (SPEC-021), la cartela del título del mundo,
  la placa de rótulo de núcleo.

Elementos nuevos de esta fila:
  la tarjeta de a medias — dos acciones dentro, sin secuestrar la portada
  la fila de tres puertas — no una barra de pestañas
  la tarjeta de oferta — título, gancho y medida en palabra del mundo
  el lazo dibujado con una sola parada rotulada
  la oferta del estirón — frase y acción, sustituyendo a la lista

Elementos que NO se usan, y su ausencia es lo que esta spec protege:
  panel del estado del mundo · medidor o barra de reputación · barra de pestañas ·
  selector de mapas · cualquier cifra de distancia, tiempo, ritmo, pasos o progreso.
```

### data-testid

El **estado del momento** es `momento-antes-de-salir`, que SPEC-025 ya declaró para esta fila; se conserva el nombre. El **mapa** aparece aquí en miniatura y con identidad propia, porque no es la lámina jugable de SPEC-026. Los cuatro de la preparación son los que SPEC-025 dejó nombrados y no se renombran.

```
- `momento-antes-de-salir`  — el estado del momento (declarado por SPEC-025)
- `portada`                 — la portada entera, el ancla de todo flujo
- `portada-bloques`         — la composición, con los bloques presentes y su orden
- `portada-miniatura`       — la miniatura del mapa con su día
- `portada-identidad`       — el nombre del personaje y su oficio
- `salir-sin-mas`           — «Salir a andar sin más»
- `ver-que-se-cuenta`       — «Ver qué se cuenta hoy»
- `puerta-diario`           — la puerta al diario
- `puerta-repisa`           — la puerta a la repisa
- `puerta-ajustes`          — la puerta a los ajustes

- `tarjeta-a-medias`        — la tarjeta, que solo existe con la salida abierta
- `a-medias-seguir`         — seguir con ella
- `a-medias-dejarlo`        — dejarlo aquí

- `lista-de-hoy`            — la lista entera, para afirmar cuántas entradas trae
- `oferta-<id>`             — cada tarjeta, con el identificador de su entrada
- `oferta-medida`           — la palabra del mundo y su tiempo, dentro de la tarjeta
- `andar-sin-nada`          — la línea que dice que se puede salir sin coger ninguna
- `sin-reparto`             — el bloque que sustituye a la lista cuando no hay reparto
- `estiron`                 — la acción de alejarse un tramo más

- `ficha-aventura`          — la ficha entera
- `ficha-lazo`              — el lazo dibujado
- `ficha-primera-parada`    — el único punto rotulado
- `ficha-pie`               — la medida, el tiempo y «vuelves donde empiezas»
- `ficha-gancho`            — el gancho, escrito por el narrador o por plantilla
- `ficha-aceptar`           — «Me la quedo»
- `ficha-otra-cosa`         — «Otra cosa»

- `preparacion-salida`      — la pantalla de preparación  (declarado por SPEC-025)
- `preparacion-lineas`      — las tres líneas             (declarado por SPEC-025)
- `preparacion-listo`       — «Listo. Vamos.»             (declarado por SPEC-025)
```

Sin más: los títulos de las aventuras, los ganchos y los nombres de las puertas son texto único y se localizan por su contenido.

### Patrón de interacción

- **Las dos maneras de salir van al mismo nivel.** Regla: `quests.md` decisión 4, «los kilómetros mueven el mundo con aventura o sin ella»; poner «salir a andar sin más» como enlace pequeño bajo un botón grande diría lo contrario de lo que el diseño decidió, y lo diría más alto que cualquier texto.
- **Las tres puertas son una fila al pie y no una barra de pestañas.** Regla: `design-system.md`, momento «de consulta», y la corrección que el artefacto 6 hizo sobre el 2; cuatro destinos de igual peso convierten el juego en una aplicación con secciones y dejan los ajustes con el mismo rango que el mapa.
- **La aventura a medias es una tarjeta y no una pantalla que se interpone.** Regla: `bucle-jugable.md` §4, «no secuestra la app»; una pantalla modal obligaría a resolverla para llegar al diario, y abandonarla no puede costar nada.
- **«Dejarlo aquí» no pide confirmación.** Regla: `design-system.md`, los dos registros; un «¿Seguro?» es la aplicación desconfiando, y además el cierre en corto tiene final digno, así que no hay nada que lamentar. Decisión no cubierta por el sistema de diseño: se resuelve sin `AlertDialog` porque la acción **no destruye nada** —cierra una salida y produce un desenlace—, y la regla de confirmar antes de destruir no aplica.
- **La lista trae tres como mucho y no se pagina.** Regla: `bucle-jugable.md` §3, «tres caben de un vistazo y se comparan sin leer; a partir de ahí la pantalla se convierte en un catálogo». Sin paginación, sin «ver más», sin desplazamiento entre ofertas: el tope existe precisamente para que no haga falta.
- **La lista no se ordena por nada en particular y no se declara ordenación.** Regla: `bucle-jugable.md` §3, se elige por antojo y no por aritmética; un orden declarado —por duración, por cercanía— reintroduce la aritmética que el tope quitó.
- **El estirón sustituye a la lista, no se añade debajo.** Regla: `bucle-jugable.md` §7 y `accesibilidad.md` §2; si hubiera lista y además oferta, el estirón sería un extra y no lo que es: la respuesta honesta a que hoy no hay nada. Y por eso la línea de «salir a andar sin coger ninguna» se queda: es lo que impide que la oferta sea la única salida.
- **La ficha enseña el lazo entero y nombra solo la primera parada.** Regla: `quests.md` §3 y decisión 2; se decide juzgando la caminata —dónde cae, cuánto rodea, que vuelve— sin destripar la historia. Queda registrada la duda que el artefacto dejó abierta —lazo completo desde el principio o revelado— y se resuelve a favor de completo, porque esta pantalla existe para decidir.
- **La preparación no ofrece cancelar.** Regla: `bucle-jugable.md`, los cuatro momentos; dura segundos y termina sola, y un botón de cancelar sería un control para un momento que no lo necesita. Volver atrás desde aquí es «Otra cosa» en la ficha, un paso antes.
- **Sin cobertura, ninguna pantalla lo dice.** Regla: `bucle-jugable.md`, momento 1: «anunciarlo solo serviría para señalar algo que el jugador no puede arreglar». Y su contrapartida, que es lo que impide que esto sea §6h: **el dato sí lo dice**, con el origen de cada texto anotado y lo ausente declarado con su motivo.

## Notas técnicas

### Frontera de inyección

Una entrada nueva, con doble en Node:

1. **Calendario de la partida** — el día, como entero, para el encabezado de la portada, la rotación del recado suelto y la composición de la lista de hoy. Está inyectado porque `packages/nucleo/` no lee el reloj del sistema, y su ausencia es error de construcción, no un día uno supuesto.

El **almacén de la partida** (SPEC-026), el **cliente del narrador** (SPEC-018) y el **conseguidor de recursos** (SPEC-025) ya entraron y aquí solo se cablean.

### La composición como dato, y por qué

Dos funciones de núcleo son lo que hace verificable esta fila sin dispositivo:

- **La composición de la portada** — dado el estado y el mapa, devuelve los bloques presentes y su orden, sobre un **vocabulario cerrado**. Que sea cerrado es el punto entero: «no hay panel del mundo» y «no hay marcador de reputación» se afirman comprobando que el vocabulario no tiene forma de expresarlos, y añadir uno obligaría a ampliarlo, que es exactamente el sitio donde se quiere que salte.
- **La composición de la lista de hoy** — dado el mundo, el estado, el oficio, el tramo y el día, devuelve o bien hasta tres entradas con su medida, o bien la falta de reparto con su motivo y la oferta del estirón. Nunca una lista vacía, que es la degradación silenciosa que §6h persigue.

### El registro de la salida abierta

La tarjeta de a medias necesita saber si hay una salida abierta, y **hoy nadie posee ese registro**: `cierraSalida` de SPEC-019 recibe la identidad de la salida como parámetro y no la crea. Esta fila lo entrega —abrir una salida, consultarla, cerrarla por volver o a mano— porque es la primera que lo necesita, y las filas 29, 30 y 36 lo consumen. Guarda lo mínimo: identidad de la salida, mapa, aventura aceptada si la hay, y el sitio donde se quedó, dicho con el nombre del mundo. **Ninguna coordenada y ninguna marca de tiempo**, por RF-PRIV-002.

### Los dos silencios, que no son el mismo

Conviene dejarlo escrito porque los dos aparecen en esta fila y se parecen:

- **El silencio de diseño** (RNF-RED-001): sin cobertura, ninguna pantalla lo menciona. Es deliberado y se comprueba leyendo los textos.
- **La degradación silenciosa** (`pipeline/decisiones-orquestador.md` §6h): una pieza que no está y no protesta. Está prohibida, y se comprueba haciendo fallar la construcción.

La frontera entre los dos es limpia: **falta de red es un estado del mundo, falta de cableado es una avería**. Lo que las mantiene separadas en la práctica es que la ausencia se anota siempre en el dato con su motivo —el vocabulario cerrado de SPEC-025— aunque la pantalla no diga nada.

## Decisiones asumidas

- **La composición de la portada y la de la lista son datos del núcleo, con vocabulario cerrado de bloques** → asumido (alternativa: montar las pantallas directamente en `app/` y comprobar las ausencias mirando). Regla: §6o; sin simulador, «no hay panel del mundo» comprobado a ojo es un criterio que nunca se pone rojo. Una lista cerrada convierte una ausencia en una igualdad.
- **El registro de la salida abierta lo entrega esta fila** → asumido (alternativa: dejarlo a la fila 30, que es la del rótulo, o a la 36, que es la del telón). Regla: es la primera fila que lo necesita —la tarjeta de a medias no se puede componer sin él— y `entregas.js` ya lo trata como parámetro sin dueño. Si la fila 30 lo nombra de otra manera, manda ella y esto se ajusta por iteración.
- **De A2P2 solo se entrega la puerta y su condición** → asumido (alternativa: entregar el zurrón entero, que está dibujado y es corto). Regla: el reparto de filas del checklist, donde RF-RUMOR-002 y RF-PRIV-003 son de la fila 42; y con los pasos de fondo apagados de origen (SPEC-027), entregar la pantalla ahora sería entregar algo que nadie puede ver.
- **La lista no declara ordenación** → asumido (alternativa: ordenar por tamaño, o poner el recado siempre al final). Regla: `bucle-jugable.md` §3, «ordenadas por nada en particular» está dicho literalmente en el artefacto; lo que sí se exige es que la composición sea determinista, que es cosa distinta de estar ordenada por un criterio visible.
- **El estirón alarga un tramo y no se encadena solo** → asumido (alternativa: ofrecer estirones sucesivos hasta que haya reparto). Regla: SPEC-008 fija el estirón en un tramo y `bucle-jugable.md` §7 dice «se ofrece, nunca se impone»; encadenarlo solo sería el juego decidiendo cuánto andas, que es justo lo contrario.
- **El lazo se dibuja completo desde el principio** → asumido (alternativa: revelarlo conforme se recorre, que es la duda que el artefacto dejó abierta). Regla: la propia nota del artefacto —«aquí está completo porque esta pantalla existe para decidir»—; revelar da más sorpresa pero deja sin decidir lo único que hay que decidir.
- **«Dejarlo aquí» dispara el mismo cierre que llegar a casa y no una vía propia** → asumido (alternativa: cerrar sin desenlace, como un descarte). Regla: `bucle-jugable.md` §8, «no es una salida de emergencia sino la misma puerta en otro sitio»; y §4, el cierre en corto existe para que no quede hilo colgando.
- **La identidad de la portada trae nombre y oficio y nada más** → asumido (alternativa: añadir el rango, o el mote del núcleo más cercano). Regla: `design-system.md`, ningún medidor de reputación; el rango se nota en cómo te hablan, y ponerlo bajo el nombre lo convierte en una etiqueta permanente, que es un medidor con otro nombre.
- **La miniatura del mapa no es tocable** → asumido (alternativa: que abra la lámina entera). Regla: el flujo no dibuja esa arista y `bucle-jugable.md` §1 dice que el mapa se entinta al echar el telón; una lámina consultable desde la portada es una decisión de la fila 37 —el diario tiene un capítulo por mapa— y no de esta.
- **El día llega inyectado como entero y no como fecha** → asumido (alternativa: pasar una fecha del sistema). Regla: RNF-DET-002 y la costumbre del repo —SPEC-015 ya recibe el día así—; una fecha arrastraría zona horaria y calendario dentro del núcleo.
- **Ningún texto de estas pantallas menciona el oro salvo donde el diseño lo pide** → asumido (alternativa: enseñar el saldo en la portada, junto a la identidad). Regla: `design-system.md`, «el oro sí es un número y sí se enseña, porque es una moneda que se gasta», pero se enseña donde se gasta —la repisa y los informantes, fila 38 y SPEC-015— y no como marcador permanente en la casa.
