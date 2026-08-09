# SPEC-024 — El Overpass del proyecto en producción

## Descripción

La generación de un mapa consulta un Overpass **del proyecto**, no la cola de los mirrors públicos. El motivo no es la privacidad sino la fricción: contra los mirrors la consulta de una celda tarda minutos cuando hay cola, y esa espera cae justo en el onboarding, en la pantalla que anuncia el prólogo (`[flujo: A1P5]`), que es el peor sitio del juego para perder a alguien. De paso las coordenadas dejan de ir a un tercero.

Esta spec entrega tres cosas y ninguna de las tres es «levantar un contenedor»: **una sonda que dice si el Overpass sirve datos de verdad**, porque un contenedor `Up` responde 200 con una página de error XML y entonces todo «funciona» y todo va lentísimo; **un presupuesto de tiempo medido**, con qué se mide y en qué condiciones, porque «menos de un minuto» sin sujeto ni percentil no se puede poner en rojo; y **una cadena de respaldo declarada**, con qué pasa cuando el propio no está y qué ve el jugador cuando no está ninguno.

No tiene interfaz. Lo que el jugador percibe es una pantalla de espera que dura lo que dura, y en el peor caso un mapa que no se pudo levantar y se puede reintentar sin volver a contestar el onboarding.

Anclas: **RF-INFRA-003** (`docs/prd.md` §4.13, marcado **⚠ sin escenario**) y **RNF-PER-001** (§5.5), con `game-design/arquitectura.md` —decisión 3, «Lo que esto obliga a hacer» y el pendiente 1, cerrado el 5-ago-2026— como fuente que manda sobre el PRD. Recoge el **riesgo 9** del PRD (§8), «operar Overpass propio añade una pieza de infraestructura con datos de España completa», cuya mitigación escrita es exactamente lo que aquí se convierte en criterios: la imagen Docker y el runbook ya existen, la caché amortigua las caídas y los mirrors públicos quedan como respaldo degradado.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes, páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega. Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura. **Aquí no la toca**: `packages/nucleo/` no cambia ni una línea. `buildWorld` sigue recibiendo su `fetchData` inyectado y le da exactamente igual de dónde salen los datos, que es la razón por la que esta pieza se puede especificar aparte.
- **Fuera de alcance, aunque parezca natural traerlo aquí:** el sobre de la respuesta, las fichas, los topes y la superficie de escritura del proxy, que son SPEC-023 y aquí solo se consumen; qué consulta se escribe —qué tags entran en el pool y con qué filtros—, que es de las filas 5 y 6 y aquí solo se fija que su texto es un artefacto con versión; la capa que trae los datos al móvil y pinta el mapa, que es la fila 26; la caché de generación del proxy, que SPEC-023 deja apagada y esta spec no enciende; y el despliegue en sí —proveedor, máquina, red—, que no es código y va al runbook.

## Criterios de aceptación

Las cinco categorías obligatorias quedan repartidas así: el camino feliz vive en «La sonda» y «El presupuesto del minuto»; la validación de entradas, en la comprobación de cobertura del extracto y en el rechazo de la respuesta que no es JSON; el estado vacío, en el Overpass recién arrancado sin base de datos, en una celda de campo sin ningún POI y en la métrica de un día sin generaciones; el estado de error, en las dos causas de síntoma idéntico, en el respaldo agotado y en la consulta que se pasa de plazo; y los casos límite, en la importación a medias, en la celda fuera del extracto, en dos generaciones simultáneas y en el cambio del texto de la consulta, que invalida la caché entera.

Los criterios van en Gherkin español, el mismo `Dado / Cuando / Entonces` de `docs/testing.md`.

### La sonda: qué cuenta como «sirve de verdad»

