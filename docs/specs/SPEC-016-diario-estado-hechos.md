# SPEC-016 — El diario y el estado de la partida: lo que se apunta, lo que manda y lo que se puede reconstruir

## Descripción

Todo lo que le pasa a la jugadora se guarda dos veces y no es un descuido: **el estado**, que es su partida tal como está ahora —lo que le llegó a cada núcleo, lo que sabe, lo que lleva encima, a quién conoce—, y **el registro de hechos**, la lista de lo que ha ido haciendo, que existe como red de seguridad y para poder auditar por qué pasó algo. Dos verdades en paralelo es el bug clásico, así que van con una regla que esta spec convierte en código verificable: **manda el estado**, y el registro solo se reproduce cuando el estado no se puede leer — avisando de que el resultado puede diferir, en lugar de disimularlo.

Dentro del estado vive el **diario**, y el diario tiene una propiedad rara que hay que defender de la tentación de arreglarla: **registra lo oído, no lo cierto**. Si a la jugadora le contaron que fueron tres campanas y en realidad fue una, el diario guarda tres campanas, con el sitio donde se lo contaron y el momento en que se lo contaron. Oír después la versión buena **no corrige la entrada anterior**: se añade otra, y ninguna se marca como correcta. De ahí sale sin tutorial el mejor truco del juego —que la jugadora triangule comparando su propio diario—, y por eso el **nivel de deformación**, que viaja en el dato porque el código lo necesita, **no llega a pantalla en ningún sitio**.

No tiene interfaz de usuario. Es la capa `partida/` del núcleo determinista, la que ya habitan SPEC-011, SPEC-012 y SPEC-014. Las pantallas donde esto se ve son de otras filas: la entrada del día que cierra el telón (**A5P4**, fila 36), el diario por días (**A6P2**), la puesta en escena de la primera coincidencia (**A6P3**) y el diario por historias (**A6P4**), las tres de la fila 37. Aquí se entrega el dato que todas ellas pintan, y la garantía de que ese dato nunca les da un nivel que enseñar.

Anclas: **RF-DIARIO-001** y **RF-PERS-003** (`docs/prd.md` §4.6 y §4.10), con `game-design/partida-guardada.md` **§2** como fuente que manda sobre el PRD y `game-design/quests.md` **decisión 3** como fuente del diario. **RF-PRIV-002** aplica como invariante bloqueante (`@privacidad`), y **RNF-DET-001** y **RNF-DET-003** como siempre. Se apoya en SPEC-003 (la semilla de la partida), SPEC-009 (**el mundo congelado, el área `partida/`, la constante única de versión de formato, el esquema cerrado, la canonicalización y el almacén inyectado: se consumen tal cual y no se redefine ninguno**), SPEC-011 (el contador de pasos y su siembra), SPEC-012 (la identidad del rumor, los hechos estructurados, el nivel, el signo y lo que sedimenta en cada núcleo) y SPEC-014 (la memoria del testigo, que es nivel 0 y **no corrige** lo que se cuenta en el pueblo).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí no la toca**: se usa el almacén que SPEC-009 ya inyecta, con sus mismas cuatro operaciones, y no se lee el reloj del sistema en ningún campo. Está descrito en «Frontera de inyección: la que ya hay».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** las **pantallas del diario** —la entrada del día (A5P4, fila 36) y las dos maneras de leerlo, incluida la puesta en escena de la primera coincidencia (A6P2/A6P3/A6P4, fila 37, RF-DIARIO-002/003/004)—; **exportar e importar** la partida, la inclusión en la copia del sistema y **la migración entre versiones del formato** (fila 39, RF-PERS-004/005/008); **empezar de nuevo** (fila 40); **la lista de mapas y cuál está activo** (fila 41); **qué es un rango, qué hay en la repisa y cómo se ganan** (fila 15), de los que aquí solo se entrega el sitio donde se guardan y la regla de quién manda; **la cola de entregas y los micro-encuentros** (fila 19), igual; **la redacción** de cualquier texto y su filtro de aptitud (fila 18); **la propagación** y el cálculo del nivel (fila 12, que se consume resuelta); **cuándo aflora al llegar** lo que se cuenta en un sitio (fila 32), que es lo que dispara una entrada pero no es esta entrega.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El sobre del estado», «El diario registra lo oído», «El registro de hechos» y «El estado manda sobre el registro»; la **validación de entradas** en el hecho de un tipo que nadie declara, el hecho sin momento, el estado sin versión de formato, el campo no declarado por ninguna área y el nivel fuera de rango que llega desde fuera; el **estado vacío** en la partida recién creada, el registro sin ningún hecho, el diario sin ninguna entrada y el núcleo donde no se cuenta nada; el **estado de error** en el estado ilegible, el registro ilegible, los dos a la vez, el hecho corrupto a mitad del registro y el almacén que falla al escribir; y los **casos límite** en la escritura interrumpida entre el registro y el estado, la vuelta al mismo núcleo que ya se oyó, las dos entradas del mismo suceso, los dos hechos del mismo paso, la reconstrucción repetida y el presupuesto de tamaño de una partida de mil días.

