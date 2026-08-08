# SPEC-020 — El andamiaje de la app de Expo

## Descripción

Estrena la app. Hasta aquí el repositorio tenía un núcleo determinista que corre en Node y un prototipo web que dibuja mapas en un navegador; lo que no había era app. Esta fila monta el proyecto de React Native con Expo, lo cablea al paquete compartido para que el mismo generador corra dentro del móvil, deja los módulos de plataforma —salud, háptico, notificaciones y respaldo— como contratos que declaran si están y que la app tolera ausentes, y pone en pie el primer flujo de nivel `@app` que de verdad toca un dispositivo.

No entrega juego. Entrega una app que arranca, enseña que el núcleo vive dentro y dice qué capacidades de plataforma tiene delante. Las pantallas del bucle, el mapa dibujado y los datos reales llegan en las filas siguientes; aquí lo que se clava es la disposición, la frontera y la degradación.

Ancla: **RF-INFRA-001** y **RF-INFRA-006** (`docs/prd.md` §4.13) y **RNF-COM-001** (§5.7), con `game-design/arquitectura.md` §1 y §2 como decisión de origen —cerrada, no se discute— y `.claude/skills/wa-dev/references/03-stack-context.md` como la disposición ya fijada de las dos mitades. Se apoya en **SPEC-001** (el andamiaje de pruebas y el runner ya existen) y en **SPEC-002** (el paquete ya está portado y su frontera es comprobable).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Fuera de alcance, y esto importa más que de costumbre porque una app vacía invita a llenarla:** no entra el render con Skia (fila 21), ni el declutter de rótulos (22), ni el proxy (23), ni el Overpass de producción (24), ni la capa que trae datos de OSM al móvil (26), ni la navegación y las pantallas del onboarding (27), ni la portada (28), ni los avisos (29), ni el rótulo del sistema (30), ni la escritura y exportación de la partida (39), ni los pasos de fondo (42). De las cuatro capacidades de plataforma se entrega **su contrato y su sonda de disponibilidad**, nunca su funcionalidad: esta app no vibra, no notifica, no lee pasos y no escribe partidas.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «La app arranca y el núcleo va dentro» y en «La pantalla de andamiaje»; la validación de entradas, en el gancho de capacidades con un nombre que no existe y en el identificador de aplicación; el estado vacío, en el registro sin ningún módulo montado y en la lista de capacidades cuando las cuatro están ausentes; el estado de error, en la sonda que lanza, en el núcleo que falla al sortear y en el arranque sin red; y los casos límite, en las cuatro capacidades ausentes a la vez, en el gancho dentro de una compilación de producción, y en las herramientas headless que tienen que seguir arrancando sin instalar nada.

### La disposición del repositorio tras estrenar la app

- **Dado** un clon limpio del repositorio, **cuando** se listan los directorios de la raíz, **entonces** `app/` es el proyecto de Expo y `prototipo/` es el prototipo web.
- **Dado** `app/`, **cuando** se leen sus ficheros, **entonces** no queda ninguno del prototipo web: ni `index.html`, ni `style.css`, ni `js/render/`, ni `js/main.js`.
- **Dado** `app/package.json`, **cuando** se leen sus dependencias, **entonces** están exactamente las que esta spec nombra en «Las dependencias que entran» y ninguna más.
- **Dado** el `package.json` de la raíz, **cuando** se lee, **entonces** declara el espacio de trabajo con `app` y `packages/*` y ninguna dependencia de runtime propia.
- **Dado** el repositorio entregado, **cuando** se listan los ficheros versionados con `git ls-files app`, **entonces** aparece el código de la app y no aparece ni `node_modules`, ni la caché de Expo, ni ningún artefacto de compilación.
- **Dado** `.gitignore`, **cuando** se leen las reglas nuevas, **entonces** todas van ancladas con barra inicial.
- **Dado** el repositorio entregado, **cuando** se busca `archive/`, **entonces** no ha cambiado ni un fichero.

### La app arranca y el núcleo va dentro

- **Dado** un simulador de iOS con la compilación de desarrollo instalada, **cuando** se abre la app, **entonces** aparece la pantalla de andamiaje y no una pantalla en blanco.
- **Dado** un emulador de Android con la compilación de desarrollo instalada, **cuando** se abre la app, **entonces** aparece la misma pantalla de andamiaje.
- **Dado** el proyecto de la app, **cuando** se lee su identificador de aplicación, **entonces** es `com.walkingadventure.app` en las dos plataformas.
- **Dado** cualquier módulo de `app/`, **cuando** se inspeccionan los imports con los que consume el generador, **entonces** todos citan el paquete por su nombre `@walkingadventure/nucleo` y ninguno lo alcanza por una ruta relativa que salga de `app/`.
- **Dado** la app abierta con la semilla de andamiaje `42.40,-8.81#1`, **cuando** se lee el título de mundo que muestra, **entonces** es idéntico al que produce el mismo paquete ejecutado en Node con esa misma semilla.
- **Dado** la app abierta dos veces seguidas, **cuando** se lee el título de mundo, **entonces** es el mismo las dos veces.
- **Dado** la app recién instalada, **cuando** se abre sin ninguna conexión de red, **entonces** arranca igual y muestra la pantalla completa.
- **Dado** el arranque de la app, **cuando** se inspecciona el tráfico saliente, **entonces** no sale ninguna petición.
- **Dado** el núcleo que falla al sortear el título, **cuando** se abre la app, **entonces** la pantalla muestra que el núcleo no respondió, con el mensaje del error, en lugar de quedarse en blanco.

