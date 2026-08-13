# Checklist de specs

> Backlog del pipeline, derivado de los RF de `docs/prd.md` (v1.0, 7-ago-2026). Las columnas Spec/Rationale/Prioridad las mantiene el humano (o `/somo-plan-fable` al regenerar); la columna Estado la escribe SOLO `/somo-pipeline`. El orden ES la prioridad de ejecución: dependencias primero. Los bloques B1-B6 son la vista de agrupación del roadmap del PRD (§9).

## B1 · El núcleo portado

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 1 | andamiaje-pruebas | RF-INFRA-007 | must | done |
| 2 | paquete-compartido | RF-INFRA-001, RNF-DET-001, RNF-DET-003 | must | done |
| 3 | rejilla-celdas-semilla | RF-MUNDO-001, RF-MUNDO-002, RF-MUNDO-003, RF-MUNDO-004, RF-MUNDO-005 | must | done |
| 4 | tramo-personal | RF-PJ-004, RF-MUNDO-007, RNF-ACC-001, RNF-ACC-003 | must | done |
| 5 | pool-anclajes-filtros | RF-MUNDO-006, RF-MUNDO-009, RF-MUNDO-010, RF-MUNDO-011 | must | done |
| 6 | parajes-cobertura-escenas | RF-MUNDO-007, RF-MUNDO-008 | must | done |
| 7 | grafo-cosido-ramales | RF-MUNDO-013, RF-MUNDO-014 | must | done |
| 8 | filtro-accesibilidad-grafo | RF-MUNDO-017 | must | done |

## B2 · El mundo vivo

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 9 | serializacion-mundo-congelado | RF-PERS-001, RF-PERS-002, RNF-RED-002 | must | done |
| 10 | casting-quests | RF-QUEST-001, RF-QUEST-002, RF-QUEST-003, RF-QUEST-004, RF-QUEST-005, RF-QUEST-015 | must | done |
| 11 | motor-pasos | RF-RUMOR-001, RF-RUMOR-002 | must | done |
| 12 | propagacion-rumores | RF-RUMOR-003, RF-RUMOR-004, RF-RUMOR-005 | must | done |
| 13 | prologo-mundo | RF-MUNDO-015, RF-QUEST-014 | must | done |
| 14 | npcs-capa | RF-NPC-001, RF-NPC-002, RF-NPC-003, RF-NPC-004, RF-NPC-005 | must | done |
| 15 | progresion-rango-oro-objetos | RF-PROG-001, RF-PROG-002, RF-PROG-004, RF-PROG-006, RF-PROG-008 | must | done |
| 16 | diario-estado-hechos | RF-DIARIO-001, RF-PERS-003 | must | done |

## B3 · La palabra

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 17 | catalogo-plantillas | RF-QUEST-009, RF-LANG-001, RF-LANG-003, RF-LANG-004 | must | done |
| 18 | contrato-llm | RF-QUEST-006, RF-QUEST-007, RF-QUEST-008, RF-LANG-005, RF-PRIV-001 | must | done |
| 19 | cola-entregas-microencuentros | RF-QUEST-010, RF-QUEST-016 | must | done (la fila 50 cableó la siembra: la partida nace con la cola sembrada, verificado en `wa-pixel` leyendo `estado.json` con `run-as`) |

## B4 · La app y el mapa

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 20 | app-scaffold-expo | RF-INFRA-001, RF-INFRA-006, RNF-COM-001 | must | done |
| 21 | render-skia-estilos | RF-MAPA-001, RF-MAPA-002 | must | done |
| 22 | declutter-rotulos | RF-MAPA-003 | must | done |
| 23 | proxy-ciego | RF-INFRA-002, RNF-PRIV-001, RNF-COST-001 | must | done |
| 24 | overpass-produccion | RF-INFRA-003, RNF-PER-001 | must | done |
| 25 | imagenes-ficcion-fotos-places | RF-MUNDO-016, RF-BUCLE-003 | should | done |
| 26 | mapa-en-movil | RF-MUNDO-001, RF-MUNDO-012, RNF-PER-001 | must | done |

