# SPEC-053 — Los rojos y lo nunca visto: la apertura que no depende del cielo, el punto de partida que cuenta, y la lista cerrada de vías de despertar

## Descripción

Cuatro cosas que están medidas y ninguna inventada. **Una**, abrir una salida hoy exige un fijo puntual y el proveedor no lo entrega — y la raíz está medida el 13-ago-2026 en el emulador `wa-pixel`, y **no es la frescura**: `app/plataforma/posiciones.js:374` pide `getCurrentPositionAsync` con `Location.Accuracy?.Balanced`, y **con la equilibrada el sistema no enciende el GPS**. Durante los **30-32 s** que tarda el intento en fallar, el Event Log de `dumpsys location` no registró **ni una petición**. La suscripción, en cambio, pide con `Accuracy.High` (`posiciones.js:266`) y sí lo enciende: `ProviderRequest[@+2s0ms, HIGH_ACCURACY, WorkSource{com.walkingadventure.app}]` en cuanto la salida se abre. Encima, cuando la puntual lanza, `app/marcha/salida.js:420-423` archiva la excepción como `permiso-denegado` — con el permiso concedido —, así que la marca miente y el comentario del propio código afirma lo contrario de lo que hace. De ahí salen los dos rojos de `@app` (`en-marcha.yaml` y `telon.yaml`) que ninguna fila ha podido cerrar. Y la lección vale más que el arreglo: **el propio módulo lo tenía medido desde el 11-ago-2026, veinte líneas por encima del defecto** — el comentario de `posiciones.js:261-265` dice literalmente «Medido en el emulador el 11-ago-2026: con la equilibrada el sistema ni siquiera enciende el GPS» — y aun así **dos cotejos independientes** atribuyeron el rojo a que «el proveedor está frío». Es la familia de fallo de este repo en una variante nueva: el conocimiento existía, estaba escrito, estaba al lado del síntoma, y **nadie cruzó las dos líneas**. **Dos**, el punto de partida no está en el índice que decide la cadencia del sensor, así que al volver a casa se sigue muestreando por distancia, y quien se para deja de recibir fijos: la permanencia del regreso no acumula y **el telón por regreso no puede saltar**. Medido: `por-distancia` en 6 de los 8 mundos de referencia, y en los otros 2 funciona por accidente de trazado. **Tres**, la propiedad que `app/plataforma/permisos.js:128-136` promete es «nada de esta app se despierta **con la app cerrada**», y lo que la guarda comprueba es la propiedad estrecha —«al arrancar el móvil»— sobre **solo los receptores**: los servicios no entran en el barrido por construcción (`test/nucleo/manifiesto-generado.test.mjs:249-256` recorta bloques `<receiver …>` y nada más), y las tres piezas de FCM que la fila 52 fichó quedan fuera por las dos puertas a la vez. **Cuatro**, en A6P7 «guardar una copia primero» borra la partida mientras quien juega elige destino: `Share.share` resuelve en Android en cuanto lanza el chooser, así que `compartida` nunca vale `false` y la guarda de `app/datos/empezar-de-nuevo.js:227-236` no se dispara nunca.

Esta fila entrega las cuatro con las decisiones que el dueño ratificó el 13-ago-2026 y **reescribió el mismo día con la medida delante**. La apertura se entrega en tres piezas que son una sola decisión: **precisión alta en la puntual** —la raíz medida—, **una sola cota de frescura aplicada a cualquier fijo que ancle el punto de partida, venga por la puerta que venga**, y **respaldo a la última posición conocida con esa misma cota**. El principio que las gobierna se escribe aquí porque vale más que este caso: **una sola cota para el mismo ancla, y la asimetría por defecto queda prohibida**. El defecto hondo que la medición destapa no es el número de la cota: son **dos raseros para la misma ancla, con el estricto puesto en la puerta rara** — una cota de 90 s aplicada solo al respaldo habría sido más estricta que un camino principal que hoy se traga **diez minutos** de caché rancia en silencio. El punto de partida, además, **se re-ancla una sola vez** con el primer fijo bueno mientras no se haya andado; después de alejarse el ancla es inmutable, porque un ancla que se mueve a mitad de salida cambia dónde está «casa» bajo los pies de quien vuelve. La raíz nueva no toca el re-anclaje: lo que hace es darle un segundo cometido, **reparar también el residuo de la puntual** y no solo el del respaldo. El punto de partida **entra al índice que decide la cadencia y solo a ese**: no es sitio jugable, ni geofence de llegada, ni anclaje, ni escena. La guarda pasa a afirmar **la propiedad ancha con una lista cerrada de vías de despertar** —cada receptor **o servicio** capaz de levantar el proceso, nombrado con su motivo, rojo el que llegue sin nombrar— y los receptores de FCM se neutralizan hoy, **cerrando la pareja** y no una pieza. Y en A6P7 **guardar y borrar dejan de ser un solo gesto**: guardar guarda y vuelve diciendo que la copia está hecha, borrar es un segundo toque explícito. El principio que lo decide, y que vale más que este caso: **lo destructivo no se ejecuta sobre una señal que el sistema no garantiza**.

Lo que **no** cambia: el permiso denegado sigue sin abrir salida y sigue diciéndolo con su motivo (SPEC-048, «sin una posición no hay punto de partida»), y ese mismo motivo honesto es el que se enseña cuando lo único que hay es un fijo demasiado viejo — el caso medido en `wa-pixel`, cuyo último conocido tenía **25 h 24 min** y al que **ninguna cota razonable puede decir que sí**; no se pide ningún permiso nuevo; no sale nada nuevo del móvil; la partida no gana ni una coordenada ni una marca de reloj; y la batería de núcleo se mantiene en cero fallos, que la fila 52 dejó verde por primera vez.

Anclas: **RF-BUCLE-001**, **RF-BUCLE-011**, **RF-BUCLE-007**, **RF-PERS-006**, **RF-PJ-009** y **RF-PRIV-003** (`docs/prd.md` §4). Las fuentes que mandan sobre el PRD son `game-design/bucle-jugable.md` **§8** y **§9** (el telón lo echa volver; la salida que no vuelve), `game-design/partida-guardada.md` **§4** (empezar de nuevo), `game-design/seguridad-privacidad.md` **§2** (solo «mientras se usa», y nada corre con la app cerrada) y `game-design/lenguaje.md` (los textos nuevos de A6P7, voz de aplicación, leídos en voz alta). Consume sin rediseñarlo lo entregado por **SPEC-030** (la vida de una salida, el regreso, el rótulo), **SPEC-032** y su iteración (el geofence y la permanencia), **SPEC-039** y **SPEC-040** (la exportación y el borrado), **SPEC-044** (la cadencia como respuesta del paquete), **SPEC-048** (el módulo de ubicación y la apertura) y **SPEC-052** (la neutralización del receptor de avisos).

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `wa-qa-dev` y los ejecuta `wa-qa-tester` contra el código ya commiteado, en un paso posterior del bucle de QA de este repo. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". **Aquí sí la toca, por cuatro sitios**: la cota única, el tope de espera y la decisión de si un fijo puede anclar entran como constantes y función del paquete que la app recibe inyectadas; la última posición conocida entra como respaldo del punto de partida; el punto de partida entra por la firma de la decisión de cadencia; y `AREA_SALIDAS` gana cuatro campos de auditoría del anclaje. Está descrito en «Frontera de inyección y reparto de rutas».
- **Ninguna dependencia nueva.** `getLastKnownPositionAsync` la trae `expo-location` 57.0.9, que ya está instalada (`node_modules/expo-location/build/Location.types.d.ts:125-136`). Ante un requisito de compilación, primero `app/plugins/`, que es donde vive lo que reescribe el proyecto nativo. Si al implementar apareciera una dependencia nueva, **no se mete**: se para y se dice, con el nombre de la dependencia y de la pieza que la pedía.
- **La guarda de vías de despertar vive en `test/**` y la escribe `wa-qa-dev`.** Lo que esta spec entrega del lado de producción es la **lista cerrada declarada** en `app/plataforma/permisos.js` —el dato contra el que la guarda contrasta el manifiesto fusionado— y la neutralización en el plugin. `test/nucleo/plugins-declarados.test.mjs` **se va a poner rojo** con esta entrega, porque la huella SHA-256 del plugin cambia: eso es la guarda haciendo su trabajo, se renombra con el cometido al día y **no se ablanda, ni se borra la exigencia, ni se le añade tolerancia**.
- **Fuera de alcance — el botón atrás del sistema.** Su raíz está medida (`app/App.js:234-250`: `BackHandler` solo se suscribe con `consulta !== null`) y es **decisión de diseño sin tomar**. Se declara en «Lo que esta fila no hace» y no se decide aquí.
- **Fuera de alcance — el reloj de permanencia del regreso** (`packages/nucleo/partida/regreso.js`, 60 s) y el radio de 50 m: son de SPEC-030, no se tocan, y el hallazgo del telón que salta al pasar por delante de casa se ficha sin arreglarse.
- **Fuera de alcance — la composición de las pantallas que esta fila no rediseña.** De A3P1 y A3P2 aquí solo cambia lo que dicen sus marcas. Las pantallas cuya composición se toca son **dos y ninguna más**: **A6P7**, en sus acciones y en su línea de estado, y **A2P1 / A2P5**, que ganan **un estado de espera mientras se busca la posición** — la consecuencia visible de que la puntual pase a pedirse con precisión alta y con tope, porque un tope de diez segundos sin decir nada en pantalla son diez segundos de app colgada.
- **El cambio de precisión de la puntual es una línea y es la raíz.** `Location.Accuracy?.Balanced` → `Accuracy.High` en `app/plataforma/posiciones.js:374`. No lleva dependencia, no lleva permiso y no lleva pantalla; lo que lleva es **coste de latencia**, y por eso arrastra el tope de espera y el estado de espera. Quien lo implemente **no lo entrega solo**: los tres van juntos o la app cambia treinta segundos de espera muda por diez de espera muda.

## Criterios de aceptación

Van en `Dado / cuando / entonces`, el mismo Gherkin español de `docs/testing.md`. Las cinco categorías obligatorias quedan repartidas así: el **camino feliz** vive en «La apertura de una salida», «El punto de partida cuenta para la cadencia» y «A6P7: dos gestos»; la **validación de entradas** en el fijo sin precisión declarada, el fijo sin marca, la última conocida sin marca y la vía declarada sin motivo; el **estado vacío** en la salida sin ninguna posición dentro de la cota y en el mundo sin ningún sitio en el índice; el **estado de error** en el permiso denegado, el permiso no preguntable, el tope de espera agotado y la copia que falla; y los **casos límite** en el fijo justo en la cota, el fijo puntual rancio, el re-anclaje pedido dos veces, el re-anclaje después de alejarse, la hoja del sistema cancelada con atrás y la vía nueva que aparece sin nombrar.

Los de **`@privacidad` y `@determinismo` son bloqueantes**: nada se entrega con uno en rojo.

### La apertura de una salida: precisión alta, una sola cota y respaldo

**La precisión con la que se pide, que es la raíz medida**

