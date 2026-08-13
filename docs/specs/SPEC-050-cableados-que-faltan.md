# SPEC-050 — Los cableados que faltan: el prólogo que se tira, A2P0 inalcanzable y A4P8 tapado

## Descripción

Cose tres piezas que están escritas, probadas y sin llamador, y que por eso no existen para quien juega. La primera: el resultado del prólogo del mundo se compone entero y se tira, así que en un teléfono no salta ningún micro-encuentro y nadie ha oído nunca un rumor. La segunda: la pantalla que ofrece levantar un mapa donde no llega ninguno de los tuyos existe, está probada y no se puede alcanzar. La tercera: la capa que marca un sitio que no pega se pinta debajo de la ficha en lugar de encima, y por eso su único botón no se puede pulsar con el dedo.

No hay pantalla nueva ni mecanismo nuevo salvo el que las tres decisiones del dueño obligan a añadir, que está declarado. Lo que hay es **cableado**: la forma de `pipeline/decisiones-orquestador.md` §6h en su variante de pieza sin llamador, que va por la decimocuarta aparición.

Anclas: **RF-QUEST-010** y **RF-QUEST-016** (fila 19), **RF-MUNDO-004** (fila 41) y **RF-PRIV-004** (fila 35). Las tres filas siguen en `done` y no se reabren: entregaron el mecanismo, y lo que faltaba era esto. Las fuentes que mandan sobre el PRD son `game-design/alcance-del-mundo.md` §2 y §3, `game-design/quests.md` decisión 3, `game-design/arranque.md` §2, `game-design/seguridad-privacidad.md` §3, `game-design/lenguaje.md` y el diagrama de `docs/flujo.md`.

Consume, sin rediseñarlo: **SPEC-013** (`partida/prologo.js`), **SPEC-019** (`partida/entregas.js`), **SPEC-012** (`partida/rumores.js` y lo que se cuenta en los núcleos), **SPEC-041** (`partida/mapas.js` y `app/pantallas/ofrecimiento.jsx`), **SPEC-035** (`partida/descartes.js` y `app/pantallas/descarte.jsx`), **SPEC-047** (la partida en disco y sus cortes) y **SPEC-023** (el proxy ciego, por cuya ruta viaja la consulta del topónimo).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `wa-qa-dev` y los ejecuta `wa-qa-tester` contra el código ya commiteado, en un paso posterior del bucle de QA de este repo. Cualquier test que el implementador entregue será descartado o reemplazado. *(Corregido el 13-ago-2026: la cláusula original nombraba las skills `somo-*`, que aquí no existen — venía de la plantilla, ya corregida en origen.)*
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**, por dos sitios: el **traedor de topónimos** que compone A2P0 y el **levantamiento** que la app ya monta en el arranque y que ahora hace falta también con la partida abierta. Los dos entran por `app/nucleo/piezas.js` y por inyección, como las diez filas anteriores (§6u).
- **Ninguna dependencia nueva.** La consulta del topónimo viaja por `pideGeneracion` de `app/datos/cliente-proxy.js`, que es la ruta ciega que el levantamiento ya usa. Si al implementar apareciera una dependencia, **no se mete**: se para y se dice, con el nombre de la dependencia y de la pieza que la pedía.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el **zurrón y la fuente de salud** (fila 46); **`escena.cara`**, que es siempre nula porque ninguna plantilla pone un beat sobre rol humano —0 de 506, viene de SPEC-017 y tiene fila corta propia—; la **caída del servicio en primer plano** a mitad de salida, fichada en §12b sin dueño; el **motor de pasos de la partida** (`creaMotorDeLaPartida`), que sigue sin llamador en `app/` y cuya ausencia se ficha en «Fronteras y huecos, con dueño» en vez de resolverse de paso; y la **versión de formato global a las ocho clases de documento**, fichada en §11e.

## Criterios de aceptación