## B5 · El bucle en la calle

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 27 | onboarding-arranque | RF-PJ-001, RF-PJ-002, RF-PJ-003, RF-PJ-005, RF-PJ-006, RF-PJ-007, RF-PJ-008, RF-PRIV-005, RF-PRIV-006 | must | done |
| 28 | portada-antes-de-salir | RF-BUCLE-002, RF-QUEST-011, RF-QUEST-012, RNF-RED-001 | must | done (la aceptación no llegaba al motor y la lista no tenía memoria; **cerrado por la fila 49**) |
| 29 | en-marcha-mapa-avisos | RF-BUCLE-001, RF-BUCLE-004, RF-BUCLE-009, RF-BUCLE-014, RF-BUCLE-016, RF-MAPA-005 | must | done |
| 30 | rotulo-sistema | RF-INFRA-004, RF-BUCLE-010, RF-BUCLE-017 | must | done |
| 31 | deteccion-vehiculo | RF-INFRA-005, RF-BUCLE-015 | must | done |
| 32 | llegadas-geofence | RF-BUCLE-005, RF-BUCLE-006, RF-RUMOR-005 | must | done |
| 33 | visor-anclaje | RF-BUCLE-007, RF-BUCLE-008 | must | done |
| 34 | escena-beat | RF-QUEST-004, RF-PJ-009 | must | done (paquete; **su pantalla la entregó la fila 49**) |
| 35 | descarte-anclaje | RF-PRIV-004 | must | done (la fila 50 arregló A4P8: la capa no se ponía encima y «Marcarlo» no se podía pulsar; ahora el centro del botón marca, verificado en `wa-pixel`) |
| 36 | telon | RF-BUCLE-011, RF-BUCLE-012, RF-BUCLE-013, RF-MAPA-004, RF-QUEST-013, RF-DIARIO-005, RF-DIARIO-006, RF-PROG-005 | must | done (paquete; **su pantalla la entregó la fila 49**) |

## B6 · Lo que queda en casa

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 37 | diario-consulta | RF-DIARIO-002, RF-DIARIO-003, RF-DIARIO-004 | must | done |
| 38 | repisa-ajustes | RF-PROG-007, RF-PJ-010, RF-LANG-002 | must | done |
| 39 | partida-respaldo-export | RF-PERS-004, RF-PERS-005, RF-PERS-008, RF-PRIV-002 | must | done (mecanismo, no cableado — ver fila 47) |
| 40 | empezar-de-nuevo | RF-PERS-006 | must | done |
| 41 | mapas-multiples | RF-PERS-007, RF-MUNDO-004, RF-PROG-003 | must | done (la fila 50 cableó A2P0 y arregló su rama, que tumbaba la app por montar menos hooks; vista en `wa-pixel` a 500 km del mapa de casa) |
| 42 | pasos-fondo-zurron | RF-RUMOR-002, RF-RUMOR-006, RF-PRIV-003 | should | done |

## B7 · La navegación, que es la puerta que faltaba

