# Decisiones del orquestador

Ejecución desatendida del paso 4 (`docs/prompt-implementacion.md`), noche del 7 al 8 de agosto de 2026. El encargo prohíbe preguntar, así que toda ambigüedad se resuelve aquí con la opción más razonable y queda declarada. Este fichero es del orquestador; las decisiones de producto de cada spec van en su propia sección `## Decisiones asumidas`.

## 1 · Dónde viven las specs

`.claude/rules/naming.md` dice `docs/specs/SPEC-NNN-<slug>.md` y se declara fuente única. El `SKILL.md` de `wa-spec` dice `specs/SPEC-NNN-<slug>.md`; el de `wa-dev` dice `docs/specs/`. Dos contra uno, y el que discrepa es precisamente el que la regla canónica dice que no debe redefinir patrones.

**Decisión:** `docs/specs/`. Alternativa descartada: `specs/` en la raíz.

## 2 · El número de spec

`wa-spec` lo calcula como «el mayor existente + 1», que sirve para una invocación pero no para un bucle que puede reordenar filas al saltarse una bloqueada. `naming.md` dice que lo asigna quien orquesta, por orden del checklist.

**Decisión:** `SPEC-NNN` = número de fila del checklist, con tres dígitos. La fila 3 es `SPEC-003` pase lo que pase con la 2. Así el checklist y `docs/specs/` se leen en paralelo sin traducir nada.

## 3 · La sección de responsive

`references/spec-instructions.md` exige `### Comportamiento responsive` en tres breakpoints. El `SKILL.md` de `wa-spec` lo prohíbe explícitamente: «Nada de comportamiento responsive: esto es una app de móvil y la pantalla es la que es». Las instrucciones vienen del pipeline web original; el SKILL está adaptado a este proyecto.

**Decisión:** manda el SKILL. Las specs con interfaz llevan `### Wireframe textual`, `### Pantallas y elementos utilizados`, `### data-testid` y `### Patrón de interacción`, sin responsive.

## 4 · Maestro no está instalado

`maestro --version` → `command not found`. Las pruebas de nivel `@app` no se pueden ejecutar en esta máquina.

**Decisión:** no se para el bucle (lo dice el encargo). Las pruebas `@app` se **escriben** igual, se registran en el mapa y el report las marca como infraestructura ausente, nunca como verde. Toda spec cuya verificación dependa solo de `@app` se cierra declarando explícitamente que su verificación quedó pendiente.

## 5 · Quién ejecuta cada rol

Las cuatro skills tienen fronteras duras entre sí (`wa-dev` no toca `test/**`, `wa-qa-dev` no toca el código). Esa separación solo es real si cada rol corre en un contexto propio.

**Decisión:** cada invocación de `wa-spec`, `wa-dev`, `wa-qa-dev` y `wa-qa-tester` se ejecuta como subagente con su propio contexto, cargando la skill del repo. El orquestador no escribe código ni pruebas: lee, juzga, mergea y registra.

## 6b · El escalado de SPEC-002-iter-1: los recuentos de `costero#2`

`wa-dev` escaló en lugar de ajustar un extracto, que es lo que la iteración le mandaba hacer. El hecho: al cerrar los dos defectos, `costero#2` pasa de `{7 núcleos, 12 servicios, 5 parajes, 10 calzadas}` a `{7, 11, 3, 9}`, y la iteración exigía que los recuentos por tipo cuadrasen.

Lo que el dev demostró, y es lo que decide: **no lo mueve la ordenación**. Aplicando solo el cambio de orden, los ocho extractos salen byte a byte idénticos a los commiteados — el orden natural de los fixtures ya coincidía con la clave estable. Lo mueve el arreglo de los nombres duplicados: quitar el duplicado obliga a un sorteo más en la cadena de azar de la fase de núcleos, y ese sorteo desplaza todo lo que viene después.

Así que la iteración se contradecía: pedía que `Casal da Colmea` dejara de repetirse en `costero#2` y a la vez que los recuentos no cambiaran. No caben las dos.

**Decisión: se aceptan los recuentos nuevos.** La unicidad de nombres es un requisito de diseño con escenario en la batería («No hay dos nombres iguales en un mundo»); los extractos de referencia son un instrumento de verificación del porte, no un contrato de contenido. Un extracto no puede vetar un arreglo de determinismo.

**Y una observación que no entierro:** los parajes de `costero#2` bajan de 5 a 3. No es una regresión que corregir aquí — cualquier cambio en el consumo de azar recoloca el mundo entero —, pero es exactamente la clase de accidente que la fila 6 (`parajes-cobertura-escenas`) existe para impedir, haciendo que el suelo de parajes salga del catálogo y no de lo que sobre. Queda como evidencia medida a favor de esa fila.

## 6c · El tercer rojo de SPEC-002: reatribuido, no ablandado

«El mundo mínimo todavía compone un lazo» falla porque en el mundo de 250 m no nace ningún paraje. **Es defecto de prueba respecto a SPEC-002**, que excluye por escrito cupos y cobertura de escenas: la prueba afirma algo que su spec no promete. Se reatribuye a SPEC-006 y se deja declarada como pendiente de esa fila. No se ha tocado su redacción ni su exigencia.

## 6d · El mundo mínimo no es jugable hoy, y está medido

El hallazgo más importante de la noche, y no lo entierro. Al probar SPEC-003 con el tramo en el suelo (250 m), las celdas de `barrio-tres-calles` y `suelo-250m` **no castean ni una sola plantilla con lazo cerrado**. La causa está localizada: `parajeCountForRadius` da 1 paraje con el radio inscrito del tramo suelo y 2 a 500 m, cuando el cociente del catálogo vivo pide 3 (4 según `parajes.md`, que divide entre dos). O sea, **el suelo de parajes derivado del catálogo no está implementado**: hoy el cupo sale de una tabla por radio, que es el techo por ritmo, no el suelo.

Eso es exactamente RF-MUNDO-007, que el checklist asigna a las **filas 4 y 6**, no a la 3. La spec de SPEC-003 llegó a tener un AC que lo afirmaba — culpa del encargo con que se pidió, que quería evitar clavar el número del pendiente de diseño y acabó afirmando una propiedad que la entrega el vecino de dos filas más allá.

**Decisión: es defecto de alcance de la prueba, no de código de SPEC-003.** Los dos casos se reatribuyen a SPEC-006, con el mismo criterio que ya se aplicó a «El mundo mínimo todavía compone un lazo» en SPEC-002 (§6c). No se ablandan ni se marcan como pendientes: siguen sin prueba viva y el hueco se ve.

**Lo que esto significa para quien lea esto mañana:** el escenario «El mundo mínimo todavía compone un lazo» lleva dos filas seguidas sin poder cerrarse, y las dos veces por la misma razón. No es mala suerte: es que el suelo derivado del catálogo es una pieza real que aún no existe, y hasta que las filas 4 y 6 la entreguen, **el barrio de tres calles no tiene juego**. Es el eje de variación 2.3 del PRD entero fallando en su extremo pobre.

## 6 · El script que la skill de QA da por hecho

`wa-qa-tester` ejecuta `scripts/qa-tester-run.sh`, que no existe en el repo. No es un olvido: es exactamente lo que pide la fila 1 del checklist (`andamiaje-pruebas`, RF-INFRA-007).

**Decisión:** el script lo entrega SPEC-001 como código de producción. Hasta que exista, no hay nada que ejecutar.

## 6e · El tope del 25 %, medido sobre la entrada y no sobre la salida

`wa-qa-dev` señaló una ambigüedad real del criterio «ninguna etiqueta aporta más del 25 % de los candidatos que se le ofrecen». La implementación limita la **cuenta** a `floor(n · 0,25)` sobre el conjunto que entra; medido sobre el conjunto que **sale**, la etiqueta dominante queda en 33-36 %.

**Decisión: se acepta la lectura por el conjunto de entrada.** La otra es insatisfacible cuando un solo `kind` domina el pool —no hay reparto posible que baje del 25 % si el 60 % de lo disponible es restaurante— y el criterio de `parajes.md` no es un porcentaje, es «ningún tag masivo monopoliza un tipo de paraje». Ese fin se cumple y está medido: 769 locales de adultos fuera, `drinking_water` fuera, `amenity=fountain` dentro, y la casteabilidad **sube** de 21/48 a 24/48 con `costero` recuperando sus cinco parajes.

No merece iteración. Queda anotado aquí y en la nota de esa entrada del mapa de cobertura, para que quien afine los números en `parajes.md` sepa qué se midió.

## 6f · La contradicción del radio urbano, entre SPEC-006 y SPEC-005

`wa-qa-dev` señaló que un AC de SPEC-006 pide que «un anclaje dentro del radio urbano queda descartado», y eso choca con una decisión ya cerrada y medida de SPEC-005: `outsideTowns` **penaliza sin excluir**, porque como filtro duro vaciaba el pool en celdas urbanas pequeñas.

**Decisión: manda SPEC-005.** Es la posterior, está medida y su alternativa está descartada con número delante. El AC de SPEC-006 queda como redacción heredada del prototipo y **hay que corregirlo en la spec, no en el código**. No se ha escrito prueba que lo afirme; queda anotado en el mapa de cobertura.

## 6g · El mundo mínimo, cerrado

Lo que §6d dejaba abierto ya está hecho. Con SPEC-006, `barrio-tres-calles` castea 1/6 con las dos semillas y `suelo-250m` castea 2/6 con las dos, **con lazo cerrado**. Venían de cero.

La casteabilidad agregada sobre los ocho extractos: **21/48 antes de la fila 5 → 17/48 con la primera entrega de SPEC-005 (regresión, corregida por iteración) → 24/48 → 30/48 con SPEC-006.**

El escenario **«El mundo mínimo todavía compone un lazo»**, que llevaba tres filas seguidas sin poder cerrarse y se reatribuyó dos veces (§6c y §6d), **está vivo y en verde**.

## 6h · La degradación silenciosa del grafo, y por qué el mismo bug salió tres veces

`buildRoutes` y `pegarAViario` aceptaban en el mismo parámetro **una lista de vías o un grafo**. Pasarles `geo.roads` donde tocaba el grafo cosido no fallaba: degradaba en silencio y el mundo salía con un grafo pobre sin que nada se pusiera rojo.

Esa firma permisiva es la causa de que el mismo cableado a medias apareciera **tres veces**: el `fetchData` de la app (el callejero no llegaba al grafo, así que SPEC-007 era código muerto), el helper `mundo-de-prueba.mjs` y el helper `celda-de-prueba.mjs`. Las tres veces el efecto fue idéntico: algo que parecía cubierto sin estarlo. La tercera destapó además una **regresión real** — `crossingCandidates` definía cruce como «punto compartido por 2+ calzadas», que solo funciona con un grafo pobre; con el callejero dentro, `suelo-250m` perdía su único paraje y el mundo mínimo dejaba de castear otra vez.

Es la misma forma de fallo que los dos defectos de SPEC-001 y que el `parajes.js` sin vocabulario de SPEC-006. **Cuatro veces la misma cosa**: una pieza que, al no estar, no protesta.

**Decisión: se cierra por contrato, no por vigilancia.** `exigeGrafo` falla nombrando lo que llegó, el parámetro pasa a llamarse `grafoViario`, y `viasDelGrafo` se exporta para que nadie tenga que reconstruir la tubería a mano. Es el mismo criterio que la propia SPEC-007 aplica a la marca de suposición: obligatoria, y su ausencia error de construcción, porque con un campo opcional «perderla» y «no haberla tenido nunca» son indistinguibles.

Efecto medido del arreglo completo: casteabilidad **30/48 → 32/48**, `suelo-250m` de 2/6 a **3/6**, `barrio-tres-calles` de 4 a 6 parajes.

## 6i · Los cuatro lazos que no se entregan, y los bordillos que no se verifican

Dos límites que SPEC-008 deja abiertos y que **no se han disimulado**:

**a · 4 de 16 lazos no se pueden entregar** con los cuatro criterios del filtro, porque un tramo difícil **no tiene nombre** en el grafo (costero 3/6, urbano-denso 1/6). Eso es exactamente lo que la spec exige —un tramo difícil sin nombre hace fallar la entrega en lugar de declarar un camino anónimo en silencio— y su hueco 5 lo anota. **La solución real es nombrar todo tramo difícil al generar, y es de SPEC-007.** Queda como deuda con dueño: cuando se haga, el caso que hoy afirma el fallo se pondrá rojo y habrá que actualizarlo. Es la única regresión esperada del repo.

**b · El criterio de bordillos queda al 100 % en «no se sabe» sobre dato real.** Los cuatro fixtures se capturaron pidiendo solo ways, así que no traen ni un nodo de bordillo. El criterio está probado con datos sintéticos y **no verificado contra OSM**. `wa-dev` cambió la consulta para pedirlos, así que una recaptura los traería —pero recapturar mueve la línea base de ocho extractos y de media suite, y eso no se hace al final de un bloque. Hay un caso que **se pondrá rojo el día que alguien recapture**, para que el límite no se olvide.

## 6j · B1 cerrado

Las ocho filas en `done`. La suite pasa de 0 a **441 casos, 438 en verde, 0 rojos, 3 saltados**.

Trayectoria de la casteabilidad agregada sobre los ocho extractos, que es la medida de salud del generador: **21/48 al empezar → 17/48 (regresión de SPEC-005, corregida por iteración) → 24/48 → 30/48 (SPEC-006) → 32/48 (SPEC-007)**. SPEC-008 no la mueve.

## 6k · Un lazo contra 367 KB: se acepta 31/48

`wa-dev` escaló porque la iteración de SPEC-009 exigía que la casteabilidad no bajara de **32/48** y la cuantización la deja en **31/48**. El dato que no existía cuando se escribió ese criterio:

- Cuantizando **solo coordenadas**: 32/48, pero `urbano-denso` pesa **2326,5 KB** y **no cabe** en el presupuesto de 2048.
- Cuantizando **coordenadas y longitudes**: **31/48**, y pesa **1959,1 KB**, con margen.

La pérdida es concreta y pequeña: `suelo-250m#1` baja de 3/6 a 2/6 porque un candidato a cruce queda a 139,8 m del elegido y la separación mínima son 150. **El mundo mínimo sigue casteando** —dos plantillas con lazo cerrado—, que es lo que la fila 6 vino a garantizar.

**Decisión: se acepta 31/48 y se rebaja el criterio a ≥ 31/48.** El presupuesto de tamaño es una restricción dura de diseño —el mundo congelado vive en un móvil y una salida entera se juega sin red— y no se negocia contra un lazo en el mundo sintético más pobre. Escribí «no baja de 32» sin conocer el precio; conociéndolo, la elección es esta.

**Queda una tercera vía sin explorar, y la anoto para no perderla:** las longitudes de arista son geometría pura y determinista a partir de las coordenadas, así que **podrían recomputarse al levantar en lugar de guardarse**. Eso daría el tamaño sin cuantizarlas y quizá devolvería el 32. No se ha hecho aquí porque toca el esquema, que la iteración declaró fuera de alcance, y porque recomputar entra en tensión con «lo cosido se congela, no se recalcula». Merece medirse antes de dar el 31 por definitivo.

## 6l · La cuantización destapó una guarda mal escrita

Efecto colateral que `wa-dev` encontró y arregló: `construyeGrafo` descartaba **la arista de longitud cero**, y con la rejilla del metro eso empezó a partir vías reales que el cosido volvía a unir **como suposición nuestra** (urbano-denso: −71 aristas, cosidas 19 → 62). O sea, el mapa se llenaba de tramos marcados «nos lo hemos inventado» que eran calle de verdad.

La guarda quería decir «descarta el lazo sobre sí mismo» y decía otra cosa. Corregido, vuelve a 14.734 aristas y 19 cosidas. Es la clase de error que solo aparece cuando cambias la escala del dato.

## 6m · La casteabilidad baja a 30/48 y el criterio se rebaja, porque ahora no miente

SPEC-010 mide las distancias **sobre el grafo cosido y filtrado** en lugar de en línea recta con un factor de rodeo, que es lo que la spec pide y lo que un jugador anda de verdad. Efecto: **31/48 → 30/48**.

El lazo perdido es `barrio-tres-calles#2 · ronda-del-vigía`, y su ficha lo explica sola: el único pueblo de ese mundo está a **1688 m de grafo** del centro, aunque en línea recta sean **126 m** — un callejero casi en árbol. Con ida y vuelta son 3376 m, que tampoco caben en los 4000 m de un paseo.

**Decisión: se acepta 30/48 y el criterio pasa a ≥ 30.** No es una regresión: antes ese lazo se ofrecía porque la medida mentía. Una casteabilidad más baja y honesta vale más que una más alta que manda al jugador a andar trece veces lo que le dijo. El indicador solo sirve si mide lo mismo que el juego.

Trayectoria completa, para leerla entera: **21/48 → 17/48 (regresión, corregida) → 24/48 → 30/48 → 32/48 → 31/48 (cuantización, §6k) → 30/48 (medida sobre el grafo)**. Los dos últimos descensos son precio pagado a cambio de que el mundo quepa en un móvil y de que la distancia no mienta.

## 6n · Cuarta aparición de §6h, y esta se estaba mirando todos los días

`test/casting-report.mjs` —el informe de salud del generador, una de las cuatro cosas que este proyecto sí mide— **nunca pedía el callejero** para los mundos reales. Sin él daba **113/132 y 9/24 en los mundos reales**; con él, **127/132**.

O sea: el instrumento con el que se juzga la salud del generador llevaba desde SPEC-007 midiendo un mundo que no es el que juega nadie, y nadie se enteró porque el número que daba era plausible. Es la cuarta aparición de la misma forma de fallo, y la más incómoda, porque las otras tres las cazó una prueba y esta la cazó alguien mirando de reojo.

**Lección que anoto para el informe final:** los instrumentos de medida necesitan las mismas garantías que el código que miden. Un informe que se alimenta a mano de la tubería es un cableado a medias esperando su turno.

## 6o · Quinta aparición: un requisito cumplido de forma vacía

SPEC-013 componía su par de núcleos —los ocho extractos lo conseguían al primer intento— pero **ninguna candidata pasaba por él**: el par salía casi siempre en granjas y aldeas sin beats. RF-QUEST-014 quedaba satisfecho **de forma vacía**, y el arranque que `arranque.md` §2 diseñó no ocurría nunca.

Es la quinta aparición de la familia de §6h, con una vuelta de tuerca: aquí no faltaba un cableado, faltaba **exigencia**. La cláusula decía «existe un recorrido que pasa por los dos y cabe», que es cierto casi siempre y no garantiza nada.

**Corregido**: la cláusula exige ahora **una aventura del reparto con un beat en cada núcleo del par**, resuelto contra el reparto real y no por tipo de núcleo —dos granjas pasarían un filtro por tipo y nunca comparten aventura, porque el catálogo tiene un solo rol de granja. Medido tras el arreglo: `costero`, `urbano-denso` y `suelo-250m` componen con candidata que pasa por los dos en sus dos semillas; `barrio-tres-calles` no compone y degrada abriendo, en silencio, que es lo que la spec quiere para un mundo de un solo núcleo.

**Lección, que es distinta de la de §6h:** un criterio que se cumple casi siempre no es un criterio. Cuando un AC no puede ponerse rojo con un mundo real, no está midiendo nada.

## 6p · Un AC de SPEC-014 contra RF-NPC-002: manda el requisito

La spec pedía que un núcleo **sin anclaje real** hiciera fallar la creación de la cara. `wa-dev` midió que eso es incompatible con el mundo pequeño: **los cinco núcleos de `barrio-tres-calles` y tres de los cinco de `suelo-250m` se colocan por geometría**, sin anclaje. Aplicar el AC dejaría al mundo mínimo **sin una sola cara**, y con ello un rol humano allí sería excepción — o sea, **el casting fallando por gente**, que es exactamente lo que RF-NPC-002 prohíbe.

**Decisión: manda el requisito.** La cara se ancla al sitio, `anclaje: null` queda declarado, y la capa expone `sitiosSinAnclajeReal()` para que nadie lo confunda con un olvido. En un **servicio** sí falla, porque ahí el anclaje es constitutivo. El AC de la spec queda corregido de hecho y anotado aquí.

Nota de método: es la primera vez en toda la ejecución que un AC choca de frente con un RF, y se resuelve como manda `CLAUDE.md` — el diseño por encima de la spec, y la spec por encima del código.

## 6q · El presupuesto por hecho: se sube para un tipo, y se dice por qué

«Un hecho del registro ocupa menos de 300 bytes» falla para **un solo tipo**: `version-oida`, medido en **444-471 B** según el ejemplo. Los otros once caben en 90-140 B.

El motivo no es descuido: `version-oida` **lleva dentro los hechos estructurados enteros**, y esa fue una decisión declarada de la propia spec — sin ellos «lo oído» no se puede reconstruir sin reproducir la propagación con reglas que pueden haber cambiado. O sea, el tamaño es consecuencia directa de lo que hace que la reconstrucción funcione.

Y los presupuestos que de verdad deciden si esto cabe en un móvil **se cumplen con margen**: entrada 450-470 B (< 500), registro de mil días × 20 en **2,45 MB** (< 6) y estado en **0,75 MB** (< 2).

**Decisión: el tope por hecho pasa a 500 B, y `version-oida` queda declarado como el tipo caro.** Los agregados no se tocan: son los que valen. `wa-dev` hizo bien en no forzarlo abreviando nombres de campo — habría cambiado un número sin cambiar nada real.

**Desviación de procedimiento que declaro:** la spec pedía ajustar este número «por iteración con el dato delante», y lo estoy resolviendo como veredicto. Lo hago porque es un solo umbral, no cambia comportamiento y los agregados pasan; pero queda escrito que el camino formal era una iteración, para que nadie lea esto como que los umbrales se mueven a conveniencia.

## 6r · El entregable de B2, verificado a mano, y lo que destapó

El PRD promete para B2 «simulación completa de partida en Node: pasos, rumores, rangos y diario, determinista». Con las ocho filas en verde y 1036 casos pasando, monté esa simulación de punta a punta fuera del repo. **La entrega existe** —mundo, prólogo con par avalado, salidas casteadas, pasos, rumores llegando con su nivel, rango, oro, objetos, motes, diario y determinismo entre procesos— pero salieron **cuatro defectos que 1036 pruebas unitarias no veían**:

**a · Congelar la partida se rompe en su camino feliz.** `cierraSalidaDeProgresion` construye `procedencia` como objeto y `AREA_OBJETOS` la declara `texto?`: basta con que un desenlace entregue un objeto sin procedencia explícita para que **la partida no se pueda guardar**. Las pruebas no lo veían porque llaman a `congelaObjetos` directamente y **se saltan el sobre**.

**b · `dia` tiene dos contratos incompatibles** en el mismo bloque: `objetoPersistente` exige texto, `entradaDeDiario` exige entero ≥ 0.

**c · El prólogo infla el rango antes de jugar.** Sus sucesos llegan a todos y `rangoEn` cuenta rumores sin mirar protagonista, así que **los diez núcleos amanecen en nombradía o pertenencia el día 1**, con la jugadora sin haber hecho nada. Choca con `progresion.md`. SPEC-014 ya había cerrado `PROTAGONISTAS` para que el prólogo no disparase el hito; al rango le faltaba la misma cautela.

**d · Bytes NUL dentro de literales de plantilla** en `partida/rumores.js` y `partida/puestos.js`: `file` y `grep` los tratan como binarios.

**La lección, y es la más cara de la ejecución:** una suite verde de mil casos **no es una demostración de que el producto funciona**. Los cuatro defectos viven en las costuras entre filas, y cada fila probaba su lado. El entregable por bloque del PRD no es ceremonia: es el único momento en que alguien recorre el camino entero.

Lo que **no** son defectos y quedan como frontera correcta: no hay motor de salida (aceptar, recorrer y cerrar es de las filas 34 y 36, B5), no hay textos (B3 sin empezar) y la cola de entregas se siembra pero no la consume nadie (fila 19).

## 6s · B3 arranca y destapa la deuda de §6i-a agrandada

SPEC-017 sube el catálogo de 6 a **30 plantillas**. Efectos medidos, todos esperados:

- **El vocabulario de escenas pasa de 7 a 10**, y con él el **suelo de parajes de 4 a 5**: `barrio-tres-calles` gana un paraje. Es exactamente la relación que SPEC-006 diseñó — ensanchar el catálogo sube el suelo solo.
- **Casteabilidad 30/48 → 172/240 (71,7 %)**; informe **585/600**.
- **El suelo de diez esqueletos por oficio de `personaje.md` §3 no se cumple en `barrio-tres-calles`**: 3-5 por oficio, porque ese mundo **no tiene ni un servicio** y 20 de las 30 plantillas piden uno. Es hueco de diseño, no de código, y queda declarado.

Y destapa lo que ya estaba escrito como deuda en §6i-a: **un tramo difícil sin nombre hace lanzar `repartoDeAventuras`**. Con 6 plantillas se topaba poco; con 30 se topa constantemente, y tumba incluso «El mundo mínimo todavía compone un lazo». Deja de ser deuda tolerable: **una excepción es peor respuesta que una ruta declarada**, y contradice el principio de SPEC-008 —evitar y declarar, nunca romper.

**Decisiones:**

1. **Se arregla la deuda ahora**, nombrando todo tramo difícil al generar, que es lo que §6i-a dejó con dueño en SPEC-007.
2. **Se regeneran los extractos de referencia.** Eran la instantánea del prototipo de seis plantillas; con treinta, esa línea base ya no describe el juego. El instrumento se actualiza cuando lo que mide cambia — como en §6b.

## 6t · B4 cerrado, y lo que no se ha podido verificar

Las siete filas de B4 en verde, **1645 casos**. Tres cosas que quedan dichas y no disimuladas:

**a · Nada se ha ejecutado en un dispositivo.** Maestro 2.8.0 está instalado, pero **no hay simulador**: `xcode-select -p` da `/Library/Developer/CommandLineTools`, `xcrun simctl` no existe, y no hay SDK de Android. Hay **tres flujos escritos** en `test/app/` y ninguno se ha ejecutado. El runner lo registra como infraestructura ausente y nunca como verde, que era el punto.

**b · El minuto está medido, pero no donde la spec dice.** `urbano-denso` levanta en **3222 ms** (consulta 1723, generación 1318, congelación 180, colocación 1) sobre 60 000 de presupuesto — pero **en Node contra el Overpass del proyecto, no en el dispositivo de referencia**, que la spec exige declarar y **no está declarado en ningún sitio del repo**. Lo que sí está verificado es el **instrumento**: con cronómetro doblado la comprobación se pone roja nombrando coordenada y fase. El pintado sale 0 ms en Node porque Skia solo mide en dispositivo, y eso está afirmado para que ese cero no se lea como «el pintado es gratis».

**c · Un AC de SPEC-026 está mal escrito y no puede cumplirse.** Dice que «dos jugadoras con tramos distintos y la misma semilla generan el mismo mundo», y es falso por construcción: el lado de celda son dos tramos (`alcance-del-mundo.md` §2), así que 400 m da celda de 800 y 1200 m da 2400, con otro mundo dentro — medido, 7 núcleos frente a 10. Lo que sí se sostiene, y es lo que se prueba, es que **un mapa ya levantado no se redimensiona al recalibrar**. El AC hay que corregirlo en la spec.

