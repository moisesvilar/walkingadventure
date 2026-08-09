// Flujo de la app: elegir ubicación y duración → consultar OSM → generar mundo → pintar.

import { fetchGeoFeatures, fetchPois, fetchStreets } from './data/overpass.js';
import { parseStreets } from '../../packages/nucleo/world/osm.js';
import { generateSettlements, footprintRadius } from '../../packages/nucleo/world/settlements.js';
import { buildRoutes, linkParajes } from '../../packages/nucleo/world/routes.js';
import { construyeGrafo } from '../../packages/nucleo/world/grafo.js';
import { generateParajes } from '../../packages/nucleo/world/parajes.js';
import { TRAMO_DE_REFERENCIA_M, vocabularioDeEscenas } from '../../packages/nucleo/world/cupos.js';
import { buildSeaMask } from '../../packages/nucleo/world/seamask.js';
import { buildWorld } from '../../packages/nucleo/world/build.js';
import { castAll } from '../../packages/nucleo/quests/casting.js';
import { MOTIVOS_DE_CASTING } from '../../packages/nucleo/quests/motivos.js';
import { renderMap } from './render/map.js';
import { STYLES, DEFAULT_STYLE, getStyle, styleFonts } from './render/styles.js';
import { namesFor } from '../../packages/nucleo/names/index.js';

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
const styleToolbar = $('style-toolbar');
const errorBox = $('error-box');
const canvas = $('fantasy-map');

let picked = { lat: 40.4168, lon: -3.7038 }; // Madrid por defecto
let seedExtra = 0;
let hits = [];
let world = null;
let view = null; // vista con zoom (núcleo o paraje), o null = mundo completo
const overpassCache = new Map();

// El estilo es puro pintado: cambiarlo repinta el mundo que ya está en pantalla,
// nunca regenera. Se recuerda entre sesiones porque es una preferencia, no un estado.
let styleId = localStorage.getItem('wa-style') ?? DEFAULT_STYLE;
if (!STYLES.some((s) => s.id === styleId)) styleId = DEFAULT_STYLE;

function repaint() {
  if (world) hits = renderMap(canvas, world, view, styleId);
}

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
$('btn-zoom-in').addEventListener('click', () => zoomPor(1.4));
$('btn-zoom-out').addEventListener('click', () => zoomPor(1 / 1.4));

// --- selector de estilo ---

// Los botones se construyen desde STYLES: añadir un estilo no toca el HTML.
const styleBar = $('style-group');
for (const s of STYLES) {
  const b = document.createElement('button');
  b.className = 'style-btn';
  b.dataset.style = s.id;
  b.textContent = s.title;
  b.title = s.hint;
  b.addEventListener('click', () => setStyle(s.id));
  styleBar.appendChild(b);
}

function refreshStyleUI() {
  document.querySelectorAll('.style-btn').forEach((b) => b.classList.toggle('selected', b.dataset.style === styleId));
  $('style-hint').textContent = getStyle(styleId).hint;
}

function setStyle(id) {
  styleId = id;
  localStorage.setItem('wa-style', id);
  refreshStyleUI();
  repaint();
}
refreshStyleUI();

// --- zoom ---

// El renderer ya dibuja cualquier ventana {cx, cy, r} en metros, así que el zoom libre
// es solo cuestión de mover esa ventana: rueda del ratón, botones y arrastre para
// desplazar. El mínimo son 40 m de radio (una plaza) y el máximo, el mundo entero.
const R_MIN = 40;

function vistaActual() {
  return view ?? { cx: 0, cy: 0, r: world.radius, focus: null, paraje: null };
}

// Escala de la vista: los mismos metros→píxeles que usa renderMap.
function escala(v) {
  return (canvas.width / 2 - getStyle(styleId).margin) / v.r;
}

function aMetros(sx, sy, v = vistaActual()) {
  const S = escala(v);
  return { x: v.cx + (sx - canvas.width / 2) / S, y: v.cy - (sy - canvas.height / 2) / S };
}

