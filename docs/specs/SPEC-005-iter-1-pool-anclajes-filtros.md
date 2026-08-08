# SPEC-005-iter-1 — Los topes de diversidad dejan de amputar el pool y pasan al reparto

## Descripción

Iteración de corrección de defecto sobre la implementación de SPEC-005. La desencadena la medición de la entrega sobre los ocho extractos de referencia: la casteabilidad agregada cae de **21/48 a 17/48**, `costero` pierde parajes —5 → 3 con el cupo en 5— y un servicio, y `urbano-denso#2` baja de 6 a 3 plantillas casteadas. Quien orquesta dictamina que es defecto de código respecto al criterio de salud del generador que `CLAUDE.md` declara explícitamente: no se mergea una entrega que baja la casteabilidad un 19 %.

El diagnóstico separa dos piezas que la spec base metió en el mismo saco. El **descarte de una etiqueta entera por falta de nombre** —más de 20 entradas y menos del 10 % nombradas— acierta y se queda intacto: es la regla con medición detrás, la que deja fuera `amenity=drinking_water` (0 % nombradas) y dentro `amenity=fountain` (35 %), y la que de verdad implementa «reconocimiento, no abundancia». El **filtro de tipos problemáticos** también acierta y no se toca: en `urbano-denso` convierte 769 locales de adultos en 0 y 86 `drinking_water` en 0. Los que hacen daño son **los topes porcentuales**, que son el instrumento romo: recortan el pool antes de que existan núcleos y calzadas, así que no recortan diversidad sino materia prima del mundo entero.

Lo que cambia: los topes por etiqueta y por `kind` **dejan de sacar anclajes del pool** y pasan a actuar en el reparto de los anclajes libres, y solo sobre el excedente —mientras la fase que reparte no cubra su cupo, no se descarta ningún candidato—. Y se añade el criterio que faltaba y que habría cazado esto solo: **la casteabilidad agregada sobre los extractos de referencia no puede bajar** respecto al estado anterior a esta fila.

Lo que no cambia: el filtro de tipos problemáticos, el descarte por falta de nombre, la exclusión nominal de `amenity=drinking_water`, el catálogo de admisión, el uso único con su error al tomar dos veces, la deduplicación con Places y su relleno solo hasta cubrir el déficit, la puntuación de candidatos, el determinismo con sufijo propio de fase, y los porcentajes 25 % y 40 %, que siguen siendo los mismos números aplicados en otro sitio. Tampoco cambia —y se dice porque es lo que el implementador resolvió bien y hay que conservar— que **la demanda de la celda se lee del radio y jamás del tramo de quien juega**: `demandaDeAnclajes(radius)` en `build.js` deriva su número de los cupos declarados por las fases a partir del radio, y atarlo al tramo rompería «Dos partidas con la misma semilla y tramos distintos generan el mismo mundo».

El suelo de parajes derivado del catálogo de plantillas es de la fila 6 del checklist y esta iteración no lo toca, aunque se cruce con ella: `suelo-250m` sigue saliendo con 0 parajes y con 0 plantillas casteadas antes y después, y eso no es materia de aquí.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: mover los topes de diversidad del pool al reparto de anclajes libres, con su relajación, y regenerar los extractos de referencia que el cambio mueve.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- **La frontera de inyección no cambia.** `construyePool` sigue recibiendo lo mismo —`poiJson`, centro, semilla, `demanda`, `places`, `radio` y `seaMask`— y `buildWorld` sigue con el mismo `fetchData` y el mismo `demanda` opcional. Lo que cambia es interno al paquete: qué hace el pool con los topes y quién los aplica.
- **Fuera de alcance, solo el delta:** no se toca el filtro de tipos problemáticos, que funciona y está medido (769 → 0); no se toca el descarte de etiquetas por falta de nombre, ni sus dos umbrales; no se reintroduce `amenity=drinking_water` por ninguna vía; no se toca el suelo de parajes derivado del catálogo de plantillas, que es de la fila 6; y no se aprovecha para cambiar los porcentajes 25 % y 40 %, que se mueven de sitio pero no de valor.

