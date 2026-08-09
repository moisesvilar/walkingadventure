# SPEC-029 — En marcha: el mapa que no se mira y los avisos desde el bolsillo

## Descripción

El momento más largo de una salida y el único donde el juego no puede pedir nada, porque pedirlo significa que alguien cruza una calle mirando el móvil. Esta fila entrega lo que hay debajo de la pantalla de bloqueo mientras se anda: el mapa a pantalla completa con el norte arriba y sin nada encima, la guía en lenguaje del mundo, los avisos que llegan por dos capas —la noticia con háptico y marca, la oportunidad con notificación y háptico—, la oferta del desvío que se acepta girando, y la declaración del camino que la ruta evitó.

Casi todo lo que se especifica aquí son **ausencias**: ni un control tocable, ni una cifra de esfuerzo, ni un botón de aceptar, ni un reproche por irse por otro lado, ni un recálculo. Una ausencia solo se puede poner roja contra una enumeración de lo que sí hay, así que la pieza central de esta fila es **la composición del momento en marcha como dato del núcleo**, con vocabularios cerrados de elementos, de tocables y de capas de aviso.

Anclas: **RF-BUCLE-001, RF-BUCLE-004, RF-BUCLE-009, RF-BUCLE-014, RF-BUCLE-016** (`docs/prd.md` §4.7) y **RF-MAPA-005** (§4.9). Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` momento 2 y §9, y `game-design/accesibilidad.md` §2 y §3. Las pantallas están dibujadas en `docs/pantallas/pantallas-3-en-marcha.html` y encadenadas en `docs/flujo.md` como **A3P2, A3P3, A3P4, A3P5 y A3P6**. Consume SPEC-008 (el camino evitado con su nombre y su motivo, y los ramales con nombre), SPEC-019 (los micro-encuentros, su retención durante un beat y su ciclo de dos ofertas), SPEC-021 y SPEC-022 (el pintado y la colocación de rótulos), SPEC-026 (la lámina, la cámara y el norte arriba) y SPEC-028 (el registro de la salida abierta).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparecen el **seguidor de posición** —que entrega posiciones ya clasificadas—, el **vibrador** y el **notificador**, los tres inyectados y los tres con doble en Node. Están descritos en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el **rótulo del sistema** de A3P1 con su servicio en primer plano, su Actividad en Vivo, la acción de dar la salida por terminada y su retirada tras un buen rato sin andar, que es la fila 30 —de él aquí solo se consume que existe y que es lo único tocable—; la **detección de vehículo** y la regla de la duda (fila 31), que aquí se consume tal como SPEC-004 la dejó; la **validación de llegada por geofence** y la escena que queda esperando (fila 32), de la que aquí solo se entrega la mitad que decide **qué enseña abrir la app**; el **visor** (fila 33) y la **escena del beat** (fila 34); el **telón** con el entintado y las tres tintas (fila 36), que es donde se cobra lo andado; el **motor de pasos** y el conteo de kilómetros (fila 11), que aquí no se toca y sobre todo no se enseña; la **cola de entregas** y el ciclo de dos ofertas (fila 19), que aquí se consume; el **filtro sobre el grafo** y el trazado que rodea (fila 8), del que aquí se pinta la declaración y no se recalcula nada; y **A3P7**, que está dibujada a propósito para no hacerse y cuya única entrega aquí es que ninguno de sus elementos exista.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`, y reutilizan literalmente los nombres de escenario que ya existen allí: «La pantalla del mapa no tiene ni un control», «No se enseña ninguna cifra de esfuerzo», «El mapa no cambia durante la salida», «El norte está siempre arriba», «Una noticia va por háptico y marca», «Una oportunidad va por notificación y háptico», «Ningún aviso viaja por una sola capa», «El aviso se lee entero de un vistazo», «Tocar un aviso no acepta nada», «No se avisa durante un beat en curso», «Sedimentar no se reprocha», «El camino evitado se declara con nombre propio».

Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Si miras» y «Los avisos»; la **validación de entradas** en el aviso cuyo texto no cabe en una línea, el aviso que no nombra sitio, el tipo de aviso que no está en el enumerado y el ramal sin nombre; el **estado vacío** en la salida sin ninguna aventura aceptada y en el mapa sin ninguna marca de aviso; el **estado de error** en el seguidor de posición que deja de responder, en el vibrador ausente y en el notificador denegado; y los **casos límite** en el aviso que llega durante un beat, en la oportunidad ya ofrecida dos veces, en el desvío que no se toma, en pasar cerca de un beat camino del supermercado y en la salida que sigue abierta días después.

