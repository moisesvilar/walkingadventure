// Captura, una sola vez, los cuatro mundos de OSM congelados de test/fixtures/osm/.
// Existe como script y no como parte de las pruebas porque un fixture que se
// regenera deja de ser un fixture: esto se ejecuta a mano, se commitea el
// resultado y no se vuelve a tocar (SPEC-001, «Los fixtures de OSM congelados»).
//
//   node scripts/captura-fixtures.mjs                 # captura los cuatro
//   node scripts/captura-fixtures.mjs costero         # captura uno
//   node scripts/captura-fixtures.mjs --overpass URL  # endpoint alternativo
//
// Requiere el Overpass local del proyecto (scripts/overpass-setup.sh) o el proxy
// (node server.mjs). No lee ninguna variable de entorno a propósito: el
// andamiaje no depende de la configuración de la máquina que lo ejecuta.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { esPrincipal } from './guardian-principal.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'test', 'fixtures', 'osm');

// Orden deliberado: primero el Overpass local (datos del extracto de España, sin
// cola), después el proxy del prototipo (caché en disco), y ningún mirror
// público. Capturar contra un mirror saturado produce fixtures truncados.
const ENDPOINTS = [
  'http://localhost:12345/api/interpreter',
  'http://localhost:8137/api/overpass',
];

// --- las consultas ---
//
// Son un SUPERCONJUNTO de las de app/js/data/overpass.js, y eso es el punto: el
// fixture guarda también lo que el generador debe descartar (locales de adultos,
// agua potable), porque hay escenarios de docs/testing.md que afirman
// precisamente la exclusión. Si el fixture solo trajese lo que ya pasa el filtro,
// esos escenarios no se podrían escribir sin falsear el dato.

function consultaGeo(lat, lon, radio) {
  const a = `(around:${radio},${lat},${lon})`;
  // La costa va en su propio `out` sin límite, igual que en producción: si se
  // trunca, la máscara tierra/mar queda con huecos.
  return `
[out:json][timeout:180];
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
}

function consultaPois(lat, lon, radio) {
  const a = `(around:${radio},${lat},${lon})`;
  return `
[out:json][timeout:180];
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
  nwr["amenity"="drinking_water"]${a};
  nwr["amenity"~"^(bar|pub|nightclub|stripclub|casino|gambling|brothel)$"]${a};
  nwr["shop"~"^(erotic|alcohol|tobacco|bookmaker)$"]${a};
);
out center 12000;`;
}

function consultaCallejero(lat, lon, radio) {
  const a = `(around:${radio},${lat},${lon})`;
  return `
[out:json][timeout:120];
way["highway"~"^(residential|living_street|pedestrian|service|unclassified|track|path|footway|cycleway|steps)$"]${a};
out geom 3000;`;
}

// --- los cuatro mundos ---
//
// Las coordenadas salen de los mundos reales que ya usa test/casting-report.mjs
// (sitios verificados contra la tubería completa), salvo el barrio de tres
// calles, que se elige por traer el callejero troceado que hace falta para los
// escenarios de cosido de huecos.
export const MUNDOS = [
  {
    nombre: 'costero',
    descripcion: 'Sanxenxo: línea de costa, radio de paseo. Ejercita la máscara tierra/mar y el radio dinámico costero.',
    lat: 42.402,
    lon: -8.809,
    radio: 700,
  },
  {
    nombre: 'urbano-denso',
    descripcion: 'Madrid centro: casco urbano denso. Trae locales de adultos y agua potable, que el generador debe descartar.',
    lat: 40.4168,
    lon: -3.7038,
    radio: 1200,
  },
  {
    nombre: 'barrio-tres-calles',
    // Elegido sondeando candidatos por el criterio que lo hace útil: pocas vías y
    // componentes conexas separadas a la vez por huecos cortos (22 y 104 m, que
    // coserHuecos une) y por uno largo (239 m, que no debe unir). Un sitio con
    // solo huecos cortos no permite escribir «Los huecos largos no se cosen».
    descripcion: 'Aldea de Allariz con el callejero troceado: cuatro componentes conexas separadas por huecos cortos y uno largo.',
    lat: 42.18,
    lon: -7.82,
    radio: 500,
  },
  {
    nombre: 'suelo-250m',
    descripcion: 'Sanxenxo con el radio mínimo de 250 m: el mundo más pequeño que el generador debe seguir componiendo.',
    lat: 42.402,
    lon: -8.809,
    radio: 250,
  },
];

// --- ejecución de consultas ---

async function pide(ql, endpoint) {
  const candidatos = endpoint ? [endpoint] : ENDPOINTS;
  let ultimoError;
  for (const url of candidatos) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(ql),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'walking-adventure/captura-fixtures (dev local)',
        },
        signal: AbortSignal.timeout(240000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} desde ${url}`);
      const texto = await res.text();
      // Overpass responde 200 con una página de error XML cuando no alcanza su
      // base de datos; el JSON.parse lo caza y así no se congela una no-respuesta.
      const json = JSON.parse(texto);
      if (!Array.isArray(json.elements)) throw new Error(`respuesta sin "elements" desde ${url}`);
      return json;
    } catch (e) {
      ultimoError = e;
      console.error(`  aviso: ${url} → ${e.message}`);
    }
  }
  throw new Error(`ningún endpoint de Overpass respondió. Último error: ${ultimoError?.message}`);
}

