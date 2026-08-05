# El Hacedor de Mundos — análisis de un proyecto vecino

Notas sobre **El Hacedor de Mundos** (TikTok `@elhacedordemundos`), un RPG narrativo dirigido por LLM que comparte con Walking Adventure la idea de "generador de mundos" y casi nada más. Análisis del 5 de agosto de 2026 a partir de diez vídeos de la cuenta (están en `temp/videos-hacedor-de-mundos/`, que es una carpeta ignorada por git: este documento es el único registro que queda en el repo).

## Qué es

Una aplicación web (corre en `localhost:3000`) donde el LLM —Gemini— dirige la partida entera: narra, arbitra y resuelve combates. Su autor la está construyendo con Claude Code y lo enseña en abierto; dos de los diez vídeos son directamente su sesión de Claude depurando la economía moral del juego.

**Flujo de la aplicación:** grimorio 3D en portada → menú "Elige tu senda" (Nueva Aventura / Modo Estudio / Cargar Partida / Configurar Modelos LLM / Sistemas Narrativos) → creación de personaje maquetada como un libro antiguo, capítulo a capítulo (nombre, estirpe, forma, vocación, trasfondo, "¿dónde abrirás los ojos?") → pantalla de juego con prosa larga generada, bloque "Personajes en la Escena", cuatro opciones más un campo libre ("Improvisar otra acción"), tiradas visibles en línea (`[INTELIGENCIA > 11] ✓`), imagen de la escena generada en la columna derecha, y pestañas Yo / Items / Misión / Social / Mapa / Correo / Diario / Guardar.

**Ambientación libre:** las demos van de un isekai tipo *Sword Art Online* a un noir mafioso en Palermo con una Beretta M1934 en el inventario. No hay ningún anclaje al mundo real; todo sale del modelo.

## Sus sistemas (el panel "Sistemas Narrativos")

Es la pieza que más enseña y la más interesante. Un panel de interruptores donde cada decisión de diseño es una opción de usuario:

- **Génesis de Mundos** (experimental, OFF por defecto): pre-simula siglos de historia *antes* de que llegues — linajes que nacen, se casan, traicionan; dinastías, guerras y leyendas que ya sucedieron — y eso deja huella en los NPCs que conocerás. Cuesta ~2 llamadas LLM al crear el mundo.
- **Vida pasiva de NPCs**: micro-eventos solitarios cada 3 turnos para los NPCs con afinidad; el Bardo los narra orgánicamente cuando vuelves.
- **Sistema de rumores**: los NPCs propagan rumores entre sí, con un cap de 15 activos.
- **Distorsión de rumores**: los rumores se deforman al pasar de NPC a NPC, como el "teléfono escacharrado".
- **Simulador del mundo**: las facciones evolucionan solas cada 5 turnos, sin tu intervención.
- **Rutinas de NPCs día/noche**: siguen rutinas según arquetipo y hora; los que no tocan desaparecen de la escena.
- **Trauma orgánico**: si matas a un NPC sin testigos el cadáver queda oculto; al descubrirse se genera trauma en los NPCs afines a la víctima, propagado por distancia social.
- **Memorias de NPC**: a partir de 6 memorias se fusionan en arcos coherentes.
- **Validación de coherencia narrativa y psicológica**: cuando un NPC evoluciona, valida su personalidad para evitar saltos bruscos tipo "tímido → agresivo sin razón".
- **Crítico "Cisnes Negros"**: detecta clichés en el horizonte narrativo y emite directivas anti-tópico.
- **Correspondencia hostil**: los NPCs te mandan cartas por iniciativa propia — ultimátums, amenazas, declaraciones — aunque tú no escribas.
- **Combate por turnos** conmutable: o modal con HP, o resuelto narrativamente por el Bardo.

Además: configuración de LLM **por rol** (Narrador / Árbitro / Combate), cada uno con su modelo (Gemini 2.5 Pro vs Flash) etiquetado por calidad y velocidad, con la API key del propio usuario. Y dos apuestas laterales: **Modo Estudio** (educativo: "vive la Historia, el viaje de Colón") y **Bibliotheca**, que convierte un libro que subas en un mundo jugable.

## Por qué no es competencia

La tesis es la opuesta. Él genera un mundo **ilimitado**; nosotros generamos un mundo **anclado**. Su restricción es cero: cualquier ambientación, cualquier lugar, cualquier cosa. La nuestra es el terreno — un chiringuito real puede ser una ruina, pero hay un chiringuito, y hay que andar hasta él.

Lo que él tiene de más (variedad infinita) es justo lo que hace que ese tipo de aplicación pese poco: contenido sin coste ni fricción se consume igual de rápido de lo que se genera. Lo que nosotros tenemos de más (que el jugador salga de casa) es lo que ninguna cantidad de LLM sustituye. Coincidimos en la estética "generador de mundos", no en el producto.

