# SPEC-005 — El pool de anclajes reales y sus filtros

## Descripción

Construye la bolsa de lugares reales de la que cuelga todo lo ficticio de una celda: qué POI del mundo real entra, cuál se descarta por no ser apto o por no aportar reconocimiento, cuál se lleva un núcleo, cuál un servicio y cuáles quedan libres para los parajes. Un anclaje se gasta una sola vez y no vuelve; ninguna etiqueta masiva puede llenar el pool ella sola; y lo que no es apto para menores —bares de copas, locales de adultos, industria, obras, propiedad privada— se cae al generar, no al pintar.

No tiene interfaz de usuario: es una pieza del núcleo determinista. La ve el jugador solo de rebote, en el guiño de reconocer que O Torreón Esquecido es el chiringuito de la esquina.

Anclas: **RF-MUNDO-006**, **RF-MUNDO-009**, **RF-MUNDO-010** y **RF-MUNDO-011** (`docs/prd.md` §4.1), con `game-design/parajes.md` como fuente que manda sobre el PRD —«Selección cuando hay exceso de candidatos», la nota de `amenity=drinking_water` y «Fuente de anclajes: OSM de base, Google Places de relleno»— y `game-design/seguridad-privacidad.md` §3 para el filtro previo por tipos. El riesgo 1 del PRD (§8, los términos de Places) es el que obliga a que la fuente de relleno sea opcional y su ausencia inocua.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la toca**: el pool admite una segunda fuente de datos inyectada (Places), y está descrita en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** la llamada de red que trae los datos (el proxy es SPEC-023 y el Overpass de producción SPEC-024, y esta spec solo consume lo que le inyecten ya descargado); la asignación de tipo de paraje y la cobertura de escenas (SPEC-006, que consume el pool que aquí se construye); la derivación de cruces y puentes desde el grafo (SPEC-007); el gesto del jugador para descartar un anclaje (SPEC-035, que solo necesita que el pool sepa excluir por identificador, y esta spec se lo deja puesto).

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «La admisión al pool» y «Uso único y reparto de lo que sobra»; la validación de entradas, en «El filtro de tipos problemáticos» y «La regla del reconocimiento»; el estado vacío, en «Escasez, déficit y celdas pobres» (celda sin ningún POI, pool que se queda por debajo de la demanda, fuente de Places ausente); el estado de error, en la fuente que llega rota o sin identificadores y en el consumidor que intenta gastar dos veces el mismo anclaje; y los casos límite, en el tope que dejaría el pool por debajo del suelo, el POI sin nombre, el duplicado entre fuentes y el anclaje justo en el borde del radio urbano.

Los criterios se escriben en Gherkin español, el mismo `Dado / Cuando / Entonces` de `docs/testing.md`. «Mundo congelado X» significa el fixture `test/fixtures/osm/X/` que entregó SPEC-001.

### La admisión al pool

- **Dado** los datos crudos de una fuente OSM, **cuando** se construye el pool de la celda, **entonces** cada anclaje admitido lleva identificador estable, fuente, posición en metros, nombre (o su ausencia declarada), la etiqueta `clave=valor` que lo admitió, su `kind` y su peso.
- **Dado** un elemento de OSM, **cuando** se admite en el pool, **entonces** su identificador es el del elemento real (`tipo` y `id` de OSM), no una posición en la lista ni un índice de recorrido.
- **Dado** un elemento cuya etiqueta no está en el catálogo de admisión, **cuando** se construye el pool, **entonces** no entra.
- **Dado** el catálogo de admisión, **cuando** se inspecciona, **entonces** es una lista cerrada de etiquetas `clave=valor`, sin comodines que admitan una clave entera.
- **Dado** un elemento sin coordenada utilizable (ni propia ni de centro), **cuando** se construye el pool, **entonces** se descarta sin interrumpir la construcción.
- **Dado** el mundo congelado urbano denso, **cuando** se construye el pool, **entonces** ningún anclaje admitido cae fuera del radio de la celda.
- **Dado** el mundo congelado costero, **cuando** se construye el pool, **entonces** ningún anclaje admitido cae en mar según la máscara tierra/mar.

