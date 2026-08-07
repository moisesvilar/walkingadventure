# SPEC-002-iter-1 — Orden estable de los datos de entrada y unicidad de nombre en todo el mundo

## Descripción

Iteración de corrección de defecto sobre la implementación de SPEC-002. La desencadena el report `test/reports/SPEC-002-run-20260807T233541Z.md`: 149 casos en verde y 3 en rojo, de los cuales quien orquesta dictamina que dos son defecto de código. Los dos vienen de la misma familia de problema —el mundo depende de algo que no debería, y nadie lo estaba vigilando de extremo a extremo— y por eso van juntos en una sola iteración.

El primero es bloqueante. El escenario `@determinismo` «El orden de iteración no depende del orden de inserción», que es el AC explícito de la base «Dado un mundo congelado, cuando se genera con sus elementos servidos en orden invertido, entonces el mundo es idéntico al generado con el orden natural», falla: en `costero` y en `urbano-denso` cambia el mundo entero —anclajes de núcleos, servicios, parajes y trazado de calzadas—, y en `barrio-tres-calles` y `suelo-250m` cambian el orden del terreno y el de los anclajes. Viola RNF-DET-001 y RNF-DET-003, y RNF-DET-003 dice que nada se despliega con un `@determinismo` en rojo.

El segundo es el escenario «No hay dos nombres iguales en un mundo»: `costero#2` sale con dos granjas llamadas «Casal da Colmea» y dos mercados llamados «Mercado do Dragón Bailador», y `suelo-250m#1` con dos «Casal do Espiño». Es un defecto anterior al porte que el porte se limitó a heredar, y que hasta ahora nadie afirmaba.

Lo que cambia: los datos que entran al núcleo pasan a consumirse en un orden explícito derivado de una clave estable, y la unicidad de nombre pasa a ser del mundo entero en lugar de por familia. Lo que no cambia: ni una decisión de generación —cupos, pesos de escena, sesgos, separaciones, umbrales de cosido siguen exactamente como están—, ni el contrato de inyección de `buildWorld`, ni el reparto de quién escribe qué. Consecuencia asumida y declarada: los ocho extractos de referencia cambian y hay que regenerarlos.

El tercer caso en rojo del report, «El mundo mínimo todavía compone un lazo», **no es materia de esta iteración**: afirma cupos y cobertura de escenas, que la spec base excluye por escrito, y su dueño es la fila 6 del checklist.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: una corrección de determinismo en la entrada de datos del núcleo y una corrección de unicidad en la generación de nombres, más la regeneración de los extractos de referencia que ambas provocan.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- **La frontera de inyección no cambia.** `buildWorld` sigue recibiendo el mismo `fetchData(lat, lon, radius) → { geoJson, poiJson }` y el mismo `onStatus` opcional, y sigue sin consumir el callejero. Sí cambian dos contratos internos del paquete, que no son frontera con la plataforma y quedan detallados en Notas técnicas: las funciones de parseo devuelven sus colecciones ordenadas, y los paquetes de idioma amplían su interfaz común con la regla de desempate.
- **Fuera de alcance:** no entra el escenario «El mundo mínimo todavía compone un lazo» ni nada que toque cupos, cobertura de escenas, sesgos de tipo de paraje o tramo personal —filas 3 a 8 del checklist—; no se toca el andamiaje que entregó SPEC-001, ni los fixtures de OSM, ni los dobles, ni el runner; no se toca la cadena de semilla de la fase de núcleos, que sigue sin sufijo literal y cuyo dueño es la fila 3; y no se aprovecha la regeneración de los extractos para ampliar lo que un extracto contiene.

## Defecto a corregir

### Defecto 1 — El mundo depende del orden en que llegan los elementos de OSM (bloqueante `@determinismo`)

#### Síntoma

Caso en rojo: **«El orden de iteración no depende del orden de inserción»**, en `test/nucleo/generacion.test.mjs:112`, dentro de la suite «El mundo es una función de la semilla y de los datos de OSM».

