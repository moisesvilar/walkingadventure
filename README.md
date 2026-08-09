# Walking Adventure — Generador de mundo (v0.1)

Prototipo del generador de mapas de fantasía a partir del mundo real (OSM), reescrito desde cero incorporando el diseño de `game-design/` (la v0.0.1 está en `archive/v0.0.1/`).

## Ejecutar

El repositorio tiene tres piezas: **`app/`**, la app de React Native con Expo; **`packages/nucleo/`**, el generador determinista compartido, que corre igual en Node y dentro del móvil; y **`prototipo/`**, el prototipo web del generador, que se conserva como herramienta de medida y de comparación de pintado.

La app:

```
npm install                    # monta el espacio de trabajo (app + packages/*)
cd app && npx expo run:ios     # compilación de desarrollo instalable en el simulador
cd app && npx expo run:android
```

El prototipo web:

```
node server.mjs   →  http://localhost:8137
```

El servidor sirve los estáticos de `prototipo/` y hace de proxy de Overpass con caché en disco, con esta cadena de upstreams: Overpass local en Docker (`docker-compose.yml`, España completa) → mirrors públicos.

El Overpass local y la caché se comparten entre todas las sesiones y worktrees de la máquina: la base de datos vive en el volumen Docker `walkingadventure-overpass-db` y el extracto y la caché en `~/.walkingadventure/`. La primera vez en cada máquina, `scripts/overpass-setup.sh` (descarga el extracto e inicia la importación, que tarda horas); después el contenedor arranca solo con Docker y no hay que volver a ejecutarlo. El script es idempotente: si ya sirve datos, sale.

Tests sin navegador ni red: `node test/headless.mjs` y `node --test test/nucleo/`. **Los dos arrancan en un clon limpio sin instalar nada**, y eso es un criterio duro: el día que la red de seguridad del determinismo dependa de un `node_modules`, deja de ser una red.

## Flujo

1. **Selector**: ubicación (mapa Leaflet, geolocalización) y duración de la aventura con presets — Paseo ~1 h (700 m), Aventura ~2 h (1,2 km), Jornada ~3 h (1,9 km) — o radio libre en "Avanzado" (0,1-30 km, para testing).
2. **Generación**: consulta a Overpass (terreno + POIs), máscara tierra/mar y radio dinámico en costa, núcleos con cupos exactos por radio, servicios anclados a POIs reales únicos, red vertebral con routing y nombres, parajes, callejero local bajo demanda al hacer zoom.
3. **Mapa**: canvas con cinco estilos intercambiables (Reino, el mapa base, por defecto; Clásico, Pergamino, Cuento y Atlas) que se alternan sobre el mundo ya generado sin resembrarlo, y zoom libre con rueda, botones y arrastre; clic en núcleo → ficha + zoom con marcadores de servicios y callejero; clic en paraje → ficha con escenas propicias + zoom.

## Arquitectura del generador (`packages/nucleo/`) y del prototipo (`prototipo/js/`)

- `core/` — rng determinista (semilla `lat,lon#n`), geometría (proyección local, distancias punto-polilínea, intersección de segmentos).
- `prototipo/js/data/overpass.js` — consultas (terreno, POIs, callejero) y parseo a features en metros.
- `world/` — `seamask.js` (máscara tierra/mar por lado de costa + radio dinámico), `settlements.js` (cupos exactos, anclajes, servicios), `routes.js` (grafo viario, Dijkstra + MST, nombres), `parajes.js` (hitos no habitados según `game-design/parajes.md`).
- `names/` — paquetes de idioma `es` y `gl`; el idioma se elige por la ubicación del mundo (Galicia → gallego). Interfaz común: townName, farmName, poiName, roadName, directionWord, parajeName, worldTitle.
- `quests/` — simulador de casting (`game-design/quests.md`): `templates.js` (6 plantillas-arquetipo con roles abstractos y textos de fallback) y `casting.js` (resolución determinista de roles contra el mundo, con tramos andables y estimación de km/min). El panel lista qué plantillas castean en cada mundo y dibuja el lazo de la quest sobre el mapa.
- `prototipo/js/render/map.js` — capas: papel, mar, bosques, lagos, ríos, costa, callejero (focus), calzadas con nombre, picos, parajes, núcleos, marcadores de servicios, marco/brújula/cartela/escala. Ningún color ni grosor vive aquí: todo sale del estilo.
- `prototipo/js/render/styles.js` — los cinco estilos de pintado, cada uno un objeto de datos (papel, tierra, agua, costa, bosque, picos, glifos, tipografía, cartela, marco, brújula, forma disco/rectángulo y qué capas se dibujan). Solo afectan al pintado, nunca a la generación. El de por defecto, `reino`, es un mapa base plano: verde y azul sólidos, costa y ríos marcados, calzadas y puntos rojos.
- `prototipo/js/main.js` — orquestación, presets, panel lateral, zoom, selector de estilo, hooks de consola (`__wa.go(lat,lon)`, `__wa.preset(m)`, `__wa.demo()`, `__wa.style(id)`, `__wa.world()`).

## Parajes (nuevo en v0.1)

8 tipos (ruina, piedra antigua, ermita, fuente, atalaya, cruce, puente, monasterio) con escenas propicias ponderadas para el futuro generador de quests. El tipo está desacoplado del anclaje real (un chiringuito puede ser una ruina) con sesgo suave cuando el lugar real "pega"; se eligen anclajes cerca de rutas y lejos de núcleos; cruces y puentes salen del grafo viario y garantizan parajes incluso sin datos OSM ricos. Cupo por radio: 1 (250 m) → 8 (≥5 km).

## La app (v0.1, andamiaje)

Una sola pantalla y provisional: enseña el título de mundo que sortea el núcleo con la semilla `42.40,-8.81#1` —idéntico al que produce el mismo paquete en Node— y el estado de las cuatro capacidades de plataforma (salud, háptico, notificaciones, respaldo). No hay juego, ni mapa, ni datos reales: la app no hace ni una petición de red al arrancar. Los cuatro módulos de plataforma se inyectan en el registro, y la app arranca aunque falten háptico, notificaciones o respaldo: la ausencia se declara en pantalla, nunca se disimula.

## Limitaciones conocidas

- Las etiquetas (rutas, parajes, núcleos) pueden solaparse en zonas densas: falta declutter.
- La detección de Galicia es un bounding box aproximado.
- El nivel `@app` (Maestro, `test/app/`) está escrito pero sin verificar: en la máquina del pipeline no hay simulador de iOS ni herramientas de Android donde instalar la app.
- Overpass público se satura a veces: por eso el proxy con caché y el Overpass local.
