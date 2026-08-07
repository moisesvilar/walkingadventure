# PRD — Walking Adventure

> Versión: 1.0 · Fecha: 7-ago-2026 · Basado en: los catorce documentos de `game-design/`, los seis artefactos de `docs/pantallas/` (índice en `docs/pantallas.md`), `docs/flujo.md` y `docs/testing.md`. Regla de precedencia: manda `game-design/`; si este PRD y un documento de diseño se contradicen, el documento tiene razón y este PRD está desactualizado.

Este PRD sigue el esqueleto de `/somo-plan-fable` con **cuatro sustituciones declaradas**, para que nadie las lea como omisiones:

1. **No hay exploration report.** Las anclas de trazabilidad no son `PD-NN`/`REQ-NN` sino las decisiones cerradas del repo, con tres formas greppables: `[bucle-jugable.md §3]` para una decisión de diseño, `[flujo: A4P2]` para una pantalla del diagrama de estados, y `[testing.md: «El visor abre por la ficción la primera vez»]` para un criterio de aceptación ya escrito. **Un RF sin al menos un ancla no entra en este PRD.**
2. **No hay Personas: hay Ejes de variación** (§2). No existen segmentos de usuario que inventar; lo que cambia el producto son cinco ejes medibles del jugador y de su entorno.
3. **No hay casos de uso propios.** Los cuarenta encadenamientos de pantalla están en `docs/flujo.md` y los 174 casos de aceptación en `docs/testing.md`; este PRD referencia y no duplica, porque dos listas de casos de uso se desincronizan siempre.
4. **No hay KPIs de producto, y es una decisión** (§6). La analítica es incompatible con `[seguridad-privacidad.md §1]` y `[arquitectura.md §3]`; en su lugar, §6 lista lo que sí se mide.

A las categorías sugeridas se añade una: `PJ` (personaje y arranque), porque el onboarding y la creación de personaje no cabían con honestidad en ninguna otra.

## 1. Contexto y visión

**Walking Adventure es un RPG que se juega caminando físicamente por el mundo real.** A partir de la ubicación del jugador y de datos de OpenStreetMap, el juego genera un mapa de fantasía determinista donde cada elemento ficticio está anclado a un lugar real: el bar de abajo es una taberna, el chiringuito de la playa es una torre en ruinas. El jugador completa aventuras andando de un sitio a otro, y lo que hace se propaga por el mundo como rumor, deformándose por el camino, hasta volver a él contado por otros.

El placer del juego se apoya en tres pilares sin jerarquía — cartografiar el propio territorio, lo que el mundo cuenta de ti, y la caminata como decisión — que comparten una única moneda: el tramo, la distancia personal que el jugador anda en media hora `[bucle-jugable.md]` `[accesibilidad.md §1]`. No hay niveles, ni XP, ni una sola cifra de distancia en pantalla: la progresión es el rango social por núcleo y el mapa que se va entintando `[progresion.md]`.

El estado del proyecto: el diseño está cerrado (14 documentos en `game-design/`), las 40 pantallas dibujadas (6 artefactos), el flujo entre ellas verificado (`docs/flujo.md` + `scripts/verifica-flujo.mjs`) y la batería de aceptación escrita antes de implementar (`docs/testing.md`, 174 casos). Existe un prototipo del generador (`app/`) que **no es fuente de este PRD**: según `[arquitectura.md §2]`, el generador se porta a un paquete compartido y se refactoriza, y el render, las pantallas y la capa de datos se hacen de cero.

**Alcance de versión: el juego completo**, todo lo que `game-design/` da por decidido. El orden de ataque no lo fija este documento sino `docs/checklist.md`, que es donde vive el orden de ejecución del pipeline.

## 2. Ejes de variación

No hay personas ficticias: hay cinco ejes reales que redimensionan o condicionan el producto. Cada uno se describe por lo que obliga a soportar.

### 2.1 El tramo del jugador

Lo que el jugador anda en media hora, desde ~250 m de radio hasta varios kilómetros `[accesibilidad.md §1]` `[accesibilidad.md §4]`. **Obliga a**: dimensionar celda, quests, desvíos y reloj del mundo en tramos y no en metros; que ninguna opción sea peor juego (misma forma, otra escala); corregir el tramo midiendo, en silencio y sin comentarlo jamás; declarar el suelo (~250 m) antes de instalar; y que cambiar el tramo nunca redimensione un mundo ya generado `[testing.md: «Cambiar el tramo del jugador no redimensiona un mundo ya generado»]`.

### 2.2 El oficio

Se elige en el arranque, filtra el catálogo de aventuras con afinidad declarada por plantilla, y **no se cambia nunca** `[personaje.md §3]`. **Obliga a**: un catálogo de 20-30 plantillas con afinidades para que cada oficio conserve del orden de diez esqueletos jugables en un barrio pequeño; a que la pantalla de elección explique la permanencia antes de cerrarse; y a que el precalentamiento de la cola de entregas cubra el día sin aventura del oficio propio.

### 2.3 La densidad del mundo

Del barrio de tres calles al casco urbano denso `[bucle-jugable.md §7]`. **Obliga a**: un suelo de parajes derivado del catálogo (escenas que piden las plantillas ÷ escenas por paraje) y no del gusto `[parajes.md]`; a que cruces y puentes garanticen parajes sin datos OSM ricos; al estirón ofrecido y nunca impuesto; y a que lo social haga jugable la repetición donde el territorio no da más de sí.

### 2.4 Los pasos de fondo

Opt-in explícito, apagado de origen, con permisos de salud `[quests.md decisión 4]` `[seguridad-privacidad.md §2]`. **Obliga a**: que el juego sea completo sin activarlo; a la reserva con tope de 5 pasos que se vacía narrada en el zurrón; a leer los pasos al abrir la app, sin GPS en segundo plano; y a que volver tras tres meses enseñe lo mismo que volver tras tres días.

### 2.5 La cobertura

Una salida entera se juega sin red `[partida-guardada.md §1]`. **Obliga a**: mundo congelado en el dispositivo con sus imágenes y fotos; fallback de plantilla para todo texto y ficha de texto para todo visor; degradación silenciosa — sin cobertura no se avisa de nada y ninguna pantalla lo llama fallo `[bucle-jugable.md, momento 1]`; y a que la red solo haga falta en dos momentos, ninguno andando: al generar un mapa y al preparar una salida.

## 3. Alcance

**Incluye** el juego completo decidido en `game-design/`: generación determinista de mundo por celdas con anclajes reales; catálogo de quests con casting, guiado por nombres y lazo; motor de pasos con los kilómetros como reloj; propagación y deformación de rumores por el árbol de calzadas; capa de NPCs perezosa con memoria fiel; rango social, oro y objetos-llave; diario con triangulación; las 40 pantallas de los seis artefactos con sus cuatro momentos; partida guardada con mundo congelado, respaldo y exportación; proxy ciego con LLM, imágenes y Places; y las garantías transversales de determinismo, privacidad, aptitud para menores, accesibilidad y funcionamiento sin red.

**No incluye** lo listado en §6 (Exclusiones), y **no resuelve** los pendientes de diseño listados en §7, que quedan como supuestos declarados.

## 4. Requisitos funcionales

Convenciones de la tabla: la columna Anclas usa el esquema declarado arriba. Donde un RF no tiene ningún escenario en `docs/testing.md` que lo verifique, se marca con **⚠ sin escenario** — es un hueco de cobertura de la batería, no un defecto del requisito. En sentido inverso se ha comprobado que las 33 características de `testing.md` quedan cubiertas por algún RF de esta tabla.

