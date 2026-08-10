# SPEC-043 — La navegación de consulta: las puertas que cuelgan de la portada

## Descripción

Hoy la app llega a la portada y ahí se acaba. Las tres puertas del pie —el diario, la repisa, los ajustes— están dibujadas y no llevan a ningún sitio, el zurrón no se intercala entre la portada y la lista del día, y a «empezar de nuevo» no se llega. Las cuatro pantallas de destino están escritas, montadas y probadas en Node; lo que falta es el camino.

Esta spec cabléa ese camino, y solo ese: las aristas que `docs/flujo.md` ya declara entre A2P1 y el artefacto 6, más la de A2P1 → A2P2 → A2P3 que quedó a medias en la fila 42. No añade pantallas, no rediseña ninguna y no inventa ninguna transición que el diagrama no tenga.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes,
  páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests
  de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega.
  Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya
  commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador
  entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica
  explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Fuera de alcance**: la máquina de estados de una salida (en marcha, llegadas, visor, escena, telón), que es la fila 44; y la puerta de desarrollo del andamiaje, que es la fila 45. Ninguna pantalla de destino se modifica: si una necesita un cambio para poder montarse, eso es un defecto de la fila que la entregó y se escala, no se arregla aquí.

## Criterios de aceptación

### Las tres puertas de la portada

- GIVEN la portada a la vista WHEN se pulsa la puerta del diario THEN se abre el diario por días con el capítulo del mapa activo abierto.
- GIVEN la portada a la vista WHEN se pulsa la puerta de la repisa THEN se abre la repisa con los objetos, los motes y el oro de la partida.
- GIVEN la portada a la vista WHEN se pulsa la puerta de los ajustes THEN se abren los ajustes con sus cinco grupos.
- GIVEN cualquiera de las tres pantallas de consulta abierta WHEN se pulsa el «‹» de volver THEN se vuelve a la portada tal y como estaba.
- GIVEN el diario abierto WHEN se vuelve a la portada THEN la portada no ha resembrado nada: la miniatura, el día y la lista de bloques son los mismos.

### El zurrón, entre la portada y la lista

- GIVEN pasos de fondo activos y reserva sin vaciar WHEN se pulsa «Ver qué se cuenta hoy» THEN se abre el zurrón y no la lista del día.
- GIVEN el zurrón a la vista WHEN se pulsa «Seguir» THEN se abre la lista de lo que hay hoy.
- GIVEN sin reserva que vaciar WHEN se pulsa «Ver qué se cuenta hoy» THEN se abre la lista del día directamente, sin pasar por el zurrón.
- GIVEN el zurrón ya visto y su reserva vaciada WHEN se vuelve a la portada y se pulsa «Ver qué se cuenta hoy» THEN se abre la lista del día y el zurrón no aparece por segunda vez.
- GIVEN los ajustes, el diario o la repisa abiertos WHEN se busca cómo llegar al zurrón THEN no hay ninguna puerta que lleve a él.

### Empezar de nuevo

- GIVEN los ajustes abiertos WHEN se pulsa la fila «Empezar de nuevo» THEN se abre la pantalla de empezar de nuevo en estado de pregunta.
- GIVEN la pantalla de empezar de nuevo WHEN se pulsa «Dejarlo como está» THEN se vuelve a los ajustes sin haber borrado nada.
- GIVEN la pantalla de empezar de nuevo WHEN el borrado termina THEN la app queda en el arranque, en A1P1, y no en la portada.

### Estados vacíos

- GIVEN una partida del día uno sin ningún objeto ni mote WHEN se abre la repisa THEN la repisa se pinta con su línea de vacío y sin ninguna cifra de distancia, tiempo, ritmo, pasos ni progreso.
- GIVEN una partida sin ninguna entrada apuntada WHEN se abre el diario THEN el diario se pinta con su capítulo activo vacío y sin la vista por historias.

### Averías

- GIVEN una pantalla de consulta que no se puede montar porque le falta una pieza WHEN se abre su puerta THEN se enseña la avería con la pieza nombrada, y no una pantalla vacía.
- GIVEN el capítulo de un mapa que no se puede abrir WHEN se pulsa su pestaña en el diario THEN se enseña la línea de fallo en voz de mundo y el resto del diario sigue en pie.

## UX Design

### Wireframe textual

Ninguna pantalla nueva. Las cinco que esta spec encadena están dibujadas y no se tocan:

- **pantalla 1 · artefacto 2, la portada** (`portada.jsx`). Ya pinta la fila de tres puertas al pie, construida desde `portada.puertas`. No es una barra de pestañas y no cambia.
- **pantalla 2 · artefacto 2, el zurrón** (`zurron.jsx`). Se intercala entre la portada y la lista, y su única acción es «Seguir».
- **pantalla 2 · artefacto 6, el diario por días** (`diario.jsx`), con su tira de capítulos y su «‹ volver».
- **pantalla 5 · artefacto 6, la repisa** (`repisa.jsx`), con su «‹ volver».
- **pantalla 6 · artefacto 6, los ajustes** (`ajustes.jsx`), con su «‹ volver» y la fila «Empezar de nuevo».
- **pantalla 7 · artefacto 6, empezar de nuevo** (`empezar-de-nuevo.jsx`), con «‹ Ajustes».

Lo que esta spec añade es el punto de montaje de cada una: el equivalente de `ArranqueMontado` y `AntesDeSalirMontado` para el momento de consulta. Ese montaje junta la composición del núcleo con las piezas de la app y, **si algo no se puede cablear, enseña la avería con la pieza nombrada en lugar de dibujar el momento** — el mismo contrato de §6h que ya cumplen los otros dos.

### Pantallas y elementos utilizados

