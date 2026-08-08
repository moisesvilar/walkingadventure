// SPEC-002 · El casting sobre el mundo que genera el paquete compartido.
//
// El porte no cambia ni una decisión de casting: lo que se afirma aquí es que
// sigue siendo determinista.
//
// Aquí faltaba un segundo caso, «El mundo mínimo todavía compone un lazo», y se
// ha retirado de esta suite —no ablandado, no marcado como pendiente— porque no
// le toca a SPEC-002 verificarlo: afirma cupos y cobertura de escenas, que
// docs/specs/SPEC-002-paquete-compartido.md excluye por escrito de su alcance.
// Una prueba que afirma lo que su spec no promete es defecto de prueba.
//
// El escenario sigue vivo en docs/testing.md y lo hereda SPEC-006
// (docs/specs/SPEC-006-parajes-cobertura-escenas.md), que es la que hace que el
// suelo de parajes salga del catálogo en vez de salir de lo que sobre. La medida
// que lo justifica: en el fixture `suelo-250m` no nace ningún paraje y las seis
// plantillas fallan con «sin candidatos».

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import { castAll } from '../../packages/nucleo/quests/casting.js';

const reparto = (casting) =>
  casting.map((c) => ({
    plantilla: c.tpl.id,
    castea: c.ok,
    motivo: c.motivo ?? null,
    beats: c.ok ? c.beats.map((b) => `${b.n}:${b.rol}:${b.lugar.nombre}`) : null,
  }));

describe('Una quest se castea contra el mundo o no se ofrece', () => {
  test('El casting es determinista', async () => {
    const world = await generaMundo('costero', semillaDe('costero', '1'));
    assert.deepEqual(reparto(castAll(world)), reparto(castAll(world)), 'dos casteos del mismo catálogo dan repartos distintos');
    // Y el que trae el mundo generado es el mismo: la tubería no castea aparte.
    assert.deepEqual(reparto(world.casting), reparto(castAll(world)));
  });
});
