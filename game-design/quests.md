# Definición de quest (4-ago-2026)

Una quest es la unidad de aventura del juego: una cadena de escenas que el jugador completa caminando físicamente por el mundo real mientras ve su posición proyectada en el mapa de fantasía. El mundo generado (núcleos, servicios, parajes con escenas, rutas nombradas, NPCs) es el reparto disponible; la quest es la obra que se monta con él.

## Decisiones de diseño (forks resueltos)

1. **Generación: híbrido plantillas + LLM.** La ESTRUCTURA sale de un catálogo de plantillas-arquetipo escritas a mano y casteadas contra el mundo (determinista, testeable, con la semilla). La NARRATIVA la viste un LLM: ganchos, diálogos, descripciones únicas por mundo, a partir de la plantilla ya casteada. Restricciones: todo texto generado pasa filtro de contenido apto para menores; cada plantilla lleva textos por defecto dignos como fallback (sin red o sin presupuesto, la quest funciona igual); el LLM se invoca al crear la quest (no en tiempo real durante la caminata) y se cachea.

   **Frontera: el árbitro es el código, el narrador es el LLM.** No hay un segundo modelo arbitrando: el árbitro son el casting, el geofence y la máquina de beats. El modelo nunca escribe estado. Se distinguen los **datos vivos** —los que el código lee para decidir: lugares, disparadores, resultados, oro, XP, reputación, condiciones, geofences, franjas— de los **datos inertes**, los que solo se muestran: título, gancho, diálogos, descripciones, textos de rumor. El LLM produce únicamente datos inertes, y aun esos pasan validación (aptitud, longitud, unicidad) con el fallback de la plantilla siempre disponible. Su respuesta se lee contra un esquema de campos conocidos: lo que llegue fuera de ellos se descarta, no se interpreta. La prueba para clasificar un dato es simple: si alguna regla bifurca por él, no lo escribe el modelo.

   Corolario testeable: generar una quest con y sin LLM debe producir la misma estructura —mismo casting, mismos beats, mismas cantidades, mismo lazo—; solo cambia la piel. Verificable en headless y sin red.

   Y la aclaración que se deriva: la regla de determinismo se aplica al esqueleto. La prosa es no determinista por naturaleza, por eso se genera una vez, se cachea y se guarda con la partida, y nunca se regenera al vuelo. Lo mismo rige para los pasos del mundo (decisión 4): el paso calcula qué ocurrió, el LLM solo lo cuenta.

   **Nombres: suelo determinista, capa opcional.** Todo nombre propio lo produce primero el paquete de idioma (`app/js/names/`), que garantiza unicidad, coherencia de idioma y existencia sin red. Sobre ese suelo, el LLM puede **proponer** un nombre alternativo; el código lo adopta solo si pasa validación —unicidad contra el índice global de nombres del mundo, longitud, caracteres, aptitud— y en cualquier otro caso mantiene el nombre base. El idioma no se valida, se dirige: el prompt lleva el locale y ejemplos del propio paquete como anclaje de estilo, de modo que `app/js/names/` es a la vez fuente de nombres y referencia estilística para el modelo. La capa se aplica por defecto a los elementos que nacen dentro de una quest (objetos, encargos); extenderla a las entidades del mundo cuesta una llamada extra al crear el mundo y es decisión de presupuesto, no de diseño.
