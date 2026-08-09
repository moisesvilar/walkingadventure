# SPEC-031 — La detección de vehículo, y la asimetría por efecto

## Descripción

Coche, autobús, tren: **el vehículo se aparta**. A velocidad de vehículo el motor de pasos deja de contar y los geofences dejan de validar, hasta que la jugadora vuelve a moverse por su cuenta. Sin esto, un viaje en tren vacía el mundo de golpe, el dimensionado en tramos deja de significar nada y saltarían escenas desde la ventanilla de un autobús (`bucle-jugable.md` §9).

Lo que esta fila entrega no es la regla —la regla está decidida y escrita desde SPEC-004— sino **lo que la alimenta**: convertir una secuencia de posiciones en una traza segmentada y clasificada en andando, parada, vehículo o ambigua. Hasta hoy esa traza la fabricaban a mano las pruebas, con el GPS simulado declarando el modo de cada tramo; a partir de aquí la produce un clasificador, y **es la primera vez que los segmentos ambiguos existen porque alguien los ha deducido en lugar de porque alguien los ha escrito**.

Y por eso el corazón de la fila es la **asimetría por efecto**, que es lo que hay que poder poner rojo: con la misma traza y los mismos metros dudosos, **contar el reloj del mundo y validar una llegada cuentan en la duda, y medir el tramo no**. Son tres efectos distintos y no aguantan el mismo criterio; la asimetría sale del principio de `npcs.md` —lo que la jugadora no controla puede abrirle puertas, nunca cerrárselas—: un paso de más no le quita nada a nadie, y no contar los kilómetros de quien baja una cuesta larga en silla le borra su esfuerzo.

