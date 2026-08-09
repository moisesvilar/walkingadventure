# SPEC-027 — El arranque: de forastera a alguien de aquí en siete pantallas

## Descripción

Las siete pantallas que van desde abrir la app por primera vez hasta salir a andar. Se elige quién eres —nombre y oficio—, cuánto andas, dónde se levanta el mapa, se espera a que el mundo se genere y se acepta la primera aventura. Es el único tramo del juego que habla como aplicación, y termina exactamente en el botón «Salir a andar» de la última pantalla: a partir de ahí solo habla el mundo.

Hasta aquí la app sabía levantar un mapa desde una pantalla provisional (SPEC-026) y el núcleo sabía declarar un tramo (SPEC-004), sortear nombres de persona (SPEC-002), filtrar el catálogo por oficio (SPEC-017) y componer el prólogo con su primera aventura (SPEC-013). Lo que no existía era **quién juega**: no hay área de personaje en el estado de la partida, ni nombre, ni género gramatical, ni oficio fijado, ni la secuencia que los recoge y sobrevive a que suene el teléfono.

Anclas: **RF-PJ-001, RF-PJ-002, RF-PJ-003, RF-PJ-005, RF-PJ-006, RF-PJ-007, RF-PJ-008** (`docs/prd.md` §4.8) y **RF-PRIV-005, RF-PRIV-006** (§4.11). Las fuentes que mandan sobre el PRD son `game-design/arranque.md`, `game-design/personaje.md` §1 y §3, `game-design/lenguaje.md`, `game-design/accesibilidad.md` §1 y §4 y `game-design/seguridad-privacidad.md` §2 y §4. Las pantallas están dibujadas en `docs/pantallas/pantallas-1-arranque.html` y encadenadas en `docs/flujo.md` como **A1P1 … A1P7**. Consume SPEC-003 (la celda anclada a coordenada redondeada), SPEC-004 (las cuatro respuestas de tramo y la declaración del suelo), SPEC-013 (el prólogo compuesto y la regla de selección de la primera aventura), SPEC-017 (el catálogo y la afinidad de oficio), SPEC-020 (el proyecto de Expo y la frontera del paquete) y SPEC-026 (levantar el mapa y pintarlo).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparecen el **proveedor de ubicación** y el **origen de entropía de la semilla**, los dos inyectados y los dos con doble en Node. Están descritos en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** la **portada** y la lista de lo que se cuenta hoy (fila 28), a la que A1P7 se parece pero no es —A1P7 es la primera aventura del arranque, con su regla de selección propia de SPEC-013—; el **momento en marcha** y sus avisos (fila 29); el **rótulo del sistema** (fila 30); la **pantalla de ajustes**, donde se cambian el nombre y el género y donde se ven «solo de día» y «contar los pasos del día a día» (fila 38) —esta fila deja esos ajustes **puestos en su valor de origen** y no dibuja la pantalla que los enseña—; los **pasos de fondo** y el zurrón (fila 42); la **escritura duradera de la partida** y el respaldo (fila 39), del que aquí se consume el almacén tal como lo dejó SPEC-026; **empezar de nuevo** (fila 40), que es la segunda entrada a A1P1 y que esta fila solo tiene que admitir; el **pintado de la lámina** (filas 21 y 22) y el **levantamiento** (fila 26), que aquí se consumen enteros; y el **prólogo** con su composición y su primera aventura (fila 13), del que aquí se consume el resultado y se dibuja la espera.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`, y reutilizan literalmente los nombres de escenario que ya existen allí cuando existen: «El onboarding habla como aplicación», «El personaje llega en femenino», «La pantalla de elección dice qué implica el oficio», «Nada del personaje afecta al cuerpo», «No se pregunta la edad», «El horario diurno viene encendido», «Los pasos de fondo vienen apagados», «La app no pide el permiso de ubicación permanente».

Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La secuencia de las siete pantallas» y «Quién eres»; la **validación de entradas** en el nombre vacío, el nombre larguísimo, el nombre que no pasa el filtro de aptitud, el oficio que no está en el enumerado y la respuesta de tramo desconocida; el **estado vacío** en el paquete de idioma sin repertorio suficiente para sortear sugerencias y en el arranque sin ninguna respuesta contestada; el **estado de error** en el permiso denegado, en la generación que no se puede completar y en el arranque sin proveedor de ubicación cableado; y los **casos límite** en la app que se cierra durante la generación, en el retroceso hasta la primera pantalla, en el intento de cambiar el oficio y en el tramo en el suelo de 250 m.

### Dónde se puede poner rojo cada criterio

En la máquina donde se escribe esta spec **no hay simulador**: no hay Xcode completo ni SDK de Android, así que **ningún flujo `@app` se puede ejecutar** (`pipeline/decisiones-orquestador.md` §4). Eso no ablanda nada, pero sí decide **dónde se escribe cada criterio**, y la regla que se aplica aquí es: *todo lo que sea estado, secuencia o contenido se afirma en `@nucleo`, y en `@app` queda solo lo que de verdad necesita pantalla*.

Concretamente:

- **`@nucleo`** — el área de personaje y su esquema; la lista cerrada de campos que el arranque recoge; el orden de los siete pasos y cuáles admiten volver atrás; qué queda precubierto al retroceder y al reanudar; el sorteo de sugerencias de nombre y su orden; el filtro sobre el nombre escrito a mano; el femenino de origen; la permanencia del oficio; los dos orígenes del punto de partida; los ajustes de origen; el guion de textos de las siete pantallas y su registro; y que nada del personaje toque el dimensionado.
- **`@app`** — que las siete pantallas se monten en orden en un dispositivo, que la flecha de atrás exista en las cinco que la llevan, que el pin se pueda arrastrar de verdad, que el diálogo de permiso del sistema aparezca, y que la pantalla de generación no enseñe cifras.
- **`@manual`** — el diálogo nativo de permiso denegado en las dos plataformas, que ningún automatismo puede provocar de forma fiable.

Un criterio que solo pudiera comprobarse `@app` en esta máquina sería un criterio que nunca se pone rojo, y `pipeline/decisiones-orquestador.md` §6o dice qué vale eso. Por eso el guion de textos de las siete pantallas es **dato del núcleo** y no cadenas sueltas dentro de los componentes: es la única forma de que «el onboarding habla como aplicación» y «no se pregunta la edad» se puedan afirmar sin dispositivo.

### La secuencia de las siete pantallas

- **Dado** una instalación nueva, **cuando** se abre la app, **entonces** el arranque empieza en A1P1 y los siete pasos se recorren en el orden `quien-eres · tu-tramo · el-permiso · donde-se-levanta · la-generacion · tu-mapa · la-primera-aventura`.
- **Dado** el arranque en cualquiera de los cinco primeros pasos, **cuando** se lee su cabecera, **entonces** lleva flecha de atrás y contador, y el contador dice el paso sobre cinco.
- **Dado** el arranque en A1P6 o en A1P7, **cuando** se lee su cabecera, **entonces** no lleva flecha ni contador: desde que el mapa existe no se vuelve.
- **Dado** el arranque en A1P3 con el permiso ya contestado, **cuando** se pulsa la flecha de atrás, **entonces** se vuelve a A1P2 con la respuesta de tramo ya marcada.
- **Dado** el arranque retrocedido hasta A1P1, **cuando** se lee la pantalla, **entonces** el nombre y el oficio que se habían contestado siguen puestos, y ninguno se ha vuelto a sortear.
- **Dado** el arranque en A1P1, **cuando** se pulsa la flecha de atrás, **entonces** no se sale de la app ni se pierde nada: no hay paso anterior y la pantalla lo dice quedándose.
- **Dado** el arranque completo hasta A1P7, **cuando** se pulsa «Salir a andar», **entonces** el arranque queda cerrado y no se vuelve a entrar en él salvo por «empezar de nuevo».
- **Dado** todos los textos de los siete pasos, **cuando** se leen, **entonces** hablan como aplicación —explican qué hace la app y por qué— salvo el guion de fases de A1P5, el título y el párrafo del trato de A1P6 y las tarjetas de A1P7, que hablan como mundo.
- **Dado** todos los textos de los siete pasos, **cuando** se buscan cifras de distancia, de tiempo de esfuerzo, de ritmo, de pasos o de porcentaje, **entonces** no aparece ninguna.
- **Dado** todos los textos de los siete pasos, **cuando** se generan diez mundos distintos, **entonces** ninguno se vuelve falso en ninguno de ellos.

### Quién eres: el nombre

- **Dado** una instalación nueva con el mapa por levantar en Galicia, **cuando** se abre A1P1, **entonces** el campo de nombre llega ya relleno con un nombre sorteado del paquete gallego.
- **Dado** A1P1 recién abierta, **cuando** se leen las sugerencias, **entonces** son cuatro, no hay dos iguales y **las femeninas van primero**.
- **Dado** A1P1 recién abierta, **cuando** se pulsa «↻ otro», **entonces** salen otras cuatro sugerencias y el campo se rellena con la primera.
- **Dado** la misma semilla de partida, **cuando** se sortean las sugerencias dos veces, **entonces** salen las mismas y en el mismo orden.
- **Dado** A1P1 sin haber escrito nada, **cuando** se pulsa «Seguir», **entonces** se sigue con el nombre precargado y no se pide nada más.
- **Dado** A1P1, **cuando** se lee su primera línea, **entonces** dice que el nombre es el del personaje y no el de quien juega.
- **Dado** un nombre escrito a mano que pasa el filtro, **cuando** se pulsa «Seguir», **entonces** se guarda tal cual, con sus tildes y sus mayúsculas.
- **Dado** un nombre escrito a mano de más caracteres de los que el tope admite, **cuando** se intenta seguir, **entonces** no se guarda y se dice que es demasiado largo, sin nombrar ningún número interno.
- **Dado** un nombre escrito a mano que el filtro de aptitud rechaza, **cuando** se intenta seguir, **entonces** no se guarda y se dice que ese nombre no vale, sin repetirlo.
- **Dado** el campo de nombre vaciado del todo, **cuando** se intenta seguir, **entonces** no se guarda un nombre vacío: vuelve el precargado.
- **Dado** un paquete de idioma sin repertorio suficiente para sortear cuatro sugerencias sin repetir, **cuando** se abre A1P1, **entonces** falla nombrando el paquete y la función que se queda corta, en lugar de enseñar sugerencias repetidas.

### Quién eres: el género gramatical

- **Dado** una instalación nueva, **cuando** el jugador llega a la creación de personaje, **entonces** el género gramatical está puesto en femenino.
- **Dado** A1P1, **cuando** se lee la línea del género, **entonces** habla de cómo se dirigen a ti dentro del juego y no de quién eres fuera.
- **Dado** el género en masculino, **cuando** el mundo se dirige al personaje, **entonces** la concordancia sale en masculino en todos los textos, y no solo en unos cuantos.
- **Dado** el género cambiado después del arranque, **cuando** se compara el mundo generado, **entonces** es idéntico byte a byte: el género no siembra nada.

### Quién eres: el oficio

- **Dado** A1P1, **cuando** el jugador llega a la elección de oficio, **entonces** se le dice que el oficio decide qué aventuras verá, y que no se cambia después.
- **Dado** la lista de oficios, **cuando** se marca uno, **entonces** ese se despliega y explica a qué tipo de aventuras manda, y los demás se quedan en su línea de sabor.
- **Dado** la lista de oficios, **cuando** se cuenta cuántos hay, **entonces** son los del enumerado cerrado del núcleo y ninguno más.
- **Dado** una lista de oficios más larga que la pantalla, **cuando** se recorre, **entonces** desplaza y la pantalla no cambia de forma.
- **Dado** un oficio ya fijado, **cuando** se intenta fijar otro, **entonces** falla nombrando el oficio que ya estaba: el oficio es permanente y el estado lo sostiene, no la pantalla.
- **Dado** un oficio que no está en el enumerado, **cuando** se intenta fijar, **entonces** falla nombrando los que sí valen.
- **Dado** un personaje con su oficio, **cuando** se pide el reparto de aventuras, **entonces** el catálogo llega filtrado por afinidad y hay plantillas que no aparecen nunca.
- **Dado** A1P1 con el oficio ya marcado, **cuando** se retrocede desde A1P2 y se vuelve, **entonces** el oficio marcado sigue marcado y todavía se puede cambiar: la permanencia empieza cuando el arranque se cierra, no antes.

### El punto de partida y el permiso

- **Dado** A1P3, **cuando** se lee, **entonces** explica para qué hace falta la ubicación antes de pedirla y dice que nunca se guarda ni se comparte.
- **Dado** el arranque entero, **cuando** se revisan los permisos que la app solicita, **entonces** solo pide la ubicación «mientras se usa» y ninguno en segundo plano.
- **Dado** A1P3, **cuando** se concede el permiso, **entonces** se pasa a A1P4 con el pin puesto en la posición actual.
- **Dado** A1P3, **cuando** se elige «Prefiero elegir el punto a mano», **entonces** se pasa a A1P4 igual, con el pin en un punto por defecto y sin haber pedido ningún permiso.
- **Dado** el permiso denegado en el diálogo del sistema, **entonces** el arranque continúa por la vía de elegir el punto a mano y ninguna pantalla se queda sin salida.
- **Dado** el permiso denegado, **cuando** se pulsa la flecha de atrás desde A1P4, **entonces** se vuelve a A1P3 y se puede volver a intentar.
- **Dado** un arranque terminado por cualquiera de las dos vías, **cuando** se inspecciona la partida guardada, **entonces** contiene la coordenada redondeada del anclaje de la celda y **ninguna** posición exacta de quien juega.
- **Dado** un arranque terminado, **cuando** se inspecciona qué salió a la red, **entonces** las coordenadas salieron una sola vez, al generar el mapa.

### Dónde se levanta el mapa

- **Dado** A1P4, **cuando** se pinta, **entonces** enseña el mapa real —calles, manzanas— con una marca arrastrable y un círculo alrededor.
- **Dado** el tramo declarado en A1P2, **cuando** se dibuja el círculo, **entonces** su radio sale del tramo y de nada más: dos tramos distintos dan dos círculos distintos.
- **Dado** el círculo dibujado, **cuando** se lee el texto que lo acompaña, **entonces** habla en palabras de camino y no lleva ni metros ni minutos.
- **Dado** A1P4, **cuando** se arrastra la marca y se suelta, **entonces** el mapa se levantaría en la celda de la coordenada redondeada de donde se soltó, no en la exacta.
- **Dado** dos posiciones distintas dentro de la misma celda, **cuando** se levanta el mapa desde cada una, **entonces** sale el mismo mundo.
- **Dado** A1P4, **cuando** se lee antes de pulsar, **entonces** dice que a partir de ahí ya no se vuelve, y esa es la única cosa del arranque que lo dice.
- **Dado** el mapa ya levantado, **cuando** se busca en toda la app una acción de regenerar o de mover el mapa, **entonces** no existe ninguna.
- **Dado** un tramo en el suelo de 250 m, **cuando** se dibuja A1P4, **entonces** el círculo se dibuja igual y la pantalla no menciona ni el suelo ni ninguna limitación.

### La generación, y volver a abrir a mitad

- **Dado** A1P5, **cuando** se pinta, **entonces** enseña las seis fases del generador dichas como mundo, una por línea, con las literales que la pantalla dibujada usa.
- **Dado** A1P5, **cuando** se busca una barra de progreso, un porcentaje, un contador o una estimación de segundos, **entonces** no hay ninguno.
- **Dado** A1P5, **cuando** se lee su última línea, **entonces** anuncia que ahí fuera ya pasan cosas que nadie te ha contado, sin explicar qué es el prólogo.
- **Dado** la generación terminada, **cuando** acaba, **entonces** se pasa a A1P6 sin pulsar nada.
- **Dado** la app cerrada mientras A1P5 corre, **cuando** se vuelve a abrir, **entonces** el arranque aparece en A1P4 con el nombre, el oficio, el tramo y el punto ya contestados, y no se ha escrito ningún documento a medias.
- **Dado** la app cerrada mientras A1P5 corre, **cuando** se vuelve a abrir, **entonces** no se repite ninguna pregunta ya contestada.
- **Dado** la generación que no se puede completar, **cuando** falla, **entonces** el arranque se queda en A1P4 con todo contestado y ofrece volver a intentarlo, sin nombrar la red ni ningún código.
- **Dado** una celda que no da para un mundo jugable, **cuando** se intenta levantar, **entonces** se dice en la pantalla y se ofrece mover la marca, en lugar de entregar un mapa vacío que parece un mapa.

### Lo que el arranque deja puesto

- **Dado** el jugador que recorre el onboarding entero, **cuando** se revisan sus siete pantallas, **entonces** no se le pregunta la edad en ningún momento.
- **Dado** la lista cerrada de campos que el arranque recoge, **cuando** se lee, **entonces** son nombre, género gramatical, oficio, respuesta de tramo, origen del punto y coordenada del punto, y ninguno más.
- **Dado** una instalación nueva con el arranque terminado, **cuando** se lee el estado de la partida, **entonces** «solo de día» está activado y se puede desactivar.
- **Dado** una instalación nueva con el arranque terminado, **cuando** se lee el estado de la partida, **entonces** «contar los pasos del día a día» está desactivado, y el juego es completo sin activarlo.
- **Dado** el texto de la ficha de la tienda, **cuando** se lee, **entonces** declara el suelo por debajo del cual no hay juego, con el número que el núcleo declara y no con uno escrito a mano.
- **Dado** los textos de las siete pantallas del arranque, **cuando** se busca el suelo, **entonces** no aparece: se dice antes de instalar y nunca dentro.
- **Dado** el arranque terminado, **cuando** se lee A1P7, **entonces** ofrece la primera aventura, que además de castear pasa por los dos núcleos que oyeron versiones distintas del mismo suceso.
- **Dado** A1P7, **cuando** se lee su última línea, **entonces** dice que se puede salir a andar sin coger ninguna.

### Nada del personaje toca el cuerpo

Bloqueante, y con el mismo nombre de escenario que `docs/testing.md`.

- **Dado** todos los atributos del personaje, **cuando** se revisan, **entonces** ninguno modifica la velocidad, la resistencia ni la distancia que puede andar.
- **Dado** dos personajes con nombre, género y oficio distintos y el mismo tramo, **cuando** se dimensiona una salida, **entonces** sale exactamente el mismo tamaño en metros y en beats.
- **Dado** dos personajes con oficios distintos y la misma semilla, **cuando** se levanta el mapa, **entonces** los dos documentos son idénticos byte a byte: el oficio filtra lo que se ofrece y no lo que existe.
- **Dado** el mundo ya generado, **cuando** se cambia el nombre o el género desde donde se cambien, **entonces** el mundo sigue idéntico byte a byte.

### El mundo no te llama por tu nombre todavía

- **Dado** un personaje recién creado, **cuando** el mundo se dirige a él antes del hito de fin de arranque, **entonces** lo llama forastera o forastero según su género, y nunca por su nombre.
- **Dado** el hito de fin de arranque disparado, **cuando** el mundo se dirige al personaje, **entonces** ya puede usar su nombre.

### Nada degrada por falta de cableado

Aplicación directa de `pipeline/decisiones-orquestador.md` §6h.

- **Dado** el arranque sin proveedor de ubicación cableado, **cuando** se construye, **entonces** falla nombrando la pieza que falta, y no cae en silencio a la vía de elegir el punto a mano.
- **Dado** el arranque sin origen de entropía cableado, **cuando** se construye, **entonces** falla nombrando la pieza que falta, y no fabrica una semilla con el reloj.
- **Dado** el arranque sin paquete de idioma resuelto, **cuando** se piden sugerencias de nombre, **entonces** falla nombrando el paquete, y no entrega una lista vacía.
- **Dado** el guion de textos del arranque, **cuando** se comprueba que cada pantalla tiene el suyo, **entonces** ninguna pantalla se queda sin texto y la que falte se nombra.
- **Dado** el arranque terminado, **cuando** se inspecciona qué recibió el levantamiento del mapa, **entonces** recibió el tramo declarado y la coordenada redondeada, y no un radio por defecto.

### Determinismo

Bloqueante (`@determinismo`, RNF-DET-003).

- **Dado** la misma semilla de partida, **cuando** se recorre el arranque dos veces con las mismas respuestas, **entonces** el personaje, el mundo y la primera aventura son idénticos.
- **Dado** el código que esta fila añade, **cuando** se busca en él, **entonces** no aparece `Math.random` ni `Date.now` dentro de nada que participe en la generación ni en el sorteo de sugerencias.

## Lo que esta fila no respecifica

| Cosa | De quién es | Qué se consume aquí |
| --- | --- | --- |
| Las cuatro respuestas de tramo, sus metros y `declaraTramo` | SPEC-004 | los identificadores y la respuesta preseleccionada, para pintar A1P2 |
| `DECLARACION_DEL_SUELO` y su texto | SPEC-004 | el texto, para la ficha de la tienda |
| El anclaje de la celda a coordenada redondeada | SPEC-003 | el redondeo, para que arrastrar el pin signifique lo que significa |
| Levantar el mapa, sus fases y el minuto | SPEC-026 | la orquestación entera y las claves de fase, para pintar A1P5 |
| El prólogo, su composición y la regla de la primera aventura | SPEC-013 | el par de núcleos y `filtraPrimeraAventura`, para poblar A1P7 |
| El enumerado de oficios y la afinidad por plantilla | SPEC-017 | `OFICIOS` y el filtro, para pintar la lista y para que filtre de verdad |
| `personName` de cada paquete de idioma | SPEC-002 | el repertorio del que salen las sugerencias |
| El filtro de aptitud de texto | SPEC-018 | las listas por locale, para cribar el nombre escrito a mano |
| La pantalla de ajustes donde se cambian nombre y género | fila 38 | nada: aquí solo se deja el valor de origen |
| El zurrón y los pasos de fondo | fila 42 | nada: aquí solo se deja el ajuste apagado |
| Empezar de nuevo | fila 40 | solo la garantía de que A1P1 admite una segunda entrada |

## UX Design

### Wireframe textual

Siete pantallas, en el orden de `docs/flujo.md`. Todas son del momento **antes de salir**, así que la pantalla está permitida y se puede leer, elegir y esperar. Layout común: una columna, con la cabecera de navegación arriba, el contenido en medio y la acción única abajo, pegada al borde inferior.

**A1P1 · Quién eres.** Cabecera con flecha de atrás y contador `1/5`. Debajo, en dos bloques:

1. **Tu personaje.** Título de sección «Tu personaje», pregunta en serif «¿Quién vas a ser ahí dentro?», y debajo, en sans, la línea que aclara que es el nombre del personaje. Campo de texto con el nombre precargado y, a su derecha, la acción «↻ otro» que resortea. Bajo el campo, una fila de **cuatro sugerencias tocables**, las femeninas primero. Bajo ellas, la elección de género gramatical como dos opciones en una línea: «se dirigen a ti **en femenino**» / «en masculino», con la primera marcada.
2. **A qué te dedicas.** Título de sección, y debajo la línea que dice qué implica: «Marca qué aventuras te va a ofrecer el mundo, y esto no se cambia luego». Lista **desplazable** de oficios, uno por fila, cada una con su nombre y su línea de sabor. La fila marcada **se despliega** y añade un párrafo que explica a qué tipo de aventuras manda; las demás se quedan en una línea.

Abajo, la única acción: **«Seguir»**.

**A1P2 · Tu tramo.** Cabecera `2/5`. Título de sección «Tu nivel de dificultad», pregunta en serif «En media hora andando, ¿tú dónde llegas?», y las **cuatro respuestas** de SPEC-004 como opciones en una columna, con la tercera preseleccionada. Bajo ellas, una línea en sans: «No te preocupes por acertar: se ajusta solo a medida que camines». Acción: **«Seguir»**. Ni la palabra accesibilidad, ni una opción para quien va en silla, ni un solo metro.

**A1P3 · El permiso.** Cabecera `3/5`. Título de sección «Tu mapa», título «Permiso de ubicación», párrafo que explica para qué hace falta y que nunca se guarda ni se comparte. Debajo, una **tarjeta del alcance del permiso**: «Ubicación · mientras usas la app», con la línea que aclara que nunca en segundo plano. Dos acciones apiladas: **«Permitir»**, que dispara el diálogo del sistema, y debajo, sin peso de botón primario, **«Prefiero elegir el punto a mano»**.

**A1P4 · Dónde se levanta.** Cabecera `4/5`. Es la única pantalla del arranque donde se ve el mundo real tal cual. El mapa real ocupa el cuerpo, con una **marca arrastrable** y un **círculo de alcance** centrado en ella. Debajo del mapa, dos líneas: «Puedes arrastrar la marca a otro sitio. El círculo es hasta dónde llega el mundo por ahora» y «El tamaño sale de la dificultad que elegiste: te da para una tarde larga». Acción: **«Generar aquí»**, y encima de ella la línea que dice que desde aquí ya no se vuelve.

**A1P5 · La generación.** Sin cabecera de navegación: aquí ya no se vuelve. Título «Generando el mundo del juego», línea de espera «Esto puede tardar un poco, pero solo ocurre una vez…», y la **lista de seis fases**, una por línea, con marca de completada: «Mirando qué hay por ahí» · «Separando la tierra del agua» · «Repartiendo la gente» · «Trazando las calzadas» · «Buscando los sitios con historia» · «Poniéndole nombre a todo». Al pie, en serif y entre comillas, la línea que anuncia el prólogo: «…y mientras tanto, ahí fuera ya pasan cosas que nadie te ha contado». Ninguna acción. Al terminar se pasa sola a A1P6.

**A1P6 · Tu mapa, el día uno.** Sin cabecera de navegación. La **lámina** de SPEC-021 ocupa el cuerpo, encuadrando la celda entera con margen, con sus núcleos sobre placa y sus parajes con halo. Debajo, la cartela con el título del mundo, y bajo ella el **párrafo del trato**, tres frases y ninguna más: que los sitios son reales, que ahí ocurre la historia, y que se escribe según andas. Acción: **«Seguir»**.

**A1P7 · La primera aventura.** Sin cabecera de navegación. Título en serif «Lo que se cuenta hoy», subtítulo «Por aquí hay quien necesita algo», y debajo las **tarjetas de aventura**: título, gancho de una o dos líneas y, al pie de cada una, la **medida en palabra del mundo** con su equivalencia orientativa («Una aventura · unas dos horas»). Bajo las tarjetas, el párrafo de la regla del reloj, dos líneas. Al final, la línea que dice que se puede salir a andar sin coger ninguna. Acción: **«Salir a andar»**, que es **la frontera de registro**: es el último texto que dice «nosotros».

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec entrega enteras:
  A1P1  pantalla 1 · artefacto 1 — Quién eres
  A1P2  pantalla 2 · artefacto 1 — Tu tramo
  A1P3  pantalla 3 · artefacto 1 — El permiso
  A1P4  pantalla 4 · artefacto 1 — Dónde se levanta
  A1P5  pantalla 5 · artefacto 1 — La generación
  A1P6  pantalla 6 · artefacto 1 — Tu mapa, el día uno
  A1P7  pantalla 7 · artefacto 1 — La primera aventura

Elementos del proyecto que se usan y no se rediseñan:
  la lámina, la cartela, la placa de rótulo de núcleo, el halo de rótulo de paraje
  (SPEC-021 y SPEC-022); la lista de fases y la cámara del mapa (SPEC-026).

Elementos nuevos de esta fila:
  la cabecera de navegación del arranque — flecha de atrás y contador sobre cinco
  la fila de sugerencia de nombre — tocable, resorteable, femeninos primero
  la fila de oficio desplegable — una línea de sabor cerrada, un párrafo abierta
  la tarjeta del alcance del permiso — qué se pide y qué no, antes de pedirlo
  el pin arrastrable con círculo de alcance sobre mapa real
  la tarjeta de aventura con su medida en palabra del mundo

Elemento que NO se usa, y su ausencia es deliberada:
  ninguna barra de progreso, ningún porcentaje, ningún contador de segundos.
```

