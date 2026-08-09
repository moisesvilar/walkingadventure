// SPEC-026 · El minuto de RNF-PER-001, medido de punta a punta y con un reparto que
// tiene dueño.
//
// La razón de que esto se pueda ejecutar es §6o: **el reloj está inyectado**. Un
// presupuesto que solo se puede comprobar a mano y en un despacho no se pone rojo
// nunca y por tanto no mide nada; con el reloj doblado, la comprobación del minuto se
// ejecuta en la suite, va verde con tiempos por debajo y **roja con tiempos por
// encima**, nombrando la coordenada y la fase que se lo comió. Eso es lo que la
// convierte en criterio.
//
// Lo que aquí **no** se mide es cuánto tarda de verdad: eso es el dispositivo de
// referencia contra el Overpass del proyecto con la caché fría, y esta máquina no es
// ninguno de los dos. La suite no puede tocar el reloj real ni la red, así que lo que
// se afirma es el instrumento y el criterio, no el número. La medida en dispositivo es
// @manual y sigue pendiente.
//
// Ningún escenario de docs/testing.md habla del presupuesto de rendimiento: la
// batería describe qué hace el juego, no cuánto tarda. Todo lo de este fichero va
// marcado como hueco declarado en test/spec-test-map.json.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  FASES_MEDIDAS,
  IDS_MEDIDOS,
  PRESUPUESTO_MS,
  compruebaPresupuesto,
  creaCronometro,
} from '../../app/mapa/cronometro.js';
import { creaReloj } from '../dobles/reloj.mjs';
import { coordenadaDe } from './celda-de-prueba.mjs';
import { LAS_CUATRO, LA_QUE_GOBIERNA, SEMILLA_DE_PRUEBA, TAMANO, TRAMO_M, montaLevantamiento } from './levantamiento-de-prueba.mjs';
import { mundoCongelado } from '../dobles/mundo-congelado.mjs';

/**
 * Un reparto de tiempos por fase, en milisegundos, con el que se conduce el reloj
 * doblado. Los cuatro perfiles son plausibles y **no son una medida**: sirven para
 * afirmar que el criterio distingue el que cabe del que no.
 */
const CABE = Object.freeze({ consulta: 1723, generacion: 1318, congelacion: 180, colocacion: 1, pintado: 120 });
const NO_CABE = Object.freeze({ consulta: 48000, generacion: 14000, congelacion: 200, colocacion: 50, pintado: 300 });

/** Un cronómetro conducido a mano: cada fase cuesta lo que diga el reparto. */
async function corre(reparto, { coordenada = null, cacheFria = true } = {}) {
  const reloj = creaReloj();
  const cronometro = creaCronometro({ ahora: reloj.ahora });
  cronometro.arranca();
  for (const id of IDS_MEDIDOS) {
    // El pintado se mide sincrónicamente porque grabar el cuadro de Skia lo es:
    // envolverlo en una promesa lo movería a otro turno y mediría otra cosa.
    if (id === 'pintado') cronometro.mideSincrono(id, () => reloj.avanza(reparto[id] ?? 0));
    else await cronometro.mide(id, async () => reloj.avanza(reparto[id] ?? 0));
  }
  cronometro.para();
  return { cronometro, medida: cronometro.medida({ coordenada, cacheFria }) };
}

/** Las cuatro coordenadas reales de referencia, con su nombre. */
function lasCuatroCoordenadas() {
  return LAS_CUATRO.map((nombre) => ({ nombre, ...coordenadaDe(nombre), radio_m: mundoCongelado(nombre).manifiesto.radio_m }));
}

// ════════════════════════════════════════════════════════════════════════════════
// El minuto, medido de punta a punta
// ════════════════════════════════════════════════════════════════════════════════

