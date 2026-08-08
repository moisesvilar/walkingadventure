# SPEC-018 — El contrato con el LLM: el árbitro es el código y el narrador es el modelo

## Descripción

Todo lo que decide algo en este juego lo decide el código —el casting, el geofence, la máquina de beats, la propagación de rumores, el oro— y todo lo que solo se lee lo puede escribir un modelo de lenguaje. Esta spec entrega la frontera entre las dos cosas, y la entrega como código verificable en lugar de como una intención: un **esquema cerrado** de campos inertes, un **filtro de aptitud** por el que pasa todo texto generado, un **prompt del que se excluye todo dato real**, **dos puntos de invocación y no más**, y un **fallback de plantilla** que no es el camino de excepción sino el camino normal.

La regla que lo ordena todo cabe en una línea de `game-design/quests.md`: **si alguna regla bifurca por él, no lo escribe el modelo**. El modelo produce título, gancho, diálogos, descripciones, textos de rumor y el envoltorio del zurrón; nunca lugares, disparadores, resultados, oro, niveles, signos, franjas ni geofences. Lo que llegue fuera del esquema se descarta sin interpretarse, y lo que llegue dentro pero no pase la validación cae al texto de la plantilla, que siempre existe.

Y tiene una mitad que no es de narrativa sino de privacidad, y es la que la hace bloqueante: **del móvil salen exactamente dos cosas** —las coordenadas al generar cada mapa, una vez, y estos prompts— y el anclaje real no entra en ninguna llamada de red. Eso obliga a que el prompt sea **construible y auditable sin red**: sobre el prompt ya construido se tiene que poder afirmar que no contiene el nombre real del anclaje, ni una coordenada, ni un identificador de OSM o de Places, ni nada que la jugadora haya tecleado. El coste está asumido y escrito en `seguridad-privacidad.md` §1: el chiste central del juego —que O Torreón Esquecido es el chiringuito de Manolo— deja de estar al alcance del modelo y tiene que salir de plantilla o del código, que es donde vive el dato real.

No tiene interfaz de usuario. Las pantallas donde esto se ve son de otras filas: la lista de hoy y la preparación (**A2P3**, fila 28), el zurrón (**A2P2**, filas 28 y 42), la escena de un beat (fila 34) y el diario (fila 37). Aquí se entrega el texto que todas ellas pintan, y la garantía de que ninguna se queda sin él.

Anclas: **RF-QUEST-006**, **RF-QUEST-007**, **RF-QUEST-008** (`docs/prd.md` §4.2), **RF-LANG-005** (§4.12) y **RF-PRIV-001** (§4.11), con **RNF-DET-002** (§5.1) y **RNF-RED-001** (§5.3) como invariantes. Las fuentes que mandan sobre el PRD son `game-design/quests.md` **decisión 1** (la frontera árbitro/narrador, los nombres como suelo determinista, los dos puntos de invocación y el registro de tópicos), `game-design/seguridad-privacidad.md` **§1** (el prompt sin datos reales) y `game-design/lenguaje.md` entero (las reglas de escritura y el pendiente de la lista de masculino genérico). **RNF-DET-003** aplica como siempre: los escenarios `@determinismo` y `@privacidad` de esta fila son bloqueantes.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la hay, y es la más delicada del proyecto**: la llamada de red se inyecta, el núcleo no llama a nadie. Está descrito en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el **catálogo de 20-30 plantillas** con sus textos de fallback, su tono y su declaración de rumor (fila 17, RF-QUEST-009), que esta spec **consume** y no escribe; el **proxy ciego**, su atestación, su caché y su ausencia de identificadores (fila 23, RF-INFRA-002 y RNF-PRIV-001); las **ilustraciones y las fotos de Places** (fila 25, RF-MUNDO-016), de las que aquí solo se reutiliza el mecanismo de esquema cerrado; **cuándo se ofrecen las aventuras y cuándo se preparan** (fila 28), que es quien decide el momento de la primera llamada; **la pantalla del zurrón y el modo de pasos de fondo** (filas 28 y 42), de los que aquí solo se especifica el contrato de su única llamada agrupada; la **redacción concreta** de ningún texto de fallback, que es de la fila 17; el **casting** y todo lo que fija (fila 10, consumido ya resuelto); la **propagación**, el nivel y el signo (fila 12, consumidos ya resueltos); y **el formato del documento y del estado** (filas 9 y 16), cuyos huecos de texto se rellenan sin renegociar nada.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El esquema cerrado», «El filtro de aptitud», «Los nombres» y «Los dos puntos de invocación»; la **validación de entradas** en el campo desconocido, el dato vivo, el punto de invocación que no existe, el locale desconocido, el hueco sin fallback y el sobre de petición con un campo real; el **estado vacío** en la petición sin ningún hueco que redactar, la reserva vacía, el registro de tópicos recién creado y el mundo sin ningún texto del narrador; el **estado de error** en el proxy que falla, el presupuesto de espera agotado, la respuesta que no es un documento legible y el texto vacío; y los **casos límite** en el texto exactamente en el tope de longitud, el mismo hueco pedido dos veces, el nombre propuesto que choca, la ventana de tópicos exactamente llena y el texto que pasa el filtro pero arrastra un dato real.

Convenciones que se heredan y no se redefinen: **«hueco»** es lo que SPEC-009 llama un texto del documento —clave, texto y origen `llm` o `plantilla`—; **«área de textos»** es la de SPEC-016, dentro del estado; **«aventura casteada»**, **«beat»**, **«motivo»** y **«tamaño»** son los de SPEC-010; **«nivel»**, **«signo»** y **«hechos»** son los de SPEC-012; **«paso»** y **«reserva»** son los de SPEC-011.

### El esquema cerrado, y lo que llega fuera de él

