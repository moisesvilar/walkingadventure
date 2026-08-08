// SPEC-015 · El mote: **de qué te conocen en cada pueblo**, y es distinto en cada uno.
//
// Lo que se guarda es la **declaración** —qué candidato trae cada rumor—, y el mote
// se deriva de lo que ese núcleo ha oído, igual que el rango. De ahí salen las dos
// cosas que aquí se afirman y que son fáciles de romper: el desempate **no usa nunca
// el orden de llegada** —oír un rumor más no puede cambiar el mote de un núcleo al
// que no llegó nada nuevo— y **no existe ninguna consulta de todos los motes del
// mapa a la vez**, porque la repisa enseña motes y no una lista de pueblos.
//
// El escenario «El mote nace del rumor y es por núcleo» está en una característica
// etiquetada `@app`; lo que se sostiene aquí es el dato del que cuelga, que es de
// núcleo. La pantalla es de la fila 38.
//
// Nada de aquí toca la red, el reloj ni el azar del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as moduloDeMotes from '../../packages/nucleo/partida/motes.js';
import {
  congelaMotes,
  declaraCandidato,
  estadoDeMotes,
  exigeCandidato,
  levantaMotes,
  moteEn,
  motesDeMapa,
  planDeCandidato,
} from '../../packages/nucleo/partida/motes.js';
import { cierraSalidaDeProgresion, estadoDeOro } from '../../packages/nucleo/partida/oro.js';
import { estadoDeObjetos } from '../../packages/nucleo/partida/objetos.js';
import { estadoDeNucleos } from '../../packages/nucleo/partida/nucleos.js';
import { CADENA, MAPA, mapaDe, oye } from './progresion-de-prueba.mjs';

const MAPA_ACTIVO = mapaDe();

/** El mote de un núcleo del mapa de la cadena. */
const moteDe = (nucleos, motes, nucleo) => moteEn(nucleos, { mapaId: MAPA, nucleo, mapa: MAPA_ACTIVO, motes });

/** Una partida vacía con lo oído y las declaraciones de mote a la vista. */
const partida = () => ({ nucleos: estadoDeNucleos(), motes: estadoDeMotes() });