**Y la sexta y séptima aparición de §6h**, las dos cazadas por pruebas: `scripts/overpass-medir.mjs` sin guardián de ejecución directa —lo que SPEC-001-iter-1 exige a todo script ejecutable—, y la medida en caliente sin cablear: el cronómetro distinguía caché fría de caliente y nadie se lo decía.

## 6u · El criterio duro roto sin que nadie se enterara

`node --test test/nucleo/` **había dejado de arrancar entero sin `node_modules`**: 1872 pruebas en vez de 1939, **5 ficheros sin cargar y 67 casos que ni se descubrían**. La causa eran dos módulos de `app/` que citaban el paquete por su nombre y que las pruebas alcanzaban de forma transitiva.

Llevaba roto **desde antes de la fila 30** y nadie se enteró: el guardián de SPEC-001 solo mira los imports **directos** de `test/nucleo/` y `test/dobles/`, no el cierre transitivo. Otra vez §6h.

Y había un choque real de criterios: SPEC-020 exige arrancar sin instalar nada, y `paquete.test.mjs` prohíbe que `app/` consuma el generador por ruta relativa.

**Decisión: manda el criterio duro**, y `CLAUDE.md` lo dice con todas las letras — *el día que la red de seguridad del determinismo dependa de un `node_modules`, deja de ser una red*. Los dos criterios dejan de chocar aplicando el patrón que este proyecto usa en todas partes: **inyección**. Los dos módulos de `app/` reciben el núcleo como pieza, `app/nucleo/piezas.js` es el único sitio que lo coge por su nombre, y las pruebas arman el mismo bundle por ruta relativa.

Restaurado: **1939 pruebas y 0 fallos con y sin `node_modules`**, idénticos.

## 6v · El checklist entero en verde, y la partida no se podía terminar

Con las 42 filas en `done` y **2583 casos en verde**, monté la partida completa de punta a punta — arranque, salida, llegadas, telón, segundo mapa, cerrar y abrir, exportar e importar, empezar de nuevo, determinismo. Igual que al cerrar B2 (§6r), y con el mismo resultado: **lo que las pruebas unitarias no ven vive en las costuras**.

**El defecto grande: ninguna aventura se podía terminar.** El último beat de un lazo cae **siempre** en un sitio ya visitado —el lazo es cerrado por diseño, esa es la mitad del juego— y `partida/llegadas.js` lo descartaba **en silencio**: `if (yaValidada(nombre)) continue;`. Medido: **27 de 27, 12 de 12 y 28 de 28** aventuras casteadas de `costero`, `barrio-tres-calles` y `urbano-denso` tienen su último beat en un sitio anterior. **El 100 %.** Consecuencia: toda aventura acababa `a-medias`, con telón de cierre en corto, **0 oro, 0 objetos, sin rumor y sin mote**.

Y cuatro más, todas de cableado:

- **Nadie compone el desenlace.** `echaElTelon` lo exige y no hay función que lo derive de la plantilla y la aventura casteada.
- **La lista de hoy no tiene memoria**: los mismos tres títulos el día 1 y el día 6. `aventurasCerradas()` está exportada y **no la consume nadie**.
- **El propagador de rumores no está cableado en la partida**: solo se registra dentro del prólogo. Medido: con él, rango `{forastería 7, pertenencia 3}` y 17 entradas de diario; sin él, `{9, 1}` y 13. La noticia de la jugadora no salía del pueblo.
- **B5 no tiene orquestación en `app/`**: existen todas las piezas y no hay máquina de estados que las encadene.

**La lección, y es la misma que §6r a mayor escala:** una suite verde no demuestra que el producto funcione. Cada fila probaba su lado con diligencia; nadie recorría el camino entero hasta que alguien lo recorrió.

## 6w · Trece flujos verdes que no recorren nada, y el cronómetro que los delata

Con el emulador montado —`wa-pixel`, API 35, la app instalada, Metro con `EXPO_PUBLIC_PROXY=http://10.0.2.2:8138` y el proxy ciego detrás— los dieciséis flujos de `@app` se ejecutan por primera vez en la vida del proyecto. El runner canta **16 ejecutados, 13 pasan, 3 fallan**, y ese número es falso como afirmación sobre la app.

Lo delata el reloj: **los trece que pasan tardan 9-10 s y los tres que fallan tardan 70 s.** Un flujo que recorre pantallas de verdad tarda más de un minuto; diez segundos son `launchApp` y dos afirmaciones. Los trece verdes son la rama de guarda que se les añadió —`runFlow: when: notVisible: <su pantalla>`—, que comprueba que la app abrió en el arranque y que su pantalla **no está a la vista**. Es honesto lo que dicen, y está escrito con todas las letras en cada fichero; lo que no es honesto es **sumarlo en la misma casilla que un verde de verdad**.

Es §6h otra vez, y en el sitio más caro: la pieza que al no estar no protesta es ahora *la pantalla entera*. La causa de fondo es real y ya estaba declarada en el informe final —**B5 no tiene orquestación en `app/`**, y desde SPEC-027 la app abre en el arranque, así que al andamiaje y a su tira de pasos provisionales ya no se llega—; el defecto no es que las pantallas falten, es que **su ausencia sale verde**.

**Decisión:**

1. **Un verde de límite declarado no se cuenta con los demás.** El runner gana un cuarto estado para `@app` —`ejecutados · pasan · fallan · solo comprueban su límite`— y los flujos de límite se declaran a sí mismos con un marcador en cabecera. Contrato, no vigilancia: una prueba de `@nucleo` fija **la lista exacta** de flujos marcados, así que marcar uno nuevo es un acto deliberado y visible, y desmarcarlo el día que haya camino también.
2. **Los tres rojos son de espera, no de lógica, y se arreglan como tal.** Los tres mueren en la misma línea —`assertVisible: 'Lo que se cuenta hoy'`, A1P7— justo después de pulsar `arranque-seguir` en A1P6. Componer la primera lista tarda **11 s medidos** y la espera por defecto de Maestro son 5: es `extendedWaitUntil`, el mismo que el flujo ya usa dos líneas antes para `mapa-lamina`. **Que tarde once segundos queda declarado**: ninguna spec le pone presupuesto —el minuto de RNF-PER-001 es el del levantamiento— y once segundos mirando una pantalla quieta no es un detalle de test, es una decisión de producto pendiente.
3. **El número que se publica es el medido, no el del runner viejo.** El informe final decía «ni un flujo `@app` se ha ejecutado»; era cierto al escribirlo y hoy no lo es. Se corrige con lo que hay: dieciséis se ejecutan, tres recorren la app, trece comprueban que su pantalla sigue sin existir.

## 6x · No era espera: la app no repinta, y por eso no se puede pasar de A1P6

El punto 2 de §6w está mal y lo corrijo aquí en vez de dejarlo puesto. Escribí que los tres rojos eran «de espera, no de lógica» y que se arreglaban con `extendedWaitUntil`; lo escribí **repitiendo los once segundos que me contó quien implementó la fila, sin medirlos yo**. Con la espera subida a sesenta segundos siguen rojos, y tardan **1m 52s**. No era espera.

Lo que pasa, reproducido cuatro veces sobre el emulador y sin ninguna interpretación de por medio:

1. El flujo llega a A1P6 —«TU MAPA»— y **la lámina se pinta entera y bien**: Reinos da Lúa Rota, la costa, las calzadas, once rótulos sobre placa. El pintado en Skia funciona en el dispositivo, y eso es lo primero que hay que decir porque es la fila entera de B4 dando la cara.
2. Se pulsa `arranque-seguir`. Maestro lo da por hecho, y `adb shell input tap` sobre el centro exacto del nodo también.
3. **La pantalla no cambia.** Ni con Maestro ni a mano, ni a los 5 s ni a los 60. El árbol de accesibilidad sigue trayendo A1P6 entero. No hay excepción en logcat, no hay LogBox, no hay segunda ventana, el proceso está **al 0 % de CPU**: no es un hilo bloqueado ni un error tragado.
4. Basta **forzar un paso de layout sin tocar la pantalla** —`adb shell wm size 1080x2401`, un píxel— para que aparezca A1P7 entera y correcta: «Lo que se cuenta hoy», la lista compuesta, «Salir a andar».

Es decir: **la pulsación sí llega y el estado sí avanza; lo que no ocurre es el repintado.** El árbol nativo se queda con la pantalla anterior hasta que algo externo obliga a un layout. Sin ese empujón, la app **no pasa de A1P6 en ningún caso**, que es lo mismo que decir que hoy el juego no se puede jugar en el dispositivo.

**Consecuencias, y esta es la parte que importa del veredicto:**

- El número honesto de `@app` no es «13 pasan» ni «3 pasan»: es **0 pantallas verificadas de 16 flujos ejecutados**. Trece comprueban que su pantalla no existe todavía y tres mueren en la primera pantalla de verdad que intentan pasar.
- Va a **wa-dev como defecto de código**, no a wa-qa-dev como prueba floja. Cambiar la prueba aquí sería exactamente lo que el encargo prohíbe.
- Y queda dicho lo que esto le hace al informe final: la app **arranca, levanta el mundo, congela el documento y lo pinta**, y ahí se para. Todo lo que hay detrás del mapa —la portada, la salida, las llegadas, el telón, el diario— está probado en Node y **no se ha visto funcionar en un teléfono ni una vez**.

### 6x-bis · La causa era LogBox, no un fallo de repintado — y detrás había una segunda pantalla que no cabe

Corrijo el mecanismo que di en §6x. Yo describí bien lo observado —la pulsación no hacía nada y un `wm size` de un píxel destapaba A1P7— pero **la explicación que puse encima («la app no repinta») era mía y era falsa**. Lo medido por quien implementó: al pintar la lámina, Skia imprimía **seis avisos de obsolescencia** (`addRect`, `moveTo`, `lineTo`, `addCircle`, `addRRect`, `close`) desde `app/render/skia.js`, y un `console.warn` en compilación de desarrollo levanta el rótulo de **LogBox**, una franja al pie que **no sale en el árbol de accesibilidad** —por eso yo no la veía en el volcado ni en `dumpsys window`— y que caía justo encima de «Seguir»: franja de 2154 a 2274 contra un botón en `[63,2183][210,2246]`. Se comía el toque. El `wm size` no forzaba un repintado: descolocaba la franja.

Es el mismo mecanismo que ya estaba anotado en `app/plataforma/area-segura.jsx` de la vez anterior, y se cierra donde nace: `caminoDe` pasa a `Skia.PathBuilder` y **la app no emite ni un aviso**. Verificado por mí: el arranque ya pasa de A1P6 y A1P7 se pinta entera, con sus cuatro aventuras.

**Y ahí aparece la siguiente, que solo se ve en pantalla:** con cuatro aventuras en la lista, A1P7 **no cabe** —las tarjetas llegan a 2242 de los 2277 útiles— y «Y puedes salir a andar sin coger ninguna» y **«Salir a andar», que es la frontera de registro**, quedan por debajo del borde. La pantalla es un `ScrollView`, así que la persona llega bajando; **quien no llega es la prueba**, que afirma sin desplazarse. Esto sí es defecto de prueba y no de código: va a wa-qa-dev.

La lección se repite con una vuelta más: **cada defecto que el dispositivo destapa esconde al siguiente**. Tres capas hasta ahora —Reanimated que no dejaba arrancar, el área segura, LogBox— y cada una había que quitarla para ver la de debajo. Ninguna era visible desde Node.

## 6y · Se cablea la navegación de verdad, y los pasos provisionales se retiran

Doce de los dieciséis flujos de `@app` llevan `# @limite-declarado` y su verde afirma que su pantalla sigue sin existir. Los doce entran por identificadores de pasos provisionales —`paso-ajustes`, `paso-diario`, `paso-repisa`, `paso-llegada`, `paso-escena`, `paso-marcha`, `paso-mapa`, `pantalla-andamiaje`— que vivían en la pantalla de andamiaje y que desde SPEC-027 son inalcanzables, porque la app abre en el arranque. Había dos maneras de bajar esa columna y no son equivalentes: devolver la tira de pasos a algún sitio alcanzable, o cablear la navegación que declara `docs/flujo.md` y reescribir los flujos para que entren por donde entra una persona.

**Se cablea la navegación.** El motivo es el patrón que más caro salió en toda la ejecución del checklist —§6h, siete apariciones: una pieza que, al no estar, no protesta— y una puerta de servicio que solo abre la prueba es exactamente eso, con el agravante de que aquí la pieza silenciosa sería el camino entero. Doce pantallas verificadas por una puerta que ningún jugador usa dejarían el recuento diciendo la verdad y el producto igual de roto, que es la forma de fallo que este repo ya pagó dos veces.

Y hay un segundo motivo, medido, que quita a (a) hasta la ventaja de ser barata. **Buena parte del cableado ya está escrito y solo le falta la línea que lo conecta.** `componePortada` declara sus puertas y `portada.jsx` las pinta una a una como `puerta-<id>`; `PantallaAntesDeSalir` ya encadena sus cuatro pantallas y ya tiene la arista al zurrón con su condición; `AntesDeSalirMontado` ya acepta `alAbrirPuerta` y `alEcharElTelon`. Lo único que falta en B6 es que `App.js` pase esas funciones, que hoy no pasa ninguna. Devolver la tira de pasos costaría un trabajo parecido y dejaría la deuda puesta.

### El matiz: dos flujos cuya pantalla no es del juego

