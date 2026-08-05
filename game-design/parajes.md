# Taxonomía de parajes (4-ago-2026)

Los parajes son hitos no habitados: escenarios para quests fuera de la civilización (el lugar de la emboscada, la ruina del bandido, el cruce donde esperar al anochecer). No tienen servicios ni población; tienen tipo, nombre y afinidades de escena.

## Principio: tipo desacoplado del anclaje real

El anclaje real solo aporta coordenadas y tierra firme; el tipo fantástico lo asigna el generador. Una "ruina" puede ser perfectamente un chiringuito en la playa: el jugador le echa imaginación. Esto significa que cualquier POI real sobrante (tras repartir núcleos y servicios) es candidato a paraje, no solo los que tengan tags "pintorescos".

## Los 8 tipos

| Tipo | Afinidades de escena (con pesos) | Tags reales que le dan sesgo |
|---|---|---|
| Ruina | guarida 0.4 · emboscada 0.2 · misterio 0.2 · refugio 0.2 | `historic=ruins/castle/city_gate`, `abandoned:*` |
| Piedra antigua | ritual 0.4 · misterio 0.4 · revelación 0.2 | `historic=archaeological_site/wayside_cross`, dólmenes, petroglifos, cruceiros |
| Ermita | refugio 0.4 · encuentro 0.4 · ritual 0.2 | `historic=wayside_shrine`, capillas aisladas |
| Fuente | encuentro 0.5 · refugio 0.3 · misterio 0.2 | `natural=spring`, `amenity=fountain` (ver nota) |
| Atalaya | revelación 0.5 · vigilancia 0.3 · encuentro 0.2 | `man_made=tower/lighthouse`, `tourism=viewpoint`, picos |
| Cruce | emboscada 0.35 · encuentro 0.25 · vigilancia 0.2 · peaje 0.2 | intersección de 2+ rutas nombradas del grafo (sin Overpass) |
| Puente | peaje 0.25 · guarida 0.2 · emboscada 0.2 · encuentro 0.2 · duelo 0.15 | arista del grafo que cruza un `waterway` (o `bridge=yes`) |
| Monasterio | refugio 0.4 · saber 0.4 · ritual 0.2 | `amenity=monastery`, conventos, iglesias grandes aisladas |

Vocabulario de escenas: emboscada, encuentro, misterio, refugio, revelación, ritual, guarida, peaje, duelo, vigilancia, saber. El generador de quests elegirá escena según trama, ponderando por estas afinidades (decisión: etiquetas múltiples con pesos, no afinidad fija ni libre).

### Nota (4-ago-2026): `amenity=drinking_water` queda excluido

La versión inicial de esta tabla listaba `amenity=fountain/drinking_water` para Fuente. `drinking_water` se retira de la consulta de anclajes por dos motivos medidos sobre los 4 mundos de referencia (Sanxenxo, Toledo, Madrid, A Coruña):

- **No da reconocimiento.** Es mobiliario urbano sin nombre: A Coruña 186 anclajes con 3 nombrados, Toledo 16 con ninguno. El sentido del anclaje es el guiño de identificar el lugar real, y un caño sin nombre no lo permite. `amenity=fountain` sí: en Madrid, 27 de 78 tienen nombre.
- **Rompe la diversidad que pide este mismo documento.** Por volumen monopolizaba el sesgo hacia el tipo Fuente — literalmente "cinco fuentes" en vez de "uno de cada". Con él dentro, A Coruña se quedaba sin ningún paraje con escena de vigilancia o revelación y la plantilla "ronda del vigía" no casteaba (5/6); fuera, vuelve a 6/6, y Toledo pasa de 25 fuentes candidatas a 9 con reparto diverso.

Regla general que se deriva: **un tag solo entra si aporta reconocimiento**. Al ampliar la consulta de anclajes hay que vigilar que un tag masivo no inunde el pool, porque el sesgo de tipo es por `kind` y el volumen se traduce en monotonía.

## Asignación de tipo: sesgo suave

El tipo se asigna con la semilla, garantizando diversidad (mejor uno de cada que cinco fuentes), pero si el lugar real "pega" con un tipo (una torre real, un manantial real, una capilla real), ese tipo recibe más peso en el sorteo. Resultado: sorpresa casi siempre, y de vez en cuando el guiño de reconocer el lugar real en su versión fantástica. Cruce y Puente son la excepción: su posición sale del grafo viario, así que su tipo viene dado.

## Selección cuando hay exceso de candidatos

Con más candidatos que huecos se puntúa cada anclaje con dos criterios (decisión: sin reparto espacial explícito, sin azar puro):

- **Cerca de una ruta** (+): anclajes a <100 m de una calzada nombrada. Un paraje al que no lleva ningún camino no se usará en quests ni se verá al caminar.
- **Lejos de núcleos** (+): se penalizan anclajes dentro del radio urbano de un núcleo. Un paraje pegado a la ciudad no se siente paraje y compite con los servicios por anclajes.

Sobre los mejor puntuados se sortea con la semilla (el azar desempata, no manda).

## Cupos y escasez

Cupo orientativo por radio: 250 m → 1, 500 m → 2, 1 km → 4, 2 km → 6-8 (interpolando como los núcleos; por encima, saturar en ~8: más parajes no añaden beats a una aventura de 3 h).

En páramos OSM sin anclajes suficientes, el colchón son **Cruce y Puente**: salen del grafo viario ya calculado, sin Overpass, y existen en cualquier mundo con carreteras. Garantizan un mínimo de 2-3 parajes siempre; los demás tipos solo aparecen si hay anclajes reales (no se inventan posiciones sintéticas).

## Nombres: idioma según ubicación del mundo

Decisión: el idioma de los nombres depende de dónde se genera el mundo. Mundo en Galicia → registro gallego/atlántico ("A Pedra da Moura", "O Cruceiro Vello", "A Fonte da Santa"); resto → castellano fantástico ("La Torre Rota", "El Dolmen del Alba", "El Cruce del Ahorcado"). Patrón común: artículo + sustantivo + epíteto, reutilizando el vocabulario direccional existente.

~~Implicación pendiente: para coherencia, los nombres de núcleos y rutas deberían seguir el mismo criterio de idioma que los parajes (hoy son castellano siempre).~~ → **hecho**: el idioma no se resuelve por tipo de elemento sino una sola vez para el mundo entero. `build.js` hace `namesFor(localeFor(lat, lon))` y pasa ese paquete a todas las fases, y `app/js/names/gl.js` implementa la interfaz completa —`townName`, `farmName`, `poiName`, `roadName`, `directionWord`, `parajeName`, `worldTitle`—, así que en Galicia también los núcleos, las granjas, los servicios y las calzadas salen en gallego. Añadir un idioma es añadir un fichero que implemente esa interfaz.

Sigue en pie la limitación de cómo se detecta la región: **es un bounding box**, no límites administrativos, así que un mundo generado en el occidente de Asturias o en el Bierzo sale en gallego. A futuro, límites administrativos de OSM.
