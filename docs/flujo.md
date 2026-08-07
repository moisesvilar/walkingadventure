# El flujo del juego

Todas las pantallas de los seis artefactos de `docs/pantallas.md` y qué lleva de cada una a la siguiente. Los nodos son pantallas, etiquetadas **pantalla N · artefacto M**; las aristas llevan la acción que las recorre («pulsar Seguir») o la condición que las hace existir («solo si el desenlace era notable»).

Es la vista que ningún artefacto por separado puede dar: cada uno dibuja un momento, y las costuras entre momentos solo se ven aquí. De hecho las dos veces que un artefacto estaba mal —el visor sin salida hacia la escena, el cierre en corto leído como alternativa al mapa— el fallo era una arista que no existía.

**Se verifica solo.** `node scripts/verifica-flujo.mjs` extrae las pantallas de los seis HTML de `docs/pantallas/` y comprueba que el diagrama las contiene todas, sin sobrantes ni sueltas. Si se añade una pantalla a un artefacto, el script falla hasta que aparezca aquí.

**Lectura de las aristas.** Línea continua es un paso que ocurre; línea punteada es una relación que no es un paso: volver atrás, una equivalencia entre pantallas, o algo que se desbloquea. Los rombos son los tres puntos donde el camino se bifurca por el estado del mundo y no por lo que el jugador toque.

