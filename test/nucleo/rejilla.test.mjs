// SPEC-003 · La rejilla de celdas: su anclaje a una coordenada redondeada, su
// dimensionado en tramos del jugador y la aritmética de índices y límites.
//
// Dos cosas se afirman aquí y no en otro sitio: que la coordenada exacta del
// arranque no queda registrada en ninguna parte —que es lo que sostiene «El rastro
// de ubicación no se guarda nunca»— y que el tamaño de una celda sale de un solo
// parámetro declarado. Los casos que llevan nombre de escenario son de
// docs/testing.md, literales; el resto van marcados como hueco en el mapa.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  LADO_CELDA_EN_TRAMOS,
  PASO_ANCLAJE_GRADOS,
  SUELO_MUNDO_JUGABLE_M,
  TRAMO_SUELO_M,
  anclaje,
  celdaEnPosicion,
  celdasContiguas,
  centroDeCelda,
  creaRejilla,
  idDeMapa,
  limitesDeCelda,
  proyectorDeRejilla,
} from '../../packages/nucleo/world/rejilla.js';
import { PRECISION_M } from '../../packages/nucleo/core/geo.js';
import { creaMapa } from '../../packages/nucleo/partida/mapa.js';
import { SEMILLA_A, serializado } from './celda-de-prueba.mjs';
import { fuente, modulosDelPaquete } from './mundo-de-prueba.mjs';

// Una coordenada de arranque con decimales reconocibles: si alguno de estos
// dígitos aparece en lo registrado, es que la posición exacta se ha guardado.
const EXACTA = { lat: 42.407163, lon: -8.809274 };