describe('El mote nace del rumor y es por núcleo', () => {
  test('El mote nace del rumor y es por núcleo', () => {
    // Un desenlace notable declara su mote candidato; el rumor llega a dos núcleos
    // con distinto nivel y con otro rumor por medio, y en cada uno se pega el suyo.
    const { nucleos, motes } = partida();
    oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r1', nivel: 0, candidato: 'la-del-paquete', motes });
    oye(nucleos, { mapaId: MAPA, nucleo: 'Cadaval', rumor: 'r1', nivel: 2, candidato: 'la-del-paquete', motes });
    oye(nucleos, { mapaId: MAPA, nucleo: 'Cadaval', rumor: 'r2', nivel: 1, candidato: 'la-que-cruzou-o-monte', motes });
    oye(nucleos, { mapaId: MAPA, nucleo: 'Cadaval', rumor: 'r3', nivel: 3, candidato: 'la-que-cruzou-o-monte', motes });

    // El candidato entra en juego en el núcleo al que llegó su rumor...
    assert.equal(moteDe(nucleos, motes, 'Monfrida'), 'la-del-paquete');
    // ...y puede ser distinto en cada uno.
    assert.equal(moteDe(nucleos, motes, 'Cadaval'), 'la-que-cruzou-o-monte');
    assert.notEqual(moteDe(nucleos, motes, 'Monfrida'), moteDe(nucleos, motes, 'Cadaval'));
  });

  test('Se pega el candidato que más veces ha llegado a ese núcleo', () => {
    const { nucleos, motes } = partida();
    oye(nucleos, { mapaId: MAPA, nucleo: 'Vilanova', rumor: 'r1', nivel: 1, candidato: 'la-del-paquete', motes });
    oye(nucleos, { mapaId: MAPA, nucleo: 'Vilanova', rumor: 'r2', nivel: 1, candidato: 'la-del-paquete', motes });
    oye(nucleos, { mapaId: MAPA, nucleo: 'Vilanova', rumor: 'r3', nivel: 0, candidato: 'la-que-cruzou-o-monte', motes });

    // Dos contra uno, y el que más suena gana aunque el otro llegara más fiel.
    assert.equal(moteDe(nucleos, motes, 'Vilanova'), 'la-del-paquete');

    // Y el mote puede cambiar cuando otro candidato lo supera: no es un escalón.
    oye(nucleos, { mapaId: MAPA, nucleo: 'Vilanova', rumor: 'r4', nivel: 2, candidato: 'la-que-cruzou-o-monte', motes });
    oye(nucleos, { mapaId: MAPA, nucleo: 'Vilanova', rumor: 'r5', nivel: 3, candidato: 'la-que-cruzou-o-monte', motes });
    assert.equal(moteDe(nucleos, motes, 'Vilanova'), 'la-que-cruzou-o-monte');
  });

  test('Un empate de candidatos se resuelve por regla declarada y no por el orden de llegada', () => {
    // Dos candidatos con un rumor cada uno: empatan en número, y el desempate es el
    // nivel más bajo con el que llegó —lo que llegó más fiel suena más claro—.
    const monta = (orden) => {
      const { nucleos, motes } = partida();
      const llegadas = [
        { rumor: 'r9', nivel: 2, candidato: 'la-del-paquete' },
        { rumor: 'r1', nivel: 0, candidato: 'la-que-cruzou-o-monte' },
      ];
      for (const i of orden) oye(nucleos, { mapaId: MAPA, nucleo: 'Peiteiro', ...llegadas[i], motes });
      return moteDe(nucleos, motes, 'Peiteiro');
    };
    assert.equal(monta([0, 1]), 'la-que-cruzou-o-monte', 'el desempate no mira el nivel');
    assert.equal(monta([1, 0]), monta([0, 1]), 'el desempate depende del orden de llegada');

    // Y con el mismo nivel, la identidad del rumor: nunca el orden.
    const conMismoNivel = (orden) => {
      const { nucleos, motes } = partida();
      const llegadas = [
        { rumor: 'r9', nivel: 1, candidato: 'la-del-paquete' },
        { rumor: 'r1', nivel: 1, candidato: 'la-que-cruzou-o-monte' },
      ];
      for (const i of orden) oye(nucleos, { mapaId: MAPA, nucleo: 'Ourille', ...llegadas[i], motes });
      return moteDe(nucleos, motes, 'Ourille');
    };
    assert.equal(conMismoNivel([0, 1]), 'la-que-cruzou-o-monte', 'el desempate no mira la identidad del rumor');
    assert.equal(conMismoNivel([1, 0]), conMismoNivel([0, 1]), 'el desempate depende del orden de llegada');
  });

  test('Un núcleo que no ha oído nada no tiene mote, y no es un error', () => {
    const { nucleos, motes } = partida();
    for (const nucleo of CADENA) {
      assert.equal(moteDe(nucleos, motes, nucleo), null, `"${nucleo}" tiene mote sin haber oído nada`);
    }
  });

  test('Un rumor sin mote candidato no cambia el mote del núcleo', () => {
    const { nucleos, motes } = partida();
    oye(nucleos, { mapaId: MAPA, nucleo: 'Sanxil', rumor: 'r1', nivel: 1, candidato: 'la-del-paquete', motes });
    const antes = moteDe(nucleos, motes, 'Sanxil');

    // Dos rumores más, y ninguno declara candidato: el mote no se mueve.
    oye(nucleos, { mapaId: MAPA, nucleo: 'Sanxil', rumor: 'r2', nivel: 0 });
    oye(nucleos, { mapaId: MAPA, nucleo: 'Sanxil', rumor: 'r3', nivel: 0 });
    assert.equal(moteDe(nucleos, motes, 'Sanxil'), antes);
    assert.equal(antes, 'la-del-paquete');
  });

  test('El mote es la referencia al candidato declarado y no un texto redactado', () => {
    const { nucleos, motes } = partida();
    oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r1', nivel: 1, candidato: 'la-del-paquete', motes });
    const mote = moteDe(nucleos, motes, 'Monfrida');

    assert.equal(typeof mote, 'string');
    assert.equal(mote, 'la-del-paquete', 'el mote llega redactado y no como clave');
    assert.equal(mote.includes(' '), false, 'el mote es una frase y no una referencia');
    assert.throws(() => exigeCandidato(''), /mote candidato/);
    assert.throws(() => exigeCandidato({ texto: 'la del paquete' }), /mote candidato/);
    // Un rumor trae el mote de su desenlace y no dos.
    assert.throws(() => declaraCandidato(motes, { mapaId: MAPA, rumor: 'r1', candidato: 'otro-mote' }), /"otro-mote"/);
    assert.equal(declaraCandidato(motes, { mapaId: MAPA, rumor: 'r1', candidato: 'la-del-paquete' }), 'la-del-paquete');
  });

  test('Cada núcleo tiene el suyo o ninguno, nunca el ajeno', () => {
    const { nucleos, motes } = partida();
    oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r1', nivel: 0, candidato: 'la-del-paquete', motes });

    assert.equal(moteDe(nucleos, motes, 'Monfrida'), 'la-del-paquete');
    for (const nucleo of CADENA.filter((n) => n !== 'Monfrida')) {
      assert.equal(moteDe(nucleos, motes, nucleo), null, `"${nucleo}" lleva el mote de otro pueblo`);
    }
    // Y un núcleo que no existe en el mapa activo falla nombrando el núcleo.
    assert.throws(() => moteDe(nucleos, motes, 'Cambados'), /"Cambados"/);
  });

  test('No existe ninguna consulta de todos los motes del mapa a la vez', () => {
    const exportado = Object.keys(moduloDeMotes);
    assert.equal(exportado.includes('moteEn'), true, 'la consulta por núcleo es la que tiene que existir');
    for (const nombre of exportado) {
      if (typeof moduloDeMotes[nombre] !== 'function') continue;
      assert.equal(/todos|Todos|Delmapa|DelMapa/.test(nombre), false, `"${nombre}" parece una consulta agregada por mapa`);
      assert.equal(/fija|pega|asigna|pon/i.test(nombre), false, `"${nombre}" fija el mote de un núcleo a mano`);
    }
    // Lo que sí hay es el registro de declaraciones, que es por rumor y no por núcleo.
    const { nucleos, motes } = partida();
    oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r1', nivel: 0, candidato: 'la-del-paquete', motes });
    assert.deepEqual(Object.keys(motesDeMapa(motes, MAPA)), ['candidatos']);
    assert.deepEqual(motesDeMapa(motes, MAPA).candidatos, { r1: 'la-del-paquete' });
  });
});

