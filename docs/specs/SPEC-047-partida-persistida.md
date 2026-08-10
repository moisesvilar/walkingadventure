# SPEC-047 — La partida se guarda y se vuelve a abrir

## Descripción

La partida no se guarda nunca. `congelaEstado` y `levantaEstado` están escritos y probados de arriba abajo en el paquete, y **no los llama nadie desde `app/`**: cada arranque construye `estadoInicial({ semilla })` y ese estado vive solo en memoria de React. De los cuatro prefijos que `PREFIJOS_DE_LA_PARTIDA` declara, la app escribe `arranque/`, `camara/` y `mapa/`; el cuarto, `partida/`, que es donde vive lo jugado, no lo escribe nadie. Como consecuencia, una copia exportada hoy sale sin documento de partida: el respaldo de la fila 39 funciona y no respalda nada de lo jugado.

Esta fila cablea las dos mitades: **congelar** la partida en los cortes del juego y cuando el sistema se lleva la app, y **levantarla al abrir**, antes de pintar nada, con una partida de una versión anterior migrada por la cadena y un documento que no se puede leer dando la cara en lugar de caer al estado inicial en silencio.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes,
  páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests
  de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega.
  Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya
  commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador
  entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica
  explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Fuera de alcance**: no se toca `packages/nucleo/partida/`. `guardaPartida`, `cargaPartida`, `congelaEstado`, `levantaEstado`, `migra`, `compruebaCadena` y `CADENA_DEL_FORMATO` están escritos y probados; lo que falta es quien los llame. Tampoco se toca la fila 39: su mecanismo de exportación es correcto sobre lo que hay en el almacén, y empieza a traer el documento de partida por el solo hecho de que alguien lo escriba.
- **Fuera de alcance**: no se cablea ninguna fuente de hechos. Hoy nada de `app/` altera el estado de la partida después de que el arranque se cierre —lo comprueba esta spec en «Lo que esta fila no puede demostrar»— y encender esas fuentes es de las filas 44, 46, 48 y 49. Esta fila entrega la tubería y el registro de hechos vacío que aquellas llenarán sin volver a tocar esto.

## Criterios de aceptación

### Congelar

- GIVEN un arranque que se cierra saliendo a andar WHEN la partida nace THEN queda escrito el documento de estado bajo el prefijo `partida/`.
- GIVEN una partida nacida WHEN se mira lo que se ha escrito THEN está también el registro de hechos, vacío y con su versión de reglas dentro.
- GIVEN una partida en curso WHEN la app pasa a segundo plano THEN la partida queda congelada antes de que el sistema pueda matar el proceso.
- GIVEN una pantalla de consulta que ha cambiado algo del estado WHEN se vuelve a la portada THEN la partida queda congelada.
- GIVEN una partida que no ha cambiado desde la última congelación WHEN se vuelve a congelar THEN no se reescribe ningún documento.
- GIVEN una congelación WHEN se escribe THEN el registro de hechos va primero y el documento de estado después, declarando hasta qué hecho está aplicado.
- GIVEN un almacén que falla al escribir WHEN se congela THEN el error se declara nombrando la clave y los documentos anteriores siguen enteros.

### Levantar al abrir

- GIVEN un documento de partida escrito WHEN se abre la app THEN se abre en la portada y no en el arranque.
- GIVEN una partida levantada al abrir WHEN se mira lo que trae THEN están el personaje con su nombre y su oficio, la semilla, los ajustes y el mapa levantado con su título.
- GIVEN una partida sin ningún documento de estado WHEN se abre la app THEN se abre en el arranque, que es lo que ve quien la instala.
- GIVEN una partida que se está levantando WHEN todavía no se sabe si la hay THEN no se pinta ni la portada ni el arranque.
- GIVEN una partida con un borrado a medias marcado WHEN se abre la app THEN el borrado se remata antes de intentar leer nada y se llega al arranque.
- GIVEN una importación a medio escribir WHEN se abre la app THEN la partida no se abre y se dice que hay que volver a importar el fichero entero.

### Dar la cara

- GIVEN un documento de estado que no se puede leer WHEN se abre la app THEN se enseña la avería con el motivo y **no se cae al estado inicial**.
- GIVEN la avería a la vista WHEN se mira qué se puede hacer THEN se ofrece abrir una copia, y ninguna acción que borre la partida.
- GIVEN un documento de estado legible y un registro de hechos ilegible WHEN se abre la app THEN la partida se abre igual y lo que falla es la red de seguridad, no la partida.
- GIVEN un documento de estado de una versión de formato mayor que la que este juego entiende WHEN se abre la app THEN se enseña la avería declarando las dos versiones y no se toca nada.

