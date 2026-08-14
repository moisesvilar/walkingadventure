# Iteración inicial 3-ago-2026 9:22

Quiero crear una aplicación / juego que funcione de la siguiente manera.

El usuario se crea una cuenta (ya veremos cómo) y configura un personaje en un mundo de fantasía que puede ser de tres clases diferentes (por el momento)

- Un guerrero, bueno en el cuerpo a cuerpo
- Un mago, bueno en el lanzamiento de hechizos y conjuros
- Un pícaro, bueno en el subterfugio, sigilo y ataques a distancia

Entonces la aplicación lee la ubicación actual del usuario y le pregunta si quiere generar su mundo en la ubicación actual o en otra diferente. Si es la segunda, podrá desplazar un puntero por un mapa empezando desde su posición y cuando esté conforme, fijar la posición nueva de generación pulsando un botón.

Al finalizar, la aplicación generará un mapa a partir del mapa del mundo real centrado en la posición seleccionada por el usuario con un radio de 20km. Mantendrá los elementos principales geográficos del mapa:

- Líneas de costa
- Ríos
- Lagos
- Montañas
- ...

Después obtendrá los emplazamientos principales dentro de dicha área:

- Iglesias
- Monumentos
- Miradores
- Parques
- ...

Después cogerá los locales principales que sean aptos para menores (muy importante esto)

- Centros comerciales
- Cafeterías
- Restaurantes
- ...

En función de estos elementos geográficos, emplazamientos y locales, generará diferentes "núcleos de población" ficticios y fantásticos, que serán de cuatro tipos (de menor a mayor tamaño):

- granjas (15-10 como máximo)
- aldeas (10-15 como máximo)
- pueblos (5-10 como máximo)
- ciudades (1 como máximo)

Dentro de cada uno emplazarás diferentes puntos de interés, en función del tipo del núcleo de población:

- posadas (donde se permite descansar y pasar la noche)
- tabernas (donde se puede hablar con aldeanos y obtener trabajos)
- boticarios (donde se permite comprar plantas para recuperar salud y curar enfermedades)
- armerías y herreros (donde se permite comprar armas y armaduras)
- conjurerías (donde se permite comprar libros y pergaminos mágicos)
- ...

---

# Iteración 3-ago-2026 9:49

Feedback sobre el primer prototipo, probado con el mundo generado en A Coruña
("Tierras de Anduril"). Dos problemas detectados y un principio de diseño que
los motiva.

## 1. Granjas (y cualquier núcleo) en medio del mar

El generador colocó granjas en el océano (p. ej. "Granja de el Espino" apareció
en mitad del agua, al noroeste del mapa). Ningún núcleo de población puede
generarse sobre agua:

- Las granjas se colocan en posiciones aleatorias, así que necesitan un test
  "¿es mar?" además del test de lagos que ya existía.
- Requiere saber qué lado de la línea de costa es agua (en OSM el agua queda a
  la derecha del sentido de dibujo del way de costa).

## 2. Radio dinámico cuando la costa corta el círculo

El mapa se genera con un radio fijo de 20 km. Cuando el borde del círculo corta
masas de agua costeras cerradas —bahías, rías— el mapa queda truncado de forma
que confunde: se ve media ría y no se entiende la geografía.

Regla deseada:

- Detectar si el borde del círculo está cortando agua costera.
- Distinguir dos casos:
  - **Océano abierto**: no se puede evitar cortar agua (el Atlántico no se
    acaba ampliando el radio). Ahí el corte sobre agua es aceptable.
  - **Bahías y rías**: ampliar el radio dinámicamente hasta que el borde corte
    terreno seco, de manera que la ría/bahía quede completa dentro del mapa.
- Una vez alcanzado terreno seco, añadir todavía un margen extra de ~4-5 km,
  para que la costa quede cómodamente dentro del círculo y no rozando el borde.

## Principio de diseño que motiva el punto 2

Los usuarios van a interactuar con el mundo real físicamente: caminarán o
viajarán de un punto a otro del mapa (p. ej. rodear una ría por la carretera
real que la bordea) mientras la aplicación proyecta su posición sobre el mapa
fantástico. Para que sepan por dónde van, la geografía proyectada tiene que ser
completa y reconocible: una ría cortada por la mitad impide entender el camino
real que la rodea. La fidelidad geográfica en los bordes del mapa no es
cosmética, es funcional (navegación).

Implicación futura (aún no pedida para el prototipo): probablemente haya que
representar también los caminos/carreteras principales como "caminos" del mundo
de fantasía, porque son las rutas por las que los usuarios se moverán de verdad.

[WORK IN PROGRESS]

---

# Iteración 3-ago-2026 10:20

- Las granjas seguían pudiendo caer en el mar o en islas demasiado pequeñas
  (el test puntual "¿es mar?" no descarta islotes).
- Cambio de regla: las granjas también se anclan a locales principales reales
  (cafeterías, restaurantes… restantes tras repartir ciudad/pueblos/aldeas),
  igual que el resto de núcleos. Un lugar real garantiza tierra firme.
- Solo si no hay locales suficientes se recurre a posiciones aleatorias, y en
  ese caso se exige "tierra firme": ni el punto ni un anillo de 400 m a su
  alrededor pueden tocar mar (descarta islotes).

---

# Iteración 3-ago-2026 11:00

- El usuario elige el radio mínimo del mundo, ahora desde 100 m (antes 2 km).
- La expansión costera del radio es proporcional al radio elegido
  (para 20 km: hasta +6 km con ~4 km de margen, como antes; para 500 m: unos
  centenares de metros), y la resolución de la máscara tierra/mar se afina en
  mundos pequeños (celda de 40-200 m según el tamaño).
- Probado con 500 m en el puerto de A Coruña: radio dinámico 0,5→0,7 km
  y los muelles del puerto bien recortados en el mar.

---

# Iteración 3-ago-2026 11:20

Cupos de núcleos EXACTOS por radio (sustituyen al escalado proporcional
anterior y a los rangos aleatorios de la spec inicial). Nótese que ahora puede
haber hasta 2 ciudades:

| Radio      | Ciudades | Pueblos | Aldeas | Granjas |
|------------|----------|---------|--------|---------|
| 100-250 m  | 1        | 1       | 1      | 1       |
| 250-500 m  | 1        | 1       | 1      | 2       |
| 1 km       | 1        | 1       | 2      | 3       |
| 2 km       | 1        | 2       | 3      | 4       |
| 5 km       | 1        | 3       | 4      | 5       |
| 10 km      | 2        | 5       | 7      | 5       |
| 20 km      | 2        | 9       | 14     | 20      |

- Entre tramos se interpola linealmente; por encima de 20 km se mantiene el
  último cupo.
- Los cupos se garantizan siempre: si no hay anclajes reales suficientes, se
  rellena con posiciones aleatorias en tierra firme (relajando la separación
  si no caben).
- Las dos ciudades (mundos ≥ 10 km) se colocan en los dos mejores clústeres de
  anclajes, separadas al menos un 35% del radio.
- Los anclajes que caen en el mar (locales en muelles, errores de máscara) se
  descartan para cualquier tipo de núcleo.

---

# Iteración 3-ago-2026 11:45

Los puntos de interés internos (posadas, tabernas, boticarios…) dejan de ser
solo texto: cada uno queda **anclado a un elemento real concreto** (monumento,
iglesia, parque, edificio, negocio…) con sus coordenadas.

- Al fundar un núcleo, sus servicios se asignan a los POIs reales libres más
  cercanos, dentro del "radio urbano" del núcleo (ciudad 600 m, pueblo 400 m,
  aldea 250 m, granja 150 m — escalado con el tamaño del mundo). Cada POI real
  solo puede albergar un servicio (o un núcleo): no se repiten.
- Si no hay POIs reales suficientes cerca, el núcleo tiene menos servicios
  (no se inventan servicios sin anclaje real).
- La ficha lateral muestra el lugar real de cada servicio: "📍 Igrexa Vella…".

Interacción de zoom:

- Clic en un núcleo (mapa o lista) → la ficha de servicios + **zoom del mapa**
  centrado en el núcleo, abarcando todos sus servicios.
- En la vista ampliada, cada servicio se marca sobre su ubicación real con un
  medallón con inicial (P posada, T taberna, B botica, H herrería, C conjurería,
  M mercado), el punto exacto y su nombre de fantasía. La cartela pasa a mostrar
  el nombre del núcleo y la escala se adapta.
- Volver: botón "🗺️ Mundo completo" o clic en una zona vacía del mapa.

(Extra: `__wa.demo()` en consola genera un mundo sintético sin Overpass, útil
para probar el render cuando el servicio está saturado.)

---

# Iteración 4-ago-2026 10:45 — red viaria

El mapa quedaba vacío entre núcleos. Se añade la red viaria con nivel de detalle **semántico** (por rol, no por radio):

- **Entre núcleos (vista mundo): red vertebral con routing.** Se descargan las carreteras principales (`motorway…tertiary`, con `unclassified/track` de respaldo rural), se construye un grafo (intersecciones por nodo OSM compartido), cada núcleo se ancla a su nodo más cercano (tope 2 km; más lejos = isla) y se conectan todos los núcleos con un árbol de expansión mínima sobre distancias de ruta real. Se pintan solo esas rutas, como calzadas de trazo doble siguiendo las curvas de las carreteras reales.
- **Cada ruta tiene nombre de fantasía** ("La Vieja Ruta del Oeste", "La Senda de Brulira la Vieja", "El Camino del Mediodía"…), generado por dirección predominante o destino, únicos por mundo, rotulado sobre el camino.
- **Núcleos sin camino** (islas, sin datos): ruta recta punteada como fallback para que nada quede huérfano.
- **Dentro del núcleo (vista zoom): callejero local.** Al enfocar un núcleo se consulta bajo demanda su callejero (`residential/pedestrian/service/path/footway…`, radio urbano, cacheado) y se pinta como textura: calles finas marrones y sendas punteadas, bajo los marcadores de servicios. Los puntos de interés quedan conectados por las calles reales que los rodean.

Verificado con Sanxenxo (Overpass local): vista mundo con 6 rutas nombradas conectando ciudad, pueblo, aldeas y granjas; vista ciudad con el callejero real de fondo y los 6 servicios encima.---

# Iteración 4-ago-2026 13:15 — v0.1.0: reescritura desde cero

La implementación anterior queda archivada en `archive/v0.0.1/`. La v0.1.0 se reescribe desde cero incorporando las decisiones de diseño de `game-design/` (parametros-mundo.md y parajes.md):

- **Presets de duración**: el selector ofrece Paseo ~1 h (700 m), Aventura ~2 h (1,2 km) y Jornada ~3 h (1,9 km); el slider de km queda en un desplegable "Avanzado" para testing (decisión: presets + modo avanzado).
- **Parajes**: nueva categoría de hitos no habitados con 8 tipos (ruina, piedra antigua, ermita, fuente, atalaya, cruce, puente, monasterio), escenas propicias con pesos, tipo desacoplado del anclaje real con sesgo suave, selección cerca-de-ruta y lejos-de-núcleos, y cruces/puentes derivados del grafo viario como colchón garantizado. Clic en paraje → ficha con escenas + zoom.
- **Nombres por idioma según ubicación**: paquetes `es` y `gl` con interfaz común (núcleos, servicios, rutas, parajes y título del mundo); Galicia (bounding aproximado) → gallego.
- **Arquitectura nueva**: `js/core` (rng, geo), `js/data` (Overpass), `js/world` (seamask, settlements, routes, parajes), `js/names`, `js/render`. La consulta de POIs se amplía con manantiales, fuentes, torres, faros, cruceros y monasterios (más anclajes y alimentan el sesgo).
- Se conserva todo lo probado de v0.0.1: máscara tierra/mar por lado de costa, radio dinámico costero, cupos exactos por radio, servicios anclados a POIs únicos, red vertebral MST con nombres, callejero local en zoom, proxy con caché + Overpass local.

Verificado: tests headless (cupos, parajes con cupo y nombres únicos, colchón del grafo sin anclajes, rutas, idiomas, determinismo) y E2E en Chrome. Sanxenxo (paseo, 0,7→1,1 km): "Terras do Abrente Gris" todo en gallego, con "O Torreón Esquecido" (ruina) anclado al chiringuito Mardivino Asador — el desacoplamiento en acción — y ciudad con callejero + 6 servicios. Toledo (aventura, 1,2 km): castellano, 5 parajes con el sesgo suave anclando "La Fortaleza Rota" a los Restos del Acueducto Romano.
---

# Iteración 4-ago-2026 14:00 — simulador de casting de quests

Primera pieza de la capa de quests (game-design/quests.md): el simulador de casting valida que los mundos generados tienen "densidad de reparto" suficiente antes de construir el juego.

- `js/quests/templates.js`: 6 plantillas-arquetipo con roles abstractos (servicio/núcleo/paraje-con-escena), beats en lazo y textos de fallback (el LLM los vestirá en el juego final).
- `js/quests/casting.js`: castTemplate/castAll — backtracking determinista con la semilla sobre los candidatos del mundo; lugares distintos por rol, tramos entre beats de 0,1-2,4 km (~30 min máx), escena del paraje con peso ≥0,2; estima distancia caminada (rodeo ×1,35) y minutos (72 m/min) y clasifica en qué preset encaja. Si no castea, explica el motivo.
- UI: sección "Quests casteables (N/M)" en el panel; clic → ficha con gancho, beats numerados con lugar de fantasía y lugar real, y el lazo punteado numerado dibujado sobre el mapa.
- Tests headless: casting completo sobre mundo sintético (≥la mitad del catálogo castea, lazos cerrados, escenas correctas, determinismo, motivos claros). Un fallo del test destapó que la plantilla "tres pistas" no cerraba el lazo: corregida la plantilla (beat de vuelta a la taberna), no el test.
- Verificado en Chrome con Toledo (aventura): 4/6 casteables; "La entrega sospechosa" castea Taberna del Búho Astuto → La Fortaleza Rota (Restos del Acueducto Romano) → Forja del Búho Plateado (La Cofrería) → vuelta, 2,4 km ~33 min. Las 2 no casteables explican el motivo: ese mundo no tiene paraje con "emboscada" (no casteó cruces) — exactamente la señal de diseño que el simulador debía dar (anotado en quests.md como pendiente 6).
---

# Iteración 4-ago-2026 14:40 — afinado de escenas con el informe de casting

Cierre del pendiente 6 de quests.md con datos, tras decidir ampliar "emboscada" a más tipos (en vez de subir el suelo de parajes del grafo).

- Escenas ampliadas por criterio narrativo: emboscada → ruina y puente; guarida → puente (el troll bajo el puente); vigilancia → cruce (vigilar quién pasa). Los roles de plantilla admiten ahora escenas alternativas: la ronda del vigía acepta "vigilancia o revelación" (cualquier sitio desde donde se ve lejos). Taxonomía actualizada en game-design/parajes.md.
- Refactor: la construcción del mundo se extrae a `js/world/build.js`, compartida por la app y las herramientas headless — misma tubería, mismos mundos (el proxy es configurable en Node vía `globalThis.__WA_PROXY__`).
- Nuevo `test/casting-report.mjs`: castea el catálogo sobre 18 mundos sintéticos (700/1200/1900 m × 6 semillas) y 4 reales (Sanxenxo, Toledo, Madrid, A Coruña) vía el proxy con caché, y agrega casteabilidad por plantilla con histograma de motivos de fallo.
- Resultado: los 4 mundos reales castean 6/6 plantillas. En sintéticos: entrega sospechosa 77→95%, ronda del vigía 41→77%, cita y tres-pistas 100%, resto ≥86%. Los fallos restantes son mundos de paseo con 2-3 parajes donde no caben todas las escenas — aceptable: el catálogo siempre ofrece varias quests por mundo.


---

# Iteración 4-ago-2026 — CLAUDE.md y rescate de `js/data/overpass.js`

Se añade `CLAUDE.md` (guía de trabajo para agentes: comandos, tubería de generación, reglas del proyecto — determinismo, anclaje único, primacía de `game-design/` —, estilo y trampas). Al escribirlo se destapó que **la app estaba rota**: `js/data/overpass.js` no existía ni en el working tree ni en ningún commit.

- **Causa**: la regla `data/` de `.gitignore` (pensada para el extracto de OSM de la raíz, montado en `docker-compose.yml`) hacía match también con `js/data/`. El módulo nunca se commiteó y nadie lo notó porque `test/headless.mjs` no importa esa capa: los tests seguían en verde con la app muerta (`Cannot find module .../js/data/overpass.js` en `js/main.js` y `test/casting-report.mjs`). Arreglado anclando las reglas: `/data/`, `/overpass-db/`, `/.cache/`.
- **Reconstrucción** a partir de la interfaz que exigen los llamantes y de `archive/v0.0.1/js/overpass.js`, con la ampliación de POIs que la v0.1 daba por hecha: manantiales, fuentes, torres, faros, cruceiros, monasterios, y `ruins`/`archaeological_site`/`wayside_cross` separados de `monumento` para que alimenten el sesgo suave de tipo de paraje.
- **Decisión con datos: fuera `amenity=drinking_water`**, aunque `game-design/parajes.md` lo lista para el tipo Fuente. Medido sobre los 4 mundos de referencia es mobiliario urbano sin nombre (A Coruña 186 anclajes, 3 con nombre; Toledo 16, ninguno): no da reconocimiento —el sentido del anclaje es el guiño de identificar el lugar real— y su volumen monopolizaba el sesgo `fuente`, matando la diversidad de tipos que pide el propio documento ("mejor uno de cada que cinco fuentes"). Con él dentro, A Coruña se quedaba sin ningún paraje de vigilancia/revelación (5/6) y las fuentes de Toledo eran 25; fuera, A Coruña vuelve a 6/6 y Toledo baja a 9 fuentes con reparto diverso. Reflejado en `parajes.md` como nota con los datos, del que se deriva una regla general: un tag solo entra si aporta reconocimiento.
- **Verificado**: `test/headless.mjs` en verde; `test/casting-report.mjs` reproduce **exactamente** las cifras documentadas en la iteración de las 14:40 para los 18 mundos sintéticos (entrega 95%, cita 100%, tres-pistas 100%, peregrinaje 86%, rescate 95%), lo que confirma que no hay regresión fuera de la capa de datos. Mundos reales: Sanxenxo, Madrid y A Coruña 6/6; Toledo 5/6 (le falta vigilancia/revelación). Sanxenxo reproduce el mundo documentado en la iteración de las 13:15 — "Terras do Abrente Gris" con "O Torreón Esquecido" (ruina) anclado al chiringuito Mardivino Asador.
- La divergencia de Toledo es azar de esa semilla, no un sesgo de datos: su mezcla de anclajes tiene 23 miradores, 11 piedras y 4 torres disponibles, pero los 5 huecos cayeron en ruina/ermita/fuente/puente/puente. No se afina la consulta para forzar 6/6: sería sobreajustar la capa de datos a una semilla, y el propio informe da esos fallos por aceptables.


---

# Iteración 4-ago-2026 — Overpass local compartido entre worktrees

El Overpass local se reimportaba (o simplemente no funcionaba) en cada worktree nuevo. Al investigarlo apareció algo peor: **el contenedor llevaba 7 h "Up" y completamente vacío**. Su base de datos era un bind mount relativo (`./overpass-db`) dentro de un worktree de Orca que se borró; el contenedor sobrevivió apuntando a una ruta inexistente y respondía **200 con una página de error XML** a cada consulta. El proxy la descartaba y caía a los mirrors públicos, así que todo "funcionaba", solo que lentísimo y castigando a un servicio comunitario. Nadie se enteró porque el síntoma en el log era un críptico `Unexpected token '<'`.

Rediseño para que el estado pesado no dependa de ninguna ruta ni de ningún worktree:

- **Base de datos → volumen Docker con nombre** `walkingadventure-overpass-db`, en vez de bind mount relativo. Independiente del directorio de lanzamiento; ningún worktree se la lleva por delante al borrarse. En macOS, además, va dentro del disco de la VM: mucho más rápido que un bind mount para una importación pesada. `name: walkingadventure` fija el nombre del proyecto Compose (si no, cada worktree crearía su propio stack).
- **Extracto `.pbf` y caché HTTP → `~/.walkingadventure/`** (`WA_HOME` para moverlo, `WA_CACHE_DIR` para la caché sola). La caché dentro del repo hacía que cada worktree arrancase en frío y repitiese las mismas consultas contra los mirrors públicos. Migradas las 24 respuestas ya cacheadas; verificado: los 4 mundos reales del informe se reconstruyen en 4,9 s con 12 HITs y cero red.
- **Arranque automático**: `restart: unless-stopped`, así que en una sesión nueva no hay que hacer nada.
- **`scripts/overpass-setup.sh`**, idempotente y de un solo uso por máquina. Su comprobación de "listo" es una consulta real buscando `"elements"`, no `docker ps`: precisamente el fallo anterior era un contenedor sano a ojos de Docker.
- **Mirror del extracto: OSM France en vez de Geofabrik.** Medido: Geofabrik limita por IP a ~100 KB/s (una segunda conexión cae a 750 B/s) → ~3h45 para 1,4 GB; OSM France arranca en varios MB/s y se estabiliza más arriba. Ambos son el extracto completo del país. Como las secuencias de diffs no son intercambiables entre proveedores, `OVERPASS_DIFF_URL` pasa también a la replicación de OSM France. El script recuerda el mirror usado (`.pbf-source`) porque reanudar contra otro corrompería el fichero.
- **`server.mjs`** distingue ahora la página de error XML del "no es JSON" genérico y lo dice claro (`sin datos servibles (...)`), porque el arreglo es distinto: revisar el contenedor, no reintentar.


---

# Iteración 4-ago-2026 — cinco estilos de mapa intercambiables

A partir de cuatro plantillas de referencia (`temp/ideas-mapas/`), el pintado deja de ser una sola estética fijada en el código: ahora es un parámetro que se puede cambiar sobre el mapa ya generado, para comparar estilos sobre el mismo mundo sin resembrarlo.

- **Nuevo `js/render/styles.js`**: cada estilo es un objeto de datos (papel, tierra, agua, costa, bosque, picos, calzadas, glifos, tipografía, cartela, marco, brújula) que se fusiona sobre unos `DEFAULTS`, así que un estilo solo declara lo que le distingue. `js/render/map.js` no tiene ya ni un color ni un grosor propios: todo sale del tema.
- **Los cinco**: `reino` (**el elegido como estilo por defecto**), `clasico` (el disco de v0.1, intacto como referencia de comparación), `pergamino` (carta antigua manchada con filacterias en las calzadas y cartela de rollo), `cuento` (prado verde, casitas de tejado rojo, marco de zarza en flor, rótulos manuscritos en Caveat), `atlas` (pastel a sangre sin marco, halos concéntricos de costa, versalitas espaciadas en Cinzel, rosa de los vientos gigante detrás del mapa) y —de nuevo— `reino` (mar azul, montañas nevadas, marco dorado, banderola superior), que es el que queda por defecto: la referencia `b03241c5` es la que mejor sostiene un mapa denso de núcleos y parajes, porque separa mar, tierra y bosque por color y no solo por línea.
- **La forma del mapa pasa a ser del estilo** (`shape: 'disc' | 'rect'`): los cuatro nuevos son rectangulares como sus referencias; el disco se conserva en `clasico`.
- **Selector en la barra del mapa**, construido desde `STYLES` (añadir un estilo no toca el HTML) y recordado en `localStorage`; hook `__wa.style(id)`. El cambio solo repinta: la generación no depende del estilo, y el determinismo no se toca.
- **`__wa.demo()` gana terreno sintético** (bosques, picos, lago, costa con máscara de mar): sin él no se podían comparar estilos, que se juegan casi todo en el terreno.
- Arreglado de paso: `#fantasy-map` se aplastaba porque `max-height` con `height:auto` no conserva la proporción del canvas cuadrado (`aspect-ratio: 1/1`).
- Verificado en Chrome sobre Muros (42.7762, -9.0596, jornada — mundo costero con ría, bosques y picos): los cinco estilos pintan el mismo mundo "Comarcas de Nharem" y se alternan al instante. Ajustes hechos a la vista del resultado: contraste mar/tierra en `atlas` (el mar de menta se confundía con la tierra), manchas de humedad de `pergamino` reescritas como racimos de círculos pequeños (una circunferencia grande se leía como un círculo, no como una mancha) y viñeteo bajado de 0.5 a 0.34, y la escala se aparta a la esquina inferior libre cuando la brújula ocupa la izquierda.


---

# Iteración 4-ago-2026 — del mapa ilustrado al mapa base: qué se probó y qué quedó

Sesión larga de exploración visual sobre el estilo `reino` que terminó **abandonando la ilustración y dejando un mapa base plano**. Se anota entera, incluidos los callejones sin salida, porque lo caro fue descubrirlos y sin esto se repetirían.

**Nota sobre la entrada anterior**: la descripción de `reino` ahí ("mar azul, montañas nevadas, marco dorado") ya no vale. Los otros cuatro estilos siguen como estaban.

## Lo que se probó y se abandonó

**1. Montañas procedurales encadenadas en sierras.** El primer intento dibujaba un glifo por pico de OSM y se leía como pegotes sueltos. El enfoque correcto resultó ser que **la unidad de dibujo es la sierra, no el pico**: agrupar picos por cercanía, encadenarlos con un árbol de recubrimiento mínimo, sembrar cumbres a lo largo de esa cordal hundiéndolas hacia el collado, añadir una segunda fila por delante y pintar de norte a sur para que las de delante tapen las bases. También se aprendió que **la altura no puede depender de la cota real**: con picos gallegos de 100-200 m salían de 30 px, invisibles. El código sigue en `js/render/map.js` (`drawSierras`) pero **ningún estilo lo usa**.

**2. Biblioteca de sprites generados por IA (Magnific).** Se montó la tubería entera —generación, sondeo de tarea, quitafondos, normalizado, encuadre por `meta.json`— y se eligieron 6 cumbres de 24 candidatas. **Retirado a petición del usuario.** El aprendizaje que sí sobrevive, por si se vuelve a intentar:

- La lámina entera como referencia de estilo hace que el modelo copie la **composición**: devuelve otro mapa, con marco y rosa incluidos. La referencia tiene que ser un recorte del elemento.
- "Game icon asset" invoca maqueta isométrica con peana y sombra.
- Negar el 3D no basta. Lo único que rompió el sesgo de loseta de terreno fue **invocar un medio 2D por naturaleza**: "pen and ink line drawing on parchment", "line art", "no perspective".
- Nombrar algo aunque sea para negarlo lo invoca: pedir "no sticker border" pinta el borde blanco de pegatina.
- Mystic ignora la composición; Flux obedece bastante mejor.
- Y lo decisivo: **con el mismo prompt, la semilla decidía la composición**. Una cumbre salía perfecta y las cinco siguientes eran losetas isométricas. Un generador así no da consistencia entre piezas sin descartar a mano.

**3. Generar el mapa entero por image-to-image.** La hipótesis era buena — en la referencia todo parece dibujado *porque lo dibujó una sola mano*, y nosotros componíamos un collage — y se falsó con una medida, no con una opinión. Se exportó la capa de terreno vectorial y se pasó por Mystic con `structure_reference` y **`structure_strength: 100`** (parámetro no documentado; se descubrió mandando valores fuera de rango y leyendo qué campos protestaban). Comparando la costa vectorial con la generada sobre rejilla de 256 px:

| | desplazamiento | sobre el ancho | metros |
|---|---|---|---|
| mediana | 3 px | 1,17 % | ~58 |
| p90 | 16 px | 6,25 % | ~309 |
| peor | 53 px | 20,7 % | ~1.023 |

Superficie de mar: **31,9 % en el vectorial contra 26,2 % en el generado** — el modelo rellena calas y engorda la tierra. **Descartado**: una de cada diez zonas de costa se mueve más de 300 m, y esto es un mapa con el que se camina. Como se midió con la fidelidad al máximo, no hay ajuste que lo salve. Segundo fallo independiente: con la estructura al máximo el `style_reference` apenas influye, así que el estilo tampoco llegó. Sigue siendo válido como lámina de recuerdo, donde la exactitud ya no importa.

**4. Texturas de relleno generadas.** Papel, prado y bosque, hechas mosaico por espejado y aplanadas dividiéndolas por su propio desenfoque (sin eso, al repetirlas aparecía una cuadrícula clarísima). Funcionaban, pero **retiradas** con el resto.

## Lo que quedó

**Mapa base plano**, que es lo que pidió el usuario tras ver el resultado acumulado: tierra verde y mar azul sólidos, costa de 9 px, ríos principales de 7 px, la red de calzadas, y puntos rojos como marcadores provisionales de núcleos y parajes. Sin relieve, sin vegetación, sin texturas, sin sprites.

- **Capas apagables por estilo** (`capas: { bosques, picos, carreteras, rotulosCamino, lagos, soloRiosPrincipales }`). Es la forma de tener un mapa base limpio sin borrar el código que los otros cuatro estilos siguen usando.
- **Sobre el agua no se pinta nada.** Dos medidas: los bosques y picos que caen en el mar se descartan por máscara, y el mar se pinta **después** del terreno para que lo que se derrame quede tapado.
- **Limpieza de la máscara al pintar** (`despeca`): filtro de mayoría más análisis de componentes conexas. Las manchas de tierra que no llegan al 4 % del continente se hunden (islotes y errores en bloque) y las de mar que no llegan al 4 % del océano se rellenan (charcos azules tierra adentro). Una ría de verdad sobrevive porque está conectada al mar abierto. **Solo afecta al pintado**: la máscara original no se toca porque de ella dependen la colocación de núcleos y el radio dinámico. También se descarta la línea de costa de los islotes, que seguía dibujándose sin su relleno.
- **Ríos principales**: `js/data/overpass.js` conserva ahora el tag (`river` / `stream` / `canal`). En el mundo de prueba, 3 de 39 tramos son río; el resto, regatos.
- **Zoom libre**: rueda del ratón hacia el punto bajo el cursor, botones − / + y arrastre para desplazar, con umbral de 4 px para no confundirlo con un clic. De 40 m de radio al mundo entero.

## Regla nueva: todo lo marcado tiene que ser andable

Dos reglas que puso el usuario y que son de diseño, no de pintado: **ningún camino que no una puntos del mapa**, y **todo punto marcado conectado por camino**.

- Se quitó la capa de red viaria cruda de OSM (la había metido esta misma sesión): el mapa pinta solo `world.routes`.
- **Nuevo `linkParajes`**: engancha cada paraje a la red con un ramal, buscando el punto de la red más próximo *por carretera* — no el núcleo más cercano en línea recta, que daba rodeos absurdos. Los parajes nacidos del grafo (cruces, puentes) se saltan porque ya están sobre una calzada. Los ramales van sin nombre y más finos: son sendas de acceso, no calzadas con historia.
- **Nuevo `coserHuecos`**, y es el hallazgo importante: el callejero de OSM **llega troceado**. En el mundo de prueba salían **109 componentes**, muchas a 9-50 m unas de otras y la red entera del norte a 157 m del resto. No son carreteras distintas: a los ways les faltan nodos compartidos, o el corte del bounding box parte la conexión. Se cosen por orden de menor a mayor hueco (Kruskal) hasta 180 m.
- **Nuevo `pegarAViario`**: lo que aun así quedaría unido por una recta se mueve al nodo más cercano de la red principal, con tope de 1.200 m para no arrastrar a tierra firme un núcleo que está en una isla.

**Medido en A Coruña (43.3891, -8.3276, jornada)**: antes, 6 de 15 caminos eran rectas punteadas. Con solo mover elementos, bajaban a 3 y había que desplazar cuatro cosas, dos de ellas más de 1,1 km. **Cosiendo primero los huecos del grafo: 0 rectas y un único elemento movido, 350 m.** Es la diferencia entre arreglar el síntoma y arreglar el dato.

## Pendiente

- `drawSierras` y el resto del dibujo de relieve están vivos pero sin usar por ningún estilo.
- Los marcadores son puntos rojos provisionales, a la espera de decidir su forma.
- Los otros cuatro estilos no se han revisado desde todos estos cambios.
- La detección de "río principal" depende del tag de OSM, que no siempre está bien puesto.

Cierre de la iteración, con dos sorpresas que solo aparecieron al terminar la importación (~1 h, 11 GB):

- **El volumen con nombre destapó un problema de permisos que el bind mount ocultaba.** `/db` viene del image como `700 overpass:overpass` y nginx/fcgiwrap corren como uid 101: no podían atravesarlo para alcanzar el socket del dispatcher (que sí era 666). En macOS los bind mounts ignoran los permisos, así que esto nunca se había visto. Lo peor es que el síntoma —200 con página de error XML— es **idéntico** al de "no hay base de datos"; solo las distingue el texto del error (`Permission denied` vs `No such file or directory`). `chmod 755 /db`, ya incorporado a `scripts/overpass-setup.sh`.
- **Las actualizaciones por diffs quedan desactivadas.** Tras importar el extracto de OSM France, el updater no encontraba su secuencia de replicación (404 en los `.state.txt`), bajaba osmChange vacíos y repetía "Error while downloading diffs" cada pocos minutos indefinidamente. Basta con no definir `OVERPASS_DIFF_URL`. Para el prototipo la frescura es irrelevante, la misma razón por la que la caché del proxy es permanente.
- Verificado que recrear el contenedor **no** repite la importación: el entrypoint salta todo el bloque si existe `/db/init_done`.
- **Resultado medido**: los 4 mundos reales del informe se reconstruyen desde caché vacía en **8,4 s**, íntegramente contra el Overpass local y sin un solo fallo de upstream (antes, minutos y 504 contra los mirrors públicos). Los recuentos de anclajes salen idénticos a los obtenidos vía mirrors (Sanxenxo 106, Toledo 332, Madrid 2559, A Coruña 1371): cambiar de Geofabrik a OSM France no alteró los datos.

# Iteración 5-ago-2026 — rótulos legibles en el mapa base

El usuario mandó una captura del estilo Reino: **los nombres no se leían**. El diagnóstico tenía tres capas y solo una era obvia.

- **El halo era blanco translúcido** (`rgba(255,255,255,0.85)` a 5 px) sobre el prado `#7fae5a`. Ese blanco no separa la letra del fondo: la aclara. El halo estaba puesto pensando en los estilos de papel claro, donde sí funciona; heredado sin revisar al nacer el mapa base.
- **Cinzel es de trazo fino** y con `scale: 0.92` un paraje sale a 12 px reales, en versalitas y con tracking. Trazo fino + letra pequeña + espaciada es la peor combinación posible contra un color plano.
- **No hay declutter**: la calzada crema `#f2e7c8` cruza el rótulo. En la captura, «La Atalaya del Ocaso» estaba partido en dos por su propio camino.

## Lo que se decidió: jerarquía, no un tratamiento único

Se maquetaron cuatro tratamientos en canvas —con el mismo código de pintado, sobre tres escenarios de fondo (prado limpio, sobre la calzada, racimo denso)— y se comparó pintado contra pintado. El escenario decisivo no es el prado limpio, donde todo vale, sino los otros dos:

- **Solo halo, en crema opaco** (cambio de tres valores, cero código) se cae justo donde hacía falta: el halo crema y la calzada crema son casi el mismo color, así que sobre el camino desaparece.
- **Placa en todos los rótulos** es lo más legible en absoluto, pero veinte rectángulos claros convierten el prado en un tablero.
- **Elegido: placa solo en núcleos, halo crema en parajes.** Resuelve la legibilidad donde el fondo es peor y, de propina, arregla algo que no se había pedido: hasta ahora un pueblo y un paraje se rotulaban casi igual, y en un juego que se camina esa distinción importa. La placa no es vocabulario nuevo — es la cartela del título (`cartouche: banner`, mismo `fill` crema y mismo filete dorado) reducida al tamaño de un nombre.

## Implementación

Sigue la regla de la casa: **el estilo son datos, `map.js` no decide nada**.

- `label.placa` es la **lista de roles** que van sobre caja (`'nucleo'`, `'paraje'`, `'servicio'`, `'ruta'`); vacía en `DEFAULTS`, `['nucleo']` en Reino. Los cuatro puntos de llamada de `drawTextLabel` declaran su rol.
- `placa` es el grupo nuevo con la geometría y el color de la caja (`fill`, `border`, `lw`, `padX`, `padY`, `radio`, `color`, `sombra`); `null` en `DEFAULTS`, así que ningún otro estilo cambia.
- `label.haloPasadas` repite el `strokeText`. Con halo opaco una sola pasada deja el borde lavado por el antialiasing; Reino usa 2.
- `drawPlacaLabel` respeta el contrato de `drawTextLabel` (centro horizontal, y el borde que diga `baseline`), para que la caja cuelgue del punto donde antes empezaba el texto y ningún desplazamiento cambie.
- Detalle que costaba un rótulo descentrado: `measureText` **incluye el tracking sobrante tras la última letra**, así que hay que descontarlo al calcular el ancho de la caja.

**Verificado** con `node test/headless.mjs` (verde, pero no toca `render/` — no prueba nada de esto) y sobre todo abriendo la app: mundo sintético con `__wa.demo()` y mundo real en **42.8782, -8.5448 (Santiago de Compostela, «Dominios da Pedra Antiga», 7 núcleos y 5 parajes)**, donde los nueve rótulos se leen a la primera. Comprobado también que Pergamino sigue idéntico (filacterias, halo, ninguna placa).

## Pendiente

- **El declutter deja de ser opcional.** Ninguno de los cuatro tratamientos arregla el racimo denso, y la placa lo empeora *visualmente*: dos cajas opacas que chocan cantan mucho más que dos textos que se rozan.
- Los otros cuatro estilos podrían querer su propia placa (`placa: ['nucleo']` más un grupo `placa`), pero no se ha tocado ninguno.