Van en `Dado / cuando / entonces`, el mismo Gherkin español de `docs/testing.md`, y los que reproducen un escenario ya escrito llevan su nombre literal. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El prólogo se guarda», «A2P0 se alcanza» y «A4P8 se puede marcar»; la **validación de entradas** en la siembra con entradas mal formadas, el ofrecimiento sin sitio y el mapa que ya tiene prólogo; el **estado vacío** en la celda sin contenido jugable y en el mapa cuyo prólogo no compuso par; el **estado de error** en «Nada degrada por falta de cableado» y en el topónimo que no llega; y los **casos límite** en la app cerrada entre levantar el mapa y guardarlo, el segundo mapa de la partida y el rechazo del ofrecimiento que no se recuerda.

Los criterios de **`@determinismo` y `@privacidad` son bloqueantes**: nada se entrega con uno en rojo.

Casi todo se afirma en `@nucleo`. Lo que necesita dispositivo está marcado y es poco: que las entradas del prólogo estén en el estado tras un arranque real, que A2P0 se vea, y que el centro de «Marcarlo» pulse a 1080×2400.

### El prólogo se guarda entero, y no solo su cola

- **Dado** un arranque que termina levantando su primer mapa, **cuando** la partida nace, **entonces** las entradas que dejó el prólogo están encoladas en `estado.entregas` bajo el identificador de ese mapa.
- **Dado** ese mismo arranque, **cuando** la partida nace, **entonces** los rumores que el prólogo sedimentó están en `estado.rumores` bajo ese mapa, y no en un objeto que se tira.
- **Dado** ese mismo arranque, **cuando** la partida nace, **entonces** lo que el prólogo dejó dicho en cada núcleo está en `estado.nucleos` bajo ese mapa.
- **Dado** ese mismo arranque, **cuando** el prólogo compuso par, **entonces** `estado.arranque.par` lo lleva; **y cuando** no lo compuso, lleva `null` y la partida nace igual.
- **Dado** una partida recién nacida con su prólogo asentado, **cuando** se congela y se vuelve a abrir, **entonces** las cuatro áreas vuelven con lo mismo dentro.
- **Dado** una celda marcada sin contenido jugable, **cuando** corre su prólogo, **entonces** no se siembra ninguna entrada, no se sedimenta ningún rumor y la partida nace sin avería.
- **Dado** una partida abierta de disco cuyo mapa ya tiene prólogo, **cuando** se abre la app otra vez, **entonces** el prólogo **no se vuelve a correr** y el estado no cambia.
- **Dado** la siembra de la cola, **cuando** recibe algo que no es una lista de entradas, **entonces** falla nombrando lo que llegó y la partida no nace a medias.
- **Dado** dos ejecuciones del arranque con la misma semilla y los mismos datos de OSM, **cuando** las dos siembran, **entonces** las entradas encoladas son las mismas y en el mismo orden. `@determinismo`
- **Dado** un recorrido real en un dispositivo tras un arranque, **cuando** se lee `partida/estado.json` con `run-as`, **entonces** las entradas del prólogo están encoladas. `@app`

### El segundo mapa también tiene pasado

- **Dado** una partida con un mapa y un jugador lejos de él, **cuando** levanta un mapa nuevo desde A2P0, **entonces** ese mapa corre su prólogo con `primerMapa: false` y su cola queda sembrada bajo su propio identificador.
- **Dado** ese mapa nuevo, **cuando** corre su prólogo, **entonces** no se compone ningún par y `estado.arranque.par` **no se toca**: la puesta en escena es del arranque y solo del arranque.
- **Dado** la cola de un mapa y la de otro, **cuando** se consultan, **entonces** cada una devuelve lo suyo y ninguna entrada cruza de mapa.

### Un micro-encuentro puede saltar

- **Dado** una partida con la cola sembrada y una salida echada a andar, **cuando** se llega a un sitio que no es de la cadena de la aventura, **entonces** la capa de llegadas tiene entradas pendientes con las que componer un micro-encuentro.
- **Dado** una llegada a un núcleo, **cuando** se compone lo que se cuenta allí, **entonces** sale lo que el prólogo sedimentó y no una lista vacía.
- **Dado** una salida sin aventura aceptada, **cuando** se recorre con la cola sembrada, **entonces** puede producirse un paso de beat de la cola de entregas, distinguible del de una cadena por su procedencia.

