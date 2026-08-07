# SPEC-010 — El casting de aventuras contra el mundo

## Descripción

Una aventura no se escribe sobre lugares concretos: se escribe como plantilla con roles abstractos —«una taberna», «un paraje desde el que se vigila», «quien atiende la forja»— y alguien tiene que resolver esos roles contra el mundo que de verdad hay debajo del jugador. Eso es el casting, y es el corazón jugable del proyecto: es lo que convierte un catálogo de seis (o de treinta) plantillas escritas a mano en las aventuras concretas de este barrio, con estos sitios, a estas distancias.

Esta spec entrega el motor que resuelve el reparto con la semilla, comprueba que lo que sale se puede andar —beats dentro del tamaño declarado, ningún trecho de más de media hora al ritmo de quien camina, lazo que empieza y termina cerca del punto de partida— y monta la cadena lineal de beats con su lugar, su disparador, su escena y su resultado. Y entrega la otra mitad, la que se olvida: **la plantilla que no castea no se ofrece, y el motivo queda explicado como dato estructurado**, porque ese motivo alimenta el informe de salud del generador, que es una de las pocas cosas que este proyecto sí mide.

Dos reglas la atraviesan y son fáciles de romper sin darse cuenta. **El casting no mira lo descubierto**: lo que el jugador ha pisado afecta a lo que ve, jamás a lo que existe ni a lo que castea, porque si una aventura solo pudiera usar sitios ya visitados los primeros días no habría juego, que es justo cuando el mundo menos castea. Y **fallar por no llegar es casi imposible**: no hay tiempos límite, las franjas ambientan pero no cancelan, y se falla por decisiones y no por piernas.

No tiene interfaz de usuario. La lista de aventuras y su ficha las pinta la fila 28 (`portada-antes-de-salir`, nodo `A2P3`), el mapa en marcha con el destino marcado lo pinta la fila 29 (`en-marcha-mapa-avisos`, nodo **`A3P2`** de `docs/flujo.md`, que es lo que ancla RF-QUEST-005) y la escena de cada beat, la fila 34 (`escena-beat`). Aquí se entrega el dato que las tres consumen.

