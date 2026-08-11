# SPEC-048 — El módulo de ubicación y el rótulo del sistema

## Descripción

La app no sabe leer el GPS. `app/package.json` no declara ningún módulo de ubicación, y los **tres** contratos que lo esperan —el proveedor del arranque, la fuente de posiciones de la salida y el seguidor del momento en marcha— reciben hoy su «sin montar», que protesta al usarse. Por eso A1P3 enseña «Permitir» apagado y el arranque sale por la vía de elegir el punto a mano, y por eso la marca de posición del mapa no se ha movido nunca. Y no hay rótulo del sistema: `app/plataforma/rotulo.ios.js` y `rotulo.android.js` están escritos, tienen su contrato y **no los llama nadie**, así que la regla que sostiene el permiso «mientras se usa» con la pantalla apagada es hoy un comentario.

Esta fila trae el sensor y el rótulo. Dos dependencias, **`expo-location`** y **`expo-task-manager`**, y ninguna más. Cablea los tres contratos con llamador de verdad desde `app/` —no solo desde las pruebas—, monta el **servicio en primer plano de Android con notificación persistente**, y con él conecta la vida de una salida que `packages/nucleo/partida/salidas.js` lleva escrita y probada desde SPEC-030 sin que la llamara nadie: abrir con el rótulo puesto, el plazo que lo retira sin cerrar la salida, la reconciliación con lo que de verdad hay en la pantalla de bloqueo, y el cierre por volver o a mano.

Dónde termina la fila, y es el criterio que la cierra: **en marcha se ve la posición moverse con `adb emu geo fix` y el detector de transporte clasifica**. Eso se verifica solo, sin depender de ninguna otra fila. El camino de la llegada —geofence, llegada, visor, ficha, lo que aquí se cuenta, descarte— es la **fila 44, que sigue entera**, y no se toca aquí.

Las promesas no se relajan ni un milímetro por tener servicio en primer plano, y con él pasan por el seguidor muchas más posiciones que antes. **El permiso permanente no se pide nunca** y no aparece en el manifiesto generado. **No se guarda ninguna traza**: lo que sobrevive de todas esas posiciones es un punto y dos marcas, declarados en el esquema y muertos con la salida, y nada más. **Ningún identificador persistente por instalación.** Y **denegar es una respuesta; no poder preguntar es una avería**, que se ven distintas y llevan a sitios distintos.

Anclas: **RF-BUCLE-001**, **RF-BUCLE-005**, **RF-BUCLE-006**, **RF-INFRA-004** y **RF-PRIV-002**. Las fuentes que mandan son `game-design/seguridad-privacidad.md` §1 y §2, `game-design/bucle-jugable.md` §8 y §9, y `game-design/accesibilidad.md` §3. Consume, sin rediseñar nada de ello, lo entregado y probado en el paquete: `partida/salidas.js`, `partida/rotulo.js`, `partida/regreso.js`, `partida/transporte.js`, `partida/ritmo.js`, `partida/en-marcha.js` y `partida/onboarding.js`.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes,
  páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests
  de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega.
  Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya
  commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador
  entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca**: el módulo nativo entra por la firma de los tres contratos ya escritos y por la de `creaRotulo`, y las orquestaciones nuevas de `app/` reciben el generador inyectado desde `app/nucleo/piezas.js`, como manda SPEC-020.
- **Dos dependencias nuevas y ninguna más: `expo-location` y `expo-task-manager`.** Si al implementar aparece una tercera, **no se mete**: se para y se dice, con el nombre de la dependencia y de la pieza que la pedía.
- **Fuera de alcance — el camino de la llegada entero.** El geofence, la llegada, el visor, la ficha, lo que aquí se cuenta, el descarte y la primera coincidencia son la **fila 44, `navegacion-en-la-calle`, que sigue entera**. Aquí no se monta ninguna de sus pantallas y no se cablea `partida/llegadas.js`. **Las ocho pantallas huérfanas siguen siendo ocho** al terminar esta fila, y quien lea el checklist no debe esperar que bajen.
- **Fuera de alcance — la escena de un beat (A4P3, A4P4) y el telón (A5P1-A5P4)**: son la fila 49. La única costura es que cerrar una salida deja un telón pendiente y esta fila tiene que dejarlo alcanzable; se resuelve con un hueco declarado, descrito en «El telón pendiente, y la costura que no se puede evitar».
- **Fuera de alcance — el zurrón y la fuente de salud**: son la fila 46. Ningún interruptor de pasos de fondo se conecta aquí.
- **Fuera de alcance — las pantallas de elección de las filas de valor de A6P6**: son la fila 38.
- **Fuera de alcance — la Actividad en Vivo de iOS.** `rotulo.ios.js` sigue existiendo con las mismas exportaciones que su pareja, como exige `CLAUDE.md`, y lo que entrega en iOS queda **declarado como límite** con su motivo y con la dependencia que haría falta nombrada. Es un límite con AC, no un comentario.

## Criterios de aceptación

Los de `@privacidad` y `@determinismo` son **bloqueantes**: nada se entrega con uno en rojo.

### Las dos dependencias y lo que la app declara

- GIVEN `app/package.json` WHEN se leen sus dependencias THEN aparecen `expo-location` y `expo-task-manager`, y ninguna otra dependencia nueva respecto de la entrega anterior.
- GIVEN `app/plataforma/permisos.js` WHEN se lee el motivo de cada dependencia nueva THEN cada una dice para qué está y qué fila la trajo.
- GIVEN `app/app.json` WHEN se pasa por `revisaLaDeclaracion` THEN no devuelve ningún problema.
- GIVEN la configuración del plugin de `expo-location` en `app/app.json` WHEN se lee THEN la ubicación de fondo de Android está apagada **de forma explícita** y el servicio en primer plano está encendido **de forma explícita**, ninguno de los dos por omisión.
- GIVEN el `AndroidManifest.xml` **generado por la compilación nativa** WHEN se enumeran sus `uses-permission` THEN no aparece `ACCESS_BACKGROUND_LOCATION`.
- GIVEN ese mismo manifiesto generado WHEN se buscan los permisos que `LO_QUE_NUNCA_SE_DECLARA` prohíbe THEN no aparece ninguno, y en particular no aparece `RECEIVE_BOOT_COMPLETED`.
- GIVEN un permiso que una de las dos librerías inyecte al fusionar y que esta app no declara WHEN se compila THEN queda retirado explícitamente en el manifiesto de la app y la retirada va comentada con su motivo.
- GIVEN el `Info.plist` generado WHEN se buscan las claves de ubicación THEN está `NSLocationWhenInUseUsageDescription` y no están `NSLocationAlwaysAndWhenInUseUsageDescription` ni `NSLocationAlwaysUsageDescription`.
- GIVEN el `Info.plist` generado WHEN se leen sus `UIBackgroundModes` THEN son exactamente `['location']`, sin `fetch`, sin `processing` y sin `remote-notification`.
- GIVEN el código de `app/` WHEN se busca una llamada a `requestBackgroundPermissionsAsync` THEN no hay ninguna.

