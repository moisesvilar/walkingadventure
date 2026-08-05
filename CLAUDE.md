# CLAUDE.md

Guía para trabajar en este repositorio. Complementa al `README.md` (que describe el *qué*); aquí está el *cómo* trabajar.

## Qué es esto

Prototipo del generador de mundo de **Walking Adventure**: un RPG que se juega caminando físicamente por el mundo real. A partir de unas coordenadas reales y datos de OpenStreetMap (vía Overpass), genera un mapa de fantasía determinista — núcleos de población, servicios, parajes, rutas nombradas y quests casteadas — donde cada elemento ficticio está **anclado a un lugar real**.

Estado: v0.1, prototipo del generador. No hay aún juego, cuentas, personajes ni NPCs; la visión completa está en `starting.md` (bitácora de iteraciones, orden cronológico) y las decisiones de diseño cerradas en `game-design/`.

## Comandos

```bash
node server.mjs              # servidor de desarrollo → http://localhost:8137
node test/headless.mjs       # tests de generación, sin navegador ni red (~1 s)
node test/casting-report.mjs # informe de casting sobre mundos sintéticos + reales (requiere server.mjs corriendo)
scripts/overpass-setup.sh    # deja el Overpass local listo; idempotente, comprueba y sale si ya sirve
```

No hay `package.json`, ni build, ni dependencias, ni linter, ni formateador: JavaScript ESM puro sobre Node nativo y navegador. Leaflet y las fuentes se cargan por CDN en `index.html`. No introduzcas un toolchain sin que el usuario lo pida.

Hooks de depuración en la consola del navegador: `__wa.go(lat, lon)` genera un mundo en coordenadas exactas, `__wa.preset('paseo'|'aventura'|'jornada'|'custom')` cambia el modo, `__wa.demo()` genera un mundo sintético con terreno sin tocar Overpass (útil cuando Overpass está saturado o para probar el render), `__wa.style('clasico'|'pergamino'|'cuento'|'atlas'|'reino')` cambia el estilo de pintado y `__wa.world()` devuelve el mundo actual.

## Arquitectura

Tubería de generación, en orden. `js/world/build.js` es la orquestación canónica y la comparten la app y las herramientas headless: **misma tubería, mismos mundos**. Si añades una fase, va ahí, no en `main.js`.

```
fetchData (Overpass) → parseGeo/parsePois → [costa: seaMask + radio dinámico]
  → generateSettlements → pegarAViario → buildRoutes → generateParajes
  → pegarAViario + linkParajes → castAll → renderMap
```

