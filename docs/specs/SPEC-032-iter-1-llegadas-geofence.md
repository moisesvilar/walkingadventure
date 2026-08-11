# SPEC-032-iter-1 — Los veinte segundos se conservan, y lo que cambia es cómo se mide «parada dentro»

## Descripción

Iteración de **cambio de comportamiento** sobre la implementación de SPEC-032. La desencadena la medida de `pipeline/decisiones-orquestador.md` §9, hecha en la fila 44 al montar por primera vez la capa de llegadas contra el sensor real, y autorizada por el dueño con la tabla delante (§9b). No la desencadena ningún fallo de la suite: los mil casos de esta spec estaban en verde, y ese es justo el problema que la iteración cierra —estaban escritos sobre secuencias de posiciones fabricadas, y en un teléfono la capa no se disparaba nunca.

**La permanencia de veinte segundos se conserva, y eso es lo importante de esta iteración.** Su razón sigue siendo buena palabra por palabra: *validar es barato, y un beat que se atiende de paso valida igual*. Alargarla para todo el mundo habría sido el arreglo cómodo y habría contradicho sin necesidad la decisión de la base, que es la que hace que pararse en un semáforo dentro de un geofence sea un regalo y no una anomalía (`bucle-jugable.md` §9).

Lo que cambia es **cómo se mide «parada dentro»**. La base daba por resuelta esa mitad —la traza clasificada de la fila 31 decía si un enlace era una parada, y con eso bastaba— y no lo estaba: medir de fijo a fijo, un ruido de σ metros con fijos a T segundos aparenta ~1,4·σ/T m/s, así que con σ = 10 m un parado de verdad no parece parado hasta que pasan veintiocho segundos entre fijos. Medido con alguien **quieto 300 s dentro de un geofence**: validaba el **13 %** de las veces muestreando por tiempo y el **0 %** con la cadencia por distancia que hay en producción (§9a). A partir de aquí «parada dentro» se mide por **deriva de ventana** —el centroide de la primera mitad de una ventana contra el de la segunda—, porque el ruido del GPS es de media cero y la deriva de quien anda no, y promediar hunde el ruido como 1/√n dejando la deriva intacta.

Y la regla es **adaptativa porque la medida lo pide y no por elegancia**: con el fijo bueno la ventana corta ya separa, así que los veinte segundos se conservan donde el error declarado del fijo los sostiene y solo se estiran a cuarenta cuando deja de sostenerlos. Los dos pares ventana/deriva, el umbral de precisión que elige entre ellos y el límite de error declarado salen de la tabla de §9c y **no se reinventan aquí**.

Lo que **no** cambia: el radio de cuarenta metros —la medida de §9 dice que el problema no estaba ahí—, la validación desde espacio público, que validar no es un gesto, que una llegada no emite ningún aviso, la secuencia de una llegada entera con sus cuatro tipos de paso y su orden, A4P5 y su composición, el reparto de dos geofences solapados, y que la escena queda esperando días con la app cerrada. Esta iteración no toca ni una línea de `secuencia.js` ni de `lo-que-se-cuenta.js`.

## Alcance de implementación

- Esta iteración es **una corrección de cómo se mide la permanencia**: cambia la regla con la que se decide que alguien está parado dentro de un geofence y conserva el resto de la validación tal cual.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- **Sí hay cambio de la frontera de inyección, y es de SPEC-044**: la precisión declarada del fijo, que ya viajaba desde la fuente de posiciones y se perdía antes de llegar aquí, alcanza ahora la ventana de parada. **No se guarda en ninguna parte**: se usa en vuelo para elegir la ventana y se tira. La cadencia de la suscripción, que es la otra mitad del arreglo, también es de SPEC-044 y aquí solo se consume. **Ninguna dependencia nueva.**
- **Fuera de alcance** — los dos pares ventana/deriva, el umbral de precisión, la cadencia por tiempo y su histéresis, y el cableado de la máquina de una salida en la app: todo eso es SPEC-044 y aquí se cita. **Fuera de alcance** también el radio del geofence, que no se toca, y el reloj de permanencia del regreso de SPEC-030, que sigue siendo otro reloj con la asimetría contraria.

## Criterio de aceptación modificado

### ACs nuevos