### La guarda de fondo, reexpresada y más fuerte

- GIVEN `MODULOS_DE_FONDO_QUE_NO_SE_MONTAN` WHEN se enumera THEN siguen dentro `expo-background-fetch` y `expo-background-task`, y la lista sigue contrastándose contra las dependencias de la app.
- GIVEN esa misma lista WHEN se busca `expo-task-manager` THEN ya no está, y el fichero explica por escrito por qué sale: entra a sostener el servicio en primer plano que `seguridad-privacidad.md` §2 nombra como la razón de no pedir el permiso permanente, y no a leer con la app cerrada.
- GIVEN `app/plataforma/permisos.js` WHEN se lee THEN declara, al estilo de `MODOS_DE_FONDO`, **las tareas que la app define una a una**, cada una con su identificador, su `porque` y su `dueña`.
- GIVEN esa declaración WHEN se enumera THEN tiene exactamente una entrada: la del servicio en primer plano de la salida abierta, que muere con la salida.
- GIVEN el código de `app/` WHEN se enumeran las tareas registradas con el gestor de tareas THEN todas están en esa declaración, y una registrada sin declarar es error de construcción.
- GIVEN `TAREAS_PERIODICAS` WHEN se lee THEN sigue vacía, y una tarea periódica añadida ahí sigue poniendo la suite roja.
- GIVEN el código de `app/` WHEN se busca una tarea que se registre fuera de una salida abierta THEN no hay ninguna: la única se arranca al abrir la salida y se para al cerrarla o al retirarse el rótulo.

### El permiso, en A1P3 y A1P4

- GIVEN una instalación limpia parada en A1P3 WHEN se pulsa «Permitir» THEN sale el diálogo del sistema de ubicación **mientras se usa** y no sale ningún otro diálogo de permiso.
- GIVEN el diálogo a la vista WHEN se concede THEN se pasa a A1P4 con la marca puesta en la posición que entregó el sensor.
- GIVEN el permiso concedido WHEN se lee el arranque a medias guardado THEN el origen del punto es `permiso`.
- GIVEN el diálogo a la vista WHEN se deniega THEN se pasa a A1P4 igual, con la marca en el punto por defecto, el origen del punto en `a-mano`, sin pantalla intermedia y sin ningún texto que lo llame error.
- GIVEN el proveedor montado y el sistema devolviendo un fallo al pedir el permiso WHEN se pulsa «Permitir» THEN se queda en A1P3, se enseña el motivo literal del fallo y **no** se pasa a A1P4 como si se hubiera denegado.
- GIVEN una compilación en la que el módulo de ubicación no se monta WHEN se abre A1P3 THEN «Permitir» está apagado con su motivo a la vista y la vía de elegir el punto a mano sigue entera.
- GIVEN A1P3 WHEN se lee la marca de la respuesta del permiso THEN dice una de cuatro y solo una: `sin-pedir`, `concedido`, `denegado`, `no-se-pudo-preguntar`.
- GIVEN el permiso concedido y el mapa levantado WHEN se inspecciona lo escrito en el almacén THEN no hay ninguna posición leída del sensor: lo que sobrevive es la semilla del mapa, que es el anclaje cuantizado de la rejilla.

### La cadena del sensor: una suscripción, fuente, detector, seguidor

- GIVEN una salida abierta WHEN se cuentan las suscripciones al sensor THEN hay exactamente una, y de ella cuelgan la fuente y el seguidor.
- GIVEN la fuente montada WHEN se lee una posición THEN trae `lat`, `lon`, `tMs` y `precisionM`, y no trae rumbo, altitud ni velocidad.
- GIVEN una lectura del sensor sin precisión declarada WHEN se entrega THEN `precisionM` va a `null` y nunca a cero, que sería precisión perfecta.
- GIVEN la fuente y el detector montados WHEN se muestrea una posición THEN entra en el detector y la traza de la salida sale clasificada segmento a segmento.
- GIVEN una posición que llega al seguidor WHEN se mira lo que trae THEN va **ya clasificada** en andando · parada · vehículo · ambiguo, y la clasificación la produce el detector del núcleo y no la app.
- GIVEN dos lecturas separadas por más que el hueco máximo declarado en `transporte.js` WHEN se forma la traza THEN no se enlazan entre sí.
- GIVEN la app que vuelve al primer plano tras un rato sin leer WHEN se reanuda la lectura THEN la primera posición nueva **no** se enlaza con la última de antes de la interrupción.
- GIVEN una salida que se cierra o una pantalla de marcha que se desmonta WHEN se mira el sensor THEN la suscripción queda retirada y no sigue leyendo.
- GIVEN el detector de transporte sin montar WHEN se pide la traza de la salida THEN falla nombrándolo, en lugar de devolver una traza con todo por andando.

### En marcha: la marca que se mueve y el transporte que clasifica

- GIVEN una salida echada a andar con el permiso concedido WHEN se abre el momento en marcha THEN el seguidor está montado y la marca de posición se pinta en el punto que entrega el sensor.
- GIVEN el GPS del dispositivo moviéndose con `adb emu geo fix` WHEN llegan posiciones nuevas THEN la marca se mueve y ningún otro elemento del mapa cambia.
- GIVEN un recorrido a paso de andar WHEN se lee la traza clasificada THEN sus segmentos salen `andando`.
- GIVEN un recorrido a velocidad de vehículo sostenida más que la confirmación declarada WHEN se lee la traza THEN sus segmentos salen `vehiculo`.
- GIVEN un recorrido a velocidad ambigua WHEN se lee la traza THEN sus segmentos salen `ambiguo` y no `vehiculo`.
- GIVEN el sensor que todavía no ha entregado ninguna posición WHEN se compone el momento THEN la marca se queda donde estaba y ninguna pantalla lo cuenta como avería del mundo.
- GIVEN el permiso denegado o revocado desde los ajustes del sistema WHEN se echa a andar THEN el momento enseña la avería con su motivo y **no** un mapa con la marca quieta.
- GIVEN la avería del momento en marcha WHEN se lee su marca de motivo THEN dice uno de un vocabulario cerrado: `permiso-denegado`, `permiso-no-preguntable`, `sensor-sin-responder`, `rotulo-sin-montar`.
- GIVEN el momento en marcha con el seguidor montado WHEN se enumeran sus elementos tocables THEN no hay ninguno.
- GIVEN el momento en marcha WHEN se leen sus textos THEN no aparece ninguna cifra de distancia, tiempo, ritmo, pasos ni progreso.

