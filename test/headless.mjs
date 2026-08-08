// Verificación headless de la generación (sin navegador ni Overpass):
//   node test/headless.mjs
// Mundo sintético con anclajes, carreteras y un río; comprueba cupos, servicios,
// rutas, parajes, idiomas y determinismo.

import { generateSettlements, countsForRadius } from '../packages/nucleo/world/settlements.js';
import { buildRoutes } from '../packages/nucleo/world/routes.js';
import { generateParajes, parajeCountForRadius, PARAJE_INFO } from '../packages/nucleo/world/parajes.js';
import { localeFor, namesFor } from '../packages/nucleo/names/index.js';
import { makeRng } from '../packages/nucleo/core/rng.js';
import { castAll, castTemplate } from '../packages/nucleo/quests/casting.js';
import { TEMPLATES } from '../packages/nucleo/quests/templates.js';

let failures = 0;
function check(name, cond, extra = '') {
  const ok = Boolean(cond);
  console.log(`${ok ? '  ✓' : '  ✗ FALLO'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
}

function syntheticWorld(radius) {
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
  return { anchors, geo: { coastlines: [], lakes: [], rivers, forests: [], peaks: [], roads } };
}

function generate(radius, seed, names) {
  const { anchors, geo } = syntheticWorld(radius);
  const { settlements, freeAnchors } = generateSettlements(anchors, geo, radius, seed, null, names);
  const routes = buildRoutes(settlements, geo.roads, seed, names);
  const parajes = generateParajes(freeAnchors, settlements, routes, geo, radius, seed, null, names);
  return { settlements, routes, parajes, freeAnchors };
}

const es = namesFor('es');
const gl = namesFor('gl');

console.log('— cupos de núcleos por radio —');
for (const [r, expected] of [[150, [1, 1, 1, 1]], [700, [1, 1, 2, 3]], [1200, [1, 1, 2, 3]], [1900, [1, 2, 3, 4]], [20000, [2, 9, 14, 20]]]) {
  const got = countsForRadius(r);
  const w = generate(r, 'test#1', es);
  const counts = ['ciudad', 'pueblo', 'aldea', 'granja'].map((t) => w.settlements.filter((s) => s.type === t).length);
  check(`radio ${r} m → cupo [${got}]`, JSON.stringify(counts) === JSON.stringify(got), `generados [${counts}]`);
  void expected;
}

console.log('— presets de duración —');
for (const [preset, r] of [['paseo', 700], ['aventura', 1200], ['jornada', 1900]]) {
  const w = generate(r, 'test#2', es);
  const total = w.settlements.length + w.parajes.length;
  check(`${preset} (${r} m): ${w.settlements.length} núcleos + ${w.parajes.length} parajes`, w.parajes.length >= 2 && total >= 6);
}

console.log('— parajes —');
{
  check('cupo por radio: 250→1, 500→2, 1000→4, 2000→7, 10000→8', parajeCountForRadius(250) === 1 && parajeCountForRadius(500) === 2 && parajeCountForRadius(1000) === 4 && parajeCountForRadius(2000) === 7 && parajeCountForRadius(10000) === 8);
  const w = generate(1200, 'test#3', es);
  const target = parajeCountForRadius(1200);
  check(`cupo cumplido en 1200 m (${w.parajes.length}/${target})`, w.parajes.length === target);
  check('todos con tipo válido y escenas', w.parajes.every((p) => PARAJE_INFO[p.type] && Object.keys(p.scenes).length >= 2));
  const names = w.parajes.map((p) => p.name);
  check('nombres únicos', new Set(names).size === names.length, names.join(' | '));
  check('todos con coordenadas', w.parajes.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  const anchored = w.parajes.filter((p) => p.origin === 'anclaje');
  check(`anclados a lugares reales: ${anchored.length}`, anchored.every((p) => p.real));
  const graph = w.parajes.filter((p) => p.origin === 'grafo');
  check(`del grafo (cruces/puentes): ${graph.length}`, graph.length >= 1 && graph.every((p) => p.type === 'cruce' || p.type === 'puente'));
}

console.log('— colchón del grafo sin anclajes —');
{
  const { geo } = syntheticWorld(1200);
  const { settlements } = generateSettlements([], geo, 1200, 'test#4', null, es);
  const routes = buildRoutes(settlements, geo.roads, 'test#4', es);
  const parajes = generateParajes([], settlements, routes, geo, 1200, 'test#4', null, es);
  check(`sin anclajes → parajes del grafo: ${parajes.length}`, parajes.length >= 1 && parajes.every((p) => p.origin === 'grafo'));
}

console.log('— rutas —');
{
  const w = generate(1200, 'test#5', es);
  check(`conectan todos los núcleos (${w.routes.length} = ${w.settlements.length - 1})`, w.routes.length === w.settlements.length - 1);
  const names = w.routes.map((r) => r.name);
  check('rutas con nombre único', new Set(names).size === names.length);
}

console.log('— idiomas por ubicación —');
{
  check('Sanxenxo (42.40, -8.81) → gallego', localeFor(42.402, -8.809) === 'gl');
  check('Madrid (40.42, -3.70) → castellano', localeFor(40.4168, -3.7038) === 'es');
  check('Oviedo (43.36, -5.85) → castellano', localeFor(43.36, -5.85) === 'es');
  const rng = makeRng('names');
  const glSample = [gl.townName(rng), gl.parajeName(rng, 'piedra'), gl.roadName(rng, gl.directionWord(rng, 1, 0), null)];
  console.log(`    muestra gl: ${glSample.join(' · ')}`);
  const wGl = generate(1200, 'test#6', gl);
  check('mundo gallego genera nombres', wGl.settlements.every((s) => s.name.length > 2) && wGl.parajes.every((p) => p.name.length > 2));
}

console.log('— casting de quests —');
{
  const w = generate(1200, 'cast#1', es);
  const world = { seed: 'cast#1', radius: 1200, settlements: w.settlements, parajes: w.parajes, routes: w.routes };
  const results = castAll(world);
  const ok = results.filter((c) => c.ok);
  console.log(`    casteables: ${ok.length}/${results.length} — ${results.map((c) => `${c.tpl.id}${c.ok ? '✓' : '✗'}`).join(' ')}`);
  check('al menos la mitad del catálogo castea en un mundo "aventura"', ok.length >= Math.ceil(results.length / 2));
  for (const c of ok) {
    check(`${c.tpl.id}: beats completos y lugares distintos por rol`, c.beats.every((b) => b.lugar) && new Set(Object.values(c.asignacion).map((l) => `${l.x},${l.y}`)).size === Object.keys(c.asignacion).length);
    check(`${c.tpl.id}: lazo (${(c.distancia / 1000).toFixed(1)} km, ~${c.minutos} min, ${c.encaja})`, c.beats[0].lugar === c.beats[c.beats.length - 1].lugar && c.encaja !== 'demasiado larga');
    const rolesParaje = Object.entries(c.tpl.roles).filter(([, r]) => r.tipo === 'paraje');
    check(`${c.tpl.id}: parajes con la escena pedida`, rolesParaje.every(([rid, r]) => {
      const p = w.parajes.find((x) => x.name === c.asignacion[rid].nombre);
      const escenas = Array.isArray(r.escena) ? r.escena : [r.escena];
      return p && escenas.some((e) => (p.scenes[e] ?? 0) >= 0.2);
    }));
  }
  const again = castAll(world);
  check('casting determinista', JSON.stringify(results.map((c) => c.ok && c.beats.map((b) => b.lugar.nombre))) === JSON.stringify(again.map((c) => c.ok && c.beats.map((b) => b.lugar.nombre))));
  const fracaso = results.find((c) => !c.ok);
  if (fracaso) check(`los no casteables explican el motivo ("${fracaso.motivo}")`, typeof fracaso.motivo === 'string' && fracaso.motivo.length > 5);
  const sinParajes = castTemplate({ seed: 'x', radius: 1200, settlements: w.settlements, parajes: [], routes: [] }, TEMPLATES.find((t) => t.id === 'entrega-sospechosa'));
  check('mundo sin parajes → motivo claro', !sinParajes.ok && sinParajes.motivo.includes('paraje'));
}

console.log('— determinismo —');
{
  const a = generate(1200, 'det#1', es);
  const b = generate(1200, 'det#1', es);
  const sig = (w) => JSON.stringify([w.settlements.map((s) => [s.type, s.name, s.x, s.y]), w.routes.map((r) => r.name), w.parajes.map((p) => [p.type, p.name, p.x, p.y])]);
  check('misma semilla → mismo mundo', sig(a) === sig(b));
  const c = generate(1200, 'det#2', es);
  check('otra semilla → otro mundo', sig(a) !== sig(c));
}

console.log(failures ? `\n${failures} fallos` : '\nTodo OK');
process.exit(failures ? 1 : 0);
