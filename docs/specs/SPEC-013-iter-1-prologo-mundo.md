# SPEC-013-iter-1 — El par compuesto tiene que ser un par por el que se pueda pasar

## Descripción

Iteración de corrección de defecto sobre la implementación de SPEC-013. La desencadena una escalada de `wa-dev` medida sobre los ocho extractos de referencia: el prólogo compone su par al primer intento en todos ellos, y en ninguno hay una sola aventura que pase por los dos núcleos, así que el filtro de la primera aventura degrada siempre. RF-QUEST-014 —que la primera aventura pase por los dos núcleos del par— se cumple de forma vacía: el código hace lo que la spec pide y la puesta en escena que `game-design/arranque.md` §2 diseñó no ocurre nunca.

Lo que cambia es una sola cosa, la cuarta cláusula de la condición de composición. Hoy exige que exista **un recorrido** que pase por los dos núcleos y quepa en algún tamaño de salida, y eso lo cumple casi cualquier pareja de un mapa pequeño, porque un recorrido por el grafo existe siempre que los dos sean alcanzables. Pasa a exigir que exista **una aventura del reparto del mapa con un beat en cada uno de los dos**, con el mismo predicado de «pasar por» que usa el filtro de la primera aventura. Un par que no la tenga no vale y el prólogo se resiembra.

Y se añade lo que faltaba para que el defecto no vuelva a esconderse: un criterio que afirma que **la puesta en escena ocurre**, medido sobre los mundos congelados de referencia, y no solo que se intentaría si se pudiera. Un criterio que dice «pasa por el par si puede» es indistinguible de un criterio que nunca se ejerce, que es exactamente la familia de fallo que `pipeline/decisiones-orquestador.md` §6h lleva cuatro apariciones documentando: una pieza que, al no estar, no protesta.

No cambia nada más. Sigue sin haber interfaz. La degradación sigue siendo **abrir, no fallar**: agotado el tope de intentos, el mundo conserva el prólogo del último, no hay par compuesto, la lista del día 1 se compone con la regla normal del casting y el juego no menciona en ningún sitio que faltó algo. Los parámetros declarados mantienen sus valores por defecto y su condición de supuestos de trabajo pendientes de medir. El motor de pasos, la propagación y el catálogo de sucesos del prólogo se consumen igual que en la base.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse, y aquí es **una corrección de la condición de composición del prólogo y del corte del bucle de intentos**: lógica de negocio, sin UI y sin datos nuevos.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- **No cambia la frontera de inyección del núcleo ni las dependencias.** Las tres entradas que declaró la base —el motor de pasos con contador propio, el nacimiento de rumor sin aventura detrás y la cola de entregas sembrada— siguen igual y no se añade ninguna. Lo que la cláusula nueva necesita para comprobarse ya viaja con el mundo congelado: el casting del mapa con sus beats y su encuadre (SPEC-009, SPEC-010) y el reparto que se traza sobre él (SPEC-008). Tampoco cambia la forma serializada del estado del arranque.
- **Fuera de alcance, y solo el delta:** el **motor de pasos** (fila 11) y la **propagación con su deformación y lo que sedimenta** (fila 12), que no se tocan ni un carácter; el **catálogo de sucesos del prólogo** —cuáles son, cuántos, dónde nacen y con qué signo—, que se queda como está; el **casting** y el **catálogo de plantillas** (filas 10 y 17), que aquí se **leen** y no se modifican, ni se reabre ningún reparto de roles, ni se añade una plantilla para que la puesta en escena salga más fácil; el **hito de fin de arranque** (fila 36) con su estado, su marca única y su condición de cierre, que esta iteración no roza; los **valores** de `TOPE_PASOS_PROLOGO`, `SUCESOS_PROLOGO`, `INTENTOS_PROLOGO` y `ENTREGAS_PROLOGO`, que siguen siendo los mismos supuestos de trabajo; y **`docs/testing.md`**, que no se edita en esta entrega —los huecos de cobertura que la base anotó siguen anotados y siguen siendo de la batería—.

## Defecto a corregir

### Síntoma

