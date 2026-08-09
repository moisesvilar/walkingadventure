# SPEC-039 — La partida que sobrevive: almacén duradero, respaldo del sistema, exportar e importar, y la migración del formato

## Descripción

Hasta aquí la partida existía y no duraba. SPEC-009 definió el mundo congelado, su esquema cerrado y su versión de formato, y dejó el almacén **inyectado**; SPEC-016 puso encima el estado y el registro de hechos con la misma constante de versión; SPEC-026 cableó la generación dentro del móvil y **dejó el almacén en memoria**, declarando que el almacenamiento de partida era de esta fila. Esta spec lo entrega: el almacén duradero del dispositivo, con escritura atómica, que es la primera vez en el proyecto que cerrar la app no pierde nada.

Encima van las tres promesas de `partida-guardada.md` §3 y de RF-PERS-008. **El respaldo del sistema**: la partida entra en iCloud o Google Backup, cifrada, bajo la cuenta del propio jugador y sin pasar por ningún servidor nuestro — móvil nuevo, sesión iniciada, el mapa aparece solo. **Exportar e importar un fichero**, con su formato y su versión declarados, que además es la vía de compartir mundo con otra persona, porque con el mundo congelado la semilla ya no reproduce nada. Y **el versionado y la migración** del estado, cuyo campo nació en SPEC-009 con valor 1 precisamente para que esta fila pudiera moverlo.

Y una promesa en negativo que atraviesa las tres: **el rastro de ubicación no existe ni ahí**. La copia del sistema es el único sitio del proyecto donde datos de la jugadora salen del móvil —cifrados y hacia su propia cuenta— y eso obliga a decir en voz alta qué sale exactamente. Lo que sale es una partida: mundo, mapa, diario, rangos. Lo que no sale, porque no existe en ningún sitio, es por dónde ha andado.

Anclas: **RF-PERS-004**, **RF-PERS-005**, **RF-PERS-008** y **RF-PRIV-002** (`docs/prd.md` §4.10 y §4.11), con `game-design/partida-guardada.md` **§3** como fuente que manda sobre el PRD. **RF-PERS-004 y RF-PERS-008 están marcados «⚠ sin escenario»** en el PRD: esta spec los convierte en criterios afirmables y anota los escenarios que faltan en la batería. Consume SPEC-009 (**la constante única de versión de formato, el esquema cerrado, la canonicalización, la partición índice más un documento por celda y las cuatro operaciones del almacén: se consumen tal cual y no se redefine ninguna**), SPEC-016 (el estado, el registro de hechos, la marca de aplicación y la compactación por instantánea, que aquí se implementa), SPEC-020 (el proyecto de Expo y la frontera del paquete), SPEC-025 (los recursos binarios residentes, que forman parte de lo que hay que salvar) y SPEC-026 (la orquestación dentro del móvil, que hoy escribe en memoria).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparece el **almacén duradero del dispositivo**, que es la primera implementación real de la salida que SPEC-009 dejó inyectada, y el **empaquetador de ficheros**, que convierte la lista de partes que produce el núcleo en un fichero y al revés. Los dos con doble en Node. Están descritos en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** **empezar de nuevo** y el borrado de la partida (fila 40, RF-PERS-006), que **consume** la exportación de esta fila y no la reimplementa; **la lista de mapas de la partida y cuál está activo** (fila 41), de la que aquí solo se consume que hay varios y todos entran en la copia; el **texto que se le enseña a la jugadora cuando la reconstrucción de emergencia da otro estado**, que sigue siendo el pendiente 3 de `partida-guardada.md` y no se cierra aquí; la **reconstrucción** en sí y la regla de que manda el estado (fila 16, consumidas resueltas); la **caché del proxy** y su política (fila 23), que no es partida y no se respalda; la **poda de mapas**, que es el pendiente 1 de `partida-guardada.md` y aquí solo se instrumenta con la compactación; y la **fila de ajustes «Guardar una copia»** como elemento de la pantalla A6P6, que es de la fila 38 y de la que aquí se implementa a dónde lleva.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El almacén duradero», «Exportar la partida», «Importar la partida» y «La partida entra en la copia del sistema»; la **validación de entradas** en el fichero que no es una partida, el manifiesto sin versión, la parte declarada y ausente, la versión mayor que la actual y la clave de almacén mal formada; el **estado vacío** en la partida recién creada que se exporta, el almacén sin ningún mapa y la partida sin ningún recurso binario; el **estado de error** en el disco lleno, la escritura interrumpida, el fichero truncado, la importación cancelada a mitad y la migración sin paso registrado; y los **casos límite** en la partida de mil días, el fichero exportado dos veces, la reimportación de la partida que ya está abierta, la migración encadenada de varios saltos y el apagón entre el registro y el estado.