De los doce, `andamiaje.yaml` y `gancho-capacidad-ausente.yaml` apuntan a `pantalla-andamiaje`, y `mapa.yaml` a `mapa-pantalla`. **Ninguna de las dos está en `docs/flujo.md`, y no puede estarlo:** `verifica-flujo.mjs` saca las pantallas de los seis HTML de diseño, y el andamiaje no es una pantalla de diseño sino la sonda de las cuatro capacidades de plataforma. Cablearlas «por donde entra una persona» no tiene sentido, porque no entra ninguna.

Para esas dos la puerta correcta es una **puerta declarada de desarrollo**, tras `__DEV__`, y hay precedente sin discusión en el propio `App.js`: `paso-revision-render` ya vive así y nadie lo llama deuda. La distinción que gobierna esto, y que conviene dejar escrita porque es la que evita que la excepción se estire: **verificar una pantalla del juego por una puerta que ningún jugador usa es deuda; verificar una herramienta de desarrollo por la puerta de desarrollo es la puerta correcta.** Lo que decide el caso no es la comodidad, es si lo que hay detrás sale en `docs/flujo.md`.

En producción esa puerta no existe, así que la ausencia del andamiaje en la app instalada sigue siendo real.

### Un hueco que aparece al mirar: el ofrecimiento no está en el diseño

Al cruzar los flujos con `docs/flujo.md` sale una tercera cosa, que no es parte del encargo pero se declara porque callarla sería el mismo patrón. **`app/pantallas/ofrecimiento.jsx` existe en el código, lo afirma `mapas.yaml` y no tiene ningún nodo en `docs/flujo.md`.** Entró con los mapas múltiples (fila 41) y es la pantalla que sustituye a la portada cuando estás lejos de todos tus mapas.

El verificador no podía cazarlo: compara el diagrama contra los HTML de diseño, de modo que detecta una pantalla dibujada que falta en el diagrama, pero **no una pantalla que el código tiene y el diseño no**. La comprobación es asimétrica y por ahí se cuela una pantalla entera.

Añadir el nodo al diagrama es un cambio de diseño y se trata como tal: queda propuesto, no hecho por mi cuenta. Lo que sí hago es dejarlo anotado aquí y en `docs/starting.md` para que no dependa de que alguien vuelva a cruzarlo a mano.

### Cómo se reparte

Tres filas nuevas del checklist, por el mismo bucle de cuatro roles que las cuarenta y dos anteriores:

| # | Slug | Qué cierra |
| --- | --- | --- |
| 43 | `navegacion-de-consulta` | las puertas de la portada: diario, repisa, ajustes, empezar de nuevo, y el zurrón entre A2P1 y A2P3 |
| 44 | `navegacion-en-la-calle` | la máquina de una salida: en marcha, llegada, visor, escena, descarte, lo que se cuenta, telón |
| 45 | `puerta-de-desarrollo` | el andamiaje y el mapa suelto tras `__DEV__`, y la retirada de la tira de pasos provisionales |

Un flujo sale de la columna de límite declarado **solo** cuando recorre su pantalla de verdad, y su entrada se quita de `test/nucleo/limite-declarado.test.mjs` en el mismo commit. Un flujo que tarde diez segundos no ha recorrido nada.

## 6z · La partida persistida, y la siembra que no cabe en su fila

Octava aparición de §6h, y la más silenciosa de todas: `congelaEstado` y `levantaEstado` llevaban desde SPEC-016 escritos, probados de arriba abajo y **sin que los llamara nadie**. La máquina entera construida, verificada y sin conectar. Con una fila en `done` encima —la 39, el respaldo—, que funcionaba y no respaldaba nada de lo jugado.

**Decisión: se cierra por contrato dos veces, no por vigilancia.** Arriba, la guarda `partida-persistida.test.mjs`, escrita antes que el cableado y roja a propósito. Abajo, dentro de la propia orquestación: todo lo que escribe pasa por un envoltorio del almacén que **exige que la clave cuelgue de `partida/`**, incluido lo que escribe `guardaPartida`. Una clave de la partida escrita fuera de ese prefijo no entraría ni en la copia exportada ni en el respaldo del sistema, y nadie la echaría de menos — que es exactamente la forma del fallo, un nivel más abajo.

### Lo que la fila destapó al medirse, y no se estiró

**Hoy nada de `app/` altera el estado de la partida después de que el arranque se cierre.** Las cuatro pantallas de consulta solo leen; el único interruptor que escribiría recibe su callback a `null` porque el zurrón no está montado (fila 46); y quien emite hechos espera al módulo de ubicación (fila 48) y a las dos pantallas que nunca se escribieron (fila 49).

Consecuencia: lo que sobrevive y se puede afirmar en un dispositivo es **el personaje, la semilla, los ajustes y el mapa levantado**, y no un diario ni una repisa. Y **la columna de límite declarado no baja: sigue en 9** — el número anterior, 8, estaba mal contado.

La siembra que haría falta para levantar `repisa.yaml` la produce el núcleo sin problema (`partidaCompleta` ya juega días en headless), pero para que llegue al dispositivo hace falta o una puerta que la importe o una vía de desarrollo que la escriba. Las dos son diseño. Y contra la segunda ya hay un argumento escrito en §6y: *verificar una pantalla del juego por una puerta que ningún jugador usa es deuda*. **Queda fichada, no hecha.**

### Un flujo que la fila rompió, y por qué el arreglo es del flujo

`mapas.yaml` declaraba como límite que «la app abre en el arranque». Desde que la partida se guarda eso deja de ser cierto, y con `clearState: false` su guarda afirmaba `arranque` visible y fallaba. Lo que le falta a ese flujo no era nunca la puerta —son dos mapas y el ofrecimiento cableado—, así que lo que se corrige es de qué depende su entrada, con la medida escrita dentro. Es un veredicto de defecto de prueba, tomado con el fallo reproducido tres veces para separarlo de la caída de `adb`.

Y de paso: `diario.yaml` y `repisa.yaml` llevaban desde la fila 43 diciendo que no había puerta hasta sus pantallas, que es falso desde que la portada tiene las suyas. Corregido el motivo sin tocar la guarda — lo que decían seguía siendo verdad; lo que mentía era el porqué.

## 7 · La fila 48, y la undécima aparición de §6h dentro de la propia fila que la buscaba

### 7a · El alcance, recortado por el dueño después de medirlo

El encargo de la fila (`docs/prompt-modulo-de-ubicacion.md`) pedía dos cosas incompatibles: «no estires la fila» y, a la vez, un criterio 4 que exigía **recorrer una llegada de principio a fin**. Eso último pide la máquina de la salida, que el checklist asigna a la **fila 44, `pending`**. El encargo nombraba la 49 y la 46 como fronteras y se olvidaba de la 44.

Se llevó al dueño y decidió **acotar**: la 48 termina cuando en marcha se ve la posición moverse y el detector clasifica, con los tres contratos teniendo llamador de verdad desde `app/`, más el rótulo. El geofence, la llegada, el visor, lo que se cuenta y el descarte **se quedan en la 44**, que sigue entera. **El criterio 4 queda retirado de esta fila.** El motivo es el tamaño: una fila que no se puede verificar de una sentada es la que acaba cerrándose a medias, que es lo que pasó con las filas 34 y 36.

Y autorizó una **segunda dependencia**, `expo-task-manager`, con lo que RF-INFRA-004 —el rótulo del sistema— entra en esta fila en vez de quedarse declarado.

### 7b · Tres afirmaciones del encargo que resultaron falsas al medirlas

1. **«Los dos contratos que lo esperan»: son tres.** Falta `app/plataforma/posiciones.js` —`creaFuenteDePosiciones`, `creaTrazaDeSalida`, `fuenteSinMontar`—, que es quien alimenta al detector de vehículo. Medido con grep: **no lo consumía nadie de `app/`**, solo `test/nucleo/transporte.test.mjs`. Y hay un cuarto de la misma familia, `creaRotulo`, que tampoco tenía llamador aunque `capacidades.js` prometiera por comentario que «sin rótulo una salida no se abre».
2. **«Ni la posición, ni una traza, ni una marca de tiempo llegan a escribirse»: falso.** `congelaSalidas` escribe el punto de partida `{lat, lon}` —«la única posición que la partida guarda»— y **tres** marcas del sensor: `ultimoPropioMs`, `ultimaMarcaMs` y `regreso.dentroDesdeMs`. Todo de SPEC-030, declarado en `formato.js` y necesario. La frase venía de la cabecera de `ubicacion.js`, donde es cierta **acotada a ese módulo**, y se generalizó a promesa de sistema. Importa porque un AC escrito con la frase literal habría nacido rojo por algo que no es un defecto, y el arreglo probable habría sido ablandarlo: **un error del encargo se habría convertido en una prueba más floja.** Lo prohibido es la traza; el punto y las tres marcas están declarados y mueren con la salida.
3. **El rótulo arrastra el cierre de la salida.** `recibePosicion` mide el plazo y cierra por regreso en la misma función, así que cablear el rótulo cablea el cierre, y cerrar deja un telón pendiente cuya pantalla es de la fila 49 — con el agravante de que `abreSalida` lanza si hay un telón sin leer, o sea que la app quedaría encallada. Resuelto con un hueco declarado de una sola acción, el patrón que `llegada.js` ya usa. Es la única costura con la 49 y está declarada.

### 7c · El hallazgo grande: la fila metió trabajo de fondo en iOS y ninguna prueba lo veía

`expo-task-manager` trae un config plugin que **empuja `fetch` a `UIBackgroundModes` sin condición ninguna** (`plugin/build/withTaskManager.js`). `app.json` declara solo `location`, pero el `Info.plist` **generado** salía con `['location', 'fetch']`.

Lo que eso significa lo dice el propio `permisos.js` en el comentario de `MODOS_DE_FONDO`: *«un `processing`, un `fetch` o un `remote-notification` colados ahí son tarea periódica con otro nombre»*. O sea: **la fila cuyo encargo dice que la privacidad pesa más que en ninguna otra metió en el paquete de iOS la capacidad de fondo periódico que `TAREAS_PERIODICAS = []` existe para impedir.** No lo vio ninguna prueba porque todas miraban `app.json` en lugar del artefacto generado.

Arreglado **por lista blanca y no por lista de prohibidos**: el plugin deja en `UIBackgroundModes` solo lo que declara `MODOS_DE_FONDO`, y borra la clave entera si no queda nada. Una lista de prohibidos solo protege de lo que ya se te ocurrió.

**Y la lección de método, que vale más que el arreglo.** Yo había escrito que las cuatro claves de iOS de `LO_QUE_NUNCA_SE_DECLARA` quedaban «**permanentemente** sin verificar en esta máquina», porque no hay Xcode (§6t). Era falso: `npx expo prebuild --platform ios --no-install --skip-dependency-update expo` genera el `Info.plist` **sin Xcode ni CocoaPods**, deja el árbol limpio, y con el fichero delante el defecto apareció en dos minutos. La conclusión que me ahorraba trabajo era también la que me dejaba enviar la fila con un fallo de privacidad dentro. **«No se puede verificar en esta máquina» es una conclusión que hay que mirar dos veces**, y este es el aviso para la próxima vez que alguien la escriba.

### 7d · `RECEIVE_BOOT_COMPLETED`: undécima aparición de §6h, y no es de esta fila

Lo declara **`expo-notifications`** en su propio `AndroidManifest.xml`, desde SPEC-023. Verificado por tres vías: estaba en el APK instalado **antes** de empezar esta fila; está en el manifiesto de la librería; y sigue en el fusionado. `expo-task-manager` no declara ningún permiso y `expo-location` solo COARSE y FINE.

O sea: **la app lleva unas veinticinco filas metiendo en el APK algo que `LO_QUE_NUNCA_SE_DECLARA` dice que no mete nunca**, y la guarda no lo veía porque leía `app.json`. Y no es solo el permiso: el receptor `NotificationsService` escucha `BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON` y `MY_PACKAGE_REPLACED`, o sea que **el sistema despierta a la app al arrancar el móvil**.

**Decisión: no se arregla aquí y no se tolera.** El permiso no se puede retirar —`expo-task-manager` persiste su trabajo con `setPersisted(true)` clavado y sin él la app revienta con `IllegalArgumentException: Requested job cannot be persisted`, medido—, así que se declara con su motivo en `PERMISOS_QUE_UNA_LIBRERIA_EXIGE` y el plugin retira los disparadores de arranque del receptor de tareas. Lo que **no** se hace es que la guarda nueva nazca tolerándolo para que la suite quede limpia: `test/nucleo/manifiesto-generado.test.mjs` **nace roja**, nombrando el permiso, la librería que lo mete y la fila dueña, igual que la fila 47 hizo con `partida-persistida.test.mjs`. Un rojo con dueño vale más que un verde cómodo.

### 7e · Detectar todo, retirar solo lo decidido

La guarda del manifiesto va por **lista blanca** —cualquier permiso o modo de fondo no declarado pone rojo, aunque a nadie se le hubiera ocurrido—, y se aplica a **las dos plataformas**: manifiesto fusionado de Android e `Info.plist` generado de iOS. Cuatro de las siete entradas de `LO_QUE_NUNCA_SE_DECLARA` son claves de iOS, así que una guarda que solo mirase Android vigilaría tres y dejaría cuatro en verde.

**El plugin, en cambio, sigue siendo lista de prohibidos, y la asimetría es deliberada.** El plugin *retira*, y uno que retire lo que no reconoce rompe la app en la siguiente subida de dependencia, en silencio: el APK trae hoy una veintena de permisos de insignia de lanzador que vienen de `expo-notifications`. Detectar todo, retirar solo lo decidido y con su motivo escrito. `UIBackgroundModes` es la excepción y sí va por lista blanca también en el plugin, porque los modos son cuatro y están todos declarados.

