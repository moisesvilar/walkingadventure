// B5 · El bucle entero: la prueba que faltaba, y que ninguna de las 2583 hizo.
//
// Con el checklist completo y la suite en verde, la partida jugada de punta a punta
// destapó que **ninguna aventura se podía terminar** (`pipeline/decisiones-orquestador.md`
// §6v). El último beat de un lazo cae **siempre** en un sitio ya visitado —el lazo es
// cerrado por diseño, esa es la mitad del juego— y la capa de llegadas lo descartaba en
// silencio: `if (yaValidada(nombre)) continue;`. Consecuencia medida: 102 de 102 aventuras
// casteadas de los cuatro mundos de referencia acababan `a-medias`, con telón de cierre en
// corto, cero oro, cero objetos y sin rumor.
//
// Ninguna prueba de una sola fila lo vio, y no por descuido: **cada fila probaba su lado**.
// Las de SPEC-032 afirmaban que volver a un sitio ya visto no repite el visor —cierto, y
// sigue siéndolo—; las de SPEC-034 resolvían los beats llamando al motor directamente, sin
// pasar por el geofence; las de SPEC-036 echaban el telón con un desenlace escrito a mano.
// El defecto vivía en la costura, y una costura no es de nadie.
//
// De ahí la forma de este fichero, que es su única razón de existir: **recorre el camino
// entero y no llama a ninguna pieza por dentro**. Se acepta la aventura casteada, se anda
// su lazo parándose en cada beat, se atienden las escenas que esperan, se compone el
// desenlace desde la plantilla y se echa el telón. Lo que se afirma es lo que sale de ese
// recorrido, no lo que devuelve una función.
//
// Cuatro decisiones que no son de estilo:
//
// - **Se anda, no se teletransporta.** Entre beat y beat se emiten posiciones clasificadas
//   `andando` a cinco kilómetros por hora y en cada beat una parada de la permanencia
//   entera. Es lo único que hace que el geofence, la permanencia y la guarda del sitio ya
//   visitado participen de verdad; con posiciones colocadas a mano el defecto de §6v
//   seguiría invisible.
// - **Los cuatro mundos de referencia, y todas sus aventuras.** 102 lazos, no uno elegido:
//   el defecto era universal y una prueba sobre un caso feliz no lo habría distinguido de
//   un mundo con suerte.
// - **Nada se resuelve fuera de orden.** El beat se resuelve solo si es el que toca; si el
//   sitio ofrece otro, se anota y se sigue. Así una aventura que no se puede terminar sale
//   como aventura que no termina y no como excepción a mitad de la suite.
// - **Ni red, ni reloj, ni azar.** Los datos de OSM salen de los fixtures congelados, el
//   día y el minuto llegan inyectados, y el tiempo del sensor viaja dentro de cada
//   posición.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «Todo lazo casteado
// se cierra», «La segunda vez el visor no se abre solo», «El cierre en corto ocupa el sitio
// del desenlace», «Un cierre en corto no genera rumor», «Nace fiel y en el sitio» y «Se
// puede ser alguien en un pueblo donde no has estado». Lo demás va declarado como hueco de
// la batería en `test/spec-test-map.json`: la batería no tiene características de costura,
// por la misma razón por la que nadie recorría el camino entero.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  aventuraEnCurso,
  aventurasCerradas,
  acepta,
  cierra,
  estadoDeAventuras,
  resuelveBeat,
} from '../../packages/nucleo/partida/aventura-en-curso.js';
import { repartoDeAventuras } from '../../packages/nucleo/partida/aventuras.js';
import { echaElTelon, piezasDeSerie } from '../../packages/nucleo/partida/cierre-de-salida.js';
import { libroDePendientes } from '../../packages/nucleo/partida/conocimiento.js';
import { estadoInicial } from '../../packages/nucleo/partida/estado.js';
import { registroInicial } from '../../packages/nucleo/partida/hechos.js';
import {
  PARADA_DENTRO_MS,
  creaLlegadas,
  estadoDeLlegadas,
} from '../../packages/nucleo/partida/llegadas.js';
import { componeLoQueHayHoy } from '../../packages/nucleo/partida/lo-que-hay-hoy.js';
import { PRODUCTORES_DE_LA_PARTIDA, creaMotorDeLaPartida } from '../../packages/nucleo/partida/motor.js';
import { SIN_OBJETOS } from '../../packages/nucleo/partida/objetos.js';
import { creaMotorDePasos, estadoDePasos } from '../../packages/nucleo/partida/pasos.js';
import { ESCALON_DE_PARTIDA, rangoEn } from '../../packages/nucleo/partida/rango.js';
import { arbolDeCalzadas, naceRumor } from '../../packages/nucleo/partida/rumores.js';
import { abreSalida } from '../../packages/nucleo/partida/salida-abierta.js';
import { MODOS, TIPOS_DE_PASO } from '../../packages/nucleo/partida/secuencia.js';
import { creaDetectorDeTransporte } from '../../packages/nucleo/partida/transporte.js';
import { estadoDeDiario } from '../../packages/nucleo/partida/diario.js';
import { loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { PROTAGONISTAS } from '../../packages/nucleo/partida/deformacion.js';
import { componeElDesenlace, lugarDelDesenlace, repuestoDe } from '../../packages/nucleo/quests/desenlace.js';
import { namesFor } from '../../packages/nucleo/names/index.js';
import { relojDePared } from '../dobles/reloj-de-pared.mjs';
import { LOS_CUATRO, generaMundo, semillaDe } from './mundo-de-prueba.mjs';
import { calendarioEn } from './antes-de-salir-de-prueba.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { desenlaceEn, mundoLineal, nivelEn } from './rumor-de-prueba.mjs';

// ── El decorado ────────────────────────────────────────────────────────────────

const MAPA = 'casa';
const SALIDA = 'la-salida-de-hoy';
const IDIOMA = namesFor('es');
const TRAMO = 2000;
const DIA = 1;

/** El minuto del día con el que se resuelven los beats de franja. Fijo e inyectado. */
const MEDIODIA = 12 * 60;

/** A cinco kilómetros por hora, que es el ritmo con el que este juego se anda. */
const VELOCIDAD_MS = 1.39;

/** Desde dónde se sale: lo bastante lejos del primer beat para no estar ya dentro. */
const LEJOS_M = 300;

/**
 * La precisión declarada de las posiciones que este fichero fabrica: **tres metros**, el
 * fijo bueno de la tabla de §9c.
 *
 * Va puesta desde SPEC-044: la parada dejó de medirse de fijo a fijo y se mide por deriva
 * de ventana, y **sin precisión declarada se usa la ventana larga** por prudencia
 * (`ritmo.js`, `ventanaParaPrecision`). Estas paradas se fabricaron antes de esa regla y
 * duran lo que dura la permanencia, así que con la ventana larga no llegaban a cubrirla.
 * Se actualiza el fixture, no la exigencia: lo que estas pruebas afirman —que todo lazo
 * casteado se cierra andándolo— es exactamente lo mismo.
 */
const FIJO_BUENO_M = 3;

/**
 * Posiciones de quien anda de un punto a otro, clasificadas «andando».
 *
 * La última cae **encima** del destino y sigue clasificada andando: llegar no valida, lo
 * que valida es haberse parado, y por eso la parada empieza donde acaba el paseo.
 */
function andaDesde(desde, hasta, tMs, { cadaMs = 2000 } = {}) {
  const dx = hasta.x - desde.x;
  const dy = hasta.y - desde.y;
  const metros = Math.hypot(dx, dy);
  if (metros < 1) return [];
  const duracionS = metros / VELOCIDAD_MS;
  const posiciones = [];
  for (let t = cadaMs; t < duracionS * 1000; t += cadaMs) {
    const recorrido = ((t / 1000) * VELOCIDAD_MS) / metros;
    posiciones.push({ x: desde.x + dx * recorrido, y: desde.y + dy * recorrido, tMs: tMs + t, precisionM: FIJO_BUENO_M, clasificacion: 'andando' });
  }
  posiciones.push({ x: hasta.x, y: hasta.y, tMs: tMs + Math.round(duracionS * 1000), precisionM: FIJO_BUENO_M, clasificacion: 'andando' });
  return posiciones;
}

/** Posiciones de quien se para en un punto el tiempo de permanencia entero. */
function seParaEn(punto, tMs, { cadaMs = 5000, duracionMs = PARADA_DENTRO_MS } = {}) {
  const posiciones = [];
  for (let t = cadaMs; t <= duracionMs; t += cadaMs) posiciones.push({ x: punto.x, y: punto.y, tMs: tMs + t, precisionM: FIJO_BUENO_M, clasificacion: 'parada' });
  return posiciones;
}

/**
 * Anda el lazo de una aventura casteada, de aceptarla a resolver su último beat.
 *
 * Es el camino entero y sin atajos: se acepta la aventura, se anda hasta cada beat en el
 * orden de la cadena, se para dentro de su geofence, se atienden las escenas que esperan
 * —que es lo que hace mirar el móvil— y se resuelve el beat que el sitio ofrece, **solo si
 * es el que toca**.
 *
 * @returns `{ terminada, validadas, segundas, sinResolver }`. `validadas` son todas las
 *   llegadas de la salida en el orden en que se ofrecieron, y `segundas` las que llegan a
 *   un sitio en el que ya se había estado, que es lo que la guarda de §6v descartaba.
 */
function andaElLazo({ mundo, casteada, mapaId = MAPA, salida = SALIDA, estado = estadoDeAventuras(), registro = registroInicial(), dia = DIA, hastaBeat = null }) {
  const beats = casteada.aventura.beats;
  acepta(estado, { aventura: casteada.aventura, mapaId, registro, dia, paso: 1 });

  const pisados = new Set();
  const llegadas = creaLlegadas({
    mundo,
    mapaId,
    salida,
    estado: estadoDeLlegadas(),
    detector: creaDetectorDeTransporte(),
    reparto: { beats },
    // La cola y lo que se cuenta no participan de este camino y se declaran vacías, que es
    // una respuesta; las ilustraciones sí se declaran presentes en todos los sitios, porque
    // sin visor «el visor no se repite» no mediría nada.
    cola: { microEncuentroEn: () => null },
    loQueSeCuenta: { versionesDe: () => [] },
    ilustraciones: { hay: () => true },
    visitados: { yaVisitado: (sitio) => pisados.has(sitio), anota: (sitio) => pisados.add(sitio) },
    diario: estadoDeDiario(),
  });

  const reloj = relojDePared(MEDIODIA);
  const validadas = [];
  const segundas = [];
  const sinResolver = [];
  const vistos = new Set();

  let tMs = 0;
  let donde = { x: beats[0].lugar.x + LEJOS_M, y: beats[0].lugar.y + LEJOS_M };

  for (const beat of beats.slice(0, hastaBeat ?? beats.length)) {
    const destino = { x: beat.lugar.x, y: beat.lugar.y };
    const camino = andaDesde(donde, destino, tMs);
    if (camino.length) tMs = camino[camino.length - 1].tMs;
    const quieta = seParaEn(destino, tMs);
    tMs = quieta[quieta.length - 1].tMs;
    donde = destino;

    for (const llegada of llegadas.comprueba({ posiciones: [...camino, ...quieta] }).validadas) {
      validadas.push(llegada);
      if (vistos.has(llegada.sitio)) segundas.push(llegada);
      vistos.add(llegada.sitio);
    }

    // Se atienden las escenas que esperan **una a una y en su orden**, que es lo que hace
    // una persona: mirar lo que espera, leerlo entero y resolver el beat que traía.
    //
    // Antes se cerraban todas en bloque y después se preguntaba por el beat del sitio, y
    // eso solo funciona mientras una parada valide exactamente una llegada. Con la parada
    // por deriva de ventana (SPEC-044) una parada del tiempo de permanencia valida dos
    // llegadas al mismo sitio cuando dos beats seguidos de la cadena caen allí —«el beat
    // que toca» se resuelve en cuanto el anterior se consume—, y cerrarlas en bloque
    // perdía la primera. **Se arregla cómo el fixture atiende las escenas, no lo que
    // exige**: sigue exigiendo que las 102 aventuras casteadas se terminen andando su lazo.
    let vueltas = 0;
    let resuelto = false;
    let ultimoOfrecido = null;
    while (llegadas.espera()) {
      if (++vueltas > beats.length * 8) throw new Error(`las escenas de "${casteada.plantilla}" no se acaban de cerrar: ${vueltas} vueltas`);
      const donde = llegadas.espera().sitio;
      const ofrecido = llegadas.beatDe(donde);
      let paso;
      do { paso = llegadas.avanza(); } while (!paso.cerrada);
      const enCurso = aventuraEnCurso(estado);
      if (ofrecido) ultimoOfrecido = ofrecido;
      if (!ofrecido || !enCurso || ofrecido.n !== enCurso.beatEnCurso) continue;
      resuelveBeat(estado, { beat: ofrecido, reloj, tenencia: SIN_OBJETOS });
      if (ofrecido.n === beat.n) resuelto = true;
    }

    if (!resuelto) {
      sinResolver.push({
        beat: beat.n,
        sitio: beat.lugar.nombre,
        ofrecido: ultimoOfrecido?.n ?? null,
        tocaba: aventuraEnCurso(estado)?.beatEnCurso ?? null,
      });
    }
  }

  const enCurso = aventuraEnCurso(estado);
  return {
    terminada: enCurso !== null && enCurso.beatEnCurso === null,
    resueltos: enCurso?.resueltos.length ?? 0,
    validadas,
    segundas,
    sinResolver,
    estado,
    registro,
  };
}

// Andar los 102 lazos cuesta segundos y cinco casos los miran. Se anda una vez y se
// comparte lo medido: nada de lo que sale de aquí se modifica.
let laVuelta = null;

/** Los cuatro mundos de referencia con todas sus aventuras casteadas ya andadas. */
async function laVueltaEntera() {
  if (laVuelta) return laVuelta;
  const mundos = [];
  for (const nombre of LOS_CUATRO) {
    const mundo = await generaMundo(nombre, semillaDe(nombre, '1'));
    const reparto = repartoDeAventuras({ mundo, tramo: TRAMO });
    assert.equal(reparto.hayReparto, true, `${nombre} no reparte ninguna aventura y el caso no mediría nada`);
    const aventuras = reparto.aventuras.map((a) => {
      const casteada = mundo.casting.find((c) => c.ok && c.plantilla === a.plantilla);
      assert.ok(casteada, `${nombre}: la plantilla "${a.plantilla}" está en el reparto y no en el casting`);
      return { casteada, andado: andaElLazo({ mundo, casteada }) };
    });
    mundos.push({ nombre, mundo, aventuras });
  }
  laVuelta = mundos;
  return laVuelta;
}

/** Todas las aventuras andadas de los cuatro mundos, en una sola lista. */
const todas = (mundos) => mundos.flatMap((m) => m.aventuras.map((a) => ({ ...a, mundo: m.nombre })));

// ── El lazo cerrado, que es lo que hacía imposible terminar ─────────────────────

describe('El lazo cerrado se puede terminar', () => {
  test('Todo lazo casteado se cierra', async () => {
    const mundos = await laVueltaEntera();
    const aventuras = todas(mundos);
    assert.equal(aventuras.length, 102, `los cuatro mundos de referencia reparten ${aventuras.length} aventuras y no las 102 medidas`);

    let vuelven = 0;
    for (const { mundo, casteada } of aventuras) {
      const sitios = casteada.aventura.beats.map((b) => b.lugar.nombre);
      const ultimo = sitios[sitios.length - 1];
      assert.ok(sitios.length >= 2, `${mundo}/${casteada.plantilla}: una cadena de un solo beat no puede cerrar nada`);
      if (sitios.slice(0, -1).includes(ultimo)) vuelven++;
    }

    // **El 100 %**, y es la cifra entera del defecto: si el último beat cae siempre en un
    // sitio anterior, una capa de llegadas que descarte lo ya visitado deja toda aventura
    // sin terminar. Se afirma sobre las 102 y no sobre una: lo que hace fatal la guarda es
    // que esto sea universal, no frecuente.
    assert.equal(vuelven, aventuras.length, `${vuelven} de ${aventuras.length} aventuras acaban en un sitio por el que ya se pasó, y el diseño dice que el lazo es cerrado`);
  });

  test('Se puede terminar toda aventura casteada de los cuatro mundos de referencia', async () => {
    const mundos = await laVueltaEntera();

    // Por mundo, que es como se midió: barrio 24, costero 29, suelo 19, urbano 30.
    const cuenta = mundos.map((m) => ({
      mundo: m.nombre,
      aventuras: m.aventuras.length,
      terminan: m.aventuras.filter((a) => a.andado.terminada).length,
    }));
    assert.deepEqual(
      cuenta,
      [
        { mundo: 'barrio-tres-calles', aventuras: 24, terminan: 24 },
        { mundo: 'costero', aventuras: 29, terminan: 29 },
        { mundo: 'suelo-250m', aventuras: 19, terminan: 19 },
        { mundo: 'urbano-denso', aventuras: 30, terminan: 30 },
      ],
      'alguna aventura casteada no se puede terminar andando su lazo entero',
    );

    // Y el detalle de la primera que falle, para que el fallo diga dónde se quedó en lugar
    // de decir que una cuenta no cuadra.
    const rota = todas(mundos).find((a) => !a.andado.terminada);
    assert.equal(
      rota,
      undefined,
      rota
        ? `"${rota.casteada.plantilla}" de ${rota.mundo} se quedó con ${rota.andado.resueltos} de ${rota.casteada.aventura.beats.length} beats resueltos: ${JSON.stringify(rota.andado.sinResolver)}`
        : '',
    );
  });

  test('El último beat de un lazo se resuelve al volver al sitio donde empezó', async () => {
    const mundos = await laVueltaEntera();

    // La misma afirmación en corto y sobre el mecanismo: la última llegada de cada lazo es
    // una **segunda** llegada a un sitio ya visitado, y trae el beat dentro. Es el caso que
    // se pone rojo solo, sin contar 102 aventuras.
    let conBeatAlVolver = 0;
    for (const { mundo, casteada, andado } of todas(mundos)) {
      const ultimo = casteada.aventura.beats[casteada.aventura.beats.length - 1];
      const suyas = andado.validadas.filter((l) => l.sitio === ultimo.lugar.nombre);
      assert.ok(suyas.length >= 2, `${mundo}/${casteada.plantilla}: solo hay ${suyas.length} llegada(s) a "${ultimo.lugar.nombre}" y el lazo vuelve allí`);
      const alVolver = suyas[suyas.length - 1];
      assert.ok(
        alVolver.secuencia.some((p) => p.tipo === TIPOS_DE_PASO.BEAT),
        `${mundo}/${casteada.plantilla}: la vuelta a "${ultimo.lugar.nombre}" no trae ningún beat, así que el último se quedó sin resolver`,
      );
      conBeatAlVolver++;
    }
    assert.equal(conBeatAlVolver, 102, 'no se han mirado las 102 vueltas');
  });
});

// ── Lo que la guarda protegía, y que no se puede perder al arreglarla ───────────

describe('La segunda llegada al mismo sitio', () => {
  test('La segunda vez el visor no se abre solo', async () => {
    const mundos = await laVueltaEntera();
    const segundas = todas(mundos).flatMap((a) => a.andado.segundas.map((l) => ({ ...l, de: `${a.mundo}/${a.casteada.plantilla}` })));

    // Que las haya es la mitad del caso: con la guarda anterior no existía ni una, y
    // «ninguna repite el visor» se habría cumplido sobre una lista vacía.
    assert.ok(segundas.length >= 100, `solo hay ${segundas.length} segundas llegadas al mismo sitio y con el lazo cerrado tiene que haber al menos una por aventura`);

    const repetidos = segundas.filter((l) => l.secuencia.some((p) => p.tipo === TIPOS_DE_PASO.VISOR && p.modo === MODOS.ENCADENADO));
    assert.deepEqual(
      repetidos.map((l) => `${l.de} · ${l.sitio}`),
      [],
      'alguna segunda llegada vuelve a abrir el visor sola, que es justo lo que la guarda del sitio ya visitado protegía',
    );

    // Y sigue estando: disponible con un toque, que es lo que dice el escenario.
    for (const llegada of segundas) {
      const visor = llegada.secuencia.find((p) => p.tipo === TIPOS_DE_PASO.VISOR);
      assert.ok(visor, `${llegada.de}: la segunda llegada a "${llegada.sitio}" se ha quedado sin visor, y el sitio tiene ilustración`);
      assert.equal(visor.modo, MODOS.A_UN_TOQUE, `${llegada.de}: el visor de la segunda llegada a "${llegada.sitio}" llega en modo "${visor.modo}"`);
    }
  });

  test('Volver a por el beat que faltaba no trae de paso un segundo micro-encuentro', async () => {
    // La otra mitad de lo que la guarda protegía, y que el arreglo tenía que conservar: la
    // cola se pregunta una vez por sitio y por salida. Se cuenta lo que se le preguntó, que
    // es lo único que lo distingue de no haber vuelto.
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    const casteada = mundo.casting.find((c) => c.ok);
    const preguntados = [];
    const beats = casteada.aventura.beats;
    const pisados = new Set();
    const llegadas = creaLlegadas({
      mundo,
      mapaId: MAPA,
      salida: SALIDA,
      estado: estadoDeLlegadas(),
      detector: creaDetectorDeTransporte(),
      reparto: { beats },
      cola: { microEncuentroEn: (sitio) => { preguntados.push(sitio); return null; } },
      loQueSeCuenta: { versionesDe: () => [] },
      ilustraciones: { hay: () => false },
      visitados: { yaVisitado: (s) => pisados.has(s), anota: (s) => pisados.add(s) },
      diario: estadoDeDiario(),
    });

    let tMs = 0;
    let donde = { x: beats[0].lugar.x + LEJOS_M, y: beats[0].lugar.y + LEJOS_M };
    for (const beat of beats) {
      const destino = { x: beat.lugar.x, y: beat.lugar.y };
      const camino = andaDesde(donde, destino, tMs);
      if (camino.length) tMs = camino[camino.length - 1].tMs;
      const quieta = seParaEn(destino, tMs);
      tMs = quieta[quieta.length - 1].tMs;
      donde = destino;
      llegadas.comprueba({ posiciones: [...camino, ...quieta] });
      while (llegadas.espera()) { let paso; do { paso = llegadas.avanza(); } while (!paso.cerrada); }
    }

    assert.deepEqual(
      preguntados.filter((sitio, i) => preguntados.indexOf(sitio) !== i),
      [],
      'la cola de entregas ha sido preguntada dos veces por el mismo sitio en la misma salida',
    );
  });
});

// ── El telón de una aventura entera, con su desenlace compuesto ────────────────

describe('El telón de una aventura andada entera', () => {
  /** Una partida con su registro, su salida abierta y su aventura aceptada. */
  async function partidaConLazo({ plantilla = null, hastaBeat = null } = {}) {
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    const casteada = plantilla
      ? mundo.casting.find((c) => c.ok && c.plantilla === plantilla)
      : mundo.casting.find((c) => c.ok && c.tpl.rumor?.notable);
    assert.ok(casteada, 'el mundo de referencia no trae ninguna aventura que cumpla lo que el caso necesita');

    const estado = estadoInicial({ semilla: SEMILLA_A });
    const registro = registroInicial();
    abreSalida(estado.aventuras, { salida: SALIDA, mapaId: MAPA, aventura: casteada.aventura.id });
    const andado = andaElLazo({ mundo, casteada, estado: estado.aventuras, registro, hastaBeat });
    return { mundo, casteada, estado, registro, andado };
  }

  /** Echa el telón sobre la salida abierta, con lo que no cambia ya puesto. */
  function telonDe({ estado, registro, mundo, casteada, desenlace = null }) {
    return echaElTelon({
      estado,
      registro,
      calendario: calendarioEn(DIA),
      mundo,
      mapaId: MAPA,
      salida: SALIDA,
      paso: 3,
      pendientes: libroDePendientes(),
      lugar: casteada.aventura.beats[0].lugar.nombre,
      aventura: casteada.aventura,
      desenlace,
      repuesto: repuestoDe(casteada.tpl),
      idioma: IDIOMA,
      piezas: piezasDeSerie(),
    });
  }

  test('Una aventura andada entera se cierra terminada, con su desenlace, su oro y su rumor', async () => {
    const { mundo, casteada, estado, registro, andado } = await partidaConLazo();
    assert.equal(andado.terminada, true, `"${casteada.plantilla}" no se ha podido terminar andando su lazo: ${JSON.stringify(andado.sinResolver)}`);

    // El desenlace se **compone** desde la plantilla y la aventura casteada. Antes no lo
    // componía nadie y el telón salía sin él, sin oro y sin rumor.
    const desenlace = componeElDesenlace({ plantilla: casteada.tpl, aventura: casteada.aventura, salida: SALIDA });
    assert.deepEqual(desenlace.lugar, lugarDelDesenlace(casteada.aventura.beats), 'el desenlace no ocurre donde acaba la aventura');
    assert.equal(typeof desenlace.oro, 'number', 'el desenlace no trae el oro que la plantilla declara');

    const cerrado = telonDe({ estado, registro, mundo, casteada, desenlace });
    assert.equal(cerrado.aventura.comoAcabo, 'terminada', 'la aventura andada entera no se cierra como terminada');
    assert.equal(cerrado.progresion.oro, desenlace.oro, 'el oro del desenlace no ha ingresado');
    assert.ok(cerrado.rumor, 'una aventura terminada con desenlace notable no ha hecho nacer ningún rumor');
    assert.equal(cerrado.rumor.origen, desenlace.lugar.id, 'el rumor no nace donde acabó la aventura');

    // Y el telón enseña el desenlace, no el cierre en corto.
    const estados = cerrado.telon.pantallas.map((p) => p.estado);
    assert.ok(estados.includes('desenlace'), `el telón de una aventura terminada enseña ${JSON.stringify(estados)}`);
    assert.equal(estados.includes('cierre-en-corto'), false, 'el telón de una aventura terminada enseña el cierre en corto');
  });

  test('El desenlace de una aventura terminada entrega lo que su plantilla declara', async () => {
    const mundos = await laVueltaEntera();
    const terminadas = todas(mundos).filter((a) => a.andado.terminada);
    assert.equal(terminadas.length, 102, 'no se han terminado las 102 aventuras y el reparto de lo entregado no mediría nada');

    let conOro = 0;
    let conObjeto = 0;
    let conRumor = 0;
    for (const { mundo, casteada } of terminadas) {
      const desenlace = componeElDesenlace({ plantilla: casteada.tpl, aventura: casteada.aventura, salida: SALIDA });
      assert.equal(desenlace.aventura, casteada.aventura.id, `${mundo}/${casteada.plantilla}: el desenlace no es de esta aventura`);
      // La identidad lleva la salida dentro: es lo que separa dos vueltas de la misma
      // plantilla, que comparten `aventura.id` y reventaban al nacer el rumor.
      assert.ok(desenlace.id.includes(SALIDA), `${mundo}/${casteada.plantilla}: la identidad del desenlace no distingue dos vueltas de la misma plantilla`);
      if (Number.isFinite(desenlace.oro) && desenlace.oro > 0) conOro++;
      if (desenlace.objetos.length) conObjeto++;
      if (casteada.tpl.rumor?.notable) conRumor++;
    }

    // Las cifras medidas: oro en las 102, objeto en 28 y rumor en 95. Con el desenlace sin
    // componer eran cero, cero y cero, porque el telón salía sin nada.
    assert.equal(conOro, 102, `solo ${conOro} de 102 desenlaces entregan oro`);
    assert.equal(conObjeto, 28, `${conObjeto} de 102 desenlaces entregan objeto y se midieron 28`);
    assert.equal(conRumor, 95, `${conRumor} de 102 aventuras terminadas hacen nacer rumor y se midieron 95`);
  });

  test('El cierre en corto ocupa el sitio del desenlace', async () => {
    // Se anda medio lazo y se vuelve. La aventura queda a medias, y lo declara el motor:
    // no se le dice desde fuera.
    const { mundo, casteada, estado, registro, andado } = await partidaConLazo({ hastaBeat: 1 });
    assert.equal(andado.terminada, false, 'medio lazo ha terminado la aventura y el caso no mide nada');

    const cerrado = telonDe({ estado, registro, mundo, casteada, desenlace: null });
    assert.equal(cerrado.aventura.comoAcabo, 'a-medias');

    const estados = cerrado.telon.pantallas.map((p) => p.estado);
    assert.ok(estados.includes('cierre-en-corto'), `el telón de una aventura a medias enseña ${JSON.stringify(estados)}`);
    assert.equal(estados.includes('desenlace'), false, 'el telón enseña el desenlace de una aventura que no se terminó');
    // En su sitio, y no debajo: el cierre en corto ocupa el hueco del desenlace.
    assert.equal(estados.indexOf('cierre-en-corto'), 1, 'el cierre en corto no ocupa el sitio del desenlace');
    assert.ok(estados.includes('diario'), 'el telón de un cierre en corto no llega a la entrada del diario');

    const pantalla = cerrado.telon.pantallas.find((p) => p.estado === 'cierre-en-corto');
    assert.equal(typeof pantalla.parrafo, 'string', 'el cierre en corto llega sin su texto de repuesto');
    assert.ok(pantalla.parrafo.length > 0);
  });

  test('Un cierre en corto no genera rumor', async () => {
    const { mundo, casteada, estado, registro } = await partidaConLazo({ hastaBeat: 1 });
    assert.equal(casteada.tpl.rumor?.notable, true, 'la plantilla del caso no declara desenlace notable, así que la ausencia de rumor no probaría nada');

    const cerrado = telonDe({ estado, registro, mundo, casteada, desenlace: null });
    assert.equal(cerrado.rumor, null, 'un cierre en corto ha hecho nacer un rumor');
    assert.equal(
      cerrado.telon.pantallas.some((p) => p.estado === 'rumor'),
      false,
      'el telón de un cierre en corto enseña lo que se pone en camino',
    );
  });
});

// ── La memoria de la lista ─────────────────────────────────────────────────────

describe('La lista de hoy tiene memoria', () => {
  /** La petición de la lista, con lo que no cambia entre los dos días. */
  const peticion = (mundo, extra) => ({ mundo, oficio: 'taberna', tramo: TRAMO, mapaId: MAPA, ...extra });

  test('Una aventura ya vivida no se vuelve a ofrecer', async () => {
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    const aventuras = estadoDeAventuras();
    const registro = registroInicial();

    const dia1 = componeLoQueHayHoy(peticion(mundo, { calendario: calendarioEn(1), aventuras }));
    assert.equal(dia1.hayLista, true);
    assert.equal(dia1.entradas.length, 3, 'el mundo de referencia no ofrece tres el día 1 y el caso no mediría nada');

    // Se viven las tres: aceptadas y cerradas. Cómo acabaron da igual —terminarla y que se
    // resolviera sin ti son dos finales, y ninguno de los dos se repite.
    for (const entrada of dia1.entradas) {
      acepta(aventuras, { aventura: { id: entrada.id, plantilla: entrada.id, beats: entrada.beats }, mapaId: MAPA, registro, dia: 1, paso: 1 });
      cierra(aventuras, { registro, dia: 1, paso: 1, motivo: 'volver' });
    }
    assert.equal(aventurasCerradas(aventuras).length, 3);

    const dia6 = componeLoQueHayHoy(peticion(mundo, { calendario: calendarioEn(6), aventuras }));
    assert.equal(dia6.hayLista, true, 'el día 6 no hay lista, y el mundo tiene plantillas de sobra');
    assert.equal(dia6.entradas.length, 3, 'el día 6 no se ofrecen tres');

    const repetidas = dia6.entradas.map((e) => e.id).filter((id) => dia1.entradas.some((e) => e.id === id));
    assert.deepEqual(repetidas, [], 'el día 6 vuelven aventuras que ya se vivieron el día 1');

    // Y la mitad que lo hace medir algo: **sin el registro, los mismos tres títulos**. Es
    // exactamente lo que pasaba, y sin este contraste el caso pasaría también con una lista
    // que cambiara sola por el día.
    const sinMemoria = componeLoQueHayHoy(peticion(mundo, { calendario: calendarioEn(6) }));
    assert.deepEqual(
      sinMemoria.entradas.map((e) => e.id),
      dia1.entradas.map((e) => e.id),
      'la lista cambia sola sin registro de aventuras, así que la memoria no es lo que la está cambiando',
    );
  });

  test('Lo cerrado en un mapa no se descuenta de otro', async () => {
    const mundo = await generaMundo('costero', semillaDe('costero', '1'));
    const aventuras = estadoDeAventuras();
    const registro = registroInicial();

    const dia1 = componeLoQueHayHoy(peticion(mundo, { calendario: calendarioEn(1), aventuras }));
    for (const entrada of dia1.entradas) {
      acepta(aventuras, { aventura: { id: entrada.id, plantilla: entrada.id, beats: entrada.beats }, mapaId: MAPA, registro, dia: 1, paso: 1 });
      cierra(aventuras, { registro, dia: 1, paso: 1, motivo: 'volver' });
    }

    const enOtroMapa = componeLoQueHayHoy(peticion(mundo, { calendario: calendarioEn(6), aventuras, mapaId: 'fuera' }));
    assert.deepEqual(
      enOtroMapa.entradas.map((e) => e.id),
      dia1.entradas.map((e) => e.id),
      'lo cerrado en el mapa de casa se está descontando de otro mapa',
    );
  });
});

// ── La noticia sale del pueblo ─────────────────────────────────────────────────

describe('La noticia sale del pueblo con el propagador cableado', () => {
  const NUCLEOS = ['Albariza', 'Bermeda', 'Cobreira', 'Dorna', 'Ermida'];
  const RUMOR = 'lo-mio';

  /** El mapa lineal con la partida montada y su motor, o el motor pelado de antes. */
  function mapaConMotor({ conProductores = true } = {}) {
    const mundo = mundoLineal(NUCLEOS);
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const arbol = arbolDeCalzadas(mundo);
    const motor = conProductores
      ? creaMotorDeLaPartida({
        semilla: SEMILLA_A,
        mapaId: MAPA,
        mundo,
        tramo: TRAMO,
        rumores: estado.rumores,
        nucleos: estado.nucleos,
        entregas: estado.entregas,
        pasos: estado.pasos,
        arbol,
      }).motor
      // El motor tal como se armaba antes: sin ningún productor colgado, que es lo que
      // hacía que el mundo avanzara sin que nada se moviera.
      : creaMotorDePasos({ semilla: SEMILLA_A, mapaId: MAPA, estado: estadoDePasos(), productores: [] });
    return { mundo, estado, arbol, motor };
  }

  /** Hace nacer el rumor de un desenlace de quien juega en el primer núcleo. */
  function ocurreEn(nucleo, { estado, arbol }) {
    return naceRumor({
      estado: estado.rumores,
      nucleos: estado.nucleos,
      mapaId: MAPA,
      arbol,
      desenlace: desenlaceEn(nucleo, { id: RUMOR }),
      n: 0,
    });
  }

  test('Nace fiel y en el sitio', () => {
    const mapa = mapaConMotor();
    const rumor = ocurreEn('Albariza', mapa);
    assert.ok(rumor, 'un desenlace notable no ha hecho nacer ningún rumor');

    assert.equal(nivelEn(mapa.estado.nucleos, MAPA, 'Albariza', RUMOR), 0, 'el rumor no ha nacido en nivel 0 donde ocurrió');
    for (const nucleo of NUCLEOS.slice(1)) {
      assert.equal(nivelEn(mapa.estado.nucleos, MAPA, nucleo, RUMOR), null, `el rumor ya se cuenta en "${nucleo}" el día que nació`);
    }
  });

  test('Se puede ser alguien en un pueblo donde no has estado', () => {
    // Sin productores cableados el mundo avanza y la noticia se queda donde ocurrió: es el
    // defecto medido, y sin este lado el caso no distinguiría propagar de no propagar.
    const mudo = mapaConMotor({ conProductores: false });
    ocurreEn('Albariza', mudo);
    mudo.motor.avanza(10);
    const oyeronSinMotor = NUCLEOS.filter((n) => nivelEn(mudo.estado.nucleos, MAPA, n, RUMOR) !== null);
    assert.deepEqual(oyeronSinMotor, ['Albariza'], 'sin propagador cableado la noticia ha salido del pueblo por su cuenta');

    // Y con el motor de la partida, que cuelga sus dos productores en su orden declarado.
    assert.deepEqual([...PRODUCTORES_DE_LA_PARTIDA], ['rumores', 'entregas']);
    const vivo = mapaConMotor();
    ocurreEn('Albariza', vivo);
    vivo.motor.avanza(10);

    const oyeron = NUCLEOS.filter((n) => nivelEn(vivo.estado.nucleos, MAPA, n, RUMOR) !== null);
    assert.ok(oyeron.length > 1, `con el propagador cableado la noticia sigue solo en ${JSON.stringify(oyeron)}`);
    // La cifra medida: en diez pasos la noticia sube la cadena hasta el cuarto pueblo. Se
    // afirma entera y no «alguno más», porque «alguno más» lo cumpliría también una
    // propagación que se parase en el vecino de al lado.
    assert.deepEqual(oyeron, ['Albariza', 'Bermeda', 'Cobreira', 'Dorna'], 'la noticia no ha recorrido la cadena hasta donde se midió en diez pasos');

    // Y lo que el escenario dice: en el pueblo de al lado, donde no se ha estado nunca, ya
    // saben quién eres, y saben además que el suceso fue en otro sitio.
    const vecino = 'Bermeda';
    const alli = loQueSeCuentaEn(vivo.estado.nucleos, { mapaId: MAPA, nucleo: vecino });
    assert.equal(alli.length, 1, `en "${vecino}", donde no se ha estado nunca, no saben todavía quién eres`);
    assert.equal(alli[0].origen, 'Albariza', 'lo que saben de ti no dice dónde ocurrió');
    assert.equal(alli[0].hechos.protagonista.tipo, PROTAGONISTAS.JUGADORA, 'lo que se cuenta en el pueblo de al lado no es de quien juega');
  });

  test('El rango sube donde llega la noticia y en ningún otro sitio', () => {
    // La otra mitad, la que mira el rango: sube en el vecino al que la noticia llegó sin que
    // se pisara, y no se mueve en el pueblo al que no llegó. Sin el propagador cableado la
    // noticia no salía de donde ocurrió y el vecino se quedaba en el escalón de partida.
    const escalonDe = (mapa, nucleo) => rangoEn(mapa.estado.nucleos, { mapaId: MAPA, nucleo, mapa: mapa.arbol }).escalon;

    const mudo = mapaConMotor({ conProductores: false });
    ocurreEn('Albariza', mudo);
    mudo.motor.avanza(10);
    assert.equal(escalonDe(mudo, 'Bermeda'), ESCALON_DE_PARTIDA, 'sin propagador cableado el vecino ha dejado de ser forastero');

    const vivo = mapaConMotor();
    ocurreEn('Albariza', vivo);
    vivo.motor.avanza(10);
    assert.notEqual(escalonDe(vivo, 'Albariza'), ESCALON_DE_PARTIDA, 'donde ocurrió sigues siendo forastera');
    assert.notEqual(escalonDe(vivo, 'Bermeda'), ESCALON_DE_PARTIDA, 'en el vecino al que llegó la noticia sigues siendo forastera');
    assert.equal(escalonDe(vivo, 'Ermida'), ESCALON_DE_PARTIDA, 'en el pueblo al que la noticia no ha llegado ya no eres forastera');
  });
});
