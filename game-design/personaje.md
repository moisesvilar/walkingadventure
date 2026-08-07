# El personaje (5-ago-2026)

Quién es el jugador dentro del mundo. Es el único pendiente del proyecto que no puede apoyarse en OpenStreetMap: **todo lo ficticio se ancla a algo real, y el personaje es lo único que no tiene anclaje**. Hay que decidirlo entero.

## Decisiones

### 1. Un personaje que interpretas

Creas a alguien —nombre y oficio— y lo mueves andando. Se descartó que el personaje fueras tú con ropa de fantasía, que era lo más coherente con el principio de anclaje (la persona real como anclaje, igual que el bar es el anclaje de la taberna), porque pedir un nombre real en un juego para menores abre una conversación de privacidad que no compensa; y se descartó llegar sin nombre y que el mundo te bautizara, que se recupera en parte más abajo.

Cuatro reglas sostienen la decisión:

- **El personaje tiene identidad, pero no cuerpo.** Nada de resistencia, velocidad ni fatiga. El cansancio, el ritmo y las piernas son del jugador y ya están medidos por el tramo personal de `accesibilidad.md`. En el único juego cuyo mando es un cuerpo real, sustituirlo por estadísticas sería la disonancia que hunde esta opción; con esta regla no existe.
- **El mundo no te llama por tu nombre hasta que te conoce.** Tienes nombre desde el minuto uno, pero para la gente de allí eres la forastera hasta el hito de fin de arranque. Así `arranque.md` §3 conserva su momento: el hito es justo cuando empiezan a llamarte Xoana.
- **El nombre se propone desde el paquete de idioma.** Si el mundo está en gallego, las sugerencias son gallegas y el nombre pega con el sitio. Es el patrón de "suelo determinista, capa opcional" de `quests.md` aplicado al revés: el juego propone y el jugador escribe lo que quiera, con filtro de aptitud y de longitud, porque ese texto acaba dentro de los textos generados.
- **El género gramatical del personaje es dato vivo**, no adorno: el código bifurca por él cada vez que el mundo se dirige al jugador («forastero» / «forastera»). Lo pone el jugador y nunca el modelo, y **llega con el femenino ya puesto**, por la regla de sesgo de `lenguaje.md`.
- **Queda claro que es el personaje y no la persona.** La pantalla pregunta por quién eres *ahí dentro*, no por cómo te llamas, y el campo llega con un nombre ya sorteado del paquete de idioma: se puede empezar sin escribir nada, y de paso nadie teclea su nombre real por inercia.
- **Y se pide en el onboarding, no dentro de la ficción.** Se valoró que te lo preguntara alguien al hablar contigo por primera vez, que habría sido simétrico con que el mundo no lo use hasta el hito. Queda en la pantalla de creación: en un onboarding se entiende mejor y no obliga a arrastrar un personaje sin nombre.

### 2. Se eligen nombre y oficio; el resto lo pone el mapa

La pantalla de creación es corta y ahí acaba. Lo que el personaje **es** para la gente de ese mapa —de qué se le conoce, su mote, su fama— no se elige en un menú: se gana andando. Nadie tiene que comprometerse con nada antes de saber a qué se juega.

- **El mote nace del rumor, no del hecho.** Como "la reputación es lo que llegó" (`quests.md` §6), el apodo se pega a partir de lo que se cuenta, así que pueden llamarte "la que cruzó el monte de noche" por algo que no ocurrió exactamente así. Es dato vivo: lo fija el código, y cada plantilla y cada suceso declaran su mote candidato igual que ya declaran su rumor. Se pega el que más suene.
- **Y el mote es por núcleo, no global.** En el pueblo de al lado te conocen por otra cosa y en el siguiente por nada. Es "cada núcleo trata al jugador según la versión que oyó", aplicado al nombre. (Corregido el 5-ago-2026: este documento decía "por mapa" y a la vez "en el pueblo de al lado te conocen por otra cosa", que se contradicen. Todo lo social del proyecto vive a nivel de núcleo, que es donde llega el rumor y donde se sedimenta.)

### 3. El oficio filtra y colorea, con afinidad declarada

El oficio hace las dos cosas: **decide qué aventuras se te ofrecen** y **cambia cómo te habla el mundo**. Es la única palanca mecánica que tiene el personaje, y actúa sobre el mundo (qué se te ofrece), nunca sobre el cuerpo (cómo andas).

**Cada plantilla declara a qué oficios pertenece, y puede pertenecer a varios.** Unas pocas exclusivas —esas son las que hacen que elegir oficio signifique algo de verdad, porque hay aventuras que con este personaje no verás nunca— y la mayoría compartidas por dos o tres. El filtro conserva los dientes y el catálogo necesario crece ×1,5 en vez de ×4.

El modelo salió de resolver una contradicción, y conviene dejarla escrita porque es fácil volver a caer en ella: **si una plantilla se pudiera adaptar a cualquier oficio, el oficio no filtraría nada** —solo cambiaría la voz—, que es precisamente la opción descartada. Vestir la misma estructura de otra manera no crea aventuras nuevas: por el corolario de `quests.md` decisión 1, con LLM y sin LLM la estructura es la misma —mismo casting, mismos beats, mismo lazo— y solo cambia la piel. El jugador no reconoce la prosa; reconoce que otra vez le mandan a la iglesia y luego al bar.