### 4.1 Generación de mundo (MUNDO)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-MUNDO-001 | Generación determinista por celda | El mundo de una celda es función pura de semilla + datos OSM congelados, con sufijo RNG propio por fase; sin reloj ni azar del sistema, sin orden de iteración dependiente de inserción. | [alcance-del-mundo.md §2] [testing.md: «El mundo es una función de la semilla y de los datos de OSM»] | Must |
| RF-MUNDO-002 | Semilla con el jugador dentro | La semilla incorpora al jugador (dos vecinos ven mundos distintos), es corta, legible y copiable, y se persiste como dato crítico de la partida. | [alcance-del-mundo.md §1] ⚠ sin escenario (formato y unicidad de la semilla) | Must |
| RF-MUNDO-003 | Rejilla de celdas en tramos | Los mapas son celdas fijas de una rejilla personal dimensionada en tramos del jugador, anclada a una coordenada redondeada cercana al arranque, no a su posición exacta. | [alcance-del-mundo.md §2] [flujo: A1P4] | Must |
| RF-MUNDO-004 | Apertura de celdas por dos vías | Una celda vecina se genera por pisarla (el mundo existe donde estás) o como acontecimiento al completar la propia; las celdas contiguas cosen sus calzadas en el borde. | [alcance-del-mundo.md §2] [testing.md: «Abrir una celda vecina no toca la celda propia»] | Must |
| RF-MUNDO-005 | Lo generado no se resiembra jamás | Crecer es generar otra celda; ninguna operación (cambio de tramo, de estilo, descarte de anclaje, apertura de vecinas) regenera lo existente. | [bucle-jugable.md §5] [testing.md: «Lo generado no se resiembra jamás»] | Must |
| RF-MUNDO-006 | Anclajes de uso único | Un POI real alimenta un núcleo, un servicio o un paraje, nunca dos; los anclajes libres tras núcleos y servicios pasan a los parajes. | [parajes.md] [testing.md: «Los anclajes reales son de uso único»] | Must |
| RF-MUNDO-007 | Cupos por celda: suelo derivado, techo por ritmo | Los cupos se calculan una vez por celda y en tramos; el mínimo de parajes sale del catálogo (escenas pedidas ÷ escenas por paraje) y el cupo por ritmo queda como techo. | [parajes.md] [parametros-mundo.md] [testing.md: «El mundo de una celda es jugable por construcción»] | Must |
| RF-MUNDO-008 | Parajes: 8 tipos y cobertura de escenas | Ocho tipos con escenas ponderadas; primero se eligen los tipos que cubren el vocabulario de escenas y después se asigna anclaje con sesgo suave, sacrificándolo si no lo hay. | [parajes.md] [testing.md: «La cobertura de escenas manda sobre la afinidad del anclaje»] | Must |
| RF-MUNDO-009 | Selección de anclajes por reconocimiento | Un tag solo entra si aporta reconocimiento; se puntúa cerca-de-ruta y lejos-de-núcleo; cruces y puentes salen del grafo y garantizan parajes; ningún tag masivo monopoliza un tipo. | [parajes.md] [testing.md: «Un tag masivo no monopoliza un tipo de paraje»] | Must |
| RF-MUNDO-010 | Filtro de tipos problemáticos | Industrial, obras, propiedad privada y locales de adultos se descartan del pool al generar. | [seguridad-privacidad.md §3] [testing.md: «Los anclajes de adultos se excluyen del pool»] | Must |
| RF-MUNDO-011 | Google Places como relleno del pool | Places solo enriquece el pool de anclajes donde OSM no llega, guardando el `place_id` como campo persistente y respetando la regla del reconocimiento. | [parajes.md] ⚠ sin escenario (pool con Places) | Should |
| RF-MUNDO-012 | Nombres únicos e idioma por ubicación | Todo nombre sale del paquete de idioma del mundo (interfaz completa, `localeFor` una vez por mundo), con unicidad global. | [parajes.md] [testing.md: «Los nombres son únicos y del idioma del sitio»] | Must |
| RF-MUNDO-013 | Cosido del callejero y marcado de suposiciones | Los huecos cortos del callejero OSM se cosen antes de trazar; toda arista inventada (cosida o `fallback`) queda marcada como suposición. | [accesibilidad.md §2] [testing.md: «El callejero troceado de OSM se cose antes de trazar»] | Must |
| RF-MUNDO-014 | Ramales a parajes con nombre | Los ramales del grafo a parajes nacen con nombre, porque sin él no hay ni oferta de desvío ni declaración de camino evitado. | [accesibilidad.md §2] [flujo: A3P5] | Must |
| RF-MUNDO-015 | Prólogo del mundo con condición de composición | Antes de la partida se ejecutan k pasos con siembra propia del mundo; se resiembra el prólogo hasta que dos núcleos alcanzables tengan versiones distintas del mismo suceso; deja sembrada la cola de entregas. | [arranque.md §1] [arranque.md §2] ⚠ sin escenario (prólogo y composición) | Must |
| RF-MUNDO-016 | Fotos de Places al crear el mapa | Las fotos del lado real se piden por el proxy al generar el mapa, en la misma tanda que la consulta de Places, nunca por aventura. | [bucle-jugable.md §2] [seguridad-privacidad.md §1] [testing.md: «Las fotos de Places se piden al crear el mapa»] | Should |
| RF-MUNDO-017 | Filtro de accesibilidad sobre el grafo | El filtro (escalones, superficie, bordillos, `wheelchair`) evita y declara, nunca borra; lo cosido y lo `fallback` no se promete transitable; las cuestas no se prometen. | [accesibilidad.md §2] [testing.md: «El filtro sobre el grafo evita y declara, nunca borra»] | Must |

### 4.2 Quests (QUEST)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-QUEST-001 | Casting determinista o no se ofrece | Las plantillas se castean contra el mundo con la semilla; la que no castea no se ofrece y el motivo queda explicado. | [quests.md §7] [testing.md: «Una quest se castea contra el mundo o no se ofrece»] | Must |
| RF-QUEST-002 | El casting no mira lo descubierto | Lo descubierto afecta a lo que ves, nunca a lo que existe ni a lo que castea. | [bucle-jugable.md §1] [testing.md: «El casting no mira lo descubierto»] | Must |
| RF-QUEST-003 | Presupuesto por tamaño y lazo cerrado | Cada aventura declara su tamaño con una palabra del mundo (paseo 4-6 beats, aventura 6-10, jornada 10-14), ningún tramo supera media hora al ritmo del jugador y el lazo empieza y termina cerca del punto de partida. | [quests.md §3] [bucle-jugable.md §3] [testing.md: «El presupuesto de beats sale del tamaño declarado»] | Must |
| RF-QUEST-004 | Beats con disparadores | Cadena lineal de beats con lugar, disparador (`llegada` / `franja` / `con_objeto`), escena casada con las afinidades del lugar, y resultado; la franja es propiedad del beat y llegar tarde no cancela nada. | [quests.md §2] [npcs.md §3] ⚠ sin escenario (franjas) | Must |
| RF-QUEST-005 | Guiado por nombres y marca | La indicación usa el lenguaje del mundo con las rutas nombradas como infraestructura, y el destino aparece marcado en el mapa; el texto ambienta, el mapa confirma. | [quests.md decisión 2] [flujo: A3P2] | Must |
| RF-QUEST-006 | Árbitro código, narrador LLM | El LLM solo produce datos inertes; su respuesta se valida contra un esquema cerrado, lo desconocido se descarta sin interpretarse, y todo texto tiene fallback de plantilla. | [quests.md decisión 1] [testing.md: «El árbitro es el código y el narrador es el LLM»] | Must |
| RF-QUEST-007 | Nombres: suelo determinista, capa opcional | Todo nombre lo produce primero el paquete de idioma; el LLM puede proponer alternativa que solo se adopta si pasa validación (unicidad, longitud, aptitud). | [quests.md decisión 1] [testing.md: «Un nombre propuesto por el LLM solo se adopta si pasa validación»] | Should |
| RF-QUEST-008 | Contrato con el LLM | Dos puntos de invocación y no más (al crear la quest; llamada agrupada al abrir la salida para el zurrón), nunca en marcha; prompt sin datos reales, con locale, tono, reglas de lenguaje y registro de tópicos como restricción negativa; generación única, cacheada y guardada con la partida. | [quests.md decisión 1] [seguridad-privacidad.md §1] [testing.md: «El prompt del LLM no lleva ningún dato real»] | Must |
| RF-QUEST-009 | Catálogo de 20-30 plantillas | Cada plantilla: roles que castean, lazo que cierra, afinidad de oficios declarada (algunas exclusivas), textos de fallback, desenlace de repuesto, declaración de rumor y mote candidato — en cómico-cálido y escrita para leerse en voz alta. | [personaje.md §3] [bucle-jugable.md §6] [quests.md §7] | Must |
| RF-QUEST-010 | Micro-encuentros y cola de entregas | Solo saltan con cola no vacía, con lugar diferido resuelto en marcha, coste cero de desvío, nunca durante un beat; las oportunidades se ofrecen dos veces (otra salida, otro sitio) y sedimentan sin reproche; las noticias sedimentan de inmediato. | [quests.md decisión 3] [testing.md: «Una oportunidad ignorada se ofrece una segunda vez»] | Must |
| RF-QUEST-011 | Máximo tres aventuras ofrecidas | Tope, no número fijo; un día con una sola no se disculpa. | [bucle-jugable.md §3] [testing.md: «Se ofrecen tres aventuras como mucho»] | Must |
| RF-QUEST-012 | El estirón se ofrece, nunca se impone | Si el mundo (o el filtro) no da para un lazo, el juego dice la verdad y ofrece alejarse un tramo más. | [bucle-jugable.md §7] [testing.md: «Si el filtro deja el mundo sin reparto, se ofrece el estirón»] | Must |
| RF-QUEST-013 | Cierre en corto | Volver a mitad resuelve la aventura a la baja con el desenlace de repuesto de la plantilla; no genera rumor y el telón se echa igual. | [bucle-jugable.md §4] [testing.md: «El cierre en corto ocupa el sitio del desenlace»] | Must |
| RF-QUEST-014 | La primera aventura se elige por dónde pasa | Además de castear, tiene que pasar por los dos núcleos con versiones distintas del mismo suceso; solo la primera. | [arranque.md §2] [flujo: A1P7] ⚠ sin escenario | Must |
| RF-QUEST-015 | Fallar por no llegar es casi imposible | Sin tiempos límite que metan prisa; se falla por decisiones, no por piernas. | [quests.md §3] [testing.md: «Fallar por no llegar es casi imposible»] | Must |
| RF-QUEST-016 | El recado suelto comparte lista | Encargos de la cola de entregas aparecen en la lista con medida «un momento», para que un día sin aventura del oficio no sea un día vacío. | [personaje.md §3] [flujo: A2P3] ⚠ sin escenario | Should |

