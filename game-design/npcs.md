# La capa de NPCs (5-ago-2026)

Era el pendiente 2 de `quests.md` y el cuello de botella declarado del diseño de quests. Llega en buen momento, porque las decisiones del día ya habían decidido media capa sin nombrarla: el **rango por núcleo** define cómo te tratan, el **mote** cómo te llaman, y los **informantes** de `progresion.md` ya son un NPC con oficio y con precio.

Y empieza con una enmienda que abarata el pendiente entero. `parametros-mundo.md` daba por hecho que cada NPC con nombre consume un anclaje real propio —su casa—, lo que lo mete a competir por el recurso escaso que `parajes.md` acaba de proteger. Pero **el tabernero no necesita anclaje: ya está anclado en la taberna**. Regla general: **el NPC hereda el anclaje del sitio al que pertenece**, sea un servicio o el propio núcleo. Así el granjero está anclado en la granja, una aldea sin servicios puede tener cara igualmente, y la capa entera sale gratis en anclajes. Las "casas de NPC" quedan para más adelante y solo para quien no trabaja en ningún sitio.

## Decisiones

### 1. El reparto crece con lo jugado

El mundo no nace poblado. Cada sitio tiene una **cara titular** y las demás aparecen cuando una aventura las necesita — y a partir de ahí se quedan. Un mundo de paseo empieza con nueve personas y acaba con las que te hayan pasado cosas.

Es lo que protege lo único que hace valiosa esta capa: **que te reconozcan solo significa algo si el reparto se puede recordar**. Poblar de golpe cada posada con posadera, cocinera, mozo y camarero da veinticinco nombres el primer día y ninguno importa. Así, **cada cara que conoces la conoces por algo**.

- **Los NPCs son estado de partida, no del mundo.** El mundo generado tiene sitios; las personas nacen al usarse. Misma arquitectura que el motor de pasos y la cartografía: capa encima, nunca fase de `build.js`. Propiedad bonita que sale sola: dos jugadores con la misma semilla tienen **el mismo mundo y repartos distintos**, porque cada uno ha jugado otras cosas. (Desde `alcance-del-mundo.md`, compartir semilla es un acto deliberado y no el caso normal: el mundo lleva al jugador dentro.)
- **El casting no puede fallar por falta de gente**: si una plantilla pide un artesano, el sitio lo produce. Lo que estrecha el casting siguen siendo los lugares, nunca las personas.
- **El puesto es la clave, no el orden.** El NPC se genera determinista con `semilla + sitio + puesto` (posadera, mozo de cuadra, cocinera), jamás con un contador de aparición: si la clave fuera "el tercero que conocí aquí", el mismo mundo daría personas distintas según en qué orden jugaste.

### 2. El núcleo pone el fondo, él pone lo que vivió

Lo que el pueblo sabe de ti le llega por rumor y le llega deformado. Lo que él sabe lo sabe por haber estado. Su memoria es **corta y por hechos** —solo las veces que fue un rol en una aventura tuya— y guarda **la versión fiel**.

De ahí sale la mejor pieza de esta capa: en un mundo donde todo lo que se cuenta está deformado, **el testigo es la única fuente de verdad**, y volver a preguntarle es cómo se consigue. El contraste entre el que estuvo y el que lo oyó contar es el tema del juego convertido en mecánica.

- **El testigo no corrige lo que se cuenta en el pueblo.** Te da a ti la versión fiel y el pueblo sigue con la suya. Si el testimonio arreglara el rumor, el sistema de deformación se curaría solo y se moriría. Queda algo mejor: **puedes saber la verdad y seguir siendo famoso por una mentira.**
- **Engancha con la economía de `progresion.md`**: un informante te **vende** lo que oyó, deformado; un testigo te **cuenta gratis** lo que vivió, fiel. Lo que se compra es lo que se oye; lo que vivió contigo no tiene precio porque ya lo compartisteis.
- La memoria es dato vivo —el código bifurca por ella— y lo que dice al recordarlo es dato inerte con fallback. La frontera con el LLM no se mueve.

### 3. La franja es propiedad de la escena, no de la persona