Y **la ausencia del artefacto no es verde**: `app/ios/` y `app/android/` están gitignorados y los manifiestos solo existen tras compilar, así que un `skip` o un `if (existe)` haría que la guarda pasara justo cuando no puede mirar. Se registra como infraestructura ausente y sale **en el veredicto del report, arriba**, no enterrada en la sección de infraestructura: `Android: mirado · iOS: NO MIRADO`.

### 7f · Los dos defectos que la fila se dejó puestos, y los encontró la revisión

1. **Con la partida abierta desde disco no se podía abrir ninguna salida.** `cargaPartida` devuelve `congelaHondo(...)`, así que en cualquier sesión que no fuera la del nacimiento el estado llegaba congelado y `abreSalida`, que muta en sitio, moría con un `TypeError` del intérprete enseñado tal cual bajo «Salir a andar». **El momento en marcha solo funcionaba el día que se creaba la partida.** La causa era una asimetría entre las dos vías de entrada de `app/datos/partida-guardada.js`: `nace()` devolvía mutable y `abre()` congelado. Arreglado haciendo que las dos entreguen lo mismo, con el viaje de ida y vuelta del propio núcleo.
2. **Seis marcas del momento en marcha caían apiladas en `[0,0][3,3]`** y Maestro descarta como invisible todo lo que tapa un hermano, así que ninguna se podía afirmar. Es la misma forma que `marca.js` ya arregló una vez pasando de 0×0 a 1×1, reaparecida por apilamiento.

Los dos son de la familia de §6r y §6v: **cada lado probado y nadie recorriendo el camino entero.** El primero solo aparece al abrir la app un segundo día, que es algo que ninguna prueba unitaria hace.

## §8 · Lo que la fila 48 dijo al cerrarse, y que no estaba en ninguna parte

Antes de cerrar la sesión de la 48 se le hizo una única pregunta: **¿queda algo en tu cabeza que no esté en el repo?** Contestó cuatro cosas, un callejón sin salida y una trampa del runner. **Las he verificado yo contra la fuente** antes de escribirlas aquí, y una resultó ser peor de lo que ella la contaba. Queda anotado porque esto es exactamente lo que se pierde al cerrar una sesión sin preguntar, y lo que nadie echa de menos después porque nadie sabe que existió.

**a · `descongelada` no lo afirma ninguna prueba, y es una red que al saltar no protesta.** Verificado: la palabra aparece **solo** dentro de `app/marcha/salida.js`, ni una vez en `test/`. Su propio comentario dice que si sale `true`, **lo que se abra no está en la partida que se congela**: la salida se vería en pantalla y se perdería al guardar. Es §6h con el signo cambiado —no una pieza que al faltar no protesta, sino una red que al dispararse no protesta—, y la puso la propia fila 48 al arreglar el estado congelado. **Que una prueba exija `descongelada === false` en el camino normal**: es una línea, y sin ella el día que alguien reintroduzca un camino que entrega el área congelada la app funcionará y las partidas perderán salidas sin un solo rojo.

**b · `sitio` va siempre a `null` por construcción** (`app/marcha/seguidor.js:125`, con su comentario). El contrato del seguidor promete `{clasificacion, x, y, sitio}` y el cuarto campo es estructuralmente nulo hasta que la fila 44 lo rellene. Está declarado, que es mejor que nada, pero **nada se pone rojo el día que la 44 aterrice y se olvide**: el mapa pintaría la marca sin sitio y nadie lo echaría de menos. Es la misma forma que el `anclaje: null` de §6p, que se cerró exponiendo `sitiosSinAnclajeReal()`. Aquí no hay equivalente, y la 44 tiene que traerlo.

**c · La costura entre la 48 y la 44: el reloj de permanencia contra el hueco del segundo plano.** `regreso.js:126` hace `dentroDesdeMs = dentro ? (previa.dentroDesdeMs ?? tMs) : null`, o sea que **el reloj se reinicia entero en cuanto llega una posición fuera del radio**; y la 48 decidió que al volver del segundo plano se vuelve a anclar en vez de coser el hueco. Juntas: alguien parado dentro de un geofence, la app pasa a segundo plano, vuelve, y la primera posición cae un metro fuera por ruido del GPS → permanencia a cero.

**Y aquí la corrección, que empeora el caso**: hay **dos** constantes con el mismo nombre y distinto valor —`PERMANENCIA_S = 20` en `llegadas.js` y `PERMANENCIA_S = 60` en `regreso.js`—, y el reinicio que se cita vive en `regreso.js`. Así que la exposición no son veinte segundos sino **sesenta**, tres veces más ventana para que una sola posición ruidosa tire el reloj. Ninguna de las dos cosas está medida y no da para fichar; queda escrito para que, si la 44 empieza a ver llegadas que no validan «a veces» y sin patrón, se mire aquí **antes** que en el geofence.

**d · El número que nadie ha medido, y que habría que medir antes de dar la 44 por buena:** `RADIO_DE_GEOFENCE_M = 40` contra `ERROR_MAXIMO_FIABLE_M = 30`. En el emulador el GPS es perfecto y esto no dice nada; en una calle estrecha real el error se va a 30-50 m, así que **una fracción de las posiciones se descarta por poco fiable justo donde más falta hace**. Nadie sabe qué fracción.

**e · Un callejón sin salida, probado, para que nadie lo repita:** retirar `RECEIVE_BOOT_COMPLETED` con `tools:node="remove"` **no vale**. La app revienta con `IllegalArgumentException: Requested job cannot be persisted` en cuanto llega la primera posición, porque `expo-task-manager` clava `setPersisted(true)`.

**f · Y la distinción de quién afirma qué, que es de método y la puso ella:** lo último que la sesión de la 48 midió fue **la rama en `9be4246` con el árbol limpio**. El merge a `main`, la tanda de verificación y el `push` los hice yo, y son míos. Que nadie lea mañana esta conversación y atribuya a la 48 un merge que no verificó.

## §9 · La fila 44, y la duodécima aparición de §6h: la capa de llegadas no podía dispararse

### 9a · La deuda (d) del encargo apuntaba al revés, y detrás había algo mayor

El encargo de la fila (`docs/prompt-navegacion-en-la-calle.md` §d) pedía medir `RADIO_DE_GEOFENCE_M = 40` contra `ERROR_MAXIMO_FIABLE_M = 30` porque «una fracción de las posiciones se descarta por poco fiable justo donde más falta hace». **Es falso, y lo dice la propia fuente**: el comentario de `transporte.js:66` declara que *«las posiciones malas no se descartan —eso quitaría metros que sí se anduvieron—: solo dejan de poder afirmar un motor»*. Un fijo malo degrada `vehiculo` a `ambiguo`, y `ambiguo` **valida** (`validaLlegadaPorGeofence` solo aparta el vehículo). O sea que la precisión mala empuja hacia validar de más, no de menos.

Pero el sitio al que apuntaba sí escondía algo, y es lo peor que ha aparecido en todo el checklist. Montada la tubería real —el filtro de cadencia de `plataforma/posiciones.js`, el detector de `transporte.js` y `creaLlegadas().comprueba()` alimentado posición a posición—, con alguien **parado 300 s dentro de un geofence**, 400 semillas por celda:

| error del fijo | 0 m | 5 m | 10 m | 20 m | 30 m | 50 m |
| --- | --- | --- | --- | --- | --- | --- |
| valida, con la cadencia por distancia de hoy | 0 % | 21 % | 0 % | 0 % | 0 % | 0 % |
| valida, muestreando por tiempo cada 10 s | 100 % | 76 % | 13 % | 1 % | 0,3 % | 0 % |

**Hoy ninguna llegada puede validar en un dispositivo**, ni en la calle ni en el emulador. Dos causas independientes, las dos confirmadas en la fuente y no solo modeladas:

1. **Parado no llega ninguna posición.** `distanceInterval: 10` es `setMinUpdateDistanceMeters` del `LocationRequest` de Android (`node_modules/expo-location/android/src/main/java/expo/modules/location/LocationHelpers.kt:52`), un filtro duro. Con GPS perfecto —el del emulador— se entrega **un fijo en 300 s**, y la permanencia se cuenta sobre posiciones que llegan.
2. **El ruido del GPS se lee como andar.** `esUnaParada` mide `metros / duracionS < 0,5 m/s` sobre el salto crudo entre dos fijos. Un ruido de σ metros con fijos a T segundos aparenta ~1,4·σ/T m/s, así que hace falta **T > 2,8·σ** para que un parado parezca parado: con σ = 10 m, más de veintiocho segundos entre fijos.

**Es la duodécima aparición de §6h y la más cara**, porque la pieza que al no estar no protesta es la capa entera: SPEC-032 escribió, probó y cerró las llegadas **sobre secuencias de posiciones fabricadas**, y su propia sección de frontera dice «Ninguna entrada nueva de sensor: las dos que hacen falta ya existen». Nadie la conectó nunca al sensor real. Mil casos en verde sobre una capa que en un teléfono no se dispara jamás.

### 9b · Qué decidió el dueño, y por qué se le preguntó

La medida se le llevó **antes de escribir la spec**, porque el encargo dice que si el número sale feo *se escala y no se ajusta una constante por cuenta propia*. Se le ofrecieron tres alcances: solo el muestreo y escalar la calle; el muestreo **más** arreglar la detección de parada; o partir la fila en dos.

**Decidió arreglar también la calle**, con el tamaño de la fila advertido y el número delante.

Y queda anotado un asunto de método, porque va a volver a pasar: mientras la pregunta estaba abierta llegó **el mensaje de otra sesión afirmando la decisión del dueño**, con las condiciones ya redactadas. No se actuó sobre él. Un relato fiel de una decisión no es la decisión: quien la confirma es quien la toma, en su sitio. Se paró, se le preguntó a él y él contestó. Lo que sí se recogió de aquel mensaje es lo que no dependía de ninguna autorización —fijar los números midiendo, exigir las dos mitades del criterio y cortar en commits verificables—, porque era bueno con independencia de quién lo dijera.

### 9c · La regla nueva se fijó midiendo, y conserva los veinte segundos donde el fijo los sostiene

Anclar y comparar cada fijo contra el ancla **no vale**, y está medido: «parada dentro» y «de paso a 4 km/h» suben juntas con el radio de quietud (radio 15 m: 98 % de paradas validadas y **36 %** de paseos), porque con dos o tres fijos en la ventana el ruido y la deriva son indistinguibles.

Lo que sí los separa es que **el ruido del GPS es de media cero y la deriva de quien anda no**. La regla que se adopta mide la **deriva de la ventana**: el centroide de su primera mitad contra el de la segunda. Promediar hunde el ruido como 1/√n y deja la deriva intacta. Medido con muestreo cada 5 s, 800 semillas por celda:

| | ventana 20 s · deriva ≤ 5 m | | | ventana 40 s · deriva ≤ 8 m | | |
| --- | --- | --- | --- | --- | --- | --- |
| **error del fijo** | parada dentro | de paso 4 km/h | de paso 5 km/h | parada dentro | de paso 4 km/h | de paso 5 km/h |
| 0 m | 100 % | **0 %** | **0 %** | 100 % | **0 %** | **0 %** |
| 3 m | 100 % | **0 %** | **0 %** | 100 % | **0 %** | **0 %** |
| 5 m | 100 % | 4,3 % | 0,5 % | 100 % | **0 %** | **0 %** |
| 10 m | 100 % | 27,6 % | 11,6 % | 100 % | 0,8 % | **0 %** |
| 15 m | 82 % | 19,8 % | 12,0 % | 91 % | 5,9 % | 1,0 % |

De ahí sale la decisión, y es adaptativa **porque la medida lo pide, no por elegancia**: con el fijo bueno la ventana corta ya separa, así que **la permanencia de veinte segundos de `llegadas.js` se conserva donde el fijo la sostiene** y solo se estira a cuarenta cuando el error declarado del fijo la deja de sostener. Alargarla para todo el mundo habría contradicho sin necesidad la razón por la que SPEC-032 la puso corta —*validar es barato, y un beat que se atiende de paso valida igual*—.

**Las dos mitades del criterio se exigen a la vez**, y la segunda es la que se pierde sola en un arreglo de ruido: el vehículo sigue apartando la llegada, y el atasco dentro de un geofence sale **0 % en todas las tandas medidas**. Un arreglo que hiciera validar al parado a cambio de validar al autobús parado no sería un arreglo.

**Límite declarado**: por encima de σ ≈ 15 m la validación se degrada y por encima de σ ≈ 20 m deja de sostenerse. Cubre la calle normal y no cubre el cañón urbano profundo. Es un límite medido y con número, no una esperanza.

Tocar la regla de parada va contra decisiones cerradas de SPEC-031 y SPEC-032, así que **el diseño se actualiza y no solo el código**, que es lo que manda `CLAUDE.md`: las dos specs y el documento de `game-design/` correspondiente llevan el porqué con esta tabla como evidencia, y la iteración se anota en `docs/starting.md`.

**Y una atribución mía que estaba mal, corregida por `wa-spec` al ir a escribir la iteración:** el umbral de medio metro por segundo **no es una decisión de SPEC-031** sino de **SPEC-004** (`docs/specs/SPEC-004-tramo-personal.md:181`). Lo de SPEC-031 es que la parada se **detecte** en la traza y la asimetría por efecto. El umbral **no cambia** —sigue valiendo entero para el ritmo y para el motor de pasos—, así que SPEC-004 no necesita iteración; lo que se deroga es su uso como criterio de validación de un geofence, y eso sí es de SPEC-031. Queda escrito porque una derogación apuntada a la spec equivocada es una derogación que el dueño del número no se entera de que le han hecho.

## §10 · Lo que la fila 44 dijo al cerrarse, y que no estaba en ninguna parte

