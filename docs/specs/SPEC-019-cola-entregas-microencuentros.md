# SPEC-019 — La cola de entregas y los micro-encuentros: lo que el mundo te debe

## Descripción

El mundo de Walking Adventure produce cosas mientras la jugadora anda: un rumor que llega a un sitio, un hallazgo, un encargo de un momento. Esta spec entrega **la cola de entregas** —dónde se guarda lo que el mundo ha producido y todavía no ha llegado a la jugadora— y **los micro-encuentros**, la escena de un beat que salta en ruta para vaciarla. Es la fila que responde a la pregunta que el motor de pasos deja abierta: un paso produce algo, ¿y luego qué.

La cola tiene dos tipos de entrada y no se comportan igual. Las **noticias** son informativas: sedimentan de inmediato en lo que se cuenta en el núcleo y siguen consultables; nunca esperan a nadie ni ocupan sitio en la cola. Las **oportunidades** —un hallazgo, una entrega rápida, un encargo de un beat— sí esperan, y se ofrecen **dos veces**: la segunda en otra salida y en otro sitio. Dos, y no una, porque una sola es frágil —basta un semáforo, una conversación de verdad o el móvil en el bolsillo—; dos, y no infinitas, porque a la tercera es un incordio. Si tampoco se atiende la segunda, **sedimenta**, y sedimentar no cuesta nada: ni rango, ni relación, ni una oferta menos mañana, ni una frase que lo mencione.

Tres reglas acotan el micro-encuentro y las tres son de producto, no de implementación: **solo salta si hay algo pendiente de entregar** —sin producción del mundo no hay encuentro, jamás relleno aleatorio—, **coste cero de desvío** —ocurre en el camino, nunca manda fuera del lazo ni toca el presupuesto de la aventura— y **nunca durante un beat**, que es la regla que protege la escena que la jugadora está viviendo. Su lugar no se puede resolver al castear como el de una quest: se resuelve **en marcha**, contra el primer sitio apto por el que ella pase.

Y esta fila cierra un cabo que lleva abierto desde SPEC-013: **el prólogo deja la cola sembrada y hasta hoy no la consumía nadie**. La consume esta. El precalentamiento no es adorno — `personaje.md` §3 le pide algo concreto y medible: que un día sin aventura del oficio propio no sea un día vacío, porque en la lista de hoy hay al menos un recado suelto que no depende del oficio (**RF-QUEST-016**).

No tiene interfaz de usuario propia. La lista de `A2P3` donde aparece el recado suelto es de la fila 28 y el aviso en marcha con su notificación y su háptico es de la fila 29; aquí se entrega lo que esas dos pantallas consultan.

Anclas: **RF-QUEST-010** y **RF-QUEST-016** (`docs/prd.md` §4.2), este último marcado **⚠ sin escenario**, con `game-design/quests.md` **decisión 3** y `game-design/personaje.md` **§3** como fuentes que mandan sobre el PRD, y `game-design/quests.md` §2 («beats de lugar diferido») y el pendiente 3 de §7 para lo que quedaba abierto. **RNF-DET-001** y **RNF-DET-003** aplican como invariante bloqueante. Se apoya en SPEC-003 (semillas de fase), SPEC-004 (el tramo y los tamaños de salida), SPEC-006 (las escenas de paraje y sus afinidades, que son el vocabulario con el que se resuelve un lugar diferido), SPEC-009 (el mundo congelado y el área `partida/`), SPEC-010 (la aventura casteada, sus beats y su presupuesto, que aquí se leen y no se tocan), SPEC-011 (el contador, el azar por paso, el catálogo cerrado de efectos aditivos y el registro de productores), SPEC-012 (lo que sedimenta en cada núcleo), SPEC-013 (la cola sembrada por el prólogo), SPEC-014 (la relación con las caras, que aquí solo se comprueba que no se mueve), SPEC-015 (el rango y el oro, ídem) y SPEC-016 (el registro de hechos y el diario). **De todas ellas esta spec es consumidora, no autora**: ninguna de sus decisiones se reabre.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la toca, y de tres maneras**: se registra un segundo productor de paso en el motor de SPEC-011; entran el trazado vigente de la salida y las llegadas a geofence de la fila 32; y entra el estado del beat en curso de la fila 34. Están descritas en «Frontera de inyección».
- **Fuera de alcance, y son nueve cosas que parecerían naturales aquí:** el **motor de pasos**, su contador, su azar y su catálogo de efectos (fila 11), que esta spec **consume ya resueltos**; la **propagación del rumor** por el árbol de calzadas, su nivel y lo que sedimenta en cada núcleo (fila 12), de la que aquí solo se recibe el aviso de que algo llegó; el **prólogo** y cómo siembra la cola (fila 13), de la que aquí solo se consume el resultado; el **catálogo de plantillas** y el catálogo de escenas de un beat con sus textos (fila 17); la **redacción** de cualquier texto —del encargo, de la tarjeta, de la notificación— y el contrato con el narrador (fila 18); la **lista de hoy** de `A2P3`, su tope de tres, su orden y cómo se pinta la tarjeta del recado (fila 28); el **aviso en marcha** de dos capas, la notificación, el háptico y la marca en el mapa (fila 29, RF-BUCLE-004/009); la **llegada al geofence** y la mecánica de la parada (fila 32) y la **escena del beat** con su pantalla y su botón (filas 33 y 34); y el **telón** con su cierre en corto (fila 36). Esta spec entrega **qué debe el mundo, a quién se le ofrece, cuándo y cuántas veces**, y nada más.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La cola y sus dos tipos», «Cuándo salta un micro-encuentro», «El lugar diferido se resuelve en marcha» y «El recado suelto comparte lista»; la **validación de entradas** en la entrada de tipo desconocido, el sitio ofrecido que no existe en el mapa, la entrada sin escena declarada y el efecto fuera del catálogo de SPEC-011; el **estado vacío** en la cola sin ninguna oportunidad pendiente, la salida sin ningún sitio apto en el trazado, la lista de hoy sin ninguna aventura casteada y el mapa recién creado sin prólogo; el **estado de error** en la salida sin trazado vigente, el beat en curso que nunca cierra, la entrada que se intenta ofrecer una tercera vez y la que se intenta atender ya sedimentada; y los **casos límite** en la segunda oferta que cae en el mismo sitio que la primera, el micro-encuentro que se cruza con el comienzo de un beat, la salida en la que se completa la cola entera, la oportunidad ofrecida en la última salida antes de que la partida se guarde y el mundo que solo ha producido noticias.

