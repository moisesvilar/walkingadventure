# SPEC-035 — El sitio que no pega: el descarte de un anclaje

## Descripción

Entrega la única salvaguarda del proyecto que escala: **quien camina puede decir que un sitio no vale**, con dos toques, sin dar motivo y sin que eso salga del móvil. Existe porque OpenStreetMap y Places no distinguen un molino de un cobertizo de alguien, y el vecindario sí: esa escalera puede tener una rampa que nadie ha mapeado, ese parque puede ser un solar, esa finca puede tener un perro. Y el mismo gesto sirve para «aquí no me apetece ir», sin que nadie tenga que explicar por qué.

Lo que decide su forma es una regla que parece pequeña y no lo es: **anotar no es resembrar**. El sitio conserva su nombre y su posición, el mapa se sigue dibujando entero y el documento de la celda no cambia ni un byte. Lo único que cambia es que ese anclaje **deja de recibir casting**: ninguna aventura vuelve a mandarte allí. Eso es posible porque SPEC-009 dejó el casting fuera de lo que se congela y SPEC-005 dejó al pool sabiendo excluir por identificador; esta fila cierra ese gancho por el lado de la partida.

Y entrega la contrapartida, que es lo que evita que la salvaguarda se convierta en una manera de vaciar el mundo: **la alarma de estirón**. `game-design/parajes.md` fijó un suelo de parajes por debajo del cual no se pueden montar aventuras, derivado del vocabulario de escenas y congelado por celda; cuando los descartes dejan el mapa por debajo de ese suelo, el juego dice la verdad —«por aquí cerca ya no queda gran cosa que contar»— y ofrece alejarse un tramo más. Es un dato y no una acción: nada se amplía por devolverlo, y quien decide es quien juega.

Anclas: **RF-PRIV-004** (`docs/prd.md` §4.11). Las fuentes que mandan sobre el PRD son `game-design/seguridad-privacidad.md` §3 (el gesto, la reversibilidad, el filtro previo como primera línea y la alarma) y el artefacto 4 de `docs/pantallas/`, pantalla A4P8 del flujo. Consume **SPEC-005** (el identificador estable del anclaje, el pool y su `excluir`, y los roles consumidores), **SPEC-006** (el suelo de parajes derivado del vocabulario y el cupo congelado por celda), **SPEC-009** (el mundo congelado, y el hecho de que el casting **no** esté dentro de él), **SPEC-010** (`candidatosDeRol` y `casteaCatalogo`, que son donde el descarte entra), **SPEC-016** (el área `anclajes`, hoy declarada sin esquema, y el tipo de hecho `anclaje-descartado`, ya declarado esperando esta fila) y **SPEC-004** (el tramo, del que sale la unidad del estirón).