## Defecto a corregir

### Síntoma

La entrega deja la suite en verde —el report `test/reports/SPEC-005-run-20260808T070046Z.md` da PASS con 273 casos— y aun así empeora el generador, porque ningún caso medía la salud del mundo resultante. La medición sobre los ocho extractos de referencia, comparando `cec7d91` (el commit anterior a la fila) con `98428c3` (la entrega):

| Extracto | Castea antes | Castea después | Parajes antes → después | Servicios | Calzadas |
| --- | --- | --- | --- | --- | --- |
| `barrio-tres-calles#1` | 0/6 | 0/6 | 2 → 2 | 0 → 0 | 4 → 4 |
| `barrio-tres-calles#2` | 1/6 | 1/6 | 2 → 2 | 0 → 0 | 4 → 4 |
| `costero#1` | 3/6 | **2/6** | **5 → 3** | 11 → 10 | 11 → 9 |
| `costero#2` | 5/6 | 5/6 | **5 → 3** | 12 → 10 | 9 → 9 |
| `suelo-250m#1` | 0/6 | 0/6 | 0 → 0 | 6 → 6 | 4 → 4 |
| `suelo-250m#2` | 0/6 | 0/6 | 0 → 0 | 6 → 6 | 4 → 4 |
| `urbano-denso#1` | 6/6 | 6/6 | 5 → 5 | 13 → 13 | 10 → 10 |
| `urbano-denso#2` | 6/6 | **3/6** | 5 → 5 | 14 → 14 | 11 → 9 |
| **Agregado** | **21/48** | **17/48** | | | |

El cupo de parajes de `costero` es 5 —radio de dibujo 1200 m—, así que la celda no se queda corta por escasez del mundo real: se queda corta porque el pool que le llega ya no trae con qué.

### Causa raíz

`packages/nucleo/world/anclajes.js`. Los topes están implementados como una **amputación del pool**, en `recorta` y en `aplicaTopes`, y `construyePool` los aplica al final de la admisión, antes de devolver nada. El anclaje que excede el tope de su etiqueta o de su `kind` no baja de prioridad: desaparece.

```js
if (ne >= limiteEtiqueta || nk >= limiteKind) continue;   // recorta(): el anclaje se cae del pool
```

Y la relajación, que existe, llega tarde y mide contra lo que no es:

```js
while (conTopes.length < exigido.suelo && conTopes.length < anclajes.length && escalon < ESCALONES_DE_TOPE.length - 1)
```

`exigido.suelo` es el **cupo de parajes** de la celda —3 en `costero`, 5 en `urbano-denso`—, no lo que el mundo se va a gastar. Un pool recortado a 26 anclajes está muy por encima de 3, así que la relajación no se dispara nunca y el recorte se consuma entero. Medido sobre los mundos congelados, con el pool ya filtrado y con la máscara aplicada:

| Mundo congelado | Admitidos antes del recorte | Tras los topes | Recortados |
| --- | --- | --- | --- |
| `costero` | 45 | 26 | 19 |
| `urbano-denso` | 2 556 | 1 540 | 1 016 |
| `suelo-250m` | 10 | 8 | 2 |
| `barrio-tres-calles` | 0 | 0 | 0 |

De ahí sale todo lo demás, y en dos daños distintos. En `costero`, 26 anclajes para 7 núcleos y 10 servicios dejan 9 libres, y sobre 9 candidatos —descontando los que caen dentro del radio urbano, los que no tienen calzada cerca y los que el reparto separa— salen 3 parajes en vez de 5. En `urbano-denso` el pool recortado sigue siendo enorme (1 540) y aun así la casteabilidad de la segunda semilla se hunde: el recorte se lleva por delante anclajes concretos, los núcleos nacen en otro sitio, se trazan dos calzadas menos y el casting deja de cerrar lazos. Es decir, **el tope hace daño incluso donde sobra pool a espuertas**, porque recorta antes de que exista el mundo que iba a usarlo.