### La frontera dura, ahora desde el lado de la app

- **Dado** cualquier módulo de `packages/nucleo/`, **cuando** se inspeccionan sus imports, **entonces** ninguno importa de `app/`.
- **Dado** el repositorio con la app dentro, **cuando** se ejecuta `node scripts/comprueba-nucleo.mjs`, **entonces** termina con código 0 y su veredicto dice que la frontera está intacta.
- **Dado** un clon limpio **sin ejecutar ninguna instalación de dependencias**, **cuando** se ejecuta `node test/headless.mjs`, **entonces** termina en verde.
- **Dado** un clon limpio **sin ejecutar ninguna instalación de dependencias**, **cuando** se ejecuta `node --test test/nucleo/`, **entonces** las pruebas arrancan y pasan.
- **Dado** el repositorio con la app dentro, **cuando** se ejecuta `scripts/qa-tester-run.sh SUITE`, **entonces** el report no registra ninguna comprobación de infraestructura nueva como saltada.
- **Dado** cualquier módulo de `app/`, **cuando** se busca en su código, **entonces** no aparece ninguna copia de lógica que ya viva en el paquete compartido.

### Los módulos de plataforma y su degradación

- **Dado** `app/plataforma/`, **cuando** se enumeran los módulos de capacidad, **entonces** están los cuatro: salud, háptico, notificaciones y respaldo.
- **Dado** cualquiera de los cuatro módulos, **cuando** se lee lo que expone, **entonces** declara su nombre, la capa a la que pertenece —de bolsillo, de pantalla o ninguna— y una sonda de disponibilidad.
- **Dado** el registro de capacidades, **cuando** se le pregunta por el estado, **entonces** devuelve las cuatro capacidades en un orden estable, cada una con si está montada, si está disponible y el motivo cuando no lo está.
- **Dado** una capacidad que no está disponible, **cuando** alguien se la pide al registro, **entonces** el registro devuelve que no la hay y no lanza ningún error.
- **Dado** una capacidad cuya sonda lanza un error, **cuando** se abre la app, **entonces** esa capacidad queda registrada como no disponible con el motivo, y la app arranca igual.
- **Dado** el háptico ausente, **cuando** se abre la app, **entonces** arranca, lo declara ausente y ninguna parte de la pantalla queda vacía por ello.
- **Dado** las notificaciones ausentes, **cuando** se abre la app, **entonces** arranca y lo declara ausente.
- **Dado** el respaldo ausente, **cuando** se abre la app, **entonces** arranca y lo declara ausente.
- **Dado** las cuatro capacidades ausentes a la vez, **cuando** se abre la app, **entonces** arranca, la lista las muestra las cuatro como ausentes y la pantalla sigue siendo legible.
- **Dado** un registro construido sin ningún módulo, **cuando** se abre la app, **entonces** la lista muestra que no hay ninguna capacidad montada, con esa frase, y no una lista vacía sin explicación.
- **Dado** el háptico y las notificaciones ausentes, **cuando** se le pregunta al registro qué capas quedan, **entonces** queda declarada al menos una capa de pantalla, porque ninguna capa es portadora única.
- **Dado** cualquiera de las sondas, **cuando** se ejecuta, **entonces** no pide ningún permiso al sistema ni muestra ningún diálogo.
- **Dado** la sonda de salud, **cuando** se ejecuta en esta entrega, **entonces** declara la capacidad como no montada, nombrando la fila que la monta.

### El gancho para poner una capacidad en rojo

- **Dado** una compilación de desarrollo, **cuando** se abre el enlace profundo de andamiaje pidiendo que el háptico esté ausente, **entonces** la lista pasa a mostrar el háptico como ausente.
- **Dado** el gancho usado con varias capacidades a la vez, **cuando** se abre el enlace, **entonces** todas las nombradas quedan ausentes y las demás mantienen su estado real.
- **Dado** el gancho usado con un nombre que no es ninguna de las cuatro capacidades, **cuando** se abre el enlace, **entonces** no cambia nada y la pantalla dice qué nombre no reconoció.
- **Dado** el gancho usado, **cuando** se cierra y se vuelve a abrir la app, **entonces** las capacidades vuelven a su estado real.
- **Dado** una compilación de producción, **cuando** se abre el enlace profundo de andamiaje, **entonces** no ocurre nada y ninguna capacidad cambia de estado.
- **Dado** el gancho en cualquiera de sus formas, **cuando** se ejecuta, **entonces** no escribe nada en el almacenamiento del dispositivo.

