# SPEC-040 — Empezar de nuevo, que es borrar y no reiniciar

## Descripción

El botón que faltaba en los ajustes, y no es un botón cualquiera. Por la decisión 1 de `game-design/partida-guardada.md`, **el mundo está congelado y no se puede rehacer**: empezar otra vez en la misma calle daría otro sitio con otros nombres, porque los datos de OpenStreetMap ya han cambiado. Así que esto no es «volver a empezar», es destruir algo irrepetible, y la pantalla tiene que decirlo con esas palabras. Es además el único sitio del juego donde una decisión técnica del proyecto se le explica al jugador, y hay que explicarla porque cambia lo que está a punto de hacer.

Cuatro reglas la ordenan, y las cuatro son criterios en esta spec. **Se enumera lo que se pierde en cosas y no en datos** —el personaje por su nombre, los mapas por el suyo, los días de diario y lo que la gente sabe de ti—, porque «esta acción no se puede deshacer» no dice nada que nadie lea. **La copia se ofrece, no se hace sola**: quien quiere irse limpio se va limpio y no le dejamos megas que no ha pedido, y el precio es escribir el aviso para que se lea de verdad. **Lo destructivo no es el botón principal**: guardar copia va arriba, borrar sin nada es una elección explícita y salir sin hacer nada siempre está. Y **borrar lleva al arranque**, a la primera pantalla, sin que quede nada de la partida anterior — borrar, no reiniciar: no hay ninguna ruta que conserve la semilla ni que regenere el mismo mapa.

Aquí se habla como aplicación sin disfraz, y es el caso que mejor justifica la excepción de `game-design/lenguaje.md`: disfrazar esto de mundo sería una trampa.

Anclas: **RF-PERS-006** (`docs/prd.md` §4.10), con `game-design/partida-guardada.md` **§4** como fuente que manda sobre el PRD. Pantalla dibujada: **A6P7**, y sus aristas en `docs/flujo.md` son `A6P6 → A6P7`, `A6P7 -.-> A6P6` («Dejarlo como está») y `A6P7 → A1P1` («Guardar una copia primero, o Borrar sin guardar nada»). Consume SPEC-038 (la fila «Empezar de nuevo» del grupo «Tus cosas» de los ajustes y el registro de voz de aplicación), SPEC-039 (**la exportación, el almacén duradero y su operación de borrado: se consumen tal cual y no se reimplementa ninguna**), SPEC-009 (el índice de cada mapa y su título), SPEC-016 (el estado, el diario y sus días) y SPEC-015 (los motes, que son «lo que la gente sabe de ti»).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí no la toca**: se usan el almacén duradero y el empaquetador que inyecta SPEC-039, con sus mismas operaciones.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** **exportar la partida**, su formato, su versión y su hoja de compartir (fila 39, RF-PERS-005), que aquí se **invoca** y no se reimplementa; **importar** (fila 39), incluida la acción «Abrir una copia» del arranque; **la pantalla de ajustes** y su fila de entrada (fila 38); **las siete pantallas del arranque** a las que se vuelve (fila 27, RF-PJ-001 a RF-PJ-008), de las que aquí solo se consume que A1P1 es el destino; **la lista de mapas de la partida** (fila 41), de la que aquí solo se consumen sus títulos para enumerarlos; y **el texto del aviso de reconstrucción de emergencia**, que sigue siendo el pendiente 3 de `partida-guardada.md` y no tiene nada que ver con esta pantalla.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Lo que se explica», «Lo que se pierde, en cosas» y «Borrar lleva al arranque»; la **validación de entradas** en la partida sin mapas, el mapa sin título y el estado que no se puede leer; el **estado vacío** en la partida del primer día, sin días de diario y sin motes; el **estado de error** en la exportación que falla antes de borrar, el borrado que falla a mitad y el almacén que no responde; y los **casos límite** en la partida con dos mapas, la exportación cancelada por el jugador, el borrado interrumpido por un cierre de la app y el segundo intento después de haber dejado la pantalla.

### Lo que se explica antes de nada