Pantallas ya dibujadas: A2P1, A2P2, A2P3, A6P2, A6P5, A6P6, A6P7.
Aristas de `docs/flujo.md` que esta spec cablea: `A2P1 → A2P2`, `A2P2 → A2P3`, `A2P1 → A2P3`, `A6P1 → A6P2`, `A6P1 → A6P5`, `A6P1 → A6P6`, `A6P2 ⇢ A6P1`, `A6P5 ⇢ A6P1`, `A6P6 ⇢ A6P1`, `A6P6 → A6P7`, `A6P7 ⇢ A6P6`, `A6P7 → A1P1`.

Elemento nuevo: ninguno. Punto de montaje nuevo: uno, el del momento de consulta.

**A2P1 y A6P1 son la misma pantalla**, y el diagrama lo dice con línea punteada: «misma pantalla, redibujada sin barra de pestañas». Como aquí no hay barra de pestañas en ningún sitio, no hay nada que redibujar: la portada que ya existe hace de las dos.

### data-testid

Todos los que estas pantallas necesitan ya están en el código de cada una y no se cambian: `puerta-diario`, `puerta-repisa`, `puerta-ajustes`, `diario-por-dias`, `diario-volver`, `repisa`, `ajustes-lista`, `empezar-de-nuevo`, `zurron`. La composición del núcleo los declara en sus `TESTIDS`.

El único añadido es el de la avería del momento, por coherencia con los dos que ya existen (`arranque-sin-cablear`, `antes-de-salir-sin-cablear`):

- `consulta-sin-cablear` — la avería del punto de montaje del momento de consulta, con el mensaje de la pieza que falta.

### Patrón de interacción

- **Las puertas no son una barra de pestañas y el volver es un «‹», no un gesto.** Lo fija el design system: las pantallas de consulta *cuelgan* de la portada. Una barra las pondría al mismo nivel que salir a andar, que es lo contrario de lo que decidió el artefacto 2.
- **Volver de una pantalla de consulta no recompone la portada.** Abrir el diario y volver tiene que dejar la portada como estaba; recomponerla cambiaría la tarjeta de a medias y la miniatura sin que haya pasado nada en el juego.
- **El zurrón es un paso obligado, no un aviso.** Con reserva que vaciar se atraviesa; sin ella no existe. Quién manda es `portada.acciones`, que ya trae el destino resuelto (`zurron` o `lista-de-hoy`): la app lo obedece y no vuelve a decidirlo.
- **El zurrón tiene una sola entrada.** No se llega desde los ajustes, ni desde el diario, ni desde la repisa, y eso es una ausencia que hay que sostener al cablear las puertas.
- **Empezar de nuevo sale al arranque, no a la portada.** Es lo que distingue borrar de reiniciar, y el destino lo declara el núcleo en `DESTINO_TRAS_BORRAR`.
- **Lo destructivo no es la acción principal.** Ya está resuelto dentro de la pantalla; al cablearla no se añade ningún «¿seguro?» por encima.

## Notas técnicas

- Las composiciones existen todas y no hay que escribir ninguna: `componePortada` (con `PUERTAS`), `abreElDiario` y `abreCapitulo` de `capitulos.js`, `componeRepisa`, `componeAjustes`, `componeEmpezarDeNuevo` y `componeElZurron`.
- `AntesDeSalirMontado` y `PantallaAntesDeSalir` ya aceptan `alAbrirPuerta` y `alZurron` y no los reciben de nadie. Ese es el hueco exacto que esta fila tapa.
- El borrado ya está cableado en `App.js` con `creaEmpezarDeNuevo`, incluido el remate de un borrado interrumpido al arrancar. Lo que falta es la puerta desde los ajustes, no la pieza.
- **La frontera de inyección no cambia**: el momento de consulta se monta con las piezas que la app ya construye una sola vez (el almacén duradero, la copia, el empezar de nuevo). Si alguna pantalla necesitara una pieza que hoy no existe, se declara como avería y se escala; no se inventa.
- La repisa pide `caras` y el diario pide `mapas`; los dos salen del estado de la partida. Si el estado no los trae, es avería con la pieza nombrada, nunca un valor por defecto vacío que se confunda con una repisa recién estrenada.

## Decisiones asumidas

- **Dónde vive la máquina de la navegación de consulta** → asumido que en `App.js`, junto a las banderas que ya hay, y no en un enrutador. Alternativa: introducir `expo-router` o `react-navigation`. Regla: sin dependencias nuevas que no nombre una spec, y `App.js` ya lo declara en su cabecera («un enrutador para pasar entre pantallas de herramienta es una librería para nada»). Si al cablear la fila 44 la máquina se vuelve ingobernable, esa fila lo replantea con la medida delante.
- **Qué hace el botón de atrás del sistema en una pantalla de consulta** → asumido que lo mismo que el «‹»: vuelve a la portada. Alternativa: cerrar la app. Regla: en Android el atrás del sistema y el de la pantalla no pueden discrepar; que discrepen es un defecto de plataforma, no una decisión.
- **Si el zurrón se vuelve a ofrecer tras volver de una pantalla de consulta** → asumido que no, porque su reserva ya se vació y la decisión la toma `componePortada`. Alternativa: recomponer la portada al volver. Regla: volver de una consulta no es un suceso del juego.
- **Qué mapa abre el diario** → asumido que el capítulo del mapa activo, que es lo que `abreElDiario` ya resuelve con `mapaActivo`. Alternativa: el último leído. Regla: `RF-PERS-007`, el mapa activo lo decide dónde estás.
- **Momento declarado de las tres pantallas** → asumido `de-consulta`, que es el que sus composiciones ya traen en `MOMENTO`. Sin alternativa real: cambiarlo contradiría el design system.