---

# Iteración 5-ago-2026 — el mundo vive: pasos, rumores y la frontera del LLM

Iteración de **diseño, sin código**: no se toca ni un módulo. Nace de analizar diez vídeos de **El Hacedor de Mundos** (`@elhacedordemundos`), un RPG narrativo dirigido íntegramente por LLM que un desarrollador está construyendo en abierto con Claude Code. El análisis completo está en `el-hacedor-de-mundos.md`; aquí queda lo que de ahí se convirtió en decisión.

La conclusión de partida es que **no es competencia**: su mundo es ilimitado y alucinado, el nuestro está anclado y es determinista. Pero su capa de simulación social —rumores que se deforman, NPCs que viven entre turnos, facciones que avanzan solas— ataca justo lo que a Walking Adventure le falta: el mundo es precioso y está muerto. De sus ideas se han cerrado tres en `game-design/quests.md`, y ninguna tal cual.

## Los kilómetros son el reloj del mundo (decisión 4 reescrita)

Su mundo avanza con el calendario. Se descartó por FOMO: en un juego que se progresa **caminando**, penalizar la ausencia castiga a quien trabaja, se lesiona o tiene críos, y choca de frente con las secciones 4 y 8 del propio documento. La alternativa elegida es que el mundo avance por **pasos** al ritmo de los kilómetros del jugador. Un paso = un tramo (~2 km, ~30 min), constante que ya existía y no hubo que inventar.

Consecuencias que salieron solas: caminar vale incluso fuera de una quest; ya no hace falta techo (las piernas lo son); y desaparece el reloj real de la generación, coherente con la prohibición de `Date.now()`. El determinismo se salva con un detalle que quedó escrito: **el contenido del paso *n* lo decide el número, no la fecha** (`makeRng(seed + ':tick:' + n)`); el reloj solo decide cuántos pasos hay.

Qué kilómetros cuentan es **configurable**: los de sesión por defecto, ampliable a los pasos del día a día como opt-in explícito. Ese segundo modo sí acumula —el usuario levantó el caso de tres meses sin jugar y 457 km, que serían 228 pasos y un tocho ilegible—, así que lleva **reserva con tope de 5 pasos**, y el tope lo fija *lo que cabe en un resumen legible*, no lo que se puede simular. Regla asociada: un paso **solo añade**, y nunca resta por no haber salido.

## El rumor viaja por el árbol de calzadas (sección 6 reescrita)

La mejor pieza, y donde su idea se vuelve más nuestra que suya. Ellos deforman los rumores con una constante inventada y limitan a 15 activos. Nosotros ya tenemos, gratis, lo que hace falta: `buildRoutes` construye un **árbol de expansión mínima** sobre los núcleos con caminos reales, así que entre dos núcleos hay un único camino, con saltos y metros bien definidos.

De ahí las dos variables, deliberadamente separadas: **la distancia manda el tiempo** (un tramo por paso, la misma velocidad a la que anda el jugador — se puede adelantar a la propia fama) y **los saltos mandan la fidelidad**, porque deformar es un acto social, no geográfico. Dos pueblos a la misma distancia reciben la noticia con distinta fidelidad según cuántas aldeas haya en medio: **la forma del mapa se vuelve legible en la narrativa**. Los tramos `fallback` —los que `buildRoutes` traza en recta porque no hay camino real— suman un nivel extra: la noticia que cruza el monte llega peor.

Escalera de cuatro niveles (fiel · abultado · trastocado · leyenda) y una regla de tono decidida por el usuario: **la deformación nunca invierte el signo moral**. Lo bueno llega como bueno; cambian la escala, el protagonista y el detalle. Y no hace falta cap de rumores: el árbol es finito, así que **el rumor se agota solo**.

Efecto sobre el diseño: la reputación deja de ser un número que sube donde actuaste. **La reputación es lo que llegó, no lo que hiciste.**

## El árbitro es el código (decisión 1 ampliada)

Su juego tiene dos LLM, Narrador y Árbitro, y dos de los diez vídeos son él depurando con Claude por qué la moralidad y el oro no cuadran entre sistemas. Esa es la factura de no tener frontera. La nuestra queda escrita: **el árbitro es el código** —casting, geofence, máquina de beats— y el LLM solo narra.

La línea fina no es "nombres sí, cantidades no", sino **datos vivos** (los que el código lee para decidir) contra **datos inertes** (los que solo se muestran). La prueba: *si alguna regla bifurca por él, no lo escribe el modelo*. Con corolario testeable —con LLM y sin LLM, misma estructura, solo cambia la piel— y una aclaración que faltaba: el determinismo se aplica al esqueleto; la prosa se genera una vez, se cachea y se guarda con la partida.

Sobre nombres se decidió que el LLM **propone y el código valida**, con un matiz que salva dos invariantes: `js/names/` es el **suelo** —el mundo está completo y con nombres únicos antes de que exista una sola llamada, y por eso `test/headless.mjs` sigue afirmando unicidad sin red— y la propuesta del modelo es una capa opcional encima. El idioma no se valida (no hay forma razonable de comprobar en código que un nombre es gallego legítimo): **se dirige**, pasando el locale y ejemplos del propio paquete como anclaje de estilo. `js/names/` pasa a ser también referencia estilística.

## Y algo que no estaba en su juego (decisión 3 reescrita)

Al encajar lo anterior apareció un sistema propio. Los micro-encuentros oportunistas eran hasta ahora azar decorativo sin origen declarado; ahora son el **canal de entrega** de lo que produce el mundo, con tres vías (en ruta, el estado del núcleo al llegar, y el resumen de apertura solo en modo pasos de fondo) y una regla de aparición que mata el relleno aleatorio: **solo salta si hay algo que entregar**.

Dos reglas duras: **coste cero de desvío** (ocurre en el camino, nunca manda fuera del lazo ni consume presupuesto) e **ignorarlo es gratis**. El aviso es de tres capas —marca, háptico y notificación al entrar en el geofence—, diseñado explícitamente para que el jugador **no** mire la pantalla en marcha: el móvil avisa desde el bolsillo. La notificación se reserva a las oportunidades para que no se devalúe.

Y el ciclo de abandono, que el usuario pidió cerrar: las **noticias** sedimentan al momento en lo que se cuenta en el núcleo; las **oportunidades** se ofrecen una segunda vez —otra salida, otro sitio— y luego sedimentan. Dos ofertas porque una es frágil y infinitas son acoso. Sedimentar no se reprocha: nadie comenta que el jugador no fuese.

De todo esto sale un tipo de beat nuevo en la sección 2, el de **lugar diferido**: el contenido es determinista (sale del paso), la colocación depende de por dónde ande el jugador, y los tests afirman lo primero y no lo segundo.

## Los dos flecos que quedaban

**Cómo se entera el jugador de lo que se cuenta de él.** Aflora al llegar al núcleo y se anota en el diario, que **registra lo oído y no lo cierto**: guarda la versión deformada, nunca enseña el nivel de deformación —dato vivo, interno— y no sobrescribe una entrada con otra más veraz. Se descartó el panel consultable por núcleo, que habría convertido la consecuencia social en estadísticas y encima invitaría a mirar el móvil en marcha. A cambio aparece la mejor propiedad emergente de todo el sistema: como el árbol define un único camino, cada núcleo oye **una sola versión**, pero el jugador visita varios — y **descubre por su cuenta que las noticias se deforman comparando su propio diario**, sin tutorial que se lo explique y sin una línea de código dedicada a enseñárselo.

**Cómo se redacta el resumen del zurrón.** Marco propio con fallback, entradas prestadas de las plantillas que las generaron: el resumen es un contenedor, no una unidad narrativa nueva que duplique la lógica de fallback. Al pensarlo apareció un problema que el documento no contemplaba: **los pasos de fondo ocurren con la app cerrada**, así que sus textos no se han generado nunca y alguien tiene que escribirlos. Se resuelve con una única llamada agrupada **al abrir la salida** — segundo y último punto de invocación del LLM, y el espíritu de la decisión 1 sigue intacto: se llama antes de andar, jamás mientras se anda. Si falla, todo cae a fallbacks y el resumen se lee igual.

## Pendientes tocados

- **3** deja de estar abierto salvo el catálogo: la regla de aparición y el ciclo de abandono ya están decididos.
- **4** pasa de lista de deberes a casi especificación, e incorpora el **registro de tópicos** usados como restricción negativa en el prompt —la versión barata de su crítico anti-cliché, sin llamadas extra—, con ventana por categoría y precargado con los tics genéricos del modelo. Limitación asumida: los textos de fallback se repiten por definición.
- **8, nuevo**: motor de pasos y propagación. Con una advertencia arquitectónica: **no es una fase de `build.js`**. `build.js` crea el mundo, esto evoluciona el estado de una partida encima; meterlo en la tubería rompería "misma tubería, mismos mundos". Puede implementarse **antes que la capa de NPCs**, a granularidad de núcleo.

**Verificado**: nada que ejecutar, es diseño. Lo que sí se comprobó contra el código antes de escribir es que la mecánica se apoya en lo que existe — `buildRoutes` como árbol de expansión mínima con `pts`, `nodos` y la marca `fallback`, y `js/names/` como fuente única de nombres propios.

---

# Iteración 5-ago-2026 (II) — el bucle jugable: qué hace que esto apetezca

Segunda iteración de **diseño, sin código**, y la primera que reordena el trabajo pendiente en lugar de añadirle cosas. Nace de una corrección: `docs/checklist.md` estaba ordenado por esfuerzo y mezclaba lo decidido con lo que ni siquiera estaba planteado. Se reordena entero con un criterio nuevo —**primero lo que hay que decidir, después lo que solo hay que escribir**— y aparecen seis pendientes de diseño que no estaban en ninguna parte: el bucle jugable, el personaje, la progresión y economía, el alcance del mundo, seguridad/privacidad/menores y la partida guardada. La capa de NPCs, que estaba en "la inversión grande", sube con ellos.

De esa lista se cierra el primero, en `game-design/bucle-jugable.md`. La pregunta que responde no es "cómo funciona una salida" —eso son piezas y varias ya estaban en `quests.md`— sino **por qué querría alguien salir a andar hoy**, con la restricción de que la respuesta no puede ser "porque tengo una quest": las quests se acaban y el barrio no cambia.

## Los tres pilares comparten moneda, y por eso no compiten

El usuario eligió que el corazón fueran las tres cosas a la vez y equilibradas —cartografiar, lo que se cuenta, y la caminata como decisión—, que es la respuesta que normalmente significa que ninguna es el corazón. Se sostiene por dos hallazgos.

El primero es que **ya comparten unidad**: el tramo (~2 km, ~30 min) dimensiona un beat, dura un paso del mundo y es lo que tarda un rumor en dar un salto. El equilibrio deja de ser filosofía y pasa a ser aritmética. El segundo es que **el bucle se cierra solo**: andar cuesta piernas → lo andado fija territorio → el territorio fijado es por donde viaja lo que se cuenta → lo que se cuenta da la razón para volver a andar. Y no por casualidad: el mapa que se gana *es* el árbol de `buildRoutes` por el que se propaga lo social.

Lo único que los tres se disputan de verdad es la atención del jugador en marcha, que por diseño debe ser casi cero. Se resuelve con **cuatro momentos** —antes de salir, en marcha, al parar en un lugar, el telón— y una regla comprobable: si un pilar se cuela en el momento de otro, está mal.

## Lo que se decidió

**El mapa registra lo que sabes, no dónde estuviste.** Cuatro niveles de conocimiento (no lo sabes · lo ves sin nombre · lo conoces · lo conoces bien), estado inicial por escala —lo que se ve de lejos nace visible— y se sube **con las piernas o con la boca de otro**: un rumor puede rotularte un sitio donde no has estado. Ahí la cartografía deja de ser un pilar aparte. Dos restricciones duras lo acotan: el casting **no** mira lo descubierto (si no, los primeros días no hay juego, que es cuando menos castea el mundo) y un sitio al que te mandan tiene nombre aunque no hayas ido, porque la decisión 2 guía por nombres.

**El visor se queda en la calle.** Se propuso lo contrario —texto al llegar, visor en casa, con el argumento de que enseñar la foto de algo que tienes a tres metros es competir con la realidad y perder— y el usuario eligió el visor completo en el sitio. Se acepta con sus consecuencias escritas: las imágenes tienen que existir antes de salir (misma regla que ya rige para el LLM: al crear la quest, jamás durante la caminata), lo que te pilla de paso cae a ficha de texto, y el telón se queda sin su premio y hereda el mapa entintándose y el diario.

**No hay presupuesto: la quest declara su tamaño** con una palabra del mundo y su equivalencia en tiempo, y se elige por antojo. El efecto secundario es una mejora: la decisión táctica se muda de un menú a la calle — *¿me da hoy el cuerpo para el desvío?* es mejor tensión andando que rellenando un formulario.

**Volverse a casa a mitad se cierra en corto, con final digno**, no se pausa: pausar habría reabierto la decisión 4 de `quests.md`. Y no genera rumor, porque comentar que lo dejaste a medias sería reprochar por la puerta de atrás lo que la decisión 3 dice que no se reprocha.

**El relevo va por dos vías y se llevan las dos**, porque premian comportamientos distintos: profundizar es continuo y automático (el premio de la rutina), crecer por los bordes es un acontecimiento (el premio de alejarse). Con un invariante duro — **lo ya generado no se resiembra jamás** — que hoy el código no permite: `countsForRadius` cambia el mundo entero al cambiar el radio, así que crecer significa coser comarcas vecinas, no ampliar la propia. Efecto colateral: irse de vacaciones pasa a ser "una comarca que no toca con la tuya", media respuesta gratis a otro pendiente.

**El tono es cómico-cálido**, y esta es la decisión que más deuda genera: los seis textos de `templates.js` están en registro de cuento popular y se quedan fuera de tono. Se cierra con dos reglas que la hacen sostenible: el humor vive en **cómo se cuenta** y nunca en **lo que pasa**, y el chiste jamás es a costa del sitio real ni de quien lo regenta, siempre del desajuste. Regalo del tono: la escalera fiel · abultado · trastocado · leyenda es exactamente cómo crece un chiste, así que la deformación de rumores deja de ser una mecánica y pasa a ser el humor del juego.

**El barrio de tres calles** —que es el caso normal, no el raro— se ataca por tres sitios: lo social y profundizar, más densidad en radios pequeños (que reabre los cupos de `parametros-mundo.md`), y un estirón del mundo que **se ofrece y nunca se impone**, para no romper el pilar de que las piernas de hoy las pone el jugador.

## Lo que queda abierto

**La accesibilidad**, que venía dentro de este mismo pendiente y no se peloteó: el juego da por supuestas unas piernas y nadie ha decidido hasta dónde se estira eso. Es lo único de la agenda original que se queda sin respuesta. Con ella quedan tres flecos más, todos anotados al final del documento: cuándo se echa el telón exactamente, el hueco de las primeras semanas —cartografía que aún no da de sí y capa social que todavía no ha arrancado, el momento más frágil del bucle— y si el preset de generación y el tamaño de la salida son la misma perilla o dos.

**Verificado**: nada que ejecutar, es diseño. Lo que sí se comprobó contra el código antes de escribir: que `countsForRadius` regenera y no amplía (lo que convierte el crecimiento por bordes en trabajo real y no en un parámetro), que `test/casting-report.mjs` ya mide el fallo del mundo pequeño que describe el punto 7, y que los textos de `templates.js` están en un registro distinto del tono recién elegido.

---

# Iteración 5-ago-2026 (III) — accesibilidad: el tramo deja de ser una constante

Tercera iteración de diseño del día, y la más corta, porque el grueso ya estaba pensado: `game-design/accesibilidad.md`. Se eligió empezar por aquí entre los ocho pendientes de diseño con un argumento de coste: **la accesibilidad no es un tema, es la unidad de medida**. Si el tramo pasa a ser personal, todo lo que se decida después nace expresado en tramos; si se decide al final, hay que traducir todo lo escrito entretanto — y ya hay un documento así, `parametros-mundo.md`, calibrado entero en metros absolutos.

## El encuadre: no es un modo, es la unidad

La decisión de fondo es que **no hay "modo accesible"**. Hay un juego cuya unidad base es personal: un tramo deja de ser 2 km y pasa a ser *lo que tú andas en media hora*. Con eso se redimensiona solo el juego entero, y quien va en silla, quien anda despacio o un crío de cinco años juegan al mismo juego con la misma forma, a otra escala. Nadie elige dificultad ni carga con una etiqueta: eliges cuánto andas y por dónde puedes andar, que es lo que elige todo el mundo.

Y apareció un ahorro que no se esperaba: **el caso de la accesibilidad es el mismo caso del barrio de tres calles**. Un tramo pequeño produce una comarca pequeña, y eso ya lo resolvió `bucle-jugable.md` §7 por tres vías. La accesibilidad no necesita mecánica propia — necesita que el caso pequeño esté bien resuelto.

## Las cuatro decisiones

**El tramo se declara una vez y el juego lo corrige midiendo**, con la pregunta hecha en lenguaje de sitios y no de distancias ("en media hora andando, ¿tú dónde llegas?"), coherente con que el juego no enseñe números de distancia. Con tres reglas: el ajuste **no se comenta jamás** —si el juego dice "últimamente andas menos" se convierte en app de salud y en un reproche—, mide el ritmo andando y no el reloj de la salida, y **no puede redimensionar el mundo ya generado**, porque chocaría con el invariante de no resembrar. De ese choque sale una promoción: separar el preset del radio del mundo del preset de la salida deja de ser deuda menor y pasa a ser requisito.

Consecuencia bonita: **el reloj del mundo deja de estar en metros y pasa a estar en esfuerzo**. Dos jugadores muy distintos viven mundos que avanzan al mismo ritmo narrativo aunque uno haga 6 km y el otro 900.

**El filtro de accesibilidad evita y declara.** No es una opción de menú sino un filtro sobre el grafo viario, y como el trazado, el lazo y el casting salen todos de ahí, se propaga solo. El mundo entero sigue existiendo y dibujándose; simplemente no te mandan por ahí, y el mapa lo dice en lenguaje del mundo —la Escalinata, la senda de tierra— porque **tú sabes de tu barrio más que OSM**: esa escalera puede tener una rampa que nadie ha mapeado. Dos hallazgos al comprobarlo contra el código: lo que nos inventamos nosotros (`coserHuecos` hasta 180 m, las rectas `fallback`) no puede prometerse como transitable, y los caminos difíciles necesitan nombre, que hoy los ramales no tienen. Y una limitación que se escribe en vez de disimularse: **las cuestas no se pueden prometer**, porque `incline` está poco mapeado y no hay modelo de elevación — y es justo lo que más importa en silla.

**Cada aviso viaja por dos capas**, y aquí la decisión importante no es la regla sino su letra pequeña: **el par tiene que mezclar una capa de bolsillo con una de pantalla**. Háptico y sonido fallan a la vez para la misma persona, así que duplicar así es cumplir la regla en el papel sin servir de nada. Encaja sin tocar `quests.md`: las noticias van por háptico más marca, las oportunidades por notificación más háptico, y la reserva de la notificación queda intacta. Con una tercera regla que protege el "no mirar la pantalla": el aviso se lee de un vistazo o no se lee, nunca es un "toca para saber más".

**El suelo es moverse, no andar**, y está medido en vez de argumentado: por debajo de unos 250 m de radio, `countsForRadius` da el mínimo absoluto y `parajeCountForRadius` un solo paraje — ahí un lazo aún se compone, apurado, y por debajo ya no hay juego que montar. Ese límite se dice claro y antes de instalar: hay gente para la que esto no puede ser su juego, y decirlo es más respetuoso que un modo de mentira.

## Lo que queda abierto

**Qué cuenta como "moverse"**: silla eléctrica, bici, transporte. La decisión dice "desplazamiento propio" y no zanja la propulsión; la respuesta probablemente pase por el esfuerzo y no por el medio, pero arrastra el reloj del mundo — 20 km en bici serían diez pasos en una tarde. Con ella quedan las cuestas (reabrir si algún día hay modelo de elevación) y cómo se pregunta el tramo sin que parezca un formulario médico.

**Verificado**: nada que ejecutar, es diseño. Comprobado contra el código antes de escribir: el suelo real de `countsForRadius` (r < 250 → un núcleo de cada tipo) y de `parajeCountForRadius` (250 → 1), que `M_PER_MIN = 72` en `casting.js` es hoy la única constante de ritmo y por tanto el punto por donde entra el tramo personal, y que `coserHuecos` (180 m) y las rutas `fallback` son aristas inventadas por el generador y no calles de OSM.

---

# Iteración 5-ago-2026 (IV) — el arranque: el mundo llevaba rato andando sin ti

Cuarta y última iteración de diseño del día: `game-design/arranque.md`, que cierra el pendiente más frágil que había dejado abierto `bucle-jugable.md`.

Lo primero fue acotar el problema, porque "las primeras semanas" no es un problema, es una queja. Los días 1 y 2 los cubre la novedad —generas tu mundo, descubres que tu bar es una taberna, haces tu primera aventura—. **El agujero son los días 3 al 10**: la novedad ya pasó, la cartografía funciona pero es un placer pasivo que se acumula sin drama, y lo social sigue en cero porque todavía no has hecho nada que nadie pueda contar. Lo más distintivo del juego necesita semanas para aparecer, y ahí es donde se pierde la gente.

## El mundo llega con pasado

La decisión que resuelve casi todo lo demás: **el mundo no nace vacío en el paso 0**, nace con unos cuantos pasos ya dados. Hay rumores circulando y versiones ya deformadas asentadas en cada núcleo antes de que tú aparezcas. El día 1 entras en una aldea y ya están hablando de algo.

No hace falta maquinaria nueva —es la propagación de `quests.md` §6 ejecutada antes de empezar— y no contradice que los kilómetros sean el reloj: el prólogo no es tiempo tuyo, es lo que pasó antes de que llegaras, y tu contador sigue empezando en cero. Se siembra con la semilla del mundo y su propio sufijo, así que **el pasado es una propiedad del lugar**, como los nombres: dos personas con la misma semilla oyen el mismo.

Cuánto pasado queda como criterio y no como número —lo que tarde en haber algo que contar en cada núcleo, ni un paso más— porque pasarse tiene un coste concreto: si todo lo que oyes ya es leyenda de nivel 3, el mundo suena a museo y no a vecindario.

Y el regalo: **el mismo mecanismo sirve para tres arranques**. El de la partida, el de una comarca nueva cuando el mundo crece por los bordes, y el del mundo efímero de vacaciones. Llegar a un sitio donde no has estado nunca y que ya tenga vida es el mismo problema tres veces.

## El mejor truco del juego se adelanta a la primera salida

El prólogo cambia el terreno de la deformación de rumores. Ya no hace falta hacer algo notable y esperar a que viaje: el día 1 hay rumores viejos circulando en versiones distintas según el pueblo, así que **triangular es posible en la primera salida** en vez de en la tercera semana.

Y no se deja al azar, pero tampoco se explica: **puesta en escena**. El arranque se asegura de que un mismo suceso haya llegado a dos núcleos alcanzables con niveles distintos y de que la primera aventura pase por los dos. El juego no dice nada; coloca el descubrimiento donde vas a tropezarte con él. De ahí salen dos requisitos —el prólogo se compone y se resiembra si no cumple la condición, y la primera aventura se elige también por dónde pasa— y una raya que quedó escrita: **esto es del arranque y solo del arranque**, porque una puesta en escena permanente convierte el mundo en un guion.

## Y termina con un hito, no con una curva

Se propuso que el arranque se apagara solo, sin momento; se eligió que **termine y se marque**. El criterio no es una fecha ni un contador de salidas: dura hasta que el mundo tiene material tuyo, y eso ocurre la primera vez que llegas a un núcleo y lo que allí se cuenta eres tú, contado por otros y no exactamente como fue.

La decisión trae media decisión más, de redacción: **el hito dice que el mundo ha cambiado, no que el jugador haya aprobado**. "Ahora hay quien cuenta cosas de ti", nunca "ya dominas las mecánicas". Es la diferencia entre cerrar una etapa y admitir que llevabas ruedines.

## Lo que queda abierto

**Quien tarda un mes en producir algo notable**: con ese criterio, quien juega poco o no completa aventuras no cierra nunca el arranque. Queda propuesta pendiente de ratificar —que también termine cuando el jugador ya ha visto el truco, dos versiones del mismo suceso en su diario— para que cierre por una vía o por la otra. Y **cuántos pasos dura el prólogo**, que tiene criterio pero no número, y el número solo sale midiendo sobre mundos reales, como se hizo en su día con el casting.

**Verificado**: nada que ejecutar, es diseño. Lo que se comprobó antes de escribir es que la pieza existe: la propagación por el árbol con latencia por metros y deformación por saltos ya está especificada en `quests.md` §6, así que el prólogo es esa misma maquinaria corrida hacia atrás y no un sistema nuevo.

---

# Iteración 5-ago-2026 (V) — el personaje: identidad sí, cuerpo no

Quinta iteración de diseño: `game-design/personaje.md`. Es el único pendiente del proyecto que no puede apoyarse en OpenStreetMap — todo lo ficticio se ancla a algo real y el personaje es lo único sin anclaje —, así que había que decidirlo entero.

## Se descartó que el personaje fueras tú

La propuesta más coherente con el principio de anclaje era que no hubiera criatura intermedia: la persona real como anclaje del personaje, igual que el bar lo es de la taberna, y lo que se cuenta ahí fuera contado de ti y con tu nombre. Se descartó porque pedir un nombre real en un juego para menores abre una conversación de privacidad que no compensa. También se descartó llegar sin nombre y que el mundo te bautizara — pero de esa se rescató lo mejor, como se ve abajo.

**Un personaje que interpretas**, entonces, con una regla que evita el único fallo grave de esa opción: **identidad sí, cuerpo no**. Nada de resistencia, velocidad ni fatiga; el cansancio, el ritmo y las piernas son del jugador y ya están medidos por el tramo personal de `accesibilidad.md`. En el único juego cuyo mando es un cuerpo real, sustituirlo por estadísticas era la disonancia que hundía la decisión.

Y el rescate: **el mundo no te llama por tu nombre hasta que te conoce**. Tienes nombre desde el minuto uno, pero para la comarca eres la forastera hasta el hito de fin de arranque — que pasa a ser exactamente el momento en que empiezan a llamarte Xoana. Dos documentos que se apoyan sin haberlo planeado.

## Lo que se elige y lo que se gana

Pantalla corta —nombre y oficio— y ahí acaba. Lo que el personaje **es** para la comarca se gana andando, y de ahí sale la mejor consecuencia del día: **el mote nace del rumor, no del hecho**. Como la reputación es lo que llegó, el apodo se pega a partir de lo que se cuenta, así que pueden llamarte "la que cruzó el monte de noche" por algo que no ocurrió exactamente así. Es dato vivo, lo fija el código, y cada plantilla y cada suceso declaran su mote candidato igual que ya declaran su rumor. **Y el mote es por comarca**: en el pueblo de al lado te conocen por otra cosa, y en la comarca vecina por nada.

Dos detalles que parecían menores y no lo son: el nombre lo **propone** el paquete de idioma del mundo (si el mundo es gallego, las sugerencias son gallegas) con texto libre encima y filtro de aptitud, porque ese texto acaba dentro de lo que genere el LLM; y **el género gramatical del personaje es dato vivo**, no adorno, porque el código bifurca por él cada vez que el mundo se dirige al jugador.

## El oficio filtra, y el modelo salió de un challenge

Se decidió que el oficio **filtre** las aventuras que se ofrecen, no solo que las ordene, sabiendo el riesgo medido: el casting ya falla en mundos pequeños. La primera mitigación propuesta —generar mucho en el precalentamiento— se corrigió al escribirla, porque el prólogo genera sucesos del mundo y no aventuras: las aventuras salen de castear plantillas contra el mundo que hay.

La segunda pasó por un challenge pedido expresamente, y el challenge cambió la decisión. La propuesta era llegar a 20-30 plantillas genéricas que, adaptadas por oficio y contexto, dieran 4-5 aventuras cada una — del orden de 150 por oficio. Tres objeciones la corrigieron:

- **Esas 150 son pieles, no aventuras.** Por el corolario de la decisión 1 de `quests.md`, con LLM y sin LLM la estructura es la misma —mismo casting, mismos beats, mismo lazo— y solo cambia la piel. En un barrio de seis localizaciones el jugador no reconoce la prosa: reconoce que otra vez le mandan a la iglesia y luego al bar.
- **Y esconde una contradicción**: si una plantilla se adapta a cualquier oficio, el oficio no filtra nada, solo cambia la voz — que es exactamente la opción descartada media hora antes. No se pueden tener las dos.
- **El cuello de botella no es el catálogo, es el barrio.** Los fallos del informe de casting dicen todos lo mismo (*sin candidatos para X: un paraje con escena Y*) y se concentran en mundos de paseo con 2-3 parajes: ronda del vigía 77%, peregrinaje 82%. Plantillas nuevas con el mismo vocabulario de roles fallarán en los mismos barrios por la misma razón.

De ahí salió el modelo que se adoptó: **afinidad declarada, de 1 a N oficios por plantilla**. Unas pocas exclusivas —que son las que hacen que elegir signifique algo, porque hay aventuras que no verás nunca con este personaje— y la mayoría compartidas por dos o tres. El multiplicador del catálogo baja de ×4 a ×1,5 y el filtro conserva los dientes.

Con eso, la aritmética honesta: 30 plantillas, afinidad ×1,5 y la tasa del caso pequeño dejan del orden de **diez esqueletos jugables por oficio en un barrio de tres calles**. Suficiente para que no haya día muerto, que era el riesgo — y muy lejos de 150. La intuición de partida era correcta en la dirección y estaba inflada unas quince veces en la magnitud; con el número real la decisión de filtrar se sostiene, con el inflado nos habríamos confiado.

Dos requisitos más que quedaron escritos: ampliar el catálogo hay que hacerlo **variando los roles que pide**, no solo la historia que cuenta, o no sirve para los barrios pequeños; y **una plantilla ya no es un texto** —roles que castean, lazo que cierra, tramos, fallbacks, rumor, mote y desenlace de repuesto, en cómico-cálido y para leerse en voz alta, validada contra el informe—, así que treinta son trabajo real. Y la parte de la mitigación original que sí funciona: el precalentamiento deja cargada la **cola de entregas**, de modo que un día sin aventura de tu oficio no sea un día vacío.

## Y la pregunta incómoda, resuelta por lo barato

**Modo compañía: una partida, dos cuerpos.** Manda un móvil, el otro sobra, la aventura es de los dos. Cuesta poco de código y bastante de diseño, pero es diseño que este juego ya quería: **textos escritos para leerse en voz alta** y nada que exija tocar la pantalla. Probablemente sea la mejor forma de jugar a esto. El multijugador de verdad —dos partidas sincronizadas, lo que hace una llegando a oídos de la otra por las mismas calzadas— se descartó por ser otro proyecto: servidores, cuentas y la conversación entera de privacidad y menores.

## Lo que queda abierto

El día en que no castea ninguna aventura de tu oficio (con propuesta: ofrecer una que no es lo tuyo, dicho en tono, que en cómico-cálido es un chiste y no una disculpa); si el acompañante real tiene sitio en la ficción; si se admite una forma neutra de género gramatical; y la lista exacta de oficios, que tiene criterio pero no nombres.

Y una nota de frontera para el pendiente siguiente: **el mote y la fama por comarca son ya media respuesta a "progresión y economía"**, y el oficio filtrando aventuras es media progresión. Conviene abrirlo sabiendo que parte de su terreno ya está ocupado.

**Verificado**: nada que ejecutar, es diseño. Comprobado contra el código antes de escribir: que el catálogo son hoy seis plantillas en `app/js/quests/templates.js` (de ahí el número concreto del riesgo de filtrar por oficio), y que `castAll` ofrece el catálogo entero sin ningún criterio de selección, que es donde entraría el filtro.

---

# Iteración 5-ago-2026 (VI) — el cuello de botella no era el barrio, era el cupo

Iteración corta y correctiva, nacida de un challenge del usuario que resultó tener razón. Toca `game-design/parajes.md` y `parametros-mundo.md`, los dos documentos cerrados más antiguos del proyecto.

## El error

Al justificar por qué ampliar el catálogo de plantillas no bastaba, quedó escrito que "el cuello de botella no es el catálogo, es el barrio": que un barrio de tres calles no tiene reparto suficiente y que plantillas nuevas fallarían igual. El usuario lo rebatió con un argumento de sentido común —en 500 m hay fácilmente trece negocios— y al ir a comprobarlo apareció el dato que lo zanja: **los mundos sintéticos del informe de casting se generan con 90 anclajes y fallan exactamente igual que los pequeños reales**.

Si con 90 anclajes en 700 m sigue sin haber un paraje con escena de vigilancia, el problema no puede ser la falta de lugares. Es que `parajeCountForRadius` **solo crea dos** a los 500 m. No es escasez del mundo: es un cupo nuestro. La frase correcta era "el generador tira casi todo el reparto que el barrio le da".

## Dos decisiones

**La cobertura de escenas manda sobre la afinidad del anclaje.** `parajes.md` ya decía que el tipo está desacoplado del anclaje real —una ruina puede ser un chiringuito— pero no decía qué pasa cuando el sesgo temático y la necesidad de la historia se estorban. Ahora sí: primero se eligen los tipos que hacen falta para cubrir el vocabulario de escenas, después se les asigna anclaje con el sesgo suave de siempre, y **se sacrifica el sesgo sin drama si no hay uno afín**. Que una atalaya sea un bar es infinitamente mejor que quedarse sin ningún sitio desde el que vigilar: de un anclaje raro el jugador tira con imaginación, de una escena que no existe no se puede tirar.

**Y el suelo del cupo se deriva en vez de intuirse.** La discusión "cuánta densidad en radios pequeños" se estaba planteando a ojo, con la objeción —mía— de que trece parajes en 500 m convierten el hito en mobiliario urbano. La objeción se cae porque el número sale solo:

```
parajes mínimos = escenas distintas que piden las plantillas ÷ escenas por paraje
```

Siete escenas hoy, dos o más por paraje: **cuatro**. No trece. Uno cada ~125 m de recorrido, que sigue siendo un hito. El cupo por ritmo de `parametros-mundo.md` se queda como techo y esto pone el suelo, y es una regla viva: si el catálogo crece a 20-30 plantillas y el vocabulario se ensancha, el suelo sube solo sin que nadie lo renegocie.

## Google Places entra, como relleno

El usuario zanjó también la objeción del coste. OSM sigue siendo la tubería —terreno, costa, ríos, callejero— y Places entra **solo a rellenar el pool de anclajes** donde OSM va flojo, que en España es el negocio pequeño: la asesoría, la clínica dental, la barbería. No cambia ninguna fase.

Quedan escritas dos cautelas que hay que resolver antes de conectarlo: los términos de Places permiten almacenar indefinidamente el `place_id` pero no el resto del contenido, y hay una cláusula sobre mostrar sus datos en un mapa que no es de Google, que es exactamente lo que hace nuestro canvas. La tercera preocupación —el determinismo, si la fuente cambia bajo los pies— resultó estar ya cubierta: `bucle-jugable.md` §5 congela el mundo al generarse, así que la solución estaba puesta antes de que existiera el problema.

Y sigue en pie la regla del reconocimiento, con un matiz que este debate afinó: **más anclajes no es más diversidad de escenas**. Trece locales comerciales son la misma categoría y alimentan los mismos tipos de paraje. Lo que ensancha el vocabulario son torres, miradores, capillas, molinos y cruceiros — no barberías.

**Verificado**: nada que ejecutar, es diseño. El dato que sostiene la corrección sí es medido: `test/casting-report.mjs` genera mundos sintéticos con 90 anclajes y aun así reporta "sin candidatos para un paraje con escena X" (ronda del vigía 77%, peregrinaje 82% sobre 22 mundos), y `parajeCountForRadius` da 1/2/4/7/8 para 250/500/1000/2000/10000 m — cupo, no escasez.

---

# Iteración 5-ago-2026 (VII) — progresión: ni niveles ni tienda

Sexta iteración de diseño del día: `game-design/progresion.md`, que decide qué hacen de verdad el oro, la XP y la reputación que `quests.md` §6 llevaba repartiendo sin definir.

El pendiente se ordenó con una constatación: **el juego ya tenía dos progresiones y ninguna es numérica** — el mapa que se llena y la comarca que te conoce. Así que no había que añadir una progresión, había que decidir si hacía falta una tercera. Y con una restricción heredada de `accesibilidad.md` que lo gobierna todo: **subir de nivel en un juego cuyo techo son tus piernas premia a quien más anda**. Cualquier progresión tenía que medirse en lo que haces, nunca en cuánto te has movido.

## Se retira la XP

No hay niveles. Hay **rango social por núcleo**, una escalera corta y con nombre —forastero · conocido · alguien de aquí— que se gana por lo que se cuenta de ti. La XP se retira explícitamente de `quests.md` §6.

Dos propiedades salen solas de que el rango lo mueva la propagación de rumores y no la distancia: puedes ser *alguien* en un pueblo donde no has estado nunca, porque la noticia llegó antes que tú; y un pueblo al que vas cada día pero al que no llega nada tuyo te sigue tratando de forastera. De ahí la simetría que ordena el juego entero: **tú conoces al pueblo por ir; el pueblo te conoce a ti por lo que le llega.** Andar profundiza tu mapa, actuar sube tu rango.

