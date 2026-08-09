# SPEC-032 — Las llegadas: validar no es un gesto, y la secuencia la encadena llegar

## Descripción

Llegar a un sitio es el momento por el que existe el juego, y esta fila entrega las dos cosas que lo hacen ocurrir. La primera: **validar la llegada no es un gesto**. El geofence es generoso —unos treinta a cincuenta metros— y se valida desde espacio público, porque un anclaje puede ser una casa, un local cerrado o una finca y **nunca hay que entrar**. Al detectar que la jugadora está parada dentro, la escena queda **disponible y espera**: no enciende la pantalla, no pone la app en primer plano, no llama. Si mira, está ahí; si no, sigue andando y no ha pasado nada, que es exactamente lo que hace que pararse en un semáforo no tenga consecuencias.

La segunda: **la secuencia de una llegada**, que hay que dejar escrita porque no se deduce de nada. Visor, si es la primera vez aquí y el sitio tiene ilustración. Beat, si este sitio es uno del lazo de hoy o si ha caído un micro-encuentro —y **no siempre hay beat**: llegar sin haber venido a nada es el caso normal, y entonces lo que hay es la ficha del sitio. Y lo que aquí se cuenta, si el sitio es un núcleo, **siempre al final**: el beat es el motivo del viaje y el estado del pueblo es el marco, así que ponerlo delante convertiría en peaje algo que tiene que ser un regalo. **Ninguna de esas pantallas se navega: las encadena llegar.**

De ahí sale la tercera cosa, que es de las que sostienen medio juego: **el estado del núcleo aflora al llegar y no hay ningún panel consultable**. No existe una pantalla con la verdad del mundo; una se entera porque allí se lo cuentan, y por eso enterarse cuesta piernas. **Si no hay beat, lo que se cuenta es la llegada entera.**