Las tres filas salen de `pipeline/decisiones-orquestador.md` §6y y del punto 1 de `pipeline/informe-final.md` §9: las pantallas de B5 y B6 están escritas y probadas en Node, y no hay máquina de estados en `app/` que las encadene. No añaden requisito nuevo — cablean el recorrido que `docs/flujo.md` ya declara.

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 43 | navegacion-de-consulta | RF-DIARIO-002, RF-PROG-007, RF-PJ-010, RF-PERS-006, RF-RUMOR-002 | must | done |
| 44 | navegacion-en-la-calle | RF-BUCLE-005, RF-BUCLE-007, RF-BUCLE-011, RF-QUEST-004, RF-PRIV-004 | must | done (entrega RF-BUCLE-005, RF-BUCLE-007 y RF-PRIV-004; **RF-QUEST-004 y RF-BUCLE-011 pasan a la 49**, que es la escena del beat y el telón — ver §9 y la spec) |
| 45 | puerta-de-desarrollo | RF-INFRA-007 | must | done |
| 46 | fuente-de-salud-y-zurron | RF-RUMOR-002, RF-RUMOR-006, RF-PRIV-003 | should | done (cotejo independiente 13-ago: números confirmados desde aparato limpio y en exclusiva; **cierra B7 entero**; pantallas huérfanas a **0**; `zurron.yaml` a límite declarado por la forma nueva «depende del mundo» — ver §14) |
| 47 | partida-persistida | RF-PERS-001, RF-PERS-002, RF-PERS-003, RF-PERS-008 | must | done |
| 48 | modulo-de-ubicacion | RF-BUCLE-001, RF-BUCLE-005, RF-BUCLE-006, RF-INFRA-004, RF-PRIV-002 | must | done (sensor y rótulo; el camino de la llegada se queda en la 44 — ver §7a) |
| 49 | pantallas-de-la-escena-y-el-telon | RF-QUEST-004, RF-PJ-009, RF-BUCLE-011, RF-BUCLE-012, RF-BUCLE-013 | must | done (entrega los cinco; **RF-QUEST-004 y RF-BUCLE-011**, que la 44 le pasó, quedan entregados) |
| 50 | cableados-que-faltan | RF-QUEST-010, RF-QUEST-016, RF-MUNDO-004, RF-PRIV-004 | must | done (cotejo independiente 12-ago: números confirmados desde aparato limpio; los rojos de `en-marcha`/`telon` **no son regresión** — proveedor de ubicación frío, ver §13b y la trampa en `CLAUDE.md`) |

La **46** sale de `SPEC-043-iter-1`: recoge lo que el zurrón necesita y la navegación no dio. La spec de origen decía «tres piezas y ninguna sirve sola», y al medirlo eran **dos** — la fuente nativa de salud y el motor de pasos montado —, porque la tercera, el registro de hechos de la partida, ya tenía dueño en la app desde las filas 47 y 50 (`App.js:271/:320`): la 46 la consume, no la trae. La dependencia nativa se decidió antes de implementarse, como manda el método: **Health Connect, solo Android**, ratificada por el dueño en el prompt, con la pareja iOS como doble declarado. **Cerrada el 13-ago-2026** con el minSdk en 26 (primer cambio de suelo de aparatos, arrastrado por la fuente), la primera inyección de código nativo propio (el plugin que traduce la razón de permisos a enlace profundo sin decidir nada), y las pantallas huérfanas en **cero** por primera vez desde que existe la guarda.

La **47** tampoco es de este encargo, y es la más grave de las dos. Medido el 10-ago-2026: **`congelaEstado` y `levantaEstado` no se llaman desde ningún sitio de `app/`**. `App.js` construye `estadoInicial({ semilla })` en cada arranque y ese estado vive solo en memoria; de los cuatro prefijos de `PREFIJOS_DE_LA_PARTIDA`, la app escribe `arranque/`, `camara/` y `mapa/`, y **`partida/` no lo escribe nadie**. El diario, la repisa, el oro, los motes, las aventuras, las entregas, los rumores y los NPCs se pierden al cerrar la app.

Y la consecuencia que conviene tener escrita porque no se ve desde ninguna prueba de la fila 39: **una copia exportada hoy sale sin documento de partida**. El respaldo funciona y no respalda nada de lo jugado.

Iba con su guarda ya escrita y **en rojo a propósito** hasta que se cerrara: `test/nucleo/partida-persistida.test.mjs`, tres casos rojos con nombre y dueño. Es la aplicación de la regla que más cara ha salido en este repo — lo que falta se exige, y su ausencia es error de construcción, nunca un valor por defecto — y por eso no fue un comentario. **Cerrada el 10-ago-2026 con SPEC-047**: los tres se apagaron por el cableado, sin tocar la prueba.

La fila 39 sigue en `done` y no se reabre: entregó el mecanismo entero y sus pruebas lo demuestran. Lo que no entregó es el cableado, y eso fue esta fila.

Y lo que la 47 **no** desbloqueó, con la cifra delante: la columna de límite declarado sigue en **9**, no baja. `repisa.yaml` era el único que dependía de ella y no puede pasar, porque hoy **nada de `app/` altera el estado de la partida después de que el arranque se cierre** — las cuatro pantallas de consulta solo leen, el interruptor de pasos de fondo recibe su callback a `null` (fila 46), y quien emite hechos espera a las filas 48 y 49. Sembrar una partida con contenido en el dispositivo pide una vía que no existe y que es diseño, no implementación; queda fichada aquí en lugar de estirar la fila.

