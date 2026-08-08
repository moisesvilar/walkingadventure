# SPEC-023 — El proxy ciego

## Descripción

El único servidor del proyecto: guarda las claves de LLM, de generación de imágenes y de Google Places, comprueba con App Attest y Play Integrity que quien llama es la app y no un tercero con la URL, cachea lo que es igual para todo el mundo —las imágenes por su prompt de ficción, las fotos por su sitio— y no escribe en ningún sitio quién llamó, desde dónde ni cuándo. No hay cuentas, no hay partidas, no hay identificador de instalación y no hay registro de llamadas.

No tiene interfaz de usuario. El jugador nunca ve el proxy: lo que ve es que los textos llegan, o que no llegan y la aventura sigue igual con los de plantilla, que es exactamente lo que ya pasa sin cobertura. La mitad del valor de esta spec está en lo que el proxy **no** hace, y por eso la mayoría de sus criterios son afirmaciones sobre la ausencia: sobre lo que no está en el disco después de un mes de tráfico.

Anclas: **RF-INFRA-002** (`docs/prd.md` §4.13), **RNF-PRIV-001** (§5.2) y **RNF-COST-001** (§5.6), con `game-design/arquitectura.md` §3 y `game-design/seguridad-privacidad.md` §1 como fuentes que mandan sobre el PRD. Recoge además los riesgos 3 y 6 del PRD (§8) y tres de los pendientes declarados en §7 —qué pasa cuando la atestación falla (`arquitectura.md` p2), el presupuesto de coste por jugador (`arquitectura.md` p3) y la caché del proxy de generación como registro de coordenadas (`seguridad-privacidad.md` p2)—, que **no se cierran aquí**: se convierten en parámetros con valor por defecto justificado, declarados en «Los tres pendientes, convertidos en parámetros».

`RNF-DET-003` hace que esto sea material bloqueante: los escenarios `@privacidad` de `docs/testing.md` no son una capa de calidad sobre el proxy, son su condición de existencia. Nada se despliega con uno de ellos en rojo.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí no la toca**: `packages/nucleo/` no cambia ni una línea. Lo que aparece es la tercera mitad del repo, `server/`, con sus propias inyecciones —los tres clientes de aguas arriba, el verificador de atestación, el almacén de caché, el almacén de métrica y un reloj— descritas en «Frontera de inyección».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** qué lleva el prompt del LLM y qué se valida de su respuesta, que es el contrato de la fila 18 (RF-PRIV-001, RF-QUEST-006 a 008) y del que aquí solo se exige la forma del sobre; levantar y operar el Overpass del proyecto, que es la fila 24 (RF-INFRA-003) y de la que aquí solo se fija qué puede persistir su ruta; qué imágenes y qué fotos se piden y en qué momento, que es la fila 25 (RF-MUNDO-016, RF-BUCLE-003); la mitad cliente de todo esto —obtener la atestación del sistema operativo, gastar fichas, agrupar el lote— que vive en `app/` y entra con la fila 20; y el despliegue en sí, que no es código.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «Las dos mitades del proxy» y «La caché de lo inerte»; la validación de entradas, en «El sobre, la ruta y el esquema cerrado» y en la derivación de claves, que rechaza la clave elegida por el cliente; el estado vacío, en el proxy recién desplegado sin ninguna caché, en la métrica de un día sin tráfico y en la respuesta que no está cacheada y no se puede pedir; el estado de error, en aguas arriba caído, en la clave inválida, en el presupuesto agotado y en la atestación que no verifica; y los casos límite, en la petición repetida a la vez, en la ficha gastada dos veces, en el lote que se pasa de tope y en el mes entero de tráfico del que hay que poder afirmar que no dejó rastro.

Los criterios van en Gherkin español, el mismo `Dado / Cuando / Entonces` de `docs/testing.md`. «Superficie de escritura» significa siempre lo mismo en esta spec: todo lo que el proxy y las capas que lo sirven dejan escrito en cualquier sitio —ficheros, filas, contadores, metadatos del sistema de ficheros y registros de las capas de red—, y es un conjunto **declarado y cerrado**, igual que el esquema de SPEC-009.

### La superficie de escritura, declarada y cerrada

- **Dado** el proxy desplegado, **cuando** se le pregunta qué escribe, **entonces** enumera su superficie de escritura completa, entrada por entrada, sin que haga falta leer su código.
- **Dado** la superficie declarada, **cuando** se compara con lo que hay en el disco tras un mes de tráfico simulado, **entonces** no hay ni una entrada que no esté declarada.
- **Dado** una entrada nueva que el código escribe y la declaración no contempla, **cuando** se arranca el proxy, **entonces** no arranca y el error nombra la entrada no declarada.
- **Dado** la superficie declarada, **cuando** se recorre entrada por entrada, **entonces** cada una dice de qué se deriva su clave y ninguna se deriva de quién llamó.
- **Dado** el proxy recién desplegado y sin una sola petición atendida, **cuando** se lista su superficie de escritura, **entonces** está vacía y no falla.

### Lo que el proxy no escribe nunca

Bloqueante (`@privacidad`, RNF-DET-003). Todos estos criterios se afirman sobre lo escrito, no sobre la intención del código.