describe('La rejilla y su anclaje', () => {
  test('La rejilla se ancla a la coordenada redondeada al paso declarado, no a la recibida', () => {
    const rejilla = creaRejilla({ ...EXACTA, tramoM: 2000 });
    assert.deepEqual(rejilla.anclaje, { lat: 42.41, lon: -8.81 });
    assert.notEqual(rejilla.anclaje.lat, EXACTA.lat, 'la rejilla se ha anclado a la coordenada recibida');
    assert.notEqual(rejilla.anclaje.lon, EXACTA.lon, 'la rejilla se ha anclado a la coordenada recibida');

    // El paso es geográfico y el mismo para todo el mundo: no depende del tramo,
    // porque un paso que dependiera del tramo lo dejaría deducir del anclaje.
    assert.equal(PASO_ANCLAJE_GRADOS, 0.01);
    for (const tramoM of [600, 2000, 5000]) {
      assert.deepEqual(creaRejilla({ ...EXACTA, tramoM }).anclaje, { lat: 42.41, lon: -8.81 }, `el anclaje cambia con un tramo de ${tramoM} m`);
    }
    for (const [lat, lon] of [[0, 0], [-33.457, 151.201], [51.4991, -0.1245]]) {
      const a = anclaje(lat, lon);
      assert.equal(Math.round(a.lat / PASO_ANCLAJE_GRADOS) * PASO_ANCLAJE_GRADOS, Number(a.lat.toFixed(2)), `${lat},${lon}: el anclaje no cae en el paso`);
    }
  });

  test('Dos coordenadas dentro del mismo paso de redondeo dan el mismo anclaje', () => {
    const cerca = [
      { lat: 42.4071, lon: -8.8093 },
      { lat: 42.4119, lon: -8.8140 },
      { lat: 42.4050, lon: -8.8055 },
    ];
    const rejillas = cerca.map((c) => creaRejilla({ ...c, tramoM: 2000 }));
    for (const r of rejillas) {
      assert.deepEqual(r.anclaje, rejillas[0].anclaje, 'dos coordenadas del mismo paso dan anclajes distintos');
      assert.equal(r.id, rejillas[0].id, 'el identificador del mapa cambia dentro del mismo paso');
      assert.equal(serializado(r), serializado(rejillas[0]), 'las dos rejillas no son la misma');
    }
    assert.equal(idDeMapa(rejillas[0].anclaje), '42.41,-8.81');
  });

  test('El rastro de ubicación no se guarda nunca', () => {
    // La afirmación que importa es negativa y por eso se hace de dos maneras: que
    // los dígitos exactos no aparezcan en lo registrado, y —más fuerte— que dos
    // arranques distintos del mismo paso produzcan un registro idéntico byte a
    // byte, o sea que del registro no se puede sacar cuál de los dos fue.
    const mapa = creaMapa({ semilla: SEMILLA_A, ...EXACTA, tramoM: 2000 });
    const texto = serializado(mapa);
    for (const dato of [String(EXACTA.lat), String(EXACTA.lon), '42.4071', '-8.80927']) {
      assert.equal(texto.includes(dato), false, `la coordenada exacta (${dato}) aparece en el mapa registrado`);
    }

    const numeros = [];
    const recorre = (v) => {
      if (typeof v === 'number') numeros.push(v);
      else if (v && typeof v === 'object') for (const x of Object.values(v)) recorre(x);
    };
    recorre(mapa);
    for (const n of numeros) {
      assert.notEqual(n, EXACTA.lat, 'la latitud exacta está registrada en el mapa');
      assert.notEqual(n, EXACTA.lon, 'la longitud exacta está registrada en el mapa');
    }

    const vecino = creaMapa({ semilla: SEMILLA_A, lat: 42.4119, lon: -8.8140, tramoM: 2000 });
    assert.equal(serializado(vecino), texto, 'dos arranques del mismo paso dejan registros distintos: el registro delata dónde estabas');
  });

  test('Preguntar en qué celda cae una posición devuelve un índice entero de dos componentes', () => {
    const rejilla = creaRejilla({ ...EXACTA, tramoM: 2000 });
    for (const [dlat, dlon] of [[0, 0], [0.05, 0.05], [-0.08, 0.02], [0.3, -0.4]]) {
      const celda = celdaEnPosicion(rejilla, EXACTA.lat + dlat, EXACTA.lon + dlon);
      assert.deepEqual(Object.keys(celda).sort(), ['i', 'j']);
      assert.ok(Number.isInteger(celda.i) && Number.isInteger(celda.j), `${JSON.stringify(celda)} no es un par de enteros`);
    }
    for (const mala of [[NaN, 0], [0, undefined], ['42.4', '-8.8']]) {
      assert.throws(() => celdaEnPosicion(rejilla, mala[0], mala[1]), /coordenada válida/);
    }
  });

  test('La misma posición preguntada dos veces cae siempre en la misma celda', () => {
    const rejilla = creaRejilla({ ...EXACTA, tramoM: 2000 });
    for (const [lat, lon] of [[EXACTA.lat, EXACTA.lon], [42.44, -8.77], [42.35, -8.9]]) {
      const primera = celdaEnPosicion(rejilla, lat, lon);
      for (let k = 0; k < 5; k++) assert.deepEqual(celdaEnPosicion(rejilla, lat, lon), primera, `${lat},${lon} cambia de celda entre consultas`);
      // Y tampoco depende de por qué rejilla equivalente se pregunte.
      assert.deepEqual(celdaEnPosicion(creaRejilla({ ...EXACTA, tramoM: 2000 }), lat, lon), primera);
    }
  });

  test('Una posición sobre el borde entre dos celdas cae en una sola, según la regla declarada', () => {
    const rejilla = creaRejilla({ ...EXACTA, tramoM: 2000 });
    const proy = proyectorDeRejilla(rejilla);
    const borde = rejilla.ladoM / 2;

    // Regla declarada: intervalos semiabiertos, el borde es de la celda que
    // empieza en él. Se comprueba **a un metro** a cada lado y no en el punto
    // exacto porque el borde solo existe en metros y, desde que SPEC-009-iter-1
    // cuantiza los metros a `PRECISION_M`, solo existe en esa rejilla: el
    // milímetro con el que se comprobaba antes de la iteración **ya es el propio
    // borde** al proyectar, así que el primer punto distinguible a cada lado está
    // a `PRECISION_M`. No se afloja nada —la regla del borde se sigue afirmando a
    // los dos lados y en las dos direcciones—; lo que cambia es la distancia más
    // pequeña con la que se puede afirmar. No hay solape ni hueco —cada posición
    // tiene una celda y solo una—, pero el caso exacto no se puede afirmar con
    // una coordenada.
    const en = (x, y) => {
      const g = proy.toLatLon({ x, y });
      return celdaEnPosicion(rejilla, g.lat, g.lon);
    };
    assert.deepEqual(en(borde - PRECISION_M, 0), { i: 0, j: 0 }, 'un metro antes del borde este ya no es la celda 0,0');
    assert.deepEqual(en(borde + PRECISION_M, 0), { i: 1, j: 0 }, 'un metro después del borde este no es la celda 1,0');
    assert.deepEqual(en(0, borde + PRECISION_M), { i: 0, j: 1 });
    assert.deepEqual(en(-borde - PRECISION_M, 0), { i: -1, j: 0 });

    // Una sola celda, y siempre la misma: barrido fino cruzando el borde. El punto
    // exacto queda fuera del barrido por lo dicho arriba, y se comprueba aparte:
    // lo que se le exige es ser una sola celda y ser siempre la misma.
    for (let d = -50; d <= 50; d++) {
      if (d === 0) continue;
      const celda = en(borde + d, 0);
      assert.deepEqual(celda, en(borde + d, 0), `la celda de ${borde + d} m no es estable`);
      assert.equal(celda.i, d < 0 ? 0 : 1, `la posición a ${d} m del borde cae en la celda ${celda.i}`);
    }

    const justo = en(borde, 0);
    assert.ok(Number.isInteger(justo.i) && Number.isInteger(justo.j), 'el borde exacto no da un índice entero');
    assert.deepEqual(en(borde, 0), justo, 'el borde exacto no da siempre la misma celda');
    assert.ok([0, 1].includes(justo.i), `el borde exacto cae en la celda ${justo.i}, que no es ninguna de las dos que lo comparten`);
  });

  test('Dos celdas contiguas comparten el borde exactamente, sin solape ni hueco', () => {
    const rejilla = creaRejilla({ ...EXACTA, tramoM: 2000 });
    const cero = limitesDeCelda(rejilla, { i: 0, j: 0 });
    const este = limitesDeCelda(rejilla, { i: 1, j: 0 });
    const norte = limitesDeCelda(rejilla, { i: 0, j: 1 });

    assert.equal(cero.metros.maxX, este.metros.minX, 'el borde este de 0,0 no es el borde oeste de 1,0');
    assert.equal(cero.metros.maxY, norte.metros.minY, 'el borde norte de 0,0 no es el borde sur de 0,1');
    assert.equal(cero.metros.maxX - cero.metros.minX, rejilla.ladoM);
    assert.equal(cero.metros.maxY - cero.metros.minY, rejilla.ladoM);
    // La esquina compartida es la misma coordenada, no dos parecidas.
    assert.deepEqual(este.esquinas[0], cero.esquinas[1], 'la esquina suroeste de 1,0 no es la sureste de 0,0');
    assert.deepEqual(norte.esquinas[0], cero.esquinas[3], 'la esquina suroeste de 0,1 no es la noroeste de 0,0');

    for (const vecina of celdasContiguas({ i: 0, j: 0 })) {
      const l = limitesDeCelda(rejilla, vecina);
      const solapa = l.metros.minX < cero.metros.maxX && l.metros.maxX > cero.metros.minX
        && l.metros.minY < cero.metros.maxY && l.metros.maxY > cero.metros.minY;
      assert.equal(solapa, false, `la celda ${vecina.i},${vecina.j} solapa con la 0,0`);
    }
  });

  test('El anclaje no cambia porque el jugador se mueva ni porque cambie ningún ajuste', () => {
    const mapa = creaMapa({ semilla: SEMILLA_A, ...EXACTA, tramoM: 2000 });
    const antes = serializado(mapa.rejilla);

    // Moverse es preguntar por otras posiciones, que es lo único que la rejilla
    // recibe del jugador después de levantarse.
    for (const [dlat, dlon] of [[0.02, 0.02], [-0.05, 0.11], [0.4, -0.3]]) celdaEnPosicion(mapa.rejilla, EXACTA.lat + dlat, EXACTA.lon + dlon);
    assert.equal(serializado(mapa.rejilla), antes, 'la rejilla ha cambiado al preguntar por otras posiciones');

    // Y no hay ajuste que valga: la rejilla se entrega congelada.
    assert.equal(Object.isFrozen(mapa.rejilla), true, 'la rejilla no está congelada');
    assert.equal(Object.isFrozen(mapa.rejilla.anclaje), true, 'el anclaje no está congelado');
    assert.throws(() => { mapa.rejilla.anclaje.lat = 0; }, TypeError);
    assert.throws(() => { mapa.rejilla.ladoM = 1; }, TypeError);
    assert.equal(serializado(mapa.rejilla), antes);
  });

  test('Los límites de una celda salen de su índice y no de dónde esté el jugador', () => {
    const desdeUnSitio = creaRejilla({ ...EXACTA, tramoM: 2000 });
    const desdeOtro = creaRejilla({ lat: 42.4119, lon: -8.8140, tramoM: 2000 });
    for (const celda of [{ i: 0, j: 0 }, { i: 3, j: -2 }, { i: -7, j: 11 }]) {
      const l = desdeUnSitio.id === desdeOtro.id ? limitesDeCelda(desdeUnSitio, celda) : null;
      assert.ok(l, 'las dos coordenadas tenían que caer en el mismo anclaje');
      assert.equal(serializado(l), serializado(limitesDeCelda(desdeOtro, celda)), `los límites de ${celda.i},${celda.j} dependen de dónde estaba el jugador`);
      assert.equal(l.esquinas.length, 4, 'los límites tienen que traer las cuatro esquinas');
      for (const esquina of l.esquinas) {
        assert.ok(Number.isFinite(esquina.lat) && Number.isFinite(esquina.lon), 'una esquina no es una coordenada geográfica');
      }
      assert.deepEqual(l.celda, celda);
      assert.equal(l.ladoM, desdeUnSitio.ladoM);
      assert.deepEqual(l.centro, centroDeCelda(desdeUnSitio, celda));
      // La celda del centro de la celda es esa celda: la aritmética cierra.
      assert.deepEqual(celdaEnPosicion(desdeUnSitio, l.centro.lat, l.centro.lon), celda);
    }
  });

  test('Un índice de celda que no es un par de enteros falla nombrando el índice mal formado', () => {
    const rejilla = creaRejilla({ ...EXACTA, tramoM: 2000 });
    for (const mala of [undefined, null, {}, { i: 0 }, { i: 1.5, j: 0 }, { i: '1', j: '0' }, { i: NaN, j: 0 }]) {
      assert.throws(
        () => limitesDeCelda(rejilla, mala),
        (e) => {
          assert.match(e.message, /índice de celda mal formado/, `el error no nombra el índice: ${e.message}`);
          assert.match(e.message, /\{ i, j \}|enteros/, `el error no dice qué se esperaba: ${e.message}`);
          return true;
        },
        `limitesDeCelda ha aceptado ${JSON.stringify(mala)}`,
      );
      assert.throws(() => centroDeCelda(rejilla, mala), /índice de celda mal formado/);
      assert.throws(() => celdasContiguas(mala), /índice de celda mal formado/);
    }
  });
});