- **Dado** el Overpass del proyecto, **cuando** se le pregunta si está listo, **entonces** la respuesta sale de haberle hecho una consulta real y no de consultar el estado del contenedor, del proceso ni del puerto.
- **Dado** un contenedor en estado `Up` cuyo volumen de base de datos está vacío, **cuando** se pasa la sonda, **entonces** el resultado es «no sirve» y ninguna generación se encamina hacia él.
- **Dado** una respuesta que empieza por `<`, **cuando** la sonda la evalúa, **entonces** la trata como fallo aunque el código HTTP sea 200, y el diagnóstico cita el mensaje de error literal que traía el XML.
- **Dado** la consulta canario declarada, **cuando** la sonda la ejecuta, **entonces** exige un número mínimo de elementos conocido y no se conforma con que la palabra `elements` aparezca en la respuesta.
- **Dado** una celda de campo abierto sin un solo POI, **cuando** se genera su mapa, **entonces** la respuesta vacía se acepta como dato legítimo y no se confunde con un Overpass roto.
- **Dado** la sonda, **cuando** falla, **entonces** clasifica el motivo en un conjunto cerrado —sin base de datos, base de datos inalcanzable, importación en curso, plazo agotado, respuesta ilegible— y cada motivo nombra su arreglo.
- **Dado** una respuesta cuyo XML dice `No such file or directory` sobre el socket del dispatcher, **cuando** se clasifica, **entonces** el motivo es «no hay base de datos» y el arreglo es importar, no reiniciar.
- **Dado** una respuesta cuyo XML dice `Permission denied` sobre el mismo socket, **cuando** se clasifica, **entonces** el motivo es «base de datos inalcanzable» y el arreglo es el permiso de travesía del directorio, no importar de nuevo.
- **Dado** la sonda en marcha, **cuando** se ejecuta periódicamente, **entonces** su periodo y su plazo están declarados en la configuración y su coste es despreciable frente al tráfico real.

### Prontitud: arrancar, importar y no mentir mientras tanto

- **Dado** el servicio recién arrancado con la importación en curso, **cuando** se le pregunta si está listo, **entonces** dice que no, y lo dice durante toda la importación sin que nadie tenga que mirar los registros.
- **Dado** el servicio no listo, **cuando** llega una generación, **entonces** se encamina directamente al respaldo sin esperar a que el propio conteste.
- **Dado** el servicio que pasa de no listo a listo, **cuando** lo confirma el número declarado de sondas consecutivas en verde, **entonces** empieza a recibir tráfico, y no antes.
- **Dado** el servicio listo que deja de servir a mitad del día, **cuando** la sonda lo detecta, **entonces** deja de recibir tráfico dentro del periodo de sonda declarado y el respaldo lo absorbe sin que ninguna generación se quede colgada.
- **Dado** un reinicio de la máquina, **cuando** vuelve el servicio, **entonces** no repite la importación y vuelve a estar listo sin intervención humana.
- **Dado** el arranque del proxy, **cuando** el destino del Overpass del proyecto no está configurado, **entonces** no arranca y el error dice que falta, en lugar de caer silenciosamente a los mirrors públicos para siempre.

### El presupuesto del minuto: qué se mide y en qué condiciones

- **Dado** el reloj de RNF-PER-001, **cuando** se define, **entonces** empieza cuando el jugador confirma dónde levantar el mapa `[flujo: A1P4]` y para cuando la pantalla de espera cede al mapa pintado `[flujo: A1P6]`, e incluye red, generación y primer pintado.
- **Dado** ese reloj, **cuando** se reparte, **entonces** cada tramo tiene su presupuesto declarado y la suma deja margen; el tramo de datos es el que esta spec debe cumplir y los demás son de las filas 21 y 26.
- **Dado** las cuatro celdas arquetipo del andamiaje —costera, urbana densa, barrio de tres calles y suelo de 250 m—, **cuando** se mide el tramo de datos con la caché fría contra el Overpass del proyecto, **entonces** el percentil declarado queda por debajo de su presupuesto en las cuatro.
- **Dado** la celda urbana densa, que es la peor, **cuando** gobierna la medición, **entonces** es la que decide si el presupuesto se cumple, y no la media de las cuatro.
- **Dado** el tramo de datos, **cuando** se cronometra, **entonces** una celda entera son terreno, POIs y callejero pedidos como un solo lote, y el reloj de red mide el lote, no la suma de tres esperas encadenadas.
- **Dado** una consulta que se pasa del plazo declarado, **cuando** se agota, **entonces** se corta, se pasa al siguiente eslabón del respaldo y el plazo total sigue cabiendo en el presupuesto del tramo de datos.
- **Dado** la caché caliente para una celda, **cuando** se vuelve a pedir, **entonces** el tramo de datos es despreciable y la medición del presupuesto no se apoya nunca en ese caso.
- **Dado** dos generaciones simultáneas de celdas distintas, **cuando** se atienden, **entonces** ninguna de las dos se sale de su presupuesto por culpa de la otra, y el número de consultas en vuelo que el servicio admite está declarado.
- **Dado** la medición, **cuando** se publica, **entonces** dice sobre qué máquina se hizo, con qué extracto y en qué fecha, porque un número sin esas tres cosas no es comparable con el siguiente.