- **Dado** la petición del fijo puntual, **cuando** se leen sus opciones, **entonces** pide con **precisión alta** y no con la equilibrada, porque con la equilibrada el sistema **no enciende el GPS** — medido en `wa-pixel` el 13-ago-2026: ni una petición en el Event Log durante los 30-32 s del intento fallido.
- **Dado** la precisión de la puntual y la de la suscripción, **cuando** se comparan, **entonces** son **la misma** y salen del mismo sitio, en vez de estar escritas dos veces y poder desincronizarse.
- **Dado** el sitio donde se pide la puntual, **cuando** se lee su comentario, **entonces** dice por qué la precisión es alta **con la medida y su fecha**, igual que ya lo dice el de la suscripción (`app/plataforma/posiciones.js:261-265`).

**La cota única, que se aplica a las dos puertas**

- **Dado** cualquier fijo que vaya a anclar el punto de partida, **cuando** se decide si sirve, **entonces** se le aplica **la misma cota de frescura y la misma precisión exigida**, sin importar si vino de la puntual o de la última conocida.
- **Dado** el código entregado, **cuando** se buscan las cotas de frescura del punto de partida, **entonces** hay **una sola constante** y ninguna comparación que use un número distinto según la puerta.
- **Dado** un fijo puntual que llega pero cuya marca es más vieja que la cota, **cuando** se decide, **entonces** **no ancla**: se descarta exactamente igual que una última conocida vieja. Medido en `wa-pixel`: la puntual de hoy resuelve en ~2,45 s devolviendo caché de **90,2 s**, **279,6 s** y **643,3 s** sin pedir fijo nuevo y sin decirlo.
- **Dado** la posición movida 100 m y el GPS apagado 150 s, **cuando** se echa a andar, **entonces** un fijo de **193,5 s** y 100 m **no puede anclar el punto de partida** — hoy la salida se abre con él y nada protesta, y eso es lo que esta fila cierra.
- **Dado** un fijo cuya precisión declarada es peor que la exigida, **cuando** se decide, **entonces** se descarta igual que si no existiera, venga de la puerta que venga.
- **Dado** un fijo sin marca de tiempo o sin precisión declarada, **cuando** se decide, **entonces** se descarta: lo que no se puede fechar no se puede acotar.
- **Dado** la cota, el tope de espera y la precisión exigida, **cuando** se busca dónde están escritos, **entonces** son constantes del paquete con su motivo, y la app las recibe inyectadas en lugar de llevar su propia copia.

**El respaldo, y el caso en que no hay nada**

- **Dado** una salida que se echa a andar con el permiso concedido, **cuando** el fijo puntual llega dentro de la cota, **entonces** la salida se abre con él y el origen del punto de partida queda anotado como `puntual`.
- **Dado** el permiso concedido y una puntual que no trae nada dentro de la cota, **cuando** hay una última posición conocida que **sí** la cumple, **entonces** la salida **se abre** con ella y el origen queda anotado como `ultima-conocida`.
- **Dado** ese mismo caso, **cuando** se leen las opciones con las que se pidió la última conocida, **entonces** llevan la edad máxima y la precisión exigida escritas, y ninguna de las dos queda por omisión.
- **Dado** un último fijo conocido de **25 h 24 min**, que es el que `wa-pixel` tiene de arranque, **cuando** se echa a andar, **entonces** la salida **no se abre** y el motivo es `sensor-sin-responder`, con el texto honesto de que sin una posición no hay punto de partida: **ninguna cota razonable acepta ese fijo**, ni la de 90 s ni la de 25.
- **Dado** el permiso de ubicación **denegado**, **cuando** se echa a andar, **entonces** la salida no se abre y el motivo es `permiso-denegado`: el permiso denegado sigue sin abrir salida y **no** cae a la última conocida.
- **Dado** el permiso concedido y un proveedor que lanza al pedir el fijo, **cuando** se decide el motivo, **entonces** se decide **consultando el estado del permiso** y no interpretando el texto de la excepción.
- **Dado** una salida que no se pudo abrir, **cuando** se lee la marca de motivo, **entonces** dice una del vocabulario cerrado que ya existe y **ninguna palabra nueva**.
- **Dado** el permiso que no se pudo preguntar, **cuando** se echa a andar, **entonces** el motivo sigue siendo `permiso-no-preguntable` y sigue viéndose distinto de denegado.
- **Dado** «seguir con ella» sobre una salida con el rótulo retirado, **cuando** la puntual no trae nada dentro de la cota, **entonces** se retoma con la última conocida por la misma regla y con el mismo motivo honesto si tampoco la hay.

### Lo que se enseña mientras se busca, y hasta cuándo se espera

- **Dado** el toque en «Salir a andar» con el permiso concedido, **cuando** empieza la búsqueda de posición, **entonces** la pantalla lo dice **de inmediato** con una línea de espera, y no se queda muda mientras el GPS se enciende.
- **Dado** esa línea de espera, **cuando** se lee, **entonces** es voz de aplicación, dice que se está buscando dónde estás, y **no lleva barra, ni porcentaje, ni cuenta atrás, ni ninguna cifra**.
- **Dado** la espera de la puntual, **cuando** pasa el tope declarado, **entonces** se deja de esperar y se pasa a la última conocida: la apertura **no puede tardar más que el tope**, y desde luego no los 30-32 s medidos hoy.
- **Dado** el tope agotado y ninguna última conocida dentro de la cota, **cuando** termina la apertura, **entonces** se enseña el motivo honesto, y el conjunto de la espera más el no cabe dentro del tope.
- **Dado** la línea de espera, **cuando** la apertura termina de la manera que sea, **entonces** desaparece: no queda colgada ni cuando la salida se abre ni cuando no.
- **Dado** el estado de espera, **cuando** se enumeran las acciones de la pantalla mientras dura, **entonces** ninguna acción destructiva ni de navegación queda disponible a medias, y volver sigue estando.
- **Dado** el tope de espera, **cuando** se busca su número, **entonces** está declarado con su motivo y con la medida de latencia de la puntual con precisión alta al lado; si esa medida dice otra cosa, **se cambia el número con ella delante y no se deja el que había**.

### El re-anclaje del punto de partida

- **Dado** una salida abierta con el punto de partida anclado, **cuando** llega el primer fijo cuya precisión declarada es suficiente y dentro del plazo de re-anclaje, **entonces** el punto de partida se sustituye por ese fijo.
- **Dado** una salida ya re-anclada, **cuando** llega otro fijo mejor, **entonces** **no** se vuelve a re-anclar: el re-anclaje ocurre como mucho una vez por salida.
- **Dado** una salida abierta cuyo primer fijo bueno llega pasado el plazo de re-anclaje, **cuando** llega, **entonces** el punto de partida no se mueve.
- **Dado** una salida que ya se declaró alejada, **cuando** llega cualquier fijo, **entonces** el punto de partida es **inmutable** y no se re-ancla por ninguna vía.
- **Dado** una salida abierta con el punto de partida `puntual`, **cuando** llega el primer fijo bueno, **entonces** también se re-ancla si cumple el plazo: la regla **no distingue por el origen del punto**, porque un fijo puntual rancio es tan malo como una última conocida vieja — y está medido que la puntual devuelve caché de hasta 643,3 s sin decirlo. El re-anclaje repara **las dos puertas**, no solo el respaldo.
- **Dado** una salida re-anclada, **cuando** se cierra la app y se vuelve a abrir, **entonces** el punto de partida que vuelve es el re-anclado y la salida sigue declarándose re-anclada.
- **Dado** el plazo de re-anclaje y la precisión exigida, **cuando** se leen, **entonces** están declarados en el paquete con su motivo y con la aritmética de la que salen escrita al lado.

### Lo que el re-anclaje anota, que no es un rastro *(`@privacidad`, bloqueante)*

- **Dado** el esquema del área de salidas después de esta fila, **cuando** se enumeran sus campos nuevos, **entonces** son exactamente cuatro: el origen del punto, si se re-ancló, cuántos metros se movió el ancla y cuánto tiempo pasó entre las dos marcas del sensor.
- **Dado** esos cuatro campos, **cuando** se lee su naturaleza, **entonces** ninguno es una coordenada y ninguno es una marca de reloj: son un vocabulario cerrado, un booleano, una distancia y una duración.
- **Dado** una salida re-anclada, **cuando** se inspecciona el documento de partida, **entonces** **la única coordenada** que contiene sigue siendo el punto de partida de la salida en curso, uno y no dos.
- **Dado** una salida re-anclada, **cuando** se busca el punto de partida anterior, **entonces** no está en ninguna parte: se sustituye, no se apila.
- **Dado** una salida cerrada y su telón leído, **cuando** se abre otra, **entonces** los cuatro campos nuevos mueren con la salida anterior, igual que el punto y las dos marcas.
- **Dado** la copia exportada tras una salida re-anclada, **cuando** se busca dentro, **entonces** no hay traza, ni histórico, ni las dos posiciones del re-anclaje.
- **Dado** la salida entera con el servicio en primer plano corriendo, **cuando** se inspecciona el tráfico saliente, **entonces** no sale ninguna posición y no sale nada nuevo respecto de la entrega anterior.
- **Dado** la línea del rótulo del sistema, **cuando** se lee tras un re-anclaje, **entonces** dice exactamente lo mismo que antes: el anclaje no asoma a la pantalla de bloqueo.

### El punto de partida cuenta para la cadencia

- **Dado** una salida abierta y quien juega en el punto de partida, **cuando** se pide la cadencia del muestreo, **entonces** es **por tiempo**, aunque no haya ningún geofence de sitio debajo.
- **Dado** los ocho mundos de referencia de `test/nucleo/mundo-de-prueba.mjs`, **cuando** se pide la cadencia en el punto de partida de cada uno, **entonces** sale por tiempo en **los ocho**, y no en seis.
- **Dado** quien se aleja del punto de partida, **cuando** la última posición queda a más del radio del regreso más el margen de cercanía, **entonces** la cadencia vuelve a ser por distancia.
- **Dado** una posición en el borde del radio del regreso que entra y sale por el ruido del fijo, **cuando** se decide la cadencia, **entonces** la histéresis impide que se cambie de cadencia en cada muestra, igual que con los geofences de sitio.
- **Dado** una cadencia por tiempo decidida por el punto de partida, **cuando** se lee lo que devuelve la decisión, **entonces** **no nombra ningún sitio** y declara que la razón es el punto de partida.
- **Dado** una posición que está a la vez dentro del geofence de un sitio y cerca del punto de partida, **cuando** se decide la cadencia, **entonces** sale por tiempo una sola vez y el sitio nombrado es el sitio real.
- **Dado** una salida que se abre, **cuando** se decide la cadencia por primera vez, **entonces** se decide **con el punto de partida y antes de arrancar el servicio**, como ya hacía.
- **Dado** una partida sin salida abierta, **cuando** se pide la cadencia, **entonces** se decide solo con los geofences del mapa activo, sin punto de partida y sin fallar.
- **Dado** quien vuelve al punto de partida tras haberse alejado y se queda quieta el tiempo declarado, **cuando** llegan las posiciones, **entonces** llegan con la cadencia por tiempo y la permanencia del regreso acumula hasta cerrar la salida.

### El punto de partida no es un sitio jugable

