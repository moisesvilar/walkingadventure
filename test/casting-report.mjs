// Informe de casting (pendiente 6 de game-design/quests.md): mide qué
// plantillas castean poco y por qué, sobre una batería de mundos sintéticos y de
// mundos REALES construidos con la tubería canónica (packages/nucleo/world/build.js).
//
//   node test/casting-report.mjs        (los mundos reales requieren `node server.mjs` corriendo)

globalThis.__WA_PROXY__ = process.env.WA_PROXY ?? 'http://localhost:8137/api/overpass';

const { buildWorld } = await import('../packages/nucleo/world/build.js');
const { fetchGeoFeatures, fetchPois } = await import('../app/js/data/overpass.js');
const { generateSettlements } = await import('../packages/nucleo/world/settlements.js');
const { buildRoutes } = await import('../packages/nucleo/world/routes.js');
const { generateParajes } = await import('../packages/nucleo/world/parajes.js');
const { castAll } = await import('../packages/nucleo/quests/casting.js');
const { TEMPLATES } = await import('../packages/nucleo/quests/templates.js');
const { namesFor } = await import('../packages/nucleo/names/index.js');

const es = namesFor('es');
const stats = new Map(TEMPLATES.map((t) => [t.id, { ok: 0, total: 0, motivos: new Map() }]));

function record(worldName, results) {
  const line = results.map((c) => `${c.tpl.id.slice(0, 14)}${c.ok ? '✓' : '✗'}`).join(' ');
  const ok = results.filter((c) => c.ok).length;
  console.log(`  ${worldName.padEnd(34)} ${ok}/${results.length}  ${line}`);
  for (const c of results) {
    const s = stats.get(c.tpl.id);
    s.total++;
    if (c.ok) s.ok++;
    else s.motivos.set(c.motivo, (s.motivos.get(c.motivo) ?? 0) + 1);
  }
}

// --- mundos sintéticos (mismo generador que test/headless.mjs) ---

function syntheticWorld(radius, seed) {
  const anchors = [];
  const KINDS = [
    ['cafetería', 'local', 1], ['restaurante', 'local', 1], ['iglesia', 'emplazamiento', 3],
    ['parque', 'emplazamiento', 4], ['monumento', 'emplazamiento', 4], ['manantial', 'emplazamiento', 2],
    ['torre', 'emplazamiento', 2], ['ruinas', 'emplazamiento', 4],
  ];
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 * 7, r = 40 + (i % 15) * radius * 0.055;
    const [kind, cat, weight] = KINDS[i % KINDS.length];
    anchors.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, name: `${kind} ${i}`, kind, cat, weight });
  }
  const step = radius / 16;
  const mkLine = (fx, fy) => Array.from({ length: 33 }, (_, i) => ({ x: fx(i - 16), y: fy(i - 16) }));
  const roads = [
    { pts: mkLine((k) => k * step, () => 0), nodes: null, level: 'principal', name: null },
    { pts: mkLine(() => 0, (k) => k * step), nodes: null, level: 'principal', name: null },
    { pts: mkLine((k) => k * step, (k) => k * step), nodes: null, level: 'pista', name: null },
  ];
  const rivers = [{ pts: mkLine((k) => k * step + step / 2, (k) => -k * step + radius * 0.4), kind: 'river' }];
  const geo = { coastlines: [], lakes: [], rivers, forests: [], peaks: [], roads };
  const { settlements, freeAnchors } = generateSettlements(anchors, geo, radius, seed, null, es);
  const routes = buildRoutes(settlements, geo.roads, seed, es);
  const parajes = generateParajes(freeAnchors, settlements, routes, geo, radius, seed, null, es);
  return { seed, radius, settlements, routes, parajes };
}

console.log('— mundos sintéticos (radios × semillas) —');
for (const radius of [700, 1200, 1900]) {
  for (let s = 0; s < 6; s++) {
    const w = syntheticWorld(radius, `rep#${s}`);
    record(`sintético ${radius} m #${s}`, castAll(w));
  }
}

// --- mundos reales (vía proxy con caché + Overpass local) ---

const REAL = [
  { name: 'Sanxenxo (paseo 700 m)', lat: 42.402, lon: -8.809, rBase: 700 },
  { name: 'Toledo (aventura 1200 m)', lat: 39.858, lon: -4.023, rBase: 1200 },
  { name: 'Madrid centro (aventura 1200 m)', lat: 40.4168, lon: -3.7038, rBase: 1200 },
  { name: 'A Coruña (jornada 1900 m)', lat: 43.3623, lon: -8.4115, rBase: 1900 },
];

console.log('— mundos reales —');
const fetchData = async (lat, lon, radius) => {
  const [geoJson, poiJson] = await Promise.all([fetchGeoFeatures(lat, lon, radius), fetchPois(lat, lon, radius)]);
  return { geoJson, poiJson };
};
for (const r of REAL) {
  try {
    const seed = `${r.lat.toFixed(3)},${r.lon.toFixed(3)}#0`;
    const w = await buildWorld({ lat: r.lat, lon: r.lon, rBase: r.rBase, seed, fetchData });
    record(r.name, w.casting);
  } catch (e) {
    console.log(`  ${r.name.padEnd(34)} (no disponible: ${e.message})`);
  }
}

// --- agregado ---

console.log('\n— casteabilidad por plantilla —');
for (const [id, s] of stats) {
  const pct = s.total ? Math.round((100 * s.ok) / s.total) : 0;
  console.log(`  ${id.padEnd(22)} ${String(s.ok).padStart(2)}/${s.total}  (${pct}%)`);
  for (const [motivo, n] of [...s.motivos.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`      ✗×${n}  ${motivo}`);
  }
}
