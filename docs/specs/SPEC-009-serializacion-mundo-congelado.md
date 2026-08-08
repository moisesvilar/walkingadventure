# SPEC-009 — El mundo congelado y su serialización

## Descripción

Convierte un mundo recién generado en un documento que se guarda en el móvil y del que se vuelve a levantar idéntico: núcleos con sus servicios, parajes, calzadas y ramales con su trazado y sus marcas, terreno, máscara de mar, nombres, anclajes reales, y los huecos donde encajan las ilustraciones, las fotos del lado real y los textos que escriba el LLM. A partir de ese documento el mapa del jugador deja de depender de OpenStreetMap para siempre, y con él —más los recursos que la preparación de la salida deja residentes— una salida entera se camina sin una sola petición de red.

No tiene interfaz de usuario: es la capa `partida/` del núcleo determinista, la que SPEC-002 dejó reservada por nombre y sin crear. El jugador no ve nada de esto salvo por lo que no le pasa: que su mapa sigue siendo el mismo un año después, que abrir el diario en el metro funciona, y que quedarse sin cobertura a mitad de una aventura no interrumpe nada.

Anclas: **RF-PERS-001** y **RF-PERS-002** (`docs/prd.md` §4.10) y **RNF-RED-002** (§5.3), con `game-design/partida-guardada.md` §1 como fuente que manda sobre el PRD, `game-design/quests.md` decisión 1 para los textos que se guardan con la partida y `game-design/seguridad-privacidad.md` §1 para lo que no puede entrar en el documento. Se apoya en lo que ya especificaron SPEC-002 (la disposición del paquete y el área `partida/`), SPEC-003 (el anclaje redondeado del mapa, los índices de celda y las costuras), SPEC-005 (el identificador nativo del anclaje y la capa refrescable de Places) y SPEC-007 (la marca de suposición en aristas y tramos): ninguna de esas decisiones se reabre aquí, se congelan tal como llegan.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí sí la toca**: aparece una salida nueva, el almacén de la partida, y una lectura de reloj acotada a un solo campo; las dos están descritas en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el estado del jugador y el registro de hechos, con su regla de que manda el estado (fila 16, RF-PERS-003); exportar e importar la partida a un fichero, la inclusión en la copia del sistema y **la migración entre versiones del formato** (fila 39, RF-PERS-004, RF-PERS-005, RF-PERS-008); empezar de nuevo (fila 40); la lista de mapas de una partida y qué mapa está activo (fila 41); generar los textos del LLM (fila 18) y las ilustraciones y las fotos (fila 25), de las que aquí solo se entrega el hueco donde encajan; y el casting de plantillas contra el mundo (fila 10), que consume el mundo congelado y no se guarda con él.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «Qué se congela», «El ida y vuelta» y «Un documento por celda, un índice por mapa»; la validación de entradas, en «La versión del formato» y en el esquema cerrado que rechaza un campo de más o un campo ausente; el estado vacío, en el almacén sin ningún mapa, en el mapa sin ninguna celda abierta y en el mundo sin ninguna ilustración ni ningún texto residente; el estado de error, en el documento truncado, en la versión de formato que el juego no entiende, en la celda que el índice declara y el almacén no tiene y en el almacén que falla al escribir; y los casos límite, en los valores que JSON no sabe escribir, en las propiedades colgadas de arrays, en la celda vecina que se abre sin tocar la propia y en el presupuesto de tamaño del fixture urbano denso.

Los criterios se escriben en Gherkin español, el mismo `Dado / Cuando / Entonces` de `docs/testing.md`. «Mundo congelado X» —cuando se habla de datos de entrada— sigue significando el fixture `test/fixtures/osm/X/` que entregó SPEC-001; «documento» significa siempre el resultado de esta spec, que es cosa distinta y por eso se nombra distinto.

### Qué se congela