### El rótulo del sistema, en Android

- GIVEN una salida que se abre WHEN el rótulo está disponible THEN se arranca el servicio en primer plano con su notificación persistente y la salida queda abierta con el rótulo puesto.
- GIVEN el rótulo puesto WHEN se lee su línea THEN dice hacia dónde se va y **ninguna cifra**, y su texto lo compone `partida/rotulo.js` y no la capa de plataforma.
- GIVEN el rótulo puesto WHEN se intenta descartarlo deslizando THEN no se puede.
- GIVEN el rótulo puesto WHEN se enumeran sus acciones THEN hay exactamente una: dar la salida por terminada.
- GIVEN el rótulo puesto y el móvil bloqueado WHEN se anda veinte minutos THEN la salida sigue abierta y el rótulo sigue diciendo hacia dónde va.
- GIVEN el canal de notificación del rótulo WHEN se lee su importancia THEN es baja: el rótulo no avisa de nada, es permanente y visible a propósito.
- GIVEN la capacidad `rotulo` WHEN se sondea en un dispositivo Android con la app instalada THEN responde montada y disponible.
- GIVEN la sonda del rótulo WHEN se ejecuta THEN no pide ningún permiso.
- GIVEN una salida abierta cuyo servicio mata el sistema WHEN se reconcilia el estado con la presencia real del rótulo THEN queda registrado con el motivo de retirada por el sistema y la salida no se queda creyéndose sostenida.
- GIVEN una salida que se cierra por cualquiera de sus vías WHEN se mira el rótulo THEN queda retirado en la misma transición y no en una posterior.

### iOS: lo que no se entrega, declarado

- GIVEN `app/plataforma/rotulo.ios.js` y `app/plataforma/rotulo.android.js` WHEN se comparan sus exportaciones THEN son exactamente las mismas.
- GIVEN `rotulo.ios.js` WHEN se sondea su capacidad THEN responde **no montada** y su motivo nombra la Actividad en Vivo, la dependencia o el módulo nativo que haría falta, y la fila que lo decidirá.
- GIVEN una compilación de iOS WHEN se intenta abrir una salida THEN **no se abre**, y el motivo que se enseña es el del rótulo que falta, no un fallo genérico.
- GIVEN `rotulo.ios.js` WHEN se lee su cabecera THEN el límite está escrito con su motivo, y no se declara disponible ninguna capacidad que no entregue.

### La vida de una salida

- GIVEN una partida sin ninguna salida y el rótulo disponible WHEN se echa a andar desde la portada o desde la preparación THEN la salida queda abierta con el rótulo puesto y con el punto de partida anotado.
- GIVEN el rótulo no disponible WHEN se echa a andar THEN la salida **no se abre**, y la portada enseña el motivo distinguiendo «no montada» de «montada y no disponible».
- GIVEN el permiso de ubicación denegado WHEN se echa a andar THEN la salida no se abre y se dice por qué: sin una posición no hay punto de partida y sin punto de partida no hay regreso que detectar.
- GIVEN una salida ya abierta WHEN se intenta abrir otra THEN falla nombrando la que sigue abierta, en lugar de sustituirla.
- GIVEN una salida abierta WHEN se cierra la app y se vuelve a abrir THEN vuelve en la misma situación, con el mismo punto de partida y con la misma marca del último metro propio.
- GIVEN una salida abierta WHEN transcurre el plazo declarado sin un solo metro propio THEN el rótulo se retira y la salida **sigue abierta**.
- GIVEN una salida abierta WHEN quien anda se para veinte minutos y sigue andando THEN el rótulo sigue puesto y el plazo cuenta de nuevo desde el último metro propio.
- GIVEN una salida abierta WHEN el desplazamiento es a velocidad de vehículo durante el plazo entero THEN el rótulo se retira igual: el vehículo no es andar por su cuenta.
- GIVEN una salida abierta con el rótulo retirado WHEN se abre la app THEN se ofrece la salida a medias con sus dos acciones y no el telón.
- GIVEN una salida abierta con el rótulo retirado WHEN se pide «seguir» THEN vuelve a estar abierta con el rótulo puesto y el plazo cuenta de nuevo.
- GIVEN una salida abierta WHEN se vuelve al punto de partida tras haberse alejado lo declarado y se permanece el tiempo declarado THEN la salida se cierra sin emitir ninguna notificación.
- GIVEN una salida abierta WHEN se vuelve al punto de partida en autobús THEN la salida se cierra igual.
- GIVEN una salida abierta WHEN se pulsa «dar la salida por terminada» en el rótulo THEN se cierra exactamente igual que si hubiera vuelto, salvo el motivo anotado.
- GIVEN una salida cerrada sin leer WHEN se abre la app THEN lo primero que se ofrece es su telón y no la portada.
- GIVEN una salida cerrada sin leer WHEN se intenta abrir otra salida THEN falla nombrando el telón pendiente.

### El telón pendiente, y la costura que no se puede evitar

- GIVEN una salida cerrada sin leer y la pantalla del telón sin dibujar WHEN se abre la app THEN se enseña un hueco que nombra el telón pendiente y **no** se hace pasar por el telón.
- GIVEN ese hueco WHEN se enumera lo que ofrece THEN una sola acción, que marca el telón como leído, y ninguna que borre ni cierre nada más.
- GIVEN ese hueco WHEN se abre la app sin tocarlo THEN sigue ofreciéndose: marcarlo leído es una acción explícita y nunca el paso de nada.
- GIVEN el telón marcado como leído WHEN se abre la app THEN se ofrece la portada y se puede abrir otra salida.

### La guarda de los contratos sin llamador

- GIVEN los contratos de plataforma escritos y probados WHEN se enumera cuáles no alcanza ningún llamador desde `app/` THEN la lista está escrita a mano, con dueño por cada entrada, y **una entrada nueva no declarada pone la suite roja**.
- GIVEN esa misma guarda WHEN un contrato de la lista pasa a tener llamador THEN la suite también se pone roja hasta que se quite de la lista: bajar el número es un acto con registro.
- GIVEN esta entrega WHEN se mide esa lista THEN `app/plataforma/posiciones.js`, `app/marcha/seguidor.js`, `app/plataforma/ubicacion.js` y `app/plataforma/rotulo.android.js` ya no están en ella.

### Privacidad, que aquí es bloqueante

