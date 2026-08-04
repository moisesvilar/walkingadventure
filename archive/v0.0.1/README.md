# Walking Adventure — prototipo de generación de mapa

Prototipo web sin build que implementa la parte de generación de mundo de `starting.md`:
elegir ubicación → leer el mapa real (OpenStreetMap/Overpass) → generar un mapa de
fantasía de 20 km de radio con núcleos de población ficticios anclados a lugares reales.

## Ejecutar

```bash
node server.mjs
# abrir http://localhost:8137
```

`server.mjs` sirve los estáticos y hace de **proxy de Overpass con caché en
disco** (`.cache/overpass/`): cada zona consultada se paga una sola vez y las
siguientes generaciones son instantáneas. Ver `overpass-alternative.md` para el
análisis completo de alternativas a Overpass.

(También funciona con `python3 -m http.server 8137`, pero sin caché: el cliente
cae automáticamente a los mirrors públicos de Overpass.)

No hay dependencias ni build: HTML + ES modules. Leaflet y las fuentes se cargan por CDN.

## Flujo

1. **Selector de ubicación** (Leaflet): geolocalización o clic/arrastre del marcador.
   El usuario elige el **radio mínimo del mundo** (0,1–30 km, 20 por defecto); el
   círculo rojo lo previsualiza. En zonas costeras el radio final puede crecer
   hasta +30% sobre el elegido (con ~20% de margen) para no cortar bahías/rías.
   Los cupos de núcleos son exactos por tramo de radio (ver tabla en
   `starting.md`, iteración 11:20): de 1/1/1/1 a 100 m hasta 2 ciudades,
   9 pueblos, 14 aldeas y 20 granjas a 20 km, interpolando entre tramos.
   Si no hay anclajes reales suficientes se rellena en tierra firme.
2. **Consulta Overpass** (2 queries en paralelo, con caché por coordenadas):
   - Geografía: costas, aguas, ríos/canales, bosques, picos (`out geom`).
   - POIs de anclaje: iglesias, monumentos, miradores, parques, castillos,
     centros comerciales, cafeterías, restaurantes, heladerías, bibliotecas (`out center`).
     Solo categorías aptas para menores (sin bares/pubs).
3. **Generación** (`js/settlements.js`, determinista por semilla `lat,lon#n`):
   - 1 ciudad en el clúster de POIs con más peso.
   - 5–10 pueblos en los siguientes clústeres, con separación mínima.
   - 10–15 aldeas sobre POIs sueltos (prefiere emplazamientos).
   - 10–15 granjas ancladas a locales reales restantes; si no llegan, posiciones
     aleatorias que exigen tierra firme (ni mar ni islotes en 400 m alrededor)
     y evitan lagos.
   - Cada núcleo recibe servicios según su tipo (posada, taberna, boticario,
     armería, conjurería, mercado) con nombres generados.
4. **Render** (`js/render.js`): canvas con pergamino, recorte circular, bosques,
   lagos, ríos, olas de costa, montañas, glifos de asentamiento, brújula,
   cartela de título y escala.

Interacción: clic en un núcleo (canvas o lista lateral) → ficha con sus servicios
y el lugar real que lo inspiró. "Otra variante" regenera con otra semilla sin
volver a consultar Overpass. Consola: `__wa.go(lat, lon)` genera en coordenadas exactas.

## Limitaciones conocidas / siguientes iteraciones

- El mar se pinta desde una máscara de rejilla (celda 200 m) clasificada por el
  lado del segmento de costa más cercano; el borde exacto lo disimula el trazo
  de costa, pero puede haber discrepancias de ~1 celda en costas muy recortadas.
- El radio dinámico (20→26 km) solo distingue océano de bahía muestreando el
  borde; geografías muy complejas (archipiélagos) pueden no quedar perfectas.
- Lagos que son *relations* multipolígono de OSM no se recogen (solo ways cerrados).
- Overpass puede tardar 30–60 s en zonas densas o saturarse (hay 2 mirrors con fallback).
- Los nombres/POIs se regeneran con cada semilla; no hay persistencia todavía.
- Sin ruido procedural en el terreno (colinas, caminos entre núcleos, etiquetas de ríos…).