### 4.3 Reloj del mundo y rumores (RUMOR)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-RUMOR-001 | Motor de pasos como capa | Contador `n` por partida con siembra `:tick:n`; capa sobre el mundo generado, nunca fase de la tubería; un tramo andado es un paso. | [quests.md decisión 4] [testing.md: «El mundo avanza con los kilómetros del jugador, no con el calendario»] | Must |
| RF-RUMOR-002 | Fuente de kilómetros y reserva | Por defecto cuentan los de salida activa; los pasos de fondo (opt-in) acumulan en reserva con tope 5; sin penalización por ausencia; un paso solo añade. | [quests.md decisión 4] [testing.md: «Un paso solo añade»] | Must |
| RF-RUMOR-003 | Propagación por el árbol de calzadas | Latencia por metros reales (un tramo por paso), nivel por saltos con tope 3 y +1 en tramos `fallback`; el rumor se agota solo y sedimenta. | [quests.md §6] [testing.md: «El rumor nace donde ocurrió y viaja por el árbol de calzadas»] | Must |
| RF-RUMOR-004 | Escalera de deformación | Cuatro niveles enumerados (fiel · abultado · trastocado · leyenda); el signo moral nunca se invierte; signo y nivel son datos vivos del código y solo la redacción es del LLM. | [quests.md §6] [testing.md: «La deformación no invierte el signo moral»] | Must |
| RF-RUMOR-005 | La reputación es lo que llegó | Cada núcleo trata al jugador según la versión que oyó; el estado del núcleo aflora al llegar, sin panel consultable. | [quests.md §6] [quests.md decisión 3] [testing.md: «Sin beat, lo que se cuenta es la llegada entera»] | Must |
| RF-RUMOR-006 | El zurrón: marco propio, entradas prestadas | Solo con pasos de fondo activos y reserva sin vaciar; el resumen se redacta en una única llamada agrupada al abrir la salida, con fallback por entrada; se vacía al leerse. | [quests.md decisión 3] [flujo: A2P2] [testing.md: «El zurrón solo aparece si hay reserva que vaciar»] | Should |

### 4.4 NPCs (NPC)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-NPC-001 | Generación perezosa y determinista | Cada sitio tiene cara titular y las demás nacen cuando una aventura las necesita, con clave `semilla + sitio + puesto` (nunca orden de aparición); el NPC hereda el anclaje del sitio. | [npcs.md §1] [testing.md: «Un NPC no consume anclaje propio»] | Must |
| RF-NPC-002 | El casting no falla por gente | Si una plantilla pide un rol humano, el sitio lo produce; lo que estrecha el casting son los lugares. | [npcs.md §1] ⚠ sin escenario | Must |
| RF-NPC-003 | Memoria corta y fiel; el testigo no corrige | El NPC guarda solo los hechos en los que fue rol, en versión nivel 0; te la cuenta gratis y no corrige lo que se cuenta en el pueblo; el informante vende su versión deformada. | [npcs.md §2] [testing.md: «El testigo directo es fiel y no corrige al pueblo»] | Must |
| RF-NPC-004 | Relación por NPC y reparación | Los actos del jugador cambian el trato con personas concretas, nunca el paso del tiempo; lo roto se puede reparar; es el único mecanismo del proyecto que baja. | [npcs.md §4] ⚠ sin escenario (relación y reparación) | Should |
| RF-NPC-005 | Reparto equilibrado por generación | Género asignado con la semilla y equilibrado a propósito; el oficio no arrastra el estereotipo. | [lenguaje.md] [testing.md: «El reparto de NPCs se equilibra por generación»] | Must |

### 4.5 Progresión y economía (PROG)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-PROG-001 | Rango social por núcleo | Tres escalones con nombre y sin números; sube por lo que llega, no por lo que se pisa; sin barra ni lista de reputación en ninguna pantalla. | [progresion.md §1] [testing.md: «No hay niveles, hay rango social por núcleo»] | Must |
| RF-PROG-002 | El rango cambia trato y precio, no catálogo | Mismo contenido ofrecido a todos; cambian el tono y el precio de la información, incluido el precio cero. | [progresion.md §3] [testing.md: «El rango cambia el trato y el precio, no el catálogo»] | Must |
| RF-PROG-003 | El rango no viaja entre mapas | En un mapa nuevo el jugador es forastera en todos los núcleos, sin regla adicional. | [alcance-del-mundo.md §3] [testing.md: «El rango no viaja entre mapas»] | Must |
| RF-PROG-004 | El oro compra saber y favores | Nunca distancia, nunca dinero real, nunca consumo en el negocio del anclaje; el informante devuelve la versión que a él le llegó. | [progresion.md §2] [testing.md: «El oro compra saber y favores, nunca metros»] | Must |
| RF-PROG-005 | El oro como cifra, el rango como frase | El oro sí se enseña como número (moneda que se gasta); el rango se dice con una frase y nunca con una lista de pueblos. | [progresion.md §1] [progresion.md §2] [flujo: A5P2] | Must |
| RF-PROG-006 | Objetos-llave, nunca requisito | El disparador `con_objeto` abre otra puerta al mismo beat; cada plantilla puede declarar ganchos opcionales; sin el objeto siempre hay otro camino. | [progresion.md §4] [testing.md: «Los objetos son llaves, no requisitos»] | Must |
| RF-PROG-007 | La repisa y los motes | La repisa no es inventario (sin peso, huecos ni tirar); cada objeto dice de quién y de qué día; debajo, los motes por núcleo hacen de ficha de personaje. | [progresion.md §4] [flujo: A6P5] [testing.md: «La repisa no es un inventario»] | Must |
| RF-PROG-008 | El mote nace del rumor y es por núcleo | Cada plantilla y suceso declaran mote candidato; se pega el que más suena, distinto en cada núcleo. | [personaje.md §2] [testing.md: «El mote nace del rumor y es por núcleo»] | Should |

