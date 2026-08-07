# SPEC-007 — El grafo de calzadas: cosido del callejero y ramales con nombre

## Descripción

El callejero que llega de OpenStreetMap no es una red: es un montón de trozos. En un mundo real medido salieron 109 componentes conexas, muchas separadas por 9-50 m y la red entera del norte a 157 m del resto — no son carreteras distintas, es que a los ways les faltan nodos compartidos o el corte del bounding box parte la conexión. Esta spec cierra las dos cosas que hacen falta para que el grafo del que cuelgan el trazado, el casting y el filtro sea honesto: **coser los huecos cortos antes de trazar, marcando como suposición nuestra toda arista que no exista en OSM**, y **dar nombre a los ramales que llevan a los parajes**, porque un camino sin nombre no se puede ni ofrecer ni evitar.

No tiene interfaz de usuario. Lo consumen el trazado de calzadas, el enlace de parajes, el filtro de accesibilidad (fila 8), la propagación de rumores (fila 12) y la serialización del mundo congelado (fila 9). La pantalla donde se ve el resultado —el desvío que se ofrece nombrando el ramal, nodo **A3P5** de `docs/flujo.md`— la implementa la fila 29 (`en-marcha-mapa-avisos`) y aquí no se dibuja.

Ancla: **RF-MUNDO-013** y **RF-MUNDO-014** (`docs/prd.md` §4.1), cuya fuente es `game-design/accesibilidad.md` §2 —que manda sobre el PRD— y, por el lado del precedente medido, la trampa «El callejero de OSM llega troceado» de `CLAUDE.md`. **RNF-DET-001** y **RNF-DET-003** aplican como invariante bloqueante.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Fuera de alcance por pertenecer a otra fila del checklist**, aunque se rocen aquí: el **filtro** que decide qué aristas se evitan y cómo se declaran (fila 8, `filtro-accesibilidad-grafo`); los **tags de accesibilidad** en la consulta de callejero, que hoy no se piden (fila 8); el **cosido de calzadas entre celdas contiguas** (fila 3, RF-MUNDO-004); la **serialización** del mundo (fila 9); la **penalización de los tramos `fallback`** en la propagación de rumores (fila 12); y la **pantalla del desvío** A3P5 (fila 29). Esta spec entrega el dato y el nombre que todas ellas necesitan, y nada más.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «El grafo viario, construido una vez», «El cosido de los huecos cortos» y «Los ramales a parajes y su nombre»; la validación de entradas, en «Entradas inválidas» (umbral, ways degenerados, paquete de idioma incompleto); el estado vacío, en «Mundos sin nada que coser» (callejero vacío, un solo núcleo, ningún paraje que enlazar); el estado de error, en la marca ausente, el nombre imposible y la componente que no se puede alcanzar; y los casos límite, en el hueco exactamente en el umbral, los empates de distancia, el puente sobre la carretera y el paraje que cae al otro lado de un hueco largo.

Los criterios van en `Dado / Cuando / Entonces` como el resto de la batería.

### El grafo viario, construido una vez

- **Dado** el callejero de un mundo, **cuando** se genera ese mundo, **entonces** el grafo viario se construye una sola vez y lo comparten el pegado de puntos al viario, el trazado de calzadas y el enlace de parajes.
- **Dado** el mismo callejero, **cuando** se construye el grafo dos veces, **entonces** los dos grafos tienen los mismos nodos, las mismas aristas, los mismos pesos y las mismas marcas.
- **Dado** un way del callejero con identificadores de nodo, **cuando** se construye el grafo, **entonces** cada par de nodos consecutivos del way produce una arista bidireccional cuyo peso es la distancia real entre ellos.
- **Dado** dos ways que comparten un identificador de nodo, **cuando** se construye el grafo, **entonces** comparten ese nodo y quedan en la misma componente sin necesidad de coser nada.
- **Dado** un grafo construido, **cuando** se le pide su informe, **entonces** declara cuántos nodos tiene, cuántas componentes conexas quedan, cuántas aristas se cosieron y cuál es la separación mínima que quedó sin coser.

### El cosido de los huecos cortos

