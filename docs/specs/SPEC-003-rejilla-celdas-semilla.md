# SPEC-003 — La rejilla de celdas y la semilla

## Descripción

Define de qué está hecho un mapa antes de que haya nada dentro: la semilla de la partida, que lleva al jugador dentro y sin la cual su mundo no se puede reconstruir, y la rejilla de celdas fijas sobre la que se genera. Una celda es un mapa entero, se dimensiona en tramos del jugador y se ancla a una coordenada redondeada cercana al arranque, nunca a la posición exacta. Crecer no es regenerar: es abrir otra celda, por pisarla o como acontecimiento al completar la propia, y coser las calzadas en el borde que comparten.

No tiene interfaz de usuario. La pantalla donde el jugador decide dónde se levanta el mapa (`flujo: A1P4`) la implementa la fila 27 del checklist (`onboarding-arranque`); esta spec entrega lo que esa pantalla consume y lo que el resto del generador da por supuesto.

Anclas: **RF-MUNDO-001**, **RF-MUNDO-002**, **RF-MUNDO-003**, **RF-MUNDO-004** y **RF-MUNDO-005** (`docs/prd.md` §4.1), con **RNF-DET-001** y **RNF-DET-003** (§5.1) como los invariantes que gobiernan toda la spec, y `game-design/alcance-del-mundo.md` §1 y §2 como fuente — el diseño manda sobre el PRD y sobre esta spec.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Esta spec no tiene interfaz y no dibuja ninguna pantalla.** A1P4 está dibujada y es de la fila 27; aquí solo se entrega lo que esa pantalla necesita recibir del núcleo (el anclaje redondeado, el radio del círculo de alcance y el aviso del suelo del tramo). Si al implementar aparece la tentación de añadir un componente, una vista o un texto de pantalla, la entrega está mal.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «La semilla de la partida», «La rejilla y su anclaje» y «Generación de una celda»; la validación de entradas, en el alfabeto y el dígito de control de la semilla, en el tramo declarado y en los índices de celda; el estado vacío, en la celda sin nada dentro, en la costura de una celda cuya vecina aún no existe y en el mapa sin ninguna celda abierta; el estado de error, en la consulta de OSM que falla a mitad, en la semilla ausente y en el tramo por debajo del suelo; y los casos límite, en el borde exacto entre dos celdas, en el jugador que aparece lejos de todo, en la celda ya abierta que se vuelve a pisar y en el acontecimiento sin vecinas libres.

### La semilla de la partida

- **Dado** una partida nueva y una fuente de entropía inyectada, **cuando** se crea la semilla, **entonces** se obtiene una cadena de 16 símbolos del alfabeto declarado, presentada en cuatro grupos de cuatro separados por guiones.
- **Dado** dos partidas creadas con entropía distinta en la misma calle, **cuando** se comparan sus semillas, **entonces** son distintas.
- **Dado** dos partidas con semillas distintas, el mismo anclaje y los mismos datos de OSM, **cuando** se genera la celda «0,0» de cada una, **entonces** difieren en los nombres de al menos un núcleo.
- **Dado** una semilla creada, **cuando** se inspecciona su contenido, **entonces** no contiene ninguna coordenada, ninguna fecha ni ningún identificador del dispositivo.
- **Dado** una semilla escrita en minúsculas, con espacios y sin guiones, **cuando** se normaliza, **entonces** da la misma semilla canónica que la escrita en su forma de presentación.
- **Dado** una semilla en la que se ha tecleado `I` por `1` o `O` por `0`, **cuando** se normaliza, **entonces** se acepta y da la misma semilla canónica.
- **Dado** una cadena con un símbolo fuera del alfabeto declarado, **cuando** se valida como semilla, **entonces** se rechaza nombrando el símbolo que sobra.
- **Dado** una cadena del alfabeto y la longitud correctos pero con un símbolo cambiado, **cuando** se valida como semilla, **entonces** el dígito de control la rechaza como mal copiada.
- **Dado** una cadena más corta o más larga de 16 símbolos, **cuando** se valida como semilla, **entonces** se rechaza nombrando la longitud esperada.
- **Dado** la creación de la semilla, **cuando** se inspecciona su implementación, **entonces** la entropía llega inyectada y no se usa `Math.random()` ni ninguna lectura del reloj del sistema.
- **Dado** una semilla y una celda, **cuando** se piden las semillas de fase, **entonces** cada fase de la tubería recibe un sufijo propio y estable.
- **Dado** dos celdas distintas del mismo mapa, **cuando** se comparan sus semillas para la misma fase, **entonces** son distintas.
- **Dado** dos mapas distintos de la misma partida, **cuando** se comparan las semillas de la misma celda y la misma fase, **entonces** son distintas.
- **Dado** una semilla ausente o vacía, **cuando** se pide generar una celda, **entonces** falla nombrando la semilla que falta, en lugar de generar con una semilla por defecto.