### 4.6 Diario (DIARIO)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-DIARIO-001 | Registra lo oído, no lo cierto | Guarda la versión oída con lugar y momento; no sobrescribe con versiones más veraces; el nivel de deformación no sale nunca a pantalla. | [quests.md decisión 3] [testing.md: «El diario registra lo oído, no lo cierto»] | Must |
| RF-DIARIO-002 | La triangulación se pone en escena | La primera segunda-versión de algo apuntado se enseña con las dos juntas, en el sitio, sin explicar nada y sin decir cuál es la buena; ocurre una sola vez. | [quests.md decisión 3] [flujo: A6P3] [testing.md: «La primera coincidencia se pone en escena»] | Must |
| RF-DIARIO-003 | La vista por historias se gana | Se desbloquea al triangular; agrupa versiones de un mismo suceso ordenadas por cuándo se oyeron, nunca por fidelidad; convive con la vista por días. | [quests.md decisión 3] [flujo: A6P4] [testing.md: «Las versiones se ordenan por cuándo se oyeron»] | Must |
| RF-DIARIO-004 | Un capítulo por mapa | Los mapas antiguos se leen desde el diario, cada uno con sus días y su mapa; se leen, no se juegan desde el sofá. | [alcance-del-mundo.md §3] [testing.md: «Los mapas antiguos se leen desde el diario»] | Must |
| RF-DIARIO-005 | La entrada del día | Cierra todo telón; lo propio en primera persona y lo oído aparte con distinta autoridad. | [flujo: A5P4] [testing.md: «Un paseo sin aventura tiene telón completo menos desenlace»] | Must |
| RF-DIARIO-006 | El hito de fin de arranque | Se marca una sola vez, cuando llegas a un núcleo donde lo que se cuenta eres tú; dice que el mundo cambió, no que el jugador aprobó. | [arranque.md §3] ⚠ sin escenario | Must |

### 4.7 El bucle: los cuatro momentos (BUCLE)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-BUCLE-001 | En marcha, nada tocable y ninguna cifra | Ni un control dentro de la app en marcha; ninguna cifra de esfuerzo (km, ritmo, pasos, calorías, tiempo, progreso, racha); lo único tocable vive en la pantalla de bloqueo por ser del sistema. | [bucle-jugable.md, momento 2] [flujo: A3P2] [testing.md: «En marcha no hay nada que tocar»] | Must |
| RF-BUCLE-002 | La portada | Sin panel del mundo ni marcador de reputación; «salir a andar sin más» de primer nivel; tarjeta de a-medias solo con salida abierta, con seguir o dejarlo aquí; tres puertas (diario, repisa, ajustes) y ninguna barra de pestañas. | [bucle-jugable.md §4] [flujo: A2P1] [testing.md: «La tarjeta de a medias solo existe con la salida abierta»] | Must |
| RF-BUCLE-003 | La preparación | Al aceptar se invoca el LLM y se generan las ilustraciones de los 3-5 lugares del reparto, en segundos; sin cobertura la pantalla dice lo mismo y todo cae a fallback en silencio. | [bucle-jugable.md §2] [flujo: A2P5] [testing.md: «Sin cobertura, la preparación dice lo mismo»] | Must |
| RF-BUCLE-004 | Avisos por dos capas | Todo aviso viaja por una capa de bolsillo más una de pantalla; noticias = háptico + marca; oportunidades = notificación + háptico (única que enciende pantalla); completo en una línea, con el dónde nombrado; tocar no acepta nada; nunca durante un beat. | [accesibilidad.md §3] [quests.md decisión 3] [testing.md: «Cada aviso viaja por dos capas y el par mezcla bolsillo y pantalla»] | Must |
| RF-BUCLE-005 | Validar la llegada no es un gesto | Geofence generoso (~30-50 m) validable desde espacio público; parada dentro, la escena queda disponible y espera sin encender pantalla ni ponerse en primer plano. | [bucle-jugable.md, momento 3] [quests.md §3] [testing.md: «La escena queda disponible y espera»] | Must |
| RF-BUCLE-006 | La secuencia de una llegada | Visor (si primera vez con ilustración) → beat (si lo hay; no siempre lo hay) → lo que aquí se cuenta (si es núcleo, siempre al final); ninguna se navega, las encadena llegar. | [bucle-jugable.md §2] [flujo: A4P1] [testing.md: «Lo que aquí se cuenta cierra la llegada a un núcleo»] | Must |
| RF-BUCLE-007 | El visor del anclaje | Slider ficción→foto real con cartela del nombre real; capa y no paso (se cierra y debajo está el resto); la segunda vez no se abre solo y queda a un toque; sin foto de Places abre igual con cartela sobre fondo liso. | [bucle-jugable.md §2] [flujo: A4P2] [testing.md: «El visor abre por la ficción la primera vez»] | Must |
| RF-BUCLE-008 | La ficha de texto | Fallback digno para lo que no tiene ilustración y para el modo sin cobertura: nombre de fantasía, qué es en realidad y la escena, sin anunciar que falte nada. | [bucle-jugable.md §2] [flujo: A4P7] [testing.md: «Llegar sin haber venido a nada da la ficha del sitio»] | Must |
| RF-BUCLE-009 | Abrir la app enseña el estado | Andando, el mapa; parada en geofence, la escena — da igual la puerta de entrada (aviso, rótulo o icono); tocar un aviso abre el mapa con la marca puesta. | [bucle-jugable.md §2] [flujo: A3P4] [testing.md: «Tocar un aviso no acepta nada»] | Must |
| RF-BUCLE-010 | El telón lo echa volver | La salida se cierra al volver al punto de partida (aunque sea en autobús) o a mano desde el rótulo del sistema; se echa solo, sin avisar, y espera a que lo leas. | [bucle-jugable.md §8] [testing.md: «El telón se echa solo al cerrarse la salida»] | Must |
| RF-BUCLE-011 | La secuencia del telón | Mapa siempre → desenlace o cierre en corto en su lugar → «lo que se pone en camino» solo si era notable → diario siempre; el día sin descubrimientos enseña el mapa igual con título de constatación. | [bucle-jugable.md §8] [flujo: A5P1] [testing.md: «Un día sin descubrir nada enseña el mapa igual»] | Must |
| RF-BUCLE-012 | El conocimiento se cobra al telón | Cuatro niveles de conocimiento como estado de partida; en marcha el mapa no cambia (solo tu marca y las de avisos) y el entintado llega de golpe al telón. | [bucle-jugable.md §1] [testing.md: «El mapa no cambia durante la salida»] | Must |
| RF-BUCLE-013 | El rumor se ve salir, no llegar | La pantalla del rumor enseña que algo salió del núcleo, nunca a dónde va, cuándo ni con qué nivel. | [bucle-jugable.md §8] [flujo: A5P3] [testing.md: «El telón no enseña la propagación»] | Must |
| RF-BUCLE-014 | Irse por otro lado no existe | Sin cuenta del trazado: otra calle es invisible, otro sitio no genera reproche ni recálculo, pasar cerca de un beat valida igual; la aventura sigue abierta hasta volver o cerrar a mano. | [bucle-jugable.md §9] ⚠ sin escenario (desvío de trazado) | Must |
| RF-BUCLE-015 | El vehículo se aparta | A velocidad de vehículo el motor de pasos no cuenta y los geofences no validan; en la duda, contar y validar cuentan; la medición del tramo excluye la velocidad ambigua. | [bucle-jugable.md §9] [testing.md: «El vehículo se aparta del reloj del mundo y de la validación»] | Must |
| RF-BUCLE-016 | El desvío se acepta con las piernas | El paraje fuera del lazo se ofrece nombrando el ramal, sin botón y sin cifra; el coste se enseña con el dibujo y una frase; no girar no tiene consecuencia. | [bucle-jugable.md §3] [accesibilidad.md §2] [flujo: A3P5] | Must |
| RF-BUCLE-017 | La salida que espera | Tras mucho rato sin andar, el servicio en primer plano se para y el rótulo desaparece, pero la salida no se cierra: espera en la portada con seguir o dejarlo aquí, y «dejarlo aquí» dispara el cierre en corto. | [bucle-jugable.md §9] [testing.md: «El rótulo se retira pero la salida no se cierra»] | Must |

