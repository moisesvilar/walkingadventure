# SPEC-038 — La repisa y los ajustes: lo que te queda, cómo te llaman, y el único sitio que habla como aplicación

## Descripción

Las otras dos puertas de la portada. **La repisa** es lo que la jugadora tiene: los objetos que le quedaron, cada uno con **de quién viene y de qué día**, y debajo los **motes por núcleo**, que son lo único parecido a una ficha de personaje en todo el juego. No es un inventario y esta spec gasta criterios en afirmarlo: no hay peso, no hay huecos, no hay nada que tirar y no hay orden que gestionar. El oro va al pie y en pequeño, porque es una moneda que se gasta y no un marcador.

**Los ajustes** son la excepción. En todo el juego se habla como mundo; aquí se vuelve a hablar como aplicación, y se nota hasta en la tipografía, porque un ajuste disfrazado de acertijo es peor que un ajuste. Que sea la **única** excepción es lo que la hace sostenible, así que esta fila no entrega solo una pantalla: entrega el **mecanismo por el que cada texto del juego declara su registro**, y la comprobación de que la voz de aplicación no asoma en ninguna otra parte. Dentro, el nombre y el género gramatical se cambian sin tocar el mundo, y **el oficio no aparece**: es la única palanca mecánica del personaje, y un oficio cambiable en un toque sería una preferencia y no una decisión.

Cada fila de los ajustes tiene dueña en otra parte del checklist —el tramo, los caminos que evitar, el estilo de pintado, el tamaño de letra, los pasos de fondo, el horario diurno, los sitios marcados, la copia y el empezar de nuevo—. Lo que esta spec posee es **la pantalla, el catálogo cerrado de filas con su grupo, su orden y su valor mostrado, y las dos filas del personaje**; el comportamiento de cada una de las demás sigue siendo de su fila, y aquí solo se declara el hueco por el que entra.

Anclas: **RF-PROG-007**, **RF-PJ-010** y **RF-LANG-002** (`docs/prd.md` §4.5, §4.8 y §4.12), con `game-design/progresion.md` **§4** (la repisa como lo que no es llave, y la simetría «el mapa guarda lo que sabes, la repisa guarda lo que puedes demostrar»), `game-design/personaje.md` **§3** (el oficio no se cambia) y `game-design/lenguaje.md` (los dos registros y su única excepción) como fuentes que mandan sobre el PRD. Pantallas dibujadas: **A6P5** (la repisa) y **A6P6** (los ajustes). Consume SPEC-015 (los objetos con su clase, su procedencia y su día, el oro y el mote por núcleo), SPEC-016 (el estado y su composición por áreas), SPEC-021 (**el catálogo de estilos con sus nombres visibles, el repintado sin resembrar y el factor de tamaño de letra: se consumen tal cual y no se redefine ninguno**), SPEC-004 (el catálogo de las cuatro respuestas del tramo), SPEC-008 (los criterios de «caminos que evitar» como conjunto inyectado) y SPEC-005 (el anclaje descartado y su reversibilidad).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí no la toca**: no aparece ninguna entrada ni salida nueva, y el catálogo de ajustes es una función pura sobre el estado ya cargado.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** **cómo se gana un objeto, un mote o una moneda**, y qué abre un objeto (fila 15, consumida resuelta); **la corrección del tramo y su catálogo de respuestas** (fila 4) y su primera pregunta en el arranque (fila 27); **el filtro de accesibilidad sobre el grafo**, lo que evita y cómo lo declara (fila 8), del que aquí solo se entrega la fila que lo enciende; **el algoritmo de pintado y el catálogo de estilos** (fila 21), consumidos enteros; **la lectura de los pasos de la app de salud, su permiso y el zurrón** (fila 42), de los que aquí solo se entrega la fila del interruptor y su valor de origen; **el horario diurno** y lo que hace (fila 32 y `seguridad-privacidad.md` §4); **el descarte de un anclaje y su reversibilidad** (fila 35), del que aquí solo se entrega la fila que lleva a su lista; **exportar la partida** (fila 39) y **empezar de nuevo** (fila 40), de las que aquí solo se entregan las dos puertas; el **diario** (fila 37); y **la portada** con sus tres puertas (fila 28), de la que esta spec es destino y no dueña.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La repisa», «Los motes», «El catálogo de ajustes» y «El nombre y el género»; la **validación de entradas** en el nombre vacío o de longitud imposible, el género fuera del enumerado, el identificador de fila desconocido y el valor de una fila que su dueña no reconoce; el **estado vacío** en la repisa sin objetos, la partida sin ningún mote, la bolsa a cero y el mapa recién levantado; el **estado de error** en la fila cuyo dueño no está cableado, el objeto sin procedencia y el estilo guardado que ya no existe en el catálogo; y los **casos límite** en el objeto obtenido el mismo día que otro, el núcleo con mote y sin objeto, el cambio de género con textos del narrador ya escritos, y el nombre que coincide con el de un NPC.

