# SPEC-044 — La navegación en la calle: la máquina de una salida, y la parada que se mide de verdad

## Descripción

Esta fila cablea el camino que `docs/flujo.md` declara y que hoy no existe: **en marcha → entrar en el geofence de un sitio → la llegada → el visor → lo que allí se cuenta → el descarte → seguir andando**. Las pantallas están escritas desde las filas 32, 33 y 35 —`app/pantallas/llegada.js`, `visor.js`, `ficha.js`, `lo-que-se-cuenta.js`, `descarte.jsx`, `triangulacion.jsx`— y la capa del paquete lleva mil casos en verde desde SPEC-032. Lo que falta, y es lo único que falta, es que alguien las una: **`packages/nucleo/partida/llegadas.js` no lo llama nadie desde `app/`**, medido con grep, y sus seis pantallas están en la lista de `test/nucleo/pantallas-huerfanas.test.mjs`.

Y trae **el arreglo medido de `pipeline/decisiones-orquestador.md` §9**, que es lo que hace que esa máquina pueda funcionar en un teléfono. Montada la tubería real —el filtro de cadencia de `app/plataforma/posiciones.js`, el detector de `partida/transporte.js` y `creaLlegadas().comprueba()` alimentado posición a posición—, con alguien **parado 300 s dentro de un geofence** y 400 semillas por celda, **ninguna llegada validaba nunca**: 0 % con el fijo perfecto. Dos causas independientes, las dos confirmadas en la fuente. Una, que **parado no llega ninguna posición**: `distanceInterval: 10` es un filtro duro del `LocationRequest` de Android y con GPS perfecto entrega un fijo en cinco minutos. Otra, que **el ruido del GPS se lee como andar**: `esUnaParada` mide `metros / duracionS` sobre el salto crudo entre dos fijos, y un ruido de σ metros con fijos a T segundos aparenta ~1,4·σ/T m/s. Es la duodécima aparición de §6h y la más cara, porque la pieza que al no estar no protesta es **la capa entera**: SPEC-032 se escribió, se probó y se cerró sobre secuencias de posiciones fabricadas, y nadie la conectó nunca al sensor.

De ahí salen las dos cosas que esta fila cambia por debajo, con el número delante y con el dueño autorizándolas (§9b): **muestreo por tiempo mientras hay un geofence cerca**, y **detección de parada por deriva de ventana** —el centroide de la primera mitad de una ventana contra el de la segunda— en vez de fijo a fijo. Promediar hunde el ruido como 1/√n y deja intacta la deriva de quien anda, que es lo único que los separa. Los dos números y su límite salen de la tabla de §9c y **no se reinventan aquí**.

Y trae **RF-PRIV-004**: quien camina puede decir que un sitio no vale, con dos toques, sin motivo obligatorio, **reversible desde ajustes** y **sin resembrar** el mundo. El paquete lo entrega desde SPEC-035 (`packages/nucleo/partida/descartes.js`) y la capa A4P8 está dibujada; lo que falta, otra vez, es el camino.

Anclas que **esta fila entrega**: **RF-BUCLE-005** (`docs/prd.md` §4.7), **RF-BUCLE-007** (§4.7) y **RF-PRIV-004** (§4.11). Anclas que el checklist le asigna y que **no son suyas**: **RF-QUEST-004** y **RF-BUCLE-011**, que pasan a la fila 49 — está razonado en «Los dos RF que esta fila no entrega». Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` momento 3, §2 y §9, `game-design/quests.md` §3 y decisión 3, `game-design/seguridad-privacidad.md` §3, el artefacto `docs/pantallas/pantallas-4-al-parar.html` y los nudos **LLEGA**, **CIERRA** y **NUCLEO** de `docs/flujo.md`. Consume, sin rediseñarlo, lo entregado por **SPEC-030** (la salida abierta, el rótulo, el regreso), **SPEC-031** (la traza clasificada y la regla de la duda), **SPEC-032** (el geofence, la permanencia, la secuencia de una llegada y A4P5), **SPEC-033** (el visor y la ficha), **SPEC-035** (el descarte y la alarma de estirón), **SPEC-037** (la escena de la primera coincidencia), **SPEC-047** (la partida en disco) y **SPEC-048** (el módulo de ubicación, la única suscripción y la vida de una salida).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**, por tres sitios: la **precisión declarada del fijo** pasa a viajar hasta la capa de llegadas, el **índice de geofences del mapa activo** entra en el seguidor de la salida, y la **cadencia de la suscripción** deja de ser una constante para ser una respuesta del paquete. Está descrito en «Frontera de inyección».
- **Ninguna dependencia nueva.** Esta fila se monta sobre `expo-location` y `expo-task-manager`, que son las dos que autorizó el dueño en la fila 48. Si al implementar apareciera una tercera, **no se mete**: se para y se dice, con el nombre de la dependencia y de la pieza que la pedía.
- **Fuera de alcance — la escena de un beat (A4P3 y A4P4) y el telón (A5P1-A5P4)**, que son la **fila 49** con sus RF **RF-QUEST-004** y **RF-BUCLE-011**. El paso de beat de la secuencia se monta con **un hueco declarado de una sola acción**, el mismo patrón que `app/pantallas/llegada.js` ya trae escrito (`TEXTOS.sinPantalla`) y que `App.js` usa para el telón (`telon-sin-pantalla`). Un hueco no es una entrega: la fila 49 sustituye las dos pantallas y el hueco desaparece.
- **Fuera de alcance — la composición de las pantallas que esta fila monta.** El visor, la ficha, A4P5, la capa de descarte y la escena de la triangulación están dibujadas y no se rediseñan: aquí se decide **cuándo** aparecen y **qué las une**, nunca cómo se componen. Si al montarlas apareciera un defecto de composición, se arregla como defecto de la fila dueña y se anota, no se rehace la pantalla.
- **Fuera de alcance — la pantalla de ajustes y sus filas de valor** (fila 38, A6P6). De ella aquí solo se usa que ya existe la fila «Sitios que marcaste» y su lista: `app/pantallas/sitios-marcados.jsx` está escrita y `consulta-montado.jsx` ya lee `descartesDeMapa`. Lo que esta fila añade es **deshacer**, que es la mitad de RF-PRIV-004 que hoy no tiene camino.
- **Fuera de alcance — el zurrón y la fuente de salud** (fila 46), los **mapas múltiples y el ofrecimiento** (fila 41 y su nodo pendiente de diseño), y la **siembra de partida jugada en el dispositivo**, que quedó fichada en §6z y sigue sin dueño.
- **Fuera de alcance — el reloj de permanencia del regreso** (`packages/nucleo/partida/regreso.js`, 60 s), que es de SPEC-030 y no se toca. Lo que sí hace esta fila con él está en «La costura del reloj de permanencia».

## Criterios de aceptación

Van en `Dado / cuando / entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La máquina de una salida» y «La parada se valida»; la **validación de entradas** en la posición sin precisión declarada, el sitio que no es del mapa activo y el descarte de un anclaje que no existe; el **estado vacío** en la llegada sin nada esperando, el núcleo que no ha oído nada y la lista de sitios marcados vacía; el **estado de error** en el detector ausente, el reparto sin cablear y el seguidor sin índice de geofences; y los **casos límite** en el paseante a 4 y 5 km/h, el atasco dentro del geofence, el fijo de precisión mala, la vuelta del segundo plano y la app cerrada a mitad de secuencia.

Los criterios de **`@determinismo` y `@privacidad` son bloqueantes**: nada se entrega con uno en rojo.

Casi todo esto se afirma en `@nucleo` sobre secuencias de posiciones simuladas y los ocho extractos de `test/fixtures/mundos-referencia/`. Lo que necesita dispositivo está marcado como tal y es poco: que la pantalla no se encienda, que el camino se recorra con el dedo, y la cadencia real de la suscripción.

### La máquina de una salida en la app