2. **Guiado: texto de mundo + marca en el mapa.** La indicación narrativa usa el lenguaje del mundo ("sigue La Calzada del Este hasta El Cruce del Ahorcado") Y el destino aparece marcado en el mapa de fantasía. El texto ambienta, el mapa confirma; las rutas nombradas son la infraestructura de navegación.
3. **Paralelismo: una principal + entregas del mundo.** Una quest principal dimensionada al preset marca el lazo de la salida. En paralelo, lo que el mundo produce en sus pasos (decisión 4) llega al jugador por tres canales: **micro-encuentros de 1 beat en ruta**, mientras camina; **el estado de cada núcleo al llegar**, que es lo que allí se cuenta de él en la versión que les llegó; y, solo en el modo de pasos de fondo, **un resumen al empezar la salida** que vacía la reserva acumulada. Un micro-encuentro solo salta si hay algo pendiente de entregar: sin producción del mundo no hay encuentro, nunca relleno aleatorio. Dos reglas lo acotan: **coste cero de desvío** —ocurre en el camino, jamás manda al jugador fuera del lazo ni consume presupuesto— e **ignorarlo es gratis**.

   **Aviso y abandono.** El aviso tiene tres capas: marca en el mapa, aviso háptico y sonoro, y notificación al entrar en el geofence del lugar. Su propósito es que el jugador **no** tenga que mirar la pantalla mientras camina: el móvil avisa desde el bolsillo y él decide cuándo parar. La notificación se reserva a las oportunidades; las noticias se anuncian con háptico y marca y se agrupan en el estado del núcleo, para que el aviso no se devalúe. Nunca se avisa durante un beat en curso de la quest principal.

   **El estado del núcleo aflora al llegar y se anota en el diario.** No hay panel consultable con la verdad del mundo: el jugador se entera porque allí se lo cuentan, y lo oído queda registrado en su diario con el lugar y el momento. El diario **registra lo oído, no lo cierto** —si el rumor llegó deformado, guarda la versión deformada— y por tanto **nunca muestra el nivel de deformación**, que es dato vivo interno. Una entrada **no se sobrescribe** con una versión más veraz: si el jugador oye la buena después de la torcida, conviven las dos. De ahí sale sin tutorial el descubrimiento de que las noticias se deforman: como el árbol define un único camino, cada núcleo oye una sola versión, pero el jugador visita varios y puede **triangular** comparando su propio diario. A granularidad de núcleo esto no necesita la capa de NPCs: "aquí se habla de..." puede aflorar al llegar sin que exista un NPC con nombre.

   **El diario se lee de dos maneras, y la segunda se gana** (6-ago-2026, al dibujar las pantallas de consulta). Empieza siendo cronológico y nada más. **La primera vez que oyes una segunda versión de algo que ya tenías apuntado**, el juego pone las dos juntas en el sitio, sin explicar nada —«esto ya lo habías oído. No así»— y a partir de ahí el diario también se puede leer **por historias**, agrupando las versiones de un mismo suceso.

   El punto de la decisión es el orden. Agrupar desde el primer día habría regalado el mejor truco del juego: que dos relatos sean el mismo dejaría de ser algo que descubres para ser algo que te dicen. No agrupar nunca lo habría dejado en algo que ocurre y que casi nadie llega a ver, y de ese sistema cuelga medio juego. Así que **el descubrimiento es del jugador y la comodidad viene después**, que es exactamente cómo `arranque.md` pone en escena la deformación en vez de explicarla.

   Dos restricciones para que la vista por historias no deshaga lo que este párrafo protege: **se ordena por cuándo lo oíste, nunca de más fiel a más torcida** —eso sería enseñar el nivel de deformación por la puerta de atrás— y **no se marca cuál es la buena**. Enseña que son la misma historia contada distinta, no cuál es verdad; para eso está el testigo directo, que es la única fuente fiel que existe (`npcs.md`).

   Y el mecanismo sale gratis en el código: el rumor ya tiene identidad interna porque la propagación la necesita. Lo que se decide aquí es **cuándo esa identidad se hace visible**, que hasta este momento no lo era nunca.

   **El resumen de apertura: marco propio, entradas prestadas.** El único texto nuevo es el envoltorio ("mientras hacías tu vida, el mundo anduvo..."), con su fallback; cada entrada trae el suyo de la plantilla que la generó, de modo que el resumen es un contenedor y no una unidad narrativa que duplique la lógica de fallback. Su longitud queda acotada por el tope de 5 de la reserva. Punto de invocación: los pasos de fondo ocurren con la app cerrada, así que sus textos no existen todavía; se generan en **una única llamada agrupada al abrir la salida, nunca durante la caminata**. Es la única excepción a "el LLM se invoca al crear la quest", y sigue cumpliendo el espíritu: se llama antes de andar, no mientras se anda. Si la llamada falla, todo cae a fallbacks y el resumen se lee igual.

   Si el jugador no atiende, hay dos tipos de entrega y no se comportan igual. Las **noticias** (un rumor que llega) son informativas: sedimentan de inmediato en lo que se cuenta en el núcleo y siguen consultables. Las **oportunidades** (hallazgo, entrega rápida, encargo de 1 beat) vuelven a la cola y se ofrecen una segunda vez, en otra salida y en otro lugar —nunca dos veces en la misma salida ni en el mismo sitio—; si tampoco se atienden, sedimentan. Dos ofertas: una sola es frágil (basta un semáforo, una conversación real o el móvil en el bolsillo), infinitas son un incordio. Sedimentar no penaliza ni se reprocha: nadie comenta que el jugador no fuese.