### La rejilla y su anclaje

- **Dado** la coordenada que llega de A1P4, **cuando** se levanta el mapa, **entonces** la rejilla queda anclada a esa coordenada redondeada al paso declarado y no a la coordenada recibida.
- **Dado** dos coordenadas distintas dentro del mismo paso de redondeo, **cuando** se levanta un mapa con cada una, **entonces** las dos rejillas quedan con el mismo anclaje.
- **Dado** un mapa levantado, **cuando** se inspecciona todo lo que queda registrado de su rejilla, **entonces** no aparece la coordenada exacta con la que se levantó.
- **Dado** un mapa levantado, **cuando** se pregunta en qué celda cae una posición, **entonces** se obtiene un índice entero de dos componentes.
- **Dado** la misma posición preguntada dos veces, **cuando** se resuelve su celda, **entonces** se obtiene siempre el mismo índice.
- **Dado** una posición que cae exactamente sobre el borde entre dos celdas, **cuando** se resuelve su celda, **entonces** se obtiene una sola, según la regla declarada de bordes.
- **Dado** dos celdas contiguas, **cuando** se comparan sus límites, **entonces** comparten el borde exactamente, sin solape ni hueco.
- **Dado** una rejilla anclada, **cuando** el jugador se mueve o cambia cualquier ajuste, **entonces** el anclaje no cambia nunca.
- **Dado** un índice de celda, **cuando** se piden sus límites, **entonces** salen sus cuatro esquinas en coordenadas geográficas sin depender de dónde esté el jugador.
- **Dado** un índice de celda que no es un par de enteros, **cuando** se piden sus límites, **entonces** falla nombrando el índice mal formado.

### El dimensionado de la celda en tramos

- **Dado** un tramo declarado, **cuando** se dimensiona la celda, **entonces** su lado mide los tramos que fija el parámetro de dimensionado y su radio inscrito mide un tramo.
- **Dado** un jugador con un tramo de 2 km y otro con un tramo de 600 m, **cuando** se levantan sus mapas, **entonces** las dos celdas tienen la misma forma y distinto tamaño en metros.
- **Dado** una celda dimensionada con cualquier tramo por encima del suelo declarado, **cuando** se generan sus parajes, **entonces** su número es mayor o igual que el suelo derivado del catálogo.
- **Dado** un tramo por debajo del suelo declarado, **cuando** se levanta el mapa, **entonces** la celda se dimensiona con el suelo y el núcleo lo declara al llamante, en vez de producir un mundo más pequeño de lo jugable.
- **Dado** un tramo que no es un número positivo, **cuando** se levanta el mapa, **entonces** falla nombrando el parámetro inválido.
- **Dado** un mapa levantado, **cuando** el tramo del jugador cambia, **entonces** el lado de celda de ese mapa no cambia, ni para las celdas abiertas ni para las que se abran después.
- **Dado** un mapa nuevo levantado más tarde, **cuando** se dimensiona, **entonces** usa el tramo vigente en ese momento y no el del mapa anterior.
- **Dado** el parámetro de dimensionado, **cuando** se lee el código, **entonces** aparece una sola vez, con su valor por defecto y su justificación escrita, y ninguna fase lo recalcula por su cuenta.

### Generación de una celda