Y una corrección de paso: `personaje.md` decía que el mote era "por comarca" y a la vez que en el pueblo de al lado te conocen por otra cosa, que se contradicen. **Todo lo social vive a nivel de núcleo**, que es donde llega el rumor y donde se sedimenta. Corregido allí.

## El oro compra saber, y usa la propagación en vez de saltársela

El oro compra información y voluntades: que te cuenten lo que saben sin ir hasta allí, que alguien lleve un recado. Con una regla dura —**nunca compra distancia**, no se puede pagar por no andar— y con el hallazgo que hace que esto no rompa nada: **lo que compras es lo que ese hombre sabe, en la versión que a él le llegó**. Pagar no da la verdad, da otra versión con su nivel de deformación encima, y puede ser peor que ir andando. El oro compra un nodo del árbol, no la realidad.

Segunda regla dura, esta de principios: **el juego nunca manda a gastar en el negocio real del anclaje, ni el oro ficticio toca dinero de verdad**. Un juego que reparte monedas sabiendo que la taberna es el bar de abajo está a un paso de ser un vehículo publicitario, y con menores delante eso no es una decisión de economía.

## El rango no cierra nada

Se descartó que el rango abriera aventuras vedadas al forastero. Es el mismo fork que el oficio —¿filtra o colorea?— con una diferencia decisiva: **con el oficio empiezas eligiendo; con el rango empiezas siendo forastera en todas partes a la vez**, así que un rango que cerrase contenido dejaría el juego en su punto más pobre exactamente el día 1 — el agujero al que la iteración anterior dedicó un documento entero.

Lo que sí cambia el rango es el trato, cuánto te cuentan y **el precio de la información, incluido el precio cero**. Ahí enganchan las dos monedas sin inventar una tienda, y sale la síntesis del documento: **el rango y el oro no son dos sistemas, son el mismo visto de dos lados** — el rango es crédito social y el oro lo suple cuando no lo tienes.

## Los objetos como llave, que era idea del usuario

La propuesta llegó como pregunta —objetos que no se combinan pero que abren conversaciones y caminos alternativos— y resultó ser mejor de lo que parecía por una razón lateral: **rescata los micro-encuentros**. Hoy un hallazgo de cuneta es una anécdota de quince segundos que se puede ignorar gratis; si tres semanas después esa hebilla de latón abre una conversación, el paseo tonto de un martes se vuelve retroactivamente algo.

Encaja además donde ya había sitio: el disparador `{tipo: llegada | franja | con_objeto}` está escrito en `quests.md` §2 y sin usar; tener el objeto es dato vivo y el diálogo que abre es dato inerte con fallback, así que la frontera con el LLM no se mueve; y es **el primer mecanismo real de arcos largos**, que `quests.md` prometía sin tener con qué.

Se acotó con la regla que evita la explosión de ramas y el cierre del juego a quien no tiene nada: **nunca es requisito, solo otra puerta al mismo beat**. Mismos beats, mismo lazo, otra forma de atravesarlo — con lo que el casting sigue siendo testeable y el corolario de "con LLM y sin LLM, misma estructura" queda intacto. La ramificación estructural sigue aplazada, como decía `quests.md` §2.

Y lo que no es llave queda en **la repisa**: cosas que no hacen nada salvo contar de dónde vinieron. Le devuelve al telón el premio que perdió cuando el visor del anclaje se mudó a la calle. Simetría con la otra mitad: **el mapa guarda lo que sabes; la repisa guarda lo que puedes demostrar.**

## Lo que queda abierto

Si el rango puede bajar —con propuesta escrita: no, porque mide cuánto te conocen y no cuánto te aprecian, y el signo de lo que se cuenta sería un eje aparte—; de dónde salen los objetos-llave; qué pasa con el oro acumulado, que si solo compra información sobra pronto y un contador sin tope acaba siendo un marcador de progreso por la puerta de atrás; y los nombres exactos de los tres escalones.

**Verificado**: nada que ejecutar, es diseño. Comprobado contra los documentos antes de escribir: que `quests.md` §2 ya define el disparador `con_objeto` (así que los objetos-llave no inventan mecanismo), que §6 prometía XP sin definirla (de ahí que retirarla sea una edición y no una contradicción), y que §6 permite que lo que se cuenta de ti tenga signo malo — lo que obliga a separar notoriedad de aprecio y no a inventar un rango que baje.

---

# Iteración 5-ago-2026 (VIII) — NPCs: el testigo es la única fuente de verdad

Séptima iteración de diseño del día y la última del bloque grande: `game-design/npcs.md` cierra el pendiente 2 de `quests.md`, que llevaba desde el principio marcado como el cuello de botella del diseño de quests. Llegó barato, y por dos razones: las decisiones de hoy ya habían decidido media capa sin nombrarla —el rango define cómo te tratan, el mote cómo te llaman, los informantes ya eran un NPC con oficio y precio— y porque la primera pregunta se resolvió con una enmienda en lugar de con un sistema.

## La enmienda que abarata el pendiente entero

`parametros-mundo.md` daba por hecho que cada NPC con nombre consume un anclaje real propio, su casa, con el mismo mecanismo `taken` que los servicios. Eso lo mete a competir por el recurso escaso que la iteración anterior acababa de proteger para los parajes. Pero **el tabernero no necesita anclaje: ya está anclado en la taberna**.

Regla general: **el NPC hereda el anclaje del sitio al que pertenece**, servicio o núcleo. El granjero queda anclado en la granja, una aldea sin servicios puede tener cara igualmente, y la capa entera sale gratis en anclajes. Las casas de NPC quedan aplazadas y reducidas a quien no trabaja en ningún sitio. Enmendado en `parametros-mundo.md`.

## El reparto crece con lo jugado

El mundo no nace poblado: cada sitio tiene una cara titular y las demás aparecen cuando una aventura las necesita. Sale de una aportación del usuario —que un mismo servicio puede tener varias caras: posadera, cocinera, mozo de cuadra— que multiplicaba el reparto por cuatro y se llevaba por delante lo único que hace valiosa esta capa: **que te reconozcan solo significa algo si el reparto se puede recordar**. Poblando bajo demanda se conservan las dos cosas, y aparece la frase que resume la decisión: **cada cara que conoces la conoces por algo**.

Con una trampa técnica que quedó escrita antes de que nadie la pise: **el puesto es la clave, no el orden**. La generación es determinista por `semilla + sitio + puesto`, jamás por un contador de aparición — si la clave fuera "el tercero que conocí aquí", el mismo mundo daría personas distintas según en qué orden hubieras jugado. Y como los NPCs son estado de partida y no del mundo, sale una propiedad bonita: dos jugadores con la misma semilla tienen **el mismo mundo y repartos distintos**.

## Lo mejor de la capa: el testigo

La memoria tenía un choque de frente, porque ya hay una memoria funcionando —lo que se cuenta en cada núcleo, que llega por rumor y llega deformado— y una memoria individual en paralelo puede contradecirla. La salida convierte el choque en la mejor pieza del sistema: **el que estuvo allí tiene la versión de nivel 0**.

En un mundo donde todo lo que se cuenta está deformado, el testigo es la única fuente de verdad, y volver a preguntarle es cómo se consigue. Su memoria es corta y por hechos: solo las veces que fue un rol en una aventura tuya. Y con una regla que no admitía dos respuestas: **el testigo no corrige lo que se cuenta en el pueblo**. Si el testimonio arreglara el rumor, el sistema de deformación se curaría solo y se moriría. Queda algo mejor: **puedes saber la verdad y seguir siendo famoso por una mentira.**

Engancha además con la economía de la iteración anterior: un informante te **vende** lo que oyó, deformado; un testigo te **cuenta gratis** lo que vivió, fiel. Lo que se compra es lo que se oye; lo que vivió contigo no tiene precio porque ya lo compartisteis.

## Y un principio del proyecto que llevaba todo el día apareciendo

Las franjas horarias parecían incompatibles con "fallar por no llegar debe ser casi imposible", y se resolvieron igual que otras tres cosas hoy: **llegar a tiempo abre una puerta extra, llegar tarde no cancela nada**. Con el matiz que añadió el usuario, la franja acabó siendo **propiedad de la escena y no de la persona** — nadie ficha, nadie se mueve, y nos ahorramos simular la vida de los NPCs, que es exactamente lo que hace frágil esta capa en otros juegos.

Al escribirlo se vio que el patrón ya gobierna cuatro sistemas independientes, así que queda escrito como principio: el objeto-llave abre otra puerta y nunca es requisito, el estirón se ofrece y nunca se impone, el rango cambia el trato y nunca cierra el catálogo, la franja añade una salida y nunca cancela la escena.

> **Lo que el jugador no controla puede abrirle puertas, nunca cerrárselas.**

Es la formulación general de "ignorarlo es gratis" y de "se falla por decisiones, no por piernas", y cualquier sistema nuevo debería pasar esa prueba antes de entrar.

## El único mecanismo que va hacia abajo

Nadie se muda, envejece ni muere por el paso del tiempo —sería retirar algo por ausencia, que la decisión 4 de `quests.md` prohíbe— pero los actos sí cambian el trato, porque §6 dice que lo que hiciste viaja para bien y para mal. Una relación se puede quemar y **se puede reconstruir**: no se vuelve al punto de partida, pero sí a poder sentarse.

Es el único sitio del proyecto donde algo puede empeorar: el rango no baja, los objetos no se pierden, el mapa no se borra. La consecuencia de un acto feo vive en la relación con una persona concreta — y trae consigo el mejor arco largo que puede tener este juego, el de la reparación.

**Verificado**: nada que ejecutar, es diseño. Comprobado contra los documentos y el código antes de escribir: que `quests.md` §2 ya define el disparador `{tipo: franja}` sin usar, que §5 pedía casas ancladas con `taken` (de ahí la enmienda), y que `casting.js` tiene una regla de que dos roles no pueden caer en el mismo lugar — lo que obliga a decidir si varias caras de un mismo servicio, que comparten coordenadas exactas, cuentan como un sitio o como varios.

---

# Iteración 5-ago-2026 (IX) — alcance del mundo: la rejilla convierte una promesa en una forma

Octava iteración de diseño: `game-design/alcance-del-mundo.md`. Llegaba medio resuelto —`bucle-jugable.md` §5 ya prohibía resembrar y hablaba de coser comarcas, `arranque.md` ya daba pasado a una comarca nueva, `npcs.md` ya había separado el mundo de la partida— y quedaban tres preguntas.

## Se descarta el mundo compartido

La propuesta era que el mundo fuese del **lugar**: semilla = coordenadas, con lo que la Comarca de Vilanova sería la misma para todo el que vive en Vilanova y el juego ofrecería algo que ningún otro puede — que tu barrio tenga una versión fantástica compartida con tus vecinos, mientras todo lo vivo (mapa, diario, rango, reparto) sigue siendo de cada uno. Se eligió lo contrario: **la semilla lleva al jugador dentro**, cada uno su mundo.

Trae intimidad y una ganancia concreta para el pendiente de privacidad —nadie puede cruzar dos mapas ni deducir dónde vives por los nombres— y una consecuencia arquitectónica que hay que tener presente: **el mundo deja de ser una función del lugar y pasa a formar parte de la partida guardada**. Con `lat,lon#n` bastaba saber dónde estás para recalcularlo entero; ahora no. Esa cadena pasa a ser el dato más valioso que existe: si se pierde, se pierde el mundo. Requisito duro heredado por "la partida guardada": **tiene que sobrevivir a un cambio de móvil**.

Y lo compartido no desaparece, cambia de naturaleza: pasa de ser el defecto a ser un acto deliberado —intercambiarse la semilla—, así que conviene que sea corta, legible y copiable.

## La rejilla, que es la decisión que más resuelve

Las comarcas dejan de ser círculos alrededor del jugador y pasan a ser **celdas de una rejilla**. Con eso se disuelve el problema técnico que `bucle-jugable.md` §5 había dejado abierto a conciencia: **crecer deja de ser regenerar y pasa a ser generar otra celda**, y los cupos dejan de depender de un radio variable para calcularse una vez por celda. El invariante de "lo generado no se resiembra jamás" deja de ser una promesa que hay que cumplir y pasa a ser **una propiedad de la forma**.

Dos matices que salieron al escribirlo: la rejilla es **personal, como el mundo, y se dimensiona en tramos** —una celda mide *k tramos tuyos*, así que la comarca de quien anda 300 m por tramo es más pequeña y exactamente igual de jugable, que es la regla de `accesibilidad.md` aplicada a la geografía—; y se **ancla a una coordenada redondeada** cercana a donde arrancaste y no a ti, para que estés dentro de tu celda pero no en su centro y el mapa se pueda enseñar sin enseñar el portal.

Y una distinción que conviene no perder: una celda vecina se abre **por pisarla**, porque el mundo tiene que existir donde estás —lo que cubre a quien vive pegado a un borde—, o **como acontecimiento** al completar la tuya, que es la recompensa del bucle. Una cosa es que el mundo exista y otra que se te premie.

## Una partida, muchas comarcas

Viajar lejos abre una celda que no toca con la tuya, dentro de la misma partida, y tú viajas entera: personaje, oficio, repisa, diario y objetos. **Lo que no viaja es el rango, y no hizo falta inventar nada para que no viajara**: es por núcleo, así que donde nadie ha oído hablar de ti vuelves a ser forastera automáticamente — que es el arranque otra vez, con su prólogo y su pasado, y es de lo mejor que tiene el juego.

Al volver a casa te siguen conociendo, y el mundo de casa no ha avanzado en tu ausencia porque el reloj son tus kilómetros: volver de tres semanas fuera es volver de tres días. Con esto queda servida además la idea que estaba apuntada en el checklist como "varias partidas para el mundo efímero de vacaciones": no hacen falta partidas separadas, porque **una comarca que no visitas no cuesta nada** y sigue ahí si algún día vuelves.

## Lo que queda abierto

El tamaño de celda en tramos, que tiene criterio pero no número; si lo que se cuenta de ti puede llegar a comarcas lejanas —propuesta: que no, porque la reputación viaja a pie y volver a ser forastera es la gracia—; qué pasa con el árbol de calzadas en la costura entre dos celdas contiguas, que probablemente deba contar como un salto más; y cómo se pasa la semilla si dos personas quieren compartir mundo.

**Verificado**: nada que ejecutar, es diseño. Comprobado contra el código antes de escribir: que la semilla es hoy `lat,lon#n` con el `#n` ya en uso como contador de resiembra en el prototipo, y que `countsForRadius` calcula los cupos a partir del radio — que es exactamente lo que deja de tener sentido al pasar a celdas.

---

# Iteración 5-ago-2026 (X) — seguridad y privacidad: al modelo solo le llega ficción

Novena iteración de diseño: `game-design/seguridad-privacidad.md`. Llegaba adelgazado, porque casi todo lo que protege a un jugador se había decidido durante el día por otros motivos — el nombre inventado, el oro que no toca dinero real, el mundo que nadie puede cruzar, la pantalla apagada en marcha, el filtro del grafo viario.

## El vector que nadie había mirado

El pendiente hablaba de permisos y de rastro de ubicación, pero al enumerar qué sale del móvil apareció otra cosa: **el LLM es la única vía por la que algo sale de forma continua**, y el contrato tal como estaba pensado llevaría nombres reales de anclajes para vestir la escena. Un prompt que dice "la taberna es el bar Casa Manolo" es una dirección postal aproximada saliendo del dispositivo cada vez que se crea una quest.

La decisión: del móvil no sale nada del jugador, y del prompt se excluye todo dato real. Salen exactamente dos cosas — las coordenadas al generar el mundo, una vez, y prompts con nombres de fantasía, tipos abstractos y tono. El anclaje real se queda para los ojos del jugador.

Con un coste que quedó escrito: **el guiño central del juego deja de estar al alcance del modelo**. Que O Torreón Esquecido sea el chiringuito de Manolo tendrá que salir de plantilla o de código, que es donde vive el dato real. El LLM pierde su mejor material.

## El permiso invasivo resultó no hacer falta

La pregunta era ubicación en segundo plano o app en marcha, y al repasar lo decidido no había nada que exigiera lo primero: una salida empieza cuando abres la app, y el modo de pasos de fondo lee los pasos acumulados de la app de salud **al abrir**, sin GPS mientras tanto. Así que basta el permiso "mientras se usa", pedido en contexto al empezar la primera salida.

El punto débil —que el sistema mate la app a mitad de caminata— resultó estar cubierto por una regla anterior: los avisos no transportan nada que se pueda perder, así que la noticia sigue sedimentada en su núcleo y la oportunidad sigue en la cola. "Ignorarlo es gratis" cubre también el caso de no haberte enterado.

## Anotar no es resembrar

Para el anclaje que no vale —la finca con perro, el parque que es un solar, las obras— decide el que camina: un gesto de dos toques quita el sitio de las aventuras conservando su nombre y su posición en el mapa. La distinción entre **anotar** y **resembrar** deja intacto el invariante de `bucle-jugable.md` §5.

Con el filtro previo de tipos como primera línea (el filtro quita lo que OSM sabe; el gesto, lo que OSM no puede saber) y con una alarma que ya existía: si alguien descarta tanto que baja del suelo de cuatro parajes de `parajes.md`, entra el estirón ofrecido de §7.

## Y el juego no pregunta la edad

Sin verificación, sin modo infantil. La misma lógica que en accesibilidad: no hay un modo, hay una forma de estar hecho. El documento incluye la tabla de qué riesgo cubre cada decisión anterior —gasto, datos, contacto con desconocidos, compulsión, contenido, esfuerzo físico, sitios problemáticos— y en los siete casos lo que protege a un crío ya estaba puesto por otra razón y protege igual a un adulto. El horario diurno queda como ajuste activado de origen y quitable, y para vigilar a un hijo están los controles de familia del propio móvil, que el juego no reimplementa.

## Lo que queda abierto

Exportar la semilla, que es la única red de seguridad compatible con que no salga nada y que `alcance-del-mundo.md` había dejado colgando; qué pasa con la caché del proxy de generación, que hoy guarda por hash qué coordenadas ha pedido gente; y cómo se le cuenta todo esto al jugador, que en un juego que no manda nada a ningún sitio es tanto una obligación como un argumento de venta.

**Verificado**: nada que ejecutar, es diseño. Comprobado contra el código antes de escribir: que `parsePois` guarda el nombre real del anclaje en cada elemento generado (`real: {name, kind}`), que es el dato que no puede entrar en una llamada de red, y que `server.mjs` cachea las consultas de Overpass en disco por hash del QL, de donde sale el pendiente de la caché.

---

# Iteración 5-ago-2026 (XI) — la partida guardada, y el bloque de diseño cerrado

Décima y última iteración de diseño del día: `game-design/partida-guardada.md`. El inventario venía hecho por todo lo anterior —semilla, contador de pasos, comarcas con sus mapas y rangos, oído, vuelo, cola, diario, repisa, objetos, personaje, NPCs, anclajes descartados y textos cacheados del LLM—, así que quedaban tres preguntas.

## La trampa del determinismo

Parecía bastar con guardar la semilla y regenerar. La letra pequeña lo impide: el determinismo de este proyecto siempre ha sido "misma semilla **más los mismos datos de OSM**", y OSM cambia. Alguien mapea una calle, cierra un bar, se corrige un tag. Regenerar tu comarca dentro de un año daría otros núcleos y otros nombres — exactamente lo que prohíbe `bucle-jugable.md` §5.

Se congela el mundo entero, unos pocos megas por comarca con las polilíneas de calzadas y terreno como grueso. Y sale gratis una propiedad que el pendiente de seguridad había dejado suelta: **una salida entera se juega sin red**. La red hace falta al abrir una comarca nueva y antes de salir, para textos e imágenes, y nunca mientras andas.

## Dos verdades, con una mandando

Se guardan el estado y el registro de hechos. Dos verdades en paralelo es el bug clásico, así que van con reglas: el estado manda, el registro es auditoría y reconstrucción de emergencia; el registro tiene que ser suficiente para reconstruir o no sirve de nada; y si la reconstrucción con una versión nueva da otro resultado, se avisa en lugar de disimularlo.

## Y una corrección de hace una hora

`seguridad-privacidad.md` había dejado como red de seguridad **exportar la semilla**, un código copiable en ajustes. Congelar el mundo lo invalida: la semilla ya no reproduce nada. Lo que hay que poder sacar es la partida entera, y eso son megas.

Va por la copia del sistema —iCloud o Google Backup, cifrada y bajo la cuenta del jugador, sin servidor nuestro— más un fichero exportable a mano, que pasa a ser también el vehículo para compartir mundo con otra persona. Con una salvedad que matiza la decisión 1 de seguridad y que quedó escrita en los dos documentos: **ahí los datos sí salen del móvil**, aunque no hacia nosotros. Lo que no sale ni ahí es el rastro de ubicación, que no se guarda.

## El bloque de diseño, cerrado

Esta mañana el checklist estaba ordenado por esfuerzo y mezclaba lo decidido con lo que ni siquiera estaba planteado. Se reordenó con un criterio nuevo —primero lo que hay que decidir, después lo que solo hay que escribir— y aparecieron ocho pendientes de diseño, seis de los cuales no estaban en ninguna parte. Hoy quedan cerrados los ocho, con nueve documentos nuevos en `game-design/` y cuatro enmiendas a los tres que ya existían.

Lo que queda son treinta y pocos flecos anotados al final de cada documento, y ninguno bloquea: casi todos son contenido que se decide al escribirlo o números que solo salen midiendo. Y entra en la lista lo único grande que seguía sin decidir y que ya no depende de nada: **la arquitectura real de la app**, que estaba esperando a que cerrara seguridad y privacidad.

## Y el índice de pendientes cambia de oficio

Con el diseño cerrado, el camino hacia el código deja de pasar por una lista escrita a mano: de `game-design/` sale un PRD completo, del PRD sale la lista de tareas de implementación, y esas se ejecutan con el bucle `/somo-spec-fable` → `/somo-dev-fable` → `/somo-qa-dev-fable` → `/somo-qa-tester-fable` hasta tener las pruebas en verde.

Así que el índice pierde sus 45 tareas de implementación y se queda solo con lo que falta por **decidir**. Y cambia de nombre: **`docs/checklist.md` pasa a ser `docs/pendientes.md`**, porque `/somo-plan-fable` escribe su backlog en `docs/checklist.md` y habría pisado el fichero. Las menciones al "checklist" en las entradas anteriores de esta bitácora se refieren a ese mismo fichero con su nombre viejo.

Antes de borrar las tareas se comprobó que nada quedara solo ahí: el declutter de rótulos y la placa de los otros estilos viven en la iteración de Reino y en las trampas de `CLAUDE.md`, la detección de región por límites administrativos está en `parajes.md`, y el resto sale de los documentos de diseño, que son la fuente del PRD. Lo único que había que rescatar era un dato de proyecto que no estaba en ningún documento: qué se conserva del prototipo y qué no — que la iteración siguiente acaba matizando.

---

# Iteración 5-ago-2026 (XII) — la arquitectura, y el servidor que no íbamos a tener

Se decide antes del PRD porque condiciona la mitad de las tareas que salgan de él: `game-design/arquitectura.md`. Vive en `game-design/` aunque sea una decisión técnica, porque es una decisión cerrada y porque esa es la carpeta de la que se va a generar el PRD.

## Cinco requisitos que descartan solos la vía barata

Leer los pasos de la app de salud, háptico desde el bolsillo, notificaciones, entrar en la copia del sistema y funcionar sin cobertura. Con eso, la PWA queda fuera sin discusión: en web no hay HealthKit, el háptico en iOS es casi inexistente y no hay forma de entrar en el respaldo del sistema.

Se elige **React Native con Expo**, y el argumento decisivo no es el de siempre: es que JavaScript en el cliente permite compartir el generador determinista con `test/headless.mjs`. De ahí sale una regla dura — **el núcleo no puede importar nada de React Native** — porque si lo hace deja de correr en Node y se pierde la red de seguridad más importante del repo. Lo que era una costumbre del proyecto pasa a ser requisito.

## Se reabre lo de reimplementar de cero, y con motivo

Estaba dado por zanjado que la app se rehacía entera. Con JavaScript en el cliente esa decisión deja de ser gratis: tirar el generador significa quedarse sin garantía de determinismo mientras se rehacen sus tests. Así que el núcleo se **porta a un paquete compartido** —`core`, `world`, `names`, `quests`, la capa de partida— y de cero van el render, las pantallas y los datos.

Con dos apuntes. Portar no es copiar: la rejilla sustituye al radio, los cupos pasan a ser por celda, la cobertura de escenas invierte el orden de asignación de tipos y el tramo personal entra por donde hoy hay una constante suelta. Y la frontera entre núcleo y plataforma ya está trazada en el prototipo aunque fuera por otro motivo — `buildWorld` recibe `fetchData` inyectado en lugar de llamar a la red por su cuenta.

## Y la parte que los documentos daban por hecha sin decirlo

`partida-guardada.md` y `alcance-del-mundo.md` presumen de que no hay servidor nuestro, y es cierto para los datos del jugador. Faltaba la otra mitad: el LLM, la generación de imágenes y Places necesitan claves, y una clave dentro de la app es una clave pública. **Va a haber servidor.**

Lo que se decide es qué clase de servidor, y la tensión apareció al escribirla: un proxy con claves y sin ninguna comprobación es un proxy que cualquiera puede usar con tu factura en cuanto extraiga la URL. La salida es la **atestación de plataforma** (App Attest, Play Integrity), que verifica que la llamada viene de una instalación legítima de la app **sin identificar a la persona**. Se descartó el token anónimo por instalación, más simple de montar, porque es un identificador persistente con el que se puede correlacionar todo lo que ha pedido un móvil.

El proxy cachea solo lo inerte —imágenes por su prompt de ficción, que no dice nada de nadie y es lo que cuesta dinero— y no registra quién llama, ni desde dónde, ni guarda partidas. La frase que hay que mantener: **un proxy con claves no es un servidor con partidas dentro**.

## Lo que queda abierto

Si Overpass va directo desde el móvil o por el proxy, que es elegir quién ve tus coordenadas; qué pasa cuando la atestación falla, porque un rechazo duro deja fuera a gente legítima; el coste por jugador en llamadas de LLM e imagen, que es el presupuesto que `quests.md` dejó abierto y que ahora tiene dónde medirse; y verificar que los cinco estilos se trasladan a Skia sin perder el pintado, que es el producto visible del proyecto.

**Verificado**: nada que ejecutar, es diseño. Comprobado contra el código antes de escribir: que `buildWorld` recibe `fetchData` inyectado (la frontera núcleo/plataforma ya existe), que `M_PER_MIN = 72` en `casting.js` es el punto por el que entra el tramo personal, y que los cinco estilos de `render/styles.js` son objetos de datos fusionados sobre `DEFAULTS`, que es lo que hace plausible trasladarlos a otro motor de dibujo.

**Verificado**: nada que ejecutar, es diseño. Comprobado contra el código antes de escribir: que `buildWorld` devuelve el mundo con `geo` completo dentro (coastlines, lakes, rivers, forests, peaks, roads), que es el bulto real de lo que hay que serializar, y que la caché del proxy ya congela de hecho las respuestas de Overpass por hash del QL — el mismo problema resuelto un nivel más abajo y por otra razón.

---

# Iteración 5-ago-2026 (XIII) — dibujar las pantallas, y lo que sale al dibujarlas

Empieza el paso 2 del camino hacia el código: el diseño de pantallas, en artefactos, uno por momento del bucle. El primero cubre el arranque, de abrir la app a salir a andar.

Dibujar una pantalla obliga a concretar lo que un documento puede dejar en el aire, y el primer artefacto ya devolvió cinco decisiones al diseño.

## Un renombrado que toca trece documentos

**«Comarca» pasa a llamarse «mapa».** Es la palabra que el jugador ve, y "comarca" pedía explicación mientras que "mapa" es lo que la cosa es. El cambio no fue mecánico: en varios sitios «comarca» significaba *la gente de allí* y no la unidad de mundo, y ahí «mapa» no dice lo mismo — "para la gente de ese mapa", "la gente que te va conociendo". Esos se reescribieron a mano.

## El lenguaje del juego, que no tenía documento

`game-design/lenguaje.md`. El lenguaje es inclusivo y, donde el castellano obliga a elegir sin motivo, **el sesgo va hacia el femenino**: el personaje llega con el femenino ya puesto, el reparto de NPCs se equilibra por generación en vez de dejarlo al azar, y el oficio no arrastra el estereotipo — la herrera, la vigía, la cantera.

Lo interesante es la restricción que manda sobre el cómo, y venía ya decidida: **los textos se leen en voz alta** (`personaje.md` §4). Eso descarta desdoblar en cada frase y descarta la -e, porque las dos suenan mal dichas a otra persona mientras camináis. Queda reformular, que casi siempre lee mejor que el masculino que sustituye: *quien camina*, *la gente de aquí*, *el vecindario*.

Y una línea que conviene tener escrita: esto es **sesgo en el reparto y en la duda, nunca censura del personaje**. Cabe un tabernero gruñón; lo que no cabe es que el gruñón sea siempre él.

## Tres decisiones que salieron de mirar las pantallas

**El permiso de ubicación se adelanta.** `seguridad-privacidad.md` decía "al empezar la primera salida", pero levantar el mapa necesita saber por dónde andas y ocurre antes. Corregido allí.

**El nombre del personaje se pide en el onboarding**, no dentro de la ficción. Y con dos matices que solo aparecen al dibujar el campo: deja claro que es el nombre del **personaje** y no el de la persona, y llega con un nombre ya sorteado, para que se pueda empezar sin escribir nada y para que nadie teclee su nombre real por inercia.

**Overpass propio, en nuestro servidor**, con la imagen Docker que el proyecto ya usa en local. Cierra el pendiente 1 de `arquitectura.md`, y el motivo es la fricción antes que la privacidad: contra los mirrors públicos la generación tarda minutos, y esa espera cae en el onboarding, que es el peor sitio para perder a alguien. Con su complemento en `arranque.md`: si el jugador cierra la app a mitad, vuelve al paso anterior con lo contestado precubierto.

**Y el declutter de rótulos deja de ser deuda vaga**: pasa a `arquitectura.md` como algoritmo que calcula posición y tamaño de todos los rótulos antes de pintar. Es la pantalla del mapa la que lo hace evidente.

**Verificado**: el artefacto se publicó y se revisó pantalla a pantalla. Los colores de los móviles salen de `render/styles.js` (estilo Reino) en lugar de inventarse, y `node test/headless.mjs` sigue en verde tras el renombrado, que no toca código.

---

# Iteración 6-ago-2026 (XIV) — antes de salir, y cuatro decisiones que salen de la portada

Segundo artefacto de pantallas: de abrir la app a tener la salida lista. Cinco pantallas —portada, zurrón de lo que pasó mientras no estabas, lista de aventuras, ficha con el lazo dibujado y preparación—, y como el anterior, dibujarlas devolvió decisiones al diseño.

**Máximo tres aventuras a la vez**, y es un tope y no un número fijo. Tres caben de un vistazo y se comparan sin leer; a partir de ahí la pantalla se vuelve catálogo y elegir deja de ser un antojo para ser una compra. Algunos días habrá una sola, según lo que castee en tu mapa y según tu oficio, y un día con una no es un día roto. En `bucle-jugable.md` §3.

**La aventura a medias es una tarjeta en la portada, no una pantalla aparte.** Y con una precisión que solo aparece al preguntarse cuándo puede ocurrir: **solo existe con la salida abierta**. Si llegaste a casa, el cierre en corto ya se disparó y no queda nada pendiente; el caso real es cerrar la app andando, quedarse sin batería o que suene el teléfono. La tarjeta no secuestra la app —desde ahí se puede mirar el diario o salir a andar sin ella—, que es lo único coherente con que abandonar una aventura no cueste nada.

**Sin cobertura no se avisa de nada.** La pantalla de preparación dice exactamente lo mismo haya red o no: los textos caen a plantilla, el visor del anclaje cae a ficha de texto y la salida sigue sin que nada se llame fallo. Es lo que el diseño de fallbacks prometía desde el principio; lo nuevo es que ahora también rige para la interfaz. Anunciarlo solo serviría para señalar algo que el jugador no puede arreglar.

**Y no hay selector de mapas.** El activo lo decide dónde estás: la app abre el de tu sitio, y si llegas a algún lado que no toca con ninguno de los tuyos, ofrece levantar uno nuevo. Al volver a casa vuelve el de casa sin preguntar. Encaja con una decisión de la misma mañana sin haberlo buscado: los mapas antiguos se leen desde el diario, que ya era donde vive lo que has vivido. Leerlos sí, jugarlos desde el sofá no. En `alcance-del-mundo.md` §3.

## Lo que se confirmó por descarte

Dibujar la portada obligó a decidir qué **no** hay en ella, y las tres ausencias son decisiones viejas que por fin tienen consecuencia visible: no hay panel del estado del mundo (lo que se cuenta se oye llegando), no hay marcador de reputación (el rango se nota en cómo te hablan) y no hay una sola cifra de distancia. Lo que sí hay y podría no estar: **«salir a andar sin más» como botón**, porque los kilómetros mueven el mundo con aventura o sin ella.

Queda abierta la barra de navegación de abajo, que en el artefacto va dibujada como propuesta y no como decisión, y con qué forma se lee un mapa antiguo desde el diario. Las dos son del artefacto 6.

**Verificado**: nada que ejecutar, es diseño. El artefacto se publicó y se revisó pantalla a pantalla, con la paleta sacada de `render/styles.js` (estilo Reino) igual que el anterior.

---

# Iteración 6-ago-2026 (XV) — en marcha, y un rótulo del sistema que resuelve tres cosas

Tercer artefacto de pantallas, el más raro de los seis: el momento que está diseñado para no mirarse. Siete pantallas —el bolsillo, el mapa si miras, la noticia que llega, la oportunidad, el desvío, un camino evitado y una séptima dibujada tachada— y casi todas existen para justificar por qué el móvil sigue guardado.

## La pieza que no estaba y sostiene tres decisiones

**Una salida abierta arranca un servicio en primer plano con notificación persistente**, Actividad en Vivo en iOS. Salió al preguntarse qué hace la app con el móvil bloqueado en el bolsillo, que era la colisión más gorda del momento: `seguridad-privacidad.md` §2 pide solo el permiso de ubicación «mientras se usa», y andar media hora con la pantalla apagada parecía pedir el permanente.

No hubo que retocar esa decisión, hubo que sostenerla: con un servicio en primer plano la app **cuenta como en uso**, así que el permiso se queda tal cual está escrito. El precio es un rótulo del sistema en tu pantalla de bloqueo durante toda la salida, con dos condiciones — es tan austero como el resto del momento (hacia dónde vas y nada más, ni una cifra) y es **visible a propósito**, porque una app que sigue leyendo tu ubicación tiene que decirlo mientras lo hace.

Y ese rótulo, que tenía que estar de todos modos, resuelve gratis el pendiente 2 de `bucle-jugable.md`, abierto desde que se escribió: **el telón lo echa volver, y la salida a mano vive en el rótulo**. Hay salidas que no acaban donde empezaron —te quedas en casa de alguien, coges el bus—, y esas se quedarían abiertas hasta la próxima caminata. Poniendo la salida manual en el rótulo, el control existe sin romper la regla del momento: lo tocable es del sistema y no hay que abrir nada para llegar a él. Se descartó cerrar sola al detectar que llevas rato quieta, porque adivinar mal echa el telón sobre una aventura viva y una parada larga es una cosa normal que el resto del diseño ya se ocupa de no penalizar.

## En marcha no hay ni un control tocable

La regla del momento 2 era «pantalla prohibida». Dibujarlo le da la forma dura: **ni un control**, ni para aceptar un desvío ni para descartar un aviso ni para pausar, porque cualquier cosa tocable es una razón para sacar el móvil. Al desvío se dice que sí girando, lo que además muda la decisión táctica del menú a las piernas, que es lo que §3 quería. Y el coste del desvío se enseña con el ramal dibujado y una frase —«queda cerca, pero de camino no está»—, nunca con metros.

Dos decisiones menores de la misma tanda: el mapa va con el **norte arriba** (es un mapa dibujado, no un navegador; girarlo destroza rótulos, cartela y brújula) y tu posición es **una marca roja del propio mapa** y no un punto azul de sistema: estás dentro del mundo, no encima de él.

## El descubrimiento se cobra al telón

**Andar por sitio nuevo no produce nada en el momento.** Se descartó un háptico de descubrimiento, que le habría dado su momento al pilar de la cartografía a cambio de meter un canal de aviso más en el único momento que se diseñó callado. Se registra en silencio y el mapa se entinta de golpe al llegar a casa.

Con una consecuencia que conviene tener escrita: **el mapa en marcha no cambia durante la salida**. Lo único que se mueve en él es tu marca y las de los avisos. Así mirar no aporta nada nuevo, que es el efecto que busca el momento, y el telón tiene algo que enseñar en vez de ser un trámite.

## La pantalla que no vamos a hacer

La séptima va dibujada y tachada, con sus kilómetros, su ritmo, sus kilocalorías, su barra de progreso al 62 % y su racha de seis días. Vale la pena dibujarla porque es la que este momento pide sola y la que se colaría si nadie dice que no. Cada cifra rompe una decisión escrita: el porcentaje deshace que la aventura declare su tamaño con una palabra (§3), la racha castiga la ausencia, que es justo lo que el reloj del mundo se diseñó para no hacer (`quests.md` decisión 4), y todas dan una razón para sacar el móvil. El contador de pasos existe por dentro y mueve el mundo; que el jugador lo vea es otra cosa y no hace falta para nada.

## Y una tarea que aparece en el generador

