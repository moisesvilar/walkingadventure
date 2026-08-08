# SPEC-011 — El motor de pasos: el reloj del mundo son los kilómetros

## Descripción

El mundo de Walking Adventure no avanza con el calendario: avanza con lo que anda la jugadora. La unidad es el **paso**, y un paso es un tramo andado —lo que ella recorre en media hora, no dos kilómetros absolutos—, de modo que quien anda 6 km y quien anda 900 m mueven el mundo exactamente igual. Esta spec entrega el contador, la conversión de metros andados en pasos, la siembra de cada paso por su número y la reserva acotada de la fuente opcional de kilómetros del día a día.

Lo que hace que esto sea una decisión de diseño y no un contador más es dónde vive: **el motor de pasos es una capa sobre el mundo ya generado, nunca una fase de la tubería de generación**. Un paso no resiembra nada, no vuelve a llamar a `buildWorld`, no toca el documento congelado de ninguna celda; solo hace avanzar un número y da a quien cuelgue de él un azar reproducible con el que decidir qué ocurrió. Romper esa frontera convertiría el avance del mundo en una regeneración, que es el fallo que `docs/testing.md` llama «Lo generado no se resiembra jamás».

Y de ahí salen las dos promesas que la jugadora sí nota: **estar un mes sin salir no acumula mundo pendiente** —volver tras tres meses enseña lo mismo que volver tras tres días— y **un paso solo añade**: puede traer un rumor, una oportunidad o una razón para volver, y no caduca una aventura, ni retira a nadie, ni baja un rango por no haber salido.

No tiene interfaz de usuario. La pantalla del zurrón (`A2P2`), el interruptor de los pasos de fondo en los ajustes y la lectura de la app de salud son de la fila 42 (`pasos-fondo-zurron`); aquí se entrega el mecanismo que esa fila enciende.

Anclas: **RF-RUMOR-001** y **RF-RUMOR-002** (`docs/prd.md` §4.3), con `game-design/quests.md` **decisión 4** como fuente que manda sobre el PRD, `game-design/seguridad-privacidad.md` §2 para por qué los pasos de fondo se leen al abrir y sin GPS de fondo, y `game-design/bucle-jugable.md` §9 para qué se hace cuando la detección de vehículo duda. Se apoya en SPEC-003 (la semilla de partida y la derivación de semillas de fase), SPEC-004 (el tramo personal, su estimación y la asimetría de la duda) y SPEC-009 (el mundo congelado y el área `partida/`): ninguna de esas decisiones se reabre, se consumen resueltas.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la toca**: entran los metros ya clasificados de una salida, los metros de fondo leídos al abrir, y los productores de paso que cuelgan del motor; están descritos en «Frontera de inyección».
- **Fuera de alcance, y son seis cosas que parecerían naturales aquí:** la detección de vehículo, que esta spec **consume ya resuelta** y no implementa (fila 31, `deteccion-vehiculo`, RF-INFRA-005 y RF-BUCLE-015); el interruptor de los pasos de fondo en los ajustes, el permiso de salud, la lectura de la app de salud al abrir y la pantalla del zurrón con su redacción (fila 42, `pasos-fondo-zurron`, RF-RUMOR-006 y RF-PRIV-003); **qué ocurre** en un paso —la propagación del rumor por el árbol de calzadas, su latencia y su nivel— (fila 12, `propagacion-rumores`, RF-RUMOR-003/004/005); la cola de oportunidades y los micro-encuentros que un paso puede alimentar (fila 19); la medición del ritmo y la corrección del tramo, que aquí se consumen (fila 4, `tramo-personal`); y qué mapa está activo cuando hay varios (fila 41, `mapas-multiples`). Esta spec entrega **el reloj y su cuerda**, no lo que el reloj pone en marcha.

## Criterios de aceptación

Los criterios van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El contador y su semilla», «De metros andados a pasos» y «La reserva de los pasos de fondo»; la **validación de entradas**, en el número de pasos que no es entero positivo, los metros negativos o no numéricos, el segmento sin clasificar y el efecto fuera del catálogo; el **estado vacío**, en la partida recién creada que marca cero, en el paso sin ningún productor colgado, en la salida sin un solo metro andando y en la reserva vacía; el **estado de error**, en el tramo ausente, en el mapa activo ausente, en el motor sin productores inyectados que aun así avanza y en el productor que devuelve un efecto que quita; y los **casos límite**, en el resto de metros que no completa un paso, en la reserva exactamente llena, en el desbordamiento de doce pasos sobre un tope de cinco, en el paso número cero y en la salida entera en autobús.

