// SPEC-037 · El diario que se consulta: un capítulo por mapa, los días de un capítulo
// y la vista por historias que se gana.
//
// Lo que aquí se defiende, y es lo que la fila entera existe para proteger: **el orden
// en que se ofrecen las dos maneras de leer**. Agrupar desde el primer día regalaría el
// mejor truco del juego; no agrupar nunca lo dejaría en algo que casi nadie ve. Por eso
// la mitad de estas pruebas afirman ausencias —que la vista por historias **no está**
// mientras no se ha triangulado, que un capítulo antiguo **no trae** ninguna acción, que
// ninguna de las tres vistas lleva el nivel— y una ausencia solo se puede poner roja
// contra una enumeración: `ACCIONES_DE_JUEGO_QUE_UN_CAPITULO_NO_TRAE`,
// `LO_QUE_EL_DIARIO_NO_ENSENA` y el juego de claves de cada proyección.
//
// Cuatro decisiones de este fichero que no son de estilo:
//
// - **Las ausencias se afirman sobre el dato, no sobre la pantalla.** Que no se pueda
//   jugar en un mapa antiguo desde el sofá se comprueba en lo que devuelve
//   `abreCapitulo`, no en que ninguna pantalla dibuje un botón: una regla que solo vive
//   en la capa que dibuja se rompe la primera vez que alguien dibuja otra.
// - **El orden se comprueba contra el desorden de inserción.** Los mismos días y las
//   mismas versiones metidos en dos órdenes distintos tienen que salir iguales; si no,
//   el «criterio declarado y estable» es el orden en que se apuntaron con otro nombre.
// - **La lámina se lee de un almacén de verdad**, con dos celdas guardadas, porque lo
//   que se afirma —que leer el diario no mueve ni un byte del mundo congelado— no se
//   puede afirmar sobre un mundo escrito a mano.
// - **Nada de aquí toca la red, el reloj del sistema ni el azar.** El momento es siempre
//   el día de diario y el paso del mundo, escritos a mano por quien prueba.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «Al principio el
// diario solo se lee por días», «A partir de ahí se abre la vista por historias», «Las
// versiones se ordenan por cuándo se oyeron», «El nivel de deformación no sale nunca a
// pantalla», «Los mapas antiguos se leen desde el diario» y «No existe ningún selector de
// mapas». Los seis están etiquetados `@app` en la batería y aquí se implementa la mitad
// que no necesita dispositivo, que en esta fila es casi toda: lo que solo ve Maestro está
// en `test/app/diario.yaml`. Todo lo demás va marcado como hueco de la batería en
// `test/spec-test-map.json`, y la spec los nombra uno a uno.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as moduloDeCapitulos from '../../packages/nucleo/partida/capitulos.js';
import {
  ACCIONES_DE_JUEGO_QUE_UN_CAPITULO_NO_TRAE,
  IDS_DE_SUBTITULO,
  IDS_DE_VISTA,
  LO_QUE_EL_DIARIO_NO_ENSENA,
  ORDEN_DE_CAPITULOS,
  ORDEN_DE_DIAS,
  ORDEN_DE_HISTORIAS,
  ORDEN_DE_VERSIONES,
  SUBTITULOS,
  TEXTOS,
  VISTAS,
  abreCapitulo,
  abreElDiario,
  capituloDe,
  capitulos,
  cierreDelHilo,
  diasDelCapitulo,
  historiasDelCapitulo,
  laminaDelCapitulo,
  sitiosDeLaLamina,
  versionesDeHistoria,
} from '../../packages/nucleo/partida/capitulos.js';
import {
  CLASES_DE_ENTRADA,
  FUENTES,
  apunta,
  congelaDiario,
  entradaDeDiario,
  estadoDeDiario,
  estadoDeTextos,
  guardaTexto,
  levantaDiario,
  textoDe,
} from '../../packages/nucleo/partida/diario.js';
import {
  CLAVES,
  abreCelda,
  cargaMapa,
  creaMapa,
  guardaMapa,
} from '../../packages/nucleo/partida/mapa.js';
import {
  ESTADOS_DEL_MARCADOR,
  anotaLaCoincidencia,
  cierraLaEscena,
  coincidencia,
  componeLaEscena,
  estadoDelMarcador,
  hayVistaPorHistorias,
} from '../../packages/nucleo/partida/triangulacion.js';
import { MAPA, OTRO_MAPA, SUCESO, entradaDe, hechosDe } from './diario-de-prueba.mjs';
import { SEMILLA_A, consultaSintetica } from './celda-de-prueba.mjs';
import { almacenEnMemoria } from './partida-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';

// ── El decorado ────────────────────────────────────────────────────────────────

const CASA = MAPA;
const VACACIONES = OTRO_MAPA;

const TITULO_DE_CASA = 'O Val de Monfrida';
const TITULO_DE_VACACIONES = 'A Ría Longa';

const MONFRIDA = 'Monfrida';
const VILANOVA = 'Vilanova';
const CANEDO = 'Canedo';

/** Los dos mapas de la partida, tal como los trae la lista de la fila 41. */
const DOS_MAPAS = [
  { id: CASA, titulo: TITULO_DE_CASA },
  { id: VACACIONES, titulo: TITULO_DE_VACACIONES },
];

const CAPITULOS = 'packages/nucleo/partida/capitulos.js';
const TRIANGULACION = 'packages/nucleo/partida/triangulacion.js';
const PANTALLA_DIARIO = 'app/pantallas/diario.jsx';
const PANTALLA_TRIANGULACION = 'app/pantallas/triangulacion.jsx';

/** Un diario con las entradas ya apuntadas, en el orden en que se le den. */
function diarioCon(entradas = []) {
  const diario = estadoDeDiario();
  for (const entrada of entradas) apunta(diario, entrada);
  return diario;
}

/** Una entrada de lo propio: lo que la jugadora escribe de su día, en primera persona. */
function entradaPropia({ mapa = CASA, suceso = 'lo-mio', dia = 1, paso = 1, lugar = MONFRIDA } = {}) {
  return entradaDeDiario({
    mapa,
    clase: CLASES_DE_ENTRADA.PROPIO,
    suceso,
    fuente: { tipo: FUENTES.NUCLEO, sitio: lugar },
    lugar,
    dia,
    paso,
    hechos: hechosDe({ veces: 1 }),
    nivel: 0,
    signo: 'bueno',
    plantilla: 'lo-que-hice-hoy',
    origen: lugar,
  });
}

/**
 * Un diario con la primera coincidencia detectada, enseñada y cerrada.
 *
 * Es el camino entero y no un atajo al estado final a propósito: la vista por historias
 * se gana **al cerrar la escena**, y montarla poniendo `triangulado` a mano probaría otra
 * cosa. Devuelve también las dos entradas, que son las de la escena.
 */