Las convenciones de nombre se heredan: **«documento»** significa lo que SPEC-009 escribe y lee, y **«estado»** y **«registro»** son dos documentos más de esa misma familia. **«Paso»** es el paso del mundo de SPEC-011. **«Nivel»**, **«signo»**, **«hechos de un rumor»** e **«identidad de un suceso»** son los de SPEC-012 y no se redefinen aquí. **«Hecho»**, a secas, es una entrada del registro de esta spec, que es cosa distinta de «los hechos» de un rumor y por eso se nombra siempre con su artículo.

### El sobre del estado y su versión

- **Dado** una partida recién creada, **cuando** se guarda su estado, **entonces** el documento lleva la versión de formato de la constante única de SPEC-009, y no una constante propia.
- **Dado** un estado guardado, **cuando** se lee su cabecera, **entonces** declara la semilla de la partida y la versión de las reglas con la que se escribió.
- **Dado** un estado guardado, **cuando** se leen sus áreas, **entonces** cada una es la de la spec que la posee —el contador de pasos, lo que se cuenta en cada núcleo, las caras conocidas con su memoria y su relación, el diario— y ninguna se declara aquí por segunda vez.
- **Dado** un estado con un campo que ninguna área declara, **cuando** se valida, **entonces** falla nombrando el campo: el esquema es cerrado, como el de SPEC-009.
- **Dado** el mismo estado, **cuando** se escribe dos veces, **entonces** los dos documentos son idénticos byte a byte.
- **Dado** un estado sin campo de versión de formato, **cuando** se intenta abrir, **entonces** se rechaza nombrando el campo que falta, antes de interpretar nada más.
- **Dado** un estado con una versión de formato mayor que la que el juego entiende, **cuando** se intenta abrir, **entonces** no se abre y el error declara la versión que trae y la que se esperaba.
- **Dado** un estado con una versión de formato menor que la actual, **cuando** se intenta abrir, **entonces** el error declara que hace falta migrarlo, sin intentar interpretarlo con las reglas nuevas.
- **Dado** el estado y el documento congelado de una celda, **cuando** se comparan, **entonces** ningún dato de la jugadora está en el documento de celda y ningún dato del mundo está en el estado.
- **Dado** una jugadora que ha andado cien salidas, **cuando** se comparan los documentos congelados del mundo antes y después, **entonces** son idénticos byte a byte y todo lo que ha crecido está en el estado y en el registro.

### El diario registra lo oído

- **Dado** un rumor que llega a «Monfrida» en nivel 1, hablando de tres campanas, **cuando** la jugadora llega a «Monfrida», **entonces** su diario guarda la versión de tres campanas.
- **Dado** esa misma entrada, **cuando** se lee, **entonces** declara el lugar y el momento en que se oyó.
- **Dado** una entrada del diario, **cuando** se lee su lugar, **entonces** es el identificador de un sitio del mundo congelado y nunca una coordenada.
- **Dado** una entrada del diario, **cuando** se lee su momento, **entonces** es el día de diario y el paso del mundo en que se oyó, y nunca una marca del reloj real.
- **Dado** una entrada del diario, **cuando** se compara su versión con lo que sedimentó en ese núcleo, **entonces** son la misma: el diario copia lo que llegó, no lo que ocurrió.
- **Dado** una versión contada por un testigo directo, **cuando** se apunta, **entonces** entra como una entrada más, con su lugar y su momento, y no se marca como correcta.
- **Dado** una entrada cuyo texto del narrador todavía no existe, **cuando** se lee, **entonces** los hechos, el nivel y el signo están completos y la entrada cae al texto de la plantilla.
- **Dado** un núcleo donde no se cuenta nada de la jugadora, **cuando** llega a él, **entonces** no se apunta ninguna entrada y no falla.
- **Dado** un núcleo que ya le contó su versión, **cuando** la jugadora vuelve y se la vuelven a contar, **entonces** no se añade una segunda entrada.
- **Dado** una entrada del diario, **cuando** se lee de qué mapa es, **entonces** lo declara, y al leer el diario de otro mapa no aparece.
- **Dado** un diario sin ninguna entrada, **cuando** se lee, **entonces** se obtiene una lista vacía y no un error.

### El diario no sobrescribe

- **Dado** un diario con la versión de tres campanas oída en «Monfrida», **cuando** la jugadora oye en «Vilanova» la versión fiel, de una campana, **entonces** el diario contiene las dos entradas.
- **Dado** ese mismo diario, **cuando** se leen las dos entradas, **entonces** ninguna se marca como correcta.
- **Dado** ese mismo diario, **cuando** se lee la entrada anterior, **entonces** sigue idéntica: ni su versión, ni su lugar, ni su momento han cambiado.
- **Dado** dos entradas del mismo suceso, **cuando** se leen, **entonces** las dos declaran la misma identidad de suceso, y agruparlas no exige comparar textos.
- **Dado** tres versiones de un suceso, oídas en los días 22, 23 y 29, **cuando** se piden las de ese suceso, **entonces** salen en el orden 22, 23, 29.
- **Dado** esas tres versiones, **cuando** se busca en la superficie pública un orden por fidelidad o por nivel, **entonces** no existe.
- **Dado** un diario, **cuando** se pregunta si algún suceso tiene ya dos versiones apuntadas, **entonces** se responde por identidad de suceso, sin leer ningún texto.
- **Dado** un suceso del que la jugadora oye una tercera versión, **cuando** se apunta, **entonces** las tres conviven y ninguna sustituye a otra.

