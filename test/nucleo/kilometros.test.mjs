// SPEC-011 · La cuerda del reloj: de metros andados a pasos del mundo, qué
// kilómetros cuentan y la reserva acotada de la fuente de fondo.
//
// El núcleo no mira el GPS ni decide qué es un vehículo: recibe la traza **ya
// clasificada** y consulta la regla de la duda donde vive, en `ritmo.js` (SPEC-004).
// Los recorridos con velocidad salen del GPS simulado de `test/dobles/`, con su
// origen de tiempo declarado; ninguna prueba de aquí espera a que pase el tiempo ni
// lee el reloj del sistema.
//
// Tres escenarios de la batería —«Un viaje en tren no hace avanzar el mundo», «En la
// duda, cuenta» y «Volver a casa en autobús echa el telón igual»— están etiquetados
// `@app` porque allí se recorren de verdad. Lo que se afirma aquí es la mitad que la
// propia spec acota: dada una traza clasificada, qué metros mueven el contador.
//
// El motor, su semilla y el catálogo de efectos viven en pasos.test.mjs.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  TOPE_DE_RESERVA,
  abreSalidaDePasos,
  kilometrosDeFondo,
  metrosQueCuentan,
  tamanoDeLaReserva,
  vaciaReserva,
} from '../../packages/nucleo/partida/kilometros.js';
import {
  congelaPasos,
  creaMotorDePasos,
  estadoDeMapa,
  estadoDePasos,
  levantaPasos,
} from '../../packages/nucleo/partida/pasos.js';
import { REGLA_DE_LA_DUDA, entraEnLaMedidaDelTramo, mideRitmoDeSalida } from '../../packages/nucleo/partida/ritmo.js';
import { declaraTramo } from '../../packages/nucleo/partida/tramo.js';
import { simulaRecorrido } from '../dobles/gps-simulado.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { trazaDesdeRecorrido } from './partida-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';

const CASA = '42.40,-8.81';
const LEJOS = '43.36,-8.41';

/** Un tramo cómodo de dividir: 2 km en media hora, el de los escenarios de la batería. */
const TRAMO_2KM = 2000;

/** El tramo corto que la batería usa para afirmar que quien anda poco avanza igual. */
const TRAMO_600 = 600;

function productorEspia(id) {
  const llamadas = [];
  return {
    id,
    llamadas,
    produce(n, azar) {
      llamadas.push({ n, sorteo: azar() });
      return [{ tipo: 'rumor', nucleo: `nucleo-${n}`, asunto: id }];
    },
  };
}

function motorDe({ estado = estadoDePasos(), mapaId = CASA, productores = [productorEspia('rumores')] } = {}) {
  return creaMotorDePasos({ semilla: SEMILLA_A, mapaId, estado, productores });
}

/**
 * El código de un módulo sin sus comentarios.
 *
 * Hace falta porque varias afirmaciones de esta spec son negativas —«no clasifica
 * velocidades», «no sabe qué es un permiso»— y los comentarios del módulo dicen
 * exactamente esas palabras para explicar que no lo hace. Buscar sobre el texto
 * entero convertiría una buena explicación en un fallo.
 */
