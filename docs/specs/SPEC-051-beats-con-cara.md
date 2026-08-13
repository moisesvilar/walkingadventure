# SPEC-051 — Beats con cara: el rol humano que ninguna plantilla pisaba, y la lista cerrada de los plugins

## Descripción

Veinte de las treinta plantillas del catálogo declaran un rol humano —quien encarga, quien forja, quien regenta— y **ningún beat de ninguna de ellas cae encima**: los beats caen siempre sobre el sitio donde esa persona trabaja. La consecuencia, medida en los cuatro mundos de referencia, es que **0 de 506 beats** casteados tienen `lugar.tipo === 'humano'`, `escena.cara` es siempre nula y el bloque de quien habla de A4P3 no se ha pintado nunca desde que se escribió. Esta fila pone beats encima de esos roles, cierra la regla de casting que hace falta para que un beat pegado a su sitio no se lea como un defecto, y reescribe como parlamento los textos que pasan a decirse en voz de alguien.

Es `pipeline/decisiones-orquestador.md` §6h en su variante de pieza sin quien la alimente, la decimoquinta aparición: `quests/escena.js` compone la cara y cambia el cuerpo a parlamento, `quests/desenlace.js` mira `lugar.tipo === 'humano'` desde SPEC-017, `partida/npcs.js` resuelve el rol humano contra el sitio, `app/marcha/aventura.js` le pone nombre con la misma función pura del casting y `app/pantallas/escena.js` tiene el bloque escrito. Todo eso está entero, probado y esperando a que una plantilla lo produzca.

Va con una **segunda entrega que no es del mismo tema y sí de la misma casa**: la guarda de lista cerrada de `app/plugins/`, decidida por el dueño en `pipeline/decisiones-orquestador.md` §14e·3 — cada plugin nombrado a mano con su cometido, y rojo ante uno nuevo o cambiado hasta que alguien lo nombre.

Anclas: **RF-QUEST-009** (el catálogo de plantillas, con sus roles que castean y sus textos de fallback), **RF-PJ-009** (todos los textos escritos para leerse en voz alta) y **RF-INFRA-007** (el andamiaje de pruebas, que es donde vive la guarda nueva). Las fuentes que mandan sobre el PRD son `game-design/npcs.md` —§1, §3 y el pendiente 1, **ratificado y tachado por esta fila**—, `game-design/quests.md` §2 y §5, `game-design/lenguaje.md` y `game-design/personaje.md` §4.

**Tres decisiones de producto la sostienen y las tres las cerró el dueño el 13-ago-2026**: que dos caras del mismo sitio son el mismo lugar, que el alcance de los beats sale de dos reglas del catálogo y no de una lista escrita a mano, y que el puesto se dice en pantalla con palabras del mundo y nunca con la clave. Van con sus condiciones en «Decisiones cerradas por el dueño», y esas condiciones son parte de la decisión.

Consume, sin rediseñarlo: **SPEC-010** (el casting con backtracking y sus motivos), **SPEC-014** (la capa de NPCs, la plantilla de puestos y `caraDeSitio`), **SPEC-017** (la memoria del testigo y las caras del desenlace), **SPEC-034** (la composición de A4P3 y A4P4) y **SPEC-049** (el cableado que lleva la escena compuesta hasta la pantalla).

**Corre entera en Node y no toma el emulador.** Lo que solo un aparato puede firmar está declarado como límite en «Fronteras y huecos, con dueño».

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `wa-qa-dev` del repo y los ejecuta `wa-qa-tester` contra el código ya commiteado, en un paso posterior del bucle `wa-spec` → `wa-dev` → `wa-qa-dev` → `wa-qa-tester`. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí no la toca**: la cara ya viaja por `app/nucleo/piezas.js` desde SPEC-049 (`identidadDeCara` la pide `app/marcha/aventura.js` en su `DEL_NUCLEO`), y no entra ni sale ninguna pieza nueva por la puerta del núcleo.
- **Ninguna dependencia nueva, y ninguna importación nueva de plataforma.** Todo lo que se toca en `packages/nucleo/` sigue siendo JavaScript ESM puro que arranca sin `node_modules`. Si al implementar apareciera una dependencia, **no se mete**: se para y se dice, con el nombre de la dependencia y de la pieza que la pedía.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** que la cara se vea con el dedo en A4P3 en un aparato —esta fila no toma emulador y eso se ficha como límite—; los **actos de relación sobre roles de sitio**, que hoy revientan el desenlace si alguna vez se toma su decisión y son un hueco anterior a esta fila (ver «Fronteras y huecos, con dueño»); el **contrato con el LLM** para redactar parlamentos, que sigue con su frontera donde estaba; **despertar y conocer** a una cara, que son transiciones de partida y no de esta fila; y la **taxonomía de actos** que rompen y reparan una relación, que es el pendiente 2 de `game-design/npcs.md`.

## Criterios de aceptación

Van en `Dado / cuando / entonces`, el mismo Gherkin español de `docs/testing.md`, y los que reproducen un escenario ya escrito llevan su nombre literal. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La cara llega a la escena» y «Los beats que ganan cara»; la **validación de entradas** en el catálogo que se comprueba al cargarse y en la cara mal formada; el **estado vacío** en el beat sin cara y en la aventura sin ningún rol humano; el **estado de error** en el rol humano que dice trabajar donde no hay rol de sitio y en el servicio sin anclaje; y los **casos límite** en el beat humano pegado a su sitio, en el primero y el último beat de la cadena, y en la plantilla con dos caras.

Los criterios de **`@determinismo` son bloqueantes**: nada se entrega con uno en rojo.

Todo se afirma en `@nucleo`, con `node --test` y sin red ni aparato. Lo único que esta fila **no puede firmar** está en «Fronteras y huecos, con dueño» y no se disfraza de criterio.

### La regla del sitio: un beat sobre un rol humano ocurre donde esa persona trabaja

**Decidida por el dueño el 13-ago-2026**, y con ella el pendiente 1 de `game-design/npcs.md` queda ratificado y tachado allí: dos caras del mismo sitio son el mismo lugar, y de ahí sale la forma general — **un beat sobre un rol humano ocurre en el sitio donde esa persona trabaja; la cara añade quién habla, no dónde.**

Y con ella viene su criterio, que es lo que decide **cómo** se implementa: **no se ablanda ninguna regla — el lugar existe cuando las reglas se comprueban.** Hoy los roles humanos se resuelven **después** del backtracking, así que mientras las comprobaciones corren su lugar no existe: el chequeo de trecho y el del lazo lo **saltan en silencio** y la avería sale mucho más tarde, como `TypeError`, desde el cálculo del recorrido. Es §6h en versión validación —**una comprobación que, al no poder correr, no protesta**— y por eso el arreglo no es exceptuar nada, sino resolver el lugar del beat antes de comprobar.

