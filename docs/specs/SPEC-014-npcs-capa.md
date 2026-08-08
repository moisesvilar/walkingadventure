# SPEC-014 — La capa de NPCs: caras que nacen al necesitarse, memoria fiel y relaciones que se pueden romper

## Descripción

El mundo generado tiene sitios; las personas no. Esta spec entrega la capa que las produce: **cada sitio —un núcleo o uno de sus servicios— tiene una cara titular, y las demás nacen la primera vez que una aventura las necesita**, con una clave que es `semilla + sitio + puesto` y jamás el orden en que se conocieron. Ninguna de esas caras consume un anclaje real: **hereda el del sitio donde trabaja**, que es la enmienda que abarata la capa entera y la que hace que una aldea sin servicios pueda tener cara igualmente.

De ahí salen las tres cosas por las que esta fila existe. La primera es una promesa hacia el casting: **si una plantilla pide un rol humano, el sitio lo produce**; lo que estrecha el casting siguen siendo los lugares, y ningún motivo de fallo habla nunca de falta de gente. La segunda es la mejor pieza de la capa: **el testigo es la única fuente de verdad de un mundo donde todo lo que se cuenta está deformado**. El NPC solo guarda los hechos en los que fue rol, los guarda en versión nivel 0, te los cuenta gratis — y **no corrige lo que se cuenta en el pueblo**, así que se puede saber la verdad y seguir siendo famosa por una mentira. La tercera es la más rara del proyecto: **el trato con una persona concreta baja por lo que haces**, nunca por el tiempo que pasa, y lo roto se puede reparar. En todo lo demás —el rango, los objetos, el mapa, los pasos— un paso solo añade; aquí no, y por eso hay que decirlo en voz alta.

Y sale una restricción de escritura que se afirma aquí y no en el prompt: **el género de cada cara lo asigna la semilla y el reparto se equilibra a propósito, no por azar**. La herrera, la vigía, la tabernera, la cantera: el oficio no arrastra el estereotipo, y lo que no cabe es que el gruñón sea siempre él.

No tiene interfaz de usuario. Las pantallas donde esto se ve son de otras filas: lo que se cuenta al llegar a un núcleo (**A4P5**, fila 32), la escena del beat con la persona delante (fila 34) y la puesta en escena de la primera triangulación (fila 37). Aquí se entrega el dato vivo que todas ellas pintan.

Anclas: **RF-NPC-001**, **RF-NPC-002**, **RF-NPC-003**, **RF-NPC-004** (Should) y **RF-NPC-005** (`docs/prd.md` §4.4), con `game-design/npcs.md` como fuente que manda sobre el PRD y `game-design/lenguaje.md` para el reparto. **RNF-DET-001** y **RNF-DET-003** aplican como invariante bloqueante. Se apoya en SPEC-002 (la disposición del paquete y el área `partida/`), SPEC-005 (el anclaje de uso único con su identificador nativo estable, que aquí se hereda y nunca se consume), SPEC-009 (el mundo congelado, su orden canónico de sitios y el área `partida/`), SPEC-010 (**el casting, que da por hecho que un rol humano nunca aporta motivo de fallo: esta spec es quien cumple esa promesa**) y SPEC-012 (la propagación, sus niveles de deformación y la versión fiel que se conserva, que es contra lo que el testigo **no** corrige).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí la toca en un solo punto y no es un sensor**: la interfaz de los paquetes de idioma gana una función para nombres de persona, con repertorio femenino y masculino equilibrado. Está descrita en «Frontera de inyección».
- **Fuera de alcance, y son seis cosas que parecerían naturales aquí:** el **catálogo de plantillas** con sus roles, sus textos de fallback y **qué actos declara feos o reparadores** (fila 17, RF-QUEST-009 — esta spec entrega el mecanismo de relación, no la taxonomía de actos, que además es pendiente 2 de `npcs.md`); la **redacción** de cualquier cosa que una cara diga, el prompt y el filtro de aptitud (fila 18); el **rango social por núcleo**, su trato, su precio, su mote y **el catálogo de informantes con lo que cobran** (fila 15, RF-PROG-001/002/004 — aquí solo se afirma que al testigo no se le paga); la **propagación de rumores**, sus niveles, su escalera y lo que sedimenta en cada núcleo (fila 12, ya especificada: se consume y no se reabre); el **disparador de franja** y su resolución en el beat (SPEC-010, ya especificada); y **las pantallas** donde una cara aparece, habla o se recuerda (filas 32, 34 y 37). Esta spec entrega **quién es cada cara, qué recuerda y cómo está la relación**, no cómo se cuenta ni cómo se pinta.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La plantilla de puestos», «La cara titular», «La clave no depende del orden», «La memoria del testigo» y «La relación baja por actos»; la **validación de entradas** en el sitio que no existe en el mapa, el puesto fuera de la plantilla, el tipo de sitio sin plantilla declarada, el hecho sin versión fiel y el efecto de relación sin signo; el **estado vacío** en el mapa sin servicios, la aldea con un solo sitio, la cara sin ningún hecho en su memoria y el mapa nuevo sin ninguna relación; el **estado de error** en el paquete de idioma sin repertorio del género pedido, el hecho cuya cara no participó, el efecto de relación sobre una cara de otro mapa y el sitio sin anclaje; y los **casos límite** en el tope de caras por sitio, el tope de memoria desbordado, la relación ya rota que se vuelve a romper, la reparación sobre una relación intacta, las dos caras del mismo sitio pedidas por la misma aventura y la cara despertada dos veces.