Con los elementos del mundo congelado servidos en orden invertido —los mismos elementos, otro orden de llegada, que es justo lo que el doble de SPEC-001 garantiza y su propio caso «El orden invertido devuelve exactamente los mismos elementos en otro orden de llegada» deja en verde—, el mundo generado es otro. En `costero` el diagnóstico del report es literal: «los elementos generados cambian si los datos de OSM llegan en otro orden». Lo que cambia no es cosmético:

- Un núcleo cambia de anclaje y de sitio: «Vilancelle da Brétema» pasa de `way/551279363` en (−58, 417) a `node/5323941422` en (−32, −118).
- Cambian los recuentos: servicios 12 → 13, parajes 3 → 5, calzadas 9 → 10.
- Cambia el trazado: extremos, número de puntos y nombres de calzadas y ramales.
- Cambia el casting: `rescate-en-la-granja` y `ronda-del-vigia` pasan de no castear a castear.

`urbano-denso` falla igual. En `barrio-tres-calles` y `suelo-250m` la diferencia se queda en el orden de las colecciones de terreno y de anclajes, sin llegar a mover el mundo, pero es el mismo defecto en un dato que todavía no lo propaga.

#### Causa raíz

`packages/nucleo/world/osm.js`. Las tres funciones de parseo recorren `json.elements` en el orden en que la respuesta lo trae y empujan a sus colecciones de salida en ese mismo orden: `parseGeo` alimenta así `coastlines`, `lakes`, `rivers`, `forests`, `peaks` y `roads`; `parseStreets` construye la lista del callejero; `parsePois` construye el array de anclajes. Ninguna ordena nada. El orden de llegada de Overpass entra intacto en el núcleo y se convierte en un dato de generación encubierto.

De ahí en adelante, las fases lo propagan en cada punto donde una decisión empata o donde el orden de partida sesga un barajado:

- `settlements.js:220` y `:230` barajan el pool con `shuffle(rng, pool)` y después lo reordenan por categoría; el barajado consume el mismo azar, pero sobre una secuencia de partida distinta, así que elige otros anclajes.
- `settlements.js:134`, en `assignServices`, ordena los candidatos por distancia con `sort((x, y) => x.d - y.d)`. La ordenación de JavaScript es estable: dos anclajes a la misma distancia conservan el orden en que venían, y ese orden es el de llegada.
- `parajes.js:145` ordena por puntuación con el mismo patrón y el mismo empate posible.
- `routes.js` construye el grafo, cose huecos y recorre `Set` de nodos sobre colecciones que ya venían en orden de llegada.

Es decir: no hay una sola línea culpable, hay una clase entera. Por eso el AC nuevo no puede afirmar solo que el mundo invertido coincide; tiene que afirmar dónde se ordena y con qué clave.

La clave estable existe a medias. `parsePois` ya guarda `osmId` como `` `${el.type}/${el.id}` `` —el comentario del propio módulo explica que es lo único único de verdad en OSM, porque un node y un way pueden compartir número—, pero `parseGeo` y `parseStreets` descartan el identificador: de un way solo se quedan la geometría proyectada, los `nodes` cuando vienen alineados, el nivel y el nombre. Sin conservarlo no hay clave por la que ordenar el terreno ni el callejero.

#### Cambio requerido

Que toda colección de datos externos quede ordenada por una clave estable y total en el mismo módulo que la produce a partir de la respuesta de OSM, y que ninguna fase posterior dependa del orden en que le llegó nada. Donde una ordenación de una fase pueda empatar, el empate se rompe con la clave estable en lugar de dejarlo al orden de entrada.

Para que la clave exista, `parseGeo` y `parseStreets` conservan el identificador de OSM del elemento del que sale cada entidad, con la misma forma `tipo/id` que ya usa `parsePois`. Los pocos elementos sin identificador utilizable ordenan por una clave derivada de su geometría proyectada, y la regla que se elija se aplica igual en las tres funciones.

Ordenar por una clave que no es el orden de llegada consume el azar de otra manera y cambia los mundos generados. Eso es el efecto buscado y está tratado abajo, en el bloque de los extractos de referencia.

### Defecto 2 — La unicidad de nombre es por familia y las granjas y los servicios no la comprueban

#### Síntoma