- **Dado** una salida abierta y ninguna escena esperando, **cuando** se abre la app, **entonces** lo que se ve es el momento en marcha, y no ninguna pantalla del momento «al parar».
- **Dado** una salida abierta y una escena esperando, **cuando** se abre la app, **entonces** lo que se ve es la llegada por su paso vigente, y no el mapa.
- **Dado** una llegada validada, **cuando** se valida, **entonces** la app no se pone en primer plano, la pantalla no se enciende y no se emite ninguna notificación, ningún háptico ni ningún sonido. *(`@app` para lo visible; el resto es afirmable sobre `LO_QUE_UNA_LLEGADA_EMITE`.)*
- **Dado** una primera visita a un sitio con ilustración, **cuando** la llegada se ofrece, **entonces** el visor aparece encadenado y con el tirador en el borde de la ficción.
- **Dado** el visor abierto, **cuando** se cierra con la flecha o tocando fuera, **entonces** debajo queda el paso siguiente de la secuencia, ya montado, y no se vuelve a ninguna pantalla anterior.
- **Dado** una segunda visita a un sitio con ilustración, **cuando** la llegada se ofrece, **entonces** el visor **no se abre solo** y queda disponible con un toque.
- **Dado** una llegada a un paraje sin beat, **cuando** se recorre, **entonces** lo que se enseña es la ficha del sitio, y su acción de seguir devuelve al momento en marcha.
- **Dado** una llegada a un núcleo, **cuando** se recorre hasta el final, **entonces** el último paso encadenado es lo que allí se cuenta, y su «Seguir» devuelve al momento en marcha.
- **Dado** una llegada cuyo paso vigente es un beat, **cuando** se monta, **entonces** se enseña el hueco declarado con su única acción de seguir, **con el paso nombrado**, y no se salta el paso en silencio.
- **Dado** dos llegadas validadas a la vez, **cuando** se cierra la primera, **entonces** se ofrece la segunda sin pasar por el momento en marcha.
- **Dado** una llegada a medio recorrer, **cuando** se cierra la app y se vuelve a abrir, **entonces** la secuencia continúa por el paso donde iba y no vuelve a empezar.
- **Dado** una llegada cerrada, **cuando** se cierra, **entonces** la partida se congela, y lo que se levanta al abrir de nuevo trae la llegada cerrada.
- **Dado** la superficie de la máquina, **cuando** se busca una operación que lleve a un paso concreto de la secuencia, **entonces** no existe: la única manera de moverse es avanzar.
- **Dado** una llegada a un núcleo donde aflora por primera vez una segunda versión de algo ya apuntado, **cuando** se cierra ese paso, **entonces** se enseña la escena de la primera coincidencia encima, y su única acción devuelve al momento en marcha.
- **Dado** cualquier momento de la máquina, **cuando** se buscan controles tocables en el momento en marcha, **entonces** no hay ninguno: lo tocable empieza al parar.

### El muestreo mientras hay un geofence cerca

- **Dado** una salida abierta cuya última posición conocida no está dentro de ningún geofence, **cuando** se pide la cadencia de la suscripción, **entonces** es la de SPEC-048: por distancia, cada diez metros, y ninguna cadencia por tiempo.
- **Dado** una salida abierta cuya última posición conocida está dentro de algún geofence, **cuando** se pide la cadencia, **entonces** es por tiempo, cada cinco segundos.
- **Dado** una salida que se abre con quien juega ya parada dentro de un geofence, **cuando** se abre, **entonces** la cadencia por tiempo se decide con el punto de partida y no espera a un fijo que no va a llegar.
- **Dado** quien está dentro de un geofence y se aleja, **cuando** la última posición queda a más del radio más el margen de cercanía declarado, **entonces** la cadencia vuelve a ser por distancia.
- **Dado** una posición justo en el borde del geofence que entra y sale por el ruido del fijo, **cuando** se decide la cadencia, **entonces** no se cambia de cadencia en cada muestra: la histéresis del margen lo impide.
- **Dado** la decisión de cadencia, **cuando** se inspecciona dónde vive, **entonces** es una función del paquete sobre la última posición y los geofences del mapa activo, y la app solo la aplica.
- **Dado** la cadencia por tiempo activa, **cuando** se inspecciona lo que se guarda, **entonces** no se guarda ninguna posición más que antes: lo que sobrevive sigue siendo la última, sobrescrita. *(`@privacidad`, bloqueante.)*
- **Dado** la cadencia por tiempo activa, **cuando** se lee la línea del rótulo del sistema, **entonces** dice exactamente lo mismo que fuera del geofence: acercarse a un sitio no cambia lo que se lee en la pantalla de bloqueo. *(`@privacidad`, bloqueante.)*
- **Dado** una compilación de iOS, **cuando** se pide la cadencia por tiempo, **entonces** la limitación queda declarada con su motivo, y no se finge que se aplica. *(Hoy en iOS no se abre ninguna salida, por el rótulo; SPEC-048 §«iOS: lo que no se entrega».)*

### La parada, medida por deriva de ventana

- **Dado** una ventana de posiciones, **cuando** se decide si es una parada, **entonces** se compara el centroide de su primera mitad con el de la segunda, y no dos fijos consecutivos.
- **Dado** un fijo cuya precisión declarada sostiene la ventana corta, **cuando** se mide la parada, **entonces** la ventana es de veinte segundos y la deriva admitida son cinco metros.
- **Dado** un fijo cuya precisión declarada no sostiene la ventana corta, **cuando** se mide la parada, **entonces** la ventana es de cuarenta segundos y la deriva admitida son ocho metros.
- **Dado** una posición que llega sin precisión declarada, **cuando** se mide la parada, **entonces** se usa la ventana larga: en la duda sobre el error del fijo se exige más, no menos.
- **Dado** una ventana que todavía no cubre su duración, **cuando** se pregunta si es una parada, **entonces** la respuesta es que no, y no se extrapola.
- **Dado** la app que vuelve del segundo plano y vuelve a anclar la traza, **cuando** se pregunta por la parada, **entonces** la ventana empieza de cero y la permanencia se cuenta desde ahí, sin coser el hueco.
- **Dado** la regla de parada, **cuando** se busca dónde vive, **entonces** está en un solo módulo del paquete, el mismo del que la lee el motor de pasos, y no está reimplementada en la app.
- **Dado** la regla de parada por enlace de fijo a fijo, **cuando** se busca quién decide con ella la validación de un geofence, **entonces** no queda nadie.
- **Dado** la misma secuencia de posiciones dos veces, **cuando** se mide la parada, **entonces** el resultado es idéntico: no se lee el reloj del sistema ni ninguna fuente de azar. *(`@determinismo`, bloqueante.)*

### Las dos mitades del criterio, que se exigen a la vez

Las dos son obligatorias y **la segunda es la que se pierde sola en un arreglo de ruido**: un arreglo que hiciera validar al parado a cambio de validar al autobús parado no sería un arreglo.

- **Dado** quien se para dentro de un geofence el tiempo de permanencia, con la cadencia por tiempo activa y un fijo de error hasta diez metros, **cuando** se comprueba, **entonces** la llegada se valida.
- **Dado** quien atraviesa un geofence andando a cuatro kilómetros por hora sin pararse, **cuando** se comprueba, **entonces** la llegada **no** se valida.
- **Dado** quien atraviesa un geofence andando a cinco kilómetros por hora sin pararse, **cuando** se comprueba, **entonces** la llegada **no** se valida.
- **Dado** un vehículo detenido dentro de un geofence —un atasco—, **cuando** se comprueba **mientras la traza siga diciendo vehículo**, **entonces** la llegada **no** se valida, por mucho que la deriva sea cero.
- **Dado** ese mismo vehículo detenido, **cuando** pasan los `SALIDA_DE_VEHICULO_S = 120` quieto, **entonces** la traza deja de decir vehículo —SPEC-031 decide que quien juega se bajó— y la llegada **sí** valida, que es lo correcto: lo que hay dentro del geofence ya no es un coche parado.
- **Dado** una traza clasificada como vehículo, **cuando** se mide la parada, **entonces** la respuesta es que no es parada, sea cual sea la deriva de la ventana.
- **Dado** un error de fijo por encima del límite declarado, **cuando** se comprueba una llegada, **entonces** el límite está escrito con su número y no se disimula: por encima de σ ≈ 15 m la validación se degrada y por encima de σ ≈ 20 m deja de sostenerse.
- **Dado** una posición de precisión mala, **cuando** se comprueba, **entonces** **no** se descarta: sigue contando, porque las posiciones malas quitarían metros que sí se anduvieron, y lo que hacen es degradar a ambiguo, que valida.