### A2P0 se alcanza — el ofrecimiento de levantar un mapa

- **Dado** una partida abierta y una posición que no cae dentro ni en el alcance de ninguno de sus mapas, **cuando** se abre la app, **entonces** se ve el ofrecimiento y **no** la portada.
- **Dado** esa misma posición, **cuando** se resuelve el mapa activo, **entonces** el ofrecimiento se compone con el sitio donde estás dicho como lugar, traído por la ruta ciega del proxy.
- **Dado** el ofrecimiento en pantalla, **cuando** se toca «Levantar un mapa aquí», **entonces** se levanta un mapa en esa coordenada y al terminar se ve su portada.
- **Dado** el ofrecimiento en pantalla, **cuando** se toca «Dejarlo estar», **entonces** la capa se cierra sin levantar nada y **sin dejar ninguna marca**.
- **Dado** un jugador que rechazó el ofrecimiento, **cuando** vuelve a abrir la app en el mismo sitio, **entonces** se le vuelve a ofrecer. Escenario: «Un jugador que rechaza el ofrecimiento vuelve a verlo».
- **Dado** el ofrecimiento en pantalla, **cuando** se mira lo que ofrece, **entonces** están las tres puertas de consulta y **no** está salir a andar.
- **Dado** una posición dentro del alcance de un mapa de la partida, **cuando** se abre la app, **entonces** se ve la portada de ese mapa **sin transición, aviso ni mensaje de bienvenida**.
- **Dado** el topónimo que no se pudo traer por la ruta ciega, **cuando** se compone el ofrecimiento, **entonces** se compone igual con el respaldo en voz de mundo y A2P0 se ve entera, con sus tres puertas.
- **Dado** el camino con red, **cuando** se compone el ofrecimiento sin sitio o con cadena vacía, **entonces** falla nombrándolo: el contrato no se ablanda por el camino bueno.
- **Dado** el respaldo del ofrecimiento, **cuando** se lee su texto, **entonces** no nombra la red, ni la cobertura, ni ninguna distancia, ni ningún mapa guardado, y habla en voz de mundo.
- **Dado** la consulta del topónimo, **cuando** se mira qué sale del móvil, **entonces** viaja por la misma ruta ciega y con la misma ficha anónima que el levantamiento, y no se añade ningún identificador. `@privacidad`
- **Dado** una respuesta de OSM con varios lugares con nombre, **cuando** se elige el topónimo, **entonces** el elegido es el mismo en dos ejecuciones con la misma respuesta, por orden declarado y con desempate escrito. `@determinismo`
- **Dado** el ofrecimiento montado en un dispositivo, **cuando** se abre la app lejos de todos los mapas, **entonces** se ve A2P0. `@app`

### A4P8 se puede marcar

- **Dado** la capa del descarte puesta sobre la ficha, **cuando** se mira cómo se compone, **entonces** cubre la pantalla como capa y la ficha sigue montada debajo.
- **Dado** la capa del descarte con sus cinco motivos a 1080×2400, **cuando** se leen las cotas de sus nodos, **entonces** ninguna es degenerada y el botón «Marcarlo» queda entero dentro de la pantalla. `@app`
- **Dado** la capa del descarte, **cuando** se toca el **centro** de «Marcarlo», **entonces** el sitio queda marcado. Escenario: «El jugador puede marcar un anclaje que no vale». `@app`
- **Dado** la capa del descarte con más motivos de los que caben, **cuando** se recorre, **entonces** los motivos se desplazan y la acción no se va de la pantalla.
- **Dado** la capa del descarte con un motivo elegido, **cuando** se cierra sin pulsar «Marcarlo», **entonces** no se marca nada.
- **Dado** la capa del descarte, **cuando** se cierra, **entonces** se vuelve a la ficha con todo como estaba.

### Nada degrada por falta de cableado

