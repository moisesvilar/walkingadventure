# SPEC-054 — El cuaderno de a bordo: una traza compartible para medir la app de pie

## Descripción

El cuaderno de a bordo es una herramienta de desarrollo para observar una salida cuando no hay Metro delante: se enciende desde el andamiaje, registra en un fichero lo que ocurre durante la ejecución y permite compartirlo mediante la hoja del sistema. Incluye posiciones reales, decisiones de la salida y errores de JavaScript con su pila, porque son precisamente los datos que hoy desaparecen al probar de pie en un aparato.

No es una función del juego. Solo existe tras `__DEV__`, no aparece en `docs/flujo.md`, no envía nada automáticamente y guarda su contenido bajo un prefijo propio de caché, fuera de la partida, de sus copias y de sus exportaciones.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes,
  páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests
  de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega.
  Los tests los genera la skill `wa-qa-dev` y los ejecuta `wa-qa-tester` contra el código ya
  commiteado, en un paso posterior del bucle de QA de este repo. Cualquier test que el implementador
  entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica
  explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Fuera de alcance:** no se cambia ninguna pantalla del juego, `docs/flujo.md`, la partida ni su formato; no se añaden dependencias; no se siembran `console.log`; no se introduce envío automático, telemetría ni un servicio remoto; y no se modifican las guardas de privacidad, el manifiesto ni los permisos.

## Criterios de aceptación

### Presencia y ciclo de vida

- GIVEN una compilación de desarrollo abierta por `walkingadventure://desarrollo` WHEN se muestra el andamiaje THEN aparece la sección «Cuaderno de a bordo» con su estado, el interruptor, la acción de compartir y el aviso de privacidad.
- GIVEN el cuaderno apagado y sin un fichero anterior WHEN se mira su sección THEN el estado dice «Apagado» y compartir está deshabilitado.
- GIVEN el cuaderno apagado WHEN se enciende el interruptor THEN queda activo inmediatamente y el primer registro identifica el inicio de una sesión de cuaderno.
- GIVEN el cuaderno encendido WHEN la app se reinicia en una compilación de desarrollo THEN continúa encendido y conserva el fichero para poder recoger y compartir una avería que haya interrumpido el proceso.
- GIVEN el cuaderno encendido con registros WHEN se apaga el interruptor THEN se borra el fichero completo y también la marca de que estaba encendido.
- GIVEN el cuaderno apagado después de borrarlo WHEN la app sigue ejecutándose THEN no se añade ningún registro nuevo.
- GIVEN el cuaderno encendido WHEN el sistema elimina la caché o la app se desinstala THEN la ausencia posterior del fichero se trata como cuaderno vacío y no como una avería de la partida.
- GIVEN una compilación de producción WHEN arranca la app o se abre `walkingadventure://desarrollo` THEN el cuaderno no se registra, no instala manejadores, no crea su prefijo de caché y no expone controles ni símbolos alcanzables del módulo.

### Formato y límite

- GIVEN el cuaderno encendido WHEN se registra cualquier acontecimiento THEN se añade una línea JSON válida con versión de formato, secuencia creciente, instante real en UTC, tipo cerrado y datos propios del acontecimiento.
- GIVEN un fichero con varias líneas WHEN se lee de principio a fin THEN cada línea puede analizarse por separado y el orden de secuencia reproduce el orden en que el cuaderno recibió los acontecimientos.
- GIVEN un dato opcional ausente WHEN se escribe su acontecimiento THEN la línea sigue siendo JSON válida y declara la ausencia con `null` o con un motivo, sin inventar un valor.
- GIVEN un dato que no puede convertirse a JSON WHEN se intenta registrar THEN el cuaderno escribe una línea de avería serializable que nombra el tipo original y continúa recogiendo acontecimientos posteriores.
- GIVEN un paseo largo cuyo cuaderno alcanzaría más de 5 MiB WHEN entra una línea nueva THEN el fichero conserva la cabecera de la sesión y las líneas más recientes dentro del tope, e incluye una línea que declara cuántas anteriores se descartaron.
- GIVEN una sola línea mayor que el espacio disponible WHEN se registra THEN se sustituye por una línea válida que declara su truncado y el fichero nunca supera 5 MiB.
- GIVEN varias escrituras solicitadas casi a la vez WHEN terminan THEN ninguna línea queda mezclada, partida ni sobrescrita por una carrera.
- GIVEN que una escritura del cuaderno falla WHEN se intenta registrar THEN la salida y la partida continúan funcionando y la sección del andamiaje muestra la avería del cuaderno sin convertirla en una avería de la salida.

