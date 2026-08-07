# El alcance del mundo (5-ago-2026)

Cuánto mundo hay, de quién es y qué pasa cuando el jugador se sale de él. Llegaba medio resuelto: `bucle-jugable.md` §5 ya decía que **lo generado no se resiembra jamás** y que el mundo crece cosiendo mapas vecinos, `arranque.md` ya daba pasado a un mapa recién abierto, y `npcs.md` ya había separado lo que hace `build.js` (el mundo) de lo que vive encima (la partida).

## Decisiones

### 1. El mundo es del jugador, no del lugar

La semilla incorpora al jugador: dos personas en la misma calle ven mundos distintos, con otros nombres, otros núcleos y otros parajes. Se descartó que el mundo fuera del lugar —que el Mapa de Vilanova fuese el mismo para todo el que vive en Vilanova—, que era lo único que este juego podía ofrecer y ningún otro, a cambio de intimidad.

Y trae una consecuencia arquitectónica que hay que dejar escrita:

- **El mundo deja de ser una función del lugar y pasa a formar parte de la partida guardada.** Con `lat,lon#n` bastaba saber dónde estás para recalcularlo entero; con el jugador dentro, **tu mapa no se puede reconstruir sin tu semilla**. Eso convierte esa cadena en el dato más valioso de la partida: si se pierde, se pierde el mundo entero. Requisito duro para el pendiente de la partida guardada: **la semilla tiene que sobrevivir a un cambio de móvil**.
- **Ganancia de privacidad real**: nadie puede cruzar dos mapas ni deducir dónde vives a partir de nombres compartidos.
- **Y lo compartido no desaparece, cambia de naturaleza**: pasa de ser el defecto a ser un acto deliberado. Dos personas que quieran caminar por el mismo mundo pueden intercambiarse la semilla, así que conviene que sea algo **pasable**: corta, legible, copiable.

### 2. Los mapas son celdas de una rejilla

No círculos alrededor del jugador: celdas fijas que encajan entre sí. Con eso el problema técnico que `bucle-jugable.md` §5 dejó abierto se disuelve — **crecer deja de ser regenerar y pasa a ser generar otra celda**, y los cupos dejan de depender de un radio variable para calcularse una vez por celda y no cambiar nunca. El invariante de no resembrar deja de ser una promesa y pasa a ser una propiedad de la forma.

- **La rejilla es personal, como el mundo, y se dimensiona en tramos.** Una celda mide *k tramos tuyos*, así que el mapa de quien anda 2 km por tramo es mayor que la de quien anda 300 m, y las dos son igual de jugables. Es la regla de `accesibilidad.md` aplicada a la geografía.
- **Se ancla a una coordenada redondeada cercana a donde arrancaste, no a ti.** Estás dentro de tu celda pero no en su centro, que es lo que permite enseñar el mapa sin enseñar tu portal.
- **Y hay dos maneras distintas de que exista una celda vecina, que no hay que confundir**: se abre **por pisarla**, porque el mundo tiene que existir donde estás —y eso cubre a quien vive pegado a un borde—, o se abre **como acontecimiento** al completar la tuya, que es la recompensa que describe `bucle-jugable.md` §5. Una cosa es que el mundo exista y otra que se te premie.

### 3. Una partida, muchos mapas

Viajar lejos abre una celda nueva que no toca con la tuya, dentro de la misma partida. **Tú viajas entera**: personaje, oficio, repisa, diario y objetos.

Lo que no viaja es el **rango**, y no hace falta ninguna regla nueva para que no viaje: es por núcleo, así que en un mapa donde nadie ha oído hablar de ti **vuelves a ser forastera** automáticamente. Y eso no es un efecto secundario que haya que tolerar: es el arranque otra vez, que ya sabemos hacer y que es de lo mejor que tiene el juego. Con `arranque.md` el mapa nuevo además llega con pasado, así que el primer día allí ya se habla de algo.

Al volver a casa, en casa te siguen conociendo. Y el mundo de casa no ha avanzado en tu ausencia, porque el reloj son tus kilómetros y no el calendario (`quests.md` decisión 4): volver de tres semanas fuera es volver de tres días.

Esto sirve además la idea que estaba apuntada como "varias partidas para el mundo efímero de vacaciones": no hacen falta partidas separadas, porque **un mapa que no visitas no cuesta nada** y sigue ahí si algún día vuelves.

**Y no hay selector de mapas** (5-ago-2026). El mapa activo lo decide dónde estás: la app abre el de tu sitio, y si llegas a algún lado que no toca con ninguno de los tuyos, ofrece levantar uno nuevo. Al volver a casa vuelve el de casa sin preguntar nada. Es lo único coherente con un juego que va de andar, y de paso deja la portada limpia. Los mapas antiguos se pueden mirar desde el diario, que es donde vive lo que has vivido; leerlos sí, jugarlos desde el sofá no.

**Y la forma concreta es que el diario tiene un capítulo por mapa** (6-ago-2026, al dibujar las pantallas de consulta): abres el capítulo de aquel sitio y dentro están sus días, su gente y su mapa. Se descartó un cajón de láminas aparte, que era más directo para ver el dibujo pero se parecía demasiado al selector que este mismo apartado acaba de descartar. Cada mapa es un tramo de tu vida, no una opción de una lista. Con una asimetría que hay que asumir en lugar de corregir: el capítulo de casa tiene cientos de días y el de unas vacaciones seis — uno es un tomo y el otro un cuadernillo.

## Lo que esto obliga a hacer

- **Semilla con el jugador dentro**, corta, legible y copiable, y persistida como el dato crítico de la partida.
- **Rejilla de celdas** en lugar de radio: los cupos pasan a ser por celda, y `countsForRadius` deja de tener sentido tal como está.
- **Tamaño de celda en tramos del jugador**, no en metros.
- **Anclaje de la rejilla** a una coordenada redondeada, no a la posición exacta del jugador.
- **Apertura de celdas por dos vías** distintas —pisarla y completarla— con efectos distintos.
- **Lista de mapas** en la partida, cada una con su estado, su mapa y sus rangos.

## Pendientes

1. **El tamaño de la celda en tramos.** Hay criterio (una celda tiene que ser un mapa jugable, o sea contener el suelo de parajes de `parajes.md`) pero no número, y el número sale midiendo.
2. **Si lo que se cuenta de ti puede llegar a mapas lejanas.** Hoy no puede: los rumores viajan por el árbol de calzadas y dos celdas que no se tocan no tienen árbol común. Propuesta pendiente de ratificar: **que no llegue**, porque es coherente con que la reputación viaje a pie y porque volver a ser forastera es precisamente la gracia.
3. **Qué pasa con el árbol de calzadas en el borde entre dos celdas contiguas.** Al coser dos mapas, ¿se cosen también sus árboles, de modo que un rumor cruce de una a otra? Probablemente sí, y probablemente el tramo de costura deba contar como un salto más.
4. **Cómo se pasa la semilla** si dos personas quieren compartir mundo: formato, y si el juego lo facilita o simplemente no lo impide.