```mermaid
flowchart TD
  %% ————— Los seis artefactos —————
  subgraph A1["Artefacto 1 · El arranque"]
    A1P1["pantalla 1 · artefacto 1<br/>Quién eres"]
    A1P2["pantalla 2 · artefacto 1<br/>Tu tramo"]
    A1P3["pantalla 3 · artefacto 1<br/>El permiso"]
    A1P4["pantalla 4 · artefacto 1<br/>Dónde se levanta"]
    A1P5["pantalla 5 · artefacto 1<br/>La generación"]
    A1P6["pantalla 6 · artefacto 1<br/>Tu mapa, el día uno"]
    A1P7["pantalla 7 · artefacto 1<br/>La primera aventura"]
  end
  subgraph A2["Artefacto 2 · Antes de salir"]
    A2P1["pantalla 1 · artefacto 2<br/>La portada"]
    A2P2["pantalla 2 · artefacto 2<br/>El zurrón"]
    A2P3["pantalla 3 · artefacto 2<br/>Lo que hay hoy"]
    A2P4["pantalla 4 · artefacto 2<br/>La ficha"]
    A2P5["pantalla 5 · artefacto 2<br/>La preparación"]
  end
  subgraph A3["Artefacto 3 · En marcha"]
    A3P1["pantalla 1 · artefacto 3<br/>El bolsillo"]
    A3P2["pantalla 2 · artefacto 3<br/>Si miras"]
    A3P3["pantalla 3 · artefacto 3<br/>Llega una noticia"]
    A3P4["pantalla 4 · artefacto 3<br/>Llega una oportunidad"]
    A3P5["pantalla 5 · artefacto 3<br/>El desvío"]
    A3P6["pantalla 6 · artefacto 3<br/>La Escaleira Vella"]
    A3P7["pantalla 7 · artefacto 3<br/>La que no vamos a hacer"]
  end
  subgraph A4["Artefacto 4 · Al parar"]
    A4P1["pantalla 1 · artefacto 4<br/>El visor, lado de la ficción"]
    A4P2["pantalla 2 · artefacto 4<br/>El visor, arrastrado"]
    A4P3["pantalla 3 · artefacto 4<br/>La escena"]
    A4P4["pantalla 4 · artefacto 4<br/>Lo que te llevas"]
    A4P5["pantalla 5 · artefacto 4<br/>Lo que aquí se cuenta"]
    A4P6["pantalla 6 · artefacto 4<br/>La segunda vez"]
    A4P7["pantalla 7 · artefacto 4<br/>La ficha de texto"]
    A4P8["pantalla 8 · artefacto 4<br/>El sitio que no pega"]
  end
  subgraph A5["Artefacto 5 · El telón"]
    A5P1["pantalla 1 · artefacto 5<br/>El mapa se entinta"]
    A5P1B["pantalla 1B · artefacto 5<br/>Cuando no descubriste nada"]
    A5P2["pantalla 2 · artefacto 5<br/>El desenlace"]
    A5P2B["pantalla 2B · artefacto 5<br/>El cierre en corto"]
    A5P3["pantalla 3 · artefacto 5<br/>Lo que se pone en camino"]
    A5P4["pantalla 4 · artefacto 5<br/>La entrada del día"]
  end
  subgraph A6["Artefacto 6 · De consulta"]
    A6P1["pantalla 1 · artefacto 6<br/>La portada, sin barra"]
    A6P2["pantalla 2 · artefacto 6<br/>El diario, por días"]
    A6P3["pantalla 3 · artefacto 6<br/>La primera vez que triangulas"]
    A6P4["pantalla 4 · artefacto 6<br/>El diario, por historias"]
    A6P5["pantalla 5 · artefacto 6<br/>La repisa"]
    A6P6["pantalla 6 · artefacto 6<br/>Los ajustes"]
    A6P7["pantalla 7 · artefacto 6<br/>Empezar de nuevo"]
  end

  %% ————— Los tres puntos donde el mundo bifurca el camino —————
  LLEGA{"pararse dentro del<br/>geofence de un sitio"}
  CIERRA{"qué hay debajo<br/>del visor"}
  NUCLEO{"¿el sitio es<br/>un núcleo?"}

  %% ————— Las aristas: acción que se pulsa o condición que la hace existir —————
  A1P1 -->|"Seguir"| A1P2
  A1P2 -->|"Seguir"| A1P3
  A1P3 -->|"conceder la ubicación mientras se usa"| A1P4
  A1P4 -->|"Levantar el mapa aquí"| A1P5
  A1P5 -->|"al terminar de generar, sin pulsar nada"| A1P6
  A1P6 -->|"Seguir"| A1P7
  A1P2 -.->|"‹ atrás, con lo contestado precubierto"| A1P1
  A1P3 -.->|"‹ atrás"| A1P2
  A1P4 -.->|"‹ atrás"| A1P3
  A1P5 -.->|"desde aquí ya no se vuelve: lo generado no se resiembra"| A1P6
  A2P1 -.->|"misma pantalla, redibujada sin barra de pestañas"| A6P1
  A2P1 -->|"Ver qué se cuenta hoy · solo con pasos de fondo activos y reserva sin vaciar"| A2P2
  A2P2 -->|"Seguir"| A2P3
  A2P1 -->|"Ver qué se cuenta hoy · sin reserva que vaciar"| A2P3
  A2P3 -->|"elegir una de las tres, como mucho"| A2P4
  A2P4 -.->|"‹ volver a la lista"| A2P3
  A2P4 -->|"Aceptar la aventura"| A2P5
  A2P5 -->|"Salir a andar · con red o sin ella, la pantalla dice lo mismo"| A3P1
  A2P1 -->|"Salir a andar sin más"| A3P1
  A2P1 -->|"Seguir con la entrega · solo si quedó una salida abierta a medias"| A3P1
  A1P7 -->|"Salir a andar · fin del onboarding"| A3P1
  A3P1 -->|"sacar el móvil y mirar"| A3P2
  A3P2 -.->|"guardarlo otra vez"| A3P1
  A3P1 -->|"un rumor alcanza un sitio · háptico desde el bolsillo, y al mirar"| A3P3
  A3P3 -.->|"guardarlo: la noticia sedimenta y sigue ahí"| A3P1
  A3P1 -->|"entrar en el geofence de un micro-encuentro · notificación más háptico"| A3P4
  A3P4 -->|"tocar el aviso, andando: abre el mapa con la marca"| A3P2
  A3P4 -.->|"ignorarlo · se ofrece una segunda vez, en otra salida y en otro sitio"| A3P1
  A3P2 -->|"llegar a un cruce con un paraje fuera del lazo"| A3P5
  A3P5 -.->|"no girar · el paraje sigue ahí para otro día"| A3P2
  A3P2 -->|"la ruta rodea un camino que el filtro evita"| A3P6
  A3P6 -.->|"seguir andando por donde manda el trazado"| A3P2
  A3P2 -.->|"descartada a propósito: ninguna cifra de kilómetros, ritmo, progreso ni racha"| A3P7
  A3P1 -->|"dejar de andar"| LLEGA
  A3P5 -->|"girar hacia el paraje y llegar"| LLEGA
  LLEGA -->|"primera vez aquí y el sitio tiene ilustración"| A4P1
  LLEGA -->|"ya conocías el sitio"| A4P6
  LLEGA -->|"primera vez, pero sin ilustración: te pilló de paso"| A4P7
  A4P1 -->|"arrastrar el tirador"| A4P2
  A4P2 -->|"cerrar el visor (▾) · el visor es capa, no paso"| CIERRA
  CIERRA -->|"este sitio es un beat del lazo, o te cayó un micro-encuentro"| A4P3
  CIERRA -->|"no has venido a nada: el caso normal"| A4P7
  A4P3 -->|"Coger la caja"| A4P4
  A4P6 -->|"Volver a mirar la torre · el visor queda a un toque"| A4P1
  A4P6 -->|"hay beat hoy en este sitio"| A4P3
  A4P4 -->|"Seguir"| NUCLEO
  NUCLEO -->|"sí: aflora lo que allí se cuenta"| A4P5
  NUCLEO -->|"no, es un paraje: Seguir andando"| A3P1
  A4P5 -->|"Seguir"| A3P1
  A4P5 -->|"primera vez que oyes una segunda versión de algo ya apuntado"| A6P3
  A4P6 -->|"Seguir · no había nada que hacer aquí hoy"| A3P1
  A4P7 -->|"Seguir andando"| A3P1
  A4P7 -->|"Este sitio no pega"| A4P8
  A4P8 -->|"Marcarlo · reversible, y anota sin resembrar"| A3P1
  A4P8 -.->|"dejarlo como está"| A4P7
  A3P1 -->|"volver al punto de partida, o dar la salida por terminada desde el rótulo del sistema"| A5P1
  A5P1 -.->|"en su lugar, si hoy no viste nada que no supieras"| A5P1B
  A5P1 -->|"Seguir · había aventura y la terminaste"| A5P2
  A5P1 -->|"Seguir · volviste a mitad"| A5P2B
  A5P1 -->|"Seguir · saliste a andar sin coger nada"| A5P4
  A5P1B -->|"Seguir"| A5P4
  A5P2 -->|"Seguir · el desenlace era notable"| A5P3
  A5P2 -->|"Seguir · no era notable, no nace rumor"| A5P4
  A5P2B -->|"Seguir · un cierre en corto no genera rumor nunca"| A5P4
  A5P3 -->|"Seguir"| A5P4
  A5P4 -->|"Cerrar"| A6P1
  A5P4 -->|"Ver el diario entero"| A6P2
  A6P1 -->|"El diario"| A6P2
  A6P1 -->|"La repisa"| A6P5
  A6P1 -->|"Ajustes"| A6P6
  A6P1 -->|"Ver qué se cuenta hoy"| A2P3
  A6P1 -->|"Salir a andar sin más"| A3P1
  A6P2 -->|"abrir el capítulo de otro mapa · así se leen los sitios donde ya no estás"| A6P2
  A6P2 -->|"Ver por historias · solo si ya has triangulado una vez"| A6P4
  A6P4 -->|"Ver por días"| A6P2
  A6P3 -->|"Apuntarlo · ocurre en el sitio, no en casa"| A3P1
  A6P3 -.->|"a partir de aquí se abre la segunda manera de leer el diario"| A6P4
  A6P2 -.->|"‹ volver"| A6P1
  A6P5 -.->|"‹ volver"| A6P1
  A6P6 -.->|"‹ volver"| A6P1
  A6P6 -->|"Empezar de nuevo"| A6P7
  A6P7 -.->|"Dejarlo como está"| A6P6
  A6P7 -->|"Guardar una copia primero, o Borrar sin guardar nada"| A1P1

  classDef descartada stroke-dasharray: 5 4,opacity:0.55;
  class A3P7 descartada;
```

## Cómo leerlo

**El bolsillo es el centro de gravedad.** *Pantalla 1 · artefacto 3* es el nodo con más aristas de todo el diagrama, y es la pantalla que está diseñada para no mirarse. Todo lo que ocurre en la calle sale de ahí y vuelve ahí; el resto de los momentos son paréntesis entre dos ratos de andar.

**Solo hay tres rombos**, y ninguno es una pregunta al jugador: el sitio al que llegas, lo que hay debajo del visor y si el sitio es un núcleo. Las bifurcaciones de este juego las decide el mundo y el jugador decide con las piernas, que es lo que `bucle-jugable.md` §3 quería.

**El artefacto 3 casi no tiene aristas hacia dentro de sí mismo.** Sus pantallas cuelgan de la 1 y vuelven a la 1, sin encadenarse entre ellas: es la forma que toma en un diagrama la regla de que en marcha no hay ni un control tocable.

**Y hay dos entradas al arranque.** *Pantalla 1 · artefacto 1* la alcanza quien instala la app y quien pulsa «empezar de nuevo» en los ajustes, que es lo único del juego que borra un mundo que no se puede rehacer.
