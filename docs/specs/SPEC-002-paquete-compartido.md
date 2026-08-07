# SPEC-002 — El paquete compartido

## Descripción

Saca el generador de mundos del prototipo y lo deja en `packages/nucleo/`, un paquete de JavaScript ESM puro, sin dependencias, que corre igual en Node y —cuando exista— dentro de la app. Se lleva lo que hoy vive en `app/js/core/`, `app/js/world/`, `app/js/names/` y `app/js/quests/`, más el parseo de los datos de OSM; se queda fuera todo lo que sabe de una plataforma: el dibujo, las pantallas, el GPS, el háptico y las llamadas de red.

Es un porte, no una funcionalidad. Lo que tiene que quedar clavado son tres cosas: que la frontera con la plataforma es dura y comprobable, que el determinismo deja de ser una costumbre del repo para pasar a ser un requisito verificado, y que la tubería de generación sigue siendo **una sola**, compartida por la app y por las herramientas headless. Nadie ve nada de esto mientras juega: lo consumen el prototipo, `test/headless.mjs`, `test/casting-report.mjs` y, a partir de la fila 3 del checklist, todas las specs que reescriben fases de la generación.

Ancla: **RF-INFRA-001** (`docs/prd.md` §4.13) y **RNF-DET-001** y **RNF-DET-003** (§5.1), con `game-design/arquitectura.md` §1 y §2 como decisión de origen —que es cerrada y no se discute— y `.claude/skills/wa-dev/references/03-stack-context.md` como la disposición ya fijada del paquete. Se apoya en el andamiaje que entregó **SPEC-001**: los mundos congelados de `test/fixtures/osm/`, los dobles de `test/dobles/` y el runner `scripts/qa-tester-run.sh` ya existen y esta spec no los vuelve a especificar.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Fuera de alcance, por ser el porte y no la reforma:** esta entrega **no cambia ni una decisión de generación**. La rejilla de celdas, los cupos por celda, la cobertura de escenas, el tramo personal y el filtro sobre el grafo son las filas 3 a 8 del checklist y se reescriben allí, sobre el paquete ya portado. Aquí el código cambia de sitio y de frontera, no de comportamiento. Tampoco entra el render con Skia (fila 21), ni el andamiaje de la app de Expo (fila 20), ni la capa de partida (`packages/nucleo/partida/`, fila 9).

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en los grupos del paquete y su disposición y de la tubería canónica; la validación de entradas, en las llamadas a `buildWorld` sin sus dependencias inyectadas y en el mundo congelado que no existe; el estado vacío, en el mundo mínimo de 250 m, en `onStatus` omitido y en `packages/nucleo/partida/`, que esta spec deja sin crear; el estado de error, en `fetchData` que falla, en el import que rompe la frontera y en la comprobación de núcleo que ya no puede saltarse; y los casos límite, en el orden de llegada invertido, en el ida y vuelta por JSON y en los ficheros que una regla de `.gitignore` podría tragarse.

### El paquete y su disposición

- **Dado** un clon limpio del repositorio, **cuando** se listan los directorios de `packages/nucleo/`, **entonces** existen `core/`, `world/`, `names/` y `quests/`.
- **Dado** un clon limpio del repositorio, **cuando** se ejecuta cualquier módulo del paquete desde Node, **entonces** arranca sin instalar ninguna dependencia.
- **Dado** `packages/nucleo/package.json`, **cuando** se lee, **entonces** declara `"type": "module"`.
- **Dado** `packages/nucleo/package.json`, **cuando** se lee, **entonces** no declara ninguna dependencia de runtime.
- **Dado** el paquete entregado, **cuando** se listan los ficheros versionados con `git ls-files packages/nucleo`, **entonces** aparecen todos los módulos portados y ninguno queda fuera por una regla de `.gitignore`.
- **Dado** el paquete entregado, **cuando** se buscan ficheros con extensión `.ts` o `.tsx`, **entonces** no hay ninguno.
- **Dado** cualquier módulo del paquete, **cuando** se leen sus imports, **entonces** todos citan la extensión del fichero de forma explícita.
- **Dado** cualquier módulo del paquete, **cuando** se leen sus comentarios y sus nombres de dominio, **entonces** están en español, con el inglés reservado a los identificadores técnicos genéricos.
- **Dado** el paquete entregado, **cuando** se busca el directorio `packages/nucleo/partida/`, **entonces** no existe todavía, porque su contenido lo entrega la fila 9 del checklist.