- **Dado** el índice que devuelve `sitiosConPosicion` para un mundo, **cuando** se enumera, **entonces** contiene exactamente los núcleos, sus servicios y los parajes, y **no** el punto de partida.
- **Dado** una salida abierta con el punto de partida en un sitio donde no hay ningún sitio del mundo, **cuando** quien juega se queda allí el tiempo de permanencia de una llegada, **entonces** **no se valida ninguna llegada**.
- **Dado** ese mismo caso, **cuando** se enumera lo que espera, **entonces** no hay ninguna escena, ninguna ficha y ningún visor.
- **Dado** el mapa pintado durante una salida, **cuando** se enumeran sus elementos, **entonces** el punto de partida no aparece como sitio: lo único que se pinta en esa posición sigue siendo lo que ya se pintaba.
- **Dado** el punto de partida, **cuando** se busca si consume anclaje o si produce descarte, **entonces** no hace ninguna de las dos cosas.
- **Dado** la superficie del paquete, **cuando** se busca por dónde entra el punto de partida a la decisión de cadencia, **entonces** entra **por la firma de la decisión** y no metiéndolo en el índice de geofences.

### Las vías de despertar, con lista cerrada

- **Dado** `app/plataforma/permisos.js`, **cuando** se lee la declaración nueva, **entonces** enumera **una a una** las vías por las que el sistema puede levantar este proceso, cada una con su clase, su tipo —receptor o servicio—, la acción o el filtro que la descubre, quién la declara y su motivo.
- **Dado** esa lista, **cuando** se comprueba lo que promete, **entonces** afirma la propiedad **ancha** de `permisos.js` —«nada de esta app se despierta con la app cerrada»— y ya no solo la estrecha de «al arrancar el móvil».
- **Dado** el manifiesto fusionado de una compilación de depuración, **cuando** se enumeran sus receptores **y sus servicios** con sus filtros, **entonces** todos los que pueden levantar el proceso están nombrados en la lista, y **uno sin nombrar pone la batería roja**.
- **Dado** una entrada de la lista, **cuando** se lee, **entonces** dice si su mecanismo está **medido** o solo **declarado**, y el número de las declaradas sin medir se dice con el número delante en vez de disolverse.
- **Dado** los tres adyacentes que hoy existen —el servicio de Health Connect, el instalador de perfiles y el trío de transporte de datos—, **cuando** se leen sus entradas, **entonces** cada una nombra lo que la declara y por qué está, y ninguna se da por inocua sin decir si se midió.
- **Dado** un manifiesto de ejemplo con un servicio exportado con filtro que la lista no nombra, **cuando** se le aplica la lectura de la guarda, **entonces** lo señala nombrando la clase y el filtro.
- **Dado** la lista, **cuando** se busca una excepción por clase, un `skip` o una lista de tolerados sin motivo, **entonces** no hay ninguna: todo lo que está, está nombrado y explicado.

### Los receptores de FCM, neutralizados por la pareja

- **Dado** el manifiesto fusionado tras esta fila, **cuando** se busca `com.google.firebase.iid.FirebaseInstanceIdReceiver`, **entonces** ya no puede recibir el mensaje de c2dm: la vía queda cerrada por la forma que su mecanismo de descubrimiento exige.
- **Dado** ese mismo manifiesto, **cuando** se buscan los dos servicios que declaran `com.google.firebase.MESSAGING_EVENT` —el de Firebase y el de Expo—, **entonces** están neutralizados **los dos**, y no uno.
- **Dado** un manifiesto de ejemplo en el que se neutraliza solo el de Expo, **cuando** se le aplica la guarda, **entonces** se pone roja: el de Firebase resolvería en su lugar por el mismo filtro, y la vía se cierra por la pareja y no por la pieza.
- **Dado** todo el código vivo de `app/` y `packages/`, **cuando** se buscan las llamadas que piden un token de push, **entonces** no hay ninguna, y tampoco hay `google-services.json` ni `googleServicesFile` declarado.
- **Dado** esa premisa, **cuando** se busca su guarda, **entonces** existe y se pone roja el día que alguien pida un token: neutralizar una vía que sí se usa dejaría las notificaciones push rotas en silencio.
- **Dado** la cabecera del plugin, **cuando** se lee, **entonces** dice **cómo vuelven declaradas las tres piezas** el día que el producto adopte push, y que ese día es una decisión de producto y no un ajuste de configuración nativa.
- **Dado** la app tras la neutralización, **cuando** entrega un aviso local, **entonces** lo entrega igual que antes: en primer plano, al momento y sin disparador.

### Lo que ya estaba cerrado y no se pierde

- **Dado** el manifiesto fusionado, **cuando** se enumeran todos sus receptores, **entonces** ninguno declara ninguna de las seis acciones de arranque, sin lista de tolerados y sin excepción por clase, exactamente como lo dejó SPEC-052.
- **Dado** el receptor de avisos de `expo-notifications`, **cuando** se leen las acciones de sus filtros, **entonces** siguen siendo exactamente la de entrega, y sigue habilitado y sin exportar.
- **Dado** la entrada de `RECEIVE_BOOT_COMPLETED` en `PERMISOS_QUE_UNA_LIBRERIA_EXIGE`, **cuando** se lee su `aCambio`, **entonces** nombra también lo neutralizado en esta fila **y sigue conteniendo literalmente la expresión «receptor de tareas se sustituye»**.
- **Dado** el `Info.plist` generado de iOS, **cuando** se leen sus `UIBackgroundModes`, **entonces** siguen siendo exactamente `['location']`.
- **Dado** el manifiesto fusionado, **cuando** se buscan los permisos prohibidos, **entonces** no aparece ninguno, y en particular no aparece `ACCESS_BACKGROUND_LOCATION`.
- **Dado** el código de `app/`, **cuando** se busca una llamada a `requestBackgroundPermissionsAsync`, **entonces** sigue sin haber ninguna.
- **Dado** un clon sin compilar, sin manifiesto fusionado y sin `Info.plist` generado, **cuando** corre la batería de núcleo, **entonces** los casos del manifiesto **no se registran** y `test/reports/manifiesto-generado.estado.json` dice `mirado: false`, en vez de pasar en verde.

### A6P7: guardar y borrar son dos gestos

- **Dado** la pantalla de empezar de nuevo, **cuando** se enumeran sus acciones, **entonces** siguen siendo tres, y la primera **solo guarda**.
- **Dado** quien elige guardar una copia, **cuando** la hoja del sistema se resuelve de la manera que sea, **entonces** **la partida no se borra**.
- **Dado** quien elige guardar una copia y cancela la hoja del sistema, **incluido con el botón atrás**, **cuando** vuelve a la pantalla, **entonces** la partida sigue entera y las tres acciones están.
- **Dado** quien elige guardar una copia y la copia se hace, **cuando** vuelve a la pantalla, **entonces** una línea dice que la copia está hecha y las tres acciones siguen estando.
- **Dado** la copia ya hecha, **cuando** se lee la acción destructiva, **entonces** su texto no afirma que no se ha guardado nada: dice lo que hace, y lo dice igual se haya guardado o no.
- **Dado** la partida borrada, **cuando** se busca cómo ocurrió, **entonces** ocurrió tras el gesto explícito de borrar y **nunca** al resolverse la hoja del sistema.
- **Dado** la acción de borrar, **cuando** se toca, **entonces** borra sin segundo aviso, sin casilla y sin texto que teclear, como ya estaba decidido.
- **Dado** la acción destructiva, **cuando** se lee su presentación, **entonces** sigue sin ser el botón principal: hueca, con el color de lo destructivo, debajo de la de guardar.
- **Dado** la exportación que falla, **cuando** termina, **entonces** la partida sigue entera y se dice en una línea, como ya estaba.
- **Dado** un borrado terminado, **cuando** se comprueba lo que queda, **entonces** no queda la copia de trabajo de la caché, y **sí** quedan intactos los ficheros que quien juega guardó fuera.
- **Dado** los textos nuevos de la pantalla, **cuando** se leen, **entonces** son voz de aplicación, se leen en voz alta sin tropezar, y no llevan ninguna cifra de distancia, tiempo, ritmo ni progreso.

### Determinismo y frontera del núcleo

- **Dado** `packages/nucleo/`, **cuando** se busca `Math.random`, `Date.now` o `new Date`, **entonces** no hay ninguno: la antigüedad del re-anclaje se calcula restando **dos marcas del sensor**, que viajan dentro de las posiciones.
- **Dado** el código nuevo de `app/`, **cuando** se busca un reloj propio para decidir la frescura, **entonces** no hay ninguno: la edad máxima se le pide al módulo nativo, que devuelve nada si el fijo es viejo.
- **Dado** la misma secuencia de posiciones inyectada dos veces sobre el mismo mundo, **cuando** se comparan, **entonces** el re-anclaje, la cadencia y el cierre por regreso salen idénticos.
- **Dado** `packages/nucleo/`, **cuando** se enumeran sus imports, **entonces** no aparecen `expo-location`, `expo-task-manager` ni nada de React Native.
- **Dado** un clon limpio sin `node_modules`, **cuando** se ejecuta la batería de `@nucleo`, **entonces** arranca y pasa.
- **Dado** la batería de núcleo tras esta fila, **cuando** se cuenta, **entonces** sigue en **cero fallos**, y ninguna guarda hoy verde enrojece.

### Lo ya medido, que se afirma con el número, y lo que queda por medir

Lo **medido el 13-ago-2026 en `wa-pixel`**, que deja de ser premisa y pasa a ser dato:

- **Dado** quien juega parada y la cadencia `por-distancia`, **cuando** se cuentan los fijos que llegan, **entonces** son **cero en 5 min 56 s** —nueve muestras con `ultimaMarcaMs` congelada en el mismo milisegundo— y el primero llega a los **355,8 s**, y solo al mover la posición. La premisa de `packages/nucleo/partida/llegadas.js:218-222` decía «un fijo en trescientos segundos»; lo medido es **ninguno en trescientos cincuenta y seis**, así que la premisa **se queda corta y no se cae**.
- **Dado** quien juega parada dentro de un geofence con cadencia `por-tiempo`, **cuando** llegan las muestras, **entonces** la marca avanza en **cada una** (+25 a +35 s) y `ultimoPropioMs` **no se mueve ni un milisegundo**: llegan posiciones y ninguna cuenta como metro propio. La contraprueba cierra el mecanismo por los dos lados, y de paso validó la permanencia y saltó la escena sola.
- **Dado** esas dos medidas juntas, **cuando** se lee la decisión 2, **entonces** es **condición necesaria** para que el regreso pueda cerrarse, y ya no una justificación citada de segunda mano.

Lo que **queda por medir dentro de esta fila** y hay que escribir con el número, salga lo que salga:

