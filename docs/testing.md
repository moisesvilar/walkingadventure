# La batería de pruebas

Escenarios en Gherkin escritos **antes de implementar**, para que la implementación tenga contra qué verificarse. Cada uno sale de una decisión cerrada de `game-design/` y la cita; si un escenario y un documento se contradicen, manda el documento y el escenario está mal.

Esto no sustituye a `test/headless.mjs`, que seguirá siendo la red de seguridad del determinismo: la sustituye hacia arriba. Lo de aquí describe **qué tiene que hacer el juego**, no cómo.

## Cómo se lee

**Nivel de ejecución**, en etiquetas, porque decide qué hace falta para pasar un escenario:

- `@nucleo` — se ejecuta en Node contra el paquete compartido, sin dispositivo ni red. Es el grueso y es lo que puede correr en cada commit.
- `@app` — necesita la app con GPS simulado y reloj controlado. Extremo a extremo sobre un mundo fijo.
- `@red` — toca el proxy: LLM, imágenes o Places. Se ejecuta contra dobles salvo en la campaña de humo.
- `@manual` — no se puede automatizar con honestidad: calidad de la prosa, tono, si un chiste tiene gracia. Va en lista de revisión, no en el pipeline.

**Etiquetas de área**: `@determinismo` `@privacidad` `@accesibilidad` `@rumores` `@casting` `@bucle` `@persistencia` `@lenguaje`.

**Las de `@determinismo` y `@privacidad` son bloqueantes.** Una regresión ahí no es un fallo de una pantalla: rompe el invariante del proyecto o saca del móvil algo que no debía salir. Nada se despliega con una de esas en rojo.

## Vocabulario de los pasos

Para que los escenarios se puedan implementar sin inventarse el andamiaje dos veces:

- **«un mundo sembrado con `<semilla>`»** monta un mundo del paquete compartido con datos de OSM congelados de `test/fixtures`.
- **«el jugador camina hasta `<lugar>`»** inyecta posiciones GPS a lo largo de la calzada, a la velocidad del tramo declarado, sin saltos.
- **«el mundo avanza N pasos»** hace avanzar el motor de pasos sin mover al jugador, que es lo que ocurre de verdad cuando camina.
- **«el jugador vuelve a casa»** lo devuelve al punto de partida y deja que el telón se dispare solo.

---

## 1 · Determinismo, que es el invariante del que cuelga todo

```gherkin
# language: es

@nucleo @determinismo
Característica: El mundo es una función de la semilla y de los datos de OSM
  Misma semilla más los mismos datos de OSM dan el mismo mundo, byte a byte.
  Fuente: CLAUDE.md, reglas del proyecto · partida-guardada.md §1

  Escenario: Dos generaciones con la misma semilla dan el mismo mundo
    Dado un mundo sembrado con "42.40,-8.81#1"
    Y otro mundo sembrado con "42.40,-8.81#1" y los mismos datos de OSM
    Cuando se comparan los dos mundos serializados
    Entonces son idénticos byte a byte

  Escenario: Cambiar la semilla cambia el mundo
    Dado un mundo sembrado con "42.40,-8.81#1"
    Y otro mundo sembrado con "42.40,-8.81#2" y los mismos datos de OSM
    Cuando se comparan los dos mundos
    Entonces difieren en los nombres de al menos un núcleo
    Y difieren en la colocación de al menos un paraje

  Escenario: Cada fase usa su propio sufijo de azar
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se cambia la implementación de la fase de parajes sin tocar las demás
    Y se genera otra vez con la misma semilla
    Entonces los núcleos son idénticos a los de antes
    Y las calzadas son idénticas a las de antes

  Escenario: No se usa ninguna fuente de azar ni de tiempo del sistema
    Dado el paquete compartido
    Cuando se generan cien mundos con el reloj del sistema fijado en instantes distintos
    Entonces cada mundo depende solo de su semilla y de sus datos de OSM

  Escenario: El orden de iteración no depende del orden de inserción
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se generan los mismos datos de OSM con los elementos en otro orden de llegada
    Entonces el mundo resultante es idéntico
```

```gherkin
# language: es

@nucleo @determinismo @privacidad
Característica: La semilla es un dato de la partida, no una coordenada
  La semilla lleva al jugador dentro, es corta y copiable, y de ella no se
  puede deducir dónde vive nadie.
  Fuente: alcance-del-mundo.md §1 · seguridad-privacidad.md §1
  Hueco cerrado: RF-MUNDO-002, marcado «⚠ sin escenario» en docs/prd.md §4.1.

  Escenario: Dos vecinos ven mundos distintos
    Dado un jugador que levanta un mapa en "42.40,-8.81"
    Y otro jugador que levanta un mapa en la misma coordenada
    Cuando se comparan los dos mundos
    Entonces difieren en los nombres de al menos un núcleo
    Y difieren en la colocación de al menos un paraje

  Escenario: Una semilla mal copiada se rechaza en vez de generar otro mundo
    Dado un jugador que teclea una semilla con un símbolo cambiado
    Cuando se valida la semilla
    Entonces se rechaza nombrando que no cuadra
    Y no se genera ningún mundo

  Escenario: La semilla no contiene ninguna coordenada
    Dado un mundo levantado en "42.40231,-8.80917"
    Cuando se inspecciona la semilla de la partida
    Entonces no aparece la coordenada exacta del jugador
    Y no aparece la coordenada redondeada del anclaje
```

```gherkin
# language: es

@nucleo @determinismo
Característica: Lo generado no se resiembra jamás
  Crecer es generar otra celda, nunca regenerar la tuya.
  Fuente: bucle-jugable.md §5 · alcance-del-mundo.md §2

  Escenario: Abrir una celda vecina no toca la celda propia
    Dado un mundo con la celda "0,0" ya generada
    Cuando el jugador pisa la celda "1,0" y se genera
    Entonces la celda "0,0" sigue idéntica byte a byte
    Y las dos celdas comparten la costura de calzadas en el borde

  Escenario: Cambiar el tramo del jugador no redimensiona un mundo ya generado
    Dado un mundo generado con un tramo declarado de 2 km
    Cuando el jugador cambia su tramo a 600 m
    Entonces el mundo sigue idéntico byte a byte
    Pero las aventuras que se ofrecen mandan a sitios más cercanos

  Escenario: Cambiar el estilo de pintado no resiembra nada
    Dado un mundo generado y pintado en estilo "reino"
    Cuando se cambia el estilo a "pergamino"
    Entonces el mundo sigue idéntico byte a byte
    Y solo cambian los colores, los grosores y las tipografías
```

```gherkin
# language: es

@nucleo @determinismo @casting
Característica: Los anclajes reales son de uso único
  Un POI real alimenta un núcleo, un servicio o un paraje, nunca dos.
  Fuente: CLAUDE.md, reglas del proyecto · parajes.md

  Escenario: Ningún anclaje aparece dos veces
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se recogen los anclajes de todos los núcleos, servicios y parajes
    Entonces ningún identificador de OSM ni de Places aparece más de una vez

  Escenario: Los parajes reparten lo que los núcleos no gastaron
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se generan los núcleos
    Entonces los anclajes libres que se pasan a los parajes son exactamente los no tomados

  Escenario: Un NPC no consume anclaje propio
    Dado un mundo con una taberna anclada al bar "Casa Manuela"
    Cuando se genera la tabernera que trabaja allí
    Entonces la tabernera hereda el anclaje de la taberna
    Y el número de anclajes tomados no cambia
```

```gherkin
# language: es

@nucleo @determinismo
Característica: Los nombres son únicos y del idioma del sitio
  Fuente: CLAUDE.md, arquitectura · quests.md decisión 1

  Escenario: No hay dos nombres iguales en un mundo
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se recogen los nombres de núcleos, servicios, parajes y calzadas
    Entonces no hay ninguno repetido

  Esquema del escenario: El idioma sale de la ubicación
    Dado un mundo sembrado en <lat>,<lon>
    Cuando se generan los nombres
    Entonces salen del paquete de idioma "<idioma>"

    Ejemplos:
      | lat   | lon   | idioma |
      | 42.40 | -8.81 | gl     |
      | 39.86 | -4.02 | es     |

  Escenario: Un nombre propuesto por el LLM solo se adopta si pasa validación
    Dado un mundo con un paraje llamado "O Fuso da Vella"
    Cuando el LLM propone el nombre "O Fuso da Vella" para otro elemento
    Entonces se descarta por chocar con el índice global de nombres
    Y el elemento conserva el nombre del paquete de idioma
```

---

## 2 · Cupos, cobertura y el barrio de tres calles

```gherkin
# language: es

@nucleo @casting
Característica: El mundo de una celda es jugable por construcción
  El cupo de parajes tiene un suelo derivado del catálogo, no elegido a ojo.
  Fuente: parajes.md · parametros-mundo.md

  Escenario: El suelo de parajes cubre el vocabulario de escenas
    Dado el catálogo de plantillas actual
    Cuando se cuentan las escenas distintas que piden sus roles
    Y se dividen entre las escenas que lleva un paraje
    Entonces el cupo mínimo de parajes por celda es mayor o igual a ese cociente

  Escenario: El cupo por ritmo es un techo, no un objetivo
    Dado un mundo de celda pequeña con anclajes de sobra
    Cuando se generan los parajes
    Entonces su número está entre el suelo derivado y el techo por ritmo

  Escenario: La cobertura de escenas manda sobre la afinidad del anclaje
    Dado un mundo donde ningún anclaje real tiene afinidad con "vigilancia"
    Cuando se generan los parajes
    Entonces existe al menos un paraje con escena de vigilancia
    Y su anclaje real puede ser cualquier cosa, incluido un bar

  Escenario: Un tag masivo no monopoliza un tipo de paraje
    Dado un mundo cuyos datos de OSM traen cincuenta fuentes de agua potable
    Cuando se generan los parajes
    Entonces ninguna fuente de agua potable se usa como anclaje
    Y los tipos de paraje siguen repartidos

  Escenario: El mundo mínimo todavía compone un lazo
    Dado un mundo generado con un radio de 250 m
    Cuando se castea el catálogo de plantillas
    Entonces al menos una plantilla castea con un lazo cerrado
```

```gherkin
# language: es

@nucleo @casting
Característica: El callejero troceado de OSM se cose antes de trazar
  Fuente: CLAUDE.md, trampas conocidas · routes.js

  Escenario: Los huecos cortos se cosen
    Dado un callejero con dos componentes separadas por 40 m
    Cuando se construyen las rutas
    Entonces quedan conectadas por una arista cosida

  Escenario: Los huecos largos no se cosen
    Dado un callejero con dos componentes separadas por 400 m
    Cuando se construyen las rutas
    Entonces no se cosen entre sí

  Escenario: Lo cosido y lo inventado queda marcado
    Dado un mundo con aristas cosidas y con tramos "fallback"
    Cuando se inspecciona el grafo
    Entonces cada arista que no existe en OSM lleva su marca de suposición
```

---

## 3 · El tramo, la accesibilidad y el vehículo

```gherkin
# language: es

@nucleo @accesibilidad
Característica: El tramo es una unidad personal y se corrige midiendo
  Fuente: accesibilidad.md §1

  Escenario: Dos jugadores con tramos distintos reciben aventuras del mismo tamaño en pasos
    Dado un jugador con un tramo de 2 km
    Y otro jugador con un tramo de 600 m
    Cuando cada uno acepta una aventura de tamaño "paseo"
    Entonces las dos tienen el mismo número de beats
    Pero la distancia real de la segunda es aproximadamente la tercera parte

  Escenario: El tramo se ajusta con lo andado
    Dado un jugador con un tramo declarado de 2 km
    Cuando completa cinco salidas andando de media 1,2 km por media hora
    Entonces su tramo estimado baja hacia 1,2 km

  Escenario: El ajuste no se comenta nunca
    Dado un jugador cuyo tramo acaba de bajar
    Cuando abre la app y recorre todas las pantallas
    Entonces ningún texto menciona que ande menos ni que su tramo haya cambiado

  Escenario: Las paradas no cuentan para medir el ritmo
    Dado un jugador andando a 4 km/h
    Cuando se para veinte minutos a tomar un café
    Y sigue andando a 4 km/h
    Entonces su ritmo medido sigue siendo 4 km/h
```

