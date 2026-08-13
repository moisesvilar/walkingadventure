# SPEC-046 — La fuente de salud y el zurrón: Health Connect, el motor del mapa activo y A2P2 alcanzable

## Descripción

Hoy el modo de pasos del día a día está entero salvo por su primera pieza: **no hay de dónde leer**. `app/plataforma/salud.js` declara la capacidad no montada, el interruptor de A6P6 recibe su callback en nulo, el motor del mapa activo no lo construye nadie desde `app/` y `app/pantallas/zurron.jsx` es la única pantalla del repo a la que no llega ningún import. Esta fila monta la fuente nativa —**Health Connect, solo Android**—, arma el motor de pasos del mapa activo, cablea la lectura al abrir y deja **A2P1 → A2P2 → A2P3** recorrible de verdad, con la reserva vaciándose al confirmar. La pareja de iOS entra como **doble declarado**: sonda con `disponible: false` y su motivo, porque hoy ningún iPhone puede verificar más.

Ninguna de las piezas sirve sola, y por eso van juntas: con fuente pero sin motor no hay dónde acreditar los metros, y con las dos pero sin zurrón montado la reserva se llenaría hasta el tope y no se vaciaría nunca.

Anclas: **RF-RUMOR-002**, **RF-RUMOR-006** y **RF-PRIV-003** (`docs/prd.md` §4.3 y §4.11), sobre `game-design/quests.md` **decisión 4** (la fuente de kilómetros y la reserva con su tope de cinco) y **decisión 3** (el resumen de apertura), y `game-design/seguridad-privacidad.md` **§2** (el permiso se pide en contexto; se lee al abrir y nunca de fondo). Prioridad **should**. Sale de **SPEC-043-iter-1**, que retiró el cableado del zurrón y movió sus tres criterios enteros a esta fila; consume **SPEC-042** (el lector, la orquestación de los pasos de fondo, la del zurrón y la pantalla, escritos y sin llamador), **SPEC-011** (el motor, la conversión, la reserva y su tope), **SPEC-016** (el estado y el registro de hechos), **SPEC-038** (la fila de A6P6) y **SPEC-047** (la partida en disco, de donde salen el registro y las áreas).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca, y por dos sitios**: aparece la **fuente nativa de salud** detrás de la interfaz que `creaLectorDeSalud` ya exige, y entra el **motor del mapa activo** como pieza que la app construye y pasa. Están descritos en «Frontera de inyección».
- **Una sola dependencia nueva y ninguna más: `react-native-health-connect`.** Es la decisión del dueño y no se reabre. Si algo de lo que aquí se pide necesitara otra, se para y se dice antes de implementarlo, en lugar de traerla.
- **Dos documentos entran en el mismo commit que el código que los hace ciertos, y no después**: `docs/flujo.md`, con la arista nueva por la que el sistema entra a A6P6 a preguntar por qué se piden los permisos, y `docs/iphone.md`, con la línea que anota en su decisión 1 que la clave de salud de iOS salió de `app.json` con esta fila. No son documentación a posteriori: son la parte de diseño de dos decisiones del dueño, y sin ellas la entrega está a medias.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** los **metros de una salida activa** convertidos en pasos (`abreSalidaDePasos` sigue sin llamador, y su ausencia se ficha en «Fronteras y huecos, con dueño»); **HealthKit en iOS**, que es la pareja de esta fuente y hoy no se puede verificar; la **fila «solo de día»** de A6P6 (fila 32), que esta fila no cablea y de la que solo sostiene que no se rompa; **`escena.cara`**, el spread de `app/pantallas/visor.js`, la decisión del proveedor de ubicación frío de `docs/pendientes.md` y el receptor de `BOOT_COMPLETED` de `expo-notifications`, que son rojos vivos ajenos; la **redacción** del envoltorio y de los textos de plantilla (filas 17 y 18, consumidos resueltos); y **lo que el mundo produce en un paso** como fuente de la cola (fila 19), que aquí entra declarado en nulo y no se inventa.

## Criterios de aceptación

Van en `Dado / cuando / entonces`, el mismo Gherkin español de `docs/testing.md`, y los que reproducen un escenario ya escrito llevan su nombre literal. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La fuente de salud existe», «El interruptor se enciende de verdad» y «El zurrón se recorre»; la **validación de entradas** en la fuente que devuelve metros inválidos, el permiso que llega con un estado que no está en el enumerado y el gancho con un valor no numérico; el **estado vacío** en la reserva vacía, el modo apagado y la partida sin mapa levantado; el **estado de error** en «Nada degrada por falta de cableado» —Health Connect sin instalar, permiso denegado, permiso revocado, fuente que no responde—; y los **casos límite** en la reserva exactamente llena, la app cerrada con el zurrón a medio leer, la confirmación repetida y la vuelta a la portada dentro de la misma sesión.

Los criterios de **`@determinismo` y `@privacidad` son bloqueantes**: nada se entrega con uno en rojo.

Casi todo se afirma en `@nucleo`, porque SPEC-042 repartió las rutas para que así fuera. Lo que necesita dispositivo va marcado `@app` y es lo de siempre: que el diálogo del sistema salga al tocar el interruptor, que una revocación hecha desde fuera lo apague, y que A2P2 se atraviese de verdad entre A2P1 y A2P3.

### La fuente de salud existe, y la sonda dice la verdad nueva

- **Dado** una compilación de Android con Health Connect disponible y el permiso concedido, **cuando** se sondea la capacidad `salud`, **entonces** declara `montado: true` y `disponible: true`, sin motivo.
- **Dado** una compilación de Android con Health Connect **no instalado o no disponible**, **cuando** se sondea la capacidad `salud`, **entonces** declara `montado: true`, `disponible: false` y un motivo que nombra que la app de salud del sistema no está.
- **Dado** una compilación de Android con Health Connect disponible y **sin permiso**, **cuando** se sondea la capacidad `salud`, **entonces** declara `montado: true`, `disponible: false` y un motivo que nombra el permiso, distinto del anterior.
- **Dado** la sonda de salud, **cuando** se sondea, **entonces** **no pide ningún permiso**: consultar no es preguntar, y el permiso solo se pide desde el interruptor.
- **Dado** una compilación de iOS, **cuando** se sondea la capacidad `salud`, **entonces** declara `montado: false`, `disponible: false` y el motivo dice que la fuente nativa de esta fila es Health Connect y solo Android.
- **Dado** los ficheros de `app/plataforma/`, **cuando** se busca la fuente de salud, **entonces** hay **pareja por sufijo** —`salud.android.js` y `salud.ios.js`— y las dos exportan exactamente los mismos nombres.
- **Dado** el registro de capacidades, **cuando** se enumeran, **entonces** siguen siendo las cinco de siempre y en el mismo orden: `salud`, `haptico`, `notificaciones`, `respaldo`, `rotulo`.
- **Dado** el gancho de capacidad ausente, **cuando** se abre la app con `walkingadventure://andamiaje?ausentes=salud`, **entonces** la app funciona entera, la fila de A6P6 sigue a la vista y vale «no», y nada se cae. Flujo: `test/app/gancho-capacidad-ausente.yaml`. `@app`