- **Dado** la puntual pedida con precisión alta y el GPS encendiéndose de frío, **cuando** se mide cuánto tarda en entregar el primer fijo, **entonces** el número se declara y **el tope de espera se confirma o se cambia con él delante**: es el coste que compra el arreglo de la raíz, y hoy no está medido.
- **Dado** la apertura completa desde aparato limpio, **cuando** se cronometra del toque a la pantalla siguiente, **entonces** se declara cuánto tarda cuando abre y cuánto cuando no: el criterio es **diez segundos honestos de «buscando dónde estás» antes que treinta de espera para un no**.
- **Dado** la cota de frescura, **cuando** se busca cómo calibrarla, **entonces** se declara que **en el emulador no se puede**: su GPS es bajo demanda y su último conocido es de 25 h, así que allí la cota no decide nunca nada. El número que se entrega es **calibración pendiente**, no constante medida, y la spec dice qué medida en un teléfono real la afinaría.
- **Dado** los flujos `en-marcha.yaml` y `telon.yaml` desde aparato limpio, **cuando** se corren tres tandas seguidas, **entonces** el resultado se declara junto con su precondición completa —incluida la del bucle de posición, más abajo—: un verde que depende de un estado que nadie declaró es el rojo de otro día.

## UX Design

### Wireframe textual

**Ninguna pantalla se dibuja de nuevo y ninguna se añade a `docs/flujo.md`.** Las que cambian de composición son **dos**: **A6P7**, en sus acciones, y **A2P1 / A2P5**, que ganan un estado de espera mientras se busca la posición. Ninguna de las dos es pantalla nueva y ninguna cambia de nodo.

**A6P7 — Empezar de nuevo.** **Layout de pantalla de consulta, en sans desde el titular**, porque hereda el registro de aplicación de los ajustes: rótulo de vuelta «‹ Ajustes» y titular «Empezar de nuevo». Los tres bloques de texto de SPEC-040 **no se tocan**.

**A6P7 — Empezar de nuevo** (pantalla 7 · artefacto 6). Al pie, empujadas abajo, las tres acciones, en este orden y con estos pesos:

```
[  Guardar una copia          ]   ← acción principal, sólida. Solo guarda.
[  Borrar la partida          ]   ← hueca, con el borde y el texto en el color de lo destructivo
   Dejarlo como está              ← texto, sin caja; nunca desaparece
```

**Estado de espera**, igual que antes: al tocar guardar, las tres acciones se sustituyen por una línea de espera, sin barra y sin porcentaje, mientras el fichero se empaqueta.

**Estado nuevo — la copia hecha.** Al volver de la hoja del sistema **las tres acciones vuelven siempre**, y encima aparece una línea que dice que la copia está guardada. Nada se borra. Si la hoja se canceló, la línea es la de siempre —que no se ha guardado nada y que la partida sigue— y tampoco se borra nada. **Las dos ramas terminan en el mismo sitio**, y esa es la decisión: la pantalla ya no distingue lo que Android no le dice.

```
  La copia está guardada.          ← línea de estado, solo tras guardar
  [  Guardar una copia          ]
  [  Borrar la partida          ]
     Dejarlo como está
```

**Estado de error** y **estado de la partida sin mundo**: sin cambios respecto de SPEC-040.

**A2P1 y A2P5 — la portada y la preparación, con el estado de espera nuevo.** La composición se mantiene entera; lo que se añade es **un estado**, con la misma forma que ya usa A6P7 al empaquetar: al tocar «Salir a andar», la acción se sustituye por una línea de espera **sin barra y sin porcentaje** mientras se busca la posición, y al terminar la línea desaparece — hacia A3P1 si la salida se abre, o de vuelta a la pantalla con el motivo literal debajo de la acción si no.

```
  [  Salir a andar  ]
        │ toque
        ▼
  Buscando dónde estás…              ← línea de espera; sin barra, sin cifras, tope declarado
        │
        ├── posición dentro de la cota ──► A3P1, en marcha
        └── tope agotado y nada dentro de la cota ──► vuelve la acción,
                                                     con el motivo literal debajo
```

El texto exacto de la línea lo escribe quien implementa con `game-design/lenguaje.md` delante y se lee en voz alta; lo que esta spec fija es **lo que no puede llevar**: ninguna cifra de tiempo, ninguna cuenta atrás y ninguna promesa de cuánto falta.

**A3P1 / A3P2** (en marcha): composición intacta. Lo único que cambia es **qué dicen sus marcas**, y que ahora la salida puede abrirse con la última conocida donde antes no se abría.

### Pantallas y elementos utilizados

```
Pantallas cuya composición cambia:
  A6P7  pantalla 7 · artefacto 6 — Empezar de nuevo     (dueña: fila 40; esta fila la itera)
  A2P1  pantalla 1 · artefacto 2 — La portada           (dueña: fila 43/48; gana el estado de espera)
  A2P5  pantalla 5 · artefacto 2 — La preparación       (dueña: fila 43/48; gana el estado de espera)

Pantallas que esta fila toca sin recomponer:
  A3P1 / A3P2  pantallas 1 y 2 · artefacto 3 — En marcha (dueña: fila 48)

Elementos del proyecto que se usan: la tipografía sans de la voz de aplicación, el color
de la marca para lo destructivo, el botón sólido y el botón hueco.

Elemento nuevo: ninguno.
```

### data-testid

Los existentes no se tocan: `empezar-de-nuevo`, `empezar-de-nuevo-perdida`, `empezar-de-nuevo-congelado`, `empezar-de-nuevo-guardar`, `empezar-de-nuevo-borrar`, `empezar-de-nuevo-dejarlo`, `empezar-de-nuevo-estado`, `salida-situacion`, `rotulo-estado`, `salida-no-se-abre`, `salida-cadencia`, `marca-posicion`.

Lo que cambia y lo que se añade, pocos y estables:

- `empezar-de-nuevo-estado` — **gana un valor** en su vocabulario cerrado: `preguntando` · `guardando-copia` · `copia-guardada` · `borrando` · `no-se-pudo`. Es lo que hace afirmable desde el aparato que guardar terminó y que no borró.
- `salida-punto-origen` — marca con el origen del punto de partida, vocabulario cerrado `puntual` · `ultima-conocida`. Es lo que hace afirmable que la apertura cayó a la última conocida sin tener que deducirlo de que la salida se abrió.
- `salida-reanclaje` — marca con `sin-reanclar` · `reanclada`. Sin ella, el re-anclaje solo se puede afirmar sobre la función pura y nunca sobre el aparato.
- `salida-buscando` — el estado de espera de A2P1 / A2P5 mientras se busca la posición. Es lo que hace afirmable desde el aparato que la espera **aparece al instante y desaparece siempre**, que es la mitad del arreglo que un flujo puede ver; sin ella, un tope que no se respeta se leería como una app lenta.

Regla que se mantiene: son contenedores y marcas, no uno por nodo, y todo lo demás se localiza por texto o por su papel.

### Patrón de interacción

- **Lo destructivo no se ejecuta sobre una señal que el sistema no garantiza.** Regla: `partida-guardada.md` §4 pone el peso en escribir el aviso para que se lea, y encadenar el borrado a la promesa de la hoja de compartir es exactamente lo contrario — una acción irreversible disparada por un evento que Android resuelve antes de tiempo. Ni la promesa de la hoja ni la memoria de quien juega valen como confirmación: **el gesto explícito sí**. Y la decisión no depende de que hoy `Share.share` mienta: dependería igual el día que dijera la verdad, porque una copia guardada no es una orden de borrar.
- **La acción destructiva sigue sin ser la principal.** Regla: `partida-guardada.md` §4, «guardar copia va arriba; borrar sin nada es una elección explícita; salir sin hacer nada siempre está». El desacople la refuerza en vez de debilitarla: ahora las dos son elecciones y ninguna arrastra a la otra.
- **No hay segundo aviso, ni casilla, ni texto que teclear.** Regla: la misma. El segundo toque **no es una confirmación**: es otra acción, con su propio texto y su propio botón. Un segundo aviso enseña a confirmar sin leer; dos acciones distintas enseñan qué hace cada una.
- **Una sola cota para el mismo ancla, y la asimetría por defecto prohibida.** Decisión no cubierta por el design system, y es la que ordena toda la apertura. Lo que ancla el punto de partida es **un fijo**, no una puerta: aplicarle rasero distinto según por dónde entró es exactamente el defecto que la medición destapó, con el rasero estricto puesto en la puerta rara y el camino principal tragándose diez minutos de caché en silencio. Si alguna vez aparece razón **medida** para dos números distintos, se trae con la medida y se escribe; hasta entonces, el número es uno.
- **La apertura prefiere abrir a ser purista, pero no a costa de mentir.** Regla: `bucle-jugable.md` §8 —la norma es volver y el telón lo echa volver—: una salida que no se abre por un fijo que tarda cinco segundos deja el bucle sin empezar, y una que se abre con un punto viejo deja el bucle sin cerrar. La cota más el re-anclaje resuelven los dos a la vez, y el motivo honesto se conserva para cuando no hay nada con lo que anclar — incluido el fijo de 25 h, al que se le dice que no.
- **Esperar se dice; esperar callado, no.** Decisión no cubierta por el design system. Pedir con precisión alta enciende el GPS y eso cuesta tiempo, así que la elección real no es «rápido o lento», sino **espera muda o espera dicha**. El criterio del dueño lo fija con número: mejor **diez segundos honestos de «buscando dónde estás» que treinta de espera para un no**. De ahí salen las tres piezas que van juntas —precisión alta, tope de espera y línea de espera—: entregar la primera sin las otras dos cambia una app muda de treinta segundos por otra muda de diez.
- **La espera no lleva cifras.** Regla: `lenguaje.md` y la misma disciplina que ya rige el empaquetado de A6P7 —línea sin barra y sin porcentaje—. Una cuenta atrás convierte el tope en una promesa que el sistema no garantiza, y este proyecto ya ha pagado una vez por creerse una señal que Android no da.
- **Después de alejarse, el punto de partida es inmutable.** Decisión no cubierta por el design system. Se resuelve así porque **«casa» es lo que decide cuándo cae el telón**: mover el ancla a mitad de salida cambia el sitio al que hay que volver bajo los pies de quien vuelve, y eso es peor que un ancla imperfecta. El re-anclaje vive en la ventana en la que todavía no se ha andado nada, y ahí no puede quitarle nada a nadie.
- **El punto de partida entra a la cadencia y no al juego.** Decisión no cubierta por el design system. Se resuelve **por la firma de la decisión de cadencia y no metiéndolo en el índice de geofences**, porque el índice alimenta a la vez la cadencia y las llegadas: meterlo ahí convertiría el portal de casa en un sitio al que se llega, con su escena y su ficha, y eso no lo ha decidido nadie. La separación es de forma, no de disciplina — así no se puede hacer mal por descuido.
- **La cadencia rápida en casa se acota igual que la de un sitio.** Regla: SPEC-044 acotó el gasto a estar dentro de un geofence en vez de a un halo. Aquí el radio es el del regreso, que es exactamente el sitio donde hacen falta fijos para que la permanencia acumule, y la histéresis es la misma.
- **La vía de despertar se cierra por la pareja.** Decisión no cubierta por el design system. Neutralizar solo el servicio de Expo deja al de Firebase resolviendo en su lugar por el mismo filtro: la unidad de neutralización es **el filtro**, no la clase. Es la misma lección de la fila 52 con el signo cambiado — allí el descubrimiento por acción obligaba a **conservar** el filtro; aquí obliga a cerrarlo entero.

## Notas técnicas

### Frontera de inyección y reparto de rutas