### La cadena de respaldo, y lo que pasa cuando no hay nada

- **Dado** el Overpass del proyecto sirviendo, **cuando** se genera un mapa, **entonces** la consulta no sale hacia ningún mirror público.
- **Dado** el Overpass del proyecto sin servir, **cuando** se genera un mapa, **entonces** la consulta recorre los mirrors públicos en el orden declarado y el mapa se levanta igual.
- **Dado** un mirror que responde 429, 503 o 504, **cuando** se recorre la cadena, **entonces** se pasa al siguiente sin reintentar contra el mismo y sin que el jugador vea nada distinto de una espera.
- **Dado** un mirror que responde 200 con una página de error XML, **cuando** se evalúa, **entonces** se descarta con el mismo criterio que el propio: la sonda es una y vale para todos los eslabones.
- **Dado** la cadena entera agotada, **cuando** se responde, **entonces** el mapa **no** se levanta a medias: no se congela ningún mundo parcial ni se guarda nada de esa celda.
- **Dado** una generación que agotó la cadena, **cuando** el jugador reintenta, **entonces** el onboarding sigue donde estaba con lo contestado precubierto y no vuelve a preguntar nada.
- **Dado** una generación fallida, **cuando** se mira lo que quedó dicho en pantalla, **entonces** es una espera que no salió y una forma de volver a intentarlo, y no una explicación de qué servidor falló.
- **Dado** el respaldo en uso durante un día entero, **cuando** se lee la métrica del día, **entonces** hay un recuento de generaciones servidas por cada eslabón, y ese recuento es lo que dispara la revisión de la pieza.

### La cobertura del extracto, que es el error que no se ve

- **Dado** el extracto declarado, **cuando** se configura el servicio, **entonces** su cobertura geográfica es un dato explícito y consultable, no algo que se deduzca del nombre del fichero.
- **Dado** una celda dentro de la cobertura, **cuando** se genera, **entonces** se consulta al Overpass del proyecto.
- **Dado** una celda fuera de la cobertura, **cuando** se genera, **entonces** **no** se consulta al Overpass del proyecto y se va directo al respaldo, que sí tiene el planeta.
- **Dado** una celda fuera de la cobertura consultada por error contra el extracto, **cuando** se recibe una respuesta vacía, **entonces** se distingue de una celda pobre de verdad y no se genera un mundo vacío como si fuera legítimo.
- **Dado** el extracto, **cuando** se reimporta con datos más recientes, **entonces** ningún mundo ya congelado cambia, porque lo generado no se resiembra jamás (RF-MUNDO-005).
- **Dado** el extracto, **cuando** se lee su procedencia, **entonces** consta de qué mirror salió y de qué fecha es, y esa pareja aparece en la métrica de operación.

### La caché permanente, y el texto de la consulta que la invalida entera

