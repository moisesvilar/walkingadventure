# Encargo: la fila 54, el cuaderno de a bordo

Prompt para arrancar una sesión nueva. Se pega entero. Está escrito para que quien lo reciba no necesite nada de la conversación en la que nació.

---

Vas a trabajar en `walkingadventure` (rama `main`, limpia y subida, **con el proyecto entero en verde** — 2960 · 2957 · 0 · 3 y @app 21 · 12 · 0 · 9, PASS del runner; tu fila no puede ser la que lo pierda). Antes de tocar nada lee `CLAUDE.md` —todas las trampas del aparato—, `.claude/rules/naming.md`, `app/plataforma/puerta-de-desarrollo.js` **entero, incluida su cabecera**, y de `pipeline/decisiones-orquestador.md` los apartados **§6y**, **§14e** y **§17**. El bucle son las cuatro skills **del repo** —`wa-spec`, `wa-dev`, `wa-qa-dev`, `wa-qa-tester`—, nunca las `somo-*-fable` de usuario.

**Cada fase se lanza como subagente** (herramienta Agent), con la instrucción de seguir la skill del repo correspondiente; tu ventana principal solo orquesta, y los volcados largos van a disco y se leen con grep.

**Recursos (§14e)**: la verificación final toma el emulador — declara la toma antes del primer `adb` (con `pgrep`, no de memoria), suéltalo al cerrar, y el hash final queda inmóvil para el cotejo en worktree. Las tandas sin aparato, con `--nucleo-only`.

Tu fila es la **54, `cuaderno-de-a-bordo`** (SPEC-054, rama `pipeline/SPEC-054-cuaderno-de-a-bordo`), del bloque B8. Rationale: RF-INFRA-007. Ratificada por el dueño el 14-ago-2026.

## Por qué existe esta fila

**El dueño tiene un iPhone y el salto está cerca** (`docs/iphone.md`). En ese aparato no habrá Metro delante, y la lección está medida y escrita en `CLAUDE.md`: los `console.log` de esta app salen por Metro, no por `logcat` — en un dispositivo real de pie, **no hay ningún sitio donde mirar**. La herramienta que ese terreno pide es un **cuaderno de a bordo**: un interruptor en la puerta de desarrollo que, encendido, recoge logs exhaustivos de la ejecución, y un botón que comparte el fichero por la hoja del sistema (el dueño se lo manda a sí mismo y lo pega en una ventana de chat — el circuito es manual y suyo, a propósito). Se construye y se prueba **ahora, en `wa-pixel`, donde el terreno es conocido**, para no estrenar linterna y territorio a la vez.

No es feature de producto y no lo será: vive tras `__DEV__`, no sale en `docs/flujo.md` (doctrina §6y: es herramienta, como el andamiaje), y en una compilación de producción **no existe**.

## La tensión que esta fila resuelve declarando, no silenciando

**Medido hoy**: la cabecera de `puerta-de-desarrollo.js` declara una regla dura — la puerta «es INERTE en una compilación de producción, y **no escribe nada en el almacenamiento del dispositivo**. Una puerta que sobrevive al reinicio o que llega a producción es una puerta trasera.» Un cuaderno de logs **escribe por definición**, así que esta fila no puede colarse por debajo de esa frase: **la extiende en voz alta**. La forma propuesta, que tu spec afina o mejora con el porqué escrito:

- Los logs viven bajo un **prefijo propio fuera de la partida** (la familia de `cache/` — el mismo estatuto que la marca de agua de salud: fuera de la copia, fuera del respaldo, fuera del export, cosa que las reglas de respaldo ya garantizan para lo que no cuelga de `partida/`).
- **Apagar el interruptor borra el cuaderno**; desinstalar, también (va en cache).
- En producción, el módulo entero **no se registra** — no es que el interruptor esté apagado: no existe, afirmable por prueba.
- La cabecera de `puerta-de-desarrollo.js` se actualiza **con fecha** para que la regla escrita y la real vuelvan a coincidir: la puerta sigue sin escribir; el cuaderno, herramienta aparte tras la misma llave, escribe bajo su prefijo con su ciclo de vida declarado.