| Ruta | Qué entrega |
| --- | --- |
| `packages/nucleo/partida/salidas.js` | la cota de frescura **única**, el tope de espera, el plazo y la precisión del re-anclaje como constantes con su motivo; la decisión de si un fijo puede anclar —la misma para las dos puertas—, la decisión de re-anclar y sus cuatro campos de auditoría |
| `packages/nucleo/partida/estado.js` | los cuatro campos nuevos de `AREA_SALIDAS` (`:323-334`) y su declaración en el formato |
| `packages/nucleo/partida/llegadas.js` | el punto de partida como parámetro de `cadenciaDeMuestreo`, con el radio del regreso y la misma histéresis; `sitiosConPosicion` **intacta** |
| `app/plataforma/posiciones.js` | **la precisión alta en `posicionPuntual` (`:374`), que es la raíz**, con su comentario y su medida; el tope de espera sobre esa llamada; y la segunda vía (`getLastKnownPositionAsync` con edad máxima y precisión exigida) dentro de `posicionPuntual` o al lado. La puntual devuelve el fijo **con su marca**, para que la cota se pueda aplicar a lo que trae |
| `app/marcha/salida.js` | la cota aplicada a lo que devuelva cualquiera de las dos puertas, el motivo decidido por el estado del permiso, el re-anclaje al recibir posición, y el punto de partida pasado a la decisión de cadencia |
| `app/pantallas/antes-de-salir-montado.jsx` | el estado de espera de A2P1 / A2P5 y su marca `salida-buscando`, al lado de `salida-no-se-abre` (`:181`) |
| `app/plataforma/permisos.js` | la lista cerrada de vías de despertar y el `aCambio` al día |
| `app/plugins/retira-permisos-prohibidos.js` | la neutralización de las tres piezas de FCM y la cabecera que dice cómo vuelven |
| `packages/nucleo/partida/borrado.js` | el estado `copia-guardada` y los textos de los dos gestos |
| `app/datos/empezar-de-nuevo.js` | `guardaCopia` separado de `borra`; la limpieza de la copia de trabajo dentro del borrado |
| `app/pantallas/empezar-de-nuevo.jsx` | las etiquetas nuevas y la línea de copia hecha |

El reparto está elegido para que **casi todo sea afirmable en `@nucleo`**: la cota —la misma para las dos puertas—, el tope, el plazo, el re-anclaje, la cadencia en los ocho mundos y los cuatro campos son funciones puras sobre secuencias de posiciones y estados de partida. Lo que necesita aparato es poco y está dicho: que la apertura abra con precisión alta y dentro del tope, que el estado de espera aparezca y desaparezca, y que A6P7 no borre al cancelar la hoja. Lo que **ya no** necesita aparato, porque está medido: que las posiciones no lleguen estando parada con cadencia por distancia, y que sí lleguen con cadencia por tiempo.

### La raíz medida del rojo, y la lección que sobrevive al arreglo

Medido el **13-ago-2026** en el emulador `wa-pixel`, y lo que tumba es la explicación, no el trabajo:

| Qué | Medida |
| --- | --- |
| La puntual pide con `Accuracy?.Balanced` (`posiciones.js:374`) | durante los **30-32 s** del intento fallido, el Event Log de `dumpsys location` **no registra ni una petición**: con la equilibrada el sistema no enciende el GPS |
| La suscripción pide con `Accuracy.High` (`posiciones.js:266`) | `ProviderRequest[@+2s0ms, HIGH_ACCURACY, WorkSource{com.walkingadventure.app}]` en cuanto la salida se abre |
| Del toque en `salir-sin-mas` al nodo `salida-no-se-abre` | **30-32 s**, con el motivo literal «… — Current location is unavailable. Make sure that location services are enabled» |
| El último fijo conocido en ese instante | **25 h 24 min** en `gps` y `fused`; `network` sin fijo |
| La puntual cuando **sí** responde | caché rancia sin decirlo: aperturas con fijos de **90,2 s**, **279,6 s** y **643,3 s** (10 min 43 s), todas resolviendo en **~2,45 s** y **sin pedir fijo nuevo** |
| La prueba que lo cierra | posición movida **100 m**, GPS apagado **150 s**: la salida se abre anotando como punto de partida un fijo de **193,5 s** y 100 m de distancia. **Nada protestó** |

**La lección, que va escrita porque vale más que el arreglo.** El propio módulo lo tenía medido desde el **11-ago-2026**, en el comentario de `posiciones.js:261-265` —«Medido en el emulador el 11-ago-2026: con la equilibrada el sistema ni siquiera enciende el GPS»—, **veinte líneas por encima del defecto**. La causa llevaba dos días escrita al lado del síntoma y **dos cotejos independientes** atribuyeron el rojo a «el proveedor está frío». Es la familia de fallo de este repo en una variante nueva: no es que faltara la medida, es que **la medida existía, estaba escrita y no llegó al sitio**. La defensa que esta fila deja puesta es de forma y no de disciplina: la precisión de la puntual y la de la suscripción salen **del mismo sitio**, así que no se pueden volver a separar sin escribirlo aposta.

**Y una consecuencia que hay que ver entera**: el rojo no lo curaba ninguna cota, porque la cota no era el problema. Pero el arreglo de la raíz tampoco basta solo — la caché rancia de 643,3 s la sigue devolviendo la misma llamada —, y por eso las tres piezas van juntas.

### La cota de frescura: una sola, y por qué la aritmética del peor caso no la ata

**Primero, el principio, que es lo que la medición cambió.** La cota se aplica a **cualquier fijo que ancle el punto de partida, venga por la puerta que venga**. Lo que estaba escrito antes de medir —cota solo sobre el respaldo— era el defecto de fondo con otra cara: **dos raseros para la misma ancla, con el estricto puesto en la puerta rara**. Una cota de 90 s aplicada solo a `getLastKnownPositionAsync` habría sido más estricta que un camino principal que se traga diez minutos en silencio, y habría dejado el agujero justo donde nadie mira. En el código eso significa **una constante y una función de decisión**, no dos comparaciones parecidas en dos ficheros.

**Segundo, el número.** La cota es **90 s**, y su porqué hay que escribirlo entero porque el número **no** sale de la aritmética del peor caso. Esa aritmética está medida y dice lo contrario: con el punto de partida desplazado D metros del sitio real, el regreso se detecta con D ≤ 50 m y **con D = 51 m no se detecta nunca**, ni con media hora parada en casa — el corte es exactamente `RADIO_DE_REGRESO_M` (`packages/nucleo/partida/regreso.js:35`), sin holgura. Traducido a antigüedad, y suponiendo lo peor —haber andado en línea recta alejándose durante toda la vida del fijo—, el techo es **35,7 s** a paso de paseo (1,4 m/s) y **27,8 s** a paso vivo (1,8 m/s). Con 90 s el peor caso da 126 y 162 m: fuera del radio.

Lo que hace admisible la cota es que **el peor caso no es el caso**. Un fijo viejo solo llega a anclar al abrir una salida, y quien abre una salida está parada en su portal: el fijo viejo es de estar allí. La cota se calibra contra ese caso —el portal con mal cielo, donde el proveedor tarda o no responde— y **el residuo lo paga el re-anclaje**, que corrige el ancla con el primer fijo bueno antes de haber andado nada. Sin re-anclaje, 90 s no se sostendría y habría que bajar a 25. Con él, la cota puede ser generosa porque el error que introduce tiene quien lo repare. Las dos piezas son una sola decisión y no se pueden coger a medias.

Y hay una segunda razón para no anclar con cualquier fijo viejo: `seAlejo` **también se desplaza**. Con el punto de partida a D metros del real, la condición de alejamiento se adelanta o retrasa hasta D metros según el rumbo, y eso abre una **ventana muerta de D metros de ancho** en la que la salida no puede cerrarse por regreso porque nunca llega a declararse alejada. Medido con los cuatro tramos del catálogo (`alejamientoM` = 250 / 350 / 600 / 1000). Un ancla mala no solo estropea el regreso: puede impedir que exista.

**La precisión exigida es el radio del regreso**, 50 m, y se lee de la constante del núcleo en lugar de copiarse: un fijo cuya incertidumbre declarada es mayor que el radio dentro del cual se cuenta que se ha vuelto no puede anclar ese radio. `getLastKnownPositionAsync({ maxAge, requiredAccuracy })` devuelve `null` en los dos casos (`node_modules/expo-location/build/Location.types.d.ts:125-136`), así que **por esa puerta la app no necesita reloj propio**: la frescura la decide el módulo nativo con los dos parámetros escritos. Por la otra puerta hace falta mirar: `getCurrentPositionAsync` **no acepta edad máxima**, devuelve lo que devuelve y está medido que devuelve caché de hasta 643,3 s sin decirlo, así que la cota se aplica **sobre la marca del fijo que trae**, restándola de la marca del fijo mismo. No es un reloj de pared: es la misma resta de dos marcas del sensor que ya usa el re-anclaje.

**Y por qué el emulador no puede calibrar este número, que hay que decirlo aquí y no en la bitácora.** En `wa-pixel` la cota **no decide nunca nada**: su GPS es bajo demanda —cuando alguien pide, entrega con edad 0,6 s— y su último conocido es de 25 h, así que todo fijo cae o muy dentro o absurdamente fuera, y el intervalo donde 90 s se distingue de 25 s **no se puede visitar**. Los 90 s se entregan por el razonamiento de arriba y quedan declarados como **calibración pendiente, no constante medida**. Lo que la afinaría, escrito para que la próxima fila pueda hacerlo sin volver a pensarlo: **en un teléfono real, en un portal con mal cielo, abrir salidas sucesivas anotando la antigüedad del fijo con el que se ancla y el desplazamiento que corrige el re-anclaje**; si la distribución de antigüedades queda muy por debajo de 90 s, la cota baja con esa distribución delante; si el re-anclaje corrige de forma sistemática más de unos pocos metros, el problema no es la cota sino el respaldo, y se dice.

### El coste del one-shot con precisión alta, y el tope que lo acota

Arreglar la raíz **compra latencia**: la equilibrada no encendía el GPS y por eso fallaba, y la alta lo enciende y por eso tarda. Ese coste **no está medido todavía** y hay que decirlo así en vez de suponerlo: lo medido es cuánto tarda el camino roto (30-32 s hasta un no) y que la suscripción registra su petición a los 2 s de abrirse la salida, que es el instante en que la petición **entra**, no en el que el fijo **llega**.

**El tope de espera se entrega en 10 s**, y su porqué es el criterio textual del dueño: *mejor 10 s honestos de «buscando dónde estás» que 30 de espera para un no*. Ese número gobierna la puntual y, con ella, la apertura entera, porque la segunda puerta es una lectura de caché que responde al momento. Consecuencias que hay que ver antes de implementar:

- **El tope no puede quedar mudo.** Diez segundos sin nada en pantalla se leen como una app colgada, que es la queja de hoy con otro número. De ahí sale el estado de espera de A2P1 / A2P5, y por eso las tres piezas se entregan juntas.
- **El tope no es un fallo, es un paso.** Al agotarse no se enseña error: se prueba la última conocida, y solo si tampoco sirve aparece el motivo honesto.
- **En un teléfono real, un GPS del todo frío puede tardar más de 10 s** cuando no hay asistencia. Eso **no** es argumento para subir el tope: es exactamente el caso para el que existe el respaldo, y subir el tope cambiaría una apertura rápida con ancla imperfecta —que el re-anclaje repara— por una espera larga. Si la medida dice que con el fused caliente la puntual entrega en uno o dos segundos, el tope puede bajar, y se baja con el número delante.
- **Lo que hay que medir y escribir**: cuánto tarda la puntual con precisión alta desde aparato limpio y sin calentar, cuánto desde el estado normal, y cuánto tarda la apertura completa en los dos desenlaces. Sale con número o no sale.