### Lo que se le pide a Health Connect, y lo que no

Bloqueante (`@privacidad`, RF-PRIV-003).

- **Dado** lo que la app declara pedirle a la app de salud, **cuando** se enumera, **entonces** son exactamente dos permisos y ninguno más: `android.permission.health.READ_DISTANCE` y `android.permission.health.READ_STEPS`.
- **Dado** esos dos permisos, **cuando** se busca quién los usa, **entonces** el de distancia alimenta `metrosEnVentana` y el de pasos alimenta `pasosEnVentana`, que es la caída cuando la fuente no tiene distancia: los dos se usan y ninguno está pedido de más.
- **Dado** el manifiesto fusionado de Android, **cuando** se revisa, **entonces** **no** aparece `android.permission.ACTIVITY_RECOGNITION`: no es de Health Connect, no lo usa nadie, y un permiso peligroso que se pide y no se usa es rojo.
- **Dado** lo que la app le pide a la app de salud, **cuando** se inspecciona, **entonces** no pide entrenamientos, ni sesiones con ruta, ni frecuencia cardíaca, ni ningún registro del cuerpo, ni nada con recorrido.
- **Dado** el manifiesto fusionado de Android, **cuando** se revisa, **entonces** no aparece ningún permiso que no esté declarado, y todo lo declarado sigue apareciendo. Guarda: `test/nucleo/manifiesto-generado.test.mjs`.
- **Dado** el manifiesto fusionado, **cuando** se cuentan los receptores que el sistema despierta con la app cerrada, **entonces** esta fila **no añade ninguno**, y los tipos de servicio en primer plano siguen siendo solo `location`.
- **Dado** la lista de tareas periódicas y la de módulos de fondo, **cuando** se leen, **entonces** siguen exactamente como estaban: los pasos se leen al abrir y con la app cerrada no se lee nada.
- **Dado** el `Info.plist` generado de iOS, **cuando** se revisa, **entonces** no declara ninguna clave de uso de salud mientras iOS no tenga fuente, y `NSHealthUpdateUsageDescription` —el permiso de escritura— sigue sin declararse nunca.
- **Dado** el permiso de ubicación, **cuando** se revisan los permisos que la app solicita, **entonces** solo pide la ubicación «mientras se usa». Escenario: «La app no pide el permiso de ubicación permanente».
- **Dado** la marca de agua de la lectura, **cuando** se busca dónde vive, **entonces** sigue fuera del estado y del registro de la partida, bajo el prefijo que las reglas de respaldo excluyen, y ni el estado ni el registro llevan ninguna marca del reloj real.

### «¿Por qué me pides esto?» abre A6P6

El sistema puede preguntar por la razón de los permisos de salud desde fuera de la app, y esta fila decide dónde aterriza esa pregunta. **La respuesta es A6P6**, que es donde la fila de contar los pasos y su línea de aviso ya dicen exactamente eso, escritas por quien pasó por las reglas de lenguaje.

- **Dado** el manifiesto fusionado de Android, **cuando** se revisa, **entonces** declara el filtro de intención de la razón de permisos de salud, y su destino es la actividad principal de la app.
- **Dado** una partida abierta y lista, **cuando** el sistema dispara ese intento, **entonces** la app abre **A6P6** y no la portada.
- **Dado** A6P6 abierta por ese camino, **cuando** se lee, **entonces** enseña la fila «Contar los pasos del día a día» y —si el permiso está denegado o revocado— su línea de aviso, **sin ningún texto nuevo escrito para esta entrada**.
- **Dado** una instalación recién hecha, sin partida o con el arranque a medias, **cuando** el sistema dispara ese intento, **entonces** la app cae al arranque de siempre y **no** monta A6P6 sobre una partida que no existe.
- **Dado** `docs/flujo.md`, **cuando** se lee, **entonces** declara esa entrada con sus dos condiciones escritas **en las aristas** —«razón de permisos de Health Connect, con partida» hacia A6P6 y su caída al arranque sin partida— y `node scripts/verifica-flujo.mjs` pasa: 41 pantallas, ninguna suelta, y dos aristas más que antes.
- **Dado** un aparato con la app instalada y partida abierta, **cuando** se dispara el intento por la puerta real (`adb shell am start -a androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`, o el que declare el manifiesto), **entonces** se ve A6P6 y se escribe qué se vio. `@app`
- **Dado** el mismo aparato **recién limpiado** (`adb shell pm clear com.walkingadventure.app`) y reinstalado, **cuando** se dispara el mismo intento, **entonces** se ve el arranque y se escribe qué se vio. `@app`

### El interruptor de A6P6 se enciende de verdad, y no miente

- **Dado** una instalación nueva, **cuando** se abren los ajustes, **entonces** la fila «Contar los pasos del día a día» está a la vista y vale «no», sin línea de aviso debajo. Escenario: «Los pasos de fondo vienen apagados».
- **Dado** la fila del interruptor, **cuando** se toca con la fuente disponible, **entonces** se pide el permiso de salud **en contexto y solo entonces**, y nunca al instalar ni al abrir. `@app`
- **Dado** el permiso concedido, **cuando** se vuelve a leer la fila **sin salir y volver a entrar**, **entonces** vale «sí» y no hay línea de aviso.
- **Dado** el permiso denegado, **cuando** se vuelve a leer la fila, **entonces** vale «no» y debajo aparece la línea en voz de aplicación, una sola vez.
- **Dado** el permiso denegado, **cuando** se vuelve a los ajustes más tarde, **entonces** la fila sigue en «no» y **no se reintenta pedir el permiso solo**. `@app`
- **Dado** el modo encendido y el permiso revocado después desde los ajustes del sistema, **cuando** se vuelve a la app y se abren los ajustes, **entonces** la fila vale «no» y lo dice, en lugar de seguir en «sí» sin leer nada. `@app`
- **Dado** una compilación sin fuente de salud —iOS, o el gancho de capacidad ausente—, **cuando** se toca la fila, **entonces** no se enciende, no se pide ningún permiso, y la línea que aparece dice que no se puede: encenderla es **imposible por construcción** y no un interruptor que miente.
- **Dado** la fila «Solo de día», que es de otra fila del checklist, **cuando** se toca, **entonces** la orquestación de los pasos de fondo **no la atiende y lo declara**, y no cambia el ajuste ajeno por el camino.
- **Dado** un jugador que apaga el modo, **cuando** lo apaga, **entonces** dejan de leerse pasos, la reserva que hubiera queda como estaba, y volver a encenderlo no recupera los kilómetros del tiempo apagado.
- **Dado** el núcleo, **cuando** se busca cómo sabe si el modo está activo, **entonces** lo recibe como dato de la partida y no consulta ninguna capa de la plataforma.

