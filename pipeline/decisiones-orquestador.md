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