Sobre los ocho extractos de referencia (`test/fixtures/mundos-referencia/`, cuatro mundos congelados por dos semillas), `wa-dev` mide lo siguiente al correr el prólogo implementado:

- El par compuesto sale en **los ocho, al primer intento**. La resiembra no llega a ejercitarse ni una vez.
- En **ninguno de los ocho** existe una aventura casteada con un beat en cada uno de los dos núcleos del par. El filtro de `filtraPrimeraAventura` se queda sin candidatas y **devuelve la lista sin filtrar en todos los casos**.
- Los pares salen típicamente entre granjas y aldeas, que son los núcleos que menos beats alojan: `barrio-tres-calles` no tiene ni un servicio en sus cinco núcleos, y `suelo-250m` tiene seis servicios, uno de cada tipo.

O sea, los dos criterios de la base que cubren esto pasan y no significan nada: «Dado un par de núcleos alcanzables… entonces además se comprueba que existe un recorrido que pasa por los dos y cabe» se cumple siempre, y «Dado un mundo donde ninguna plantilla casteada pasa por los dos núcleos… entonces se compone con la regla normal» es el camino que se recorre siempre. El requisito ancla, RF-QUEST-014, queda satisfecho de forma vacía.

### Causa raíz

Está en `packages/nucleo/partida/arranque.js`, en `componeElPar`, y concretamente en la cuarta cláusula tal y como la spec base la escribió:

```js
const recorridoM = recorridoQuePasaPorLosDos(medida, desde, pa, pb);
if (recorridoM === null || recorridoM > alcanceMaximoM) continue;
```

`recorridoQuePasaPorLosDos` mide ida + trecho + vuelta **sobre el grafo**, y `alcanceMaximoM` es el mayor de los tres tamaños de salida. En un mapa de radio corto, dos núcleos alcanzables cualesquiera cumplen eso casi siempre: la comprobación descarta pares imposibles de andar, no pares imposibles de **usar**. Lo que RF-QUEST-014 necesita no es que quepa un paseo por los dos, sino que exista una aventura que sitúe un beat en cada uno, porque lo que se cuenta en un núcleo aflora al pararse dentro del geofence y no al cruzarlo (RF-BUCLE-006).

La distancia entre las dos cosas no es de matiz. El catálogo de plantillas tiene **un solo rol de tipo granja** (`rescate-en-la-granja`), así que dos granjas no pueden alojar beats de una misma aventura por mucho que las dos sean tipos casteables; y un núcleo sin servicios solo aloja beats por su rol de núcleo, que unas pocas plantillas piden. Los pares que la implementación compone son, casi por construcción, los que ninguna aventura puede recorrer.

La causa de fondo es de la spec, no del implementador: la cláusula 4 se escribió como una comprobación de alcance y se documentó como el blindaje de RF-QUEST-014. `wa-dev` implementó lo que estaba escrito.

### Cambio requerido

Ajuste quirúrgico, en dos ficheros y sin patrones nuevos.

**1. `componeElPar` sustituye su cuarta cláusula.** Donde hoy mide un recorrido sintético, pasa a preguntar si existe **una aventura del reparto del mapa que pasa por los dos núcleos del par**, con estas tres definiciones:

- **«Aventura del reparto»**: una plantilla que castea sobre ese mundo y cuyo lazo cabe en el tamaño de salida con el que se compone la primera lista. Sale del casting que ya viaja con el mundo; no se vuelve a castear nada.
- **«Pasa por un núcleo»**: el mismo predicado que ya usa el filtro de la primera aventura —tener al menos un beat situado allí, `pasaPorNucleo`—, no otro parecido. Que sean el mismo es lo que hace que la condición garantice el resultado en lugar de aproximarlo.
- **Es una cláusula de par, no de núcleo**: hace falta **una sola** aventura con un beat en A y otro en B. Dos aventuras distintas, una por núcleo, no componen.

El recorrido sintético desaparece con la cláusula: el lazo de la aventura ya es un recorrido por el grafo que pasa por los dos y cabe, medido por quien lo va a trazar.