Caso en rojo: **«No hay dos nombres iguales en un mundo»**, en `test/nucleo/generacion.test.mjs:408`, dentro de la suite «Los nombres son únicos y del idioma del sitio».

- `costero#2` devuelve dos nombres repetidos: `Casal da Colmea` (dos granjas) y `Mercado do Dragón Bailador` (dos mercados).
- `suelo-250m#1` devuelve `Casal do Espiño` repetido.

Es anterior al porte: el prototipo tenía el mismo agujero y nadie lo afirmaba.

#### Causa raíz

Dos huecos distintos, y hay que cerrar los dos.

El primero es que dos familias no comprueban nada. En `packages/nucleo/world/settlements.js:120`, `makeSettlement` asigna `names.farmName(rng)` o `names.townName(rng)` de una sola llamada, sin mirar si ese nombre ya existe; en `:156`, `assignServices` asigna `names.poiName(rng, kind)` igual. No hay reintento ni conjunto de nombres usados por ninguna de las dos vías.

El segundo es que las familias que sí reintentan lo hacen contra un conjunto propio. `packages/nucleo/world/parajes.js:196-203` crea un `used` local y reintenta hasta ocho veces `names.parajeName`; `packages/nucleo/world/routes.js:295-304` crea otro `used` local y reintenta hasta diez veces `names.roadName`. Cada conjunto vive dentro de su fase y muere con ella, así que un paraje puede llamarse igual que un núcleo y una calzada igual que un servicio sin que nadie lo note. En el diff del report se ve el caso: el paraje «As Laxes da Moura» convive con el núcleo «Lamitoño da Moura», que no colisiona, pero nada lo impedía si hubiera salido el mismo texto.

Los dos reintentos existentes tienen además un tope y ninguna salida: si el repertorio se agota, `parajes.js` y `routes.js` se quedan con el último nombre sorteado aunque esté repetido. Con un índice compartido eso deja de ser un caso raro y pasa a ser el caso normal en mundos densos, así que la regla de qué pasa al agotarse tiene que estar definida en lugar de ser el silencio de hoy.

#### Cambio requerido

Un único índice de nombres, creado una vez por mundo y compartido por las cinco familias que nombran: núcleos, granjas, servicios, parajes y calzadas. Antes de fijar un nombre se consulta el índice; si el nombre ya está tomado se reintenta con la cadena de azar de la fase que está nombrando, sin tocar las de las demás; si los reintentos se agotan, se aplica una regla de desempate determinista que garantiza un nombre libre y que no depende del reloj, del entorno ni del orden de llegada.

El desempate lo aporta el paquete de idioma, como una función más de su interfaz común, para que un nombre desambiguado siga siendo un nombre del idioma del mundo y no un identificador técnico pegado al final. Los dos paquetes vivos, `es` y `gl`, la implementan.

## Criterios de aceptación

### El orden de llegada deja de ser un dato de generación

- **Dado** cualquier mundo congelado y cualquiera de las dos semillas de referencia, **cuando** se genera con los elementos de OSM servidos en orden invertido, **entonces** el mundo resultante es idéntico al generado con el orden natural, comparando el mundo entero y no solo sus recuentos.
- **Dado** cualquier mundo congelado y cualquiera de las dos semillas de referencia, **cuando** se genera con los elementos de OSM servidos en un orden barajado distinto del natural y del invertido, **entonces** el mundo resultante es idéntico al generado con el orden natural.
- **Dado** el mundo congelado `costero`, **cuando** se genera con los elementos servidos en orden invertido, **entonces** cada núcleo conserva su anclaje, su tipo y sus coordenadas.
- **Dado** el mundo congelado `urbano-denso`, **cuando** se genera con los elementos servidos en orden invertido, **entonces** los recuentos de núcleos, servicios, parajes y calzadas son los mismos que con el orden natural.
- **Dado** el mundo congelado `barrio-tres-calles`, **cuando** se genera con los elementos servidos en orden invertido, **entonces** las colecciones de terreno y la de anclajes salen en el mismo orden que con el orden natural.
- **Dado** el mundo congelado `suelo-250m`, **cuando** se genera con los elementos servidos en orden invertido, **entonces** las colecciones de terreno y la de anclajes salen en el mismo orden que con el orden natural.
- **Dado** cualquier mundo congelado, **cuando** se genera con los elementos servidos en orden invertido, **entonces** el conjunto de plantillas que castean es el mismo que con el orden natural.