- **Dado** un mes de tráfico de mil generaciones de mapa y diez mil salidas, **cuando** se recorre entera la superficie de escritura, **entonces** no aparece ninguna dirección IP.
- **Dado** el mismo tráfico, **cuando** se recorre la superficie de escritura, **entonces** no aparece ningún identificador de instalación, ni de dispositivo, ni de sesión, ni ninguna cabecera del cliente.
- **Dado** el mismo tráfico, **cuando** se recorre la superficie de escritura, **entonces** no aparece ninguna marca de tiempo con resolución menor que la ventana de agregación declarada.
- **Dado** el mismo tráfico, **cuando** se recorre la superficie de escritura, **entonces** no hay ninguna entrada por petición: nada crece a razón de una fila por llamada.
- **Dado** dos llamadas cualesquiera del mismo móvil separadas por un día, **cuando** se busca en todo lo escrito algo que las relacione, **entonces** no lo hay.
- **Dado** el proxy en marcha, **cuando** se provoca un error de aguas arriba, **entonces** el diagnóstico que queda escrito lleva la ruta, el tipo de fallo y nada del cuerpo de la petición.
- **Dado** cualquier capa que sirva el proxy —el terminador de TLS, el servidor de aplicación, el contenedor—, **cuando** se revisa su configuración, **entonces** el registro de conexiones está apagado y la configuración lo declara a propósito.
- **Dado** un fichero de caché recién escrito, **cuando** se leen sus metadatos en el sistema de ficheros, **entonces** su marca de tiempo es la constante declarada y no el momento en que se escribió.
- **Dado** dos ficheros de caché escritos con un mes de diferencia, **cuando** se comparan sus metadatos, **entonces** no hay forma de decir cuál se escribió antes.
- **Dado** el proxy, **cuando** se busca cualquier endpoint que reciba sucesos del jugador —anclajes descartados, ajustes, progreso, errores del cliente—, **entonces** no existe ninguno, y una petición a una ruta no declarada se rechaza sin escribir nada.
- **Dado** una partida cualquiera, **cuando** se busca en la superficie de escritura del proxy, **entonces** no hay ni un fragmento de ella.

### Las dos mitades del proxy: la que ve la identidad y la que ve la ficción

- **Dado** una instalación legítima, **cuando** pide una tanda de fichas en la ruta de atestación, **entonces** presenta la evidencia de la plataforma y recibe una tanda de fichas anónimas con la vigencia declarada.
- **Dado** una llamada a cualquier ruta de contenido —texto, imagen, foto o generación—, **cuando** se inspecciona lo que recibe, **entonces** lleva una ficha y no lleva ninguna evidencia de plataforma, ningún identificador de clave de atestación y ninguna cabecera de cliente.
- **Dado** la ruta de atestación, **cuando** se inspecciona lo que recibe, **entonces** no lleva ningún prompt, ningún `place_id` y ninguna coordenada.
- **Dado** dos fichas de la misma tanda, **cuando** se comparan entre sí y con la evidencia que las produjo, **entonces** no hay forma de saber que salieron de la misma tanda ni de qué atestación salieron.
- **Dado** una ficha gastada, **cuando** se vuelve a presentar, **entonces** se rechaza.
- **Dado** una ficha caducada, **cuando** se presenta, **entonces** se rechaza y el error dice que hay que volver a atestar, sin decir nada más.
- **Dado** una ficha falsificada, **cuando** se presenta, **entonces** se rechaza sin llegar a aguas arriba.
- **Dado** lo que la ruta de atestación necesita guardar para que una evidencia no se pueda reutilizar, **cuando** se inspecciona, **entonces** caduca en el plazo declarado, vive solo en su plano y no aparece en ninguna entrada de las rutas de contenido.
- **Dado** el plano de atestación, **cuando** se busca en él un contador por instalación o cualquier dato que sobreviva a la vigencia de la tanda, **entonces** no lo hay.
- **Dado** una tanda de fichas ya emitida, **cuando** se pregunta a qué instalación se emitió, **entonces** el proxy no lo sabe, porque no lo guardó.

### Cuando la atestación falla

- **Dado** una llamada sin ficha válida, **cuando** pide una imagen que ya está en la caché, **entonces** se le sirve la copia cacheada.
- **Dado** una llamada sin ficha válida, **cuando** pide una imagen que no está en la caché, **entonces** no se hace ninguna llamada de pago aguas arriba y se responde que no hay.
- **Dado** una llamada sin ficha válida, **cuando** pide un texto del LLM, **entonces** no se hace ninguna llamada de pago aguas arriba y se responde que no hay.
- **Dado** un cliente que recibe «no hay» de cualquier ruta de contenido, **cuando** sigue la aventura, **entonces** se comporta igual que sin cobertura: textos de plantilla, visor con cartela sobre fondo liso, y ninguna pantalla que mencione la red ni la atestación.
- **Dado** un dispositivo rooteado, un emulador o una versión del sistema que la atestación no cubre, **cuando** se juega una salida entera, **entonces** se completa de principio a fin.
- **Dado** la vía sin atestación, **cuando** su cuota diaria se agota, **entonces** deja de responder y el juego sigue comportándose como sin cobertura.
- **Dado** la vía sin atestación durante un día entero, **cuando** se mide lo que ha costado, **entonces** el gasto aguas arriba imputable a ella es cero.
- **Dado** una llamada sin ficha válida, **cuando** se atiende, **entonces** no se escribe en ninguna parte que la atestación falló para nadie en concreto: solo suma en el contador agregado del día.

### El sobre, la ruta y el esquema cerrado