// Zoom manteniendo fijo el punto del mundo que hay bajo (sx, sy); sin punto, el centro.
function zoomPor(factor, sx = canvas.width / 2, sy = canvas.height / 2) {
  if (!world) return;
  const v = vistaActual();
  const p = aMetros(sx, sy, v);
  const r = Math.max(R_MIN, Math.min(world.radius, v.r / factor));
  if (r === v.r) return;
  const nueva = { cx: 0, cy: 0, r, focus: null, paraje: null };
  const S = escala(nueva);
  nueva.cx = p.x - (sx - canvas.width / 2) / S;
  nueva.cy = p.y + (sy - canvas.height / 2) / S;
  view = r >= world.radius ? null : nueva;
  $('btn-world').hidden = !view;
  repaint();
}

function desplazar(dx, dy) {
  if (!world || !view) return;
  const S = escala(view);
  view = { ...view, cx: view.cx - dx / S, cy: view.cy + dy / S, focus: null, paraje: null };
  repaint();
}

function zoomOut() {
  view = null;
  $('btn-world').hidden = true;
  repaint();
}

function zoomToSettlement(s) {
  const dists = s.services.filter((p) => p.x != null).map((p) => Math.hypot(p.x - s.x, p.y - s.y));
  const maxD = Math.max(60, ...dists);
  view = { cx: s.x, cy: s.y, r: Math.min(world.radius, maxD * 1.7 + 60), focus: s, paraje: null };
  $('btn-world').hidden = false;
  repaint();
  ensureStreets(s); // el callejero local llega en asíncrono y re-pinta
}

function zoomToParaje(p) {
  view = { cx: p.x, cy: p.y, r: Math.max(180, world.radius * 0.15), focus: null, paraje: p };
  $('btn-world').hidden = false;
  repaint();
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
  if (view?.focus === s) repaint();
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
  styleToolbar.hidden = true;
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
    await loadFonts();
    view = null;
    $('btn-world').hidden = true;
    repaint();

    $('world-title').textContent = world.title;
    buildSidebar(world);
    loading.hidden = true;
    mapLayout.hidden = false;
    styleToolbar.hidden = false;
  } catch (e) {
    console.error(e);
    loading.hidden = true;
    errorBox.hidden = false;
    $('error-msg').textContent = `No se pudo generar el mundo: ${e.message}. Overpass a veces se satura; prueba de nuevo en unos segundos.`;
  }
}

const tick = () => new Promise((r) => setTimeout(r, 30));

// Canvas no espera a las webfonts: si no están cargadas, el primer pintado sale con la
// tipografía de reserva. Se cargan todas las de todos los estilos, para que cambiar de
// estilo repinte al instante y con la fuente correcta.
const loadFonts = () => Promise.all(styleFonts().map((f) => document.fonts.load(f).catch(() => {})));


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

// El callejero se pide **al generar** y no solo al enfocar un núcleo: desde
// SPEC-007 alimenta el grafo viario, que es donde están los huecos cortos que hay
// que coser antes de trazar. Va en la misma tanda que las otras dos y falla igual
// que ellas: un mundo generado sin callejero es otro mundo, y sustituirlo en
// silencio por una lista vacía es exactamente el fallo callado que el cosido
// existe para cerrar.
async function fetchData(lat, lon, radius) {
  const base = `${lat.toFixed(3)},${lon.toFixed(3)}@${radius}`;
  const [geoJson, poiJson, callejeroJson] = await Promise.all([
    fetchCached(base + ':geo', () => fetchGeoFeatures(lat, lon, radius)),
    fetchCached(base + ':poi', () => fetchPois(lat, lon, radius)),
    fetchCached(base + ':streets', () => fetchStreets(lat, lon, radius)),
  ]);
  return { geoJson, poiJson, callejeroJson };
}

// --- panel lateral ---

const TYPE_LABEL = { ciudad: 'Ciudad', pueblo: 'Pueblos', aldea: 'Aldeas', granja: 'Granjas' };