// --- inventario ---
//
// El manifiesto declara qué trae el fixture de lo que la batería necesita
// distinguir. Sin esto, wa-qa-dev tendría que abrir el fixture y contar a mano,
// o peor, inventarse el dato.

const ADULTOS = {
  amenity: ['bar', 'pub', 'nightclub', 'stripclub', 'casino', 'gambling', 'brothel'],
  shop: ['erotic', 'alcohol', 'tobacco', 'bookmaker'],
};

function esAdulto(tags) {
  return ADULTOS.amenity.includes(tags.amenity) || ADULTOS.shop.includes(tags.shop);
}

function inventarioPois(json) {
  const adultos = [];
  let aguaPotable = 0;
  const porEtiqueta = {};
  for (const el of json.elements || []) {
    const t = el.tags || {};
    if (esAdulto(t)) adultos.push({ tipo: el.type, id: el.id, amenity: t.amenity ?? null, shop: t.shop ?? null, nombre: t.name ?? null });
    if (t.amenity === 'drinking_water') aguaPotable++;
    for (const clave of ['amenity', 'shop', 'historic', 'tourism', 'man_made', 'natural', 'leisure']) {
      if (t[clave]) {
        const k = `${clave}=${t[clave]}`;
        porEtiqueta[k] = (porEtiqueta[k] || 0) + 1;
      }
    }
  }
  return {
    total: (json.elements || []).length,
    locales_adultos: { total: adultos.length, ejemplos: adultos.slice(0, 5) },
    agua_potable: { total: aguaPotable },
    // Ordenado por clave para que el manifiesto no dependa del orden de llegada.
    por_etiqueta: Object.fromEntries(Object.entries(porEtiqueta).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

const R_TIERRA = 6371000;

function metros(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat = ((a.lat + b.lat) / 2) * rad;
  const x = dLon * Math.cos(lat);
  return Math.sqrt(dLat * dLat + x * x) * R_TIERRA;
}

// Componentes conexas del callejero por nodos compartidos, que es exactamente el
// criterio que usa routes.js antes de coser huecos. El número y las distancias
// entre componentes son el dato que hace útil el fixture del barrio de tres calles.
function inventarioCallejero(json) {
  const vias = (json.elements || []).filter((el) => el.type === 'way' && el.geometry && el.nodes);
  const padre = new Map();
  const raiz = (x) => {
    while (padre.get(x) !== x) {
      padre.set(x, padre.get(padre.get(x)));
      x = padre.get(x);
    }
    return x;
  };
  const une = (a, b) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) padre.set(ra, rb);
  };
  vias.forEach((_, i) => padre.set(i, i));
  const duenoDeNodo = new Map();
  vias.forEach((via, i) => {
    for (const nodo of via.nodes) {
      if (duenoDeNodo.has(nodo)) une(i, duenoDeNodo.get(nodo));
      else duenoDeNodo.set(nodo, i);
    }
  });

  const grupos = new Map();
  vias.forEach((via, i) => {
    const r = raiz(i);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r).push(via);
  });
  // Orden por tamaño y después por id de la primera vía: sin ordenar, el
  // manifiesto cambiaría de un Node a otro según el orden de iteración del Map.
  const componentes = [...grupos.values()].sort(
    (a, b) => b.length - a.length || a[0].id - b[0].id,
  );

  const puntos = componentes.map((c) => c.flatMap((v) => v.geometry));
  const vecinos = puntos.map((pa, i) => {
    let mejor = Infinity;
    puntos.forEach((pb, j) => {
      if (i === j) return;
      for (const p of pa) for (const q of pb) {
        const d = metros(p, q);
        if (d < mejor) mejor = d;
      }
    });
    return mejor === Infinity ? null : Math.round(mejor);
  });

  const finitos = vecinos.filter((d) => d !== null);
  return {
    total_vias: vias.length,
    componentes: componentes.length,
    vias_por_componente: componentes.map((c) => c.length),
    // «A qué distancia están entre sí»: para cada componente, la distancia al
    // trozo de callejero más cercano. Es lo que decide si coserHuecos las une.
    distancia_al_vecino_mas_cercano_m: vecinos,
    distancia_minima_entre_componentes_m: finitos.length ? Math.min(...finitos) : null,
    distancia_maxima_al_vecino_mas_cercano_m: finitos.length ? Math.max(...finitos) : null,
  };
}

