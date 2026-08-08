# SPEC-009-iter-1 — La precisión de las coordenadas, y el índice que no puede empobrecerse al reescribirse

## Descripción

Iteración de corrección de defecto sobre la implementación de SPEC-009. Dos defectos, los dos medidos sobre la entrega, y los dos con la misma forma: un número que nadie decidió y un campo que nadie echó de menos.

El primero es de tamaño. El documento del mundo urbano denso ocupa **2953,4 KB** frente al presupuesto de **2048 KB** que fija la propia spec: un **44 % de exceso**. El 79 % del documento son dos campos —`geo.callejero` con 1264 KB y `viario.adj` con 1044 KB— y su contenido son dobles de coma flotante escritos con todos sus dígitos, dieciocho caracteres de media por número para describir la esquina de una calle. La spec base ya nombró la palanca y su dirección: se cuantiza **en la generación**, nunca al volcar, porque redondear al escribir rompería el ida y vuelta exacto que es el criterio central de esta capa. Lo que faltaba era el número, y esta iteración lo fija: **un metro, en una constante única**.

El segundo es de datos, y es peor porque corrompe lo que ya estaba guardado. `congelaIndice` saca el título y el idioma del mapa de `primera?.mundo?.title`, es decir, leyendo a través del mundo de una celda. Un mapa que viene de `cargaMapa` tiene fichas sin `mundo` —la carga es perezosa a propósito—, así que volver a guardar su índice, que es exactamente lo que hace `guardaMapa` cada vez que se abre una celda, los reescribe como `null` sin que nada proteste. Basta abrir una celda para perder el título del mapa. Es la degradación silenciosa de `pipeline/decisiones-orquestador.md` §6h por quinta vez: una pieza que, al no estar, no protesta.

Lo que cambia: aparece una constante de precisión que se aplica al proyectar y al medir, los ocho extractos de referencia se regeneran porque los mundos se mueven, y el índice pasa a guardar lo suyo en lugar de derivarlo de una celda que puede no estar cargada. Lo que no cambia: el esquema de los documentos, la versión de formato, la partición en índice más un documento por celda, la frontera de inyección, y todos los criterios de aceptación de la spec base, que siguen vigentes tal cual —ninguno se deroga aquí—.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: una constante de precisión con su aplicación en la fase de generación, la regeneración de los ocho extractos de referencia que esa constante mueve, y la corrección del origen del título y el idioma en el índice del mapa.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- **La frontera del núcleo no se toca**: no aparece ninguna entrada ni ninguna salida nueva. El almacén de la partida y el reloj siguen siendo los dos únicos puntos de inyección, con la misma firma que fijó la spec base, y las dependencias del paquete siguen siendo ninguna.
- **Fuera de alcance:** el esquema cerrado de los documentos y la versión de formato, que siguen siendo los de la entrega base y valen 1 —un documento escrito antes y otro escrito después de esta iteración son el mismo formato, con números distintos dentro—; cambiar la unidad en la que se guardan las coordenadas, que siguen siendo metros relativos al anclaje del mapa y no decímetros ni enteros de otra escala; comprimir, delta-codificar o deduplicar nada del documento, que serían cambios de esquema; recapturar los cuatro extractos de OSM de `test/fixtures/osm/`, que son la entrada y no se mueven; el estado de partida y el registro de hechos de la fila 16; y los tres huecos de recursos de B3 y B4, cuya forma se queda exactamente como está.

## Defecto a corregir

### Defecto 1 — el presupuesto de tamaño se incumple un 44 %

#### Síntoma

El caso **«El documento del mundo urbano denso ocupa menos de 2 MB sin comprimir»** falla. Medido sobre la entrega:

| Fixture | Documento | Presupuesto |
| --- | --- | --- |
| `urbano-denso` | **2953,4 KB** | 2048 KB · **incumple un 44 %** |
| `costero` | 399 KB | cumple |
| `barrio-tres-calles` | 189 KB | cumple |
| `suelo-250m` | 171,6 KB | 200 KB · cumple |
| índice de 20 celdas | 8,4 KB | 100 KB · cumple |

El reparto del documento que incumple: `geo.callejero` **1264 KB** y `viario.adj` **1044 KB**, el **79 %** del total. Medido sobre su contenido: 32 752 números de coordenada en el callejero, con **18,0 caracteres de media**, y 29 468 longitudes de arista, con **17,4 de media**.