### El nivel de deformación no sale a pantalla

- **Dado** una entrada del diario, **cuando** se lee el dato interno, **entonces** lleva el nivel y el signo con los que llegó.
- **Dado** la proyección de lectura que consumen las pantallas del diario, **cuando** se inspecciona una entrada, **entonces** no lleva el nivel, ni ningún porcentaje, ni ninguna etiqueta de fiabilidad.
- **Dado** un diario con versiones de niveles 0, 1 y 3, **cuando** se recorre entero por días y por sucesos, **entonces** ninguna entrada de la proyección expone un nivel.
- **Dado** la proyección de lectura, **cuando** se ordena, **entonces** el criterio es cuándo se oyó y no hay ningún otro disponible.
- **Dado** un nivel recibido fuera del rango de cero a tres, **cuando** se intenta apuntar la entrada, **entonces** falla nombrando el valor recibido.

### El registro de hechos

- **Dado** una partida recién creada, **cuando** se lee su registro, **entonces** está vacío y no es un error.
- **Dado** el catálogo de tipos de hecho, **cuando** se compara con la lista de `partida-guardada.md` §2, **entonces** están los pasos ejecutados, los sitios pisados, las aventuras aceptadas, cerradas y abandonadas, las decisiones dentro de una aventura, las entregas atendidas o ignoradas, los anclajes descartados, las caras conocidas y los objetos obtenidos.
- **Dado** una versión que la jugadora oye en un sitio, **cuando** se apunta en el diario, **entonces** deja también su hecho en el registro.
- **Dado** un hecho, **cuando** se lee, **entonces** declara su tipo, su mapa, su momento —día y paso— y su carga inerte.
- **Dado** un hecho recién escrito, **cuando** se lee el registro, **entonces** está al final y ningún hecho anterior ha cambiado.
- **Dado** un hecho ya escrito, **cuando** el estado cambia después por cualquier motivo, **entonces** el hecho no se reescribe.
- **Dado** dos hechos producidos en el mismo paso, **cuando** se leen, **entonces** su orden entre ellos es estable y sale de un criterio declarado, no del orden en que se insertaron.
- **Dado** un hecho de un tipo que ninguna área declara, **cuando** se valida el registro, **entonces** falla nombrando el tipo.
- **Dado** un hecho sin momento, **cuando** se valida, **entonces** falla nombrando el campo.
- **Dado** un cierre de salida cuya escritura de hechos falla a mitad, **cuando** se lee el registro, **entonces** no hay hechos a medias: se anexan todos o ninguno.
- **Dado** un almacén que falla al escribir, **cuando** se cierra la salida, **entonces** el error se propaga y el estado y el registro anteriores siguen intactos.
- **Dado** el módulo sin almacén inyectado, **cuando** se cierra una salida, **entonces** todo ocurre en memoria y no se escribe nada en ningún sitio.

### El estado manda sobre el registro

- **Dado** una partida cuyo registro de hechos reconstruye un rango distinto al guardado, **cuando** se carga, **entonces** vale el estado guardado.
- **Dado** esa misma partida, **cuando** se pide el diagnóstico de la discrepancia, **entonces** se obtiene qué campo difiere y con qué valor en cada lado.
- **Dado** esa misma partida, **cuando** se consulta el diagnóstico, **entonces** ni el estado ni el registro cambian.
- **Dado** un estado que se puede leer, **cuando** se carga la partida, **entonces** el registro no se reproduce.
- **Dado** un estado que declara estar aplicado hasta el hecho N y un registro con hechos posteriores a N, **cuando** se carga, **entonces** se aplican los posteriores y el estado queda al día.
- **Dado** ese mismo caso, **cuando** se aplica, **entonces** ningún hecho anterior o igual a N se vuelve a aplicar.
- **Dado** un estado legible y un registro ilegible, **cuando** se carga, **entonces** la partida se abre con el estado y el fallo del registro se declara sin impedir jugar.

### Reconstruir desde el registro