### Toda entrada de datos externos se ordena por una clave estable

- **Dado** el parseo del terreno, **cuando** devuelve sus colecciones de costa, lagos, ríos, bosques, picos y carreteras, **entonces** cada una viene ordenada por una clave estable derivada del elemento de OSM del que sale.
- **Dado** el parseo del callejero, **cuando** devuelve su lista, **entonces** viene ordenada por una clave estable derivada del elemento de OSM del que sale.
- **Dado** el parseo de los POI, **cuando** devuelve la lista de anclajes, **entonces** viene ordenada por una clave estable derivada del elemento de OSM del que sale.
- **Dado** el terreno y el callejero ya parseados, **cuando** se inspecciona cualquiera de sus entidades, **entonces** conserva el identificador de OSM del elemento del que sale, con la misma forma `tipo/id` que ya usan los anclajes.
- **Dado** cualquiera de las tres colecciones ordenadas, **cuando** se comparan las claves de dos entidades distintas, **entonces** no hay dos que compartan la misma clave.
- **Dado** un elemento de OSM sin identificador utilizable, **cuando** se ordena la colección que lo contiene, **entonces** su clave se deriva de su geometría proyectada por la misma regla en las tres funciones de parseo, y dos ejecuciones sobre los mismos datos le asignan la misma clave.
- **Dado** el paquete, **cuando** se busca dónde se ordena cada colección de datos externos, **entonces** queda ordenada en el módulo que la produce a partir de la respuesta de OSM, y ninguna fase de generación la reordena para poder decidir.
- **Dado** cualquier módulo del paquete, **cuando** se inspecciona una ordenación cuya clave puede empatar entre dos entidades distintas, **entonces** el empate se rompe con la clave estable y no con el orden en que llegaron.
- **Dado** cualquier módulo del paquete, **cuando** se inspecciona el recorrido de un `Set` o de un `Map` cuyo resultado alimenta una decisión de generación, **entonces** va precedido de una ordenación por clave estable.

### La unicidad de nombre es del mundo entero

- **Dado** un mundo generado, **cuando** se recogen los nombres de núcleos, granjas, servicios, parajes y calzadas, **entonces** no hay ninguno repetido.
- **Dado** un mundo generado, **cuando** se comparan los nombres de dos familias distintas —un núcleo contra un paraje, un servicio contra una calzada, una granja contra un servicio—, **entonces** ninguno coincide con ninguno.
- **Dado** un mundo generado, **cuando** se cuenta cuántos índices de nombres se han creado, **entonces** hay exactamente uno para todo el mundo y lo comparten las cinco familias.
- **Dado** el mundo congelado `costero` con la semilla `#2`, **cuando** se generan los nombres, **entonces** `Casal da Colmea` y `Mercado do Dragón Bailador` aparecen una sola vez cada uno.
- **Dado** el mundo congelado `suelo-250m` con la semilla `#1`, **cuando** se generan los nombres, **entonces** `Casal do Espiño` aparece una sola vez.
- **Dado** un nombre que ya está tomado en el índice, **cuando** una fase intenta fijarlo, **entonces** reintenta con la cadena de azar de esa fase y no con la de ninguna otra.
- **Dado** un repertorio de nombres agotado para un tipo, **cuando** los reintentos se acaban sin encontrar uno libre, **entonces** se aplica la regla de desempate y el nombre resultante no está en el índice.
- **Dado** un mundo con un repertorio agotado, **cuando** se genera dos veces con la misma semilla y los mismos datos, **entonces** los nombres desambiguados son idénticos en las dos generaciones.
- **Dado** un nombre desambiguado, **cuando** se comprueba de qué paquete de idioma sale, **entonces** sale del mismo paquete que el resto de los nombres del mundo.
- **Dado** el paquete de idioma `es` y el paquete `gl`, **cuando** se comparan sus exportaciones, **entonces** los dos implementan la interfaz común completa, incluida la regla de desempate.
- **Dado** un mundo sembrado en 42.40, -8.81 y otro en 39.86, -4.02, **cuando** se generan los nombres, **entonces** siguen saliendo de `gl` y de `es` respectivamente.