**Los ramales a parajes pasan a necesitar nombre.** Hoy nacen sin él a propósito. `accesibilidad.md` §2 ya lo pedía para poder declarar un camino evitado; ahora hay un segundo motivo, y es el que lo vuelve inevitable: el desvío se ofrece nombrando el ramal.

Quedan dos cosas para el artefacto 4: quién decide que has llegado —si el geofence valida solo o hace falta un gesto—, de lo que depende que el móvil salga del bolsillo por su cuenta o porque tú lo saques; y qué pasa si te vas por otro lado y el lazo deja de tener sentido.

**Verificado**: nada que ejecutar, es diseño. El artefacto se publicó y se revisó pantalla a pantalla, con la paleta de `render/styles.js` (estilo Reino) como los dos anteriores.

## Apéndice: un aviso que no decía dónde

Revisando la pantalla 4 salió un defecto en el propio texto de ejemplo. El aviso decía «hay una vieja discutiendo con un burro en el cruce de aquí al lado», y con eso **no se puede ir**: quien quisiera atenderlo tenía que tocar la notificación, que es el «toca para saber más» que `accesibilidad.md` §3 prohíbe, con otro disfraz. Estaba escrito mirando el chiste y no la utilidad.

El arreglo es de redacción: el aviso nombra el sitio, porque el mundo tiene nombres justamente para eso. Y deja una prueba que vale para cualquier aviso futuro: **si tocando se aprende algo que hacía falta, el aviso está mal escrito**.

Con el sitio dentro, tocar pasa a ser opcional, y se decide qué hace: **abre el mapa con la marca del encuentro puesta**, y nada más. No acepta —se acepta yendo—, no abre escena y no abre el visor. Eso amplía un poco la regla de que en marcha no hay controles: lo tocable es lo que vive en la pantalla de bloqueo por ser del sistema, o sea el rótulo persistente y los avisos de oportunidad.

## Apéndice II: la escena no se dispara, espera

De preguntar qué tiene que hacer el jugador para atender ese aviso salieron dos cosas.

La primera es una aclaración que faltaba en el artefacto: **el micro-encuentro y el desvío no son lo mismo**. El aviso de la pantalla 4 salta al entrar en el geofence del sitio, así que cuando lo lees ya lo tienes delante e ibas hacia allí de todos modos: atenderlo es pararte, y no cuesta nada. El desvío de la pantalla 5 está fuera del lazo y sí cuesta piernas. Confundirlos hace pensar que hay que viajar a algún sitio para hacer caso a una notificación.

La segunda es una decisión que estaba aparcada para el artefacto 4 y que aquí se cerró: **validar la llegada no es un gesto ni un disparo**. Al detectar que estás parada dentro del geofence, la escena queda **disponible** y espera. No enciende la pantalla, no pone la app delante, no te llama. Si miras, está ahí; si no, sigues andando y no ha pasado nada — que es lo que hace que pararse en un semáforo dentro del geofence no tenga consecuencias. Se descartó abrirla sola: nadie se perdería nada, pero convierte el móvil en algo que te llama en vez de avisarte, que es la línea que sostiene todo el momento.

Y de ahí sale una regla que evita tener dos comportamientos para el mismo gesto: **abrir la app enseña lo que corresponde al sitio donde estás**, no lo que corresponde al botón que tocaste. Andando, el mapa; parada dentro de un geofence, la escena. Da igual si entras por el aviso, por el rótulo persistente o por el icono: quien decide qué hay es el estado y no la puerta.

## Apéndice III: irse por otro lado, que resultó no existir

El último fleco del artefacto, y la mayor parte estaba contestada por decisiones tomadas sin mirar este caso. **El juego no lleva la cuenta del trazado**: guía por nombres de sitio y valida por geofence, así que la ruta dibujada es una sugerencia y no un contrato, y «irse por otro lado» casi no existe como concepto. Otra calle es invisible. Otro sitio no pasa nada —ni «te has desviado» ni recalculando, que es un navegador y encima el reproche que §4 se cuidó de no meter por la puerta de atrás—. Pasar cerca de un beat camino del supermercado valida igual, y eso es un regalo y no una anomalía. Está escrito como §9 de `bucle-jugable.md`.

Dos huecos sí lo eran.

**El vehículo se aparta.** Coche, autobús, tren: el motor de pasos deja de contar y los geofences dejan de validar. Sin esto un viaje en tren vacía el mundo de golpe, el dimensionado en tramos deja de significar nada y encima saltan escenas desde la ventanilla. Cierra la mitad del pendiente 1 de `accesibilidad.md`; la bici y la silla eléctrica siguen abiertas, que es donde la pregunta era de verdad, porque un autobús no es una duda de esfuerzo.

Lo interesante fue **qué pasa cuando la detección duda**, porque una detección que puede fallar es una decisión disfrazada, y resultó que «no cuenta» son tres efectos distintos con dos criterios. Medir el tramo excluye la velocidad de vehículo sin contemplaciones, y es barato equivocarse porque el tramo se corrige sobre muchas salidas. Contar kilómetros y validar geofences, en cambio, **cuentan y validan en la duda**, por aplicación directa del principio de `npcs.md` —lo que el jugador no controla puede abrirle puertas, nunca cerrárselas—: un paso de más no puede quitarle nada a nadie, porque un paso solo añade, mientras que no contar los kilómetros de quien baja una cuesta larga en silla le borra su esfuerzo, que es el fallo que `accesibilidad.md` existe para evitar. Y quien quiera recorrerse el juego en coche puede: **no hay marcador que proteger**, así que apretar la detección hasta que no se escape nada solo tendría víctimas legítimas.

**Y la salida que no vuelve a casa ni se cierra** se resolvió separando dos cosas que se estaban confundiendo: el servicio en primer plano y la salida abierta. El servicio se para tras un buen rato sin que andes por tu cuenta y el rótulo desaparece —no puede haber un cacharro nuestro en tu pantalla de bloqueo durante días—, pero la salida sigue abierta y espera en la portada. Eso obliga a que la tarjeta de a medias ofrezca **seguir o dejarlo aquí**, y no solo seguir como estaba escrito; «dejarlo aquí» dispara el mismo cierre en corto que llegar a casa. Se descartó cerrarla sola pasadas unas horas, por el mismo motivo que se descartó cerrarla al quedarte quieta. Que espere días no molesta, y es una de esas veces en que el diseño ya estaba pagado: el reloj del mundo son tus kilómetros, así que retomar el martes una aventura del jueves anterior no llega tarde a nada.

Con esto el artefacto 3 no deja nada abierto.

---

# Iteración 6-ago-2026 (XVI) — al parar, y una foto que casi rompe la regla de privacidad

Cuarto artefacto de pantallas, el del momento por el que existe el juego: la revelación del anclaje. Ocho pantallas — el visor por el lado de la ficción, el visor arrastrado, la escena, lo que te llevas, lo que aquí se cuenta, la segunda vez, la ficha de texto y el sitio que no pega.

## La foto del lado real, y el momento en que se pide

**Sale de Google Places, por el proxy.** Se descartó que la hiciera el jugador con la cámara, que era gratis y más íntimo pero dejaba la primera visita sin revelación visual justo en el momento de más efecto del juego.

Lo interesante no fue de dónde sino **cuándo**, porque ahí había una colisión que no se veía a simple vista. Pedir la foto de un sitio es mandar qué sitio es, y `seguridad-privacidad.md` §1 dice que del móvil solo salen las coordenadas al generar el mundo, **una vez**. Pedirlas al aceptar cada aventura habría contado al proxy qué sitios reales tienes cerca y cuándo, y habría obligado a enmendar la regla.

No hizo falta: **se piden al crear el mapa**, en la misma tanda que la consulta de Places que ya se hace. Ninguna llamada nueva, la regla intacta, y de propina el mapa entero queda utilizable sin cobertura, que es lo que `partida-guardada.md` §1 pide. El precio es el volumen de fotos por jugador, que amortigua la caché del proxy por sitio — son públicas y las mismas para todo el mundo.

Queda escrito como lección de método, porque va a volver a pasar: **cuando algo real tenga que salir del móvil, primero se mira si cabe en la llamada que ya existe.**

**Y donde Places no tiene foto** —cruceiros, molinos, miradores, que son justamente los anclajes que ensanchan el vocabulario de escenas— el visor no se degrada a ficha de texto. La ilustración de ficción sí existe: abre igual y el arrastre descubre la cartela sobre fondo liso. Se pierde la foto, no el momento.

## La segunda vez no repite la ceremonia

**Al volver a un sitio conocido, el visor no se abre solo**: la pantalla abre por lo que ha cambiado y el visor queda a un toque. Repetir el mismo arrastre lo convertiría en un paso entre el jugador y lo que ha venido a hacer, y a la tercera deja de ser magia. Además hace que volver se sienta distinto de descubrir, que es lo que §5 pide: profundizar y descubrir son premios distintos y no deben notarse igual.

## Tres cosas que se decidieron por no dibujarlas

Dibujar obliga a poner o no poner, y tres ausencias son decisiones:

**La escena va sin retrato de NPC.** Los retratos están en `docs/pendientes.md` como idea sin cerrar, no como decisión, y dibujar una cara los habría convertido en decisión por la vía de los hechos. Funciona sin ella: quién es Sabela lo dicen su puesto y cómo habla.

**Un solo botón en la escena**, porque los beats son lineales de inicio y ramificar está aplazado a propósito. Dos opciones dibujadas prometerían algo que el diseño no ha decidido.

**Y el ajuste de tamaño de letra sí entra**, que es lo único de registro de aplicación que se cuela en un momento que habla como mundo. Se cuela porque el modo compañía es dos personas leyendo en voz alta del mismo móvil, y eso no se resuelve con voz de mundo.

**Verificado**: nada que ejecutar, es diseño. El artefacto se publicó y se revisó pantalla a pantalla, con la paleta de `render/styles.js` (estilo Reino) como los tres anteriores. Comprobado contra los documentos antes de escribir: que el geofence de `quests.md` §3 es generoso (~30-50 m) y activable desde espacio público, que es lo que garantiza que nunca haya que entrar en ningún sitio.

## Apéndice: la secuencia de una llegada, que no estaba escrita

Al revisar el artefacto se vio que faltaba lo más básico: cómo se encadenan estas pantallas. No estaba en ningún documento y en el artefacto tampoco, porque cada pantalla se había dibujado por separado. Ahora está en `bucle-jugable.md` §2 y como bloque propio en el artefacto.

**El visor es una capa por encima de la escena, no un paso previo.** La primera vez se abre solo y se cierra con una flecha o tocando fuera, dejando debajo lo que has venido a hacer. Sale de aplicar la decisión de la segunda visita hacia atrás, y lo que gana es que el visor de la primera vez y el que queda «a un toque» dejan de ser dos cosas distintas: son **una con dos maneras de aparecer**. Si fuera un paso, la revelación se convertiría en un trámite entre el jugador y su recado.

**Y el orden al llegar a un núcleo es beat primero, lo que allí se cuenta después.** El beat es el motivo del viaje y el estado del pueblo es el marco, así que ponerlo delante convertiría en peaje algo que tiene que ser un regalo; y al ir detrás cabe dentro lo que se dice de lo que acabas de hacer en otro sitio, porque los rumores viajan. Si no hay beat, el estado del núcleo es la llegada entera.

Una precisión que hacía falta y que el artefacto daba a entender mal: **no siempre hay beat al llegar**. Llegar a un sitio sin haber venido a nada es el caso normal y no la excepción, y entonces lo que hay es la ficha del sitio.

---

# Iteración 6-ago-2026 (XVII) — el telón, y la secuencia que faltaba otra vez

Quinto artefacto: de vuelta en casa. Seis pantallas — el mapa entintándose, el desenlace, lo que se pone en camino, la entrada del diario, el cierre en corto y el día que no descubriste nada.

## Lo que se decidió dibujando

**El telón se echa solo y sin avisar.** Ni notificación —están reservadas a las oportunidades— ni la app poniéndose delante, que sería el móvil llamándote en vez de avisarte. El telón ocurre; lo que espera es que lo leas.

**El rumor se ve salir y no se ve llegar.** Fue la decisión difícil. La tentación es enseñar la propagación por el árbol de calzadas, que queda precioso y es el sistema del que más orgulloso está el proyecto; pero eso es el panel del estado del mundo que la portada se negó a tener, y enseñar el nivel de deformación explicaría el mejor truco del juego en lugar de ponerlo en escena. Se ve que algo ha salido de ese núcleo, y nada más.

**El oro sí se enseña como número**, que parecía chocar con «ni una cifra» y no choca: aquella prohibición era sobre distancias y tiempos, que son lo que convierte esto en una app de deporte. El oro es una moneda que se gasta en cosas concretas y sin verlo no se puede decidir en qué. Anotado en `progresion.md` porque es el tipo de regla que se aplica de más si nadie marca el límite. Con su pareja: **el rango se dice con una frase y nunca con una lista de pueblos** — «en Monfrida ya saben quién eres» hace el trabajo de un medidor sin ser uno.

**Tres tintas en el mapa** —lo de hoy recién puesto, lo sabido asentado, lo demás a lápiz— y sin leyenda, porque la diferencia se ve. Lo ganado se dice en palabras del mundo: lo ves, lo conoces, lo conoces bien.

**Y en el diario, lo tuyo en primera persona y lo oído aparte**, porque son dos cosas con distinta autoridad: lo que hiciste lo sabes, lo que te contaron no.

## La secuencia, que volvió a faltar

Igual que en el artefacto anterior, las pantallas estaban dibujadas por separado y el encadenado no estaba en ningún sitio, lo que se notó en cuanto alguien intentó leerlas en orden: parecía que el cierre en corto era una alternativa al mapa y que el paseo sin aventura era una pantalla distinta. Ni una cosa ni la otra.

**El telón es una secuencia con dos ramas**, ahora escrita en `bucle-jugable.md` §8: el mapa siempre · el desenlace, o el cierre en corto en su lugar · el rumor solo si era notable · el diario siempre. Un paseo sin aventura es mapa y diario, sin nada en medio: la diferencia entre un paseo y una aventura no es que se cierren de otra manera, es que uno tiene desenlace y el otro no.

Conviene sacar la lección, porque van dos veces: **una pantalla dibujada aparte no dice cuándo aparece, y eso hay que escribirlo a propósito.** Los dos artefactos que llevan bloque de secuencia son los dos que lo tenían mal antes de escribirlo.

## El día flojo

Al desenredar la secuencia apareció un hueco del caso normal, no del raro: **qué enseña el mapa cuando no descubriste nada**. Tu vuelta de siempre, todo ya en «lo conoces bien», la lista vacía.

**Sale el mapa igual y el título lo reconoce**: «hoy no has visto nada que no supieras». Se descartó saltarse la pantalla, que evitaba enseñar algo sin contenido pero hacía desaparecer el objeto central del juego justo el día en que menos apetece salir. Y se descartó trazar el recorrido, que siempre tendría algo que enseñar pero se parece demasiado a una app de deporte. La línea hay que escribirla con cuidado para que suene a constatación y no a reproche — la misma cuerda floja que el ajuste del tramo, que tampoco se comenta jamás.

**Verificado**: nada que ejecutar, es diseño. El artefacto se publicó y se revisó pantalla a pantalla, con la paleta de `render/styles.js` (estilo Reino) como los cuatro anteriores.

---

# Iteración 6-ago-2026 (XVIII) — de consulta, y el paso 2 cerrado

Sexto y último artefacto de pantallas: el diario, la repisa y los ajustes. Seis pantallas, y las tres preguntas que traía se hicieron **antes** de dibujar en lugar de después, porque cada una cambiaba las seis a la vez.

## No hay barra de pestañas: la portada es la casa

El artefacto 2 llevaba una barra de cuatro —mapa, diario, repisa, ajustes— dibujada explícitamente como propuesta. Se quita. Cuatro destinos de igual peso convierten el juego en una aplicación con secciones y dejan los ajustes con el mismo rango que el mapa; además el mapa, que es el producto visible del proyecto, llevaba una barra encima en todas las pantallas.

La portada es un lugar y el diario, la repisa y los ajustes son puertas que cuelgan de ella. Todo queda a dos toques en vez de a uno, que es el precio. El artefacto 2 está corregido y republicado.

## El diario se lee de dos maneras, y la segunda se gana

La decisión de la que más cuelga. El diario empieza siendo cronológico y nada más. **La primera vez que oyes una segunda versión de algo que ya tenías apuntado**, el juego pone las dos juntas en el sitio, sin explicar nada — «esto ya lo habías oído. No así» —, y a partir de ahí el diario también se puede leer **por historias**.

El punto está en el orden y no en la función. Agrupar desde el primer día habría regalado el mejor truco del juego: que dos relatos sean el mismo dejaría de ser algo que descubres para ser algo que te dicen. No agrupar nunca lo habría dejado en algo que ocurre y que casi nadie llega a ver, y de ese sistema cuelga medio juego. El descubrimiento es del jugador y la comodidad viene después, que es exactamente cómo `arranque.md` pone en escena la deformación en lugar de explicarla.

Dos restricciones para que la vista nueva no deshaga lo que protege: **se ordena por cuándo lo oíste, nunca de más fiel a más torcida**, y **no se marca cuál es la buena**. Y el mecanismo sale gratis, porque el rumor ya tiene identidad interna: lo que se decide es cuándo esa identidad se hace visible, que hasta ahora no lo era nunca.

## El diario tiene un capítulo por mapa

Cierra la otra pregunta aplazada del artefacto 2. Los mapas antiguos no viven en un cajón de láminas —que se parecía demasiado al selector que `alcance-del-mundo.md` §3 acababa de descartar— sino como capítulos: abres el de aquel sitio y dentro están sus días, su gente y su mapa. Cada mapa es un tramo de tu vida y no una opción de una lista. Con una asimetría que hay que asumir en lugar de corregir: el capítulo de casa es un tomo y el de unas vacaciones un cuadernillo.

## Lo demás que se decidió

**La repisa no es un inventario**: sin peso, sin huecos, sin nada que tirar, porque los objetos son llaves y recuerdos y no equipo. Cada uno con de quién y de qué día. Y debajo, **los motes por núcleo**, que son lo más parecido a una ficha de personaje que hay en el juego y que hacen de reputación sin ser una barra — verlos juntos es ver que en cada pueblo eres otra.

**Y los ajustes son la única excepción a la frontera de los dos registros**, anotada en `lenguaje.md`. Ahí se vuelve a hablar como aplicación y se nota hasta en la tipografía, porque un ajuste disfrazado de acertijo es peor que un ajuste. Que sea la única excepción es lo que la hace sostenible. Dentro: el tramo en lenguaje de sitios y con el ajuste automático sin comentar jamás, «caminos que evitar» sin que aparezca la palabra accesibilidad, los pasos de fondo apagados, el horario diurno encendido, los cinco estilos de pintado, los sitios marcados —que es donde por fin se puede deshacer un descarte— y la copia exportable.

## Con esto se cierra el paso 2

Seis artefactos, treinta y nueve pantallas y ningún momento del bucle sin dibujar. El índice con enlaces y resúmenes está en `docs/pantallas.md`.

Lo que el paso deja como saldo: **catorce decisiones nuevas de diseño y tres pendientes cerrados** —el 2 de `bucle-jugable.md`, el 1 de `arquitectura.md` y medio del 1 de `accesibilidad.md`—, además de un documento que no existía (`lenguaje.md`). Ninguna habría salido leyendo los documentos: salieron de preguntarse qué se dibuja en una pantalla concreta.

Lo siguiente es el paso 3, el PRD, que sale de `game-design/` y de estos seis artefactos.

**Verificado**: nada que ejecutar, es diseño. El artefacto se publicó y se revisó pantalla a pantalla, y el artefacto 2 se corrigió y republicó en su misma URL.

## Apéndice: empezar de nuevo, que es borrar y no reiniciar

Faltaba en ajustes. Y no es un botón cualquiera: por la decisión 1 de `partida-guardada.md` el mundo está congelado y **no se puede rehacer**, así que empezar otra vez en la misma calle daría otro sitio con otros nombres. Esta pantalla acaba siendo el único lugar del juego donde hay que explicarle al jugador una decisión técnica, y hay que explicarla porque cambia lo que está a punto de hacer.

**La copia se ofrece, no se hace sola**: quien quiere irse limpio se va limpio y no le dejamos megas que no ha pedido. El precio es escribir el aviso para que se lea. Y funciona como salida de verdad porque el fichero es el mismo que sirve para abrir un mundo ajeno, así que se puede volver. Tres reglas más de redacción y jerarquía: se enumera lo que se pierde **en cosas y no en datos** —el personaje, los mapas por su nombre, los días de diario, lo que la gente sabe de ti—, porque «esta acción no se puede deshacer» no dice nada que nadie lea; lo destructivo **no es el botón principal**; y aquí se habla como aplicación sin disfraz, que es el caso que mejor justifica la excepción de `lenguaje.md`.

## Y una decisión que el reset destapó: el oficio no se cambia

Al dibujar los ajustes quedó claro que el reset carga con algo que no estaba escrito. **El oficio se elige en el arranque y se queda**: ni ajuste para cambiarlo ni camino en la ficción para aprender otro. Lo que da peso a la única palanca mecánica del personaje es precisamente que haya aventuras que con esta persona no verás nunca, y un oficio cambiable en un toque es una preferencia y no una decisión.

Lo interesante es que el coste de arrepentirse **está bien repartido sin haberlo diseñado**: crece con lo jugado. El día 2 no tienes nada que perder y resetear es barato; el día 200 te arrepientes mucho menos y además no querrías tirar doscientos días de diario. La decisión se endurece justo al ritmo al que deja de importar.

Con una obligación que sí genera: **la pantalla de elección del arranque tiene que decir qué implica cada oficio antes de cerrarse**. Si la decisión es permanente, el momento de tomarla no puede ser un menú de nombres bonitos.

## Apéndice II: una contradicción que llevaba publicada desde el artefacto 1

Al revisar la pantalla de creación de personaje apareció que el artefacto 1 decía lo contrario de lo que se acababa de decidir: *«el nombre, el género, el oficio y hasta la dificultad se pueden cambiar después sin tocar el mundo»*. Llevaba ahí desde que se dibujó la navegación hacia atrás, y nadie lo había cruzado con `personaje.md` porque `personaje.md` tampoco decía nada.

Corregido en los tres sitios. **El oficio no se cambia, ni por la flecha ni por ajustes.** El nombre y el género gramatical sí, y van en ajustes: no tienen consecuencia mecánica, y encerrar a alguien en un nombre que no le gusta no protege nada. Cierra de paso el pendiente que el artefacto 1 tenía abierto sobre cambiar nombre u oficio pasada la creación.

Dos cambios más que se derivan:

**La pantalla de elección dice qué implica el oficio antes de cerrarse.** Una línea sobre la lista —«marca qué aventuras te va a ofrecer el mundo, y esto no se cambia luego»— y el oficio marcado se despliega para explicar a qué te manda. Así informa en el momento de decidir sin convertirse en un muro de texto que nadie lee.

**Y el género gramatical faltaba en los ajustes del artefacto 6**, aunque `lenguaje.md` diga que se cambia en un toque. Estaba solo en la creación de personaje, o sea que era un toque que solo existía durante treinta segundos del onboarding.

Lección del apéndice, que es la misma de los bloques de secuencia: **lo que un artefacto da por supuesto sin que ningún documento lo diga acaba siendo una decisión tomada por nadie.** Aquí lo dio por supuesto dos veces y en direcciones opuestas.

## Apéndice III: el flujo entero, y un script que lo vigila

`docs/flujo.md`: un diagrama de estados con las **40 pantallas** de los seis artefactos como nodos —etiquetados `pantalla N · artefacto M`— y, en cada arista, la acción que la recorre («Seguir») o la condición que la hace existir («solo si el desenlace era notable»). Es la vista que ningún artefacto por separado puede dar: cada uno dibuja un momento y las costuras entre momentos solo se ven aquí. Y no es teoría — las dos veces que un artefacto estuvo mal, el fallo era exactamente eso: una arista que no existía.

Tres cosas que se ven en el diagrama y no en los documentos:

- **El bolsillo es el centro de gravedad.** *Pantalla 1 · artefacto 3* es el nodo con más aristas de todo el juego, y es la pantalla diseñada para no mirarse. Todo lo que pasa en la calle sale de ahí y vuelve ahí.
- **Solo hay tres rombos, y ninguno pregunta nada al jugador**: a qué sitio llegas, qué hay debajo del visor y si el sitio es un núcleo. Las bifurcaciones las decide el mundo; el jugador decide con las piernas.
- **El artefacto 3 casi no tiene aristas internas.** Sus pantallas cuelgan de la 1 y vuelven a la 1 sin encadenarse: es la forma que toma en un grafo la regla de que en marcha no hay ni un control tocable.

**Y se verifica solo**: `node scripts/verifica-flujo.mjs` extrae las pantallas de los seis HTML y comprueba cuatro cosas — que están todas, que no sobra ninguna, que ningún nodo miente sobre a qué pantalla y artefacto pertenece, y que ninguna queda sin aristas. **Las cuatro se comprobaron rompiendo el diagrama a propósito**, porque un check verde que nunca se ha visto fallar no es evidencia de nada: quitando un nodo, dejando uno suelto, añadiendo una pantalla a un artefacto sin ponerla en el diagrama, y cambiando el título de un nodo. Los cuatro fallan con salida 1 y el mensaje correcto.

Dos decisiones de repo que esto obligó:

**Los seis HTML se copian a `docs/pantallas/`.** Un script que verifica contra ficheros de un directorio temporal caduca al cerrar la sesión, y además el PRD del paso 3 se va a escribir a partir de estos artefactos: no puede depender de una página privada que solo ve una persona.

**Y las variantes del telón se reetiquetan como 1B y 2B.** «PANTALLA 2 · EN SU LUGAR» se lee bien pero no se parsea, y una comprobación determinista no puede depender de una tabla de casos especiales escrita a mano.

Trampa de mermaid que costó un rato y queda anotada en `CLAUDE.md`: **un nodo referenciado en una arista antes de declararse acaba fuera de su subgrafo**, así que todas las declaraciones van arriba y las aristas debajo.

**Verificado**: `node scripts/verifica-flujo.mjs` en verde (40 pantallas, 40 nodos, 83 aristas, ninguna suelta), sus cuatro afirmaciones comprobadas por rotura deliberada, y el diagrama renderizado de verdad para descartar errores de sintaxis del mermaid.

---

# Iteración 6-ago-2026 (XIX) — la batería de pruebas, antes de implementar

`docs/testing.md`: **33 características y 174 casos ejecutables** en Gherkin, escritos antes de que exista una línea de la app. Cada característica cita la decisión de `game-design/` de la que sale, y la regla de precedencia queda escrita: si un escenario y un documento se contradicen, manda el documento y el escenario está mal.

El orden importa. Escribirla ahora obliga a que cada decisión de diseño se pueda enunciar como comportamiento observable, y las que no se dejan es que estaban vagas. Escribirla después habría producido lo de siempre: pruebas que confirman lo que el código hace.

## Cuatro niveles, y dos áreas bloqueantes

`@nucleo` corre en Node contra el paquete compartido sin dispositivo ni red, y es el grueso —18 de 33—. `@app` necesita GPS simulado y reloj de mundo controlable. `@red` toca el proxy. Y `@manual` es lo que no se puede afirmar con una aserción, que va escrito en el mismo formato para que no se olvide: si el chiste tiene gracia, si el chiste nunca es a costa del sitio real, si la revelación del anclaje emociona.

**Las de `@determinismo` y `@privacidad` son bloqueantes**, y por motivos distintos: una regresión de determinismo rompe el invariante del que cuelga el proyecto entero, y una de privacidad saca del móvil algo que no debía salir.

## Lo que la batería obliga a montar

Escribir los escenarios destapó qué andamiaje hace falta, y conviene tenerlo listado antes de que alguien lo improvise: fixtures de OSM congelados para cuatro tipos de mundo —costero, urbano denso, barrio de tres calles y el suelo de 250 m—, GPS simulado con paradas y con tramos a velocidad de vehículo, un **reloj de mundo controlable distinto del reloj del sistema**, un doble del proxy con modo «falla siempre», y un inspector de tráfico saliente, que es la única manera de afirmar «esto no sale del móvil» en vez de suponerlo.

## Y un validador, porque nadie va a ejecutar esto en meses

`node scripts/verifica-gherkin.mjs` comprueba que los bloques están bien formados: `# language: es`, una característica por bloque, cada línea empezando por palabra clave del locale español, cada esquema con su tabla y sus columnas cuadradas con los marcadores que usan los pasos, ningún nombre de escenario repetido, ninguna característica sin `Fuente:` y **ningún escenario sin `Entonces`**, que es la manera más silenciosa de tener una suite verde que no comprueba nada.

Cazó cuatro errores míos a la primera pasada: había usado «Aunque», «Porque» y «Ni» como conectores, que en castellano encadenan perfectamente y en Gherkin no son nada. Y el propio validador tenía un fallo —no sabía de etiquetas ni de la descripción libre de una característica— que solo apareció al ejecutarlo. Sus fallos se comprobaron rompiendo el fichero a propósito: quitando un `Entonces`, descuadrando una tabla y quitando una `Fuente:`.

**Verificado**: `node scripts/verifica-gherkin.mjs` en verde (33 características, 162 escenarios, 4 esquemas con 12 ejemplos), tres modos de fallo comprobados por rotura deliberada, y `node scripts/verifica-flujo.mjs` y `node test/headless.mjs` siguen en verde.

---

# Iteración 7-ago-2026 (XX) — el PRD y el checklist: el paso 3, cerrado

`docs/prd.md`: el PRD del juego completo, escrito desde `game-design/` (14 documentos), los seis artefactos de pantallas, `docs/flujo.md` y `docs/testing.md`, con la regla de precedencia declarada dentro — manda `game-design/`. Sigue el esqueleto de `/somo-plan-fable` con las cuatro sustituciones que fijaba `docs/prompt-prd.md`, declaradas en el propio documento: anclas a decisiones en lugar de exploration report, ejes de variación en lugar de personas, referencia a flujo y batería en lugar de casos de uso propios, y los KPIs de producto como exclusión explícita — no hay analítica posible sin romper `seguridad-privacidad.md` §1, y es decisión, no carencia; en su lugar quedan la salud del generador, el coste por jugador, el rendimiento y la lista `@manual`.

Los números: **116 requisitos funcionales** en 13 categorías (las 12 sugeridas más `PJ`, personaje y arranque), 107 must y 9 should, sin ningún could — lo no decidido no entra como requisito, va a supuestos o a exclusiones. **16 RNF con código** en siete áreas (determinismo, privacidad, sin red, accesibilidad, rendimiento, coste, compatibilidad/i18n). Quince exclusiones con su porqué, los tres pendientes grandes (tamaño de celda, qué cuenta como moverse, si el rango baja) como supuestos declarados con propuesta de trabajo, y los treinta y pico flecos menores recogidos con su documento y sin resolverlos.

La comprobación que este repo permitía y casi ningún proyecto tiene: **la batería es anterior al PRD**, así que se cruzó en las dos direcciones. Cada RF apunta a los escenarios de `docs/testing.md` que lo verifican, y donde no hay ninguno lo dice el propio RF — quince huecos de cobertura de la batería quedaron marcados con ⚠ (el prólogo, el hito de arranque, las franjas, la relación de NPCs, el respaldo, la migración de estado, entre otros) y recogidos como riesgo 10. En sentido inverso, las 33 características de la batería quedan cubiertas por algún RF.

`docs/checklist.md`: el backlog del pipeline en el formato tabla canónico, **42 specs en 6 bloques** (núcleo portado → mundo vivo → la palabra → app y mapa → bucle en la calle → lo que queda en casa), una fila por spec implementable y testeable de una pasada — la capa de NPCs son cinco RF y una spec —, con el orden como prioridad de ejecución y el estado en manos de `/somo-pipeline`. El nombre `checklist.md` estaba reservado en `CLAUDE.md` para esto desde el 5-ago-2026.

**Verificado**: un script ad hoc cruzó las anclas del PRD contra sus fuentes — las 94 citas de `testing.md` existen literalmente, los 30 nodos `[flujo: AnPm]` están en el diagrama, los 15 documentos citados existen, y los 116 RF y 16 RNF del PRD cuadran uno a uno con las filas del checklist (cazó dos RF sin fila, que se recolocaron). Y los tres verificadores del repo siguen en verde: `verifica-flujo.mjs` (40 pantallas, 83 aristas), `verifica-gherkin.mjs` (174 casos) y `test/headless.mjs`.

---

# Iteración 7-ago-2026 (XXI) — el pipeline, adaptado a un juego que no es una web

Antes de escribir el encargo de implementación desatendida salió que **las cuatro skills del pipeline no sirven tal cual**, y no por un detalle: `somo-dev-fable` declara «Stack fijo: TypeScript estricto, Vite 6, React 19, Tailwind v4, shadcn/ui, React Router v7, Supabase». Este proyecto es React Native con Expo, Skia y un paquete de núcleo sin dependencias. `somo-qa-dev-fable` genera e2e con Playwright contra un dev server web y `somo-qa-tester-fable` exige credenciales de Supabase DEV.

Había tres ausencias más: **`/somo-pipeline` no existe** —las cuatro skills dan por hecho un orquestador que las llama, lleva `pipeline/state.json` y es el único que escribe la columna `Estado`—, tampoco existe **`somo-qa-analyst`**, que es quien dictamina defecto de prueba contra defecto de código, y faltaba **`.claude/rules/naming.md`**, que `somo-spec-fable` lee como contexto obligatorio.

## Copiadas al repo con prefijo `wa-`

Las cuatro viven ahora en `.claude/skills/` con nombres propios: `wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`. El prefijo es deliberado — una skill de proyecto que se llama igual que la de usuario deja ambigüedad sobre cuál se invoca, y un bucle desatendido no puede adivinar.

De 5218 líneas se fueron 1426 (el catálogo de shadcn, el contexto de Supabase y su ciclo de vida), se reescribieron el contexto de stack, el sistema de diseño, el framework de pruebas, la estrategia de dobles y el runner, y el resto se quedó: el método de esas skills es lo bueno que tienen.

## Dos runners, y los decide la propia batería

`node:test` para `@nucleo` y Maestro para `@app`. La clasificación no se inventó: **`docs/testing.md` ya etiqueta cada característica por dónde puede correr**, y 18 de 33 son `@nucleo`, o sea Node pelado contra el paquete compartido. El grueso no necesita toolchain de React Native, lo que además conserva la regla de que el núcleo no importa nada de plataforma.

## Tres bugs que solo aparecieron al ejecutar el runner

**Sin ninguna prueba devolvía PASS.** Verde y no verificado no son lo mismo, y en un bucle que nadie mira esa confusión es cómo una spec sin verificar se da por buena. Ahora hay un tercer estado, `VACIO`, con código de salida 2, y el prompt le dice al orquestador que no lo lea como verde.

**`node --test <directorio>` no funciona en Node 24**: trata el directorio como un fichero de test y falla con `MODULE_NOT_FOUND`. Hay que pasarle los ficheros.

**Y el arreglo de eso usaba `mapfile`, que es de bash 4**, cuando macOS trae la 3.2. Sustituido por un bucle `while read`.

Los tres estados están comprobados: 0 con una prueba que pasa, 1 con una que falla, 2 sin ninguna.

## El encargo

`docs/prompt-implementacion.md`, con preflight que para antes de empezar si falta algo, el bucle de ocho pasos, los criterios del veredicto —incluido el tercer caso que no es ni prueba ni código: infraestructura ausente, o un import de React Native colado en el núcleo— y un tope de tres iteraciones por spec antes de marcarla bloqueada y seguir. Un bucle desatendido que se atasca en la fila 3 desperdicia el resto de la noche.

**Verificado**: el preflight del prompt ejecutado tal cual (Node 24, las cuatro skills, naming, los cuatro documentos, y `verifica-gherkin`, `verifica-flujo` y `headless` en verde); Maestro ausente, que es el caso que el diseño del runner ya contempla; el runner probado en sus tres estados; y `git check-ignore` sobre lo nuevo, por la trampa de siempre.

# 8 de agosto de 2026 — La primera noche del bucle

Primera ejecución desatendida de `docs/prompt-implementacion.md`. Se cerraron **cuatro filas del checklist**, se escribieron **catorce specs** y la suite quedó en **276 casos `@nucleo` en verde**. El detalle está en `pipeline/informe-2026-08-08.md`; aquí va lo que merece quedar en la bitácora.

## Lo que se implementó

`SPEC-001` el andamiaje (cuatro fixtures de OSM congelados, cinco dobles, el runner con sus tres códigos de salida), `SPEC-002` el porte del generador a `packages/nucleo/` con la E/S inyectada, `SPEC-003` la semilla y la rejilla de celdas, y `SPEC-004` el tramo personal. B1 va por la mitad: quedan las filas 5 a 8, con sus specs ya escritas.

## Los dos defectos que justifican el diseño del runner

La iteración de `SPEC-001` corrigió dos fallos de la misma familia —**verde que nunca se ejecutó**—, y los dos se descubrieron ejecutando, no leyendo:

**El guardián de ejecución directa fallaba con enlaces simbólicos.** `process.argv[1] === fileURLToPath(import.meta.url)` es falso cuando la ruta atraviesa un symlink, porque `import.meta.url` los resuelve y `argv[1]` no. En macOS `/tmp` y `/var` lo son. Efecto: `valida-spec-test-map.mjs` invocado por una de esas rutas no imprimía nada, no validaba nada y **salía 0**. Un mapa de cobertura mentiroso pasaba por bueno.