### Una sola base para iOS y Android

- **Dado** cualquier fichero de `app/` que esté fuera de `app/plataforma/`, **cuando** se busca en su código, **entonces** no aparece ninguna bifurcación por sistema operativo.
- **Dado** `app/plataforma/`, **cuando** se enumeran los ficheros con sufijo de plataforma, **entonces** cada uno tiene su pareja en la otra plataforma.
- **Dado** un par de ficheros de plataforma, **cuando** se comparan sus exportaciones, **entonces** exportan exactamente los mismos nombres.
- **Dado** el módulo de respaldo, **cuando** se lee su implementación, **entonces** hay una por plataforma y las dos responden a la misma sonda.
- **Dado** la app abierta en iOS y en Android, **cuando** se comparan las dos pantallas de andamiaje, **entonces** solo difieren en el estado de las capacidades.

### La pantalla de andamiaje

- **Dado** la app abierta, **cuando** se mira la pantalla, **entonces** muestra el título de mundo sorteado por el núcleo y la lista de las cuatro capacidades.
- **Dado** la pantalla de andamiaje, **cuando** se buscan controles, **entonces** no hay ninguno tocable.
- **Dado** la pantalla de andamiaje, **cuando** se lee su texto, **entonces** no aparece ninguna cifra de distancia, de tiempo, de ritmo, de pasos ni de porcentaje de progreso.
- **Dado** la pantalla de andamiaje, **cuando** se lee su texto, **entonces** dice que es andamiaje y que desaparece cuando llegue el arranque de verdad.
- **Dado** cada fila de capacidad, **cuando** se lee, **entonces** dice el nombre de la capacidad, su estado y, si no está disponible, el motivo.
- **Dado** `docs/flujo.md`, **cuando** se ejecuta `node scripts/verifica-flujo.mjs`, **entonces** sigue en verde, porque la pantalla de andamiaje no es ninguna de las cuarenta y no se añade al diagrama.

### El primer flujo de nivel `@app`

- **Dado** el repositorio entregado, **cuando** se lee la documentación de la app, **entonces** hay un comando único y documentado que produce una compilación de desarrollo instalable en el simulador.
- **Dado** esa compilación instalada y Maestro disponible, **cuando** se ejecuta `scripts/qa-tester-run.sh SPEC-020 --app-only`, **entonces** el flujo se ejecuta contra la app y el report recoge su resultado.
- **Dado** Maestro presente pero sin simulador arrancado, **cuando** se ejecuta el runner, **entonces** el report lo registra como infraestructura ausente y no como una prueba en rojo.
- **Dado** un flujo de Maestro, **cuando** localiza los elementos de la pantalla de andamiaje, **entonces** los encuentra por los identificadores que declara esta spec.

### Qué pasa con el prototipo web

- **Dado** `prototipo/` y `node server.mjs`, **cuando** se abre el navegador en el puerto de desarrollo, **entonces** el prototipo genera y dibuja un mundo como antes de la mudanza.
- **Dado** el servidor levantado, **cuando** se ejecuta `node test/casting-report.mjs`, **entonces** produce su informe con los mismos recuentos que antes de la mudanza.
- **Dado** `test/casting-report.mjs`, **cuando** se leen sus imports, **entonces** el transporte de Overpass lo toma de `prototipo/` y todo lo demás del paquete compartido.
- **Dado** el proxy `/api/overpass` de `server.mjs`, **cuando** se consulta, **entonces** responde igual que antes, con su caché en el mismo sitio.
- **Dado** `CLAUDE.md` y `README.md`, **cuando** se leen los párrafos de estructura y de comandos, **entonces** ya no dicen que `app/` es el prototipo web.
- **Dado** el prototipo tras la mudanza, **cuando** se buscan sus ganchos de depuración en la consola del navegador, **entonces** siguen siendo los mismos y funcionan.

## UX Design

### Wireframe textual

Una sola pantalla, a la que llamo **la pantalla de andamiaje**. **No es ninguna de las cuarenta pantallas dibujadas** y no entra en `docs/flujo.md`: es una pantalla de herramienta, existe para que el arranque de la app sea observable, y la fila 27 la sustituye por la primera pantalla del onboarding. Habla como aplicación de principio a fin, que es lo que corresponde a una herramienta, y lo dice de sí misma.

El sistema de diseño de este proyecto no nombra layouts —los nombres de layout venían del sistema web que sustituyó—, así que se describe por composición.