- **Dado** un jugador que entra en «empezar de nuevo», **cuando** lee la pantalla, **entonces** se le dice que su mapa no se puede volver a generar.
- **Dado** esa explicación, **cuando** se lee, **entonces** nombra el mapa por su título y dice que se dibujó con los datos de aquel día y que esos datos ya han cambiado.
- **Dado** esa explicación, **cuando** se lee, **entonces** dice que empezar otra vez en la misma calle daría otro sitio con otros nombres.
- **Dado** esa explicación, **cuando** se busca en ella la frase de que la acción no se puede deshacer, **entonces** no aparece sola: siempre va con lo que se pierde en cosas.
- **Dado** la pantalla entera, **cuando** se lee su registro, **entonces** es el de aplicación, y su tipografía sale de ahí.
- **Dado** la pantalla, **cuando** se lee, **entonces** dice que si se guarda una copia, el fichero se puede volver a abrir cuando se quiera.
- **Dado** la pantalla, **cuando** se buscan cifras, **entonces** las únicas son cuentas de cuánto hay dentro —los días de diario, los mapas— y ninguna de distancia, tiempo, ritmo ni progreso.

### Lo que se pierde, enumerado en cosas

- **Dado** un jugador que entra en «empezar de nuevo», **cuando** lee la pantalla, **entonces** se enumera lo que pierde: personaje, mapas por su nombre, días de diario y lo que la gente sabe de él.
- **Dado** esa enumeración, **cuando** se lee el personaje, **entonces** aparece por su nombre y no como «tu personaje» a secas.
- **Dado** una partida con dos mapas, **cuando** se lee la enumeración, **entonces** los dos aparecen por su título.
- **Dado** esa enumeración, **cuando** se leen los días de diario, **entonces** la cuenta sale del diario de la partida en tiempo de ejecución y no hay ninguna cifra escrita a mano.
- **Dado** esa enumeración, **cuando** se lee lo que la gente sabe, **entonces** se dice en esos términos y no como una lista de rangos, escalones ni porcentajes.
- **Dado** una partida del primer día, sin días de diario y sin motes, **cuando** se lee la enumeración, **entonces** enumera lo que hay y no inventa lo que no: nada aparece con cuenta cero.
- **Dado** una partida sin ningún mapa levantado, **cuando** se entra en la pantalla, **entonces** la explicación del mundo congelado no aparece, porque no hay mundo congelado que perder, y la enumeración sigue siendo correcta.
- **Dado** un mapa sin título en su índice, **cuando** se compone la enumeración, **entonces** falla nombrando el mapa, en lugar de enumerarlo sin nombre.

### Las tres salidas, y cuál es la principal

- **Dado** la pantalla, **cuando** se enumeran sus acciones, **entonces** son tres: guardar una copia primero, borrar sin guardar nada, y dejarlo como está.
- **Dado** esas tres acciones, **cuando** se lee su orden y su peso, **entonces** guardar una copia va primero y es la única con forma de acción principal.
- **Dado** la acción de borrar sin guardar nada, **cuando** se lee su presentación, **entonces** es una elección explícita, con el color de lo destructivo y sin relleno.
- **Dado** la acción de dejarlo como está, **cuando** se busca, **entonces** siempre está disponible y no desaparece en ningún estado de la pantalla.
- **Dado** un jugador que deja la pantalla sin hacer nada, **cuando** vuelve a los ajustes, **entonces** la partida está intacta y no queda ninguna marca de haber entrado.
- **Dado** la pantalla, **cuando** se busca una casilla de confirmación, un texto que haya que teclear o una cuenta atrás, **entonces** no hay ninguno de los tres.
- **Dado** la acción de borrar sin guardar nada, **cuando** se toca, **entonces** borra: no hay un segundo aviso encima del aviso.

### La copia se ofrece pero no se hace sola

- **Dado** un jugador que entra en «empezar de nuevo», **cuando** lee la pantalla, **entonces** se le ofrece guardar una copia.
- **Dado** un jugador que elige borrar sin guardar, **cuando** termina, **entonces** no queda ningún fichero.
- **Dado** un jugador que elige guardar una copia primero, **cuando** la exportación termina bien, **entonces** el borrado continúa.
- **Dado** un jugador que elige guardar una copia primero, **cuando** la exportación falla, **entonces** el borrado **no** ocurre y la partida sigue entera.
- **Dado** un jugador que elige guardar una copia primero, **cuando** cancela la hoja del sistema sin guardar, **entonces** el borrado **no** ocurre y la partida sigue entera.
- **Dado** una copia guardada y la partida borrada, **cuando** se importa el fichero, **entonces** se recupera el mundo, el personaje, el diario y los rangos.
- **Dado** la pantalla, **cuando** se busca una copia hecha por su cuenta antes de entrar, **entonces** no existe ninguna.