- `js/core/` — `rng.js` (RNG determinista mulberry32 con semilla de texto), `geo.js` (proyección local a metros, distancias punto-polilínea, intersección de segmentos).
- `js/data/overpass.js` — consultas Overpass (terreno, POIs, callejero) y parseo a features en metros. **Ver "El fichero que falta" más abajo.**
- `js/world/` — `seamask.js` (máscara tierra/mar por lado de costa + radio dinámico costero), `settlements.js` (cupos exactos por radio, anclajes únicos, servicios), `routes.js` (grafo viario cosido, Dijkstra + MST, ramales a parajes, nombres), `parajes.js` (8 tipos de hito no habitado con escenas ponderadas), `build.js` (orquestación).
- `js/names/` — paquetes de idioma `es` y `gl` con **interfaz común** (`townName`, `farmName`, `poiName`, `roadName`, `directionWord`, `parajeName`, `worldTitle`). El idioma sale de la ubicación del mundo (`localeFor`: bounding box aproximado de Galicia → gallego). Añadir un idioma = añadir un fichero que implemente la interfaz completa.
- `js/quests/` — `templates.js` (plantillas-arquetipo con roles abstractos y textos de fallback), `casting.js` (backtracking determinista que resuelve roles contra el mundo concreto; si falla, explica el motivo).
- `js/render/map.js` — todo el dibujo en canvas, por capas (papel, mar, bosques, lagos, ríos, costa, callejero, calzadas, picos, parajes, núcleos, marcadores, marco/brújula/cartela/escala). No contiene ni un color ni un grosor propios: todo sale del estilo.
- `js/render/styles.js` — los cinco estilos de pintado, cada uno un objeto de datos fusionado sobre `DEFAULTS`. El de por defecto es `reino`, que **ya no es el mapa ilustrado**: es el mapa base — verde y azul planos, costa y ríos gruesos, calzadas y puntos rojos —; `clasico`, `pergamino`, `cuento` y `atlas` conservan su estética. El estilo es **solo** pintado: cambiarlo repinta el mundo que ya está en pantalla y nunca resiembra. Añadir uno = añadir un objeto aquí (el selector de la UI se construye desde `STYLES`). Dos trampas al fusionar: `label` es la tipografía de los rótulos y el nombre visible del estilo es `title`; y `capas` decide qué se dibuja (bosques, picos, carreteras, lagos, rótulos de camino), que es cómo el mapa base se queda limpio sin borrar el código que usan los demás. Los rótulos se resuelven de dos maneras y lo decide el estilo, no `map.js`: `label.placa` lista los roles que van sobre caja de pergamino (`'nucleo'`, `'paraje'`, `'servicio'`, `'ruta'`) y el grupo `placa` describe esa caja; el resto se resuelve con halo (`label.halo`, `haloW`, `haloPasadas`). Reino usa la jerarquía placa-en-núcleos + halo-en-parajes, que además de legibilidad es lo que distingue de un vistazo un pueblo de un paraje.
- `js/main.js` — solo UI y orquestación: fases, presets, panel lateral, zoom, caché en memoria por consulta.
- `server.mjs` — estáticos + proxy `/api/overpass` con caché en disco permanente, cadena de upstreams: Overpass local en Docker → 3 mirrors públicos.

## Estado compartido entre worktrees

Nada pesado vive dentro del repo, y es deliberado: **todos los worktrees comparten un único Overpass y una única caché**, así que abrir uno nuevo no cuesta ni una importación ni una caché fría.

- **Base de datos de Overpass** → volumen Docker con nombre `walkingadventure-overpass-db`, no un bind mount relativo. Es independiente de la ruta desde la que se lanzó el `docker compose`.
- **Extracto `.pbf` y caché HTTP** → `~/.walkingadventure/` (`data/` y `cache/overpass/`). Se puede mover con `WA_HOME`; la caché sola, con `WA_CACHE_DIR`.
- **Arranque** → `restart: unless-stopped`: el contenedor vuelve solo al arrancar Docker. En una sesión nueva no hay que hacer nada; `scripts/overpass-setup.sh` solo hace falta la primera vez en la máquina (y es idempotente: comprueba que sirve datos de verdad y sale).
- **Sin actualizaciones por diffs**, a propósito: `OVERPASS_DIFF_URL` no está definido y el bucle del image solo actualiza `if [ -n "$OVERPASS_DIFF_URL" ]`. Para el prototipo la frescura es irrelevante, la misma razón por la que la caché del proxy es permanente.
- **Recrear el contenedor es seguro**: el entrypoint salta toda la importación si existe `/db/init_done`. Puedes tocar el `docker-compose.yml` y hacer `docker compose up -d` sin miedo a repetir la hora de import.

Corolario: no metas el `.pbf`, la base de datos ni la caché en el repo "para tenerlo a mano". Ese fue el origen de la trampa que sigue.

## Reglas del proyecto

**Determinismo por encima de todo.** Mismo `seed` (`"lat,lon#n"`) + mismos datos OSM → mundo idéntico, byte a byte. Nunca uses `Math.random()`, `Date.now()` ni iteración sobre `Set`/`Map` con orden dependiente de inserción no controlada dentro de la generación: usa siempre `makeRng(seed + ':sufijo')` de `js/core/rng.js`, con un sufijo distinto por fase para que tocar una fase no desplace el azar de las demás. `test/headless.mjs` verifica esto y es la red de seguridad más importante del repo.

