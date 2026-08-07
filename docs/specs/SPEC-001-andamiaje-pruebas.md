# SPEC-001 — El andamiaje de pruebas

## Descripción

Monta lo que hace falta para que la batería de `docs/testing.md` se pueda ejecutar: cuatro mundos de OSM congelados, un GPS simulado que sabe pararse y subirse a un vehículo, un reloj de mundo que avanza cuando se le pide, un doble del proxy con sus tres modos, un inspector de lo que sale a la red, y el runner que lo corre todo y escribe un report. Es la primera fila del checklist porque hasta que exista no hay nada que ejecutar: la batería se escribió antes que el código y sigue sin poder afirmarse.

No tiene interfaz de usuario. Lo consumen tres agentes del pipeline (`wa-qa-dev` al escribir pruebas, `wa-qa-tester` al ejecutarlas y quien orquesta al leer el report) y ninguna persona lo ve mientras juega.

Ancla: **RF-INFRA-007** (`docs/prd.md` §4.13), con la sección «Lo que hay que montar para poder ejecutar esto» de `docs/testing.md` como fuente literal, y **RNF-DET-001**, **RNF-DET-002** y **RNF-DET-003** (§5.1) como los invariantes que este andamiaje tiene que hacer comprobables.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Precisión obligada por el objeto de esta spec:** aquí el producto ES el andamiaje de pruebas, y eso no contradice el bullet anterior sino que obliga a leerlo con cuidado. El implementador entrega **la herramienta** —fixtures, dobles, runner, esquema del mapa y estructura de directorios— como código de producción, bajo las rutas que enumera «Reparto de rutas» en Notas técnicas. **Los casos de prueba que usan esa herramienta siguen siendo de `wa-qa-dev` y el implementador no escribe ni uno**: ni un `test/nucleo/*.test.mjs`, ni un `test/app/*.yaml`, ni una línea de `test/spec-test-map.json`. Si al terminar quedan ficheros de prueba en el árbol, la entrega está mal aunque todo lo demás esté bien.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive sobre todo en «Los fixtures de OSM congelados» y «El runner de pruebas»; la validación de entradas, en los cinco grupos de dobles y en la etiqueta del runner; el estado vacío, en `test/nucleo/` sin pruebas, `test/app/` sin flujos, el inspector sin peticiones y el mapa de cobertura todavía inexistente; el estado de error, en el fixture que no existe, el reloj sin motor, Node por debajo de la versión mínima y el import que rompe el núcleo; y los casos límite, en Maestro ausente con `--app-only`, la salida a red por un camino no envuelto y la restauración de la frontera al terminar.

### Estructura y frontera del andamiaje

- **Dado** un clon limpio del repositorio, **cuando** se ejecuta `node --test test/nucleo/`, **entonces** el comando arranca sin instalar ninguna dependencia.
- **Dado** el andamiaje entregado, **cuando** se listan los ficheros versionados con `git ls-files`, **entonces** aparecen los cuatro fixtures, los cinco dobles, el esquema del mapa y el runner.
- **Dado** cualquier módulo de `test/fixtures/` o de `test/dobles/`, **cuando** se inspeccionan sus imports, **entonces** ninguno importa de `packages/nucleo/`, de `app/`, de React Native ni de Expo.
- **Dado** cualquier módulo del andamiaje, **cuando** se ejecuta, **entonces** no lee ninguna variable de entorno ni ningún fichero `.env`.
- **Dado** el andamiaje entregado, **cuando** se listan los directorios de pruebas, **entonces** existen `test/nucleo/`, `test/app/` y `test/reports/` aunque estén vacíos.

### Los fixtures de OSM congelados

