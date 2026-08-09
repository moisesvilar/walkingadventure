# SPEC-030 — El rótulo del sistema, y la salida que espera

## Descripción

Una salida abierta tiene que seguir viva con el móvil en el bolsillo y la pantalla apagada, y eso lo sostiene **un rótulo del sistema**: un servicio en primer plano con notificación persistente en Android, una Actividad en Vivo en iOS. No es un adorno ni una cortesía: es la pieza técnica por la que este juego **no pide nunca el permiso de ubicación permanente** (`seguridad-privacidad.md` §2, exclusión 12 del PRD). Mientras el rótulo está puesto, la app cuenta como «en uso»; retirado el rótulo, se acabó la ubicación.

El rótulo es además **la única superficie tocable que existe en marcha**, y por serlo tiene una sola acción: dar la salida por terminada. Vive en la pantalla de bloqueo y no dentro del juego precisamente porque es del sistema y ya tiene que estar ahí de todos modos (`bucle-jugable.md` §8). Y es **austero y visible a propósito**: hacia dónde vas y nada más —ni una cifra de distancia, de tiempo, de ritmo ni de progreso—, porque una app que sigue leyendo tu ubicación tiene que decirlo mientras lo hace.

Esta fila entrega tres cosas que se sostienen entre sí y que hasta ahora no existían en ninguna parte: **la vida de una salida** como estado de partida con sus cuatro situaciones y sus transiciones —abierta con rótulo, abierta con el rótulo retirado, cerrada sin leer, leída—; **el telón que lo echa volver**, al punto de partida o a mano desde el rótulo, sin avisar y esperando a que lo leas; y **la salida que espera**, esa que no vuelve a casa ni se cierra, cuyo servicio se para tras un buen rato sin que andes por tu cuenta sin que la salida muera con él.

