// SPEC-004 · La medición del ritmo de una salida y la asimetría de la duda.
//
// El núcleo no mira sensores ni tiene reloj: recibe la traza **ya clasificada**
// segmento a segmento y devuelve un número. Todo lo de aquí entra inyectado —los
// recorridos salen del GPS simulado de `test/dobles/`, con su origen de tiempo
// declarado— y ninguna prueba espera a que pase el tiempo.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Dos de
// ellos —«En la duda, cuenta» y «La medición del tramo sí excluye la velocidad
// ambigua»— están etiquetados `@app` en la batería porque allí se recorren
// andando; lo que se afirma aquí es la mitad que vive en el núcleo y que la propia
// spec acota: dada una traza clasificada, qué entra en la media y qué cuenta.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALFA,
  CLASIFICACIONES,
  MINIMO_UTIL_M,
  REGLA_DE_LA_DUDA,
  UMBRAL_PARADA_MS,
  cuentaParaElMotorDePasos,
  entraEnLaMedidaDelTramo,
  incorporaMedida,
  mideRitmoDeSalida,
  validaLlegadaPorGeofence,
} from '../../packages/nucleo/partida/ritmo.js';
import { SEGUNDOS_POR_TRAMO, declaraTramo } from '../../packages/nucleo/partida/tramo.js';
import { simulaRecorrido } from '../dobles/gps-simulado.mjs';
import { fuente, modulosDelPaquete } from './mundo-de-prueba.mjs';

// Una calle de kilómetro y medio, con un quiebro en medio para que el recorrido
// tenga dos tramos y la parada pueda caer justo entre ellos.
const CALLE = [
  { lat: 42.4010, lon: -8.8110 },
  { lat: 42.4055, lon: -8.8110 },
  { lat: 42.4090, lon: -8.8060 },
];

const R_TIERRA = 6371000;

// La misma proyección local que usa el doble del GPS: a escala de barrio el error
// es despreciable, y reusar la fórmula evita que la prueba mida la diferencia
// entre dos trigonometrías en vez del ritmo.
function metrosEntre(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat = ((a.lat + b.lat) / 2) * rad;
  const x = dLon * Math.cos(lat);
  return Math.sqrt(dLat * dLat + x * x) * R_TIERRA;
}

/**
 * Convierte una secuencia del GPS simulado en la traza clasificada que el núcleo
 * recibe: tramos consecutivos del mismo modo, con sus metros y su duración.
 *
 * Vive aquí y no en el doble a propósito: el doble emite posiciones, que es lo que
 * emite un GPS, y quien clasifica es la fila 31. Mientras no exista, esto es el
 * clasificador de juguete que la spec dice que hace falta.
 */
function trazaDesdeRecorrido(posiciones) {
  const segmentos = [];
  for (let k = 1; k < posiciones.length; k++) {
    const anterior = posiciones[k - 1];
    const actual = posiciones[k];
    const metros = metrosEntre(anterior, actual);
    const duracionS = (actual.tMs - anterior.tMs) / 1000;
    const ultimo = segmentos[segmentos.length - 1];
    if (ultimo && ultimo.clasificacion === actual.modo) {
      ultimo.metros += metros;
      ultimo.duracionS += duracionS;
    } else {
      segmentos.push({ metros, duracionS, clasificacion: actual.modo });
    }
  }
  return segmentos;
}

const andando = (metros, duracionS) => ({ metros, duracionS, clasificacion: 'andando' });

