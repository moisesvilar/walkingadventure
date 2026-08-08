# SPEC-021 — El render en Skia y los cinco estilos como datos

## Descripción

Traslada el pintado del mapa desde el canvas del prototipo a Skia dentro de la app, conservando lo único que hace que ese pintado sea mantenible: **ningún color, ningún grosor y ninguna tipografía viven en el código de dibujo**. Los cinco estilos —Reino, Clásico, Pergamino, Cuento, Atlas— siguen siendo objetos de datos fusionados sobre unos valores por defecto, Reino sigue siendo el de por defecto, y añadir un sexto estilo sigue siendo añadir un objeto y nada más.

Lo que el jugador ve es la lámina: su barrio con otra ropa, pintado a mano, que es el producto visible del proyecto. Lo que el jugador puede hacer con ella, aquí, es una sola cosa: cambiar cómo se pinta desde los ajustes, y que el mapa se repinte **sin que el mundo se mueva ni un milímetro**. Ese es el criterio que manda sobre todos los demás de esta spec, y ya tiene escenario en la batería.

Anclas: **RF-MAPA-001** y **RF-MAPA-002** (`docs/prd.md` §4.9), con **RNF-PER-003** (§5.5) como restricción, y `game-design/arquitectura.md` decisión 1 y su lista «Lo que esto obliga a hacer» como fuente que manda sobre el PRD. La fuente del pintado concreto es el prototipo vivo: `app/js/render/map.js` y `app/js/render/styles.js`. Consume el documento de celda de SPEC-009 y se apoya en el andamiaje de SPEC-001 —los ocho extractos de `test/fixtures/mundos-referencia/`— como corpus de revisión. Se subordina al reparto de ficheros y a la configuración de Expo que fije SPEC-020.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí aparecen dos entradas nuevas**, las dos inyectadas y las dos con doble en Node: el **medidor de texto** y el **colocador de rótulos**. Están descritas en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el algoritmo que impide que dos rótulos se solapen (fila 22, RF-MAPA-003), del que aquí solo se entrega el hueco donde encaja y un colocador provisional que sí puede solapar; los gestos de arrastre y zoom y la pantalla que los recoge (filas 26 y 29); la marca de posición del jugador y los avisos sobre el mapa (fila 29, RF-MAPA-005); las tres tintas y el entintado al telón (fila 36, RF-MAPA-004), del que aquí solo se reserva el rol en el plan de capas; la pantalla de ajustes donde vive la fila «Cómo se pinta» y el ajuste de tamaño de letra (fila 38); las ilustraciones y las fotos del lado real (fila 25); y la generación de mundos, que aquí no se ejecuta nunca —el render pinta lo congelado.

## Criterios de aceptación

Los criterios van en Gherkin español, el mismo `Dado / Cuando / Entonces` de `docs/testing.md`, por el precedente de SPEC-001 a SPEC-016. Las cinco categorías obligatorias quedan repartidas así: el camino feliz en «Componer y pintar», «Los cinco estilos» y «Repintar no resiembra»; la validación de entradas en «Lo que el dibujo no puede contener» y en el estilo desconocido; el estado vacío en «Mundos a los que les falta casi todo»; el estado de error en «Cuando algo falta o no cabe»; y los casos límite en «Los bordes de la lámina» y en el presupuesto de fluidez.

«Mundo de referencia X» significa uno de los ocho extractos congelados de `test/fixtures/mundos-referencia/` que entregaron SPEC-001 y SPEC-002. «Escena» significa siempre el resultado de componer un mundo con un estilo: la lista ordenada de primitivas de dibujo con su pintura ya resuelta. «Lámina» es lo que se ve.

### Componer y pintar

- **Dado** un documento de celda y un estilo, **cuando** se compone la escena, **entonces** se obtiene una lista ordenada de primitivas en la que cada una lleva ya resuelto su color, su grosor y su tipografía.
- **Dado** una escena compuesta, **cuando** se pinta en Skia, **entonces** el módulo que ejecuta el dibujo no consulta el estilo ni una sola vez.
- **Dado** un documento de celda, **cuando** se compone la escena dos veces con el mismo estilo, el mismo tamaño y la misma vista, **entonces** las dos escenas son idénticas primitiva a primitiva.
- **Dado** un documento de celda, **cuando** se compone la escena, **entonces** el azar que usa —grano del papel, siembra de árboles, zarza del marco— sale de `makeRng(semilla + ':render')` y de ninguna otra fuente.
- **Dado** un documento de celda, **cuando** se compone la escena, **entonces** no se ejecuta ninguna fase de generación ni se llama a ninguna fuente de datos.
- **Dado** el módulo que compone la escena, **cuando** se inspeccionan sus importaciones, **entonces** no importa nada de React Native ni de Skia, y corre en Node.
- **Dado** un documento de celda, **cuando** se compone la escena, **entonces** el orden de las capas es el declarado en «El plan de capas» y ninguna capa se pinta antes de la que la precede.
- **Dado** una escena compuesta, **cuando** se pinta, **entonces** sobre el agua no queda pintado ningún árbol ni ningún pico.
- **Dado** un mundo con norte, **cuando** se pinta con cualquier estilo y cualquier vista, **entonces** el norte queda arriba y no existe ninguna manera de rotar la lámina.

### Lo que el dibujo no puede contener