**«Documento»** es lo que SPEC-009 escribe y lee. **«Parte»** es cada pieza que entra en un fichero exportado: un documento, un recurso binario o el manifiesto. **«Fichero de partida»** es el resultado de exportar. **«Versión de formato»** es siempre la constante única de SPEC-009, nunca una propia.

### El almacén duradero, que es lo que faltaba

- **Dado** la app con el almacén duradero cableado, **cuando** se congela una celda y se cierra la app, **entonces** al volver a abrirla el documento está y se lee idéntico byte a byte.
- **Dado** el almacén duradero, **cuando** se enumeran sus operaciones, **entonces** son las cuatro de SPEC-009 —leer por clave, escribir por clave, listar por prefijo y borrar— y ninguna más.
- **Dado** una escritura, **cuando** se observa cómo ocurre, **entonces** se escribe aparte y se sustituye, y nunca se sobrescribe en sitio.
- **Dado** una escritura interrumpida a mitad, **cuando** se lee después la clave, **entonces** o está el documento anterior entero o no está ninguno, y nunca un documento truncado.
- **Dado** el almacén, **cuando** se lista por prefijo, **entonces** el orden es estable y declarado, y no depende del sistema de ficheros.
- **Dado** una clave que no existe, **cuando** se lee, **entonces** se obtiene ausencia y no un error.
- **Dado** el disco lleno, **cuando** se escribe, **entonces** el error se propaga nombrando la clave y el documento anterior sigue intacto.
- **Dado** la orquestación de la app construida sin almacén duradero cableado, **cuando** se construye, **entonces** falla nombrando la pieza que falta, en lugar de seguir en memoria y perder la partida al cerrar.
- **Dado** el paquete del núcleo, **cuando** se ejecuta sin almacén inyectado, **entonces** sigue funcionando entero en memoria, como fija SPEC-009.
- **Dado** el almacén duradero, **cuando** se inspecciona dónde escribe, **entonces** todo cuelga del directorio de la partida y nada se escribe fuera de él.
- **Dado** una partida con un mapa levantado, **cuando** se apaga y se enciende el dispositivo, **entonces** la partida se abre con el mismo estado, el mismo registro y los mismos documentos.
- **Dado** el registro de hechos y el estado, **cuando** se escriben, **entonces** el registro se anexa primero y el estado después, con su marca de aplicación, como fija SPEC-016.
- **Dado** un apagón entre las dos escrituras, **cuando** se vuelve a abrir la partida, **entonces** los hechos posteriores a la marca se aplican hacia delante y no se reconstruye nada.

### La partida entra en la copia del sistema

- **Dado** las reglas de respaldo declaradas por la app, **cuando** se leen, **entonces** el directorio de la partida está incluido en la copia del sistema.
- **Dado** esas mismas reglas, **cuando** se leen, **entonces** los recursos binarios residentes de un mundo congelado están incluidos, porque son parte del mundo y no una caché.
- **Dado** esas mismas reglas, **cuando** se leen, **entonces** la caché del proxy y cualquier fichero temporal están excluidos.
- **Dado** esas mismas reglas, **cuando** se comparan con lo que el almacén escribe, **entonces** toda clave que el almacén usa cae dentro de lo incluido, y ninguna queda fuera sin declararlo.
- **Dado** una clave nueva que el almacén escribe y que las reglas de respaldo no cubren, **cuando** se comprueban, **entonces** falla nombrando la clave, en lugar de dejarla silenciosamente fuera de la copia.
- **Dado** el código de esta entrega, **cuando** se inspeccionan sus imports y su tráfico saliente, **entonces** no habla con ningún servidor nuestro: la copia la hace el sistema y nosotros no la vemos.
- **Dado** la declaración de qué sale del móvil, **cuando** se lee, **entonces** dice que lo que sale es una partida dentro del respaldo cifrado de la propia cuenta del jugador, y que el rastro de ubicación no sale porque no existe.

### Exportar la partida

