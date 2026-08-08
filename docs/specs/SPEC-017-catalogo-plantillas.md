# SPEC-017 — El catálogo de plantillas-arquetipo, y las reglas de lenguaje que lo gobiernan

## Descripción

Hasta aquí el proyecto ha construido el mundo y todos los mecanismos que operan encima: castea (SPEC-010), propaga rumores (SPEC-012), despierta caras y rompe relaciones (SPEC-014), reparte oro, objetos y motes (SPEC-015) y lo anota todo en el diario (SPEC-016). Nueve de esas specs terminan con la misma frase escrita de una manera u otra: *«mientras el catálogo de la fila 17 no exista, sirve la declaración de las seis plantillas ya portadas»*. Esta es la fila 17, y lo que entrega es a la vez **contenido y contrato**: entre 24 y 30 plantillas-arquetipo escritas a mano, y la declaración cerrada que cada una tiene que traer para que los mecanismos que ya existen tengan de qué tirar.

Una plantilla ya no es un texto. Son **roles que castean**, un **lazo que cierra**, una **afinidad de oficios declarada** —con unas pocas exclusivas, que son las que hacen que elegir oficio signifique algo—, **textos de fallback** dignos para cuando no hay red, un **desenlace de repuesto** para quien se vuelve a mitad, la **declaración de rumor** con su semilla de hechos estructurados, el **mote candidato**, lo que el desenlace entrega en oro y objetos, y —desde SPEC-014— **qué actos rompen y qué actos reparan una relación**. Todo en cómico-cálido y escrito para leerse en voz alta, porque este juego se juega andando con alguien al lado.

Y con el catálogo vienen las reglas de lenguaje, que aquí dejan de ser un principio para convertirse en una comprobación: **el lenguaje es inclusivo con el sesgo hacia el femenino** y se reformula antes de desdoblar; **ningún texto depende de un número que solo existe en la maqueta** ni enseña una cifra de distancia o de esfuerzo; y **el chiste nunca es a costa del sitio real ni de quien lo regenta**. Las dos primeras se comprueban con una lista y una batería de mundos; la tercera es criterio de revisión del catálogo entero y va a mano, y esta spec entrega la mitad que sí se puede afirmar: que ningún texto nombre nunca el sitio de verdad.

Hay dos cosas que este catálogo mueve y que no son suyas, y conviene decirlas en la descripción porque cambian números de otras filas. La primera: **el catálogo es la fuente del vocabulario de escenas** que SPEC-006 consume, así que al ensancharlo **el suelo de parajes sube solo**, sin tocar el generador. La segunda: el cuello de botella medido no es el catálogo, es el barrio — los fallos del informe dicen todos lo mismo, *sin candidatos para X: un paraje con escena Y*—, de modo que ampliar el catálogo hay que hacerlo **variando los roles que pide** y no solo la historia que cuenta, o las plantillas nuevas fallarán en los mismos barrios por la misma razón.

No tiene interfaz de usuario. Nada de lo que decide esta spec se pinta: la lista de aventuras es de la fila 28 (`A2P3`), la escena de cada beat de la fila 34, el desenlace y el cierre en corto de la fila 36 (`A5P2`) y la repisa con los motes de la fila 38 (`A6P5`). Aquí se entrega el dato y el texto que las cuatro consumen.

Anclas: **RF-QUEST-009**, **RF-LANG-001**, **RF-LANG-003** y **RF-LANG-004** (`docs/prd.md` §4.2 y §4.12), con el **riesgo 2** del PRD §8 —«el catálogo de 20-30 plantillas es trabajo real»— como aviso previo y su mitigación convertida aquí en criterios. Las fuentes, que mandan sobre el PRD: `game-design/quests.md` §7 (plantilla y casting), §6 (declaración de rumor) y decisión 1 (fallbacks dignos); `game-design/personaje.md` §3 (el oficio filtra con afinidad declarada, y lo que cuesta una plantilla); `game-design/bucle-jugable.md` §6 (tono cómico-cálido) y §4 (desenlace de repuesto); y `game-design/lenguaje.md` entero. **RNF-DET-001** y **RNF-DET-003** aplican como invariante bloqueante.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la hay**, y son tres: el oficio de la jugadora y su género gramatical entran inyectados al filtrar y al resolver los textos, y el vocabulario de escenas sale de aquí hacia la tubería.
- **Fuera de alcance, y son siete cosas que parecerían naturales aquí:** el **motor de casting** que resuelve estos roles contra el mundo, con su presupuesto, su lazo y su catálogo de motivos (SPEC-010, ya especificada: se consume entera y no se reabre); el **contrato con el LLM**, el prompt, el registro de tópicos y el filtro de aptitud sobre texto generado (fila 18, RF-QUEST-006/007/008 y RF-LANG-005 — aquí se entregan los textos de plantilla, que son el suelo, no la piel); el **catálogo de escenas de un beat** de los micro-encuentros y su cola (fila 19, RF-QUEST-010); la **pantalla que ofrece las aventuras**, el tope de tres y la oferta del estirón (fila 28, RF-QUEST-011 y RF-QUEST-012); **la elección de oficio en el arranque** y la pantalla que dice qué implica (fila 27, RF-PJ-*); **cuándo se dispara el cierre en corto y cuál de los dos textos de repuesto se usa** (fila 36, RF-QUEST-013 — aquí solo se declaran los dos); y los **sucesos del prólogo**, que tienen su propio catálogo cerrado y no salen de plantillas (SPEC-013). Esta spec entrega **qué plantillas hay, qué declaran y cómo están escritas**, no quién las castea, quién las ofrece ni quién las viste.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El catálogo», «La afinidad de oficio», «Lo que declara un desenlace» y «Los textos de fallback»; la **validación de entradas** en la plantilla sin afinidad, el oficio fuera del enumerado, el rumor notable sin semilla, el objeto sin clase, el mote redactado y el texto que no pasa el lint; el **estado vacío** en el oficio sin ninguna plantilla exclusiva, la plantilla sin efectos de relación declarados, el desenlace sin oro y el mundo que no castea nada; el **estado de error** en la escena fuera de la taxonomía, la ranura de concordancia desconocida, la plantilla que no cierra lazo en ningún mundo de la batería y el catálogo que se carga incompleto; y los **casos límite** en el catálogo en su tamaño mínimo, el barrio de tres calles, la plantilla exclusiva del oficio con menos cobertura y la plantilla sin ningún rol de paraje.