- **Dado** una petición a cualquier ruta de contenido, **cuando** su cuerpo trae un campo que el esquema de esa ruta no declara, **entonces** se rechaza nombrando el campo y no se llama a aguas arriba.
- **Dado** una petición de texto, **cuando** se comprueba su esquema, **entonces** admite el prompt de ficción, el idioma y el tono, y ningún campo más.
- **Dado** una petición de imagen, **cuando** se comprueba su esquema, **entonces** admite el prompt de ficción y los parámetros de formato, y ningún campo más.
- **Dado** una petición de foto, **cuando** se comprueba su esquema, **entonces** admite un `place_id` y ningún campo más.
- **Dado** una petición de generación, **cuando** se comprueba su esquema, **entonces** admite la consulta de terreno y POIs de una celda y ningún campo más.
- **Dado** cualquier respuesta de cualquier ruta, **cuando** se compara su sobre con el de las demás, **entonces** todas comparten la misma forma: qué se pide, si viene de caché, y el contenido o la declaración de que no hay.
- **Dado** la misma petición dos veces, **cuando** se comparan las dos respuestas, **entonces** son idénticas salvo en la marca de acierto de caché.
- **Dado** el doble del proxy que entregó SPEC-001, **cuando** se compara su sobre con el del proxy real, **entonces** coinciden campo a campo.

### La caché de lo inerte

- **Dado** una petición de imagen, **cuando** se calcula su clave de caché, **entonces** sale de un resumen del prompt de ficción normalizado y de los parámetros de formato, y de nada más.
- **Dado** una petición de foto, **cuando** se calcula su clave de caché, **entonces** es el `place_id` y nada más.
- **Dado** una petición que trae una clave de caché elegida por el cliente, **cuando** se atiende, **entonces** la clave del cliente se ignora y la deriva el proxy del contenido.
- **Dado** el mismo prompt de ficción pedido por dos móviles distintos, **cuando** se atienden las dos peticiones, **entonces** la segunda se sirve de la caché y no llega a aguas arriba.
- **Dado** una entrada de la caché de imágenes, **cuando** se recorren sus campos y sus metadatos, **entonces** contiene el binario y la clave derivada, y ni un dato de quién la pidió, cuántas veces ni cuándo.
- **Dado** una entrada de la caché de fotos, **cuando** se recorren sus campos, **entonces** contiene el binario y la atribución que exige Places, y nada más.
- **Dado** dos peticiones simultáneas del mismo prompt sin acierto de caché, **cuando** se atienden, **entonces** se hace una sola llamada de pago aguas arriba y las dos reciben el mismo contenido.
- **Dado** una entrada de caché que aguas arriba no llegó a devolver, **cuando** se busca en la caché, **entonces** no hay ninguna entrada negativa que se pueda enumerar.
- **Dado** un texto del LLM, **cuando** se atiende su petición, **entonces** no se cachea: el texto se guarda con la partida en el móvil y el proxy no lo conserva.
- **Dado** la caché, **cuando** se busca una ruta que la enumere, la liste o la cuente por zonas, **entonces** no existe.

### La caché de generación, que es la que roza la promesa

- **Dado** el proxy con su configuración por defecto, **cuando** se atiende una petición de generación, **entonces** no se escribe ninguna respuesta de generación en ninguna caché.
- **Dado** el proxy con la caché de generación activada a propósito, **cuando** se atiende una petición de generación, **entonces** la entrada se escribe con la clave declarada, sin marca de tiempo, sin contador de aciertos y con la marca de tiempo del sistema de ficheros normalizada.
- **Dado** la caché de generación activada, **cuando** se recorre entera, **entonces** cada entrada dice de qué zona es y ninguna dice cuándo se pidió, cuántas veces ni por cuántos.
- **Dado** la caché de generación activada, **cuando** se compara con lo que se puede saber sin ella, **entonces** lo único que añade es que alguien, alguna vez, generó un mapa en esa zona.
- **Dado** el documento de despliegue, **cuando** se lee, **entonces** declara esa consecuencia con esas palabras, en lugar de prometer que la caché no dice nada.
- **Dado** una petición de generación, **cuando** se atiende, **entonces** las coordenadas no se escriben en ninguna otra entrada de la superficie de escritura, ni siquiera en la métrica.
- **Dado** la métrica del día, **cuando** se buscan las zonas generadas, **entonces** solo hay un recuento de generaciones, sin ninguna geografía.

### La medición del coste, agregada y sin identidad

- **Dado** un día de tráfico, **cuando** se lee su métrica, **entonces** hay recuentos por ruta, por resultado —acierto de caché, llamada de pago, fallo de aguas arriba, rechazo— y coste imputado, y nada más.
- **Dado** la métrica, **cuando** se busca la unidad «jugador», **entonces** no existe: la unidad es el lote de trabajo, y los lotes no se atribuyen a nadie.
- **Dado** un lote de mapa completo, **cuando** termina, **entonces** su coste suma en el histograma de coste por lote de mapa, en cubos declarados.
- **Dado** un lote de salida completo, **cuando** termina, **entonces** su coste suma en el histograma de coste por lote de salida.
- **Dado** la métrica de un día, **cuando** se busca una serie temporal más fina que el día, **entonces** no existe.
- **Dado** un día sin una sola petición, **cuando** se lee su métrica, **entonces** están todos los contadores a cero y no falta ninguno.
- **Dado** el histograma de coste por lote, **cuando** se intenta reconstruir a partir de él la secuencia de lotes de un móvil, **entonces** no se puede: los cubos son agregados y no guardan orden.
- **Dado** la métrica acumulada de un mes, **cuando** se pregunta cuánto cuesta un mapa nuevo, **entonces** se responde con el coste medio y la dispersión por lote de mapa, medidos y no estimados.
- **Dado** la métrica acumulada de un mes, **cuando** se pregunta cuánto cuesta un jugador, **entonces** la respuesta declara que es un modelo con sus dos factores medidos y su factor de uso supuesto, y no una medición.

### Los topes, el presupuesto y lo que pasa al agotarlo