Anclas: **RF-BUCLE-005** y **RF-BUCLE-006** (`docs/prd.md` §4.7) y **RF-RUMOR-005** (§4.3). Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` momento 3 y decisión 2, `game-design/quests.md` §3, §6 y decisión 3, el artefacto `docs/pantallas/pantallas-4-al-parar.html` y el nudo **A4P1** de `docs/flujo.md`. Consume SPEC-010 (los beats con su lugar, su disparador de llegada y su cadena lineal), SPEC-012 (la versión que llegó a cada núcleo, con su consulta por núcleo y sin el nivel de deformación dentro), SPEC-014 (las caras que la escena necesita), SPEC-019 (los micro-encuentros mandados desde la cola), SPEC-004 y la fila 31 (la regla de la duda y la traza clasificada) y la fila 30 (la salida abierta y la fuente de posiciones). Las filas 33, 34 y 35 componen las pantallas que esta secuencia encadena y **no están en disco al escribir esta spec**: de ellas aquí solo se consume que existan y en qué orden aparecen.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: la traza clasificada y las posiciones pasan a alimentar la validación de llegadas, y se registra un **área nueva del estado de partida** con las llegadas validadas y las escenas que esperan. Está descrito en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el **visor con su slider, su cartela y su degradación sin foto de Places**, y la **ficha de texto** (A4P1, A4P2, A4P7; fila 33, RF-BUCLE-007/008) —aquí se decide **cuándo** aparecen, nunca cómo se componen—; la **escena del beat y lo que te llevas** (A4P3, A4P4; fila 34) con su botón único y su ajuste de tamaño de letra; el **gesto de marcar un anclaje que no vale** (A4P8; fila 35); los **avisos** de noticia y de oportunidad, con su par de capas y su notificación al entrar en un geofence (fila 29 y fila 19) —una llegada validada no es un aviso y aquí no se emite ninguno—; la **propagación del rumor**, su nivel y su signo (fila 12), de la que aquí solo se lee lo que ya llegó; la **redacción** de cualquier texto, que es de la fila 18 y de las plantillas; el **diario** y su anotación (fila 16 y fila 37), del que aquí solo se dispara el registro que la fila 16 ya define; y el **telón** con su entintado (fila 36).

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La validación de una llegada» y «La secuencia de una llegada»; la **validación de entradas** en el sitio sin posición, la llegada pedida sin salida abierta y el sitio que no pertenece al mapa activo; el **estado vacío** en el núcleo que no ha oído nada y en la llegada a un sitio sin beat, sin ilustración y sin nada que contar; el **estado de error** en la traza sin clasificar y en el reparto no cableado; y los **casos límite** en el semáforo dentro del geofence, la acera de enfrente a treinta metros, el paso a cincuenta por hora, la segunda visita, dos sitios cuyos geofences se solapan y la llegada que sobrevive a días con la app cerrada.

«Mundo de referencia» significa uno de los ocho extractos congelados de `test/fixtures/mundos-referencia/`. **Ninguno de estos criterios necesita un dispositivo**: la validación y la secuencia son funciones sobre una secuencia de posiciones simulada y un estado de partida, y lo único que queda para `@app` es que la pantalla no se encienda.

### La validación de una llegada

- **Dado** un sitio del mundo con su posición, **cuando** se lee su geofence, **entonces** su radio es el declarado por esta spec, el mismo para todos los sitios, y sale de una constante única.
- **Dado** un anclaje que es un local cerrado, **cuando** la jugadora se para en la acera de enfrente, a treinta metros, **entonces** la llegada se valida.
- **Dado** cualquier sitio del juego, **cuando** se busca alguna condición de validación que exija estar en el interior del recinto real, **entonces** no existe.
- **Dado** una jugadora que atraviesa el geofence de un sitio sin pararse, **cuando** sigue andando, **entonces** la llegada no se valida.
- **Dado** una jugadora que se para dentro del geofence menos del tiempo de permanencia, **cuando** sigue andando, **entonces** la llegada no se valida.
- **Dado** una jugadora que se para dentro del geofence el tiempo de permanencia, **cuando** se comprueba, **entonces** la llegada se valida.
- **Dado** una jugadora que atraviesa el geofence a cincuenta kilómetros por hora, **cuando** se comprueba, **entonces** la llegada no se valida, y la regla se lee del mismo módulo del que la lee el motor de pasos.
- **Dado** una jugadora que atraviesa el geofence a velocidad ambigua y se para dentro, **cuando** se comprueba, **entonces** la llegada se valida: en la duda, valida.
- **Dado** la superficie pública de esta capa, **cuando** se busca una operación de validar que reciba un toque, una confirmación o cualquier acción de la jugadora, **entonces** no existe: llegar valida, y no hay otra manera.
- **Dado** una llegada validada, **cuando** se inspecciona lo que la capa emite hacia la plataforma, **entonces** no emite ninguna notificación, ningún háptico ni ninguna petición de poner la app en primer plano.
- **Dado** una llegada validada, **cuando** la jugadora no mira el móvil, **entonces** la escena queda disponible y sigue disponible.
- **Dado** un beat cuyo geofence toca un cruce con semáforo, **cuando** la jugadora se para cuarenta segundos y sigue andando sin mirar el móvil, **entonces** el beat sigue disponible para cuando vuelva.
- **Dado** una llegada validada, **cuando** se serializa la partida, se cierra la app y se vuelve dos días después, **entonces** la escena sigue disponible.
- **Dado** una llegada ya validada en la salida en curso, **cuando** la jugadora vuelve a pararse en el mismo sitio, **entonces** no se valida una segunda vez ni se duplica nada.
- **Dado** dos sitios cuyos geofences se solapan y la jugadora parada en la intersección, **cuando** se comprueba, **entonces** se validan los dos, y la secuencia que se ofrece es la del más cercano, con la del otro esperando detrás.
- **Dado** una llegada pedida sin ninguna salida abierta, **cuando** se comprueba, **entonces** falla nombrando que no hay salida, en lugar de validar.
- **Dado** un sitio que no pertenece al mapa activo, **cuando** se comprueba su geofence, **entonces** falla nombrando el mapa.
- **Dado** un sitio sin posición, **cuando** se pide su geofence, **entonces** falla nombrando el sitio.
- **Dado** una traza con un segmento sin clasificar, **cuando** se comprueba una llegada sobre ella, **entonces** falla nombrando el segmento, en lugar de suponer que se andaba.
- **Dado** el módulo de las llegadas, **cuando** se inspecciona su código, **entonces** no lee el reloj del sistema, no usa ninguna fuente de azar y no clasifica velocidades por su cuenta.

### La secuencia de una llegada

- **Dado** una llegada validada, **cuando** se pide su secuencia, **entonces** se obtiene una lista ordenada de pasos, cada uno con su tipo y su modo.
- **Dado** el catálogo de tipos de paso, **cuando** se enumera, **entonces** son exactamente cuatro: el visor, el beat, la ficha del sitio y lo que aquí se cuenta.
- **Dado** el catálogo de modos, **cuando** se enumera, **entonces** son dos: encadenado y a un toque.
- **Dado** cualquier llegada validada, **cuando** se pide su secuencia, **entonces** tiene al menos un paso encadenado: no existe una llegada que no enseñe nada.
- **Dado** una primera visita a un sitio con ilustración, **cuando** se pide la secuencia, **entonces** empieza por el visor, en modo encadenado.
- **Dado** una primera visita a un sitio sin ilustración, **cuando** se pide la secuencia, **entonces** no contiene el visor en ningún modo.
- **Dado** una segunda visita al mismo sitio, **cuando** se pide la secuencia, **entonces** el visor aparece en modo a un toque y nunca encadenado.
- **Dado** un sitio que es beat del lazo vigente, **cuando** se pide la secuencia, **entonces** contiene el beat, después del visor si lo hubiera.
- **Dado** un sitio al que ha caído un micro-encuentro mandado por la cola, **cuando** se pide la secuencia, **entonces** contiene el beat igual que si fuera del lazo.
- **Dado** un paraje sin beat, **cuando** se pide la secuencia, **entonces** contiene la ficha del sitio y no contiene el beat.
- **Dado** un sitio con beat, **cuando** se pide la secuencia, **entonces** no contiene la ficha: la ficha es lo que hay cuando no se ha venido a nada.
- **Dado** un núcleo, **cuando** se pide la secuencia, **entonces** contiene lo que aquí se cuenta, y es el **último** paso encadenado de la lista.
- **Dado** un núcleo con beat, **cuando** se comparan las posiciones del beat y de lo que aquí se cuenta, **entonces** lo que aquí se cuenta va después.
- **Dado** un núcleo sin beat, **cuando** se pide la secuencia, **entonces** el único paso encadenado, salvo el visor de la primera vez, es lo que aquí se cuenta: la llegada entera es eso.
- **Dado** un paraje, **cuando** se pide la secuencia, **entonces** no contiene lo que aquí se cuenta en ningún caso.
- **Dado** cualquier secuencia, **cuando** se buscan dos pasos del mismo tipo, **entonces** no hay ninguno repetido.
- **Dado** la superficie pública de esta capa, **cuando** se busca una operación que permita saltar a un paso concreto de la secuencia, **entonces** no existe: la secuencia se recorre entera y en orden, y quien la encadena es haber llegado.
- **Dado** una secuencia recorrida hasta el final, **cuando** se pide la siguiente, **entonces** la llegada queda cerrada y no vuelve a ofrecerse en la misma salida.
- **Dado** una llegada cuya secuencia se abandonó a mitad —la app se cierra entre dos pasos—, **cuando** se vuelve a abrir estando todavía dentro del geofence, **entonces** la secuencia continúa por el paso donde iba y no vuelve a empezar.
- **Dado** la misma llegada, **cuando** se pide su secuencia dos veces desde el mismo estado, **entonces** las dos son idénticas.
- **Dado** los ocho mundos de referencia con su reparto casteado, **cuando** se recorren las llegadas posibles, **entonces** ocurren las cuatro formas de secuencia —solo ficha, ficha con visor, beat con lo que se cuenta, y lo que se cuenta como llegada entera— al menos una vez cada una.

### Lo que aquí se cuenta

- **Dado** una llegada a un núcleo, **cuando** aflora su estado, **entonces** trae lo que ese núcleo oyó, en la versión que le llegó, y no la de ningún otro núcleo.
- **Dado** dos núcleos que oyeron el mismo suceso en niveles distintos, **cuando** se llega a cada uno, **entonces** cada uno cuenta la suya.
- **Dado** lo que aflora al llegar, **cuando** se inspecciona, **entonces** no lleva el nivel de deformación ni ninguna etiqueta de fiabilidad.
- **Dado** un núcleo que no ha oído nada, **cuando** se llega, **entonces** el paso existe igual y dice que no hay nada que contar, sin llamarlo error ni falta.
- **Dado** un núcleo del que ha llegado algo sobre la propia jugadora, **cuando** aflora el estado, **entonces** eso aparece por el mismo canal y en su versión, y no en un apartado distinto.
- **Dado** todo el juego entregado hasta esta fila, **cuando** se busca una pantalla, una consulta o una acción que devuelva el estado de todos los núcleos a la vez, **entonces** no existe.
- **Dado** la superficie pública de esta capa, **cuando** se busca una operación que consulte el estado de un núcleo **sin** haber llegado a él, **entonces** no existe: enterarse cuesta piernas.
- **Dado** lo que aflora al llegar, **cuando** se comprueba el diario, **entonces** queda anotado con el sitio y el momento, con el mecanismo que ya define la fila 16 y sin reimplementarlo aquí.
- **Dado** una versión ya anotada en el diario y otra distinta del mismo suceso que aflora después, **cuando** se anota, **entonces** conviven las dos y ninguna sobrescribe a la otra.
- **Dado** la primera vez que aflora una segunda versión de algo ya apuntado, **cuando** se cierra el paso, **entonces** el estado lo declara, para que la pantalla de la triangulación pueda existir; componerla es de la fila 37.
- **Dado** un mundo en gallego, **cuando** aflora lo que allí se cuenta, **entonces** los nombres son los que produjo el paquete de idioma de ese mundo.
- **Dado** cualquier texto de este paso, **cuando** se busca una cifra de distancia, de tiempo, de ritmo, de progreso o de reputación, **entonces** no aparece ninguna.

### Nada degrada por falta de cableado

- **Dado** el reparto de la aventura no cableado, **cuando** se pide la secuencia de una llegada, **entonces** falla nombrando lo que falta, en lugar de devolver una secuencia sin beat.
- **Dado** un beat cuyo lugar no corresponde a ningún sitio del mundo congelado, **cuando** se resuelve la llegada, **entonces** falla nombrando el lugar, en lugar de tratarlo como un sitio sin beat.
- **Dado** la cola de entregas no cableada, **cuando** se pide la secuencia, **entonces** falla nombrando la cola, en lugar de decidir que no hay micro-encuentro.
- **Dado** la capa de lo que se cuenta no cableada, **cuando** se llega a un núcleo, **entonces** falla nombrándola, en lugar de producir un núcleo que calla.
- **Dado** un núcleo que calla y un núcleo sin cablear, **cuando** se comparan, **entonces** son distinguibles: el primero es un estado y el segundo es un error.
- **Dado** el detector de transporte ausente, **cuando** se comprueba una llegada, **entonces** falla, en lugar de validar suponiendo que se andaba.
- **Dado** la llegada de un sitio marcado por la jugadora como que no vale, **cuando** se comprueba, **entonces** el sitio conserva su nombre y su posición y no produce beat, con el mecanismo de la fila 35 y sin reimplementarlo aquí.

## UX Design

### Wireframe textual

**A4P5 — «Lo que aquí se cuenta».** Es la pantalla que esta fila compone, y la única. Pantalla completa, voz del mundo en serif, sin cabecera de navegación y sin ningún camino de vuelta: no se llega aquí tocando nada, **se llega llegando**.

```
  En Monfrida se habla de
  ‹titular de lo que allí se cuenta›

  Lo que cuentan aquí
  ‹la versión que llegó a este núcleo, redactada, sin ninguna etiqueta›

  Y de ti
  ‹lo que llegó sobre la jugadora, en su versión, o esta sección no existe›

  Queda anotado en tu diario, con el sitio y el momento.

  [ Seguir ]