**«Fila»** significa siempre una entrada del catálogo de ajustes, con su identificador estable; no se confunde con la fila del checklist, que en esta spec se nombra siempre «fila N del checklist». **«Registro»** significa la voz —de mundo o de aplicación—, no el registro de hechos de SPEC-016.

### La repisa no es un inventario

- **Dado** una partida con cuatro objetos, **cuando** el jugador abre la repisa, **entonces** no hay peso, ni huecos, ni manera de tirar nada.
- **Dado** la superficie de la repisa, **cuando** se buscan una acción de equipar, de ordenar, de combinar o de descartar, **entonces** no existe ninguna de las cuatro.
- **Dado** cada objeto de la repisa, **cuando** se lee, **entonces** dice de quién viene y de qué día.
- **Dado** un objeto obtenido sin ninguna cara detrás —un hallazgo de cuneta—, **cuando** se lee su procedencia, **entonces** declara cómo apareció y no queda en blanco.
- **Dado** los objetos de la repisa, **cuando** se leen en orden, **entonces** salen del más reciente al más antiguo por el día en que se obtuvieron, con un desempate declarado y estable.
- **Dado** un objeto de clase llave y otro de clase recuerdo, **cuando** se leen en la repisa, **entonces** se presentan igual y nada distingue al que abre puertas.
- **Dado** un objeto obtenido en otro mapa, **cuando** se abre la repisa en el mapa activo, **entonces** aparece: los objetos son de la jugadora y no del sitio.
- **Dado** una partida sin ningún objeto, **cuando** se abre la repisa, **entonces** se enseña vacía en voz de mundo y no es un error.
- **Dado** un objeto sin procedencia declarada, **cuando** se proyecta la repisa, **entonces** falla nombrando el objeto, en lugar de pintar una línea a medias.
- **Dado** la repisa entera, **cuando** se buscan cifras, **entonces** la única es el saldo de oro, y no hay ninguna de distancia, tiempo, ritmo, pasos ni progreso.

### Los motes hacen de ficha de personaje

- **Dado** una partida con motes en dos núcleos, **cuando** se abre la repisa, **entonces** debajo de los objetos aparecen los motes, cada uno con el núcleo donde te llaman así.
- **Dado** los motes, **cuando** se leen, **entonces** son solo los del mapa activo.
- **Dado** un núcleo sin mote, **cuando** se lee la lista, **entonces** no aparece, y su ausencia no se declara con ninguna línea vacía.
- **Dado** un mapa recién levantado, **cuando** se abre la repisa, **entonces** no hay ningún mote y el hueco lo dice en voz de mundo, sin explicar por qué.
- **Dado** la lista de motes, **cuando** se busca una barra de reputación, una lista de escalones o un número junto a un pueblo, **entonces** no hay ninguna de las tres.
- **Dado** la lista de motes, **cuando** se lee su orden, **entonces** sale de un criterio declarado y estable y no del orden en que llegaron los rumores.
- **Dado** un mote, **cuando** se lee, **entonces** es el texto del candidato que SPEC-015 declara pegado en ese núcleo, y esta entrega no elige ninguno.

### El oro, al pie y en pequeño

- **Dado** una partida con oro, **cuando** se abre la repisa, **entonces** el saldo aparece al pie, en una línea compuesta en tiempo de ejecución a partir del saldo.
- **Dado** una bolsa a cero, **cuando** se abre la repisa, **entonces** la línea del oro lo dice sin cifra escrita a mano y sin reproche.
- **Dado** la repisa, **cuando** se busca el oro ganado a lo largo de la partida, **entonces** no aparece: solo está el saldo.

### El catálogo de ajustes