### data-testid

Los dos que `design-system.md` manda declarar siempre: el **estado del momento** es aquí `momento-antes-de-salir`, con la forma canónica que SPEC-020 dejó reservada; el **mapa** aparece dos veces y con dos identidades distintas, porque son dos cosas distintas —el mapa real de A1P4 y la lámina del mundo de A1P6— y confundirlas es exactamente el error que un identificador compartido produciría.

```
- `arranque`                — la pantalla entera del arranque, el ancla de todo flujo
- `arranque-paso`           — el paso actual, con un valor del vocabulario cerrado:
                              quien-eres · tu-tramo · el-permiso · donde-se-levanta ·
                              la-generacion · tu-mapa · la-primera-aventura
- `arranque-atras`          — la flecha de volver al paso anterior
- `arranque-contador`       — el contador sobre cinco
- `arranque-seguir`         — la acción única del pie, sea cual sea su texto

- `nombre-campo`            — el campo de texto del nombre
- `nombre-resortear`        — la acción «↻ otro»
- `nombre-sugerencias`      — la fila entera de sugerencias, para afirmar el orden
- `nombre-error`            — la línea que sustituye a nada cuando el nombre no vale
- `genero-femenino`         — la opción de femenino
- `genero-masculino`        — la opción de masculino
- `oficios`                 — la lista desplazable
- `oficio-<id>`             — cada fila, con el identificador del enumerado del núcleo
- `oficio-implicacion`      — el párrafo que se despliega bajo el oficio marcado

- `tramo-respuestas`        — la lista de las cuatro respuestas
- `tramo-<id>`              — cada respuesta, con el identificador de SPEC-004

- `permiso-alcance`         — la tarjeta que dice qué se pide y qué no
- `permiso-permitir`        — la acción que dispara el diálogo del sistema
- `permiso-a-mano`          — la alternativa de elegir el punto a mano

- `punto-mapa-real`         — el mapa real sobre el que se arrastra
- `punto-pin`               — la marca arrastrable
- `punto-circulo`           — el círculo de alcance
- `punto-generar`           — «Generar aquí»
- `punto-irreversible`      — la línea que dice que desde aquí ya no se vuelve

- `generacion-fases`        — la lista de fases (la declara SPEC-026 y aquí se reusa)
- `generacion-prologo`      — la línea que anuncia el prólogo
- `generacion-no-se-pudo`   — el estado de cuando no se puede levantar

- `mapa-lamina`             — la lámina del mundo en A1P6 (la declara SPEC-026)
- `trato`                   — el párrafo de las tres frases

- `primera-lista`           — la lista de lo que se cuenta hoy
- `aventura-<id>`           — cada tarjeta
- `aventura-medida`         — la palabra del mundo y su tiempo, dentro de la tarjeta
- `andar-sin-nada`          — la línea que dice que se puede salir sin coger ninguna
```

