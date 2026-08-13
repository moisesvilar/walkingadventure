// SPEC-032 · Las llegadas por geofence, la secuencia como dato del núcleo y lo que aquí
// se cuenta: validar no es un gesto, y quien encadena las pantallas es haber llegado.
//
// **Casi todo lo que hay que afirmar de esta fila son ausencias**, y una ausencia solo se
// puede poner roja contra una enumeración: que no exista un botón de «he llegado», que la
// llegada no emita nada, que no haya manera de saltar a un paso, que no exista consulta
// del estado de un núcleo sin haber llegado a él. Por eso lo que se prueba son las listas
// declaradas —`LO_QUE_VALIDAR_NO_EXIGE`, `LO_QUE_UNA_LLEGADA_NO_EMITE`,
// `OPERACIONES_QUE_NO_EXISTEN`— **y además** la superficie pública de la capa, porque una
// lista que nadie contrasta con lo que hay se queda escrita mientras el código se va.
//
// Cuatro decisiones de este fichero que no son de estilo:
//
// - **La clasificación llega de fuera y no se finge la regla de la duda.** Las posiciones
//   viajan con su clasificación —el vocabulario de `ritmo.js`— y los casos del vehículo y
//   de la duda se afirman además contra `validaLlegadaPorGeofence`, que es de donde la
//   capa la lee. Reimplementar aquí el umbral sería probar la prueba.
// - **No hay reloj y no hay espera.** Los veinte segundos de permanencia son dos marcas de
//   tiempo dentro de dos posiciones, nunca dos segundos de reloj; y los dos días con la app
//   cerrada son un `congelaLlegadas` seguido de un `levantaLlegadas`.
// - **Los bordes se afirman por sus dos mitades.** Treinta metros y cuarenta y cinco;
//   diecinueve segundos y veinte; el semáforo de cuarenta segundos y el paso de largo.
// - **Las cinco formas de secuencia se cuentan sobre los ocho mundos de referencia**, no
//   sobre un caso construido (§6o de `pipeline/decisiones-orquestador.md`): un mundo
//   inventado a medida donde salen las cuatro formas no demuestra que salgan en el juego.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «El geofence se
// valida desde la calle», «El visor no aparece nunca andando», «La escena queda disponible
// y espera», «Pararse en un semáforo dentro de un geofence no tiene consecuencias», «El
// visor abre por la ficción la primera vez», «El visor es una capa y debajo está el beat»,
// «La segunda vez el visor no se abre solo», «Llegar sin haber venido a nada da la ficha
// del sitio», «Lo que aquí se cuenta cierra la llegada a un núcleo», «Sin beat, lo que se
// cuenta es la llegada entera», «Pasar en coche por delante de un beat no lo valida» y «En
// la duda, cuenta». Los cuatro últimos están etiquetados `@app` o viven en otra
// característica de la batería; aquí se implementa la mitad que no necesita dispositivo, y
// la que sí —que la pantalla no se encienda— está en `test/app/llegada.yaml`. Todo lo demás
// va marcado como hueco de la batería en `test/spec-test-map.json`, y la spec los nombra
// uno a uno en «Huecos de cobertura detectados en docs/testing.md».

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CADENCIAS,
  CADENCIA_CERCA_S,
  IDS_DE_CADENCIA,
  LO_QUE_UNA_LLEGADA_EMITE,
  LO_QUE_UNA_LLEGADA_NO_EMITE,
  LO_QUE_VALIDAR_NO_EXIGE,
  MARGEN_DE_CERCANIA_M,
  PARADA_DENTRO_MS,
  PARADA_DENTRO_S,
  RADIO_DE_GEOFENCE_M,
  RAZONES_DE_CADENCIA,
  TEXTOS,
  antetituloDe,
  cadenciaDeMuestreo,
  congelaLlegadas,
  creaLlegadas,
  distanciaAlGeofence,
  escenaQueEspera,
  estadoDeLlegadas,
  exigeTrazaClasificada,
  geofenceDe,
  levantaLlegadas,
  llegadasValidadas,
  revisaLosTextos,
  sitiosConPosicion,
} from '../../packages/nucleo/partida/llegadas.js';
import {
  FORMAS,
  FORMAS_DECLARADAS,
  IDS_DE_FORMA,
  IDS_DE_MODO,
  IDS_DE_TIPO,
  MODOS,
  OPERACIONES_QUE_NO_EXISTEN,
  TIPOS_DE_PASO,
  TIPOS_DE_SITIO,
  avanzaLaSecuencia,
  exigeSecuencia,
  formaDeSecuencia,
  pasoVigente,
  pasosEncadenados,
  secuenciaDeLlegada,
} from '../../packages/nucleo/partida/secuencia.js';
import { CLASIFICACIONES, validaLlegadaPorGeofence } from '../../packages/nucleo/partida/ritmo.js';
import { RADIO_DE_REGRESO_M } from '../../packages/nucleo/partida/regreso.js';
import { creaDetectorDeTransporte, detectorSinMontar } from '../../packages/nucleo/partida/transporte.js';
import { entradasDe, entradasDeSuceso, estadoDeDiario } from '../../packages/nucleo/partida/diario.js';
import {
  estadoDeNucleos,
  loQueSeCuentaEn,
  sedimenta,
  versionQueLlego,
} from '../../packages/nucleo/partida/nucleos.js';
import { PROTAGONISTAS, SIGNOS, hechosFieles } from '../../packages/nucleo/partida/deformacion.js';
import {
  LAS_DOS_SEMILLAS,
  LOS_CUATRO,
  fuente,
  generaMundo,
  modulosDelPaquete,
  semillaDe,
} from './mundo-de-prueba.mjs';

// ── El decorado ────────────────────────────────────────────────────────────────

const MAPA = 'casa';
const OTRO_MAPA = 'fuera';
const SALIDA = 'la-salida-de-hoy';

const MONFRIDA = 'Monfrida';
const VILABOA = 'Vilaboa';
const TABERNA = 'A Taberna Pechada';
const TORREON = 'O Torreón Esquecido';
const FONTE = 'A Fonte Vella';

const LLEGADAS = 'packages/nucleo/partida/llegadas.js';
const SECUENCIA = 'packages/nucleo/partida/secuencia.js';

/**
 * Un mundo escrito a mano, y a propósito: lo que estas pruebas necesitan es geometría
 * elegida —una acera a treinta metros, dos geofences solapados, un núcleo lejos de todo—,
 * y ningún fixture la trae. Los ocho mundos de referencia entran donde toca, que es donde
 * se cuentan las formas de secuencia.
 */
function mundoDePrueba() {
  return {
    settlements: [
      // El servicio es el local cerrado del escenario: se valida desde la acera de
      // enfrente y nunca hay que entrar.
      { name: MONFRIDA, x: 0, y: 0, services: [{ name: TABERNA, x: 400, y: 0 }] },
      { name: VILABOA, x: 3000, y: 0, services: [] },
    ],
    parajes: [
      { name: TORREON, x: 1500, y: 0 },
      // A cincuenta metros del torreón: los dos geofences de cuarenta se solapan, y en la
      // intersección se está dentro de los dos a distinta distancia.
      { name: FONTE, x: 1550, y: 0 },
    ],
  };
}

/** Un beat del lazo en un sitio del mundo, con lo que la capa mira de él. */
function beatEn(nombre, { x, y = 0, tipo = 'paraje', n = 1 } = {}) {
  return { n, lugar: { nombre, x, y, tipo }, disparador: { tipo: 'llegada' } };
}

/**
 * La precisión declarada por defecto de las posiciones fabricadas aquí: **tres metros**,
 * que es el fijo bueno de la tabla de §9c —el que sostiene la ventana corta y con el que
 * los veinte segundos de SPEC-032 siguen siendo el coste entero—.
 *
 * Está puesta porque SPEC-044 deroga la parada de fijo a fijo y la sustituye por la deriva
 * de ventana, y **una posición sin precisión declarada usa la ventana larga por prudencia**
 * (`ritmo.js`, `ventanaParaPrecision`). Las paradas de este fichero se fabricaron antes de
 * esa regla y no declaraban ninguna, así que medían cuarenta segundos donde el escenario
 * dice veinte. **Lo que se actualiza es el fixture y no la exigencia**: los escenarios de
 * `docs/testing.md` que se afirman aquí —«El geofence se valida desde la calle», «El visor
 * no aparece nunca andando», «Pararse en un semáforo dentro de un geofence no tiene
 * consecuencias»— siguen intactos y siguen afirmándose. La ventana larga tiene sus propios
 * casos, más abajo, en «La parada, medida por deriva de ventana».
 */
const FIJO_BUENO_M = 3;

/** Posiciones de una parada: el mismo punto, marcas de tiempo que avanzan. */
function paradoEn({ x, y = 0, desdeMs = 0, duracionMs, cadaMs = 5000, clasificacion = 'parada', precisionM = FIJO_BUENO_M }) {
  const posiciones = [];
  for (let t = 0; t <= duracionMs; t += cadaMs) posiciones.push({ x, y, tMs: desdeMs + t, precisionM, clasificacion });
  return posiciones;
}

/**
 * Posiciones de quien pasa de largo por delante de un sitio, a la velocidad que se pida.
 *
 * La velocidad por defecto es la de andar —cinco kilómetros por hora—, porque es la del
 * escenario: «atraviesa el geofence de un sitio sin pararse». Y va con el fijo bueno a
 * propósito: es el caso **más exigente** para «El visor no aparece nunca andando», porque
 * es el que mide con la ventana corta.
 */
function pasaPorDelante({ centroX, y = 0, desdeM = -120, hastaM = 120, velocidadMs = 1.39, desdeMs = 0, cadaMs = 2000, clasificacion = 'andando', precisionM = FIJO_BUENO_M }) {
  const posiciones = [];
  const duracionS = (hastaM - desdeM) / velocidadMs;
  for (let t = 0; t <= duracionS * 1000; t += cadaMs) {
    posiciones.push({ x: centroX + desdeM + velocidadMs * (t / 1000), y, tMs: desdeMs + t, precisionM, clasificacion });
  }
  return posiciones;
}

/** Una versión de lo que se cuenta, con su protagonista declarado. */
function version({ rumor = 'las-campanas', nivel = 1, signo = SIGNOS.BUENO, veces = 3, protagonista = PROTAGONISTAS.VECINDARIO, origen = MONFRIDA, texto = null } = {}) {
  return versionQueLlego({
    rumor,
    plantilla: 'entrega-sospechosa',
    origen,
    nivel,
    signo,
    texto,
    hechos: hechosFieles({ asunto: 'la ermita tocó a rebato', escala: { veces }, detalle: { lugar: MONFRIDA } }, { protagonista }),
  });
}

/**
 * Monta la capa de llegadas con todo cableado, que es la frontera de inyección entera.
 *
 * Doblar aquí no es interceptar nada: la cola, la capa de lo que se cuenta, las
 * ilustraciones y el registro de sitios pisados son argumentos, y lo que se les pasa es
 * exactamente lo que el mundo de la prueba declara.
 */
function capa({
  mundo = mundoDePrueba(),
  mapaId = MAPA,
  salida = SALIDA,
  estado = estadoDeLlegadas(),
  detector = creaDetectorDeTransporte(),
  reparto = { beats: [] },
  mandados = {},
  cuentan = {},
  conIlustracion = [],
  pisados = [],
  diario = estadoDeDiario(),
  cola,
  loQueSeCuenta,
  ilustraciones,
  visitados,
} = {}) {
  const yaPisados = new Set(pisados);
  const piezas = {
    mundo,
    mapaId,
    salida,
    estado,
    detector,
    reparto,
    diario,
    cola: cola === undefined ? { microEncuentroEn: (sitio) => mandados[sitio] ?? null } : cola,
    loQueSeCuenta: loQueSeCuenta === undefined ? { versionesDe: (nucleo) => cuentan[nucleo] ?? [] } : loQueSeCuenta,
    ilustraciones: ilustraciones === undefined ? { hay: (sitio) => conIlustracion.includes(sitio) } : ilustraciones,
    visitados: visitados === undefined
      ? { yaVisitado: (sitio) => yaPisados.has(sitio), anota: (sitio) => yaPisados.add(sitio) }
      : visitados,
  };
  return { llegadas: creaLlegadas(piezas), estado, diario, piezas, yaPisados };
}