No hay simulación de horarios ni de vidas: nadie ficha, nadie se va a dormir, nadie se mueve por el mapa. Los NPCs están donde les corresponde siempre que los busques. Cuando una aventura quiere una cita al caer la tarde, **es el beat el que declara la franja**, con el disparador `{tipo: franja}` que ya está escrito en `quests.md` §2 y sin usar.

Y la franja obedece la regla de la casa: **llegar a tiempo abre una puerta extra; llegar tarde no cancela nada**. La escena ocurre igual, contada de otra forma. Con eso las citas de `quests.md` §4 existen de verdad sin romper el "fallar por no llegar debe ser casi imposible" de §3 — y sin castigar a quien anda despacio, que es lo que `accesibilidad.md` no permite.

Ventaja lateral y grande: **nos ahorramos simular la vida de los NPCs**, que es exactamente lo que hace frágil esta capa en otros juegos.

#### El principio que llevaba todo el día apareciendo

Conviene escribirlo, porque ya gobierna cuatro sistemas independientes y no es casualidad: el **objeto-llave** abre otra puerta y nunca es requisito; el **estirón del mundo** se ofrece y nunca se impone; el **rango** cambia el trato y nunca cierra el catálogo; la **franja** añade una salida y nunca cancela la escena.

> **Lo que el jugador no controla puede abrirle puertas, nunca cerrárselas.**

Es la formulación general de "ignorarlo es gratis" y de "se falla por decisiones, no por piernas". Cualquier sistema nuevo debería poder pasar esta prueba antes de entrar.

### 4. Cambian por lo que haces, nunca por el tiempo, y lo roto se repara

Nadie se muda, envejece ni muere por el paso del tiempo: eso sería retirar algo por ausencia, y `quests.md` decisión 4 lo prohíbe explícitamente ("un paso… nunca caduca una quest, retira un NPC ni resta reputación **por no haber salido**"). Pero §6 abre el otro eje: lo que hiciste viaja **para bien y para mal**.

Así que **tus actos sí cambian el trato**, y una relación se puede quemar. Y se puede reconstruir: haciendo algo por esa persona se vuelve, no al punto de partida, pero sí a poder sentarse. La decisión pesa sin que la pérdida sea definitiva — que en un reparto de nueve personas sería desproporcionada — y aparece el mejor arco largo que puede tener este juego: **el de la reparación**.

Es, además, el único mecanismo del proyecto que puede ir hacia abajo. El rango no baja (mide cuánto te conocen, no cuánto te aprecian), los objetos no se pierden y el mapa no se borra: la relación con una persona concreta es donde vive la consecuencia de un acto feo.

## Lo que esto obliga a hacer

- **El NPC no consume anclaje**: hereda el del sitio. Es una enmienda a la capa "casas de NPC" de `parametros-mundo.md`, que quedan aplazadas y reducidas a quien no trabaja en ningún sitio.
- Generación **perezosa y determinista** por `semilla + sitio + puesto`, con la cara titular existiendo desde el principio en cada sitio.
- **Memoria por NPC**: lista corta de los hechos en los que fue rol, guardando la versión de nivel 0.
- Que el **testigo devuelva nivel 0** y el informante su propio nivel: dos fuentes con distinta fidelidad y distinto precio.
- **Franjas en beats, no en personas**, usando el disparador que ya existe.
- **Estado de relación por NPC** y su vía de reparación.

## Pendientes

1. **Si dos caras del mismo sitio cuentan como el mismo lugar para el casting.** Hoy hay una regla de que dos roles no pueden caer en el mismo lugar, y varias caras de una posada comparten coordenadas exactas. Propuesta pendiente de ratificar: **sí cuentan como el mismo lugar**, porque una aventura que te manda dos veces al mismo portal no es una aventura.
2. **Qué actos rompen una relación y qué la reparan.** No existe todavía una taxonomía de actos: hoy una quest tiene decisiones pero nadie ha clasificado cuáles son feas.
3. **Si hay tope de caras por sitio**, o si una posada muy jugada acaba con ocho personas.
4. **Si la cara titular tiene nombre desde el día 1** o se conoce al hablar con ella por primera vez — que enlaza con que el mundo no te llame por tu nombre hasta conocerte (`personaje.md`), y podría ser simétrico.