## Lo que confirma de nuestras decisiones

**La coherencia de estado es el problema central de un RPG dirigido por LLM.** Sus propios vídeos lo documentan: dos de ellos son él discutiendo con Claude por qué la moralidad, el oro y la reputación no cuadran entre sistemas ("el precio de matar ahora lo cobran los sistemas"), con una suite de 528/530 tests y un test rojo que resultó tener razón. Nuestro diseño esquiva eso por construcción: el mundo lo genera código determinista y el LLM, cuando llegue, solo redacta encima. Visto desde fuera, esa decisión se sostiene muy bien.

**La economía tampoco cuadra.** Cada turno son varias llamadas a LLM más una imagen generada. Por eso pide la clave de Gemini del usuario: no le salen los números de otra forma.

## Lo que merece la pena robar

En este orden:

1. **"El mundo vive sin ti".** Es su mejor frase y su mejor sistema, y en Walking Adventure es *más* verdad que en el suyo, porque nuestro mundo es real. Un tick asíncrono entre paseos (la facción del núcleo vecino avanzó, el rumor de lo que hiciste llegó a otro pueblo) encaja con la tubería actual y no rompe el determinismo si se siembra con `makeRng(seed + ':tick:N')`, como cualquier otra fase.
2. **La separación Narrador / Árbitro.** Cuando llegue el LLM: el árbitro custodia el estado y solo el narrador escribe prosa. Es la arquitectura correcta y él ya la tiene montada, con modelo distinto por rol.
3. **El crítico anti-cliché.** Con plantillas-arquetipo y textos generados, la repetición es nuestro riesgo real; un pase que detecte tópicos y emita directivas negativas es barato y ataca justo eso.
4. **La creación de personaje como libro paginado.** Ya tenemos el lenguaje visual (pergamino, cartela, brújula, placa): coste bajo, impacto alto.
5. **Construir en público.** Está creciendo con vídeos grabados con el móvil apuntando a la pantalla, mal iluminados y torcidos. Nuestros mapas generados son mucho más fotogénicos que sus muros de texto.

## Dónde aterrizó todo esto

Los puntos 1, 2 y 3 de la lista de arriba se convirtieron en decisiones cerradas de `game-design/quests.md` el 5 de agosto de 2026, y ninguno llegó tal cual: los tres cambiaron al pasar por nuestro diseño.

- **"El mundo vive sin ti" → decisión 4, "los kilómetros del jugador como reloj del mundo".** El suyo avanza con el reloj; el nuestro con las piernas. Eso mata el FOMO por construcción, hace que caminar valga incluso fuera de una quest y elimina la necesidad de un techo... salvo en el modo opcional de pasos de fondo, que sí acumula y por eso lleva una reserva con tope de 5.
- **La propagación → sección 6.** Aquí es donde su idea se vuelve más nuestra que suya: sus rumores se deforman por una constante inventada, los nuestros por la topología real del árbol de calzadas que ya construye `buildRoutes`. Distancia = tiempo, saltos = fidelidad, y la forma del mapa se vuelve legible en la narrativa. Además el rumor se agota solo, así que no necesitamos su cap de 15.
- **Narrador / Árbitro → decisión 1.** No copiamos su arquitectura de dos modelos: escribimos que nuestro árbitro **es el código**, con la frontera datos vivos / datos inertes y un corolario testeable (con LLM y sin LLM, la misma estructura).
- **El crítico anti-cliché → pendiente 4**, en su versión barata: un registro de tópicos usados que viaja en el prompt como restricción negativa, sin llamadas extra.
- Y de rebote, la decisión 3 dejó de tratar los micro-encuentros como azar decorativo: ahora son el **canal de entrega** de lo que produce el mundo, con regla de aparición y ciclo de abandono. Ese sistema no estaba en su juego; salió de encajar los anteriores.

## Lo que no

- **El panel de veinte interruptores narrativos.** Es un escaparate de desarrollador, no una feature de jugador. El diseño manda sobre la configuración.
- **Depender de la API key del usuario.**
- **Meter el LLM en la generación del mundo** en lugar de solo en la redacción.
- **Los muros de texto.** Cada pantalla suya es un párrafo denso; cansa a los dos minutos. Y el salto estético del grimorio precioso al dashboard oscuro genérico rompe la promesa de la portada.
- **Pegarse a una IP ajena.** Su demo principal está montada sobre la iconografía de *Sword Art Online* (Aincrad, "SAO SYSTEM", un Guía con cara de Kirito). Es un problema el día que aquello salga de localhost.