### El filtro de tipos problemáticos

- **Dado** el mundo congelado urbano denso, que trae 769 locales de adultos y bares de copas, **cuando** se construye el pool, **entonces** ninguno de ellos aparece en el pool.
- **Dado** el mundo congelado urbano denso, **cuando** se genera el mundo entero, **entonces** ningún núcleo, servicio ni paraje queda anclado a un local de adultos o a un bar de copas.
- **Dado** una fuente que trae `amenity=bar`, `pub`, `nightclub`, `stripclub`, `casino`, `gambling`, `brothel` o `leisure=adult_gaming_centre`, **cuando** se construye el pool, **entonces** ninguno entra.
- **Dado** una fuente que trae `shop=erotic`, `alcohol`, `tobacco` o `bookmaker`, **cuando** se construye el pool, **entonces** ninguno entra.
- **Dado** una fuente que trae industria (`landuse=industrial` o `quarry`, `man_made=works`, `wastewater_plant`, `silo` o `chimney`, `amenity=fuel`), **cuando** se construye el pool, **entonces** ninguno entra.
- **Dado** una fuente que trae obras (`landuse=construction`, `building=construction`, `highway=construction` o cualquier `demolished:*`), **cuando** se construye el pool, **entonces** ninguno entra.
- **Dado** una fuente que trae propiedad privada o vivienda (`access=private`, `access=no`, `building=house`, `residential` o `apartments`), **cuando** se construye el pool, **entonces** ninguno entra.
- **Dado** un elemento con `abandoned:*`, **cuando** se construye el pool, **entonces** sí entra, porque es material de ruina y no una obra.
- **Dado** un elemento que casa a la vez con el catálogo de admisión y con el filtro de tipos problemáticos, **cuando** se construye el pool, **entonces** manda el filtro y el elemento no entra.
- **Dado** una entrada de la fuente de Places que es un local de adultos, **cuando** se construye el pool, **entonces** se descarta con el mismo filtro que las de OSM.
- **Dado** el filtro de tipos problemáticos, **cuando** se inspecciona dónde se aplica, **entonces** se aplica al construir el pool y no depende de que la consulta de datos haya evitado pedir esas etiquetas.

### La regla del reconocimiento

- **Dado** una celda cuyos datos traen cincuenta fuentes de agua potable, **cuando** se construye el pool, **entonces** ninguna se usa como anclaje.
- **Dado** el mundo congelado urbano denso, que trae 86 `amenity=drinking_water`, **cuando** se construye el pool, **entonces** el pool no contiene ninguna.
- **Dado** una etiqueta con más de veinte entradas en la celda de las que menos del 10 % tiene nombre, **cuando** se construye el pool, **entonces** esa etiqueta se descarta entera para esa celda.
- **Dado** el mundo congelado urbano denso, que trae 78 `amenity=fountain` con 27 nombradas, **cuando** se construye el pool, **entonces** la etiqueta no se descarta por la regla anterior.
- **Dado** un pool ya admitido, **cuando** se cuenta cuántos anclajes aporta cada etiqueta `clave=valor`, **entonces** ninguna supera el 25 % del total.
- **Dado** un pool ya admitido, **cuando** se cuenta cuántos anclajes aporta cada `kind`, **entonces** ninguno supera el 40 % del total.
- **Dado** una etiqueta que excede su tope, **cuando** se recorta, **entonces** los que se conservan son los mejor puntuados y, a igualdad, los que tienen nombre.
- **Dado** una celda cuyo pool bajaría del suelo de la demanda al aplicar los topes, **cuando** se construye el pool, **entonces** los topes se relajan lo justo para alcanzar el suelo y el pool declara que se relajaron.
- **Dado** el mundo congelado urbano denso, **cuando** se generan los parajes sobre el pool, **entonces** los tipos de paraje siguen repartidos y ninguno se lleva más de la mitad.

### Uso único y reparto de lo que sobra