// --- captura ---

function hoy() {
  // Fecha de captura: se escribe una vez, en el manifiesto, y queda congelada con
  // el resto del fixture. Es el único sello de tiempo de toda la entrega y vive
  // aquí, en un script que se ejecuta a mano, nunca en el andamiaje que se ejecuta.
  return new Date().toISOString().slice(0, 10);
}

async function captura(mundo, endpoint) {
  const carpeta = join(DESTINO, mundo.nombre);
  if (existsSync(carpeta)) {
    throw new Error(
      `el fixture "${mundo.nombre}" ya existe en ${carpeta} y no se sobrescribe: ` +
      'un fixture que cambia deja de ser un fixture. Bórralo a mano si de verdad quieres recapturarlo.',
    );
  }

  const qlGeo = consultaGeo(mundo.lat, mundo.lon, mundo.radio);
  const qlPois = consultaPois(mundo.lat, mundo.lon, mundo.radio);
  const qlCallejero = consultaCallejero(mundo.lat, mundo.lon, mundo.radio);

  console.error(`· ${mundo.nombre}: geo…`);
  const geo = await pide(qlGeo, endpoint);
  console.error(`· ${mundo.nombre}: pois…`);
  const pois = await pide(qlPois, endpoint);
  console.error(`· ${mundo.nombre}: callejero…`);
  const callejero = await pide(qlCallejero, endpoint);

  const manifiesto = {
    nombre: mundo.nombre,
    descripcion: mundo.descripcion,
    coordenada: { lat: mundo.lat, lon: mundo.lon },
    radio_m: mundo.radio,
    capturado: hoy(),
    fuente: 'Overpass local del proyecto sobre el extracto spain-latest (scripts/overpass-setup.sh)',
    consultas: { geo: qlGeo, pois: qlPois, callejero: qlCallejero },
    inventario: {
      geo: { total: (geo.elements || []).length },
      pois: inventarioPois(pois),
      callejero: inventarioCallejero(callejero),
    },
  };

  mkdirSync(carpeta, { recursive: true });
  // Sin indentar los datos crudos: son la respuesta tal cual, y el peso importa
  // (presupuesto de 5 MB por fixture). El manifiesto sí va indentado: se lee.
  writeFileSync(join(carpeta, 'geo.json'), JSON.stringify(geo));
  writeFileSync(join(carpeta, 'pois.json'), JSON.stringify(pois));
  writeFileSync(join(carpeta, 'callejero.json'), JSON.stringify(callejero));
  writeFileSync(join(carpeta, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2) + '\n');
  console.error(`  ✓ ${carpeta}`);
  return manifiesto;
}

async function principal(argv) {
  let endpoint = null;
  const pedidos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--overpass') endpoint = argv[++i];
    else pedidos.push(argv[i]);
  }

  const seleccion = pedidos.length
    ? MUNDOS.filter((m) => pedidos.includes(m.nombre))
    : MUNDOS;

  const desconocidos = pedidos.filter((p) => !MUNDOS.some((m) => m.nombre === p));
  if (desconocidos.length) {
    throw new Error(
      `mundo desconocido: ${desconocidos.join(', ')}. Disponibles: ${MUNDOS.map((m) => m.nombre).join(', ')}`,
    );
  }

  for (const mundo of seleccion) await captura(mundo, endpoint);
}

// Con guardián, y no una llamada suelta en el cuerpo del módulo: sin él, importar
// este fichero desde cualquier sitio —una prueba que solo quiere leer MUNDOS—
// disparaba una captura contra la red. El mismo guardián que los demás scripts.
if (esPrincipal(import.meta.url)) {
  principal(process.argv.slice(2)).catch((e) => {
    console.error(`error: ${e.message}`);
    process.exitCode = 1;
  });
}