Y consume la **fila 33** (la ficha de texto, de la que cuelga el primer toque) y la **fila 38** (`repisa-ajustes`, dueña de la pantalla A6P6 donde vive «Sitios que marcaste»), **que no está en disco al escribir esta spec**: de ella aquí solo se consume que existe una pantalla de ajustes donde colgar la lista. Si la nombra de otra manera, manda ella y esto se ajusta por iteración.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí no la toca**: el descarte es estado de partida y no habla con nada de fuera; el día del hecho llega como argumento, igual que en SPEC-015 y SPEC-016.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el **filtro previo por tipos** —industrial, obras, propiedad privada y locales de adultos— que se aplica al generar (fila 5, RF-MUNDO-010), que es la primera línea y sigue siendo suya; la **ficha de texto** de la que cuelga el primer toque (fila 33, A4P7); la **composición de la pantalla de ajustes** con su lista de sitios marcados (fila 38, A6P6), de la que aquí solo se entrega el contenido y el comportamiento de deshacer; el **estirón** como mecanismo, que ya está entregado en `packages/nucleo/partida/aventuras.js` y aquí solo gana una causa nueva; el **suelo de parajes** y su derivación del vocabulario (fila 6), que aquí se consume tal cual; y **cualquier forma de reportar, agregar o compartir descartes**, que no es que esté fuera de alcance: está prohibida por RF-PRIV-004.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`, y los que reproducen un escenario ya escrito llevan su nombre literal. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Marcarlo lo saca del casting sin resembrar»; la **validación de entradas** en el identificador que no es de ningún sitio del mundo, el motivo fuera del vocabulario y el descarte del mismo sitio dos veces; el **estado vacío** en la partida sin ningún descarte y la lista de ajustes vacía; el **estado de error** en «Nada degrada por falta de cableado»; y los **casos límite** en el descarte que cruza el suelo de parajes, el descarte del único paraje del mundo mínimo, el descarte de un sitio que es beat de la aventura en curso y el deshacer que devuelve el reparto.

«Mundo de referencia» significa uno de los ocho extractos congelados de `test/fixtures/mundos-referencia/`.

### Marcarlo lo saca del casting sin resembrar

Reproduce el escenario homónimo de `docs/testing.md`.

- **Dado** un paraje anclado a una casa particular, **cuando** el jugador lo marca, **entonces** ninguna aventura vuelve a mandarlo allí.
- **Dado** ese mismo descarte, **cuando** se compara el documento de la celda antes y después, **entonces** el resto del mundo sigue idéntico byte a byte.
- **Dado** ese mismo descarte, **cuando** se mira el mapa, **entonces** el sitio sigue dibujado, con su nombre de fantasía y en su posición.
- **Dado** un sitio descartado, **cuando** se castea el catálogo entero, **entonces** no aparece como candidato de ningún rol de ninguna plantilla.
- **Dado** un sitio descartado que era **candidato pero no elegido** en el casting anterior, **cuando** se vuelve a castear, **entonces** el reparto puede cambiar y ninguna celda se ha regenerado: el casting no es parte del mundo congelado.
- **Dado** un identificador que no corresponde a ningún sitio del mundo, **cuando** se intenta descartar, **entonces** falla nombrando el identificador, y no anota un descarte que no afecta a nada.
- **Dado** un sitio ya descartado, **cuando** se descarta otra vez, **entonces** no cambia nada y no se anota un segundo hecho.
- **Dado** varios descartes en varios mapas de la misma partida, **cuando** se consultan los de un mapa, **entonces** solo salen los suyos: el descarte es del mapa y no de la partida.

### Es reversible

Reproduce el escenario homónimo de `docs/testing.md`.

- **Dado** un anclaje marcado, **cuando** el jugador lo desmarca desde los ajustes, **entonces** vuelve a estar disponible para el casting.
- **Dado** ese mismo deshacer, **cuando** se compara el reparto con el de antes del descarte y con la misma semilla, **entonces** es el mismo.
- **Dado** una partida con dos sitios marcados, **cuando** se abre la lista de ajustes, **entonces** están los dos, con su nombre de fantasía y con qué son en realidad.
- **Dado** un sitio marcado sin motivo, **cuando** aparece en la lista, **entonces** aparece igual que los demás y no se le pide motivo para deshacerlo.
- **Dado** un sitio deshecho, **cuando** se mira la lista, **entonces** ya no está, y el hecho del descarte sigue en el registro con su deshacer anotado detrás.

### No hace falta dar motivo, y los motivos son un vocabulario cerrado

Reproduce el escenario homónimo de `docs/testing.md`.

- **Dado** un jugador que marca un anclaje sin elegir motivo, **cuando** confirma, **entonces** se marca igual.
- **Dado** un motivo elegido, **cuando** se anota, **entonces** es uno de los cinco del vocabulario cerrado y ninguno más.
- **Dado** un motivo que no está en el vocabulario, **cuando** se intenta anotar, **entonces** falla nombrando el motivo y enumerando los válidos.
- **Dado** el motivo «otra cosa», **cuando** se anota, **entonces** no lleva ningún texto libre asociado: no hay campo donde escribir por qué.
- **Dado** cualquier descarte, con motivo o sin él, **cuando** se compara su efecto sobre el casting, **entonces** es el mismo: el motivo no cambia nada de lo que ocurre.

### No se reporta a ningún sitio

Reproduce el escenario homónimo de `docs/testing.md`. Bloqueante (`@privacidad`, RF-PRIV-004 y RNF-PRIV-001).

- **Dado** un anclaje marcado, **cuando** se inspecciona el tráfico saliente, **entonces** no sale ninguna petición relacionada.
- **Dado** una partida con descartes, **cuando** se recorre el código de esta fila, **entonces** no hay ninguna llamada al proxy, al almacén remoto ni a nada que salga del dispositivo.
- **Dado** el hecho de un descarte guardado, **cuando** se inspecciona, **entonces** lleva el identificador del sitio, el rol que ocupaba y el motivo si lo hubo, y ninguna coordenada.
- **Dado** una copia exportada de la partida, **cuando** se busca en ella, **entonces** los descartes están dentro —porque son de quien juega y viajan con su partida— y no hay ninguna otra copia en ningún sitio.

### La alarma de estirón, que salta exactamente al cruzar el suelo

Es lo que `seguridad-privacidad.md` §3 llama «alarma para el que vacíe el mapa», y usa el suelo de parajes de SPEC-006 sin redefinirlo.

- **Dado** un mundo de referencia con sus parajes y su suelo congelado, **cuando** se descartan parajes uno a uno, **entonces** la alarma no salta mientras los parajes vivos sean el suelo o más.
- **Dado** ese mismo mundo, **cuando** el descarte siguiente deja los parajes vivos por debajo del suelo, **entonces** la alarma salta en ese descarte y no en el anterior: el criterio se puede poner rojo por los dos lados.
- **Dado** la alarma saltada, **cuando** se lee lo que se ofrece, **entonces** es alejarse un tramo más, con el mismo mecanismo y el mismo número de tramos que el estirón que ya existe.
- **Dado** la alarma saltada y la oferta no aceptada, **cuando** se mira el alcance de la salida, **entonces** no ha cambiado: la oferta es un dato y no una acción.
- **Dado** la alarma saltada, **cuando** se deshace el último descarte, **entonces** la alarma deja de saltar.
- **Dado** un mundo por debajo del suelo por descartes, **cuando** se pide el reparto y ninguna aventura cabe, **entonces** el motivo declarado es el de los descartes y no el del mundo pequeño ni el del filtro.
- **Dado** ese mismo mundo, **cuando** se pide el reparto **ignorando los descartes** y alguna aventura cabía, **entonces** eso es lo que distingue el motivo de los descartes del motivo del mundo, exactamente como el filtro se distingue hoy del mundo pequeño.
- **Dado** un mundo que ya estaba por debajo del suelo **sin ningún descarte** —el barrio de tres calles—, **cuando** se pide el reparto, **entonces** el motivo sigue siendo el del mundo pequeño: no se le echa la culpa a quien juega de algo que ya pasaba.
- **Dado** el suelo de la celda, **cuando** se consulta, **entonces** es el que la celda congeló al generarse y no uno recalculado, que podría diferir si el vocabulario cambiara.

### El descarte no rompe lo que ya estaba en marcha

- **Dado** una aventura en curso con un beat en un sitio, **cuando** se descarta ese sitio, **entonces** la aventura en curso sigue con su cadena intacta y su beat se puede resolver.
- **Dado** ese mismo caso, **cuando** termina la salida y se vuelve a repartir, **entonces** ninguna aventura nueva usa ese sitio.
- **Dado** un núcleo descartado, **cuando** se consulta lo que allí se cuenta y el rango que se tiene en él, **entonces** siguen existiendo: el descarte saca del casting, no borra el pueblo.
- **Dado** un sitio descartado, **cuando** avanza el reloj del mundo, **entonces** los rumores siguen viajando por las calzadas como antes: el árbol de propagación no cambia.
- **Dado** un sitio que es el punto de partida del mapa, **cuando** se intenta descartar, **entonces** falla nombrándolo, en lugar de dejar la partida sin sitio desde el que salir.

### Nada degrada por falta de cableado

Aplicación directa de `pipeline/decisiones-orquestador.md` §6h.

- **Dado** el reparto de aventuras sin los descartes cableados, **cuando** se construye, **entonces** falla nombrando la pieza que falta, y no reparte como si no hubiera ninguno.
- **Dado** el casting sin los descartes cableados, **cuando** se castea, **entonces** falla nombrando la pieza, y no devuelve candidatos ya descartados.
- **Dado** el comprobador del suelo sin el cupo de la celda cableado, **cuando** se ejecuta, **entonces** falla nombrando el cupo, y no da el suelo por cero.
- **Dado** el área `anclajes` del estado, **cuando** se consultan las áreas que no reproducen, **entonces** ya no está entre ellas: sus hechos se reproducen.
- **Dado** una partida con descartes, **cuando** se congela y se vuelve a levantar, **entonces** vuelven todos, en el mismo orden. (Bloqueante con RF-PERS-001.)
- **Dado** una partida con descartes, **cuando** se reconstruye desde el registro de hechos, **entonces** salen los mismos descartes que había.

## UX Design

### Wireframe textual

**El sitio que no pega — A4P8.** Capa por encima de la ficha de texto, no pantalla nueva: se llega desde la acción discreta «Este sitio no pega» de A4P7, y cerrarla devuelve a la ficha con todo como estaba. De arriba abajo:

- El **nombre de fantasía del sitio** en serif, en la parte alta, para que no haya duda de cuál se va a marcar.
- La **pregunta** en serif grande —«¿Qué le pasa a este sitio?»—.
- La **línea que quita la obligación**, en serif normal —«No hace falta que digas por qué. Con marcarlo, el juego deja de mandarte aquí.»—. Va **antes** de los motivos y no después: es lo que convierte la lista en una ayuda en lugar de en un formulario.
- Los **cinco motivos** como opciones de un solo toque, en una columna, en este orden literal: **«Es una casa particular» · «No se puede llegar a pie» · «No es sitio para pararse» · «Ya no existe» · «Otra cosa»**. Ninguna viene marcada, tocar una la marca y volver a tocarla la desmarca, y no hay campo de texto en ninguna.
- La **línea de reversibilidad** —«Se puede deshacer cuando quieras.»—.
- Abajo, ocupando el ancho, **«Marcarlo»**, que es el segundo y último toque del gesto. No hay diálogo de confirmación detrás.

**Sitios que marcaste — dentro de A6P6.** En el bloque «Tus cosas» de los ajustes, una fila con la etiqueta **«Sitios que marcaste»** y **el número** a la derecha. Es de la fila 38 y aquí solo se declara qué contiene al abrirla: una lista de filas, una por sitio, cada una con su **nombre de fantasía** en serif y debajo, en pequeño, **qué es en realidad**; y en cada fila una acción de deshacer con el texto **«Que vuelva a contar»**. Sin motivo, sin fecha, sin agrupación y sin buscador. Con cero sitios marcados, la fila de ajustes enseña el número cero y la lista dice, en registro de aplicación como todo lo de ajustes, que no hay ninguno.

**La alarma de estirón.** No tiene pantalla propia: **es la misma que ya existe** cuando el mundo no da para un lazo, aparece donde aparece el reparto (fila 28, A2P3) y dice lo mismo —que por aquí cerca ya no queda gran cosa que contar, y si te alejas un poco—. Lo que esta fila añade no es una pantalla: es una causa más para que aparezca, y la garantía de que el texto **no menciona los descartes** ni insinúa que quien juega se haya pasado marcando sitios.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec entrega:
  A4P8  pantalla 8 · artefacto 4 — El sitio que no pega

Pantallas que alimenta por debajo, sin ser su dueña:
  A4P7  pantalla 7 · artefacto 4 — La ficha de texto   (dueña: fila 33)
  A6P6  pantalla 6 · artefacto 6 — Los ajustes         (dueña: fila 38)
  A2P3  pantalla 3 · artefacto 2 — Lo que hay hoy      (dueña: fila 28)

Elementos del proyecto que se usan: la capa modal del artefacto 4, la tipografía
serif de la voz del mundo, la sans de los ajustes, la oferta de estirón ya
entregada en la fila 4.

Sin elementos nuevos.
```