function diarioTriangulado({ dia = 30 } = {}) {
  const primera = entradaDe({ nucleo: MONFRIDA, dia: 22, paso: 40, veces: 3, nivel: 1 });
  const segunda = entradaDe({ nucleo: VILANOVA, dia: 23, paso: 55, veces: 1, nivel: 0 });
  const diario = diarioCon([primera, segunda]);
  anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: CASA, nuevas: [segunda] }));
  const escena = componeLaEscena(diario, { dia });
  cierraLaEscena(diario);
  return { diario, primera, segunda, escena };
}

/** Un mapa sintético con dos celdas abiertas y guardadas, que es la lámina de un capítulo. */
async function mapaGuardado({ id = null, tramoM = 2000 } = {}) {
  const mapa = creaMapa({ semilla: SEMILLA_A, lat: 42.407163, lon: -8.809274, tramoM });
  const consultaOsm = consultaSintetica(mapa.rejilla);
  const almacen = almacenEnMemoria();
  await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
  await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm });
  await guardaMapa(mapa, { almacen });
  return { mapa, almacen, id: id ?? mapa.id };
}

/** El código de un fichero del repo sin comentarios: los comentarios nombran lo que no se hace. */
function codigoDe(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
    .join('\n');
}

/**
 * El código sin sus textos.
 *
 * Hace falta para las afirmaciones negativas: este módulo **enumera en voz alta lo que
 * no enseña** —`LO_QUE_EL_DIARIO_NO_ENSENA` lleva dentro la palabra «reputación»—, así
 * que buscar esas palabras sobre el código con textos daría siempre positivo y la
 * afirmación no mediría nada.
 */