- **Dado** el módulo que ejecuta el dibujo, **cuando** se busca en su código un literal de color —`#rrggbb`, `rgb(`, `rgba(`, un nombre de color—, **entonces** no aparece ninguno.
- **Dado** el módulo que ejecuta el dibujo, **cuando** se busca un grosor de trazo, un tamaño de tipografía o un nombre de familia tipográfica escritos a mano, **entonces** no aparece ninguno.
- **Dado** el módulo que ejecuta el dibujo, **cuando** se busca una decisión de qué capa se pinta y cuál no, **entonces** no aparece ninguna: la decisión sale del grupo `capas` del estilo.
- **Dado** el módulo que compone la escena, **cuando** se busca en él el identificador de un estilo concreto —`'reino'`, `'atlas'`—, **entonces** no aparece ninguno.

### Los cinco estilos

- **Dado** el catálogo de estilos, **cuando** se enumera, **entonces** tiene exactamente cinco entradas y son Reino, Clásico, Pergamino, Cuento y Atlas.
- **Dado** el catálogo de estilos, **cuando** se pide el estilo por defecto, **entonces** es Reino.
- **Dado** cualquiera de los cinco estilos, **cuando** se resuelve, **entonces** su objeto es idéntico clave a clave al que produce `app/js/render/styles.js` para el mismo identificador.
- **Dado** un estilo que solo declara lo que lo distingue, **cuando** se resuelve, **entonces** todas las claves que no declara le llegan de los valores por defecto.
- **Dado** un estilo, **cuando** se lee su nombre visible, **entonces** sale de `title` y nunca de `label`, que es la tipografía de los rótulos.
- **Dado** un estilo cuyo grupo `capas` apaga bosques, picos, carreteras, lagos y rótulos de camino, **cuando** se compone la escena, **entonces** la escena no contiene ni una primitiva de esas capas y el código que las dibuja sigue existiendo para los demás estilos.
- **Dado** Reino, **cuando** se compone la escena de un mundo con bosques y picos, **entonces** no aparece ni un árbol ni un pico, porque es el mapa base y no el mapa ilustrado.
- **Dado** un estilo nuevo declarado **solo** como objeto de datos y añadido al catálogo, **cuando** se compone la escena con él, **entonces** se pinta sin haber tocado el módulo de dibujo ni el que compone la escena.
- **Dado** un estilo nuevo, **cuando** se abre el selector de estilos, **entonces** aparece con su `title`, porque el selector se construye desde el catálogo.
- **Dado** un estilo que declara `label.placa` con el rol `nucleo`, **cuando** se compone la escena, **entonces** los rótulos de núcleo llevan caja de pergamino y los de paraje se resuelven con halo.
- **Dado** un estilo que declara `label.placa` vacía, **cuando** se compone la escena, **entonces** ningún rótulo lleva caja.
- **Dado** Clásico, **cuando** se compone la escena, **entonces** el área pintada es un disco; **dado** Atlas, es un rectángulo a sangre sin marco.

### Repintar no resiembra

- **Dado** un mundo generado y pintado en estilo Reino, **cuando** se cambia el estilo a Pergamino, **entonces** el documento de celda sigue idéntico byte a byte.
- **Dado** un mundo pintado, **cuando** se cambia el estilo, **entonces** el documento que recibe el render es el mismo, no una copia levantada otra vez del almacén.
- **Dado** un mundo pintado, **cuando** se cambia el estilo, **entonces** solo cambian los colores, los grosores y las tipografías, y la geometría de cada primitiva es la misma.
- **Dado** un mundo pintado, **cuando** se cambia el estilo, **entonces** no se ejecuta ninguna fase de generación ni se pide nada a la red.
- **Dado** un mundo pintado en Reino, **cuando** se cambia a Atlas y se vuelve a Reino, **entonces** la escena es idéntica a la primera, primitiva a primitiva.
- **Dado** un jugador con un estilo elegido, **cuando** cierra y vuelve a abrir la app, **entonces** el mapa aparece con ese estilo y no con el de por defecto.

### Los rótulos llegan colocados

- **Dado** el módulo que ejecuta el dibujo, **cuando** se busca en él un cálculo de posición de rótulo, **entonces** no aparece ninguno: cada rótulo llega con su posición, su tamaño y su caja resueltos.
- **Dado** una escena, **cuando** se recorren sus primitivas, **entonces** todos los rótulos están en una única pasada posterior a toda la geometría.
- **Dado** un colocador que devuelve dos rótulos con cajas que se solapan, **cuando** se pinta, **entonces** los dos se pintan donde el colocador dijo y el render no mueve ninguno.
- **Dado** el colocador provisional que entrega esta spec, **cuando** coloca los rótulos de un mundo de paseo real, **entonces** los pone en el anclaje de cada elemento, como el prototipo, y puede solaparlos.
- **Dado** otro colocador inyectado en su lugar, **cuando** se compone la escena, **entonces** cambian las posiciones de los rótulos y no cambia ni un color, ni un grosor, ni una tipografía.
- **Dado** un colocador, **cuando** se le pide colocar, **entonces** recibe todos los rótulos del mapa a la vez, con su rol, su texto, su anclaje y la medida de su caja, y devuelve todas las posiciones antes de que se pinte nada.
- **Dado** un factor de tamaño de letra distinto del normal, **cuando** se compone la escena, **entonces** las cajas medidas y las posiciones colocadas lo tienen en cuenta, y el objeto de estilo no se modifica.

