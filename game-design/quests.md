# Definición de quest (4-ago-2026)

Una quest es la unidad de aventura del juego: una cadena de escenas que el jugador completa caminando físicamente por el mundo real mientras ve su posición proyectada en el mapa de fantasía. El mundo generado (núcleos, servicios, parajes con escenas, rutas nombradas, NPCs) es el reparto disponible; la quest es la obra que se monta con él.

## Decisiones de diseño (forks resueltos)

1. **Generación: híbrido plantillas + LLM.** La ESTRUCTURA sale de un catálogo de plantillas-arquetipo escritas a mano y casteadas contra el mundo (determinista, testeable, con la semilla). La NARRATIVA la viste un LLM: ganchos, diálogos, descripciones únicas por mundo, a partir de la plantilla ya casteada. Restricciones: todo texto generado pasa filtro de contenido apto para menores; cada plantilla lleva textos por defecto dignos como fallback (sin red o sin presupuesto, la quest funciona igual); el LLM se invoca al crear la quest (no en tiempo real durante la caminata) y se cachea.
2. **Guiado: texto de mundo + marca en el mapa.** La indicación narrativa usa el lenguaje del mundo ("sigue La Calzada del Este hasta El Cruce del Ahorcado") Y el destino aparece marcado en el mapa de fantasía. El texto ambienta, el mapa confirma; las rutas nombradas son la infraestructura de navegación.
3. **Paralelismo: una principal + oportunidades.** Una quest principal dimensionada al preset marca el lazo de la salida; al pasar cerca de otros lugares pueden saltar micro-encuentros oportunistas de 1 beat (rumor, hallazgo, entrega rápida) que aprovechan la caminata sin romper el ritmo.
4. **Persistencia: una salida + arcos largos.** Cada quest se completa en la salida para la que se dimensionó (paseo/aventura/jornada). Lo persistente son los arcos: reputación, NPCs que recuerdan al jugador, cadenas de quests que se desbloquean en salidas sucesivas. Sesión cerrada, mundo continuo.

## Aspectos que cubre una quest

### 1. Identidad y gancho

Título, tema/tono y dador: quién la encarga y dónde (un NPC en la taberna, el tablón de anuncios, algo hallado en un paraje). El gancho responde "¿por qué voy a andar 2 km?": la motivación narrativa es la gasolina del jugador.

### 2. Estructura de beats

Cadena (o grafo pequeño) de beats. Cada beat define:

- **Lugar**: referencia a una localización del mundo con nombre y anclaje real (servicio, núcleo, paraje, casa de NPC). Nunca coordenadas sueltas.
- **Disparador**: llegar; llegar en franja horaria; llegar llevando/sabiendo algo.
- **Escena**: qué pasa allí (diálogo, descubrimiento, entrega, emboscada, visión...). La escena debe casar con las afinidades del lugar: los pesos de escena de los parajes son el sistema de casting, no decoración.
- **Resultado**: lo que empuja al siguiente beat — información (el siguiente lugar), objeto, cambio de estado.

Lineal de inicio; ramificación (elegir entre dos pistas) en iteraciones futuras.

### 3. Logística física (el corazón del juego)

- **Presupuesto por preset**: paseo ≈ 4-6 beats, aventura ≈ 6-10, jornada ≈ 10-14; tramo individual máximo ~30 min andando.
- **Forma de lazo**: la quest empieza y termina cerca del punto de inicio del jugador.
- **Guiado por rutas nombradas** (decisión 2).
- **Validación de llegada**: geofence generoso (~30-50 m, GPS impreciso), activable desde espacio público, tolerante a lugares reales cerrados o inaccesibles.

### 4. Tiempo

Franjas del mundo ("al anochecer", "por la mañana") y citas ("estará en la fuente a las seis"). Sin tiempos límite que metan prisa a quien camina (y con menores, menos). Persistencia según decisión 4: la quest vive en una salida.

### 5. Actores

NPCs implicados: dador, objetivo, secundarios. Cada NPC con nombre vive o trabaja en un lugar concreto (capa "casas de NPC": mismo mecanismo de anclaje único que los servicios). Estado: qué sabe, qué recuerda del jugador (alimenta los arcos largos).

### 6. Recompensa y consecuencia

