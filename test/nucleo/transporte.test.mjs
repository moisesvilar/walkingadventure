// SPEC-031 · El detector de vehículo: de una secuencia de posiciones a una traza
// segmentada y clasificada, y la asimetría por efecto medida sobre lo que el detector
// deduce en lugar de sobre lo que la prueba escribía.
//
// **La diferencia con lo que ya había es toda la fila.** Hasta aquí la traza clasificada
// la fabricaba `trazaDesdeRecorrido`, un clasificador de juguete que copiaba el `modo`
// que el GPS simulado declaraba en cada posición: los escenarios del vehículo se probaban
// a sí mismos. Aquí el `modo` del doble **se tira** —`sinModo()` es lo primero que hace
// cualquier secuencia de este fichero— y quien dice qué es cada tramo es el detector.
//
// Tres decisiones de este fichero que no son de estilo:
//
// - **La precisión se declara siempre, y a propósito.** El GPS simulado no entrega
//   `precisionM`, y sin ese dato el detector no puede fundar un vehículo: una secuencia
//   de referencia a 90 km/h saldría ambigua entera y la prueba mediría el hueco del
//   doble, no el detector. Va anotado como hueco de la batería en `test/spec-test-map.json`.
// - **No hay reloj y no hay espera.** Los dos minutos de autobús son dos marcas de
//   tiempo, no dos minutos de reloj. Hay un caso que comprueba que el módulo tampoco
//   tiene reloj al que preguntar.
// - **Los bordes se afirman con las dos mitades.** 24,9 km/h y 25 km/h, 59 s y 60 s de
//   confirmación, 115 s y 180 s de salida, 170 s y 181 s de hueco: un borde afirmado por
//   un solo lado se cumple con cualquier comparación.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «En la duda,
// cuenta», «La medición del tramo sí excluye la velocidad ambigua», «Un viaje en tren no
// hace avanzar el mundo», «Pasar en coche por delante de un beat no lo valida», «Volver a
// casa en autobús echa el telón igual», «Las paradas no cuentan para medir el ritmo» y
// «Un tramo andado es un paso del mundo». Los cinco primeros están etiquetados `@app` en
// la batería porque allí se recorren de verdad; lo que esta fila cambia es que su mitad de
// núcleo ya no da por resuelta la clasificación, que era justo lo que se quería medir. Los
// demás casos van marcados como hueco de la batería en el mapa, y la spec los nombra uno
// a uno en «Huecos de cobertura detectados».

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIRMACION_VEHICULO_S,
  ERROR_MAXIMO_FIABLE_M,
  HUECO_MAXIMO_S,
  SALIDA_DE_VEHICULO_S,
  UMBRAL_ANDAR_KMH,
  UMBRAL_VEHICULO_KMH,
  clasificaPosiciones,
  creaDetectorDeTransporte,
  detectorSinMontar,
} from '../../packages/nucleo/partida/transporte.js';
import {
  CLASIFICACIONES,
  entraEnLaMedidaDelTramo,
  incorporaMedida,
  mideRitmoDeSalida,
  validaLlegadaPorGeofence,
} from '../../packages/nucleo/partida/ritmo.js';
import { abreSalidaDePasos, metrosQueCuentan } from '../../packages/nucleo/partida/kilometros.js';
import { creaMotorDePasos } from '../../packages/nucleo/partida/pasos.js';
import { declaraTramo } from '../../packages/nucleo/partida/tramo.js';
import { validaLlegada } from '../../packages/nucleo/partida/en-marcha.js';
import { IDS_DE_AJUSTE } from '../../packages/nucleo/partida/ajustes.js';
import {
  DENTRO_DEL_REGRESO_S,
  avanzaElRegreso,
  distanciaDeAlejamientoM,
} from '../../packages/nucleo/partida/regreso.js';
import { creaFuenteDePosiciones, creaTrazaDeSalida, fuenteSinMontar } from '../../app/plataforma/posiciones.js';
import { simulaRecorrido } from '../dobles/gps-simulado.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { fuente, modulosDelPaquete } from './mundo-de-prueba.mjs';

// ── El decorado ────────────────────────────────────────────────────────────────

const CASA = { lat: 42.4010, lon: -8.8110 };
const R_TIERRA = 6371000;
const RAD = Math.PI / 180;

/** Un punto a tantos metros al norte de casa. Rectas: lo que se mide es la velocidad. */
const alNorte = (metros) => ({ lat: CASA.lat + metros / R_TIERRA / RAD, lon: CASA.lon });
const alEste = (metros) => ({ lat: CASA.lat, lon: CASA.lon + metros / (R_TIERRA * Math.cos(CASA.lat * RAD)) / RAD });
const recta = (metros) => [CASA, alNorte(metros)];

/** La misma proyección que el doble y que el detector: se compara ritmo, no trigonometría. */
function metrosEntre(a, b) {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const lat = ((a.lat + b.lat) / 2) * RAD;
  const x = dLon * Math.cos(lat);
  return Math.sqrt(dLat * dLat + x * x) * R_TIERRA;
}

/** Un fijo bueno, mejor que el error máximo con el que todavía se puede afirmar un motor. */
const PRECISION_BUENA_M = 10;

/** Un fijo de ciudad densa, peor que ese máximo. Es el falso positivo más habitual. */
const PRECISION_MALA_M = 45;

/**
 * Le quita a la secuencia del GPS simulado el `modo` que declara, y le pone la precisión
 * que el doble no entrega.
 *
 * Es la pieza central del fichero: **si la prueba declara el modo no está midiendo nada**,
 * y sin precisión el detector no puede fundar un vehículo ni en una autopista.
 */
function sinModo(posiciones, precisionM = PRECISION_BUENA_M) {
  return posiciones.map(({ lat, lon, tMs }) => (precisionM === null
    ? { lat, lon, tMs }
    : { lat, lon, tMs, precisionM }));
}

/** Un recorrido del doble, ya sin modo y con su precisión: la entrada real del detector. */
function recorrido(opciones, precisionM = PRECISION_BUENA_M) {
  return sinModo(simulaRecorrido({ origenTiempoMs: 0, ...opciones }), precisionM);
}

const clasificacionesDe = (traza) => traza.segmentos.map((s) => s.clasificacion);

/**
 * Las clasificaciones de los segmentos que recorren más de un metro.
 *
 * El GPS simulado pisa cada vértice exacto con una muestra propia, así que un recorrido
 * acaba en una última muestra que cubre el resto hasta el vértice —menos de un paso de
 * cadencia— y que el detector llama parada con toda la razón. Descontarla aquí no ablanda
 * nada: los casos que afirman qué **no** aparece siguen mirando la traza entera.
 */
const conMetros = (traza) => [...new Set(traza.segmentos.filter((s) => s.metros > 1).map((s) => s.clasificacion))].sort();
const metrosTotales = (traza) => traza.segmentos.reduce((t, s) => t + s.metros, 0);
const metrosDe = (traza, clasificacion) => traza.segmentos
  .filter((s) => s.clasificacion === clasificacion)
  .reduce((t, s) => t + s.metros, 0);