### Los extractos de referencia, regenerados

- **Dado** `test/fixtures/mundos-referencia/`, **cuando** se enumeran sus extractos tras esta iteración, **entonces** siguen siendo ocho, uno por cada combinación de los cuatro mundos congelados con las dos semillas de referencia.
- **Dado** un extracto de referencia regenerado, **cuando** el paquete genera ese mismo mundo y se extrae de él lo mismo, **entonces** el resultado es idéntico al extracto commiteado.
- **Dado** un extracto de referencia regenerado, **cuando** se lee su cabecera, **entonces** declara de qué mundo congelado sale, con qué semilla, contra qué revisión del prototipo se capturó el extracto original y que esta iteración lo regeneró, con el motivo.
- **Dado** un extracto regenerado y el extracto que sustituye, **cuando** se comparan sus recuentos de núcleos, servicios, parajes y calzadas, **entonces** son los mismos.
- **Dado** un extracto regenerado y el extracto que sustituye, **cuando** se comparan el título del mundo y el idioma elegido, **entonces** son los mismos.
- **Dado** un extracto regenerado y el extracto que sustituye, **cuando** se comparan las plantillas que castean y las que no, **entonces** son las mismas.
- **Dado** un extracto regenerado, **cuando** se recogen los nombres que contiene, **entonces** no hay ninguno repetido.
- **Dado** un extracto regenerado, **cuando** se recogen los anclajes de sus núcleos, servicios y parajes, **entonces** ningún identificador de OSM aparece más de una vez.
- **Dado** el repositorio tras esta iteración, **cuando** se ejecuta `node test/headless.mjs`, **entonces** termina en verde.
- **Dado** el servidor de desarrollo levantado, **cuando** se ejecuta `node test/casting-report.mjs`, **entonces** produce su informe sin fallar.
- **Dado** el prototipo abierto en el navegador con `node server.mjs`, **cuando** se genera un mundo, **entonces** se dibuja igual que antes de esta iteración, con otros nombres y otras colocaciones.

### Criterios de la base que se mantienen

Se citan porque son los confundibles con lo de arriba y siguen vigentes tal cual:

> **Dado** un mundo congelado y la semilla `"42.40,-8.81#1"`, **cuando** se genera dos veces, **entonces** los dos mundos son idénticos.

> **Dado** el paquete, **cuando** se enumeran las cadenas de semilla con las que cada fase deriva su generador, **entonces** no hay dos fases que compartan la misma.

> **Dado** un mundo generado, **cuando** se comparan los anclajes libres que reciben los parajes con los que los núcleos no tomaron, **entonces** son exactamente los mismos.

> **Dado** un mundo congelado, **cuando** se genera con `"42.40,-8.81#1"` y con `"42.40,-8.81#2"`, **entonces** difieren en el nombre de al menos un núcleo.

Las tablas de cadenas de semilla y de destino de cada módulo de SPEC-002 quedan intactas: esta iteración no renombra ninguna cadena ni mueve ningún fichero.

### Criterio derogado

De la spec base, en el grupo «Equivalencia con el prototipo»:

> **Dado** un extracto de referencia, **cuando** se lee su cabecera, **entonces** declara de qué mundo congelado sale, con qué semilla y contra qué revisión del prototipo se capturó.

El criterio "Dado un extracto de referencia, cuando se lee su cabecera, entonces declara de qué mundo congelado sale, con qué semilla y contra qué revisión del prototipo se capturó" **queda obsoleto y debe entenderse derogado** por esta iteración. El comportamiento esperado del implementador y de la suite QA es el del criterio nuevo de arriba: la cabecera declara además que esta iteración regeneró el extracto y por qué, porque a partir de aquí un extracto ya no es una captura del prototipo sin más.

Ningún otro criterio de la base se deroga. En particular, «el resultado es idéntico al extracto commiteado» sigue vigente palabra por palabra: lo que cambia es el contenido de los extractos, no lo que se exige de ellos.

## Notas técnicas