La comprobación de que el culpable es ese y no otro: generando los ocho extractos con la entrega tal cual pero **sin aplicar ningún tope**, la casteabilidad agregada sube a **24/48**, por encima incluso del 21/48 anterior a la fila. El resto de SPEC-005 —filtro, descarte por falta de nombre, identidad estable, penalización en vez de exclusión— es ganancia neta; los topes son la pérdida.

### Cambio requerido

Dos cosas, y las dos quirúrgicas.

**Primera: el pool deja de recortarse.** Los anclajes que sobreviven al filtro de tipos problemáticos, al catálogo, al descarte por falta de nombre, al radio y a la máscara **entran todos** en el pool. El pool sigue publicando en su resumen cuántos anclajes aporta cada etiqueta y cada `kind` —esa información no se pierde, es la que consume quien reparte—, pero deja de decidir con ella.

**Segunda: el tope se aplica al repartir, y solo sobre el excedente.** Cuando una fase reparte anclajes libres y tiene más candidatos que huecos, se aplican los topes sobre ese conjunto de candidatos; y el recorte se detiene en cuanto dejar caer un candidato más bajaría el número de candidatos por debajo del cupo de la fase. Si al aplicar los topes la fase se quedaría corta, se recuperan los mejores descartados hasta cubrir el cupo, y el mundo declara que el reparto tuvo que saltárselos. No hay escalera de escalones: la relajación es inmediata, porque un tope que compite con la jugabilidad ya perdió —lo dice la propia spec base, «la diversidad es preferencia, la jugabilidad no»—, y la implementación actual relaja tarde precisamente por haberla escalonado.

Medido con ese cambio sobre los ocho extractos: casteabilidad agregada **23/48**, `costero` recupera sus 5 parajes con 6/6 y 5/6, y `urbano-denso#2` vuelve a 6/6.

## Criterios de aceptación modificados

Gherkin español, los mismos `Dado / Cuando / Entonces` de `docs/testing.md`, como en la spec base. «Mundo congelado X» sigue siendo el fixture `test/fixtures/osm/X/`, y «extracto de referencia» el fichero `test/fixtures/mundos-referencia/X-semilla-N.json`.

### El pool no se recorta

- **Dado** un conjunto de datos crudos, **cuando** se construye el pool, **entonces** ningún anclaje que haya pasado el filtro de tipos problemáticos, el catálogo de admisión, el descarte por falta de nombre, el radio y la máscara tierra/mar queda fuera del pool por exceder un tope.
- **Dado** el mundo congelado costero, **cuando** se construye el pool, **entonces** admite 45 anclajes.
- **Dado** el mundo congelado urbano denso, **cuando** se construye el pool, **entonces** admite 2 556 anclajes.
- **Dado** un pool ya construido, **cuando** se pide su resumen, **entonces** sigue declarando cuántos anclajes aporta cada etiqueta `clave=valor` y cada `kind`.
- **Dado** un pool ya construido, **cuando** se comparan sus anclajes con los que devolvería la misma admisión sin ningún tope, **entonces** son exactamente los mismos.

### El tope actúa al repartir y solo sobre el excedente

