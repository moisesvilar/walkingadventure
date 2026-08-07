# Seguridad, privacidad y menores (5-ago-2026)

`quests.md` §8 fija los principios desde el principio: contenido apto para menores, no dirigir a sitios físicamente problemáticos, horario diurno por defecto, nada que incentive correr ni cruzar mal, y pasos de fondo como opt-in explícito con permisos de salud y apagado de origen. Lo que faltaba era lo operativo.

Y al llegar aquí, buena parte estaba resuelta por decisiones tomadas por otros motivos: `personaje.md` quitó de en medio el nombre real, `progresion.md` prohibió que el oro toque dinero real o mande a consumir al negocio del anclaje, `alcance-del-mundo.md` hizo que nadie pueda cruzar dos mapas, `bucle-jugable.md` mantiene la pantalla apagada en marcha y `accesibilidad.md` filtra escalones y tierra del grafo viario.

## Decisiones

### 1. Del móvil no sale nada del jugador, y al LLM solo le llega ficción

La partida vive entera en el dispositivo y el rastro de ubicación no se envía a ningún sitio. Salen exactamente dos cosas:

- **La consulta de generación del mundo**: unas coordenadas, una vez, para pedir el terreno y los POIs.
- **Los prompts del LLM**, de los que se excluye todo dato real. El modelo ve nombres de fantasía, tipos abstractos y el tono; nunca el nombre del bar, nunca dónde has estado, nunca cuánto ni cuándo andas.

El anclaje real queda para los ojos del jugador. Eso añade una restricción dura al pendiente 4 de `quests.md`, que estaba casi especificado: **el prompt no lleva nombres reales**.

**Y «una vez» hay que defenderlo cada vez que aparece una pieza nueva** (6-ago-2026). El visor del anclaje necesita una foto del sitio real, y pedirla a Places es mandar qué sitio es. Al dibujarlo se vio que el momento de pedirla cambia cuánto se revela: por aventura, el proxy se enteraría de qué sitios tienes cerca y cuándo; al generar el mapa, va en la misma tanda que la consulta de Places que ya se hace, así que **no hay ninguna llamada nueva y esta regla no hay que enmendarla**. La lección que conviene tener escrita es la del método: cuando algo real tenga que salir del móvil, primero se mira si cabe en la llamada que ya existe.

Tiene un coste que conviene ver de frente. El guiño central del juego —que O Torreón Esquecido es el chiringuito de Manolo— deja de estar al alcance del modelo, así que ese chiste tendrá que salir de plantilla o del código, que es donde vive el dato real. El LLM pierde su mejor material.

### 2. Solo el permiso de ubicación «mientras se usa»

Abres el juego al salir y lo dejas corriendo con la pantalla apagada. El háptico avisa desde el bolsillo igual, y no hace falta el permiso de ubicación permanente, que es el más invasivo que existe en un móvil y el más difícil de justificar ante un padre.

Repasando lo decidido, ninguna pieza del juego necesita más: una salida empieza cuando abres la app, y el modo de pasos de fondo lee los pasos acumulados de la app de salud **al abrir**, sin GPS mientras tanto.

**Y lo que sostiene ese permiso con la pantalla apagada es un rótulo del sistema** (6-ago-2026, al dibujar las pantallas de en marcha). Una salida abierta arranca un servicio en primer plano con notificación persistente —Actividad en Vivo en iOS—, y eso es exactamente lo que hace que la app siga contando como «en uso» mientras el móvil va en el bolsillo. Así que el permiso permanente no se pide, no porque nos apretemos, sino porque el diseño no lo necesita. Dos condiciones: **el rótulo es tan austero como el resto del momento** —hacia dónde vas y nada más, ni una cifra— y **es visible a propósito**, porque una app que sigue leyendo tu ubicación tiene que decirlo mientras lo hace.

- **El permiso se pide en contexto**, explicando para qué, y nunca al instalar. El momento es **al levantar el primer mapa**, no al empezar la primera salida: generarlo necesita saber por dónde andas y ocurre antes. (Corregido el 5-ago-2026 al dibujar las pantallas del arranque, que es donde se vio el desfase.)
- **Si el sistema mata la app, no se pierde nada.** Los avisos no transportan información que pueda perderse: la noticia sigue sedimentada en su núcleo y la oportunidad sigue en la cola. "Ignorarlo es gratis" cubre también el caso de no haberte enterado.

### 3. El anclaje que no vale lo marca el jugador

Un gesto de dos toques —"aquí no se puede llegar"— y ese sitio deja de aparecer en aventuras, conservando su nombre y su posición en el mapa. Anotar no es resembrar, así que el invariante de `bucle-jugable.md` §5 queda intacto.