- **Dado** un levantamiento que no se puede montar con la partida abierta, **cuando** haría falta para el ofrecimiento, **entonces** se enseña la avería con su motivo literal y **no** una portada de un mapa donde no estás.
- **Dado** la resolución del mapa activo que no se puede hacer porque no hay posición, **cuando** se abre la app, **entonces** se dice con su motivo y no se supone que hay mapa activo.
- **Dado** una partida cuyo prólogo no se pudo asentar, **cuando** nace, **entonces** se da la cara con el motivo y no se juega una partida sin pasado que se parece a una que lo tiene.

### Determinismo, frontera del núcleo y privacidad

- **Dado** `packages/nucleo/`, **cuando** se busca en lo que esta fila toca, **entonces** no hay `Math.random()`, ni `Date.now()`, ni `new Date()`. `@determinismo`
- **Dado** `packages/nucleo/`, **cuando** se miran sus importaciones, **entonces** no importa React Native ni Expo.
- **Dado** un clon limpio sin `node_modules`, **cuando** se enumera la batería de núcleo, **entonces** arranca y descubre todos sus casos.
- **Dado** los documentos que esta fila escribe, **cuando** se revisan, **entonces** no llevan ninguna coordenada ni ningún rastro de ubicación. `@privacidad`

### Las guardas de recuento que esta fila mueve

- **Dado** `test/nucleo/piezas-sin-consumidor.test.mjs`, **cuando** corre tras esta fila, **entonces** `BLOQUES_SIN_CONSUMIDOR` está **vacía** y la guarda sigue en verde.
- **Dado** `test/nucleo/limite-declarado.test.mjs`, **cuando** corre tras esta fila, **entonces** el motivo de `escena.yaml` ya **no** dice que sin llamador de `siembraLaCola` no puede saltar ningún micro-encuentro, porque esa puerta se ha cerrado.
- **Dado** `test/nucleo/pantallas-huerfanas.test.mjs`, **cuando** corre tras esta fila, **entonces** sigue en **1** y no sube: A2P0 deja de ser huérfana por cableado, no por lista.
- **Dado** `scripts/verifica-flujo.mjs`, **cuando** corre tras esta fila, **entonces** está en verde con **41** pantallas y ninguna suelta.

## UX Design

### Wireframe textual

**Una pantalla se documenta y ninguna se inventa.** A2P0 ya está escrita campo a campo en `packages/nucleo/partida/mapas.js` (`GUION`, `ACCIONES`, `PUERTAS`, `componeOfrecimiento`) y pintada en `app/pantallas/ofrecimiento.jsx`. Lo que esta fila añade es su **bloque en el artefacto 2** y su **nodo en `docs/flujo.md`**, porque el código tiene una pantalla que el diseño no declaraba y ése es el único agujero que `verifica-flujo.mjs` no puede cazar por construcción (§6y). El bloque documenta la decisión ya cerrada; no la toma.

**A2P0 — El ofrecimiento.** **Layout 1 — Estándar**, superficie a sangre sobre el papel `#efe3c0`, sin barra de pestañas, sin cabecera y sin flecha de atrás. **Sustituye a la portada; no se superpone a ella.** De arriba abajo:

```
  ‹sitio›                     SANS VERSALITAS, arriba — el sitio donde estás dicho como
                              lugar. Con red, el topónimo traído por la ruta ciega; sin
                              red, el respaldo en voz de mundo del guion
  ‹titular›                   serif grande, una línea — «Hasta aquí no llega ninguno de
                              tus mapas»
  ‹cuerpo›                    serif normal, párrafo corto — «Si esto va a ser sitio tuyo,
                              se puede levantar uno.»
  ‹aviso›                     serif normal, solo cuando el sitio no se dejó dibujar;
                              ausente con red

                              ↓ empujadas abajo

  [ Levantar un mapa aquí ]   acción principal, ancho completo con caja
    Dejarlo estar             acción secundaria, TEXTO SIN CAJA, debajo

  ‹diario›  ‹repisa›  ‹ajustes›   las tres puertas de siempre, con sus cuentas
```