- **Dado** una jugadora parada dentro de un geofence, **cuando** se decide si está parada, **entonces** se compara el centroide de la primera mitad de una ventana de posiciones con el de la segunda, y no dos fijos consecutivos.
- **Dado** un fijo cuya precisión declarada sostiene la ventana corta, **cuando** se mide la parada, **entonces** la ventana es de veinte segundos y la deriva admitida son cinco metros; y **cuando** no la sostiene, **entonces** la ventana es de cuarenta segundos y la deriva admitida son ocho metros.
- **Dado** una posición que llega sin precisión declarada, **cuando** se mide la parada, **entonces** se usa la ventana larga: en la duda sobre el error del fijo se exige más, no menos. Es la única duda de esta spec que se resuelve exigiendo, y es deliberado —la que se resuelve validando es la duda sobre el **medio**, no sobre el **dato**.
- **Dado** la permanencia, **cuando** se comprueba qué mide, **entonces** son veinte segundos de **parada** dentro y no veinte segundos de estar dentro, y el reloj arranca donde arranca la ventana que declaró la parada.
- **Dado** el error del fijo, **cuando** se busca hasta dónde llega esta spec, **entonces** el límite está escrito con su número: por encima de **σ ≈ 15 m** la validación se degrada y por encima de **σ ≈ 20 m** deja de sostenerse. Cubre la calle normal y no cubre el cañón urbano profundo.
- **Dado** una ventana que todavía no cubre su duración, **cuando** se pregunta si es una parada, **entonces** la respuesta es que no, y no se extrapola.
- **Dado** una traza clasificada como vehículo, **cuando** se mide la parada, **entonces** la respuesta es que no es parada, sea cual sea la deriva de la ventana: el veto del vehículo se resuelve antes de medir nada.

### ACs de la base que se mantienen

Se citan porque son los que se confunden con lo que cambia, y los cinco siguen vigentes:

- «**Dado** una jugadora que se para dentro del geofence el tiempo de permanencia, **cuando** se comprueba, **entonces** la llegada se valida.» El tiempo de permanencia sigue siendo veinte segundos.
- «**Dado** una jugadora que se para dentro del geofence menos del tiempo de permanencia, **cuando** sigue andando, **entonces** la llegada no se valida.»
- «**Dado** una jugadora que atraviesa el geofence de un sitio sin pararse, **cuando** sigue andando, **entonces** la llegada no se valida.» Este es el que la regla nueva existe para sostener **en presencia de ruido**, que es donde la vieja no llegaba.
- «**Dado** una jugadora que atraviesa el geofence a velocidad ambigua y se para dentro, **cuando** se comprueba, **entonces** la llegada se valida: en la duda, valida.»
- «**Dado** el módulo de las llegadas, **cuando** se inspecciona su código, **entonces** no lee el reloj del sistema, no usa ninguna fuente de azar y no clasifica velocidades por su cuenta.» La ventana de deriva no clasifica velocidades: mide desplazamiento de centroides, y vive en el mismo módulo del que la capa ya leía la regla de la duda.

### Decisión asumida derogada

La decisión asumida «**Permanencia para validar: 20 s dentro del geofence** → asumido (alternativas: validar al entrar, sin permanencia; 60 s como el regreso)» **queda obsoleta y debe entenderse derogada** por esta iteración, y se sustituye por la que va abajo en «Decisiones asumidas». El número se conserva; lo que se deroga es la parte que decía «dentro del geofence» como si estar dentro y estar parada fuesen lo mismo de medir, y el supuesto tácito de que la parada llegaba resuelta desde la traza.

## Nota sobre el atasco, y por qué su AC no era absoluto

La fila 44 midió una cosa que ni esta spec ni la suya declaraban bien, y queda escrita aquí porque es de la validación y no del cableado.

**El atasco dentro de un geofence no valida solo mientras la traza dice `vehiculo`.** El veto del vehículo es lo que aparta la llegada de un coche parado —no lo hace la deriva, que en un coche quieto es cero—, y ese veto dura lo que dure la clasificación. Pasados los `SALIDA_DE_VEHICULO_S = 120` quieto, el detector de SPEC-031 decide que quien juega se bajó del coche: la traza deja de decir vehículo, la ventana pasa a ver una parada de verdad y la llegada **sí** valida.

No es una excepción a «el atasco no valida», y conviene no leerlo así: es que a partir de ahí lo que hay dentro del geofence ya no es un coche parado, y el diseño de SPEC-031 dice exactamente eso —«un autobús parado en un semáforo no es bajarse del autobús», y por eso el tiempo de salida es de dos minutos y no de treinta segundos—. Lo que estaba mal escrito es el criterio, que se formuló en absoluto: **el atasco no valida mientras el detector siga afirmando el motor**, y esa es la forma exacta.

Está afirmado con su número en `test/nucleo/marcha.test.mjs`, en dos casos hermanos —un atasco de `SALIDA_DE_VEHICULO_S − 30` que no valida y uno de `SALIDA_DE_VEHICULO_S + 60` que sí—, para que quien un día toque esa constante vea enfrente qué se lleva por delante. Y se anota para quien orquesta que el criterio de SPEC-044 «un vehículo detenido dentro de un geofence —un atasco— … la llegada **no** se valida» hay que leerlo con esta acotación.

## Notas técnicas