```
┌──────────────────────────────────────┐
│  (fondo placa #efe3c0, sin barra)    │
│                                      │
│  Walking Adventure                   │  ← sans, tinta
│  Andamiaje. Esto no es el juego:     │  ← sans, tinta al 70 %
│  desaparece cuando llegue el         │
│  arranque de verdad.                 │
│                                      │
│  ── filete #8a6d34 ────────────────  │
│                                      │
│  El núcleo, desde el móvil           │  ← sans
│  semilla 42.40,-8.81#1 · idioma gl   │  ← sans, tinta al 70 %
│                                      │
│  «O Reino de Pedra Mareira»          │  ← serif: es voz del mundo
│                                      │
│  ── filete ─────────────────────────  │
│                                      │
│  Las capacidades                     │  ← sans
│                                      │
│  Salud            no montada          │
│    la monta la fila 42                │  ← motivo, tinta al 70 %
│  Háptico          disponible          │
│  Notificaciones   montada, sin        │
│                   permiso             │
│  Respaldo         disponible          │
│                                      │
└──────────────────────────────────────┘
```

Datos concretos, sin nada inventado en tiempo de maqueta:

- **La semilla es literal**, `42.40,-8.81#1`, la misma con la que el resto del repositorio compara mundos. El idioma que se muestra es el que decide `localeFor` con esa coordenada, no un literal.
- **El título de mundo lo sortea el núcleo** en el momento de pintar. El del wireframe es un ejemplo y ningún texto de la pantalla depende de él.
- **Las cuatro filas de capacidad** llevan el nombre en castellano —salud, háptico, notificaciones, respaldo—, el estado en una de tres palabras —`disponible`, `montada` sin poder usarse, `no montada`— y, cuando no está disponible, el motivo en una línea debajo.
- **Sin barra de navegación, sin pestañas y sin ningún control tocable.** No hay nada que pulsar en esta pantalla: se lee y ya.

Estados que la pantalla tiene que saber pintar:

- **Ninguna capacidad montada**: en lugar de la lista, la frase «Ninguna capacidad montada todavía». Una lista vacía sin explicación no se distingue de una lista que no cargó.
- **El núcleo no respondió**: en lugar del título de mundo, «El núcleo no respondió» y debajo el mensaje del error, en sans. La pantalla se pinta entera igual, con su lista de capacidades.
- **Nombre no reconocido en el gancho**: una línea al pie, «No reconozco la capacidad "…"», con lo que se pidió.

### Pantallas y elementos utilizados

**Pantallas ya dibujadas que esta spec toca: ninguna.** Es deliberado y es lo que la mantiene honesta: las cuarenta pantallas de `docs/pantallas/` son del juego, y esta fila no entrega juego. La primera pantalla dibujada que se implementa es `pantalla 1 · artefacto 1` («Quién eres»), y le toca a la fila 27.

Elementos nuevos, todos provisionales y todos con fecha de caducidad en la fila 27:

```
Pantalla de andamiaje (nueva, provisional)
Lista de capacidades (nueva, provisional)
Fila de capacidad (nueva, provisional)
```

Del sistema de diseño se usan la paleta —placa como fondo, tinta como texto, filete como separador— y la separación de las dos voces: **serif para el nombre que sortea el núcleo, sans para todo lo demás**, porque el nombre es del mundo y el resto de la pantalla somos nosotros hablando de la app. **No se montan las tipografías del juego**: se usan la serif y la sans del sistema. Vestir la app es de la fila que dibuje la primera pantalla de verdad.

### data-testid

```
- `pantalla-andamiaje` — la pantalla entera, el ancla de todo flujo de Maestro
- `titulo-de-mundo` — el nombre que sortea el núcleo
- `nucleo-error` — sustituye al anterior cuando el núcleo no respondió
- `capacidades` — la lista completa
- `capacidad-salud` — la fila de salud, con su estado en el texto
- `capacidad-haptico` — la fila del háptico
- `capacidad-notificaciones` — la fila de las notificaciones
- `capacidad-respaldo` — la fila del respaldo
- `capacidades-vacio` — el mensaje que sustituye a la lista cuando no hay ninguna montada
- `gancho-no-reconocido` — la línea al pie cuando el gancho recibe un nombre que no existe
```

Dos identificadores que el sistema de diseño manda declarar siempre y que **esta spec deja reservados sin usar**, para que nadie invente después dos nombres distintos para lo mismo:

- **El estado del momento** → forma canónica `momento-<clave>`, con las claves `antes-de-salir`, `en-marcha`, `al-parar` y `telon`. La pantalla de andamiaje **no es un momento del bucle** y por eso no expone ninguno.
- **El mapa** → forma canónica `mapa`, y dentro de él lo que haya que distinguir. Lo define la fila que lo dibuje (21 y 26).

### Patrón de interacción