### El motor del mapa activo, montado

- **Dado** una partida abierta con su mapa levantado, **cuando** se busca el motor de pasos del mapa activo, **entonces** existe uno y lo construye la app, con la semilla de la partida, el identificador del mapa activo y las áreas `pasos`, `rumores`, `nucleos` y `entregas` de esa partida.
- **Dado** ese motor, **cuando** se enumeran sus productores, **entonces** son los dos que el paquete declara y en su orden: la propagación de rumores y la cola de entregas.
- **Dado** ese motor, **cuando** avanza un paso, **entonces** lo que produce entra en las áreas vivas de la partida y sobrevive a congelar y volver a abrir.
- **Dado** una partida sin mapa levantado, **cuando** se abre la app, **entonces** **no se monta ningún motor**, no se acredita ningún metro y se declara por qué, en lugar de acreditar pasos a un mapa que no existe.
- **Dado** una partida con dos mapas, **cuando** se acreditan kilómetros de fondo, **entonces** van al mapa activo en el momento de abrir la app y la reserva del otro no se toca.
- **Dado** dos aperturas con la misma semilla, el mismo mapa y los mismos metros leídos, **cuando** se ejecutan sus pasos, **entonces** salen los mismos pasos con los mismos números y los mismos efectos. `@determinismo`

### La reserva, de punta a punta

- **Dado** el modo encendido y metros nuevos desde la última lectura, **cuando** se abre la app, **entonces** se leen esos metros, se convierten en pasos con el tramo personal y quedan en la reserva del mapa activo.
- **Dado** dos aperturas seguidas de la app, **cuando** se leen los pasos en la segunda, **entonces** no se vuelven a contar los metros ya contados en la primera.
- **Dado** el modo apagado, **cuando** se abre la app, **entonces** no se lee nada, no se ejecuta ningún paso y ninguna pantalla lo llama fallo.
- **Dado** la app de salud que no responde, **cuando** se abre la app, **entonces** el juego sigue igual, la marca de agua **no se mueve** y ninguna pantalla habla de ello.
- **Dado** una lectura que devuelve metros negativos o no numéricos, **cuando** se procesa, **entonces** falla nombrando el valor recibido y no se ejecuta ningún paso.
- **Dado** una jugadora que no ha abierto la app en tres meses, **cuando** la abre, **entonces** la reserva contiene cinco pasos como mucho y el contador ha avanzado cinco, no noventa. Escenario: «La reserva de pasos de fondo tiene tope de cinco».
- **Dado** una jugadora que ha andado 0 km en treinta días, **cuando** abre la app, **entonces** el mundo no ha avanzado ningún paso. Escenario: «Estar un mes sin salir no acumula mundo pendiente».
- **Dado** una compilación de desarrollo con el modo efectivamente encendido, **cuando** se abre `walkingadventure://andamiaje?metrosDeFondo=6000`, **entonces** esos metros se acreditan por el mismo camino que los de una lectura real y dejan reserva puesta.
- **Dado** ese mismo enlace **con el modo apagado o sin fuente**, **cuando** se abre, **entonces** no se acredita nada: el gancho es una fuente de metros y no una manera de saltarse el interruptor.
- **Dado** el gancho con un valor que no es un número finito y no negativo, **cuando** se lee, **entonces** no se acredita nada y se declara, en lugar de acreditar cero como si se hubiera leído.
- **Dado** una compilación de producción, **cuando** se abre ese mismo enlace, **entonces** es inerte y no acredita ni un metro.

### El zurrón se recorre: A2P1 → A2P2 → A2P3

Los tres primeros criterios son los que **SPEC-043-iter-1 derogó y movió enteros a esta fila**, recuperados con su redacción y trasladados al Gherkin español que usa el resto de esta spec.

- **Dado** pasos de fondo activos y reserva sin vaciar, **cuando** se pulsa «Ver qué se cuenta hoy», **entonces** se abre el zurrón y no la lista del día.
- **Dado** el zurrón a la vista, **cuando** se pulsa «Seguir», **entonces** se abre la lista de lo que hay hoy.
- **Dado** el zurrón ya visto y su reserva vaciada, **cuando** se vuelve a la portada y se pulsa «Ver qué se cuenta hoy», **entonces** se abre la lista del día y el zurrón no aparece por segunda vez.
- **Dado** sin reserva que vaciar, **cuando** se pulsa «Ver qué se cuenta hoy», **entonces** se abre la lista del día directamente, sin pasar por el zurrón. Escenario: «El zurrón solo aparece si hay reserva que vaciar».
- **Dado** el diario, la repisa o los ajustes abiertos, **cuando** se busca cómo llegar al zurrón, **entonces** no hay ninguna puerta que lleve a él.
- **Dado** `app/pantallas/`, **cuando** se calcula el cierre transitivo de imports desde la raíz de la app, **entonces** **no queda ninguna pantalla huérfana**: el recuento pasa de una a cero.
- **Dado** una reserva con pasos que sí produjeron algo narrable, **cuando** se abre la salida, **entonces** el zurrón trae de una a cinco entradas, en el orden en que se ejecutaron sus pasos, cada una con su sitio y su texto.
- **Dado** una reserva cuyos pasos no produjeron nada narrable, **cuando** se abre la salida, **entonces** no aparece el zurrón, no se hace ninguna llamada y la reserva se vacía igual.
- **Dado** el zurrón en pantalla, **cuando** se buscan cifras, **entonces** no hay ninguna: ni pasos, ni distancia, ni días, ni cuántas cosas han pasado.
- **Dado** el zurrón en pantalla, **cuando** se enumeran sus acciones, **entonces** hay una sola, la que lo cierra y sigue hacia lo que hay hoy, y ninguna entrada es tocable.
- **Dado** un zurrón leído hasta el final, **cuando** se confirma «Seguir», **entonces** se anexa el hecho del vaciado al registro de la partida y solo entonces la reserva queda vacía.
- **Dado** un zurrón enseñado y una app que se cierra antes de confirmarlo, **cuando** se vuelve a abrir la salida, **entonces** el zurrón vuelve con las mismas entradas y la reserva sigue sin vaciarse.
- **Dado** un zurrón ya confirmado, **cuando** se confirma otra vez, **entonces** se declara que ya estaba vaciado y **no se anexa un segundo hecho** del mismo vaciado.
- **Dado** la misma reserva, **cuando** se compone el zurrón sin narrador y con el doble del narrador, **entonces** las entradas, su orden, sus sitios y sus pasos son los mismos y solo cambia la piel. `@determinismo`
- **Dado** el zurrón sin cobertura, **cuando** aparece, **entonces** dice lo mismo que con cobertura y ninguna pantalla menciona la red.
- **Dado** un recorrido en el dispositivo con reserva puesta por el gancho, **cuando** se pulsa «Ver qué se cuenta hoy», **entonces** se ve A2P2 y al pulsar «Seguir» se ve la lista de hoy. Flujo: `test/app/zurron.yaml`. `@app`

