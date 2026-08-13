# SPEC-048-iter-1 — La apertura pide con precisión alta, aplica una sola cota de frescura y se respalda en la última conocida

## Descripción

Iteración de **cambio de comportamiento** sobre la implementación de SPEC-048, con una corrección de defecto dentro. La desencadena una decisión de producto del dueño del proyecto, tomada el **13-ago-2026**, **reescrita el mismo día con la medida delante** y ratificada antes de cerrar la fila 53.

**La raíz, medida en `wa-pixel` el 13-ago-2026, y no es la que se creía.** `app/plataforma/posiciones.js:374` pide `getCurrentPositionAsync` con `Location.Accuracy?.Balanced`, y **con la equilibrada el sistema no enciende el GPS**: durante los **30-32 s** que tarda el intento en fallar, el Event Log de `dumpsys location` no registra **ni una petición**. La suscripción pide con `Accuracy.High` (`posiciones.js:266`) y sí lo enciende. Los dos rojos de `@app` —`en-marcha.yaml` y `telon.yaml`, con el motivo literal «… — Current location is unavailable. Make sure that location services are enabled»— salen de ahí, y **no** de que el proveedor estuviera frío: dos cotejos independientes lo atribuyeron a la frescura mientras la causa llevaba dos días escrita **veinte líneas por encima del defecto**, en el comentario de `posiciones.js:261-265`. Y una premisa que sostenía aquel diagnóstico está medida como falsa: **`adb emu geo fix` no inyecta nada si nadie pide posición**, así que `dumpsys location` enseñando fijo viejo no probaba lo que se creyó que probaba.

**Qué cambia, en tres piezas que son una sola decisión.** **Una**, la puntual pasa a pedirse **con precisión alta**, que es la raíz. **Dos**, se aplica **una sola cota de frescura a cualquier fijo que ancle el punto de partida, venga por la puerta que venga** — hoy la puntual devuelve caché rancia sin decirlo, medida en **90,2 s**, **279,6 s** y **643,3 s**, resolviendo en ~2,45 s y sin pedir fijo nuevo, y con la posición movida 100 m y el GPS apagado 150 s la salida se abrió anclando en un fijo de **193,5 s** sin que nada protestara. **Tres**, cuando la puntual no trae nada dentro de la cota, la apertura **se respalda en la última posición conocida con esa misma cota** en vez de no abrir. Y como pedir con precisión alta cuesta tiempo, la puntual gana **un tope de espera** y la pantalla **una línea que dice que se está buscando**: las tres piezas van juntas.

El punto de partida, además, **se re-ancla como mucho una vez por salida**, con el primer fijo bueno que llegue dentro de un plazo declarado y solo mientras no se haya declarado el alejamiento; después de alejarse es inmutable. Eso queda **exactamente como estaba escrito**, y lo único que cambia es su alcance: ahora repara también el residuo de la puntual y no solo el del respaldo. Lo que deja escrito en la partida son cuatro escalares de auditoría —el origen del punto, si se re-ancló, cuántos metros se movió el ancla y cuánto tiempo pasó entre las dos marcas del sensor— y **ninguna coordenada nueva ni ninguna marca de reloj**.

**El principio que lo gobierna, y vale más que este caso: una sola cota para el mismo ancla, y la asimetría por defecto queda prohibida.** Lo que ancla el punto de partida es un fijo, no una puerta. Poner el rasero estricto solo en el respaldo —que es lo que esta iteración decía antes de medir— habría sido más severo con la puerta rara que con un camino principal que se traga diez minutos de caché en silencio.

**Qué corrige de paso.** `app/marcha/salida.js:420-423` archiva **cualquier** excepción de la posición como `permiso-denegado`, y su comentario afirma justo lo contrario. La puntual lanza con el permiso concedido, así que hoy la marca miente y el motivo que se enseña manda a quien juega a los ajustes del sistema a arreglar algo que no está roto.

**Qué NO cambia, y conviene decirlo alto.** **El permiso de ubicación denegado sigue sin abrir salida**, con su motivo y su texto honesto: eso no se toca ni se ablanda, y el respaldo en la última conocida **no** se aplica a ese caso. Y el mismo motivo honesto es el que se enseña cuando lo único disponible es un fijo demasiado viejo — el caso medido en `wa-pixel`, cuyo último conocido tiene **25 h 24 min** y al que **ninguna cota razonable puede decir que sí**, ni la de 90 s ni la de 25. Tampoco cambian el rótulo, la única suscripción, la clasificación del transporte, el plazo, la reconciliación, el cierre por regreso ni ninguna de las promesas de privacidad de la spec base. Ninguna dependencia nueva.