- **Dado** la caché de consultas, **cuando** se describe su política, **entonces** es permanente por diseño y ninguna entrada caduca por el paso del tiempo.
- **Dado** la clave de caché, **cuando** se calcula, **entonces** sale del texto literal de la consulta y de nada más.
- **Dado** un cambio de una sola letra en el texto de la consulta, **cuando** se vuelve a generar la misma celda, **entonces** no hay acierto de caché y la petición sale hacia arriba: la caché entera queda invalidada y eso es una consecuencia conocida, no una avería.
- **Dado** el texto de la consulta, **cuando** se despliega, **entonces** lleva una versión declarada y cambiarla es un acto deliberado, con su coste de repoblar la caché anotado en el propio cambio.
- **Dado** un cambio de versión de la consulta, **cuando** se compara con los fixtures de OSM de SPEC-001, **entonces** la comparación es posible, porque cada fixture guarda la consulta literal con la que se capturó y se ve si dejó de representar lo que producción pide.
- **Dado** una respuesta que no es JSON completo, **cuando** se atiende, **entonces** no se cachea y no se sirve.
- **Dado** dos generaciones simultáneas de la misma celda sin acierto de caché, **cuando** se atienden, **entonces** se hace una sola consulta aguas arriba y las dos reciben lo mismo.

### Lo que el Overpass del proyecto no escribe

Bloqueante (`@privacidad`, RNF-DET-003). Las coordenadas del jugador salen del móvil exactamente una vez, al generar cada mapa, y esta es la pieza que las recibe.

- **Dado** el Overpass del proyecto y todas las capas que lo sirven, **cuando** se revisa su configuración, **entonces** el registro de accesos está apagado y la configuración lo declara a propósito.
- **Dado** un mes de generaciones, **cuando** se recorre lo que quedó escrito en la máquina del Overpass, **entonces** no aparece ninguna consulta con coordenadas, ninguna dirección IP y ninguna cabecera de cliente.
- **Dado** la superficie de escritura declarada de SPEC-023, **cuando** se le suman las entradas que esta pieza añade, **entonces** siguen declaradas todas y ninguna deriva su clave de quién llamó.
- **Dado** un fallo de consulta, **cuando** se lee el diagnóstico que quedó escrito, **entonces** lleva el motivo clasificado y el eslabón que falló, y ninguna coordenada.
- **Dado** la métrica de operación de un día, **cuando** se busca la geografía de lo generado, **entonces** solo hay un recuento de generaciones, sin ninguna zona.
- **Dado** un día sin una sola generación, **cuando** se lee la métrica, **entonces** están todos los contadores a cero y no falta ninguno.

## Notas técnicas

### Qué entrega esta spec

| Ruta | Qué entrega |
| --- | --- |
| `server/aguas-arriba/overpass.mjs` | el cliente de generación que SPEC-023 recibe inyectado: cadena de eslabones, plazo por eslabón, coalescencia y caché por texto de consulta |
| `server/aguas-arriba/sonda-overpass.mjs` | la sonda: consulta canario, umbral de elementos, clasificación cerrada de motivos y estado de prontitud |
| `server/aguas-arriba/cobertura.mjs` | la cobertura del extracto y la decisión de encaminar al propio o al respaldo |
| `server/config.mjs` (ampliación) | los parámetros de abajo, con sus valores por defecto y los que no lo tienen a propósito |
| `deploy/overpass/` | el compose de producción derivado del de desarrollo, más el runbook con las dos causas de síntoma idéntico |
| `scripts/overpass-medir.mjs` | el cronómetro del tramo de datos sobre las cuatro celdas arquetipo, que es lo que convierte RNF-PER-001 en un número comparable |

`server.mjs`, el servidor de desarrollo del prototipo, se queda como está: su cadena de upstreams ya tiene la forma correcta y es el precedente del que sale esta spec.

### Los parámetros