Anclas: **RF-QUEST-001**, **RF-QUEST-002**, **RF-QUEST-003**, **RF-QUEST-004**, **RF-QUEST-005** y **RF-QUEST-015** (`docs/prd.md` §4.2), con **RNF-DET-002** (§5.1) como invariante —con LLM y sin LLM, la misma estructura— y **RNF-DET-001** y **RNF-DET-003** como los bloqueantes de siempre. La fuente que manda sobre el PRD es `game-design/quests.md`: §2 (beats y disparadores), §3 (presupuesto, tamaños, lazo), §7 (plantilla y casting) y la decisión 2 (guiado por nombres), más `game-design/bucle-jugable.md` §3 (el tamaño se declara con una palabra, no se rellena un formulario).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la hay**, y son varias: el catálogo, el tramo del jugador, el punto de partida y el grafo entran inyectados.
- **Fuera de alcance, y conviene leerlo antes de empezar:** ninguna pantalla y ninguna redacción. En concreto, **no** entran aquí el catálogo de 20-30 plantillas ni la afinidad de oficio que lo filtra (fila 17, `catalogo-plantillas`, RF-QUEST-009); el contrato con el LLM y la vestidura de los textos (fila 18, RF-QUEST-006/007/008); el tope de tres aventuras ofrecidas y la oferta del estirón (fila 28, RF-QUEST-011 y RF-QUEST-012); el cierre en corto y su desenlace de repuesto (fila 36, RF-QUEST-013); la regla de que la primera aventura pase por dos núcleos con versiones distintas (fila 13, RF-QUEST-014); los micro-encuentros y su cola, con su lugar diferido (fila 19, RF-QUEST-010); la validación de llegada por geofence (fila 32); la capa de NPCs (fila 14); y el sistema de objetos (fila 15). Esta spec entrega el reparto, la cadena de beats y el motivo del fallo, y nada más.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces` como el resto de la batería. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El reparto», «El presupuesto sale del tamaño declarado» y «La cadena de beats»; la **validación de entradas**, en la plantilla mal formada, el tipo de rol desconocido y el tamaño que no existe; el **estado vacío**, en el mundo sin reparto, el catálogo vacío y el mundo mínimo de 250 m; el **estado de error**, en el tramo del jugador ausente, el punto de partida ausente, el motivo fuera del catálogo y la pareja de beats sin ruta en el grafo; y los **casos límite**, en el trecho exactamente en el tope, la plantilla cuyo lazo no cierra, la franja que cae fuera del horario diurno y el beat `con_objeto` sin salida alternativa.

### El casting no mira lo descubierto

- **Dado** un mismo mundo y dos estados de conocimiento —uno sin nada descubierto y otro con todo descubierto—, **cuando** se castea el catálogo con cada uno, **entonces** salen las mismas plantillas con el mismo reparto.
- **Dado** el motor de casting, **cuando** se inspecciona lo que recibe, **entonces** el estado de conocimiento del mapa no está entre sus entradas.
- **Dado** el motor de casting, **cuando** se inspecciona su implementación, **entonces** no consulta el nivel de conocimiento de ningún elemento del mundo en ningún punto.
- **Dado** un jugador que no ha pisado ningún paraje, **cuando** se castea una plantilla que pide un paraje, **entonces** los parajes sin pisar son candidatos igual que los demás.
- **Dado** una aventura casteada sobre lugares no visitados, **cuando** se leen sus beats, **entonces** cada lugar trae su nombre propio, porque a un sitio al que te mandan te lo nombran aunque no hayas ido.

### El reparto: resolver los roles contra el mundo

- **Dado** una plantilla y un mundo, **cuando** castea, **entonces** cada uno de sus roles queda asignado a un lugar concreto del mundo que cumple el requisito del rol.
- **Dado** un rol de tipo servicio, **cuando** se buscan sus candidatos, **entonces** son los servicios del mundo del tipo pedido, con su núcleo anotado.
- **Dado** un rol de tipo núcleo, **cuando** se buscan sus candidatos, **entonces** son los núcleos cuyo tipo está entre los pedidos.
- **Dado** un rol de tipo paraje con una escena, **cuando** se buscan sus candidatos, **entonces** son los parajes cuyo peso para esa escena alcanza el mínimo que el rol pide.
- **Dado** un rol de paraje que admite escenas alternativas, **cuando** se resuelve, **entonces** basta con que el lugar cubra una de ellas, y la aventura casteada anota cuál se usó.
- **Dado** dos roles distintos de una misma plantilla, **cuando** se resuelven, **entonces** no caen en el mismo lugar.
- **Dado** una plantilla cuyo primer y último beat comparten rol, **cuando** castea, **entonces** los dos beats caen en el mismo lugar.
- **Dado** una plantilla sin ningún candidato para uno de sus roles, **cuando** se castea, **entonces** no se ofrece.
- **Dado** un mundo con candidatos de sobra para todos los roles, **cuando** ninguna combinación cumple el presupuesto, **entonces** la plantilla tampoco se ofrece, y el motivo distingue ese caso del de no tener candidatos.
- **Dado** el catálogo completo, **cuando** se castea, **entonces** el resultado incluye una entrada por plantilla, casteen o no, y ninguna se omite de la lista.

### El motivo del fallo es un dato, no una frase

- **Dado** una plantilla que no castea, **cuando** se lee su resultado, **entonces** trae un motivo cuya clave pertenece a un catálogo cerrado y enumerable.
- **Dado** un motivo de fallo, **cuando** se lee, **entonces** nombra el rol que no se pudo resolver y el requisito que ese rol pedía.
- **Dado** un motivo de fallo, **cuando** se lee, **entonces** su clave no es un texto redactado y no cambia con el idioma del mundo.
- **Dado** el catálogo de motivos, **cuando** se enumera, **entonces** cubre al menos: sin candidatos para un rol, trecho fuera del tope, recorrido total fuera del tamaño declarado, número de beats fuera del tamaño declarado, lazo que no cierra y franja incompatible con el horario diurno.
- **Dado** un fallo cuya causa no está en el catálogo de motivos, **cuando** se va a entregar, **entonces** la entrega falla nombrando la causa desconocida, en vez de devolver una clave genérica que enmascare el caso.
- **Dado** el casteo del catálogo sobre muchos mundos, **cuando** se agregan los fallos por clave para el histograma, **entonces** el recuento sale sin parsear ninguna frase.
- **Dado** un motivo de fallo por trechos, **cuando** se lee, **entonces** nombra los dos roles cuyo trecho no casó.
- **Dado** una plantilla que sí castea, **cuando** se lee su resultado, **entonces** no trae ningún motivo.

### El presupuesto sale del tamaño declarado

- **Dado** una plantilla que declara su tamaño, **cuando** castea, **entonces** el número de beats está dentro del rango de ese tamaño: paseo entre 4 y 6, aventura entre 6 y 10, jornada entre 10 y 14.
- **Dado** esos rangos, **cuando** se leen, **entonces** salen del módulo de tamaños de salida y no hay ninguna cifra de beats escrita a mano en el casting.
- **Dado** dos beats consecutivos, **cuando** se mide el trecho entre ellos, **entonces** se mide sobre el grafo de calzadas ya cosido y filtrado, y no en línea recta con un factor de rodeo.
- **Dado** un trecho entre dos beats consecutivos que supera un tramo del jugador, **cuando** se castea, **entonces** ese reparto se descarta.
- **Dado** un trecho exactamente igual a un tramo del jugador, **cuando** se castea, **entonces** se acepta, porque el tope es media hora andando y no menos de media hora.
- **Dado** dos jugadores con tramos distintos, **cuando** castean la misma plantilla en el mismo mundo, **entonces** ninguno recibe un trecho de más de media hora a su propio ritmo.
- **Dado** un trecho por debajo del mínimo, **cuando** se castea, **entonces** ese reparto se descarta, para que dos beats no caigan pegados.
- **Dado** un reparto cuyo recorrido total supera el alcance del tamaño declarado, **cuando** se castea, **entonces** se descarta.
- **Dado** el casting, **cuando** se inspecciona, **entonces** no contiene ningún ritmo en metros por minuto ni ninguna distancia en metros escrita a mano: los topes se expresan en tramos del jugador.
- **Dado** una aventura casteada, **cuando** se lee su presupuesto, **entonces** viene en tramos, y los metros del recorrido son el dato del trazado y no la unidad del tope.
- **Dado** una aventura casteada, **cuando** se lee su tamaño, **entonces** es el que declaró la plantilla y no uno deducido de lo que salió al medir.

### El lazo empieza y termina cerca del punto de partida

- **Dado** un casteo, **cuando** se pide, **entonces** recibe el punto de partida del jugador entre sus entradas.
- **Dado** una aventura casteada, **cuando** se mide el trecho entre el punto de partida y el primer beat, **entonces** no supera medio tramo del jugador.
- **Dado** una aventura casteada, **cuando** se mide el trecho entre el último beat y el punto de partida, **entonces** no supera medio tramo del jugador.
- **Dado** el recorrido total de una aventura casteada, **cuando** se calcula, **entonces** incluye la ida desde el punto de partida y la vuelta a él.
- **Dado** una plantilla cuyo último beat no puede caer cerca del punto de partida en este mundo, **cuando** se castea, **entonces** no se ofrece, con el motivo de lazo que no cierra.
- **Dado** un motivo de lazo que no cierra, **cuando** se lee, **entonces** nombra el rol del beat que quedó lejos, para que se pueda distinguir si lo que falla es la plantilla o el mundo.
- **Dado** todas las plantillas que castean en un mundo, **cuando** se leen sus lazos, **entonces** todas empiezan y terminan cerca del punto de partida, sin excepciones por tamaño.

### La cadena de beats: lugar, disparador, escena, resultado

- **Dado** una aventura casteada, **cuando** se leen sus beats, **entonces** forman una cadena lineal, sin bifurcaciones ni beats sin encadenar.
- **Dado** un beat, **cuando** se lee, **entonces** trae lugar, disparador, escena y resultado, y ninguno de los cuatro falta.
- **Dado** el lugar de un beat, **cuando** se lee, **entonces** es una referencia a una localización del mundo con nombre propio y anclaje real, nunca unas coordenadas sueltas.
- **Dado** el disparador de un beat, **cuando** se lee, **entonces** su tipo es exactamente uno de `llegada`, `franja` o `con_objeto`.
- **Dado** una plantilla con un tipo de disparador que no está en esos tres, **cuando** se castea, **entonces** falla nombrando el tipo recibido y enumerando los válidos.
- **Dado** un beat resuelto sobre un paraje, **cuando** se lee su escena, **entonces** está entre las que ese lugar cubre con peso suficiente, y la afinidad usada queda anotada.
- **Dado** el resultado de un beat, **cuando** se lee, **entonces** es de tipo información, objeto o cambio de estado.
- **Dado** un beat que no es el último, **cuando** se lee su resultado, **entonces** apunta al beat siguiente de la cadena.
- **Dado** el último beat, **cuando** se lee su resultado, **entonces** no apunta a ningún beat siguiente.
- **Dado** un beat con disparador `con_objeto`, **cuando** se lee, **entonces** declara otra manera de resolver ese mismo beat sin llevar el objeto.
- **Dado** una plantilla cuyo beat `con_objeto` no declara esa otra manera, **cuando** se castea, **entonces** no se ofrece, porque un objeto es una llave y no un requisito.

### Las franjas no cancelan nada

- **Dado** un beat con disparador de franja, **cuando** se lee, **entonces** la franja es propiedad del beat y no de ninguna persona del reparto.
- **Dado** un beat con franja, **cuando** el jugador llega fuera de ella, **entonces** el beat se resuelve igual.
- **Dado** ese mismo beat, **cuando** el jugador llega fuera de la franja, **entonces** el resultado que empuja al siguiente beat es el mismo que llegando dentro.
- **Dado** un beat con franja, **cuando** el jugador llega dentro de ella, **entonces** lo que cambia es la variante de escena y nunca el resultado.
- **Dado** el horario diurno activo, **cuando** se castea una plantilla con una franja que cae fuera de él, **entonces** no se ofrece, con el motivo de franja incompatible.
- **Dado** el horario diurno activo, **cuando** se lee cualquier franja de una aventura casteada, **entonces** cae entera dentro de él.
- **Dado** el horario diurno desactivado, **cuando** se castea esa misma plantilla, **entonces** castea con su franja intacta.

### Fallar por no llegar es casi imposible

- **Dado** una aventura casteada, **cuando** se buscan tiempos límite en cualquiera de sus beats, **entonces** no hay ninguno.
- **Dado** una aventura aceptada, **cuando** el jugador tarda el triple de lo previsto en llegar a cada beat, **entonces** ningún beat se pierde por tiempo.
- **Dado** una aventura casteada, **cuando** se inspeccionan sus beats, **entonces** ninguno lleva fecha ni hora del reloj real.
- **Dado** una aventura casteada, **cuando** se busca alguna condición que la dé por fallida sin una decisión del jugador, **entonces** no existe ninguna.
- **Dado** una aventura casteada, **cuando** se lee su estimación de tiempo, **entonces** es informativa y ninguna regla bifurca por ella.

### El guiado por nombres y la marca en el mapa

- **Dado** un beat, **cuando** se lee su guiado, **entonces** nombra el lugar de destino con su nombre propio del mundo.
- **Dado** un beat cuyo trecho recorre calzadas con nombre, **cuando** se lee su guiado, **entonces** trae los nombres de esas calzadas, en el orden en que se recorren.
- **Dado** un beat cuyo trecho pasa por un tramo sin nombre propio, **cuando** se lee su guiado, **entonces** ese tramo no se nombra y no se inventa ningún nombre para él.
- **Dado** un beat, **cuando** se lee su guiado, **entonces** trae la marca del destino para que el mapa la pueda pintar.
- **Dado** una aventura casteada, **cuando** se leen todos sus guiados, **entonces** no contienen ninguna cifra de distancia, de tiempo, de ritmo ni de progreso.
- **Dado** un mundo cuyo idioma es el gallego, **cuando** se lee el guiado, **entonces** los nombres son los que produjo el paquete de idioma de ese mundo.
- **Dado** el motor de casting, **cuando** se inspecciona, **entonces** no redacta ningún texto: los que entrega salen de la plantilla y de los nombres del mundo.

### Los roles humanos no hacen fallar el casting

- **Dado** una plantilla con un rol humano ligado a un sitio ya asignado, **cuando** se castea, **entonces** el rol humano queda resuelto.
- **Dado** un mundo en el que todavía no se ha generado ninguna persona, **cuando** se castea una plantilla con roles humanos, **entonces** castea igual.
- **Dado** el catálogo de motivos de fallo, **cuando** se enumera, **entonces** ninguno se refiere a la falta de gente: lo que estrecha el casting son los lugares.
- **Dado** un rol humano resuelto, **cuando** se lee su asignación, **entonces** hereda el anclaje del sitio donde trabaja y no consume uno propio.

### Determinismo, y la misma estructura con LLM y sin él

- **Dado** un mundo sembrado con `"42.40,-8.81#1"`, **cuando** se castea el catálogo dos veces, **entonces** las dos veces salen las mismas plantillas con el mismo reparto.
- **Dado** una plantilla, **cuando** se castea, **entonces** su azar sale de `makeRng` con el sufijo de fase del casting y el identificador de la plantilla.
- **Dado** dos plantillas del catálogo, **cuando** se castea una sola de ellas, **entonces** el reparto que obtiene es el mismo que obtendría casteando el catálogo entero.
- **Dado** el catálogo recibido en distinto orden, **cuando** se castea, **entonces** cada plantilla obtiene el mismo reparto.
- **Dado** los roles de una plantilla, **cuando** se recorren para resolverlos, **entonces** el orden es uno declarado explícitamente y no el de inserción de una estructura.
- **Dado** el casting, **cuando** se inspecciona, **entonces** no usa ninguna fuente de azar ni de tiempo del sistema.
- **Dado** un mundo ya generado, **cuando** se castea sobre él, **entonces** no se genera ni se resiembra nada del mundo.
- **Dado** un mismo mundo y una misma plantilla, **cuando** se castea con el LLM disponible y se castea sin red, **entonces** las dos veces salen el mismo reparto, los mismos beats en el mismo orden y el mismo lazo.
- **Dado** el motor de casting, **cuando** se inspecciona, **entonces** no llama al LLM ni recibe ningún texto suyo entre sus entradas.
- **Dado** una aventura casteada, **cuando** se enumeran los datos por los que alguna regla bifurca —lugares, disparadores, franjas, resultados, presupuesto y lazo—, **entonces** todos los fija el casting.
- **Dado** una aventura casteada sin red, **cuando** se recorre entera, **entonces** se puede completar de principio a fin con los textos de plantilla.

### Entradas inválidas, mundo sin reparto y errores

- **Dado** un mundo sin ningún núcleo, servicio ni paraje, **cuando** se castea el catálogo, **entonces** ninguna plantilla se ofrece y cada una trae su motivo.
- **Dado** un catálogo vacío, **cuando** se castea, **entonces** se devuelve una lista vacía y no un error.
- **Dado** un casteo sin el tramo del jugador, **cuando** se pide, **entonces** falla nombrando la dependencia que falta, en vez de suponer un ritmo.
- **Dado** un casteo sin punto de partida, **cuando** se pide, **entonces** falla nombrando la dependencia que falta, en vez de suponer el centro de la celda.
- **Dado** una plantilla con un tipo de rol desconocido, **cuando** se castea, **entonces** falla nombrando el tipo recibido y enumerando los válidos.
- **Dado** una plantilla que declara un tamaño que no existe, **cuando** se castea, **entonces** falla nombrando el tamaño recibido y enumerando los tres válidos.
- **Dado** una plantilla con un beat cuyo rol no está declarado en sus roles, **cuando** se castea, **entonces** falla nombrando el rol huérfano.
- **Dado** dos lugares candidatos sin ninguna ruta entre ellos en el grafo, **cuando** se mide el trecho, **entonces** la pareja no casa y no se sustituye por una distancia en línea recta.
- **Dado** un mundo mínimo de 250 m, **cuando** se castea el catálogo, **entonces** cada plantilla que no castea trae su motivo y ninguna queda fuera del resultado.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/quests/casting.js` | el motor: candidatos por rol, backtracking determinista, presupuesto y lazo |
| `packages/nucleo/quests/motivos.js` | el catálogo cerrado de motivos de fallo y su forma estructurada |
| `packages/nucleo/quests/aventura.js` | la forma de la aventura casteada: beats con lugar, disparador, escena y resultado, guiado y presupuesto |