- **Dado** los ajustes, **cuando** se enumeran sus filas, **entonces** el catálogo es cerrado y cada fila declara su identificador, su grupo, su orden, su tipo y la fila del checklist que la posee.
- **Dado** los ajustes, **cuando** se enumeran sus grupos, **entonces** son cinco y en este orden: cómo andas, tu personaje, el mapa, el mundo y tus cosas.
- **Dado** el grupo «cómo andas», **cuando** se leen sus filas, **entonces** están el tramo, preguntado en lenguaje de sitios, y los caminos que evitar.
- **Dado** la fila del tramo, **cuando** se lee su valor, **entonces** es la respuesta declarada del catálogo de SPEC-004 y nunca una distancia, un tiempo ni un ritmo.
- **Dado** la fila de los caminos que evitar, **cuando** se lee su etiqueta y su valor, **entonces** en ninguno aparece la palabra accesibilidad ni ningún sinónimo de modo, ayuda o adaptación.
- **Dado** el grupo «el mapa», **cuando** se leen sus filas, **entonces** están cómo se pinta, con el nombre visible del estilo activo, y el tamaño de la letra.
- **Dado** la fila de cómo se pinta, **cuando** se elige otro estilo, **entonces** el mundo sigue idéntico byte a byte y solo cambian colores, grosores y tipografías.
- **Dado** el grupo «el mundo», **cuando** se leen sus filas, **entonces** están contar los pasos del día a día y solo de día.
- **Dado** una instalación nueva, **cuando** se abren los ajustes, **entonces** «contar los pasos del día a día» está desactivado.
- **Dado** una instalación nueva, **cuando** se abren los ajustes, **entonces** «solo de día» está activado, y se puede desactivar.
- **Dado** el grupo «tus cosas», **cuando** se leen sus filas, **entonces** están los sitios que marcaste, con su cuenta, guardar una copia y empezar de nuevo.
- **Dado** la fila de empezar de nuevo, **cuando** se lee su presentación, **entonces** es la última de la última agrupación y no es la acción principal de la pantalla.
- **Dado** el catálogo entero, **cuando** se busca una fila del oficio, **entonces** no existe.
- **Dado** el catálogo entero, **cuando** se busca una fila que cambie el mapa activo, **entonces** no existe.
- **Dado** el catálogo entero, **cuando** se busca una fila que hable de la red, de una cuenta, de una suscripción o de analítica, **entonces** no existe ninguna.
- **Dado** una fila cuyo dueño no está cableado, **cuando** se construye la pantalla, **entonces** falla nombrando la fila y la pieza que falta, en lugar de pintarla apagada.
- **Dado** un identificador de fila que el catálogo no tiene, **cuando** se pide su valor, **entonces** falla nombrando el identificador.
- **Dado** un estilo guardado que ya no existe en el catálogo de SPEC-021, **cuando** se abren los ajustes, **entonces** falla nombrando el estilo, en lugar de caer al de por defecto sin decirlo.

### El nombre y el género se cambian sin tocar el mundo

- **Dado** un jugador que abre los ajustes, **cuando** los recorre, **entonces** puede cambiar su nombre y su género gramatical, pero no su oficio.
- **Dado** un nombre cambiado, **cuando** se comparan los documentos congelados de todas las celdas antes y después, **entonces** son idénticos byte a byte.
- **Dado** un nombre cambiado, **cuando** se compara la semilla de la partida, **entonces** es la misma.
- **Dado** un nombre cambiado, **cuando** se recorren los nombres de núcleos, servicios, parajes, calzadas y ramales, **entonces** ninguno ha cambiado.
- **Dado** un género cambiado, **cuando** se compone un texto de plantilla que se dirige a la jugadora, **entonces** concuerda con el género nuevo.
- **Dado** un género cambiado, **cuando** se leen los textos del narrador ya escritos y guardados, **entonces** siguen tal cual, y ninguno se vuelve a pedir ni se reescribe.
- **Dado** un nombre vacío o compuesto solo de espacios, **cuando** se intenta guardar, **entonces** se rechaza diciendo qué falta, y el nombre anterior sigue.
- **Dado** un nombre más largo que el tope declarado, **cuando** se intenta guardar, **entonces** se rechaza nombrando el tope.
- **Dado** un género fuera del enumerado declarado, **cuando** se intenta guardar, **entonces** falla nombrando el valor recibido.
- **Dado** las sugerencias de nombre, **cuando** se leen, **entonces** las femeninas van primero.
- **Dado** un nombre igual al de un NPC del mundo, **cuando** se guarda, **entonces** se acepta: el índice de nombres únicos es del mundo y el personaje no entra en él.
- **Dado** el ajuste del tramo, **cuando** se lee cualquier texto de la pantalla, **entonces** ninguno insinúa que la jugadora haya andado más o menos últimamente.

### Los dos registros, y su única excepción

