// SPEC-048 · El módulo de ubicación y el rótulo del sistema, **desde el lado de la app**:
// la única suscripción al sensor, la cadena fuente → detector → seguidor, la vida de una
// salida cableada por fin, y las promesas de privacidad que con servicio en primer plano
// dejan de ser una buena práctica para ser la diferencia entre cien posiciones tiradas y
// cien posiciones guardadas.
//
// **Qué se prueba aquí y qué no.** Las cuatro situaciones de una salida, el plazo, el
// regreso, el telón y los literales del rótulo son del paquete y están probados de arriba
// abajo en `test/nucleo/salidas.test.mjs` desde SPEC-030; lo que faltaba y esta fila
// entrega es **alguien que los llame**, y ese alguien vive en `app/marcha/` y en
// `app/plataforma/`. Aquí se prueba el orden en el que la orquestación toca las piezas,
// que es el único sitio donde ese orden se puede equivocar.
//
// Tres decisiones de este fichero que no son de estilo:
//
// - **Se dobla la frontera y nada más.** `creaLaSalida` recibe el núcleo, el rótulo y la
//   suscripción inyectados, así que doblar es pasar otro argumento. El núcleo que se le
//   pasa es **el de verdad**, importado del paquete por ruta relativa: doblarlo sería
//   probar la orquestación contra una idea de las transiciones en vez de contra ellas.
// - **No hay reloj y no hay espera.** El tiempo del sensor es la marca que trae cada
//   posición, así que el plazo de noventa minutos son dos números.
// - **Las promesas de privacidad se afirman sobre lo escrito, no sobre el código.** Se
//   abre una salida, pasan cien posiciones y se mira el documento congelado: un punto y
//   dos marcas, que es lo que `AREA_SALIDAS` declara desde SPEC-030 y ni un campo más. La
//   frase gruesa del encargo —«ni una marca de tiempo llega a escribirse»— era falsa y un
//   criterio que no puede cumplirse no mide nada (§6o).
//
// **Los escenarios de `docs/testing.md` que se implementan aquí, con su nombre literal**:
// «Una salida abierta tiene una sola suscripción al sensor», «La posición llega al seguidor
// ya clasificada», «Tras una interrupción la traza se vuelve a anclar», «Sin permiso de
// ubicación no se abre ninguna salida», «Conceder el permiso deja la marca donde la puso el
// sensor», «Denegar el permiso sigue por la vía manual sin llamarlo problema», «No poder
// preguntar el permiso se queda en la pantalla y lo dice», «El rótulo se retira pero la
// salida no se cierra», «Volver a casa en autobús echa el telón igual» y «El rastro de
// ubicación no se guarda nunca». El resto va marcado como hueco de la batería en
// `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { creaLaSalida, DEL_NUCLEO, MOTIVOS_DE_NO_ABRIR } from '../../app/marcha/salida.js';
import { CLASIFICACIONES, SIN_SEGMENTO_TODAVIA, creaSeguidorDeLaSalida, creaSeguidorDePosicion } from '../../app/marcha/seguidor.js';
import {
  CADENCIA_M,
  NOMBRE_DE_LA_APP,
  NOMBRE_DE_LA_TAREA,
  creaFuenteDePosiciones,
  creaSuscripcionDeUbicacion,
} from '../../app/plataforma/posiciones.js';
import { TAREAS_QUE_LA_APP_DEFINE, exigeTareaDeclarada } from '../../app/plataforma/permisos.js';
import { makeProjector } from '../../packages/nucleo/core/geo.js';
import {
  CADENCIAS,
  CADENCIA_CERCA_S,
  PARADA_DENTRO_S,
  MARGEN_DE_CERCANIA_M,
  RADIO_DE_GEOFENCE_M,
  cadenciaDeMuestreo,
  sitiosConPosicion,
} from '../../packages/nucleo/partida/llegadas.js';
import { congelaHondo } from '../../packages/nucleo/core/congelar.js';
import { componeRotulo, PLAZO_DE_RETIRADA_MS } from '../../packages/nucleo/partida/rotulo.js';
import { creaDetectorDeTransporte, HUECO_MAXIMO_S, SALIDA_DE_VEHICULO_S } from '../../packages/nucleo/partida/transporte.js';
import { congelaSalidas, estadoDeSalidas, levantaSalidas } from '../../packages/nucleo/partida/salidas.js';
import * as salidas from '../../packages/nucleo/partida/salidas.js';
import { REPARTO_SIN_AVENTURA, creaLasLlegadas } from '../../app/marcha/llegadas.js';
import { makeRng } from '../../packages/nucleo/core/rng.js';
import { estadoInicial } from '../../packages/nucleo/partida/estado.js';
import { registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { NUCLEO_DE_LAS_LLEGADAS } from './llegadas-de-prueba.mjs';
import { celdaDeFixture } from './partida-de-prueba.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { rotuloNoDisponible, rotuloQueFunciona, rotuloQueSeRetiraSolo, rotuloSinMontar } from '../dobles/rotulo-del-sistema.mjs';
import { fuente } from './mundo-de-prueba.mjs';

/** El origen del mundo congelado sobre el que se proyectan los metros. */
const ORIGEN = Object.freeze({ lat: 42.40, lon: -8.81 });

/** El tramo de quien juega, en metros. Sale del estado y aquí se declara para el regreso. */
const TRAMO_M = 1200;

/** La marca del sensor con la que arranca todo. No es una hora: es un número que crece. */
const T0 = 1_000_000;

/**
 * El núcleo de verdad, con exactamente lo que `creaLaSalida` enumera en `DEL_NUCLEO`.
 *
 * Se compone aquí y no se importa de `app/nucleo/piezas.js` por lo de siempre (§6u): aquel
 * fichero cita `@walkingadventure/nucleo` por su nombre y no resuelve sin instalación, y
 * esta batería tiene que arrancar en un clon limpio. Que las dos listas digan lo mismo se
 * comprueba abajo, que es lo que impide que esta se quede atrás.
 */
const NUCLEO = Object.freeze({
  abreSalida: salidas.abreSalida,
  recibePosicion: salidas.recibePosicion,
  reconciliaConElRotulo: salidas.reconciliaConElRotulo,
  retomaLaSalida: salidas.retomaLaSalida,
  dejarloAqui: salidas.dejarloAqui,
  terminaDesdeElRotulo: salidas.terminaDesdeElRotulo,
  marcaElTelonComoLeido: salidas.marcaElTelonComoLeido,
  queOfreceAlAbrirLaApp: salidas.queOfreceAlAbrirLaApp,
  situacionDeSalida: salidas.situacionDeSalida,
  estadoDelRotulo: salidas.estadoDelRotulo,
  salidaEnCurso: salidas.salidaEnCurso,
  componeRotulo,
  disponibilidadDelRotulo: salidas.disponibilidadDelRotulo,
  creaDetectorDeTransporte,
  makeProjector,
  // SPEC-044: la cercanía a un geofence y la cadencia que sale de ella las decide el paquete.
  sitiosConPosicion,
  cadenciaDeMuestreo,
  CADENCIAS,
});

/**
 * El documento del mundo levantado del mapa activo, del que salen los geofences.
 *
 * Sus puntos están escritos **en metros del mundo y a mano**, elegidos contra el proyector de
 * `ORIGEN`: el núcleo cae exactamente donde aterriza `posicion(42.4010, -8.8100)`, el servicio
 * a veinte metros de él —dos geofences solapados, que es el caso del «más cercano»— y el
 * paraje a dos kilómetros, fuera de todo. Es lo que permite afirmar el sitio bajo la marca y
 * el cambio de cadencia sin ningún fixture de OSM.
 */
const MUNDO = Object.freeze({
  settlements: [
    { name: 'Monfrida', x: 0, y: 111, services: [{ name: 'A Taberna Pechada', x: 20, y: 111 }] },
  ],
  parajes: [{ name: 'O Torreón Esquecido', x: 2000, y: 0 }],
});

/** Un punto del mundo en grados, para dejar la marca del sensor donde se quiera. */
const EN_MONFRIDA = Object.freeze({ lat: 42.4010, lon: -8.8100 });

/**
 * Una suscripción de mentira, con el mismo contrato que la de `expo-location`.
 *
 * Lleva cuenta de todo lo que se le pidió —cuántas veces se arrancó, cuántas se paró— y
 * entrega las posiciones de una secuencia declarada. Es lo que permite afirmar «una sola
 * suscripción» y «cerrar retira la suscripción» sin ningún dispositivo.
 */
function suscripcionDoblada({ puntual = { lat: 42.40, lon: -8.81, tMs: T0, precisionM: 8 }, falla = null } = {}) {
  let ultima = null;
  let corriendo = false;
  const arranques = [];
  const paradas = [];
  // Las cadencias que la orquestación le ha pedido aplicar, en orden. Es lo que permite
  // afirmar que el muestreo cambia al entrar en un geofence **sobre el aparato** y no solo
  // sobre la función pura del paquete.
  const cadencias = [];
  return {
    arranques,
    paradas,
    cadencias,
    async aplicaCadencia(nueva) {
      const previa = cadencias.length ? cadencias[cadencias.length - 1].modo : 'por-distancia';
      cadencias.push(nueva);
      return nueva.modo !== previa;
    },
    async arranca(compuesto) { arranques.push(compuesto); corriendo = true; },
    async actualiza(compuesto) { arranques.push(compuesto); corriendo = true; },
    async para() { paradas.push(true); corriendo = false; },
    corriendo: () => corriendo,
    async sondeaPresencia() { return corriendo; },
    lee: () => (ultima ? { ...ultima } : null),
    async posicionPuntual() {
      if (falla) throw new Error(falla);
      return puntual;
    },
    /** Lo que hace el módulo nativo cuando el sensor entrega un fijo. */
    entrega(posicion) { ultima = posicion; },
  };
}

/** Una posición cruda del sensor, con los cuatro campos y ninguno más. */
function posicion(lat, lon, tMs, precisionM = 8) {
  return { lat, lon, tMs, precisionM };
}

/**
 * Los grados que corresponden a un punto del mundo. Es la vuelta de `toXY`, y se pide al
 * mismo proyector: una trigonometría paralela escrita aquí daría puntos que no cuadran con
 * el mundo congelado, que es justo lo que la cabecera del seguidor prohíbe.
 */
function gradosDe(proyector, punto) {
  return proyector.toLatLon(punto);
}

/** Abre una salida con todo cableado y devuelve las piezas para seguir tocándolas. */
async function abierta({ rotulo = rotuloQueFunciona(), suscripcion = suscripcionDoblada(), estado = estadoDeSalidas() } = {}) {
  const cambios = [];
  const laSalida = creaLaSalida({
    nucleo: NUCLEO,
    salidas: estado,
    rotulo,
    suscripcion,
    origen: ORIGEN,
    mundo: MUNDO,
    tramo: TRAMO_M,
    alCambiar: () => cambios.push(true),
  });
  const respuesta = await laSalida.abre({ salida: 's1', mapa: 'm1', mundo: 'Reinos da Brétema' });
  return { laSalida, respuesta, estado, rotulo, suscripcion, cambios };
}

// ── La cadena del sensor ────────────────────────────────────────────────────────

describe('La cadena del sensor: una suscripción, fuente, detector, seguidor', () => {
  test('Una salida abierta tiene una sola suscripción al sensor', async () => {
    // Dos —una para la fuente y otra para el seguidor— darían dos series de posiciones con
    // marcas distintas para el mismo instante, y la traza clasificada dejaría de cuadrar
    // con el plazo del rótulo sin que nada se pusiera rojo. Se afirma contando lo que el
    // módulo nativo recibe: una definición de tarea y un arranque.
    const definidas = [];
    const arrancadas = [];
    const suscripcion = creaSuscripcionDeUbicacion({
      Location: {
        Accuracy: { High: 4, Balanced: 3 },
        startLocationUpdatesAsync: async (tarea, opciones) => { arrancadas.push({ tarea, opciones }); },
        stopLocationUpdatesAsync: async () => {},
        hasStartedLocationUpdatesAsync: async () => arrancadas.length > 0,
        getCurrentPositionAsync: async () => ({ coords: { latitude: 42.40, longitude: -8.81, accuracy: 9 }, timestamp: T0 }),
      },
      TaskManager: { defineTask: (nombre, fn) => definidas.push({ nombre, fn }) },
      declaraTarea: exigeTareaDeclarada,
    });
    assert.equal(definidas.length, 1, 'la suscripción define más de una tarea');
    assert.equal(definidas[0].nombre, NOMBRE_DE_LA_TAREA);

    const { laSalida } = await abierta({ suscripcion: { ...suscripcion, ...suscripcionDoblada() } });
    // Y de esa única suscripción cuelgan las dos: la traza clasificada y el seguidor.
    assert.ok(laSalida.traza(), 'la salida abierta no tiene traza');
    assert.ok(laSalida.seguidor(), 'la salida abierta no tiene seguidor');

    // La cadena es una y va en orden: la fuente lee de la suscripción, el detector
    // clasifica y el seguidor proyecta. Saltarse el detector partiría en dos una decisión
    // que el núcleo ya toma, y es justo lo que la cabecera del seguidor prohíbe.
    const codigo = fuente('app/marcha/salida.js');
    assert.match(codigo, /creaFuenteDePosiciones\(\{ lee: \(\) => suscripcion\.lee\(\) \}\)/);
    assert.match(codigo, /detector = nucleo\.creaDetectorDeTransporte\(\)/);
    assert.match(codigo, /creaTrazaDeSalida\(\{ fuente, detector \}\)/);
    assert.match(codigo, /creaSeguidorDeLaSalida\(\{ fuente, traza, origen, nucleo, sitios \}\)/);
  });

  test('El servicio en primer plano se pide por distancia y con la precisión que el detector necesita', () => {
    // Dos números con motivo escrito, y los dos son decisiones de esta fila: **por
    // distancia** porque lo que se mide son metros propios, y **precisión alta** porque
    // `transporte.js` no funda un vehículo con un error mayor del que entrega la
    // equilibrada. Con la equilibrada, ningún segmento saldría nunca `vehiculo` y la
    // detección de transporte quedaría escrita y muerta.
    const arrancadas = [];
    const suscripcion = creaSuscripcionDeUbicacion({
      Location: {
        Accuracy: { High: 4, Balanced: 3 },
        startLocationUpdatesAsync: async (tarea, opciones) => { arrancadas.push(opciones); },
        stopLocationUpdatesAsync: async () => {},
      },
      TaskManager: { defineTask: () => {} },
      declaraTarea: exigeTareaDeclarada,
    });
    return suscripcion.arranca(componeRotulo({ destino: null, mundo: 'Reinos da Brétema' })).then(() => {
      const opciones = arrancadas[0];
      assert.equal(opciones.distanceInterval, CADENCIA_M, 'la cadencia no va por distancia');
      assert.equal(opciones.timeInterval, undefined, 'hay una cadencia por tiempo: gasta batería en línea recta sin aportar nada');
      assert.equal(opciones.accuracy, 4, 'la precisión no es la alta, y con la equilibrada el detector no funda un vehículo nunca');
      // La notificación del servicio **es** el rótulo, y su línea llega compuesta por el
      // núcleo: esta capa no escribe ni una palabra de lo que se lee en la pantalla de
      // bloqueo, que es lo que impide que iOS y Android digan cosas distintas.
      assert.equal(opciones.foregroundService.notificationTitle, NOMBRE_DE_LA_APP);
      assert.equal(opciones.foregroundService.notificationBody, componeRotulo({ destino: null, mundo: 'Reinos da Brétema' }).linea);
      assert.equal(opciones.foregroundService.killServiceOnDestroy, false, 'el servicio muere al cerrar la app: entonces no sostiene nada');
    });
  });

  test('Una posición del sensor entra con cuatro campos y ninguno más', () => {
    // «Se lee y se tira», en el punto de entrada y no más adelante: lo que devuelve el
    // módulo nativo trae rumbo, altitud y velocidad, y de aquí salen cuatro números. Lo
    // que no entra no se puede guardar por descuido.
    let entrega;
    const suscripcion = creaSuscripcionDeUbicacion({
      Location: { Accuracy: {}, startLocationUpdatesAsync: async () => {}, stopLocationUpdatesAsync: async () => {} },
      TaskManager: { defineTask: (_, fn) => { entrega = fn; } },
      declaraTarea: exigeTareaDeclarada,
    });
    entrega({
      data: {
        locations: [{
          coords: { latitude: 42.4012, longitude: -8.8114, accuracy: 7.5, altitude: 133, heading: 271, speed: 1.3, altitudeAccuracy: 3 },
          timestamp: T0 + 500.6,
          mocked: true,
        }],
      },
    });
    const leida = suscripcion.lee();
    assert.deepEqual(Object.keys(leida).sort(), ['lat', 'lon', 'precisionM', 'tMs']);
    assert.equal(leida.lat, 42.4012);
    assert.equal(leida.tMs, T0 + 501, 'la marca del sensor no se redondea, y una marca con decimales no compara igual');
    assert.equal(leida.precisionM, 7.5);
  });

  test('Una lectura sin precisión declarada va a null y nunca a cero', () => {
    // Cero es precisión perfecta, y una lectura sin precisión declarada es lo contrario:
    // no se sabe. Confundirlas haría que el detector fundara vehículos sobre fijos malos.
    let entrega;
    const suscripcion = creaSuscripcionDeUbicacion({
      Location: { Accuracy: {}, startLocationUpdatesAsync: async () => {}, stopLocationUpdatesAsync: async () => {} },
      TaskManager: { defineTask: (_, fn) => { entrega = fn; } },
      declaraTarea: exigeTareaDeclarada,
    });
    entrega({ data: { locations: [{ coords: { latitude: 42.4, longitude: -8.8 }, timestamp: T0 }] } });
    assert.equal(suscripcion.lee().precisionM, null);
    entrega({ data: { locations: [{ coords: { latitude: 42.4, longitude: -8.8, accuracy: null }, timestamp: T0 + 1 }] } });
    assert.equal(suscripcion.lee().precisionM, null);
  });

  test('De todas las posiciones que pasan por la suscripción sobrevive una', () => {
    // Este es el momento del juego por el que más posiciones pasan, y lo que queda de
    // todas ellas es la última, en memoria, sobrescrita por la siguiente. No hay lista,
    // no hay `push` y no hay nada que serializar.
    let entrega;
    const suscripcion = creaSuscripcionDeUbicacion({
      Location: { Accuracy: {}, startLocationUpdatesAsync: async () => {}, stopLocationUpdatesAsync: async () => {} },
      TaskManager: { defineTask: (_, fn) => { entrega = fn; } },
      declaraTarea: exigeTareaDeclarada,
    });
    for (let i = 0; i < 100; i += 1) {
      entrega({ data: { locations: [{ coords: { latitude: 42.4 + i / 10000, longitude: -8.81, accuracy: 8 }, timestamp: T0 + i * 1000 }] } });
    }
    assert.deepEqual(suscripcion.lee(), { lat: 42.4 + 99 / 10000, lon: -8.81, tMs: T0 + 99000, precisionM: 8 });
    // Y la superficie no ofrece ninguna manera de pedir lo anterior: no se puede leer un
    // histórico que no existe, pero tampoco puede existir una operación que lo prometa.
    for (const nombre of Object.keys(suscripcion)) {
      assert.doesNotMatch(nombre, /historico|todas|recorrido|traza/i, `la suscripción ofrece "${nombre}", que suena a histórico`);
    }
  });

  test('La posición llega al seguidor ya clasificada', async () => {
    // La clasificación la produce el detector del núcleo y **no** la app. El seguidor
    // entrega `{clasificacion, x, y, sitio}` y comprueba el vocabulario: una posición sin
    // clasificar o con una palabra inventada falla al leerse y no al pintarse.
    const suscripcion = suscripcionDoblada();
    const { laSalida } = await abierta({ suscripcion });
    suscripcion.entrega(posicion(42.4010, -8.8100, T0 + 8000));
    await laSalida.recibeLaPosicion();
    const leida = laSalida.seguidor().posicion();
    assert.deepEqual(Object.keys(leida).sort(), ['clasificacion', 'sitio', 'x', 'y']);
    assert.ok(CLASIFICACIONES.includes(leida.clasificacion), `el seguidor ha entregado "${leida.clasificacion}"`);
    // Con un solo fijo todavía no hay segmento, y entonces se cuenta ambiguo y no parada:
    // `ritmo.js` cuenta lo ambiguo a favor de quien anda, y la asimetría de
    // `accesibilidad.md` dice hacia qué lado se falla.
    assert.equal(leida.clasificacion, SIN_SEGMENTO_TODAVIA);
    // Y los metros son los del mundo, proyectados por `geo.js` y no por una trigonometría
    // paralela: una conversión propia daría puntos que no cuadran con el mundo congelado.
    const esperado = makeProjector(ORIGEN.lat, ORIGEN.lon).toXY(42.4010, -8.8100);
    assert.equal(leida.x, esperado.x);
    assert.equal(leida.y, esperado.y);
    // Y el sitio se **resuelve**, que es lo que esta fila trae: hasta SPEC-044 el cuarto
    // campo iba a `null` por construcción y nada se ponía rojo el día que la fila que tenía
    // que rellenarlo se olvidara (§8b). La marca cae encima de «Monfrida», así que su
    // nombre es la respuesta.
    assert.equal(leida.sitio, 'Monfrida');
  });

  test('El sitio del seguidor no es nulo por construcción', async () => {
    // La red de §8b, en la forma que §6p le dio al `anclaje: null`: no basta con que hoy
    // salga bien en un punto elegido, hace falta algo que se ponga **rojo** el día que el
    // campo vuelva a ser estructuralmente nulo. Se recorre el índice entero del mapa activo
    // y se exige que el centro de cada geofence nombre a su sitio: si alguien devuelve
    // `null` por construcción, esto cae en el primero.
    const sitios = sitiosConPosicion(MUNDO);
    assert.ok(sitios.size >= 2, 'el mundo de esta prueba no tiene geofences suficientes para que la afirmación mida nada');
    const proyector = makeProjector(ORIGEN.lat, ORIGEN.lon);
    const suscripcion = suscripcionDoblada();
    const { laSalida } = await abierta({ suscripcion });
    assert.equal(laSalida.geofences()?.size, sitios.size, 'la salida no monta el índice de geofences del mapa activo');

    for (const [nombre, geofence] of sitios) {
      // Se busca en grados el punto que proyecta al centro del geofence, que es lo único
      // que el sensor sabe entregar: la proyección cuantiza y una vuelta cruda no cuadraría.
      const grados = gradosDe(proyector, geofence);
      suscripcion.entrega(posicion(grados.lat, grados.lon, T0 + 20_000));
      await laSalida.recibeLaPosicion();
      const leida = laSalida.seguidor().posicion();
      assert.equal(leida.sitio, nombre, `parada en el centro de "${nombre}" y el seguidor dice ${JSON.stringify(leida.sitio)}`);
    }

    // Fuera de todos los geofences sí es `null`, y ahí es la respuesta honesta: no es que
    // no se haya consultado, es que no hay ninguno debajo.
    suscripcion.entrega(posicion(42.4300, -8.8500, T0 + 60_000));
    await laSalida.recibeLaPosicion();
    assert.equal(laSalida.seguidor().posicion().sitio, null);

    // Y por contrato: montarlo sin el índice **falla nombrando lo que falta**, en vez de
    // entregar `sitio: null` como antes. Es lo que cierra la puerta en lugar de vigilarla.
    assert.throws(
      () => creaLaSalida({ nucleo: NUCLEO, salidas: estadoDeSalidas(), rotulo: rotuloQueFunciona(), origen: ORIGEN, suscripcion: suscripcionDoblada() }),
      /índice de geofences/,
    );
    assert.throws(
      () => creaSeguidorDeLaSalida({ fuente: { posicion: () => null }, traza: { muestrea: () => null, traza: () => ({ segmentos: [] }) }, origen: ORIGEN, nucleo: NUCLEO }),
      /sitiosConPosicion/,
    );

    // Y no queda en el módulo ningún camino que devuelva el sitio nulo sin haber mirado un
    // geofence: el único `sitio:` que se escribe sale de `sitioEn(...)`.
    const codigo = fuente('app/marcha/seguidor.js')
      .split('\n')
      .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
      .join('\n');
    const asignaciones = codigo.match(/sitio:\s*[^,\n]+/g) ?? [];
    assert.deepEqual(
      asignaciones.filter((a) => /null\s*$/.test(a) && !/\?\?/.test(a)),
      [],
      `el seguidor vuelve a tener un camino que entrega el sitio nulo por construcción: ${JSON.stringify(asignaciones)}`,
    );
  });

  test('El seguidor rechaza una posición sin clasificar en lugar de pintarla', () => {
    // La otra mitad del contrato: el seguidor no clasifica, así que si lo que le llega no
    // viene clasificado tiene que decirlo. Una posición cruda pintada como si estuviera
    // clasificada haría avanzar el mundo con los kilómetros de un tren.
    const seguidor = creaSeguidorDePosicion({ lee: () => ({ clasificacion: 'a-pie', x: 1, y: 2 }) });
    assert.throws(() => seguidor.posicion(), /la traza llega clasificada, no cruda/);
    assert.throws(() => creaSeguidorDePosicion({}), /sin él el mapa enseñaría la marca quieta/);
  });

  test('Tras una interrupción la traza se vuelve a anclar', async () => {
    // Coser el hueco haría que una hora en un bar contara como quietud medida, o que ocho
    // kilómetros en coche parecieran un paseo. `transporte.js` declara el hueco máximo y
    // aquí se comprueba desde la app: dos lecturas separadas por más que ese hueco no
    // forman segmento entre sí.
    const suscripcion = suscripcionDoblada();
    const { laSalida } = await abierta({ suscripcion });
    suscripcion.entrega(posicion(42.4010, -8.8100, T0 + 1000));
    await laSalida.recibeLaPosicion();
    const antes = laSalida.traza().traza().segmentos.length;
    suscripcion.entrega(posicion(42.4011, -8.8101, T0 + 1000 + (HUECO_MAXIMO_S + 60) * 1000));
    await laSalida.recibeLaPosicion();
    assert.equal(
      laSalida.traza().traza().segmentos.length,
      antes,
      'la primera posición después de la interrupción ha formado segmento con la última de antes',
    );
  });

  test('Una salida que se cierra deja el sensor sin nadie leyendo', async () => {
    const suscripcion = suscripcionDoblada();
    const { laSalida } = await abierta({ suscripcion });
    assert.equal(suscripcion.paradas.length, 0);
    await laSalida.dejarloAqui();
    assert.equal(suscripcion.paradas.length, 1, 'cerrar la salida no ha parado la suscripción');
    assert.equal(laSalida.traza(), null, 'la traza sigue montada con el sensor parado: mediría un hueco como si fuera quietud');
    assert.equal(laSalida.seguidor(), null);
    // Y desmontar la pantalla de marcha hace lo mismo sin tocar la salida.
    const otra = await abierta();
    await otra.laSalida.para();
    assert.equal(otra.suscripcion.paradas.length, 1);
    assert.equal(otra.laSalida.situacion(), 'abierta-con-rotulo', 'desmontar la pantalla ha cerrado la salida');
  });

  test('Sin el detector de transporte la salida no se monta, y lo dice nombrándolo', () => {
    // Lo que falta se exige, y su ausencia es error de construcción y nunca un valor por
    // defecto: una traza con todo por andando haría avanzar el mundo con un autobús.
    const sinDetector = { ...NUCLEO };
    delete sinDetector.creaDetectorDeTransporte;
    assert.throws(
      () => creaLaSalida({ nucleo: sinDetector, salidas: estadoDeSalidas(), rotulo: rotuloQueFunciona() }),
      /creaDetectorDeTransporte/,
    );
    assert.throws(() => creaLaSalida({ salidas: estadoDeSalidas(), rotulo: rotuloQueFunciona() }), /necesita el núcleo inyectado/);
    assert.throws(() => creaLaSalida({ nucleo: NUCLEO, salidas: estadoDeSalidas() }), /se monta con el rótulo del sistema/);
  });

  test('Lo que la vida de una salida le pide al núcleo está enumerado y es lo mismo que se le inyecta', () => {
    // La regla de SPEC-020 (§6u), repetida en siete filas: el generador entra por la
    // puerta y enumerado. Que la lista de `app/nucleo/piezas.js` y la de `salida.js` digan
    // lo mismo se comprueba leyendo la fuente, porque `piezas.js` cita el paquete por su
    // nombre y no resuelve sin instalación.
    const piezas = fuente('app/nucleo/piezas.js');
    const bloque = piezas.slice(piezas.indexOf('export const NUCLEO_DE_LA_SALIDA'));
    for (const nombre of DEL_NUCLEO) {
      assert.match(bloque, new RegExp(`\\b${nombre}\\b`), `NUCLEO_DE_LA_SALIDA no inyecta "${nombre}", que salida.js enumera`);
      assert.ok(NUCLEO[nombre], `el núcleo de esta prueba no trae "${nombre}"`);
    }
  });
});

// ── La vida de una salida, cableada ─────────────────────────────────────────────

describe('Echarse a andar puede no poder, y entonces se dice por qué', () => {
  test('Los motivos por los que una salida no se abre son un vocabulario cerrado', async () => {
    assert.deepEqual([...MOTIVOS_DE_NO_ABRIR], [
      'rotulo-no-montado', 'rotulo-no-disponible', 'permiso-denegado',
      'permiso-no-preguntable', 'sensor-sin-responder', 'ya-hay-salida', 'telon-pendiente',
      // `llegadas-sin-cablear` entra con SPEC-044, y este caso se puso rojo al añadirlo: eso
      // es exactamente para lo que existe un vocabulario cerrado, que ampliarlo sea un acto
      // con registro y no un motivo más que aparece en pantalla sin que nadie lo haya visto.
      'llegadas-sin-cablear',
    ]);

    // Y el motivo nuevo **se puede alcanzar**, que es la mitad que una lista no dice: una
    // capa de llegadas que no se puede montar deja la salida sin abrir con su motivo
    // literal, en vez de abrirla para andar por un mapa donde no puede pasar nada.
    const suscripcion = suscripcionDoblada();
    const laSalida = creaLaSalida({
      nucleo: NUCLEO,
      salidas: estadoDeSalidas(),
      rotulo: rotuloQueFunciona(),
      suscripcion,
      origen: ORIGEN,
      mundo: MUNDO,
      tramo: TRAMO_M,
      montaLlegadas: () => { throw new Error('la capa de descartes necesita el cupo que la celda congeló al generarse'); },
    });
    const respuesta = await laSalida.abre({ salida: 's1', mapa: 'm1', mundo: 'Reinos da Brétema' });
    assert.equal(respuesta.abierta, false, 'la salida se abrió con la capa de llegadas sin montar');
    assert.equal(respuesta.marca, 'llegadas-sin-cablear');
    assert.match(respuesta.motivo, /cupo/, 'el motivo no lleva dentro lo que falló al montar la capa');
    assert.equal(laSalida.situacion(), 'sin-salida', 'ha quedado una salida a medias en el área de la partida');
    assert.equal(suscripcion.paradas.length, 1, 'la salida no se abrió y el servicio se ha quedado corriendo detrás');
    assert.equal(laSalida.llegadasSinCablear(), respuesta.motivo, 'el motivo no queda a mano para el momento en marcha');
  });

  test('Sin rótulo no se abre ninguna salida, y «no montado» se distingue de «no disponible»', async () => {
    // Son dos problemas que se arreglan en sitios distintos: el primero es una compilación
    // sin el módulo —hoy, iOS— y el segundo el sistema que no deja usarlo. Abrirla igual
    // significaría o perder la ubicación a los pocos minutos o pedir el permiso permanente.
    const sinMontar = await abierta({ rotulo: rotuloSinMontar() });
    assert.equal(sinMontar.respuesta.abierta, false);
    assert.equal(sinMontar.respuesta.marca, 'rotulo-no-montado');
    assert.ok(sinMontar.respuesta.motivo);
    assert.equal(sinMontar.laSalida.situacion(), 'sin-salida');

    const noDisponible = await abierta({ rotulo: rotuloNoDisponible() });
    assert.equal(noDisponible.respuesta.abierta, false);
    assert.equal(noDisponible.respuesta.marca, 'rotulo-no-disponible');
    assert.equal(noDisponible.laSalida.situacion(), 'sin-salida');
  });

  test('Sin permiso de ubicación no se abre ninguna salida', async () => {
    // El módulo lanza cuando no hay permiso, y aquí se distingue de «no ha dado fijo
    // todavía»: el primero se arregla en los ajustes del sistema y el segundo esperando.
    // Sin punto de partida la salida no podría cerrarse nunca por regreso, así que abrirla
    // sería dejarla abierta para siempre.
    const denegado = await abierta({ suscripcion: suscripcionDoblada({ falla: 'Location permission is required' }) });
    assert.equal(denegado.respuesta.abierta, false);
    assert.equal(denegado.respuesta.marca, 'permiso-denegado');
    assert.match(denegado.respuesta.motivo, /sin punto de partida no hay regreso que detectar/);

    const sinFijo = await abierta({ suscripcion: suscripcionDoblada({ puntual: null }) });
    assert.equal(sinFijo.respuesta.abierta, false);
    assert.equal(sinFijo.respuesta.marca, 'sensor-sin-responder');
  });

  test('Con una salida ya abierta, abrir otra falla nombrando la que sigue abierta', async () => {
    const { laSalida, estado } = await abierta();
    const otra = await laSalida.abre({ salida: 's2', mapa: 'm1', mundo: 'Reinos da Brétema' });
    assert.equal(otra.abierta, false);
    assert.equal(otra.marca, 'ya-hay-salida');
    assert.match(otra.motivo, /s1/);
    assert.equal(salidas.situacionDeSalida(estado), 'abierta-con-rotulo', 'la salida anterior ha quedado sustituida');
  });

  test('Con un telón sin leer, abrir otra salida falla nombrando el telón pendiente', async () => {
    const { laSalida } = await abierta();
    await laSalida.dejarloAqui();
    assert.equal(laSalida.queOfrece(), 'telon');
    const otra = await laSalida.abre({ salida: 's2', mapa: 'm1', mundo: 'Reinos da Brétema' });
    assert.equal(otra.abierta, false);
    assert.equal(otra.marca, 'telon-pendiente');
    // Y el telón se marca leído con una acción explícita, nunca por el paso de nada.
    laSalida.marcaElTelonComoLeido();
    assert.equal(laSalida.queOfrece(), 'portada');
    const tercera = await laSalida.abre({ salida: 's2', mapa: 'm1', mundo: 'Reinos da Brétema' });
    assert.equal(tercera.abierta, true);
  });

  test('Una salida que no se abre no deja el servicio corriendo detrás', async () => {
    // Si el núcleo se niega después de haber arrancado el servicio, lo que no puede quedar
    // es un rótulo puesto sin salida que lo sostenga: nadie lo retiraría nunca.
    const { laSalida, suscripcion } = await abierta();
    const arranquesAntes = suscripcion.arranques.length;
    await laSalida.abre({ salida: 's2', mapa: 'm1', mundo: 'Reinos da Brétema' });
    assert.equal(suscripcion.arranques.length, arranquesAntes + 1, 'el segundo intento no llegó a arrancar el servicio');
    assert.ok(suscripcion.paradas.length >= 1, 'el intento fallido dejó el servicio corriendo');
  });

  test('El rótulo se retira pero la salida no se cierra', async () => {
    // El plazo se cumple sin un solo metro propio: el rótulo se retira, el sensor se para
    // —retirado el rótulo no hay permiso «mientras se usa» que sostenga seguir leyendo— y
    // la salida **sigue abierta**, con sus dos acciones esperando en la portada.
    const suscripcion = suscripcionDoblada();
    const { laSalida, rotulo } = await abierta({ suscripcion });
    suscripcion.entrega(posicion(42.40, -8.81, T0 + PLAZO_DE_RETIRADA_MS + 1000));
    const paso = await laSalida.recibeLaPosicion();
    assert.equal(paso.retirada, 'plazo');
    assert.equal(paso.cierre, null);
    assert.equal(laSalida.situacion(), 'abierta-sin-rotulo');
    assert.equal(laSalida.estadoDelRotulo(), 'retirado-por-plazo');
    assert.equal(rotulo.cuentas().retiradas, 1);
    assert.equal(suscripcion.paradas.length, 1, 'el rótulo se retiró y el sensor sigue leyendo');
    assert.equal(laSalida.queOfrece(), 'a-medias');

    // Y «seguir con ella» vuelve a poner el rótulo, con el plazo contando de nuevo. Es una
    // acción explícita y nunca una detección: sin rótulo no hay con qué enterarse.
    const vuelta = await laSalida.retoma();
    assert.equal(vuelta.retomada, true);
    assert.equal(laSalida.situacion(), 'abierta-con-rotulo');
    assert.equal(rotulo.cuentas().puestas, 2);
  });

  test('Volver a casa en autobús echa el telón igual', async () => {
    // El regreso no consulta la clasificación: volver es volver, y quien vuelve en autobús
    // ha vuelto. Se aleja lo declarado, vuelve y permanece; la salida se cierra y el rótulo
    // queda retirado **en la misma transición**.
    const suscripcion = suscripcionDoblada();
    const { laSalida, rotulo } = await abierta({ suscripcion });
    // Lejos: dos kilómetros al norte, muy por encima del alejamiento de un tramo de 1200 m.
    suscripcion.entrega(posicion(42.42, -8.81, T0 + 60_000));
    await laSalida.recibeLaPosicion();
    // De vuelta, y quieto el tiempo de permanencia.
    suscripcion.entrega(posicion(42.40, -8.81, T0 + 120_000));
    await laSalida.recibeLaPosicion();
    suscripcion.entrega(posicion(42.40, -8.81, T0 + 600_000));
    const paso = await laSalida.recibeLaPosicion();
    assert.equal(paso.haVuelto, true);
    assert.ok(paso.cierre, 'volver no ha cerrado la salida');
    assert.equal(laSalida.situacion(), 'cerrada-sin-leer');
    assert.equal(laSalida.estadoDelRotulo(), 'retirado-por-cierre');
    assert.equal(rotulo.cuentas().retiradas, 1);
    assert.equal(suscripcion.paradas.length, 1);
  });

  test('Se puede cerrar la salida desde el rótulo del sistema', async () => {
    const { laSalida, rotulo, suscripcion } = await abierta();
    const cerrada = await laSalida.terminaDesdeElRotulo();
    // Se cierra **exactamente igual que si hubiera vuelto, salvo el motivo anotado**.
    assert.equal(cerrada.salida.motivo, 'a-mano-desde-el-rotulo', 'el motivo anotado no distingue el cierre desde el rótulo');
    // Y lo que el cierre **no** hace, que es la mitad que importa: no notifica, no se pone
    // en primer plano y no pide confirmación. El telón se echa solo y espera.
    assert.deepEqual(
      { notifica: cerrada.notifica, ponePrimerPlano: cerrada.ponePrimerPlano, pideConfirmacion: cerrada.pideConfirmacion },
      { notifica: false, ponePrimerPlano: false, pideConfirmacion: false },
    );
    assert.equal(laSalida.situacion(), 'cerrada-sin-leer');
    assert.equal(rotulo.cuentas().retiradas, 1);
    assert.equal(suscripcion.paradas.length, 1);
  });

  test('Una salida abierta se reconcilia con lo que de verdad hay en la pantalla de bloqueo', async () => {
    // El riesgo 4 del PRD: en Android el sistema mata el servicio y devuelve el proceso, y
    // lo que esta capa recordaba haber hecho no vale nada. Reconciliar es preguntar y
    // corregir, no confiar.
    const suscripcion = suscripcionDoblada();
    const rotulo = rotuloQueSeRetiraSolo();
    const { laSalida, estado } = await abierta({ suscripcion, rotulo });
    // El sistema se lo lleva. **No avisa a nadie**: solo deja de estar, y por eso la única
    // manera de enterarse es preguntar.
    rotulo.caduca();
    suscripcion.corriendo = () => false;
    suscripcion.sondeaPresencia = async () => false;
    const resultado = await laSalida.reconcilia();
    assert.equal(resultado.corregido, true, 'la salida sigue creyéndose sostenida por un servicio que ya no está');
    assert.equal(salidas.situacionDeSalida(estado), 'abierta-sin-rotulo');
    assert.equal(laSalida.estadoDelRotulo(), 'retirado-por-el-sistema');
  });

  test('Al reabrir la app con una salida abierta, la traza se vuelve a montar sin coser lo andado', async () => {
    // La otra mitad de reconciliar, y la que se descubre al reabrir: el servicio sigue
    // puesto y la traza no existe, porque murió con el proceso anterior. Sin volver a
    // montarla, el momento en marcha enseñaría la avería del seguidor teniendo el sensor
    // entero detrás. Empieza de cero a propósito: lo andado antes del cierre del proceso
    // no le pertenece a nadie.
    const suscripcion = suscripcionDoblada();
    // El rótulo sobrevive al proceso —es una notificación del sistema, no un objeto de la
    // app—, así que la sesión nueva se monta sobre el mismo y lo encuentra puesto.
    const rotulo = rotuloQueFunciona();
    const { estado } = await abierta({ suscripcion, rotulo });
    const otraSesion = creaLaSalida({ nucleo: NUCLEO, salidas: estado, rotulo, suscripcion, origen: ORIGEN, mundo: MUNDO, tramo: TRAMO_M });
    assert.equal(otraSesion.seguidor(), null, 'la sesión nueva nace con seguidor sin haber reconciliado');
    await otraSesion.reconcilia();
    assert.ok(otraSesion.seguidor(), 'reabrir con una salida abierta deja el momento en marcha sin seguidor');
    assert.deepEqual(otraSesion.traza().traza().segmentos, [], 'la traza de la sesión nueva arrastra lo andado en la anterior');
  });
});

// ── Privacidad, que aquí es bloqueante ──────────────────────────────────────────

describe('El rastro de ubicación no se guarda nunca', () => {
  test('El rastro de ubicación no se guarda nunca', async () => {
    // Cien posiciones por el servicio en primer plano, y lo que sobrevive en el documento
    // es **un punto y dos marcas**: los tres son de SPEC-030, los tres están declarados en
    // `AREA_SALIDAS` y los tres son necesarios —sin el punto no se detecta el regreso
    // después de que el sistema mate el proceso, y sin las marcas no hay plazo que medir—.
    // Lo que la promesa protege de verdad es que no haya traza, histórico ni lista que
    // crezca con lo andado: un punto no es un rastro.
    const suscripcion = suscripcionDoblada();
    const { laSalida, estado } = await abierta({ suscripcion });
    for (let i = 1; i <= 100; i += 1) {
      suscripcion.entrega(posicion(42.4000 + i / 100000, -8.8100 + i / 100000, T0 + i * 8000));
      await laSalida.recibeLaPosicion();
    }
    assert.equal(laSalida.situacion(), 'abierta-con-rotulo', 'la salida se cerró a mitad y la medición no vale');

    const documento = congelaSalidas(estado);
    const texto = JSON.stringify(documento);
    // Ni una lista con cien de nada. Se cuenta sobre el documento entero y no sobre un
    // campo concreto: un histórico nuevo entraría por un campo que esta prueba no conoce.
    const listasLargas = [];
    const recorre = (valor, ruta) => {
      if (Array.isArray(valor)) {
        if (valor.length > 4) listasLargas.push(`${ruta} (${valor.length})`);
        valor.forEach((v, i) => recorre(v, `${ruta}[${i}]`));
      } else if (valor && typeof valor === 'object') {
        for (const [k, v] of Object.entries(valor)) recorre(v, `${ruta}.${k}`);
      }
    };
    recorre(documento, 'salidas');
    assert.deepEqual(listasLargas, [], `el documento de la salida guarda listas que crecen con lo andado: ${listasLargas.join(', ')}`);

    // Las coordenadas escritas son exactamente una: el punto de partida.
    const coordenadas = [...texto.matchAll(/"(lat|lon)":\s*(-?\d+(?:\.\d+)?)/g)].map((m) => `${m[1]}=${m[2]}`);
    assert.deepEqual(coordenadas.sort(), ['lat=42.4', 'lon=-8.81'], `el documento guarda más coordenadas que el punto de partida: ${coordenadas.join(', ')}`);

    // Y las marcas del sensor son **las declaradas y ninguna más**. Son tres y no dos, y
    // conviene decirlo con precisión porque la spec dice dos: `ultimoPropioMs` y
    // `ultimaMarcaMs` son las que miden el plazo, y `regreso.dentroDesdeMs` es el reloj de
    // permanencia de `partida/regreso.js` —desde cuándo se está dentro del radio de casa—,
    // que también es de SPEC-030, también está declarado en el esquema y vale `null`
    // mientras se anda lejos. La propiedad que importa no es que sean dos: es que el
    // conjunto sea **cerrado y pequeño**, y que una cuarta ponga esto rojo.
    const marcas = [...new Set([...texto.matchAll(/"(\w*[Mm]s)":/g)].map((m) => m[1]))].sort();
    assert.deepEqual(marcas, ['dentroDesdeMs', 'ultimaMarcaMs', 'ultimoPropioMs'], `el documento guarda marcas de tiempo que el esquema no declara: ${marcas.join(', ')}`);

    // El documento va y vuelve sin traer nada de más: lo que se levanta es lo que se
    // escribió, y una traza escondida aparecería aquí.
    assert.deepEqual(congelaSalidas(levantaSalidas(documento)), documento);
  });

  test('El punto de partida y las marcas mueren con la salida', async () => {
    // La otra mitad de la promesa: lo que se guarda **nunca es más de una salida**. Se
    // recorren tres seguidas y se comprueba que el documento solo contiene la última: no
    // hay lista de salidas, no hay historial de puntos de partida y el de ayer no está.
    //
    // Y una precisión medida que conviene dejar escrita, porque el criterio la nombra con
    // otras palabras: entre marcar el telón como leído y abrir la siguiente, **el punto de
    // la anterior sigue escrito**, con la salida en `cerrada-leida`. El criterio dice «se
    // abre otra» y con eso se cumple, así que aquí se afirma el criterio; que el residuo
    // dure hasta la salida siguiente en lugar de hasta el telón es una diferencia real y
    // pequeña, y queda dicha en vez de disimulada.
    const suscripcion = suscripcionDoblada();
    const { laSalida, estado } = await abierta({ suscripcion });
    const puntos = [];
    for (let i = 0; i < 3; i += 1) {
      const texto = JSON.stringify(congelaSalidas(estado));
      puntos.push([...texto.matchAll(/"lat":\s*(-?\d+(?:\.\d+)?)/g)].length);
      await laSalida.dejarloAqui();
      laSalida.marcaElTelonComoLeido();
      suscripcion.entrega(null);
      await laSalida.abre({ salida: `s${i + 2}`, mapa: 'm1', mundo: 'Reinos da Brétema' });
    }
    assert.deepEqual(puntos, [1, 1, 1], 'el documento acumula puntos de partida de salidas anteriores');

    // Y con la última salida cerrada y su telón leído, lo que queda es una salida y no un
    // historial: un solo registro, con un solo punto y sus marcas.
    await laSalida.dejarloAqui();
    laSalida.marcaElTelonComoLeido();
    const documento = congelaSalidas(estado);
    assert.deepEqual(Object.keys(documento), ['salida'], 'el documento de salidas guarda algo más que la última salida');
    assert.equal([...JSON.stringify(documento).matchAll(/"lat":/g)].length, 1);
  });

  test('El seguidor no tiene ninguna operación que devuelva un histórico', async () => {
    // No basta con que no se guarde: no puede existir una superficie que lo prometa. Lo que
    // el seguidor ofrece es la última posición y nada más.
    const { laSalida } = await abierta();
    assert.deepEqual(Object.keys(laSalida.seguidor()).sort(), ['montado', 'motivo', 'posicion']);
    const codigo = fuente('app/marcha/seguidor.js');
    assert.doesNotMatch(codigo, /\.push\(/, 'el seguidor acumula algo en una lista');
  });

  test('Los módulos de ubicación y de rótulo no generan ningún identificador por instalación', () => {
    // Ni anónimo ni de depuración: RF-PRIV-002 no admite un identificador «solo para
    // saber cuántos somos», y con servicio en primer plano el sitio donde aparecería es
    // justo este.
    for (const modulo of ['app/plataforma/posiciones.js', 'app/plataforma/ubicacion.js', 'app/plataforma/rotulo.android.js', 'app/plataforma/rotulo.ios.js', 'app/marcha/salida.js', 'app/marcha/seguidor.js', 'app/marcha/salida-montada.js']) {
      const codigo = fuente(modulo).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const patron of [/randomUUID/, /getRandomValues/, /installationId/i, /deviceId/i, /\binstalacion\b/i, /Math\.random\s*\(/]) {
        assert.doesNotMatch(codigo, patron, `${modulo} genera o lee un identificador por instalación (${patron})`);
      }
    }
  });

  test('Nada de esta fila pide el permiso de ubicación permanente', () => {
    // El único que se llama es `requestForegroundPermissionsAsync`. Se busca sobre el
    // código sin comentarios porque los módulos explican precisamente por qué **no** piden
    // el permanente, y buscar la palabra convertiría la explicación en un fallo.
    for (const modulo of ['app/plataforma/ubicacion.js', 'app/plataforma/posiciones.js', 'app/marcha/salida.js', 'app/marcha/salida-montada.js', 'app/pantallas/arranque-montado.jsx']) {
      const codigo = fuente(modulo).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      assert.doesNotMatch(codigo, /requestBackgroundPermissionsAsync/, `${modulo} pide el permiso de ubicación permanente`);
      assert.doesNotMatch(codigo, /ACCESS_BACKGROUND_LOCATION/, `${modulo} nombra el permiso permanente`);
    }
    assert.match(fuente('app/plataforma/ubicacion.js'), /requestForegroundPermissionsAsync/);
  });

  test('El paquete compartido sigue sin saber que existe Expo', () => {
    // La frontera del núcleo, que es la red de seguridad del determinismo: un import de
    // `expo-location` en el paquete dejaría la batería sin poder correr en Node.
    for (const modulo of ['packages/nucleo/partida/salidas.js', 'packages/nucleo/partida/rotulo.js', 'packages/nucleo/partida/transporte.js', 'packages/nucleo/core/geo.js']) {
      const codigo = fuente(modulo);
      for (const patron of [/from 'expo/, /from 'react-native/, /expo-location/, /expo-task-manager/]) {
        assert.doesNotMatch(codigo, patron, `${modulo} importa algo de la plataforma`);
      }
    }
  });
});

// ── Determinismo ────────────────────────────────────────────────────────────────

describe('La misma secuencia de posiciones dos veces da lo mismo', () => {
  test('Dos recorridos idénticos dan la misma traza, el mismo plazo y el mismo cierre', async () => {
    const recorrido = [];
    for (let i = 1; i <= 40; i += 1) recorrido.push(posicion(42.4000 + i / 20000, -8.8100 + i / 40000, T0 + i * 9000));
    recorrido.push(posicion(42.40, -8.81, T0 + 500_000));
    recorrido.push(posicion(42.40, -8.81, T0 + 900_000));

    const corre = async () => {
      const suscripcion = suscripcionDoblada();
      const { laSalida, estado } = await abierta({ suscripcion });
      const pasos = [];
      for (const p of recorrido) {
        suscripcion.entrega(p);
        pasos.push(await laSalida.recibeLaPosicion());
      }
      return JSON.stringify({ pasos, documento: congelaSalidas(estado) });
    };
    assert.equal(await corre(), await corre());
  });

  test('Una posición con la marca hacia atrás falla nombrándola en vez de contar como reciente', async () => {
    const suscripcion = suscripcionDoblada();
    const { laSalida } = await abierta({ suscripcion });
    suscripcion.entrega(posicion(42.4010, -8.8100, T0 + 10_000));
    await laSalida.recibeLaPosicion();
    suscripcion.entrega(posicion(42.4011, -8.8101, T0 + 5_000));
    await laSalida.recibeLaPosicion();
    assert.match(laSalida.averia() ?? '', /anterior|marca/i, 'una posición con la marca hacia atrás pasó sin decir nada');
  });
});

// ── Con la partida abierta desde disco ──────────────────────────────────────────

describe('Con la partida abierta desde disco', () => {
  test('Echarse a andar en una sesión que no es la del nacimiento abre la salida igual', async () => {
    // **Este caso está rojo, y no es un defecto de la prueba.**
    //
    // `cargaPartida` devuelve lo que abre con `congelaHondo` (`partida/reconstruccion.js`),
    // así que en cualquier sesión que no sea aquella en la que la partida nació el área de
    // salidas llega **congelada**. `abreSalida` la muta en sitio, y con el objeto congelado
    // eso no lanza un error del juego: lanza un `TypeError` de JavaScript, «Cannot assign
    // to read only property 'salida'», que además acaba enseñándose tal cual como motivo
    // literal debajo de «Salir a andar».
    //
    // Medido en el emulador `wa-pixel` el 11-ago-2026: recorrido el arranque entero, la
    // salida se abre y el momento en marcha se alcanza; cerrada y reabierta la app, la
    // portada enseña `salida-situacion = sin-salida` y `salida-no-se-abre = "Cannot assign
    // to read-only property 'salida'"`. O sea que **una salida solo se puede abrir el día
    // que se crea la partida**, que es el primero.
    //
    // Reproducido aquí sin dispositivo con la misma congelación que usa `cargaPartida`.
    // No se ablanda y no se salta: el veredicto entre defecto de prueba y defecto de
    // código no es de quien escribe las pruebas, y esto es defecto de código.
    const estado = congelaHondo(estadoDeSalidas());
    const { respuesta, laSalida } = await abierta({ estado });
    assert.equal(
      respuesta.abierta,
      true,
      'abrir una salida sobre el área congelada que devuelve `cargaPartida` no funciona. Si no se puede abrir, la respuesta tiene que ' +
      'ser `{abierta:false, marca, motivo}` del vocabulario cerrado, nunca un TypeError del intérprete enseñado como motivo literal.',
    );
    assert.equal(laSalida.situacion(), 'abierta-con-rotulo');
  });

  test('Por el camino normal el área que se muta es la misma que llegó', async () => {
    // **La deuda (a) de §8**, que hasta aquí no la afirmaba nadie: la palabra `descongelada`
    // aparecía solo dentro de `app/marcha/salida.js` y ni una vez en `test/`. Es una red que
    // al dispararse no protesta —§6h con el signo cambiado—, y su propio comentario dice qué
    // pasa cuando salta: **lo que se abra no está en la partida que se congela**, así que la
    // salida se ve en pantalla y se pierde al guardar, sin un solo rojo.
    const estado = estadoDeSalidas();
    const { laSalida } = await abierta({ estado });
    const propia = laSalida.areaPropia();
    assert.equal(propia.descongelada, false, 'la orquestación ha tenido que copiar el área: lo que se abra no llegará a la partida que se congela');
    assert.equal(propia.area, estado, 'el área que se muta no es la misma que llegó');
    assert.equal(salidas.salidaEnCurso(estado)?.salida, 's1', 'la salida abierta no ha aparecido en el área de la partida');

    // Y la otra mitad, que es la que da sentido a la primera: con un área congelada sí sale
    // `true`, y eso se puede afirmar. Sin las dos, la afirmación de arriba sería compatible
    // con un `descongelada` clavado a `false`.
    const { laSalida: desdeDisco } = await abierta({ estado: congelaHondo(estadoDeSalidas()) });
    assert.equal(desdeDisco.areaPropia().descongelada, true);
  });
});

// ── iOS: lo que no se entrega, declarado ────────────────────────────────────────

describe('iOS: lo que no se entrega, declarado', () => {
  test('El límite de cada plataforma está escrito como dato y no como comentario', async () => {
    // Una ausencia declarada se puede poner roja; una ausencia que solo vive en un
    // comentario, no. Las dos plataformas declaran qué no entregan, con lo que haría falta
    // y con lo que hay mientras tanto.
    const android = await import('../../app/plataforma/rotulo.ios.js');
    for (const declaracion of [android.DECLARACION]) {
      assert.ok(Array.isArray(declaracion.loQueNoEntrega), 'la declaración no dice qué no entrega');
      assert.ok(declaracion.loQueNoEntrega.length > 0);
      for (const hueco of declaracion.loQueNoEntrega) {
        for (const campo of ['que', 'porque', 'haria_falta', 'mientras_tanto']) {
          assert.ok(hueco[campo] && hueco[campo].length > 10, `un hueco declarado no dice "${campo}"`);
        }
      }
    }
    // La sonda de iOS responde no montada y nombra lo que falta y quién lo cerrará.
    const respuesta = await android.rotulo.sonda();
    assert.equal(respuesta.montado, false);
    assert.equal(respuesta.disponible, false);
    assert.match(respuesta.motivo, /ActivityKit/);
    assert.match(respuesta.motivo, /ninguna spec ha nombrado/);
    // Y no se declara disponible ninguna capacidad que no entregue: `permisoPermanente`
    // sigue en falso y los permisos que declara son los de «mientras se usa».
    assert.equal(android.DECLARACION.permisoPermanente, false);
    assert.deepEqual([...android.DECLARACION.permisos], ['NSLocationWhenInUseUsageDescription']);
  });

  test('Android declara el límite que sí tiene: el rótulo no puede llevar su acción', () => {
    // Medido en la fila 48: la notificación del servicio en primer plano la compone
    // `expo-location` y sus opciones son título, línea, color y si muere con la app. «Dar
    // la salida por terminada» desde el rótulo **no se entrega**, y eso se declara en vez
    // de disimularse. Se lee de la fuente porque `rotulo.android.js` importa el nativo.
    const codigo = fuente('app/plataforma/rotulo.android.js');
    assert.match(codigo, /loQueNoEntrega/);
    assert.match(codigo, /la única acción del rótulo/);
    assert.match(codigo, /mientras_tanto/);
    // Y lo que sí entrega y estaba en duda, medido sobre el dispositivo: canal de
    // importancia baja, no descartable deslizando y sin ninguna cifra en la línea.
    assert.match(codigo, /importanciaDelCanal: 'baja'/);
    assert.match(codigo, /seDescartaDeslizando: false/);
    assert.match(codigo, /cifrasEnLaLinea: 0/);
  });
});

// ── El momento en marcha, desde el montaje ──────────────────────────────────────

describe('El momento en marcha con el sensor montado', () => {
  test('La avería del momento en marcha tiene un vocabulario cerrado de cuatro', () => {
    // Los cuatro se arreglan en sitios distintos: el permiso denegado en los ajustes del
    // sistema, el que no se pudo preguntar es avería nuestra, el sensor que no responde se
    // pasa esperando y el rótulo sin montar es una compilación en la que ni se abre. Un
    // motivo en prosa los haría iguales. Se lee de la fuente: el montaje es JSX.
    const codigo = fuente('app/pantallas/en-marcha-montado.jsx');
    assert.match(
      codigo,
      /export const MOTIVOS_SIN_UBICACION = Object\.freeze\(\[\s*'permiso-denegado',\s*'permiso-no-preguntable',\s*'sensor-sin-responder',\s*'rotulo-sin-montar',\s*\]\)/,
    );
    // Cada uno tiene su texto, y **ninguno nombra la red, el permiso del sistema en jerga
    // ni ningún código**: son las palabras del juego y el identificador viaja en la marca.
    for (const motivo of ['permiso-denegado', 'permiso-no-preguntable', 'sensor-sin-responder', 'rotulo-sin-montar']) {
      assert.match(codigo, new RegExp(`'${motivo}': '`), `el momento no tiene texto para "${motivo}"`);
    }
    assert.match(codigo, /testID="marcha-sin-ubicacion"/);
    assert.match(codigo, /testID="ubicacion-estado"/);
  });

  test('La marca de posición se pinta en el sitio del mundo y no en el centro de la pantalla', () => {
    // Clavada en el centro no se movería nunca —el centro es el centro—, que es
    // indistinguible de estar quieta; y con la cámara siguiéndola se movería el mapa
    // entero, que es lo contrario de lo que el momento promete. La etiqueta lleva el punto
    // en metros del mundo y la clasificación, que es lo que permite leerla moverse.
    const pantalla = fuente('app/pantallas/en-marcha.jsx');
    assert.doesNotMatch(pantalla, /left: '50%'/, 'la marca de posición sigue clavada en el centro de la pantalla');
    assert.match(pantalla, /enPantalla\(camaraNormal, tamano, momento\.marcaPosicion\.punto\)/);
    assert.match(pantalla, /Math\.round\(momento\.marcaPosicion\.punto\.x\)/);
    // Y la conversión de metros del mundo a píxeles vive en la cámara, con su inversa.
    assert.match(fuente('app/mapa/camara.js'), /export function pixelDeMundo/);
  });
});

// ── La tubería real, del sensor a la escena ─────────────────────────────────────
//
// **Esta es la guarda de la duodécima aparición de §6h, y es la que hoy no existía.**
// SPEC-032 escribió, probó y cerró la capa de llegadas entera sobre secuencias de posiciones
// fabricadas: mil casos en verde sobre una capa que en un teléfono no se disparaba jamás.
// Medido en `pipeline/decisiones-orquestador.md` §9a: parada 300 s dentro de un geofence,
// 400 semillas por celda, **0 % de llegadas validadas** con el fijo perfecto.
//
// Lo que se monta aquí es la cadena entera y sin trozos fabricados en medio: la suscripción
// de `plataforma/posiciones.js` con **su filtro de cadencia aplicado de verdad**, la fuente,
// el detector de `partida/transporte.js`, la ventana de parada de `partida/ritmo.js` y
// `creaLlegadas().comprueba()`, alimentada posición a posición por `recibeLaPosicion`.
//
// El sensor doblado es el único trozo que no es de producción, y **es un modelo del filtro
// y no un generador de posiciones**: entrega un fijo solo cuando las opciones que la app le
// pidió lo dejan pasar —`distanceInterval` metros recorridos, o `timeInterval` milisegundos
// transcurridos—, que es lo que hace `setMinUpdateDistanceMeters` del `LocationRequest` de
// Android. Con la cadencia por distancia y quien juega parada, no entrega ninguno: por eso
// esta prueba se pone roja el día que alguien devuelva el muestreo a `distanceInterval` fijo.

describe('Una parada dentro de un geofence valida la llegada con la tubería real', () => {
  /**
   * Un sensor que respeta el filtro que la app le pide.
   *
   * `trayectoria(tMs)` es la verdad del terreno en metros del mundo; `tic` avanza el reloj
   * y entrega el fijo **solo si el filtro lo deja pasar**. El ruido del fijo viene de la
   * semilla y nunca de `Math.random`, que es lo que hace la prueba repetible.
   */
  function sensorConFiltro({ proyector, trayectoria, precisionM = 3, ruidoM = 0, semilla = 'tuberia' }) {
    let opciones = null;
    let entrega = null;
    const emitidos = [];
    const rng = makeRng(semilla);
    const Location = {
      Accuracy: { High: 4, Balanced: 3 },
      startLocationUpdatesAsync: async (_tarea, o) => { opciones = o; },
      stopLocationUpdatesAsync: async () => { opciones = null; },
      hasStartedLocationUpdatesAsync: async () => opciones !== null,
      getCurrentPositionAsync: async () => {
        const grados = proyector.toLatLon(trayectoria(0));
        return { coords: { latitude: grados.lat, longitude: grados.lon, accuracy: precisionM }, timestamp: T0 };
      },
    };
    const suscripcion = creaSuscripcionDeUbicacion({
      Location,
      TaskManager: { defineTask: (_, fn) => { entrega = fn; } },
      declaraTarea: exigeTareaDeclarada,
    });
    let ultimo = null;
    return {
      ...suscripcion,
      emitidos,
      opciones: () => opciones,
      /** Un segundo de reloj del sensor. Devuelve si el filtro dejó pasar el fijo. */
      tic(tMs) {
        if (!opciones || !entrega) return false;
        const verdad = trayectoria(tMs);
        // El ruido del fijo, de media cero: es lo que la regla de deriva de ventana hunde
        // promediando y lo que la de fijo a fijo confundía con andar.
        const punto = { x: verdad.x + (rng() - 0.5) * 2 * ruidoM, y: verdad.y + (rng() - 0.5) * 2 * ruidoM };
        if (ultimo) {
          const porTiempo = Number.isFinite(opciones.timeInterval) && opciones.timeInterval > 0;
          if (porTiempo) {
            if (tMs - ultimo.tMs < opciones.timeInterval) return false;
          } else if (Math.hypot(punto.x - ultimo.x, punto.y - ultimo.y) < (opciones.distanceInterval ?? 0)) {
            return false;
          }
        }
        ultimo = { ...punto, tMs };
        emitidos.push({ tMs, ...punto });
        const grados = proyector.toLatLon(punto);
        entrega({ data: { locations: [{ coords: { latitude: grados.lat, longitude: grados.lon, accuracy: precisionM }, timestamp: tMs }] } });
        return true;
      },
    };
  }

  /**
   * Monta la vida de una salida sobre un mundo de fixture y la capa de llegadas de verdad
   * —`app/marcha/llegadas.js`, la que la app monta—, y recorre la trayectoria segundo a
   * segundo hasta `hastaMs`.
   *
   * El bundle del núcleo se arma **por ruta relativa** y no se importa de
   * `app/nucleo/piezas.js`: aquel fichero cita el paquete por su nombre y no resuelve sin
   * instalación, y esta batería tiene que arrancar en un clon limpio (§6u).
   */
  async function andaLaTuberia({ trayectoria, hastaMs, precisionM = 3, ruidoM = 0, semilla = 'tuberia', reparto = REPARTO_SIN_AVENTURA }) {
    const celda = await celdaDeFixture('costero');
    const mundo = celda.mundo;
    const origen = mundo.origin;
    const proyector = makeProjector(origen.lat, origen.lon);
    const estado = estadoInicial({ semilla: celda.semilla ?? SEMILLA_A });
    const suscripcion = sensorConFiltro({ proyector, trayectoria, precisionM, ruidoM, semilla });

    const laSalida = creaLaSalida({
      nucleo: NUCLEO,
      salidas: estado.salidas,
      rotulo: rotuloQueFunciona(),
      suscripcion,
      origen,
      mundo,
      tramo: TRAMO_M,
      montaLlegadas: ({ detector, salida, mapaId }) => creaLasLlegadas({
        nucleo: NUCLEO_DE_LAS_LLEGADAS,
        mundo,
        cupos: celda.cupos,
        mapaId,
        salida,
        estado,
        registro: registroInicial(),
        detector,
        reparto,
        dia: 1,
      }),
    });

    const abierta = await laSalida.abre({ salida: 's1', mapa: celda.mapaId, mundo: 'Reinos da Brétema' });
    assert.equal(abierta.abierta, true, `la salida no se abrió: ${abierta.motivo ?? ''}`);
    assert.ok(laSalida.llegadas(), `la capa de llegadas no se montó: ${laSalida.averia() ?? ''}`);

    for (let tMs = T0; tMs <= T0 + hastaMs; tMs += 1000) {
      if (suscripcion.tic(tMs)) await laSalida.recibeLaPosicion();
    }
    return { laSalida, suscripcion, mundo, proyector, celda, estado };
  }

  /** El sitio del mundo de fixture sobre el que se para, y su geofence. */
  async function unSitioDelMundo() {
    const celda = await celdaDeFixture('costero');
    const sitios = sitiosConPosicion(celda.mundo);
    // El primero por orden declarado, que es el mismo orden con el que el índice se
    // construye: elegirlo por gusto haría que la prueba dependiera de un nombre.
    const [nombre, geofence] = [...sitios][0];
    return { nombre, geofence, celda };
  }

  /** Quien se acerca andando y se para en el sitio: llega a los `paradaEnMs` y ya no se mueve. */
  function llegaYSePara(geofence, { desdeM = 300, velocidadMs = 1.39 } = {}) {
    const duracionS = desdeM / velocidadMs;
    return (tMs) => {
      const t = Math.max(0, (tMs - T0) / 1000);
      const recorrido = Math.min(1, t / duracionS);
      return { x: geofence.x - desdeM * (1 - recorrido), y: geofence.y };
    };
  }

  test('Parada dentro de un geofence, con la tubería entera montada, la llegada se valida', async () => {
    const { nombre, geofence } = await unSitioDelMundo();
    const { laSalida, suscripcion } = await andaLaTuberia({
      trayectoria: llegaYSePara(geofence),
      // Llegar cuesta 216 s andando; después se está parada dos minutos, que es de sobra
      // para los veinte segundos de la ventana corta y para los cuarenta de la larga.
      hastaMs: 340_000,
      ruidoM: 3,
    });

    // La mitad que §9a medía al 0 %: con la cadencia por distancia y quien juega parada, el
    // sensor no entrega ni un fijo y no hay permanencia que contar.
    assert.equal(suscripcion.cadencia(), 'por-tiempo', 'la suscripción no cambió a cadencia por tiempo con el sitio debajo');
    assert.equal(laSalida.cadencia(), 'por-tiempo', 'la salida no publica la cadencia vigente que de verdad está puesta');
    assert.equal(suscripcion.opciones().timeInterval, CADENCIA_CERCA_S * 1000);
    assert.equal(suscripcion.opciones().distanceInterval, 0, 'el filtro de distancia sigue puesto y los dos se aplican a la vez');

    const espera = laSalida.llegadas().espera();
    assert.ok(espera, 'nadie validó ninguna llegada con la tubería real: es exactamente lo que §9a midió al 0 %');
    assert.equal(espera.sitio, nombre);

    // Y de los fijos parada, unos cuantos: sin la cadencia por tiempo serían cero.
    const parada = suscripcion.emitidos.filter((p) => p.tMs > T0 + 220_000);
    assert.ok(parada.length >= 10, `parada solo llegaron ${parada.length} fijos, y la permanencia se cuenta sobre posiciones que llegan`);
  });

  test('Quien atraviesa el geofence andando no valida ninguna llegada, ni a cuatro ni a cinco kilómetros por hora', async () => {
    // La mitad del criterio que se pierde sola en cualquier arreglo de ruido. Se pasa de
    // largo, sin pararse ni una muestra, a las dos velocidades que §9c midió.
    for (const [nombre, velocidadMs] of [['cuatro', 1.11], ['cinco', 1.39]]) {
      const { geofence } = await unSitioDelMundo();
      const { laSalida } = await andaLaTuberia({
        trayectoria: (tMs) => ({ x: geofence.x - 300 + velocidadMs * ((tMs - T0) / 1000), y: geofence.y }),
        hastaMs: 500_000,
        ruidoM: 3,
        semilla: `de-paso-${nombre}`,
      });
      assert.equal(
        laSalida.llegadas().espera(),
        null,
        `pasar de largo a ${nombre} kilómetros por hora ha validado una llegada, y «El visor no aparece nunca andando» deja de sostenerse`,
      );
    }
  });

  test('Un vehículo parado dentro del geofence no valida, por mucho que la deriva sea cero', async () => {
    // El atasco: el coche entra en el geofence y se queda quieto. La deriva de la ventana es
    // cero y aun así no valida, porque `creaVentanaDeParada` responde que no antes de medir
    // nada cuando la clasificación es vehículo. Es la guarda que un arreglo de ruido pierde
    // sola, y por eso se afirma aparte y no como un caso más de la parada.
    //
    // **El atasco dura menos que `SALIDA_DE_VEHICULO_S`, y es a propósito**: pasado ese
    // tiempo el detector de SPEC-031 decide que quien juega se bajó del coche, que es otra
    // situación y no esta. Dónde queda el borde está medido y escrito abajo.
    const { geofence } = await unSitioDelMundo();
    const paradoS = SALIDA_DE_VEHICULO_S - 30;
    const { laSalida, suscripcion } = await andaLaTuberia({
      // Se llega a velocidad de coche —lo bastante lejos y rápido para que el detector funde
      // el motor, que le cuesta `CONFIRMACION_VEHICULO_S`— y se para dentro.
      trayectoria: (tMs) => {
        const t = Math.max(0, (tMs - T0) / 1000);
        const recorrido = Math.min(1, t / 90);
        return { x: geofence.x - 1800 * (1 - recorrido), y: geofence.y };
      },
      hastaMs: (90 + paradoS) * 1000,
      ruidoM: 3,
      semilla: 'atasco',
    });
    assert.ok(suscripcion.emitidos.length > 20, 'el atasco no llegó a entregar fijos y el caso no mediría nada');

    // Que de verdad se estaba clasificando como vehículo: sin esto el caso pasaría por no
    // haber llegado a fundar ningún motor, que es lo contrario de lo que quiere afirmar.
    const segmentos = laSalida.traza().traza().segmentos;
    assert.equal(segmentos[segmentos.length - 1].clasificacion, 'vehiculo', 'el detector no clasificó el atasco como vehículo');
    assert.ok(paradoS >= PARADA_DENTRO_S, 'el atasco dura menos que la permanencia y el caso no mediría nada');

    assert.equal(
      laSalida.llegadas().espera(),
      null,
      'un vehículo parado dentro de un geofence ha validado la llegada: un arreglo que valide al autobús parado no es un arreglo',
    );
  });

  test('Un vehículo quieto más que el tiempo de salida deja de ser vehículo, y eso está medido', async () => {
    // **El borde del caso de arriba, escrito con su número y no con esperanza.** No es una
    // excepción a «el atasco no valida»: es que a partir de `SALIDA_DE_VEHICULO_S` la traza
    // deja de decir vehículo —SPEC-031 decide que quien juega se bajó—, así que lo que hay
    // dentro del geofence ya no es un coche parado. Se afirma para que el día que alguien
    // toque ese número vea aquí qué se lleva por delante.
    const { geofence } = await unSitioDelMundo();
    const { laSalida } = await andaLaTuberia({
      trayectoria: (tMs) => {
        const t = Math.max(0, (tMs - T0) / 1000);
        const recorrido = Math.min(1, t / 90);
        return { x: geofence.x - 1800 * (1 - recorrido), y: geofence.y };
      },
      hastaMs: (90 + SALIDA_DE_VEHICULO_S + 60) * 1000,
      ruidoM: 3,
      semilla: 'atasco-largo',
    });
    const segmentos = laSalida.traza().traza().segmentos;
    assert.equal(
      segmentos[segmentos.length - 1].clasificacion,
      'parada',
      `pasados ${SALIDA_DE_VEHICULO_S} s quietos la traza tendría que haber dejado de decir vehículo`,
    );
    assert.ok(
      laSalida.llegadas().espera(),
      'quieta dos minutos dentro del geofence, con la traza diciendo parada, la llegada sigue sin validar',
    );
  });
});