- **Dado** un beat cuyo rol es humano, **cuando** las comprobaciones del casting recorren la cadena, **entonces** ese beat **tiene lugar resuelto** en todas ellas —trecho, lazo y recorrido—, y ninguna se lo salta por no encontrarlo.
- **Dado** un beat cuyo rol es humano, **cuando** el casting mide el trecho que lo separa del beat anterior o del siguiente, **entonces** lo mide desde el sitio donde esa persona trabaja y no desde una posición propia.
- **Dado** un beat sobre un rol humano y el beat contiguo sobre el rol de sitio donde esa persona trabaja, **cuando** se comprueba el trecho mínimo entre los dos, **entonces** el par queda exento igual que dos beats sobre el mismo rol, y el casting **no** devuelve `trecho-por-debajo-del-minimo`.
- **Dado** el primero o el último beat de la cadena sobre un rol humano, **cuando** se comprueba que el lazo empieza y termina cerca del punto de partida, **entonces** se mide contra el sitio donde esa persona trabaja, y el lazo cierra exactamente igual que si el beat siguiera sobre el sitio.
- **Dado** una plantilla cuyo primer beat cae sobre un rol de sitio y cuyo último cae sobre el rol humano que trabaja en ese mismo sitio, **cuando** el catálogo se comprueba al cargarse, **entonces** la plantilla **pasa**: el lazo se cierra donde se abrió.
- **Dado** una plantilla cuyo primer y último beat caen sobre roles humanos que trabajan en sitios distintos y de tipo distinto, **cuando** el catálogo se comprueba al cargarse, **entonces** falla nombrando la plantilla y los dos roles, como falla hoy con dos roles de sitio.
- **Dado** un rol humano, **cuando** el backtracking reparte los lugares, **entonces** ese rol **no consume ningún candidato del pool** y **no ocupa ningún lugar** en el conjunto de lugares tomados: hereda el del sitio donde trabaja.
- **Dado** dos roles humanos que trabajan en el mismo sitio, **cuando** el casting los resuelve, **entonces** los dos caen en el mismo lugar y eso **no** es el fallo que impide que dos roles distintos compartan sitio: son dos caras del mismo portal, y el portal es uno.
- **Dado** el recorrido que se presupuesta para una aventura, **cuando** un beat cae sobre un rol humano, **entonces** el trecho que lo une con el beat contiguo del mismo sitio cuenta como cero metros y el recorrido total es el mismo que antes de poner el beat encima.
- **Dado** un beat sobre un rol humano, **cuando** se compone el guiado, **entonces** la marca del mapa cae en las coordenadas del sitio donde esa persona trabaja y **no** se dibuja ninguna marca nueva ni ningún tipo de marca nuevo en el mapa.
- **Dado** un beat sobre un rol humano, **cuando** se pregunta qué recursos de ficción le faltan a la aventura para jugarse sin red, **entonces** la ilustración que se pide es la del sitio donde esa persona trabaja y **no** se pide una ilustración aparte por tener cara.
- **Dado** un beat sobre un rol humano que trabaja en un servicio de un núcleo, **cuando** se pregunta si la aventura pasa por ese núcleo, **entonces** la respuesta es la misma que si el beat siguiera sobre el servicio.
- **Dado** un rol humano que dice trabajar en un rol que la plantilla no declara como rol de sitio, **cuando** se castea, **entonces** falla nombrando la plantilla, el rol humano y el rol que dice ser su sitio.

### Los beats que ganan cara

**Decidido por el dueño el 13-ago-2026: las dos cláusulas.** Y quedan escritas **como reglas del catálogo y no como lista**, que es la condición con la que se decidieron: elegir a mano habría sido el anti-patrón de la casa —una lista sin regla es la pieza que al no estar no protesta—, y con regla una plantilla futura que declare `relacion` sobre una cara entra sola en el alcance sin que nadie tenga que acordarse.

- **Cláusula 1** — un rol humano toma **el beat que la `relacion` de su propia plantilla ya le nombra**, cuando ese beat cae sobre el sitio donde esa persona trabaja. Quien escribió la plantilla ya dijo en qué momento esa persona está delante; esta fila se limita a hacerlo cierto en la cadena. Si hay varios, el de **número de beat más bajo**.
- **Cláusula 2** — un rol humano con acto de relación declarado que la cláusula 1 haya dejado sin beat toma **el último beat que cae sobre el sitio donde trabaja**. Es lo que cierra que ninguna cara con acto declarado se quede sin poder recibirlo.
- **Las dos recorren en orden declarado, y es requisito y no detalle.** Los roles humanos se recorren en el orden de `plantilla.orden` —nunca iterando el objeto de roles— y los beats en el orden en que la plantilla los escribe. «El último beat de su sitio» es el último de esa lista, no el último que devuelva un recorrido libre. Medido: los 22 roles humanos del catálogo están en `plantilla.orden`, así que el orden existe. Es justo la clase de azar desplazado que `@determinismo` caza tarde. `@determinismo`
- Un beat ya tomado por una cara **no lo toma otra**: la primera cláusula que llega se lo queda, y la segunda busca el siguiente que cumpla.

Criterios:

- **Dado** el catálogo entregado, **cuando** se cuentan las plantillas que declaran al menos un rol humano, **entonces** siguen siendo **20 de 30**: esta fila no añade ni retira ningún rol.
- **Dado** el catálogo entregado, **cuando** se cuentan los beats que caen sobre un rol humano, **entonces** son **21**, repartidos en **19 plantillas**, y cada uno es el que las dos cláusulas eligen.
- **Dado** el catálogo entregado, **cuando** se aplican las dos cláusulas dos veces sobre las mismas plantillas, **entonces** eligen exactamente los mismos 21 beats. `@determinismo`
- **Dado** cualquier beat que esta fila mueve, **cuando** se compara su escena, su disparador y su resultado con los de antes, **entonces** son los mismos: lo único que cambia es sobre qué rol cae.
- **Dado** un rol humano cuya plantilla declara un acto de relación sobre él, **cuando** se recorre la cadena casteada, **entonces** ese rol pone al menos una cara en ella. Se cumple para los **21** roles con acto declarado del catálogo.
- **Dado** una aventura terminada en la que se toma una decisión con acto de relación sobre una cara, **cuando** se compone su desenlace, **entonces** el acto se aplica a esa cara y el desenlace se compone entero. Es el caso que **hoy revienta** —`componeElDesenlace` lanza porque el rol nombrado no puso cara en la cadena— y queda afirmado en verde, no cerrado de rebote.
- **Dado** una plantilla con dos roles humanos que trabajan en sitios distintos, **cuando** se castea, **entonces** los dos ponen su beat y las dos caras son distintas.
- **Dado** un rol humano sin ningún acto de relación declarado, **cuando** se aplican las dos cláusulas, **entonces** no toma beat: la regla no se estira para llegar al cero. Hoy es uno, `la-carta-sin-remite::quien_recibe`.
- **Dado** las diez plantillas sin ningún rol humano, **cuando** se castean, **entonces** ninguno de sus beats tiene cara y el cuerpo de todas sus escenas sigue siendo párrafo.