### Lo que se observa durante una salida

- GIVEN el cuaderno encendido WHEN se intenta abrir una salida THEN se registra el intento y su resultado: abierta o rechazada, con la marca y el motivo que ya devuelve la salida.
- GIVEN el cuaderno encendido WHEN el sistema entrega o rechaza un fijo para anclar el punto de partida THEN se registra su procedencia, aceptación o rechazo, edad en milisegundos, precisión, coordenadas si existen y motivo de la decisión.
- GIVEN el cuaderno encendido WHEN el primer fijo bueno re-ancla el punto de partida THEN se registra el ancla anterior, la nueva, la edad y precisión del fijo y el motivo del re-anclaje.
- GIVEN el cuaderno encendido WHEN un re-anclaje se rechaza por haberse alejado ya o por haberse hecho antes THEN se registra el rechazo con el motivo existente y sin alterar la decisión de la salida.
- GIVEN el cuaderno encendido y una salida abierta WHEN llega una muestra de posición THEN se registran coordenadas, marca del sensor, edad respecto del reloj real, precisión y clasificación de transporte.
- GIVEN el sensor todavía sin posición WHEN la salida pide una muestra THEN se registra «sin fijo» y la salida continúa con su comportamiento actual.
- GIVEN el cuaderno encendido WHEN se decide o cambia la cadencia THEN se registran la cadencia anterior, la elegida y la razón ya calculada —fuera de geofence, sitio cercano o punto de partida—.
- GIVEN el cuaderno encendido WHEN una posición entra, permanece o sale del geofence de un sitio THEN se registra el sitio real, su identificador, la distancia y el estado de la permanencia que conduce a aceptar o rechazar la llegada.
- GIVEN el cuaderno encendido WHEN una llegada queda validada THEN se registra el sitio, la salida, la forma de su secuencia y el paso vigente, aunque la llegada no emita aviso alguno hacia la plataforma.
- GIVEN el cuaderno encendido WHEN la salida cambia de situación THEN se registran la situación anterior, la nueva y el motivo existente, incluidos apertura, retirada del rótulo, reanudación, cierre y telón leído.
- GIVEN el cuaderno encendido WHEN cambia una marca observable de la salida THEN se registran su nombre y valor, incluidas `salida-averia` y su valor explícito `sin-averia`.
- GIVEN el cuaderno encendido WHEN una pieza de la salida captura una avería THEN se registran el mensaje, la pila disponible y el punto de la vida de la salida donde ocurrió.
- GIVEN el cuaderno apagado WHEN se conduce el mismo trecho THEN ninguna posición, coordenada, sitio, cadencia, llegada, marca ni avería se escribe en caché.

### Errores globales