`app/js/quests/casting.js` es el prototipo y esta spec no lo edita en su sitio: se porta con SPEC-002 y se reescribe aquí, sobre el paquete ya portado.

### Frontera de inyección

Esta spec **sí** toca la frontera del núcleo, y en más sitios que ninguna anterior. Todo lo siguiente entra como parámetro y ninguno se lee de un almacén ni se reimplementa aquí:

- **El catálogo de plantillas**, de la fila 17. Mientras no exista, sirve el catálogo de seis del prototipo, ya portado. La afinidad de oficio que filtra el catálogo se aplica **antes** de llamar al casting: aquí se castea lo que llegue.
- **El tramo del jugador y los tres tamaños de salida**, de SPEC-004 (`packages/nucleo/partida/tramo.js` y `salida.js`). De ahí salen los rangos de beats, el alcance de cada tamaño y el tope de trecho. Sin tramo, la llamada falla.
- **El punto de partida de la salida.** El casting no sabe dónde vive nadie ni consulta el GPS: recibe un punto. Sin él, la llamada falla.
- **El grafo de calzadas cosido y con ramales nombrados**, de SPEC-007, y **la ruta filtrada** que devuelve SPEC-008 con sus dos listas de declaración. El casting mide sobre esa ruta; no traza y no filtra.
- **El ajuste de horario diurno**, de las filas 27 y 38. Llega como una franja permitida, no como un booleano con la hora escondida dentro.
- **La resolución de un rol humano**, de la fila 14. Hasta que exista, un doble que devuelve siempre una persona para un sitio dado, que es exactamente lo que RF-NPC-002 promete.