- **Dado** una partida con dos mapas, **cuando** se exporta, **entonces** el fichero contiene el índice y los documentos de todas las celdas de los dos mapas, el estado, el registro de hechos y los recursos binarios residentes.
- **Dado** un fichero exportado, **cuando** se lee su manifiesto, **entonces** declara la versión de formato de la constante única de SPEC-009, la versión de las reglas con que se escribió y la lista completa de sus partes.
- **Dado** un fichero exportado, **cuando** se comparan sus partes con el manifiesto, **entonces** están todas las declaradas y ninguna más.
- **Dado** la misma partida, **cuando** se exporta dos veces, **entonces** los dos ficheros son idénticos byte a byte.
- **Dado** un fichero exportado, **cuando** se buscan marcas de tiempo del reloj real, **entonces** no hay ninguna, ni en el manifiesto ni en las entradas del contenedor.
- **Dado** los textos del narrador cacheados de la partida, **cuando** se exporta, **entonces** van dentro, y el manifiesto declara que van.
- **Dado** una partida recién creada sin ningún mapa, **cuando** se exporta, **entonces** el fichero se produce igual, con su manifiesto y sin celdas, y no es un error.
- **Dado** una partida sin ningún recurso binario, **cuando** se exporta, **entonces** el fichero se produce igual y el manifiesto declara cero recursos.
- **Dado** una exportación en curso, **cuando** falla a mitad, **entonces** no queda ningún fichero a medias donde el jugador pueda encontrarlo.
- **Dado** una exportación terminada, **cuando** se compara la partida antes y después, **entonces** el estado, el registro y todos los documentos son idénticos byte a byte: exportar no toca nada.
- **Dado** el fichero exportado, **cuando** se mide una partida de mil días con dos mapas, **entonces** su tamaño queda declarado y comparado con el presupuesto de SPEC-009 y SPEC-016, fase a fase por tipo de parte.
- **Dado** el fichero exportado, **cuando** se recorre entero, **entonces** no contiene ningún histórico de posiciones, ningún camino recorrido y ninguna coordenada de la jugadora.
- **Dado** el fichero exportado, **cuando** se buscan los datos del mundo, **entonces** está el anclaje redondeado de cada mapa, que es su identificador desde SPEC-003, y ninguna coordenada más precisa.

### Importar la partida

- **Dado** un jugador que guardó una copia y borró la partida, **cuando** importa el fichero, **entonces** recupera el mundo, el personaje, el diario y los rangos.
- **Dado** un fichero importado, **cuando** se compara con el original, **entonces** los documentos, el estado y el registro son idénticos byte a byte.
- **Dado** un fichero importado, **cuando** se lee la partida, **entonces** declara que vino de una importación.
- **Dado** un fichero cuyo manifiesto declara una parte que el contenedor no trae, **cuando** se importa, **entonces** falla nombrando la parte, y no se abre una partida a medias.
- **Dado** un fichero truncado, **cuando** se importa, **entonces** falla diciendo que el fichero está incompleto y la partida actual sigue intacta.
- **Dado** un fichero que no es una partida, **cuando** se importa, **entonces** falla diciendo que no lo es, sin intentar interpretarlo.
- **Dado** un fichero con una versión de formato mayor que la que el juego entiende, **cuando** se importa, **entonces** no se abre y el error declara la versión que trae y la que se esperaba.
- **Dado** una importación que falla a mitad, **cuando** se vuelve a abrir la app, **entonces** la partida anterior sigue entera y no hay ninguna partida a medias escrita.
- **Dado** una importación que va a sustituir una partida existente, **cuando** se pide, **entonces** se avisa de que la actual se pierde y se ofrece guardar una copia antes.
- **Dado** una importación confirmada, **cuando** termina, **entonces** la partida importada es la única que hay: no hay dos partidas ni ninguna manera de elegir entre ellas.
- **Dado** un fichero exportado por otra persona, **cuando** se importa, **entonces** se abre su partida entera —su mundo, su personaje, su diario y sus rangos—, que es lo que significa compartir mundo.
- **Dado** un fichero importado, **cuando** se comprueban sus documentos contra el esquema cerrado, **entonces** se validan todos antes de sustituir nada.

### El versionado y la migración

- **Dado** el juego, **cuando** se lee la versión de formato que escribe, **entonces** sale de la constante única de SPEC-009 y no de ninguna copia.
- **Dado** la cadena de migraciones, **cuando** se recorre, **entonces** cubre sin huecos desde la versión mínima soportada hasta la actual, y cada paso declara de qué versión a cuál va.
- **Dado** una cadena con un hueco entre dos versiones, **cuando** se comprueba, **entonces** falla nombrando el salto que falta.
- **Dado** un documento de una versión menor que la actual y con todos los pasos registrados, **cuando** se migra, **entonces** se aplican los pasos en orden y el resultado valida contra el esquema cerrado actual.
- **Dado** un documento de una versión menor sin paso registrado para ese salto, **cuando** se importa, **entonces** falla nombrando el salto que falta, en lugar de interpretarlo con las reglas nuevas.
- **Dado** una migración que introduce un campo que antes no existía, **cuando** se aplica, **entonces** el valor que pone está declarado en el propio paso, y no se deduce en el momento.
- **Dado** el mismo documento, **cuando** se migra dos veces desde el mismo origen, **entonces** los dos resultados son idénticos byte a byte.
- **Dado** un documento ya en la versión actual, **cuando** se pide migrarlo, **entonces** sale idéntico y ningún paso se aplica.
- **Dado** una partida migrada, **cuando** se lee, **entonces** declara desde qué versión se migró y con qué versión de reglas se hizo.
- **Dado** una partida migrada, **cuando** se compara con la original, **entonces** la original sigue en el fichero de origen sin tocar.
- **Dado** la cadena de migraciones y un paso de prueba registrado, **cuando** se ejecuta la comprobación, **entonces** se puede poner roja: el mecanismo se ejercita aunque hoy solo exista la versión 1.

