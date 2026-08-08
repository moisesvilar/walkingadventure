# SPEC-022 — La colocación de rótulos: ninguno pisa a otro, y lo que se sacrifica cuando no caben

## Descripción

Hoy los rótulos del mapa se pintan donde cae cada elemento y se solapan sin que nadie lo impida: es la deuda de render más antigua del proyecto, está en las trampas conocidas de `CLAUDE.md` y en el mapa del día uno se ve a la primera. Desde que Reino rotula los núcleos **sobre placa de pergamino opaca**, dos rótulos que chocan cantan mucho más que dos textos que se rozan, porque lo que se solapa ya no son letras sino cajas que se tapan enteras.

Esta spec entrega **el algoritmo que decide dónde va cada rótulo antes de que se pinte ninguno**. Recibe la lista de rótulos que hay que poner, el encuadre y las métricas del estilo; devuelve una caja por rótulo, y **ninguna pareja de cajas se solapa**. Es una afirmación binaria y comprobable sobre geometría, sin dibujar nada, y por eso vive en el paquete compartido y se verifica en `node --test`. El render no coloca: **recibe los rótulos ya colocados y los pinta donde le dicen**.

Y decide lo que hasta ahora nadie había decidido: **qué se sacrifica cuando no caben todos**. La respuesta corta es que se sacrifica el rótulo entero del elemento menos importante —se retira—, nunca su tamaño ni su texto; que un núcleo y un sitio encargado no se callan mientras quede una colocación posible, aunque haya que alejar la placa con un filete; y que su glifo se dibuja igual, así que lo que se pierde es el nombre en la lámina, no el pueblo.

Anclas: **RF-MAPA-003** (`docs/prd.md` §4.9), con `game-design/arquitectura.md` («Lo que esto obliga a hacer», cuarto punto) como fuente que manda, **RNF-PER-003** (`docs/prd.md` §5.5: la colocación se calcula antes de pintar) y el **riesgo 7** del PRD §8, que es esta misma deuda escrita como riesgo. Aplica **RF-MAPA-005** en lo que toca a los sitios encargados, que van rotulados aunque no se hayan pisado, y **RF-MAPA-001** como invariante: recolocar es pintar, y pintar jamás resiembra. Se apoya en SPEC-002 (las áreas del paquete y la regla de cero dependencias de plataforma), SPEC-003 (la identidad estable de cada elemento del mundo) y SPEC-009 (los identificadores del mundo congelado, que son la clave de desempate). La pantalla donde esto se ve por primera vez es **A1P6, «Tu mapa, el día uno»**, del artefacto 1.

**SPEC-021 (`render-skia-estilos`, fila 21) no está en disco al escribir esta spec.** Lo que aquí se declara del estilo es el **contrato mínimo de métrica** que la colocación necesita —tamaño por rol, si el rol va sobre placa, los márgenes de la placa, el ancho del halo y el tracking—, que es exactamente lo que `app/js/render/styles.js` ya expone en el prototipo. Si SPEC-021 nombra esas mismas cosas de otra manera, manda SPEC-021 y esto se ajusta por iteración; lo que no puede pasar es que la colocación lea un color.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: la colocación necesita **medir texto**, y medir texto es plataforma. Entra un medidor inyectado, descrito en «Frontera de inyección: el medidor de texto».
- **Fuera de alcance, aunque parezca natural traerlo aquí:** **qué rótulos existen**, que lo deciden los cuatro niveles de conocimiento del mapa (RF-MAPA-004, las tres tintas, fila 36) y RF-MAPA-005 —esta spec coloca la lista que le den y no decide si un paraje ya es sabido o todavía es un bulto sin nombre—; **el pintado**, que es de la fila 21 (traslado a Skia de los cinco estilos, `placa`, halo, filacteria, tipografías y colores); **el gesto de zoom y arrastre** y el encuadre en marcha, que son de las filas 26 y 29; **el entintado del telón** (fila 36); **la cartela, la brújula, la escala y el marco**, que aquí entran solo como zonas reservadas ya calculadas por quien las dibuja; y **el texto de cada rótulo**, que sale de los paquetes de idioma y de las quests.

## Criterios de aceptación