### data-testid

- `descarte-anclaje` — la capa entera de A4P8
- `descarte-motivo` — cada opción de motivo, distinguidas por el identificador del vocabulario
- `descarte-confirmar` — la acción «Marcarlo», el segundo toque
- `sitios-marcados` — la fila de ajustes con su número, y la lista al abrirla
- `sitio-marcado-deshacer` — la acción de deshacer de cada fila
- `estiron-oferta` — la oferta de alejarse, que esta fila hace aparecer por una causa nueva

Sin más: el nombre de fantasía, la pregunta, la línea de «no hace falta que digas por qué» y la de reversibilidad son texto único y se localizan por su contenido. La acción «Este sitio no pega» de A4P7 es de la fila 33 y se localiza por su texto.

### Patrón de interacción

- **Dos toques y ninguno más, y el segundo es el que escribe.** Regla: `seguridad-privacidad.md` §3, «un gesto de dos toques»; `design-system.md`, ningún control de más. Un diálogo de confirmación detrás de «Marcarlo» haría tres toques y convertiría en trámite algo que tiene que costar menos que ignorarlo.
- **Los motivos son opcionales y van antes de la acción, no después.** Regla: `seguridad-privacidad.md` §3, «sin que nadie tenga que explicar por qué»; ponerlos como paso previo obligatorio o como pregunta posterior los convertiría en rendición de cuentas, que es exactamente lo que la decisión evita.
- **Ningún motivo lleva texto libre, ni siquiera «Otra cosa».** Regla: RF-PRIV-004, sin reporte a ningún sitio, y `seguridad-privacidad.md` §1; un campo libre invita a escribir datos de personas reales del barrio dentro de la partida, y ese texto acabaría en la copia exportable.
- **Deshacer vive en ajustes y no en el sitio.** Regla: `seguridad-privacidad.md` §3 y el artefacto 6; deshacerlo desde el sitio obligaría a volver a andar hasta allí, que es el único coste que este juego no puede cobrar por un cambio de opinión.
- **El descarte no dice gracias ni confirma nada.** Regla: `design-system.md`, dentro del juego cualquier cosa que solo se pueda decir como aplicación es señal de rediseñar el momento. Al marcar, la capa se cierra y se vuelve a la ficha; que la acción ya no esté disponible es toda la confirmación que hace falta.
- **La alarma no nombra los descartes.** Regla: `design-system.md`, ninguna racha, ningún reproche; y `bucle-jugable.md` §7, el estirón se ofrece y nunca se impone. Decir «has marcado demasiados sitios» sería un reproche con datos, que es la peor clase.
- **Decisión no cubierta por el design system:** si se puede elegir más de un motivo. Se resuelve con **uno como mucho**, porque los motivos no se usan para nada mecánico y una selección múltiple pediría precisión sobre algo que la decisión declaró voluntario.
- **Decisión no cubierta por el design system:** qué hace la capa si se cierra sin pulsar «Marcarlo» habiendo elegido un motivo. Se resuelve **descartando la elección y no marcando nada**, porque el que escribe es el segundo toque y guardar la intención a medias sería marcar sin haberlo dicho.