Los números, las mediciones y el reparto completo de rutas viven en **SPEC-053**, que es la fila que entrega esto; aquí se declara el delta de comportamiento sobre la spec base.

## Alcance de implementación

- Esta iteración define **únicamente el código de producción** del delta: la precisión alta de la puntual, el tope de espera con su estado en pantalla, la cota única aplicada a las dos puertas, el respaldo en la última conocida al abrir y al retomar, el re-anclaje, los cuatro campos de auditoría y el motivo que deja de mentir.
- **Las tres piezas de la apertura se entregan juntas.** Subir la precisión sin el tope y sin el estado de espera cambia una espera muda de 30-32 s por otra de 10 s; aplicar la cota solo a una puerta reproduce el defecto de fondo con otra cara. **No hay entrega parcial de esto.**
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `wa-qa-dev` y los ejecuta `wa-qa-tester` contra el código ya commiteado, en un paso posterior del bucle de QA de este repo. Cualquier test que el implementador entregue será descartado o reemplazado.
- **Sí hay cambio de la frontera del núcleo**: `AREA_SALIDAS` (`packages/nucleo/partida/estado.js:323-334`) gana cuatro campos, y la cota **única**, el tope de espera, el plazo y la precisión exigida entran como constantes del paquete que la app recibe inyectadas en lugar de copiar. **Ninguna dependencia nueva**: `getLastKnownPositionAsync` la trae `expo-location` 57.0.9, ya instalada.
- **Sí hay un ajuste de composición, y es pequeño**: A2P1 y A2P5 ganan **un estado de espera** mientras se busca la posición. No es pantalla nueva, no cambia de nodo en `docs/flujo.md` y no toca ningún otro bloque de esas pantallas.
- **Fuera de alcance del delta**: la cadencia del muestreo y el punto de partida como sitio de esa decisión, que son de **SPEC-044-iter-1**; la lista cerrada de vías de despertar y la neutralización de FCM, que son de **SPEC-053**; el reloj de permanencia y el radio del regreso de `regreso.js`, que son de SPEC-030 y no se tocan; y el botón atrás del sistema, que es una decisión de diseño sin tomar.

## Criterio de aceptación modificado

### ACs nuevos

**La precisión con la que se pide, que es la raíz**

- **Dado** la petición del fijo puntual, **cuando** se leen sus opciones, **entonces** pide con **precisión alta** y no con la equilibrada.
- **Dado** la precisión de la puntual y la de la suscripción, **cuando** se comparan, **entonces** son **la misma** y salen del **mismo sitio**, en vez de estar escritas dos veces y poder desincronizarse.
- **Dado** el sitio donde se pide la puntual, **cuando** se lee su comentario, **entonces** dice por qué la precisión es alta **con la medida y su fecha**, igual que ya lo hace el de la suscripción (`app/plataforma/posiciones.js:261-265`).

**La cota única, que se aplica a las dos puertas**

- **Dado** cualquier fijo que vaya a anclar el punto de partida, **cuando** se decide si sirve, **entonces** se le aplican **la misma cota de frescura y la misma precisión exigida**, sin importar por qué puerta entró.
- **Dado** el código entregado, **cuando** se buscan las cotas de frescura del punto de partida, **entonces** hay **una sola constante** y ninguna comparación que use un número distinto según la puerta.
- **Dado** un fijo puntual que llega pero cuya marca es más vieja que la cota, **cuando** se decide, **entonces** **no ancla**: se descarta exactamente igual que una última conocida vieja.
- **Dado** un fijo sin marca de tiempo o sin precisión declarada, **cuando** se decide, **entonces** se descarta: lo que no se puede fechar no se puede acotar.

**El respaldo en la última conocida**