```gherkin
# language: es

@app @accesibilidad
Característica: El vehículo se aparta del reloj del mundo y de la validación
  Fuente: bucle-jugable.md §9 · accesibilidad.md pendiente 1

  Escenario: Un viaje en tren no hace avanzar el mundo
    Dado un jugador con una salida abierta
    Cuando se desplaza 30 km a 90 km/h
    Entonces el motor de pasos no ha avanzado ningún paso

  Escenario: Pasar en coche por delante de un beat no lo valida
    Dado un beat en "O Torreón Esquecido"
    Cuando el jugador atraviesa su geofence a 50 km/h
    Entonces el beat sigue sin validar

  Escenario: En la duda, cuenta
    Dado un jugador cuya velocidad es ambigua entre andar deprisa y otra cosa
    Cuando recorre 800 m
    Entonces esos metros cuentan para el motor de pasos
    Y los geofences que atraviesa se validan

  Escenario: La medición del tramo sí excluye la velocidad ambigua
    Dado un jugador cuya velocidad es ambigua durante 800 m
    Cuando se recalcula su tramo
    Entonces esos 800 m no entran en la media

  Escenario: Volver a casa en autobús echa el telón igual
    Dado un jugador con una salida abierta a 6 km de casa
    Cuando vuelve a casa en autobús
    Entonces el telón se echa
    Pero esos kilómetros no han hecho avanzar el mundo
```

```gherkin
# language: es

@nucleo @accesibilidad
Característica: El filtro sobre el grafo evita y declara, nunca borra
  Fuente: accesibilidad.md §2

  Escenario: El trazado rodea lo que el filtro evita
    Dado un jugador que ha marcado que evita escalones
    Y un mundo donde el camino corto pasa por unas escaleras
    Cuando se traza el lazo de una aventura
    Entonces la ruta no pasa por las escaleras
    Y las escaleras siguen existiendo y dibujadas en el mapa

  Escenario: El camino evitado se declara con nombre propio
    Dado el escenario anterior
    Cuando el jugador llega al punto donde la ruta rodea
    Entonces el juego nombra el camino evitado y dice por qué
    Y no aparece la palabra "accesibilidad" en ningún texto

  Escenario: Lo que nos inventamos no se promete como transitable
    Dado un jugador con cualquier filtro activo
    Cuando se traza un lazo
    Entonces ninguna arista cosida ni ningún tramo "fallback" se da por apto

  Escenario: Si el filtro deja el mundo sin reparto, se ofrece el estirón
    Dado un mundo donde el filtro deja menos de un lazo posible
    Cuando el jugador pide aventuras
    Entonces el juego dice que por aquí cerca no hay hoy gran cosa que contar
    Y ofrece alejarse un tramo más
    Pero no lo impone
```

---

## 4 · El reloj del mundo

```gherkin
# language: es

@nucleo @rumores
Característica: El mundo avanza con los kilómetros del jugador, no con el calendario
  Fuente: quests.md decisión 4

  Escenario: Un tramo andado es un paso del mundo
    Dado un jugador con un tramo de 2 km y una salida abierta
    Cuando anda 6 km
    Entonces el mundo ha avanzado tres pasos

  Escenario: El contenido de un paso lo decide su número
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se ejecuta el paso número 7 dos veces desde cero
    Entonces las dos ejecuciones producen exactamente lo mismo

  Escenario: Estar un mes sin salir no acumula mundo pendiente
    Dado un jugador que ha andado 0 km en treinta días
    Cuando abre la app
    Entonces el mundo no ha avanzado ningún paso

  Escenario: La reserva de pasos de fondo tiene tope de cinco
    Dado un jugador con el modo de pasos de fondo activado
    Cuando acumula kilómetros equivalentes a doce pasos sin salir
    Entonces la reserva contiene cinco pasos
    Y el contador del mundo ha avanzado cinco, no doce

  Escenario: Los metros que la app de salud da al abrir llenan la reserva del mapa activo
    Dado un jugador con el modo de pasos de fondo activado y metros nuevos desde la última lectura
    Cuando abre la app
    Entonces esos metros se convierten en pasos con su tramo personal
    Y los pasos quedan en la reserva del mapa activo
    Y la reserva del otro mapa de la partida no se toca

  Escenario: Sin mapa levantado no se acredita ningún metro
    Dado un jugador cuya partida no tiene ningún mapa levantado
    Cuando abre la app con el modo de pasos de fondo activado
    Entonces no se monta ningún motor de pasos
    Y no se acredita ningún metro
    Y se declara por qué no se pudo

  Escenario: Un paso solo añade
    Dado un mundo en el paso 40
    Cuando se ejecutan diez pasos sin que el jugador actúe
    Entonces no ha caducado ninguna aventura
    Y no se ha retirado ningún NPC
    Y ningún rango ha bajado
```

---

## 5 · Rumores: propagación, deformación y diario

```gherkin
# language: es

@nucleo @rumores
Característica: El rumor nace donde ocurrió y viaja por el árbol de calzadas
  Fuente: quests.md §6

  Escenario: Nace fiel y en el sitio
    Dado un desenlace notable en "Monfrida"
    Cuando se cierra la salida
    Entonces existe un rumor en "Monfrida" en nivel 0
    Y no existe en ningún otro núcleo

  Esquema del escenario: Avanza un tramo por paso del mundo
    Dado un rumor en "Monfrida" y un núcleo vecino a dos tramos por calzada
    Cuando el mundo avanza <pasos> pasos
    Entonces el rumor <ha_llegado> al vecino

    Ejemplos:
      | pasos | ha_llegado |
      | 1     | no ha llegado |
      | 2     | ha llegado    |

  Escenario: El jugador se puede adelantar a su propia fama
    Dado un rumor recién nacido en "Monfrida"
    Cuando el jugador va derecho al núcleo vecino sin entretenerse
    Entonces llega a la vez que la noticia o antes

  Esquema del escenario: La deformación cuenta saltos, no kilómetros
    Dado un rumor nacido en "Monfrida"
    Cuando llega a un núcleo a <saltos> saltos por calzada real
    Entonces su nivel es <nivel>

    Ejemplos:
      | saltos | nivel |
      | 0      | 0     |
      | 1      | 1     |
      | 2      | 2     |
      | 3      | 3     |
      | 5      | 3     |

  Escenario: Cruzar un tramo sin calzada real cuesta un nivel más
    Dado un rumor nacido en "Monfrida"
    Cuando llega a un núcleo a un salto, cruzando un tramo "fallback"
    Entonces su nivel es 2

  Escenario: Dos núcleos a la misma distancia pueden recibir versiones distintas
    Dado dos núcleos a 6 km de "Monfrida"
    Y que al primero se llega por dos aldeas intermedias y al segundo directo
    Cuando el rumor alcanza a los dos
    Entonces el primero lo recibe más deformado que el segundo

  Escenario: La deformación no invierte el signo moral
    Dado un desenlace en el que el jugador ayudó a alguien
    Cuando el rumor llega a nivel 3
    Entonces la versión sigue siendo de un acto bueno
    Pero pueden cambiar la escala, el protagonista o el detalle

  Escenario: El rumor se agota solo
    Dado un rumor nacido en "Monfrida"
    Cuando el mundo avanza cincuenta pasos
    Entonces el rumor ya no viaja
    Y ha sedimentado en lo que se cuenta en cada núcleo que lo oyó
```

```gherkin
# language: es

@app @rumores
Característica: El diario registra lo oído, no lo cierto
  Fuente: quests.md decisión 3 · artefacto 5, artefacto 6

  Escenario: Se guarda la versión deformada
    Dado un rumor que llega a "Monfrida" en nivel 1, hablando de tres campanas
    Cuando el jugador llega a "Monfrida"
    Entonces su diario guarda la versión de tres campanas
    Y guarda el lugar y el momento en que la oyó

  Escenario: Una entrada no se sobrescribe con otra más veraz
    Dado un diario con la versión de tres campanas oída en "Monfrida"
    Cuando el jugador oye en "Vilanova" la versión fiel, de una campana
    Entonces el diario contiene las dos entradas
    Y ninguna se marca como correcta

  Escenario: El nivel de deformación no sale nunca a pantalla
    Dado un diario con versiones de niveles 0, 1 y 3
    Cuando el jugador recorre el diario entero, por días y por historias
    Entonces ninguna entrada muestra un nivel, un porcentaje ni una etiqueta de fiabilidad

  Escenario: El testigo directo es fiel y no corrige al pueblo
    Dado un NPC que estuvo presente cuando ocurrió
    Y un rumor deformado circulando por su núcleo
    Cuando el jugador habla con ese NPC
    Entonces el NPC cuenta la versión fiel
    Pero lo que se cuenta en el núcleo sigue siendo la versión deformada
```

```gherkin
# language: es

@app @rumores
Característica: Triangular se descubre jugando y luego se facilita
  Fuente: quests.md decisión 3 · artefacto 6

  Escenario: Al principio el diario solo se lee por días
    Dado un jugador que nunca ha oído dos versiones de lo mismo
    Cuando abre el diario
    Entonces solo puede leerlo por días
    Y no existe ninguna vista por historias

  Escenario: La primera coincidencia se pone en escena
    Dado un jugador con la versión de tres campanas apuntada
    Cuando llega a un núcleo donde se cuenta otra versión de lo mismo
    Entonces el juego enseña las dos versiones juntas
    Y no explica en ningún texto que las noticias se deforman
    Y no dice cuál de las dos es la buena

  Escenario: A partir de ahí se abre la vista por historias
    Dado un jugador que acaba de triangular por primera vez
    Cuando abre el diario
    Entonces puede leerlo por días o por historias
    Y las versiones de un mismo suceso aparecen agrupadas

  Escenario: Las versiones se ordenan por cuándo se oyeron
    Dado tres versiones de un suceso, oídas en los días 22, 23 y 29
    Cuando el jugador las mira en la vista por historias
    Entonces aparecen en el orden 22, 23, 29
    Y no en orden de fidelidad
```

---

## 6 · Las quests: casting, estructura y frontera con el LLM

```gherkin
# language: es

@nucleo @casting
Característica: Una quest se castea contra el mundo o no se ofrece
  Fuente: quests.md §7 · casting.js

  Escenario: Una plantilla sin candidatos no se ofrece
    Dado un mundo sin ningún paraje con escena de guarida
    Cuando se castea una plantilla que pide una guarida
    Entonces la plantilla no se ofrece
    Y el motivo del fallo queda explicado

  Escenario: El casting no mira lo descubierto
    Dado un jugador que no ha pisado ningún paraje
    Cuando se castean las plantillas
    Entonces castean igual que si los hubiera pisado todos

  Escenario: El casting es determinista
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se castea el catálogo dos veces
    Entonces las dos veces salen las mismas plantillas con el mismo reparto

  Escenario: Todo lazo casteado se cierra
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se castean todas las plantillas que casteen
    Entonces cada una empieza y termina cerca del punto de partida del jugador

  Esquema del escenario: El presupuesto de beats sale del tamaño declarado
    Dado una aventura de tamaño "<tamaño>"
    Cuando se castea
    Entonces tiene entre <min> y <max> beats
    Y ningún tramo entre beats supera media hora al ritmo del jugador

    Ejemplos:
      | tamaño   | min | max |
      | paseo    | 4   | 6   |
      | aventura | 6   | 10  |
      | jornada  | 10  | 14  |

  Escenario: El oficio filtra el catálogo
    Dado un jugador con oficio "buhonera"
    Cuando se listan las aventuras disponibles
    Entonces todas declaran afinidad con "buhonera"
    Y existe al menos una plantilla del catálogo que no aparece nunca con este oficio

  Escenario: Fallar por no llegar es casi imposible
    Dado una aventura aceptada
    Cuando el jugador tarda el triple de lo previsto en llegar a cada beat
    Entonces ningún beat se pierde por tiempo
```

```gherkin
# language: es

@nucleo @determinismo
Característica: El árbitro es el código y el narrador es el LLM
  Fuente: quests.md decisión 1

  Escenario: Con LLM y sin LLM la estructura es idéntica
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se genera una aventura con el LLM disponible
    Y se genera la misma aventura sin red
    Entonces las dos tienen el mismo casting
    Y los mismos beats en el mismo orden
    Y las mismas cantidades de oro y los mismos objetos
    Y el mismo lazo
    Pero los textos difieren

  Escenario: El modelo no escribe ningún dato vivo
    Dado una respuesta del LLM que incluye un campo "oro" con valor 500
    Cuando se aplica la respuesta a la aventura
    Entonces el oro de la aventura es el que fijó la plantilla
    Y el campo del modelo se descarta sin interpretarse

  Escenario: Lo que llega fuera del esquema se descarta
    Dado una respuesta del LLM con un campo desconocido
    Cuando se valida contra el esquema
    Entonces el campo se descarta
    Y no se registra ningún error visible para el jugador

  Escenario: Un texto que no pasa el filtro cae al fallback
    Dado una respuesta del LLM con contenido no apto para menores
    Cuando se valida
    Entonces se usa el texto de plantilla
    Y la aventura funciona igual

  Escenario: Sin red, la aventura funciona entera
    Dado un mundo y una aventura aceptada
    Cuando no hay conexión en ningún momento
    Entonces todos los textos salen de plantilla
    Y la aventura se puede completar de principio a fin
```