Inmediata (oro, objeto, XP) y persistente (reputación con un núcleo, desbloqueos, cambios de mundo). Fallar por no llegar debe ser casi imposible: se falla por decisiones, no por piernas.

### 7. Plantilla y casting

Una quest no se escribe sobre lugares concretos sino como plantilla con ROLES: "una taberna", "un paraje con afinidad guarida a 10-20 min", "un NPC artesano". El generador castea los roles contra el mundo concreto con la semilla. Si el mundo no puede castear una plantilla, esa plantilla no se ofrece. Arquetipos iniciales candidatos: entrega, visita, cita, investigación con pistas, ronda de vigilancia, rescate/búsqueda.

### 8. Aptitud y seguridad (transversal)

Contenido apto para menores (principio de la spec, y filtro sobre todo texto LLM); no dirigir a sitios físicamente problemáticos; horario diurno por defecto; nada que incentive correr ni cruzar mal.

## Esquema tentativo de una quest casteada

```
quest:
  id, plantilla, semilla, preset (paseo|aventura|jornada)
  titulo, gancho              ← LLM (fallback: plantilla)
  dador: {npc, lugar}
  beats:
    - lugar (ref a localización del mundo)
      disparador: {tipo: llegada|franja|con_objeto, ...}
      escena: {tipo, texto ← LLM, afinidad_usada}
      resultado: {tipo: info|objeto|estado, siguiente_beat}
  presupuesto: {distancia_m, minutos_est, tramo_max_m}
  recompensa: {inmediata, persistente}
  estado: {beat_actual, completada, decisiones}
```

## Ejemplo ilustrativo (casteo sobre el mundo de Sanxenxo v0.1)

Plantilla "la entrega sospechosa" (aventura): el tabernero de {taberna: Taberna da Coroa Leda} pide llevar un paquete al herrero de {armeria: Forxa do Carballo Bailador}; por el camino, en {paraje guarida: O Torreón Esquecido}, alguien sale al paso y ofrece comprarlo (decisión); la entrega final revela qué era; vuelta con recompensa en la taberna. 4 lugares, lazo, ~35-45 min, una decisión con consecuencia de reputación.

## Pendientes

1. ~~Catálogo inicial de plantillas-arquetipo~~ → hecho (v0.1): 6 plantillas en `js/quests/templates.js` (entrega sospechosa, cita en la fuente, tres pistas, ronda del vigía, peregrinaje, rescate en la granja) con roles y textos de fallback.
2. Capa de NPCs: generación, casas ancladas, memoria (requisito de los actores y los arcos).
3. Micro-encuentros oportunistas: catálogo de 1 beat y regla de aparición (distancia, cooldown).
4. Contrato exacto con el LLM: qué campos viste, prompt, filtro de aptitud, caché.
5. ~~Simulador de casting en el prototipo~~ → hecho (v0.1): `js/quests/casting.js` castea el catálogo contra cada mundo generado (backtracking determinista con la semilla, tramos 0,1-2,4 km, lazo, escenas con peso ≥0,2); el panel lista casteables/no casteables con motivo, y la ficha dibuja el lazo numerado sobre el mapa con distancia y minutos estimados (rodeo ×1,35, 72 m/min).
6. ~~Afinar con datos del simulador~~ → hecho: informe `test/casting-report.mjs` sobre 18 mundos sintéticos (3 radios × 6 semillas) + 4 reales (Sanxenxo, Toledo, Madrid, A Coruña). Ajustes aplicados a raíz de los datos (decisión: ampliar escenas a más tipos, no subir el suelo del grafo): "emboscada" también en ruina (0.2) y puente (0.2); "guarida" también en puente (0.2, el troll bajo el puente); "vigilancia" también en cruce (0.2, vigilar quién pasa); y los roles de plantilla admiten escenas alternativas ("vigilancia o revelación" = cualquier sitio desde donde se ve lejos). Resultado: los 4 mundos reales castean 6/6; en sintéticos, entrega 77→95%, ronda del vigía 41→77%, resto ≥86%. Los fallos restantes son mundos de paseo con 2-3 parajes donde no caben todas las escenas: aceptable, el catálogo siempre ofrece varias quests por mundo.
7. Ampliar el catálogo de plantillas (más arquetipos) cuando exista la capa de NPCs.