#### Causa raíz

No hay ningún redondeo en ninguna parte, y eso es correcto en la capa de congelado —`packages/nucleo/partida/mundo.js` no redondea ni un número, que es lo que hace afirmable el ida y vuelta exacto— pero deja el problema sin dueño aguas arriba. Los metros nacen en dos sitios de `packages/nucleo/core/geo.js`: las coordenadas en `makeProjector().toXY`, que devuelve `(lon - lon0) * kx` con todos los dígitos del doble, y las longitudes en `dist`, que devuelve una hipotenusa irracional. De ahí salen los puntos de `geo.callejero` y los `metros` de cada arista del grafo, y ninguno de los dos pasa por ningún sitio donde alguien haya decidido cuánta precisión tiene sentido guardar.

Dicho de otra manera: el documento guarda la precisión de la aritmética de coma flotante, que no es una decisión de nadie, en lugar de la precisión que el juego necesita, que sí lo es.

#### Cambio requerido

Una constante única, con nombre y comentario que la justifiquen, en `packages/nucleo/core/geo.js`, que es donde nacen los metros; y una función de cuantización a su lado. **Valor: 1 metro.**

Se aplica en la generación y en este orden, que importa: **primero las coordenadas, y las longitudes después sobre las coordenadas ya cuantizadas**. Con ese orden, dos puntos distintos de la rejilla están siempre a un metro o más, así que ninguna longitud entre dos puntos distintos puede quedar en cero; solo dos puntos coincidentes dan cero, que es la verdad a esta resolución.

La capa de congelado **no cambia**: sigue sin redondear nada. Si un número llega sin cuantizar hasta el documento, el arreglo está en la fase que lo produjo, no en el volcado.

Por qué un metro, medido sobre `urbano-denso` con las tres precisiones candidatas de la rejilla decimal:

| Precisión | Documento del urbano denso | Presupuesto |
| --- | --- | --- |
| sin cuantizar (hoy) | 2953,4 KB | incumple un 44 % |
| 0,1 m (decímetro) | **2080,1 KB** | **sigue incumpliendo**, un 1,6 % |
| 1 m (metro) | **1961,3 KB** | cumple, con un 4,2 % de margen |

El decímetro es el punto donde uno esperaría parar y **no llega**: se queda 32 KB por encima del presupuesto que la propia spec fija. Y por debajo del metro no hay nada que el juego pueda distinguir: el geofence con el que se valida una llegada son 30-50 m, el mapa se pinta a unos 10 m por píxel, el tramo se mide en centenares de metros y la anchura de una calle de cuatro carriles son 15 m. Guardar decímetros cuesta 119 KB por celda densa a cambio de precisión que nadie puede percibir, y encima no cabe.

El riesgo conocido y aceptado es el que la propia elección arrastra: **con longitudes de un metro, dos caminos casi iguales pueden empatar en Dijkstra donde antes se ordenaban por centímetros**. No rompe el determinismo —la cuantización ocurre en la generación, el desempate lo sigue resolviendo el mismo orden estable de nodos, y dos ejecuciones iguales siguen dando el mismo mundo—; lo que cambia es qué camino se elige entre dos que difieren en menos de un metro sobre kilómetros, que para quien camina son el mismo camino. Los criterios de salud de más abajo son el guardián de que ese riesgo no se ha convertido en un problema.

**Los ocho extractos de referencia de `test/fixtures/mundos-referencia/` cambian, y eso es esperado**: cuantizar mueve los mundos. Se regeneran como parte de esta entrega, con el mismo criterio que ya sentó `pipeline/decisiones-orquestador.md` §6b —un extracto de referencia es un instrumento de verificación del porte, no un contrato de contenido, y no puede vetar un arreglo—. Lo que no puede moverse es lo que no depende del azar, y va en los criterios.

### Defecto 2 — el índice pierde el título y el idioma en silencio

#### Síntoma

El caso **«El título y el idioma del mapa sobreviven a cargarlo y volver a guardarlo»** falla. La secuencia que lo produce es la de todos los días:

