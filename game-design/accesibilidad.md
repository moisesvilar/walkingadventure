# Accesibilidad (5-ago-2026)

Este juego da por supuestas unas piernas. Este documento decide hasta dónde se estira eso.

La decisión de encuadre, de la que cuelga todo lo demás: **la accesibilidad aquí no es un modo, es la unidad de medida**. No hay un "modo accesible" que activar, con su etiqueta y su diseño paralelo; hay un juego cuya unidad base es personal. Nadie elige dificultad: eliges cuánto andas y por dónde puedes andar, y eso lo elige todo el mundo.

Y una constatación que ahorra la mitad del trabajo: **el caso de la accesibilidad es el mismo caso del barrio de tres calles**, que `bucle-jugable.md` §7 ya ataca por tres sitios (más densidad en radios pequeños, lo social como motor de la repetición, el estirón que se ofrece y no se impone). Un tramo pequeño produce un mapa pequeño, y un mapa pequeño ya sabemos hacerla jugable. La accesibilidad no necesita mecánica propia: necesita que el caso pequeño esté bien resuelto.

## Decisiones

### 1. El tramo es una unidad personal, no una constante del mundo

Un tramo deja de ser "2 km" y pasa a ser **lo que tú andas en media hora**. Con eso se redimensiona solo el juego entero —el tamaño de las quests, hasta dónde te mandan, el reloj del mundo— y quien va en silla, quien anda despacio, quien se recupera de una operación o un crío de cinco años juegan **al mismo juego con la misma forma**, a otra escala.

**Se declara una vez y el juego lo corrige midiendo.** La pregunta se hace en lenguaje de sitios y no de distancias —"en media hora andando, ¿tú dónde llegas?"—, coherente con la decisión 3 de `bucle-jugable.md`: el juego no enseña números de distancia. Da igual acertar, porque a partir de ahí se ajusta solo.

Tres reglas que van con ello:

- **El ajuste no se comenta jamás.** Si el juego dice "últimamente andas menos", se convierte en una app de salud y en un reproche, que es justo lo que el resto del diseño evita.
- **Mide el ritmo andando, no el reloj de la salida.** Un café de veinte minutos no puede destrozar el número: las paradas son del jugador y no cuentan.
- **El tramo no redimensiona el mundo ya generado.** Choca de frente con el invariante de `bucle-jugable.md` §5 —lo generado no se resiembra jamás—, y la salida es que el tramo afecte a **hasta dónde te manda una quest**, nunca a **qué existe**. Consecuencia: separar el preset que dimensiona el radio del mundo del que dimensiona la salida deja de ser deuda menor y pasa a ser **requisito**.

Y una consecuencia bonita: **el reloj del mundo deja de estar en metros y pasa a estar en esfuerzo**. Dos jugadores muy distintos viven mundos que avanzan al mismo ritmo narrativo aunque uno haga 6 km y el otro 900 m. Es lo que la decisión 4 de `quests.md` quería —no penalizar a nadie por su circunstancia— llevado hasta el final.

### 2. El filtro sobre el grafo viario: evita y declara

La accesibilidad no es una opción de menú, es **un filtro sobre el grafo**. Y como el trazado de calzadas, la forma del lazo y el casting salen todos del mismo grafo, el filtro se propaga solo: el juego deja de mandarte donde no puedes ir sin que nadie escriba una regla especial.

**Lo que el dato permite filtrar** —y ya se descarga, salvo los tags: `highway=steps`, `surface`, `smoothness`, `width`, `kerb`, `wheelchair`. Escalones, tierra y bordillos son filtrables de verdad.

**Lo que no se puede prometer: las cuestas.** `incline` está poco mapeado y este proyecto no tiene modelo de elevación, solo `peaks`. Es justo lo que más importa en silla, y por eso hay que decirlo en vez de fingir que está cubierto.

**El filtro evita, no borra.** El mundo entero existe y se dibuja; el trazado y el casting sencillamente no te mandan por ahí. Y el mapa lo declara, en lenguaje del mundo —la Escalinata, la senda de tierra—, para que decidas tú: es el mismo patrón que el estirón de `bucle-jugable.md` §7, el juego dice la verdad y no decide por ti. Importa porque **tú sabes de tu barrio más que OSM**: una escalera puede tener una rampa al lado que nadie ha mapeado.

**Lo que nos inventamos nosotros nunca se promete como transitable.** `coserHuecos` une trozos sueltos del callejero hasta 180 m con aristas que no existen en OSM, y `buildRoutes` traza rectas `fallback` por donde no hay camino. Son suposiciones nuestras, no calles: bajo filtro no pueden darse por aptas.