- **Dado** un callejero con dos componentes separadas por 40 m, **cuando** se construye el grafo, **entonces** quedan conectadas por una arista cosida.
- **Dado** un callejero con dos componentes separadas por 400 m, **cuando** se construye el grafo, **entonces** no se cosen entre sí.
- **Dado** dos componentes separadas exactamente por el umbral de 180 m, **cuando** se construye el grafo, **entonces** se cosen: el umbral es inclusivo.
- **Dado** dos componentes separadas por 180,01 m, **cuando** se construye el grafo, **entonces** no se cosen.
- **Dado** dos componentes que tienen varias parejas de nodos por debajo del umbral, **cuando** se construye el grafo, **entonces** se cosen por su pareja más próxima y por una sola arista.
- **Dado** una arista cosida, **cuando** se lee su peso, **entonces** es la distancia real entre los dos nodos que une, no cero ni un valor de castigo.
- **Dado** dos nodos que ya están en la misma componente, **cuando** se cose el grafo, **entonces** no se añade ninguna arista entre ellos aunque estén por debajo del umbral: el cosido nunca crea un atajo dentro de una componente.
- **Dado** el fixture `barrio-tres-calles`, cuyo manifiesto declara cuatro componentes conexas separadas por 239, 22, 104 y 22 m, **cuando** se construye el grafo, **entonces** los tres huecos por debajo del umbral quedan cosidos y el de 239 m no.
- **Dado** dos ways que declaran `layer` distinto —un puente por encima de una carretera—, **cuando** se cose el grafo, **entonces** no se cosen entre sí aunque sus nodos estén por debajo del umbral.
- **Dado** dos ways sin `layer` declarado, **cuando** se cose el grafo, **entonces** se tratan como si estuvieran al mismo nivel.
- **Dado** dos ways que se cruzan en el plano sin compartir ningún nodo y con todos sus nodos por encima del umbral, **cuando** se construye el grafo, **entonces** el cruce no los conecta.
- **Dado** el umbral de cosido, **cuando** se consulta, **entonces** está expresado en metros y no se redimensiona con el tramo del jugador.

### Lo que no se cose y se declara

- **Dado** un callejero cuyas componentes quedan separadas por más del umbral, **cuando** se construye el grafo, **entonces** el informe declara cuántas componentes siguen separadas y el tamaño de cada una.
- **Dado** un núcleo que cae sobre una componente que quedó aislada, **cuando** se pegan los puntos al viario, **entonces** se mueve a la red principal si está dentro del tope de desplazamiento, y el desplazamiento queda registrado en metros.
- **Dado** un núcleo sobre una componente aislada y más lejos de la red principal que el tope de desplazamiento, **cuando** se pegan los puntos al viario, **entonces** se queda donde está y no se mueve a la fuerza.
- **Dado** dos núcleos que el grafo no puede conectar por ningún camino, **cuando** se trazan las calzadas, **entonces** se traza un tramo recto entre ellos marcado como suposición `fallback`, y no se presenta como calzada real en ningún dato.
- **Dado** un mundo con componentes aisladas, **cuando** se pide el informe del grafo, **entonces** nombra la separación mínima que quedó sin coser, para que se pueda distinguir un dato malo de una separación de verdad.

### La marca de suposición

- **Dado** cualquier arista del grafo, **cuando** se inspecciona, **entonces** lleva el campo de suposición declarado explícitamente, con valor nulo si la arista existe en OSM.
- **Dado** una arista construida sin el campo de suposición, **cuando** se valida el grafo, **entonces** la validación falla nombrando la arista.
- **Dado** una arista añadida por el cosido, **cuando** se inspecciona, **entonces** su marca es `cosida`.
- **Dado** un tramo trazado en recta porque el grafo no ofrecía camino, **cuando** se inspecciona, **entonces** su marca es `fallback`.
- **Dado** una arista que viene de un par de nodos consecutivos de un way real, **cuando** se inspecciona, **entonces** su marca es nula.
- **Dado** las dos marcas, **cuando** se comparan, **entonces** son valores distintos y distinguibles: `cosida` dice «esto está unido en la realidad y el dato no lo trae», `fallback` dice «por aquí no hay camino que conozcamos».
- **Dado** un mundo con aristas cosidas y con tramos `fallback`, **cuando** se inspecciona el grafo, **entonces** cada arista que no existe en OSM lleva su marca de suposición.