- **Dado** una salida que se echa a andar con el permiso concedido y una puntual que no trae nada dentro de la cota, **cuando** hay una última posición conocida que sí la cumple, **entonces** la salida **se abre** con ella.
- **Dado** esa apertura, **cuando** se lee el origen del punto de partida, **entonces** dice `ultima-conocida`, y dice `puntual` cuando fue la puntual la que ancló.
- **Dado** una última posición conocida más vieja que la cota, o con precisión declarada peor que la exigida, **cuando** se echa a andar, **entonces** la salida **no se abre** y el motivo es `sensor-sin-responder`.
- **Dado** un último fijo conocido de **25 h 24 min**, **cuando** se echa a andar, **entonces** la salida no se abre y se dice el motivo honesto: sin una posición no hay punto de partida.
- **Dado** «seguir con ella» sobre una salida con el rótulo retirado, **cuando** la puntual no trae nada dentro de la cota, **entonces** se retoma con la última conocida por la misma regla, y con el mismo motivo honesto si tampoco la hay.
- **Dado** la cota, el tope de espera, el plazo y la precisión exigida, **cuando** se busca dónde viven, **entonces** son constantes del paquete con su motivo escrito, y la app las recibe inyectadas.

**El tope de espera y lo que se enseña mientras se busca**

- **Dado** el toque en «Salir a andar» con el permiso concedido, **cuando** empieza la búsqueda de posición, **entonces** la pantalla lo dice **de inmediato** con una línea de espera y no se queda muda.
- **Dado** esa línea, **cuando** se lee, **entonces** es voz de aplicación y **no lleva barra, ni porcentaje, ni cuenta atrás, ni ninguna cifra**.
- **Dado** la espera de la puntual, **cuando** pasa el tope declarado, **entonces** se deja de esperar y se pasa a la última conocida: la apertura **no puede tardar más que el tope**, y desde luego no los 30-32 s medidos hoy.
- **Dado** el tope agotado, **cuando** se mira lo que se enseña, **entonces** no es un error: es el paso siguiente, y el motivo honesto solo aparece si tampoco hay última conocida dentro de la cota.
- **Dado** la línea de espera, **cuando** la apertura termina de la manera que sea, **entonces** desaparece, y volver sigue estando disponible mientras dura.

**El motivo que deja de mentir**

- **Dado** el permiso concedido y un proveedor que lanza al pedir la posición, **cuando** se decide el motivo por el que no se abre, **entonces** se decide **consultando el estado del permiso**, y no interpretando la excepción.
- **Dado** ese caso, **cuando** se lee la marca `salida-no-se-abre`, **entonces** dice `sensor-sin-responder` y no `permiso-denegado`.
- **Dado** el vocabulario `MOTIVOS_DE_NO_ABRIR`, **cuando** se lee tras esta iteración, **entonces** es el mismo de antes: no se añade ninguna palabra.

**El re-anclaje**

- **Dado** una salida abierta, **cuando** llega el primer fijo con precisión suficiente y con su marca dentro del plazo declarado desde la marca del punto de partida, **entonces** el punto de partida se sustituye por ese fijo.
- **Dado** una salida ya re-anclada, **cuando** llega otro fijo mejor, **entonces** no se vuelve a re-anclar: como mucho una vez por salida.
- **Dado** una salida abierta con el punto de partida `puntual`, **cuando** llega el primer fijo bueno dentro del plazo, **entonces** **también se re-ancla**: la regla no distingue por el origen del punto, porque está medido que la puntual devuelve caché de hasta 643,3 s sin decirlo. El re-anclaje repara **las dos puertas**.
- **Dado** una salida que ya se declaró alejada, **cuando** llega cualquier fijo, **entonces** el punto de partida es inmutable.
- **Dado** un primer fijo bueno que llega pasado el plazo, **cuando** llega, **entonces** el punto de partida no se mueve.
- **Dado** una salida re-anclada, **cuando** se cierra la app y se vuelve a abrir, **entonces** vuelve con el punto re-anclado y sigue declarándose re-anclada.

**Lo que el re-anclaje anota** *(`@privacidad`, bloqueante)*

- **Dado** el área de salidas tras esta iteración, **cuando** se enumeran sus campos nuevos, **entonces** son exactamente cuatro y ninguno es una coordenada ni una marca de reloj.
- **Dado** una salida re-anclada, **cuando** se busca el punto de partida anterior, **entonces** no está: se sustituye, no se apila.
- **Dado** una salida cerrada y su telón leído, **cuando** se abre otra, **entonces** los cuatro campos mueren con la salida anterior.
- **Dado** la copia exportada tras una salida re-anclada, **cuando** se busca dentro, **entonces** no hay traza, ni histórico, ni las dos posiciones del re-anclaje.

