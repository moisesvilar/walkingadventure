// SPEC-037 · La primera coincidencia puesta en escena: qué es coincidir, los tres
// estados del marcador de una sola vez y la escena de A6P3.
//
// Lo que aquí se defiende es el mejor truco del juego: la primera vez que alguien
// cuenta una segunda versión de algo ya apuntado, las dos se enseñan juntas, en el
// sitio, **sin explicar nada y sin decir cuál es la buena**. Ocurre una sola vez en toda
// la partida, y esa mitad de RF-DIARIO-002 es la que puede romperse en silencio meses
// después de la primera: por eso hay prueba de que no vuelve.
//
// Cuatro decisiones de este fichero que no son de estilo:
//
// - **Los tres estados se recorren enteros, y el intermedio se prueba con la app
//   muerta.** Cerrar la app entre detectar la coincidencia y enseñarla es un
//   `congelaDiario` seguido de un `levantaDiario`, nunca una espera; y lo que se afirma
//   es que la escena **se debe y se paga**, con las dos mismas versiones.
// - **«No explica que las noticias se deforman» se comprueba sobre todos los textos que
//   la escena produce**, con la lista cerrada `PALABRAS_QUE_LA_ESCENA_NO_DICE`. Leído a
//   ojo, ese criterio no se pone rojo nunca (`decisiones-orquestador.md` §6o).
// - **La escena se pide donde ocurre**: la capa de llegadas montada entera, con su
//   mundo, su cola y lo que se cuenta en cada núcleo. Componerla a mano no demostraría
//   que ocurre en la llegada y no al abrir el diario en casa.
// - **Cerrar la escena no es una operación de la capa de llegadas**, y se afirma: esa
//   capa no recibe ni un toque de quien juega, y añadirle una operación que sí lo
//   hiciera sería la primera grieta de «validar no es un gesto».
//
// Escenario de `docs/testing.md` reutilizado con su nombre literal: «La primera
// coincidencia se pone en escena», etiquetado `@app` en la batería y verificado aquí en
// `@nucleo` sobre el dato de la escena; lo que solo ve Maestro —que es modal y que no se
// puede saltar— está en `test/app/diario.yaml`. Todo lo demás va marcado como hueco de
// la batería en `test/spec-test-map.json`.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as moduloDeTriangulacion from '../../packages/nucleo/partida/triangulacion.js';
import {
  ACCIONES_DE_LA_ESCENA,
  ESTADOS_DEL_MARCADOR,
  IDS_DE_ESTADO_DEL_MARCADOR,
  PALABRAS_QUE_LA_ESCENA_NO_DICE,
  TEXTOS,
  anotaLaCoincidencia,
  cierraLaEscena,
  coincidencia,
  componeLaEscena,
  estadoDelMarcador,
  hayVistaPorHistorias,
  infraccionesDeLaEscena,
  laEscenaQueSeDebe,
} from '../../packages/nucleo/partida/triangulacion.js';
import {
  apunta,
  apuntaLoQueSeCuenta,
  congelaDiario,
  entradasDe,
  estadoDeDiario,
  levantaDiario,
  proyeccion,
} from '../../packages/nucleo/partida/diario.js';
import { abreElDiario, abreCapitulo } from '../../packages/nucleo/partida/capitulos.js';
import {
  PERMANENCIA_MS,
  creaLlegadas,
  estadoDeLlegadas,
} from '../../packages/nucleo/partida/llegadas.js';
import { estadoDeNucleos, loQueSeCuentaEn, sedimenta, versionQueLlego } from '../../packages/nucleo/partida/nucleos.js';
import { SIGNOS, hechosFieles } from '../../packages/nucleo/partida/deformacion.js';
import { creaDetectorDeTransporte } from '../../packages/nucleo/partida/transporte.js';
import { MAPA, SUCESO, entradaDe } from './diario-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';

// ── El decorado ────────────────────────────────────────────────────────────────

const MONFRIDA = 'Monfrida';
const VILANOVA = 'Vilanova';
const CANEDO = 'Canedo';
const SALIDA = 'la-salida-de-hoy';

const LLEGADAS = 'packages/nucleo/partida/llegadas.js';
const TRIANGULACION = 'packages/nucleo/partida/triangulacion.js';