Hacia fuera entrega dos cosas y solo dos: la **aventura casteada** y el **resultado del casteo por plantilla**, que es la aventura o el motivo.

### Lo que consume de otras specs y no respecifica

- **SPEC-002** fija que el paquete es JavaScript ESM puro, sin dependencias, y que `quests/` es una de sus cuatro áreas. Aquí no se discute la disposición.
- **SPEC-006** decide cuántos parajes hay y de qué tipo, con el **vocabulario de escenas inyectado** y el suelo derivado del catálogo. El casting es el consumidor de esa cobertura, no su autor: el vocabulario sale del catálogo (fila 17) y lo leen las dos. La dependencia circular ya está declarada en SPEC-006 y no se reabre.
- **SPEC-007** entrega el grafo cosido, la marca de suposición sobre toda arista que no existe en OSM, y el nombre de los ramales. Sin ese nombre no hay guiado posible; por eso hay un criterio que dice qué hacer con un tramo sin nombre en vez de inventarlo.
- **SPEC-008** entrega la ruta ya filtrada. El casting mide **sobre la ruta filtrada**, no sobre la corta: si el filtro manda rodear, el rodeo cuenta para el presupuesto, que es lo único coherente con que ninguna opción sea peor juego.
- **La fila 9** (`serializacion-mundo-congelado`, RF-PERS-001/002) congela el mundo entero. La aventura casteada es estado de partida sobre ese mundo, no parte del mundo: se guarda con la partida y no se recastea al abrirla. Su spec no estaba escrita en disco al redactar esta; si al implementar contradice algo de aquí, manda la suya y esto se itera.

