# Walking Adventure — Generador de mundo (v0.1)

Prototipo del generador de mapas de fantasía a partir del mundo real (OSM), reescrito desde cero incorporando el diseño de `game-design/` (la v0.0.1 está en `archive/v0.0.1/`).

## Ejecutar

```
node server.mjs   →  http://localhost:8137
```

El servidor sirve los estáticos y hace de proxy de Overpass con caché en disco, con esta cadena de upstreams: Overpass local en Docker (`docker-compose.yml`, España completa) → mirrors públicos.

El Overpass local y la caché se comparten entre todas las sesiones y worktrees de la máquina: la base de datos vive en el volumen Docker `walkingadventure-overpass-db` y el extracto y la caché en `~/.walkingadventure/`. La primera vez en cada máquina, `scripts/overpass-setup.sh` (descarga el extracto e inicia la importación, que tarda horas); después el contenedor arranca solo con Docker y no hay que volver a ejecutarlo. El script es idempotente: si ya sirve datos, sale.

Tests sin navegador ni red: `node test/headless.mjs`.

## Flujo

1. **Selector**: ubicación (mapa Leaflet, geolocalización) y duración de la aventura con presets — Paseo ~1 h (700 m), Aventura ~2 h (1,2 km), Jornada ~3 h (1,9 km) — o radio libre en "Avanzado" (0,1-30 km, para testing).
2. **Generación**: consulta a Overpass (terreno + POIs), máscara tierra/mar y radio dinámico en costa, núcleos con cupos exactos por radio, servicios anclados a POIs reales únicos, red vertebral con routing y nombres, parajes, callejero local bajo demanda al hacer zoom.
3. **Mapa**: canvas estilo pergamino; clic en núcleo → ficha + zoom con marcadores de servicios y callejero; clic en paraje → ficha con escenas propicias + zoom.

## Arquitectura (`js/`)

- `core/` — rng determinista (semilla `lat,lon#n`), geometría (proyección local, distancias punto-polilínea, intersección de segmentos).
- `data/overpass.js` — consultas (terreno, POIs, callejero) y parseo a features en metros.
- `world/` — `seamask.js` (máscara tierra/mar por lado de costa + radio dinámico), `settlements.js` (cupos exactos, anclajes, servicios), `routes.js` (grafo viario, Dijkstra + MST, nombres), `parajes.js` (hitos no habitados según `game-design/parajes.md`).
- `names/` — paquetes de idioma `es` y `gl`; el idioma se elige por la ubicación del mundo (Galicia → gallego). Interfaz común: townName, farmName, poiName, roadName, directionWord, parajeName, worldTitle.
- `quests/` — simulador de casting (`game-design/quests.md`): `templates.js` (6 plantillas-arquetipo con roles abstractos y textos de fallback) y `casting.js` (resolución determinista de roles contra el mundo, con tramos andables y estimación de km/min). El panel lista qué plantillas castean en cada mundo y dibuja el lazo de la quest sobre el mapa.
- `render/map.js` — capas: pergamino, mar, bosques, lagos, ríos, costa con olas, callejero (focus), calzadas con nombre, picos, parajes, núcleos, marcadores de servicios, marco/brújula/cartela/escala.
- `main.js` — orquestación, presets, panel lateral, zoom, hooks de consola (`__wa.go(lat,lon)`, `__wa.preset(m)`, `__wa.demo()`).

## Parajes (nuevo en v0.1)

8 tipos (ruina, piedra antigua, ermita, fuente, atalaya, cruce, puente, monasterio) con escenas propicias ponderadas para el futuro generador de quests. El tipo está desacoplado del anclaje real (un chiringuito puede ser una ruina) con sesgo suave cuando el lugar real "pega"; se eligen anclajes cerca de rutas y lejos de núcleos; cruces y puentes salen del grafo viario y garantizan parajes incluso sin datos OSM ricos. Cupo por radio: 1 (250 m) → 8 (≥5 km).

## Limitaciones conocidas

- Las etiquetas (rutas, parajes, núcleos) pueden solaparse en zonas densas: falta declutter.
- La detección de Galicia es un bounding box aproximado.
- Overpass público se satura a veces: por eso el proxy con caché y el Overpass local.