### Dónde se puede poner rojo cada criterio

En la máquina donde se escribe esta spec **no hay simulador** (`pipeline/decisiones-orquestador.md` §4), así que **ningún flujo `@app` se puede ejecutar**. Aquí eso pesa más que en ninguna otra fila, porque casi todo lo que hay que afirmar son ausencias y las ausencias son justo lo que peor se comprueba mirando. La regla, la misma que en las dos filas anteriores: *lo que sea estado, secuencia o contenido se afirma en `@nucleo`, y en `@app` queda solo lo que de verdad necesita pantalla*.

Lo que lo hace posible:

- **La composición del momento en marcha** es un dato del núcleo con un **vocabulario cerrado de elementos** y una **lista de tocables que tiene que salir vacía**. Así «ni un control tocable» es una igualdad contra una lista, y no una inspección; y añadir un botón obligaría a ampliar el vocabulario, que es donde se quiere que salte.
- **Los textos del momento** los compone el núcleo, así que «ninguna cifra de esfuerzo» se comprueba pasando todas las cadenas por el mismo cribado de cifras que el filtro de aptitud ya tiene, y «el aviso se lee de un vistazo» se comprueba sobre el texto y no sobre una captura.
- **El catálogo de avisos** declara sus capas, así que «ningún aviso viaja por una sola capa» se afirma recorriendo el catálogo entero, incluidos los avisos que se añadan después. Es la regla de mantenimiento de `accesibilidad.md` §3 convertida en criterio.

Reparto:

- **`@nucleo`** — la composición del momento y sus dos vocabularios cerrados; el catálogo de avisos y sus capas; la validación del texto de un aviso; la retención durante un beat; qué enseña abrir la app según el estado; la oferta del desvío, su frase y su nombre de ramal; la declaración del camino evitado; qué sitios van rotulados; y la ausencia de toda cuenta del trazado.
- **`@app`** — que el mapa ocupe la pantalla de verdad, que el háptico y la notificación salgan por sus canales, que tocar una notificación abra el mapa con la marca puesta, y que la pantalla no se encienda con una noticia.
- **`@manual`** — que el háptico se note desde el bolsillo, y que andar veinte minutos con el móvil bloqueado no encienda la pantalla ni una vez.

### Si miras: el mapa en marcha

- **Dado** un jugador andando con una aventura aceptada, **cuando** mira la pantalla, **entonces** no hay ningún elemento tocable dentro de la app: la lista de tocables del momento sale vacía.
- **Dado** el momento en marcha compuesto, **cuando** se leen sus elementos, **entonces** son exactamente: la lámina, la marca de posición, las marcas de aviso si las hay, la guía, y el zócalo si hay algo que declarar. Ninguno más.
- **Dado** un jugador andando, **cuando** mira la pantalla, **entonces** no aparecen kilómetros, ritmo, pasos, calorías, tiempo ni porcentaje de progreso.
- **Dado** todos los textos que este momento compone, **cuando** se buscan cifras, **entonces** no aparece ninguna, ni siquiera dentro de una frase.
- **Dado** el momento en marcha, **cuando** se busca una racha, un logro o una cuenta de días, **entonces** no existe ninguno.
- **Dado** un jugador andando hacia el sur, **cuando** mira el mapa, **entonces** el norte sigue arriba.
- **Dado** la lámina en marcha, **cuando** se mira su marca de posición, **entonces** es una marca roja del propio mapa y no un punto de sistema.
- **Dado** la guía, **cuando** se lee, **entonces** nombra la calzada por la que se va y el sitio hacia el que se va, y no da ninguna indicación de giro ni de metros.
- **Dado** un jugador que atraviesa territorio que no conocía, **cuando** mira el mapa a mitad de camino, **entonces** el mapa está como al salir de casa, y solo se ha movido su marca.
- **Dado** un jugador que atraviesa territorio nuevo, **cuando** ocurre, **entonces** no vibra, no se felicita y no se dibuja nada en vivo: se registra en silencio y se cobra al echar el telón.
- **Dado** una aventura aceptada, **cuando** se mira el mapa, **entonces** los sitios a los que la aventura manda están rotulados con su nombre aunque no se hayan pisado nunca.
- **Dado** una salida sin aventura aceptada, **cuando** se mira el mapa, **entonces** se ve igual, con la marca de posición y sin guía.
- **Dado** el momento en marcha, **cuando** se busca una barra de pestañas, una cabecera, un control de zoom, un botón de centrar o una leyenda, **entonces** no hay ninguno: acercar y arrastrar son gestos, y ni siquiera hacen falta.

