# El diseño de pantallas

Índice de los artefactos del paso 2 del camino hacia el código (`docs/pendientes.md`): el diseño de las pantallas principales, uno por momento del bucle. Cada artefacto dibuja las pantallas de un momento y anota, pantalla a pantalla, de qué decisión de `game-design/` sale cada cosa.

**Para qué sirven.** No son maquetas bonitas ni especificación de implementación: son la herramienta que obliga a concretar lo que un documento puede dejar en el aire. El precedente que lo justifica es que **están cerrando pendientes que los documentos no habrían cerrado solos** — el pendiente 2 de `bucle-jugable.md`, medio pendiente 1 de `accesibilidad.md` y la validación de llegada salieron de preguntarse qué se dibuja en una pantalla concreta. Lo que cada uno devuelve al diseño se escribe en el documento correspondiente de `game-design/` y se relata en `docs/starting.md`; el artefacto es el sitio donde se ve, no la fuente.

**Convenciones que comparten los tres.** La paleta sale de `app/js/render/styles.js`, estilo Reino, en lugar de inventarse: tierra `#7fae5a`, mar `#3f7fa8`, tinta `#1e2b18`, marca `#c62828`, placa `#efe3c0`, filete `#8a6d34`. La tipografía separa las dos voces — **serif es lo que el juego dice, sans somos nosotros hablando de él** —, que es la aplicación visible de los dos registros de `lenguaje.md`. Cada nota lleva su procedencia (`bucle §3`, `quests, decisión 4`) y las decisiones nuevas van marcadas. Y los copies se escriben con las reglas de `/no-ai-slop-es`.

**Cada artefacto lleva un bloque con la secuencia**, y esto se aprendió a base de que faltara. Una pantalla dibujada aparte no dice cuándo aparece ni qué va antes o después, así que hay que escribirlo a propósito: qué se ve siempre, qué es alternativa de qué, y qué solo sale bajo condición. Los artefactos 4 y 5 lo tenían mal hasta que alguien intentó leerlos en orden — en el 4 no había manera de pasar del visor a la escena, y en el 5 parecía que el cierre en corto era una alternativa al mapa.

**Los enlaces son privados**, así que los seis HTML están además copiados en `docs/pantallas/`. No es redundancia: el paso 3 escribe el PRD a partir de ellos y no puede depender de una página que solo ve una persona. Al republicar un artefacto hay que refrescar su copia.

**Y el flujo entre todas ellas está en `docs/flujo.md`**, en un diagrama de estados con las 40 pantallas como nodos y la acción o condición que lleva de cada una a la siguiente en las aristas. Es la vista que ningún artefacto por separado puede dar. Se comprueba con `node scripts/verifica-flujo.mjs`, que extrae las pantallas de los HTML de `docs/pantallas/` y falla si alguna no está en el diagrama, si el diagrama inventa alguna, si un nodo miente sobre a qué pantalla pertenece o si alguna queda sin ninguna arista.

## 1 · Arranque

**https://claude.ai/code/artifact/e0333dce-b1d7-45e1-a8c0-767ca9bf9e4a**

Siete pantallas, de abrir la app por primera vez a salir a andar. Es el único momento que habla como aplicación y no como mundo, y la frontera es el botón de salir de la última pantalla.

Cubre la explicación de qué es esto, el permiso de ubicación, la pregunta del tramo en lenguaje de sitios, la creación del personaje (nombre y oficio), la generación del mapa y la primera aventura. Lleva navegación hacia atrás con progreso 1/5…5/5, y la lista de oficios va con scroll para que escale.

Devolvió cinco decisiones al diseño: **el permiso de ubicación se adelanta** al levantar el mapa, porque generar necesita saber por dónde andas y eso ocurre antes de la primera salida · **el nombre se pide en el onboarding**, deja claro que es del personaje y no de la persona, y llega con uno ya sorteado para que se pueda empezar sin escribir nada · **Overpass propio en nuestro servidor**, que cierra el pendiente 1 de `arquitectura.md` y cuyo motivo es la fricción antes que la privacidad, porque la espera contra los mirrors públicos cae justo en el onboarding · **el declutter de rótulos** deja de ser deuda vaga y pasa a `arquitectura.md` como algoritmo · y **el renombrado de «comarca» a «mapa»** en trece documentos.

De aquí salió además `game-design/lenguaje.md`, que no existía, con la regla de que **ningún texto puede depender de un número que solo existe en la maqueta**: la destapó un copy que decía «hoy solo son dos nombres en un mapa» porque la maqueta dibujaba dos pueblos.

Iteración: `docs/starting.md`, 5-ago-2026 (XIII).

## 2 · Antes de salir