- **Ficheros afectados:** `packages/nucleo/partida/ritmo.js`, donde vive la ventana de deriva con sus dos pares y el umbral que elige entre ellos; y `packages/nucleo/partida/llegadas.js`, que cuenta la permanencia sobre lo que responde la ventana en lugar de sobre la parada de enlace a enlace. `secuencia.js` no cambia.
- **Antes/después, en una línea:** antes, la permanencia se contaba mientras `esUnaParada` dijera que sí del último enlace de la traza; después, se cuenta desde que la ventana declara parada, y el reloj arranca **al principio de la ventana** —que es lo que hace que veinte segundos quieta con la ventana corta ya los tenga cumplidos y no haya que pagarlos dos veces.
- **Las dos constantes homónimas se desambiguan.** La permanencia de esta spec y la del regreso de SPEC-030 se llamaban las dos `PERMANENCIA_S` y son dos relojes distintos con dos asimetrías contrarias. Cada una pasa a nombrarse por lo que mide, para que un grep no las confunda; el reloj del regreso **no se toca** por lo demás.
- **Composición que se mantiene explícitamente:** la regla de la duda no se reimplementa aquí y se sigue consultando en `ritmo.js`; la capa de llegadas sigue sin mirar el GPS y sin clasificar; y la secuencia sigue siendo un dato del núcleo y no una navegación.
- **Impacto en el estado de partida: no.** El área que la base registra no gana ni un campo: la ventana de deriva es estado en vuelo de la salida en curso y **no se serializa**. Ni las posiciones ni la precisión ni la deriva se guardan en ninguna parte, que es la garantía de privacidad de la base y aquí se refuerza porque pasan muchas más posiciones por el sensor que antes.
- **Retrocompatibilidad:** las partidas guardadas se leen y se escriben igual. Una llegada validada antes de esta iteración sigue esperando su escena. Una salida en curso durante la actualización empieza la ventana de cero y paga la permanencia otra vez: son veinte segundos y está declarado.
- **i18n y tracking:** nada. No hay texto visible nuevo, y ninguna de estas medidas aflora en ninguna pantalla.
- **Dependencias:** la spec base **SPEC-032**; **SPEC-031** y su iteración 1, de donde viene el veto del vehículo y su borde; **SPEC-004**, donde vive la asimetría por efecto; y **SPEC-044**, la fila que trae la medida, la cadencia por tiempo y el cableado.
- **Verificación manual sugerida tras el despliegue:** (1) quedarse quieto veinte segundos dentro del geofence de un sitio en calle abierta y comprobar que la escena queda esperando; (2) repetirlo entre edificios altos, donde la precisión declarada empeora, y comprobar que valida a los cuarenta; (3) atravesar el geofence andando a paso vivo y comprobar que no queda nada esperando; (4) pararse en un semáforo dentro de un geofence sin mirar el móvil y comprobar que después la escena sigue ahí.

## Decisiones asumidas

- **La permanencia sigue siendo 20 s, y lo que se vuelve adaptativo es la ventana con la que se mide la parada** → asumido (alternativas: subir la permanencia a 40 s para todo el mundo, que era el arreglo cómodo; bajarla para compensar la ventana larga). Regla: §9c mide que con el fijo bueno la ventana corta ya separa —0 % de paseos a 4 y a 5 km/h hasta 3 m de error—, así que subirla para todos habría contradicho sin necesidad la razón por la que la base la puso corta: validar es barato y un beat que se atiende de paso valida igual. Sustituye a la decisión derogada arriba.
- **El límite de error declarado se escribe con número y no se disimula** → asumido: por encima de σ ≈ 15 m la validación se degrada y por encima de σ ≈ 20 m deja de sostenerse (alternativa: no declararlo y dejar que el número saliera de la tabla cuando alguien la buscara). Regla: §6o y §9c; un límite sin número es una esperanza, y aquí se sabe cuál es. Lo que queda fuera —el cañón urbano profundo— queda fuera dicho, no descubierto por quien juegue.
- **Una posición sin precisión declarada usa la ventana larga** → asumido (alternativa: usar la corta y confiar). Regla: la asimetría de esta spec es validar en la duda sobre el **medio de transporte**, no sobre la **calidad del dato**; el lado caro aquí es validar a quien pasa andando, que tumbaría «El visor no aparece nunca andando».
- **La precisión del fijo elige la ventana y sigue sin ensanchar el radio** → asumido, y es la decisión de la base que se conserva y se matiza (alternativa: radio efectivo igual al radio más la precisión). Regla: la de la base sigue entera —en ciudad densa un geofence se tragaría la manzana y el solape dejaría de ser un borde—, y elegir la ventana con la precisión resuelve lo mismo por el lado del tiempo, que es donde el ruido se puede promediar.
- **La ventana de parada es una sola y no una por geofence** → asumido (alternativa: una ventana por sitio). Regla: estar parada es una propiedad de la trayectoria y no del sitio; una por sitio mediría lo mismo n veces sin cambiar ninguna respuesta.
- **El veto del vehículo se resuelve antes de medir la deriva** → asumido (alternativa: medir siempre y filtrar después). Regla: es la mitad del criterio que se pierde sola en un arreglo de ruido —un coche parado no deriva—, y resolverla primero la hace imposible de perder por descuido.