- **Cero controles tocables**, y no por la regla del momento «en marcha» —esta pantalla no es un momento del juego— sino porque no hay ninguna acción que ofrecer: cualquier botón aquí sería una función que la fila siguiente tiene que borrar.
- **La disponibilidad se sondea una vez, al abrir**, y no se re-sondea sola. Volver a mirar es una decisión de la fila que use cada capacidad; aquí una re-sonda periódica solo serviría para que la pantalla cambiara sola mientras alguien la lee.
- **La ausencia se declara, nunca se disimula.** Es la aplicación directa de `accesibilidad.md` §3: si una capa falta hay que verlo, porque el error caro es creer que un aviso llegó.
- **El gancho para poner una capacidad en rojo es un enlace profundo, no un control.** Decisión no cubierta por el sistema de diseño: se resuelve así porque `testing-framework.md` ya admite ganchos de prueba expuestos por la app (el del reloj del mundo), y un enlace profundo funciona igual en las dos plataformas sin añadir código nativo ni un botón que habría que esconder en producción.
- **Los textos van en sans y en registro de aplicación**, con la única excepción del nombre sorteado. Es la misma excepción que el sistema de diseño concede a los ajustes: una herramienta que finge ser mundo es peor que una herramienta.

## Notas técnicas

### El destino del prototipo web: se conserva, y se muda

Era la ambigüedad grande de esta fila, y la resuelvo así: **el prototipo se queda vivo como herramienta y se muda de `app/` a `prototipo/`**. Ni se archiva ni se retira.

Los motivos, en orden de peso:

1. **`test/casting-report.mjs` depende de él hoy**: importa `fetchGeoFeatures`, `fetchPois` y `fetchStreets` de `app/js/data/overpass.js` y consulta el proxy de `server.mjs`. Es la única verificación de tubería completa contra mundos reales que existe, y la nota §6n de `pipeline/decisiones-orquestador.md` documenta lo caro que sale que ese instrumento mienta. Retirarlo es apagar un instrumento de medida en la fila que estrena la app, que es justo cuando más falta hace.
2. **La fila 21 lo necesita enfrente.** El pendiente 4 de `arquitectura.md` pide «verificar que los cinco estilos se trasladan a Skia sin perder el pintado». Eso se verifica comparando con algo, y ese algo es el prototipo pintando el mismo mundo.
3. **`server.mjs` es además el proxy de Overpass**, y hasta la fila 24 es el único camino a los datos.

Y se muda porque `app/` es, por `03-stack-context.md`, el sitio de la app de Expo, y ese documento es el que `wa-dev` lee como fuente del stack. Dejar el prototipo ahí obligaría a renombrar la app, que es la pieza que se queda.

Reparto de la mudanza, que es mecánica y no admite reinterpretación:

| Hoy | Después |
| --- | --- |
| `app/index.html`, `app/style.css` | `prototipo/index.html`, `prototipo/style.css` |
| `app/js/main.js` | `prototipo/js/main.js` |
| `app/js/render/{map,styles}.js` | `prototipo/js/render/{map,styles}.js` |
| `app/js/data/overpass.js` | `prototipo/js/data/overpass.js` |
| `app/` (vacío tras la mudanza) | el proyecto de Expo |

Lo que hay que reapuntar, y nada más: la raíz de estáticos de `server.mjs`, el import de `test/casting-report.mjs`, y los párrafos de estructura y de comandos de `CLAUDE.md` y `README.md`. `test/headless.mjs` no toca el prototipo y no se toca. `archive/` no se toca.

**No se aprovecha la mudanza para nada más.** Ni se limpia, ni se refactoriza, ni se le quita el `__wa` de depuración: mover y reapuntar. Un porte que además arregla cosas es un porte que no se puede verificar comparando.

### Reparto de rutas: quién escribe qué

| Ruta | Quién la escribe, en esta spec |
| --- | --- |
| `app/**` | `wa-dev` |
| `prototipo/**` | `wa-dev`, solo la mudanza |
| `package.json` de la raíz, `.gitignore` | `wa-dev` |
| `server.mjs` | `wa-dev`, solo la raíz de estáticos |
| `test/casting-report.mjs` | `wa-dev`, **solo** para reapuntar el import del transporte |
| `CLAUDE.md`, `README.md` | `wa-dev`, **solo** los párrafos de estructura y de comandos que la mudanza deja falsos |
| `test/app/**`, `test/nucleo/**`, `test/spec-test-map.json` | solo `wa-qa-dev`, siempre |
| `docs/testing.md`, `docs/flujo.md` | nadie, en esta spec — ver «El escenario que falta» |

### El contrato de una capacidad

Lo que cada módulo de `app/plataforma/` expone, y lo que el registro hace con ello. Es contrato de comportamiento, no de implementación:

- **`nombre`** — `salud`, `haptico`, `notificaciones` o `respaldo`.
- **`capa`** — `bolsillo`, `pantalla` o `ninguna`. Sale directo de `accesibilidad.md` §3: el háptico es de bolsillo, la notificación es de pantalla, y salud y respaldo no son capas de aviso.
- **`sonda()`** — responde `{ montado, disponible, motivo }`. `montado` es «la implementación existe en esta compilación»; `disponible` es «además se puede usar ahora». La distinción no es cosmética: un módulo montado sin permiso concedido y un módulo que nadie montó son problemas distintos y se arreglan en sitios distintos.
- **La sonda nunca pide un permiso.** Pedirlo es una decisión de producto que ya tiene su sitio dibujado (el permiso de ubicación se adelanta al levantar el mapa, `pantalla 3 · artefacto 1`), y una app que en su primer arranque dispara cuatro diálogos del sistema es exactamente lo que el onboarding se diseñó para no ser.