### Migrar una partida vieja

- GIVEN un documento de partida de una versión anterior y la cadena con su paso WHEN se abre la app THEN se migra, la partida se abre y queda declarado de qué versión venía.
- GIVEN una partida migrada WHEN se mira el almacén THEN los documentos guardados están ya en la versión actual y la procedencia dice que se migró.
- GIVEN un documento de una versión anterior y la cadena sin el paso que hace falta WHEN se abre la app THEN se enseña la avería nombrando el salto que falta y **no se interpreta con las reglas nuevas**.
- GIVEN una migración cuyo resultado no se puede levantar WHEN se abre la app THEN no se escribe el documento migrado y se enseña la avería.

### Lo que sale y lo que entra

- GIVEN una partida jugada WHEN se guarda una copia THEN el fichero trae el documento de estado y el registro de hechos entre sus partes.
- GIVEN una copia con documento de partida WHEN se importa THEN al volver a abrir la app la partida es la de la copia y no la anterior.
- GIVEN una partida recién nacida y sin nada jugado WHEN se guarda una copia THEN el fichero se produce igual, con su documento de estado dentro.

### Privacidad y determinismo

- GIVEN cualquier congelación WHEN se escribe el documento de estado THEN no lleva ninguna coordenada, ningún histórico de posiciones y ningún identificador de instalación.
- GIVEN el mismo estado congelado dos veces WHEN se comparan los dos textos THEN son idénticos byte a byte.

## UX Design

### Wireframe textual

**Ninguna pantalla del juego cambia y ninguna se añade al diagrama.** Lo que cambia es por dónde entra la app y qué se pinta mientras no se sabe.

**Al abrir, tres salidas y una espera**, resueltas antes de pintar nada:

```
  [abriendo la partida]        ← superficie en blanco con el color del papel, sin texto
        │
        ├── hay partida ─────► A6P1, la portada (pantalla 20 · artefacto 4)
        ├── no hay partida ──► A1P1, el arranque (pantalla 1 · artefacto 1)
        └── no se puede leer ► la avería
```

**La avería** es una superficie propia y no una pantalla de diseño: una sola columna sobre el papel, con

1. una línea que dice que la partida guardada no se ha podido abrir,
2. el motivo, literal, tal y como lo declara quien falló —la versión que no se entiende, el salto de migración que falta, la importación a medias—,
3. la acción de **abrir una copia**, que es el mismo `AbrirCopia` que A1P1 ya ofrece,
4. y nada más. **Ningún botón que borre, ningún «empezar de nuevo», ningún «continuar de todas formas».**

La superficie de espera no lleva texto ni indicador: la lectura de la partida tarda lo que tarda un fichero, y un rótulo de carga que aparece y desaparece en un fotograma es peor que el papel quieto.

### Pantallas y elementos utilizados

- **A1P1-A1P7**, el arranque (artefacto 1). No cambia; lo que cambia es que deja de ser la única entrada.
- **A6P1**, la portada (artefacto 4). No cambia; pasa a ser la entrada de cualquier día que no sea el primero.
- **La avería**, superficie nueva, **fuera de `docs/flujo.md` a propósito**: no es una pantalla del juego sino la app confesando un fallo, que es el único registro donde `lenguaje.md` deja hablar como aplicación. Su texto definitivo es el pendiente 3 de `game-design/partida-guardada.md` —«qué se le dice al jugador si la reconstrucción de emergencia da otro estado»—, que sigue abierto: lo que esta fila entrega es la superficie y el motivo literal, no la redacción cerrada.
- **La superficie de espera**, sin elementos.

### data-testid

- `partida-abriendo` — la superficie de espera.
- `partida-averiada` — la superficie de avería.
- `partida-averiada-motivo` — la línea del motivo, literal.

Los de la portada, el arranque y abrir una copia ya existen y no cambian.

### Patrón de interacción