**https://claude.ai/code/artifact/1b26de48-4b4c-407d-a737-4d094b12a686**

Cinco pantallas: la portada, el zurrón de lo que pasó mientras no estabas, la lista de aventuras, la ficha de una con su lazo dibujado, y la preparación. Es el único momento en que el juego pide atención, porque estás en casa y parada.

Dibujar la portada obligó a decidir qué **no** hay en ella, y las tres ausencias son decisiones viejas que aquí tienen por fin consecuencia visible: sin panel del estado del mundo, sin marcador de reputación y sin una sola cifra de distancia.

Cuatro decisiones nuevas: **máximo tres aventuras a la vez**, que es un tope y no un número fijo, porque a partir de ahí la pantalla se vuelve catálogo y elegir deja de ser un antojo · **la aventura a medias es una tarjeta en la portada**, y solo existe con la salida abierta, porque si llegaste a casa el cierre en corto ya se disparó · **sin cobertura no se avisa de nada**, así que la pantalla de preparación dice lo mismo haya red o no · y **no hay selector de mapas**, el activo lo decide dónde estás y los antiguos se leen desde el diario.

Iteración: `docs/starting.md`, 6-ago-2026 (XIV).

## 3 · En marcha

**https://claude.ai/code/artifact/564d2454-67ea-4c3b-a6ee-9d6d1dde97be**

Siete pantallas, y casi todas existen para justificar por qué el móvil sigue en el bolsillo: el bolsillo, el mapa si miras, la noticia que llega, la oportunidad, el desvío, un camino evitado, y una séptima dibujada tachada — la de kilómetros, ritmo, barra de progreso y racha de seis días, que es la que este momento pide sola y la que se colaría si nadie dice que no.

La pieza que no estaba y sostiene tres cosas: **una salida abierta arranca un servicio en primer plano con notificación persistente**. Con él la app cuenta como «en uso», así que el permiso de ubicación de `seguridad-privacidad.md` §2 se queda tal cual está escrito; el rótulo es austero y visible a propósito; y da sitio a la salida manual, que cierra el pendiente 2 de `bucle-jugable.md`.

El resto de lo cerrado: **el telón lo echa volver**, y volver es cuestión de dónde estás y no de qué kilómetros pusiste tú · **en marcha no hay ni un control tocable**, y lo único tocable vive en la pantalla de bloqueo por ser del sistema · **el descubrimiento se cobra al telón**, con lo que el mapa en marcha no cambia durante la salida y mirar no aporta nada nuevo · **norte arriba** y tu posición como marca roja del propio mapa · **validar la llegada no es un gesto ni un disparo**: la escena queda disponible y espera · **abrir la app enseña lo que corresponde al sitio donde estás**, no al botón que tocaste · **un aviso completo incluye dónde**, con la prueba de que si tocando se aprende algo que hacía falta, el aviso está mal escrito · **irse por otro lado no existe como concepto**, porque el juego no lleva la cuenta del trazado · **el vehículo se aparta**, contando y validando en la duda · y **el rótulo se retira sin cerrar la salida**, lo que obliga a que la tarjeta de a medias ofrezca seguir o dejarlo aquí.

Y una tarea que aparece en el generador: **los ramales a parajes pasan a necesitar nombre**, que hoy nacen sin él a propósito. Sin nombre no hay ni declaración de camino evitado ni oferta de desvío.

Iteración: `docs/starting.md`, 6-ago-2026 (XV), con tres apéndices.

## 4 · Al parar

**https://claude.ai/code/artifact/3b48032a-c56a-409e-a1c2-d390243a6f20**

Ocho pantallas: el visor por el lado de la ficción, el visor arrastrado, la escena, lo que te llevas, lo que aquí se cuenta, la segunda vez, la ficha de texto y el sitio que no pega. Es el momento por el que existe el juego, y el único trozo de tiempo de pantalla en la calle que el diseño concede.

Lo gordo fue la foto del lado real. **Sale de Google Places por el proxy**, y lo interesante no fue de dónde sino **cuándo**: pedir la foto de un sitio es mandar qué sitio es, y `seguridad-privacidad.md` §1 dice que del móvil solo salen las coordenadas al generar el mundo, una vez. Pedirlas por aventura habría obligado a enmendar la regla; **pedirlas al crear el mapa**, en la misma tanda que la consulta de Places que ya se hace, no cuesta ninguna llamada nueva y además deja el mapa entero utilizable sin cobertura. De ahí una lección de método que va a volver a hacer falta: cuando algo real tenga que salir del móvil, primero se mira si cabe en la llamada que ya existe.

El resto: **sin foto el visor no cae a ficha de texto**, porque la ilustración existe siempre y el arrastre descubre la cartela sobre fondo liso · **la segunda vez el visor no se abre solo**, la pantalla abre por lo que ha cambiado y el visor queda a un toque, para que volver se sienta distinto de descubrir.