```

- **El titular** nombra el suceso, no el rumor: nada de «rumor nivel 2» ni de «versión abultada».
- **«Lo que cuentan aquí» y «Y de ti»** son el mismo canal y por eso van en la misma pantalla: la reputación es lo que llegó. Si no ha llegado nada de la jugadora, la segunda sección **no aparece** —no se enseña vacía.
- **Si el núcleo no ha oído nada de nada**, la pantalla existe igual, con una línea en voz de mundo que dice que hoy no se cuenta nada por aquí. Ningún texto la llama error, hueco ni falta.
- **La línea del diario** es una constatación y no un botón: informa de que queda anotado, y el diario se lee desde la portada.
- **«Seguir»** es la única acción, y cierra la llegada. Cierra también el momento: el móvil vuelve al bolsillo.

**El encadenado, que es el otro entregable y no tiene pantalla propia.** Al validar una llegada, lo que se ofrece es una secuencia, y cada paso lo compone otra fila:

```
  llegar y pararse
      │
      ├─ visor (A4P1 → A4P2)        primera vez aquí y el sitio tiene ilustración   · fila 33
      │      └─ cerrar el visor: es capa, no paso
      ├─ beat (A4P3 → A4P4)         hay beat del lazo, o cayó un micro-encuentro    · fila 34
      ├─ ficha (A4P7)               no hay beat: el caso normal                     · fila 33
      └─ lo que aquí se cuenta (A4P5)   el sitio es un núcleo · SIEMPRE AL FINAL    · esta fila