- **Dado** un mundo recién generado, **cuando** se congela la celda, **entonces** el documento contiene el terreno, los núcleos con sus servicios, los parajes, las calzadas, los ramales, el callejero, la máscara de mar, los nombres y el título del mundo.
- **Dado** un documento de celda, **cuando** se lee cualquier núcleo, servicio o paraje anclado a un lugar real, **entonces** lleva el identificador nativo de su anclaje en la forma que fijó SPEC-005 (`osm:node/123456`, `places:ChIJ...`).
- **Dado** un documento de celda, **cuando** se lee cualquier tramo de calzada, de ramal o de callejero, **entonces** lleva su marca de suposición declarada, con el mismo valor que tenía en el grafo: nulo, `'cosida'` o `'fallback'`.
- **Dado** un mundo con aristas cosidas, **cuando** se congela y se vuelve a levantar, **entonces** el grafo reconstruido no cose ni un hueco más: lo cosido llega congelado como dato.
- **Dado** un documento de celda, **cuando** se lee su cabecera, **entonces** declara el identificador del mapa, el índice de la celda, el lado de la celda y el tramo con el que se dimensionó.
- **Dado** un documento de celda, **cuando** se lee su cabecera, **entonces** declara el idioma del que salieron los nombres.
- **Dado** un mundo generado en una celda costera, **cuando** se congela, **entonces** la máscara de mar entra en el documento y no se recalcula al cargar.
- **Dado** un documento de celda, **cuando** se busca en él la respuesta cruda de Overpass o cualquier texto de consulta, **entonces** no aparece.
- **Dado** un documento de celda y ninguna fuente de datos inyectada, **cuando** se levanta el mundo, **entonces** se obtiene el mundo entero sin pedir nada a nadie.
- **Dado** un mundo levantado desde su documento, **cuando** cambian por completo los datos de OSM de esa zona, **entonces** el mundo sigue siendo el mismo.

### El ida y vuelta

- **Dado** un mundo recién generado, **cuando** se congela, se levanta y se vuelve a congelar, **entonces** los dos documentos son idénticos byte a byte.
- **Dado** un mundo recién generado y el mismo mundo levantado desde su documento, **cuando** se comparan campo a campo, **entonces** no hay ninguna diferencia.
- **Dado** un mundo recién generado y el mismo mundo levantado desde su documento, **cuando** se castean las plantillas contra los dos, **entonces** el resultado del casting es el mismo.
- **Dado** un mundo cuyos ríos llevan su tipo, **cuando** se congela y se levanta, **entonces** cada río conserva el suyo.
- **Dado** un mundo en el que alguna propiedad viaja colgada de un array en lugar de en un campo de objeto, **cuando** se congela, **entonces** la validación falla nombrando el campo, en lugar de escribir un documento al que le falta el dato.
- **Dado** un mundo con un valor que JSON no sabe escribir —`NaN`, `Infinity` o `undefined`—, **cuando** se congela, **entonces** falla nombrando el campo.
- **Dado** un mundo con un `Map`, un `Set` o una función colgando de cualquier campo, **cuando** se congela, **entonces** falla nombrando el campo.
- **Dado** un documento levantado, **cuando** se comparan sus números con los del mundo original, **entonces** ninguno ha cambiado de valor.
- **Dado** un mundo con nombres acentuados y en gallego, **cuando** se congela y se levanta, **entonces** los nombres vuelven idénticos, carácter a carácter.
- **Dado** el mismo mundo, **cuando** se congela dos veces, **entonces** los dos documentos son idénticos byte a byte.
- **Dado** un documento de celda, **cuando** se inspecciona el orden de sus listas, **entonces** cada una está ordenada por un criterio declarado y estable, y ninguna por el orden en que se insertaron sus elementos.
- **Dado** un mundo cuyos elementos se recorren en otro orden al congelar, **cuando** se compara el documento, **entonces** es idéntico al anterior.

### La versión del formato

- **Dado** cualquier documento escrito por esta entrega, **cuando** se lee, **entonces** lleva un campo de versión de formato, entero, con valor 1.
- **Dado** el paquete entregado, **cuando** se busca de dónde sale ese entero, **entonces** hay una sola constante y todos los documentos la toman de ahí.
- **Dado** un documento sin campo de versión, **cuando** se intenta levantar, **entonces** se rechaza nombrando el campo que falta, antes de interpretar nada más.
- **Dado** un documento con una versión de formato mayor que la que el juego entiende, **cuando** se intenta levantar, **entonces** no se abre y el error declara la versión que trae y la que se esperaba.
- **Dado** un documento con una versión de formato menor que la actual, **cuando** se intenta levantar, **entonces** el error declara que hace falta migrarlo, sin intentar interpretarlo con las reglas nuevas.
- **Dado** un documento, **cuando** se lee su cabecera, **entonces** declara con qué versión del generador se escribió.
- **Dado** un documento, **cuando** se levanta, **entonces** la versión del formato se comprueba antes que cualquier otro campo.

