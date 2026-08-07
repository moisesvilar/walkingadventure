# Prompt para generar el PRD

Para pegar en una sesión nueva sobre este repo. Escrito el 6-ago-2026, al cerrar el paso 2.

---

Vas a escribir el PRD de **Walking Adventure**, un RPG que se juega caminando físicamente por el mundo real. Es el paso 3 de un camino de cuatro que está descrito en `docs/pendientes.md`: arquitectura → pantallas → **PRD** → tareas de implementación.

## Antes de nada: qué NO es fuente

- **Ignora `app/` por completo.** Es el prototipo v0.1 del generador y no describe el producto: no lo leas para sacar requisitos, no dejes que su estructura condicione el alcance y no supongas que algo está resuelto porque ahí hay código. Lo único que el PRD tiene que decir sobre él es lo que dice `game-design/arquitectura.md` §2: el generador **se porta** a un paquete compartido y se refactoriza, y el render, las pantallas y la capa de datos se hacen **de cero**.
- **Ignora `archive/`**, que son instantáneas congeladas de implementaciones viejas.
- **`docs/starting.md` no es fuente de requisitos.** Es la bitácora, en orden cronológico, y contiene estados que después se revirtieron: entradas escritas cuando los mapas se llamaban «comarcas», cuando había XP, cuando el telón estaba sin decidir. Leerla como especificación resucita decisiones muertas. Úsala solo para entender **por qué** algo se decidió, y siempre después de haber leído el documento de `game-design/` que manda.

**La regla de precedencia, que vale para todo el trabajo:** manda `game-design/`. Si un artefacto, la bitácora o la batería de pruebas contradicen un documento de `game-design/`, el documento tiene razón y lo otro está desactualizado — dilo en el PRD en lugar de elegir en silencio.

## Orden de lectura

Léelo todo antes de escribir una línea del PRD, y en este orden, que no es alfabético: cada bloque hace falta para entender el siguiente.

### Bloque 0 — el marco (3 documentos)

1. `README.md` — qué es esto en una página.
2. `CLAUDE.md` — cómo trabaja el repo, sus reglas duras y sus trampas conocidas. Salta las secciones de Overpass en Docker y de estado compartido entre worktrees: son del prototipo.
3. `docs/pendientes.md` — dónde estamos, los cuatro pasos, y **lo que sigue abierto**. Los tres pendientes que importan están listados ahí.

### Bloque 1 — el diseño del juego (14 documentos, en este orden)

La columna vertebral primero, porque todo lo demás la modifica:

4. `game-design/bucle-jugable.md` — **el más importante**. Los tres pilares, los cuatro momentos de una salida y nueve decisiones. Si solo pudieras leer uno, sería este.
5. `game-design/quests.md` — la unidad de aventura: estructura de beats, la frontera árbitro/narrador (qué escribe el código y qué el LLM), los kilómetros como reloj del mundo y la propagación de rumores por el árbol de calzadas.
6. `game-design/parajes.md` — los ocho tipos de hito no habitado y por qué la cobertura de escenas manda sobre la afinidad del anclaje.
7. `game-design/parametros-mundo.md` — cupos y dimensionado. Léelo con `parajes.md` al lado: aquel enmienda a este.
8. `game-design/alcance-del-mundo.md` — la rejilla de celdas, el mundo que es del jugador, una partida con muchos mapas.
9. `game-design/accesibilidad.md` — el tramo como unidad personal. Va después del bucle a propósito: lo redimensiona entero.

Y encima de esa columna, lo que la puebla:

10. `game-design/arranque.md` — los primeros días, el prólogo, el hito que cierra el arranque.
11. `game-design/personaje.md` — nombre y oficio, el mote, el modo compañía.
12. `game-design/npcs.md` — la capa de NPCs, la generación perezosa, la memoria corta y fiel. Trae un principio de proyecto que se usa en más sitios: *lo que el jugador no controla puede abrirle puertas, nunca cerrárselas*.
13. `game-design/progresion.md` — rango social por núcleo, el oro, los objetos como llaves.
14. `game-design/lenguaje.md` — cómo escribe este juego. Condiciona todo texto que llegue al jugador y el prompt del LLM.

Las tres que son restricción dura sobre la implementación:

15. `game-design/seguridad-privacidad.md` — qué sale del móvil y qué no. **Es de las dos áreas bloqueantes.**
16. `game-design/partida-guardada.md` — el mundo congelado entero, estado y hechos, el respaldo, y empezar de nuevo.
17. `game-design/arquitectura.md` — React Native con Expo, el paquete compartido que sigue corriendo en Node, el proxy ciego, Overpass propio. Es decisión cerrada, no una propuesta: el PRD la asume, no la discute.

### Bloque 2 — la forma del producto (3 sitios)

18. `docs/pantallas.md` — índice de los seis artefactos de diseño de pantallas, con el resumen de qué cerró cada uno.
19. `docs/pantallas/*.html` — los seis artefactos. Son cuarenta pantallas dibujadas, cada una con notas que citan la decisión de la que sale. Léelos: aquí está el detalle de interfaz que ningún documento de `game-design/` contiene.
20. `docs/flujo.md` — el diagrama de estados de las cuarenta pantallas, con la acción o la condición de cada transición. Es la única vista de las costuras entre momentos.

### Bloque 3 — lo que ya está verificado (1 documento)

21. `docs/testing.md` — **174 casos en Gherkin escritos antes de implementar**, cada característica citando la decisión de la que sale. Léelo entero y trátalo como lo que es: el criterio de aceptación ya redactado. El PRD no tiene que reinventarlo, tiene que apuntar a él.

### Bloque 4 — contexto, no normativo

Solo si te hace falta resolver una duda, y sin sacar requisitos de aquí:

22. `docs/el-hacedor-de-mundos.md` — de dónde salió el diseño de la vida del mundo.
23. `docs/overpass-alternative.md` — alternativas de datos evaluadas.
24. `docs/ideas.md` — ideas sin cerrar, que no son compromisos.
25. `docs/starting.md` — la bitácora, con la advertencia de arriba.

## Formato de salida

Sigue el esqueleto de `/somo-plan-fable` con **cuatro sustituciones**, y déjalas declaradas en el propio PRD para que nadie las lea como omisiones:

**1 · No hay exploration report, y las anclas son otras.** La skill pide trazar cada requisito a `PD-NN`/`REQ-NN`. Aquí se traza a las decisiones cerradas, con este esquema, que tiene que ser greppable:

- `[bucle-jugable.md §3]` para una decisión de diseño.
- `[flujo: A4P2]` para una pantalla del diagrama.
- `[testing.md: «El visor abre por la ficción la primera vez»]` para un criterio de aceptación ya escrito.

**Un RF sin al menos un ancla no entra en el PRD.**

**2 · Personas → Ejes de variación.** No hay segmentos de usuario que inventar. Lo que cambia el producto es: el **tramo** del jugador (de 250 m a varios km, y el juego entero se redimensiona), el **oficio** (filtra el catálogo y es permanente), la **densidad del mundo** (barrio de tres calles contra urbano denso), los **pasos de fondo** (opt-in, apagado de origen) y la **cobertura** (una salida entera se juega sin red). Describe cada eje por lo que obliga a soportar, no por un personaje ficticio.

**3 · Casos de uso → los que ya existen.** No inventes `CU-NN`. `docs/flujo.md` tiene las cuarenta pantallas encadenadas y `docs/testing.md` los 174 casos. Referencia, no dupliques: dos listas de casos de uso se desincronizan siempre.

**4 · KPIs → exclusión explícita, con lo que sí se mide.** Este producto **no puede tener KPIs de producto sin romper su propia decisión de privacidad**: del móvil no sale nada del jugador y el proxy no registra quién llama (`seguridad-privacidad.md` §1, `arquitectura.md` §3). No hay analítica posible y eso es una decisión, no una carencia. Escríbelo como exclusión y pon en su lugar lo que sí es medible: la salud del generador (porcentaje de plantillas que castean, cobertura de escenas, `test/casting-report.mjs`), el coste por jugador en llamadas de LLM e imagen, el rendimiento del render, y la lista de revisión `@manual` de `docs/testing.md`.

### Secciones del PRD

1. Contexto y visión
2. Ejes de variación *(en lugar de Personas)*
3. Alcance: el juego completo, con lo que queda explícitamente fuera
4. Requisitos funcionales `RF-CAT-NNN`, en tabla, con criticidad y anclas
5. Requisitos no funcionales `RNF-CAT-NNN` — determinismo, privacidad, funcionamiento sin red, accesibilidad, rendimiento del render, coste
6. Exclusiones explícitas, con los KPIs entre ellas y su porqué
7. Supuestos y decisiones pendientes *(ver abajo)*
8. Riesgos
9. Roadmap como vista de agrupación, no como calendario
10. Historial de cambios