### La cara llega a la escena, y se compone entera

- **Dado** un beat sobre un rol humano ya casteado, **cuando** se compone su escena, **entonces** `escena.cara` no es nula y trae el nombre y el puesto de quien habla.
- **Dado** ese mismo beat, **cuando** se compone su escena, **entonces** `escena.cuerpo.forma` es `parlamento`.
- **Dado** un beat sobre un rol de sitio, **cuando** se compone su escena, **entonces** `escena.cara` es nula y `escena.cuerpo.forma` es `parrafo`. Nada de lo demás cambia de sitio.
- **Dado** el mismo beat humano casteado dos veces sobre la misma semilla y el mismo mundo, **cuando** se resuelve la cara por el casting y por la capa de la app, **entonces** las dos vías dan **la misma cara** —el mismo identificador, el mismo nombre y el mismo puesto— y no una parecida. `@determinismo`
- **Dado** una cara sin nombre o sin puesto, **cuando** se intenta componer la escena con ella, **entonces** falla nombrando lo que llegó, y no se compone una escena a medias.
- **Dado** un beat sobre un rol humano cuyo sitio es un servicio sin anclaje real, **cuando** se resuelve la cara, **entonces** falla nombrando el servicio: un NPC hereda el anclaje del sitio y un servicio sin el suyo dejaría la cara sin anclar.
- **Dado** un beat sobre un rol humano en un núcleo colocado por geometría y sin ficha de OSM detrás, **cuando** se resuelve la cara, **entonces** la cara existe y **declara** que no tiene anclaje real, en lugar de callarlo o de fallar: es lo que permite que el mundo mínimo tenga caras.
- **Dado** una aventura terminada cuyo último beat cae sobre un rol humano, **cuando** se compone su desenlace, **entonces** el desenlace ocurre en el sitio donde esa persona trabaja y la cara de ese beat está entre las caras que recuerdan lo que pasó. Escenario: «Una aventura que termina sobre una cara pone el desenlace en el portal y recuerda a quien estaba».
- **Dado** una aventura casteada con dos beats sobre la misma cara, **cuando** se piden las caras del desenlace, **entonces** esa cara aparece **una sola vez**.

### El puesto se dice con palabras del mundo

**Decidido por el dueño el 13-ago-2026: rótulo de mundo por puesto. Nada de `REGENCIA` en pantalla.** Los nueve rótulos se declaran junto a `PUESTOS_POR_TIPO`, en `packages/nucleo/partida/puestos.js`, y son **la fuente única**: cualquier pantalla que enseñe el puesto de una cara lo saca de ahí y no de una segunda traducción.

La lista literal, revisada entera —son nueve, no hay muestreo que valga— y pasada por las mismas reglas duras que vigilan el catálogo (`infraccionesDeTexto` e `infraccionesDeLecturaEnVozAlta`, las dos limpias en los nueve):

| puesto | rótulo |
| --- | --- |
| `regencia` | al frente |
| `vigilancia` | de guardia |
| `vecindad` | del vecindario |
| `cocina` | en la cocina |
| `sala` | en la sala |
| `cuadra` | en la cuadra |
| `limpieza` | al cuidado de la casa |
| `aprendizaje` | en el aprendizaje |
| `acarreo` | en el acarreo |

Son nueve **sintagmas de tarea, no nombres de persona**, y de ahí les viene todo lo que cumplen: no tienen género que elegir, así que no hay masculino genérico que evitar ni morfología que inventar ni nada que desdoblar; nombran lo que se hace y no a quien lo hace, así que **ningún oficio arrastra estereotipo**; y ninguno se puede desmentir generando otro mundo. En versalitas quedan `ANXO O DO NORTE · AL FRENTE`, que es una presentación y no una etiqueta de catálogo.

- **Dado** cada puesto de `PUESTOS`, **cuando** se pide su rótulo, **entonces** existe, es una cadena no vacía y es el de la tabla de arriba.
- **Dado** un puesto nuevo en `PUESTOS_POR_TIPO` sin rótulo declarado, **cuando** se construye el vocabulario, **entonces** **falla nombrando el puesto**. No hay respaldo a la clave: pintar `REGENCIA` en silencio sería exactamente la degradación que esta decisión existe para no cometer, y es el mismo mecanismo que los `exige*` de los vocabularios del telón.
- **Dado** un beat con cara, **cuando** se compone su escena, **entonces** lo que llega a `escena.cara.puesto` es el **rótulo** y no la clave interna.
- **Dado** la pantalla A4P3 montada con un beat con cara, **cuando** se recorre su árbol de componentes, **entonces** el bloque de quien habla pinta el rótulo **y la clave del puesto no aparece en ninguna parte del árbol**.
- **Dado** los nueve rótulos, **cuando** se pasan por el filtro de fórmulas y por el de morfología inventada, **entonces** ninguno coincide con nada. Escenarios: «No se usa masculino genérico en fórmulas frecuentes» y «No se usa morfología inventada».
- **Dado** los nueve rótulos, **cuando** se comprueban para leerse en voz alta, **entonces** ninguno lleva siglas, símbolos, barras, paréntesis ni abreviaturas, y todos son aptos para menores.
- **Dado** cualquier otro sitio del juego que enseñe el puesto de una cara, **cuando** se mira de dónde saca el texto, **entonces** lo saca de esta declaración. Medido hoy: **A4P3 es el único**; el diario, la memoria, la relación, los capítulos y la triangulación llevan el puesto solo como parte de la clave de una cara y ninguna pantalla lo pinta. El criterio queda escrito para quien venga después.

### Los textos que pasan a decirse en voz de alguien

Un beat con cara se pinta entrecomillado. Los veintiún textos que esta fila mueve están escritos hoy como narración —«De vuelta a la plaza te espera la paga»— y entrecomillados se leen mal, así que se reescriben como parlamento. Es texto de catálogo y pasa por `game-design/lenguaje.md` entero.