**2. `correPrologo` corta el bucle cuando la condición es inalcanzable por construcción.** Si el mapa no tiene al menos dos núcleos donde alguna aventura del reparto sitúe un beat, ningún intento podrá componer, y gastar los ocho es tiempo tirado en la pantalla más frágil del juego. En ese caso se corre **un solo intento**, se asienta y se termina sin par compuesto, exactamente con la misma degradación silenciosa que ya existe al agotar el tope.

**3. El par sigue siendo propiedad del mundo.** La comprobación se hace sobre el reparto **sin el filtro de oficio**: el oficio no puede entrar en la composición, porque dos partidas con la misma semilla y distinto oficio tienen que seguir componiendo el mismo par. La consecuencia se acepta y se declara: un oficio que deje fuera a la única aventura que pasaba por los dos degrada la puesta en escena, abriendo y en silencio, como cualquier otra degradación de esta spec.

## Criterios de aceptación

En `Dado / Cuando / Entonces`, el mismo Gherkin español de la base y de `docs/testing.md`. Se añaden dos bloques y se deroga un criterio; todo lo demás de SPEC-013 sigue vigente sin cambios.

### La condición de composición exige un par por el que se pueda pasar

- **Dado** un par de núcleos alcanzables que oyeron el mismo suceso en niveles distintos, **cuando** se evalúa la condición de composición, **entonces** se exige además que exista **una aventura del reparto del mapa con al menos un beat en cada uno de los dos**, y sin ella el par no vale.
- **Dado** «una aventura del reparto», **cuando** se resuelve qué significa en esa cláusula, **entonces** es una plantilla que castea sobre ese mundo y cuyo lazo cabe en el tamaño de salida con el que se compone la primera lista de la partida.
- **Dado** «pasa por el núcleo» en la condición de composición, **cuando** se compara con el predicado del filtro de la primera aventura, **entonces** es el mismo y no otro parecido: tener al menos un beat situado en ese núcleo.
- **Dado** un par cuyos dos núcleos alojan beats pero **en aventuras distintas**, **cuando** se evalúa la condición, **entonces** no la cumple: hace falta una sola aventura que pase por los dos.
- **Dado** un par de núcleos en los que ninguna aventura del reparto sitúa un beat —granjas y aldeas sin servicios, que es el caso medido—, **cuando** se evalúa la condición, **entonces** no la cumple y el prólogo se resiembra.
- **Dado** un par que cumple las tres primeras cláusulas y la cuarta, **cuando** se lee el par compuesto, **entonces** trae, además de los dos núcleos y el suceso que comparten, la identidad de la aventura que pasa por los dos.
- **Dado** varios pares que cumplen las cuatro cláusulas en el mismo intento, **cuando** se elige uno, **entonces** se elige por la regla estable ya declarada —el suceso de identidad menor y, dentro de él, la pareja de identificadores de núcleo menor— y no por cuál tenga más aventuras que pasen por los dos.
- **Dado** la comprobación de la cláusula nueva, **cuando** se inspecciona de dónde saca las aventuras, **entonces** las saca del casting que ya viaja con el mundo, sin castear de nuevo por cada par evaluado y sin reabrir ninguna decisión del casting.
- **Dado** dos partidas con la misma semilla y distinto oficio, **cuando** se comparan sus pares compuestos, **entonces** son el mismo: el filtro de oficio no entra en la condición de composición.
- **Dado** un mapa con menos de dos núcleos en los que alguna aventura del reparto sitúe un beat, **cuando** corre el prólogo, **entonces** la condición es inalcanzable por construcción, se corre un solo intento y se termina sin par compuesto, sin gastar el tope entero.
- **Dado** ese mismo caso, **cuando** se mira lo que ve la jugadora, **entonces** no hay aviso, ni texto, ni pantalla que mencione que faltó algo.

### La puesta en escena ocurre de verdad, y se mide

Los mundos congelados de referencia no son iguales de ricos, y el criterio lo dice en lugar de promediar: `costero` y `urbano-denso` castean **6 de 6** plantillas en sus dos semillas, `suelo-250m` castea 2 y 3, y `barrio-tres-calles` castea **1 de 6** y no tiene ni un servicio. Exigir la puesta en escena en los cuatro sería exigir que un mundo sin reparto la produzca.