El registro se construye **con los módulos inyectados**, igual que el núcleo recibe su `fetchData`. Es lo que permite montar un registro con un módulo doblado sin tocar el código de la app, y es lo que hace que «la app funciona aunque falte» se pueda poner rojo en lugar de afirmarse.

Estado esperado de las cuatro capacidades al cerrar esta fila:

| Capacidad | Capa | Estado | Por qué |
| --- | --- | --- | --- |
| Salud | ninguna | no montada | la monta la fila 42 |
| Háptico | bolsillo | montada; disponible según dispositivo | la usa la fila 29 |
| Notificaciones | pantalla | montada; disponible según permiso ya concedido | las usa la fila 29 |
| Respaldo | ninguna | montada, con una implementación por plataforma | lo usa la fila 39 |

El respaldo es el que lleva la partición por plataforma, y no por capricho: en iOS entrar en la copia del sistema es cuestión de en qué directorio vive el fichero, y en Android de qué declara el manifiesto. Es la diferencia real que hace que la comprobación de RNF-COM-001 signifique algo en lugar de cumplirse sobre un directorio vacío. La fila 30 heredará este mismo mecanismo para el rótulo del sistema y la Actividad en Vivo.

### Las dependencias que entran

Lista cerrada. `03-stack-context.md` dice que no se añade ninguna librería que la spec no nombre, así que aquí están todas y no hay ninguna más:

- **`expo`**, **`react`** y **`react-native`**, en la versión estable vigente del SDK, resueltas por la herramienta de Expo para que las versiones cuadren entre sí.
- **`expo-haptics`** y **`expo-notifications`**, que son las dos capacidades cuya sonda puede responder de verdad hoy y las dos que sostienen el par de capas de los avisos.
- **`expo-linking`** si el enlace profundo lo necesita; si el propio SDK ya lo resuelve, no entra.

Lo que **no** entra, con su fila: navegación (27), tipografías propias (27), Skia (21), cliente HTTP (26), almacenamiento de partida (39), salud (42), servicio en primer plano (30).

`packages/nucleo/` **sigue con cero dependencias de runtime**, y eso no se relaja por tener empaquetador delante.

### Cómo la app alcanza el paquete

SPEC-002 dejó esto anotado como pendiente de esta fila: «el `package.json` deja el paquete resoluble por nombre cuando llegue el empaquetador de Expo». Se cierra montando el espacio de trabajo en la raíz, con `app` y `packages/*` dentro, de modo que la app importe `@walkingadventure/nucleo/...` por su nombre.

Dos trampas que conviene tener delante y que son la causa habitual de que esto se atasque:

- **El empaquetador no vigila por defecto lo que está fuera del proyecto.** Un paquete que vive en `packages/` fuera de `app/` hay que declararlo como carpeta vigilada, o los cambios en el núcleo no se recargan y parece que el paquete está congelado.
- **El mapa de exportaciones de `packages/nucleo/package.json` usa subrutas** (`./core/*`, `./world/*`…). Si el empaquetador no tiene habilitada la resolución por exportaciones, esos imports fallan con un error que parece de fichero inexistente y no lo es.

Y lo que no puede pasar por montar un espacio de trabajo: **las herramientas headless tienen que seguir arrancando en un clon limpio sin instalar nada**. Hay dos criterios de aceptación dedicados a eso porque es el riesgo real de esta fila: el día que `node test/headless.mjs` necesite un `node_modules`, la red de seguridad del determinismo pasa a depender de una instalación.

### El escenario que falta en `docs/testing.md`

**RF-INFRA-006 está marcado ⚠ sin escenario en el PRD**, y es de los quince huecos de la batería. Esta spec **no toca `docs/testing.md`**: deja el escenario propuesto aquí para que quien orquesta decida si lo añade, y quién.

```gherkin
# language: es

@app @accesibilidad
Característica: La app funciona con módulos de plataforma ausentes
  Salud, háptico, notificaciones y respaldo son módulos, y ninguna capa es
  portadora única: la app tiene que seguir existiendo sin ellos, y decirlo.
  Fuente: arquitectura.md · accesibilidad.md §3 · RF-INFRA-006

  Escenario: Sin háptico la app arranca igual
    Dado un dispositivo donde el háptico no está disponible
    Cuando se abre la app
    Entonces arranca
    Y declara el háptico como ausente

  Escenario: Sin notificaciones la app arranca igual
    Dado un dispositivo donde las notificaciones no están disponibles
    Cuando se abre la app
    Entonces arranca
    Y declara las notificaciones como ausentes

  Escenario: Sin respaldo la app arranca igual
    Dado un dispositivo donde el respaldo del sistema no está disponible
    Cuando se abre la app
    Entonces arranca
    Y declara el respaldo como ausente

  Escenario: Con las tres ausentes a la vez la app sigue en pie
    Dado un dispositivo sin háptico, sin notificaciones y sin respaldo
    Cuando se abre la app
    Entonces arranca
    Y ninguna pantalla queda vacía por ello

  Escenario: Sin capas de bolsillo queda una capa de pantalla
    Dado un dispositivo sin háptico
    Cuando se pregunta por las capas disponibles para avisar
    Entonces queda declarada al menos una capa de pantalla

  Escenario: Una capacidad que falla al sondearse no tumba la app
    Dado un módulo de plataforma cuya sonda falla
    Cuando se abre la app
    Entonces la capacidad queda declarada como no disponible con su motivo
    Y la app arranca
```