- **Dado** una fase que reparte anclajes libres y tiene más candidatos que su cupo, **cuando** elige, **entonces** ninguna etiqueta `clave=valor` aporta más del 25 % de los candidatos que se le ofrecen y ningún `kind` más del 40 %.
- **Dado** una fase cuyos candidatos libres no llegan a su cupo, **cuando** elige, **entonces** no se descarta ningún candidato por tope.
- **Dado** una fase donde respetar los topes dejaría menos candidatos que su cupo, **cuando** se aplican, **entonces** el recorte se detiene justo en el cupo y no por debajo.
- **Dado** una fase donde el recorte se ha detenido en el cupo, **cuando** se recuperan candidatos descartados, **entonces** se recuperan por orden de preferencia: primero los mejor puntuados y, a igualdad, los que tienen nombre.
- **Dado** una celda donde el reparto tuvo que saltarse los topes, **cuando** se consulta el mundo generado, **entonces** consta que se saltaron, con la fase que lo hizo.
- **Dado** una celda donde los candidatos sobraban, **cuando** se consulta el mundo generado, **entonces** no consta ninguna relajación.
- **Dado** una etiqueta que excede su tope en el reparto, **cuando** se recorta, **entonces** los candidatos que se conservan son los mejor puntuados y, a igualdad, los que tienen nombre.
- **Dado** candidatos que vienen de Places y candidatos que vienen de OSM, **cuando** se reparten, **entonces** el tope los trata igual y no distingue la fuente.
- **Dado** el mundo congelado urbano denso, **cuando** se generan los parajes, **entonces** los tipos siguen repartidos y ninguno se lleva más de la mitad.
- **Dado** el mismo mundo congelado y la misma semilla, **cuando** se genera dos veces, **entonces** el reparto elige exactamente los mismos anclajes y en el mismo orden.

### La casteabilidad no puede bajar

Este es el criterio que faltaba, y el que convierte «la salud del generador» en algo que un caso puede afirmar.

- **Dado** los ocho extractos de referencia regenerados tras esta iteración, **cuando** se suman las plantillas que castean en todos ellos, **entonces** el total es al menos **21 de 48**, que es el valor medido en `cec7d91`, el commit anterior a esta fila.
- **Dado** cada uno de los ocho extractos, **cuando** se compara cuántas plantillas castea con las que casteaba antes de esta fila, **entonces** ninguno castea menos.
- **Dado** el extracto `urbano-denso#2`, **cuando** se cuentan sus plantillas casteadas, **entonces** son al menos 6 de 6, como antes de esta fila.
- **Dado** el extracto `costero#1` y el `costero#2`, **cuando** se cuentan sus parajes, **entonces** son 5 en cada uno, que es el cupo de la celda.
- **Dado** cada uno de los ocho extractos, **cuando** se comparan sus recuentos de parajes y de servicios con los de antes de esta fila, **entonces** ninguno tiene menos de ninguno de los dos.
- **Dado** un extracto de referencia regenerado, **cuando** el paquete genera ese mismo mundo y se extrae de él lo mismo, **entonces** el resultado es idéntico al extracto commiteado.
- **Dado** un extracto de referencia regenerado, **cuando** se lee su cabecera, **entonces** declara que esta iteración lo regeneró y por qué.

### Criterios de la base que se mantienen

Se citan porque son los confundibles con los derogados de abajo, y siguen vigentes palabra por palabra:

> **Dado** una etiqueta con más de veinte entradas en la celda de las que menos del 10 % tiene nombre, **cuando** se construye el pool, **entonces** esa etiqueta se descarta entera para esa celda.

> **Dado** el mundo congelado urbano denso, que trae 78 `amenity=fountain` con 27 nombradas, **cuando** se construye el pool, **entonces** la etiqueta no se descarta por la regla anterior.

> **Dado** el mundo congelado urbano denso, que trae 86 `amenity=drinking_water`, **cuando** se construye el pool, **entonces** el pool no contiene ninguna.

> **Dado** el mundo congelado urbano denso, que trae 769 locales de adultos y bares de copas, **cuando** se construye el pool, **entonces** ninguno de ellos aparece en el pool.

> **Dado** el mundo congelado urbano denso, **cuando** se generan los parajes sobre el pool, **entonces** los tipos de paraje siguen repartidos y ninguno se lleva más de la mitad.

> **Dado** una celda cuyo pool de OSM se queda corto para la demanda, **cuando** se ofrece una fuente de Places, **entonces** entran como mucho las entradas que faltan para alcanzar la demanda.