Van en `Dado / Cuando / Entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «Ninguna caja pisa a otra» y «El orden de sacrificio»; la **validación de entradas** en el candidato sin texto, sin ancla, con rol desconocido y en la medida que no es un número positivo; el **estado vacío** en el encuadre sin ningún candidato, el candidato único y el mapa donde todo cabe a la primera; el **estado de error** en el medidor ausente, el medidor que devuelve basura y el estilo al que le falta una métrica; y los **casos límite** en el racimo denso, los dos anclas idénticos, el texto más ancho que el marco, el tope de candidatos y el zoom donde doscientos núcleos caen en cuatrocientos píxeles.

Vocabulario que esta spec fija y que `wa-qa-dev` puede dar por cerrado: **«caja»** es el rectángulo orientado que ocupa un rótulo ya pintado, placa o halo incluidos; **«ancla»** es el punto del mundo al que pertenece el rótulo; **«glifo»** es el bulto que dibuja el elemento y que su propio rótulo tampoco puede pisar; **«protegido»** es el rótulo de un núcleo o de un sitio encargado; **«tirador»** es el filete corto que une una caja alejada con su glifo; **«encuadre»** es centro, escala y lienzo, ya cuantizados.

### Ninguna caja pisa a otra

- **Dado** un mundo de jornada con todos sus rótulos candidatos, **cuando** se colocan, **entonces** ninguna pareja de cajas devueltas se solapa.
- **Dado** ese mismo resultado, **cuando** se comprueban las cajas dos a dos, **entonces** entre cualquier par hay al menos la holgura mínima declarada, y dos cajas que se tocan cuentan como que se pisan.
- **Dado** un rótulo colocado, **cuando** se compara su caja con el glifo de su propio elemento, **entonces** no lo pisa.
- **Dado** un rótulo colocado, **cuando** se compara su caja con el glifo de cualquier otro elemento del encuadre, **entonces** no lo pisa.
- **Dado** las zonas reservadas del encuadre —cartela, brújula, escala, marco y la marca de la jugadora—, **cuando** se colocan los rótulos, **entonces** ninguna caja invade ninguna de ellas.
- **Dado** un rótulo de calzada, que va girado sobre su trazado, **cuando** se comprueba contra los demás, **entonces** el solape se mide sobre el rectángulo orientado y no sobre su envolvente.
- **Dado** un rótulo cuya caja no cabe entera dentro del marco, **cuando** se coloca, **entonces** no se pinta recortado: se retira y se declara con el motivo de que no cabe en el marco.
- **Dado** un encuadre sin ningún candidato, **cuando** se coloca, **entonces** se obtienen dos listas vacías y no un error.
- **Dado** un único candidato, **cuando** se coloca, **entonces** queda en la primera posición de su lista y no se retira nada.
- **Dado** un encuadre donde todo cabe a la primera, **cuando** se coloca, **entonces** ningún rótulo se ha movido de su posición preferida y la lista de retirados está vacía.

### Las posiciones que se prueban, en el orden que se prueban

- **Dado** un rótulo puntual sin ningún conflicto, **cuando** se coloca, **entonces** queda debajo de su glifo, que es su posición preferida.
- **Dado** un rótulo puntual cuya posición preferida está ocupada, **cuando** se coloca, **entonces** se prueban las ocho posiciones alrededor del ancla en el orden declarado y se toma la primera libre.
- **Dado** el mismo rótulo colocado dos veces con la misma entrada, **cuando** se comparan, **entonces** cae en la misma de las ocho posiciones: el orden es fijo y no depende de qué se colocó antes en otra ejecución.
- **Dado** un rótulo de calzada, **cuando** su punto medio está ocupado, **entonces** se desliza por el trazado en pasos declarados, alternando hacia los dos extremos, y el texto sigue derecho en todas las posiciones probadas.
- **Dado** un rótulo de calzada cuyo trazado visible es más corto que el mínimo declarado, **cuando** se coloca, **entonces** no se rotula la calzada y se declara el motivo.
- **Dado** un rótulo protegido para el que ninguna de las ocho posiciones sirve, **cuando** se coloca, **entonces** se aleja del ancla en la dirección de su mejor posición, hasta el tope declarado.
- **Dado** un rótulo alejado por encima de la separación base, **cuando** se lee su colocación, **entonces** trae el tirador que lo une a su glifo, con sus dos extremos ya calculados.
- **Dado** un rótulo no protegido, **cuando** ninguna de sus ocho posiciones sirve, **entonces** no se aleja con tirador: se retira.

### El orden de sacrificio, que es lo que se decide aquí

- **Dado** un racimo donde no caben todos los rótulos, **cuando** se coloca, **entonces** los que se retiran son los de menor prioridad, por el orden declarado: primero las calzadas, luego los servicios, luego los parajes conocidos.
- **Dado** ese mismo racimo, **cuando** se lee el resultado, **entonces** cada rótulo retirado declara su identificador y su motivo.
- **Dado** un rótulo retirado, **cuando** se compara el resto del dibujo, **entonces** su glifo se dibuja igual: lo que se retira es el nombre, no el elemento.
- **Dado** un rótulo que no cabe, **cuando** se coloca, **entonces** no se encoge: su tamaño es el de su rol y el mismo antes y después del conflicto.
- **Dado** un rótulo que no cabe, **cuando** se coloca, **entonces** su texto tampoco se recorta ni se abrevia con puntos suspensivos.
- **Dado** un núcleo y un paraje que se disputan el mismo hueco, **cuando** se coloca, **entonces** el que se queda con el hueco es el núcleo.
- **Dado** un núcleo cualquiera, **cuando** existe alguna colocación posible para su rótulo, **entonces** su rótulo no se retira: retirar es siempre el último recurso y nunca un atajo.
- **Dado** un sitio encargado de la salida en curso que todavía no se ha pisado, **cuando** se coloca, **entonces** va rotulado, y si compite con un paraje conocido gana él.
- **Dado** dos núcleos cuyas placas no caben ni reubicadas ni alejadas con tirador, **cuando** se coloca, **entonces** se retira el del rango menor —aldea antes que pueblo, pueblo antes que ciudad— y el de rango mayor conserva su rótulo.
- **Dado** dos núcleos del mismo rango en ese mismo conflicto, **cuando** se coloca, **entonces** el que se retira sale del desempate declarado por identificador y nunca del orden en que llegaron a la lista.
- **Dado** un rótulo protegido cuyo texto es más ancho que el marco entero, **cuando** se coloca, **entonces** se retira declarando que no cabe en el marco, porque pintarlo cortado es peor que no ponerlo.
- **Dado** un encuadre con más candidatos que el tope declarado, **cuando** se coloca, **entonces** los que sobran no llegan a intentarlo, se descartan por prioridad y se declaran con ese motivo.
- **Dado** el mundo mínimo, de un solo núcleo y tres parajes, **cuando** se coloca, **entonces** no se retira ningún rótulo.

### La misma colocación siempre

- **Dado** el mismo mundo, el mismo estilo y el mismo encuadre, **cuando** se coloca dos veces, **entonces** las dos colocaciones son idénticas, caja a caja.
- **Dado** esa misma entrada con los candidatos en otro orden de lista, **cuando** se coloca, **entonces** el resultado es el mismo: el orden de proceso sale de la prioridad y del identificador, nunca del orden de inserción.
- **Dado** el módulo de colocación, **cuando** se inspeccionan sus imports, **entonces** no hay ninguna fuente de azar, ni lectura del reloj, ni acceso a la red, ni nada de plataforma.
- **Dado** un encuadre que se mueve menos que el paso de cuantización declarado, **cuando** se coloca, **entonces** el resultado es idéntico al anterior y ningún rótulo salta de sitio.
- **Dado** un arrastre que cruza un paso de cuantización, **cuando** se recoloca, **entonces** la colocación se recalcula entera y no depende de cuál fuera la anterior.
- **Dado** un mundo pintado en «reino», **cuando** se cambia el estilo a «pergamino», **entonces** se recoloca con las métricas del estilo nuevo y el mundo sigue idéntico byte a byte.
- **Dado** dos estilos con métricas distintas, **cuando** se coloca el mismo mundo con cada uno, **entonces** las colocaciones pueden diferir, y ninguna de las dos tiene solapes.

### Antes de pintar, y a un coste acotado

- **Dado** un fotograma que va a pintarse, **cuando** empieza el pintado, **entonces** la colocación ya está resuelta y el pintado no mide texto ni mueve ninguna caja.
- **Dado** la lista de rótulos colocados, **cuando** se lee, **entonces** cada uno trae posición, tamaño, caja, rol, si va sobre placa y su tirador si lo tiene: quien pinta no decide nada.
- **Dado** un encuadre con el tope de candidatos, **cuando** se coloca, **entonces** las comprobaciones de solape por rótulo colocado no superan el máximo declarado.
- **Dado** un encuadre y otro con el doble de candidatos, **cuando** se colocan los dos, **entonces** el total de comprobaciones del segundo no llega al cuádruple del primero: el índice espacial está haciendo su trabajo.
- **Dado** un candidato cuya ancla queda fuera del encuadre, **cuando** se coloca, **entonces** no entra en el reparto y no cuesta ninguna comprobación.

### Lo que se rechaza en la entrada

- **Dado** un candidato sin texto, **cuando** se coloca, **entonces** falla nombrando el campo que falta y el identificador del candidato.
- **Dado** un candidato sin ancla, **cuando** se coloca, **entonces** falla nombrando el campo.
- **Dado** un candidato con un rol que no es núcleo, paraje, servicio ni calzada, **cuando** se coloca, **entonces** falla nombrando el rol recibido.
- **Dado** dos candidatos con el mismo identificador, **cuando** se coloca, **entonces** falla nombrando el identificador repetido, en lugar de elegir uno en silencio.
- **Dado** el módulo sin medidor de texto inyectado, **cuando** se coloca, **entonces** falla declarando que falta el medidor, y no estima el ancho por el número de letras.
- **Dado** un medidor que devuelve un ancho o un alto que no es un número positivo, **cuando** se coloca, **entonces** falla nombrando el rótulo que lo provocó.
- **Dado** un estilo al que le falta la métrica de un rol que hay que colocar, **cuando** se coloca, **entonces** falla nombrando el rol y la métrica, en lugar de caer a un valor por omisión.
- **Dado** dos candidatos con el ancla exactamente en el mismo punto, **cuando** se coloca, **entonces** no falla: se resuelve por prioridad y por identificador, y las dos cajas no se solapan.

## UX Design

### Wireframe textual

Esta spec no añade ninguna pantalla: cambia cómo se ve el mapa en las tres donde ya sale. Las tres están dibujadas y se citan por su nodo de `docs/flujo.md`.

**A1P6 · «Tu mapa, el día uno»** (artefacto 1, pantalla 6). El mapa ocupa la parte de arriba de la pantalla como **lámina**, no como mapa de aplicación: mar plano, tierra plana, costa y ríos gruesos, calzadas con filete y puntos rojos, estilo Reino. Debajo, las tres líneas que explican el trato y la lista de aventuras del día. Sobre la lámina, y **colocado por esta spec**:

- **Los núcleos**, con su glifo y su **placa de pergamino** (`#efe3c0`, filete `#8a6d34`, tinta `#1e2b18`) con el nombre en versalitas. Posición preferida: debajo del glifo. Tamaño por rango —ciudad, pueblo, aldea—, que es lo que distingue uno de otro y por eso no se encoge. Las granjas no llevan rótulo, hoy tampoco.
- **Los parajes ya sabidos**, con su glifo y el nombre **con halo**, sin caja. La jerarquía placa/halo es la que hace que pueblo y paraje se distingan sin leer el nombre, y es de `game-design/arquitectura.md`.
- **Los servicios** de un núcleo, con su marca junto al glifo.
- **Las calzadas con nombre**, rotuladas a lo largo del trazado, texto siempre derecho, deslizándose desde el punto medio hacia los extremos cuando el medio está ocupado.
- **Los sitios todavía no sabidos** salen como bultos sin nombre y **no son candidatos**: no tienen rótulo que colocar.
- **Zonas reservadas** que ningún rótulo invade: la **cartela** con el título del mapa, la **brújula**, la **barra de escala** y el **marco**, más el área segura de la pantalla.
- **El tirador**: cuando una placa de núcleo no cabe en ninguna de sus ocho posiciones y hay que alejarla, sale un **filete fino** del glifo a la caja, del mismo color que el filete del marco. Es el único elemento visible que esta spec añade al repertorio del mapa.

