# El bucle jugable (5-ago-2026)

Este documento responde a una pregunta que ninguno de los otros responde: **¿por qué querría yo salir a andar hoy?** No "cómo funciona una salida" —eso son piezas, y varias están decididas en `quests.md`— sino qué hace que esto apetezca la primera vez, y qué hace que siga apeteciendo el día ochenta.

La respuesta no puede ser "porque tengo una quest", porque las quests se acaban y el barrio no cambia. De ahí sale todo lo demás.

## Los tres pilares, y por qué no compiten

El placer del juego se apoya en tres cosas a la vez, sin jerarquía entre ellas:

1. **Cartografiar**: descubrir y fijar tu propio territorio. El mapa se gana.
2. **Lo que se cuenta**: el mundo reacciona, los rumores viajan y se deforman, lo que hiciste vuelve a ti contado por otros.
3. **La caminata como decisión**: los kilómetros son la única moneda escasa de verdad, y cada desvío se paga con piernas.

Que sean tres y estén equilibrados solo se sostiene si no son tres sistemas. Y no lo son, por dos razones.

**Comparten moneda: el tramo (~2 km, ~30 min).** Es lo que dimensiona un beat, lo que dura un paso del mundo y lo que tarda un rumor en avanzar un salto. Así que el equilibrio no es filosofía sino aritmética: una salida son N tramos y el diseño decide cómo se reparten entre ir a sitio nuevo, entregar y oír, y volver.

**Y el bucle se cierra solo**: andar cuesta piernas → lo andado fija territorio → el territorio fijado es por donde viaja lo que se cuenta → lo que se cuenta da la razón para volver a andar. No es casualidad: el mapa que ganas *es* el grafo por el que se propaga lo social (el árbol de `buildRoutes`), y el coste de andar usa la misma unidad que la latencia del rumor. Los tres pilares son las mismas tres variables que ya tiene el código —metros, saltos, tramos— vistas desde tres sitios distintos.

**Se relevan a lo largo de la vida de la partida.** La cartografía es lo que tira las primeras semanas y tiene fecha de caducidad; lo social no caduca pero no arranca hasta que hay territorio; la decisión táctica no caduca nunca, porque el cuerpo de hoy no es el de ayer. Los dos primeros se turnan encima del tercero.

## Los cuatro momentos de una salida

Lo único verdaderamente escaso que los tres pilares se disputan es **la atención del jugador mientras anda**, que por diseño debe ser casi cero (`quests.md` §8: el aviso de tres capas existe para no mirar la pantalla). Se resuelve dándole a cada pilar su momento, y de ahí sale una regla comprobable: **si un pilar se cuela en el momento de otro, está mal**.

1. **Antes de salir** — en casa, pantalla libre. Se elige aventura, se genera todo lo que haga falta (textos del LLM, imágenes del reparto) y, en modo de pasos de fondo, se vacía la reserva narrada. **Sin cobertura no se avisa de nada**: los textos salen de plantilla, el visor del anclaje cae a ficha de texto y la salida sigue adelante sin que ninguna pantalla lo llame fallo. Es lo que el diseño de fallbacks promete desde el principio, y anunciarlo solo serviría para señalar algo que el jugador no puede arreglar.
2. **En marcha** — pantalla prohibida. Solo háptico desde el bolsillo. La cartografía se registra sola y no pide nada. Al dibujarlo (6-ago-2026) sale la forma dura de la regla: **en marcha no hay ni un control tocable**, ni para aceptar un desvío ni para descartar un aviso ni para pausar, porque cualquier cosa tocable es una razón para sacar el móvil. Lo único que se puede tocar es lo que vive en la pantalla de bloqueo, y precisamente por ser del sistema y estar ahí de todos modos: el rótulo persistente, desde el que se da la salida por terminada (§8), y las notificaciones de oportunidad, que **abren el mapa con la marca del encuentro puesta**. Tocar un aviso no acepta nada —se acepta yendo— ni abre escena ni visor: solo ubica lo que el aviso ya contó entero, así que es una comodidad y nunca la única manera de enterarse (`accesibilidad.md` §3). El mapa, si lo miras, ocupa la pantalla entera con el norte arriba, sin nada encima, y tu posición es una marca roja del propio mapa y no un punto azul: estás dentro del mundo, no encima de él.
3. **Al parar en un lugar** — pantalla permitida, porque estás quieto y has validado la llegada. Aquí ocurre la revelación del anclaje, la escena, y lo que allí se cuenta. **Validar la llegada no es un gesto ni un disparo** (6-ago-2026): al detectar que estás parada dentro del geofence, la escena queda **disponible** y espera. No enciende la pantalla, no pone la app en primer plano, no te llama. Si miras, está ahí; si no, sigues andando y no ha pasado nada, que es lo que hace que pararse en un semáforo no tenga consecuencias. Se descartó abrirla sola, que no se pierde nadie nada pero convierte el móvil en algo que te llama en vez de avisarte.
4. **El telón** — de vuelta en casa. El mapa se entinta, el diario queda, y lo que hiciste sale corriendo por las calzadas.