La **48** era el bloqueo más grande de todos, y salió de medir por qué la fila 44 no se podía hacer: **la app no tenía módulo de ubicación**. **Cerrada el 11-ago-2026** con dos dependencias autorizadas por el dueño del proyecto, `expo-location` y `expo-task-manager`, y con **cuatro** contratos que pasan a tener llamador de verdad desde `app/` — no dos, como se creía: al medirlo aparecieron `app/plataforma/posiciones.js`, que alimenta al detector de vehículo y no lo consumía nadie, y `creaRotulo`, que `capacidades.js` daba por cableado en un comentario. RF-INFRA-004 entra con ella: el rótulo del sistema en Android es un servicio en primer plano de verdad.

**Su alcance se recortó antes de implementarla, y conviene leerlo junto a la 44.** El encargo pedía a la vez «no estires la fila» y recorrer una llegada entera, y eso último es la máquina de la salida, que es de la 44. El dueño decidió acotar: la 48 termina cuando en marcha se ve la posición moverse y el detector clasifica. **El geofence, la llegada, el visor, lo que se cuenta y el descarte siguen enteros en la 44**, y con ellos las seis pantallas huérfanas del momento «al parar», que **siguen en ocho**. El relato completo está en `pipeline/decisiones-orquestador.md` §7.

Y lo que la fila destapó y no arregla, porque no es suya: **la app lleva desde SPEC-023 despertándose al arrancar el móvil**. `expo-notifications` declara `RECEIVE_BOOT_COMPLETED` y un receptor que escucha `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` y `MY_PACKAGE_REPLACED`, y la guarda de privacidad no lo veía porque leía `app.json` en lugar del manifiesto fusionado. Ahora hay guarda que mira el artefacto generado en las dos plataformas, y **nace roja con ese dueño escrito** en lugar de nacer tolerándolo.

La **49** son las dos pantallas que sus filas nunca escribieron: **A4P3, la escena de un beat**, y **A5P1-A5P4, el telón**. Medido por cierre de imports el 10-ago-2026: SPEC-034 y SPEC-036 son las dos únicas filas de B5 y B6 que **no tocaron ni un fichero de `app/`**. Las dos siguen en `done` y no se reabren —entregaron el paquete entero, con sus pruebas—, pero el checklist ya no dice que entregaran pantalla.

Las dos van con la misma guarda, `test/nucleo/pantallas-huerfanas.test.mjs`, que fija en **8 de 32** las pantallas escritas a las que no llega ningún import desde `App.js` y falla si el número sube. Eran **12** antes de la fila 43. Ese número es el que mide de verdad el patrón: no que las filas no entreguen pantalla —doce de dieciséis la entregaron— sino que **una fila podía entregar una pantalla y darse por hecha sin que nadie pudiera abrirla**.

La **50** son los tres hallazgos de la 49 que comparten forma —§6h en su variante de cableado: pieza escrita, probada y sin llamador— y que cambian el juego que se ve. Medido de cero el 12-ago-2026 al escribir su encargo: `siembraLaCola` sigue sin llamador desde `app/` (ningún micro-encuentro salta en un teléfono, deuda de la fila 19), `NUCLEO_DEL_OFRECIMIENTO` sigue sin importador (A2P0 inalcanzable, de SPEC-041), y A4P8 quedó medida por la 49 en el aparato: la capa de descarte desborda 1080×2400 y «Marcarlo» no se puede pulsar (RF-PRIV-004, de SPEC-035). Va antes que la 46 a propósito —cero dependencias nuevas, cero decisiones previas del dueño, y las guardas que vigilan las tres piezas ya existen—; las filas 19, 35 y 41 siguen en `done` y no se reabren: entregaron el mecanismo, y lo que faltaba era el cableado. El encargo completo está en `docs/prompts/prompt-cableados-que-faltan.md`.

## B8 · Lo que las filas ficharon