function codigoSinTextos(ruta) {
  return codigoDe(ruta)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/**
 * Una lámina escrita a mano con los sitios que se pidan.
 *
 * Los capítulos que no necesitan un mundo de verdad la usan para poder comprobar los
 * lugares de sus entradas; el almacén real entra donde se afirma que leer el diario no
 * mueve ni un byte, que es lo único que no se puede afirmar sobre un mundo inventado.
 */
function laminaCon(sitios, { mapa = CASA, titulo = TITULO_DE_CASA } = {}) {
  return {
    mapa,
    titulo,
    celdas: [{ clave: '0,0', documento: { settlements: sitios.map((name) => ({ name, services: [] })), parajes: [] } }],
  };
}

// ── Los capítulos: uno por mapa ────────────────────────────────────────────────

describe('Los capítulos del diario', () => {
  test('Los mapas antiguos se leen desde el diario', () => {
    // El escenario `@app` de la batería, afirmado aquí sobre el dato: un capítulo por
    // mapa, dentro del antiguo sus días y su lámina, y **ninguna acción de juego**, que
    // es la mitad que «pero no puede jugar en él desde casa» exige y que ninguna
    // aserción perseguía.
    const diario = diarioCon([
      entradaDe({ mapa: CASA, nucleo: MONFRIDA, dia: 22, paso: 40 }),
      entradaDe({ mapa: VACACIONES, suceso: 'el-farol', nucleo: CANEDO, dia: 5, paso: 9 }),
    ]);
    const tira = capitulos({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    assert.equal(tira.length, 2, 'hay más capítulos que mapas de la partida');
    assert.deepEqual(tira.map((c) => c.mapa), [CASA, VACACIONES]);

    const lamina = laminaCon([CANEDO], { mapa: VACACIONES, titulo: TITULO_DE_VACACIONES });
    const antiguo = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: VACACIONES, lamina });
    assert.equal(antiguo.lamina, lamina, 'el capítulo antiguo no trae su lámina');
    assert.equal(antiguo.dias.length, 1, 'el capítulo antiguo no trae sus días');
    assert.deepEqual(antiguo.dias[0].oido.map((v) => v.suceso), ['el-farol']);
    assert.deepEqual(antiguo.acciones, [], 'el capítulo de un mapa antiguo trae acciones de juego');
  });

  test('Una partida con dos mapas tiene exactamente dos capítulos y ninguno más', () => {
    const diario = diarioCon([entradaDe({ mapa: CASA, dia: 1, paso: 1 })]);
    const tira = capitulos({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    assert.equal(tira.length, DOS_MAPAS.length);
    assert.deepEqual([...new Set(tira.map((c) => c.mapa))].sort(), [CASA, VACACIONES].sort());
  });

  test('Cada capítulo declara su mapa, el título de su mundo y cuántos días contiene', () => {
    const diario = diarioCon([
      entradaDe({ mapa: CASA, nucleo: MONFRIDA, dia: 22, paso: 40 }),
      entradaDe({ mapa: CASA, nucleo: VILANOVA, dia: 22, paso: 41 }),
      entradaDe({ mapa: CASA, suceso: 'el-farol', nucleo: MONFRIDA, dia: 29, paso: 70 }),
    ]);
    const [deCasa, deVacaciones] = capitulos({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    assert.equal(deCasa.mapa, CASA);
    assert.equal(deCasa.titulo, TITULO_DE_CASA, 'el capítulo no se llama como el mundo en su índice');
    assert.equal(deCasa.cuantosDias, 2, 'los días son días de diario distintos, no entradas');
    assert.equal(deVacaciones.cuantosDias, 0);
  });

  test('El capítulo que viene abierto es el del mapa activo, sin que nadie lo elija', () => {
    const diario = diarioCon([entradaDe({ mapa: VACACIONES, nucleo: CANEDO, dia: 5, paso: 9 })]);
    const abierto = abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    assert.equal(abierto.abierto, CASA);
    assert.equal(abierto.capitulos[0].mapa, CASA);
    assert.equal(abierto.capitulos[0].activo, true);

    // Y con el otro mapa activo, el otro: no hay memoria de qué capítulo se abrió antes.
    const desdeFuera = abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: VACACIONES });
    assert.equal(desdeFuera.abierto, VACACIONES);
    assert.equal(desdeFuera.capitulos[0].activo, true);
  });

  test('El capítulo del mapa activo va primero y los demás por un criterio declarado y estable', () => {
    const tres = [
      { id: 'zamora', titulo: 'A Chaira Seca' },
      { id: CASA, titulo: TITULO_DE_CASA },
      { id: 'aveiro', titulo: 'O Areal Longo' },
    ];
    const diario = estadoDeDiario();
    const tira = capitulos({ diario, mapas: tres, mapaActivo: CASA });
    assert.deepEqual(tira.map((c) => c.mapa), [CASA, 'aveiro', 'zamora']);
    assert.equal(ORDEN_DE_CAPITULOS, 'el-del-mapa-activo-primero-y-los-demas-por-identificador');
    assert.equal(abreElDiario({ diario, mapas: tres, mapaActivo: CASA }).orden, ORDEN_DE_CAPITULOS);

    // Y no es el orden en que se abrieron sus documentos: la lista al revés da lo mismo.
    const alReves = capitulos({ diario, mapas: tres.slice().reverse(), mapaActivo: CASA });
    assert.deepEqual(alReves.map((c) => c.mapa), tira.map((c) => c.mapa));
  });

  test('El subtítulo de un capítulo sale de un vocabulario cerrado de dos valores y nunca de una fecha', () => {
    const diario = estadoDeDiario();
    const tira = capitulos({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    assert.deepEqual(tira.map((c) => c.subtitulo), [SUBTITULOS.DONDE_VIVES, SUBTITULOS.DONDE_ESTUVISTE]);
    assert.deepEqual(IDS_DE_SUBTITULO, [SUBTITULOS.DONDE_VIVES, SUBTITULOS.DONDE_ESTUVISTE]);
    for (const capitulo of tira) {
      assert.ok(IDS_DE_SUBTITULO.includes(capitulo.subtitulo), `el subtítulo "${capitulo.subtitulo}" no está en el vocabulario cerrado`);
    }

    // Ni una fecha del calendario real por ninguna parte: el estado no guarda ninguna
    // marca del reloj, así que no hay de dónde sacarla sin inventarla.
    const compuesto = TEXTOS.subtitulo(6, SUBTITULOS.DONDE_ESTUVISTE);
    assert.equal(compuesto, '6 días · donde estuviste');
    assert.equal(TEXTOS.subtitulo(1, SUBTITULOS.DONDE_VIVES), '1 día · donde vives');
    for (const mes of [/enero/i, /verano/i, /\d{4}/, /\d{1,2}\/\d{1,2}/]) {
      assert.equal(mes.test(compuesto), false, `el subtítulo lleva una fecha del calendario real (${mes})`);
    }
    const codigo = codigoDe(CAPITULOS);
    for (const reloj of [/Date\.now/, /new Date/, /toLocaleDateString/, /getFullYear/]) {
      assert.equal(reloj.test(codigo), false, `el capítulo lee el calendario real (${reloj})`);
    }
  });

  test('Un capítulo que no es el del mapa activo no ofrece ninguna acción de juego', () => {
    const diario = diarioCon([entradaDe({ mapa: VACACIONES, nucleo: CANEDO, dia: 5, paso: 9 })]);
    const antiguo = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: VACACIONES });
    assert.deepEqual(antiguo.acciones, []);

    // La ausencia, contra la enumeración de lo que sí habría: si alguien añade una
    // acción a un capítulo, hay que tocar esta lista, que es donde se quiere que salte.
    const serializado = JSON.stringify(antiguo);
    for (const accion of ACCIONES_DE_JUEGO_QUE_UN_CAPITULO_NO_TRAE) {
      assert.equal(serializado.includes(accion), false, `el capítulo antiguo trae la acción "${accion}"`);
    }
    assert.deepEqual([...ACCIONES_DE_JUEGO_QUE_UN_CAPITULO_NO_TRAE].sort(), ['aceptar-aventura', 'cambiar-mapa-activo', 'empezar-salida']);

    // Y el del mapa activo tampoco: el diario es donde se lee lo vivido, no desde donde
    // se juega. Que no se pueda no depende de que ninguna pantalla pinte un botón.
    const deCasa = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA });
    assert.deepEqual(deCasa.acciones, []);
  });

  test('Un capítulo que no es el del mapa activo trae sus días, sus caras y su lámina, y nada más', () => {
    const diario = diarioCon([entradaDe({ mapa: VACACIONES, nucleo: CANEDO, dia: 5, paso: 9 })]);
    const lamina = laminaCon([CANEDO], { mapa: VACACIONES, titulo: TITULO_DE_VACACIONES });
    const antiguo = abreCapitulo({
      diario,
      mapas: DOS_MAPAS,
      mapaActivo: CASA,
      mapaId: VACACIONES,
      lamina,
      caras: [{ sitio: CANEDO, puesto: 'regencia' }],
    });
    assert.deepEqual(Object.keys(antiguo).sort(), [
      'acciones', 'activo', 'caras', 'cuantosDias', 'dias', 'historias', 'lamina', 'mapa', 'orden', 'subtitulo', 'titulo', 'vistas',
    ]);
    assert.equal(antiguo.lamina, lamina);
    assert.deepEqual(antiguo.caras.map((c) => c.sitio), [CANEDO]);
    assert.equal(antiguo.activo, false);
  });

  test('Un capítulo cuyo documento de celda no está en el almacén falla nombrando la celda', async () => {
    const { mapa, almacen } = await mapaGuardado();
    almacen.datos.delete(CLAVES.celda(mapa.id, '1,0'));
    await assert.rejects(
      () => laminaDelCapitulo({ almacen, mapaId: mapa.id, semilla: SEMILLA_A }),
      /celda 1,0/,
      'el capítulo se abre a medias en vez de fallar nombrando la celda que falta',
    );

    // Y lo dice en voz de mundo, sin nombrar el almacén ni el fichero.
    assert.equal(TEXTOS.capituloQueNoSeAbre, 'De aquel sitio no se puede abrir el cuaderno.');
    for (const filtracion of [/almac/i, /fichero/i, /documento/i, /json/i, /celda/i]) {
      assert.equal(filtracion.test(TEXTOS.capituloQueNoSeAbre), false, `el texto del capítulo que no se abre nombra la máquina (${filtracion})`);
    }
  });

  test('No existe ningún selector de mapas', () => {
    // El escenario de la batería, en la única pantalla donde un selector cabría: la tira
    // de capítulos es un tomo, no un cajón de láminas. Con un solo mapa tampoco se
    // presenta como una elección.
    const diario = estadoDeDiario();
    const abierto = abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    assert.equal(abierto.esUnSelectorDeMapas, false);
    assert.equal(abierto.esUnaEleccion, false);
    const conUnoSolo = abreElDiario({ diario, mapas: [DOS_MAPAS[0]], mapaActivo: CASA });
    assert.equal(conUnoSolo.capitulos.length, 1);
    assert.equal(conUnoSolo.esUnaEleccion, false);

    // Y no hay por dónde: ninguna de estas consultas devuelve nada que cambie el mapa
    // activo, y el módulo no exporta ninguna operación que lo intente.
    for (const gesto of ['cambiaMapaActivo', 'eligeMapa', 'seleccionaMapa', 'activaMapa']) {
      assert.equal(Object.prototype.hasOwnProperty.call(moduloDeCapitulos, gesto), false, `el módulo expone "${gesto}"`);
    }
  });

  test('Un identificador de mapa que la partida no tiene falla nombrándolo', () => {
    const diario = estadoDeDiario();
    assert.throws(
      () => capituloDe({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: 'un-mapa-que-no-existe' }),
      /un-mapa-que-no-existe/,
    );
    // Y un mapa activo que no está en la lista tampoco pasa en silencio.
    assert.throws(() => capitulos({ diario, mapas: DOS_MAPAS, mapaActivo: 'otro' }), /otro/);
    // Ni una lista de mapas vacía: una partida siempre tiene al menos el mapa donde vive.
    assert.throws(() => capitulos({ diario, mapas: [], mapaActivo: CASA }), /al menos el mapa/);
    // Ni un mapa sin el título de su mundo.
    assert.throws(() => capitulos({ diario, mapas: [{ id: CASA }], mapaActivo: CASA }), /título/);
  });

  test('Un capítulo recién creado, sin ningún día, se abre vacío y no como un error', () => {
    const diario = estadoDeDiario();
    const capitulo = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA });
    assert.deepEqual(capitulo.dias, []);
    assert.equal(capitulo.cuantosDias, 0);
    assert.equal(capitulo.titulo, TITULO_DE_CASA, 'el capítulo vacío ni siquiera enseña su título');

    // Y su línea es voz de mundo: ni «vacío», ni una invitación a hacer algo para llenarlo.
    assert.equal(TEXTOS.capituloSinDias, 'De aquellos días no quedó nada apuntado.');
    for (const aplicacion of [/vacío/i, /todavía no/i, /empieza/i, /añade/i, /error/i]) {
      assert.equal(aplicacion.test(TEXTOS.capituloSinDias), false, `el texto del capítulo sin días habla como una aplicación (${aplicacion})`);
    }
  });

  test('El capítulo de cientos de días y el de seis tienen la misma forma y ninguno lleva relleno', () => {
    const muchos = [];
    for (let dia = 1; dia <= 300; dia += 1) {
      muchos.push(entradaDe({ mapa: CASA, suceso: `suceso-${dia}`, nucleo: MONFRIDA, dia, paso: dia * 3 }));
    }
    const pocos = [];
    for (let dia = 1; dia <= 6; dia += 1) {
      pocos.push(entradaDe({ mapa: VACACIONES, suceso: `vacaciones-${dia}`, nucleo: CANEDO, dia, paso: dia }));
    }
    const diario = diarioCon([...muchos, ...pocos]);

    const deCasa = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA });
    const deFuera = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: VACACIONES });
    assert.deepEqual(Object.keys(deCasa).sort(), Object.keys(deFuera).sort(), 'las dos proyecciones no tienen la misma forma');
    assert.deepEqual(Object.keys(deCasa.dias[0]).sort(), Object.keys(deFuera.dias[0]).sort());
    assert.equal(deCasa.dias.length, 300);
    assert.equal(deFuera.dias.length, 6, 'el capítulo corto se ha rellenado para igualar al largo');
    assert.equal(deCasa.cuantosDias, 300);
    assert.equal(deFuera.cuantosDias, 6);
  });
});

