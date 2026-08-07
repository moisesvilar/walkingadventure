# La partida guardada (5-ago-2026)

El inventario venía casi hecho por el resto de decisiones: la semilla, el contador de pasos y su resto, la lista de mapas con lo que sabes de cada uno y sus rangos por núcleo, lo que se cuenta en cada sitio, los rumores en vuelo, la cola de entregas, el diario, la repisa, los objetos-llave, el personaje con su oficio y su género gramatical, los NPCs conocidos con su memoria y su relación, los anclajes descartados y los textos que el LLM haya escrito, que `quests.md` decisión 1 manda guardar con la partida.

Quedaban tres preguntas.

## Decisiones

### 1. El mundo se congela entero

Parecía que bastaba con guardar la semilla y regenerar, porque el generador es determinista. La trampa está en la letra pequeña del determinismo del proyecto: **misma semilla más los mismos datos de OSM** da el mismo mundo, y los datos de OSM cambian. Alguien mapea una calle, un bar cierra, un tag se corrige. Regenerar tu mapa dentro de un año daría otros núcleos y otros nombres, que es justo lo que prohíbe `bucle-jugable.md` §5.

Así que se guarda todo lo generado: núcleos con sus servicios, parajes, calzadas con su trazado, terreno, nombres y anclajes reales. Unos pocos megas por mapa, con las polilíneas de calzadas y terreno como grueso. Tu mapa deja de depender de OSM para siempre.

Y sale gratis una propiedad que el pendiente de seguridad había dejado suelta —qué se hace sin cobertura—: **una salida entera se juega sin red**. La red hace falta en dos momentos, y ninguno es andando: al abrir un mapa nuevo, para generarla, y antes de salir, para los textos y las imágenes del reparto que `bucle-jugable.md` §2 ya exigía tener listos de antemano.

### 2. Se guardan el estado y los hechos, y manda el estado

Se guarda el estado tal cual —rangos, oído, vuelo, cola, diario, repisa, NPCs— y además el registro de lo que has hecho, como red de seguridad y para poder auditar por qué pasó algo.

Dos verdades en paralelo es el bug clásico, así que van con tres reglas:

- **El estado es la verdad. El registro es auditoría y reconstrucción de emergencia.** Si al reconstruir sale otra cosa, gana el estado, salvo que el estado no se pueda leer.
- **El registro tiene que ser suficiente para reconstruir**, o no sirve de nada: cada cosa que altera el estado deja hecho. Pasos ejecutados, sitios pisados, aventuras aceptadas, cerradas o abandonadas, decisiones dentro de una quest, entregas atendidas o ignoradas, anclajes descartados, NPCs conocidos, objetos obtenidos.
- **Al reconstruir con una versión nueva, el resultado puede diferir del que tenías**, porque las reglas habrán cambiado. Ocurre solo en el caso de emergencia, y hay que avisar en lugar de disimularlo.

### 3. La copia del sistema, y exportar para quien quiera

Aquí hay una corrección de `seguridad-privacidad.md`, cuyo pendiente 1 proponía como red de seguridad **exportar la semilla**: un código copiable en ajustes. La decisión 1 de este documento lo invalida, porque con el mundo congelado la semilla ya no reproduce nada. Lo que hay que poder sacar es la partida entera, y eso son megas.

La partida se guarda donde el sistema hace copia automática —iCloud o Google Backup—, que va cifrada, bajo la cuenta del propio jugador y sin pasar por ningún servidor nuestro. Cubre a casi todo el mundo sin que nadie haga nada: móvil nuevo, sesión iniciada, el mapa aparece sola.

Con una salvedad que hay que decir en voz alta, porque matiza la decisión 1 de `seguridad-privacidad.md`: **ahí los datos sí salen del móvil**, aunque no hacia nosotros. Lo que sale es una partida —mundo, mapa, diario, rangos— dentro del respaldo cifrado del propio usuario. Sigue sin salir el rastro de ubicación, que nunca se guarda.

Y en ajustes, **exportar la partida a un fichero** para quien no quiera depender de nadie. Ese fichero pasa a ser también la vía de compartir mundo con otra persona, que `alcance-del-mundo.md` dejó como acto deliberado.

### 4. Empezar de nuevo, que es borrar y no reiniciar (6-ago-2026)

Faltaba en ajustes y no es un botón cualquiera. Por la decisión 1, **el mundo está congelado y no se puede rehacer**: empezar otra vez en la misma calle daría otro sitio con otros nombres, porque los datos de OSM ya han cambiado. Así que esto no es «volver a empezar», es destruir algo irrepetible, y la pantalla tiene que decirlo con esas palabras.

- **La copia se ofrece, no se hace sola.** Antes de confirmar se explica qué se pierde y se ofrece guardar el fichero; quien quiere irse limpio se va limpio y no le dejamos megas que no ha pedido. El precio es que hay que escribir el aviso para que se lea de verdad.
- **Y el fichero se puede volver a abrir**, porque es el mismo de la decisión 3. Eso convierte guardar copia en una salida real y no en un consuelo.
- **Se enumera lo que se pierde en cosas y no en datos**: el personaje, los mapas por su nombre, los días de diario y lo que la gente sabe de ti. «Esta acción no se puede deshacer» no dice nada que nadie lea.
- **Lo destructivo no es el botón principal.** Guardar copia va arriba; borrar sin nada es una elección explícita; salir sin hacer nada siempre está.

Aquí se habla como aplicación sin disfraz, y es el caso que mejor justifica la excepción de `lenguaje.md`: disfrazar esto de mundo sería una trampa.

## Lo que esto obliga a hacer

- **Serializar el mundo entero** por mapa, con las polilíneas, y no depender nunca de regenerar.
- **Escribir dos veces**: estado y registro de hechos, con el estado como autoridad declarada.
- **Una lista cerrada de hechos** que cubra todo lo que altera el estado.
- **Marcar la partida como respaldable** por el sistema, y comprobar que entra en la copia.
- **Exportar e importar** un fichero de partida, con su formato y su versión.
- **Versionado y migración** del estado entre versiones del juego.

## Pendientes

1. **Poda de mapas.** Unos pocos megas por mapa son nada; veinte mapas de veinte viajes ya se notan. Falta decidir si se podan, si se comprimen las que no visitas o si simplemente no importa.
2. **Formato y versión del fichero exportado**, que además es el vehículo de compartir mundo.
3. **Qué se le dice al jugador si la reconstrucción de emergencia da otro estado.** Hay regla —avisar— pero no texto, y es de los pocos sitios donde el juego tiene que confesar un fallo.
4. **Si los textos cacheados del LLM se exportan también.** Pesan, y son la piel de esa partida: sin ellos el mundo se lee con los textos de plantilla y no suena igual.