- **Dado** una semilla, un índice de celda y unos datos de OSM congelados, **cuando** se genera la celda dos veces, **entonces** las dos son idénticas byte a byte.
- **Dado** los mismos datos de OSM entregados en otro orden de llegada, **cuando** se genera la celda, **entonces** el resultado es idéntico.
- **Dado** la generación de una celda, **cuando** se ejecuta con el reloj del sistema fijado en instantes distintos, **entonces** el resultado no cambia.
- **Dado** la generación de una celda, **cuando** se cambia la implementación de una sola fase, **entonces** las demás fases salen idénticas a las de antes.
- **Dado** una celda generada, **cuando** se inspecciona, **entonces** lleva registrados su índice, su lado en metros, el anclaje de la rejilla, la semilla de partida y el identificador del mapa.
- **Dado** unos datos de OSM sin ninguna calle ni ningún anclaje dentro de la celda, **cuando** se genera, **entonces** la celda se crea igual, con sus límites, y queda marcada como sin contenido jugable.
- **Dado** una consulta de datos de OSM que falla a mitad, **cuando** se pide generar la celda, **entonces** no queda ninguna celda a medias registrada como abierta.
- **Dado** una celda ya generada, **cuando** se pide generarla otra vez, **entonces** se devuelve la que ya existe y no se genera nada nuevo.
- **Dado** una celda entregada al llamante, **cuando** este intenta modificar su contenido, **entonces** la celda registrada en el mapa no cambia.

### Apertura de celdas vecinas

- **Dado** un mapa con la celda «0,0» abierta, **cuando** el jugador pisa la celda «1,0», **entonces** se genera y queda registrada como abierta por pisarla.
- **Dado** un mapa con la celda «0,0» abierta, **cuando** llega la señal de que esa celda se ha completado, **entonces** se abre una celda contigua y queda registrada como abierta por acontecimiento.
- **Dado** la misma celda abierta por pisarla en una partida y por acontecimiento en otra con la misma semilla y los mismos datos, **cuando** se comparan, **entonces** su contenido es idéntico y solo difiere el motivo registrado.
- **Dado** una celda «0,0» ya generada, **cuando** se abre cualquier vecina, **entonces** la «0,0» sigue idéntica byte a byte.
- **Dado** la señal de celda completada, **cuando** se elige qué vecina se abre, **entonces** la elección sale de la semilla y es la misma en dos ejecuciones iguales.
- **Dado** una celda cuyas cuatro vecinas ya están abiertas, **cuando** llega la señal de completada, **entonces** no se abre ninguna celda nueva y no se anuncia ningún acontecimiento.
- **Dado** un jugador que entra en una celda ya abierta, **cuando** se pisa, **entonces** no se genera nada.
- **Dado** una posición que no cae en ninguna celda abierta ni en ninguna contigua a una abierta, **cuando** se resuelve, **entonces** el núcleo responde que ninguna celda de este mapa la contiene, sin abrir nada.
- **Dado** un mapa sin ninguna celda abierta todavía, **cuando** se consulta su lista de celdas, **entonces** se obtiene una lista vacía y no un error.
- **Dado** una celda abierta, **cuando** se consulta su registro, **entonces** consta por cuál de las dos vías se abrió.

### La costura entre celdas contiguas

- **Dado** dos celdas contiguas abiertas, **cuando** se inspecciona el grafo, **entonces** sus calzadas quedan cosidas en el borde que comparten.
- **Dado** dos celdas contiguas, **cuando** se abren en un orden y después, en otra ejecución, en el orden inverso, **entonces** la costura resultante es idéntica.
- **Dado** dos celdas contiguas, **cuando** se genera su costura, **entonces** ninguna de las dos celdas cambia.
- **Dado** dos calzadas a un lado y a otro del borde separadas por menos del umbral de cosido, **cuando** se cose, **entonces** quedan unidas por una arista marcada como suposición.
- **Dado** dos calzadas a un lado y a otro del borde separadas por más del umbral de cosido, **cuando** se cose, **entonces** no se unen.
- **Dado** una celda abierta cuya vecina todavía no lo está, **cuando** se inspecciona su borde, **entonces** sus calzadas terminan en el borde sin ninguna arista inventada hacia fuera.
- **Dado** dos celdas que no comparten borde, **cuando** se pide su costura, **entonces** se obtiene una costura vacía y no un error.
- **Dado** una costura ya calculada, **cuando** se abre una tercera celda en otro borde, **entonces** la costura anterior no cambia.

### Lo generado no se resiembra jamás