«Mundo congelado X» sigue significando el fixture `test/fixtures/osm/X/` de SPEC-001, y **«la batería de mundos»** significa los cuatro congelados más los sintéticos con los que ya mide `test/casting-report.mjs`. **«Plantilla casteable en un mundo»** significa lo que SPEC-010 dice: reparto completo, presupuesto dentro del tamaño declarado y lazo cerrado.

### El catálogo: cuántas, cómo son y qué se comprueba al cargarlo

- **Dado** el catálogo entregado, **cuando** se cuenta, **entonces** tiene entre 24 y 30 plantillas.
- **Dado** el catálogo, **cuando** se leen los identificadores de sus plantillas, **entonces** no hay ninguno repetido.
- **Dado** cualquier plantilla del catálogo, **cuando** se valida con la validación de plantilla que ya existe, **entonces** pasa sin excepciones: roles con tipo declarado, orden de resolución explícito, cadena de beats no vacía y disparadores y resultados del enumerado.
- **Dado** el catálogo, **cuando** se carga el módulo, **entonces** se comprueba a sí mismo entero y falla nombrando la plantilla y el campo, en vez de dejar el error para el primer casteo que la use.
- **Dado** una plantilla a la que le falta cualquiera de las declaraciones obligatorias —afinidad de oficio, rumor, desenlace, desenlace de repuesto o textos de fallback—, **cuando** se carga el catálogo, **entonces** falla nombrando la plantilla y la declaración que falta.
- **Dado** el catálogo, **cuando** se leen los tamaños declarados, **entonces** los tres tamaños de salida están representados y ninguno se queda sin ninguna plantilla.
- **Dado** las seis plantillas que venían del prototipo, **cuando** se leen sus textos en el catálogo entregado, **entonces** están reescritas en cómico-cálido y ninguna conserva el registro de cuento popular.

### La afinidad de oficio, y las exclusivas que le dan dientes

- **Dado** el enumerado de oficios, **cuando** se lee, **entonces** es cerrado, tiene entre tres y cuatro entradas y cada una sale de un tipo de servicio que el mundo sabe generar.
- **Dado** una clave de oficio, **cuando** se lee, **entonces** no nombra ningún género: la palabra con la que se dice la pone el paquete de idioma y concuerda con el género gramatical de la jugadora.
- **Dado** cualquier plantilla del catálogo, **cuando** se lee su afinidad, **entonces** declara al menos un oficio del enumerado.
- **Dado** una plantilla que declara un oficio que no está en el enumerado, **cuando** se carga el catálogo, **entonces** falla nombrando el oficio recibido y enumerando los válidos.
- **Dado** el catálogo, **cuando** se cuentan las afinidades declaradas, **entonces** la media de oficios por plantilla está entre 1,5 y 2.
- **Dado** cualquier oficio del enumerado, **cuando** se buscan sus plantillas exclusivas, **entonces** tiene al menos una que ningún otro oficio ve nunca.
- **Dado** el catálogo, **cuando** se cuentan las exclusivas, **entonces** no pasan de un tercio del total, para que filtrar por oficio no deje a cada uno con su rincón.
- **Dado** un oficio, **cuando** se filtra el catálogo por él, **entonces** se obtienen solo las plantillas que declaran afinidad con ese oficio.
- **Dado** un oficio, **cuando** se filtra el catálogo por él, **entonces** existe al menos una plantilla del catálogo que no aparece nunca con ese oficio.
- **Dado** el filtro por oficio, **cuando** se inspecciona, **entonces** no castea nada: devuelve plantillas y quien las castea es SPEC-010.
- **Dado** dos oficios distintos, **cuando** se filtra el catálogo con cada uno, **entonces** las dos listas conservan el orden declarado del catálogo y no dependen del oficio.

### El suelo de casteo por oficio, que se mide y no se estima

- **Dado** el catálogo y el mundo congelado `barrio-tres-calles`, **cuando** se castea filtrando por cada oficio, **entonces** cada oficio conserva al menos diez plantillas casteables.
- **Dado** cualquier mundo de la batería y cualquier oficio, **cuando** se castea filtrando por él, **entonces** el resultado no es cero.
- **Dado** el catálogo, **cuando** se mide la casteabilidad sobre la batería entera, **entonces** la proporción de plantillas que castean no baja de la que dan hoy las seis portadas sobre los mismos mundos.
- **Dado** el resultado de castear el catálogo sobre la batería, **cuando** se agrega por oficio, **entonces** el recuento sale de las declaraciones y del catálogo cerrado de motivos, sin parsear ninguna frase.
- **Dado** la medida de cobertura por oficio, **cuando** se pide, **entonces** la calcula una función del paquete y no el script que la imprime.
- **Dado** un oficio y un mundo, **cuando** se listan sus plantillas no casteables, **entonces** cada una trae el motivo estructurado que SPEC-010 define, con su clave, su rol y su requisito.

### El catálogo es la fuente del vocabulario de escenas