### Las tipografías

- **Dado** la app arrancada sin red, **cuando** se pinta cualquiera de los cinco estilos, **entonces** sus tipografías están disponibles porque viajan con la app y no se piden a ningún servidor.
- **Dado** una tipografía que todavía no está cargada, **cuando** se va a pintar, **entonces** el mapa espera a tenerla y no pinta con una sustituta.
- **Dado** un estilo, **cuando** se pregunta qué tipografías necesita, **entonces** las declara el propio objeto de estilo.

### Mundos a los que les falta casi todo

- **Dado** un mundo sin costa —sin máscara de mar—, **cuando** se pinta, **entonces** se ve el papel del estilo y no falla nada.
- **Dado** un mundo sin parajes, **cuando** se pinta, **entonces** la lámina se pinta entera sin ningún hueco ni ningún marcador vacío.
- **Dado** un mundo sin bosques, sin picos, sin lagos y sin ríos, **cuando** se pinta con Cuento, **entonces** se pinta el terreno base y ninguna capa protesta.
- **Dado** el mundo de referencia `suelo-250m`, que es el más pobre de los ocho, **cuando** se pinta con los cinco estilos, **entonces** los cinco producen una lámina y ninguno falla.
- **Dado** un mundo con un solo núcleo, **cuando** se pinta, **entonces** aparece su rótulo y la lámina no queda en blanco.

### Cuando algo falta o no cabe

- **Dado** un identificador de estilo que no existe en el catálogo, **cuando** se pide pintar con él, **entonces** se pinta con Reino y el resultado declara que hubo sustitución, en lugar de fallar.
- **Dado** una partida guardada con un estilo que ya no existe, **cuando** se abre el mapa, **entonces** se abre en Reino y la partida no se corrompe.
- **Dado** un documento de celda al que le falta un campo que una capa necesita, **cuando** se compone la escena, **entonces** falla nombrando el campo y la capa, en lugar de pintar media lámina.
- **Dado** una superficie de ancho o alto cero, **cuando** se pide pintar, **entonces** no se pinta nada y no falla.
- **Dado** un colocador que devuelve menos rótulos de los que se le dieron, **cuando** se compone la escena, **entonces** falla nombrando los que faltan.
- **Dado** un medidor de texto que no sabe medir una tipografía, **cuando** se compone la escena, **entonces** falla nombrando la tipografía, en lugar de colocar con una medida inventada.

### Los bordes de la lámina

- **Dado** una vista cuyo radio es mayor que el mundo entero, **cuando** se pinta, **entonces** se ve el mundo completo rodeado del color de fuera del área, sin estirarlo.
- **Dado** una vista muy cerrada sobre un núcleo, **cuando** se pinta, **entonces** las capas que quedan fuera del recorte no se pintan y los rótulos de lo que sí se ve siguen apareciendo.
- **Dado** un rótulo cuyo texto es más largo que el ancho de la lámina, **cuando** se pinta, **entonces** se pinta y no desborda por los dos lados a la vez.
- **Dado** un mundo de una celda costera, **cuando** se pinta con Reino, **entonces** la tierra tapa el papel y el mar sale de la máscara.
- **Dado** la superficie girada de vertical a apaisada, **cuando** se repinta, **entonces** el mundo pintado es el mismo y solo cambia el encuadre.

### La fluidez, que se mide

- **Dado** un mundo de referencia y una superficie del tamaño de la pantalla, **cuando** se pinta por primera vez, **entonces** la lámina completa aparece en menos de 500 ms.
- **Dado** una lámina ya pintada, **cuando** el jugador arrastra o hace zoom, **entonces** la geometría del terreno no se vuelve a componer: la cámara se mueve sobre la escena que ya existe.
- **Dado** una lámina ya pintada, **cuando** el jugador arrastra, **entonces** ningún rótulo se recoloca hasta que el gesto termina.
- **Dado** un arrastre y un zoom encadenados sobre un mundo de referencia, **cuando** se mide el gasto por fotograma, **entonces** ninguno pasa de 32 ms.
- **Dado** un mundo de referencia, **cuando** se compone su escena, **entonces** el número de primitivas queda por debajo del tope declarado en «El presupuesto de fluidez».

### La paridad visual, que se revisa a mano

- **Dado** los cinco estilos portados, **cuando** se compara su objeto resuelto con el del prototipo, **entonces** no hay ninguna diferencia. *(Esto sí es automático: es paridad de datos.)*
- **Dado** los ocho mundos de referencia y los cinco estilos, **cuando** se recorre la ficha de revisión de «El protocolo de revisión de paridad visual», **entonces** los cuarenta pares quedan con todos sus ítems en verde.
- **Dado** un ítem de la ficha en rojo, **cuando** se cierra la revisión, **entonces** queda anotado con su captura y la fila no se da por terminada.

## UX Design

### Wireframe textual

Esta spec no dibuja ninguna pantalla nueva del juego: entrega **la lámina** que las pantallas ya dibujadas enseñan, y una pantalla de revisión que solo existe en la build de desarrollo.

**La lámina (el elemento, no una pantalla).** Ocupa entero el hueco que le da la pantalla anfitriona, a sangre, sin ningún control encima. De fuera hacia dentro:

- **Fuera del área**, el color `outside` del estilo. En Atlas el margen es cero y no se ve; en Clásico el área es un disco y el color de fuera ocupa las cuatro esquinas.
- **El área pintada**, recortada a rectángulo o a disco según `shape`, con el margen del estilo. Dentro va el terreno, en el orden del plan de capas.
- **El marco**, según `frame`: ornamentado y dorado en Reino, doble filete en Pergamino, zarza en flor en Cuento, ninguno en Atlas, aro de disco en Clásico.
- **La brújula**, en la esquina que diga `compass.corner` —sudeste en Reino, sudoeste en Pergamino y Cuento, noroeste en Atlas—, con norte arriba siempre. En Atlas va detrás del terreno, en tenue y a gran tamaño.
- **La cartela** con el título del mundo, arriba o abajo según `cartouche.pos`, en la tipografía del estilo. Lleva el nombre del mundo —«As Terras de Vilanova»— o el del núcleo o paraje enfocado. Nunca una cifra.
- **La barra de escala**: existe en el estilo y **está apagada en todas las pantallas del juego**. Solo se enciende en la pantalla de revisión.
- **Sin leyenda**, en ninguna capa y con ningún estilo.

**Los rótulos.** Una sola pasada, después de toda la geometría. Dos resoluciones, y la decide el estilo: **placa** —caja de pergamino con filete y sombra, la misma cartela del título en pequeño— para los roles que liste `label.placa`, y **halo** para el resto. En Reino eso son núcleos sobre placa y parajes con halo, que es lo que distingue un pueblo de un paraje sin leer el nombre. Tamaños por rol antes de la escala tipográfica del estilo: ciudad 25, pueblo 19, aldea 15, granja 12, servicio 18, ruta 16, paraje 13.

**Dónde aparece la lámina** (las pantallas son de otras filas; aquí solo se declara qué les entrega el render):

- **pantalla 6 · artefacto 1**, «Tu mapa, el día uno»: la lámina entera, estilo Reino, con los núcleos rotulados sobre placa y los sitios pequeños como bultos sin rótulo.
- **pantalla 1 · artefacto 6**, la portada: la lámina como fondo de la casa, sin barra encima.
- **pantalla 2 · artefacto 3**, «Si miras»: la lámina a pantalla completa, sin nada tocable.
- **pantalla 1 · artefacto 5**, «El mapa se entinta»: la lámina, con el entintado que entrega la fila 36.
- **pantalla 6 · artefacto 6**, los ajustes: la fila **«Cómo se pinta»** dentro del grupo **«El mapa»**, con el `title` del estilo actual —«Reino»— como valor a la derecha. Al tocarla se elige entre los cinco. La pantalla es de la fila 38; lo que esta spec le entrega es el catálogo con sus nombres y el repintado.

**La pantalla de revisión (solo build de desarrollo).** Una lista arriba con los ocho mundos de referencia por su nombre de fichero; debajo, los cinco estilos por su `title`; debajo, la lámina ocupando el resto, con la barra de escala encendida. No está en `docs/flujo.md` ni en `docs/pantallas/` porque no es una pantalla del juego, y no se compila en la build de tienda. Existe por dos motivos concretos: es donde se hace la revisión de paridad visual, y es el equivalente de los hooks `__wa.style()` y `__wa.demo()` que el prototipo tiene en consola.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que consumen la lámina:
  A1P6 (pantalla 6 · artefacto 1) — Tu mapa, el día uno
  A6P1 (pantalla 1 · artefacto 6) — La portada, sin barra
  A3P2 (pantalla 2 · artefacto 3) — Si miras
  A5P1 (pantalla 1 · artefacto 5) — El mapa se entinta
  A6P6 (pantalla 6 · artefacto 6) — Los ajustes, fila «Cómo se pinta»

Elementos del proyecto que esta spec entrega:
  la lámina, el marco, la brújula, la cartela, la placa de rótulo, el halo de rótulo,
  la barra de escala (apagada en juego), el glifo de núcleo, el glifo de paraje

Elementos que la lámina NO lleva y que son de otras filas:
  la marca de tu posición (fila 29) · las tres tintas y su entintado (fila 36)
  los bultos sin rótulo de lo no sabido (fila 36) · el lazo de la aventura (filas 28 y 29)

Pantalla nueva, solo en build de desarrollo:
  la pantalla de revisión del render