**A3P2 · el mapa en marcha**. Pantalla completa, sin nada encima, norte arriba, la posición de la jugadora como **marca roja del propio mundo**. La marca es zona reservada: ningún rótulo la pisa, ni siquiera el del núcleo en el que está parada. Los **sitios encargados** de la salida en curso van rotulados aunque no se hayan pisado, y son protegidos: no se retiran mientras haya sitio.

**A5P1 · el mapa entintado del telón**. Mismo mapa con lo de hoy recién puesto, lo sabido asentado y lo no sabido a lápiz. La colocación es la misma función: cambia qué rótulos hay, no cómo se colocan. Al entintar aparecen rótulos que antes no estaban, así que la colocación se recalcula entera para ese encuadre.

### Pantallas y elementos utilizados

- Pantallas ya dibujadas que esta spec toca: **A1P6** (artefacto 1, pantalla 6), **A3P2** (artefacto 3, pantalla 2) y **A5P1** (artefacto 5, pantalla 1). Ninguna se rediseña.
- Elementos del mapa que ya existen y que la colocación consume: **glifo** de núcleo, de paraje y de servicio; **placa** de rótulo; **halo** de rótulo; **filacteria** de calzada en los estilos que la usan; **cartela**, **brújula**, **escala** y **marco**; **marca** de la jugadora.
- **Elemento nuevo: el tirador**, filete corto del glifo a la caja cuando un rótulo protegido se aleja de su ancla. No está dibujado en ningún artefacto; su aspecto es el del filete del estilo y no añade ni un color.
- Nada de esto son vistas: el mapa entero es un lienzo de Skia (fila 21) y los rótulos se pintan dentro.