«Mundo congelado X» sigue significando el fixture `test/fixtures/osm/X/` de SPEC-001. **«Entrega»** es cualquier cosa que el mundo debe a la jugadora, de los dos tipos; **«oportunidad»** es la entrega que espera; **«noticia»** la que no. **«Oferta»** es una presentación de una oportunidad con lugar resuelto —el aviso de un micro-encuentro, o un recado suelto aceptado que la salida cierra sin atender—, y es la unidad que se cuenta hasta dos. **«Sitio apto»** es una localización del mundo cuyas afinidades de escena admiten la escena que la entrada declara.

### La cola y sus dos tipos

- **Dado** un mapa recién creado sin prólogo corrido, **cuando** se lee la cola de entregas, **entonces** está vacía y no falla.
- **Dado** un paso del mundo que produce una entrega, **cuando** se lee la cola, **entonces** contiene una entrada con su tipo, su procedencia y su escena declarada.
- **Dado** una entrada de la cola, **cuando** se lee su procedencia, **entonces** nombra el mapa y el número del paso que la produjo.
- **Dado** el enumerado de tipos de entrega, **cuando** se enumera, **entonces** tiene exactamente dos valores: noticia y oportunidad.
- **Dado** una entrada con un tipo que no está en el enumerado, **cuando** se intenta encolar, **entonces** falla nombrando el tipo recibido y enumerando los dos válidos.
- **Dado** una entrada de oportunidad sin escena declarada, **cuando** se intenta encolar, **entonces** falla nombrando la entrada, en lugar de suponer una escena.
- **Dado** una oportunidad encolada, **cuando** se lee su estado, **entonces** es «pendiente», con cero ofertas registradas.
- **Dado** la cola, **cuando** se consulta lo pendiente, **entonces** devuelve solo oportunidades, y en un orden estable que no depende de la iteración sobre ningún `Set` ni `Map`.
- **Dado** una cola con varias oportunidades pendientes, **cuando** se consulta dos veces desde el mismo estado, **entonces** el orden es idéntico.
- **Dado** el productor de paso de esta spec, **cuando** produce una entrega, **entonces** el efecto que devuelve es de un tipo del catálogo cerrado de SPEC-011 y añade: no resta oro, no baja ningún rango y no retira nada.
- **Dado** el productor de paso, **cuando** devuelve un efecto de un tipo que no está en el catálogo de SPEC-011, **entonces** el paso falla nombrando el tipo, y la cola no cambia.
- **Dado** un paso ejecutado en el que el mundo no produce nada, **cuando** se invoca este productor, **entonces** no encola nada y no falla.
- **Dado** la cola de entregas, **cuando** se busca dónde se guarda, **entonces** viaja con la partida y nunca dentro del documento congelado de ninguna celda.
- **Dado** una cola con oportunidades pendientes y ofertas registradas, **cuando** se serializa la partida y se vuelve a cargar, **entonces** vuelven las mismas entradas, con el mismo estado, las mismas ofertas y el mismo orden.

### Las noticias sedimentan de inmediato

- **Dado** un paso que produce una noticia, **cuando** termina ese mismo paso, **entonces** la noticia ya está sedimentada.
- **Dado** una noticia sedimentada, **cuando** se consulta lo pendiente de la cola, **entonces** no aparece.
- **Dado** una noticia sedimentada, **cuando** se consulta lo que se cuenta en su núcleo, **entonces** sigue disponible.
- **Dado** un mapa en el que el mundo ha producido cincuenta noticias y ninguna oportunidad, **cuando** se consulta lo pendiente, **entonces** está vacío.
- **Dado** una noticia, **cuando** se buscan sus ofertas registradas, **entonces** no tiene ninguna y no puede tenerla: el ciclo de dos ofertas no le aplica.
- **Dado** una noticia, **cuando** se intenta ofrecer como micro-encuentro, **entonces** falla nombrando el tipo, en lugar de ofrecerla.
- **Dado** una jugadora que no abre la app en un mes y luego anda, **cuando** se leen las noticias que el mundo produjo, **entonces** están todas sedimentadas y consultables, sin ninguna caducada.

### Cuándo salta un micro-encuentro

- **Dado** una salida abierta y la cola sin ninguna oportunidad pendiente, **cuando** la jugadora anda una salida entera, **entonces** no salta ningún micro-encuentro.
- **Dado** una salida abierta y una oportunidad pendiente, **cuando** la jugadora atraviesa un sitio apto, **entonces** salta un micro-encuentro con esa oportunidad.
- **Dado** un mundo cuyo motor de pasos no ha producido nada, **cuando** la jugadora anda tres salidas, **entonces** no salta ni un micro-encuentro y no se inventa ninguno.
- **Dado** la implementación del disparo, **cuando** se inspecciona, **entonces** no existe ninguna vía por la que un micro-encuentro nazca sin una entrada de la cola detrás.
- **Dado** un micro-encuentro ya saltado en el paso del mundo en curso, **cuando** la jugadora atraviesa otro sitio apto dentro del mismo paso, **entonces** no salta un segundo micro-encuentro.
- **Dado** el mismo caso, **cuando** el mundo avanza un paso más y ella atraviesa otro sitio apto, **entonces** sí puede saltar el siguiente.
- **Dado** una salida en la que la jugadora completa la cola entera, **cuando** se consulta lo pendiente al cerrar, **entonces** está vacío y no ha saltado más de un micro-encuentro por paso del mundo.
- **Dado** una oportunidad ya ofrecida en esta salida, **cuando** la jugadora atraviesa otro sitio apto en la misma salida, **entonces** esa misma oportunidad no se vuelve a ofrecer.
- **Dado** un micro-encuentro disponible, **cuando** se lee lo que entrega hacia fuera, **entonces** entrega el sitio y la escena, y ni un texto destinado a mostrarse: la notificación y su redacción son de las filas 29 y 18.
- **Dado** un micro-encuentro atendido, **cuando** se lee el estado de su entrada, **entonces** es «atendida» y no vuelve a ofrecerse nunca.
- **Dado** un micro-encuentro atendido, **cuando** se consulta lo pendiente, **entonces** esa entrada ya no está.