### Los avisos, y sus dos capas

- **Dado** el catálogo completo de avisos del juego, **cuando** se revisa cada uno, **entonces** todos tienen al menos una capa de bolsillo y una de pantalla.
- **Dado** un aviso declarado con dos capas de bolsillo, **cuando** se declara, **entonces** falla nombrando el aviso: háptico y sonido fallan a la vez para la misma persona y duplicar así no es duplicar.
- **Dado** un rumor que alcanza un sitio del mapa, **cuando** llega el aviso, **entonces** vibra el móvil y aparece una marca en el mapa, pero no salta ninguna notificación.
- **Dado** una noticia, **cuando** llega, **entonces** la pantalla no se enciende.
- **Dado** un micro-encuentro disponible, **cuando** el jugador entra en su geofence, **entonces** salta una notificación y vibra el móvil.
- **Dado** una oportunidad, **cuando** salta, **entonces** es el único aviso del juego que enciende la pantalla.
- **Dado** una notificación de oportunidad, **cuando** se lee su texto, **entonces** cabe en una línea, nombra el sitio, y no contiene ningún «toca para saber más».
- **Dado** un texto de aviso que no nombra ningún sitio del mundo, **cuando** se valida, **entonces** falla nombrando el aviso: «completo incluye dónde».
- **Dado** un texto de aviso que no cabe en una línea, **cuando** se valida, **entonces** falla, y no se recorta para que quepa.
- **Dado** una noticia, **cuando** se lee su zócalo en el mapa, **entonces** dice que hay algo y dónde, y el contenido se oye llegando.
- **Dado** un jugador dentro de una escena de la aventura principal, **cuando** el mundo produce una oportunidad, **entonces** no salta ningún aviso hasta que la escena termina.
- **Dado** una oportunidad retenida por un beat en curso, **cuando** la escena termina, **entonces** el aviso sale entonces y no se pierde.
- **Dado** una notificación de oportunidad, **cuando** el jugador la toca mientras anda, **entonces** se abre el mapa con la marca del encuentro, y no se acepta ninguna aventura ni se abre ninguna escena.
- **Dado** una oportunidad, **cuando** se busca una acción de aceptar o de rechazar, **entonces** no existe ninguna: se acepta yendo.
- **Dado** una oportunidad ignorada, **cuando** el jugador sale otro día, **entonces** se le ofrece una vez más, en otro sitio; y si vuelve a ignorarla, sedimenta sin volver a ofrecerse.
- **Dado** una oportunidad sedimentada, **cuando** el jugador recorre el juego entero, **entonces** ningún texto menciona que no fuese.
- **Dado** un tipo de aviso que no está en el enumerado, **cuando** se intenta emitir, **entonces** falla nombrando los que sí valen.

### Abrir la app enseña el estado

- **Dado** un jugador andando, **cuando** abre la app por el icono, **entonces** ve el mapa.
- **Dado** un jugador parado dentro de un geofence, **cuando** abre la app por el icono, **entonces** ve la escena.
- **Dado** un jugador parado dentro de un geofence, **cuando** entra tocando el aviso o el rótulo del sistema, **entonces** ve lo mismo que entrando por el icono: **quien decide qué hay es el estado y no la puerta**.
- **Dado** las tres puertas de entrada, **cuando** se comparan, **entonces** ninguna tiene comportamiento propio.
- **Dado** un jugador andando que toca un aviso, **cuando** se abre el mapa, **entonces** trae la marca del encuentro puesta y nada más ha cambiado.

### Irse por otro lado no existe

- **Dado** un jugador que va a su destino por otra calle, **cuando** llega, **entonces** el juego no se ha enterado y nada lo menciona.
- **Dado** un jugador que se va a otro sitio, **cuando** ocurre, **entonces** no aparece ningún «te has desviado», ninguna marca que parpadee y ningún recálculo.
- **Dado** el estado de una salida en marcha, **cuando** se lee su esquema, **entonces** no tiene ningún campo de recorrido, de desviación ni de adherencia al trazado: **no existe la cuenta que habría que llevar para reprochar**.
- **Dado** un jugador que pasa cerca de un beat camino del supermercado, **cuando** entra en su geofence, **entonces** valida igual y la escena queda esperando.
- **Dado** la validación de una llegada, **cuando** se comprueba de qué depende, **entonces** depende del geofence del sitio y nunca de ir por el trazado.
- **Dado** una aventura aceptada, **cuando** el jugador anda por donde le da la gana, **entonces** la aventura sigue abierta hasta que llega a casa o la cierra a mano.
- **Dado** una salida abierta desde hace días, **cuando** se consulta, **entonces** el juego no la ha dado por muerta por su cuenta.