- **Dado** un mundo generado entero, **cuando** se recogen los anclajes de todos los núcleos, servicios y parajes, **entonces** ningún identificador de OSM ni de Places aparece más de una vez.
- **Dado** un anclaje que un núcleo acaba de tomar, **cuando** se piden los anclajes libres, **entonces** ese anclaje ya no está entre ellos.
- **Dado** los núcleos y servicios ya generados, **cuando** se pasan los anclajes libres a los parajes, **entonces** son exactamente los no tomados, ni uno más ni uno menos.
- **Dado** un anclaje ya tomado, **cuando** otro consumidor intenta tomarlo, **entonces** la toma falla con un error que nombra el anclaje y a quién lo tenía.
- **Dado** un anclaje tomado, **cuando** se consulta el pool, **entonces** consta quién lo consumió: núcleo, servicio o paraje.
- **Dado** una taberna anclada al bar «Casa Manuela», **cuando** se genera la tabernera que trabaja allí, **entonces** el número de anclajes tomados no cambia, porque heredar no es consumir.
- **Dado** un cruce o un puente derivado del grafo viario, **cuando** se coloca como paraje, **entonces** no toma ningún anclaje del pool.
- **Dado** el pool de una celda, **cuando** se pide excluir un anclaje por su identificador, **entonces** deja de estar disponible sin que se regenere nada de lo ya colocado.

### La puntuación de candidatos

- **Dado** un anclaje libre a menos de 100 m de una calzada nombrada, **cuando** se puntúa, **entonces** recibe más puntos que uno equivalente a más de 300 m.
- **Dado** un anclaje libre dentro del radio urbano de un núcleo, **cuando** se puntúa, **entonces** recibe una penalización frente a uno equivalente fuera de él.
- **Dado** dos anclajes libres con la misma distancia a ruta y a núcleo, **cuando** se puntúan, **entonces** el que tiene nombre propio queda por delante.
- **Dado** un anclaje dentro del radio urbano de un núcleo, **cuando** es el único candidato que queda, **entonces** se puede usar igual: la penalización ordena, no excluye.
- **Dado** una celda sin ninguna calzada trazada todavía, **cuando** se puntúan los anclajes libres, **entonces** la puntuación se calcula sin fallar y la distancia a ruta no aporta nada a ninguno.
- **Dado** el mismo pool y el mismo mundo, **cuando** se puntúa dos veces, **entonces** el orden resultante es idéntico.

### Google Places como relleno

- **Dado** una celda sin fuente de Places inyectada, **cuando** se construye el pool, **entonces** se construye solo con OSM y no falla.
- **Dado** una celda generada sin Places y la misma celda generada con Places disponible pero sin déficit que cubrir, **cuando** se comparan los dos mundos, **entonces** son idénticos.
- **Dado** una celda cuyo pool de OSM ya cubre la demanda, **cuando** se ofrece una fuente de Places, **entonces** no se admite ninguna entrada de Places.
- **Dado** una celda cuyo pool de OSM se queda corto para la demanda, **cuando** se ofrece una fuente de Places, **entonces** entran como mucho las entradas que faltan para alcanzar la demanda.
- **Dado** una entrada de Places admitida, **cuando** se persiste el mundo, **entonces** su `place_id` se guarda como campo estable de la partida.
- **Dado** una entrada de Places admitida, **cuando** se persiste el mundo, **entonces** su nombre y su coordenada quedan marcados como contenido refrescable, con la fecha en que se capturaron.
- **Dado** una entrada de Places refrescada más tarde, **cuando** se compara el mundo antes y después, **entonces** la capa de ficción —nombres, tipos, posiciones en el mapa— no ha cambiado.
- **Dado** una entrada de Places a menos de 25 m de un anclaje de OSM ya admitido y de tipo compatible, **cuando** se construye el pool, **entonces** se considera el mismo lugar y no entra por segunda vez.
- **Dado** una fuente de Places que devuelve solo categorías de negocio pequeño, **cuando** se construye el pool, **entonces** se le aplican los mismos topes por etiqueta y por `kind` que a OSM.
- **Dado** una fuente de Places que falla o llega vacía, **cuando** se construye el pool, **entonces** el mundo se genera con el pool de OSM y la celda queda registrada como generada sin relleno.
- **Dado** una entrada de Places sin `place_id`, **cuando** se construye el pool, **entonces** se descarta, porque sin identificador estable no se puede garantizar el uso único.