1. Se abre una celda, se guarda el mapa: el índice lleva su título y su idioma.
2. El juego se cierra y se vuelve a abrir; `cargaMapa` levanta el índice y **ninguna celda**, que es lo que la spec base exige.
3. El jugador pisa una celda ya abierta; `cargaCelda` la carga; algo llama a `guardaMapa`, que llama a `guardaIndice` siempre.
4. El índice reescrito trae `titulo: null` e `idioma: null`. El título del mapa se ha perdido, en disco, para siempre, y ninguna excepción se ha lanzado.

#### Causa raíz

`congelaIndice` (`packages/nucleo/partida/mapa.js:231`) deriva los dos campos del mundo de una celda:

```js
const primera = mapa.celdas.slice().sort(ordenPorClave)[0] ?? null;
// ...
titulo: primera?.mundo?.title ?? null,
idioma: primera?.mundo?.locale ?? null,
```

`levantaIndice` sí devuelve `titulo` e `idioma` en el mapa que construye (`mapa.js:309-310`), así que el dato está en memoria y a mano. Pero `congelaIndice` no lo mira: vuelve a derivarlo de la celda. Y las celdas de un mapa cargado son fichas —`{ clave, celda, motivo, sinContenidoJugable, cargada: false }`—, sin `mundo`. El encadenamiento opcional atraviesa esa ausencia sin ruido y el `?? null` la convierte en un valor legítimo del documento, indistinguible de «este mapa no tiene ninguna celda todavía», que es el único caso en el que `null` es la verdad.

Es la misma forma de fallo de §6h, y el propio módulo ya la tenía cerrada un poco más abajo: `mundoDeCelda` existe precisamente para que una ficha no pueda pasar por un registro, y falla nombrando la celda en vez de devolver un mundo vacío. `congelaIndice` se saltó ese contrato.

#### Cambio requerido

Tres cosas, y la tercera es la que cierra la clase.

1. **El índice guarda lo suyo.** El título y el idioma pasan a ser campos del propio mapa, no de una celda: `creaMapa` los deja sin fijar, `registra` los fija con los del mundo de la celda que se registra si esa celda ordena antes que todas las que ya estaban —lo que conserva la regla que el comentario original ya declaraba, que el índice no cambia porque las celdas se abran en otro orden—, y `levantaIndice` los devuelve tal como venían en el documento. `congelaIndice` los lee del mapa y **nunca de `celda.mundo`**.
2. **Volver a guardar no puede empobrecer.** Con lo anterior, un mapa cargado conserva los dos campos y reescribir su índice produce el mismo documento. El criterio que lo afirma es el ciclo completo, no la lectura de un campo.
3. **Leer un campo ausente al escribir un documento es error, no `null`.** En la ruta de congelado, un `null` solo puede salir de un campo que el esquema declara anulable **y** cuyo valor nulo es un estado del mundo —una vía sin nombre, un paraje sin anclaje, un mapa sin ninguna celda abierta—, nunca un estado de la carga. Si el objeto que se congela no tiene un campo que el documento declara obligatorio, se falla nombrándolo. Y ningún campo de un documento se deriva atravesando una estructura que la carga perezosa puede dejar sin rellenar: si hiciera falta el mundo de una celda, se pide con `mundoDeCelda` y se falla nombrando la celda, como ya se hace en `guardaCelda`.

## Criterios de aceptación

En Gherkin español, como el resto de la spec base y de `docs/testing.md`. **Ninguno de los criterios de la spec base se deroga**: los de aquí se suman a los suyos, y los del ida y vuelta exacto y el esquema cerrado siguen siendo el contrato que esta iteración no puede romper.

### La precisión es una constante única

- **Dado** el paquete entregado, **cuando** se busca de dónde sale la precisión con la que se guardan los metros, **entonces** hay **una sola constante**, con su justificación escrita al lado, y ningún otro número de precisión repartido por el código.
- **Dado** el paquete entregado, **cuando** se recorren las fases de generación, **entonces** todas cuantizan con esa constante y ninguna redondea por su cuenta.
- **Dado** el módulo de congelado, **cuando** se recorre lo que hace con los números, **entonces** no redondea ni uno: escribe lo que le llega, que es lo que hace afirmable el ida y vuelta exacto.
- **Dado** un documento de celda, **cuando** se recorre cualquier número que esté en metros, **entonces** es múltiplo exacto de la constante.
- **Dado** un mundo generado, **cuando** se mide la longitud de una arista entre dos puntos distintos, **entonces** no es cero: las longitudes se calculan sobre coordenadas ya cuantizadas.
- **Dado** un documento de celda, **cuando** se leen las coordenadas en grados de su cabecera —anclaje, centro, esquinas— y los extremos de las costuras del índice, **entonces** la constante no los ha tocado: gobierna los metros y solo los metros.