### El desvío se acepta con las piernas

- **Dado** un jugador que llega a un cruce con un paraje fuera del lazo, **cuando** mira, **entonces** se le ofrece el desvío nombrando el ramal y el paraje.
- **Dado** la oferta del desvío, **cuando** se lee, **entonces** dice lo que cuesta con una frase y con el dibujo del ramal, y no con metros ni con minutos.
- **Dado** la oferta del desvío, **cuando** se busca una acción de aceptar, **entonces** no existe ninguna: se acepta girando.
- **Dado** un ramal sin nombre, **cuando** se intenta componer la oferta, **entonces** falla nombrando el ramal, y no se ofrece un desvío anónimo.
- **Dado** un jugador que no gira, **cuando** sigue andando, **entonces** no pasa nada, ningún texto lo menciona, y el paraje sigue ahí para otro día.
- **Dado** un jugador que gira y llega, **cuando** entra en el geofence del paraje, **entonces** ocurre lo que ocurre al llegar a cualquier sitio.
- **Dado** el desvío ofrecido, **cuando** se compara con un micro-encuentro, **entonces** son cosas distintas: el micro-encuentro está en el camino y cuesta cero, y el desvío está fuera del lazo y cuesta piernas.

### El camino evitado se declara

- **Dado** un jugador que ha marcado que evita escalones y una ruta que rodea unas escaleras, **cuando** llega al punto donde la ruta rodea, **entonces** el juego nombra el camino evitado y dice por qué, y no aparece la palabra «accesibilidad» en ningún texto.
- **Dado** la declaración del camino evitado, **cuando** se lee, **entonces** habla en lenguaje del mundo, con nombre propio y una razón concreta, y no lleva iconos ni etiquetas.
- **Dado** el camino evitado, **cuando** se mira el mapa, **entonces** sigue existiendo y dibujado: el filtro evita, no borra.
- **Dado** un tramo cosido o inventado, **cuando** se compone cualquier declaración, **entonces** no se da por transitable.
- **Dado** una ruta que no pudo rodear y pasa por un tramo no apto, **cuando** se llega, **entonces** se declara igual, con su nombre y su motivo: se avisa, no se oculta.

### Nada degrada por falta de cableado

Aplicación directa de `pipeline/decisiones-orquestador.md` §6h, con una distinción que en esta fila es la que más importa: **un canal denegado por quien juega es un estado, y un canal sin cablear es una avería**.

- **Dado** el momento en marcha sin seguidor de posición cableado, **cuando** se construye, **entonces** falla nombrando la pieza que falta, y no enseña un mapa con la marca quieta.
- **Dado** el momento en marcha sin vibrador cableado, **cuando** se construye, **entonces** falla nombrando la pieza que falta, y no emite avisos de una sola capa en silencio.
- **Dado** el permiso de notificaciones denegado por quien juega, **cuando** salta una oportunidad, **entonces** el aviso se emite igual por las capas que quedan, y la falta queda declarada en el dato con su motivo.
- **Dado** un aviso emitido con una capa caída, **cuando** se inspecciona lo que quedó anotado, **entonces** dice qué capa faltó: el error caro es creer que un aviso llegó.
- **Dado** el seguidor de posición que deja de responder, **cuando** ocurre, **entonces** el mapa se queda como estaba y ninguna pantalla lo cuenta como avería del mundo.
- **Dado** el trazado que llega sin la lista de sitios, **cuando** se compone el momento, **entonces** falla, y no calcula la pertenencia con un umbral de distancia.

### Determinismo

Bloqueante (`@determinismo`, RNF-DET-002).

- **Dado** el mismo recorrido simulado dos veces, **cuando** se recorre, **entonces** da la misma secuencia de avisos.
- **Dado** el código que esta fila añade, **cuando** se busca en él, **entonces** no aparece `Math.random` ni `Date.now`.
- **Dado** una salida entera, **cuando** se inspecciona lo que quedó guardado, **entonces** no hay ningún histórico de posiciones.

## Lo que esta fila no respecifica