**Todo elemento de fantasía se ancla a un lugar real.** Los anclajes son de uso único (mecanismo `taken`): un POI real alimenta un núcleo, un servicio o un paraje, nunca dos. `generateSettlements` devuelve `freeAnchors` precisamente para que `generateParajes` reparta lo que sobra.

**El tipo de fantasía está desacoplado del anclaje real** (`game-design/parajes.md`): una "ruina" puede ser un chiringuito. Hay un sesgo suave cuando el lugar real pega con el tipo, pero no es una regla dura. No lo conviertas en un mapeo 1:1 de tags de OSM.

**El diseño manda sobre el código.** `game-design/parametros-mundo.md`, `parajes.md` y `quests.md` contienen decisiones cerradas (cupos por radio, presets de duración, taxonomía de 8 parajes con pesos de escena, arquetipos de quest). Antes de cambiar un cupo, un peso o una constante de dimensionado, lee el documento correspondiente: casi siempre hay una justificación de ritmo de juego detrás. Si el cambio contradice el diseño, actualiza también el documento — y anota la iteración en `starting.md`.

**Contenido apto para menores.** Es un principio de la especificación, no un detalle. Afecta a la selección de POIs (nada de bares de copas ni locales de adultos como anclaje), a los textos generados y al futuro contrato con el LLM.

**Los tests miden la salud del generador, no solo la corrección.** `test/headless.mjs` afirma cupos, unicidad de nombres, lazos cerrados y determinismo sobre mundos sintéticos. `test/casting-report.mjs` es diagnóstico: agrega qué porcentaje de plantillas castea sobre 18 mundos sintéticos + 4 reales, con histograma de motivos de fallo. Cuando un test falla, arregla el generador o la plantilla, no el test (precedente: la plantilla "tres pistas" no cerraba el lazo, se corrigió la plantilla).

## Estilo de código

Español en todo — comentarios, nombres de dominio (`settlements`, `parajes`, `nucleos`, `beats`), textos de UI, mensajes de commit. Los identificadores técnicos genéricos quedan en inglés (`rng`, `seed`, `mask`, `radius`).

Cada módulo abre con un comentario de 1-3 líneas que dice qué hace y por qué existe, y los comentarios explican **decisiones**, no mecánica ("flush-size bajo: menos RAM durante la importación"; no "incrementa el contador"). Sigue ese registro: es la convención más visible del repo.

Indentación de 2 espacios, comillas simples, punto y coma, `const`/`let`, funciones exportadas nombradas (nada de `export default`). Módulos ESM con extensión `.js` explícita en los imports.

## Datos y caché

`.gitignore` excluye `data/`, `overpass-db/` y `.cache/` — son gigas de datos locales que nunca van al repo. La caché de Overpass es permanente por diseño (los datos de OSM cambian despacio); para forzar una consulta nueva, borra el fichero concreto de `.cache/overpass/`.

`archive/v0.0.1/` es la implementación anterior, congelada como referencia. No la modifiques ni la uses como fuente: la v0.1 es una reescritura desde cero.

## Trampas conocidas

**Cuidado con `.gitignore` y las rutas sin anclar.** La regla `data/` (sin barra inicial) hacía match también con `js/data/` y se tragó silenciosamente `js/data/overpass.js`: el módulo nunca llegó a commitearse y la app estuvo rota sin que ningún test lo detectara (`test/headless.mjs` pasa porque no importa esa capa). Está reconstruido y las reglas ahora van ancladas (`/data/`, `/overpass-db/`, `/.cache/`). Al añadir una regla nueva, ánclala.