| Parámetro | Valor por defecto | De dónde sale |
| --- | --- | --- |
| `OVERPASS_PROPIO` | **sin valor por defecto** | el proxy no arranca sin él, para que caer a los mirrors sea siempre visible |
| `EXTRACTO` | España, sin actualización por diffs | `docker-compose.yml`; la frescura solo afecta a mapas nuevos |
| `COBERTURA` | la caja del extracto | fuera de ella el propio no tiene datos y responder vacío sería mentir |
| `RESPALDO` | los tres mirrors públicos, en el orden de `server.mjs` | riesgo 9: respaldo degradado, medido por velocidad |
| `PRESUPUESTO_DATOS` | 20 s para el lote de una celda | encaja bajo `ESPERA_MAXIMA_AGUAS_ARRIBA` de SPEC-023 |
| `PLAZO_ESLABON` | 8 s | tres eslabones caben en el presupuesto sin agotarlo |
| `PERCENTIL_MEDIDA` | p95 sobre 20 pasadas por celda | una media esconde exactamente la cola que estropea un onboarding |
| `SONDA_CANARIO` | consulta fija con respuesta conocida no vacía | un `grep "elements"` pasa con la lista vacía |
| `SONDA_MINIMO` | el número de elementos que esa consulta da con el extracto entero | lo que distingue «sirve» de «contesta» |
| `SONDA_PERIODO` | 60 s | detecta la caída dentro de una generación, no de una tarde |
| `SONDA_PARA_LISTO` | 2 sondas consecutivas | evita el vaivén durante el final de una importación |
| `CONSULTA_VERSION` | **sin valor por defecto** | cambiar el texto sin cambiar la versión es cómo se pierde la caché sin enterarse |

El reparto del minuto de RNF-PER-001, que es lo que hace la cifra verificable: **datos ≤ 20 s** (esta spec), **generación en el dispositivo ≤ 25 s** (fila 26 sobre el paquete de la fila 2), **primer pintado ≤ 10 s** (fila 21), **margen 5 s**. Las tres cifras se miden por separado y ninguna se puede gastar la de otro sin que se vea.

### Las dos causas de síntoma idéntico, que es la razón de que la sonda exista

`CLAUDE.md` documenta un caso real que costó siete horas: un contenedor «Up» sirviendo una página de error XML con código 200, el proxy descartándola y cayendo a los mirrors públicos, y todo «funcionando» solo que lentísimo. Y documenta que han ocurrido **dos causas distintas con el mismo síntoma**, separadas únicamente por el mensaje del XML:

| Mensaje del XML | Qué pasa | Arreglo |
| --- | --- | --- |
| `No such file or directory` sobre `/db/db/osm3s_osm_base` | no hay base de datos: volumen vacío o importación no hecha | importar; el entrypoint la salta si existe `/db/init_done` |
| `Permission denied` sobre el mismo socket | la base de datos está, el CGI no la alcanza: `/db` llega `700 overpass:overpass` y nginx corre como uid 101 | `chmod 755 /db`, que ya hace `scripts/overpass-setup.sh` |

Por eso el motivo de fallo de la sonda es un conjunto cerrado y cada valor nombra su arreglo: la diferencia entre los dos casos es horas de importación en un sentido o en el otro. Y por eso el criterio de prontitud no puede mirar el contenedor: `docker ps` dice `Up` en los dos.

### Lo que este Overpass no puede llevarse por delante

Tres cosas que el diseño ya garantiza y que conviene tener escritas antes de que alguien las descubra tarde:

- **Un mundo congelado no depende de esta pieza.** RF-PERS-001 y RF-MUNDO-005: los datos de OSM se consultan una vez, al levantar el mapa, y el mundo se congela entero en el dispositivo. Que el Overpass se caiga un martes no toca ni una partida en curso, y reimportar el extracto no cambia ningún mapa ya levantado.
- **Ninguna salida depende de esta pieza.** RNF-RED-002: la red solo hace falta al generar un mapa y al preparar una salida. Esta pieza sirve al primero de los dos momentos y a nada más.
- **La degradación silenciosa no aplica aquí.** Es la excepción y hay que decirla: cuando el LLM o las fotos no están, la aventura sigue con textos de plantilla y nadie menciona la red (RNF-RED-001). Cuando no hay datos de OSM **no hay mapa que levantar**, así que el fallo es honesto y reintentable, nunca un mundo vacío presentado como legítimo. Un mundo generado sobre una respuesta vacía sería un mapa sin nada anclado, que es la peor forma posible de fallar: no da error, da un juego roto.

### La caché permanente, dicha entera porque ya ha mordido