**El runner daba PASS con una prueba en rojo si heredaba `NODE_TEST_CONTEXT`.** Al lanzarse desde dentro de otro `node --test`, la salida del anidado cambia de forma, el parseo fallaba y el veredicto salía verde. Ahora el runner sanea el entorno y **afirma** el PASS: si no reconoce el resumen TAP, eso es código 2, nunca verde.

## El determinismo, roto y arreglado

La iteración de `SPEC-002` cerró un `@determinismo` bloqueante: **con los elementos de OSM llegando en otro orden, `costero` y `urbano-denso` generaban otro mundo**. La causa era que el parseo emitía en orden de llegada y nadie ordenaba, y que `parseGeo`/`parseStreets` ni siquiera guardaban el identificador por el que ordenar. Se cerró la clase entera con claves estables (`tipo/id`), no el caso.

En la misma iteración se arregló que **la unicidad de nombres era por familia y no del mundo**: `farmName` y `poiName` no llevaban conjunto de usados, así que `costero#2` repetía «Casal da Colmea» y «Mercado do Dragón Bailador». Ahora hay un índice único compartido por las cinco familias y un `variantName` nuevo en la interfaz común de idiomas.

Arreglarlo tuvo un precio medido y aceptado: los recuentos de `costero#2` cambian, porque quitar el duplicado consume un sorteo más. Se comprobó que **no lo movía la ordenación** —con solo ese cambio los ocho extractos salían byte a byte idénticos— y se decidió que un extracto de referencia no puede vetar un arreglo de determinismo. Está razonado en `pipeline/decisiones-orquestador.md` §6b.

## El hallazgo que hay que atender antes de seguir

**El mundo mínimo no es jugable hoy, y está medido.** Con el tramo en el suelo (250 m), las celdas de `barrio-tres-calles` y `suelo-250m` **no castean ni una sola plantilla con lazo cerrado**. La causa está localizada: `parajeCountForRadius` da 1 y 2 parajes donde el cociente del catálogo pide 3, porque **el suelo derivado del catálogo no está implementado** — hoy el cupo sale de una tabla por radio, que es el techo por ritmo, no el suelo.

`SPEC-004` ya calcula el suelo (siete escenas ÷ dos = cuatro), pero **nadie lo consume**: `parajes.js` sigue generando por radio. Su dueña es la fila 6. Hasta entonces, el escenario «El mundo mínimo todavía compone un lazo» lleva dos filas seguidas sin poder cerrarse, y es el eje de variación 2.3 del PRD fallando justo en su extremo pobre.

## ~~RF-MUNDO-002 sin escenario~~ → hecho

Era uno de los quince huecos de cobertura que el PRD dejó marcados. `docs/testing.md` gana la característica **«La semilla es un dato de la partida, no una coordenada»** con tres escenarios —dos vecinos ven mundos distintos, una semilla mal copiada se rechaza, la semilla no contiene ninguna coordenada— y sus pruebas. Al implementarlos se vio que **ninguna de las tres afirmaciones estaba cubierta del todo** por lo que ya había: se completaron en vez de darlas por buenas. La batería pasa de 174 a 177 casos ejecutables.

## Verificado con

`bash scripts/qa-tester-run.sh SUITE` → **PASS, 276 de 276**, report en `test/reports/SUITE-run-20260808T013508Z.md`. `node test/headless.mjs` en verde. `node test/casting-report.mjs` ejecutado contra los cuatro mundos reales con Overpass local: Sanxenxo 6/6, Toledo 5/6, Madrid 6/6, A Coruña 6/6. `verifica-gherkin` (34 características, 177 casos) y `verifica-flujo` (40 pantallas, 83 aristas) en verde.

**Lo que no se pudo verificar: nada de nivel `@app`.** Maestro no está instalado en esta máquina, así que ningún flujo de simulador se ejecutó. El report lo registra como infraestructura ausente y nunca como verde, que era justamente el punto.

# 8 de agosto de 2026 — B1 cerrado

Las ocho filas de **B1 · El núcleo portado** quedan en `done`. La suite pasa de no existir a **441 casos, 438 en verde, 0 rojos, 3 saltados**. El entregable que el PRD pedía para el bloque —«`headless` y `casting-report` en verde sobre el paquete nuevo, con celdas y tramos»— está verificado: `test/headless.mjs` en verde y el informe de casting en **131 de 132**, con los cuatro mundos reales (Sanxenxo, Toledo, Madrid centro, A Coruña) a **6/6**.

## La medida que importa

La casteabilidad agregada sobre los ocho extractos de referencia es la salud del generador, y es una de las cuatro cosas que este proyecto sí mide. Su trayectoria:

**21/48 al empezar → 17/48 → 24/48 → 30/48 → 32/48.**

El 17 es una regresión que introdujo la primera entrega de la fila 5 y que se corrigió por iteración: los topes de diversidad recortaban el pool en la **admisión** y estrangulaban mundos pequeños — `costero` pasaba de 45 anclajes a 26. Moverlos al **reparto**, donde solo actúan cuando sobra pool, devolvió el 24. El salto a 30 es la fila 6, y a 32 la 7.

## El mundo mínimo, que era el agujero

`barrio-tres-calles` y `suelo-250m` **no casteaban ni una plantilla con lazo cerrado**. El escenario «El mundo mínimo todavía compone un lazo» llevaba tres filas muerto y se reatribuyó dos veces, porque el cupo de parajes salía de una tabla por radio —el techo por ritmo— y **el suelo derivado del catálogo no lo consumía nadie**.

Lo cierra la fila 6, invirtiendo el orden de generación: primero los tipos que cubren el vocabulario de escenas, después el anclaje, sacrificándolo sin cambiar el tipo. Hoy `barrio-tres-calles` castea 1/6 y `suelo-250m` 3/6, con lazo cerrado.

## La forma de fallo que salió cuatro veces

Merece nombre porque es la lección del bloque: **una pieza que, al no estar, no protesta.**

- El validador del mapa **salía 0 sin validar nada** cuando su ruta pasaba por un enlace simbólico.
- El runner **daba PASS con una prueba en rojo** si heredaba `NODE_TEST_CONTEXT`.
- `generateParajes` **asumía suelo cero** cuando no le inyectaban el vocabulario, sin distinguirlo de un vocabulario vacío legítimo.
- `buildRoutes` aceptaba **una lista de vías o un grafo** en el mismo parámetro, así que pasarle lo viejo degradaba en silencio. Ese último causó el mismo bug **tres veces** —el `fetchData` de la app, y los dos helpers de pruebas—, y la tercera destapó una regresión real: `crossingCandidates` definía cruce como «punto compartido por dos calzadas», que solo funciona con un grafo pobre.

Las cuatro se cerraron por contrato y no por vigilancia: la cosa exigida, y su ausencia error de construcción. Es el mismo criterio que SPEC-007 aplica a la marca de suposición, y por la misma razón — con un campo opcional, «perderlo» y «no haberlo tenido nunca» son indistinguibles.

## ~~RF-INFRA-007 sin escenarios~~ → hecho

El andamiaje que sostiene las 441 pruebas era la única pieza del repo sin criterios escritos antes que su código: su ancla era una lista de viñetas, no Gherkin. Ahora son dos características y diez escenarios, derivados de los dos defectos que la iteración de la fila 1 tuvo que corregir. Con los tres de la semilla (RF-MUNDO-002), la batería pasa de 174 a **183 casos ejecutables**.

## Lo que queda declarado y sin resolver

- **4 de 16 lazos no se entregan** bajo el filtro de accesibilidad, porque un tramo difícil no tiene nombre en el grafo. Es lo que la spec exige —antes fallar que declarar un camino anónimo— y la solución, nombrar todo tramo difícil al generar, es deuda de la fila 7.
- **El criterio de bordillos no está verificado sobre dato real**: los cuatro fixtures se capturaron pidiendo solo ways y no traen ni un nodo de bordillo. Probado con datos sintéticos, y con un caso que se pondrá rojo el día que alguien los recapture.
- **`test/app/` sigue vacío.** Maestro ya está instalado (2.8.0, con la analítica desactivada), pero ninguna spec de B1 ha pedido un flujo de simulador: son todas de núcleo. El primer `@app` llegará con B4.

## Verificado con

`bash scripts/qa-tester-run.sh SPEC-008` → PASS, 441 casos, 438 pasan, 0 fallan, 3 saltados (`test/reports/SPEC-008-run-20260808T104759Z.md`). `node test/headless.mjs` → Todo OK. `node test/casting-report.mjs` contra el Overpass local → 131/132, los cuatro mundos reales a 6/6. `verifica-gherkin` (35 características, 183 casos) y `verifica-flujo` (40 pantallas, 83 aristas) en verde.

# 8 de agosto de 2026 — B2 cerrado

Las ocho filas de **B2 · El mundo vivo** en `done`. Con B1, **dieciséis de cuarenta y dos**. La suite pasa de 441 a **1042 casos, 1039 en verde, 0 rojos, 3 saltados** (los tres se saltan solos desde que Maestro está instalado: afirmaban el comportamiento *con Maestro ausente*).

## Lo que hay ahora

Mundo congelado con esquema cerrado y recuperación sin red; casting de aventuras con motivo estructurado y distancias medidas sobre el grafo; motor de pasos donde el reloj son los kilómetros; propagación de rumores con deformación por saltos; prólogo que compone su par de núcleos; capa de NPCs perezosa que no consume anclaje; rango, oro y objetos-llave; y el diario con el estado y el registro de hechos.

## El entregable del bloque, verificado a mano

El PRD promete «simulación completa de partida en Node: pasos, rumores, rangos y diario, determinista». Con las ocho filas verdes y **1036 casos pasando**, monté esa simulación de punta a punta. La entrega existe —mundo, prólogo con par avalado, salidas casteadas, pasos, rumores llegando con su nivel, rango, oro, objetos, motes, diario, ida y vuelta y determinismo entre procesos distintos— **y salieron cuatro defectos que ninguna prueba unitaria veía**:

- **Congelar la partida se rompía en su camino feliz.** `cierraSalidaDeProgresion` construía `procedencia` como objeto y el esquema la declaraba texto: bastaba con que un desenlace entregara un objeto para que la partida no se pudiera guardar. Las pruebas no lo veían porque llamaban a `congelaObjetos` directamente y **se saltaban el sobre**.
- **`dia` tenía dos contratos incompatibles** en el mismo bloque: texto en la repisa, entero en el diario.
- **El prólogo inflaba el rango antes de jugar.** Sus sucesos llegaban a todos y el rango contaba rumores sin mirar protagonista: **nueve de diez núcleos amanecían en nombradía el día 1**, con la jugadora sin haber hecho nada. Ahora los diez amanecen en forastería y suben solo con lo que ella provoca.
- **Bytes NUL** dentro de literales de plantilla en dos módulos.

**La lección, y es la más cara de la ejecución:** una suite verde de mil casos no demuestra que el producto funcione. Los cuatro defectos viven en las **costuras entre filas**, y cada fila probaba su lado con diligencia. El entregable por bloque del PRD no es ceremonia: es el único momento en que alguien recorre el camino entero.

## Las tres veces que un indicador bajó, y por qué está bien

La casteabilidad agregada sobre los ocho extractos: **32/48 → 31/48 → 30/48**.

El primer descenso lo paga la cuantización de coordenadas a un metro, que es lo que hace que un mundo urbano quepa en el presupuesto (2953 KB → 1959 KB). El segundo lo paga medir las distancias **sobre el grafo** en vez de en línea recta: el lazo que desaparece tenía un trecho de **1688 m de caminata presentados como 126 m**. Antes se ofrecía porque la medida mentía.

Un indicador solo sirve si mide lo mismo que el juego. Los dos descensos son el precio de que no mienta.

## El patrón que ya va por cinco

`pipeline/decisiones-orquestador.md` §6h lo bautizó: **una pieza que, al no estar, no protesta**. En B2 apareció dos veces más. Una, `test/casting-report.mjs` —el informe con el que se juzga la salud del generador— **no pedía el callejero**: llevaba desde la fila 7 midiendo un mundo que no juega nadie, y daba 113/132 en vez de 127/132. Otra, distinta y peor: un requisito **cumplido de forma vacía** — el prólogo componía su par de núcleos, pero ninguna aventura pasaba por él, así que el arranque que `arranque.md` §2 diseñó no ocurría nunca.

De ahí sale la regla que ya vale para lo que queda: **un criterio que se cumple casi siempre no es un criterio**. Cuando un AC no puede ponerse rojo con un mundo real, no está midiendo nada.

## Verificado con

`bash scripts/qa-tester-run.sh SUITE` → **PASS, 1042 casos, 1039 pasan, 0 fallan, 3 saltados** (`test/reports/SUITE-run-20260808T203056Z.md`). `node test/headless.mjs` en verde. `node test/casting-report.mjs` contra el Overpass local: **127/132**, mundos reales 23/24. `verifica-gherkin` (35 características, 183 casos) y `verifica-flujo` (40 pantallas, 83 aristas) en verde.

**Sigue sin ejecutarse ni un flujo `@app`**, y ahora no es por falta de Maestro —está instalado— sino porque `test/app/` está vacío: B1 y B2 son núcleo entero. El primero llegará con B4.

# 10 de agosto de 2026 — El checklist entero

Las **42 filas en `done`**, ninguna bloqueada. La suite pasa de no existir a **2597 casos, 2594 en verde, 0 rojos, 3 saltados**. El detalle de cada fila está en `pipeline/state.json` y los veredictos en `pipeline/decisiones-orquestador.md`; aquí va lo que merece quedar.

## Lo que hay

El juego entero corre en Node, sin red y sin dispositivo: arranque de siete pantallas, mundo generado por celdas y congelado, catálogo de treinta plantillas casteadas contra el mundo, motor de pasos con los kilómetros como reloj, rumores que se deforman por saltos, NPCs perezosos, rango y oro y objetos, diario que registra lo oído, salida de puerta a puerta con llegadas por geofence y telón, segundo mapa, exportar e importar, y empezar de nuevo. La app existe en Expo con Skia y el mapa se levanta dentro del móvil en **3222 ms sobre 60 000 de presupuesto**.

## El día que 2583 pruebas en verde no significaban nada

Con las 42 filas cerradas monté la partida completa de punta a punta, igual que al cerrar B2. **Ninguna aventura se podía terminar.**

El último beat de un lazo cae **siempre** en un sitio ya visitado —el lazo es cerrado por diseño, es la mitad del juego— y la validación de llegada lo descartaba **en silencio**. Medido: **27 de 27, 12 de 12 y 28 de 28** aventuras de `costero`, `barrio-tres-calles` y `urbano-denso`. **El 100 %.** Toda aventura acababa a medias, con cierre en corto, cero oro, cero objetos, sin rumor y sin mote.

Con él salieron cuatro cableados que faltaban: nadie componía el desenlace; la lista de hoy ofrecía los mismos tres títulos el día 1 y el día 6; el propagador de rumores solo corría dentro del prólogo, así que **la noticia de la jugadora no salía del pueblo**; y dos beats dentro del mismo geofence resolvían fuera de orden y **reventaban en mitad de la salida**.

Están los cinco cerrados —**102 de 102 aventuras terminan**— y la prueba que faltaba escrita: recorre las 102 y **se pone roja con el defecto viejo**.

## La forma de fallo que salió siete veces

`pipeline/decisiones-orquestador.md` §6h la bautizó: **una pieza que, al no estar, no protesta**. Volvió en el informe de casting que no pedía el callejero y llevaba semanas midiendo un mundo que nadie juega; en un requisito **cumplido de forma vacía** —el prólogo componía su par y ninguna aventura pasaba por él—; en el criterio duro de arrancar sin `node_modules`, roto sin que nadie se enterara con 67 casos que no se descubrían; y tres veces más.

De ahí salen las dos reglas que gobernaron el resto: **un criterio que se cumple casi siempre no es un criterio**, y **lo que falta se exige y su ausencia es error de construcción**, nunca un valor por defecto.

## Lo que no se ha verificado, y va sin enterrar

**Ni un flujo `@app` se ha ejecutado.** Hay **13 escritos** en `test/app/` y **cero corridos**: Maestro está instalado pero no hay simulador —sin Xcode completo ni SDK de Android—. El runner lo registra como infraestructura ausente y nunca como verde, que era el punto, pero conviene decirlo claro: **de los 2597 casos, ninguno ha tocado un dispositivo**.

Y con eso, todo lo que solo se ve en pantalla sigue sin revisar: la paridad visual de los cinco estilos, la fluidez del render, el háptico desde el bolsillo, los gestos, y el minuto medido en un dispositivo de referencia que el repo **no declara en ningún sitio**.

## Verificado con

`bash scripts/qa-tester-run.sh SUITE` → **PASS, 2597 casos, 2594 pasan, 0 fallan, 3 saltados**. `node test/headless.mjs` en verde. `verifica-gherkin` (36 características, 191 casos) y `verifica-flujo` (40 pantallas, 83 aristas) en verde. Y la partida completa jugada de punta a punta en Node, que es la que encontró lo que las otras no veían.

---

## 10-ago-2026 · El emulador, y las cuatro capas que había debajo

La app llevaba dos filas enteras de pantallas escritas y **ni un flujo `@app` ejecutado**: no había simulador en la máquina. Se montó uno —`wa-pixel`, Android 15 (API 35), la app compilada e instalada, Metro sirviendo el bundle, el proxy ciego detrás— y se ejecutaron los dieciséis. Lo que salió es la mejor demostración que tiene este proyecto de por qué una suite verde no basta.

**Lo primero, y no es un detalle: el mapa se pinta en el teléfono, y se pinta bien.** *Reinos da Lúa Rota* sobre Skia, con la costa, las calzadas cosidas, once rótulos sobre placa, el marco y la brújula. La tubería entera corre dentro del móvil.

**Y debajo, cuatro defectos en fila, cada uno tapando al siguiente**, ninguno visible desde Node:

1. **Reanimated sin declarar.** Skia lo declara como par *opcional* y lo exige al importarse. La app compilaba, instalaba y moría al abrir con `[runtime not ready]`. En Reanimated 4 la transformación de worklets se mudó a `react-native-worklets`, así que son dos dependencias y un plugin de Babel, y son una sola decisión.
2. **El área segura que en Android no existe.** El `SafeAreaView` de `react-native` allí es un `View` corriente, y la cabecera del arranque se pintaba **bajo la barra de estado**: el contador «1/5» en `Rect(115,54-169,101)`, invisible para cualquier automatización. Con `AreaSegura`, `[115,182][169,229]`.
3. **LogBox comiéndose el toque, que es el caro.** Cada lámina pintada disparaba seis avisos de obsolescencia de Skia (`addRect`, `moveTo`, `lineTo`, `addCircle`, `addRRect`, `close`), y un `console.warn` en compilación de desarrollo levanta el rótulo de LogBox: una franja al pie —de 2154 a 2274— que **no aparece en el árbol de accesibilidad** y que caía justo encima de «Seguir» en A1P6 (`[63,2183][210,2246]`). La pulsación se perdía. **No se podía pasar del mapa**, ni con Maestro ni a mano; el proceso al 0 % de CPU, sin excepción en logcat, sin segunda ventana. Lo delató que un `wm size` de un píxel destapara A1P7 entera: no era un repintado que faltara, era una franja que se movía. Cerrado donde nace —`caminoDe` pasa a `Skia.PathBuilder` y la app no emite ni un aviso—, que es la misma lección que la vez anterior: un aviso de desarrollo no es cosmética, es una franja que tapa una acción.
4. **La frontera de registro bajo el pliegue.** Con cuatro aventuras en la lista del día uno, «Salir a andar» queda fuera de pantalla; con una, cabe. La pantalla es un `ScrollView` y la persona baja: quien no bajaba era la prueba. Una prueba que solo pasa cuando el reparto es corto convierte la longitud del casting en su resultado.

Con los cuatro cerrados, **el arranque se recorre entero y sale a la portada**: A1P1 → nombre → tramo → permiso → dónde se levanta → generación → mapa → primera aventura → salir a andar → portada → lo que hay hoy.

**Y el hallazgo de contabilidad, que vale tanto como los defectos.** El runner cantaba «16 ejecutados, 13 pasan, 3 fallan». Lo delató el reloj: los trece verdes tardaban **9-10 s** y los rojos **más de un minuto**. Los trece solo ejecutaban una guarda que comprueba que su pantalla **sigue sin existir** —B5 y B6 no tienen navegación en `app/`, y desde SPEC-027 al andamiaje ya no se llega—. Es honesto lo que dicen; lo deshonesto era sumarlo en la misma casilla que un verde de verdad: §6h otra vez, ahora con una pantalla entera como pieza que al faltar no protesta. Ahora los flujos se declaran con `# @limite-declarado`, una prueba de núcleo fija **la lista exacta** para que marcar sea un acto deliberado, y el runner tiene **un cuarto estado**: *ejecutados · pasan · fallan · solo comprueban su límite*. El número de hoy: **16 ejecutados, 2 recorren la app y pasan, 2 rojos —uno real, `zurron`, porque no hay puerta a los ajustes, y uno por caída de `adb`—, 12 de límite declarado.**

Dos cosas más, pequeñas y ciertas. **`node --test test/nucleo/` no funciona en Node 24** —trata el directorio como fichero y falla con `MODULE_NOT_FOUND`—: `CLAUDE.md` y el `README.md` llevaban tiempo publicando un comando que no arranca, y ahora nombran la forma que sí (enumerar los ficheros, que es lo que hace el runner). Y **el botón atrás del sistema no está decidido**: `docs/flujo.md` no declara vuelta de «Lo que hay hoy» a la portada, y pulsarlo allí se lleva la app entera y deja la raíz vacía. Queda anotado en `docs/pendientes.md`, porque en Android el botón existe siempre y no decidir es decidir que salga del juego desde cualquier pantalla.

## Verificado con

`bash scripts/qa-tester-run.sh SUITE` → **@nucleo 97 ficheros, 2603 casos, 2600 pasan, 0 fallan, 3 saltados**; **@app 16 ejecutados · 2 pasan · 2 fallan · 12 de límite declarado**. `maestro test test/app/arranque.yaml` en verde de punta a punta, dos ejecuciones seguidas, sobre `wa-pixel`. Y el mapa de A1P6 mirado con los ojos, que para el pintado no hay sustituto.

# 10-ago-2026 (XXVIII) · La primera puerta de B6, y las cinco cosas que había detrás

Se cablea la navegación de consulta —la fila 43—, y al hacerlo se destapan cinco huecos que ninguna prueba de Node podía ver. La entrada es larga porque el trabajo entregado es la parte pequeña de lo que ocurrió: lo que más vale de este día es lo que se midió.

## Lo que se decidió antes de tocar nada

`pipeline/decisiones-orquestador.md` §6y. Había dos maneras de bajar la columna de doce flujos de límite declarado: devolver la tira de pasos provisionales a un sitio alcanzable, o cablear el recorrido que `docs/flujo.md` declara y hacer que los flujos entren por donde entra una persona. Se eligió lo segundo, por el patrón que más caro ha salido en este repo —§6h, una pieza que al no estar no protesta— y porque una puerta de servicio que solo abre la prueba es exactamente eso. Con un matiz declarado: el andamiaje y el mapa suelto **no son pantallas del juego**, no están en `docs/flujo.md` y no pueden estarlo, así que su puerta correcta es una puerta de desarrollo, como ya lo es `paso-revision-render`.

Y una asimetría que apareció al mirar: `verifica-flujo.mjs` compara el diagrama contra los HTML de diseño, así que caza una pantalla dibujada que falta en el diagrama pero **no una pantalla que el código tiene y el diseño no**. Por ahí se coló `app/pantallas/ofrecimiento.jsx` entero, de la fila 41. Queda propuesto como nodo, no añadido: eso es cambio de diseño.

## Lo que se implementó

`app/pantallas/consulta-montado.jsx`, el punto de montaje del momento de consulta, hermano de los del arranque y de antes de salir: junta la composición del núcleo con las piezas de la app y, si algo no se puede cablear, **enseña la avería con la pieza nombrada** en lugar de dibujar una lista vacía. Y en `App.js`, las tres puertas del pie de la portada pasando a llevar a algún sitio: el diario, la repisa, los ajustes, y de ahí a empezar de nuevo. El atrás de Android hace lo mismo que el «‹» de cada pantalla, porque que discrepen es un defecto de plataforma y no una decisión.

Un arreglo que salió del emulador y no de ninguna prueba: **el personaje que cerraba el arranque no entraba en el área `personaje` del estado**, vivía en una propiedad hermana. No se notaba mientras nadie la leía; A6P7 la lee, y la partida no tenía nombre. Como el área es lo que se congela y lo que se exporta, una partida guardada habría salido sin nombre sin que nada protestara.

## Los cinco huecos, que es lo que de verdad pasó este día

1. **La partida no se guarda nunca.** `congelaEstado` y `levantaEstado` no se llaman desde ningún sitio de `app/`: el estado se crea con `estadoInicial` en cada arranque y vive en memoria. De los cuatro prefijos de `PREFIJOS_DE_LA_PARTIDA` la app escribe tres, y `partida/` no lo escribe nadie. Se pierden diario, repisa, oro, motes, aventuras, entregas, rumores y NPCs al cerrar. Y **una copia exportada hoy sale sin documento de partida**: el respaldo funciona y no respalda nada de lo jugado. Fila 47, con `test/nucleo/partida-persistida.test.mjs` en rojo hasta que se cierre.

2. **Cancelar la hoja de compartir borra la partida.** Medido: se toca «Guardar una copia primero», se abre la hoja del sistema, se cancela con atrás, y la app queda en A1P1 con todo borrado. La rama que protege el caso existe y está probada; lo que falla es la señal que la alimenta —`Share.dismissedAction` es de iOS y en Android la hoja resuelve siempre como compartida—. §6h otra vez: la guarda está y nada la dispara. Aislado en `test/app/empezar-de-nuevo-copia.yaml`, cuyo rojo es correcto.

3. **La app no tiene módulo de ubicación.** `app/package.json` no declara ninguno; los contratos esperan el nativo inyectado y reciben el «sin montar». Por eso A1P4 funciona cayendo a elegir el punto a mano, y por eso no hay geofences, ni llegadas, ni posición en marcha: **B5 entera**. Fila 48.

4. **A4P3 y A5P1-A5P4 nunca se escribieron.** SPEC-034 y SPEC-036 son las dos únicas filas de B5 y B6 que no tocaron ni un fichero de `app/`. Siguen en `done` —entregaron el paquete con sus pruebas— y el checklist ya lo dice. Fila 49.

5. **El zurrón no es navegación.** Necesita la fuente nativa de salud, el motor de pasos montado y el registro de hechos de la partida, y ninguna de las tres sirve sola. Fila 46, y `SPEC-043-iter-1` lo saca de la 43 en vez de dejar un zurrón que aparece, se cierra y vuelve.

## El número que mide el patrón

Se contó cuántas de las dieciséis filas de B5 y B6 entregaron solo núcleo: **dos**. Ese número dice poco. El que dice algo sale del cierre transitivo de imports desde `App.js`: **pantallas escritas en `app/pantallas/` a las que no llega ni un import, 12 de 32 antes de esta fila y 8 después**.

Es decir: el defecto sistemático no era que las filas no entregaran pantalla —doce de dieciséis la entregaron— sino que **una fila podía entregar una pantalla y darse por hecha sin que nadie pudiera abrirla**. Eso ya no puede volver a pasar en silencio: `test/nucleo/pantallas-huerfanas.test.mjs` fija el recuento y falla si sube.

## Los defectos de prueba, y por qué salieron todos juntos

Cinco, y los cinco del mismo origen: **estos flujos no se habían ejecutado nunca**. Una fila de interruptor no pinta su valor, así que `assertVisible: 'no'` no podía pasar en ninguna máquina. «Se borrará» no existe en el repositorio y las dos pruebas se contradecían. **Maestro casa el texto entero de un nodo, no subcadenas**, y seis afirmaciones sobre trozos de párrafo iban sin comodines. La línea de espera de la copia la tapa siempre la hoja del sistema. Y «Seguir» es el botón propio de A1P1, que `arranque.yaml` afirma presente. Los cinco corregidos **explicando el motivo en el propio fichero**, que es la regla.

## Verificado con

`maestro test test/app/ajustes.yaml` → **EXIT=0, 131 comandos**, sobre `wa-pixel`. `test/app/empezar-de-nuevo.yaml` → **EXIT=0, 130 comandos**. Recorrido a mano de las tres puertas y la vuelta: portada → diario → repisa → ajustes → empezar de nuevo → dejarlo → ajustes → atrás → portada. Batería de núcleo: **2609 casos, 2603 pasan, 3 fallan, 3 saltados** — y los tres rojos son la guarda de la fila 47, puesta a propósito. `@app`: **la columna de límite declarado baja de 12 a 11**, con dos flujos saliendo de ella y uno nuevo entrando (`ajustes-filas-de-valor.yaml`, porque las cinco filas de valor de A6P6 no tienen pantalla de elección).

Dos flujos verdes es poco al lado de los doce que el encargo esperaba. Es el número honesto: **de los doce, solo cinco estaban bloqueados por navegación**, y los otros siete piden un módulo nativo, dos pantallas que no existen y un documento de partida que nadie escribe. Decirlo con el número delante vale más que la columna a cero.

# 10-ago-2026 (XXIX) · La puerta de desarrollo, y tres flujos más que recorren

La fila 45, que es la más barata de las tres de B7 y la que más columna baja. El andamiaje —la sonda de las cuatro capacidades— y el mapa suelto llevaban desde SPEC-027 sin puerta: la app abre en el arranque y a la tira de pasos provisionales no se llegaba por ningún sitio.

**Lo que se decidió:** no son pantallas del juego, no salen en `docs/flujo.md` y no pueden salir, así que su puerta correcta es una **puerta declarada de desarrollo** —`walkingadventure://desarrollo`—, inerte en producción y sin persistir nada, como el gancho de capacidades. La distinción que la justifica está en §6y y conviene tenerla a mano: *verificar una pantalla del juego por una puerta que ningún jugador usa es deuda; verificar una herramienta de desarrollo por la puerta de desarrollo es la puerta correcta*. Lo que decide el caso es si lo que hay detrás sale en el diagrama.

**Anfitrión propio y no el del gancho**, y esto merece anotarse porque fue una tentación: reutilizar `walkingadventure://andamiaje` habría sido una línea. No se hizo porque `test/nucleo/plataforma.test.mjs` fija que ese enlace **sin parámetros no hace nada**, y darle un segundo significado obligaba a ablandar esa prueba para abrirse camino. Son dos módulos, se apagan con la misma llave y hacen cosas distintas.

**Cuatro defectos de prueba más**, los cuatro del mismo origen que los cinco del día anterior —estos flujos no se habían ejecutado nunca— y uno de ellos con una lección que se repite: el enlace se entregaba **antes de que el puente de JavaScript existiera**, porque con `clearState: true` el arranque en frío tarda unos veinte segundos, y `Linking.addEventListener` hasta entonces no está. Esta vez sí era espera, y se arregla como tal.

El más instructivo: `assertNotVisible: '.*\d+\s*(km|m|min|pasos|%).*'` —la ausencia de cifras, que es un criterio de diseño real— casaba **«la fila 42 monta»**, porque la eme no llevaba frontera de palabra. Una ausencia que se pone roja por una palabra que empieza por eme no está midiendo lo que dice medir.

Y la guarda de identificadores de SPEC-026 hubo que ensancharla, porque `mapa.yaml` ahora atraviesa la puerta para llegar al mapa. Se le añaden **los dos del camino y ninguno más**, no «los del andamiaje» en general: sigue rechazando cualquier otro selector ajeno a la pantalla.

## Verificado con

`maestro test` sobre `wa-pixel`: **`andamiaje.yaml` EXIT=0 (20 comandos)**, **`gancho-capacidad-ausente.yaml` EXIT=0 (22)**, **`mapa.yaml` EXIT=0 (51)** — este último levanta un mundo de verdad y lo pinta. Batería de núcleo: **2609 casos, 2603 pasan, 3 fallan, 3 saltados**, y los tres rojos siguen siendo la guarda de la fila 47.

**La columna de límite declarado baja de 12 a 8.** Los ocho que quedan no están bloqueados por navegación: seis esperan el módulo de ubicación (fila 48), uno la pantalla de elección de los ajustes (fila 38) y uno el documento de partida (fila 47).

# 10-ago-2026 (XXX) · La partida se guarda, y lo que se ve al medirla de verdad

La fila 47, que es la más grave de las que quedaban: **la partida no se guardaba nunca**. `congelaEstado` y `levantaEstado` llevaban desde SPEC-016 escritos y probados de arriba abajo, y no los llamaba nadie desde `app/`; cada arranque construía `estadoInicial({ semilla })` y ese estado se moría en la memoria de React. De los cuatro prefijos de `PREFIJOS_DE_LA_PARTIDA`, la app escribía tres. Confirmado antes de tocar nada: `grep` sobre `app/` no devolvía ni una cita de las dos funciones, ni una línea que escribiera bajo `partida/`.

## Lo que se decidió

**Cuándo se congela: cuatro momentos y ninguno más.** Al nacer la partida —al cerrarse el arranque—, al volver de una pantalla de consulta, al echarse a andar, y cuando la app pasa a segundo plano. Los tres primeros son cortes del juego; el cuarto es la red que cubre lo que ninguno cubre, porque a una app la mata el sistema sin avisar y no hay ningún evento de «me van a matar». No se congela en cada cambio de estado, que es escribir en disco a cada paso.

**Y por eso congelar tiene que ser idempotente.** El texto canónico del estado es el sello: si no ha cambiado desde la última congelación, no se reescribe nada. Es lo que permite colgar la congelación de tantos sitios sin pagarlo, y es el uso real de `congelaEstado` dentro de la app —el que no está escondido dentro de `guardaPartida`—. Medido: congelar dos veces seguidas escribe una, y abrir la partida y congelarla acto seguido no escribe nada.

**Un documento que no se puede leer da la cara y no se degrada.** Aquí no se cae nunca a `estadoInicial`: una partida que se pierde y se parece a una que empieza es la degradación silenciosa más cara que este proyecto puede hacer, y es la misma regla que SPEC-040 aplicó al borrado a medias. Tampoco se reconstruye desde el registro por iniciativa propia, que es lo que `reconstruccion.js` prohíbe por escrito. La avería ofrece **abrir una copia y nada más**: ni «continuar», ni «empezar de nuevo». No entra en `docs/flujo.md` —no es una pantalla del juego sino la app confesando un fallo, que es el registro que `lenguaje.md` reserva para esto— y su texto definitivo sigue siendo el pendiente 3 de `partida-guardada.md`.

**Migrar ocurre al abrir, una vez, y se levanta antes de escribirse.** `levantaEstado` y `levantaRegistro` se llaman sobre el documento migrado **antes** de sustituir al bueno: uno que no se puede levantar se descarta entero. Y la cadena y la versión de destino entran por la firma, que es la mitad del diseño de `migracion.js` (§6o): sin eso, «la migración funciona» se cumpliría siempre por no haber nada que migrar, con la versión de formato todavía en 1.

**El mapa que se levanta al volver es el primero por identificador**, y es una limitación declarada: cuál es el activo lo decide dónde estás (RF-PERS-007) y eso pide el módulo de ubicación, que es la fila 48. Con un solo mapa —toda partida que no ha viajado— las dos reglas coinciden, y es la misma que la exportación ya usa para nombrar el fichero.

## Lo que se implementó

`app/datos/partida-guardada.js`, con el generador inyectado como manda §6u, y `app/mapa/mundo-guardado.js`, que lee el documento del mundo sin red y sin pintar nada —el hermano pobre de `levantamiento.abre`, a propósito: aquel monta traedor, proxy, atestación y Skia porque tiene que poder generar; esto solo lee—. En `App.js`, la entrada deja de ser siempre el arranque: se abre lo que hay en disco antes de pintar nada, con una superficie de espera en medio para que «no hay partida» y «todavía no se sabe» no se vean igual.

Y una invariante que se cierra por contrato en vez de por vigilancia: **todo lo que esta orquestación escribe cuelga de `partida/`**, comprobado en un envoltorio del almacén por el que pasa también `guardaPartida`. Una clave de la partida escrita fuera de ese prefijo no entraría ni en la copia ni en el respaldo, y nadie la echaría de menos: es §6h un nivel más abajo.

## Verificado con

`maestro test test/app/partida-persistida.yaml` sobre `wa-pixel` → **EXIT=0 (1 m 24 s)**: arranque entero, portada, `stopApp` + `launchApp` **sin `clearState`**, y vuelve a la portada y no al arranque; dos veces seguidas. Y el documento está en el dispositivo: `adb run-as` enseña `files/partida/partida/estado.json` y `registro.json`, con 23 áreas, el personaje entero —nombre, oficio, tramo declarado de 1200 m— y los ajustes. Pasa `sinRastroDeUbicacion` y se levanta con `levantaEstado`: 26 campos.

**La copia, con la partida real del emulador y no con una sintética.** Se sacó el directorio con `adb`, se exportó y el manifiesto trae `partida/estado.json`, `partida/registro.json` y el mapa —5 documentos, 1 mapa—; importado en un almacén limpio, la partida vuelve con su personaje (Sabela, taberna), su semilla (`NB6ACDFA58P47C9X`) y su mapa, «Reinos do Solpor». Es lo que la fila 39 prometió y no podía cumplir.

**Una partida que el juego no entiende da la cara, medido en pantalla.** Se le puso `version: 9` al fichero del emulador con `adb` y se relanzó: *«Tu partida guardada no se ha podido abrir»*, el motivo literal —*«el documento partida/estado.json está escrito en la versión de formato 9 y esta versión del juego entiende la 1: no se abre»*—, «Abrir una copia», y ni arranque ni portada ni ninguna acción que borre. Restaurado el fichero bueno, vuelve a la portada.