- **Dado** el mundo congelado `costero`, con cualquiera de sus dos semillas de referencia, **cuando** corre el prólogo y se compone la primera lista con el tamaño de salida con el que se validó el par, **entonces** hay par compuesto y **al menos una candidata de la lista pasa por los dos núcleos del par**.
- **Dado** el mundo congelado `urbano-denso`, con cualquiera de sus dos semillas de referencia, **cuando** corre el prólogo y se compone la primera lista con ese mismo tamaño, **entonces** hay par compuesto y al menos una candidata pasa por los dos núcleos del par.
- **Dado** cualquiera de esos cuatro casos, **cuando** se comprueba si la lista entregada es la degradada, **entonces** no lo es: el filtro se aplicó, dejó candidatas y la lista es un subconjunto en el que toda candidata tiene un beat en cada núcleo del par.
- **Dado** los mundos congelados `barrio-tres-calles` y `suelo-250m`, **cuando** corre el prólogo, **entonces** se acepta que no haya par compuesto: no tienen reparto suficiente y la degradación es el comportamiento correcto, no un fallo.
- **Dado** esos dos mundos sin par compuesto, **cuando** se compone su primera lista, **entonces** se compone con la regla normal del casting, no se queda vacía mientras el mundo tenga alguna aventura que quepa, y ningún texto menciona que la puesta en escena no se pudo hacer.
- **Dado** cualquier mapa con par compuesto, **cuando** se compone la primera lista con el tamaño con el que se validó el par y sin filtro de oficio, **entonces** hay al menos una candidata que pasa por los dos **por construcción**, y el único camino por el que ese caso puede degradar es que el filtro de oficio las quite todas.
- **Dado** un mapa con par compuesto, **cuando** se compone la primera lista con un tamaño de salida menor que aquel con el que se validó el par, **entonces** puede que ninguna candidata pase por los dos, y entonces degrada abriendo y en silencio.
- **Dado** cualquiera de los cuatro mundos congelados y la misma semilla, **cuando** se corre el prólogo dos veces desde cero, **entonces** el par compuesto o su ausencia, la aventura que lo avala y el número de intentos gastados son idénticos.

### Criterios de la base que se mantienen y son confundibles con el derogado

Se citan textuales porque la implementación tiene que seguir cumpliéndolos tal cual:

- «**Dado** un mundo donde ninguna plantilla casteada pasa por los dos núcleos, **cuando** se compone la primera lista, **entonces** se compone con la regla normal del casting y el día no se queda vacío.» Sigue vigente, y ahora solo se alcanza por dos vías: el filtro de oficio, o un tamaño de salida menor que aquel con el que se validó el par.
- «**Dado** el tope agotado, **cuando** se compone la lista de la primera aventura, **entonces** se compone con la regla normal del casting y el día no se queda vacío.» Sigue vigente y es el camino esperado en `barrio-tres-calles` y `suelo-250m`.
- «**Dado** un núcleo a 400 m en línea recta al otro lado de una ría, sin ningún camino por el grafo, **cuando** se pregunta si es alcanzable, **entonces** no lo es.» La alcanzabilidad no la toca esta iteración: sigue resolviéndose sobre el grafo filtrado y nunca en línea recta.

### Criterios derogados

El criterio «**Dado** un par de núcleos alcanzables, **cuando** se evalúa la condición de composición, **entonces** además se comprueba que existe un recorrido que pasa por los dos y cabe en alguno de los tamaños de salida declarados» **queda obsoleto y debe entenderse derogado** por esta iteración. El comportamiento esperado del implementador y de la suite QA es el del criterio nuevo de arriba: la cuarta cláusula exige una aventura del reparto con un beat en cada núcleo, no un recorrido.