/**
 * El código de un módulo sin sus comentarios.
 *
 * Varias afirmaciones de esta spec son negativas —«no nombra ningún efecto», «no lee el
 * reloj»— y los comentarios del detector dicen exactamente esas palabras para explicar
 * que no lo hace. Buscar sobre el texto entero convertiría una buena explicación en un
 * fallo.
 */
function codigoDe(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

const DETECTOR = 'packages/nucleo/partida/transporte.js';

/** Un motor de pasos con un productor que no hace nada: aquí se cuenta, no se narra. */
function motorDe() {
  const productor = { id: 'rumores', produce: (n) => [{ tipo: 'rumor', nucleo: `nucleo-${n}`, asunto: 'de-prueba' }] };
  return creaMotorDePasos({ semilla: SEMILLA_A, mapaId: '42.40,-8.81', productores: [productor] });
}

// ── De posiciones a traza clasificada ──────────────────────────────────────────

describe('De posiciones a traza clasificada', () => {
  test('Una secuencia de posiciones se convierte en segmentos con sus metros, su duración y su clasificación', () => {
    const traza = clasificaPosiciones(recorrido({ polilinea: recta(1200), velocidadKmH: 4 }));

    assert.ok(traza.segmentos.length > 0, 'una caminata de 1 200 m no ha producido ni un segmento');
    for (const [i, s] of traza.segmentos.entries()) {
      assert.ok(Number.isFinite(s.metros) && s.metros >= 0, `el segmento ${i} mide ${s.metros} m`);
      assert.ok(Number.isFinite(s.duracionS) && s.duracionS > 0, `el segmento ${i} dura ${s.duracionS} s`);
      assert.ok(Number.isFinite(s.desdeMs) && Number.isFinite(s.hastaMs), `el segmento ${i} no trae sus dos marcas`);
      assert.ok(s.hastaMs > s.desdeMs, `el segmento ${i} va hacia atrás`);
      assert.ok(CLASIFICACIONES.includes(s.clasificacion), `el segmento ${i} llega como "${s.clasificacion}"`);
    }
    // Y la traza es consumible tal cual por los dos módulos que la esperan.
    assert.equal(Math.round(metrosQueCuentan(traza)), 1200);
    assert.equal(mideRitmoDeSalida(traza).hayMedida, true);
  });

  test('Las clasificaciones de la traza son las que declara ritmo.js y el detector no añade ninguna', () => {
    const mezcla = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(400), alNorte(400 + 600), alNorte(400 + 600 + 3000)],
      cadenciaMs: 2000,
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { parada: true, duracionS: 120 },
        { hastaVertice: 2, velocidadKmH: 12 },
        { hastaVertice: 3, velocidadKmH: 60 },
      ],
    }));

    const vistas = [...new Set(clasificacionesDe(mezcla))].sort();
    assert.deepEqual(vistas, ['ambiguo', 'andando', 'parada', 'vehiculo'], `el detector ha producido ${vistas.join(', ')}`);
    for (const c of vistas) assert.ok(CLASIFICACIONES.includes(c), `"${c}" no está en el vocabulario de ritmo.js`);
    // El vocabulario es de SPEC-004 y no se reabre: el detector lo importa, no lo copia.
    assert.match(codigoDe(DETECTOR), /import \{[^}]*CLASIFICACIONES[^}]*\} from '\.\/ritmo\.js'/);
  });

  test('Los metros de la traza son los del recorrido salvo los del hueco, que no son de nadie', () => {
    const posiciones = recorrido({ polilinea: recta(1500), velocidadKmH: 5 });
    let recorridos = 0;
    for (let k = 1; k < posiciones.length; k++) recorridos += metrosEntre(posiciones[k - 1], posiciones[k]);

    const traza = clasificaPosiciones(posiciones);
    assert.equal(traza.cortes.length, 0, 'una secuencia continua no puede traer cortes');
    assert.ok(Math.abs(metrosTotales(traza) - recorridos) < 1e-6, `la traza suma ${metrosTotales(traza)} m y el recorrido ${recorridos} m`);
  });

  test('Dos segmentos consecutivos nunca comparten clasificación', () => {
    const traza = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(600), alNorte(600 + 1000), alNorte(600 + 1000 + 500)],
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { hastaVertice: 2, velocidadKmH: 12 },
        { hastaVertice: 3, velocidadKmH: 4 },
      ],
    }));

    assert.ok(traza.segmentos.length >= 3, 'la traza de prueba tiene que tener varios segmentos');
    for (let k = 1; k < traza.segmentos.length; k++) {
      const previo = traza.segmentos[k - 1];
      const actual = traza.segmentos[k];
      if (previo.fragmento !== actual.fragmento) continue;
      assert.notEqual(actual.clasificacion, previo.clasificacion, `los segmentos ${k - 1} y ${k} comparten clasificación: un cambio de segmento tiene que significar un cambio de clasificación`);
    }
  });

  test('La misma secuencia clasificada dos veces da exactamente la misma traza', () => {
    const posiciones = recorrido({
      polilinea: [CASA, alNorte(500), alNorte(500 + 2000)],
      tramos: [{ hastaVertice: 1, velocidadKmH: 4 }, { hastaVertice: 2, velocidadKmH: 45 }],
    });
    const primera = JSON.stringify(clasificaPosiciones(posiciones));
    for (let k = 0; k < 5; k++) {
      assert.equal(JSON.stringify(clasificaPosiciones(posiciones)), primera, 'dos clasificaciones de la misma secuencia difieren');
    }
  });

  test('Dar la secuencia entera o trocearla en lotes produce la misma traza', () => {
    const posiciones = recorrido({
      polilinea: [CASA, alNorte(500), alNorte(500 + 2000), alNorte(500 + 2000 + 400)],
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { hastaVertice: 2, velocidadKmH: 45 },
        { hastaVertice: 3, velocidadKmH: 4 },
      ],
    });
    const entera = clasificaPosiciones(posiciones);

    for (const tamano of [1, 3, 7, 50]) {
      const detector = creaDetectorDeTransporte();
      for (let i = 0; i < posiciones.length; i += tamano) detector.agrega(posiciones.slice(i, i + tamano));
      assert.equal(JSON.stringify(detector.traza()), JSON.stringify(entera), `troceada en lotes de ${tamano} la traza cambia`);
    }
    // Y pedir la traza no consume nada: se puede pedir a mitad y volver a pedirla.
    const detector = creaDetectorDeTransporte();
    detector.agrega(posiciones.slice(0, 40));
    detector.traza();
    detector.agrega(posiciones.slice(40));
    assert.equal(JSON.stringify(detector.traza()), JSON.stringify(entera), 'pedir la traza a mitad de camino la ha consumido');
  });

  test('El detector no lee el reloj del sistema, no usa ninguna fuente de azar y no importa nada de React Native', () => {
    const codigo = codigoDe(DETECTOR);
    for (const prohibido of [/\bDate\b/, /performance\s*\.\s*now/, /setTimeout|setInterval/, /Math\s*\.\s*random/, /makeRng/, /react-native/i, /from 'expo/i]) {
      assert.equal(prohibido.test(codigo), false, `el detector usa ${prohibido}: el tiempo entra dentro de cada posición y aquí no hay azar`);
    }
    // Y lo demuestra la conducta: la misma secuencia con otro origen de tiempo da la
    // misma traza desplazada, no una distinta.
    const base = recorrido({ polilinea: recta(900), velocidadKmH: 5 });
    const masTarde = base.map((p) => ({ ...p, tMs: p.tMs + 86400000 }));
    const a = clasificaPosiciones(base);
    const b = clasificaPosiciones(masTarde);
    assert.deepEqual(clasificacionesDe(b), clasificacionesDe(a));
    assert.deepEqual(b.segmentos.map((s) => s.duracionS), a.segmentos.map((s) => s.duracionS));
  });

  test('Una secuencia de una sola posición o vacía da una traza vacía, y no un error', () => {
    for (const secuencia of [[], [{ lat: CASA.lat, lon: CASA.lon, tMs: 0, precisionM: 10 }]]) {
      const traza = clasificaPosiciones(secuencia);
      assert.deepEqual(traza.segmentos, [], 'una secuencia sin recorrido ha producido segmentos');
      assert.deepEqual(traza.cortes, []);
      // Y aguas abajo eso es «no hay medida», nunca un cero.
      assert.equal(metrosQueCuentan(traza), 0);
      assert.equal(mideRitmoDeSalida(traza).hayMedida, false);
      assert.equal(mideRitmoDeSalida(traza).motivo, 'traza-sin-segmentos');
    }
  });

  test('Una posición sin marca de tiempo o con la marca hacia atrás falla nombrándola, en lugar de reordenarla', () => {
    const buena = { lat: CASA.lat, lon: CASA.lon, tMs: 0, precisionM: 10 };
    const siguiente = { ...alNorte(10), tMs: 10000, precisionM: 10 };

    for (const sinMarca of [undefined, null, NaN, '10000']) {
      assert.throws(
        () => clasificaPosiciones([buena, { ...siguiente, tMs: sinMarca }]),
        (e) => {
          assert.match(e.message, /posición 1/, `el error no nombra la posición: ${e.message}`);
          assert.match(e.message, /tMs|marca de tiempo/, `el error no dice qué falta: ${e.message}`);
          return true;
        },
        `se ha aceptado una posición con tMs ${JSON.stringify(sinMarca)}`,
      );
    }

    assert.throws(
      () => clasificaPosiciones([buena, siguiente, { ...alNorte(20), tMs: 5000, precisionM: 10 }]),
      (e) => {
        assert.match(e.message, /posición 2/, `el error no nombra la posición: ${e.message}`);
        assert.match(e.message, /5000/);
        assert.match(e.message, /10000/);
        return true;
      },
      'una secuencia que va hacia atrás se ha reordenado en silencio',
    );
  });

  test('Una posición cuya coordenada o cuya precisión no es un número falla nombrando lo recibido', () => {
    const buena = { lat: CASA.lat, lon: CASA.lon, tMs: 0, precisionM: 10 };
    for (const mala of [NaN, Infinity, undefined, null, '42.4']) {
      assert.throws(
        () => clasificaPosiciones([buena, { lat: mala, lon: CASA.lon, tMs: 5000, precisionM: 10 }]),
        (e) => e instanceof Error && /posición 1/.test(e.message) && /lat/.test(e.message),
        `se ha aceptado una latitud ${JSON.stringify(mala)}`,
      );
      assert.throws(
        () => clasificaPosiciones([buena, { lat: CASA.lat, lon: mala, tMs: 5000, precisionM: 10 }]),
        (e) => e instanceof Error && /posición 1/.test(e.message) && /lon/.test(e.message),
        `se ha aceptado una longitud ${JSON.stringify(mala)}`,
      );
    }
    for (const mala of [NaN, -1, 'buena']) {
      assert.throws(
        () => clasificaPosiciones([buena, { ...alNorte(10), tMs: 5000, precisionM: mala }]),
        (e) => e instanceof Error && /posición 1/.test(e.message),
        `se ha aceptado una precisión ${JSON.stringify(mala)}`,
      );
    }
    for (const rota of [undefined, null, 42, 'una posición']) {
      assert.throws(() => clasificaPosiciones([buena, rota]), /posición 1/);
    }
    assert.throws(() => clasificaPosiciones('un recorrido'), /lista de posiciones/);
  });
});