### Borrar lleva al arranque

- **Dado** un jugador que confirma el borrado, **cuando** termina, **entonces** está en la primera pantalla del arranque.
- **Dado** ese mismo jugador, **cuando** se lista el almacén, **entonces** no queda nada de la partida anterior bajo ningún prefijo.
- **Dado** ese mismo jugador, **cuando** se busca la semilla de la partida anterior, **entonces** no está en ningún sitio.
- **Dado** el código de esta entrega, **cuando** se buscan rutas que creen una partida conservando la semilla anterior, o que regeneren el mismo mapa, **entonces** no existe ninguna.
- **Dado** el arranque después de un borrado, **cuando** se recorre, **entonces** es el mismo de una instalación nueva y no lleva ningún atajo ni ninguna mención a la partida anterior.
- **Dado** un jugador que borra y empieza otra vez en la misma calle, **cuando** levanta el mapa, **entonces** la semilla es otra y el mundo es otro.
- **Dado** los ajustes después de un borrado y de una partida nueva, **cuando** se leen, **entonces** los valores de origen vuelven a ser los de una instalación nueva.

### El borrado no se queda a medias

Aplicación directa de `pipeline/decisiones-orquestador.md` §6h.

- **Dado** un borrado, **cuando** se observa cómo ocurre, **entonces** primero se marca la partida como en borrado y después se borra.
- **Dado** un borrado interrumpido por un cierre de la app, **cuando** se vuelve a abrir, **entonces** el borrado se termina y se llega al arranque, en lugar de abrir una partida a medias.
- **Dado** una partida marcada como en borrado, **cuando** se intenta abrir por cualquier ruta, **entonces** no se abre: no hay forma de rescatarla a medio borrar.
- **Dado** un almacén que falla al borrar una clave, **cuando** se ejecuta el borrado, **entonces** el error se propaga nombrando la clave y la partida sigue marcada como en borrado.
- **Dado** un borrado terminado, **cuando** se comprueba lo que queda fuera del directorio de la partida, **entonces** los ficheros exportados que el jugador guardó no se han tocado.

## UX Design

### Wireframe textual

**A6P7 — Empezar de nuevo.** Layout de pantalla de consulta, **en sans desde el titular**, porque hereda el registro de aplicación de los ajustes: rótulo de vuelta **«‹ Ajustes»** arriba a la izquierda y titular **«Empezar de nuevo»**.

Debajo, tres bloques de texto y ninguno más, en este orden:

1. **Lo que se pierde**, en una frase que enumera las cosas y las nombra: el personaje por su nombre, los mapas por el suyo, los días de diario con su cuenta y lo que la gente sabe de ti. Termina diciendo que después se vuelve a la primera pantalla.
2. **Por qué no se puede rehacer**, en un párrafo aparte y con el título del mapa dentro: se dibujó con los datos de aquel día, esos datos ya han cambiado, y aunque se empiece otra vez en la misma calle saldría otro sitio con otros nombres.
3. **La salida**, en una línea: si se guarda una copia, el fichero se puede volver a abrir cuando se quiera.

Al pie, empujadas abajo, las tres acciones en este orden y con estos pesos:

```
[  Guardar una copia primero  ]   ← acción principal, sólida
[  Borrar sin guardar nada    ]   ← hueca, con el borde y el texto en el color de lo destructivo
   Dejarlo como está              ← texto, sin caja
```

**Estado de espera.** Al elegir guardar una copia, las tres acciones se sustituyen por una línea de espera, sin barra y sin porcentaje, mientras el fichero se empaqueta; al volver de la hoja del sistema, si se guardó, el borrado continúa sin pedir nada más; si no se guardó, las tres acciones vuelven tal cual y una línea dice que no se ha guardado nada y que la partida sigue.

**Estado de la partida sin mundo.** Si todavía no hay ningún mapa levantado, el segundo bloque no aparece: no hay nada congelado que explicar. La pantalla se queda en dos bloques y las tres acciones.

**Estado de error.** Si el borrado falla, una línea lo dice, la pantalla se queda donde está y la acción de dejarlo como está sigue disponible. No se ofrece reintentar automáticamente y no se menciona ninguna ruta ni ningún código.