### ACs de la base que se mantienen, y son los confundibles

Estos tres siguen **vigentes tal cual**, y se citan textualmente porque el delta pasa justo al lado:

> «GIVEN el permiso de ubicación denegado WHEN se echa a andar THEN la salida no se abre y se dice por qué: sin una posición no hay punto de partida y sin punto de partida no hay regreso que detectar.» (SPEC-048, «La vida de una salida»)

Sigue entero. **El permiso denegado no cae a la última conocida**: denegado es denegado, y su motivo se arregla en los ajustes del sistema. Lo único que cambia es que su texto deja de aparecer en un caso que no es el suyo.

> «GIVEN una salida abierta WHEN se cierra la app y se vuelve a abrir THEN vuelve en la misma situación, con el mismo punto de partida y con la misma marca del último metro propio.»

Sigue entero, y el punto de partida al que se refiere es **el vigente**: si hubo re-anclaje, el re-anclado. Una salida no cambia de punto de partida por cerrarse y abrirse la app.

> «GIVEN esa misma salida WHEN se lee el documento de partida THEN la única coordenada que contiene es el punto de partida de la salida en curso, y las únicas marcas de tiempo del sensor son las dos que el esquema declara.»

Sigue entero y es bloqueante. Los cuatro campos nuevos **no lo rompen**: `origenDelPunto` es un vocabulario cerrado, `reanclada` un booleano, `desplazamientoDelAnclaM` una distancia y `antiguedadAlReanclarMs` una **duración**. Ninguna coordenada más, ninguna marca de tiempo más. Es el mismo registro con el que la spec base declaró que un punto no es una traza.

### AC derogado

Ninguno **de la spec base**. Esta iteración añade comportamiento y corrige una atribución de motivo; ningún criterio de SPEC-048 queda obsoleto, y en particular ninguno fijaba la precisión con la que se pide la puntual, que es lo que aquí cambia.

Lo que sí queda derogado es **un criterio de esta misma iteración anterior a medir**: «la cota de frescura se aplica a la última posición conocida», escrito antes de la medición del 13-ago-2026, que **queda obsoleto y debe entenderse derogado**. El comportamiento esperado del implementador y de la suite QA es el de arriba:

- **Dado** cualquier fijo que vaya a anclar el punto de partida, **cuando** se decide si sirve, **entonces** se le aplican la misma cota de frescura y la misma precisión exigida, **venga de la puntual o de la última conocida**.

## UX Design — ajuste puntual

Ninguna pantalla nueva, ningún nodo nuevo y ninguna arista de `docs/flujo.md` que cambie de destino. Lo que cambia es **qué dicen dos marcas, cuándo aparecen, y un estado de espera nuevo en A2P1 / A2P5** — la consecuencia visible de pedir con precisión alta y con tope.

### Wireframe textual (parte afectada)

El bloque «Echarse a andar, y lo que pasa si no se puede» del UX Design de SPEC-048 se ajusta en su condición, gana el estado de espera y mantiene todo lo demás. Queda así:

```
  A2P1 / A2P5  ── «Salir a andar» ──►  ¿hay rótulo?
                                          │ sí
                                          ▼
                              Buscando dónde estás…      ← la acción se sustituye por
                                          │                 una línea de espera; sin barra,
                                          │                 sin porcentaje, sin cifras
                                          ▼
                              ¿hay posición dentro de la cota?
                              (puntual, o última conocida)
                                ├── sí ──► A3P1, en marcha
                                └── no ──► vuelve la acción donde estaba,
                                           con el motivo literal debajo
```

La línea de espera **aparece al instante** y **desaparece siempre**, gane o pierda la búsqueda, y la espera está acotada por el tope: la pantalla no puede quedarse en ella. El texto exacto lo escribe quien implementa con `game-design/lenguaje.md` delante y se lee en voz alta; lo que esta iteración fija es lo que **no** puede llevar: ninguna cifra de tiempo ni ninguna promesa de cuánto falta.

El motivo literal sigue leyéndose en el `accessibilityLabel` del nodo `salida-no-se-abre` (`app/pantallas/antes-de-salir-montado.jsx:181`) y no en un texto de pantalla. Lo único que se añade a la composición de A2P1 / A2P5 es el estado de espera; ningún otro bloque se mueve.

### Pantallas y elementos utilizados