### La marca aguas abajo

- **Dado** una calzada trazada, **cuando** se recorren sus tramos, **entonces** cada tramo lleva su propia marca sin necesidad de volver a consultar el grafo.
- **Dado** una calzada cuyo camino atraviesa una arista cosida, **cuando** se inspecciona la calzada, **entonces** declara que contiene al menos una suposición `cosida`.
- **Dado** una calzada cuyo camino no atraviesa ninguna arista inventada, **cuando** se inspecciona, **entonces** declara que no contiene ninguna suposición.
- **Dado** un ramal cuyo camino atraviesa una arista cosida, **cuando** se inspecciona el ramal, **entonces** declara la suposición igual que lo haría una calzada.
- **Dado** un mundo generado, **cuando** se valida, **entonces** todo tramo de toda calzada y de todo ramal lleva marca, y un tramo sin marca hace fallar la validación nombrándolo.
- **Dado** el mundo generado, **cuando** se pregunta por la lista de tramos que son suposición nuestra, **entonces** se obtiene sin recorrer ninguna estructura interna del módulo del grafo.
- **Dado** dos calzadas, una con un tramo `fallback` y otra con un tramo `cosida`, **cuando** se pregunta cuál de las dos cruza un trozo sin calzada real, **entonces** solo la primera lo declara.

### Los ramales a parajes y su nombre

- **Dado** un paraje que no nació del grafo, **cuando** se enlazan los parajes, **entonces** recibe exactamente un ramal hasta la red de calzadas.
- **Dado** un paraje nacido del grafo —un cruce o un puente—, **cuando** se enlazan los parajes, **entonces** no recibe ramal porque ya está sobre una calzada.
- **Dado** un mundo con parajes enlazados, **cuando** se recorren todos sus ramales, **entonces** todos llevan nombre: ninguno queda nulo ni vacío.
- **Dado** un ramal que se resolvió con un tramo recto porque no había camino, **cuando** se inspecciona, **entonces** también lleva nombre.
- **Dado** un ramal con nombre, **cuando** se compara con el índice de nombres del mundo, **entonces** su nombre no coincide con el de ningún núcleo, servicio, paraje ni calzada.
- **Dado** un mundo generado en Galicia, **cuando** se leen los nombres de los ramales, **entonces** salen del paquete de idioma gallego, el mismo que resolvió el resto de los nombres del mundo.
- **Dado** un mundo generado fuera de Galicia, **cuando** se leen los nombres de los ramales, **entonces** salen del paquete de idioma castellano.
- **Dado** un ramal, **cuando** se lee su nombre, **entonces** es un nombre propio de senda en la voz del mundo y no un identificador, un número de orden ni una descripción de su función.
- **Dado** un mundo donde el sorteo de nombres de ramal agota sus formas libres, **cuando** se nombra el ramal que queda, **entonces** recibe la forma construida sobre el nombre del paraje al que lleva, que es única por construcción.
- **Dado** un ramal cuyo callejero declara escalones, **cuando** se nombra, **entonces** el nombre puede recoger ese rasgo, y si el dato no está el nombre se genera igual sin él.
- **Dado** un paquete de idioma que no implementa la función de nombrar ramales, **cuando** se enlazan los parajes, **entonces** falla con un error que nombra la función que falta y el paquete que la incumple.

### Determinismo del grafo