- **Levantar va antes de pintar, y no en paralelo.** Pintar el arranque y sustituirlo por la portada medio segundo después enseñaría a quien juega una pantalla que no le corresponde y, peor, dejaría un instante en el que «no hay partida» y «todavía no se sabe» son indistinguibles. Es la misma regla que SPEC-040 aplicó al borrado a medias.
- **Un documento que no se puede leer da la cara y no se degrada.** Caer a `estadoInicial` haría que perder la partida se pareciera a empezarla, que es la degradación silenciosa más cara que este proyecto puede tener (`decisiones-orquestador.md` §6h). La avería no ofrece continuar: continuar sería exactamente eso.
- **Congelar es idempotente y por eso puede ocurrir en muchos sitios.** Si el texto canónico del estado no ha cambiado desde la última congelación, no se reescribe nada. Eso es lo que permite congelar en cada corte del juego **y** al irse al fondo sin que la app escriba en disco a cada paso.
- **No se congela en cada cambio de estado.** Escribir un documento entero por cada interruptor es escribir en disco a cada paso; los cortes del juego y el paso a segundo plano cubren entre los dos todo lo que el sistema puede interrumpir.
- **Migrar ocurre al abrir y una sola vez.** Los documentos migrados se escriben en el almacén, de modo que la segunda apertura ya no migra nada y el coste no se paga dos veces. Un documento migrado que no se puede levantar **no se escribe**: sustituir el bueno por uno roto es peor que no migrar.
- **La avería es la única superficie con voz de aplicación de esta fila**, y lo es por la excepción que `game-design/partida-guardada.md` §4 ya reconoce: disfrazar de mundo el hecho de que la partida no se abre sería una trampa.

## Notas técnicas

### Cuándo se congela, y por qué esos cuatro momentos

1. **Al cerrar el arranque**, cuando la partida nace. Sin esto, todo lo demás persistiría a partir de la segunda sesión y la primera se perdería entera.
2. **Al volver de una pantalla de consulta.** Es el sitio donde el estado puede cambiar sin que haya una salida de por medio: los interruptores de ajustes cuando la fila 46 los conecte, y el estilo de pintado y el tamaño de letra cuando la fila 38 les dé pantalla de elección. Hoy ninguno de los tres escribe, y el punto de congelación se pone igual: ponerlo después, cuando alguno empiece a escribir, es cómo se pierde un ajuste sin que nada proteste.
3. **Al echarse a andar y al cerrar una salida** —el telón—. Hoy la fila 44 no está cableada; el punto de enganche se deja puesto y declarado, y aquella fila lo llama sin volver a tocar esto.
4. **Cuando la app pasa a segundo plano** (`AppState`, `background` e `inactive`). Es la red que cubre lo que ninguno de los tres anteriores cubre: a una app la mata el sistema sin avisar, y no hay ningún evento de «me van a matar».

No se congela al cerrar la app y ya está, y no se congela en cada cambio de estado. Lo primero no existe como evento fiable; lo segundo es escribir en disco a cada paso.

### La frontera de inyección

La orquestación nueva vive en `app/datos/` y **recibe el generador inyectado**, como `copia.js`, `empezar-de-nuevo.js` y `levantamiento.js`: enumera lo que necesita en su `DEL_NUCLEO` y quien la monta lo importa desde `app/nucleo/piezas.js`. Es la regla de SPEC-020 repetida en SPEC-039 y SPEC-040, y existe por una razón medida (§6u): citar `@walkingadventure/nucleo` desde el propio módulo deja fuera del alcance de `node --test` sin instalación todo lo que de verdad se puede afirmar de esta fila.

Lo que hace falta del paquete, y por qué cada pieza:

- `guardaPartida` y `cargaPartida` (`partida/reconstruccion.js`) son el par canónico y hacen el trabajo: aquella escribe el registro primero y el estado después, esta recupera una compactación a medias antes de leer nada y aplica hacia delante la cola de hechos que un apagón dejara pendiente. **No se reimplementa aquí ni una de esas dos reglas.**
- `congelaEstado` (`partida/estado.js`) se llama **para decidir si hace falta escribir**: su documento pasado por el texto canónico es el sello con el que se compara la congelación anterior. Es lo que sostiene «congelar es idempotente», y sin ello ese criterio no sería afirmable.
- `levantaEstado` y `levantaRegistro` se llaman **dentro de la migración, antes de escribir el resultado**: un documento migrado que no se puede levantar se descarta y da la cara, en vez de sustituir al bueno y fallar más tarde.
- `migra` y `CADENA_DEL_FORMATO` (`partida/migracion.js`) hacen el salto; la cadena entra **inyectada y con la real por defecto**, que es lo que permite ejercitar la migración hoy con la versión de formato todavía en 1.
- `CLAVES_DE_PARTIDA` para saber dónde viven los dos documentos, `lee` y `texto` del formato para el texto canónico, `documentoDeProcedencia`, `PROCEDENCIAS` y `CLAVE_DE_PROCEDENCIA` para declarar de dónde salió la partida abierta, y `exigeSinImportacionAMedias` para no abrir una mezcla de dos partidas.
- `registroInicial` y `estadoInicial` para la partida que nace.

No entra ninguna dependencia nueva. `AppState` es de `react-native` y ya está.

### Levantar el mapa al volver

La portada necesita el documento del mundo, no solo el estado. Al abrir se levanta con `levantamiento.abre({ id, semilla, tamano })`, que **no toca la red** y lee del almacén, y el `id` es el **primero por identificador** de los mapas levantados.