**Y las ausencias, que son la mitad de lo que la pantalla entrega**, todas decididas en `alcance-del-mundo.md` §3 y en SPEC-041: **no** hay mapa de fondo —una portada lleva un mapa dentro y aquí no hay ninguno—; **no** hay «salir a andar», porque no se juega donde no estás; **no** hay distancia a ningún mapa ni «volver a casa», porque enseñar a cuánto está casa invita a jugar allí desde aquí; **no** hay lista de mapas ni selector, porque el mapa activo lo decide dónde estás; y **no** hay marca de haber rechazado: volver a abrir la app aquí lo vuelve a ofrecer. Y al volver a un sitio conocido la portada aparece **sin transición, aviso ni mensaje de bienvenida**, porque anunciarlo lo convertiría en un cambio de contexto de aplicación.

**A4P8 — La capa del descarte, corregida.** No cambia ni un texto ni un elemento: cambia **dónde se pinta**. Hoy es un hermano en el flujo de `llegada.js`, con `flex: 1` compitiendo por el alto con la ficha; tiene que ser lo que su propio comentario dice que es —capa por encima de la ficha— y comportarse como la otra capa del mismo fichero, el visor. Con eso, el `ScrollView` de los motivos queda acotado por la pantalla y «Marcarlo», que va fuera del `ScrollView`, se queda abajo y entero.

```
  ‹capa.nombre›            serif, el nombre del sitio
  ‹capa.pregunta›          serif grande
  ‹capa.sinObligacion›     serif normal — va ANTES de los motivos, no después

  ┌ desplazable ──────────────────────────────┐
  │ [ ‹motivo 1› ] … [ ‹motivo 5› ]           │  uno como mucho; volver a tocarlo
  │ ‹capa.reversibilidad›                     │  lo desmarca. NINGUNO lleva texto libre
  └───────────────────────────────────────────┘

  [ ‹capa.confirmar› ]     abajo, FUERA del desplazable — el segundo y último toque
```

**Ninguna otra pantalla se dibuja de nuevo.** El cableado del prólogo no tiene superficie: se ve porque saltan micro-encuentros y porque en un núcleo se cuenta algo.

### Pantallas y elementos utilizados

```
Pantalla que esta fila hace alcanzable, y que el diseño pasa a declarar:
  A2P0   pantalla 0 · artefacto 2 — El ofrecimiento   (composición: partida/mapas.js;
                                                       pintada: app/pantallas/ofrecimiento.jsx)

Pantalla que esta fila arregla, sin redibujarla:
  A4P8   pantalla 8 · artefacto 4 — El sitio que no pega  (pintada: app/pantallas/descarte.jsx)

Pantallas que esta fila toca solo como camino, sin cambiarlas:
  A2P1   la portada, que A2P0 sustituye cuando no hay mapa activo
  A1P5   el levantamiento del mapa, al que lleva «Levantar un mapa aquí»
  A4P7   la ficha, sobre la que se pone la capa del descarte
  A6P2, A6P5, A6P6   las tres puertas de consulta que A2P0 conserva

Elementos nuevos: ninguno. A2P0 usa los del artefacto 2 y A4P8 los que ya tiene.
```

### data-testid

Todos existen ya en el núcleo o en las pantallas; esta fila **no añade ninguno** y su papel es que dejen de ser inalcanzables.

```
- `ofrecer-levantar-mapa`  — la raíz de A2P0 (TESTIDS.ofrecimiento)
- `mapa-activo`            — la marca del mapa activo, `sin-mapa-activo` en A2P0
- `momento`                — la marca del momento, `antes-de-salir` en A2P0
- `levantar-mapa-aqui`     — la acción principal
- `dejarlo-estar`          — la acción secundaria
- `ofrecimiento-sitio`     — el sitio, que es lo que el respaldo cambia sin red
- `descarte-anclaje`       — la raíz de la capa de A4P8
- `descarte-motivo`        — cada motivo, con su `accessibilityLabel`
- `descarte-confirmar`     — «Marcarlo», cuyo CENTRO tiene que pulsar
```