```

### data-testid

Pocos y estables: el estado del momento y el mapa son los dos que la batería no puede esquivar, y el primero es de las filas 28 y 29 —aquí no se define, se consume.

- `mapa` — la superficie donde se pinta la lámina.
- `mapa-listo` — se marca cuando la escena está pintada entera; es lo que evita afirmar sobre una lámina a medias.
- `mapa-estilo` — el identificador del estilo con el que está pintado ahora mismo (`reino`, `pergamino`…).
- `mapa-mundo` — el identificador del documento de celda pintado; es lo que permite afirmar que cambiar de estilo **no** lo ha cambiado.
- `mapa-rotulo` — cada rótulo pintado, con su rol y su texto; lo consume la fila 22 para afirmar que ninguna caja pisa a otra.
- `revision-render` — la pantalla de revisión.
- `revision-render-mundo` — el selector de mundo de referencia.
- `revision-render-estilo` — el selector de estilo.

`momento` no se define aquí. `ajustes-como-se-pinta` tampoco: es de la fila 38.

### Patrón de interacción

- **El mapa no lleva ni un control encima.** Regla del design system, tabla de momentos: en marcha nada tocable, y la portada dejó de llevar barra precisamente para que el mapa quedara limpio. La lámina es un elemento pasivo: no tiene botones, ni leyenda, ni control de estilo dentro.
- **El estilo se cambia desde los ajustes y en ningún otro sitio.** Regla del design system, los dos registros: los ajustes son el único lugar donde se habla como aplicación, y un selector de estilo flotando sobre el mapa metería voz de aplicación dentro del mundo. Al elegir se aplica y se vuelve; sin confirmación, sin Toast y sin previsualización a pantalla partida.
- **Repintar aparece hecho, sin transición.** Decisión no cubierta por el design system: cómo se ve el cambio de estilo. Se resuelve **sin animación** porque un fundido entre dos láminas sugiere que algo ha cambiado en el mundo, y es justo lo contrario de lo que este cambio significa.
- **Norte siempre arriba, sin gesto de rotar.** Escenario «El norte está siempre arriba» de la batería, y `bucle-jugable.md`: la lámina es una lámina, no un mapa de navegación que gira.
- **La barra de escala se queda apagada en el juego.** Regla del design system, «Qué NO lleva ninguna pantalla»: ninguna cifra de distancia. Una barra que dice «500 m» es una cifra de distancia, y el escenario «No se enseña ninguna cifra de esfuerzo» la alcanzaría. Se conserva en el estilo y se enciende solo en la pantalla de revisión, que no es del juego.
- **Sin leyenda, en ninguna capa.** La misma regla que RF-MAPA-004 fija para las tintas se aplica al resto: lo que hay que explicar con una leyenda está mal dibujado.
- **El tamaño de letra del mapa sale del ajuste de la fila 38**, con «mediana» valiendo 1. Regla del design system, accesibilidad: tamaño de letra ajustable a mano donde haya texto largo, y el modo compañía son dos personas leyendo del mismo móvil. El factor multiplica al colocar y al medir; el objeto de estilo no se toca, para que la paleta y los grosores no dependan de un ajuste.
- **Los gestos no se definen aquí.** La lámina expone una cámara —centro, radio, tamaño— y quién la mueve es de las filas 26 y 29. Lo que sí es de aquí es que moverla no recomponga el terreno.

## Notas técnicas

### Reparto de rutas

Propuesta, subordinada al reparto que fije SPEC-020. Lo que no es negociable es la separación en tres, porque es de donde sale la mitad de los criterios de esta spec:

| Fichero | Qué lleva | Plataforma |
| --- | --- | --- |
| `app/render/estilos.js` | los valores por defecto, la fusión de dos niveles, los cinco objetos, el catálogo, el estilo por defecto y las tipografías que cada uno necesita | ninguna: corre en Node |
| `app/render/escena.js` | el plan de capas y la composición: de documento de celda + estilo + vista a lista de primitivas con la pintura resuelta | ninguna: corre en Node |
| `app/render/skia.js` | ejecutar una escena sobre una superficie de Skia | la única que toca Skia |
| `app/render/colocador-simple.js` | el colocador provisional: cada rótulo en su anclaje | ninguna |
| `app/render/medidor-skia.js` | medir texto con Skia | la única que mide de verdad |
| `app/pantallas/revision-render.jsx` | la pantalla de revisión, solo en build de desarrollo | app |

Los dos primeros no importan nada de React Native ni de Skia, y eso tiene criterio propio: es lo que permite que casi toda esta spec se verifique con `node --test` en una máquina sin simulador, que es la situación real del repo (`pipeline/decisiones-orquestador.md` §4).

**Los estilos no entran en `packages/nucleo/`.** `arquitectura.md` §2 enumera lo que vive allí —`core`, `world`, `names`, `quests` y la capa de partida— y el render se hace de cero por decisión expresa. Que un módulo corra en Node no lo convierte en núcleo determinista.

### Frontera de inyección

Dos entradas nuevas, las dos con el mismo patrón que `fetchData` en `buildWorld`: se pasan como argumento, nunca se llaman desde dentro, y tienen doble en Node.

- **El medidor de texto** — dado un texto, una familia, un tamaño y un espaciado, devuelve ancho y alto. En la app lo resuelve Skia; en `node --test`, un doble determinista de anchos fijos por carácter. Sin él no hay cajas, y sin cajas no hay colocación posible en Node.
- **El colocador de rótulos** — dado el conjunto completo de rótulos con su rol, su texto, su anclaje y su caja medida, devuelve la posición de todos. Esta spec entrega el **colocador provisional**: cada rótulo en su anclaje, como el prototipo, con los solapes que eso implica. La fila 22 entrega el que no solapa y lo sustituye **sin tocar ni el módulo de dibujo ni el de composición**. Esa es toda la deuda que esta spec contrae, y está acotada a un argumento.

No hay salida nueva. El render no escribe nada, no pide nada a la red y no toca la partida.

### El plan de capas

El orden es el del prototipo, con un solo cambio: **los rótulos se agrupan en una pasada final**. En el prototipo cada elemento pinta el suyo al pasar, y por eso hoy no hay dónde meter un colocador global.

| # | Capa | Qué la enciende | Grupos del estilo que consume |
| --- | --- | --- | --- |
| 1 | fuera del área y recorte | siempre | `outside`, `shape`, `margin` |
| 2 | papel | siempre | `paper` |
| 3 | tierra | el estilo declara `land` | `land` |
| 4 | brújula detrás | `compass.behind` | `compass` |
| 5 | bosques | `capas.bosques` | `forest` |
| 6 | picos y sierras | `capas.picos` | `peak` |
| 7 | mar desde la máscara | hay máscara | `water` |
| 8 | lagos | `capas.lagos` | `water` |
| 9 | ríos | siempre | `water`, `capas.soloRiosPrincipales` |
| 10 | costa | siempre | `coast` |
| 11 | carreteras reales | `capas.carreteras` | `carretera` |
| 12 | callejero del núcleo enfocado | hay foco | `street` |
| 13 | calzadas y ramales | siempre | `route`, `routeLabel` |
| 14 | glifos de paraje | siempre | `glyph` |
| 15 | glifos de núcleo | siempre | `glyph` |
| 16 | marcadores de servicio | hay foco | `glyph`, `accent` |
| 17 | *(reservado)* entintado por nivel de conocimiento | fila 36 | — |
| 18 | **rótulos, todos** | `capas.rotulosCamino` para los de camino | `label`, `placa` |
| 19 | viñeteo | siempre | `paper.vignette` |
| 20 | marco | `frame.mode` distinto de ninguno | `frame` |
| 21 | brújula delante | no `compass.behind` | `compass` |
| 22 | cartela | siempre | `cartouche` |
| 23 | barra de escala | `escala` y la vista lo pide | — |

La fila 17 se reserva vacía a propósito, con el mismo criterio con que SPEC-009 reservó los huecos de las filas 18 y 25: cuando la fila 36 entregue las tres tintas, añade una capa y las claves de estilo que necesite, en lugar de reabrir el orden.

### Las dos trampas de la fusión, que hay que conservar

Están documentadas en `CLAUDE.md` porque ya se tropezó con ellas, y el porte es exactamente el momento en que se vuelven a pisar:

1. **`label` es la tipografía de los rótulos; el nombre visible del estilo es `title`.** Si el porte llama `label` al nombre, la fusión de dos niveles machaca la tipografía con una cadena y todos los rótulos se pintan con la familia por defecto sin que nada falle.
2. **`capas` decide qué se dibuja.** Es cómo Reino se queda limpio —sin bosques, sin picos, sin lagos, sin rótulos de camino— **sin borrar el código que los otros cuatro estilos usan**. Portar Reino quitando ese código es la manera silenciosa de perder cuatro estilos.

Y una tercera que sale de la fusión misma: es de **dos niveles**, grupo y clave, y nada anida más hondo. Un estilo que declara `label: { color }` conserva familia, halo y placa de los valores por defecto; si el porte fusiona en profundidad o reemplaza el grupo entero, los cinco estilos cambian de aspecto a la vez y ningún test de datos lo ve, porque los objetos siguen siendo válidos.

### El protocolo de revisión de paridad visual

RF-MAPA-002 está marcado **⚠ sin escenario** en el PRD, y con razón: la paridad de un pintado no se afirma con un `assert`. Lo que sí se puede hacer es que la revisión no sea «se parece». Se parte en dos, y solo la segunda mitad es humana.

**Mitad automática — paridad de datos.** Los cinco objetos de estilo resueltos por el porte se comparan clave a clave con los que resuelve `app/js/render/styles.js`. Cualquier diferencia es un fallo, no un matiz. Esto cubre la paleta entera, todos los grosores, todas las tipografías, las esquinas de brújula, los modos de marco y de cartela y el contenido de `capas`. Es la mayor parte de lo que se puede perder al portar, y no cuesta nada afirmarlo.

**Mitad humana — paridad de pintado.** Corpus fijo: los **ocho mundos de referencia × los cinco estilos = cuarenta pares**. Cada par se mira dos veces, lado a lado: el prototipo en el navegador (`node server.mjs`, `__wa.go` sobre el mundo y `__wa.style` sobre el estilo) y la pantalla de revisión de la app, con la misma vista y la misma proporción. La ficha de revisión es binaria y tiene tres bloques:

1. **Presencia y orden, capa a capa** (una casilla por fila del plan de capas): la capa está o no está, igual que en el prototipo, y queda por delante y por detrás de las mismas.
2. **Seis comprobaciones transversales**, una casilla cada una: la forma del área (disco en Clásico, a sangre en Atlas, rectángulo con margen en los demás); la jerarquía de rótulo (placa solo en los roles que el estilo declara); la cartela en su posición y su modo; la brújula en su esquina y su modo; el orden relativo de grosores dentro del estilo (costa más gruesa que río, río más grueso que calzada, calzada más gruesa que callejero); y el grano y la siembra —árboles, manchas, zarza— cayendo **en los mismos sitios**, que es afirmable porque salen del mismo RNG con la misma semilla.
3. **Cuatro muestreos de color** por par: mar, tierra, placa y marca. El color muestreado en pantalla debe ser el del token del estilo. Esto convierte en dato lo que si no sería «el verde se ve parecido».

**Lo que explícitamente NO es criterio**, y hay que decirlo o la revisión se atasca: la identidad pixel a pixel. Skia y el canvas del navegador tienen rasterizadores, motores de texto y antialiasing distintos; los bordes, el interletraje y el redondeo de subpíxel van a diferir y eso no es una pérdida de pintado.

**Cierre.** La revisión se registra en `docs/paridad-render.md` con la fecha, la versión del porte, la tabla de cuarenta pares y las capturas de todo lo que quede en rojo. Un ítem rojo bloquea el cierre de la fila; no se cierra «con observaciones».

### El presupuesto de fluidez

RNF-PER-003 dice «fluido en gama media», que no es un criterio hasta que alguien pone números. Los que se fijan aquí, con el mismo espíritu con que SPEC-009 y SPEC-016 fijaron los suyos: si al medir resultan estrechos o generosos, se ajustan por iteración con el dato delante.

- **Primer pintado completo**: menos de 500 ms desde que hay documento hasta que la lámina está entera.
- **Gasto por fotograma durante un gesto**: ninguno por encima de 32 ms, o sea dos vsync a 60 Hz.
- **Tope de primitivas por escena**: 40.000 sobre el mundo de referencia más denso (`urbano-denso`). No es un límite de la máquina, es la señal de que una capa se ha ido de las manos.
- **Dispositivo de referencia**: un móvil de gama media real, y la medida sobre simulador **no vale como evidencia** —el simulador corre sobre el escritorio y miente a favor. Esa medición es `@manual` y va en la misma ficha que la paridad.

La afirmación que sí es automática, y es la que de verdad protege la fluidez: **arrastrar y hacer zoom no recomponen la geometría**. La escena se compone una vez por mundo, estilo, tamaño y paso de zoom; el gesto mueve la cámara. Los rótulos son la excepción declarada: se recolocan al cambiar de paso de zoom y nunca durante el gesto, porque su tamaño en pantalla no cambia con el zoom y porque el colocador de la fila 22 va a ser caro.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

- **«Cambiar el estilo de pintado no resiembra nada»** (`@nucleo @determinismo`, característica «Lo generado no se resiembra jamás»). Es el escenario de RF-MAPA-001 y el que manda. Ya estaba afirmado sobre el documento desde SPEC-009; lo que esta spec añade es la otra mitad, la del render: que el repintado recibe el mismo documento y solo cambian colores, grosores y tipografías. Es `@determinismo` y por tanto bloqueante (RNF-DET-003).
- **«El norte está siempre arriba»** (`@app`). Aquí queda afirmable a nivel de render: la lámina no tiene rotación y no existe manera de pedírsela.
- **«El mapa no cambia durante la salida»** (`@app`). Esta spec afirma la mitad que le toca: pintar dos veces el mismo documento da la misma escena, y mover la cámara no recompone nada. La otra mitad —que durante la salida no se genera nada— es de la fila 29.
- **«No se enseña ninguna cifra de esfuerzo»** (`@app`). La decisión de apagar la barra de escala en el juego es lo que impide que este escenario se rompa por el sitio más tonto.

### Huecos de la batería que esta spec deja al descubierto

Se anotan aquí y en `test/spec-test-map.json` como huecos declarados, con el criterio de SPEC-001: un hueco silencioso es indistinguible de un olvido.

1. **La paridad visual no tiene escenario y no puede tenerlo** en `@nucleo` ni en `@app`. El PRD ya lo marca con ⚠. Lo cubre la ficha de revisión de arriba, que es `@manual`. Lo que sí entra en la batería es la mitad automática: la paridad de datos entre el porte y `app/js/render/styles.js`.
2. **«Añadir un estilo es añadir un objeto» no tiene escenario.** Es afirmable y esta spec lo exige; hace falta escribir el escenario en `docs/testing.md`, en la característica del pintado.
3. **La frontera del colocador no tiene escenario.** Que el dibujo no calcule posiciones de rótulo es lo que hace posible la fila 22, y hoy nada lo afirma en la batería.
4. **La fluidez no tiene escenario**, y su medida buena es `@manual` sobre hardware real. Lo automatizable —que el gesto no recomponga— sí debería tener el suyo.
5. **Las tipografías sin red no tienen escenario propio.** Está implícito en «Sin red, la aventura funciona entera», pero una tipografía que se cae a una sustituta no rompe ninguna afirmación existente y estropea los cinco estilos a la vez.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo; precedente de SPEC-001 a SPEC-016.
- **Sin sección de comportamiento adaptativo por anchura** → asumido por `pipeline/decisiones-orquestador.md` decisión 3 y por el `SKILL.md` de `wa-spec`: es una app de móvil y la pantalla es la que es. Lo único parecido que sí se afirma es que girar el dispositivo reencuadra sin cambiar el mundo.
- **El pintado se parte en dos: componer una escena de datos y ejecutarla en Skia** → asumido (alternativa: un módulo de dibujo único que hable con Skia mientras recorre el mundo, como hace hoy `map.js` con el canvas). Regla: sin esa partición, **ni un solo criterio de esta spec sería verificable sin simulador**, y `pipeline/decisiones-orquestador.md` §4 dice que Maestro no está instalado; además es lo que hace literalmente comprobable «ningún color vive en el código de dibujo» y lo que deja al colocador de la fila 22 entrar por un argumento. Es la decisión más discutible de esta spec, porque impone una forma al porte que el prototipo no tiene.
- **La barra de escala se apaga en todas las pantallas del juego y solo vive en la de revisión** → asumido (alternativa: portarla y enseñarla, como hace el prototipo). Regla: el design system prohíbe **toda** cifra de distancia en pantalla, y el escenario «No se enseña ninguna cifra de esfuerzo» enumera kilómetros. Se conserva en el estilo en lugar de borrarla porque en la revisión de paridad hace falta. Discutible: una escala cartográfica no es una cifra de esfuerzo, y quien decida lo contrario solo tiene que encenderla en la vista.
- **Esta spec añade una pantalla de revisión que solo existe en la build de desarrollo** → asumido (alternativa: no añadir ninguna y revisar la paridad sobre las pantallas del juego, que todavía no existen). Regla: es el equivalente exacto de los hooks `__wa.style()`, `__wa.demo()` y `__wa.world()` que `CLAUDE.md` documenta para el prototipo, y sin ella la revisión de paridad —que es el entregable visible de la fila— no tiene dónde hacerse. No entra en `docs/flujo.md` ni en `docs/pantallas/` porque no es una pantalla del juego, y no se compila en la build de tienda.
- **Los rótulos se agrupan en una única pasada final, cambiando el orden del prototipo** → asumido (alternativa: portar el pintado de rótulos inline, como está hoy, y reordenarlo en la fila 22). Regla: `arquitectura.md` exige calcular posición y tamaño **de todos** antes de pintar; con los rótulos repartidos por el recorrido, la fila 22 tendría que reescribir el módulo de dibujo entero, que es justo lo que esta spec promete que no hará falta.
- **El colocador y el medidor de texto se inyectan** → asumido (alternativa: que la composición mida con Skia directamente y coloque por su cuenta). Regla: es el patrón que `arquitectura.md` decisión 2 fija para toda entrada y salida —`fetchData` en `buildWorld` es el precedente—, y es lo que permite componer escenas en `node --test` con un doble de anchos fijos.
- **Los estilos viven en `app/render/` y no en `packages/nucleo/`** → asumido (alternativa: `packages/nucleo/render/estilos.js`, ya que son datos puros y correrían en Node igual). Regla: `arquitectura.md` §2 enumera lo que vive en el paquete y el render se rehace de cero por decisión expresa; que un módulo corra en Node no lo hace núcleo determinista.
- **Un estilo desconocido cae a Reino y lo declara, en lugar de fallar** → asumido (alternativa: fallar nombrando el identificador, como hace el resto del proyecto con los datos malos). Regla: el estilo es una preferencia de pintado guardada en la partida, no un dato del mundo; una partida que no abre porque el nombre de un estilo cambió es un precio desproporcionado, y el prototipo ya resuelve así (`getStyle` cae al primero). El aviso evita que la sustitución sea silenciosa.
- **Los cuatro adornos —marco, brújula, cartela y barra de escala— se portan** → asumido (alternativa: dejarlos fuera, ya que las pantallas dibujadas enseñan la lámina a sangre dentro del móvil). Regla: RF-MAPA-002 dice «sin perder el pintado», y los cuatro son claves del objeto de estilo, o sea parte de lo que distingue a un estilo de otro. Qué pantalla los enseña lo decide la pantalla, con un valor de la vista.
- **Los números de fluidez: 500 ms de primer pintado, 32 ms por fotograma y 40.000 primitivas** → asumidos (alternativa: no fijar ninguno y medir a posteriori). Regla: la misma que aplicaron SPEC-009 y SPEC-016 con sus presupuestos, convertir una intuición en una medición; y RNF-PER-003 sin números no es verificable. Se ajustan por iteración con el dato delante.
- **La medida de fluidez sobre simulador no vale como evidencia** → asumido (alternativa: aceptarla, dado que no hay dispositivo en la máquina del pipeline). Regla: el simulador corre sobre el escritorio y miente a favor; aceptarla sería exactamente el patrón de `pipeline/decisiones-orquestador.md` §6o —un criterio que no puede ponerse rojo no mide nada.
- **El corpus de la revisión de paridad son los ocho mundos de referencia y no mundos reales** → asumido (alternativa: revisar sobre coordenadas reales, como hace `test/casting-report.mjs`). Regla: los ocho están congelados en el repo y son idénticos entre revisiones, y una paridad revisada sobre un mundo que cambia no es comparable con la de la semana pasada. Los cuatro fixtures cubren los cuatro ejes: denso, costero, barrio y suelo.
- **La capa de entintado por nivel de conocimiento se reserva vacía en el plan de capas** → asumido (alternativa: no mencionarla y que la fila 36 decida dónde va). Regla: es el patrón de huecos de SPEC-009, y sin la reserva la fila 36 tendría que reabrir el orden de capas, que es lo que la revisión de paridad acaba de dar por bueno.
- **El factor de tamaño de letra multiplica al medir y al colocar, sin tocar el objeto de estilo** → asumido (alternativa: aplicar el factor sobre `label.scale` del estilo resuelto). Regla: si el ajuste entra en el objeto de estilo, la paridad de datos deja de ser comparable con el prototipo y un ajuste de accesibilidad pasa a poder alterar la paleta.