### Del prototipo a esta spec: qué cambia de `casting.js`

Lo que hoy hace `app/js/quests/casting.js` funciona y ha medido bien —los cuatro mundos reales castean 6/6—, pero tiene cuatro cosas que no sobreviven a esta spec, y conviene decirlas para que el implementador no las porte por inercia:

1. **Las constantes en metros y minutos se van.** `MIN_LEG`, `MAX_LEG`, `DETOUR = 1.35` y `M_PER_MIN = 72` codifican un jugador de dos kilómetros por media hora. El tope pasa a ser **un tramo del jugador** y el ritmo, el suyo. La conversión con 2 000 m como tramo de referencia ya está fijada en SPEC-004: quien ande dos kilómetros en media hora conserva los números de hoy.
2. **La distancia deja de ser línea recta por 1,35.** Con el grafo cosido de SPEC-007 —donde los huecos cortos se unen y los largos se trazan como `fallback`, así que la conectividad está garantizada por construcción— medir de verdad es posible, y un factor de rodeo constante era una aproximación con fecha de caducidad.
3. **El motivo deja de ser una cadena.** Hoy es una frase (`sin candidatos para origen: un servicio "taberna"`) que el informe agrega parseando texto. Pasa a ser clave, rol y requisito, y la frase, si alguien la quiere, se compone a partir de eso.
4. **El tamaño deja de deducirse.** Hoy `encaja` mira los minutos y etiqueta la aventura a posteriori. La plantilla declara su tamaño y el casting comprueba que cabe; deducirlo era lo contrario de «cada aventura declara su tamaño con una palabra del mundo».

