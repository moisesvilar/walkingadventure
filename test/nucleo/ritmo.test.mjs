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
  ERROR_QUE_SOSTIENE_LA_CORTA_M,
  LIMITE_DE_ERROR_DECLARADO,
  MINIMO_UTIL_M,
  MOTIVOS_DE_NO_PARADA,
  REGLA_DE_LA_DUDA,
  UMBRAL_PARADA_MS,
  VENTANAS_DE_PARADA,
  creaVentanaDeParada,
  cuentaParaElMotorDePasos,
  derivaDeVentana,
  entraEnLaMedidaDelTramo,
  esUnaParada,
  incorporaMedida,
  mideRitmoDeSalida,
  validaLlegadaPorGeofence,
  ventanaParaPrecision,
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
    //
    // **El detector de SPEC-031 es la única excepción, y está nombrada.** Nombrar el
    // valor era un buen proxy mientras solo `ritmo.js` sabía de velocidades, pero
    // desde que alguien deduce la clasificación en lugar de escribirla la prueba,
    // ese proxy cazaba justo a quien tiene que producirla. El criterio de verdad es
    // el que la propia spec declara: **el detector clasifica y no decide por
    // efecto**. Así que se le exige eso, que es más estrecho que no nombrar el
    // valor: su código no nombra a ninguno de los tres efectos ni importa ninguna de
    // las tres respuestas de este módulo. El día que se ponga a decidir qué se hace
    // con lo ambiguo, esto vuelve a rojo.
    const DETECTOR = 'packages/nucleo/partida/transporte.js';
    const otros = modulosDelPaquete().filter((m) => m !== 'packages/nucleo/partida/ritmo.js' && /['"]ambigu[oa]['"]/i.test(fuente(m)));
    assert.deepEqual(otros, [DETECTOR], `otro módulo decide sobre la velocidad ambigua: ${otros.filter((m) => m !== DETECTOR).join(', ') || 'ninguno, y el detector ha dejado de producirla'}`);

    // Los comentarios del detector explican con estas mismas palabras lo que no
    // hace, así que se mira su código y no su texto: castigar una buena explicación
    // sería el peor de los guardianes.
    const codigo = fuente(DETECTOR)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*\/\//.test(l))
      .join('\n');
    for (const efecto of [/paso/i, /tramo/i, /llegada/i, /geofence/i, /duda/i, /medida/i]) {
      assert.equal(efecto.test(codigo), false, `el detector nombra un efecto (${efecto}): clasificar no es decidir qué se hace con lo clasificado`);
    }
    for (const respuesta of ['REGLA_DE_LA_DUDA', 'cuentaParaElMotorDePasos', 'entraEnLaMedidaDelTramo', 'validaLlegadaPorGeofence']) {
      assert.equal(codigo.includes(respuesta), false, `el detector importa "${respuesta}": la asimetría se consulta desde los tres consumidores, no desde quien clasifica`);
    }
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

// ── La parada, medida por deriva de ventana ────────────────────────────────────
//
// SPEC-044 · §9c. La regla de fijo a fijo dejó de decidir la validación de un geofence:
// medido, el ruido del GPS con fijos a T segundos aparenta ~1,4·σ/T m/s, así que un parado
// de verdad con σ = 10 m no parece parado hasta que pasan veintiocho segundos entre fijos, y
// con la cadencia real **no validaba ninguna llegada**. Lo que los separa es que el ruido es
// de media cero y la deriva de quien anda no.
//
// Todo lo de aquí son posiciones con su marca dentro: esta capa no lee ningún reloj, y por
// eso «cuarenta segundos» es una resta entre dos números y nunca una espera.

describe('La parada, medida por deriva de ventana', () => {
  /** Una ventana de posiciones en el mismo punto, con la precisión que se pida. */
  function quieta({ x = 0, y = 0, desdeMs = 0, duracionMs, cadaMs = 5000, precisionM = 3, clasificacion = 'parada' }) {
    const posiciones = [];
    for (let t = 0; t <= duracionMs; t += cadaMs) posiciones.push({ x, y, tMs: desdeMs + t, precisionM, clasificacion });
    return posiciones;
  }

  /** Una ventana de quien anda en línea recta a la velocidad que se pida. */
  function andando({ velocidadMs, duracionMs, cadaMs = 5000, precisionM = 3, desdeMs = 0 }) {
    const posiciones = [];
    for (let t = 0; t <= duracionMs; t += cadaMs) {
      posiciones.push({ x: velocidadMs * (t / 1000), y: 0, tMs: desdeMs + t, precisionM, clasificacion: 'andando' });
    }
    return posiciones;
  }

  const mete = (ventana, posiciones) => posiciones.map((p) => ventana.agrega(p)).pop();

  test('La deriva se mide entre el centroide de la primera mitad y el de la segunda', () => {
    // La pieza entera, y por qué funciona: promediar hunde el ruido como 1/√n y deja la
    // deriva intacta. Sobre el mismo punto la deriva es cero por mucho ruido que haya.
    assert.equal(derivaDeVentana([{ x: 0, y: 0, tMs: 0 }, { x: 0, y: 0, tMs: 20_000 }]), 0);

    // Y quien anda deriva lo que ha andado entre las dos mitades: veinte segundos a 1,39 m/s
    // son 27,8 m, y la separación entre centroides es del orden de la mitad.
    const paseo = andando({ velocidadMs: 1.39, duracionMs: 20_000 });
    const deriva = derivaDeVentana(paseo);
    assert.ok(deriva > VENTANAS_DE_PARADA.corta.derivaM, `andar veinte segundos deriva ${deriva.toFixed(1)} m, por debajo del límite de la ventana corta`);

    // Se parte **por tiempo y no por número de muestras**: la cadencia real no es regular y
    // partir por índice mediría medias de duraciones distintas.
    assert.throws(() => derivaDeVentana([{ x: 0, y: 0, tMs: 0 }]), /dos posiciones o más/);
  });

  test('Con el fijo bueno la ventana es la corta y con el malo la larga', () => {
    // Los dos pares salen de la tabla de §9c y no se reinventan: a cinco metros de error la
    // corta ya deja pasar un 4,3 % de paseos a cuatro kilómetros por hora y a diez un 27,6 %,
    // que es lo que la hace dejar de servir.
    assert.deepEqual(VENTANAS_DE_PARADA.corta, { duracionS: 20, derivaM: 5 });
    assert.deepEqual(VENTANAS_DE_PARADA.larga, { duracionS: 40, derivaM: 8 });
    assert.equal(ERROR_QUE_SOSTIENE_LA_CORTA_M, 5);
    assert.equal(ventanaParaPrecision(3), VENTANAS_DE_PARADA.corta);
    assert.equal(ventanaParaPrecision(ERROR_QUE_SOSTIENE_LA_CORTA_M), VENTANAS_DE_PARADA.corta);
    assert.equal(ventanaParaPrecision(ERROR_QUE_SOSTIENE_LA_CORTA_M + 0.1), VENTANAS_DE_PARADA.larga);

    // Y sobre la ventana de verdad: veinte segundos quieta con el fijo bueno ya es parada, y
    // con el fijo malo todavía no, porque la suya son cuarenta.
    assert.equal(mete(creaVentanaDeParada(), quieta({ duracionMs: 20_000, precisionM: 3 })).parada, true);
    const conFijoMalo = mete(creaVentanaDeParada(), quieta({ duracionMs: 20_000, precisionM: 12 }));
    assert.equal(conFijoMalo.parada, false);
    assert.equal(conFijoMalo.motivo, 'ventana-sin-cubrir');
    assert.equal(mete(creaVentanaDeParada(), quieta({ duracionMs: 40_000, precisionM: 12 })).parada, true);
  });

  test('Una posición sin precisión declarada usa la ventana larga', () => {
    // En la duda sobre el error del fijo se exige más y no menos: la asimetría del proyecto
    // es fallar hacia el lado que no rompe el diseño, y aquí el lado caro es validar a quien
    // pasa andando, que tumbaría «El visor no aparece nunca andando».
    assert.equal(ventanaParaPrecision(null), VENTANAS_DE_PARADA.larga);
    assert.equal(ventanaParaPrecision(undefined), VENTANAS_DE_PARADA.larga);
    assert.equal(ventanaParaPrecision(Number.NaN), VENTANAS_DE_PARADA.larga);

    const sinPrecision = mete(creaVentanaDeParada(), quieta({ duracionMs: 20_000, precisionM: null }));
    assert.equal(sinPrecision.parada, false, 'sin precisión declarada la ventana corta ha bastado, y en la duda se exige la larga');
    assert.equal(mete(creaVentanaDeParada(), quieta({ duracionMs: 40_000, precisionM: null })).parada, true);

    // Y desconocida **contagia**: un solo fijo sin precisión dentro de la ventana corta
    // obliga a la larga, igual que en el detector de transporte no funda un motor.
    const ventana = creaVentanaDeParada();
    ventana.agrega({ x: 0, y: 0, tMs: 0, precisionM: null, clasificacion: 'parada' });
    const conUnoMalo = mete(ventana, quieta({ desdeMs: 5000, duracionMs: 15_000, precisionM: 3 }));
    assert.equal(conUnoMalo.parada, false, 'un fijo sin precisión dentro de la ventana corta no ha contagiado');
  });

  test('Una ventana que todavía no cubre su duración responde que no, y no se extrapola', () => {
    // Con dos o tres fijos el ruido y la deriva son indistinguibles, que es lo que §9c mide:
    // con radio de quietud de quince metros salían 98 % de paradas y **36 %** de paseos.
    const ventana = creaVentanaDeParada();
    const primera = ventana.agrega({ x: 0, y: 0, tMs: 0, precisionM: 3, clasificacion: 'parada' });
    assert.equal(primera.parada, false);
    assert.equal(primera.motivo, 'ventana-sin-cubrir');
    assert.equal(primera.derivaM, null, 'una ventana sin cubrir ha devuelto una deriva, que es una medida que no tiene');

    const aMedias = mete(ventana, quieta({ desdeMs: 5000, duracionMs: 10_000 }));
    assert.equal(aMedias.parada, false);
    assert.equal(aMedias.motivo, 'ventana-sin-cubrir');

    // Los tres motivos son vocabulario cerrado: un motivo inventado no se puede leer.
    assert.deepEqual([...MOTIVOS_DE_NO_PARADA], ['vehiculo', 'ventana-sin-cubrir', 'deriva']);
    for (const respuesta of [primera, aMedias]) {
      assert.ok(MOTIVOS_DE_NO_PARADA.includes(respuesta.motivo), `"${respuesta.motivo}" no está en el vocabulario`);
    }
  });

  test('Una marca de tiempo hacia atrás vuelve a anclar la ventana en lugar de medir una duración negativa', () => {
    // Una traza que retrocede en el tiempo es otra traza. Es lo mismo que hace la app al
    // volver del segundo plano, y por eso la permanencia se paga otra vez: veinte segundos
    // declarados, en vez de coser media tarde de comida como si fuera quietud.
    const ventana = creaVentanaDeParada();
    assert.equal(mete(ventana, quieta({ duracionMs: 20_000 })).parada, true);
    const haciaAtras = ventana.agrega({ x: 0, y: 0, tMs: 1000, precisionM: 3, clasificacion: 'parada' });
    assert.equal(haciaAtras.parada, false, 'la ventana ha seguido midiendo con la traza retrocedida');
    assert.equal(haciaAtras.motivo, 'ventana-sin-cubrir');

    // Y desde ahí se vuelve a contar entera, sin coser el hueco.
    assert.equal(mete(ventana, quieta({ desdeMs: 6000, duracionMs: 15_000 })).parada, true);
  });

  test('El vehículo no es una parada aunque la deriva sea cero', () => {
    // La mitad del criterio que se pierde sola en cualquier arreglo de ruido: un coche
    // parado no deriva, así que lo único que lo aparta es la clasificación, y se responde
    // **antes de medir nada**.
    const ventana = creaVentanaDeParada();
    const enCoche = mete(ventana, quieta({ duracionMs: 120_000, clasificacion: 'vehiculo' }));
    assert.equal(enCoche.parada, false);
    assert.equal(enCoche.motivo, 'vehiculo');
    assert.equal(enCoche.derivaM, null, 'se ha medido la deriva de un vehículo, y eso es medir antes de la guarda');

    // Y la guarda es la misma que la del enlace de fijo a fijo, que sigue viva para el
    // ritmo y para el motor de pasos.
    assert.equal(esUnaParada({ metros: 0, duracionS: 60, clasificacion: 'vehiculo' }), false);
    assert.equal(validaLlegadaPorGeofence('vehiculo'), false);
  });

  test('Quien anda a cuatro y a cinco kilómetros por hora no está parado con ninguna de las dos ventanas', () => {
    // Las dos velocidades de la tabla de §9c, y las dos ventanas: **0 % de paseos** hasta
    // tres metros de error. Es lo que sostiene «El visor no aparece nunca andando».
    for (const velocidadMs of [1.11, 1.39]) {
      for (const precisionM of [3, 12]) {
        const respuesta = mete(creaVentanaDeParada(), andando({ velocidadMs, duracionMs: 60_000, precisionM }));
        assert.equal(
          respuesta.parada,
          false,
          `andar a ${(velocidadMs * 3.6).toFixed(1)} km/h con el fijo de ${precisionM} m ha salido parada (deriva ${respuesta.derivaM?.toFixed(1)} m)`,
        );
        assert.equal(respuesta.motivo, 'deriva');
      }
    }
  });

  test('El límite de esta regla está escrito con su número y no se disimula', () => {
    // Por encima de σ ≈ 15 m la validación se degrada —91 % de paradas con la ventana
    // larga— y por encima de σ ≈ 20 m deja de sostenerse. Cubre la calle normal y no cubre
    // el cañón urbano profundo. Es un límite medido, no una esperanza.
    assert.deepEqual({ ...LIMITE_DE_ERROR_DECLARADO }, { seDegradaM: 15, dejaDeSostenerseM: 20 });
    assert.ok(LIMITE_DE_ERROR_DECLARADO.seDegradaM > ERROR_QUE_SOSTIENE_LA_CORTA_M);
    assert.ok(LIMITE_DE_ERROR_DECLARADO.dejaDeSostenerseM > LIMITE_DE_ERROR_DECLARADO.seDegradaM);
  });

  test('La regla de parada vive en un solo módulo y no está reimplementada en la app', () => {
    // La misma exigencia que la spec pone en su criterio: quien decide una parada es
    // `ritmo.js`, del que la lee también el motor de pasos. Una segunda copia en la app se
    // desincronizaría sin que nada se pusiera rojo.
    const ritmo = fuente('packages/nucleo/partida/ritmo.js');
    assert.match(ritmo, /export function creaVentanaDeParada/);
    for (const modulo of ['app/marcha/salida.js', 'app/marcha/seguidor.js', 'app/plataforma/posiciones.js', 'app/marcha/llegadas.js']) {
      const codigo = fuente(modulo)
        .split('\n')
        .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
        .join('\n');
      assert.equal(/creaVentanaDeParada|derivaDeVentana|centroide/.test(codigo), false, `${modulo} reimplementa la regla de parada`);
    }

    // Y la regla de enlace de fijo a fijo ya no decide ninguna validación de geofence: lo
    // que queda de `esUnaParada` es el ritmo y el motor de pasos.
    const llegadas = fuente('packages/nucleo/partida/llegadas.js')
      .split('\n')
      .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
      .join('\n');
    assert.equal(/esUnaParada/.test(llegadas), false, 'la capa de llegadas vuelve a decidir con la parada de fijo a fijo');
  });

  test('La misma secuencia de posiciones dos veces da la misma parada', () => {
    // `@determinismo`, bloqueante: no se lee el reloj del sistema ni ninguna fuente de azar.
    const secuencia = [
      ...andando({ velocidadMs: 1.39, duracionMs: 30_000 }),
      ...quieta({ x: 41.7, desdeMs: 35_000, duracionMs: 40_000 }),
    ];
    const primera = secuencia.map((p) => creaVentanaDeParadaConTodo(secuencia, p));
    for (let k = 0; k < 3; k += 1) {
      assert.equal(
        JSON.stringify(secuencia.map((p) => creaVentanaDeParadaConTodo(secuencia, p))),
        JSON.stringify(primera),
        'dos recorridos de la misma secuencia dan paradas distintas',
      );
    }
  });

  /** Vuelve a medir la secuencia entera hasta `hasta`, que es lo que hace la comparación honesta. */
  function creaVentanaDeParadaConTodo(secuencia, hasta) {
    const ventana = creaVentanaDeParada();
    let ultima = null;
    for (const p of secuencia) {
      ultima = ventana.agrega(p);
      if (p === hasta) break;
    }
    return ultima;
  }
});