// ── Vehículo solo cuando es inequívoco ─────────────────────────────────────────

describe('Vehículo solo cuando es inequívoco', () => {
  test('Una velocidad de vehículo sostenida más del tiempo de confirmación es vehículo, y menos no lo es', () => {
    // Los dos lados del borde, a 40 km/h: 666 m son 60 s justos de racha y 655 m son 59.
    const confirmada = clasificaPosiciones(recorrido({ polilinea: recta(666), velocidadKmH: 40 }));
    const corta = clasificaPosiciones(recorrido({ polilinea: recta(655), velocidadKmH: 40 }));

    assert.equal(confirmada.segmentos.reduce((t, s) => t + s.duracionS, 0), CONFIRMACION_VEHICULO_S, 'la racha larga no dura el tiempo de confirmación justo');
    assert.deepEqual(clasificacionesDe(confirmada), ['vehiculo']);

    assert.equal(corta.segmentos.reduce((t, s) => t + s.duracionS, 0), CONFIRMACION_VEHICULO_S - 1, 'la racha corta no dura un segundo menos que la confirmación');
    assert.equal(clasificacionesDe(corta).includes('vehiculo'), false, 'una racha más corta que la confirmación ya se ha llamado vehículo');
    // Y sin confirmar queda ambigua, que es la clasificación que cuenta en la duda.
    assert.deepEqual([...new Set(clasificacionesDe(corta))], ['ambiguo']);
  });

  test('Un pico de una sola muestra no convierte una caminata en un viaje en coche', () => {
    const andando = recorrido({ polilinea: recta(600), velocidadKmH: 4 });
    const mitad = Math.floor(andando.length / 2);
    // Un fijo que se va 200 m al este durante una sola muestra: 720 km/h de ida y otros
    // tantos de vuelta. Es el pico de GPS de manual.
    const conPico = andando.map((p, i) => (i === mitad ? { ...p, lon: alEste(200).lon } : p));

    const traza = clasificaPosiciones(conPico);
    assert.equal(clasificacionesDe(traza).includes('vehiculo'), false, 'un pico de una muestra se ha llamado vehículo');
    // Sigue habiendo caminata a los dos lados: el pico no se ha tragado la salida.
    assert.ok(metrosDe(traza, 'andando') > 500, `del recorrido solo han quedado ${Math.round(metrosDe(traza, 'andando'))} m andando`);
  });

  test('Una bicicleta sostenida es ambigua y no vehículo, y por debajo del umbral de andar no hay ambiguos', () => {
    // 20 km/h durante cinco minutos: una bici los sostiene con soltura, y el supuesto de
    // trabajo del PRD es que solo se aparta lo inequívocamente de motor.
    const bici = clasificaPosiciones(recorrido({ polilinea: recta(1700), velocidadKmH: 20 }));
    assert.deepEqual(conMetros(bici), ['ambiguo'], 'la bicicleta no ha salido ambigua');
    assert.equal(clasificacionesDe(bici).includes('vehiculo'), false, 'la bicicleta se ha apartado como un coche');
    assert.ok(UMBRAL_VEHICULO_KMH > 20, `el umbral de vehículo declarado es ${UMBRAL_VEHICULO_KMH} km/h y una bici sostiene 20`);

    const paseo = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(800), alNorte(1000)],
      tramos: [{ hastaVertice: 1, velocidadKmH: 4 }, { parada: true, duracionS: 300 }, { hastaVertice: 2, velocidadKmH: 3 }],
    }));
    const vistas = [...new Set(clasificacionesDe(paseo))].sort();
    assert.deepEqual(vistas, ['andando', 'parada'], `por debajo del umbral de andar han salido ${vistas.join(', ')}`);
    assert.ok(metrosDe(paseo, 'andando') > 900, 'el paseo de prueba no trae metros andados');
  });

  test('Los bordes de los dos umbrales son los declarados: 6 km/h es andando y 25 es vehículo', () => {
    assert.equal(UMBRAL_ANDAR_KMH, 6);
    assert.equal(UMBRAL_VEHICULO_KMH, 25);

    const aVelocidad = (kmh) => clasificaPosiciones(recorrido({ polilinea: recta(1500), velocidadKmH: kmh }));

    // Cerrados por abajo: el borde exacto cae del lado de lo que declara la spec.
    assert.ok(clasificacionesDe(aVelocidad(UMBRAL_ANDAR_KMH)).includes('andando'), '6 km/h exactos no son andando');
    assert.equal(clasificacionesDe(aVelocidad(UMBRAL_ANDAR_KMH)).includes('ambiguo'), false, '6 km/h exactos han salido ambiguos');
    assert.ok(clasificacionesDe(aVelocidad(UMBRAL_ANDAR_KMH + 0.1)).includes('ambiguo'), 'por encima del umbral de andar sigue siendo andar');

    assert.deepEqual([...new Set(clasificacionesDe(aVelocidad(UMBRAL_VEHICULO_KMH)))], ['vehiculo'], '25 km/h exactos no son vehículo');
    assert.equal(clasificacionesDe(aVelocidad(UMBRAL_VEHICULO_KMH - 0.1)).includes('vehiculo'), false, '24,9 km/h ya son vehículo');
  });

  test('Un autobús parado en un semáforo un minuto sigue en vehículo, y bajarse de él devuelve la traza a andando', () => {
    const semaforo = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(1000), alNorte(1600)],
      tramos: [
        { hastaVertice: 1, velocidadKmH: 40 },
        { parada: true, duracionS: 60 },
        { hastaVertice: 2, velocidadKmH: 40 },
      ],
    }));
    assert.deepEqual([...new Set(clasificacionesDe(semaforo))], ['vehiculo'], 'el semáforo ha sacado al autobús del vehículo');
    assert.ok(SALIDA_DE_VEHICULO_S > 60, `el tiempo de salida declarado es ${SALIDA_DE_VEHICULO_S} s y un semáforo dura un minuto`);

    // Y andando por debajo del umbral menos del tiempo de salida tampoco basta: 128 m a
    // 4 km/h son 115 s, cinco segundos menos que bajarse.
    const casiSeBaja = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(1000), alNorte(1128)],
      tramos: [{ hastaVertice: 1, velocidadKmH: 40 }, { hastaVertice: 2, velocidadKmH: 4 }],
    }));
    assert.deepEqual([...new Set(clasificacionesDe(casiSeBaja))], ['vehiculo'], 'se ha salido del vehículo antes del tiempo de salida');

    // Con el tiempo de salida cumplido, la racha lenta entera vuelve a ser suya.
    const seBaja = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(1000), alNorte(1128), alNorte(1328)],
      tramos: [
        { hastaVertice: 1, velocidadKmH: 40 },
        { hastaVertice: 2, velocidadKmH: 4 },
        { hastaVertice: 3, velocidadKmH: 4 },
      ],
    }));
    assert.deepEqual(clasificacionesDe(seBaja)[0], 'vehiculo');
    assert.ok(metrosDe(seBaja, 'andando') > 300, `bajarse ha devuelto solo ${Math.round(metrosDe(seBaja, 'andando'))} m a la jugadora`);
    assert.ok(Math.abs(metrosDe(seBaja, 'vehiculo') - 1000) < 1, `el viaje en autobús ha pasado a medir ${Math.round(metrosDe(seBaja, 'vehiculo'))} m al bajarse`);
  });

  test('Los umbrales, los tiempos, el error máximo y el hueco están declarados en un solo sitio y con su justificación', () => {
    const constantes = {
      UMBRAL_ANDAR_KMH: 6,
      UMBRAL_VEHICULO_KMH: 25,
      CONFIRMACION_VEHICULO_S: 60,
      SALIDA_DE_VEHICULO_S: 120,
      ERROR_MAXIMO_FIABLE_M: 30,
      HUECO_MAXIMO_S: 180,
    };
    const vivas = {
      UMBRAL_ANDAR_KMH, UMBRAL_VEHICULO_KMH, CONFIRMACION_VEHICULO_S, SALIDA_DE_VEHICULO_S, ERROR_MAXIMO_FIABLE_M, HUECO_MAXIMO_S,
    };
    assert.deepEqual(vivas, constantes);

    const texto = fuente(DETECTOR);
    for (const nombre of Object.keys(constantes)) {
      const declaraciones = modulosDelPaquete().filter((m) => new RegExp(`export const ${nombre}\\b`).test(fuente(m)));
      assert.deepEqual(declaraciones, [DETECTOR], `"${nombre}" se declara en ${declaraciones.length} sitios`);
      // Y con su justificación al lado: un número sin porqué es un número que cualquiera
      // mueve, y estos seis no salen de game-design/ sino del supuesto de trabajo del PRD.
      const justificacion = new RegExp(`/\\*\\*([\\s\\S]{80,}?)\\*/\\s*export const ${nombre}\\b`);
      assert.match(texto, justificacion, `"${nombre}" se declara sin justificación escrita`);
    }
    // Los dos tiempos son asimétricos a propósito: entrar quita y salir devuelve.
    assert.equal(SALIDA_DE_VEHICULO_S, 2 * CONFIRMACION_VEHICULO_S);
  });

  test('Los umbrales de conveniencia del GPS simulado no son los de esta spec', () => {
    // El doble declara los suyos «de conveniencia, NO una decisión de diseño», y llama
    // vehículo a todo lo que pase de 15 km/h. El detector no: entre 15 y 25 está la
    // bicicleta, que es justo el caso que `accesibilidad.md` deja abierto. Las pruebas
    // que declaran `modo` siguen valiendo tal cual —no pasan por esta comparación—; las
    // que usan el atajo por `velocidadKmH` miden contra los números del doble, y eso va
    // anotado como hueco en `test/spec-test-map.json`.
    const veinte = simulaRecorrido({ polilinea: recta(1700), velocidadKmH: 20, origenTiempoMs: 0 });
    assert.deepEqual([...new Set(veinte.map((p) => p.modo))], ['vehiculo'], 'el doble ha dejado de llamar vehículo a 20 km/h: la comparación ya no dice nada');

    const traza = clasificaPosiciones(sinModo(veinte));
    assert.equal(clasificacionesDe(traza).includes('vehiculo'), false, 'el detector ha heredado el umbral del doble');
    assert.deepEqual(conMetros(traza), ['ambiguo']);
    assert.ok(UMBRAL_VEHICULO_KMH > 20, `el umbral del detector es ${UMBRAL_VEHICULO_KMH} km/h y el del doble, 15`);
  });

  test('Una precisión peor que la fiable, o ausente, no funda un vehículo: cae a ambigua', () => {
    const enCoche = { polilinea: recta(2000), velocidadKmH: 40 };
    assert.deepEqual([...new Set(clasificacionesDe(clasificaPosiciones(recorrido(enCoche, PRECISION_BUENA_M))))], ['vehiculo'], 'con buena precisión esto tenía que ser vehículo');

    assert.ok(PRECISION_MALA_M > ERROR_MAXIMO_FIABLE_M, `la precisión mala de la prueba (${PRECISION_MALA_M} m) no es peor que el máximo fiable`);
    const mala = clasificaPosiciones(recorrido(enCoche, PRECISION_MALA_M));
    assert.equal(clasificacionesDe(mala).includes('vehiculo'), false, 'un fijo malo ha fundado un vehículo');
    assert.deepEqual([...new Set(clasificacionesDe(mala))], ['ambiguo']);
    // Y los metros no se pierden: la precisión mala no puede cerrar puertas.
    assert.ok(metrosQueCuentan(mala) > 1900, 'los metros del fijo malo se han descartado en lugar de contar en la duda');

    const sinDato = clasificaPosiciones(recorrido(enCoche, null));
    assert.equal(clasificacionesDe(sinDato).includes('vehiculo'), false, 'una posición sin precisión ha fundado un vehículo');

    // Y la precisión de un enlace es la peor de sus dos extremos: el arranque con fijos
    // malos no puede fundar el motor, así que el viaje entra en vehículo más tarde y esos
    // metros se quedan en la duda, que es donde cuentan.
    const buenos = recorrido(enCoche, PRECISION_BUENA_M);
    const arranqueMalo = buenos.map((p, i) => (i < 80 ? { ...p, precisionM: PRECISION_MALA_M } : p));
    const traza = clasificaPosiciones(arranqueMalo);
    assert.equal(clasificacionesDe(traza)[0], 'ambiguo', 'un arranque con fijos malos ha fundado un vehículo');
    assert.ok(clasificacionesDe(traza).includes('vehiculo'), 'con los fijos buenos el viaje tenía que acabar en vehículo');
    assert.ok(metrosDe(traza, 'ambiguo') > 0 && metrosDe(traza, 'vehiculo') > 0);
  });
});

