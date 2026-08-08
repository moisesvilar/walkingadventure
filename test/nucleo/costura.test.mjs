// SPEC-003 · La costura entre celdas contiguas: lo que une en el borde las
// calzadas que el corte de la consulta dejó a un lado y a otro.
//
// Es el mismo problema que el callejero troceado de OSM —«Los huecos cortos se
// cosen», «Los huecos largos no se cosen», «Lo cosido y lo inventado queda
// marcado»—, aplicado aquí al borde entre dos celdas, y por eso los casos llevan
// el nombre literal de esos escenarios. La costura vive fuera de las dos celdas:
// si viviera dentro de una, abrir la vecina la modificaría, y eso es resembrar.
//
// Los datos son sintéticos a propósito: los cuatro mundos congelados caben en
// menos de un kilómetro y ninguno llega al borde de una celda de cuatro, así que
// con ellos no se puede colocar una calzada a una distancia elegida del borde.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { UMBRAL_COSTURA_M, coseCeldas, semillaDeCostura } from '../../packages/nucleo/world/costura.js';
import { COSER_MAX } from '../../packages/nucleo/world/routes.js';
import { limitesDeCelda, proyectorDeRejilla } from '../../packages/nucleo/world/rejilla.js';
import { makeProjector } from '../../packages/nucleo/core/geo.js';
import { abreCelda, celdaAbierta, celdasAbiertas, costuras, creaMapa } from '../../packages/nucleo/partida/mapa.js';
import { SEMILLA_A, consultaSintetica, serializado } from './celda-de-prueba.mjs';

const ARRANQUE = { lat: 42.407163, lon: -8.809274 };

/**
 * Un mapa con calzadas que se detienen a `retranqueoM` del borde de cada celda:
 * dos celdas contiguas dejan entre sus calzadas un hueco de dos retranqueos.
 */
function mapaConHueco(retranqueoM) {
  const mapa = creaMapa({ semilla: SEMILLA_A, ...ARRANQUE, tramoM: 2000 });
  return { mapa, consultaOsm: consultaSintetica(mapa.rejilla, { retranqueoM }) };
}

async function abre(mapa, consultaOsm, celdas) {
  for (const celda of celdas) await abreCelda(mapa, celda, { consultaOsm });
}

/** Los puntos de una celda en el marco métrico de la rejilla, que es el único común. */
function puntosEnLaRejilla(rejilla, registro) {
  const proyRejilla = proyectorDeRejilla(rejilla);
  const proyCelda = makeProjector(registro.centro.lat, registro.centro.lon);
  const out = [];
  for (const via of [...registro.mundo.routes, ...registro.mundo.geo.roads]) {
    for (const p of via.pts ?? []) {
      const g = proyCelda.toLatLon(p);
      out.push(proyRejilla.toXY(g.lat, g.lon));
    }
  }
  return out;
}

