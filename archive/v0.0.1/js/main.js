// Flujo de la app: elegir ubicación → consultar OSM → generar mundo → pintar.

import { fetchGeoFeatures, fetchPois, fetchStreets, parseGeo, parsePois, parseStreets } from './overpass.js';
import { generateSettlements, footprintRadius } from './settlements.js';
import { buildRoutes } from './roads.js';
import { renderMap } from './render.js';
import { makeRng } from './rng.js';
import { worldTitle } from './names.js';
import { buildSeaMask, computeDisplayRadius } from './seamask.js';

// El radio mínimo lo elige el usuario (>=2 km). En zonas costeras la consulta
// se amplía respecto a ese radio para poder calcular el radio dinámico.
const MIN_RADIUS_KM = 0.1;
const MAX_RADIUS_KM = 30;
const DEFAULT_RADIUS_KM = 20;

function baseRadius() {
  const v = parseFloat(document.getElementById('radius-input')?.value);
  const km = isNaN(v) ? DEFAULT_RADIUS_KM : Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, v));
  return km * 1000;
}

const $ = (id) => document.getElementById(id);
const phasePick = $('phase-pick');
const phaseMap = $('phase-map');
const loading = $('loading');
const mapLayout = $('map-layout');
const errorBox = $('error-box');
const canvas = $('fantasy-map');

let picked = { lat: 40.4168, lon: -3.7038 }; // Madrid por defecto
let seedExtra = 0;
let hits = [];
let world = null;
let view = null; // vista con zoom sobre un núcleo, o null = mundo completo
const overpassCache = new Map();

// --- fase 1: selector de ubicación ---