```gherkin
# language: es

@nucleo @casting
Característica: Un beat sobre un rol humano ocurre donde esa persona trabaja
  La cara añade quién habla, no dónde. Es el pendiente 1 de npcs.md, ratificado el 13-ago-2026.
  Fuente: npcs.md pendiente 1 · quests.md §2 §5

  Escenario: Ninguna comprobación del casting se salta un beat humano por no encontrar su lugar
    Dado una plantilla con un beat sobre un rol humano
    Cuando el casting comprueba el lazo, los trechos y el recorrido
    Entonces ese beat tiene lugar resuelto en las tres
    Y ninguna se lo salta por no encontrarlo

  Escenario: Un beat pegado al beat de su propio sitio no cae en trecho-por-debajo-del-minimo
    Dado un beat sobre un rol humano contiguo al beat del sitio donde esa persona trabaja
    Cuando se comprueba el trecho que los separa
    Entonces el par queda exento igual que dos beats sobre el mismo rol
    Y el motivo "trecho-por-debajo-del-minimo" no aparece

  Escenario: Dos roles humanos del mismo sitio caen en el mismo lugar y eso no impide castear
    Dado una plantilla con dos roles humanos que trabajan en el mismo sitio
    Cuando se castea
    Entonces las dos caras caen en el mismo lugar
    Y eso no cuenta como dos roles distintos compartiendo sitio

  Escenario: El catálogo con caras castea exactamente igual que el mismo catálogo sin ellas
    Dado los cuatro mundos de referencia
    Cuando se castea el catálogo y el mismo catálogo con cada beat humano devuelto a su sitio
    Entonces las dos versiones dan el mismo veredicto en las ciento veinte
    Y la misma cadena de sitios beat a beat

  Escenario: La marca del mapa, la ilustración y el núcleo por el que pasa una aventura son los del sitio
    Dado un beat sobre un rol humano que trabaja en un servicio
    Cuando se compone su guiado, se piden sus recursos y se pregunta por qué núcleo pasa la aventura
    Entonces la marca cae en las coordenadas del sitio
    Y la ilustración que se pide es la del sitio
    Y la aventura pasa por el núcleo al que pertenece ese servicio

  Escenario: Una aventura que termina sobre una cara pone el desenlace en el portal y recuerda a quien estaba
    Dado una aventura terminada cuyo último beat cae sobre un rol humano
    Cuando se compone su desenlace
    Entonces el desenlace ocurre en el sitio donde esa persona trabaja
    Y esa cara está entre las que recuerdan lo que pasó
```

```gherkin
# language: es

@nucleo @casting @determinismo
Característica: Los beats con cara salen de dos reglas del catálogo, no de una lista
  Una plantilla que declare un acto sobre una cara entra sola en el alcance: una lista sin regla es la pieza que al no estar no protesta.
  Fuente: npcs.md §1 · quests.md §5

  Escenario: Las dos cláusulas eligen los veintiún beats medidos, en diecinueve plantillas
    Dado el catálogo de plantillas actual
    Cuando se aplican las dos cláusulas
    Entonces caen sobre un rol humano veintiún beats repartidos en diecinueve plantillas
    Y las veinte plantillas que declaran un rol humano siguen siendo veinte

  Escenario: Las dos cláusulas eligen los mismos beats en dos pasadas, y son idempotentes
    Dado el catálogo de plantillas actual
    Cuando se aplican las dos cláusulas dos veces seguidas
    Entonces eligen exactamente los mismos beats
    Y el orden con el que eligen sale del orden declarado de la plantilla y nunca de recorrer sus roles

  Escenario: Poner las caras no toca ni la escena, ni el disparador, ni el resultado, ni el orden
    Dado cualquier beat que pase a caer sobre un rol humano
    Cuando se compara con el mismo beat antes de moverlo
    Entonces su escena, su disparador y su resultado son los mismos
    Y lo único que cambia es sobre qué rol cae

  Escenario: Toda cara con acto de relación declarado pone al menos una cara en la cadena
    Dado una plantilla que declara un acto de relación sobre un rol humano
    Cuando se castea
    Entonces ese rol pone al menos una cara en la cadena de beats

  Escenario: Una decisión con acto de relación sobre una cara compone el desenlace entero
    Dado una aventura terminada en la que se tomó una decisión con acto de relación sobre una cara
    Cuando se compone su desenlace
    Entonces el acto se aplica a esa cara
    Y el desenlace se compone entero en lugar de fallar por no encontrarla

  Escenario: Una plantilla que abre y cierra en sitios de tipo distinto no carga, y lo dice nombrando los dos roles
    Dado una plantilla cuyo primer y último beat caen en sitios de tipo distinto
    Cuando se comprueba el catálogo al cargarse
    Entonces falla nombrando la plantilla y los dos roles

  Escenario: Veintiún beats del catálogo caen sobre un rol humano, y sus escenas tienen cara
    Dado los cuatro mundos de referencia
    Cuando se castea el catálogo entero y se recorren los beats
    Entonces sesenta y nueve de los quinientos seis caen sobre un rol humano
    Y la escena de cada uno de ellos trae quien habla
```

---

## 7 · El bucle: los cuatro momentos

```gherkin
# language: es

@app @bucle @privacidad
Característica: El permiso de ubicación se pide una vez y denegarlo no es un problema
  Fuente: seguridad-privacidad.md §1 §2 · lenguaje.md · artefacto 1 pantallas 3 y 4

  Escenario: Conceder el permiso deja la marca donde la puso el sensor
    Dado un jugador en la pantalla del permiso de una instalación limpia
    Cuando pulsa "Permitir" y concede
    Entonces pasa a elegir dónde se levanta el mapa
    Y la marca está en la posición que entregó el sensor
    Y el origen del punto queda anotado como concedido

  Escenario: Denegar el permiso sigue por la vía manual sin llamarlo problema
    Dado un jugador en la pantalla del permiso
    Cuando pulsa "Permitir" y deniega
    Entonces pasa a elegir dónde se levanta el mapa igual
    Y la marca está en el punto por defecto
    Y no aparece ninguna pantalla intermedia
    Y ningún texto lo llama error

  Escenario: No poder preguntar el permiso se queda en la pantalla y lo dice
    Dado un jugador en la pantalla del permiso y un sistema que falla al preguntar
    Cuando pulsa "Permitir"
    Entonces se queda en la pantalla del permiso
    Y ve el motivo literal del fallo
    Y no pasa a la siguiente como si hubiera denegado

  Escenario: Sin módulo de ubicación "Permitir" sale apagado y la vía manual queda entera
    Dado una compilación que no trae el módulo de ubicación
    Cuando el jugador abre la pantalla del permiso
    Entonces "Permitir" está apagado con su motivo a la vista
    Y la vía de elegir el punto a mano llega hasta el final

  Escenario: El diálogo del sistema no ofrece la ubicación permanente
    Dado un jugador en la pantalla del permiso
    Cuando pulsa "Permitir" y el sistema pregunta
    Entonces el diálogo ofrece la ubicación mientras se usa la app
    Y no ofrece ninguna opción de ubicación permanente
```

```gherkin
# language: es

@nucleo @bucle @privacidad
Característica: La cadena del sensor de una salida es una y va en orden
  Fuente: seguridad-privacidad.md §2 · bucle-jugable.md §8 · accesibilidad.md §3

  Escenario: Una salida abierta tiene una sola suscripción al sensor
    Dado un jugador que echa a andar
    Cuando se cuentan las suscripciones al sensor
    Entonces hay exactamente una
    Y de ella cuelgan la fuente de posiciones y el seguidor

  Escenario: De cada posición del sensor sobreviven cuatro campos
    Dado un módulo de ubicación que entrega precisión, rumbo, altitud y velocidad
    Cuando la posición entra en la app
    Entonces solo se copian la latitud, la longitud, la marca y la precisión
    Y una lectura sin precisión declarada la deja sin saber y nunca en cero

  Escenario: La posición llega al seguidor ya clasificada
    Dado una salida abierta con el detector de transporte montado
    Cuando el seguidor entrega una posición
    Entonces viene clasificada en andando, parada, vehículo o ambiguo
    Y la clasificación la produjo el detector y no la pantalla

  Escenario: Tras una interrupción la traza se vuelve a anclar
    Dado una salida abierta que lleva un rato sin recibir posiciones
    Cuando llega la primera posición nueva
    Entonces no forma tramo con la última de antes de la interrupción

  Escenario: Sin permiso de ubicación no se abre ninguna salida
    Dado un jugador con el permiso de ubicación denegado
    Cuando echa a andar
    Entonces la salida no se abre
    Y se dice que sin punto de partida no hay regreso que detectar

  Escenario: Una salida que se cierra deja el sensor sin nadie leyendo
    Dado una salida abierta que se cierra por cualquiera de sus vías
    Cuando se mira el sensor
    Entonces la suscripción queda retirada
```

```gherkin
# language: es

@nucleo @bucle
Característica: Una sola cota de frescura para el fijo que ancla el punto de partida
  Lo que ancla el punto de partida es un fijo, no la puerta por la que entró. Aplicarle rasero distinto según venga de la puntual o de la última conocida es el defecto, no la excepción.
  Fuente: bucle-jugable.md §8 · seguridad-privacidad.md §2

  Escenario: Los cuatro números de la apertura están declarados con su motivo y en un solo sitio
    Dado la cota de frescura, el tope de espera, la precisión exigida y el plazo de re-anclaje
    Cuando se busca dónde están escritos
    Entonces cada uno aparece una sola vez y con su motivo al lado
    Y la app los recibe del paquete en lugar de llevar su propia copia

  Escenario: Con la puntual dentro de la cota ancla ella y el origen queda anotado
    Dado un jugador que echa a andar con el permiso concedido
    Cuando el fijo puntual llega con la marca dentro de la cota
    Entonces la salida se abre con ese fijo
    Y el origen del punto de partida queda anotado como la puntual

  Escenario: Con la puntual rancia ancla la última conocida, y el respaldo abre la salida
    Dado un fijo puntual cuya marca es más vieja que la cota
    Y una última posición conocida que sí la cumple
    Cuando se decide con qué anclar
    Entonces el fijo puntual se descarta igual que se descartaría una última conocida vieja
    Y la salida se abre con la última conocida
    Y el origen del punto queda anotado como la última conocida

  Escenario: Sin fijo puntual, la salida se abre con la última posición conocida
    Dado un proveedor que no entrega ningún fijo puntual antes del tope
    Y una última posición conocida dentro de la cota
    Cuando el jugador echa a andar
    Entonces la salida se abre
    Y la última conocida se pidió con la edad máxima y la precisión exigida escritas

  Escenario: Un fijo sin marca, sin precisión o con la precisión peor que la exigida no ancla
    Dado un fijo al que le falta la marca de tiempo, o la precisión, o la trae peor que la exigida
    Cuando se decide si puede anclar el punto de partida
    Entonces se descarta
    Y da igual por cuál de las dos puertas haya entrado

  Escenario: Sin ninguna posición dentro de la cota no se ancla, y el motivo lo dice
    Dado un aparato cuyo único fijo conocido es de hace veinticinco horas
    Cuando el jugador echa a andar
    Entonces la salida no se abre
    Y el motivo dice que sin una posición no hay punto de partida
    Y ninguna cota razonable acepta ese fijo

  Escenario: La cota, el tope y la precisión llegan del paquete y no de una copia de la app
    Dado el código de la app
    Cuando se buscan los números de la apertura
    Entonces no hay ninguna constante propia que los repita
    Y la precisión con la que se pide la puntual sale del mismo sitio que la de la suscripción

  Escenario: El motivo se decide consultando el permiso y no el texto de la excepción
    Dado el permiso concedido y un proveedor que lanza al pedir el fijo
    Cuando se decide por qué no se abrió la salida
    Entonces el motivo sale del estado del permiso
    Y no dice que el permiso esté denegado

  Escenario: La línea que se lee mientras se busca no lleva ninguna cifra
    Dado la línea que se enseña mientras se busca la posición
    Cuando se lee
    Entonces dice que se está buscando dónde estás
    Y no lleva barra, ni porcentaje, ni cuenta atrás, ni ninguna cifra
```

