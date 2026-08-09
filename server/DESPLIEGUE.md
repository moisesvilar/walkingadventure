# El proxy ciego: qué escribe, qué no, y qué se puede saber mirando su disco

Documento de despliegue de `server/`. La mitad del valor del proxy está en lo que **no** hace, así que esto no es una guía de operación: es la declaración de su superficie de escritura y de sus consecuencias, incluida la que incomoda.

## Arranque

```
TOPE_DIARIO_GASTO=<n> VERIFICADOR_ATESTACION=<ruta> \
CLAVE_TEXTO=… CLAVE_IMAGEN=… CLAVE_PLACES=… \
URL_TEXTO=… URL_IMAGEN=… URL_PLACES=… \
OVERPASS_PROPIO=http://overpass:80/api/interpreter CONSULTA_VERSION=1 \
node server/arranca.mjs
```

**El proxy no arranca sin `TOPE_DIARIO_GASTO`**, y es deliberado: una clave de API sin tope es la forma conocida de descubrir el presupuesto cuando ya se ha gastado. No hay valor por defecto porque un valor por defecto generoso convertiría una decisión pendiente (`game-design/arquitectura.md` p3) en una factura.

**Tampoco arranca sin `VERIFICADOR_ATESTACION`.** Un verificador que acepta a todo el mundo es un proxy con las claves abiertas.

**Tampoco arranca sin `OVERPASS_PROPIO` ni sin `CONSULTA_VERSION`** (SPEC-024). La alternativa —si no está el propio, a los mirrors públicos— es el fallo documentado que costó siete horas: todo «funcionaba», solo que lentísimo, porque la caída al respaldo era silenciosa. Y la clave de la caché de consultas es el texto literal de la consulta, así que cambiarlo sin subir su versión pierde la caché entera sin que nadie se entere; si el texto y la versión dejan de casar, tampoco arranca. El runbook del origen está en `deploy/overpass/RUNBOOK.md`.

**Y no arranca si algún módulo declara que escribe algo que la superficie no contempla.** El error nombra la entrada y el módulo. Es lo que convierte «no registramos nada» en algo que se puede poner en rojo en lugar de prometerse.

## La superficie de escritura, entera

Seis entradas, y ninguna con una clave derivada de quien llama.

| Entrada | Clave derivada de | Qué guarda | Cuánto vive |
| --- | --- | --- | --- |
| Caché de imágenes | resumen del prompt de ficción y el formato | binario | indefinido |
| Caché de fotos | `place_id` | binario y atribución de Places | indefinido |
| Caché de generación (**apagada por defecto**) | resumen de la consulta de celda | respuesta de Overpass | indefinido |
| Retos de atestación vivos | valor aleatorio del propio reto | nada más que el reto | `VIGENCIA_RETO` |
| Fichas gastadas | la propia ficha | nada más que la ficha | `VIGENCIA_TANDA` |
| Métrica del día | día natural | contadores, histogramas y el recuento de generaciones por eslabón del origen | indefinido |

Los textos del LLM no aparecen: no se cachean. El texto de una aventura ya se guarda con la partida en el móvil y cachearlo aquí añadiría la única categoría de contenido que sí es de alguien en concreto.

`proxy.declaracionDeSuperficie()` la enumera sin leer el código, y `proxy.recorreSuperficie()` recorre lo que hay escrito de verdad.

## Lo que no se escribe nunca

Ninguna dirección IP. Ningún identificador de instalación, de dispositivo o de sesión. Ninguna cabecera del cliente. Ningún identificador de lote. Ninguna marca de tiempo más fina que el día natural. Ninguna entrada por petición con la geografía dentro. Ningún endpoint que reciba sucesos del jugador —anclajes descartados, ajustes, progreso, errores del cliente—: no existe, y una ruta no declarada se rechaza sin escribir nada.

Los diagnósticos de un fallo de aguas arriba llevan la ruta y el tipo de fallo. Ni el cuerpo, ni la clave del proveedor, ni el prompt.

El recuento por eslabón de la métrica del día dice **cuántas** generaciones sirvió cada origen —el propio, cada respaldo, y cuántas no sirvió ninguno—, y ninguna zona. Es lo que hace visible que el respaldo esté trabajando, que si no se nota solo en que todo va lento.

**Al desplegar hay que apagar el registro de conexiones de las capas que sirven el proxy**, y declararlo a propósito en su configuración: el `access_log` del terminador de TLS, el del servidor de aplicación y el del contenedor. El proxy no escribe una línea por petición; una capa por delante que sí lo haga deja escrito exactamente lo que aquí se evita.

## Las dos mitades, y por qué el orden importa

App Attest identifica: su clave atestada tiene un identificador estable por instalación, y Play Integrity tiene la misma forma. Una arquitectura que verificase una aserción en cada llamada tendría delante, en cada llamada, un identificador persistente de instalación.

Por eso el proxy son **dos planos que no se hablan**:

- **El plano de identidad** es una sola ruta, `/atestacion`. Ve la evidencia de la plataforma durante el tiempo de verificarla y **no guarda nada de ella**. Lo único que persiste es la lista de retos vivos, para que una evidencia no valga dos veces.
- **El plano de contenido** son `/texto`, `/imagen`, `/places` y `/generacion`. Reciben una ficha y no reciben nada de la plataforma. Su esquema cerrado no admite ninguna evidencia, ningún identificador de clave atestada y ninguna cabecera de cliente.