### El presupuesto se cumple

- **Dado** el mundo congelado urbano denso, **cuando** se genera su celda y se congela, **entonces** el documento ocupa menos de 2 MB sin comprimir.
- **Dado** el mundo congelado del suelo de 250 m, **cuando** se genera su celda y se congela, **entonces** el documento ocupa menos de 200 KB sin comprimir.
- **Dado** los mundos congelados costero y barrio de tres calles, **cuando** se generan sus celdas y se congelan, **entonces** los dos documentos ocupan menos de 2 MB sin comprimir.
- **Dado** un mapa con veinte celdas abiertas, **cuando** se congela su índice, **entonces** ocupa menos de 100 KB.

### El ida y vuelta sigue siendo exacto

- **Dado** un mundo generado con las coordenadas ya cuantizadas, **cuando** se congela, se levanta y se vuelve a congelar, **entonces** los dos documentos son idénticos byte a byte.
- **Dado** un mundo generado y el mismo mundo levantado desde su documento, **cuando** se comparan campo a campo, **entonces** no hay ninguna diferencia.
- **Dado** un mundo generado y el mismo mundo levantado desde su documento, **cuando** se castean las plantillas contra los dos, **entonces** el resultado del casting es el mismo.
- **Dado** la misma semilla y los mismos datos de OSM, **cuando** se genera el mundo dos veces, **entonces** los dos documentos son idénticos byte a byte.

### Los mundos se mueven, y lo que no depende del azar no

- **Dado** los ocho extractos de referencia, **cuando** se regeneran con la precisión nueva, **entonces** están commiteados y su cabecera sigue declarando su mundo congelado y su semilla.
- **Dado** cada extracto de referencia regenerado, **cuando** se comprueban los cupos por radio, **entonces** los recuentos por tipo siguen cuadrando con `game-design/parametros-mundo.md`.
- **Dado** cada extracto de referencia regenerado, **cuando** se leen su título y su idioma, **entonces** son los que el paquete de idioma de su ubicación produce para su semilla, y no han cambiado.
- **Dado** cada extracto de referencia regenerado, **cuando** se recorren sus nombres, **entonces** no hay dos iguales y ningún lazo de calzadas queda abierto.
- **Dado** los ocho extractos de referencia regenerados, **cuando** se mide la casteabilidad agregada de las plantillas, **entonces** **no baja de 32/48**.

### El índice guarda lo suyo, y volver a guardarlo nunca lo empobrece

- **Dado** un mapa guardado con al menos una celda abierta, **cuando** se carga, se abre una celda y se vuelve a guardar, **entonces** el índice escrito es idéntico byte a byte al que había: **no se ha perdido nada**.
- **Dado** un mapa cargado cuyas celdas son todas fichas sin mundo, **cuando** se congela su índice, **entonces** declara el mismo título y el mismo idioma que declaraba antes de cargarse.
- **Dado** el código que congela el índice, **cuando** se busca de dónde salen sus campos, **entonces** ninguno se deriva del mundo de una celda ni de ninguna otra estructura que la carga perezosa pueda dejar sin rellenar.
- **Dado** un mapa con al menos una celda abierta al que le falta el título o el idioma, **cuando** se congela su índice, **entonces** **falla nombrando el campo**, en lugar de escribir un documento con `null`.
- **Dado** un mapa recién creado sin ninguna celda congelada todavía, **cuando** se congela su índice, **entonces** el título y el idioma son nulos y no hay error: ahí el nulo sí es un estado del mundo.
- **Dado** un mapa con varias celdas, **cuando** se abren en cualquier orden, **entonces** el título y el idioma del índice son siempre los de la celda que ordena primero por su clave.
- **Dado** cualquier documento de esta capa, **cuando** se escribe leyendo un campo obligatorio que no está en el objeto de origen, **entonces** se falla nombrando el campo: **al escribir un documento, un campo ausente es un error y no un `null`**.
- **Dado** un mapa, **cuando** se guarda dos veces seguidas sin abrir ni cargar nada entre medias, **entonces** los dos índices escritos son idénticos byte a byte.