- **Dado** la respuesta del narrador, **cuando** se valida, **entonces** se valida contra un esquema cerrado y enumerable de campos inertes, declarado en un solo sitio.
- **Dado** una respuesta con un campo que el esquema no declara, **cuando** se valida, **entonces** el campo se descarta y el resto de la respuesta se adopta igual.
- **Dado** ese mismo campo descartado, **cuando** se busca algún sitio donde se haya leído su valor, **entonces** no existe: se descarta sin interpretarse.
- **Dado** ese mismo campo descartado, **cuando** se mira lo que ve la jugadora, **entonces** no se registra ningún error visible para ella.
- **Dado** ese mismo campo descartado, **cuando** se lee el diagnóstico de la llamada, **entonces** consta el descarte con su clave y su motivo del catálogo cerrado.
- **Dado** el catálogo de campos inertes, **cuando** se enumera, **entonces** cubre el título, el gancho, el texto de una escena, el texto de una versión de rumor, el envoltorio del zurrón y el nombre propuesto, y ninguno más.
- **Dado** una respuesta que incluye un campo `oro` con valor 500, **cuando** se aplica a la aventura, **entonces** el oro de la aventura es el que fijó la plantilla y el campo del modelo se descarta.
- **Dado** una respuesta que incluye un lugar, un disparador, un resultado, una franja, un geofence, un nivel o un signo, **cuando** se valida, **entonces** cada uno se descarta por ser dato vivo y ninguno llega a la aventura.
- **Dado** el catálogo de campos inertes y la lista de datos vivos de `quests.md` decisión 1, **cuando** se cruzan, **entonces** su intersección está vacía.
- **Dado** una respuesta que no es un documento legible, **cuando** se valida, **entonces** se rechaza entera con su motivo y todos sus huecos caen al fallback.
- **Dado** una respuesta con un texto vacío o solo con espacios, **cuando** se valida, **entonces** ese hueco cae al fallback con motivo propio.
- **Dado** una respuesta válida, **cuando** se adopta, **entonces** cada texto adoptado se guarda con su origen `llm` declarado, y cada hueco que cayó, con origen `plantilla`.

### El fallback es el camino normal, no el de excepción

- **Dado** un mundo y una aventura aceptada, **cuando** no hay conexión en ningún momento, **entonces** todos los textos salen de plantilla y la aventura se puede completar de principio a fin.
- **Dado** una aventura sin ninguna llamada al narrador, **cuando** se recorre entera, **entonces** ningún hueco queda sin texto.
- **Dado** una plantilla del catálogo, **cuando** se comprueba, **entonces** declara un texto de fallback para cada hueco que puede pedirle al narrador, y sin uno de ellos la plantilla se rechaza al cargarse el catálogo.
- **Dado** la llamada al narrador que falla, **cuando** se mira lo que llega a las pantallas, **entonces** ningún texto menciona la red, la aplicación, un permiso ni una espera.
- **Dado** la llamada al narrador que falla, **cuando** se lee el diagnóstico, **entonces** consta el fallo con su motivo del catálogo cerrado: silencio hacia la jugadora, constancia en el dato.
- **Dado** el presupuesto de espera agotado, **cuando** se resuelve la llamada, **entonces** todos los huecos caen al fallback con el motivo de espera agotada.
- **Dado** el módulo sin presupuesto de espera declarado, **cuando** se pide una redacción, **entonces** falla nombrando la dependencia que falta, en vez de esperar sin límite.
- **Dado** una llamada que cae al fallback y otra que no, **cuando** se comparan las dos aventuras, **entonces** solo difieren en los textos y en el origen declarado de cada uno.
- **Dado** un mundo entero sin ningún texto del narrador, **cuando** se congela y se levanta, **entonces** está completo y jugable, y cada hueco declara que está vacío.

### El filtro de aptitud sobre todo texto generado

- **Dado** cualquier texto que produzca el narrador, **cuando** se va a adoptar, **entonces** pasa antes por el filtro de aptitud, sin excepción por tipo de hueco ni por punto de invocación.
- **Dado** un texto con contenido no apto para menores, **cuando** se valida, **entonces** se usa el texto de plantilla y la aventura funciona igual.
- **Dado** un texto que manda a consumir en el anclaje real, **cuando** se valida, **entonces** no pasa el filtro.
- **Dado** un texto con una fórmula de la lista de masculino genérico evitable, **cuando** se valida, **entonces** no pasa el filtro y se nombra la fórmula que lo tumbó.
- **Dado** un texto con una terminación en `-e` o en `-x` usada como género, **cuando** se valida, **entonces** no pasa el filtro.
- **Dado** un texto con una cifra de distancia, de tiempo de esfuerzo, de ritmo o de progreso, **cuando** se valida, **entonces** no pasa el filtro, porque ninguna pantalla las lleva.
- **Dado** un texto que menciona la aplicación, la red, un permiso o una carga, **cuando** se valida dentro del juego, **entonces** no pasa el filtro: dentro del juego solo habla el mundo.
- **Dado** un texto que pasa todas las listas pero contiene el nombre real de un anclaje del mundo congelado, **cuando** se valida, **entonces** no pasa el filtro y se nombra el anclaje.
- **Dado** un texto exactamente en el tope de longitud de su hueco, **cuando** se valida, **entonces** pasa, y uno de un carácter más cae al fallback.
- **Dado** el filtro, **cuando** se le pide el motivo de un rechazo, **entonces** su clave pertenece a un catálogo cerrado y enumerable y no es una frase redactada.
- **Dado** un rechazo cuya causa no está en ese catálogo, **cuando** se va a entregar, **entonces** la validación falla nombrando la causa desconocida, en vez de devolver una clave genérica.
- **Dado** los rechazos de muchas llamadas, **cuando** se agregan por clave, **entonces** el recuento sale sin parsear ninguna frase.
- **Dado** las listas del filtro, **cuando** se lee de dónde salen, **entonces** llegan inyectadas por locale y ninguna está escrita a mano dentro de la comprobación.
- **Dado** el filtro sin listas para el locale del mundo, **cuando** se pide una validación, **entonces** falla nombrando el locale, en vez de dar por apto lo que no ha podido comprobar.
- **Dado** el mismo texto y las mismas listas, **cuando** se valida dos veces, **entonces** el resultado y el motivo son idénticos.
- **Dado** el filtro, **cuando** se inspeccionan sus imports, **entonces** ninguno habla con la red ni con el reloj.

