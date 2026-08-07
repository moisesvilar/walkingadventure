# La arquitectura de la app (5-ago-2026)

Decisión técnica, no de juego, pero vive aquí por dos razones: es una decisión cerrada, y de esta carpeta sale el PRD. Se decide **antes** del PRD porque condiciona la mitad de las tareas que salgan de él.

## Lo que el diseño ya exige

Nada de esto es negociable a estas alturas, y entre las cinco cosas descartan solas la vía más barata:

- Leer los pasos acumulados de la app de salud al abrir (`quests.md` decisión 4, `seguridad-privacidad.md` §2).
- Háptico desde el bolsillo, con el par de capas que exige `accesibilidad.md` §3.
- Notificaciones, reservadas a las oportunidades (`quests.md` decisión 3).
- La partida entrando en la copia del sistema y exportable a fichero (`partida-guardada.md` §3).
- Una salida entera funcionando sin cobertura (`partida-guardada.md` §1).
- Una salida abierta siguiendo viva con el móvil bloqueado y sin pedir el permiso de ubicación permanente (`seguridad-privacidad.md` §2).

**La PWA queda descartada sin discusión**: en web no hay HealthKit, el háptico en iOS es casi inexistente y no hay forma de entrar en el respaldo del sistema.

## Decisiones

### 1. React Native con Expo

JavaScript en el cliente, que es lo que permite compartir el generador determinista con los tests headless. Salud, háptico, notificaciones y respaldo se resuelven con módulos existentes, y el mapa se dibuja con Skia, que da el mismo canvas 2D que ya usa el prototipo. El coste asumido es depender de una capa intermedia y de sus versiones.

De aquí sale una regla que es la que hace que la elección valga la pena: **el núcleo determinista no puede importar nada de React Native**. Si lo hace, deja de correr en Node y se pierde `test/headless.mjs`, la red de seguridad más importante del repo. Lo que hoy es una costumbre del proyecto —JavaScript ESM puro, sin dependencias— pasa a ser requisito.

### 2. El generador vive en un paquete compartido, portado y refactorizado

El núcleo pasa a un paquete sin dependencias de plataforma que corre igual en Node y en la app: `core/`, `world/`, `names/`, `quests/` y la capa de partida. `test/headless.mjs` y `test/casting-report.mjs` siguen vivos desde el primer día.

Se hacen **de cero** el render, las pantallas y la capa de datos. Esto corrige la idea previa de reimplementar la aplicación entera: con JavaScript en el cliente, tirar el generador significaría quedarse sin garantía de determinismo mientras se rehacen sus tests, y eso no compensa.

- **La frontera ya está trazada en el prototipo**, aunque fuera por otro motivo: `buildWorld` recibe `fetchData` inyectado en lugar de llamar a la red por su cuenta. Esa es exactamente la línea entre el paquete compartido y la plataforma.
- **Portar no es copiar.** Lo decidido en `game-design/` cambia bastante ese código: la rejilla de `alcance-del-mundo.md` sustituye al radio, los cupos pasan a ser por celda, la cobertura de escenas de `parajes.md` invierte el orden de asignación de tipos, y el tramo personal de `accesibilidad.md` entra por donde hoy hay una constante suelta (`M_PER_MIN`). Se porta lo que sigue valiendo —RNG, geometría, nombres, casting, máscara de mar, colocación de núcleos, trazado de rutas— y se refactoriza el resto.

### 3. Va a haber servidor, y es un proxy ciego

`partida-guardada.md` y `alcance-del-mundo.md` presumen de que no hay servidor nuestro. Eso es cierto **para los datos del jugador**, y hay que escribir la parte que faltaba: el LLM, la generación de imágenes y Google Places necesitan claves de API, y una clave dentro de la app es una clave pública. Así que existe un proxy.

**Un proxy que guarda claves y reenvía ficción es otra cosa que un servidor con partidas dentro**, y esa distinción es la que hay que mantener:

