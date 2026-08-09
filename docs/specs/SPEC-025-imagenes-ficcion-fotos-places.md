# SPEC-025 — Las ilustraciones de ficción y las fotos del lado real

## Descripción

Rellena dos de los tres huecos que SPEC-009 dejó abiertos en el mundo congelado: la **ilustración de ficción** de un sitio y la **foto de su lado real**. Son las dos mitades del visor del anclaje, que es el momento de máximo efecto del juego —que O Torreón Esquecido *es el chiringuito de Manolo*—, y se consiguen en dos momentos distintos y por razones distintas. Las **fotos se piden al crear el mapa**, en el lote de Places de la generación y nunca por aventura, porque pedirlas al aceptar una aventura le contaría al proxy qué sitios reales tienes cerca y cuándo. Las **ilustraciones se generan al preparar la salida**, para los tres a cinco lugares del reparto, en segundos, porque el visor tiene que existir antes de que llegues y no antes de que aceptes.

Lo que esta fila entrega no es contenido: es **quién pide qué, cuándo, con qué presupuesto y qué pasa cuando no hay nada**. Y lo que decide su forma es una restricción que no es de diseño gráfico sino de privacidad: **el anclaje real no entra en ninguna llamada de red**. El prompt de la ilustración es un texto de ficción construible y auditable sin red —nombre de fantasía, tipo, escena, rasgo, idioma y tono, y nada más—, y la petición de foto lleva un `place_id` y ningún campo más. El dato real que sale del móvil es el que ya salió al generar el mapa; esta spec no añade ninguna revelación nueva.

La otra mitad es la degradación, y aquí es **silenciosa por diseño**: sin cobertura la pantalla de preparación dice exactamente lo mismo, el visor abre igual con la cartela sobre fondo liso, lo que no tiene ilustración cae a la ficha de texto, y **ninguna pantalla menciona la red ni llama a nada de esto un fallo**. Lo que sí protesta —y esto es lo contrario de degradar en silencio— es el cableado: si falta el cliente de fotos, el cliente de imágenes o el almacén de recursos, la construcción falla nombrando la pieza que falta, en vez de devolver un lote vacío que parece un mundo sin fotos.