### La frontera dura con la plataforma

- **Dado** cualquier módulo de `packages/nucleo/`, **cuando** se inspeccionan sus imports, **entonces** ninguno importa de React Native, de Expo ni de un paquete cuyo nombre empiece por `react-native` o `expo`.
- **Dado** cualquier módulo de `packages/nucleo/`, **cuando** se inspeccionan sus imports, **entonces** ninguno importa un builtin de Node.
- **Dado** cualquier módulo de `packages/nucleo/`, **cuando** se inspeccionan sus imports, **entonces** ninguno importa de `app/`, de `server.mjs`, de `scripts/` ni de `test/`.
- **Dado** cualquier módulo de `packages/nucleo/`, **cuando** se busca en su código, **entonces** no aparece ninguna de las puertas de la plataforma: `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `document` ni `window`.
- **Dado** el repositorio con el paquete ya portado, **cuando** se ejecuta `node scripts/comprueba-nucleo.mjs`, **entonces** deja de informar de que el paquete no existe y termina con código 0.
- **Dado** el runner de pruebas, **cuando** se ejecuta sobre el repositorio con el paquete portado, **entonces** el report ya no registra la frontera del núcleo como comprobación saltada.
- **Dado** `buildWorld`, **cuando** se le llama sin `fetchData`, **entonces** falla con un error que nombra la dependencia que falta.
- **Dado** el inspector de tráfico saliente en modo estricto, **cuando** se genera un mundo entero con un `fetchData` construido sobre un mundo congelado, **entonces** no se registra ninguna petición de red.
- **Dado** un mundo congelado, **cuando** se genera un mundo, **entonces** la única entrada de datos externos que el núcleo consume son las llamadas al `fetchData` que recibió.

### El determinismo del núcleo

- **Dado** cualquier módulo de `packages/nucleo/`, **cuando** se busca en su código, **entonces** no aparece `Math.random()`.
- **Dado** cualquier módulo de `packages/nucleo/`, **cuando** se busca en su código, **entonces** no aparece ninguna lectura del reloj del sistema: ni `Date.now()`, ni `new Date()`, ni `performance.now()`.
- **Dado** cualquier módulo de `packages/nucleo/`, **cuando** se busca en su código, **entonces** no aparece ningún generador de identificadores aleatorios del entorno, como `crypto.randomUUID()`.
- **Dado** un mundo congelado y la semilla `"42.40,-8.81#1"`, **cuando** se genera dos veces, **entonces** los dos mundos son idénticos.
- **Dado** un mundo congelado y una semilla, **cuando** se genera con el reloj del sistema fijado en instantes distintos, **entonces** el mundo resultante no cambia.
- **Dado** un mundo congelado, **cuando** se genera con sus elementos servidos en orden invertido, **entonces** el mundo es idéntico al generado con el orden natural.
- **Dado** un mundo congelado, **cuando** se genera con `"42.40,-8.81#1"` y con `"42.40,-8.81#2"`, **entonces** difieren en el nombre de al menos un núcleo.
- **Dado** un mundo congelado, **cuando** se genera con `"42.40,-8.81#1"` y con `"42.40,-8.81#2"`, **entonces** difieren en la colocación de al menos un paraje.
- **Dado** el paquete, **cuando** se enumeran las cadenas de semilla con las que cada fase deriva su generador, **entonces** no hay dos fases que compartan la misma.
- **Dado** un mundo generado, **cuando** se altera la implementación de la fase de parajes y se vuelve a generar con la misma semilla, **entonces** los núcleos y las calzadas siguen siendo idénticos a los de antes.
- **Dado** cualquier módulo del paquete, **cuando** se inspecciona el recorrido de un `Set` o de un `Map` cuyo resultado alimenta una decisión de generación, **entonces** va precedido de una ordenación explícita.
- **Dado** un mundo generado, **cuando** se serializa a JSON y se vuelve a leer, **entonces** no se pierde ningún dato por venir colgado de un array en lugar de en una propiedad de objeto.

### La tubería canónica, que sigue siendo una sola

- **Dado** el paquete entregado, **cuando** se busca la orquestación de la generación, **entonces** hay una sola función `buildWorld` y vive en `packages/nucleo/world/build.js`.
- **Dado** `buildWorld`, **cuando** se genera un mundo, **entonces** las fases se ejecutan en el orden declarado: datos, terreno, costa, máscara, núcleos, calzadas y parajes.
- **Dado** `buildWorld` con `onStatus` inyectado, **cuando** se genera un mundo, **entonces** `onStatus` recibe una clave por cada fase ejecutada, en ese orden.
- **Dado** `buildWorld` sin `onStatus`, **cuando** se genera un mundo, **entonces** la generación termina igual y sin error.
- **Dado** un `fetchData` que falla, **cuando** se genera un mundo, **entonces** el error se propaga a quien llamó y no se devuelve ningún mundo a medias.
- **Dado** un mundo congelado sin línea de costa, **cuando** se genera un mundo, **entonces** no se pide una segunda vuelta de datos ni se construye máscara de mar.
- **Dado** el mundo congelado costero, **cuando** se genera un mundo, **entonces** se construye la máscara de mar y el radio de dibujo resultante es distinto del radio base.
- **Dado** el mundo congelado del suelo de 250 m, **cuando** se genera un mundo, **entonces** se construye un mundo completo, con su título y su casting, sin fallar.
- **Dado** un nombre de mundo congelado que no existe, **cuando** se intenta generar con él, **entonces** falla antes de generar nada, con el error del andamiaje.

### Equivalencia con el prototipo

- **Dado** `test/fixtures/mundos-referencia/`, **cuando** se enumeran sus extractos, **entonces** hay uno por cada combinación de los cuatro mundos congelados con las dos semillas de referencia.
- **Dado** un extracto de referencia, **cuando** se lee su cabecera, **entonces** declara de qué mundo congelado sale, con qué semilla y contra qué revisión del prototipo se capturó.
- **Dado** un extracto de referencia, **cuando** el paquete genera ese mismo mundo y se extrae de él lo mismo, **entonces** el resultado es idéntico al extracto commiteado.
- **Dado** cada mundo congelado, **cuando** se comparan con el prototipo los recuentos de núcleos, servicios, parajes y calzadas, **entonces** son los mismos.
- **Dado** cada mundo congelado, **cuando** se comparan con el prototipo el título del mundo y el idioma elegido, **entonces** son los mismos.
- **Dado** cada mundo congelado, **cuando** se comparan con el prototipo las plantillas que castean y las que no, **entonces** son las mismas.
- **Dado** un mundo generado, **cuando** se recogen los anclajes de todos los núcleos, servicios y parajes, **entonces** ningún identificador de OSM aparece más de una vez.
- **Dado** un mundo generado, **cuando** se comparan los anclajes libres que reciben los parajes con los que los núcleos no tomaron, **entonces** son exactamente los mismos.
- **Dado** un mundo generado, **cuando** se recogen los nombres de núcleos, servicios, parajes y calzadas, **entonces** no hay ninguno repetido.
- **Dado** un mundo sembrado en 42.40, -8.81, **cuando** se generan los nombres, **entonces** salen del paquete de idioma `gl`.
- **Dado** un mundo sembrado en 39.86, -4.02, **cuando** se generan los nombres, **entonces** salen del paquete de idioma `es`.

### Lo que se queda fuera del paquete

- **Dado** el repositorio tras el porte, **cuando** se listan los directorios de `app/js/`, **entonces** ya no existen `core/`, `world/`, `names/` ni `quests/`.
- **Dado** cualquier módulo de `app/`, **cuando** se inspeccionan los imports con los que consume el generador, **entonces** todos apuntan a `packages/nucleo/` y ninguno a una copia dentro de `app/`.
- **Dado** `app/js/data/overpass.js`, **cuando** se leen sus exportaciones, **entonces** conserva la construcción de las consultas y el transporte.
- **Dado** `app/js/data/overpass.js`, **cuando** se lee su código, **entonces** ya no contiene el parseo de la respuesta de OSM, que ha pasado al paquete.
- **Dado** `packages/nucleo/`, **cuando** se busca en su código, **entonces** no aparece ningún texto de consulta de Overpass.
- **Dado** el repositorio tras el porte, **cuando** se ejecuta `node test/headless.mjs`, **entonces** termina en verde, con las mismas comprobaciones que antes del porte.
- **Dado** el servidor de desarrollo levantado, **cuando** se ejecuta `node test/casting-report.mjs`, **entonces** produce su informe igual que antes del porte.
- **Dado** el prototipo abierto en el navegador con `node server.mjs`, **cuando** se genera un mundo, **entonces** se dibuja como antes del porte.
- **Dado** el directorio `archive/`, **cuando** se compara con su estado anterior, **entonces** no ha cambiado ni un fichero.

## Notas técnicas

### Qué se porta y a dónde

El destino de cada módulo. La disposición del paquete la fija `03-stack-context.md` y no se reabre aquí.

| Hoy | En el paquete |
| --- | --- |
| `app/js/core/rng.js` | `packages/nucleo/core/rng.js` |
| `app/js/core/geo.js` | `packages/nucleo/core/geo.js` |
| `app/js/world/seamask.js` | `packages/nucleo/world/seamask.js` |
| `app/js/world/settlements.js` | `packages/nucleo/world/settlements.js` |
| `app/js/world/routes.js` | `packages/nucleo/world/routes.js` |
| `app/js/world/parajes.js` | `packages/nucleo/world/parajes.js` |
| `app/js/world/build.js` | `packages/nucleo/world/build.js` |
| `app/js/names/{index,es,gl}.js` | `packages/nucleo/names/{index,es,gl}.js` |
| `app/js/quests/{casting,templates}.js` | `packages/nucleo/quests/{casting,templates}.js` |
| `parseGeo`, `parseStreets`, `parsePois` de `app/js/data/overpass.js` | `packages/nucleo/world/osm.js` |
| `fetchGeoFeatures`, `fetchPois`, `fetchStreets` de `app/js/data/overpass.js` | se quedan en `app/js/data/overpass.js` |

El parseo se va con el paquete y el transporte se queda, y esa raya no es arbitraria: convertir una respuesta de Overpass en features en metros es una función pura y determinista de la que depende el mundo, y `docs/testing.md` exige poder afirmar «El orden de iteración no depende del orden de inserción» sobre datos congelados, cosa que solo se puede comprobar si el parseo corre dentro del núcleo. El texto de la consulta, en cambio, ya vive en los manifiestos de los fixtures y es cosa de la capa de datos.

Nada de `app/js/render/` ni de `app/js/main.js` entra en el paquete.

### La frontera de inyección

Esta spec **no** cambia el contrato de inyección: `buildWorld` sigue recibiendo `fetchData(lat, lon, radius) → { geoJson, poiJson }` y un `onStatus` opcional, exactamente como hoy. Lo único que cambia es que la frontera pasa a ser comprobable en lugar de ser una costumbre.

Dos consecuencias que el implementador tiene que tener presentes:

- **El callejero se queda fuera del contrato.** Los mundos congelados traen una cuarta parte (`callejero.json`) que hoy nadie consume dentro de `buildWorld`: el prototipo la pide aparte, desde `main.js`, y la usa solo para pintar las calles de cada núcleo. Meterla en `fetchData` sería rediseñar la entrada, y eso le toca a la fila 7 (`grafo-cosido-ramales`), que es donde el callejero pasa a alimentar el grafo. Queda anotado como hueco conocido.
- **`fetchData` se llama dos veces en costa.** Cuando hay línea de costa, la tubería vuelve a pedir datos con un radio ampliado. No es un descuido y no se toca: es lo que evita que el borde del mapa corte una ría por la mitad. El doble del andamiaje ya sirve el mismo mundo congelado a las dos llamadas.

### Las cadenas de semilla, fase a fase

Quedan como están, y esto importa porque cualquier cambio aquí mueve todos los mundos:

| Fase | Cadena |
| --- | --- |
| Núcleos y servicios | la semilla pelada |
| Calzadas | `<semilla>:routes` |
| Parajes | `<semilla>:parajes` |
| Título del mundo | `<semilla>:title` |
| Casting, por plantilla | `<semilla>:cast:<id de plantilla>` |

La fase de núcleos deriva de la semilla sin sufijo literal, y aun así **cumple** lo que pide RNF-DET-001: lo que el requisito protege es que cada fase tenga su propio flujo, de modo que tocar una no desplace el azar de las demás, y la cadena vacía es una cadena distinta de las otras cuatro. Ponerle un sufijo sería más legible y cambiaría todos los mundos generados hasta hoy; se hace en la fila 3, que reescribe esa fase entera y de todos modos cambia la forma de la semilla al pasar de radio a celda. Aquí no.

### Los extractos de referencia

Un porte se verifica contra lo que había antes, y esa es toda la razón de `test/fixtures/mundos-referencia/`: ocho ficheros, uno por cada mundo congelado y cada una de las dos semillas de referencia (`#1` y `#2`), **capturados del prototipo antes de mover nada** y commiteados en la misma entrega.

