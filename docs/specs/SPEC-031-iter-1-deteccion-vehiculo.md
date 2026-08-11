# SPEC-031-iter-1 — La traza clasificada deja de decidir una llegada, y pasa a poder vetarla

## Descripción

Iteración de **cambio de comportamiento** sobre la implementación de SPEC-031. La desencadena la medida de `pipeline/decisiones-orquestador.md` §9, hecha durante la fila 44 al montar por primera vez la tubería real —sensor, detector de transporte y capa de llegadas alimentada posición a posición— y llevada al dueño antes de escribir nada; él autorizó el cambio con el número delante (§9b).

Lo que cambia es **quién decide que alguien está parado dentro de un geofence**. Hasta hoy lo decidía la traza que esta spec entrega: un enlace de la traza —dos fijos consecutivos— era una parada si recorría menos de medio metro por segundo, y esa respuesta bastaba para validar. Ya no basta. La regla de parada que decide una llegada pasa a medirse por **deriva de ventana** —el centroide de la primera mitad de una ventana contra el de la segunda—, y la traza clasificada de esta spec se queda con lo que siempre supo hacer bien: **apartar el vehículo**. De criterio suficiente pasa a **veto**.

El motivo está medido y no es una preferencia. Con σ = 10 m de error de fijo y alguien **parado 300 s dentro de un geofence**, la regla de enlace a enlace validaba el **13 %** de las veces muestreando por tiempo y el **0 %** con la cadencia por distancia que hay en producción (§9a). La aritmética explica por qué: un ruido de σ metros con fijos a T segundos aparenta ~1,4·σ/T m/s, así que hacen falta **T > 2,8·σ** segundos entre fijos para que un parado de verdad parezca parado. Lo que separa el ruido de andar no es el umbral, es que **el ruido del GPS es de media cero y la deriva de quien anda no**; promediar media ventana hunde el ruido como 1/√n y deja la deriva intacta. Los dos pares ventana/deriva y el umbral que elige entre ellos salen de la tabla de §9c y **no se reinventan aquí**.

Lo que **no** cambia, y conviene decirlo porque es casi todo: el umbral de medio metro por segundo **sigue valiendo** para el ritmo de la salida y para el motor de pasos, y ahí no se toca ni se recalibra; las seis constantes del detector siguen donde estaban con sus valores; el vocabulario cerrado de clasificaciones sigue siendo el de SPEC-004; la regla de la duda por efecto no se reabre; los huecos siguen cortando la traza; y la asimetría por efecto sigue siendo la misma pieza y en el mismo módulo. Esta iteración no toca una línea del detector de `transporte.js`.

## Alcance de implementación

- Esta iteración es **una corrección de la regla con la que se decide una parada**: retira el uso de la parada de enlace a enlace como criterio de validación de un geofence y no añade comportamiento nuevo al detector.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- **Sí hay un cambio de la frontera de inyección, y no es de esta spec sino de SPEC-044**: la precisión declarada del fijo, que la fuente de posiciones ya entrega desde SPEC-030 y que el detector ya consume para no fundar un vehículo con un fijo malo, pasa además a elegir la ventana con la que se mide la parada. Aquí solo se declara que ese dato no cambia de forma ni gana ningún consumidor dentro del detector. **Ninguna dependencia nueva.**
- **Fuera de alcance** — los dos pares ventana/deriva, el umbral de precisión que elige entre ellos, la cadencia de la suscripción y el límite de error declarado: son de SPEC-044 y aquí se citan, no se deciden. **Fuera de alcance** también el umbral de medio metro por segundo, que se conserva intacto para los otros dos efectos, y la constante de salida de vehículo, que no se toca y cuyo borde se anota en la iteración de SPEC-032.

## Criterio de aceptación modificado

### AC modificado

- **Dado** una secuencia de referencia que produce al menos un segmento ambiguo, **cuando** se pregunta a los tres efectos por esos metros, **entonces** cuentan para el motor de pasos, **no apartan una llegada** y **no** entran en la medida del tramo.
- **Dado** la traza clasificada y una llegada, **cuando** se pregunta qué aporta la traza a la validación, **entonces** aporta un veto y no una validación: que un tramo no sea de vehículo permite validar, y quien decide que se estaba parada es la ventana de deriva.
- **Dado** la regla de parada de enlace a enlace que esta spec produce en la traza, **cuando** se busca quién decide con ella la validación de un geofence, **entonces** no queda nadie.
- **Dado** el umbral de medio metro por segundo, **cuando** se busca quién lo consume, **entonces** son el ritmo de la salida y el motor de pasos, y siguen consumiéndolo con el mismo valor y el mismo efecto que antes de esta iteración.

### ACs de la base que se mantienen

Se citan porque son los confundibles con el modificado, y los tres siguen vigentes tal cual:

- «**Dado** esa misma traza, **cuando** se comparan las tres respuestas, **entonces** la de la medición del tramo es la contraria a las otras dos, y las tres salen del mismo módulo de SPEC-004.»
- «**Dado** esa misma secuencia, **cuando** se atraviesa el geofence de un beat durante el tramo de vehículo, **entonces** el beat sigue sin validar.» Este es el que **se refuerza** con el cambio, no el que se debilita: es la mitad del criterio que un arreglo de ruido pierde sola.
- «**Dado** una secuencia por debajo del umbral de andar, **cuando** se clasifica, **entonces** sus segmentos son de andando o de parada, y ninguno ambiguo.» La clasificación `parada` sigue existiendo en la traza y sigue significando lo mismo dentro de ella; lo que ha dejado de tener es un tercer consumidor.

### AC derogado

El criterio «**Dado** una secuencia de referencia que produce al menos un segmento ambiguo, **cuando** se pregunta a los tres efectos por esos metros, **entonces** cuentan para el motor de pasos, **validan una llegada** y **no** entran en la medida del tramo» **queda obsoleto y debe entenderse derogado** por esta iteración. El comportamiento esperado del implementador y de la suite QA es el del criterio nuevo de arriba: sobre esos metros la traza **no aparta** la llegada, que es cosa distinta de validarla.

La diferencia no es un matiz de redacción y es exactamente el agujero por el que se coló la duodécima aparición de §6h: leído como suficiencia, el criterio daba por hecho que una traza que no dice vehículo produce llegadas, y con él en verde la capa entera de llegadas no se disparaba nunca en un teléfono.

## Notas técnicas

- **Fichero afectado: ninguno de esta spec.** `packages/nucleo/partida/transporte.js` no cambia: ni una constante, ni un umbral, ni la forma de la traza. Lo que cambia es quién consume qué, y ocurre en `packages/nucleo/partida/ritmo.js` (la ventana de deriva, que es de SPEC-044) y en `packages/nucleo/partida/llegadas.js` (que deja de decidir con la parada de enlace a enlace).
- **Antes/después, en una línea:** antes, `llegadas.js` preguntaba a `esUnaParada` por el último enlace de la traza; después, pregunta a la ventana de deriva de la salida y consulta la traza solo para saber si puede validar. La guarda de vehículo sigue estando en las dos, y esa duplicación es deliberada: la ventana responde que no es parada en cuanto la clasificación es `vehiculo`, antes de medir nada.
- **Composición que se mantiene explícitamente:** la asimetría por efecto sigue viviendo entera en `ritmo.js` y el detector sigue sin nombrar a ninguno de los tres efectos. El criterio de la base que afirma que el detector no copia la asimetría sigue en pie y esta iteración lo deja intacto.
- **Impacto en la frontera del núcleo: no**, por parte de esta spec. La entrada del detector sigue siendo `{ lat, lon, tMs, precisionM }` y su salida sigue siendo la traza clasificada.
- **Impacto en el estado de partida: no.** La clasificación sigue sin guardarse como historial, que es la decisión de privacidad de la base y no se reabre.
- **Retrocompatibilidad:** ninguna partida guardada cambia de forma ni de contenido, porque nada de esto se guarda. Una salida en curso al actualizar vuelve a anclar la ventana desde cero, que es lo que ya hace al volver del segundo plano.
- **i18n y tracking:** nada. Esta spec sigue sin producir ni un texto visible ni un evento.
- **Dependencias:** la spec base **SPEC-031**; **SPEC-004**, de donde salen el umbral de parada y la asimetría; **SPEC-032**, cuya iteración 1 cambia cómo se mide «parada dentro»; y **SPEC-044**, que es la fila que trae la medida y la regla nueva.
- **Verificación manual sugerida tras el despliegue:** (1) abrir una salida y quedarse quieto veinte segundos dentro del geofence de un sitio, comprobando que la escena queda esperando; (2) atravesar ese mismo geofence andando sin pararse y comprobar que no queda nada esperando; (3) hacer el mismo tramo en coche, parando dentro menos de dos minutos, y comprobar que no valida; (4) comprobar que el ritmo de la salida sigue descontando la parada del café, que es el efecto que aquí no se ha tocado.

## Decisiones asumidas

- **El detector no gana una segunda salida con la parada por ventana** → asumido: la ventana vive en `ritmo.js` y no en `transporte.js` (alternativa: que el detector entregase la parada ya medida junto con la traza). Regla: la base decidió que el detector produce traza y nada más, y meterle una ventana lo convertiría en dos cosas; además la ventana la consultan la capa de llegadas y nadie más, mientras que la traza la consultan los tres efectos.
- **La guarda de vehículo queda declarada dos veces a propósito** → asumido (alternativa: dejarla solo en `validaLlegadaPorGeofence`). Regla: es la mitad del criterio que se pierde sola en un arreglo de ruido —§9c la mide al 0 % en todas las tandas— y §6h dice que lo que no protesta al faltar se cierra por contrato; que la ventana responda «no es parada» ante `vehiculo` antes de medir nada la hace imposible de perder por una refactorización de la otra.
- **No se recalibra el umbral de medio metro por segundo** → asumido (alternativa: aprovechar la iteración para revisarlo también en el ritmo). Regla: para el ritmo y el motor de pasos no hay ninguna medida que diga que falla, y §9b dice que un número se cambia con la medida delante y no de paso.