- **Dado** un mundo sembrado con `"42.40,-8.81#1"`, **cuando** se genera dos veces con los mismos datos de OSM, **entonces** el grafo cosido, las marcas y los nombres de los ramales son idénticos.
- **Dado** el mismo callejero servido en orden de llegada invertido, **cuando** se construye el grafo, **entonces** salen las mismas aristas cosidas, con las mismas marcas y los mismos pesos.
- **Dado** el mismo mundo con el callejero en orden invertido, **cuando** se nombran los ramales, **entonces** cada paraje recibe el mismo nombre de ramal que antes.
- **Dado** dos parejas de nodos candidatas a coser exactamente a la misma distancia, **cuando** se cose el grafo, **entonces** el desempate se resuelve por identificador de nodo y no por orden de llegada.
- **Dado** dos nodos del viario exactamente a la misma distancia de un punto que hay que pegar, **cuando** se elige a cuál pegarlo, **entonces** el desempate se resuelve por identificador de nodo.
- **Dado** la fase de nombres de ramal, **cuando** se inspecciona su fuente de azar, **entonces** usa un sufijo de semilla propio, distinto del de las calzadas.
- **Dado** que se cambia la implementación de la fase de ramales sin tocar las demás, **cuando** se genera otra vez con la misma semilla, **entonces** los nombres de las calzadas son idénticos a los de antes.
- **Dado** el módulo del grafo y el de los ramales, **cuando** se inspecciona su implementación, **entonces** no aparece `Math.random()`, ni `Date.now()`, ni ninguna iteración cuyo resultado dependa del orden de inserción de un `Set` o un `Map`.

### Mundos sin nada que coser

- **Dado** un mundo cuyo callejero llega vacío, **cuando** se construye el grafo, **entonces** queda un grafo sin nodos, sin aristas cosidas, y la construcción no falla.
- **Dado** un mundo sin callejero y con dos núcleos, **cuando** se trazan las calzadas, **entonces** todas salen marcadas `fallback` y ninguna se presenta como calzada real.
- **Dado** un mundo con un solo núcleo, **cuando** se trazan las calzadas, **entonces** no se traza ninguna y no se produce ningún error.
- **Dado** un mundo sin ningún paraje, **cuando** se enlazan los parajes, **entonces** no se produce ningún ramal y no se pide ningún nombre al paquete de idioma.
- **Dado** un mundo cuyos parajes son todos de origen grafo, **cuando** se enlazan, **entonces** no se produce ningún ramal.
- **Dado** un callejero de una sola componente ya conexa, **cuando** se construye el grafo, **entonces** no se cose ninguna arista y el informe declara cero cosidos.

### Entradas inválidas

- **Dado** un umbral de cosido que no es un número positivo, **cuando** se construye el grafo, **entonces** falla nombrando el parámetro inválido.
- **Dado** un way con un solo punto, **cuando** se construye el grafo, **entonces** aporta su nodo y ninguna arista, sin fallar.
- **Dado** un way con dos puntos en la misma coordenada, **cuando** se construye el grafo, **entonces** no se añade una arista de peso cero.
- **Dado** un way sin identificadores de nodo, **cuando** se construye el grafo, **entonces** sus nodos se identifican por coordenada de forma estable entre ejecuciones.
- **Dado** dos ways distintos con el mismo identificador para nodos en coordenadas distintas, **cuando** se construye el grafo, **entonces** falla nombrando el identificador en conflicto en lugar de fusionar dos sitios que no son el mismo.
- **Dado** una lista de parajes que llega nula, **cuando** se enlazan, **entonces** devuelve una lista vacía de ramales sin fallar.

## Notas técnicas

### Qué se porta y qué se refina

El prototipo ya tiene todo esto en `app/js/world/routes.js` y esta spec lo lleva a `packages/nucleo/world/` con cuatro refinamientos, que son la razón de que la fila exista y no sea una copia:

1. **El grafo se construye una vez.** Hoy `buildGraph` se llama tres veces sobre el mismo callejero —desde `pegarAViario`, desde `buildRoutes` y desde `linkParajes`—, y las tres cosen otra vez lo mismo. Pasa a construirse una vez por celda e inyectarse a las tres fases.
2. **La marca de suposición pasa de booleano a enumerado y baja al nivel de tramo.** Hoy `fallback` es un booleano de ruta entera y el cosido no deja rastro ninguno: una calzada perfectamente real que atraviesa una arista cosida se presenta hoy como calzada real de punta a punta.
3. **La unicidad de los nombres pasa de intento a garantía.** El bucle actual prueba diez formas y, si todas están cogidas, acepta la repetida. Con un índice global de nombres eso es un fallo silencioso.
4. **Los ramales dejan de nacer sin nombre.** Era deliberado —«sendas de acceso, no calzadas con historia», dice el comentario del módulo— y `accesibilidad.md` §2 lo revoca por escrito.