### El descarte de un anclaje, que es RF-PRIV-004

- **Dado** la ficha de un sitio, **cuando** se toca «Este sitio no pega», **entonces** se abre la capa de A4P8 encima, con la ficha montada debajo.
- **Dado** la capa de descarte abierta, **cuando** se toca «Marcarlo», **entonces** el anclaje queda marcado y se vuelve a andar, sin diálogo de confirmación y sin línea de agradecimiento.
- **Dado** la capa de descarte abierta sin elegir motivo, **cuando** se toca «Marcarlo», **entonces** se marca igual.
- **Dado** la capa de descarte con un motivo elegido, **cuando** se cierra sin tocar «Marcarlo», **entonces** no se marca nada y la elección se descarta.
- **Dado** un anclaje marcado, **cuando** se compara el documento congelado del mapa antes y después, **entonces** es idéntico byte a byte: anotar no es resembrar. *(`@determinismo`, bloqueante.)*
- **Dado** un anclaje marcado, **cuando** se vuelve a castear, **entonces** ninguna aventura lo vuelve a usar, y el sitio conserva su nombre y su posición en el mapa.
- **Dado** un anclaje marcado, **cuando** se abre la lista de sitios marcados desde los ajustes, **entonces** aparece con su nombre de fantasía y qué es en realidad, y con su acción de deshacer.
- **Dado** un anclaje marcado, **cuando** se deshace desde los ajustes, **entonces** vuelve a estar disponible para el casting, y no hace falta volver a andar hasta allí.
- **Dado** ningún anclaje marcado, **cuando** se abre la lista, **entonces** dice que no hay ninguno y no finge una lista.
- **Dado** el descarte hecho y el deshecho, **cuando** se inspecciona el tráfico saliente, **entonces** no sale ninguna petición relacionada, ni al marcar ni al deshacer. *(`@privacidad`, bloqueante.)*
- **Dado** la capa de descarte, **cuando** se busca un campo de texto libre, **entonces** no existe ninguno, tampoco en «Otra cosa».
- **Dado** los descartes de una partida, **cuando** se descartan tantos anclajes que el mapa baja del suelo de parajes, **entonces** se ofrece el estirón con el mecanismo que ya entrega SPEC-035, y no se amplía nada solo.

### Las tres deudas heredadas de §8

- **Dado** una partida abierta por el camino normal, **cuando** se monta la vida de la salida, **entonces** el área de salidas que la orquestación muta es la misma que llegó: `descongelada` vale `false`.
- **Dado** un área de salidas congelada que llegara a la orquestación, **cuando** se monta, **entonces** `descongelada` vale `true` y eso se puede afirmar, porque lo que se abra no estaría en la partida que se congela.
- **Dado** el seguidor de una salida y una posición dentro del geofence de un sitio, **cuando** se lee, **entonces** su campo `sitio` es el nombre de ese sitio.
- **Dado** una posición dentro de dos geofences solapados, **cuando** se lee el seguidor, **entonces** `sitio` es el del más cercano.
- **Dado** una posición fuera de todos los geofences, **cuando** se lee el seguidor, **entonces** `sitio` es `null`, que es la respuesta honesta.
- **Dado** el seguidor de una salida montado sin el índice de geofences del mapa activo, **cuando** se monta, **entonces** **falla nombrando lo que falta**, en lugar de entregar `sitio: null` por construcción.
- **Dado** el código de la app, **cuando** se busca un camino que devuelva `sitio: null` sin haber consultado ningún geofence, **entonces** no queda ninguno.
- **Dado** `packages/nucleo/partida/`, **cuando** se enumeran sus constantes de permanencia, **entonces** ninguna se llama `PERMANENCIA_S`: cada reloj se nombra por lo que mide, para que la de la parada y la del regreso no se puedan confundir con un grep.
- **Dado** el reloj de permanencia del regreso, **cuando** se compara con el de la parada, **entonces** siguen siendo dos relojes distintos con dos asimetrías distintas, y esta fila no cambia el del regreso.

### Los dos RF que esta fila no entrega

- **Dado** el cierre de esta fila, **cuando** se enumeran los RF que entrega, **entonces** son **RF-BUCLE-005**, **RF-BUCLE-007** y **RF-PRIV-004**, y ningún otro.
- **Dado** el cierre de esta fila, **cuando** se busca la pantalla de la escena de un beat (A4P3, A4P4), **entonces** lo que hay es el hueco declarado, y **RF-QUEST-004** sigue pendiente en la fila 49.
- **Dado** el cierre de esta fila, **cuando** se busca la secuencia del telón (A5P1-A5P4), **entonces** lo que hay es el hueco que dejó la fila 48, y **RF-BUCLE-011** sigue pendiente en la fila 49.
- **Dado** el recuento de pantallas huérfanas de `test/nucleo/pantallas-huerfanas.test.mjs`, hoy en ocho, **cuando** se mide al terminar esta fila, **entonces** baja a **dos** —`sitios-marcados.jsx`, que es de la fila 38, y `zurron.jsx`, que es de la 46—; y **si sale más, se dice con el número delante y con el dueño de cada una escrito**.
- **Dado** la columna de flujos de límite declarado de `test/nucleo/limite-declarado.test.mjs`, hoy en ocho, **cuando** se mide al terminar esta fila, **entonces** baja a **cinco**, porque `llegada.yaml`, `visor.yaml` y `descarte.yaml` pasan a recorrer sus pantallas de verdad; y **si sale más, se dice con el número delante**.
- **Dado** un flujo que sale de la columna de límite declarado, **cuando** se mide su duración, **entonces** recorre pantallas de verdad: un flujo que tarda diez segundos no ha recorrido nada.

### Determinismo, frontera del núcleo y privacidad

- **Dado** `packages/nucleo/`, **cuando** se enumeran sus imports, **entonces** no aparece ni React Native ni ningún módulo de Expo. *(`@determinismo`, bloqueante.)*
- **Dado** el código de `packages/nucleo/`, **cuando** se busca `Math.random`, `Date.now` o `new Date`, **entonces** no hay ninguno: el tiempo del sensor viaja dentro de cada posición. *(`@determinismo`, bloqueante.)*
- **Dado** un clon limpio sin `node_modules`, **cuando** se ejecuta la batería de `@nucleo` enumerando sus ficheros, **entonces** arranca entera y pasa. *(Criterio duro, §6u.)*
- **Dado** la misma secuencia de posiciones inyectada dos veces sobre el mismo mundo, **cuando** se recorre una salida entera, **entonces** las llegadas validadas, sus secuencias y su orden salen idénticos. *(`@determinismo`, bloqueante.)*
- **Dado** una salida entera recorrida, **cuando** se inspecciona lo que la partida escribe, **entonces** no hay ninguna traza de ubicación: siguen siendo el punto de partida y las marcas que `AREA_SALIDAS` ya declara, y ni un campo más. *(`@privacidad`, bloqueante.)*
- **Dado** una llegada validada, **cuando** se congela, **entonces** lo que se guarda es el mapa, el sitio por su nombre, la secuencia y el paso: sin coordenadas y sin marcas de tiempo. *(`@privacidad`, bloqueante.)*
- **Dado** una salida entera con llegadas y descartes, **cuando** se inspecciona el tráfico saliente, **entonces** el anclaje real no entra en ninguna llamada de red y no hay ningún identificador persistente por instalación. *(`@privacidad`, bloqueante.)*
- **Dado** el paquete, **cuando** se busca quién resuelve el índice de geofences y la cadencia, **entonces** están en el paquete y llegan inyectados a la app, no al revés.