«Mundo congelado X» sigue significando el fixture `test/fixtures/osm/X/` de SPEC-001. **«Sitio»** significa siempre un núcleo o uno de sus servicios, que son las dos cosas que tienen anclaje y a las que una persona puede pertenecer. **«Puesto»** significa una entrada de la plantilla cerrada de puestos del tipo de ese sitio, y su clave **no tiene género**. **«Cara»** significa un NPC concreto: un sitio, un puesto y lo que la semilla les asigna. **«Despertar»** significa que una cara pasa a existir en la partida; **«conocer»**, que la jugadora ya ha hablado con ella.

### El sitio y su plantilla de puestos

- **Dado** un mundo congelado, **cuando** se enumeran los sitios de una celda, **entonces** son sus núcleos y sus servicios, y ninguna otra cosa.
- **Dado** un tipo de sitio, **cuando** se pide su plantilla de puestos, **entonces** devuelve una lista cerrada y ordenada cuyo primer elemento es el puesto titular.
- **Dado** una taberna, **cuando** se pide cuántas caras puede llegar a tener, **entonces** es exactamente la longitud de su plantilla de puestos, y ni una más.
- **Dado** una aldea sin ningún servicio, **cuando** se enumeran sus sitios, **entonces** el propio núcleo es un sitio y tiene su plantilla de puestos.
- **Dado** la plantilla de puestos de cualquier tipo de sitio, **cuando** se leen sus claves, **entonces** ninguna nombra un género.

### La cara titular y las caras que despiertan

- **Dado** un mundo congelado recién abierto, **cuando** se consulta un sitio cualquiera, **entonces** su cara titular ya existe, sin haber jugado nada.
- **Dado** una cara titular que la jugadora no ha conocido, **cuando** se pide cómo nombrarla, **entonces** se la nombra por su puesto y su nombre propio no se entrega.
- **Dado** una cara titular con la que la jugadora acaba de hablar por primera vez, **cuando** se vuelve a pedir cómo nombrarla, **entonces** se entrega su nombre propio.
- **Dado** un sitio cuya única cara despierta es la titular, **cuando** una aventura pide otro puesto de ese sitio, **entonces** esa cara despierta y se queda despierta.
- **Dado** una cara ya despierta, **cuando** otra aventura vuelve a pedir el mismo sitio y el mismo puesto, **entonces** se devuelve la misma cara y no nace ninguna nueva.
- **Dado** un sitio con todos los puestos de su plantilla despiertos, **cuando** una aventura pide otro puesto más, **entonces** se resuelve con una de las caras existentes y no se inventa un puesto fuera de la plantilla.
- **Dado** un nombre de cara recién generado, **cuando** se compara con los nombres del mapa, **entonces** es único en todo el mapa.

### La clave no depende del orden

- **Dado** dos partidas sobre el mismo mundo que despiertan las mismas caras en orden distinto, **cuando** se comparan cara a cara, **entonces** son idénticas en nombre, género y puesto.
- **Dado** una cara, **cuando** se inspecciona de qué depende su generación, **entonces** depende de la semilla, del sitio y del puesto, y de nada más.
- **Dado** una cara, **cuando** se busca en su generación un contador de aparición, una fecha o una posición en una lista de conocidos, **entonces** no interviene ninguno.
- **Dado** un sitio, **cuando** se despierta primero su tercer puesto y después el segundo, **entonces** ambas caras son las mismas que si se hubieran despertado al revés.
- **Dado** el mismo mundo y la misma semilla en dos instalaciones distintas, **cuando** se despierta la misma cara, **entonces** sale idéntica.

### El NPC no consume anclaje

- **Dado** una taberna anclada al bar «Casa Manuela», **cuando** se genera la tabernera que trabaja allí, **entonces** la tabernera hereda el anclaje de la taberna.
- **Dado** una taberna anclada al bar «Casa Manuela», **cuando** se genera la tabernera que trabaja allí, **entonces** el número de anclajes tomados no cambia.
- **Dado** un sitio con cuatro caras despiertas, **cuando** se leen sus anclajes, **entonces** las cuatro llevan el mismo identificador nativo, el del sitio.
- **Dado** un mapa con todas sus caras despiertas, **cuando** se recogen los anclajes de núcleos, servicios y parajes, **entonces** ningún identificador aparece más de una vez.
- **Dado** la implementación de esta capa, **cuando** se inspecciona, **entonces** no toma anclajes del pool ni pide anclajes libres.

### El casting no falla por gente