Y hay una trampa que sí hay que portar con cuidado: `Object.keys(tpl.roles)` fija el orden de resolución por el orden de escritura del objeto en el fichero. Es determinista en la práctica y es exactamente el patrón que `CLAUDE.md` prohíbe. El orden de roles se declara.

### La forma de la aventura casteada y del motivo

Tres piezas, y conviene separarlas porque las consumen agentes distintos:

- **La aventura casteada**: identificador, plantilla, semilla, tamaño declarado, dador, la cadena de beats y el presupuesto. Cada beat con su lugar (referencia a la localización del mundo, con nombre y anclaje), su disparador (`llegada` · `franja` con la franja · `con_objeto` con el objeto y la vía alternativa), su escena (tipo, afinidad usada, y el texto de plantilla como suelo) y su resultado (información, objeto o cambio de estado, más a qué beat empuja). El guiado de cada beat va con el beat: nombre del destino, nombres de las calzadas del trecho y la marca para el mapa.
- **El motivo del fallo**: clave del catálogo cerrado, rol o roles implicados, y el requisito que pedía. Es lo que `test/casting-report.mjs` agrega en histograma sin parsear frases, y lo que hace del informe de salud una medida y no una lectura.
- **El presupuesto**: en tramos del jugador —recorrido total, trecho más largo, ida y vuelta al punto de partida— con los metros del trazado al lado como dato del recorrido. Los metros no salen nunca a pantalla; el design system lo prohíbe y esa frontera la guarda quien pinta.

Sobre el medio tramo del lazo: es la distancia que el diseño llama «cerca del punto de partida». Va en tramos y no en metros por la misma razón que todo lo demás, y en medio tramo y no en uno entero porque un lazo que empieza a media hora de casa ya ha gastado dos trechos antes del primer beat.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Ninguno se implementa aquí —son de `wa-qa-dev`—, y **no se duplican**: la batería se escribió antes que el código y esta spec la referencia por su nombre literal.

De la característica **«Una quest se castea contra el mundo o no se ofrece»** (`@nucleo @casting`, fuente `quests.md` §7 · `casting.js`), que es la característica propia de esta spec:

- «Una plantilla sin candidatos no se ofrece»
- «El casting no mira lo descubierto»
- «El casting es determinista»
- «Todo lazo casteado se cierra»
- «El presupuesto de beats sale del tamaño declarado» (esquema de escenario, con paseo 4-6, aventura 6-10 y jornada 10-14)
- «Fallar por no llegar es casi imposible»

De **«El árbitro es el código y el narrador es el LLM»** (`@nucleo @determinismo`, bloqueante), la mitad que esta spec sostiene por su lado:

- «Con LLM y sin LLM la estructura es idéntica»
- «El modelo no escribe ningún dato vivo», del que aquí se afirma la parte de qué es dato vivo en una aventura
- «Sin red, la aventura funciona entera»

De **«El mundo de una celda es jugable por construcción»** (`@nucleo @casting`), que es de SPEC-006 pero cuya garantía esta spec consume y no puede contradecir:

- «El mundo mínimo todavía compone un lazo»
- «La cobertura de escenas manda sobre la afinidad del anclaje»

De **«Lo generado no se resiembra jamás»** (`@nucleo @determinismo`, bloqueante), aplicado al casteo:

- «Cambiar el tramo del jugador no redimensiona un mundo ya generado», por su otra cara: cambia a dónde te mandan y no qué existe.

De **«Los anclajes reales son de uso único»** (`@nucleo @determinismo @casting`):

- «Un NPC no consume anclaje propio», que es lo que sostiene que un rol humano nunca estreche el casting.

Y de **«Los objetos son llaves, no requisitos»**, adyacente pero directamente implicado por el disparador `con_objeto`:

- «Sin el objeto hay otro camino al mismo beat»

Queda explícitamente **fuera** el escenario «El oficio filtra el catálogo», de la misma característica: la afinidad de oficio la declara el catálogo (fila 17) y la aplica quien ofrece (fila 28); aquí se castea lo que llega.

### Huecos de cobertura detectados

Se anotan porque son de la batería, no de esta spec, y ninguno se resuelve inventando un escenario aquí:

1. **Las franjas no tienen escenario, y el PRD ya lo marca** (`RF-QUEST-004`, ⚠ sin escenario). Nada en `docs/testing.md` afirma que la franja es propiedad del beat, que llegar tarde no cancela nada ni que el horario diurno acota las franjas casteables. Es el hueco más grande de esta spec y el que más decisiones asumidas ha obligado a tomar; merece característica propia en la batería.
2. **`RF-NPC-002` tampoco tiene escenario** (⚠ en el PRD). «Un NPC no consume anclaje propio» cubre el anclaje, no la promesa de que un rol humano nunca haga fallar el casting. Aquí se afirma por el catálogo de motivos, que es una comprobación indirecta.
3. **El motivo estructurado no tiene escenario.** «El motivo del fallo queda explicado» es un paso dentro de «Una plantilla sin candidatos no se ofrece», y no dice nada de su forma. Sin escenario, nada impide que alguien vuelva a la cadena de texto y el histograma siga funcionando a base de parsear.
4. **El guiado por nombres no tiene escenario propio.** RF-QUEST-005 ancla el nodo `A3P2`, que es una pantalla y por tanto `@app`; la parte `@nucleo` —que el guiado nombra las calzadas del trecho y trae la marca— no está en la batería.
5. **El beat `con_objeto` no tiene escenario en la característica del casting.** «Sin el objeto hay otro camino al mismo beat» vive en la característica de objetos, que es de la fila 15, y afirma la consecuencia sin afirmar que la estructura del beat obligue a declararla.
6. **El tope de trecho no está calibrado sobre mundos reales.** Pasar de 2 400 m fijos a un tramo del jugador aprieta el tope para quien ande 2 km en media hora, y `test/casting-report.mjs` es justo la herramienta que diría cuánto baja la casteabilidad. La medida hay que hacerla al implementar; si baja demasiado, la corrección es del diseño (`quests.md` §3) y no del test.
7. **La spec de la fila 9 no estaba escrita en disco.** Lo que aquí se dice sobre guardar la aventura casteada con la partida es una suposición razonable, no una lectura de su contrato.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y coherencia con SPEC-001 a SPEC-008.
- **Sin sección de comportamiento responsive y sin bloque de UX Design** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`, y porque esta spec no tiene interfaz: las pantallas son de las filas 28, 29 y 34.
- **El tope de trecho es exactamente un tramo del jugador** → asumido (alternativa: 1,2 tramos, que es lo que codifica hoy `MAX_LEG = 2400` con el tramo de referencia de 2 000 m). Regla: RF-QUEST-003 dice «ningún tramo supera media hora al ritmo del jugador», y un tramo **es** media hora al ritmo del jugador (`accesibilidad.md` §1); conservar el 1,2 sería conservar un margen que nadie decidió.
- **El trecho mínimo se conserva y se reexpresa en tramos** → asumido en 0,03 tramos, que son los 60 m de hoy con el tramo de referencia (alternativa: quitarlo). Regla: existe para que dos beats no caigan pegados y convertir un lazo en una vuelta a la manzana; el número sale del prototipo y se declara aquí para que se pueda corregir en un sitio.
- **«Cerca del punto de partida» es medio tramo del jugador** → asumido para el primer y el último beat (alternativa: un tramo entero, o un radio en metros). Regla: `quests.md` §3 no fija número; en tramos por `accesibilidad.md` §1, y en medio porque un lazo que arranca a media hora de casa gasta dos trechos antes del primer beat.
- **El tamaño lo declara la plantilla y el casting lo verifica** → asumido (alternativa: deducirlo de los minutos que salgan, que es lo que hace hoy `encaja`). Regla: `bucle-jugable.md` §3, cada aventura declara su tamaño con una palabra del mundo; deducirlo a posteriori es decidirlo con una fórmula, que es justo lo que la decisión rechaza.
- **La distancia se mide sobre el grafo filtrado y no en línea recta por 1,35** → asumido (alternativa: conservar el factor de rodeo, que es más barato y no depende de SPEC-007 ni de SPEC-008). Regla: SPEC-007 garantiza la conectividad por construcción (huecos cortos cosidos, largos trazados como `fallback`), así que la aproximación ya no hace falta; y medir sobre la ruta filtrada es lo único coherente con RNF-ACC-001, ninguna opción es peor juego.
- **Sin ruta en el grafo, la pareja de beats no casa** → asumido (alternativa: caer a la línea recta como respaldo). Regla: `accesibilidad.md` §2, lo que nos inventamos no se promete; un trecho que no existe en el grafo es un trecho que nadie ha comprobado que se pueda andar.
- **El motivo del fallo es clave, rol y requisito** → asumido, con catálogo cerrado y fallo explícito ante una causa desconocida (alternativa: la cadena de texto de hoy, que ya funciona con el informe). Regla: RF-QUEST-001 pide que el motivo quede explicado, y el encargo lo quiere agregable en histograma; una clave se cuenta, una frase se parsea y se rompe al reescribirla.
- **La franja no bloquea: llegar fuera resuelve el beat igual y solo cambia la variante de escena** → asumido (alternativa: que el beat espere a la siguiente franja, o que se resuelva a la baja). Regla: RF-QUEST-015 y `quests.md` §4, sin tiempos límite que metan prisa a quien camina; hacer esperar un beat es un tiempo límite con otro nombre, y como la aventura vive en una salida, esperar a mañana sería perderla. Es la decisión que cubre el hueco declarado del PRD y la primera candidata a revisarse si el diseño dice otra cosa.
- **Con el horario diurno activo, una plantilla cuya franja cae fuera no castea** → asumido, con motivo estructurado (alternativa: recortar la franja al horario diurno, o castear e ignorar la franja). Regla: `seguridad-privacidad.md` y `quests.md` §8, el horario diurno viene encendido de origen; recortar una franja nocturna la desnaturaliza —«al anochecer» a las cinco de la tarde no es la misma escena— y ignorarla convierte el disparador en decoración.
- **Un beat `con_objeto` declara siempre otra manera de resolverse, y sin ella la plantilla no castea** → asumido (alternativa: dejarlo a la fila 15 y permitir el beat bloqueante). Regla: el escenario «Sin el objeto hay otro camino al mismo beat» de `docs/testing.md` y RF-QUEST-015; si la estructura permite el beat sin salida, la garantía depende de que quien escriba cada plantilla se acuerde.
- **El orden de resolución de los roles se declara explícitamente en la plantilla** → asumido (alternativa: seguir con el orden de las claves del objeto, que hoy es determinista de hecho). Regla: `CLAUDE.md`, prohibida la iteración con orden de inserción no controlada dentro de la generación; que funcione por accidente no es determinismo, es suerte con buena prensa.
- **El azar se siembra por plantilla, con `:cast:<id>`** → asumido, conservando el sufijo del prototipo (alternativa: una sola siembra para todo el catálogo). Regla: `CLAUDE.md`, un sufijo distinto por fase para que tocar una no desplace el azar de las demás; por plantilla además hace que añadir una al catálogo no cambie el reparto de las otras, que es lo que permitirá crecer a treinta sin resembrar el mundo entero.
- **La afinidad de oficio se aplica antes de llamar al casting** → asumido (alternativa: pasarle el oficio y que filtre él). Regla: `.claude/rules/naming.md` y el reparto del checklist, el catálogo es de la fila 17 y el ofrecimiento de la 28; meter el oficio aquí obligaría a esta spec a conocer el personaje, que es de la fila 27.
- **El presupuesto se expresa en tramos y los metros van al lado como dato del trazado** → asumido (alternativa: todo en metros, como hoy). Regla: `accesibilidad.md` §1 y SPEC-004, un tope en metros absolutos significa cosas distintas para dos personas; los metros siguen haciendo falta para pintar el recorrido y por eso no desaparecen, solo dejan de ser la unidad de la regla.
- **El rol humano se resuelve con un doble mientras no exista la fila 14** → asumido (alternativa: no castear plantillas con roles humanos hasta entonces). Regla: RF-NPC-002, si una plantilla pide un rol humano el sitio lo produce; bloquearlas dejaría sin cobertura justo la promesa que hay que verificar.
- **La aventura casteada es estado de partida y se guarda con ella, no se recastea al abrir** → asumido (alternativa: recastear al abrir la partida, que sería idéntico por determinismo). Regla: `quests.md` decisión 1, la prosa se genera una vez y se guarda con la partida; separar el esqueleto de la piel al guardar obligaría a recomponerlos, y la fila 9 congela el mundo con el mismo criterio.
- **El casting entrega textos de plantilla y no redacta ninguno** → asumido (alternativa: componer aquí la frase de guiado a partir de los nombres). Regla: `quests.md` decisión 1, la frontera árbitro/narrador; y el registro del texto lo decide el momento que lo pinta, que es de otra fila.