### El re-anclaje: una vez, con plazo, y con la aritmética que sí ata

El plazo de re-anclaje es **25 s**, y aquí sí manda el peor caso: 25 s × 1,4 m/s = 35 m y × 1,8 m/s = 45 m, los dos por debajo de los 50 m del radio. Es la traducción con número de la condición que dio el dueño —«desplazamiento acumulado desde la apertura ≤ 50 m»— a una forma que **no necesita acumular nada**: acumular desplazamiento sumando fijos consecutivos suma también el ruido del GPS, que con alguien parado crece sin parar y cerraría la ventana sola. El plazo se mide restando la marca del fijo nuevo de la marca del punto de partida, **dos marcas del sensor**, sin reloj y sin `Date.now`.

Las tres condiciones, juntas y todas necesarias: precisión declarada del fijo ≤ el radio del regreso · marca dentro del plazo · `seAlejo === false`. Y ocurre **como mucho una vez**, con una marca en el estado que lo dice. Si al implementar se mide una condición mejor —por ejemplo, que el primer fijo bueno llega siempre en menos de 10 s con la cadencia por tiempo puesta—, **se trae con el número** y se cambia el plazo, no se cambia la forma.

Las dos decisiones se sostienen la una a la otra y conviene verlo, ahora con la medida delante: con el punto de partida en el índice de la cadencia, al abrir la salida el muestreo ya es por tiempo, cada cinco segundos, así que dentro de la ventana de 25 s caben unos cinco fijos. Sin la decisión 2, el re-anclaje **no llegaría a ocurrir nunca** — no «podría»: está medido que parada con cadencia por distancia llegan **cero fijos en 5 min 56 s** —, que es el mismo agujero por el que el regreso no se cierra.

### Lo que se anota, y por qué no es un rastro

Cuatro campos en `AREA_SALIDAS` (`packages/nucleo/partida/estado.js:323-334`), y ninguno es una coordenada ni una marca de reloj:

| Campo | Qué es | Por qué no es rastro |
| --- | --- | --- |
| `origenDelPunto` | `puntual` \| `ultima-conocida` | vocabulario cerrado de dos palabras |
| `reanclada` | booleano | no dice dónde ni cuándo |
| `desplazamientoDelAnclaM` | entero, metros | una distancia relativa entre dos puntos que no se guardan |
| `antiguedadAlReanclarMs` | entero, milisegundos | una **duración**, resta de dos marcas del sensor; no fija ningún instante |

Es el mismo registro con el que SPEC-048 declaró que un punto no es una traza (`SPEC-048:313`): la promesa que protege RF-PRIV-002 es que no hay histórico ni lista que crezca con lo andado, y lo que aquí se añade son **cuatro escalares que mueren con la salida**. El punto de partida anterior **se sustituye y no se apila**: guardar los dos extremos del re-anclaje habría sido cómodo para auditar y habría metido una segunda coordenada en la partida, que es exactamente lo que no se hace. Con estos cuatro campos, un regreso raro se audita con `run-as` —de qué origen salió el ancla, si se movió, cuánto y con qué desfase— sin que la partida sepa por dónde anduviste.

### La cadencia, y la separación que hay que mantener a la fuerza

`sitiosConPosicion` (`packages/nucleo/partida/llegadas.js:305-317`) alimenta hoy **dos cosas a la vez**: la decisión de cadencia y el índice contra el que se comprueban las llegadas. Meter el punto de partida ahí es una línea y convierte el portal de casa en un sitio jugable, con su geofence de llegada, su escena y su ficha. Por eso entra **por la firma**: `cadenciaDeMuestreo` recibe el punto de partida como parámetro propio, con el radio del regreso (`RADIO_DE_REGRESO_M`, no el de geofence) y la misma histéresis de `MARGEN_DE_CERCANIA_M`, y devuelve `sitio: null` con la razón declarada cuando la cadencia rápida la decide el punto de partida y no un sitio. `sitiosConPosicion` no se toca, y hay criterio que lo afirma.

El radio elegido es el del regreso y no el de geofence porque lo que se está comprando es que **la permanencia del regreso pueda acumular**: los 60 s de `DENTRO_DEL_REGRESO_MS` (`regreso.js:52`) se cuentan sobre posiciones que llegan, dentro de un radio de 50 m. Un radio de 40 m dejaría un anillo de 10 m dentro del cual se cuenta el regreso y no llegan fijos, que es el agujero de hoy en pequeño.

**Los números heredados, verificados de cero.** Los 8 mundos son 4 congelados × 2 semillas (`test/nucleo/mundo-de-prueba.mjs:20` y `:23`), y `(0,0)` es el punto de partida porque `buildWorld` proyecta con origen en la coordenada del mundo (`packages/nucleo/world/build.js:116` y `:238`). Medido: `por-distancia` en 6 de 8, con el geofence más cercano entre 19,0 y 191,4 m del borde, y `por-tiempo` en 2 de 8 **por accidente de trazado** —un sitio pisa el anclaje: −8,0 m en suelo-250m semilla 2 y −21,0 m en urbano-denso semilla 2—. Coincide número a número con la medida heredada. Y una precisión que hay que tener presente al escribir las pruebas: el `distanciaM` que devuelve `cadenciaDeMuestreo` es **al centro** del geofence (`llegadas.js:196`), y el criterio de dentro es `distanciaM <= radioM (+margen)` (`:290`).

### La premisa de plataforma, ya medida: la decisión 2 pasa de leída a dato

Lo que hasta el 13-ago-2026 era una afirmación **leída y no medida** —que con la cadencia por distancia a diez metros alguien parado no recibe fijos (`packages/nucleo/partida/llegadas.js:218-222`)— está **medido en `wa-pixel`**, y confirma la premisa quedándose corta:

- **Parada, cadencia `por-distancia`: cero fijos en 5 min 56 s.** Nueve muestras con `ultimaMarcaMs` congelada **en el mismo milisegundo**. El primer fijo llegó a los **355,8 s**, y solo al mover la posición. El comentario del módulo dice «un fijo en trescientos segundos»; lo medido es **ninguno en trescientos cincuenta y seis**.
- **Contraprueba, que es la que lo cierra: parada dentro de un geofence con cadencia `por-tiempo`.** La marca avanza en **cada muestra** (+25 a +35 s) y `ultimoPropioMs` **no se mueve ni un milisegundo**: llegan posiciones y ninguna cuenta como metro propio. El mecanismo de SPEC-044 hace exactamente lo que dice, medido en las dos direcciones, y de paso validó la permanencia y saltó la escena sola.

Consecuencia para lo que está escrito: la decisión 2 es **condición necesaria** para que el regreso pueda cerrarse, y donde una spec dijera «leída y no medida» ahora va el número. Y una precisión de honestidad que conviene dejar puesta: el comentario de `llegadas.js:218-222` **acierta en el fondo y se queda corto en el número**; al tocarlo se actualiza con la medida nueva, no se borra la vieja.

### Precondición de cualquier medición de posición en este emulador

**`adb emu geo fix` no inyecta nada si nadie pide posición.** Medido el 13-ago-2026: con el bucle corriendo **cada 2 s durante 4 minutos**, `dumpsys location` seguía enseñando el fijo persistido del arranque del emulador y el Event Log **no tenía un solo evento desde el boot**. En cuanto otra app pidió posición, apareció el fijo del bucle con **edad 0,6 s**. El GPS del emulador es **bajo demanda**.

Esto **contradice `CLAUDE.md` §13b**, que afirma que «`dumpsys location` enseña fijo fresco en `gps` y `fused`» mientras el bucle alimenta. La corrección del documento no es de esta spec —la hace la sesión principal con autorización del dueño—, pero la precondición sí es de aquí, porque cambia cómo se leen los flujos `@app` de esta fila:

- **Un `dumpsys location` con fijo viejo no prueba que el bucle no esté alimentando.** Prueba que nadie ha pedido posición. Para comprobar el bucle hay que **pedir posición** y volver a mirar.
- **Toda medida de apertura tiene que declarar si el bucle estaba corriendo**, y no darlo por hecho a partir de lo que `dumpsys` enseñaba antes de abrir.
- **El rojo histórico de `en-marcha.yaml` y `telon.yaml` se leyó con esta premisa falsa encima**, y de ahí salió el diagnóstico de «proveedor frío». Cualquier tanda cuyos números se comparen con los de agosto arrastra ese vicio si no declara la precondición.

### Las vías de despertar: qué se mide, qué se cierra y cómo vuelve

Las tres piezas de FCM, leídas sobre bytecode con `javap` y sobre el manifiesto fusionado ya generado:

| Pieza | Tipo | Cómo se descubre | Evidencia |
| --- | --- | --- | --- |
| `com.google.firebase.iid.FirebaseInstanceIdReceiver` | receiver, `exported="true"`, permiso `c2dm.permission.SEND`, filtro `c2dm.intent.RECEIVE` | por acción | **indirecta**: tres barridos negativos del lado app; el emisor vive en Play Services y **no se ha leído** |
| `com.google.firebase.messaging.FirebaseMessagingService` | service, filtro `MESSAGING_EVENT` prioridad −500 | por acción | **directa**: `ServiceStarter.resolveServiceClassName` → `PackageManager.resolveService` sobre `MESSAGING_EVENT`, y solo entonces `setClassName` |
| `expo.modules.notifications.service.ExpoFirebaseMessagingService` | service, mismo filtro, prioridad −1 | por acción | **directa**, la misma; lo aporta `node_modules/expo-notifications/android/src/main/AndroidManifest.xml:6-12` |

Dos consecuencias que son criterio. **Una**: como las tres se descubren por acción, la neutralización tiene que quitar la vía entera y no dejar el bloque sin nombre — y como quitar el bloque cierra tanto el descubrimiento por acción como el por clase, **la evidencia indirecta del primero deja de importar para la forma elegida**. Queda etiquetada igual, porque la etiqueta es del hallazgo y no de la conveniencia. **Dos**: se cierra **la pareja**, porque neutralizar solo el de Expo deja al de Firebase resolviendo en su lugar por el mismo filtro y con la misma prioridad relativa.

**Por qué hoy se puede cerrar sin romper nada, y en qué se diferencia de la 52.** En la fila 52 la acción estaba **en uso** (`NOTIFICATION_EVENT`, entrega viva), y por eso quitar el filtro habría roto las notificaciones en silencio. Aquí **la acción no la usa nadie**: sin `google-services.json`, sin `googleServicesFile` en `app.json` y sin una sola llamada a `getExpoPushTokenAsync` ni `getDevicePushTokenAsync` —confirmado en tres direcciones—, los tres bloques son código muerto instalado. **Cómo vuelven**: el día que el producto adopte push, las tres se declaran otra vez —con el fichero de servicios, el token pedido explícitamente y la vía nombrada en la lista con su motivo— y eso es una decisión de producto con su fila, no un ajuste de configuración nativa. La cabecera del plugin lo dice con esas palabras, para que quien lo lea dentro de un año no crea que las quitó un descuido.