```gherkin
# language: es

@nucleo @bucle @privacidad
Característica: El punto de partida se re-ancla una vez y después es inmutable
  La cota puede ser generosa porque el residuo lo paga el re-anclaje; y mover «casa» a mitad de salida cambia el sitio al que hay que volver bajo los pies de quien vuelve.
  Fuente: bucle-jugable.md §8 · seguridad-privacidad.md §2 · partida-guardada.md §2

  Escenario: El primer fijo bueno dentro del plazo sustituye el punto de partida
    Dado una salida abierta con el punto de partida anclado
    Cuando llega el primer fijo con precisión suficiente y dentro del plazo
    Entonces el punto de partida pasa a ser ese fijo
    Y el punto anterior no queda guardado en ninguna parte

  Escenario: El re-anclaje ocurre como mucho una vez por salida
    Dado una salida que ya se re-ancló
    Cuando llega otro fijo mejor todavía dentro del plazo
    Entonces el punto de partida no se mueve

  Escenario: Un fijo bueno que llega pasado el plazo no mueve el punto de partida
    Dado una salida abierta cuyo primer fijo bueno llega pasado el plazo
    Cuando llega
    Entonces el punto de partida sigue siendo el de la apertura

  Escenario: Después de alejarse el punto de partida es inmutable
    Dado una salida que ya se declaró alejada
    Cuando llega cualquier fijo
    Entonces el punto de partida no se re-ancla por ninguna vía

  Escenario: El re-anclaje no distingue por el origen del punto
    Dado una salida abierta con el punto de partida anclado por la puntual
    Cuando llega el primer fijo bueno dentro del plazo
    Entonces se re-ancla igual que si el punto hubiera venido de la última conocida

  Escenario: Los cuatro campos del anclaje mueren con la salida
    Dado una salida re-anclada, cerrada y con el telón leído
    Cuando se abre otra salida
    Entonces el origen, la marca de re-anclaje, el desplazamiento y el desfase ya no están
    Y ninguno de los cuatro era una coordenada ni una marca de reloj

  Escenario: El re-anclaje no lee el reloj: resta dos marcas del sensor
    Dado el cálculo de la antigüedad con la que se decide re-anclar
    Cuando se mira de dónde sale el tiempo
    Entonces sale de restar la marca del fijo nuevo y la del punto de partida
    Y el paquete no consulta ningún reloj propio
```

```gherkin
# language: es

@nucleo @bucle
Característica: El punto de partida cuenta para la cadencia del sensor y para nada más
  Estando quieta con cadencia por distancia no llega ni un fijo, así que la permanencia del regreso no acumula y el telón no puede caer. Y el portal de casa sigue sin ser un sitio al que se llega.
  Fuente: bucle-jugable.md §8

  Escenario: En el punto de partida la cadencia es por tiempo aunque no haya ningún geofence debajo
    Dado una salida abierta y el jugador en el punto de partida
    Cuando se pide la cadencia del muestreo
    Entonces es por tiempo
    Y lo es aunque no haya ningún sitio del mundo debajo

  Escenario: En el punto de partida de los ocho mundos de referencia la cadencia es por tiempo
    Dado los ocho mundos de referencia
    Cuando se pide la cadencia en el punto de partida de cada uno
    Entonces sale por tiempo en los ocho
    Y no en seis, que es lo que salía cuando dependía del trazado

  Escenario: La cadencia decidida por el punto de partida no nombra ningún sitio y declara su razón
    Dado una cadencia por tiempo decidida por el punto de partida
    Cuando se lee lo que devuelve la decisión
    Entonces no nombra ningún sitio
    Y declara que la razón es el punto de partida

  Escenario: El radio de casa es el del regreso, y alejarse devuelve la cadencia por distancia
    Dado un jugador que se aleja del punto de partida
    Cuando pasa del radio del regreso más el margen de cercanía
    Entonces la cadencia vuelve a ser por distancia
    Y el radio que se usó es el del regreso y no el de geofence

  Escenario: La histéresis de casa es la misma que la de un sitio
    Dado una posición en el borde del radio del regreso que entra y sale por el ruido del fijo
    Cuando se decide la cadencia en cada muestra
    Entonces no cambia de cadencia en cada una

  Escenario: Dentro de un geofence y cerca de casa a la vez, el sitio nombrado es el sitio real
    Dado una posición dentro del geofence de un sitio y cerca del punto de partida
    Cuando se decide la cadencia
    Entonces sale por tiempo una sola vez
    Y el sitio nombrado es el sitio del mundo

  Escenario: Sin salida abierta la cadencia se decide solo con los geofences y no falla
    Dado una partida sin ninguna salida abierta
    Cuando se pide la cadencia
    Entonces se decide con los geofences del mapa activo
    Y no falla por no haber punto de partida
    Y el punto de partida entra por la firma de la decisión y no al índice de sitios
```

```gherkin
# language: es

@app @bucle
Característica: La apertura de una salida se ve desde el aparato
  Lo que solo se ve con la app delante: que la espera se diga y no se quede puesta, y de qué puerta salió el punto de partida.
  Fuente: bucle-jugable.md §8 · lenguaje.md

  Escenario: La espera de la posición se dice y desaparece siempre
    Dado un jugador en la portada sin ninguna salida abierta
    Cuando toca salir a andar y la apertura termina de la manera que sea
    Entonces la línea de espera ya no está
    Y no queda ninguna cifra ni ningún porcentaje en pantalla
    Y se ve el momento en marcha, o la acción de vuelta con el motivo debajo

  Escenario: El punto de partida declara de qué puerta salió
    Dado una salida recién abierta
    Cuando se lee lo que la apertura anotó
    Entonces el origen del punto es una de las dos puertas y ninguna palabra nueva
    Y se dice también si el punto se re-ancló
```

```gherkin
# language: es

@app @bucle
Característica: El rótulo del sistema es austero y visible a propósito
  Fuente: seguridad-privacidad.md §2 · bucle-jugable.md §8

  Escenario: El rótulo no se puede descartar deslizando
    Dado un jugador con una salida abierta
    Cuando intenta descartar el rótulo deslizándolo
    Entonces el rótulo sigue ahí

  Escenario: El canal del rótulo no avisa de nada
    Dado un jugador con una salida abierta
    Cuando se mira el canal de notificación del rótulo
    Entonces su importancia es baja
    Y el rótulo no suena ni enciende la pantalla

  Escenario: El momento en marcha se alcanza andando desde la portada
    Dado un jugador en la portada con el permiso concedido
    Cuando pulsa "Salir a andar sin más"
    Entonces la salida queda abierta con el rótulo puesto
    Y lo que ve es el momento en marcha con su marca de posición

  Escenario: En iOS una salida no se abre y se dice por qué
    Dado un jugador con una compilación de iOS
    Cuando echa a andar
    Entonces la salida no se abre
    Y el motivo que se enseña es el del rótulo que falta
```

```gherkin
# language: es

@app @bucle
Característica: Antes de salir es el único momento que pide atención
  Fuente: bucle-jugable.md cuatro momentos §3 §4 · artefacto 2

  Escenario: Se ofrecen tres aventuras como mucho
    Dado un mundo donde castean ocho plantillas para este oficio
    Cuando el jugador abre la lista de hoy
    Entonces ve tres como mucho

  Escenario: Un día con una sola aventura no es un día roto
    Dado un mundo donde castea una sola plantilla
    Cuando el jugador abre la lista de hoy
    Entonces ve una
    Y ningún texto se disculpa por ello

  Escenario: Cada aventura declara su tamaño con una palabra
    Cuando el jugador mira la lista de hoy
    Entonces cada aventura muestra una palabra del mundo y un tiempo aproximado
    Y ninguna muestra una distancia

  Escenario: Salir a andar sin nada es una opción de primer nivel
    Cuando el jugador abre la portada
    Entonces existe un botón para salir a andar sin aventura

  Escenario: Sin cobertura, la preparación dice lo mismo
    Dado un jugador sin conexión
    Cuando acepta una aventura y llega a la pantalla de preparación
    Entonces el texto es el mismo que con conexión
    Y ninguna pantalla menciona la falta de red

  Escenario: El zurrón solo aparece si hay reserva que vaciar
    Dado un jugador con el modo de pasos de fondo apagado
    Cuando abre la app
    Entonces no aparece la pantalla del zurrón

  Escenario: Con reserva sin vaciar se abre el zurrón y no la lista
    Dado un jugador con el modo de pasos de fondo activo y reserva sin vaciar
    Cuando pulsa "Ver qué se cuenta hoy"
    Entonces se abre el zurrón
    Y no se abre la lista del día

  Escenario: Seguir lleva del zurrón a lo que hay hoy
    Dado el zurrón a la vista
    Cuando el jugador pulsa "Seguir"
    Entonces se abre la lista de lo que hay hoy

  Escenario: El zurrón no aparece por segunda vez
    Dado un zurrón ya visto y su reserva vaciada
    Cuando el jugador vuelve a la portada y pulsa "Ver qué se cuenta hoy"
    Entonces se abre la lista del día
    Y el zurrón no aparece otra vez

  Escenario: Al zurrón no se llega desde ninguna otra pantalla
    Dado el diario, la repisa y los ajustes abiertos
    Cuando el jugador busca cómo llegar al zurrón
    Entonces no hay ninguna puerta que lleve a él

  Escenario: La tarjeta de a medias solo existe con la salida abierta
    Dado un jugador que abandonó una aventura y llegó a casa
    Cuando abre la app
    Entonces no hay ninguna tarjeta de aventura a medias
    Y la aventura ya está cerrada, porque el cierre en corto se disparó al llegar
```

```gherkin
# language: es

@app @bucle
Característica: En marcha no hay nada que tocar
  Fuente: bucle-jugable.md momento 2 · artefacto 3

  Escenario: La pantalla del mapa no tiene ni un control
    Dado un jugador andando con una aventura aceptada
    Cuando mira la pantalla
    Entonces no hay ningún elemento tocable dentro de la app

  Escenario: No se enseña ninguna cifra de esfuerzo
    Dado un jugador andando
    Cuando mira la pantalla
    Entonces no aparecen kilómetros, ritmo, pasos, calorías, tiempo ni porcentaje de progreso

  Escenario: El mapa no cambia durante la salida
    Dado un jugador que atraviesa territorio que no conocía
    Cuando mira el mapa a mitad de camino
    Entonces el mapa está como al salir de casa
    Y solo se ha movido su marca

  Escenario: El norte está siempre arriba
    Dado un jugador andando hacia el sur
    Cuando mira el mapa
    Entonces el norte sigue arriba

  Escenario: La salida sigue viva con el móvil bloqueado
    Dado un jugador con una salida abierta
    Cuando bloquea el móvil y anda veinte minutos
    Entonces la salida sigue abierta
    Y el rótulo del sistema muestra hacia dónde va
    Y el rótulo no muestra ninguna cifra

  Escenario: La app no pide el permiso de ubicación permanente
    Cuando se revisan los permisos que la app solicita
    Entonces solo pide la ubicación "mientras se usa"
```