```

Y la variante de la segunda visita (**A4P6**), que es una forma de la secuencia y no una pantalla nueva de esta fila: **abre por lo que ha cambiado** —el beat de hoy, o lo que aquí se cuenta ahora— y **el visor queda a un toque**, nunca encadenado.

**Ninguna de estas pantallas se navega.** No hay barra, no hay flecha de atrás entre pasos, no hay manera de saltar al siguiente ni de volver al anterior. El único control de cada paso es su propia acción de seguir, que es la que la fila dueña de esa pantalla ya dibuja.

### Pantallas y elementos utilizados

```
Pantalla que esta spec compone:
  A4P5  pantalla 5 · artefacto 4 — Lo que aquí se cuenta

Pantallas que esta spec encadena y no compone:
  A4P1  pantalla 1 · artefacto 4 — El visor, lado de la ficción   (dueña: fila 33)
  A4P2  pantalla 2 · artefacto 4 — El visor, arrastrado           (dueña: fila 33)
  A4P3  pantalla 3 · artefacto 4 — La escena                      (dueña: fila 34)
  A4P4  pantalla 4 · artefacto 4 — Lo que te llevas               (dueña: fila 34)
  A4P6  pantalla 6 · artefacto 4 — La segunda vez                 (la forma es de aquí; su composición, de 33 y 34)
  A4P7  pantalla 7 · artefacto 4 — La ficha de texto              (dueña: fila 33)
  A4P8  pantalla 8 · artefacto 4 — El sitio que no pega           (dueña: fila 35)
  A6P3  pantalla 3 · artefacto 6 — La primera vez que triangulas  (dueña: fila 37; aquí, cuándo se declara)

