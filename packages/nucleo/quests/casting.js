// Simulador de casting: resuelve los roles de una plantilla contra un mundo
// generado (game-design/quests.md §7). Determinista con la semilla del mundo.
//
// El casting responde: ¿esta plantilla es montable en este mundo, con qué
// reparto, y cuánto se camina? Si no lo es, dice por qué (eso también es
// información: mide la "densidad de reparto" de los mundos).

import { dist } from '../core/geo.js';
import { makeRng, shuffle } from '../core/rng.js';
import { SUFIJOS_DE_FASE } from '../core/semilla.js';
import { TEMPLATES } from './templates.js';

// Factor de rodeo (línea recta → calles reales) y ritmo a pie.
const DETOUR = 1.35;
const M_PER_MIN = 72; // ~4,3 km/h

// Tramos razonables entre beats consecutivos: ni pegados ni >~30 min andando.
const MIN_LEG = 60;
const MAX_LEG = 2400;

// Peso mínimo de la escena en el paraje para aceptar el rol.
const MIN_SCENE_WEIGHT = 0.2;

function candidatesFor(world, req) {
  if (req.tipo === 'servicio') {
    return world.settlements.flatMap((s) =>
      s.services
        .filter((v) => v.kind === req.kind && v.x != null)
        .map((v) => ({ tipo: 'servicio', kind: v.kind, nombre: v.name, x: v.x, y: v.y, en: s.name, real: v.real }))
    );
  }
  if (req.tipo === 'nucleo') {
    return world.settlements
      .filter((s) => req.types.includes(s.type))
      .map((s) => ({ tipo: 'nucleo', kind: s.type, nombre: s.name, x: s.x, y: s.y, en: null, real: s.anchor }));
  }
  if (req.tipo === 'paraje') {
    // escena admite alternativa: 'guarida' o ['vigilancia', 'revelación']
    const escenas = Array.isArray(req.escena) ? req.escena : [req.escena];
    return (world.parajes ?? [])
      .filter((p) => escenas.some((e) => (p.scenes[e] ?? 0) >= (req.minPeso ?? MIN_SCENE_WEIGHT)))
      .map((p) => {
        const escena = escenas.find((e) => (p.scenes[e] ?? 0) >= (req.minPeso ?? MIN_SCENE_WEIGHT));
        return { tipo: 'paraje', kind: p.type, nombre: p.name, x: p.x, y: p.y, en: null, real: p.real, escena };
      });
  }
  return [];
}

function describeRole(rid, req) {
  if (req.tipo === 'servicio') return `${rid}: un servicio "${req.kind}"`;
  if (req.tipo === 'nucleo') return `${rid}: un núcleo (${req.types.join('/')})`;
  const escenas = Array.isArray(req.escena) ? req.escena : [req.escena];
  return `${rid}: un paraje con escena "${escenas.join('/')}"`;
}

const walkLeg = (a, b) => dist(a, b) * DETOUR;

// Comprueba los tramos entre beats consecutivos con los roles ya asignados.
// partial=true tolera roles aún sin asignar (poda durante la búsqueda).
function legsOk(tpl, assign) {
  for (let i = 0; i < tpl.beats.length - 1; i++) {
    const a = assign[tpl.beats[i].rol];
    const b = assign[tpl.beats[i + 1].rol];
    if (!a || !b) continue;
    if (tpl.beats[i].rol === tpl.beats[i + 1].rol) continue;
    const d = walkLeg(a, b);
    if (d < MIN_LEG || d > MAX_LEG) return false;
  }
  return true;
}

/**
 * Castea una plantilla contra el mundo. Devuelve
 *   { ok: true, beats, distancia, minutos, encaja }  o  { ok: false, motivo }.
 * Búsqueda con backtracking sobre candidatos barajados con la semilla:
 * determinista, y los mundos son pequeños (pools de unidades, no miles).
 */
export function castTemplate(world, tpl, seedStr = world.seed) {
  const rng = makeRng(seedStr + SUFIJOS_DE_FASE.casting + ':' + tpl.id);

  const roleIds = Object.keys(tpl.roles);
  const pools = {};
  for (const rid of roleIds) {
    const pool = candidatesFor(world, tpl.roles[rid]);
    if (!pool.length) return { ok: false, tpl, motivo: `sin candidatos para ${describeRole(rid, tpl.roles[rid])}` };
    pools[rid] = shuffle(rng, pool);
  }

  const assign = {};
  const usedPos = new Set(); // dos roles no pueden caer en el mismo lugar
  const posKey = (c) => `${Math.round(c.x)},${Math.round(c.y)}`;

  const solve = (k) => {
    if (k === roleIds.length) return true;
    const rid = roleIds[k];
    for (const c of pools[rid]) {
      if (usedPos.has(posKey(c))) continue;
      assign[rid] = c;
      usedPos.add(posKey(c));
      if (legsOk(tpl, assign) && solve(k + 1)) return true;
      delete assign[rid];
      usedPos.delete(posKey(c));
    }
    return false;
  };

  if (!solve(0)) return { ok: false, tpl, motivo: 'hay candidatos, pero las distancias no casan (tramos fuera de 0,1–2,4 km)' };

  const beats = tpl.beats.map((b, i) => ({ n: i + 1, rol: b.rol, escena: b.escena, texto: b.texto, lugar: assign[b.rol] }));
  let distancia = 0;
  for (let i = 0; i < beats.length - 1; i++) distancia += walkLeg(beats[i].lugar, beats[i + 1].lugar);
  const minutos = Math.round(distancia / M_PER_MIN);
  const encaja = minutos <= 70 ? 'paseo' : minutos <= 140 ? 'aventura' : minutos <= 210 ? 'jornada' : 'demasiado larga';

  return { ok: true, tpl, beats, asignacion: assign, distancia: Math.round(distancia), minutos, encaja };
}

// Castea el catálogo completo contra el mundo.
export function castAll(world, seedStr = world.seed) {
  return TEMPLATES.map((tpl) => castTemplate(world, tpl, seedStr));
}
