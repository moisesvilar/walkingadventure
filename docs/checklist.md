# Checklist

Lista viva de lo que queda por hacer, para irle dando salida poco a poco. No sustituye a los documentos: las decisiones cerradas siguen en `game-design/` y el relato de cada iteración en `docs/starting.md`. Esto es solo el índice de trabajo pendiente, con el porqué de cada cosa y qué la bloquea.

Cuando algo se cierre, se tacha aquí con una línea de resultado y se anota la iteración en `docs/starting.md`.

## Ahora: lo que se puede hacer sin depender de nada

- [ ] **Motor de pasos del mundo y propagación por el grafo viario** — pendiente 8 de `game-design/quests.md`. Contador `n` con siembra `:tick:n`, kilómetros como reloj, reserva de 5 pasos en modo de fondo, propagación sobre el árbol de `buildRoutes` (latencia por metros, deformación por saltos, +1 en tramos `fallback`) y cola de entregas. **Capa sobre el mundo generado, no una fase de `build.js`.** Es lo que más devuelve por lo que cuesta: no depende de nada, funciona a granularidad de núcleo sin NPCs, y se verifica en headless sin red.
- [ ] **Declutter de rótulos** — `app/js/render/map.js`. El único pendiente de render que ya no es opcional: ninguno de los cuatro tratamientos probados arregla el racimo denso, y desde que Reino rotula núcleos sobre placa se nota más, porque dos cajas opacas que chocan cantan más que dos textos que se rozan.
- [ ] **Catálogo de escenas de 1 beat** — pendiente 3 de `quests.md`. La regla de aparición y el ciclo de abandono ya están decididos; queda escribir el catálogo. Cobra sentido junto al motor de pasos, que es quien lo alimenta.

## Después: la inversión grande

- [ ] **Capa de NPCs** — pendiente 2 de `quests.md`. Generación, casas ancladas con el mismo mecanismo de anclaje único que los servicios, y memoria de lo que saben del jugador. Es el cuello de botella del diseño de quests: desbloquea el catálogo de plantillas y mejora la propagación de rumores.
- [ ] **Ampliar el catálogo de plantillas-arquetipo** — pendiente 7. Bloqueado por los NPCs.
- [ ] **Contrato exacto con el LLM** — pendiente 4. Ya está casi especificado (esquema cerrado de campos inertes, dos puntos de invocación, registro de tópicos como restricción negativa). Queda el prompt real, el filtro de aptitud y la caché.

## Cosmético y de deuda

- [ ] **Placa para los otros cuatro estilos** — `placa: ['nucleo']` más su grupo `placa` en `app/js/render/styles.js`. Nadie lo ha pedido; solo si se quiere homogeneizar.
- [ ] **Detección de región por límites administrativos** — hoy `localeFor` es un bounding box, así que el occidente de Asturias o el Bierzo salen en gallego. Se arregla con límites de OSM.

## Ideas sin cerrar

Vienen de `docs/ideas.md` y no son compromisos: falta decidir si entran.

- [ ] Imágenes generadas para núcleos de población ficticios.
- [ ] Imágenes para POIs ficticios más un visor con slider que cruce del mundo ficticio a la foto real del anclaje.
- [ ] Retratos de NPC a partir de su descripción.
- [ ] Nombres para los ríos.

## Cerrados recientemente

- [x] **Diseño de la vida del mundo** (5-ago-2026) — decisiones 1, 3, 4 y sección 6 de `quests.md`: kilómetros como reloj, propagación por el árbol de calzadas, frontera árbitro/narrador y micro-encuentros como canal de entrega. Ver `docs/el-hacedor-de-mundos.md` para de dónde salió.
- [x] **Idioma de los nombres en todo el mundo, no solo en parajes** — resuelto de hecho: `build.js` resuelve `namesFor(localeFor(lat, lon))` una vez y `app/js/names/gl.js` implementa la interfaz completa. El pendiente estaba en `game-design/parajes.md` describiendo un problema que ya no existía.