// ── El diario por días ─────────────────────────────────────────────────────────

describe('El diario por días', () => {
  test('Los días de un capítulo salen del más reciente al más antiguo', () => {
    const diario = diarioCon([
      entradaDe({ suceso: 'a', nucleo: MONFRIDA, dia: 22, paso: 40 }),
      entradaDe({ suceso: 'c', nucleo: MONFRIDA, dia: 29, paso: 70 }),
      entradaDe({ suceso: 'b', nucleo: MONFRIDA, dia: 23, paso: 55 }),
    ]);
    const dias = diasDelCapitulo(diario, { mapaId: CASA });
    assert.deepEqual(dias.map((d) => d.dia), [29, 23, 22]);
    assert.equal(ORDEN_DE_DIAS, 'del-dia-mas-reciente-al-mas-antiguo');
    assert.equal(abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA }).orden, ORDEN_DE_DIAS);

    // Y el criterio es el día de diario y ningún otro: apuntadas al revés, salen igual.
    const alReves = diarioCon([
      entradaDe({ suceso: 'c', nucleo: MONFRIDA, dia: 29, paso: 70 }),
      entradaDe({ suceso: 'b', nucleo: MONFRIDA, dia: 23, paso: 55 }),
      entradaDe({ suceso: 'a', nucleo: MONFRIDA, dia: 22, paso: 40 }),
    ]);
    assert.deepEqual(diasDelCapitulo(alReves, { mapaId: CASA }).map((d) => d.dia), [29, 23, 22]);
  });

  test('Lo propio y lo oído llegan separados y declarados, sin mezclarse en una sola lista', () => {
    const diario = diarioCon([
      entradaPropia({ dia: 23, paso: 50 }),
      entradaDe({ nucleo: MONFRIDA, dia: 23, paso: 55 }),
    ]);
    const [hoja] = diasDelCapitulo(diario, { mapaId: CASA });
    assert.deepEqual(Object.keys(hoja).sort(), ['dia', 'oido', 'propio']);
    assert.deepEqual(hoja.propio.map((v) => v.clase), [CLASES_DE_ENTRADA.PROPIO]);
    assert.deepEqual(hoja.oido.map((v) => v.clase), [CLASES_DE_ENTRADA.OIDO]);
    assert.equal(hoja.propio.length + hoja.oido.length, 2, 'una de las dos clases se ha perdido por el camino');
  });

  test('Una entrada de lo oído trae el sitio donde se oyó, el día y el texto que la cuenta', () => {
    const textos = estadoDeTextos();
    guardaTexto(textos, { clave: 'texto-campanas', texto: 'Dicen que sonaron tres veces.', origen: 'llm' });
    const entrada = entradaDe({ nucleo: MONFRIDA, dia: 22, paso: 40, texto: 'texto-campanas' });
    const diario = diarioCon([entrada]);

    const [hoja] = diasDelCapitulo(diario, { mapaId: CASA });
    const [oida] = hoja.oido;
    assert.equal(oida.lugar, MONFRIDA);
    assert.equal(oida.dia, 22);
    assert.equal(oida.texto, 'texto-campanas');
    assert.equal(textoDe(textos, oida).texto, 'Dicen que sonaron tres veces.');
  });

  test('Una entrada cuyo texto del narrador no existe se lee igual, con el de su plantilla', () => {
    const diario = diarioCon([entradaDe({ nucleo: MONFRIDA, dia: 22, paso: 40, texto: null, plantilla: 'entrega-sospechosa' })]);
    const [hoja] = diasDelCapitulo(diario, { mapaId: CASA });
    const [oida] = hoja.oido;
    assert.equal(oida.texto, null);
    assert.equal(oida.plantilla, 'entrega-sospechosa', 'sin texto y sin plantilla la entrada no se puede leer');
    assert.equal(textoDe(estadoDeTextos(), oida), null);
    // Y quien pinta cae a la plantilla, que es para lo que la entrada la lleva.
    assert.match(codigoDe(PANTALLA_DIARIO), /\?\?\s*version\.plantilla/);
  });

  test('Al principio el diario solo se lee por días', () => {
    // El escenario de la batería. La segunda manera **no está**: no desactivada, no
    // presente. Una pestaña gris con un candado enseñaría que hay algo que descubrir,
    // que es exactamente lo que la decisión protege.
    const diario = diarioCon([entradaDe({ nucleo: MONFRIDA, dia: 22, paso: 40 })]);
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.NUNCA);
    assert.equal(hayVistaPorHistorias(diario), false);

    const abierto = abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    assert.deepEqual(abierto.vistas, [VISTAS.DIAS]);
    assert.equal(abierto.vista, VISTAS.DIAS);
    assert.equal(abierto.vistas.includes(VISTAS.HISTORIAS), false, 'la vista por historias se ofrece antes de triangular');

    const capitulo = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA });
    assert.deepEqual(capitulo.vistas, [VISTAS.DIAS]);
    assert.equal(capitulo.historias, null, 'las historias llegan hechas antes de haber triangulado');

    // Y no llega desactivada: no hay ninguna marca de «disponible más adelante».
    const serializado = JSON.stringify({ abierto, capitulo });
    for (const candado of [/bloquead/i, /desactivad/i, /candado/i, /disponible/i, /proximamente/i, /pendiente/i]) {
      assert.equal(candado.test(serializado), false, `la vista por historias se ofrece apagada (${candado})`);
    }
  });

  test('Una entrada que apunta a un sitio que el mundo congelado no tiene falla nombrando el sitio', () => {
    const diario = diarioCon([entradaDe({ nucleo: 'A Ponte Que Non Existe', dia: 22, paso: 40 })]);
    assert.throws(
      () => diasDelCapitulo(diario, { mapaId: CASA, sitios: [MONFRIDA, VILANOVA] }),
      /A Ponte Que Non Existe/,
      'se pinta una entrada sin lugar en vez de fallar nombrando el sitio',
    );
    // Con el sitio en el mundo, se lee sin ruido.
    assert.equal(diasDelCapitulo(diario, { mapaId: CASA, sitios: ['A Ponte Que Non Existe'] }).length, 1);
    // Y sin lámina delante se leen los días igual: la comprobación es de quien la trae.
    assert.equal(diasDelCapitulo(diario, { mapaId: CASA }).length, 1);
  });
});