> **Dado** los mismos datos crudos y la misma semilla, **cuando** se construye el pool dos veces, **entonces** los dos pools son idénticos elemento a elemento y en el mismo orden.

Y con ellos, íntegros, el catálogo de admisión, las cuatro familias del filtro de tipos problemáticos, el uso único con su error al tomar dos veces, la exclusión por identificador, la deduplicación a 25 m con Places, la puntuación de candidatos y el sufijo de fase propio del pool.

### Criterios derogados

Cuatro, todos del grupo «La regla del reconocimiento» y «Google Places como relleno» de la spec base, y todos por la misma razón: describen los topes como un recorte del pool.

> **Dado** un pool ya admitido, **cuando** se cuenta cuántos anclajes aporta cada etiqueta `clave=valor`, **entonces** ninguna supera el 25 % del total.

El criterio "Dado un pool ya admitido, cuando se cuenta cuántos anclajes aporta cada etiqueta `clave=valor`, entonces ninguna supera el 25 % del total" **queda obsoleto y debe entenderse derogado** por esta iteración. El comportamiento esperado del implementador y de la suite QA es el del criterio nuevo de arriba: el 25 % se mide sobre los candidatos que se ofrecen a la fase que reparte, y el pool no tiene tope ninguno.

> **Dado** un pool ya admitido, **cuando** se cuenta cuántos anclajes aporta cada `kind`, **entonces** ninguno supera el 40 % del total.

El criterio "Dado un pool ya admitido, cuando se cuenta cuántos anclajes aporta cada `kind`, entonces ninguno supera el 40 % del total" **queda obsoleto y debe entenderse derogado** por esta iteración. El 40 % pasa igualmente al reparto.

> **Dado** una celda cuyo pool bajaría del suelo de la demanda al aplicar los topes, **cuando** se construye el pool, **entonces** los topes se relajan lo justo para alcanzar el suelo y el pool declara que se relajaron.

El criterio "Dado una celda cuyo pool bajaría del suelo de la demanda al aplicar los topes, cuando se construye el pool, entonces los topes se relajan lo justo para alcanzar el suelo y el pool declara que se relajaron" **queda obsoleto y debe entenderse derogado** por esta iteración. La relajación deja de ser una escalera contra el suelo de la celda y pasa a ser inmediata contra el cupo de la fase que reparte, y quien la declara es el mundo generado.

> **Dado** una fuente de Places que devuelve solo categorías de negocio pequeño, **cuando** se construye el pool, **entonces** se le aplican los mismos topes por etiqueta y por `kind` que a OSM.

El criterio "Dado una fuente de Places que devuelve solo categorías de negocio pequeño, cuando se construye el pool, entonces se le aplican los mismos topes por etiqueta y por `kind` que a OSM" **queda obsoleto y debe entenderse derogado** por esta iteración. Lo que se exige ahora es que el reparto trate igual a los candidatos de las dos fuentes, que es donde viven los topes a partir de aquí.

Ningún otro criterio de la base se deroga.

## Notas técnicas