// ── Los huecos no fabrican kilómetros ──────────────────────────────────────────

describe('Los huecos no fabrican kilómetros', () => {
  /** Dos kilómetros largos andados, veinte minutos de app cerrada y 29 022 m más allá. */
  const ANDADOS_M = 2050;
  function conHueco({ saltoM = 29022, huecoS = 20 * 60 } = {}) {
    const antes = recorrido({ polilinea: recta(ANDADOS_M), velocidadKmH: 4, cadenciaMs: 5000 });
    const ultima = antes[antes.length - 1];
    const estacion = { ...alNorte(ANDADOS_M + saltoM), tMs: ultima.tMs + huecoS * 1000, precisionM: PRECISION_BUENA_M };
    return [...antes, estacion];
  }

  test('Un hueco mayor que el máximo parte la traza y sus metros no pertenecen a ningún segmento', () => {
    const traza = clasificaPosiciones(conHueco());

    assert.equal(traza.cortes.length, 1, 'el hueco no ha partido la traza');
    assert.equal(Math.round(traza.cortes[0].metros), 29022, 'los metros del salto no son los del salto');
    assert.equal(traza.cortes[0].duracionS, 20 * 60);
    assert.equal(Math.round(metrosTotales(traza)), ANDADOS_M, 'los metros del salto se han colado en algún segmento');
    // Y no se clasificó de ninguna manera: el corte no es un segmento.
    for (const s of traza.segmentos) assert.ok(s.metros < 3000, `un segmento se ha quedado con ${Math.round(s.metros)} m del salto`);
    assert.equal(Object.prototype.hasOwnProperty.call(traza.cortes[0], 'clasificacion'), false, 'el corte llega clasificado: el hueco se corta, no se clasifica');
  });

  test('Un viaje en tren no hace avanzar el mundo', () => {
    // El escenario de la batería por su peor camino: no 30 km clasificados como
    // vehículo, sino 30 km que la app no vio porque estaba cerrada. Si el detector
    // dudara del salto, la regla de la duda lo haría contar y el mundo daría catorce
    // pasos desde un tren.
    const traza = clasificaPosiciones(conHueco());
    const motor = motorDe();
    const resultado = abreSalidaDePasos({ motor, tramo: 2000 }).anda(traza);

    assert.equal(Math.round(metrosQueCuentan(traza)), ANDADOS_M, 'los kilómetros del tren han llegado al motor de pasos');
    assert.equal(resultado.pasos.length, 1, 'el mundo ha avanzado con los kilómetros del tren');
    assert.equal(motor.contador(), 1);
    assert.ok(traza.cortes[0].metros > 29000, 'la prueba no está saltando 30 km: no está midiendo nada');
  });

  test('Un hueco menor que el máximo sí produce segmento y se clasifica por su velocidad', () => {
    const casi = clasificaPosiciones([
      { ...CASA, tMs: 0, precisionM: PRECISION_BUENA_M },
      { ...alNorte(100), tMs: (HUECO_MAXIMO_S - 10) * 1000, precisionM: PRECISION_BUENA_M },
    ]);
    assert.equal(casi.cortes.length, 0, 'un hueco por debajo del máximo ha cortado la traza');
    assert.deepEqual(clasificacionesDe(casi), ['andando'], '100 m en 170 s son andar');

    // El borde exacto todavía produce segmento, y un segundo más corta.
    const justo = clasificaPosiciones([
      { ...CASA, tMs: 0, precisionM: PRECISION_BUENA_M },
      { ...alNorte(100), tMs: HUECO_MAXIMO_S * 1000, precisionM: PRECISION_BUENA_M },
    ]);
    assert.equal(justo.cortes.length, 0, `${HUECO_MAXIMO_S} s exactos han cortado la traza`);
    assert.equal(justo.segmentos.length, 1);

    const pasado = clasificaPosiciones([
      { ...CASA, tMs: 0, precisionM: PRECISION_BUENA_M },
      { ...alNorte(100), tMs: (HUECO_MAXIMO_S + 1) * 1000, precisionM: PRECISION_BUENA_M },
    ]);
    assert.equal(pasado.cortes.length, 1);
    assert.deepEqual(pasado.segmentos, []);
  });

  test('El troceado y el orden no cambian nada de lo que el hueco produce', () => {
    const posiciones = conHueco();
    const entera = clasificaPosiciones(posiciones);
    for (const tamano of [1, 5, 100]) {
      const detector = creaDetectorDeTransporte();
      for (let i = 0; i < posiciones.length; i += tamano) detector.agrega(posiciones.slice(i, i + tamano));
      assert.equal(JSON.stringify(detector.traza()), JSON.stringify(entera), `el hueco troceado en lotes de ${tamano} da otra traza`);
    }
  });
});