- **Dado** `test/fixtures/osm/`, **cuando** se enumeran los mundos disponibles, **entonces** están los cuatro: costero, urbano denso, barrio de tres calles y suelo de 250 m.
- **Dado** el nombre de un mundo, **cuando** se pide `mundoCongelado(nombre)` dos veces, **entonces** las dos llamadas devuelven datos idénticos byte a byte.
- **Dado** el resultado de `mundoCongelado(nombre)`, **cuando** quien lo recibe lo modifica, **entonces** una llamada posterior con el mismo nombre sigue devolviendo los datos originales.
- **Dado** un nombre que no corresponde a ningún fixture, **cuando** se llama a `mundoCongelado`, **entonces** falla con un error que nombra lo pedido y enumera los mundos disponibles.
- **Dado** un mundo congelado, **cuando** se pide con la opción de orden invertido, **entonces** devuelve exactamente los mismos elementos en otro orden de llegada.
- **Dado** cada fixture, **cuando** se lee su manifiesto, **entonces** declara coordenada, radio, fecha de captura, la consulta Overpass literal con la que se capturó y el inventario de etiquetas relevantes.
- **Dado** el fixture del suelo de 250 m, **cuando** se lee su manifiesto, **entonces** su radio declarado es de 250 m.
- **Dado** el fixture urbano denso, **cuando** se lee su inventario, **entonces** contiene al menos un local de adultos o bar de copas y al menos una fuente de agua potable.
- **Dado** el fixture del barrio de tres calles, **cuando** se lee su inventario, **entonces** declara cuántas componentes conexas trae su callejero y a qué distancia están entre sí.
- **Dado** cualquier fixture, **cuando** se sirve, **entonces** no se abre ninguna conexión de red.
- **Dado** un fixture ya capturado, **cuando** se vuelve a lanzar la captura, **entonces** se rechaza sin sobrescribir nada y se explica que un fixture que cambia deja de ser un fixture.

### El GPS simulado

- **Dado** una polilínea y la velocidad de un tramo declarado, **cuando** se simula el recorrido, **entonces** se emiten posiciones a cadencia fija a lo largo de la polilínea, sin saltos entre puntos consecutivos.
- **Dado** el mismo recorrido con los mismos parámetros, **cuando** se simula dos veces, **entonces** las dos secuencias son idénticas.
- **Dado** un recorrido con una parada declarada, **cuando** se simula, **entonces** durante la parada la posición no cambia y el tiempo sí avanza.
- **Dado** un tramo declarado a velocidad de vehículo, **cuando** se simula, **entonces** sus posiciones llegan marcadas como de vehículo.
- **Dado** un tramo declarado a velocidad ambigua, **cuando** se simula, **entonces** sus posiciones llegan marcadas como ambiguas, distinguibles tanto de andar como de vehículo.
- **Dado** una secuencia simulada, **cuando** se pide en formato de flujo de Maestro, **entonces** se obtiene la lista de pasos `setLocation` equivalente, con las mismas posiciones y en el mismo orden.
- **Dado** una polilínea de un solo punto, **cuando** se simula, **entonces** falla con un error explícito en lugar de emitir una secuencia vacía.
- **Dado** una velocidad de cero o negativa, **cuando** se simula, **entonces** falla nombrando el parámetro inválido.
- **Dado** el GPS simulado, **cuando** se ejecuta, **entonces** el instante de cada posición sale del origen de tiempo recibido y no del reloj del sistema.

### El reloj de mundo

- **Dado** un reloj de mundo recién creado, **cuando** se consulta, **entonces** marca cero pasos.
- **Dado** un reloj de mundo con el motor de pasos inyectado, **cuando** se le pide avanzar siete pasos, **entonces** el motor recibe siete avances consecutivos numerados del uno al siete.
- **Dado** un reloj de mundo que ha avanzado, **cuando** pasa tiempo real sin pedirle nada, **entonces** sigue marcando los mismos pasos.
- **Dado** un reloj de mundo sin motor inyectado, **cuando** se le pide avanzar, **entonces** falla con un error que nombra la dependencia que falta.
- **Dado** un número de pasos que no es un entero positivo, **cuando** se pide avanzar, **entonces** falla con un error explícito.
- **Dado** el reloj de mundo, **cuando** se inspecciona su implementación, **entonces** no usa temporizadores ni ninguna lectura del reloj del sistema.

### El doble del proxy