```gherkin
# language: es

@app @accesibilidad @bucle
Característica: Cada aviso viaja por dos capas y el par mezcla bolsillo y pantalla
  Fuente: accesibilidad.md §3 · quests.md decisión 3

  Escenario: Una noticia va por háptico y marca
    Dado un rumor que alcanza un sitio del mapa
    Cuando llega el aviso
    Entonces vibra el móvil
    Y aparece una marca en el mapa
    Pero no salta ninguna notificación

  Escenario: Una oportunidad va por notificación y háptico
    Dado un micro-encuentro disponible
    Cuando el jugador entra en su geofence
    Entonces salta una notificación
    Y vibra el móvil

  Escenario: Ningún aviso viaja por una sola capa
    Dado el catálogo completo de avisos del juego
    Cuando se revisa cada uno
    Entonces todos tienen al menos una capa de bolsillo y una de pantalla

  Escenario: El aviso se lee entero de un vistazo
    Dado una notificación de oportunidad
    Cuando se lee su texto
    Entonces cabe en una línea
    Y nombra el sitio
    Y no contiene ningún "toca para saber más"

  Escenario: Tocar un aviso no acepta nada
    Dado una notificación de oportunidad
    Cuando el jugador la toca mientras anda
    Entonces se abre el mapa con la marca del encuentro
    Y no se acepta ninguna aventura ni se abre ninguna escena

  Escenario: No se avisa durante un beat en curso
    Dado un jugador dentro de una escena de la aventura principal
    Cuando el mundo produce una oportunidad
    Entonces no salta ningún aviso hasta que la escena termina

  Escenario: Una oportunidad ignorada se ofrece una segunda vez
    Dado una oportunidad ignorada
    Cuando el jugador sale otro día
    Entonces se le ofrece una vez más, en otro sitio
    Y si vuelve a ignorarla, sedimenta sin volver a ofrecerse

  Escenario: Sedimentar no se reprocha
    Dado una oportunidad sedimentada
    Cuando el jugador recorre el juego entero
    Entonces ningún texto menciona que no fuese
```

```gherkin
# language: es

@app @bucle
Característica: Al parar, la secuencia de una llegada
  Fuente: bucle-jugable.md §2 · artefacto 4

  Escenario: La escena queda disponible y espera
    Dado un beat en "O Torreón Esquecido"
    Cuando el jugador se para dentro de su geofence
    Entonces la pantalla no se enciende
    Y la app no se pone en primer plano
    Pero si el jugador mira, la escena está ahí

  Escenario: Pararse en un semáforo dentro de un geofence no tiene consecuencias
    Dado un beat cuyo geofence toca un cruce con semáforo
    Cuando el jugador se para 40 segundos y sigue andando sin mirar el móvil
    Entonces el beat sigue disponible para cuando vuelva

  Escenario: El visor abre por la ficción la primera vez
    Dado un sitio con ilustración que el jugador no conocía
    Cuando abre la app parado dentro del geofence
    Entonces ve la ilustración de fantasía y el nombre inventado
    Y el tirador del visor está en el borde

  Escenario: Arrastrar descubre el sitio real
    Dado el visor abierto por el lado de la ficción
    Cuando el jugador arrastra el tirador
    Entonces aparece la foto del lugar real
    Y la cartela dice el nombre real

  Escenario: El visor es una capa y debajo está el beat
    Dado el visor abierto en un sitio con beat
    Cuando el jugador cierra el visor
    Entonces aparece la escena

  Escenario: Sin foto de Places, el visor abre igual
    Dado un sitio del que Places no tiene foto
    Cuando el jugador abre el visor
    Entonces ve la ilustración de fantasía
    Y al arrastrar aparece la cartela con el nombre real sobre fondo liso

  Escenario: La segunda vez el visor no se abre solo
    Dado un sitio que el jugador ya conocía
    Cuando llega y abre la app
    Entonces ve lo que ha cambiado
    Y el visor está disponible con un toque

  Escenario: Llegar sin haber venido a nada da la ficha del sitio
    Dado un paraje que no es beat de ninguna aventura
    Cuando el jugador se para dentro de su geofence
    Entonces ve el nombre de fantasía, qué es en realidad y la escena
    Y ningún texto lo llama error ni falta

  Escenario: Lo que aquí se cuenta cierra la llegada a un núcleo
    Dado un beat en el núcleo "Monfrida"
    Cuando el jugador completa la escena
    Entonces después aparece lo que allí se cuenta
    Y no antes

  Escenario: Sin beat, lo que se cuenta es la llegada entera
    Dado un núcleo sin beat para el jugador
    Cuando llega y se para
    Entonces lo primero que ve es lo que allí se cuenta

  Escenario: El geofence se valida desde la calle
    Dado un anclaje que es un local cerrado
    Cuando el jugador se para en la acera de enfrente, a 30 m
    Entonces el beat se valida

  Escenario: El visor no aparece nunca andando
    Dado un jugador que atraviesa el geofence de un sitio sin pararse
    Cuando sigue andando
    Entonces el visor no se abre
```

```gherkin
# language: es

@app @bucle
Característica: El telón se echa solo al cerrarse la salida
  Fuente: bucle-jugable.md §4 §8 · artefacto 5

  Escenario: Volver a casa cierra la salida
    Dado un jugador con una salida abierta
    Cuando vuelve al punto de partida
    Entonces la salida se cierra
    Y no salta ninguna notificación
    Y la app no se pone en primer plano

  Escenario: El telón espera a que lo leas
    Dado una salida cerrada que el jugador no ha mirado
    Cuando abre la app dos días después
    Entonces lo primero que ve es el telón de aquella salida

  Escenario: Se puede cerrar la salida desde el rótulo del sistema
    Dado un jugador con una salida abierta lejos de casa
    Cuando pulsa "dar la salida por terminada" en el rótulo
    Entonces la salida se cierra igual que si hubiera vuelto

  Escenario: El rótulo se retira pero la salida no se cierra
    Dado un jugador con una salida abierta que lleva horas sin andar
    Cuando pasa el plazo del servicio en primer plano
    Entonces el rótulo desaparece de la pantalla de bloqueo
    Pero la salida sigue abierta
    Y al abrir la app aparece la tarjeta con "seguir" y "dejarlo aquí"

  Escenario: El mapa se entinta al echar el telón
    Dado un jugador que ha descubierto dos sitios nuevos durante la salida
    Cuando se echa el telón
    Entonces el mapa muestra los dos sitios recién entintados
    Y la lista dice de qué nivel a qué nivel han subido, en palabras del mundo

  Escenario: Un día sin descubrir nada enseña el mapa igual
    Dado un jugador que anda su ruta de siempre sin descubrir nada
    Cuando se echa el telón
    Entonces el mapa aparece igual
    Y el título reconoce que hoy no ha visto nada nuevo
    Y ningún texto se lo reprocha

  Escenario: El cierre en corto ocupa el sitio del desenlace
    Dado un jugador que se vuelve a mitad de una aventura
    Cuando se echa el telón
    Entonces ve el mapa entintado
    Y en lugar del desenlace ve el cierre en corto
    Y después la entrada del diario

  Escenario: Un cierre en corto no genera rumor
    Dado una aventura cerrada en corto
    Cuando el mundo avanza diez pasos
    Entonces no existe ningún rumor sobre ella en ningún núcleo

  Escenario: Un paseo sin aventura tiene telón completo menos desenlace
    Dado un jugador que salió a andar sin coger nada
    Cuando vuelve a casa
    Entonces ve el mapa y la entrada del diario
    Y no ve desenlace ni rumor

  Escenario: El rumor solo aparece si el desenlace era notable
    Dado una aventura terminada cuyo desenlace no es notable
    Cuando se echa el telón
    Entonces no aparece la pantalla de lo que se pone en camino

  Escenario: El telón no enseña la propagación
    Dado un desenlace notable
    Cuando aparece la pantalla de lo que se pone en camino
    Entonces se ve que algo ha salido del núcleo
    Pero no se ve a qué núcleos llegará, ni cuándo, ni con qué nivel

  Escenario: Leer el telón deja abrir otra salida
    Dado el telón en su última pantalla, la entrada del día
    Cuando el jugador toca cualquiera de sus dos salidas
    Entonces el telón queda marcado como leído
    Y se puede abrir una salida nueva
    Pero avanzar de pantalla no lo había marcado
```

```gherkin
# language: es

@nucleo @bucle
Característica: La forma del cuerpo la decide la escena y las dos mitades del paso la heredan
  Un texto, un criterio: si hay cara el cuerpo es parlamento, y la segunda mitad del paso no lo vuelve a decidir.
  Fuente: npcs.md §3 · personaje.md §4 · bucle-jugable.md §2 · artefacto 4

  Escenario: Un beat con cara compone su escena con quien habla, en parlamento y con el rótulo del puesto
    Dado un beat sobre un rol humano ya casteado
    Cuando se compone su escena
    Entonces quien habla llega con su nombre y el rótulo de su puesto
    Y el cuerpo se declara parlamento

  Escenario: Con cara las dos mitades dicen parlamento, y sin ella las dos dicen párrafo
    Dado un beat con cara y otro sin ella
    Cuando se componen las dos mitades del paso de cada uno
    Entonces las del beat con cara declaran parlamento y las del otro declaran párrafo

  Escenario: La regla de la forma se declara una vez y ninguna de las dos composiciones la reescribe
    Dado la regla que decide la forma del cuerpo
    Cuando se busca dónde se declara
    Entonces está escrita en un solo sitio
    Y ninguna de las dos mitades del paso la vuelve a escribir

  Escenario: A4P4 pinta el empuje a través de la misma forma que A4P3, y la cara se resuelve una vez
    Dado un beat con cara
    Cuando se componen la escena y lo que te llevas
    Entonces las dos usan la misma forma
    Y la cara se resuelve una sola vez para las dos

  Escenario: Una cara sobre un beat de franja o de objeto no se come la variante ni la vía alternativa
    Dado un beat con cara cuyo disparador es de franja o de objeto
    Cuando se compone su escena
    Entonces la línea que sitúa sigue siendo la prosa de la plantilla
    Y el parlamento es la variante de franja o el texto de la vía alternativa
    Pero ningún texto anuncia que falte nada
```

---

## 8 · Progresión, economía y personaje

```gherkin
# language: es

@nucleo @app
Característica: No hay niveles, hay rango social por núcleo
  Fuente: progresion.md

  Escenario: El rango sube por lo que llega, no por lo que se pisa
    Dado un jugador que pasa por "Vilanova" cada día sin hacer nada allí
    Cuando el mundo avanza veinte pasos
    Entonces en "Vilanova" sigue siendo forastera

  Escenario: Se puede ser alguien en un pueblo donde no has estado
    Dado un desenlace notable en "Monfrida"
    Y un núcleo vecino al que llega el rumor
    Cuando el jugador llega por primera vez a ese vecino
    Entonces allí ya saben quién es

  Escenario: El rango no viaja entre mapas
    Dado un jugador con rango "alguien de aquí" en su mapa de casa
    Cuando levanta un mapa nuevo en otro sitio
    Entonces en el mapa nuevo es forastera en todos sus núcleos

  Escenario: No hay ninguna barra ni lista de reputación
    Cuando el jugador recorre todas las pantallas del juego
    Entonces no aparece ningún medidor de reputación
    Y el rango solo se percibe en cómo le hablan y en sus motes

  Escenario: El rango cambia el trato y el precio, no el catálogo
    Dado un jugador forastera y otro "alguien de aquí" en el mismo núcleo
    Cuando los dos hablan con el mismo informante
    Entonces se les ofrece lo mismo
    Pero a distinto precio y con distinto tono

  Escenario: Avanza igual quien anda 6 km y quien anda 900 m
    Dado dos jugadores con tramos muy distintos
    Cuando los dos completan la misma aventura casteada a su tramo
    Entonces suben lo mismo de rango
```

```gherkin
# language: es

@nucleo
Característica: El oro compra saber y favores, nunca metros
  Fuente: progresion.md §2

  Escenario: No se puede pagar por no andar
    Dado un jugador con oro de sobra
    Cuando revisa todo lo que puede comprar
    Entonces nada de lo que se ofrece reduce la distancia que tiene que andar

  Escenario: Lo que compras es la versión que ese informante oyó
    Dado un informante que recibió el rumor en nivel 2
    Cuando el jugador le paga por lo que sabe
    Entonces recibe la versión de nivel 2
    Y no la versión fiel

  Escenario: El oro ficticio no toca dinero real
    Cuando se revisan todas las maneras de ganar y gastar oro
    Entonces ninguna implica una compra real
    Y ninguna manda al jugador a gastar en el negocio real del anclaje
```

```gherkin
# language: es

@nucleo @app
Característica: Los objetos son llaves, no requisitos
  Fuente: progresion.md §3

  Escenario: Sin el objeto hay otro camino al mismo beat
    Dado un beat que tiene una entrada con la llave del molino
    Cuando el jugador llega sin la llave
    Entonces existe otra manera de resolver el beat

  Escenario: La repisa no es un inventario
    Cuando el jugador abre la repisa
    Entonces no hay peso, ni huecos, ni manera de tirar nada
    Y cada objeto dice de quién viene y de qué día
```