### La compactación, que es la palanca de tamaño

- **Dado** una partida cuyo registro pasa del presupuesto de SPEC-016, **cuando** se compacta, **entonces** se sella un estado y el registro empieza desde el sello.
- **Dado** una partida compactada, **cuando** se reconstruye desde su registro, **entonces** se reconstruye desde el sello y el resultado es el mismo que el estado sellado más los hechos posteriores.
- **Dado** una compactación, **cuando** se busca si se han podado hechos sueltos, **entonces** no se ha podado ninguno: o están todos desde el sello o está el sello.
- **Dado** una compactación interrumpida, **cuando** se vuelve a abrir la partida, **entonces** sigue el registro anterior entero y no hay ningún sello a medias.

### Ni un rastro de ubicación, tampoco fuera del móvil

Bloqueante (`@privacidad`, RF-PRIV-002).

- **Dado** una partida de cien salidas, **cuando** se exporta y se recorre el fichero entero, **entonces** no contiene ningún histórico de posiciones.
- **Dado** ese mismo fichero, **cuando** se busca por dónde fue la jugadora de un sitio a otro, **entonces** no aparece.
- **Dado** ese mismo fichero, **cuando** se buscan lecturas de sensores, **entonces** no hay ninguna.
- **Dado** el directorio que entra en la copia del sistema, **cuando** se recorre entero, **entonces** contiene lo mismo que el fichero exportado y nada más.
- **Dado** un fichero de partida al que se le añade a mano un campo con una posición de la jugadora, **cuando** se importa, **entonces** el esquema cerrado lo rechaza nombrando el campo.

## UX Design

Esta fila tiene poca interfaz y conviene decir por qué: **guardar una copia y abrir una copia son dos acciones y ningún flujo**. Todo lo demás que entrega —el almacén, el respaldo, la migración— no tiene pantalla y no debe tenerla.

### Wireframe textual

**Guardar una copia.** Se llega desde la fila «Guardar una copia» del grupo «Tus cosas» de **A6P6**, los ajustes, y desde **A6P7**, empezar de nuevo (fila 40). Registro de aplicación, porque es donde vive. Al tocarla, la fila se sustituye en el sitio por una línea de espera —**una línea, sin barra de progreso y sin porcentaje**— mientras el fichero se empaqueta; al terminar, se abre la **hoja de compartir del sistema**, que es quien decide dónde va el fichero. Nosotros no elegimos carpeta, no proponemos servicios y no enseñamos rutas. Al volver de la hoja, la fila recupera su forma y una línea bajo ella dice, en voz de aplicación y una sola vez, que la copia está guardada. Si falla, la misma línea dice que no se ha podido guardar y la fila sigue disponible; ninguna partida se ha tocado.

**Abrir una copia.** Vive en la primera pantalla del arranque, **A1P1**, cuya composición es de la fila 27: esta spec aporta **una acción secundaria** —«Abrir una copia»— colocada por debajo de la acción principal y con menos peso. Al tocarla se abre el **selector de ficheros del sistema**; elegido el fichero, se valida y, si la partida actual existe, se enseña un aviso en voz de aplicación que dice qué se pierde y ofrece **guardar una copia primero**, **abrir la copia** y **dejarlo como está**, en ese orden y con lo destructivo sin ser el botón principal. Si no hay partida actual —el caso normal, el móvil nuevo—, no hay aviso: se abre y ya está.

**Estados de error.** Tres líneas y ninguna más: el fichero no es una partida; el fichero está incompleto; el fichero es de una versión que este juego todavía no entiende, declarando las dos versiones. Ninguna menciona rutas, códigos ni la red. La partida actual sigue intacta en los tres casos, y el texto lo dice.