describe('El dimensionado de la celda en tramos', () => {
  test('El lado de la celda mide los tramos del parámetro y su radio inscrito mide un tramo', () => {
    for (const tramoM of [600, 1000, 2000, 3500]) {
      const rejilla = creaRejilla({ ...EXACTA, tramoM });
      assert.equal(rejilla.ladoM, tramoM * LADO_CELDA_EN_TRAMOS, `el lado con tramo ${tramoM} no son ${LADO_CELDA_EN_TRAMOS} tramos`);
      assert.equal(rejilla.ladoEnTramos, LADO_CELDA_EN_TRAMOS);
      assert.equal(rejilla.radioInscritoM, rejilla.ladoM / 2, 'el radio inscrito no es la mitad del lado');
      // Es la propiedad que justifica el parámetro: del centro al borde, un tramo.
      assert.equal(rejilla.radioInscritoM, tramoM, `con lado ${LADO_CELDA_EN_TRAMOS} el radio inscrito tiene que ser un tramo`);
    }
  });

  test('Dos jugadores con tramos distintos reciben aventuras del mismo tamaño en pasos', () => {
    // De este escenario, aquí solo se puede afirmar la mitad geométrica: las dos
    // celdas tienen la misma forma y distinto tamaño en metros. La mitad de los
    // beats es de la fila 4 (`tramo-personal`) y todavía no existe.
    const largo = creaRejilla({ ...EXACTA, tramoM: 2000 });
    const corto = creaRejilla({ ...EXACTA, tramoM: 600 });

    assert.equal(largo.ladoEnTramos, corto.ladoEnTramos, 'las dos celdas no tienen la misma forma en tramos');
    assert.equal(largo.ladoM / largo.radioInscritoM, corto.ladoM / corto.radioInscritoM, 'las dos celdas no son semejantes');
    assert.equal(largo.ladoM, 4000);
    assert.equal(corto.ladoM, 1200);
    assert.ok(Math.abs(largo.ladoM / corto.ladoM - 2000 / 600) < 1e-9, 'el tamaño en metros no escala con el tramo');
    assert.deepEqual(largo.anclaje, corto.anclaje, 'el tramo ha movido el anclaje');
  });

  // Aquí vivía «El suelo de parajes cubre el vocabulario de escenas», retirado de
  // esta suite. No se ha ablandado ni se ha marcado como pendiente: afirmaba que el
  // cupo de parajes de una celda llega al suelo derivado del catálogo, y eso es
  // RF-MUNDO-007, que el checklist asigna a las filas 4 (`tramo-personal`) y 6
  // (`parajes-cobertura-escenas`) y no a esta. Lo hereda
  // `docs/specs/SPEC-006-parajes-cobertura-escenas.md`; hoy no tiene prueba viva y
  // el hueco se ve por ausencia en `test/spec-test-map.json`.
  //
  // La medida que lo motiva, para que no haya que recalcularla: con `tramoM` = 250 m
  // (el tramo suelo), `parajeCountForRadius` da 1 paraje con el radio inscrito de esa
  // celda y 2 a 500 m, cuando el cociente del catálogo vivo pide 3 (7 escenas
  // distintas que piden los roles ÷ 3 escenas por paraje). El suelo de parajes
  // derivado del catálogo no está implementado: el cupo sale hoy de una tabla por
  // radio, que es el techo por ritmo y no el suelo.

  test('Un tramo por debajo del suelo dimensiona con el suelo y lo declara al llamante', () => {
    const rejilla = creaRejilla({ ...EXACTA, tramoM: 100 });
    assert.equal(rejilla.tramoRecortadoAlSuelo, true, 'el recorte no se declara al llamante');
    assert.equal(rejilla.tramoPedidoM, 100, 'no consta lo que pidió el jugador');
    assert.equal(rejilla.tramoM, TRAMO_SUELO_M, 'no se ha dimensionado con el suelo');
    assert.equal(rejilla.tramoSueloM, TRAMO_SUELO_M);
    assert.equal(rejilla.ladoM, TRAMO_SUELO_M * LADO_CELDA_EN_TRAMOS);
    // El suelo del tramo es el que hace que el radio inscrito llegue al suelo de
    // mundo jugable de `accesibilidad.md` §4: los dos suelos coinciden.
    assert.equal(rejilla.radioInscritoM, SUELO_MUNDO_JUGABLE_M);

    const justo = creaRejilla({ ...EXACTA, tramoM: TRAMO_SUELO_M });
    assert.equal(justo.tramoRecortadoAlSuelo, false, 'un tramo igual al suelo no está por debajo del suelo');
    const holgado = creaRejilla({ ...EXACTA, tramoM: 2000 });
    assert.equal(holgado.tramoRecortadoAlSuelo, false);
    assert.equal(holgado.tramoM, 2000);
  });

  test('Un tramo que no es un número positivo falla nombrando el parámetro inválido', () => {
    for (const malo of [undefined, null, 0, -300, NaN, Infinity, '2000', {}]) {
      assert.throws(
        () => creaRejilla({ ...EXACTA, tramoM: malo }),
        (e) => {
          assert.match(e.message, /tramoM/, `el error no nombra el parámetro: ${e.message}`);
          assert.match(e.message, /positivo/, `el error no dice qué se esperaba: ${e.message}`);
          return true;
        },
        `creaRejilla ha aceptado tramoM=${JSON.stringify(malo)}`,
      );
    }
  });

  test('El lado de celda de un mapa levantado no cambia aunque cambie el tramo del jugador', () => {
    // El tramo no es un ajuste de un mapa ya levantado: entra al levantarlo y se
    // queda dentro de la rejilla congelada. Celdas de distinto tamaño en la misma
    // rejilla dejarían de encajar, que es lo único que hace que crecer no sea
    // regenerar.
    const mapa = creaMapa({ semilla: SEMILLA_A, ...EXACTA, tramoM: 2000 });
    const antes = serializado(mapa.rejilla);

    creaMapa({ semilla: SEMILLA_A, lat: 40.4168, lon: -3.7038, tramoM: 600 }); // el jugador se mide de nuevo
    assert.throws(() => { mapa.rejilla.tramoM = 600; }, TypeError, 'se ha podido cambiar el tramo de un mapa levantado');
    assert.equal(serializado(mapa.rejilla), antes, 'la rejilla del mapa ya levantado ha cambiado');

    // Y las celdas que se abran después siguen midiendo lo mismo.
    for (const celda of [{ i: 0, j: 0 }, { i: 4, j: -1 }]) {
      assert.equal(limitesDeCelda(mapa.rejilla, celda).ladoM, 4000, `la celda ${celda.i},${celda.j} no mide el lado del mapa`);
    }
  });

  test('Un mapa levantado más tarde se dimensiona con el tramo vigente en ese momento', () => {
    const viejo = creaMapa({ semilla: SEMILLA_A, ...EXACTA, tramoM: 2000 });
    const nuevo = creaMapa({ semilla: SEMILLA_A, lat: 40.4168, lon: -3.7038, tramoM: 900 });
    assert.equal(viejo.rejilla.ladoM, 4000);
    assert.equal(nuevo.rejilla.ladoM, 1800, 'el mapa nuevo no usa el tramo vigente');
    assert.notEqual(nuevo.id, viejo.id, 'dos mapas distintos de la misma partida tienen que tener identificadores distintos');
    assert.equal(viejo.rejilla.ladoM, 4000, 'levantar un mapa nuevo ha redimensionado el anterior');
  });

  test('El parámetro de dimensionado aparece una sola vez, con su justificación, y ninguna fase lo recalcula', () => {
    const declaraciones = [];
    const usos = [];
    for (const modulo of modulosDelPaquete()) {
      const texto = fuente(modulo);
      if (/export const LADO_CELDA_EN_TRAMOS\s*=/.test(texto)) declaraciones.push(modulo);
      if (/\bLADO_CELDA_EN_TRAMOS\b/.test(texto)) usos.push(modulo);
    }
    assert.deepEqual(declaraciones, ['packages/nucleo/world/rejilla.js'], 'el parámetro de dimensionado se declara en más de un sitio');
    assert.deepEqual(usos, ['packages/nucleo/world/rejilla.js'], `otra fase usa el parámetro por su cuenta: ${usos.join(', ')}`);

    const texto = fuente('packages/nucleo/world/rejilla.js');
    assert.match(texto, /export const LADO_CELDA_EN_TRAMOS = 2;/, 'el valor por defecto no está declarado');
    const justificacion = texto.slice(Math.max(0, texto.indexOf('LADO_CELDA_EN_TRAMOS') - 1400), texto.indexOf('export const LADO_CELDA_EN_TRAMOS'));
    assert.match(justificacion, /alcance-del-mundo\.md/, 'el parámetro no cita de dónde sale');
    assert.match(justificacion, /radio inscrito/, 'el parámetro no explica por qué vale lo que vale');

    // Nadie multiplica el tramo por un número suelto: el lado sale del parámetro.
    assert.match(texto, /const ladoM = tramo \* LADO_CELDA_EN_TRAMOS;/);
    // Y el suelo del tramo se deriva del parámetro, no se clava aparte.
    assert.equal(TRAMO_SUELO_M, (2 * SUELO_MUNDO_JUGABLE_M) / LADO_CELDA_EN_TRAMOS);
  });
});