Un extracto no es el mundo entero volcado: es lo que sobrevive a una comparación honesta. Cabecera con el mundo congelado, la semilla y la revisión de git del prototipo con la que se capturó; y después, ordenado establemente, el título, el idioma, el radio de dibujo y, para cada núcleo, servicio, paraje y calzada, su nombre, su tipo, sus coordenadas redondeadas al metro y el identificador de OSM de su anclaje. Con eso, una traducción que pierda una línea o invierta un signo se ve; y no se arrastra el ruido de las estructuras internas, que además cambian de forma en esta misma entrega.

**Si cerrar la independencia del orden de llegada obliga a introducir una ordenación explícita que no estaba**, algún extracto cambiará. Es aceptable y no invalida el porte, pero entonces la entrega tiene que declararlo y estos invariantes tienen que seguir cuadrando con el prototipo, porque no dependen del flujo de azar: los recuentos por tipo (salen del cupo por radio, que es función pura del radio), el título del mundo y el idioma (derivan de cadenas propias) y el conjunto de plantillas que castean. Hay criterios de aceptación dedicados a los tres.

### Lo que el ida y vuelta por JSON se lleva por delante

El prototipo cuelga propiedades de arrays —`geo.rivers` guarda polilíneas con un `kind` pegado al array— y eso no sobrevive a `JSON.stringify`. Mientras todo vivía en memoria daba igual; en cuanto el mundo se compara serializado, y más aún cuando la fila 9 lo congele en la partida, el dato desaparece en silencio. El porte es el momento de cerrarlo, y es el único cambio de forma que esta spec permite: lo que hoy es una propiedad colgada de un array pasa a ser un campo de un objeto. Consumidores a revisar: `app/js/render/map.js`.