/** Un mundo de tres núcleos en línea, lejos unos de otros: cada llegada es la suya. */
function mundoDeTresNucleos() {
  return {
    settlements: [
      { name: MONFRIDA, x: 0, y: 0, services: [] },
      { name: VILANOVA, x: 3000, y: 0, services: [] },
      { name: CANEDO, x: 6000, y: 0, services: [] },
    ],
    parajes: [],
  };
}

/** Posiciones de una parada: el mismo punto, marcas de tiempo que avanzan. */
function paradoEn({ x, desdeMs = 0, duracionMs = PERMANENCIA_MS, cadaMs = 5000 }) {
  const posiciones = [];
  for (let t = 0; t <= duracionMs; t += cadaMs) posiciones.push({ x, y: 0, tMs: desdeMs + t, clasificacion: 'parada' });
  return posiciones;
}

/** Una versión de lo que se cuenta en un núcleo, con su nivel y el texto que la cuenta. */
function version({ rumor = SUCESO, nivel = 1, veces = 3, origen = MONFRIDA, texto = null } = {}) {
  return versionQueLlego({
    rumor,
    plantilla: 'entrega-sospechosa',
    origen,
    nivel,
    signo: SIGNOS.BUENO,
    texto,
    hechos: hechosFieles({ asunto: 'la ermita tocó a rebato', escala: { veces }, detalle: { lugar: MONFRIDA } }),
  });
}

/** La capa de llegadas montada entera, con lo que se cuenta en cada núcleo. */
function capa({ cuentan = {}, diario = estadoDeDiario() } = {}) {
  const nucleos = estadoDeNucleos();
  for (const [nucleo, versiones] of Object.entries(cuentan)) {
    for (const v of versiones) sedimenta(nucleos, { mapaId: MAPA, nucleo, loQueLlego: v });
  }
  const pisados = new Set();
  const llegadas = creaLlegadas({
    mundo: mundoDeTresNucleos(),
    mapaId: MAPA,
    salida: SALIDA,
    estado: estadoDeLlegadas(),
    detector: creaDetectorDeTransporte(),
    reparto: { beats: [] },
    diario,
    cola: { microEncuentroEn: () => null },
    loQueSeCuenta: { versionesDe: (nucleo) => loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo }) },
    ilustraciones: { hay: () => false },
    visitados: { yaVisitado: (sitio) => pisados.has(sitio), anota: (sitio) => pisados.add(sitio) },
  });
  return { llegadas, diario };
}

/** Llegar a un núcleo del mundo de prueba y que allí te cuenten lo que cuenten. */
function llegaA(llegadas, sitio, { dia, paso }) {
  const x = { [MONFRIDA]: 0, [VILANOVA]: 3000, [CANEDO]: 6000 }[sitio];
  llegadas.comprueba({ posiciones: paradoEn({ x, desdeMs: paso * 600000 }) });
  return llegadas.loQueAquiSeCuenta({ sitio, dia, paso });
}

/** Un diario con las dos entradas del suceso ya apuntadas y la coincidencia sin anotar. */
function diarioConDosVersiones({ textoAqui = 'texto-de-vilanova', textoAlla = 'texto-de-monfrida' } = {}) {
  const previa = entradaDe({ nucleo: MONFRIDA, dia: 22, paso: 40, veces: 3, nivel: 1, texto: textoAlla });
  const nueva = entradaDe({ nucleo: VILANOVA, dia: 23, paso: 55, veces: 1, nivel: 0, texto: textoAqui });
  const diario = estadoDeDiario();
  apunta(diario, previa);
  apunta(diario, nueva);
  return { diario, previa, nueva };
}

/** Todas las cadenas que hay dentro de un valor, para revisar la escena entera. */
function textosDe(valor, salida = []) {
  if (typeof valor === 'string') salida.push(valor);
  else if (Array.isArray(valor)) for (const v of valor) textosDe(v, salida);
  else if (valor && typeof valor === 'object') for (const v of Object.values(valor)) textosDe(v, salida);
  return salida;
}