- **Dado** el jugador que abre los ajustes, **entonces** se habla como aplicación.
- **Dado** ese registro, **cuando** se recorre cualquier otra pantalla del juego, **entonces** no aparece.
- **Dado** cualquier texto que el juego entrega para pintar, **cuando** se lee, **entonces** declara su registro, y el registro sale de un enumerado cerrado de dos valores.
- **Dado** los textos con registro de aplicación, **cuando** se enumera dónde viven, **entonces** están en el onboarding y en los ajustes, y en ninguna pantalla más.
- **Dado** un texto con registro de aplicación colocado en una pantalla del bucle, **cuando** se compone, **entonces** falla nombrando el texto y la pantalla.
- **Dado** un texto de los ajustes, **cuando** se resuelve su tipografía, **entonces** sale del registro y es la sans, sin que ninguna pantalla la elija a mano.
- **Dado** un texto de la repisa o del diario, **cuando** se resuelve su tipografía, **entonces** es la serif, por el mismo camino.
- **Dado** el ajuste de tamaño de letra de la escena, **cuando** se busca su etiqueta, **entonces** no lleva ninguna palabra de la voz de aplicación dentro del bucle: se cuela sin etiqueta.

### Determinismo y persistencia

Bloqueante (`@determinismo`, RNF-DET-003).

- **Dado** el mismo estado, **cuando** se compone el catálogo de ajustes dos veces, **entonces** las dos composiciones son idénticas.
- **Dado** el mismo estado, **cuando** se proyecta la repisa dos veces, **entonces** las dos proyecciones son idénticas.
- **Dado** un nombre, un género y un estilo cambiados, **cuando** se serializa la partida y se vuelve a cargar, **entonces** vuelven los tres.
- **Dado** el código que esta fila añade, **cuando** se busca en él, **entonces** no aparece `Math.random`, `Date.now` ni ninguna lectura del reloj del sistema.

## UX Design

### Wireframe textual

**A6P5 — La repisa.** Layout de pantalla de consulta: **«‹ Volver»** arriba a la izquierda, titular **«La repisa»** en serif. Debajo, la lista de objetos: cada uno una línea con el **nombre del objeto** en serif a la izquierda, ocupando lo que le haga falta, y a la derecha, en sans pequeño y a la altura de la base del texto, **de quién viene y de qué día** —«de Sabela · día 23», «hallada · día 11», «comprado · día 18», «por qué no · día 26»—; entre líneas, un punteado fino. Sin iconos, sin miniaturas, sin contadores y sin casillas. Después, el rótulo **«Y cómo te llaman»** en serif, y debajo los motes: el mote en itálica a la izquierda y el núcleo en sans pequeño a la derecha —«la de la caja · en Monfrida»—. Al pie, en una sola línea en serif y en cuerpo pequeño, el **oro**, compuesto en tiempo de ejecución a partir del saldo. La lista de objetos y la de motes son la misma columna; no hay pestañas ni secciones plegables.

**Estados vacíos de A6P5.** Sin objetos, una línea en voz de mundo en el sitio de la lista, sin ilustración y sin acción. Sin motes, otra línea en el sitio de los motes, que no explica por qué no hay ninguno. Las dos ausencias pueden darse a la vez, y entonces la repisa es dos líneas y el oro.

**A6P6 — Los ajustes.** Layout de pantalla de consulta, pero **en sans desde el titular**: **«‹ Volver»**, titular **«Ajustes»**. Debajo, los cinco grupos en su orden, cada uno con su **título en versalitas del color del filete** y sus filas. Cada fila es una línea con **etiqueta a la izquierda** y **valor a la derecha** en sans pequeño; entre filas, punteado fino; entre grupos, aire.

```
Cómo andas       En media hora llegas a…    ‹respuesta declarada›
                 Caminos que evitar         ‹resumen de lo elegido›
Tu personaje     Cómo te llamas             ‹nombre›
                 Cómo se dirigen a ti       ‹en femenino | en masculino | …›
El mapa          Cómo se pinta              ‹nombre visible del estilo›
                 Tamaño de la letra         ‹pequeña | mediana | grande›
El mundo         Contar los pasos del día a día   ‹sí | no›
                 Solo de día                ‹sí | no›
Tus cosas        Sitios que marcaste        ‹cuenta›
                 Guardar una copia          ›
                 Empezar de nuevo           ›
```

Tres tipos de fila y ninguno más: **valor**, que abre una elección y vuelve; **interruptor**, que cambia en el sitio; y **puerta**, con el chevron a la derecha, que lleva a otra pantalla. «Guardar una copia» y «Empezar de nuevo» son puertas y son las dos últimas; **«Empezar de nuevo» es la última de todas y no lleva color destructivo aquí** —lo destructivo se declara en su propia pantalla, no en la lista—.