Los tres últimos son los que de verdad importan y los que un escenario escrito de memoria se dejaría: el par de capas, la caída silenciosa de una sonda y las tres ausencias a la vez.

### Frontera de inyección

Esta spec **no cambia ninguna frontera del núcleo**. `buildWorld` sigue recibiendo `fetchData` y `onStatus` exactamente como hoy, y la app ni siquiera lo llama todavía: lo único que consume del paquete es el sorteo del título de mundo, que es una función pura sobre una semilla.

La frontera que sí se estrena es la de la app hacia la plataforma, y se traza igual: **el registro de capacidades recibe sus módulos inyectados**. Es la misma decisión que hace testeable el núcleo, aplicada un piso más arriba.

### Escenarios de la batería a los que sirve esta fila

Ninguno se implementa aquí —son de `wa-qa-dev`—, pero la app queda dimensionada para que se puedan escribir sin añadirle nada:

- **El nivel `@app` entero**, que hasta hoy no tenía dónde ejecutarse: `test/app/` existe vacío desde SPEC-001 y ninguna prueba había tocado un dispositivo. El flujo de esta fila es el primero.
- **«No se usa ninguna fuente de azar ni de tiempo del sistema»**, en su mitad de dispositivo: el mismo título con la misma semilla, dentro del móvil.
- **La degradación por módulo ausente**, con el bloque propuesto arriba.

### Huecos conocidos

1. **RF-INFRA-006 sigue sin escenario en `docs/testing.md`.** Propuesto aquí, no escrito allí. Lo decide quien orquesta.
2. **El nivel `@app` no se puede ejecutar en la máquina de este pipeline.** Maestro 2.8.0 está instalado, pero `maestro --version` falla pidiendo un entorno de Java, y no hay Xcode completo —solo las Command Line Tools, sin `simctl` ni simulador— ni herramientas de Android. O sea: no hay ni iOS ni Android donde instalar la app. Por la decisión 4 de `pipeline/decisiones-orquestador.md` el bucle no se para y el flujo se escribe igual, pero **esta fila se cierra declarando que su verificación de `@app` quedó pendiente**, y con ella la comprobación de que la app arranca de verdad. Es el hueco más grande de esta spec y no lo disimulo: casi todos los criterios de «La app arranca» y «Una sola base» sólo se pueden afirmar sobre un dispositivo.
3. **La app no consume datos reales.** No hay capa de datos ni Overpass desde el móvil hasta la fila 26; el título se sortea sobre una semilla literal.
4. **La app no está vestida.** Sin tipografías propias, sin navegación y sin ninguna de las cuarenta pantallas. La fila 27 es la que convierte esto en algo que se pueda enseñar.
5. **La sonda de notificaciones dirá casi siempre «sin permiso»** en un dispositivo recién instalado, porque no lo pide. Es correcto y es lo que se quiere, pero conviene saberlo antes de leerlo como un fallo.

## Decisiones asumidas