```
Pantallas cuya composición cambia, y solo en un estado:
  A2P1  pantalla 1 · artefacto 2 — La portada        (gana el estado de espera)
  A2P5  pantalla 5 · artefacto 2 — La preparación    (gana el estado de espera)

Pantallas que el delta toca sin recomponer:
  A3P1 / A3P2  pantallas 1 y 2 · artefacto 3 — En marcha

Elementos del proyecto que se usan: la tipografía de la voz de aplicación y la línea de
espera sin barra ni porcentaje que ya existe en A6P7.

Elemento nuevo: ninguno.
```

### data-testid

Los de la base no se tocan. El delta añade tres marcas, pocas y estables:

- `salida-punto-origen` — el origen del punto de partida, vocabulario cerrado `puntual` · `ultima-conocida`.
- `salida-reanclaje` — `sin-reanclar` · `reanclada`.
- `salida-buscando` — el estado de espera mientras se busca la posición.

Sin las dos primeras, el respaldo y el re-anclaje solo se pueden afirmar sobre la función pura y nunca sobre el aparato, que es justo donde nacieron los dos rojos que esta iteración viene a cerrar. Sin la tercera, un tope que no se respeta se lee como una app lenta en vez de como un fallo.

### Patrón de interacción

- **Una sola cota para el mismo ancla.** Lo que ancla el punto de partida es un fijo, no una puerta; aplicarle rasero distinto según por dónde entró es el defecto de fondo con otra cara, y **la asimetría por defecto queda prohibida**. Si aparece razón medida para dos números, se trae con la medida.
- **Se prefiere abrir a ser purista, pero no a costa de mentir.** El motivo honesto se conserva íntegro para cuando no hay nada con lo que anclar, y aparece **solo** entonces — incluido el fijo de 25 h, al que se le dice que no.
- **Esperar se dice; esperar callado, no.** Pedir con precisión alta enciende el GPS y eso cuesta tiempo, así que la elección real es entre espera muda y espera dicha. El criterio del dueño lo fija con número: mejor **diez segundos honestos de «buscando dónde estás» que treinta de espera para un no**.
- **Después de alejarse, el punto de partida es inmutable.** «Casa» es lo que decide cuándo cae el telón: mover el ancla a mitad de salida cambiaría el sitio al que hay que volver bajo los pies de quien vuelve. El re-anclaje vive en la ventana en la que todavía no se ha andado nada, y ahí no puede quitarle nada a nadie.

## Notas técnicas

### El defecto que esta iteración corrige, y su causa raíz

- **Síntoma**: desde aparato limpio, abrir una salida cae con «… — Current location is unavailable. Make sure that location services are enabled» tras **30-32 s**, y la marca `salida-no-se-abre` dice `permiso-denegado` con el permiso **concedido**. Rojos de `en-marcha.yaml` y `telon.yaml`, medidos en dos cotejos.
- **Causa raíz, medida el 13-ago-2026 en `wa-pixel`**: `app/plataforma/posiciones.js:374` pide `Location.getCurrentPositionAsync({ accuracy: Location.Accuracy?.Balanced })`, y **con la equilibrada el sistema no enciende el GPS** — durante los 30-32 s del intento fallido, el Event Log de `dumpsys location` **no registra ni una petición**. La suscripción, que pide con `Accuracy.High` (`:266`), sí lo enciende: `ProviderRequest[@+2s0ms, HIGH_ACCURACY, WorkSource{com.walkingadventure.app}]` en cuanto la salida se abre. **La raíz no es la frescura.**
- **Causa raíz secundaria, que amplifica**: la llamada va **sin tope de espera**, así que el fallo tarda medio minuto en llegar; y `app/marcha/salida.js:420-423` envuelve la llamada en un `try/catch` que archiva **cualquier** excepción como `permiso-denegado` — con un comentario que afirma que «aquí se distingue de "no ha dado fijo todavía"», que es exactamente lo que no hace.
- **Y un tercer defecto que solo se ve midiendo**: cuando la puntual **sí** responde, devuelve caché rancia **sin decirlo** — fijos de **90,2 s**, **279,6 s** y **643,3 s**, resolviendo en ~2,45 s y sin pedir fijo nuevo. Con la posición movida **100 m** y el GPS apagado 150 s, la salida se abrió anclando en un fijo de **193,5 s** y 100 m de distancia, y **nada protestó**. Por eso la cota no puede vivir solo en el respaldo.
- **La lección, que se escribe porque vale más que el arreglo**: la causa llevaba desde el **11-ago-2026** escrita **veinte líneas por encima del defecto**, en el comentario de `posiciones.js:261-265` («Medido en el emulador el 11-ago-2026: con la equilibrada el sistema ni siquiera enciende el GPS»), y aun así dos cotejos independientes atribuyeron el rojo a que «el proveedor está frío». No faltaba la medida: **la medida no llegó al sitio**. La defensa que esta iteración deja puesta es de forma —la precisión de la puntual y la de la suscripción salen del mismo sitio— y no de disciplina.
- **Cambio requerido**: precisión alta en la puntual, con tope de espera y con su estado en pantalla; la cota aplicada a **lo que devuelva cualquiera de las dos puertas**, restando la marca del propio fijo; el motivo decidido por el **estado del permiso** y no por la excepción; y el respaldo probado antes de rendirse. La marca correcta ya existe en el vocabulario cerrado (`app/marcha/salida.js:63-77`, `sensor-sin-responder`), que hoy solo se usa para `punto == null` (`:425-426`). **No se añade ninguna palabra al vocabulario.**