- **Dado** el doble en modo responde, **cuando** se le pide un texto de LLM, una imagen o una ficha de Places, **entonces** devuelve la respuesta fija que declara su fixture.
- **Dado** el doble en modo responde, **cuando** se le pide dos veces lo mismo, **entonces** devuelve exactamente lo mismo.
- **Dado** el doble en modo falla siempre, **cuando** se le hace cualquier petición de LLM, de imágenes o de Places, **entonces** todas fallan sin devolver ninguna respuesta parcial.
- **Dado** el doble en modo responde mal, **cuando** se le pide una respuesta, **entonces** devuelve una del catálogo de respuestas defectuosas de su fixture.
- **Dado** el catálogo de respuestas defectuosas, **cuando** se enumera, **entonces** incluye al menos una con un campo desconocido, una con un dato vivo que el código debe ignorar, una con contenido no apto para menores y una con un nombre que choca con el índice del mundo.
- **Dado** un modo que no es ninguno de los tres, **cuando** se crea el doble, **entonces** falla enumerando los modos válidos.
- **Dado** el doble en cualquiera de sus modos, **cuando** se le hace una petición, **entonces** no abre ninguna conexión de red real.
- **Dado** el doble, **cuando** se le pregunta qué peticiones ha recibido, **entonces** devuelve el registro en el orden en que llegaron.

### El inspector de tráfico saliente

- **Dado** un inspector envolviendo una dependencia de red, **cuando** se hacen tres peticiones, **entonces** las registra las tres en orden con su destino, su método, sus cabeceras y su cuerpo.
- **Dado** un inspector con peticiones registradas, **cuando** se le pregunta si algo contiene un texto dado, **entonces** responde mirando todos los destinos, todas las cabeceras y todos los cuerpos.
- **Dado** un inspector que no ha visto ninguna petición, **cuando** se consulta su registro, **entonces** devuelve una lista vacía y no un error.
- **Dado** el inspector en modo estricto, **cuando** algo intenta salir a la red por un camino que el inspector no envuelve, **entonces** la salida se corta con un error que nombra el destino.
- **Dado** un inspector en modo estricto, **cuando** se le pide soltar la frontera al terminar, **entonces** la deja exactamente como estaba antes de envolverla.
- **Dado** el inspector, **cuando** registra una petición, **entonces** guarda el cuerpo tal cual llegó, sin recortarlo ni normalizarlo.

### El runner de pruebas

- **Dado** `test/nucleo/` con pruebas que pasan, **cuando** se ejecuta `scripts/qa-tester-run.sh SPEC-001`, **entonces** termina con código 0.
- **Dado** una ejecución cualquiera, **cuando** el runner termina, **entonces** ha escrito `test/reports/<ETIQUETA>-run-<sello>.md` con el sello en formato `YYYYMMDDTHHMMSSZ`.
- **Dado** una ejecución cualquiera, **cuando** el runner termina, **entonces** su salida estándar contiene la ruta del report y nada más.
- **Dado** `test/nucleo/` con una prueba que falla, **cuando** se ejecuta el runner, **entonces** termina con código 1.
- **Dado** una prueba que falla, **cuando** se lee el report, **entonces** contiene el nombre literal del caso y la salida literal del fallo.
- **Dado** que Maestro no está instalado, **cuando** se ejecuta el runner, **entonces** el report registra la ausencia en la sección de infraestructura, separada de los resultados de las pruebas.
- **Dado** que Maestro no está instalado y las pruebas de `@nucleo` pasan, **cuando** se ejecuta el runner sin acotar nivel, **entonces** termina con código 0.
- **Dado** que Maestro no está instalado, **cuando** se ejecuta el runner con `--app-only`, **entonces** termina con un código distinto de 0 porque no se ha ejecutado ninguna prueba.
- **Dado** `test/nucleo/` sin ninguna prueba, **cuando** se ejecuta el runner, **entonces** termina con un código distinto de 0 y el report dice que no había pruebas que ejecutar.
- **Dado** `test/app/` sin ningún flujo, **cuando** se ejecuta el runner sin acotar nivel, **entonces** el report registra que no había flujos y las de `@nucleo` se ejecutan igual.
- **Dado** un import que falla en `packages/nucleo/` mencionando React Native o Expo, **cuando** se ejecuta el runner, **entonces** ese hallazgo encabeza el report por delante de cualquier otro resultado.
- **Dado** una etiqueta que no es `SPEC-NNN`, `SPEC-NNN-iter-M` ni `SUITE`, **cuando** se ejecuta el runner, **entonces** falla antes de ejecutar nada con un código que no es ni 0 ni 1.
- **Dado** el runner sin argumento de etiqueta, **cuando** se ejecuta, **entonces** falla mostrando el modo de empleo.
- **Dado** una versión de Node anterior a la 20, **cuando** se ejecuta el runner, **entonces** falla antes de ejecutar nada nombrando la versión mínima.
- **Dado** `test/reports/` inexistente, **cuando** se ejecuta el runner, **entonces** lo crea y escribe el report igual.
- **Dado** un árbol de trabajo sin cambios, **cuando** se ejecuta el runner dos veces seguidas, **entonces** los dos reports difieren solo en el sello de tiempo y en las duraciones.
- **Dado** el runner, **cuando** se ejecuta, **entonces** no lee ningún `.env`, no exige ninguna credencial y no necesita conexión.
- **Dado** ficheros sin commitear en el árbol de trabajo, **cuando** se ejecuta el runner, **entonces** el report lo registra como aviso y la ejecución continúa.
- **Dado** cualquier ejecución, **cuando** se lee el report, **entonces** su primera línea de contenido dice PASS o FAIL y coincide con el código de salida.