Anclas: **RF-INFRA-004** (`docs/prd.md` §4.13), **RF-BUCLE-010** y **RF-BUCLE-017** (§4.7). Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` §8 y §9, `game-design/seguridad-privacidad.md` §2 y `game-design/arquitectura.md`. Consume SPEC-020 (los cuatro módulos de plataforma, su registro con módulos inyectados y su contrato de sonda), SPEC-004 (el tramo personal, del que sale la distancia de alejamiento), SPEC-011 (el motor de pasos y su contador, que el cierre no toca) y SPEC-009 más la capa de estado de partida (donde se registra el área nueva). El **riesgo 4 del PRD §8** dice exactamente lo que esta spec tiene que resolver: son dos plataformas con ciclos de vida distintos y de ellas cuelga el permiso, así que aquí se separa el **contrato común** —que es lo que se puede poner rojo en Node— de **lo que difiere**, que es lo que hay que probar en las dos.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: entran la **fuente de posiciones de la salida** y el **rótulo del sistema** como capacidad de plataforma, las dos inyectadas y las dos con doble en Node, y se registra un **área nueva del estado de partida**. Están descritas en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** la **tarjeta de a-medias de la portada** con sus dos acciones dibujadas (A2P1, fila 28, RF-BUCLE-002) —esta spec fija qué dispara cada una y en qué estado aparece, no cómo se pinta—; **la secuencia del telón** entera, el entintado del mapa, el desenlace, el cierre en corto redactado y la entrada del diario (fila 36, RF-BUCLE-011/012/013) —aquí solo se fija que el cierre ocurre, con qué variante y que espera a que lo lean—; el **mapa en marcha**, la marca de posición y los avisos (fila 29); la **clasificación de la traza en andando, parada, vehículo y ambigua** (fila 31), que aquí se consume; la **validación de llegadas y la secuencia de una llegada** (fila 32); el **permiso de ubicación** y su petición en contexto (fila 27, RF-PJ-005); y el **respaldo del sistema** con su partición por plataforma (fila 39), del que esta fila hereda el mecanismo pero no el contenido.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La vida de una salida» y «El rótulo, contenido y acción»; la **validación de entradas** en la posición mal formada, el destino que no es un sitio del mundo y la transición pedida desde una situación que no la admite; el **estado vacío** en la salida sin destino, la salida sin un solo metro andado y el cierre sin ninguna aventura aceptada; el **estado de error** en «Nada se abre en silencio sin rótulo» y en la retirada por el sistema; y los **casos límite** en el regreso en autobús, el plazo cumplido en mitad de una comida, la salida que espera días, el rótulo retirado por el propio sistema antes de tiempo y la salida abierta y cerrada dentro del mismo geofence de partida.

«Tiempo del sensor» significa la marca de tiempo que trae cada posición de la fuente inyectada. **En ningún criterio de esta spec el núcleo lee el reloj del sistema**: compara marcas recibidas, que es lo que hace que un plazo de noventa minutos se pueda afirmar en `node --test` sin esperar noventa minutos.

### La vida de una salida

- **Dado** el catálogo de situaciones de una salida, **cuando** se enumera, **entonces** son exactamente cuatro: abierta con el rótulo puesto, abierta con el rótulo retirado, cerrada sin leer y cerrada leída.
- **Dado** una partida sin ninguna salida, **cuando** se pregunta por la salida en curso, **entonces** no hay ninguna, y no es un error.
- **Dado** una partida sin ninguna salida y el rótulo disponible, **cuando** se abre una salida, **entonces** queda abierta con el rótulo puesto y con el punto de partida anotado.
- **Dado** una salida ya abierta, **cuando** se abre otra, **entonces** falla nombrando la salida que sigue abierta, en lugar de sustituirla.
- **Dado** una salida abierta, **cuando** se serializa la partida y se vuelve a cargar, **entonces** vuelve en la misma situación, con el mismo punto de partida y con la misma marca de la última posición propia.
- **Dado** una salida cerrada sin leer, **cuando** se serializa la partida y se vuelve a cargar, **entonces** sigue sin leer.
- **Dado** una salida cerrada leída, **cuando** se pregunta por la salida en curso, **entonces** no hay ninguna y la partida admite abrir otra.
- **Dado** cualquier situación, **cuando** se pide una transición que esa situación no admite —cerrar una salida ya cerrada, retirar el rótulo de una salida cerrada, retomar una que nunca se abrió—, **entonces** falla nombrando la situación de partida y la transición pedida.
- **Dado** la superficie pública de esta capa, **cuando** se busca una operación que reciba una fecha, una hora o un número de días, **entonces** no existe.
- **Dado** el módulo de la salida, **cuando** se inspecciona su código, **entonces** no aparece ninguna lectura del reloj del sistema ni ninguna fuente de azar.
- **Dado** una salida abierta y cerrada, **cuando** se lee el contador de pasos del mundo, **entonces** el cierre no lo ha movido: cerrar una salida no es andar.

### El telón lo echa volver

- **Dado** una salida abierta cuyo punto de partida está anotado, **cuando** la jugadora se aleja más de la distancia de alejamiento y vuelve a estar dentro del radio de regreso el tiempo de permanencia declarado, **entonces** la salida se cierra.
- **Dado** la misma salida, **cuando** se cierra por regreso, **entonces** no se emite ninguna notificación y no se pide poner la app en primer plano.
- **Dado** una salida abierta, **cuando** la jugadora vuelve al punto de partida **en autobús**, **entonces** la salida se cierra igual: la comprobación del regreso no consulta la clasificación de la traza en ningún punto.
- **Dado** el módulo del regreso, **cuando** se inspecciona lo que consulta, **entonces** no importa nada del detector de transporte.
- **Dado** una salida abierta que nunca se alejó más de la distancia de alejamiento, **cuando** la jugadora pasa por el punto de partida, **entonces** la salida **no** se cierra.
- **Dado** una salida abierta, **cuando** la jugadora pasa por delante del punto de partida sin quedarse el tiempo de permanencia, **entonces** la salida no se cierra.
- **Dado** la distancia de alejamiento, **cuando** se lee de dónde sale, **entonces** está expresada en tramos y se traduce a metros con el tramo de quien juega, y nunca es menor que el suelo de moverse.
- **Dado** dos jugadoras con tramos distintos, **cuando** se comparan sus distancias de alejamiento en metros, **entonces** son distintas y proporcionales a su tramo.
- **Dado** una salida abierta, **cuando** se pulsa «dar la salida por terminada» en el rótulo, **entonces** la salida se cierra exactamente igual que si hubiera vuelto, sin ninguna diferencia de estado salvo el motivo anotado.
- **Dado** una salida cerrada por cualquiera de las dos vías, **cuando** se lee su motivo, **entonces** es uno de un vocabulario cerrado: regreso, a mano desde el rótulo, o dejarlo aquí desde la portada.
- **Dado** una salida con una aventura aceptada y sin terminar, **cuando** se cierra por cualquiera de las tres vías, **entonces** el cierre queda marcado como en corto.
- **Dado** una salida sin ninguna aventura aceptada, **cuando** se cierra, **entonces** el cierre no queda marcado como en corto y no se produce ningún desenlace.
- **Dado** una salida con la aventura terminada, **cuando** se cierra, **entonces** el cierre no queda marcado como en corto.
- **Dado** una salida que se cierra, **cuando** se mira el rótulo, **entonces** queda retirado en la misma transición y no en una posterior.

### El telón espera a que lo leas

- **Dado** una salida cerrada, **cuando** se lee su situación, **entonces** es cerrada sin leer.
- **Dado** una salida cerrada sin leer, **cuando** se abre la app, **entonces** lo primero que el estado ofrece es el telón de esa salida y no la portada.
- **Dado** una salida cerrada sin leer hace dos días con la app cerrada en medio, **cuando** se abre la app, **entonces** sigue ofreciéndose el telón de aquella salida.
- **Dado** una salida cerrada sin leer, **cuando** se marca como leída, **entonces** pasa a cerrada leída y deja de ofrecerse.
- **Dado** una salida cerrada sin leer, **cuando** se busca qué la marca como leída, **entonces** es una acción explícita de quien la lee y nunca el paso de nada.
- **Dado** dos salidas cerradas sin leer, **cuando** se busca si es posible, **entonces** no lo es: no se puede abrir una salida nueva con un telón sin leer, y el intento falla nombrando el telón pendiente.
- **Dado** una salida que se cierra, **cuando** se inspecciona lo que la capa emite hacia la plataforma, **entonces** no emite ninguna notificación ni ninguna petición de primer plano.

### La salida que espera, y el rótulo que se retira

- **Dado** una salida abierta con el rótulo puesto, **cuando** transcurre el plazo declarado de tiempo del sensor sin un solo metro propio, **entonces** el rótulo se retira y la salida queda abierta con el rótulo retirado.
- **Dado** la misma salida, **cuando** se lee su situación tras la retirada, **entonces** sigue abierta: retirar el rótulo no cierra nada.
- **Dado** una salida abierta, **cuando** la jugadora se para veinte minutos a comer y sigue andando, **entonces** el rótulo sigue puesto y el plazo vuelve a contar desde el último metro propio.
- **Dado** una salida abierta, **cuando** la jugadora se desplaza durante el plazo entero **a velocidad de vehículo**, **entonces** el rótulo se retira igual: el vehículo no es andar por su cuenta.
- **Dado** una salida abierta, **cuando** la jugadora se desplaza a velocidad ambigua, **entonces** el plazo se reinicia: en la duda, cuenta, y la regla se lee del mismo sitio que la del motor de pasos.
- **Dado** una salida abierta con el rótulo retirado, **cuando** se abre la app, **entonces** el estado ofrece la salida a medias con sus dos acciones y no el telón.
- **Dado** una salida abierta con el rótulo retirado, **cuando** se pide «seguir», **entonces** la salida vuelve a abierta con el rótulo puesto y el plazo cuenta de nuevo desde ese momento.
- **Dado** una salida abierta con el rótulo retirado, **cuando** se pide «dejarlo aquí», **entonces** la salida se cierra con el motivo de la portada, y con la marca de cierre en corto si había aventura sin terminar.
- **Dado** una salida abierta con el rótulo puesto, **cuando** se abre la app, **entonces** el estado ofrece igualmente la salida a medias: la tarjeta depende de que la salida esté abierta y no de dónde esté el rótulo.
- **Dado** una salida abierta con el rótulo retirado que lleva tres semanas así, **cuando** se abre la app, **entonces** sigue abierta y ninguna regla la ha cerrado por su cuenta.
- **Dado** el catálogo de motivos de retirada del rótulo, **cuando** se enumera, **entonces** son tres y se distinguen: el plazo del juego, el cierre de la salida y la retirada por el sistema.
- **Dado** un rótulo que retira el sistema por su cuenta antes del plazo, **cuando** se lee el estado, **entonces** queda registrado con su propio motivo y no se confunde con el plazo del juego, y la salida sigue abierta.
- **Dado** el plazo declarado del juego, **cuando** se compara con el tope de vida más corto de las dos plataformas, **entonces** es menor, y esa comparación está escrita como comprobación y no como comentario.

### El rótulo, contenido y acción

- **Dado** una salida abierta con destino, **cuando** se compone el rótulo, **entonces** trae una sola línea que nombra el destino y una sola acción, «Dar la salida por terminada».
- **Dado** el texto compuesto del rótulo en cualquier estado, **cuando** se busca un dígito, **entonces** no hay ninguno.
- **Dado** el texto compuesto del rótulo, **cuando** se buscan las palabras de esfuerzo —kilómetros, metros, minutos, ritmo, pasos, progreso, restante, faltan—, **entonces** no aparece ninguna.
- **Dado** una salida abierta sin ninguna aventura, **cuando** se compone el rótulo, **entonces** trae igualmente una línea en voz de mundo que nombra dónde se anda, y la misma acción única.
- **Dado** un rótulo compuesto, **cuando** se cuentan sus acciones tocables, **entonces** es exactamente una.
- **Dado** una aventura cuyo beat siguiente cambia de sitio, **cuando** se recompone el rótulo, **entonces** la línea nombra el sitio nuevo y nada más cambia.
- **Dado** el rótulo, **cuando** se busca en su composición algún dato del estado del mundo, de la reputación o del oro, **entonces** no aparece ninguno.
- **Dado** el módulo que compone el rótulo, **cuando** se inspecciona su superficie, **entonces** devuelve datos —la línea y la acción— y no dibuja: quién lo pinta es la plataforma.
- **Dado** un mundo en gallego, **cuando** se compone el rótulo, **entonces** el nombre del destino es el que produjo el paquete de idioma de ese mundo.

### Nada se abre en silencio sin rótulo

- **Dado** la capacidad del rótulo no disponible, **cuando** se intenta abrir una salida, **entonces** no se abre, y el resultado nombra la capacidad que falta.
- **Dado** la capacidad del rótulo no montada en esta compilación, **cuando** se intenta abrir una salida, **entonces** ocurre lo mismo y el motivo distingue «no montada» de «no disponible».
- **Dado** una salida abierta, **cuando** el rótulo desaparece sin que ninguna transición del juego lo haya pedido, **entonces** la capa lo detecta, lo registra con el motivo de retirada por el sistema y no deja la salida creyéndose sostenida.
- **Dado** una salida abierta con el rótulo puesto, **cuando** se comparan la situación del estado y la presencia real del rótulo, **entonces** coinciden, y esa coincidencia es comprobable en cualquier momento y no solo en las transiciones.
- **Dado** la fuente de posiciones no cableada, **cuando** se abre una salida, **entonces** falla nombrando la fuente que falta, en lugar de abrir una salida que nunca recibirá una posición.
- **Dado** una posición sin marca de tiempo o con una marca anterior a la última recibida, **cuando** llega a la capa, **entonces** falla nombrando la posición, en lugar de tratarla como reciente.
- **Dado** un punto de partida que no es una coordenada, **cuando** se abre la salida, **entonces** falla nombrando lo recibido.
- **Dado** el registro de capacidades, **cuando** se enumera, **entonces** el rótulo aparece como una capacidad más, con su nombre, su capa y su sonda, y su sonda no pide ningún permiso.

### Lo que difiere entre las dos plataformas

- **Dado** `app/plataforma/`, **cuando** se enumeran las implementaciones del rótulo, **entonces** hay una por plataforma y las dos exportan exactamente los mismos nombres.
- **Dado** las dos implementaciones, **cuando** se comparan sus sondas, **entonces** las dos responden al mismo contrato de montado, disponible y motivo.
- **Dado** cualquier fichero de `app/` fuera de `app/plataforma/`, **cuando** se busca en su código, **entonces** no aparece ninguna bifurcación por sistema operativo relacionada con el rótulo.
- **Dado** la implementación de Android, **cuando** se lee el manifiesto, **entonces** declara el servicio en primer plano con el tipo de ubicación y su canal de notificación, y la notificación no se puede descartar deslizando.
- **Dado** la implementación de iOS, **cuando** se lee su configuración, **entonces** declara la Actividad en Vivo y el modo de ubicación en segundo plano, y no declara ningún permiso de ubicación permanente.
- **Dado** la app en cualquiera de las dos plataformas, **cuando** se revisan los permisos que solicita, **entonces** solo pide la ubicación «mientras se usa».
- **Dado** una salida abierta en cualquiera de las dos plataformas, **cuando** se bloquea el móvil y se anda veinte minutos, **entonces** la salida sigue abierta y el rótulo muestra hacia dónde va, sin ninguna cifra.
- **Dado** el rótulo puesto en cualquiera de las dos plataformas, **cuando** se pulsa su única acción, **entonces** la salida se cierra sin que la app tenga que abrirse.
- **Dado** las dos plataformas, **cuando** se comparan los literales del rótulo, **entonces** son los mismos: lo que difiere es el ciclo de vida, nunca el texto.

## UX Design

### Wireframe textual

**El rótulo, en la pantalla de bloqueo (A3P1, «El bolsillo»).** Es la pantalla que más dura de toda la salida y la que esta fila entrega. Sobre el fondo de la pantalla de bloqueo del sistema, con su hora y su fecha, una tarjeta del sistema con tres cosas y ninguna más:

```
  Walking Adventure
  Vas hacia Monfrida.
  [ Dar la salida por terminada ]