4. **Persistencia: una salida + arcos largos, y los kilómetros del jugador como reloj del mundo.** Cada quest se completa en la salida para la que se dimensionó (paseo/aventura/jornada). El mundo avanza por *pasos*: unidades de tiempo de mundo que ocurren **al ritmo al que camina el jugador**, no al del calendario. Un paso equivale a un tramo (~2 km, ~30 min), la misma unidad que dimensiona los beats.

   - **Qué kilómetros cuentan es configurable, y solo el modo ampliado acumula.** Por defecto cuentan los andados durante una salida activa: se gastan según se generan, no se almacenan, y no necesitan techo. El jugador puede ampliarlo a los pasos de su día a día (opt-in explícito, permisos de salud, apagado de origen: ver sección 8); esos sí se acumulan en una reserva **con un máximo de 5 pasos**, que se vacía narrada al empezar la siguiente salida. Llena la reserva, los kilómetros extra no generan pasos: el contador *n* no salta y volver tras tres meses equivale a volver tras tres días. Un paso es tiempo del mundo, no una recompensa del jugador; que la reserva se desborde no le quita nada a nadie. El máximo lo fija lo que cabe en un resumen legible, no lo que se puede simular.
   - **El contenido de un paso lo decide su número, no la fecha.** El paso *n* se siembra con `makeRng(seed + ':tick:' + n)`. Nada del mundo depende del reloj real, coherente con la prohibición de `Date.now()` en la generación: la partida sigue siendo reproducible y testeable, y la fuente de kilómetros solo altera a qué velocidad crece *n*.
   - **No hay penalización por ausencia.** Al contar kilómetros y no días, estar un mes sin salir no acumula mundo pendiente ni deja nada atrás.
   - **Un paso solo añade.** Puede crear un rumor, una oportunidad o una razón para volver; nunca caduca una quest, retira un NPC ni resta reputación **por no haber salido**. La regla protege contra penalizar la ausencia, no contra propagar la consecuencia de un acto: sin actuar no pasa nada, y actuando, lo que se hizo viaja para bien y para mal (sección 6).

   Lo que ocurre en un paso no tiene al jugador como protagonista —el mundo hace lo suyo— pero es su caminar el que lo pone en marcha. Lo persistente son los arcos (reputación, NPCs que recuerdan al jugador, cadenas que se desbloquean) y lo que el mundo hizo mientras andaba. Sesión cerrada, mundo continuo.

## Aspectos que cubre una quest

### 1. Identidad y gancho

Título, tema/tono y dador: quién la encarga y dónde (un NPC en la taberna, el tablón de anuncios, algo hallado en un paraje). El gancho responde "¿por qué voy a andar 2 km?": la motivación narrativa es la gasolina del jugador.

### 2. Estructura de beats

Cadena (o grafo pequeño) de beats. Cada beat define:

- **Lugar**: referencia a una localización del mundo con nombre y anclaje real (servicio, núcleo, paraje, casa de NPC). Nunca coordenadas sueltas.
- **Disparador**: llegar; llegar en franja horaria; llegar llevando/sabiendo algo.
- **Escena**: qué pasa allí (diálogo, descubrimiento, entrega, emboscada, visión...). La escena debe casar con las afinidades del lugar: los pesos de escena de los parajes son el sistema de casting, no decoración.
- **Resultado**: lo que empuja al siguiente beat — información (el siguiente lugar), objeto, cambio de estado.

Lineal de inicio; ramificación (elegir entre dos pistas) en iteraciones futuras.