- **Dado** una partida cuyo estado se ha corrompido, **cuando** se reconstruye desde el registro de hechos, **entonces** se recuperan los rangos, lo oído, la repisa y los NPCs conocidos.
- **Dado** esa misma reconstrucción, **cuando** termina, **entonces** se avisa de que el resultado puede diferir.
- **Dado** una reconstrucción cuya versión de reglas actual no es la que el registro tiene grabada, **cuando** termina, **entonces** el aviso declara las dos versiones.
- **Dado** un estado corrompido, **cuando** se carga la partida sin pedir reconstrucción, **entonces** falla declarando que el estado no se puede leer y cuántos hechos tiene el registro, y no reconstruye por su cuenta.
- **Dado** una reconstrucción terminada, **cuando** se lee el registro, **entonces** sigue idéntico byte a byte.
- **Dado** la misma partida, **cuando** se reconstruye dos veces, **entonces** los dos estados reconstruidos son idénticos byte a byte.
- **Dado** un registro vacío, **cuando** se reconstruye, **entonces** se obtiene el estado inicial de una partida y no un error.
- **Dado** un registro con un hecho corrupto a la mitad, **cuando** se reconstruye, **entonces** falla nombrando el hecho y no devuelve ningún estado a medias.
- **Dado** un registro con hechos de un área que esta versión del juego ya no tiene, **cuando** se reconstruye, **entonces** falla nombrando el tipo, en lugar de saltárselos en silencio.
- **Dado** un estado corrompido y un registro corrompido, **cuando** se intenta abrir la partida, **entonces** falla declarando las dos cosas y no se ofrece ninguna partida a medias.
- **Dado** un estado reconstruido, **cuando** se guarda, **entonces** declara que salió de una reconstrucción y con qué versión de reglas se hizo.

### Ni un rastro de ubicación

- **Dado** el estado y el registro de una jugadora que ha andado cien salidas, **cuando** se recorren todos sus campos, **entonces** no contienen ningún histórico de posiciones.
- **Dado** un hecho de sitio pisado, **cuando** se lee, **entonces** declara el identificador del sitio y el momento, y ninguna coordenada.
- **Dado** el registro entero, **cuando** se busca por dónde fue la jugadora de un sitio a otro, **entonces** no aparece: no se guarda ningún camino recorrido.
- **Dado** un estado o un registro al que se le añade un campo con una posición de la jugadora, **cuando** se valida, **entonces** el esquema cerrado lo rechaza nombrando el campo.
- **Dado** el estado y el registro, **cuando** se buscan marcas de tiempo del reloj real, **entonces** no hay ninguna.
- **Dado** el estado, **cuando** se lee la semilla de la partida, **entonces** es la de SPEC-003 tal cual, y la coordenada de la que salió no está en ningún campo.
- **Dado** las rutas que entrega esta spec, **cuando** se inspeccionan sus imports, **entonces** ninguno lee un sensor, el reloj o la red.

### El tamaño, que se mide