- **Dado** el proxy sin un tope diario de gasto declarado en su configuración, **cuando** se arranca, **entonces** no arranca y el error dice que falta el tope.
- **Dado** un lote de mapa, **cuando** supera el tope de llamadas de pago por lote, **entonces** las siguientes se rechazan como «no hay» y el lote no se corta a la mitad para el jugador.
- **Dado** un lote de salida, **cuando** supera su tope, **entonces** ocurre lo mismo.
- **Dado** el tope diario global, **cuando** se agota, **entonces** todas las rutas de contenido responden «no hay», los aciertos de caché siguen sirviéndose y no se hace ninguna llamada de pago más ese día.
- **Dado** el tope diario agotado, **cuando** el jugador juega una salida entera, **entonces** se completa de principio a fin con textos de plantilla.
- **Dado** el identificador de lote, **cuando** caduca su vigencia, **entonces** deja de servir, y en ningún momento se escribe en la superficie de escritura.
- **Dado** una llamada con un identificador de lote que no existe, **cuando** se atiende, **entonces** se trata como un lote nuevo con su tope entero y no se registra el intento.
- **Dado** un bucle del cliente que repite la misma petición mil veces, **cuando** se atiende, **entonces** el tope por lote lo corta antes de que llegue a aguas arriba mil veces.

### Aguas arriba caído, lento o respondiendo mal

- **Dado** el proveedor de texto caído, **cuando** se pide un texto, **entonces** se responde «no hay» y el cliente cae a plantilla.
- **Dado** el proveedor de imágenes caído, **cuando** se pide una imagen que sí está en la caché, **entonces** se sirve de la caché.
- **Dado** Places caído, **cuando** se pide una foto, **entonces** se responde «no hay» y el visor abre con la cartela sobre fondo liso.
- **Dado** un proveedor que tarda más que el plazo declarado, **cuando** se agota, **entonces** se corta la espera, se responde «no hay» y no se escribe ninguna llamada a medias en la caché.
- **Dado** un proveedor que devuelve algo que no encaja en el esquema de su ruta, **cuando** se atiende, **entonces** no se cachea y se responde «no hay».
- **Dado** un fallo de aguas arriba, **cuando** se lee lo que quedó escrito, **entonces** hay un contador agregado del día y ningún cuerpo, ninguna clave y ningún prompt.
- **Dado** las claves de los proveedores, **cuando** se busca cualquiera de ellas en una respuesta, en un mensaje de error o en la superficie de escritura, **entonces** no aparece.

## Notas técnicas

### Qué entrega esta spec

`server/`, que hasta ahora era una línea en `03-stack-context.md` y ningún fichero. JavaScript ESM sobre Node nativo, igual que el resto del repo, y sin dependencias de runtime salvo las que exijan la verificación de atestación y las firmas de las fichas, que se declaran una a una.

| Ruta | Qué entrega |
| --- | --- |
| `server/proxy.mjs` | el servidor: rutas declaradas, esquema cerrado por ruta, sobre común de respuesta |
| `server/atestacion.mjs` | el plano de identidad: reto, verificación de App Attest y Play Integrity, emisión de tandas de fichas |
| `server/fichas.mjs` | emisión, gasto y caducidad de fichas anónimas, y la propiedad de no enlazabilidad |
| `server/cache.mjs` | derivación de claves desde el contenido, escritura con marca de tiempo normalizada, coalescencia de peticiones iguales |
| `server/metrica.mjs` | contadores agregados por día, histogramas de coste por lote, y la negativa a guardar nada más fino |
| `server/superficie.mjs` | la declaración cerrada de todo lo que el proxy escribe, y la comprobación de arranque contra ella |
| `server/aguas-arriba/` | los tres clientes —texto, imagen, Places— y el de generación, todos inyectables |
| `server/config.mjs` | los parámetros, sus valores por defecto y los que no tienen valor por defecto a propósito |

### Frontera de inyección

`packages/nucleo/` no se toca. Lo que se inyecta aquí es todo lo que hace al proxy comprobable sin red y sin claves reales:

- **Los cuatro clientes de aguas arriba** —texto, imagen, Places, generación—, para que las pruebas los sustituyan por dobles que responden fijo, que fallan siempre o que responden mal, igual que hace el doble del proxy con la app.
- **El verificador de atestación**, para poder ejercitar la vía legítima, la falsificada y la ausente sin un dispositivo real. Es la única pieza que en producción habla con Apple y con Google.
- **El almacén de caché**, con leer, escribir y comprobar existencia. Sin almacén inyectado el proxy funciona entero en memoria, que es como corre en `node --test`.
- **El almacén de métrica**, con la misma forma, y con la escritura acotada a la ventana de agregación.
- **Un reloj**, usado para dos cosas y nada más: decidir a qué día natural suma un contador y caducar fichas, retos e identificadores de lote. Nunca entra en una respuesta ni en una clave.

### Los dos planos, y por qué el orden importa más de lo que parece

Es la decisión estructural de esta spec y la que hace que «no identifica» sea afirmable en lugar de prometido.

**App Attest identifica.** Su clave atestada tiene un identificador estable por instalación, y una arquitectura que verificase una aserción en cada llamada tendría delante, en cada llamada, un identificador persistente de instalación. Da igual lo que se prometa después: el dato estaría ahí, y RNF-PRIV-001 estaría roto en el sitio exacto donde el diseño dice que no puede estarlo. Play Integrity tiene la misma forma.

Así que el proxy se parte en dos planos que no se hablan:

- **El plano de identidad** es una sola ruta. Recibe la evidencia de la plataforma, la verifica contra un reto que él mismo emitió y devuelve una tanda de fichas. Ve el identificador de la clave atestada durante el tiempo de verificar, y no lo guarda. Lo único que persiste es la lista de retos vivos —para que una evidencia no valga dos veces— con la vigencia declarada.
- **El plano de contenido** son las cuatro rutas que ven la ficción: el prompt, el `place_id`, la consulta de la celda. Reciben una ficha y no reciben nada de la plataforma. No hay ningún valor que atraviese los dos planos.

Las fichas tienen que ser **no enlazables**: dos fichas de la misma tanda no pueden mostrar que salieron de la misma tanda, y ninguna puede señalar la atestación que la produjo. La forma conocida de conseguirlo es una firma ciega —el cliente presenta valores cegados, el servidor los firma sin verlos, el cliente los desciega—, que es el mismo mecanismo de Privacy Pass. La spec exige la propiedad y no la biblioteca; lo que no vale es una ficha que sea un identificador con otro nombre.

Y una consecuencia que conviene ver de frente antes de que alguien la descubra tarde: **sin identificador persistente no puede haber presupuesto por instalación**. Un contador por móvil es exactamente el identificador que `arquitectura.md` §3 descartó. El control de abuso es otro y es más tosco: la atestación asegura que la app es la app, los topes por lote cortan los bucles, y el tope diario global acota lo peor que puede pasar. Quien tenga un dispositivo legítimo puede volver a atestar tantas veces como quiera. Es un coste asumido, y el tope diario es su límite.

### Los tres pendientes, convertidos en parámetros

Ninguno se cierra inventando producto. Los tres se convierten en un parámetro con valor por defecto justificado, y el documento de diseño que los tiene abiertos sigue siendo quien los cierre.

| Parámetro | Valor por defecto | De dónde sale |
| --- | --- | --- |
| `POLITICA_SIN_ATESTACION` | `solo-cache` | `arquitectura.md` p2, riesgo 6 |
| `CUOTA_VIA_DEGRADADA` | 5 % de las peticiones del día | acota el coste de servir caché a quien no atesta |
| `FICHAS_POR_TANDA` | 200 | cubre un mapa nuevo y varias salidas sin volver a atestar |
| `VIGENCIA_TANDA` | 7 días | corta el valor de una tanda robada sin obligar a atestar cada día |
| `VIGENCIA_RETO` | 5 minutos | lo justo para completar una atestación |
| `VIGENCIA_LOTE` | 15 minutos | lo que dura crear un mapa con margen |
| `TOPE_PAGO_LOTE_MAPA` | 60 llamadas de pago | orden de magnitud de un mapa con sus ilustraciones y sus fotos |
| `TOPE_PAGO_LOTE_SALIDA` | 8 llamadas de pago | los textos de una aventura y sus beats |
| `TOPE_DIARIO_GASTO` | **sin valor por defecto** | `arquitectura.md` p3: el proxy no arranca sin él |
| `CACHE_GENERACION` | `off` | `seguridad-privacidad.md` p2 |
| `VENTANA_METRICA` | día natural | granularidad por debajo de la cual un contador describe una sesión |
| `MTIME_CONSTANTE` | un instante fijo declarado | que el sistema de ficheros no responda «cuándo» |
| `ESPERA_MAXIMA_AGUAS_ARRIBA` | 20 segundos | por debajo del minuto de RNF-PER-001, con margen para reintentar nada |

**1 · Qué pasa cuando la atestación falla.** El rechazo duro deja fuera a gente legítima —dispositivos rooteados, emuladores, sistemas viejos— y eso es el riesgo 6. Aceptar a todo el mundo regala la factura. El valor por defecto se apoya en algo que este juego ya tiene y otros no: **quedarse sin proxy no es un fallo, es un modo diseñado**. RNF-RED-001 exige que una salida entera se complete sin cobertura con degradación silenciosa, y RNF-DET-002 garantiza que la estructura del juego es la misma con LLM y sin él. Así que sin atestación válida se sirve lo que ya está en la caché —que ya está pagado y es igual para todo el mundo— y no se hace ni una llamada de pago. Un atacante con la URL consigue lo que ya teníamos, que no vale nada; un jugador con el móvil rooteado consigue un juego completo con textos de plantilla y sin ilustraciones nuevas. Y sobre todo: **no hay ninguna pantalla que le diga que su móvil no vale**, porque el cliente no distingue esto de estar sin cobertura.

Lo que este parámetro no decide, y es de producto: si algún día se quiere ofrecer una vía de pago aguas arriba a quien no puede atestar. Eso exige o bien identificar, o bien aceptar el abuso, y esa es la decisión que sigue abierta en `arquitectura.md` p2.

**2 · El presupuesto de coste por jugador.** El pendiente pide una cifra y esta spec no la puede inventar, pero sí puede entregar el instrumento y evitar que el instrumento reintroduzca identidad. La unidad de medida no es el jugador: es el **lote de trabajo**, que ya existe en el diseño porque las fotos de Places se piden todas al crear el mapa (`seguridad-privacidad.md` §1) y los textos de una aventura se piden al preparar la salida. De ahí salen dos medidas honestas —coste medio y dispersión por lote de mapa, y lo mismo por lote de salida— y una tercera que no se mide sino que se modela: cuántas salidas juega alguien con un mapa. El coste por jugador es el producto, y se declara como modelo. Medir el tercer factor exigiría contar salidas por móvil, que es el identificador que no hay.