«Mundo congelado X» sigue significando el fixture `test/fixtures/osm/X/` de SPEC-001. «Paso» significa siempre paso del mundo —la unidad de esta spec—, nunca un paso de los que cuenta un podómetro: esos se llaman aquí «kilómetros de fondo», y la distinción importa porque el diseño usa las dos palabras.

### El contador y su semilla

- **Dado** una partida recién creada con su primer mapa, **cuando** se lee el contador de pasos, **entonces** marca cero.
- **Dado** un contador en cero, **cuando** se ejecuta un paso, **entonces** el paso ejecutado es el número uno y el contador queda en uno.
- **Dado** un contador en un valor cualquiera, **cuando** se le pide avanzar siete pasos, **entonces** se ejecutan siete pasos consecutivos numerados desde el actual más uno, sin saltos y sin repeticiones.
- **Dado** un contador, **cuando** se le pide avanzar cero pasos, **entonces** no se ejecuta ninguno y el contador no cambia.
- **Dado** un contador, **cuando** se le pide avanzar un número que no es entero positivo, **entonces** falla con un error explícito que nombra lo recibido.
- **Dado** el paso número `n` de un mapa, **cuando** se pide su semilla, **entonces** se deriva de la semilla de la partida, del identificador del mapa y del sufijo `:tick:` con el número del paso, con el mismo mecanismo de semillas de fase que fijó SPEC-003.
- **Dado** el mismo mapa y el mismo número de paso, **cuando** se piden su semilla y su azar dos veces desde cero, **entonces** las dos ejecuciones producen exactamente lo mismo.
- **Dado** el paso 7 de un mapa, **cuando** se compara con el paso 7 de otro mapa de la misma partida, **entonces** sus semillas son distintas.
- **Dado** el paso 7 de un mapa, **cuando** se compara con el paso 7 del mismo mapa en otra partida con otra semilla, **entonces** sus semillas son distintas.
- **Dado** dos partidas distintas que llegan al paso 12, **cuando** se comparan los pasos 12 con la misma semilla de partida y el mismo mapa, **entonces** producen lo mismo, aunque uno se haya alcanzado en un día y el otro en tres meses.
- **Dado** el paso `n`, **cuando** se inspecciona lo que entra en su semilla, **entonces** no entra ninguna fecha, ninguna hora ni ningún dato de cuándo se ejecutó.
- **Dado** el módulo del motor, **cuando** se inspecciona su implementación, **entonces** no aparece `Math.random()`, ni `Date.now()`, ni `new Date()`, ni ningún temporizador.
- **Dado** un contador que ha avanzado, **cuando** se serializa la partida y se vuelve a cargar, **entonces** el contador vuelve con el mismo valor.
- **Dado** el contador de pasos, **cuando** se busca dónde se guarda, **entonces** viaja con la partida y nunca dentro del documento congelado de ninguna celda.

### De metros andados a pasos

- **Dado** una jugadora con un tramo de 2 km y una salida abierta, **cuando** anda 6 km, **entonces** el mundo ha avanzado tres pasos.
- **Dado** una jugadora con un tramo de 600 m y una salida abierta, **cuando** anda 1 800 m, **entonces** el mundo ha avanzado tres pasos, los mismos que la de 2 km con sus 6 km.
- **Dado** una jugadora con un tramo de 2 km, **cuando** anda 5 km en una salida, **entonces** el mundo ha avanzado dos pasos y quedan 1 000 m de resto sin gastar.
- **Dado** el resto de una salida anterior, **cuando** se abre otra salida y se andan los metros que le faltaban, **entonces** el paso se completa y el resto vuelve a cero.
- **Dado** una salida sin un solo metro andando, **cuando** se cierra, **entonces** el mundo no ha avanzado ningún paso y el resto no ha cambiado.
- **Dado** una salida abierta, **cuando** se andan los metros de un paso, **entonces** el paso se ejecuta durante la caminata y no se difiere al telón.
- **Dado** los mismos metros entregados de una vez o troceados en veinte muestras, **cuando** se convierten en pasos, **entonces** el número de pasos ejecutados y el resto son idénticos.
- **Dado** una entrega de metros negativa o no numérica, **cuando** se convierte en pasos, **entonces** falla nombrando el valor recibido, sin tocar el contador ni el resto.
- **Dado** una partida sin tramo declarado, **cuando** se convierten metros en pasos, **entonces** falla nombrando el tramo que falta, en lugar de suponer uno por defecto.
- **Dado** una salida abierta, **cuando** se convierten sus metros en pasos, **entonces** el tramo usado es el que la jugadora tenía al abrir la salida y no cambia a mitad de ella.
- **Dado** una jugadora cuyo tramo baja al cerrar la salida, **cuando** se leen los pasos ya ejecutados, **entonces** ninguno se recalcula ni se reescribe.
- **Dado** el mismo cambio de tramo, **cuando** se lee el resto pendiente, **entonces** sigue expresado en metros y no se reescala.
- **Dado** los pasos de una salida activa, **cuando** se busca dónde se acumulan, **entonces** no se acumulan en ninguna reserva: se gastan según se generan.
- **Dado** una salida en la que se andan doce tramos seguidos, **cuando** se convierten en pasos, **entonces** se ejecutan los doce, sin ningún tope.