### Un documento por celda, un índice por mapa

- **Dado** un mapa con la celda «0,0» congelada, **cuando** se abre y se congela la celda «1,0», **entonces** el documento de «0,0» sigue idéntico byte a byte.
- **Dado** un mapa con dos celdas contiguas congeladas, **cuando** se lee el índice del mapa, **entonces** declara las dos celdas abiertas y la costura de calzadas del borde que comparten.
- **Dado** el índice de un mapa, **cuando** se lee su identificador, **entonces** es el anclaje redondeado del mapa que fijó SPEC-003, y no una coordenada más fina.
- **Dado** un mapa con veinte celdas abiertas, **cuando** se carga el mapa, **entonces** se lee el índice y ninguna celda, hasta que alguna haga falta.
- **Dado** un índice que declara una celda que el almacén no tiene, **cuando** se carga el mapa, **entonces** falla nombrando la celda que falta, sin devolver un mapa a medias.
- **Dado** el índice de un mapa, **cuando** se busca en él la semilla de la partida, **entonces** no aparece.
- **Dado** un mapa recién creado sin ninguna celda congelada todavía, **cuando** se carga, **entonces** se obtiene un mapa con cero celdas abiertas y ningún error.

### Lo que no se congela

- **Dado** un documento de celda, **cuando** se buscan los anclajes libres que ningún elemento consumió, **entonces** no aparecen.
- **Dado** un documento de celda, **cuando** se busca el casting de plantillas, **entonces** no aparece.
- **Dado** un documento de celda, **cuando** se busca la auditoría de la generación —qué núcleos y parajes se movieron hasta el viario—, **entonces** no aparece.
- **Dado** un documento de celda, **cuando** se buscan los rangos, el diario, la repisa, los rumores en vuelo o cualquier dato del jugador, **entonces** no aparecen: el documento describe el mundo y nada más.
- **Dado** un documento de celda, **cuando** se busca el contenido binario de una imagen o de una foto, **entonces** no aparece, ni en línea ni codificado.
- **Dado** un documento de celda, **cuando** se comprueba su esquema, **entonces** es cerrado: un campo que no esté declarado hace fallar la validación nombrándolo.

### Ilustraciones, fotos y textos: los huecos de B3 y B4

- **Dado** un elemento del mundo que puede llevar ilustración, **cuando** se congela la celda, **entonces** el documento guarda su prompt de ficción y la clave derivada de él, más la referencia al recurso local o la declaración de que no lo hay.
- **Dado** un anclaje con foto del lado real, **cuando** se congela la celda, **entonces** el documento guarda su `place_id`, la referencia al recurso local y la fecha de captura, y ninguna URL de Places.
- **Dado** un texto ya validado del LLM, **cuando** se congela la celda, **entonces** se guarda en línea con su clave y con su origen declarado, `llm` o `plantilla`.
- **Dado** un mundo sin ninguna ilustración, ninguna foto y ningún texto del LLM, **cuando** se congela y se levanta, **entonces** el mundo está completo y jugable, y cada hueco declara que está vacío.
- **Dado** un mundo cuya ilustración de un paraje no está residente, **cuando** se juega ese paraje, **entonces** el juego cae al material de plantilla sin pedir nada a la red.
- **Dado** un anclaje sin foto residente, **cuando** se abre su visor, **entonces** abre igual con la cartela sobre fondo liso.
- **Dado** un mundo congelado y una aventura, **cuando** se pregunta qué le falta para jugarse sin red, **entonces** se enumeran los recursos ausentes sin hacer ninguna petición.
- **Dado** un mundo congelado con todos sus recursos residentes, **cuando** se pregunta lo mismo, **entonces** la respuesta es que no falta nada.
- **Dado** el área `partida/` del paquete, **cuando** se inspeccionan sus imports, **entonces** ninguno habla con la red: los huecos se rellenan desde fuera.
- **Dado** un documento escrito sin ilustraciones y otro escrito después con ellas ya residentes, **cuando** se comparan las dos capas de ficción, **entonces** no ha cambiado ni un nombre, ni un tipo, ni una posición.

### El tamaño, que se mide