describe('La medición del ritmo', () => {
  test('Solo los segmentos clasificados como andando entran en la media', () => {
    // Mismos metros andando en las dos trazas; la segunda añade de todo alrededor.
    const limpia = [andando(1000, 900)];
    const sucia = [
      andando(1000, 900),
      { metros: 0, duracionS: 600, clasificacion: 'parada' },
      { metros: 6000, duracionS: 600, clasificacion: 'vehiculo' },
      { metros: 800, duracionS: 400, clasificacion: 'ambiguo' },
    ];

    const a = mideRitmoDeSalida(limpia);
    const b = mideRitmoDeSalida(sucia);
    assert.equal(a.hayMedida, true);
    assert.equal(b.hayMedida, true);
    assert.equal(b.metrosAndando, 1000, 'han entrado en la media metros que no eran de andar');
    assert.equal(b.segundosAndando, 900);
    assert.equal(b.metrosPorMediaHora, a.metrosPorMediaHora, 'lo que no es andar ha movido la media');
    assert.equal(a.metrosPorMediaHora, (1000 / 900) * SEGUNDOS_POR_TRAMO);
  });

  test('Las paradas no cuentan para medir el ritmo', () => {
    // El escenario de la batería, literal: se anda a 4 km/h, se para veinte
    // minutos a tomar un café y se sigue a 4 km/h. Los dos recorridos recorren la
    // misma calle con las mismas velocidades; el único cambio es la parada.
    const conCafe = simulaRecorrido({
      polilinea: CALLE,
      origenTiempoMs: 0,
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { parada: true, duracionS: 20 * 60 },
        { hastaVertice: 2, velocidadKmH: 4 },
      ],
    });
    const sinCafe = simulaRecorrido({
      polilinea: CALLE,
      origenTiempoMs: 0,
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { hastaVertice: 2, velocidadKmH: 4 },
      ],
    });

    const con = mideRitmoDeSalida(trazaDesdeRecorrido(conCafe));
    const sin = mideRitmoDeSalida(trazaDesdeRecorrido(sinCafe));

    assert.equal(con.hayMedida, true, 'la salida con parada no ha dado medida');
    assert.equal(sin.hayMedida, true);
    // Los veinte minutos parados están en la traza y no en la media: si contaran,
    // el ritmo bajaría a la mitad larga.
    const parado = trazaDesdeRecorrido(conCafe).filter((s) => s.clasificacion === 'parado');
    assert.equal(parado.length, 1, 'la parada no ha llegado a la traza');
    assert.ok(parado[0].duracionS >= 20 * 60 - 1, `la parada dura ${parado[0].duracionS} s`);

    const desvio = Math.abs(con.metrosPorMediaHora - sin.metrosPorMediaHora) / sin.metrosPorMediaHora;
    assert.ok(desvio < 1e-6, `la parada ha movido el ritmo medido: ${con.metrosPorMediaHora} frente a ${sin.metrosPorMediaHora}`);
    // Y el número es el que se andaba: 4 km/h son 2 km por media hora.
    assert.ok(Math.abs(con.metrosPorMediaHora - 2000) / 2000 < 0.01, `4 km/h medidos como ${con.metrosPorMediaHora} m por media hora`);
  });

  test('Un segmento por debajo del umbral de andar se trata como parada aunque llegue clasificado como andando', () => {
    // Veinte minutos de café que el clasificador de fuera marcó como andando: el
    // detector de la fila 31 distingue vehículo, no descanso.
    const traza = [
      andando(1000, 900),
      andando(3, 1200), // 0,0025 m/s
    ];
    const medida = mideRitmoDeSalida(traza);
    assert.ok(UMBRAL_PARADA_MS > 0 && UMBRAL_PARADA_MS < 1, `el umbral de parada declarado es ${UMBRAL_PARADA_MS} m/s`);
    assert.equal(medida.metrosAndando, 1000, 'el descanso ha entrado en la media');
    assert.equal(medida.segundosAndando, 900);

    // Justo por encima del umbral sí entra: el corte está donde se declara.
    const justo = mideRitmoDeSalida([andando(1000, 900), andando(UMBRAL_PARADA_MS * 100 + 1, 100)]);
    assert.ok(justo.segundosAndando > 900, 'un segmento por encima del umbral se ha descartado como parada');
  });

  test('La medición del tramo sí excluye la velocidad ambigua', () => {
    // 800 m a velocidad ambigua, los del escenario. No entran en la media.
    const conAmbiguo = [andando(1000, 900), { metros: 800, duracionS: 400, clasificacion: 'ambiguo' }];
    const sinAmbiguo = [andando(1000, 900)];
    assert.equal(mideRitmoDeSalida(conAmbiguo).metrosPorMediaHora, mideRitmoDeSalida(sinAmbiguo).metrosPorMediaHora);
    assert.equal(mideRitmoDeSalida(conAmbiguo).metrosAndando, 1000, 'los 800 m ambiguos han entrado en la media');
    assert.equal(entraEnLaMedidaDelTramo('ambiguo'), false);
    assert.equal(REGLA_DE_LA_DUDA.medirElTramo, false);

    // Y el vehículo tampoco, que es el otro lado de la misma decisión.
    const conAutobus = [andando(1000, 900), { metros: 6000, duracionS: 600, clasificacion: 'vehiculo' }];
    assert.equal(mideRitmoDeSalida(conAutobus).metrosAndando, 1000, 'los metros en vehículo han entrado en la media');
    assert.equal(entraEnLaMedidaDelTramo('vehiculo'), false);
  });

  test('En la duda, cuenta', () => {
    // La asimetría entera, en la única prueba que la mira de frente: los mismos
    // 800 m ambiguos cuentan para el motor de pasos y validan una llegada, y no
    // cuentan para medir el tramo. Las tres respuestas salen del mismo módulo.
    assert.equal(cuentaParaElMotorDePasos('ambiguo'), true, 'la duda no cuenta para el motor de pasos');
    assert.equal(validaLlegadaPorGeofence('ambiguo'), true, 'la duda invalida una llegada');
    assert.equal(entraEnLaMedidaDelTramo('ambiguo'), false, 'la duda entra en la media del tramo');
    assert.deepEqual({ ...REGLA_DE_LA_DUDA }, { medirElTramo: false, motorDePasos: true, validarLlegada: true });

    // El vehículo se aparta de los tres; andar cuenta en los tres.
    assert.equal(cuentaParaElMotorDePasos('vehiculo'), false);
    assert.equal(validaLlegadaPorGeofence('vehiculo'), false);
    assert.equal(cuentaParaElMotorDePasos('andando'), true);
    assert.equal(validaLlegadaPorGeofence('andando'), true);
    // Parado en el sitio sí se ha llegado: quedarse quieto no invalida un beat.
    assert.equal(validaLlegadaPorGeofence('parada'), true);

    // Y la regla vive en un solo sitio: ningún otro módulo del paquete decide por
    // su cuenta qué hacer con lo ambiguo. Dispersarla es como se rompe.
    // Se busca la clasificación como valor —entre comillas—, no la palabra: los
    // paquetes de nombres «desambiguan» topónimos y eso no decide nada de esto.
    const otros = modulosDelPaquete().filter((m) => m !== 'packages/nucleo/partida/ritmo.js' && /['"]ambigu[oa]['"]/i.test(fuente(m)));
    assert.deepEqual(otros, [], `otro módulo decide sobre la velocidad ambigua: ${otros.join(', ')}`);
  });

  test('Una salida entera en autobús no aporta ninguna medida y no se registra como salida medida', () => {
    const traza = [{ metros: 12000, duracionS: 1200, clasificacion: 'vehiculo' }];
    const medida = mideRitmoDeSalida(traza);
    assert.equal(medida.hayMedida, false);
    assert.equal(medida.metrosPorMediaHora, null, 'una salida en autobús ha producido un número');
    assert.equal(medida.motivo, 'ningun-segmento-andando');

    const tramo = declaraTramo('pueblo-de-al-lado');
    const despues = incorporaMedida(tramo, medida);
    assert.equal(despues.salidasMedidas, 0, 'la salida en autobús se ha registrado como salida medida');
    assert.equal(despues.estimadoM, tramo.estimadoM, 'la salida en autobús ha movido el tramo');
  });

  test('Una traza sin ningún segmento devuelve que no hay medida, no un cero', () => {
    for (const vacia of [[], { segmentos: [] }]) {
      const medida = mideRitmoDeSalida(vacia);
      assert.equal(medida.hayMedida, false);
      assert.equal(medida.metrosPorMediaHora, null, 'una salida sin andar ha medido cero, que es una medida');
      assert.equal(medida.motivo, 'traza-sin-segmentos');
      // Y un cero arrastraría el tramo hacia abajo por no haber salido a andar.
      const tramo = declaraTramo('otro-barrio');
      assert.equal(incorporaMedida(tramo, medida).estimadoM, tramo.declaradoM);
    }
  });

  test('Una traza con un segmento sin clasificar falla nombrando el segmento', () => {
    for (const sinClasificar of [undefined, null, '', 'corriendo']) {
      assert.throws(
        () => mideRitmoDeSalida([andando(500, 400), { metros: 300, duracionS: 200, clasificacion: sinClasificar }]),
        (e) => {
          assert.match(e.message, /segmento 1/, `el error no nombra el segmento: ${e.message}`);
          assert.match(e.message, new RegExp(CLASIFICACIONES.join('|')), `el error no dice qué se esperaba: ${e.message}`);
          return true;
        },
        `se ha aceptado un segmento clasificado como ${JSON.stringify(sinClasificar)}`,
      );
    }
  });

  test('Una traza con marcas de tiempo desordenadas o con duración negativa falla con un error explícito', () => {
    assert.throws(
      () => mideRitmoDeSalida([
        { metros: 500, desdeMs: 10000, hastaMs: 20000, clasificacion: 'andando' },
        { metros: 500, desdeMs: 15000, hastaMs: 25000, clasificacion: 'andando' },
      ]),
      /desordenadas/,
      'una traza que va hacia atrás se ha promediado igual',
    );
    assert.throws(
      () => mideRitmoDeSalida([{ metros: 500, desdeMs: 20000, hastaMs: 10000, clasificacion: 'andando' }]),
      /segmento 0/,
      'un segmento de duración negativa se ha promediado igual',
    );
    for (const mala of [-100, 0, NaN, undefined, '600']) {
      assert.throws(() => mideRitmoDeSalida([{ metros: 500, duracionS: mala, clasificacion: 'andando' }]), /segmento 0/);
    }
    for (const malos of [-1, NaN, undefined, '500']) {
      assert.throws(() => mideRitmoDeSalida([{ metros: malos, duracionS: 400, clasificacion: 'andando' }]), /segmento 0/);
    }
    for (const traza of [undefined, null, 42, 'una traza', {}]) {
      assert.throws(() => mideRitmoDeSalida(traza), /traza mal formada/);
    }
  });

  test('Una salida por debajo del mínimo útil no aporta medida', () => {
    const corta = mideRitmoDeSalida([andando(MINIMO_UTIL_M - 1, 300)]);
    assert.equal(corta.hayMedida, false, 'una salida de cien metros ha medido ritmo');
    assert.equal(corta.metrosPorMediaHora, null);
    assert.equal(corta.motivo, 'por-debajo-del-minimo-util');
    assert.equal(corta.metrosAndando, MINIMO_UTIL_M - 1, 'la medida no dice cuántos metros se anduvieron');

    const justa = mideRitmoDeSalida([andando(MINIMO_UTIL_M, 300)]);
    assert.equal(justa.hayMedida, true, 'el mínimo útil exacto no aporta medida');
  });

  test('La misma traza medida dos veces da la misma medida y no lee el reloj del sistema', () => {
    const traza = [
      andando(700, 600),
      { metros: 0, duracionS: 300, clasificacion: 'parada' },
      andando(900, 800),
      { metros: 800, duracionS: 400, clasificacion: 'ambiguo' },
    ];
    const primera = mideRitmoDeSalida(traza);
    for (let k = 0; k < 5; k++) {
      assert.equal(JSON.stringify(mideRitmoDeSalida(traza)), JSON.stringify(primera), 'dos medidas de la misma traza difieren');
    }
    // La afirmación fuerte es la de arriba; esta es la que dice por qué se
    // cumple: el módulo no tiene reloj al que preguntar.
    const texto = fuente('packages/nucleo/partida/ritmo.js');
    for (const reloj of [/\bDate\b/, /performance\s*\.\s*now/, /setTimeout|setInterval/]) {
      assert.equal(reloj.test(texto), false, `la medición usa el reloj del sistema (${reloj})`);
    }
  });
});

describe('La corrección con la medida', () => {
  test('Incorporar una medida mueve el tramo estimado hacia ella sin pasarse', () => {
    const tramo = declaraTramo('pueblo-de-al-lado');
    assert.equal(tramo.declaradoM, 2000);
    const medida = mideRitmoDeSalida([andando(1200, SEGUNDOS_POR_TRAMO)]);
    assert.equal(medida.metrosPorMediaHora, 1200);

    const despues = incorporaMedida(tramo, medida);
    assert.ok(despues.estimadoM < tramo.declaradoM, 'el tramo estimado no ha bajado');
    assert.ok(despues.estimadoM > medida.metrosPorMediaHora, 'el tramo estimado ha saltado al valor medido o lo ha pasado');
    assert.equal(despues.estimadoM, 2000 + ALFA * (1200 - 2000));
    assert.equal(despues.salidasMedidas, 1);
    assert.equal(despues.declaradoM, 2000, 'incorporar una medida ha cambiado lo declarado');
  });
});