## Notas técnicas

### Dónde entra el descarte, y por qué ahí

El descarte **no entra en la generación**: entra en el **casting**, que es lo que hace cierto «anota sin resembrar». Los anclajes descartados salen de los candidatos de rol de la misma manera que los criterios de caminos evitados entran al trazar el lazo y en ningún otro sitio: la marca es de quien juega, el mundo es del generador, y la separación es la que hace compatible «el mundo entero existe» con «lo generado no se resiembra». SPEC-009 dejó el casting fuera del documento congelado, así que volver a castear con un descarte más es barato y no toca nada del mundo.

El `excluir` del pool que SPEC-005 dejó puesto sigue siendo suyo y se queda donde está: aquello actúa **mientras la celda se genera**, y esto actúa **después de que la celda esté congelada**. Son dos momentos y no se unifican, porque unificarlos obligaría a reabrir el pool de una celda ya cerrada.

### El área `anclajes` y su hecho

SPEC-016 declaró el área `anclajes` sin esquema y el tipo de hecho `anclaje-descartado` con su carga —el anclaje, el rol que ocupaba y el motivo, los dos últimos opcionales—, precisamente para que sus hechos entraran en el registro desde antes de que existiera esta fila. Aquí se le pone estado: por mapa, la lista de identificadores descartados con su motivo, en orden estable; se congela y se levanta con el mismo lenguaje de esquema de SPEC-009, y **se reproduce** desde sus hechos, así que deja de estar entre las áreas que no reproducen. Deshacer es una transición más y no un borrado del registro: el hecho del descarte se queda y se le anota el deshacer detrás, porque el registro es la bitácora de lo que pasó y no el estado.