- **Ficheros afectados.** `packages/nucleo/world/anclajes.js` —`recorta`, `aplicaTopes` y `ESCALONES_DE_TOPE` salen de la admisión; `TOPE_POR_ETIQUETA` y `TOPE_POR_KIND` se quedan como los valores que consume el reparto—, `packages/nucleo/world/build.js` y `packages/nucleo/world/parajes.js`, que son donde se reparten los anclajes libres, y `test/fixtures/mundos-referencia/`, cuyos ocho extractos hay que regenerar. Si el reparto necesita una función común, su sitio es `anclajes.js`, que es de quien es la regla.
- **Antes y después, en una línea.** Antes: el pool se amputa por porcentaje antes de que existan núcleos y calzadas, y se relaja solo si baja del cupo de parajes. Después: el pool entra entero, y el porcentaje ordena y recorta a los candidatos de la fase que reparte, deteniéndose en su cupo.
- **Lo que se mantiene explícitamente.** El catálogo de admisión con sus pesos y sus `cat`; las cuatro familias de `TIPOS_PROBLEMATICOS` y que `abandoned:*` entra y `demolished:*` no; `ETIQUETAS_SIN_RECONOCIMIENTO` con `amenity=drinking_water` dentro; `ENTRADAS_PARA_EXIGIR_NOMBRE` en 20 y `FRACCION_NOMBRADAS_MINIMA` en 0,10; `RADIO_DEDUPLICACION_M` en 25; `ROLES_CONSUMIDORES` y el error de doble toma; `TIPOS_DE_PLACES`; `PUNTOS` y la penalización de −100 por caer dentro del radio urbano; y el sufijo de fase del pool, que no se renombra.
- **La demanda sigue saliendo del radio, y esto es lo importante que no hay que deshacer.** `demandaDeAnclajes(radius)` lee los cupos declarados por `settlements.js` y `parajes.js` a partir del radio del mundo, nunca del tramo de quien juega. El cupo que usa el reparto para saber dónde parar el recorte se deriva de la misma manera. Inyectar la demanda desde los cupos del tramo ataría el contenido del mundo al andar de cada persona y rompería «Dos partidas con la misma semilla y tramos distintos generan el mismo mundo», que es escenario `@determinismo` y por tanto bloqueante.
- **Impacto en la frontera del núcleo: no.** Ni entradas nuevas ni salidas nuevas. `construyePool` conserva su firma; lo que cambia es lo que hace por dentro y qué declara el resumen del mundo.
- **Retrocompatibilidad: no la hay, y es el objetivo.** Los mundos generados cambian: mismas semillas, mismos datos, otros anclajes en núcleos y parajes. Nada persistido depende todavía de ellos —la capa de partida es la fila 9 y no existe—, así que lo único que hay que rehacer son los ocho extractos de referencia, en el mismo commit que el cambio. Si al regenerarlos algún extracto castea menos que antes de esta fila, **no se ajusta el extracto**: la entrega no cumple y hay que escalar.
- **Las calzadas quedan deliberadamente fuera de la no-regresión.** El trazado depende de dónde nacen los núcleos, y un reparto mejor puede acabar trazando una calzada menos sin que el mundo empeore: medido, `costero#1` pasa de 11 a 10 calzadas y sube de 3/6 a 6/6 casteadas. Afirmar el recuento de calzadas convertiría una mejora en un rojo.
- **Los porcentajes no contradicen `game-design/`.** `parajes.md` exige que ningún tag masivo monopolice el pool y no da ningún número: el 25 % y el 40 % son decisiones asumidas de SPEC-005, así que moverlos de sitio no obliga a tocar el documento de diseño. La medición de esta iteración se anota en `docs/starting.md` al cerrar la fila, que es de quien orquesta.
- **Batería de aceptación.** «Un tag masivo no monopoliza un tipo de paraje» sigue siendo el escenario de `docs/testing.md` que cubre la parte de diversidad, y sigue en verde con la regla nueva. La no-regresión de casteabilidad no tiene escenario en la batería y es el hueco más grande que esta iteración deja: es de nivel `@nucleo`, se ejecuta con `node --test` sobre los mundos congelados sin red ni dispositivo, y se registra en `test/spec-test-map.json` marcado como hueco, con la nota de que merece característica propia en la batería —«El generador no empeora entrega a entrega»— porque es el único caso que mide salud y no corrección.
- **Dependencias:** la spec base `docs/specs/SPEC-005-pool-anclajes-filtros.md`; por debajo, `SPEC-002` y su iteración —orden estable de la entrada, del que depende que el reparto sea reproducible— y `SPEC-001`, que aporta los mundos congelados y los extractos de referencia.
- **Verificación manual tras la entrega:** (1) `bash scripts/qa-tester-run.sh SPEC-005-iter-1` y comprobar que sigue en verde; (2) sumar las plantillas casteadas de los ocho extractos regenerados y comprobar que dan 21 o más; (3) `git diff` sobre `test/fixtures/mundos-referencia/` y comprobar que `costero#1` y `costero#2` vuelven a tener 5 parajes y que `urbano-denso#2` vuelve a castear 6; (4) `node server.mjs`, generar en 42.40, -8.81 y comprobar a ojo que el mapa no se llena de parajes del mismo tipo.