### El mapa de cobertura y su esquema

- **Dado** `test/spec-test-map.schema.json`, **cuando** se lee, **entonces** declara los campos de una entrada: spec, criterio, nivel, fichero, nombre del caso y escenario de la batería que lo respalda.
- **Dado** una entrada cuyo nivel no es `@nucleo`, `@app`, `@red` ni `@manual`, **cuando** se valida el mapa, **entonces** la validación falla nombrando la entrada.
- **Dado** una entrada que apunta a un fichero de pruebas que no existe, **cuando** se valida el mapa, **entonces** la validación falla nombrando el fichero.
- **Dado** una entrada que cita un escenario que no aparece en `docs/testing.md`, **cuando** se valida el mapa, **entonces** la validación falla nombrando el escenario.
- **Dado** una entrada sin escenario que la respalde, **cuando** se valida el mapa, **entonces** se acepta solo si viene marcada como hueco de la batería.
- **Dado** que `test/spec-test-map.json` todavía no existe, **cuando** se valida el mapa, **entonces** se informa de que aún no hay mapa y no se trata como error.
- **Dado** cualquier ejecución del runner, **cuando** se lee el report, **entonces** el resultado de validar el mapa aparece como aviso de infraestructura y nunca como una prueba en rojo.

## Notas técnicas

### Reparto de rutas: quién escribe qué

`.claude/rules/naming.md` dice que `test/**` lo escribe solo `wa-qa-dev`. Esa regla se refiere a los **casos de prueba**, y esta spec entrega herramienta, no casos. El reparto queda así y no admite interpretación:

| Ruta | Quién la escribe |
| --- | --- |
| `test/fixtures/**` | `wa-dev`, en esta spec |
| `test/dobles/**` | `wa-dev`, en esta spec |
| `test/spec-test-map.schema.json` | `wa-dev`, en esta spec |
| `scripts/qa-tester-run.sh`, `scripts/captura-fixtures.mjs` | `wa-dev`, en esta spec |
| `test/nucleo/**`, `test/app/**` | solo `wa-qa-dev`, siempre |
| `test/spec-test-map.json` | solo `wa-qa-dev`, siempre |
| `test/reports/**` | solo el runner, al ejecutarse |

`test/headless.mjs` y `test/casting-report.mjs` son del prototipo y esta spec no los toca ni los mueve.

### Frontera de inyección

Esta spec **no** cambia ninguna frontera del núcleo: la crea por el lado de fuera. Los cinco dobles existen precisamente porque el núcleo recibe su entrada y su salida inyectadas, así que doblar es pasar otro argumento y no interceptar nada. Dos consecuencias que condicionan la entrega:

- **`packages/nucleo/` todavía no existe** (lo entrega SPEC-002, `paquete-compartido`). El andamiaje tiene que poder entregarse y verificarse antes que él: fixtures que son datos y dobles que son funciones puras con sus dependencias inyectadas. Ningún módulo del andamiaje importa del paquete.
- **El motor de pasos tampoco existe** (lo entrega SPEC-011, `motor-pasos`). El reloj de mundo lo recibe inyectado y su contrato es «avanza N pasos, numerados desde el actual»; sin motor, falla nombrando la dependencia en lugar de fingir que avanzó.