### Quién toca qué

`.claude/rules/naming.md` reserva `test/**` para `wa-qa-dev` y SPEC-001 ya matizó que la regla habla de **casos de prueba**, no de herramienta. Este porte añade dos matices más, y ninguno admite interpretación:

| Ruta | Quién la escribe, en esta spec |
| --- | --- |
| `packages/nucleo/**` | `wa-dev` |
| `test/fixtures/mundos-referencia/**` | `wa-dev`: son datos de referencia, como los fixtures de OSM |
| `app/js/main.js`, `app/js/render/**`, `app/js/data/overpass.js` | `wa-dev`, solo para reapuntar imports y sacar el parseo |
| `server.mjs` | `wa-dev`, solo si hace falta para que el prototipo siga cargando el paquete |
| `test/headless.mjs`, `test/casting-report.mjs` | `wa-dev`, **solo** para reapuntar sus imports al paquete |
| `test/nucleo/**`, `test/app/**`, `test/spec-test-map.json` | solo `wa-qa-dev`, siempre |

Que las dos herramientas headless sigan corriendo no es una cortesía: `arquitectura.md` §2 lo pone por escrito —«`test/headless.mjs` y `test/casting-report.mjs` siguen vivos desde el primer día»— y son la única verificación de tubería completa que existe hasta que `wa-qa-dev` cubra la batería. Se reapuntan, no se migran: convertirlas en casos de `test/nucleo/` es trabajo de `wa-qa-dev`, y se retiran cuando sus afirmaciones vivan allí.