### Reparto de módulos

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/world/grafo.js` | construcción del grafo, cosido, componentes, informe, pegado al viario |
| `packages/nucleo/world/routes.js` | trazado de calzadas y enlace de parajes sobre el grafo ya construido |
| `packages/nucleo/names/es.js`, `packages/nucleo/names/gl.js` | la función nueva de la interfaz común |

`app/js/world/routes.js` es el origen del porte y no se borra en esta spec: el prototipo sigue en pie hasta que la app nueva lo sustituya (fila 20 en adelante).

### La forma de la marca

El campo se llama `suposicion` y vive **en la arista del grafo y en el tramo de la calzada o del ramal**, nunca solo en la ruta entera:

| Valor | Qué significa | Quién la pone |
| --- | --- | --- |
| `null` | la arista existe en OSM entre dos nodos consecutivos de un way | la construcción del grafo |
| `'cosida'` | une dos nodos reales de OSM que el dato no traía unidos | el cosido |
| `'fallback'` | recta trazada donde el grafo no ofrecía camino | el trazado y el enlace de parajes |

El campo es obligatorio: una arista o un tramo sin él es un error de construcción, no un «no lo sé». Ese es todo el mecanismo que impide que la marca se pierda aguas abajo — si el consumidor tiene que decidir qué hacer con un valor que siempre está, no puede olvidarse de que existe.

**Las dos marcas no son intercambiables y por eso el campo es un enumerado y no un booleano.** El filtro de accesibilidad (fila 8) trata a las dos igual: ninguna se promete transitable. La propagación de rumores (fila 12) solo penaliza `fallback`, porque cruzar un hueco de 22 m que OSM no trae no es lo mismo que cruzar por donde no hay camino — el escenario «Cruzar un tramo sin calzada real cuesta un nivel más» habla de `fallback` y no de lo cosido.

### El umbral, en metros y no en tramos

`COSER_MAX` se queda en **180 m** y se queda **en metros**. `accesibilidad.md` §1 obliga a reexpresar en tramos los cupos de `parametros-mundo.md`, y esto no entra: el umbral no mide una distancia jugable, mide un defecto del dato. Un hueco de 22 m entre dos ways es el mismo defecto para quien anda 6 km y para quien anda 900 m. Reexpresarlo en tramos haría que el mismo callejero produjera grafos distintos para dos personas, que es exactamente el fallo que el invariante de determinismo intenta evitar.

Los otros dos topes que el porte arrastra —2 km para enganchar un punto al viario, 1,2 km para mover un núcleo hasta la red principal— siguen la misma lógica y también se quedan en metros.

### La función nueva del paquete de idioma

La interfaz común de `names/` crece con una función. Se añade a los dos paquetes, `es` y `gl`, y añadir un idioma nuevo pasa a implicar implementarla también:

```
ramalName(rng, dirWord, hastaName, rasgo)
```

- `dirWord` sale de `directionWord`, como en `roadName`.
- `hastaName` es el nombre del paraje al que lleva el ramal, que ya está asignado cuando se enlaza.
- `rasgo` es opcional y hoy puede llegar nulo: `'escalones'`, `'tierra'`, `'estrecho'` o nada. Sesga la forma base, no la determina. Los tags que lo alimentan (`highway=steps`, `surface`, `smoothness`) todavía no se piden en la consulta de callejero y los añade la fila 8; hasta entonces llega nulo y el nombre sale igual.

**El registro no es el de una calzada.** `roadName` produce caminos, calzadas y rutas; un ramal es una senda, una corredoira, una escalinata. La pantalla A3P6 se llama «La Escaleira Vella» precisamente por esto: el nombre tiene que poder sostener las dos frases que lo usarán, la oferta de desvío de A3P5 y la declaración de camino evitado de la fila 8.

**Unicidad garantizada, no intentada.** El sorteo prueba formas contra el índice global; si se agotan, cae a la forma construida sobre el nombre del paraje —«A Senda de O Fuso da Vella»—, que es única porque el nombre del paraje lo es y porque cada paraje recibe como mucho un ramal. Nunca se desambigua con un número: un «Senda 2» rompe la voz del mundo.

### Frontera de inyección

Esta spec **no** añade ninguna entrada ni salida nueva del exterior: ni red, ni reloj, ni almacenamiento. El paquete de idioma ya se inyecta. Lo que cambia es interno al núcleo: el grafo pasa de construirse dentro de cada fase a recibirse como argumento en las tres. Sí queda una dependencia de orden con otras filas del checklist:

- **Fila 2 (`paquete-compartido`)** tiene que existir antes: esta spec escribe dentro de `packages/nucleo/world/` y de `packages/nucleo/names/`.
- **Fila 6 (`parajes-cobertura-escenas`)** nombra los parajes antes de que se enlacen; el nombre del ramal depende de eso.
- **Fila 3 (`rejilla-celdas-semilla`)** cose las calzadas entre celdas contiguas (RF-MUNDO-004). Ese cosido es otro, pero reutiliza este módulo y produce marcas `'cosida'` con la misma semántica. Aquí solo se garantiza que el contrato sirve para eso.
- **Fila 1 (`andamiaje-pruebas`)** trae el fixture `barrio-tres-calles`, con sus cuatro componentes declaradas en el manifiesto. Es el caso de prueba de esta spec y por eso hay un criterio que lo cita por nombre.

### Escenarios de la batería que verifican esta spec

Ninguno se implementa aquí —son de `wa-qa-dev`— pero esta spec está escrita para que se puedan afirmar sin añadir nada:

- Característica **«El callejero troceado de OSM se cose antes de trazar»**: «Los huecos cortos se cosen», «Los huecos largos no se cosen», «Lo cosido y lo inventado queda marcado».
- Característica **«El mundo es una función de la semilla y de los datos de OSM»**: «Dos generaciones con la misma semilla dan el mismo mundo», «Cada fase usa su propio sufijo de azar», «No se usa ninguna fuente de azar ni de tiempo del sistema», «El orden de iteración no depende del orden de inserción».
- Característica **«Los nombres son únicos y del idioma del sitio»**: «No hay dos nombres iguales en un mundo», «El idioma sale de la ubicación».
- Característica **«El filtro sobre el grafo evita y declara, nunca borra»**: «Lo que nos inventamos no se promete como transitable» — la verifica la fila 8, pero solo puede afirmarla si la marca que entrega esta spec existe y sobrevive.
- Característica **«El rumor nace donde ocurrió y viaja por el árbol de calzadas»**: «Cruzar un tramo sin calzada real cuesta un nivel más» — igual: la verifica la fila 12 sobre la marca de aquí.

### Huecos de cobertura de la batería

Se anotan para que `wa-qa-dev` los marque como hueco en `test/spec-test-map.json` en lugar de inventarse un escenario:

- **RF-MUNDO-014 no tiene ningún escenario en `docs/testing.md`.** El PRD lo ancla solo a `[flujo: A3P5]`. Todo el grupo «Los ramales a parajes y su nombre» queda sin escenario que lo respalde.
- **La componente que queda aislada no tiene escenario.** «Los huecos largos no se cosen» afirma que no se cosen, pero nada afirma que la separación se declare.
- **La supervivencia de la marca aguas abajo no tiene escenario.** «Lo cosido y lo inventado queda marcado» mira el grafo; nada mira la calzada ni el ramal.
- **El umbral no aparece en ningún escenario.** Los dos que hay usan 40 m y 400 m, que están holgadamente a los dos lados; el comportamiento en el borde no está cubierto por la batería.

## Decisiones asumidas

- **El campo se llama `suposicion` y es un enumerado de tres valores** → asumido (alternativa: dos booleanos `cosida` y `fallback`, o mantener el booleano `fallback` de hoy). Regla: `accesibilidad.md` §2 pide marcar las dos cosas y la fila 12 penaliza solo una de ellas; con un booleano único no se pueden distinguir, y con dos booleanos el estado «las dos a la vez» existe en el tipo sin existir en el dominio.
- **La marca vive en el tramo, no en la ruta** → asumido, con la ruta declarando el resumen de lo que contienen sus tramos (alternativa: solo a nivel de ruta, como hoy). Regla: una calzada de 3 km que cruza 22 m cosidos no es una calzada inventada, y marcarla entera como suposición haría que el filtro de la fila 8 descartara media red.
- **El campo es obligatorio y su ausencia es un error de construcción** → asumido (alternativa: opcional, con `undefined` equivalente a «existe en OSM»). Regla: es el único mecanismo que hace que «ninguna capa aguas abajo la puede perder en silencio» sea comprobable; con un campo opcional, perderla y no haberla tenido nunca son indistinguibles.
- **El umbral de cosido se queda en 180 m** → asumido (alternativa: recalibrarlo con los fixtures). Regla: sale de una medición real documentada en `CLAUDE.md` —la red del norte a 157 m del resto— y bajarlo la volvería a partir; los escenarios de la batería (40 m y 400 m) son compatibles con cualquier umbral entre esos dos, así que no lo cuestionan.
- **El umbral es inclusivo** → asumido: a exactamente 180 m se cose (alternativa: estricto). Regla: no lo cubre ningún documento; se elige el que hace que el comportamiento en el borde sea el mismo que en el lado corto, que es el lado conservador para la conectividad y no afecta a la honestidad del dato porque la arista queda marcada igual.
- **El umbral se expresa en metros y no en tramos** → asumido (alternativa: en tramos, como pide `accesibilidad.md` §1 para los cupos). Regla: mide un defecto del dato de OSM y no una distancia jugable; en tramos, el mismo callejero daría grafos distintos a dos personas y rompería RNF-DET-001.
- **Dos ways con `layer` distinto no se cosen entre sí** → asumido (alternativa: coser por proximidad sin mirar el nivel, como hoy). Regla: un puente que pasa por encima de una carretera tiene nodos a pocos metros en planta y coserlos inventa un enlace que no existe; no lo cubre ningún documento, pero contradice de frente «todo elemento de fantasía se ancla a un lugar real». Si el tag no está, se asume el mismo nivel.
- **La función nueva del paquete de idioma se llama `ramalName`** y se añade a la interfaz común → asumido (alternativa: reutilizar `roadName`). Regla: `design-system.md`, los dos registros; `roadName` produce calzadas —«O Camiño do Leste», «A Calzada do Norte»— y un ramal es una senda. Reutilizarla haría que un desvío de 200 m se anunciara como una calzada del reino.
- **La unicidad se garantiza cayendo al nombre del paraje** → asumido (alternativa: sufijo numérico, o aceptar la repetición como hoy). Regla: el escenario «No hay dos nombres iguales en un mundo» es de `@determinismo` y por tanto bloqueante; y `design-system.md` prohíbe cifras que solo existen en la maqueta, lo que descarta el sufijo numérico.
- **Cada paraje que no nace del grafo recibe exactamente un ramal** → asumido (alternativa: varios accesos por paraje). Regla: es lo que hace el prototipo, y además es lo que hace única por construcción la forma de desempate del nombre.
- **El `rasgo` que sesga el nombre es opcional y hoy llega nulo** → asumido (alternativa: bloquear esta spec hasta que la fila 8 pida los tags de accesibilidad en la consulta). Regla: `accesibilidad.md` §2 pide el nombre para dos usos, y solo uno de los dos necesita el rasgo; bloquear la fila 7 sobre la 8 invertiría el orden de dependencias del checklist.
- **El grafo se construye una vez y se inyecta a las tres fases** → asumido (alternativa: dejar las tres construcciones del prototipo). Regla: tres cosidos del mismo callejero son tres oportunidades de divergir, y RNF-DET-001 no admite ninguna; además es la fase más cara del generador y la fila 26 la va a ejecutar en un móvil.
- **Un identificador de nodo repetido en coordenadas distintas hace fallar la construcción** → asumido (alternativa: quedarse con la primera coordenada, que es lo que hace hoy el `if (!coord.has(...))`). Regla: fusionar dos sitios que no son el mismo produce un grafo que miente sin avisar, y es exactamente la clase de fallo silencioso que esta spec existe para cerrar.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` y de SPEC-001 (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo el proyecto, y `wa-qa-dev` cruza specs y batería con grep.
- **Sin sección de UX Design ni de comportamiento responsive** → asumido: esta spec no tiene interfaz, y la pantalla A3P5 que consume su resultado es de la fila 29. Regla: decisión 3 de `pipeline/decisiones-orquestador.md`.