### data-testid

Pocos y estables, y los dos que el sistema de diseño pide siempre:

- `momento` — el estado del momento: antes de salir, en marcha, al parar, telón. Lo consumen todas las pruebas `@app`, no solo estas.
- `mapa` — el lienzo del mapa, en las tres pantallas donde sale.
- `mapa-colocacion` — **volcado inerte del resultado de la colocación**, disponible solo en compilaciones de prueba, con la lista de cajas y la de retirados con su motivo. No es interfaz: es el equivalente de los hooks `__wa` que el prototipo ya tiene en la consola, y existe porque un lienzo no tiene nodos que alcanzar. Sin él, una prueba `@app` solo podría afirmar que el mapa se pintó.

Los rótulos **no llevan testid propio**: no son vistas independientes. Lo que se afirma sobre ellos se afirma en `@nucleo` contra el resultado del algoritmo, que es donde de verdad se puede afirmar.

### Patrón de interacción

- **El encuadre se cuantiza antes de colocar**: el zoom en pasos declarados y el centro sobre una rejilla de píxeles lógicos. Es lo que hace que arrastrar el mapa no recoloque en cada fotograma y que el resultado sea función pura del encuadre. Decisión no cubierta por el sistema de diseño: se resuelve así porque la alternativa habitual —histéresis, recordar la colocación anterior para que nada parpadee— haría que el resultado dependiera del fotograma previo y rompería el determinismo, que aquí es invariante bloqueante.
- **Durante el gesto no se recoloca**: los rótulos ya colocados se mueven con el mapa, y la colocación se recalcula al cruzar un paso de cuantización o al soltar. Es lo que sostiene RNF-PER-003 con zoom y arrastre.
- **Los rótulos que entran o salen lo hacen con un fundido corto**, no de golpe. El fundido es pintado y no toca la colocación: la lista de cajas ya está decidida cuando empieza.
- **En marcha no hay ni un control tocable** (sistema de diseño, y `bucle-jugable.md`): el encuadre de A3P2 lo fija el juego, así que ahí la colocación se calcula una vez por encuadre y no hay gesto que la mueva.
- **Los rótulos del mapa no siguen el ajuste de tamaño de letra del sistema**: son parte de la lámina y su tamaño es la jerarquía. El ajuste a mano que pide `accesibilidad.md` es para el texto largo de las escenas, no para el mapa. Aun así, si algún día el tamaño de un rol cambiara por cualquier motivo, la colocación no se entera: mide lo que le devuelva el medidor y recoloca.
- **Retirar un rótulo no se le explica a la jugadora.** No hay aviso, ni marca, ni «hay más sitios aquí»: un mapa dibujado no confiesa sus decisiones de composición, y el nombre sigue estando donde ya estaba —en la cartela del núcleo enfocado y en el visor al llegar—. La lista de retirados es un dato para quien programa, no una superficie.