**El agujero de la guarda es más ancho que lo fichado**, y hay que decirlo con precisión: `receptoresQueDespiertan` (`test/nucleo/manifiesto-generado.test.mjs:249-256`) solo recorta bloques `<receiver …>` vía `receptoresDelManifiesto` (`:211-247`), así que **los servicios no entran en el barrido por construcción** —no por lista de tolerados—, y `ACCIONES_QUE_DESPIERTAN` (`:164-171`) son seis acciones de arranque entre las que no está la de c2dm. Por eso la guarda nueva no es «añadir una acción a la lista»: es enumerar receptores **y servicios** y contrastarlos contra la lista cerrada declarada en producción.

**Los adyacentes que la lista tendrá que nombrar o poner rojos**, con el mecanismo **no medido** y dicho así: `androidx.health.platform.client.impl.sdkservice.HealthDataSdkService` (`exported="true"`, filtro `ACTION_BIND_SDK_SERVICE`), `androidx.profileinstaller.ProfileInstallReceiver` (`exported="true"`, permiso `DUMP`), y el trío de `com.google.android.datatransport`, que incluye `AlarmManagerSchedulerBroadcastReceiver` y `JobInfoSchedulerService` sobre `BIND_JOB_SERVICE`. Nombrarlos **no es aprobarlos**: cada entrada dice si su mecanismo se midió, y el número de las declaradas sin medir se dice con el número delante. Una lista cerrada cuyos motivos no se pueden distinguir de excusas es una lista de tolerados con otro nombre.

**Dónde vive la anchura de más.** La propiedad ancha está escrita en `app/plataforma/permisos.js:128-136` («nada de esta app se despierta **con la app cerrada**») y su campo `aCambio` (`:143`) cierra en la estrecha («nada se despierta al arrancar el móvil»). Esta fila hace que el `aCambio` pueda cerrar en la ancha, que es lo que la promesa dice desde el principio.

### A6P7, y por qué el `back` no es el culpable

La medida que decide: experimento **sin pulsar atrás jamás** — 25 s con la hoja de compartir en pantalla y `files/partida/partida/` **ya vacío**. `Share.share` en Android resuelve en cuanto lanza el chooser (`app/plataforma/copia-del-sistema.js:22-31` compara con `Share.dismissedAction`, que es de iOS), así que `compartida` nunca vale `false` y la guarda de `guardaCopiaYBorra` (`app/datos/empezar-de-nuevo.js:227-236`) no se dispara nunca: **la partida se borra mientras quien juega elige destino**. El `back` es un espectador — lo consume `ChooserActivityLauncher`, cierra esa actividad y la app vuelve viva, mismo pid, misma tarea —, así que **no es el mismo pendiente que el botón atrás**, y eso queda medido y separado.

El AC que ya lo promete es de la propia SPEC-040, línea 61: «cancela la hoja del sistema sin guardar → el borrado **no** ocurre y la partida sigue entera». No se ablanda: **se hace verdad**, y por el único camino que no depende de una señal que Android no da. Por eso el rojo de `empezar-de-nuevo-copia.yaml` se apaga **afirmando lo nuevo** —guardar, cancelar, y encontrar la partida entera— y no suavizando lo viejo.

**El residuo, medido**: la copia se queda en `cache/copias/terras-de-eldoria.partida` (1,78 MB) aunque la partida ya se haya borrado. No sale del móvil y el sistema puede llevársela cuando quiera, pero es un fichero de partida que sobrevive a «empezar de nuevo», y eso choca con el AC de SPEC-040 «no queda nada de la partida anterior bajo ningún prefijo». Se limpia **dentro del borrado**, y solo la copia de trabajo de la caché: los ficheros que quien juega guardó fuera con la hoja del sistema **no se tocan**, que es lo que convierte guardar una copia en una salida real y no en una trampa.

### Cómo se regeneran los artefactos, y las trampas del aparato que esta fila pisa seguro

Esta fila toca un config plugin y mide sobre el manifiesto fusionado, así que en el árbol principal **el prebuild no corre solo**:

```bash
cd app && npx expo prebuild --platform android --no-install --skip-dependency-update expo
cd app && JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk npx expo run:android
cd app && npx expo prebuild --platform ios --no-install --skip-dependency-update expo
```

Sin el prebuild, `processDebugMainManifest` sale `UP-TO-DATE` y **la guarda mide el manifiesto de la tanda anterior** con `mirado: true` puesto. Y `test/reports/manifiesto-generado.estado.json` tiene que decir `mirado: true` en las dos plataformas y `completo: true`, o los números no son comparables con ninguno que sí — un total de núcleo que baja no es una tanda mejor. Dos efectos más que hay que contar: `expo run:android` **instala y abre la app**, así que toma el aparato y obliga a `adb shell pm clear com.walkingadventure.app` antes de cualquier tanda de `@app` cuyos números se comparen.

### Los escenarios de `docs/testing.md`, como encargo para `wa-qa-dev`

Lo que ya existe y se reutiliza **citándolo por su nombre literal**: «La copia se ofrece pero no se hace sola» y «Borrar lleva al arranque» (`@app @persistencia`), «Volver a casa en autobús echa el telón igual» (`@app @accesibilidad`), «La salida sigue viva con el móvil bloqueado» y «El rótulo se retira pero la salida no se cierra» (`@app @bucle`), «El rastro de ubicación no se guarda nunca» (`@red @privacidad`) y «La app no pide el permiso de ubicación permanente» (`@app @bucle`).

Lo que **no tiene escenario** y esta fila necesita: la puntual pedida con precisión alta y su precisión compartida con la de la suscripción; la cota única aplicada a las dos puertas, con el fijo puntual rancio descartado igual que la última conocida vieja; la apertura que se respalda en la última conocida y la que no puede porque el único fijo es de 25 h; el tope de espera y la línea de «buscando dónde estás» que aparece al instante y desaparece siempre; el re-anclaje y su inmutabilidad tras alejarse; la cadencia en el punto de partida; que el punto de partida no produce llegada; la lista cerrada de vías de despertar; y los dos gestos de A6P7.

Y una **precondición que los flujos `@app` de posición tienen que llevar escrita**, porque sin ella se vuelven a leer mal: el bucle de `adb emu geo fix` **no inyecta nada si nadie pide posición**, así que declarar «el bucle estaba corriendo» exige haberlo comprobado pidiendo posición y no mirando `dumpsys location` a secas. Es la misma familia que el `pm clear`: la precondición se declara junto a los números o los números no dicen nada. Los escenarios nuevos se escriben en `docs/testing.md` citando la decisión de `game-design/` de la que salen, como el resto — **esta spec no los escribe**, que es de su fase.

## Documentos que esta fila tiene que tocar

Esta spec **no los edita**: los nombra y dice qué hay que escribir en cada uno.

| Documento | Qué hay que escribir |
| --- | --- |
| `game-design/bucle-jugable.md` §8 | una línea fechada (13-ago-2026): el punto de partida cuenta como sitio **solo para la cadencia del sensor**, porque estando quieta con cadencia por distancia llegan **cero fijos en 5 min 56 s** —medido— y sin fijos la permanencia del regreso no acumula y el telón no cae; y que eso **no** lo convierte en sitio al que se llega. Y, en §8 o §9, la apertura con su porqué: **una sola cota de frescura** para cualquier fijo que ancle el punto de partida, el tope de espera y qué se enseña mientras se busca. El telón lo echa volver, así que sin punto de partida no hay bucle |
| `CLAUDE.md` §13b | **no lo toca esta fila ni la implementación**: la premisa de que el bucle de `adb emu geo fix` deja fijo fresco en `dumpsys location` está **medida como falsa** (4 min de bucle, cero eventos desde el boot; fijo del bucle con edad 0,6 s solo cuando otra app pidió posición). Se lleva al dueño con la medida y lo corrige la sesión principal. Mientras tanto, la precondición vive en esta spec |
| `docs/pendientes.md` | **cerrar** la entrada del 12-ago-2026 sobre qué hace abrir una salida sin fijo puntual y con última conocida fresca, con su línea de resultado (cota, precisión exigida y re-anclaje). **Mantener** la del botón atrás del 10-ago-2026, con la raíz medida añadida (`app/App.js:234-250`) y la constatación de que **no** es el mismo pendiente que el rojo de la copia. **Añadir**, si la fila la confirma, el hallazgo del telón que salta al pasar por delante de casa |
| `docs/testing.md` | los escenarios nuevos de la sección anterior, con su fuente de `game-design/` citada, y las etiquetas `@app`/`@nucleo`/`@privacidad` que correspondan |
| `docs/flujo.md` | la arista `A6P7 → A1P1` deja de estar etiquetada «Guardar una copia primero, o Borrar sin guardar nada»: al arranque se llega **solo** por borrar. Y aparece el bucle de guardar, que vuelve a A6P7. `node scripts/verifica-flujo.mjs` tiene que seguir en verde |
| `docs/pantallas.md` y los artefactos 6 y 2 | el artefacto 6 (`docs/pantallas/pantallas-6-de-consulta.html`) con las dos acciones desacopladas y la línea de copia hecha; y el artefacto 2, con el estado de espera de A2P1 / A2P5. En `docs/pantallas.md` se anota qué cerró cada revisión. **Tocar la pantalla obliga a tocar el diseño en el mismo commit** |
| `docs/starting.md` | la entrada de la fila con fecha, las decisiones, los números medidos (la raíz de la precisión equilibrada con sus 30-32 s y su Event Log vacío, los tres fijos rancios de la puntual, el fijo de 25 h, cero fijos en 5 min 56 s parada, la contraprueba de `por-tiempo`, el tope de espera y la latencia de la puntual con precisión alta, 8 de 8 en la cadencia, vías declaradas y cuántas sin medir) y **la lección de la causa escrita veinte líneas por encima del defecto**, que es el hallazgo con más recorrido de la fila |

## Lo que esta fila NO hace

- **El botón atrás del sistema en Android.** Raíz medida: `app/App.js:234-250`, la `BackHandler` **solo se suscribe con `consulta !== null`**, y está confirmado que se lleva la app entera en A1P1, A2P1 y A2P3, y que funciona donde hay vuelta declarada. Es una **decisión de diseño sin tomar** —qué debe hacer el botón donde el flujo no declara vuelta— y **no se decide aquí**: se declara con su raíz y se lleva al dueño. Queda además medido y separado del rojo de la copia: no son el mismo pendiente.
- **El telón que salta al pasar por delante de casa.** Cruzar los 100 m de diámetro del radio de regreso dura **71 s** a 1,4 m/s contra los **60 s** de permanencia exigida, así que un lazo que pase por delante de casa puede cerrar la salida — y `packages/nucleo/partida/regreso.js:39` promete justo lo contrario («el minuto es lo que distingue "he llegado" de "he pasado por delante"»). **Fichado, ajeno, no se toca**: es de SPEC-030, cambiarlo cambia cuándo se cierra una salida, y esta fila no altera ni el radio ni el reloj.
- **El lector de recursos del visor**, que sigue sin dueño.
- **`VERSION_FORMATO` global**, que es una decisión de esquema aparte y no se resuelve de paso.
- **La sospecha del `typeof`**, con su grep pendiente: no es de esta fila salvo que se la tropiece, y si se la tropieza se ficha con la medida.
- **Lo que se mide sin entregar código, salvo que la medida lo pida**: la cara de un beat en A4P3 con el dedo, y las cotas reales del nodo del visor con su `...StyleSheet.absoluteFillObject` (`app/pantallas/visor.js`, fichado desde la fila 50 y **sin medir**). Si la medida pide arreglo, entra como iteración de **su spec dueña** con las cotas escritas, no como añadido de esta.
- **La caída del servicio en primer plano**: se conduce con `adb logcat` armado antes de abrir cada salida y se declara lo observado —o cuántas salidas se condujeron limpias—, pero esta spec no promete arreglarla.