La misma pregunta que a la 48, y otra cosecha que justifica el hábito. **Lo verificable lo he verificado yo contra la fuente** antes de escribirlo; lo que es sospecha queda marcado como tal.

**a · La sospecha grande, sin medir: kilómetros fantasma, y puede haberla abierto la propia 44.** El detector clasifica con `UMBRAL_PARADA_MS` sobre el salto **crudo** entre dos fijos (`transporte.js:168`, verificado) — la misma raíz que rompía las llegadas, con otro consumidor: el motor de pasos. Ruido de σ=10 m con fijos a 5 s aparenta 2,8 m/s → se clasifica `andando` y esos metros se cuentan. Antes de la 44 esto no podía pasar estando parada, porque parada no llegaba ningún fijo; **el muestreo por tiempo cerca de un geofence abre la puerta a acumular metros sin andar, justo donde más se para**. Si alguien ve kilómetros que no cuadran, se mira `transporte.js:168` antes que el motor de pasos. El banco para medirlo es el de §9c: quieto, σ variable, contar metros clasificados `andando`.

**b · `esUnaParada` se ha quedado sin llamador de producción** (verificado: solo definición y pruebas). El umbral **no** está huérfano —`ritmo.js:341` y `transporte.js:168` lo consumen, la frase de SPEC-031-iter-1 es cierta—, pero la función exportada ya no la llama nadie: decidir si se retira o se declara. La sesión sospechó que la frase de la iteración era falsa, lo comprobó, y **no lo era** — se anota también eso.

**c · El banco de barrido de parámetros murió con la sesión.** La guarda de tubería quedó en `marcha.test.mjs`; el barrido periodo × ventana × umbral × σ (cinco scripts) vivía en el scratchpad. Quien quiera reafinar la ventana o el umbral tendrá que reconstruirlo, y reconstruirlo mal es cómo se cambia un número sin la tabla delante. Si se rehace, va a `scripts/` con guardián de ejecución directa.

**d · Callejón probado, para que nadie lo repita: anclar contra un ancla no separa parado de andar.** Radio de quietud 10/15/20/25/30 m a σ=10: parada dentro 77/98/100/100/100 % y de paso a 4 km/h **9,8/36/69/87/94 %**. Suben juntas, siempre.

**e · Contención del emulador: un solo dispositivo, un solo dueño a la vez.** Los flujos usan `clearState: true`; un agente corriendo Maestro mientras otro conduce `adb` le borró la partida a mitad de recorrido y casi se lee como defecto. Vale también para quien orquesta: **no lanzar la suite mientras una sesión de fila tiene el emulador.**

**f · Técnica que sirvió y no estaba escrita:** `adb shell run-as com.walkingadventure.app cat files/partida/partida/estado.json` lee el estado real del aparato — separa «la pantalla no lo enseña» de «no ha pasado» sin depender de la UI ni del informe de nadie.

**g · La costura con la 49, donde está mal cosida:** el hueco de `llegada.js` tolera el paso `beat` porque solo lo nombra; una pantalla de verdad no. El reparto casteado no sobrevive a cerrar la app, así que al reabrir **el beat de dentro llega nulo**: A4P3 se rompe ahí el segundo día, no el primero.

**h · La otra mitad: el telón se marca leído con una sola acción** (regla de SPEC-030: un toque de quien lo lee, nunca el paso de nada), y `abreSalida` lanza con telón sin leer. Si A5 se cuela un camino que no marque, **la app queda encallada sin poder abrir ninguna salida** — fallo silencioso con forma de app muerta.

**i · `componeDesenlace` sigue sin existir** (verificado hoy otra vez; §6v lo fichó). `echaElTelon` lo exige como parámetro y no hay función que lo derive de la plantilla y la aventura. La 49 se lo encuentra el primer día.

**j · Dos geofences solapados validan en la misma parada y encadenan sin pasar por el mapa** — la escena de la 49 puede aparecer inmediatamente después de cerrarse otra llegada. Tumbó 2 de 3 tandas hasta que la prueba lo asumió.

**k · El límite de la verificación de la 44, declarado por ella:** nunca condujo un recorrido limpio de punta a punta hasta A4P5 en una sola pasada — lo que firma se apoya en la tanda de wa-dev, el estado leído con `run-as`, `llegada.yaml` verde seis veces y su recorrido parcial. Evidencia convergente, no experiencia directa, y la diferencia quedó escrita.

### §10-bis · El punto (i) era falso, y cómo llegó a estar escrito dos veces

La fila 49 lo verificó antes de usarlo, que es lo que su encargo manda, y encontró que **`componeElDesenlace` existe**: `packages/nucleo/quests/desenlace.js`, con `lugarDelDesenlace` y `repuestoDe`, entró en `aec5efa` — el mismo arreglo que cerró §6v. O sea que la deuda se fichó y se saldó en el mismo commit, y la nota sobrevivió al arreglo.

Lo que sí es cierto, y es lo que queda en pie de (i): **no la llama nadie desde `app/`**. Es §6h en su forma de cableado —función escrita, probada en `bucle-completo.test.mjs`, sin llamador— y no una pieza que falte. La diferencia le ahorra a la 49 construir un duplicado que se habría desincronizado del original.

Y el error de método, que es lo que vale la pena escribir porque lo cometimos **dos veces seguidas**: la 44 dijo «lo he vuelto a comprobar hoy: no hay ninguna» y quien orquesta dijo «verificado hoy otra vez», y los dos grepamos `componeDesenlace` — un nombre adivinado — en vez de buscar el concepto. **Un negativo no se verifica buscando un identificador que quizá nunca existió: se busca lo que el código haría si existiera** (`desenlace` en todo el repo, los exports de `quests/`, el commit que cerró la deuda). Un relato fiel de una verificación no es la verificación, y una verificación mal hecha tampoco.

**Afinado por la 49, y es la lección que se queda:** el diagnóstico de arriba —«grepa el concepto y no el identificador»— es técnica, y no es el fallo de raíz. Un grep de `desenlace` a repo entero habría dado `quests/desenlace.js` en la primera línea; el que se hizo iba acotado al fichero que confirmaba la nota. Lo que falló es que **se reafirmó un negativo heredado de §6v sin volver a la fuente**: la comprobación tenía forma de confirmación, no de pregunta. La regla que evita repetirlo: **un negativo no se hereda — se vuelve a medir de cero o se marca como sospecha**, como los puntos (a) y (b) de §10, que es justo el hábito que en (i) no se aplicó. Y la consecuencia para quien orquesta: en los encargos, lo medido ahora y lo heredado de una nota van **etiquetados distinto**, porque tres filas seguidas encontrando falsa la premisa en el mismo sitio —una nota de decisiones reafirmada sin medir— ya no es suerte de quien caza: es una propiedad del método que había que corregir.

## §11 · La fila 49, y las once costuras entre escribir una pantalla y poder abrirla

La fila iba a ser «escribir las ocho pantallas que SPEC-034 y SPEC-036 nunca escribieron». Lo fue, y además destapó once cosas que impedían que esas pantallas hicieran nada. **Nueve de las once solo se ven recorriendo el bucle entero en un teléfono**, que es lo que su criterio 1 existía para obligar.

### 11a · Las cinco que estaban antes de empezar, y que encontró medir la premisa

El encargo daba por deuda conocida que «el reparto casteado no sobrevive a cerrar la app» y remataba que, si el telón se echaba en la misma sesión, no tocaba. Al medirlo con grep antes de escribir la spec:

1. **`acepta` de `aventura-en-curso.js` no la llamaba nadie.** `estado.aventuras.enCurso` era `null` **siempre**, `resuelveBeat` inalcanzable y `echaElTelon` habría compuesto el telón de un paseo aunque hubiera aventura aceptada. No era que el beat llegase nulo el segundo día: **no había aventura en curso ningún día**.
2. `antes-de-salir.jsx` cerraba la salida por su cuenta y dejaba a `echaElTelon` con «su telón ya se echó». El telón era inalcanzable por construcción.
3. **Dos identidades de salida** sobre dos áreas —`mapa/dN/sN` de la 28 y `mapa/sN` de la 48— y el cierre las compara. Ninguna estaba mal en su fila: el defecto nace de que **nadie las cruzó nunca**, porque hasta ahora nadie cerraba una salida contra el cierre.
4. `apuntaHaberEstado` sin llamador de producción: la lista de ascensos del telón habría salido siempre vacía y RF-BUCLE-012 no se habría cumplido nunca.
5. `lamina.jsx` no pasaba `entintado` ni `telon` al render, que ya los aceptaba.

El dueño decidió coserlas dentro de la fila con las once rutas advertidas.

### 11b · Un negativo heredado que era falso

§10i afirmaba, «verificado hoy otra vez», que `componeDesenlace` seguía sin existir. **Existe** desde `aec5efa`, el propio arreglo de §6v que la fichó. Lo cierto era que no la llamaba nadie desde `app/`. Corregido en §10-bis. La regla que sale, y que ya se aplicó tres veces en esta fila: **un negativo no se hereda — se vuelve a medir o se marca como sospecha.**

### 11c · La séptima, decidida mal, y las dos que colgaron de ella

Recorrer el bucle destapó que la lista de hoy no tenía memoria (sexta) **y** que los descartes no viajaban (séptima). La sexta la decidió el dueño. **La séptima la despachó quien orquesta esta fila sin llevársela**, aceptando de la sesión que escribe el registro un criterio que nadie había medido —«es la misma familia, mismo arreglo de una línea»—. No era simétrico: `aventuras` alimenta una lista con un consumidor; `descartes` alimenta un casting con **dos**, y arreglar uno solo los desincronizó.

De ahí salieron la **octava** —que la ficha, el motor y la preparación resuelvan contra el mismo recasteo— y la **novena** —que la aventura aceptada congele contra qué descartes se casteó, porque si no marcar un sitio a mitad le cambia la cadena y en `suelo-250m` la reventaba 9 de 19 veces—.

Lección de método, y es la cara b de §6h: **una pieza que al no estar no protesta es cara; un arreglo cuyo radio de acción no se ha medido lo es más.** `wa-dev` paró dos veces con la tabla delante en vez de seguir, y eso es lo que impidió que la octava y la novena se entregaran rotas.

### 11d · Preguntar lo mismo por dos sitios

Mientras se decidía la octava, la sesión que escribe el registro reportó que el dueño había pedido **revertir**; en la ventana de la fila había pedido **coser**. Las dos eran respuestas suyas de verdad, con distinto material delante: allí un resumen, aquí la tabla y el coste de reverificación.

Se paró al implementador con el trabajo sin empezar y el árbol limpio, se preguntó **una sola vez más y en la ventana donde vive la fila**, con las dos respuestas y las tres salidas posibles, y se ejecutó lo de allí.

§9b decía «un relato fiel de una decisión no es la decisión». Esto le añade la mitad que faltaba: aquí **la fidelidad no falló**. Falló preguntar lo mismo por dos sitios. **Una pregunta viva a la vez sobre un mismo asunto, y en la ventana de quien va a ejecutar la respuesta.**

### 11e · La primera migración de formato, y las tres que costó

Congelar la huella obliga a subir `VERSION_FORMATO` a 2, así que la fila estrena la cadena de `migracion.js`, escrita y vacía desde la 47.

- **Nueve pruebas rojas**, todas con la misma raíz: **codificaban «todavía no hay ninguna migración» como invariante**. Veredicto: defecto de prueba en las nueve, retiradas escribiendo el porqué dentro. Dos de ellas se apoyaban en que la versión sintética fuera **mayor** que la real; al arreglarlas se derivó todo el fichero de `VERSION_FORMATO`, porque había ocho literales más con la misma trampa esperando turno.
- **La décima**: `migraDocumentos()` leía con el lector estricto **antes** de migrar, y ese lector rechaza por definición toda versión anterior. Ningún documento viejo podía llegar a la cadena. Es la forma que la 47 ya había anotado y que no se había disparado nunca porque no había migraciones. La prueba de que era cuestión de puertas: `copia.js` parseaba sin exigir versión, **y por eso las copias sí se migraban**.
- **La undécima**: `VERSION_FORMATO` es **global a las ocho clases de documento**, así que subirla por la partida invalidó también el índice y las celdas del mapa, que nadie migraba. Una partida existente **no abría** tras actualizar.

**Y la causa raíz, que esta fila no toca y deja fichada**: mientras la versión de formato sea una sola para ocho clases, esta forma vuelve cada vez que una clase evolucione sola, y lo único que hoy sostiene que no falte ninguna es una lista escrita a mano. Lo pendiente es versión por clase, o una guarda que exija que subir la versión venga con migración para **todas** las que la comparten.

### 11f · Lo que el aparato enseñó y no es de esta fila

- **A4P8 no se puede marcar tocando el botón.** La capa de descarte desborda 1080×2400: los cinco motivos empujan y los dos últimos salen con cotas degeneradas **encima de «Marcarlo»**. El marcado solo entra por una franja de 30 px. Tercera aparición de la trampa del pliegue, y la primera vez que alguien abre A4P8 en un teléfono — `descarte.yaml` lleva en límite declarado desde que existe.
- **El servicio en primer plano se cae a mitad de salida**, dos veces sin provocarlo. La app responde como el diseño manda —tarjeta de a medias con sus dos acciones—, pero es lo que impidió verificar **el telón por regreso**, que se queda sin firmar. El telón sí está verificado por «dejarlo aquí» y por la tarjeta, que `bucle-jugable.md` §8 declara la misma puerta.
- **`siembraLaCola` no tiene llamador desde `app/`**: el prólogo produce sus entradas y nadie las encola, así que **hoy no puede saltar ni un micro-encuentro en un teléfono**. Es de la fila 19.
- **`NUCLEO_DEL_OFRECIMIENTO` no lo importa nadie**: A2P0 existe, está probada y es inalcanzable. Es de SPEC-041. Lo destapó la guarda nueva `piezas-sin-consumidor.test.mjs`.
- **Ninguna plantilla pone un beat sobre un rol humano**: 0 de 506 beats casteados de los cuatro mundos de referencia, así que `escena.cara` es **siempre** nula y el bloque de quien habla no se pinta nunca. Viene de SPEC-017; el número queda fijado y se pondrá rojo el día que una plantilla lo produzca.

