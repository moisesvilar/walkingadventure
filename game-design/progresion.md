# Progresión y economía (5-ago-2026)

`quests.md` §6 repartía "recompensa inmediata (oro, objeto, XP) y persistente" sin que nadie hubiera decidido qué compran ni qué desbloquean. Este documento lo decide, y empieza por una constatación que reordena el pendiente entero:

**El juego ya tenía dos progresiones, y ninguna es numérica.** El mapa que se va llenando (`bucle-jugable.md` §1) y la gente que te va conociendo (`quests.md` §6 y el mote de `personaje.md`). Así que la pregunta no era qué progresión añadir, sino si hacía falta una tercera.

Y la restricción que lo gobierna todo: **subir de nivel en un juego cuyo techo son tus piernas premia a quien más anda**, que es exactamente lo que `accesibilidad.md` decidió no hacer. Cualquier progresión tiene que medirse en **lo que haces**, nunca en **cuánto te has movido**.

## Decisiones

### 1. No hay niveles: hay rango social, por núcleo y sin números

No sube el personaje: sube lo que cada sitio te concede. Una escalera corta y con nombre —**forastero · conocido · alguien de aquí**— que se gana por lo que se cuenta de ti. Nada de barras, nada de XP, nada que llenar.

- **La granularidad es el núcleo**, no el mapa ni el mundo. Es donde llega el rumor y donde se sedimenta, así que es donde vive todo lo social de este proyecto.
- **El rango sube por lo que llega, no por lo que pisas.** De ahí dos consecuencias que no hay que programar porque salen solas: puedes ser *alguien* en un pueblo donde no has estado nunca, porque la noticia llegó antes que tú; y un pueblo al que vas cada día pero al que no llega nada tuyo te sigue tratando de forastera.
- Queda una simetría que ordena el juego entero: **tú conoces al pueblo por ir; el pueblo te conoce a ti por lo que le llega.** Andar profundiza tu mapa; actuar sube tu rango. Dos ejes, dos maneras de jugar, ninguna castigada.
- **Y avanza igual quien anda 6 km que quien anda 900 m**, porque cuenta la hazaña y no la distancia. Es la condición que imponía `accesibilidad.md`.
- **El escalón no se anuncia como logro**: dice que el mundo cambió, no que tú hayas subido. Misma regla de redacción que el hito de `arranque.md` §3, que es de hecho el primer escalón de esta misma escalera.
- **Y en pantalla se dice con una frase, nunca con una lista de pueblos** (6-ago-2026, al dibujar el telón). «En Monfrida ya saben quién eres» hace el trabajo de un medidor de reputación sin ser uno, y de paso dice sin explicarlo que el rango es por núcleo. Una pantalla que enumerase tus tres escalones en cada pueblo sería la barra que este apartado se niega a tener, solo que escrita con palabras.

**Y el oro sí se enseña como número** (6-ago-2026). Choca en apariencia con la prohibición de cifras de `bucle-jugable.md` §3 y no choca: aquella era sobre distancias y tiempos, que son lo que convierte esto en una app de deporte. El oro es una moneda que se gasta en cosas concretas (§2), y sin verlo no se puede decidir en qué. Conviene tenerlo escrito porque es el tipo de regla que se aplica de más si nadie marca el límite.

### 2. El oro compra saber y favores, nunca metros

El oro compra lo único que este mundo tiene de sobra: información y voluntades. Que te cuenten lo que saben sin tener que ir hasta allí, que alguien lleve un recado por ti, que te guarden algo.

- **Regla dura: el oro nunca compra distancia.** No se puede pagar por no andar. Es la línea que protege el núcleo del juego, y no admite excepciones elegantes.
- **Y lo que compras es lo que ese hombre sabe, en la versión que a él le llegó.** Pagar no te da la verdad: te da otra versión, con su nivel de deformación encima. Puede ser peor que ir andando. Así el oro **no permite saltarse la propagación —la usa**: compras un nodo del árbol, no la realidad.
- **Segunda regla dura, y esta es de principios: el juego nunca te manda a gastar en el negocio real del anclaje, ni el oro ficticio toca dinero de verdad en ninguna dirección.** Un juego que reparte monedas y sabe que la taberna es el bar de abajo está a un paso de ser un vehículo publicitario, y con menores delante eso no es una decisión de economía.

### 3. El rango cambia el trato y lo que te cuentan, no el catálogo

Ser alguien en un sitio cambia cómo te hablan, cuánto te cuentan y si te lo cuentan gratis: lo que a una forastera le cobran, a alguien de aquí se lo sueltan de balde. **Ahí enganchan el rango y el oro sin inventar una tienda.**

