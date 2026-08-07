# El arranque: las primeras semanas (5-ago-2026)

Cierra el pendiente 3 de `bucle-jugable.md`, que era el más frágil del bucle: el momento en que la cartografía todavía no ha dado de sí y la capa social aún no ha arrancado.

**El problema, acotado.** "Las primeras semanas" es demasiado vago. Los días 1 y 2 están cubiertos por la novedad: generas tu mundo, descubres que tu bar es una taberna, haces tu primera aventura. El agujero son **los días 3 al 10**: la novedad ya pasó, la cartografía funciona pero es un placer pasivo —se acumula sin drama— y lo social sigue en cero porque todavía no has hecho nada que nadie pueda contar. Lo más distintivo que tiene este juego, que el mundo reaccione a ti, necesita semanas para aparecer. Ahí es donde se pierde la gente.

## Decisiones

### 1. El mundo llega con pasado

El mundo no nace vacío en el paso 0: nace con unos cuantos pasos ya dados. Hay rumores circulando, versiones ya deformadas asentadas en cada núcleo, cosas que ocurrieron antes de que tú llegaras. El día 1 entras en una aldea y **ya están hablando de algo**.

No cuesta maquinaria nueva: es la propagación de `quests.md` §6 ejecutada antes de que empiece la partida.

- **El prólogo es del mundo, no de la partida.** Se siembra con la semilla del mundo y su propio sufijo, así que dos personas con la misma semilla oirían el mismo pasado. Es una propiedad del lugar, como los nombres.
- **No contradice que tus kilómetros sean el reloj.** El prólogo no es tiempo tuyo: es lo que pasó antes de que llegaras. Tu contador sigue empezando en cero.
- **Cuánto pasado es un criterio, no un número**: el prólogo dura lo que tarde en haber algo que contar en cada núcleo, y ni un paso más. Pasarse tiene un coste concreto y feo — si todo lo que oyes ya es leyenda de nivel 3, el mundo suena a museo en vez de a vecindario.
- **Y el mismo mecanismo sirve para tres arranques, no para uno**: el de la partida, el de un mapa nuevo cuando el mundo crece por los bordes (`bucle-jugable.md` §5), y el del mundo efímero de vacaciones. Llegar a un sitio donde no has estado nunca y que ya tenga vida es el mismo problema tres veces.

Lo que **no** se regala: tu diario sigue arrancando vacío. El pasado del mundo está en los núcleos, y solo entra en tu diario cuando vas.

### 2. La deformación se pone en escena, no se explica

El prólogo cambia el terreno del mejor truco del juego. Ya no hace falta que hagas algo notable y esperar semanas a que viaje: **el día 1 hay rumores viejos circulando en versiones distintas según el pueblo**, así que triangular es posible en la primera salida.

Y no se deja al azar. Cero tutorial, pero puesta en escena: el arranque **se asegura** de que un mismo suceso haya llegado a dos núcleos alcanzables en las primeras salidas con niveles distintos, y de que la primera aventura pase por los dos. El juego no dice nada; coloca el descubrimiento donde vas a tropezarte con él. Se diseña el encuentro, no se explica.

- **El prólogo se compone, no solo se simula.** Si la siembra no deja ese par, se resiembra hasta que lo deje — igual que el casting ya reintenta hasta que la plantilla encaja.
- **La primera aventura se elige también por dónde pasa**, no solo por si castea.
- **Y esto es del arranque y solo del arranque.** Si la puesta en escena se queda para siempre, el juego deja de ser un mundo y pasa a ser un guion.

### 3. El arranque termina cuando lo que se cuenta eres tú, y se marca

**El criterio no es una fecha ni un contador de salidas**: el arranque dura hasta que el mundo tiene material tuyo, y eso ocurre la primera vez que llegas a un núcleo y lo que allí se cuenta eres tú, contado por otros y no exactamente como fue. A partir de ahí el juego deja de prestarte pasado y se apoya en el que has hecho.

Ese momento **se marca**, narrativamente y una sola vez: una página del diario, una cartela. Nunca un "tutorial completado" ni un logro.

Y con una regla de redacción que es media decisión: **el hito dice que el mundo ha cambiado, no que el jugador haya aprobado**. "Ahora hay quien cuenta cosas de ti" y no "ya dominas las mecánicas". La diferencia es la que hay entre cerrar una etapa y admitir que llevabas ruedines.

## Lo que esto obliga a hacer

- Un **prólogo** del motor de pasos: ejecutar k pasos con siembra propia antes de que la partida empiece, y dejar el resultado asentado en los núcleos.
- Una **condición de composición** sobre ese prólogo, con resiembra si no se cumple: dos núcleos alcanzables, un mismo suceso, niveles distintos.
- Una **regla de selección de la primera aventura** distinta de la del resto: además de castear, tiene que pasar por esos dos núcleos.
- Un **disparador de hito** y su texto, en tono cómico-cálido, que se dispare una vez y no vuelva.
- Un **onboarding que se pueda abandonar sin castigo**: si el jugador cierra la app mientras se levanta el mapa, al volver aparece en el paso anterior con lo que ya había contestado precubierto. Generar tarda, y esa espera es el punto más frágil de todo el juego para perder a alguien — por eso también el Overpass propio de `arquitectura.md`.

## Pendientes

1. **Quien tarda un mes en producir algo notable.** Si el criterio de cierre es "hasta que se cuenten cosas de ti", quien juega poco o no completa aventuras no llega nunca, y el arranque no termina. Propuesta pendiente de ratificar: que el arranque también termine cuando el jugador ya ha visto el truco —dos versiones del mismo suceso en su diario— aunque no haya producido nada. Así cierra para todo el mundo, por una vía o por la otra.
2. **Cuántos pasos dura el prólogo.** Hay criterio ("hasta que haya algo que contar en cada núcleo") pero no número, y el número solo se puede sacar midiendo sobre mundos reales, como se hizo con el casting.