/** El código de un fichero del repo sin comentarios ni textos. */
function codigoSinTextos(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
    .join('\n')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

// ── La escena ──────────────────────────────────────────────────────────────────

describe('La primera coincidencia se pone en escena', () => {
  test('La primera coincidencia se pone en escena', () => {
    // El escenario de la batería, entero y donde ocurre: con la versión de tres
    // campanas apuntada en «Monfrida», llegar a «Vilanova», donde se cuenta otra
    // versión de lo mismo, enseña las dos juntas.
    const { llegadas, diario } = capa({
      cuentan: {
        [MONFRIDA]: [version({ nivel: 1, veces: 3, texto: 'texto-de-monfrida' })],
        [VILANOVA]: [version({ nivel: 0, veces: 1, texto: 'texto-de-vilanova' })],
      },
    });
    llegaA(llegadas, MONFRIDA, { dia: 22, paso: 40 });
    const enVilanova = llegaA(llegadas, VILANOVA, { dia: 23, paso: 55 });

    assert.equal(enVilanova.triangulacion, true, 'la primera coincidencia no se ha detectado en la llegada');
    const { escena } = enVilanova;
    assert.ok(escena, 'llegar a un núcleo donde se cuenta otra versión de lo mismo no pone nada en escena');
    assert.equal(escena.versiones.length, 2, 'la escena no enseña las dos versiones juntas');
    assert.deepEqual(escena.versiones.map((v) => v.hechos.escala.veces), [1, 3]);
    assert.equal(escena.suceso, SUCESO);

    // Y no explica en ningún texto que las noticias se deforman, ni dice cuál es la
    // buena: se comprueba sobre **todas** las cadenas que la escena produce.
    for (const texto of textosDe(escena)) {
      assert.deepEqual(infraccionesDeLaEscena(texto), [], `la escena dice "${texto}"`);
    }
    // Ninguna de las dos lleva marca ni tipografía que la distinga: misma forma exacta.
    assert.deepEqual(Object.keys(escena.versiones[0]).sort(), Object.keys(escena.versiones[1]).sort());
    assert.equal(diario.entradas.length, 2);
  });

  test('La escena no explica nada y no marca ninguna de las dos versiones', () => {
    const { diario, previa, nueva } = diarioConDosVersiones();
    anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: MAPA, nuevas: [nueva] }));
    const escena = componeLaEscena(diario, { dia: 23 });

    // La lista cerrada existe y es lo que hace afirmable «no explica»: comprobado a ojo,
    // ese criterio no se pone rojo nunca.
    for (const palabra of ['deform', 'fiabilidad', 'verdad', 'la buena', 'nivel']) {
      assert.ok(PALABRAS_QUE_LA_ESCENA_NO_DICE.includes(palabra), `"${palabra}" no está declarada como palabra que la escena no dice`);
    }
    assert.deepEqual(infraccionesDeLaEscena('Las noticias se deforman al viajar'), ['deform']);
    assert.deepEqual(infraccionesDeLaEscena(escena.entreLasDos), []);
    assert.deepEqual(infraccionesDeLaEscena(escena.remate), []);

    // Y ninguna clave de las versiones insinúa cuál es la buena.
    for (const version of escena.versiones) {
      for (const marca of ['nivel', 'fiel', 'veraz', 'correcta', 'buena', 'orden']) {
        assert.equal(Object.prototype.hasOwnProperty.call(version, marca), false, `una versión de la escena lleva "${marca}"`);
      }
    }
    assert.equal(previa.nivel !== nueva.nivel, true, 'las dos versiones tienen el mismo nivel: la prueba no mediría nada');
  });

  test('Arriba va la que se acaba de oír, con el sitio donde se está, y debajo la que ya estaba apuntada', () => {
    const { diario, nueva } = diarioConDosVersiones();
    anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: MAPA, nuevas: [nueva] }));
    const escena = componeLaEscena(diario, { dia: 25 });

    const [arriba, abajo] = escena.versiones;
    assert.equal(arriba.lugar, VILANOVA, 'arriba no va la que se acaba de oír');
    assert.equal(arriba.cuando, TEXTOS.aqui);
    assert.equal(arriba.aqui, true);
    assert.equal(arriba.hace, 0);
    assert.equal(abajo.lugar, MONFRIDA);
    assert.equal(abajo.hace, 3, 'la que ya estaba apuntada no dice hace cuántos días de diario se oyó');
    assert.equal(abajo.cuando, TEXTOS.alla(MONFRIDA, 3));
    assert.equal(TEXTOS.alla(MONFRIDA, 3), 'En Monfrida, hace 3 días');
    // Ayer y hoy se dicen con palabras, que es lo que hace que la fórmula no sea una cifra
    // suelta: el día de diario no se enseña nunca como fecha.
    assert.equal(TEXTOS.alla(MONFRIDA, 1), 'En Monfrida, ayer');
    assert.equal(TEXTOS.alla(MONFRIDA, 0), 'En Monfrida, hoy');
    assert.equal(escena.antetitulo, TEXTOS.antetitulo(VILANOVA));
    assert.equal(escena.sitio, VILANOVA);
  });

  test('Los dos textos de la escena son los de las dos entradas del diario y no una redacción nueva', () => {
    const { diario, previa, nueva } = diarioConDosVersiones();
    anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: MAPA, nuevas: [nueva] }));
    const escena = componeLaEscena(diario, { dia: 23 });

    const [proyectadaNueva, proyectadaPrevia] = proyeccion([nueva, previa]);
    for (const [version, esperada] of [[escena.versiones[0], proyectadaNueva], [escena.versiones[1], proyectadaPrevia]]) {
      assert.equal(version.id, esperada.id);
      assert.equal(version.texto, esperada.texto, 'el texto de la escena no es el de la entrada del diario');
      assert.equal(version.plantilla, esperada.plantilla);
      assert.deepEqual(version.hechos, esperada.hechos);
    }
    assert.deepEqual([escena.versiones[0].texto, escena.versiones[1].texto], ['texto-de-vilanova', 'texto-de-monfrida']);

    // Y este módulo no redacta ni una versión: las localiza y las proyecta.
    const codigo = codigoSinTextos(TRIANGULACION);
    for (const redaccion of [/redacta/i, /narrador\./, /componeTexto/, /plantillaDe\s*\(/]) {
      assert.equal(redaccion.test(codigo), false, `la triangulación redacta un texto propio (${redaccion})`);
    }
  });

  test('La escena tiene una sola acción, la que la cierra, y no hay manera de descartarla sin leerla', () => {
    const { diario, nueva } = diarioConDosVersiones();
    anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: MAPA, nuevas: [nueva] }));
    const escena = componeLaEscena(diario, { dia: 23 });

    assert.equal(escena.acciones.length, 1);
    assert.deepEqual(escena.acciones.map((a) => a.id), ['apuntarlo']);
    assert.equal(escena.acciones[0].texto, TEXTOS.apuntarlo);
    assert.deepEqual([...ACCIONES_DE_LA_ESCENA], ['apuntarlo']);
    assert.equal(escena.sePuedeSaltar, false);
    assert.equal(escena.sePuedeDescartar, false);
    for (const salida of ['saltar', 'descartar', 'cerrar', 'atras', 'masTarde']) {
      assert.equal(escena.acciones.some((a) => a.id === salida), false, `la escena ofrece "${salida}"`);
    }
  });
});