### 11g · Dos contradicciones del repo, dichas y no resueltas

- **`naming.md` dice que los reports van en `test/reports/`; `.gitignore:31` los excluye** con su motivo escrito y veinte tandas de precedente sin ninguno versionado. Se ha seguido el `.gitignore` y el report de esta fila **no va al histórico**. Hay que decidirlo en un sitio y borrarlo del otro.
- **`escena.yaml` no puede salir de límite declarado**, y su motivo viejo era falso. Lo miden cuatro cosas: el ancla del mapa no la gobierna el flujo, la semilla nace de entropía real sin sitio donde escribirla, **`setLocation` de Maestro sale con código 0 y no mueve el aparato** —medido contra `adb emu geo fix`, que sí lo mueve, en el mismo emulador y sin reiniciarlo— y sin `siembraLaCola` no hay micro-encuentro. Juntas: **qué sitio tiene beat no es reproducible entre tandas.** La nota que decía que se curaba reiniciando el emulador mandaba a perder el rato y está corregida.

## §12 · Lo que la fila 49 dijo al cerrarse

La cosecha más larga hasta ahora, como corresponde a la fila más dura. Lo barato lo he verificado; lo que es medida suya va con su firma, y lo que es sospecha, etiquetado.

**a · Dos callejones de instrumentación, probados.** `ESQUEMAS` de `formato.js` se puebla al importar cada módulo de área: importar `migracion.js` sin `estado.js` da «clase de documento desconocida» **que es falso** y parece defecto — quien mida migraciones en Node importa primero el módulo del área. Y el envoltorio del almacén solo deja escribir bajo `partida/`: al migrar el mapa, la primera versión del arreglo no escribía nada **y no protestaba**.

**b · El telón por regreso: hipótesis con hilo barato, sin fichar a propósito.** Que el punto de partida no sea geofence → la cadencia nunca pasa a `por-tiempo` cerca de casa → parada no llega ni un fijo → `dentroDesdeMs` no acumula. Sería §9a en el regreso. No se fichó porque el sensor estaba caído al ir a medirla. **El hilo no necesita dispositivo**: `cadenciaDeMuestreo` con una posición en el punto de partida y el índice real de geofences — si devuelve `por-distancia`, pasa a fila. Y la caída del servicio en primer plano (dos veces, sin logcat): quien la persiga arranca `adb logcat` filtrado por el task manager **antes** de abrir la salida.

**c · Dos decisiones de diseño que nadie ha tomado en voz alta**, movidas a `docs/pendientes.md`: abandonar una aventura la quema para siempre (verificado: `cierra` mete a-medias en `cerradas`, línea 170, y la lista filtra por plantilla), y marcar «no pega» un sitio del lazo en curso ya no cambia la cadena pero **el juego te sigue mandando allí**.

**d · Operativa del aparato**, a `CLAUDE.md`: el JDK de compilar (17, no 26), las variables que no estaban escritas, `exec-out` para JSON grande, y que `expo run:android` abre la app sola — se come el «antes» de cualquier medición de migración. Y al tocar por `adb`: leer las cotas y desconfiar de nodos con `y2 < y1`, que se comen el toque (así estaba tapado A4P8).

**e · Costuras con lo que venga, declaradas**: la cadena de migraciones no sabe bifurcar (`paso()` introduce por ruta — por eso la huella vive al lado de `enCurso` y no dentro); `echaElTelon` exige la salida abierta, y una fila futura que cierre salidas por su cuenta repetirá el síntoma «su telón ya se echó» que no se parece a la causa; la memoria del casting tiene tope de cuatro ranuras por `(mapa, huella)`; y **ninguna pantalla se ha visto nunca en un iPhone** — la guarda del manifiesto mira iOS, los ojos no.

**f · Su última frase, que es el estándar**: «lo que no esté aquí ni en el repo, no existe».

## §13 · El cierre de la fila 50, y los dos rojos que no eran regresión

### 13a · El cotejo, número a número

Cotejo independiente el 12-ago-2026, `SUITE-run-20260812T124409Z`, con la precondición declarada por la fila (aparato limpio: `pm clear` + posición alimentada cada 2 s). Todo cuadra con lo declarado: @nucleo **2825 · 2821 · 1 · 3** con el único rojo siendo `BOOT_COMPLETED` (SPEC-023); @app **20 · 8 · 4 · 8**; frontera intacta (114 módulos); manifiesto mirado en las dos plataformas; mapa de pruebas 3567 entradas; `verifica-flujo` verde con 41 pantallas y 94 aristas; `BLOQUES_SIN_CONSUMIDOR` vacía; pantallas huérfanas 1; límite declarado 8. Merge `7d3c5ac`, empujado tras el cotejo.

### 13b · Los dos rojos nuevos, atribuidos midiendo: aparato, no código

`en-marcha.yaml` y `telon.yaml` caen los dos en «Current location is unavailable» al abrir la salida (el motivo viaja en el `accessibilityLabel` de `salida-no-se-abre`, no en su texto — para leerlo, la jerarquía de Maestro, no el nodo). La triangulación que descarta regresión: el mismo código los pasó la mañana del 12-ago (`SUITE-run-20260812T080830Z`, emulador caliente); la fila los reprodujo rojos **sobre main sin su merge**; y el cotejo los reprodujo tras reiniciar el emulador, con túneles y bucle de posición repuestos, con `dumpsys location` enseñando fijo fresco en `gps` y `fused` **y el arranque de la misma tanda anclando el mapa en ese fijo**. La posición puntual de la apertura es lo único que no llega con el proveedor frío. Trampa escrita en `CLAUDE.md`; la decisión de producto que lo cerraría (caer a la última posición conocida con cota de frescura), en `docs/pendientes.md`. Hasta que se decida, esos dos rojos se leen con la trampa delante: **rojo esperado desde aparato limpio, verde solo con el proveedor caliente.**

### 13c · Método: la instrucción de subagentes viaja en el prompt, no en un mensaje

La fila hizo sus fases en su propia ventana. La condición de trabajo enviada a mitad («un subagente por fase») fue **rechazada, con razón**: su configuración prohíbe la herramienta de agentes salvo petición directa del dueño, y un mensaje de quien orquesta no lo es — la misma asimetría de §9b, vista del otro lado. La corrección que queda: la instrucción va **dentro del encargo que el dueño pega**, que sí cuenta como petición directa suya, y el punto 1 del método de `pipeline/plan-restante.md` queda endurecido. Mitigación que la fila aplicó y vale como práctica: volcados de suites y ficheros a disco, lectura con grep, nunca en la ventana.

### 13d · Lo que la fila dejó dicho al cerrarse

Su despedida, respondida sin que se la preguntaran: «no queda nada en mi cabeza que no esté en el repo». Lo verificado del cierre lo confirma: la entrada XXXIV de la bitácora, las dos trampas nuevas de `CLAUDE.md`, y el único cabo suelto declarado en los dos sitios — `app/pantallas/visor.js` usa `...StyleSheet.absoluteFillObject`, el mismo spread que en el descarte no posicionaba, **y nadie lo ha medido**. Sin dueño hasta que una fila toque el visor.

## §14 · El cierre de la fila 46, el cotejo que hubo que repetir, y el árbol como recurso

### 14a · El cotejo, número a número

Cotejo independiente el 13-ago-2026, `SUITE-run-20260813T055007Z`, sobre `4a7df7a`, desde aparato limpio y **en exclusiva**. Todo cuadra con lo declarado: @nucleo **2865 · 2861 · 1 · 3** (único rojo `BOOT_COMPLETED`, `mirado: true` en las dos plataformas y `completo: true`); @app **20 · 8 · 3 · 9** con los tres rojos ajenos y leídos; `zurron.yaml` en su límite con código 0; pantallas huérfanas **0**; manifiesto con `minSdkVersion="26"`, solo los dos permisos de salud, cero `ACTIVITY_RECOGNITION`, las dos puertas de la razón registradas, y `Info.plist` sin claves de salud. Merge `b212f5d`. **B7 queda entero.**

La lupa sobre los dos precedentes que la fila estrenó, pasada: el plugin nativo (`app/plugins/lo-que-exige-health-connect.js`) traduce y no decide, y **falla a gritos si la plantilla de Expo cambia** en vez de aplicarse a ciegas — es el molde correcto; y la forma nueva de límite declarado («depende del mundo») exige nombrarse a mano con la estricta por defecto — el candado contra la excusa cómoda está puesto.

### 14b · El cotejo abortado, la atribución con evidencia, y la lección de raíz

La primera tanda de cotejo se abortó. Cronología corta: la sesión avisó de que corregía **un comentario** (el motivo de `zurron.yaml`, que afirmaba más de lo que su medida sostenía — cazado por ella misma, tercera vez que esa lista lo intenta y primera que se caza antes del merge); al mirar procesos aparecieron además **una batería de núcleo suya sobre el árbol compartido y un subagente suyo conduciendo el emulador** (`pm clear` + `geo fix` a `-8.80` + `arranque.yaml`) durante la tanda declarada. Dos fuentes de posición y un `pm clear` ajeno = números inatribuibles; se abortó y se repitió una vez, limpia.

Las atribuciones se cerraron **con evidencia y no con memoria**: el proceso del emulador escribía en el scratchpad de su sesión (mismo directorio que su `post-fix.log`) — un subagente que su comprobación de «cero vivo» no vio, y que ella asumió entero al vérselo; y el proceso que ella encontró después y **no mató — preguntó primero, con las dos salidas escritas —** era la precondición de mi propio cotejo. Ninguna de las dos sesiones mintió en ningún momento; las dos comprobaron mal la primera vez.

**El diagnóstico de raíz es suyo y es el bueno: el fallo no fue saltarse un turno, fue no ver que el árbol compartido es un recurso igual que el emulador.** Un `node --test` sobre el árbol es una toma de recurso; «avisar del fichero» no cubre «voy a ejecutar».

Las dos reglas de protocolo que quedan **vigentes desde ya**, a mano y sin mecanismo:

1. **`pgrep` contra el patrón, no memoria de lo lanzado** — y cubre lo que los subagentes tengan vivo en segundo plano.
2. **Ante un proceso ajeno posible, preguntar antes de matar**, con la evidencia y las salidas escritas.

Y los **tres fichados de mecanismo, pendientes de decidir con el dueño** (ninguno era de la fila y ninguno se resuelve solo):

- **Que el recurso compartido no sea el árbol**: un cotejo que corre sobre su propio worktree/clon no lo envenena nadie, y el cerrojo queda para lo único de verdad único, el emulador.
- **Declaración de recursos**: quien declara una tanda dice qué toma (aparato y árbol) y el otro responde «entendido, y esto es lo que tengo vivo» — con `pgrep`, no de memoria.
- **El freno del plugin nativo**: nada impide hoy que el próximo plugin meta lógica de producto en Kotlin, donde ninguna guarda mira. Decidir si es guarda o convención.

### 14c · La despedida de la 46, con sus etiquetas

- **Los `console.log` de la app salen por Metro, no por `logcat`** (medida de wa-dev, no reproducida por la sesión ni por mí — etiquetada). Quien instrumente, que empiece por Metro.
- **Técnica que vale fuera de este repo**: para atribuir un efecto que no se puede observar, **apagar el candidato y mirar si el efecto sigue** — así se convirtió «no me explico quién concede los permisos» en un hecho medido con su límite.
- **Sospecha etiquetada, sin verificar**: que los permisos de salud los conceda el delegado del módulo de Expo de la librería, o el Health Connect del emulador resolviendo en corto. Es el hilo de quien lo persiga.
- **Sospecha valiosa**: `empezar-de-nuevo-copia` (que se creía de iOS y **se reproduce en Android**, dos tandas) podría ser **el mismo pendiente** que el botón atrás del 10-ago — cae tras el `back` que cancela la hoja de compartir. Un pendiente y no dos, si al medirlo resulta serlo; no se funden hasta entonces.

### 14d · Las tres negativas correctas, que ya son doctrina

La fila rechazó tres peticiones de quien orquesta, y las tres veces con razón: usar subagentes por mensaje (§13c), escribir en `CLAUDE.md` por petición de par (la autoridad la dio el dueño en su ventana), y anotar su bitácora **bajo un cotejo en marcha** (habría movido la cabeza bajo la tanda — el mismo error de media hora antes con otro traje). La regla consolidada: **un mensaje de par propone; el dueño autoriza en la ventana de quien ejecuta; y nada se escribe en el árbol mientras una tanda ajena corre sobre él.**

### 14e · Los tres mecanismos, decididos por el dueño (13-ago-2026)

1. **El cotejo corre en worktree propio.** `git worktree add` del hash a cotejar, la suite allí, y se borra al terminar — nadie puede mover la cabeza bajo una tanda. El repo ya estaba diseñado para que abrir worktrees fuera gratis (Overpass y caché compartidos), así que el coste es cero. Matiz declarado: cubre la batería de núcleo y los flujos; el binario instalado y Metro siguen atados al emulador, que conserva su turno único.
2. **La declaración de recursos queda como protocolo escrito, sin herramienta.** Las dos reglas de §14b (pgrep contra el patrón; preguntar antes de matar) van en el método y en los encargos de fila. Ya funcionó a mano en el propio incidente; si vuelve a fallar, se mecaniza.
3. **El freno del plugin nativo es guarda de lista cerrada.** Un test de núcleo al estilo de `piezas-sin-consumidor`: los plugins de `app/plugins/` nombrados a mano con su cometido declarado, rojo ante uno nuevo o cambiado hasta que alguien lo nombre. «No decide» sigue siendo revisión; la guarda garantiza la conversación. **La escribe `wa-qa-dev` en el próximo encargo** — quien orquesta no toca `test/`.