- **Guarda las claves** y reenvía las llamadas de LLM, de imágenes y de Places.
- **Comprueba con App Attest y Play Integrity** que la llamada viene de una instalación legítima. Un proxy con claves y sin ninguna comprobación es un proxy que cualquiera puede usar con tu factura en cuanto extraiga la URL de la app; la atestación de plataforma verifica la app **sin identificar a la persona**, que es justo lo que hace falta.
- **Cachea solo lo inerte**: las imágenes por su prompt de ficción, que no dice nada de nadie y es lo que de verdad cuesta dinero. **Y las fotos de Places por sitio** (6-ago-2026), que son públicas y las mismas para todo el mundo, así que la caché las comparte entre quien pase por ahí y amortigua el coste de pedirlas en bloque. Se descartó un token anónimo por instalación, que habría sido más simple pero es un identificador persistente con el que se puede correlacionar todo lo que ha pedido un móvil.
- **No registra quién llama, ni desde dónde, ni guarda partidas.**

## Lo que esto obliga a hacer

- Un paquete compartido con **cero dependencias de plataforma**, verificado por que los tests sigan corriendo en Node.
- Toda la entrada y salida **inyectada** en el núcleo, nunca llamada desde dentro.
- El render trasladado a Skia, con los cinco estilos como objetos de datos igual que hoy.
- **Un algoritmo de colocación de rótulos que garantice que ninguno se solapa**, calculando posición y tamaño de todos antes de pintar. Es la deuda de render más antigua del proyecto y en el mapa del arranque se ve a la primera; con los núcleos sobre placa opaca, dos rótulos que chocan cantan mucho más que dos textos que se rozan.
- **Overpass propio**, con la imagen Docker del proyecto, para que generar un mapa no dependa de la cola de los mirrors públicos.
- Un proxy con atestación de plataforma, caché de imágenes por prompt y sin registro.
- Módulos de salud, háptico, notificaciones y respaldo, con la app funcionando aunque falten los tres últimos (`accesibilidad.md` §3: ninguna capa es portadora única).
- **Un servicio en primer plano con notificación persistente** mientras hay una salida abierta, y su equivalente en iOS con Actividad en Vivo. Es lo que mantiene la salida viva con el móvil bloqueado sin pedir el permiso de ubicación permanente, y es además la única superficie tocable que existe en marcha: desde ahí se puede dar la salida por terminada (`bucle-jugable.md` §8). Dos plataformas con ciclos de vida distintos, así que es trabajo de verdad y no un módulo que se instala. **Y se para solo** tras un buen rato sin que el jugador ande por su cuenta, sin cerrar la salida: no puede haber un servicio nuestro corriendo días (`bucle-jugable.md` §9).
- **Detección de modo de transporte**, para apartar el vehículo del motor de pasos y de la validación de geofences (`bucle-jugable.md` §9). Con criterios distintos según el efecto: la medición del tramo excluye la velocidad de vehículo, y contar kilómetros y validar geofences cuentan en la duda.

## Pendientes

1. ~~**Si Overpass va directo desde el móvil o por el proxy.**~~ → decidido el 5-ago-2026: **Overpass propio, en nuestro servidor**, con la imagen Docker que el proyecto ya usa en local. El motivo es la fricción, no la privacidad: contra los mirrors públicos la generación tarda minutos y esa espera cae justo en el onboarding, que es el peor sitio posible para perder a alguien. De paso, las coordenadas no van a un tercero.
2. **Qué pasa cuando la atestación falla**: dispositivos rooteados, emuladores, versiones viejas del sistema. Un rechazo duro deja fuera a gente legítima.
3. **El coste por jugador**: cuántas llamadas de LLM y de imagen cuestan un mapa y una salida. Es el presupuesto que el pendiente 4 de `quests.md` dejó abierto, y ahora tiene dónde medirse.
4. **Verificar que los cinco estilos se trasladan a Skia** sin perder el pintado, que es el producto visible de este proyecto.