```gherkin
# language: es

@app
Característica: El personaje se elige una vez y el oficio no se cambia
  Fuente: personaje.md §3 · partida-guardada.md §4

  Escenario: La pantalla de elección dice qué implica el oficio
    Cuando el jugador llega a la elección de oficio
    Entonces se le dice que el oficio decide qué aventuras verá
    Y que no se cambia después
    Y el oficio marcado explica a qué tipo de aventuras manda

  Escenario: El oficio no aparece en ajustes
    Cuando el jugador abre los ajustes
    Entonces puede cambiar su nombre y su género gramatical
    Pero no su oficio

  Escenario: El mote nace del rumor y es por núcleo
    Dado un desenlace notable que genera rumor
    Cuando el rumor llega a dos núcleos con distinto nivel
    Entonces el jugador puede tener un mote distinto en cada uno

  Escenario: Nada del personaje afecta al cuerpo
    Cuando se revisan todos los atributos del personaje
    Entonces ninguno modifica la velocidad, la resistencia ni la distancia que puede andar
```

---

## 9 · Seguridad, privacidad y menores

```gherkin
# language: es

@red @privacidad
Característica: Del móvil no sale nada del jugador
  Fuente: seguridad-privacidad.md §1 · arquitectura.md §3

  Escenario: Las coordenadas salen una sola vez, al generar el mapa
    Dado un jugador que juega treinta días
    Cuando se inspecciona todo el tráfico de red saliente
    Entonces las coordenadas del jugador aparecen solo en la generación de cada mapa

  Escenario: El prompt del LLM no lleva ningún dato real
    Dado una aventura anclada al bar "Casa Manuela"
    Cuando se genera su narrativa
    Entonces el prompt no contiene "Casa Manuela"
    Y no contiene ninguna coordenada, dirección ni identificador de OSM o de Places

  Escenario: Las fotos de Places se piden al crear el mapa
    Dado un jugador que acepta cinco aventuras a lo largo de una semana
    Cuando se inspecciona el tráfico
    Entonces no hay ninguna petición de fotos durante esa semana
    Y todas las fotos que hacen falta ya están en el dispositivo

  Escenario: El proxy no identifica a nadie
    Cuando se inspecciona lo que el proxy registra
    Entonces no guarda quién llama, ni desde dónde, ni ninguna partida

  Escenario: El rastro de ubicación no se guarda nunca
    Dado un jugador que ha andado cien salidas
    Cuando se inspecciona la partida guardada y el respaldo del sistema
    Entonces no contienen ningún histórico de posiciones
```

```gherkin
# language: es

@app @privacidad
Característica: El jugador puede marcar un anclaje que no vale
  Fuente: seguridad-privacidad.md §3

  Escenario: Marcarlo lo saca del casting sin resembrar
    Dado un paraje anclado a una casa particular
    Cuando el jugador lo marca
    Entonces ninguna aventura vuelve a mandarlo allí
    Y el resto del mundo sigue idéntico byte a byte

  Escenario: Es reversible
    Dado un anclaje marcado
    Cuando el jugador lo desmarca desde los ajustes
    Entonces vuelve a estar disponible para el casting

  Escenario: No hace falta dar motivo
    Cuando el jugador marca un anclaje sin elegir motivo
    Entonces se marca igual

  Escenario: No se reporta a ningún sitio
    Dado un anclaje marcado
    Cuando se inspecciona el tráfico saliente
    Entonces no sale ninguna petición relacionada
```

```gherkin
# language: es

@app @privacidad
Característica: El juego es apto por diseño y no distingue a un menor
  Fuente: seguridad-privacidad.md §4 · quests.md §8

  Escenario: No se pregunta la edad
    Cuando el jugador recorre el onboarding entero
    Entonces no se le pregunta la edad en ningún momento

  Escenario: El horario diurno viene encendido
    Dado una instalación nueva
    Cuando se abren los ajustes
    Entonces "solo de día" está activado
    Y se puede desactivar

  Escenario: Los anclajes de adultos se excluyen del pool
    Dado unos datos de OSM con bares de copas y locales de adultos
    Cuando se genera el mundo
    Entonces ninguno se usa como anclaje

  Escenario: Los pasos de fondo vienen apagados
    Dado una instalación nueva
    Cuando se abren los ajustes
    Entonces "contar los pasos del día a día" está desactivado
    Y el juego es completo sin activarlo
```

```gherkin
# language: es

@nucleo @privacidad
Característica: A la app de salud se le pide lo mínimo que mueve un contador
  Los pasos del día a día se leen al abrir y de la app de salud del sistema.
  Lo que se le pide son los metros o los pasos de una ventana, y nada con
  recorrido; lo que cruza de ahí al núcleo es un número de metros.
  Fuente: seguridad-privacidad.md §2 · quests.md decisión 4

  Escenario: La sonda de salud dice si se puede contar y no pide ningún permiso
    Dado una compilación con la app de salud del sistema disponible y el permiso concedido
    Cuando se sondea la capacidad de salud
    Entonces la capacidad está montada y disponible, y sin motivo
    Y no se ha pedido ningún permiso al sistema

  Escenario: Sin la app de salud del sistema no se puede contar y se dice por qué
    Dado una compilación donde la app de salud del sistema no está disponible
    Cuando se sondea la capacidad de salud
    Entonces la capacidad está montada y no disponible
    Y el motivo nombra que la app de salud del sistema no está

  Escenario: Con la app de salud y sin permiso el motivo nombra el permiso
    Dado una compilación con la app de salud del sistema y sin el permiso de lectura
    Cuando se sondea la capacidad de salud
    Entonces la capacidad está montada y no disponible
    Y el motivo nombra el permiso y es distinto del de la app que falta

  Escenario: En iOS no hay de dónde leer los pasos y se declara
    Dado una compilación de iOS
    Cuando se sondea la capacidad de salud
    Entonces la capacidad no está montada
    Y el motivo dice que la fuente es la de Android y que iOS la tendrá con su propia fila

  Escenario: A la app de salud solo se le piden los metros y los pasos de una ventana
    Dado lo que la app le pide a la app de salud del sistema
    Cuando se enumera
    Entonces son exactamente el permiso de distancia y el de pasos
    Y no se piden entrenamientos, sesiones con ruta, frecuencia cardíaca ni ningún registro del cuerpo

  Escenario: Del lector de salud al núcleo solo cruzan metros
    Dado una lectura de la app de salud
    Cuando se inspecciona lo que llega al núcleo
    Entonces es un número de metros y nada más
    Y no cruza ninguna ventana, ningún instante ni ninguna marca del reloj real

  Escenario: El manifiesto no declara ningún permiso de salud fuera de los dos
    Dado el manifiesto fusionado de Android
    Cuando se enumeran sus permisos de salud
    Entonces son exactamente el de distancia y el de pasos
    Y no aparece el permiso de reconocimiento de actividad
    Y el Info.plist generado no declara ninguna clave de uso de salud

  Escenario: Del zurrón no sale nada del móvil
    Dado un zurrón con cinco entradas
    Cuando se inspecciona el tráfico saliente que provoca
    Entonces no sale ningún nombre real de sitio, ni la reserva, ni cuánto se ha andado
```

```gherkin
# language: es

@nucleo @privacidad
Característica: El interruptor de contar los pasos no miente
  Encenderlo pide el permiso en contexto y nunca antes; sin fuente de la que
  leer no se puede encender, y lo que se pinta es siempre el valor efectivo.
  Fuente: seguridad-privacidad.md §2 · quests.md decisión 4

  Escenario: Encender los pasos del día a día sin fuente es imposible
    Dado una compilación sin fuente de salud
    Cuando se toca la fila de contar los pasos del día a día
    Entonces la fila sigue en "no"
    Y no se ha pedido ningún permiso
    Y la línea que aparece debajo dice que no se puede

  Escenario: El interruptor cambia de valor sin salir y volver a entrar
    Dado la fila de contar los pasos del día a día y el permiso concedido
    Cuando se vuelve a leer la fila sin salir de los ajustes
    Entonces vale "sí"
    Y no hay ninguna línea de aviso debajo

  Escenario: El interruptor atiende su fila y no la de al lado
    Dado la fila "solo de día", que es de otra decisión
    Cuando se toca
    Entonces la orquestación de los pasos de fondo no la atiende y lo declara
    Y no cambia ningún ajuste por el camino
```

```gherkin
# language: es

@nucleo @privacidad
Característica: El sistema puede preguntar por qué se piden los permisos de salud
  La pregunta llega desde fuera de la app, viaja por un enlace declarado como
  superficie pública y aterriza en la pantalla donde esa razón ya está escrita.
  Fuente: seguridad-privacidad.md §2

  Escenario: Las dos puertas de la razón de permisos llevan a la actividad principal
    Dado el manifiesto fusionado de Android
    Cuando se buscan las puertas de la razón de permisos de salud
    Entonces están la de las versiones antiguas y la de las nuevas
    Y las dos apuntan a la actividad principal de la app

  Escenario: El intento de la razón se traduce a un enlace y no decide nada más
    Dado el intento con el que el sistema pregunta por la razón de los permisos
    Cuando llega a la actividad principal
    Entonces se reescribe al enlace de la razón de permisos
    Y ninguna condición del juego se decide fuera de la app

  Escenario: El enlace de la razón de permisos no escribe nada
    Dado el enlace de la razón de permisos
    Cuando se dispara
    Entonces solo navega
    Y no acredita metros, no toca la reserva y no cambia ningún ajuste

  Escenario: El suelo de aparatos que la fuente de salud exige está en el artefacto
    Dado el manifiesto fusionado de Android
    Cuando se lee el mínimo de sistema que declara
    Entonces es el que la fuente de salud exige
    Y las demás claves de compilación están como estaban
```

```gherkin
# language: es

@app @privacidad
Característica: La razón de los permisos aterriza donde ya está escrita
  Fuente: seguridad-privacidad.md §2

  Escenario: Con partida abierta, la razón de los permisos abre los ajustes
    Dado un aparato con la app instalada y una partida abierta
    Cuando el sistema dispara el intento de la razón de permisos de salud
    Entonces se abren los ajustes con la fila de contar los pasos del día a día
    Y no se escribe ningún texto nuevo para esa entrada

  Escenario: Sin partida, la razón de los permisos cae al arranque
    Dado un aparato recién limpiado y reinstalado
    Cuando el sistema dispara el intento de la razón de permisos de salud
    Entonces se ve el arranque de siempre
    Y no se monta ninguna pantalla de ajustes sobre una partida que no existe

  Escenario: El permiso de salud se pide al encender y denegarlo no se insiste
    Dado la fila de contar los pasos del día a día en "no"
    Cuando el jugador la toca y deniega el permiso del sistema
    Entonces la fila vuelve a "no" con su línea de aviso debajo
    Y volver más tarde a los ajustes no vuelve a pedirlo

  Escenario: Un permiso revocado desde el sistema apaga el interruptor y lo dice
    Dado el modo encendido y el permiso concedido
    Cuando el permiso se revoca desde fuera de la app y se vuelve a los ajustes
    Entonces la fila vale "no"
    Y aparece la línea que dice que sin acceso no se pueden contar
```

```gherkin
# language: es

@nucleo @privacidad
Característica: Los plugins que reescriben el proyecto nativo están nombrados uno a uno
  Un plugin traduce y no decide, y eso lo revisa una persona; lo que esta lista garantiza es que ninguno entre sin conversación.
  Fuente: seguridad-privacidad.md §1 · decisiones-orquestador.md §14e

  Escenario: La lista de plugins es exactamente la que hay, con su cometido declarado
    Dado los plugins que reescriben el proyecto nativo
    Cuando se comparan con la lista nombrada a mano
    Entonces están los dos que hay y ninguno más
    Y cada uno trae su cometido declarado en una frase

  Escenario: Ningún plugin ha cambiado de forma sin que alguien lo vuelva a nombrar
    Dado un plugin de la lista que ha cambiado de forma
    Cuando se comprueba la lista
    Entonces se pone roja nombrando el fichero y el cambio
    Y no pasa hasta que alguien lo vuelva a nombrar

  Escenario: Los plugins nombrados son los que la app carga, y los carga por su ruta
    Dado la lista de plugins nombrados
    Cuando se mira lo que la app declara cargar
    Entonces son los mismos
    Y cada uno se carga por su ruta dentro del proyecto

  Escenario: La guarda no importa nada de Expo, de React Native ni de la app
    Dado un clon limpio del repositorio
    Cuando se ejecuta la comprobación de la lista
    Entonces arranca sin instalar ninguna dependencia
```