- **El prototipo web se conserva y se muda a `prototipo/`** → asumido (alternativas: congelarlo en `archive/v0.0.3/`, o retirarlo). Regla: `test/casting-report.mjs` depende de su transporte de Overpass y es la única verificación de tubería completa contra mundos reales; `arquitectura.md` pendiente 4 exige comparar el pintado de Skia contra algo; y §6n de `pipeline/decisiones-orquestador.md` documenta lo caro que sale desatender un instrumento de medida.
- **La app va en `app/` y no en un directorio nuevo** → asumido, con el prototipo mudándose (alternativa: `movil/` para la app, dejando el prototipo donde está). Regla: `03-stack-context.md` fija `app/` como el sitio de la app de Expo y es el documento que `wa-dev` lee como fuente del stack.
- **La mudanza no aprovecha para limpiar nada** → asumido (alternativa: recortar el prototipo a lo que casting-report necesita). Regla: un porte que además arregla cosas no se puede verificar comparando; hay criterios de aceptación que exigen que el prototipo dibuje igual que antes.
- **Espacio de trabajo en la raíz y el paquete resuelto por su nombre** → asumido (alternativa: imports por ruta relativa desde `app/` con la carpeta declarada como vigilada). Regla: SPEC-002 dejó anotado que el `package.json` del paquete existe para ser resoluble por nombre cuando llegara el empaquetador, y esta es esa fila.
- **`packages/nucleo/` y las herramientas headless siguen arrancando sin instalar nada** → asumido como criterio duro (alternativa: aceptar que tras montar el espacio de trabajo haga falta una instalación). Regla: `03-stack-context.md`, cero dependencias en el núcleo; el día que la red de seguridad del determinismo dependa de un `node_modules`, deja de ser una red.
- **Sin navegación en esta fila** → asumido: una sola pantalla montada desde el punto de entrada (alternativa: montar ya el enrutador para no reestructurar después). Regla: CLAUDE.md, no se introduce toolchain que nadie ha pedido; un enrutador con una pantalla es una librería para nada, y la fila 27 es la que tendrá dos pantallas que encadenar y por tanto el criterio para elegirlo.
- **Sin tipografías propias** → asumido: serif y sans del sistema (alternativa: montar ya las del juego). Regla: vestir la app es de la fila que dibuje la primera pantalla real; aquí solo se respeta la separación de las dos voces, que es lo que el sistema de diseño exige.
- **La pantalla de andamiaje no es ninguna de las cuarenta y no entra en `docs/flujo.md`** → asumido (alternativa: implementar ya `pantalla 1 · artefacto 1`). Regla: el sistema de diseño dice que una spec que rediseña una pantalla dibujada se está inventando una decisión, y esa pantalla es de la fila 27; además `scripts/verifica-flujo.mjs` falla si el diagrama inventa una pantalla que ningún artefacto dibuja.
- **La pantalla enseña un título de mundo sorteado por el núcleo** → asumido como la prueba de vida (alternativas: un «hola» estático, o generar un mundo entero). Regla: es lo único que demuestra RF-INFRA-001 dentro del móvil —el mismo paquete, la misma semilla, el mismo resultado que en Node— sin necesitar datos de OSM, que no llegan hasta la fila 26.
- **Se instalan `expo-haptics` y `expo-notificaciones`, no las cuatro capacidades** → asumido (alternativa: las cuatro con sonda real, o ninguna y las cuatro declaradas ausentes). Regla: son las dos cuya sonda puede responder algo verdadero hoy y las que sostienen el par de capas de `accesibilidad.md` §3; con las cuatro ausentes, «la app funciona aunque falten» sería cierto de forma vacía, que es justo lo que §6o de `decisiones-orquestador.md` señala como criterio que no mide nada.
- **La salud queda declarada no montada** → asumido, nombrando la fila 42 como su dueña (alternativa: montar ya el módulo nativo de salud). Regla: RF-INFRA-006 garantiza la degradación de háptico, notificaciones y respaldo, no la de salud; declararla ausente con dueño es honesto y no promete nada. Si el diseño quisiera que la app no arrancase sin salud, esa decisión no está escrita en ningún sitio y tendría que escribirse antes.
- **El respaldo es el módulo que lleva la partición por plataforma** → asumido (alternativa: un contrato del rótulo del sistema partido por plataforma, o ninguna partición hasta la fila 30). Regla: RNF-COM-001 exige el mismo contrato con implementación por plataforma, y entrar en la copia del sistema es una diferencia real entre iOS y Android; un fichero de plataforma vacío haría vacía también la comprobación.
- **El gancho para forzar una ausencia es un enlace profundo** → asumido (alternativas: argumentos de lanzamiento, una variable de entorno de compilación, un panel de depuración). Regla: `testing-framework.md` ya admite ganchos de prueba expuestos por la app; el enlace profundo funciona igual en las dos plataformas sin código nativo, y Maestro lo abre directamente.
- **El gancho es inerte en una compilación de producción y no persiste nada** → asumido (alternativa: dejarlo activo siempre por comodidad). Regla: un gancho que sobrevive al reinicio o llega a producción es una puerta trasera que cambia el comportamiento de la app.
- **Las sondas no piden permisos** → asumido (alternativa: pedirlos al arrancar para que el estado sea definitivo). Regla: el onboarding tiene decidido cuándo se piden los permisos y por qué se adelanta el de ubicación; cuatro diálogos del sistema en el primer arranque contradicen ese diseño.
- **La disponibilidad se sondea una sola vez, al abrir** → asumido (alternativa: re-sondear al volver del segundo plano). Regla: la re-sonda pertenece a la fila que use cada capacidad; aquí solo serviría para que la pantalla cambiara sola mientras alguien la lee.
- **`CLAUDE.md` y `README.md` los toca `wa-dev`, solo en los párrafos que la mudanza deja falsos** → asumido (alternativa: dejarlos desfasados y que los arregle quien orquesta). Regla: `CLAUDE.md` documenta la estructura del repositorio y es lo primero que lee el siguiente agente; una guía que miente sobre dónde está el prototipo cuesta más que una línea de diff.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: CLAUDE.md, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep.
- **Sin sección de comportamiento responsive** → asumido por decisión 3 de `pipeline/decisiones-orquestador.md`: es una app de móvil y la pantalla es la que es.