### Nada degrada por falta de cableado

- **Dado** una compilación sin la dependencia nativa de salud resuelta, **cuando** se abre la app, **entonces** arranca entera, la portada y los ajustes funcionan, y la única diferencia es que el interruptor no se puede encender y lo dice.
- **Dado** el zurrón que no se puede cablear —sin motor, sin registro o sin presupuesto declarado—, **cuando** se monta el momento «antes de salir», **entonces** se dice nombrando la pieza que falta, en lugar de enseñar una portada que lleva a una pantalla vacía.
- **Dado** un estado de permiso que no está en el enumerado, **cuando** llega, **entonces** falla nombrándolo, en lugar de tratarse como concedido.
- **Dado** la partida tras leer los pasos al abrir y tras confirmar el zurrón, **cuando** se congela, **entonces** las dos escrituras quedan en disco y volver a abrir la app no las pierde.
- **Dado** `app/plataforma/contratos.js`, **cuando** se enumeran los contratos sin llamador, **entonces** `creaLectorDeSalud` y `creaMarcaDeAgua` ya no están en la lista.

### Determinismo, frontera del núcleo y privacidad

Bloqueante.

- **Dado** el código que esta fila añade a `packages/nucleo/`, **cuando** se busca en él, **entonces** no aparece `Math.random`, ni `Date.now`, ni `new Date`.
- **Dado** `packages/nucleo/`, **cuando** se revisan sus imports, **entonces** no importa React Native, ni Expo, ni la dependencia de Health Connect.
- **Dado** la batería de núcleo, **cuando** se ejecuta en un clon limpio sin instalar nada, **entonces** arranca y corre entera.
- **Dado** lo que cruza del lector hacia el núcleo, **cuando** se inspecciona, **entonces** son **metros, un número**, y ninguna ventana, ningún instante y ninguna marca del reloj real.
- **Dado** los textos que esta fila toca, **cuando** se leen, **entonces** son aptos para menores, ninguno reprocha nada y ninguno dice lo que quien juega se ha perdido.
- **Dado** el zurrón entero, **cuando** se busca qué sale del móvil por su causa, **entonces** lo único que sale son los huecos inertes de la llamada agrupada que SPEC-018 ya declara: ni el nombre real de ningún sitio, ni la reserva, ni cuánto se ha andado.

### Las guardas de recuento que esta fila mueve

- **Dado** `test/nucleo/pantallas-huerfanas.test.mjs`, **cuando** se ejecuta, **entonces** la lista declarada está vacía y el recuento medido también, con el cambio anotado en su cabecera.
- **Dado** `app/plataforma/contratos.js`, **cuando** se ejecuta su guarda, **entonces** la lista baja de cuatro entradas a dos y las que quedan son las de otras filas.
- **Dado** `test/nucleo/piezas-sin-consumidor.test.mjs`, **cuando** se ejecuta, **entonces** sigue con su lista vacía: los bloques que esta fila usa ya estaban enumerados, y el que se añada para el motor entra con consumidor desde el primer día.
- **Dado** `test/nucleo/limite-declarado.test.mjs`, **cuando** se ejecuta, **entonces** `zurron.yaml` sigue **sin** estar en la lista —no está hoy y no entra— y la columna no sube por esta fila.

## UX Design

### Wireframe textual

Esta fila **no dibuja ninguna pantalla nueva**: monta dos que ya están dibujadas y especificadas. Lo que sigue es lo que se implementa de cada una, sin rediseñar nada.

**A2P2 — El zurrón** (`docs/pantallas/pantallas-2-antes-de-salir.html`, pantalla 2 · artefacto 2; wireframe completo en SPEC-042 §UX). Se llega desde la portada al pulsar «Ver qué se cuenta hoy», y **solo** si el modo está activo y hay reserva sin narrar. Layout de pantalla de antes de salir, a pantalla completa, en serif y en voz de mundo. De arriba abajo: el rótulo en sans versalitas **«Mientras no estabas»**; el **envoltorio** como titular en serif; de una a cinco **entradas**, cada una con su **sitio** en sans versalitas y su **texto** en serif, con aire entre ellas y nada más; la línea de cierre en serif tenue; y, empujada al pie y **fuera del área que se desplaza**, la única acción, **«Seguir»**.

Sin estado vacío y sin estado de carga: si no hay nada que contar la pantalla no existe, y la llamada agrupada ocurre dentro de la espera que la apertura de la salida ya tiene. Lo que la pantalla pinta lo compone el núcleo; aquí no se calcula nada.

**A6P6 — Los ajustes**, grupo «El mundo», fila **«Contar los pasos del día a día»** (pantalla 6 · artefacto 6; catálogo cerrado en `partida/ajustes.js`). Lo que esta fila añade al dibujo que ya existe es **una sola cosa**: bajo la fila, y solo cuando el permiso se ha denegado o revocado, **una línea en voz de aplicación** con el texto que SPEC-042 ya dejó escrito —«Sin acceso a los pasos que guarda el móvil no se pueden contar.»—, en la sans de la pantalla, del color tenue de los valores, sin ningún control dentro. No ofrece ir a los ajustes del sistema, no ofrece reintentar y no insiste después. Es el único sitio del juego donde hablar como aplicación está permitido, y aquí ya se habla así.

El interruptor sigue pintándose como los demás y **su valor es el efectivo**: tocarlo no lo enciende, lo pide. Y A6P6 estrena **una segunda manera de llegar**, que no es una puerta del juego: el sistema puede abrirla desde fuera cuando alguien pregunta por qué se piden los permisos de salud. La pantalla no cambia ni una línea por eso — se llega a lo que ya hay.

**Aristas de `docs/flujo.md`: las del zurrón no cambian; entra una entrada nueva.** El diagrama ya declara `A2P1 -->|"Ver qué se cuenta hoy · solo con pasos de fondo activos y reserva sin vaciar"| A2P2` y `A2P2 -->|"Seguir"| A2P3`, y las dos siguen valiendo palabra por palabra: lo que SPEC-043-iter-1 retiró fue el cableado, no la arista.