### Estados vacíos, errores y bordes

- **Dado** ninguna escena esperando, **cuando** se pide la llegada, **entonces** se responde que no hay nada esperando, sin fallar.
- **Dado** un núcleo que no ha oído nada, **cuando** se llega, **entonces** A4P5 se enseña igual, con su línea de que hoy no se cuenta nada por aquí, y ningún texto la llama error ni falta.
- **Dado** el detector de transporte ausente, **cuando** se comprueba una llegada, **entonces** falla nombrándolo, en lugar de validar suponiendo que se andaba.
- **Dado** una salida sin aventura aceptada, **cuando** se monta la capa de llegadas, **entonces** el reparto se declara vacío explícitamente y no se deja sin cablear.
- **Dado** el reparto, la cola, la capa de lo que se cuenta, las ilustraciones o el registro de sitios pisados sin cablear, **cuando** se monta la capa de llegadas, **entonces** falla nombrando la pieza que falta, en lugar de degradar en silencio.
- **Dado** un sitio que no pertenece al mapa activo, **cuando** se pide su geofence, **entonces** falla nombrando el mapa.
- **Dado** una posición con la marca de tiempo hacia atrás, **cuando** llega a la ventana de parada, **entonces** la ventana se vuelve a anclar en lugar de medir una duración negativa.
- **Dado** el sensor que deja de entregar posiciones a mitad de una salida, **cuando** se mira el momento en marcha, **entonces** se enseña la avería con su motivo del vocabulario cerrado, y no un mapa con la marca quieta.
- **Dado** una llegada validada a un sitio ya marcado como que no vale, **cuando** se recorre, **entonces** el sitio conserva su nombre y su posición y no produce beat, con el mecanismo de SPEC-035 y sin reimplementarlo.

## UX Design

### Wireframe textual

**Ninguna pantalla se dibuja de nuevo y ninguna se añade a `docs/pantallas/`.** Lo que esta fila entrega es el montaje y el encadenado de pantallas ya dibujadas. **Layout 1 — Estándar** en todas: superficie a sangre sobre el papel `#efe3c0`, sin barra de pestañas, sin cabecera de navegación y sin flecha de atrás entre pasos.

**La máquina, que es el entregable y no tiene pantalla propia.** Los nudos son los tres que `docs/flujo.md` ya declara:

```
  A3P1  el bolsillo  ─── entrar en el geofence y pararse ──▶  LLEGA
                                                                │
   ┌────────────────────────────────────────────────────────────┤
   │  primera vez y hay ilustración          ─▶ A4P1 el visor, ficción
   │        └─ arrastrar el tirador          ─▶ A4P2 el visor, arrastrado
   │              └─ cerrar (▾) · capa, no paso ─▶ CIERRA
   │  ya conocías el sitio                   ─▶ A4P6 la segunda vez (el visor queda a un toque)
   │  primera vez, sin ilustración           ─▶ A4P7 la ficha de texto
   └────────────────────────────────────────────────────────────┘
                                                                │
   CIERRA ─── hay beat, o cayó un micro-encuentro ──▶ A4P3 · A4P4   ·· fila 49: HUECO DECLARADO
          └── no has venido a nada, y es paraje ───▶ A4P7 la ficha
          └── no has venido a nada, y es núcleo ───▶ A4P5 lo que aquí se cuenta   ⚠ arista que faltaba en docs/flujo.md
                                                                │
   A4P4 ─── Seguir ──▶ NUCLEO ── sí ──▶ A4P5 ── Seguir ──▶ A3P1
                              └─ no ──▶ A3P1
   A4P5 ─── primera vez que oyes una segunda versión ──▶ A6P3 ── Apuntarlo ──▶ A3P1
   A4P7 ─── Seguir andando ──▶ A3P1
        └── Este sitio no pega ──▶ A4P8 ── Marcarlo ──▶ A3P1
                                        └─ dejarlo como está ──▶ A4P7
```

La arista marcada con ⚠ **no estaba en `docs/flujo.md` y hacía falta**: el dueño aprobó añadirla y ya está en el diagrama, junto con otras tres que destapó la guarda. Está contado en «El hueco de `docs/flujo.md`».

**El hueco del beat (A4P3, A4P4).** Cuando el paso vigente es un beat, se monta el hueco que `app/pantallas/llegada.js` ya sabe pintar, con **una sola acción**:

```
  ‹el paso nombrado: la escena de este sitio›
  Esto todavía no está dibujado.

  [ Seguir ]
```

Es el mismo patrón, palabra por palabra, con el que la fila 48 dejó alcanzable el telón (`telon-sin-pantalla` en `App.js`). Feo, honesto, y desaparece cuando llegue la fila 49. Lo que **no** se hace es saltarse el paso: un paso que se salta en silencio es exactamente §6h.

**A6P3, la primera vez que triangulas.** Modal, encima de A4P5, sin gesto de descarte y sin atrás; su única acción, «Apuntarlo», cierra el marcador y devuelve al momento en marcha. Su composición está entera en `app/pantallas/triangulacion.jsx` y aquí solo se monta donde el flujo dice.

**A4P8, el sitio que no pega.** Capa por encima de A4P7, no pantalla nueva: cerrarla devuelve la ficha con todo como estaba. Dos toques y ninguno más; el segundo es el que escribe.

**Los ajustes, deshacer.** Dentro de A6P6, la fila «Sitios que marcaste» con su número, la lista al abrirla y el deshacer de cada sitio. Sin motivo, sin fecha, sin agrupación y sin buscador. Registro de aplicación, como todo lo de ajustes.

**Y una ausencia que es la pieza:** en marcha no se añade ni un control, ni un aviso, ni una cifra. Acercarse a un geofence **no se pinta**: si se pintara, se convertiría en el medidor de progreso que `design-system.md` prohíbe, y en un motivo para mirar el móvil andando.

### Pantallas y elementos utilizados

```
Pantallas que esta fila monta y no compone:
  A4P1  pantalla 1 · artefacto 4 — El visor, lado de la ficción     app/pantallas/visor.js        (dueña: fila 33)
  A4P2  pantalla 2 · artefacto 4 — El visor, arrastrado             app/pantallas/visor.js        (dueña: fila 33)
  A4P5  pantalla 5 · artefacto 4 — Lo que aquí se cuenta            app/pantallas/lo-que-se-cuenta.js (dueña: fila 32)
  A4P6  pantalla 6 · artefacto 4 — La segunda vez                   (es una forma de la secuencia, no un fichero)
  A4P7  pantalla 7 · artefacto 4 — La ficha de texto                app/pantallas/ficha.js        (dueña: fila 33)
  A4P8  pantalla 8 · artefacto 4 — El sitio que no pega             app/pantallas/descarte.jsx    (dueña: fila 35)
  A6P3  pantalla 3 · artefacto 6 — La primera vez que triangulas    app/pantallas/triangulacion.jsx (dueña: fila 37)
  A6P6  pantalla 6 · artefacto 6 — Los ajustes                      app/pantallas/sitios-marcados.jsx (dueña: fila 38)

Pantallas que esta fila NO monta, y su hueco declarado:
  A4P3  pantalla 3 · artefacto 4 — La escena                        fila 49
  A4P4  pantalla 4 · artefacto 4 — Lo que te llevas                 fila 49
  A5P1-A5P4                      — El telón                         fila 49 (hueco ya puesto por la fila 48)

Elementos del proyecto que se usan: la voz del mundo en serif, la placa de rótulo, el
tirador del visor, la cartela del nombre real, y las marcas del sistema de diseño de
`app/pantallas/marca.js`. Ningún elemento del mapa: al parar, el mapa no está.

Elemento nuevo, y no es visible: la cadencia de la suscripción como respuesta del paquete
en lugar de constante. Se declara aquí porque es lo que hace que una llegada pueda validar.
```

