# SPEC-012 — La propagación de rumores: lo que hiciste viaja, y se deforma al contarse

## Descripción

Lo que la jugadora hace en un sitio no se queda en ese sitio y tampoco se sabe de golpe en todas partes: **viaja por la red de calzadas, pueblo a pueblo, y se va torciendo en cada boca que lo repite**. Esta spec entrega ese mecanismo entero: el rumor nace en el núcleo donde ocurrió y en su versión fiel, avanza un tramo por cada paso del mundo, se deforma un escalón por cada salto que da entre núcleos —uno más si el salto cruza un trozo por donde no hay calzada real—, se agota solo y sedimenta en lo que se cuenta de ella en cada sitio que lo oyó.

De ahí sale la regla social del juego, que es lo que esta fila existe para hacer verdad: **la reputación es lo que llegó, no lo que se hizo**. Cada núcleo trata a la jugadora según la versión que oyó, y por eso se puede ser alguien en un pueblo donde no se ha estado nunca, y un pueblo por el que se pasa a diario sin que le llegue nada sigue tratándola de forastera. También sale la consecuencia física que hace que el juego se ande: **se puede adelantar a su propia fama** — ir derecho al pueblo vecino es llegar a la vez que la noticia; entretenerse por el monte es llegar detrás de ella.

Y sale la restricción más fácil de romper de todo el proyecto, que se afirma aquí y no en el prompt: **la deformación nunca invierte el signo moral**. Cambia la escala, el protagonista y el detalle; no convierte un buen acto en uno feo. Signo y nivel son **datos vivos que fija el código con la siembra del paso**; solo la redacción es del narrador, y esta spec está escrita para que la invariante se pueda verificar sin ningún LLM delante.

No tiene interfaz de usuario. Las pantallas donde esto se ve son de otras filas: el aviso háptico y la marca cuando una noticia alcanza un sitio (**A3P3**, fila 29), lo que allí se cuenta al llegar a un núcleo (**A4P5**, fila 32), lo que se pone en camino al echar el telón (**A5P3**, fila 36) y el diario que registra lo oído (**A6P2**, fila 16). Aquí se entrega el dato vivo que todas ellas pintan.

Anclas: **RF-RUMOR-003**, **RF-RUMOR-004** y **RF-RUMOR-005** (`docs/prd.md` §4.3), con `game-design/quests.md` **§6** y **decisión 3** como fuente que manda sobre el PRD, y `game-design/progresion.md` §1 para por qué la granularidad es el núcleo. **RNF-DET-001** y **RNF-DET-003** aplican como invariante bloqueante. Se apoya en SPEC-007 (la marca de suposición `null` / `'cosida'` / `'fallback'` en cada tramo, que es exactamente lo que aquí se penaliza), SPEC-009 (el mundo congelado y el área `partida/`), SPEC-010 (la aventura casteada y su desenlace) y SPEC-011 (el contador de pasos, la siembra `:tick:n` y los productores inyectados: **esta spec es uno de esos productores y no reabre ninguna de sus decisiones**).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la toca, y de una sola manera**: esta entrega se registra como productor de paso en el motor de SPEC-011 y recibe de él el número del paso y su azar; está descrita en «Frontera de inyección».
- **Fuera de alcance, y son siete cosas que parecerían naturales aquí:** el **motor de pasos** con su contador, su siembra y su reserva, que esta spec **consume ya resuelto** (fila 11); la **redacción** de cualquier texto de rumor, el prompt y el filtro de aptitud (fila 18, `contrato-llm`, RF-QUEST-006/007/008); las **entradas del diario** y sus dos maneras de leerse, incluida la puesta en escena de la primera triangulación (fila 16, RF-DIARIO-001, y fila 37); el **rango social**, sus tres escalones, el trato, el precio y el mote (fila 15, RF-PROG-001/002); la **cola de oportunidades y los micro-encuentros**, que son el otro productor de paso y no este (fila 19); el **aviso** de dos capas cuando una noticia alcanza un sitio y la pantalla A3P3 (fila 29); y **cómo aflora al llegar** lo que allí se cuenta, con su pantalla A4P5 y su encadenado con el visor y el beat (fila 32, RF-BUCLE-006). Esta spec entrega **qué llegó a cada sitio y en qué estado**, no cómo se cuenta ni cómo se pinta.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El nacimiento», «El viaje», «El nivel» y «La reputación es lo que llegó»; la **validación de entradas** en el desenlace sin declaración de notable, el signo ausente o fuera del enumerado, el núcleo de origen que no existe en el mapa y el nivel fuera de rango; el **estado vacío** en el paso sin ningún rumor activo, el mundo de un solo núcleo, el núcleo que nunca ha oído nada y el rumor que nace sin ningún vecino al que llegar; el **estado de error** en el tramo sin marca de suposición, la calzada sin longitud, el paso sin tramo con el que medir y el efecto que resta; y los **casos límite** en el resto de metros del frente, los dos núcleos empatados en distancia, el salto con dos tramos `fallback`, el núcleo inalcanzable por el árbol y el segundo rumor sobre el mismo núcleo.

«Mundo congelado X» sigue significando el fixture `test/fixtures/osm/X/` de SPEC-001. **«Paso»** significa siempre paso del mundo, la unidad de SPEC-011. **«Salto»** significa arista del árbol de calzadas recorrida, es decir, un núcleo que recuenta lo que le contaron. **«Tramo»** significa el tramo personal de SPEC-004, y **«tramo de calzada»**, cuando haga falta desambiguar, el segmento de una calzada trazada con su marca de suposición.

### El nacimiento: dónde y con qué