Batería de núcleo: **2634 casos, 2631 pasan, 0 fallan, 3 saltados**. Los tres rojos de `partida-persistida.test.mjs` se apagan **por el cableado**, sin tocar la prueba. `@app`: **19 flujos, 8 pasan, 2 fallan, 9 solo comprueban su límite**.

## Los números que no salen como el encargo esperaba, dichos con la cifra delante

**La columna de límite declarado no baja: sigue en 9.** Y de paso, la entrada anterior dice que quedó en **8**; contados los ficheros con el marcador, son **9**. Ese número estaba mal.

El único que esta fila podía desbloquear era `repisa.yaml`, y no puede pasar, porque **hoy nada de `app/` altera el estado de la partida después de que el arranque se cierre**. Medido leyendo la fuente: las cuatro pantallas de consulta solo leen; el único interruptor que escribiría —los pasos de fondo, que llaman a `cambiaAjuste`— recibe su callback a `null` porque `App.js` no monta el zurrón (fila 46); y quien emite hechos —llegadas, escenas, telón— espera al módulo de ubicación (fila 48) y a las dos pantallas que nunca se escribieron (fila 49). La repisa de cualquier partida del dispositivo son dos líneas y el oro.

Así que lo que sobrevive hoy y se puede afirmar es **el personaje, la semilla, los ajustes y el mapa levantado**, y no una entrada de diario ni un objeto en la repisa. Medir la persistencia con un diario que nadie escribe sería medir el vacío.

**La siembra queda fichada y no estirada.** El documento sembrado lo produce el núcleo jugando N días en headless —`partidaCompleta` ya lo hace—, pero para que llegue al dispositivo hace falta o una puerta que lo importe o una vía de desarrollo que lo escriba, y las dos son diseño. Y hay un argumento contra la segunda que ya está escrito en §6y: *verificar una pantalla del juego por una puerta que ningún jugador usa es deuda*. La repisa es del juego.

## Lo que la fila rompió, y se arregló diciéndolo

**`mapas.yaml` declaraba como límite algo que esta fila deja de ser cierto.** Decía que la app abre en el arranque; desde que la partida se guarda, abrir con una partida en disco lleva a la portada, y con `clearState: false` su guarda afirmaba `arranque` visible y fallaba. Reproducido tres veces —las dos primeras se las llevó la caída de `adb`, la tercera llegó a la aserción—. Lo que le falta a ese flujo no era nunca la puerta: son dos mapas y el ofrecimiento cableado. Se corrige de qué depende su entrada, con la medida escrita en el propio fichero.

Y de paso, `diario.yaml` y `repisa.yaml` llevaban desde la fila 43 diciendo que «no hay ninguna puerta que lleve hasta ella», que es falso desde que la portada tiene sus tres puertas. Corregido el motivo en los dos, sin tocar la guarda: el identificador que miran no existe ni va a existir, así que lo que decían era verdad; lo que mentía era el porqué.

**Y un tercero, que no es de esta fila y salió porque la tanda se repitió: `assertNotVisible: 'Sabela'` no medía lo que decía medir.** La tanda salió roja con «Assertion is false: "Sabela" is not visible», y la pantalla donde falló era A1P1, que es donde el arranque **sortea cuatro sugerencias de nombre**. En la ejecución siguiente salieron Aldara, Xela, Froilán y Airas y la misma línea pasó. Por partida doble, además: `arranque.yaml` tampoco escribe el nombre —el campo llega relleno con una sugerencia sorteada—, así que «Sabela» ni siquiera era el nombre del personaje que se borraba. Es la misma forma que el `.*\d+\s*(km|m|…)` de la fila 45: una ausencia que se pone roja por una palabra que no tiene nada que ver. Se quitan las dos líneas y la del título del mundo, que se sortea igual.

En su lugar, ese flujo pasa a afirmar algo que **antes de esta fila no significaba nada**: que después de borrar, volver a lanzar la app lleva al arranque y no a la portada ni a la avería. Con la app abriendo siempre en el arranque, esa comprobación era vacía; ahora dice que el borrado se llevó también el documento de partida.

**Los otros dos rojos de `@app` son anteriores y siguen fichados.** `empezar-de-nuevo-copia.yaml` es el de la entrada XXVIII —`Share.dismissedAction` es de iOS y en Android la hoja resuelve siempre como compartida—, y `zurron.yaml` busca `paso-ajustes`, que no existe en `app/` ni en `main`: es de la fila 46.

## Y la caída de `adb`, que esta vez se pudo separar de un fallo de verdad

La bitácora la describía como «un flujo por tanda, siempre distinto, en menos de un segundo y sin mensaje de aserción». Esta noche apareció **cuatro veces seguidas en el mismo sitio** —el último `launchApp` de `gancho-capacidad-ausente.yaml`—, que es justo lo que la haría indistinguible de un defecto determinista. Separarla costó cuatro medidas y merece quedar escrito el método:

1. El log de Maestro dice `device offline` y `DeviceServerDied`, nunca una aserción fallida.
2. Relanzar la app **a mano** con `adb shell am start` funciona: sale A1P1 con su contador en 1/5 y logcat no trae ningún `FATAL`.
3. Con el emulador ya recuperado, `partida-persistida.yaml` —que hace **dos** ciclos de `stopApp` + `launchApp`— sale verde, y `andamiaje.yaml` también. No era el emulador en general.
4. Y el mismo flujo, sin tocar una línea, sale **EXIT=0** al quinto intento.

5. Y la medida que lo cierra: **el mismo flujo falla 3 de 3 en `main`**, con el cambio de esta fila fuera del árbol y el mismo `device offline` en el log. Lo que degradó es el emulador —lleva diecisiete horas levantado—, no el código.

Un rojo que se repite en el mismo punto no basta para llamarlo determinista si el mensaje no es una aserción. Cuatro veces seguidas casi lo convierte en una fila nueva que no existe, y el experimento que lo evita es barato: **sacar el cambio del árbol y volver a medir**.

Corolario para el runner: `device offline` va al `maestro.log` y **no a la salida estándar**, así que el report literal enseña un flujo rojo sin ninguna aserción y sin ningún motivo. Quien lea un report con un rojo mudo tiene que ir al log antes de atribuirlo a nada.

## Un defecto que destapó la prueba

Migrar leía el registro de hechos **antes** que `cargaPartida`, y era más estricto que él: un registro ilegible impedía abrir una partida perfectamente jugable, cuando el núcleo lo tolera por diseño —lo que se pierde es la red de seguridad, no la partida—. Corregido: el registro que no se puede leer se salta al migrar, y `cargaPartida` lo declara.

Y una fragilidad que se vio de paso y no se toca aquí: **el registro de esquemas de `formato.js` se llena por efecto de importar cada módulo**. Validar una copia sin haber importado `onboarding.js` falla con «clase de documento desconocida "arranque-en-curso"». En la app no ocurre porque `arranque-montado.jsx` lo importa, pero es una dependencia por efecto secundario que un día morderá.

# 11-ago-2026 (XXXI) · La app sabe leer el GPS, y el rótulo del sistema deja de ser un comentario

## Lo que se decidió

Entran **dos dependencias y ninguna más**, `expo-location` y `expo-task-manager`, autorizadas por el dueño del proyecto. Con ellas se cablean los tres contratos que llevaban escritos, probados contra dobles y **sin llamador** —`app/plataforma/ubicacion.js`, `app/plataforma/posiciones.js` y `app/marcha/seguidor.js`— más `creaRotulo` de `app/plataforma/rotulo.android.js`, y con el rótulo montado se llama por fin a `packages/nucleo/partida/salidas.js`, que esperaba desde SPEC-030.

**Una sola suscripción al sensor por salida**, y de ella cuelgan la fuente, el detector y el seguidor. No es purismo: en Android el servicio en primer plano **es** el rótulo, así que pedir posiciones y poner la notificación persistente son la misma llamada. Dos suscripciones darían dos series de marcas para el mismo instante y la traza clasificada dejaría de cuadrar con el plazo.

**La cadencia va por distancia** —diez metros— y no por tiempo, porque lo que se mide son metros propios. **Y la precisión es alta y no equilibrada**, que es una decisión que el encargo no preveía: `transporte.js` no funda un vehículo con más de treinta metros de error y la equilibrada entrega cien, así que con ella ningún segmento habría salido nunca `vehiculo` y la detección de transporte habría quedado escrita y muerta.

## Lo que se implementó

`app/marcha/salida.js` orquesta la vida de una salida con el generador inyectado desde `app/nucleo/piezas.js`, y `app/marcha/salida-montada.js` es lo único de la fila que importa de Expo. El hueco del telón vive en `App.js` con una sola acción, como `pantallas/llegada.js` resuelve la escena que no existe. La marca de posición pasa a pintarse **en el sitio del mundo donde estás** y no en el centro de la pantalla: clavada en el centro no se movía nunca, que es indistinguible de estar quieta.

La guarda de fondo se reexpresa en vez de aflojarse: `expo-task-manager` sale de `MODULOS_DE_FONDO_QUE_NO_SE_MONTAN` y entra `TAREAS_QUE_LA_APP_DEFINE`, enumerada una a una, con `exigeTareaDeclarada` haciendo que registrar una sin declararla sea error de construcción. Y queda escrita `app/plataforma/contratos.js`, la lista de contratos sin llamador con dueño por entrada: poner llamador arregla los cuatro casos de hoy, la lista es lo único que arregla el de mañana.

## Verificado con

Emulador `wa-pixel`, API 35, mundo `G39DCH40H6A7ZD8G@42.40,-8.81#0,0` («Reinos da Brétema»), generado desde A1P4 con la posición que entregó el sensor.

- **El diálogo del permiso es solo el de «mientras se usa»**: sale con «While using the app», «Only this time» y «Don't allow», y **no ofrece «Allow all the time»**. Concedido, A1P4 abre con `punto-pin` en `42.402,-8.809`, que es lo que dio el sensor y no el punto por defecto de la app.
- **El rótulo, leído con `dumpsys notification`**: canal `com.walkingadventure.app:salida-abierta` con `importance=2` —baja—, notificación con `NO_CLEAR` —no se tira deslizando—, título «Walking Adventure» y línea **«Andando por Reinos da Brétema.»**, sin una cifra y compuesta por `partida/rotulo.js`. Sin ninguna acción, y eso es el límite de la fila (más abajo).
- **El servicio en primer plano**, con `dumpsys activity services`: `isForeground=true`, `types=0x00000008` (ubicación).
- **La posición se mueve y el detector clasifica.** A paso de andar —12 diezmilésimas de grado de longitud cada ocho segundos, unos 4,5 km/h— la marca recorre `x = 342 → 358 → 368 → 388 → 398` metros del mundo y sale **`andando`**. A velocidad de vehículo sostenida —73 diezmilésimas cada seis segundos, unos 36 km/h— sale **`ambiguo`** durante el minuto de confirmación y **`vehiculo`** a partir de ahí, que es exactamente lo que `CONFIRMACION_VEHICULO_S` declara. Bajando después a 15 km/h **sigue en `vehiculo`**, que también es correcto: salir del vehículo pide estar por debajo del umbral de andar dos minutos, y quince por hora no lo están.
- **La salida sobrevive a cerrar la app y a reiniciar el móvil**: al reabrir, la portada enseña `salida-situacion = abierta-con-rotulo`, `rotulo-estado = puesto` y la tarjeta de a medias con sus dos acciones.
- **El manifiesto generado y el paquete instalado**: `ACCESS_BACKGROUND_LOCATION` cero apariciones, `SCHEDULE_EXACT_ALARM` cero. En `Info.plist` la única clave de ubicación sigue siendo `NSLocationWhenInUseUsageDescription` y los modos de fondo siguen siendo exactamente `["location"]`.

## El defecto que sí era de esta fila: `fetch` en los modos de fondo de iOS

Y uno que no es un hallazgo sobre el terreno ajeno sino **un defecto que metió esta fila**, encontrado al revisarla. El config plugin de `expo-task-manager` empuja `fetch` en `UIBackgroundModes` **incondicionalmente** (`plugin/build/withTaskManager.js:8-14`), así que el `Info.plist` generado salía con `["location", "fetch"]` mientras `app.json` declaraba solo `location`. Lo que eso significa lo dice el comentario de `MODOS_DE_FONDO` en `permisos.js`: «un `processing`, un `fetch` o un `remote-notification` colados ahí son tarea periódica con otro nombre». O sea que la fila metió en el paquete de iOS exactamente la capacidad que `TAREAS_PERIODICAS = []` existe para impedir, y **no lo vio ninguna prueba porque todas miran `app.json` en lugar de lo generado**. Es §6h con la pieza silenciosa puesta por nosotros.

Se cierra en el mismo plugin, con un `withInfoPlist` que filtra **por lista blanca** contra los modos declarados y no contra una lista de prohibidos: así el día que otra librería empuje `processing` o `remote-notification` se cae sola sin que nadie tenga que acordarse. Verificado regenerando el `Info.plist` desde cero con `npx expo prebuild --platform ios --no-install`: sale **`['location']`** y nada más, y `BGTaskScheduler*` sigue vacío. La lección, que vale para toda guarda de esta familia: **lo que va al binario es lo generado, no `app.json`**, y una guarda que mira el manifiesto de entrada no mide nada.

## Los tres hallazgos que contradicen lo que la fila daba por hecho

**`RECEIVE_BOOT_COMPLETED` ya estaba en el APK, y no lo trajo esta fila.** Lo inyecta el manifiesto de `expo-notifications` al fusionarse, o sea desde SPEC-023. `LO_QUE_NUNCA_SE_DECLARA` lo prohibía y la guarda no lo veía **porque solo leía `app.json`**: el sitio donde hay que mirar es el manifiesto generado, y la promesa llevaba rota casi treinta filas sin que nada protestara. Peor: **tampoco se puede quitar**. `expo-task-manager` programa la entrega de cada posición como un trabajo persistido de `JobScheduler` —`setPersisted(true)` clavado en `TaskManagerUtils.java:205`— y Android exige ese permiso para persistir un trabajo; retirado con `tools:node="remove"`, la app revienta al llegar la primera posición con `IllegalArgumentException: Requested job cannot be persisted`. Medido. Lo que se hace a cambio es cambiar el sustituto por la propiedad: el permiso se declara con su motivo y el plugin `retira-permisos-prohibidos.js` **sustituye el receptor de tareas por uno sin `BOOT_COMPLETED` ni `MY_PACKAGE_REPLACED`**, así que la tarea de ubicación no puede despertarse al arrancar el móvil. Y con precisión, porque el primer comentario que escribí prometía de más: eso cierra la vía de `expo-task-manager` y **no la propiedad entera** — en el manifiesto fusionado sigue vivo el receptor `NotificationsService` de `expo-notifications` con `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` y `MY_PACKAGE_REPLACED`, que es de SPEC-023 y queda fichado.

**El rótulo no puede tener su acción.** La notificación del servicio en primer plano la compone `expo-location` y sus opciones son título, línea, color y si muere con la app: no hay manera de añadirle una acción. «Dar la salida por terminada» desde el rótulo **no se entrega**, y queda declarado en `DECLARACION.loQueNoEntrega` con lo que haría falta —un servicio en primer plano propio en Kotlin— y con lo que hay mientras tanto: tocar el rótulo abre la app, y «dejarlo aquí» sigue entero en la tarjeta de a medias.

**`hasStartedLocationUpdatesAsync` no dice lo que parece.** Dice si la **tarea sigue registrada**, no si el servicio está vivo: tras reiniciar el emulador devolvía `true` con el servicio muerto. Reconciliar con esa respuesta sola dejaba la salida creyéndose sostenida por nada, que es justo lo que `presente()` existe para impedir. Se resuelve juntando las dos: tarea registrada **y** arrancada por este proceso; si está registrada y este proceso no la arrancó, se vuelve a pedir —es idempotente— y solo si eso falla se anota la retirada por el sistema.

## Los dos defectos que la fila se dejó puestos, y que encontró la revisión

**Con la partida abierta desde disco no se podía abrir ninguna salida, y por tanto el momento en marcha solo funcionaba el primer día.** `cargaPartida` devuelve lo suyo con `congelaHondo`, así que `partidaGuardada.abre()` entregaba un estado **congelado** mientras `nace()` entregaba uno mutable; `abreSalida` muta su área en sitio, y en cualquier sesión que no fuera la del nacimiento salir a andar moría con `TypeError: Cannot assign to read-only property 'salida'` — enseñado tal cual bajo la acción, que además ni es una respuesta del vocabulario cerrado ni algo que nadie pueda arreglar leyéndolo. Es exactamente la forma que la fila 47 dejó escrita: cada lado probado, nadie recorriendo el camino entero. El congelado no se toca —protege que la reconstrucción no se toquetee—: lo que se arregla es la **asimetría**, deshelando lo cargado con el viaje de ida y vuelta del propio núcleo, que valida contra el esquema en los dos sentidos y es la misma operación de cada congelación. Que nacer y cargar den la misma clase de cosa es la propiedad.

**Y seis marcas del momento en marcha caían las seis en `[0,0][3,3]`**, apiladas, y Maestro descarta como invisible todo lo que tapa un hermano: **ninguna de las seis se podía afirmar**. Es la misma forma de fallo que `marca.js` ya arregló una vez pasando de 0×0 a 1×1, reaparecida por apilamiento — arreglar el tamaño y dejar el amontonamiento era arreglar media cosa. `marcaSuperpuesta(n)` aparta cada marca un punto independiente de densidad, y las de un envoltorio van en **su propia fila** porque viven en otro contenedor y no pueden coordinar su número con las de la pantalla que envuelven.

Verificado el ciclo entero en `wa-pixel` con la partida ya en disco: «Dejarlo aquí» cierra la salida y retira el rótulo en la misma transición —servicio en primer plano a cero—, aparece el hueco del telón con `salida-situacion = cerrada-sin-leer`, cerrar y reabrir la app **sigue ofreciendo el telón** y no la portada, «Cerrarlo» lo deja en `cerrada-leida`, y desde ahí «Salir a andar sin más» **abre la salida de verdad**: momento en marcha, servicio arriba, notificación con `importance=2` y `NO_CLEAR`, y la marca moviéndose `1816 → 1828 → 1838` con `andando`. Cerrar y reabrir otra vez la devuelve `abierta-con-rotulo`, que es la prueba de que lo que se muta es el área que la partida congela y no una copia.

## Y una trampa del emulador que costó una hora

`adb emu geo fix` devolvía `OK` y **no movía nada**: un mock de `com.google.android.gms[fused_location_provider]` puesto veintitrés horas antes se re-emitía cada tres segundos con la misma coordenada, y `dumpsys location` lo delataba con la marca `mock` y un `et` que avanzaba sin que cambiaran los grados. `cmd location providers add-test-provider` no vale: `SecurityException: not allowed to perform MOCK_LOCATION`. Lo único que lo arregló fue **reiniciar el emulador**. Y después seguía sin llegar ninguna posición nueva hasta cambiar la precisión de la suscripción a alta: con la equilibrada el GPS ni se enciende —`gps provider: ProviderRequest[OFF]`—, y con la alta aparece `ProviderRequest[@+2s0ms, HIGH_ACCURACY, WorkSource{com.walkingadventure.app}]`. Antes de dar por rota la cadena del sensor, mirar `dumpsys location` y comprobar quién pide el GPS.

## Verificado con

`bash scripts/qa-tester-run.sh SPEC-048` → `test/reports/SPEC-048-run-20260811T080734Z.md`. **`@nucleo`: 103 ficheros, 2683 casos, 2679 pasan, 1 falla.** **`@app`: 19 ejecutados · 9 pasan · 2 fallan · 8 solo comprueban su límite.** Frontera intacta: 114 módulos de `packages/nucleo/` importan en Node sin React Native ni Expo, e idéntico con `node_modules` movido de sitio. **Guarda del manifiesto generado: Android mirado · iOS mirado**, las dos plataformas de verdad y no una.

**El único rojo de núcleo está puesto a propósito y tiene dueño**: «Nada de esta app se despierta al arrancar el móvil», por el receptor `NotificationsService` de `expo-notifications` con `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` y `MY_PACKAGE_REPLACED`. Es de SPEC-023 y no de esta fila, y la guarda nace roja en vez de nacer tolerándolo, igual que la fila 47 hizo con `partida-persistida.test.mjs`.

**Los dos rojos de `@app` son anteriores y siguen fichados**, los mismos dos de la tanda del 10-ago y por los mismos motivos: `empezar-de-nuevo-copia.yaml` —`Share.dismissedAction` es de iOS y en Android la hoja resuelve siempre como compartida— y `zurron.yaml`, que busca `paso-ajustes` y es de la fila 46. Ninguno lo mueve esta fila.

**La columna de límite declarado baja de 9 a 8**, y sale exactamente uno: `en-marcha.yaml`, con **103 s medidos** de recorrido real —arranque, portada, «Salir a andar sin más», salida abierta con rótulo, lámina, marca de posición con su clasificación, arrastre, cerrar y reabrir la app, y «seguir con ella»—. Un flujo que tarda diez segundos no ha recorrido nada; este tarda ciento tres. Los ocho que quedan no los desbloquea esta fila: seis esperan el camino de la llegada (fila 44), uno la pantalla de elección de los ajustes (fila 38) y uno la siembra de una partida con contenido.

Y el número que **no** se movió, dicho con la cifra delante: **las pantallas huérfanas siguen en ocho**. El alcance recortado dejó fuera las seis del momento «al parar», y prometer que bajaban habría sido leer el alcance viejo.

## Lo que esta fila deja abierto, sin disimular

- **El rótulo en iOS no se entrega.** La Actividad en Vivo pide un módulo nativo propio de ActivityKit que estas dos dependencias no dan. `rotulo.ios.js` mantiene su pareja de exportaciones y declara qué no entrega y qué haría falta; el límite tiene prueba, no comentario.
- **«La marca se mueve» no se automatiza en esta máquina.** `adb emu geo fix` no mueve el fijo de forma fiable aquí, así que el escenario va como `@manual` apuntando al recorrido medido, en vez de fingir una automatización que no existe.
- **El permiso de ubicación no llega a pedirse en `wa-pixel`**: la app se instala con los permisos concedidos y `clearState` no los revoca, así que el bloque del diálogo va condicionado y se salta. Lo que sí se afirma sin depender de eso es que el botón de «todo el rato» **no está**, por identificador del `permissioncontroller` y no por texto, que en el emulador sale en inglés.
- **Y el receptor de arranque de `expo-notifications`**, que es el rojo con dueño. Retirar el permiso no es opción —`expo-task-manager` persiste su trabajo con `setPersisted(true)` clavado y sin él la app revienta con `IllegalArgumentException: Requested job cannot be persisted`, medido—, así que queda declarado con su motivo y con la propiedad protegida por otra vía: el plugin le quita al receptor de tareas sus disparadores de arranque. El de notificaciones sigue entero y es de quien monte esa fila.

---

# 11-ago-2026 · SPEC-044, la navegación en la calle: la fila que descubrió que la capa de llegadas no podía dispararse

La fila 44 venía a cablear el camino que `docs/flujo.md` ya declaraba —en marcha, geofence, llegada, visor, lo que allí se cuenta, descarte— porque las pantallas estaban escritas y la capa del núcleo también, y lo único que faltaba era quien las uniera. Lo primero que hizo fue medir una de las cuatro deudas que heredaba, y de ahí salió todo lo demás.

## La deuda que apuntaba al revés, y lo que había detrás

El encargo pedía medir `RADIO_DE_GEOFENCE_M = 40` contra `ERROR_MAXIMO_FIABLE_M = 30` porque «una fracción de las posiciones se descarta por poco fiable justo donde más falta hace». **Es falso, y lo dice la propia fuente**: `transporte.js` declara que *«las posiciones malas no se descartan —eso quitaría metros que sí se anduvieron—: solo dejan de poder afirmar un motor»*. Un fijo malo degrada `vehiculo` a `ambiguo`, y `ambiguo` **valida**. La precisión mala empuja a validar de más, no de menos.

Pero el sitio al que apuntaba escondía lo peor que ha aparecido en todo el checklist. Montada la tubería real —el filtro de cadencia de `plataforma/posiciones.js`, el detector de `transporte.js` y `creaLlegadas().comprueba()` alimentado posición a posición—, con alguien parado 300 s dentro de un geofence y 400 semillas por celda: **con la cadencia por distancia que hay en producción, una llegada valida el 0 % de las veces con GPS perfecto y el 0 % con error de 10 m o más.** Hoy ninguna llegada podía validar en un dispositivo.

Dos causas independientes, las dos confirmadas en la fuente y no solo modeladas. **Parado no llega ninguna posición**: `distanceInterval: 10` es `setMinUpdateDistanceMeters` del `LocationRequest` de Android, un filtro duro, y con GPS perfecto se entrega **un fijo en 300 s**. Y **el ruido del GPS se lee como andar**: `esUnaParada` mide `metros/duracionS < 0,5 m/s` sobre el salto crudo entre dos fijos, así que un ruido de σ metros con fijos a T segundos aparenta ~1,4·σ/T m/s y hace falta **T > 2,8·σ** para que un parado parezca parado.

Es la **duodécima aparición de §6h** y la más cara: SPEC-032 escribió, probó y cerró las llegadas **sobre secuencias de posiciones fabricadas**, y su propia sección de frontera dice «Ninguna entrada nueva de sensor: las dos que hacen falta ya existen». Mil casos en verde sobre una capa que en un teléfono no se dispara jamás.

## Lo que decidió el dueño, y cómo se fijó el número

La medida se le llevó **antes de escribir la spec**, porque el encargo dice que si el número sale feo se escala y no se ajusta una constante por cuenta propia. Decidió **arreglar también la calle**, con el tamaño de la fila advertido.

Anclar y comparar cada fijo contra un ancla no vale, y está medido: «parada dentro» y «de paso a 4 km/h» suben juntas con el radio de quietud —radio 15 m: 98 % de paradas y **36 %** de paseos—, porque con dos o tres fijos en la ventana el ruido y la deriva son indistinguibles. Lo que sí los separa es que **el ruido del GPS es de media cero y la deriva de quien anda no**: la regla nueva mide la **deriva de la ventana**, el centroide de su primera mitad contra el de la segunda, y promediar hunde el ruido como 1/√n dejando la deriva intacta.

Con muestreo cada 5 s y 800 semillas por celda: ventana de 20 s con deriva ≤ 5 m valida el 100 % de las paradas hasta σ=10 m y deja pasar un 27,6 % de paseos a 4 km/h; ventana de 40 s con deriva ≤ 8 m valida el 100 % y deja pasar el 0,8 %. De ahí que la regla sea **adaptativa porque la medida lo pide**: con fijo bueno la ventana corta ya separa, así que **los veinte segundos de SPEC-032 se conservan donde el fijo los sostiene** y solo se estiran a cuarenta cuando el error declarado deja de sostenerlos. Alargarla para todos habría contradicho sin necesidad la razón por la que se puso corta: *validar es barato, y un beat que se atiende de paso valida igual*.

**Las dos mitades se exigen a la vez**, y la segunda es la que se pierde sola en cualquier arreglo de ruido: el vehículo sigue apartando la llegada y el atasco sale **0 %** en todas las tandas. **Límite declarado con número**: por encima de σ ≈ 15 m la validación se degrada y por encima de σ ≈ 20 m deja de sostenerse. Cubre la calle normal y no el cañón urbano profundo.

Como esto deroga decisiones cerradas, **el diseño se actualizó y no solo el código**: `SPEC-031-iter-1` (la traza clasificada deja de ser criterio suficiente y pasa a ser veto), `SPEC-032-iter-1` (los veinte segundos se conservan y cambia cómo se mide «parada dentro») y `game-design/bucle-jugable.md` momento 3.

## La decimotercera aparición de §6h, cometida por esta misma fila

Cerrados tres defectos que impedían validar en el dispositivo —los `cupos` que no llegaban por el camino de la partida recién nacida, el `?? null` que convertía «no viene» en «no hay», y una avería que nadie enseñaba porque **nadie consumía `laSalida.averia()`**—, la llegada seguía sin validar. La causa real: **`montaLaSalida` nunca pasaba `montaLlegadas`**. El parámetro se añadió a `creaLaSalida` y a `App.js` y el intermediario se quedó sin él; como «no hay fábrica» se leía igual que «no hay nada que montar», todo lo visible funcionaba y la capa no existía.

Es la misma forma de fallo que la fila venía a cerrar, un nivel más arriba y cometida por ella. Cerrada por contrato donde vive el cableado: `montaLaSalida` se niega a montar la vida de una salida sin la fábrica.

## El diagrama decía que a lo que se cuenta solo se llega por el beat

Al cablear A4P5 apareció que **`docs/flujo.md` no tenía ningún camino hasta esa pantalla que no pasara por la escena de un beat**, y eso contradice a `secuencia.js` —que da ese paso a todo núcleo tenga beat o no—, al escenario «Sin beat, lo que se cuenta es la llegada entera» de `docs/testing.md` y a `quests.md`. El verificador no lo cazaba porque **comparaba nodos y no aristas**: la misma asimetría por la que §6y descubrió a mano que `ofrecimiento.jsx` no tenía nodo. Segunda vez que muerde.

Se corrigió con las **cuatro** aristas que faltaban y con la guarda que las exige: `verifica-flujo.mjs` enumera ahora las 24 secuencias que `secuenciaDeLlegada` puede producir y exige que cada una tenga camino **usando las pantallas de sus propios pasos** —con alcanzabilidad a secas el camino del beat «cubría» la secuencia que no lo tiene, y la guarda nacía verde sobre el defecto que la motivó—. Nació roja con siete casos nombrados.

## Tres vueltas del mismo fallo con las marcas, y la tercera era la esquina

`marca.js` ya había arreglado dos veces que una marca no se pudiera afirmar: primero el tamaño 0×0, después el apilamiento. Esta fila encontró la tercera y **la diagnosticó mal dos veces antes de acertar**: se dio por buena con `adb shell uiautomator dump`, que las entrega, cuando `maestro hierarchy` no y un `assertVisible` falla. Están en el árbol del sistema y no se pueden afirmar; las dos medidas eran ciertas y el error fue verificar con el instrumento que no decide.

La causa no era el tamaño ni el apilamiento: **era la esquina**. Una marca en `[0,0]` de una pantalla a sangre cae bajo la ventana de la barra de estado, y quien lee el árbol descarta lo que otra ventana tapa. Lo demostró comparar dos pantallas del mismo aparato: `momento-antes-de-salir` mide 3×3 px —lo mismo que las que fallaban— y Maestro la entrega, porque el área segura la baja a `y=128`. Y explica por qué `zIndex` y `elevation` no bastaban: el orden del árbol de accesibilidad no es el de pintado.

## Y la prueba que daba por hecho lo que el mundo no garantiza

`llegada.yaml` pasó dos tandas seguidas y falló en la tanda completa, y no era la caída de `adb`: el árbol de Maestro enseñaba `llegada-secuencia = ficha:encadenado` sobre **`SERVICIO · TABERNA — Taberna do Cervo Prateado`**. La llegada había validado perfectamente, en un **servicio**, y un servicio no tiene A4P5. La máquina hacía lo correcto; el flujo daba por hecho que el sitio por el que empieza el mapa es un núcleo, y **el ancla del mapa no es reproducible entre ejecuciones**.

Al arreglarlo aparecieron dos suposiciones más de la misma prueba: que cerrar una llegada devuelve al momento en marcha —falso, porque un núcleo y su servicio caen a pocos metros, **los dos geofences validan en la misma parada** y al cerrar la primera se ofrece la segunda sin pasar por el mapa, que es justo lo que la spec pide y nadie afirmaba—, y una carrera en el bucle que atiende las escenas restantes. El flujo pasa a exigir primero que la pantalla sea **una de las tres formas declaradas** —esa línea es la que impide que las ramas se salten en silencio— y luego afirma cada forma entera, con la **forma de la secuencia** dentro de cada rama y no solo los textos: afirma el dato que produce la capa, no la frase que se pinta con él.

Y por qué no se pudo hacer determinista, que es la deuda que la fila deja fichada con la causa localizada: **el ancla del mapa no la gobierna la posición que el flujo pone**. Con `setLocation` a `42.4000,-8.7700` antes del arranque, el mapa nace en `42.40,-8.76` en dos tandas, cuando `anclaje()` sobre esa coordenada da `42.40,-8.77`. No es que no asiente: es que no se lee de ahí — `app/plataforma/ubicacion.js:122` lee la coordenada del arranque con `getCurrentPositionAsync({ accuracy: Balanced })` y un fijo simulado no manda sobre esa lectura. Durante la salida sí manda, metro a metro. **Mientras el arranque lea así, ningún flujo puede decidir dónde nace el mapa**, y eso es lo único que mantiene `descarte.yaml` en la columna: no es que no haya puerta hasta A4P8 —cuando el sitio de arranque cae en un servicio, `ficha-descartar` está ahí y el flujo lo afirma—, es que no se puede garantizar llegar a ella.

## Verificado con

`bash scripts/qa-tester-run.sh SPEC-044` → `test/reports/SPEC-044-run-20260811T152006Z.md`. **`@nucleo`: 2711 casos, 2707 pasan, 1 falla, 3 saltados.** **`@app`: 19 ejecutados · 10 pasan · 2 fallan · 7 solo comprueban su límite declarado.** Frontera intacta y guarda del manifiesto generado mirando **las dos plataformas**: Android mirado · iOS mirado.

**El único rojo de núcleo es el fichado**: «Nada de esta app se despierta al arrancar el móvil», por el receptor `NotificationsService` de `expo-notifications`. Es de SPEC-023 y no lo mueve esta fila. **Y los dos rojos de `@app` son los dos anteriores y por los mismos motivos**: `empezar-de-nuevo-copia.yaml` (`Share.dismissedAction` es de iOS) y `zurron.yaml` (`paso-ajustes`, fila 46). **Esta fila no añade ni un rojo.**

La llegada recorrida entera en `wa-pixel`, con las coordenadas escritas: mundo `9K81YSDGADXJE3CP@42.40,-8.78`, núcleo **Casal do Muíño Roto do Solpor de Abaixo** (`42.399847, -8.775317`). En marcha con `salida-cadencia = por-distancia`; al entrar en el geofence, `salida-sitio` lo nombra y la cadencia pasa a `por-tiempo`; **la llegada valida a los 23 s** —la ventana corta más una muestra, que es lo que la tabla predice para un fijo bueno— y la pantalla pasa sola a A4P5. «Seguir» devuelve al momento en marcha con la llegada `cerrada` y sin volver a ofrecerse. Comprobado además leyendo el estado del propio aparato con `run-as`: dos llegadas validadas y cerradas con su secuencia. Y la otra mitad: **atravesar un geofence a 4,8 km/h sin pararse no valida**, y al salir la cadencia vuelve a `por-distancia`.

**Los dos recuentos, con el número medido y no el previsto.** Pantallas huérfanas: **8 → 1** —salen las seis del momento «al parar» y también `sitios-marcados.jsx`, que el cierre transitivo alcanza por el camino de deshacer; queda `zurron.jsx`, de la fila 46—. **Columna de límite declarado: 8 → 7**, y sale exactamente uno: `llegada.yaml`, **verde cinco tandas seguidas entre 115 y 126 s**. El encargo esperaba tres; salió uno, y se dice con la cifra delante. `visor.yaml` se queda porque sin lector de recursos binarios toda llegada resuelve a ficha, y `descarte.yaml` porque no se puede garantizar llegar a su puerta — **su motivo anterior era falso y está corregido**: la puerta existe, y cuando el sitio de arranque cae en un servicio el flujo la afirma.

## Lo que esta fila deja abierto, sin disimular

- **La lectura de la posición en el arranque impide fijar el ancla del mapa.** `app/plataforma/ubicacion.js:122` usa `getCurrentPositionAsync({ accuracy: Balanced })` y un fijo simulado no manda sobre ella, así que ningún flujo puede decidir dónde nace el mapa. Es lo único que mantiene `descarte.yaml` en la columna y lo que obliga a `llegada.yaml` a ramificar. **No se toca aquí a propósito**: esa lectura decide dónde nace el mundo de un jugador real, así que su precisión es decisión de producto de la fila del módulo de ubicación y no un ajuste que esta fila haga de paso para que le salga mejor un número.
- **El visor no se abre en el móvil.** No hay lector de recursos binarios cableado, así que toda llegada resuelve a ficha y, en un núcleo, a lo que allí se cuenta. Declarado con nombre y dueño (`SIN_RECURSOS`, `LECTOR_SIN_RESIDENTES`), y entra por la firma, así que el visor sí es afirmable inyectando inventario y lector. Falta quién deja las ilustraciones de la preparación en disco; ninguna fila lo cablea.
- **El reparto casteado no sobrevive a cerrar la app.** El estado guarda la aventura por su identificador y no su cadena de beats: el mismo día llega, y al reabrir la secuencia conserva su paso de beat pero el beat de dentro se pierde. Persistirlo es decisión de diseño.
- **RF-QUEST-004 y RF-BUCLE-011 no los entrega esta fila** y pasan a la 49, que es la escena del beat (A4P3/A4P4) y el telón (A5). El checklist lo declara. Se dice porque SPEC-034 y SPEC-036 se cerraron en `done` sin tocar un fichero de `app/`, y una fila que cierra cubriendo un RF que no entregó es un agujero que tarda meses en salir.
- **Por encima de σ ≈ 20 m de error del fijo la validación deja de sostenerse.** Cubre la calle normal y no el cañón urbano profundo. Es un límite medido, con número, y no una esperanza.