## Lo que ya existe y se reutiliza (medido hoy)

- **Media instrumentación está escrita**: la traza de la salida (`creaTrazaDeSalida`), el registro de capacidades, la marca `salida-averia` (de la 53, con su `sin-averia` explícito), y los eventos que la salida ya emite. El cuaderno **escucha lo que ya se emite** — no se siembran `console.log` por el código.
- Lo que sí añade y es oro en aparato real: **errores JS y promesas sin capturar** (los manejadores globales), con pila; y los momentos de decisión que hoy son invisibles de pie (cadencia elegida, fijo aceptado/rechazado con su edad, re-anclaje, aperturas y sus motivos).
- **Compartir: `Share.share({ url })`**, el mecanismo exacto de `copia-del-sistema.js:35`. Cero dependencias nuevas. Y la lección de la 53 aplica entera: `Share.share` **resuelve al lanzar el chooser** — nada destructivo ni de estado puede colgar de su resultado (el cuaderno no se borra al compartir; se borra al apagar).
- **Marcas de tiempo**: el cuaderno vive fuera de la partida, así que puede llevar reloj real (el de la capa de plataforma, §17) — SPEC-016 protege la partida y el registro del juego, no esto. Dilo en el comentario del módulo para que nadie lo confunda.
- **Tope de tamaño declarado** (anillo o troceo): un cuaderno que crece sin límite en un paseo largo es un aparato que se queda sin disco a mitad de medición.

## Privacidad, dicha entera

Los logs llevarán fijos, coordenadas y sitios reales **del dueño, en su aparato, compartidos por su mano** — ese es el trato y es aceptable porque el canal no existe en producción y no hay envío automático de nada: la app no manda; el dueño comparte. `@privacidad` sigue bloqueante para lo que sí es producto: la guarda de vías de despertar, el manifiesto y las promesas de `permisos.js` no se mueven ni un pelo por esta fila.

## Cómo se trabaja aquí

Las de siempre, sin excepción: nunca se edita una prueba para que pase; nada se da por bueno sin verificarlo (doce encargos, doce premisas falsas — si algo de aquí no se sostiene, dilo y para); todo se declara; no estires la fila (las decisiones de diseño de la mesa del dueño — botón atrás, telón al pasar por delante — no son tuyas); `state.json` y la columna `Estado` no se tocan. Las preguntas al dueño, en tu ventana, con bloque ask, una viva a la vez.

## Cuándo está hecho

1. **El cuaderno funciona de punta a punta en `wa-pixel`**: interruptor encendido en la puerta de desarrollo → un trecho de salida conducido (con el bucle de posición, que ya sabes que solo alimenta si alguien pide) → el botón de compartir produce un fichero legible con lo prometido dentro — posiciones con edad, cadencias, llegadas, marcas, y **un error JS provocado a propósito con su pila**.
2. **El ciclo de vida cumplido y afirmado**: apagar borra; el fichero vive fuera de `partida/` y no entra en copia ni en export (afirmado contra las reglas de respaldo, no supuesto); y en compilación de producción el módulo no se registra — con su prueba.
3. **La cabecera de `puerta-de-desarrollo.js` actualizada con fecha**, con la doctrina extendida escrita donde el siguiente la busque.
4. **El PASS se mantiene**: núcleo en 0 fallos con `mirado: true` en ambas, @app 21 · 12 · 0 · 9 o mejor, límite declarado en 9, y ninguna guarda peor sin motivo medido.
5. **`docs/iphone.md` actualizado**: el cuaderno pasa de «en preparación» a «preparado», con una línea de cómo se usa el día del salto.
6. **Checklist y bitácora al día**, y el **hash final declarado e inmóvil**.

Y lo último: si en algún momento hay que elegir entre parecer que todo va bien y decir que algo no cuadra, **di que no cuadra**.
