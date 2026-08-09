// Transporte de las consultas a Overpass (OpenStreetMap): construir el QL y
// pedirlo. Es la única capa que habla con el exterior, y por eso se queda fuera
// del paquete compartido: lo que el núcleo hace con la respuesta —convertirla en
// features en metros— vive en packages/nucleo/world/osm.js.

// El proxy local (server.mjs) cachea en disco para siempre y añade el
// User-Agent que exigen los mirrors; los públicos son el plan B si no está.
// En Node no vale la ruta relativa: las herramientas headless inyectan la URL
// absoluta en globalThis.__WA_PROXY__ (ver test/casting-report.mjs).
const MIRRORS = [
  globalThis.__WA_PROXY__ ?? '/api/overpass',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const IS_BROWSER = typeof window !== 'undefined';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runQuery(ql) {
  let lastErr;
  for (let round = 0; round < 3; round++) {
    if (round > 0) await sleep(4000 * round); // backoff entre rondas
    for (const url of MIRRORS) {
      try {
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        // Etiqueta OSM: sin User-Agent válido algunos mirrors responden 406. En
        // navegador es cabecera prohibida (se ignora), así que solo en Node.
        if (!IS_BROWSER) headers['User-Agent'] = 'walking-adventure-prototype/0.1 (dev local)';
        const res = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(ql),
          headers,
          signal: AbortSignal.timeout(45000), // Overpass puede encolar sin responder
        });
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr;
}

// --- consultas ---

export async function fetchGeoFeatures(lat, lon, radius) {
  const a = `(around:${radius},${lat},${lon})`;
  // La costa va en su propio out SIN límite: si se trunca, la máscara
  // tierra/mar queda con huecos y clasifica mal. El resto (bosques sobre todo)
  // sí se limita.
  const ql = `
[out:json][timeout:90];
way["natural"="coastline"]${a};
out geom;
(
  way["natural"="water"]${a};
  way["waterway"~"^(river|stream|canal)$"]${a};
  way["landuse"="forest"]${a};
  way["natural"="wood"]${a};
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|track)$"]${a};
  node["natural"="peak"]${a};
);
out geom 8000;`;
  return runQuery(ql);
}

// Anclajes reales. v0.1 amplía la consulta de v0.0.1 con manantiales, fuentes,
// torres, faros, cruceiros y monasterios: más anclajes libres para los parajes
// y material para el sesgo suave de tipo (game-design/parajes.md).
// Los locales se restringen a los aptos para menores (principio de la spec).
//
// Excluido a propósito `amenity=drinking_water`, que parajes.md sí lista para el
// tipo Fuente: medido sobre los 4 mundos de referencia, es mobiliario urbano sin
// nombre (A Coruña 186 anclajes, 3 con nombre; Toledo 16, ninguno). No aporta
// reconocimiento —el sentido del anclaje es el guiño de identificar el lugar
// real— y su volumen monopoliza el sesgo `fuente`, matando la diversidad de
// tipos que pide el propio documento ("mejor uno de cada que cinco fuentes"):
// con él dentro, Toledo y A Coruña se quedaban sin ningún paraje de vigilancia
// o revelación. `amenity=fountain` y `natural=spring` sí entran: son hitos con
// nombre.
export async function fetchPois(lat, lon, radius) {
  const a = `(around:${radius},${lat},${lon})`;
  const ql = `
[out:json][timeout:90];
(
  nwr["amenity"="place_of_worship"]${a};
  nwr["amenity"="monastery"]${a};
  nwr["historic"~"^(monument|memorial|castle|ruins|city_gate|archaeological_site|wayside_cross|wayside_shrine|monastery)$"]${a};
  nwr["tourism"="viewpoint"]${a};
  nwr["man_made"~"^(tower|lighthouse)$"]${a};
  nwr["natural"="spring"]${a};
  nwr["amenity"="fountain"]${a};
  nwr["leisure"="park"]${a};
  nwr["shop"="mall"]${a};
  nwr["amenity"~"^(cafe|restaurant|ice_cream|fast_food|library)$"]${a};
);
out center 6000;`;
  return runQuery(ql);
}

// Callejero local de un núcleo (se pide bajo demanda al hacer zoom).
//
// `out geom` ya devolvía los tags de cada vía, así que `surface`, `smoothness`,
// `width` y `wheelchair` llegan sin pedir nada: lo que faltaba era conservarlos al
// parsear, que es de packages/nucleo/world/osm.js. Los **bordillos** sí hay que
// pedirlos aparte, porque en OSM viven en el nodo del cruce (`kerb=*`,
// `barrier=kerb`) y `out geom` de un way no trae los tags de sus nodos: sin esta
// segunda mitad de la consulta ese criterio se queda permanentemente en «no se
// sabe», que es cumplir la especificación sin servir de nada.
//
// Cambiar este texto invalida la caché entera del proxy —la clave es el hash del
// QL—, así que la primera ejecución después de tocarlo paga minutos contra los
// mirrors públicos. Es esperado, no es un cuelgue.
export async function fetchStreets(lat, lon, radius) {
  const a = `(around:${radius},${lat},${lon})`;
  const ql = `
[out:json][timeout:60];
way["highway"~"^(residential|living_street|pedestrian|service|unclassified|track|path|footway|cycleway|steps)$"]${a};
out geom 3000;
(
  node["kerb"]${a};
  node["barrier"="kerb"]${a};
);
out geom 3000;`;
  return runQuery(ql);
}