Anclas: **RF-MUNDO-016** (`docs/prd.md` §4.1) y **RF-BUCLE-003** (§4.7), con **RNF-PER-002** (§5.5, la preparación tarda segundos y no minutos), **RNF-RED-001** (§5.3, degradación silenciosa), **RNF-COST-001** (§5.6) y **RNF-PRIV-001** (§5.2) como restricciones. Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` §2 (el visor, el momento de pedir las fotos y la variante que baja el coste) y `game-design/seguridad-privacidad.md` §1 (lo que sale del móvil y el método: cuando algo real tenga que salir, primero se mira si cabe en la llamada que ya existe). Recoge el **riesgo 1** del PRD §8 —los términos de Places, que restringen almacenar contenido y mostrar datos sobre un mapa que no es de Google, que es exactamente el visor— y lo convierte en un interruptor con valor por defecto, no en una reescritura futura. Consume SPEC-005 (el `place_id` como campo estable del anclaje), SPEC-009 (la forma de los dos huecos y `queFaltaParaJugarSinRed`) y SPEC-023 (las rutas de imagen y de foto del proxy, sus esquemas cerrados, sus claves de caché y el tope de pago por lote).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: aparecen el **cliente de imágenes**, el **cliente de fotos** y el **almacén de recursos binarios**, los tres inyectados y los tres con doble en Node. Están descritos en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el **proxy** y sus rutas, su atestación, su caché y su tope de pago (fila 23, RF-INFRA-002), del que aquí solo se consumen los esquemas ya cerrados; **qué lleva el prompt del LLM y qué se valida de su respuesta** (fila 18, RF-QUEST-006 a 008), que es el otro hueco de recursos y comparte momento pero no contrato; **el formato del documento congelado** (fila 9), cuyos dos huecos se rellenan sin renegociar nada ni subirle la versión; **la pantalla de preparación** con su composición, sus líneas y su navegación (fila 28, A2P5), de la que aquí solo se fija qué recursos tiene que haber conseguido antes de dejar salir y qué no puede decir nunca; **el visor del anclaje y la ficha de texto** (fila 33, A4P1, A4P2 y A4P7), de los que aquí solo se entrega el material que pintan y la garantía de que abren sin él; **el relleno del pool con Places** y la deduplicación con OSM (fila 5, RF-MUNDO-011), que ya está entregado; y **la lectura de los términos de Google Places**, que es trabajo jurídico y no código.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «El lote de fotos al crear el mapa» y «El lote de ilustraciones al preparar la salida»; la **validación de entradas** en «El prompt de ficción» —el elemento sin nombre de fantasía, el locale desconocido, el sobre con un campo que el esquema del proxy no admite— y en el `place_id` ausente; el **estado vacío** en el mapa sin ninguna entrada de Places, la aventura cuyo reparto ya está entero residente y el mundo recién generado sin una sola ilustración; el **estado de error** en «Cuando no se puede pedir» y en «Nada degrada por falta de cableado»; y los **casos límite** en el reparto con más lugares que el tope, el mismo prompt pedido dos veces, el lote que se pasa del tope de pago del proxy y el presupuesto de tiempo agotado a mitad.

«Lote» significa siempre lo mismo: el conjunto de peticiones que se agrupan en un único momento y se cuentan juntas, que es la unidad con la que SPEC-023 mide el coste. «Residente» y «ausente» son los dos estados que ya declara `packages/nucleo/partida/recursos.js`, y no hay un tercero.

### El prompt de ficción: lo único que sale del móvil

- **Dado** un elemento del mundo congelado, **cuando** se construye su prompt de ilustración, **entonces** se construye sin hacer ninguna petición de red.
- **Dado** un anclaje real cuyo nombre en OSM es "Casa Manuela" y cuyo nombre de fantasía es "O Torreón Esquecido", **cuando** se construye el prompt de su ilustración, **entonces** el prompt no contiene "Casa Manuela".
- **Dado** el prompt ya construido de cualquier elemento de los ocho mundos de referencia, **cuando** se busca en él, **entonces** no aparece ninguna coordenada, ningún identificador de OSM, ningún `place_id` ni ningún texto que la jugadora haya tecleado.
- **Dado** un mundo entero, **cuando** se construyen los prompts de todos sus elementos ilustrables, **entonces** ninguno es igual a otro.
- **Dado** el mismo mundo generado dos veces con la misma semilla, **cuando** se comparan los prompts de un mismo elemento, **entonces** son idénticos carácter a carácter, y también lo es su clave de caché.
- **Dado** un elemento sin nombre de fantasía, **cuando** se pide su prompt, **entonces** falla nombrando el elemento, y no devuelve un prompt genérico.
- **Dado** un mundo en gallego y el mismo mundo en castellano, **cuando** se comparan los prompts de un mismo elemento, **entonces** difieren, porque el idioma del mundo es parte del prompt.
- **Dado** un sobre de petición de imagen ya construido, **cuando** se valida contra el esquema cerrado de la ruta de imagen del proxy, **entonces** lleva el prompt de ficción y los parámetros de formato, y ningún campo más.

### El lote de fotos al crear el mapa, y nunca más

- **Dado** una celda recién generada con anclajes admitidos desde Places, **cuando** termina la generación, **entonces** se pide un único lote de fotos con los `place_id` de los anclajes que acabaron siendo núcleo, servicio o paraje.
- **Dado** ese lote, **cuando** se inspecciona cada petición, **entonces** lleva un `place_id` y ningún campo más.
- **Dado** un anclaje que quedó en el pool sin llegar a ser nada, **cuando** se compone el lote de fotos, **entonces** su `place_id` no entra.
- **Dado** un mapa ya generado y una jugadora que acepta cinco aventuras a lo largo de una semana, **cuando** se inspecciona el tráfico saliente de esa semana, **entonces** no hay ninguna petición de foto.
- **Dado** una foto ya residente, **cuando** se juega el sitio al que pertenece, **entonces** no se vuelve a pedir.
- **Dado** una foto conseguida, **cuando** se congela la celda, **entonces** el documento guarda el `place_id`, la referencia local y la fecha de captura, y ninguna URL de Places.
- **Dado** un anclaje de OSM sin `place_id`, **cuando** se compone el lote de fotos, **entonces** no entra, y su foto queda declarada ausente con el motivo «sin sitio de Places».
- **Dado** una celda vecina que se abre más tarde, **cuando** termina su generación, **entonces** pide su propio lote de fotos y no vuelve a pedir ninguna de la celda ya generada.
- **Dado** los ocho mundos de referencia con una fuente de Places doblada, **cuando** se mide la cobertura de fotos, **entonces** queda declarada mundo a mundo, y ningún mundo la promete donde no la tiene.

### El lote de ilustraciones al preparar la salida

- **Dado** una aventura recién aceptada, **cuando** arranca la preparación, **entonces** se pide un único lote con las ilustraciones de los lugares distintos de sus beats que no estén ya residentes.
- **Dado** una aventura cuyos beats caen en cuatro lugares distintos, **cuando** se compone el lote, **entonces** lleva cuatro peticiones y no una por beat.
- **Dado** una aventura cuyo reparto tiene más lugares distintos que el tope declarado, **cuando** se compone el lote, **entonces** entran los primeros por orden de aparición hasta el tope, y los demás quedan ausentes.
- **Dado** una aventura cuyo reparto ya está entero residente de una salida anterior, **cuando** arranca la preparación, **entonces** no se pide ninguna ilustración y la preparación se cierra igual.
- **Dado** dos aventuras distintas que pasan por el mismo paraje, **cuando** se prepara la segunda, **entonces** su ilustración no se vuelve a pedir.
- **Dado** una ilustración conseguida, **cuando** se congela la celda, **entonces** el documento guarda el prompt, su clave derivada y la referencia al recurso local, y no el binario ni en línea ni codificado.
- **Dado** una salida preparada entera, **cuando** se pregunta a `queFaltaParaJugarSinRed` por su aventura, **entonces** responde que no falta ninguna ilustración.
- **Dado** un lote que se pasaría del tope de pago que el proxy declara por lote de mapa, **cuando** se compone, **entonces** se recorta hasta el tope y lo recortado queda ausente, sin que ninguna petición se rechace aguas arriba.

### El presupuesto de tiempo

- **Dado** una preparación con el proxy respondiendo dentro del presupuesto declarado, **cuando** termina, **entonces** ha tardado segundos y no minutos.
- **Dado** una preparación cuyo lote de ilustraciones no ha terminado al agotarse el presupuesto de espera, **cuando** se agota, **entonces** la preparación se cierra igual con lo que tenga y deja salir a andar.
- **Dado** esa misma preparación, **cuando** se lee la pantalla, **entonces** dice exactamente lo mismo que una que terminó entera.
- **Dado** una generación de mapa cuyo lote de fotos no responde, **cuando** se mide la generación de punta a punta, **entonces** sigue por debajo del minuto y el mapa queda completo con las fotos declaradas ausentes.
- **Dado** un lote de fotos que se queda a medias, **cuando** se juega después, **entonces** no se reintenta por aventura ni en marcha: lo ausente se queda ausente hasta que se vuelva a pedir un lote de mapa.

### La degradación es silenciosa, y ninguna pantalla la llama fallo

- **Dado** una jugadora sin conexión, **cuando** acepta una aventura y llega a la pantalla de preparación, **entonces** el texto es el mismo que con conexión.
- **Dado** esa misma pantalla, **cuando** se recorren todos sus textos, **entonces** ninguno menciona la red, la cobertura, la conexión, un error, un reintento ni una espera fallida.
- **Dado** un sitio del que Places no tiene foto, **cuando** se abre su visor, **entonces** se ve la ilustración de ficción y al arrastrar aparece la cartela con el nombre real sobre fondo liso.
- **Dado** un sitio sin ilustración residente, **cuando** se llega a él, **entonces** se da la ficha de texto con el nombre de fantasía, qué es en realidad y la escena, sin anunciar que falte nada.
- **Dado** una salida entera jugada sin una sola ilustración y sin una sola foto, **cuando** se recorre de principio a fin, **entonces** se completa igual.
- **Dado** cualquier texto que esta spec añada a la app, **cuando** se recorre el catálogo de textos, **entonces** ninguno nombra un recurso, un lote, una caché ni un proveedor.

### Si los términos de Places bloquean

- **Dado** el interruptor de Places apagado, **cuando** se genera un mapa entero, **entonces** no sale ninguna petición a la ruta de fotos ni a la de Places.
- **Dado** el interruptor apagado, **cuando** se construye el pool de anclajes, **entonces** se construye solo con OSM y el mundo se genera igual.
- **Dado** el interruptor apagado, **cuando** se abre el visor de cualquier sitio, **entonces** abre con la ilustración de ficción y la cartela sobre fondo liso.
- **Dado** el interruptor apagado y el mismo mundo con el interruptor encendido pero sin déficit de pool que cubrir, **cuando** se comparan las dos capas de ficción, **entonces** no ha cambiado ni un nombre, ni un tipo, ni una posición.
- **Dado** el interruptor apagado, **cuando** se recorren los textos de todas las pantallas, **entonces** ninguno cambia.
- **Dado** una foto conseguida y ya residente, **cuando** se apaga el interruptor, **entonces** el mundo congelado sigue levantándose sin fallar.

### Cuando no se puede pedir

- **Dado** el proveedor de imágenes caído, **cuando** se prepara una salida, **entonces** las ilustraciones quedan ausentes con el motivo «no se pudo pedir» y la salida se prepara igual.
- **Dado** Places caído, **cuando** se pide el lote de fotos de un mapa, **entonces** las fotos quedan ausentes con el motivo «no se pudo pedir» y la generación termina.
- **Dado** una respuesta del proxy que no encaja en el esquema del sobre, **cuando** se recibe, **entonces** se descarta sin interpretarse y el recurso queda ausente.
- **Dado** una respuesta que dice «no hay», **cuando** se registra el recurso, **entonces** su motivo es «sin foto en el sitio» y no «no se pudo pedir».
- **Dado** los dos motivos anteriores, **cuando** se cuentan los recursos ausentes de un mapa, **entonces** se pueden contar por separado.

### Nada degrada por falta de cableado

Esta es la aplicación directa de `pipeline/decisiones-orquestador.md` §6h: una pieza que, al no estar, no protesta, es la forma de fallo que ya salió cinco veces en este repo.

- **Dado** el conseguidor de recursos construido sin cliente de imágenes, **cuando** se construye, **entonces** falla nombrando el cliente que falta, y no devuelve un lote vacío.
- **Dado** el conseguidor construido sin cliente de fotos, **cuando** se construye, **entonces** falla nombrando el cliente que falta.
- **Dado** el conseguidor construido sin almacén de recursos binarios, **cuando** se construye, **entonces** falla nombrando el almacén que falta.
- **Dado** un mapa con anclajes de Places y ningún cliente de fotos cableado, **cuando** se genera, **entonces** no termina con «cero fotos» como si Places no tuviera ninguna: falla nombrando el cableado.
- **Dado** una foto declarada residente cuyo binario no está en el almacén, **cuando** se levanta el mundo congelado, **entonces** falla nombrando el recurso, porque «perderlo» y «no haberlo tenido nunca» tienen que ser distinguibles.
- **Dado** el interruptor de Places apagado, **cuando** se pregunta por qué no hay fotos, **entonces** la respuesta es el interruptor y no un fallo de red.

## UX Design

Ninguna pantalla nace en esta fila. Lo que aquí se fija es el **contrato** que dos pantallas ya dibujadas tienen que cumplir para que esto se vea, y las dos son de otras filas: **A2P5** de la fila 28 y **A4P1 / A4P2 / A4P7** de la fila 33. Se describen tal como están dibujadas; rediseñarlas aquí sería inventarse una decisión.

### Wireframe textual

**A2P5 · «La preparación» (pantalla 5 · artefacto 2).** Pantalla de espera del momento «antes de salir», voz de mundo. De arriba abajo: el título **«Preparando la salida»** en serif; debajo, la coletilla **«Un momento, que hay que escribirlo…»**; debajo, la lista de fases en voz de mundo, una por línea y con marca de completada, con los literales ya dibujados **«Repartiendo los papeles» · «Escribiendo lo que se dirá» · «Dibujando los sitios»** —la tercera es la que esta spec alimenta—; debajo, la frase de contrato **«A partir de aquí no hace falta cobertura. Puedes meter el móvil en el bolsillo.»**; y abajo del todo, el botón **«Listo. Vamos.»**, que no se habilita hasta que la preparación cierra, con presupuesto agotado o sin él. Ni un porcentaje, ni una barra con cifra, ni una línea por sitio: las tres fases son las mismas se consigan tres ilustraciones, una o ninguna, y la lista no crece ni encoge con lo que haya llegado.

**A4P1 y A4P2 · «El visor» (pantallas 1 y 2 · artefacto 4).** Capa a pantalla completa sobre lo que haya debajo. Lado de la ficción: la ilustración del sitio con su nombre de fantasía. Arrastrando el tirador se cruza al lado real: **la foto de Places con la cartela del nombre real** si la foto está residente, y **la cartela del nombre real sobre fondo liso** si no lo está. La cartela está siempre, en los dos casos; lo que puede faltar es la foto de debajo. Nada indica que falte.

**A4P7 · «La ficha de texto» (pantalla 7 · artefacto 4).** El fallback digno cuando no hay ilustración de ficción: nombre de fantasía, qué es en realidad y la escena, en el mismo registro de mundo. No es una pantalla de error y no se anuncia como tal; es una de las formas normales de llegar a un sitio.

**A1P5 · «La generación» (pantalla 5 · artefacto 1).** Aquí solo se toca lo invisible: el lote de fotos se pide al terminar de generar, dentro del mismo minuto y sin añadir ninguna línea a la lista de fases. La pantalla no cambia.

### Pantallas y elementos utilizados

```
Pantallas ya dibujadas que esta spec alimenta:
  A2P5  pantalla 5 · artefacto 2 — La preparación            (dueña: fila 28)
  A4P1  pantalla 1 · artefacto 4 — El visor, lado de la ficción (dueña: fila 33)
  A4P2  pantalla 2 · artefacto 4 — El visor, arrastrado         (dueña: fila 33)
  A4P7  pantalla 7 · artefacto 4 — La ficha de texto            (dueña: fila 33)
  A1P5  pantalla 5 · artefacto 1 — La generación                (dueña: fila 27)