- GIVEN una salida en la que se han leído cien posiciones WHEN se inspecciona todo lo escrito en el almacén THEN no hay ningún histórico de posiciones ni ninguna lista que crezca con lo andado.
- GIVEN esa misma salida WHEN se lee el documento de partida THEN la única coordenada que contiene es el punto de partida de la salida en curso, y las únicas marcas de tiempo del sensor son las dos que el esquema declara.
- GIVEN una salida cerrada y su telón leído WHEN se abre otra THEN el punto de partida y las marcas de la anterior no siguen ahí: mueren con la salida.
- GIVEN la copia exportada tras esa salida WHEN se busca dentro THEN tampoco hay traza ni histórico.
- GIVEN la salida entera con servicio en primer plano corriendo WHEN se inspecciona el tráfico saliente THEN no sale ninguna posición, y las únicas coordenadas que salieron del móvil siguen siendo las de la generación del mapa.
- GIVEN los módulos de ubicación y de rótulo de esta fila WHEN se inspecciona su código THEN no generan ni leen ningún identificador por instalación, ni anónimo ni de depuración.
- GIVEN una posición leída del sensor WHEN pasa por la fuente y por el seguidor THEN los campos que no hacen falta se tiran en el punto de entrada y no más adelante.
- GIVEN el seguidor WHEN se busca en su superficie una operación que devuelva un histórico THEN no existe ninguna.
- GIVEN la notificación del rótulo WHEN se lee todo lo que muestra THEN no lleva ninguna coordenada, ningún nombre real de sitio ni ninguna cifra.

### Determinismo y frontera del núcleo

- GIVEN `packages/nucleo/` WHEN se enumeran sus imports THEN no aparecen `expo-location`, `expo-task-manager`, ningún otro módulo de Expo ni nada de React Native.
- GIVEN un clon limpio sin `node_modules` WHEN se ejecuta la batería de `@nucleo` THEN arranca y pasa.
- GIVEN el código de `packages/nucleo/` WHEN se busca `Math.random`, `Date.now` o `new Date` THEN no hay ninguno: el tiempo del sensor viaja dentro de cada posición.
- GIVEN la misma secuencia de posiciones inyectada dos veces sobre el mismo mundo THEN la traza clasificada, el plazo del rótulo y el cierre por regreso salen idénticos.
- GIVEN una posición con marca anterior a la última recibida WHEN llega a la capa de salidas THEN falla nombrándola, en lugar de tratarla como reciente.

### Lo que esta fila no mueve, y hay que decirlo con el número delante

- GIVEN el recuento de pantallas huérfanas WHEN se mide al terminar esta fila THEN **sigue en ocho**: esta fila no conecta ninguna pantalla del momento «al parar», que son de la fila 44.
- GIVEN la columna de flujos de límite declarado, hoy en nueve, WHEN se mide al terminar esta fila THEN sale **como mucho uno**, `en-marcha.yaml`, porque el momento en marcha pasa a tener camino de verdad desde la portada; y **si no sale ninguno, se dice con el número delante**.

## UX Design

### Wireframe textual

**Ninguna pantalla se dibuja de nuevo y ninguna se añade a `docs/flujo.md`.** Lo que esta fila entrega es el montaje de pantallas ya dibujadas más una superficie del sistema que no es del juego. **Layout 1 — Estándar** en todo lo que es pantalla: superficie a sangre sobre el papel `#efe3c0`, sin barra de pestañas.

**A1P3, el permiso** (pantalla 3 · artefacto 1). Composición intacta: sección, título, razón, la tarjeta de alcance con lo que se pide y lo que no, la acción principal «Permitir» y, debajo y con menos peso, «Prefiero elegir el punto a mano». Lo que cambia:

```
  [tarjeta de alcance]  «mientras usas el juego», y nada más
  ( Permitir )                        ← acción principal
  · marca permiso-respuesta: sin-pedir | concedido | denegado | no-se-pudo-preguntar
  [motivo literal]                    ← solo cuando no se pudo preguntar
  Prefiero elegir el punto a mano     ← acción secundaria, siempre disponible
```

- **Conceder** → A1P4 con la marca en la posición real. **Denegar** → A1P4 con la marca en el punto por defecto, **sin pantalla intermedia y sin una palabra que lo llame problema**. **No poder preguntar** → se queda en A1P3, con el motivo literal a la vista y el botón todavía pulsable.

**A3P1 y A3P2, en marcha** (pantallas 1 y 2 · artefacto 3). Composición intacta: la lámina a sangre, norte arriba, la marca de posición roja del propio mapa, el zócalo cuando toca. Lo que cambia es que **la marca se mueve**. Sigue sin haber ni un elemento tocable dentro de la app.

**El rótulo del sistema.** No es una pantalla del juego y no entra en el diagrama: vive en la pantalla de bloqueo y en la persiana de notificaciones, y es **la única superficie tocable que existe en marcha**.

```
  [notificación persistente, no descartable, canal de importancia baja]
  Walking Adventure
  «Hacia <destino>»                   ← una línea, ninguna cifra
  [ Dar la salida por terminada ]     ← una sola acción
```

**Echarse a andar, y lo que pasa si no se puede.** Las cuatro maneras de salir a andar que la fila 43 ya cableó llegan al mismo sitio, y ahora ese sitio abre una salida de verdad. Cuando no se puede abrir, **no se anda y se dice por qué**, en el mismo sitio desde el que se intentó y con el motivo literal, igual que la avería de SPEC-047:

```
  A2P1 / A2P5  ── «Salir a andar» ──►  ¿hay rótulo y hay posición?
                                          ├── sí ──► A3P1, en marcha
                                          └── no ──► se queda donde estaba,
                                                     con el motivo literal debajo
                                                     de la acción que no pudo
```

**La tarjeta de a-medias** de A2P1 aparece cuando hay salida abierta, esté el rótulo donde esté, y sus dos acciones —«seguir con ella» y «dejarlo aquí»— pasan a hacer lo que dicen.

**El hueco del telón.** Cerrar una salida deja un telón pendiente, y su pantalla es de la fila 49. Se resuelve como `app/pantallas/llegada.js` ya resuelve el paso de la escena que no existe: un hueco que **nombra lo que falta** y no se hace pasar por ello.

```
  Esto todavía no está dibujado: el telón de tu última salida.
  ( Cerrarlo )                        ← única acción; marca el telón como leído
```

Sin ese hueco la app se queda encallada: con un telón sin leer no se puede abrir otra salida, y esa regla es de SPEC-030 y no se toca.

### Pantallas y elementos utilizados