- **Dado** un rol humano ligado a un sitio del mapa, **cuando** se pide resolverlo, **entonces** devuelve siempre una cara.
- **Dado** un rol humano cuyo puesto afín no está en la plantilla de ese tipo de sitio, **cuando** se pide resolverlo, **entonces** devuelve la cara titular del sitio en lugar de fallar.
- **Dado** un mundo en el que todavía no se ha despertado ninguna cara, **cuando** se resuelven roles humanos, **entonces** se resuelven todos.
- **Dado** una aventura que pide dos caras del mismo sitio, **cuando** se resuelven, **entonces** las dos declaran el mismo lugar, para que el casting lo trate como un solo lugar.
- **Dado** la resolución de un rol humano, **cuando** devuelve una cara, **entonces** nunca devuelve vacío ni un motivo de fallo.

### El reparto equilibrado y el género

- **Dado** un mundo sembrado con `"42.40,-8.81#1"`, **cuando** se generan cien NPCs jugando, **entonces** el reparto por género está equilibrado.
- **Dado** un mundo sembrado con `"42.40,-8.81#1"`, **cuando** se generan cien NPCs jugando, **entonces** ningún oficio queda poblado siempre por el mismo género.
- **Dado** el reparto potencial completo de un mapa, **cuando** se cuenta por puesto, **entonces** la diferencia entre géneros dentro de cada puesto no pasa de uno.
- **Dado** un puesto con un número impar de caras en el mapa, **cuando** se reparte el género, **entonces** la que desempata es femenina.
- **Dado** un puesto y su género asignado, **cuando** se compara con la clave del puesto, **entonces** el género no se deduce de ella.
- **Dado** una cara femenina y una masculina del mismo puesto, **cuando** se leen sus datos, **entonces** ninguna de las dos lleva rasgos de carácter derivados del género.

### La memoria del testigo: corta, fiel y gratis

- **Dado** una cara que fue rol en una aventura terminada, **cuando** se cierra la salida, **entonces** ese hecho entra en su memoria.
- **Dado** una cara que no fue rol en una aventura, **cuando** se cierra la salida, **entonces** ese hecho no entra en su memoria.
- **Dado** un hecho en la memoria de una cara, **cuando** se lee, **entonces** está en versión nivel 0.
- **Dado** una cara con hechos en su memoria, **cuando** la jugadora le pregunta, **entonces** los cuenta sin cobrar oro.
- **Dado** una cara con la memoria llena, **cuando** entra un hecho más, **entonces** se olvida el más antiguo por paso del mundo y la memoria sigue en su tope.
- **Dado** una cara sin ningún hecho en su memoria, **cuando** la jugadora le pregunta, **entonces** no cuenta ningún hecho y no falla.
- **Dado** lo que una cara entrega al recordar, **cuando** se inspecciona, **entonces** son hechos estructurados y ningún texto redactado.

### El testigo no corrige al pueblo

- **Dado** un NPC que estuvo presente cuando ocurrió y un rumor deformado circulando por su núcleo, **cuando** la jugadora habla con ese NPC, **entonces** el NPC cuenta la versión fiel.
- **Dado** un NPC que estuvo presente cuando ocurrió y un rumor deformado circulando por su núcleo, **cuando** la jugadora habla con ese NPC, **entonces** lo que se cuenta en el núcleo sigue siendo la versión deformada.
- **Dado** una cara consultada muchas veces, **cuando** se lee lo sedimentado en su núcleo, **entonces** no ha cambiado ni una vez.
- **Dado** un núcleo con una cara testigo, **cuando** un rumor sobre ese mismo hecho llega deformado, **entonces** la memoria de la cara sigue en nivel 0.
- **Dado** una cara y un informante del mismo núcleo, **cuando** los dos cuentan el mismo hecho, **entonces** la cara devuelve la versión fiel y el informante la versión que a él le llegó.

### La relación baja por actos, nunca por el tiempo

- **Dado** una cara recién despertada, **cuando** se consulta su relación, **entonces** está en el escalón de partida.
- **Dado** una relación cualquiera, **cuando** pasan cien pasos del mundo sin que la jugadora haga nada con esa cara, **entonces** la relación no cambia.
- **Dado** un desenlace que declara un acto feo hacia una cara concreta, **cuando** se cierra la salida, **entonces** la relación con esa cara baja un escalón.
- **Dado** un acto feo hacia una cara, **cuando** se consultan las demás caras del mismo sitio, **entonces** ninguna ha cambiado.
- **Dado** una relación ya en el escalón más bajo, **cuando** llega otro acto feo, **entonces** se queda en el más bajo y no falla.
- **Dado** una relación rota, **cuando** se pide una aventura que necesita a esa cara, **entonces** se castea igual: la relación cambia el trato, nunca el catálogo.
- **Dado** el catálogo de mecanismos que esta entrega expone, **cuando** se enumeran los que pueden bajar, **entonces** el único es la relación por cara.

### La reparación

- **Dado** una relación rota, **cuando** llega un acto declarado reparador hacia esa cara, **entonces** sube un escalón.
- **Dado** una relación que llegó a estar rota, **cuando** se repara todo lo posible, **entonces** su techo queda por debajo del escalón más alto y consta la cicatriz.
- **Dado** una relación intacta, **cuando** llega un acto reparador, **entonces** no sube por encima de su techo y no falla.
- **Dado** una relación reparada, **cuando** se consulta, **entonces** no expone ningún número ni porcentaje, solo el escalón.
- **Dado** un mapa nuevo, **cuando** se consultan las relaciones, **entonces** están todas en el escalón de partida y ninguna cicatriz ha viajado.