El `TOPE_DIARIO_GASTO` sin valor por defecto es deliberado y es la mitad de la mitigación del riesgo 3: una clave de API sin tope es la forma conocida de descubrir el presupuesto cuando ya se ha gastado. El proxy se niega a arrancar sin él, igual que SPEC-009 se niega a levantar un documento sin versión.

**3 · La caché del proxy de generación como registro de coordenadas.** Este es el delicado, y hay que decirlo entero.

El prototipo cachea Overpass por hash de la consulta y no vuelve a pedirla nunca. En el servidor de todos, esa misma caché es un conjunto de zonas que alguien pidió: nadie sabe quién, pero el mapa de qué zonas se han generado existe en el disco. Y no se arregla con un hash, porque el contenido de la entrada **es** la zona: son los datos de OSM de ese sitio.

Hay algo más, y no lo entierro porque es la parte que no está en el pendiente: **la caché de imágenes tiene la misma forma**. El prompt de ficción es una función determinista de la semilla, y la semilla es la coordenada redondeada del mapa (SPEC-003). Cualquiera con el generador puede recorrer coordenadas, calcular el prompt que saldría y preguntar a la caché si esa imagen existe. La caché de lo inerte es, en esa medida, un oráculo de qué celdas se han generado alguna vez. Vale también para las fotos: un `place_id` cacheado dice que alguien generó un mapa que contiene ese sitio.

Lo que se puede hacer, y es lo que fija esta spec:

- **Que el oráculo responda un solo bit y nada más.** Sin marca de tiempo en la entrada, sin marca de tiempo en el sistema de ficheros, sin contador de aciertos, sin entradas negativas y sin ninguna ruta que enumere. La respuesta pasa a ser «alguien, alguna vez, aquí», y deja de poder ser «cuándo», «cuántos» ni «con qué frecuencia».
- **Que la caché de generación venga apagada.** El motivo por el que existe el Overpass propio es la fricción, no el ahorro (`arquitectura.md` p1), y ese Overpass ya tiene dentro los datos de España enteros, iguales para todo el mundo y sin ninguna relación con la demanda. Cachear encima añade un registro de zonas pedidas a cambio de un tiempo que la fila 24 tiene que conseguir de todos modos para cumplir RNF-PER-001. Si al medir hiciera falta encenderla, se enciende con los criterios de arriba y con la consecuencia escrita en el despliegue.
- **Que la consecuencia se declare en lugar de disimularse.** «El proxy no identifica a nadie» sigue siendo cierto —no hay forma de atar una zona a una persona ni dos llamadas entre sí—, y a la vez el disco contiene un mapa de zonas jugadas. Las dos cosas son verdad y la segunda no se esconde.

Lo que **no** se puede afirmar, y por eso está aquí y no en un criterio: quien opera el servidor ve el tráfico en vivo mientras pasa. La dirección IP correlaciona las llamadas de un lote mientras están en vuelo, y ninguna decisión de código lo evita. Lo que esta spec garantiza es que no queda escrito, que el proxy no lo usa para nada y que no sobrevive a la petición. La diferencia entre eso y una promesa vacía es la superficie de escritura declarada: se puede listar, se puede recorrer y se puede poner en rojo.

### La superficie de escritura, que es el mecanismo y no una lista

`server/superficie.mjs` es la pieza que convierte «no registramos nada» en algo comprobable. Declara, una a una, cada entrada que el proxy puede escribir: su ruta, de qué se deriva su clave, qué campos lleva, cuánto vive y qué ventana de tiempo admite. El proxy comprueba esa declaración al arrancar contra lo que sus módulos dicen que escriben, y no arranca si alguien añadió una escritura sin declararla.

| Entrada | Clave derivada de | Qué guarda | Cuánto vive |
| --- | --- | --- | --- |
| Caché de imágenes | resumen del prompt de ficción y el formato | binario | indefinido |
| Caché de fotos | `place_id` | binario y atribución de Places | indefinido |
| Caché de generación (apagada por defecto) | resumen de la consulta de celda | respuesta de Overpass | indefinido |
| Retos de atestación vivos | valor aleatorio del propio reto | nada más que el reto | `VIGENCIA_RETO` |
| Fichas gastadas | la propia ficha | nada más que la ficha | `VIGENCIA_TANDA` |
| Métrica del día | día natural | contadores e histogramas | indefinido |

Seis entradas, y ninguna con una clave derivada de quien llama. Los textos del LLM no aparecen: no se cachean, porque el texto de una aventura ya se guarda con la partida en el móvil (SPEC-009) y cachearlo en el servidor añadiría la única categoría de contenido que sí es de alguien en concreto.

### El sobre común, que cierra una convención pendiente del andamiaje

`test/fixtures/proxy/respuestas.json` lleva escrito desde SPEC-001 que la forma del sobre «es convención del andamiaje hasta que la spec del proxy la cierre». Esta es esa spec, y la cierra con la forma que el andamiaje ya usa: un objeto por tipo, con el contenido dentro, más la marca de si vino de caché. Los tres tipos siguen siendo `texto`, `imagen` y `places`, y se les suma `generacion`. Cambiar esa forma ahora obligaría a reescribir los fixtures y las pruebas que dependen de que con LLM y sin LLM la estructura es idéntica, y no hay ninguna razón para hacerlo.

La respuesta «no hay» es parte del sobre y no un error de transporte: llega con el mismo código de éxito que las demás, con el contenido declarado ausente. Es lo que permite que el cliente trate igual el sin cobertura, el aguas arriba caído, el presupuesto agotado y la atestación fallida, que es exactamente lo que RNF-RED-001 pide y lo que evita que aparezca una pantalla explicando la red.

### Escenarios de `docs/testing.md` que esta spec verifica