```gherkin
# language: es

@nucleo @privacidad
Característica: Nada de esta app se despierta con la app cerrada
  La promesa siempre fue la ancha; lo que se comprobaba era la estrecha —«al arrancar el móvil»— y solo sobre los receptores, así que los servicios quedaban fuera del barrido por construcción. La lista cerrada es lo que hace que una vía nueva no pueda entrar callando.
  Fuente: seguridad-privacidad.md §2

  Escenario: Nada de esta app se despierta al arrancar el móvil
    Dado el manifiesto fusionado de Android
    Cuando se enumeran todos sus receptores con sus filtros
    Entonces ninguno declara ninguna de las seis acciones de arranque
    Y no hay lista de tolerados ni excepción por clase

  Escenario: Nada de esta app se despierta con la app cerrada, y la lista de vías lo enumera
    Dado el manifiesto fusionado de Android
    Cuando se enumeran sus receptores y sus servicios con sus filtros
    Entonces todos los que pueden levantar el proceso están nombrados en la lista
    Y uno sin nombrar pone la batería roja

  Escenario: La lista de vías de despertar nombra cada una con su mecanismo y su motivo
    Dado la lista declarada en la app
    Cuando se lee una de sus entradas
    Entonces dice su clase, si es receptor o servicio, qué la descubre, quién la declara y por qué está
    Y dice si su mecanismo está medido o solo declarado
    Y las declaradas sin medir se cuentan con el número delante

  Escenario: La lectura de vías enumera los servicios y no solo los receptores
    Dado un manifiesto con receptores y servicios capaces de levantar el proceso
    Cuando la guarda lo recorre
    Entonces mira las dos clases de bloque
    Y no deja fuera los servicios

  Escenario: Un servicio exportado con filtro que la lista no nombra se señala con su clase y su filtro
    Dado un manifiesto de ejemplo con un servicio exportado con filtro que nadie ha nombrado
    Cuando se le aplica la lectura de la guarda
    Entonces se pone roja
    Y nombra la clase y el filtro
    Y no hay ninguna excepción por clase ni ninguna lista de tolerados sin motivo

  Escenario: Las tres piezas de FCM no llegan al manifiesto fusionado, y la pareja queda cerrada
    Dado el manifiesto fusionado tras retirar las tres piezas
    Cuando se busca el receptor de c2dm y los dos servicios del mismo filtro de mensajería
    Entonces ninguno puede ya recibir por la forma que su descubrimiento exige
    Y los dos servicios están neutralizados, no uno

  Escenario: Un manifiesto con solo el servicio de Expo neutralizado se pone rojo
    Dado un manifiesto de ejemplo en el que solo se neutraliza el servicio de Expo
    Cuando se le aplica la guarda
    Entonces se pone roja
    Y el motivo es que el de Firebase resolvería en su lugar por el mismo filtro

  Escenario: Nada del código vivo pide un token de push
    Dado todo el código vivo de la app y del paquete
    Cuando se buscan las llamadas que piden un token de push
    Entonces no hay ninguna
    Y tampoco hay fichero de servicios de Firebase declarado

  Escenario: La cabecera del plugin dice cómo vuelven las tres piezas el día que haya push
    Dado la cabecera del plugin que retira las tres piezas
    Cuando se lee
    Entonces dice cómo se vuelven a declarar el día que el producto adopte push
    Y dice que ese día es una decisión de producto y no un ajuste de configuración nativa
```

---

## 10 · La partida guardada

```gherkin
# language: es

@nucleo @persistencia
Característica: El mundo se congela entero
  Fuente: partida-guardada.md §1

  Escenario: El mundo no depende de OSM después de generarse
    Dado un mundo generado y guardado
    Cuando los datos de OSM cambian por completo
    Y se carga la partida
    Entonces el mundo es idéntico al guardado

  Escenario: Una salida entera se juega sin red
    Dado un mundo guardado y una aventura preparada
    Cuando se corta la red antes de salir
    Entonces la salida se completa de principio a fin

  Escenario: El estado manda sobre el registro
    Dado una partida cuyo registro de hechos reconstruye un rango distinto al guardado
    Cuando se carga
    Entonces vale el estado guardado

  Escenario: El registro basta para reconstruir
    Dado una partida cuyo estado se ha corrompido
    Cuando se reconstruye desde el registro de hechos
    Entonces se recuperan los rangos, lo oído, la repisa y los NPCs conocidos
    Y se avisa de que el resultado puede diferir
```

```gherkin
# language: es

@app @persistencia
Característica: La partida sobrevive a cerrar la app
  Fuente: partida-guardada.md §2 · RF-PERS-001, RF-PERS-002 · SPEC-047

  Escenario: Lo jugado se escribe donde la copia lo busca
    Dado un jugador que acaba de cerrar el arranque
    Cuando la partida nace
    Entonces quedan escritos el estado y el registro de hechos bajo el prefijo de la partida

  Escenario: Cerrar la app y volver no empieza de cero
    Dado una partida con personaje y mapa levantado
    Cuando el sistema mata la app y se vuelve a abrir
    Entonces se abre en la portada con el mismo personaje y el mismo mapa

  Escenario: Congelar sin que nada haya cambiado no reescribe
    Dado una partida recién congelada
    Cuando se vuelve a congelar sin haber cambiado nada
    Entonces no se reescribe ningún documento

  Escenario: Una copia exportada trae lo jugado
    Dado una partida guardada
    Cuando el jugador guarda una copia
    Entonces el fichero trae dentro el estado de la partida y el registro de hechos
```

```gherkin
# language: es

@app @persistencia
Característica: Una partida que no se puede abrir da la cara
  Fuente: partida-guardada.md §2 · decisiones-orquestador.md §6h · SPEC-047

  Escenario: Un estado ilegible no se convierte en una partida nueva
    Dado un documento de estado que no se puede leer
    Cuando se abre la app
    Entonces se enseña la avería con el motivo y no se empieza una partida nueva

  Escenario: Lo único que se ofrece es abrir una copia
    Dado la avería a la vista
    Cuando el jugador mira qué puede hacer
    Entonces se le ofrece abrir una copia y ninguna acción que borre

  Escenario: Una copia de una versión que el juego no entiende no se abre a medias
    Dado un estado escrito en una versión de formato mayor que la del juego
    Cuando se abre la app
    Entonces se enseña la avería declarando las dos versiones
```

```gherkin
# language: es

@nucleo @persistencia
Característica: Versionado y migración del estado
  Fuente: partida-guardada.md «lo que esto obliga» · RF-PERS-008 · SPEC-047

  Escenario: Una partida de una versión anterior se migra al abrirla
    Dado un estado escrito en una versión anterior y la cadena con su paso
    Cuando se abre la partida
    Entonces el documento guardado queda en la versión actual
    Y queda declarado de qué versión venía

  Escenario: Un salto sin paso registrado no se interpreta con las reglas nuevas
    Dado un estado de una versión anterior y la cadena sin el paso que hace falta
    Cuando se abre la partida
    Entonces falla nombrando el salto que falta
    Y el documento guardado no se toca

  Escenario: Una migración que no se puede levantar no sustituye a la buena
    Dado un paso de migración cuyo resultado no pasa el esquema
    Cuando se abre la partida
    Entonces no se escribe el documento migrado
```

```gherkin
# language: es

@app @persistencia
Característica: Empezar de nuevo borra y no reinicia
  Fuente: partida-guardada.md §4

  Escenario: Se explica que el mundo no se puede rehacer
    Cuando el jugador entra en "empezar de nuevo"
    Entonces se le dice que su mapa no se puede volver a generar
    Y se enumera lo que pierde: personaje, mapas por su nombre, días de diario y lo que la gente sabe de él

  Escenario: La copia se ofrece pero no se hace sola
    Cuando el jugador entra en "empezar de nuevo"
    Entonces se le ofrece guardar una copia
    Y si elige borrar sin guardar, no queda ningún fichero

  Escenario: La copia guardada se puede volver a abrir
    Dado un jugador que guardó una copia y borró la partida
    Cuando importa el fichero
    Entonces recupera el mundo, el personaje, el diario y los rangos

  Escenario: Borrar lleva al arranque
    Dado un jugador que confirma el borrado
    Cuando termina
    Entonces está en la primera pantalla del arranque
    Y no queda nada de la partida anterior
```

```gherkin
# language: es

@nucleo @persistencia
Característica: Guardar una copia y borrar la partida son dos gestos
  Lo destructivo no se ejecuta sobre una señal que el sistema no garantiza: en Android la hoja de compartir resuelve al lanzar el selector, así que encadenar el borrado a su promesa borraba la partida mientras quien juega elegía destino.
  Fuente: partida-guardada.md §4 · lenguaje.md

  Escenario: Guardar una copia no borra la partida por ninguna de sus tres ramas
    Dado un jugador que elige guardar una copia
    Cuando la hoja del sistema se resuelve de la manera que sea
    Entonces la partida sigue entera
    Y borrar sigue exigiendo su propio gesto

  Escenario: Cancelar la hoja del sistema deja la partida entera y las tres acciones vuelven
    Dado un jugador que elige guardar una copia y cancela la hoja con el botón atrás
    Cuando vuelve a la pantalla
    Entonces la partida sigue entera
    Y las tres acciones están puestas

  Escenario: La copia hecha se dice en una línea y las tres acciones siguen estando
    Dado un jugador que guardó la copia
    Cuando vuelve a la pantalla
    Entonces una línea dice que la copia está hecha
    Y las tres acciones siguen estando

  Escenario: La acción destructiva no afirma que no se ha guardado nada
    Dado la copia ya guardada
    Cuando se lee la acción de borrar
    Entonces dice lo que hace
    Y lo dice igual se haya guardado o no

  Escenario: Una exportación que falla antes de borrar deja la partida entera y sin marca
    Dado una exportación que falla
    Cuando termina
    Entonces la partida sigue entera
    Y se dice en una línea

  Escenario: Un borrado terminado se lleva la copia de trabajo de la caché
    Dado un borrado que termina
    Cuando se busca lo que queda
    Entonces no queda la copia de trabajo de la caché

  Escenario: Los ficheros que se exportaron no se tocan al borrar
    Dado un jugador que guardó su copia fuera con la hoja del sistema
    Cuando borra la partida
    Entonces esos ficheros siguen donde los dejó
```

---

## 11 · El alcance del mundo

```gherkin
# language: es

@app
Característica: Una partida, muchos mapas, y ningún selector
  Fuente: alcance-del-mundo.md §3

  Escenario: El mapa activo lo decide dónde estás
    Dado un jugador con dos mapas, uno de casa y otro de vacaciones
    Cuando abre la app estando en casa
    Entonces se abre el mapa de casa sin preguntar nada

  Escenario: Llegar a un sitio nuevo ofrece levantar un mapa
    Dado un jugador a 300 km de todos sus mapas
    Cuando abre la app
    Entonces se le ofrece levantar un mapa nuevo

  # El sitio se dice como lugar y nunca como coordenada, y el nombre lo trae la misma ruta
  # ciega por la que se levanta el mapa. Decidido el 12-ago-2026 al cablear A2P0: sin
  # respaldo, no llegar el nombre dejaba una pantalla en blanco o la portada de casa a
  # trescientos kilómetros, y de paso se perdían las tres puertas.
  Escenario: Sin saber cómo se llama el sitio, se ofrece igual
    Dado un jugador a 300 km de todos sus mapas y sin poder traer el nombre del sitio
    Cuando abre la app
    Entonces se le ofrece levantar un mapa nuevo con el sitio dicho en voz de mundo
    Y no se nombra la red ni la cobertura en ninguna línea

  Escenario: No existe ningún selector de mapas
    Cuando el jugador recorre todas las pantallas
    Entonces no hay ninguna manera de cambiar el mapa activo a mano

  Escenario: Los mapas antiguos se leen desde el diario
    Dado un jugador con un mapa de vacaciones del año pasado
    Cuando abre el diario
    Entonces ve un capítulo por mapa
    Y dentro del capítulo antiguo están sus días y su mapa
    Pero no puede jugar en él desde casa

  Escenario: El jugador viaja entero
    Dado un jugador que levanta un mapa nuevo lejos
    Cuando llega allí
    Entonces conserva personaje, oficio, repisa, diario y objetos
    Pero es forastera en todos los núcleos del mapa nuevo

  Escenario: El mundo de casa no avanza en tu ausencia
    Dado un jugador que pasa tres semanas fuera andando en otro mapa
    Cuando vuelve a casa
    Entonces el mundo de casa ha avanzado solo con los kilómetros que él anduvo allí
```