**Un test verde no significa app viva.** `test/headless.mjs` solo ejercita el generador con mundos sintéticos: no toca `js/data/` ni `js/render/`. Para verificar de verdad un cambio, ejecuta también `node test/casting-report.mjs` (tubería completa contra mundos reales) o abre la app.

**Overpass público se satura** (429/503/504, colas de minutos). Por eso existen el proxy con caché y el Overpass local en Docker. Cualquier cambio en el texto de una consulta invalida la caché entera (la clave es el hash del QL), así que la siguiente ejecución pagará minutos contra los mirrors públicos: espéralo, no es un cuelgue. Si iteras sobre el render y no sobre los datos, usa `__wa.demo()`.

**Un contenedor `Up` no significa Overpass servible.** Si no puede llegar a su base de datos responde **200 con una página de error XML**, el proxy lo descarta y cae a los mirrors públicos: todo "funciona", solo que lentísimo. Para comprobarlo de verdad, `scripts/overpass-setup.sh` (hace una consulta real y busca `"elements"`), nunca `docker ps`. Han ocurrido **dos causas distintas con síntoma idéntico**, y el mensaje exacto del XML es lo único que las separa:

- `No such file or directory /db/db/osm3s_osm_base` → no hay base de datos. Pasó con la primera importación, que vivía en un bind mount relativo dentro de un worktree de Orca; al borrarse el worktree el contenedor siguió 7 h "Up" y vacío.
- `Permission denied /db/db/osm3s_osm_base` → la base de datos está, pero el CGI no la alcanza. `/db` viene del image como `700 overpass:overpass` y nginx/fcgiwrap corren como uid 101, así que no pueden ni atravesarlo. Con un bind mount en macOS daba igual (los permisos se ignoran); en un volumen con nombre son permisos Linux de verdad. Lo arregla `chmod 755 /db`, que ya hace `scripts/overpass-setup.sh`.

**Los anclajes se eligen por reconocimiento, no por abundancia.** Al ampliar la consulta de POIs, vigila que un tag masivo no inunde el pool: los tipos de paraje se sortean con sesgo por `kind`, así que un tag muy numeroso monopoliza su tipo y mata la diversidad que pide `game-design/parajes.md`. Precedente medido: `amenity=drinking_water` (mobiliario urbano sin nombre) dejaba mundos enteros sin parajes de vigilancia/revelación; está excluido a propósito pese a aparecer en el documento.

**El callejero de OSM llega troceado.** En un mundo real medido salieron **109 componentes conexas**, muchas separadas por 9-50 m y la red entera del norte a 157 m del resto: a los ways les faltan nodos compartidos, o el corte del bounding box parte la conexión. Sin coser esos huecos, el trazado de calzadas unía núcleos perfectamente conectados en la realidad con rectas punteadas por el monte. `coserHuecos` (en `routes.js`) los une hasta 180 m. Antes de tocar la colocación de un núcleo porque "no tiene carretera", comprueba si el problema es el dato.

**Las etiquetas se solapan** en zonas densas (rutas, parajes, núcleos): falta declutter en `render/map.js`. Es una limitación conocida, no un bug nuevo — pero desde que Reino rotula los núcleos sobre placa **canta mucho más**, porque dos cajas opacas que chocan se ven peor que dos textos que se rozan. Si añades placa a otro estilo, cuenta con que el declutter deja de ser opcional.

**La detección de Galicia es un bounding box**, no límites administrativos. Un mundo generado en el occidente de Asturias o el Bierzo puede salir en gallego.

**El `README.md` puede ir por detrás del código.** Verifica siempre contra el código.

## Al terminar una iteración

`starting.md` es la bitácora del proyecto: cada iteración significativa se anota al final con fecha, qué se decidió, qué se implementó y con qué se verificó (mundos reales concretos, no "funciona"). Mantén ese hábito. Si la iteración cierra un pendiente de `game-design/`, táchalo con `~~...~~ → hecho` y explica el resultado, como está hecho en el resto del documento.