- **Dado** un desenlace notable en el núcleo «Monfrida», **cuando** se cierra la salida, **entonces** existe un rumor en «Monfrida» en nivel 0.
- **Dado** el mismo desenlace, **cuando** se revisan los demás núcleos del mapa, **entonces** no existe en ninguno.
- **Dado** una aventura terminada cuyo desenlace no es notable, **cuando** se cierra la salida, **entonces** no nace ningún rumor.
- **Dado** una aventura cerrada en corto, **cuando** se cierra la salida, **entonces** no nace ningún rumor, aunque el desenlace de repuesto de su plantilla estuviera declarado notable.
- **Dado** una salida en la que no se cogió ninguna aventura, **cuando** se cierra, **entonces** no nace ningún rumor.
- **Dado** una plantilla, **cuando** se pregunta si su desenlace es notable, **entonces** la respuesta sale de la declaración de la plantilla y no se deduce del texto del desenlace ni de la recompensa.
- **Dado** un desenlace notable, **cuando** nace su rumor, **entonces** lleva identidad propia, núcleo de origen, signo moral, nivel 0, los hechos en su versión fiel y la semilla con la que nació.
- **Dado** un desenlace notable ocurrido en un paraje que no es núcleo, **cuando** nace su rumor, **entonces** nace en el núcleo del que cuelga ese paraje por el árbol de calzadas, en nivel 0, y ese enganche no cuenta como salto.
- **Dado** un desenlace notable, **cuando** se lee el signo del rumor, **entonces** es uno de los dos valores del enumerado cerrado y lo fija el código a partir del desenlace, nunca un texto.
- **Dado** el rumor recién nacido, **cuando** se compara su versión con lo que ocurrió, **entonces** son la misma: en nivel 0 no hay ninguna deformación aplicada.
- **Dado** dos aventuras notables terminadas en la misma salida, **cuando** se cierra, **entonces** nacen dos rumores con identidades distintas y cada uno viaja por su cuenta.
- **Dado** un rumor recién nacido, **cuando** se busca dónde se ha escrito, **entonces** está en el estado de la partida y el documento congelado de la celda sigue idéntico byte a byte.

### El viaje: un tramo por paso, por el árbol

- **Dado** un rumor en «Monfrida» y un núcleo vecino a dos tramos por calzada, **cuando** el mundo avanza un paso, **entonces** el rumor no ha llegado al vecino.
- **Dado** el mismo caso, **cuando** el mundo avanza dos pasos, **entonces** el rumor ha llegado al vecino.
- **Dado** un rumor, **cuando** el mundo da un paso, **entonces** su frente avanza exactamente un tramo de la jugadora, el mismo con el que ese paso se contó.
- **Dado** una jugadora con un tramo de 600 m y otra con uno de 2 km, **cuando** las dos avanzan el mismo número de pasos, **entonces** sus rumores han recorrido el mismo número de tramos de sus mundos respectivos.
- **Dado** un rumor cuyo frente avanza, **cuando** la distancia recorrida no completa el trecho hasta el siguiente núcleo, **entonces** el resto se conserva y se suma en el paso siguiente.
- **Dado** un rumor, **cuando** se mide la distancia hasta un núcleo, **entonces** se mide sobre la longitud real de las calzadas del árbol y no en línea recta.
- **Dado** un rumor recién nacido en «Monfrida», **cuando** la jugadora va derecho al núcleo vecino sin entretenerse, **entonces** llega a la vez que la noticia o antes.
- **Dado** un rumor y una salida en curso, **cuando** se completan los metros de un paso, **entonces** el rumor avanza durante la caminata y no al echar el telón.
- **Dado** un rumor, **cuando** el mundo no da ningún paso, **entonces** no avanza ni un metro, por mucho tiempo real que pase.
- **Dado** el árbol de calzadas, **cuando** se pregunta por el camino entre dos núcleos, **entonces** hay exactamente uno, y es por el que viaja el rumor.
- **Dado** un rumor que se bifurca en un núcleo con tres calzadas, **cuando** avanza, **entonces** sigue por las tres ramas a la vez y cada una lleva su propio frente.
- **Dado** un núcleo que ya oyó el rumor, **cuando** el frente vuelve a alcanzarlo por otra rama, **entonces** no lo vuelve a oír y su versión no cambia.
- **Dado** un núcleo al que el árbol no ofrece ningún camino desde el origen, **cuando** el rumor viaja indefinidamente, **entonces** nunca lo oye, y eso no es un error.
- **Dado** dos núcleos que el frente alcanza en el mismo paso, **cuando** se resuelve el orden en que se les entrega, **entonces** se resuelve por identificador de núcleo y no por orden de recorrido.

### El nivel: saltos, no kilómetros