- **Ficheros afectados.** `packages/nucleo/world/osm.js` (las tres funciones de parseo: conservar el identificador y ordenar la salida), `packages/nucleo/world/settlements.js` (nombres de núcleos, granjas y servicios contra el índice compartido; desempate explícito en la ordenación por distancia de `assignServices`), `packages/nucleo/world/parajes.js` (sustituir el `used` local por el índice compartido; desempate explícito en la ordenación por puntuación), `packages/nucleo/world/routes.js` (ídem con su `used` local; desempates en el grafo y en el cosido), `packages/nucleo/world/build.js` (crear el índice de nombres una vez por mundo y pasarlo a las fases), `packages/nucleo/names/index.js`, `packages/nucleo/names/es.js` y `packages/nucleo/names/gl.js` (regla de desempate en la interfaz común), y `test/fixtures/mundos-referencia/` (los ocho extractos regenerados, que por la tabla de «Quién toca qué» de SPEC-002 son datos de referencia y los escribe `wa-dev`).
- **Antes y después, en una línea.** Antes: el orden de llegada de Overpass entra intacto en la generación y cada fase lleva su propio conjunto de nombres usados. Después: cada colección se ordena por `tipo/id` en el borde del núcleo, y hay un índice de nombres por mundo que ven las cinco familias.
- **Lo que se mantiene explícitamente:** el contrato de inyección de `buildWorld`, el orden de las fases y las claves de `onStatus`, la tabla de cadenas de semilla —incluida la fase de núcleos sin sufijo literal—, los cupos por radio, los pesos de escena de los parajes, el sesgo suave por `kind`, los umbrales de `coserHuecos`, la exclusión de `amenity=drinking_water` y la disposición del paquete. El callejero sigue fuera de `fetchData`.
- **Impacto en la frontera de inyección: no.** Ni entradas nuevas ni salidas nuevas hacia la plataforma. Los dos contratos que sí cambian son internos al paquete: la forma de lo que devuelven las funciones de parseo —que gana un campo, sin perder ninguno— y la interfaz común de los paquetes de idioma, que gana una función. Quien añada un idioma a partir de ahora la implementa, como dice CLAUDE.md.
- **Retrocompatibilidad: no la hay, y es el objetivo.** Los mundos generados cambian: mismas semillas, mismos datos de OSM, otros anclajes y otros nombres. Nada persistido depende todavía de ellos —la capa de partida es la fila 9 y no existe—, así que el cambio no rompe datos de nadie; lo único que hay que rehacer son los ocho extractos de referencia. Si al regenerarlos alguno de los tres invariantes que no dependen del flujo de azar no cuadra con el extracto anterior, **no se ajusta el extracto para que cuadre**: se escala, porque significaría que la ordenación movió una decisión de generación y no solo el reparto del azar, y eso saldría del alcance de esta iteración.
- **Consumidores fuera del paquete.** `app/js/data/overpass.js` no se toca: el transporte sigue igual y quien ordena es el parseo, que ya vive dentro del núcleo. `app/js/render/map.js` consume el terreno y el callejero y hay que comprobar que el campo nuevo no le estorba. `test/headless.mjs` y `test/casting-report.mjs` no cambian de imports.
- **i18n y tracking:** la regla de desempate es material de los paquetes de idioma y no sale de ellos. No hay eventos ni telemetría implicados; el núcleo sigue sin emitir nada.
- **Batería de aceptación.** Los dos escenarios en rojo son «El orden de iteración no depende del orden de inserción» y «No hay dos nombres iguales en un mundo», los dos ya en `docs/testing.md`, y son los que tienen que pasar a verde. Los criterios nuevos que van más allá de esos dos escenarios —el orden barajado, la unicidad entre familias distintas, el desempate al agotarse el repertorio y la clave estable de terreno y callejero— no tienen escenario en la batería y se registran en `test/spec-test-map.json` marcados como hueco, que es lo que el esquema de SPEC-001 ya contempla.
- **Dependencias:** la spec base `docs/specs/SPEC-002-paquete-compartido.md`, y por debajo el andamiaje de `docs/specs/SPEC-001-andamiaje-pruebas.md` y su iteración, que aportan los mundos congelados, el doble que sirve los elementos en otro orden y el runner.
- **Verificación manual tras la entrega:** (1) `bash scripts/qa-tester-run.sh SPEC-002-iter-1` y comprobar que los dos casos citados salen en verde y que el único rojo que queda es «El mundo mínimo todavía compone un lazo»; (2) `node test/headless.mjs` en verde; (3) `node server.mjs`, abrir el prototipo, generar en 42.40, -8.81 y comprobar que el mapa se dibuja completo y que no hay dos rótulos con el mismo texto; (4) `git diff` sobre `test/fixtures/mundos-referencia/` y comprobar que los ocho ficheros cambiaron y que en cada uno el título, el idioma, los recuentos y las plantillas que castean son los de antes.