## Notas técnicas

### Reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/core/rotulos.js` | la colocación: el orden de prioridad, las posiciones candidatas, el tirador, el retirado por prioridad y el resultado declarado |
| `packages/nucleo/core/cajas.js` | el rectángulo orientado, el solape por ejes separadores con holgura, y el índice de rejilla uniforme que acota el coste |

Van en `core/` por lo mismo que `geo.js`: **esto es geometría, no dibujo**. No pinta, no conoce un color y no importa nada de plataforma, así que corre en `node --test` como el resto del paquete. Las áreas del paquete están fijadas desde SPEC-002 (`core`, `world`, `names`, `quests`, `partida`) y esta entrega no abre ninguna.

### Frontera de inyección: el medidor de texto

Es la única entrada nueva al núcleo que esta spec añade, y es inevitable: el ancho de un texto depende de la fuente y de la plataforma, y el paquete compartido no puede tener ni una ni otra.

```
medir(texto, rol, estilo) → { ancho, alto, base }
```

- **En la app** lo implementa la capa de Skia de la fila 21, con la tipografía ya cargada.
- **En `node --test`** se inyecta un medidor de mentira, declarado y estable: un ancho por letra y un alto por rol. Eso hace las pruebas deterministas y del todo independientes de qué fuentes tenga la máquina, que es justo lo que permite afirmar «ninguno pisa a otro» sin dibujar nada.
- **El medidor mide el texto; la caja la calcula la colocación**, sumando lo que el rol añade: los márgenes de la placa si el rol va sobre placa, el ancho del halo si no, y el tracking del estilo. Ese cálculo es del núcleo y no del medidor, porque es donde vive la regla.
- **Falta el medidor, falla.** No se estima por número de letras: una estimación produce mapas sin solapes en la prueba y con solapes en el móvil, que es la peor forma de verde.

Del **estilo** la colocación lee solo lo que cambia una caja: tamaño por rol, qué roles van sobre placa, márgenes y filete de la placa, ancho del halo y tracking. Ni un color, ni un grosor de línea de dibujo.

### El orden de prioridad, y por qué es una tupla y no una lista

El orden de proceso es una tupla comparable, y ese detalle es lo que evita la trampa conocida del repo —que el resultado dependa del orden de inserción—:

1. **Encargado** primero: los sitios de la salida en curso, que RF-MAPA-005 obliga a rotular aunque no se hayan pisado.
2. **Rol**: núcleo, luego paraje, luego servicio, luego calzada.
3. **Rango** dentro del rol: ciudad, pueblo, aldea para los núcleos; el resto no tiene rango.
4. **Identificador** del elemento en el mundo congelado, lexicográfico, como desempate final.

**Protegidos** son los rótulos de núcleo y los de sitio encargado. La protección significa dos cosas y solo dos: que pueden usar el tirador, y que no se retiran mientras exista alguna colocación posible. No significa que no se retiren nunca, y eso hay que decirlo con todas las letras: cuando dos protegidos no caben ni con tirador, alguien se calla, y es el de menor prioridad. La alternativa —tirador sin tope— produce placas flotando lejos de su pueblo, unidas por un filete larguísimo, que es un mapa peor que uno con un nombre menos.

### Qué se sacrifica, en orden, y qué no se sacrifica nunca

Las palancas se aplican en este orden estricto, y cada una solo cuando la anterior se ha agotado:

1. **Reubicar** en las ocho posiciones alrededor del ancla, o deslizar por el trazado si es una calzada.
2. **Alejar con tirador**, solo los protegidos, hasta el tope declarado.
3. **Retirar** el rótulo entero, por orden inverso de prioridad.

Y lo que **no** es palanca, por decisión: **no se encoge** —el tamaño es la jerarquía, y un pueblo encogido se lee como una aldea—, **no se recorta el texto** —un topónimo a medias no es un topónimo— y **no se apila en una segunda línea**, que cambiaría la forma de la placa según lo lleno que esté el mapa. La consecuencia es que el sacrificio es siempre binario y siempre del elemento menos importante, que es lo que lo hace verificable de un vistazo y en una aserción.

**Nunca se calla, mientras quede sitio:** el núcleo de mayor rango de cada conflicto y el sitio encargado de la salida en curso. Y cuando alguno se calla, **su glifo se dibuja igual**: el pueblo sigue en el mapa, sigue tocable y su nombre sigue apareciendo en la cartela cuando se enfoca y en el visor cuando se llega. Lo que se pierde es un nombre en la lámina a ese encuadre, y basta acercar el mapa para recuperarlo, porque la colocación se recalcula por encuadre.

### Los números declarados, que son el instrumento y no la verdad

Salen de las medidas del prototipo (`LABEL_SIZE`, la separación de `drawLabel`, los márgenes de `placa`) y se ajustan por iteración con el mapa delante, igual que se hizo con los presupuestos de tamaño de SPEC-009 y SPEC-016:

| Cosa | Valor | Por qué |
| --- | --- | --- |
| Holgura mínima entre cajas | 2 px lógicos | dos cajas que se tocan se leen como que se pisan |
| Separación base glifo → caja | radio del glifo + 3 px | es la de `drawLabel` hoy |
| Posiciones por rótulo puntual | 8 | debajo, encima, derecha, izquierda y las cuatro diagonales, en ese orden |
| Pasos de deslizamiento de una calzada | 16 | desde el punto medio, alternando hacia los dos extremos |
| Largo mínimo de trazado visible para rotular | 150 px | es el de `drawRouteLabel` hoy |
| Tope del tirador | 2 × la diagonal de la caja | más allá, la placa deja de leerse como del pueblo |
| Filete visible del tirador | a partir de 1,5 × la separación base | por debajo, la cercanía ya lo explica |
| Cuantización del zoom | pasos de un cuarto de duplicación | acota los recálculos sin que se note el salto |
| Cuantización del centro | rejilla de 8 px lógicos | ídem, para el arrastre |
| Tope de candidatos por encuadre | 300 | por encima se descartan por prioridad antes de intentar nada |
| Comprobaciones de solape por rótulo colocado | ≤ 64 | es el presupuesto que verifica que el índice espacial existe |
| Crecimiento al doblar candidatos | ≤ 2,5 × | afirma que no es cuadrático, sin depender de la máquina |

### Sobre qué se mide el coste, que es la parte que suele quedar en el aire

RNF-PER-003 pide fluidez en gama media y que la colocación se calcule antes de pintar. Eso se mide en **dos sitios distintos, y a propósito**:

- **En `@nucleo`, por comprobaciones de solape**, no por milisegundos. Un presupuesto en milisegundos dentro de `node --test` es una prueba intermitente que acaba subiéndose el listón hasta no afirmar nada; un contador de comprobaciones es determinista, idéntico en cualquier máquina y afirma exactamente lo que interesa: que hay un índice espacial y que el algoritmo no es cuadrático.
- **En dispositivo, por milisegundos**, con el objetivo de que colocar 300 rótulos quepa en un fotograma de 60 Hz en un móvil de gama media. Eso es revisión `@manual` sobre el aparato, porque no hay forma honesta de automatizarlo aquí, y la cuantización del encuadre es la que lo hace sostenible: entre paso y paso no se recoloca nada.

### Escenarios de `docs/testing.md` que esta spec hace afirmables

Se referencian por su nombre literal, que es el contrato con `wa-qa-dev`:

- De **«Lo generado no se resiembra jamás»** (`@nucleo @determinismo`): **«Cambiar el estilo de pintado no resiembra nada»**, del que aquí se sostiene la mitad que faltaba —recolocar es pintar, así que cambiar de estilo recoloca y el mundo no se toca—.
- De **«El mundo es una función de la semilla y de los datos de OSM»**: **«No se usa ninguna fuente de azar ni de tiempo del sistema»**, que aplica a este módulo como a cualquier otro del paquete.
- **Frontera, que esta spec deja preparada y no implementa:** **«El norte está siempre arriba»** (fila 29, A3P2) y **«El mapa se entinta al echar el telón»** (fila 36, A5P1), que consumen la colocación pero no la especifican.

### El hueco de la batería, que hay que cerrar antes de dar la fila por verificada