- **Dado** un mundo generado con un tramo declarado de 2 km, **cuando** el jugador cambia su tramo a 600 m, **entonces** el mundo sigue idéntico byte a byte.
- **Dado** un mundo generado y pintado en estilo «reino», **cuando** se cambia el estilo a «pergamino», **entonces** el mundo sigue idéntico byte a byte.
- **Dado** un anclaje real marcado por el jugador como que no vale, **cuando** se marca, **entonces** el resto del mundo sigue idéntico byte a byte.
- **Dado** una partida guardada y vuelta a cargar, **cuando** se comparan sus celdas con las de antes de guardar, **entonces** son idénticas byte a byte.
- **Dado** cualquier operación del juego que no sea abrir una celda nueva, **cuando** se ejecuta, **entonces** ninguna celda ya generada se vuelve a generar.

## Notas técnicas

### Qué entrega esta spec y qué no

Entrega tres piezas del núcleo y nada más: **la semilla** (creación, normalización, validación y derivación de semillas de fase), **la rejilla** (anclaje, dimensionado en tramos, resolución de posición a celda, límites de celda, apertura y registro de celdas abiertas) y **la costura** entre celdas contiguas. Por áreas del paquete: la semilla en `core/`, la rejilla y la costura en `world/`, y el registro de celdas abiertas de un mapa en `partida/`.

Fuera de alcance, con su fila del checklist, para que nadie las implemente aquí de rebote:

| Lo que parece de aquí | Dónde va |
| --- | --- |
| Medir y corregir el tramo del jugador | fila 4, `tramo-personal` (RF-PJ-004) |
| Los cupos por celda de núcleos, servicios y parajes | filas 4 y 6 (RF-MUNDO-007) |
| El pool de anclajes y sus filtros | fila 5 |
| El grafo, el cosido interno del callejero y los ramales | fila 7 (RF-MUNDO-013) |
| Serializar y persistir el mundo congelado y la semilla | fila 9 (RF-PERS-001, RF-PERS-002) |
| Qué significa «completar una celda» | fila 36 (`telon`) y `bucle-jugable.md` §5; aquí llega como señal |
| Que un rumor cruce la costura | pendiente 3 de `alcance-del-mundo.md`, fila 12 |
| La pantalla A1P4 y el aviso del suelo al jugador | fila 27, `onboarding-arranque` |
| La lista de mapas de una partida y el mapa activo | fila 41, `mapas-multiples` |

### Frontera de inyección

Tres entradas inyectadas, ninguna nueva respecto a lo que ya se sabía que hacía falta:

- **Fuente de entropía**, y solo para crear la semilla de una partida. Es el único punto legítimo de azar del proyecto y por eso se inyecta: dentro de la generación sigue prohibido (RNF-DET-001), y con la fuente inyectada una prueba puede fijar la semilla sin tocar el generador.
- **Consulta de datos de OSM por celda**, con la misma forma que hoy tiene `fetchData` en `app/js/world/build.js`: el llamante decide caché y red. Cambia el argumento, que pasa de `(lat, lon, radio)` a los límites de la celda más el margen de borde.
- **Tramo declarado**, en metros por media hora, con su suelo. Lo produce la fila 4; aquí llega como número y se valida.

### El dimensionado de la celda: parámetro, no número clavado

`alcance-del-mundo.md` pendiente 1 dice que hay criterio y no hay número: la celda tiene que contener el suelo de parajes de `parajes.md`, hoy cuatro. Así que el lado se implementa como **un solo parámetro declarado, `LADO_CELDA_EN_TRAMOS`, con valor por defecto 2**, y los criterios de aceptación afirman el criterio de diseño y no el valor.

Por qué 2 y no otro, que es lo que hay que poder discutir cuando se mida:

- Con lado 2, el **radio inscrito de la celda es exactamente un tramo**: desde el centro se llega al borde en media hora. Es la traducción literal de la unidad a la geografía y no hace falta explicarla dos veces.
- Con el tramo de un caminante estándar (~2 km en media hora) la celda mide 4 × 4 km y su círculo inscrito, 2 km de radio, cubre el preset más grande que contempla `parametros-mundo.md` (jornada, 1,9 km). Una celda es un mapa entero, no un fragmento de mapa.
- Con el tramo del suelo, el radio inscrito cae en **250 m, que es exactamente el suelo de mundo jugable medido en `accesibilidad.md` §4**. Los dos suelos coinciden en lugar de contradecirse, que es la propiedad que hace defendible el número.