/** El código de un fichero del repo sin comentarios: los comentarios nombran lo que no se hace. */
function codigoDe(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('//'))
    .join('\n');
}

/**
 * El código sin sus textos.
 *
 * Hace falta para las afirmaciones negativas: los mensajes de error de este módulo dicen
 * en voz alta lo que el módulo **no** hace —«esta capa no clasifica velocidades por su
 * cuenta»—, así que buscar la palabra sobre el código con textos daría siempre positivo y
 * la afirmación no mediría nada.
 */
function codigoSinTextos(ruta) {
  return codigoDe(ruta)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/** Una parada de veinte segundos a la distancia que se pida del centro de un sitio. */
function paradaA(metros, centroX, opciones = {}) {
  return paradoEn({ x: centroX + metros, duracionMs: PARADA_DENTRO_MS, ...opciones });
}

// ── La validación de una llegada ───────────────────────────────────────────────

describe('La validación de una llegada', () => {
  test('El radio del geofence es el mismo para todos los sitios y sale de una constante única', () => {
    const { llegadas } = capa();
    const radios = [MONFRIDA, VILABOA, TABERNA, TORREON, FONTE].map((sitio) => llegadas.geofence(sitio).radioM);
    assert.deepEqual(radios, radios.map(() => RADIO_DE_GEOFENCE_M), 'algún sitio tiene un radio propio');
    assert.equal(llegadas.radioM, RADIO_DE_GEOFENCE_M);
    assert.ok(RADIO_DE_GEOFENCE_M >= 30 && RADIO_DE_GEOFENCE_M <= 50, 'el radio se sale del rango de quests.md §3');

    // Y la constante es una: en el módulo no hay ningún otro número de metros con el que
    // alguien pueda calibrar un radio por tipo de sitio.
    const codigo = codigoDe(LLEGADAS);
    assert.equal((codigo.match(/RADIO_DE_GEOFENCE_M = /g) ?? []).length, 1, 'el radio se declara más de una vez');
    assert.equal(/radioM:\s*\d/.test(codigo), false, 'algún geofence lleva un radio escrito a mano');
  });

  test('El geofence se valida desde la calle', () => {
    // El anclaje es un local cerrado y la jugadora se para en la acera de enfrente, a
    // treinta metros. Nunca hay que entrar.
    const { llegadas } = capa();
    const validadas = llegadas.comprueba({ posiciones: paradaA(30, 400) }).validadas;
    assert.deepEqual(validadas.map((v) => v.sitio), [TABERNA]);
    assert.equal(Math.round(validadas[0].distanciaM), 30);

    // Y la otra mitad del borde: fuera del radio no valida, por muy cerca que se pare.
    const { llegadas: otra } = capa();
    assert.deepEqual(otra.comprueba({ posiciones: paradaA(45, 400) }).validadas, []);
  });

  test('Ninguna condición de validación exige estar dentro del recinto real', () => {
    for (const condicion of ['entrar-en-el-recinto', 'que-el-sitio-este-abierto']) {
      assert.ok(LO_QUE_VALIDAR_NO_EXIGE.includes(condicion), `"${condicion}" no está declarada como condición que no existe`);
    }
    // El geofence entregado no tiene con qué expresar un interior: es un punto y un radio.
    const { llegadas } = capa();
    assert.deepEqual(Object.keys(llegadas.geofence(TABERNA)).sort(), ['nombre', 'radioM', 'tipo', 'x', 'y']);

    // Y no hay por dónde exigirlo: el módulo no lee ninguna propiedad de interior del
    // sitio. Se mira el código sin sus textos, porque la lista de arriba nombra a
    // propósito lo que no se exige.
    const codigo = codigoSinTextos(LLEGADAS);
    for (const dentro of [/\.recinto/i, /\.interior/i, /\.horario/i, /\.abierto/i, /\.puerta/i, /estaAbierto/i]) {
      assert.equal(dentro.test(codigo), false, `el módulo de las llegadas mira algo del interior del sitio (${dentro})`);
    }
  });

  test('El visor no aparece nunca andando', () => {
    // Atravesar el geofence sin pararse no valida: lo que la permanencia distingue es
    // pararse de pasar de largo. Se pasa por delante del núcleo a cinco kilómetros por
    // hora, en línea recta y sin detenerse ni una muestra.
    const { llegadas } = capa();
    const posiciones = pasaPorDelante({ centroX: 0 });
    const dentro = posiciones.filter((p) => Math.abs(p.x) <= RADIO_DE_GEOFENCE_M);
    const segundosDentro = (dentro[dentro.length - 1].tMs - dentro[0].tMs) / 1000;
    const paso = llegadas.comprueba({ posiciones });
    assert.deepEqual(
      paso.validadas.map((v) => v.sitio),
      [],
      `pasar de largo andando ha validado una llegada: cruzar un geofence de ${RADIO_DE_GEOFENCE_M} m ` +
      `a cinco kilómetros por hora deja ${Math.round(segundosDentro)} s dentro, más que los ${PARADA_DENTRO_S} s de permanencia`,
    );
    assert.equal(llegadas.espera(), null, 'pasar de largo ha dejado una escena esperando');
  });

  test('Una parada más corta que la permanencia no valida', () => {
    const { llegadas } = capa();
    const corta = paradoEn({ x: 10, duracionMs: PARADA_DENTRO_MS - 1000, cadaMs: 1000 });
    assert.deepEqual(llegadas.comprueba({ posiciones: corta }).validadas, []);
    assert.equal(PARADA_DENTRO_MS, PARADA_DENTRO_S * 1000);
  });

  test('Una parada del tiempo de permanencia valida la llegada', () => {
    const { llegadas } = capa();
    const validadas = llegadas.comprueba({ posiciones: paradoEn({ x: 10, duracionMs: PARADA_DENTRO_MS, cadaMs: 1000 }) }).validadas;
    assert.deepEqual(validadas.map((v) => v.sitio), [MONFRIDA]);
  });

  test('Pasar en coche por delante de un beat no lo valida', () => {
    // El coche atraviesa el geofence del beat, y tarda de sobra: lo que lo aparta no es el
    // tiempo, es la clasificación.
    const { llegadas } = capa({ reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    const enCoche = pasaPorDelante({ centroX: 1500, velocidadMs: 13.9, cadaMs: 500, clasificacion: 'vehiculo' });
    assert.deepEqual(llegadas.comprueba({ posiciones: enCoche }).validadas, []);
    assert.equal(llegadas.espera(), null, 'el beat ha quedado esperando después de pasar en coche');

    // Y aunque el coche se pare dentro del geofence, sigue sin validar.
    const { llegadas: otra } = capa({ reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    assert.deepEqual(otra.comprueba({ posiciones: paradoEn({ x: 1500, duracionMs: PARADA_DENTRO_MS * 3, clasificacion: 'vehiculo' }) }).validadas, []);

    // La regla se lee del mismo módulo del que la lee el motor de pasos.
    assert.equal(validaLlegadaPorGeofence('vehiculo'), false);
    assert.match(fuente(LLEGADAS), /validaLlegadaPorGeofence.*from '\.\/ritmo\.js'|from '\.\/ritmo\.js'/s);
  });

  test('En la duda, cuenta', () => {
    // La mitad de validación: quien atraviesa a velocidad ambigua y se para dentro valida.
    const { llegadas } = capa();
    const ambigua = [
      ...pasaPorDelante({ centroX: 1500, desdeM: -120, hastaM: -30, velocidadMs: 3, cadaMs: 2000, clasificacion: 'ambiguo' }),
      ...paradoEn({ x: 1490, desdeMs: 60000, duracionMs: PARADA_DENTRO_MS, clasificacion: 'ambiguo' }),
    ];
    const validadas = llegadas.comprueba({ posiciones: ambigua }).validadas;
    assert.deepEqual(validadas.map((v) => v.sitio), [TORREON]);
    assert.equal(validaLlegadaPorGeofence('ambiguo'), true);

    // Y de las cuatro clasificaciones del vocabulario, la única que aparta una llegada es
    // el vehículo: en la duda no se descarta nada.
    const apartan = CLASIFICACIONES.filter((c) => !validaLlegadaPorGeofence(c));
    assert.deepEqual(apartan, ['vehiculo']);
  });

  test('Validar no es un gesto: ninguna operación de esta capa recibe un toque', () => {
    const { llegadas } = capa();
    // La superficie pública entera, enumerada: si alguien añade un «he llegado», hay que
    // ampliar esta lista, que es donde se quiere que salte.
    assert.deepEqual(
      Object.keys(llegadas).sort(),
      ['avanza', 'beatDe', 'comprueba', 'espera', 'geofence', 'loQueAquiSeCuenta', 'mapaId', 'permanenciaMs', 'radioM', 'salida', 'validadas'],
    );
    for (const gesto of ['valida', 'confirma', 'acepta', 'marcarLlegada', 'heLlegado']) {
      assert.equal(Object.prototype.hasOwnProperty.call(llegadas, gesto), false, `la capa expone "${gesto}"`);
    }
    for (const condicion of ['tocar-un-boton', 'confirmar-la-llegada']) {
      assert.ok(LO_QUE_VALIDAR_NO_EXIGE.includes(condicion), `"${condicion}" no está declarado como lo que validar no exige`);
    }

    // Y lo que `comprueba` recibe son posiciones, no una acción: sin lista de posiciones
    // falla, y no hay ningún otro camino que valide.
    assert.throws(() => llegadas.comprueba({ posiciones: null }), /posiciones/);
  });

  test('Una llegada validada no emite ninguna notificación, ningún háptico ni ninguna petición de primer plano', () => {
    const { llegadas } = capa({ reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    const resultado = llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    assert.deepEqual(resultado.validadas.map((v) => v.sitio), [TORREON]);
    assert.deepEqual(resultado.emite, [], 'la llegada emite algo hacia la plataforma');
    assert.deepEqual(LO_QUE_UNA_LLEGADA_EMITE, []);

    for (const canal of ['notificacion', 'haptico', 'encender-la-pantalla', 'poner-la-app-en-primer-plano']) {
      assert.ok(LO_QUE_UNA_LLEGADA_NO_EMITE.includes(canal), `"${canal}" no está declarado como lo que una llegada no emite`);
      assert.equal(LO_QUE_UNA_LLEGADA_EMITE.includes(canal), false, `"${canal}" está en las dos listas y entonces no separan nada`);
    }

    // Y la capa no tiene por dónde emitir: ningún canal entra cableado y ninguno se llama.
    const codigo = codigoDe(LLEGADAS);
    for (const canal of [/notifica/i, /vibra/i, /haptic/i, /primerPlano/i, /despierta/i]) {
      assert.equal(new RegExp(`${canal.source}\\s*\\(`, 'i').test(codigo), false, `la capa llama a algo que emite (${canal})`);
    }
  });

  test('La escena queda disponible y espera', () => {
    const { llegadas } = capa({ reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });

    // Nadie mira el móvil: no se avanza nada, no se cierra nada, no se pide nada. La
    // escena sigue ahí después de andar mil metros más.
    const espera = llegadas.espera();
    assert.equal(espera.sitio, TORREON);
    assert.equal(espera.cerrada, false);
    llegadas.comprueba({ posiciones: pasaPorDelante({ centroX: 2400, desdeM: -400, hastaM: 400 }) });
    assert.equal(llegadas.espera().sitio, TORREON, 'la escena ha dejado de esperar sin que nadie la mirara');
    assert.deepEqual(llegadas.espera().vigente, { ...espera.vigente });
  });

  test('Pararse en un semáforo dentro de un geofence no tiene consecuencias', () => {
    // Cuarenta segundos parada en el cruce y a seguir andando sin mirar el móvil. Valida,
    // y eso es el regalo: la escena sigue disponible para cuando vuelva.
    // Se sigue andando **alejándose**, para que lo que se afirme sea el semáforo y no lo
    // que ocurra al pasar por delante del siguiente sitio.
    const { llegadas } = capa({ reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    const semaforo = [
      ...paradoEn({ x: 1470, duracionMs: 40000, cadaMs: 5000 }),
      ...pasaPorDelante({ centroX: 1470, desdeM: 0, hastaM: -400, velocidadMs: -1.39, desdeMs: 45000 }),
    ];
    const resultado = llegadas.comprueba({ posiciones: semaforo });
    assert.deepEqual(resultado.validadas.map((v) => v.sitio), [TORREON]);
    assert.deepEqual(resultado.emite, [], 'pararse en un semáforo ha emitido algo');
    assert.equal(llegadas.espera().sitio, TORREON, 'el beat ha dejado de estar disponible después de seguir andando');
  });

  test('La escena sigue disponible después de cerrar la app y volver dos días después', () => {
    const { llegadas, estado } = capa({ reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });

    // El documento no lleva ni una coordenada ni una marca de tiempo: RF-PRIV-002.
    const documento = congelaLlegadas(estado);
    const serializado = JSON.stringify(documento);
    assert.equal(/tMs|"x"|"y"|precision/.test(serializado), false, `el documento de llegadas lleva rastro del sensor: ${serializado}`);

    // Dos días después, la misma salida sigue abierta: se levanta y la escena espera.
    const levantado = levantaLlegadas(JSON.parse(serializado));
    const { llegadas: alVolver } = capa({ estado: levantado, reparto: { beats: [beatEn(TORREON, { x: 1500 })] }, pisados: [TORREON] });
    assert.equal(alVolver.espera().sitio, TORREON);
    assert.deepEqual(escenaQueEspera(levantado).secuencia, [{ tipo: TIPOS_DE_PASO.BEAT, modo: MODOS.ENCADENADO }]);
    assert.equal(alVolver.beatDe(TORREON).lugar.nombre, TORREON, 'el beat no se ha vuelto a resolver contra el reparto al levantar');
  });

  test('Una llegada ya validada no se valida dos veces en la misma salida', () => {
    const { llegadas, estado } = capa();
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    const otraVez = llegadas.comprueba({ posiciones: paradoEn({ x: 1500, desdeMs: 600000, duracionMs: PARADA_DENTRO_MS * 2 }) });
    assert.deepEqual(otraVez.validadas, [], 'volver a pararse ha validado una segunda llegada');
    assert.deepEqual(llegadasValidadas(estado).map((l) => l.sitio), [TORREON]);
    assert.equal(estado.llegadas.length, 1, 'se ha duplicado la llegada en el registro');
  });

  test('Dos geofences solapados validan los dos y se ofrece primero el más cercano', () => {
    // Parada en la intersección: a veinte metros del torreón y a treinta de la fonte.
    const { llegadas } = capa();
    const validadas = llegadas.comprueba({ posiciones: paradoEn({ x: 1520, duracionMs: PARADA_DENTRO_MS }) }).validadas;
    assert.deepEqual(validadas.map((v) => v.sitio), [TORREON, FONTE], 'no se han validado las dos, o no en orden de cercanía');
    assert.ok(validadas[0].distanciaM < validadas[1].distanciaM);
    assert.equal(llegadas.espera().sitio, TORREON, 'la que se ofrece no es la del sitio más cercano');

    // Y la otra espera detrás: no se ha perdido nada de lo que ya ocurrió.
    llegadas.avanza();
    assert.equal(llegadas.espera().sitio, FONTE);
  });

  test('Una llegada pedida sin ninguna salida abierta falla nombrando que no hay salida', () => {
    // Se monta sin pasar por el andamiaje: lo que se afirma es que la capa exige la
    // salida, y un valor por defecto de la prueba la taparía.
    const piezas = capa().piezas;
    for (const sinSalida of [null, '', undefined]) {
      assert.throws(() => creaLlegadas({ ...piezas, salida: sinSalida }), /salida/i, `una salida ${JSON.stringify(sinSalida) ?? 'undefined'} no ha fallado`);
    }
    const { salida, ...sinNingunaSalida } = piezas;
    assert.throws(() => creaLlegadas(sinNingunaSalida), /salida/i);
  });

  test('Un sitio que no pertenece al mapa activo falla nombrando el mapa', () => {
    const { llegadas } = capa();
    assert.throws(() => llegadas.geofence('A Ponte de Ningures'), new RegExp(MAPA));
    // Y el mapa activo se exige al montar: sin él no hay dónde registrar la llegada.
    assert.throws(() => capa({ mapaId: null }), /mapa/i);
    assert.equal(capa({ mapaId: OTRO_MAPA }).llegadas.mapaId, OTRO_MAPA);
  });

  test('Un sitio sin posición falla nombrando el sitio', () => {
    assert.throws(() => geofenceDe({ nombre: TORREON, x: null, y: 0 }), new RegExp(TORREON));
    assert.throws(() => geofenceDe({ nombre: TORREON }), /posición/);
    assert.throws(() => geofenceDe({ x: 1, y: 2 }), /sitio/);
  });

  test('Un segmento sin clasificar falla nombrando el segmento', () => {
    const { llegadas } = capa();
    // Se le quita **solo** la clasificación, que es lo que esta prueba mira: la precisión
    // se conserva porque sin ella la ventana sería la larga y el último caso —el de la
    // traza bien clasificada, que sí valida— dejaría de medir lo que dice medir.
    const posiciones = paradoEn({ x: 0, duracionMs: PARADA_DENTRO_MS, cadaMs: 10000 }).map(({ x, y, tMs, precisionM }) => ({ x, y, tMs, precisionM }));
    const traza = { segmentos: [{ clasificacion: 'andando' }, { clasificacion: null }] };
    assert.throws(() => llegadas.comprueba({ posiciones, traza }), /segmento 1/);
    assert.throws(() => exigeTrazaClasificada({ segmentos: [{}] }), /segmento 0/);

    // Sin traza aparte, la clasificación viaja en la posición, y una posición sin ella
    // falla igual: no se supone que se andaba.
    assert.throws(() => llegadas.comprueba({ posiciones }), /posición 0/);

    // Con la traza bien clasificada, la llegada se valida igual que por posición.
    const { llegadas: otra } = capa();
    const buena = { segmentos: posiciones.map(() => ({ clasificacion: 'parada' })) };
    assert.deepEqual(otra.comprueba({ posiciones, traza: buena }).validadas.map((v) => v.sitio), [MONFRIDA]);
  });

  test('El módulo de las llegadas no lee el reloj, no sortea y no clasifica velocidades', () => {
    for (const ruta of [LLEGADAS, SECUENCIA]) {
      const codigo = codigoSinTextos(ruta);
      for (const prohibido of [/Date\.now/, /new Date/, /Math\.random/, /performance\.now/, /setTimeout/, /setInterval/]) {
        assert.equal(prohibido.test(codigo), false, `${ruta} usa ${prohibido}`);
      }
      for (const azar of [/makeRng/, /rng\(/]) {
        assert.equal(azar.test(codigo), false, `${ruta} siembra azar (${azar})`);
      }
      for (const velocidad of [/kmh/i, /km\/h/i, /velocidad/i, /UMBRAL_/]) {
        assert.equal(velocidad.test(codigo), false, `${ruta} clasifica velocidades por su cuenta (${velocidad})`);
      }
    }
    // La marca de tiempo viaja dentro de cada posición, y una que no la trae falla.
    const { llegadas } = capa();
    assert.throws(() => llegadas.comprueba({ posiciones: [{ x: 0, y: 0, clasificacion: 'parada' }] }), /marca de tiempo/);
  });
});

// ── La secuencia de una llegada ────────────────────────────────────────────────

describe('La secuencia de una llegada', () => {
  test('Una llegada validada entrega una lista ordenada de pasos con su tipo y su modo', () => {
    const { llegadas } = capa({ conIlustracion: [MONFRIDA] });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const secuencia = llegadas.espera().secuencia;
    assert.ok(Array.isArray(secuencia) && secuencia.length > 0);
    for (const paso of secuencia) {
      assert.deepEqual(Object.keys(paso).sort(), ['modo', 'tipo']);
      assert.ok(IDS_DE_TIPO.includes(paso.tipo), `el paso declara el tipo "${paso.tipo}"`);
      assert.ok(IDS_DE_MODO.includes(paso.modo), `el paso declara el modo "${paso.modo}"`);
    }
  });

  test('El catálogo de tipos de paso es exactamente el visor, el beat, la ficha y lo que aquí se cuenta', () => {
    assert.deepEqual([...IDS_DE_TIPO], ['visor', 'beat', 'ficha', 'lo-que-se-cuenta']);
    assert.deepEqual(Object.values(TIPOS_DE_PASO).sort(), [...IDS_DE_TIPO].sort());
    assert.equal(IDS_DE_TIPO.length, 4);
  });

  test('El catálogo de modos es exactamente encadenado y a un toque', () => {
    assert.deepEqual([...IDS_DE_MODO], ['encadenado', 'a-un-toque']);
    assert.deepEqual(Object.values(MODOS).sort(), [...IDS_DE_MODO].sort());
  });

  test('No existe una llegada que no enseñe nada', () => {
    for (const tipoDeSitio of TIPOS_DE_SITIO) {
      for (const primeraVisita of [true, false]) {
        for (const hayIlustracion of [true, false]) {
          for (const hayBeat of [true, false]) {
            const secuencia = secuenciaDeLlegada({ tipoDeSitio, primeraVisita, hayIlustracion, hayBeat });
            assert.ok(secuencia.length > 0, `${tipoDeSitio} sin pasos`);
            assert.ok(pasosEncadenados(secuencia).length > 0, `${tipoDeSitio} sin ningún paso encadenado`);
          }
        }
      }
    }
  });

  test('El visor abre por la ficción la primera vez', () => {
    const { llegadas } = capa({ conIlustracion: [TORREON] });
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    const secuencia = llegadas.espera().secuencia;
    assert.deepEqual(secuencia[0], { tipo: TIPOS_DE_PASO.VISOR, modo: MODOS.ENCADENADO });
    assert.equal(llegadas.espera().vigente.tipo, TIPOS_DE_PASO.VISOR);
  });

  test('Un sitio sin ilustración no tiene visor en ningún modo', () => {
    for (const primeraVisita of [true, false]) {
      const secuencia = secuenciaDeLlegada({ tipoDeSitio: 'paraje', primeraVisita, hayIlustracion: false, hayBeat: false });
      assert.equal(secuencia.some((p) => p.tipo === TIPOS_DE_PASO.VISOR), false, 'hay visor sin ilustración');
    }
    const { llegadas } = capa();
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    assert.deepEqual(llegadas.espera().secuencia.map((p) => p.tipo), [TIPOS_DE_PASO.FICHA]);
  });

  test('La segunda vez el visor no se abre solo', () => {
    const { llegadas } = capa({ conIlustracion: [TORREON], pisados: [TORREON] });
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    const secuencia = llegadas.espera().secuencia;
    const visor = secuencia.find((p) => p.tipo === TIPOS_DE_PASO.VISOR);
    assert.deepEqual(visor, { tipo: TIPOS_DE_PASO.VISOR, modo: MODOS.A_UN_TOQUE });
    assert.equal(pasosEncadenados(secuencia).some((p) => p.tipo === TIPOS_DE_PASO.VISOR), false, 'el visor de la segunda vez viene encadenado');
    // Y la otra mitad, que es la que decide si se abre solo: lo que la llegada ofrece es
    // lo que ha cambiado. El paso vigente de una secuencia recién validada tiene que ser
    // el primero **encadenado**, y no un paso que está a un toque.
    assert.equal(
      llegadas.espera().vigente.tipo,
      TIPOS_DE_PASO.FICHA,
      'la segunda visita ofrece el visor como paso vigente: un paso en modo "a un toque" no lo trae llegar, y la pantalla que monta el paso vigente lo abriría solo',
    );
    assert.equal(llegadas.espera().vigente.modo, MODOS.ENCADENADO);
  });

  test('El visor es una capa y debajo está el beat', () => {
    const { llegadas } = capa({ conIlustracion: [TORREON], reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    const tipos = llegadas.espera().secuencia.map((p) => p.tipo);
    assert.deepEqual(tipos, [TIPOS_DE_PASO.VISOR, TIPOS_DE_PASO.BEAT]);

    // Y cerrar el visor deja debajo la escena: el beat es el paso siguiente.
    const avanzado = llegadas.avanza();
    assert.equal(avanzado.vigente.tipo, TIPOS_DE_PASO.BEAT);
    assert.equal(llegadas.beatDe(TORREON).lugar.nombre, TORREON);
  });

  test('Un micro-encuentro mandado por la cola produce el mismo paso que un beat del lazo', () => {
    const { llegadas } = capa({ mandados: { [TORREON]: { n: 1, lugar: { nombre: TORREON, x: 1500, y: 0 } } } });
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    assert.deepEqual(llegadas.espera().secuencia.map((p) => p.tipo), [TIPOS_DE_PASO.BEAT]);

    const { llegadas: delLazo } = capa({ reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    delLazo.comprueba({ posiciones: paradaA(0, 1500) });
    assert.deepEqual(llegadas.espera().secuencia, delLazo.espera().secuencia);
  });

  test('Llegar sin haber venido a nada da la ficha del sitio', () => {
    const { llegadas } = capa();
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    const secuencia = llegadas.espera().secuencia;
    assert.deepEqual(secuencia, [{ tipo: TIPOS_DE_PASO.FICHA, modo: MODOS.ENCADENADO }]);
    assert.equal(formaDeSecuencia(secuencia), FORMAS.SOLO_FICHA);
  });

  test('Un sitio con beat no lleva la ficha: la ficha es lo que hay cuando no se ha venido a nada', () => {
    const { llegadas } = capa({ reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    assert.equal(llegadas.espera().secuencia.some((p) => p.tipo === TIPOS_DE_PASO.FICHA), false);
  });

  test('Lo que aquí se cuenta cierra la llegada a un núcleo', () => {
    const { llegadas } = capa({ conIlustracion: [MONFRIDA], reparto: { beats: [beatEn(MONFRIDA, { x: 0, tipo: 'nucleo' })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const secuencia = llegadas.espera().secuencia;
    assert.deepEqual(secuencia.map((p) => p.tipo), [TIPOS_DE_PASO.VISOR, TIPOS_DE_PASO.BEAT, TIPOS_DE_PASO.LO_QUE_SE_CUENTA]);

    // Y no antes: lo que aquí se cuenta es el último paso encadenado, siempre.
    const encadenados = pasosEncadenados(secuencia);
    assert.equal(encadenados[encadenados.length - 1].tipo, TIPOS_DE_PASO.LO_QUE_SE_CUENTA);
    const posicionDelBeat = secuencia.findIndex((p) => p.tipo === TIPOS_DE_PASO.BEAT);
    const posicionDelEstado = secuencia.findIndex((p) => p.tipo === TIPOS_DE_PASO.LO_QUE_SE_CUENTA);
    assert.ok(posicionDelEstado > posicionDelBeat, 'lo que aquí se cuenta va antes que el beat');
  });

  test('Sin beat, lo que se cuenta es la llegada entera', () => {
    const { llegadas } = capa();
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const secuencia = llegadas.espera().secuencia;
    assert.deepEqual(secuencia, [{ tipo: TIPOS_DE_PASO.LO_QUE_SE_CUENTA, modo: MODOS.ENCADENADO }]);
    assert.equal(formaDeSecuencia(secuencia), FORMAS.LO_QUE_SE_CUENTA_ENTERO);
    assert.equal(llegadas.espera().vigente.tipo, TIPOS_DE_PASO.LO_QUE_SE_CUENTA, 'lo primero que se ve no es lo que allí se cuenta');

    // Con visor de primera visita, sigue siendo el único paso encadenado además del visor.
    const encadenadosConVisor = pasosEncadenados(secuenciaDeLlegada({ tipoDeSitio: 'nucleo', primeraVisita: true, hayIlustracion: true, hayBeat: false }));
    assert.deepEqual(encadenadosConVisor.map((p) => p.tipo), [TIPOS_DE_PASO.VISOR, TIPOS_DE_PASO.LO_QUE_SE_CUENTA]);
  });

  test('Un paraje nunca lleva lo que aquí se cuenta', () => {
    for (const tipoDeSitio of ['paraje', 'servicio']) {
      for (const primeraVisita of [true, false]) {
        for (const hayIlustracion of [true, false]) {
          for (const hayBeat of [true, false]) {
            const secuencia = secuenciaDeLlegada({ tipoDeSitio, primeraVisita, hayIlustracion, hayBeat });
            assert.equal(
              secuencia.some((p) => p.tipo === TIPOS_DE_PASO.LO_QUE_SE_CUENTA),
              false,
              `un ${tipoDeSitio} lleva lo que aquí se cuenta`,
            );
          }
        }
      }
    }
    const { llegadas } = capa();
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    assert.throws(() => llegadas.loQueAquiSeCuenta({ sitio: TORREON, dia: 1, paso: 1 }), /paraje/);
  });

  test('Ninguna secuencia repite un paso', () => {
    for (const tipoDeSitio of TIPOS_DE_SITIO) {
      for (const primeraVisita of [true, false]) {
        for (const hayIlustracion of [true, false]) {
          for (const hayBeat of [true, false]) {
            const secuencia = secuenciaDeLlegada({ tipoDeSitio, primeraVisita, hayIlustracion, hayBeat });
            const tipos = secuencia.map((p) => p.tipo);
            assert.equal(new Set(tipos).size, tipos.length, `${tipoDeSitio} repite un paso: ${tipos.join(', ')}`);
          }
        }
      }
    }
    assert.throws(() => exigeSecuencia([{ tipo: TIPOS_DE_PASO.FICHA, modo: MODOS.ENCADENADO }, { tipo: TIPOS_DE_PASO.FICHA, modo: MODOS.ENCADENADO }]), /repite/);
  });

  test('No existe ninguna operación que salte a un paso concreto de la secuencia', () => {
    const { llegadas } = capa({ conIlustracion: [MONFRIDA], reparto: { beats: [beatEn(MONFRIDA, { x: 0, tipo: 'nucleo' })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    for (const salto of ['vaAlPaso', 'saltaA', 'irA', 'navega', 'retrocede', 'atras']) {
      assert.equal(Object.prototype.hasOwnProperty.call(llegadas, salto), false, `la capa expone "${salto}"`);
    }
    for (const operacion of ['saltar-a-un-paso', 'volver-al-paso-anterior', 'navegar-a-un-paso']) {
      assert.ok(OPERACIONES_QUE_NO_EXISTEN.includes(operacion), `"${operacion}" no está declarada como operación que no existe`);
    }

    // Y la única manera de moverse es hacia adelante, de uno en uno.
    const secuencia = llegadas.espera().secuencia;
    assert.equal(avanzaLaSecuencia(secuencia, 0).paso, 1);
    assert.equal(pasoVigente(secuencia, 0).indice, 0);
    assert.throws(() => pasoVigente(secuencia, secuencia.length + 1), /paso vigente/);

    // Ni la app tiene enrutador que lo permita: monta el paso vigente y nada más.
    const pantalla = codigoDe('app/pantallas/llegada.js');
    for (const enrutador of [/navigation/i, /router/i, /useNavigate/, /Stack\./, /goBack/]) {
      assert.equal(enrutador.test(pantalla), false, `la pantalla de la llegada usa ${enrutador}`);
    }
  });

  test('Una secuencia recorrida hasta el final cierra la llegada y no vuelve a ofrecerse', () => {
    const { llegadas } = capa({ conIlustracion: [MONFRIDA], reparto: { beats: [beatEn(MONFRIDA, { x: 0, tipo: 'nucleo' })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const pasos = llegadas.espera().secuencia.length;
    for (let i = 1; i < pasos; i++) assert.equal(llegadas.avanza().cerrada, false, `la llegada se ha cerrado en el paso ${i}`);
    const ultimo = llegadas.avanza();
    assert.equal(ultimo.cerrada, true);
    assert.equal(ultimo.siguiente, null);
    assert.equal(llegadas.espera(), null);
    assert.throws(() => llegadas.avanza(), /esperando/);

    // Y volver a pararse en el mismo sitio no la reabre.
    assert.deepEqual(llegadas.comprueba({ posiciones: paradoEn({ x: 0, desdeMs: 900000, duracionMs: PARADA_DENTRO_MS }) }).validadas, []);
    assert.equal(llegadas.espera(), null);
  });

  test('Una secuencia abandonada a mitad continúa por el paso donde iba', () => {
    const { llegadas, estado } = capa({ conIlustracion: [MONFRIDA], reparto: { beats: [beatEn(MONFRIDA, { x: 0, tipo: 'nucleo' })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    llegadas.avanza();
    assert.equal(llegadas.espera().vigente.tipo, TIPOS_DE_PASO.BEAT);

    // La app se cierra entre dos pasos y se vuelve a abrir todavía dentro del geofence.
    const documento = JSON.parse(JSON.stringify(congelaLlegadas(estado)));
    const { llegadas: alVolver } = capa({
      estado: levantaLlegadas(documento),
      conIlustracion: [MONFRIDA],
      reparto: { beats: [beatEn(MONFRIDA, { x: 0, tipo: 'nucleo' })] },
      pisados: [MONFRIDA],
    });
    assert.equal(alVolver.espera().vigente.tipo, TIPOS_DE_PASO.BEAT, 'la secuencia ha vuelto a empezar');
    assert.equal(alVolver.espera().vigente.indice, 1);
    assert.deepEqual(alVolver.espera().secuencia, [...llegadas.espera().secuencia]);
  });

  test('La misma llegada pedida dos veces desde el mismo estado da la misma secuencia', () => {
    const { llegadas } = capa({ conIlustracion: [MONFRIDA], reparto: { beats: [beatEn(MONFRIDA, { x: 0, tipo: 'nucleo' })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    assert.equal(JSON.stringify(llegadas.espera()), JSON.stringify(llegadas.espera()));
    assert.equal(
      JSON.stringify(secuenciaDeLlegada({ tipoDeSitio: 'nucleo', primeraVisita: true, hayIlustracion: true, hayBeat: true })),
      JSON.stringify(secuenciaDeLlegada({ tipoDeSitio: 'nucleo', primeraVisita: true, hayIlustracion: true, hayBeat: true })),
    );
  });

  test('Las cuatro formas de secuencia ocurren en los ocho mundos de referencia', async () => {
    // Sobre los ocho mundos y su reparto casteado, no sobre un caso construido: un mundo
    // inventado a medida donde salen las cuatro formas no demuestra nada del juego. Cada
    // mundo se recorre con cada una de sus aventuras que castea, más la salida sin
    // aventura aceptada —`{ beats: [] }`, que es el caso más común de todos—, y cada sitio
    // con las dos visitas y con ilustración y sin ella.
    const cuenta = new Map(IDS_DE_FORMA.map((f) => [f, 0]));
    for (const nombre of LOS_CUATRO) {
      for (const semilla of LAS_DOS_SEMILLAS) {
        const mundo = await generaMundo(nombre, semillaDe(nombre, semilla));
        const sitios = sitiosConPosicion(mundo);
        const repartos = [{ beats: [] }, ...mundo.casting.filter((c) => c.ok).map((c) => ({ beats: c.beats }))];
        for (const reparto of repartos) {
          const conBeat = new Set(reparto.beats.map((b) => b.lugar?.nombre ?? b.lugar));
          for (const [sitio, geofence] of sitios) {
            for (const primeraVisita of [true, false]) {
              for (const hayIlustracion of [true, false]) {
                const forma = formaDeSecuencia(secuenciaDeLlegada({
                  tipoDeSitio: geofence.tipo,
                  primeraVisita,
                  hayIlustracion,
                  hayBeat: conBeat.has(sitio),
                }));
                cuenta.set(forma, cuenta.get(forma) + 1);
              }
            }
          }
        }
      }
    }

    for (const forma of FORMAS_DECLARADAS) {
      assert.ok(cuenta.get(forma) > 0, `la forma "${forma}" no ocurre en ninguno de los ocho mundos de referencia`);
    }
    // Y la quinta, que existe porque existe en el mundo: un beat del lazo puede caer en un
    // paraje o en un servicio, y entonces no hay ni ficha ni estado del pueblo.
    assert.ok(cuenta.get(FORMAS.BEAT_SIN_NUCLEO) > 0, 'ningún beat de los ocho mundos cae fuera de un núcleo');

    // El recuento exacto, que es lo que convierte esto en una red y no en una anécdota:
    // cambiar el orden, la condición del visor o el reparto de la ficha lo mueve. Los
    // números son los del recorrido de arriba —ocho mundos, cada aventura que castea más
    // la salida sin aventura, cada sitio con las dos visitas y con ilustración y sin
    // ella— y solo significan algo con él: otro recorrido da otros números sin que el
    // código haya cambiado.
    assert.deepEqual(Object.fromEntries([...cuenta].sort()), {
      'beat-con-lo-que-se-cuenta': 1360,
      'beat-sin-nucleo': 1048,
      'ficha-con-visor': 2516,
      'lo-que-se-cuenta-entero': 3976,
      'solo-ficha': 7548,
    });
  });
});

// ── Lo que aquí se cuenta ──────────────────────────────────────────────────────

describe('Lo que aquí se cuenta', () => {
  /** Un mundo, dos núcleos, y lo que cada uno oyó del mismo suceso. */
  function conNucleos({ enMonfrida = [], enVilaboa = [], pisados = [], diario = estadoDeDiario() } = {}) {
    const nucleos = estadoDeNucleos();
    for (const v of enMonfrida) sedimenta(nucleos, { mapaId: MAPA, nucleo: MONFRIDA, loQueLlego: v });
    for (const v of enVilaboa) sedimenta(nucleos, { mapaId: MAPA, nucleo: VILABOA, loQueLlego: v });
    const montado = capa({
      pisados,
      diario,
      loQueSeCuenta: { versionesDe: (nucleo) => loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo }) },
    });
    return { ...montado, nucleos };
  }

  test('Lo que aflora en un núcleo es lo que ese núcleo oyó y no lo de ningún otro', () => {
    const { llegadas } = conNucleos({
      enMonfrida: [version({ rumor: 'las-campanas', veces: 3 })],
      enVilaboa: [version({ rumor: 'el-farol', veces: 1 })],
    });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const aflorado = llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 });
    assert.deepEqual(aflorado.pantalla.loQueCuentanAqui.versiones.map((v) => v.rumor), ['las-campanas']);
    assert.equal(aflorado.pantalla.antetitulo, antetituloDe(MONFRIDA));
    assert.equal(aflorado.sitio, MONFRIDA);
  });

  test('Dos núcleos que oyeron el mismo suceso en niveles distintos cuentan cada uno la suya', () => {
    const { llegadas } = conNucleos({
      enMonfrida: [version({ rumor: 'las-campanas', nivel: 0, veces: 1 })],
      enVilaboa: [version({ rumor: 'las-campanas', nivel: 2, veces: 9 })],
    });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    llegadas.comprueba({ posiciones: paradoEn({ x: 3000, desdeMs: 600000, duracionMs: PARADA_DENTRO_MS }) });

    const enMonfrida = llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 });
    const enVilaboa = llegadas.loQueAquiSeCuenta({ sitio: VILABOA, dia: 3, paso: 9 });
    assert.equal(enMonfrida.pantalla.loQueCuentanAqui.versiones[0].hechos.escala.veces, 1);
    assert.equal(enVilaboa.pantalla.loQueCuentanAqui.versiones[0].hechos.escala.veces, 9);
  });

  test('Lo que aflora al llegar no lleva el nivel de deformación ni ninguna etiqueta de fiabilidad', () => {
    const { llegadas } = conNucleos({ enMonfrida: [version({ nivel: 3, veces: 27 })] });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const { pantalla } = llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 });
    const serializado = JSON.stringify(pantalla);
    assert.equal(/"nivel"|fiabilidad|deformaci|"ejes"|"oidoEn"/.test(serializado), false, `lo que va a pantalla lleva el nivel: ${serializado}`);
    for (const version of pantalla.loQueCuentanAqui.versiones) {
      assert.deepEqual(Object.keys(version).sort(), ['hechos', 'origen', 'plantilla', 'rumor', 'signo', 'texto']);
    }
  });

  test('Un núcleo que no ha oído nada enseña la pantalla igual y no lo llama error', () => {
    const { llegadas } = conNucleos({ enMonfrida: [] });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const { pantalla, anotado } = llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 });
    assert.equal(pantalla.hayAlgoQueContar, false);
    assert.equal(pantalla.sinNada, TEXTOS.nadaQueContar);
    assert.equal(pantalla.seguir, TEXTOS.seguir);
    assert.deepEqual(pantalla.loQueCuentanAqui.versiones, []);
    assert.deepEqual(anotado.nuevas ?? [], []);
    for (const palabra of [/error/i, /fallo/i, /hueco/i, /falta/i, /vacío/i, /todavía/i]) {
      assert.equal(palabra.test(pantalla.sinNada), false, `el texto del núcleo que calla lo llama ${palabra}`);
    }
  });

  test('Lo que llegó sobre la jugadora aparece por el mismo canal y en su versión', () => {
    const { llegadas } = conNucleos({
      enMonfrida: [
        version({ rumor: 'las-campanas', protagonista: PROTAGONISTAS.VECINDARIO }),
        version({ rumor: 'lo-tuyo', protagonista: PROTAGONISTAS.JUGADORA, veces: 9 }),
      ],
    });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const { pantalla } = llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 });
    assert.equal(pantalla.deTi.titulo, TEXTOS.deTi);
    assert.deepEqual(pantalla.deTi.versiones.map((v) => v.rumor), ['lo-tuyo']);
    assert.equal(pantalla.deTi.versiones[0].hechos.escala.veces, 9, 'lo de la jugadora no llega en su versión');
    assert.deepEqual(pantalla.loQueCuentanAqui.versiones.map((v) => v.rumor), ['las-campanas']);

    // Y sin nada que se cuente de ella, la sección no existe: enseñarla vacía sería un
    // marcador de reputación con otras palabras.
    const { llegadas: sinNadaDeTi } = conNucleos({ enMonfrida: [version({ rumor: 'las-campanas', protagonista: PROTAGONISTAS.VECINDARIO })] });
    sinNadaDeTi.comprueba({ posiciones: paradaA(0, 0) });
    assert.equal(sinNadaDeTi.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 }).pantalla.deTi, null);
  });

  test('No existe ninguna consulta que devuelva el estado de todos los núcleos a la vez', () => {
    const { llegadas } = conNucleos({ enMonfrida: [version()] });
    // Ni en la capa, ni en las pantallas que esta fila entrega.
    for (const panel of ['estadoDeLosNucleos', 'todosLosNucleos', 'panel', 'resumen', 'porMapa']) {
      assert.equal(Object.prototype.hasOwnProperty.call(llegadas, panel), false, `la capa expone "${panel}"`);
    }
    for (const ruta of ['app/pantallas/lo-que-se-cuenta.js', 'app/pantallas/llegada.js']) {
      const codigo = codigoDe(ruta);
      for (const panel of [/todosLosNucleos/, /versionesDe\s*\(/, /loQueSeCuentaEn/, /nucleosDeMapa/]) {
        assert.equal(panel.test(codigo), false, `${ruta} consulta el estado del mundo por su cuenta (${panel})`);
      }
    }
    // La pantalla recibe hecho lo que pinta, y no sabe pedir nada.
    assert.match(fuente('app/pantallas/lo-que-se-cuenta.js'), /loQueSeCuenta/);
  });

  test('No existe manera de consultar el estado de un núcleo sin haber llegado a él', () => {
    const { llegadas } = conNucleos({ enMonfrida: [version()] });
    assert.throws(() => llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 }), /llegada validada/);
    assert.throws(() => llegadas.beatDe(MONFRIDA), /llegada validada/);

    // Y con la llegada validada, sí.
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    assert.equal(llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 }).sitio, MONFRIDA);
  });

  test('Lo que aflora queda anotado en el diario con el sitio y el momento', () => {
    const diario = estadoDeDiario();
    const { llegadas } = conNucleos({ enMonfrida: [version({ rumor: 'las-campanas' })], diario });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const { pantalla } = llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 });

    const entradas = entradasDe(diario, { mapaId: MAPA });
    assert.equal(entradas.length, 1);
    assert.equal(entradas[0].suceso, 'las-campanas');
    assert.equal(entradas[0].lugar, MONFRIDA);
    assert.deepEqual([entradas[0].dia, entradas[0].paso], [3, 7]);
    // La línea del diario es una constatación y no un botón.
    assert.equal(pantalla.diario, TEXTOS.diario);
  });

  test('Dos versiones del mismo suceso conviven en el diario y ninguna sobrescribe a la otra', () => {
    const diario = estadoDeDiario();
    const enMonfrida = [version({ rumor: 'las-campanas', nivel: 0, veces: 1 })];
    const enVilaboa = [version({ rumor: 'las-campanas', nivel: 2, veces: 9 })];
    const { llegadas } = conNucleos({ enMonfrida, enVilaboa, diario });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    llegadas.comprueba({ posiciones: paradoEn({ x: 3000, desdeMs: 600000, duracionMs: PARADA_DENTRO_MS }) });
    llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 });
    const segunda = llegadas.loQueAquiSeCuenta({ sitio: VILABOA, dia: 3, paso: 9 });

    const entradas = entradasDeSuceso(diario, { mapaId: MAPA, suceso: 'las-campanas' });
    assert.equal(entradas.length, 2, 'la segunda versión ha sobrescrito a la primera');
    assert.deepEqual(entradas.map((e) => e.hechos.escala.veces).sort(), [1, 9]);

    // Y la primera triangulación queda declarada, para que la fila 37 pueda existir.
    assert.equal(segunda.triangulacion, true);
    assert.equal(diario.triangulado, true);
    // Solo la primera vez: declararlo dos veces sería contar dos primeras veces.
    assert.equal(llegadas.loQueAquiSeCuenta({ sitio: VILABOA, dia: 3, paso: 9 }).triangulacion, false);
  });

  test('En un mundo en gallego los nombres son los que produjo su paquete de idioma', async () => {
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    assert.equal(mundo.locale, 'gl');
    const nucleo = mundo.settlements[0];
    const nucleos = estadoDeNucleos();
    sedimenta(nucleos, { mapaId: MAPA, nucleo: nucleo.name, loQueLlego: version({ origen: nucleo.name }) });

    const { llegadas } = capa({
      mundo,
      loQueSeCuenta: { versionesDe: (n) => loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n }) },
    });
    llegadas.comprueba({ posiciones: paradoEn({ x: nucleo.x, y: nucleo.y, duracionMs: PARADA_DENTRO_MS }) });
    const { pantalla } = llegadas.loQueAquiSeCuenta({ sitio: nucleo.name, dia: 1, paso: 1 });
    assert.equal(pantalla.sitio, nucleo.name);
    assert.equal(pantalla.antetitulo, `En ${nucleo.name} se habla de`);
    assert.ok(mundo.settlements.some((s) => s.name === pantalla.sitio), 'el nombre no es uno de los del mundo');
  });

  test('Ningún texto de este paso lleva una cifra', () => {
    for (const [clave, texto] of Object.entries(TEXTOS)) {
      assert.equal(/\d/.test(texto), false, `el texto "${clave}" lleva una cifra en dígitos: "${texto}"`);
    }
    assert.equal(/\d/.test(antetituloDe(MONFRIDA)), false);
    assert.equal(revisaLosTextos({ locale: 'es' }), true);
    assert.equal(revisaLosTextos({ locale: 'gl' }), true);
    // Y el cribado es de verdad: un texto con una cifra escrita con letra falla donde nace.
    assert.throws(() => revisaLosTextos({ extra: ['Quedan tres leguas hasta el pueblo'] }), /cifra/);

    const { llegadas } = capa();
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const { pantalla } = llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 3, paso: 7 });
    assert.equal(/\d/.test(JSON.stringify(pantalla)), false, `lo que va a pantalla lleva una cifra: ${JSON.stringify(pantalla)}`);
  });
});

// ── Nada degrada por falta de cableado ─────────────────────────────────────────

describe('Nada degrada por falta de cableado', () => {
  test('El reparto no cableado falla nombrando lo que falta', () => {
    const piezas = capa().piezas;
    for (const sinReparto of [undefined, null, {}, { beats: null }]) {
      assert.throws(() => creaLlegadas({ ...piezas, reparto: sinReparto }), /reparto/, `un reparto ${JSON.stringify(sinReparto) ?? 'undefined'} no ha fallado`);
    }
    // Una salida sin aventura aceptada se declara, no se deduce.
    assert.doesNotThrow(() => capa({ reparto: { beats: [] } }));
  });

  test('Un beat cuyo lugar no es un sitio del mundo falla nombrando el lugar', () => {
    const fuera = beatEn('A Ponte de Ningures', { x: 9000 });
    assert.throws(() => capa({ reparto: { beats: [fuera] } }), /A Ponte de Ningures/);
    assert.throws(() => capa({ reparto: { beats: [{ n: 1, lugar: null }] } }), /lugar del beat/);
  });

  test('La cola de entregas no cableada falla nombrando la cola', () => {
    assert.throws(() => capa({ cola: null }), /cola de entregas/);
    assert.throws(() => capa({ cola: {} }), /cola de entregas/);
  });

  test('La capa de lo que se cuenta no cableada falla nombrándola', () => {
    assert.throws(() => capa({ loQueSeCuenta: null }), /lo que se cuenta/);
    assert.throws(() => capa({ loQueSeCuenta: { versionesDe: 'sí' } }), /lo que se cuenta/);
    // Y una capa que responde con algo que no es una lista tampoco pasa por callada.
    const { llegadas } = capa({ loQueSeCuenta: { versionesDe: () => null } });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    assert.throws(() => llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 1, paso: 1 }), /lista vacía/);
  });

  test('Un núcleo que calla y un núcleo sin cablear son distinguibles', () => {
    // El primero es un estado: la pantalla existe y dice que hoy no se cuenta nada.
    const { llegadas } = capa({ cuentan: { [MONFRIDA]: [] } });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    const callado = llegadas.loQueAquiSeCuenta({ sitio: MONFRIDA, dia: 1, paso: 1 });
    assert.equal(callado.pantalla.hayAlgoQueContar, false);
    assert.equal(callado.pantalla.sinNada, TEXTOS.nadaQueContar);

    // El segundo es un error, y ocurre al montar la capa: nunca llega a haber pantalla.
    assert.throws(() => capa({ loQueSeCuenta: null }), /no está cableada|no está cableado/);
  });

  test('El detector de transporte ausente falla en lugar de validar suponiendo que se andaba', () => {
    const { llegadas } = capa({ detector: detectorSinMontar() });
    assert.throws(() => llegadas.comprueba({ posiciones: paradaA(0, 0) }), /detector de transporte/);
    const { llegadas: sinNada } = capa({ detector: null });
    assert.throws(() => sinNada.comprueba({ posiciones: paradaA(0, 0) }), /ausente/);
    // Y la capa de ilustraciones y el registro de pisados, igual: sin ellos no hay visor
    // nunca, o toda llegada sería la primera.
    assert.throws(() => capa({ ilustraciones: null }), /ilustraciones/);
    assert.throws(() => capa({ visitados: { yaVisitado: () => false } }), /pisados/);
  });

  test('Un sitio sin beat conserva su nombre y su posición y no produce beat', () => {
    // El gesto de marcar un anclaje que no vale es de la fila 35 y no está en disco: lo que
    // aquí se afirma es la mitad que esta capa sostiene —un sitio que no da beat sigue
    // siendo un sitio entero— y no el mecanismo de marcarlo.
    const { llegadas } = capa({ reparto: { beats: [beatEn(FONTE, { x: 1550 })] } });
    const geofence = llegadas.geofence(TORREON);
    assert.deepEqual(geofence, { nombre: TORREON, tipo: 'paraje', x: 1500, y: 0, radioM: RADIO_DE_GEOFENCE_M });
    llegadas.comprueba({ posiciones: paradoEn({ x: 1480, duracionMs: PARADA_DENTRO_MS }) });
    assert.equal(llegadas.beatDe(TORREON), null);
    assert.equal(llegadas.espera().secuencia.some((p) => p.tipo === TIPOS_DE_PASO.BEAT), false);
  });
});

// ── Ni la capa ni la pantalla guardan de más ───────────────────────────────────

describe('Ni la capa ni la pantalla guardan de más', () => {
  test('El área del estado guarda la llegada, el paso vigente y las escenas que esperan, y nada más', () => {
    assert.deepEqual(estadoDeLlegadas(), { salida: null, llegadas: [] });
    const { llegadas, estado } = capa({ conIlustracion: [MONFRIDA], reparto: { beats: [beatEn(MONFRIDA, { x: 0, tipo: 'nucleo' })] } });
    llegadas.comprueba({ posiciones: paradaA(0, 0) });
    llegadas.avanza();
    const documento = congelaLlegadas(estado);
    assert.deepEqual(Object.keys(documento).sort(), ['llegadas', 'salida']);
    assert.deepEqual(Object.keys(documento.llegadas[0]).sort(), ['cerrada', 'mapa', 'paso', 'secuencia', 'sitio']);
    assert.equal(documento.llegadas[0].paso, 1);
    // El beat no viaja en el documento: se vuelve a resolver contra el reparto.
    assert.equal(Object.prototype.hasOwnProperty.call(documento.llegadas[0], 'beat'), false, 'el documento guarda una copia del beat');
    for (const paso of documento.llegadas[0].secuencia) assert.deepEqual(Object.keys(paso).sort(), ['modo', 'tipo']);
  });

  test('Una salida nueva empieza sin ninguna llegada de la anterior', () => {
    const { llegadas, estado } = capa();
    llegadas.comprueba({ posiciones: paradaA(0, 1500) });
    assert.equal(estado.llegadas.length, 1);
    const { llegadas: manana } = capa({ estado, salida: 'la-salida-de-manana' });
    assert.equal(manana.espera(), null, 'la escena de ayer sigue esperando en la salida de hoy');
    assert.deepEqual(estado.llegadas, []);
  });

  test('Un registro de llegadas mal formado falla al leerse en lugar de darse por vacío', () => {
    for (const roto of [null, {}, { llegadas: 'ninguna' }]) {
      assert.throws(() => llegadasValidadas(roto), /registro de llegadas/, `un registro ${JSON.stringify(roto)} ha pasado`);
    }
    assert.throws(() => levantaLlegadas({ salida: SALIDA, llegadas: [{ mapa: MAPA, sitio: TORREON, secuencia: [], paso: 0 }] }), /secuencia guardada/);
    assert.throws(
      () => levantaLlegadas({ salida: SALIDA, llegadas: [{ mapa: MAPA, sitio: TORREON, secuencia: [{ tipo: 'ficha', modo: 'encadenado' }], paso: 7 }] }),
      /paso/,
    );
  });

  test('La pantalla de lo que aquí se cuenta no tiene camino de vuelta ni decide nada', () => {
    const pantalla = codigoDe('app/pantallas/lo-que-se-cuenta.js');
    for (const vuelta of [/goBack/, /atras/i, /flecha/i, /cabecera/i, /navigation/i, /header/i]) {
      assert.equal(vuelta.test(pantalla), false, `A4P5 tiene camino de vuelta (${vuelta})`);
    }
    // Un solo control, y es «Seguir».
    assert.equal((pantalla.match(/<Pressable/g) ?? []).length, 1, 'A4P5 tiene más de un control');
    for (const testid of ['lo-que-se-cuenta', 'lo-que-se-cuenta-de-ti', 'llegada-seguir', 'momento-estado']) {
      assert.match(pantalla, new RegExp(`testID="${testid}"`), `falta el data-testid "${testid}"`);
    }
    for (const testid of ['llegada-secuencia', 'llegada-paso', 'visor-a-un-toque']) {
      assert.match(codigoDe('app/pantallas/llegada.js'), new RegExp(`testID="${testid}"`), `falta el data-testid "${testid}"`);
    }
    // Y el nivel no llega hasta ella: lo que pinta es lo que la capa entrega.
    assert.equal(/nivel/i.test(pantalla), false, 'A4P5 conoce el nivel de deformación');
  });

  test('Ningún módulo del paquete consume las llegadas para consultar un núcleo por su cuenta', () => {
    const consumidores = modulosDelPaquete().filter((m) => m !== LLEGADAS && /partida\/llegadas\.js/.test(fuente(m)));
    assert.deepEqual(consumidores, [], `un módulo del paquete consume las llegadas: ${consumidores.join(', ')}`);
    // La distancia se mide en el plano métrico del mundo y no con coordenadas de verdad.
    assert.equal(distanciaAlGeofence({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
    assert.throws(() => distanciaAlGeofence({ x: 0, y: 0 }, { x: null, y: 0 }), /sin punto/);
  });
});

// ── El muestreo mientras hay un geofence cerca ─────────────────────────────────
//
// SPEC-044 · §9a. La otra mitad del defecto que dejaba la capa sin poder dispararse:
// `distanceInterval: 10` es un filtro duro del `LocationRequest` de Android, así que **parada
// no llega ninguna posición** —medido, un fijo en trescientos segundos con GPS perfecto— y la
// permanencia se cuenta sobre posiciones que llegan.
//
// La decisión vive en el paquete y no en la app porque lo que la gobierna es dónde están los
// sitios a los que se llega, que es una regla de juego. Lo que se afirma aquí es la función;
// que el aparato la aplique de verdad se afirma en `test/nucleo/marcha.test.mjs`.

describe('El muestreo mientras hay un geofence cerca', () => {
  const CADENCIA_POR_DISTANCIA_M = 10;
  const cadencia = (posicion, vigente = null, mundo = mundoDePrueba()) => cadenciaDeMuestreo({
    posicion,
    sitios: sitiosConPosicion(mundo),
    vigente,
    metrosPorDistancia: CADENCIA_POR_DISTANCIA_M,
  });

  test('Fuera de todo geofence la cadencia es la de SPEC-048, por distancia', () => {
    const fuera = cadencia({ x: 800, y: 0 });
    assert.equal(fuera.modo, CADENCIAS.POR_DISTANCIA);
    assert.equal(fuera.metros, CADENCIA_POR_DISTANCIA_M, 'la cadencia por distancia no es la que entra por la firma');
    assert.equal(fuera.segundos, null, 'hay una cadencia por tiempo puesta fuera de todo geofence');
    assert.equal(fuera.sitio, null);

    // Y las dos son un vocabulario cerrado: una cadencia inventada no se puede leer.
    assert.deepEqual([...IDS_DE_CADENCIA], ['por-distancia', 'por-tiempo']);
    assert.ok(IDS_DE_CADENCIA.includes(fuera.modo));
  });

  test('Con un geofence debajo la cadencia pasa a ser por tiempo, cada cinco segundos', () => {
    // Cinco, y no por gusto: §9c fijó los dos pares ventana/deriva midiendo con esta
    // cadencia, y cambiarla invalidaría la tabla entera.
    const dentro = cadencia({ x: 1500, y: 0 });
    assert.equal(dentro.modo, CADENCIAS.POR_TIEMPO);
    assert.equal(dentro.segundos, CADENCIA_CERCA_S);
    assert.equal(CADENCIA_CERCA_S, 5);
    assert.equal(dentro.metros, null, 'una cadencia con las dos puestas no existe');
    assert.equal(dentro.sitio, TORREON);

    // Y el borde por sus dos mitades, sobre un sitio sin vecino: dentro del radio sí, fuera
    // no. Se mide en «Monfrida» y no en el torreón porque allí la fonte está a cincuenta
    // metros y el borde de uno cae dentro del otro.
    assert.equal(cadencia({ x: RADIO_DE_GEOFENCE_M, y: 0 }).modo, CADENCIAS.POR_TIEMPO);
    assert.equal(cadencia({ x: RADIO_DE_GEOFENCE_M + 1, y: 0 }).modo, CADENCIAS.POR_DISTANCIA);
  });

  test('Una salida que se abre con quien juega ya parada dentro arranca por tiempo', () => {
    // El punto de partida sirve de última posición conocida, que es lo que evita esperar a
    // un fijo que no va a llegar: con la cadencia de distancia puesta y sin moverse, no
    // llega ninguno, y la salida se quedaría por distancia para siempre.
    assert.equal(cadencia({ x: 1500, y: 0 }, null).modo, CADENCIAS.POR_TIEMPO);
    // Sin posición no se supone que no hay sitio debajo: se falla nombrándolo.
    assert.throws(() => cadencia(null), /última posición conocida/);
    assert.throws(() => cadenciaDeMuestreo({ posicion: { x: 0, y: 0 }, sitios: null, metrosPorDistancia: 10 }), /sitiosConPosicion/);
    assert.throws(() => cadenciaDeMuestreo({ posicion: { x: 0, y: 0 }, sitios: new Map(), metrosPorDistancia: null }), /cadencia por distancia/);
  });

  test('La histéresis impide cambiar de cadencia en cada muestra del borde', () => {
    // Sin ella, un fijo ruidoso en el borde entraría y saldría del geofence en cada muestra,
    // y volver a pedir la suscripción no es gratis. Veinte metros son el orden del ruido que
    // la propia tabla de §9c considera normal.
    assert.equal(MARGEN_DE_CERCANIA_M, 20);
    const justoFuera = { x: RADIO_DE_GEOFENCE_M + 5, y: 0 };
    // Entrando —vigente por distancia— ese punto todavía está fuera.
    assert.equal(cadencia(justoFuera, CADENCIAS.POR_DISTANCIA).modo, CADENCIAS.POR_DISTANCIA);
    // Saliendo —vigente por tiempo— sigue contando como dentro: entrar cuesta el radio y
    // salir el radio más el margen, y esa asimetría es toda la histéresis.
    assert.equal(cadencia(justoFuera, CADENCIAS.POR_TIEMPO).modo, CADENCIAS.POR_TIEMPO);

    // Alejarse de verdad sí devuelve la cadencia por distancia.
    const lejos = { x: RADIO_DE_GEOFENCE_M + MARGEN_DE_CERCANIA_M + 1, y: 0 };
    assert.equal(cadencia(lejos, CADENCIAS.POR_TIEMPO).modo, CADENCIAS.POR_DISTANCIA);

    // Y una cadencia vigente inventada falla aquí, no en la suscripción.
    assert.throws(() => cadencia({ x: 0, y: 0 }, 'cada-rato'), /cadencia vigente/);
  });

  test('Con geofences solapados la cadencia nombra el sitio más cercano', () => {
    // El mismo criterio con el que se ordenan dos llegadas validadas a la vez: dos criterios
    // distintos para lo mismo es cómo se desincronizan.
    const entreLosDos = cadencia({ x: 1520, y: 0 });
    assert.equal(entreLosDos.sitio, TORREON);
    assert.equal(Math.round(entreLosDos.distanciaM), 20);
    assert.equal(cadencia({ x: 1540, y: 0 }).sitio, FONTE);
  });

  test('Un mundo sin ningún sitio no cambia de cadencia y no falla', () => {
    // Un índice ausente y un mundo sin sitios tienen que ser distinguibles: el primero es un
    // cableado a medias y falla; el segundo es un estado normal y responde.
    const vacio = cadenciaDeMuestreo({ posicion: { x: 0, y: 0 }, sitios: new Map(), metrosPorDistancia: CADENCIA_POR_DISTANCIA_M });
    assert.equal(vacio.modo, CADENCIAS.POR_DISTANCIA);
    assert.equal(vacio.sitio, null);
    assert.equal(vacio.distanciaM, null);
  });
});

// ── El punto de partida cuenta para la cadencia ────────────────────────────────
//
// SPEC-044-iter-1. La otra mitad del mismo agujero, y la que dejaba el telón sin poder
// caer: con la cadencia por distancia y quien juega parada **no llega ninguna posición**
// —medido el 13-ago-2026 en `wa-pixel`: cero fijos en 5 min 56 s, el primero a los 355,8 s
// y solo al mover—, así que quien vuelve a casa y se queda quieta no acumula permanencia y
// el regreso no puede cerrarse. Con el punto de partida contando, al volver ya se muestrea
// por tiempo y la permanencia acumula.
//
// Entra **por la firma y no al índice**, y esa es la mitad importante: el índice alimenta a
// la vez la cadencia y las llegadas, así que meterlo ahí convertiría el portal de casa en un
// sitio al que se llega, con su escena y su ficha. La separación es de forma.

describe('El punto de partida cuenta para la cadencia', () => {
  const CADENCIA_POR_DISTANCIA_M = 10;
  /** La cadencia con el punto de partida por la firma, sobre el mundo de prueba. */
  const enCasa = (posicion, { puntoDePartida = { x: 0, y: 0 }, vigente = null, mundo = mundoDePrueba() } = {}) => cadenciaDeMuestreo({
    posicion,
    sitios: sitiosConPosicion(mundo),
    vigente,
    metrosPorDistancia: CADENCIA_POR_DISTANCIA_M,
    puntoDePartida,
  });

  test('En el punto de partida la cadencia es por tiempo aunque no haya ningún geofence debajo', () => {
    // El sitio se elige lejos de todo: en el mundo de prueba el núcleo está en (0,0), así
    // que la casa se pone en un descampado a dos kilómetros para que lo único que pueda
    // decidir la cadencia rápida sea el punto de partida.
    const descampado = { x: 8000, y: 0 };
    const fuera = enCasa(descampado, { puntoDePartida: null });
    assert.equal(fuera.modo, CADENCIAS.POR_DISTANCIA, 'sin punto de partida ese descampado ya salía por tiempo, y entonces esto no mide nada');

    const encasa = enCasa(descampado, { puntoDePartida: descampado });
    assert.equal(encasa.modo, CADENCIAS.POR_TIEMPO);
    assert.equal(encasa.segundos, CADENCIA_CERCA_S);
    assert.equal(encasa.metros, null, 'una cadencia con las dos puestas no existe');
  });

  test('La cadencia decidida por el punto de partida no nombra ningún sitio y declara su razón', () => {
    // A un sitio se le nombra; un sitio fantasma en la respuesta acabaría en algún índice.
    const descampado = { x: 8000, y: 0 };
    const encasa = enCasa(descampado, { puntoDePartida: descampado });
    assert.equal(encasa.sitio, null, 'la cadencia rápida en casa nombra un sitio que no existe');
    assert.equal(encasa.razon, 'punto-de-partida');

    // El vocabulario de razones es cerrado y son dos: un sitio del mundo debajo, o casa
    // cerca. Y fuera de las dos la razón es la nada, no una palabra inventada.
    assert.deepEqual([...RAZONES_DE_CADENCIA], ['sitio', 'punto-de-partida']);
    assert.ok(RAZONES_DE_CADENCIA.includes(encasa.razon));
    assert.equal(enCasa({ x: 8000, y: 0 }, { puntoDePartida: null }).razon, null, 'una cadencia por distancia declara una razón');
  });

  test('El radio de casa es el del regreso, y alejarse devuelve la cadencia por distancia', () => {
    // El radio es el del regreso y no el del geofence, y el porqué es de juego: lo que la
    // cadencia rápida compra es que la permanencia del regreso **pueda acumular**, y esa
    // permanencia se cuenta dentro de este radio. Con los 40 m del geofence quedaría un
    // anillo de diez metros dentro del cual se cuenta el regreso y no llegan fijos.
    assert.equal(RADIO_DE_REGRESO_M, 50);
    const casa = { x: 8000, y: 0 };
    assert.equal(enCasa({ x: 8000 + RADIO_DE_REGRESO_M, y: 0 }, { puntoDePartida: casa }).modo, CADENCIAS.POR_TIEMPO);
    assert.equal(enCasa({ x: 8000 + RADIO_DE_REGRESO_M + 1, y: 0 }, { puntoDePartida: casa }).modo, CADENCIAS.POR_DISTANCIA);
    // Y de verdad lejos, que es el caso de andar: por distancia y sin razón.
    const lejos = enCasa({ x: 8000 + RADIO_DE_REGRESO_M + MARGEN_DE_CERCANIA_M + 1, y: 0 }, { puntoDePartida: casa, vigente: CADENCIAS.POR_TIEMPO });
    assert.equal(lejos.modo, CADENCIAS.POR_DISTANCIA);
    assert.equal(lejos.razon, null);
  });

  test('La histéresis de casa es la misma que la de un sitio', () => {
    // Un fijo ruidoso en el borde de casa entraría y saldría igual que en el borde de un
    // sitio, y volver a pedir la suscripción no es gratis. Entrar cuesta el radio; salir, el
    // radio más el margen — la misma asimetría y el mismo número.
    const casa = { x: 8000, y: 0 };
    const justoFuera = { x: 8000 + RADIO_DE_REGRESO_M + 5, y: 0 };
    assert.equal(enCasa(justoFuera, { puntoDePartida: casa, vigente: CADENCIAS.POR_DISTANCIA }).modo, CADENCIAS.POR_DISTANCIA);
    assert.equal(enCasa(justoFuera, { puntoDePartida: casa, vigente: CADENCIAS.POR_TIEMPO }).modo, CADENCIAS.POR_TIEMPO);
    assert.equal(MARGEN_DE_CERCANIA_M, 20);
  });

  test('Dentro de un geofence y cerca de casa a la vez, el sitio nombrado es el sitio real', () => {
    // Sale por tiempo **una sola vez** y con el nombre del sitio: el sitio manda sobre casa
    // al declararla, por la misma razón por la que es él quien se nombra.
    const dentroDelTorreon = { x: 1500, y: 0 };
    const laDos = enCasa(dentroDelTorreon, { puntoDePartida: dentroDelTorreon });
    assert.equal(laDos.modo, CADENCIAS.POR_TIEMPO);
    assert.equal(laDos.sitio, TORREON, 'con un sitio real debajo, la cadencia no lo nombra');
    assert.equal(laDos.razon, 'sitio');
    assert.equal(laDos.segundos, CADENCIA_CERCA_S, 'la cadencia rápida se ha aplicado dos veces');
  });

  test('Sin salida abierta la cadencia se decide solo con los geofences y no falla', () => {
    // Una partida sin salida abierta es un estado normal y no un cableado a medias: se pasa
    // el punto de partida en nulo, que es lo que distingue «no hay ninguna» de «hay una y no
    // se sabe dónde empezó». Y un punto mal formado sí falla, nombrándolo.
    const sinSalida = enCasa({ x: 1500, y: 0 }, { puntoDePartida: null });
    assert.equal(sinSalida.modo, CADENCIAS.POR_TIEMPO);
    assert.equal(sinSalida.sitio, TORREON);
    for (const roto of [{ x: 0 }, { x: null, y: 0 }, 'casa', { x: NaN, y: 0 }]) {
      assert.throws(
        () => enCasa({ x: 0, y: 0 }, { puntoDePartida: roto }),
        /punto de partida/,
        `un punto de partida ${JSON.stringify(roto)} ha pasado sin protestar`,
      );
    }
  });

  test('En el punto de partida de los ocho mundos de referencia la cadencia es por tiempo', () => {
    // **Ocho de ocho, y antes eran dos.** Medido: sin el punto de partida en la decisión,
    // `por-distancia` en 6 de los 8 —con el geofence más cercano entre 19,0 y 191,4 m del
    // borde— y `por-tiempo` en los otros 2 **por accidente de trazado**, un sitio que pisa
    // el anclaje. Que dos salieran bien por casualidad es justo lo que hacía que el agujero
    // no se viera desde una sola partida.
    //
    // `(0,0)` es el punto de partida porque `buildWorld` proyecta con origen en la
    // coordenada del mundo, así que quien abre la salida en su portal está ahí.
    const casa = { x: 0, y: 0 };
    const porMundo = [];
    for (const nombre of LOS_CUATRO) {
      for (const semilla of LAS_DOS_SEMILLAS) {
        porMundo.push({ nombre, semilla });
      }
    }
    assert.equal(porMundo.length, 8, 'los mundos de referencia han dejado de ser ocho');
    return (async () => {
      const conCadencia = [];
      const sinCasa = [];
      for (const { nombre, semilla } of porMundo) {
        const mundo = await generaMundo(nombre, semillaDe(nombre, semilla));
        const sitios = sitiosConPosicion(mundo);
        const comun = { posicion: casa, sitios, vigente: null, metrosPorDistancia: CADENCIA_POR_DISTANCIA_M };
        conCadencia.push({
          mundo: `${nombre}-semilla-${semilla}`,
          ...cadenciaDeMuestreo({ ...comun, puntoDePartida: casa }),
        });
        sinCasa.push({
          mundo: `${nombre}-semilla-${semilla}`,
          modo: cadenciaDeMuestreo({ ...comun, puntoDePartida: null }).modo,
        });
      }

      const noPorTiempo = conCadencia.filter((c) => c.modo !== CADENCIAS.POR_TIEMPO);
      assert.deepEqual(
        noPorTiempo.map((c) => c.mundo),
        [],
        `en estos mundos de referencia la salida arranca por distancia estando en el punto de partida: ${noPorTiempo.map((c) => c.mundo).join(', ')}. ` +
        'Parada y con la cadencia por distancia no llega ninguna posición, así que la permanencia del regreso no acumula y el telón no puede caer.',
      );
      for (const c of conCadencia) {
        assert.equal(c.segundos, CADENCIA_CERCA_S, `${c.mundo} arranca por tiempo con otra cadencia`);
      }

      // Y la contraprueba, que es la que dice que esto mide algo: **sin** el punto de
      // partida en la decisión, seis de los ocho salen por distancia. Si algún día salieran
      // los ocho por tiempo sin él, este caso estaría midiendo el trazado y no la decisión.
      const porDistanciaSinCasa = sinCasa.filter((c) => c.modo === CADENCIAS.POR_DISTANCIA);
      assert.equal(
        porDistanciaSinCasa.length,
        6,
        `sin el punto de partida salían por distancia ${porDistanciaSinCasa.length} mundos de ocho y lo medido son 6: ` +
        'si el número cambia, ha cambiado el trazado de los mundos congelados y hay que volver a medirlo antes de leer el caso de arriba.',
      );
    })();
  });
});

// ── Las dos mitades del criterio, que se exigen a la vez ───────────────────────
//
// SPEC-044 · §9c. La segunda es la que se pierde sola en un arreglo de ruido: un arreglo que
// hiciera validar al parado a cambio de validar al autobús parado no sería un arreglo.

describe('Las dos mitades del criterio de una llegada', () => {
  test('Una parada dentro del geofence con el fijo bueno valida', () => {
    // Con la ventana corta los veinte segundos de SPEC-032 siguen siendo el coste entero:
    // quien lleva parada veinte segundos ya los ha pagado cuando la ventana lo declara.
    const { llegadas } = capa();
    const validadas = llegadas.comprueba({ posiciones: paradoEn({ x: 1500, duracionMs: PARADA_DENTRO_MS, precisionM: 3 }) }).validadas;
    assert.deepEqual(validadas.map((v) => v.sitio), [TORREON]);
  });

  test('Una parada dentro del geofence sin precisión declarada paga la ventana larga', () => {
    // En la duda sobre el error del fijo se exige más y no menos, así que los veinte
    // segundos no bastan y los cuarenta sí. El coste está declarado, no disimulado.
    const { llegadas } = capa();
    assert.deepEqual(llegadas.comprueba({ posiciones: paradoEn({ x: 1500, duracionMs: PARADA_DENTRO_MS, precisionM: null }) }).validadas, []);
    const { llegadas: otra } = capa();
    const larga = otra.comprueba({ posiciones: paradoEn({ x: 1500, duracionMs: 40_000, precisionM: null }) }).validadas;
    assert.deepEqual(larga.map((v) => v.sitio), [TORREON]);
  });

  test('Quien atraviesa el geofence a cuatro kilómetros por hora no valida', () => {
    // La otra velocidad de la tabla de §9c, que hasta aquí no afirmaba nadie: la batería solo
    // tenía la de cinco. A cuatro se está más tiempo dentro, así que es el caso más exigente
    // para «El visor no aparece nunca andando».
    for (const precisionM of [3, 12, null]) {
      const { llegadas } = capa();
      const posiciones = pasaPorDelante({ centroX: 1500, velocidadMs: 1.11, precisionM });
      const dentro = posiciones.filter((p) => Math.abs(p.x - 1500) <= RADIO_DE_GEOFENCE_M);
      const segundosDentro = (dentro[dentro.length - 1].tMs - dentro[0].tMs) / 1000;
      assert.ok(segundosDentro > PARADA_DENTRO_S, 'a cuatro kilómetros por hora no se está dentro más que la permanencia y el caso no mediría nada');
      assert.deepEqual(
        llegadas.comprueba({ posiciones }).validadas.map((v) => v.sitio),
        [],
        `pasar de largo a cuatro kilómetros por hora con el fijo de ${JSON.stringify(precisionM)} m ha validado una llegada`,
      );
    }
  });

  test('Un vehículo parado dentro del geofence no valida, por mucho que la deriva sea cero', () => {
    // El atasco. No lo aparta la deriva —un coche parado no deriva—: lo aparta que la ventana
    // responde que no antes de medir nada cuando la clasificación es vehículo, y esa guarda
    // es la mitad del criterio que se pierde sola.
    const { llegadas } = capa({ reparto: { beats: [beatEn(TORREON, { x: 1500 })] } });
    const atasco = paradoEn({ x: 1500, duracionMs: PARADA_DENTRO_MS * 6, clasificacion: 'vehiculo', precisionM: 3 });
    assert.deepEqual(llegadas.comprueba({ posiciones: atasco }).validadas, []);
    assert.equal(llegadas.espera(), null, 'el atasco ha dejado una escena esperando');
  });

  test('La misma secuencia de posiciones inyectada dos veces valida lo mismo y en el mismo orden', () => {
    // `@determinismo`, bloqueante: ni reloj del sistema ni azar. Se compara por serialización
    // completa, que es lo único que afirma «idéntico» de verdad.
    const recorrido = [
      ...pasaPorDelante({ centroX: 1500, desdeM: -200, hastaM: -50 }),
      ...paradoEn({ x: 1460, desdeMs: 110_000, duracionMs: 40_000 }),
      ...pasaPorDelante({ centroX: 1500, desdeM: -40, hastaM: 200, desdeMs: 155_000 }),
    ];
    const vuelta = () => {
      const { llegadas } = capa();
      const paso = llegadas.comprueba({ posiciones: recorrido });
      return JSON.stringify({ validadas: paso.validadas, esperando: paso.esperando, espera: llegadas.espera() });
    };
    const primera = vuelta();
    assert.match(primera, new RegExp(TORREON), 'el recorrido de referencia no valida nada y el caso no mediría el determinismo');
    for (let k = 0; k < 3; k += 1) assert.equal(vuelta(), primera, 'dos recorridos idénticos han validado cosas distintas');
  });
});

// ── El paso que no tiene pantalla ─────────────────────────────────────────────
//
// **Qué había aquí antes, quién lo puso y por qué ya no está.** Hasta SPEC-049 este bloque
// afirmaba lo contrario de lo que afirma ahora, en un caso llamado «El paso de beat se monta
// con el hueco declarado, con el paso nombrado y una sola acción»: exigía que
// `app/pantallas/llegada.js` montara el hueco `llegada-hueco` y que `app/App.js` siguiera
// llevando `telon-sin-pantalla`. Lo puso **SPEC-044** —la fila que dejó la máquina de una
// salida cableada y las dos pantallas sin dibujar— con un cometido concreto: que retirar los
// dos huecos fuera un acto con registro y no una limpieza silenciosa, porque un paso que se
// salta en silencio deja una secuencia que parece completa y no lo es (§6h).
//
// **SPEC-049 los retira por criterio de aceptación** —«cuando se busca el hueco
// `telon-sin-pantalla` con su acción `telon-cerrar`, entonces no queda ninguno», y lo mismo
// para `llegada-hueco`—, así que la guarda hizo exactamente su trabajo: se puso roja el día
// en que los huecos desaparecieron. El veredicto —defecto de prueba, no de código— lo tomó
// quien orquesta el bucle, y lo que sigue es su inverso: que los dos huecos **ya no están** y
// que en su sitio hay pantalla de verdad.
//
// **Lo que la guarda protegía de verdad no se pierde**, y por eso sigue afirmado aquí: que un
// paso al que no se le ha inyectado pantalla **se enseña y no se salta**, con el paso nombrado
// y con la acción que lo cierra. Aquello era un hueco —«esto no está dibujado»— y esto es una
// avería —«alguien montó la llegada a medias»—, que son dos cosas distintas con la misma
// consecuencia si desaparecen. Que la escena que ocupa su sitio se compone de verdad y que la
// secuencia entera se anda con ella está en `test/nucleo/escena-cableada.test.mjs`.

describe('Un paso sin pantalla se enseña, no se salta', () => {
  test('El paso de beat se monta con su pantalla, y un paso sin ella se enseña con su nombre y su acción', () => {
    const pantalla = codigoDe('app/pantallas/llegada.js');

    // Los dos huecos declarados ya no están. Se afirma por su ausencia literal porque su
    // presencia era lo que este caso exigía hasta esta fila.
    assert.ok(!pantalla.includes('testID="llegada-hueco"'), 'el hueco declarado de la fila 44 vuelve a estar montado, y la escena ya tiene pantalla');
    assert.ok(!/export function nombraElPaso/.test(pantalla), '`nombraElPaso` era la manera de nombrar el paso dentro del hueco, y se va con él');
    assert.ok(!codigoDe('app/App.js').includes('telon-sin-pantalla'), 'el hueco del telón de la fila 48 vuelve a estar montado, y el telón ya tiene pantalla');

    // Y en su sitio, la avería del paso al que no se le inyectó pantalla: **con el paso
    // nombrado y con una sola acción**, que es lo que la guarda protegía. Enseñarla sin decir
    // qué paso es la haría indistinguible de una pantalla vacía; enseñarla sin acción dejaría
    // la app encallada dentro de una salida abierta.
    assert.match(pantalla, /testID="llegada-sin-pantalla"/, 'un paso sin pantalla inyectada ya no se enseña, así que se salta en silencio');
    assert.match(pantalla, /testID="llegada-sin-pantalla"[^>]*accessibilityLabel=\{[^}]*tipo\}/, 'la avería no nombra el paso que se quedó sin pantalla');
    assert.match(pantalla, /testID="llegada-seguir"/, 'la avería del paso sin pantalla no lleva la acción que lo cierra');

    // Y el paso no se salta: la secuencia lo trae y `avanza` es la única manera de moverse,
    // así que llegar al siguiente cuesta pasar por él.
    const conBeat = secuenciaDeLlegada({ tipoDeSitio: 'paraje', primeraVisita: true, hayIlustracion: false, hayBeat: true });
    assert.ok(conBeat.some((p) => p.tipo === TIPOS_DE_PASO.BEAT), 'una llegada con beat no trae el paso de beat en su secuencia');
    assert.ok(TIPOS_DE_SITIO.includes('paraje'));
    const encadenados = pasosEncadenados(conBeat);
    assert.equal(encadenados[encadenados.length - 1].tipo, TIPOS_DE_PASO.BEAT, 'el beat no es el paso al que se llega recorriendo');
  });
});