// ── Los tres estados del marcador ──────────────────────────────────────────────

describe('Los tres estados del marcador de una sola vez', () => {
  test('El marcador tiene tres estados y se deriva del par marcador-escena', () => {
    assert.deepEqual([...IDS_DE_ESTADO_DEL_MARCADOR], ['nunca', 'pendiente', 'hecho']);
    const diario = estadoDeDiario();
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.NUNCA);
    assert.equal(diario.escena, null);
    // El estado no se guarda aparte: un tercer campo con su nombre podría
    // desincronizarse de los otros dos.
    assert.equal(Object.prototype.hasOwnProperty.call(diario, 'estadoDelMarcador'), false);
    assert.throws(() => estadoDelMarcador({}), /mal formado/);
  });

  test('Una segunda versión de otra fuente deja el marcador pendiente y la escena se debe', () => {
    const { diario, nueva } = diarioConDosVersiones();
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.NUNCA);
    assert.equal(laEscenaQueSeDebe(diario), null);

    const encontrada = coincidencia(diario, { mapaId: MAPA, nuevas: [nueva] });
    assert.equal(encontrada.suceso, SUCESO);
    assert.equal(encontrada.nueva.lugar, VILANOVA);
    assert.equal(encontrada.previa.lugar, MONFRIDA);

    assert.equal(anotaLaCoincidencia(diario, encontrada), ESTADOS_DEL_MARCADOR.PENDIENTE);
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.PENDIENTE);
    const debida = laEscenaQueSeDebe(diario);
    assert.equal(debida.suceso, SUCESO);
    assert.equal(debida.vista, false);
    // Y en pendiente la vista por historias todavía no está: triangular es haber visto
    // las dos versiones juntas, no que el código lo haya notado.
    assert.equal(hayVistaPorHistorias(diario), false);
  });

  test('Cerrar la app entre detectar la coincidencia y enseñarla no regala la escena ni la pierde', () => {
    const { diario, nueva } = diarioConDosVersiones();
    anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: MAPA, nuevas: [nueva] }));
    const antesDeMorir = componeLaEscena(diario, { dia: 23 });

    // La app se cierra y se vuelve a abrir: el estado va y vuelve por su documento.
    const devuelta = levantaDiario(JSON.parse(JSON.stringify(congelaDiario(diario))));
    assert.equal(estadoDelMarcador(devuelta), ESTADOS_DEL_MARCADOR.PENDIENTE, 'la escena se ha perdido al cerrar la app');
    assert.equal(hayVistaPorHistorias(devuelta), false, 'la vista por historias se ha regalado sin haber visto la escena');

    // Y se paga en la siguiente llegada, con las dos mismas versiones.
    const luego = componeLaEscena(devuelta, { dia: 26 });
    assert.deepEqual(luego.versiones.map((v) => v.id), antesDeMorir.versiones.map((v) => v.id));
    assert.equal(luego.sitio, antesDeMorir.sitio);
    // El «hace cuántos días» se compone al pintar y por eso cambia con el día; las dos
    // versiones no.
    assert.equal(antesDeMorir.versiones[1].hace, 1);
    assert.equal(luego.versiones[1].hace, 4);
  });

  test('Una escena enseñada y cerrada deja el marcador hecho y no se puede volver a poner en pendiente', () => {
    const { diario, nueva } = diarioConDosVersiones();
    anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: MAPA, nuevas: [nueva] }));
    assert.equal(cierraLaEscena(diario), ESTADOS_DEL_MARCADOR.HECHO);
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.HECHO);
    assert.equal(hayVistaPorHistorias(diario), true);
    assert.equal(laEscenaQueSeDebe(diario), null);
    assert.equal(componeLaEscena(diario, { dia: 30 }), null, 'la escena se vuelve a enseñar después de cerrada');

    // Y no hay ninguna ruta pública de vuelta: ni cerrando otra vez, ni encendiendo el
    // marcador otra vez, ni ninguna operación exportada que lo devuelva atrás.
    assert.throws(() => cierraLaEscena(diario), /"hecho"/);
    assert.throws(() => anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: MAPA, nuevas: [nueva] })), /"hecho"/);
    assert.deepEqual(Object.keys(moduloDeTriangulacion).sort(), [
      'ACCIONES_DE_LA_ESCENA',
      'ESTADOS_DEL_MARCADOR',
      'IDS_DE_ESTADO_DEL_MARCADOR',
      'PALABRAS_QUE_LA_ESCENA_NO_DICE',
      'TEXTOS',
      'anotaLaCoincidencia',
      'cierraLaEscena',
      'coincidencia',
      'componeLaEscena',
      'estadoDelMarcador',
      'hayVistaPorHistorias',
      'infraccionesDeLaEscena',
      'laEscenaQueSeDebe',
    ]);
  });

  test('El marcador no se enciende dos veces', () => {
    const { diario, nueva, previa } = diarioConDosVersiones();
    const encontrada = coincidencia(diario, { mapaId: MAPA, nuevas: [nueva] });
    anotaLaCoincidencia(diario, encontrada);
    assert.throws(() => anotaLaCoincidencia(diario, encontrada), /"pendiente"/, 'el marcador se enciende dos veces');

    // Y no se enciende con cualquier cosa: las dos versiones tienen que ser del mismo
    // suceso y no la misma entrada.
    const limpio = estadoDeDiario();
    apunta(limpio, previa);
    apunta(limpio, nueva);
    assert.throws(() => anotaLaCoincidencia(limpio, null), /la coincidencia que lo justifica/);
    assert.throws(
      () => anotaLaCoincidencia(limpio, { mapa: MAPA, suceso: SUCESO, nueva, previa: { ...previa, suceso: 'otro' } }),
      /mismo suceso/,
    );
    assert.throws(
      () => anotaLaCoincidencia(limpio, { mapa: MAPA, suceso: SUCESO, nueva, previa: nueva }),
      /la misma entrada/,
    );
    // Y cerrar una escena que no se debe falla nombrando el estado en el que está.
    assert.throws(() => cierraLaEscena(limpio), /"nunca"/);
  });

  test('La escena no vuelve a ocurrir nunca después de la primera', () => {
    // La mitad de RF-DIARIO-002 que puede romperse en silencio meses después.
    const { llegadas, diario } = capa({
      cuentan: {
        [MONFRIDA]: [version({ rumor: SUCESO }), version({ rumor: 'el-farol', veces: 2 })],
        [VILANOVA]: [version({ rumor: SUCESO, nivel: 0, veces: 1 })],
        [CANEDO]: [version({ rumor: 'el-farol', nivel: 2, veces: 9 })],
      },
    });
    llegaA(llegadas, MONFRIDA, { dia: 22, paso: 40 });
    const primera = llegaA(llegadas, VILANOVA, { dia: 23, paso: 55 });
    assert.ok(primera.escena, 'la primera coincidencia no ha puesto nada en escena');
    cierraLaEscena(diario);

    // Otro suceso con dos versiones de dos fuentes distintas: la escena no vuelve.
    const segunda = llegaA(llegadas, CANEDO, { dia: 29, paso: 70 });
    assert.equal(segunda.triangulacion, false, 'se cuenta una segunda primera vez');
    assert.equal(segunda.escena, null, 'la escena vuelve a ocurrir');
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.HECHO);
    // Y el suceso nuevo sí tiene sus dos versiones apuntadas: la prueba mide algo.
    assert.equal(entradasDe(diario, { mapaId: MAPA }).filter((e) => e.suceso === 'el-farol').length, 2);
  });
});

