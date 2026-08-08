# SPEC-015 — La progresión: rango social por núcleo, oro que compra saber, y objetos que son llaves

## Descripción

Este juego no tiene niveles, y esta fila es la que lo hace verdad. Lo que sube no es la jugadora: es **lo que cada pueblo le concede**, en una escalera corta de tres escalones con nombre y sin un solo número, que se calcula a partir de **lo que le ha llegado a ese núcleo** y no de haber pisado el sitio. De ahí salen las dos consecuencias que ordenan el juego entero y que aquí se entregan como dato: se puede ser alguien en un pueblo donde no se ha estado nunca, porque la noticia llegó antes; y un pueblo por el que se pasa a diario sin que le llegue nada sigue tratando a la jugadora de forastera. **Avanza igual quien anda seis kilómetros que quien anda novecientos metros**, porque lo que cuenta es lo que se hizo y no cuánto se movió, que es la condición que impone `accesibilidad.md`.

La segunda mitad es la económica, y es la misma vista del otro lado: **el rango es crédito social y el oro lo suple cuando no lo hay**. Lo que el rango cambia es el **trato y el precio, nunca el catálogo** — a todo el mundo se le ofrece lo mismo, y lo que varía es el tono con que se lo dicen y lo que cuesta, **incluido el precio cero** de quien ya es de aquí. Y el oro compra lo único que este mundo tiene de sobra: **saber y favores, nunca metros**. No se puede pagar por no andar, y lo que se compra es **la versión que a ese informante le llegó**, con su deformación encima: pagar no da la verdad, da otro nodo del árbol de rumores. Puede salir peor que ir andando.

La tercera pieza son los **objetos-llave**, y su regla es toda la regla: **abren otra puerta al mismo beat, nunca son un requisito**. El disparador `con_objeto` que `quests.md` §2 dejó especificado y sin usar se enciende aquí, y siempre contra una vía alternativa que lleva al mismo sitio. Es el primer mecanismo de arcos largos del proyecto: si la hebilla de latón que apareció en la cuneta un martes abre una conversación tres semanas después, **aquel paseo tonto se vuelve retroactivamente algo**. Y encima, por ser por núcleo, sale el **mote**: se pega el candidato que más suena de lo que allí se oyó, y es distinto en cada pueblo.

Y una restricción estructural que esta spec afirma en voz alta porque es lo más fácil de romper: **aquí no baja nada**. El rango es función pura de lo que un núcleo ha oído, y lo oído no caduca ni se olvida (SPEC-012), así que la monotonía no es una regla que haya que vigilar sino una propiedad del cálculo. El único mecanismo del proyecto que puede ir hacia abajo sigue siendo la relación por cara de SPEC-014, y esta entrega no añade un segundo.

No tiene interfaz de usuario. Las pantallas donde esto se ve son de otras filas: lo que se cuenta y cómo hablan al llegar a un núcleo (**A4P5**, fila 32), el desenlace con el oro ganado (**A5P2**, fila 36) y la repisa con los objetos y los motes debajo (**A6P5**, fila 38). Aquí se entrega el dato vivo que las tres pintan.

Anclas: **RF-PROG-001**, **RF-PROG-002**, **RF-PROG-004**, **RF-PROG-006** y **RF-PROG-008** (Should) de `docs/prd.md` §4.5, con `game-design/progresion.md` como fuente que manda sobre el PRD —§1 el rango, §2 el oro, §3 el trato y el precio, §4 los objetos— y `game-design/personaje.md` §2 para el mote. **RNF-DET-001** y **RNF-DET-003** aplican como invariante bloqueante. Se apoya en SPEC-009 (el mundo congelado y el área `partida/`), SPEC-010 (la aventura casteada, la cadena de beats y el disparador `con_objeto` con su vía alternativa obligatoria), SPEC-011 (el catálogo cerrado de efectos aditivos, que esta entrega no amplía), SPEC-012 (**lo que ha llegado a cada núcleo, con su nivel y su signo: es la única entrada de la que sale el rango**) y SPEC-014 (las caras, y el contraste que hace legible el sistema entero: al testigo no se le paga y cuenta la verdad; al informante se le paga y cuenta lo que oyó).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí la toca en un solo punto**: el casting recibe una vista de solo lectura del estado de progresión, tal como exige `progresion.md`, y sin que eso cambie ni un beat. Está descrita en «Frontera de inyección».
- **Fuera de alcance, y son seis cosas que parecerían naturales aquí:** las **pantallas** donde esto se ve —lo que se cuenta al llegar (fila 32, A4P5), el desenlace con el oro (fila 36, A5P2) y la repisa con los motes (fila 38, A6P5, RF-PROG-007)—; la **redacción** de cualquier frase de trato, de mote o de lo que un informante cuenta, el prompt y el filtro de aptitud (fila 18); el **catálogo de plantillas** con sus declaraciones de oro, objeto y mote candidato (fila 17, RF-QUEST-009 — esta spec entrega el mecanismo, no el contenido); la **propagación de rumores** con sus niveles y lo que sedimenta por núcleo (fila 12, ya especificada: se consume entera y no se reabre); la **capa de NPCs**, su memoria fiel y su escalera de relación (fila 14, ya especificada: el informante es una cara suya y el testigo sigue siendo gratis); y los **micro-encuentros y su cola**, que son quienes ofrecen los hallazgos (fila 19 — aquí solo se recoge lo que declaren). Esta spec entrega **qué rango hay en cada núcleo, cuánto cuesta allí lo que se sabe, qué objetos se tienen y qué mote se pegó**, no cómo se cuenta ni cómo se pinta.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Los tres escalones», «El rango sube por lo que llega», «El trato y el precio», «Lo que el oro compra», «Los objetos son llaves» y «El mote»; la **validación de entradas** en el escalón fuera del enumerado, el ítem que no está en el catálogo, el objeto sin clase declarada, el efecto de compra fuera del catálogo y el núcleo que no existe en el mapa activo; el **estado vacío** en el núcleo que no ha oído nada, la bolsa a cero, la partida sin ningún objeto, el mapa nuevo y el núcleo sin ningún mote candidato; el **estado de error** en la compra sin oro suficiente, el favor que tocaría un beat, el informante de otro mapa, el ítem sin precio base declarado y el cierre de salida que falla a mitad; y los **casos límite** en el umbral exacto, el precio que redondea, el empate de motes, el objeto que ya se tiene, el rumor que llega ya en nivel 3 y la aventura que se ofrece sin ningún objeto en la partida.