## §15 · La fila 51, el primer cotejo en worktree, y el runner que tomaba el aparato solo

### 15a · La fila más limpia de las nueve, y por qué

Cerrada y cotejada el 13-ago-2026, merge `6ff0ead` sobre `b6647b9`. **0 → 69 beats con cara** en 63 de 103 aventuras, con la casteabilidad **idéntica byte a byte** (640/660, medida por cuatro manos) y sin retirar un caso (2865 → 2906, delta cerrado). El patrón que la hizo limpia lo nombró su propia despedida: **medir la propuesta con una copia parcheada fuera del árbol antes de escribir la spec** — las cuatro decisiones del dueño (mismo lugar, dos cláusulas, rótulo de mundo, herencia de forma) llegaron como preguntas con números delante, no como opciones de folleto. La novena premisa falsa de nueve encargos: un beat sobre rol humano no es que no ocurriera — **reventaba** con `TypeError` diferido (70 excepciones), y el chequeo que debía impedirlo se saltaba en silencio: §6h en versión validación. Los sitios a tocar eran siete, y los dos que `wa-dev` declaró por su cuenta eran fugas de registro de las feas (la marca `humano` pintada en el mapa; `humano` viajando al LLM como tipo de lugar). Las guardas a mover eran diez y no seis, y una **medía la herencia como fallo** — arreglada mirando, no a ciegas.

### 15b · El primer cotejo en worktree (patrón §14e), y lo que enseñó

`git worktree add` sobre el hash declarado e inmóvil, npm install, compilación dentro (57 s con las cachés de Gradle compartidas — el diseño del repo pagando), Metro propio sirviendo el hash congelado, y la suite entera desde allí. **Lección primera del patrón: el worktree nace sin artefactos de compilación** — la primera pasada dio `ios: NO MIRADO` y un total de 2901 que «parecía» bien: la trampa del total que baja, en vivo, cazada por la propia guarda. El prebuild de iOS en el worktree y una segunda pasada de núcleo la convirtieron en **2906 · 2902 · 1 · 3 con `mirado: true` y `completo: true` medidos** — que además convirtió en medido el heredado que la fila había declarado honestamente (sus artefactos eran del 12-ago). El coste total del patrón: ~10 minutos sobre el cotejo clásico, a cambio de que nadie pueda mover la cabeza bajo la tanda. **Queda como forma canónica del cotejo, con el prebuild de las dos plataformas como paso del patrón.**

### 15c · El runner tomaba el aparato por presencia, y la fila que lo cazó no paró: acotó

Una fila con «no tomo el emulador» decidido por el dueño **lo habría tomado** copiando la invocación canónica del método: el runner corre `@app` si encuentra Maestro y un aparato conectado — decide por presencia, no por declaración. `wa-qa-tester` comprobó el terreno antes de arrancar y usó `--nucleo-only`, que el runner ya traía. Es la familia de la tubería (la invocación cómoda hace algo distinto de lo que crees) y ya está escrita en `CLAUDE.md` y en el punto 9 del método, junto con `timeout` que no existe en este macOS. La declaración de recursos **no la lee el runner**: los mecanismos no sustituyen al terreno comprobado.

### 15d · La despedida de la 51, con sus etiquetas

- **Sospecha, con su grep pendiente**: guardas que filtran por `typeof === 'string'` antes de afirmar **dejan de medir cuando el dato cambia de forma** — familia nueva de §6h («una guarda que al cambiar la forma del dato deja de medir»). Aquí se cazó a tiempo (`empuje` quedó como cadena con la forma al lado); si el patrón está en más guardas de `test/nucleo/`, no se ha mirado.
- **Terreno ajeno verificado y no tocado**: `casting.test.mjs:989` tiene nombre de caso distinto del escenario que declara su entrada del mapa, desde SPEC-010 — rompe la propiedad que hace útil el cruce por grep. Cuántos más hay, sin contar; si el cruce vale menos de lo que parece, quizá el validador del mapa deba afirmar la igualdad — decisión de guarda para otro día.
- **Costura dicha antes de morder**: `casting.js:518` fija `dador.lugar = lugares[0]`; el día que un beat 1 gane cara, el dador entregará una persona donde el consumidor espera un sitio. Hoy ninguno de los 21 es primero de cadena.
- **Lo que nadie ha visto**: la cara en la pantalla de un teléfono. Composición y montado afirmados en Node; la lectura a 1080×2400 queda fichada para **la primera fila con aparato**, junto con el freno visual de A4P3.
- Y la maquinaria que la fila fichó sin tocar —la plantilla de alcance que paría specs con skills de otro stack, y el hueco de dueño en `naming.md`— quedó corregida el mismo día (`45f0036`): la referencia, el arrastre de SPEC-050, y la fila nueva de la tabla.

## §16 · La fila 52: el último rojo, apagado — y la propiedad que resultó ser más ancha que su guarda

### 16a · La primera batería 100 % verde, cotejada

Cerrada el 13-ago-2026, merge `dd5492a` sobre `bf48a5c`. Cotejo en worktree propio: **@nucleo 2915 · 2912 · 0 fallos · 3 saltados** — ni un `not ok` en el report, con `mirado: true` en las dos plataformas y `completo: true` sobre artefactos regenerados. El rojo de `BOOT_COMPLETED`, que nació a propósito con la fila 48 y llevaba cinco días señalando, se apagó **arreglando el manifiesto y sin ablandar la guarda**: el receptor de `expo-notifications` conserva exactamente `NOTIFICATION_EVENT` (`exported="false"`, verificado por quien orquesta sobre el artefacto del worktree) y pierde las acciones de arranque. `@app` sin cambios (20 · 8 · 3 · 9, los tres ajenos). `plugins-declarados` salió **endurecida**: además de la huella, gana `nombraAlMenos` — el cometido ya no se puede renombrar sin decir qué cambió.

### 16b · La décima premisa falsa, y de quién era

El criterio 1 del encargo pedía además quitar `RECEIVE_BOOT_COMPLETED`, y la fila lo midió antes de obedecerlo: quitarlo **reventaba la app** (`setPersisted(true)` + `startLocationUpdatesAsync` lo exigen — `IllegalArgumentException` medida el 11-ago) y enrojecía dos guardas verdes. La autoridad la tenía el texto de la propia guarda roja: «el permiso a solas es inerte; lo que despierta es el receptor». Décima premisa falsa de encargo en diez filas, segunda consecutiva de quien orquesta — el criterio se reescribió como la propiedad y el prompt quedó corregido con la nota dentro. La lección técnica que queda para el tercer receptor de una librería futura: **el gemelo de `task-manager` se descubre por clase** (se le pudo quitar el filtro entero); **`expo-notifications` se descubre por la acción del filtro** (`queryBroadcastReceivers`) — un reemplazo sin filtro habría roto todas las notificaciones **en silencio**.

### 16c · La despedida: la propiedad es más ancha que la guarda

- **Segunda vía de despertar con la app cerrada, fichada como decisión del dueño**: los receptores FCM de `expo-notifications` (`FirebaseInstanceIdReceiver` con `exported="true"` + dos servicios de `MESSAGING_EVENT`) despiertan el proceso igual que lo hacía el arranque, y `ACCIONES_QUE_DESPIERTAN` no los lista — la guarda verde no miente, pero la propiedad redactada en `permisos.js` («con la app cerrada») es **más ancha** que lo que la guarda afirma («al arrancar»). Inerte hoy, medido en tres direcciones (sin `google-services.json`, sin llamadas de token, permiso c2dm admitido con motivo — **el receptor no lo mira nadie**). La fila lo dejó fuera del repo a propósito para que la ampliación de alcance no entrara por su mano. Forma candidata: **lista cerrada de vías de despertar**, estilo `ARRASTRE_DE_LIBRERIA`.
- Menor, con su etiqueta: `HealthDataSdkService` `exported="true"` — esperable (binding de Health Connect), no mirado más allá.
- **Trampa nueva en `CLAUDE.md`, hermana del total que baja**: `expo run:android` sobre un `app/android/` existente **no repite prebuild** — un cambio de plugin no llega al manifiesto y la guarda mide el artefacto viejo con `mirado: true` puesto. En worktree recién creado no aplica, que es por qué el patrón §14e no la vio. Y la receta `comoSeGenera` del estado del manifiesto engaña por lo mismo: fichada (territorio de `test/`), sin arreglar de paso.
- Dos negativos limpios: los 3 saltados permanentes son casos condicionados a Maestro **ausente** (saltan porque está), y el prebuild de iOS no movió `package.json`.

## §17 · La fila 53: el proyecto entero en verde, y las dos enmiendas que me tocan

### 17a · El PASS, cotejado

Cerrada el 14-ago-2026 (madrugada), merge `be67442` sobre `7c8737e`. Cotejo en worktree propio: **PASS del runner, EXIT=0, por primera vez en la historia del proyecto** — @nucleo **2960 · 2957 · 0 · 3** con `mirado: true` en ambas y `completo: true`; @app **21 · 12 · 0 · 9**; cero `not ok` y cero `FALLO` en el report entero; **límite declarado en 9, sin tocar** — ni un flujo marcado para ahorrarse un rojo. Los tres rojos históricos, apagados por la raíz. La segunda entrega, verificada por mi mano sobre el artefacto: **cero receptores FCM en el manifiesto fusionado** y la guarda de vías de despertar con las vías nombradas. Reproducibilidad de la fila: tres tandas, 18/18, con `pm clear` por flujo — y mi cuarta lo confirma.

### 17b · La excavación de tres capas, y la enmienda de §13b que me toca

Lo que §13b y §16 llamaron «el proveedor de ubicación frío» **no era el proveedor**: `posicionPuntual()` pedía con `Accuracy.Balanced`, y con esa el sistema no enciende el GPS — **la causa llevaba desde el 11-ago escrita en el propio módulo, veinte líneas por encima del defecto**, avalando la decisión contraria para la suscripción, y dos cotejos independientes (los míos, filas 50 y 52) no la cruzaron con el síntoma. Peor: mi precondición declaraba «bucle de posición alimentando cada 2 s» y el bucle **no alimentaba nada** en las fases donde importaba, porque `adb emu geo fix` no inyecta si nadie pide — el GPS del emulador es bajo demanda (medido: 4 minutos de bucle, cero eventos; con un cliente pidiendo, fijo de 0,6 s). **La atribución era coherente con lo que se veía; lo que se veía no era lo que había.** La cadena entera: puntual-equilibrada → GPS nunca enciende → nadie pide → el bucle no inyecta → último conocido = fijo del boot (25 h) → «unavailable» a los 30 s. Y debajo, la tercera capa: no había reloj con que medir frescura (la regla de determinismo extendida por deriva a toda la app), resuelta con el reloj en la capa de plataforma — fijos certificados cruzan como dato, núcleo y persistencia intactos, precedentes `calendario.js` y `lector-de-salud.js`. Las trampas de `CLAUDE.md` quedaron corregidas por la fila con autorización del dueño; esta enmienda del registro es mía. **Decimosegunda premisa falsa de trece encargos, y la lección: no fallamos por no medir — fallamos por no cruzar un comentario con un síntoma.**

### 17c · La enmienda de §12b: el telón por regreso era imposible, no averiado

El arnés diferencial de la fila (misma trayectoria contra los dos árboles, filtro del sensor modelado) demostró que **el telón por regreso era estructuralmente imposible**: parada en casa y fuera de todo geofence, 1 fijo en 400 segundos — la permanencia no podía acumular jamás. El «no se pudo verificar» de la fila 49 y el fichado de §12b eran esto. La decisión 2 del dueño (el punto de partida entra a la cadencia) no era mejora: era **condición de existencia**, y con ella el telón cae (4 fijos en 20 s, medido). El arnés diferencial entra al catálogo de método junto al «apaga el candidato» de la 46. Lo que queda de §12b en pie, transformado: **la carrera de la salida sorda** — hipótesis acotada línea a línea (`alRecibir` sin serializar, solape en `ajustaLaCadencia`), dueño SPEC-048, **sin arreglar porque no hay medida**, y ahora **visible**: la marca `salida-averia` pinta `sin-averia` explícito, para que la próxima aparición se lea con texto delante en vez de archivarse en silencio.

### 17d · Lo que queda en la mesa del dueño, y lo fichado

Decisiones de diseño sin tomar, todas con raíz o medida delante: **el botón atrás** (raíz en `App.js:234-250`: fuera de A6 no lo gobierna nadie), **el telón que salta al pasar por delante de casa** (71 s de cruce contra 60 de permanencia — `regreso.js:39` promete lo que no cumple), **abandonar quema la plantilla** y **marcar un sitio del lazo en curso** (de la 49). Fichado sin fila: la carrera (SPEC-048, con su marca puesta), el lector de recursos del visor (sospecha del spread **reforzada** por el árbol de git), tres flujos con ramas condicionales no exhaustivas, y **el rótulo retirado por plazo deja la app sin vuelta a la portada**. Y las dos lecciones de la fila para el método: **cuando el instrumento y lo medido comparten mano, el verde no dice nada por sí solo** (apareció dos veces el mismo día por caminos distintos), y el patrón exportable — primero la sonda, luego la spec; primero el diferencial, luego el veredicto.