// ── Qué es coincidir, exactamente ──────────────────────────────────────────────

describe('Qué es coincidir', () => {
  test('Dos versiones del mismo suceso oídas de la misma fuente no son una coincidencia', () => {
    // SPEC-016 no guarda una segunda entrada del mismo núcleo, así que no hay dos
    // versiones que poner en escena. Volver al mismo pueblo no aporta nada nuevo.
    const diario = estadoDeDiario();
    const primera = apuntaLoQueSeCuenta({ diario, versiones: [version()], mapaId: MAPA, nucleo: MONFRIDA, dia: 22, paso: 40 });
    const segunda = apuntaLoQueSeCuenta({ diario, versiones: [version()], mapaId: MAPA, nucleo: MONFRIDA, dia: 25, paso: 60 });
    assert.equal(primera.entradas.length, 1);
    assert.deepEqual(segunda.entradas, [], 'volver al mismo núcleo ha apuntado una segunda entrada');
    assert.equal(coincidencia(diario, { mapaId: MAPA, nuevas: segunda.entradas }), null);
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.NUNCA);
  });

  test('Dos versiones de dos sucesos distintos oídas en el mismo paso no encienden el marcador', () => {
    // Coincidir es tener dos versiones **del mismo** suceso.
    const diario = estadoDeDiario();
    const { entradas } = apuntaLoQueSeCuenta({
      diario,
      versiones: [version({ rumor: 'las-campanas' }), version({ rumor: 'el-farol' })],
      mapaId: MAPA,
      nucleo: MONFRIDA,
      dia: 22,
      paso: 40,
    });
    assert.equal(entradas.length, 2);
    assert.equal(coincidencia(diario, { mapaId: MAPA, nuevas: entradas }), null);
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.NUNCA);
  });

  test('Dos versiones del mismo suceso apuntadas en el mismo paso se resuelven con un criterio estable', () => {
    // Entre varias entradas nuevas que coincidan gana la primera en el orden en que se
    // oyeron; y el mismo estado da el mismo resultado en dos ejecuciones iguales.
    const montaje = () => {
      const diario = estadoDeDiario();
      const deMonfrida = apuntaLoQueSeCuenta({ diario, versiones: [version({ veces: 3 })], mapaId: MAPA, nucleo: MONFRIDA, dia: 23, paso: 55 });
      const deVilanova = apuntaLoQueSeCuenta({ diario, versiones: [version({ veces: 1, nivel: 0 })], mapaId: MAPA, nucleo: VILANOVA, dia: 23, paso: 55 });
      return { diario, nuevas: [...deMonfrida.entradas, ...deVilanova.entradas] };
    };
    const una = montaje();
    const otra = montaje();
    const resuelve = ({ diario, nuevas }) => {
      const encontrada = coincidencia(diario, { mapaId: MAPA, nuevas });
      return [encontrada.nueva.lugar, encontrada.previa.lugar];
    };
    assert.deepEqual(resuelve(una), resuelve(otra));
    assert.deepEqual(resuelve(una), [MONFRIDA, VILANOVA]);
    // Y una lista vacía de entradas nuevas es una respuesta, no un error.
    assert.equal(coincidencia(una.diario, { mapaId: MAPA, nuevas: [] }), null);
    assert.throws(() => coincidencia(una.diario, { mapaId: MAPA, nuevas: null }), /entradas recién apuntadas/);
  });

  test('La versión de un testigo directo coincide con la del pueblo porque la fuente es otra', () => {
    // Es lo que hace que triangular tenga dos caminos, y la propiedad que `npcs.md`
    // protege: el testigo entra como una entrada más y no corrige la del pueblo.
    const delPueblo = entradaDe({ nucleo: MONFRIDA, dia: 22, paso: 40, veces: 3, nivel: 1 });
    const delTestigo = entradaDe({
      nucleo: MONFRIDA,
      fuente: { tipo: 'cara', sitio: MONFRIDA, puesto: 'regencia' },
      dia: 23,
      paso: 55,
      veces: 1,
      nivel: 0,
    });
    const diario = estadoDeDiario();
    apunta(diario, delPueblo);
    apunta(diario, delTestigo);
    assert.equal(entradasDe(diario, { mapaId: MAPA }).length, 2, 'el testigo ha corregido la versión del pueblo');

    const encontrada = coincidencia(diario, { mapaId: MAPA, nuevas: [delTestigo] });
    assert.ok(encontrada, 'la versión del testigo no cuenta como coincidencia');
    assert.equal(encontrada.nueva.fuente.tipo, 'cara');
    assert.equal(encontrada.previa.fuente.tipo, 'nucleo');
  });
});