`node scripts/verifica-flujo.mjs` tiene que seguir en verde: no se añade ni se quita ninguna pantalla de `docs/pantallas/`. Lo que sí cambia es el **conjunto de aristas** de `docs/flujo.md`, y eso es un cambio de diseño que se escaló y que el dueño aprobó antes de tocarlo; qué se añadió está en «El hueco de `docs/flujo.md`».

### data-testid

Los que `design-system.md` pide siempre son el **estado del momento** y el **mapa**; al parar el mapa no está, y su ausencia también se afirma. Casi todos existen ya en las pantallas escritas y **aquí no se inventan de nuevo**: se enumeran los que la máquina tiene que garantizar alcanzables, más los tres nuevos.

Ya existentes y que esta fila hace alcanzables: `llegada`, `momento-estado`, `llegada-estado`, `llegada-secuencia`, `llegada-paso`, `llegada-seguir`, `visor-a-un-toque`, `visor-abrir`, `visor-anclaje`, `visor-cerrar`, `visor-fuera`, `visor-tirador`, `visor-cartela`, `visor-lado-real`, `ficha-texto`, `ficha-descartar`, `lo-que-se-cuenta`, `lo-que-se-cuenta-de-ti`, `descarte-anclaje`, `descarte-motivo`, `descarte-confirmar`, `triangulacion-escena`, `sitios-marcados`, `sitio-marcado-deshacer`.

Nuevos, y los tres son marcas y no interfaz:

- `salida-sitio` — el nombre del sitio bajo la marca de posición, o el valor `sin-sitio` cuando no hay ninguno. Es lo que permite poner rojo el día que `sitio` vuelva a ser nulo por construcción.
- `salida-cadencia` — la cadencia vigente de la suscripción, con un vocabulario cerrado: `por-distancia`, `por-tiempo`. Es lo único que hace afirmable desde `@app` que el muestreo cambia al entrar en un geofence.
- `llegada-hueco` — el hueco del paso cuya pantalla es de la fila 49, para que su desaparición el día que llegue la 49 sea un acto con registro y no una limpieza silenciosa.

Las tres son marcas de 1×1 apartadas con `marcaSuperpuesta(n)`, como manda `app/pantallas/marca.js`: una marca de 0×0 no existe para la automatización, y seis apiladas en el mismo punto tampoco.

### Patrón de interacción