**La forma del parlamento la decide la escena, y las dos mitades del paso la heredan** (13-ago-2026). Un beat que cae sobre una persona se dice en su voz y se pinta entrecomillado; uno que cae sobre un sitio se pinta como párrafo. La forma se decide una vez, al componer la escena, y la pantalla de lo que te llevas la hereda: el mismo texto no puede leerse entrecomillado en una pantalla y como narración un toque después. Las comillas las pone quien pinta y nunca el catálogo, para que el texto se lea en voz alta sin que nadie diga «comillas».

**Beats de lugar diferido.** Los beats de una quest tienen su lugar resuelto en el casteo. Los de un micro-encuentro no pueden: su lugar se resuelve en marcha, contra el primer sitio apto por el que pase el jugador. El contenido sigue siendo determinista —sale del paso del mundo que lo generó—; lo que depende del jugador es dónde se entrega. Los tests afirman lo primero, no lo segundo.

### 3. Logística física (el corazón del juego)

- **Presupuesto por preset**: paseo ≈ 4-6 beats, aventura ≈ 6-10, jornada ≈ 10-14; tramo individual máximo ~30 min andando.
- **Forma de lazo**: la quest empieza y termina cerca del punto de inicio del jugador.
- **Guiado por rutas nombradas** (decisión 2).
- **Validación de llegada**: geofence generoso (~30-50 m, GPS impreciso), activable desde espacio público, tolerante a lugares reales cerrados o inaccesibles.

### 4. Tiempo

Franjas del mundo ("al anochecer", "por la mañana") y citas ("estará en la fuente a las seis"). Sin tiempos límite que metan prisa a quien camina (y con menores, menos). Persistencia según decisión 4: la quest vive en una salida.

### 5. Actores

NPCs implicados: dador, objetivo, secundarios. Cada NPC con nombre vive o trabaja en un lugar concreto. Estado: qué sabe, qué recuerda del jugador (alimenta los arcos largos).

→ Resuelto el 5-ago-2026 en `npcs.md`, con una enmienda: **el NPC no consume anclaje propio, hereda el del sitio donde trabaja**, así que las "casas de NPC" quedan aplazadas y reducidas a quien no trabaja en ninguno. El reparto crece con lo jugado (generación perezosa y determinista por semilla + sitio + puesto), su memoria es corta y guarda la versión **fiel** de lo que vivió contigo —el testigo es la única fuente de verdad en un mundo donde todo lo demás llega deformado, y no corrige lo que se cuenta en el pueblo—, las franjas son propiedad de la escena y no de la persona, y nadie cambia por el paso del tiempo: solo por lo que haces, y lo roto se puede reparar.

### 6. Recompensa y consecuencia

Inmediata (oro, objeto; ~~XP~~ → **la XP se retira el 5-ago-2026**, ver `progresion.md`: no hay niveles sino rango social por núcleo, porque subir de nivel en un juego cuyo techo son tus piernas premia a quien más anda) y persistente. Lo persistente no se aplica de golpe ni en todas partes: **viaja por la red de calzadas**, que `buildRoutes` construye como árbol de expansión mínima y que por tanto define un único camino entre dos núcleos, con saltos y metros bien definidos.