**Lo que no tiene pantalla, a propósito.** La copia del sistema no se anuncia, no se configura y no tiene interruptor: pasa sola, es del sistema y no es nuestra. La migración no se explica ni pide permiso: si el fichero es más antiguo, se migra y se abre. Y el almacén duradero no existe para el jugador.

### Pantallas y elementos utilizados

```
Pantallas de otras filas a las que esta spec aporta elementos:
  A6P6  pantalla 6 · artefacto 6 — Los ajustes       (dueña: fila 38)
        aporta: a dónde lleva la fila «Guardar una copia»
  A6P7  pantalla 7 · artefacto 6 — Empezar de nuevo  (dueña: fila 40)
        aporta: la acción «Guardar una copia primero»
  A1P1  pantalla 1 · artefacto 1 — El arranque       (dueña: fila 27)
        aporta: la acción secundaria «Abrir una copia»

Elementos del sistema, no nuestros: la hoja de compartir y el selector de ficheros.
Los usamos tal cual y no los envolvemos en una pantalla propia.

Elementos nuevos:
  - la línea de espera de una sola línea, sin cifra de progreso
  - el aviso de sustitución al importar sobre una partida existente
```

### data-testid

- `momento` — el momento del bucle, con valor `de-consulta` en los ajustes y `arranque` en A1P1
- `guardar-copia` — la acción de exportar, esté en los ajustes o en empezar de nuevo
- `guardar-copia-estado` — el estado de la exportación, con un vocabulario cerrado: `inactiva`, `empaquetando`, `guardada`, `no-se-pudo`
- `abrir-copia` — la acción de importar, en A1P1
- `abrir-copia-estado` — el estado de la importación, con el mismo tipo de vocabulario cerrado: `inactiva`, `validando`, `sustituir`, `abierta`, `no-se-pudo`
- `importar-aviso-sustitucion` — el aviso que aparece solo si ya hay partida
- `importar-error` — la línea de error, con la causa en un vocabulario cerrado: `no-es-partida`, `incompleto`, `version-mayor`, `falta-migracion`

Sin más: los textos de las tres líneas de error son texto único y se localizan por su contenido.

### Patrón de interacción