**Cómo se cierra el pendiente:** generando celdas sobre los cuatro fixtures de SPEC-001 con tramos de 2 km, 1 km y el suelo, contando parajes y cobertura de escenas, y comprobando que el suelo derivado se cumple en todos. El número que salga se anota en `game-design/alcance-del-mundo.md` (pendiente 1, tachado con su resultado) y la iteración, en `docs/starting.md`. Hasta entonces el valor por defecto es un supuesto declarado, no una decisión de diseño cerrada.

### El anclaje redondeado, que es dimensionado y privacidad a la vez

El anclaje es la coordenada de A1P4 redondeada a un paso fijo **geográfico** (0,01° en latitud y en longitud, ~1,1 km × 0,7-0,9 km en la península), no a un múltiplo del lado de celda: el paso tiene que ser el mismo para todo el mundo para que no se pueda deducir el tramo del jugador —ni, con él, nada de su cuerpo— a partir del anclaje guardado. A partir de ahí la rejilla es métrica: proyección local desde el anclaje y celdas cuadradas en metros, como ya hace `app/js/core/geo.js`.

Dos consecuencias que son criterios de aceptación:

- **El anclaje no se puede invertir** a nada más fino que el paso de redondeo, y la coordenada exacta del arranque no se guarda en ningún sitio. Es lo que permite enseñar el mapa sin enseñar el portal, y lo que sostiene «El rastro de ubicación no se guarda nunca».
- **El jugador no está en el centro de su celda** salvo por coincidencia, porque la fase de la rejilla la fija el anclaje y no él.

El identificador de un mapa dentro de la partida es su anclaje: es estable, ya está guardado y no revela más que el redondeo. La semilla de una celda se deriva encadenando semilla de partida, identificador de mapa, índice de celda y sufijo de fase, con `makeRng` como hasta ahora.

### La forma de la semilla

Dieciséis símbolos del alfabeto de Crockford (los diez dígitos y las letras salvo `I`, `L`, `O` y `U`), quince de dato y uno de control, presentados en cuatro grupos de cuatro con guiones: `K3M7-9QTX-2BVR-5FHZ`. Corta, legible en voz alta, copiable de una pantalla a un papel. Al normalizar se pasa a mayúsculas, se quitan guiones y espacios y se aceptan las confusiones clásicas (`I` y `L` por `1`, `O` por `0`); `U` se excluye para no formar palabras desafortunadas por azar. El dígito de control existe porque `alcance-del-mundo.md` §1 quiere que la semilla sea **pasable**, y una semilla mal copiada que se acepta sin protestar genera un mundo distinto en silencio, que es el peor fallo posible aquí.

**La unicidad es probabilística y no registrada**, y no puede ser otra cosa: no hay servidor ni cuentas donde llevar un registro, y montarlo contradiría `seguridad-privacidad.md` §1. Setenta y cinco bits de dato hacen la colisión irrelevante y además inofensiva: dos partidas con la misma semilla en sitios distintos siguen dando mundos distintos, porque el anclaje entra en la derivación.

*Cómo se comparte* una semilla entre dos personas (formato del intercambio, si el juego lo facilita o simplemente no lo impide) es el pendiente 4 de `alcance-del-mundo.md` y **no se resuelve aquí**: esta spec solo garantiza que la semilla se puede leer, teclear y validar.

### El porte desde el prototipo

`app/js/world/build.js` genera por radio y `countsForRadius` dimensiona con él. La rejilla no borra esa entrada de golpe: **la celda expone su radio inscrito**, y con eso las fases portadas siguen recibiendo un radio mientras las filas 4 y 6 las reexpresan en tramos. Lo que sí cambia desde el primer día es de dónde sale ese número: del lado de la celda, no de un preset de duración.

El radio dinámico costero de `seamask.js` merece un aviso: hoy estira el radio para no cortar una ría, y con celdas fijas eso deja de ser posible porque el borde de la celda es el borde de la celda. La máscara tierra/mar sigue teniendo sentido dentro de la celda; el estirón del radio, no. Esta spec no toca `seamask.js` —es de la fila 5— pero deja escrito que ese comportamiento no se porta tal cual.