- **Dado** el mundo congelado urbano denso, **cuando** se genera su celda y se congela, **entonces** el documento ocupa menos de 2 MB sin comprimir.
- **Dado** el mundo congelado del suelo de 250 m, **cuando** se genera su celda y se congela, **entonces** el documento ocupa menos de 200 KB sin comprimir.
- **Dado** un mapa con veinte celdas abiertas, **cuando** se congela su índice, **entonces** ocupa menos de 100 KB.
- **Dado** un documento de celda, **cuando** se leen sus coordenadas, **entonces** están en metros relativos al anclaje del mapa, y no en grados repetidos elemento a elemento.
- **Dado** una calzada cuyo trazado recorre tramos del callejero, **cuando** se lee el documento, **entonces** los cita por su identificador en lugar de copiar sus puntos.
- **Dado** los recursos binarios de un mapa, **cuando** se mide el documento, **entonces** no cuentan dentro de él: viven aparte y se miden aparte.

### Ni un rastro de ubicación

- **Dado** un documento de celda o el índice de un mapa, **cuando** se recorren todos sus campos, **entonces** no hay ninguna posición del jugador ni ningún histórico de posiciones.
- **Dado** un jugador que ha andado cien salidas, **cuando** se comparan los documentos del mundo antes y después, **entonces** son idénticos byte a byte: el mundo congelado no crece al andar.
- **Dado** el índice de un mapa, **cuando** se lee su anclaje, **entonces** es el redondeado, y la coordenada exacta del arranque no está en ningún campo.
- **Dado** cualquier documento de esta entrega, **cuando** se buscan marcas de tiempo del reloj real, **entonces** la única es la fecha de captura del contenido refrescable de Places.
- **Dado** un mundo al que se le añade un campo con una posición del jugador, **cuando** se congela, **entonces** el esquema cerrado lo rechaza nombrando el campo.

### Cargar: lo vacío, lo roto y lo que falla

- **Dado** un almacén sin ningún mapa, **cuando** se listan los mapas de la partida, **entonces** se obtiene una lista vacía y no un error.
- **Dado** un documento truncado a la mitad, **cuando** se intenta levantar, **entonces** falla nombrando el documento y no devuelve ningún mundo a medias.
- **Dado** un documento válido al que le falta un campo obligatorio, **cuando** se intenta levantar, **entonces** falla nombrando el campo.
- **Dado** un almacén que falla al escribir, **cuando** se congela una celda, **entonces** el error se propaga y el documento anterior sigue intacto.
- **Dado** la misma celda congelada dos veces con el mismo mundo, **cuando** se comparan los documentos escritos, **entonces** son idénticos byte a byte.
- **Dado** el módulo de partida sin almacén inyectado, **cuando** se congela un mundo, **entonces** se obtiene el documento en memoria y no se escribe nada en ningún sitio.

### La red, solo en dos momentos

- **Dado** el inspector de tráfico saliente en modo estricto, **cuando** se carga un mapa entero desde su almacén, **entonces** no se registra ninguna petición.
- **Dado** el inspector en modo estricto y un mundo ya generado, **cuando** se congela, **entonces** no se registra ninguna petición.
- **Dado** un mundo congelado, una aventura preparada y todos sus recursos residentes, **cuando** se juega la salida entera con el inspector en modo estricto, **entonces** no se registra ninguna petición.
- **Dado** el doble del proxy en modo falla siempre, **cuando** se carga el mapa y se recorre la salida entera, **entonces** todo funciona y ninguna pantalla menciona la red.
- **Dado** una celda ya abierta, **cuando** el jugador la vuelve a pisar, **entonces** se lee del almacén y no se consulta OSM.

## Notas técnicas

### Qué entrega esta spec