Eso es una limitación y se declara: **cuál es el mapa activo lo decide dónde estás** (RF-PERS-007), y saber dónde estás pide el módulo de ubicación, que es la fila 48. Mientras esa fila no exista, «el primero por identificador» es la única regla determinista disponible, y es la misma que la fila 39 ya usa para dar nombre al fichero exportado. Con un solo mapa —que es el caso de toda partida que no ha viajado— las dos reglas coinciden.

### Lo que esta fila no puede demostrar, y hay que decirlo con el número delante

**Hoy nada de `app/` altera el estado de la partida después de que el arranque se cierre.** Medido leyendo la fuente: `ConsultaMontada` compone las cuatro pantallas de consulta y las cuatro **solo leen**; el único interruptor que escribiría —los pasos de fondo, que llaman a `cambiaAjuste`— recibe `alCambiarInterruptor` a `null` porque `App.js` no monta el zurrón (fila 46); las llegadas, las escenas y el telón, que son quienes emiten hechos, esperan al módulo de ubicación (fila 48) y a las dos pantallas que nunca se escribieron (fila 49).

Consecuencia para la verificación en el dispositivo: **lo que puede dejar huella hoy es el personaje, la semilla, los ajustes de origen y el mapa levantado**, y no una entrada de diario ni un objeto en la repisa. Que la partida sobreviva a matar la app se mide con eso, que es real y es lo que hay; medirlo con un diario que nadie escribe sería medir el vacío.

Y de ahí la segunda consecuencia, que es la que hay que dejar fichada en lugar de estirar la fila: **la siembra de un documento de partida con contenido —dos versiones del mismo suceso, objetos, motes, dos mapas— no cabe aquí.** El documento sembrado lo produce el núcleo jugando N días en headless, pero para que llegue al dispositivo hace falta o una puerta que lo importe o una vía de desarrollo que lo escriba, y las dos son diseño que esta fila no tiene mandato para decidir. Sin siembra, `repisa.yaml` **no puede salir** de la columna de límite declarado, y `diario.yaml` tampoco podría aunque la hubiera, porque su cuerpo pasa por `paso-llegada` y `setLocation`, que son de la fila 48.

## Decisiones asumidas

- **Qué se hace con un documento de estado ilegible** → asumido dar la cara con una superficie de avería que ofrece abrir una copia y nada más. Alternativa: reconstruir desde el registro de hechos, que el núcleo sabe hacer. Regla: `partida-guardada.md` §2 dice que la reconstrucción es de emergencia y que hay que avisar de que puede diferir, y `reconstruccion.js` lo dice por escrito —«reconstruir por iniciativa propia sería disimular el fallo»—. Reconstruir sin preguntar es exactamente eso. La puerta a reconstruir queda para cuando el pendiente 3 de `partida-guardada.md` cierre su texto.
- **Qué se pinta mientras se levanta la partida** → asumido una superficie en blanco con el color del papel, sin texto ni indicador. Alternativa: el arranque, y sustituirlo si aparece partida. Regla: es la misma que gobierna el borrado a medias en SPEC-040 —no se enseña una partida a medio abrir—, y aquí además evita que «no hay partida» y «todavía no se sabe» se vean igual.
- **Cuál es el mapa que se levanta al volver** → asumido el primero por identificador. Alternativa: el mapa activo por posición, que es lo que RF-PERS-007 pide. Regla: resolverlo pide ubicación (fila 48); la regla elegida es determinista y coincide con la que ya usa la exportación para nombrar el fichero.
- **Si el registro de hechos se escribe aunque esté vacío** → asumido que sí, desde que la partida nace. Alternativa: escribirlo solo cuando haya el primer hecho. Regla: `cargaPartida` distingue «el registro no se puede leer» de «no está», y un registro ausente en la primera sesión y presente en la segunda haría que ese diagnóstico dijera cosas distintas por la edad de la partida y no por lo que le pasa.
- **Dónde se declara la procedencia de una partida migrada** → asumido `partida/procedencia.json`, con `documentoDeProcedencia({ de: 'migracion', migradaDesde, reglas })`. Alternativa: no declararla. Regla: la clave y el esquema ya existen de la fila 39 para las importadas, y una partida migrada sin declararlo es indistinguible de una que nunca lo estuvo.
- **Si la avería entra en `docs/flujo.md`** → asumido que no. Alternativa: añadirle nodo. Regla: la misma que SPEC-045 aplicó a la puerta de desarrollo — el diagrama son las cuarenta pantallas de los seis artefactos de diseño, y esta superficie no es de diseño. Añadirle nodo es cambio de diseño y queda propuesto, no hecho.