// ── El vehículo se aparta del reloj del mundo y de la validación ───────────────

describe('El vehículo se aparta del reloj del mundo y de la validación', () => {
  /** 2 km a 12 km/h: por encima de andar y por debajo de lo inequívocamente de motor. */
  const AMBIGUA = { polilinea: recta(2000), velocidadKmH: 12 };

  test('En la duda, cuenta', () => {
    // El escenario de la batería con la duda **deducida** y no declarada: nadie ha
    // escrito «ambiguo» en ningún sitio, lo dice el detector al ver 12 km/h sostenidos.
    const traza = clasificaPosiciones(recorrido(AMBIGUA));
    assert.deepEqual([...new Set(clasificacionesDe(traza))], ['ambiguo'], 'la secuencia de prueba no ha salido ambigua: no se está midiendo la duda');

    assert.equal(Math.round(metrosQueCuentan(traza)), 2000, 'los metros ambiguos no han contado para el motor de pasos');
    for (const s of traza.segmentos) {
      assert.equal(validaLlegada({ clasificacion: s.clasificacion, enGeofence: true }), true, 'la duda ha invalidado una llegada');
    }
    assert.equal(mideRitmoDeSalida(traza).hayMedida, false, 'los metros ambiguos han medido el tramo');
    assert.equal(mideRitmoDeSalida(traza).motivo, 'ningun-segmento-andando');
  });

  test('La medición del tramo sí excluye la velocidad ambigua', () => {
    // La misma caminata con y sin los 800 m dudosos: el ritmo medido tiene que ser el
    // mismo, y los metros de la media los de andar.
    const conDuda = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(1200), alNorte(2000)],
      tramos: [{ hastaVertice: 1, velocidadKmH: 4 }, { hastaVertice: 2, velocidadKmH: 12 }],
    }));
    const sinDuda = clasificaPosiciones(recorrido({ polilinea: recta(1200), velocidadKmH: 4 }));

    assert.ok(metrosDe(conDuda, 'ambiguo') > 700, 'la traza de prueba no trae los metros dudosos');
    const con = mideRitmoDeSalida(conDuda);
    const sin = mideRitmoDeSalida(sinDuda);
    assert.equal(con.hayMedida, true);
    assert.ok(Math.abs(con.metrosPorMediaHora - sin.metrosPorMediaHora) / sin.metrosPorMediaHora < 1e-6, `los 800 m dudosos han movido el ritmo: ${con.metrosPorMediaHora} frente a ${sin.metrosPorMediaHora}`);
    assert.ok(Math.abs(con.metrosAndando - 1200) < 1, `en la media han entrado ${Math.round(con.metrosAndando)} m`);
    assert.equal(entraEnLaMedidaDelTramo('ambiguo'), false);
  });

  test('Pasar en coche por delante de un beat no lo valida', () => {
    // El geofence de una llegada son 30-50 m (`core/geo.js`); se toma el más estrecho,
    // que es el que menos margen deja a la prueba.
    const GEOFENCE_M = 30;
    const BEAT = alNorte(1500);

    const posiciones = recorrido({ polilinea: recta(3000), velocidadKmH: 50 });
    const traza = clasificaPosiciones(posiciones);
    const dentro = posiciones.filter((p) => metrosEntre(p, BEAT) <= GEOFENCE_M);
    assert.ok(dentro.length > 0, 'el coche no ha llegado a atravesar el geofence del beat');

    const alPasar = traza.segmentos.filter((s) => dentro.some((p) => p.tMs > s.desdeMs && p.tMs <= s.hastaMs));
    assert.ok(alPasar.length > 0, 'ningún segmento cubre el momento de atravesar el geofence');
    for (const s of alPasar) {
      assert.equal(s.clasificacion, 'vehiculo', `atravesar a 50 km/h se ha clasificado como "${s.clasificacion}"`);
      assert.equal(validaLlegada({ clasificacion: s.clasificacion, enGeofence: true }), false, 'pasar en coche ha validado el beat');
    }

    // Y el contraste, que es lo que hace que la prueba diga algo: el mismo geofence
    // atravesado andando sí valida.
    const andando = clasificaPosiciones(recorrido({ polilinea: recta(3000), velocidadKmH: 4, cadenciaMs: 5000 }));
    for (const s of andando.segmentos) {
      assert.equal(validaLlegada({ clasificacion: s.clasificacion, enGeofence: true }), true, `andando, un segmento "${s.clasificacion}" no valida la llegada`);
    }
  });

  test('Volver a casa en autobús echa el telón igual', () => {
    // La ida andando y la vuelta en autobús por el mismo camino, más el minuto de
    // permanencia en casa. La clasificación la deduce el detector; el regreso ni la mira.
    const CASI_SEIS_KM = 5800;
    const posiciones = recorrido({
      polilinea: [CASA, alNorte(CASI_SEIS_KM), CASA, CASA],
      cadenciaMs: 5000,
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { hastaVertice: 2, velocidadKmH: 40 },
        { parada: true, duracionS: DENTRO_DEL_REGRESO_S + 30 },
      ],
    });
    const traza = clasificaPosiciones(posiciones);

    assert.ok(metrosDe(traza, 'vehiculo') > 5000, `la vuelta en autobús solo ha dejado ${Math.round(metrosDe(traza, 'vehiculo'))} m de vehículo`);
    assert.ok(metrosDe(traza, 'andando') > 5000, 'la ida andando no ha llegado a la traza');

    // El telón se echa: volver es dónde estás, no cuántos kilómetros pusiste tú.
    let vigilancia = null;
    let haVuelto = false;
    const alejamientoM = distanciaDeAlejamientoM(declaraTramo('pueblo-de-al-lado'));
    for (const p of posiciones) {
      const paso = avanzaElRegreso(vigilancia, { partida: CASA, alejamientoM, lat: p.lat, lon: p.lon, tMs: p.tMs });
      vigilancia = paso.vigilancia;
      haVuelto = haVuelto || paso.haVuelto;
    }
    assert.equal(haVuelto, true, 'volver en autobús no ha echado el telón');

    // Pero esos kilómetros no han hecho avanzar el mundo: el motor recibe solo la ida.
    const motor = motorDe();
    abreSalidaDePasos({ motor, tramo: 2000 }).anda(traza);
    assert.equal(motor.contador(), 2, `el mundo ha avanzado ${motor.contador()} pasos y la ida andando son dos`);
    assert.ok(Math.abs(metrosQueCuentan(traza) - metrosDe(traza, 'andando')) < 1, 'los kilómetros del autobús han contado');
  });

  test('Una salida entera a velocidad de vehículo no cuenta ni un metro y no aporta ninguna medida', () => {
    const traza = clasificaPosiciones(recorrido({ polilinea: recta(12000), cadenciaMs: 2000, velocidadKmH: 60 }));
    assert.deepEqual([...new Set(clasificacionesDe(traza))], ['vehiculo']);

    assert.equal(metrosQueCuentan(traza), 0, 'una salida entera en coche ha movido el contador');
    const medida = mideRitmoDeSalida(traza);
    assert.equal(medida.hayMedida, false);
    assert.equal(medida.metrosPorMediaHora, null, 'una salida en coche ha producido un número');
    assert.equal(medida.motivo, 'ningun-segmento-andando');

    const tramo = declaraTramo('pueblo-de-al-lado');
    const despues = incorporaMedida(tramo, medida);
    assert.equal(despues.salidasMedidas, 0, 'la salida en coche se ha registrado como salida medida');
    assert.equal(despues.estimadoM, tramo.estimadoM, 'la salida en coche ha movido el tramo');
  });

  test('Una salida que mezcla andando, parada, ambiguo y vehículo reparte metros distintos a los tres efectos', () => {
    // Mil metros andando, dos metros a paso de caracol, dos kilómetros dudosos y seis en
    // coche. Los tres repartos salen distintos, y esa diferencia es la asimetría entera.
    const traza = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(1000), alNorte(1002), alNorte(3002), alNorte(9002)],
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { hastaVertice: 2, velocidadKmH: 1 },
        { hastaVertice: 3, velocidadKmH: 12 },
        { hastaVertice: 4, velocidadKmH: 60 },
      ],
    }));
    assert.deepEqual(clasificacionesDe(traza), ['andando', 'parada', 'ambiguo', 'vehiculo'], 'la traza de prueba no trae las cuatro clasificaciones en orden');

    const paraElMotor = Math.round(metrosQueCuentan(traza));
    const paraElTramo = Math.round(mideRitmoDeSalida(traza).metrosAndando);
    const paraLaLlegada = Math.round(traza.segmentos
      .filter((s) => validaLlegadaPorGeofence(s.clasificacion))
      .reduce((t, s) => t + s.metros, 0));

    assert.equal(paraElMotor, 3000, 'el motor de pasos no ha recibido los metros andados más los dudosos');
    assert.equal(paraElTramo, 1000, 'la medida del tramo ha recibido algo que no era andar');
    assert.equal(paraLaLlegada, 3002, 'la validación de llegadas no ha recibido todo lo que no era motor');
    assert.equal(new Set([paraElMotor, paraElTramo, paraLaLlegada]).size, 3, 'dos de los tres efectos reparten lo mismo');
    // La medida del tramo es la contraria de las otras dos, y las tres salen del mismo módulo.
    assert.ok(paraElTramo < paraElMotor && paraElTramo < paraLaLlegada);
  });

  test('El detector no declara ninguna regla por efecto: la asimetría se consulta y no se copia', () => {
    const codigo = codigoDe(DETECTOR);
    for (const efecto of [/paso/i, /tramo/i, /llegada/i, /geofence/i, /duda/i, /medida/i, /media hora/i]) {
      assert.equal(efecto.test(codigo), false, `el detector nombra un efecto (${efecto}): clasifica, y no decide qué se hace con lo que clasifica`);
    }
    for (const respuesta of ['REGLA_DE_LA_DUDA', 'cuentaParaElMotorDePasos', 'entraEnLaMedidaDelTramo', 'validaLlegadaPorGeofence']) {
      assert.equal(codigo.includes(respuesta), false, `el detector importa "${respuesta}": la regla por efecto vive en ritmo.js y se consulta desde los tres consumidores`);
    }
    // Lo único que toma de SPEC-004 es el vocabulario y el umbral de parada, que no son
    // reglas por efecto sino el idioma común de la traza.
    const importa = codigo.match(/import \{([^}]*)\} from '\.\/ritmo\.js'/);
    assert.ok(importa, 'el detector ya no importa nada de ritmo.js: el vocabulario tiene que salir de ahí');
    assert.deepEqual(importa[1].split(',').map((s) => s.trim()).filter(Boolean).sort(), ['CLASIFICACIONES', 'UMBRAL_PARADA_MS']);
  });

  test('Las paradas no cuentan para medir el ritmo', () => {
    // El escenario de la batería con la parada **detectada** y no declarada: se anda a
    // 4 km/h, se para veinte minutos a tomar un café y se sigue a 4 km/h.
    const conCafe = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(1000), alNorte(2000)],
      cadenciaMs: 5000,
      tramos: [
        { hastaVertice: 1, velocidadKmH: 4 },
        { parada: true, duracionS: 20 * 60 },
        { hastaVertice: 2, velocidadKmH: 4 },
      ],
    }));
    const sinCafe = clasificaPosiciones(recorrido({
      polilinea: [CASA, alNorte(1000), alNorte(2000)],
      cadenciaMs: 5000,
      tramos: [{ hastaVertice: 1, velocidadKmH: 4 }, { hastaVertice: 2, velocidadKmH: 4 }],
    }));

    // El café, y no la muestra de 0 m con la que el doble pisa el último vértice.
    const paradas = conCafe.segmentos.filter((s) => s.clasificacion === 'parada' && s.duracionS > 60);
    assert.equal(paradas.length, 1, 'la parada no se ha detectado: nadie la declaró');
    assert.ok(paradas[0].duracionS >= 20 * 60 - 5, `la parada detectada dura ${paradas[0].duracionS} s`);

    const con = mideRitmoDeSalida(conCafe);
    const sin = mideRitmoDeSalida(sinCafe);
    assert.equal(con.hayMedida, true, 'la salida con parada no ha dado medida');
    const desvio = Math.abs(con.metrosPorMediaHora - sin.metrosPorMediaHora) / sin.metrosPorMediaHora;
    assert.ok(desvio < 1e-6, `la parada ha movido el ritmo medido: ${con.metrosPorMediaHora} frente a ${sin.metrosPorMediaHora}`);
    assert.ok(Math.abs(con.metrosPorMediaHora - 2000) / 2000 < 0.01, `4 km/h medidos como ${con.metrosPorMediaHora} m por media hora`);
  });

  test('Un tramo andado es un paso del mundo', () => {
    // Seis kilómetros andados de verdad, deducidos y no declarados, sobre un tramo de
    // 2 km: tres pasos.
    const traza = clasificaPosiciones(recorrido({ polilinea: recta(6010), velocidadKmH: 4, cadenciaMs: 5000 }));
    assert.deepEqual([...new Set(clasificacionesDe(traza))], ['andando'], 'la caminata de prueba no ha salido entera andando');

    const motor = motorDe();
    const resultado = abreSalidaDePasos({ motor, tramo: 2000 }).anda(traza);
    assert.equal(resultado.pasos.length, 3, 'seis kilómetros sobre un tramo de 2 km son tres pasos');
    assert.deepEqual(resultado.pasos.map((p) => p.n), [1, 2, 3]);
    assert.equal(motor.contador(), 3);
  });
});