**«Cómo te llamas»** abre una edición de una sola línea, con el nombre actual precargado, las sugerencias con las femeninas primero, y guardar y cancelar. **«Cómo se dirigen a ti»** abre la elección del género gramatical del enumerado declarado. Ninguna de las dos avisa de nada al guardar: se guarda y se vuelve.

**Estado de error.** Una fila cuyo dueño no está cableado no se pinta apagada: la pantalla no se compone y lo dice, en voz de aplicación, nombrando la fila. Es el único sitio del juego donde eso es correcto, precisamente porque aquí se habla como aplicación.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec implementa:
  A6P5  pantalla 5 · artefacto 6 — La repisa      (dueña: esta fila)
  A6P6  pantalla 6 · artefacto 6 — Los ajustes    (dueña: esta fila)

Pantallas de otras filas con las que encaja:
  A6P1  pantalla 1 · artefacto 6 — La portada, sin barra   (dueña: fila 28)
  A6P7  pantalla 7 · artefacto 6 — Empezar de nuevo        (dueña: fila 40)
  A1P2  pantalla 2 · artefacto 1 — Tu tramo                (dueña: fila 27)

Elementos del proyecto que se usan: el filete, el punteado, la tipografía serif de
la voz del mundo y la sans de la voz de aplicación.

Elementos nuevos:
  - la fila de ajuste, en sus tres tipos: valor, interruptor y puerta
  - el grupo de ajustes, con su título en versalitas
  - la línea de objeto de la repisa, con su procedencia y su día a la derecha
  - la línea de mote, con su núcleo a la derecha
```

### data-testid

- `momento` — el momento del bucle, con valor `de-consulta` en las dos pantallas
- `repisa-objetos` — la lista de objetos
- `repisa-objeto` — cada línea, con el identificador del objeto
- `repisa-motes` — la lista de motes
- `repisa-mote` — cada línea, con el identificador del núcleo
- `repisa-oro` — la línea del saldo
- `ajustes-lista` — la lista entera, para afirmar que los grupos están todos y en orden
- `ajustes-grupo` — cada grupo, con su identificador
- `ajustes-fila` — cada fila, con su identificador; es el localizador del que cuelga todo lo demás
- `ajustes-como-se-pinta` — la fila del estilo, que SPEC-021 declaró explícitamente de esta fila
- `ajustes-pasos-de-fondo` — la fila del interruptor de los pasos del día a día, que la fila 42 necesita
- `ajustes-nombre` — la edición del nombre
- `ajustes-genero` — la elección del género gramatical
- `ajustes-registro` — el registro de la pantalla, con un vocabulario cerrado: `mundo`, `aplicacion`

Sin más: las etiquetas de las filas y los valores mostrados son texto único y se localizan por su contenido. **No hay ningún `data-testid` del oficio**, y su ausencia es una afirmación, no un olvido.

### Patrón de interacción

- **La repisa se lee y no se opera.** Regla: `progresion.md` §4, los objetos son llaves y no equipo; y el escenario «La repisa no es un inventario». Sin pulsación larga, sin deslizar para borrar, sin arrastrar para ordenar: los tres gestos que un inventario tendría no están conectados a nada.
- **Los motes van debajo de los objetos y en la misma columna.** Regla: la nota de la pantalla dibujada, «lo único que se parece a una ficha de personaje en todo el juego»; separarlos en dos pantallas los convertiría en un perfil, y ponerlos arriba los convertiría en el marcador de reputación que `progresion.md` §1 descarta.
- **Los ajustes se presentan en lista de filas con valor a la derecha, sin tarjetas ni descripciones bajo cada fila.** Regla: `design-system.md`, los ajustes hablan como aplicación y una aplicación resuelve esto con una lista; una descripción bajo cada fila invitaría a explicar «caminos que evitar», que es exactamente lo que `accesibilidad.md` no quiere que se explique.
- **Un ajuste de valor abre, se elige y vuelve, sin confirmación y sin aviso de éxito.** Regla: SPEC-021 ya lo fija para el estilo —«sin confirmación, sin Toast y sin previsualización a pantalla partida»— y aplicarlo a unas filas y no a otras convertiría la lista en dos listas.
- **El interruptor de los pasos del día a día no se enciende solo por tocarlo.** Regla: `quests.md` §8 y `seguridad-privacidad.md` §2, es opt-in explícito con permisos de salud; el comportamiento del permiso es de la fila 42, y lo que esta fila fija es que el valor mostrado sea el real y nunca el pedido.
- **Lo destructivo no se marca en la lista sino en su pantalla.** Regla: `partida-guardada.md` §4, «lo destructivo no es el botón principal»; pintar «Empezar de nuevo» en rojo dentro de la lista lo convertiría en lo más visible de los ajustes, que es lo contrario de lo que se decidió.
- **La tipografía sale del registro y no de la pantalla.** Regla: `lenguaje.md`, la excepción se nota hasta en la tipografía; si cada pantalla eligiera su fuente a mano, la frontera dependería de que nadie se equivoque una vez.
- **Decisión no cubierta por el design system:** qué pasa con los textos del narrador ya escritos cuando cambia el género gramatical. Se resuelve **dejándolos tal cual**, porque `quests.md` decisión 1 manda no regenerar prosa al vuelo y porque reescribirlos exigiría red en un momento que no la tiene; los textos nuevos ya salen con el género nuevo.
- **Decisión no cubierta por el design system:** el orden de los motes. Se resuelve **por el momento del rumor más reciente que los pegó, del más reciente al más antiguo**, porque es el mismo criterio con el que se ordena todo lo demás que se oye, y ordenarlos por «cuánto te conocen» sería un marcador de reputación con otro nombre.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/repisa.js` | la proyección de la repisa: objetos con procedencia y día, motes del mapa activo, saldo, y sus órdenes declarados |
| `packages/nucleo/partida/ajustes.js` | el catálogo cerrado de filas con grupo, orden, tipo, dueño y valor derivado del estado; la validación del nombre y del género |
| `packages/nucleo/lenguaje/registro.js` | el enumerado de los dos registros, la resolución de tipografía por registro y la comprobación de que la voz de aplicación no sale de sus dos sitios |
| `app/` — las dos pantallas | A6P5 y A6P6, que pintan lo anterior y no calculan nada |