- **Dado** el catálogo entregado, **cuando** se le pide el vocabulario de escenas de paraje, **entonces** devuelve las escenas que piden sus roles con el peso mínimo más exigente de cada una.
- **Dado** el catálogo entregado, **cuando** se compara su vocabulario con el de las seis plantillas portadas, **entonces** es un superconjunto: ampliar el catálogo nunca estrecha lo que el mundo tiene que saber decir.
- **Dado** el catálogo entregado, **cuando** se deriva el suelo de parajes de una celda, **entonces** sube respecto al que daban las seis, sin tocar el código del generador.
- **Dado** un rol del catálogo que declara escenas alternativas, **cuando** se construye el vocabulario, **entonces** cada alternativa cuenta como una escena distinta a cubrir.
- **Dado** cualquier escena que pida un rol de paraje del catálogo, **cuando** se busca en la taxonomía de tipos de paraje, **entonces** al menos un tipo la cubre con peso suficiente.
- **Dado** una plantilla que pide una escena que ningún tipo de paraje cubre, **cuando** se carga el catálogo, **entonces** falla nombrando la plantilla, el rol y la escena, en lugar de dejar que aparezca como hueco de taxonomía en cada celda generada.
- **Dado** el módulo del catálogo, **cuando** se inspecciona, **entonces** no importa el generador de parajes ni ningún módulo de mundo: el vocabulario sale de aquí hacia fuera y nunca al revés.

### Variar los roles, que es lo que ataca el cuello de botella

- **Dado** el catálogo, **cuando** se cuentan las plantillas que no declaran ningún rol de paraje, **entonces** son al menos un tercio del total.
- **Dado** el catálogo, **cuando** se cuentan los roles por tipo, **entonces** los cuatro tipos —servicio, núcleo, paraje y humano— están representados y ninguno se queda sin usar.
- **Dado** el catálogo, **cuando** se agrupan las plantillas por la combinación de tipos de rol que piden, **entonces** ninguna combinación reúne más de un tercio del catálogo.
- **Dado** cualquier tipo de servicio que el mundo sabe generar, **cuando** se busca en el catálogo, **entonces** al menos una plantilla lo pide.
- **Dado** cualquier tipo de núcleo, **cuando** se busca en el catálogo, **entonces** al menos una plantilla lo admite entre los suyos.
- **Dado** el catálogo, **cuando** se cuentan las plantillas que piden más de dos roles de paraje, **entonces** no pasan de un cuarto del total.

### La prueba de lazo, plantilla por plantilla

- **Dado** cualquier plantilla del catálogo, **cuando** se castea sobre la batería de mundos, **entonces** castea con lazo cerrado en al menos uno de ellos.
- **Dado** una plantilla que no cierra lazo en ningún mundo de la batería, **cuando** se revisa el catálogo, **entonces** el defecto es de la plantilla y no del mundo, y la plantilla no entra.
- **Dado** cualquier plantilla casteada, **cuando** se leen su primer y su último beat, **entonces** los dos caen a menos de medio tramo del punto de partida, sin excepciones por tamaño.
- **Dado** cualquier plantilla del catálogo, **cuando** se cuentan sus beats, **entonces** están dentro del rango del tamaño que declara.
- **Dado** cualquier plantilla del catálogo, **cuando** se lee su cadena de beats, **entonces** el primero y el último comparten rol o caen los dos en el mismo tipo de sitio del que se sale.

### Lo que declara un desenlace: rumor, mote, oro y objetos

- **Dado** cualquier plantilla, **cuando** se lee su declaración de rumor, **entonces** dice si su desenlace es notable, y la respuesta sale de la declaración y no se deduce del texto ni de la recompensa.
- **Dado** una plantilla cuyo desenlace es notable, **cuando** se lee su declaración, **entonces** trae signo del enumerado cerrado y semilla con asunto, escala y detalle, todos como hechos estructurados y ninguno como prosa.
- **Dado** el catálogo, **cuando** se cuentan las plantillas cuyo desenlace no es notable, **entonces** hay al menos dos: un mundo donde todo lo que haces se cuenta por los caminos es un mundo sin volumen.
- **Dado** una plantilla notable a la que le falta el signo o la semilla, **cuando** se carga el catálogo, **entonces** falla nombrando la plantilla y el campo que falta.
- **Dado** cualquier plantilla cuyo desenlace es notable, **cuando** se lee su mote candidato, **entonces** es la clave de un candidato declarado y nunca un texto redactado.
- **Dado** el catálogo, **cuando** se leen sus motes candidatos, **entonces** ninguna clave la comparten dos plantillas con asuntos distintos.
- **Dado** cualquier plantilla, **cuando** se lee lo que su desenlace entrega, **entonces** declara el oro como un entero no negativo, y cero es una declaración legítima.
- **Dado** cualquier objeto que un desenlace entrega, **cuando** se lee, **entonces** trae su clase del enumerado cerrado y su procedencia estructurada con desenlace, plantilla y lugar.
- **Dado** el catálogo, **cuando** se cuentan los objetos de clase llave que entrega, **entonces** hay al menos uno por cada beat del catálogo que dispara con objeto, para que ninguna llave declarada no la entregue nadie.
- **Dado** cualquier beat del catálogo que dispara con objeto, **cuando** se lee, **entonces** declara la vía alternativa que resuelve el mismo beat sin llevarlo.
- **Dado** el catálogo, **cuando** se busca un beat que solo se pueda resolver llevando un objeto, **entonces** no hay ninguno.

### Los actos que rompen y los que reparan una relación