- **Dado** un rumor nacido en «Monfrida», **cuando** se pregunta el nivel que corresponde a 0 saltos por calzada real, **entonces** es 0.
- **Dado** el mismo rumor, **cuando** se pregunta el nivel que corresponde a 1 salto, **entonces** es 1.
- **Dado** el mismo rumor, **cuando** se pregunta el nivel que corresponde a 2 saltos, **entonces** es 2.
- **Dado** el mismo rumor, **cuando** se pregunta el nivel que corresponde a 3 saltos, **entonces** es 3.
- **Dado** el mismo rumor, **cuando** se pregunta el nivel que corresponde a 5 saltos, **entonces** es 3: el tope no se rebasa nunca.
- **Dado** un rumor nacido en «Monfrida», **cuando** llega a un núcleo a un salto cruzando un tramo de calzada marcado `fallback`, **entonces** su nivel es 2.
- **Dado** un salto cuyo camino contiene dos tramos de calzada `fallback`, **cuando** se calcula el nivel, **entonces** ese salto suma uno solo por el trozo sin calzada real, no uno por tramo.
- **Dado** un salto cuyo camino contiene una arista marcada `cosida`, **cuando** se calcula el nivel, **entonces** no suma nada: lo cosido no penaliza.
- **Dado** dos caminos de un salto, uno con una arista `cosida` y otro sin ninguna suposición, **cuando** el rumor los recorre, **entonces** los dos núcleos lo reciben en el mismo nivel.
- **Dado** dos núcleos a 6 km de «Monfrida», y que al primero se llega por dos aldeas intermedias y al segundo directo, **cuando** el rumor alcanza a los dos, **entonces** el primero lo recibe más deformado que el segundo.
- **Dado** un núcleo que oye el rumor, **cuando** se compara su nivel con los kilómetros que el rumor recorrió hasta él, **entonces** el nivel no depende de esa distancia.
- **Dado** un núcleo que ya oyó el rumor en un nivel, **cuando** el mundo sigue avanzando pasos, **entonces** su nivel no cambia: se fija al llegar.
- **Dado** un tramo de calzada del camino sin marca de suposición declarada, **cuando** se calcula el nivel, **entonces** falla nombrando el tramo, en lugar de suponer que es calzada real.

### La escalera de cuatro niveles

- **Dado** la escalera de deformación, **cuando** se enumera, **entonces** tiene exactamente cuatro niveles con nombre: fiel, abultado, trastocado y leyenda.
- **Dado** la escalera, **cuando** se busca un valor intermedio entre dos niveles, **entonces** no existe: es enumerada y no continua.
- **Dado** un rumor en nivel 1, **cuando** se compara su versión con la fiel, **entonces** lo que ha cambiado es la escala de lo ocurrido.
- **Dado** un rumor en nivel 2, **cuando** se compara con la fiel, **entonces** ha cambiado además el detalle que importa: el motivo, el lugar o con quién.
- **Dado** un rumor en nivel 3, **cuando** se compara con la fiel, **entonces** el hecho se atribuye a otra persona o se ha fundido con un rumor viejo del mismo núcleo.
- **Dado** un rumor en nivel 3 en un núcleo donde no ha sedimentado ningún rumor anterior, **cuando** se deforma, **entonces** se resuelve por atribución a otra persona y no falla por no tener con qué fundirse.
- **Dado** una versión deformada, **cuando** se inspecciona, **entonces** los ejes que la deformación puede tocar son un catálogo cerrado y el signo moral no es uno de ellos.
- **Dado** un rumor que llega a un núcleo, **cuando** se lee lo que allí se cuenta, **entonces** son hechos estructurados y un nivel, y el texto que los cuenta viaja aparte y puede no existir todavía.
- **Dado** un rumor cuyo texto no se ha podido redactar, **cuando** se lee lo que se cuenta en un núcleo, **entonces** el nivel, el signo y los hechos están completos igual y se puede caer al texto de la plantilla.
- **Dado** el módulo de la deformación, **cuando** se inspecciona su implementación, **entonces** no llama a ningún narrador ni depende de que exista uno.
- **Dado** un nivel recibido fuera del rango de cero a tres, **cuando** se aplica la deformación, **entonces** falla nombrando el valor recibido.

### El signo moral no se invierte nunca

- **Dado** un desenlace en el que la jugadora ayudó a alguien, **cuando** el rumor llega a nivel 3, **entonces** la versión sigue siendo de un acto bueno.
- **Dado** el mismo caso, **cuando** se compara la versión de nivel 3 con la fiel, **entonces** pueden haber cambiado la escala, el protagonista o el detalle.
- **Dado** un desenlace en el que la jugadora se portó mal, **cuando** el rumor llega a nivel 3, **entonces** la versión sigue siendo de un acto feo.
- **Dado** un rumor, **cuando** se recorren todos los núcleos que lo han oído en todos los niveles, **entonces** el signo de cada versión es el del origen, sin ninguna excepción.
- **Dado** el signo de un rumor, **cuando** se busca alguna operación que lo modifique, **entonces** no existe: se fija al nacer y es de solo lectura.
- **Dado** una deformación que devolviera una versión con el signo cambiado, **cuando** se aplica, **entonces** se rechaza nombrando el rumor y el núcleo, y lo que allí se cuenta no cambia.
- **Dado** la comprobación del signo, **cuando** se ejecuta, **entonces** se resuelve sobre los datos estructurados y sin ninguna red, ningún narrador y ningún texto.

### Se agota solo y sedimenta

- **Dado** un rumor nacido en «Monfrida», **cuando** el mundo avanza cincuenta pasos, **entonces** el rumor ya no viaja.
- **Dado** el mismo rumor, **cuando** se revisan los núcleos que lo oyeron, **entonces** ha sedimentado en lo que se cuenta en cada uno de ellos.
- **Dado** un frente que entrega el rumor a un núcleo en nivel 3, **cuando** el mundo sigue avanzando, **entonces** ese frente deja de viajar y los núcleos que quedaban más allá por esa rama no lo oyen.
- **Dado** un rumor que ya ha alcanzado todos los núcleos que el árbol le permite alcanzar, **cuando** el mundo avanza otro paso, **entonces** el rumor queda agotado y no se vuelve a recorrer.
- **Dado** un rumor agotado, **cuando** se ejecutan más pasos, **entonces** no produce ningún efecto y no consume ningún azar.
- **Dado** lo que ha sedimentado en un núcleo, **cuando** pasan cien pasos más, **entonces** sigue siendo lo mismo: no caduca, no se olvida y no se degrada.
- **Dado** un mundo con veinte rumores activos a la vez, **cuando** el mundo avanza un paso, **entonces** los veinte avanzan y no hay ningún tope de rumores activos.
- **Dado** un rumor nuevo sobre un núcleo donde ya sedimentó otro, **cuando** llega, **entonces** los dos conviven y ninguno sustituye al otro.
- **Dado** la versión fiel de un rumor, **cuando** el rumor ha sedimentado deformado en varios núcleos, **entonces** la versión fiel se conserva y sigue siendo consultable para quien estuvo presente.
- **Dado** un rumor agotado, **cuando** se serializa la partida y se vuelve a cargar, **entonces** vuelve agotado y no reanuda el viaje.