function codigoDe(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

const andando = (metros) => ({ metros, clasificacion: 'andando' });
const enVehiculo = (metros) => ({ metros, clasificacion: 'vehiculo' });
const ambiguo = (metros) => ({ metros, clasificacion: 'ambiguo' });
const parada = () => ({ metros: 0, clasificacion: 'parada' });

/** Una recta de norte a sur, larga de sobra para meter 30 km de tren dentro. */
const RECTA_LARGA = [{ lat: 42.4010, lon: -8.8110 }, { lat: 42.6710, lon: -8.8110 }];

/** Casa y un sitio a unos 6 km, ida y vuelta. */
const IDA_Y_VUELTA = [{ lat: 42.4010, lon: -8.8110 }, { lat: 42.4550, lon: -8.8110 }, { lat: 42.4010, lon: -8.8110 }];

describe('De metros andados a pasos', () => {
  test('Un tramo andado es un paso del mundo', () => {
    const motor = motorDe();
    const salida = abreSalidaDePasos({ motor, tramo: TRAMO_2KM });
    const resultado = salida.anda(6000);

    assert.equal(resultado.pasos.length, 3, 'seis kilómetros sobre un tramo de 2 km son tres pasos');
    assert.deepEqual(resultado.pasos.map((p) => p.n), [1, 2, 3]);
    assert.equal(motor.contador(), 3);
    assert.equal(resultado.restoM, 0);
  });

  test('Avanza igual quien anda 6 km y quien anda 900 m', () => {
    // El escenario de la batería habla del rango; aquí se afirma sobre el contador,
    // que es de donde sale: el tramo es personal, así que 1 800 m con un tramo de
    // 600 mueven el mundo lo mismo que 6 km con uno de 2 km.
    const deLejos = motorDe();
    const deCerca = motorDe();
    const largo = abreSalidaDePasos({ motor: deLejos, tramo: TRAMO_2KM }).anda(6000);
    const corto = abreSalidaDePasos({ motor: deCerca, tramo: TRAMO_600 }).anda(1800);

    assert.equal(largo.pasos.length, 3);
    assert.equal(corto.pasos.length, 3, 'quien anda menos de un kilómetro no ha movido el mundo lo mismo');
    assert.equal(deLejos.contador(), deCerca.contador());
    assert.deepEqual(corto.pasos.map((p) => p.n), largo.pasos.map((p) => p.n));
  });

  test('Cinco kilómetros con un tramo de 2 km dan dos pasos y mil metros de resto', () => {
    const motor = motorDe();
    const salida = abreSalidaDePasos({ motor, tramo: TRAMO_2KM });
    const resultado = salida.anda(5000);

    assert.equal(resultado.pasos.length, 2);
    assert.equal(motor.contador(), 2);
    assert.equal(resultado.restoM, 1000, 'los metros que no completan un paso tienen que quedar como resto');
    assert.equal(salida.restoM(), 1000);
  });

  test('El resto de una salida se conserva y lo completa la siguiente', () => {
    // Es la decisión que protege a quien sale muchas veces y poco rato: descartar el
    // resto al cerrar haría que diez salidas cortas no movieran nada.
    const estado = estadoDePasos();
    const motor = motorDe({ estado });

    const primera = abreSalidaDePasos({ motor, tramo: TRAMO_2KM });
    assert.equal(primera.anda(1200).pasos.length, 0);
    assert.equal(motor.contador(), 0);
    assert.equal(estadoDeMapa(estado, CASA).restoM, 1200, 'el resto no se ha guardado con la partida');

    const segunda = abreSalidaDePasos({ motor, tramo: TRAMO_2KM });
    const resultado = segunda.anda(800);
    assert.equal(resultado.pasos.length, 1, 'dos salidas cortas que suman un tramo tienen que completar un paso');
    assert.equal(resultado.restoM, 0);
    assert.equal(motor.contador(), 1);
  });

  test('Una salida sin un solo metro andando no avanza el mundo ni toca el resto', () => {
    const motor = motorDe();
    const salida = abreSalidaDePasos({ motor, tramo: TRAMO_2KM });
    salida.anda(700);

    const otra = abreSalidaDePasos({ motor, tramo: TRAMO_2KM });
    const vacia = otra.anda([parada(), parada()]);
    assert.deepEqual(vacia.pasos, []);
    assert.equal(vacia.restoM, 700, 'una salida sin andar ha movido el resto');
    assert.equal(motor.contador(), 0);
    // Y con cero metros pelados, lo mismo.
    assert.deepEqual(otra.anda(0).pasos, []);
    assert.equal(otra.restoM(), 700);
  });

  test('Los pasos se ejecutan durante la caminata y no se difieren al telón', () => {
    // Sin esto, «el jugador se puede adelantar a su propia fama» sería mentira: el
    // rumor tiene que avanzar mientras ella anda, no al echar el telón.
    const productor = productorEspia('rumores');
    const motor = motorDe({ productores: [productor] });
    const salida = abreSalidaDePasos({ motor, tramo: TRAMO_2KM });

    salida.anda(2000);
    assert.equal(motor.contador(), 1, 'el paso se ha diferido');
    assert.deepEqual(productor.llamadas.map((l) => l.n), [1], 'el productor no ha corrido durante la caminata');

    salida.anda(2000);
    assert.equal(motor.contador(), 2);
    assert.deepEqual(productor.llamadas.map((l) => l.n), [1, 2]);
  });

  test('Los mismos metros de una vez o en veinte muestras dan los mismos pasos y el mismo resto', () => {
    const deGolpe = motorDe();
    const aTrozos = motorDe();
    const unaVez = abreSalidaDePasos({ motor: deGolpe, tramo: TRAMO_2KM }).anda(5000);

    const salida = abreSalidaDePasos({ motor: aTrozos, tramo: TRAMO_2KM });
    const pasos = [];
    for (let k = 0; k < 20; k++) pasos.push(...salida.anda(250).pasos);

    assert.equal(pasos.length, unaVez.pasos.length, 'la cadencia del GPS ha cambiado cuántos pasos salen');
    assert.equal(JSON.stringify(pasos), JSON.stringify(unaVez.pasos));
    assert.equal(salida.restoM(), unaVez.restoM);
    assert.equal(aTrozos.contador(), deGolpe.contador());
  });

  test('Una entrega de metros negativa o no numérica falla sin tocar el contador ni el resto', () => {
    const motor = motorDe();
    const salida = abreSalidaDePasos({ motor, tramo: TRAMO_2KM });
    salida.anda(1500);

    for (const malo of [-100, NaN, Infinity, '2000', null]) {
      assert.throws(
        () => salida.anda(malo),
        (e) => e instanceof Error && /metros/.test(e.message),
        `andar ${JSON.stringify(malo)} debería fallar nombrando el valor recibido`,
      );
    }
    assert.equal(motor.contador(), 0, 'una entrega inválida ha movido el contador');
    assert.equal(salida.restoM(), 1500, 'una entrega inválida ha movido el resto');
  });

  test('Sin tramo declarado la conversión falla nombrando el tramo que falta, en lugar de suponer uno por defecto', () => {
    const motor = motorDe();
    for (const sinTramo of [undefined, null, {}, 0]) {
      assert.throws(
        () => abreSalidaDePasos({ motor, tramo: sinTramo }),
        (e) => e instanceof Error && /tramo/i.test(e.message),
        `sin tramo (${JSON.stringify(sinTramo)}) debería fallar nombrando el tramo`,
      );
    }
    assert.equal(motor.contador(), 0);
  });

  test('El tramo usado es el que había al abrir la salida y no cambia a mitad de ella', () => {
    // El tramo se corrige al cerrar la salida con la medida de esa misma salida
    // (SPEC-004): usar el estimado vivo haría que la misma caminata se convirtiera en
    // un número de pasos distinto según cuándo se mirase.
    const motor = motorDe();
    const tramoVivo = { declaradoM: TRAMO_2KM, estimadoM: TRAMO_2KM, salidasMedidas: 0 };
    const salida = abreSalidaDePasos({ motor, tramo: tramoVivo });

    salida.anda(1000);
    tramoVivo.estimadoM = TRAMO_600;
    const resultado = salida.anda(1000);

    assert.equal(salida.tramoM, TRAMO_2KM, 'el tramo de la salida ha cambiado a mitad de ella');
    assert.equal(resultado.pasos.length, 1, 'con el tramo congelado en 2 km, 2 000 m son exactamente un paso');
    assert.equal(resultado.restoM, 0);
    assert.equal(motor.contador(), 1);
  });

  test('Bajar el tramo al cerrar la salida no recalcula ningún paso ya ejecutado', () => {
    const motor = motorDe();
    const antes = abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda(6000);
    const retrato = JSON.stringify(antes.pasos);

    // La jugadora resulta ser más lenta de lo que dijo: el tramo baja para la
    // siguiente salida, y lo ya andado no se reescribe.
    const siguiente = abreSalidaDePasos({ motor, tramo: TRAMO_600 });

    assert.equal(motor.contador(), 3, 'bajar el tramo ha recalculado pasos ya ejecutados');
    assert.equal(JSON.stringify(antes.pasos), retrato);
    assert.equal(motor.semillaDelPaso(3), creaMotorDePasos({ semilla: SEMILLA_A, mapaId: CASA }).semillaDelPaso(3));
    assert.equal(siguiente.tramoM, TRAMO_600);
  });

  test('El resto pendiente sigue en metros y no se reescala al cambiar el tramo', () => {
    const estado = estadoDePasos();
    const motor = motorDe({ estado });
    abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda(5000);
    assert.equal(estadoDeMapa(estado, CASA).restoM, 1000);

    // Guardado en metros y no como fracción de tramo: con un tramo de 600 los mismos
    // 1 000 m siguen siendo 1 000 m, y ahora completan un paso y sobran 400.
    // Guardado como fracción de tramo, medio tramo de 2 km serían 300 m con un tramo
    // de 600 y no completarían nada. Guardado en metros, los mil siguen siendo mil.
    const conOtroTramo = abreSalidaDePasos({ motor, tramo: TRAMO_600 });
    assert.equal(conOtroTramo.restoM(), 1000, 'el resto se ha reescalado al cambiar el tramo');
    const resultado = conOtroTramo.anda(0);
    assert.equal(resultado.pasos.length, 1, 'mil metros ya son más de un tramo de 600 y tenían que completar un paso');
    assert.equal(resultado.restoM, 400);
    assert.equal(motor.contador(), 3);
  });

  test('Los pasos de una salida activa no se acumulan en ninguna reserva', () => {
    const motor = motorDe();
    abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda(16000);
    assert.equal(motor.contador(), 8);
    assert.equal(tamanoDeLaReserva(motor), 0, 'los pasos de una salida activa se han quedado guardados');
    assert.deepEqual(vaciaReserva(motor), []);
  });

  test('Doce tramos seguidos en una salida ejecutan doce pasos, sin ningún tope', () => {
    const motor = motorDe();
    const resultado = abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda(12 * TRAMO_2KM);

    assert.equal(resultado.pasos.length, 12, 'el tope de la reserva ha frenado los pasos de la salida activa');
    assert.ok(resultado.pasos.length > TOPE_DE_RESERVA);
    assert.equal(motor.contador(), 12);
    assert.deepEqual(resultado.pasos.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('Qué kilómetros cuentan', () => {
  test('Los metros clasificados como andando entran en el contador', () => {
    assert.equal(metrosQueCuentan([andando(1200), parada(), andando(800)]), 2000);
    // Y con la traza en su forma de objeto, que es como llega de la salida.
    assert.equal(metrosQueCuentan({ segmentos: [andando(2000)] }), 2000);

    const motor = motorDe();
    const resultado = abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda([andando(1200), parada(), andando(800)]);
    assert.equal(resultado.pasos.length, 1);
  });

  test('Un viaje en tren no hace avanzar el mundo', () => {
    // Treinta kilómetros a 90 km/h, con el recorrido del GPS simulado y no con un
    // número escrito a mano: la clasificación llega hecha, que es lo que el motor
    // consume, pero los metros son los de un recorrido de verdad.
    const tren = trazaDesdeRecorrido(simulaRecorrido({
      polilinea: RECTA_LARGA,
      cadenciaMs: 10000,
      origenTiempoMs: 0,
      tramos: [{ hastaVertice: 1, velocidadKmH: 90 }],
    }));

    const metros = tren.reduce((t, s) => t + s.metros, 0);
    assert.ok(metros > 29000, `el recorrido de prueba tiene que ser largo de verdad y midió ${Math.round(metros)} m`);
    assert.deepEqual([...new Set(tren.map((s) => s.clasificacion))], ['vehiculo']);

    assert.equal(metrosQueCuentan(tren), 0, 'los metros de vehículo han entrado en el contador');

    const motor = motorDe();
    const resultado = abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda(tren);
    assert.deepEqual(resultado.pasos, []);
    assert.equal(motor.contador(), 0, 'un viaje en tren ha movido el reloj del mundo');
    assert.equal(resultado.restoM, 0, 'un viaje en tren ha dejado resto pendiente');
  });

  test('Volver a casa en autobús echa el telón igual', () => {
    // La ida andando y la vuelta en autobús, el mismo recorrido en los dos sentidos.
    const recorrido = trazaDesdeRecorrido(simulaRecorrido({
      polilinea: IDA_Y_VUELTA,
      cadenciaMs: 5000,
      origenTiempoMs: 0,
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { hastaVertice: 2, velocidadKmH: 40 },
      ],
    }));
    const soloLaIda = recorrido.filter((s) => s.clasificacion === 'andando');

    assert.ok(soloLaIda.length > 0 && soloLaIda.length < recorrido.length, 'la traza de prueba tiene que traer las dos mitades');
    assert.equal(metrosQueCuentan(recorrido), metrosQueCuentan(soloLaIda), 'los kilómetros del autobús han contado');

    const conBus = motorDe();
    const sinBus = motorDe();
    abreSalidaDePasos({ motor: conBus, tramo: TRAMO_2KM }).anda(recorrido);
    abreSalidaDePasos({ motor: sinBus, tramo: TRAMO_2KM }).anda(soloLaIda);

    assert.equal(conBus.contador(), sinBus.contador(), 'volver en autobús ha hecho avanzar el mundo');
    assert.ok(conBus.contador() >= 2, 'la ida andando sí tiene que haber movido el mundo');
  });

  test('En la duda, cuenta', () => {
    assert.equal(metrosQueCuentan([ambiguo(800)]), 800, 'los 800 m ambiguos no han contado para el motor');

    const motor = motorDe();
    const resultado = abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda([andando(1200), ambiguo(800)]);
    assert.equal(resultado.pasos.length, 1, 'con la duda contando, 1 200 + 800 son un paso');
    assert.equal(motor.contador(), 1);
  });

  test('La asimetría de la duda sale del módulo de SPEC-004 y no está escrita dos veces', () => {
    // La respuesta contraria, la de medir el tramo, y las dos del mismo sitio.
    assert.equal(REGLA_DE_LA_DUDA.motorDePasos, true);
    assert.equal(REGLA_DE_LA_DUDA.medirElTramo, false);
    assert.equal(entraEnLaMedidaDelTramo('ambiguo'), false);

    const medida = mideRitmoDeSalida([
      { metros: 1000, duracionS: 900, clasificacion: 'andando' },
      { metros: 800, duracionS: 400, clasificacion: 'ambiguo' },
    ]);
    assert.equal(medida.metrosAndando, 1000, 'los 800 m ambiguos han entrado en la media del tramo');
    assert.equal(metrosQueCuentan([andando(1000), ambiguo(800)]), 1800);

    // Y no hay una segunda copia de la regla en el módulo de los kilómetros.
    const codigo = codigoDe('packages/nucleo/partida/kilometros.js');
    assert.ok(/from\s+'\.\/ritmo\.js'/.test(codigo), 'kilometros.js ya no lee la regla de la duda de ritmo.js');
    assert.ok(!/['"]ambiguo['"]/.test(codigo), 'kilometros.js decide por su cuenta qué hacer con la duda');
  });

  test('El motor no clasifica velocidades por su cuenta: recibe los segmentos ya clasificados', () => {
    const codigo = codigoDe('packages/nucleo/partida/kilometros.js');
    for (const patron of [/km\s*\/\s*h/i, /velocidad/i, /kmh/i, /\bgps\b/i, /3\.6/, /umbral/i]) {
      assert.ok(!patron.test(codigo), `kilometros.js contiene ${patron}: la clasificación es de la fila 31`);
    }
    // Lo único que hace con la clasificación es preguntársela al módulo de SPEC-004.
    assert.ok(/cuentaParaElMotorDePasos\s*\(/.test(codigo));
    // Y lo demuestra la conducta: los mismos metros, clasificados de otra manera,
    // dan otro resultado sin que el módulo mire ninguna velocidad.
    assert.equal(metrosQueCuentan([andando(5000)]), 5000);
    assert.equal(metrosQueCuentan([enVehiculo(5000)]), 0);
  });

  test('Un segmento sin clasificar hace fallar el conteo nombrando el segmento', () => {
    for (const roto of [{ metros: 500 }, { metros: 500, clasificacion: null }, { metros: 500, clasificacion: 'volando' }]) {
      assert.throws(
        () => metrosQueCuentan([andando(100), roto]),
        (e) => e instanceof Error && /segmento 1/.test(e.message),
        `un segmento sin clasificar (${JSON.stringify(roto)}) debería fallar nombrando cuál es`,
      );
    }
    assert.throws(() => metrosQueCuentan('nada'), /traza mal formada/);
    assert.throws(() => metrosQueCuentan([null]), /segmento 0/);
  });

  test('Una traza cuyos segmentos son todos de vehículo da cero metros y no un error', () => {
    assert.equal(metrosQueCuentan([enVehiculo(9000), enVehiculo(21000)]), 0);
    assert.equal(metrosQueCuentan([]), 0);
    const motor = motorDe();
    assert.deepEqual(abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda([enVehiculo(30000)]).pasos, []);
  });
});

describe('La reserva de los pasos de fondo', () => {
  test('Con los pasos de fondo apagados no se ejecuta ningún paso y la reserva sigue vacía', () => {
    // Vienen apagados de origen, y el interruptor es de la fila 42.
    const motor = motorDe();
    const resultado = kilometrosDeFondo({ motor, metros: 20000, activos: false, tramo: TRAMO_2KM });

    assert.deepEqual(resultado.pasos, []);
    assert.equal(resultado.enLaReserva, 0);
    assert.equal(motor.contador(), 0);
    assert.deepEqual(vaciaReserva(motor), []);
  });

  test('Kilómetros de fondo equivalentes a tres pasos ejecutan tres y dejan tres en la reserva', () => {
    const motor = motorDe();
    const resultado = kilometrosDeFondo({ motor, metros: 3 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });

    assert.equal(resultado.pasos.length, 3);
    assert.equal(resultado.enLaReserva, 3);
    assert.equal(tamanoDeLaReserva(motor), 3);
    assert.equal(motor.contador(), 3, 'los pasos de la reserva son pasos ya ejecutados, con su número correlativo');
  });

  test('La reserva de pasos de fondo tiene tope de cinco', () => {
    const motor = motorDe();
    const resultado = kilometrosDeFondo({ motor, metros: 12 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });

    assert.equal(tamanoDeLaReserva(motor), 5, 'la reserva tiene que contener cinco pasos');
    assert.equal(motor.contador(), 5, 'el contador del mundo ha avanzado cinco, no doce');
    assert.equal(resultado.pasos.length, 5);
    assert.equal(resultado.descartadosM, 14000, 'los kilómetros que no caben se descartan enteros');
  });

  test('Con la reserva llena los kilómetros de fondo no ejecutan más pasos y no dejan deuda', () => {
    const estado = estadoDePasos();
    const motor = motorDe({ estado });
    kilometrosDeFondo({ motor, metros: 12 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });

    const mas = kilometrosDeFondo({ motor, metros: 8 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });
    assert.deepEqual(mas.pasos, []);
    assert.equal(motor.contador(), 5, 'el contador ha saltado con la reserva llena');
    assert.equal(estadoDeMapa(estado, CASA).restoFondoM, 0, 'los kilómetros descartados han dejado deuda apuntada');
    assert.equal(mas.descartadosM, 8 * TRAMO_2KM);
  });

  test('Vaciar la reserva no recupera nada de lo descartado', () => {
    // Volver tras tres meses tiene que equivaler a volver tras tres días: los siete
    // pasos que no cupieron no pueden reaparecer luego por la puerta de atrás.
    const motor = motorDe();
    kilometrosDeFondo({ motor, metros: 12 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });
    assert.equal(vaciaReserva(motor).length, 5);

    const nuevos = kilometrosDeFondo({ motor, metros: 2 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });
    assert.equal(nuevos.pasos.length, 2, 'los pasos ejecutados tienen que salir solo de los kilómetros nuevos');
    assert.deepEqual(nuevos.pasos.map((p) => p.n), [6, 7]);
    assert.equal(motor.contador(), 7);
    assert.equal(tamanoDeLaReserva(motor), 2);
  });

  test('Con cuatro en la reserva y kilómetros para tres se ejecuta uno y se descartan dos', () => {
    const motor = motorDe();
    kilometrosDeFondo({ motor, metros: 4 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });
    assert.equal(tamanoDeLaReserva(motor), 4);

    const resultado = kilometrosDeFondo({ motor, metros: 3 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });
    assert.equal(resultado.pasos.length, 1);
    assert.equal(tamanoDeLaReserva(motor), TOPE_DE_RESERVA);
    assert.equal(resultado.descartadosM, 2 * TRAMO_2KM, 'los dos pasos que no caben se descartan en metros');
    assert.equal(motor.contador(), 5);
  });

  test('La reserva se lee en el orden en que se ejecutaron los pasos y queda vacía', () => {
    const motor = motorDe();
    kilometrosDeFondo({ motor, metros: 4 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });

    const leidos = vaciaReserva(motor);
    assert.deepEqual(leidos.map((p) => p.n), [1, 2, 3, 4], 'la reserva se entrega desordenada');
    assert.equal(tamanoDeLaReserva(motor), 0);
    assert.deepEqual(vaciaReserva(motor), [], 'vaciar dos veces tiene que dar una lista vacía');
    assert.equal(motor.contador(), 4, 'vaciar la reserva no puede deshacer los pasos: ya ocurrieron');
  });

  test('Una reserva vacía se lee como lista vacía y no como error', () => {
    const motor = motorDe();
    assert.deepEqual(vaciaReserva(motor), []);
    assert.equal(tamanoDeLaReserva(motor), 0);
  });

  test('El tope de la reserva sale de una sola constante con valor cinco', () => {
    assert.equal(TOPE_DE_RESERVA, 5);
    const texto = fuente('packages/nucleo/partida/kilometros.js');
    const cuerpo = texto.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    const declaraciones = cuerpo.match(/TOPE_DE_RESERVA\s*=\s*\d+/g) ?? [];
    assert.equal(declaraciones.length, 1, `el tope se declara ${declaraciones.length} veces`);
    assert.ok(/reserva\.length\s*[<>]=?\s*TOPE_DE_RESERVA/.test(cuerpo), 'el tope se comprueba con un número escrito a mano');
  });

  test('Los pasos de la reserva y los de una salida activa son de la misma naturaleza y del mismo contador', () => {
    const motor = motorDe();
    kilometrosDeFondo({ motor, metros: 2 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });
    const deLaReserva = vaciaReserva(motor);
    const deLaSalida = abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda(2 * TRAMO_2KM).pasos;

    assert.deepEqual(deLaReserva.map((p) => p.n), [1, 2]);
    assert.deepEqual(deLaSalida.map((p) => p.n), [3, 4], 'los pasos de las dos fuentes no comparten contador');
    for (const paso of [...deLaReserva, ...deLaSalida]) {
      assert.deepEqual(Object.keys(paso).sort(), ['efectos', 'n'], 'un paso de fondo tiene otra forma que uno de salida');
    }
    // Y el mismo número da el mismo contenido, venga de donde venga.
    const soloSalida = motorDe();
    const todos = abreSalidaDePasos({ motor: soloSalida, tramo: TRAMO_2KM }).anda(4 * TRAMO_2KM).pasos;
    assert.equal(JSON.stringify(todos), JSON.stringify([...deLaReserva, ...deLaSalida]));
  });

  test('Con la reserva llena los pasos de la salida activa se ejecutan igual', () => {
    const motor = motorDe();
    kilometrosDeFondo({ motor, metros: 12 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });
    assert.equal(tamanoDeLaReserva(motor), TOPE_DE_RESERVA);

    const resultado = abreSalidaDePasos({ motor, tramo: TRAMO_2KM }).anda(6 * TRAMO_2KM);
    assert.equal(resultado.pasos.length, 6, 'el tope de la reserva ha frenado los pasos de la salida activa');
    assert.equal(motor.contador(), 11);
    assert.equal(tamanoDeLaReserva(motor), TOPE_DE_RESERVA, 'los pasos de la salida activa se han metido en la reserva');
  });

  test('La reserva vuelve del documento con los mismos pasos y en el mismo orden', () => {
    const estado = estadoDePasos();
    const motor = motorDe({ estado });
    kilometrosDeFondo({ motor, metros: 3 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });

    const guardado = JSON.stringify(congelaPasos(estado));
    const vuelta = levantaPasos(JSON.parse(guardado));
    const registro = estadoDeMapa(vuelta, CASA);

    assert.equal(registro.n, 3);
    assert.deepEqual(registro.reserva.map((p) => p.n), [1, 2, 3]);
    assert.equal(JSON.stringify(registro.reserva), JSON.stringify(estadoDeMapa(estado, CASA).reserva));
    assert.equal(JSON.stringify(congelaPasos(vuelta)), guardado);
  });

  test('Si los pasos de fondo están activos lo dice la partida, no ninguna capa de la plataforma', () => {
    const motor = motorDe();
    for (const malo of [undefined, null, 1, 'si']) {
      assert.throws(
        () => kilometrosDeFondo({ motor, metros: 4000, activos: malo, tramo: TRAMO_2KM }),
        (e) => e instanceof Error && /activos/.test(e.message),
        `un "activos" de ${JSON.stringify(malo)} debería fallar en lugar de suponerlo`,
      );
    }
    // Y el núcleo no sabe qué es un permiso de salud ni consulta ningún ajuste.
    const codigo = codigoDe('packages/nucleo/partida/kilometros.js');
    for (const patron of [/permiso/i, /HealthKit/i, /salud/i, /ajuste/i, /Platform/, /require\s*\(/]) {
      assert.ok(!patron.test(codigo), `kilometros.js habla de ${patron}, que es de la plataforma`);
    }
    // El dato entra por la firma y por ningún otro sitio.
    assert.ok(/activos/.test(codigo));
  });
});

describe('Un contador por mapa, en la conversión', () => {
  test('Los metros andados con un mapa activo avanzan el contador de ese mapa y ningún otro', () => {
    const estado = estadoDePasos();
    const casa = motorDe({ estado, mapaId: CASA });
    const lejos = motorDe({ estado, mapaId: LEJOS });

    abreSalidaDePasos({ motor: lejos, tramo: TRAMO_2KM }).anda(8000);

    assert.equal(lejos.contador(), 4);
    assert.equal(casa.contador(), 0, 'andar en otro mapa ha movido el contador de casa');
    assert.equal(estadoDeMapa(estado, CASA).restoM, 0, 'el resto de un mapa se ha ido al otro');
  });

  test('Los kilómetros de fondo avanzan el contador del mapa activo y la reserva es la de ese mapa', () => {
    const estado = estadoDePasos();
    const casa = motorDe({ estado, mapaId: CASA });
    const lejos = motorDe({ estado, mapaId: LEJOS });

    kilometrosDeFondo({ motor: lejos, metros: 3 * TRAMO_2KM, activos: true, tramo: TRAMO_2KM });

    assert.equal(tamanoDeLaReserva(lejos), 3);
    assert.equal(tamanoDeLaReserva(casa), 0, 'la reserva del mapa activo se ha llenado en el otro mapa');
    assert.equal(casa.contador(), 0);
    assert.equal(estadoDeMapa(estado, CASA).restoFondoM, 0);
  });

  test('Un tramo declarado con el catálogo del arranque sirve igual que un número de metros', () => {
    // La conversión acepta el estado del tramo del personaje, que es como llega de
    // verdad: exigeTramoM es la única puerta y lee el estimado, no el declarado a mano.
    const motor = motorDe();
    const tramo = declaraTramo('pueblo-de-al-lado');
    const salida = abreSalidaDePasos({ motor, tramo });

    assert.equal(salida.tramoM, 2000);
    assert.equal(salida.anda(6000).pasos.length, 3);
  });
});