Filas que no salen del PRD sino de lo que las filas anteriores midieron y dejaron fichado con dueño. Cada una cita su origen; el número lo asigna quien orquesta, como siempre.

| # | Spec (slug) | Rationale (PRD) | Prioridad | Estado |
| --- | --- | --- | --- | --- |
| 51 | beats-con-cara | RF-QUEST-009, RF-PJ-009, RF-INFRA-007 | should | done (cotejo independiente 13-ago, **el primero en worktree propio**: 2906 · 2902 · 1 · 3 con `mirado: true` medido en las dos plataformas; casteabilidad idéntica byte a byte; 0 → 69 beats con cara; la cara en pantalla de teléfono queda para la primera fila con aparato — ver §15) |
| 52 | nada-se-despierta-al-arrancar | RF-PRIV-003 | should | done (cotejo independiente 13-ago en worktree: **2915 · 2912 · 0 fallos · 3 saltados — la primera batería de núcleo 100 % verde del proyecto**, con `mirado: true` en ambas plataformas; el receptor conserva solo `NOTIFICATION_EVENT`, verificado sobre el artefacto — ver §16) |
| 53 | los-rojos-y-lo-nunca-visto | RF-BUCLE-001, RF-BUCLE-011, RF-BUCLE-007, RF-PERS-006, RF-PJ-009, RF-PRIV-003 | must | done (cotejo independiente 14-ago en worktree: **PASS del runner por primera vez** — 2960 · 2957 · 0 · 3 y @app 21 · 12 · 0 · 9, cero rojos en el proyecto entero; los tres históricos apagados por la raíz, FCM neutralizado verificado — ver §17) |

La **51** sale del fichado de la fila 49 (§11f del registro, dueño del hueco SPEC-017): 20 plantillas declaran rol humano y **ningún beat cae sobre ellos** — 0 de 506 en los cuatro mundos de referencia —, así que `escena.cara` es siempre nula y el bloque de quien habla no se ha pintado nunca. La composición está entera esperando (`escena.js`, `desenlace.js`, A4P3). Corta, solo núcleo, sin emulador. Lleva de segunda entrega la guarda de lista cerrada de `app/plugins/` (decisión §14e). El encargo completo está en `docs/prompts/prompt-beats-con-cara.md`.

La **52** es la deuda más vieja del repo que sigue viva y el único rojo de la batería de núcleo: la app se despierta al arrancar el móvil por el receptor de `expo-notifications` (fichado desde la fila 48, dueño SPEC-023, guarda nacida roja a propósito). Medido el 13-ago: el molde exacto ya existe — el punto 3 de `retira-permisos-prohibidos.js` hizo lo mismo con el gemelo de `expo-task-manager` — y la medición central es qué pierde la app si su receptor no escucha el arranque (el diseño dice que nada corre con la app cerrada). El premio: la primera batería de núcleo 100 % verde del proyecto. El encargo completo está en `docs/prompts/prompt-nada-se-despierta-al-arrancar.md`.

La **53** es la primera fila con aparato tras cerrar el checklist, y junta todo lo acumulado con esa etiqueta: los tres rojos de `@app` (proveedor frío y la sospecha del botón atrás), lo que nadie ha visto en un teléfono (la cara de un beat en A4P3, el visor con su spread), la caída del servicio en primer plano con el `logcat` por fin armado, y la segunda vía de despertar que la 52 fichó. Lleva **tres decisiones del dueño ratificadas el 13-ago**: la apertura cae a última posición conocida con cota de frescura, el punto de partida cuenta como sitio solo para la cadencia (la sonda midió que el telón por regreso no podía saltar en 6 de 8 mundos), y la propiedad de despertar se ensancha con lista cerrada neutralizando FCM. El encargo completo está en `docs/prompts/prompt-los-rojos-y-lo-nunca-visto.md`.