- **Origen y contenido**: la plantilla declara si su desenlace es notable y con qué semilla nace el rumor. Nace en el núcleo donde ocurrió, en nivel 0.
- **Latencia por distancia real**: el rumor avanza un tramo (~2 km) por paso del mundo, la misma unidad que el reloj del jugador. Consecuencia: se puede adelantar a la propia fama — ir derecho al pueblo vecino es llegar a la vez que la noticia; entretenerse por el monte es llegar después de ella.
- **Distorsión por salto, no por kilómetro**: deforma quien lo recuenta, que es un acto social y no geográfico. Nivel = saltos dados, tope 3, con un nivel extra si cruzó un tramo sin calzada real (`fallback` en `buildRoutes`): la noticia que cruza el monte llega peor. Dos núcleos a la misma distancia reciben la misma noticia con distinta fidelidad según cuántas aldeas haya en medio: la forma del árbol se vuelve legible en la narrativa.
- **Escalera de cuatro niveles**, enumerada y no continua, porque de ella cuelgan textos con fallback de plantilla: **0 fiel** (lo que ocurrió, contado por quien estuvo) · **1 abultado** (crece la escala: uno se vuelve tres) · **2 trastocado** (cambia el detalle que importa: el motivo, el lugar, con quién) · **3 leyenda** (se le atribuye a otro, o se funde con un rumor viejo).
- **La deformación nunca invierte el signo moral.** Cambia la escala, el protagonista y el detalle; no convierte un buen acto en uno feo. El signo y el nivel son datos vivos que fija el código; solo la redacción de la versión es inerte y la escribe el LLM, con esa restricción explícita en el prompt.
- **Se agota solo**: al llegar a nivel 3 o quedarse sin núcleos que no lo hayan oído, el rumor deja de viajar y se sedimenta en lo que se cuenta de ti en ese sitio. No hace falta límite de rumores activos: el árbol es finito.
- **La reputación es lo que llegó, no lo que hiciste.** Cada núcleo trata al jugador según la versión que oyó.
- Fallar por no llegar debe ser casi imposible: se falla por decisiones, no por piernas.

### 7. Plantilla y casting

Una quest no se escribe sobre lugares concretos sino como plantilla con ROLES: "una taberna", "un paraje con afinidad guarida a 10-20 min", "un NPC artesano". El generador castea los roles contra el mundo concreto con la semilla. Si el mundo no puede castear una plantilla, esa plantilla no se ofrece. Arquetipos iniciales candidatos: entrega, visita, cita, investigación con pistas, ronda de vigilancia, rescate/búsqueda.

### 8. Aptitud y seguridad (transversal)

Contenido apto para menores (principio de la spec, y filtro sobre todo texto LLM); no dirigir a sitios físicamente problemáticos; horario diurno por defecto; nada que incentive correr ni cruzar mal.

→ Lo operativo queda decidido el 5-ago-2026 en `seguridad-privacidad.md`: del móvil no sale nada del jugador y al LLM solo le llega ficción (el prompt no lleva nombres reales de anclajes); el permiso de ubicación es solo "mientras se usa", pedido en contexto; el anclaje que no vale lo descarta el jugador con un gesto reversible que anota sin resembrar; y el juego no distingue a un menor porque es apto por diseño, con el horario diurno como ajuste activado de origen.

Dos consecuencias de las decisiones 3 y 4. **Contar los pasos del día a día es opt-in explícito**: exige permisos de salud, viene apagado de origen y el juego es completo sin activarlo. Y **el aviso de tres capas está diseñado para no mirar la pantalla en marcha**: el háptico y la notificación avisan desde el bolsillo para que el jugador decida cuándo parar a mirar, no para que mire mientras anda.

## Esquema tentativo de una quest casteada

```
quest:
  id, plantilla, semilla, preset (paseo|aventura|jornada)
  titulo, gancho              ← LLM (fallback: plantilla)
  dador: {npc, lugar}
  beats:
    - lugar (ref a localización del mundo)
      disparador: {tipo: llegada|franja|con_objeto, ...}
      escena: {tipo, texto ← LLM, afinidad_usada}
      resultado: {tipo: info|objeto|estado, siguiente_beat}
  presupuesto: {distancia_m, minutos_est, tramo_max_m}
  recompensa: {inmediata, persistente}
  estado: {beat_actual, completada, decisiones}
```

## Ejemplo ilustrativo (casteo sobre el mundo de Sanxenxo v0.1)

Plantilla "la entrega sospechosa" (aventura): el tabernero de {taberna: Taberna da Coroa Leda} pide llevar un paquete al herrero de {armeria: Forxa do Carballo Bailador}; por el camino, en {paraje guarida: O Torreón Esquecido}, alguien sale al paso y ofrece comprarlo (decisión); la entrega final revela qué era; vuelta con recompensa en la taberna. 4 lugares, lazo, ~35-45 min, una decisión con consecuencia de reputación.

## Pendientes