### La reputación es lo que llegó

- **Dado** un núcleo, **cuando** se pregunta qué se cuenta allí de la jugadora, **entonces** se obtienen las versiones que ese núcleo oyó, cada una con su nivel y su signo.
- **Dado** dos núcleos que oyeron el mismo suceso en niveles distintos, **cuando** se pregunta a cada uno, **entonces** cada uno devuelve su propia versión y no la del otro.
- **Dado** un desenlace notable en «Monfrida» y un núcleo vecino al que llega el rumor, **cuando** se pregunta qué se cuenta en ese vecino, **entonces** allí ya saben quién es, aunque la jugadora no haya estado nunca.
- **Dado** una jugadora que pasa por «Vilanova» cada día sin hacer nada allí, **cuando** el mundo avanza veinte pasos, **entonces** en «Vilanova» no ha llegado nada suyo y lo que allí se cuenta sigue vacío.
- **Dado** un núcleo que no ha oído nada, **cuando** se le pregunta, **entonces** devuelve que no hay nada que contar, y no un error.
- **Dado** la superficie pública de esta entrega, **cuando** se busca una consulta que devuelva el estado de todos los núcleos del mapa a la vez, **entonces** no existe: se pregunta núcleo a núcleo.
- **Dado** lo que se entrega a la capa que pinta, **cuando** se inspecciona, **entonces** no lleva el nivel de deformación.
- **Dado** un rumor que llega a un núcleo, **cuando** se mira el efecto que el paso produce, **entonces** es de un tipo del catálogo cerrado de SPEC-011 y añade: no resta oro, ni baja ningún rango, ni retira nada.
- **Dado** una partida con dos mapas, **cuando** un rumor viaja en uno, **entonces** los núcleos del otro no oyen nada y su estado no cambia.
- **Dado** un mapa nuevo levantado en otro sitio, **cuando** se pregunta qué se cuenta en sus núcleos, **entonces** no se cuenta nada de la jugadora en ninguno.
- **Dado** un rumor que llega a dos núcleos con distinto nivel, **cuando** se lee lo que llegó a cada uno, **entonces** los dos datos permiten que la jugadora tenga un mote distinto en cada sitio.
- **Dado** el estado de un núcleo, **cuando** se busca dónde se guarda, **entonces** viaja con la partida y nunca dentro del documento congelado de ninguna celda.

### Determinismo y estado de partida

- **Dado** el mismo mundo, la misma partida y los mismos pasos, **cuando** se propaga dos veces desde cero, **entonces** los núcleos alcanzados, los niveles y las versiones son idénticos.
- **Dado** un paso, **cuando** la propagación consume azar, **entonces** lo deriva del azar que el motor le entrega para ese paso, con un sufijo propio.
- **Dado** que se añade otro productor de paso al motor, **cuando** se vuelve a propagar la misma partida, **entonces** los rumores salen idénticos a los de antes.
- **Dado** la deformación de un rumor en un núcleo, **cuando** se inspecciona su siembra, **entonces** depende del paso, del rumor y del núcleo, de modo que alcanzar un núcleo más no cambia lo que se contó en los anteriores.
- **Dado** los módulos de esta entrega, **cuando** se inspecciona su implementación, **entonces** no aparece `Math.random()`, ni `Date.now()`, ni `new Date()`, ni ninguna iteración cuyo resultado dependa del orden de inserción de un `Set` o un `Map`.
- **Dado** un rumor a mitad de viaje, **cuando** se serializa la partida y se vuelve a cargar, **entonces** vuelve con su frente, su resto, sus núcleos alcanzados y sus niveles, y sigue exactamente donde estaba.
- **Dado** un mundo congelado, **cuando** un rumor lo recorre entero durante cincuenta pasos, **entonces** el documento de cada celda sigue idéntico byte a byte.
- **Dado** los módulos de esta entrega, **cuando** se inspeccionan sus imports, **entonces** no importan `buildWorld` ni ninguna fase de la generación.

### Vacíos, entradas inválidas y errores