### Determinismo y orden

- **Dado** los mismos datos crudos y la misma semilla, **cuando** se construye el pool dos veces, **entonces** los dos pools son idénticos elemento a elemento y en el mismo orden.
- **Dado** los mismos datos crudos con los elementos en otro orden de llegada, **cuando** se construye el pool, **entonces** el pool resultante es idéntico al anterior.
- **Dado** la construcción del pool, **cuando** se inspecciona su implementación, **entonces** no usa `Math.random`, ni el reloj del sistema, ni recorre ningún `Set` o `Map` cuyo orden dependa de la inserción.
- **Dado** la construcción del pool, **cuando** se inspecciona qué azar usa, **entonces** usa un generador sembrado con su propio sufijo de fase, distinto del de núcleos, rutas y parajes.
- **Dado** dos semillas distintas sobre los mismos datos crudos, **cuando** se construyen los pools, **entonces** el conjunto de anclajes admitidos es el mismo y solo cambia el desempate del orden.
- **Dado** un mundo ya generado, **cuando** cambian los datos de OSM de esa zona, **entonces** el pool congelado del mundo no cambia.

### Escasez, déficit y celdas pobres

- **Dado** el mundo congelado barrio de tres calles, que no trae ningún POI admisible, **cuando** se construye el pool, **entonces** el pool queda vacío y la construcción no falla.
- **Dado** un pool vacío, **cuando** se piden los anclajes libres, **entonces** se devuelve una lista vacía y no un error.
- **Dado** un pool que no llega a la demanda de la celda, **cuando** termina la construcción, **entonces** declara el déficit con su número, no lo esconde.
- **Dado** el mundo congelado suelo de 250 m, **cuando** se construye el pool y se genera la celda, **entonces** el mundo sigue alcanzando el suelo de parajes apoyándose en cruces y puentes del grafo.
- **Dado** una fuente de datos que llega vacía o sin el campo de elementos, **cuando** se construye el pool, **entonces** se obtiene un pool vacío en lugar de una excepción.
- **Dado** una fuente de datos malformada —elementos sin tipo ni identificador—, **cuando** se construye el pool, **entonces** falla con un error que nombra la fuente y el primer elemento inválido.

## Notas técnicas

### Frontera de inyección

Esta spec **sí** toca la frontera del núcleo, y en un solo punto: el pool pasa de recibir una lista de POIs ya parseada a recibir **fuentes de datos crudas, una obligatoria y otra opcional**.

- La fuente de OSM es la respuesta cruda de Overpass, tal como la congelan los fixtures de SPEC-001.
- La fuente de Places es **opcional**. Su ausencia es un caso normal, no un fallo degradado: la mitad de los criterios de esta spec existen para clavarlo. Quien construye el mundo la inyecta si la tiene.
- **La llamada de red no entra en el núcleo.** El núcleo expone el catálogo de etiquetas admisibles y el filtro como datos, para que la capa de fuera arme la consulta; ejecutarla es de SPEC-023 y SPEC-024.

Consecuencia práctica: `packages/nucleo/` no puede importar nada que hable con la red, y el pool tiene que poder construirse en `node --test` con un fixture en la mano y sin conexión.

### Dos etapas, porque el pipeline las obliga

El pool no se puede terminar de una sentada: la puntuación necesita saber dónde están las calzadas y los núcleos, y esos no existen todavía cuando el pool se construye. Quedan dos etapas explícitas, y la separación no es estética sino el orden real de la tubería:

1. **Admisión** — filtro de tipos problemáticos, catálogo de etiquetas, regla del reconocimiento, topes, relleno de Places y deduplicación. Ocurre justo después de parsear, antes de los núcleos.
2. **Puntuación** — cerca-de-ruta y lejos-de-núcleo sobre los anclajes que quedaron libres. Ocurre cuando ya hay núcleos y calzadas, que es donde hoy vive `generateParajes`.

