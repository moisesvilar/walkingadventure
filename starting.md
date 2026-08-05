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