Lo que sí se añade es la entrada del sistema, y va **con su condición escrita en la arista y no en un comentario**: un nodo de entrada que no es una pantalla —de la misma familia que los tres rombos que ya existen, `LLEGA`, `CIERRA` y `NUCLEO`, y que por eso no cuenta como pantalla inventada— con dos aristas: hacia **A6P6** etiquetada «razón de permisos de Health Connect, con partida», y hacia **A1P1** etiquetada con la caída sin partida lista. `node scripts/verifica-flujo.mjs` tiene que seguir pasando: **41 pantallas, ninguna suelta, y 96 aristas donde hoy hay 94**.

Una cautela al escribirlo, porque el verificador la castiga en silencio: los nodos que no son pantallas entran en el conjunto de decisiones que la comprobación de secuencias de llegada considera siempre transitables, así que **este nodo no puede tener ninguna arista hacia el subgrafo de la llegada** (A4P\*). Con sus dos únicos destinos —A6P6 y A1P1— no la tiene, y así se queda.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta fila hace alcanzables:
  A2P2  pantalla 2 · artefacto 2 — El zurrón       (dueña: fila 42; esta fila la monta)
  A6P6  pantalla 6 · artefacto 6 — Los ajustes     (dueña: fila 38; esta fila hace
                                                    funcionar su fila del interruptor)

Pantallas de otras filas con las que encaja, y que no se tocan:
  A2P1  pantalla 1 · artefacto 2 — La portada      (dueña: fila 28)
  A2P3  pantalla 3 · artefacto 2 — Lo que hay hoy  (dueña: fila 28)

Elementos del proyecto que se usan: la tipografía serif de la voz del mundo, la sans de
la voz de aplicación, el rótulo en sans versalitas, la fila de ajuste de tipo interruptor
y la entrada de zurrón —sitio y texto—, que ya existe y no tiene variantes por tipo.