**RF-MAPA-003 está marcado «⚠ sin escenario» en el PRD, y el propio PRD dice que `testing.md` exige la prueba «al implementarse», o sea ahora.** Es uno de los quince huecos del riesgo 10. Y `docs/testing.md` ya lo anticipa por escrito en «Por qué esos van a mano»: «el declutter de rótulos sí es comprobable —ninguna caja se solapa con otra— y debe tener su prueba cuando se implemente». Esa prueba **no existe todavía**, y esta spec no la escribe: `docs/testing.md` lo mantiene el humano y lo cierra quien orquesta.

Lo que sí se deja, para que cerrarlo sea copiar y pegar: **la característica y los nombres literales de escenario** que esta spec hace afirmables. Si se aceptan tal cual, `wa-qa-dev` puede cruzar batería e implementación con un grep, que es para lo que sirven los nombres.

Característica propuesta, `@nucleo`, para una sección nueva de render en `docs/testing.md`, con `arquitectura.md` y RF-MAPA-003 como fuente:

- **Característica: Ningún rótulo del mapa pisa a otro**
  - Escenario: **Ninguna pareja de rótulos se solapa en un mundo denso**
  - Escenario: **Ningún rótulo pisa un glifo ni la cartela ni la brújula**
  - Escenario: **Ningún rótulo se sale del marco**
  - Escenario: **El rótulo de un núcleo no se retira mientras quepa en algún sitio**
  - Escenario: **Cuando dos no caben, se retira el de menor prioridad y su pueblo se sigue dibujando**
  - Escenario: **El sitio encargado va rotulado aunque no se haya pisado**
  - Escenario: **Ningún rótulo se encoge ni se recorta para caber**
  - Escenario: **La misma colocación para el mismo mundo, el mismo estilo y el mismo encuadre**
  - Escenario: **El orden de los candidatos no cambia la colocación**
  - Escenario: **Colocar no crece al cuadrado**

Y dos de nivel `@manual`, que son las que no se pueden automatizar con honestidad y hoy están implícitas en la línea de «Por qué esos van a mano»:

- Escenario: **El mapa del día uno se lee entero, con siete núcleos y seis calzadas** — el mundo de paseo real, que es donde el artefacto 1 dice que el solape se nota.
- Escenario: **Pueblo y paraje se distinguen sin leer el nombre** — la jerarquía placa/halo, que es la otra mitad de RF-MAPA-003.