- **Dado** un paso ejecutado sin ningún rumor activo, **cuando** se invoca este productor, **entonces** no produce ningún efecto y no falla.
- **Dado** un mundo con un solo núcleo, **cuando** nace un rumor, **entonces** sedimenta ahí y no viaja a ninguna parte, sin error.
- **Dado** un mundo sin ninguna calzada real, donde todas están marcadas `fallback`, **cuando** el rumor viaja, **entonces** viaja igual y cada salto suma dos niveles.
- **Dado** un desenlace cuya plantilla no declara si es notable, **cuando** se cierra la salida, **entonces** falla nombrando la plantilla, en lugar de suponer que no lo es.
- **Dado** un rumor que se intenta crear sin signo o con un signo fuera del enumerado, **cuando** nace, **entonces** falla nombrando el valor recibido.
- **Dado** un núcleo de origen que no existe en el mapa activo, **cuando** nace el rumor, **entonces** falla nombrando el núcleo.
- **Dado** una calzada del árbol sin longitud declarada, **cuando** el frente intenta avanzar por ella, **entonces** falla nombrando la calzada, en lugar de suponer una distancia.
- **Dado** un paso que llega sin el tramo con el que medir, **cuando** el rumor intenta avanzar, **entonces** falla nombrando el tramo que falta.
- **Dado** un paso en el que la propagación falla a mitad, **cuando** se lee el estado, **entonces** ni el contador ni lo que se cuenta en ningún núcleo han cambiado: el paso se aplica entero o no se aplica.
- **Dado** un mapa sin ningún núcleo, **cuando** se propaga, **entonces** no ocurre nada y no falla.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/rumores.js` | la forma del rumor, su nacimiento, el frente por rama con su resto, el agotamiento y el **productor de paso** que se registra en el motor |
| `packages/nucleo/partida/deformacion.js` | la escalera cerrada de cuatro niveles, el cálculo de saltos con la penalización de `fallback`, las transformaciones sobre los hechos y la invariante del signo |
| `packages/nucleo/partida/nucleos.js` | lo que se cuenta en cada núcleo: las versiones que oyó, con su consulta **por núcleo** y nunca por mapa |

Las tres viven en `partida/` por la misma razón que las de SPEC-011: **un rumor es estado de la jugadora sobre un mundo congelado, no parte del mundo**. Las áreas del paquete están fijadas desde SPEC-002 (`core`, `world`, `names`, `quests`, `partida`) y esta entrega no abre ninguna nueva.

### Frontera de inyección

Esta spec añade **una sola** entrada al núcleo, y no es un sensor: **se registra como productor de paso** en el motor de SPEC-011, que le entrega el número del paso, su azar derivado y el tramo con el que ese paso se contó. Todo lo demás lo recibe como argumento de quien construye la partida y no lo lee de ningún almacén:

- **El árbol de calzadas del mundo congelado**, con sus núcleos, la longitud real de cada calzada y la marca de suposición de cada uno de sus tramos. Sale de SPEC-007 congelado por SPEC-009; **esta entrega no traza, no cose y no recalcula el árbol de expansión mínima**, lo lee.
- **El desenlace de una aventura terminada**, con la declaración de rumor de su plantilla —si es notable, con qué semilla nace, y el signo del acto— y el lugar donde ocurrió. Sale de SPEC-010 y de la fila 17; mientras el catálogo de la fila 17 no exista, sirve la declaración de las seis plantillas ya portadas.
- **El catálogo cerrado de tipos de efecto** de SPEC-011, del que esta entrega usa el que corresponde a una noticia que llega a un sitio. No define tipos nuevos que resten.

Hacia fuera entrega dos cosas y solo dos: **los efectos del paso**, que consume el motor, y **la consulta de qué se cuenta en un núcleo**, que consumen las filas 32, 16 y 15. No entrega ni un texto destinado a mostrarse.

### La forma del rumor y de lo que oye un núcleo

Tres piezas, y conviene separarlas porque las consumen agentes distintos:

- **El rumor**: identidad, núcleo de origen, semilla de nacimiento, **signo** (enumerado cerrado de dos valores, de solo lectura), los **hechos** en su versión fiel, y el estado del viaje —los frentes vivos por rama, con su alcance en metros y su resto, y los núcleos ya alcanzados—.
- **Los hechos**: la representación estructurada de lo que ocurrió sobre la que opera la deformación. Los **ejes deformables son un catálogo cerrado** —escala, protagonista, detalle— y el signo **no es uno de ellos**. Que la deformación sea una función sobre datos y no sobre prosa es lo único que hace verificable «La deformación no invierte el signo moral» sin un LLM delante, y es la razón de que esta pieza exista.
- **Lo que se cuenta en un núcleo**: por cada rumor que oyó, la versión deformada de los hechos, su nivel, su signo y la referencia al texto —del narrador si existe, de la plantilla si no—. El **texto viaja aparte** y puede faltar: sin él, el dato sigue completo.

La escalera es acumulativa: el nivel 2 lleva encima lo que hizo el 1, y el 3 lo que hicieron los dos. Es como se deforma algo que se recuenta, y además hace que la escalera sea monótona, que es lo que permite afirmar «el primero lo recibe más deformado que el segundo» sin comparar textos.

### El nivel, el tope y por qué `cosida` no penaliza

`nivel = min(3, saltos + saltos_que_cruzan_un_trozo_sin_calzada_real)`. Tres cosas de esa fórmula son decisiones y no aritmética:

- **Se cuentan saltos, no metros.** Deforma quien lo recuenta, que es un acto social y no geográfico. Es lo que hace legible la forma del árbol en la narrativa: dos pueblos a la misma distancia reciben distinta versión según cuántas aldeas haya en medio.
- **La penalización es por salto, no por tramo.** Un salto cuyo camino cruza dos trozos `fallback` suma uno, no dos: el salto es una boca que recuenta, y lo que la penalización modela es que la noticia cruzó el monte, no cuántas veces lo cruzó.
- **`cosida` no penaliza y `fallback` sí.** SPEC-007 distingue los dos valores a propósito y lo dice con todas las letras: el filtro de accesibilidad trata igual a las dos —ninguna se promete transitable— y **la propagación no**. Cruzar un hueco de 22 m que OSM no trae es una carretera real que el dato no traía; cruzar un `fallback` es ir por donde no hay camino que conozcamos. Colapsarlos en un booleano haría que media red penalizara sin motivo, y es el error más fácil de cometer al implementar esto.

### Dónde se para el rumor, y la contradicción que esta spec resuelve

`quests.md` §6 dice que el rumor deja de viajar **al llegar a nivel 3 o al quedarse sin núcleos que no lo hayan oído**. El esquema de escenario «La deformación cuenta saltos, no kilómetros» de `docs/testing.md` incluye una fila `| 5 | 3 |`, que redactada como llegada supondría que un núcleo a cinco saltos llega a oírlo.

Las dos cosas no pueden ser verdad a la vez, y `CLAUDE.md` fija la precedencia: **si un escenario y un documento se contradicen, manda el documento**. Así que aquí:

- **Un frente se para en cuanto entrega el rumor a un núcleo en nivel 3.** Ese núcleo sí lo oye; los que quedan más allá por esa rama, no.
- **La fila de 5 saltos se reexpresa como propiedad de la función de nivel** —cuánto vale el nivel para cinco saltos— en lugar de como una llegada. Es exactamente el mismo tratamiento que SPEC-011 dio al escenario de la semilla `lat,lon#n`: el escenario sigue pasando, reexpresado sobre el mecanismo nuevo. Por eso los criterios de «El nivel» preguntan por el nivel que *corresponde* a N saltos y no por el nivel *con el que llegó*.
- **«El rumor se agota solo» sigue siendo verdad por las dos vías**, y la que lo cierra en un mundo pequeño es la segunda: el árbol es finito, así que no hace falta ningún límite de rumores activos ni ninguna caducidad por tiempo.