- **Dado** cada uno de los beats que esta fila pone sobre un rol humano, **cuando** se lee su texto, **entonces** es algo que esa persona dice, y no la narración de lo que te pasa a ti.
- **Dado** esos mismos textos, **cuando** se pasan por el filtro de fórmulas del paquete de idioma, **entonces** ninguno coincide con la lista de masculino genérico evitable. Escenario: «No se usa masculino genérico en fórmulas frecuentes».
- **Dado** esos mismos textos, **cuando** se buscan terminaciones en `-e` y en `-x` usadas como género, **entonces** no aparece ninguna. Escenario: «No se usa morfología inventada».
- **Dado** esos mismos textos, **cuando** se generan diez mundos distintos, **entonces** ninguno se vuelve falso en ninguno de ellos: ninguno depende de un número, de una distancia ni de un tiempo. Escenario: «Ningún texto depende de un número que solo existe en la maqueta».
- **Dado** esos mismos textos, **cuando** se comprueban para leerse en voz alta, **entonces** ninguno lleva siglas, símbolos, barras, paréntesis ni abreviaturas.
- **Dado** esos mismos textos, **cuando** se cuentan sus caracteres, **entonces** ninguno pasa del tope de la clase `beat`, que son 220.
- **Dado** esos mismos textos, **cuando** se lee su registro, **entonces** hablan como mundo: ninguno nombra la aplicación, la red, un permiso, un ajuste ni una pantalla. Escenario: «El juego habla como mundo».
- **Dado** esos mismos textos, **cuando** se revisa a quién apunta el humor, **entonces** en ninguno el chiste es a costa del sitio real ni de quien lo regenta, y el oficio no arrastra estereotipo. `@manual`
- **Dado** esos mismos textos, **cuando** se comprueba la aptitud, **entonces** todos son aptos para menores.
- **Dado** un beat con cara cuyo disparador es de franja, **cuando** se compone su escena, **entonces** la línea que sitúa sigue siendo la prosa de la plantilla y el parlamento es la variante de franja: la cara no se come ninguno de los dos.
- **Dado** un beat con cara cuyo disparador es con objeto y se atraviesa por la vía alternativa, **cuando** se compone su escena, **entonces** el parlamento es el texto de la vía alternativa y la escena **no anuncia** que faltara nada.

### La casteabilidad no baja

Es el criterio duro de la fila. **La referencia de antes, medida por quien orquesta sobre `c51cb77`**, es esta y contra ella se compara: `node test/headless.mjs` en verde; `node test/casting-report.mjs` con **agregado 640/660**, reales **Sanxenxo 30/30 · Toledo 26/30 · Madrid 30/30 · A Coruña 27/30**, motivos **trecho-fuera-del-tope 9 · trecho-por-debajo-del-minimo 6 · recorrido-fuera-del-tamano 2 · lazo-que-no-cierra 3**, y oficios **taberna 317/330 · botica 282/286 · forja 317/330 · mercado 345/352**. Sobre los cuatro mundos de referencia del paquete, **103 de 120** con 506 beats y 0 caras.

Los números de después están medidos con **las dos cláusulas puestas** y no heredados de la medición de una sola: la cláusula 2 cambia el `lugar` de tres beats más, y un negativo no se hereda.

- **Dado** los cuatro mundos de referencia, **cuando** se castea el catálogo entero, **entonces** castean **103 de 120** plantillas-mundo y **ninguna cambia de veredicto**: la casteabilidad no baja **ni una**.
- **Dado** los cuatro mundos de referencia, **cuando** se compara la cadena de sitios beat a beat de cada aventura con la de antes de esta fila —resolviendo cada beat humano a su sitio—, **entonces** son **idénticas en las 120**: ningún rol de sitio cambia de candidato y ningún beat cambia de portal.
- **Dado** los cuatro mundos de referencia, **cuando** se cuentan los beats casteados, **entonces** siguen siendo **506**, y de ellos **69** caen sobre un rol humano donde antes caían **0**.
- **Dado** los cuatro mundos de referencia, **cuando** se cuentan las aventuras casteadas que tienen al menos una cara, **entonces** son **63 de 103**.
- **Dado** el informe de casting sobre mundos sintéticos y reales, **cuando** se compara con el agregado de referencia, **entonces** no baja de **640/660**, ningún mundo real baja de su número, el histograma de motivos no estrena ninguna clave y ningún oficio baja del suyo.
- **Dado** `node test/headless.mjs`, **cuando** se ejecuta después del cambio, **entonces** sigue en verde entero.
- **Dado** cualquier plantilla que dejara de castear, **cuando** se mira su motivo, **entonces** hay motivo de diseño medido y documento de `game-design/` que lo ampare, o el cambio no se entrega.

### Determinismo

- **Dado** el mismo mundo y la misma semilla, **cuando** se castea el catálogo dos veces, **entonces** las dos veces salen las mismas plantillas, con el mismo reparto y con las mismas caras. Escenario: «El casting es determinista». `@determinismo`
- **Dado** el casting, **cuando** se siembra su azar, **entonces** sigue haciéndolo con `makeRng(semilla + sufijo de fase + ':' + identificador de plantilla)`, un sufijo por fase, y **no** aparece ninguna llamada nueva a `Math.random()` ni a `Date.now()`. `@determinismo`
- **Dado** el reparto de una plantilla, **cuando** se compara con el de antes de esta fila, **entonces** es el mismo: poner un beat encima de un rol humano **no consume azar**, porque el rol humano no entra en el pool ni en la baraja. `@determinismo`
- **Dado** el mundo generado, **cuando** se compara con el de antes de esta fila, **entonces** es idéntico byte a byte: esta fila toca el casting, que es capa **encima** del mundo congelado, y ninguna fase de la tubería. `@determinismo`
- **Dado** una cara, **cuando** se resuelve su identidad, **entonces** sale de `semilla + sitio + puesto` y nunca del orden en que se pidió. **Sin escenario en la batería**: es el tercer bullet de `game-design/npcs.md` §1, cerrado el 5-ago-2026 e implementado por SPEC-014, y esta fila lo consume sin cambiarlo. `@determinismo`
- **Dado** una aventura con caras, **cuando** se congela la partida y se vuelve a abrir, **entonces** el reparto recuperado es idéntico beat a beat, caras incluidas. `@determinismo`

### Las guardas de recuento que esta fila mueve

Una guarda que fija un número se actualiza **con el número nuevo medido y con su exigencia cumplida**; nunca se edita para que pase, y nunca se borra la mitad que sigue vigilando. Escribirlas es de `wa-qa-dev`.