Condiciones que impone, con los números medidos:

- **Pocos oficios: tres o cuatro, no diez.**
- **El catálogo tiene que crecer hasta 20-30 plantillas**, y "ampliar el catálogo de plantillas" pasa a estar bloqueado también por esto y no solo por la capa de NPCs.
- **El suelo real, calculado sobre el informe de casting**: con 30 plantillas, afinidad ×1,5 y la tasa de casteo del caso pequeño (los fallos se concentran en mundos de paseo con 2-3 parajes: ronda del vigía 77%, peregrinaje 82%), quedan del orden de **diez esqueletos jugables por oficio en un barrio de tres calles**. Suficiente para que no haya día muerto, que era el riesgo. Muy lejos de las cifras que salen si se cuentan las pieles como aventuras distintas.
- **El cuello de botella de fondo no es el catálogo, es el barrio.** Los fallos del informe dicen todos lo mismo: *sin candidatos para X: un paraje con escena Y*. Plantillas nuevas escritas con el mismo vocabulario de roles fallarán en los mismos barrios por la misma razón, así que ampliar el catálogo hay que hacerlo **variando los roles que pide**, no solo la historia que cuenta.
- **El precalentamiento carga la cola de entregas.** El prólogo de `arranque.md` no genera aventuras —salen de castear plantillas contra el mundo que hay— pero sí deja sembradas oportunidades y encargos sueltos, de modo que un día sin aventura de tu oficio no sea un día vacío.

La lista de oficios sale de los servicios que el mundo ya sabe generar (taberna, botica, forja, mercado), para que siempre exista un sitio donde te reconozcan.

**Y el oficio no se cambia** (6-ago-2026, al dibujar los ajustes). No hay ajuste para cambiarlo ni camino en la ficción para aprender otro: se elige en el arranque y se queda. Es lo que hace que elegir signifique algo, porque lo que da peso a la única palanca mecánica del personaje es precisamente que haya aventuras que con esta persona no verás nunca; un oficio cambiable en un toque es una preferencia, no una decisión.

La salida, si te arrepientes, es empezar de nuevo (`partida-guardada.md` §4), y el coste está mejor repartido de lo que parece: **crece con lo jugado**. El día 2 no tienes nada que perder y resetear es barato; el día 200 te arrepientes mucho menos y además tienes doscientos días de diario que no querrías tirar. La decisión se endurece justo al ritmo al que deja de importar.

Lo que sí obliga: **la pantalla de elección del arranque tiene que decir qué implica cada oficio antes de que se cierre**. Si la decisión es permanente, el momento de tomarla no puede ser un menú de nombres bonitos.

Y una advertencia de coste que no es evidente: **una plantilla ya no es un texto**. Son roles que castean, un lazo que cierra, tramos entre 0,1 y 2,4 km, textos de fallback, declaración de rumor, mote candidato y desenlace de repuesto, en cómico-cálido y escrito para leerse en voz alta — y validada contra el informe de casting. El precedente está en el repo: "tres pistas" no cerraba el lazo y hubo que corregir la plantilla. Treinta de esas son trabajo real.

### 4. Modo compañía: una partida, dos cuerpos

Cuando dos personas caminan juntas, el juego lo reconoce: **manda un móvil y el otro sobra**, y la aventura es de los dos. Cuesta poco técnicamente y bastante de diseño, pero es diseño que este juego ya quería: **textos escritos para leerse en voz alta** y nada que exija tocar la pantalla.

Se descartó el multijugador de verdad —dos partidas sincronizadas, lo que hace una llega a oídos de la otra por las mismas calzadas— no por malo, sino por ser otro proyecto: servidores, cuentas y la conversación entera de privacidad y menores. Queda como la ampliación natural el día que exista "alcance del mundo".

## Lo que esto obliga a hacer

- Una pantalla de creación de dos campos, con nombres propuestos por el paquete de idioma del mundo y filtro de aptitud sobre el texto libre.
- El género gramatical como dato del personaje, atravesando todos los textos que se dirigen al jugador.
- Un **mote declarado por plantilla y por suceso**, y la regla que decide cuál se pega en cada mapa.
- **Filtrado del catálogo por oficio** en el casting, más el precalentamiento de la cola de entregas que lo compensa.
- Que los textos se escriban **para leerse en voz alta**. Afecta al catálogo entero y al prompt del LLM, no solo al modo compañía.

## Pendientes

1. **El día que no castea ninguna aventura de tu oficio.** Propuesta pendiente de ratificar: ofrecer igual una que no es lo tuyo, dicho en tono —«no es lo tuyo, pero es lo que hay»—, que en cómico-cálido es un chiste y no una disculpa.
2. **Si el acompañante real tiene sitio en la ficción.** Que el juego sepa que vais dos abre la puerta a que el mundo se dirija también al otro, y no está decidido si eso enriquece o estorba.
3. **Si se admite una forma neutra de género gramatical**, en un idioma que lo pone difícil y con textos generados de por medio.
4. **La lista exacta de oficios.** Hay criterio —salen de los servicios que el mundo sabe generar, y son tres o cuatro— pero no lista.

Nota de frontera: el mote y la fama por mapa son ya media respuesta al pendiente "progresión y economía", y el oficio filtrando aventuras es media progresión. Conviene abrir aquel pendiente sabiendo que parte de su terreno ya está ocupado.