## Decisiones asumidas

- **El tope se aplica a los candidatos que se ofrecen a la fase que reparte, y no a los que la fase acaba eligiendo** → asumido (alternativa: limitar la composición del resultado, es decir, que de los 5 parajes elegidos ninguna etiqueta aporte más del 25 %). Regla: con cupos de 4 o 5, el 25 % de lo elegido es un anclaje por etiqueta, un tope tan duro que volvería a competir con la jugabilidad por la puerta de atrás; sobre los candidatos, el tope ordena la oferta y deja que la fase decida. Medido: 23/48 con esta forma, frente a 17/48 hoy.
- **El suelo del recorte es el cupo de la fase que reparte, sin holgura añadida** → asumido (alternativa: un múltiplo del cupo, del orden de 1,5 o 2, para que la fase tenga de dónde elegir tras descartar candidatos por distancia o por caer en casco urbano). Regla: con el pool ya sin amputar, la holgura la aporta el propio pool; medido, el cupo pelado basta para recuperar la casteabilidad y añadir un factor sería un número sin medición detrás.
- **La relajación es inmediata y no escalonada** → asumido (alternativa: conservar la escalera `ESCALONES_DE_TOPE` con sus cuatro peldaños). Regla: la escalera es exactamente lo que hizo que la relajación llegara tarde, porque cada peldaño vuelve a recortar antes de comprobar; deteniendo el recorte en el cupo, el resultado es el mismo con una sola pasada y sin un umbral intermedio que explicar.
- **Los porcentajes se quedan en 25 % y 40 %** → asumido (alternativa: aprovechar la iteración para subirlos, ya que el instrumento cambia de sitio). Regla: mover dos cosas a la vez impide saber cuál arregló qué; con el cambio de sitio ya medido, tocar el valor sería una decisión sin dato.
- **El umbral de no-regresión se escribe como número absoluto, 21 de 48** → asumido (alternativa: escribirlo como «no menos que la ejecución anterior», leyendo el valor de los extractos commiteados). Regla: un umbral relativo a lo commiteado se puede satisfacer regenerando los extractos, que es justo el agujero por el que se coló este defecto; un número en la spec obliga a que bajarlo sea una decisión explícita y no un efecto secundario. Cuando el catálogo de plantillas o los mundos congelados cambien, el número se sube por iteración.
- **La no-regresión se afirma también por mundo, y no solo en el agregado** → asumido (alternativa: solo el agregado). Regla: un agregado puede quedarse igual repartiendo una subida y una bajada, y `urbano-denso#2` cayendo de 6 a 3 con `costero` subiendo lo habría escondido.
- **La no-regresión cubre parajes y servicios, pero no calzadas ni núcleos** → asumido (alternativa: afirmar los cuatro recuentos). Regla: está medido que un reparto mejor puede trazar una calzada menos; parajes y servicios son consumo directo del pool y ahí una bajada sí señala que el pool se quedó corto.
- **Quien declara que el reparto se saltó los topes es el mundo generado, no el pool** → asumido (alternativa: conservar `topesRelajados` en el resumen del pool). Regla: a partir de esta iteración el pool no aplica topes, así que no puede declarar una relajación que no es suya; la fase que reparte sí sabe si tuvo que saltárselos y por qué.
- **Los criterios de aceptación van en Gherkin español**, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md`, como en la spec base.
- **Sin sección de UX Design ni de comportamiento responsive** → esta iteración no toca interfaz: el pool es una pieza del núcleo determinista y el jugador solo la ve de rebote.
