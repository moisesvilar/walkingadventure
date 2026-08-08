// Informe de casting (pendiente 6 de game-design/quests.md): mide qué
// plantillas castean poco y por qué, sobre una batería de mundos sintéticos y de
// mundos REALES construidos con la tubería canónica (packages/nucleo/world/build.js).
//
//   node test/casting-report.mjs        (los mundos reales requieren `node server.mjs` corriendo)

globalThis.__WA_PROXY__ = process.env.WA_PROXY ?? 'http://localhost:8137/api/overpass';

const { buildWorld, viasDelGrafo } = await import('../packages/nucleo/world/build.js');
const { construyeGrafo } = await import('../packages/nucleo/world/grafo.js');
const { fetchGeoFeatures, fetchPois, fetchStreets } = await import('../app/js/data/overpass.js');
const { generateSettlements } = await import('../packages/nucleo/world/settlements.js');
const { buildRoutes } = await import('../packages/nucleo/world/routes.js');
const { generateParajes } = await import('../packages/nucleo/world/parajes.js');
const { castAll } = await import('../packages/nucleo/quests/casting.js');
const { CLAVES_DE_MOTIVO } = await import('../packages/nucleo/quests/motivos.js');
const { CATALOGO } = await import('../packages/nucleo/quests/catalogo.js');
const { OFICIOS, coberturaPorOficio } = await import('../packages/nucleo/quests/oficios.js');
const { TEMPLATES } = await import('../packages/nucleo/quests/templates.js');
const { namesFor } = await import('../packages/nucleo/names/index.js');
const { TRAMO_DE_REFERENCIA_M, vocabularioDeEscenas } = await import('../packages/nucleo/world/cupos.js');

// El vocabulario de escenas llega inyectado a la fase de parajes, igual que en la
// tubería: se lee del catálogo aquí, que es quien orquesta, y no allí.
const VOCABULARIO = vocabularioDeEscenas();

const es = namesFor('es');
const stats = new Map(TEMPLATES.map((t) => [t.id, { ok: 0, total: 0, motivos: new Map() }]));
// El histograma global por clave. Se cuenta **sin parsear ninguna frase**: desde
// SPEC-010 el motivo es clave, roles y requisito, y eso es lo que hace del informe
// de salud una medida y no una lectura.
const histograma = new Map(CLAVES_DE_MOTIVO.map((c) => [c, 0]));

// La cobertura por oficio se **agrega**, no se recalcula: la mide una función del
// paquete (`coberturaPorOficio`) y este informe solo la imprime. Es la misma regla
// que el motivo estructurado de SPEC-010 —el informe mide en vez de leer— aplicada
// al suelo de «diez esqueletos jugables por oficio» de `personaje.md` §3.
const porOficio = new Map(OFICIOS.map((o) => [o, { casteables: 0, total: 0, minimo: Infinity, peorMundo: null }]));

function record(worldName, results) {
  const line = results.map((c) => `${c.tpl.id.slice(0, 14)}${c.ok ? '✓' : '✗'}`).join(' ');
  const ok = results.filter((c) => c.ok).length;
  const cobertura = coberturaPorOficio({ resultados: results, catalogo: CATALOGO });
  const porOficioDelMundo = OFICIOS.map((o) => `${o} ${cobertura[o].casteables}/${cobertura[o].total}`).join('  ');
  console.log(`  ${worldName.padEnd(34)} ${ok}/${results.length}  ${line}`);
  console.log(`  ${''.padEnd(34)} ${porOficioDelMundo}`);
  for (const o of OFICIOS) {
    const acumulado = porOficio.get(o);
    acumulado.casteables += cobertura[o].casteables;
    acumulado.total += cobertura[o].total;
    if (cobertura[o].casteables < acumulado.minimo) {
      acumulado.minimo = cobertura[o].casteables;
      acumulado.peorMundo = worldName;
    }
  }
  for (const c of results) {
    const s = stats.get(c.tpl.id);
    s.total++;
    if (c.ok) { s.ok++; continue; }
    const clave = c.motivo.clave;
    s.motivos.set(clave, (s.motivos.get(clave) ?? 0) + 1);
    histograma.set(clave, histograma.get(clave) + 1);
  }
}

// El encuadre del casteo de los mundos sintéticos, el mismo que declara la tubería:
// tramo de referencia y el centro del mundo como punto de partida.
const CASTEO = { tramoM: TRAMO_DE_REFERENCIA_M, partida: { x: 0, y: 0 } };

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
  // El grafo se guarda: el casting mide los trechos sobre él, no en línea recta.
  const grafo = construyeGrafo(viasDelGrafo(geo));
  const routes = buildRoutes(settlements, grafo, seed, es);
  const parajes = generateParajes(freeAnchors, settlements, routes, geo, radius, seed, null, es, undefined, null, null, { vocabulario: VOCABULARIO });
  return { seed, radius, settlements, routes, parajes, viario: grafo, casteo: CASTEO };
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
// El callejero entra **también aquí**. Sin él la tubería construía el grafo solo
// con las carreteras del terreno y el informe medía un mundo peor conectado que el
// que la app genera: es la cuarta vez que aparece la misma forma de fallo
// (`pipeline/decisiones-orquestador.md` §6h), una pieza que al no estar no protesta.
const fetchData = async (lat, lon, radius) => {
  const [geoJson, poiJson, callejeroJson] = await Promise.all([
    fetchGeoFeatures(lat, lon, radius),
    fetchPois(lat, lon, radius),
    fetchStreets(lat, lon, radius),
  ]);
  return { geoJson, poiJson, callejeroJson };
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
let ok = 0, total = 0;
for (const [id, s] of stats) {
  const pct = s.total ? Math.round((100 * s.ok) / s.total) : 0;
  ok += s.ok; total += s.total;
  console.log(`  ${id.padEnd(22)} ${String(s.ok).padStart(2)}/${s.total}  (${pct}%)`);
  for (const [motivo, n] of [...s.motivos.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`      ✗×${n}  ${motivo}`);
  }
}
console.log(`  ${'AGREGADO'.padEnd(22)} ${ok}/${total}`);

// El histograma por clave, en el orden del catálogo cerrado y con las claves que
// nunca salieron a cero: una clave que no aparece nunca también es información.
console.log('\n— histograma de motivos (catálogo cerrado, sin parsear frases) —');
for (const clave of CLAVES_DE_MOTIVO) console.log(`  ${clave.padEnd(30)} ${histograma.get(clave)}`);

// Y el suelo por oficio, que es lo que `personaje.md` §3 pide medir y no estimar:
// «del orden de diez esqueletos jugables por oficio en un barrio de tres calles».
// Lo que importa no es el agregado sino el **peor mundo**, porque es ahí donde un
// oficio se queda sin juego.
console.log('\n— cobertura por oficio (agregado y peor mundo) —');
for (const oficio of OFICIOS) {
  const a = porOficio.get(oficio);
  console.log(`  ${oficio.padEnd(10)} ${String(a.casteables).padStart(4)}/${a.total}   peor: ${a.minimo} en ${a.peorMundo}`);
}