### Ficheros afectados

- `app/plataforma/posiciones.js` — **la precisión alta en `posicionPuntual` (`:374`), que es la raíz**, con su comentario y su medida fechada; el tope de espera sobre esa llamada; el respaldo con `getLastKnownPositionAsync({ maxAge, requiredAccuracy })`, los dos parámetros **explícitos** y ninguno por omisión; y la puntual devolviendo el fijo **con su marca**, para que la cota se pueda aplicar a lo que trae. La precisión sale de **un solo sitio** compartido con las opciones de la suscripción (`:266`).
- `app/marcha/salida.js` — `abre()` (`:419`) y `retoma()` (`:496`): la cota aplicada a las dos puertas, el respaldo, el motivo por estado de permiso y el re-anclaje al recibir posición.
- `packages/nucleo/partida/salidas.js` — la cota **única**, el tope de espera, el plazo, la precisión exigida, la decisión de si un fijo puede anclar —la misma para las dos puertas— y la de re-anclar.
- `packages/nucleo/partida/estado.js` — los cuatro campos de `AREA_SALIDAS` (`:323-334`) y su declaración en el formato.
- `app/pantallas/antes-de-salir-montado.jsx` — las tres marcas nuevas y el estado de espera, al lado de las que ya hay (`:181`).

**Composición que se mantiene explícitamente**: una sola suscripción por salida; la fuente entrega `{lat, lon, tMs, precisionM}` y nada más; los campos que no hacen falta se tiran en el punto de entrada; la traza no cose el hueco tras una interrupción; el rótulo, el plazo y la reconciliación siguen igual.

**Impacto en el estado de partida**: sí, cuatro campos nuevos, todos escalares y todos mortales con la salida. **Impacto en la frontera del núcleo**: sí, las tres constantes entran inyectadas. **Retrocompatibilidad**: una partida guardada por la versión anterior llega **sin** los cuatro campos; se leen con su valor por defecto —`origenDelPunto` desconocido, `reanclada` falso, los dos numéricos nulos— y la salida abierta sigue funcionando sin migrar nada. Una salida abierta antes de esta entrega **no se re-ancla**, porque su ventana ya pasó, y eso no es un caso especial: es la regla del plazo aplicándose.

### Verificación manual tras la entrega

**Precondición del emulador, medida el 13-ago-2026 y contraria a `CLAUDE.md` §13b**: **`adb emu geo fix` no inyecta nada si nadie pide posición**. Con el bucle corriendo cada 2 s durante 4 minutos, `dumpsys location` seguía enseñando el fijo persistido del arranque del emulador y el Event Log no tenía un evento desde el boot; en cuanto otra app pidió posición, apareció el fijo del bucle con **edad 0,6 s**. El GPS del emulador es **bajo demanda**, así que un `dumpsys` con fijo viejo **no prueba** que el bucle esté parado, y toda medida de apertura tiene que declarar si el bucle estaba corriendo en vez de deducirlo de lo que `dumpsys` enseñaba antes.

Y una advertencia sobre lo que este emulador **no** puede verificar: con su último conocido de 25 h y su GPS bajo demanda, **la cota nunca decide nada allí** — todo fijo cae o muy dentro o absurdamente fuera. El respaldo se puede ejercitar, pero **el número de la cota no se calibra aquí**.