## Decisiones

### 1. El mapa registra lo que sabes, no dónde estuviste

Cada elemento del mundo está en uno de **cuatro niveles de conocimiento**: *no lo sabes* · *lo ves* (está dibujado, sin nombre: una torre, unas ruinas) · *lo conoces* (nombre de fantasía, anclaje real, escena) · *lo conoces bien* (su historia, quién vive ahí, qué pasa según la estación).

El nivel de partida lo decide **la escala**: lo que se ve de lejos nace visible —picos, costa, bosques, núcleos y calzadas—, y lo pequeño no. Se sube de nivel de dos maneras, y esto es lo importante: **con las piernas o con la boca de otro**. Un rumor puede rotularte un sitio donde no has puesto un pie. Con eso la cartografía deja de ser un pilar aparte y engancha con lo social: el mapa y el diario pasan a ser el mismo objeto visto de dos maneras.

Dos restricciones duras que lo acotan:

- **El casting no mira lo descubierto.** Si una quest solo pudiera usar sitios ya pisados, los primeros días no habría juego, que es justo cuando el mundo menos castea (`test/casting-report.mjs` lo mide). Lo descubierto afecta a **lo que ves**, nunca a **lo que existe**.
- **Un sitio al que te mandan tiene nombre aunque no hayas ido**, porque la decisión 2 de `quests.md` guía por nombres de rutas y lugares. Te lo cuentan al encargarte la quest; lo que se gana andando es lo que no te ha contado nadie.

**El conocimiento se cobra al echar el telón, nunca en marcha** (6-ago-2026). Andar por sitio nuevo no produce nada en el momento: no vibra, no felicita, no se dibuja en vivo. Se registra en silencio y el mapa se entinta de golpe al llegar a casa. Se descartó un háptico de descubrimiento, que habría dado al pilar de la cartografía su momento mientras andas a cambio de meter un canal de aviso más en el único momento que se diseñó callado.

Y tiene una consecuencia que conviene ver: **el mapa en marcha no cambia durante la salida**. Lo único que se mueve en él es tu marca y las marcas de los avisos. Así mirar no aporta nada nuevo —que es justo el efecto que busca el momento 2— y el telón tiene algo que enseñar en vez de ser un trámite.

Consecuencia arquitectónica: el conocimiento es **estado de partida sobre el mundo**, igual que el motor de pasos. No toca la generación ni el determinismo.

### 2. La revelación del anclaje es el visor, y ocurre en el sitio

Al validar la llegada aparece el visor con slider: por defecto la imagen del mundo ficticio, y arrastrando se cruza a la foto del lugar real. Es el momento de máximo efecto del juego —el chiste y la magia son el mismo: que O Torreón Esquecido *es el chiringuito de Manolo*— y se paga con el único tiempo de pantalla en la calle que el diseño permite, el de estar parado.

Lo que eso obliga:

- **Las imágenes tienen que existir antes de salir.** Se aplica el patrón que ya rige para el LLM en `quests.md` (se invoca al crear la quest, nunca durante la caminata): se generan solo para el reparto de la quest aceptada, que son 3-5 lugares conocidos de antemano.
- **Lo que te pilla de paso sin imagen cae a la ficha de texto**, con el mismo principio de fallback digno que el resto del proyecto: nombre de fantasía, qué es en realidad, y la escena.
- **El visor no aparece nunca en marcha**, solo al validar llegada.