- **Dado** cualquier plantilla, **cuando** se leen sus efectos de relación, **entonces** cada uno nombra el rol de la cara afectada y trae su signo del enumerado cerrado de dos valores.
- **Dado** un efecto de relación cuyo rol no está entre los roles de la plantilla, **cuando** se carga el catálogo, **entonces** falla nombrando el rol huérfano.
- **Dado** un efecto de relación con un signo fuera del enumerado o sin signo, **cuando** se carga el catálogo, **entonces** falla nombrando el valor recibido.
- **Dado** un efecto de relación que apunta a un rol que no es de un sitio con gente, **cuando** se carga el catálogo, **entonces** falla nombrando el rol y su tipo.
- **Dado** una plantilla que no declara ningún efecto de relación, **cuando** se termina su aventura, **entonces** no mueve ninguna relación, y eso no es un error.
- **Dado** el catálogo, **cuando** se cuentan las plantillas que declaran algún acto feo, **entonces** hay al menos tres, y cada una lo declara sobre una decisión del beat y nunca sobre no haber llegado.
- **Dado** cualquier acto feo declarado en el catálogo, **cuando** se busca la decisión que lo dispara, **entonces** es una decisión de la jugadora dentro de un beat, y no el resultado de plantarse, volverse o tardar.
- **Dado** el catálogo, **cuando** se cuentan las plantillas que declaran algún acto reparador, **entonces** hay al menos tres, para que lo roto se pueda reparar con lo que hay escrito.

### Los textos de fallback, y el desenlace de repuesto

- **Dado** cualquier plantilla, **cuando** se leen sus textos, **entonces** trae título, gancho y un texto por beat, y ninguno está vacío.
- **Dado** cualquier beat con disparador de franja, **cuando** se lee, **entonces** trae la variante de escena de llegar dentro de la franja, además del texto del beat.
- **Dado** cualquier beat con disparador de objeto, **cuando** se lee, **entonces** trae el texto de la vía alternativa además del texto del beat.
- **Dado** cualquier plantilla, **cuando** se leen sus desenlaces de repuesto, **entonces** trae dos: el de la aventura que acabó sin la jugadora y el de cerrar con lo que sí consiguió.
- **Dado** un desenlace de repuesto, **cuando** se lee, **entonces** no reprocha nada: ningún texto del catálogo comenta que la jugadora no fuese, no llegase o se volviese.
- **Dado** una aventura recorrida entera sin red, **cuando** se leen todos sus textos, **entonces** salen del catálogo y ninguno queda en blanco ni en un marcador de posición.
- **Dado** cualquier texto del catálogo, **cuando** se mide, **entonces** cabe en el tope declarado de su clase, para que quepa en la pantalla que lo pinta sin recortarse.
- **Dado** el catálogo, **cuando** se comparan sus aperturas de gancho, **entonces** no hay dos plantillas que empiecen con la misma fórmula.

### El lenguaje es inclusivo y el sesgo va hacia el femenino

- **Dado** todos los textos del catálogo, **cuando** se pasan por la lista de fórmulas de masculino genérico evitable, **entonces** ninguno coincide.
- **Dado** todos los textos del catálogo, **cuando** se buscan terminaciones en `-e` o en `-x` usadas como marca de género, **entonces** no aparece ninguna.
- **Dado** todos los textos del catálogo, **cuando** se busca un desdoblamiento del tipo «los vecinos y las vecinas», **entonces** no aparece ninguno: se reformula antes de desdoblar.
- **Dado** la voz que narra en los textos del catálogo, **cuando** se busca una marca de género en ella, **entonces** no hay ninguna.
- **Dado** un texto del catálogo que se dirige a la jugadora con una forma que concuerda, **cuando** se lee, **entonces** la forma llega como una ranura de un catálogo cerrado y no como dos textos ni como una barra.
- **Dado** una ranura de concordancia, **cuando** se resuelve, **entonces** la resuelve el paquete de idioma contra el género gramatical de la jugadora.
- **Dado** una ranura de concordancia que el paquete de idioma no conoce, **cuando** se resuelve, **entonces** falla nombrando la ranura y el idioma, en lugar de dejar el marcador en el texto.
- **Dado** un texto con ranuras y sin género gramatical inyectado, **cuando** se resuelve, **entonces** sale en femenino, que es el valor con el que llega la creación de personaje.
- **Dado** el catálogo entero, **cuando** se cuentan las caras a las que sus roles humanos apuntan por puesto, **entonces** ningún puesto queda escrito siempre del mismo género en los textos.
- **Dado** la lista de fórmulas de masculino genérico, **cuando** se lee, **entonces** vive en el paquete de idioma y no dentro del catálogo, porque el mismo filtro lo usará después el texto generado.

### Ningún texto depende de un número que solo existe en la maqueta

- **Dado** todos los textos del catálogo, **cuando** se generan diez mundos distintos, **entonces** ningún texto se vuelve falso en ninguno de ellos.
- **Dado** todos los textos del catálogo, **cuando** se busca una cifra de distancia, de tiempo de esfuerzo, de ritmo o de progreso, **entonces** no aparece ninguna.
- **Dado** todos los textos del catálogo, **cuando** se busca una cantidad de elementos del mundo —cuántos núcleos, cuántas calzadas, cuántos parajes—, **entonces** no aparece ninguna.
- **Dado** un texto del catálogo que nombra una cantidad de oro, **cuando** se lee, **entonces** la cantidad la pone el desenlace en tiempo de ejecución y no está escrita dentro del texto.
- **Dado** un texto del catálogo con una cifra escrita a mano que no es de oro, **cuando** se carga el catálogo, **entonces** falla nombrando la plantilla y el texto.
- **Dado** el tamaño declarado de una plantilla, **cuando** se lee en un texto, **entonces** aparece con su palabra del mundo —paseo, aventura, jornada— y nunca con minutos ni con kilómetros.

### El chiste nunca es a costa del sitio real, en la mitad que se puede afirmar