`CLAUDE.md` la declara permanente por diseño —los datos de OSM cambian despacio— y avisa de la trampa: **la clave es el hash del texto de la consulta, así que cambiar una letra invalida la caché entera** y la siguiente ejecución paga minutos contra los mirrors públicos. No es un cuelgue, y confundirlo con uno cuesta caro. Durante esta ejecución del pipeline ha vuelto a doler: `test/casting-report.mjs`, que es la única verificación de tubería completa contra mundos reales, solo se pudo pasar a mano una vez porque necesita Overpass levantado (`pipeline/informe-2026-08-08.md`).

De ahí sale la única imposición de esta spec sobre las filas que escriben la consulta: **el texto de la consulta es un artefacto con versión declarada**. No para congelarlo —las filas 5 y 6 tienen todo el derecho a cambiarlo— sino para que el cambio se vea, se pueda anotar con su coste y se pueda cruzar con la consulta literal que cada fixture de SPEC-001 guarda en su manifiesto. Tres cachés distintas conviven y no hay que mezclarlas: la del dispositivo, que es el mundo congelado y es permanente de verdad; la del proxy sobre la generación, que SPEC-023 deja **apagada** por defecto y esta spec no enciende; y la de consultas de esta pieza, que vive junto al Overpass del proyecto y cuya clave es el texto.

### Frontera de inyección

`packages/nucleo/` no se toca. Lo que se inyecta, para que todo esto se pueda ejercitar en `node --test` sin red y sin contenedor:

- **El transporte de cada eslabón**, para sustituirlo por dobles que responden bien, que responden la página de error XML de cada una de las dos causas, que responden 429, que tardan de más o que responden JSON truncado.
- **La sonda**, para poder poner el servicio en no listo, en listo y en el vaivén entre los dos sin importar nada.
- **El reloj**, usado solo para plazos y para decidir a qué día natural suma un contador; nunca entra en una clave ni en una respuesta.
- **El almacén de caché**, que sin inyectar corre en memoria.

### Escenarios de `docs/testing.md` que esta spec toca

- **«Las coordenadas salen una sola vez, al generar el mapa»**, bloqueante → esta pieza es la que las recibe; el bloque «Lo que el Overpass del proyecto no escribe» es la mitad servidor de esa frase.
- **«El proxy no identifica a nadie»**, bloqueante → la máquina del Overpass es una capa más de las que sirven al proxy, y su registro de accesos apagado es parte de la misma afirmación.
- **«El mundo no depende de OSM después de generarse»** → es lo que acota el daño de que esta pieza falle, y por eso está en «Lo que este Overpass no puede llevarse por delante».
- **«El mundo es una función de la semilla y de los datos de OSM»** → reimportar el extracto cambia los datos de los mapas **nuevos** y de ninguno existente; el escenario sigue siendo cierto porque los datos son parte de la función.

### El hueco ⚠ de la batería, y el escenario que hace falta

RF-INFRA-003 es uno de los quince huecos marcados **⚠ sin escenario** en el PRD (§4.13, riesgo 10). `docs/testing.md` no tiene ni una línea sobre esto, y sin ella la mitad de esta spec es una promesa. **No se toca `docs/testing.md` desde aquí** —no es de `wa-spec`—, así que la propuesta va escrita para que se pueda pegar tal cual cuando alguien la incorpore:

```gherkin
# language: es

@red @privacidad
Característica: El mapa se genera contra el Overpass del proyecto
  Fuente: arquitectura.md, decisión 3 y pendiente 1 · prd.md RNF-PER-001

  Escenario: Un contenedor levantado que no sirve datos no cuenta como listo
    Dado un Overpass del proyecto en marcha con la base de datos vacía
    Cuando se comprueba si está listo
    Entonces la respuesta es que no sirve
    Y ninguna generación se encamina hacia él

  Escenario: La página de error no se toma por datos
    Dado un Overpass que responde con código 200 y una página de error
    Cuando se genera un mapa
    Entonces esa respuesta se descarta
    Y el diagnóstico dice cuál de las dos causas conocidas es

  Escenario: Sin el Overpass del proyecto, el mapa se levanta igual
    Dado el Overpass del proyecto sin servir
    Cuando se genera un mapa
    Entonces la consulta recorre el respaldo público
    Y el mapa se levanta con los mismos datos

  Escenario: Sin ningún origen de datos no se levanta un mundo a medias
    Dado el Overpass del proyecto y el respaldo caídos
    Cuando se genera un mapa
    Entonces no se congela ningún mundo
    Y el jugador puede reintentar sin volver a contestar el onboarding

  Escenario: Una celda fuera del extracto no da un mundo vacío
    Dado una celda fuera de la cobertura del extracto
    Cuando se genera su mapa
    Entonces la consulta va al respaldo y no al extracto
    Y no se genera ningún mundo sin nada anclado

  Escenario: Levantar un mapa tarda menos de un minuto en el mundo más denso
    Dado la celda urbana densa y la caché fría
    Cuando se levanta su mapa contra el Overpass del proyecto
    Entonces el percentil declarado queda por debajo del minuto
    Y el tramo de datos queda por debajo de su presupuesto

  Escenario: El Overpass del proyecto no registra ninguna consulta
    Dado un mes de generaciones
    Cuando se recorre lo que quedó escrito en su máquina
    Entonces no aparece ninguna coordenada
    Y no aparece ninguna dirección de quien llamó
```