«Mundo congelado X» sigue significando el fixture `test/fixtures/osm/X/` de SPEC-001. **«Núcleo»** significa siempre un núcleo del mapa activo, que es la granularidad de todo lo social del proyecto. **«Lo que ha llegado»** significa lo sedimentado por SPEC-012 en ese núcleo, con su nivel y su signo. **«Escalón»** significa un valor del enumerado ordinal de rango; **«tono»**, la clave de trato que ese escalón lleva asociada y que la fila 18 usa como restricción. **«Paso»** significa paso del mundo, la unidad de SPEC-011.

### Los tres escalones, con nombre y sin números

- **Dado** la escalera de rango, **cuando** se enumera, **entonces** tiene exactamente tres escalones con nombre y es ordinal.
- **Dado** la escalera, **cuando** se busca un valor intermedio entre dos escalones, **entonces** no existe: es enumerada y no continua.
- **Dado** un núcleo, **cuando** se consulta el rango que allí se tiene, **entonces** se obtiene un escalón y su tono, y ninguna cifra.
- **Dado** la consulta de rango, **cuando** se inspecciona lo que devuelve, **entonces** no lleva el recuento de lo que ha llegado, ni un porcentaje, ni cuánto falta para el escalón siguiente.
- **Dado** la superficie pública de esta entrega, **cuando** se busca una consulta que devuelva el rango de todos los núcleos del mapa a la vez, **entonces** no existe: se pregunta núcleo a núcleo.
- **Dado** los escalones, **cuando** se leen sus claves, **entonces** ninguna nombra un género gramatical.
- **Dado** un escalón recibido fuera del enumerado, **cuando** se pide el trato que le corresponde, **entonces** falla nombrando el valor recibido.
- **Dado** el rango de un núcleo, **cuando** se busca alguna operación que lo baje, **entonces** no existe.
- **Dado** el catálogo de mecanismos que esta entrega expone, **cuando** se enumeran los que pueden bajar, **entonces** no hay ninguno.

### El rango sube por lo que llega, no por lo que se pisa

- **Dado** un núcleo al que no ha llegado nada de la jugadora, **cuando** se consulta el rango, **entonces** está en el escalón de partida.
- **Dado** una jugadora que pasa por «Vilanova» cada día sin hacer nada allí, **cuando** el mundo avanza veinte pasos, **entonces** en «Vilanova» sigue en el escalón de partida.
- **Dado** un desenlace notable en «Monfrida» y un núcleo vecino al que llega el rumor, **cuando** se consulta el rango en ese vecino, **entonces** ha subido, aunque la jugadora no haya estado nunca allí.
- **Dado** un núcleo, **cuando** se inspecciona de qué depende su rango, **entonces** depende solo de lo que ha llegado a ese núcleo, y de nada más.
- **Dado** el cálculo del rango, **cuando** se buscan entre sus entradas los metros andados, los pasos del mundo, las llegadas por geofence o las veces que se ha visitado el núcleo, **entonces** no interviene ninguna.
- **Dado** dos jugadoras con tramos muy distintos, **cuando** las dos terminan la misma aventura casteada a su tramo, **entonces** el rumor que nace es equivalente y suben lo mismo de rango.
- **Dado** un núcleo que ha oído un rumor de signo feo, **cuando** se consulta el rango, **entonces** también ha subido: que te conozcan por algo feo también es que te conozcan.
- **Dado** un núcleo que ha oído un rumor en nivel 3, **cuando** se consulta el rango, **entonces** cuenta igual que uno oído en nivel 0.
- **Dado** un núcleo justo en el umbral de un escalón, **cuando** se consulta, **entonces** está en el escalón superior: el umbral se alcanza, no se supera.
- **Dado** un núcleo con un rango ya alcanzado, **cuando** el mundo avanza cien pasos sin que llegue nada nuevo, **entonces** el rango no cambia.
- **Dado** un núcleo con rango, **cuando** se consulta cien pasos después, **entonces** sigue igual: lo oído no caduca y el rango tampoco.
- **Dado** el rango de un núcleo, **cuando** se consulta dos veces sin que haya llegado nada entre medias, **entonces** devuelve lo mismo: es función pura de lo que ese núcleo ha oído.

### El rango no viaja entre mapas

- **Dado** una jugadora en el escalón más alto en su mapa de casa, **cuando** levanta un mapa nuevo en otro sitio, **entonces** en el mapa nuevo está en el escalón de partida en todos sus núcleos.
- **Dado** una partida con dos mapas, **cuando** un rumor viaja en uno, **entonces** el rango de los núcleos del otro no cambia.
- **Dado** un mapa nuevo, **cuando** se consulta el rango, **entonces** no hace falta ninguna regla de traslado ni ninguna conversión: no hay nada que trasladar.
- **Dado** un mapa nuevo, **cuando** se consultan los motes, **entonces** no hay ninguno.
- **Dado** un núcleo de un mapa, **cuando** se pide su rango contra otro mapa activo, **entonces** falla nombrando el mapa.

### El trato y el precio, nunca el catálogo