- **Dado** todos los textos del catálogo, **cuando** se busca el nombre de un anclaje real, una marca, una cadena o una categoría de OpenStreetMap, **entonces** no aparece ninguno.
- **Dado** todos los textos del catálogo, **cuando** se busca una referencia a un tipo de negocio contemporáneo por su nombre de hoy, **entonces** no aparece ninguna: el mundo se nombra en su propio registro.
- **Dado** un texto del catálogo que nombra un lugar, **cuando** se lee, **entonces** lo nombra por el rol de la plantilla o por el nombre de ficción que produce el paquete de idioma.
- **Dado** el catálogo, **cuando** se revisa a mano una plantilla por una, **entonces** en ninguna el humor se dirige al negocio, al barrio ni a sus dueños, y en todas el desajuste entre la ficción y el sitio es lo que hace la gracia.
- **Dado** los desenlaces del catálogo, **cuando** se revisan a mano, **entonces** los hechos siguen importando y los personajes se toman en serio a sí mismos.
- **Dado** la revisión a mano del catálogo, **cuando** se termina, **entonces** queda anotada con una fila por plantilla, y una plantilla sin revisar no entra.

### Determinismo y estabilidad del catálogo

- **Dado** el catálogo, **cuando** se recorre para castear, **entonces** el orden es el declarado en la lista y no el de ninguna estructura con orden de inserción.
- **Dado** un mundo sembrado con `"42.40,-8.81#1"`, **cuando** se castea el catálogo dos veces, **entonces** las dos veces salen las mismas plantillas con el mismo reparto.
- **Dado** una plantilla nueva añadida al final del catálogo, **cuando** se castea, **entonces** el reparto de todas las demás no cambia.
- **Dado** el catálogo entregado en distinto orden, **cuando** se castea, **entonces** cada plantilla obtiene el mismo reparto.
- **Dado** el catálogo, **cuando** se inspecciona, **entonces** no usa ninguna fuente de azar ni de tiempo del sistema: es datos y validación, y el azar es de quien castea.
- **Dado** un mundo ya generado, **cuando** se amplía el catálogo, **entonces** el documento de cada celda sigue idéntico byte a byte: lo generado no se resiembra.
- **Dado** una partida guardada con una aventura de una plantilla, **cuando** se amplía el catálogo y se vuelve a abrir, **entonces** la aventura sigue siendo la misma y no se recastea.

### Entradas inválidas, estado vacío y errores