Categorías sugeridas para los códigos: `MUNDO` (generación, rejilla, cupos) · `QUEST` · `RUMOR` · `BUCLE` · `MAPA` (render) · `NPC` · `PROG` (rango y economía) · `DIARIO` · `PRIV` · `PERS` (partida guardada) · `LANG` · `INFRA`.

### Y una comprobación que este repo permite y casi ningún proyecto tiene

La batería de pruebas es **anterior** al PRD. Aprovéchalo en las dos direcciones:

- Cada RF debería poder apuntar a los escenarios de `docs/testing.md` que lo verifican. **Si un RF no tiene ninguno, dilo en el propio RF** — es un hueco de cobertura de la batería, no un problema del requisito.
- Y al revés: si encuentras características en `docs/testing.md` que no corresponden a ningún RF, es que el PRD se está dejando algo. Repásalo antes de entregar.

## Lo que el PRD no debe hacer

- **No relitigar el diseño.** Las decisiones están cerradas y razonadas. Si crees que una está mal, dilo aparte, no la cambies en el PRD.
- **No parafrasear el rationale.** El *por qué* ya vive en `game-design/` y es largo. El PRD es el *qué*, con un ancla que lleve al porqué. Si un RF necesita tres párrafos de justificación, ancla y sigue.
- **No inventar requisitos** que ningún documento respalde, ni siquiera obvios: si hace falta y no está decidido, va a §7 como supuesto declarado.
- **No confundir PRD con spec.** El cómo es de `/somo-spec-fable`.
- **No convertir en requisito lo que es una idea sin cerrar.** `docs/pendientes.md` tiene una sección de ideas que explícitamente no son compromisos.

## Lo que sigue abierto y hay que declarar como supuesto

Tres pendientes de diseño sin cerrar, que el PRD no debe resolver por su cuenta pero sí registrar, porque de ellos cuelgan requisitos:

1. **El tamaño de la celda en tramos** (`alcance-del-mundo.md`, pendiente 1). Hay criterio —una celda tiene que contener el suelo de parajes— pero no número, y sale midiendo. De él cuelga la rejilla entera.
2. **Qué cuenta como «moverse»** (`accesibilidad.md`, pendiente 1). El vehículo se cerró el 6-ago-2026 —se aparta—, pero la bici y la silla eléctrica siguen abiertas y arrastran el reloj del mundo.
3. **Si el rango puede bajar** (`progresion.md`). Tiene propuesta escrita y sin ratificar.

Y hay flecos menores anotados al final de cada documento de `game-design/`: casi todos son contenido que se decide al escribirlo (los nombres de los tres escalones de rango, la lista exacta de oficios) o números que solo salen midiendo. No los conviertas en requisitos ni los resuelvas: recógelos donde toque.

## Entregables

- `docs/prd.md`
- `docs/checklist.md`, el backlog del pipeline en el formato tabla canónico de `/somo-plan-fable`. Ese nombre está reservado a propósito en `CLAUDE.md` para esto.

Al terminar, anota la iteración al final de `docs/starting.md` con fecha, qué se decidió y con qué se verificó, que es la convención del proyecto.

## El alcance ya está decidido

**El PRD cubre el juego completo**, todo lo que los catorce documentos de `game-design/` dan por decidido. No recortes a un primer alcance jugable ni marques fases por tu cuenta: el orden de ataque lo fija el checklist, que es donde vive el orden de ejecución del pipeline.

Eso tiene dos consecuencias que conviene asumir en vez de pelear:

- **Va a salir un documento grande**, y está bien. Lo que no puede salir es un documento inflado: la manera de que sea grande y legible es que cada RF sea una línea de tabla con su ancla, y que el rationale viva en `game-design/` y no aquí.
- **El checklist tendrá muchas filas antes de que nada funcione.** Por eso importa la regla de derivación de `/somo-plan-fable`: una fila por spec implementable y testeable de una pasada, no una fila por RF. Un CRUD de cuatro RF es una spec; un RF gigante se parte.