---

## 12 · El lenguaje

```gherkin
# language: es

@nucleo @lenguaje
Característica: El lenguaje es inclusivo y el sesgo va hacia el femenino
  Fuente: lenguaje.md

  Escenario: El personaje llega en femenino
    Dado una instalación nueva
    Cuando el jugador llega a la creación de personaje
    Entonces el género gramatical está puesto en femenino
    Y las sugerencias de nombre muestran femeninos primero

  Escenario: El reparto de NPCs se equilibra por generación
    Dado un mundo sembrado con "42.40,-8.81#1"
    Cuando se generan cien NPCs jugando
    Entonces el reparto por género está equilibrado
    Y ningún oficio queda poblado siempre por el mismo género

  Escenario: No se usa masculino genérico en fórmulas frecuentes
    Dado todos los textos de plantilla y de fallback
    Cuando se pasan por el filtro de fórmulas
    Entonces ninguna coincide con la lista de masculino genérico evitable

  Escenario: No se usa morfología inventada
    Dado todos los textos del juego
    Cuando se buscan terminaciones en -e y en -x usadas como género
    Entonces no aparece ninguna

  Escenario: Ningún texto depende de un número que solo existe en la maqueta
    Dado todos los textos de plantilla
    Cuando se generan diez mundos distintos
    Entonces ningún texto se vuelve falso en ninguno de ellos
```

```gherkin
# language: es

@app @lenguaje
Característica: Dos registros con una sola frontera
  Fuente: lenguaje.md · artefacto 6

  Escenario: El onboarding habla como aplicación
    Cuando el jugador recorre el onboarding
    Entonces los textos explican qué hace la app y por qué

  Escenario: El juego habla como mundo
    Dado un jugador que ya ha salido a andar una vez
    Cuando recorre el bucle entero
    Entonces ningún texto menciona la aplicación, la red ni los permisos

  Escenario: Los ajustes son la única excepción
    Cuando el jugador abre los ajustes
    Entonces se habla como aplicación
    Y ese registro no aparece en ninguna otra pantalla del juego
```

```gherkin
# language: es

@nucleo @lenguaje
Característica: El puesto se dice con palabras del mundo
  Los nueve rótulos son sintagmas de tarea y no nombres de persona, así que no hay género que elegir ni oficio que arrastre estereotipo.
  Fuente: lenguaje.md · npcs.md §1

  Escenario: Cada puesto se dice en pantalla con un rótulo de mundo, y un puesto sin él revienta
    Dado los puestos declarados de la plantilla de puestos
    Cuando se pide el rótulo de cada uno
    Entonces todos tienen el suyo, en palabras del mundo
    Pero un puesto sin rótulo falla nombrándolo en lugar de caer a la clave

  Escenario: El bloque de quien habla se pinta con el rótulo del puesto y nunca con la clave
    Dado la escena de un beat con cara montada
    Cuando se recorre lo que pinta el bloque de quien habla
    Entonces se ve el nombre y el rótulo del puesto
    Pero la clave interna del puesto no aparece por ninguna parte

  Escenario: La declaración de rótulos es la fuente única, y A4P3 es hoy el único sitio que enseña un puesto
    Dado todos los sitios del juego que manejan el puesto de una cara
    Cuando se mira cuáles lo enseñan
    Entonces solo lo enseña la escena de un beat
    Y el texto que enseña sale de la declaración de rótulos y no de una segunda traducción
```

---

---

## 13 · Lo que va a mano

Estos escenarios están escritos igual que los demás para que vivan en la misma lista, pero los pasa una persona leyendo. Etiquetarlos `@manual` en vez de dejarlos fuera es lo que evita que se olviden.

```gherkin
# language: es

@manual @lenguaje
Característica: El tono y la prosa, que no se pueden afirmar con una aserción
  Se puede comprobar que un texto no es ofensivo; no que tenga gracia.
  Fuente: bucle-jugable.md §6 · lenguaje.md

  Escenario: El chiste nunca es a costa del sitio real ni de quien lo regenta
    Dado el catálogo completo de textos de plantilla y una tanda de textos generados
    Cuando una persona los revisa uno a uno
    Entonces en ninguno el humor se dirige al negocio, al barrio ni a sus dueños
    Y en todos el desajuste entre la ficción y el sitio es lo que hace la gracia

  Escenario: El humor vive en cómo se cuenta, no en lo que pasa
    Dado una tanda de desenlaces generados
    Cuando una persona los revisa
    Entonces los hechos siguen importando
    Y los personajes se toman en serio a sí mismos

  Escenario: La revelación del anclaje emociona
    Dado un jugador que llega por primera vez a un sitio con visor
    Cuando arrastra el tirador
    Entonces una persona que lo observe confirma que el momento funciona

  Escenario: El reparto de NPCs se percibe equilibrado a lo largo de una partida
    Dado una partida de treinta días jugada de verdad
    Cuando una persona repasa a quién ha conocido
    Entonces ningún oficio aparece poblado siempre por el mismo género
```

## Por qué esos van a mano

Conviene que esté escrito, porque una suite que finge cubrirlo todo es peor que una que declara sus bordes.

- **Si el tono cómico-cálido funciona.** Se puede comprobar que un texto no es ofensivo y que pasa el filtro de aptitud; no se puede comprobar que tenga gracia. Va a revisión humana del catálogo, con la regla de `bucle-jugable.md` §6 como criterio: el humor vive en cómo se cuenta y el chiste nunca es a costa del sitio real.
- **Si la revelación del anclaje emociona.** Es el momento por el que existe el juego y no hay aserción que lo capture.
- **Si un mundo generado es bonito.** El informe de casting mide salud, no belleza. El declutter de rótulos sí es comprobable —ninguna caja se solapa con otra— y debe tener su prueba cuando se implemente.
- **Si el reparto de NPCs se percibe equilibrado.** Se mide por mundo, y eso sí está automatizado; lo que el jugador percibe es por partida, y son cosas distintas (`lenguaje.md`, pendiente 3).

```gherkin
# language: es

@nucleo
Característica: Ningún rótulo del mapa pisa a otro
  La colocación calcula posición y tamaño de todos los rótulos antes de pintar
  y garantiza que ninguno pisa a otro. Es la deuda de render más antigua del
  proyecto, y con placa opaca en los núcleos canta a la primera.
  Fuente: arquitectura.md · RF-MAPA-003
  Hueco cerrado: RF-MAPA-003, marcado «⚠ sin escenario» en docs/prd.md §4.9.

  Escenario: Ninguna pareja de rótulos se solapa en un mundo denso
    Dado un mundo urbano denso pintado con el estilo por defecto
    Cuando se colocan todos sus rótulos
    Entonces ninguna pareja de cajas se solapa

  Escenario: Ningún rótulo pisa un glifo ni la cartela ni la brújula
    Dado un mundo cualquiera con su cartela y su brújula
    Cuando se colocan todos sus rótulos
    Entonces ninguna caja pisa un glifo del mapa
    Y ninguna caja pisa la cartela ni la brújula

  Escenario: Ningún rótulo se sale del marco
    Dado un mundo con núcleos pegados al borde
    Cuando se colocan todos sus rótulos
    Entonces todas las cajas quedan dentro del marco

  Escenario: El rótulo de un núcleo no se retira mientras quepa en algún sitio
    Dado un mundo donde dos rótulos compiten por el mismo hueco
    Cuando se colocan
    Entonces el del núcleo conserva su nombre

  Escenario: Cuando dos no caben, se retira el de menor prioridad y su pueblo se sigue dibujando
    Dado un mundo donde dos rótulos protegidos no caben ni alejándolos
    Cuando se colocan
    Entonces se retira el nombre del de menor rango
    Pero su glifo se dibuja igual

  Escenario: Ningún rótulo se encoge ni se recorta para caber
    Dado un mundo con rótulos en conflicto
    Cuando se colocan
    Entonces todas las cajas conservan el tamaño que pide su estilo
    Y ningún texto aparece cortado

  Escenario: La misma colocación para el mismo mundo, el mismo estilo y el mismo encuadre
    Dado un mundo con su estilo y su encuadre
    Cuando se colocan sus rótulos dos veces
    Entonces las dos colocaciones son idénticas caja a caja

  Escenario: El orden de los candidatos no cambia la colocación
    Dado un mundo con su estilo y su encuadre
    Cuando se colocan sus rótulos con los candidatos en otro orden
    Entonces la colocación es idéntica caja a caja
```

## Lo que hay que montar para poder ejecutar esto

- **Fixtures de OSM congelados** para varios mundos: uno costero, uno urbano denso, uno de barrio de tres calles y uno en el suelo de 250 m.
- **GPS simulado** que recorra polilíneas a velocidad configurable, con paradas y con tramos a velocidad de vehículo.
- **Reloj de mundo controlable**, que es distinto del reloj del sistema: hay que poder pedir «avanza siete pasos» sin andar.
- **Doble del proxy** que devuelva respuestas fijas de LLM, de imágenes y de Places, más un modo que falle siempre, para los escenarios sin red.
- **Inspector de tráfico saliente** en las pruebas de privacidad, que es la única manera de afirmar «esto no sale del móvil» en lugar de suponerlo.

Y lo que este andamiaje tiene que cumplir, que hasta el 8-ago-2026 era la única pieza del repo sin criterios escritos antes que su código:

```gherkin
# language: es

@nucleo @determinismo
Característica: El andamiaje no puede dar por buena una ejecución que no ocurrió
  Un verde que nadie vio fallar no es evidencia. El runner afirma el PASS en
  lugar de suponerlo, y lo que no se pudo ejecutar se dice.
  Fuente: RF-INFRA-007 · arquitectura.md

  Escenario: Sin ninguna prueba que ejecutar el resultado no es verde
    Dado un árbol sin ningún fichero de pruebas de núcleo
    Cuando se ejecuta el runner
    Entonces el resultado no es PASS
    Y el report dice que no se ejecutó nada

  Escenario: Una prueba en rojo se ve aunque el entorno venga sucio
    Dada una prueba de núcleo que falla a propósito
    Cuando se ejecuta el runner desde dentro de otra ejecución de pruebas
    Entonces el resultado es FAIL
    Y coincide con el que da una consola limpia

  Escenario: Una salida que el runner no sabe leer no cuenta como verde
    Dada una ejecución de pruebas cuya salida no trae el resumen esperado
    Cuando se ejecuta el runner
    Entonces el resultado no es PASS
    Y el report dice que no se pudo afirmar nada de esa ejecución

  Escenario: La herramienta que no llega a comprobar nada lo dice
    Dada una comprobación del andamiaje invocada por una ruta con enlaces simbólicos
    Cuando termina
    Entonces emite su línea de veredicto
    Y no termina en silencio dando a entender que todo está bien

  Escenario: Maestro ausente no es una prueba en rojo
    Dado que Maestro no está instalado
    Cuando se ejecuta el runner con flujos de aplicación pendientes
    Entonces el report los registra como infraestructura ausente
    Y no los cuenta como fallos

  Escenario: Dos ejecuciones seguidas sobre el mismo árbol dicen lo mismo
    Dado un árbol de pruebas que no cambia
    Cuando se ejecuta el runner dos veces
    Entonces los dos reports coinciden salvo en el sello de tiempo y las duraciones
```

```gherkin
# language: es

@nucleo @determinismo @privacidad
Característica: Los dobles del andamiaje son reproducibles y no tocan el mundo real
  Un doble que sortea o que sale a la red deja de servir para afirmar nada.
  Fuente: RF-INFRA-007 · seguridad-privacidad.md §1

  Escenario: El mismo recorrido simulado dos veces da la misma secuencia
    Dado un recorrido con una polilínea, una velocidad y un origen de tiempo
    Cuando se simula dos veces
    Entonces las dos secuencias de posiciones son idénticas

  Escenario: El reloj de mundo no avanza con el reloj del sistema
    Dado un reloj de mundo en el paso cero
    Cuando pasa tiempo real sin pedirle nada
    Entonces sigue en el paso cero

  Escenario: El doble del proxy responde lo mismo a la misma petición
    Dada una petición al doble del proxy
    Cuando se repite la misma petición
    Entonces la respuesta es la misma

  Escenario: Ninguna pieza del andamiaje sale a la red al importarse
    Dado el inspector de tráfico saliente en modo estricto
    Cuando se importan todos los módulos del andamiaje
    Entonces no se registra ninguna llamada saliente
```
