# Overpass: el problema y las alternativas

**Problema**: el prototipo consulta los servidores públicos de Overpass API
(overpass-api.de y mirrors) en vivo desde el navegador. Son un recurso
comunitario compartido: se saturan (429/503/504), aplican rate-limits agresivos
por IP en cuanto repites consultas pesadas, y encolan peticiones sin responder
durante minutos. Iterar el prototipo contra ellos es doloroso, y para un juego
en producción es directamente inviable (además de abusivo con un servicio
gratuito).

Mitigaciones ya aplicadas en el cliente: 3 mirrors con fallback, reintentos con
backoff, timeout de 45 s por intento, caché en memoria por consulta individual.
No bastan: la caché muere con cada recarga y el rate-limit es por IP.

---

## Opción 1 — Proxy local con caché en disco ✅ (implementada)

`server.mjs`: un servidor Node sin dependencias que sirve los estáticos del
prototipo y expone `/api/overpass` como proxy de Overpass con caché en disco.

- Cada consulta se cachea por hash SHA-256 del texto de la consulta en
  `.cache/overpass/<hash>.json` — **para siempre** (los datos de OSM cambian
  despacio; para un prototipo la frescura es irrelevante).
- Primera petición por zona: se paga Overpass una vez (con reintentos contra
  los 3 mirrors). Las siguientes: lectura de disco, milisegundos, sin red.
- El cliente (`js/overpass.js`) intenta primero `/api/overpass` y cae a los
  mirrors públicos si el proxy no está (p. ej. si sirves los estáticos con
  `python3 -m http.server`).
- Cabecera `X-Cache: HIT | MISS` para diagnosticar.

Uso: `node server.mjs` (puerto 8137) y abrir http://localhost:8137.

Límite: la primera visita a una zona nueva sigue dependiendo de los públicos.

## Opción 2 — Instancia Overpass propia en Docker ✅ (implementada)

Para independencia total mientras se prototipa por distintas zonas. Montada con
colima (VM ligera, sin Docker Desktop): `colima start` + el `docker-compose.yml`
del repo. El proxy (`server.mjs`) la usa como **primer upstream**
(`http://localhost:12345/api/interpreter`) y cae a los públicos mientras la
importación inicial no termina.

```yaml
# docker-compose.yml (el del repo)
services:
  overpass:
    image: wiktorn/overpass-api
    environment:
      OVERPASS_META: "no"
      OVERPASS_MODE: init
      OVERPASS_PLANET_URL: https://download.geofabrik.de/europe/spain-latest.osm.pbf
      OVERPASS_DIFF_URL: https://download.geofabrik.de/europe/spain-updates/
      OVERPASS_RULES_LOAD: "10"
    ports:
      - "12345:80"
    volumes:
      - ./overpass-db:/db
```

- Extracto de España: ~1,2 GB de descarga; la importación inicial tarda
  (horas) y la BD ocupa varias decenas de GB; después, consultas ilimitadas
  con latencia de milisegundos y sin internet.
- Se combina con la opción 1: añadir `http://localhost:12345/api/interpreter`
  como primer upstream del proxy.
- Coste: mantenimiento de un contenedor y disco. Solo compensa si se itera
  mucho por zonas nuevas.

## Opción 3 — Cambiar la fuente de datos (la respuesta "de producto")

Para el juego real el cliente no debe consultar Overpass en vivo. El mundo
generado además tendrá que ser **persistente y compartido** entre jugadores,
así que la generación acabará en un backend propio. Fuentes candidatas:

### 3a. Overture Maps (recomendada para el futuro backend)
- POIs (`places`), agua, terreno y edificios en GeoParquet descargable
  (S3/Azure, sin API key). Datos de OSM + Meta + Microsoft, licencia permisiva.
- Flujo: pre-extraer la región con DuckDB (`read_parquet` + filtro bbox) a una
  BD propia; el backend responde "elementos en radio X" al instante.
- Actualizaciones mensuales; más que suficiente.

### 3b. PostGIS con extractos de Geofabrik
- Pipeline clásico: `osm2pgsql` del extracto regional → PostGIS; refresco
  periódico con los diffs.
- Consultas de radio/categoría triviales e instantáneas; control total del
  esquema de tags (importante para "aptos para menores").

### 3c. APIs hospedadas (Geoapify, OpenTripMap, …)
- POIs sobre OSM ya servidos, fiables, con free tier.
- Contras: tercero de pago en el camino crítico, límites de licencia sobre
  almacenamiento, menos control de categorías.
- (Google Places queda descartado para este uso: prohíbe almacenar los datos,
  y el mundo generado es precisamente almacenamiento.)

---

## Recomendación

| Horizonte | Qué usar |
|-----------|----------|
| Iterar el prototipo esta semana | Opción 1 (hecha) |
| Prototipar por muchas zonas / sin internet | Opción 2 |
| Juego real | Backend propio sobre Overture (3a) o PostGIS (3b), con mundos pre-generados y cacheados por celda geográfica |