- **A1P3, el permiso** (`app/pantallas/arranque.jsx`, componente `ElPermiso`). No cambia su composición: cambia que el proveedor llega montado, y se añade la marca de la respuesta.
- **A1P4, dónde se levanta** (`app/pantallas/arranque.jsx`, `DondeSeLevanta`). No cambia: cambia de dónde sale la marca.
- **A2P1, la portada** y **A2P5, la preparación** (`app/pantallas/portada.jsx`, `preparacion.jsx`, montadas por `antes-de-salir-montado.jsx`). No cambian: cambia que «salir a andar» abre una salida de verdad y que puede no poder.
- **A3P1 y A3P2, en marcha** (`app/pantallas/en-marcha.jsx`, montada por `en-marcha-montado.jsx`). No cambia: cambia que el seguidor llega montado.
- **El rótulo del sistema**, superficie del sistema y **fuera de `docs/flujo.md` a propósito**: no es una pantalla de diseño. Sus literales los compone `packages/nucleo/partida/rotulo.js` y llegan hechos a la capa de plataforma.
- **El hueco del telón**, superficie mínima y también fuera del diagrama: es el andamio que sostiene la costura hasta la fila 49, no una pantalla.
- **Componente nuevo: ninguno.** Si al implementar apareciera uno, es señal de que se está rediseñando una pantalla ya dibujada o entrando en la fila 44.

### data-testid

Los existentes no se tocan: `arranque`, `arranque-paso`, `arranque-motivo`, `permiso-alcance`, `permiso-permitir`, `permiso-permitir-motivo`, `permiso-a-mano`, `punto-pin`, `en-marcha`, `momento-en-marcha`, `marca-posicion`, `en-marcha-tocables`, `en-marcha-sin-cablear`, `portada`, y los de la tarjeta de a-medias.

Los que esta fila añade, pocos y estables:

- `permiso-respuesta` — marca en A1P3 con la respuesta del permiso, del vocabulario cerrado `sin-pedir` · `concedido` · `denegado` · `no-se-pudo-preguntar`. Es lo que hace afirmable que denegar y no poder preguntar se ven distintos.
- `ubicacion-estado` — marca con `montado` · `sin-montar`, junto a las marcas de momento, para poder leerla en el arranque y en marcha.
- `marcha-sin-ubicacion` — marca dentro de la avería del momento en marcha, con el motivo del vocabulario cerrado de arriba.
- `rotulo-estado` — marca con el estado del rótulo según el propio estado de la partida: `puesto` · `retirado-por-plazo` · `retirado-por-cierre` · `retirado-por-el-sistema` · `no-disponible`. Es el vocabulario que `salidas.js` ya declara, no uno nuevo.
- `salida-situacion` — marca con la situación de la salida: `sin-salida` · `abierta-con-rotulo` · `abierta-sin-rotulo` · `cerrada-sin-leer` · `cerrada-leida`.
- `salida-no-se-abre` — marca con el motivo literal cuando echar a andar no pudo abrir la salida.
- `telon-sin-pantalla` — el hueco del telón pendiente.

Regla que se mantiene: son contenedores y marcas, no uno por nodo. Todo lo demás se localiza por texto o por su papel.

### Patrón de interacción

- **Denegar sale por la vía normal; no poder preguntar se queda y lo dice.** El proveedor **no cae solo** a elegir el punto a mano cuando no hay con qué pedir el permiso: hacerlo convertiría una pieza sin cablear en una decisión de quien juega, que es la forma de fallo que este repo ya ha pagado ocho veces (`decisiones-orquestador.md` §6h). Las dos se arreglan en sitios distintos y por eso se ven distintas.
- **Nada se abre en silencio sin rótulo.** Si el rótulo no está, la salida no se abre y se dice cuál es la capacidad que falta, distinguiendo «no montada» de «montada y no disponible». Abrirla igual significaría o perder la ubicación a los pocos minutos o pedir el permiso permanente, que es la exclusión 12 del PRD.
- **Una sola suscripción al sensor por salida.** Dos —una para la fuente y otra para el seguidor— darían dos series de posiciones con marcas distintas para el mismo instante, y la traza clasificada dejaría de cuadrar con el plazo del rótulo sin que nada se pusiera rojo.
- **Se lee y se tira.** Lo que devuelve el módulo nativo trae precisión, rumbo, altitud, velocidad y una marca de tiempo; en el punto de entrada se copian los campos que hacen falta y lo demás no entra. Lo que no entra no se puede guardar por descuido, y con servicio en primer plano esto pasa de ser una buena práctica a ser la diferencia entre cien posiciones tiradas y cien posiciones guardadas.
- **Tras una interrupción se vuelve a anclar, no se cose.** La primera posición nueva no forma enlace con la última de antes: coser el hueco haría que una hora en un bar contara como quietud medida, o que ocho kilómetros en coche parecieran un paseo.
- **La capacidad de fondo no es el permiso de fondo, y conviene decirlo con estas palabras.** `UIBackgroundModes: ['location']` está en `app.json` desde SPEC-030 y es **capacidad**: lo que hace que una salida abierta cuente como «en uso» con la pantalla apagada. El **permiso** de fondo sería `NSLocationAlwaysAndWhenInUseUsageDescription` en iOS y `ACCESS_BACKGROUND_LOCATION` en Android, y ninguno de los dos está ni va a estar. Confundirlos lleva a pedir el permiso más invasivo que existe creyendo que se está siendo riguroso; el caso «El único modo de fondo declarado es el que sostiene "mientras se usa"» de `test/nucleo/pasos-de-fondo.test.mjs` existe precisamente porque ya se confundieron una vez.
- **El rótulo es austero y visible a propósito.** Una app que sigue leyendo tu ubicación tiene que decirlo mientras lo hace; y como no avisa de nada, su canal va en importancia baja y no se puede descartar deslizando. Una notificación que se tira deslizando deja la app leyendo la ubicación sin decirlo.
- **Reconciliar, no confiar.** En Android el sistema puede matar el servicio y devolver el proceso: la situación guardada se compara con la presencia real del rótulo al arrancar y no solo en las transiciones. Es el riesgo 4 del PRD y la razón de que `presente()` exista.
- **El telón se marca leído con una acción explícita**, nunca por el paso de nada. Eso vale también para el hueco: cerrarlo es un toque de quien lo lee.
- **Decisión no cubierta por el design system**: con qué cadencia se muestrea el sensor. Se resuelve con la cadencia **por distancia** y no por tiempo —una posición nueva cada pocos metros—, porque lo que se mide son metros propios y una cadencia por tiempo pura gastaría batería andando en línea recta sin aportar nada. El número exacto se declara en el código con su motivo, como el resto de las constantes de este repo.

## Notas técnicas

### Los tres contratos, y qué cuelga de cada uno

Los tres están escritos, probados contra dobles en `node --test` y esperando el nativo por la firma. Esta fila los rellena y no los reescribe. El encargo de la fila nombraba dos; son tres, y el tercero es el que sostiene la detección de vehículo.