// ── La escena ocurre en el sitio, no en casa ───────────────────────────────────

describe('La escena ocurre en el sitio', () => {
  test('La escena ocurre en la llegada a un núcleo y nunca al abrir el diario en casa', () => {
    const { llegadas, diario } = capa({
      cuentan: {
        [MONFRIDA]: [version({ nivel: 1, veces: 3 })],
        [VILANOVA]: [version({ nivel: 0, veces: 1 })],
      },
    });
    llegaA(llegadas, MONFRIDA, { dia: 22, paso: 40 });
    const enVilanova = llegaA(llegadas, VILANOVA, { dia: 23, paso: 55 });
    assert.equal(enVilanova.escena.momento, 'al-parar', 'la escena no declara que ocurre al parar');

    // Y abrir el diario en casa no la enseña: ni la trae la tira de capítulos ni el
    // capítulo abierto. Enseñarla en casa la convertiría en un aviso de logro.
    const mapas = [{ id: MAPA, titulo: 'O Val de Monfrida' }];
    const abierto = abreElDiario({ diario, mapas, mapaActivo: MAPA });
    const capitulo = abreCapitulo({ diario, mapas, mapaActivo: MAPA, mapaId: MAPA });
    for (const [donde, vista] of [['la tira', abierto], ['el capítulo', capitulo]]) {
      assert.equal(Object.prototype.hasOwnProperty.call(vista, 'escena'), false, `${donde} trae la escena de la primera coincidencia`);
      assert.equal(JSON.stringify(vista).includes('al-parar'), false, `${donde} declara el momento de la escena`);
    }
    // Y la escena sigue debiéndose: abrir el diario no la ha consumido.
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.PENDIENTE);
  });

  test('Cerrar la escena no es una operación de la capa de llegadas', () => {
    // «Validar no es un gesto»: esa capa no recibe ni un toque de quien juega, así que
    // la operación que la escena dispara al cerrarse vive en su propio módulo y la llama
    // quien la enseña. Añadirla aquí sería la primera grieta.
    const { llegadas } = capa();
    assert.deepEqual(
      Object.keys(llegadas).sort(),
      ['avanza', 'beatDe', 'comprueba', 'espera', 'geofence', 'loQueAquiSeCuenta', 'mapaId', 'permanenciaMs', 'radioM', 'salida', 'validadas'],
    );
    for (const gesto of ['cierraLaEscena', 'apuntarlo', 'cierraLaTriangulacion', 'marcaVista']) {
      assert.equal(Object.prototype.hasOwnProperty.call(llegadas, gesto), false, `la capa de llegadas expone "${gesto}"`);
    }
    assert.equal(/cierraLaEscena/.test(codigoSinTextos(LLEGADAS)), false, 'la capa de llegadas cierra la escena por su cuenta');
  });
});