Anclas: **RF-INFRA-005** (`docs/prd.md` §4.13) y **RF-BUCLE-015** (§4.7). Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` §9, `game-design/accesibilidad.md` (decisión 4 y pendiente 1) y `game-design/arquitectura.md`. El **pendiente 2 de §7 del PRD** queda abierto y esta spec no lo cierra: la bici y la silla eléctrica siguen sin decidirse, y aquí se aplica el supuesto de trabajo declarado —**se trata como vehículo solo las velocidades inequívocas de motor, y en la duda cuenta**—, que es además lo que el **riesgo 5 del PRD §8** pide: no hay ningún marcador que proteger, así que no se aprieta la detección. Consume SPEC-004 (`ritmo.js`, donde vive la regla de la duda y el vocabulario de clasificaciones), SPEC-011 (el motor de pasos, que ya consume traza clasificada), SPEC-001 (el GPS simulado, que es el doble) y SPEC-030 (la fuente de posiciones de la salida). La fila 32 es el tercer consumidor y **no está en disco al escribir esta spec**.

**Esta spec no tiene interfaz.** No hay pantalla, no hay ajuste, no hay indicador y no hay ni una palabra visible: quien quiera recorrerse el juego en coche puede, las trampas aquí solo se las hace una a sí misma, y decir en pantalla que se ha detectado un vehículo sería a la vez un reproche y una acusación. Por eso no lleva sección de UX Design, y por eso lleva criterios que afirman que nada de esto aflora.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**, por un lado y solo por ese: la **fuente de posiciones** que estrenó SPEC-030 pasa a tener un consumidor más, y la traza clasificada que el detector produce se convierte en la entrada canónica de los tres efectos. Está descrito en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** **la regla de la duda por efecto**, que ya vive en `packages/nucleo/partida/ritmo.js` desde SPEC-004 y que aquí **se consume y no se reescribe**; **la medición del ritmo y la corrección del tramo** (SPEC-004); **la conversión de metros en pasos, la reserva y el contador** (SPEC-011); **la validación de llegadas y su secuencia** (fila 32); **el rótulo, el plazo y el cierre de la salida** (fila 30), que consumen la clasificación pero no la producen; **la bici y la silla eléctrica**, que son el pendiente 2 de §7 del PRD y se resuelven en `game-design/`, no en una spec; y **cualquier superficie visible**: no se añade ni un texto, ni un icono, ni un ajuste.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «De posiciones a traza clasificada» y «La asimetría por efecto»; la **validación de entradas** en la posición sin marca de tiempo, la secuencia desordenada y la precisión que no es un número; el **estado vacío** en la secuencia de una sola posición y en la traza sin ningún segmento; el **estado de error** en la fuente no cableada y en el detector ausente; y los **casos límite** en el pico de una sola muestra, el autobús parado en un semáforo, el hueco por app matada, la precisión mala en ciudad y la velocidad justo en cada umbral.

«Secuencia de referencia» significa una de las producidas por `test/dobles/gps-simulado.mjs` sobre las polilíneas de los mundos de referencia, con su modo **sin declarar**: el detector tiene que deducirlo, porque si la prueba declara el modo no está midiendo nada.

### De posiciones a traza clasificada

- **Dado** una secuencia de posiciones con marca de tiempo, **cuando** se clasifica, **entonces** se obtiene una traza de segmentos consecutivos, cada uno con sus metros, su duración y su clasificación.
- **Dado** la traza resultante, **cuando** se leen sus clasificaciones, **entonces** todas pertenecen al vocabulario que ya declara `ritmo.js`, y el detector no añade ningún valor nuevo.
- **Dado** la traza resultante, **cuando** se suman los metros de sus segmentos, **entonces** el total coincide con la distancia recorrida por la secuencia, salvo los metros de los huecos, que no pertenecen a ningún segmento.
- **Dado** dos segmentos consecutivos, **cuando** se comparan, **entonces** tienen clasificaciones distintas: un cambio de segmento significa siempre un cambio de clasificación.
- **Dado** la misma secuencia clasificada dos veces, **cuando** se comparan las dos trazas, **entonces** son idénticas.
- **Dado** la misma secuencia entregada de una vez o troceada en lotes, **cuando** se clasifica, **entonces** la traza resultante es la misma.
- **Dado** el detector, **cuando** se inspecciona su código, **entonces** no lee el reloj del sistema, no usa ninguna fuente de azar y no importa nada de React Native.
- **Dado** una secuencia con una sola posición, **cuando** se clasifica, **entonces** se obtiene una traza vacía, y no un error.
- **Dado** una secuencia vacía, **cuando** se clasifica, **entonces** se obtiene una traza vacía.
- **Dado** una posición sin marca de tiempo, o con una marca anterior a la anterior, **cuando** se clasifica, **entonces** falla nombrando la posición, en lugar de reordenarla.
- **Dado** una posición cuya latitud o longitud no es un número finito, **cuando** se clasifica, **entonces** falla nombrando lo recibido.

### Vehículo solo cuando es inequívoco

- **Dado** una secuencia sostenida por encima del umbral de vehículo durante más del tiempo de confirmación, **cuando** se clasifica, **entonces** esos segmentos son de vehículo.
- **Dado** una secuencia sostenida por encima del umbral de vehículo durante **menos** del tiempo de confirmación, **cuando** se clasifica, **entonces** ningún segmento es de vehículo.
- **Dado** una secuencia andando con **una sola** muestra que salta por encima del umbral de vehículo, **cuando** se clasifica, **entonces** ningún segmento es de vehículo.
- **Dado** una secuencia a velocidad de bicicleta sostenida, **cuando** se clasifica, **entonces** sus segmentos son ambiguos y no de vehículo.
- **Dado** una secuencia por debajo del umbral de andar, **cuando** se clasifica, **entonces** sus segmentos son de andando o de parada, y ninguno ambiguo.
- **Dado** una secuencia a la velocidad exacta de cada uno de los dos umbrales, **cuando** se clasifica, **entonces** el resultado es el declarado por esta spec para el borde, y está escrito y no depende de la comparación que se use.
- **Dado** un autobús clasificado como vehículo que se para en un semáforo un minuto, **cuando** se clasifica, **entonces** sigue en vehículo: salir de vehículo exige el tiempo de salida por debajo del umbral de andar, y no una parada cualquiera.
- **Dado** ese mismo autobús del que la jugadora se baja y echa a andar, **cuando** transcurre el tiempo de salida, **entonces** los segmentos vuelven a ser de andando.
- **Dado** los dos umbrales y los dos tiempos, **cuando** se busca de dónde salen, **entonces** son cuatro constantes declaradas en un solo sitio y con su justificación escrita.
- **Dado** una posición cuya precisión es peor que la precisión máxima fiable, **cuando** se clasifica el tramo que la contiene, **entonces** no puede ser de vehículo: cae a ambigua.
- **Dado** una secuencia entera con precisión mala, **cuando** se clasifica, **entonces** ningún segmento es de vehículo.
- **Dado** una posición sin dato de precisión, **cuando** se clasifica, **entonces** se trata como precisión desconocida y tampoco funda una clasificación de vehículo.

### Los huecos no fabrican kilómetros

- **Dado** una secuencia con un hueco mayor que el hueco máximo entre dos posiciones consecutivas, **cuando** se clasifica, **entonces** la traza se parte en ese punto y los metros del salto no pertenecen a ningún segmento.
- **Dado** esa misma traza, **cuando** se cuentan sus metros para el motor de pasos, **entonces** los del salto no cuentan.
- **Dado** una jugadora que cierra la app en una estación, viaja 30 km en tren y la vuelve a abrir, **cuando** se clasifica la secuencia, **entonces** el mundo no avanza ningún paso por ese salto.
- **Dado** ese mismo salto, **cuando** se mira si se clasificó como vehículo, **entonces** no se clasificó de ninguna manera: no existe como segmento.
- **Dado** un hueco menor que el hueco máximo, **cuando** se clasifica, **entonces** sí produce segmento y se clasifica por su velocidad como cualquier otro.
- **Dado** el hueco máximo, **cuando** se busca de dónde sale, **entonces** es una constante declarada con su justificación.

### La asimetría por efecto

- **Dado** una secuencia de referencia que produce al menos un segmento ambiguo, **cuando** se pregunta a los tres efectos por esos metros, **entonces** cuentan para el motor de pasos, validan una llegada y **no** entran en la medida del tramo.
- **Dado** esa misma traza, **cuando** se comparan las tres respuestas, **entonces** la de la medición del tramo es la contraria a las otras dos, y las tres salen del mismo módulo de SPEC-004.
- **Dado** el módulo del detector, **cuando** se inspecciona su código, **entonces** no declara ninguna regla por efecto y no contiene la palabra que nombra a ninguno de los tres: la asimetría se consulta, no se copia.
- **Dado** una secuencia de referencia con un tramo de vehículo, **cuando** se cuentan sus metros para el motor de pasos, **entonces** no cuentan.
- **Dado** esa misma secuencia, **cuando** se mide el ritmo para corregir el tramo, **entonces** esos metros no entran en la media.
- **Dado** esa misma secuencia, **cuando** se atraviesa el geofence de un beat durante el tramo de vehículo, **entonces** el beat sigue sin validar.
- **Dado** una secuencia de referencia entera a velocidad de vehículo, **cuando** se cuentan sus metros para el motor, **entonces** el total es cero y no un error.
- **Dado** una secuencia de referencia entera a velocidad de vehículo, **cuando** se mide el ritmo, **entonces** la salida no aporta medida y no se registra como salida medida.
- **Dado** una salida cuya traza mezcla andando, parada, ambigua y vehículo, **cuando** se reparten sus metros entre los tres efectos, **entonces** los tres repartos son distintos entre sí.

### Nada degrada por falta de cableado

- **Dado** la fuente de posiciones no cableada, **cuando** alguien pide la traza de una salida, **entonces** falla nombrando la fuente que falta, en lugar de devolver una traza vacía.
- **Dado** el detector no cableado, **cuando** el motor de pasos pide los metros que cuentan, **entonces** falla nombrando el detector, en lugar de recibir una traza con todo clasificado como andando.
- **Dado** una traza con un segmento sin clasificar, **cuando** llega a cualquiera de los tres efectos, **entonces** falla nombrando el segmento, tal y como ya hacen SPEC-004 y SPEC-011.
- **Dado** una traza producida por el detector, **cuando** se comprueba, **entonces** ningún segmento sale sin clasificar: el detector no delega en nadie la decisión de qué es un segmento.
- **Dado** el detector devolviendo una traza, **cuando** se busca si algún segmento tiene metros negativos o duración negativa, **entonces** no hay ninguno, y producirlo es un error y no un aviso.
- **Dado** los umbrales de conveniencia del GPS simulado, **cuando** se comparan con los de esta spec, **entonces** las pruebas que declaran el modo explícitamente siguen valiendo, y las que usan el atajo por velocidad quedan señaladas como medidas contra otros números.

### Nada de esto se ve

- **Dado** cualquier texto que el núcleo produce para mostrarse dentro del juego, **cuando** se buscan las palabras vehículo, coche, autobús, tren, velocidad o transporte, **entonces** no aparece ninguna.
- **Dado** la superficie pública del detector, **cuando** se inspecciona, **entonces** no exporta ningún texto destinado a mostrarse.
- **Dado** los ajustes del juego, **cuando** se enumeran, **entonces** no hay ninguno que active, desactive ni calibre la detección.
- **Dado** una jugadora cuya salida entera se clasificó como vehículo, **cuando** recorre todas las pantallas del juego, **entonces** ningún texto lo menciona ni se lo reprocha.
- **Dado** la clasificación de una traza, **cuando** se busca dónde se guarda, **entonces** no viaja con la partida más allá de lo que la salida en curso necesita, y no queda ningún historial de por dónde se fue ni en qué.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/transporte.js` | el detector: umbrales, tiempos de confirmación y de salida, precisión máxima fiable, hueco máximo, y la conversión de una secuencia de posiciones en traza segmentada y clasificada |
| `packages/nucleo/partida/ritmo.js` | **no se toca**: de ahí salen el vocabulario de clasificaciones y la regla de la duda por efecto, y esta fila las consume |
| `app/plataforma/posiciones.js` | la fuente de posiciones, que SPEC-030 estrena y que aquí gana un consumidor |