Sin `data-testid` adicionales: el prólogo no tiene superficie propia, y lo que entrega se afirma sobre el estado leído del disco, no sobre la pantalla.

### Patrón de interacción

- **A2P0 sustituye y no se superpone.** Regla de `alcance-del-mundo.md` §3: la portada lleva un mapa dentro, y superponer un diálogo sobre el mapa de casa enseñaría un sitio en el que no se puede jugar. No es un `Dialog` ni una capa: es el momento entero.
- **El descarte sí es capa, y por eso se posiciona como capa.** Regla del propio fichero y precedente del visor en `llegada.js`: cerrar la capa devuelve la ficha con todo como estaba, y eso solo es cierto si la ficha sigue montada debajo. Un hermano en el flujo no es una capa aunque el comentario lo llame así.
- **Dos toques en A4P8 y ninguno más**, y el segundo es el que escribe. Sin diálogo de confirmación —serían tres toques, y `seguridad-privacidad.md` §3 pide que cueste menos que ignorarlo— y sin línea de gracias: que la acción ya no esté es toda la confirmación.
- **Lo desplazable es la lista, no la acción.** Decisión no cubierta por el design system: cuando el contenido de una capa no cabe, se desplaza **el contenido** y la acción se queda anclada abajo. Se resuelve así porque la alternativa —desplazar la pantalla entera— deja la única acción fuera de la vista, que es exactamente el defecto que esta fila corrige.
- **El respaldo del ofrecimiento entra por «no llegó el topónimo», no por «no hay red».** La misma ruta sirve al nombre y al levantamiento, así que si el nombre no llega, dibujar tampoco iba a llegar: una puerta y no dos. Si al medirlo apareciera un caso donde eso no se sostiene, se declara.
- **Rechazar no se recuerda.** Regla de SPEC-041: recordar la negativa crea un estado invisible que solo se puede explicar como aplicación, y el coste de volver a ofrecer es una pantalla que se cierra con un toque.

## Notas técnicas

### Lo que está medido, y contra qué

Todo lo que sigue se midió con grep a repo entero y lectura del código el 12-ago-2026, antes de escribir esta spec.

- `siembraLaCola` (`packages/nucleo/partida/entregas.js:225`) solo la llaman `test/nucleo/` y el método `siembra()` del propio productor (`entregas.js:498`). Nada de `app/`.
- Y es **más grande que eso**: en `app/App.js:574`, `alSalirAAndar={(cerrado, lista, levantado) => …}` **no usa `lista` en ninguna línea de su cuerpo**. `componePrimeraLista` devuelve `prologo` entero con el aviso escrito en su contrato (`app/mapa/primera-lista.js:71-73`) y ese objeto se tira. Como `componePrimeraLista` no le pasa a `correPrologo` las áreas de la partida, el prólogo asienta sus rumores, sus núcleos y su par en los objetos de usar y tirar que crean los valores por defecto (`prologo.js:169-171`). Consecuencia medida: **nada en `app/` escribe nunca** `estado.rumores`, `estado.nucleos` ni `estado.arranque.par`, y `app/marcha/llegadas.js:188` lee `estado.nucleos` contra un área siempre vacía.
- `NUCLEO_DEL_OFRECIMIENTO` (`app/nucleo/piezas.js:195`) no lo importa ningún fichero. `hayQueOfrecerMapa` y `componeOfrecimiento` (`packages/nucleo/partida/mapas.js:220` y `:234`) no tienen llamador desde `app/`. `antes-de-salir.jsx:69` acepta `ofrecimiento` y monta `PantallaOfrecimiento` cuando llega (`:140`), y `App.js` nunca se la pasa.
- Y tampoco lo llama nadie: `levantamiento.mapaActivo` (`app/mapa/levantamiento.js:311`) y `levantamiento.anda` (`:327`) **no tienen ningún consumidor**. Nadie en `app/` resuelve el mapa activo, que es la mitad de la que cuelga A2P0.
- `levanta()` (`app/mapa/levantamiento.js:373`) **no corre ningún prólogo**. Así que el segundo mapa de una partida no tiene pasado hoy, ni cola, ni rumores. Es la respuesta a la pregunta del encargo sobre el mapa que no es el primero: no es que el prólogo corra y no se siembre, es que no corre.
- `CapaDescarte` se monta en `app/pantallas/llegada.js:170` como **último hijo del flujo normal** de `estilos.raiz`, y su propia raíz es `flex: 1` sin posicionar (`app/pantallas/descarte.jsx:78`). La otra capa del mismo fichero, el visor, usa `StyleSheet.absoluteFillObject` (`app/pantallas/visor.js:112`). Dos hijos con `flex: 1` en la misma columna es la causa del desbordamiento a 1080×2400 y de las cotas degeneradas que la fila 49 midió encima de «Marcarlo».
- `componeOfrecimiento` exige `sitio` como cadena no vacía **también con `sinRed: true`** (`mapas.js:235-237`); `sinRed` solo gobierna el aviso. El contrato de hoy no cubre el caso sin topónimo, y por eso hace falta la decisión del dueño que esta spec recoge.