Elementos del proyecto que se usan: la voz del mundo en serif, el ajuste de tamaño
de letra donde hay texto largo. Ningún elemento del mapa: al parar, el mapa no está.

Elemento nuevo: la secuencia de una llegada — una lista ordenada de pasos con tipo y
modo. No es un componente visible: es el estado con el que se encadenan pantallas que
ya existen, y se declara aquí porque es lo único que las une.
```

Los tres nudos del flujo que esta fila implementa ya están dibujados en `docs/flujo.md` y no se toca ninguno: **LLEGA** («pararse dentro del geofence de un sitio»), **CIERRA** («qué hay debajo del visor») y **NUCLEO** («¿el sitio es un núcleo?»). `node scripts/verifica-flujo.mjs` tiene que seguir en verde: no se añade ni se quita ninguna pantalla.

### data-testid

Los dos que `design-system.md` pide siempre son aquí el estado del momento y —por ausencia— el mapa, que al parar no está en pantalla.

- `momento-estado` — el estado del momento, con un valor de un vocabulario cerrado: `en-marcha`, `al-parar`; es el localizador que permite afirmar que una llegada no cambia el momento hasta que alguien mira
- `llegada-secuencia` — la secuencia ofrecida, expuesta como la lista ordenada de tipos y modos, para poder afirmar el orden sin recorrer cuatro pantallas
- `llegada-paso` — el paso vigente de la secuencia, con su tipo
- `lo-que-se-cuenta` — la pantalla A4P5 completa
- `lo-que-se-cuenta-de-ti` — la sección de lo que llegó sobre la jugadora, para poder afirmar que **no existe** cuando no ha llegado nada
- `llegada-seguir` — la acción «Seguir» de A4P5
- `visor-a-un-toque` — el acceso al visor en la segunda visita, para poder afirmar que está disponible y que no se abrió solo

Sin más: los titulares, los nombres de los núcleos y la línea del diario son texto único y se localizan por su contenido. El visor, la escena y la ficha declaran los suyos en las filas 33 y 34; aquí no se inventan.

### Patrón de interacción

- **Validar es un estado, no un gesto.** Regla: `bucle-jugable.md` momento 3 y RF-BUCLE-005. Se descartó abrir la escena sola, que no le quita nada a nadie pero convierte el móvil en algo que llama en vez de avisar; y se descartó igual de fuerte un botón de «he llegado», que sería pedir atención justo en el momento en que el diseño no la puede pedir.
- **La secuencia se recorre entera y en orden, y no se navega.** Regla: `bucle-jugable.md` §2, la secuencia de una llegada; y el artefacto 4, «ninguna de estas pantallas se navega: llegar a un sitio las encadena». Que no haya manera de saltar es lo que impide que el visor se convierta en un trámite y que el estado del pueblo se convierta en un peaje.
- **El visor es capa y no paso, y por eso la segunda visita cambia de modo y no de secuencia.** Regla: `bucle-jugable.md` §2 y §5; volver tiene que sentirse distinto de descubrir, porque son premios distintos. Modelarlo como dos modos del mismo paso —y no como dos secuencias— es lo que evita que las filas 33 y 34 tengan que saber cuál es la visita.
- **Lo que aquí se cuenta va siempre al final, sin excepción configurable.** Regla: `bucle-jugable.md` §2. Al final cabe dentro lo que se dice de lo que acabas de hacer en otro sitio, porque los rumores viajan (`quests.md` §6); delante sería un peaje.
- **Sin beat, lo que se cuenta es la llegada entera, y no una versión reducida de nada.** Regla: `quests.md` decisión 3; el estado del núcleo es uno de los tres canales por los que el mundo llega a la jugadora, no un accesorio del beat.
- **Ningún panel, ninguna consulta, ningún resumen.** Regla: `design-system.md`, «Ningún panel del estado del mundo», y la exclusión 4 del PRD. La consulta por núcleo que SPEC-012 entrega solo se invoca al llegar, y hay criterio para que no exista otra manera de invocarla.
- **Una llegada no avisa.** Regla: `accesibilidad.md` §3; los avisos son de la fila 29 y las notificaciones están racionadas a las oportunidades. Que entrar en el geofence de un micro-encuentro sí notifique es la **oferta**, que es otra cosa y de otra fila: la llegada validada, por sí sola, no emite nada.
- **Decisión no cubierta por el design system:** qué ofrecer cuando dos geofences se solapan y la jugadora está parada en los dos. Se resuelve **validando las dos y ofreciendo primero la del sitio más cercano**, con la otra esperando detrás, porque descartar una llegada validada sería perder algo que ya ocurrió y ofrecer las dos a la vez pediría elegir, que es un control tocable de más en el único momento que se puede permitir pocos.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/llegadas.js` | el geofence y su radio, la permanencia, la validación sobre una traza clasificada, el registro de llegadas validadas y de escenas que esperan, y el área del estado |
| `packages/nucleo/partida/secuencia.js` | la secuencia de una llegada: el catálogo de tipos y modos, el orden, y el avance por sus pasos |
| `app/pantallas/lo-que-se-cuenta.js` | A4P5, que consume lo que la capa entrega y no decide nada |
| `app/pantallas/llegada.js` | el encadenado en la app: monta el paso vigente y no permite saltar |