El que camina sabe más que OSM: esa escalera puede tener una rampa que nadie ha mapeado, ese parque puede ser un solar, esa finca puede tener un perro. Y el mismo gesto sirve para "aquí no me apetece ir", sin que nadie tenga que explicar por qué. Se deshace igual de fácil.

- **El filtro previo por tipos sigue siendo la primera línea**: industrial, obras, propiedad privada y locales de adultos se descartan al generar, aplicando la doctrina que `parajes.md` ya tiene para los tags. El filtro quita lo que OSM sabe; el gesto del jugador, lo que OSM no puede saber.
- **Y hay alarma para el que vacíe el mapa.** El suelo de cuatro parajes de `parajes.md` marca el punto por debajo del cual no se pueden montar aventuras; al llegar ahí entra el estirón ofrecido de `bucle-jugable.md` §7: "por aquí cerca ya no queda gran cosa que contar, ¿te alejas un poco?".

### 4. El juego no distingue a un menor: es apto por diseño

Sin verificación de edad, sin modo infantil y sin preguntar nada. Es la misma lógica que en `accesibilidad.md`: no hay un modo, hay una forma de estar hecho.

Lo que protege a un crío ya está puesto por otras razones, y protege igual a todo el mundo:

| Riesgo | Lo que ya lo cubre |
|---|---|
| Gasto o publicidad encubierta | El oro no toca dinero real ni manda a consumir en el negocio del anclaje (`progresion.md`) |
| Datos personales | Nombre inventado (`personaje.md`), nada sale del móvil (decisión 1) |
| Contacto con desconocidos | No hay chat ni jugadores conectados (`alcance-del-mundo.md`, `personaje.md`) |
| Compulsión | Nada de rachas diarias, ignorar es gratis, ausencia sin penalización (`bucle-jugable.md`, `quests.md` decisión 4) |
| Contenido | Filtro de aptitud sobre todo texto del LLM, y el humor nunca a costa del sitio real ni de quien lo regenta (`quests.md` decisión 1, `bucle-jugable.md` §6) |
| Esfuerzo físico | Nunca se falla por piernas, el tramo es personal, nada incentiva correr (`accesibilidad.md`, `quests.md` §3 y §8) |
| Sitios problemáticos | Filtro de tipos, filtro del grafo, y el gesto de descartar (decisión 3, `accesibilidad.md`) |

El **horario diurno** queda como ajuste activado de origen —no se ofrecen salidas de noche— que cualquiera puede quitar. Y para vigilar a un hijo están los controles de familia que el móvil ya trae: el juego no compite con ellos ni reimplementa el compartir ubicación, que exigiría servidor y cuentas.

## Lo que esto obliga a hacer

- Un **contrato de prompt sin datos reales**, con la lista explícita de qué campos pueden viajar.
- Que el **dato del anclaje real** viva solo en el dispositivo y no entre nunca en una llamada de red.
- **Permiso de ubicación "mientras se usa"** pedido en contexto, y lectura de pasos de salud al abrir para el modo de fondo.
- **Gesto de descarte** de anclaje, reversible, con su efecto sobre el casting y sin tocar el mapa.
- **Filtro de tipos problemáticos** en la consulta de POIs.
- **Ajuste de horario diurno** activado de origen.

## Pendientes

1. ~~**Exportar la semilla.** `alcance-del-mundo.md` dejó que perder la semilla es perder el mundo entero y que tiene que sobrevivir a un cambio de móvil, y la decisión 1 cierra la puerta a guardarla en ningún servidor. La única vía compatible es que el jugador la saque: un código copiable en ajustes.~~ → resuelto el mismo día en `partida-guardada.md`, y de otra manera: al congelarse el mundo entero, **la semilla ya no reproduce nada**, así que lo que hay que poder sacar es la partida completa. Va por la copia del sistema (iCloud o Google Backup, cifrada y bajo la cuenta del jugador, sin servidor nuestro) más un fichero exportable a mano. Matiza esta decisión 1: en el respaldo del sistema **los datos sí salen del móvil**, aunque no hacia nosotros — y lo que nunca sale, ni ahí, es el rastro de ubicación, que no se guarda.
2. **Qué pasa con la caché del proxy de generación.** Hoy el prototipo cachea las consultas de Overpass en disco por hash de la consulta, lo que en un servidor compartido sería un registro de qué coordenadas ha pedido gente. Con la app final generando contra la API directamente puede dejar de ser un problema, pero hay que decidirlo.
3. **Qué se le enseña al jugador sobre todo esto y cuándo.** Un juego que no manda nada a ningún sitio debería poder decirlo en una frase, y ese es un argumento de venta además de una obligación.