Esta contradicción se anota también como hueco de la batería, más abajo: quien mantenga `docs/testing.md` tendrá que reescribir esa fila o el documento, y no es decisión de esta spec.

### El reparto de RF-RUMOR-005, y las demás fronteras

RF-RUMOR-005 aparece en dos filas del checklist —la 12 y la 32— y el reparto es este:

| Aquí, fila 12 | Fila 32, `llegadas-geofence` |
| --- | --- |
| qué versión llegó a cada núcleo, con su nivel y su signo | cuándo aflora, al pararse dentro del geofence |
| la consulta por núcleo, y que no exista una por mapa | la pantalla A4P5 y su encadenado con el visor y el beat |
| que lo que se entrega no lleve el nivel | que la pantalla no enseñe ningún nivel ni etiqueta de fiabilidad |

Con las demás filas la frontera es de una línea cada una: **la fila 11** decide cuándo ocurre un paso y con qué azar, y esta decide qué pasa en él; **la fila 18** redacta la versión con el signo y el nivel como restricción del prompt, y aquí se fijan los dos; **la fila 16** copia al diario la versión que se oyó, y aquí se produce; **la fila 15** convierte lo que llegó en rango, trato, precio y mote, y aquí solo se entrega lo que llegó; **la fila 29** convierte una noticia que alcanza un sitio en háptico y marca; **la fila 19** es el otro productor de paso y no comparte código con este; y **la fila 36** decide si al echar el telón aparece la pantalla de lo que se pone en camino, que es la que nunca enseña adónde llegará.

Y una frontera que conviene decir en voz alta porque parece de aquí y no lo es: **el testigo directo**. `npcs.md` dice que quien estuvo presente cuenta la versión fiel y no corrige al pueblo. Lo que esta spec aporta es que la versión fiel **se conserva** aunque el rumor haya sedimentado torcido en ese mismo núcleo; quién la cuenta y cómo es de la fila 14.

### Lo que consume de otras specs y no respecifica

- **SPEC-007** entrega la marca de suposición obligatoria en cada tramo, con sus tres valores. Aquí no se vuelve a decidir su forma: se consume, y un tramo sin marca hace fallar el cálculo del nivel en lugar de asumir calzada real.
- **SPEC-009** entrega el mundo congelado y establece que el documento de celda describe el mundo y no crece al andar. El rumor no entra ahí ni cuando sedimenta.
- **SPEC-010** entrega la aventura casteada y su desenlace. Si es notable y con qué semilla nace su rumor lo declara la plantilla (RF-QUEST-009, fila 17), no lo deduce esta spec.
- **SPEC-011** entrega el contador, la siembra `:tick:n`, el catálogo cerrado de efectos aditivos, la regla de que un paso se aplica entero o no se aplica y la de que añadir un productor no desplaza el azar de los demás. **Nada de eso se reabre**: se consume, y por eso los criterios de determinismo de aquí hablan del azar *derivado* del que el motor entrega.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Se referencian por su nombre literal, no se duplican: la batería se escribió antes que el código y sus nombres son el contrato con `wa-qa-dev`.