- **Dado** `test/nucleo/escena-cableada.test.mjs`, **cuando** cuenta las plantillas con rol humano, **entonces** sigue exigiendo **20** y sigue en verde.
- **Dado** esa misma guarda, **cuando** cuenta los beats casteados de los cuatro mundos, **entonces** sigue exigiendo **506** y sigue en verde.
- **Dado** esa misma guarda, **cuando** cuenta los beats que caen sobre un rol humano, **entonces** exige **69** donde exigía **0**, y su comentario deja escrito qué fila lo cambió y con qué medida.
- **Dado** esa misma guarda, **cuando** se lee la exigencia que su comentario dejaba pendiente —«alguien mire si la cara llega a pantalla»—, **entonces** está cumplida por los criterios de «La cara llega a la escena» y por el montado de A4P3, y **no** retirada.
- **Dado** esa misma guarda, **cuando** se leen sus números, **entonces** están los de esta fila con su medida detrás —**21 beats con cara en 19 plantillas** escritos en el catálogo, **69 instancias casteadas** en los cuatro mundos de referencia— y no un número puesto para que pase.
- **Dado** `test/headless.mjs`, **cuando** comprueba que el primer y el último beat de una aventura caen en el mismo lugar, **entonces** compara el sitio donde ocurre cada uno y no la identidad del objeto, de forma que un último beat con cara cierra el lazo igual.
- **Dado** `test/headless.mjs`, **cuando** comprueba que los lugares de los roles son distintos entre sí, **entonces** sigue excluyendo los roles humanos, como ya hace, y su comentario sigue explicando por qué.
- **Dado** cualquier guarda de recuento que esta fila mueva, **cuando** se compara el report de antes con el de después, **entonces** el número de casos de `@nucleo` no baja: un total que baja no es una tanda mejor.

### La lista cerrada de `app/plugins/`

Segunda entrega, decidida en `pipeline/decisiones-orquestador.md` §14e·3. Vive en `test/nucleo/`, arranca sin `node_modules` y la escribe `wa-qa-dev`. **No se recorta.**

- **Dado** los plugins de `app/plugins/`, **cuando** se enumeran, **entonces** cada uno está nombrado a mano en la guarda con su **cometido declarado** en una frase.
- **Dado** un plugin nuevo en `app/plugins/` que nadie ha nombrado, **cuando** corre la guarda, **entonces** se pone **roja** nombrando el fichero, y no pasa hasta que alguien lo nombre con su cometido.
- **Dado** un plugin de la lista que ha cambiado de forma, **cuando** corre la guarda, **entonces** se pone **roja** nombrando el fichero y el cambio, y no pasa hasta que alguien lo vuelva a nombrar.
- **Dado** un plugin de la lista que ya no existe, **cuando** corre la guarda, **entonces** se pone **roja**: retirar uno es un acto con registro y no una limpieza silenciosa. Es la segunda dirección de rojo de `piezas-sin-consumidor.test.mjs` y de `pantallas-huerfanas.test.mjs`.
- **Dado** la guarda entregada, **cuando** se lee su lista, **entonces** están los dos plugins de hoy —`app/plugins/retira-permisos-prohibidos.js` y `app/plugins/lo-que-exige-health-connect.js`— y ninguno más.
- **Dado** la guarda entregada, **cuando** se lee lo que afirma, **entonces** deja escrito que **«traduce, no decide» sigue siendo revisión humana** y que lo que ella garantiza es la conversación, no la ausencia de lógica de producto en Kotlin.
- **Dado** un clon limpio del repositorio, **cuando** se ejecuta la guarda, **entonces** arranca sin instalar ninguna dependencia y sin importar nada de React Native ni de Expo.

## UX Design

Esta fila **no dibuja ninguna pantalla nueva y no mueve ni un elemento de sitio**. Lo que hace es que un bloque ya escrito de A4P3 se pinte por primera vez. Se documenta aquí porque es la única consecuencia visible, y porque el rótulo de ese bloque es una decisión de lenguaje que hasta hoy nadie había tenido que tomar y que el dueño cerró el 13-ago-2026.

### Wireframe textual

**Pantalla A4P3 · la escena de un beat** (nodo `pantalla 3 · artefacto 4` de `docs/flujo.md`), sobre el layout que ya tiene: papel de placa, tipografía serif, contenido en columna con separación uniforme, y una única acción anclada abajo.

De arriba abajo, con el bloque nuevo en su sitio y sin mover ningún otro:

1. **El sitio**, en serif pequeño y color lápiz: el nombre de fantasía del sitio. Con un beat humano sigue siendo **el nombre del sitio donde esa persona trabaja** —«Forxa do Cervo Dourado»—, nunca el nombre de la persona: el titular de la pantalla es dónde estás.
2. **El titular** de la escena, en serif grande.
3. **La línea que sitúa**, cuando la hay.
4. **Quien habla** — el bloque que esta fila enciende. Una sola línea, en versalitas y color lápiz, con el nombre y el **rótulo de mundo del puesto** separados por un punto medio: `ANXO O DO NORTE · AL FRENTE`. Nunca la clave del catálogo. **Sin retrato** (exclusión 6 del PRD). Sin cara, este bloque no existe y el cuerpo sube a ocupar su sitio sin mover nada más.
5. **El cuerpo**, en serif de lectura. Con cara va **entrecomillado con comillas latinas**; sin cara, sin comillas.
6. **El cierre**, en serif pequeño y color lápiz.
7. **El control de tamaño de letra**, el único elemento en sans de la pantalla, y **la acción** anclada abajo con el verbo de la escena.

El escalón de tamaño de letra se aplica al titular, a la línea que sitúa, al cuerpo y al cierre, como ya hace. **La línea de quien habla no escala**: es un rótulo, no prosa, y es la misma decisión que ya tomó el rótulo del sistema.

### Pantallas y elementos utilizados

Pantallas ya dibujadas que esta fila toca: **A4P3, la escena de un beat** (`pantalla 3 · artefacto 4`) — solo enciende su bloque de quien habla. **A5P1-A5P4, el telón** (`artefacto 5`) reciben las caras del desenlace, que ya sabían leerlas desde SPEC-017 y hasta hoy siempre recibían la lista vacía.

Elementos del proyecto utilizados: la **placa** de papel, el **rótulo en versalitas** de quien habla, el **parlamento entrecomillado**, la **marca del mapa** del guiado —que no cambia— y la **cartela** del telón.

**Ningún componente nuevo, ninguna pantalla nueva, ninguna arista nueva en `docs/flujo.md`.** Esta fila no obliga a tocar el diagrama.

### data-testid

Sin data-testid adicionales: los tres que hacen falta ya existen y esta fila no añade ninguno.

- `TESTIDS.cara` — la línea de quien habla, ya declarada en `packages/nucleo/quests/escena.js` y ya montada en `app/pantallas/escena.js`. Esta fila la hace aparecer por primera vez.
- `TESTIDS.texto` — el cuerpo, que es donde se ve si la forma es parlamento o párrafo.
- `TESTIDS.escena` — la raíz de la pantalla.