- GIVEN el cuaderno encendido WHEN ocurre una excepción JavaScript no capturada THEN se registra antes de delegarla al manejador global que ya hubiera, con nombre, mensaje, pila y condición fatal o no fatal.
- GIVEN el cuaderno encendido WHEN una promesa queda rechazada sin captura THEN se registra su razón y la pila disponible antes de conservar el comportamiento global previo.
- GIVEN el valor lanzado o rechazado no es un objeto `Error` WHEN lo recoge el cuaderno THEN se registra una representación serializable y se declara que no había pila.
- GIVEN ya existía un manejador global WHEN el cuaderno se enciende y después se apaga THEN el manejador anterior recibe los errores mientras está encendido y queda restaurado al apagar, sin envolturas duplicadas.
- GIVEN el cuaderno encendido WHEN se pulsa «Provocar error JS» THEN se provoca por la misma vía global una excepción de diagnóstico identificable y el fichero contiene su pila.
- GIVEN el cuaderno encendido WHEN se pulsa «Provocar rechazo» THEN se provoca por la misma vía global un rechazo de diagnóstico identificable y el fichero contiene su razón y la pila disponible.
- GIVEN el cuaderno apagado WHEN se muestran las acciones de diagnóstico THEN ambas están deshabilitadas y no pueden provocar errores por accidente.

### Compartir y privacidad

- GIVEN el cuaderno contiene al menos una línea WHEN se pulsa «Compartir el cuaderno» THEN la hoja nativa se abre con la URL de un fichero legible y no se modifica ni se borra el cuaderno.
- GIVEN la hoja nativa se cierra, se cancela o resuelve al abrir su selector WHEN se vuelve al andamiaje THEN el fichero sigue disponible y compartir no cambia el estado del interruptor.
- GIVEN la creación del fichero compartible o la hoja del sistema falla WHEN se intenta compartir THEN se muestra un mensaje de error en la sección y el cuaderno original permanece intacto.
- GIVEN el cuaderno está vacío o su fichero desapareció de la caché WHEN se intenta compartir THEN la acción permanece deshabilitada y el estado dice «Todavía no hay nada que compartir».
- GIVEN el cuaderno encendido WHEN se inspecciona su almacenamiento THEN todos sus ficheros y su marca de activación viven bajo un único prefijo `cache/cuaderno-de-a-bordo/`, fuera de `partida/` y del directorio de documentos.
- GIVEN se genera una copia de respaldo o una exportación de la partida WHEN el cuaderno contiene coordenadas y sitios reales THEN ningún fichero ni dato del cuaderno aparece en la copia, el manifiesto o la exportación.
- GIVEN el aviso de privacidad está a la vista WHEN se lee THEN dice que el fichero contiene posiciones y sitios reales, que la app no lo envía y que solo sale del aparato si quien prueba pulsa compartir.

### Doctrina escrita

- GIVEN la entrega terminada WHEN se lee la cabecera de `app/plataforma/puerta-de-desarrollo.js` THEN conserva que la puerta no persiste ni escribe y añade, con fecha 14-ago-2026, que el cuaderno es una herramienta separada tras la misma llave, con prefijo y ciclo de vida propios.
- GIVEN la entrega terminada WHEN se lee `docs/iphone.md` THEN el cuaderno figura como preparado y explica en una línea cómo encenderlo, conducir una salida y compartirlo el día del salto.

## UX Design

### Wireframe textual

**Pantalla de andamiaje — herramienta fuera de `docs/flujo.md`**

Se conserva el `ScrollView` y el layout vertical de `app/pantallas/andamiaje.js`, en voz de aplicación y con tipografía sans. Después de «Las capacidades» y su lista se añade un filete y este bloque:

```text
Cuaderno de a bordo
Registra posiciones, decisiones y errores para poder medir la app sin Metro.

[ Cuaderno de a bordo                         (interruptor) ]
  Apagado

Contiene posiciones y sitios reales. La app no lo envía:
solo sale de este aparato si pulsas compartir.

[ Compartir el cuaderno ]
[ Provocar error JS ]    [ Provocar rechazo ]

Todavía no hay nada que compartir. / Cuaderno listo para compartir. / <avería concreta>
```

La fila completa del interruptor es tocable y el `Switch` pintado no captura el toque por separado. Encendido, la línea de estado dice «Encendido · escribiendo»; apagado, «Apagado». «Compartir el cuaderno» usa un botón sólido cuando hay contenido y queda deshabilitado sin contenido. Las dos acciones de diagnóstico son secundarias, están rotuladas literalmente, quedan deshabilitadas con el cuaderno apagado y nunca aparecen en una pantalla del juego.