Los seis primeros son `@red` y se pasan contra dobles salvo en la campaña de humo; el último es `@red @privacidad` y por tanto **bloqueante** (RNF-DET-003).

### Lo que hace falta añadir al andamiaje

`wa-qa-dev` necesitará dos cosas que SPEC-001 no entregó: **un doble de Overpass con seis modos** —sirve, base de datos ausente, base de datos inalcanzable, 429, plazo agotado y JSON truncado—, con las dos páginas de error XML literales de las dos causas conocidas, que son el dato que separa un diagnóstico útil de uno inútil; y **un cronómetro reproducible** para el tramo de datos sobre las cuatro celdas arquetipo, que es lo que hace de RNF-PER-001 un número comparable entre dos ejecuciones en lugar de una impresión.

## Decisiones asumidas

- **Los criterios de aceptación van en Gherkin español** → asumido, con los mismos `Dado / Cuando / Entonces` de `docs/testing.md` (alternativa: `GIVEN / WHEN / THEN` como pide `spec-instructions.md`). Regla: `CLAUDE.md`, español en todo, y `wa-qa-dev` cruza specs y batería con grep. Precedente: SPEC-001 a SPEC-023.
- **Sin bloque de UX Design ni comportamiento responsive** → asumido por decisión 3 de `pipeline/decisiones-orquestador.md`, y además esta spec no tiene interfaz: lo único que el jugador percibe es la duración de `[flujo: A1P5]` y, en el peor caso, un reintento.
- **La prontitud se decide con una consulta real y un umbral de elementos, no con la presencia de la palabra `elements`** → asumido (alternativa: el criterio actual de `scripts/overpass-setup.sh`, que hace `grep '"elements"'`). Regla: ese grep pasa con la lista vacía, y una lista vacía es exactamente lo que devuelve un extracto que no cubre la zona; el umbral es lo que distingue «contesta» de «sirve».
- **El motivo de fallo de la sonda es un conjunto cerrado y cada valor nombra su arreglo** → asumido (alternativa: propagar el mensaje de error tal cual). Regla: `CLAUDE.md` documenta dos causas con síntoma idéntico y arreglos opuestos —importar horas o cambiar un permiso—; un mensaje sin clasificar deja esa distinción en manos de quien esté mirando a las tres de la mañana.
- **Los mirrors públicos siguen como respaldo, con el orden actual de `server.mjs`** → asumido (alternativas: quitarlos, para que un fallo del propio se note; o poner un segundo Overpass propio). Regla: riesgo 9 del PRD los nombra explícitamente como respaldo degradado; quitarlos convierte una caída en cero mapas nuevos, y un segundo Overpass propio dobla la pieza de infraestructura que el riesgo pide no multiplicar. El contrapeso a que la degradación se vuelva invisible es el recuento por eslabón en la métrica del día.
- **El proxy no arranca sin el destino del Overpass propio configurado** → asumido (alternativa: si no está, ir a los mirrors, que es lo que hace el prototipo). Regla: la caída silenciosa a los mirrors es exactamente el fallo documentado que costó siete horas; el mismo precedente de negarse a arrancar sin un dato obligatorio ya está en SPEC-023 con `TOPE_DIARIO_GASTO` y en SPEC-009 con la versión del formato.
- **El minuto de RNF-PER-001 se mide de A1P4 a A1P6 y se reparte en tres presupuestos** → asumido, con 20 s para datos, 25 s para generación, 10 s para el primer pintado y 5 s de margen (alternativa: medir solo el tramo de red, que es lo que esta spec controla). Regla: RNF-PER-001 es una promesa al jugador y el jugador no ve tramos; repartirlo es lo que impide que tres filas se echen la culpa entre ellas, y cada tramo se mide por separado.
- **La medida es el p95 sobre veinte pasadas por celda, y gobierna la celda urbana densa** → asumido (alternativa: la media sobre las cuatro celdas). Regla: la media esconde la cola, y la cola es justamente lo que hace abandonar un onboarding; la celda densa es la que más datos pide y la que decide.
- **Los tres bloques de una celda —terreno, POIs y callejero— viajan como un solo lote** → asumido (alternativa: tres peticiones encadenadas, que es como lo hace el prototipo). Regla: tres esperas de 8 s encadenadas se comen el presupuesto entero de datos y dejan el minuto en manos del azar; además SPEC-023 declara el esquema de la ruta de generación como «la consulta de terreno y POIs de una celda», en singular.
- **La cobertura del extracto se comprueba antes de consultar, y fuera de ella se va directo al respaldo** → asumido (alternativa: consultar igual y aceptar lo que venga). Regla: un extracto de España devuelve cero elementos en Lisboa con un 200 perfectamente válido; sin la comprobación, el juego generaría un mundo sin nada anclado y lo presentaría como legítimo, que es la forma de fallar que ningún test detecta y que el jugador vive como un juego roto.
- **El extracto sigue sin actualizarse por diffs, con reimportación a demanda** → asumido (alternativa: activar `OVERPASS_DIFF_URL`). Regla: `docker-compose.yml` documenta que el bucle de updates solo dio problemas —las secuencias de replicación de dos proveedores no son intercambiables— y RF-MUNDO-005 hace que la frescura solo afecte a mapas nuevos; la fecha del extracto se declara en la métrica para que el desfase se vea en lugar de suponerse.
- **El texto de la consulta lleva versión declarada y el despliegue no arranca sin ella** → asumido (alternativa: dejarlo como está, un literal en el código). Regla: la clave de caché es el hash del texto, así que un cambio de una letra invalida la caché entera; con versión, el coste se anota en el cambio que lo provoca y se puede cruzar con la consulta literal que cada fixture de SPEC-001 guarda.
- **Cuando no hay ningún origen de datos, el fallo es honesto y reintentable, no silencioso** → asumido (alternativa: aplicar la degradación silenciosa de RNF-RED-001, como con el LLM y las fotos). Regla: sin datos de OSM no hay mundo que levantar; degradar en silencio significaría congelar un mapa vacío, y RF-MUNDO-005 lo haría irreversible. RF-PJ-001 ya exige que el onboarding sea reanudable si la app se cierra durante la generación, así que el camino de vuelta ya está diseñado.
- **La caché de generación del proxy se queda apagada** → asumido, respetando SPEC-023 (alternativa: encenderla ahora que el propio Overpass hace de origen rápido). Regla: `seguridad-privacidad.md` p2 la deja abierta porque en un servidor compartido es un registro de zonas pedidas, y el Overpass propio existe por fricción y ya tiene los datos: encenderla compraría un tiempo que esta spec tiene que conseguir de todos modos.
- **El registro de accesos de todas las capas que sirven al Overpass está apagado y declarado** → asumido (alternativa: dejar el log por defecto de nginx, que es lo normal en operación). Regla: la consulta de generación **contiene las coordenadas del jugador**, que es el único dato real que sale del móvil (RF-PRIV-001); un access log ordinario las escribiría en disco con fecha y con IP, y desmentiría el escenario bloqueante «Las coordenadas salen una sola vez, al generar el mapa» sin que ninguna línea de código pareciera culpable.
