// Verificación headless de la iteración costera:
//   node test/headless.mjs [lat] [lon]
// Descarga (o reutiliza de disco) los datos Overpass de 28 km, construye la
// máscara tierra/mar, calcula el radio dinámico, genera asentamientos y
// comprueba que ninguno cae en el mar. Vuelca la máscara a PGM para inspección.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fetchGeoFeatures, fetchPois, parseGeo, parsePois } from '../js/overpass.js';
import { buildSeaMask, computeDisplayRadius, isSea } from '../js/seamask.js';
import { generateSettlements } from '../js/settlements.js';

const lat = parseFloat(process.argv[2] ?? '43.3623');
const lon = parseFloat(process.argv[3] ?? '-8.4115');
const R = 28000;

mkdirSync('test/data', { recursive: true });
const geoFile = `test/data/geo_${lat}_${lon}_${R}.json`;
const poiFile = `test/data/poi_${lat}_${lon}_${R}.json`;

let geoJson, poiJson;
if (existsSync(geoFile)) {
  console.log('usando datos cacheados en disco');
  geoJson = JSON.parse(readFileSync(geoFile, 'utf8'));
  poiJson = JSON.parse(readFileSync(poiFile, 'utf8'));
} else {
  console.log('consultando Overpass (28 km)…');
  geoJson = await fetchGeoFeatures(lat, lon, R);
  writeFileSync(geoFile, JSON.stringify(geoJson));
  poiJson = await fetchPois(lat, lon, R);
  writeFileSync(poiFile, JSON.stringify(poiJson));
}

const geo = parseGeo(geoJson, lat, lon);
const anchors = parsePois(poiJson, lat, lon);
console.log(`costas=${geo.coastlines.length} lagos=${geo.lakes.length} ríos=${geo.rivers.length} bosques=${geo.forests.length} picos=${geo.peaks.length} anclajes=${anchors.length}`);

console.time('buildSeaMask');
const mask = buildSeaMask(geo.coastlines, R);
console.timeEnd('buildSeaMask');

const seaFrac = mask ? Array.from(mask.state).filter((v) => v === 2).length / (mask.n * mask.n) : 0;
console.log(`máscara ${mask.n}x${mask.n}, ${(seaFrac * 100).toFixed(1)}% mar`);

const radius = computeDisplayRadius(mask, { rBase: 20000, rMax: 26000, rOceanTest: 27500, margin: 4000 });
console.log(`radio dinámico: ${(radius / 1000).toFixed(1)} km`);

const settlements = generateSettlements(anchors, geo, radius, 'test#0', mask);
const byType = {};
for (const s of settlements) byType[s.type] = (byType[s.type] || 0) + 1;
console.log('asentamientos:', byType);

const wet = settlements.filter((s) => isSea(mask, s));
if (wet.length) {
  console.log('❌ ASENTAMIENTOS EN EL MAR:', wet.map((s) => `${s.type} ${s.name}`));
  process.exitCode = 1;
} else {
  console.log('✅ ningún asentamiento en el mar');
}

// PGM de la máscara para inspección visual (blanco = tierra, gris = mar)
if (mask) {
  const rows = [];
  for (let j = mask.n - 1; j >= 0; j--) {
    const row = [];
    for (let i = 0; i < mask.n; i++) row.push(mask.state[j * mask.n + i] === 2 ? 90 : 230);
    rows.push(row.join(' '));
  }
  writeFileSync('test/data/mask.pgm', `P2\n${mask.n} ${mask.n}\n255\n${rows.join('\n')}\n`);
  console.log('máscara volcada a test/data/mask.pgm');
}