### Pantallas y elementos utilizados

```
Pantalla ya dibujada que esta spec implementa:
  A6P7  pantalla 7 · artefacto 6 — Empezar de nuevo   (dueña: esta fila)

Pantallas de otras filas con las que encaja:
  A6P6  pantalla 6 · artefacto 6 — Los ajustes        (dueña: fila 38)
  A1P1  pantalla 1 · artefacto 1 — El arranque        (dueña: fila 27)

Elementos del proyecto que se usan: la tipografía sans de la voz de aplicación,
el color de la marca para lo destructivo, el botón sólido y el botón hueco.

Elemento nuevo: ninguno. Esta pantalla es texto y tres acciones, y esa pobreza
es la decisión: lo que hay que hacer aquí es escribir bien, no dibujar.
```

### data-testid

- `momento` — el momento del bucle, con valor `de-consulta`
- `empezar-de-nuevo` — la pantalla entera
- `empezar-de-nuevo-perdida` — la enumeración de lo que se pierde, para afirmar que nombra las cuatro cosas
- `empezar-de-nuevo-congelado` — el párrafo de por qué no se puede rehacer, que **no existe** si no hay ningún mapa levantado
- `empezar-de-nuevo-guardar` — la acción principal
- `empezar-de-nuevo-borrar` — la acción destructiva
- `empezar-de-nuevo-dejarlo` — la salida
- `empezar-de-nuevo-estado` — el estado de la pantalla, con un vocabulario cerrado: `preguntando`, `guardando-copia`, `borrando`, `no-se-pudo`

Sin más: los tres bloques de texto son texto único y se localizan por su contenido. **No hay ningún `data-testid` de confirmación secundaria**, y su ausencia es una afirmación.

### Patrón de interacción

