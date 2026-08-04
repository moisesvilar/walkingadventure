// Flujo de la app: elegir ubicación y duración → consultar OSM → generar mundo → pintar.

import { fetchGeoFeatures, fetchPois, fetchStreets, parseStreets } from './data/overpass.js';
import { generateSettlements, footprintRadius } from './world/settlements.js';
import { buildRoutes } from './world/routes.js';
import { generateParajes } from './world/parajes.js';
import { buildWorld } from './world/build.js';
import { castAll } from './quests/casting.js';
import { renderMap } from './render/map.js';
import { namesFor } from './names/index.js';

// Presets de duración (game-design/parametros-mundo.md): el jugador elige cuánto
// quiere caminar, no kilómetros. El slider de km queda en "avanzado" para testing.
const PRESETS = {
  paseo: { radius: 700, label: 'Paseo (~1 h)' },
  aventura: { radius: 1200, label: 'Aventura (~2 h)' },
  jornada: { radius: 1900, label: 'Jornada (~3 h)' },
};
const MIN_RADIUS_KM = 0.1;
const MAX_RADIUS_KM = 30;

let mode = 'aventura'; // clave de PRESETS o 'custom'

function baseRadius() {
  if (mode !== 'custom') return PRESETS[mode].radius;
  const v = parseFloat($('radius-input')?.value);
  const km = isNaN(v) ? 1.2 : Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, v));
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
let view = null; // vista con zoom (núcleo o paraje), o null = mundo completo
const overpassCache = new Map();

// --- fase 1: selector de ubicación y duración ---