## Decisiones asumidas

- **Los criterios van en Gherkin español** (`Dado / cuando / entonces`) → asumido, como SPEC-040 y SPEC-044 (alternativa: `GIVEN / WHEN / THEN`, como SPEC-052). Regla: `CLAUDE.md` y el grep que cruza specs y batería; el nombre del caso es el del escenario de `docs/testing.md`, que está en español.
- **Sin `### Comportamiento responsive`** → asumido por la decisión 3 de `pipeline/decisiones-orquestador.md`: esto es una app de móvil y la pantalla es la que es.
- **La puntual pasa a pedirse con precisión alta, y la precisión sale del mismo sitio que la de la suscripción** → asumido (alternativas: dejar la equilibrada y confiarlo todo a la cota y al respaldo; o subir a alta escribiendo el valor otra vez al lado). Regla: es **la raíz medida** —con la equilibrada el sistema no enciende el GPS, Event Log vacío durante 30-32 s— y la causa llevaba dos días escrita veinte líneas por encima del defecto sin que nadie la cruzara; una defensa que dependa de que alguien lea el comentario correcto ya ha fallado una vez, así que la defensa es de forma: **un solo sitio del que sale la precisión**.
- **La cota de frescura es una sola y se aplica a las dos puertas** → asumido, y **deroga lo que esta misma spec decía antes de medir** (alternativa: cota solo sobre la última conocida, que era lo escrito). Regla: lo que ancla el punto de partida es un fijo, no una puerta; el rasero estricto puesto solo en la puerta rara habría dejado el camino principal tragándose caché de **643,3 s** en silencio. Si aparece razón **medida** para dos números, se trae con la medida; **la asimetría por defecto queda prohibida**.
- **El número de la cota sigue siendo 90 s, declarado como calibración pendiente** → asumido (alternativas: 25-30 s, que es lo que aguanta la aritmética del peor caso; 120 s, que el encargo también admitía). Regla: la cota se calibra contra el caso real —el portal con mal cielo al abrir la salida— y el residuo lo paga el re-anclaje; con el peor caso puro habría que bajar a 25 s y se perderían justo las aperturas que esta fila viene a arreglar. **Lo nuevo es lo que hay que decir con el número**: en el emulador la cota no decide nunca nada —GPS bajo demanda, último conocido de 25 h—, así que **90 s no es constante medida**; la medida que la afinaría es en un teléfono real, en un portal con mal cielo, anotando la antigüedad del fijo con el que se ancla y el desplazamiento que corrige el re-anclaje.
- **El tope de espera de la puntual es 10 s** → asumido (alternativas: sin tope, que es lo de hoy y da 30-32 s hasta un no; 5 s, que se comería aperturas legítimas con el GPS encendiéndose; 20 s, que vuelve a la espera larga). Regla: el criterio del dueño, *mejor 10 s honestos de «buscando dónde estás» que 30 de espera para un no*. **El coste real del one-shot con precisión alta no está medido**, así que el número se entrega para confirmarse o cambiarse con esa medida delante, y se dice que está sin medir en vez de presentarlo como calibrado.
- **El estado de espera vive en A2P1 / A2P5 y no lleva ninguna cifra** → asumido (alternativas: no enseñar nada, que deja diez segundos de app muda; o enseñar cuenta atrás o barra). Regla: `lenguaje.md` y la forma que ya usa A6P7 al empaquetar; una cuenta atrás convierte el tope en una promesa que el sistema no garantiza, y este proyecto ya pagó por creerse una señal que Android no da. **Las tres piezas —precisión alta, tope y línea de espera— se entregan juntas**: la primera sola cambia una espera muda de treinta segundos por otra de diez.
- **La premisa falsa de `CLAUDE.md` §13b se declara aquí y no se corrige aquí** → asumido (alternativa: editar el documento). Regla: `.claude/rules/naming.md` — `docs/specs/*.md` es lo único que esta fase escribe, y `CLAUDE.md` es del dueño; lo que sí es de esta spec es la **precondición de medición**, porque sin ella los flujos `@app` de la fila se vuelven a leer mal, que es exactamente lo que pasó con el diagnóstico de «proveedor frío».
- **La precisión exigida al fijo es el radio del regreso** → asumido, leyendo `RADIO_DE_REGRESO_M` en lugar de escribir un número nuevo (alternativa: una constante propia, o no exigir precisión). Regla: dos números que significan lo mismo se desincronizan, y un fijo con más incertidumbre que el radio dentro del cual se cuenta el regreso no puede anclarlo.
- **El plazo de re-anclaje es 25 s y no un desplazamiento acumulado** → asumido (alternativa: la propuesta literal del dueño, «desplazamiento acumulado desde la apertura ≤ 50 m»). Regla: acumular desplazamiento suma también el ruido del GPS, que con alguien parado crece sin parar y cerraría la ventana sola; 25 s son 35 m a paso de paseo y 45 a paso vivo, los dos por debajo de los 50 m, así que el plazo **implica** la condición del dueño sin necesitar acumulador. Si al implementar se mide una condición mejor, se trae con el número.
- **El re-anclaje anota cuatro escalares y no las dos coordenadas** → asumido (alternativa: guardar el fijo viejo y el nuevo, que es lo cómodo de auditar). Regla: RF-PRIV-002 y `seguridad-privacidad.md` §2 — la partida guarda **una** coordenada, y dos puntos separados por metros y segundos son el principio de una traza. Con origen, booleano, distancia y duración se audita un regreso raro igual de bien.
- **La antigüedad se calcula restando dos marcas del sensor** → asumido (alternativa: inyectar un reloj `ahora()` como hacen `calendario.js` y `lector-de-salud.js`). Regla: el tiempo del sensor ya viaja dentro de cada posición y el determinismo de `packages/nucleo/` lo exige; un reloj más es una entrada más que desincronizar.
- **El punto de partida entra por la firma de `cadenciaDeMuestreo` y no al índice** → asumido (alternativa: meterlo en `sitiosConPosicion` con un tipo especial y filtrarlo en las llegadas). Regla: el índice alimenta a la vez la cadencia y las llegadas, y un filtro que hay que acordarse de poner es la forma de fallo que este repo ya ha pagado; la separación tiene que ser de forma.
- **El radio del punto de partida para la cadencia es el del regreso y no el de geofence** → asumido (alternativa: `RADIO_DE_GEOFENCE_M`, 40 m, por simetría). Regla: lo que se compra es que la permanencia del regreso acumule, y esa permanencia se cuenta dentro de 50 m; con 40 quedaría un anillo de 10 m donde se cuenta el regreso y no llegan fijos.
- **La lista cerrada de vías vive en `app/plataforma/permisos.js`** → asumido (alternativa: escribirla dentro de la guarda, en `test/`). Regla: es el patrón que el repo ya usa con `PERMISOS_QUE_UNA_LIBRERIA_EXIGE`, `MODOS_DE_FONDO` y las tareas declaradas — el dato en producción, el contraste en la guarda; una lista que vive solo dentro de su test no la lee nadie al añadir una dependencia.
- **Las tres piezas de FCM se cierran enteras y no se sustituyen conservando filtro** → asumido (alternativa: el molde de SPEC-052, reemplazar conservando la acción). Regla: allí la acción estaba en uso y aquí no la usa nadie —medido en tres direcciones—, y cerrar el bloque entero cubre a la vez el descubrimiento por acción y el por clase, que es lo que hace que la evidencia indirecta del receptor de c2dm no decida la forma.
- **Los adyacentes se nombran con su mecanismo etiquetado como no medido** → asumido (alternativa: medirlos todos dentro de esta fila, o dejarlos fuera de la lista). Regla: dejarlos fuera reabre el agujero que la fila viene a cerrar; medirlos todos estira la fila sin encargo. Nombrarlos con la etiqueta y **decir cuántos hay sin medir con el número delante** es lo que permite que la próxima fila los reduzca en vez de heredarlos disueltos.
- **La acción destructiva de A6P7 se renombra** → asumido (alternativa: conservar «Borrar sin guardar nada»). Regla: `lenguaje.md` — un texto no puede afirmar algo que puede ser falso, y «sin guardar nada» es falso justo después de guardar. El texto exacto lo escribe quien implementa siguiendo `lenguaje.md`, y se lee en voz alta antes de darlo por bueno.
- **Guardar deja la pantalla donde está, con las tres acciones** → asumido (alternativa: volver a los ajustes tras guardar, o encadenar un aviso). Regla: `partida-guardada.md` §4 exige que salir sin hacer nada siempre esté; y quien guardó puede querer borrar justo después, que es el caso que motiva la pantalla entera.
- **La copia de trabajo de la caché se limpia dentro del borrado** → asumido (alternativa: dejarla, porque el sistema puede llevársela). Regla: el AC de SPEC-040 dice que no queda nada de la partida anterior **bajo ningún prefijo**, y 1,78 MB de partida en la caché lo contradicen; los ficheros que quien juega guardó fuera siguen intactos, que es la línea que separa una limpieza de una trampa.
- **SPEC-052 no se itera** → asumido (alternativa: una iteración que ensanche su propiedad). Regla: ninguno de sus ACs se deroga ni se debilita —siguen afirmándose enteros— y lo que esta fila añade es comportamiento nuevo sobre lo que aquella spec declaró explícitamente fuera de alcance («las notificaciones push y la vía de Firebase»). Lo que sí se exige aquí es que su `aCambio` siga casando con la expresión literal `receptor de tareas se sustituye`.
- **La premisa de plataforma de la decisión 2 ya está medida y se cita con el número, no como lectura** → **medido el 13-ago-2026 y ya no asumido**: cero fijos en 5 min 56 s parada con `por-distancia`, primer fijo a los 355,8 s y solo al mover; contraprueba con `por-tiempo`, marca que avanza en cada muestra y `ultimoPropioMs` inmóvil. La premisa **se confirma quedándose corta** —el comentario decía «un fijo en trescientos segundos» y lo medido es ninguno en trescientos cincuenta y seis—, así que la decisión 2 es condición necesaria del regreso. Regla que se mantiene viva para lo que **sigue** sin medir —la latencia de la puntual con precisión alta y la calibración de la cota—: diez encargos, diez premisas falsas encontradas; una premisa leída y citada como medida es la forma de fallo de este repo.