No se añade confirmación al compartir: es una acción no destructiva y la propia hoja es el siguiente paso. Apagar sí borra, pero el texto «Apagar y borrar el cuaderno» sustituye al rótulo simple de la fila mientras está encendido, de modo que la consecuencia está dicha antes del toque; no se añade un segundo diálogo a una herramienta deliberada de desarrollo.

### Pantallas y elementos utilizados

- Pantalla modificada: `app/pantallas/andamiaje.js`, herramienta de desarrollo sin nodo en `docs/flujo.md` por la doctrina de `pipeline/decisiones-orquestador.md` §6y.
- Elementos existentes: `ScrollView`, `View`, `Text`, `Switch`, `Pressable`, filete y hoja nativa de compartir.
- Elementos nuevos dentro del andamiaje: bloque «Cuaderno de a bordo», fila de interruptor, aviso de privacidad, botón de compartir, dos botones de diagnóstico y línea de estado/error.
- Ninguna pantalla ni elemento del juego cambia.

### data-testid

- `cuaderno-de-a-bordo` — contenedor completo y estado de presencia de la herramienta.
- `cuaderno-interruptor` — fila tocable que enciende o apaga y borra.
- `cuaderno-estado` — estado encendido, apagado, vacío o averiado.
- `cuaderno-compartir` — acción que abre la hoja del sistema.
- `cuaderno-provocar-error` — acción de diagnóstico para la excepción global.
- `cuaderno-provocar-rechazo` — acción de diagnóstico para la promesa sin captura.
- `cuaderno-privacidad` — aviso estable de que el fichero contiene ubicaciones reales y no se envía solo.

### Patrón de interacción

- **Herramienta dentro del andamiaje, no pantalla nueva.** La doctrina de §6y reserva la puerta de desarrollo para herramientas que no pertenecen a `docs/flujo.md`; añadir otra navegación no aportaría nada y acercaría el control a una pantalla del juego.
- **Registro de aplicación.** El andamiaje y el cuaderno hablan en sans y con textos directos porque son ajustes técnicos, la excepción expresa a la voz del mundo.
- **Toda la fila del interruptor responde.** Es el patrón medido en `CLAUDE.md`: el área sensible no queda reducida al dibujo del `Switch` y el valor visible no puede separarse del toque.
- **El borrado está escrito en la acción.** Apagar es la única acción destructiva y se nombra «Apagar y borrar el cuaderno» mientras está encendido. Compartir jamás borra ni altera estado, porque la resolución de `Share.share` solo acredita que el selector se abrió.
- **Dos acciones de diagnóstico explícitas.** No se esconden detrás de gestos ni se disparan al encender: una prueba de una ruta global debe ser deliberada y distinguible en el fichero.
- **Sin comportamiento responsive.** Es una app móvil y este bloque sigue el ancho y el desplazamiento vertical del andamiaje existente; en anchos estrechos las dos acciones de diagnóstico se apilan sin cambiar su orden.

## Notas técnicas