**La foto del lado real sale de Google Places, por el proxy, y se pide al crear el mapa** (6-ago-2026, al dibujar las pantallas). No al aceptar la aventura: en la generación, en la misma tanda que la consulta de Places que ya se hace. Con eso el móvil sigue mandando coordenadas **una sola vez** y `seguridad-privacidad.md` §1 se queda intacto, mientras que pedirlas por aventura habría mandado al proxy qué sitios reales tienes cerca y cuándo. De paso, el mapa entero queda utilizable sin cobertura, que es lo que `partida-guardada.md` §1 pide. El precio es el volumen de fotos por jugador; lo amortigua la caché del proxy por sitio, que las comparte entre todo el que pase por ahí, y si algún día aprieta el coste hay una variante que conserva la misma garantía: pedir solo los anclajes que acabaron siendo algo, en una segunda llamada al terminar de generar.

**Y donde Places no tiene foto** —cruceiros, molinos, miradores, que son justamente los anclajes que ensanchan el vocabulario de escenas— **el visor no se degrada a ficha de texto**. La ilustración de ficción sí existe, así que abre igual y el arrastre descubre la cartela con el nombre real sobre fondo liso. Se pierde la foto, no el momento.

**El visor es una capa por encima de la escena, no un paso previo** (6-ago-2026). La primera vez se abre solo y se cierra con una flecha abajo o tocando fuera, y debajo está lo que has venido a hacer. Con eso el visor de la primera visita y el visor que queda «a un toque» en las siguientes dejan de ser dos cosas y son **una con dos maneras de aparecer**, que es lo que hace concreta la decisión de abajo. Y evita el error de tratar la revelación como un trámite que hay que pasar para llegar al beat.

**La secuencia de una llegada**, que hay que dejar escrita porque no se deduce de nada:

1. **El visor**, si es la primera vez y el sitio tiene ilustración. Se cierra y deja debajo el resto.
2. **El beat**, si este sitio es uno del lazo de hoy o si te ha caído un micro-encuentro. **No siempre hay beat**: llegar a un sitio sin haber venido a nada es el caso normal y lo que hay entonces es la ficha del sitio.
3. **Lo que aquí se cuenta**, si el sitio es un núcleo. Va al final y no al principio: el beat es el motivo del viaje y el estado del pueblo es el marco, así que ponerlo delante convertiría en peaje algo que tiene que ser un regalo. Además así cabe dentro lo que se dice de lo que acabas de hacer en otro sitio, porque los rumores viajan (`quests.md` §6). **Si no hay beat, el estado del núcleo es la llegada entera.**

**La segunda vez que llegas al mismo sitio, el visor no vuelve a abrirse solo.** La pantalla abre por lo que ha cambiado —la escena de hoy, lo que aquí se cuenta ahora— y el visor queda a un toque. El chiste ya lo sabes, y repetir la misma ceremonia lo convertiría en un paso entre el jugador y lo que ha venido a hacer. Así volver se siente distinto de descubrir, que es exactamente lo que §5 quiere: profundizar y descubrir son premios distintos y no deben notarse igual.

Y de ahí sale una regla sencilla que evita tener dos comportamientos para el mismo gesto: **abrir la app enseña lo que corresponde al sitio donde estás**. Andando, el mapa; parada dentro de un geofence, la escena. Da igual por dónde entres —tocando el aviso, tocando el rótulo o abriendo la app a mano—, porque quien decide qué hay es el estado y no la puerta.

### 3. No hay presupuesto: la quest declara su tamaño

No se rellena un formulario de "cuánto ando hoy". Se ofrecen las aventuras y **cada una declara su tamaño con una palabra del mundo y su equivalencia aproximada en tiempo**: un paseo (~1 h), una aventura (~2 h), una jornada (toda la tarde). Se elige por antojo, no por aritmética, y el juego no enseña un solo número de distancia: nada de sabor a app de deporte.

Efecto secundario, y es una mejora: **la decisión táctica del pilar 3 se muda de antes de salir a durante la salida**. Ya no eliges cuántos tramos gastas en una pantalla; lo decides con las piernas cuando aparece el desvío al paraje o el micro-encuentro. *¿Me da hoy el cuerpo?* es mejor tensión en la calle que en un menú.