- **Dado** un informante y dos jugadoras en escalones distintos del mismo núcleo, **cuando** cada una le pregunta qué ofrece, **entonces** se les ofrece exactamente lo mismo.
- **Dado** ese mismo caso, **cuando** se comparan los precios, **entonces** son distintos.
- **Dado** ese mismo caso, **cuando** se comparan los tonos, **entonces** son distintos.
- **Dado** el catálogo que un informante ofrece, **cuando** se inspecciona de qué depende, **entonces** no depende del rango en ese núcleo.
- **Dado** una jugadora en el escalón de partida, **cuando** pide el precio de un ítem, **entonces** es el precio base declarado por ese ítem.
- **Dado** una jugadora en el escalón más alto, **cuando** pide el precio del mismo ítem, **entonces** es cero.
- **Dado** una jugadora en el escalón intermedio, **cuando** pide el precio de un ítem de precio base impar, **entonces** el precio es la mitad redondeada hacia arriba, y nunca cero.
- **Dado** un precio cero, **cuando** se compra, **entonces** la compra se resuelve entera y no se cobra nada.
- **Dado** el tono, **cuando** se lee, **entonces** es una clave de un enumerado cerrado, una por escalón, y nunca un texto redactado.
- **Dado** una aventura que necesita un lugar de un núcleo donde se está en el escalón de partida, **cuando** se castea, **entonces** se castea igual: el rango no filtra el catálogo.
- **Dado** un ítem sin precio base declarado, **cuando** se pide su precio, **entonces** falla nombrando el ítem, en lugar de suponer uno.

### Lo que el oro compra: saber y favores, nunca metros

- **Dado** el catálogo de lo que el oro puede comprar, **cuando** se enumeran sus tipos, **entonces** es cerrado y son saber y favores.
- **Dado** todo lo que se puede comprar, **cuando** se revisa uno por uno, **entonces** nada de ello reduce la distancia que hay que andar.
- **Dado** un ítem del catálogo, **cuando** se inspecciona su efecto, **entonces** no toca el tramo de la jugadora, ni el grafo, ni el filtro de caminos que evitar.
- **Dado** un favor, **cuando** se inspecciona su efecto, **entonces** no retira, no acorta y no sustituye ningún beat de ninguna aventura casteada.
- **Dado** un favor que devolviera un efecto sobre un beat, **cuando** se aplica, **entonces** se rechaza nombrando el favor y el estado de la partida no cambia.
- **Dado** un informante que recibió el rumor en nivel 2, **cuando** la jugadora le paga por lo que sabe, **entonces** recibe la versión de nivel 2.
- **Dado** ese mismo informante, **cuando** la jugadora le paga, **entonces** no recibe la versión fiel.
- **Dado** un informante de un núcleo y una cara testigo del mismo núcleo, **cuando** los dos cuentan el mismo hecho, **entonces** el informante cobra su versión y el testigo cuenta la fiel sin cobrar.
- **Dado** un informante de un núcleo que no ha oído nada de un hecho, **cuando** se le pregunta por él, **entonces** no tiene nada que vender, y no es un error.
- **Dado** todas las maneras de ganar y gastar oro, **cuando** se revisan, **entonces** ninguna implica una compra con dinero real.
- **Dado** el catálogo entero, **cuando** se revisa, **entonces** ningún ítem manda a gastar en el negocio real al que está anclado el sitio.
- **Dado** lo que una compra devuelve, **cuando** se inspecciona, **entonces** no lleva el nivel de deformación de lo que se compró.

### El oro: una cifra que se gasta, y nada más

- **Dado** una partida recién creada, **cuando** se consulta la bolsa, **entonces** marca cero y no es un error.
- **Dado** un desenlace que declara oro, **cuando** se cierra la salida, **entonces** la bolsa sube en lo declarado.
- **Dado** un desenlace que no declara oro, **cuando** se cierra la salida, **entonces** la bolsa no cambia.
- **Dado** una compra de precio mayor que la bolsa, **cuando** se intenta, **entonces** se rechaza nombrando lo que falta y no se entrega nada.
- **Dado** una compra rechazada, **cuando** se consulta la bolsa, **entonces** no ha cambiado.
- **Dado** la bolsa, **cuando** se busca alguna operación que la deje por debajo de cero, **entonces** no existe.
- **Dado** la superficie pública de esta entrega, **cuando** se busca una consulta del oro acumulado a lo largo de la partida, **entonces** no existe: solo se puede preguntar el saldo.
- **Dado** el gasto de oro, **cuando** se busca dónde ocurre, **entonces** ocurre en una compra de la jugadora y nunca en un paso del mundo.
- **Dado** el motor de pasos, **cuando** se enumeran sus productores, **entonces** esta capa no es ninguno de ellos.
- **Dado** una partida con dos mapas, **cuando** se consulta la bolsa desde cada uno, **entonces** es la misma: el oro es lo que se lleva encima.

### Los objetos son llaves, no requisitos

- **Dado** un beat con disparador `con_objeto` y la jugadora con ese objeto, **cuando** llega, **entonces** se le ofrece la vía del objeto.
- **Dado** ese mismo beat y la jugadora sin ese objeto, **cuando** llega, **entonces** existe otra manera de resolver el beat.
- **Dado** ese mismo beat resuelto por las dos vías, **cuando** se comparan los resultados, **entonces** son el mismo y empujan al mismo beat siguiente.
- **Dado** una aventura casteada, **cuando** se castea con objetos y sin ninguno, **entonces** salen los mismos beats en el mismo orden y el mismo lazo.
- **Dado** una partida sin ningún objeto, **cuando** se ofrecen aventuras, **entonces** se ofrecen igual: ninguna aventura pide un objeto para ser ofrecida.
- **Dado** el conjunto de beats de una aventura, **cuando** se busca uno que solo se pueda resolver llevando un objeto, **entonces** no hay ninguno.
- **Dado** un objeto usado en una vía `con_objeto`, **cuando** se consulta después, **entonces** se sigue teniendo: la llave no se gasta.
- **Dado** un objeto, **cuando** se lee, **entonces** trae su clase del enumerado cerrado, su procedencia y el día en que se obtuvo.
- **Dado** un objeto de clase recuerdo, **cuando** se busca un beat que abra, **entonces** no abre ninguno.
- **Dado** un objeto que ya se tiene, **cuando** un desenlace vuelve a entregarlo, **entonces** se sigue teniendo una sola vez y no se apila.
- **Dado** los objetos de la partida, **cuando** se buscan un peso, un número de huecos o una manera de tirarlos, **entonces** no existe ninguno de los tres.
- **Dado** un objeto que se intenta guardar sin clase declarada, **cuando** entra, **entonces** falla nombrando el objeto, en lugar de suponer que es un recuerdo.
- **Dado** un objeto de un mapa, **cuando** se levanta otro mapa, **entonces** se sigue teniendo: los objetos son de la jugadora y no del sitio.