Sin más: los títulos, los ganchos y los nombres de los oficios son texto único y se localizan por su contenido.

### Patrón de interacción

- **Una acción por pantalla, al pie.** Regla: `design-system.md`, momento «antes de salir» —«elegir, leer, esperar»—; con dos acciones compitiendo abajo, elegir deja de ser un paso y pasa a ser una decisión, y el único sitio donde eso se quiere es A1P3, donde la segunda acción es precisamente la que impide que denegar sea una puerta cerrada. Por eso allí van apiladas y con peso distinto.
- **Volver atrás existe en las cinco primeras y no en las dos últimas.** Regla: `arranque.md`, el onboarding se puede abandonar sin castigo; y `bucle-jugable.md` §5, lo generado no se resiembra jamás. La flecha no es una comodidad: es lo que hace que denegar el permiso y arrepentirse del nombre no sean puertas cerradas. Y su ausencia después de A1P4 es la forma que toma en la interfaz el único invariante irreversible del juego.
- **El nombre llega escrito y las sugerencias son tocables, no un desplegable.** Regla: `personaje.md` §1, «se puede empezar sin escribir nada, y de paso nadie teclea su nombre real por inercia». Un desplegable obliga a abrirlo para saber qué hay; cuatro nombres a la vista se leen sin tocar y hacen su trabajo aunque nadie los use.
- **El oficio marcado se despliega en su sitio, no abre otra pantalla.** Regla: `personaje.md` §3, «la pantalla tiene que decir qué implica antes de que se cierre». Una pantalla de detalle por oficio convertiría una decisión permanente en una navegación; el despliegue informa en el momento de decidir sin volverse un muro de texto.
- **El género se elige en una línea, con el femenino ya puesto.** Regla: `lenguaje.md`, «en la duda, femenino»; quien no toque nada juega en femenino y quien quiera otra cosa lo cambia en un toque. No es un desplegable de tres opciones porque hoy hay dos y la tercera está abierta en `personaje.md`, pendiente 3.
- **El permiso se pide con la razón delante y con la alternativa a la vista.** Regla: `seguridad-privacidad.md` §2. La alternativa se enseña **antes** de que el sistema pregunte, no después de que alguien deniegue: enseñarla después la convierte en un rescate y sugiere que denegar fue un error.
- **El punto se elige arrastrando, no escribiendo.** Regla: `alcance-del-mundo.md` §2 y `design-system.md`, ninguna cifra; un campo de coordenadas sería la app hablando y además pediría números. El círculo comunica alcance y sale del tramo, y por eso no hay control de tamaño: no es una perilla, es una consecuencia.
- **La espera se cuenta en fases y no en cifras.** Regla: la misma que SPEC-026 fijó y que aquí solo se hereda; si el minuto se rompe, esta decisión se cae con él.
- **La irreversibilidad se dice antes de pulsar, nunca en un diálogo de confirmación.** Regla: `design-system.md`, los dos registros; un «¿Estás seguro?» es la aplicación desconfiando, y aquí lo que hay que hacer es informar. Decisión no cubierta por el sistema de diseño: se resuelve con una línea sobre el botón, y no con un `AlertDialog`, porque la decisión ya está tomada cuando se llega ahí y el diálogo solo añadiría un toque.
- **La frontera de registro es el botón «Salir a andar» de A1P7.** Regla: `lenguaje.md`, los dos registros. Hasta ahí el texto explica qué hace la aplicación; a partir de ahí solo habla el mundo. Las dos excepciones de dentro del arranque —las fases de A1P5 y el título y el párrafo de A1P6— son mundo dentro de la voz de aplicación y están declaradas como excepciones, no como deslizamiento.