1. **`app/plataforma/ubicacion.js` — `creaProveedorDeUbicacion({ pidePermiso, leePosicion })`.** `pidePermiso()` devuelve `'concedido'` o `'denegado'` y dispara **solo** el diálogo de «mientras se usa»; `leePosicion()` devuelve `{ lat, lon }` y solo se llama con el permiso concedido. Lo consume `app/pantallas/arranque-montado.jsx`, en `ubicacion ?? proveedorSinMontar()`.
2. **`app/plataforma/posiciones.js` — `creaFuenteDePosiciones({ lee })` y `creaTrazaDeSalida({ fuente, detector })`.** Entrega `{ lat, lon, tMs, precisionM }` crudo y se lo pasa al `creaDetectorDeTransporte()` del núcleo. **Hoy no lo consume nadie de `app/`**, solo `test/nucleo/transporte.test.mjs`: esta fila le da su primer llamador real.
3. **`app/marcha/seguidor.js` — `creaSeguidorDePosicion({ lee })`.** Entrega `{ clasificacion, x, y, sitio }` **ya clasificada y en metros del mundo**. Lo consume `app/pantallas/en-marcha-montado.jsx`, en `seguidor ?? seguidorSinMontar()`.

El orden es uno y no admite atajos: **una suscripción → fuente (crudo con marca) → detector (clasifica) → seguidor (clasificada y proyectada)**. Saltarse el detector y clasificar en la app partiría en dos una decisión que el núcleo ya toma, y es justo lo que la cabecera del seguidor prohíbe.

### La proyección, que no se inventa

El seguidor entrega metros del mundo y el sensor da grados. La conversión es `makeProjector(lat0, lon0)` de `packages/nucleo/core/geo.js` con el origen de la celda, y llega **inyectada desde `app/nucleo/piezas.js`** como el resto del generador. No se escribe ninguna trigonometría en `app/`: `geo.js` cuantiza al proyectar, y una conversión paralela produciría puntos que no cuadran con los del mundo congelado. El regreso, en cambio, se resuelve en grados y lo hace el núcleo: `partida/regreso.js` ya proyecta por su cuenta desde el punto de partida.

### El rótulo: Android sí, iOS no, y las dos cosas declaradas

**Android se cierra aquí.** `Location.startLocationUpdatesAsync(tarea, { foregroundService })` arranca el servicio en primer plano con su notificación persistente, y la tarea se define con `TaskManager.defineTask`, que es la razón entera por la que entra `expo-task-manager`. El envoltorio va en `app/plataforma/rotulo.android.js`, por la firma de `creaRotulo({ arranca, actualiza, para, corriendo })`, que ya está escrita: `corriendo()` es la que permite reconciliar, y la que impide que una salida se crea sostenida por un servicio que el sistema ya mató.

**iOS no.** La Actividad en Vivo pide un módulo nativo propio que ninguna de las dos dependencias da. `rotulo.ios.js` se queda con las mismas exportaciones que su pareja —lo exige `CLAUDE.md`— y su sonda responde «no montada» nombrando lo que falta. La consecuencia se declara en vez de disimularse: **en iOS una salida no se abre**, con el motivo del rótulo a la vista. Es preferible a abrirla y perder la ubicación a los pocos minutos, que es la degradación que `capacidades.js` ya declaraba prohibida.

**Y lo que esto arregla de camino**, que es un hallazgo de esta fila y no del encargo: hasta hoy **nada de `app/` consultaba la capacidad `rotulo` ni llamaba a `creaRotulo`**, medido por grep. La regla «sin él una salida no se abre» que `app/plataforma/capacidades.js` escribe era un comentario. Es la **décima aparición de §6h** —la novena es `posiciones.js`, escrito, probado y sin llamador— y por eso esta fila deja detrás la guarda de contratos sin llamador que se pide en los ACs: poner llamador arregla los dos casos de hoy, la guarda es lo único que arregla el de mañana.

### La guarda de fondo, y por qué se reexpresa en lugar de borrarse

`test/nucleo/pasos-de-fondo.test.mjs`, en el caso «La app no declara ninguna tarea periódica que lea con la app cerrada», afirma que ninguna dependencia de `app/package.json` está en `MODULOS_DE_FONDO_QUE_NO_SE_MONTAN`, y esa lista contiene hoy `expo-task-manager`. **En cuanto la dependencia entre, ese caso se pone rojo.** No es una posibilidad: es aritmética.

Lo que está mal es el instrumento, no el código, y el precedente está dos casos más abajo en el mismo fichero: «El único modo de fondo declarado es el que sostiene "mientras se usa"» ya se reexpresó por esto mismo, porque su AC literal chocaba de frente con SPEC-030 y con `seguridad-privacidad.md` §2. Es la misma forma un nivel más abajo: la lista de módulos prohibidos era un **sustituto** de la propiedad que importa —«no hay trabajo periódico que lea con la app cerrada»—, y el sustituto valía mientras nada legítimo necesitara el módulo. `expo-task-manager` no entra a leer con la app cerrada: entra a sostener el servicio en primer plano que §2 nombra como la razón de que el permiso permanente no se pida.

La guarda no queda más débil, queda más fuerte: sale un módulo de una lista y entra una **declaración enumerada de las tareas que la app define**, con su `porque` y su `dueña`, más el contrato de que registrar una tarea sin declararla es error de construcción. La propiedad protegida pasa de «no está el módulo que podría hacerlo» a «está enumerado todo lo que hace, y nada de ello lee con la app cerrada». `expo-background-fetch` y `expo-background-task` siguen prohibidos y `TAREAS_PERIODICAS` sigue vacía.

El reparto de manos: la lista y la declaración viven en `app/plataforma/permisos.js`, que es código y es de `wa-dev`; la reexpresión del caso vive en `test/**` y es de `wa-qa-dev`, con el motivo escrito dentro del fichero y esta decisión citada. **El caso se reexpresa, no se borra.**

### El manifiesto generado, que es donde hay que mirar

Los ACs de permisos miran el **manifiesto generado** y no `app.json`, y la diferencia importa: los `AndroidManifest.xml` de las librerías se fusionan con el de la app, así que un permiso puede aparecer sin que nadie lo haya escrito. Dos concretos a vigilar, medidos como riesgo y no como hecho: **`ACCESS_BACKGROUND_LOCATION`**, que el plugin de `expo-location` solo añade con la ubicación de fondo encendida —de ahí el AC de que se apague explícitamente—, y **`RECEIVE_BOOT_COMPLETED`**, que está en `LO_QUE_NUNCA_SE_DECLARA` y que un gestor de tareas puede declarar para restaurar tareas tras un reinicio. Si aparece, se retira explícitamente en el manifiesto de la app con su comentario, y no se acepta «viene de la librería» como explicación.

### La vida de una salida, que ya está escrita