### El mote nace del rumor y es por núcleo

- **Dado** un desenlace notable que declara mote candidato, **cuando** su rumor llega a un núcleo, **entonces** ese candidato entra en juego en ese núcleo.
- **Dado** un rumor que llega a dos núcleos con distinto nivel, **cuando** se consulta el mote en cada uno, **entonces** puede ser distinto en cada uno.
- **Dado** un núcleo que ha oído varios rumores con candidatos distintos, **cuando** se consulta el mote, **entonces** se pega el candidato que más veces ha llegado.
- **Dado** un núcleo con dos candidatos empatados en número, **cuando** se consulta el mote, **entonces** se resuelve con una regla declarada y no por el orden en que llegaron.
- **Dado** un núcleo que no ha oído nada, **cuando** se consulta el mote, **entonces** no hay ninguno, y no es un error.
- **Dado** un rumor cuyo desenlace no declara mote candidato, **cuando** llega a un núcleo, **entonces** el mote de ese núcleo no cambia.
- **Dado** el mote de un núcleo, **cuando** se lee, **entonces** es la referencia al candidato declarado y no un texto redactado.
- **Dado** un mote, **cuando** se consulta desde otro núcleo del mismo mapa, **entonces** ese otro núcleo tiene el suyo o ninguno, nunca el ajeno.
- **Dado** la superficie pública de esta entrega, **cuando** se busca una consulta de todos los motes del mapa a la vez, **entonces** no existe.

### Determinismo y estado de partida

- **Dado** el mismo mundo y la misma partida, **cuando** se calculan los rangos dos veces desde cero, **entonces** salen idénticos.
- **Dado** el mismo mundo y la misma partida, **cuando** se calculan los motes dos veces desde cero, **entonces** salen idénticos.
- **Dado** dos partidas que oyeron los mismos rumores en orden distinto, **cuando** se comparan sus rangos y sus motes, **entonces** son iguales.
- **Dado** una partida con oro y objetos, **cuando** se serializa y se vuelve a cargar, **entonces** vuelven la misma bolsa y los mismos objetos con su procedencia.
- **Dado** una partida, **cuando** se serializa y se vuelve a cargar, **entonces** los rangos y los motes vuelven a salir de lo oído y no hace falta que estuvieran guardados aparte.
- **Dado** un mundo congelado, **cuando** se gana oro, se compra saber y se obtienen objetos, **entonces** el documento de cada celda sigue idéntico byte a byte.
- **Dado** los módulos de esta entrega, **cuando** se inspecciona su implementación, **entonces** no aparece `Math.random()`, ni `Date.now()`, ni `new Date()`, ni ninguna iteración cuyo resultado dependa del orden de inserción de un `Set` o un `Map`.
- **Dado** los módulos de esta entrega, **cuando** se inspeccionan sus imports, **entonces** no importan `buildWorld` ni ninguna fase de la generación.
- **Dado** el día que acompaña a un objeto, **cuando** se busca de dónde sale, **entonces** llega como argumento de quien cierra la salida y no se lee dentro del núcleo.

### Vacíos, entradas inválidas y errores