- De **«El rumor nace donde ocurrió y viaja por el árbol de calzadas»** (`@nucleo @rumores`), que es la característica propia de esta spec: «Nace fiel y en el sitio», «Avanza un tramo por paso del mundo», «El jugador se puede adelantar a su propia fama», «La deformación cuenta saltos, no kilómetros», «Cruzar un tramo sin calzada real cuesta un nivel más», «Dos núcleos a la misma distancia pueden recibir versiones distintas», «La deformación no invierte el signo moral» y «El rumor se agota solo».
- De **«No hay niveles, hay rango social por núcleo»**: «El rango sube por lo que llega, no por lo que se pisa» y «Se puede ser alguien en un pueblo donde no has estado», que aquí se sostienen sobre el dato —qué llegó a cada núcleo— y no sobre el rango, que es de la fila 15; y «El rango no viaja entre mapas», del que aquí se afirma que los rumores tampoco.
- De **«El telón se echa solo al cerrarse la salida»**: «Un cierre en corto no genera rumor», «El rumor solo aparece si el desenlace era notable» y «Un paseo sin aventura tiene telón completo menos desenlace», de los que aquí se sostiene la mitad `@nucleo`: si nace o no nace rumor. Que la pantalla aparezca o no es de la fila 36, igual que «El telón no enseña la propagación».
- De **«El diario registra lo oído, no lo cierto»**: «Se guarda la versión deformada» y «El testigo directo es fiel y no corrige al pueblo» necesitan que la versión deformada y la fiel convivan, que es lo que esta spec garantiza; las entradas del diario son de la fila 16.
- De **«El oro compra saber y favores, nunca metros»**: «Lo que compras es la versión que ese informante oyó», que solo puede ser cierto si lo que se guarda por núcleo es la versión de ese núcleo y no la fiel.
- De **«El personaje se elige una vez y el oficio no se cambia»**: «El mote nace del rumor y es por núcleo», que aquí se deja preparado —dos núcleos con distinto nivel— y lo cierra la fila 15.
- De **«Lo generado no se resiembra jamás»**: la propagación es, junto con los pasos, lo más fácil de romper de esa característica; el mundo congelado tiene que seguir idéntico byte a byte con el mapa entero enterado.
- **Frontera, que esta spec deja preparada y no implementa:** «Una noticia va por háptico y marca» (fila 29), «Lo que aquí se cuenta cierra la llegada a un núcleo» y «Sin beat, lo que se cuenta es la llegada entera» (fila 32), «El nivel de deformación no sale nunca a pantalla» y «Una entrada no se sobrescribe con otra más veraz» (filas 16 y 37), «No hay ninguna barra ni lista de reputación» (fila 15, y aquí se le quita el arma: no existe consulta por mapa).

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería, no de esta spec, y `wa-qa-dev` tendrá que marcarlos como casos sin escenario de respaldo en lugar de inventarse uno:

- **La contradicción de la fila de 5 saltos**, descrita arriba. Es el hueco más importante y hay que resolverlo en la batería o en `quests.md` §6, no en el código.
- **Nada afirma que un tramo `cosida` no penaliza.** Hay escenario para `fallback` y ninguno para lo cosido, que es justo la mitad que se pierde si alguien colapsa el enumerado en un booleano.
- **Nada dice dónde nace un rumor cuyo desenlace ocurrió en un paraje.** Los escenarios nacen todos en un núcleo, y las aventuras terminan en parajes con frecuencia.
- **Nada verifica que la versión fiel se conserva.** «El testigo directo es fiel y no corrige al pueblo» lo exige, pero es un escenario `@app` de la capa de NPCs y no mira el dato.
- **Nada afirma que la propagación no toca el mundo congelado.** «Lo generado no se resiembra jamás» habla de la generación; la propagación es capa, igual que el motor de pasos, y por su letra no queda cubierta.
- **Nada verifica el agotamiento por haber alcanzado a todos.** «El rumor se agota solo» usa cincuenta pasos sin decir el tamaño del mundo: el número no es afirmable sin fijar el fixture, y la condición que de verdad lo agota en un mundo pequeño es la otra.
- **Nada verifica que varios rumores no se estorban.** Todos los escenarios tienen uno solo, y la convivencia de versiones en un mismo núcleo es lo que sostiene la triangulación.
- **Nada afirma que no exista una consulta del estado de todo el mapa.** «No hay ninguna barra ni lista de reputación» mira las pantallas; el panel se evita mejor no exportando el dato que confiando en que nadie lo pinte.

## Decisiones asumidas