### Los nombres: suelo determinista, capa opcional

- **Dado** cualquier elemento con nombre propio, **cuando** nace, **entonces** su nombre lo produce primero el paquete de idioma, y existe sin ninguna llamada de red.
- **Dado** un mundo con un paraje llamado «O Fuso da Vella», **cuando** el narrador propone ese mismo nombre para otro elemento, **entonces** se descarta por chocar con el índice global de nombres y el elemento conserva el nombre del paquete de idioma.
- **Dado** un nombre propuesto que supera la longitud permitida, **cuando** se valida, **entonces** se descarta y se conserva el base.
- **Dado** un nombre propuesto con cifras, con signos de puntuación no permitidos o con caracteres ajenos al locale, **cuando** se valida, **entonces** se descarta y se conserva el base.
- **Dado** un nombre propuesto que no pasa el filtro de aptitud, **cuando** se valida, **entonces** se descarta y se conserva el base.
- **Dado** un nombre propuesto que coincide con el nombre real de un anclaje del mundo, **cuando** se valida, **entonces** se descarta y se conserva el base.
- **Dado** un nombre propuesto que pasa las cuatro validaciones, **cuando** se adopta, **entonces** queda reservado en el índice global y ningún otro elemento puede tomarlo después.
- **Dado** un nombre adoptado, **cuando** se lee su origen, **entonces** consta que vino del narrador, y el nombre base sigue disponible como el que había.
- **Dado** un mundo generado sin ninguna llamada al narrador, **cuando** se recogen los nombres de núcleos, servicios, parajes y calzadas, **entonces** no hay ninguno repetido.
- **Dado** el mismo mundo generado con el narrador disponible y sin él, **cuando** se comparan, **entonces** el conjunto de elementos y su reparto son idénticos y solo pueden diferir los nombres adoptados.
- **Dado** la capa de nombres propuestos, **cuando** se lee a qué se aplica por defecto, **entonces** es a los elementos que nacen dentro de una aventura, y extenderla a las entidades del mundo es un parámetro apagado de origen.
- **Dado** el prompt de una propuesta de nombre, **cuando** se lee, **entonces** lleva el locale y ejemplos del propio paquete de idioma como anclaje de estilo, y ninguna instrucción de validar el idioma.

### Los dos puntos de invocación, y ni uno más

- **Dado** el módulo del narrador, **cuando** se enumeran sus puntos de invocación, **entonces** son exactamente dos: al crear la aventura y al abrir la salida para el zurrón.
- **Dado** un punto de invocación que no está en esos dos, **cuando** se pide una redacción, **entonces** falla nombrando el punto recibido y enumerando los dos válidos.
- **Dado** una salida en marcha, **cuando** se pide una redacción desde cualquier punto, **entonces** falla nombrando el momento, y no se registra ninguna llamada saliente.
- **Dado** el módulo sin el momento de la salida entre sus entradas, **cuando** se pide una redacción, **entonces** falla nombrando la dependencia que falta.
- **Dado** una aventura recién creada, **cuando** se redacta su narrativa, **entonces** todos sus huecos se piden en una sola llamada.
- **Dado** una reserva con cinco pasos por narrar, **cuando** se abre la salida, **entonces** el envoltorio del zurrón y los textos de sus entradas se piden en una sola llamada agrupada.
- **Dado** una reserva vacía, **cuando** se abre la salida, **entonces** no se hace ninguna llamada y no es un error.
- **Dado** el modo de pasos de fondo apagado, **cuando** se abre la salida, **entonces** no se hace ninguna llamada del zurrón.
- **Dado** una salida entera caminada, **cuando** se inspecciona el tráfico saliente, **entonces** no hay ninguna llamada al narrador entre el arranque de la salida y el telón.
- **Dado** el envoltorio del zurrón que no se pudo redactar, **cuando** se lee el resumen, **entonces** cada entrada trae el texto de la plantilla que la generó y el resumen se lee igual.

### El prompt no lleva ningún dato real

- **Dado** una aventura anclada al bar «Casa Manuela», **cuando** se genera su narrativa, **entonces** el prompt no contiene «Casa Manuela».
- **Dado** ese mismo prompt, **cuando** se recorre entero, **entonces** no contiene ninguna coordenada, ninguna dirección ni ningún identificador de OSM o de Places.
- **Dado** ese mismo prompt, **cuando** se recorre entero, **entonces** no contiene la semilla del mapa ni nada que la jugadora haya tecleado.
- **Dado** el sobre de la petición, **cuando** se valida, **entonces** sus campos pertenecen a una lista blanca cerrada y enumerable, y un campo fuera de ella la hace fallar nombrándolo.
- **Dado** un sobre de petición al que se le añade el nombre real de un anclaje en un campo cualquiera, **cuando** se valida, **entonces** falla nombrando el campo, antes de construir ningún prompt.
- **Dado** el prompt ya construido y el mundo congelado del que salió, **cuando** se criba el prompt contra los datos reales de ese mundo, **entonces** no aparece ninguno, y si apareciera, la construcción falla nombrando el dato y el campo por el que entró.
- **Dado** un nombre de fantasía que por casualidad coincide con el nombre real de su anclaje, **cuando** se criba el prompt, **entonces** la construcción falla, porque el cribado no distingue por qué coincide.
- **Dado** la construcción del prompt, **cuando** se ejecuta, **entonces** no hace ninguna llamada de red y su resultado se puede afirmar entero sin conexión.
- **Dado** el prompt de una aventura, **cuando** se lee lo que sí lleva, **entonces** son el locale, el tono, las reglas de lenguaje, los nombres de fantasía, los tipos abstractos, la escena, y para un rumor su signo y su nivel.
- **Dado** el prompt de una versión de un rumor, **cuando** se lee, **entonces** lleva el signo y el nivel como restricción explícita, y no le pide al modelo que los decida.
- **Dado** el prompt de un rumor de signo bueno, **cuando** el modelo devuelve una versión de signo contrario, **entonces** el texto se descarta y el signo de la aventura no cambia, porque el signo es dato vivo.
- **Dado** una jugadora que juega treinta días, **cuando** se inspecciona todo el tráfico saliente, **entonces** las coordenadas aparecen solo en la generación de cada mapa y en ninguna llamada al narrador.
- **Dado** el paquete del núcleo, **cuando** se inspeccionan sus imports, **entonces** ninguno abre una conexión: la llamada llega inyectada.