### 4.8 Personaje y arranque (PJ)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-PJ-001 | Onboarding de siete pantallas | Habla como aplicación hasta el botón «salir a andar»; navegación atrás con progreso y lo contestado precubierto; reanudable si la app se cierra durante la generación; sin pregunta de edad. | [lenguaje.md] [arranque.md] [flujo: A1P1] [testing.md: «El onboarding habla como aplicación»] | Must |
| RF-PJ-002 | Creación: nombre y oficio, nada más | Nombre precargado y sorteado del paquete de idioma (femeninos primero), declarado como del personaje y no de la persona, con filtro de aptitud sobre el texto libre; género gramatical como dato vivo, en femenino por defecto. | [personaje.md §1] [lenguaje.md] [flujo: A1P1] [testing.md: «El personaje llega en femenino»] | Must |
| RF-PJ-003 | El oficio es permanente y filtra | Se elige en el arranque y no se cambia; la pantalla dice qué implica antes de cerrarse y el oficio marcado se despliega; filtra el catálogo por afinidad declarada. | [personaje.md §3] [testing.md: «La pantalla de elección dice qué implica el oficio»] | Must |
| RF-PJ-004 | El tramo se declara y se corrige midiendo | Pregunta en lenguaje de sitios («en media hora andando, ¿tú dónde llegas?»); el ajuste posterior mide el ritmo andando (las paradas no cuentan) y no se comenta jamás. | [accesibilidad.md §1] [flujo: A1P2] [testing.md: «El tramo es una unidad personal y se corrige midiendo»] | Must |
| RF-PJ-005 | Permiso en contexto | El permiso de ubicación «mientras se usa» se pide al levantar el mapa, con la razón delante y con la alternativa de elegir el punto a mano; denegar no es una puerta cerrada. | [seguridad-privacidad.md §2] [flujo: A1P3] | Must |
| RF-PJ-006 | Dónde se levanta el mapa | Pin arrastrable sobre mapa real con círculo de alcance derivado del tramo; el mapa se ancla a coordenada redondeada; es la única decisión irreversible del onboarding. | [alcance-del-mundo.md §2] [flujo: A1P4] | Must |
| RF-PJ-007 | La generación con fases en voz de mundo | Pantalla de espera con las fases del generador dichas como mundo, y la última línea anunciando el prólogo sin explicarlo. | [arranque.md §1] [flujo: A1P5] | Must |
| RF-PJ-008 | Identidad sí, cuerpo no | Ningún atributo del personaje toca velocidad, resistencia ni distancia; el mundo no te llama por tu nombre hasta el hito de arranque. | [personaje.md §1] [testing.md: «Nada del personaje afecta al cuerpo»] | Must |
| RF-PJ-009 | Modo compañía por diseño de texto | Todos los textos escritos para leerse en voz alta; ajuste de tamaño de letra en la propia escena, único registro de aplicación en ese momento. | [personaje.md §4] [flujo: A4P3] ⚠ sin escenario | Should |
| RF-PJ-010 | Nombre y género en ajustes; oficio no | El nombre y el género gramatical se cambian en ajustes sin tocar el mundo; el oficio no aparece. | [personaje.md §3] [flujo: A6P6] [testing.md: «El oficio no aparece en ajustes»] | Must |

### 4.9 Render del mapa (MAPA)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-MAPA-001 | Estilos como datos, pintado sin resembrar | Render por capas donde ningún color ni grosor vive en el código de dibujo; cinco estilos como objetos de datos; cambiar de estilo repinta y jamás resiembra. | [arquitectura.md §2] [flujo: A6P6] [testing.md: «Cambiar el estilo de pintado no resiembra nada»] | Must |
| RF-MAPA-002 | Traslado a Skia | Los cinco estilos del prototipo se trasladan a Skia sin perder el pintado; Reino como estilo por defecto. | [arquitectura.md] ⚠ sin escenario (paridad visual, revisión @manual) | Must |
| RF-MAPA-003 | Colocación de rótulos sin solapes | Algoritmo que calcula posición y tamaño de todos los rótulos antes de pintar y garantiza que ninguno pisa a otro; con placa en núcleos y halo en parajes, que los distingue sin leer. | [arquitectura.md] [flujo: A1P6] ⚠ sin escenario (testing.md lo exige al implementarse) | Must |
| RF-MAPA-004 | Las tres tintas | Lo de hoy recién puesto, lo sabido asentado, lo no sabido a lápiz; sin leyenda; el entintado ocurre al telón y lo ganado se dice en palabras del mundo. | [bucle-jugable.md §8] [flujo: A5P1] [testing.md: «El mapa se entinta al echar el telón»] | Must |
| RF-MAPA-005 | El mapa en marcha | Pantalla completa sin nada encima, norte siempre arriba, la posición como marca roja del propio mundo; los sitios encargados aparecen rotulados aunque no pisados. | [bucle-jugable.md §1] [flujo: A3P2] [testing.md: «El norte está siempre arriba»] | Must |

### 4.10 Partida guardada y mapas (PERS)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-PERS-001 | El mundo se congela entero | Todo lo generado se serializa por mapa (núcleos, servicios, parajes, calzadas, terreno, nombres, anclajes, ilustraciones, fotos y textos del LLM); nunca se depende de regenerar. | [partida-guardada.md §1] [quests.md decisión 1] [testing.md: «El mundo no depende de OSM después de generarse»] | Must |
| RF-PERS-002 | Una salida entera sin red | Con el mundo congelado y la salida preparada, la red no hace falta en ningún momento andando. | [partida-guardada.md §1] [testing.md: «Una salida entera se juega sin red»] | Must |
| RF-PERS-003 | Estado y hechos, y manda el estado | Se guardan el estado y el registro de hechos; el estado es la verdad, el registro basta para reconstruir en emergencia, y al reconstruir con reglas nuevas se avisa de que puede diferir. | [partida-guardada.md §2] [testing.md: «El estado manda sobre el registro»] | Must |
| RF-PERS-004 | Respaldo por la copia del sistema | La partida entra en iCloud/Google Backup, cifrada y bajo la cuenta del jugador, sin servidor propio. | [partida-guardada.md §3] ⚠ sin escenario (inclusión en el respaldo) | Must |
| RF-PERS-005 | Exportar e importar la partida | Fichero exportable con formato y versión, que es también la vía de compartir mundo; importarlo recupera mundo, personaje, diario y rangos. | [partida-guardada.md §3] [testing.md: «La copia guardada se puede volver a abrir»] | Must |
| RF-PERS-006 | Empezar de nuevo es borrar | Explica que el mundo congelado no se puede rehacer, enumera lo que se pierde en cosas, ofrece la copia sin hacerla sola, y lo destructivo no es el botón principal; borrar lleva al arranque. | [partida-guardada.md §4] [flujo: A6P7] [testing.md: «Empezar de nuevo borra y no reinicia»] | Must |
| RF-PERS-007 | Una partida, muchos mapas, sin selector | El mapa activo lo decide dónde estás; lejos de todos, se ofrece levantar uno nuevo; el jugador viaja entero (personaje, oficio, repisa, diario, objetos) y el mundo de casa no avanza en su ausencia. | [alcance-del-mundo.md §3] [testing.md: «Una partida, muchos mapas, y ningún selector»] | Must |
| RF-PERS-008 | Versionado y migración del estado | El estado guardado lleva versión y migra entre versiones del juego. | [partida-guardada.md] ⚠ sin escenario | Must |

