# Parámetros del mundo para aventuras a pie (4-ago-2026)

Reflexión de diseño para dimensionar el mundo pensando en el juego final: un RPG con NPCs generados y quests que el jugador completa caminando físicamente por el mundo real. Pasarán cosas en ciertos puntos, habrá que viajar a ellos, ir a ciertos lugares en ciertos momentos para ver escenas, visitar a personajes en puntos concretos, etc.

## 1. Radio óptimo: 1-1,5 km, elegido por duración y no por km

Base física: a pie se hacen 4-5 km/h, así que una aventura de 1-3 h son 4-15 km caminados en total. El jugador no camina en línea recta: la distancia real por calles es ~1,3-1,4× la distancia en línea recta (factor de rodeo; en costa con rías, más).

Una aventura es una cadena de "beats" (ve a la taberna → habla con X → ve al punto Y a tal hora → vuelve), no un único cruce del mapa. La distancia media entre dos puntos aleatorios de un círculo de radio r es ~0,9·r; con el factor de rodeo, cada tramo son ~1,2·r reales. Con 6-8 tramos por aventura, el total caminado es ~7-10 veces el radio.

| Duración objetivo | Km caminados | Radio recomendado |
|---|---|---|
| ~1 h (paseo) | 4-5 km | 0,6-0,8 km |
| ~2 h (aventura) | 8-10 km | 1,2 km |
| ~3 h (jornada) | 12-15 km | 1,8-2 km |

Consecuencias de diseño:

- El usuario debería elegir duración, no kilómetros: "¿Cuánto quieres que dure tu aventura?" con tres presets (paseo / aventura / jornada) es mejor UX que un slider de km. El slider actual queda como herramienta de testing. (Decisión pendiente: convivencia presets + slider en el prototipo.)
- Las quests deberían tender a rutas circulares: el jugador empieza donde aparcó/vive y debería acabar cerca. El generador de quests debe encadenar puntos formando un lazo, no ping-pong entre extremos del mapa.
- Un tramo individual nunca debería superar ~30-35 min (cruzar el diámetro de un mundo de 1,2 km ya son ~35 min reales); si una quest lo exige, se trocea con un beat intermedio.

## 2. Núcleos de población: la tabla actual encaja, más una categoría nueva

Para r = 1,2 km la interpolación actual da ~1 ciudad, 1-2 pueblos, 2-3 aldeas, 3-4 granjas: 7-9 núcleos. Comprobación de ritmo: 8 núcleos en un círculo de 1,2 km dan una separación típica de ~350-450 m, es decir, un núcleo cada 5-7 minutos andando — el ritmo de "siempre hay algo en el horizonte" que quiere un juego de caminar. Los cupos de 1-2 km se quedan como están; los tramos de 5-20 km pasan a ser irrelevantes para el juego (testing o un hipotético modo "campaña" de varios días).

### Parajes (hitos no habitados) — categoría nueva

Ahora mismo todo el mapa es núcleos + servicios: todo es "civilización". Pero las quests necesitan escenarios que no sean una taberna: el lugar de la emboscada, la ruina donde acampa el bandido, el cruce de caminos donde esperar al anochecer. OSM está lleno de anclajes reales perfectos:

- Ruinas (castillos, molinos, fábricas abandonadas → `historic=ruins/castle`): la "mazmorra" de superficie.
- Piedras antiguas (dólmenes, menhires, petroglifos → `archaeological_site`; Galicia está sembrada).
- Ermitas y cruceiros (santuarios aislados, encuentros con eremitas).
- Torres y faros (vigías, señales).
- Fuentes y manantiales (`natural=spring`): punto de encuentro clásico.
- Puentes y cruces de la red vertebral — ya calculados gratis en el grafo viario: cada intersección de dos rutas nombradas es un "cruce del Camino del Este con la Senda del Mediodía", oro narrativo.
- Miradores y picos (ya se descargan): escenas de revelación, avistamientos.

Cupo orientativo: 4-8 parajes para r = 1,2 km, priorizando los que caen sobre o cerca de las rutas (a <100 m de una calzada nombrada), porque un paraje al que no lleva ningún camino no se usará. Los parajes no tienen servicios ni población; tienen nombre, tipo y "afinidad de escena" (emboscada / encuentro / misterio / descanso). Taxonomía detallada: pendiente de definir.

### Tipos de núcleo adicionales

Mejor no añadir tamaños nuevos (¿villa? ¿burgo?): complican los cupos sin aportar jugabilidad. A lo sumo un núcleo especial no-poblacional: el monasterio/priorato (ancla natural: iglesias y conventos reales grandes), porque funciona distinto — da curación y saber, no comercio — y es un generador de quests clásico. Todo lo demás cabe como paraje.

## 3. Puntos de interés: dimensionados por beats de quest

Regla de ritmo: un beat (escena, conversación, entrega) cada 10-15 min → una aventura de 2 h consume 8-12 localizaciones. Para que el generador de quests tenga dónde elegir y dos aventuras en el mismo mundo no se sientan idénticas, el mundo debe ofrecer ~2-3× ese número: 25-35 localizaciones utilizables en r = 1,2 km. Con los cupos actuales hay ~12-16 servicios + 8 núcleos; añadiendo 4-8 parajes y un par de POIs nuevos por núcleo se llega justo a ese rango.

### Servicios nuevos (pensando en NPCs y quests, no en tiendas)

- Templo/capilla: el anclaje real más abundante (iglesias) y hoy no se usa como servicio, solo como posible aldea. Curación, bendiciones, el sacerdote que sabe cosas.
- Casa del gremio / ayuntamiento con tablón de anuncios: punto de entrada mecánico de las quests ("mira el tablón"). Solo en ciudades y pueblos.
- Casas de NPC: los NPCs con nombre deberían vivir en un edificio real concreto, igual que los servicios. No es un tipo de tienda, es una capa nueva: cada NPC importante lleva su anclaje real. Reutiliza el mecanismo de anclaje único (`taken`) existente.
- Puerto/embarcadero en mundos costeros (anclaje: puertos reales): justifica narrativamente el mar.

### Reducción

La conjurería y la armería deberían ser más raras (solo ciudad, quizá un pueblo grande): la escasez crea motivo de viaje — "el único herrero está en Ribacades" es una quest en sí misma.

## Síntesis

Mundo estándar del juego: radio ~1,2 km (elegido como "aventura de 2 h"), 1 ciudad + 1-2 pueblos + 2-3 aldeas + 3-4 granjas (tabla actual), +4-8 parajes no habitados anclados a ruinas/fuentes/cruces reales priorizando los que tocan rutas, +templo y tablón como servicios nuevos, +NPCs con casa propia anclada a edificio real. Total ~30 localizaciones: suficiente para aventuras de 8-12 beats sin repetirse.

## Pendientes

1. ~~Definir la taxonomía de parajes~~ → hecha, ver `parajes.md` (tipo desacoplado del anclaje real, sesgo suave, escenas con pesos, cruces/puentes como colchón, nombres por idioma según ubicación).
2. ~~Presets vs slider~~ → decidido: **presets + modo avanzado**. El selector muestra los 3 presets de duración como opción principal (paseo ~1 h → 0,7 km, aventura ~2 h → 1,2 km, jornada ~3 h → 1,9 km) y un desplegable "avanzado" con el slider de km actual para testing. El juego final hereda los presets; el slider queda como herramienta de depuración.