### El lugar diferido se resuelve en marcha

- **Dado** una oportunidad pendiente, **cuando** se lee su entrada recién encolada, **entonces** no tiene lugar: declara una escena, no un sitio.
- **Dado** una oportunidad y una salida en marcha, **cuando** la jugadora atraviesa el primer sitio apto del trazado, **entonces** el lugar de la entrada se resuelve contra ese sitio y no contra ninguno posterior.
- **Dado** un sitio cuyas afinidades de escena no admiten la escena declarada, **cuando** la jugadora lo atraviesa, **entonces** ese sitio no resuelve el lugar.
- **Dado** una salida cuyo trazado no contiene ningún sitio apto, **cuando** la jugadora la completa entera, **entonces** no salta ningún micro-encuentro y la oportunidad sigue pendiente, con las mismas ofertas que tenía.
- **Dado** una oportunidad que resuelve lugar, **cuando** se lee el sitio resuelto, **entonces** es una localización del mundo con nombre y anclaje, nunca una coordenada suelta.
- **Dado** una oferta que se ofrece contra un sitio que no existe en el mapa, **cuando** se registra, **entonces** falla nombrando el sitio, en lugar de registrarla.
- **Dado** el contenido de una oportunidad, **cuando** se compara entre dos ejecuciones que la resuelven en sitios distintos, **entonces** es idéntico: lo que depende de por dónde pase la jugadora es dónde se entrega, nunca qué se entrega.
- **Dado** el mismo mapa, la misma semilla y la misma secuencia de pasos, **cuando** se ejecutan dos veces desde cero, **entonces** las entradas producidas, su tipo, su escena y su orden son idénticos.
- **Dado** una salida sin ninguna aventura aceptada, **cuando** la jugadora atraviesa un sitio apto, **entonces** el micro-encuentro puede saltar igual: no hace falta un lazo para que el mundo te deba algo.
- **Dado** una salida sin trazado vigente y sin llegada declarada, **cuando** se intenta resolver un lugar diferido, **entonces** falla nombrando lo que falta, en lugar de elegir un sitio cualquiera del mapa.

### Coste cero de desvío

- **Dado** una aventura aceptada con su cadena de beats, **cuando** salta y se atiende un micro-encuentro, **entonces** la cadena de beats de la aventura es la misma: mismos lugares, mismo orden, mismo número.
- **Dado** el mismo caso, **cuando** se lee el presupuesto de la aventura, **entonces** no ha cambiado.
- **Dado** el mismo caso, **cuando** se lee el tamaño declarado de la aventura, **entonces** es el mismo.
- **Dado** una aventura aceptada, **cuando** se ofrece un micro-encuentro, **entonces** su sitio está en el trazado vigente y la jugadora lo atraviesa siguiéndolo, sin ningún metro añadido de ida ni de vuelta.
- **Dado** un sitio apto que exige salirse del trazado vigente, **cuando** se busca el lugar de un micro-encuentro, **entonces** ese sitio no es candidato.
- **Dado** una salida con un micro-encuentro atendido, **cuando** se compara el lazo recorrido con el de la misma salida sin él, **entonces** el trazado es el mismo.
- **Dado** un micro-encuentro ignorado, **cuando** se lee el estado de la aventura principal, **entonces** no ha cambiado nada en ella.
- **Dado** un micro-encuentro atendido, **cuando** se lee el trecho que queda hasta el siguiente beat de la aventura, **entonces** es el mismo que antes de atenderlo.
- **Dado** un micro-encuentro, **cuando** se lee cuántos beats tiene, **entonces** tiene exactamente uno.
- **Dado** un micro-encuentro, **cuando** se busca si tiene disparador de franja o tiempo límite, **entonces** no tiene ninguno: no se puede fallar por no llegar.
- **Dado** una aventura y un micro-encuentro vivos a la vez, **cuando** se busca en qué presupuesto se contabiliza el beat del micro-encuentro, **entonces** no se contabiliza en ninguno.

### Nunca durante un beat

- **Dado** una jugadora dentro de una escena de la aventura principal, **cuando** el mundo produce una oportunidad, **entonces** no se ofrece ningún micro-encuentro hasta que la escena termina.
- **Dado** el mismo caso, **cuando** se lee el estado de la entrada mientras la escena sigue abierta, **entonces** sigue pendiente y no ha consumido ninguna oferta.
- **Dado** una escena de la aventura principal que termina, **cuando** la jugadora vuelve a atravesar un sitio apto, **entonces** el micro-encuentro retenido puede ofrecerse.
- **Dado** una jugadora que atraviesa un sitio apto justo al entrar en el geofence de un beat de la aventura, **cuando** el beat comienza, **entonces** manda el beat y el micro-encuentro no se ofrece.
- **Dado** una salida entera dentro de escenas encadenadas de la aventura principal, **cuando** se cierra la salida, **entonces** ninguna oportunidad ha consumido oferta por haber estado retenida.
- **Dado** el estado del beat en curso, **cuando** se busca de dónde lo lee esta capa, **entonces** lo recibe como dato de la fila 34 y no lo deduce de la posición ni de ningún temporizador.
- **Dado** un beat en curso que nunca declara su fin, **cuando** se cierra la salida, **entonces** las oportunidades retenidas siguen pendientes y no se pierde ninguna.
- **Dado** la regla de no avisar durante un beat, **cuando** se busca dónde está escrita, **entonces** está en un solo sitio y la consultan por igual el micro-encuentro y cualquier otro aviso que cuelgue de esta capa.