Las fichas son **no enlazables** por firma ciega RSA al estilo Privacy Pass: el cliente ciega, el proxy firma sin ver, el cliente desciega. Dos fichas de la misma tanda no muestran que salieron de la misma tanda, y ninguna señala la atestación que la produjo. La caducidad va en la clave de época y no dentro de la ficha, porque una fecha dentro de la ficha sería igual para toda la tanda y la volvería a enlazar; como contrapartida, una ficha vive entre una y dos veces `VIGENCIA_TANDA` según cuándo se emitió.

Consecuencia que conviene ver de frente: **sin identificador persistente no puede haber presupuesto por instalación**. El control de abuso es más tosco —la atestación asegura que la app es la app, los topes por lote cortan los bucles, y el tope diario global acota lo peor que puede pasar—, y quien tenga un dispositivo legítimo puede volver a atestar tantas veces como quiera.

## Sin atestación

`POLITICA_SIN_ATESTACION = solo-cache`. Una llamada sin ficha recibe lo que ya está en la caché —que ya está pagado y es igual para todo el mundo— y **ninguna llamada de pago**. Un atacante con la URL consigue lo que ya teníamos, que no vale nada; un jugador con el móvil rooteado consigue un juego completo con textos de plantilla y sin ilustraciones nuevas. **Ninguna pantalla se lo dice**, porque el cliente no distingue esto de estar sin cobertura.

Esa vía tiene su propia cuota diaria: `CUOTA_VIA_DEGRADADA`, 5 % de las peticiones del día, con un suelo de `FICHAS_POR_TANDA` para que un día recién empezado no responda cero —por debajo de una tanda, la cuota estaría cortando menos de lo que consume una instalación legítima en un día, y no mediría nada—. Al agotarse deja de responder, y el juego sigue comportándose como sin cobertura.

## El coste

La unidad **no es el jugador**: es el **lote de trabajo** —un mapa, una salida—, porque contar por instalación es exactamente el identificador que el diseño descartó. La métrica da dos medidas honestas —coste medio y dispersión por lote de mapa, y lo mismo por lote de salida— y una tercera que no se mide sino que se modela: cuántas salidas juega alguien con un mapa. El coste por jugador es el producto, y `metrica.costePorJugador()` lo devuelve **declarado como modelo**, con su factor supuesto a la vista.

La métrica no baja del día natural. Con poco tráfico, una serie por hora dibuja las sesiones de una persona.

## La caché de generación, y lo que su disco dice

**Viene apagada** (`CACHE_GENERACION = off`). El motivo por el que existe el Overpass propio es la fricción, no el ahorro, y ese Overpass ya tiene dentro los datos, iguales para todo el mundo y sin ninguna relación con la demanda. Cachear encima añade un registro de zonas pedidas a cambio de un tiempo que hay que conseguir de todos modos.

Si al medir hiciera falta encenderla, **esta es la consecuencia, dicha con estas palabras**:

> Con la caché de generación encendida, el disco del servidor contiene un mapa de qué zonas se han jugado. Lo único que añade sobre lo que se puede saber sin ella es esto: **que alguien, alguna vez, generó un mapa en esa zona**. No dice quién, ni cuándo, ni cuántos, ni con qué frecuencia.

Y hay que decirlo entero, porque no está solo en la caché de generación: **la caché de imágenes tiene la misma forma**. El prompt de ficción es una función determinista de la semilla, y la semilla es la coordenada redondeada del mapa. Cualquiera con el generador puede recorrer coordenadas, calcular el prompt que saldría y preguntar a la caché si esa imagen existe. Vale también para las fotos: un `place_id` cacheado dice que alguien generó un mapa que contiene ese sitio.

Lo que el proxy hace al respecto es acotar el oráculo a **un solo bit**:

- sin marca de tiempo en la entrada;
- sin marca de tiempo en el sistema de ficheros (`MTIME_CONSTANTE`, un instante fijo declarado, sobre el fichero y sobre su directorio);
- sin contador de aciertos;
- sin entradas negativas —una llamada que aguas arriba no llegó a devolver no escribe nada—;
- y sin ninguna ruta que enumere, liste o cuente por zonas. Recorrer la caché es una operación de quien opera el servidor, no un endpoint.

**Limitación que se declara en lugar de disimularse:** `utimes` fija acceso y modificación, que es lo que responde un `ls -l`, pero el cambio de inodo (`ctime`) no se puede fijar desde el espacio de usuario en POSIX. Sobre un sistema de ficheros que lo exponga, ahí queda un «cuándo» que el proxy no puede borrar.

**Y lo que no se puede afirmar:** quien opera el servidor ve el tráfico en vivo mientras pasa. La dirección IP correlaciona las llamadas de un lote mientras están en vuelo, y ninguna decisión de código lo evita. Lo que sí se garantiza es que no queda escrito, que el proxy no lo usa para nada y que no sobrevive a la petición.

«El proxy no identifica a nadie» sigue siendo cierto —no hay forma de atar una zona a una persona ni dos llamadas entre sí— y, a la vez, con la caché de generación encendida el disco contiene un mapa de zonas jugadas. Las dos cosas son verdad y la segunda no se esconde.