El reparto está elegido para que **casi todo sea afirmable en `@nucleo`**. Que el oficio no aparezca, que los pasos de fondo lleguen apagados, que «solo de día» llegue encendido, que ninguna etiqueta diga accesibilidad, que los grupos estén en orden, que cambiar el nombre no mueva un byte del mundo y que el registro de aplicación no exista fuera de sus dos sitios son afirmaciones sobre **datos**, no sobre píxeles, y se comprueban con `node --test` sin dispositivo. Lo que solo se puede ver con Maestro es la tipografía efectiva y que la repisa no responda a los tres gestos de inventario.

### El catálogo de ajustes, y por qué las filas se registran en lugar de dibujarse

Cada fila declara **quién la posee**. La pantalla no sabe qué es un tramo, ni qué es un estilo, ni qué es un anclaje descartado: pide el catálogo, lo pinta agrupado y devuelve la elección a su dueño. Eso compra tres cosas concretas:

1. **La lista cerrada se puede afirmar.** «No existe una fila del oficio» es un criterio que se puede poner rojo, y «no hay ningún control de mapa activo» también.
2. **Ninguna fila puede aparecer apagada por falta de cableado.** Si el dueño de una fila no está inyectado, la pantalla no se compone y lo dice: §6h, quinta y sexta aparición en este repo. Una fila gris que no hace nada es exactamente una pieza que, al no estar, no protesta.
3. **Las filas de otras filas del checklist entran sin renegociar esta spec**, igual que SPEC-009 dejó los huecos de recursos para B3 y B4.

El catálogo es **cerrado**: añadir una fila es tocar este fichero, a propósito. Los ajustes son el sitio del que más fácil es tirar cuando algo no cabe en el juego, y `lenguaje.md` advierte que dentro del juego lo que solo se puede decir como aplicación es señal de rediseñar el momento, no de añadir un ajuste.

### El registro como dato, que es lo que hace verificable RF-LANG-002

«Los ajustes son la única excepción» es una afirmación sobre todos los textos del juego, y no se puede verificar leyendo pantallas una por una. Aquí se convierte en una propiedad del dato: **todo texto que el juego entrega para pintar declara su registro**, de un enumerado de dos valores, y la comprobación es una consulta sobre el conjunto —qué textos llevan registro de aplicación y en qué pantallas se colocan—.

La tipografía se deriva de ahí y no se elige en la pantalla. Es la misma decisión que SPEC-021 tomó con el estilo: si el color sale del objeto de estilo y no del componente, nadie puede pintar un mapa fuera de la paleta; si la fuente sale del registro y no del componente, nadie puede meter voz de aplicación con la tipografía correcta y que pase desapercibido.