### Patrón de interacción

- **El bloque de quien habla aparece y desaparece, no se atenúa.** Sin cara no se pinta nada: no hay marcador de posición, ni línea vacía, ni «anónimo». Es la regla de la casa —lo que no hay no se nombra— y es lo que hace que las escenas sin cara sigan viéndose exactamente como hasta hoy.
- **Las comillas las pone la pantalla y no el texto.** El catálogo escribe el parlamento sin comillas y quien pinta decide la forma según haya cara o no. Así el mismo texto puede leerse en voz alta sin que nadie diga «comillas», y así la decisión de forma vive en un sitio.
- **El puesto se dice con palabras del mundo, no con la clave del catálogo.** Decisión no cubierta por el design system y **cerrada por el dueño**: hoy `escena.cara.puesto` es la clave interna —`regencia`, `vecindad`, `acarreo`, `sala`, `vigilancia`— y la pantalla la pintaría literal en versalitas, así que la primera vez que alguien viera este bloque leería `ANXO O DO NORTE · REGENCIA`. Se resuelve con **un rótulo de mundo por puesto, declarado junto a la plantilla de puestos**, sin género gramatical y con la forma de reformulación que pide `game-design/lenguaje.md`. La tabla de los nueve está en «El puesto se dice con palabras del mundo», y un puesto sin rótulo **es error de construcción**, nunca un respaldo silencioso a la clave.
- **La cara no abre nada.** No es un enlace, no lleva a una ficha de persona y no se puede tocar: conocer, recordar y hablar son transiciones de otras filas. La escena solo dice quién habla.
- **Un beat con cara no cambia el guiado.** La marca del mapa sigue siendo la del sitio, la línea de calzadas la misma y la acción el mismo verbo: quien camina va al mismo portal que iba antes.

## Notas técnicas

### Lo que está medido, y contra qué

Todo lo de esta sección se midió el **13-ago-2026** leyendo el código y ejecutando el paquete sobre los cuatro mundos de referencia (`barrio-tres-calles`, `costero`, `suelo-250m`, `urbano-denso`), en `main` a la altura de `c51cb77`. Nada viene heredado.

- **30 plantillas, 20 con rol humano, 22 roles humanos en total, 147 beats escritos, 0 sobre rol humano.** Confirmado.
- **Los cuatro mundos de referencia castean 103 de 120 (85,8 %), con 506 beats y 0 humanos.** Los motivos de fallo son `lazo-que-no-cierra` 6, `recorrido-fuera-del-tamano` 5, `sin-candidatos` 5 y `trecho-fuera-del-tope` 1.
- **La regla de dos cláusulas convierte 21 beats en 19 plantillas** y deja **103 de 120, 506 beats, 69 con cara y 63 aventuras con al menos una cara**. Se midió con una copia parcheada del casting fuera del árbol; el parche es exactamente lo que esta spec pide y está en el scratchpad de la sesión.
- **Revalidado con las dos cláusulas puestas, y no heredado de la medición de una sola**: **0 plantillas cambian de veredicto** y **0 de 120 cadenas de sitios difieren beat a beat** —comparando la cadena entera con cada beat humano resuelto a su sitio, que es más estricto que comparar el reparto—.
- **Los puestos que salen**: regencia 36, vecindad 24, acarreo 3, vigilancia 3, sala 3. Cocina, cuadra, limpieza y aprendizaje no aparecen todavía en ninguna plantilla y llevan rótulo igual: la tabla cubre `PUESTOS` entero porque un puesto sin rótulo revienta.
- **Los nueve rótulos pasan limpios** las dos comprobaciones duras del catálogo, `infraccionesDeTexto` con `locale: 'es'` e `infraccionesDeLecturaEnVozAlta`, sin una sola infracción en ninguno.
- **Los 22 roles humanos del catálogo están en `plantilla.orden`**, así que el orden declarado con el que las dos cláusulas eligen existe y no hay que inventarlo.
- **La fuente única del rótulo, medida y no supuesta**: el único sitio donde un puesto llega hoy a pantalla es `app/pantallas/escena.js:136`. En `partida/diario.js`, `partida/memoria.js`, `partida/relacion.js`, `partida/capitulos.js` y `partida/triangulacion.js` el puesto viaja **solo como parte de la clave de una cara** (`claveDeCara` / `caraDeClave`, `{ sitio, puesto }`) y ninguna pantalla lo pinta: `diario.jsx` compone el cierre de un hilo con **cuántas** fuentes distintas hay y no con quiénes, `triangulacion.jsx` no pinta la fuente, y `repisa.js` resuelve la procedencia de un objeto con un **nombre** y no con un puesto —y hoy se monta con `SIN_CARAS`—. No hay ninguna segunda traducción que unificar; lo que queda escrito es el criterio para quien venga después.
- **La cara llega entera hasta la escena compuesta.** Sobre el mundo `costero`, los 18 beats humanos de la cláusula 1 componen escena con `cara` no nula, `cuerpo.forma === 'parlamento'` y nombre resuelto por la misma función pura del casting.

### Las tres afirmaciones del encargo que había que cotejar, y la que era falsa

- **Cierta**: la composición está entera y esperando —`escena.js` compone `cara` y cambia la forma a parlamento, `desenlace.js:68` mira `lugar.tipo === 'humano'`, A4P3 tiene el bloque.
- **Cierta**: `casting.js` resuelve los roles humanos después de los lugares y nunca fallan, vía `rolHumanoDelSitio` → `caraDeSitio`, que hereda anclaje y coordenadas del sitio.
- **Falsa**: «un beat sobre `quien_encarga` seguido de uno sobre `origen` hoy caería en `trecho-por-debajo-del-minimo`». **Hoy no cae en ningún motivo: revienta.** Los roles humanos no entran en el backtracking, así que durante toda la comprobación su lugar está sin asignar; el chequeo de trecho lo **salta en silencio** —y con él el del lazo, si el beat es el primero o el último— y la excepción salta más adelante, en `recorridoDe`, con `TypeError: Cannot read properties of undefined (reading 'x')` desde `casting.js:442`. Medido sobre las 20 plantillas × 4 mundos: **70 excepciones**.

Importa porque cambia lo que hay que arreglar, y el dueño lo ha subido a criterio: **no se ablanda ninguna regla — el lugar existe cuando las reglas se comprueban.** Es `pipeline/decisiones-orquestador.md` §6h en una variante que no estaba escrita, la de **validación**: una comprobación que, al no poder correr, no protesta. Las otras cuatro apariciones eran piezas que al faltar no se quejaban; esta es una guarda que estaba puesta, que se saltaba sola y que además tapaba el fallo hasta un punto donde ya no se podía leer el motivo. La consecuencia para quien implemente es directa: **prohibido añadir una excepción para el caso humano**. Lo que se toca es el momento en que el lugar se resuelve, no la regla que lo mide.