### Las tres decisiones del dueño, y lo que obligan

Tomadas el 12-ago-2026 en la ventana de esta fila, con bloque ask y una pregunta viva a la vez (§11d), y confirmadas por quien orquesta con el dueño delante.

1. **El topónimo de A2P0 viaja por la ruta ciega que ya hay.** Una consulta pequeña por `pideGeneracion` de `app/datos/cliente-proxy.js`, la misma que usa el levantamiento. Se descartaron la geocodificación inversa del sistema —manda la coordenada exacta a un tercero, y el proxy ciego de SPEC-023 existe justamente para que eso no pase— y la frase fija siempre, porque el guion manda. Consecuencias que el implementador tiene que asumir: texto QL nuevo significa **clave de caché nueva**, así que la primera ejecución paga el minuto frío contra los mirrors y eso no es un cuelgue; y la elección del nombre sobre la respuesta tiene que ser **determinista**, con orden estable y desempate declarado, nunca el orden de llegada de `elements`.
2. **Sin topónimo, A2P0 se compone con un respaldo en voz de mundo.** `componeOfrecimiento` admite componer sin topónimo en la variante `sinRed`, con una pieza del guion en el sitio del nombre. **El contrato no se ablanda por el camino bueno**: con red, `sitio` sigue siendo obligatorio y una cadena vacía sigue siendo error de construcción. La frase de respaldo va en voz de mundo **sin nombrar la red ni la cobertura**, con la pieza `no-se-pudo` de precedente dentro del propio guion, y pasa por `game-design/lenguaje.md`: se lee en voz alta y es apta para menores. El porqué se escribe dentro de `mapas.js` y dentro de su prueba. Es cambio de diseño consumado y se anota en la bitácora.
3. **El paquete de diseño de A2P0 entra entero en esta fila.** Bloque «PANTALLA 0» en `docs/pantallas/pantallas-2-antes-de-salir.html`, nodo `A2P0` con sus aristas en `docs/flujo.md`, y su línea en `docs/pantallas.md` dejando dicho que el bloque salió del código ya cerrado y no de un artefacto publicado. Se descartó dejarlo fichado porque es literalmente la forma de §6y. **Los sitios que declaran «40 pantallas» se actualizan en el mismo commit** —la cabecera de `docs/flujo.md` y donde `CLAUDE.md` lo cite—, y el criterio es `verifica-flujo.mjs` en verde con 41.

### Frontera de inyección

Dos entradas nuevas, las dos por `app/nucleo/piezas.js` y por inyección, nunca importadas dentro del núcleo:

- **El traedor de topónimos.** Una función que recibe una coordenada y devuelve el lugar con nombre más cercano, o nada. Vive en `app/datos/`, se construye sobre el cliente del proxy que ya existe y se le inyecta a quien compone A2P0. Doblarla es lo que permite recorrer el ofrecimiento en `node --test` sin red y sin dispositivo, y es lo que hace afirmable el criterio de privacidad.
- **El levantamiento con la partida abierta.** Hoy `creaLevantamiento` solo se monta en `arranque-montado.jsx` y en `mapa-montado.jsx`. A2P0 necesita uno con la partida ya abierta, para «Levantar un mapa aquí». Se monta donde se decide qué se monta y no dentro de una pantalla, igual que los diez anteriores.