1. `adb shell pm clear com.walkingadventure.app`, reinstalar, y **con el bucle de posición corriendo**: abrir la app y echar a andar. La salida se abre; se anota cuánto tarda del toque a A3P1 y qué dice `salida-punto-origen`.
2. Repetir **sin** el bucle, con el último conocido de 25 h como única posición disponible: la salida **no se abre**, la espera **no pasa del tope**, y el motivo honesto aparece.
3. Con el bucle alimentando, comprobar que a los pocos segundos `salida-reanclaje` pasa a `reanclada` y que no vuelve a cambiar.
4. Andar hasta pasar la distancia de alejamiento, volver al punto de partida y quedarse quieta un minuto: el telón cae.
5. `adb shell run-as com.walkingadventure.app cat files/partida/partida/estado.json`: una sola coordenada en el área de salidas, y los cuatro campos con valores escalares.

### Dependencias

La spec base **SPEC-048**. Además: **SPEC-030**, de donde vienen la vida de una salida y el punto de partida; **SPEC-044-iter-1**, que mete el punto de partida en la decisión de cadencia y es lo que garantiza que dentro del plazo de re-anclaje lleguen fijos; y **SPEC-053**, la fila que entrega este delta con sus números y sus mediciones.

## Decisiones asumidas

- **Gherkin español** (`Dado / cuando / entonces`) en los ACs nuevos, aunque la base use `GIVEN / WHEN / THEN` → asumido (alternativa: seguir a la base). Regla: `CLAUDE.md` y el grep que cruza specs y batería; los ACs citados de la base se conservan **literales**, en su idioma original, porque una cita que se traduce deja de ser una cita.
- **La puntual pasa a precisión alta y la precisión sale del mismo sitio que la de la suscripción** → asumido (alternativas: dejar la equilibrada y confiarlo todo a la cota y al respaldo; o subir a alta escribiendo el valor otra vez al lado). Regla: es la raíz medida —con la equilibrada el sistema no enciende el GPS—, y la causa llevaba dos días escrita veinte líneas por encima del defecto sin que nadie la cruzara. Una defensa que dependa de leer el comentario correcto ya falló una vez: la defensa es de forma, **un solo sitio del que sale la precisión**.
- **La cota es una sola y se aplica a las dos puertas** → asumido, y **deroga lo que esta misma iteración decía antes de medir** (alternativa: cota solo sobre la última conocida). Regla: lo que ancla el punto de partida es un fijo, no una puerta; el rasero estricto puesto solo en la puerta rara habría dejado el camino principal tragándose caché de 643,3 s en silencio. **La asimetría por defecto queda prohibida**; dos números distintos solo con medida delante.
- **El tope de espera es 10 s y va con línea de espera en pantalla** → asumido (alternativas: sin tope, que es lo de hoy; 5 s, que se comería aperturas legítimas; 20 s, que vuelve a la espera larga). Regla: el criterio del dueño, mejor 10 s honestos de «buscando dónde estás» que 30 de espera para un no. **El coste real del one-shot con precisión alta no está medido**: el número se entrega para confirmarse o cambiarse con esa medida delante, y se dice que está sin medir.
- **La caída a la última conocida no se aplica al permiso denegado** → asumido (alternativa: intentarla también). Regla: sin permiso no hay última conocida que leer, y prometerlo sería una degradación en silencio de las que `capacidades.js` declara prohibidas.
- **El motivo se decide por el estado del permiso y no por el texto de la excepción** → asumido (alternativa: mirar el mensaje). Regla: el mensaje lo escribe el módulo nativo y cambia con su versión; el estado del permiso es dato y se puede afirmar.
- **Los cuatro campos nuevos, y no las dos coordenadas del re-anclaje** → asumido (alternativa: guardar el fijo viejo y el nuevo). Regla: RF-PRIV-002 y `seguridad-privacidad.md` §2 — la partida guarda una coordenada, y dos puntos separados por metros y segundos son el principio de una traza.
- **Una salida abierta antes de esta entrega no se re-ancla** → asumido (alternativa: re-anclarla al primer fijo bueno tras actualizar). Regla: su ventana ya pasó y no hay manera de saber cuánto se ha andado desde que se abrió; mover su ancla sería justo lo que la inmutabilidad tras alejarse existe para impedir.