Se descartó que el rango abriera aventuras que un forastero no recibe. Es el mismo fork que el oficio —¿filtra o colorea?— pero con una diferencia decisiva: **con el oficio empiezas eligiendo; con el rango empiezas siendo forastera en todas partes a la vez**. Si el rango cerrara contenido, el juego estaría en su punto más pobre exactamente el día 1, que es el agujero al que `arranque.md` dedica un documento entero.

De aquí sale la síntesis económica: **el rango y el oro no son dos sistemas, son el mismo visto de dos lados.** El rango es crédito social; el oro lo suple cuando no lo tienes. Una moneda se gana haciendo cosas, la otra se gasta, y las dos compran lo mismo.

### 4. Objetos: llaves que abren otra puerta al mismo beat, nunca un requisito

Los objetos que mueven una quest viven y mueren con ella, pero algunos quedan, y **abren conversaciones que no se habrían abierto**. No se combinan, no se gestionan, no ocupan sitio: se tienen o no se tienen, y el código bifurca por eso.

- **Nunca son requisito, solo otra manera de pasar.** El objeto no abre una rama nueva: abre una salida distinta a un beat que ya existe. Mismos beats, mismo lazo, otra forma de atravesarlo. Con eso el casting sigue siendo testeable, el corolario de "con LLM y sin LLM, misma estructura" queda intacto, y quien no tenga nada resuelve igual por otro lado. Es la regla de "ignorarlo es gratis" un nivel más arriba.
- **El mecanismo ya estaba escrito y sin usar**: `quests.md` §2 define el disparador `{tipo: llegada | franja | con_objeto}`.
- **Está del lado correcto de la frontera**: tener el objeto es dato vivo —el código bifurca por él— y el diálogo que abre es dato inerte con fallback de plantilla.
- **Y es el primer mecanismo real de arcos largos.** `quests.md` promete que "lo persistente son los arcos" y hasta ahora no había nada que lo cumpliera. Esto lo cumple con una lista de flags.
- **Lo mejor es a quién rescata**: los hallazgos de micro-encuentro son de coste cero y se pueden ignorar gratis, así que hoy se quedan en una anécdota de quince segundos. Si tres semanas después la hebilla de latón de la cuneta abre una conversación, **el paseo tonto de un martes se vuelve retroactivamente algo**.

Y lo que no es llave queda en **la repisa**: cosas que no hacen nada salvo estar y contar de dónde vinieron y qué día fue. Le devuelve al telón el premio que perdió cuando el visor del anclaje se mudó a la calle (`bucle-jugable.md` §2). Simetría con la otra mitad del juego: **el mapa guarda lo que sabes; la repisa guarda lo que puedes demostrar.**

## Lo que esto obliga a hacer

- **Retirar la XP** de la recompensa que promete `quests.md` §6: quedan oro, objeto y consecuencia.
- Un **rango por núcleo** derivado de los rumores que le han llegado, con sus tres escalones.
- Que los **precios de la información dependan del rango** en ese núcleo, incluido el precio cero.
- Un **catálogo de informantes y favores** que sea donde el oro se gasta, y que devuelve la versión deformada que ese informante tiene.
- Usar el disparador `con_objeto` que ya está especificado, y que cada plantilla pueda declarar **ganchos opcionales** por objeto — opcionales, nunca obligatorios.
- Que `castTemplate` reciba también el estado de la partida, sin que eso cambie los beats: la variante es cómo se pasa, no por dónde.

## Pendientes

1. **Si el rango puede bajar.** Propuesta pendiente de ratificar: **no**, porque el rango mide *cuánto te conocen*, no *cuánto te aprecian* — que te conozcan por algo feo también es que te conozcan. El signo de lo que se cuenta, que `quests.md` §6 sí permite que sea malo porque lo que hiciste viaja para bien y para mal, sería un **eje aparte** que cambia el tono del trato y no el escalón. Dos ejes, los dos alimentados por los mismos rumores, y ninguno que castigue por no salir.
2. **De dónde salen los objetos-llave**: de cualquier aventura, solo de los hallazgos de micro-encuentro, o de una lista corta y deliberada. Cambia mucho cuántos ganchos necesita cada plantilla.
3. **Qué pasa con el oro acumulado.** Si solo compra información, sobra pronto; y un contador que crece sin tope acaba siendo un marcador de progreso por la puerta de atrás, que es justo lo que la decisión 1 evita.
4. **Los nombres exactos de los tres escalones** y qué hace falta para subir de cada uno al siguiente.