### El motivo nuevo de falta de reparto

`packages/nucleo/partida/filtro.js` declara hoy tres motivos —el filtro, el mundo pequeño y la falta de viario— y `aventuras.js` los reexporta en lugar de copiarlos, con el comentario de que dos catálogos acabarían diciendo cosas distintas. Esta fila añade **uno**, el de los descartes, en ese mismo sitio y con la misma regla de atribución que ya distingue el filtro del mundo pequeño: se atribuye a los descartes solo si **sin ellos** había reparto. Sin esa regla, un barrio de tres calles que nunca dio para un lazo empezaría a echarle la culpa a quien juega, que es la mentira que el motivo del mundo existe para no contar.

### El suelo, que se lee y no se recalcula

El suelo de parajes lo derivó SPEC-006 del vocabulario de escenas y lo congeló en el cupo de la celda. Aquí se **lee de la celda**, no se vuelve a calcular: si algún día el vocabulario crece, un mundo viejo seguiría comparándose contra el suelo con el que se generó, que es lo coherente con que su cupo se calculara una vez. Recalcularlo haría que un mapa antiguo cruzara la alarma sin que nadie hubiera descartado nada.

## Decisiones asumidas

- **El descarte entra en el casting y no en el pool ni en la generación** → asumido (alternativa: reabrir el pool de la celda y volver a repartir anclajes). Regla: `bucle-jugable.md` §5, lo ya generado no se resiembra jamás, y el escenario «el resto del mundo sigue idéntico byte a byte»; reabrir el pool es resembrar con otro nombre.
- **Los motivos son un vocabulario cerrado de cinco, los cinco de la pantalla dibujada** → asumido (alternativa: dejarlos abiertos o permitir texto). Regla: el artefacto 4 los dibuja literales, y `seguridad-privacidad.md` §1 impide guardar texto libre que pueda hablar de personas reales.
- **Se puede elegir un motivo como mucho, y ninguno es obligatorio** → asumido (alternativa: selección múltiple). Regla: los motivos no alimentan ninguna mecánica —el criterio lo afirma— así que pedir más precisión sería pedirla para nada.
- **Deshacer conserva el hecho del descarte en el registro y anota el deshacer detrás** → asumido (alternativa: borrar el hecho). Regla: SPEC-016, el registro es la bitácora y manda el estado sobre él; borrar hechos rompería la reconstrucción y además es la única operación que el registro no tiene.
- **La alarma se comprueba contra el suelo de parajes y no contra «no hay reparto»** → asumido (alternativa: hacerla saltar solo cuando ninguna aventura cabe). Regla: `seguridad-privacidad.md` §3 nombra el suelo explícitamente, y §6o del orquestador: «ninguna aventura cabe» es una condición que en un mundo grande no se cumple nunca, así que no mediría nada; el suelo sí se cruza en un descarte concreto y se puede poner rojo por los dos lados.
- **El punto de partida del mapa no se puede descartar** → asumido (alternativa: permitirlo). Regla: `bucle-jugable.md` §8, la salida se cierra al volver al punto de partida; descartarlo dejaría el telón sin condición de cierre, y el descarte no puede romper el bucle.
- **Descartar un sitio no toca la aventura en curso** → asumido (alternativa: recalcular su lazo o cerrarla en corto). Regla: `quests.md` decisión 4 y `bucle-jugable.md` §9, la aventura vive y muere en su salida y el juego no recalcula nada por su cuenta; y un descarte que deshiciera lo que ya estabas haciendo enseñaría a no usarlo.
- **Los descartes viajan dentro de la copia exportable de la partida** → asumido (alternativa: dejarlos fuera por prudencia). Regla: RF-PRIV-004 prohíbe reportarlos a un sitio, no guardarlos; son de quien juega, y sacarlos de la copia haría que restaurar una partida devolviera al jugador a la casa de alguien.