Elemento nuevo: ninguno. La línea de aviso bajo la fila del interruptor es texto tenue
de la propia pantalla, no un componente.
```

### data-testid

Los que esta fila necesita **ya están declarados** por SPEC-042 y por el catálogo de ajustes, y no se inventa ninguno. Lo que cambia es que dejan de ser inalcanzables:

- `momento` — el momento del bucle; en A2P2 vale `antes-de-salir`
- `zurron` — la pantalla entera, que **no existe** si el modo está apagado o la reserva vacía
- `zurron-envoltorio` — el titular
- `zurron-entrada` — cada entrada, con el número del paso que la generó como etiqueta accesible
- `zurron-seguir` — la única acción
- `ajustes-pasos-de-fondo` — la fila del interruptor
- `ajustes-pasos-de-fondo-aviso` — la línea que aparece **solo** si el permiso se deniega o se revoca, y que hasta esta fila no la pintaba nadie
- `capacidad-salud` — la fila de la capacidad en el andamiaje, que ya existe y ahora puede salir disponible

Sin `data-testid` adicionales: los textos de las entradas son texto único y se localizan por su contenido, y las puertas de la portada ya tienen los suyos.

### Patrón de interacción

Las decisiones de UX de este flujo las cerró SPEC-042 y **aquí no se reabre ninguna**: el zurrón no se puede consultar, se lee una vez y se va; tiene una sola acción y ninguna manera de saltarlo; ninguna entrada es tocable; el permiso se pide al encender y solo entonces; denegar no se insiste. Lo que esta fila añade son tres decisiones de interacción que solo aparecen al cablearlo de verdad:

- **El interruptor cambia de valor sin salir y volver a entrar.** Regla: `design-system.md`, los ajustes hablan como aplicación y una aplicación que no repinta lo que acabas de tocar está rota. Medido: hoy la composición de A6P6 se memoriza sobre la misma referencia de partida, y el núcleo muta el área en sitio, así que un cambio no repintaría. Quien monta la pantalla tiene que forzar el repintado igual que ya se hace con la lista de sitios marcados.
- **La orquestación de los pasos de fondo atiende su fila y solo la suya.** Regla: §6h. El interruptor de «solo de día» es de otra fila del checklist; hacer que su toque entre por aquí sería una pieza que cambia un ajuste ajeno sin que nadie lo haya decidido. Lo que no se atiende se declara y se devuelve sin tocar nada.
- **El zurrón es un paso obligado del recorrido y no una tarjeta.** Regla: `docs/flujo.md` dibuja `A2P1 → A2P2 → A2P3`, y `portada.acciones` ya trae el destino resuelto. La app **obedece ese destino** y no lo vuelve a decidir, que es lo que impide que dos sitios distintos opinen sobre si hay zurrón.
- **Decisión no cubierta por el design system:** qué se lee de la reserva al volver a la portada dentro de la misma sesión. Se resuelve **releyendo la reserva del motor cada vez que la portada se recompone**, y nunca guardando la lista en una propiedad: vaciar la reserva sustituye el array entero, así que una referencia tomada antes seguiría trayendo los cinco pasos y el zurrón volvería a ofrecerse recién vaciado.

## Notas técnicas

### Lo medido el 12-ago-2026, antes de escribir esta spec

Todo lo de esta tabla se ha comprobado contra la fuente en esta rama, no heredado. La regla es la de §10-bis: **un negativo no se hereda — se vuelve a medir o se marca como sospecha.**

| Lo que se dijo | Lo medido | Dónde |
| --- | --- | --- |
| La fuente de salud no existe | **Cierto.** `montado: false, disponible: false`, con motivo | `app/plataforma/salud.js:16-20` |
| El lector está entero y sin llamador | **Cierto.** `creaLectorDeSalud`, `creaMarcaDeAgua`, `ZANCADA_M`, `VENTANA_INICIAL_MS`, `MOTIVOS_DE_LECTURA`, `CLAVE_DE_LA_MARCA` | `app/plataforma/lector-de-salud.js`; declarado en `app/plataforma/contratos.js:29-52` |
| Las dos orquestaciones están escritas y no las llama nadie | **Cierto.** `creaPasosDeFondo` y `creaZurron` no aparecen en `app/App.js` ni en ningún montaje | `app/salida/pasos-de-fondo.js`, `app/salida/zurron.js` |
| `zurron.jsx` es la única pantalla huérfana | **Cierto.** La lista declarada tiene una entrada y el recuento medido coincide | `test/nucleo/pantallas-huerfanas.test.mjs:47-49` |
| `creaMotorDeLaPartida` no tiene llamador | **Cierto.** Solo aparece en su propio módulo y en `test/nucleo/bucle-completo.test.mjs` | `packages/nucleo/partida/motor.js:46` |
| **No hay registro de hechos de la partida en la app** | **FALSO.** Lo trajeron las filas 47 y 50 | ver abajo |

**La premisa 3 de `SPEC-043-iter-1` es falsa hoy, y reduce el alcance de esta fila.** `App.js` sostiene `partida.registro` desde que abre la partida (`:271`), lo congela junto al estado (`:320`, `partidaGuardada.congela({ estado, registro })`), lo pasa a la portada (`:857`) y a las pantallas de consulta (`:818`), y `app/marcha/llegadas.js` lo recibe montado (`:427`). Es decir: **el registro de hechos ya tiene dueño en la app**, y `vaciaElZurron` puede anexar su hecho sin que esta fila construya nada. De las tres piezas que aquella iteración enumeró, esta fila trae **dos** —la fuente de salud y el motor de pasos— y **consume la tercera**. Queda escrito aquí en lugar de callarse, porque una fila que dice traer tres piezas y trae dos es una fila que nadie puede verificar.

Y una segunda medida que cambia el trabajo: **las dos aristas del zurrón nunca se retiraron de `docs/flujo.md`**. `SPEC-043-iter-1` dice que A2P2 «sale de la lista de aristas cableadas», y así fue en el código; el diagrama, que es la fuente normativa, sigue declarando `A2P1 → A2P2` y `A2P2 → A2P3` palabra por palabra. Lo que esa medida ahorra es exactamente una cosa: **no hay que reponerlas**, porque están.

Lo que **no** se sigue de ahí, y conviene decirlo aquí para que no se lea al revés: **esta fila sí toca `docs/flujo.md`**, por la entrada del sistema que decidió el dueño —el nodo nuevo y sus dos aristas hacia A6P6 y hacia el arranque—, y va en el mismo commit que el filtro de intención. Las dos cosas son verdad a la vez y no se cancelan: por el zurrón no se toca el diagrama, por la razón de permisos sí. Está escrito en el criterio de «¿Por qué me pides esto?», en el wireframe y en el reparto de rutas, y **el recuento pasa de 94 aristas a 96**.

### Las decisiones del dueño, y lo que obligan

Tres, tomadas con él delante y **no asumidas aquí**. Van escritas con su motivo porque el motivo es lo que explica el descarte, y sin él la siguiente fila lo volvería a discutir desde cero.

**1 · La fuente nativa es Health Connect y solo Android; iOS entra como doble declarado.** Hoy ningún iPhone puede verificar más, y una implementación que no se puede medir es una promesa. `react-native-health-connect` es la única dependencia autorizada. Obliga a: la pareja por sufijo, la sonda de iOS diciendo la verdad de su plataforma, y que HealthKit quede como decisión 1 de `docs/iphone.md`.

**2 · El aviso de razón de permisos de Health Connect abre A6P6.** Se descartaron las otras dos: responder «¿por qué me pides esto?» con la portada es **un portazo educado** —§6h en versión permiso, una puerta que al abrirse no dice nada y no protesta, y cuyo coste no desaparece sino que se difiere a Play—, y escribir una pantalla nueva es justamente lo que «no estires la fila» prohíbe. A6P6 no inventa nada: la fila de contar los pasos y su línea de aviso **son** la razón de permisos, ya escritas por quien pasó por las reglas de lenguaje. Obliga a cuatro cosas, todas normativas:

- **La entrada desde fuera lleva guarda.** El sistema puede dispararla con la app recién instalada o el arranque a medias, y A6P6 presupone partida. Sin partida lista se cae al arranque de siempre, y esa condición va escrita **en la arista** de `docs/flujo.md`, no en un comentario del código.
- **La arista va en el mismo commit que el filtro de intención.** Es la parte de diseño de la decisión y queda consumada aquí, igual que el nodo de A2P0 en SPEC-050.
- **No se escribe texto de producto nuevo.** Si al verlo en el aparato la línea de A6P6 se queda corta como razón de permisos, **eso es un hallazgo que se trae de vuelta**, no licencia para redactar.
- **Se verifica en el aparato por la puerta real**, disparando el intento en los dos estados —con partida y recién instalada— y escribiendo qué se vio. Son criterios de aceptación, no una nota.

**Cláusula de salida declarada.** Si al medirlo el enrutado no puede apuntar a A6P6 sin tocar la navegación más de la cuenta, **se para y se vuelve con la medida delante**. En ese caso el plan pasa a ser apuntar a la actividad principal sin pantalla, y el hueco se ficha en `docs/pendientes.md`. Lo que no se hace es improvisar una tercera vía sobre la marcha.

**3 · `NSHealthShareUsageDescription` se retira de `app.json`.** Dejarle a la guarda del manifiesto un falso positivo consentido **en la plataforma que justo estrena mirada** sería socavarla el mismo día que empieza a servir, y la vuelta cuesta una línea. Obliga a: retirar la clave, dejar `salud-lectura` sin clave de iOS en `permisos.js`, y **anotarlo en `docs/iphone.md`, decisión 1 (HealthKit)** —que ya nombra a esta fila— con una línea que diga que el texto salió de `app.json` con la 46 y vuelve el día que HealthKit entre, pasando entonces por las reglas de lenguaje. Esa anotación es entregable de esta fila y no un recordatorio.

### La fuente de Health Connect, y los dos permisos

La interfaz que la fuente tiene que cumplir la fija `creaLectorDeSalud` y **no se cambia**: `estadoDelPermiso()`, `pideElPermiso()` y `metrosEnVentana({ desde, hasta })` **o** `pasosEnVentana({ desde, hasta })`, todas asíncronas, con la ventana en milisegundos del reloj real. El lector prefiere metros si la función existe, y solo cae a pasos si no está.

De ahí sale cómo se reparten los dos permisos, que es lo que hace que ninguno esté pedido de más:

| Permiso | Para qué | Qué pasa si no está |
| --- | --- | --- |
| `android.permission.health.READ_DISTANCE` | leer los **metros caminados** de la ventana, que es lo que el motor de SPEC-011 convierte con el tramo personal | la fuente expone `pasosEnVentana` en su lugar |
| `android.permission.health.READ_STEPS` | leer los **pasos** de la ventana cuando la fuente no tiene distancia, convertidos con `ZANCADA_M`, constante y no personalizable | sin ninguno de los dos, el permiso está denegado |

La fuente decide **al construirse** cuál de las dos funciones expone, según qué permiso esté concedido: Health Connect concede permisos por tipo de dato y quien juega puede dar uno y no el otro. `estadoDelPermiso()` devuelve `concedido` si hay al menos uno, `denegado` si se preguntó y no hay ninguno, `sin-preguntar` si nunca se preguntó y `no-disponible` si Health Connect no está instalado o el SDK no está disponible en ese aparato. Esa última respuesta es la que hace que el interruptor sea **imposible de encender por construcción** en lugar de un toggle que miente: `creaPasosDeFondo` ya la traduce a `MOTIVOS_DE_APAGADO.SIN_FUENTE`.

**Lo que se retira, y por qué.** `ACTIVITY_RECOGNITION` está hoy en `app.json` y en `PERMISOS_QUE_SE_PIDEN` como el permiso Android de `salud-lectura`. No es el de Health Connect —es el del reconocimiento de actividad del sistema, la vía de Google Fit y de los sensores en crudo— y esta app no lo va a usar: sale de los dos sitios. `NSHealthShareUsageDescription` sale de `app.json` por lo mismo, del otro lado: mientras iOS no tenga fuente, es una cadena de uso sin uso, y vuelve el día que alguien monte HealthKit. `PERMISOS_QUE_SE_PIDEN` conserva la entrada `salud-lectura` con sus permisos de Android y sin clave de iOS.

**Lo que Health Connect añade al manifiesto y no es un permiso.** La comprobación de disponibilidad necesita un bloque `<queries>` con el paquete de la app de salud, y el sistema pide un destino para el aviso de por qué se piden los permisos —el filtro de intención de la razón en las versiones antiguas y el de uso de permisos con la categoría de salud en las nuevas—. Ninguno de los dos declara un permiso ni un receptor con acción de arranque, así que las guardas del manifiesto fusionado no cambian de forma; lo que sí hay que hacer es **volver a generarlo y volver a medirlo**, porque la lista blanca es lista blanca: cualquier `uses-permission` que la dependencia arrastre y nadie declare es rojo, y se mira uno a uno antes de admitirlo. **El destino del aviso es la actividad principal, y desde ella la app enruta a A6P6** cuando hay partida lista; la decisión y su cláusula de salida están arriba, en «Las decisiones del dueño».

### Frontera de inyección

Dos entradas nuevas, las dos con doble ya escrito o trivial de escribir:

- **La fuente de salud del sistema**, que entra por `app/plataforma/salud.android.js` y llega inyectada al lector. Su doble ya existe y es el contrato: `test/dobles/salud.mjs`, con las cinco situaciones que el lector distingue —lee metros, lee pasos, deniega, no responde, devuelve una barbaridad— y el recuento de ventanas y de peticiones de permiso, que es lo único que permite afirmar una ausencia.
- **El motor de pasos del mapa activo**, que la app construye con `creaMotorDeLaPartida` y pasa a las dos orquestaciones. No es una capacidad de plataforma y no lleva sonda: es una pieza del núcleo que la app arma con las áreas de su partida, y entra por la puerta —`app/nucleo/piezas.js`— como todo lo demás (SPEC-020, §6u).

Nada más cruza. Lo que va del lector al núcleo siguen siendo **metros, un número**, y el reloj real se queda del lado de la app, inyectado, para que la lectura se pueda comprobar sin esperar.

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `app/plataforma/salud.android.js` | la fuente de Health Connect y la sonda que dice la verdad de esta compilación |
| `app/plataforma/salud.ios.js` | la pareja declarada: mismos nombres exportados, sonda no montada con su motivo |
| `app/plataforma/index.js` | el import sin extensión, para que el empaquetador elija por sufijo |
| `app/plataforma/permisos.js` | los dos permisos de salud declarados, y `ACTIVITY_RECOGNITION` fuera |
| `app/plataforma/contratos.js` | la lista de contratos sin llamador, dos entradas menos |
| `app/plataforma/gancho.js` | el gancho `metrosDeFondo`, inerte en producción |
| `app/nucleo/piezas.js` | el bloque del motor de la partida, con lo que su consumidor enumere |
| `app/App.js` | el motor del mapa activo, la lectura al abrir, el paso del zurrón y el registro a la portada, y la congelación de las dos escrituras |
| `app/pantallas/antes-de-salir-montado.jsx` | el zurrón cableado con su llamada, su presupuesto y su calendario, y `alZurron` pasado hacia abajo |
| `app/pantallas/antes-de-salir.jsx` | A2P2 como pantalla del momento, entre la portada y la lista |
| `app/pantallas/consulta-montado.jsx` | la orquestación de los pasos de fondo pasada a los ajustes, y el repintado tras cambiar el interruptor |
| `app/pantallas/ajustes.jsx` | la línea de aviso bajo la fila del interruptor |
| `docs/flujo.md` | el nodo de entrada del sistema y sus dos aristas, con la condición escrita en cada una |
| `docs/iphone.md` | la línea de la decisión 1 que anota por qué salió la clave de salud de iOS y cuándo vuelve |
| `packages/nucleo/` | **nada**. Todo lo que el zurrón y la reserva necesitan ya está escrito y probado ahí |

El reparto está elegido para que **lo que se puede poner rojo sin dispositivo siga poniéndose rojo sin dispositivo**: el motor, la reserva, la decisión del zurrón, sus entradas, su orden, su tope, su caída a plantilla y su vaciado con hecho son propiedades de datos, y el lector se comprueba con su doble. Lo único que necesita aparato es el diálogo del sistema, la revocación desde fuera y el recorrido de las tres pantallas.

### El orden del cableado al abrir la app, que no es negociable

1. Se abre la partida y se levanta su mapa. Si no hay mapa con identificador de verdad, aquí se para: no se monta motor y no se acredita nada.
2. Se arma el motor del mapa activo sobre las áreas vivas de la partida.
3. Se lee la app de salud **una vez**, con el modo efectivo —pedido en los ajustes **y** con permiso de verdad concedido— y con las ventanas de salida activa restadas. Los metros que salgan se convierten en pasos, que entran en la reserva.
4. Se congela la partida: la reserva es estado, y perderla al cerrar sería perder lo único que el mundo hizo mientras nadie miraba.
5. Solo entonces se compone la portada, que es la que decide si «Ver qué se cuenta hoy» lleva al zurrón o a la lista.

Invertir 3 y 5 haría que el primer arranque tras acumular kilómetros llevara a la lista y el segundo al zurrón, que es exactamente el desfase de un día que nadie sabría explicar.

### Fronteras y huecos, con dueño

- **Las ventanas de salida activa llegan vacías, y se declara.** `lector.lee({ salidas })` las resta para no contar dos veces los mismos metros, y **hoy nadie las guarda**: no pueden vivir en el estado —SPEC-016 prohíbe las marcas del reloj real— y la app no tiene un sitio propio para ellas. Hoy eso no produce doble conteo, porque **`abreSalidaDePasos` no tiene llamador**: los metros de una salida activa no mueven el mundo por ningún camino. La fila que cablee esa conversión tiene que traer también las ventanas, y hasta entonces la lista viaja vacía **por escrito y no por descuido**.
- **`producciones` entra en nulo, declarado.** La cola de entregas no inventa nada en un paso sin fuente de producciones, y el paquete no exporta ninguna: lo que la cola tiene sembrado viene del prólogo, que SPEC-050 cableó. «Lo que el mundo produce en un paso» es de la fila 19 y no se resuelve de paso.
- **El aviso de razón de permisos ya no es un hueco: abre A6P6**, por decisión del dueño, con su guarda y su arista en `docs/flujo.md`. Lo que sigue abierto es una sola cosa, y con dueño: **si esa línea basta como razón de permisos ante Play**. Se mira en el aparato durante esta fila y, si se queda corta, vuelve como hallazgo — no se redacta aquí. La cláusula de salida por si el enrutado no cabe está arriba, en «Las decisiones del dueño».
- **`test/app/zurron.yaml` está escrito contra iOS en su tramo de revocación** —abre `com.apple.Preferences` y navega a Salud— y usa `paso-ajustes`, `paso-diario` y `paso-repisa`, que no existen: las puertas reales son las del pie de la portada. Con la fuente en Android, ese tramo se recorre por Health Connect y no por los ajustes de iOS. Es del dueño de `test/**`, que es `wa-qa-dev`, y se nombra aquí para que no se descubra en la ejecución.
- **Los rojos vivos que esta fila no toca y que se cruzarán con su medición**: el receptor de `BOOT_COMPLETED` de `expo-notifications` (fila que monte las notificaciones), `empezar-de-nuevo-copia` en iOS, y `en-marcha` más `telon` por el proveedor de ubicación frío, cuya decisión de producto está en `docs/pendientes.md`. Ninguno es regresión de esta fila y ninguno se arregla aquí.
- **La precondición de aparato limpio sigue siendo un paso explícito.** Cualquier tanda de `@app` cuyos números vayan a compararse se corre tras `adb shell pm clear com.walkingadventure.app` y reinstalación; y los dos manifiestos —el fusionado de Android y el `Info.plist` generado— se regeneran antes de leer la guarda, o la guarda deja constancia de que no miró nada.

## Decisiones asumidas

Las **tres decisiones del dueño** —la fuente, el destino del aviso de razón de permisos y la retirada de la clave de salud de iOS— no están aquí a propósito: están tomadas, no asumidas, y viven con su motivo en «Las decisiones del dueño» de las notas técnicas.

- **La bifurcación va por sufijo de fichero: `salud.android.js` y `salud.ios.js`** → asumido (alternativa: un solo fichero con una comprobación de plataforma dentro). Regla: `CLAUDE.md`, la bifurcación por sistema operativo vive solo en `app/plataforma/` y por sufijo, y `respaldo` y `rotulo` ya lo hacen así; un `if` de plataforma dentro de un módulo compartido mete la dependencia nativa en el árbol de iOS.
- **Los permisos declarados son exactamente `READ_DISTANCE` y `READ_STEPS`, y `ACTIVITY_RECOGNITION` se retira** → asumido (alternativa: dejarlo por si alguna vía futura lo necesita). Regla: la lista blanca del manifiesto fusionado y RF-PRIV-003; un permiso peligroso que se pide y no se usa es rojo, y «por si acaso» es exactamente la explicación que esa guarda existe para no aceptar.
- **La fuente expone metros si hay permiso de distancia, y pasos si no** → asumido (alternativa: pedir siempre los dos y exigir los dos). Regla: `creaLectorDeSalud` ya prefiere metros y cae a pasos, y Health Connect concede por tipo de dato; exigir los dos convertiría un permiso parcial en un modo que no se puede encender.
- **El motor del mapa activo lo monta la raíz de la app, una vez por partida y mapa** → asumido (alternativa: montarlo dentro de cada consumidor). Regla: §6h y lo que ya se hizo con el casting vigente; dos motores sobre el mismo estado son equivalentes, pero uno solo es el que se puede afirmar, y esconderlo dentro de dos sitios es cómo acaban discrepando.
- **Sin mapa levantado no se monta motor y no se lee nada** → asumido (alternativa: acreditar a un identificador de relleno). Regla: `exigeMapaId` lo dice en su propio error —avanzar un contador por defecto movería el mundo de casa mientras andas fuera—.
- **La lectura de salud ocurre al abrir la app y antes de componer la portada** → asumido (alternativa: leerla al pulsar «Ver qué se cuenta hoy»). Regla: `seguridad-privacidad.md` §2, «se leen al abrir»; y leerla después dejaría la decisión de si hay zurrón tomada con la reserva de ayer.
- **`metrosDeFondo` es un gancho de enlace profundo y respeta el interruptor** → asumido (alternativa: un gancho que acredite metros saltándose el modo, o un control en el andamiaje). Regla: `testing-framework.md` admite ganchos expuestos por la app y `gancho.js` ya es esa puerta; que respete el interruptor es lo que impide que la prueba verifique un camino que el juego no tiene. Matiza la regla de `gancho.js` de «no escribe nada en el almacenamiento»: este sí deja reserva, porque **es una fuente de metros y no un escritor de estado**, y lo que escribe es exactamente lo que habría escrito una lectura real. Sigue siendo inerte en producción.
- **A2P2 es una pantalla más de la máquina del momento «antes de salir»** → asumido (alternativa: montarla desde la raíz como los momentos de consulta). Regla: `docs/flujo.md` la pone entre A2P1 y A2P3 dentro del mismo momento, y `antes-de-salir.jsx` ya despacha el destino `zurron`; `alZurron`, que SPEC-043-iter-1 dejó como punto de extensión sin dueño, pasa a tener el suyo en lugar de retirarse.
- **El zurrón se cablea en `antes-de-salir-montado.jsx`, con la misma llamada y el mismo presupuesto que la preparación** → asumido (alternativa: un montaje propio con su presupuesto). Regla: SPEC-042 dice que el presupuesto del zurrón es el de la preparación y no uno propio, y el montaje ya arma el narrador y el calendario; dos montajes serían dos sitios donde declarar «sin narrador».
- **La orquestación de los pasos de fondo solo atiende su propia fila del catálogo** → asumido (alternativa: que atienda cualquier interruptor). Regla: §6h; hoy el único callback cableado se llevaría también el toque de «solo de día», que es de la fila 32, y cambiaría un ajuste ajeno sin que nadie lo hubiera decidido.
- **La reserva se relee del motor cada vez que la portada se recompone** → asumido (alternativa: pasarla como dato congelado al montar). Regla: `vaciaReserva` sustituye el array entero, así que una referencia tomada antes del vaciado seguiría diciendo que hay cinco pasos y el zurrón se ofrecería recién vaciado.
- **Las ventanas de salida activa viajan vacías, declarado** → asumido (alternativa: inventar un almacén de ventanas en esta fila). Regla: hoy no puede haber doble conteo porque los metros de una salida activa no mueven el mundo por ningún camino; construir el almacén sin su consumidor sería otra pieza que, al no estar cableada, no protesta.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / cuando / entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN`). Regla: `CLAUDE.md` y el grep que cruza specs y batería. Los tres criterios derogados por SPEC-043-iter-1 se recuperan con su redacción y solo cambian de palabra clave.
- **Sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`: esto es una app de móvil y la pantalla es la que es.