### Las dos ofertas y la sedimentación

- **Dado** una oportunidad pendiente sin ninguna oferta, **cuando** se ofrece y la jugadora no la atiende, **entonces** queda con una oferta registrada y vuelve a estar pendiente.
- **Dado** una oportunidad con una oferta, **cuando** la jugadora sale otro día, **entonces** se le ofrece una vez más.
- **Dado** una oportunidad con una oferta registrada en una salida, **cuando** la misma salida sigue abierta, **entonces** no se le ofrece una segunda vez en esa salida.
- **Dado** una oportunidad con una oferta registrada en un sitio, **cuando** se busca dónde ofrecerla la segunda vez, **entonces** el sitio de la primera oferta no es candidato.
- **Dado** una oportunidad cuya segunda oferta solo podría caer en el mismo sitio que la primera, **cuando** la jugadora atraviesa ese sitio, **entonces** no se ofrece y la oportunidad sigue pendiente con una sola oferta.
- **Dado** una oportunidad con dos ofertas sin atender, **cuando** se cierra la salida de la segunda, **entonces** sedimenta.
- **Dado** una oportunidad sedimentada, **cuando** la jugadora sale otro día, **entonces** no se le ofrece nunca más.
- **Dado** una oportunidad sedimentada, **cuando** se consulta lo pendiente, **entonces** no aparece.
- **Dado** una oportunidad sedimentada, **cuando** se intenta ofrecer, **entonces** falla nombrando su estado, en lugar de ofrecerla una tercera vez.
- **Dado** una oportunidad sedimentada, **cuando** se intenta atender, **entonces** falla nombrando su estado y el estado de la partida no cambia.
- **Dado** una oportunidad atendida en su primera oferta, **cuando** se lee su historial, **entonces** tiene una sola oferta y nunca se ofrece una segunda.
- **Dado** el tope de ofertas, **cuando** se busca de dónde sale, **entonces** hay una sola constante con valor dos y todo lo que la consulta la lee de ahí.
- **Dado** una oportunidad ofrecida en la última salida antes de guardar, **cuando** se recarga la partida, **entonces** conserva su oferta registrada con su salida y su sitio, y la segunda oferta sigue exigiendo salida y sitio distintos.

### Sedimentar no se reprocha

- **Dado** una oportunidad que sedimenta, **cuando** se compara el rango de la jugadora en cada núcleo antes y después, **entonces** es el mismo.
- **Dado** el mismo caso, **cuando** se compara su relación con cada cara del mapa, **entonces** es la misma.
- **Dado** el mismo caso, **cuando** se comparan el oro, los objetos y los motes, **entonces** son los mismos.
- **Dado** una jugadora que deja sedimentar veinte oportunidades seguidas, **cuando** se compara el estado de la partida con el de otra que no recibió ninguna, **entonces** la única diferencia son las entradas sedimentadas de la cola.
- **Dado** una jugadora que deja sedimentar veinte oportunidades, **cuando** el mundo produce la siguiente, **entonces** se le ofrece igual, con las mismas dos ofertas: sedimentar no reduce lo que se ofrece después.
- **Dado** una oportunidad sedimentada, **cuando** se busca si generó alguna entrada de diario, **entonces** no generó ninguna.
- **Dado** el catálogo de efectos que esta capa puede producir, **cuando** se enumera, **entonces** todos añaden y ninguno resta, baja, caduca ni retira nada.
- **Dado** la sedimentación de una oportunidad, **cuando** se mira qué efecto produce, **entonces** no produce ninguno: cambia el estado de su propia entrada y nada más.
- **Dado** todos los textos que esta capa expone hacia fuera, **cuando** se revisan, **entonces** ninguno menciona lo no atendido, lo perdido ni lo que la jugadora no hizo.
- **Dado** la superficie pública de esta capa, **cuando** se busca una consulta que devuelva cuántas oportunidades se dejaron pasar, **entonces** no existe.

### El recado suelto comparte lista

- **Dado** una cola con al menos una oportunidad pendiente, **cuando** se pide el recado suelto para la lista de hoy, **entonces** devuelve exactamente una entrada.
- **Dado** el recado devuelto, **cuando** se lee su medida, **entonces** es «un momento».
- **Dado** el recado devuelto, **cuando** se busca su tiempo aproximado y su distancia, **entonces** no tiene ninguno de los dos.
- **Dado** una cola con doce oportunidades pendientes, **cuando** se pide el recado suelto, **entonces** devuelve una sola, no una lista.
- **Dado** la cola sin ninguna oportunidad pendiente, **cuando** se pide el recado suelto, **entonces** devuelve vacío y no un error.
- **Dado** una jugadora de un oficio y una cola cuyas oportunidades nacieron sin afinidad de oficio, **cuando** se pide el recado suelto, **entonces** devuelve una: el recado no se filtra por oficio.
- **Dado** un mundo donde no castea ninguna plantilla para el oficio de la jugadora, **cuando** se compone la lista de hoy, **entonces** hay al menos una entrada, y es el recado suelto.
- **Dado** el recado suelto, **cuando** se lee lo que declara, **entonces** declara que ocupa un sitio del tope de tres de la lista: nunca añade un cuarto.
- **Dado** un recado suelto que aparece en la lista y la jugadora elige una aventura, **cuando** se lee su entrada, **entonces** sigue pendiente y no ha consumido ninguna oferta: aparecer en la lista y no elegirse no es una oferta perdida.
- **Dado** un recado suelto que apareció en la lista y no se eligió, **cuando** se pide el recado del día siguiente y hay otra oportunidad pendiente, **entonces** se ofrece la otra.
- **Dado** un recado suelto aceptado, **cuando** la jugadora anda, **entonces** su lugar se resuelve en marcha con las mismas reglas del micro-encuentro, incluido el coste cero de desvío.
- **Dado** un recado suelto aceptado y no atendido, **cuando** se cierra la salida, **entonces** consume una oferta.
- **Dado** un recado suelto aceptado y atendido, **cuando** se lee su entrada, **entonces** está «atendida» y sale de la cola.
- **Dado** el recado suelto, **cuando** se busca qué texto entrega, **entonces** entrega la referencia a su texto de plantilla y ninguna cadena redactada aquí.