El caso límite declarado es el **tamaño de letra de la escena** (`personaje.md` §4): es un ajuste que asoma dentro del bucle, y se cuela **sin etiqueta y sin ninguna palabra de la voz de aplicación**, que es como `lenguaje.md` dice que se resuelve. Lo que esta spec fija es que su fila de ajustes exista en «El mapa» y que su aparición en la escena no lleve texto.

### Los motes y la superficie de SPEC-015

SPEC-015 afirma que en **su** superficie pública no existe una consulta de todos los motes del mapa a la vez, y la razón es buena: ninguna regla del juego debe bifurcar por el conjunto de motes. La repisa necesita enseñarlos juntos, y aquí se resuelve **sin abrir esa consulta**: la proyección de la repisa recorre los núcleos del mapa activo y pregunta por cada uno con la consulta que SPEC-015 sí ofrece, y el resultado es **de solo lectura y no lo consume ninguna regla**. Queda anotado como el punto de esta spec que más se parece a rozar una decisión ajena, y como candidato a iteración si la fila 15 prefiere exponer la lista ella misma.

### Cambiar el nombre y el género: qué se mueve y qué no

El nombre y el género viven en el área del personaje del estado (SPEC-016) y **no entran en ninguna semilla**. Cambiarlos no toca la semilla de la partida, no toca la derivación de semillas de fase, no toca el índice de nombres del mundo y por tanto no puede mover un byte de ningún documento congelado — y eso es un criterio, no una esperanza.

El género gramatical afecta a la **concordancia de los textos de plantilla**, que se componen en tiempo de ejecución, y **no** a los textos del narrador ya escritos, que se guardaron con la partida y no se regeneran. Es asimétrico y se ve: una entrada de diario de hace tres meses puede dirigirse a la jugadora en el género anterior. Se acepta por la misma razón por la que el diario no se corrige nunca — lo escrito se quedó como se escribió — y porque la alternativa exige red y una llamada por texto.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

- De **«Los objetos son llaves, no requisitos»** (`@app @accesibilidad @bucle`): **«La repisa no es un inventario»**, entero.
- De **«El personaje se elige una vez y el oficio no se cambia»** (`@app`): **«El oficio no aparece en ajustes»**, entero; y **«El mote nace del rumor y es por núcleo»**, del que aquí se sostiene la mitad de pantalla —que los motes se ven por núcleo y juntos—, siendo la de datos de la fila 15.
- De **«Dos registros con una sola frontera»** (`@app @lenguaje`): **«Los ajustes son la única excepción»**, entero, y la mitad de **«El juego habla como mundo»** que consiste en que ningún texto del bucle lleve registro de aplicación.
- De **«El juego es apto por diseño y no distingue a un menor»**: **«El horario diurno viene encendido»** y **«Los pasos de fondo vienen apagados»**, de los que esta spec sostiene el valor de origen y la fila 42 sostiene el comportamiento.
- De **«Lo generado no se resiembra jamás»**: **«Cambiar el estilo de pintado no resiembra nada»**, del que aquí se sostiene que el estilo se cambia desde esta pantalla y en ninguna otra.
- **Frontera, que esta spec deja preparada y no implementa:** **«La copia se ofrece pero no se hace sola»** y **«Se explica que el mundo no se puede rehacer»** (fila 40), **«La copia guardada se puede volver a abrir»** (fila 39), **«Es reversible»** (fila 35) y **«El ajuste no se comenta nunca»** (fila 4).

### Huecos de la batería que esta spec deja al descubierto