| Cosa | De quién es | Qué se consume aquí |
| --- | --- | --- |
| El rótulo del sistema y cerrar la salida desde él | fila 30 | que existe, y que es lo único tocable |
| La detección de vehículo y la regla de la duda | fila 31 y SPEC-004 | la clasificación, que llega ya hecha |
| Validar la llegada y la escena que espera | fila 32 | la mitad que decide qué enseña abrir la app |
| El visor y la escena del beat | filas 33 y 34 | el estado del beat en curso, para retener avisos |
| El entintado y las tres tintas | fila 36 | nada: aquí se registra en silencio |
| El motor de pasos y los kilómetros | SPEC-011 | nada visible, y esa es la entrega |
| La cola, los micro-encuentros y el ciclo de dos ofertas | SPEC-019 | las entradas y su retención por beat |
| El camino evitado, su nombre y su motivo | SPEC-008 | el dato; aquí se pinta |
| Los ramales con nombre | SPEC-007 | el nombre, sin el cual no hay oferta de desvío |
| La lámina, la cámara y el norte arriba | SPEC-026 | el pintado entero |
| El registro de la salida abierta | SPEC-028 | abrir, consultar y cerrar |

## UX Design

### Wireframe textual

Cinco pantallas, todas del momento **en marcha**, donde la pantalla está prohibida. Ninguna tiene cabecera, ni pie, ni acción. Todas son variaciones de la misma: **la lámina a sangre, de borde a borde, y un zócalo abajo cuando hay algo que decir**.

**A3P2 · Si miras.** La lámina ocupa la pantalla entera con el norte arriba, encuadrada alrededor de la marca de posición. Sobre ella, del mundo y no de la aplicación: los núcleos con su placa, los parajes con su halo, las calzadas con su filete, y **la marca roja de la posición**, que es del propio mapa. Los sitios a los que la aventura manda están rotulados aunque no se hayan pisado. Al pie, el **zócalo de guía**, dos líneas: en pequeño «Vas por», y en grande «el Camiño do Sal, hacia Monfrida». Nada más: ni botón, ni panel, ni control de zoom, ni escala interactiva.

**A3P3 · Llega una noticia.** La misma pantalla, con dos diferencias: **una marca de aviso** sobre el núcleo alcanzado, y el zócalo sustituido por el de la noticia: «En Monfrida hay algo que contar» y, debajo, en pequeño, «Lo sabrás al llegar». Sigue sin haber nada tocable, y la marca sigue ahí si no se mira.

**A3P4 · Llega una oportunidad.** Lo que se ve es **la pantalla de bloqueo del sistema**, con la notificación entera y su gracia dentro: una línea que nombra el sitio. Debajo, el rótulo persistente de la salida, que es de la fila 30. Al tocar la notificación se abre A3P2 con la marca del encuentro puesta, y nada más.

**A3P5 · El desvío.** La misma lámina, con el **ramal dibujado** saliendo del trazado hacia el paraje, los dos rotulados. El zócalo cambia a la oferta: en pequeño «A mano izquierda», y en grande «Se ve el tejado de O Fuso da Vella. Queda cerca, pero de camino no está». Ni botón de aceptar, ni botón de descartar, ni cifra.

**A3P6 · La Escaleira Vella.** La misma lámina, con el **camino evitado dibujado y rotulado** y el trazado rodeándolo. El zócalo cambia a la declaración: en pequeño «Por qué das esta vuelta», y en grande «A Escaleira Vella corta por arriba, pero son ochenta escalones. El camino largo va por el lado del río». Ninguna palabra de aplicación, ningún icono, ninguna etiqueta.

**A3P7 · La que no vamos a hacer.** No se implementa. Está dibujada para que se vea qué se ha descartado, y lo que esta fila entrega sobre ella es que ninguno de sus elementos —kilómetros, ritmo, pasos, calorías, tiempo, porcentaje de aventura, racha— exista en ningún sitio.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec entrega enteras:
  A3P2  pantalla 2 · artefacto 3 — Si miras
  A3P3  pantalla 3 · artefacto 3 — Llega una noticia
  A3P5  pantalla 5 · artefacto 3 — El desvío
  A3P6  pantalla 6 · artefacto 3 — La Escaleira Vella

Pantalla que esta spec entrega a medias, y la otra mitad es de la fila 30:
  A3P4  pantalla 4 · artefacto 3 — Llega una oportunidad
        (de aquí: el aviso, sus dos capas, su texto y adónde lleva tocarlo;
         de la fila 30: el rótulo persistente que se ve debajo)

Pantalla que NO se implementa, a propósito:
  A3P7  pantalla 7 · artefacto 3 — La que no vamos a hacer

Elementos del proyecto que se usan y no se rediseñan:
  la lámina, la placa de rótulo de núcleo, el halo de rótulo de paraje, el filete de
  las calzadas, la cámara sin rotación (SPEC-021, SPEC-022, SPEC-026).