**Los caminos difíciles necesitan nombre**, porque hay que poder nombrarlos al declararlos. Hoy los ramales nacen sin nombre a propósito. Y no es solo para el filtro: al dibujar el momento en marcha (6-ago-2026) sale que el desvío a un paraje se ofrece nombrando el ramal —«a mano izquierda se ve el tejado de O Fuso da Vella»—, así que sin nombre no hay ni declaración de camino evitado ni oferta de desvío.

Y si el filtro deja el mundo sin reparto, no hace falta respuesta nueva: es otra vez el barrio de tres calles.

### 3. Cada aviso viaja por dos capas, y el par mezcla bolsillo y pantalla

El aviso puede llevar contenido —enterarse de algo sin parar es parte de la gracia de caminar con esto— pero **nunca por un solo canal**. Y esto no va solo de sordera: va del móvil en la mochila, del silencio permanente, de ir hablando con alguien, de un háptico que en según qué bolsillo no se nota. Un juego que se apoya en que un aviso llega falla para casi todo el mundo alguna vez.

Tres precisiones sin las cuales la regla se cumple en el papel sin servir de nada:

- **El par mezcla siempre una capa de bolsillo con una de pantalla.** Háptico y sonido fallan a la vez para la misma persona, así que duplicar así no es duplicar. Un par válido es háptico o sonido **más** marca o notificación.
- **Respeta la reserva que ya existe.** `quests.md` guarda la notificación solo para las oportunidades, para que no se devalúe. Encaja sin tocar nada: las noticias van por háptico más marca; las oportunidades, por notificación más háptico.
- **El aviso se lee de un vistazo o no se lee.** Si lleva contenido, va completo en una línea. Nunca un "toca para saber más", que es exactamente lo que hace mirar el móvil andando.
- **Completo incluye dónde**, y esto es más fácil de romper de lo que parece (6-ago-2026). Un aviso que dice "en el cruce de aquí al lado" obliga a tocar para poder atenderlo, y entonces es un "toca para saber más" con otro disfraz. El mundo tiene nombres justamente para esto: se nombra el sitio. La prueba para escribir cualquier aviso es **si tocando se aprende algo que hacía falta, el aviso está mal escrito**.

Regla de mantenimiento: cada vez que se añada una forma nueva de avisar hay que volver aquí. Es la clase de invariante que se rompe sin querer.

### 4. El suelo es moverse, no andar

Cuenta **cualquier desplazamiento propio**: en silla, con andador, a paso muy corto, dando vueltas a un patio. El tramo personal baja hasta donde haga falta y el mundo se dimensiona a eso.

**El límite está medido, no es una postura.** Por debajo de unos 250 m de radio, `countsForRadius` da el mínimo absoluto —un núcleo de cada tipo— y `parajeCountForRadius` da un solo paraje: ahí un lazo todavía se compone, apurado. Por debajo ya no hay juego que montar.

Y ese límite **se dice claro y antes de instalar**, sin dramatismo. Hay gente para la que esto no puede ser su juego, y decirlo es más respetuoso que un modo de mentira.

## Lo que esto obliga a hacer

- Pedir los tags de accesibilidad en la consulta de callejero, que hoy no se piden.
- Separar las dos perillas que hoy comparten nombre: el preset que dimensiona el radio del mundo y el que dimensiona la salida. Ya no es deuda, es requisito.
- Reexpresar los cupos de `game-design/parametros-mundo.md` **en tramos y no en metros**, porque si el tramo es personal, un cupo calibrado en metros absolutos deja de significar lo mismo para dos personas distintas.
- Marcar en el grafo lo que es suposición nuestra (`coserHuecos`, `fallback`) para que el filtro no lo prometa.
- Dar nombre a los caminos difíciles, que hoy nacen sin él.
- Declarar el suelo en la ficha del juego, no dentro.

## Pendientes

1. **Qué cuenta como "moverse".** Silla eléctrica, bici, transporte: la decisión 4 dice "desplazamiento propio" y no zanja la propulsión. La respuesta probablemente pasa por el esfuerzo y no por el medio, pero arrastra el reloj del mundo — 20 km en bici serían diez pasos en una tarde, y el dimensionado deja de tener sentido. → **Medio cerrado el 6-ago-2026** en `bucle-jugable.md` §9: **el vehículo se aparta** (coche, autobús, tren), porque un autobús no es una duda de esfuerzo. La bici y la silla eléctrica siguen abiertas, que son donde la pregunta era de verdad. Con la regla para cuando la detección duda: medir el tramo excluye la velocidad de vehículo sin contemplaciones, y contar kilómetros y validar geofences **cuentan y validan en la duda**, porque un paso de más no le quita nada a nadie y no contar los de quien baja una cuesta larga en silla le borra su esfuerzo.
2. **Las cuestas.** Hoy no se pueden prometer. Si algún día hay modelo de elevación, se reabre.
3. **Cómo se pregunta el tramo** sin que parezca un formulario médico. Es redacción, y depende del tono cómico-cálido.