// ── El diario por historias, que se gana ───────────────────────────────────────

describe('El diario por historias', () => {
  test('A partir de ahí se abre la vista por historias', () => {
    // El escenario de la batería: la vista se gana **al cerrar la escena**, no al
    // detectarla. Triangular es haber visto las dos versiones juntas, no que el código
    // lo haya notado.
    const primera = entradaDe({ nucleo: MONFRIDA, dia: 22, paso: 40, veces: 3 });
    const segunda = entradaDe({ nucleo: VILANOVA, dia: 23, paso: 55, veces: 1, nivel: 0 });
    const diario = diarioCon([primera, segunda]);
    anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: CASA, nuevas: [segunda] }));

    // Detectada y sin enseñar, la vista sigue sin estar: en `pendiente` no se abre.
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.PENDIENTE);
    assert.deepEqual(abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA }).vistas, [VISTAS.DIAS]);

    componeLaEscena(diario, { dia: 23 });
    cierraLaEscena(diario);
    assert.equal(estadoDelMarcador(diario), ESTADOS_DEL_MARCADOR.HECHO);

    const abierto = abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    assert.deepEqual(abierto.vistas, [VISTAS.DIAS, VISTAS.HISTORIAS]);
    assert.deepEqual(IDS_DE_VISTA, [VISTAS.DIAS, VISTAS.HISTORIAS]);

    // Y las versiones de un mismo suceso aparecen agrupadas.
    const capitulo = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA });
    assert.equal(capitulo.historias.length, 1);
    assert.equal(capitulo.historias[0].suceso, SUCESO);
    assert.deepEqual(capitulo.historias[0].versiones.map((v) => v.lugar), [MONFRIDA, VILANOVA]);
  });

  test('Las versiones se agrupan por la identidad de su suceso, sin comparar ningún texto', () => {
    const { diario } = diarioTriangulado();
    // Dos entradas con textos distintos y el mismo suceso van juntas; una tercera con un
    // texto parecido y otro suceso, aparte.
    apunta(diario, entradaDe({ suceso: 'las-campanas-de-otra-ermita', nucleo: CANEDO, dia: 25, paso: 60 }));
    const historias = historiasDelCapitulo(diario, { mapaId: CASA });
    const porSuceso = new Map(historias.map((h) => [h.suceso, h]));
    assert.equal(porSuceso.get(SUCESO).versiones.length, 2);
    assert.equal(porSuceso.get('las-campanas-de-otra-ermita').versiones.length, 1);

    // Y el módulo no compara prosa por ninguna parte: agrupar es una consulta sobre datos.
    const codigo = codigoDe(CAPITULOS);
    for (const comparacion of [/\.texto\s*===/, /localeCompare\s*\(\s*\w+\.texto/, /similitud/i, /parecid/i]) {
      assert.equal(comparacion.test(codigo), false, `las historias se agrupan comparando textos (${comparacion})`);
    }
  });

  test('Las versiones se ordenan por cuándo se oyeron', () => {
    // El escenario de la batería, con sus tres días: 22, 23 y 29, y no en orden de
    // fidelidad. De este escenario SPEC-016 sostenía la mitad de dato; aquí vive la
    // otra, que es la vista por historias.
    const enElDia = (dia, nucleo, nivel, veces) => entradaDe({ nucleo, dia, paso: dia * 2, nivel, veces });
    // Apuntadas a propósito en desorden y con el nivel más fiel en medio: si el orden
    // saliera de la fidelidad, saldría 23, 22, 29.
    const diario = diarioCon([
      enElDia(29, CANEDO, 3, 27),
      enElDia(22, MONFRIDA, 1, 3),
      enElDia(23, VILANOVA, 0, 1),
    ]);
    const [historia] = historiasDelCapitulo(diario, { mapaId: CASA });
    assert.deepEqual(historia.versiones.map((v) => v.dia), [22, 23, 29]);
    assert.equal(historia.orden, ORDEN_DE_VERSIONES);
    assert.equal(ORDEN_DE_VERSIONES, 'por-cuando-se-oyeron');
    assert.deepEqual(versionesDeHistoria(diario, { mapaId: CASA, suceso: SUCESO }).map((v) => v.dia), [22, 23, 29]);
  });

  test('En la vista por historias no existe ningún orden por fidelidad, por nivel ni por fuente', () => {
    const { diario } = diarioTriangulado();
    const historias = historiasDelCapitulo(diario, { mapaId: CASA });
    // No hay ninguna palanca de orden: la consulta no acepta un criterio y las historias
    // solo declaran el único que existe.
    assert.equal(historiasDelCapitulo(diario, { mapaId: CASA, orden: 'por-fidelidad' })[0].orden, ORDEN_DE_VERSIONES);
    for (const orden of [ORDEN_DE_CAPITULOS, ORDEN_DE_DIAS, ORDEN_DE_VERSIONES, ORDEN_DE_HISTORIAS]) {
      for (const insinuacion of [/fidelidad/, /nivel/, /fiable/, /fuente/, /veraz/]) {
        assert.equal(insinuacion.test(orden), false, `el orden declarado "${orden}" insinúa fidelidad (${insinuacion})`);
      }
    }
    assert.equal(JSON.stringify(historias).includes('nivel'), false);
  });

  test('Ninguna versión de la vista por historias lleva etiqueta, porcentaje ni marca de cuál es la buena', () => {
    const { diario } = diarioTriangulado();
    const [historia] = historiasDelCapitulo(diario, { mapaId: CASA });
    for (const version of historia.versiones) {
      assert.deepEqual(Object.keys(version).sort(), [
        'clase', 'dia', 'fuente', 'hechos', 'id', 'lugar', 'mapa', 'paso', 'plantilla', 'signo', 'suceso', 'texto',
      ]);
    }
    // Y las dos son la misma forma: ni una clave de más en una que en la otra.
    assert.deepEqual(Object.keys(historia.versiones[0]).sort(), Object.keys(historia.versiones[1]).sort());
  });

  test('Dos versiones oídas el mismo día desempatan por el paso del mundo', () => {
    const temprano = entradaDe({ nucleo: MONFRIDA, dia: 23, paso: 40 });
    const tarde = entradaDe({ nucleo: VILANOVA, dia: 23, paso: 55 });
    const enUnOrden = diarioCon([tarde, temprano]);
    const enElOtro = diarioCon([temprano, tarde]);
    const versionesDe = (diario) => historiasDelCapitulo(diario, { mapaId: CASA })[0].versiones.map((v) => [v.dia, v.paso, v.lugar]);
    assert.deepEqual(versionesDe(enUnOrden), [[23, 40, MONFRIDA], [23, 55, VILANOVA]]);
    // Y el orden de inserción no lo mueve: si lo moviera, «estable» sería otra palabra
    // para «el orden en que se apuntaron».
    assert.deepEqual(versionesDe(enElOtro), versionesDe(enUnOrden));

    // Empatados también el paso, desempata un criterio estable y no el azar: las mismas
    // dos entradas metidas al revés siguen saliendo igual.
    const a = entradaDe({ nucleo: MONFRIDA, dia: 23, paso: 40 });
    const b = entradaDe({ nucleo: VILANOVA, dia: 23, paso: 40 });
    assert.deepEqual(versionesDe(diarioCon([a, b])), versionesDe(diarioCon([b, a])));
  });

  test('La lista de historias se ordena por la versión más reciente de cada suceso y no por inserción', () => {
    const viejo = entradaDe({ suceso: 'el-farol', nucleo: MONFRIDA, dia: 10, paso: 20 });
    const reciente = entradaDe({ suceso: SUCESO, nucleo: VILANOVA, dia: 29, paso: 70 });
    const primeraDelReciente = entradaDe({ suceso: SUCESO, nucleo: MONFRIDA, dia: 5, paso: 8 });
    const orden = (diario) => historiasDelCapitulo(diario, { mapaId: CASA }).map((h) => h.suceso);
    assert.deepEqual(orden(diarioCon([viejo, primeraDelReciente, reciente])), [SUCESO, 'el-farol']);
    assert.deepEqual(orden(diarioCon([reciente, viejo, primeraDelReciente])), [SUCESO, 'el-farol']);
    assert.equal(ORDEN_DE_HISTORIAS, 'por-la-version-mas-reciente-de-cada-suceso');

    // Y no por número de versiones: el suceso con dos versiones no adelanta al que tiene
    // una si la de este es más reciente. Premiar triangular sería un marcador.
    const conMuchas = diarioCon([
      entradaDe({ suceso: 'el-farol', nucleo: MONFRIDA, dia: 1, paso: 1 }),
      entradaDe({ suceso: 'el-farol', nucleo: VILANOVA, dia: 2, paso: 2 }),
      entradaDe({ suceso: 'la-fonte', nucleo: CANEDO, dia: 9, paso: 9 }),
    ]);
    assert.deepEqual(orden(conMuchas), ['la-fonte', 'el-farol']);
  });

  test('Un suceso con una sola versión aparece igual en la vista por historias', () => {
    const { diario } = diarioTriangulado();
    apunta(diario, entradaDe({ suceso: 'el-farol', nucleo: CANEDO, dia: 24, paso: 60 }));
    const historias = historiasDelCapitulo(diario, { mapaId: CASA });
    const solo = historias.find((h) => h.suceso === 'el-farol');
    assert.ok(solo, 'el suceso con una sola versión se esconde: la vista se ha vuelto un marcador de progreso');
    assert.equal(solo.versiones.length, 1);
    assert.deepEqual(Object.keys(solo).sort(), Object.keys(historias.find((h) => h.suceso === SUCESO)).sort());
  });

  test('Lo que se cuenta de la propia jugadora aparece con el mismo formato y sin sección aparte', () => {
    const { diario } = diarioTriangulado();
    apunta(diario, entradaPropia({ suceso: 'lo-tuyo', dia: 24, paso: 60 }));
    const historias = historiasDelCapitulo(diario, { mapaId: CASA });
    const suyo = historias.find((h) => h.suceso === 'lo-tuyo');
    assert.ok(suyo, 'lo de la jugadora no aparece en la vista por historias');
    assert.deepEqual(Object.keys(suyo).sort(), Object.keys(historias[0]).sort());
    // Y la lista es una sola: ninguna sección aparte donde meterlo.
    assert.equal(Array.isArray(historias), true);
    assert.equal(JSON.stringify(historias).includes('"deTi"'), false);
  });

  test('La vista por historias y la de días conviven y ninguna sustituye a la otra', () => {
    const { diario } = diarioTriangulado();
    const capitulo = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA });
    assert.deepEqual(capitulo.vistas, [VISTAS.DIAS, VISTAS.HISTORIAS]);
    assert.ok(capitulo.dias.length > 0, 'abrir la vista por historias ha vaciado la de días');
    assert.ok(capitulo.historias.length > 0);
    assert.equal(TEXTOS.verPorHistorias, 'Ver por historias');
    assert.equal(TEXTOS.verPorDias, 'Ver por días');
  });

  test('El cierre de un hilo se compone con cuántas fuentes distintas lo contaron y no lleva ninguna cifra a mano', () => {
    const { diario } = diarioTriangulado();
    const [historia] = historiasDelCapitulo(diario, { mapaId: CASA });
    assert.deepEqual(historia.cierre, { fuentes: 2, sitios: 2, versiones: 2 });

    // Una tercera versión de otra fuente sube el número sin tocar nada más: el dato se
    // compone en tiempo de ejecución.
    apunta(diario, entradaDe({ nucleo: CANEDO, dia: 25, paso: 60 }));
    assert.equal(historiasDelCapitulo(diario, { mapaId: CASA })[0].cierre.fuentes, 3);
    assert.deepEqual(cierreDelHilo([]), { fuentes: 0, sitios: 0, versiones: 0 });

    // Y la frase de la maqueta no está copiada en ningún sitio: depende de un número que
    // solo existe en la maqueta, y `lenguaje.md` lo prohíbe.
    for (const ruta of [CAPITULOS, PANTALLA_DIARIO]) {
      const codigo = codigoDe(ruta);
      for (const cifra of [/Tres sitios/, /tres campanas/i, /\btres\b/i, /\bdos\b\s+versiones/i]) {
        assert.equal(cifra.test(codigo), false, `${ruta} lleva una cifra de la maqueta escrita a mano (${cifra})`);
      }
    }
  });

  test('Una identidad de suceso que el diario no tiene falla nombrándola', () => {
    const { diario } = diarioTriangulado();
    assert.throws(
      () => versionesDeHistoria(diario, { mapaId: CASA, suceso: 'un-suceso-que-nadie-contó' }),
      /un-suceso-que-nadie-contó/,
    );
    assert.throws(() => versionesDeHistoria(diario, { mapaId: CASA, suceso: null }), /identidad de su suceso/);
  });

  test('La vista por historias de un capítulo que no es el activo enseña las de ese mapa y ninguna de otro', () => {
    const { diario } = diarioTriangulado();
    apunta(diario, entradaDe({ mapa: VACACIONES, suceso: 'el-farol', nucleo: CANEDO, dia: 5, paso: 9 }));
    const antiguo = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: VACACIONES });
    assert.deepEqual(antiguo.historias.map((h) => h.suceso), ['el-farol']);
    for (const historia of antiguo.historias) {
      for (const version of historia.versiones) assert.equal(version.mapa, VACACIONES);
    }
    // Y el del mapa activo, las suyas.
    const deCasa = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA });
    assert.deepEqual(deCasa.historias.map((h) => h.suceso), [SUCESO]);
  });
});