// ── Nada degrada por falta de cableado ─────────────────────────────────────────

describe('Nada degrada por falta de cableado', () => {
  const posicionesDe = (secuencia) => {
    let i = 0;
    return creaFuenteDePosiciones({ lee: () => (i < secuencia.length ? secuencia[i++] : null) });
  };

  test('Sin fuente de posiciones cableada, pedir la traza falla nombrando la fuente', () => {
    const traza = creaTrazaDeSalida({ fuente: fuenteSinMontar(), detector: creaDetectorDeTransporte() });
    for (const pedir of [() => traza.traza(), () => traza.muestrea()]) {
      assert.throws(pedir, (e) => {
        assert.match(e.message, /fuente de posiciones/, `el error no nombra la fuente: ${e.message}`);
        assert.match(e.message, /no está montada|no montada/, `el error no dice que falta: ${e.message}`);
        return true;
      }, 'sin fuente se ha devuelto una traza vacía en lugar de fallar');
    }
  });

  test('Sin detector cableado, el motor de pasos no recibe una traza con todo clasificado como andando', () => {
    const secuencia = recorrido({ polilinea: recta(500), velocidadKmH: 4 }).map((p) => ({ ...p, tMs: Math.round(p.tMs) }));
    const salida = creaTrazaDeSalida({ fuente: posicionesDe(secuencia), detector: detectorSinMontar() });

    assert.throws(() => salida.muestrea(), (e) => {
      assert.match(e.message, /detector/, `el error no nombra el detector: ${e.message}`);
      return true;
    }, 'sin detector se ha muestreado igual');
    assert.throws(() => salida.traza(), /detector/, 'sin detector se ha devuelto una traza');

    // Y el detector sin montar lo dice él mismo, con motivo.
    const sinMontar = detectorSinMontar();
    assert.equal(sinMontar.montado, false);
    assert.match(sinMontar.motivo, /cablead/);
    assert.throws(() => sinMontar.agrega([]), /detector/);
    assert.throws(() => sinMontar.traza(), /detector/);

    // Montado del todo, la misma secuencia sí da traza: el contraste es el caso.
    const viva = creaTrazaDeSalida({ fuente: posicionesDe(secuencia), detector: creaDetectorDeTransporte() });
    while (viva.muestrea() !== null);
    assert.ok(viva.traza().segmentos.length > 0, 'cableada del todo, la salida no ha producido traza');
  });

  test('La traza de la salida se monta con las dos piezas o no se monta', () => {
    for (const sinFuente of [undefined, null, {}, { posicion: 'no soy una función' }]) {
      assert.throws(() => creaTrazaDeSalida({ fuente: sinFuente, detector: creaDetectorDeTransporte() }), /fuente de posiciones/);
    }
    for (const sinDetector of [undefined, null, {}, { agrega() {} }]) {
      assert.throws(() => creaTrazaDeSalida({ fuente: fuenteSinMontar(), detector: sinDetector }), /detector/);
    }
  });

  test('Ningún segmento que produce el detector sale sin clasificar, con metros negativos ni con duración cero', () => {
    const trazas = [
      clasificaPosiciones(recorrido({ polilinea: recta(2000), velocidadKmH: 40 })),
      clasificaPosiciones(recorrido({
        polilinea: [CASA, alNorte(500), alNorte(1500), alNorte(2000)],
        tramos: [
          { hastaVertice: 1, velocidadKmH: 4 },
          { parada: true, duracionS: 200 },
          { hastaVertice: 2, velocidadKmH: 12 },
          { hastaVertice: 3, velocidadKmH: 50 },
        ],
      })),
    ];
    for (const traza of trazas) {
      assert.ok(traza.segmentos.length > 0);
      for (const [i, s] of traza.segmentos.entries()) {
        assert.ok(CLASIFICACIONES.includes(s.clasificacion), `el segmento ${i} sale sin clasificar`);
        assert.ok(s.metros >= 0, `el segmento ${i} tiene ${s.metros} m`);
        assert.ok(s.duracionS > 0, `el segmento ${i} dura ${s.duracionS} s`);
      }
      // Y aguas abajo nadie tiene que decidir nada: los tres efectos la consumen sin fallar.
      assert.doesNotThrow(() => metrosQueCuentan(traza));
      assert.doesNotThrow(() => mideRitmoDeSalida(traza));
    }
  });

  test('Dos fijos con la misma marca no producen un segmento de duración cero ni pierden sus metros', () => {
    const repetida = [
      { ...CASA, tMs: 0, precisionM: PRECISION_BUENA_M },
      { ...alNorte(3), tMs: 0, precisionM: PRECISION_BUENA_M },
      { ...alNorte(6), tMs: 3000, precisionM: PRECISION_BUENA_M },
    ];
    const traza = clasificaPosiciones(repetida);
    assert.equal(traza.segmentos.length, 1);
    assert.ok(traza.segmentos[0].duracionS > 0, 'dos marcas iguales han producido un segmento de duración cero');
    assert.ok(Math.abs(traza.segmentos[0].metros - 6) < 1e-6, `los metros del fijo repetido se han perdido: ${traza.segmentos[0].metros} m`);
  });
});