const lmap = L.map('picker-map').setView([picked.lat, picked.lon], 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(lmap);

const marker = L.marker([picked.lat, picked.lon], { draggable: true }).addTo(lmap);
const circle = L.circle([picked.lat, picked.lon], { radius: baseRadius(), color: '#7a2e1d', weight: 1.5, fillOpacity: 0.05 }).addTo(lmap);

function refreshPresetUI() {
  document.querySelectorAll('.preset-btn').forEach((b) => b.classList.toggle('selected', b.dataset.preset === mode));
  circle.setRadius(baseRadius());
}

document.querySelectorAll('.preset-btn').forEach((b) => {
  b.addEventListener('click', () => {
    mode = b.dataset.preset;
    refreshPresetUI();
  });
});
$('radius-input').addEventListener('input', () => {
  mode = 'custom';
  refreshPresetUI();
});

function setPicked(lat, lon) {
  picked = { lat, lon };
  marker.setLatLng([lat, lon]);
  circle.setLatLng([lat, lon]);
  $('coords-label').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
setPicked(picked.lat, picked.lon);
refreshPresetUI();

marker.on('dragend', () => {
  const p = marker.getLatLng();
  setPicked(p.lat, p.lng);
});
lmap.on('click', (e) => setPicked(e.latlng.lat, e.latlng.lng));

$('btn-geolocate').addEventListener('click', () => {
  navigator.geolocation?.getCurrentPosition(
    (pos) => {
      setPicked(pos.coords.latitude, pos.coords.longitude);
      lmap.setView([picked.lat, picked.lon], 12);
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

// --- zoom ---

function zoomOut() {
  view = null;
  $('btn-world').hidden = true;
  if (world) hits = renderMap(canvas, world);
}

function zoomToSettlement(s) {
  const dists = s.services.filter((p) => p.x != null).map((p) => Math.hypot(p.x - s.x, p.y - s.y));
  const maxD = Math.max(60, ...dists);
  view = { cx: s.x, cy: s.y, r: Math.min(world.radius, maxD * 1.7 + 60), focus: s, paraje: null };
  $('btn-world').hidden = false;
  hits = renderMap(canvas, world, view);
  ensureStreets(s); // el callejero local llega en asíncrono y re-pinta
}

function zoomToParaje(p) {
  view = { cx: p.x, cy: p.y, r: Math.max(180, world.radius * 0.15), focus: null, paraje: p };
  $('btn-world').hidden = false;
  hits = renderMap(canvas, world, view);
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
    const MSGS = {
      fetch: `Consultando la cartografía del mundo real (OpenStreetMap, ${+(rBase / 1000).toFixed(1)} km)…`,
      terrain: 'Interpretando el terreno: costas, ríos, bosques y montañas…',
      coast: 'Zona costera detectada: ampliando la consulta del terreno…',
      mask: 'Trazando la línea de costa y ajustando el radio del mundo…',
      settlements: 'Fundando granjas, aldeas, pueblos y la ciudad…',
      routes: 'Trazando los caminos entre núcleos…',
      parajes: 'Descubriendo parajes: ruinas, fuentes, cruces…',
    };
    world = await buildWorld({
      lat,
      lon,
      rBase,
      seed,
      fetchData,
      onStatus: async (k) => {
        setStatus(MSGS[k] ?? k);
        await tick();
      },
    });

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
      div.addEventListener('click', () => showSettlementDetail(s, div));
      list.appendChild(div);
    }
  }

  const parajes = world.parajes ?? [];
  if (parajes.length) {
    const h = document.createElement('h3');
    h.textContent = `Parajes (${parajes.length})`;
    list.appendChild(h);
    for (const p of parajes) {
      const div = document.createElement('div');
      div.className = 'settlement-item';
      div.innerHTML = `<strong>${p.name}</strong><div class="anchor">${p.label}${p.real?.name ? ` · en el mundo real: ${p.real.name}` : p.origin === 'grafo' ? ' · nacido de los caminos' : ''}</div>`;
      div.addEventListener('click', () => showParajeDetail(p, div));
      list.appendChild(div);
    }
  }

  const casting = world.casting ?? [];
  if (casting.length) {
    const ok = casting.filter((c) => c.ok).length;
    const h = document.createElement('h3');
    h.textContent = `Quests casteables (${ok}/${casting.length})`;
    list.appendChild(h);
    for (const c of casting) {
      const div = document.createElement('div');
      div.className = 'settlement-item' + (c.ok ? '' : ' quest-no');
      div.innerHTML = c.ok
        ? `<strong>${c.tpl.titulo}</strong><div class="anchor">✓ ${c.beats.length} beats · ${(c.distancia / 1000).toFixed(1)} km · ~${c.minutos} min (${c.encaja})</div>`
        : `<strong>${c.tpl.titulo}</strong><div class="anchor">✗ ${c.motivo}</div>`;
      if (c.ok) div.addEventListener('click', () => showQuestDetail(c, div));
      list.appendChild(div);
    }
  }

  $('stats').innerHTML = [
    `<strong>Datos reales usados</strong>`,
    `radio del mundo: ${+(world.radius / 1000).toFixed(2)} km${world.radius > world.baseRadius ? ` (ampliado desde ${+(world.baseRadius / 1000).toFixed(2)} km para no cortar la costa)` : ''}`,
    `idioma de los nombres: ${world.locale === 'gl' ? 'gallego' : 'castellano'}`,
    `${world.anchors.length} lugares de anclaje (POIs)`,
    `${world.geo.lakes.length} masas de agua · ${world.geo.rivers.length} tramos de río`,
    `${world.geo.coastlines.length} tramos de costa · ${world.geo.peaks.length} picos`,
    `${world.geo.forests.length} bosques`,
    `semilla: ${world.seed}`,
  ].join('<br>');
}

function clearActive() {
  document.querySelectorAll('.settlement-item.active').forEach((el) => el.classList.remove('active'));
}

function showSettlementDetail(s, itemEl) {
  clearActive();
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
  zoomToSettlement(s);
}

function showParajeDetail(p, itemEl) {
  clearActive();
  itemEl?.classList.add('active');

  const card = $('detail-card');
  card.hidden = false;
  const scenes = Object.entries(p.scenes)
    .sort((a, b) => b[1] - a[1])
    .map(([k, w]) => `${k} (${Math.round(w * 100)}%)`)
    .join(' · ');
  const realLine = p.real
    ? `<div class="anchor">en el mundo real: ${p.real.name ?? `un ${p.real.kind} sin nombre`} (${p.real.kind})</div>`
    : `<div class="anchor">nacido de los caminos: ${p.type === 'puente' ? 'donde la ruta cruza el río' : 'donde se cruzan las rutas'}</div>`;
  card.innerHTML = `
    <div class="type">paraje · ${p.label}</div>
    <h2>${p.name}</h2>
    ${realLine}
    <p class="scenes"><strong>Escenas propicias:</strong> ${scenes}</p>
  `;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  zoomToParaje(p);
}

function showQuestDetail(c, itemEl) {
  clearActive();
  itemEl?.classList.add('active');

  const card = $('detail-card');
  card.hidden = false;
  const lugarLine = (l) => `${l.nombre}${l.en ? ` (en ${l.en})` : ''}${l.real?.name ? ` · 📍 ${l.real.name}` : ''}`;
  card.innerHTML = `
    <div class="type">quest · ${c.encaja} · ${(c.distancia / 1000).toFixed(1)} km · ~${c.minutos} min</div>
    <h2>${c.tpl.titulo}</h2>
    <div class="anchor">${c.tpl.gancho}</div>
    <ol class="quest-beats">${c.beats.map((b) => `<li><strong>${b.lugar.nombre}</strong><br><span class="poi-kind">${b.texto}</span>${b.lugar.real?.name ? `<br><span class="poi-real">📍 ${b.lugar.real.name}</span>` : ''}</li>`).join('')}</ol>
  `;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  view = { cx: 0, cy: 0, r: world.radius, focus: null, paraje: null, quest: c };
  $('btn-world').hidden = false;
  hits = renderMap(canvas, world, view);
}

// clic en el canvas → seleccionar núcleo o paraje
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  let best = null, bestD = Infinity;
  for (const h of hits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < h.r + 6 && d < bestD) { bestD = d; best = h; }
  }
  if (best?.settlement) {
    showSettlementDetail(best.settlement, null);
    document.querySelectorAll('.settlement-item').forEach((el) => {
      el.classList.toggle('active', el.textContent.startsWith(best.settlement.name));
    });
  } else if (best?.paraje) {
    showParajeDetail(best.paraje, null);
    document.querySelectorAll('.settlement-item').forEach((el) => {
      el.classList.toggle('active', el.textContent.startsWith(best.paraje.name));
    });
  } else if (view) {
    zoomOut(); // clic en zona vacía estando ampliado → volver al mundo
  }
});

// hooks de depuración:
//   __wa.go(lat, lon) genera el mundo en unas coordenadas exactas
//   __wa.preset('paseo'|'aventura'|'jornada'|'custom') cambia el modo
//   __wa.demo() genera un mundo sintético sin tocar Overpass
window.__wa = {
  go: (lat, lon) => { setPicked(lat, lon); seedExtra = 0; generate(); },
  preset: (m) => { mode = m; refreshPresetUI(); },
  demo: () => {
    const names = namesFor('es');
    const anchors = [];
    const KINDS = [
      ['cafetería', 'local', 1], ['restaurante', 'local', 1], ['iglesia', 'emplazamiento', 3],
      ['parque', 'emplazamiento', 4], ['monumento', 'emplazamiento', 4], ['manantial', 'emplazamiento', 2],
    ];
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 * 5, r = 40 + (i % 12) * 55;
      const [kind, cat, weight] = KINDS[i % KINDS.length];
      anchors.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, name: `${kind[0].toUpperCase() + kind.slice(1)} de Prueba ${i}`, kind, cat, weight });
    }
    const radius = 800;
    const mkLine = (fx, fy) => Array.from({ length: 33 }, (_, i) => ({ x: fx(i - 16), y: fy(i - 16) }));
    const roads = [
      { pts: mkLine((k) => k * 50, () => 0), nodes: null, level: 'principal', name: null },
      { pts: mkLine(() => 0, (k) => k * 50), nodes: null, level: 'principal', name: null },
      { pts: mkLine((k) => k * 50, (k) => k * 50), nodes: null, level: 'pista', name: null },
    ];
    const rivers = [mkLine((k) => k * 50 + 25, (k) => -k * 50 + 300)];
    const geo = { coastlines: [], lakes: [], rivers, forests: [], peaks: [], roads };
    const { settlements, freeAnchors } = generateSettlements(anchors, geo, radius, 'demo#0', null, names);
    settlements.forEach((s) => { s.streets = []; });
    const routes = buildRoutes(settlements, roads, 'demo#0', names);
    const parajes = generateParajes(freeAnchors, settlements, routes, geo, radius, 'demo#0', null, names);
    world = { seed: 'demo', radius, baseRadius: radius, origin: { lat: 0, lon: 0 }, locale: 'es', geo, anchors, settlements, routes, parajes, seaMask: null, title: 'Tierras de Prueba' };
    world.casting = castAll(world);
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