## Notas técnicas

- **Ficheros afectados.** `packages/nucleo/core/geo.js` (la constante, la función de cuantización, `toXY` y `dist`), las fases de generación que producen metros derivados que no pasan por `dist` —revisar `packages/nucleo/world/grafo.js`, `routes.js`, `settlements.js`, `parajes.js` y `costura.js`, y hacer que ninguna se invente su propio redondeo—, `packages/nucleo/partida/mapa.js` (`creaMapa`, `registra`, `levantaIndice`, `congelaIndice`) y los ocho ficheros de `test/fixtures/mundos-referencia/`, que se regeneran. `packages/nucleo/partida/mundo.js` y `formato.js` **no se tocan**.
- **Antes y después, defecto 1.** Antes: `toXY` devuelve `(lon - lon0) * kx` y `dist` devuelve `Math.hypot(...)`, los dos con los diecisiete dígitos del doble. Después: los dos pasan por la cuantización, y `dist` opera sobre puntos ya cuantizados. Es el único cambio de comportamiento numérico de la entrega.
- **Antes y después, defecto 2.** Antes: `titulo: primera?.mundo?.title ?? null`. Después: `titulo` sale del propio mapa, que lo tiene porque `registra` lo fijó al abrir la celda o porque `levantaIndice` lo trajo del documento, y su ausencia con celdas abiertas es un error que nombra el campo.
- **Lo que se mantiene explícitamente.** El esquema cerrado y la versión de formato, que siguen valiendo 1; la partición índice más un documento por celda; que la semilla de la partida no entra en ningún documento y las semillas de costura se recomponen al cargar; que el título y el idioma del índice salen de la celda que ordena primero y no de la primera que se abrió; que las coordenadas se guardan en metros relativos al anclaje del mapa; y que el cosido y la máscara de mar se congelan como dato y no se recalculan.
- **`MISMO_PUNTO_M`.** Con la rejilla de un metro, el umbral de 1 mm de `packages/nucleo/world/grafo.js` pasa a ser en la práctica una comparación de igualdad exacta: dos puntos cuantizados o son el mismo o están a un metro. No hace falta cambiarlo —sigue diciendo lo que quería decir— pero conviene anotarlo donde está, porque su número deja de tener significado propio.
- **Frontera del núcleo.** No cambia: ni una entrada ni una salida nueva, ni una dependencia. La constante es interna al paquete y no se inyecta: cuantizar con un valor distinto en tiempo de ejecución produciría mundos distintos con la misma semilla, que es exactamente lo que RNF-DET-001 prohíbe.
- **Retrocompatibilidad.** Un documento escrito antes de esta iteración sigue siendo formato 1, sigue validando contra el mismo esquema y sigue levantándose sin error: sus números no son múltiplos de la constante y **nada los rechaza**, porque el criterio de multiplicidad se afirma sobre lo que esta entrega escribe, no sobre lo que se lee. Lo que no se conserva es la identidad del mundo: regenerar la misma celda con la misma semilla después de esta entrega produce un mundo ligeramente distinto del que se generó antes. Es el precio anunciado de cuantizar en la generación, no afecta a ningún mapa ya congelado —que por definición no se regenera— y para el prototipo no hay ninguna partida en producción que proteger. El índice reescrito por la versión anterior con `titulo: null` no se repara solo: se recupera cuando se vuelve a abrir el mapa con esta versión y se registra una celda, y no hace falta migración porque el campo ya existe y es anulable.
- **Dependencias.** `SPEC-009` (la spec base, íntegra y sin ningún criterio derogado), `SPEC-003` para el anclaje redondeado y los índices de celda, `SPEC-007` para las marcas de suposición del cosido, y `pipeline/decisiones-orquestador.md` §6b (los extractos de referencia no vetan un arreglo) y §6h (la degradación silenciosa se cierra por contrato, no por vigilancia).
- **Verificación manual tras la entrega.** 1) Generar la celda del urbano denso y medir el documento: por debajo de 2048 KB. 2) Abrir un documento y comprobar a ojo que las coordenadas del callejero son metros enteros. 3) Guardar un mapa, cerrarlo, cargarlo, abrir una celda, volver a guardar y comparar el índice con el original: idéntico. 4) Correr `node test/casting-report.mjs` y comprobar que la casteabilidad agregada sigue en 32/48 o por encima.