### Determinismo y estado de partida

- **Dado** el mismo mundo y la misma partida, **cuando** se despiertan las mismas caras dos veces desde cero, **entonces** salen idénticas.
- **Dado** la generación de una cara, **cuando** consume azar, **entonces** sale de `makeRng` con un sufijo propio que incluye el sitio y el puesto.
- **Dado** que se despierta una cara más en un sitio, **cuando** se vuelven a leer las caras ya despiertas de ese sitio, **entonces** ninguna ha cambiado.
- **Dado** una partida con caras despiertas, memorias y relaciones, **cuando** se serializa y se vuelve a cargar, **entonces** vuelven las mismas caras, con la misma memoria y las mismas relaciones.
- **Dado** un mundo congelado, **cuando** se despiertan todas las caras posibles del mapa, **entonces** el documento de cada celda sigue idéntico byte a byte.
- **Dado** los módulos de esta entrega, **cuando** se inspecciona su implementación, **entonces** no aparece `Math.random()`, ni `Date.now()`, ni `new Date()`, ni ninguna iteración cuyo resultado dependa del orden de inserción de un `Set` o un `Map`.
- **Dado** los módulos de esta entrega, **cuando** se inspeccionan sus imports, **entonces** no importan `buildWorld` ni ninguna fase de la generación.
- **Dado** el motor de pasos, **cuando** se enumeran sus productores, **entonces** esta capa no es ninguno de ellos.

### Vacíos, entradas inválidas y errores