El criterio «**Dado** un par que cumple lo del mismo suceso y los niveles distintos pero cuyo recorrido no cabe en ningún tamaño declarado, **cuando** se evalúa la condición, **entonces** no la cumple, y el prólogo se resiembra» **queda obsoleto y debe entenderse derogado** por esta iteración, porque hablaba del mismo recorrido sintético y de «alguno de los tamaños». Lo sustituye: un par sin ninguna aventura del reparto que pase por los dos no cumple la condición, y el prólogo se resiembra.

## Notas técnicas

- **`packages/nucleo/partida/arranque.js` → `componeElPar`.** Antes: cuarta cláusula por `recorridoQuePasaPorLosDos(medida, desde, pa, pb)` contra `alcanceMaximoM`, el mayor de los tres tamaños. Después: cuarta cláusula por «existe una aventura del reparto con un beat en cada núcleo», resuelta con el mismo `pasaPorNucleo` que ya vive en este fichero. El ayudante `recorridoQuePasaPorLosDos` se va con la cláusula que lo justificaba; si algo más lo usara, se queda, pero deja de decidir la composición.
- **La regla de desempate no se toca.** Sigue siendo el suceso de identidad menor y, dentro de él, la pareja de identificadores de núcleo menor. La aventura que avala el par se anota, no se elige: si varias pasan por los dos, la anotada sale de un orden estable declarado y nunca del orden de recorrido de un `Map`, que es lo que `CLAUDE.md` prohíbe.
- **`packages/nucleo/partida/prologo.js` → `correPrologo`.** Recibe el reparto del mapa —o lo deriva del casting del mundo, una sola vez y compartido entre intentos, por la misma razón por la que ya comparte el medidor: **el mundo no cambia entre intentos**— y lo pasa a `componeElPar`. Añade el corte por condición inalcanzable descrito en el cambio 2, que es un corte del bucle y no una excepción.
- **Composición que se mantiene explícitamente:** el prólogo sigue sin importar `buildWorld` ni ninguna fase de la tubería; sigue escribiendo solo en el estado de la partida; el contador de la partida para el mapa sigue en cero al terminar; la resiembra sigue descartando el intento entero sin conservar nada; y la composición y la regla de la primera aventura siguen siendo solo del primer mapa de la partida.
- **Impacto en el estado de partida y en la frontera del núcleo: ninguno.** No hay entradas nuevas que inyectar. El par gana un dato de diagnóstico —qué aventura lo avala— y `congelaArranque` sigue serializando lo mismo que hoy: suceso, núcleos y niveles. Un respaldo escrito antes de esta iteración se carga igual y no hay migración.
- **Retrocompatibilidad.** Una partida ya guardada conserva su par tal cual, sin volver a evaluarse: el prólogo de un mapa se corre una sola vez y una partida cargada no lo vuelve a ejecutar. El efecto de esta iteración se ve en mapas nuevos. Quien quiera comprobar el cambio sobre un mapa viejo, borra la partida y la vuelve a crear.
- **i18n y tracking:** nada. Esta iteración no produce ni un texto destinado a mostrarse, y las cifras del prólogo siguen viviendo en el diagnóstico que no se serializa ni llega a ninguna pantalla.
- **Dependencias:** SPEC-013 (base), SPEC-010 (el casting del que se lee el reparto y los beats), SPEC-008 (el trazado del lazo y el tamaño de salida), SPEC-009 (el mundo congelado que trae su casting con encuadre), SPEC-012 y SPEC-011 (consumidas sin cambios).
- **Coste.** La cláusula nueva no castea nada: lee el casting que ya viaja con el mundo y recorre sus beats. Es más barata que la que sustituye, que pedía tres caminos del grafo por par evaluado. El presupuesto de RNF-PER-001 no se mueve.
- **Verificación manual sugerida tras la entrega:** (1) crear una partida sobre `costero` con la semilla de referencia y comprobar que el par compuesto existe y trae la aventura que lo avala; (2) componer la primera lista con el tamaño de salida por defecto y comprobar que al menos una candidata tiene un beat en cada núcleo del par; (3) repetir sobre `barrio-tres-calles` y comprobar que no hay par, que la lista se compone igual y que no aparece ningún aviso; (4) crear dos partidas con la misma semilla y distinto oficio y comprobar que el par es el mismo.