### Los cuatro fixtures

Se capturan una vez contra el Overpass local del proyecto (`scripts/overpass-setup.sh` más `node server.mjs`, que es el camino que ya existe) y se commitean. Coordenadas sugeridas, tomadas de los mundos reales que ya usa `test/casting-report.mjs`, para no capturar contra sitios sin verificar:

| Mundo | Sitio | Radio |
| --- | --- | --- |
| costero | Sanxenxo, 42.402 / -8.809 | 700 m |
| urbano denso | Madrid centro, 40.4168 / -3.7038 | 1200 m |
| barrio de tres calles | a elegir por el implementador entre los que dan callejero troceado | 500 m |
| suelo de 250 m | Sanxenxo, 42.402 / -8.809 | 250 m |

Cada fixture es la respuesta cruda de Overpass, sin podar campos: podar rompe la palabra «congelado». El manifiesto va aparte para no contaminar el dato.

**Cuidado con `.gitignore`**, que en este repo ya se tragó un módulo entero: las reglas van ancladas (`/data/`, `/.cache/`) pero conviene comprobar con `git ls-files` que los cuatro fixtures están dentro antes de dar la entrega por buena. Hay un criterio de aceptación dedicado a esto por ese precedente.

### El report

Orden de secciones, que no es estético sino operativo, porque quien orquesta lee de arriba abajo y para en cuanto entiende:

1. Veredicto: PASS o FAIL, la etiqueta y el sello.
2. Regresión de núcleo, si la hay: un import que falla en `packages/nucleo/` mencionando React Native o Expo va antes que nada.
3. Infraestructura ausente: Maestro sin instalar, simulador sin arrancar, mapa de cobertura sin validar. Separada a propósito para que nadie la lea como rojo.
4. Resultados de `@nucleo`: casos, pasados, fallados, y la salida literal de cada fallo con el nombre del caso.
5. Resultados de `@app`, si se ejecutaron.
6. Estado de git como aviso: rama, commit y ficheros sin commitear.

### Códigos de salida

`0` es PASS, `1` es FAIL, y todo lo que no se pudo ni intentar (etiqueta mal formada, falta la etiqueta, Node insuficiente, nada que ejecutar) sale con `2`. La skill `wa-qa-tester` solo distingue 0 de no-0, así que el 2 no rompe su contrato y evita el peor fallo posible en un bucle desatendido: dar verde sin haber ejecutado nada.

### Localizadores reservados para `@app`

El design system pide declarar siempre dos localizadores porque casi ninguna prueba de app se apaña sin ellos: **el estado del momento** (antes de salir, en marcha, al parar, telón) y **el mapa**. Esta spec no dibuja ninguna pantalla, así que no los define: los definen las specs que dibujen esas pantallas. Queda anotado aquí para que el GPS simulado y los flujos de Maestro cuenten con ellos y para que no se inventen dos nombres distintos más adelante.

### Escenarios de la batería a los que sirve cada pieza

Ninguno de estos escenarios se implementa en esta spec —son de `wa-qa-dev`—, pero el andamiaje está dimensionado para que se puedan escribir sin añadirle nada:

- **Fixtures** → «Dos generaciones con la misma semilla dan el mismo mundo», «Cambiar la semilla cambia el mundo», «El orden de iteración no depende del orden de inserción» (de ahí la opción de orden invertido), «El mundo mínimo todavía compone un lazo» (de ahí el fixture de 250 m), «Un tag masivo no monopoliza un tipo de paraje» y «Los anclajes de adultos se excluyen del pool» (de ahí el inventario declarado del urbano denso), «Los huecos cortos se cosen» y «Los huecos largos no se cosen» (de ahí las componentes declaradas del barrio de tres calles).
- **GPS simulado** → «En la duda, cuenta», «La medición del tramo sí excluye la velocidad ambigua», «Un viaje en tren no hace avanzar el mundo», «Pasar en coche por delante de un beat no lo valida», «Volver a casa en autobús echa el telón igual».
- **Reloj de mundo** → «El contenido de un paso lo decide su número», «Estar un mes sin salir no acumula mundo pendiente», «Un paso solo añade», «No se usa ninguna fuente de azar ni de tiempo del sistema».
- **Doble del proxy** → «Con LLM y sin LLM la estructura es idéntica», «Sin red, la aventura funciona entera», «El modelo no escribe ningún dato vivo», «Lo que llega fuera del esquema se descarta», «Un texto que no pasa el filtro cae al fallback».
- **Inspector de tráfico** → «Las coordenadas salen una sola vez, al generar el mapa», «El prompt del LLM no lleva ningún dato real», «Las fotos de Places se piden al crear el mapa», «El proxy no identifica a nadie», «El rastro de ubicación no se guarda nunca», «No se reporta a ningún sitio».