1. **Nada afirma que cambiar el nombre no toque el mundo.** Es la mitad de RF-PJ-010 —«sin tocar el mundo»— y no tiene escenario; además es la clase de regresión que aparece el día que alguien mete el nombre en una semilla «para que el mundo sea más tuyo».
2. **El catálogo de ajustes no tiene escenario propio**: ni que los grupos sean cinco, ni su orden, ni que la lista sea cerrada, ni que una fila sin dueño cableado haga fallar la pantalla.
3. **La repisa vacía y la partida sin motes no tienen escenario**, y son el estado de las primeras horas de juego de todo el mundo.
4. **El registro como dato no tiene escenario.** «Los ajustes son la única excepción» se afirma hoy recorriendo pantallas a mano; con el registro declarado se puede afirmar sobre el conjunto de textos, que es lo único que no se desactualiza.
5. **El cambio de género con textos ya escritos no tiene escenario**, y es el caso donde la decisión asumida de esta spec se ve a simple vista.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN`). Regla: `CLAUDE.md` y el grep que cruza specs y batería. Precedente: SPEC-001 a SPEC-026.
- **Sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`.
- **El registro de voz se declara en el dato de cada texto, no en la pantalla** → asumido (alternativa: dejarlo como convención escrita y revisarlo a ojo). Regla: RF-LANG-002 es un requisito sobre todo el juego, y un requisito global que solo se comprueba mirando pantallas no se puede poner rojo; §6o. Es la decisión más discutible de esta spec, porque toca todos los textos del proyecto y no solo esta pantalla.
- **La tipografía se deriva del registro** → asumido (alternativa: que cada pantalla elija su fuente). Regla: `lenguaje.md`, la excepción se nota hasta en la tipografía; derivarla es la única forma de que no dependa de que nadie se equivoque.
- **Los textos del narrador ya escritos no se reescriben al cambiar el género gramatical** → asumido (alternativa: volver a pedirlos con el género nuevo). Regla: `quests.md` decisión 1, la prosa se genera una vez, se cachea y se guarda con la partida; regenerarla exigiría red y contradiría el corolario de que sin red todo se lee igual.
- **El catálogo de ajustes es cerrado y cada fila declara su dueño** → asumido (alternativa: que cada fila del checklist añada su control a la pantalla por su cuenta). Regla: §6h; con filas repartidas, una fila sin cablear se pinta apagada y nadie se entera, que es la forma de fallo que este repo ha pagado siete veces.
- **Una fila sin dueño cableado impide componer la pantalla** → asumido (alternativa: ocultarla o pintarla desactivada). Regla: la misma; y en los ajustes, además, el error se puede decir en voz de aplicación sin romper ningún registro.
- **Los motes que se enseñan son los del mapa activo** → asumido (alternativa: enseñar los de todos los mapas de la partida). Regla: `alcance-del-mundo.md` §3, el rango no viaja y en un mapa nuevo vuelves a ser forastera; una lista con los motes de todos los mapas sería la ficha de reputación acumulada que `progresion.md` §1 descarta.
- **La repisa compone la lista de motes preguntando núcleo a núcleo, sin abrir una consulta de todos a la vez** → asumido (alternativa: pedir a la fila 15 que exponga la lista). Regla: SPEC-015 tiene un criterio explícito de que esa consulta no existe en su superficie, y su motivo —que ninguna regla bifurque por el conjunto— se respeta porque esto es una proyección de lectura. Queda anotado por si la fila 15 prefiere lo contrario.
- **Los objetos se ordenan del más reciente al más antiguo por el día en que se obtuvieron** → asumido (alternativa: por clase, o por el orden en que entraron). Regla: es el mismo criterio del diario, y agrupar por clase separaría las llaves de los recuerdos, que es justo la distinción que la repisa no hace.
- **El oro se enseña como una línea compuesta en tiempo de ejecución y nunca como una cifra suelta con icono** → asumido (alternativa: un contador con una moneda al lado). Regla: `design-system.md`, el oro es la única cifra admitida porque es una moneda que se gasta, y un contador con icono lo convierte en marcador; la maqueta lo escribe como frase.
- **Los tres tipos de fila son valor, interruptor y puerta, y no hay más** → asumido (alternativa: deslizadores, campos libres o selectores en línea). Regla: `design-system.md`, ninguna cifra ni control que invite a ajustar por número; el tramo se pregunta en lenguaje de sitios precisamente para que no haya un deslizador de metros.
- **«Empezar de nuevo» va último y sin color destructivo dentro de la lista** → asumido (alternativa: pintarlo en rojo en los ajustes). Regla: `partida-guardada.md` §4, lo destructivo no es el botón principal; el rojo y el borde hueco viven en su pantalla, que es donde hay sitio para explicar.
- **El nombre tiene un tope de longitud declarado y se valida al guardar** → asumido (alternativa: aceptar cualquier cosa y recortar al pintar). Regla: recortar al pintar es degradación silenciosa; y el nombre entra en textos que se leen en voz alta.
- **Cambiar el estilo o el tamaño de letra no vuelve a la portada** → asumido (alternativa: aplicar y salir de los ajustes para que se vea). Regla: SPEC-021 fija que el cambio de estilo repinta lo que ya hay sin resembrar, así que no hace falta salir para verlo; y sacar al jugador de los ajustes al tocar una fila es voz de aplicación mal educada.