El área `partida/` que SPEC-002 dejó reservada, con cuatro piezas y nada más:

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/formato.js` | la constante de versión del formato, el esquema cerrado de cada documento, la validación estructural y la canonicalización |
| `packages/nucleo/partida/mundo.js` | congelar un mundo generado en documento de celda y volver a levantarlo |
| `packages/nucleo/partida/mapa.js` | el índice del mapa: anclaje, celdas abiertas, costuras del borde |
| `packages/nucleo/partida/recursos.js` | el inventario de ilustraciones, fotos y textos, y la pregunta de qué falta para jugar sin red |

### Frontera de inyección

Dos entradas nuevas, y las dos por la misma razón: el núcleo no toca la plataforma.

- **El almacén de la partida**, con cuatro operaciones —leer por clave, escribir por clave, listar por prefijo y borrar—, inyectado por quien construye la partida. **La atomicidad de la escritura es del almacén**, no del núcleo: escribir y sustituir, nunca sobrescribir en sitio, para que un apagón a mitad no deje un documento truncado donde había uno bueno. El núcleo se limita a producir y consumir documentos, y sin almacén inyectado sigue funcionando entero en memoria, que es como corre en `node --test`.
- **Un reloj**, inyectado y usado en un solo campo: la fecha de captura del contenido refrescable de Places, que SPEC-005 exige guardar. No entra en ninguna decisión de generación y por eso no rompe RNF-DET-001; se inyecta para que una prueba pueda fijarlo y para que el documento siga siendo comparable byte a byte.

### La forma del documento

Dos documentos por mapa, y la partición no es estética: el escenario «Abrir una celda vecina no toca la celda propia» exige que la celda propia siga idéntica **byte a byte** después de abrir la vecina, y eso no se puede afirmar si las dos viven en el mismo fichero.

- **El índice del mapa** — identificador (el anclaje redondeado de SPEC-003), título del mundo, idioma, lado de celda, tramo con el que se dimensionó, lista de celdas abiertas y costuras del borde entre celdas contiguas. Es pequeño y se lee siempre; es lo que permite responder «¿en qué mapa estoy?» sin cargar geometría.
- **Un documento por celda** — todo lo generado dentro de esa celda. Se carga cuando hace falta y se escribe una sola vez, al congelarla.

La **canonicalización** es lo que hace afirmable «byte a byte»: claves en el orden que declara el esquema, listas ordenadas por identificador estable, ningún campo con valor `undefined`, y los números tal como los escribe JSON, que ya produce la representación más corta que vuelve al mismo valor. Nada se redondea al volcar.

### El presupuesto de tamaño, y qué palanca se toca si no se cumple

`partida-guardada.md` §1 dice «unos pocos megas por mapa, con las polilíneas de calzadas y terreno como grueso», y eso es un criterio, no un número. Los tres números de los criterios de aceptación —2 MB en el urbano denso, 200 KB en el suelo de 250 m, 100 KB de índice con veinte celdas— salen de aplicar ese criterio a los fixtures que ya existen, y son el instrumento con el que se cierra el pendiente 1 de `partida-guardada.md` (la poda de mapas): con la medida delante se puede decidir si veinte mapas se podan, se comprimen o simplemente no importan.

Tres decisiones de forma cargan casi todo el peso, y por eso son criterios y no comentarios: coordenadas en metros relativos al anclaje del mapa en lugar de grados repetidos; calzadas que citan tramos del callejero por identificador en lugar de copiar sus puntos; y recursos binarios fuera del documento.

**Si el presupuesto no se cumple, la palanca es cuantizar las coordenadas en la generación, nunca redondear al volcar.** Redondear al escribir rompería el ida y vuelta exacto, que es el criterio central de esta spec; cuantizar en la generación produce mundos ligeramente distintos y por tanto es una iteración de la fila que genere esa geometría, con su nota en `docs/starting.md`.

### Lo que se congela aunque parezca derivable

La regla es una: **se congela todo lo que una versión futura del código podría calcular distinto**. La máscara de mar es el caso que obliga a decirlo en voz alta, porque es tentador recalcularla desde las costas guardadas y ahorrarse el bulto. No se hace: el mar pintado es parte del mapa, «El mapa no cambia durante la salida» y RF-PERS-001 no admiten que un cambio en `buildSeaMask` repinte el mundo de alguien. Se guarda en su forma compacta —rejilla de bits con su origen y su paso—, que es la que la hace asumible.

Lo mismo, y por lo mismo, con **el resultado del cosido**: las aristas `'cosida'` y los tramos `'fallback'` de SPEC-007 se congelan como dato. Levantar un mundo no vuelve a coser nada, así que cambiar `COSER_MAX` mañana no altera ningún mapa ya generado.

Y al revés: **no se congela lo que es entrada de una decisión posterior y no del mundo**. El casting de plantillas no entra —se recompone contra el mundo congelado cada vez que hace falta, y las aventuras aceptadas viven en el estado, fila 16—; los anclajes libres que nadie consumió tampoco, porque marcar un anclaje lo saca del casting sin resembrar y no hace falta un repuesto; y la auditoría de qué se movió hasta el viario es diagnóstico de generación, no mundo.

### Los tres huecos de B3 y B4

Las ilustraciones (fila 25), las fotos de Places (fila 25) y los textos del LLM (fila 18) no existen todavía. Lo que esta spec entrega es la **forma del hueco**, para que esas filas encajen su contenido sin renegociar el formato ni subirle la versión:

| Hueco | Qué guarda el documento | Qué no guarda |
| --- | --- | --- |
| Ilustración | el prompt de ficción, la clave derivada de él, la referencia al recurso local y su estado | el binario, ni codificado ni en línea |
| Foto del lado real | el `place_id`, la referencia al recurso local y la fecha de captura | el binario, ni ninguna URL de Places, que caduca |
| Texto del LLM | el texto ya validado, su clave y su origen (`llm` o `plantilla`) | nada: es texto y pesa poco |

Las claves no son inventadas: son las mismas con las que RF-INFRA-002 dice que el proxy cachea lo inerte —las imágenes por su prompt de ficción, las fotos por sitio—, y guardar la clave en lugar del binario es lo que permite volver a pedir un recurso perdido sin tocar la capa de ficción. El prompt de ficción, además, es por construcción un texto sin ningún dato real (`seguridad-privacidad.md` §1), así que guardarlo no reintroduce por la puerta de atrás lo que el prompt tenía prohibido llevar.

`recursos.js` responde una sola pregunta, y es la que sostiene RF-PERS-002: dada una aventura y el inventario de lo residente, **qué falta para poder jugarla sin red**. La pregunta se responde sin salir a ningún sitio; conseguir lo que falte es de la preparación de la salida (fila 28), y generarlo, de las filas 18 y 25.

### La versión del formato nace aquí y migra en la fila 39

RF-PERS-008 es de la fila 39 y no se implementa aquí. Pero **el campo nace en esta entrega o no nace**: un documento escrito sin versión no se puede migrar después, porque no hay forma de saber con qué reglas se escribió. La frontera queda así, y no admite interpretación:

- **Aquí:** el campo existe con valor 1, sale de una constante única, se lee antes que cualquier otro campo, y hay tres respuestas cerradas —la versión es la mía y abro; es mayor y no abro, declarando las dos versiones; es menor y declaro que hay que migrar—.
- **En la fila 39:** transformar un documento de la versión N a la N+1, la cadena de migraciones, y qué se le dice al jugador cuando ocurre.

El documento declara además con qué versión del generador se escribió. No se usa para decidir nada en esta entrega: existe porque la reconstrucción de emergencia de `partida-guardada.md` §2 tiene que poder avisar de que el resultado puede diferir, y sin ese dato el aviso no se puede fundamentar.

### Escenarios de `docs/testing.md` que esta spec verifica

Se referencian por su nombre literal, no se duplican: la batería se escribió antes que el código y sus nombres son el contrato con `wa-qa-dev`.

- **«El mundo se congela entero»** → «El mundo no depende de OSM después de generarse» y «Una salida entera se juega sin red», que son los dos escenarios que esta spec existe para hacer verdad. «El estado manda sobre el registro» y «El registro basta para reconstruir» son de la misma característica y **no** son de aquí: los implementa la fila 16.
- **«Lo generado no se resiembra jamás»** → «Abrir una celda vecina no toca la celda propia», que es lo que obliga a un documento por celda; «Cambiar el tramo del jugador no redimensiona un mundo ya generado» y «Cambiar el estilo de pintado no resiembra nada», que aquí se afirman sobre el documento y no sobre la memoria.
- **«El mundo es una función de la semilla y de los datos de OSM»** → «Dos generaciones con la misma semilla dan el mismo mundo» y «El orden de iteración no depende del orden de inserción», que con documentos canónicos pasan de comparar objetos a comparar bytes.
- **«Del móvil no sale nada del jugador»**, bloqueante → «El rastro de ubicación no se guarda nunca», que se afirma literalmente sobre lo que esta spec escribe, y «Las fotos de Places se piden al crear el mapa», del que aquí se sostiene la mitad: si la foto está congelada, no hay motivo para volver a pedirla.
- **«El árbitro es el código y el narrador es el LLM»** → «Sin red, la aventura funciona entera», que es lo que sostienen los huecos de textos e ilustraciones con su origen declarado.
- **«Los anclajes reales son de uso único»** → «Ningún anclaje aparece dos veces», que sigue siendo afirmable sobre el mundo levantado y no solo sobre el recién generado.
- **«El callejero troceado de OSM se cose antes de trazar»** → «Lo cosido y lo inventado queda marcado», que aquí se convierte en que la marca sobrevive al ida y vuelta.
- **«En marcha no hay nada que tocar»** → «El mapa no cambia durante la salida», que es la razón de congelar la máscara de mar en lugar de recalcularla.
- **Frontera, que esta spec deja preparada y no implementa:** «La copia guardada se puede volver a abrir» (fila 39), «Marcarlo lo saca del casting sin resembrar» (fila 35), «Los mapas antiguos se leen desde el diario» y «El mundo de casa no avanza en tu ausencia» (fila 41), «Sin foto de Places, el visor abre igual» (fila 33).

### Huecos de la batería que esta spec deja al descubierto

`docs/testing.md` no tiene hoy escenario para nada de esto, y el PRD ya marca RF-PERS-008 con **⚠ sin escenario**. Habría que añadirlos antes de dar la spec por verificada:

1. **El ida y vuelta exacto.** La batería afirma que el mundo no depende de OSM, pero no que congelar y levantar no pierda nada. Es el fallo más probable de esta capa y no tiene escenario.
2. **La versión del formato.** Documento sin versión, versión mayor que la entendida, versión menor: tres casos, ninguno escrito. Es el hueco que RF-PERS-008 ya declara.
3. **El documento roto.** Truncado por un apagón, campo obligatorio ausente, celda que el índice declara y no está.
4. **El presupuesto de tamaño**, que además es el instrumento con el que se cierra el pendiente 1 de `partida-guardada.md`.
5. **Los tres huecos de recursos** — que un mundo sin ilustraciones, sin fotos y sin textos del LLM es jugable, y que rellenarlos después no toca la capa de ficción.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-008.
- **Sin sección de comportamiento responsive ni bloque de UX Design** → asumido por decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz.
- **Un documento por celda más un índice por mapa** → asumido (alternativa: un solo documento por mapa, que es la letra de `partida-guardada.md` §1). Regla: el escenario «Abrir una celda vecina no toca la celda propia» exige que la celda propia siga idéntica byte a byte, y con un fichero único cada celda nueva reescribe todo el mapa; el documento de diseño habla de «por mapa» para decir que no se comparte entre mapas, no para fijar el número de ficheros.
- **El formato es JSON canónico, sin comprimir** → asumido (alternativas: un binario propio, o JSON comprimido en el almacén). Regla: `arquitectura.md` pide un paquete sin dependencias y JSON es lo único que Node y la app tienen sin traer nada; comprimir es cosa del almacén y de la fila 39, y hacerlo aquí convertiría «byte a byte» en una afirmación sobre el compresor.
- **La versión del formato es un entero que empieza en 1, no una fecha ni un semver** → asumido (alternativa: `major.minor`). Regla: la única pregunta que el cargador tiene que responder es si entiende el documento; con dos números hay que decidir además qué cambios son compatibles, y esa decisión es de la fila 39.
- **Una versión mayor no se abre en absoluto** → asumido (alternativa: abrir e ignorar lo que no se entienda). Regla: `partida-guardada.md` §2, hay que avisar en lugar de disimular; abrir a medias un mundo escrito por una versión futura es exactamente disimular, y con el mundo congelado un dato mal interpretado no se puede regenerar.
- **La máscara de mar se congela en lugar de recalcularse** → asumido, en forma de rejilla de bits (alternativa: guardar solo las costas y reconstruirla al cargar, que ocupa mucho menos). Regla: RF-PERS-001 dice «nunca se depende de regenerar», y el mar pintado es parte del mapa; recalcular ata el aspecto de un mapa ya generado a la versión de `seamask.js` que tenga instalada el jugador.
- **El resultado del cosido se congela como dato** → asumido (alternativa: guardar el callejero crudo y volver a coser al cargar). Regla: SPEC-007 convierte la marca de suposición en un campo obligatorio precisamente para que no se pierda aguas abajo; volver a coser haría que cambiar `COSER_MAX` alterase mapas ya generados.
- **El casting no se congela con el mundo** → asumido (alternativa: guardarlo, ya que hoy `buildWorld` lo devuelve dentro del mundo). Regla: el casting es determinista sobre el mundo congelado y lo que hay que conservar es su resultado **aceptado**, que es estado del jugador y va en la fila 16; guardarlo aquí duplicaría la verdad, que es el bug que `partida-guardada.md` §2 nombra por su nombre.
- **Los anclajes libres no consumidos no se congelan** → asumido (alternativa: guardarlos para poder recolocar algo si el jugador descarta un anclaje). Regla: «Marcarlo lo saca del casting sin resembrar» dice que no hay repuesto, y guardar el pool entero es el segundo bulto del documento después de las polilíneas.
- **El esquema es cerrado y un campo de más falla** → asumido (alternativa: ignorar lo desconocido y escribirlo tal cual). Regla: RF-PRIV-002 es bloqueante, y un esquema abierto es exactamente por donde se cuela un día un campo con la posición del jugador sin que nada se ponga rojo.
- **La atomicidad de la escritura es del almacén inyectado y el documento no lleva firma ni checksum** → asumido (alternativa: un resumen de integridad en la cabecera). Regla: un documento truncado ya falla al leerse y el error lo nombra; una firma sin cadena de migración detrás no compra nada todavía, y si hace falta la añade la fila 39, que es la que saca el fichero del móvil.
- **El reloj se inyecta y se usa en un solo campo** → asumido, la fecha de captura del contenido refrescable de Places (alternativa: no guardar fecha, o guardarla fuera del documento). Regla: SPEC-005 exige esa fecha para poder refrescar; inyectar el reloj mantiene el documento comparable byte a byte en pruebas y respeta la prohibición de leer el reloj del sistema dentro del núcleo.
- **La semilla de la partida no entra en ningún documento del mundo** → asumido (alternativa: repetirla en cada celda, que la haría autocontenida). Regla: con el mundo congelado la semilla ya no reproduce nada (`partida-guardada.md` §3 lo dice al invalidar la exportación de la semilla), y repetir en veinte celdas el único dato que el jugador puede llegar a enseñar a alguien es multiplicar por veinte las ocasiones de filtrarlo.
- **Las coordenadas se guardan en metros relativos al anclaje del mapa** → asumido (alternativa: grados, como llegan de OSM). Regla: es lo que ya hace el núcleo con la proyección local de `core/geo.js`, pesa la mitad, y de paso ningún punto del documento es directamente una coordenada del mundo real sin componer con el anclaje redondeado.
- **Los tres números del presupuesto de tamaño (2 MB, 200 KB, 100 KB)** → asumidos (alternativa: no fijar ninguno y medir a posteriori). Regla: `partida-guardada.md` dice «unos pocos megas» y deja abierta la poda de mapas; un presupuesto medible sobre los fixtures que ya existen convierte ese pendiente en una medición en lugar de una intuición, y si al medir resultan estrechos se ajustan por iteración con el dato delante.
- **Si el presupuesto se incumple, se cuantiza en la generación y nunca al volcar** → asumido (alternativa: redondear las coordenadas al escribir el documento). Regla: el ida y vuelta exacto es el criterio central de esta spec; redondear al escribir lo rompe en silencio, que es la forma de fallo que este proyecto ya ha pagado una vez con las propiedades colgadas de arrays.
- **Los binarios viven fuera del documento y se referencian por la clave con la que el proxy los cachea** → asumido (alternativa: incrustarlos codificados). Regla: RF-INFRA-002 fija esas claves —imágenes por prompt de ficción, fotos por sitio—, un JSON con imágenes dentro deja de poder compararse y de poder leerse por partes, y las fotos de Places tienen restricciones de almacenamiento que el `place_id` respeta y una copia incrustada no.
- **Los textos del LLM sí van en línea en el documento** → asumido (alternativa: tratarlos como recurso externo, igual que las imágenes). Regla: `quests.md` decisión 1 manda guardarlos con la partida y son texto, así que no mueven la aguja del tamaño; sacarlos fuera añadiría una indirección por cada frase del juego.
- **El hueco de recursos responde qué falta para jugar sin red, pero no lo consigue** → asumido (alternativa: que la capa de partida sepa pedir lo que falte). Regla: `packages/nucleo/` no puede hablar con la red (RF-INFRA-001), y conseguir los recursos es el momento «antes de salir» de la fila 28.