describe('El mote se declara al cerrar la salida', () => {
  test('Un desenlace que declara mote candidato sin rumor del que colgarlo falla', () => {
    const estado = { oro: estadoDeOro(), objetos: estadoDeObjetos(), motes: estadoDeMotes() };
    assert.throws(
      () => cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { id: 'd1', mote: 'la-del-paquete' }, rumor: null, dia: '2026-08-08' }),
      /"la-del-paquete"/,
    );
    assert.deepEqual(congelaMotes(estado.motes), { mapas: {} }, 'la declaración ha entrado a pesar de fallar');

    // Con el rumor que acaba de nacer, entra.
    const cierre = cierraSalidaDeProgresion({ ...estado, mapaId: MAPA, desenlace: { id: 'd1', mote: 'la-del-paquete' }, rumor: 'r1', dia: '2026-08-08' });
    assert.deepEqual(cierre.mote, { rumor: 'r1', candidato: 'la-del-paquete' });
    assert.equal(planDeCandidato(estado.motes, { mapaId: MAPA, rumor: 'r1', candidato: 'la-del-paquete' }).nuevo, false);
  });
});

describe('Determinismo de los motes', () => {
  test('Los motes calculados dos veces desde cero salen idénticos', () => {
    const construye = () => {
      const { nucleos, motes } = partida();
      oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r1', nivel: 0, candidato: 'la-del-paquete', motes });
      oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r2', nivel: 1, candidato: 'la-que-cruzou-o-monte', motes });
      oye(nucleos, { mapaId: MAPA, nucleo: 'Cadaval', rumor: 'r2', nivel: 3, candidato: 'la-que-cruzou-o-monte', motes });
      return CADENA.map((n) => moteDe(nucleos, motes, n));
    };
    assert.deepEqual(construye(), construye());
    // Y la vuelta del documento no cambia ninguno: lo guardado es la declaración.
    const { nucleos, motes } = partida();
    oye(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', rumor: 'r1', nivel: 0, candidato: 'la-del-paquete', motes });
    const vueltos = levantaMotes(JSON.parse(JSON.stringify(congelaMotes(motes))));
    assert.equal(moteEn(nucleos, { mapaId: MAPA, nucleo: 'Monfrida', mapa: MAPA_ACTIVO, motes: vueltos }), 'la-del-paquete');
  });
});