El detector vive en `packages/nucleo/` y no en `app/`, y es la decisión estructural de esta fila: la clasificación es una **regla de juego** con consecuencias sobre el reloj del mundo, no un detalle de sensor. En `app/` se queda solo lo que toca el sensor —abrir la fuente, entregar posiciones con su marca y su precisión—, y ni una línea de decisión.

### Frontera de inyección

**Una sola entrada, y ya existe**: la fuente de posiciones `{ lat, lon, tMs, precisionM }` que estrena SPEC-030. El detector no abre el GPS, no pide permisos, no tiene reloj y no consulta ninguna API de reconocimiento de actividad del sistema: recibe posiciones y devuelve una traza. El doble es `test/dobles/gps-simulado.mjs`, que ya produce exactamente esa forma y que ya declara que no lee el reloj del sistema.

Hacia fuera entrega **una sola cosa**: la traza clasificada, en la misma forma que SPEC-004 y SPEC-011 ya consumen. Ninguna de las dos cambia; lo que cambia es que a partir de aquí esa traza la produce alguien en lugar de escribirla la prueba.

### Los cinco números, y por qué estos

Ninguno sale de `game-design/`, que cierra el *qué* y deja abierto el *cuánto*; salen del supuesto de trabajo del PRD §7 punto 2 y de la asimetría. Los cinco están en un solo sitio y con su justificación al lado:

| Constante | Valor | Por qué |
| --- | --- | --- |
| umbral de andar | 6 km/h | por debajo es andar, y andar deprisa son 6; por encima ya no se puede afirmar que sea andar |
| umbral de vehículo | 25 km/h | «solo las velocidades inequívocas de motor»: una bicicleta sostiene 20 con soltura y una silla eléctrica va más despacio, así que 15 convertiría en vehículo justo los dos casos que siguen abiertos |
| tiempo de confirmación | 60 s por encima del umbral | un pico de GPS dura una muestra; un autobús dura minutos |
| tiempo de salida | 120 s por debajo del umbral de andar | un autobús parado en un semáforo no es bajarse del autobús |
| precisión máxima fiable | 30 m | por encima de eso el salto entre dos fijos puede ser del error y no del movimiento, y un salto de error a velocidad de coche es un falso vehículo |
| hueco máximo | 180 s entre dos posiciones | por encima, la velocidad media entre los dos fijos no describe nada de lo que pasó en medio |

Los dos tiempos son **asimétricos a propósito**, y esa asimetría es la misma de siempre: entrar en vehículo es caro —deja de contar el mundo y dejan de validar las llegadas—, así que se entra despacio y se sale igual de despacio para no oscilar. Y los bordes se declaran cerrados por abajo: exactamente 6 km/h es andando, exactamente 25 km/h es vehículo, porque un criterio que depende de si la comparación lleva el igual no es un criterio.

**El hueco no se clasifica, se corta.** Es la decisión menos obvia de la fila y la que más consecuencias tiene: si un salto de 30 km en veinte minutos se clasificara como vehículo, estaría bien; pero si el detector dudara y lo dejara ambiguo, la regla de la duda lo haría contar y un viaje en tren con la app cerrada movería el mundo treinta veces. La única respuesta honesta es que **esos metros no le pertenecen a nadie**: no existen para el motor, no existen para el tramo y no existen para las llegadas. Y así no hay que añadir ningún valor al vocabulario cerrado de clasificaciones, que es de SPEC-004 y no se reabre.