Se referencian por su nombre literal, no se duplican: la batería se escribió antes que el código y sus nombres son el contrato con `wa-qa-dev`.

- **«El proxy no identifica a nadie»**, bloqueante → es el escenario que esta spec existe para hacer verdad, y todo el bloque «Lo que el proxy no escribe nunca» es su desarrollo. «No guarda quién llama, ni desde dónde, ni ninguna partida» pasa de promesa a recorrido sobre la superficie de escritura declarada.
- **«Las coordenadas salen una sola vez, al generar el mapa»**, bloqueante → aquí se sostiene la mitad del servidor: la ruta de generación es la única que las ve, ninguna otra ruta las admite en su esquema, y no quedan escritas en ninguna entrada de la superficie.
- **«Las fotos de Places se piden al crear el mapa»** → el proxy lo hace posible sirviendo el lote entero de fotos por `place_id` y cacheándolas por sitio; que el cliente no vuelva a pedirlas es de la fila 25 y de SPEC-009, que las congela.
- **«El prompt del LLM no lleva ningún dato real»** → aquí se entrega la segunda red: el esquema cerrado de la ruta de texto rechaza cualquier campo no declarado, sin necesidad de saber qué dice el contrato de la fila 18. Lo que viaja dentro del prompt es de esa fila.
- **«No se reporta a ningún sitio»** → afirmable sobre la superficie de rutas: no existe ningún endpoint que pueda recibir un anclaje descartado, ni ninguno de sucesos del jugador, y una ruta no declarada se rechaza sin escribir.
- **«Sin red, la aventura funciona entera»** y **«Con LLM y sin LLM la estructura es idéntica»** → la vía sin atestación, el presupuesto agotado y el aguas arriba caído terminan los tres en la misma respuesta «no hay», que es la que estos dos escenarios ya cubren desde el lado del cliente.
- **«Sin foto de Places, el visor abre igual»** → el «no hay» de la ruta de fotos es una de las formas de llegar a ese escenario.
- **«El doble del proxy responde lo mismo a la misma petición»** y **«Ninguna pieza del andamiaje sale a la red al importarse»** → el sobre común y los clientes inyectables son lo que mantiene el doble fiel al original.
- **«El rastro de ubicación no se guarda nunca»** → SPEC-009 lo afirma sobre la partida; aquí se afirma sobre el servidor, que es la otra mitad de la frase.

### Huecos de la batería que esta spec deja al descubierto

`docs/testing.md` tiene el escenario que importa —«El proxy no identifica a nadie»— y no tiene ninguno de los que hacen falta para afirmarlo de verdad. Habría que añadirlos antes de dar la spec por verificada, y todos son de nivel `@nucleo`, porque el proxy es Node y se ejercita con `node --test` sin dispositivo y sin red:

1. **La superficie de escritura declarada.** Que existe, que se puede recorrer, que un mes de tráfico no deja nada fuera de ella y que una escritura sin declarar impide arrancar. Es el mecanismo entero y no tiene ni una línea en la batería.
2. **La separación de los dos planos.** Que la ruta de atestación no ve ficción, que las rutas de contenido no ven plataforma, y que dos fichas no se pueden enlazar.
3. **La política cuando la atestación falla.** Acierto de caché sí, llamada de pago no, salida entera completable, y ninguna pantalla que lo mencione.
4. **Los topes y el presupuesto.** Que el proxy no arranca sin tope diario, que un bucle del cliente se corta por lote, y que agotar el presupuesto se comporta como quedarse sin cobertura.
5. **La medición de coste sin identidad.** Que la métrica no baja del día, que no hay unidad de jugador y que del histograma no se reconstruye ninguna secuencia.
6. **La caché como oráculo.** Que no hay marca de tiempo, ni en la entrada ni en el sistema de ficheros; que no hay contador de aciertos, ni entradas negativas, ni enumeración.

### Lo que hace falta añadir al andamiaje