### Qué kilómetros cuentan

- **Dado** una traza de salida con sus segmentos ya clasificados, **cuando** se cuentan los metros para el motor, **entonces** entran los clasificados como andando.
- **Dado** una traza con un tramo a velocidad de vehículo, **cuando** se cuentan los metros para el motor, **entonces** esos metros no entran.
- **Dado** una jugadora con una salida abierta que se desplaza 30 km a velocidad de vehículo, **cuando** se cuentan los metros, **entonces** el motor no avanza ningún paso.
- **Dado** una vuelta a casa en autobús desde 6 km, **cuando** se cierra la salida, **entonces** esos metros no han hecho avanzar el mundo.
- **Dado** una traza con 800 m a velocidad ambigua, **cuando** se cuentan los metros para el motor, **entonces** esos 800 m cuentan.
- **Dado** los mismos 800 m ambiguos, **cuando** se compara con lo que hace la medición del tramo, **entonces** la respuesta es la contraria, y las dos salen del mismo módulo de SPEC-004 en lugar de estar escritas dos veces.
- **Dado** el motor de pasos, **cuando** se inspecciona su implementación, **entonces** no clasifica velocidades por su cuenta: recibe los segmentos ya clasificados.
- **Dado** una traza con un segmento sin clasificar, **cuando** se cuentan sus metros, **entonces** falla nombrando el segmento, en lugar de suponer que se andaba.
- **Dado** una traza cuyos segmentos son todos de vehículo, **cuando** se cuentan los metros, **entonces** el total es cero y no un error.

### La reserva de los pasos de fondo

- **Dado** una partida con los pasos de fondo apagados, **cuando** se le entregan kilómetros de fondo, **entonces** no se ejecuta ningún paso y la reserva sigue vacía.
- **Dado** una partida con los pasos de fondo activados, **cuando** se le entregan kilómetros equivalentes a tres pasos, **entonces** se ejecutan tres pasos y la reserva contiene tres.
- **Dado** una partida con los pasos de fondo activados, **cuando** acumula kilómetros equivalentes a doce pasos sin salir, **entonces** la reserva contiene cinco pasos y el contador del mundo ha avanzado cinco, no doce.
- **Dado** la reserva llena, **cuando** llegan más kilómetros de fondo, **entonces** no se ejecuta ningún paso más y no queda ninguna deuda pendiente de ejecutar.
- **Dado** la reserva llena y kilómetros de fondo descartados, **cuando** se vacía la reserva y se entregan kilómetros nuevos, **entonces** los pasos que se ejecutan salen solo de los nuevos, sin recuperar nada de lo descartado.
- **Dado** la reserva con cuatro pasos y kilómetros equivalentes a tres, **cuando** se convierten, **entonces** se ejecuta uno y se descartan los otros dos.
- **Dado** una reserva con entradas, **cuando** se lee, **entonces** se entregan sus pasos en el orden en que se ejecutaron y la reserva queda vacía.
- **Dado** una reserva vacía, **cuando** se lee, **entonces** se obtiene una lista vacía y no un error.
- **Dado** el tope de la reserva, **cuando** se busca de dónde sale, **entonces** hay una sola constante con valor cinco y todo lo que la consulta la lee de ahí.
- **Dado** una reserva vaciada, **cuando** se comparan los pasos ejecutados desde el fondo con los de una salida activa, **entonces** son de la misma naturaleza y llevan el mismo número correlativo del mismo contador.
- **Dado** una partida con los pasos de fondo activados y la reserva llena, **cuando** la jugadora sale a andar, **entonces** los pasos de la salida activa se ejecutan igual, sin que el tope de la reserva los frene.
- **Dado** una reserva con pasos sin leer, **cuando** se serializa la partida y se vuelve a cargar, **entonces** la reserva vuelve con los mismos pasos y en el mismo orden.
- **Dado** el motor, **cuando** se busca cómo sabe si los pasos de fondo están activos, **entonces** lo recibe como dato de la partida y no lo consulta a ninguna capa de la plataforma.