- **La hoja de compartir y el selector de ficheros son del sistema y no se envuelven.** Regla: `design-system.md`, dentro del juego cualquier cosa que solo se pueda decir como aplicación es señal de rediseñar el momento; aquí estamos en el único sitio donde se habla como aplicación, y una aplicación resuelve guardar un fichero con la hoja del sistema. Un explorador propio sería inventarse una superficie que además habría que mantener.
- **La espera se cuenta con una línea y sin cifra.** Regla: `design-system.md`, ninguna cifra de progreso; y el precedente de SPEC-026, donde la generación se cuenta en fases y no en porcentajes.
- **Importar sobre una partida existente avisa; sobre un móvil limpio, no.** Regla: `partida-guardada.md` §4, lo destructivo se explica y no es el botón principal; y avisar cuando no hay nada que perder es la clase de fricción que hace que los avisos dejen de leerse.
- **La copia del sistema no tiene interruptor.** Regla: `partida-guardada.md` §3, «cubre a casi todo el mundo sin que nadie haga nada»; darle un ajuste invitaría a apagarla, que es lo contrario de la red de seguridad que es.
- **La migración ocurre sin preguntar.** Regla: es una transformación de formato, no una decisión del jugador; lo que sí se dice es cuando **no** se puede migrar, que es cuando hay algo que hacer.
- **Decisión no cubierta por el design system:** qué pasa al importar si ya hay partida. Se resuelve **sustituyendo**, con aviso y con la copia ofrecida antes, porque `alcance-del-mundo.md` §3 descarta el selector de mapas y con más razón el de partidas: dos partidas en el mismo móvil exigirían una pantalla para elegir entre ellas, que es exactamente lo que el juego no tiene.
- **Decisión no cubierta por el design system:** el nombre y la extensión del fichero. Se resuelve con un nombre compuesto del título del mundo principal de la partida y la extensión declarada, para que un fichero suelto en una carpeta se reconozca por lo que es sin abrirlo, y sin que el nombre lleve ninguna fecha ni ningún dato del jugador.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/exportacion.js` | el manifiesto canónico, la lista de partes de una partida, la validación de un manifiesto que llega y la comprobación de completitud |
| `packages/nucleo/partida/migracion.js` | el registro de pasos, la comprobación de que la cadena no tiene huecos, la aplicación en orden y el resultado declarado |
| `packages/nucleo/partida/compactacion.js` | el sellado de un estado y el reinicio del registro desde el sello |
| `app/` — el almacén duradero | la implementación de las cuatro operaciones de SPEC-009 sobre el sistema de ficheros del dispositivo, con escritura atómica |
| `app/` — el empaquetador | de la lista de partes a un fichero y del fichero a la lista de partes |
| `app/` — las reglas de respaldo | la declaración de qué entra y qué no en la copia del sistema, en un fichero legible por una prueba |

El reparto está elegido para que **casi todo sea afirmable en `@nucleo`**: el manifiesto, la lista de partes, la completitud, la cadena de migraciones, la idempotencia de migrar, la compactación y la ausencia de rastro en el fichero son funciones puras sobre datos, y se comprueban con `node --test` y un almacén de memoria. El empaquetado y la escritura atómica se comprueban en Node contra el sistema de ficheros real, que también es `node --test`. Lo único que necesita dispositivo es que la copia del sistema incluya de verdad el directorio, y para eso esta spec deja **las reglas de respaldo como fichero declarativo**: una prueba de `@nucleo` puede afirmar que toda clave que el almacén escribe cae dentro de lo incluido, que es la mitad verificable del requisito y la que se rompe de verdad.

### Frontera de inyección

Dos entradas nuevas, las dos con doble en Node:

1. **Almacén duradero** — las cuatro operaciones de SPEC-009 sobre el dispositivo. La atomicidad es suya, como fija SPEC-009: se escribe en una clave temporal y se sustituye, nunca se sobrescribe en sitio. Dobles: el almacén en memoria que ya existe, uno que falla al escribir y uno que se interrumpe entre la escritura y la sustitución.
2. **Empaquetador** — recibe una lista de partes con su nombre lógico y su contenido y produce un fichero, y al revés. Vive en la frontera porque el paquete no tiene dependencias y un contenedor de ficheros no se escribe sin una. El núcleo produce y valida el **manifiesto**, que es lo que decide si un fichero es una partida.

**La ausencia de cualquiera de las dos es error de construcción en la app**, no un modo degradado. `packages/nucleo/` sigue funcionando entero en memoria sin almacén, como fija SPEC-009 y como necesita `node --test`; lo que no puede pasar es que la **app** arranque sin almacén duradero y pierda la partida al cerrar sin que nada proteste. Es la séptima aparición de la familia de §6h y se corta aquí por construcción.

### El contenedor, y por qué el núcleo no lo escribe

El fichero es un contenedor de partes con el **manifiesto como primera parte**. El núcleo no sabe qué contenedor es: entrega la lista de partes en orden canónico y el manifiesto, y valida lo que le devuelvan. Así el paquete sigue sin dependencias (`arquitectura.md`) y «byte a byte» sigue siendo una afirmación sobre datos y no sobre un compresor.

Dos propiedades del contenedor que sí son criterio y no detalle: **no lleva fechas** —ni de creación ni de modificación de sus entradas—, porque una fecha real rompería la exportación determinista y metería en el fichero un dato sobre la vida de la jugadora; y **no comprime**, por la misma razón por la que SPEC-009 no comprime: comprimir haría que dos ficheros iguales dependieran de la versión del compresor.

### Qué va dentro, y la decisión que `partida-guardada.md` dejó abierta

Dentro va **todo**: el índice y los documentos de todas las celdas de todos los mapas, el estado, el registro de hechos, los recursos binarios residentes y **los textos cacheados del narrador**.

Lo último es el pendiente 4 de `partida-guardada.md` —«si los textos cacheados del LLM se exportan también»— y aquí se cierra en **sí**. El documento mismo da el argumento: «son la piel de esa partida; sin ellos el mundo se lee con los textos de plantilla y no suena igual». Y hay uno más, decisivo para RF-PERS-005: el fichero es también la vía de compartir mundo, y un mundo compartido sin sus textos no es el mismo mundo. El precio son megas, y el precio se paga midiendo: el criterio de tamaño obliga a declarar cuánto pesa cada tipo de parte, que es el instrumento con el que se decidirá la poda si algún día hace falta.

### La migración, y cómo se evita que sea un criterio vacío

Hoy la versión de formato vale 1 y no hay ninguna migración que hacer. Un criterio que dice «migrar funciona» y que no se puede poner rojo no mide nada (§6o). Así que el mecanismo se especifica de forma que **se ejercite sin esperar a la versión 2**:

- La cadena es un **registro explícito de pasos**, cada uno declarando de qué versión a cuál va. La comprobación de que no tiene huecos entre la versión mínima soportada y la actual es una afirmación sobre el registro y se puede poner roja hoy mismo, registrando un paso mal declarado.
- El registro es **inyectable**, de modo que una prueba puede registrar un paso de prueba y ejercitar la aplicación en orden, la idempotencia y el fallo por salto ausente sin tocar el formato real.
- **Faltar un paso es un error nombrado**, nunca una interpretación optimista: un documento de la versión N-1 sin su paso no se abre con las reglas nuevas. Es exactamente lo que SPEC-009 dejó escrito y aquí se implementa.
- Una migración **no deduce**: si añade un campo, el valor lo pone el propio paso. Deducirlo en el momento haría que migrar el mismo fichero en dos versiones del juego diera resultados distintos.

### La compactación, que SPEC-016 dejó anotada para esta fila

SPEC-016 fijó el presupuesto de tamaño y declaró que, si no se cumple, **la palanca es compactar por instantánea y nunca podar hechos sueltos**, y que la compactación es de esta fila porque es la que saca el fichero del móvil. Aquí se entrega: sellar un estado, empezar el registro desde el sello, y conservar la propiedad de que lo que hay basta para reconstruir desde el sello. Podar sigue prohibido, y hay criterio para comprobarlo.

### Qué sale del móvil, dicho en voz alta

`seguridad-privacidad.md` §1 dice que del móvil no sale nada del jugador; `partida-guardada.md` §3 matiza que en la copia del sistema **sí sale**, cifrada, hacia la cuenta del propio jugador y sin pasar por un servidor nuestro. Las dos cosas son verdad y la frontera es esta:

| Sale, dentro del respaldo cifrado del propio jugador | No sale, porque no existe |
| --- | --- |
| el mundo congelado de cada mapa, con su anclaje redondeado | la posición exacta desde la que se levantó ningún mapa |
| el estado y el registro de hechos | cualquier histórico de posiciones o camino recorrido |
| el diario, la repisa, los rangos y los motes | cualquier lectura de sensor |
| el personaje con su nombre, su género y su oficio | cualquier marca del reloj real de la vida de la jugadora |
| los textos del narrador cacheados | cualquier identificador del dispositivo o de una cuenta nuestra |

El anclaje redondeado está en la columna de la izquierda y conviene no disimularlo: es el identificador de un mapa desde SPEC-003, es un redondeo y no un portal, y sin él no hay partida que restaurar.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

- De **«Empezar de nuevo borra y no reinicia»** (`@app @persistencia`): **«La copia guardada se puede volver a abrir»**, entero, que es el escenario que esta fila existe para hacer verdad.
- De **«El mundo se congela entero»** (`@nucleo @persistencia`): **«El mundo no depende de OSM después de generarse»** y **«Una salida entera se juega sin red»**, de los que esta fila entrega por fin la mitad que faltaba —que lo congelado **dura**—; y **«El estado manda sobre el registro»**, del que aquí se sostiene el orden de escritura sobre un almacén real.
- De **«Del móvil no sale nada del jugador»**, bloqueante: **«El rastro de ubicación no se guarda nunca»**, que aquí se afirma sobre el fichero exportado y sobre el directorio respaldado, que es donde de verdad podría escaparse.
- **Frontera, que esta spec deja preparada y no implementa:** **«La copia se ofrece pero no se hace sola»** y **«Borrar lleva al arranque»** (fila 40), y **«El jugador viaja entero»** (fila 41).

### Huecos de la batería que esta spec deja al descubierto

Los dos primeros están marcados como tales en el propio PRD y esta spec los convierte en criterios; añadirlos a `docs/testing.md` es de quien la mantiene.

1. **RF-PERS-004 no tiene escenario** —«inclusión en el respaldo»—. La mitad verificable sin dispositivo es que las reglas de respaldo cubran toda clave que el almacén escribe, y es la mitad que se rompe: una clave nueva que nadie añade a las reglas se queda fuera de la copia sin que nada proteste.
2. **RF-PERS-008 no tiene escenario.** Ni la cadena sin huecos, ni el fallo por salto ausente, ni que migrar dos veces dé lo mismo.
3. **La persistencia entre aperturas de la app no tiene escenario en ningún sitio.** Que cerrar el juego no pierda la partida es la promesa más básica del proyecto y hasta esta fila no había código que la cumpliera.
4. **La escritura atómica y el apagón a mitad no tienen escenario**, aunque SPEC-009 y SPEC-016 los dan por resueltos «por el almacén»: hasta ahora no había almacén.
5. **La compactación no tiene escenario**, y es la palanca con la que se cierra el pendiente 1 de `partida-guardada.md`.
6. **Compartir mundo importando el fichero de otra persona no tiene escenario**, y es la mitad de RF-PERS-005 que nadie ha probado.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN`). Regla: `CLAUDE.md` y el grep que cruza specs y batería.
- **Sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`.
- **Los textos cacheados del narrador se exportan** → asumido, cerrando el pendiente 4 de `partida-guardada.md` (alternativa: dejarlos fuera para que el fichero pese menos, y que el mundo importado se lea con textos de plantilla). Regla: el propio documento los llama «la piel de esa partida», y el fichero es la vía de compartir mundo: un mundo compartido sin sus textos no es el mismo mundo. Es la decisión más discutible de esta spec, porque es la que decide cuánto pesa un fichero, y por eso lleva criterio de medida detrás.
- **Importar sustituye la partida actual y no crea una segunda** → asumido (alternativa: coexistir y ofrecer elegir). Regla: `alcance-del-mundo.md` §3 descarta el selector de mapas por ser incoherente con un juego que va de andar; un selector de partidas es lo mismo un nivel más arriba. Consecuencia declarada: importar el fichero de otra persona abre **su** partida entera, personaje incluido, y una importación parcial de «solo el mundo» queda como pendiente abierto.
- **El contenedor no lleva fechas y no comprime** → asumido (alternativa: un contenedor estándar con sus fechas y su compresión). Regla: exportar dos veces la misma partida tiene que dar el mismo fichero, y con fechas no puede; comprimir haría que «byte a byte» dependiera del compresor, que es lo mismo que descartó SPEC-009.
- **El núcleo produce el manifiesto y la lista de partes, y el empaquetado vive en la frontera** → asumido (alternativa: que el núcleo escriba el fichero). Regla: `arquitectura.md`, el paquete no tiene dependencias; y así el criterio de que un fichero sea una partida es una validación de datos, comprobable sin fichero.
- **La app sin almacén duradero cableado no arranca** → asumido (alternativa: caer al almacén en memoria, como hoy). Regla: §6h; una app que juega perfectamente y pierde la partida al cerrar es la degradación silenciosa más cara posible, y es exactamente el estado en el que SPEC-026 dejó las cosas.
- **Las reglas de respaldo viven en un fichero declarativo que una prueba puede leer** → asumido (alternativa: configurarlas solo en el manifiesto de cada plataforma). Regla: §6o; si la única forma de comprobar RF-PERS-004 es restaurar un móvil a mano, el requisito no se puede poner rojo nunca. Con el fichero declarativo, al menos la correspondencia entre lo que se escribe y lo que se respalda es verificable.
- **La cadena de migraciones es un registro inyectable y se ejercita con un paso de prueba** → asumido (alternativa: escribir el mecanismo y esperar a la versión 2 para probarlo). Regla: §6o, un criterio que se cumple siempre porque no hay nada que migrar no mide nada.
- **Una migración declara los valores que introduce en lugar de deducirlos** → asumido (alternativa: rellenar campos nuevos con la lógica actual del juego). Regla: deducir haría que migrar el mismo fichero en dos versiones diera resultados distintos, que es la propiedad que la migración existe para no romper.
- **Migrar no ocurre en silencio dentro de la partida abierta: ocurre al importar o al abrir, y queda declarado en la partida** → asumido (alternativa: migrar y no dejar rastro). Regla: SPEC-016 ya guarda la versión de reglas para poder avisar de que un resultado puede diferir; sin dejar rastro, ese aviso no tendría con qué compararse.
- **El fichero no lleva firma ni resumen de integridad** → asumido (alternativa: firmarlo). Regla: la misma que SPEC-009 aplicó a los documentos —un fichero truncado ya falla al leerse y el error lo nombra—, y una firma sin nadie que la verifique del otro lado no compra nada; compartir mundo es entre personas que ya se conocen.
- **El nombre del fichero se compone del título del mundo y no lleva fecha ni nada del jugador** → asumido (alternativa: un nombre con la fecha, que es lo que hace todo el mundo). Regla: una fecha en el nombre del fichero es un dato sobre la vida de la jugadora en un sitio que se comparte por mensajería.
- **Exportar no toca la partida y no marca nada en ella** → asumido (alternativa: guardar cuándo se hizo la última copia y enseñarlo en ajustes). Regla: guardar cuándo exige el reloj real, que la partida no tiene; y una línea que diga «última copia hace tres meses» es un reproche, que es justo el registro que este juego no usa.
- **La compactación no se ofrece al jugador y no tiene pantalla** → asumido (alternativa: un ajuste de «liberar espacio»). Regla: `partida-guardada.md` pendiente 1 sigue abierto y decidir la poda no es de esta fila; y un ajuste que promete liberar espacio invita a borrar lo que el juego promete no borrar.