```

- **El nombre de la aplicación** lo pone el sistema y no se compone aquí.
- **La línea**, una sola, en voz de mundo. Con aventura aceptada: «Vas hacia ‹nombre del sitio del beat vigente›.» Sin aventura, con la salida abierta desde «salir a andar sin más»: «Andando por ‹nombre del mundo›.» Ninguna otra variante, y ninguna lleva un número.
- **La acción**, una sola y con literal fijo: **«Dar la salida por terminada»**. No hay pausar, no hay ver el mapa, no hay descartar. Cualquier segunda acción convierte el rótulo en un panel y da una razón para sacar el móvil, que es exactamente lo que el momento 2 existe para no dar.

Lo que **no** lleva, y hay que defenderlo cada vez: ni distancia recorrida, ni distancia que falta, ni tiempo, ni ritmo, ni número de beats, ni progreso, ni oro, ni el estado de ningún pueblo, ni una miniatura del mapa. La austeridad no es minimalismo: es la condición con la que `seguridad-privacidad.md` §2 acepta que la app siga leyendo la ubicación con la pantalla apagada.

**La retirada del rótulo no tiene pantalla.** Ocurre y ya: el rótulo desaparece de la pantalla de bloqueo sin notificación, sin sonido y sin resumen. Enseñar algo al retirarlo sería el móvil llamando para decir que deja de llamar.

**El cierre tampoco tiene pantalla propia.** El telón queda esperando; qué se ve al abrir la app y en qué orden es de la fila 36. Lo que esta fila fija es que **no se enseña nada en el momento del cierre**.

**La tarjeta de la salida a medias (A2P1, dueña: fila 28).** Esta spec no la compone: fija cuándo existe —con la salida abierta, esté el rótulo puesto o retirado— y qué dispara cada una de sus dos acciones: **«Seguir con la entrega»** vuelve a poner el rótulo y reanuda la salida; **«Dejarlo aquí»** cierra la salida con el motivo de la portada y con la marca de cierre en corto si había aventura sin terminar.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec alimenta:
  A3P1  pantalla 1 · artefacto 3 — El bolsillo              (el rótulo es de esta fila)
  A2P1  pantalla 1 · artefacto 2 — La portada               (dueña: fila 28; aquí, qué dispara la tarjeta)
  A5P1  pantalla 1 · artefacto 5 — El mapa se entinta       (dueña: fila 36; aquí, que el telón queda esperando)
  A5P2B pantalla 2B · artefacto 5 — El cierre en corto      (dueña: fila 36; aquí, cuándo se marca en corto)

Elementos del proyecto que se usan: ninguno del mapa. El rótulo no es un componente
de la app: es una superficie del sistema, y por eso su composición se entrega como
datos y la pinta la capa de plataforma.

Elemento nuevo: el rótulo del sistema, como quinta capacidad de plataforma junto a
salud, háptico, notificaciones y respaldo, con el mismo contrato de SPEC-020 y con
implementación partida por plataforma como la del respaldo.
```