- **Abrir la app enseña lo que corresponde al sitio donde estás.** Regla: `game-design/bucle-jugable.md` §9 —«andando, el mapa; parada dentro de un geofence, la escena»—. Da igual por dónde se entre, porque quien decide qué hay es el estado y no la puerta. Es lo que convierte la máquina en un valor y no en una pila de navegación.
- **La secuencia se recorre entera y en orden, y no se navega.** Regla: `bucle-jugable.md` §2 y SPEC-032. No hay ruta a la que ir, así que no hay manera de llegar a A4P5 sin haber llegado al sitio. Esa ausencia es estructural y no una omisión de UI.
- **El visor es capa y no paso.** Regla: `bucle-jugable.md` §2 y §5. Cerrarlo no lleva a ningún sitio: deja a la vista lo que ya estaba montado debajo.
- **Un paso sin pantalla se enseña, no se salta.** Regla: §6h, y el precedente literal del telón en la fila 48. Saltarlo dejaría una secuencia que parece completa y no lo es, que es la forma de fallo que este repo ya ha pagado doce veces.
- **Validar es un estado y nunca un gesto, y una llegada no avisa.** Regla: `bucle-jugable.md` momento 3 y `accesibilidad.md` §3. La escena queda disponible y espera; las notificaciones están racionadas a las oportunidades, que son de otra fila.
- **El descarte cuesta menos que ignorarlo.** Regla: `seguridad-privacidad.md` §3. Dos toques, sin confirmación detrás —serían tres— y sin línea de gracias: que la acción ya no esté disponible es toda la confirmación que hace falta.
- **Deshacer vive en ajustes y no en el sitio.** Regla: `seguridad-privacidad.md` §3. Deshacerlo desde el sitio obligaría a volver a andar hasta allí, que es el único coste que este juego no puede cobrar por un cambio de opinión.
- **Decisión no cubierta por el design system:** qué hacer con la cadencia del sensor cuando hay un geofence cerca. Se resuelve **muestreando por tiempo solo mientras la última posición está dentro de algún geofence, con histéresis para salir**, porque es la única forma medida de que una parada valide sin poner el sensor a cinco segundos durante toda la salida, y porque el coste queda acotado a cuarenta metros alrededor de un sitio en vez de a la salida entera.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/ritmo.js` | la parada por deriva de ventana, sus dos ventanas, sus dos derivas y el umbral de precisión que elige entre ellas; se conserva el vocabulario y la regla de la duda |
| `packages/nucleo/partida/llegadas.js` | la permanencia contada sobre la parada por ventana, el nombre de la constante desambiguado, y la decisión de cercanía a un geofence sobre la que se elige la cadencia |
| `app/plataforma/posiciones.js` | la cadencia de la suscripción como parámetro y no como constante: por distancia fuera, por tiempo dentro, cambiada sin parar el servicio en medio |
| `app/marcha/seguidor.js` | el campo `sitio` resuelto contra el índice de geofences, y el fallo por contrato cuando ese índice no llega |
| `app/marcha/salida.js` | la capa de llegadas montada con la salida, alimentada posición a posición desde `recibeLaPosicion`, y las operaciones de avanzar, mirar el visor y descartar |
| `app/App.js` | la máquina: qué se monta según haya escena esperando o no, y los cortes donde se congela la partida |
| `app/pantallas/consulta-montado.jsx` | deshacer un descarte desde la lista de sitios marcados |

`packages/nucleo/partida/secuencia.js`, `visor.js`, `descartes.js`, `triangulacion.js`, `regreso.js`, `transporte.js` y `salidas.js` **no cambian de comportamiento**: de ellos se consume lo que ya entregan.

### Frontera de inyección

Tres entradas, y ninguna es una dependencia nueva.

1. **La precisión declarada del fijo** llega hasta la ventana de parada. Ya viaja desde `creaFuenteDePosiciones` (`precisionM`, con `null` como respuesta prevista) y hoy se pierde antes de llegar a la capa de llegadas. **No se guarda en ninguna parte**: se usa en vuelo para elegir la ventana y se tira, igual que el rumbo y la altitud.
2. **El índice de geofences del mapa activo** entra en el seguidor de la salida y en la decisión de cadencia. Lo produce `sitiosConPosicion(mundo)`, que ya existe, sobre el mundo congelado que la partida tiene levantado.
3. **La cadencia de la suscripción** deja de ser `CADENCIA_M` fija: la decide el paquete y la aplica `app/plataforma/posiciones.js` volviendo a pedir la suscripción con las opciones nuevas, **sin pararla en medio** —parar y arrancar dejaría un hueco sin servicio, que es lo que la promesa del permiso «mientras se usa» no admite—.

Y una salida hacia el resto del juego: **la llegada que espera**, que es lo que `App.js` consulta para decidir qué momento se monta.

### La regla de parada, con la medida delante

Anclar y comparar cada fijo contra un ancla **no vale**, y está medido: «parada dentro» y «de paso a 4 km/h» suben juntas con el radio de quietud —radio 15 m: 98 % de paradas validadas y **36 %** de paseos—, porque con dos o tres fijos en la ventana el ruido y la deriva son indistinguibles.

Lo que sí los separa es que **el ruido del GPS es de media cero y la deriva de quien anda no**. Medido con muestreo cada 5 s, 800 semillas por celda (§9c):

| | ventana 20 s · deriva ≤ 5 m | | ventana 40 s · deriva ≤ 8 m | |
| --- | --- | --- | --- | --- |
| **error del fijo** | parada dentro | de paso 4 km/h | parada dentro | de paso 4 km/h |
| 0 m | 100 % | **0 %** | 100 % | **0 %** |
| 3 m | 100 % | **0 %** | 100 % | **0 %** |
| 5 m | 100 % | 4,3 % | 100 % | **0 %** |
| 10 m | 100 % | 27,6 % | 100 % | 0,8 % |
| 15 m | 82 % | 19,8 % | 91 % | 5,9 % |

De ahí sale que la regla sea **adaptativa porque la medida lo pide y no por elegancia**: con el fijo bueno la ventana corta ya separa, así que **la permanencia de veinte segundos de SPEC-032 se conserva donde el fijo la sostiene** y solo se estira a cuarenta cuando el error declarado la deja de sostener. Alargarla para todo el mundo habría contradicho sin necesidad la razón por la que SPEC-032 la puso corta: *validar es barato, y un beat que se atiende de paso valida igual*.

El umbral que elige entre las dos sale de la misma tabla: **hasta cinco metros de error declarado, ventana corta**; por encima, larga. A cinco metros la corta ya deja pasar un 4,3 % de paseos y a diez un 27,6 %, que es lo que la hace dejar de servir.

**Límite declarado, con número y no con esperanza:** por encima de σ ≈ 15 m la validación se degrada y por encima de σ ≈ 20 m deja de sostenerse. Cubre la calle normal y no cubre el cañón urbano profundo.

Y la mitad que se pierde sola en cualquier arreglo de ruido: **el vehículo sigue apartando la llegada**, y el atasco dentro de un geofence sale **0 % en todas las tandas medidas**. Eso no lo da la deriva —un coche parado no deriva—: lo da que la parada nunca es cierta con la clasificación `vehiculo`, y esa guarda no se toca.

**Y el veto dura lo que dura la clasificación, que es lo que el criterio de arriba decía en absoluto y no lo es.** Pasados los `SALIDA_DE_VEHICULO_S = 120` quieto, el detector de SPEC-031 decide que quien juega se bajó del coche: la traza deja de decir vehículo y la llegada valida. No es una excepción a «el atasco no valida» —es que lo que hay dentro del geofence ya no es un coche parado—, y es exactamente lo que SPEC-031 quiso al poner dos minutos y no treinta segundos: *un autobús parado en un semáforo no es bajarse del autobús*. Está afirmado en `test/nucleo/marcha.test.mjs` con dos casos hermanos, uno de `SALIDA_DE_VEHICULO_S − 30` que no valida y otro de `SALIDA_DE_VEHICULO_S + 60` que sí, para que quien toque esa constante vea enfrente qué se lleva por delante. **La prueba afirma la verdad; el que estaba mal escrito era el criterio**, y queda acotado arriba con su número.

**La premisa que resultó falsa, y queda escrita para que nadie la reintroduzca:** el encargo pedía medir `RADIO_DE_GEOFENCE_M = 40` contra `ERROR_MAXIMO_FIABLE_M = 30` porque «una fracción de las posiciones se descarta por poco fiable justo donde más falta hace». Lo dice al revés la propia fuente: `transporte.js` declara que *«las posiciones malas no se descartan —eso quitaría metros que sí se anduvieron—: solo dejan de poder afirmar un motor»*, un fijo malo degrada `vehiculo` a `ambiguo`, y `ambiguo` **valida**. La precisión mala empuja hacia validar de más, no de menos.

### El diseño que esta fila actualiza, y quién lo escribe

Tocar la regla de parada va contra decisiones cerradas de **SPEC-031** y **SPEC-032**, así que **el diseño se actualiza y no solo el código**, que es lo que manda `CLAUDE.md`. Lo que hay que dejar escrito, con la tabla de arriba como evidencia:

- **`docs/specs/SPEC-031-...`**, iteración: el comentario de `esUnaParada` describe la regla enlace a enlace como lo que decide una llegada. Deja de serlo. La medida del umbral de medio metro por segundo sigue valiendo para el ritmo y para el motor de pasos; **lo que se deroga es su uso como criterio de validación de un geofence**.
- **`docs/specs/SPEC-032-...`**, iteración: la permanencia de veinte segundos **se conserva** y lo que cambia es cómo se mide «parada dentro». Su decisión asumida «Permanencia para validar: 20 s dentro del geofence» pasa a ser adaptativa, con el porqué medido.
- **`game-design/bucle-jugable.md`**, momento 3: la frase «al detectar que estás parada dentro del geofence» gana cómo se detecta y su límite medido. Es el documento del que cuelga la decisión, y `CLAUDE.md` obliga a actualizarlo cuando el cambio lo contradice.
- **`docs/starting.md`**: la iteración anotada con fecha, qué se decidió y con qué se verificó.

**Quién escribe cada cosa importa y no se puede improvisar:** `.claude/rules/naming.md` dice que `docs/specs/*.md` los escribe **solo `wa-spec`** y el código **solo `wa-dev`**. Así que las dos iteraciones son un encargo para `wa-spec` dentro de esta misma fila, no algo que `wa-dev` pueda hacer de paso, y la edición de `game-design/` es un cambio de diseño que aprueba quien orquesta. **Queda declarado como parte de la definición de hecho de la fila**, porque una regla de diseño cambiada en el código y no en el documento es exactamente cómo se desincronizan.

### La costura del reloj de permanencia, y las dos constantes homónimas

§8c avisa de una costura y **le cambia el sitio a mitad de párrafo**, así que conviene separarla. Verificado contra la fuente:

- `packages/nucleo/partida/llegadas.js` tiene `PERMANENCIA_S = 20` y su reloj es `paradaDesde`, un mapa por sitio que **se borra en cuanto una posición deja de ser parada dentro** de ese geofence.
- `packages/nucleo/partida/regreso.js` tiene `PERMANENCIA_S = 60` y su reloj es `dentroDesdeMs`, que **se reinicia entero con una sola posición fuera del radio de cincuenta metros** (`regreso.js:126`).

Son dos relojes distintos, con dos asimetrías contrarias: en la llegada, en la duda se valida; en el regreso, en la duda no se cierra. **Lo que esta fila hace con cada uno:**

1. **El reloj de la parada es suyo y lo arregla.** La exposición que §8c describe —vuelves del segundo plano, la primera posición cae un metro fuera por ruido y el reloj se va a cero— es real aquí, y es justo lo que la ventana de deriva quita: la parada deja de decidirse con un salto entre dos fijos. Lo que **no** se cose es el hueco del segundo plano: al volver, la traza se vuelve a anclar (decisión de SPEC-048) y la ventana empieza de cero, así que la permanencia se paga otra vez. Son veinte segundos y está declarado, en vez de coser media tarde de comida como si fuera quietud.
2. **El reloj del regreso no se toca**, y es deliberado: es de SPEC-030, su exposición **no está medida**, y cambiarlo cambiaría cuándo se cierra una salida, que es una decisión de otra fila con la asimetría contraria. Queda anotado con dueño: si alguien mide que una salida no se cierra al volver a casa «a veces» y sin patrón, se mira ahí.
3. **La homonimía se cierra por contrato.** Las dos constantes se renombran por lo que miden, de modo que un grep no las pueda confundir. Es barato y evita la forma exacta de error que §8c describe: alguien lee un número y arregla el otro reloj.

### El hueco de `docs/flujo.md` que aparece al cablear A4P5

`docs/flujo.md` es normativo: una transición que no está allí no existe. Al cablear la máquina aparece que **no hay ningún camino declarado hasta A4P5 que no pase por la escena de un beat**. Las únicas aristas que entran son `A4P4 → NUCLEO → A4P5`, y `A4P4` solo se alcanza desde `A4P3`.

Eso contradice tres fuentes que sí lo declaran, y las tres mandan sobre el diagrama:

- `game-design/quests.md` decisión 3 y `bucle-jugable.md` §2: **sin beat, lo que se cuenta es la llegada entera**.
- `docs/testing.md`, escenario **«Sin beat, lo que se cuenta es la llegada entera»**: *«Cuando llega y se para, entonces lo primero que ve es lo que allí se cuenta»*.
- `packages/nucleo/partida/secuencia.js`, que produce el paso de lo que aquí se cuenta para **todo** núcleo, con beat o sin él, y que además excluye la ficha en un núcleo.

Así que el que estaba mal era el diagrama, y `scripts/verifica-flujo.mjs` no lo podía cazar porque comparaba **nodos** y no aristas: A4P5 tenía aristas, solo que ninguna servía para llegar sin beat. Es la misma asimetría por la que §6y descubrió a mano que `ofrecimiento.jsx` no tenía nodo.

**Decidido y hecho.** Se escaló como cambio de diseño —mismo criterio que §6y: añadir o cambiar una arista del diagrama no se hace por cuenta propia— y el dueño aprobó añadir las aristas y escribir la guarda que las vigila. Lo que hay en `docs/flujo.md` son **cuatro** aristas nuevas y no las tres que se proponían, porque la guarda destapó una más al escribirla:

```
  LLEGA   -->|"primera vez en un núcleo sin ilustración y sin beat: la llegada entera es lo que allí se cuenta"| A4P5
  LLEGA   -->|"primera vez, sin ilustración pero con beat: sin visor que abrir, la escena es lo primero"|        A4P3
  CIERRA  -->|"no has venido a nada, pero es un núcleo: allí no hay ficha, hay lo que se cuenta"|                A4P5
  A4P6    -->|"es un núcleo y hoy no hay beat: aflora lo que allí se cuenta"|                                    A4P5
```

La cuarta —`LLEGA → A4P3`— es la que nadie había visto: un sitio **sin ilustración pero con beat** no tiene visor que abrir, así que la escena es su primer paso encadenado, y el diagrama solo llegaba a A4P3 pasando por el visor. Y las dos aristas de `→ A4P7` cambian de rótulo, porque decían «el caso normal» de una llegada sin beat y ese caso normal es el de un paraje o un servicio: en un núcleo no hay ficha.

**Y la guarda, que es lo que evita que esto vuelva a pasar:** `scripts/verifica-flujo.mjs` compara ahora **aristas** además de nodos. Enumera las **veinticuatro** secuencias que `secuenciaDeLlegada` puede producir —tipo de sitio × primera visita × ilustración × beat— y exige que cada una tenga camino en el diagrama **usando solo las pantallas de sus propios pasos**. Esa restricción es la pieza: con alcanzabilidad a secas, la llegada a un núcleo sin beat quedaba «cubierta» por el camino que pasa por el beat, que es justo el que esa secuencia no tiene. Se enumeran las veinticuatro en vez de elegir casos porque el espacio es pequeño y completo, y así no hay manera de que se quede fuera el que falla.

### Los dos recuentos que esta fila mueve

Los dos son guardas de contrato con lista escrita a mano, y bajarlos es un acto con registro:

- **`test/nucleo/pantallas-huerfanas.test.mjs`**, ocho al empezar y **una medido al cerrar**. Salieron siete: las seis del momento «al parar» —`descarte.jsx`, `ficha.js`, `llegada.js`, `lo-que-se-cuenta.js`, `visor.js` y `triangulacion.jsx`—, y **también `sitios-marcados.jsx`**, que se preveía que se quedara. Sale porque el cierre transitivo la alcanza: el camino de deshacer un descarte pasa por ella, así que la fila 38 se queda sin su huérfana sin que nadie la haya cableado a propósito. Queda **`zurron.jsx`** (fila 46), que necesita la fuente de salud, el motor de pasos y el registro de hechos. Baja de ocho a una y no a dos como se preveía, y **el número que se publica es el medido**.
- **`test/nucleo/limite-declarado.test.mjs`**, ocho al empezar y **pendiente de medida** al escribir esto: la columna la mueve Maestro sobre el simulador, y hasta que la tanda no termine no hay número que publicar. Lo previsto sigue siendo que salgan `llegada.yaml`, `visor.yaml` y `descarte.yaml`, que pasan a recorrer sus pantallas, y que queden cinco: `escena.yaml` (fila 49), `diario.yaml` y `repisa.yaml` (piden la siembra fichada en §6z), `mapas.yaml` (pide dos mapas y el ofrecimiento) y `ajustes-filas-de-valor.yaml` (fila 38). **Previsto no es medido**, y el número que se publique será el segundo. Un flujo sale de la columna **solo** cuando recorre su pantalla de verdad, y su entrada se quita en el mismo commit; **un flujo que tarda diez segundos no ha recorrido nada**.

### Lo que consume de otras specs y no respecifica

- **SPEC-048** entrega la única suscripción, la fuente, el detector, el seguidor, el rótulo y la vida de una salida. Aquí no se abre una segunda suscripción y no se cambia el orden de abrir; lo que cambia es la cadencia con la que se pide.
- **SPEC-032** entrega el geofence, su radio, la permanencia, la secuencia y A4P5. **El radio de cuarenta metros no se toca**: la medida de §9 dice que el problema no estaba ahí.
- **SPEC-033** entrega el visor con sus tres presentaciones y la ficha. Aquí solo se monta lo que resuelve su `resuelvePresentacion`.
- **SPEC-035** entrega el descarte, sus motivos sin campo libre, la reversibilidad y la alarma de estirón. Aquí solo se le pone camino.
- **SPEC-037** entrega la escena de la primera coincidencia y su cierre. Quién decide cuándo se enciende ya lo decide `llegadas.js`; aquí solo se monta.
- **SPEC-047** entrega la partida en disco. Cerrar una llegada es un corte del juego y congela, con la misma llamada idempotente que ya existe.
- **SPEC-030** entrega el regreso y el telón que espera. Esta fila **no** cambia ninguno de los dos.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Ninguno se implementa aquí —son de `wa-qa-dev`—, pero los criterios están escritos para cubrirlos sin inventar casos. Por nombre literal:

- De **«Al parar, la secuencia de una llegada»** (`@app @bucle`), que es la característica de esta fila: «La escena queda disponible y espera», «Pararse en un semáforo dentro de un geofence no tiene consecuencias», «El visor abre por la ficción la primera vez», «Arrastrar descubre el sitio real», «El visor es una capa y debajo está el beat» —en su mitad de capa; la escena de debajo es el hueco de la fila 49—, «Sin foto de Places, el visor abre igual», «La segunda vez el visor no se abre solo», «Llegar sin haber venido a nada da la ficha del sitio», «Sin beat, lo que se cuenta es la llegada entera», «El geofence se valida desde la calle» y **«El visor no aparece nunca andando»**, que es el que hoy no se sostenía en un dispositivo y con esta fila pasa a sostenerse con número.
- De **«El vehículo se aparta del reloj del mundo y de la validación»** (`@app @accesibilidad`): «Pasar en coche por delante de un beat no lo valida» y la mitad de validación de «En la duda, cuenta».
- De **«El jugador puede marcar un anclaje que no vale»** (`@app @privacidad`), los cuatro enteros: «Marcarlo lo saca del casting sin resembrar», «Es reversible», «No hace falta dar motivo» y «No se reporta a ningún sitio».
- De **«Del móvil no sale nada del jugador»** (`@app @privacidad`): «El rastro de ubicación no se guarda nunca», ahora con muchas más posiciones pasando por el sensor que antes.
- De **«Triangular se descubre jugando y luego se facilita»** (`@nucleo`): «La primera coincidencia se pone en escena», en su mitad de que ocurre en el sitio y no en casa.
- De **«En marcha no hay nada que tocar»** (`@app @bucle`): «La pantalla del mapa no tiene ni un control» y «No se enseña ninguna cifra de esfuerzo», que esta fila tiene que seguir cumpliendo con un geofence cerca.

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería y no de esta spec:

- **Nada afirma que una parada real valide en presencia de ruido de GPS.** Toda la batería del geofence está escrita sobre posiciones exactas, que es precisamente por lo que la capa pudo cerrarse sin poder dispararse nunca. Hace falta un escenario con error de fijo declarado.
- **Nada afirma la cadencia del sensor.** «El visor no aparece nunca andando» y «El geofence se valida desde la calle» son verdad sobre posiciones fabricadas y falsas sobre un teléfono con `distanceInterval: 10`, y ningún escenario los separa.
- **Nada afirma que un vehículo parado dentro de un geofence no valide.** «Pasar en coche por delante de un beat no lo valida» habla de pasar, no de estar parado, y el atasco es el caso que un arreglo de ruido rompe.
- **Nada afirma que la app enseñe la escena al abrirse estando parada dentro**, que es la regla de `bucle-jugable.md` §9 y la puerta de entrada de toda esta fila.
- **Nada afirma el camino de deshacer un descarte desde los ajustes.** «Es reversible» lo dice en una línea y no hay flujo que lo recorra.
- **Nada afirma que un paso sin pantalla se enseñe en lugar de saltarse**, que es la garantía del hueco declarado y la única defensa contra que la fila 49 se dé por hecha sin llegar.

### Escaladas al dueño

Tres, y ninguna se resuelve por cuenta propia:

1. **La arista que falta en `docs/flujo.md`** para llegar a A4P5 sin beat. Propuesta escrita arriba; el diagrama lo cambia quien decide diseño. **Resuelta**: el dueño aprobó las aristas y la guarda, y acabaron siendo cuatro y no tres.
2. **La actualización de `game-design/bucle-jugable.md`** con cómo se mide «parada dentro» y su límite medido, más las dos iteraciones de SPEC-031 y SPEC-032. Es obligación de la fila y su ejecución cae fuera de `wa-dev`. **Resuelta**: las iteraciones son `SPEC-031-iter-1` y `SPEC-032-iter-1`, escritas por `wa-spec` como manda `.claude/rules/naming.md`, y el momento 3 de `bucle-jugable.md` lleva ya la regla con su límite.
3. **El coste de batería de la cadencia por tiempo**, que aquí se acota a estar dentro de un geofence y **no está medido en un dispositivo**. Si al medirlo resulta que en un mundo urbano denso se está dentro de algún geofence buena parte de la salida, es una decisión de diseño —estrechar el radio, alargar la cadencia, o aceptarlo— y se escala con el número delante, no se ajusta una constante por cuenta propia.

## Decisiones asumidas

- **La cadencia por tiempo se activa estando dentro de algún geofence, no en un halo alrededor** → asumido (alternativas: un halo de radio + 60 m, que daría más margen antes de parar; activarla siempre durante la salida). Regla: §9c mide la validación con muestreo cada 5 s **durante la parada**, y entrar en el geofence andando ya entrega un fijo por la cadencia de distancia, así que el halo no compra nada y multiplica el gasto. Con el halo, en `urbano-denso` la cadencia rápida sería casi permanente.
- **Cinco segundos de cadencia por tiempo** → asumido (alternativas: 10 s, que §9a midió al 100 % solo con fijo perfecto; 2 s). Regla: §9c fijó los dos pares ventana/deriva midiendo con 5 s, y cambiar la cadencia invalidaría la tabla.
- **Histéresis de salida: radio + 20 m** → asumido (alternativas: sin histéresis; radio + 40 m). Regla: sin ella, un fijo ruidoso en el borde cambiaría la suscripción en cada muestra, y volver a pedirla no es gratis; veinte metros es el orden del ruido que la propia tabla considera normal.
- **Umbral de precisión que elige ventana: 5 m** → asumido (alternativas: 10 m; una sola ventana de 40 s para todo el mundo). Regla: §9c, a 5 m la ventana corta deja pasar 4,3 % de paseos y a 10 m un 27,6 %; y usar 40 s para todos contradiría sin necesidad la razón por la que SPEC-032 puso la permanencia corta.
- **Una posición sin precisión declarada usa la ventana larga** → asumido (alternativa: usar la corta y confiar). Regla: la asimetría del proyecto es fallar hacia el lado que no rompe el diseño, y aquí el lado caro es validar a quien pasa andando, que tumbaría «El visor no aparece nunca andando».
- **La ventana de parada es una sola y no una por sitio** → asumido (alternativa: una ventana por geofence). Regla: estar parada es una propiedad de la trayectoria y no del sitio; una por sitio mediría lo mismo n veces y multiplicaría el estado sin cambiar ninguna respuesta.
- **La permanencia se cuenta desde que la ventana declara parada, y al volver del segundo plano vuelve a empezar** → asumido (alternativa: coser el hueco del segundo plano con la última marca conocida). Regla: la fila 48 decidió volver a anclar en vez de coser, y coser aquí contaría como quietud medida lo que pudo ser media tarde. El coste declarado son veinte segundos.
- **El reloj de permanencia del regreso no se toca en esta fila** → asumido (alternativa: aplicarle la misma ventana). Regla: es de SPEC-030, tiene la asimetría contraria —en la duda no se cierra— y su exposición no está medida; §9b dice que un número feo se escala y no se ajusta por cuenta propia.
- **Las dos constantes de permanencia se renombran por lo que miden** → asumido (alternativa: dejarlas y añadir un comentario). Regla: §6h, se cierra por contrato y no por vigilancia; un comentario no impide que alguien lea un número y arregle el otro reloj, que es exactamente lo que §8c describe.
- **El paso de beat se monta con el hueco declarado de una acción** → asumido (alternativas: saltar el paso; montar una escena provisional). Regla: el precedente literal de la fila 48 con el telón, y §6h — saltarlo dejaría una secuencia que parece completa; una escena provisional es contenido inventado que después habría que desmontar.
- **A6P3 se monta en esta fila aunque su composición sea de la 37** → asumido (alternativa: dejarla huérfana hasta que alguien la reclame). Regla: `docs/flujo.md` la cuelga de A4P5 y de ningún otro sitio, y `llegadas.js` ya declara cuándo se enciende; dejarla fuera sería dejar muerta una transición declarada, que es el patrón que esta fila existe para cerrar.
- **El núcleo sin beat enseña A4P5 aunque el diagrama no tenga esa arista** → asumido (alternativa: no enseñarlo hasta que el diagrama se corrija). Regla: `CLAUDE.md`, «si un escenario y un documento se contradicen, manda el documento», y aquí los documentos de `game-design/` y la batería dicen lo mismo contra el diagrama. La discrepancia se declara y se propone la corrección.
- **`sitio` se resuelve al más cercano cuando hay geofences solapados** → asumido (alternativa: el primero por orden alfabético). Regla: es el mismo criterio con el que SPEC-032 ordena dos llegadas validadas a la vez, y tener dos criterios distintos para lo mismo es cómo se desincronizan.
- **El seguidor falla al montarse sin índice de geofences** → asumido (alternativa: exponer un `sitiosSinGeofence()` declarativo, como §6p hizo con `anclaje: null`). Regla: aquí la ausencia no es un estado legítimo del mundo —siempre hay mundo levantado cuando hay salida abierta—, así que se puede cerrar por contrato, que es más fuerte que declararlo.
- **La cadencia vigente se expone como marca observable** → asumido (alternativa: no exponerla y afirmarla solo en `@nucleo`). Regla: `design-system.md` pide un identificador por elemento que una prueba necesite alcanzar, y sin esta marca el cambio de cadencia solo se puede afirmar sobre la función pura, nunca sobre el aparato.