### El registro de tópicos, como restricción negativa

- **Dado** una partida, **cuando** se lee su registro de tópicos, **entonces** existe uno por semilla de mundo y no uno global.
- **Dado** un registro de tópicos, **cuando** se enumeran sus categorías, **entonces** son aperturas, imágenes, giros, oficios y objetos, y forman un catálogo cerrado.
- **Dado** un registro recién creado, **cuando** se lee, **entonces** ya trae la lista negra de tics genéricos precargada, y no está vacío.
- **Dado** un prompt, **cuando** se construye, **entonces** el registro viaja dentro como restricción negativa y nunca como ejemplo a imitar.
- **Dado** una categoría con la ventana llena, **cuando** entra un tópico nuevo, **entonces** sale el más antiguo y la ventana conserva su tamaño.
- **Dado** una categoría exactamente en el tamaño de la ventana, **cuando** se lee, **entonces** cabe entera en el prompt y no se recorta a mitad de una entrada.
- **Dado** un texto que se descarta por el filtro, **cuando** se mira el registro, **entonces** sus tópicos no se han anotado: solo se anota lo adoptado.
- **Dado** un texto adoptado, **cuando** se anota, **entonces** sus tópicos entran en su categoría y el orden dentro de la ventana es el de anotación, declarado y no dependiente de ninguna estructura.
- **Dado** el registro de tópicos, **cuando** se busca alguna regla que bifurque por él fuera de la construcción del prompt, **entonces** no existe.
- **Dado** una partida sin ninguna llamada al narrador, **cuando** se lee su registro, **entonces** sigue siendo el inicial y nada se ha anotado.
- **Dado** los textos de fallback, **cuando** se repiten entre mundos, **entonces** el registro no lo evita, y esa limitación queda declarada en lugar de disimularse.

### Generación única, cacheada y guardada con la partida

- **Dado** un hueco ya redactado y validado, **cuando** se vuelve a pedir, **entonces** se devuelve el texto guardado y no se hace ninguna llamada.
- **Dado** la clave de un hueco, **cuando** se calcula, **entonces** sale del mapa, del punto de invocación y de la identidad del elemento, y es la misma en dos ejecuciones.
- **Dado** dos huecos distintos que piden el mismo texto, **cuando** se guardan, **entonces** el texto vive una sola vez en el área de textos y las dos entradas lo citan por su clave.
- **Dado** un texto adoptado, **cuando** se guarda la partida, **entonces** viaja con ella, y al volver a abrirla se lee el mismo texto sin ninguna llamada.
- **Dado** una aventura ya vestida, **cuando** se vuelve a abrir la partida, **entonces** ningún texto se regenera al vuelo.
- **Dado** un texto guardado con origen `plantilla`, **cuando** más tarde hay conexión, **entonces** no se sustituye por uno del narrador dentro de la misma aventura.
- **Dado** el área de textos del estado, **cuando** se escribe en ella, **entonces** se usa la que SPEC-016 declara, con sus mismas tres partes —clave, texto y origen— y sin añadirle ninguna.

### La estructura no cambia con o sin narrador

- **Dado** un mundo sembrado con `"42.40,-8.81#1"`, **cuando** se genera una aventura con el narrador disponible y la misma aventura sin red, **entonces** las dos tienen el mismo casting, los mismos beats en el mismo orden, las mismas cantidades de oro y los mismos objetos, y el mismo lazo, y solo difieren los textos.
- **Dado** una aventura casteada y dos respuestas distintas del narrador, **cuando** se aplica cada una, **entonces** las dos aventuras resultantes son idénticas en todo lo que no es texto.
- **Dado** la operación que viste una aventura, **cuando** se inspecciona, **entonces** solo escribe referencias a textos y no toca ningún otro campo.
- **Dado** una aventura vestida, **cuando** se enumeran los datos por los que alguna regla bifurca, **entonces** ninguno tiene origen `llm`.
- **Dado** el módulo del narrador, **cuando** se inspecciona, **entonces** no genera mundo, no castea, no propaga y no resiembra nada.
- **Dado** una partida entera jugada sin red y la misma jugada con el narrador, **cuando** se comparan sus registros de hechos, **entonces** son idénticos salvo en las referencias a textos.

### Entradas inválidas, estado vacío y errores