- **Dado** un núcleo que no existe en el mapa activo, **cuando** se pide su rango, **entonces** falla nombrando el núcleo.
- **Dado** un mapa sin ningún núcleo, **cuando** se consultan los rangos, **entonces** no hay ninguno y no falla.
- **Dado** un ítem que no está en el catálogo cerrado, **cuando** se intenta comprar, **entonces** falla nombrando el ítem.
- **Dado** un efecto de compra de un tipo que no está en el catálogo cerrado, **cuando** se aplica, **entonces** falla nombrando el tipo, en lugar de aplicarlo.
- **Dado** un informante de otro mapa, **cuando** se le intenta comprar, **entonces** falla nombrando el mapa.
- **Dado** un desenlace que declara oro con un valor negativo o no entero, **cuando** se cierra la salida, **entonces** falla nombrando el valor recibido.
- **Dado** un cierre de salida en el que la entrega de oro y objetos falla a mitad, **cuando** se lee el estado, **entonces** ni la bolsa ni los objetos han cambiado: se aplica entero o no se aplica.
- **Dado** una compra que falla a mitad, **cuando** se lee el estado, **entonces** ni la bolsa ha cambiado ni se ha entregado nada.
- **Dado** un beat `con_objeto` cuya plantilla no declara vía alternativa, **cuando** se resuelve, **entonces** falla nombrando el beat, en lugar de exigir el objeto.
- **Dado** una partida sin ningún objeto, **cuando** se consultan los objetos, **entonces** la lista está vacía y no falla.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/rango.js` | el enumerado ordinal de tres escalones, la tabla de umbrales, el cálculo del rango por núcleo y el tono asociado |
| `packages/nucleo/partida/oro.js` | la bolsa, el ingreso declarado por el desenlace, el cobro y las dos invariantes: nunca por debajo de cero y ningún acumulado histórico |
| `packages/nucleo/partida/informantes.js` | el catálogo cerrado de saber y favores, el precio por escalón y la entrega de **la versión que ese núcleo oyó** |
| `packages/nucleo/partida/objetos.js` | las dos clases de objeto, la tenencia, la procedencia y la resolución de la bifurcación `con_objeto` con su vía alternativa |
| `packages/nucleo/partida/motes.js` | los candidatos que han llegado a cada núcleo, el recuento y la regla de desempate |

Las cinco viven en `partida/` por la misma razón que las de SPEC-011, SPEC-012 y SPEC-014: **un rango es estado de la jugadora sobre un mundo congelado, no parte del mundo**. Las áreas del paquete están fijadas desde SPEC-002 y esta entrega no abre ninguna nueva.

### Frontera de inyección

Esta spec toca la frontera del núcleo en **un solo punto**, y es el que `progresion.md` deja escrito en «Lo que esto obliga a hacer»: **el casting recibe también el estado de la partida**, en una vista de solo lectura que responde a una única pregunta —si un objeto se tiene o no— y que no puede escribir nada. Es lo que enciende el disparador `con_objeto` de SPEC-010 sin cambiar el reparto: *la variante es cómo se pasa, no por dónde*, y por eso hay un criterio que exige que con objetos y sin ninguno salgan los mismos beats en el mismo orden.

Todo lo demás entra como argumento de quien construye la partida y no se lee de ningún almacén:

- **Lo que ha llegado a cada núcleo**, con su nivel, su signo y el mote candidato de cada rumor. Sale de la consulta por núcleo de SPEC-012; **esta entrega no propaga, no deforma y no recalcula niveles**, los lee. Que la consulta sea por núcleo y no exista una por mapa es lo que hace que aquí tampoco pueda existir.
- **El desenlace de una aventura terminada**, con lo que la plantilla declara: el oro, los objetos persistentes con su clase, y el mote candidato. Sale de SPEC-010 y de la fila 17; mientras el catálogo de la fila 17 no exista, sirve la declaración de las seis plantillas ya portadas, y un desenlace sin declaraciones simplemente no entrega nada.
- **La cara del informante**, resuelta por SPEC-014 sobre un sitio del núcleo. Esta capa no elige quién es ni le inventa memoria: le pide al núcleo lo que allí se cuenta y le pone precio.
- **El día del cierre de la salida**, para la procedencia de un objeto. Llega como argumento porque el núcleo no puede leer el reloj: es la misma regla que impide `Date.now()` en la generación, aplicada a un dato que sí es del calendario.

Hacia fuera entrega cinco cosas y solo cinco: **el rango y el tono de un núcleo**, **el mote de un núcleo**, **el precio y la compra**, **el saldo de la bolsa** y **los objetos que se tienen**. Ni un texto destinado a mostrarse, ni ninguna consulta agregada por mapa.

### Los tres escalones, sus claves y sus umbrales

`progresion.md` los nombra **forastero · conocido · alguien de aquí**, y su pendiente 4 deja abiertos los nombres exactos y los umbrales. Aquí se tratan como **parámetro con valor por defecto**, declarado en un único sitio para que cambiarlo sea cambiar una tabla:

| Escalón | Clave interna | Umbral por defecto |
| --- | --- | --- |
| forastera | `forasteria` | nada ha llegado |
| conocida | `nombradia` | ha llegado uno o dos |
| alguien de aquí | `pertenencia` | han llegado tres o más |

Tres precisiones que son decisión y no aritmética:

- **Las claves internas no llevan género** y **no salen nunca a pantalla**. El género gramatical de la jugadora es dato vivo (`personaje.md` §1) y el rango se dice con una frase que redacta la fila 18 sobre el tono; una clave marcada arrastraría el género a un sitio donde no pinta nada. Es la misma decisión que SPEC-014 tomó con las claves de puesto.
- **Se cuentan rumores distintos que han llegado, no su nivel ni su signo.** El rango mide *cuánto te conocen*, no *cuánto te aprecian* ni *cómo de fiel llegó*: un rumor en nivel 3 y de signo feo cuenta exactamente igual que uno fiel y bueno. El nivel está disponible en el dato de SPEC-012 y aquí se ignora a propósito.
- **Uno y tres son ritmo de juego, no estadística.** Con el umbral en uno, el primer desenlace notable ya cambia el trato en el núcleo donde ocurrió y en los que la noticia alcance, que es lo que hace que el hito de `arranque.md` §3 sea el primer escalón de esta misma escalera. Con el techo en tres, «alguien de aquí» significa que suenas por varias cosas y no por una.

### Por qué el rango no baja, y por qué eso no hay que programarlo

El PRD asume la propuesta del pendiente 1 de `progresion.md` —**el rango no baja**— y lo declara en su §7. Aquí no se implementa como una regla que vigile las bajadas, sino como una propiedad del cálculo: **el rango es función pura de lo que ese núcleo ha oído**, y lo oído solo crece, porque SPEC-012 fija que lo sedimentado no caduca, no se olvida y no se degrada. Con eso, «ningún rango ha bajado» del escenario «Un paso solo añade» se sostiene sin ningún guardián, y no hay estado que pueda desincronizarse.

De ahí sale además una consecuencia barata para la fila 39: **el rango no se guarda**, se deriva. Cuando `docs/testing.md` dice «se recuperan los rangos, lo oído, la repisa y los NPCs conocidos», lo que hay que recuperar es lo oído, y los rangos vienen detrás solos. Lo que sí es estado guardado es la bolsa, los objetos y su procedencia, que no se derivan de nada.

Y el contraste que conviene dejar escrito porque es la pregunta que se hará quien implemente esto después de SPEC-014: **la relación por cara sí baja, y el rango no**, y no se contradicen. Son dos ejes distintos —una persona concreta que te coge manía, y un pueblo que sabe quién eres— y el propio `progresion.md` los separa: el signo de lo que se cuenta cambia el tono del trato y nunca el escalón.

### El precio, y por qué el precio cero es el corazón del asunto

El precio de un ítem de información es `precio_base × factor(escalón)`, con factor 1 en `forasteria`, ½ redondeado hacia arriba en `nombradia` y 0 en `pertenencia`. El redondeo hacia arriba no es un detalle: es lo que garantiza que **el único precio cero es el del escalón más alto**, y con él «lo que a una forastera le cobran, a alguien de aquí se lo sueltan de balde» queda afirmado sin depender de que ningún ítem tenga precio base 1.

El **precio base lo declara el ítem**, no esta capa, por la misma razón por la que el oro de un desenlace lo declara la plantilla: aquí está el mecanismo y en la fila 17 el contenido. Un ítem sin precio base declarado falla en lugar de valer cero, que es la degradación silenciosa que convertiría el catálogo entero en gratis sin que ninguna prueba lo viera.

### El oro acumulado, y el marcador que se evita por la puerta de atrás

El pendiente 3 de `progresion.md` avisa de que «un contador que crece sin tope acaba siendo un marcador de progreso por la puerta de atrás». Aquí se resuelve **sin tope y sin acumulado**: la bolsa expone el **saldo actual** y nada más. No existe consulta del oro ganado a lo largo de la partida, ni del gastado, ni un histórico. Un saldo que sube y baja según lo que compras no es un marcador de progreso; un total histórico monótono sí lo sería, y el modo de que nadie lo pinte por descuido es que el núcleo no lo entregue — el mismo argumento con el que SPEC-011 no expone el contador de pasos y SPEC-012 no expone el mapa entero.

Y la bolsa es **una sola por partida**, no una por mapa: el oro es lo que se lleva encima, no lo que un sitio piensa de ti. Es la diferencia exacta con el rango, que es de los pueblos y por eso no viaja.

### Objetos: dos clases, una tenencia y ninguna gestión

El objeto es **un flag con procedencia**: se tiene o no se tiene, no se apila, no pesa, no ocupa hueco y no se puede tirar. Dos clases en enumerado cerrado:

- **`llave`** — puede abrir la vía `con_objeto` de un beat. **No se gasta al usarse**, porque su valor de diseño es abrir conversaciones que no se habrían abierto, y una llave de un solo uso no crea arcos largos: los cierra.
- **`recuerdo`** — no abre nada. Está y cuenta de dónde vino y qué día fue, que es la repisa de `progresion.md` §4 y el dato que consume la fila 38.

De dónde salen los objetos es el pendiente 2 de `progresion.md`. Se trata como parámetro: **cualquier desenlace de aventura y cualquier hallazgo de micro-encuentro puede declarar un objeto persistente**, y quien lo declara es la plantilla o el suceso, exactamente igual que ya declaran el rumor y el mote candidato. Restringirlo a una lista corta y deliberada exigiría una lista que no existe en `game-design/`, y ampliarlo después no rompe nada; restringirlo después, tampoco.

Lo que **no** persiste son los objetos que mueve la propia aventura y que mueren con ella: si el desenlace no los declara persistentes, no entran en la partida.

### El mote: qué es «el que más suena», y el desempate

El mote de un núcleo es el **candidato más repetido entre los rumores que ese núcleo ha oído**. El empate se resuelve por **el nivel más bajo con el que llegó** —lo que llegó más fiel suena más claro— y, si persiste, por identificador de rumor. Lo que nunca se usa es el orden de llegada, por la misma paranoia que rige toda esta capa: un desempate por orden haría que oír un rumor más cambiara el mote de un núcleo al que no llegó nada nuevo.

El mote **puede cambiar** cuando otro candidato lo supera, y eso no contradice que el rango no baje: el mote no es un escalón, es de qué te conocen. Que en un pueblo dejes de ser «la que cruzó el monte de noche» para ser «la del paquete» no te devuelve a forastera.

### Lo que consume de otras specs y no respecifica

- **SPEC-009** entrega el mundo congelado y la regla de que el documento de celda describe el mundo y no crece al andar. Ni el rango, ni el oro, ni un objeto entran ahí.
- **SPEC-010** entrega la aventura casteada, la cadena de beats y el disparador `con_objeto` **con su vía alternativa ya obligatoria**: una plantilla cuyo beat `con_objeto` no la declara ya no se ofrece. Aquí no se vuelve a decidir eso; se consume, y lo que se añade es la tenencia por la que el beat bifurca.
- **SPEC-011** entrega el catálogo cerrado de efectos aditivos. Esta capa **no se registra como productor de paso** y no amplía el catálogo: el oro se gana al cerrar una salida y se gasta en una compra, y ninguna de las dos cosas ocurre en un paso del mundo. Esa ausencia es la prueba estructural de que un paso sigue sin quitar nada.
- **SPEC-012** entrega lo que ha llegado a cada núcleo con su nivel y su signo, la conservación de la versión fiel y la ausencia de consulta por mapa. Es la única entrada del rango y del mote, y no se recalcula ni se corrige nada de ello.
- **SPEC-014** entrega las caras, la memoria fiel del testigo y la escalera de relación. El informante es una cara; el testigo también, y **al testigo no se le paga**. Que los dos convivan en el mismo núcleo contando cosas distintas es lo que hace legible el sistema entero, y ya está afirmado allí.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Se referencian por su nombre literal, no se duplican: la batería se escribió antes que el código y sus nombres son el contrato con `wa-qa-dev`.

- De **«No hay niveles, hay rango social por núcleo»** (`@nucleo @app`), que es la característica propia de esta fila: «El rango sube por lo que llega, no por lo que se pisa», «Se puede ser alguien en un pueblo donde no has estado», «El rango no viaja entre mapas», «El rango cambia el trato y el precio, no el catálogo» y «Avanza igual quien anda 6 km y quien anda 900 m». De «No hay ninguna barra ni lista de reputación» aquí se sostiene la mitad `@nucleo` y la más barata: no existe consulta por mapa, ni recuento, ni distancia al escalón siguiente, así que no hay con qué pintar un medidor; que ninguna pantalla lo pinte es de las filas 32, 36 y 38.
- De **«El oro compra saber y favores, nunca metros»** (`@nucleo`), la característica entera: «No se puede pagar por no andar», «Lo que compras es la versión que ese informante oyó» y «El oro ficticio no toca dinero real».
- De **«Los objetos son llaves, no requisitos»** (`@nucleo @app`): «Sin el objeto hay otro camino al mismo beat», que es el escenario propio de RF-PROG-006. De «La repisa no es un inventario» aquí se sostiene el dato —ni peso, ni huecos, ni manera de tirar, y cada objeto con su procedencia y su día—; la pantalla es de la fila 38.
- De **«El personaje se elige una vez y el oficio no se cambia»**: «El mote nace del rumor y es por núcleo», que SPEC-012 dejó preparado con dos núcleos en distinto nivel y que esta fila cierra.
- De **«El mundo avanza con los kilómetros del jugador, no con el calendario»**: «Un paso solo añade», del que aquí se sostiene la aserción «ningún rango ha bajado», y por construcción y no por vigilancia.
- De **«El mundo se congela entero»**: «El registro basta para reconstruir», que exige recuperar «los rangos, lo oído, la repisa y los NPCs conocidos»; que el rango se derive de lo oído hace que recuperarlo sea gratis. La política de qué manda al cargar es de la fila 39.
- De **«Lo generado no se resiembra jamás»**: ganar oro, comprar y guardar objetos son, junto con los pasos, la propagación y las caras, lo más fácil de romper de esa característica; el documento de cada celda tiene que seguir idéntico byte a byte.
- **Frontera, que esta spec deja preparada y no implementa:** «El nivel de deformación no sale nunca a pantalla» (filas 16 y 37, y aquí se le quita el arma: lo que devuelve una compra no lleva nivel), «El testigo directo es fiel y no corrige al pueblo» (fila 14, ya especificada), y las pantallas de las filas 32, 36 y 38.

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería, no de esta spec, y `wa-qa-dev` tendrá que marcarlos como casos sin escenario de respaldo en lugar de inventarse uno:

- **Nada fija los umbrales ni el número de escalones.** «No hay niveles, hay rango social por núcleo» nombra «forastera» y «alguien de aquí» pero ningún escenario dice cuántos escalones hay ni qué hace falta para subir. Es el hueco más grande, y es el que el pendiente 4 de `progresion.md` tiene que cerrar en el documento antes que en el código.
- **Nada afirma que el rango no puede bajar.** «Un paso solo añade» cubre que un paso no lo baje, que es un caso; que no exista ninguna operación que lo baje, que es la propiedad, no lo cubre nadie.
- **Nada verifica el precio cero.** «El rango cambia el trato y el precio» dice «a distinto precio», sin afirmar que en el escalón más alto es gratis, que es literalmente donde enganchan el rango y el oro.
- **Nada verifica que un favor no acorta el camino.** «No se puede pagar por no andar» revisa el catálogo, que es la mitad fácil; el caso peligroso es un recado que resuelve un beat, y es el que ningún escenario mira.
- **Nada afirma que el rango no depende del nivel ni del signo.** Un rumor feo y uno en nivel 3 tienen que contar igual, y es contraintuitivo justo cuanto más se parece esto a una reputación.
- **Nada verifica que la llave no se gasta.** «Sin el objeto hay otro camino al mismo beat» cubre la ausencia; que tenerlo no lo consuma es lo que sostiene los arcos largos y no lo mira nadie.
- **Nada verifica la regla de desempate del mote.** «El mote nace del rumor y es por núcleo» afirma que puede ser distinto en cada sitio, no cómo se elige cuando hay varios.
- **Nada afirma que no exista un acumulado de oro.** La prohibición de marcadores mira las pantallas; el total histórico se evita mejor no exportándolo.
- **Nada verifica que el oro se ganó y se gastó sin tocar el mundo congelado.** «Lo generado no se resiembra jamás» habla de la generación, y esta capa es capa, como el motor de pasos y la propagación.

## Decisiones asumidas

- **Los tres escalones son un enumerado ordinal cerrado con claves internas sin género (`forasteria`, `nombradia`, `pertenencia`) que no salen nunca a pantalla** → asumido (alternativa: usar como clave los nombres del diseño, «forastera / conocida / alguien de aquí»). Regla: pendiente 4 de `progresion.md` deja los nombres abiertos, `personaje.md` §1 hace del género gramatical dato vivo y el design system prohíbe que el rango se muestre como etiqueta; es la misma decisión que SPEC-014 tomó con las claves de puesto. Lo que ve la jugadora es una frase que redacta la fila 18 sobre el tono.
- **Los umbrales son uno y tres rumores distintos llegados a ese núcleo** → asumido, en una tabla única y parametrizable (alternativa: umbrales más altos, o ponderar por nivel). Regla: pendiente 4 de `progresion.md` y el PRD §7; con el umbral en uno, el hito de `arranque.md` §3 es el primer escalón de esta escalera, que es lo que el documento dice que es.
- **El rango cuenta rumores llegados y no mira ni el nivel ni el signo** → asumido (alternativa: ponderar los fieles más que las leyendas, o que un signo feo no sume). Regla: `progresion.md` pendiente 1 — «el rango mide cuánto te conocen, no cuánto te aprecian; que te conozcan por algo feo también es que te conozcan»; el signo es un eje aparte que cambia el tono, y el tono ya sale del escalón.
- **El rango no baja, y se implementa como propiedad del cálculo y no como guardián** → asumido: es función pura de lo sedimentado, que solo crece (alternativa: guardarlo como estado y prohibir explícitamente las bajadas). Regla: el PRD §7 asume la propuesta del pendiente 1 de `progresion.md`; derivarlo hace que «ningún rango ha bajado» sea cierto por construcción y que no exista un estado que pueda desincronizarse del registro.
- **El rango y el mote se derivan y no se guardan; lo guardado es la bolsa y los objetos** → asumido (alternativa: persistir los rangos calculados). Regla: «El registro basta para reconstruir» exige recuperar los rangos desde lo oído; guardarlos además crearía dos fuentes de verdad para el mismo dato, que es justo lo que «El estado manda sobre el registro» tiene que arbitrar en la fila 39.
- **La consulta de rango no expone el recuento, ni el porcentaje, ni lo que falta para el escalón siguiente** → asumido (alternativa: entregarlo y confiar en que ninguna pantalla lo pinte). Regla: design system, «ningún medidor de reputación»; es el mismo argumento con el que SPEC-011 no expone el contador y SPEC-012 no expone el mapa entero.
- **No existe ninguna consulta del rango ni del mote de todos los núcleos a la vez** → asumido (alternativa: exponerla para la pantalla de la repisa). Regla: SPEC-012 ya la niega para lo oído y la repisa enseña motes, no una lista de pueblos con su escalón; «una pantalla que enumerase tus tres escalones en cada pueblo sería la barra que este apartado se niega a tener» (`progresion.md` §1).
- **El precio es `base × factor`, con factor 1, ½ redondeado hacia arriba y 0** → asumido (alternativa: tres precios declarados por ítem, uno por escalón). Regla: `progresion.md` §3 pide que el rango cambie el precio «incluido el precio cero»; el redondeo hacia arriba es lo que garantiza que el único cero sea el del escalón más alto, y un factor por escalón mantiene el contenido en la fila 17.
- **El precio base lo declara el ítem y su ausencia es un error** → asumido (alternativa: un precio por defecto). Regla: la misma frontera que rige el oro del desenlace y el mote candidato — mecanismo aquí, contenido en la fila 17; un precio por defecto convertiría un catálogo incompleto en un catálogo barato sin que ninguna prueba lo viera.
- **El catálogo de lo que el oro compra es cerrado, con dos tipos: saber y favores** → asumido (alternativa: dejarlo abierto para que la fila 17 añada tipos). Regla: `progresion.md` §2 nombra exactamente esos dos; un catálogo abierto haría que «nada de lo que se ofrece reduce la distancia» dejara de ser verificable el día que alguien añadiera un tipo.
- **Un favor no puede tocar ningún beat de una aventura casteada, y uno que lo intente se rechaza** → asumido (alternativa: permitir que un recado resuelva un beat de entrega). Regla: «regla dura: el oro nunca compra distancia», y un recado que resuelve un beat es exactamente pagar por no andar con otro nombre; es el caso peligroso, no el catálogo.
- **La compra devuelve la versión sedimentada en el núcleo del informante y nunca la fiel, y sin el nivel** → asumido (alternativa: entregar el nivel para que la pantalla lo esconda). Regla: `progresion.md` §2 —«lo que compras es lo que ese hombre sabe, en la versión que a él le llegó»— y design system, «ningún nivel de deformación sale a pantalla»; SPEC-012 ya toma la misma decisión con lo que entrega a la capa que pinta.
- **La bolsa es una por partida y viaja entre mapas** → asumido (alternativa: una bolsa por mapa, como el rango). Regla: el oro es lo que se lleva encima y el rango es lo que un sitio piensa de ti; el pendiente 3 de `progresion.md` pregunta por el tope, no por el ámbito, y una bolsa por mapa haría que levantar un mapa nuevo confiscara el oro sin que ningún documento lo pida.
- **Sin tope de oro, y sin ninguna consulta del acumulado histórico: solo el saldo** → asumido (alternativa: un tope, o un sumidero que lo consuma). Regla: pendiente 3 de `progresion.md` avisa del «marcador de progreso por la puerta de atrás»; lo que sería un marcador es el total monótono, no el saldo, y no exportarlo es más barato que taparlo. Si al medir el juego el oro sobra, el sitio de arreglarlo es el catálogo de la fila 17, no un tope.
- **El oro se gana al cerrar la salida y se gasta en una compra; esta capa no se registra como productor de paso** → asumido (alternativa: registrarse por simetría con SPEC-012). Regla: `quests.md` decisión 4 y el catálogo solo aditivo de SPEC-011 — si el gasto ocurriera en un paso, un paso restaría; no estar registrado es la prueba estructural, como en SPEC-014.
- **Cualquier desenlace de aventura y cualquier hallazgo de micro-encuentro puede declarar un objeto persistente** → asumido (alternativa: solo los hallazgos, o una lista corta y deliberada). Regla: es el pendiente 2 de `progresion.md` y no está resuelto; `quests.md` §6 ya lista el objeto como recompensa inmediata de cualquier aventura, y una lista corta exigiría escribirla, que es inventar producto. Ampliar después no rompe nada.
- **Dos clases de objeto, `llave` y `recuerdo`, en enumerado cerrado, y la clase la declara quien lo entrega** → asumido (alternativa: que todo objeto sea potencialmente llave y lo decida la plantilla que lo pide). Regla: `progresion.md` §4 separa explícitamente lo que abre conversaciones de «lo que no es llave, que queda en la repisa»; sin la clase declarada, la repisa y el sistema de llaves serían la misma lista y RF-PROG-007 no se podría afirmar.
- **La llave no se gasta al usarse** → asumido (alternativa: consumirla, como un objeto de quest). Regla: `progresion.md` §4 —«se tienen o no se tienen, y el código bifurca por eso»— y el argumento de los arcos largos: una llave de un solo uso no puede volver a abrir una conversación tres semanas después, que es el valor entero del mecanismo.
- **El día de procedencia de un objeto llega como argumento de quien cierra la salida** → asumido (alternativa: leerlo dentro del núcleo). Regla: `CLAUDE.md` prohíbe `Date.now()` dentro del núcleo y RF-PROG-007 exige que cada objeto diga de quién y de qué día; que entre como argumento es lo que permite las dos cosas a la vez.
- **El mote es el candidato más repetido, con desempate por nivel más bajo y después por identificador de rumor** → asumido (alternativa: el más reciente, o el del rumor más fiel sin más). Regla: `personaje.md` §2, «se pega el que más suena»; el orden de llegada está prohibido como criterio por la misma razón que en SPEC-012 y SPEC-014 — un desempate por orden haría que oír algo nuevo cambiara lo que ya estaba decidido.
- **El mote puede cambiar y eso no contradice que el rango no baje** → asumido (alternativa: fijar el mote al primero que se pega). Regla: el mote es de qué te conocen y el rango es cuánto; `personaje.md` §2 no lo declara permanente, y congelarlo dejaría muerto el mecanismo en cuanto se pegara el primero.
- **El casting recibe una vista de solo lectura del estado de progresión** → asumido, limitada a la tenencia de objetos (alternativa: pasarle el estado de partida entero). Regla: `progresion.md` «Lo que esto obliga a hacer» lo pide con esas palabras y añade «sin que eso cambie los beats»; una vista mínima y de solo lectura es lo que permite afirmar que con objetos y sin ninguno sale el mismo reparto.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-014.
- **Sin `## UX Design` y sin comportamiento responsive** → asumido: esta spec no dibuja pantalla; A4P5, A5P2 y A6P5 son de las filas 32, 36 y 38 (alternativa: especificar aquí la ficha del informante y la repisa). Regla: decisión 3 de `pipeline/decisiones-orquestador.md` y el design system, que prohíbe rediseñar una pantalla ya dibujada.