**Máximo tres a la vez** (5-ago-2026, al dibujar las pantallas). Es un tope, no un número fijo: algunos días habrá tres y otros una, según lo que castee en tu mapa y según tu oficio, y un día con una sola no es un día roto. Tres caben de un vistazo y se comparan sin leer; a partir de ahí la pantalla se convierte en un catálogo y elegir deja de ser un antojo para ser una compra.

### 4. Volverse a casa a mitad: cierre en corto, con final digno

Si el jugador se planta, se cansa o se vuelve, la quest **se resuelve a la baja** al llegar a casa: dos líneas contando cómo acabó sin él, o cerrando con lo que sí consiguió. Da la satisfacción de un final —que es parte de la diversión— y evita el hilo colgando, a cambio de un desenlace de repuesto escrito por plantilla.

Es texto inerte con fallback de plantilla, así que encaja tal cual en la frontera árbitro/narrador. Y refuerza la decisión 4 de `quests.md` en lugar de contradecirla: la quest sigue viviendo y muriendo en la salida para la que se dimensionó.

**El cierre en corto no genera rumor.** Si el mundo comentara que lo dejaste a medias estaríamos reprochando por la puerta de atrás justo lo que la decisión 3 dice que no se reprocha: nadie comenta que el jugador no fuese.

**Y el telón se echa igual**, haya o no aventura: el paseo se cierra con su mapa entintado y su diario.

**Una aventura solo puede estar «a medias» con la salida abierta** (5-ago-2026). Si llegaste a casa, el cierre en corto ya se disparó y no queda nada pendiente; lo que sí ocurre es cerrar la app andando, quedarse sin batería o que suene el teléfono. En ese caso, al volver a abrir aparece **la portada de siempre con una tarjeta arriba** que dice dónde lo dejaste y ofrece **seguir o dejarlo aquí**. No secuestra la app: desde ahí se puede mirar el diario o salir a andar sin ella, que es lo coherente con que abandonarla no cueste nada. La segunda opción hace falta porque la salida puede quedarse abierta sin que llegues a casa y sin rótulo del sistema donde cerrarla (§9), y «dejarlo aquí» dispara el mismo cierre en corto que llegar a casa.

### 5. El relevo: hacia dentro siempre, hacia fuera de vez en cuando

Cuando ya conoces tu mapa entero —en un barrio de tres calles, dos semanas— el juego tiene dos salidas, y se llevan las dos porque responden a comportamientos distintos del jugador:

- **Profundizar es continuo y automático.** Ocurre por volver al mismo sitio: es el nivel "lo conoces bien". Es el premio de la rutina, y no hay que hacer nada para merecerlo.
- **Crecer es un acontecimiento.** Cuando el mapa queda completa, el mundo se ensancha hacia los mapas vecinos. Es el premio de alejarse, y se nota porque pasa poco.

**Invariante duro: lo ya generado no se resiembra jamás.** El mundo crece cosiendo mapas vecinos, nunca regenerando el tuyo con otro radio. Hoy `countsForRadius` hace justo lo contrario —ampliar el radio cambia los cupos y con ellos el mundo entero—, así que esto es trabajo de verdad, no un parámetro.

Efecto colateral: si el mundo crece cosiendo mapas, **irse de vacaciones es un mapa que no toca con el tuyo**. Media respuesta gratis al pendiente "alcance del mundo".

→ **Resuelto el 5-ago-2026** en `alcance-del-mundo.md`, y el invariante deja de ser una promesa para pasar a ser una propiedad de la forma: los mapas son **celdas de una rejilla**, así que crecer no es regenerar sino generar otra celda, y los cupos se calculan una vez por celda. El mapa de vacaciones es una celda que no toca con la de casa, dentro de la misma partida.

### 6. Tono: cómico-cálido

El mundo se toma completamente en serio a sí mismo y el juego sabe perfectamente que es un chiringuito. La gracia está en el desajuste, y se declara. Es el único tono que aguanta cualquier anclaje sin ponerse ridículo —un polígono, una gasolinera, un parking— y convierte el peor material en el mejor.