---

# 12-ago-2026 · SPEC-049, las pantallas de la escena y el telón: la fila que descubrió que la aventura no se aceptaba nunca

SPEC-034 y SPEC-036 cerraron en `done` sin tocar un solo fichero de `app/`. Esta fila escribe lo que ninguna de las dos escribió —A4P3, A4P4 y las seis del telón— y, al ir a hacerlo, encuentra que el problema no era que faltaran las pantallas.

## La premisa del encargo se quedaba corta, y por debajo había cinco costuras

El encargo daba por deuda conocida que «el reparto casteado no sobrevive a cerrar la app», y remataba: *mientras el telón se eche en la misma sesión no te toca*. Medido antes de escribir la spec, con grep sobre el repo entero:

1. **`acepta` de `partida/aventura-en-curso.js` no la llamaba nadie.** `aceptaLaEntrada` anotaba la aventura en la salida abierta y nunca en el motor, así que **`estado.aventuras.enCurso` era `null` siempre**, `resuelveBeat` era inalcanzable y `echaElTelon` habría compuesto el telón de un paseo aunque hubieras aceptado una aventura. No es que el beat llegase nulo el segundo día: es que **no había aventura en curso ningún día**.
2. **`antes-de-salir.jsx` cerraba la salida por su cuenta** con `cierraLaSalida`, y `echaElTelon` exige que siga abierta: fallaba con «su telón ya se echó». El telón era inalcanzable por construcción.
3. **Dos identidades de salida distintas** sobre dos áreas: `mapa/dN/sN` en `aventuras` (de la 28) y `mapa/sN` en `salidas` (de la 48). El cierre compara una con otra. Ninguna estaba mal en su fila; el defecto nace de que **nadie las cruzó nunca**, porque hasta ahora nadie cerraba una salida contra `echaElTelon`.
4. **`apuntaHaberEstado` no tenía llamador de producción**, así que la lista de ascensos del telón habría salido siempre vacía y RF-BUCLE-012 no se habría cumplido nunca.
5. **`lamina.jsx` no pasaba `entintado` ni `telon`** al render, que ya los aceptaba: A5P1 habría pintado el mapa de andar.

Ninguna es una pantalla y las cinco impiden que las pantallas funcionen. El dueño decidió coserlas dentro de la fila, con las once rutas advertidas.

## Un negativo heredado que era falso, y el que no lo era

`decisiones-orquestador.md` §10i afirmaba, «verificado hoy otra vez», que `componeDesenlace` seguía sin existir. **Existe**: `packages/nucleo/quests/desenlace.js` exporta `componeElDesenlace`, `lugarDelDesenlace` y `repuestoDe` desde el commit `aec5efa`, que es el propio arreglo de §6v que la fichó. Lo cierto era otra cosa —que no la llamaba nadie desde `app/`—, y la diferencia importa: construirla habría duplicado la que ya estaba. Está corregido en §10-bis, con la lección que sale de ahí: **un negativo no se hereda, se vuelve a medir o se marca como sospecha**.

El que sí era cierto y esta fila confirma: **`siembraLaCola` no tiene llamador desde `app/`**. El prólogo corre en el dispositivo, produce sus entradas y nadie las encola, así que `atraviesa()` sale siempre por `if (!cola.length)`: **hoy no puede saltar ni un micro-encuentro en un teléfono**. Es de la fila 19 y queda fichado, no arreglado aquí.

## El bucle completo, recorrido en `wa-pixel` con las coordenadas escritas

Es la primera vez que ese recorrido es posible. Mundo `1X9T5E7A039QP61Z@42.40,-8.74`, partida en `42.4035467,-8.7554983` — en metros del mundo, `(-1274, 395)`.

Aventura **«El paquete que no era nada»** (`entrega-sospechosa`), cuatro paradas. **Castrotoño** `(-739, 551)` → A4P3 con su verbo propio, «Aceptar el encargo», y A4P4 nombrando el sitio siguiente. **A Encrucillada do Aforcado do Sur** `(-461, 964)`, verbo «Asomarse». **O Cruce do Aforcado do Solpor** `(-874, 1390)`. Y el cuarto beat **otra vez en Castrotoño**, que es el lazo cerrado y el caso que hacía que ninguna aventura se pudiera terminar antes de §6v. Regreso a `(-1274, 395)`.

Leído del propio aparato con `run-as`, no de la pantalla: `enCurso` deja de ser `null` al aceptar (`beatEnCurso: 1`), las dos áreas comparten ya **la misma identidad** `42.40,-8.74/s1`, los cuatro beats quedan en `resueltos` y `beatEnCurso` pasa a `null`. Al cerrar: `oro: {saldo: 12}`, la aventura en `cerradas` con `comoAcabo: "terminada"` y su desenlace, y una entrada de diario.

El telón entero, en el orden que manda `bucle-jugable.md` §8: **A5P1** «Hoy has ensanchado el mapa» con el mapa entintado y cinco ascensos en palabras del mundo —«Castrotoño · lo conoces»—, **A5P2** con oro 12, el objeto `hule-del-paquete` y «En Castrotoño ya saben quién eres», **A5P3** con el rumor saliendo de Castrotoño y nada más, y **A5P4** con lo propio en primera persona y autoridad `lo-se`.

Y las otras dos variantes: **el paseo sin coger nada** sale mapa y diario, sin desenlace ni rumor; y **A5P1B**, con el mapa ya conocido entero, sale `telon-estado: mapa-sin-tinta` con «Hoy no has visto nada que no supieras · Andaste por sitios tuyos. El mundo, mientras, anduvo lo suyo» — constatación y no reproche, que es la cuerda floja de `accesibilidad.md` §1.

**§10h verificado por las dos puertas**: `telon-cerrar` y `telon-diario` dejan las dos `salida-situacion: cerrada-leida`, y después «Salir a andar sin más» abre una salida nueva de verdad (`42.40,-8.74/s10`, `abierta-con-rotulo`). La app no queda encallada por ninguna de las dos.

## Dos cosas que salieron andando y valen más que las pantallas

**El detector de vehículo hizo su trabajo contra quien lo medía.** El beat 4 no validaba y `marca-posicion` decía `vehiculo`: yo estaba «andando» a 35 m cada 4 s, **31 km/h**. No era un defecto de la fila, era `bucle-jugable.md` §9 apartando el vehículo, y dos minutos quieta lo recuperó solo. Sin leer esa marca se habría reportado como fallo de la fila y se habría «arreglado» algo que funcionaba.

**El sensor se cayó a mitad de salida** sin que nadie lo provocara, y la app respondió como el diseño manda: al reabrir, `abierta-sin-rotulo`, `rotulo-estado: retirado-por-el-sistema` y la tarjeta de a medias con «Seguir con ella» y «Dejarlo aquí». La rama de §9 que nadie había visto funcionar, funcionando.

## `setLocation` de Maestro no es `adb emu geo fix`, y la nota que lo decía manda a reiniciar el emulador para nada

`en-marcha.yaml` declaraba que «`setLocation` de Maestro es `adb emu geo fix`» y que en esta máquina no mueve nada por un mock de `fused_location_provider` **que se quita reiniciando el emulador**. Medido el 12-ago-2026 en la misma pantalla y el mismo minuto, con una salida abierta y la marca viva:

- `maestro test` con `setLocation: {latitude: 42.4090, longitude: -8.7480}` → **EXIT 0 y `marca-posicion` intacta** en `del-mapa:-1274,395:parada`.
- Acto seguido `adb emu geo fix -8.7480 42.4090` → `marca-posicion` pasa a `del-mapa:-657,1002:ambiguo`.

La conclusión operativa se sostiene —**un flujo de Maestro no puede andar**— pero el motivo no: no son el mismo mecanismo y no se cura reiniciando. Con `geo fix` se han andado dos kilómetros esta misma noche en este mismo emulador.

## Las tres costuras que aparecieron al recorrerlo, y de quién fue cada decisión

Las cinco de arriba estaban antes de empezar y las encontró medir la premisa. Estas tres las destapó **haber recorrido el bucle entero**, que es exactamente para lo que el criterio existía.

**La sexta: la lista de hoy no tenía memoria.** `componeLoQueHayHoy` sabe filtrar las plantillas ya vividas (`lo-que-hay-hoy.js:195`), pero la petición de `antes-de-salir.jsx:90` no le pasaba `aventuras`, así que recibía `null` y `cerradas` salía vacío. Medido en el aparato: terminada «El paquete que no era nada» y dejada a medias «La cita donde susurra el agua», **las dos volvían a ofrecerse** en la lista siguiente. Estaba fichado desde §6v y era **invisible hasta esta fila**, porque ninguna aventura podía cerrarse nunca. Lo decidió el dueño con la evidencia delante.

**La séptima: los descartes tampoco viajaban, y la mandé yo sin preguntar.** La misma petición no lleva `descartes`, así que `repartoDeAventuras` recibe siempre `SIN_DESCARTES` — y el propio núcleo lo dice en el error de `exigeDescartes`: *«sin ella devolvería candidatos que quien juega ya marcó»*. O sea, un sitio marcado «este sitio no pega» seguía casteando aventuras: RF-PRIV-004 entregado a medias por la 44. La propuso la sesión que orquesta con un criterio que resultó falso —*«es la misma familia, mismo arreglo de una línea»*—, y **la despaché yo sin llevársela al dueño**. No era simétrica: `aventuras` alimenta una lista con un consumidor; `descartes` alimenta un casting con **dos**.

**La octava, que es lo que la séptima abrió.** Con descartes de verdad, `repartoDeAventuras` **vuelve a castear**, y la cadena que sale del recasteo no es la de `mundo.casting` — que es de donde el cableado de esta fila lee la suya, por tres sitios: lo que se acepta en el motor (`antes-de-salir.jsx:253`), el reparto con el que se monta la capa de llegadas y se recupera al reabrir la app (`repartoDeLaAventuraEnCurso`), y la preparación. Consecuencia: **quien tuviera un solo sitio marcado vería un lazo en la ficha y sería mandado a otro**, posiblemente al que marcó.

Medido marcando **un solo sitio** en cada mundo de referencia, el del primer beat de la primera aventura repartida:

| mundo | repartidas | salen de la lista | siguen ofrecidas **con otros beats** |
| --- | --- | --- | --- |
| `barrio-tres-calles` | 24 → 1 | 23 | 1 |
| `costero` | 29 → 29 | 0 | **24** |
| `suelo-250m` | 19 → 19 | 0 | **11** |
| `urbano-denso` | 30 → 30 | 0 | **22** |

Con cero descartes no cambia nada —`hayDescartes` es falso y se usa `mundo.casting`—, así que el defecto está acotado a «hay algún descarte», y es **nuevo**: antes del arreglo séptimo el recasteo no ocurría jamás. `wa-dev` lo midió y **paró en vez de arreglarlo de paso**, que es lo que hay que hacer cuando el radio de acción de un arreglo se sale de lo decidido.

Y un falso positivo que conviene no heredar: `app/mapa/primera-lista.js:95` llama a `repartoDeAventuras` sin descartes y **eso está bien**. Es la lista del día uno sobre una partida recién nacida, con el área `anclajes` vacía por construcción.

## Dos respuestas distintas a la misma pregunta, y qué se hace con eso

Mientras se decidía la octava, la sesión que orquesta escribió que el dueño había pedido **revertir**; en la ventana de esta fila el dueño había pedido **coser**. Las dos eran respuestas suyas de verdad, dadas con distinto material delante: la de allí sobre un resumen, la de aquí con la tabla y el coste de reverificación.

Se paró a `wa-dev` con la octava sin empezar y el árbol limpio, se volvió a preguntar **una sola vez y en la ventana donde vive la fila**, con las dos respuestas y las tres salidas posibles delante, y se ejecutó lo que contestó allí.

Es §9b aplicado contra quien lo escribió, y con la mitad que le faltaba. §9b decía «un relato fiel de una decisión no es la decisión». Aquí la fidelidad no fallaba: **falló preguntar lo mismo por dos sitios**. La regla que sale es de higiene de orquestación: **una pregunta viva a la vez sobre un mismo asunto, y en la ventana de quien va a ejecutar la respuesta.**

## El cierre en corto, verificado sin andar

La cuarta variante del telón no necesita caminata: se acepta una aventura, no se resuelve ni un beat, se mata la app y se cierra desde la tarjeta de a medias. Sale **A5P1B** (`mapa-sin-tinta`), después **A5P2B** —«LA CITA DONDE SUSURRA EL AGUA · Se resolvió sin ti · … Y hoy has andado, que es lo que mueve el mundo»— y **directo al diario**: entre medias **no aparece la pantalla del rumor**, que es la decisión de `bucle-jugable.md` §4. Comprobado en el estado del aparato: `oro` sigue en **12** —el cierre en corto no ingresa nada—, las dos aventuras quedan en `cerradas` con `comoAcabo` `terminada` y `a-medias`, y ningún rumor nuevo.

## La primera migración de formato del proyecto, y las tres costuras que destapó

Congelar la huella obliga a subir `VERSION_FORMATO` de 1 a 2, así que esta fila estrena la cadena de `partida/migracion.js`, que llevaba escrita y vacía desde SPEC-047. Estrenarla costó tres cosas más, y **las tres las encontró el aparato, no la batería**.

**Nueve rojos de prueba, todos con la misma raíz.** Al subir la versión se pusieron rojas nueve pruebas que **codificaban «en este repo todavía no hay ninguna migración» como si fuera un invariante del diseño**: la cadena real tiene que estar vacía, el literal `1` en vez de la constante, dos cifras de tamaño medidas a mano y tres casos que montaban un documento v1 esperando que no se pudiera abrir. Veredicto de orquestación: **defecto de prueba en los nueve**, y se retiran escribiendo el porqué dentro, como manda `CLAUDE.md`. Dos merecen mención: los del mecanismo de migración se apoyaban en que la versión sintética `2` fuera **mayor** que la real y por eso no se validaba contra esquema, así que al arreglarlos se derivó **todo el fichero** de `VERSION_FORMATO` en lugar de clavar números — había ocho literales más con la misma trampa esperando su turno. Y las dos cifras de tamaño suben **+25 B exactos**, que es `"descartesDelCasting":[]`; los presupuestos de SPEC-016 pasan con margen enorme —registro 695 324 B de 6 291 456, estado 1 942 B de 2 097 152— y se añade una aserción de margen a la mitad, para que la cifra declarada no pueda tapar al criterio.

**La décima: migrar leía con el lector estricto.** Compilada la app y abierta sobre una partida real de v1, salía la pantalla de avería: *«el documento partida/estado.json está escrito en la versión de formato 1 y esta versión del juego usa la 2: hay que migrarlo antes de abrirlo»*. La causa, localizada: `migraDocumentos()` hacía `lee(crudo, …)` **antes** de migrar, y `lee()` llama a `compruebaVersion()`, que lanza para cualquier documento anterior al actual. **El lector que se usa antes de migrar era más estricto que la migración a la que precede**, así que ningún documento viejo podía llegar nunca a la cadena.

Es la forma que SPEC-047 ya había anotado —«migrar leía el registro antes que `cargaPartida` y era más estricto que él»— y que **no se había disparado nunca porque no había ninguna migración**: con la versión en 1, ningún documento podía ser más viejo. Y la prueba de que era cuestión de puertas y no de la pieza: `copia.js` parseaba sin exigir versión, **y por eso las copias sí se migraban**. Dos puertas a la misma cadena con dos exigencias distintas.

Merece decirse cómo se encontró, porque es la lección: **`wa-dev` midió `migra()` directamente y funcionaba; yo hice lo mismo y también funcionaba**. El defecto vivía en el envoltorio. Solo apareció abriendo la app con un documento del día anterior, que es algo que ninguna prueba unitaria hace. Y de camino, un aviso sobre uno mismo: mi primera reproducción importó `migracion.js` sin `estado.js`, el registro de esquemas nació con dos clases en vez de nueve y me dio un error falso —«clase de documento desconocida "estado-de-partida"»— que estuve a punto de mandar como diagnóstico. Lo cazó volver a medirlo bien, no sospecharlo.

**La undécima: `VERSION_FORMATO` es global a todas las clases.** Arreglada la décima, la partida migra —estado y registro a v2, la aventura en curso intacta por el beat donde iba— y la app **sigue sin abrir**, ahora por el mapa: `indice.json` y `celda/0,0.json` siguen en v1 y nadie los migra. Subir la versión por una clase invalida todas las demás aunque no cambien.

Y ahí está la causa raíz, que **esta fila no toca y deja fichada**: mientras la versión de formato sea una sola para nueve clases de documento, esta forma de fallo vuelve cada vez que una clase evolucione sola. Lo que hay que decidir es versión por clase, o una guarda que exija que subir la versión venga acompañada de migración para **todas** las clases que la comparten.

## El recorrido rehecho, después de la migración

El primer recorrido se firmó antes de las tres últimas costuras, y esas tocan el cableado que lo sostenía, así que se rehizo entero sobre la app recompilada. Mismo mundo `1X9T5E7A039QP61Z@42.40,-8.74`.

**La partida vieja migra y sigue jugándose.** Un documento v1 con `ronda-del-vigia` en curso por el beat 1, capturado con la compilación anterior: al abrir con la nueva, estado y registro suben a v2, los dos del mapa también, la aventura sigue donde estaba, las dos cerradas y el oro se conservan, y `procedencia.json` declara `"de":"migracion","migradaDesde":1`. **Esa procedencia es lo que firma la migración**, no la captura: `expo run:android` abre la app al instalar, así que cuando fui a leer el «antes» ya había migrado.

**La cadena entera, con las coordenadas**: Covalonga a Vella (−1190, 364) → A Encrucillada do Aforcado do Sur (−461, 964) → O Torreón Caído do Solpor (−1250, 398) → Covalonga a Vella otra vez. Cuatro beats resueltos, con sus verbos propios —«Aceptar el encargo», «Contarlo»— y su objeto («catalejo del vigía»).

**Y la novena, probada donde vive.** A mitad de la aventura se marcó «Taberna da Estrela Vermella» desde A4P8, se mató la app y se reabrió: la aventura sigue en `ronda-del-vigia` por el beat 4, **la huella sigue en `[]`** —congelada al aceptar, cuando no había nada marcado— mientras el área `anclajes` ya lleva la Taberna. Los dos datos desacoplados, y la app abre por la portada en vez de reventar, que es lo que hacía en 9 de 19 casos de `suelo-250m` antes del arreglo.

## Dos cosas que el aparato enseñó y no son de esta fila

**A4P8 no se puede marcar tocando el botón.** La capa de descarte desborda una pantalla de 1080×2400: los cinco motivos empujan hacia abajo y los dos últimos salen con cotas degeneradas —`ya-no-existe` en `[74,2215][1007,2122]`, con el borde inferior por encima del superior— **encima de «Marcarlo»**, que ocupa de 2185 a 2337. Un toque en el centro del botón se lo comen los motivos; el marcado solo entra tocando la franja de 2185 a 2215. Es la trampa que `CLAUDE.md` ya documenta —las listas variables empujan la acción bajo el pliegue— en su tercera aparición, y es la primera vez que alguien abre A4P8 en un teléfono: `descarte.yaml` lleva en límite declarado desde que existe.

**El servicio en primer plano se cae a mitad de salida.** Ocurrió dos veces sin provocarlo: `ubicacion-estado` pasa a `sin-montar`, la marca deja de moverse y ningún fijo llega. La app responde como el diseño manda —al reabrir, `abierta-sin-rotulo`, rótulo `retirado-por-el-sistema` y la tarjeta de a medias con sus dos acciones—, así que no se pierde nada; pero es el motivo por el que **el telón por regreso no se ha podido verificar en el aparato**. Se verificó por «dejarlo aquí» y por la tarjeta de a medias, que `bucle-jugable.md` §8 declara la misma puerta.

Y una hipótesis que **no** se ha podido sostener y por eso no se ficha como hallazgo: parada exactamente en el punto de partida, `regreso.dentroDesdeMs` seguía en nulo con la cadencia en `por-distancia`, lo que encajaría con §9a —el punto de partida no es un geofence, así que el muestreo nunca pasa a tiempo y parada no llega ningún fijo—. Pero al comprobarlo moviéndose dentro del radio, el sensor ya estaba caído, así que la medida no dice nada. Queda escrito como sospecha con su motivo, no como defecto.

# XXXIV · Los cableados que faltaban (12-ago-2026)

SPEC-050, la fila 50. Los tres hallazgos de la 49 que compartían forma —§6h en su variante de cableado: pieza escrita, probada y sin llamador— y que cambian el juego que se ve. No había que escribir pantallas ni mecanismo: había que coser. Y cosiendo apareció que dos de las tres piezas, además de no tener llamador, **estaban rotas por dentro**, y que ninguna prueba podía saberlo porque nadie las había ejecutado nunca.

## Lo que el encargo decía y lo que se midió

El encargo daba por medido que `siembraLaCola` no tiene llamador desde `app/`. Cierto, y **más grande**: en `App.js` el parámetro `lista` de `alSalirAAndar` no se usaba en ninguna línea, así que se tiraba el resultado entero del prólogo. Como `componePrimeraLista` tampoco le pasa a `correPrologo` las áreas de la partida —el prólogo corre en A1P6, cuando la partida todavía no existe—, el mundo nacía sin rumores sedimentados, sin nada que contar en sus núcleos y sin el par del arranque, además de sin cola. `app/marcha/llegadas.js:188` lleva desde SPEC-032 leyendo `estado.nucleos` contra un área que estaba **siempre vacía**.

Y una segunda mitad que el encargo preguntaba y nadie había mirado: `levanta()` **no corre ningún prólogo**, así que el segundo mapa de una partida no tenía pasado. No era que corriera y no se sembrara: es que no corría.

De los rojos declarados, uno no se sostuvo. El encargo decía «2 rojos de `@app`, fichados». La primera tanda sobre `main` dio **7**, y no era regresión: el emulador arrastraba un arranque a medias y un mapa levantado de una sesión anterior, y cinco flujos que asumen instalación limpia fallaban por eso. Con `pm clear` vuelven. Queda escrito porque el número del encargo solo es reproducible desde un aparato limpio, y decirlo sin esa condición invita a leer una avería donde hay estado.

## Las tres decisiones del dueño

A2P0 pide **el sitio dicho como lugar y no como coordenada** (`mapas.js`, pieza `sitio`, con `texto: null` a propósito) y la app no tenía de dónde sacarlo. El dueño eligió **la ruta ciega que ya hay**: una consulta pequeña por `pideGeneracion`, la misma que usa el levantamiento, con la misma ficha anónima. Se descartaron la geocodificación inversa del sistema —manda la coordenada exacta a un tercero, y el proxy ciego de SPEC-023 existe justamente para eso— y la frase fija siempre, porque el guion manda.

Al medirlo apareció que `componeOfrecimiento` exige `sitio` **también con `sinRed: true`**: sin topónimo no se podía componer, y lo que quedaba era o una pantalla en blanco o la portada de casa a trescientos kilómetros. El dueño decidió un **respaldo en voz de mundo solo sin red** —«Un sitio todavía sin nombre»—, con el contrato intacto por el camino bueno: con red, `sitio` sigue siendo obligatorio y una cadena vacía sigue siendo error de construcción.

Y el tercero: **A2P0 entra en el diseño**, porque el código tenía una pantalla que el diseño no declaraba y ése es el único agujero que `verifica-flujo.mjs` no puede cazar por construcción. Bloque «PANTALLA 0» en el artefacto 2, nodo `A2P0` con sus aristas, línea en `docs/pantallas.md` y los recuentos de «40 pantallas» al día. El diagrama queda en **41 pantallas, 41 nodos, 94 aristas, ninguna suelta**.

## Los dos defectos que solo se ven en un teléfono

**A2P0 tumbaba la app la primera vez que se entraba en ella.** El `return` del ofrecimiento estaba en medio del cuerpo de `PantallaAntesDeSalir`, por encima de tres hooks: esa rama montaba menos que las demás y React caía con «Rendered fewer hooks than expected». Viene de SPEC-041 y **nunca había saltado porque nadie pasaba nunca `ofrecimiento`**. Es §6h en su forma más cara: no es que la pieza faltara, es que estaba rota y no había manera de saberlo sin ejecutarla.

**Y el primer arreglo de A4P8 tampoco funcionó, y hubo que medirlo para verlo.** El diagnóstico era bueno —`llegada.js` montaba `CapaDescarte` como hermano en el flujo, con `flex: 1` compitiendo por el alto con la ficha, donde la otra capa del mismo fichero usa `absoluteFillObject`— pero copiar el mecanismo del visor **no cuajó**: con `...StyleSheet.absoluteFillObject` la capa seguía saliendo en `[0,2122][1080,2400]`, apilada debajo, y los cinco motivos no se pintaban. Con las cuatro anclas escritas una a una sale `[0,0][1080,2400]`. La prueba que había escrito exigía el spread, o sea que **habría dado por bueno exactamente el estado que no funciona**; se corrigió con el código y con el porqué dentro. Queda fichado que el visor usa el spread y puede tener lo mismo: no se ha medido y no se toca a ciegas.

## Verificado

Mundo `P9SQCX177VESJYMX@42.41,-8.74` en `wa-pixel`, con el aparato limpio y la app recompilada.

**La cola se siembra de verdad.** Tras el arranque, `estado.json` leído con `adb exec-out run-as` trae **2 entradas** encoladas y pendientes —`herramienta-por-devolver` en Valmar da Moura y `tejas-que-tiró-el-viento` en Castroño do Corvo—, **3 rumores** sedimentados y **7 de 7 núcleos** con algo que contar, más el par del arranque compuesto sobre Castroño do Corvo y Covanova a Vella. Antes de esta fila las cuatro áreas salían vacías.

**«Marcarlo» se pulsa por el centro.** Recorrido real: salir a andar, andar hasta A Encrucillada do Mercador de Abaixo (−355, 26 → 42.410234, −8.744319) parándose allí, llegada validada, A4P7, «Este sitio no pega» → A4P8. Cotas: capa en `[0,0][1080,2400]`, los **cinco** motivos presentes y ninguno degenerado, «Marcarlo» en `[63,2185][1017,2337]`. Tocando su centro (540, 2261) el estado queda con `{"anclaje": "A Encrucillada do Mercador de Abaixo", "rol": "paraje", "porque": "casa-particular"}`.

**A2P0 se ve.** Abriendo la app en Madrid (40.4168, −3.7038), a unos 500 km del único mapa de la partida: `mapa-activo` en `ninguno`, el sitio dice **MADRID** —topónimo real traído por la ruta ciega—, el titular y el cuerpo del guion, las dos acciones, las tres puertas, y **ni rastro de «salir a andar»**.

**El micro-encuentro visto en pantalla no se firma**, y es el límite de esta fila. Con la cola sembrada la puerta está abierta, pero qué sitio tiene beat sigue sin ser reproducible entre tandas por las tres medidas de `escena.yaml` que esta fila no toca —el ancla del mapa no la gobierna el flujo, la semilla nace de entropía real y `setLocation` de Maestro no mueve el aparato—. Lo que sí queda afirmado siempre es lo de arriba: las entradas están encoladas en el disco de un teléfono.

## Lo que se deja fichado

- **El visor puede tener el defecto de la capa**: usa `...StyleSheet.absoluteFillObject`, que en el descarte no posicionaba. No medido; `visor.yaml` sigue en límite declarado por otro motivo.
- **`creaMotorDeLaPartida` sigue sin llamador en `app/`.** Misma forma, otra fila.
- ~~**`escena.cara` sigue siendo nula siempre**, 0 de 506 beats sobre rol humano (SPEC-017).~~ → **hecho** por la fila 51 (SPEC-051): 69 de 506 beats caen sobre un rol humano y componen escena con cara. Entrada XXXVI.
- **La versión de formato sigue siendo global** a las ocho clases de documento (§11e). Esta fila no sube ninguna.

## La precondición que hay que escribir al lado de los números

De aquí sale una regla de operativa que no estaba en ninguna parte y ya ha costado un susto: **antes de una tanda cuyos números vayan a compararse, el aparato se limpia con `adb shell pm clear com.walkingadventure.app` y se reinstala**. No basta `force-stop`, y `expo run:android` no borra los documentos. Sin ese paso, cinco flujos que asumen instalación limpia caen por estado arrastrado y se leen como regresión. Anotado en `CLAUDE.md`, junto a las otras trampas del aparato, porque el sitio donde tiene que estar es donde lo busca quien mide y no la bitácora de quien lo descubrió.

## Los dos rojos de `@app` que no son de esta fila, y cómo se atribuyeron

La tanda final dejó **cuatro** flujos en rojo, y el encargo declaraba dos. Los otros dos —`en-marcha.yaml` y `telon.yaml`— fallan los dos en la misma aserción, `id: en-marcha is visible`, y el motivo lo guarda la propia pantalla en `salida-no-se-abre`: «sin una posición no hay punto de partida... Current location is unavailable». La salida no se abre porque `getCurrentPositionAsync` no devuelve fijo en este emulador en ese instante.

**No son de esta fila, y se comprobó en vez de suponerse.** Tres medidas, en este orden: desactivar el efecto que resuelve dónde estás → siguen rojos; desactivar además el montaje del mapa de la partida → siguen rojos; **y correrlos sobre `main` con el mismo procedimiento —`pm clear`, reinstalar, alimentador de posición cada dos segundos— → rojos igual**. La atribución es la última: lo demás solo descarta.

Merece decirse porque el orden importa. La primera sonda no aisló nada: desactivó el efecto y dejó vivo el otro añadido de la fila, así que su verde no habría demostrado nada y su rojo tampoco. Una sonda que no apaga todo lo tuyo no separa lo tuyo de lo ajeno.

Queda **sin dueño y fichado**: la fila 48 midió `en-marcha.yaml` en verde con 103 s de recorrido real, y hoy no abre la salida. O es deriva del emulador o es regresión de alguna fila posterior; lo que sí se sabe es que la ubicación funciona **durante** una salida —el recorrido a pie de esta fila validó su llegada— y falla al abrirla.

## XXXV · La fila 46: la fuente de salud y el zurrón, y un suelo de aparatos que nadie había anticipado (13-ago-2026)

Cierra el bloque B7 y la última pantalla huérfana del repo. Entrega la fuente nativa de salud —**Health Connect, solo Android**, con la pareja de iOS como doble declarado—, el motor del mapa activo, el zurrón montado desde la portada y la reserva de punta a punta. `SPEC-046` y `SPEC-046-iter-1`; ramas y commits en `pipeline/SPEC-046-fuente-de-salud-y-zurron`.

### Una premisa heredada que era falsa, y reduce la fila de tres piezas a dos

`SPEC-043-iter-1` enumeró tres piezas que faltaban: fuente de salud, motor de pasos y **registro de hechos de la partida**. La tercera dejó de ser cierta antes de que esta fila existiera: `App.js` sostiene `partida.registro` desde que abre (`:271`), lo congela junto al estado (`:320`) y lo pasa ya a dos pantallas (`:818`, `:857`). Lo trajeron las filas 47 y 50. La fila trae **dos piezas y consume la tercera**, y queda escrito en la spec en lugar de callarse: una fila que dice traer tres y trae dos es una fila que nadie puede verificar. Es la cuarta vez seguida que medir una premisa heredada la encuentra falsa (§10-bis), y esta vez la regla se aplicó antes de escribir, no después.

Segunda premisa medida y falsa, esta más barata: `SPEC-043-iter-1` decía que A2P2 «sale de la lista de aristas cableadas» de `docs/flujo.md`. Retiró el cableado, **no la arista**: el diagrama seguía declarando `A2P1 → A2P2` y `A2P2 → A2P3` palabra por palabra. No hubo que reponerlas.

### Lo que la fuente de salud arrastraba y ninguna spec anticipó

**Health Connect exige `minSdk 26` y la app estaba en 24**, así que la rama no compilaba. El implementador se paró, como manda la lista cerrada de dependencias, y propuso `expo-build-properties` como «único camino declarado por la propia librería». **No lo era**: `withGradleProperties` viene dentro de `expo`, que ya es dependencia, y este repo ya escribe plugins propios (`app/plugins/retira-permisos-prohibidos.js`). La salida estaba a un grep. Pararse fue correcto; la lección es que ante un requisito de compilación se mira primero qué sabe hacer ya `app/plugins/`.

Con eso, la decisión que quedaba no era de dependencias sino de producto: **el primer cambio de suelo de aparatos del proyecto**, de Android 7.0 a 8.0. Lo decidió el dueño sabiendo el coste (décimas de porcentaje de un parque de 2016, para un juego que ya pide GPS fino y render Skia). Condición comprobada: **`docs/prd.md` no fija ningún mínimo de Android** —RNF-COM-001 (`:286`) solo habla de una base React Native + Expo—, así que no hay contradicción y el documento no se toca.

### La razón de permisos: destino decidido, mecanismo imposible, y una traducción

El dueño decidió que «¿por qué me pides esto?» aterrizara en **A6P6**, donde la fila de contar los pasos y su línea de aviso ya *son* la razón de permisos — responder con la portada es un portazo educado, y escribir pantalla nueva es estirar la fila. Al implementarlo apareció que **la acción del intento no llega a JavaScript**: `IntentModule.kt:59-68` devuelve `null` salvo `ACTION_VIEW` o NFC **con** `getData()`, y `react-native-health-connect` solo declara el filtro en el manifiesto.

El mecanismo que lo resuelve sin dependencia ni invento: el mismo plugin **traduce el intento a `walkingadventure://razon-de-permisos`** en el `onCreate` y el `onNewIntent` de `MainActivity`, y de ahí lo enruta la tubería que ya existía (`App.js:701` con `Linking.getInitialURL()` y el esquema declarado). **Es la primera vez que este repo inyecta código nativo propio**, y por eso el Kotlin traduce y no decide: a dónde ir se resuelve en JavaScript, donde las guardas lo ven.

Y una corrección que salvó un verde falso: **Health Connect declara dos puertas, no una** — la acción de Android ≤13 sobre `MainActivity` y el `activity-alias ViewPermissionUsageActivity` de Android 14+. El plugin traducía solo la primera. `wa-pixel` es **Android 15**, o sea que la puerta real de este aparato era justo la que no se traducía: disparar la acción vieja a mano habría dado verde en el banco y rojo en el móvil de cualquiera.

### El defecto que escondía el rojo del zurrón

`zurron.yaml` moría al encender el interruptor. Tres hipótesis y las tres falsas: no era que la promesa de `requestPermission` no resolviera (resuelve, medido por Metro), ni que el toque no llegara por cotas degeneradas (esa trampa vale para `adb` y **no** para Maestro). Era que **la fila era inerte fuera del `Switch`**: el control ocupa `[906,1428][1028,1499]` dentro de una fila de `[53,1397][1028,1532]`, el toque al centro caía en la etiqueta, y `enciende()` **no llegaba a correr** — por eso lo que se veía no era ninguna de sus dos salidas. Arreglado haciendo responder a la fila entera y dejando el `Switch` sordo, que además hace imposible por construcción que lo pintado se mueva sin el valor.

Debajo había una segunda: **`checked:` sobre esa fila no discrimina en ninguna dirección** —el `ViewGroup` dice `checked=false` también con el interruptor encendido—, así que la aserción que `ajustes.yaml` arrastraba **desde la fila 43** pasaba en verde sin medir nada.

### `zurron.yaml` a límite declarado, contra un criterio de su propia spec

Con el defecto arreglado el flujo recorre entero, y entonces se vio lo de fondo: **sale verde o rojo según el mundo que toque**. Montada la partida en Node exactamente como la monta la app, el prólogo siembra 2 entradas y deja 3 rumores con `frentes: []`; **sesenta pasos dan cero efectos y las 2 entradas siguen pendientes**. La causa es estructural y está en la fuente: `creaColaDeEntregas` sin `producciones` no produce por diseño (`quests.md` decisión 3) y `motor.js` le pasa `producciones: null` declarado; lo sembrado entrega por **micro-encuentro al atravesar sitios durante una salida**, no por pasos de fondo. Y los rumores del prólogo nacen sedimentados.

El dueño decidió declararlo: **la columna sube de 8 a 9**, contra un criterio de `SPEC-046` que decía que no subiría. Se dice en voz alta. El precedente es `llegada.yaml`: un flujo que pasa o falla según el mundo, contado entre los verdes, es peor que uno declarado. Comparte la deuda de fondo de `escena.yaml` —no hay dónde escribir la semilla— y **no se abrió entrada nueva**.

Dos cosas que ese motivo estuvo a punto de decir mal. Iba a escribirse «falta la siembra, es fila 19», y **`siembraLaCola` tiene llamador desde la fila 50** (`app/mapa/donde-estas.js:169`): habría sido el tercer motivo caducado de esa lista, tras los de `descarte.yaml` y `escena.yaml`. Y la guarda no admitía esta forma de límite —daba por supuesto que declarado es siempre «no hay camino»—, así que las dos formas pasan a ser dato, con la estricta por defecto y quien quiera la otra nombrándose a mano.

### Verificado