const lmap = L.map('picker-map').setView([picked.lat, picked.lon], 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(lmap);

const marker = L.marker([picked.lat, picked.lon], { draggable: true }).addTo(lmap);
const circle = L.circle([picked.lat, picked.lon], { radius: baseRadius(), color: '#7a2e1d', weight: 1.5, fillOpacity: 0.05 }).addTo(lmap);
document.getElementById('radius-input').addEventListener('input', () => circle.setRadius(baseRadius()));

function setPicked(lat, lon) {
  picked = { lat, lon };
  marker.setLatLng([lat, lon]);
  circle.setLatLng([lat, lon]);
  $('coords-label').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
setPicked(picked.lat, picked.lon);

marker.on('dragend', () => {
  const p = marker.getLatLng();
  setPicked(p.lat, p.lng);
});
lmap.on('click', (e) => setPicked(e.latlng.lat, e.latlng.lng));

$('btn-geolocate').addEventListener('click', () => {
  navigator.geolocation?.getCurrentPosition(
    (pos) => {
      setPicked(pos.coords.latitude, pos.coords.longitude);
      lmap.setView([picked.lat, picked.lon], 11);
    },
    () => alert('No se pudo obtener tu ubicación. Elige un punto en el mapa.')
  );
});

$('btn-generate').addEventListener('click', () => {
  seedExtra = 0;
  generate();
});
$('btn-back').addEventListener('click', () => {
  phaseMap.hidden = true;
  phasePick.hidden = false;
});
$('btn-reseed').addEventListener('click', () => {
  seedExtra++;
  generate();
});
$('btn-retry').addEventListener('click', () => generate());
$('btn-world').addEventListener('click', () => zoomOut());

function zoomOut() {
  view = null;
  $('btn-world').hidden = true;
  if (world) hits = renderMap(canvas, world);
}

function zoomTo(s) {
  // radio de la vista: ceñido al grupo de servicios (con holgura para etiquetas)
  const dists = s.services.filter((p) => p.x != null).map((p) => Math.hypot(p.x - s.x, p.y - s.y));
  const maxD = Math.max(60, ...dists);
  view = { cx: s.x, cy: s.y, r: Math.min(world.radius, maxD * 1.7 + 60), focus: s };
  $('btn-world').hidden = false;
  hits = renderMap(canvas, world, view);
  ensureStreets(s); // el callejero local llega en asíncrono y re-pinta
}

// Callejero local bajo demanda (cacheado); al llegar se re-pinta si sigue enfocado.
async function ensureStreets(s) {
  if (s.streets) return;
  const latRad = (world.origin.lat * Math.PI) / 180;
  const lat = world.origin.lat + s.y / 111320;
  const lon = world.origin.lon + s.x / (111320 * Math.cos(latRad));
  const radius = Math.round(Math.max(250, footprintRadius(s.type, world.radius) * 1.4));
  try {
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}@streets${radius}`;
    const json = await fetchCached(key, () => fetchStreets(lat, lon, radius));
    s.streets = parseStreets(json, world.origin.lat, world.origin.lon);
  } catch {
    s.streets = []; // sin callejero no se bloquea nada
  }
  if (view?.focus === s) hits = renderMap(canvas, world, view);
}

// --- fase 2: generación ---

function setStatus(msg) {
  $('loading-status').textContent = msg;
}

async function generate() {
  phasePick.hidden = true;
  phaseMap.hidden = false;
  loading.hidden = false;
  mapLayout.hidden = true;
  errorBox.hidden = true;
  $('detail-card').hidden = true;

  const { lat, lon } = picked;
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const seed = `${cacheKey}#${seedExtra}`;

  try {
    const rBase = baseRadius();
    setStatus(`Consultando la cartografía del mundo real (OpenStreetMap, ${rBase / 1000} km)…`);
    let data = await fetchData(lat, lon, rBase);

    setStatus('Interpretando el terreno: costas, ríos, bosques y montañas…');
    await tick();
    let geo = parseGeo(data.geoJson, lat, lon);
    let anchors = parsePois(data.poiJson, lat, lon);

    // Zona costera: consulta ampliada + máscara tierra/mar + radio dinámico,
    // para que el borde del mapa no corte bahías ni rías por la mitad.
    let radius = rBase;
    let seaMask = null;
    if (geo.coastlines.length) {
      // Expansión y margen proporcionales al radio elegido (para 20 km:
      // +6 km de expansión máxima y ~4 km de margen, como pide la spec).
      const extraMax = Math.max(500, rBase * 0.3);
      const margin = Math.max(200, rBase * 0.2);
      const rMax = rBase + extraMax;
      const rFetch = rMax + 1500;
      setStatus('Zona costera detectada: ampliando la consulta del terreno…');
      data = await fetchData(lat, lon, rFetch);
      geo = parseGeo(data.geoJson, lat, lon);
      anchors = parsePois(data.poiJson, lat, lon);
      setStatus('Trazando la línea de costa y ajustando el radio del mundo…');
      await tick();
      seaMask = buildSeaMask(geo.coastlines, rFetch, Math.max(40, Math.min(200, rFetch / 140)));
      radius = computeDisplayRadius(seaMask, {
        rBase,
        rMax,
        rOceanTest: rFetch - 500,
        margin,
        step: Math.max(50, Math.round(rBase * 0.025)),
      });
    }

    setStatus('Fundando granjas, aldeas, pueblos y la ciudad…');
    await tick();
    const settlements = generateSettlements(anchors, geo, radius, seed, seaMask);

    setStatus('Trazando los caminos entre núcleos…');
    await tick();
    const routes = buildRoutes(settlements, geo.roads, seed);

    world = {
      seed,
      radius,
      baseRadius: rBase,
      origin: { lat, lon },
      geo,
      anchors,
      settlements,
      routes,
      seaMask,
      title: worldTitle(makeRng(seed + ':title')),
    };

    setStatus('Dibujando el mapa…');
    await tick();
    await document.fonts.load('30px "MedievalSharp"');
    await document.fonts.load('16px "IM Fell English"');
    view = null;
    $('btn-world').hidden = true;
    hits = renderMap(canvas, world);

    $('world-title').textContent = world.title;
    buildSidebar(world);
    loading.hidden = true;
    mapLayout.hidden = false;
  } catch (e) {
    console.error(e);
    loading.hidden = true;
    errorBox.hidden = false;
    $('error-msg').textContent = `No se pudo generar el mundo: ${e.message}. Overpass a veces se satura; prueba de nuevo en unos segundos.`;
  }
}

const tick = () => new Promise((r) => setTimeout(r, 30));

// Caché por consulta individual: si geo tuvo éxito y POIs falló, el reintento
// solo repite la que falta.
async function fetchCached(key, fn) {
  let v = overpassCache.get(key);
  if (!v) {
    v = await fn();
    overpassCache.set(key, v);
  }
  return v;
}

async function fetchData(lat, lon, radius) {
  const base = `${lat.toFixed(3)},${lon.toFixed(3)}@${radius}`;
  const [geoJson, poiJson] = await Promise.all([
    fetchCached(base + ':geo', () => fetchGeoFeatures(lat, lon, radius)),
    fetchCached(base + ':poi', () => fetchPois(lat, lon, radius)),
  ]);
  return { geoJson, poiJson };
}

// --- panel lateral ---

const TYPE_LABEL = { ciudad: 'Ciudad', pueblo: 'Pueblos', aldea: 'Aldeas', granja: 'Granjas' };

function buildSidebar(world) {
  const list = $('settlement-list');
  list.innerHTML = '';
  for (const type of ['ciudad', 'pueblo', 'aldea', 'granja']) {
    const items = world.settlements.filter((s) => s.type === type);
    if (!items.length) continue;
    const h = document.createElement('h3');
    h.textContent = `${TYPE_LABEL[type]} (${items.length})`;
    list.appendChild(h);
    for (const s of items) {
      const div = document.createElement('div');
      div.className = 'settlement-item';
      div.innerHTML = `<strong>${s.name}</strong>` + (s.anchor?.name ? `<div class="anchor">inspirado en: ${s.anchor.name}</div>` : '');
      div.addEventListener('click', () => showDetail(s, div));
      list.appendChild(div);
    }
  }

  $('stats').innerHTML = [
    `<strong>Datos reales usados</strong>`,
    `radio del mundo: ${+(world.radius / 1000).toFixed(2)} km${world.radius > world.baseRadius ? ` (ampliado desde ${+(world.baseRadius / 1000).toFixed(2)} km para no cortar la costa)` : ''}`,
    `${world.anchors.length} lugares de anclaje (POIs)`,
    `${world.geo.lakes.length} masas de agua · ${world.geo.rivers.length} tramos de río`,
    `${world.geo.coastlines.length} tramos de costa · ${world.geo.peaks.length} picos`,
    `${world.geo.forests.length} bosques`,
    `semilla: ${world.seed}`,
  ].join('<br>');
}

function showDetail(s, itemEl) {
  document.querySelectorAll('.settlement-item.active').forEach((el) => el.classList.remove('active'));
  itemEl?.classList.add('active');

  const card = $('detail-card');
  card.hidden = false;
  const realLabel = (r) => (r.name ? `${r.name} (${r.kind})` : `un ${r.kind} sin nombre`);
  const services = s.services.length
    ? `<ul>${s.services
        .map(
          (p) =>
            `<li><strong>${p.name}</strong><br><span class="poi-kind">${p.label}</span>` +
            (p.real ? `<br><span class="poi-real">📍 ${realLabel(p.real)}</span>` : '') +
            `</li>`
        )
        .join('')}</ul>`
    : '<p style="opacity:.6;font-style:italic">Un lugar tranquilo, sin servicios para viajeros.</p>';
  card.innerHTML = `
    <div class="type">${s.type}</div>
    <h2>${s.name}</h2>
    ${s.anchor?.name ? `<div class="anchor">anclado al lugar real: ${s.anchor.name} (${s.anchor.kind})</div>` : ''}
    ${services}
  `;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  zoomTo(s);
}

// hooks de depuración:
//   __wa.go(lat, lon) genera el mundo en unas coordenadas exactas
//   __wa.demo() genera un mundo sintético sin tocar Overpass (para probar el render)
window.__wa = {
  go: (lat, lon) => { setPicked(lat, lon); seedExtra = 0; generate(); },
  demo: () => {
    const anchors = [];
    const KINDS = [
      ['cafetería', 'local', 1], ['restaurante', 'local', 1], ['iglesia', 'emplazamiento', 3],
      ['parque', 'emplazamiento', 4], ['monumento', 'emplazamiento', 4], ['biblioteca', 'local', 2],
    ];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 * 5, r = 40 + (i % 12) * 55;
      const [kind, cat, weight] = KINDS[i % KINDS.length];
      anchors.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, name: `${kind[0].toUpperCase() + kind.slice(1)} de Prueba ${i}`, kind, cat, weight });
    }
    const radius = 800;
    // carreteras sintéticas: una cruz y una diagonal que comparten el centro
    const mkLine = (fx, fy) => Array.from({ length: 33 }, (_, i) => ({ x: fx(i - 16), y: fy(i - 16) }));
    const roads = [
      { pts: mkLine((k) => k * 50, () => 0), nodes: null, level: 'principal', name: null },
      { pts: mkLine(() => 0, (k) => k * 50), nodes: null, level: 'principal', name: null },
      { pts: mkLine((k) => k * 50, (k) => k * 50), nodes: null, level: 'pista', name: null },
    ];
    const geo = { coastlines: [], lakes: [], rivers: [], forests: [], peaks: [], roads };
    const settlements = generateSettlements(anchors, geo, radius, 'demo#0', null);
    settlements.forEach((s) => { s.streets = []; }); // sin consultas de callejero en la demo
    const routes = buildRoutes(settlements, roads, 'demo#0');
    world = { seed: 'demo', radius, baseRadius: radius, origin: { lat: 0, lon: 0 }, geo, anchors, settlements, routes, seaMask: null, title: 'Tierras de Prueba' };
    phasePick.hidden = true;
    phaseMap.hidden = false;
    loading.hidden = true;
    errorBox.hidden = true;
    mapLayout.hidden = false;
    view = null;
    $('btn-world').hidden = true;
    $('world-title').textContent = world.title;
    hits = renderMap(canvas, world);
    buildSidebar(world);
  },
};

// clic en el canvas → seleccionar núcleo
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  let best = null, bestD = Infinity;
  for (const h of hits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < h.r + 6 && d < bestD) { bestD = d; best = h; }
  }
  if (best) {
    const items = document.querySelectorAll('.settlement-item');
    showDetail(best.settlement, null);
    // resalta también en la lista si lo encontramos por nombre
    items.forEach((el) => {
      el.classList.toggle('active', el.textContent.startsWith(best.settlement.name));
    });
  } else if (view) {
    zoomOut(); // clic en zona vacía estando ampliado → volver al mundo
  }
});