Elementos nuevos de esta fila:
  la marca de posición — roja, del propio mapa, no un punto de sistema
  la marca de aviso — sobre el sitio alcanzado, y solo ahí
  el zócalo — dos líneas al pie, con cuatro contenidos posibles: guía, noticia,
              oferta de desvío y declaración de camino evitado
  el ramal dibujado saliendo del trazado
  el camino evitado dibujado y rotulado, con el trazado rodeándolo

Elementos que NO se usan, y su ausencia es lo que esta spec protege:
  cualquier control tocable dentro de la app · cualquier cifra de esfuerzo ·
  botones de aceptar o descartar · barra, cabecera, pie o pestañas ·
  cualquier indicación de giro o de metros.
```

### data-testid

El **estado del momento** es `momento-en-marcha`, con la forma canónica que SPEC-020 dejó reservada. El **mapa** es aquí la lámina de SPEC-026, y se conserva su nombre. El identificador que más trabajo hace es `en-marcha-tocables`: existe para poder afirmar que está vacío.

```
- `momento-en-marcha`       — el estado del momento
- `en-marcha`               — la pantalla entera, el ancla de todo flujo
- `en-marcha-elementos`     — los elementos presentes, del vocabulario cerrado
- `en-marcha-tocables`      — la lista de tocables; su contenido tiene que ser vacío

- `mapa-lamina`             — la lámina (declarado por SPEC-026)
- `mapa-camara`             — el encuadre con el que se pinta (declarado por SPEC-026)
- `marca-posicion`          — la marca roja de la posición
- `marca-aviso`             — cada marca de aviso sobre su sitio

- `zocalo`                  — el zócalo, con su clase en un vocabulario cerrado:
                              guia · noticia · desvio · camino-evitado
- `zocalo-antetitulo`       — la línea pequeña
- `zocalo-texto`            — la línea grande

- `aviso-emitido`           — el último aviso emitido, con su tipo y sus capas
- `aviso-capas`             — las capas por las que salió, y las que faltaron

- `sitio-rotulado`          — cada sitio del mapa con rótulo, para poder afirmar que
                              los sitios encargados lo llevan sin haberse pisado