### La regla, y los cinco sitios donde hay que aplicarla

Una sola frase, y de ella cuelga todo: **un beat sobre un rol humano ocurre en el sitio donde esa persona trabaja; lo único que la cara añade es quién habla.** El sitio ya viaja dentro de la cara resuelta, en `lugar.trabajaEn`, y `quests/desenlace.js` ya lo desenvuelve así desde SPEC-017: el patrón existe y lo que falta es aplicarlo en los sitios que aún no lo hacen.

**Los cinco están medidos y van declarados aquí a propósito.** Si al implementar aparece un sexto, **se declara** —en el commit y en el informe de la fila— en vez de descubrirse en el cotejo: es la misma regla que las guardas de recuento, y la razón es que un consumidor que se entera tarde de que un lugar puede ser una persona es exactamente §6h otra vez.

1. **`packages/nucleo/quests/casting.js`, la comprobación de estorbos.** El lugar de un beat se resuelve al sitio del rol humano, de forma que el lazo y los trechos se puedan comprobar **durante** el backtracking y no se salten en silencio. La exención del trecho mínimo pasa de «los dos beats comparten rol» a «los dos beats ocurren en el mismo sitio», que es la misma regla dicha con la unidad correcta.
2. **`packages/nucleo/quests/casting.js`, el recorrido y los tramos.** El trecho entre dos beats del mismo sitio es cero, y los tramos que se guardan en el beat casteado se miden entre sitios.
3. **`packages/nucleo/quests/catalogo.js`, la comprobación del lazo de la plantilla.** Hoy exige que el primer y el último beat compartan rol o tipo de rol; con un último beat humano y un primero de sitio, **el catálogo entero deja de cargar**. Medido: falla nombrando `entrega-sospechosa`. La comprobación pasa a mirar el sitio donde ocurre cada uno.
4. **`packages/nucleo/partida/recursos.js`, la clave de elemento.** `claveDeElemento('humano', nombre)` pediría una ilustración que nadie tiene para un sitio cuya ilustración ya está, y `queFaltaParaJugarSinRed` diría que falta algo que no falta. La clave se deriva del sitio. El anclaje real no hace falta tocarlo: `caraDeSitio` ya lo hereda.
5. **`packages/nucleo/partida/arranque.js`, «la aventura pasa por este núcleo».** Un beat humano de un **servicio** trae en `en` el nombre del servicio y no el del núcleo, así que la comprobación dejaría de verlo. Se resuelve al sitio antes de preguntar.

Y un sexto que **no es de `wa-dev`** y va nombrado aquí para que nadie lo descubra en el cotejo: **`test/headless.mjs:167`** comprueba el lazo con `beats[0].lugar === beats[último].lugar`, identidad de objeto, y con doce plantillas cuyo último beat gana cara eso deja de ser cierto. Se generaliza igual —el sitio donde ocurre cada uno— y **lo escribe `wa-qa-dev`**, como todo lo de `test/`.

El conjunto de lugares tomados del backtracking (`lugaresTomados`) **no se toca**: los roles humanos ya estaban fuera del reparto y no consumen lugar. Lo que sí queda escrito, porque nadie lo había dicho, es que **eso es la ratificación del pendiente 1 de `game-design/npcs.md`** — dos caras del mismo sitio son el mismo lugar — y que por eso una aventura no puede mandarte dos veces al mismo portal disfrazando el segundo viaje de persona distinta.

### La lista literal de beats que ganan cara

Cláusula 1 — el beat que la `relacion` de la plantilla ya nombra, cuando cae sobre el sitio donde esa persona trabaja (18 beats, 17 plantillas):

| plantilla | beat | escena | rol antes | rol después |
| --- | --- | --- | --- | --- |
| entrega-sospechosa | 4 | recompensa | origen | quien_encarga |
| la-cuenta-pendiente | 3 | acuerdo | casa | quien_debe |
| el-encargo-de-la-forja | 2 | problema | forja | quien_forja |
| la-receta-perdida | 5 | regreso | botica | quien_atiende |
| la-posada-sin-sitio | 4 | reparto | posada | quien_regenta |
| el-inventario-del-mercado | 4 | cierre | mercado | quien_pesa |
| el-libro-que-no-se-presta | 2 | trato | custodia | quien_guarda |
| la-visita-que-toca | 3 | conversación | casa | quien_espera |
| el-relevo-de-la-guardia | 3 | hallazgo | casa | quien_falta |
| el-relevo-de-la-guardia | 4 | relevo | puesto | quien_guarda |
| el-recado-que-crece | 6 | cierre | origen | quien_manda |
| el-arreglo-de-la-fuente | 3 | trato | taller | quien_forja |
| la-apuesta-de-la-taberna | 4 | veredicto | taberna | quien_sirve |
| el-ungüento-que-huele-mal | 4 | regreso | obrador | quien_prepara |
| la-guarida-de-nadie | 7 | informe | plaza | quien_manda |
| la-feria-que-no-cabe | 7 | cierre | feria | quien_organiza |
| el-camino-de-la-sal | 11 | cierre | reparto | quien_pesa |
| el-refugio-de-la-tormenta | 4 | regreso | taller | quien_avisa |

Cláusula 2 — una cara con acto de relación declarado que la cláusula 1 dejó sin beat toma **el último beat que cae sobre su sitio** (3 beats, 2 plantillas más y una tercera con su segunda cara):

| plantilla | beat | escena | rol antes | rol después |
| --- | --- | --- | --- | --- |
| tres-pistas | 6 | celebración | origen | quien_pregunta |
| la-cuenta-pendiente | 4 | saldo | plaza | quien_cobra |
| la-vigilia-del-monasterio | 7 | regreso | casa | quien_cuida |

Queda **un solo rol humano sin beat**, `la-carta-sin-remite::quien_recibe`, y es a propósito: su plantilla no declara ningún acto de relación sobre él, así que no hay ningún momento escrito en el que esa persona esté delante, y esta fila no se lo inventa. **Las tablas son el resultado de aplicar las reglas al catálogo de hoy, no la definición del alcance**: quien implemente aplica las dos cláusulas y comprueba que salen estos 21; si sale otro número, es que las reglas no están escritas como aquí y se para en vez de ajustar la tabla.

### Lo que no cambia, y conviene decirlo