**Qué entregó la 51** (13-ago-2026, entrada XXXVI de la bitácora): los beats con cara —**21 en 19 plantillas**, elegidos por dos reglas sacadas del propio catálogo y no por una lista a mano—, que dan **69 de 506 beats sobre rol humano donde había 0**, en 63 de 103 aventuras de los cuatro mundos de referencia; la regla del sitio aplicada en **siete** consumidores (cinco declarados en la spec, dos encontrados y declarados al implementar: el guiado de `aventura.js` y el sobre del prompt de `narrador.js`, los dos fugas de registro); los **nueve rótulos de puesto** con palabras del mundo, con un puesto sin rótulo como error de construcción; la herencia de forma entre las dos mitades del paso (A4P3 y A4P4); y la **segunda entrega íntegra**, `test/nucleo/plugins-declarados.test.mjs`, la lista cerrada de `app/plugins/` con las tres direcciones de rojo verificadas a mano. Cuatro decisiones del dueño, entre ellas la **ratificación del pendiente 1 de `game-design/npcs.md`**, que llevaba sin decidir desde el 5-ago. La casteabilidad **no baja**: `casting-report` idéntico byte a byte (agregado 640/660), medido tres veces por dos manos. **@nucleo 2906 · 2902 · 1 · 3** con el único rojo ajeno y fichado (`BOOT_COMPLETED`, SPEC-023) y `headless.mjs` de 15 rojos a 0. **@app no ejecutado**: la fila no tomó el emulador, y sus números salen del cotejo.

## Notas de derivación

- **Una fila por spec implementable y testeable de una pasada**, no una por RF: los RF de una misma feature cohesionada comparten fila (la capa de NPCs son cinco RF y una spec), y los RF transversales (RNF-DET, RF-PRIV-001/002) aparecen en la spec donde se implementa su garantía y se verifican como bloqueantes en todas (`RNF-DET-003`).
- **El orden respeta dependencias**: nada de B2 sin el paquete y la rejilla de B1; nada de B5 sin el andamiaje `@app` de la fila 1 y el render de B4; el catálogo (17) puede avanzar en paralelo desde que existe el casting (10).
- Los slugs son estables: serán el nombre del fichero de spec y parte de la rama del pipeline. No se renombran.

La **49** entregó las ocho pantallas que SPEC-034 y SPEC-036 nunca escribieron —A4P3, A4P4 y A5P1 a A5P4 con su cartela— **y las once costuras que impedían que hicieran nada**. Cinco estaban antes de empezar y la más grave era que `acepta` de `aventura-en-curso.js` no la llamaba nadie: `enCurso` era `null` siempre, así que **no había aventura en curso ningún día** y el telón se habría compuesto como un paseo. El relato entero está en `pipeline/decisiones-orquestador.md` §11.

**Verificado en `wa-pixel`, recorriendo el bucle entero dos veces** —antes y después de la migración—: aventura terminada con desenlace notable (oro 12, objeto, rango y rumor), cierre en corto sin oro ni rumor, paseo sin coger nada, día sin descubrimientos, y el telón desencallando la app por sus **dos** puertas. Lo que **no** se pudo verificar es el telón por regreso: el servicio en primer plano se cae a mitad de salida, dos veces sin provocarlo. Se verificó por «dejarlo aquí» y por la tarjeta de a medias, que `bucle-jugable.md` §8 declara la misma puerta.

**La columna de límite declarado sube de siete a ocho, y se dice por qué.** `telon.yaml` **sale** —recorre el telón entero con el dedo, incluidas las dos salidas de A5P4— y `llegada.yaml` **vuelve a entrar**: su verde de la fila 44 no era reproducible, porque depende de que el sitio por el que empieza el mapa caiga bajo los pies de quien juega, y eso lo decide dónde quedó el GPS del emulador. Medido tres veces con `salida-sitio = sin-sitio`. `escena.yaml` no sale, y su motivo viejo era falso: no es que falte `paso-escena`, es que **no debe existir**.

Y esta fila estrena la **primera migración de formato del proyecto** (`VERSION_FORMATO` 1 → 2). Costó tres cosas más: nueve pruebas que codificaban «todavía no hay migraciones» como invariante, un lector estricto que impedía que ningún documento viejo llegara a la cadena, y que la versión sea **global a las ocho clases de documento**, lo que dejaba el mapa sin migrar y una partida existente sin abrir. Lo último **no se arregla aquí y queda fichado**: mientras la versión sea una sola para ocho clases, la forma vuelve cada vez que una clase evolucione sola.