// ── Nada de esto es un panel del mundo ─────────────────────────────────────────

describe('El diario no es un panel del mundo', () => {
  test('El nivel de deformación no sale nunca a pantalla', () => {
    // El escenario de la batería, afirmado aquí sobre **las tres vistas** —por días, por
    // historias y la escena—, que es donde de verdad se podría escapar. El diario tiene
    // versiones de niveles 0, 1 y 3.
    const nivel3 = entradaDe({ nucleo: MONFRIDA, dia: 22, paso: 40, nivel: 3, veces: 27 });
    const nivel1 = entradaDe({ nucleo: VILANOVA, dia: 23, paso: 55, nivel: 1, veces: 3 });
    const nivel0 = entradaDe({ nucleo: CANEDO, dia: 29, paso: 70, nivel: 0, veces: 1 });
    const diario = diarioCon([nivel3, nivel1, nivel0]);
    anotaLaCoincidencia(diario, coincidencia(diario, { mapaId: CASA, nuevas: [nivel1] }));
    const escena = componeLaEscena(diario, { dia: 29 });
    cierraLaEscena(diario);

    const porDias = abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA });
    const porHistorias = historiasDelCapitulo(diario, { mapaId: CASA });
    const abierto = abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });

    for (const [donde, vista] of [['por días', porDias], ['por historias', porHistorias], ['la tira', abierto], ['la escena', escena]]) {
      const serializado = JSON.stringify(vista);
      for (const filtracion of [/"nivel"/, /fiabilidad/i, /deformaci/i, /porcentaje/i, /"veraz"/, /"laBuena"/, /"fiel"/]) {
        assert.equal(filtracion.test(serializado), false, `la vista ${donde} lleva el nivel o una etiqueta de fiabilidad (${filtracion})`);
      }
    }
    // Y el dato guardado sí lo lleva: si no, esta prueba no mediría nada.
    assert.deepEqual(diario.entradas.map((e) => e.nivel).sort(), [0, 1, 3]);

    // Ni por la puerta de atrás de un identificador de prueba: ningún `testID` de las dos
    // pantallas lleva el nivel ni nada derivado de él.
    for (const ruta of [PANTALLA_DIARIO, PANTALLA_TRIANGULACION]) {
      const codigo = codigoDe(ruta);
      for (const filtracion of [/nivel/i, /fiabilidad/i, /deformaci/i, /\.signo/]) {
        assert.equal(filtracion.test(codigo), false, `${ruta} pinta algo derivado del nivel (${filtracion})`);
      }
    }
  });

  test('Ninguna de las tres vistas trae un dato del mundo que la jugadora no haya oído', () => {
    const { diario } = diarioTriangulado();
    const vistas = JSON.stringify({
      abierto: abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA }),
      capitulo: abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA }),
      historias: historiasDelCapitulo(diario, { mapaId: CASA }),
    });
    // «Canedo» existe en el mundo y la jugadora no ha oído nada de allí: no aparece.
    assert.equal(vistas.includes(CANEDO), false, 'aparece un núcleo del que la jugadora no ha oído nada');
    assert.equal(vistas.includes(MONFRIDA), true, 'no aparece el núcleo del que sí ha oído: la prueba no mide nada');
  });

  test('Las únicas cifras del diario son cuentas de cuánto hay dentro', () => {
    const { diario } = diarioTriangulado();
    const vistas = JSON.stringify({
      abierto: abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA }),
      capitulo: abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA }),
      historias: historiasDelCapitulo(diario, { mapaId: CASA }),
    });
    for (const cifra of ['distancia', 'metros', 'kilometros', 'tiempo', 'minutos', 'ritmo', 'progreso', 'porcentaje', 'reputacion', 'escalones']) {
      assert.equal(vistas.includes(cifra), false, `el diario enseña una cifra de "${cifra}"`);
    }
    // Y las que hay son cuentas de lo que hay dentro: los días de un capítulo y las
    // fuentes de una historia.
    assert.equal(abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA }).capitulos[0].cuantosDias, 2);
    assert.equal(historiasDelCapitulo(diario, { mapaId: CASA })[0].cierre.fuentes, 2);

    // La lista de lo que el diario no enseña está declarada entera, que es contra lo que
    // una ausencia se puede poner roja.
    for (const prohibido of ['nivel', 'porcentaje', 'etiqueta-de-fiabilidad', 'cual-es-la-buena', 'orden-por-fidelidad', 'barra-de-reputacion', 'escalones', 'distancia', 'tiempo', 'ritmo', 'pasos', 'progreso']) {
      assert.ok(LO_QUE_EL_DIARIO_NO_ENSENA.includes(prohibido), `"${prohibido}" no está declarado como lo que el diario no enseña`);
    }
  });

  test('En el diario entero no hay ninguna barra de reputación ni ninguna lista de escalones', () => {
    const { diario } = diarioTriangulado();
    const codigo = [CAPITULOS, PANTALLA_DIARIO, PANTALLA_TRIANGULACION].map(codigoSinTextos).join('\n');
    for (const marcador of [/reputaci/i, /escalon/i, /barraDe/i, /medalla/i, /logro/i, /desbloque/i]) {
      assert.equal(marcador.test(codigo), false, `el diario dibuja un marcador de progreso (${marcador})`);
    }
    assert.equal(JSON.stringify(abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA })).includes('rango'), false);
  });
});