## Notas técnicas

### Frontera de inyección

Dos entradas nuevas, las dos con doble en Node:

1. **Proveedor de ubicación** — pide el permiso «mientras se usa», dice si lo concedieron y, si lo concedieron, entrega una posición. Nunca guarda nada ni se vuelve a llamar fuera del arranque. Dobles: uno que concede y responde una posición fija, uno que deniega, uno que lanza. Su ausencia es error de construcción, no una caída silenciosa a la vía manual.
2. **Origen de entropía de la semilla** — `creaSemilla(entropia)` ya exige que la entropía llegue de fuera (SPEC-002). El arranque es quien la pide, y por eso la inyección se declara aquí. Doble: una entropía fija, que es lo que hace reproducible el recorrido entero del arranque.

El **almacén de la partida** ya entró con SPEC-026 y aquí solo se cablea; la escritura duradera sigue siendo de la fila 39.

### Lo que el núcleo gana, y por qué ahí y no en la app

Tres piezas, y las tres viven en `packages/nucleo/partida/` por la misma razón: son estado y secuencia, no pantalla, y ponerlas en `app/` las dejaría fuera de `node --test` justo en la máquina donde no hay simulador.

- **El personaje** — nombre, género gramatical, oficio y tramo, como área declarada del estado con su esquema cerrado, su congelación y su levantamiento, igual que las quince áreas que ya existen. Aquí viven el femenino de origen, el tope y el filtro del nombre escrito a mano, el sorteo de sugerencias con las femeninas primero y **la permanencia del oficio**, que es una regla del estado y no un botón que no se dibuja: un oficio que solo es permanente porque la pantalla de ajustes no lo ofrece se deja de serlo el día que alguien añade otra pantalla.
- **La secuencia del arranque** — los siete pasos, cuáles admiten volver atrás, qué campo recoge cada uno, la lista cerrada de campos, y la reanudación. Que la lista de campos sea cerrada y esté en el núcleo es lo que permite afirmar «no se pregunta la edad» sin recorrer siete pantallas en un dispositivo.
- **El guion de textos del arranque** — las cadenas de las siete pantallas, con su registro declarado (aplicación o mundo) y su pantalla. Es dato, no componente, y por eso «el onboarding habla como aplicación», «ningún texto lleva cifras» y «el suelo no se dice dentro» se comprueban leyendo una estructura en Node. Esto es una excepción declarada a la costumbre del repo de que el núcleo no exporte texto de juego (`tramo.js` ya la había abierto con `DECLARACION_DEL_SUELO`): el motivo es de verificabilidad, y se acota a los textos del arranque.