- **El frente se para al entregar el rumor en nivel 3** → asumido (alternativa: seguir viajando con el nivel topado en 3, que es lo que sugiere la fila `| 5 | 3 |` de la batería). Regla: `CLAUDE.md`, «si un escenario y un documento se contradicen, manda el documento», y `quests.md` §6 dice «al llegar a nivel 3 … deja de viajar»; la fila del esquema se reexpresa como propiedad de la función de nivel, con el precedente de SPEC-011 y la semilla.
- **El frente avanza un tramo personal por paso, no 2 km fijos** → asumido, usando el mismo tramo con el que ese paso se contó (alternativas: 2 000 m constantes, o el tramo vivo en cada momento). Regla: `accesibilidad.md` §1 y SPEC-011 — un paso *es* un tramo andado; con 2 km fijos, quien anda 600 m por paso vería su fama adelantarse siempre, y «El jugador se puede adelantar a su propia fama» dejaría de valer para ella.
- **La latencia se mide sobre la longitud real de las calzadas del árbol** → asumido (alternativa: distancia en línea recta entre núcleos, como hace el prototipo en otras medidas). Regla: `quests.md` §6 habla de «latencia por distancia real»; y con el grafo cosido de SPEC-007 medir de verdad ya es posible, así que un factor de rodeo sería una aproximación con fecha de caducidad.
- **El resto de metros del frente se conserva entre pasos** → asumido (alternativa: descartarlo y recalcular el alcance como pasos × tramo). Regla: es la misma decisión que SPEC-011 tomó con el resto de la jugadora, y por la misma razón: sin ella, el rumor avanzaría distinto según cómo se trocearan los pasos.
- **La penalización de `fallback` es por salto, no por tramo de calzada** → asumido: un salto cuyo camino cruza uno o varios trozos sin calzada real suma uno (alternativa: uno por tramo `fallback`). Regla: el nivel cuenta actos sociales —bocas que recuentan—, y `quests.md` §6 dice «un nivel extra si cruzó un tramo sin calzada real»; contar por tramo haría que la geometría del trazado, que no es una decisión de diseño, moviera el nivel.
- **Una arista `cosida` no penaliza** → asumido (alternativa: penalizar las dos marcas, como hace el filtro de accesibilidad). Regla: SPEC-007 lo deja escrito —«la propagación solo penaliza `fallback`»— y es la razón declarada de que el campo sea un enumerado de tres valores y no un booleano.
- **El signo es un enumerado cerrado de dos valores, fijado al nacer y de solo lectura** → asumido (alternativa: tres valores con un neutro, o un número con signo). Regla: la invariante que hay que poder verificar es «no se invierte», y un neutro la debilita sin añadir nada que el diseño pida; que sea de solo lectura es lo que la hace estructural en vez de una convención.
- **La deformación opera sobre hechos estructurados con ejes cerrados, no sobre prosa** → asumido (alternativa: guardar solo el texto y validar el signo a posteriori sobre él). Regla: `quests.md` decisión 1, «si alguna regla bifurca por él, no lo escribe el modelo»; y sin datos estructurados, «La deformación no invierte el signo moral» solo se puede comprobar con un LLM delante, que es exactamente lo que la batería `@nucleo` no puede hacer.
- **La escalera es acumulativa** → asumido: el nivel 2 conserva lo que hizo el 1 (alternativa: cada nivel sustituye la transformación anterior). Regla: es como se deforma algo al recontarse, y es lo que hace monótona la escalera, sin lo cual «el primero lo recibe más deformado que el segundo» no es afirmable sin comparar textos.
- **En nivel 3 sin ningún rumor viejo con el que fundirse, se resuelve por atribución a otra persona** → asumido (alternativa: quedarse en nivel 2). Regla: `quests.md` §6 ofrece las dos formas de «leyenda» como alternativas y no como requisitos; degradar el nivel haría que el estado de un núcleo dependiera de cuántos rumores hubieran pasado antes por él, que es una dependencia de orden encubierta.
- **Un desenlace ocurrido en un paraje engendra el rumor en el núcleo del que cuelga ese paraje, sin contar como salto** → asumido (alternativa: que el paraje sea nodo del árbol y el enganche sume un salto). Regla: `quests.md` §6 dice «nace en el núcleo donde ocurrió, en nivel 0» y `progresion.md` §1 fija la granularidad en el núcleo; cobrar el enganche haría que ninguna aventura terminada fuera de un pueblo pudiera contarse fiel en ningún sitio.
- **El cierre en corto no engendra rumor aunque su desenlace de repuesto esté declarado notable** → asumido (alternativa: mirar la declaración de la plantilla también en el cierre en corto). Regla: RF-QUEST-013 y el escenario «Un cierre en corto no genera rumor» son categóricos, y la arista de `docs/flujo.md` lo dice con esas palabras: «un cierre en corto no genera rumor nunca».
- **La consulta es por núcleo y no existe ninguna que devuelva el mapa entero** → asumido (alternativa: exponer el estado completo y confiar en que nadie lo pinte). Regla: exclusión 4 del PRD y el design system, «ningún panel del estado del mundo» y «ningún medidor de reputación»; lo que no sale del núcleo no se puede pintar por descuido, que es el mismo argumento con el que SPEC-011 no expone el contador.
- **El nivel no viaja con lo que se entrega a la capa que pinta** → asumido (alternativa: entregarlo y que la pantalla decida no mostrarlo). Regla: design system, «ningún nivel de deformación de un rumor: es dato vivo interno y no sale a pantalla en ningún sitio»; el escenario «El nivel de deformación no sale nunca a pantalla» es mucho más barato de sostener si el dato no llega hasta ahí.
- **La deformación se siembra por paso, rumor y núcleo** → asumido (alternativa: consumir el azar del paso en el orden en que se alcanzan los núcleos). Regla: `CLAUDE.md`, un sufijo distinto por fase para que tocar una no desplace el azar de las demás; con un solo generador, alcanzar un núcleo más cambiaría la versión de todos los anteriores.
- **Los rumores y lo sedimentado son estado de partida, por mapa** → asumido, en `packages/nucleo/partida/` (alternativa: guardarlos con el mundo congelado, que es donde vive el árbol por el que viajan). Regla: SPEC-009 fija que el documento de celda describe el mundo y no crece al andar, y «El mundo no cambia durante la salida» no admite que lo que hizo la jugadora repinte el mapa de nadie.
- **La versión fiel se conserva siempre, además de la sedimentada** → asumido (alternativa: guardar solo la versión de cada núcleo). Regla: «El testigo directo es fiel y no corrige al pueblo» (`npcs.md`) exige que la fiel exista aunque en ese mismo núcleo se cuente otra cosa; y sin ella, la triangulación del diario no tendría contra qué contrastarse.
- **Los rumores no viajan entre mapas** → asumido (alternativa: un solo estado social para toda la partida). Regla: «El rango no viaja entre mapas» y RF-PERS-007; la propagación es sobre el árbol de un mapa, y dos mapas no comparten árbol.
- **No hay tope de rumores activos ni caducidad por tiempo** → asumido (alternativa: un tope de N activos o un horizonte de pasos). Regla: `quests.md` §6, «no hace falta límite de rumores activos: el árbol es finito»; y una caducidad por pasos sería penalizar la ausencia por la puerta de atrás.
- **La propagación se registra como productor de paso y el motor no la conoce** → asumido (alternativa: que el motor la llame directamente). Regla: SPEC-011 lo deja decidido —«el motor no sabe qué es un rumor»— y si el motor la importara, esta fila no se podría entregar ni probar por separado.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-011.
- **Sin `## UX Design` y sin comportamiento responsive** → asumido: esta spec no dibuja pantalla; A3P3, A4P5, A5P3 y A6P2 son de las filas 29, 32, 36 y 16 (alternativa: especificar aquí lo que se ve al llegar a un pueblo). Regla: decisión 3 de `pipeline/decisiones-orquestador.md` y el design system, que prohíbe rediseñar una pantalla ya dibujada.