### 4.11 Privacidad y menores (PRIV)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-PRIV-001 | Del móvil no sale nada del jugador | Salen exactamente dos cosas: las coordenadas al generar cada mapa, una vez, y prompts de los que se excluye todo dato real; el anclaje real nunca entra en una llamada de red. | [seguridad-privacidad.md §1] [testing.md: «Del móvil no sale nada del jugador»] | Must |
| RF-PRIV-002 | El rastro de ubicación no existe | No se guarda histórico de posiciones ni en la partida ni en el respaldo. | [seguridad-privacidad.md §1] [testing.md: «El rastro de ubicación no se guarda nunca»] | Must |
| RF-PRIV-003 | Solo «mientras se usa» | Nunca se pide el permiso de ubicación permanente; los pasos de salud se leen al abrir. | [seguridad-privacidad.md §2] [testing.md: «La app no pide el permiso de ubicación permanente»] | Must |
| RF-PRIV-004 | El descarte de anclaje | Gesto de dos toques, reversible desde ajustes, sin motivo obligatorio y sin reporte a ningún sitio; saca del casting sin resembrar; con alarma de estirón si el mapa se queda bajo el suelo de parajes. | [seguridad-privacidad.md §3] [flujo: A4P8] [testing.md: «El jugador puede marcar un anclaje que no vale»] | Must |
| RF-PRIV-005 | Apto por diseño | Sin verificación de edad ni modo infantil; horario diurno activado de origen y desactivable; pasos de fondo apagados de origen. | [seguridad-privacidad.md §4] [testing.md: «El juego es apto por diseño y no distingue a un menor»] | Must |
| RF-PRIV-006 | El suelo se declara antes de instalar | El límite de ~250 m de radio por debajo del cual no hay juego se dice claro en la ficha de la tienda, no dentro. | [accesibilidad.md §4] ⚠ sin escenario | Should |

### 4.12 Lenguaje y tono (LANG)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-LANG-001 | Inclusivo con sesgo al femenino | Reformular antes de desdoblar; nada de -e ni -x; la voz narradora sin género visible; repertorio de nombres equilibrado con femeninos primero. | [lenguaje.md] [testing.md: «El lenguaje es inclusivo y el sesgo va hacia el femenino»] | Must |
| RF-LANG-002 | Dos registros con una frontera | El onboarding habla como aplicación y el juego como mundo; los ajustes son la única excepción, marcada hasta en la tipografía. | [lenguaje.md] [flujo: A6P6] [testing.md: «Dos registros con una sola frontera»] | Must |
| RF-LANG-003 | Textos que valen en cualquier mundo | Ninguna frase depende de un número que solo existe en la maqueta; ninguna cifra de distancia o tiempo de esfuerzo en pantalla (el oro y los contadores de contenido sí son admisibles). | [lenguaje.md] [bucle-jugable.md §3] [testing.md: «Ningún texto depende de un número que solo existe en la maqueta»] | Must |
| RF-LANG-004 | Tono cómico-cálido | El humor vive en cómo se cuenta; el chiste nunca a costa del sitio real ni de quien lo regenta; criterio de revisión del catálogo entero. | [bucle-jugable.md §6] [testing.md: «El chiste nunca es a costa del sitio real ni de quien lo regenta»] (@manual) | Must |
| RF-LANG-005 | Filtro de aptitud sobre todo texto LLM | Todo texto generado pasa filtro de contenido apto para menores, con caída a fallback si no pasa; incluye la lista de fórmulas de masculino genérico. | [quests.md decisión 1] [lenguaje.md] [testing.md: «Un texto que no pasa el filtro cae al fallback»] | Must |

### 4.13 Infraestructura (INFRA)

| Código | Nombre | Descripción | Anclas | Criticidad |
|---|---|---|---|---|
| RF-INFRA-001 | Paquete compartido sin plataforma | React Native con Expo; el núcleo determinista (core, world, names, quests, capa de partida) vive en un paquete sin dependencias de plataforma, con la E/S inyectada, y corre igual en Node y en la app; los tests headless viven desde el primer día. | [arquitectura.md §1] [arquitectura.md §2] [testing.md: «No se usa ninguna fuente de azar ni de tiempo del sistema»] | Must |
| RF-INFRA-002 | El proxy ciego | Guarda las claves de LLM, imágenes y Places; verifica con App Attest / Play Integrity sin identificar a nadie; cachea solo lo inerte (imágenes por prompt de ficción, fotos de Places por sitio); no registra quién llama, ni desde dónde, ni guarda partidas. | [arquitectura.md §3] [testing.md: «El proxy no identifica a nadie»] | Must |
| RF-INFRA-003 | Overpass propio | La generación consulta un Overpass del proyecto, no los mirrors públicos, porque la espera cae en el onboarding. | [arquitectura.md] [flujo: A1P5] ⚠ sin escenario | Must |
| RF-INFRA-004 | El rótulo del sistema | Servicio en primer plano con notificación persistente (Actividad en Vivo en iOS) mientras hay salida abierta; austero (destino y nada más), visible a propósito, con la única acción tocable en marcha (terminar la salida); se para solo tras mucho rato sin andar, sin cerrar la salida. | [arquitectura.md] [bucle-jugable.md §8] [bucle-jugable.md §9] [testing.md: «La salida sigue viva con el móvil bloqueado»] | Must |
| RF-INFRA-005 | Detección de modo de transporte | Distingue desplazamiento propio de vehículo con criterios distintos por efecto: el tramo excluye lo ambiguo, contar y validar cuentan en la duda. | [arquitectura.md] [bucle-jugable.md §9] [testing.md: «En la duda, cuenta»] | Must |
| RF-INFRA-006 | Módulos de plataforma con degradación | Salud, háptico, notificaciones y respaldo como módulos; la app funciona aunque falten háptico, notificaciones o respaldo (ninguna capa es portadora única). | [arquitectura.md] [accesibilidad.md §3] ⚠ sin escenario (degradación por módulo ausente) | Must |
| RF-INFRA-007 | El andamiaje de pruebas | Fixtures de OSM congelados (costero, urbano denso, barrio de tres calles, suelo de 250 m), GPS simulado con paradas y vehículo, reloj de mundo controlable, doble del proxy con modo «falla siempre» e inspector de tráfico saliente. | [testing.md: «Lo que hay que montar para poder ejecutar esto»] | Must |

### Resumen de distribución

| Criticidad | Cantidad | % del total |
|---|---|---|
| Must | 107 | 92% |
| Should | 9 | 8% |
| Could | 0 | 0% |
| **Total** | **116** | **100%** |

La ausencia de Could es deliberada: lo que no está decidido no entra como requisito (va a §6 o §7), y lo decidido en `game-design/` es casi todo irrenunciable por diseño. Los Should son las piezas de las que el juego declarado puede prescindir en una primera versión sin contradecir ningún documento (Places de relleno, fotos del visor, la capa de nombres del LLM, zurrón, recado suelto, motes, modo compañía, relación de NPCs, suelo en la ficha de tienda).

## 5. Requisitos no funcionales

### 5.1 Determinismo

- **RNF-DET-001:** Misma semilla + mismos datos de OSM → mundo idéntico byte a byte; cada fase con su sufijo de RNG; prohibidos `Math.random()`, `Date.now()` y la iteración con orden de inserción no controlada en generación. `[testing.md: «El mundo es una función de la semilla y de los datos de OSM»]`
- **RNF-DET-002:** Con LLM y sin LLM, la misma estructura (casting, beats, cantidades, lazo); verificable en headless y sin red. `[quests.md decisión 1]` `[testing.md: «Con LLM y sin LLM la estructura es idéntica»]`
- **RNF-DET-003:** Los escenarios `@determinismo` y `@privacidad` son bloqueantes: nada se despliega con uno en rojo. `[testing.md]`

### 5.2 Privacidad

- **RNF-PRIV-001:** El proxy no usa identificadores persistentes de instalación ni registra llamadas; la atestación verifica la app sin identificar a la persona. `[arquitectura.md §3]`
- **RNF-PRIV-002:** Los datos del jugador solo salen del dispositivo dentro del respaldo cifrado de su propia cuenta (iCloud/Google), nunca hacia servidores del proyecto; el rastro de ubicación no sale ni ahí, porque no se guarda. `[partida-guardada.md §3]` `[seguridad-privacidad.md §1]`

### 5.3 Funcionamiento sin red

- **RNF-RED-001:** Una salida entera se completa sin cobertura, con degradación silenciosa: textos a plantilla, visor a ficha de texto, y ninguna pantalla que mencione la red. `[partida-guardada.md §1]` `[bucle-jugable.md, momento 1]` `[testing.md: «Sin red, la aventura funciona entera»]`
- **RNF-RED-002:** La red solo es obligatoria al generar un mapa y al preparar una salida, nunca andando. `[partida-guardada.md §1]`