- **Dado** el catálogo filtrado por cualquier oficio, **cuando** se lee, **entonces** nunca está vacío.
- **Dado** un filtro con un oficio que no está en el enumerado, **cuando** se aplica, **entonces** falla nombrando el oficio recibido y enumerando los válidos, en lugar de devolver el catálogo entero.
- **Dado** un filtro sin oficio, **cuando** se aplica, **entonces** falla nombrando la dependencia que falta, en lugar de suponer uno.
- **Dado** un mundo que no castea ninguna plantilla de ningún oficio, **cuando** se pide el resultado, **entonces** cada plantilla trae su motivo y ninguna queda fuera de la lista.
- **Dado** una plantilla con un identificador repetido, **cuando** se carga el catálogo, **entonces** falla nombrando el identificador.
- **Dado** una plantilla con un texto vacío en cualquiera de sus campos obligatorios, **cuando** se carga el catálogo, **entonces** falla nombrando la plantilla y el campo.
- **Dado** el catálogo por debajo de 24 plantillas o por encima de 30, **cuando** se carga, **entonces** falla nombrando el número que hay y el rango declarado.
- **Dado** un oficio sin ninguna plantilla exclusiva, **cuando** se carga el catálogo, **entonces** falla nombrando el oficio, porque sin exclusivas el oficio deja de filtrar y solo cambia la voz.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/quests/templates.js` | el catálogo: las 24-30 plantillas con todas sus declaraciones y sus textos |
| `packages/nucleo/quests/oficios.js` | el enumerado cerrado de oficios, la afinidad declarada, el filtro y la medida de cobertura por oficio |
| `packages/nucleo/quests/catalogo.js` | la comprobación del catálogo al cargarse, el vocabulario de escenas que sale hacia la tubería y las consultas agregadas |
| `packages/nucleo/names/lenguaje.js` | las reglas verificables de lenguaje por idioma: fórmulas de masculino genérico, morfología prohibida, cifras y el catálogo cerrado de ranuras de concordancia |

`packages/nucleo/quests/aventura.js` ya tiene `validaPlantilla` y no se reescribe: las declaraciones nuevas se validan **además** de lo que ya comprueba, y la carga del catálogo la llama plantilla por plantilla.

### La frontera de inyección

Tres puntos, y ninguno se lee de un almacén:

- **El oficio de la jugadora**, de la fila 27. Entra al filtro como parámetro. El catálogo no sabe quién juega y no consulta la partida.
- **El género gramatical de la jugadora**, también de la fila 27, para resolver las ranuras de concordancia. Sin él, femenino, que es como llega la creación de personaje.
- **El paquete de idioma del mundo**, que resuelve las ranuras y aporta la lista de fórmulas. Es el mismo `namesFor` que ya usa todo lo demás.

Hacia fuera entrega cuatro cosas: **el catálogo** que castea SPEC-010, **el vocabulario de escenas** que consume la tubería para SPEC-006, **las declaraciones** que consumen SPEC-012 (rumor), SPEC-014 (efectos de relación) y SPEC-015 (oro, objetos, mote), y **la medida de cobertura por oficio** que imprime el informe.

Esa última importa por una razón de propiedad: `.claude/rules/naming.md` dice que `test/**` lo escribe solo `wa-qa-dev`, así que **la medida vive en el paquete como función pura** y `test/casting-report.mjs` solo la imprime. Sin eso, exigir el suelo por oficio como criterio obligaría al implementador a tocar un directorio que no es suyo.

### La relación con SPEC-006, declarada al revés

SPEC-006 dejó escrita la dependencia circular y la resolvió inyectando: el generador de parajes **recibe** el vocabulario y no conoce al catálogo. Esta spec cierra el otro lado — el catálogo es quien lo produce — y con eso la propiedad viva que `parajes.md` pide se enciende de verdad: **al ensanchar el catálogo, el suelo de parajes sube solo**, sin tocar el generador y sin escribir un número a mano en ningún sitio.

De ahí sale la tensión que gobierna cómo se escriben las plantillas nuevas, y conviene tenerla delante: cada escena de paraje nueva sube el suelo (bueno para la cobertura) y a la vez añade un requisito que el barrio pequeño puede no cumplir (malo para la casteabilidad). Los fallos medidos dicen todos lo mismo —*sin candidatos para X: un paraje con escena Y*—, así que la manera de crecer sin empeorar el caso pequeño es **variar los roles hacia lo que un barrio sí tiene**: servicios, núcleos y caras. De ahí los criterios de un tercio del catálogo sin ningún paraje y de un cuarto como techo de las que piden más de dos.

### Los cuatro oficios, que son un parámetro con valor por defecto

`personaje.md` pendiente 4 dice que **la lista exacta de oficios no está decidida**, pero sí su criterio: tres o cuatro, y salen de los servicios que el mundo ya sabe generar, «para que siempre exista un sitio donde te reconozcan». Esta spec no lo cierra: lo trata como parámetro con un valor por defecto justificado y con el enumerado en un sitio único, de modo que cambiarlo sea cambiar una lista y las afinidades que la citan.

El valor por defecto son cuatro claves, una por servicio ancla: `taberna`, `botica`, `forja` y `mercado`. Son claves sin género, como las de puesto: la palabra con la que se dice cada una la pone el paquete de idioma y concuerda con el género gramatical de la jugadora. El escenario «El oficio filtra el catálogo» de `docs/testing.md` habla de una jugadora con oficio «buhonera»: esa es la forma en femenino del oficio `mercado` en el paquete castellano, y es un ejemplo de por qué la clave y la palabra tienen que estar separadas.

Con cuatro oficios, 30 plantillas y una media de 1,5 afinidades, cada oficio ve del orden de once plantillas. Ese es el número del que sale el suelo de «diez esqueletos jugables en un barrio de tres calles» de `personaje.md` §3, y es también la razón de que la media esté acotada por arriba y por abajo: por debajo de 1,5 el catálogo por oficio se queda corto, y por encima de 2 el oficio deja de filtrar.

### Lo que consume de otras specs y no respecifica

- **SPEC-010** define qué es una plantilla que castea, el catálogo cerrado de motivos, el presupuesto por tamaño, el medio tramo del lazo y la obligación de que un beat `con_objeto` declare vía alternativa. Aquí se escriben plantillas que cumplen ese contrato; no se toca el motor.
- **SPEC-012** define la declaración de rumor —`notable`, `signo`, `semilla` con asunto, escala y detalle— y ya la valida al nacer un rumor. Esta spec la extiende a todas las plantillas y no cambia su forma.
- **SPEC-014** define la escalera de relación, los dos signos de acto y la cicatriz, y dice explícitamente que **la taxonomía de actos llega declarada por la plantilla**. Aquí llega. Lo que esta spec declara son actos concretos por plantilla, no una taxonomía general: el pendiente 2 de `npcs.md` sigue abierto y se cierra el día que haya bastantes actos escritos para verles la forma.
- **SPEC-015** define las dos clases de objeto, la procedencia estructurada de tres campos, el mote candidato como clave y el oro como entero. Aquí se declaran los valores; el mecanismo es suyo.
- **SPEC-006** recibe el vocabulario inyectado. Esta spec es su productor y no la reabre.
- **SPEC-013** siembra el prólogo con un catálogo cerrado de sucesos propio, que no son plantillas y no pasan por aquí.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Ninguno se implementa aquí —son de `wa-qa-dev`—, y **no se duplican**: la batería se escribió antes que el código y esta spec la referencia por su nombre literal.

De **«El lenguaje es inclusivo y el sesgo va hacia el femenino»** (`@nucleo @lenguaje`, fuente `lenguaje.md`), que es la característica propia de esta spec:

- «No se usa masculino genérico en fórmulas frecuentes»
- «No se usa morfología inventada»
- «Ningún texto depende de un número que solo existe en la maqueta»

De **«El tono y la prosa, que no se pueden afirmar con una aserción»** (`@manual @lenguaje`), que es la mitad que va a mano y que esta spec convierte en una revisión con una fila por plantilla:

- «El chiste nunca es a costa del sitio real ni de quien lo regenta»
- «El humor vive en cómo se cuenta, no en lo que pasa»

De **«Una quest se castea contra el mundo o no se ofrece»** (`@nucleo @casting`), el escenario que SPEC-010 dejó explícitamente fuera y que aquí se cierra, más los que el catálogo tiene que seguir sosteniendo:

- «El oficio filtra el catálogo»
- «Todo lazo casteado se cierra», por su lado de plantilla: la prueba de lazo se exige una a una y el precedente es «tres pistas»
- «El presupuesto de beats sale del tamaño declarado», por el lado de que cada plantilla declara el suyo y lo cumple
- «Una plantilla sin candidatos no se ofrece», que aquí se mide agregada por oficio

De **«El telón se echa solo al cerrarse la salida»**, la mitad que es declaración de plantilla:

- «El cierre en corto ocupa el sitio del desenlace», por el desenlace de repuesto que lo ocupa
- «El rumor solo aparece si el desenlace era notable», por las plantillas no notables que hacen que el caso exista

De **«El personaje se elige una vez y el oficio no se cambia»**: «El mote nace del rumor y es por núcleo», por el candidato que cada plantilla declara.

De **«Los objetos son llaves, no requisitos»**: «Sin el objeto hay otro camino al mismo beat», por la vía alternativa que cada beat `con_objeto` del catálogo declara.

De **«El mundo de una celda es jugable por construcción»**: «El suelo de parajes cubre el vocabulario de escenas» y «El mundo mínimo todavía compone un lazo», que esta spec puede romper por el lado del catálogo si crece pidiendo escenas de paraje sin medida.

### Huecos de cobertura y riesgos medidos

Se anotan porque son de la batería o del terreno, no de esta spec, y ninguno se resuelve inventando un escenario aquí:

1. **El suelo de diez por oficio no está medido y el punto de partida es malo.** Hoy `barrio-tres-calles` castea 1/6 y `suelo-250m` 2/6 (`pipeline/decisiones-orquestador.md` §6g), y la casteabilidad global va por 30/48 (§6m). La cuenta de `personaje.md` §3 asumía tasas del 77-82% en el caso pequeño, que son las del prototipo antiguo y no las de hoy. El criterio se exige tal como lo fija el diseño, porque la palanca existe —escribir el catálogo variando los roles hacia lo que un barrio sí tiene—, pero si al medir no se alcanza, la corrección es del diseño (`personaje.md` §3) y no del test, con el precedente de §6m: un criterio se rebaja cuando deja de mentir, no cuando incomoda.
2. **La lista de fórmulas de masculino genérico es pendiente 2 de `lenguaje.md`.** Aquí se exige que exista y que viva en el paquete de idioma; qué fórmulas entran y cuáles son falsos positivos no está decidido y esta spec no lo cierra.
3. **La lista exacta de oficios es pendiente 4 de `personaje.md`.** Se trata como parámetro; si el diseño cierra otra lista, cambian el enumerado y las afinidades, no el mecanismo.
4. **El día que no castea ninguna aventura del oficio** es pendiente 1 de `personaje.md` y sigue sin ratificar. Esta spec exige que el filtro por oficio nunca dé una lista vacía de plantillas, que es cosa distinta: que ninguna castee en un mundo concreto es posible y lo resuelve quien ofrece (fila 28, con el estirón de RF-QUEST-012).
5. **La taxonomía de actos que rompen una relación** es pendiente 2 de `npcs.md`. Aquí se declaran actos concretos por plantilla, no la taxonomía; declarar la general con ocho actos escritos habría sido inventar producto.
6. **Nada en la batería afirma el desenlace de repuesto por el lado del catálogo.** «El cierre en corto ocupa el sitio del desenlace» es `@app` y de la fila 36; que cada plantilla declare dos textos de repuesto y que ninguno reproche nada no tiene escenario.
7. **Nada en la batería afirma las ranuras de concordancia.** Es el mecanismo por el que «el género gramatical es dato vivo» llega a los textos escritos a mano, y el escenario más cercano —«El personaje llega en femenino»— es de la pantalla de creación.
8. **Nada afirma que el vocabulario del catálogo nuevo sea superconjunto del viejo.** «El suelo de parajes cubre el vocabulario de escenas» comprueba la aritmética, no que ampliar el catálogo no pueda estrecharlo por descuido.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y coherencia con SPEC-001 a SPEC-016.
- **Sin bloque de UX Design y sin comportamiento responsive** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`, y porque esta spec no tiene interfaz: las pantallas son de las filas 28, 34, 36 y 38.
- **El catálogo entrega entre 24 y 30 plantillas, con 30 como objetivo** → asumido (alternativa: quedarse en 20, el suelo de RF-QUEST-009). Regla: `personaje.md` §3 hace su cuenta con treinta, y con cuatro oficios y afinidad ×1,5 por debajo de veintisiete ningún oficio llega a diez esqueletos ni con casteo perfecto; el rango se declara para que el número exacto sea del implementador y no un dogma.
- **Cuatro oficios, con claves `taberna`, `botica`, `forja` y `mercado`** → asumido (alternativa: tres, o nombres de oficio en vez de nombres de servicio). Regla: `personaje.md` §3, «salen de los servicios que el mundo ya sabe generar (taberna, botica, forja, mercado)» y «tres o cuatro, no diez»; cuatro es lo que hace que la afinidad ×1,5 dé once plantillas por oficio. Es pendiente 4 del documento y por eso va en un enumerado único y citado, no repartido.
- **La clave del oficio no lleva género y la palabra la pone el paquete de idioma** → asumido (alternativa: usar «buhonera» como clave, que es lo que dice literalmente el escenario de la batería). Regla: `lenguaje.md` y el precedente de `puestos.js` —las claves de puesto no llevan género, y la forma gendered pega el estereotipo a la clave—; y el género gramatical de la jugadora es dato vivo que hace concordar cada frase, así que la palabra tiene que resolverse, no estar escrita.
- **La media de afinidades por plantilla se acota entre 1,5 y 2** → asumido (alternativa: solo fijar el mínimo). Regla: `personaje.md` §3 fija el ×1,5 y dice que el filtro tiene que conservar los dientes; sin tope por arriba, un catálogo donde casi todo vale para casi todos cumple la media y no filtra nada, que es la contradicción que el documento pide no volver a cometer.
- **Al menos una plantilla exclusiva por oficio, y no más de un tercio de exclusivas** → asumido (alternativa: dejar «unas pocas» sin número). Regla: `personaje.md` §3, las exclusivas son «las que hacen que elegir oficio signifique algo»; el tercio por arriba es lo que impide que cada oficio acabe con su rincón privado y el catálogo compartido se vacíe.
- **El suelo de diez esqueletos por oficio se exige sobre `barrio-tres-calles`** → asumido (alternativa: exigirlo sobre el mundo mediano, que es donde se cumple sin esfuerzo). Regla: `personaje.md` §3 lo dice sobre «un barrio de tres calles», y `pipeline/decisiones-orquestador.md` §6o: un criterio que se cumple casi siempre no es un criterio. El riesgo de que hoy no se alcance queda declarado en el hueco 1.
- **Al menos un tercio del catálogo no pide ningún rol de paraje** → asumido (alternativa: no acotarlo y confiar en que las plantillas nuevas varíen). Regla: `personaje.md` §3, «el cuello de botella de fondo no es el catálogo, es el barrio», y los fallos medidos son todos de escena de paraje; sin este número, «variar los roles» es una intención y no una comprobación.
- **Al menos dos plantillas con desenlace no notable** → asumido (alternativa: dejarlo en la única que hay hoy, `peregrinaje`). Regla: el comentario del prototipo lo dice —existe para que «el rumor solo aparece si el desenlace era notable» tenga un caso vivo—; con una sola, retirarla del catálogo deja el escenario sin caso y nadie se entera.
- **El desenlace de repuesto son dos textos por plantilla, y cuál se usa lo decide quien echa el telón** → asumido (alternativa: uno solo que valga desde cualquier beat, o uno por beat). Regla: `bucle-jugable.md` §4 describe dos salidas —«cómo acabó sin él» o «cerrando con lo que sí consiguió»— y son dos textos distintos; uno solo mentiría en la mitad de los cortes y uno por beat serían ciento cincuenta textos para una diferencia que el jugador no percibe.
- **Los actos de relación se declaran por plantilla, sobre decisiones de beat, y nunca sobre no haber llegado** → asumido (alternativa: declarar una taxonomía general de actos feos). Regla: `npcs.md` pendiente 2 sigue abierto y SPEC-014 dice explícitamente que la taxonomía no se inventa en una spec; y `quests.md` decisión 4 prohíbe penalizar la ausencia, así que un acto feo que se dispare por plantarse sería reprochar por la puerta de atrás.
- **Las formas que concuerdan con el género de la jugadora van como ranuras de un catálogo cerrado** → asumido (alternativa: dos textos por plantilla, o una barra tipo «forastero/a»). Regla: `personaje.md` §1, el género gramatical es dato vivo y el código bifurca por él; duplicar los textos duplica el catálogo entero y la barra es ilegible en voz alta, que es la restricción que `lenguaje.md` pone por encima de todo.
- **Sin género gramatical inyectado, las ranuras se resuelven en femenino** → asumido (alternativa: fallar, como falla el vocabulario sin inyectar en SPEC-006). Regla: `lenguaje.md`, «quien no toque nada juega en femenino», y el femenino no es un default silencioso que enmascare un olvido: es la decisión declarada del proyecto.
- **La lista de fórmulas de masculino genérico vive en el paquete de idioma** → asumido (alternativa: dentro del catálogo, junto a los textos que valida). Regla: `lenguaje.md` dice que el mismo filtro lo usará después el texto del LLM (fila 18), y las fórmulas son propias de cada lengua; ponerlas en el catálogo obligaría a la fila 18 a importarlo.
- **El catálogo se comprueba entero al cargarse y falla nombrando plantilla y campo** → asumido (alternativa: validar en el primer casteo que use cada plantilla). Regla: precedente de `relacion.js` y `efectos.js`, que ya se comprueban a sí mismos al cargarse; con validación perezosa una plantilla mal declarada aparece meses después, en el mundo de alguien y no en la batería.
- **Una cifra escrita a mano en un texto hace fallar la carga del catálogo** → asumido (alternativa: dejarlo en revisión humana, que es donde `lenguaje.md` lo pone). Regla: RF-LANG-003 es Must y el caso que lo destapó —«hoy solo son dos nombres en un mapa»— pasó una revisión humana sin que nadie lo viera; el oro queda fuera porque su cifra la pone el desenlace en ejecución y nunca está dentro del texto.
- **Los textos no nombran anclajes reales, marcas ni categorías de OSM, y eso se comprueba** → asumido como la mitad automatizable de RF-LANG-004 (alternativa: dejar la regla entera a la revisión `@manual`). Regla: `bucle-jugable.md` §6, el chiste nunca a costa del sitio real; si el texto no puede nombrar el sitio, la mitad fea del riesgo desaparece sin depender de que alguien lo lea. La otra mitad —si tiene gracia y a costa de qué— sigue siendo `@manual` porque no hay aserción que la capture.
- **La medida de cobertura por oficio es una función del paquete y no del informe** → asumido (alternativa: calcularla dentro de `test/casting-report.mjs`). Regla: `.claude/rules/naming.md`, `test/**` lo escribe solo `wa-qa-dev`; y el precedente de SPEC-010, donde el motivo pasó a ser dato estructurado precisamente para que el informe midiera en vez de leer.
- **El filtro por oficio devuelve plantillas y no castea** → asumido (alternativa: filtrar dentro del casting, pasándole el oficio). Regla: SPEC-010 ya lo decidió al revés —«la afinidad de oficio se aplica antes de llamar al casting»— y esta spec no reabre una spec cerrada.
- **Las seis plantillas portadas se reescriben en cómico-cálido y conservan su identificador** → asumido (alternativa: retirarlas y escribir treinta nuevas). Regla: `bucle-jugable.md` §6 declara la deuda —«se quedan fuera de tono, hay que reescribirlos»— y sus identificadores ya viven en partidas y en el informe; cambiarlos sería una migración gratuita.