describe('La costura entre celdas contiguas', () => {
  test('Los huecos cortos se cosen', async () => {
    // Dos calzadas a 40 m de su borde: 80 m de hueco, por debajo del umbral.
    const { mapa, consultaOsm } = mapaConHueco(40);
    await abre(mapa, consultaOsm, [{ i: 0, j: 0 }, { i: 1, j: 0 }]);

    const [costura] = costuras(mapa);
    assert.ok(costura, 'no se ha calculado ninguna costura entre dos celdas contiguas');
    assert.equal(costura.contiguas, true);
    assert.deepEqual(costura.celdas, ['0,0', '1,0'], 'la costura no está en orden canónico de índices');
    assert.ok(costura.aristas.length > 0, 'las calzadas de las dos celdas no han quedado cosidas');
    assert.equal(costura.borde.eje, 'x', 'el borde entre 0,0 y 1,0 no es vertical');
    assert.equal(costura.borde.en, mapa.rejilla.ladoM / 2, 'el borde no cae donde acaba la celda 0,0');

    for (const arista of costura.aristas) {
      assert.ok(arista.metros <= UMBRAL_COSTURA_M, `se ha cosido un hueco de ${arista.metros} m, por encima del umbral`);
      assert.notEqual(arista.desde.celda, arista.hasta.celda, 'una arista de costura une una celda consigo misma');
      for (const extremo of [arista.desde, arista.hasta]) {
        assert.ok(Number.isFinite(extremo.lat) && Number.isFinite(extremo.lon), 'un extremo de la costura no es una coordenada');
      }
    }
    // El umbral es el mismo que el del cosido interno del callejero: dos umbrales
    // darían costuras que dependen de por qué lado se mira.
    assert.equal(UMBRAL_COSTURA_M, COSER_MAX);
  });

  test('Los huecos largos no se cosen', async () => {
    // 250 m de retranqueo a cada lado: 500 m de hueco, muy por encima del umbral.
    const { mapa, consultaOsm } = mapaConHueco(250);
    await abre(mapa, consultaOsm, [{ i: 0, j: 0 }, { i: 1, j: 0 }]);

    const [costura] = costuras(mapa);
    assert.ok(costura, 'la costura tiene que existir aunque salga vacía');
    assert.equal(costura.contiguas, true);
    assert.deepEqual(costura.aristas, [], 'se han cosido dos calzadas separadas por más del umbral');
  });

  test('Lo cosido y lo inventado queda marcado', async () => {
    const { mapa, consultaOsm } = mapaConHueco(40);
    await abre(mapa, consultaOsm, [{ i: 0, j: 0 }, { i: 1, j: 0 }]);
    const [costura] = costuras(mapa);

    assert.ok(costura.aristas.length > 0, 'sin aristas no se puede afirmar que van marcadas');
    for (const arista of costura.aristas) {
      assert.equal(arista.suposicion, true, 'una arista cosida en el borde no lleva su marca de suposición');
    }
    assert.equal(costura.umbralM, UMBRAL_COSTURA_M, 'la costura no declara con qué umbral se cosió');
    assert.equal(costura.semilla, semillaDeCostura(SEMILLA_A, mapa.id, { i: 0, j: 0 }, { i: 1, j: 0 }), 'la costura no lleva su semilla propia');
  });

  test('La costura sale idéntica se abran las celdas en un orden o en el otro', async () => {
    const serializadas = [];
    const celdas = [];
    for (const orden of [[{ i: 0, j: 0 }, { i: 1, j: 0 }], [{ i: 1, j: 0 }, { i: 0, j: 0 }]]) {
      const { mapa, consultaOsm } = mapaConHueco(40);
      await abre(mapa, consultaOsm, orden);
      serializadas.push(serializado(costuras(mapa)));
      celdas.push(serializado(celdasAbiertas(mapa)));
    }
    assert.equal(serializadas[1], serializadas[0], 'la costura depende de en qué orden se abrieron las celdas');
    assert.equal(celdas[1], celdas[0], 'las celdas dependen de en qué orden se abrieron');
  });

  test('Generar la costura no cambia ninguna de las dos celdas', async () => {
    const { mapa, consultaOsm } = mapaConHueco(40);
    const primera = (await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm })).registro;
    const antesDeLaVecina = serializado(primera);
    assert.deepEqual(costuras(mapa), [], 'con una sola celda abierta no puede haber costura');

    const segunda = (await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm })).registro;
    const antesDeCoserOtraVez = serializado(segunda);
    assert.equal(serializado(celdaAbierta(mapa, { i: 0, j: 0 })), antesDeLaVecina, 'la celda 0,0 ha cambiado al coserse con su vecina');

    // Y calcular la costura otra vez, desde fuera, tampoco las toca: la costura no
    // vive dentro de ninguna de las dos.
    const suelta = coseCeldas({ rejilla: mapa.rejilla, a: primera, b: segunda, semilla: mapa.semilla, mapaId: mapa.id });
    assert.equal(serializado(celdaAbierta(mapa, { i: 0, j: 0 })), antesDeLaVecina);
    assert.equal(serializado(celdaAbierta(mapa, { i: 1, j: 0 })), antesDeCoserOtraVez);
    assert.equal(serializado(suelta), serializado(costuras(mapa)[0]), 'coser dos veces las mismas celdas da costuras distintas');
    assert.throws(() => { suelta.aristas.push({}); }, TypeError, 'la costura entregada se puede modificar por detrás');
  });

  test('Una celda cuya vecina no está abierta no inventa ninguna arista hacia fuera', async () => {
    const { mapa, consultaOsm } = mapaConHueco(40);
    const registro = (await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm })).registro;

    assert.deepEqual(costuras(mapa), [], 'hay costura de una celda cuya vecina no existe');
    const limites = limitesDeCelda(mapa.rejilla, { i: 0, j: 0 });
    const puntos = puntosEnLaRejilla(mapa.rejilla, registro);
    assert.ok(puntos.length > 0, 'la celda no tiene calzadas: no se está comprobando nada');
    for (const p of puntos) {
      assert.ok(
        p.x <= limites.metros.maxX + 1e-6 && p.x >= limites.metros.minX - 1e-6,
        `una calzada de la celda 0,0 se sale por el borde (x=${Math.round(p.x)}, borde en ${limites.metros.maxX})`,
      );
    }
  });

  test('Dos celdas que no comparten borde dan una costura vacía y no un error', async () => {
    const { mapa, consultaOsm } = mapaConHueco(40);
    await abre(mapa, consultaOsm, [{ i: 0, j: 0 }, { i: 3, j: 3 }]);
    assert.deepEqual(costuras(mapa), [], 'se ha cosido algo entre dos celdas que no se tocan');

    const a = celdaAbierta(mapa, { i: 0, j: 0 });
    const b = celdaAbierta(mapa, { i: 3, j: 3 });
    const costura = coseCeldas({ rejilla: mapa.rejilla, a, b, semilla: mapa.semilla, mapaId: mapa.id });
    assert.equal(costura.contiguas, false);
    assert.deepEqual(costura.aristas, []);
    assert.equal(costura.borde, null);
    assert.deepEqual(costura.celdas, ['0,0', '3,3'], 'la costura vacía no dice de qué dos celdas es');

    // Las diagonales tampoco comparten borde: la contigüidad es de cuatro vecinas.
    await abreCelda(mapa, { i: 1, j: 1 }, { consultaOsm });
    for (const costura of costuras(mapa)) {
      const [p, q] = costura.celdas.map((c) => c.split(',').map(Number));
      assert.equal(Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]), 1, `hay costura entre ${costura.celdas.join(' y ')}, que no comparten borde`);
    }
  });

  test('Abrir una tercera celda en otro borde no cambia la costura anterior', async () => {
    const { mapa, consultaOsm } = mapaConHueco(40);
    await abre(mapa, consultaOsm, [{ i: 0, j: 0 }, { i: 1, j: 0 }]);
    const antes = serializado(costuras(mapa).find((c) => c.celdas.join('|') === '0,0|1,0'));
    assert.ok(antes, 'no se ha calculado la costura que se va a vigilar');

    await abre(mapa, consultaOsm, [{ i: 0, j: 1 }, { i: 0, j: -1 }, { i: 2, j: 0 }]);
    const despues = serializado(costuras(mapa).find((c) => c.celdas.join('|') === '0,0|1,0'));
    assert.equal(despues, antes, 'la costura de 0,0 con 1,0 ha cambiado al abrirse otras celdas');

    // Y las nuevas se han calculado, cada una una sola vez.
    const claves = costuras(mapa).map((c) => c.celdas.join('|'));
    assert.equal(new Set(claves).size, claves.length, `hay costuras repetidas: ${claves.join(', ')}`);
    assert.ok(claves.includes('0,0|0,1'), 'no se ha cosido el borde norte de 0,0');
    assert.ok(claves.includes('1,0|2,0'), 'no se ha cosido el borde este de 1,0');
  });
});