La resolución del mapa activo necesita además una posición, y esa ya la da `app/plataforma/ubicacion.js`. **No se lee ninguna coordenada nueva del sistema por esta fila**: se usa la que la app ya tiene.

### El orden del cableado del prólogo, que no es negociable

El prólogo corre en A1P6, cuando la partida **todavía no existe** —`componeLista` se llama en el paso `la-primera-aventura` (`app/pantallas/arranque.jsx:203`) y la partida nace después, en `alSalirAAndar` (`App.js:583`)—. Así que el prólogo sigue asentando en áreas frescas y lo que cambia es que **quien recibe el resultado lo trasplanta al estado que acaba de nacer**, y siembra la cola por la puerta que ya existe. Trasplantar y sembrar van **antes** de la primera congelación, o la partida se escribiría sin pasado y la siguiente apertura no sabría distinguirlo de un mundo que no lo tuvo.

`asienta` (`prologo.js:275`) se niega a correr un prólogo sobre un mapa que ya lo tiene, y eso es lo que impide que reabrir la app lo repita. No se toca.

### Fronteras y huecos, con dueño

- **`creaMotorDeLaPartida` sigue sin llamador en `app/`.** Es la misma forma de §6h y no es de esta fila: se ficha aquí para que exista escrito.
- **`escena.cara` es siempre nula**, 0 de 506 beats sobre rol humano. Viene de SPEC-017 y tiene fila corta propia.
- **La caída del servicio en primer plano** a mitad de salida sigue sin dueño (§12b). Si tropieza durante la verificación, se captura con `adb logcat` filtrado por el task manager **antes** de abrir la salida, y se ficha con lo capturado.
- **`descarte.yaml` no sale de límite declarado con esta fila**, y no se pretende: su motivo es otro —llegar a la puerta de A4P8 no es gobernable por un flujo, porque el ancla del mapa la lee `app/plataforma/ubicacion.js:122` y ningún flujo la fija (fila 44)—. Lo que esta fila arregla es que, una vez allí, el botón se pueda pulsar.
- **La versión de formato sigue siendo global a las ocho clases** de documento (§11e). Esta fila no sube ninguna versión, así que no la destapa; queda fichada donde estaba.

## Decisiones asumidas

- El prólogo asienta en áreas frescas y se trasplanta al nacer la partida, en vez de que `componePrimeraLista` reciba las áreas de una partida que aún no existe → asumido el trasplante (alternativa: adelantar el nacimiento de la partida a A1P6). Regla: adelantar el nacimiento cambia cuándo se escribe en disco y qué significa un arranque abandonado a medias, que es decisión de SPEC-047 y no de esta fila.
- El segundo mapa corre su prólogo con `primerMapa: false` al levantarse, y no en una fase aparte → asumido (alternativa: correrlo la primera vez que se abre su portada). Regla: levantar es irreversible y ocurre una sola vez, así que es el único momento donde `asienta` no puede chocar con un prólogo anterior.
- El respaldo del ofrecimiento es **una pieza más del guion** de `mapas.js`, no un texto de la app → asumido (alternativa: componerlo en `app/pantallas/ofrecimiento.jsx`). Regla: el guion va como dato precisamente para que un criterio de contenido no se quede sin poder ponerse rojo sin simulador, y un texto en la pantalla escaparía de esa red.
- El bloque de A2P0 en el artefacto 2 se numera **PANTALLA 0** y no PANTALLA 6 → asumido (alternativa: numerarla al final del artefacto). Regla: A2P0 es el identificador que el código, las pruebas y el encargo ya usan, y `verifica-flujo.mjs` deriva el nodo de la etiqueta del bloque; renumerarla obligaría a tocar todo lo que ya la nombra.