// ── Determinismo y persistencia ────────────────────────────────────────────────

describe('El diario que se consulta es determinista', () => {
  test('Proyectar el diario dos veces desde el mismo estado da lo mismo', () => {
    const { diario } = diarioTriangulado();
    const proyecta = () => JSON.stringify({
      abierto: abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA }),
      capitulo: abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA }),
      historias: historiasDelCapitulo(diario, { mapaId: CASA }),
      dias: diasDelCapitulo(diario, { mapaId: CASA }),
    });
    assert.equal(proyecta(), proyecta());
  });

  test('Pedir los capítulos, los días y las historias no escribe nada en el estado', () => {
    const { diario } = diarioTriangulado();
    const antes = JSON.stringify(congelaDiario(diario));
    capitulos({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    abreElDiario({ diario, mapas: DOS_MAPAS, mapaActivo: CASA });
    abreCapitulo({ diario, mapas: DOS_MAPAS, mapaActivo: CASA, mapaId: CASA });
    diasDelCapitulo(diario, { mapaId: CASA });
    historiasDelCapitulo(diario, { mapaId: CASA });
    versionesDeHistoria(diario, { mapaId: CASA, suceso: SUCESO });
    assert.equal(JSON.stringify(congelaDiario(diario)), antes, 'leer el diario ha escrito en el estado');
  });

  test('Un marcador encendido vuelve encendido de la serialización y la vista por historias sigue disponible', () => {
    const { diario } = diarioTriangulado();
    const devuelta = levantaDiario(JSON.parse(JSON.stringify(congelaDiario(diario))));
    assert.equal(estadoDelMarcador(devuelta), ESTADOS_DEL_MARCADOR.HECHO);
    assert.equal(hayVistaPorHistorias(devuelta), true);
    assert.deepEqual(abreElDiario({ diario: devuelta, mapas: DOS_MAPAS, mapaActivo: CASA }).vistas, [VISTAS.DIAS, VISTAS.HISTORIAS]);
    assert.deepEqual(
      historiasDelCapitulo(devuelta, { mapaId: CASA }).map((h) => h.versiones.map((v) => v.dia)),
      historiasDelCapitulo(diario, { mapaId: CASA }).map((h) => h.versiones.map((v) => v.dia)),
    );
  });

  test('El código de esta fila no lee el reloj del sistema ni sortea nada', () => {
    for (const ruta of [CAPITULOS, TRIANGULACION, PANTALLA_DIARIO, PANTALLA_TRIANGULACION]) {
      const codigo = codigoDe(ruta);
      for (const impureza of [/Math\.random/, /Date\.now/, /new Date\b/, /performance\.now/, /Date\.parse/, /hrtime/]) {
        assert.equal(impureza.test(codigo), false, `${ruta} lee el reloj o sortea (${impureza})`);
      }
    }
  });

  test('Leer el diario no mueve ni un byte de los documentos congelados del mapa', async () => {
    const { mapa, almacen } = await mapaGuardado();
    const antes = new Map(almacen.datos);
    almacen.registro.length = 0;

    const lamina = await laminaDelCapitulo({ almacen, mapaId: mapa.id, semilla: SEMILLA_A });
    const sitios = sitiosDeLaLamina(lamina);
    assert.ok(sitios.size > 0, 'la lámina no trae ni un sitio: la prueba no mediría nada');

    const mapas = [{ id: mapa.id, titulo: lamina.titulo ?? TITULO_DE_CASA }];
    const unSitio = [...sitios][0];
    const diario = diarioCon([entradaDe({ mapa: mapa.id, nucleo: unSitio, dia: 3, paso: 7 })]);
    const capitulo = abreCapitulo({ diario, mapas, mapaActivo: mapa.id, mapaId: mapa.id, lamina });
    assert.equal(capitulo.dias.length, 1);
    assert.equal(capitulo.lamina, lamina);

    assert.deepEqual(almacen.operaciones('escribe'), [], 'leer el capítulo ha escrito en el almacén');
    assert.deepEqual([...almacen.datos.keys()].sort(), [...antes.keys()].sort());
    for (const [clave, valor] of antes) {
      assert.equal(almacen.datos.get(clave), valor, `el documento ${clave} ha cambiado al leer el diario`);
    }

    // Y la lámina es la del mapa que se pide, con sus celdas y su mundo congelado dentro.
    assert.equal(lamina.mapa, mapa.id);
    assert.equal(lamina.celdas.length, 2);

    // Un mapa que el almacén no tiene falla nombrándolo, en vez de enseñar un capítulo
    // a medias.
    await assert.rejects(() => laminaDelCapitulo({ almacen, mapaId: 'mapa-fantasma', semilla: SEMILLA_A }), /mapa-fantasma/);
    await assert.rejects(() => cargaMapa({ almacen, id: 'mapa-fantasma', semilla: SEMILLA_A }), /mapa-fantasma/);
  });
});