### El reconocimiento de actividad del sistema, y por qué no se usa

iOS y Android traen cada uno su API para adivinar si vas andando, en bici o en coche. No se consumen, y no es por pereza:

- **Divergen entre plataformas** en categorías, en latencia y en fiabilidad, así que la regla del juego dejaría de ser la misma en los dos sitios y el reparto entre lo afirmable en Node y lo comprobable en dispositivo se rompería justo por donde el riesgo 4 ya avisa.
- **No se pueden poner rojas en `node --test`.** Una regla que solo se puede medir en un dispositivo no es una regla de este proyecto: la red de seguridad de determinismo es la suite headless.
- **No hace falta apretar.** El riesgo 5 del PRD lo dice entero: la detección puede fallar en los dos sentidos, no hay ningún marcador que proteger y las trampas aquí solo se las hace una a sí misma.

Queda como puerta abierta y anotada: el día que la bici y la silla eléctrica se decidan en `game-design/`, la fuente de la plataforma podría entrar **como pista** —un dato más de la posición, nunca como decisión— sin mover el detector de sitio.

### Lo que consume de otras specs y no respecifica

- **SPEC-004** entrega `CLASIFICACIONES`, `REGLA_DE_LA_DUDA`, `entraEnLaMedidaDelTramo`, `cuentaParaElMotorDePasos` y `validaLlegadaPorGeofence`. **Nada de eso se reabre**, y hay un criterio que afirma que el detector no las copia. Que la asimetría esté escrita en un solo sitio es la razón por la que SPEC-004 la puso donde la puso.
- **SPEC-011** entrega el motor de pasos, que ya declara que no clasifica velocidades por su cuenta y que falla ante un segmento sin clasificar. Esta fila es quien le da lo que pedía; su contrato no cambia.
- **SPEC-001** entrega el GPS simulado con paradas y con tramos a velocidad de vehículo, y declara explícitamente que sus umbrales son «de conveniencia, NO una decisión de diseño» y que «el detector real llegará con su propia spec y sus propios umbrales». Esta es esa spec. Las pruebas que declaran `modo` siguen valiendo tal cual; las que usan el atajo por `velocidadKmH` miden contra los números del doble y no contra los de aquí, y eso queda anotado como hueco.
- **SPEC-030** entrega la fuente de posiciones y el ciclo de vida de la salida. El detector no sabe si hay salida abierta: recibe posiciones.
- **La fila 32** es el tercer consumidor de la asimetría y **no está en disco al escribir esta spec**. De ella aquí solo se afirma la consecuencia sobre la validación, con la regla leída de `ritmo.js`; si la fila 32 nombra su entrada de otra manera, manda ella.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Ninguno se implementa aquí —son de `wa-qa-dev`—, pero los criterios están escritos para cubrirlos sin inventar casos. Por nombre literal:

- De **«El vehículo se aparta del reloj del mundo y de la validación»** (`@app @accesibilidad`): «Un viaje en tren no hace avanzar el mundo», «Pasar en coche por delante de un beat no lo valida», «En la duda, cuenta» y «La medición del tramo sí excluye la velocidad ambigua». Los cuatro pasan aquí de `@app` a **afirmables en `@nucleo`**, y ese es el entregable escondido de esta fila: hasta hoy la traza clasificada la escribía la prueba, así que los cuatro escenarios se probaban a sí mismos; con el detector dentro, la clasificación es lo que se está midiendo.
- De **«El tramo es una unidad personal y se corrige midiendo»** (`@nucleo @accesibilidad`): «Las paradas no cuentan para medir el ritmo», que aquí gana su otra mitad: que una parada se detecte y no se declare.
- De **«El mundo avanza con los kilómetros del jugador, no con el calendario»** (`@nucleo @rumores`): «Un tramo andado es un paso del mundo», sobre una traza deducida en lugar de escrita.

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería y no de esta spec:

- **Ningún escenario clasifica nada.** Los cuatro de la característica del vehículo empiezan por «Dado un jugador cuya velocidad es ambigua», o sea, dan por resuelto justo lo que esta fila entrega. Hace falta al menos uno que parta de una secuencia de posiciones.
- **Nada afirma la histéresis.** Ni el pico de una muestra, ni el autobús parado en el semáforo, ni la salida del vehículo, y son los tres casos donde una implementación ingenua oscila.
- **Nada afirma qué pasa con un hueco en la traza.** Es el caso que más kilómetros falsos puede meter en el mundo y no está escrito en ningún sitio.
- **Nada afirma que la precisión mala no funde un vehículo.** En ciudad densa es el falso positivo más habitual y su consecuencia —dejar de contar y dejar de validar— es exactamente la que la asimetría existe para evitar.
- **Nada afirma que la bici no es un vehículo.** Es el supuesto de trabajo declarado del PRD y no tiene escenario; sin él, subir el umbral o bajarlo no rompe nada.
- **RF-INFRA-005 tiene escenario pero no característica propia.** Vive prestado dentro de la característica del vehículo, que es `@app`; con el detector en el núcleo, la mayor parte pasa a ser `@nucleo` y conviene que la batería lo refleje. Lo decide quien orquesta.

## Decisiones asumidas

- **El detector vive en el paquete compartido y no en la capa de plataforma** → asumido (alternativa: clasificar en `app/` y entregar la traza ya hecha al núcleo). Regla: `arquitectura.md` §2, toda la entrada y salida inyectada y toda la decisión dentro; la clasificación decide si el mundo avanza, que es regla de juego. Y §6h de `pipeline/decisiones-orquestador.md`: una regla que solo corre en un dispositivo es una regla que no se puede poner roja. Lo que la fila entrega sigue siendo, en el sentido del PRD, una capa de plataforma inyectada: la plataforma entrega las posiciones y no decide nada.
- **Umbral de vehículo en 25 km/h** → asumido (alternativas: 15 km/h, el del doble del andamiaje; o 30 km/h). Regla: PRD §7 punto 2, «vehículo solo las velocidades inequívocas de motor»; a 15 km/h una bicicleta y una silla eléctrica entrarían en vehículo, y las dos son justo el pendiente que sigue abierto.
- **Umbral de andar en 6 km/h** → asumido (alternativa: 5 km/h). Regla: es el mismo que ya usa el GPS simulado, y por encima de 6 no se puede afirmar que sea andar; el techo del tramo de SPEC-004 está calibrado sobre esa misma idea (8 km/h sostenidos ya no es andar).
- **Confirmación de 60 s para entrar en vehículo y 120 s por debajo del umbral de andar para salir** → asumido (alternativa: un solo tiempo simétrico). Regla: la asimetría del proyecto; entrar en vehículo quita —deja de contar y deja de validar— y salir devuelve, así que se entra despacio y se sale despacio para no oscilar en cada semáforo.
- **Precisión máxima fiable de 30 m para poder clasificar vehículo** → asumido (alternativas: no mirar la precisión, o descartar las posiciones malas). Regla: `npcs.md` vía `bucle-jugable.md` §9, lo que no se controla no puede cerrar puertas; descartarlas perdería metros que sí se anduvieron, y no mirarlas convierte el error del GPS en un coche.
- **Hueco máximo de 180 s, y el hueco corta la traza en lugar de clasificarse** → asumido (alternativas: clasificar el salto por su velocidad media, o clasificarlo siempre como vehículo). Regla: la regla de la duda haría contar un salto ambiguo, y un viaje en tren con la app cerrada movería el mundo; y clasificarlo como vehículo sería adivinar, que es lo que el riesgo 5 dice que no hace falta. Cortar es la única respuesta que no inventa metros ni los quita a quien sí anduvo.
- **Los bordes de los umbrales se declaran cerrados por abajo** → asumido: 6 km/h exactos es andando, 25 exactos es vehículo (alternativa: dejarlo al criterio de quien implemente). Regla: §6o, un criterio que no se puede poner rojo no mide nada, y un borde sin declarar es un criterio distinto en cada implementación.
- **No se consume el reconocimiento de actividad del sistema** → asumido (alternativa: usarlo como pista con más peso que la velocidad). Regla: riesgo 5 del PRD —no se aprieta la detección— y `arquitectura.md` §2: lo que no corre en Node no se puede afirmar.
- **La clasificación no se guarda como historial** → asumido: vive lo que dura la salida en curso (alternativa: guardar la traza clasificada con la partida). Regla: `seguridad-privacidad.md` §1 y el principio de que del móvil no sale nada; una traza guardada es un registro de por dónde se fue y en qué, que es exactamente lo que este proyecto no tiene.