// La frase del motivo se compone **aquí**, no en el casting: el motor entrega
// clave, roles y requisito, y quien pinta decide cómo se leen. Es la misma frontera
// que separa al árbitro del narrador, aplicada a la herramienta de diagnóstico.
function describeMotivo(m) {
  const roles = m.roles.join(' ↔ ');
  const r = m.requisito ?? {};
  switch (m.clave) {
    case MOTIVOS_DE_CASTING.SIN_CANDIDATOS:
      return `sin candidatos para ${roles}: ${r.tipo === 'servicio' ? `un servicio "${r.kind}"` : r.tipo === 'nucleo' ? `un núcleo (${r.types.join('/')})` : `un paraje con escena "${r.escenas.join('/')}"`}`;
    case MOTIVOS_DE_CASTING.SIN_RUTA_EN_EL_GRAFO:
      return `sin ruta en el grafo entre ${roles}`;
    case MOTIVOS_DE_CASTING.TRECHO_FUERA_DEL_TOPE:
      return `el trecho ${roles} pasa del tope (${r.enTramos.toFixed(2)} tramos, tope ${r.topeEnTramos})`;
    case MOTIVOS_DE_CASTING.TRECHO_POR_DEBAJO_DEL_MINIMO:
      return `el trecho ${roles} deja los beats pegados (${r.enTramos.toFixed(3)} tramos)`;
    case MOTIVOS_DE_CASTING.RECORRIDO_FUERA_DEL_TAMANO:
      return `el recorrido no cabe en un ${r.tamano} (${r.enTramos.toFixed(2)} tramos, alcance ${r.alcanceEnTramos})`;
    case MOTIVOS_DE_CASTING.BEATS_FUERA_DEL_TAMANO:
      return `${r.beats} beats no caben en un ${r.tamano} (${r.minimo}-${r.maximo})`;
    case MOTIVOS_DE_CASTING.LAZO_QUE_NO_CIERRA:
      return `el lazo no cierra: ${roles} queda a ${r.enTramos.toFixed(2)} tramos del punto de partida`;
    case MOTIVOS_DE_CASTING.FRANJA_INCOMPATIBLE:
      return `la franja "${r.franja}" de ${roles} cae fuera del horario diurno`;
    default:
      return m.clave;
  }
}

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
        ? `<strong>${c.tpl.titulo}</strong><div class="anchor">✓ ${c.beats.length} beats · ${c.presupuesto.enTramos.recorrido.toFixed(2)} tramos (${c.presupuesto.tamano})</div>`
        : `<strong>${c.tpl.titulo}</strong><div class="anchor">✗ ${describeMotivo(c.motivo)}</div>`;
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
    <div class="type">quest · ${c.presupuesto.tamano} · ${c.presupuesto.enTramos.recorrido.toFixed(2)} tramos · trecho mayor ${c.presupuesto.enTramos.trechoMasLargo.toFixed(2)}</div>
    <h2>${c.tpl.titulo}</h2>
    <div class="anchor">${c.tpl.gancho}</div>
    <ol class="quest-beats">${c.beats.map((b) => `<li><strong>${b.lugar.nombre}</strong><br><span class="poi-kind">${b.escena.texto}</span>${b.lugar.real?.name ? `<br><span class="poi-real">📍 ${b.lugar.real.name}</span>` : ''}</li>`).join('')}</ol>
  `;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  view = { cx: 0, cy: 0, r: world.radius, focus: null, paraje: null, quest: c };
  $('btn-world').hidden = false;
  repaint();
}

// Coordenadas del ratón en píxeles de canvas (el canvas se muestra escalado por CSS).
function enCanvas(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

// Rueda: zoom hacia el punto bajo el cursor.
canvas.addEventListener('wheel', (e) => {
  if (!world) return;
  e.preventDefault();
  const { x, y } = enCanvas(e);
  zoomPor(e.deltaY < 0 ? 1.2 : 1 / 1.2, x, y);
}, { passive: false });

// Arrastre: desplaza la vista. Se distingue del clic por un umbral de 4 px, para no
// deseleccionar un núcleo al temblar el ratón.
let arrastre = null;
let huboArrastre = false; // el evento click llega DESPUÉS de pointerup, así que hay que recordarlo
canvas.addEventListener('pointerdown', (e) => {
  if (!view) return; // en el mundo completo no hay a dónde desplazarse
  arrastre = { ...enCanvas(e), movido: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!arrastre) return;
  const p = enCanvas(e);
  const dx = p.x - arrastre.x, dy = p.y - arrastre.y;
  if (!arrastre.movido && Math.hypot(dx, dy) < 4) return;
  arrastre.movido = true;
  arrastre.x = p.x;
  arrastre.y = p.y;
  desplazar(dx, dy);
});
canvas.addEventListener('pointerup', () => { huboArrastre = !!arrastre?.movido; arrastre = null; });
canvas.addEventListener('pointercancel', () => { arrastre = null; });

// clic en el canvas → seleccionar núcleo o paraje
canvas.addEventListener('click', (e) => {
  if (huboArrastre) { huboArrastre = false; return; } // fue un desplazamiento, no un clic
  const { x, y } = enCanvas(e);
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
//   __wa.style('clasico'|'pergamino'|'cuento'|'atlas'|'reino') cambia el estilo de pintado
window.__wa = {
  go: (lat, lon) => { setPicked(lat, lon); seedExtra = 0; generate(); },
  preset: (m) => { mode = m; refreshPresetUI(); },
  style: (id) => setStyle(id),
  styles: () => STYLES.map((s) => s.id),
  world: () => world, // para repintar a mano con un estilo recién editado, sin regenerar
  demo: async () => {
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
    const rivers = [{ pts: mkLine((k) => k * 50 + 25, (k) => -k * 50 + 300), kind: 'river' }];
    // terreno sintético: sin él no se pueden comparar los estilos, que se juegan casi
    // todo en bosques, montañas, costa y agua
    const blob = (cx, cy, rx, ry, n = 24) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const w = 0.75 + 0.25 * Math.abs(Math.sin(a * 3));
        return { x: cx + Math.cos(a) * rx * w, y: cy + Math.sin(a) * ry * w };
      });
    // el terreno viaja con la misma forma que sale del parseo ({pts, osmId}); el
    // identificador es inventado porque aquí no hay ningún elemento real detrás
    const sintetico = (pts, n) => ({ pts, osmId: `demo/${n}` });
    const forests = [blob(-430, 330, 300, 210), blob(360, -420, 260, 240), blob(-250, -480, 200, 150)].map(sintetico);
    const lakes = [blob(430, 300, 110, 85, 18)].map(sintetico);
    const peaks = [
      { x: -620, y: -170, ele: 900 }, { x: -500, y: -260, ele: 1400 }, { x: -700, y: -330, ele: 700 },
      { x: 620, y: 90, ele: 1100 }, { x: 700, y: -60, ele: 600 },
    ];
    // costa: agua a la derecha del sentido de dibujo → mar en la esquina suroeste
    const coastlines = [Array.from({ length: 30 }, (_, i) => ({ x: -800 + i * 55, y: -560 - Math.sin(i / 4) * 70 }))].map(sintetico);
    const geo = { coastlines, lakes, rivers, forests, peaks, roads };
    const { settlements, freeAnchors } = generateSettlements(anchors, geo, radius, 'demo#0', null, names);
    settlements.forEach((s) => { s.streets = []; });
    // el grafo también aquí una sola vez, como en la tubería: el hook de demo
    // existe para probar el render, no para ser el único sitio donde el cosido se
    // ejecuta dos veces sobre el mismo callejero
    const grafo = construyeGrafo(roads);
    const routes = buildRoutes(settlements, grafo, 'demo#0', names);
    const parajes = generateParajes(freeAnchors, settlements, routes, geo, radius, 'demo#0', null, names, undefined, null, null, { vocabulario: vocabularioDeEscenas(), grafo });
    // los ramales nacen con nombre y del paquete de idioma, así que la fase pide
    // semilla y nombres como cualquier otra que nombre algo
    routes.push(...linkParajes(parajes, routes, settlements, grafo, 'demo#0', names));
    const seaMask = buildSeaMask(coastlines, radius * 1.5, 60);
    world = { seed: 'demo', radius, baseRadius: radius, origin: { lat: 0, lon: 0 }, locale: 'es', geo, anchors, settlements, routes, parajes, seaMask, title: 'Tierras de Prueba', viario: grafo };
    // El mismo encuadre que declara la tubería: el casting mide sobre el grafo y
    // desde el centro del mundo, así que el mundo de demostración también lo trae.
    world.casteo = { tramoM: TRAMO_DE_REFERENCIA_M, partida: { x: 0, y: 0 } };
    world.casting = castAll(world);
    phasePick.hidden = true;
    phaseMap.hidden = false;
    loading.hidden = true;
    errorBox.hidden = true;
    mapLayout.hidden = false;
    styleToolbar.hidden = false;
    view = null;
    $('btn-world').hidden = true;
    $('world-title').textContent = world.title;
    await loadFonts();
    repaint();
    buildSidebar(world);
  },
};