### Lo que A1P4 necesita de aquí

Para que la fila 27 no tenga que inventárselo: el anclaje redondeado que resulta de la posición del pin, el **radio del círculo de alcance que la pantalla dibuja, que es el radio inscrito de la celda (un tramo)**, y el aviso de que el tramo declarado está por debajo del suelo, para que la pantalla lo diga con sus palabras. Nada de eso se pinta aquí.

### Escenarios de `docs/testing.md` que esta spec verifica

Se referencian, no se duplican: la batería se escribió antes que el código y sus nombres son el contrato con `wa-qa-dev`.

- **«El mundo es una función de la semilla y de los datos de OSM»** → «Dos generaciones con la misma semilla dan el mismo mundo», «Cambiar la semilla cambia el mundo», «Cada fase usa su propio sufijo de azar», «No se usa ninguna fuente de azar ni de tiempo del sistema», «El orden de iteración no depende del orden de inserción».
- **«Lo generado no se resiembra jamás»** → «Abrir una celda vecina no toca la celda propia» (que es además el escenario de la costura), «Cambiar el tramo del jugador no redimensiona un mundo ya generado», «Cambiar el estilo de pintado no resiembra nada».
- **«El callejero troceado de OSM se cose antes de trazar»** → «Los huecos cortos se cosen», «Los huecos largos no se cosen», «Lo cosido y lo inventado queda marcado», aplicados aquí al borde entre celdas.
- **«El mundo de una celda es jugable por construcción»** → «El suelo de parajes cubre el vocabulario de escenas» y «El mundo mínimo todavía compone un lazo», que son los que afirman el criterio del pendiente 1 sobre el tamaño de celda.
- **«El tramo es una unidad personal y se corrige midiendo»** → «Dos jugadores con tramos distintos reciben aventuras del mismo tamaño en pasos».
- **«Del móvil no sale nada del jugador»** → «El rastro de ubicación no se guarda nunca», que aquí se afirma sobre lo que la rejilla registra.
- **«Una partida, muchos mapas, y ningún selector»** → «Llegar a un sitio nuevo ofrece levantar un mapa», del que esta spec entrega solo la mitad de núcleo: responder que ninguna celda contiene esa posición.
- **«El jugador puede marcar un anclaje que no vale»** → «Marcarlo lo saca del casting sin resembrar».

### Huecos de la batería detectados

**RF-MUNDO-002 está marcado ⚠ sin escenario en el PRD** (formato y unicidad de la semilla) y esta spec lo confirma: `docs/testing.md` no tiene ni una característica sobre la semilla como dato, solo la usa como parámetro de los mundos sembrados. Los criterios de «La semilla de la partida» quedan sin escenario que los respalde, y `wa-qa-dev` tendrá que marcarlos como hueco declarado en `test/spec-test-map.json` en lugar de citar un escenario inexistente. Escenarios que faltan, por si se amplía la batería antes de que se implemente esta fila: una semilla mal copiada se rechaza en vez de generar otro mundo; dos vecinos ven mundos distintos; la semilla no contiene ninguna coordenada.

Hay un segundo hueco, más pequeño y no marcado en el PRD: **la apertura de celdas por acontecimiento no tiene escenario**. «Abrir una celda vecina no toca la celda propia» cubre la vía de pisarla, y nada cubre la de completar la propia ni la equivalencia de contenido entre las dos vías.

## Decisiones asumidas