### El calendario no mueve nada

- **Dado** una jugadora que ha andado 0 km en treinta días, **cuando** abre la app, **entonces** el mundo no ha avanzado ningún paso.
- **Dado** una jugadora que vuelve tras tres meses sin salir y otra que vuelve tras tres días, **cuando** las dos han andado los mismos metros, **entonces** el contador de las dos está en el mismo valor.
- **Dado** el motor de pasos, **cuando** se busca en su superficie pública una operación que reciba una fecha, un intervalo o un número de días, **entonces** no existe.
- **Dado** la apertura de la app, **cuando** no llega ningún metro de ninguna de las dos fuentes, **entonces** no se ejecuta ningún paso.
- **Dado** una partida guardada hace un año, **cuando** se carga, **entonces** el contador es el mismo con el que se guardó.
- **Dado** un paso ejecutado, **cuando** se inspecciona lo que queda registrado de él, **entonces** no lleva ninguna marca de tiempo del reloj real.

### Un paso solo añade

- **Dado** un mundo en el paso 40, **cuando** se ejecutan diez pasos sin que la jugadora actúe, **entonces** no ha caducado ninguna aventura.
- **Dado** el mismo caso, **cuando** se revisan los NPCs, **entonces** no se ha retirado ninguno.
- **Dado** el mismo caso, **cuando** se revisan los rangos por núcleo, **entonces** ninguno ha bajado.
- **Dado** el mismo caso, **cuando** se revisan el oro, los objetos y el diario, **entonces** nada se ha restado, retirado ni borrado.
- **Dado** el catálogo de tipos de efecto que un paso puede producir, **cuando** se enumera, **entonces** es cerrado y todos sus tipos añaden: ninguno quita, baja, caduca ni retira nada.
- **Dado** un productor de paso que devuelve un efecto de un tipo que no está en el catálogo, **cuando** se ejecuta el paso, **entonces** falla nombrando el tipo, en lugar de aplicarlo.
- **Dado** un productor de paso que devuelve un efecto que resta, **cuando** se ejecuta el paso, **entonces** se rechaza nombrando el efecto y el estado de la partida no cambia.
- **Dado** un paso que falla al aplicarse, **cuando** se lee el contador, **entonces** no ha avanzado: un paso se aplica entero o no se aplica.
- **Dado** un paso, **cuando** se busca si puede aplicar una consecuencia de un acto de la jugadora, **entonces** sí puede, y esa consecuencia puede ser mala: la regla protege contra penalizar la ausencia, no contra propagar lo que se hizo.

### Un contador por mapa

- **Dado** una partida con dos mapas, **cuando** se leen sus contadores, **entonces** cada mapa tiene el suyo.
- **Dado** una jugadora que pasa tres semanas andando en otro mapa, **cuando** vuelve a casa, **entonces** el mundo de casa ha avanzado solo con los kilómetros que ella anduvo allí.
- **Dado** metros andados con un mapa activo, **cuando** se convierten en pasos, **entonces** avanza el contador de ese mapa y ningún otro.
- **Dado** kilómetros de fondo, **cuando** se convierten en pasos, **entonces** avanza el contador del mapa activo y la reserva es la de ese mapa.
- **Dado** metros andados sin ningún mapa activo, **cuando** se convierten en pasos, **entonces** falla nombrando el mapa que falta, en lugar de avanzar un contador por defecto.
- **Dado** un mapa nuevo levantado en otro sitio, **cuando** se lee su contador, **entonces** marca cero.

### Capa sobre el mundo, nunca fase de la tubería