### La ficha de la tienda

`DECLARACION_DEL_SUELO` ya lleva el destino escrito al lado (`ficha-de-la-tienda`). Lo que falta y esta fila entrega es **el artefacto de la ficha**, generado desde esa constante y no escrito a mano, para que el día que el suelo cambie la ficha no siga diciendo el viejo. Va fuera de `app/`, porque su destino es fuera del juego.

### Lo que no se guarda

El arranque toca la posición de quien juega y por eso conviene decir qué sobrevive: **la coordenada redondeada del anclaje de la celda, y nada más**. Ni la posición que devolvió el proveedor, ni la posición donde se soltó el pin, ni ninguna marca de tiempo. Es RF-PRIV-002 aplicado en el único sitio del juego donde una coordenada exacta pasa por la mano de alguien.

## Decisiones asumidas

- **El botón de A1P6 es «Seguir» y la frontera de registro es el «Salir a andar» de A1P7** → asumido (alternativa: que A1P6 sea la última pantalla, como sugiere la maqueta, que dibuja «Salir a andar» en la 6 y cuya cabecera dice «la pantalla 6»). Regla: `docs/flujo.md` es el encadenado canónico, está verificado por `scripts/verifica-flujo.mjs`, y dice `A1P6 -->|"Seguir"| A1P7` y `A1P7 -->|"Salir a andar · fin del onboarding"| A3P1`; y `design-system.md` sitúa la frontera en «la última pantalla del onboarding». La maqueta se contradice consigo misma y se resuelve a favor del flujo.
- **El contador es sobre cinco y las dos últimas pantallas no lo llevan** → asumido (alternativa: contador sobre siete en las siete). Regla: la maqueta dibuja `1/5 … 5/5` y ninguna cabecera en la 6 ni en la 7, y es coherente con que la vuelta atrás termine en A1P4: un contador que sigue subiendo sin flecha de atrás promete algo que no existe.
- **Se sortean cuatro sugerencias de nombre** → asumido (alternativa: tres, o seis). Regla: la maqueta dibuja cuatro y caben en una línea a cualquier tamaño de letra; el número vive en una constante del núcleo para que cambiarlo no toque la pantalla.
- **Las sugerencias son dos femeninas y dos masculinas, en ese orden** → asumido (alternativa: cuatro femeninas, o un reparto que siga al género elegido). Regla: `lenguaje.md` pide «femeninos primero» y repertorio equilibrado; cuatro femeninas convertirían un sesgo en una imposición, y seguir al género elegido obligaría a resortear al cambiarlo, que es ruido.
- **El género gramatical tiene dos opciones y no tres** → asumido (alternativa: añadir una forma neutra). Regla: `personaje.md`, pendiente 3, la deja explícitamente sin decidir; inventarla aquí sería cerrar por la puerta de atrás una decisión de diseño abierta.
- **Cambiar el género después del arranque vive en ajustes, fila 38, y esta fila solo garantiza que el estado lo admite** → asumido (alternativa: dejarlo también dentro del arranque, con una pantalla propia). Regla: el reparto de filas del checklist, y RF-PJ-010 está en la fila 38.
- **La permanencia del oficio empieza cuando el arranque se cierra, no al pulsar «Seguir» en A1P1** → asumido (alternativa: fijarlo en cuanto se marca). Regla: la maqueta da flecha de atrás hasta A1P4 y dice «quien no se convence del nombre lo cambia antes de generar nada»; fijar el oficio antes de que exista mundo haría de la flecha una promesa falsa.
- **Denegar el permiso continúa por la vía manual sin pantalla intermedia** → asumido (alternativa: una pantalla que explique que se puede seguir sin ubicación). Regla: `seguridad-privacidad.md` §2 y la nota de la maqueta, «denegar el permiso deja de ser una puerta cerrada»; una pantalla de rescate convierte la denegación en un problema que hay que resolver, y aquí no lo es.
- **Al reabrir tras cerrarse durante la generación se vuelve a A1P4 con el pin donde se dejó** → asumido (alternativa: reanudar la generación donde iba). Regla: `arranque.md`, «al volver aparece en el paso anterior con lo que ya había contestado precubierto», y el criterio de SPEC-026 según el cual no queda ningún documento a medias escrito. Reanudar a mitad exigiría persistir una generación parcial, que es justo lo que aquella fila prohíbe.
- **Los ajustes de origen —«solo de día» encendido, «contar los pasos del día a día» apagado— se fijan en el estado inicial de la partida y aquí no se dibuja ninguna pantalla que los enseñe** → asumido (alternativa: enseñarlos en el arranque para que se vean). Regla: RF-PRIV-005 dice «de origen» y `seguridad-privacidad.md` §4 dice «sin preguntar nada»; enseñarlos en el arranque sería preguntar por la puerta de atrás, y la pantalla que los enseña es de la fila 38.
- **El guion de textos del arranque vive en el núcleo** → asumido (alternativa: dejarlo en los componentes de `app/`, como es costumbre). Regla: §6o; sin simulador, un criterio de contenido que solo se pueda leer en pantalla no se pone rojo nunca. Se acota a los textos del arranque y se declara como excepción, no como cambio de doctrina.
- **A1P4 dibuja un círculo y no la celda** → asumido (alternativa: dibujar la celda cuadrada de la rejilla, que es la verdad interna). Regla: la maqueta lo decidió por escrito —«el círculo comunica alcance y la celda es una consecuencia de cómo se cosen los mapas, que al jugador no le sirve de nada saber aquí»—; el criterio de anclaje redondeado sigue siendo el de SPEC-003 y no cambia por cómo se dibuje.
- **Una celda que no da para un mundo jugable se resuelve ofreciendo mover la marca, dentro de A1P4** → asumido (alternativa: ofrecer el estirón, o levantar el mapa igual). Regla: SPEC-026 declara la celda no jugable y deja a esta fila qué hacer con la declaración; el estirón es de la salida y no del levantamiento, y levantar igual sería entregar un mapa que parece un mapa y no lo es (§6h).