El mecanismo de uso único es transversal a las dos: cualquier fase puede tomar, y tomar es irreversible dentro de la generación de esa celda.

### Lo que se porta y lo que se refina

`app/js/world/settlements.js` ya tiene el mecanismo `taken` con `freeAnchors`, y funciona. Se porta, con tres refinamientos que no son gusto sino requisitos de esta spec:

- **Identidad estable**. Hoy `taken` es un `Set` de referencias a objetos y `parsePois` **no conserva el `id` de OSM**. Sin identificador no se puede afirmar «ningún identificador aparece más de una vez» (que es el escenario literal de la batería), ni serializar el mundo congelado, ni excluir un anclaje descartado por el jugador. El identificador pasa a ser un campo del anclaje.
- **El filtro deja de ser una omisión de la consulta**. Hoy la aptitud para menores se consigue no pidiendo bares: si mañana alguien amplía la consulta, el filtro desaparece sin que nada se ponga rojo. Los fixtures de SPEC-001 piden a propósito los bares y el agua potable precisamente para poder afirmar el filtro sobre el dato. La consulta puede seguir siendo estrecha —es una optimización de ancho de banda—, pero la garantía es el filtro.
- **Lejos-de-núcleo pasa de filtro duro a penalización**. `generateParajes` hoy excluye por completo lo que cae dentro del radio urbano (`outsideTowns`). `parajes.md` dice literalmente «se penalizan», y en una celda pequeña y urbana el filtro duro vacía el pool. Se convierte en puntuación negativa, que ordena sin excluir.

### Los números, y de dónde salen

| Regla | Valor | De dónde |
| --- | --- | --- |
| Tope por etiqueta `clave=valor` | 25 % del pool | Elegido en esta spec; ver Decisiones asumidas |
| Tope por `kind` | 40 % del pool | Íd. |
| Descarte por falta de nombre | etiqueta con >20 entradas y <10 % nombradas | Generalización de la nota medida de `parajes.md`: `drinking_water` da 3/186 en A Coruña y 0/16 en Toledo; `amenity=fountain` da 27/78 en Madrid y se queda |
| Cerca de ruta | <100 m suma más que <300 m | Portado de `parajes.js`, que lo tomó de `parajes.md` |
| Deduplicación Places ↔ OSM | 25 m y tipo compatible | Elegido en esta spec |

`amenity=drinking_water` sigue **excluido por nombre** además de por la regla general, y no se reintroduce aunque `parajes.md` lo liste en la tabla de tipos: la nota del 4-ago-2026 de ese mismo documento lo retira con medición delante. La regla general existe para que el próximo tag masivo no haya que descubrirlo a mano.

La **demanda de la celda** —cuántos anclajes hacen falta— no se calcula aquí: sale de los cupos de núcleos y servicios (SPEC-003) y del suelo y techo de parajes (SPEC-006), y llega inyectada como un número. Duplicar esos cupos en esta spec garantizaría que las dos copias se desincronicen.

### Places y los términos: cómo se guarda lo que no se puede guardar

El riesgo 1 del PRD y la primera cautela de `parajes.md` dicen lo mismo: de Places solo el `place_id` se puede almacenar indefinidamente. Y `bucle-jugable.md` §5 dice que el mundo se congela y no se resiembra jamás. Las dos cosas conviven separando el mundo en dos capas:

- **Capa de ficción** — nombre fantástico, tipo, posición en el mapa, escenas. Se congela al crear la celda y no la toca nadie, venga de donde venga el anclaje.
- **Capa del lado real** — el nombre del sitio, su foto, su dirección. Para los anclajes de Places es contenido refrescable, guardado junto a su `place_id` y su fecha de captura, y se puede tirar y volver a pedir sin que la ficción se entere.

Si los términos bloquean el uso, o no hay red, la degradación ya está diseñada y no es nueva: el pool se queda en OSM y el visor cae a cartela sin foto (RF-BUCLE-007). Nada de la estructura del mundo depende de ello, y hay criterios de aceptación que lo afirman.