`wa-qa-dev` necesitará dos dobles que SPEC-001 no entregó, porque allí el proxy era el sujeto simulado y aquí es el sujeto probado: **dobles de los cuatro proveedores de aguas arriba** —con los mismos tres modos que ya tiene el doble del proxy: responde, falla siempre, responde mal— y un **doble del verificador de atestación**, con evidencia válida, falsificada y ausente. Los dos se apoyan en que esta entrega los recibe inyectados, que es la razón de que la frontera de inyección esté escrita como está.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-016.
- **Sin sección de comportamiento responsive ni bloque de UX Design** → asumido por decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz: lo único que el jugador percibe es la degradación silenciosa que ya está especificada en otras filas.
- **La atestación se separa en un plano propio y las rutas de contenido se pagan con fichas anónimas no enlazables** → asumido (alternativa: verificar una aserción de App Attest en cada llamada, que es lo más simple y lo que hace casi todo el mundo). Regla: RNF-PRIV-001 prohíbe el identificador persistente de instalación, y el identificador de la clave atestada lo es; verificar en cada llamada lo pondría delante del proxy en cada llamada, y ninguna promesa posterior lo arregla.
- **La propiedad exigida es la no enlazabilidad, no una biblioteca concreta** → asumido, con la firma ciega al estilo Privacy Pass nombrada como la forma conocida (alternativa: fijar la biblioteca en la spec). Regla: `wa-spec` define comportamiento y no arquitectura; lo que no se negocia es que una ficha no sea un identificador con otro nombre.
- **Sin atestación válida se sirve solo lo cacheado y nunca se llama a aguas arriba de pago** → asumido (alternativas: rechazo duro, o cuota reducida con llamadas de pago). Regla: riesgo 6 dice que el rechazo duro deja fuera a gente legítima, y RNF-RED-001 más RNF-DET-002 hacen que quedarse sin proxy sea un modo diseñado y no un fallo; además convierte el robo de la URL en un botín sin valor. La política definitiva sigue siendo el pendiente 2 de `arquitectura.md`.
- **La caché de generación viene apagada** → asumido (alternativa: encenderla, que es lo que hace el prototipo hoy). Regla: `seguridad-privacidad.md` p2 la deja abierta precisamente porque en un servidor compartido es un registro de zonas pedidas; el Overpass propio existe por fricción y ya tiene los datos, así que encenderla compra tiempo que la fila 24 debe conseguir de todos modos.
- **Las entradas de caché no llevan marca de tiempo, ni en el fichero ni en el sistema de ficheros** → asumido, normalizando la marca del sistema de ficheros a una constante (alternativa: dejar la marca real, que es lo que hace cualquier escritura). Regla: sin esa normalización, «no registramos cuándo» es falso y lo desmiente un `ls -l`; es la diferencia entre un oráculo de un bit y un registro con fecha.
- **La caché no tiene entradas negativas ni contador de aciertos** → asumido (alternativa: cachear los fallos para no repetir llamadas caras, y contar aciertos para medir la caché). Regla: un contador de aciertos responde «cuántos han pasado por aquí» y una entrada negativa dobla la superficie enumerable; el ahorro se mide igual con los contadores agregados del día.
- **Los textos del LLM no se cachean en el servidor** → asumido (alternativa: cachearlos por prompt igual que las imágenes, que ahorraría lo que más se llama). Regla: `arquitectura.md` §3 dice «cachea solo lo inerte» y nombra imágenes y fotos, no textos; el texto de una aventura ya vive en la partida del móvil (SPEC-009) y es la única categoría de contenido que describe la aventura concreta de alguien.
- **La unidad de medida del coste es el lote de trabajo y el coste por jugador es un modelo declarado** → asumido (alternativa: contar por instalación, que daría la cifra que el pendiente 3 pide). Regla: contar por instalación es el identificador persistente que RNF-PRIV-001 descarta; el lote ya existe en el diseño porque las fotos se piden todas al crear el mapa, y de él salen dos de los tres factores medidos de verdad.
- **El identificador de lote es efímero, no se persiste y no entra en la métrica** → asumido (alternativa: no tener lote y aplicar los topes por ventana global). Regla: sin lote no hay tope que corte un bucle del cliente antes de que se coma el presupuesto del día; se acepta a cambio que durante sus minutos de vida el proxy pueda relacionar las llamadas de un mismo lote, que es algo que el orden y el tiempo de las peticiones ya permitían y que no sobrevive a la petición.
- **La métrica no baja del día natural** → asumido (alternativa: por hora, que es lo normal en operación). Regla: con poco tráfico, una serie por hora dibuja las sesiones de una persona; el día es la ventana más fina que no lo hace y sigue sirviendo para presupuestar.
- **`TOPE_DIARIO_GASTO` no tiene valor por defecto y el proxy no arranca sin él** → asumido (alternativa: un valor por defecto generoso). Regla: riesgo 3, el coste no tiene todavía presupuesto; un valor por defecto convierte una decisión pendiente en una factura, y el precedente de negarse a arrancar sin un dato obligatorio ya está en SPEC-009 con la versión del formato.
- **Los números de tandas y topes (200 fichas, 7 días, 60 y 8 llamadas de pago por lote)** → asumidos (alternativa: no fijar ninguno y dejarlos a la operación). Regla: son órdenes de magnitud derivados de lo que el diseño ya dice que ocurre en un mapa y en una salida, y sirven para que el implementador entregue el mecanismo con un valor; se ajustan con la primera medición, que es justamente lo que la métrica de esta spec existe para dar.
- **El esquema de cada ruta es cerrado y un campo de más se rechaza** → asumido (alternativa: ignorar lo desconocido y reenviarlo). Regla: es el mismo criterio con el que SPEC-009 cierra el esquema del documento de partida, y por la misma razón: un esquema abierto es por donde se cuela un día un campo con el nombre real del bar sin que nada se ponga rojo.
- **La clave de caché la deriva siempre el proxy del contenido y nunca la elige el cliente** → asumido (alternativa: que el cliente mande la clave, que ahorra recalcular el resumen). Regla: una clave elegida por el cliente permite envenenar la caché y, peor para lo que aquí importa, permite meter en la clave lo que a uno le apetezca, que es exactamente lo que la superficie de escritura declarada intenta impedir.
- **«No hay» es una respuesta normal del sobre y no un error de transporte** → asumido (alternativa: devolver códigos de error distintos por motivo). Regla: RNF-RED-001 exige que ninguna pantalla mencione la red, y un cliente que distingue «sin atestación» de «presupuesto agotado» acaba enseñando esa distinción; con una sola forma de ausencia, la degradación silenciosa sale sola.
- **La coalescencia de peticiones iguales simultáneas** → asumido (alternativa: dejar que las dos llamen a aguas arriba). Regla: es la mitad del ahorro de la caché en el caso que más se repite —dos jugadores generando la misma celda— y no añade nada a la superficie de escritura, porque vive en memoria y muere con la petición.
- **`server/` es JavaScript ESM sobre Node nativo, con las dependencias de criptografía y verificación declaradas una a una** → asumido (alternativa: un framework de servidor). Regla: `03-stack-context.md` fija el mínimo de toolchain para el repo entero, y la verificación de App Attest y las firmas ciegas son justamente lo que no se puede escribir a mano con criterio.