- **Dado** un sitio que no existe en el mapa activo, **cuando** se pide una cara suya, **entonces** falla nombrando el sitio.
- **Dado** un puesto que no está en la plantilla de ese tipo de sitio, **cuando** se pide despertarlo, **entonces** falla nombrando el puesto y el tipo de sitio.
- **Dado** un tipo de sitio sin plantilla de puestos declarada, **cuando** se pide una cara suya, **entonces** falla nombrando el tipo, en lugar de suponer una plantilla vacía.
- **Dado** un paquete de idioma sin repertorio para el género pedido, **cuando** se genera el nombre, **entonces** falla nombrando el idioma y el género, en lugar de caer en el otro.
- **Dado** un hecho que se intenta guardar sin su versión fiel, **cuando** entra en la memoria, **entonces** falla nombrando el hecho.
- **Dado** un hecho que se intenta guardar en la memoria de una cara que no participó, **cuando** entra, **entonces** falla nombrando la cara.
- **Dado** un efecto de relación sin signo o con un signo fuera del enumerado, **cuando** se aplica, **entonces** falla nombrando el valor recibido.
- **Dado** un efecto de relación sobre una cara de otro mapa, **cuando** se aplica, **entonces** falla nombrando el mapa, en lugar de crear la relación.
- **Dado** un sitio sin anclaje, **cuando** se despierta una cara suya, **entonces** falla nombrando el sitio, en lugar de dejar la cara sin anclaje.
- **Dado** un cierre de salida en el que la aplicación de memorias y relaciones falla a mitad, **cuando** se lee el estado, **entonces** ni una sola memoria ni una sola relación han cambiado: se aplica entero o no se aplica.
- **Dado** un mapa sin ningún núcleo, **cuando** se enumeran sus sitios, **entonces** la lista está vacía y no falla.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/npcs.js` | la enumeración de sitios, la clave `semilla + sitio + puesto`, la cara titular, el despertar perezoso, la herencia del anclaje y la **resolución de rol humano** que consume SPEC-010 |
| `packages/nucleo/partida/puestos.js` | el catálogo cerrado de plantillas de puestos por tipo de sitio y el reparto estratificado de género sobre el mapa |
| `packages/nucleo/partida/memoria.js` | la memoria por cara, su tope, la entrada de hechos en nivel 0 y la consulta del testigo |
| `packages/nucleo/partida/relacion.js` | la escalera cerrada de relación, los efectos con signo, la cicatriz y la reparación |

Las cuatro viven en `partida/` por la misma razón que las de SPEC-011 y SPEC-012: **una cara es estado de la jugadora sobre un mundo congelado, no parte del mundo**. Las áreas del paquete están fijadas desde SPEC-002 (`core`, `world`, `names`, `quests`, `partida`) y esta entrega no abre ninguna nueva.

### Frontera de inyección

Esta spec toca la frontera del núcleo en **un solo punto**, y conviene decirlo con precisión porque es la primera vez que se amplía la interfaz de los paquetes de idioma desde que se fijó: `es` y `gl` ganan una función de **nombre de persona con género**, con repertorio femenino y masculino equilibrado en cada paquete. Sin ella no hay nombres de cara, y un paquete que no la implemente deja de cumplir la interfaz. Todo lo demás entra como argumento y no se lee de ningún almacén:

- **Los sitios del mundo congelado**, con su tipo, su nombre, su anclaje y el **orden canónico** que SPEC-009 ya fija. De ahí sale el orden sobre el que se estratifica el género; esta entrega no lo inventa ni lo reordena.
- **El catálogo de tipos de sitio**: los cuatro tipos de núcleo y los seis de servicio que ya produce la generación (`posada`, `taberna`, `boticario`, `armeria`, `conjureria`, `mercado`). Si la generación añade un tipo, su plantilla de puestos se declara con él o esta capa falla nombrándolo, que es lo que impide que un tipo nuevo aparezca sin caras y sin que nadie se entere.
- **El desenlace de una aventura terminada**, con qué caras fueron rol, el hecho en su versión fiel y los **efectos de relación declarados por la plantilla**. Sale de SPEC-010 y de la fila 17. Mientras el catálogo de la fila 17 no exista, sirve la declaración de las seis plantillas ya portadas, y un desenlace sin declaración de efectos simplemente no mueve ninguna relación.
- **El rol humano abstracto** que pide una plantilla, con el sitio ya asignado por el casting. Esta capa lo traduce a un puesto de la plantilla del sitio y devuelve una cara; **no elige el sitio**, que es del casting.

Hacia fuera entrega cuatro cosas y solo cuatro: la **resolución de rol humano**, la **cara** con su puesto, su género, su anclaje heredado y cómo nombrarla, la **consulta del testigo** y la **consulta de relación por cara**. No entrega ni un texto destinado a mostrarse, ni ninguna consulta que devuelva el estado de todas las relaciones del mapa — por el mismo argumento con el que SPEC-012 no expone el mapa entero: lo que no sale del núcleo no se puede pintar por descuido, y el design system prohíbe cualquier medidor.

### Qué es del mundo, qué es función y qué es estado de partida

Es la distinción que hace barata la capa y conviene tenerla escrita, porque las tres cosas se parecen:

- **Del mundo congelado** son los sitios, su tipo y su anclaje. Eso ya está y no crece: ninguna cara entra en el documento de celda, ni siquiera la titular.
- **Función pura de la semilla** son la identidad de cada cara —su puesto, su género y su nombre— y la plantilla de puestos de su tipo de sitio. Se calculan cuando hacen falta y siempre dan lo mismo; por eso la cara titular «existe desde el día 1» sin ocupar un byte.
- **Estado de partida** son tres listas cortas: **qué caras están despiertas**, **qué caras se han conocido** (que es lo que decide si su nombre se entrega o se la nombra por su puesto), y por cara, **su memoria** y **su relación**. Nada de esto viaja entre mapas.

Consecuencia práctica que hay que respetar al implementar: despertar una cara **no** es crear un objeto con datos nuevos, es apuntar una clave. Si el despertar generase algo que no fuera derivable de `semilla + sitio + puesto`, el criterio del orden dejaría de cumplirse el día que alguien reordene la lista.

### La plantilla de puestos, y el tope que resuelve

El catálogo por defecto es cerrado, ordenado, y su primer elemento es el titular. Las claves son de puesto y **no llevan género**, que es lo que impide que el reparto se cuele por la puerta de atrás:

| Tipo de sitio | Puestos, en orden |
| --- | --- |
| núcleo (`ciudad`, `pueblo`, `aldea`, `granja`) | `regencia` · `vigilancia` · `vecindad` |
| `taberna` | `regencia` · `cocina` · `sala` |
| `posada` | `regencia` · `cuadra` · `limpieza` |
| `boticario` | `regencia` · `aprendizaje` |
| `armeria` | `regencia` · `aprendizaje` |
| `conjureria` | `regencia` · `aprendizaje` |
| `mercado` | `regencia` · `acarreo` |

Eso responde de paso al pendiente 3 de `npcs.md` —**sí hay tope de caras por sitio**, y es la longitud de su plantilla— sin necesidad de un número aparte: una posada muy jugada acaba con tres personas, no con ocho, y las tres se recuerdan. Que el tope salga de la plantilla y no de una constante es lo que evita el caso feo de una lista con hueco y ningún puesto que ponerle dentro.

### El equilibrio: sobre qué se mide, y por qué así

`lenguaje.md` deja abierto en su pendiente 3 si el equilibrio del reparto se mide **por mundo** o **por partida**. Aquí se elige **por mundo**, y con una definición que se puede afirmar sin jugar: sobre el **reparto potencial completo del mapa** —todos los sitios por todos los puestos de su plantilla, en el orden canónico de SPEC-009— el género se asigna **estratificado por puesto**, de modo que dentro de cada puesto la diferencia entre géneros no pasa de uno y, cuando el número es impar, la que desempata es femenina.

Las tres razones, en orden de peso:

1. **Es lo único automatizable.** `docs/testing.md` ya reparte así el trabajo: «El reparto de NPCs se equilibra por generación» es `@nucleo`, y «El reparto de NPCs se percibe equilibrado a lo largo de una partida» es `@manual`, con su justificación escrita en «Por qué esos van a mano». Elegir «por partida» dejaría el requisito sin ninguna prueba automática.
2. **Estratificar por puesto es más fuerte que equilibrar el total**, y es lo que de verdad pide `lenguaje.md`: un mapa con el total cuadrado y todas las tabernas regentadas por hombres cumpliría «equilibrado» y fallaría «ningún oficio queda poblado siempre por el mismo género». Con la diferencia acotada a uno **dentro de cada puesto**, cualquier puesto con dos caras o más tiene los dos géneros por construcción.
3. **Arrastra la percepción de la partida sin prometerla.** Una partida despierta un subconjunto del reparto potencial, y ningún subconjunto arbitrario puede garantizarse equilibrado; pero un reparto estratificado por puesto hace que cualquier muestra que recorra los sitios en orden canónico salga equilibrada, y que el caso que el jugador nota —el oficio monocolor— sea imposible en el mapa entero. Lo que queda es percepción, y su sitio es la revisión humana.

El sesgo femenino del desempate es la aplicación literal de la regla de fondo de `lenguaje.md`: donde el castellano obliga a elegir sin motivo, femenino.

### La memoria, su tope y por qué es de hechos y no de prosa

La memoria guarda **hechos estructurados en nivel 0**, con el eje de SPEC-012 intacto: los mismos ejes cerrados que la deformación transforma, sin transformar. Guardar prosa haría imposible el criterio de que el testigo es fiel sin un LLM delante, que es exactamente lo que la batería `@nucleo` no puede hacer; y `quests.md` decisión 1 ya lo zanja: si alguna regla bifurca por un dato, no lo escribe el modelo.

El tope es de **cinco hechos por cara**, y al desbordar se olvida el más antiguo por paso del mundo. Cinco es «corta» en el sentido del diseño —lo que se puede recordar y volver a preguntar— y encaja con el tamaño del reparto: nueve personas en un mundo de paseo, con lo suyo cada una. Que el desalojo sea por paso del mundo y no por orden de llegada es lo que lo hace independiente del orden en que se cerraron las salidas.

Y la pieza que hace que triangular tenga sentido: **la memoria no se actualiza nunca con lo que circula**. Un rumor deformado que llega al núcleo de una cara testigo no toca su memoria, y consultar a la cara no toca lo sedimentado en el núcleo. Las dos direcciones están cerradas a propósito, porque abrir cualquiera de las dos curaría el sistema de deformación y lo mataría.

### La escalera de relación, la cicatriz y el único mecanismo que baja

La relación es un **enumerado cerrado y ordinal de cuatro escalones**: `rota` < `tirante` < `cordial` < `cercana`. Toda cara nace en `cordial`, que es el trato normal de quien no te debe nada ni te ha cogido manía. Un acto feo declarado baja un escalón y nunca por debajo de `rota`; un acto reparador declarado sube uno. La primera reparación de una relación rota alcanza `tirante`, que es literalmente el «poder sentarse» del diseño.

La **cicatriz** es lo que sostiene el «no al punto de partida»: una relación que llegó a `rota` queda marcada, y su techo pasa a ser `cordial` para siempre — nunca `cercana`. Así la decisión pesa sin que la pérdida sea definitiva, que es el equilibrio que pide `npcs.md` §4 para un reparto de nueve personas.

Dos límites que no se negocian, y los dos salen de documentos que mandan:

- **La relación cambia el trato, nunca el catálogo.** Una cara rota sigue casteando; si no lo hiciera, el casting empezaría a fallar por gente y RF-NPC-002 se caería. Es la misma forma que RF-PROG-002 le da al rango.
- **No baja por el tiempo.** Ningún paso del mundo mueve una relación, y por eso esta capa **no se registra como productor de paso** en el motor de SPEC-011: la ausencia del registro es la prueba estructural de que `quests.md` decisión 4 —«un paso… nunca retira un NPC ni resta reputación por no haber salido»— sigue en pie.

Que este sea el único mecanismo del proyecto que puede ir hacia abajo es un dato de diseño, no una casualidad, y conviene que la implementación lo deje visible: es el único sitio donde un efecto tiene signo negativo.

### Lo que consume de otras specs y no respecifica

- **SPEC-005** entrega el anclaje de uso único con su identificador nativo (`osm:node/123456`, `places:ChIJ...`) y el mecanismo de toma. Aquí no se toma nada: **heredar no es consumir**, y el escenario «Un NPC no consume anclaje propio» es precisamente esa diferencia.
- **SPEC-009** entrega el mundo congelado, su orden canónico y la regla de que el documento de celda describe el mundo y no crece al andar. Ninguna cara entra ahí.
- **SPEC-010** entrega el casting, el catálogo cerrado de motivos de fallo —del que ya afirma que ninguno habla de falta de gente— y la regla de que dos roles no caen en el mismo lugar. Esta spec no reabre ninguna: **cumple** la primera con la resolución de rol humano, y alimenta la segunda declarando el sitio como lugar de la cara.
- **SPEC-011** entrega el contador de pasos y su catálogo de efectos. Esta capa no se registra en él, y eso es una decisión, no un olvido.
- **SPEC-012** entrega la propagación, la escalera de cuatro niveles, lo que sedimenta por núcleo y la conservación de la versión fiel. La memoria del testigo **consume** esa versión fiel; no la recalcula, no la corrige y no la borra.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Se referencian por su nombre literal, no se duplican: la batería se escribió antes que el código y sus nombres son el contrato con `wa-qa-dev`.

- De **«Los anclajes reales son de uso único»** (`@nucleo @determinismo @casting`): «Un NPC no consume anclaje propio», que es el escenario propio de RF-NPC-001, y «Ningún anclaje aparece dos veces», que esta capa tiene que seguir cumpliendo con el mapa entero poblado.
- De **«El diario registra lo oído, no lo cierto»**: «El testigo directo es fiel y no corrige al pueblo», que es el escenario propio de RF-NPC-003 y el único sitio de la batería donde las dos direcciones —fiel hacia la jugadora, deformada hacia el pueblo— se afirman a la vez.
- De **«El lenguaje es inclusivo y el sesgo va hacia el femenino»** (`@nucleo @lenguaje`): «El reparto de NPCs se equilibra por generación», con sus dos aserciones, que esta spec convierte en propiedad de la función de género y no en estadística de una tirada.
- De **«Una quest se castea contra el mundo o no se ofrece»**: los criterios de SPEC-010 sobre roles humanos se sostienen sobre la resolución que entrega esta spec; el escenario de casting no se duplica aquí.
- De **«Lo generado no se resiembra jamás»**: despertar caras es, junto con los pasos y la propagación, lo más fácil de romper de esa característica; el documento de celda tiene que seguir idéntico byte a byte con todas las caras del mapa despiertas.
- De **«La partida se guarda entera y se recupera entera»**: «se recuperan los rangos, lo oído, la repisa y los NPCs conocidos», que es lo que obliga a que las caras conocidas, sus memorias y sus relaciones sean estado serializable de partida.
- **Frontera, que esta spec deja preparada y no implementa:** «El reparto de NPCs se percibe equilibrado a lo largo de una partida» (`@manual`, y va a mano a propósito), lo que una cara dice al recordarlo (fila 18), el precio del informante y el trato por rango (fila 15), y las pantallas de las filas 32, 34 y 37.

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería, no de esta spec, y `wa-qa-dev` tendrá que marcarlos como casos sin escenario de respaldo en lugar de inventarse uno. Los dos primeros son los que el PRD ya marca con **⚠ sin escenario**:

- **Nada verifica RF-NPC-002.** No hay ni un escenario que diga que el casting no falla por gente. El de SPEC-010 lo afirma desde el lado del casting; desde el lado de las personas, la batería está muda.
- **Nada verifica la relación ni la reparación (RF-NPC-004).** Ni que baje por un acto, ni que no baje por el tiempo, ni que se pueda reparar, ni que la cicatriz exista. Es el requisito peor cubierto de los cinco, y es el único que puede quitar algo al jugador.
- **Nada afirma que la clave no depende del orden.** Es la invariante más importante de RF-NPC-001 y la más fácil de romper al implementar el despertar perezoso, y ningún escenario la nombra.
- **Nada dice qué pasa cuando se piden dos caras del mismo sitio.** Es el pendiente 1 de `npcs.md` y afecta directamente al casting; sin escenario, la decisión se puede perder al implementar.
- **Nada fija el tope de caras por sitio ni el de la memoria.** Ambos son números y ambos son afirmables; hoy no hay escenario para ninguno.
- **Nada afirma que la cara titular existe desde el principio.** El escenario del anclaje da por hecho que la tabernera se genera, pero ninguno dice que ya estaba antes de jugar nada.
- **Nada verifica que la memoria no se contamina con lo que circula.** «El testigo directo es fiel y no corrige al pueblo» cubre la dirección de salida; la de entrada —un rumor deformado que llega y no toca la memoria— no la cubre nadie.

## Decisiones asumidas

- **El equilibrio del reparto se mide por mundo, estratificado por puesto sobre el reparto potencial del mapa** → asumido (alternativa: medirlo por partida, que es lo que el jugador percibe). Regla: `lenguaje.md` pendiente 3 lo deja abierto y `docs/testing.md` ya lo reparte —`@nucleo` por generación, `@manual` por partida—; estratificar por puesto es además lo único que hace imposible el oficio monocolor, que es la mitad del requisito que un total cuadrado no cubre.
- **El desempate del género impar es femenino** → asumido (alternativa: alternar el desempate por semilla). Regla: `lenguaje.md`, «donde el castellano obliga a elegir sin motivo, el sesgo va hacia el femenino»; es la misma decisión que hace llegar el personaje en femenino.
- **Dos caras del mismo sitio son el mismo lugar para el casting** → asumido (alternativa: tratarlas como lugares distintos, ya que son personas distintas). Regla: es la propuesta que `npcs.md` pendiente 1 deja escrita y que el PRD §7 recoge como «propuesta: sí»; una aventura que te manda dos veces al mismo portal no es una aventura, y las caras de una posada comparten coordenadas exactas.
- **Sí hay tope de caras por sitio, y es la longitud de su plantilla de puestos** → asumido (alternativa: sin tope, o un número global). Regla: `npcs.md` pendiente 3 y §1 — «que te reconozcan solo significa algo si el reparto se puede recordar»; derivarlo de la plantilla evita el caso de un hueco sin puesto que ponerle dentro.
- **La plantilla de puestos por tipo de sitio es la tabla de «La plantilla de puestos»** → asumido (alternativa: que la declare el catálogo de plantillas de la fila 17). Regla: los tipos de sitio ya existen en la generación portada y la capa no puede depender de una fila posterior para dar la cara titular del día 1; si la fila 17 quiere otros puestos, se itera esta spec.
- **Las claves de puesto no llevan género** → asumido (alternativa: nombrarlas como el oficio en su forma habitual, «tabernera», «mozo de cuadra»). Regla: `lenguaje.md`, «el oficio no arrastra el estereotipo»; con la clave marcada, el reparto se cuela por la puerta de atrás y el criterio de que el género no se deduce del puesto deja de ser verificable.
- **La cara titular tiene nombre desde el día 1, pero no se entrega hasta conocerla** → asumido (alternativa: generar el nombre en el momento de conocerla). Regla: `npcs.md` pendiente 4 pide simetría con `personaje.md`, «el mundo no te llama por tu nombre hasta conocerte»; generar el nombre al conocerla metería el orden de la partida en una clave que RF-NPC-001 exige que solo dependa de la semilla, del sitio y del puesto.
- **Un rol humano cuyo puesto afín no está en la plantilla se resuelve con la cara titular** → asumido (alternativa: crear un puesto nuevo, o devolver un motivo de fallo). Regla: RF-NPC-002 es categórico —«si una plantilla pide un artesano, el sitio lo produce»— y crear puestos fuera de la plantilla rompería el tope y el reparto estratificado a la vez.
- **La memoria guarda cinco hechos por cara y desaloja el más antiguo por paso del mundo** → asumido (alternativa: sin tope, o desalojo por orden de llegada). Regla: `npcs.md` §2 pide memoria «corta y por hechos»; el desalojo por paso del mundo es lo único que la hace independiente del orden en que se cerraron las salidas, que es la misma paranoia que rige la clave de generación.
- **La memoria guarda hechos estructurados, no prosa** → asumido (alternativa: guardar el texto que se le contó a la jugadora). Regla: `quests.md` decisión 1, «si alguna regla bifurca por él, no lo escribe el modelo»; sin datos estructurados, «El testigo directo es fiel» solo se podría comprobar con un LLM delante.
- **La escalera de relación es un enumerado cerrado y ordinal de cuatro escalones, con partida en `cordial`** → asumido (alternativa: un número con signo, o tres escalones como el rango). Regla: el design system prohíbe cualquier medidor y `progresion.md` fija que el rango se dice con una frase; cuatro escalones son los mínimos para tener partida, dos caídas y un escalón alto que la cicatriz pueda cerrar.
- **La cicatriz es permanente y baja el techo a `cordial`** → asumido (alternativa: que se levante tras varias reparaciones, o que no exista). Regla: `npcs.md` §4, «se vuelve, no al punto de partida, pero sí a poder sentarse»; sin techo permanente la reparación borraría el acto, y con techo en `tirante` la relación quedaría inservible, que en un reparto de nueve es la pérdida desproporcionada que el documento descarta.
- **La relación cambia el trato y el precio, nunca el catálogo: una cara rota sigue casteando** → asumido (alternativa: que una cara rota deje de dar aventuras). Regla: RF-NPC-002 y RF-PROG-002; si la relación cerrase el catálogo, el casting empezaría a fallar por gente por la puerta de atrás.
- **La taxonomía de qué actos rompen y cuáles reparan no se define aquí: llega declarada por la plantilla** → asumido (alternativa: fijar una lista de actos feos en esta spec). Regla: es el pendiente 2 de `npcs.md` y no está resuelto en `game-design/`; inventar producto en una spec está prohibido, y el sitio natural de la declaración es RF-QUEST-009, que ya lleva «declaración de rumor» y «mote candidato» por el mismo camino.
- **Esta capa no se registra como productor de paso** → asumido (alternativa: registrarse y no producir efectos, por simetría con SPEC-012). Regla: `quests.md` decisión 4 prohíbe que un paso retire un NPC o reste nada por no haber salido; no estar registrado es la prueba estructural, y una prueba estructural es más barata de sostener que un criterio sobre un efecto vacío.
- **La interfaz de los paquetes de idioma gana una función de nombre de persona con género** → asumido (alternativa: derivar los nombres de personas del repertorio de `townName` o de una lista propia de esta capa). Regla: `lenguaje.md` dice que `names/` «pasa a necesitar repertorio femenino y masculino equilibrado en cada paquete», y CLAUDE.md fija que añadir un idioma es implementar la interfaz completa: dejar los nombres de persona fuera haría que un idioma nuevo naciera sin caras.
- **Un paquete de idioma sin repertorio del género pedido falla, en vez de caer en el otro** → asumido (alternativa: degradar al repertorio disponible). Regla: el equilibrio del reparto es un requisito Must y una degradación silenciosa lo rompería sin que ninguna prueba lo viera; fallar nombrando el idioma y el género es lo que convierte un idioma incompleto en un error visible.
- **Las caras, sus memorias y sus relaciones no viajan entre mapas** → asumido (alternativa: un solo reparto para toda la partida). Regla: RF-PROG-003 y «El rango no viaja entre mapas»; las caras cuelgan de sitios de un mapa concreto, y dos mapas no comparten sitios.
- **No existe ninguna consulta que devuelva el estado de todas las relaciones del mapa** → asumido (alternativa: exponerlo y confiar en que nadie lo pinte). Regla: design system, «ningún panel del estado del mundo», «ningún medidor de reputación»; es el mismo argumento con el que SPEC-011 no expone el contador y SPEC-012 no expone el mapa entero.