### 5.4 Accesibilidad

- **RNF-ACC-001:** El tramo personal redimensiona el juego entero sin modo aparte; ninguna opción es peor juego; la palabra «accesibilidad» no aparece en la interfaz. `[accesibilidad.md §1]` `[accesibilidad.md, encuadre]`
- **RNF-ACC-002:** Ningún aviso viaja por una sola capa, y el par mezcla siempre bolsillo con pantalla. `[accesibilidad.md §3]` `[testing.md: «Ningún aviso viaja por una sola capa»]`
- **RNF-ACC-003:** El suelo es moverse y no andar: cuenta cualquier desplazamiento propio, con el límite (~250 m) declarado antes de instalar. `[accesibilidad.md §4]`

### 5.5 Rendimiento

- **RNF-PER-001:** Generar un mapa tarda menos de un minuto (objetivo fijado al dibujar el arranque, sostenido por el Overpass propio). `[arquitectura.md]` `[flujo: A1P5]`
- **RNF-PER-002:** La preparación de una salida tarda segundos, no minutos. `[flujo: A2P5]`
- **RNF-PER-003:** El render en Skia mantiene el mapa fluido en móviles de gama media con zoom y arrastre, y la colocación de rótulos se calcula antes de pintar. `[arquitectura.md]`

### 5.6 Coste

- **RNF-COST-001:** El coste por jugador (llamadas de LLM, generación de imagen y Places por mapa y por salida) se mide y se presupuesta; las cachés del proxy (imágenes por prompt, fotos por sitio) amortiguan el coste compartible. `[arquitectura.md §3]` — el presupuesto concreto es el pendiente 3 de `arquitectura.md` (§7).

### 5.7 Compatibilidad e internacionalización

- **RNF-COM-001:** iOS y Android con una sola base React Native + Expo; el servicio en primer plano y la Actividad en Vivo se implementan por plataforma con el mismo contrato. `[arquitectura.md §1]`
- **RNF-I18-001:** El idioma del mundo sale de su ubicación (castellano y gallego con interfaz de paquete completa); añadir un idioma es añadir un fichero que implemente la interfaz. `[parajes.md]` `[testing.md: «El idioma sale de la ubicación»]`

## 6. Exclusiones explícitas

| # | Exclusión | Razón | ¿Versión futura? |
|---|---|---|---|
| 1 | **KPIs de producto y analítica** | Incompatibles con el diseño: del móvil no sale nada del jugador y el proxy no registra quién llama `[seguridad-privacidad.md §1]` `[arquitectura.md §3]`. No hay DAU, retención ni embudos posibles, y es una decisión, no una carencia. Lo que sí se mide, abajo. | No |
| 2 | XP, niveles y barras de progresión | Retirados: premiarían a quien más anda `[progresion.md]`. | No |
| 3 | Cifras de esfuerzo, rachas y logros | La pantalla de km/ritmo/racha está dibujada tachada como anti-patrón `[flujo: A3P7]` `[bucle-jugable.md §3]` `[quests.md decisión 4]`. | No |
| 4 | Panel del estado del mundo y marcador de reputación | Lo que se cuenta se oye llegando; el rango se percibe en el trato `[quests.md decisión 3]` `[progresion.md §1]`. | No |
| 5 | Multijugador sincronizado | Otro proyecto (servidores, cuentas, privacidad y menores); el modo compañía lo cubre por lo barato `[personaje.md §4]`. | Por evaluar |
| 6 | Retratos de NPC | Idea sin cerrar; dibujar una cara la habría convertido en decisión por la vía de los hechos `[docs/pendientes.md]` `[flujo: A4P3]`. | Por evaluar |
| 7 | Imágenes generadas de núcleos y nombres de ríos | Ideas sin cerrar de `docs/pendientes.md`; no son compromisos. | Por evaluar |
| 8 | Casas de NPC | Aplazadas: el NPC hereda el anclaje del sitio `[npcs.md §1]`. | Por evaluar |
| 9 | Ramificación de beats | Lineal de inicio; un solo botón en la escena `[quests.md §2]` `[flujo: A4P3]`. | Sí |
| 10 | Selector de mapas y barra de pestañas | El mapa activo lo decide dónde estás; la portada es la casa `[alcance-del-mundo.md §3]` `[flujo: A6P1]`. | No |
| 11 | Dinero real, publicidad y consumo en el anclaje | El oro nunca toca dinero real ni manda a gastar al negocio del anclaje `[progresion.md §2]`. | No |
| 12 | Permiso de ubicación permanente | El diseño no lo necesita: el rótulo del sistema mantiene la app «en uso» `[seguridad-privacidad.md §2]`. | No |
| 13 | Verificación de edad y modo infantil | El juego es apto por diseño y no distingue a un menor `[seguridad-privacidad.md §4]`. | No |
| 14 | Cierre automático de la salida por inactividad | Adivinar mal echa el telón sobre una aventura viva `[bucle-jugable.md §8]`. | No |
| 15 | PWA | Sin HealthKit, sin háptico decente en iOS, sin respaldo del sistema `[arquitectura.md]`. | No |

**Lo que sí se mide, en lugar de KPIs de producto:**

- **La salud del generador**: porcentaje de plantillas que castean y cobertura de escenas sobre mundos sintéticos y reales (`test/casting-report.mjs` y su sucesor sobre el paquete compartido).
- **El coste por jugador**: llamadas de LLM, imagen y Places por mapa y por salida, medido en el proxy sin identificar a nadie (RNF-COST-001).
- **El rendimiento**: tiempo de generación de mapa (< 1 min), tiempo de preparación de salida (segundos) y fluidez del render.
- **La lista de revisión `@manual`** de `docs/testing.md`: tono, gracia del chiste, emoción del visor y percepción del equilibrio del reparto — revisión humana con criterio escrito.

## 7. Supuestos y decisiones pendientes

Pendientes de diseño que este PRD **no resuelve** y de los que cuelgan requisitos. Resolverlos es trabajo de `game-design/`, no de una spec.

**Los tres que bloquean dimensionado o reglas:**

1. **El tamaño de la celda en tramos** (`alcance-del-mundo.md`, pendiente 1). Hay criterio — la celda debe contener el suelo de parajes — pero no número, y sale midiendo. De él cuelga la rejilla entera (RF-MUNDO-003, RF-MUNDO-007). *Supuesto de trabajo: se fija midiendo sobre mundos reales durante la implementación de la rejilla, y se anota en el documento.*
2. **Qué cuenta como «moverse»** (`accesibilidad.md`, pendiente 1). El vehículo se aparta (cerrado el 6-ago-2026); la bici y la silla eléctrica siguen abiertas y arrastran el reloj del mundo (RF-BUCLE-015, RF-INFRA-005). *Supuesto de trabajo: la detección trata como vehículo solo las velocidades inequívocas de motor, y en la duda cuenta.*
3. **Si el rango puede bajar** (`progresion.md`, pendiente 1). Propuesta escrita y sin ratificar: no baja, y el signo de lo que se cuenta sería un eje aparte. *El PRD asume la propuesta (RF-PROG-001 no contempla bajadas) y lo declara aquí.*