- **Dado** un mundo congelado y su documento, **cuando** se ejecutan cincuenta pasos, **entonces** el documento de cada celda sigue idéntico byte a byte.
- **Dado** el módulo del motor, **cuando** se inspeccionan sus imports, **entonces** no importa `buildWorld` ni ninguna fase de la generación.
- **Dado** la tubería de generación, **cuando** se enumeran sus fases, **entonces** el paso del mundo no es una de ellas.
- **Dado** un mundo que ha avanzado cincuenta pasos, **cuando** se vuelve a generar la celda con la misma semilla y los mismos datos de OSM, **entonces** sale idéntica: los pasos no entran en la generación.
- **Dado** un paso ejecutado, **cuando** se inspecciona lo que ha escrito, **entonces** escribe solo en el estado de la partida y nunca en el mundo congelado.
- **Dado** el motor sin ningún productor inyectado, **cuando** se ejecutan diez pasos, **entonces** el contador avanza diez y no ocurre nada más, sin error.
- **Dado** dos productores inyectados, **cuando** se ejecuta un paso, **entonces** los dos se invocan en un orden declarado y estable, con el número del paso y su azar.
- **Dado** el mismo paso ejecutado dos veces desde el mismo estado, **cuando** se comparan los efectos producidos, **entonces** son idénticos y en el mismo orden.
- **Dado** un productor que consume azar, **cuando** se ejecuta el paso, **entonces** recibe un azar derivado del suyo propio, de modo que añadir un productor no desplaza el azar de los demás.
- **Dado** el motor de pasos, **cuando** se inspecciona su superficie pública, **entonces** no exporta ningún texto destinado a mostrarse dentro del juego.
- **Dado** el motor de pasos, **cuando** se busca dónde expone el valor del contador, **entonces** ninguna consulta del núcleo lo devuelve a una capa de presentación.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/pasos.js` | el contador por mapa, la semilla de cada paso, la ejecución de N pasos consecutivos y el registro de productores |
| `packages/nucleo/partida/kilometros.js` | las dos fuentes de metros, el resto pendiente, la conversión a pasos con el tramo, y la reserva con su tope |
| `packages/nucleo/partida/efectos.js` | el catálogo cerrado de tipos de efecto que un paso puede producir, todos aditivos, y su validación |

Las tres viven en `partida/` porque el contador, el resto y la reserva son estado de la jugadora, no del mundo: SPEC-009 ya establece que el documento congelado describe el mundo y nada más, y que no crece al andar.

### Frontera de inyección

Tres entradas nuevas, y ninguna sensor:

- **Los metros de una salida, ya clasificados segmento a segmento** en andando, parada, vehículo o ambigua, exactamente en la misma forma en que los recibe la medición del ritmo de SPEC-004. El núcleo no mira el GPS ni decide qué es un vehículo. La **asimetría de la duda se lee del módulo de SPEC-004 y no se reimplementa aquí**: medir el tramo excluye lo ambiguo, contar kilómetros y validar geofences cuentan en la duda. Que esa regla esté escrita en un solo sitio es la razón por la que SPEC-004 la puso donde la puso.
- **Los metros de fondo**, un número entregado al abrir la app por quien haya leído la app de salud. El núcleo no sabe qué es un permiso de salud ni pide nada: recibe metros y el dato de si el modo está activo. Quién los lee, con qué permiso y con qué interruptor es de la fila 42.
- **Los productores de paso**, inyectados por quien construye la partida. Un productor recibe el número del paso y su azar, y devuelve una lista de efectos del catálogo cerrado. La propagación de rumores (fila 12) y la cola de oportunidades (fila 19) son los dos primeros; sin ninguno, el motor sigue funcionando entero, que es como corre en `node --test`.

Y una salida que ya existe y esta spec honra: SPEC-001 dejó el **reloj de mundo** de las pruebas con el motor inyectado y el contrato «avanza N pasos, numerados desde el actual». El motor que entrega esta spec encaja en ese contrato sin cambiarlo.

### Qué es un paso y qué no

Un paso es **un tramo andado**, y el tramo es personal: `quests.md` decisión 4 lo ata a la misma unidad que dimensiona los beats. Por eso la conversión no divide entre 2 000 m sino entre el tramo de quien anda, y por eso «Avanza igual quien anda 6 km y quien anda 900 m» es afirmable aquí y no solo en la progresión.

Los pasos son **indivisibles**: no hay medio paso. Los metros que no completan uno quedan como resto, en metros, y se guardan con la partida. Se guardan porque descartarlos al cerrar cada salida castigaría a quien sale muchas veces y poco rato, que es exactamente el perfil que `accesibilidad.md` protege; y se guardan en metros, no en fracción de tramo, para que un cambio del tramo estimado no reescale hacia atrás nada.

Un paso **se ejecuta cuando se completa**, durante la caminata, no al echar el telón. No es un detalle de eficiencia: «El jugador se puede adelantar a su propia fama» solo es cierto si el rumor avanza mientras ella anda.

### La reserva, el tope de cinco y qué se pierde

La reserva existe **solo** para la fuente de fondo. Los pasos de una salida activa se gastan según se generan y no necesitan techo, porque la jugadora está delante viéndolos ocurrir.

El tope es cinco, y `quests.md` decisión 4 dice de dónde sale: **lo que cabe en un resumen legible**, no lo que se puede simular. Con la reserva llena, los kilómetros de fondo extra **no generan pasos y no dejan deuda**: el contador no salta, no se apunta nada para ejecutar después, y ni siquiera queda resto. Volver tras tres meses equivale a volver tras tres días, que es la promesa entera.

Que la reserva se desborde **no le quita nada a nadie**, y conviene tenerlo presente al leer el código: un paso es tiempo del mundo, no una recompensa de la jugadora. No hay ninguna compensación que dar, ningún aviso que enseñar y ninguna cifra que mostrar.

Los pasos de la reserva son pasos normales: se ejecutan de verdad, con su número correlativo y su azar, en el momento en que los metros de fondo llegan. Lo que la reserva guarda es **lo que queda por narrar**, y se vacía al leerse. Redactar ese resumen, decidir si la pantalla aparece y con qué palabras es de la fila 42.

### La frontera con las filas 12, 19 y 42

RF-RUMOR-002 aparece en dos filas del checklist, y el reparto es este:

| Aquí, fila 11 | Fila 42, `pasos-fondo-zurron` |
| --- | --- |
| la reserva como mecanismo: tope, descarte, orden, vaciado | el interruptor de los ajustes, apagado de origen |
| el dato de si el modo está activo, recibido | el permiso de salud y su petición en contexto |
| convertir metros de fondo en pasos | leer los metros de la app de salud al abrir |
| entregar los pasos sin narrar en orden | la pantalla `A2P2` y la redacción del resumen |

Con las filas 12 y 19 la frontera es más simple todavía: **aquí se decide cuándo ocurre un paso y con qué azar; allí se decide qué ocurre en él**. El motor no sabe qué es un rumor.

### El vehículo, consumido resuelto

RF-BUCLE-015 dice que a velocidad de vehículo el motor de pasos no cuenta, y que en la duda se cuenta. Esta spec **declara la frontera y consume la regla**: la clasificación la entrega la fila 31 y la asimetría la expone el módulo de SPEC-004. Lo que aquí se afirma es la consecuencia sobre el contador —un viaje en tren no lo mueve, 800 m ambiguos sí—, y eso es afirmable en `@nucleo` dada una traza ya clasificada. La parte que necesita un simulador con GPS es `@app` y sigue siendo de la fila 31.

Queda abierto, y no lo cierra esta spec: la bici y la silla eléctrica son el pendiente 2 de §7 del PRD, y arrastran justo a este motor. El supuesto de trabajo del PRD —vehículo solo las velocidades inequívocas de motor— es el que esta entrega asume.

### Escenarios de `docs/testing.md` que respaldan esta spec

Se referencian por su nombre literal; no se implementan aquí, son de `wa-qa-dev`.

- **«El mundo avanza con los kilómetros del jugador, no con el calendario»** (`@nucleo @rumores`), que es la característica de esta spec entera → «Un tramo andado es un paso del mundo», «El contenido de un paso lo decide su número», «Estar un mes sin salir no acumula mundo pendiente», «La reserva de pasos de fondo tiene tope de cinco», «Un paso solo añade».
- **«El vehículo se aparta del reloj del mundo y de la validación»** (`@app @accesibilidad`) → «Un viaje en tren no hace avanzar el mundo», «En la duda, cuenta» y «Volver a casa en autobús echa el telón igual», de los que aquí se sostiene la mitad `@nucleo`: dada una traza clasificada, qué metros cuentan para el contador. «La medición del tramo sí excluye la velocidad ambigua» es la otra cara y es de SPEC-004.
- **«No hay niveles, hay rango social por núcleo»** → «Avanza igual quien anda 6 km y quien anda 900 m», que aquí se afirma sobre el contador y no sobre el rango; y «El rango sube por lo que llega, no por lo que se pisa», que usa el motor como instrumento («cuando el mundo avanza veinte pasos») sin ser de esta fila.
- **«Una partida, muchos mapas, y ningún selector»** → «El mundo de casa no avanza en tu ausencia», que es lo que obliga a un contador por mapa.
- **«Lo generado no se resiembra jamás»** → los pasos son la prueba más fácil de romper de esa característica: el mundo congelado tiene que seguir idéntico byte a byte después de cincuenta pasos.
- **Frontera, que esta spec deja preparada y no implementa:** «Avanza un tramo por paso del mundo» y «Cruzar un tramo sin calzada real cuesta un nivel más» (fila 12); «El zurrón solo aparece si hay reserva que vaciar» y «Los pasos de fondo vienen apagados» (fila 42); «Un cierre en corto no genera rumor», que usa diez pasos como instrumento (fila 36).

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería, no de esta spec, y `wa-qa-dev` tendrá que cubrirlos como casos sin escenario de respaldo:

- **El resto de metros no tiene escenario.** «Un tramo andado es un paso del mundo» usa 6 km sobre un tramo de 2 km, que divide exacto. Nada dice qué pasa con 5 km, ni si el resto sobrevive al cierre de la salida, y es la decisión de esta spec con más consecuencias para quien sale poco rato.
- **Nada verifica que la reserva desbordada no deje deuda.** «La reserva de pasos de fondo tiene tope de cinco» afirma que el contador avanzó cinco y no doce, pero no que al vaciar la reserva los siete descartados no aparezcan.
- **Nada verifica el catálogo cerrado de efectos.** «Un paso solo añade» comprueba tres consecuencias concretas —aventuras, NPCs, rangos—, que es una lista abierta; la garantía estructural, que ningún tipo de efecto reste, no tiene escenario.
- **El contador por mapa solo tiene un escenario y es de otra característica.** «El mundo de casa no avanza en tu ausencia» es de `@app` en la práctica; que cada mapa lleve su contador y su reserva no está afirmado en ningún sitio.
- **Nada afirma que un paso se ejecuta durante la caminata.** «El jugador se puede adelantar a su propia fama» lo implica, pero es un escenario de la fila 12 y se puede pasar difiriendo los pasos si el rumor se recalcula al final.
- **Nada afirma que el motor no lee el reloj.** La prohibición general de `Date.now()` está en «El mundo es una función de la semilla y de los datos de OSM», que habla de la generación; el motor de pasos es capa y no fase, así que esa característica no lo cubre por su letra.

## Decisiones asumidas

- **La semilla de un paso se deriva con el mecanismo de fase de SPEC-003** → asumido: semilla de partida + identificador de mapa + sufijo `:tick:` + número de paso (alternativas: la concatenación literal `seed + ':tick:' + n` de `quests.md` decisión 4, o el `lat,lon#n` del escenario «El contenido de un paso lo decide su número»). Regla: SPEC-003 sustituyó el formato de semilla del prototipo precisamente porque `lat,lon#n` filtra la ubicación al compartirla; el sufijo `:tick:` se conserva literal, que es lo que la decisión de diseño fija de verdad, y el escenario de la batería seguirá pasando reexpresado sobre la semilla nueva.
- **El contador es por mapa, no por partida** → asumido (alternativa: uno solo para toda la partida). Regla: «El mundo de casa no avanza en tu ausencia» y RF-PERS-007 dicen que el mundo de casa avanza solo con lo andado allí; con un contador único, andar en el mapa nuevo movería el de casa.
- **El resto de metros que no completa un paso se conserva entre salidas** → asumido, guardado en metros con la partida (alternativas: descartarlo al cerrar cada salida, o guardarlo como fracción de tramo). Regla: `accesibilidad.md` §1 y el suelo de 250 m protegen a quien anda poco de una vez; descartar el resto haría que diez salidas cortas no movieran el mundo, y guardarlo como fracción haría que corregir el tramo reescribiera hacia atrás lo ya andado.
- **La conversión usa el tramo estimado congelado al abrir la salida** → asumido (alternativas: el declarado, o el estimado recalculado a cada muestra). Regla: SPEC-004 corrige el tramo al cerrar la salida con la medida de esa salida; usar el estimado vivo haría que la misma salida se convirtiera en un número de pasos distinto según cuándo se mire.
- **Con la reserva llena, los kilómetros de fondo se descartan enteros, sin dejar resto** → asumido (alternativas: ejecutar el paso y descartar solo su entrada de narración, o acumular el resto para cuando haya sitio). Regla: `quests.md` decisión 4 dice que el contador *n* no salta y que volver tras tres meses equivale a volver tras tres días; guardar el resto es exactamente acumular mundo pendiente por la puerta de atrás.
- **La reserva guarda pasos ya ejecutados pendientes de narrar** → asumido (alternativa: guardar pasos pendientes de ejecutar y ejecutarlos al abrir la salida). Regla: el escenario «La reserva de pasos de fondo tiene tope de cinco» exige que el contador haya avanzado cinco antes de que nadie abra nada; y ejecutarlos al abrir metería la propagación de rumores en el arranque de la salida, que es el momento con menos presupuesto de todos.
- **El tope de cinco vale para la reserva y no frena los pasos de la salida activa** → asumido (alternativa: un tope global de pasos por sesión). Regla: `quests.md` decisión 4 separa las dos fuentes explícitamente — los de salida activa «se gastan según se generan, no se almacenan, y no necesitan techo».
- **El catálogo de tipos de efecto es cerrado y solo aditivo, y un efecto que reste hace fallar el paso** → asumido (alternativa: confiar en que los productores se porten bien y dejar la regla como convención). Regla: «Un paso solo añade» es la protección contra penalizar la ausencia, que es un principio de diseño; una convención sin validación se rompe en la primera fila que cuelgue un productor nuevo, y aquí es barato hacerlo estructural.
- **La consecuencia de un acto de la jugadora sí puede ser mala y viaja igual** → asumido, y por eso la validación mira el tipo de efecto y no su signo narrativo (alternativa: prohibir todo efecto negativo). Regla: `quests.md` decisión 4 lo dice con todas las letras — la regla protege contra penalizar la ausencia, no contra propagar la consecuencia de un acto.
- **Un paso se aplica entero o no se aplica, y el contador no avanza si falla** → asumido (alternativa: avanzar el contador y registrar el fallo). Regla: la semilla de un paso depende de su número; avanzar con un paso a medias dejaría un número gastado sin contenido y haría irreproducible la partida.
- **Los productores se invocan en orden declarado y cada uno recibe un azar derivado del suyo** → asumido (alternativa: que todos consuman del mismo generador del paso). Regla: `CLAUDE.md`, un sufijo distinto por fase para que tocar una no desplace el azar de las demás; con un solo generador, añadir la cola de oportunidades cambiaría todos los rumores ya sembrados.
- **El motor no sabe qué es un rumor ni una oportunidad** → asumido: recibe productores inyectados y sin ninguno avanza igual (alternativa: que el motor llame directamente a la propagación de la fila 12). Regla: RF-RUMOR-001 dice «capa sobre el mundo generado»; si el motor importa la propagación, la fila 12 no se puede entregar ni probar sin él, y esta fila deja de ser el reloj para ser el mundo.
- **El dato de si los pasos de fondo están activos llega como estado de la partida** → asumido (alternativa: que el núcleo consulte el ajuste). Regla: `packages/nucleo/` no habla con la plataforma (RF-INFRA-001), y `seguridad-privacidad.md` §2 pone la lectura de la app de salud al abrir, fuera del núcleo.
- **El valor del contador no se expone a la capa de presentación** → asumido (alternativa: exponerlo y confiar en que nadie lo pinte). Regla: design system, «ninguna cifra de distancia, tiempo, ritmo, pasos ni porcentaje de progreso», y «ningún panel del estado del mundo»; lo que no sale del núcleo no se puede pintar por descuido.
- **La conversión de metros a pasos es indiferente al troceado de las muestras** → asumido: veinte muestras de 100 m y una de 2 000 m producen lo mismo (alternativa: convertir por muestra y perder el resto en cada una). Regla: es la única forma de que el resultado no dependa de la cadencia del GPS, que es un detalle de plataforma.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-010.
- **Sin `## UX Design` y sin comportamiento responsive** → asumido: esta spec no dibuja pantalla; el zurrón `A2P2` y el ajuste son de la fila 42 (alternativa: especificar aquí la pantalla). Regla: decisión 3 de `pipeline/decisiones-orquestador.md` y el design system, que prohíbe rediseñar una pantalla ya dibujada.