Elementos del proyecto que se usan: la cartela del nombre real, el tirador del visor,
la lista de fases en voz de mundo.

Elementos nuevos: ninguno. Si esta entrega necesita uno, es señal de que está
rediseñando una pantalla de otra fila.
```

### data-testid

Pocos y estables, y los dos que `design-system.md` pide siempre —el estado del momento y el mapa— aquí se concretan en el estado del momento «antes de salir» y en la capa del visor:

- `momento-antes-de-salir` — el contenedor del momento, para poder afirmar en qué estado está la app
- `preparacion-salida` — la pantalla de preparación entera
- `preparacion-lineas` — la lista de fases en voz de mundo, para comparar sus textos con cobertura y sin ella
- `preparacion-listo` — el botón «Listo. Vamos.»
- `visor-anclaje` — la capa del visor
- `visor-lado-real` — el lado real del visor, sea foto o fondo liso
- `visor-cartela` — la cartela con el nombre real
- `ficha-texto` — la ficha de texto

Los tres primeros y los tres del visor los pone quien implemente las filas 28 y 33; se declaran aquí porque son los únicos localizadores con los que se puede afirmar la degradación silenciosa, que es el corazón de esta spec. Si al llegar esas filas se llaman de otra manera, mandan ellas y esto se ajusta por iteración.

### Patrón de interacción

- **La preparación es una espera, no un proceso con detalle.** Tres líneas fijas en voz de mundo y ningún indicador por recurso. Regla: `design-system.md`, «Qué NO lleva ninguna pantalla» —ninguna cifra de progreso— y los dos registros, que prohíben que el juego hable como aplicación fuera de los ajustes. Una línea por ilustración convertiría el momento en una descarga.
- **El botón de salir se habilita al cerrar la preparación, no al conseguirlo todo.** Regla: RNF-RED-001, la degradación es silenciosa; si el presupuesto se agota, cerrar y dejar salir es indistinguible de haber terminado, que es exactamente lo que el escenario «Sin cobertura, la preparación dice lo mismo» exige.
- **La ausencia de un recurso no se comunica nunca.** Ni con un icono, ni con un color, ni con una frase. Regla: `design-system.md`, dentro del juego cualquier cosa que solo se pueda decir como aplicación es señal de rediseñar el momento; y `bucle-jugable.md`, anunciarlo solo serviría para señalar algo que la jugadora no puede arreglar.
- **El visor es capa y no paso**, y abre con lo que tenga. Regla: RF-BUCLE-007, ya decidido; esta spec solo garantiza que el lado real siempre tiene cartela aunque no tenga foto.
- **Decisión no cubierta por el design system:** qué hacer si una ilustración llega *después* de que la jugadora ya haya salido a andar. Se resuelve **descartándola para esta salida y guardándola para la siguiente**, porque el momento «en marcha» no admite ningún cambio de pantalla que no sea un aviso, y una ilustración que aparece a mitad sería un cambio sin aviso.

## Notas técnicas

### Reparto de responsabilidades

| Pieza | Dónde vive | Qué hace |
| --- | --- | --- |
| `promptDeIlustracion` | `packages/nucleo/partida/recursos.js` | construye el prompt de ficción de un elemento a partir del mundo congelado, el locale y el tono; puro, determinista, sin red |
| `lugaresParaIlustrar` | `packages/nucleo/partida/recursos.js` | dados una aventura y el inventario, devuelve los lugares distintos que faltan, en orden de aparición y hasta el tope |
| `sitiosParaFotografiar` | `packages/nucleo/partida/recursos.js` | dada una celda generada, devuelve los `place_id` de los anclajes que acabaron siendo algo |
| el conseguidor de recursos | `app/` | compone los lotes, llama al proxy, guarda los binarios y devuelve las declaraciones que `declaraIlustracion` y `declaraFoto` congelan |

La regla de reparto es la de siempre y no se negocia: **el núcleo decide qué hace falta y no habla con nadie**; la app consigue. `packages/nucleo/` sigue sin importar nada de red, y eso es comprobable con un test de imports, como ya hace SPEC-009.

### Frontera de inyección

Tres entradas nuevas, las tres al conseguidor de recursos de `app/`, las tres inyectadas y las tres con doble en Node:

1. **Cliente de imágenes** — recibe un lote de prompts de ficción con sus parámetros de formato y devuelve, por cada uno, el binario o «no hay». Dobles: responde fijo, falla siempre, responde mal, tarda más que el presupuesto.
2. **Cliente de fotos** — recibe un lote de `place_id` y devuelve, por cada uno, el binario con su atribución o «no hay». Mismos dobles.
3. **Almacén de recursos binarios** — guarda y recupera por clave; el documento congelado guarda la referencia y nunca el binario.

Los tres son obligatorios en la construcción y su ausencia es error de construcción, no lote vacío. El **reloj** que fecha la captura de una foto ya está inyectado desde SPEC-009 y no cambia.

### Los parámetros declarados

| Parámetro | Valor por defecto | De dónde sale |
| --- | --- | --- |
| `PLACES_ACTIVO` | encendido | el riesgo 1 del PRD §8: si los términos bloquean, se apaga y nada más cambia |
| `TOPE_ILUSTRACIONES_SALIDA` | 5 | RF-BUCLE-003, «los 3-5 lugares del reparto» |
| `PRESUPUESTO_PREPARACION_MS` | 20 000 | RNF-PER-002, segundos y no minutos; comparte pared con la espera del LLM de SPEC-018 |
| `PRESUPUESTO_FOTOS_MAPA_MS` | 15 000 | la rebanada del minuto de RNF-PER-001 que el lote de fotos puede gastar |
| `MOTIVOS_DE_AUSENCIA` | `sin-sitio`, `sin-foto`, `no-se-pudo-pedir`, `tope`, `interruptor` | §6h: contar juntos «no había» y «no se preguntó» esconde el cableado roto |

### Por qué el lote de fotos va al terminar de generar, y no al principio

`bucle-jugable.md` §2 describe dos variantes con la misma garantía de privacidad: pedir las fotos de todo el pool en la misma tanda que la consulta de Places, o pedir solo las de los anclajes que acabaron siendo algo, en una segunda llamada al terminar de generar. Las dos ocurren al crear el mapa, así que las dos cumplen RF-MUNDO-016 y ninguna añade revelación. Lo que decide es SPEC-023: `TOPE_PAGO_LOTE_MAPA` vale **60 llamadas de pago por lote de mapa**, con las ilustraciones dentro de esa cuenta. El pool de una celda tiene más entradas que eso, y los anclajes consumidos son una fracción. La segunda variante es la única que cabe en un tope ya escrito, y es además la que `RNF-COST-001` favorece.

## Decisiones asumidas

- **El lote de fotos se pide al terminar de generar la celda, sobre los anclajes consumidos** → asumido (alternativa: pedir las fotos de todo el pool en la misma tanda que la consulta de Places). Regla: `bucle-jugable.md` §2 autoriza las dos y `TOPE_PAGO_LOTE_MAPA` de SPEC-023, en 60 llamadas de pago, solo deja caber la segunda.
- **Un anclaje de OSM sin `place_id` no lleva foto, y resolverle uno queda fuera** → asumido (alternativa: preguntar a Places por el sitio de cada anclaje de OSM para conseguirle un `place_id` y con él una foto). Regla: `parajes.md` fija que Places entra solo a rellenar el pool; resolver identificadores para todos los anclajes multiplicaría el lote y sacaría del móvil datos de sitios que hoy no salen, aunque sea dentro de la llamada que ya existe. Queda declarado como hueco.
- **Se ilustran los lugares del reparto de la aventura aceptada, no los del mundo entero** → asumido (alternativa: ilustrar todos los anclajes al generar el mapa). Regla: RF-BUCLE-003 dice «los 3-5 lugares del reparto» y el momento es la preparación; ilustrar el mundo entero rompe el minuto de RNF-PER-001 y el tope de pago por lote.
- **El tope de ilustraciones por salida es 5, y lo que pasa del tope cae a la ficha de texto** → asumido (alternativa: sin tope, ilustrar todos los lugares de una jornada de 10-14 beats). Regla: RF-BUCLE-003 declara el rango 3-5; la ficha de texto es fallback digno ya diseñado (RF-BUCLE-008), así que pasarse del tope no rompe nada.
- **El presupuesto de espera de la preparación es 20 s y al agotarse se cierra con lo que haya** → asumido (alternativa: esperar hasta que el lote termine). Regla: RNF-PER-002, segundos y no minutos, y `bucle-jugable.md`, «puedes meter el móvil en el bolsillo» es la promesa de la pantalla; esperar indefinidamente la convierte en una pantalla de carga.
- **Una ilustración que llega tarde se guarda para la siguiente salida y no entra en la que ya empezó** → asumido (alternativa: inyectarla en caliente). Regla: `design-system.md`, en marcha no hay nada tocable y ningún cambio de pantalla que no sea un aviso.
- **Los términos de Places se resuelven con un interruptor con valor por defecto encendido** → asumido (alternativa: esperar a la lectura jurídica antes de implementar nada). Regla: el riesgo 1 del PRD §8 ya declara la mitigación —«si bloquean, el visor degrada a cartela sin foto y el pool se queda en OSM»—, y las dos degradaciones ya están diseñadas; un interruptor las hace comprobables hoy en lugar de prometidas.
- **Los motivos de ausencia son un vocabulario cerrado y se cuentan por separado** → asumido (alternativa: un único estado `ausente`, que es lo que hoy declara `recursos.js`). Regla: §6h de `pipeline/decisiones-orquestador.md`; con un solo estado, «Places no tiene foto» y «nadie cableó el cliente de fotos» son indistinguibles, que es exactamente la forma de fallo que ya salió cinco veces.