No se añade ninguna pantalla al flujo: `node scripts/verifica-flujo.mjs` tiene que seguir en verde, porque el rótulo vive dentro de A3P1, que ya existe, y la arista que cierra la salida —«volver al punto de partida, o dar la salida por terminada desde el rótulo del sistema»— ya está dibujada en `docs/flujo.md` entre A3P1 y A5P1.

### data-testid

Los dos que `design-system.md` pide siempre son aquí el estado del momento y —por ausencia— el mapa, que no es de esta fila. Los identificadores viven en la app, porque la notificación del sistema no admite `data-testid`: en la pantalla de bloqueo, Maestro localiza el rótulo por sus literales, y por eso los literales están fijados arriba.

- `salida-estado` — el estado del momento, con un valor de un vocabulario cerrado: `sin-salida`, `abierta-con-rotulo`, `abierta-sin-rotulo`, `cerrada-sin-leer`, `cerrada-leida`
- `salida-tarjeta` — la tarjeta de a-medias de la portada, para afirmar que existe exactamente cuando la salida está abierta (el elemento lo compone la fila 28; el identificador se declara aquí porque es esta fila la que decide cuándo aparece)
- `salida-seguir` — la acción «Seguir con la entrega»
- `salida-dejarlo` — la acción «Dejarlo aquí»
- `rotulo-estado` — el estado real del rótulo según la capa de plataforma, con un vocabulario cerrado: `puesto`, `retirado-por-plazo`, `retirado-por-cierre`, `retirado-por-el-sistema`, `no-disponible`. Existe para poder afirmar que el estado de la salida y la presencia real del rótulo coinciden, que es el criterio que impide la degradación silenciosa
- `rotulo-linea` — el texto compuesto de la línea del rótulo, expuesto por la app para poder afirmar sobre él sin depender de leer la pantalla de bloqueo
- `telon-pendiente` — presente cuando hay una salida cerrada sin leer