## Decisiones asumidas

- **Dónde viven los dobles** → asumido `test/dobles/`, un fichero por doble (alternativa: `test/fixtures/` para todo, o `packages/nucleo/test-utils/`). Regla: `naming.md` no lo cubre, y meterlos en `packages/nucleo/` los ataría a un paquete que aún no existe y que además se publica con el juego.
- **Un fixture que ya existe no se sobrescribe** → asumido que la captura se rechaza y hay que borrar a mano (alternativa: sobrescribir con aviso). Regla: `mocking-strategy.md` §1, «se capturan una vez y no se regeneran: si cambian, dejan de ser fixtures».
- **Los fixtures se guardan crudos, sin podar** → asumido, con un presupuesto de 5 MB por fixture y 20 MB en total; si uno se pasa, se reduce el radio de captura, nunca los campos (alternativa: podar a los tags que el parser usa). Regla: podar convierte el fixture en una interpretación del dato y esconde justo los casos raros por los que existe.
- **Coordenadas de captura** → asumidas las de los mundos reales de `test/casting-report.mjs`, salvo el barrio de tres calles, que lo elige el implementador (alternativa: capturar sitios nuevos). Regla: son sitios ya verificados contra la tubería real.
- **La validación del mapa de cobertura no usa un motor genérico de JSON Schema** → asumido un validador propio que comprueba campos requeridos, valores permitidos, existencia del fichero citado y presencia del escenario en `docs/testing.md`; el fichero `.schema.json` queda como documento normativo (alternativa: añadir Ajv). Regla: cero dependencias de runtime (`03-stack-context.md`).
- **Código de salida 2 para «no se pudo ejecutar»** → asumido, reservando 0 para PASS y 1 para FAIL (alternativa: devolver 1 también aquí). Regla: `wa-qa-tester` solo distingue 0 de no-0, y confundir «falló» con «no se ejecutó» es lo que produce verdes falsos en un bucle desatendido.
- **`test/nucleo/` vacío no es PASS** → asumido código 2 con el motivo en el report (alternativa: 0, porque nada falló). Regla: misma que la anterior. Quien orquesta necesita distinguir «pasó» de «no había nada».
- **`--app-only` con Maestro ausente no es PASS** → asumido código 2 (alternativa: 0 con aviso). Regla: decisión 4 de `pipeline/decisiones-orquestador.md`, la ausencia de Maestro se reporta como infraestructura ausente y nunca como verde.
- **El inventario de etiquetas del manifiesto** → asumido que cada fixture declara qué trae de lo que la batería necesita distinguir (locales de adultos, fuentes de agua potable, componentes del callejero) (alternativa: capturar y confiar en que estén). Regla: `docs/testing.md` tiene escenarios que exigen esos datos concretos; sin declararlos, `wa-qa-dev` tendría que inventarse un fixture o falsear el dato, que es justo lo que `mocking-strategy.md` prohíbe.
- **El GPS simulado sabe emitir pasos de Maestro** → asumido (alternativa: dos simuladores, uno para `@nucleo` y otro para `@app`). Regla: `testing-framework.md` dice que en `@app` el GPS se simula encadenando `setLocation`; con dos fuentes, los recorridos de núcleo y de app dejarían de ser el mismo dato.
- **El inspector tiene modo estricto que corta la salida no envuelta** → asumido (alternativa: solo observar lo que se le pasa). Regla: `mocking-strategy.md` §5, «es la única manera de afirmar "esto no sale del móvil" en lugar de suponerlo»; un observador que solo ve lo que le dan no puede afirmar una ausencia.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep.
- **Sin sección de comportamiento responsive** → asumido por decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz.