```

Sin más: los nombres de las calzadas, de los núcleos, de los parajes y de los ramales son texto único y se localizan por su contenido. **No se declara ningún identificador para acciones**, y su ausencia en esta lista es deliberada: no hay ninguna que declarar.

### Patrón de interacción

- **Ni un control tocable dentro de la app.** Regla: `design-system.md`, momento «en marcha», y `bucle-jugable.md` momento 2: «cualquier cosa tocable es una razón para sacar el móvil». No es que los controles estén escondidos o desactivados: **no existen**, y la lista de tocables del momento es el sitio donde eso se comprueba. Lo único tocable vive en la pantalla de bloqueo y es del sistema, precisamente por serlo.
- **Acercar y arrastrar siguen siendo gestos, y aquí ni siquiera hacen falta.** Regla: la de SPEC-026, heredada. Se conservan porque quitarlos sería una excepción que habría que explicar, y porque el encuadre alrededor de la marca puede quedarse corto en un mapa grande.
- **El aviso se lee de un vistazo o no se lee.** Regla: `accesibilidad.md` §3. Una línea, con el sitio nombrado, sin «toca para saber más». La prueba, escrita en el propio documento: si tocando se aprende algo que hacía falta, el aviso está mal escrito. Por eso la validación del texto es parte de la entrega y no una recomendación de estilo.
- **Tocar un aviso ubica, nunca acepta.** Regla: `bucle-jugable.md` momento 2; se acepta yendo. Tocar abre el mapa con la marca puesta, y eso es una comodidad, nunca la única manera de enterarse.
- **La notificación está racionada y la noticia no la usa.** Regla: `quests.md` decisión 3; guardarla solo para las oportunidades es lo que hace que cuando salte signifique algo. Un aviso más que encienda la pantalla devalúa todos los demás.
- **El desvío se acepta girando y no con un botón.** Regla: `bucle-jugable.md` §3; poner un botón convertiría una decisión del cuerpo en una decisión de menú, que es justo lo que se quitó de antes de salir. Aquí es donde vive «¿me da hoy el cuerpo?», y en la calle es mejor tensión que en una pantalla.
- **El coste del desvío se dice con la vista y con una frase.** Regla: `bucle-jugable.md` §3 y `design-system.md`, ninguna cifra de distancia. El ramal dibujado hace la mitad del trabajo y la frase la otra mitad; «+800 m» las haría las dos y rompería la regla.
- **El camino evitado se declara con nombre propio y motivo concreto.** Regla: `accesibilidad.md` §2 y su encuadre; ni etiquetas de accesibilidad, ni iconos, ni ninguna palabra que convierta esto en un modo. Se declara porque tú sabes de tu barrio más que OpenStreetMap, y esa decisión es tuya.
- **El zócalo tiene un solo contenido a la vez.** Decisión no cubierta por el sistema de diseño: se resuelve con **prioridad declarada** —camino evitado, desvío, noticia, guía— y no apilando zócalos, porque dos zócalos son dos cosas que leer andando y el momento se diseñó para que leer sea un vistazo. Lo que se desplaza no se pierde: la noticia sigue sedimentada y el desvío sigue ahí para otro día.
- **El mapa no cambia durante la salida.** Regla: `bucle-jugable.md` §1; lo único que se mueve es la marca y las marcas de los avisos. Así mirar no aporta nada nuevo —que es el efecto que busca el momento— y el telón tiene algo que enseñar.
- **Nada del momento habla como aplicación.** Regla: `design-system.md`, los dos registros; dentro del juego, cualquier cosa que solo se pueda decir como aplicación es señal de rediseñar el momento. Por eso una capa de aviso caída se anota en el dato y no se cuenta en pantalla.

## Notas técnicas

### Frontera de inyección

Tres entradas nuevas, las tres con doble en Node:

1. **Seguidor de posición** — entrega posiciones **ya clasificadas** (andando · parada · vehículo · ambiguo), como `partida/ritmo.js` exige desde SPEC-004. Lo que el núcleo recibe es la clasificación y el sitio, nunca una traza cruda que hubiera que guardar. Dobles: un recorrido guionizado, uno que deja de responder, uno que entrega velocidad de vehículo.
2. **Vibrador** — emite la capa de bolsillo. Dobles: uno que registra lo emitido, uno ausente.
3. **Notificador** — emite la capa de pantalla de las oportunidades, y dice si el permiso está concedido. Dobles: uno que registra, uno denegado. **Denegado no es lo mismo que ausente**: lo primero es estado y sigue adelante declarándolo, lo segundo es avería y falla al construir.

El **registro de la salida abierta** (SPEC-028) y la **lámina con su cámara** (SPEC-026) ya entraron y aquí solo se cablean.

### Lo que el núcleo gana

- **La composición del momento en marcha** — dado el estado de la salida, el mundo y la posición clasificada, devuelve los elementos presentes, la clase y el texto del zócalo, las marcas, y **la lista de tocables**, que por contrato sale vacía. Es lo que convierte las ausencias de esta fila en criterios.
- **El catálogo de avisos** — enumerado cerrado de tipos, cada uno con sus capas declaradas y su regla de emisión, más la validación del texto (una línea, nombra sitio, sin llamada a tocar). La regla de mantenimiento de `accesibilidad.md` §3 —«cada vez que se añada una forma nueva de avisar hay que volver aquí»— se cumple sola, porque un tipo nuevo sin capas declaradas no compila el catálogo.
- **La oferta del desvío** — dado el trazado y los parajes fuera del lazo, devuelve el ramal por su nombre, el paraje por el suyo y la frase, sin ninguna cifra. Exige el nombre del ramal y falla sin él, que es la deuda que `accesibilidad.md` §2 dejó y que SPEC-007 ya cerró.
- **La puerta de entrada** — dado el estado, dice qué enseñar al abrir la app: el mapa si se anda, la escena si se está parada dentro de un geofence. Una sola función, para que el aviso, el rótulo y el icono no puedan divergir.

### Lo que no existe, y es la entrega

`bucle-jugable.md` §9 dice que el juego no lleva la cuenta del trazado. En código eso significa que **no hay ninguna función que compare lo andado con el trazado y ninguna que recalcule una ruta durante la salida**, y que el estado de la salida en marcha no tiene campo donde guardarlo. El criterio se escribe sobre el esquema del estado y sobre la ausencia de esas dos capacidades, no sobre una pantalla: es la única forma de que «no hay reproche» siga siendo cierto el día que alguien añada un panel.

### El rastro que no se guarda

Este es el momento del juego en que más posiciones pasan por la mano del código, así que conviene decir qué sobrevive: **nada**. La posición se usa para pintar la marca, para validar geofences y para alimentar la medida del ritmo, y ninguna de las tres la guarda. Es RF-PRIV-002, y el criterio está escrito en «Determinismo» porque es donde se puede comprobar sobre la partida entera.

## Decisiones asumidas

- **Esta fila entrega también A3P3 y A3P6, además de A3P2, A3P4 y A3P5** → asumido (alternativa: dejarlas para las filas de rumores y de accesibilidad). Regla: A3P3 es la mitad de pantalla del par de capas de una noticia (RF-BUCLE-004, que es de esta fila) y no tiene sentido sin ella; A3P6 es la mitad de pantalla de la declaración de SPEC-008, cuyo dato existe desde B1 y no lo pinta nadie. Las dos son el mismo zócalo con otro contenido, así que separarlas habría partido un elemento en tres filas.
- **La composición del momento y la lista de tocables son datos del núcleo** → asumido (alternativa: montar la pantalla en `app/` y comprobar las ausencias mirando). Regla: §6o; sin simulador, «ni un control tocable» comprobado a ojo es un criterio que nunca se pone rojo, y este es el criterio más importante del momento.
- **El zócalo tiene un solo contenido y la prioridad es camino evitado › desvío › noticia › guía** → asumido (alternativa: apilar, o dejar que gane el último). Regla: `accesibilidad.md` §3, el aviso se lee de un vistazo; y el orden sale de qué caduca antes —el camino evitado y el desvío ocurren en un punto concreto del camino y la guía está siempre—. Nada se pierde al desplazarse.
- **La noticia no enciende la pantalla y por tanto no usa el canal de notificación ni siquiera silenciosa** → asumido (alternativa: notificación silenciosa, que no enciende pero deja constancia). Regla: `quests.md` decisión 3, la reserva es del canal y no del encendido; una notificación silenciosa aparece igual en el centro de notificaciones y devalúa la reserva por la puerta de atrás.
- **Un permiso de notificación denegado no bloquea la oportunidad: se emite por las capas que quedan y se declara en el dato** → asumido (alternativa: no emitirla, o promoverla a otro canal). Regla: `accesibilidad.md` §3, «el error caro es creer que un aviso llegó»; no emitirla castiga a quien denegó un permiso, y promoverla inventaría un par que el documento no autoriza. Declararlo en el dato es lo que permite medir cuánto se pierde.
- **La retención por beat en curso se aplica a los dos tipos de aviso, no solo a las oportunidades** → asumido (alternativa: retener solo las oportunidades, que son las que interrumpen). Regla: `quests.md` decisión 3 dice «si estás dentro de una escena, el mundo espera», sin distinguir; y un háptico a mitad de escena es exactamente igual de intruso que una notificación.
- **La guía se compone con el nombre de la calzada por la que se va y el sitio hacia el que se va, y no cambia hasta cambiar de calzada** → asumido (alternativa: actualizarla en cada tramo, o nombrar el beat siguiente). Regla: `quests.md` decisión 2, el guiado usa el lenguaje del mundo; y `bucle-jugable.md` §1, el mapa no cambia durante la salida —una guía que se reescribe sola es un mapa que cambia y una razón para mirar.
- **Los sitios a los que manda la aventura se rotulan por estar en el lazo aceptado, no por un nivel de conocimiento que esta fila calcule** → asumido (alternativa: subir su nivel de conocimiento al aceptar). Regla: `bucle-jugable.md` §1, «un sitio al que te mandan tiene nombre aunque no hayas ido» porque te lo contaron; los cuatro niveles y su entintado son de la fila 36, y calcularlos aquí duplicaría la regla en dos sitios.
- **Acercar y arrastrar se conservan en marcha** → asumido (alternativa: fijar el encuadre y no admitir ningún gesto, que sería la lectura más dura de «nada tocable»). Regla: un gesto no es un control —no hay nada que tocar, no hay nada que pulsar por error, y no hay nada que se pueda aceptar— y quitarlos crearía una excepción respecto a SPEC-026 que habría que explicar dentro del juego.
- **El seguidor de posición entrega la clasificación ya hecha y el núcleo no la calcula** → asumido (alternativa: pasar velocidad y que el núcleo clasifique). Regla: SPEC-004 ya fijó esa frontera —«la traza llega ya clasificada»— y la detección de vehículo es de la fila 31; moverla aquí la partiría en dos.
- **No se declara ningún `data-testid` de acción** → asumido (alternativa: declarar los que haya por si acaso). Regla: `design-system.md`, en marcha no hay controles; declarar identificadores de acción sería dejar puesto el sitio donde meterlos, y la ausencia de la lista es en sí misma parte del contrato.