- **El mundo generado no se toca.** El casting es capa sobre el mundo ya congelado y `mundo.casting` quedó fuera del documento congelado en SPEC-009: esta fila no toca ninguna fase de `build.js` y ningún mundo cambia ni un byte.
- **El azar del casting no se mueve.** Los roles humanos ya estaban fuera de `ordenDeLugares` y de las barajas; poner un beat encima no consume una tirada más. Es lo que hace que el reparto de sitios salga idéntico en las 120 medidas y que ninguna otra fase se desplace.
- **La frontera con el LLM no se mueve.** El parlamento es texto de plantilla con su hueco declarado, como cualquier otro texto de beat, y el prompt sigue sin llevar ni un dato real.
- **La partida no crece.** La cadena de beats no se persiste —se recompone del mundo congelado, SPEC-049— así que las caras tampoco: no hay migración de formato ni versión nueva de documento.
- **Ni un permiso, ni una consulta de red, ni un dato del jugador nuevo.** Esta fila no toca `@privacidad` por ningún lado, y por eso no lleva criterios de esa etiqueta: no tiene nada que afirmar ahí.

### Fronteras y huecos, con dueño

- **La cara vista con el dedo en A4P3.** Esta fila **no toma emulador**: se puede afirmar que la escena se compone con cara, que la pantalla monta el bloque cuando la hay y que no lo monta cuando no, leyendo su fuente como ya hace `escena-cableada.test.mjs`. Lo que **no** se puede firmar aquí es que la línea se vea, quepa y se lea a 1080×2400. **Límite declarado con su motivo, para la primera fila que tome aparato.**
- **Los actos de relación sobre roles de sitio revientan el desenlace, y no es de esta fila.** Medido: `componeElDesenlace` resuelve la cara de un acto con `carasDelDesenlace(beats.filter(...))`, que **solo devuelve caras de beats humanos**, y lanza si no encuentra ninguna. Un acto declarado sobre un rol de núcleo o de servicio —`entrega-sospechosa` declara uno sobre `origen`— no puede resolver nunca. No ha saltado porque las decisiones dentro de una aventura son hoy siempre ninguna. Esta fila lo **cierra para los roles humanos con acto declarado** —por eso existe la cláusula 2— y **deja abierto el caso de los roles de sitio**, que necesita decidir qué cara de un sitio recibe un acto dirigido al sitio entero. Es hueco de la capa de relación, viene de SPEC-014 y **se ficha con dueño**.
- **`test/casting-report.mjs` necesita `node server.mjs` corriendo.** El árbol es un recurso compartido: quien lo ejecute lo declara antes, con `pgrep` contra el patrón y no de memoria.

## Decisiones cerradas por el dueño (13-ago-2026)

Las tres se decidieron en la ventana de quien orquesta, con el dueño delante, y **dejan de ser propuestas**. Van aquí con la alternativa que se descartó y con la condición que cada una trae, porque la condición es parte de la decisión.

1. **Pendiente 1 de `game-design/npcs.md` → ratificado: sí, mismo lugar.** Un beat sobre un rol humano ocurre en el sitio donde esa persona trabaja; la cara añade **quién habla**, no **dónde**. Descartada la alternativa de que una cara sea lugar propio, que habría obligado a decidir qué distancia separa dos caras del mismo portal y habría vuelto a meter a los NPCs a competir por el recurso escaso que la enmienda de `npcs.md` les quitó. **Condiciones**: el pendiente queda **tachado en `game-design/npcs.md`** con su línea de resultado —la decisión vive en `game-design/`, no solo aquí—; el criterio «**el lugar existe cuando las reglas se comprueban**» queda escrito y **prohíbe cualquier excepción para el caso humano**; y los **cinco sitios** medidos van declarados en «La regla, y los cinco sitios donde hay que aplicarla», más el sexto que es de `wa-qa-dev` (`test/headless.mjs:167`). Un séptimo, si aparece, se declara.
2. **Alcance de los beats → las dos cláusulas: 21 beats en 19 plantillas.** Descartada la alternativa de elegir a mano una cara por plantilla, por ser el anti-patrón de la casa: una lista sin regla es la pieza que al no estar no protesta. **Condiciones**: las dos cláusulas van escritas **como reglas del catálogo**, de forma que una plantilla futura con `relacion` sobre una cara entre sola en el alcance; **«el último beat de su sitio» es determinista por construcción**, por el orden declarado de `plantilla.orden` y de la lista de beats y nunca por una iteración de orden libre; el **caso «acto de relación sin cara», que hoy revienta, queda afirmado en verde** y no cerrado de rebote; y la medida de «0 repartos alterados» está **revalidada con las dos cláusulas puestas** —0 veredictos cambiados y 0 de 120 cadenas distintas—, no heredada de la medición de una sola.
3. **Rótulo del puesto → rótulo de mundo por puesto.** Nada de `REGENCIA` en pantalla. Descartada la alternativa de pintar la clave literal. **Condiciones**: los nueve rótulos son **textos de mundo nuevos**, revisados **enteros y no por muestreo**, sin género, sin `-e` ni `-x`, sin desdoble, legibles en voz alta y aptos para menores, y pasados por las reglas duras del catálogo —hechas, y las nueve limpias—; **un puesto sin rótulo es error de construcción** y nunca un respaldo a la clave; **la clave no sale a pantalla jamás**, afirmado en el montado de A4P3; y la declaración es **fuente única**, medida y no supuesta: hoy A4P3 es el único sitio donde un puesto llega a pantalla.

## Decisiones asumidas

Lo que sigue sin cerrar por el dueño, con su default aplicado y su alternativa. Ninguna de las tres decisiones de arriba depende de estas.

- **Dónde vive la declaración de los rótulos** → asumido `packages/nucleo/partida/puestos.js`, junto a `PUESTOS_POR_TIPO`, que es donde ya viven la plantilla de puestos y el reparto de género (alternativa: en el paquete de idioma, que sería lo correcto el día que exista un idioma con puestos distintos y hoy sería una indirección sin caso). Criterio: fuente única y sin capa que no tenga caso. Queda anotado para cuando ese día llegue.
- **Si `game-design/lenguaje.md` gana una línea** → asumido que **sí**: los puestos tienen rótulo de mundo y la clave no sale nunca a pantalla (alternativa: dejarlo solo en la spec, que rompería el hábito de que el diseño mande sobre el código). Criterio: `CLAUDE.md`, «si el cambio contradice el diseño, actualiza también el documento». **No lo hace esta spec**: se anota como lo que la fila debe dejar escrito al cerrarse, junto a la entrada de `docs/starting.md`.
- **`docs/pendientes.md` no se toca** → comprobado: el pendiente 1 de `npcs.md` **no tenía anotación individual** allí. `pendientes.md` cierra la capa de NPCs entera en su entrada del 5-ago-2026 y menciona los flecos solo en bloque, así que no hay ninguna línea que tachar y no se inventa una.