`packages/nucleo/partida/nucleos.js` y `packages/nucleo/partida/entregas.js` **no se tocan**: de ahí salen la consulta por núcleo y los micro-encuentros mandados, y aquí se consumen.

### Frontera de inyección

Ninguna entrada nueva de sensor: las dos que hacen falta ya existen.

1. **La traza clasificada y las posiciones**, de la fila 31 sobre la fuente de la fila 30. Esta capa no mira el GPS y no clasifica: recibe posiciones con marca de tiempo y consulta `validaLlegadaPorGeofence` en `packages/nucleo/partida/ritmo.js` para saber si un tramo puede validar. **La regla de la duda no se reimplementa aquí**, y hay criterio para ello.
2. **El reparto de la salida** —la aventura casteada con sus beats, y la cola de entregas con sus micro-encuentros mandados—, que SPEC-010 y SPEC-019 ya entregan. Esta capa no castea, no ordena beats y no decide si salta un encuentro: pregunta si este sitio tiene beat hoy.

Y una salida hacia el resto del juego: **la secuencia de una llegada**, que las filas 33, 34 y 35 consumen para saber qué toca montar. Ninguna de las tres deduce por su cuenta si es la primera visita ni si hay beat.

### El geofence, la permanencia y por qué no son el mismo número que el regreso

El radio es **generoso a propósito** y sale de `quests.md` §3: treinta a cincuenta metros, «GPS impreciso», «activable desde espacio público, tolerante a lugares reales cerrados o inaccesibles». Cuarenta metros cubre la acera de enfrente que `docs/testing.md` usa como caso —treinta metros— con margen para el error del fijo, y no es tan grande como para que dos sitios de una calle se confundan en el mundo urbano denso.

La permanencia es corta y es deliberado: **validar es barato**. `docs/testing.md` dice que pararse en un semáforo dentro de un geofence «no tiene consecuencias», y la razón por la que no las tiene **no es que no valide**: es que validar no enciende nada. Un semáforo valida el beat y la escena queda esperando, que es un regalo y no una anomalía —es literalmente el caso de «pasar cerca de un beat por casualidad» de `bucle-jugable.md` §9. Lo que la permanencia distingue es pararse de pasar de largo: sin ella, atravesar el geofence sin parar validaría, y «El visor no aparece nunca andando» dejaría de sostenerse.

Y por eso estos números **no** son los del regreso de SPEC-030, aunque se parezcan: allí la asimetría es la contraria —en la duda no se cierra— y por eso el radio es más pequeño en proporción a la exigencia y la permanencia es un minuto. Aquí, en la duda se valida, porque una llegada de más no le quita nada a nadie.

### La secuencia como dato, y por qué no como navegación

La tentación evidente es montar esto como cuatro pantallas encadenadas con un enrutador, y sería un error de los que se pagan tarde. La secuencia es **un dato del núcleo**: una lista ordenada de `{ tipo, modo }` calculada a partir del sitio, de si es la primera visita, de si hay beat y de si es núcleo. Tres consecuencias, y las tres son la razón de la decisión:

- **Se puede poner roja en `node --test`.** El orden —lo que aquí se cuenta al final, el visor solo la primera vez, la ficha solo sin beat— es lo que RF-BUCLE-006 dice, y con la secuencia como dato se afirma sobre los ocho mundos de referencia sin un simulador. Es lo que convierte una fila entera de `@app` en una fila casi entera de `@nucleo`.
- **Las filas 33, 34 y 35 no tienen que saber nada.** Cada una compone su pantalla y recibe qué paso es; ninguna deduce si es la primera visita ni consulta el reparto. Sin esto, la regla del orden acabaría escrita cuatro veces, que es exactamente cómo se desincronizan.
- **La ausencia de navegación es estructural y no una omisión de UI.** No hay ruta a la que ir, así que no hay manera de llegar a A4P5 sin haber llegado al sitio. Un enrutador con cuatro rutas habría dejado esa puerta abierta y nadie se habría enterado.

El caso de la app cerrada a mitad de secuencia se resuelve con lo mismo: el paso vigente es estado, así que volver a abrir continúa donde iba.

### Lo que consume de otras specs y no respecifica

- **SPEC-010** entrega los beats con lugar, disparador, escena y resultado, la cadena lineal, el disparador de tipo `llegada` y la regla de que las franjas no cancelan nada. Aquí no se reabre ninguna: llegar fuera de franja resuelve el beat igual y lo que cambia es la variante de escena, que es de la fila 34.
- **SPEC-012** entrega la versión que llegó a cada núcleo, la consulta **por núcleo** —y la garantía de que no existe una por mapa— y que lo entregado a la capa que pinta no lleva el nivel. El reparto de RF-RUMOR-005 entre la fila 12 y esta ya está escrito allí y se respeta letra por letra: allí, qué versión llegó; aquí, cuándo aflora y que la pantalla no enseñe ningún nivel.
- **SPEC-014** entrega las caras y su memoria. El testigo directo que cuenta la versión fiel aparece en la escena, que es de la fila 34; aquí solo se garantiza que lo que aflora en el núcleo no lo corrige.
- **SPEC-019** entrega la cola de entregas y los micro-encuentros con sus cuatro reglas —cola no vacía, coste cero de desvío, nunca durante un beat y como mucho uno por paso. Aquí un micro-encuentro mandado produce beat igual que uno del lazo, y no se decide nada sobre cuándo salta.
- **SPEC-016** entrega el diario y su regla de que una entrada no se sobrescribe. Aquí se dispara el registro de lo oído y no se reimplementa la anotación.
- **SPEC-004 y la fila 31** entregan la regla de la duda y la traza clasificada. La fila 31 **no está en disco al escribir esta spec**; de ella se consume solo el vocabulario que ya existe en `ritmo.js`.
- **SPEC-030** entrega la salida abierta y la fuente de posiciones. Sin salida abierta no hay llegadas, y hay criterio para eso.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Ninguno se implementa aquí —son de `wa-qa-dev`—, pero los criterios están escritos para cubrirlos sin inventar casos. Por nombre literal, todos de **«Al parar, la secuencia de una llegada»** (`@app @bucle`) salvo donde se diga:

- «La escena queda disponible y espera» y «Pararse en un semáforo dentro de un geofence no tiene consecuencias», de los que aquí se sostiene todo menos que la pantalla no se encienda, que es lo único que necesita dispositivo.
- «El geofence se valida desde la calle» y «El visor no aparece nunca andando», los dos enteros en `@nucleo` sobre una secuencia de posiciones simulada.
- «Lo que aquí se cuenta cierra la llegada a un núcleo» y «Sin beat, lo que se cuenta es la llegada entera», que son la característica de esta fila y que con la secuencia como dato pasan a ser afirmables sin simulador.
- «La segunda vez el visor no se abre solo» y «Llegar sin haber venido a nada da la ficha del sitio», en su mitad de forma de la secuencia; la composición de las pantallas es de la fila 33.
- De **«El vehículo se aparta del reloj del mundo y de la validación»** (`@app @accesibilidad`): «Pasar en coche por delante de un beat no lo valida» y la mitad de validación de «En la duda, cuenta».
- De **«Lo que hiciste viaja y se cuenta deformado»** (`@nucleo @rumores`), en lo que toca a que cada núcleo cuente la suya al llegar.

### Huecos de cobertura detectados en `docs/testing.md`

Se anotan aquí porque son de la batería y no de esta spec:

- **Nada afirma el orden completo de la secuencia.** «Lo que aquí se cuenta cierra la llegada a un núcleo» afirma que va después del beat, y «El visor es una capa y debajo está el beat» que el visor va antes; nadie afirma las cuatro formas juntas, ni que la lista no se repita, ni que nunca esté vacía.
- **Nada afirma que la secuencia no se puede navegar.** Es la mitad de RF-BUCLE-006 —«ninguna se navega»— y es la que una implementación con enrutador rompe sin que ningún escenario se ponga rojo.
- **Nada afirma que una llegada validada no emite ningún aviso.** «La escena queda disponible y espera» dice que la pantalla no se enciende, que es lo visible; que tampoco vibre ni notifique no está escrito, y es lo que distingue una llegada de una oportunidad.
- **Nada afirma que la escena sobrevive al cierre de la app.** «Pararse en un semáforo… sigue disponible para cuando vuelva» es dentro de la misma salida; días después con la app cerrada no tiene escenario.
- **Nada afirma que no existe consulta del estado de un núcleo sin llegar.** Es la garantía que sostiene «enterarse cuesta piernas» y solo está dicha en prosa.
- **El caso de dos geofences solapados no existe en la batería**, y en el mundo urbano denso no es raro.
- **RF-BUCLE-014 sigue marcado ⚠ sin escenario** en el PRD, y su mitad «pasar cerca de un beat por casualidad valida igual» es de esta fila. Se anota para quien orquesta.

## Decisiones asumidas

- **Radio del geofence: 40 m, el mismo para todos los sitios** → asumido (alternativas: 30 m; 50 m; un radio por tipo de sitio). Regla: `quests.md` §3 declara el rango 30-50 y `docs/testing.md` usa treinta metros como el caso que tiene que validar; cuarenta deja margen de error de fijo sin confundir dos anclajes de la misma calle en el mundo urbano denso. Un radio por tipo sería una perilla más que calibrar sin ninguna decisión de diseño detrás.
- **Permanencia para validar: 20 s dentro del geofence** → asumido (alternativas: validar al entrar, sin permanencia; 60 s como el regreso). Regla: sin permanencia, atravesar validaría y «El visor no aparece nunca andando» se caería; con un minuto, un beat que se atiende de paso dejaría de validar, y `bucle-jugable.md` §9 dice explícitamente que pasar cerca por casualidad «valida igual» y «es un regalo, no una anomalía».
- **La precisión del fijo no ensancha el radio** → asumido (alternativa: radio efectivo igual al radio más la precisión). Regla: cuarenta metros ya está dimensionado contra el error del GPS; sumarle la precisión haría que en ciudad densa un geofence tragase la manzana entera y que dos sitios se validaran a la vez de forma rutinaria, y el caso de solape dejaría de ser un borde para ser la norma.
- **Dos geofences solapados validan los dos y se ofrece primero el más cercano** → asumido (alternativas: validar solo el más cercano, o pedir elegir). Regla: `design-system.md`, en marcha no hay controles que tocar, y una llegada validada es algo que ya ocurrió: descartarla sería quitar, que es lo que la asimetría del proyecto no hace.
- **La secuencia es un dato del núcleo y no una navegación de la app** → asumido (alternativa: cuatro rutas encadenadas con el enrutador de la fila 27). Regla: §6h y §6o de `pipeline/decisiones-orquestador.md`; con la secuencia como dato, el orden de RF-BUCLE-006 se puede poner rojo sobre los ocho mundos de referencia, y la ausencia de navegación deja de ser una omisión que nadie vigila para ser una propiedad estructural.
- **El visor de la segunda visita es un modo del mismo paso, no una secuencia distinta** → asumido (alternativa: dos secuencias, la de descubrir y la de volver). Regla: `bucle-jugable.md` §2, «el visor de la primera visita y el visor que queda a un toque dejan de ser dos cosas y son una con dos maneras de aparecer».
- **La sección «Y de ti» no aparece cuando no ha llegado nada** → asumido (alternativa: aparecer vacía con una línea de que aún no se habla de ti). Regla: `progresion.md` §1 y la exclusión 4 del PRD; una sección que dice «todavía nadie habla de ti» es un marcador de reputación con otras palabras, y además reprocharía la ausencia.
- **Un núcleo que no ha oído nada enseña la pantalla igual** → asumido (alternativa: saltarse el paso). Regla: el mismo criterio con el que `bucle-jugable.md` §8 decidió que un día sin descubrir nada enseña el mapa igual: hacer desaparecer el objeto central justo el día que menos hay es lo peor que se puede hacer con él.
- **Una llegada validada no se revalida en la misma salida** → asumido (alternativa: revalidar cada vez que se entra y se sale del geofence). Regla: la secuencia se recorre una vez y cerrarla la da por vista; revalidar reabriría un visor ya cerrado, que es la ceremonia repetida que `bucle-jugable.md` §2 descarta.
- **El área nueva del estado guarda la llegada validada, el paso vigente y las escenas que esperan** → asumido (alternativa: mantenerlo en memoria mientras dura la salida). Regla: `docs/testing.md`, la escena «espera» y `bucle-jugable.md` §9, la aventura sigue abierta hasta volver o cerrar a mano; una escena que se pierde al cerrar la app rompe las dos cosas, y el caso real —cerrar la app andando, quedarse sin batería— ya está declarado en A2P1.