Y tres decisiones que se tomaron por no dibujar algo: **sin retrato de NPC** (están en las ideas sin cerrar, y dibujar una cara los habría convertido en decisión por la vía de los hechos) · **un solo botón en la escena**, porque ramificar está aplazado · y **el ajuste de tamaño de letra sí entra**, único registro de aplicación en un momento que habla como mundo, porque el modo compañía es dos personas leyendo en voz alta del mismo móvil.

Iteración: `docs/starting.md`, 6-ago-2026 (XVI).

## 5 · El telón

**https://claude.ai/code/artifact/70799923-6b39-4765-947f-666f576604cd**

Seis pantallas: el mapa entintándose, el desenlace, lo que se pone en camino, la entrada del diario, el cierre en corto y el día que no descubriste nada. Es donde se paga todo lo que la salida guardó en silencio, y lo que le da sentido a que en marcha no pasara nada.

La decisión difícil fue el rumor: **se ve salir y no se ve llegar**, y jamás se ve deformarse. Enseñar la propagación por el árbol de calzadas queda precioso y es el sistema del que más orgulloso está el proyecto, pero es el panel del estado del mundo que la portada se negó a tener, y enseñar el nivel explicaría el mejor truco del juego en vez de ponerlo en escena.

El resto: **el telón se echa solo y sin avisar**, y lo que espera es que lo leas · **el oro sí se enseña como número**, porque la prohibición de cifras era sobre distancias y tiempos, mientras que el rango se dice con una frase y nunca con una lista de pueblos · **tres tintas en el mapa** y sin leyenda · **en el diario, lo tuyo en primera persona y lo oído aparte**, que tienen distinta autoridad.

Y dos cosas que salieron de leerlo en orden. **El telón es una secuencia con dos ramas, no seis caminos**: mapa siempre · desenlace, o el cierre en corto en su lugar · el rumor solo si era notable · diario siempre; un paseo sin aventura es mapa y diario, sin nada en medio. Y al desenredarlo apareció **el día flojo** — sales, no descubres nada, la lista se queda vacía —, que se resuelve enseñando el mapa igual con un título que lo reconozca, escrito para sonar a constatación y no a reproche.

Iteración: `docs/starting.md`, 6-ago-2026 (XVII).

## 6 · De consulta

**https://claude.ai/code/artifact/0fb0e9b3-d814-470b-b6d9-4d97590bfc5c**

Seis pantallas: la portada sin barra, el diario por días, la primera vez que triangulas, el diario por historias, la repisa y los ajustes. Las tres preguntas que traía se hicieron **antes** de dibujar, porque cada una cambiaba las seis pantallas a la vez.

**No hay barra de pestañas: la portada es la casa**, y el diario, la repisa y los ajustes son puertas que cuelgan de ella. Corrige el artefacto 2, que llevaba una barra de cuatro dibujada como propuesta: cuatro destinos de igual peso convierten el juego en una aplicación con secciones y dejan los ajustes con el mismo rango que el mapa.

**El diario se lee de dos maneras, y la segunda se gana.** Empieza cronológico; la primera vez que oyes una segunda versión de algo que ya tenías apuntado, el juego pone las dos juntas sin explicar nada, y a partir de ahí se puede leer también por historias. Agrupar desde el primer día habría regalado el mejor truco del juego; no agruparlo nunca lo habría dejado en algo que casi nadie llega a ver. El descubrimiento es del jugador y la comodidad viene después.

**Y el diario tiene un capítulo por mapa**, que es donde se leen los sitios donde ya no estás: ni cajón de láminas ni selector, tramos de tu vida con sus días y su mapa dentro.

El resto: **la repisa no es un inventario** —sin peso, sin huecos, nada que tirar— con los motes por núcleo debajo haciendo de ficha de personaje · y **los ajustes son la única excepción a la frontera de los dos registros**, anotada en `lenguaje.md`, porque un ajuste disfrazado de acertijo es peor que un ajuste.

Iteración: `docs/starting.md`, 6-ago-2026 (XVIII).

## El saldo del paso 2

Seis artefactos, treinta y nueve pantallas y ningún momento del bucle sin dibujar. **Catorce decisiones nuevas de diseño y tres pendientes cerrados** —el 2 de `bucle-jugable.md`, el 1 de `arquitectura.md` y medio del 1 de `accesibilidad.md`—, más un documento que no existía, `game-design/lenguaje.md`. Ninguna habría salido leyendo los documentos: salieron de preguntarse qué se dibuja en una pantalla concreta.

Lo siguiente es el paso 3, el PRD.