Sin más: la acción «Dar la salida por terminada» es texto único y se localiza por su literal en las dos plataformas.

### Patrón de interacción

- **La única acción tocable en marcha vive en el rótulo y es una.** Regla: `design-system.md`, «Ningún control tocable dentro de la app mientras se anda», y `bucle-jugable.md` §8. Que sea del sistema es lo que la hace legítima: no obliga a desbloquear, no obliga a abrir la app y ya está en la pantalla que se mira de todos modos.
- **Cerrar la salida no se confirma.** Nada de un diálogo de «¿seguro?». Regla: `bucle-jugable.md` §4, volverse a mitad no se reprocha ni se penaliza; una confirmación convierte una decisión libre en algo que hay que defender. El coste de un cierre accidental es un telón antes de tiempo, no la pérdida de nada.
- **El cierre no avisa, y esperar es el comportamiento correcto.** Regla: `bucle-jugable.md` §8, el telón se echa solo, sin avisar, y las notificaciones están reservadas a las oportunidades (`accesibilidad.md` §3). Poner la app en primer plano sería el móvil llamando en lugar de avisando.
- **La retirada del rótulo tampoco avisa.** Regla: la misma. Y además: avisar de que un servicio se para es hablar como aplicación en el momento en que la aplicación no tiene voz.
- **Reanudar es una acción explícita y no una detección.** Regla: `seguridad-privacidad.md` §2; retirado el rótulo se acabó la ubicación «mientras se usa», así que no hay manera legítima de enterarse de que la jugadora ha vuelto a andar. Se retoma abriendo la app y pulsando «Seguir con la entrega», que es la tarjeta que la portada ya tiene dibujada.
- **La salida no se cierra sola nunca, por nada.** Regla: exclusión 14 del PRD y `bucle-jugable.md` §8: adivinar mal echa el telón sobre una aventura viva. Lo único que se para solo es el servicio.
- **Decisión no cubierta por el design system:** qué hacer cuando el rótulo no está disponible. Se resuelve **no abriendo la salida**, porque abrirla sin él significaría o bien perder la ubicación a los pocos minutos —una salida que no se entera de nada— o bien pedir el permiso permanente, que es la exclusión 12. Qué se enseña entonces, y en qué registro, es de la fila 28; lo que esta fila fija es que no se abre en silencio.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/salidas.js` | la vida de una salida: las cuatro situaciones, las transiciones, el punto de partida, el motivo de cierre, la marca de cierre en corto y el registro del área en el estado |
| `packages/nucleo/partida/regreso.js` | la comprobación del regreso: distancia de alejamiento en tramos, radio de regreso, tiempo de permanencia, y la garantía de que no consulta la clasificación |
| `packages/nucleo/partida/rotulo.js` | la composición del rótulo —línea y acción— a partir del destino y del mundo, y el plazo de retirada con su comparación contra el tope de plataforma |
| `app/plataforma/rotulo.android.js` | el servicio en primer plano, su canal y su notificación persistente |
| `app/plataforma/rotulo.ios.js` | la Actividad en Vivo y la ubicación en segundo plano |
| `app/plataforma/registro.js` | el rótulo registrado como una capacidad más, sin cambiar el contrato de SPEC-020 |
| `app/plataforma/posiciones.js` | la fuente de posiciones de la salida, con su marca de tiempo y su precisión |

`packages/nucleo/partida/estado.js` se toca solo para **registrar el área nueva**, con el mecanismo que ya existe: no se lista aquí ninguna otra área ni se sube ningún versionado en paralelo.

### Frontera de inyección

Dos entradas nuevas, las dos con doble en Node, y ninguna sensor dentro del núcleo:

1. **La fuente de posiciones de la salida** — entrega posiciones `{ lat, lon, tMs, precisionM }`. El núcleo no abre el GPS, no pide permisos y no tiene reloj: recibe posiciones y compara sus marcas. El doble es `test/dobles/gps-simulado.mjs`, que ya produce exactamente esta secuencia y que ya declara que no lee el reloj del sistema. **Si la fila 29 nombra esta fuente de otra manera al escribirse, manda ella y esto se ajusta por iteración**: lo que aquí no es negociable es que sea inyectada y que traiga la marca de tiempo dentro de cada posición.
2. **El rótulo del sistema, como capacidad de plataforma** — con el contrato de SPEC-020 sin cambiarlo: `nombre`, `capa` —aquí `ninguna`, porque el rótulo no es una capa de aviso: es visible a propósito y permanente, que es lo contrario de un aviso— y `sonda()` con `{ montado, disponible, motivo }`. Añade tres operaciones: poner, actualizar la línea y retirar con motivo, más una consulta de presencia real que es la que permite comparar el estado con el mundo. Dobles en Node: uno que funciona, uno que no está montado, uno que está montado y no disponible, y uno que **se retira solo** —el que reproduce lo que hace iOS cuando la Actividad en Vivo caduca.

Y una salida hacia el resto del juego: **la situación de la salida**, que la portada (fila 28), el telón (fila 36) y las llegadas (fila 32) leen sin volver a deducirla. Ninguna de las tres calcula por su cuenta si hay salida abierta.

Lo que **no** entra por la frontera y conviene decirlo: la clasificación de la traza. Esta capa consulta `cuentaParaElMotorDePasos` de `packages/nucleo/partida/ritmo.js` para saber si un tramo reinicia el plazo, y la clasificación se la entrega la fila 31. **La regla de la duda no se reimplementa aquí**, exactamente por la razón por la que SPEC-004 la puso en un solo sitio.

### El plazo, y por qué se mide en metros propios y no en quietud

El requisito dice «tras mucho rato sin andar». Se implementa como **tiempo del sensor transcurrido desde el último metro que cuenta como propio**, y no como «sin moverse», y la diferencia importa en los dos sentidos:

- **Un viaje largo en tren no mantiene el rótulo puesto.** Si el plazo se reiniciara con cualquier movimiento, un trayecto de tres horas dejaría el servicio corriendo tres horas sin que nadie ande, que es justo lo que `bucle-jugable.md` §9 no quiere.
- **Una comida de veinte minutos no lo retira.** El plazo es largo por eso: las paradas son de quien juega y no cuentan (`accesibilidad.md` §1), y una parada normal —una comida, una siesta, una conversación— no puede tener consecuencias.

Qué cuenta como metro propio se lee del mismo sitio que lo lee el motor de pasos: andando cuenta, ambiguo cuenta, vehículo no cuenta, parada no cuenta. La asimetría vuelve a jugar a favor: un falso ambiguo mantiene el rótulo puesto un rato de más, que no le quita nada a nadie; un falso vehículo lo retiraría antes de tiempo, y por eso la duda cuenta.

### El regreso, y el par de condiciones que lo hacen decidible

Volver es **dónde estás, no cuántos kilómetros pusiste tú** (`bucle-jugable.md` §8), así que la comprobación no puede consultar la clasificación en ningún punto: hay un criterio dedicado a eso y es el que hace que «volver a casa en autobús echa el telón igual» se pueda poner rojo. A cambio hacen falta dos condiciones, porque una sola no distingue nada:

- **Haberse alejado** más de la distancia de alejamiento, expresada en **tramos** y no en metros, de modo que quien anda 300 m en media hora no tenga que cruzar el barrio para que su salida pueda cerrarse. Sin esta condición, abrir la salida en casa la cerraría al instante, que es el caso más fácil de romper y el más embarazoso.
- **Quedarse** dentro del radio de regreso el tiempo de permanencia. Sin esto, pasar por delante de casa a mitad de un lazo echaría el telón sobre una aventura viva, que es exactamente lo que §8 se cuidó de evitar al descartar el cierre por inactividad.

Y la asimetría, que aquí es la contraria a la del plazo: **en la duda no se cierra**. Un cierre que no ocurre se arregla con un toque en el rótulo; un cierre de más no se arregla con nada.

### Las dos plataformas: qué es contrato y qué es ciclo de vida

Es el riesgo 4 del PRD y el motivo por el que esta fila es propia y temprana. El reparto:

| Contrato común, afirmable en Node | Ciclo de vida, comprobable solo en el dispositivo |
| --- | --- |
| las cuatro situaciones y sus transiciones | cuándo el sistema decide matar el proceso |
| la línea y la acción del rótulo, con sus literales | cómo se pinta la tarjeta en cada pantalla de bloqueo |
| el plazo, y que sea menor que el tope de plataforma | el tope real de la Actividad en Vivo de iOS |
| los motivos de retirada, con el del sistema entre ellos | qué hace Android al recuperar el proceso |
| que estado y presencia real coincidan | el permiso concedido y su revocación en caliente |

Las dos diferencias que más van a doler, escritas para que nadie las descubra tarde: **en iOS la Actividad en Vivo tiene un tope de vida impuesto por el sistema** y se apaga sola pasado un rato largo, así que el plazo del juego tiene que ser cómodamente menor —hay criterio para eso— y además hay que tratar la retirada por el sistema como un motivo propio; **en Android el servicio en primer plano lo puede matar el sistema** al recuperar memoria y volver con el proceso, así que al arrancar hay que reconciliar la situación guardada con la presencia real del rótulo en lugar de darla por buena. Las dos cosas producen el mismo síntoma —una salida que se cree sostenida y no lo está— y las dos caen bajo §6h: **si el rótulo no está, algo tiene que ponerse rojo**.

### Lo que consume de otras specs y no respecifica

- **SPEC-020** entrega el registro de capacidades con módulos inyectados, el contrato de sonda con `montado`/`disponible`/`motivo`, la regla de una sola base con la partición por plataforma solo dentro de `app/plataforma/`, y el precedente del respaldo con su implementación por plataforma. Aquí se añade una capacidad más; **no se cambia el contrato**.
- **SPEC-004** entrega el tramo personal y el suelo de moverse, de donde sale la distancia de alejamiento. No se declara ninguna distancia absoluta nueva salvo el radio de regreso, que es una tolerancia de sensor y no una unidad de juego.
- **SPEC-011** entrega el contador de pasos y la regla de que un paso solo añade. Cerrar una salida no ejecuta pasos ni toca el contador, y hay criterio para eso.
- **SPEC-009** y la capa de estado entregan el mecanismo de áreas registradas y la versión de formato única. El área de la salida se registra con ese mecanismo.
- **SPEC-019** entrega `cierraSalida` de la cola de entregas, que ya existe y que consume el identificador de una salida. Esta spec **es quien produce ese identificador y quien decide cuándo se cierra**; lo que la cola hace con el cierre no se reabre aquí.
- **La fila 31** entrega la clasificación de la traza, y **no está en disco al escribir esta spec**. De ella se consume solo el vocabulario que ya existe en `ritmo.js`; si la fila 31 nombra su salida de otra manera, manda ella.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Ninguno se implementa aquí —son de `wa-qa-dev`—, pero los criterios están escritos para cubrirlos sin inventar casos. Por nombre literal:

- De **«El telón se echa solo al cerrarse la salida»** (`@app @bucle`): «Volver a casa cierra la salida», «El telón espera a que lo leas», «Se puede cerrar la salida desde el rótulo del sistema» y «El rótulo se retira pero la salida no se cierra». Los cuatro tienen aquí su mitad `@nucleo`: dada una secuencia de posiciones simuladas y un rótulo doblado, qué situación queda.
- De **«En marcha, el mapa no cambia y no hay nada que tocar»** (`@app @bucle`): «La salida sigue viva con el móvil bloqueado» y «La app no pide el permiso de ubicación permanente». El segundo es afirmable sin dispositivo, leyendo la configuración de las dos plataformas.
- De **«El vehículo se aparta del reloj del mundo y de la validación»** (`@app @accesibilidad`): «Volver a casa en autobús echa el telón igual», del que aquí se sostiene entero el lado del cierre —la comprobación del regreso no mira la clasificación— y del que la otra mitad, que esos kilómetros no muevan el mundo, es de SPEC-011.
- De **«La app funciona con módulos de plataforma ausentes»**, el bloque que SPEC-020 propuso y que sigue sin estar escrito en la batería: aquí aparece su caso más duro, porque el rótulo es la única capacidad cuya ausencia **no** admite degradar en silencio.

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería y no de esta spec:

- **Nada afirma que el rótulo no lleva cifras** más allá de «el rótulo no muestra ninguna cifra», que está dentro de un escenario `@app` y por tanto no se ejecuta en esta máquina. La comprobación sobre el texto compuesto sí es `@nucleo` y no tiene escenario de respaldo.
- **Nada afirma que no se puede abrir una salida nueva con un telón sin leer.** Es una consecuencia directa de «El telón espera a que lo leas» y no está escrita en ningún sitio.
- **Nada afirma qué pasa cuando el rótulo lo retira el sistema.** Es el corazón del riesgo 4 y la batería no lo menciona.
- **Nada afirma que el cierre por regreso exija haberse alejado antes.** Sin ese caso, una implementación que cierre la salida al abrirla en casa pasa todos los escenarios existentes.
- **El plazo de retirada no tiene número en ningún documento de diseño.** «Un buen rato» es todo lo que dice `bucle-jugable.md` §9; el número lo pone esta spec y se declara abajo.
- **RF-BUCLE-014 sigue marcado ⚠ sin escenario** en el PRD, y su mitad «la aventura sigue abierta hasta volver o cerrar a mano» es de esta fila. Se anota para quien orquesta: el escenario que falta es que ninguna regla cierre una salida por su cuenta pasado el tiempo que sea.

## Decisiones asumidas

- **Plazo de retirada del rótulo: 90 minutos de tiempo del sensor sin un solo metro propio** → asumido (alternativas: 60 min, o 4 h). Regla: `bucle-jugable.md` §8 protege explícitamente la parada larga —una comida, una siesta, una conversación— y `accesibilidad.md` §1 dice que las paradas son de quien juega; 60 min retiraría el rótulo en mitad de una comida, y 4 h deja un servicio nuestro corriendo media tarde sin que nadie ande, que es lo que §9 prohíbe. Noventa minutos cabe cómodamente por debajo del tope de vida de una Actividad en Vivo, y esa holgura es criterio y no casualidad.
- **El plazo se mide sobre metros propios y no sobre quietud** → asumido (alternativa: reiniciarlo con cualquier posición nueva). Regla: `bucle-jugable.md` §9, «tras un buen rato sin que el jugador ande **por su cuenta**»; con cualquier movimiento valiendo, un trayecto en tren mantendría el servicio vivo indefinidamente.
- **Retirado el rótulo, la salida se retoma a mano desde la portada** → asumido (alternativa: seguir escuchando la ubicación para volver a poner el rótulo solo). Regla: `seguridad-privacidad.md` §2 y la exclusión 12; sin rótulo no hay permiso «mientras se usa» que sostenga nada, así que detectar que se ha vuelto a andar exigiría justo el permiso que el diseño no pide. La tarjeta de A2P1 con «seguir» ya está dibujada para esto y `docs/testing.md` la nombra como la consecuencia de la retirada.
- **Distancia de alejamiento: medio tramo, con el suelo de moverse como mínimo** → asumido (alternativas: una distancia absoluta, o salir del radio de regreso). Regla: `accesibilidad.md` §1, ninguna unidad de juego se calibra en metros absolutos; medio tramo son ~1 km para quien anda 2 km en media hora y ~150 m —elevados al suelo de 250 m— para quien anda 300, que en los dos casos es «haber salido de casa de verdad».
- **Radio de regreso: 50 m, y permanencia de 60 s** → asumido (alternativas: 30 m; permanencia de 20 s como la de una llegada). Regla: es una tolerancia de sensor y no una unidad de juego, así que va en metros; 50 m cubre un portal y un patio, y el minuto de permanencia es lo que distingue «he llegado» de «he pasado por delante». La asimetría del cierre —en la duda no se cierra— pide ser más exigente aquí que en una llegada, porque un cierre de más no se arregla con nada.
- **La comprobación del regreso no consulta la clasificación de la traza** → asumido como criterio duro (alternativa: exigir que el último tramo sea andando). Regla: `bucle-jugable.md` §8, «volver es una cuestión de dónde estás, no de cuántos kilómetros pusiste tú», y `docs/testing.md`, «Volver a casa en autobús echa el telón igual».
- **La salida no se abre si el rótulo no está disponible** → asumido (alternativas: abrirla igual y aceptar perder la ubicación, o pedir el permiso permanente). Regla: la exclusión 12 del PRD y §6h de `pipeline/decisiones-orquestador.md`: una pieza que al no estar no protesta es la forma de fallo que este proyecto ya ha visto cinco veces.
- **Literales del rótulo: «Vas hacia ‹sitio›.» con aventura y «Andando por ‹mundo›.» sin ella, con la acción «Dar la salida por terminada»** → asumido (alternativa: una sola línea genérica para los dos casos). Regla: los dos primeros salen de A3P1, que ya dibuja «Vas hacia Monfrida.» y la acción con ese literal exacto; el segundo lo pone esta spec porque la pantalla no dibujó el caso de «salir a andar sin más», que RF-BUCLE-002 declara de primer nivel.
- **El rótulo se registra como una quinta capacidad con `capa: ninguna`** → asumido (alternativa: declararlo capa de pantalla, por vivir en la pantalla de bloqueo). Regla: `accesibilidad.md` §3 define las capas como capas **de aviso**, y el rótulo no avisa de nada: es permanente y visible a propósito. Declararlo capa de pantalla lo metería en el par de capas de los avisos, donde no pinta nada.
- **El área nueva del estado se llama «salidas» y guarda también las cerradas sin leer** → asumido (alternativa: guardar solo la salida en curso y dejar el telón pendiente en otro sitio). Regla: `docs/testing.md`, «El telón espera a que lo leas» exige que un cierre sobreviva a días con la app cerrada, y partirlo en dos áreas es cómo se desincronizan.
