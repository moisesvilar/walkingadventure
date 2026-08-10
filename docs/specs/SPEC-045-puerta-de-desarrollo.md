# SPEC-045 — La puerta de desarrollo: el andamiaje y el mapa suelto, alcanzables sin ser del juego

## Descripción

El andamiaje —la sonda de las cuatro capacidades de plataforma— y el mapa suelto son herramientas de desarrollo, no pantallas del juego. Desde que la app abre en el arranque no se llega a ninguna de las dos, y sus tres flujos de Maestro llevan meses comprobando que siguen sin existir en lugar de recorrerlas.

Esta spec les da una puerta **declarada de desarrollo**: un enlace profundo con anfitrión propio, inerte en producción, que lleva al andamiaje y a la tira de pasos que ya cuelga de él. No es la navegación del juego y no pretende serlo.

## Alcance de implementación

- Esta spec define **únicamente el código de producción** que debe entregarse: UI (componentes,
  páginas, estados), datos (queries, mutations, schema si aplica) y lógica de negocio asociada.
- **Los tests automatizados están fuera del alcance del implementador.** No se deben escribir tests
  de nivel `@nucleo` (`node --test`) ni flujos de nivel `@app` (Maestro) como parte de esta entrega.
  Los tests los genera la skill `/somo-qa-dev` y los ejecuta `/somo-qa-tester` contra el código ya
  commiteado, en un paso posterior del pipeline de QA de SOMO. Cualquier test que el implementador
  entregue será descartado o reemplazado.
- Si la spec requiere tocar la frontera del núcleo —una entrada o salida nueva que haya que inyectar—, se indica
  explícitamente en "Notas técnicas". Si no se indica, no hay cambios de infraestructura.
- **Fuera de alcance**: `app/plataforma/gancho.js` no se toca. Su contrato está fijado por siete casos de `test/nucleo/plataforma.test.mjs`, y uno de ellos afirma que el enlace de andamiaje **sin parámetros no hace nada**. La puerta va por un anfitrión propio precisamente para no tener que ablandar esa prueba.

## Criterios de aceptación

### La puerta

- GIVEN una compilación de desarrollo WHEN se abre el enlace de la puerta de desarrollo THEN se enseña la pantalla de andamiaje con las cuatro capacidades sondeadas.
- GIVEN el andamiaje a la vista por la puerta de desarrollo WHEN se mira la tira de pasos THEN están el paso al mapa, el paso al momento en marcha y el paso a la revisión del render.
- GIVEN el andamiaje a la vista WHEN se pulsa el paso al mapa THEN se abre la pantalla del mapa con su botón de levantar.
- GIVEN una partida ya levantada WHEN se abre el enlace de la puerta de desarrollo THEN se enseña el andamiaje igual, y la partida no se toca ni se borra.
- GIVEN el andamiaje abierto por la puerta WHEN se cierra y se vuelve a abrir la app THEN se abre donde le toca por su estado y no en el andamiaje.

### Producción

- GIVEN una compilación de producción WHEN se abre el enlace de la puerta de desarrollo THEN no ocurre nada y la app se queda donde estaba.

### El gancho de capacidades, que sigue funcionando

- GIVEN el andamiaje a la vista por la puerta WHEN se abre el enlace de andamiaje con capacidades ausentes THEN esas capacidades se pintan como no montadas con su motivo.
- GIVEN un enlace con un nombre que no es ninguna capacidad WHEN se abre THEN se dice cuál no se reconoce y no cambia ningún estado.

### Casos límite

- GIVEN un enlace con el anfitrión de la puerta y basura detrás WHEN se abre THEN se abre el andamiaje igual, porque la puerta no lleva parámetros.
- GIVEN un enlace de otro anfitrión WHEN se abre THEN no abre el andamiaje.

## UX Design

### Wireframe textual

Ninguna pantalla nueva y ninguna modificada. La pantalla de andamiaje (`app/pantallas/andamiaje.js`) y la tira de tres pasos que `App.js` ya dibuja cuando no hay partida se quedan exactamente como están. Lo único que se añade es **la manera de llegar**.

**Ninguna pantalla del juego cambia**: la puerta no pinta ningún control en la portada, ni en el arranque, ni en el momento en marcha. Es la diferencia con la tira de pasos provisionales que esta fila retira: aquella vivía dentro de una pantalla, esta no se ve en ninguna.

### Pantallas y elementos utilizados

Pantalla de andamiaje, pantalla del mapa, revisión del render. Ninguna está en `docs/flujo.md` y **ninguna debe estarlo**: el diagrama son las cuarenta pantallas de los seis artefactos de diseño, y estas tres no son de diseño. Es lo que distingue esta fila de la 43 y de la 44.

### data-testid

Ninguno nuevo. Los que los tres flujos usan ya existen: `pantalla-andamiaje`, `capacidades`, `capacidad-salud`, `capacidad-haptico`, `capacidad-notificaciones`, `capacidad-respaldo`, `titulo-de-mundo`, `gancho-no-reconocido`, `paso-mapa`, `paso-marcha`, `paso-revision-render`, `mapa-pantalla`.

### Patrón de interacción

- **Es un enlace profundo y no un botón**, por el mismo motivo que ya eligió el gancho de capacidades: funciona igual en las dos plataformas, no añade código nativo y **no hay que esconderlo en producción**, porque en producción no existe.
- **Anfitrión propio, no el del gancho.** `walkingadventure://andamiaje` ya significa una cosa —poner capacidades en rojo— y una prueba fija que sin parámetros no hace nada. Darle un segundo significado rompería esa prueba y mezclaría dos cosas que se apagan por la misma llave pero hacen distinto.
- **La puerta no persiste nada.** Volver a abrir la app lleva donde toque por el estado, igual que el gancho de capacidades vuelve a su estado real. Una puerta que sobrevive al reinicio es una puerta trasera.
- **Abrirla no toca la partida.** Se enseña el andamiaje por encima; al salir, lo que había sigue.

## Notas técnicas

- La frontera de inyección no cambia y no entra ninguna dependencia.
- El módulo nuevo vive en `app/plataforma/` junto al gancho, y comparte con él las dos reglas que no se relajan: inerte en producción y sin escribir nada en el almacenamiento.
- `App.js` ya lee los enlaces con `Linking.getInitialURL()` y `Linking.addEventListener('url', …)`. La puerta se resuelve en ese mismo sitio, no en uno nuevo.
- Los tres flujos que esto desbloquea —`andamiaje.yaml`, `gancho-capacidad-ausente.yaml` y `mapa.yaml`— entran hoy por identificadores de pasos provisionales. Reescribirlos es de `wa-qa-dev`.

## Decisiones asumidas

- **El anfitrión de la puerta** → asumido `walkingadventure://desarrollo`, en español como el resto del dominio. Alternativa: reutilizar `andamiaje` con un parámetro. Regla: hay una prueba que fija que el enlace de andamiaje sin parámetros no hace nada, y ablandarla para abrirse camino es exactamente lo que el encargo prohíbe.
- **Si la puerta puede abrirse con una partida en curso** → asumido que sí, y sin tocarla. Alternativa: solo sin partida, como hoy. Regla: la utilidad de una sonda de capacidades es poder mirarla cuando algo va mal, y lo que va mal casi siempre va mal con partida.
- **Cómo se sale del andamiaje** → asumido que con el atrás del sistema, que vuelve donde se estaba. Alternativa: un botón de salir. Regla: la pantalla es de desarrollo y no se le añade interfaz que luego habría que mantener.