## Decisiones asumidas

- **«Poder alojar un beat» se resuelve como «alguna aventura del reparto sitúa un beat allí», y no como «tener servicios» ni como «que el tipo del núcleo aparezca en algún rol del catálogo»** → asumido (alternativas: contar servicios, o mirar los tipos que piden los roles de núcleo). Regla: las dos alternativas siguen siendo vacías en el caso medido. El catálogo tiene **un solo rol de tipo granja**, así que dos granjas pasarían el filtro por tipo y jamás podrían alojar beats de una misma aventura; y un núcleo con servicios cuyo tipo no pide ninguna plantilla que castee en ese mundo tampoco aloja nada. Se resuelve contra el reparto real, que es lo único que no miente.
- **La cláusula es de par, no de núcleo: hace falta una sola aventura con un beat en cada uno** → asumido (alternativa: exigir que cada núcleo aloje algún beat, por separado). Regla: RF-QUEST-014 pide que **la primera aventura** pase por los dos; dos aventuras distintas, una por núcleo, no ponen en escena nada, porque la jugadora acepta una.
- **El par se valida contra el tamaño de salida con el que se compone la primera lista, y no contra «alguno de los tres»** → asumido (alternativa: conservar «alguno de los tamaños declarados», como decía la base). Regla: un par que solo cabe en `jornada` no pone nada en escena para quien sale a dar un paseo el día 1; validar contra el tamaño que se va a usar es lo que convierte la condición en una garantía. La consecuencia inversa se declara en un AC: elegir un tamaño menor puede degradar, abriendo y en silencio.
- **El filtro de oficio no entra en la condición de composición** → asumido (alternativa: componer el par contra las aventuras que ese oficio concreto puede recibir). Regla: la base afirma que dos partidas con la misma semilla y distinto oficio tienen prólogos idénticos, porque el prólogo es propiedad del lugar (`arranque.md` §1); meter el oficio derogaría ese criterio y convertiría el pasado del mundo en algo del personaje. Se paga con una degradación posible, declarada y silenciosa.
- **Con menos de dos núcleos con reparto, un solo intento y fin** → asumido (alternativa: gastar los ocho intentos igual, que es lo que hace hoy). Regla: la condición es inalcanzable por construcción y ninguna resiembra la va a alcanzar, porque lo que falta está en el mundo y el mundo no se resiembra. Cambia qué intento queda asentado en esos mapas —el primero en vez del octavo—, lo cual es indiferente para el juego y sigue siendo determinista; ningún criterio de la base lo prohíbe, porque decía «como mucho los intentos del tope».
- **La puesta en escena se exige en `costero` y `urbano-denso`, y se acepta la degradación en `barrio-tres-calles` y `suelo-250m`** → asumido (alternativa: exigirla en los cuatro, o no exigirla en ninguno y quedarse con criterios condicionales). Regla: la casteabilidad medida de los extractos de referencia es 6/6 en los dos primeros y 1/6 y 2-3/6 en los otros dos; `barrio-tres-calles` no tiene ni un servicio en sus cinco núcleos. Exigirla en los cuatro sería pedirle a un mundo sin reparto que produzca una aventura, y no exigirla en ninguno es justamente el criterio vacío que esta iteración corrige. Si `costero` o `urbano-denso` no la produjeran, es un defecto que hay que escalar, no un caso que silenciar.
- **El par anota qué aventura lo avala, y ese dato no se serializa** → asumido (alternativa: no guardarlo, o guardarlo con la partida). Regla: sirve para diagnosticar y para poder afirmar la cláusula desde fuera; guardarlo con la partida obligaría a decidir qué pasa cuando esa plantilla deja de castear, y esta iteración no abre esa puerta. La forma serializada del arranque no cambia.
- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` y de la spec base (alternativa: `GIVEN / WHEN / THEN`). Regla: `CLAUDE.md`, español en todo, y `wa-qa-dev` cruza specs y batería con grep.
- **Sin sección de UX Design** → asumido: la iteración no toca pantalla, igual que la base. A1P5 y A1P7 son de la fila 27 y la cartela del hito, de la 36.