- **Formato de la semilla: 16 símbolos de Crockford con dígito de control, en cuatro grupos de cuatro** → asumido (alternativas: palabras memorables tipo lista de diccionario, o mantener `lat,lon#n` del prototipo). Regla: `alcance-del-mundo.md` §1 pide corta, legible, copiable y con el jugador dentro; `lat,lon#n` la haría función del lugar y filtraría la ubicación al compartirla, que es justo lo que la decisión 1 evita.
- **La unicidad de la semilla es probabilística, sin registro** → asumido (alternativa: un servicio que garantice unicidad). Regla: `seguridad-privacidad.md` §1 y `arquitectura.md` §3 — no hay cuentas ni servidor que pueda llevar ese registro sin identificar a nadie.
- **La entropía de creación de la semilla se inyecta** → asumido (alternativa: usar `crypto` directamente dentro del núcleo). Regla: RNF-DET-001 y `arquitectura.md` §2, el núcleo recibe su E/S inyectada y así una prueba puede fijar la semilla.
- **El anclaje se redondea a 0,01° geográficos, no a un múltiplo del lado de celda** → asumido (alternativa: redondear al lado de celda, que alinearía rejilla y anclaje). Regla: `alcance-del-mundo.md` §2 pide una coordenada redondeada cercana; un paso que dependiera del tramo dejaría deducir el tramo del jugador desde el anclaje guardado, y el tramo es dato del cuerpo.
- **`LADO_CELDA_EN_TRAMOS` = 2 por defecto** → asumido como supuesto de trabajo (alternativas: 1, que daría celdas de media hora de diámetro, o 3-4, que daría mapas que no se cruzan en una salida). Regla: `alcance-del-mundo.md` pendiente 1 y `docs/prd.md` §7 punto 1 dicen que el número sale midiendo durante esta implementación; el criterio que sí está cerrado —la celda contiene el suelo de parajes— es lo que afirman los criterios de aceptación, y el 2 hace coincidir el suelo del tramo con el suelo de mundo jugable de `accesibilidad.md` §4.
- **El lado de celda se fija al levantar el mapa y no cambia con el tramo** → asumido (alternativa: redimensionar las celdas nuevas con el tramo vigente). Regla: `accesibilidad.md` §1 y `bucle-jugable.md` §5 — el tramo no redimensiona lo generado, y celdas de distinto tamaño en la misma rejilla dejarían de encajar, que es lo único que hace que crecer no sea regenerar.
- **Un tramo por debajo del suelo se recorta al suelo y se declara al llamante** → asumido (alternativa: rechazar y no levantar el mapa). Regla: `accesibilidad.md` §4, el límite se dice claro y sin dramatismo; quien lo dice con palabras es la pantalla de la fila 27, no el núcleo.
- **Contigüidad por borde compartido: cuatro vecinas, no ocho** → asumido (alternativa: incluir las diagonales). Regla: para llegar andando a una celda diagonal hay que cruzar antes una de las dos ortogonales, que se abre por pisarla y convierte a la diagonal en contigua; ocho vecinas solo añadirían aperturas por saltos de GPS.
- **La vecina que se abre por acontecimiento la elige la semilla** → asumido, entre las contiguas todavía cerradas (alternativas: que la elija el jugador, o abrir las cuatro). Regla: `alcance-del-mundo.md` §2 lo llama recompensa y no decisión, y RNF-DET-001 obliga a que sea reproducible; si no queda ninguna cerrada, no hay acontecimiento.
- **La vía de apertura no toca el contenido de la celda** → asumido (alternativa: que la celda de recompensa nazca distinta). Regla: RF-MUNDO-001, la celda es función de semilla y datos; el motivo de apertura es dato de la partida, no del mundo.
- **La costura vive fuera de las dos celdas, con sufijo de azar propio y orden canónico de índices** → asumido (alternativa: coserla dentro de la celda que se abre segunda). Regla: RF-MUNDO-005 — si la costura viviera dentro de una celda, abrir la vecina la modificaría, y eso es resembrar.
- **El umbral de cosido del borde es el mismo que el del callejero interno** (180 m de `coserHuecos`) → asumido (alternativa: un umbral propio del borde). Regla: `accesibilidad.md` §2 trata todo lo cosido igual —suposición marcada, no transitable prometida— y dos umbrales distintos producirían costuras que dependen de por qué lado se mira.
- **La celda sin nada dentro se crea igual y se marca como sin contenido jugable** → asumido (alternativa: no registrarla como abierta). Regla: `alcance-del-mundo.md` §2, el mundo tiene que existir donde estás; una celda que no se registra se volvería a intentar generar en cada paso.
- **Los criterios de aceptación van en Gherkin español** (`Dado / Cuando / Entonces`) → asumido (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo, y es lo que hace cruzable esta spec con `docs/testing.md` por grep. Mismo criterio que SPEC-001.
- **Sin sección de comportamiento responsive y sin `## UX Design`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md` y porque esta spec no tiene interfaz; la pantalla A1P4 es de la fila 27 y ya está dibujada.