- **La acción destructiva no es la principal y no está sola.** Regla: `partida-guardada.md` §4, «guardar copia va arriba; borrar sin nada es una elección explícita; salir sin hacer nada siempre está». El orden vertical es el que fija la jerarquía, y el color de lo destructivo va en el botón hueco y no en el sólido, para que el gesto fácil no sea el que borra.
- **No hay segundo aviso, ni casilla, ni texto que teclear.** Regla: `partida-guardada.md` §4, «el precio es que hay que escribir el aviso para que se lea de verdad». Un segundo aviso es la manera de no tener que escribir bien el primero, y además enseña a confirmar sin leer.
- **La copia se ofrece y no se hace sola, y si falla no se borra.** Regla: la misma; «quien quiere irse limpio se va limpio y no le dejamos megas que no ha pedido», y el que sí quiere copia no puede perderla por un fallo silencioso. Encadenar borrado a exportación fallida sería la peor degradación posible del proyecto.
- **Aquí se habla como aplicación sin disfraz.** Regla: `lenguaje.md`, los ajustes son la única excepción, y esta pantalla cuelga de ellos; disfrazar de mundo la destrucción de un mundo sería una trampa. Es el sitio que mejor justifica la excepción y no se debilita con medias voces de ficción.
- **La enumeración se compone en tiempo de ejecución.** Regla: `lenguaje.md`, ningún texto puede depender de un número que solo existe en la maqueta; los días de diario y los títulos de los mapas salen de la partida, y una partida del primer día enseña una frase más corta, no una frase con ceros.
- **La espera se cuenta con una línea y sin cifra.** Regla: `design-system.md`, ninguna cifra de progreso; el mismo criterio que SPEC-026 aplicó a la generación y SPEC-039 a la exportación.
- **Decisión no cubierta por el design system:** qué pasa si el jugador cierra la app durante el borrado. Se resuelve **marcando primero y borrando después**, de modo que al volver a abrir el borrado se termina y se llega al arranque. La alternativa —borrar sin marca— deja una partida a medias que se abre y parece jugable, que es la clase de fallo que este repo ya ha pagado siete veces.
- **Decisión no cubierta por el design system:** si el título del mapa se repite en los dos primeros bloques. Se resuelve **sí**, porque la enumeración nombra los mapas como cosas que se pierden y el párrafo del mundo congelado habla de uno concreto; repetir un nombre propio en dos frases seguidas no es redundancia cuando la segunda explica algo que la primera no dice.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/borrado.js` | la composición de lo que se pierde, la marca de borrado en curso, la enumeración de claves a borrar y el orden en que se borran |
| `app/` — la pantalla A6P7 | los tres bloques, las tres acciones y el encadenado con la exportación de SPEC-039 |

El reparto está elegido para que **casi todo sea afirmable en `@nucleo`**. Lo que se pierde es un **dato estructurado** —el nombre del personaje, la lista de mapas con su título, la cuenta de días de diario y si hay motes— y no una cadena de texto, así que se puede afirmar que están las cuatro cosas, que los mapas van por su nombre, que la cuenta sale de la partida y que una partida del primer día no enumera ceros, todo sin dispositivo. La marca de borrado, el orden de borrado, la idempotencia de terminarlo y que no quede ninguna clave son igualmente afirmables con el almacén de memoria. Lo único que necesita Maestro es la jerarquía visual de las tres acciones.

### La secuencia del borrado, y por qué el orden importa

1. **Se marca** la partida como en borrado, y esa marca se escribe antes que nada.
2. **Se borra** todo lo que cuelga del directorio de la partida, con la operación de borrado del almacén de SPEC-009 y SPEC-039.
3. **Se quita la marca** solo cuando ya no queda nada, y la app va al arranque.

Con este orden, una interrupción en cualquier punto tiene un único final posible: al abrir, la marca está, el borrado se termina y se llega al arranque. Sin la marca, una interrupción a mitad deja una partida con parte de sus documentos, que se abre, que parece jugable y que falla más tarde por una celda que el índice declara y el almacén no tiene — exactamente el error que SPEC-009 ya sabe dar, pero en el peor momento posible.

Lo que **no** se toca en ningún caso son los ficheros que el jugador exportó: viven fuera del directorio de la partida y son suyos.

### Lo que se pierde, como dato y no como frase

`partida-guardada.md` §4 es explícito: «se enumera lo que se pierde en cosas y no en datos». Aquí eso se implementa entregando una **lista estructurada** con cuatro entradas —el personaje con su nombre, los mapas con sus títulos, los días de diario con su cuenta, y si hay motes—, y dejando la redacción a la pantalla. La ventaja no es de estilo: es que «la enumeración nombra los mapas por su título» se puede poner rojo, y sobre una frase montada a mano no se puede.

Una partida del primer día tiene cero días de diario y ningún mote. La lista **omite** lo que no hay en lugar de enumerarlo con cero, porque «pierdes 0 días de diario» es exactamente el tipo de frase que hace que nadie lea el aviso.

### Por qué esta pantalla es la única que explica una decisión técnica

En todo el proyecto, las decisiones técnicas no se le cuentan al jugador: el mundo congelado, el determinismo, la caché y el proxy no asoman en ninguna parte. Aquí sí, y `partida-guardada.md` §4 da la razón: **cambia lo que está a punto de hacer**. Un jugador que cree que puede rehacer su mapa toma esta decisión con datos falsos. Por eso el párrafo del mundo congelado no es un tecnicismo colado: es la única información que la pantalla tiene que dar y que el jugador no puede deducir.

Y por eso desaparece cuando no hay mapa levantado: sin mundo congelado no hay nada irrepetible que perder, y explicarlo sería ruido.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

- De **«Empezar de nuevo borra y no reinicia»** (`@app @persistencia`), que es la característica propia de esta fila: **«Se explica que el mundo no se puede rehacer»**, **«La copia se ofrece pero no se hace sola»** y **«Borrar lleva al arranque»**. El cuarto, **«La copia guardada se puede volver a abrir»**, es de la fila 39; de él aquí solo se sostiene que la copia se ofrece antes de borrar y que sin ella no queda ningún fichero.
- De **«Dos registros con una sola frontera»**: **«Los ajustes son la única excepción»**, del que esta pantalla es el caso extremo y el que mejor lo justifica.
- De **«El personaje se elige una vez y el oficio no se cambia»**: la mitad que `personaje.md` §3 apunta —«la salida, si te arrepientes, es empezar de nuevo»—, que aquí existe de verdad.
- **Frontera, que esta spec consume y no implementa:** **«La copia guardada se puede volver a abrir»** (fila 39) y todo el arranque al que se vuelve (fila 27).

### Huecos de la batería que esta spec deja al descubierto

1. **Que borrar no sea reiniciar no tiene escenario propio.** «Y no queda nada de la partida anterior» es una línea del escenario de borrado, pero nada afirma que no exista una ruta que conserve la semilla, que es la forma en que este requisito se rompería de verdad.
2. **El borrado interrumpido no tiene escenario**, y es el único camino por el que puede quedar una partida a medias.
3. **La exportación fallida antes de borrar no tiene escenario.** «Si elige borrar sin guardar, no queda ningún fichero» cubre una mitad; la otra —elegir guardar, que falle y que **no** se borre— es la que de verdad puede costar una partida.
4. **La enumeración compuesta en tiempo de ejecución no tiene escenario**, ni en su caso normal ni en el de la partida del primer día.
5. **Que los ficheros exportados sobrevivan al borrado no está afirmado en ningún sitio**, y es lo que convierte «guardar una copia» en una salida real y no en un consuelo.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN`). Regla: `CLAUDE.md` y el grep que cruza specs y batería.
- **Sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`.
- **Si la exportación falla o se cancela, el borrado no ocurre** → asumido (alternativa: borrar igual, porque el jugador ya había decidido borrar). Regla: es la única forma de que «guardar una copia primero» signifique lo que dice; borrar tras una copia fallida sería la pérdida de datos más cara del proyecto y ocurriría en silencio. Es la decisión más discutible de esta spec, porque deja al jugador en la pantalla cuando ya se había despedido.
- **Se marca antes de borrar, y una interrupción termina el borrado** → asumido (alternativa: borrar directamente). Regla: §6h; sin marca, una interrupción deja una partida que se abre y parece jugable, que es la forma de fallo que este repo ha pagado siete veces.
- **Una partida marcada como en borrado no se puede rescatar** → asumido (alternativa: ofrecer cancelar el borrado a medias al volver a abrir). Regla: a medio borrar no hay partida que rescatar, solo documentos sueltos; ofrecer rescatarla sería prometer algo que no se puede cumplir.
- **No hay segundo aviso, ni casilla, ni texto que teclear** → asumido (alternativa: pedir escribir el título del mapa para confirmar, que es lo que hacen las herramientas de desarrollo). Regla: `partida-guardada.md` §4 pone el peso en escribir el aviso para que se lea; una confirmación mecánica enseña a confirmar sin leer y además convierte una despedida en un trámite.
- **Lo que se pierde se entrega como lista estructurada y la frase la monta la pantalla** → asumido (alternativa: componer la frase en el núcleo). Regla: así «los mapas se nombran por su título» y «una partida del primer día no enumera ceros» se pueden poner rojos; y la redacción es voz, que se decide donde se escribe.
- **La lista omite lo que no hay en lugar de enumerarlo con cero** → asumido (alternativa: enumerar siempre las cuatro cosas). Regla: `lenguaje.md`, ningún texto depende de un número de maqueta, y «pierdes 0 días de diario» es la frase que garantiza que nadie lea el resto.
- **El párrafo del mundo congelado no aparece si no hay mapa levantado** → asumido (alternativa: enseñarlo siempre). Regla: `partida-guardada.md` §4 lo justifica porque «cambia lo que está a punto de hacer»; sin mundo congelado no cambia nada y sería un tecnicismo gratuito.
- **La pantalla no ofrece ningún atajo para volver a empezar conservando la semilla** → asumido (alternativa: ofrecer «el mismo mundo otra vez» como comodidad). Regla: `partida-guardada.md` §1; con el mundo congelado la semilla no reproduce nada, así que ese atajo sería una promesa falsa, y `personaje.md` §3 apoya el coste: la salida por arrepentirse del oficio tiene que costar lo que cuesta.
- **Los ficheros exportados no se tocan al borrar** → asumido (alternativa: limpiarlos también, para irse de verdad limpio). Regla: son ficheros del jugador, fuera del directorio de la partida, y borrarlos convertiría «guardar una copia primero» en una trampa.
- **El borrado no ofrece reintentar automáticamente si falla** → asumido (alternativa: reintentar en bucle). Regla: `design-system.md`, ninguna pantalla llama fallo a nada ni entretiene a nadie; y con la marca puesta, volver a entrar termina el trabajo.
- **La pantalla se llega solo desde los ajustes** → asumido (alternativa: alcanzarla también desde el arranque o desde la portada). Regla: `docs/flujo.md` solo dibuja la arista `A6P6 → A6P7`, y multiplicar las puertas a lo destructivo es lo contrario de que no sea el botón principal.