`packages/nucleo/partida/salidas.js` lleva desde SPEC-030 con las cuatro situaciones, sus transiciones, el plazo, la reconciliación y el cierre por regreso, y **no lo llama nadie**. Esta fila lo llama. Lo que hace falta del paquete, y por qué cada pieza:

- `abreSalida`, que **devuelve `{ abierta: false, motivo }` en lugar de lanzar** cuando el rótulo no está: no poder abrir es una respuesta que la portada tiene que enseñar, no una avería.
- `recibePosicion`, que es una sola llamada y hace dos cosas en orden: primero el regreso, que cierra, y solo si no ha vuelto el plazo, que retira el rótulo. **No se puede coger media**: el plazo y el regreso viven en la misma función porque invertir el orden dejaría abierta una salida que ha vuelto a casa.
- `reconciliaConElRotulo`, al arrancar y siempre que convenga.
- `retomaLaSalida`, `dejarloAqui`, `terminaDesdeElRotulo`, `marcaElTelonComoLeido`, `queOfreceAlAbrirLaApp` y `situacionDeSalida` para el resto de las transiciones y para decidir qué se ofrece al abrir la app.
- `componeRotulo` y `revisaLineaDelRotulo` de `partida/rotulo.js`: los literales del rótulo se componen en el núcleo y llegan hechos a la plataforma, que es lo que impide que iOS y Android digan cosas distintas.
- `distanciaDeAlejamientoM` del regreso sale del tramo de quien juega, que ya está en el estado.

### El identificador de la salida, y el punto que sí se guarda

`abreSalida` exige `salida` como texto no vacío. Ese identificador **no puede ser una marca de tiempo**: una hora escrita en la partida es exactamente el rastro que RF-PRIV-002 prohíbe y sobrevive a la copia exportada. Sale de la partida —el mapa y un contador de salidas del propio estado—, que es la misma familia de identificadores que usa el resto del juego.

Y hay que decir con precisión qué guarda una salida abierta, porque el encargo lo resumía como «ni una marca de tiempo llega a escribirse» y la fuente dice otra cosa. `AREA_SALIDAS` declara, y `congelaSalidas` escribe: el punto de partida `{ lat, lon }` —**la única coordenada que la partida guarda**—, y dos marcas del sensor, `ultimoPropioMs` y `ultimaMarcaMs`. Las tres son de SPEC-030 y las tres son necesarias: sin el punto no se detecta el regreso después de que el sistema mate el proceso, y sin las marcas no hay plazo que medir. Lo que **no** hay, y es lo que la promesa protege de verdad, es traza, histórico ni lista que crezca con lo andado: un punto no es un rastro. Los ACs de privacidad están escritos con esa precisión, y no con la frase gruesa, precisamente para que puedan ponerse rojos.

### La frontera de inyección y dónde vive el código

- El módulo nativo se envuelve en `app/plataforma/`, y solo ahí. `expo-location` es la misma implementación en las dos plataformas, así que **no hay bifurcación por sistema operativo para el sensor y no hay pareja de ficheros con sufijo**: la regla de `CLAUDE.md` obliga a que la bifurcación viva ahí cuando la hay, no a inventar una que no existe. Los ficheros con sufijo siguen siendo `respaldo.*` y `rotulo.*`, y el segundo sí bifurca de verdad.
- La orquestación de una salida —la suscripción, la traza, el rótulo y las transiciones— vive en `app/marcha/` y **recibe el generador inyectado**, enumerándolo en su `DEL_NUCLEO` como hacen `levantamiento.js`, `copia.js`, `empezar-de-nuevo.js` y `partida-guardada.js`. Es la regla de SPEC-020, repetida en las filas 39, 40, 41, 42 y 47, y existe por una razón medida (§6u): citar `@walkingadventure/nucleo` desde el propio módulo deja fuera del alcance de `node --test` sin instalación todo lo que de verdad se puede afirmar aquí.
- **`packages/nucleo/` no se toca.** Si al implementar hiciera falta un cambio ahí, es señal de que algo del módulo nativo se está colando y la frontera está rota.

### Lo que se puede medir cuando esto esté, y con qué números

- **Pantallas huérfanas: siguen en ocho.** Esta fila no conecta ninguna del momento «al parar». Si alguien espera que bajen, está leyendo la versión anterior del alcance.
- **Flujos de límite declarado: de nueve a ocho, como mucho.** El único que puede salir es `en-marcha.yaml`, porque el momento en marcha pasa a alcanzarse desde la portada por donde entra una persona y no por la tira de pasos. `llegada.yaml`, `visor.yaml` y `descarte.yaml` dependen del camino que se ha ido a la fila 44 y **no salen aquí**. Si al medirlo no sale ninguno, se dice con el número delante en lugar de dejarlo pasar.

Un flujo sale de esa columna **solo** cuando recorre su pantalla de verdad. Un flujo que tarde diez segundos no ha recorrido nada.

### Los escenarios que faltan en la batería, como encargo para `wa-qa-dev`

`docs/testing.md` **no cubre A1P3 ni A1P4**, y esta fila lo necesita: hacen falta escenarios para conceder, denegar y no poder preguntar, y para que las dos últimas se distingan. Tampoco cubre el rótulo más allá de una línea. Lo que sí existe y se reutiliza **citándolo por su nombre literal**:

- «La app no pide el permiso de ubicación permanente» (`@app @bucle`).
- «La salida sigue viva con el móvil bloqueado» (`@app @bucle`), que ya afirma que el rótulo muestra hacia dónde va y que no muestra ninguna cifra.
- «Un viaje en tren no hace avanzar el mundo», «En la duda, cuenta» y «La medición del tramo sí excluye la velocidad ambigua» (`@app @accesibilidad`), para la clasificación del transporte.
- «Volver a casa en autobús echa el telón igual» (`@app @accesibilidad`), para el cierre por regreso.
- «El rastro de ubicación no se guarda nunca» (`@red @privacidad`), que es el bloqueante de esta fila.
- «Se puede cerrar la salida desde el rótulo del sistema» y «El rótulo se retira pero la salida no se cierra» (`@app @bucle`).

Los escenarios nuevos que hagan falta se escriben en `docs/testing.md` citando la decisión de `game-design/` de la que salen, como el resto.

### Cómo se verifica en el emulador

`adb emu geo fix <lon> <lat>` mueve el GPS del dispositivo: es con lo que se ve la marca moverse y con lo que se hace que el detector clasifique andando, vehículo y ambiguo. La verificación que esta fila deja escrita en `docs/starting.md` es un recorrido concreto —qué mundo, qué coordenadas, qué clasificó, qué se vio en el rótulo— y nunca «funciona». Y conviene tener presente lo que la fila 47 dejó anotado: `adb` se cae aproximadamente un flujo por tanda, sin mensaje de aserción y en menos de un segundo, y eso se separa de un rojo de verdad reproduciéndolo.