## Decisiones asumidas

- **La clave estable de ordenación es el identificador de OSM `tipo/id`** → asumido (alternativa: ordenar por la geometría proyectada de cada entidad). Regla: es la clave que SPEC-002 ya introdujo para los anclajes y la única única de verdad en OSM, porque un node y un way pueden compartir número; la geometría empata entre elementos superpuestos y depende del redondeo de la proyección.
- **Los elementos sin identificador utilizable ordenan por una clave derivada de su geometría proyectada** → asumido (alternativa: descartarlos, o dejarlos al final en orden de llegada). Regla: descartarlos cambiaría el mundo por una razón que no es el defecto, y dejarlos en orden de llegada reabre el mismo agujero en el caso raro.
- **Se ordena una sola vez, en el parseo, y no en cada fase** → asumido (alternativa: que cada fase ordene lo que va a consumir). Regla: el defecto es de clase, y ordenar en el borde lo cierra de una vez; repartir la ordenación por las fases garantiza que la próxima fase que se añada se olvide.
- **La unicidad se comprueba sobre el nombre visible, comparando el texto tal cual, sin normalizar mayúsculas ni acentos** → asumido (alternativa: comparar una forma normalizada, de modo que «A Ponte» y «a ponte» colisionen). Regla: el escenario de la batería habla de nombres repetidos y los repertorios de `es` y `gl` generan siempre con la misma capitalización, así que normalizar añadiría colisiones que hoy no existen y movería más mundos de los necesarios.
- **El índice de nombres se crea en `build.js` y se pasa a las fases** → asumido (alternativa: un módulo con estado propio en `core/`). Regla: `build.js` es la orquestación canónica y ya es quien reparte lo compartido entre fases; un estado global en el paquete rompería que dos mundos se puedan generar en el mismo proceso sin contaminarse.
- **La regla de desempate la aporta el paquete de idioma, como función nueva de la interfaz común** → asumido (alternativa: un sufijo numérico neutro añadido por el índice, del tipo «Casal da Colmea (2)»). Regla: `game-design/` y CLAUDE.md exigen que todo nombre visible salga del paquete de idioma del mundo; un sufijo numérico se lee como un identificador técnico y rompe la ficción en el rótulo del mapa.
- **El reintento usa la cadena de azar de la fase que nombra, y no una propia** → asumido (alternativa: una cadena `<semilla>:nombres` para todos los desempates). Regla: RNF-DET-001 protege que tocar una fase no desplace el azar de las demás, y una cadena compartida por las cinco familias hace justo lo contrario.
- **Los ocho extractos se regeneran en esta misma entrega y en el mismo commit que el cambio** → asumido (alternativa: dejarlos como están y marcar el caso de equivalencia como pendiente). Regla: un extracto que no cuadra con el código deja de ser una red de seguridad y se convierte en ruido que se aprende a ignorar.
- **La cabecera del extracto conserva la revisión del prototipo original y añade la de esta iteración** → asumido (alternativa: sustituirla por la revisión nueva). Regla: la trazabilidad hasta la captura pre-porte es lo que da valor al extracto; perderla convierte la equivalencia con el prototipo en una afirmación sin origen.
- **Los criterios de aceptación van en Gherkin español**, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md`, como en la spec base.
- **Sin sección de UX Design ni de comportamiento responsive** → esta iteración no toca interfaz: el prototipo dibuja lo mismo con otros datos.