Dos reglas que lo hacen sostenible:

- **El humor vive en cómo se cuenta, nunca en lo que pasa.** Los personajes se toman en serio a sí mismos y los hechos siguen importando. Si todo es chiste, la propagación de rumores deja de emocionar.
- **El chiste nunca es a costa del sitio real ni de quien lo regenta**, siempre a costa del desajuste. Sin esa regla, un juego sobre el barrio de la gente se convierte en burlarse del barrio de la gente, y encima con menores delante.

Regalo del tono: la escalera de deformación (fiel · abultado · trastocado · leyenda) es exactamente cómo crece un chiste y cómo funciona el cotilleo real. En este registro **la deformación no es una mecánica: es el humor del juego**.

Deuda que genera: los seis textos de `app/js/quests/templates.js` están escritos en registro de cuento popular y se quedan fuera de tono. Hay que reescribirlos.

### 7. El barrio de tres calles

No es el caso raro, es el caso normal, y hoy el generador ya avisa: en mundos de paseo con 2-3 parajes hay plantillas que no castean. Se ataca por tres sitios a la vez:

- **Lo social y profundizar** hacen que el barrio pequeño se juegue como una serie y no como un mapa: el sitio no cambia, cambia lo que se cuenta en él.
- **Más densidad en mundos pequeños**: donde hay poco territorio, más mundo por metro cuadrado. Esto reabre los cupos de `parametros-mundo.md`, que son decisiones cerradas con justificación de ritmo detrás. → **Resuelto el 5-ago-2026** en `parajes.md`: no es cuestión de densidad a ojo sino de un suelo derivado del catálogo (escenas que piden las plantillas ÷ escenas por paraje, hoy cuatro parajes), más la regla de que la cobertura de escenas manda sobre la afinidad del anclaje. El cupo por ritmo se queda como techo.
- **El estirón se ofrece, nunca se impone.** Si el barrio no da para un lazo, el juego dice la verdad ("por aquí cerca no hay hoy gran cosa que contar") y ofrece alejarse un tramo más. Deja de ser el juego decidiendo cuánto andas y pasa a ser información para tu decisión táctica, que es lo que el pilar 3 quiere.

### 8. El telón lo echa volver, y la salida manual vive en el rótulo del sistema

**La norma es volver** (6-ago-2026): la salida se cierra al regresar al punto de partida, y el lazo lo garantiza. Nadie tiene que decidir nada ni acordarse de pulsar nada. Y **volver es una cuestión de dónde estás, no de cuántos kilómetros pusiste tú**: si vuelves a casa en autobús has vuelto, y el telón cae igual aunque esos kilómetros no cuenten para el reloj del mundo (§9).

Pero hay salidas que no acaban donde empezaron —te quedas en casa de alguien, coges el bus, te recogen— y esas se quedarían abiertas hasta la próxima vez que anduvieras. Así que **existe una manera de dar la salida por terminada, y está en la notificación persistente del sistema**, no en la pantalla del juego. Con eso el control existe sin romper la regla del momento 2: lo tocable es del sistema, ya está en tu pantalla de bloqueo mientras hay salida abierta y no hay que sacar el móvil ni abrir nada para llegar a él.

Se descartó cerrar la salida sola al detectar que llevas mucho rato quieta: adivinar mal significa echar el telón sobre una aventura que seguía viva, y una parada larga es una cosa perfectamente normal —una comida, una siesta, una conversación— que el resto del diseño ya se ocupa de no penalizar (`accesibilidad.md` §1: las paradas son del jugador y no cuentan).

Cerrar a mano dispara lo mismo que llegar a casa, con el cierre en corto de §4 incluido: no es una salida de emergencia sino la misma puerta en otro sitio.

**Y el telón se echa solo, sin avisar** (6-ago-2026, al dibujarlo). Ni notificación —están reservadas a las oportunidades— ni la app poniéndose delante, que sería el móvil llamándote en lugar de avisarte. El telón ocurre; lo que espera es que lo leas, y al abrir la app es lo primero que hay.

**Qué se ve, y en qué orden**, porque no se deduce de nada y porque el orden es una decisión:

1. **El mapa se entinta.** Siempre, haya aventura o no y hayas vuelto entera o a mitad. Tres tintas y ninguna leyenda: lo de hoy recién puesto, lo que ya sabías asentado, lo que sigue sin saberse a lápiz. Lo ganado se dice en palabras del mundo —lo ves, lo conoces, lo conoces bien—, jamás en porcentajes ni en kilómetros.
2. **El desenlace**, si había aventura y la terminaste. Con el oro y los objetos, y con el rango dicho en una frase —«en Monfrida ya saben quién eres»— que hace el trabajo de un medidor de reputación sin ser uno.
3. **O el cierre en corto en su lugar**, si volviste a mitad (§4). Ocupa el sitio del desenlace, no el del mapa.
4. **Lo que se pone en camino**, solo si el desenlace era notable. Nunca después de un cierre en corto, que no genera rumor.
5. **La entrada del diario.** Siempre, y cierra.

**Y un paseo sin aventura es simplemente 1 y 5**, no una pantalla distinta con su propio título. La diferencia entre un paseo y una aventura no es que se cierren de otra manera: es que uno tiene desenlace y el otro no.

**Cuando no descubriste nada**, que con el tiempo es el caso normal y no el raro —tu vuelta de siempre, todo ya en «lo conoces bien»—, **el mapa sale igual y el título lo reconoce**: «hoy no has visto nada que no supieras». Se descartó saltarse la pantalla, porque haría desaparecer el objeto central del juego justo el día en que menos apetece salir. La línea hay que escribirla con cuidado para que suene a constatación y no a reproche, que es la misma cuerda floja de `accesibilidad.md` §1.

**El rumor se ve salir y no se ve llegar**, y jamás se ve deformarse. Enseñar la propagación sería el panel del estado del mundo que se descartó a propósito, y enseñar el nivel explicaría el mejor truco del juego en lugar de ponerlo en escena (`arranque.md`). Lo que se ve es que algo ha salido de ese núcleo, y ya.

### 9. Irse por otro lado (6-ago-2026)

Qué pasa cuando el jugador no va por donde el lazo decía. La respuesta de fondo es que **el juego no lleva la cuenta del trazado**: el guiado es por nombres de sitio (`quests.md` decisión 2) y lo que valida es el geofence del lugar, no el camino. La ruta dibujada es una sugerencia y no un contrato, así que «irse por otro lado» casi no existe como concepto. Cuatro casos y ninguno pide mecánica nueva:

- **Otra calle, mismo destino**: invisible. El juego no se entera y no tiene por qué enterarse.
- **A otro sitio**: no pasa nada. Ni «te has desviado», ni recalculando, ni marca que parpadee. Eso es un navegador, y además sería el reproche que §4 se cuidó de no meter por la puerta de atrás.
- **Pasar cerca de un beat por casualidad**, camino del supermercado: valida igual y la escena queda esperando. Es un regalo, no una anomalía.
- **La aventura sigue abierta** hasta que llegas a casa o la cierras a mano (§8). No hay ningún momento en que el juego la dé por muerta por su cuenta.

**El vehículo se aparta.** Coche, autobús, tren: detectada velocidad de vehículo, el motor de pasos deja de contar y los geofences dejan de validar hasta que vuelves a moverte por tu cuenta. Sin esto, un viaje en tren vacía el mundo de golpe y el dimensionado en tramos deja de significar nada, y encima saltarían escenas desde la ventanilla de un autobús. Cierra la mitad del pendiente 1 de `accesibilidad.md`: la bici y la silla eléctrica siguen abiertas porque ahí la pregunta es de esfuerzo y no de medio, pero un autobús no es una duda.

Y hay que decir **qué pasa cuando la detección duda**, porque una detección que puede fallar es una decisión disfrazada. Son tres efectos distintos y no aguantan el mismo criterio:

- **Medir el tramo**: aquí se excluye la velocidad de vehículo sin contemplaciones, y es barato equivocarse porque el tramo se corrige sobre muchas salidas. Es la extensión natural de lo que `accesibilidad.md` §1 ya dice — se mide el ritmo andando, no el reloj de la salida.
- **Contar kilómetros y validar geofences**: en la duda, **cuenta y valida**. Es la aplicación directa del principio de `npcs.md` —lo que el jugador no controla puede abrirle puertas, nunca cerrárselas— y la asimetría es clara: un paso de más no puede quitarle nada a nadie (`quests.md` decisión 4: un paso solo añade), mientras que no contar los kilómetros de quien baja una cuesta larga en silla le borra su esfuerzo, que es exactamente el fallo que `accesibilidad.md` existe para evitar.