Al añadirlas, conviene **actualizar también la línea de «Por qué esos van a mano»**, que hoy dice que esta prueba «debe tener su prueba cuando se implemente»: ese momento es este.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-016.
- **Con bloque de UX Design y sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`: manda el `SKILL.md` de `wa-spec`, que lo prohíbe porque esto es una app de móvil.
- **La colocación vive en `packages/nucleo/core/`, no en un área `render/` nueva ni en la app** → asumido (alternativa: `packages/nucleo/render/`, o dentro de la capa de Skia de la fila 21). Regla: las áreas están fijadas desde SPEC-002 y esto es geometría sobre cajas, vecina de `geo.js`; además es lo único que permite afirmarlo en `@nucleo`, que es el punto entero de esta spec.
- **El algoritmo no tiene ninguna fuente de azar, ni siquiera sembrada** → asumido (alternativa: azar sembrado con `makeRng(seed + ':rotulos')`, como pide el proyecto cuando hay azar). Regla: un barrido codicioso sobre un orden total declarado no necesita azar, y sin azar el determinismo se afirma sin depender de que nadie se olvide del sufijo.
- **El barrido es codicioso por prioridad, y no una optimización global** → asumido (alternativa: buscar la colocación que maximice el número de rótulos puestos, con retroceso, como el casting de quests). Regla: el criterio de RF-MAPA-003 es binario —ninguno pisa a otro— y no «cuantos más mejor»; una optimización global puede callar un núcleo para colocar tres parajes, que es exactamente lo que la jerarquía de Reino no quiere, y cuesta mucho más de lo que RNF-PER-003 permite en un gesto de zoom.
- **Cuando no caben, se retira el rótulo entero y no se encoge ni se recorta** → asumido (alternativa: reducir el tamaño hasta un mínimo, o elidir el texto). Regla: el tamaño por rango es lo que distingue ciudad de pueblo y de aldea en `LABEL_SIZE`, así que encoger convierte un pueblo en una aldea a los ojos; y `game-design/arquitectura.md` pide un algoritmo de colocación, no de composición tipográfica.
- **Protegidos son los núcleos y los sitios encargados; el resto se puede retirar** → asumido (alternativa: proteger también los parajes ya sabidos, que son descubrimientos de la jugadora). Regla: la jerarquía de Reino es placa en núcleos y halo en parajes precisamente para que se distingan sin leer, y RF-MAPA-005 obliga a rotular los sitios encargados aunque no se hayan pisado; un paraje sabido conserva su glifo y su nombre en el visor.
- **La protección tiene tope: entre dos protegidos que no caben, se calla el de menor prioridad** → asumido (alternativa: tirador sin tope, para que un núcleo no se calle jamás). Regla: una placa a diez veces su diagonal del pueblo, unida por un filete larguísimo, es peor mapa que uno con un nombre menos; y sin tope, la garantía de coste se va con él.
- **El desempate final es el identificador del elemento, nunca el orden de la lista** → asumido (alternativa: el orden en que llegan los candidatos, que es lo natural de escribir). Regla: es la trampa documentada del repo y el escenario bloqueante «El orden de iteración no depende del orden de inserción».
- **El encuadre se cuantiza y no hay histéresis** → asumido (alternativa: recordar la colocación anterior para que nada parpadee al arrastrar). Regla: la histéresis haría que el resultado dependiera del fotograma previo y la colocación dejaría de ser una función pura del encuadre, que es lo que la hace verificable; la cuantización da la misma estabilidad sin ese precio, y además acota el número de recálculos.
- **Todas las cajas son rectángulos orientados y el solape se comprueba con ejes separadores** → asumido (alternativa: envolventes alineadas a la pantalla, más simples). Regla: el rótulo de calzada va girado sobre su trazado, y su envolvente alineada puede ser el doble de grande, lo que retiraría rótulos que sí caben; con una sola regla para todos, los no girados son el caso degenerado y no hay dos caminos que mantener.
- **El coste se presupuesta en comprobaciones de solape y no en milisegundos** → asumido (alternativa: un tope de milisegundos en `node --test`). Regla: un presupuesto en tiempo dentro del runner es intermitente y acaba relajándose hasta no afirmar nada; el contador es determinista y afirma lo que de verdad importa —que hay índice espacial y que no es cuadrático—. Los milisegundos se miden en dispositivo, y eso es `@manual`.
- **Hay un tope de 300 candidatos por encuadre, y lo que sobra se descarta por prioridad sin intentarlo** → asumido (alternativa: intentarlo todo y confiar en el índice). Regla: es lo que acota el peor caso del zoom más alejado, donde el mapa entero cae en una pantalla, y descartar por prioridad conserva la garantía de que lo importante sigue puesto.
- **El medidor de texto es una entrada inyectada, y sin él se falla en lugar de estimar** → asumido (alternativa: aproximar el ancho por número de letras dentro del núcleo). Regla: una estimación da mapas sin solapes en la prueba y con solapes en el móvil, que es la forma de verde que este repo ya ha pagado varias veces (`pipeline/decisiones-orquestador.md` §6h).
- **El tirador es un elemento visible nuevo, y su aspecto es el filete del estilo** → asumido (alternativa: alejar la placa sin ninguna línea que la ate a su pueblo). Regla: una placa alejada y suelta rompe la lectura del mapa —no se sabe de quién es el nombre—, y el filete ya existe en la paleta de Reino (`#8a6d34`), así que no se inventa ningún color.
- **Retirar un rótulo no se le comunica a la jugadora de ninguna forma** → asumido (alternativa: alguna marca de «hay más aquí»). Regla: el sistema de diseño dice que el mapa es lámina y no mapa de aplicación; un mapa dibujado no confiesa sus decisiones de composición, y el nombre sigue disponible en la cartela y en el visor.
- **Los rótulos del mapa no siguen el ajuste de tamaño de letra del sistema** → asumido (alternativa: escalarlos con él, por accesibilidad). Regla: `accesibilidad.md` pide el ajuste a mano donde hay texto largo, que es la escena en modo compañía, y en el mapa el tamaño es jerarquía; en cualquier caso la colocación mide lo que le devuelva el medidor, así que un cambio de criterio no la rompe.
- **Los cinco números de geometría (holgura, separación, ocho posiciones, tope del tirador, mínimo de trazado) salen del prototipo y se ajustan por iteración** → asumido (alternativa: dejarlos sin fijar hasta ver el mapa en el móvil). Regla: sin números declarados no hay nada que afirmar en una prueba, y es el mismo criterio con el que SPEC-009 y SPEC-016 fijaron sus presupuestos: convertir una intuición en una medida que luego se corrige con el dato delante.
- **El contrato de métrica del estilo se declara aquí porque SPEC-021 todavía no está en disco** → asumido (alternativa: esperar a la fila 21 y no nombrar nada). Regla: lo declarado es lo que `app/js/render/styles.js` ya expone hoy —tamaño por rol, `label.placa`, márgenes de `placa`, `haloW`, `tracking`—, así que no se inventa nada nuevo; si SPEC-021 lo nombra de otro modo, manda SPEC-021 y esto se ajusta por iteración.
- **La spec no escribe el escenario que falta en `docs/testing.md`, solo lo propone con nombres literales** → asumido (alternativa: añadirlo directamente al fichero). Regla: `.claude/rules/naming.md` reparte quién escribe qué y `docs/testing.md` no es de `wa-spec`; el encargo pide decirlo explícitamente para que quien orquesta lo cierre, y eso es lo que hace la sección «El hueco de la batería».