// ── Nada de esto se ve ─────────────────────────────────────────────────────────

describe('Nada de esto se ve', () => {
  test('La superficie pública del detector no exporta ningún texto destinado a mostrarse', async () => {
    const modulo = await import('../../packages/nucleo/partida/transporte.js');
    for (const [nombre, valor] of Object.entries(modulo)) {
      assert.notEqual(typeof valor, 'string', `el detector exporta el texto "${nombre}"`);
      assert.ok(['function', 'number'].includes(typeof valor), `el detector exporta "${nombre}", que es un ${typeof valor}`);
    }
    // Y lo que devuelve tampoco lleva ni una palabra que enseñar: la traza son números y
    // clasificaciones, que son identificadores y no textos.
    const traza = clasificaPosiciones(recorrido({ polilinea: recta(1500), velocidadKmH: 40 }));
    const textos = JSON.stringify(traza).match(/"[a-zA-Zá-úÁ-Ú ]+"/g) ?? [];
    for (const t of textos) {
      const limpio = t.slice(1, -1);
      const esCampo = ['metros', 'duracionS', 'clasificacion', 'desdeMs', 'hastaMs', 'fragmento', 'segmentos', 'cortes'].includes(limpio);
      assert.ok(esCampo || CLASIFICACIONES.includes(limpio), `la traza lleva el texto "${limpio}"`);
    }
  });

  test('Ningún ajuste del juego activa, desactiva ni calibra la detección', () => {
    for (const id of IDS_DE_AJUSTE) {
      for (const palabra of [/veh/i, /coche/i, /autob/i, /tren/i, /velocidad/i, /transporte/i, /gps/i]) {
        assert.equal(palabra.test(id), false, `el ajuste "${id}" habla de la detección`);
      }
    }
    assert.deepEqual([...IDS_DE_AJUSTE], ['soloDeDia', 'pasosDelDiaADia']);
  });

  test('La clasificación no viaja con la partida: nadie del paquete guarda la traza', () => {
    // El detector no lo importa nadie del núcleo, y el único que lo cablea es la capa de
    // plataforma, que lo tiene vivo lo que dura la salida. Una traza guardada sería el
    // registro de por dónde se fue y en qué, que es justo lo que este proyecto no tiene.
    const importadores = modulosDelPaquete().filter((m) => m !== DETECTOR && /transporte\.js/.test(fuente(m)));
    assert.deepEqual(importadores, [], `un módulo del paquete consume el detector y podría guardar su traza: ${importadores.join(', ')}`);
    assert.match(fuente('app/plataforma/posiciones.js'), /partida\/transporte\.js/, 'la capa de plataforma ya no cablea el detector');

    // Y el propio detector no persiste la secuencia: es incremental y solo guarda el
    // último fijo y la racha sin resolver.
    const codigo = codigoDe(DETECTOR);
    for (const persistencia of [/almacen/i, /guarda/i, /localStorage/, /AsyncStorage/, /writeFile/]) {
      assert.equal(persistencia.test(codigo), false, `el detector escribe en algún sitio (${persistencia})`);
    }
  });
});