- **Dado** una entrada de diario ya escrita, **cuando** se mide en su forma canónica y sin el texto que la cuenta, **entonces** ocupa menos de 500 bytes.
- **Dado** un hecho del registro, **cuando** se mide en su forma canónica, **entonces** ocupa menos de 300 bytes.
- **Dado** una partida de mil días con veinte hechos por día, **cuando** se mide su registro, **entonces** ocupa menos de 6 MB sin comprimir.
- **Dado** esa misma partida, **cuando** se mide su estado sin los textos del narrador, **entonces** ocupa menos de 2 MB sin comprimir.
- **Dado** un texto del narrador citado por varias entradas, **cuando** se mide el estado, **entonces** aparece una sola vez, por su clave, y ninguna entrada lo copia.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/estado.js` | el sobre del estado: cabecera, semilla, versión de reglas, marca de aplicación, composición de áreas y su validación contra el esquema cerrado |
| `packages/nucleo/partida/hechos.js` | el catálogo de tipos declarado por área, la forma de un hecho, el anexado atómico y el orden estable dentro de un paso |
| `packages/nucleo/partida/diario.js` | la entrada, su clave, la regla de no sobrescribir, la consulta por días y por suceso, y la proyección sin nivel |
| `packages/nucleo/partida/reconstruccion.js` | reproducir el registro sobre el estado inicial, la comparación con el estado guardado y el resultado con su aviso |

Las cuatro viven en `partida/` por la misma razón que las de SPEC-011, SPEC-012 y SPEC-014: **esto es estado de la jugadora sobre un mundo congelado, no parte del mundo**. Las áreas del paquete están fijadas desde SPEC-002 y esta entrega no abre ninguna nueva.

`formato.js`, de SPEC-009, **se extiende y no se duplica**: la constante de versión, la validación estructural, el esquema cerrado y la canonicalización son las suyas, y el estado y el registro son dos documentos más de esa familia. Un segundo mecanismo de versionado en paralelo es exactamente el bug que esta spec existe para no cometer.

### Frontera de inyección: la que ya hay

Esta entrega **no añade ninguna entrada al núcleo**. Usa el almacén que SPEC-009 ya inyecta, con sus mismas cuatro operaciones y su misma regla de que la atomicidad de la escritura es del almacén. Y **no usa el reloj**: el único campo del proyecto que lee la hora sigue siendo la fecha de captura del contenido refrescable de Places, que es de SPEC-009 y no aparece aquí. Todo lo demás llega como argumento de quien construye la partida:

- **Lo que se cuenta en un núcleo**, con su versión deformada, su nivel y su signo, de SPEC-012. Aquí no se propaga, no se deforma y no se recalcula ningún nivel: se copia lo que llegó.
- **La memoria de una cara**, de SPEC-014, cuando la versión la cuenta un testigo. Es nivel 0 por construcción y entra en el diario como una entrada más.
- **El número del paso y el día de diario en curso**, de SPEC-011 y del cierre de salida de la fila 36.

### El sobre, y por qué las áreas se registran en lugar de listarse

El estado es un documento compuesto: una cabecera común y una parte por área, donde cada área es de la spec que la posee —el contador y el resto de metros son de SPEC-011, lo que se cuenta en cada núcleo es de SPEC-012, las caras conocidas con su memoria y su relación son de SPEC-014, el rango, el oro, los objetos y la repisa son de la fila 15, la cola de entregas es de la fila 19, y el diario es de aquí—. Cada área **declara su propio esquema cerrado y sus propios tipos de hecho**, y el sobre valida contra la unión de lo declarado.

La alternativa —enumerar aquí todos los campos de todas las áreas— haría que cada fila de B2 y B6 tuviera que iterar esta spec para caber, y que el número de versión del formato subiera por motivos que no son cambios de formato. Con el registro por área, añadir la fila 15 no renegocia nada, exactamente como los huecos de recursos de SPEC-009 dejaron entrar a las filas 18 y 25.

La cabecera lleva cuatro cosas y no más: la **versión de formato** (de la constante de SPEC-009), la **semilla de la partida** (de SPEC-003 — es el único sitio donde vive, porque SPEC-009 la dejó fuera de los documentos del mundo), la **versión de las reglas** con la que se escribió, y la **marca de aplicación**.

### La marca de aplicación, y el orden en el que se escribe

«Escribe dos veces» tiene un fallo obvio: si el apagón cae entre las dos escrituras, alguien queda por detrás. La regla es esta y hace falta decirla porque decide el orden:

1. **El registro se anexa primero**, entero o nada.
2. **El estado se escribe después**, y declara **hasta qué hecho está aplicado**.
3. **Al cargar**, los hechos posteriores a esa marca se aplican hacia delante; los anteriores o iguales, jamás.

Así «el estado manda» queda preciso en lugar de aproximado: **el estado manda sobre lo que ya declara haber aplicado**, y aplicar la cola pendiente no es reconstruir, es terminar una escritura interrumpida. Con el orden al revés —estado primero— un apagón perdería hechos sin que nada se pusiera rojo, que es la forma de fallo que este repo ya ha pagado cuatro veces (`pipeline/decisiones-orquestador.md` §6h).

### Qué es exactamente «discrepar», y qué se hace con ello

Reproducir el registro sobre el estado inicial produce un estado candidato. Si difiere del guardado, **gana el guardado**, sin excepción y sin negociación, y la diferencia queda disponible como **diagnóstico**: qué campo, qué valor a cada lado. Consultarlo no cambia nada. Es lo que `partida-guardada.md` §2 llama «poder auditar por qué pasó algo», y es también la única manera de que un fallo de esta capa se vea en lugar de convertirse en una partida ligeramente torcida.

La reproducción **solo se ejecuta cuando alguien la pide**. Cargar una partida no reproduce nunca el registro: si el estado se lee, se usa; si no se lee, la carga falla declarando que no se puede leer y cuántos hechos hay disponibles, y la decisión de reconstruir se toma fuera del núcleo. Reconstruir por iniciativa propia sería disimular el fallo, que es justo lo que el documento de diseño prohíbe.

### La divergencia se avisa, y el texto del aviso no se inventa aquí

Reconstruir **siempre** declara que el resultado puede diferir: es una reproducción de reglas sobre hechos, y las reglas son código que cambia. Cuando además la versión de reglas grabada en el registro no es la actual, el aviso declara las dos versiones — ese campo nace en SPEC-009 precisamente para esto y aquí se le da su primer uso.

Lo que esta spec entrega es el **resultado declarado**: reconstruido sí o no, las dos versiones de reglas, y qué áreas se reprodujeron. **El texto que se le enseña a la jugadora es el pendiente 3 de `partida-guardada.md`** —«qué se le dice al jugador si la reconstrucción de emergencia da otro estado»— y sigue abierto: no se cierra aquí ni se inventa una redacción, y su pantalla es de la fila 39. Es uno de los pocos sitios donde el juego tiene que confesar un fallo, y merece que lo escriba quien decida el registro de voz, no una spec de datos.

### El diario: la entrada, la clave y las dos clases

Una entrada lleva: identidad, mapa, **clase** (lo propio o lo oído), **identidad del suceso** (la del rumor de SPEC-012), **lugar** (identificador de un sitio del mundo congelado), **momento** (día de diario y paso del mundo), **versión** (los hechos estructurados tal como llegaron), **nivel** y **signo**, y la **referencia al texto** que la cuenta, del narrador si existe y de la plantilla si no.

- **La clave es `suceso + fuente`**, donde la fuente es el núcleo que lo contó o la cara que lo contó. Es lo que hace que volver al mismo sitio no duplique nada —cada núcleo oye una sola versión y no cambia (SPEC-012)— y que la versión de un testigo entre como entrada aparte en lugar de pisar la del pueblo.
- **La clase «lo propio» existe en el contenedor y la escribe la fila 36.** RF-DIARIO-005 pide que lo propio vaya en primera persona y lo oído aparte con distinta autoridad; el contenedor lo admite desde aquí para que el telón no tenga que renegociar el formato, y esta spec solo especifica la clase «lo oído».
- **El nivel y el signo se guardan y no se proyectan.** Existen dos superficies de lectura y la distinción es el criterio central de RF-DIARIO-001: la interna, que los lleva porque el código los necesita para agrupar, auditar y reconstruir, y la **proyección** que consumen las pantallas, que no los lleva ni puede llevarlos. SPEC-012 ya afirma lo mismo sobre lo que entrega a quien pinta; aquí se afirma sobre lo que se guarda.
- **El único orden que existe es cuándo se oyó.** No hay orden por nivel ni por fidelidad, y no es un olvido: `quests.md` decisión 3 dice que ordenar de más fiel a más torcida sería enseñar el nivel por la puerta de atrás.

### Lo que hace posible la triangulación de la fila 37, y lo que no es de aquí

La identidad del suceso viaja en cada entrada, así que **detectar que dos entradas son el mismo suceso es una consulta sobre datos, no una comparación de textos**. Eso es todo lo que la fila 37 necesita de esta fila. La puesta en escena de la primera coincidencia, el desbloqueo de la vista por historias y las pantallas A6P2/A6P3/A6P4 son suyas; el sobre reserva el **marcador de una sola vez** —como SPEC-009 reservó los huecos de recursos— para que la fila 37 lo encienda sin tocar el formato, y esta spec no decide cuándo se enciende.

### El catálogo de hechos, y por qué el diario también deja hecho

`partida-guardada.md` §2 lista lo que deja hecho: pasos ejecutados, sitios pisados, aventuras aceptadas, cerradas o abandonadas, decisiones dentro de una quest, entregas atendidas o ignoradas, anclajes descartados, NPCs conocidos y objetos obtenidos. A esa lista se le añade uno, y hace falta: **la versión oída en un sitio**. Sin él, «el registro basta para reconstruir» sería falso para «lo oído», que es literalmente una de las cuatro cosas que el escenario exige recuperar.

La forma de un hecho reparte el trabajo así: lo que es **dato** —qué se oyó, dónde, cuándo— viaja en su carga inerte y se recupera verbatim; lo que es **regla** —qué rango sale de lo que llegó, qué desbloquea un objeto— se recalcula al reproducir. Esa frontera es exactamente la que explica por qué la reconstrucción puede diferir: los datos no cambian entre versiones, las reglas sí.

### El presupuesto de tamaño, y qué palanca se toca si no se cumple

Los cuatro números —500 bytes por entrada, 300 por hecho, 6 MB de registro y 2 MB de estado en una partida de mil días— salen de aplicar a esta capa el mismo criterio que SPEC-009 aplicó al mundo, y son el instrumento con el que se cierra el pendiente 1 de `partida-guardada.md`: sin medida no se puede decidir si una partida larga se poda.

**Si el presupuesto no se cumple, la palanca es compactar por instantánea, nunca podar hechos sueltos.** Compactar es escribir un estado sellado y empezar el registro desde ahí, conservando la propiedad de que lo que hay basta para reconstruir desde el sello; podar hechos rompe esa propiedad en silencio. La compactación es de la fila 39, que es la que saca el fichero del móvil, y aquí solo se deja el hueco: la marca de aplicación y la versión de reglas son lo que la hace posible.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Se referencian por su nombre literal, no se duplican: la batería se escribió antes que el código y sus nombres son el contrato con `wa-qa-dev`.

- De **«El diario registra lo oído, no lo cierto»** (`@app @rumores`), que es la característica propia de esta fila: **«Se guarda la versión deformada»**, **«Una entrada no se sobrescribe con otra más veraz»** y **«El nivel de deformación no sale nunca a pantalla»**. El cuarto, **«El testigo directo es fiel y no corrige al pueblo»**, es de las filas 12 y 14; de él aquí solo se sostiene que la versión del testigo entra en el diario como entrada aparte y no corrige la anterior.
- De **«El mundo se congela entero»** (`@nucleo @persistencia`): **«El estado manda sobre el registro»** y **«El registro basta para reconstruir»**, que son los dos escenarios que esta spec existe para hacer verdad, y que SPEC-009 declaró explícitamente **no suyos**.
- De **«Del móvil no sale nada del jugador»**, bloqueante: **«El rastro de ubicación no se guarda nunca»**, que aquí se afirma sobre el estado y sobre el registro, que es donde de verdad podría colarse una traza.
- De **«Triangular se descubre jugando y luego se facilita»**: **«Las versiones se ordenan por cuándo se oyeron»**, del que aquí se sostiene la mitad de datos —el orden es por momento y no existe otro—; la mitad de pantalla es de la fila 37. **«Al principio el diario solo se lee por días»**, **«La primera coincidencia se pone en escena»** y **«A partir de ahí se abre la vista por historias»** son enteros de la fila 37.
- De **«La semilla es un dato de la partida, no una coordenada»**: **«La semilla no contiene ninguna coordenada»**, del que aquí se sostiene que la semilla vive en el estado y en ningún otro sitio.
- **Frontera, que esta spec deja preparada y no implementa:** **«La copia guardada se puede volver a abrir»** (fila 39), **«Los mapas antiguos se leen desde el diario»** (filas 37 y 41), **«El mundo de casa no avanza en tu ausencia»** (fila 41), **«Un paseo sin aventura tiene telón completo menos desenlace»** (fila 36) y **«Se puede ser alguien en un pueblo donde no has estado»** (fila 12).

### Huecos de la batería que esta spec deja al descubierto

Habría que añadirlos antes de dar la fila por verificada, y el primero es de los que deciden si se puede verificar algo en esta máquina:

1. **La característica «El diario registra lo oído, no lo cierto» está etiquetada `@app` entera**, y tres de sus cuatro escenarios son afirmables en `@nucleo` sobre el dato guardado, sin simulador ni pantalla. Con Maestro ausente (`pipeline/decisiones-orquestador.md` §4), dejarla como está significa cerrar esta fila sin una sola verificación ejecutable. Recolocarla —o desdoblar cada escenario en su mitad de dato y su mitad de pantalla— es decisión de quien mantiene la batería, no de esta spec.
2. **El registro de hechos no tiene ningún escenario propio.** Que cada cosa que altera el estado deje hecho, que el catálogo sea cerrado y que el registro sea append-only son tres afirmaciones centrales de RF-PERS-003 y ninguna está escrita.
3. **La escritura interrumpida y la marca de aplicación.** El caso más probable de esta capa —apagón entre el registro y el estado— no tiene escenario.
4. **El aviso de divergencia solo se afirma como «se avisa».** No hay escenario para el caso de versión de reglas distinta, y no puede haberlo con texto mientras el pendiente 3 de `partida-guardada.md` siga abierto.
5. **El presupuesto de tamaño de una partida larga**, que además es el instrumento con el que se cierra el pendiente 1 de `partida-guardada.md`.
6. **RF-PERS-008**, ya marcado «⚠ sin escenario» en el PRD. La migración es de la fila 39, pero la versión que se migra la escriben también el estado y el registro de aquí.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-015.
- **Sin bloque de UX Design ni comportamiento responsive** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz: las pantallas del diario son de las filas 36 y 37.
- **El estado y el registro son dos documentos más del formato de SPEC-009, con su misma constante de versión** → asumido (alternativa: un versionado propio para la partida, independiente del del mundo). Regla: el encargo dice consumir el formato de SPEC-009 sin redefinirlo, y dos cadenas de versión sobre ficheros que se guardan y se exportan juntos es la primera puerta por la que entra una migración a medias.
- **El estado se compone de áreas que declaran su esquema y sus tipos de hecho, en lugar de enumerar aquí todos los campos** → asumido (alternativa: un esquema plano y cerrado escrito entero en esta spec). Regla: es el mismo patrón con el que SPEC-009 dejó los huecos de las filas 18 y 25; con un esquema plano, cada fila posterior tendría que iterar esta spec y subir el número de formato por algo que no es un cambio de formato.
- **Los «sitios pisados» sí son un hecho del registro, y eso no contradice RF-PRIV-002** → asumido (alternativa: no registrarlos, por parecerse a una traza). Regla: `partida-guardada.md` §2 los incluye por escrito en la lista cerrada, y lo que RF-PRIV-002 prohíbe es el histórico de **posiciones**: aquí se guarda el identificador de un sitio del mundo congelado y el momento, nunca una coordenada, nunca un camino entre dos sitios y nunca una lectura de sensor. Es la decisión más discutible de esta spec y por eso tiene criterios propios en «Ni un rastro de ubicación».
- **El momento de una entrada y de un hecho es el día de diario y el paso del mundo, sin reloj real** → asumido (alternativa: guardar además la fecha del reloj inyectado que SPEC-009 ya tiene). Regla: es lo único que hace la partida comparable byte a byte y reproducible en `node --test`, el escenario de la batería habla de «los días 22, 23 y 29» y no de fechas, y una fecha real es un dato sobre la vida de la jugadora que el juego no necesita para nada.
- **El registro se anexa antes que el estado, y el estado declara hasta qué hecho está aplicado** → asumido (alternativa: escribir el estado primero, o no llevar marca). Regla: sin marca, un apagón entre las dos escrituras pierde hechos en silencio y la regla «manda el estado» tapa la pérdida; con ella, aplicar la cola pendiente es terminar una escritura, no reconstruir. Es la decisión que hace verificable la frontera entre las dos.
- **Reconstruir es una operación explícita y nunca automática al cargar** → asumido (alternativa: reconstruir solo si el estado no se lee, sin que nadie lo pida). Regla: `partida-guardada.md` §2 manda avisar en lugar de disimular, y una reconstrucción silenciosa es exactamente disimular; además la decisión de aceptar un estado que puede diferir es de la jugadora y su pantalla es de la fila 39.
- **La reconstrucción avisa siempre, y además declara las dos versiones cuando las reglas han cambiado** → asumido (alternativa: avisar solo si la versión difiere). Regla: el escenario «El registro basta para reconstruir» pide el aviso sin condicionarlo a ninguna versión, y una reproducción de reglas sobre hechos puede diferir aunque el número no se haya movido.
- **El texto del aviso no se escribe aquí** → asumido, se entrega un resultado declarado y los datos con los que redactarlo (alternativa: proponer una redacción). Regla: es el pendiente 3 de `partida-guardada.md`, declarado abierto, y `game-design/` manda sobre el código; inventarlo aquí lo cerraría de tapadillo en un fichero que nadie lee para decidir voz.
- **La discrepancia entre estado y registro se ofrece como diagnóstico consultable** → asumido (alternativa: descartarla en silencio, ya que el estado gana igual). Regla: `partida-guardada.md` §2 dice que el registro sirve «para poder auditar por qué pasó algo», y sin diagnóstico ese propósito no tiene ninguna forma en el código.
- **La clave de una entrada del diario es suceso + fuente** → asumido (alternativa: una entrada nueva cada vez que se oye algo, aunque sea idéntica). Regla: SPEC-012 dice que un núcleo que ya oyó un rumor no lo vuelve a oír y su versión no cambia, así que volver al mismo sitio no aporta nada nuevo; con la fuente en la clave, la versión de un testigo directo entra como entrada aparte, que es lo que el escenario de «Vilanova» exige.
- **El diario guarda el nivel y el signo, y existe una proyección de lectura que no los lleva** → asumido (alternativa: no guardar el nivel en el diario y pedírselo a la capa de rumores al leer). Regla: RF-DIARIO-001 dice que el nivel no sale a pantalla, no que no se guarde, y el enunciado del encargo lo confirma —«viaja en el dato»—; recalcularlo al leer ataría el diario a que la propagación siguiera viva y rompería la reconstrucción desde el registro.
- **La versión oída se guarda como los hechos estructurados de SPEC-012, no como el texto que se leyó** → asumido (alternativa: guardar la prosa). Regla: `quests.md` decisión 1, «si alguna regla bifurca por él, no lo escribe el modelo»; es la misma decisión que SPEC-014 tomó para la memoria del testigo, y sin ella agrupar por suceso exigiría comparar textos.
- **Los textos del narrador que nacen jugando viven una sola vez en un área de textos del estado, referenciados por clave** → asumido (alternativa: copiarlos en cada entrada que los cuenta). Regla: es el mismo trato que SPEC-009 les da dentro del documento de celda —texto en línea, con su clave y su origen `llm` o `plantilla`—, y copiarlos multiplicaría por entradas lo único de la partida que pesa de verdad.
- **Al diario se le añade un tipo de hecho, «la versión oída en un sitio», que la lista de `partida-guardada.md` §2 no nombra** → asumido (alternativa: reconstruir lo oído reproduciendo la propagación desde los pasos). Regla: el escenario «El registro basta para reconstruir» exige recuperar «lo oído», y reproducir la propagación lo haría depender de que las reglas de deformación no hayan cambiado, que es justo lo que la reconstrucción no puede prometer.
- **Un hecho de un tipo desconocido hace fallar la reconstrucción en lugar de saltarse** → asumido (alternativa: ignorarlo y seguir). Regla: es el mismo criterio del esquema cerrado de SPEC-009; saltarse hechos produciría un estado reconstruido incompleto que además se declara correcto, que es peor que no abrir.
- **Los cuatro números del presupuesto de tamaño (500 B, 300 B, 6 MB, 2 MB)** → asumidos (alternativa: no fijar ninguno y medir a posteriori). Regla: la misma que aplicó SPEC-009 con los suyos —convertir el pendiente 1 de `partida-guardada.md` en una medición en lugar de una intuición—, y si al medir resultan estrechos se ajustan por iteración con el dato delante.
- **Si el presupuesto se incumple, se compacta por instantánea y nunca se podan hechos sueltos** → asumido (alternativa: descartar los hechos más antiguos). Regla: podar rompe en silencio la propiedad de que el registro basta para reconstruir, que es la razón de existir de esta capa; compactar la conserva desde el sello, y es de la fila 39.
- **El marcador de «ya se ha triangulado» se reserva en el sobre pero no se especifica aquí** → asumido (alternativa: definir aquí cuándo se enciende). Regla: RF-DIARIO-002 y RF-DIARIO-003 son de la fila 37, con sus pantallas A6P3 y A6P4; reservar el hueco es el patrón de SPEC-009 y evita que esa fila tenga que renegociar el formato del estado.