describe('El minuto, medido de punta a punta', () => {
  test('El presupuesto es el minuto de RNF-PER-001 y se declara como dato', () => {
    assert.equal(PRESUPUESTO_MS, 60000);
    // Las cinco fases medidas, cada una con su dueña. El dueño no es decoración: es lo
    // que hace que un incumplimiento nombre a su culpable en vez de decir «va lento».
    assert.deepEqual([...IDS_MEDIDOS], ['consulta', 'generacion', 'congelacion', 'colocacion', 'pintado']);
    for (const fase of FASES_MEDIDAS) {
      assert.ok(fase.dueña && fase.dueña.length > 0, `la fase "${fase.id}" no declara de qué fila es su tiempo`);
    }
    assert.match(FASES_MEDIDAS.find((f) => f.id === 'consulta').dueña, /fila 24/);
    assert.match(FASES_MEDIDAS.find((f) => f.id === 'colocacion').dueña, /fila 22/);
    assert.match(FASES_MEDIDAS.find((f) => f.id === 'pintado').dueña, /fila 21/);
  });

  test('El minuto se cuenta desde que se confirma la coordenada hasta que la lámina está pintada', async () => {
    const { medida } = await corre(CABE, { coordenada: '42.402,-8.809' });
    const suma = Object.values(CABE).reduce((a, b) => a + b, 0);
    assert.equal(medida.total, suma, 'el total no es de punta a punta');
    // Ni el diálogo de permiso ni el pin arrastrable entran: el cronómetro solo
    // arranca cuando alguien lo arranca, y eso ocurre al confirmar la coordenada.
    assert.equal(medida.presupuestoMs, PRESUPUESTO_MS);
    assert.equal(medida.coordenada, '42.402,-8.809');
  });

  test('El reparto es disjunto y suma el total, con las costuras declaradas aparte', async () => {
    const { medida } = await corre(CABE);
    for (const fase of medida.fases) assert.equal(fase.ms, CABE[fase.id], `la fase ${fase.id} no se ha cobrado lo suyo`);
    assert.equal(medida.fases.reduce((s, f) => s + f.ms, 0) + medida.sinRepartir, medida.total);
    assert.ok(medida.sinRepartir >= 0, 'lo que no está repartido ha salido negativo');

    // Las fases se anidan y lo de dentro no se le cobra a lo de fuera: sin eso, «la
    // consulta tarda 12 s y la generación 40 s» sobre un total de 40 s no significa nada.
    const reloj = creaReloj();
    const cronometro = creaCronometro({ ahora: reloj.ahora });
    cronometro.arranca();
    await cronometro.mide('generacion', async () => {
      reloj.avanza(100);
      await cronometro.mide('consulta', async () => reloj.avanza(900));
      reloj.avanza(50);
    });
    cronometro.para();
    const anidada = cronometro.medida();
    assert.equal(anidada.fases.find((f) => f.id === 'consulta').ms, 900);
    assert.equal(anidada.fases.find((f) => f.id === 'generacion').ms, 150, 'el tiempo de la consulta se le ha cobrado también a la generación');
    assert.equal(anidada.total, 1050);
    assert.equal(anidada.sinRepartir, 0);
  });

  test('Con el reparto por debajo del presupuesto, las cuatro coordenadas caben', async () => {
    for (const celda of lasCuatroCoordenadas()) {
      const { medida } = await corre(CABE, { coordenada: `${celda.lat},${celda.lon}` });
      assert.equal(compruebaPresupuesto(medida), medida, `${celda.nombre} no ha pasado la comprobación`);
      assert.ok(medida.total < PRESUPUESTO_MS);
      // Y el reparto queda declarado fase a fase, no como un solo número.
      assert.deepEqual(medida.fases.map((f) => f.id), [...IDS_MEDIDOS]);
    }
  });

  test('La celda urbana densa, que es la peor de las cuatro, también cabe', async () => {
    const celda = lasCuatroCoordenadas().find((c) => c.nombre === LA_QUE_GOBIERNA);
    assert.ok(celda, 'la celda que gobierna no está entre las cuatro de referencia');
    // Es la que más datos trae de las cuatro: si esa cabe, caben las cuatro.
    const radios = lasCuatroCoordenadas().map((c) => c.radio_m);
    assert.equal(celda.radio_m, Math.max(...radios), 'la celda que gobierna no es la que más datos pide');
    const { medida } = await corre(CABE, { coordenada: `${celda.lat},${celda.lon}` });
    assert.equal(compruebaPresupuesto(medida), medida);
  });

  test('Un cronómetro doblado por encima del presupuesto pone el criterio rojo', async () => {
    // §6o, literal: el criterio se puede poner rojo. Y falla nombrando la coordenada y
    // la fase que se lo comió, no diciendo «tardó de más».
    const celda = lasCuatroCoordenadas().find((c) => c.nombre === LA_QUE_GOBIERNA);
    const coordenada = `${celda.lat},${celda.lon}`;
    const { medida } = await corre(NO_CABE, { coordenada });
    assert.ok(medida.total > PRESUPUESTO_MS, 'el reparto de la prueba no se pasa del minuto: no prueba nada');
    assert.throws(
      () => compruebaPresupuesto(medida),
      (e) => {
        assert.ok(e.message.includes(coordenada), `el fallo no nombra la coordenada: ${e.message}`);
        assert.ok(e.message.includes('"consulta"'), `el fallo no nombra la fase que se lo comió: ${e.message}`);
        assert.match(e.message, /fila 24/, 'el fallo no nombra a la fila dueña de esa fase');
        assert.ok(e.message.includes(String(medida.total)), 'el fallo no dice cuánto tardó');
        assert.ok(e.message.includes(String(PRESUPUESTO_MS)), 'el fallo no dice cuál era el presupuesto');
        for (const id of IDS_MEDIDOS) assert.ok(e.message.includes(id), `el fallo no declara el reparto de ${id}`);
        return true;
      },
    );

    // Y la fase que se nombra es la peor y no la última: si la que se come el minuto es
    // la generación, el fallo acusa a la generación.
    const otra = (await corre({ ...CABE, generacion: 90000 }, { coordenada })).medida;
    assert.throws(() => compruebaPresupuesto(otra), /"generacion"/);
    assert.throws(() => compruebaPresupuesto(otra), /B1 y B2/);
  });

  test('El presupuesto se puede apretar, y entonces una medida que cabía deja de caber', async () => {
    // La misma medida contra un presupuesto más corto: es la manera de comprobar que
    // el criterio depende de la medida y no de una constante escrita dos veces.
    const { medida } = await corre(CABE, { coordenada: '40.4168,-3.7038' });
    assert.equal(compruebaPresupuesto(medida), medida);
    assert.throws(() => compruebaPresupuesto(medida, { presupuestoMs: 100 }), /40\.4168,-3\.7038/);
    assert.throws(() => compruebaPresupuesto(medida, { presupuestoMs: 100 }), /el presupuesto es 100 ms/);
  });

  test('La medida en caliente se declara aparte y no sustituye a la medida en frío', async () => {
    // La medida canónica es con la caché del proxy fría: en el onboarding la caché de
    // esa celda está fría por definición. La caliente se registra y se distingue.
    const fria = (await corre(CABE, { coordenada: '42.402,-8.809', cacheFria: true })).medida;
    const caliente = (await corre({ ...CABE, consulta: 120 }, { coordenada: '42.402,-8.809', cacheFria: false })).medida;
    assert.equal(fria.cacheFria, true);
    assert.equal(caliente.cacheFria, false);
    assert.notEqual(fria.total, caliente.total, 'las dos medidas han salido iguales: no distinguen nada');
    assert.equal(compruebaPresupuesto(fria), fria);
    assert.equal(compruebaPresupuesto(caliente), caliente);
  });

  test('El pintado sale en cero en Node, y eso es lo que significa', async () => {
    // Skia solo mide en dispositivo: `mideSincrono('pintado')` lo envuelve la pantalla
    // alrededor de la llamada que graba el cuadro, y en `node --test` esa llamada no
    // ocurre. Que salga cero no es que el pintado sea gratis: es que aquí no se pinta.
    const reloj = creaReloj();
    const cronometro = creaCronometro({ ahora: reloj.ahora });
    cronometro.arranca();
    await cronometro.mide('generacion', async () => reloj.avanza(500));
    cronometro.para();
    const medida = cronometro.medida();
    assert.equal(medida.fases.find((f) => f.id === 'pintado').ms, 0);
    // Y el hueco se declara: lo que no se repartió no se le suma a la última fase.
    assert.equal(medida.sinRepartir, medida.total - 500);
  });

  test('El cronómetro no mide sin haber arrancado, y sabe decir si está en marcha', () => {
    const cronometro = creaCronometro({ ahora: creaReloj().ahora });
    assert.equal(cronometro.enMarcha(), false, 'un cronómetro recién montado dice estar midiendo');
    assert.throws(() => cronometro.medida(), /no se ha arrancado/);
    assert.throws(() => cronometro.para(), /no se ha arrancado/);
    cronometro.arranca();
    assert.equal(cronometro.enMarcha(), true);
    assert.throws(() => cronometro.mideSincrono('inventada', () => 0), /fase medida desconocida/);
    cronometro.para();
    assert.equal(cronometro.enMarcha(), false, 'el cronómetro sigue en marcha después de pararlo');
    assert.throws(() => compruebaPresupuesto(null), /necesita una medida/);
    assert.throws(() => compruebaPresupuesto({ total: 1 }), /necesita una medida/);
  });

  test('Levantar el mapa cobra su tiempo a las fases que le corresponden', async () => {
    // Con el reloj doblado avanzando dentro de la consulta, el tiempo de los datos se
    // le cobra a la consulta y no a la generación, que es el reparto que la spec pide y
    // el que permite que un incumplimiento futuro tenga dueño.
    const reloj = creaReloj();
    const consultaOsm = async (peticion) => {
      reloj.avanza(1723);
      const datos = mundoCongelado('barrio-tres-calles');
      void peticion;
      return { geoJson: datos.geo, poiJson: datos.pois, callejeroJson: datos.callejero };
    };
    const { levantamiento, cronometro } = montaLevantamiento({ consultaOsm, reloj });
    const c = coordenadaDe('barrio-tres-calles');
    await levantamiento.levanta({ lat: c.lat, lon: c.lon, semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M, tamano: TAMANO });
    cronometro.para();
    const medida = cronometro.medida({ coordenada: `${c.lat},${c.lon}`, cacheFria: true });

    const de = (id) => medida.fases.find((f) => f.id === id).ms;
    assert.equal(de('consulta'), 1723, 'el tiempo de los datos no se le ha cobrado a la consulta');
    assert.equal(de('generacion'), 0, 'a la generación se le ha cobrado tiempo que no era suyo');
    assert.equal(de('congelacion'), 0);
    assert.equal(de('pintado'), 0, 'el pintado se ha medido en Node, donde no hay Skia');
    assert.equal(medida.total, 1723);
    assert.equal(compruebaPresupuesto(medida), medida);
  });
});
