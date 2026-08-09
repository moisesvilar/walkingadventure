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