- **Dado** una petición sin ningún hueco que redactar, **cuando** se pide una redacción, **entonces** no se hace ninguna llamada y se devuelve una lista vacía, que no es un error.
- **Dado** una petición con un locale que ningún paquete de idioma cubre, **cuando** se valida, **entonces** falla nombrando el locale y enumerando los disponibles.
- **Dado** una petición con un tipo de hueco que el catálogo no declara, **cuando** se valida, **entonces** falla nombrando el tipo recibido y enumerando los válidos.
- **Dado** una petición con un hueco sin texto de fallback, **cuando** se valida, **entonces** falla nombrando el hueco, antes de llamar a nadie.
- **Dado** la llamada de red que lanza un error, **cuando** se resuelve la redacción, **entonces** todos los huecos caen al fallback con el motivo del catálogo y el error no se propaga a la pantalla.
- **Dado** el módulo sin la llamada de red inyectada, **cuando** se pide una redacción, **entonces** todos los huecos caen al fallback y no se intenta ninguna conexión.
- **Dado** una respuesta que trae más huecos de los que se pidieron, **cuando** se valida, **entonces** los que nadie pidió se descartan sin interpretarse.
- **Dado** una respuesta que trae menos huecos de los que se pidieron, **cuando** se valida, **entonces** los que faltan caen al fallback y los que llegaron se adoptan.
- **Dado** un catálogo de plantillas vacío, **cuando** se pide una redacción, **entonces** no hay ningún hueco y no es un error.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/quests/narrador.js` | los dos puntos de invocación, el esquema cerrado de la respuesta, el catálogo de motivos de descarte, la caída al fallback y la vestidura sobre lo ya casteado |
| `packages/nucleo/quests/prompt.js` | el sobre de la petición con su lista blanca, la construcción del prompt y el cribado final contra los datos reales del mundo congelado |
| `packages/nucleo/names/aptitud-de-texto.js` | el filtro de aptitud por locale: las listas inyectadas, las comprobaciones estructurales y el catálogo cerrado de motivos |
| `packages/nucleo/names/propuesta.js` | la adopción condicionada de un nombre propuesto contra el índice global, con su origen declarado |
| `packages/nucleo/partida/topicos.js` | el registro de tópicos por semilla de mundo, con sus cinco categorías, su ventana y su lista negra precargada |

Las áreas del paquete están fijadas desde SPEC-002 —`core`, `world`, `names`, `quests`, `partida`— y esta entrega **no abre ninguna nueva**. El filtro y la propuesta viven en `names/` porque sus listas son por locale y `names/` es donde vive el paquete de idioma; el contrato y el prompt, en `quests/`, porque el narrador viste aventuras; y el registro de tópicos, en `partida/`, porque es estado de la jugadora sobre un mundo congelado y no parte del mundo.

El fichero se llama `aptitud-de-texto.js` y no `aptitud.js` **a propósito**: `packages/nucleo/world/aptitud.js` ya existe y es otra cosa —escalones, firme, bordillos y paso de un tramo del viario—. Dos módulos con el mismo nombre corto y significados distintos es una confusión barata de evitar aquí y cara de deshacer luego.

El **área de textos** del estado, que SPEC-016 declara en `partida/diario.js` con sus tres partes (`clave`, `texto`, `origen`), **se consume tal cual y no se duplica**. Esta spec es la que la llena; no la redefine ni le añade campos.

### Frontera de inyección: la llamada de red, y nada más

Esta spec toca la frontera del núcleo en un solo sitio, y es el más delicado del proyecto: **el núcleo no llama a nadie**. Lo que entra:

- **La llamada al proxy**, como una dependencia con una firma que recibe un prompt ya construido y devuelve un documento. Sin ella, todos los huecos caen al fallback sin intentar ninguna conexión, que es el estado normal en `node --test`.
- **El presupuesto de espera**. No se inventa aquí un número: llega declarado y su ausencia hace fallar la llamada. Un presupuesto por defecto escondido en el núcleo es exactamente la clase de valor que nadie revisa y que decide la experiencia de la pantalla de preparación, que es de la fila 28.
- **Las listas del filtro por locale** —léxico no apto, fórmulas de masculino genérico evitable y morfología inventada—, con el valor por defecto que se describe abajo.
- **El momento de la salida** (antes de salir · en marcha · al parar · telón), de la fila 29, para que «nunca en marcha» sea una comprobación y no una convención.
- **El mundo congelado** de SPEC-009, del que sale la lista de datos reales contra la que se criba el prompt.
- **El catálogo de plantillas** con sus textos de fallback, de la fila 17. Mientras no exista, sirven las seis plantillas ya portadas en `packages/nucleo/quests/templates.js`, exactamente como hicieron SPEC-010 y SPEC-012.
- **El índice global de nombres** del mundo, de `packages/nucleo/names/index.js`, para resolver la unicidad de un nombre propuesto.

Hacia fuera entrega tres cosas y solo tres: **los textos adoptados con su origen**, el **diagnóstico de la llamada** —qué se descartó y por qué, en claves agregables— y el **registro de tópicos actualizado**. No entrega ni una decisión.

### El sobre de la petición: lista blanca, no lista negra

La garantía de privacidad no se monta buscando lo prohibido en un texto libre, porque eso solo encuentra lo que se le ocurrió a quien escribió la búsqueda. Se monta al revés: **el sobre de la petición es un objeto con una lista blanca cerrada de campos**, y lo que no está declarado no puede entrar. Lo que viaja:

| Campo | Por qué es seguro |
| --- | --- |
| locale | `es` o `gl`, dos valores |
| tono y reglas de lenguaje | constantes del juego, iguales para todo el mundo |
| punto de invocación | uno de dos |
| tipos abstractos | `taberna`, `paraje/guarida`, `calzada` — vocabulario del juego, no de OSM |
| nombres de fantasía | los produce el paquete de idioma desde la semilla |
| escena, disparador y tamaño | los fijó el casting; viajan como restricción, no como pregunta |
| signo y nivel de un rumor | los fijó el código; viajan como restricción explícita |
| hechos estructurados | los ejes cerrados de SPEC-012, sin prosa |
| huecos a redactar | clave, tipo y tope de longitud |
| registro de tópicos | restricción negativa |

Y lo que **nunca** entra, ni en un campo ni dentro de otro: el nombre real del anclaje, su `place_id`, su identificador de OSM, cualquier coordenada o dirección, la semilla del mapa, el nombre del personaje —que **lo teclea la jugadora** y por tanto puede ser cualquier cosa—, los kilómetros, la hora, la fecha y por dónde ha estado.

Sobre el mote conviene ser explícito, porque es el caso que parece contradecir la regla y no la contradice: **el mote sí puede viajar** porque lo produce el código desde la semilla (`packages/nucleo/partida/motes.js`), y **el nombre del personaje no** porque lo escribe una persona. La línea no es «lo que suena a fantasía», es **lo que produjo el código**.

### El cribado final, y por qué existiendo la lista blanca

La lista blanca impide que un dato real entre por su campo. No impide que entre **dentro** de un campo permitido, que es el fallo realista: un nombre de fantasía que por casualidad coincide con el real, o una plantilla que interpola donde no debe. Por eso hay una segunda comprobación, y es barata porque el mundo congelado está en el móvil: **con el prompt ya construido y la lista de datos reales de ese mundo delante, se criba, y una coincidencia hace fallar la construcción nombrando el dato y el campo por el que entró**.

Es deliberadamente estricto y produce un falso positivo posible —el nombre de fantasía que coincide con el real— que se resuelve fallando, no dejando pasar. Fallar ahí manda al fallback una frase; dejar pasar manda el nombre del bar de alguien a un modelo.

Este es el criterio que hace que la afirmación de privacidad **se pueda poner roja** (§6o de `pipeline/decisiones-orquestador.md`): sin el cribado, «el prompt no contiene el nombre real» se cumple casi siempre por construcción y no mide nada; con él, hay un caso concreto que lo pone rojo.

### El filtro de aptitud: lo que comprueba, y qué se declara pendiente

El filtro corre sobre **todo** texto generado —títulos, ganchos, escenas, versiones de rumor, el envoltorio del zurrón y los nombres propuestos— y comprueba seis cosas: las tres listas por locale (léxico no apto para menores, fórmulas de masculino genérico evitable, morfología inventada en `-e` y `-x`), el tope de longitud del hueco, las cifras prohibidas por el sistema de diseño (distancia, tiempo de esfuerzo, ritmo, progreso) y las palabras de la voz de aplicación dentro del juego (la red, un permiso, una carga). Y encima, el cribado contra los datos reales, por si un nombre real llegara de vuelta en la respuesta.

**Las listas se inyectan y no se escriben dentro de la comprobación.** El motivo es que `game-design/lenguaje.md` deja abierto su pendiente 2 —«qué fórmulas entran y cuáles son falsos positivos»— y una spec de código no cierra un pendiente de diseño. Lo que sí se entrega es un **valor por defecto justificado**, para que la fila no dependa de una decisión que puede tardar:

- Las entradas de masculino genérico son **fórmulas de varias palabras**, nunca palabras sueltas. Es la única manera de que «el tabernero gruñón» —un hombre concreto, que `lenguaje.md` protege expresamente— no dispare el filtro mientras «todos los vecinos» sí lo hace. Un filtro por palabra suelta produciría tantos falsos positivos que se acabaría desactivando, que es la peor forma de fallar.
- La lista arranca con las fórmulas colectivas frecuentes que `lenguaje.md` ya nombra y para las que da reformulación —los vecinos, los habitantes, los aldeanos, los jugadores, todos los que, bienvenido a, señores, amigos, niños— y **no incluye** los casos sin reformulación limpia, que se anotan como candidatos y los decide el pendiente.
- La lista negra de tics genéricos del registro de tópicos arranca **precargada** y viaja aparte de estas: son cosas distintas, una es aptitud y la otra es repetición.

### El registro de tópicos, y por qué no rompe el determinismo

El registro es la versión barata de un crítico anti-cliché, y no cuesta ninguna llamada extra: viaja dentro del prompt que ya se manda. Cinco categorías cerradas —aperturas, imágenes, giros, oficios y objetos—, ventana de unas veinte entradas por categoría porque **lo reciente es lo que canta**, y se anota **solo lo adoptado**: anotar lo descartado enseñaría al registro a evitar frases que nadie llegó a leer.

Su contenido depende de lo que devuelva el modelo, así que no es reproducible. Eso no rompe **RNF-DET-002**, y conviene decir por qué: el registro es **estado inerte**, ninguna regla bifurca por él fuera de la construcción del prompt, y la estructura de una aventura no cambia con lo que el registro contenga. Es la misma frontera que el resto de la spec, aplicada a sí misma.

### La tensión entre «nada de degradación silenciosa» y «sin red no se nota»

Merece decirse porque parecen contradecirse. **RNF-RED-001** exige degradación silenciosa: sin cobertura, los textos caen a plantilla y ninguna pantalla menciona la red. **§6h** de `pipeline/decisiones-orquestador.md` prohíbe la degradación silenciosa, después de que el mismo bug de cableado a medias apareciera cinco veces.

No se contradicen porque hablan de superficies distintas, y esta spec lo resuelve así: **silencio hacia la jugadora, constancia en el dato**. Cada texto declara su origen (`llm` o `plantilla`), cada descarte deja su motivo en un catálogo cerrado y agregable, y el diagnóstico de una llamada se puede leer sin pantalla. Una fila que caiga entera al fallback es invisible jugando y es un histograma en `node --test`, exactamente como el catálogo de motivos de SPEC-010 hizo con el casting. La degradación que §6h castiga es la que **nadie puede ver**; esta se ve, solo que no desde la pantalla.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Se referencian por su nombre literal, no se duplican: la batería se escribió antes que el código y sus nombres son el contrato con `wa-qa-dev`.

- De **«El árbitro es el código y el narrador es el LLM»** (`@nucleo @determinismo`, bloqueante), que es la característica propia de esta fila: **«El modelo no escribe ningún dato vivo»**, **«Lo que llega fuera del esquema se descarta»**, **«Un texto que no pasa el filtro cae al fallback»** y **«Sin red, la aventura funciona entera»**. **«Con LLM y sin LLM la estructura es idéntica»** ya lo sostiene SPEC-010 por su lado; aquí se sostiene por el otro, que es el que de verdad podría romperlo.
- De **«Los nombres son únicos y del idioma del sitio»** (`@nucleo @determinismo`): **«Un nombre propuesto por el LLM solo se adopta si pasa validación»**, que es el escenario propio de RF-QUEST-007, y **«No hay dos nombres iguales en un mundo»**, que aquí se afirma con la capa de propuestas encendida.
- De **«Del móvil no sale nada del jugador»** (`@red @privacidad`, bloqueante): **«El prompt del LLM no lleva ningún dato real»**, que es el escenario que hace bloqueante esta fila, y **«Las coordenadas salen una sola vez, al generar el mapa»**, del que aquí se sostiene la mitad de que ninguna llamada al narrador las lleva.
- De **«El lenguaje es inclusivo y el sesgo va hacia el femenino»** (`@nucleo @lenguaje`): **«No se usa masculino genérico en fórmulas frecuentes»** y **«No se usa morfología inventada»**, que hasta ahora solo se podían afirmar sobre los textos de plantilla y con esta fila se afirman también sobre lo generado; y **«Ningún texto depende de un número que solo existe en la maqueta»**, del que aquí se sostiene la parte mecánica —las cifras prohibidas— y no la semántica.
- De **«Antes de salir es el único momento que pide atención»** (`@app @bucle`): **«Sin cobertura, la preparación dice lo mismo»** y **«El zurrón solo aparece si hay reserva que vaciar»**, de los que esta spec sostiene la mitad de datos: que sin red hay texto igual y que sin reserva no hay llamada.
- De **«Los dobles del andamiaje son reproducibles y no tocan el mundo real»** (`@nucleo @determinismo @privacidad`): **«El doble del proxy responde lo mismo a la misma petición»** y **«Ninguna pieza del andamiaje sale a la red al importarse»**, que es lo que hace ejecutable toda esta fila sin conexión.
- **Frontera, que esta spec deja preparada y no implementa:** **«El proxy no identifica a nadie»** (fila 23), **«Las fotos de Places se piden al crear el mapa»** (fila 25), **«El chiste nunca es a costa del sitio real ni de quien lo regenta»** (`@manual`, revisión humana del catálogo, fila 17) y **«El juego habla como mundo»** (fila 27 y siguientes).

El doble de `test/dobles/proxy.mjs` ya existe con sus tres modos y su catálogo de cuatro respuestas defectuosas —campo desconocido, dato vivo, contenido no apto y nombre que choca—, que son exactamente los cuatro casos que esta spec tiene que sobrevivir. No hace falta ampliarlo para cerrar la fila; si al implementar hiciera falta un quinto defecto, es de `wa-qa-dev` y no de aquí.

### Huecos de la batería que esta spec deja al descubierto

Se anotan porque son de `docs/testing.md`, no de esta spec, y ninguno se resuelve inventando un escenario aquí:

1. **Los dos puntos de invocación no tienen escenario.** «Nunca durante la caminata» es la mitad de RF-QUEST-008 y no hay nada en la batería que lo afirme. Es el hueco más grande de esta fila, y es afirmable en `@nucleo` con el inspector de red y el momento inyectado.
2. **El registro de tópicos no tiene escenario ninguno.** Ni sus categorías, ni la ventana, ni que solo se anote lo adoptado, ni que viaje como restricción negativa.
3. **«Generación única, cacheada y guardada con la partida» tampoco.** Que un segundo abrir de la partida no llame a nadie es lo que separa el coste declarado del coste real, y no está escrito.
4. **El fallback se afirma solo por «Sin red, la aventura funciona entera».** No hay escenario para la respuesta que llega y se descarta por partes, que es el caso frecuente cuando sí hay red.
5. **El filtro de aptitud solo tiene un escenario, y es el de contenido.** La longitud, las cifras prohibidas y la voz de aplicación dentro del juego no tienen ninguno, y son tres de las seis comprobaciones.
6. **El cribado del prompt contra los datos reales no tiene escenario.** «El prompt del LLM no lleva ningún dato real» afirma la ausencia de una cadena concreta; nada afirma que la construcción falle cuando aparece.
7. **La spec de la fila 17 no estaba escrita en disco** al redactar esta. Lo que aquí se dice sobre los textos de fallback —que cada plantilla declara uno por hueco y que sin él se rechaza al cargar el catálogo— es una exigencia de esta fila hacia aquella; si la suya dice otra cosa, manda la suya y esto se itera.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-017.
- **Sin bloque de UX Design ni comportamiento responsive** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz: las pantallas que pintan estos textos son de las filas 28, 34, 37 y 42.
- **La garantía de privacidad se monta con lista blanca y no con búsqueda de lo prohibido** → asumido (alternativa: construir el prompt libremente y buscar en él los datos reales antes de mandarlo). Regla: `seguridad-privacidad.md` §1 pide «la lista explícita de qué campos pueden viajar»; una lista negra solo encuentra lo que se le ocurrió a quien la escribió, y aquí lo que se afirma es una ausencia.
- **Además de la lista blanca hay un cribado final del prompt ya construido, y una coincidencia hace fallar la construcción** → asumido (alternativa: confiar solo en la lista blanca, que es más limpia). Regla: `pipeline/decisiones-orquestador.md` §6o, un criterio que se cumple casi siempre no es un criterio; sin el cribado, la afirmación de privacidad no se puede poner roja con ningún mundo real. Es la decisión más discutible de la spec, porque introduce un falso positivo posible —el nombre de fantasía que coincide con el real— y lo resuelve fallando.
- **El nombre del personaje no viaja y el mote sí** → asumido (alternativa: que no viaje ninguno de los dos, o que viajen los dos por ser ficción). Regla: `seguridad-privacidad.md` §1, del móvil no sale nada de la jugadora, y el nombre **lo teclea ella**, así que puede ser su nombre real; el mote lo produce el código desde la semilla. La línea es «lo que produjo el código», no «lo que suena a fantasía».
- **El presupuesto de espera se inyecta y su ausencia hace fallar la llamada** → asumido (alternativa: un valor por defecto en el núcleo). Regla: decide la experiencia de la pantalla de preparación, que es de la fila 28, y un número escondido en el núcleo es un valor que nadie revisa; es el mismo trato que SPEC-010 da al tramo del jugador.
- **Las listas del filtro se inyectan por locale, con un valor por defecto entregado** → asumido (alternativa: escribirlas dentro del filtro y cerrar de paso el pendiente 2 de `lenguaje.md`). Regla: `CLAUDE.md`, el diseño manda sobre el código y un pendiente declarado no se cierra en una spec de implementación; el valor por defecto existe para que la fila no dependa de esa decisión.
- **Las fórmulas de masculino genérico son de varias palabras y nunca palabras sueltas** → asumido (alternativa: una lista de palabras, que detecta más). Regla: `lenguaje.md` protege expresamente al tabernero gruñón —el masculino de una persona concreta no es genérico—, y un filtro con falsos positivos constantes se acaba desactivando, que es peor que uno estrecho.
- **El filtro comprueba además longitud, cifras prohibidas y voz de aplicación** → asumido (alternativa: limitarlo a la aptitud para menores, que es lo que el nombre dice). Regla: el sistema de diseño prohíbe expresamente las cifras de distancia, tiempo, ritmo y progreso en cualquier pantalla, y `lenguaje.md` fija que dentro del juego solo habla el mundo; si esas dos no se comprueban aquí, no se comprueban en ningún sitio sobre texto generado.
- **Un texto rechazado cae al fallback y el descarte queda en un catálogo cerrado de motivos** → asumido (alternativa: reintentar la llamada con una instrucción correctiva). Regla: `quests.md` decisión 1 dice que el fallback está siempre disponible y la generación es única; reintentar duplica el coste, mete no determinismo en el número de llamadas y convierte un caso previsto en un incidente.
- **El silencio de la degradación es hacia la jugadora y no hacia el dato** → asumido (alternativa: no dejar constancia, ya que RNF-RED-001 pide que no se note). Regla: `pipeline/decisiones-orquestador.md` §6h, cinco apariciones del mismo bug por degradar sin que nada se pusiera rojo; el origen declarado y el catálogo de motivos son lo que separa esta caída de aquellas.
- **El origen de cada texto se declara siempre, y un texto de plantilla no se sustituye después por uno del narrador** → asumido (alternativa: reintentar la vestidura cuando vuelva la cobertura). Regla: `quests.md` decisión 1, generación única y cacheada; una aventura que cambia de prosa a mitad rompe la continuidad de lo leído en voz alta, que es como se lee este juego.
- **La capa de nombres propuestos se aplica por defecto solo a lo que nace dentro de una aventura** → asumido, con un parámetro apagado de origen para extenderla al mundo (alternativa: aplicarla también a núcleos, servicios, parajes y calzadas). Regla: `quests.md` decisión 1 lo dice literalmente y declara que extenderla «cuesta una llamada extra al crear el mundo y es decisión de presupuesto, no de diseño».
- **Un nombre propuesto que coincide con el nombre real de un anclaje se descarta** → asumido (alternativa: admitirlo, ya que la unicidad la resuelve el índice). Regla: `seguridad-privacidad.md` §1, el anclaje real queda para los ojos de la jugadora; un nombre de fantasía idéntico al real revelaría por la puerta de atrás lo que el prompt tiene prohibido llevar.
- **Los puntos de invocación son un enumerado cerrado de dos valores y el momento de la salida se inyecta** → asumido (alternativa: confiar en que nadie llame en marcha, que es lo que hoy dice el diseño). Regla: RF-QUEST-008 dice «dos y no más» y «nunca en marcha»; sin el momento entre las entradas, «nunca en marcha» no es comprobable y §6o lo deja en un criterio que se cumple casi siempre.
- **La llamada del zurrón es una sola y agrupada, y sin reserva no se hace ninguna** → asumido (alternativa: una llamada por entrada de la reserva). Regla: `quests.md` decisión 3, «una única llamada agrupada al abrir la salida», con el tope de cinco de la reserva como cota de tamaño; y el escenario «El zurrón solo aparece si hay reserva que vaciar» exige que sin reserva no ocurra nada.
- **El envoltorio del zurrón es el único texto nuevo y cada entrada trae su fallback de la plantilla que la generó** → asumido (alternativa: redactar el resumen entero como una unidad narrativa). Regla: `quests.md` decisión 3 lo dice así, y duplicar la lógica de fallback dentro de un contenedor es el camino corto a que el resumen falle de una manera distinta que todo lo demás.
- **Las cinco categorías del registro de tópicos y la ventana de unas veinte entradas** → asumidas, con la lista negra de tics precargada (alternativa: no acotar la ventana, o una sola lista sin categorías). Regla: `quests.md` pendiente 4 fija las categorías y el orden de magnitud —«~20 entradas, lo reciente es lo que canta»—; sin ventana, el prompt crece sin techo y acaba pesando más que el encargo.
- **Solo se anotan los tópicos de los textos adoptados** → asumido (alternativa: anotar todo lo que devuelva el modelo). Regla: el registro existe para no repetirse ante la jugadora, y un texto descartado no lo leyó nadie; anotarlo estrecharía el prompt por frases que no existen.
- **El registro de tópicos no es reproducible y eso no rompe RNF-DET-002** → asumido, declarándolo como estado inerte (alternativa: no guardarlo con la partida para que el estado siga siendo comparable). Regla: RNF-DET-002 habla de la **estructura** de una aventura, no del estado entero; ninguna regla bifurca por el registro fuera de la construcción del prompt, y sin guardarlo no cumpliría su función entre salidas.
- **La clave de un texto sale del mapa, del punto de invocación y de la identidad del elemento** → asumida (alternativa: derivarla del prompt, como hace la clave de una ilustración). Regla: el prompt lleva dentro el registro de tópicos, que cambia entre llamadas, así que derivar de él daría una clave distinta para el mismo hueco y rompería «generación única»; las ilustraciones no tienen ese problema porque su prompt de ficción es estable.
- **El módulo sin llamada de red inyectada cae al fallback en vez de fallar** → asumido (alternativa: fallar nombrando la dependencia, como con el presupuesto de espera). Regla: es el estado normal en `node --test` y en una salida sin cobertura, y RNF-RED-001 lo describe como funcionamiento y no como error; el presupuesto de espera sí falla porque su ausencia no describe ningún estado legítimo.
- **Los textos de fallback son obligatorios por hueco, y una plantilla sin uno se rechaza al cargar el catálogo** → asumido (alternativa: dejarlo a la fila 17 y admitir plantillas incompletas). Regla: `quests.md` decisión 1, «cada plantilla lleva textos por defecto dignos como fallback»; con la declaración opcional, «esta plantilla no necesita fallback» y «se me olvidó» son indistinguibles, que es el mismo argumento con el que SPEC-012 hizo obligatoria la declaración de rumor.
- **El filtro y la propuesta viven en `names/`** → asumido (alternativa: un área nueva `narrador/`, o meterlo todo en `quests/`). Regla: las áreas del paquete están fijadas desde SPEC-002 y no se abren nuevas; las listas del filtro son por locale y el índice de nombres ya vive ahí, así que es donde la dependencia queda más corta.