- **@nucleo: 2865 · 2861 · 1 · 3** (base antes de la fila: 2825 · 2821 · 1 · 3), medido cuatro veces, la última en la tanda de cierre `SUITE-run-20260813T050409Z`. Único rojo el ajeno `BOOT_COMPLETED` de `expo-notifications` (SPEC-023). Total comparable: `manifiesto-generado.estado.json` con `mirado: true` en las dos plataformas.
- **@app: 20 · 8 · 3 · 9** (base: 20 · 8 · 4 · 8), desde aparato limpio con `pm clear` + reinstalación y bucle de posición cada 2 s. Los tres rojos son ajenos y con motivo leído: `en-marcha` y `telon` por el proveedor frío, con el `accessibilityText` palabra por palabra, y `empezar-de-nuevo-copia`, del que esta fila aporta un dato nuevo — **se reproduce también en Android**, no solo en iOS.
- **`zurron.yaml` verde, y corrió la rama *con* zurrón**: `Run flow when id: zurron is not visible` SKIPPED, la contraria RUNNING, con `zurron-envoltorio`, `zurron-entrada`, el toque en `zurron-seguir` y `lista-de-hoy`. El recorrido A2P1 → A2P2 → A2P3 entero, en un teléfono.
- **Pantallas huérfanas 1 → 0**, la primera vez desde que existe la guarda (serie 12 → 8 → 1 → 0 sobre 33). `contratos-sin-llamador` baja de 4 entradas a 2. `piezas-sin-consumidor` sigue vacía.
- **Manifiesto fusionado**: `minSdkVersion="26"`, `health.READ_DISTANCE` y `health.READ_STEPS`, **`ACTIVITY_RECOGNITION` retirado** y ni una aparición. Health Connect no arrastra ningún permiso: solo su bloque `<queries>` y las dos puertas de la razón. `Info.plist` sin ninguna clave de salud — `NSHealthShareUsageDescription` retirada, anotada en `docs/iphone.md` decisión 1.
- `verifica-flujo`: 41 pantallas, **96 aristas** (94 antes), ninguna suelta. `verifica-gherkin`: 46 características, 243 casos. `spec-test-map` válido con 3672 entradas.

### Lo que se deja fichado

- **Si la línea de A6P6 basta como razón de permisos ante Play.** Se decidió no inventar texto legal en esta fila y no se ha podido mirar con ojos de revisor.
- **`arranque.yaml` deja `READ_DISTANCE` y `READ_STEPS` en `granted=true`** aunque se neutralice la llamada de la app. Medido en las dos direcciones, sin explicación. En este emulador, el valor de esos permisos no prueba que la app los haya pedido.
- **`ajustes.yaml` contamina a los flujos posteriores** dejando esos permisos concedidos, y un permiso concedido no se devuelve desde dentro de la app. El toque se conserva —quitarlo dejaría al flujo sin ejercitar su único interruptor— y la defensa es la que ya usan los flujos que importan: empezar limpiando estado.
- **La puerta del `activity-alias` no se pudo disparar**: exige `START_VIEW_PERMISSION_USAGE`, que es permiso de sistema y `adb` no tiene (`SecurityException` literal). Se afirma que está registrada y a dónde apunta, sobre el manifiesto fusionado. No se añadió `CATEGORY_DEFAULT` para poder medir: sería ampliar la superficie pública por comodidad de la prueba.
- **Ninguna pantalla se ha visto en un iPhone**, y ahora hay además una plataforma sin fuente de salud. El inventario está en `docs/iphone.md`.

## XXXVI · La fila 51: los beats con cara, y una comprobación que al no poder correr no protestaba (13-ago-2026)

Salda el fichado de la fila 50: `escena.cara` era **siempre nula**. Veinte de las treinta plantillas declaran un rol humano y **ningún beat caía encima** —0 de 506 en los cuatro mundos de referencia—, así que la composición de `escena.js`, el `carasDelDesenlace` de SPEC-017 y el bloque de quien habla de A4P3 llevaban escritos y probados desde su fila sin que nadie los alimentara. La forma §6h otra vez. `SPEC-051`, rama `pipeline/SPEC-051-beats-con-cara`. Fila de núcleo entera: **no tomó el emulador**.

### La premisa del encargo era falsa, y cambió el arreglo

El encargo decía que un beat sobre un rol humano caería hoy en `trecho-por-debajo-del-minimo`. **No cae en ningún motivo: revienta.** Los roles humanos se resuelven **fuera** del backtracking, así que durante toda la comprobación su lugar está sin asignar: el chequeo de trecho lo **salta en silencio** —y con él el del lazo, si el beat es el primero o el último— y el `TypeError` salta después, en `recorridoDe`. Medido: **70 excepciones** sobre 20 plantillas × 4 mundos.

Importa porque cambia qué hay que arreglar. No había que ablandar una regla: había que hacer que **el lugar exista cuando las reglas se comprueban**. Es §6h en su variante nueva —**una comprobación que, al no poder correr, no protesta**—, hermana de la pieza que al no estar no protesta, y el criterio quedó escrito en la spec con la prohibición explícita de añadir una excepción para el caso humano.

### Cuatro decisiones del dueño, y la que llevaba tres meses sin ratificar

- **El pendiente 1 de `npcs.md`, ratificado**: dos caras del mismo sitio **son el mismo lugar** para el casting. Un beat sobre un rol humano ocurre en el sitio donde esa persona trabaja; la cara añade **quién habla**, no **dónde**. Era lo que `caraDeSitio` ya asumía en su comentario desde el 5-ago sin que nadie lo hubiera decidido. Tachado en `game-design/npcs.md`. La alternativa —cara como lugar propio— obligaba a inventar distancias entre dos caras del mismo portal y devolvía a los NPCs a competir por el anclaje escaso, que es justo lo que la enmienda de esa capa había abaratado.
- **El alcance sale del catálogo, no de una lista**: dos cláusulas —el beat que la `relacion` de la plantilla ya nombra, y el último beat de su sitio para una cara con acto declarado que la primera dejó sin beat—, que dan **21 beats en 19 plantillas**. Se rechazó elegirlos a mano: una lista sin regla que la sostenga es la pieza que al no estar no protesta, y una plantilla futura habría entrado sola en el olvido. Queda un rol humano sin beat, `la-carta-sin-remite::quien_recibe`, a propósito: su plantilla no declara ningún acto, así que no hay momento escrito en el que esa persona esté delante, y la regla no se estira para llegar al cero.
- **El puesto se dice con palabras del mundo**: A4P3 habría pintado `ANXO O DO NORTE · REGENCIA`, vocabulario de catálogo asomando dentro del juego contra la frontera de registros de `lenguaje.md`. Nueve rótulos declarados junto a `PUESTOS_POR_TIPO`, sintagmas de tarea sin género —`al frente`, `de guardia`, `del vecindario`, `en la cocina`— así que no hay género que elegir ni estereotipo que arrastre el oficio. **Un puesto sin rótulo es error de construcción, nunca un fallback a la clave.**
- **Las dos mitades del paso comparten criterio**: A4P4 pintaba el `empuje` con el mismo texto y **sin comillas**, así que los parlamentos nuevos se habrían leído como narración justo después de leerse entrecomillados. `componeLoQueTeLlevas` hereda la `forma` de la escena. Un texto, un criterio, y la decisión anotada en `game-design/quests.md` §2.

### Siete sitios donde un lugar podía ser una persona, y dos de ellos eran fugas de registro

La spec declaró cinco: los estorbos y el recorrido de `casting.js`, el lazo de la plantilla en `catalogo.js` —con un último beat humano **el catálogo entero dejaba de cargar**—, la clave de elemento de `recursos.js` y «la aventura pasa por este núcleo» de `arranque.js`. `wa-dev` encontró **dos más y los declaró en vez de dejarlos para el cotejo**, que era la condición: el guiado de `aventura.js` habría pintado en el mapa una marca de tipo `humano`, y el sobre del prompt de `narrador.js` habría mandado `humano` al modelo **como tipo abstracto de un lugar**. Las dos son fugas de registro de las feas, y ninguna prueba las miraba.

Un detalle de forma del dato que merece quedar escrito: `empuje` sigue siendo una cadena con la forma al lado, en vez del `{ forma, texto }` simétrico, porque la guarda de `escena-cableada.test.mjs:260` filtra por `typeof t === 'string'` y con un objeto **habría dejado de mirar el empuje y seguido en verde**. Una guarda que deja de medir en silencio es peor que un campo asimétrico.

### Las guardas a mover no eran seis: eran diez

La spec nombró seis. Al escribirlas aparecieron **cuatro más**, todas declaradas en el commit: el lazo por rol de `catalogo.test.mjs:296`, el decorado que dejaba `quien_encarga` huérfano, un tercer `puesto` libre en `escena.test.mjs:604`, y sobre todo `casting.test.mjs:334`, que exentaba el trecho mínimo **por rol** y daba «el trecho 2→3 son 0.000 tramos»: **medía la herencia como fallo**, y arreglarla a ciegas habría corrompido el criterio entero de la fila.

La guarda del 0 de 506 se actualizó como estaba diseñada: **20 sigue siendo 20, 506 sigue siendo 506, y 0 pasa a 69**, con las tres cifras nuevas como aserciones propias y no solo en el comentario. Y su exigencia —«alguien mire si la cara llega a pantalla»— quedó **cumplida en dos sitios y no borrada**: el caso de composición ya no fabrica el beat, usa uno casteado de verdad; y un caso nuevo afirma sobre el árbol de A4P3 que el bloque pinta nombre y rótulo y que **ninguna de las nueve claves aparece**.

### La segunda entrega: la lista cerrada de `app/plugins/`

Decisión del dueño en §14e·3, y no se recortó. `test/nucleo/plugins-declarados.test.mjs` nombra a mano los dos plugins de hoy con su cometido en una frase, y se pone **roja en las tres direcciones** —uno nuevo, uno cambiado de forma, uno retirado—, las tres verificadas a mano. La «forma» que vigila son tres cosas: función exportada, ganchos de `expo/config-plugins` usados, y huella SHA-256 del código **sin comentarios**, que quedan fuera a propósito porque esos ficheros llevan media página de porqué dentro. Cruza además con `app.json` en las dos direcciones. Deja escrito que **«traduce, no decide» sigue siendo revisión humana**: lo que la guarda garantiza es la conversación, no la ausencia de lógica de producto en Kotlin.

### Verificado

- **La casteabilidad no se movió ni un punto, y está medida tres veces por dos manos distintas**: `node test/casting-report.mjs` sale **idéntico byte a byte** al de `c51cb77` — agregado **640/660**; Sanxenxo 30/30 · Toledo 26/30 · Madrid centro 30/30 · A Coruña 27/30; motivos `trecho-fuera-del-tope` 9 · `trecho-por-debajo-del-minimo` 6 · `recorrido-fuera-del-tamano` 2 · `lazo-que-no-cierra` 3; oficios taberna 317/330 · botica 282/286 · forja 317/330 · mercado 345/352.
- **Sobre los cuatro mundos de referencia**: 103 de 120 castean y **ninguna plantilla cambia de veredicto**; **0 de 120 cadenas de sitios difieren beat a beat**; 506 beats, de los que **69 caen sobre un rol humano donde había 0**, en **63 de 103** aventuras. En el catálogo, 21 beats con cara en 19 plantillas, y las cláusulas son idempotentes en las 30.
- **@nucleo: 2906 · 2902 · 1 · 3** (base de `main`: 2865 · 2861 · 1 · 3), tanda `SPEC-051-run-20260813T104953Z`, código de salida del runner leído sin tubería. **Total comparable**: `manifiesto-generado.estado.json` con `mirado: true` en las dos plataformas y `completo: true` — corrió sobre los artefactos de compilación del 12-ago, que esta fila no invalida porque **no toca configuración nativa**; el manifiesto regenerado sale idéntico al de antes con `diff` vacío. El delta cierra exacto y es la prueba de que no se retira ni un caso: **2865 + 34 (`caras`) + 4 (`plugins-declarados`) + 1 (`escena-cableada`) + 2 (`npcs`) = 2906**.
- **Único rojo, el ajeno y fichado**: `BOOT_COMPLETED` de `expo-notifications` (SPEC-023). **Ni un rojo nuevo.**
- **`node test/headless.mjs` de 15 rojos a 0**, y no se creyó la medida de quien implementó: `wa-qa-dev` montó un worktree de `c51cb77`, corrió allí su headless y comprobó que el log sale **idéntico byte a byte**, presupuestos incluidos.
- Frontera del núcleo intacta: **115 módulos** de `packages/nucleo/` importan en Node sin React Native ni Expo. **Ninguna dependencia nueva.**
- `verifica-gherkin`: **51 características · 256 escenarios · 268 casos ejecutables**, con los **25 escenarios nuevos** que las cuatro decisiones ganaron el derecho a tener. `verifica-flujo`: 41 pantallas, 96 aristas, ninguna suelta. `spec-test-map` válido con **3758 entradas**.
- **Los 21 parlamentos y los 9 rótulos** pasan `infraccionesDeTexto` e `infraccionesDeLecturaEnVozAlta` **sin una sola infracción**; el más largo ocupa 124 de los 220 del tope. Al heredar la forma en A4P4 **no se movió ni una palabra** de los textos.

### Lo que se deja fichado

- **La cara no se ha visto con el dedo en un aparato.** Esta fila no tomó el emulador por decisión del dueño. Lo que se afirma es la composición y el montado de A4P3 en el árbol de componentes; que la línea se lea a 1080×2400 lo firma una fila con aparato.
- **Los actos de relación sobre roles de sitio siguen reventando el desenlace.** `carasDelDesenlace` solo devuelve caras de beats humanos y `componeElDesenlace` lanza si un acto no encuentra la suya; `entrega-sospechosa` declara uno sobre `origen`, que es un núcleo. No ha saltado nunca porque las decisiones dentro de una aventura son hoy siempre ninguna. Esta fila lo **cierra para los roles humanos con acto declarado** —por eso existe la cláusula 2— y deja abierto el caso de los roles de sitio, que necesita decidir qué cara de un sitio recibe un acto dirigido al sitio entero. Viene de SPEC-014.
- **La herencia de forma lleva la forma y no el texto.** En un beat de **franja** o **con objeto** las dos mitades del paso no dicen el mismo texto: A4P3 pinta la variante o la vía alternativa, A4P4 la prosa base. Hoy no ocurre —los 21 beats con cara son todos de `llegada`— y está medido y fijado: 147 pasos en `costero`, 5 difieren, **ninguno con cara**. Se pondrá rojo el día que una cara caiga sobre un beat de franja.
- **26 entradas del mapa siguen siendo hueco de batería**, con motivo escrito, y **ocho de ellas son heredadas** de SPEC-010, SPEC-014, SPEC-034 y SPEC-049: esta fila las mueve pero no las adopta.
- **La plantilla de las specs paría specs con las skills equivocadas.** `.claude/skills/wa-spec/references/alcance-clause.md` nombra `/somo-qa-dev`, `/somo-qa-tester` y «SOMO», que en este repo no existen, y `SPEC-050` arrastra el mismo texto. Se corrigió en la spec de esta fila; la raíz es de quien orquesta, junto con la fila que le falta a `.claude/rules/naming.md` para `.claude/skills/**`, que no tiene dueño escrito.

## XXXVII · La fila 52: nada se despierta al arrancar, y la primera batería 100 % verde del proyecto (13-ago-2026)

La deuda más vieja que seguía viva. Desde **SPEC-023** —unas veintinueve filas— el receptor `NotificationsService` de `expo-notifications` escuchaba `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON`, el `QUICKBOOT_POWERON` de HTC y `MY_PACKAGE_REPLACED`: el sistema despertaba a la app al arrancar el móvil, en un juego cuyo diseño dice que **no hay nada que corra con la app cerrada** (`seguridad-privacidad.md` §2). La fila 48 lo sacó a la luz y no lo toleró: hizo que `test/nucleo/manifiesto-generado.test.mjs` **naciera roja** nombrando el defecto, la librería que lo mete y la fila dueña. Esta fila la pone verde de verdad, y con ella la batería de núcleo entera: **primera vez que el proyecto tiene 0 fallos**.

### La medición que decidió el alcance, hecha antes de escribir la spec

Lo que el receptor hace al arrancar es **restaurar notificaciones programadas que hubieran quedado pendientes**. Así que la pregunta era si protege algo real, y se midió en vez de heredarse: en todo el código vivo (`app/`, `packages/`) hay **una sola** llamada que programa notificación, `app/plataforma/notificador.js:95`, con `trigger: null` **literal e incondicional** —ni variable, ni parámetro, ni rama que pueda diferirlo—, y **cero** apariciones de `cancelScheduledNotificationAsync`, `getAllScheduledNotificationsAsync`, `DateTrigger`, `DailyTrigger` o `repeats`. El receptor no tenía nada que restaurar. No hubo que parar ni traer decisión de producto.

### El molde existía y no valía copiado: por clase contra por acción

El punto 3 del plugin ya había hecho esto con el gemelo `expo-task-manager`, quitándole el `intent-filter` **entero**. Aquí eso habría roto todas las notificaciones, y la diferencia es el mecanismo de entrega. A la tarea de ubicación se le entrega con un intent **explícito por clase** (`TaskManagerUtils.java:180`), así que sin filtro no pierde nada. `expo-notifications` **se descubre a sí mismo por la acción declarada en el filtro**: `NotificationsService.kt:403-406` hace `queryBroadcastReceivers(Intent(intent.action).setPackage(...))`, y `doWork` (`:386-393`) sin receptor encontrado escribe «No service capable of handling notifications found» y **no entrega nada**. El reemplazo conserva por tanto un `intent-filter` con `expo.modules.notifications.NOTIFICATION_EVENT` y **solo** pierde las cinco acciones de arranque, más `enabled`, `exported` y el `priority="-1"` del original. Quien toque el receptor de una tercera librería necesita esta distinción: **por clase se puede quitar el filtro; por acción, no**.

### El criterio del encargo estaba pasado de rosca, y se corrigió midiéndolo

El encargo pedía el manifiesto fusionado **sin `RECEIVE_BOOT_COMPLETED`**. Es la décima premisa falsa en diez filas, y no se sostiene por tres sitios, los tres verificados de cero y no heredados de la nota de §7d: `setPersisted(true)` sigue clavado en `TaskManagerUtils.java:205` y `posiciones.js:301,316` sigue llamando a `startLocationUpdatesAsync`, así que sin el permiso la app **revienta** al llegar la primera posición; la guarda **hoy verde** `manifiesto-generado.test.mjs:482` afirma que el permiso **está**; y la lista blanca de `:408` lo admite precisamente porque figura en `PERMISOS_QUE_UNA_LIBRERIA_EXIGE`. La autoridad la tenía la propia guarda roja en su comentario: «el permiso a solas es inerte; lo que despierta es el receptor». El dueño reescribió el criterio como la propiedad —**ningún receptor con disparadores de arranque**— y el permiso se queda declarado con su motivo, con el `aCambio` de `permisos.js` actualizado para cubrir **los dos** receptores neutralizados.

### Verificado

- **@nucleo: 2915 · 2912 · 0 · 3**, tanda `SPEC-052-run-20260813T123431Z`, código de salida `0` leído sin tubería y con `--nucleo-only`. **Es la primera batería de núcleo 100 % verde del proyecto.** Base de `main`: 2906 · 2902 · 1 · 3. El delta cierra exacto: **2906 + 9 casos nuevos = 2915**, y el rojo que se va es la guarda de arranque, que pasa a verde por el manifiesto y no por la prueba.
- **Total comparable**: `manifiesto-generado.estado.json` con `mirado: true` en las **dos** plataformas y `completo: true`, sobre artefactos regenerados hoy — manifiesto fusionado de Android tras `prebuild` + `run:android`, e `Info.plist` tras el `prebuild` de iOS.
- **Medido sobre el artefacto compilado**, que es lo único que cuenta: `NotificationsService` aparece **una sola vez**, con **exactamente** `[expo.modules.notifications.NOTIFICATION_EVENT]`, `enabled=true` y `exported=false`; `TaskBroadcastReceiver` sigue sin ninguna acción; los tres receptores ajenos (Firebase, ProfileInstaller, datatransport) tampoco tienen ninguna de arranque; y `android.permission.RECEIVE_BOOT_COMPLETED` **sigue** declarado.
- **Ninguna guarda se ablandó, y una se endureció.** `plugins-declarados.test.mjs` renombra la huella (`1786783409e1ae1d` → `a3e9ed77ba0d38ff`) con el cometido al día, y **gana un campo `nombraAlMenos`**: el cometido se podía renombrar sin decir que los receptores pasaron de uno a dos, y la huella cambiaba igual. Siguen siendo **2 plugins con su huella**.
- **La exigencia nueva mide en las dos direcciones**: entregar de menos también es rojo. Un reemplazo sin acción, con acciones de más, sin la forma, duplicado o ausente se pone rojo; y hay un caso que lee **el código de la propia guarda** de arranque y exige que no tenga tolerados, ni excepción por clase, ni `skip`.
- Frontera del núcleo intacta: **115 módulos** importan en Node sin React Native ni Expo. `spec-test-map` válido con **3778 entradas**. **Ninguna dependencia nueva.**
- **La nota de SPEC-023 queda saldada en los tres sitios donde vivía**: el comentario de la guarda, la entrada del mapa de SPEC-048 (que pasa a `SALDADO EN SPEC-052` sin borrar que nació roja) y la de SPEC-046, que estaba igual de caduca. Y la cabecera del plugin, que declaraba «No cierra la propiedad entera», ahora dice lo que cierra sin prometer de más.

### Lo que se deja fichado

- **`expo run:android` sobre un `app/android/` que ya existe no vuelve a correr prebuild**, así que un cambio de plugin no llega al manifiesto fuente, `processDebugMainManifest` sale `UP-TO-DATE` y **el fusionado que se mide es el de la tanda anterior**. Hace falta `npx expo prebuild --platform android` delante. Es familia de la trampa del total que baja: el número sale limpio y lo medido es lo viejo. La receta de `manifiesto-generado.estado.json` declara solo `run:android` para Android, y por eso engaña; queda en `CLAUDE.md` y la corrección del texto de la constancia es para quien orquesta.
- **Nadie ha visto el móvil reiniciarse sin que la app despierte.** El paso de oro —`adb reboot` y comprobar con `logcat` que el proceso no aparece— no se dio: esta fila tenía prohibido tomar el emulador. Lo que se afirma es el manifiesto fusionado, que es donde vive la propiedad, y el límite se declara en vez de disimularse.
- **La app quedó instalada y abierta en `wa-pixel`**, porque `expo run:android` instala y lanza como efecto propio y era el comando mandado para regenerar el manifiesto. Cualquier medida de `@app` posterior necesita su `pm clear` antes.
- **`docs/testing.md` no tiene escenario para nada de esto.** 18 de las 20 entradas nuevas del mapa van como hueco de batería con su motivo; los dos casos de `plugins-declarados` sí citan escenario existente.
- **`nombraAlMenos` tiene la misma limitación que la huella**, escrita en su comentario: los dos campos los escribe la misma mano, así que fuerza a mirar pero no impide mentir.
- **La `Rationale` de la fila 52 en el checklist dice RNF-PRIV-001**, que es el proxy sin identificadores y no cubre esta propiedad. Lo que la cubre es **RF-PRIV-003** más `seguridad-privacidad.md` §2, que es lo que cita la spec. La columna la mantiene el humano.
- **El encargo en disco (`docs/prompts/prompt-nada-se-despierta-al-arrancar.md:62`) sigue pidiendo el criterio pasado de rosca.** Quien lo abra después leerá lo viejo; corregirlo es de quien orquesta, que es quien escribe `docs/prompts/**`.

## XXXVIII · La fila 53: los rojos y lo nunca visto, y una causa que llevaba dos días escrita veinte líneas por encima del defecto (13-ago-2026)

Iba a ser la fila de barrer los tres rojos de `@app` que arrastraban las filas 46 y 50, y acabó siendo la fila que descubrió que llevábamos dos días arreglando el problema equivocado. Entrega cuatro cosas: **la apertura de una salida que no depende de que el cielo responda** —precisión alta en la puntual, **una sola cota de frescura de 90 s para cualquier fijo que ancle el punto de partida, venga por la puerta que venga**, respaldo a la última posición conocida con esa misma cota, re-anclaje que corrige el ancla con el primer fijo que repare de verdad, y la línea «Buscando dónde estás…» con tope de 10 s—; **el punto de partida contando para la cadencia del sensor y solo para eso**, por la firma de `cadenciaDeMuestreo` y no por el índice de `sitiosConPosicion`, que alimenta también a las llegadas; **la lista cerrada de vías de despertar** en `app/plataforma/permisos.js`, ahora con receptores **y servicios**, y las tres piezas de FCM retiradas; y **los dos gestos de A6P7**, donde guardar una copia ya no borra la partida. `SPEC-053`, rama `pipeline/SPEC-053-los-rojos-y-lo-nunca-visto`.

### La causa llevaba desde el 11-ago escrita veinte líneas por encima del defecto, y dos cotejos no la cruzaron

Lo que durante dos días se llamó «el proveedor de ubicación frío» **no era el proveedor**: `posicionPuntual()` pedía con `Accuracy.Balanced`, y **con la equilibrada el sistema no enciende el GPS**. Durante los 30-32 s del intento fallido el Event Log de `dumpsys location` no registró **ni una petición**. El comentario que lo explica vive en `app/plataforma/posiciones.js:261-265` desde el 11-ago —es el que justifica la precisión de la suscripción— y está **veinte líneas por encima** de la llamada que lo incumplía. Aun así, **dos cotejos independientes** atribuyeron el rojo al proveedor frío. Los dos leyeron bien lo que veían; lo que veían no era lo que había, y en parte por una segunda trampa que esta fila midió: **`adb emu geo fix` no inyecta nada si nadie pide posición**, porque el GPS del emulador es bajo demanda, así que `dumpsys` parecía decir que el fijo estaba fresco y a mano. Con precisión alta, el mismo aparato pasa **de 30-32 s para un «no» a 5,0 s para un «sí»**, medido en tres tomas con el GPS frío.

La lección no es «mira el comentario de al lado», que ya lo hicimos y no bastó. Es que una causa escrita a veinte líneas puede sobrevivir a dos lecturas cuidadosas cuando la explicación alternativa —el emulador es un cacharro— también encaja con todo lo que se ve. Por eso **la defensa que queda es de forma y no de disciplina**: las dos peticiones leen ahora la misma función, así que no hay dos precisiones que puedan divergir.

### Las tres premisas del encargo, y las tres falsas al medirlas

**La cota de frescura no arreglaba el rojo.** El último fijo conocido del emulador tenía **25 h 24 min**: no hay cota razonable que lo acepte. Y en la dirección contraria, la puntual **ya aceptaba caché rancia sin decirlo** — aperturas medidas con fijos de 90,2 s, 279,6 s y **643,3 s**, y una que ancló con un fijo de 193,5 s y **100 m** de distancia. Una cota puesta solo sobre el respaldo habría sido **más estricta con el caso raro que con el normal**, que es el defecto de fondo del que salió la decisión: dos raseros para el mismo ancla, con el estricto en la puerta rara. De ahí la cota única.

**El telón por regreso no estaba roto: era estructuralmente imposible.** Se montó un arnés diferencial contra el árbol anterior a la fila y se recorrió la misma trayectoria: antes, parado en casa y fuera de todo geofence, **1 fijo en 400 s**, y la permanencia no acumulaba nunca; con la fila, **4 fijos en 20 s** y el telón cae. Lo que se había escrito como una mejora de cadencia era **la condición de existencia** del telón por regreso. El número que lo sostiene, medido en el aparato: **cero fijos en 5 min 56 s** parado con cadencia por distancia, con la contraprueba en la otra dirección —parado con cadencia por tiempo, la marca avanza cada 25-35 s y los metros propios no se mueven—.

**`empezar-de-nuevo-copia` y el botón atrás no eran el mismo pendiente**, que era la sospecha que traía el encargo. La medida que lo decide es un experimento **sin pulsar atrás jamás**: 25 s con la hoja de compartir en pantalla y `files/partida/partida/` **ya vacío**. `Share.share` en Android resuelve al lanzar el chooser, así que la partida se borraba mientras quien juega elegía destino. No era un aviso que no aparecía: era **pérdida de partida**. El pendiente del botón atrás existe aparte y ahora con raíz medida —`app/App.js:234-250` suscribe la `BackHandler` solo con consulta abierta, así que fuera de las cinco pantallas de A6 lo resuelve React Native finalizando la actividad, confirmado en A1P1, A2P1 y A2P3, y confirmado que funciona donde el flujo sí declara vuelta—.

Con eso queda tachado el pendiente que abrió el cotejo de la fila 50: **~~qué hace abrir una salida cuando el aparato no da posición puntual pero hay una última conocida fresca~~ → hecho**, y con el giro de que la pregunta estaba bien planteada sobre una premisa falsa. Lo decidido se sostiene igual sin ella.

### Cuatro defectos que no estaban en el encargo

**La marca mentía.** Cualquier excepción de la posición se archivaba como `permiso-denegado` aunque el permiso estuviera concedido, y con un comentario encima que afirmaba distinguirlos. Es el instrumento diciendo la causa equivocada, que es exactamente lo que costó los dos días de arriba.

**El re-anclaje se gastaba consigo mismo.** Medido en tres tomas: `reanclada: true` con **0 m y 0 ms**, porque el primer fijo de la suscripción era el mismo que ya había devuelto la puntual. Ahora exige que el ancla se mueva **más que la incertidumbre que el propio fijo declara**, y el número no hubo que inventarlo: es `precisionM`, que ya viaja dentro del fijo.

**El cierre por regreso llevaba a una pantalla de avería y no a su telón**, por dos defectos encadenados. Una doble parada del sensor —el núcleo retira el rótulo, lo que para el sensor sin esperar, y la app llama a pararlo otra vez; la guarda no protegía porque entre preguntar y parar hay un `await`—. Y **un flag de pantalla que el cierre por regreso no devolvía**, porque es la única puerta de cierre que no nace de un toque: ocurre dentro de la recepción de una posición.

### Y dos veces el mismo día, la misma forma: el número sale limpio y lo que ha desaparecido es la medición

`apertura-de-salida.yaml` pasaba en verde **saltándose sus dos bloques sustantivos** en las tres tandas. La espera se satisfacía al instante porque la marca por la que esperaba la pinta la portada siempre; y aunque hubiera esperado, las marcas del anclaje se van con la pantalla al abrirse la salida. Un flujo verde que no llegaba a mirar lo suyo.

Y **al último bloque de `docs/testing.md` le faltaba la valla de cierre**, así que `verifica-gherkin.mjs` analizaba **51 bloques de 52 aperturas** y **nunca miró** una característica entera: **4 escenarios sin comprobar**, de antes de esta fila. Es la familia de §6h y de la tubería que se traga el código de salida —la pieza que al no estar no protesta, la comprobación que al no correr no protesta—, y esta vez apareció dos veces en el mismo día por dos caminos que no se parecen en nada. Cuando el instrumento y lo medido comparten mano, el verde no dice nada por sí solo.

### Lo nunca visto, que esta fila vio

**La cara de un beat en A4P3, con el dedo.** La fila 51 dejó fichado que la cara no se había visto en un aparato, y aquí está: `escena-cara` = «SISNANDO O ZURDO · AL FRENTE», semilla `9EK55ZBC4DF10X8Y`, mundo «Comarcas do Solpor» anclado en 42.40 / −8.80, aventura `entrega-sospechosa`, **beat 4 de 4**, sitio «Soutothar da Brétema», coordenada **42.403036 / −8.798905**. Hubo que andar la cadena entera para verla, porque ninguna de las plantillas que se ofrecen el primer día tiene cara en su primer beat. La decisión de la 51 se confirma donde importa: la clave interna del puesto es `regencia` (`packages/nucleo/partida/puestos.js:81`) y en pantalla sale «AL FRENTE», o sea que **la clave no llega a la línea**. El cuerpo sale en parlamento y no hay retrato.

**El telón por regreso, por primera vez en un aparato**: cae solo a los **52 s** de quietud, sin reabrir la app, con `motivo: "regreso"` y `dentroDesdeMs` acumulando.

**El visor no se pudo medir, y el motivo está medido**: el mundo congelado trae los recursos vacíos, así que `resuelvePresentacion` da `hayVisor = false` y **toda llegada cae a ficha** —`visor-anclaje` ausente en las tres llegadas volcadas—. Su dueño ya estaba declarado y sigue sin fila: el lector de recursos. Lo que sí cambia es la sospecha del spread, que sale **reforzada y no exonerada**: el árbol de git enseña que la capa del descarte que midió `[0,2122][1080,2400]` en la fila 50 **sí era la del spread**, y que el arreglo fue escribir las cuatro anclas. El comentario que hoy vive en `app/pantallas/descarte.jsx:20-27` **se equivoca sobre su propia historia** y exonera al visor por un motivo falso. Y no es analogía: `PantallaVisor` y `CapaDescarte` se montan como hermanos del mismo padre en líneas contiguas (`app/pantallas/llegada.js:166` y `:170`), mismo estilo y mismo spread, y de las dos solo una está medida.

### Verificado

- **@nucleo: 2960 · 2957 · 0 fallos · 3 saltados** y **@app: 21 ejecutados · 12 pasan · 0 fallan · 9 de límite declarado**, tanda `SPEC-053-run-20260813T220531Z`, PASS, con `SUITE_EXIT=0` leído de fichero y no de una tubería. Referencia de la fila 52: `@nucleo` 2915 · 2912 · 0 · 3 y `@app` 20 · 8 · **3** · 9. **Es la primera vez que `@app` queda sin ningún rojo**, y los tres que se van son los tres que la fila venía a buscar.
- **Total comparable**: `manifiesto-generado.estado.json` con `mirado: true` en las dos plataformas y `completo: true`. Frontera del núcleo intacta: **115 módulos**. `spec-test-map` válido con **3845 entradas**. La columna de límite declarado **sigue en 9**, sin tocar: ni un flujo se ha marcado para ahorrarse un rojo.
- **Precondición, que va pegada a los números o los números no dicen nada**: `pm clear` antes de cada medida, bucle de `adb emu geo fix` cada 2 s durante toda la tanda, Metro con `EXPO_PUBLIC_PROXY` y los tres `adb reverse`.
- **Tres tandas previas de reproducibilidad, 18 de 18 verdes**, con `pm clear` antes de **cada flujo** —más estricto que antes de cada tanda—, que es lo que permite contar `en-marcha` y `telon` como cerrados y no como una tanda con suerte.
- **Salvedad honesta**: el runner **no** hace `pm clear` entre los 21 flujos de la suite; se apoyan en `clearState`, que borra datos pero no revoca permisos. Es la misma precondición con la que se sacaron los números de referencia, así que la comparación se sostiene, pero conviene saberlo antes de leer el 12 como un absoluto.

### Lo que se deja fichado

- **La caída del servicio en primer plano sigue sin reproducirse.** Dos recorridos conducidos con `logcat` armado antes de abrir la salida, los dos limpios: cero coincidencias de muerte, `kill`, `crash`, `ANR` o `Scheduling restart` sobre `LocationTaskService` en las **17.259 líneas** del primero. Dos recorridos no descartan una intermitencia, y por eso no se cierra.
- **El botón atrás donde el flujo no declara vuelta**, ahora con raíz medida (`app/App.js:234-250`). Es decisión de diseño sin tomar, no arreglo.
- **El telón salta al pasar por delante de casa.** Cruzar los 100 m del radio de regreso dura **71 s** a 1,4 m/s contra los **60 s** de permanencia exigida, así que un lazo que pase por el portal cierra la salida a mitad; a 1,8 m/s son 55,6 s y no salta, que es peor que un fallo limpio. `packages/nucleo/partida/regreso.js:39` promete lo contrario en su comentario. Salió de hacer la aritmética, no de un rojo.
- **El lector de recursos del visor**, sin fila, y con la sospecha del spread abierta encima.
- **Tres flujos más con ramas condicionales no exhaustivas**: `antes-de-salir.yaml`, `llegada.yaml` y el diálogo de permisos de `arranque.yaml`. Misma forma que `apertura-de-salida.yaml` antes de esta fila.
- **Con el rótulo retirado por plazo, la app se queda en la pantalla de «sin cablear» sin vuelta a la portada.** Es comportamiento anterior a la fila y **no se ha medido en aparato**.

## XXXIX · La fila 54: un cuaderno de a bordo para medir sin Metro (14-ago-2026)

`SPEC-054` deja preparada una herramienta exclusivamente de desarrollo detrás de `walkingadventure://desarrollo`: se enciende desde el andamiaje, conserva entre reinicios un JSON Lines bajo su prefijo propio de caché, registra la vida de la salida y los errores globales, y permite compartir el fichero por la hoja del sistema. El cuaderno queda fuera de `partida/`, de sus copias y exportaciones; no envía nada por sí solo, no entra en el bundle de producción y **apagarlo borra tanto el fichero como su marca de activación**. El formato lleva secuencia, instante UTC, tipo cerrado y datos, con un tope total de 5 MiB y descarte declarado de las líneas antiguas.

### Verificado

- Cierre automatizado sobre `a4f84c8`: **@nucleo 2975 · 2972 · 0 · 3** y **@app 22 · 13 · 0 · 9**, PASS; manifiestos de las dos plataformas con `mirado: true` y `completo: true`.
- En aparato se verificó la hoja nativa con un JSONL legible, un error provocado con su pila, una llegada dirigida y el borrado completo al apagar. La hoja no borra ni altera el interruptor.
- El fichero compartido conservó la privacidad declarada: contiene datos reales solo dentro de la caché del aparato y sale únicamente por una acción manual de quien prueba; no apareció en la partida, copia ni exportación.
- Al provocar el error apareció **LogBox** mientras el manejador global anterior recibía el error, y el cuaderno lo registró antes con su pila. Es la incidencia visible de conservar el comportamiento global previo, no una pérdida del registro.
- `docs/testing.md` no traía escenarios para esta herramienta. La cobertura se añadió al mapa como **huecos de batería declarados**, en vez de fingir que un escenario anterior la medía.