- **La frontera del núcleo no cambia.** El cuaderno observa en la capa de aplicación los datos y resultados que ya producen la fuente, la traza, la salida y las llegadas. Cuando un momento hoy no emite —en particular la llegada validada— se añade una costura de observación inyectada en su orquestación, sin trasladar reloj, fichero, `Share` ni estado del cuaderno al paquete determinista y sin cambiar la decisión de dominio.
- El formato del fichero es **JSON Lines UTF-8**, una línea por acontecimiento. Cada línea contiene al menos `{ version, secuencia, instante, tipo, datos }`; `instante` sale del reloj real de plataforma porque el cuaderno vive fuera de la partida. El comentario de cabecera del módulo debe declarar expresamente esta excepción respecto de SPEC-016.
- El vocabulario de `tipo` es cerrado y distingue al menos sesión, apertura, fijo de anclaje, re-anclaje, posición, cadencia, geofence, llegada, situación, marca, avería, error global, rechazo global, truncado y avería del propio cuaderno. Los campos `lat`, `lon`, `tMs`, `edadMs`, `precisionM`, `clasificacion`, `sitio`, `motivo`, `mensaje` y `pila` conservan esos nombres cuando aplican para que el fichero se pueda leer y filtrar sin interpretar prosa.
- La marca de activación y el fichero viven bajo `cache/cuaderno-de-a-bordo/`. Persistir la activación permite que un error fatal y un reinicio no destruyan el instrumento antes de compartirlo; solo se consulta y registra en desarrollo. Apagar elimina el prefijo entero.
- El tope es **5 MiB por todo el prefijo**. La retención es un anillo lógico de líneas: cabecera de sesión más final reciente. El descarte y el truncado quedan declarados dentro del propio fichero; nunca se produce JSON parcial.
- La captura global envuelve y delega los manejadores existentes de excepciones y rechazos. Encender dos veces es idempotente; apagar restaura exactamente lo que había. La instalación concreta debe usar las capacidades reales de la versión de React Native/Hermes del proyecto y fallar de forma visible si una de las dos vías no está disponible; no se da por equivalente un evento de navegador que el aparato no ofrezca.
- Compartir reutiliza `Share.share({ url })`, como `app/plataforma/copia-del-sistema.js`, y no añade dependencias. El fichero que se comparte puede ser el propio cuaderno o una copia estable dentro del mismo prefijo; en ambos casos sigue siendo caché y nunca `partida/` ni documentos.
- Las reglas vigentes de respaldo y exportación parten de `partida/`; la entrega no las ensancha para incluir caché. La comprobación negativa debe afirmar tanto las reglas como el artefacto producido, porque las coordenadas del cuaderno son deliberadamente sensibles.
- La instrumentación no usa `console.log` como transporte y no altera retornos, excepciones, cadencias ni decisiones. Una avería al observar o escribir se contiene dentro del cuaderno y se enseña en su bloque.
- La verificación de aparato debe conducir una salida con el bucle de posición activo —`adb emu geo fix` no alimenta si nadie pide— y comprobar un fichero compartido que contenga posiciones con edad y clasificación, cambios de cadencia, una llegada, marcas, re-anclaje y un error provocado con pila. La toma y liberación de `wa-pixel` sigue `pipeline/decisiones-orquestador.md` §14e; las tandas sin aparato usan `--nucleo-only`.

## Decisiones asumidas

- **Persistencia del interruptor tras reiniciar** → asumido que el estado encendido persiste dentro del mismo prefijo de caché y vuelve a instalar la observación solo en desarrollo (alternativa: volver siempre apagado y conservar únicamente el fichero). Regla: un error fatal no puede borrar o dejar incompleto el instrumento antes de que el dueño vuelva a abrir y compartir; la puerta de navegación sigue sin persistir.
- **Formato legible y recuperable** → asumido JSON Lines UTF-8 con esquema por línea (alternativa: un único documento JSON o texto libre). Regla: una interrupción no invalida lo ya escrito y cada acontecimiento se puede inspeccionar de forma independiente.
- **Límite de almacenamiento** → asumido 5 MiB totales con cabecera y cola reciente (alternativa: troceo en varios ficheros o otro tope). Regla: cabe holgadamente en una hoja de compartir y limita de forma explícita una salida larga sin ocultar que hubo descarte.
- **Prueba de los dos manejadores globales** → asumidas dos acciones separadas, «Provocar error JS» y «Provocar rechazo» (alternativa: una sola acción que solo pruebe excepciones). Regla: excepción global y rechazo sin captura son dos promesas distintas del encargo y deben poder medirse por separado en `wa-pixel`.
- **Apagado destructivo sin diálogo** → asumido rótulo dinámico «Apagar y borrar el cuaderno», sin confirmación adicional (alternativa: diálogo de confirmación). Regla: es una herramienta de desarrollo, el borrado es requisito explícito y la consecuencia queda nombrada antes del toque.