**El resto de flecos, con su sitio:** el cierre alternativo del arranque para quien no produce nada notable (`arranque.md` p1) · cuántos pasos dura el prólogo (`arranque.md` p2, sale midiendo) · la lista exacta de oficios, 3-4 (`personaje.md` p4) · el día sin aventura del oficio (`personaje.md` p1, propuesta sin ratificar) · el acompañante en la ficción (`personaje.md` p2) · la forma neutra de género gramatical (`personaje.md` p3) · nombres de los tres escalones de rango y umbrales (`progresion.md` p4) · origen de los objetos-llave (`progresion.md` p2) · el oro acumulado sin tope (`progresion.md` p3) · si dos caras del mismo sitio son el mismo lugar para el casting (`npcs.md` p1, propuesta: sí) · taxonomía de actos que rompen una relación (`npcs.md` p2) · tope de caras por sitio (`npcs.md` p3) · si la cara titular tiene nombre desde el día 1 (`npcs.md` p4) · si los rumores cruzan a mapas lejanos (propuesta: no) y qué pasa con el árbol en la costura de celdas contiguas (`alcance-del-mundo.md` p2 y p3) · cómo se pasa la semilla (`alcance-del-mundo.md` p4) · poda de mapas viejos (`partida-guardada.md` p1) · formato y versión del fichero exportado (`partida-guardada.md` p2) · el texto del aviso de reconstrucción (`partida-guardada.md` p3) · si los textos del LLM se exportan (`partida-guardada.md` p4) · qué pasa cuando la atestación falla (`arquitectura.md` p2) · el presupuesto de coste por jugador (`arquitectura.md` p3) · la caché del proxy de generación como registro de coordenadas (`seguridad-privacidad.md` p2) · qué se le cuenta al jugador sobre privacidad y cuándo (`seguridad-privacidad.md` p3) · las cuestas si algún día hay modelo de elevación (`accesibilidad.md` p2) · cómo se pregunta el tramo sin sonar a formulario médico (`accesibilidad.md` p3) · si el lazo se dibuja completo o se revela (duda abierta del artefacto 2, resuelta provisionalmente: completo en la ficha) · la lista del filtro de masculino genérico y si el equilibrio del reparto se mide por mundo o por partida (`lenguaje.md` p2 y p3) · las lenguas que vengan (`lenguaje.md` p1).

## 8. Riesgos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | **Los términos de Google Places** restringen almacenar contenido (solo `place_id` indefinidamente) y mostrar datos sobre un mapa que no es de Google — que es exactamente el visor y el pool de anclajes. | Alta | Alto | Leer los términos antes de construir encima (`parajes.md` lo exige); si bloquean, el visor degrada a cartela sin foto (ya diseñado, RF-BUCLE-007) y el pool se queda en OSM. |
| 2 | **El catálogo de 20-30 plantillas es trabajo real**: cada una son roles, lazo, fallbacks, desenlace de repuesto, rumor y mote, validada contra el informe de casting (`personaje.md` §3). | Alta | Alto | Validación por informe de casting desde la primera plantilla; ampliar variando roles, no solo historia; el precedente «tres pistas» obliga a test de lazo por plantilla. |
| 3 | **El coste por jugador de LLM e imágenes** no tiene todavía presupuesto (`arquitectura.md` p3). | Media | Alto | Medirlo en el proxy desde el primer día (RNF-COST-001); cachés por prompt y por sitio; la variante «solo anclajes usados» de `bucle-jugable.md` §2 queda como válvula. |
| 4 | **El servicio en primer plano / Actividad en Vivo** son dos plataformas con ciclos de vida distintos, y de ellos cuelga el permiso «mientras se usa». | Media | Alto | Tratarlo como spec propia y temprana (RF-INFRA-004); probar la parada automática y la retirada del rótulo en ambas plataformas. |
| 5 | **La detección de vehículo** puede fallar en ambos sentidos. | Media | Medio | Los criterios por efecto ya están decididos (en la duda, cuenta); no hay marcador que proteger, así que no se aprieta la detección (`bucle-jugable.md` §9). |
| 6 | **La atestación puede dejar fuera a gente legítima** (rooteados, emuladores, sistemas viejos) (`arquitectura.md` p2). | Media | Medio | Decidir la política de rechazo antes de lanzar; medir tasa de fallo de atestación en el proxy (dato agregado, sin identificar). |
| 7 | **El declutter de rótulos** es la deuda de render más antigua y con placas opacas canta a la primera. | Media | Medio | Es RF-MAPA-003 con criticidad Must y spec propia; `testing.md` exige su prueba al implementarse. |
| 8 | **Las cuestas no se pueden prometer** bajo filtro de accesibilidad (sin modelo de elevación). | Alta | Medio | Se declara en lugar de fingir cobertura (`accesibilidad.md` §2); reabrir si algún día hay modelo de elevación. |
| 9 | **Operar Overpass propio** añade una pieza de infraestructura con datos de España completa. | Media | Medio | La imagen Docker y el runbook ya existen en el repo; la caché del proxy amortigua caídas; los mirrors públicos quedan de respaldo degradado. |
| 10 | **Huecos de la batería**: los RF marcados ⚠ no tienen escenario que los verifique (prólogo, hito de arranque, franjas, relación de NPCs, respaldo, migración, Overpass, degradación por módulo, semilla, primera aventura, recado, modo compañía, suelo en ficha, paridad visual de estilos, rótulos). | Cierta | Medio | Ampliar `docs/testing.md` con esos escenarios antes o durante sus specs; el validador `verifica-gherkin.mjs` mantiene la forma. |

## 9. Roadmap

> El orden real de implementación es el de `docs/checklist.md`, que gobierna el pipeline. Esto es la vista de agrupación: qué specs forman cada bloque funcional y qué se puede enseñar al cerrarlo. **No es un calendario** y no lleva semanas: la capacidad del pipeline se conocerá al cerrar el primer bloque.

| Bloque | Qué agrupa | Specs del checklist | Entregable demostrable |
|---|---|---|---|
| B1 · El núcleo portado | Paquete compartido, andamiaje de pruebas, rejilla, tramo, anclajes, parajes, grafo | 1-8 | `headless` y `casting-report` en verde sobre el paquete nuevo, con celdas y tramos |
| B2 · El mundo vivo | Casting, motor de pasos, rumores, prólogo, NPCs, progresión, diario (estado) | 9-16 | Simulación completa de partida en Node: pasos, rumores, rangos y diario, determinista |
| B3 · La palabra | Catálogo de plantillas, contrato LLM, lenguaje y filtros | 17-19 | Aventuras con prosa generada y fallback, validadas contra el informe de casting |
| B4 · La app y el mapa | Scaffold Expo, render Skia, estilos, rótulos, proxy, Overpass, imágenes | 20-26 | Un mapa real generado y pintado en el móvil en menos de un minuto |
| B5 · El bucle en la calle | Onboarding, portada, en marcha, rótulo del sistema, vehículo, llegadas, visor, escena, telón | 27-36 | Una salida completa jugable de puerta a puerta, sin red |
| B6 · Lo que queda en casa | Diario/repisa/ajustes, partida guardada, respaldo, exportación, empezar de nuevo, mapas múltiples, zurrón | 37-42 | Partida que sobrevive a un cambio de móvil; segundo mapa en vacaciones |

**Supuestos del roadmap:** el pipeline ejecuta specs una a una con el bucle `/somo-spec-fable` → `/somo-dev-fable` → `/somo-qa-dev-fable` → `/somo-qa-tester-fable`; las specs de B1-B3 son verificables en Node sin dispositivo (el grueso `@nucleo` de la batería); las de B5 necesitan el andamiaje `@app` (GPS simulado, reloj de mundo) montado en B1; y las estimaciones se revisan al cierre de cada bloque, no antes.

## 10. Historial de cambios

| Versión | Fecha | Cambio | Impacto aguas abajo |
|---|---|---|---|
| 1.0 | 7-ago-2026 | Versión inicial: PRD completo del juego a partir de `game-design/`, los seis artefactos, `docs/flujo.md` y `docs/testing.md` | Nace `docs/checklist.md` con todas las filas `pending` |

**Disciplina de evolución (contractual):**

- El PRD se modifica por **versión nueva con fila en esta tabla**, nunca editando en silencio.
- Cambiar un RF **que ya tiene spec derivada** (ver checklist) no se hace tocando la spec: la fila del historial indica la spec afectada y el cambio llega al código como iteración (`/somo-spec-fable`, modo ITERAR) con el cambio de PRD como motivo.
- Añadir un RF = filas nuevas `pending` en el checklist, preservando los estados existentes.
- Retirar un RF sin implementar = marcar su fila del checklist como retirada; retirar uno implementado = spec de derogación, no un borrado.
- Si un documento de `game-design/` cambia, el PRD va detrás: se actualiza con versión nueva citando la iteración de `docs/starting.md` que lo motivó.