`server.mjs` sirve hoy `app/` y nada más. Si el prototipo en navegador deja de cargar porque el paquete está fuera de esa raíz, se sirve también `packages/nucleo/` como estático. Es una línea, y es lo que evita duplicar el generador «para que el prototipo siga funcionando», que es exactamente lo que este porte existe para no hacer.

### Trampas heredadas

- **`.gitignore` con reglas sin anclar.** Ya se tragó `app/js/data/overpass.js` entero y nadie se enteró porque los tests no lo importaban. Hay un criterio de aceptación con `git ls-files` por ese precedente; si se añade alguna regla nueva, va anclada.
- **`archive/v0.0.1/` y `archive/v0.0.2/` son instantáneas congeladas** y cualquier búsqueda global devolverá resultados duplicados desde ahí. No se tocan y no se usan como fuente del porte: la fuente viva es `app/js/`.
- **Un test verde no significa app viva.** `test/headless.mjs` no importa la capa de datos ni el render, así que puede seguir en verde con el prototipo roto. La verificación del porte incluye abrir la app y generar un mundo.

### Escenarios de la batería que este porte tiene que dejar en pie

Ninguno se implementa aquí —son de `wa-qa-dev`—, pero el paquete está dimensionado para que se puedan escribir sin añadirle nada:

- **Determinismo, bloqueantes** → «Dos generaciones con la misma semilla dan el mismo mundo», «Cambiar la semilla cambia el mundo», «Cada fase usa su propio sufijo de azar», «No se usa ninguna fuente de azar ni de tiempo del sistema», «El orden de iteración no depende del orden de inserción».
- **Anclajes y nombres** → «Ningún anclaje aparece dos veces», «Los parajes reparten lo que los núcleos no gastaron», «No hay dos nombres iguales en un mundo», «El idioma sale de la ubicación».
- **Casting** → «El casting es determinista», «El mundo mínimo todavía compone un lazo».
- **Callejero** → «Los huecos cortos se cosen», «Los huecos largos no se cosen»: el porte no los cierra, pero tampoco puede romperlos.
- **Privacidad, bloqueante** → «Las coordenadas salen una sola vez, al generar el mapa»: aquí se afirma la mitad que corresponde al núcleo, que del paquete no sale ninguna petición por su cuenta.

## Decisiones asumidas

- **El parseo de OSM entra en el paquete y el transporte se queda fuera** → asumido, en `packages/nucleo/world/osm.js` (alternativa: dejar el parseo con la capa de datos y que `fetchData` devuelva features ya parseadas). Regla: `docs/testing.md` exige afirmar el determinismo frente al orden de llegada de los datos crudos, y eso solo se comprueba si el parseo corre dentro del núcleo; además es la línea que el prototipo ya trazaba, porque `build.js` parsea y `main.js` transporta.
- **El parseo vive en `world/` y no en un área nueva** → asumido (alternativa: `core/osm.js`, o un área `data/` dentro del paquete). Regla: las áreas del paquete están fijadas en `03-stack-context.md` (`core`, `world`, `names`, `quests`, `partida`) y el parseo produce el terreno y los anclajes del mundo, que es material de `world/`.
- **Se mueve, no se duplica: `app/js/{core,world,names,quests}` desaparecen** → asumido (alternativa: copiar al paquete y dejar el prototipo intacto sobre su copia). Regla: CLAUDE.md, «misma tubería, mismos mundos»; dos copias divergen en la primera corrección y el porte existe precisamente para que el generador sea uno.
- **El prototipo sigue vivo y se reapunta al paquete** → asumido, incluida la línea de `server.mjs` que sirve `packages/nucleo/` si hace falta (alternativa: congelar el prototipo y aceptar que deja de abrirse hasta que exista la app de Expo). Regla: `arquitectura.md` §2 exige que las herramientas headless sigan vivas desde el primer día, y `test/casting-report.mjs` es la única verificación de tubería completa contra mundos reales que hay.
- **`test/headless.mjs` y `test/casting-report.mjs` se reapuntan y no se migran** → asumido (alternativa: convertirlas ya en casos de `test/nucleo/`). Regla: `naming.md` reserva los casos de prueba para `wa-qa-dev`; reapuntar un import es consecuencia mecánica del porte, reescribirlas es invadir otro rol.
- **La equivalencia se afirma contra extractos de referencia, no contra un volcado byte a byte del mundo** → asumido, ocho extractos en `test/fixtures/mundos-referencia/` (alternativa: serializar el mundo entero y comparar). Regla: el mundo en memoria contiene estructuras que esta misma entrega cambia de forma, y la serialización completa la define la fila 9; un extracto de nombres, tipos, coordenadas y anclajes prueba lo mismo sin arrastrar ese ruido.
- **Dos semillas de referencia por mundo congelado, `#1` y `#2`** → asumido (alternativa: una sola). Regla: «Cambiar la semilla cambia el mundo» necesita dos mundos comparables sobre los mismos datos de OSM.
- **La fase de núcleos conserva su cadena de semilla sin sufijo literal** → asumido (alternativa: renombrarla a `<semilla>:settlements` ahora). Regla: RNF-DET-001 protege que cada fase tenga flujo propio, cosa que ya se cumple; renombrarla cambiaría todos los mundos y la fila 3 reescribe esa fase entera, incluida la forma de la semilla.
- **El paquete lleva un `package.json` mínimo** → asumido, con nombre, `"type": "module"` y cero dependencias (alternativa: ningún `package.json`, apoyándose en que Node detecta la sintaxis de módulo). Regla: `03-stack-context.md` pide cero dependencias de runtime, pero no pide depender de una heurística del intérprete; declararlo también deja el paquete resoluble por nombre cuando llegue el empaquetador de Expo en la fila 20.
- **Sin `package.json` en la raíz y sin workspaces** → asumido: hasta la fila 20 los imports son por ruta relativa (alternativa: montar ya el workspace). Regla: CLAUDE.md, no se introduce toolchain que nadie ha pedido; el paquete se consume desde Node y desde el navegador por ruta, que es lo que hace hoy el prototipo.
- **La extensión de los módulos sigue siendo `.js`** → asumido (alternativa: `.mjs`, como los scripts). Regla: `naming.md` admite las dos y el navegador del prototipo carga estos mismos ficheros; cambiar la extensión obligaría a tocar cada import sin ganar nada.
- **`packages/nucleo/partida/` no se crea vacío** → asumido: el área queda reservada por nombre y la crea la fila 9 (alternativa: crearla con un módulo de relleno). Regla: git no versiona directorios vacíos y un módulo de relleno es código muerto que hay que borrar después.
- **El callejero no entra en el contrato de `fetchData`** → asumido, se queda como hoy fuera de `buildWorld` (alternativa: ampliar el contrato para consumir la cuarta parte de los mundos congelados). Regla: el alcance de esta spec es mover, no rediseñar la entrada; el callejero pasa a alimentar el grafo en la fila 7.
- **Las propiedades colgadas de arrays pasan a ser campos de objeto** → asumido como único cambio de forma permitido (alternativa: dejarlo y arrastrar la pérdida hasta la serialización de la fila 9). Regla: hay criterios de aceptación sobre comparar mundos serializados, y un dato que desaparece en silencio al serializar convierte esa comparación en una mentira.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: CLAUDE.md, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep.
- **Sin sección de comportamiento responsive** → asumido por decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz.