### El precalentamiento tiene que medirse

- **Dado** cada uno de los cuatro mundos congelados de las pruebas con su prólogo corrido, **cuando** se consulta lo pendiente de la cola, **entonces** hay al menos una oportunidad.
- **Dado** el mundo congelado `barrio-tres-calles` con su prólogo corrido, **cuando** se pide el recado suelto para cada oficio del catálogo, **entonces** devuelve uno para todos ellos.
- **Dado** el mundo congelado `suelo-250m`, que es el mínimo del proyecto, **cuando** se compone la lista de hoy para un oficio sin ninguna plantilla que castee, **entonces** la lista no está vacía.
- **Dado** un mapa cuyo prólogo no dejó ninguna oportunidad, **cuando** se compone la lista de hoy sin aventuras casteadas, **entonces** la lista sale vacía y el criterio anterior se pone rojo: es la comprobación de que mide algo.
- **Dado** las entradas sembradas por el prólogo, **cuando** se comparan con las que produce un paso durante la partida, **entonces** tienen la misma forma y esta capa no las distingue.
- **Dado** una entrada sembrada por el prólogo, **cuando** se ofrece, **entonces** sigue el mismo ciclo de dos ofertas y la misma sedimentación que cualquier otra.
- **Dado** el mismo mundo congelado y la misma semilla, **cuando** se corre el prólogo dos veces desde cero, **entonces** la cola sembrada que esta capa lee es idéntica.
- **Dado** una partida que consume la cola sembrada hasta vaciarla, **cuando** la jugadora sigue andando, **entonces** la cola vuelve a llenarse con lo que producen los pasos, sin ningún resiembra del prólogo.

### Determinismo, y nada que se degrade en silencio