Quien quiera recorrerse el juego en coche puede, y **no hay ningún marcador que proteger**: las trampas aquí solo se las hace uno a sí mismo. Se descartó por eso apretar la detección hasta que no se le escape nada.

**Y la salida que no vuelve a casa ni se cierra** —te quedas en casa de alguien, sigues de viaje, se te muere la batería— se resuelve separando dos cosas que se estaban confundiendo. **El servicio en primer plano se para** tras un buen rato sin que andes por tu cuenta, y el rótulo desaparece de tu pantalla de bloqueo: no puede haber un cacharro nuestro instalado ahí durante días. **La salida no se cierra**: espera en la portada con la tarjeta de §4, y si vuelves a andar el rótulo vuelve. Se descartó cerrarla sola pasadas unas horas, por el mismo motivo que se descartó cerrarla al quedarte quieta.

Que espere días no es un problema, y es una de esas veces en que el diseño ya se había pagado: el reloj del mundo son tus kilómetros, así que retomar el martes una aventura del jueves anterior no llega tarde a nada (`quests.md` decisión 4).

## Lo que esto obliga a hacer

- Reescribir los seis textos de fallback de `templates.js` en tono cómico-cálido, y añadir a cada plantilla su **desenlace de repuesto** para el cierre en corto.
- Extender a las imágenes la regla de invocación del LLM: se generan al crear la quest, jamás durante la caminata.
- Reabrir los cupos de `game-design/parametros-mundo.md` para subir la densidad en radios pequeños.
- Rediseñar el crecimiento del mundo para que cosa mapas vecinos sin resembrar la propia.
- Separar las dos perillas que hoy comparten nombre: el preset que dimensiona **el radio del mundo** (generación) y la palabra que dimensiona **la salida** (bucle).
- El estado de conocimiento del mapa es capa sobre el mundo generado, como el motor de pasos, y no una fase de `build.js`.

## Pendientes

1. ~~**Accesibilidad.** Estaba dentro de este pendiente y no se ha peloteado: el juego da por supuestas unas piernas, y hasta dónde se estira eso (distancias, ritmo, quien va en silla) sigue sin decidir.~~ → hecho: `game-design/accesibilidad.md`. No es un modo, es la unidad de medida — el tramo pasa a ser lo que tú andas en media hora y el juego entero se redimensiona solo.
2. ~~**Cuándo se echa el telón exactamente**: al volver al punto de partida (el lazo lo garantiza) o a mano. Propuesta pendiente de ratificar: lo primero, con lo segundo como alternativa.~~ → hecho el 6-ago-2026, §8: se ratifica volver como norma, y la salida a mano existe **en la notificación persistente del sistema** en lugar de en la pantalla del juego. Sale gratis porque el rótulo ya tiene que estar ahí por otra razón: es lo que mantiene la salida viva con el móvil bloqueado sin pedir el permiso de ubicación permanente.
3. ~~**El hueco de las primeras semanas**: la cartografía aún no ha dado de sí y lo social todavía no ha arrancado. Es el momento más frágil del bucle y no tiene respuesta propia.~~ → hecho: `game-design/arranque.md`. El mundo llega con pasado —rumores ya circulando y deformados antes de que aparezcas—, lo que además adelanta el mejor truco del juego a la primera salida en vez de a la tercera semana; la deformación se pone en escena sin explicarla; y el arranque termina, marcado una sola vez, cuando llegas a un núcleo y lo que allí se cuenta eres tú.
4. ~~**Si el preset de generación y el tamaño de salida son la misma perilla o dos.**~~ → resuelto de hecho en `accesibilidad.md`: si el tramo es personal y el mundo no se resiembra jamás, el ritmo de cada persona solo puede afectar a hasta dónde te mandan y nunca a qué existe. Separarlas deja de ser limpieza pendiente y pasa a ser requisito.