Nota de privacidad que esta spec hereda y no puede aflojar: los anclajes de Places viajan **en la misma tanda que la consulta de generación del mapa**, nunca por aventura (`seguridad-privacidad.md` §1, RF-MUNDO-016), y el nombre real del sitio no entra jamás en un prompt del LLM.

### Escenarios de `docs/testing.md` que esta spec tiene que hacer verdad

Se citan por su nombre literal. Ninguno se implementa aquí —son de `wa-qa-dev`— pero son el contrato contra el que se mide la entrega:

- Característica «Los anclajes reales son de uso único»: «Ningún anclaje aparece dos veces», «Los parajes reparten lo que los núcleos no gastaron», «Un NPC no consume anclaje propio».
- Característica «El juego es apto por diseño y no distingue a un menor»: «Los anclajes de adultos se excluyen del pool».
- Característica «El mundo de una celda es jugable por construcción»: «Un tag masivo no monopoliza un tipo de paraje», y de refilón «El cupo por ritmo es un techo, no un objetivo» y «El mundo mínimo todavía compone un lazo», que esta spec no puede romper por quedarse sin anclajes.
- Característica «El mundo es una función de la semilla y de los datos de OSM»: «Dos generaciones con la misma semilla dan el mismo mundo», «Cada fase usa su propio sufijo de azar», «No se usa ninguna fuente de azar ni de tiempo del sistema», «El orden de iteración no depende del orden de inserción».
- Característica «El mundo se congela entero»: «El mundo no depende de OSM después de generarse».
- Frontera con otras specs, que aquí solo se deja preparada: «La cobertura de escenas manda sobre la afinidad del anclaje» (SPEC-006) y «Marcarlo lo saca del casting sin resembrar» (SPEC-035).

### Huecos de la batería que esta spec deja al descubierto

`docs/testing.md` no tiene hoy escenario para nada de esto, y el PRD ya marca RF-MUNDO-011 con **⚠ sin escenario**. Habría que añadirlos antes de dar la spec por verificada:

1. **Pool con Places** — que sin Places el mundo se genera igual, que Places solo cubre déficit, que el `place_id` es lo único persistente y que refrescar no resiembra.
2. **Las otras tres familias del filtro** — la batería solo afirma los locales de adultos; industrial, obras y propiedad privada no tienen escenario aunque el RF-MUNDO-010 los nombra.
3. **El tope por etiqueta en forma medible** — «Un tag masivo no monopoliza un tipo de paraje» está escrito con `drinking_water` en la mano; no hay escenario que afirme el tope como porcentaje ni el descarte por falta de nombre.
4. **Deduplicación entre fuentes** — que el mismo sitio en OSM y en Places es un solo anclaje.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001.
- **Sin sección de comportamiento responsive ni bloque de UX Design** → asumido por decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz.
- **El identificador del anclaje es fuente + identificador nativo** (`osm:node/123456`, `places:ChIJ...`) → asumido (alternativa: un identificador propio derivado de la posición). Regla: el escenario «Ningún anclaje aparece dos veces» habla literalmente de «identificador de OSM ni de Places», así que el dato tiene que ser el nativo y no una traducción nuestra.
- **El filtro de tipos problemáticos se aplica al construir el pool, no en la consulta** → asumido, dejando la consulta estrecha como optimización (alternativa: confiar en que la consulta no pida esas etiquetas, que es lo que hace hoy el prototipo). Regla: `seguridad-privacidad.md` §3 lo llama «filtro previo por tipos… al generar», y los fixtures de SPEC-001 piden a propósito bares y agua potable para poder afirmarlo.
- **Tope del 25 % por etiqueta y del 40 % por `kind`** → asumido (alternativas: un tope absoluto por etiqueta, o ninguno confiando solo en el descarte por falta de nombre). Regla: `parajes.md` exige que ningún tag inunde el pool pero no da número; el 25 % deja sitio a cuatro etiquetas dominantes, que es más diversidad de la que pide el vocabulario de escenas, y el 40 % por `kind` es más laxo a propósito porque varias etiquetas legítimas comparten `kind`. Si al medir sobre mundos reales resulta que estrangula pools sanos, se ajusta por iteración y se anota en `parajes.md`.
- **Descarte de una etiqueta entera por falta de nombre: >20 entradas y <10 % nombradas** → asumido (alternativa: mantener solo la lista negra explícita de `drinking_water`). Regla: la nota del 4-ago-2026 de `parajes.md` deriva de su medición una regla general —«un tag solo entra si aporta reconocimiento»— y una lista negra no la implementa: obliga a descubrir a mano cada tag masivo nuevo. Los dos umbrales dejan fuera `drinking_water` (1,6 % y 0 % nombradas) y dentro `amenity=fountain` (35 %), que es exactamente el corte que el documento midió.
- **`abandoned:*` entra y `demolished:*` no** → asumido (alternativa: excluir toda la familia como «obras»). Regla: `parajes.md` lista `abandoned:*` como tag de sesgo para el tipo Ruina; lo abandonado es material del juego, lo demolido y lo en obras no existe como sitio al que ir.
- **Lejos-de-núcleo pasa de filtro duro a penalización** → asumido (alternativa: conservar `outsideTowns` como exclusión, que es lo que hace el prototipo). Regla: `parajes.md`, «se penalizan anclajes dentro del radio urbano», y el fixture de 250 m, donde el filtro duro deja el pool vacío y el mundo deja de ser jugable.
- **Tener nombre propio suma en la puntuación** → asumido (alternativa: puntuar solo por distancia). Regla: `parajes.md`, «el sentido del anclaje es el guiño de identificar el lugar real», que es justo lo que un elemento sin nombre no permite.
- **La demanda de la celda llega inyectada** → asumido (alternativa: calcular aquí los cupos). Regla: los cupos son de `parametros-mundo.md` y los implementan SPEC-003 y SPEC-006; dos copias del mismo número se desincronizan.
- **Places entra solo hasta cubrir el déficit, con deduplicación a 25 m** → asumido (alternativa: admitir todo lo que Places devuelva y dejar que los topes lo recorten). Regla: `parajes.md`, «entra solo a rellenar el pool de anclajes donde OSM no llega… no sustituye ninguna fase»; el radio de 25 m es el orden de magnitud del desacuerdo típico entre el centroide de un `nwr` de OSM y el punto de Places para el mismo local.
- **Una entrada de Places sin `place_id` se descarta** → asumido (alternativa: sintetizar un identificador por posición). Regla: sin identificador estable no se puede garantizar el uso único ni volver a pedir el contenido refrescable, que son las dos cosas por las que Places está aquí.
- **La ausencia de Places es un caso normal y no se registra como degradación visible al jugador** → asumido, con la celda anotando internamente que se generó sin relleno (alternativa: avisar en pantalla). Regla: riesgo 1 del PRD, la degradación prevista es «el pool se queda en OSM» y el visor sin foto; un aviso convertiría una decisión de arquitectura en un problema del jugador.
- **Los topes se relajan antes que dejar la celda por debajo del suelo** → asumido, con el pool declarando que se relajaron (alternativa: respetar los topes y aceptar el déficit). Regla: `parajes.md`, el suelo de cuatro parajes es la condición de jugabilidad de una celda; la diversidad es una preferencia y la jugabilidad no.
- **Tomar dos veces el mismo anclaje es un error, no un no-op silencioso** → asumido (alternativa: devolver falso y seguir). Regla: el uso único es un invariante del proyecto (`CLAUDE.md`, reglas); un fallo silencioso ahí produce mundos con el mismo bar de taberna y de ruina sin que nada se ponga rojo.
- **Una fuente malformada falla y una fuente vacía no** → asumido (alternativa: tratar los dos casos igual). Regla: una celda sin POIs es un páramo legítimo —el fixture del barrio de tres calles trae cero— y una fuente sin identificadores es un fallo de la capa de datos que hay que ver, no absorber.