## Decisiones asumidas

- **Cuántos contratos cubre la fila** → asumido los **tres**, incluido `app/plataforma/posiciones.js`, que el encargo no nombraba. Alternativa: los dos que el encargo cita. Regla: es quien entrega `{lat, lon, tMs, precisionM}` al detector de transporte, y sin ella el seguidor tendría que clasificar por su cuenta, que es lo que su cabecera prohíbe. Medido: hoy solo lo consume `test/nucleo/transporte.test.mjs`.
- **El criterio 4 del encargo —«una llegada recorrida de principio a fin en el emulador»— queda retirado de esta fila y pasa a la 44.** El encargo lo pedía mal: pide el camino de la llegada entero, que es otra fila. Alternativa: mantenerlo y absorber la 44. Regla: una fila que no se puede verificar de una sentada acaba cerrándose a medias, que es lo que pasó con las filas 34 y 36. Queda escrito aquí porque quien lea el encargo y esta spec juntos va a ver la discrepancia. **El criterio que lo sustituye** es que en marcha se vea la posición moverse con `adb emu geo fix` y que el detector clasifique, que se verifica sin depender de ninguna otra fila.
- **`expo-task-manager` entra como segunda dependencia y RF-INFRA-004 se cierra aquí** para Android. Alternativa: no montar el rótulo y declararlo bloqueado. Regla: `seguridad-privacidad.md` §2 dice que lo que sostiene el permiso «mientras se usa» con la pantalla apagada **es** el rótulo; sin él la promesa que la fila protege no se sostiene con nada. Decisión del dueño del proyecto.
- **`MODULOS_DE_FONDO_QUE_NO_SE_MONTAN` pierde un módulo y gana una declaración enumerada** → asumido reexpresar la guarda, no borrarla. Alternativa: dejar la lista y no meter la dependencia. Regla: el precedente está en el mismo fichero de pruebas, en el caso del modo de fondo que ya se reexpresó por chocar con `seguridad-privacidad.md` §2; y la condición es que la guarda quede **más fuerte**, con las tareas enumeradas una a una y el contrato de que registrar una sin declararla es error de construcción. Comprobado contra la fuente: la colisión es con el instrumento, no con ninguna decisión de `game-design/`.
- **`partida/salidas.js` sí se cablea** → asumido que sí, porque con el rótulo montado `abreSalida` ya encuentra lo que exige. Alternativa: cablear solo el sensor y dejar la vida de la salida a la fila 44. Regla: el plazo del rótulo y el regreso viven dentro de `recibePosicion` y no se pueden coger a medias; y una salida que no se abre por el núcleo dejaría el rótulo puesto sin nadie que lo retire.
- **Qué se enseña con un telón pendiente** → asumido un **hueco declarado** con una sola acción, que marca el telón como leído. Alternativa: no cerrar la salida hasta que la fila 49 dibuje el telón, o marcarla leída sola. Regla: con un telón sin leer no se puede abrir otra salida (SPEC-030) y sin hueco la app queda encallada; marcarlo leído solo violaría «es una acción explícita de quien lo lee». El hueco es el mismo patrón que `llegada.js` usa para la escena que no existe: feo, honesto, y desaparece cuando la 49 llegue.
- **En iOS no se abre salida** → asumido decirlo con el motivo del rótulo. Alternativa: abrirla sin rótulo. Regla: `capacidades.js` ya declara que la ausencia del rótulo **no admite degradar en silencio**, y abrir la salida en iOS sería perder la ubicación a los pocos minutos o pedir el permiso permanente.
- **Con el permiso denegado no se abre salida** → asumido que no, y que se dice. Alternativa: abrirla sin posición. Regla: `abreSalida` exige el punto de partida y la fuente; una salida sin punto de partida no puede cerrarse nunca por regreso, y SPEC-030 ya lo declara como avería y no como degradación.
- **Cómo se identifica una salida** → asumido un identificador derivado del mapa y de un contador del propio estado. Alternativa: una marca de tiempo, que es lo cómodo. Regla: RF-PRIV-002 y `seguridad-privacidad.md` §2 — una hora escrita en la partida sobrevive a la copia exportada y es rastro.
- **Cómo se redactan los ACs de privacidad** → asumido decir «un punto y dos marcas declarados en el esquema, y ninguna traza» en vez de «ni una marca de tiempo se escribe». Alternativa: copiar la frase gruesa del encargo. Regla: `AREA_SALIDAS` declara `partida`, `ultimoPropioMs` y `ultimaMarcaMs` desde SPEC-030, y un AC que exigiera cero marcas sería rojo desde el primer día por una razón que no es un defecto. Un criterio que no puede cumplirse no mide nada, igual que uno que no puede fallar (§6o).
- **Cadencia de muestreo del sensor** → asumida por distancia y no por tiempo. Alternativa: un intervalo fijo. Regla: lo que se mide son metros propios, y una cadencia por tiempo gasta batería en línea recta sin aportar nada. El número concreto se declara en el código con su motivo.
- **Qué se hace con el hueco de posiciones tras una interrupción** → asumido **volver a anclar**, sin enlazar la primera posición nueva con la última de antes. Alternativa: coser el hueco. Regla: `transporte.js` ya declara un hueco máximo por encima del cual no enlaza, y coserlo convertiría una hora parada en quietud medida.
- **Si hay bifurcación por sistema operativo en el módulo del sensor** → asumido que **no**, porque `expo-location` es la misma implementación en las dos plataformas. Alternativa: crear la pareja `ubicacion.ios.js` / `ubicacion.android.js` por simetría con `respaldo` y `rotulo`. Regla: `CLAUDE.md` exige que la bifurcación viva en `app/plataforma/` **cuando la hay**; dos ficheros idénticos son dos sitios donde se desincronizará lo mismo. El rótulo sí bifurca y sí mantiene su pareja.
- **Dónde se ve la diferencia entre denegar y no poder preguntar** → asumido una marca con vocabulario cerrado en A1P3 más el motivo literal a la vista, sin pantalla nueva. Alternativa: una pantalla de rescate para el segundo caso. Regla: `game-design/lenguaje.md` y SPEC-027 — una pantalla intermedia convertiría la denegación en un problema que hay que resolver, y el arranque se diseñó para que no lo sea.
- **Si el mapa activo pasa a resolverse por posición** → asumido que **no**, aunque ahora ya haya con qué. Alternativa: cerrar RF-PERS-007 aquí. Regla: la fila 41 entregó el mecanismo y la 47 declaró la limitación con su motivo; cambiar por qué mapa se abre la partida es efecto grande para una fila de sensor. Queda fichado, no hecho.