## Decisiones asumidas

- **La precisión es de un metro y no de un decímetro** → asumido (alternativa: 0,1 m, que es el punto donde uno esperaría parar). Regla: medido sobre `urbano-denso`, el decímetro deja el documento en 2080,1 KB y el presupuesto de la propia spec son 2048 KB, así que **no cumple**; el metro lo deja en 1961,3 KB, con un 4,2 % de margen. Y por debajo del metro no hay nada que el juego distinga: el geofence son 30-50 m y el mapa se pinta a unos 10 m por píxel. El coste aceptado es que dos rutas que difieren en menos de un metro pueden empatar en Dijkstra, cosa que el criterio de casteabilidad ≥ 32/48 vigila.
- **La constante es un paso de la rejilla decimal y no un número de dígitos significativos** → asumido (alternativa: `toPrecision`). Regla: con dígitos significativos la precisión absoluta depende de lo lejos que esté el punto del anclaje, así que dos esquinas iguales de dos celdas distintas se guardarían con precisión distinta; con un paso fijo, la rejilla es la misma en todo el mapa y el texto es igual de corto en todas partes.
- **La constante vive en `core/geo.js` y no se inyecta** → asumido (alternativa: pasarla por la frontera para poder afinarla). Regla: cuantizar distinto produce mundos distintos con la misma semilla, y eso convierte un parámetro de configuración en una fuente de indeterminismo.
- **Se cuantizan primero las coordenadas y después las longitudes sobre ellas** → asumido (alternativa: cuantizar las longitudes sobre las coordenadas originales). Regla: con este orden, dos puntos distintos están siempre a un metro o más y ninguna longitud entre puntos distintos puede quedar en cero; con el otro, una arista corta puede desaparecer del grafo por redondeo.
- **La unidad del documento sigue siendo el metro** → asumido (alternativa: guardar enteros de decímetro, que ahorraría un carácter por número y permitiría conservar el decímetro dentro del presupuesto). Regla: la spec base afirma en un criterio que las coordenadas del documento están en metros, y cambiar la unidad es un cambio de esquema, que esta iteración deja explícitamente fuera de alcance.
- **Los ocho extractos de referencia se regeneran y se commitean** → asumido (alternativa: escalar el cambio de recuentos en lugar de aceptarlo). Regla: `pipeline/decisiones-orquestador.md` §6b ya lo decidió —un extracto es un instrumento de verificación del porte, no un contrato de contenido— y esta iteración exige en su lugar que lo que no depende del azar siga cuadrando.
- **Los grados no se cuantizan** → asumido (alternativa: aplicarles también una precisión). Regla: en un documento solo hay grados en la cabecera y en los extremos de las costuras, y están medidos —el índice de veinte celdas ocupa 8,4 KB de los 100 KB de su presupuesto—, así que no pesan; redondear el anclaje, además, movería el identificador del mapa, que SPEC-003 fija.
- **El título y el idioma pasan a ser campos del mapa en memoria** → asumido (alternativa: seguir derivándolos de la celda, pero exigiendo que esté cargada). Regla: exigir la carga convertiría `guardaMapa` sobre un mapa cargado en un error, y ese mapa es el caso normal; guardar el dato en el mapa es lo que permite que reescribir el índice no lo empobrezca nunca.
- **El nulo sigue siendo legítimo en un índice sin ninguna celda** → asumido (alternativa: no escribir el campo, o hacer fallar el congelado). Regla: la spec base tiene un criterio para el mapa recién creado sin celdas y el esquema ya declara los dos campos anulables; lo que se prohíbe no es el nulo, sino el nulo que sale de no haber cargado algo.
- **La retrocompatibilidad se afirma en la lectura y no en la escritura** → asumido (alternativa: rechazar documentos con números sin cuantizar). Regla: rechazarlos sería una migración encubierta, y la migración entre versiones del formato es de la fila 39; además el formato no ha cambiado, solo los números que se escriben en él.