- **Dado** los módulos de esta spec, **cuando** se inspecciona su implementación, **entonces** no aparece `Math.random()`, ni `Date.now()`, ni `new Date()`, ni ningún temporizador.
- **Dado** el productor de paso de esta spec, **cuando** se ejecuta un paso, **entonces** recibe un azar derivado del suyo propio, de modo que añadirlo no desplaza el azar de la propagación de rumores.
- **Dado** un mapa con esta capa y otro idéntico sin ella, **cuando** se comparan los rumores propagados en los mismos cincuenta pasos, **entonces** son los mismos.
- **Dado** el mismo paso ejecutado dos veces desde el mismo estado, **cuando** se comparan las entradas encoladas, **entonces** son idénticas y en el mismo orden.
- **Dado** un mundo congelado, **cuando** se ejecutan cincuenta pasos con esta capa colgada, **entonces** el documento de cada celda sigue idéntico byte a byte.
- **Dado** una llamada a resolver un lugar diferido sin trazado, sin llegada o sin escena, **cuando** se ejecuta, **entonces** falla nombrando lo que falta y no cae a un comportamiento reducido en silencio.
- **Dado** una llamada que recibe un sitio en lugar de un trazado, o un trazado en lugar de un sitio, **cuando** se ejecuta, **entonces** falla nombrando lo recibido: ninguna firma de esta capa admite dos formas distintas en el mismo parámetro.
- **Dado** una oferta que se registra sin salida o sin sitio, **cuando** se ejecuta, **entonces** falla nombrando el campo que falta, en lugar de registrar una oferta a medias.
- **Dado** la superficie pública de esta capa, **cuando** se busca una cifra de distancia, tiempo, ritmo o progreso, **entonces** no existe ninguna.
- **Dado** la superficie pública de esta capa, **cuando** se busca un texto destinado a mostrarse dentro del juego, **entonces** no exporta ninguno.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/entregas.js` | la cola: la forma de la entrada, el enumerado cerrado de dos tipos, el productor de paso que se registra en el motor, la sedimentación inmediata de la noticia, el ciclo de dos ofertas y la sedimentación de la oportunidad |
| `packages/nucleo/partida/microencuentros.js` | el disparo: la guarda de cola no vacía, la resolución del lugar diferido contra el trazado, la comprobación de coste cero, la retención por beat en curso y la limitación a uno por paso del mundo |
| `packages/nucleo/partida/recados.js` | el recado suelto: la elección de una sola entrada, la medida «un momento», la rotación entre listas y la declaración de que ocupa sitio en el tope de tres |

Las tres viven en `partida/` por la misma razón que las de SPEC-011 y SPEC-012: lo que el mundo debe a una jugadora concreta es estado de esa partida, no del mundo. SPEC-009 ya fijó que el documento congelado describe el mundo y nada más.

### Frontera de inyección

Tres entradas nuevas, y ninguna sensor:

- **El segundo productor de paso**, registrado en el motor de SPEC-011 con el mismo contrato que el de SPEC-012: recibe el número del paso y su azar, y devuelve efectos del catálogo cerrado. SPEC-011 dejó dicho que los dos primeros productores serían la propagación y esta cola; este es el segundo, y con él el motor sigue funcionando entero si se quita cualquiera de los dos.
- **El trazado vigente de la salida y las llegadas a geofence**, de la fila 32. El núcleo no mira el GPS ni calcula geofences: recibe la lista de sitios que la jugadora va a atravesar siguiendo el trazado, y el aviso de que ha atravesado uno. Que el trazado llegue como lista de sitios y no como polilínea es deliberado: la comprobación de coste cero se reduce entonces a una pertenencia y no a una distancia, y no hay umbral que ajustar ni degradar.
- **El estado del beat en curso**, de la fila 34: un dato de dos valores —hay escena abierta o no— con el que se retiene el aviso. El núcleo no deduce que hay un beat en curso por la posición ni por el tiempo parado.

Hacia fuera entrega tres cosas y solo tres: **los efectos del paso**, que consume el motor; **el micro-encuentro disponible** con su sitio y su escena, que consumen las filas 29, 32 y 34; y **el recado suelto**, que consume la fila 28. Ni un texto redactado.

### Lo que esta fila cierra de SPEC-013

SPEC-013 escribió, en sus huecos de cobertura y en su frontera, que sembraba la cola de entregas y que **nadie la consumía todavía**, y dejó explícito que no definía su ciclo de vida: ni el coste cero de desvío, ni el cooldown, ni la doble oferta, ni la sedimentación. Los cuatro los define esta spec, y las entradas sembradas entran por la misma puerta que las que produce un paso, sin ningún campo que las marque como del prólogo. Ese fue el default que SPEC-013 asumió y aquí se honra: si una entrada del prólogo fuese distinguible, acabaría tratada distinto y el arranque volvería a parecer un guion.

El precalentamiento deja de ser una promesa y pasa a ser un criterio con mundo real detrás. `personaje.md` §3 pide que la cola cubra el día sin aventura del oficio propio, y eso se mide donde puede ponerse rojo: en `barrio-tres-calles` y `suelo-250m`, que son los mundos donde el catálogo no llega y donde el informe de casting concentra sus fallos. Un criterio comprobado solo sobre `urbano-denso` sería de los que se cumplen casi siempre —el error que `pipeline/decisiones-orquestador.md` §6o levantó en esta misma familia de specs—, y por eso se exige el mundo pequeño y se exige por oficio.

### Lo que hace que «sin reproche» sea verificable y no una intención

«Ignorarlo es gratis» se escribe fácil y se rompe sin darse cuenta: basta una entrada de diario que diga «no fuiste», un rango que no suba porque el mundo lleva la cuenta, o un recado que deje de ofrecerse porque la jugadora ya ignoró tres. La spec lo convierte en cuatro comprobaciones estructurales, y ninguna depende de leer un texto:

1. **La sedimentación no produce ningún efecto.** Cambia el estado de su propia entrada y nada más; ni siquiera un efecto aditivo. Con el catálogo cerrado de SPEC-011, un efecto que restase ya haría fallar el paso entero, así que la garantía es doble.
2. **El diff del estado de la partida es vacío.** Veinte sedimentaciones frente a una partida que no recibió ninguna oportunidad: la única diferencia son las entradas de la cola. Esto se afirma sobre rango, relación, oro, objetos, motes y diario, que son las seis cosas donde un reproche podría esconderse.
3. **La oferta futura no encoge.** Sedimentar veinte no reduce a una las dos ofertas de la veintiuna. Es la trampa más plausible de todas, porque «ya se le ha ofrecido mucho» suena razonable al escribir el código.
4. **No hay consulta que cuente lo ignorado.** Si el número no existe en la superficie pública, ninguna pantalla puede pintarlo por descuido — el mismo argumento con el que SPEC-011 mantuvo el contador de pasos dentro del núcleo.

### Lo que toca pantalla, y de qué fila es

Nada de esto se especifica aquí; se anota para que quien orqueste sepa dónde cae:

| Lo que se ve | Fila |
| --- | --- |
| la lista de hoy `A2P3`, su tope de tres, el orden y la tarjeta del recado con su medida | 28, `portada-antes-de-salir` |
| el aviso en marcha: notificación más háptico, la marca en el mapa, que se lea de un vistazo y que tocarlo no acepte nada | 29, `en-marcha-mapa-avisos` |
| la llegada al geofence y la parada | 32, `llegadas-geofence` |
| el visor del sitio y la escena del beat con su botón | 33 y 34 |
| el texto del encargo, de la tarjeta y de la notificación, con su fallback | 17 y 18 |

La medida «un momento» es un valor declarado, no un texto redactado: sale del módulo del recado y **no se añade al enumerado de tamaños de salida** de SPEC-004, porque un recado no es una aventura y no tiene presupuesto de beats. Cómo se escribe en la tarjeta es de la fila 28.

### Escenarios de `docs/testing.md` que respaldan esta spec

Se referencian por su nombre literal; no se implementan aquí, son de `wa-qa-dev`.

- **«Cada aviso viaja por dos capas y el par mezcla bolsillo y pantalla»** (`@app @accesibilidad @bucle`), que es la característica de esta fila → **«Una oportunidad ignorada se ofrece una segunda vez»**, que es el escenario canónico de RF-QUEST-010 y del que aquí se sostiene la parte `@nucleo`: el ciclo de dos ofertas, la exigencia de otra salida y otro sitio, y la sedimentación; **«Sedimentar no se reprocha»**, del que aquí se sostiene todo lo que no es leer un texto; **«No se avisa durante un beat en curso»**, que es la regla de retención; **«Una oportunidad va por notificación y háptico»** y **«Una noticia va por háptico y marca»**, cuyo aviso es de la fila 29 pero cuya distinción entre los dos tipos nace aquí; **«El aviso se lee entero de un vistazo»** y **«Tocar un aviso no acepta nada»**, que son de la fila 29 y que esta capa no puede romper porque no exporta texto ni acepta nada desde un aviso; y **«Ningún aviso viaja por una sola capa»**, que se revisa sobre el catálogo completo.
- **«Antes de salir es el único momento que pide atención»** (`@app @bucle`) → **«Se ofrecen tres aventuras como mucho»** y **«Un día con una sola aventura no es un día roto»**, que esta spec no implementa pero condiciona, porque el recado ocupa sitio en ese tope; y **«Cada aventura declara su tamaño con una palabra»**, que es la razón de que el recado declare una medida y ninguna cifra.
- **«El mundo avanza con los kilómetros del jugador, no con el calendario»** → **«Un paso solo añade»**, del que esta capa es el segundo productor y donde se comprueba que la sedimentación no quita nada.
- **«Lo generado no se resiembra jamás»** → cincuenta pasos con la cola colgada dejan el mundo congelado idéntico byte a byte.
- **«El mundo es una función de la semilla y de los datos de OSM»** → la prohibición de `Math.random()` y del reloj, que aquí es especialmente fácil de romper: un cooldown escrito en minutos habría metido el reloj real en el núcleo.
- **Frontera, que esta spec deja preparada y no implementa:** «La pantalla del mapa no tiene ni un control» y «No se enseña ninguna cifra de esfuerzo» (fila 29); «Pararse en un semáforo dentro de un geofence no tiene consecuencias» (fila 32); «El visor abre por la ficción la primera vez» (fila 33).

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería, no de esta spec, y `wa-qa-dev` tendrá que cubrirlos como casos sin escenario de respaldo:

- **RF-QUEST-016 no tiene ni un escenario.** El PRD lo marca `⚠ sin escenario` y es literal: ni el recado suelto, ni la medida «un momento», ni que la lista no salga vacía sin aventuras del oficio aparecen en ninguna característica. Es el hueco más grande de esta fila y el que más consecuencias tiene, porque es la mitad de la respuesta al día vacío.
- **Nada afirma que un micro-encuentro solo salta con cola no vacía.** «Una oportunidad va por notificación y háptico» empieza por «Dado un micro-encuentro disponible», que da por hecho justo lo que hay que comprobar. Que sin producción del mundo no haya encuentro —la prohibición del relleno aleatorio— no está en ningún sitio.
- **El coste cero de desvío no tiene escenario.** Es una de las tres reglas de RF-QUEST-010 y la batería no la toca: nada comprueba que la cadena de beats y el presupuesto de la aventura sigan iguales después de atender un micro-encuentro.
- **El lugar diferido no tiene escenario.** `quests.md` §2 lo declara y la batería no lo recoge; en particular, nada afirma que el contenido sea el mismo se resuelva donde se resuelva, que es la mitad determinista de la regla.
- **«Una oportunidad ignorada se ofrece una segunda vez» no comprueba «otro sitio».** El escenario dice «en otro sitio» en el Entonces, pero no hay ningún caso donde el único sitio disponible sea el de la primera oferta, que es donde la regla se rompe.
- **La sedimentación de la noticia no tiene escenario.** «Una noticia va por háptico y marca» cubre el aviso, no que sedimente de inmediato ni que nunca ocupe sitio en la cola.
- **«Sedimentar no se reprocha» solo mira los textos.** El escenario recorre el juego entero buscando una frase; nada comprueba que el rango, la relación, el oro y la oferta futura sigan iguales, que es donde el reproche se cuela sin decir una palabra.
- **Nada afirma el cooldown.** Que no salten dos micro-encuentros en el mismo paso del mundo no está en la batería, y sin él una salida larga con la cola llena se convierte en una ristra de notificaciones, que es exactamente lo que el racionamiento del aviso quería evitar.

## Decisiones asumidas

- **La cola retiene oportunidades y nada más; una noticia nace y sedimenta dentro del mismo paso** → asumido (alternativa: que la noticia espere en la cola a que la jugadora la reciba). Regla: `quests.md` decisión 3 dice que las noticias «sedimentan de inmediato en lo que se cuenta en el núcleo y siguen consultables»; si esperasen, «solo salta con cola no vacía» pasaría a cumplirse casi siempre y el micro-encuentro dejaría de estar acotado por lo que el mundo produce de verdad.
- **Una oferta se consume al ofrecerse en marcha con lugar resuelto, o al aceptar un recado suelto y cerrar la salida sin atenderlo** → asumido (alternativa: que aparecer en la lista de hoy y no elegirse consuma oferta). Regla: `quests.md` decisión 3 justifica las dos ofertas con «basta un semáforo, una conversación real o el móvil en el bolsillo», que son las maneras de perderse un aviso en marcha; en la lista te has enterado y has dicho que no, y quemar ahí el presupuesto dejaría a la entrada sin ninguna oferta real. Además la lista no tiene sitio, así que la regla «otro sitio» no sería comprobable.
- **Una entrada que aparece en la lista y no se elige rota**, y el día siguiente el sitio lo ocupa otra pendiente si la hay → asumido (alternativa: repetir siempre la misma hasta que se acepte). Regla: el recado existe para que el día no esté vacío; repetir la misma tarjeta tres días seguidos es la forma más rápida de que deje de leerse, y rotar no cuesta ninguna oferta porque aparecer no consume ninguna.
- **El recado suelto no se filtra por oficio** → asumido (alternativa: filtrarlo como se filtran las aventuras). Regla: `personaje.md` §3 dice que el precalentamiento existe «para que un día sin aventura de tu oficio no sea un día vacío»; filtrarlo por oficio lo dejaría vacío exactamente los días que tiene que salvar.
- **El recado ocupa un sitio del tope de tres y nunca añade un cuarto** → asumido: la cola declara que ocupa sitio y la composición final es de la fila 28 (alternativas: que sea una cuarta entrada, o que solo aparezca cuando hay menos de tres aventuras). Regla: el artefacto 2, pantalla 3, dice «el tercer sitio lo ocupa un recado suelto», y `bucle-jugable.md` §3 fija el tope en tres porque «tres se comparan de un vistazo».
- **Como mucho un micro-encuentro por paso del mundo** → asumido como forma del cooldown que `quests.md` pendiente 3 deja abierto (alternativas: un cooldown en minutos, o uno en metros). Regla: `CLAUDE.md` prohíbe el reloj real dentro del núcleo y `quests.md` decisión 4 hace del paso la unidad de tiempo del mundo; un cooldown en minutos habría metido `Date.now()` en esta capa, y uno en metros habría duplicado la conversión que ya hace el motor de pasos.
- **El sitio apto se busca solo dentro del trazado vigente, que llega como lista de sitios** → asumido (alternativa: un umbral de desvío en metros sobre la polilínea). Regla: «coste cero de desvío» es literal en `quests.md` decisión 3 —«jamás manda al jugador fuera del lazo»—; un umbral en metros es un número que se ajusta hacia arriba en cuanto un mundo no dé encuentros, y con eso el coste deja de ser cero sin que nada se ponga rojo, que es la familia de fallos de `pipeline/decisiones-orquestador.md` §6h.
- **Sin aventura aceptada, el lugar se resuelve por llegada real y no por trazado** → asumido (alternativa: no ofrecer micro-encuentros al salir a andar sin nada). Regla: `testing.md` recoge que salir a andar sin aventura es una opción de primer nivel; dejar esas salidas sin nada que el mundo entregue las convertiría en la opción pobre.
- **La retención por beat en curso no consume oferta ni sedimenta nada** → asumido (alternativa: contar la oferta retenida como ofrecida). Regla: «No se avisa durante un beat en curso» protege la escena, y cobrarle a la jugadora una de sus dos ofertas por estar viviendo la aventura sería penalizarla por jugar.
- **El estado del beat en curso llega como dato de la fila 34** → asumido (alternativa: deducirlo de la posición o del tiempo parado). Regla: `packages/nucleo/` no habla con la plataforma (RF-INFRA-001), y deducirlo por tiempo parado metería el reloj real donde no puede estar.
- **Un micro-encuentro no tiene franja ni tiempo límite** → asumido (alternativa: permitir disparador de franja como en un beat de quest). Regla: RF-QUEST-015, «fallar por no llegar es casi imposible»; y `quests.md` §2 solo declara lugar diferido para el micro-encuentro, no disparadores nuevos.
- **La medida «un momento» vive en el módulo del recado y no entra en el enumerado de tamaños de salida** → asumido (alternativa: añadirla como cuarto tamaño junto a paseo, aventura y jornada). Regla: SPEC-010 ata cada tamaño a un rango de beats y a un alcance; un recado tiene un beat y ningún presupuesto, y meterlo ahí obligaría a inventarle un rango que después alguien comprobaría.
- **La sedimentación no produce ningún efecto de paso, ni siquiera aditivo** → asumido (alternativa: producir un efecto que registre el sedimento). Regla: «Sedimentar no se reprocha»; un efecto registrado es un dato que alguien acaba contando, y el registro que sí hace falta —el estado de la entrada— ya vive en la cola.
- **El productor de esta capa recibe un azar derivado del suyo propio** → asumido (alternativa: compartir el generador del paso con la propagación de rumores). Regla: `CLAUDE.md`, un sufijo distinto por fase; con un generador compartido, colgar esta cola cambiaría todos los rumores ya sembrados, y SPEC-011 lo dejó escrito precisamente por esto.
- **La cola es por mapa, como el contador de pasos** → asumido (alternativa: una sola cola para toda la partida). Regla: SPEC-011 asumió el contador por mapa por RF-PERS-007 y «El mundo de casa no avanza en tu ausencia»; una cola compartida haría que lo que el mundo produjo en otro mapa te saliera al paso en casa.
- **Las entradas sembradas por el prólogo son indistinguibles de las que produce un paso** → asumido (alternativa: un tipo propio de entrada «de arranque»). Regla: es el default que SPEC-013 ya asumió y esta fila lo honra en lugar de reabrirlo; `personaje.md` §3 dice que el precalentamiento carga la cola, no que cree otra.
- **El precalentamiento se mide sobre los mundos pequeños y por oficio** → asumido (alternativa: comprobarlo sobre un mundo cualquiera). Regla: `pipeline/decisiones-orquestador.md` §6o — un criterio que se cumple casi siempre no es un criterio; y el informe de casting concentra los fallos en los mundos de paseo, que son justo donde el recado tiene que salvar el día.
- **Ninguna firma admite dos formas distintas en el mismo parámetro, y toda entrada incompleta falla nombrando lo que falta** → asumido (alternativa: aceptar lo que llegue y seguir con lo que se pueda). Regla: `pipeline/decisiones-orquestador.md` §6h, la degradación silenciosa del grafo, que apareció cinco veces por firmas permisivas; aquí el riesgo es idéntico porque esta capa recibe trazados, sitios y llegadas que se parecen mucho entre sí.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-016.
- **Sin `## UX Design` y sin comportamiento responsive** → asumido: esta spec no dibuja pantalla; `A2P3` es de la fila 28 y el aviso en marcha de la 29 (alternativa: especificar aquí la lista y el aviso). Regla: decisión del orquestador y el design system, que prohíbe rediseñar una pantalla ya dibujada.
- **SPEC-017 y SPEC-018 se citan por su fila del checklist y no por su contenido** → asumido: al escribir esta spec no existían aún sus ficheros en `docs/specs/` (alternativa: esperar a que existan). Regla: la frontera con ellas es de reparto —el catálogo declara la escena y sus textos, el contrato con el LLM los redacta— y esta spec no depende de cómo lo hagan: solo entrega y consume referencias, nunca cadenas.