1. ~~Catálogo inicial de plantillas-arquetipo~~ → hecho (v0.1): 6 plantillas en `app/js/quests/templates.js` (entrega sospechosa, cita en la fuente, tres pistas, ronda del vigía, peregrinaje, rescate en la granja) con roles y textos de fallback.
2. Capa de NPCs: generación, casas ancladas, memoria (requisito de los actores y los arcos).
3. Micro-encuentros oportunistas: queda el **catálogo de escenas de 1 beat**. La regla de aparición ya está decidida (decisión 3): cola de entregas no vacía + coste cero de desvío + cooldown + no interrumpir un beat en curso, con el ciclo de abandono de dos ofertas y sedimentación.
4. **Contrato exacto con el LLM.** Esquema cerrado de campos inertes (decisión 1); filtro de aptitud para menores sobre todo texto; la redacción de un rumor respeta el signo moral y el nivel de deformación que fija el código (sección 6); nombres propuestos contra el paquete de idioma como suelo y como anclaje de estilo; generación única, cacheada y guardada con la partida. Dos puntos de invocación y no más: **al crear la quest** y, solo en el modo de pasos de fondo, **una llamada agrupada al abrir la salida** para redactar el resumen de la reserva (decisión 3). Nunca durante la caminata. **Registro de tópicos** por semilla de mundo —aperturas, imágenes, giros, oficios, objetos ya usados— que viaja en el prompt como restricción negativa, con ventana por categoría (~20 entradas, lo reciente es lo que canta) y precargado con una lista negra de tics genéricos del modelo: es la versión barata de un crítico anti-cliché y no cuesta ninguna llamada extra. Limitación asumida: los textos de fallback se repiten por definición, y eso se mitiga con variantes por plantilla, no con el registro.
5. ~~Simulador de casting en el prototipo~~ → hecho (v0.1): `app/js/quests/casting.js` castea el catálogo contra cada mundo generado (backtracking determinista con la semilla, tramos 0,1-2,4 km, lazo, escenas con peso ≥0,2); el panel lista casteables/no casteables con motivo, y la ficha dibuja el lazo numerado sobre el mapa con distancia y minutos estimados (rodeo ×1,35, 72 m/min).
6. ~~Afinar con datos del simulador~~ → hecho: informe `test/casting-report.mjs` sobre 18 mundos sintéticos (3 radios × 6 semillas) + 4 reales (Sanxenxo, Toledo, Madrid, A Coruña). Ajustes aplicados a raíz de los datos (decisión: ampliar escenas a más tipos, no subir el suelo del grafo): "emboscada" también en ruina (0.2) y puente (0.2); "guarida" también en puente (0.2, el troll bajo el puente); "vigilancia" también en cruce (0.2, vigilar quién pasa); y los roles de plantilla admiten escenas alternativas ("vigilancia o revelación" = cualquier sitio desde donde se ve lejos). Resultado: los 4 mundos reales castean 6/6; en sintéticos, entrega 77→95%, ronda del vigía 41→77%, resto ≥86%. Los fallos restantes son mundos de paseo con 2-3 parajes donde no caben todas las escenas: aceptable, el catálogo siempre ofrece varias quests por mundo.
7. Ampliar el catálogo de plantillas (más arquetipos) cuando exista la capa de NPCs.
8. **Motor de pasos del mundo y propagación por el grafo viario.** Capa **sobre** el mundo generado, no una fase de `build.js`: `build.js` crea el mundo, esto evoluciona el estado de una partida encima de un mundo ya creado. Meterlo en la tubería rompería la propiedad de "misma tubería, mismos mundos". Piezas: contador `n` por partida con siembra `:tick:n`; fuente de kilómetros configurable (sesión por defecto, pasos de fondo opcional con reserva de 5); propagación sobre el árbol de `buildRoutes` —latencia por metros reales, nivel de deformación por saltos, +1 en tramos `fallback`—; y cola de entregas con sus dos tipos y su ciclo de abandono (decisión 3). **Puede implementarse antes que la capa de NPCs** (pendiente 2) a granularidad de núcleo: un rumor puede ser "en tal sitio se habla de..." sin que exista un solo NPC con nombre; con NPCs, mejora. Verificable en headless y sin red: dada una secuencia de pasos, el estado resultante es idéntico, y la estructura no cambia con LLM o sin él.
