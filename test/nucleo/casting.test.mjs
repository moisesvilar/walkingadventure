// SPEC-002 · El casting sobre el mundo que genera el paquete compartido.
//
// El porte no cambia ni una decisión de casting: lo que se afirma aquí es que
// sigue siendo determinista y que el mundo mínimo —el suelo de 250 m, que es
// donde el diseño se pelea— sigue componiendo un lazo jugable.

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

  test('El mundo mínimo todavía compone un lazo', async () => {
    const world = await generaMundo('suelo-250m', semillaDe('suelo-250m', '1'));
    assert.equal(world.radius, 250, 'el mundo mínimo tiene que ser el del suelo de 250 m');

    const casteadas = world.casting.filter((c) => c.ok);
    const motivos = world.casting.filter((c) => !c.ok).map((c) => `${c.tpl.id}: ${c.motivo}`);
    assert.ok(
      casteadas.length >= 1,
      `ninguna plantilla castea en el mundo mínimo, así que no hay lazo que cerrar:\n${motivos.join('\n')}`,
    );

    // Lazo cerrado: empieza y termina cerca del punto de partida del jugador, que
    // en un mundo generado es su centro.
    const lazo = casteadas[0];
    const primero = lazo.beats[0].lugar;
    const ultimo = lazo.beats[lazo.beats.length - 1].lugar;
    const alCentro = (p) => Math.hypot(p.x, p.y);
    assert.ok(
      Math.abs(alCentro(primero) - alCentro(ultimo)) <= world.radius,
      `${lazo.tpl.id}: el lazo no vuelve cerca de donde empezó`,
    );
  });
});
