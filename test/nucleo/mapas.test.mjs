// SPEC-041 · Una partida, muchos mapas, y ningún selector: el mapa activo lo decide
// dónde estás, el jugador viaja entero, el rango no viaja y el mundo de casa no avanza
// en tu ausencia.
//
// Casi todo lo de esta fila es afirmable aquí porque casi todo es dato: la resolución
// del mapa activo es una función pura de la posición y de los mapas, el alcance es un
// número de tramos, el contador es del mapa y el rango es por núcleo. Lo único que
// necesita dispositivo —que la pantalla del ofrecimiento se monte y que abrir una celda
// en marcha no enseñe nada— vive en `test/app/mapas.yaml`.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás van
// declarados como huecos de la batería en test/spec-test-map.json; la propia spec
// enumera seis, y cinco de ellos se cubren aquí.
//
// Nada de aquí toca la red ni el reloj: los datos de OSM salen de los extractos
// congelados, el mundo avanza los pasos que la prueba pide y el azar sale de la semilla.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as MAPAS from '../../packages/nucleo/partida/mapas.js';
import {
  ACCIONES,
  ALCANCE_EN_TRAMOS,
  GUION,
  MOMENTO,
  PUERTAS,
  RESOLUCIONES,
  SIN_MAPA_ACTIVO,
  TESTIDS,
  alcanceM,
  componeOfrecimiento,
  distanciaAlMapa,
  extensionDeMapa,
  hayQueOfrecerMapa,
  listaDeMapas,
  resuelveMapaActivo,
  textoDelGuion,
} from '../../packages/nucleo/partida/mapas.js';
import {
  abreCelda,
  cargaCelda,
  cargaMapa,
  celdasAbiertas,
  completaCelda,
  costuras,
  creaMapa,
  guardaMapa,
  pisa,
} from '../../packages/nucleo/partida/mapa.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { creaMotorDePasos, estadoDePasos } from '../../packages/nucleo/partida/pasos.js';
import { TOPE_DE_RESERVA, kilometrosDeFondo, tamanoDeLaReserva } from '../../packages/nucleo/partida/kilometros.js';
import { estadoDeNucleos, sedimenta, versionQueLlego } from '../../packages/nucleo/partida/nucleos.js';
import { ESCALON_DE_PARTIDA, rangoEn } from '../../packages/nucleo/partida/rango.js';
import { arbolDeCalzadas } from '../../packages/nucleo/partida/rumores.js';
import { PROTAGONISTAS, SIGNOS } from '../../packages/nucleo/partida/deformacion.js';
import { estadoDeMotes, moteEn } from '../../packages/nucleo/partida/motes.js';
import { FILAS_DE_AJUSTES, GRUPOS_DE_AJUSTES } from '../../packages/nucleo/partida/ajustes.js';
import { REGISTROS } from '../../packages/nucleo/partida/guion-de-arranque.js';
import { congelaEstado, estadoInicial } from '../../packages/nucleo/partida/estado.js';
import { semillaDeCelda } from '../../packages/nucleo/core/semilla.js';
import { celdaEnPosicion, claveDeCelda, proyectorDeRejilla } from '../../packages/nucleo/world/rejilla.js';
import { SEMILLA_A, SEMILLA_B, consultaDeFixture, consultaQueFalla, coordenadaDe } from './celda-de-prueba.mjs';
import { almacenEnMemoria, recorreDocumento } from './partida-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';

/** El tramo con el que se levantan los mapas de esta suite. Celda de 4 km de lado. */
const TRAMO_M = 2000;

/** Los dos sitios de la partida: el de casa y el de las vacaciones, a ochenta kilómetros. */
const CASA = 'costero';
const VACACIONES = 'barrio-tres-calles';

/** Un sitio al que no llega ninguno de los dos: cuatrocientos kilómetros al sureste. */
const LEJOS_DE_TODO = coordenadaDe('urbano-denso');

/** El módulo que esta fila entrega, para las afirmaciones que se hacen sobre su texto. */
const MODULO = 'packages/nucleo/partida/mapas.js';

/** Un mapa de la partida con las celdas que se pidan ya abiertas, sobre un extracto congelado. */
async function mapaDe(nombre, { semilla = SEMILLA_A, tramoM = TRAMO_M, celdas = [{ i: 0, j: 0 }], desplaza = null } = {}) {
  const c = coordenadaDe(nombre);
  const lat = c.lat + (desplaza?.lat ?? 0);
  const lon = c.lon + (desplaza?.lon ?? 0);
  const consulta = consultaDeFixture(nombre);
  const mapa = creaMapa({ semilla, lat, lon, tramoM });
  for (const celda of celdas) await abreCelda(mapa, celda, { consultaOsm: consulta });
  return { mapa, consulta, coordenada: { lat, lon } };
}

/** La coordenada que corresponde a un punto en metros desde el anclaje de un mapa. */
function puntoEn(mapa, x, y) {
  return proyectorDeRejilla(mapa.rejilla).toLatLon({ x, y });
}

/** Un mapa guardado en un almacén, que es como llega a la lista de mapas de la partida. */
async function guardadoEn(almacen, nombre, opciones = {}) {
  const { mapa } = await mapaDe(nombre, opciones);
  await guardaMapa(mapa, { almacen });
  return mapa;
}

describe('El mapa activo lo decide dónde estás', () => {
  test('El mapa activo lo decide dónde estás', async () => {
    const casa = (await mapaDe(CASA)).mapa;
    const vacaciones = (await mapaDe(VACACIONES)).mapa;
    const mapas = [casa, vacaciones];

    const enCasa = resuelveMapaActivo(mapas, { ...coordenadaDe(CASA), tramoM: TRAMO_M });
    assert.equal(enCasa.mapaId, casa.id, 'abriendo la app en casa no se ha abierto el mapa de casa');
    assert.equal(enCasa.estado, 'dentro');

    const deVacaciones = resuelveMapaActivo(mapas, { ...coordenadaDe(VACACIONES), tramoM: TRAMO_M });
    assert.equal(deVacaciones.mapaId, vacaciones.id, 'abriendo la app de vacaciones no se ha abierto el de vacaciones');
    assert.equal(deVacaciones.estado, 'dentro');

    // Y nadie ha elegido nada: la resolución no recibe ninguna preferencia y no
    // escribe ninguna. Los dos mapas siguen exactamente como estaban.
    assert.equal(celdasAbiertas(casa).length, 1, 'resolver el mapa activo ha abierto una celda');
    assert.equal(celdasAbiertas(vacaciones).length, 1);
  });

  test('Una posición de una celda abierta resuelve ese mapa y no deja nada pendiente', async () => {
    const { mapa } = await mapaDe(CASA);
    const donde = resuelveMapaActivo([mapa], { ...coordenadaDe(CASA), tramoM: TRAMO_M });
    assert.equal(donde.estado, 'dentro');
    assert.deepEqual(donde.celda, { i: 0, j: 0 });
    assert.equal(donde.clave, '0,0');
    assert.equal(donde.pendienteDeAbrir, false, 'la celda ya estaba abierta y se declara pendiente');
    assert.equal(donde.distanciaM, 0);
  });

  test('Una posición de la rejilla en una celda cerrada resuelve el mapa y declara la celda pendiente', async () => {
    const { mapa } = await mapaDe(CASA, { celdas: [{ i: 0, j: 0 }, { i: 1, j: 0 }] });
    // Justo dentro de la celda `1,1`, que la rejilla contiene y el mapa no ha abierto.
    // La resolución la declara y **no la abre**: abrir consulta datos y esto es una
    // función que se puede preguntar dos veces sin que pase nada.
    const p = puntoEn(mapa, mapa.rejilla.ladoM, mapa.rejilla.ladoM * 0.6);
    const donde = resuelveMapaActivo([mapa], { ...p, tramoM: TRAMO_M });
    assert.equal(donde.mapaId, mapa.id);
    assert.deepEqual(donde.celda, { i: 1, j: 1 });
    assert.equal(donde.pendienteDeAbrir, true, 'la celda sin abrir tiene que quedar declarada como pendiente');
    assert.equal(celdasAbiertas(mapa).length, 2, 'resolver ha abierto la celda pendiente');
  });

  test('A un paso del borde la posición sigue siendo del mismo mapa', async () => {
    const { mapa } = await mapaDe(CASA);
    const borde = mapa.rejilla.ladoM / 2;
    assert.equal(extensionDeMapa(mapa).maxX, borde, 'la extensión del mapa no es la de su celda abierta');

    // Un paso fuera del borde: dentro del alcance declarado, sigue siendo su mapa.
    const cerca = puntoEn(mapa, borde + 500, 0);
    const dentroDelAlcance = resuelveMapaActivo([mapa], { ...cerca, tramoM: TRAMO_M });
    assert.equal(dentroDelAlcance.estado, 'alcance', 'a quinientos metros del borde ya no es su mapa');
    assert.equal(dentroDelAlcance.mapaId, mapa.id);
    assert.equal(dentroDelAlcance.pendienteDeAbrir, true, 'la celda del borde tiene que quedar por abrir');
    assert.ok(Math.round(dentroDelAlcance.distanciaM) === 500, `la distancia al mapa medía ${dentroDelAlcance.distanciaM} m`);

    // Y a más del alcance ya no: no hay mapa activo y se ofrece levantar uno.
    const lejos = puntoEn(mapa, borde + alcanceM(mapa, TRAMO_M) + 100, 0);
    assert.equal(resuelveMapaActivo([mapa], { ...lejos, tramoM: TRAMO_M }).estado, 'ninguno');
  });

  test('El alcance del borde va en tramos del jugador y no en metros absolutos', async () => {
    const { mapa } = await mapaDe(CASA);
    assert.equal(ALCANCE_EN_TRAMOS, 1, 'el alcance declarado es de un tramo');
    assert.equal(alcanceM(mapa, 600), 600 * ALCANCE_EN_TRAMOS, 'quien anda 600 m por tramo tiene 600 m de alcance');
    assert.equal(alcanceM(mapa, 2000), 2000 * ALCANCE_EN_TRAMOS, 'quien anda 2 km por tramo tiene 2 km de alcance');

    // La misma posición, dos tramos: el mismo borde no significa lo mismo para las dos.
    const p = puntoEn(mapa, mapa.rejilla.ladoM / 2 + 1500, 0);
    assert.equal(resuelveMapaActivo([mapa], { ...p, tramoM: 2000 }).estado, 'alcance', 'con tramo de 2 km 1500 m del borde siguen siendo suyos');
    assert.equal(resuelveMapaActivo([mapa], { ...p, tramoM: 600 }).estado, 'ninguno', 'con tramo de 600 m 1500 m del borde ya no lo son');
  });

  test('La misma posición preguntada dos veces resuelve el mismo mapa y no escribe nada', async () => {
    const casa = (await mapaDe(CASA)).mapa;
    const vacaciones = (await mapaDe(VACACIONES)).mapa;
    const antes = JSON.stringify([casa, vacaciones].map((m) => celdasAbiertas(m).map((c) => c.clave)));

    const donde = { ...coordenadaDe(CASA), tramoM: TRAMO_M };
    const una = resuelveMapaActivo([casa, vacaciones], donde);
    const otra = resuelveMapaActivo([casa, vacaciones], donde);
    // Serialización completa y sin los mapas dentro, que son el mismo objeto.
    const sinMapa = ({ mapa, ...resto }) => JSON.stringify(resto);
    assert.equal(sinMapa(una), sinMapa(otra), 'dos resoluciones de la misma posición no dan lo mismo');
    assert.equal(JSON.stringify([casa, vacaciones].map((m) => celdasAbiertas(m).map((c) => c.clave))), antes, 'resolver el mapa activo ha escrito algo');
  });

  test('Dos mapas que se solapan se desempatan por el anclaje que ordena primero', async () => {
    // Dos mapas pegados: sus celdas de cuatro kilómetros se solapan, así que hay
    // posiciones que caen dentro de los dos. El desempate es el anclaje —que es el
    // identificador del mapa desde SPEC-003— y **nunca** el orden en que se levantaron.
    const uno = (await mapaDe(CASA)).mapa;
    const otro = (await mapaDe(CASA, { desplaza: { lat: 0, lon: 0.01 } })).mapa;
    assert.notEqual(uno.id, otro.id, 'los dos mapas de la prueba tienen que tener anclajes distintos');
    const primero = [uno.id, otro.id].sort()[0];

    const enMedio = puntoEn(uno, mapa1Solape(uno, otro), 0);
    for (const orden of [[uno, otro], [otro, uno]]) {
      const donde = resuelveMapaActivo(orden, { ...enMedio, tramoM: TRAMO_M });
      assert.equal(donde.estado, 'dentro', 'la posición de la prueba tiene que caer dentro de los dos mapas');
      assert.equal(donde.mapaId, primero, 'el desempate ha salido por el orden en que llegaron los mapas y no por el anclaje');
    }
  });

  test('Una posición mal formada falla nombrando lo que llegó', async () => {
    const { mapa } = await mapaDe(CASA);
    for (const mala of [{ lat: null, lon: -8.8 }, { lat: 42.4, lon: undefined }, { lat: 'norte', lon: -8.8 }, { lat: NaN, lon: -8.8 }]) {
      assert.throws(
        () => resuelveMapaActivo([mapa], { ...mala, tramoM: TRAMO_M }),
        (e) => /posición válida/.test(e.message) && /lat=/.test(e.message) && /lon=/.test(e.message),
        `una posición ${JSON.stringify(mala)} tenía que fallar diciendo qué llegó`,
      );
    }
    // Y una lista de mapas que no es una lista, por lo mismo.
    assert.throws(() => resuelveMapaActivo(null, { lat: 42.4, lon: -8.8 }), /lista de mapas/);
  });

  test('Una partida sin ningún mapa no tiene mapa activo y no es un error', () => {
    const donde = resuelveMapaActivo([], { lat: LEJOS_DE_TODO.lat, lon: LEJOS_DE_TODO.lon, tramoM: TRAMO_M });
    assert.equal(donde.estado, 'ninguno');
    assert.equal(donde.mapaId, SIN_MAPA_ACTIVO);
    assert.equal(donde.mapa, null);
    assert.equal(donde.celda, null);
    assert.equal(hayQueOfrecerMapa(donde), true, 'sin ningún mapa lo que toca es ofrecer levantar uno');
    assert.deepEqual([...RESOLUCIONES], ['dentro', 'alcance', 'ninguno'], 'las respuestas de la resolución son tres y no hay una cuarta');
  });

  test('No existe ningún selector de mapas', async () => {
    // La afirmación es de ausencia y se hace sobre la superficie pública entera: si
    // alguna vez aparece una operación que fije el mapa activo, el selector ha vuelto
    // por la puerta de atrás.
    const prohibido = /^(fija|selecciona|elige|escoge|cambia|activa|establece|pon|usa)[A-Z]/;
    for (const nombre of Object.keys(MAPAS)) {
      assert.ok(!prohibido.test(nombre), `"${nombre}" es una operación que fija el mapa activo a mano`);
      assert.ok(!/mapaActivo$/i.test(nombre) || nombre === 'resuelveMapaActivo', `"${nombre}" toca el mapa activo por fuera de la resolución`);
    }
    assert.equal(typeof MAPAS.resuelveMapaActivo, 'function', 'la resolución desde la posición es la única puerta y tiene que existir');

    // Ningún localizador de selector, de lista ni de cambio de mapa: la sección de
    // `data-testid` de la spec es exactamente esta y ni uno más.
    assert.deepEqual(Object.keys(TESTIDS).sort(), ['apertura', 'dejarlo', 'levantar', 'mapaActivo', 'momento', 'ofrecimiento']);
    for (const testid of Object.values(TESTIDS)) {
      assert.ok(!/selector|lista-de-mapas|cambiar-mapa|elegir/.test(testid), `el localizador "${testid}" es el de un selector`);
    }

    // Y el catálogo de ajustes no trae ninguna fila de mapas: una lista de mapas en
    // los ajustes sería el selector con otro nombre.
    for (const fila of FILAS_DE_AJUSTES) {
      assert.ok(!/mapas/i.test(fila.id), `la fila de ajustes "${fila.id}" habla de mapas`);
      assert.ok(!/\bmapas\b/i.test(fila.etiqueta ?? ''), `la fila de ajustes "${fila.id}" enumera mapas`);
    }
    assert.ok(GRUPOS_DE_AJUSTES.every((g) => !/mapas/i.test(g.id)), 'hay un grupo de ajustes de mapas');
  });
});

/** El punto medio, en metros desde el anclaje del primero, entre dos mapas pegados. */
function mapa1Solape(uno, otro) {
  const p = proyectorDeRejilla(uno.rejilla).toXY(otro.rejilla.anclaje.lat, otro.rejilla.anclaje.lon);
  return p.x / 2;
}

describe('Levantar un mapa lejos de todos', () => {
  test('Llegar a un sitio nuevo ofrece levantar un mapa', async () => {
    const casa = (await mapaDe(CASA)).mapa;
    const vacaciones = (await mapaDe(VACACIONES)).mapa;
    const donde = resuelveMapaActivo([casa, vacaciones], { ...LEJOS_DE_TODO, tramoM: TRAMO_M });

    assert.equal(donde.estado, 'ninguno', 'a cuatrocientos kilómetros de todos sus mapas todavía había uno activo');
    assert.equal(hayQueOfrecerMapa(donde), true);

    const ofrecimiento = componeOfrecimiento({ sitio: 'la ribera del Manzanares' });
    assert.equal(ofrecimiento.mapaActivo, SIN_MAPA_ACTIVO);
    assert.equal(ofrecimiento.testid, TESTIDS.ofrecimiento);
    assert.equal(ofrecimiento.momento, MOMENTO);
    assert.equal(ofrecimiento.sitio, 'la ribera del Manzanares', 'el sitio se dice como lugar y no como coordenada');
  });

  test('El ofrecimiento habla en voz de mundo y no nombra la red, los mapas guardados ni ninguna distancia', () => {
    const ofrecimiento = componeOfrecimiento({ sitio: 'la ribera del Manzanares' });
    const dicho = [ofrecimiento.titular, ofrecimiento.cuerpo, ...ofrecimiento.acciones.map((a) => a.texto)].join(' ');

    for (const pieza of GUION) assert.equal(pieza.registro, REGISTROS.MUNDO, `la pieza "${pieza.id}" del ofrecimiento no habla en voz de mundo`);
    for (const palabra of ['red', 'conexión', 'internet', 'wifi', 'servidor', 'descarga', 'guardado', 'km', 'kilómetro', 'metros', 'distancia', 'GPS']) {
      assert.ok(!new RegExp(`\\b${palabra}`, 'i').test(dicho), `el ofrecimiento dice "${palabra}"`);
    }
    // Y ningún número: una distancia a casa invita a intentar jugar allí desde aquí.
    assert.ok(!/\d/.test(dicho), `el ofrecimiento trae una cifra: ${dicho}`);

    // Sin cobertura tampoco se nombra la red: lo que hoy no se deja dibujar es el sitio.
    const sinRed = componeOfrecimiento({ sitio: 'la ribera del Manzanares', sinRed: true });
    assert.equal(sinRed.aviso, textoDelGuion('no-se-pudo'));
    assert.ok(!/red|conexión|internet/i.test(sinRed.aviso), 'el aviso de sin cobertura nombra la red');
    assert.equal(componeOfrecimiento({ sitio: 'x' }).aviso, null, 'con cobertura no hay nada que avisar');
  });

  test('Las acciones del ofrecimiento son dos y las tres puertas siguen, pero salir a andar no', () => {
    const ofrecimiento = componeOfrecimiento({ sitio: 'la ribera del Manzanares' });

    assert.deepEqual(ofrecimiento.acciones.map((a) => a.id), ['levantar', 'dejarlo'], 'las acciones del ofrecimiento son dos y no más');
    assert.deepEqual(ofrecimiento.acciones.map((a) => a.testid), [TESTIDS.levantar, TESTIDS.dejarlo]);
    assert.deepEqual(ACCIONES.map((a) => a.peso), ['principal', 'texto'], 'levantar es la principal y dejarlo estar va sin caja');

    assert.deepEqual([...ofrecimiento.puertas], [...PUERTAS], 'las tres puertas siguen: el diario es donde se leen los mapas donde ya no estás');
    assert.equal(ofrecimiento.seSaleAAndar, false, 'sin mapa activo no se puede salir a andar: no se juega donde no estás');

    // Rechazar no se recuerda: volver a abrir la app aquí vuelve a ofrecerlo igual.
    assert.equal(ofrecimiento.seRecuerdaElRechazo, false);
    assert.equal(JSON.stringify(componeOfrecimiento({ sitio: 'la ribera del Manzanares' })), JSON.stringify(ofrecimiento), 'el segundo ofrecimiento en el mismo sitio no es el mismo');

    // Y sin sitio no se compone: una pantalla que dijera la coordenada es lo que esto impide.
    assert.throws(() => componeOfrecimiento({}), /dicho como lugar/);
  });

  test('Un mapa levantado lejos se ancla a la coordenada redondeada y pasa a ser el activo', async () => {
    const casa = (await mapaDe(CASA)).mapa;
    const { mapa: nuevo } = await mapaDe('urbano-denso');

    assert.equal(nuevo.id, `${nuevo.rejilla.anclaje.lat.toFixed(2)},${nuevo.rejilla.anclaje.lon.toFixed(2)}`, 'el identificador del mapa nuevo no es su anclaje redondeado');
    const donde = resuelveMapaActivo([casa, nuevo], { ...LEJOS_DE_TODO, tramoM: TRAMO_M });
    assert.equal(donde.mapaId, nuevo.id, 'el mapa recién levantado no es el activo donde se levantó');
    assert.equal(donde.estado, 'dentro');
    // Y sin que nadie lo elija: lo único que ha cambiado es que ahora hay un mapa ahí.
    assert.equal(resuelveMapaActivo([casa], { ...LEJOS_DE_TODO, tramoM: TRAMO_M }).estado, 'ninguno');
  });

  test('Cada mapa de la partida declara su anclaje, su título, sus celdas, su contador y sus rangos', async () => {
    const almacen = almacenEnMemoria();
    const casa = await guardadoEn(almacen, CASA, { celdas: [{ i: 0, j: 0 }, { i: 1, j: 0 }] });
    const vacaciones = await guardadoEn(almacen, VACACIONES);

    const pasos = estadoDePasos();
    creaMotorDePasos({ semilla: SEMILLA_A, mapaId: casa.id, estado: pasos }).avanza(7);

    const lista = await listaDeMapas({ almacen, pasos, rangos: { [vacaciones.id]: { [arbolDeCalzadas(vacaciones.celdas[0].mundo).nucleos[0]]: 'forasteria' } } });
    assert.equal(lista.length, 2, 'la partida tiene dos mapas y la lista no los trae los dos');
    assert.deepEqual(lista.map((m) => m.id).slice().sort(), [casa.id, vacaciones.id].sort());

    const deCasa = lista.find((m) => m.id === casa.id);
    assert.deepEqual(deCasa.anclaje, { lat: casa.rejilla.anclaje.lat, lon: casa.rejilla.anclaje.lon });
    assert.equal(deCasa.titulo, casa.titulo);
    assert.deepEqual(deCasa.celdas.slice().sort(), ['0,0', '1,0']);
    assert.equal(deCasa.pasos, 7, 'el contador que declara el mapa no es el suyo');
    assert.equal(deCasa.enLaReserva, 0);
    assert.equal(deCasa.rangos, null, 'un mapa sin rangos declara que no tiene, en vez de inventarlos');
    assert.notEqual(lista.find((m) => m.id === vacaciones.id).rangos, null);

    // Un índice que declara una celda que el almacén no tiene se dice al leerlo.
    const soloIndice = almacenEnMemoria();
    await guardaMapa(casa, { almacen: soloIndice });
    for (const clave of [...soloIndice.datos.keys()]) if (/celda/.test(clave)) soloIndice.datos.delete(clave);
    const igual = await listaDeMapas({ almacen: soloIndice });
    assert.equal(igual.length, 1, 'el índice se lee aunque falten las celdas: la lista es del índice');
  });

  test('Sin almacén inyectado no se puede listar ningún mapa', async () => {
    await assert.rejects(() => listaDeMapas({}), /almac/i);
  });
});

describe('Las celdas vecinas, por sus dos vías', () => {
  test('Abrir una celda vecina no toca la celda propia', async () => {
    const { mapa, consulta } = await mapaDe(CASA);
    const propia = mapa.celdas[0];
    const antes = textoDeCelda(propia);

    const { registro: vecina } = await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm: consulta });
    assert.equal(textoDeCelda(propia), antes, 'abrir la vecina ha cambiado el documento de la celda propia');
    assert.equal(vecina.motivo, 'pisada');

    // Y las dos comparten la costura de calzadas en el borde.
    const costura = costuras(mapa).find((c) => c.celdas.join('|') === '0,0|1,0');
    assert.ok(costura, 'las dos celdas contiguas no han quedado cosidas en su borde');
  });

  test('Una celda es idéntica byte a byte se abra por pisarla o como acontecimiento', async () => {
    const pisada = await mapaDe(CASA, { celdas: [{ i: 0, j: 0 }] });
    const { registro: porPisarla } = await abreCelda(pisada.mapa, { i: 1, j: 0 }, { consultaOsm: pisada.consulta });

    const acontecida = await mapaDe(CASA, { celdas: [{ i: 0, j: 0 }] });
    const evento = await completaCelda(acontecida.mapa, { i: 0, j: 0 }, { consultaOsm: acontecida.consulta });
    assert.equal(evento.acontecimiento, true, 'completar la celda del anclaje no ha abierto ninguna vecina');

    // La vecina que se abre sale de la semilla: la misma partida elige la misma.
    const otraVez = await mapaDe(CASA, { celdas: [{ i: 0, j: 0 }] });
    const repetido = await completaCelda(otraVez.mapa, { i: 0, j: 0 }, { consultaOsm: otraVez.consulta });
    assert.deepEqual(repetido.celda, evento.celda, 'dos ejecuciones iguales han abierto vecinas distintas');

    // Y si es la misma celda, lo único que las distingue es el motivo registrado.
    if (claveDeCelda(evento.celda) === '1,0') {
      const sinMotivo = (r) => JSON.stringify({ ...r, motivo: null });
      assert.equal(sinMotivo(evento.registro), sinMotivo(porPisarla), 'la misma celda abierta por las dos vías no sale idéntica');
      assert.notEqual(evento.registro.motivo, porPisarla.motivo, 'el motivo registrado tiene que distinguirlas');
      assert.equal(evento.registro.motivo, 'acontecimiento');
    }
  });

  test('Dos celdas contiguas abiertas en cualquier orden dan la misma costura', async () => {
    const uno = await mapaDe(CASA, { celdas: [{ i: 0, j: 0 }, { i: 1, j: 0 }] });
    const otro = await mapaDe(CASA, { celdas: [{ i: 1, j: 0 }, { i: 0, j: 0 }] });
    assert.equal(JSON.stringify(costuras(uno.mapa)), JSON.stringify(costuras(otro.mapa)), 'la costura depende del orden en que se abrieron las celdas');
  });

  test('Una celda ya abierta se lee del almacén y no se consulta OSM', async () => {
    const { mapa, consulta } = await mapaDe(CASA);
    const consultasTrasLaPrimera = consulta.llamadas.length;
    assert.ok(consultasTrasLaPrimera > 0, 'la primera apertura no ha pedido datos');

    const c = coordenadaDe(CASA);
    const segunda = await pisa(mapa, c.lat, c.lon, { consultaOsm: consulta });
    assert.equal(segunda.generada, false, 'se ha vuelto a generar una celda ya abierta');
    assert.equal(consulta.llamadas.length, consultasTrasLaPrimera, 'volver a pisar una celda abierta ha consultado OSM');
    assert.equal(segunda.registro, mapa.celdas[0], 'no se ha devuelto la celda que ya existía');
  });

  test('La apertura de una celda sin conexión no deja media celda', async () => {
    const { mapa, consulta } = await mapaDe(CASA);
    const antes = JSON.stringify(celdasAbiertas(mapa).map((c) => c.clave));

    await assert.rejects(() => abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm: consultaQueFalla() }), /Overpass no contesta/);
    assert.equal(JSON.stringify(celdasAbiertas(mapa).map((c) => c.clave)), antes, 'ha quedado registrada una celda que no llegó a existir');
    assert.equal(costuras(mapa).length, 0, 'ha quedado la costura de una celda que no existe');

    // Y cuando los datos vuelven, la celda se abre entera y sin arrastrar nada.
    const { registro } = await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm: consulta });
    assert.ok(registro.mundo, 'la celda abierta después del fallo no trae su mundo');
    assert.equal(celdasAbiertas(mapa).length, 2);
  });

  test('Una celda abierta sigue abierta al volver a abrir la app', async () => {
    const almacen = almacenEnMemoria();
    const mapa = await guardadoEn(almacen, CASA, { celdas: [{ i: 0, j: 0 }, { i: 1, j: 0 }] });
    const antes = textoDeCelda(mapa.celdas.find((c) => c.clave === '1,0'));

    const vuelto = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    assert.deepEqual(celdasAbiertas(vuelto).map((c) => c.clave), ['0,0', '1,0'], 'al volver a abrir la app las celdas no siguen abiertas');
    const celda = await cargaCelda(vuelto, { i: 1, j: 0 }, { almacen });
    assert.equal(textoDeCelda(celda), antes, 'el documento leído del almacén no es el que se guardó');
  });

  test('Quien vive pegado al borde anda cien metros, cambia de celda y el juego sigue', async () => {
    const { mapa, consulta } = await mapaDe(CASA);
    // A cincuenta metros del borde de su celda, y cien metros después ya está en la de al lado.
    const borde = mapa.rejilla.ladoM / 2;
    const antesDeCruzar = puntoEn(mapa, borde - 50, 0);
    const despues = puntoEn(mapa, borde + 50, 0);
    assert.deepEqual(celdaEnPosicion(mapa.rejilla, antesDeCruzar.lat, antesDeCruzar.lon), { i: 0, j: 0 });
    assert.deepEqual(celdaEnPosicion(mapa.rejilla, despues.lat, despues.lon), { i: 1, j: 0 });

    const cruzada = await pisa(mapa, despues.lat, despues.lon, { consultaOsm: consulta });
    assert.equal(cruzada.generada, true, 'cruzar el borde no ha abierto la celda nueva');
    assert.ok(cruzada.registro.mundo, 'la celda nueva no trae mundo: el juego se quedaría sin sitio donde estás');
    assert.equal(resuelveMapaActivo([mapa], { ...despues, tramoM: TRAMO_M }).mapaId, mapa.id, 'cruzar el borde ha cambiado de mapa');
  });

  test('Un índice de celda mal formado falla nombrando el índice', async () => {
    const { mapa, consulta } = await mapaDe(CASA);
    for (const mala of [{ i: 1.5, j: 0 }, { i: 0 }, null, { i: '1', j: '0' }]) {
      await assert.rejects(
        () => abreCelda(mapa, mala, { consultaOsm: consulta }),
        (e) => /índice de celda mal formado/.test(e.message),
        `abrir la celda ${JSON.stringify(mala)} tenía que fallar nombrando el índice`,
      );
    }
  });
});

describe('El jugador viaja entero y el rango no', () => {
  test('El rango no viaja entre mapas', async () => {
    const casa = (await mapaDe(CASA)).mapa;
    const vacaciones = (await mapaDe(VACACIONES)).mapa;
    const enCasa = arbolDeCalzadas(casa.celdas[0].mundo);
    const enVacaciones = arbolDeCalzadas(vacaciones.celdas[0].mundo);

    // En casa se sabe quién eres: han llegado tres noticias a su primer núcleo.
    const nucleos = estadoDeNucleos();
    const motes = estadoDeMotes();
    const suyo = enCasa.nucleos[0];
    for (const n of [1, 2, 3]) {
      sedimenta(nucleos, {
        mapaId: casa.id,
        nucleo: suyo,
        loQueLlego: versionQueLlego({
          rumor: `r${n}`,
          origen: suyo,
          nivel: 0,
          signo: SIGNOS.BUENO,
          // El protagonista es la jugadora: lo que sube el rango es lo que se cuenta
          // **de ti**, y sin declararlo el recuento se niega a suponerlo.
          hechos: { protagonista: { tipo: PROTAGONISTAS.JUGADORA, ref: null }, asunto: `hecho ${n}` },
        }),
      });
    }
    assert.notEqual(rangoEn(nucleos, { mapaId: casa.id, nucleo: suyo, mapa: enCasa }).escalon, ESCALON_DE_PARTIDA, 'en casa tenía que saberse ya quién eres');

    // Y en el mapa nuevo se es forastera en todos sus núcleos, sin ninguna regla que
    // lo impida: el rango es por núcleo y allí nadie ha oído nada.
    for (const nucleo of enVacaciones.nucleos) {
      const rango = rangoEn(nucleos, { mapaId: vacaciones.id, nucleo, mapa: enVacaciones });
      assert.equal(rango.escalon, ESCALON_DE_PARTIDA, `en "${nucleo}" del mapa nuevo no se es forastera`);
      assert.equal(moteEn(nucleos, { mapaId: vacaciones.id, nucleo, mapa: enVacaciones, motes }), null, `en "${nucleo}" del mapa nuevo ya hay mote`);
    }

    // Volver a casa devuelve el rango que se dejó, sin que nadie lo haya guardado aparte.
    assert.notEqual(rangoEn(nucleos, { mapaId: casa.id, nucleo: suyo, mapa: enCasa }).escalon, ESCALON_DE_PARTIDA, 'al volver a casa ya no te conocen');
  });

  test('El jugador viaja entero', () => {
    // Lo que viaja y lo que no se lee en la forma del estado y no en una promesa: lo
    // que es de la jugadora no está indexado por mapa, y lo que es del sitio sí. Por eso
    // el rango no viaja sin que haga falta ninguna regla nueva.
    const doc = congelaEstado(estadoInicial({ semilla: SEMILLA_A }));
    const porMapa = (area) => {
      let indexado = false;
      recorreDocumento(doc.areas[area], (ruta, valor) => {
        if (valor !== null && typeof valor === 'object' && !Array.isArray(valor) && 'mapas' in valor) indexado = true;
      });
      return indexado;
    };

    for (const area of ['personaje', 'oro', 'objetos', 'diario']) {
      assert.equal(porMapa(area), false, `"${area}" está indexado por mapa: es de la jugadora y tiene que viajar con ella`);
    }
    for (const area of ['pasos', 'nucleos', 'motes', 'rumores']) {
      assert.equal(porMapa(area), true, `"${area}" no está indexado por mapa: se llevaría a otro mapa lo que es del sitio`);
    }
  });

  test('El código de esta entrega no copia rangos, motes ni lo que se cuenta de un mapa a otro', () => {
    const codigo = fuente(MODULO);
    for (const nombre of Object.keys(MAPAS)) {
      assert.ok(!/(copia|migra|traslada|hereda|traspasa|lleva)[A-Z]/.test(nombre), `"${nombre}" mueve algo de un mapa a otro`);
    }
    // Ninguna función de este módulo recibe dos mapas a la vez, que es la forma que
    // tendría cualquier ruta que llevara lo de uno al otro.
    for (const firma of codigo.matchAll(/export (?:async )?function (\w+)\(([^)]*)\)/g)) {
      assert.ok(!/origen.*destino|desde.*hasta|mapaA.*mapaB/.test(firma[2]), `"${firma[1]}" recibe dos mapas: ${firma[2]}`);
    }
    assert.ok(!/rangos\s*\[[^\]]+\]\s*=/.test(codigo), 'este módulo escribe rangos, y solo tendría que leerlos');
  });
});

describe('El mundo de casa no avanza en tu ausencia', () => {
  test('El mundo de casa no avanza en tu ausencia', async () => {
    const almacen = almacenEnMemoria();
    const casa = await guardadoEn(almacen, CASA);
    const vacaciones = await guardadoEn(almacen, VACACIONES);

    const pasos = estadoDePasos();
    const enCasa = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: casa.id, estado: pasos });
    enCasa.avanza(7);
    assert.equal(enCasa.contador(), 7);

    // Tres semanas fuera andando en el otro mapa: treinta pasos allí.
    const fuera = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: vacaciones.id, estado: pasos });
    fuera.avanza(30);

    assert.equal(enCasa.contador(), 7, 'el mundo de casa ha avanzado mientras no estabas');
    assert.equal(fuera.contador(), 30, 'los pasos de allí no han avanzado el mundo de allí');

    // Y lo mismo dice la lista de mapas, que es de donde lo lee el diario.
    const lista = await listaDeMapas({ almacen, pasos });
    assert.equal(lista.find((m) => m.id === casa.id).pasos, 7);
    assert.equal(lista.find((m) => m.id === vacaciones.id).pasos, 30);
  });

  test('Cada mapa lleva su reserva de pasos de fondo y no se mezclan', async () => {
    const almacen = almacenEnMemoria();
    const casa = await guardadoEn(almacen, CASA);
    const vacaciones = await guardadoEn(almacen, VACACIONES);

    const pasos = estadoDePasos();
    const enCasa = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: casa.id, estado: pasos });
    const fuera = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: vacaciones.id, estado: pasos });

    kilometrosDeFondo({ motor: fuera, metros: TRAMO_M * 3, activos: true, tramo: TRAMO_M });
    assert.equal(tamanoDeLaReserva(fuera), 3, 'los kilómetros de fondo no han llenado la reserva del mapa donde se anduvieron');
    assert.equal(tamanoDeLaReserva(enCasa), 0, 'la reserva de casa se ha llenado con kilómetros andados en otro mapa');
    assert.equal(enCasa.contador(), 0, 'el contador de casa ha avanzado con kilómetros de otro mapa');

    const lista = await listaDeMapas({ almacen, pasos });
    assert.equal(lista.find((m) => m.id === vacaciones.id).enLaReserva, 3);
    assert.equal(lista.find((m) => m.id === casa.id).enLaReserva, 0);
    assert.ok(TOPE_DE_RESERVA >= 3, 'la prueba se ha quedado sin sitio en la reserva y no mediría nada');
  });

  test('Los kilómetros de fondo se acreditan al mapa activo en el momento de abrir', async () => {
    const casa = (await mapaDe(CASA)).mapa;
    const vacaciones = (await mapaDe(VACACIONES)).mapa;
    const pasos = estadoDePasos();

    // Se abre la app estando de vacaciones: el mapa activo lo decide la posición, y los
    // kilómetros que llegaron con la app cerrada se le acreditan a ese. Es una
    // aproximación declarada, y la alternativa —repartirlos por dónde se anduvieron—
    // exige un histórico de posiciones que RF-PRIV-002 prohíbe.
    const activo = resuelveMapaActivo([casa, vacaciones], { ...coordenadaDe(VACACIONES), tramoM: TRAMO_M });
    assert.equal(activo.mapaId, vacaciones.id);
    const motor = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: activo.mapaId, estado: pasos });
    kilometrosDeFondo({ motor, metros: TRAMO_M * 2, activos: true, tramo: TRAMO_M });

    assert.equal(pasos.mapas[vacaciones.id].n, 2, 'los pasos de fondo no han ido al mapa activo al abrir');
    assert.equal(pasos.mapas[casa.id], undefined, 'los pasos de fondo han tocado un mapa que no era el activo');
  });

  test('Un mapa que lleva meses sin visitarse vuelve exactamente como se dejó', async () => {
    const almacen = almacenEnMemoria();
    const casa = await guardadoEn(almacen, CASA);
    const pasos = estadoDePasos();
    creaMotorDePasos({ semilla: SEMILLA_A, mapaId: casa.id, estado: pasos }).avanza(4);
    const comoSeDejo = JSON.stringify(await listaDeMapas({ almacen, pasos }));
    const documento = textoDeCelda(casa.celdas[0]);

    // Pasan los meses: como el reloj del mundo son los kilómetros y no el calendario,
    // «pasar meses» es exactamente no hacer nada. Nada caduca, nada decae.
    const vuelto = await cargaMapa({ almacen, id: casa.id, semilla: SEMILLA_A });
    const celda = await cargaCelda(vuelto, { i: 0, j: 0 }, { almacen });
    assert.equal(textoDeCelda(celda), documento, 'el documento del mapa ha cambiado por no visitarlo');
    assert.equal(JSON.stringify(await listaDeMapas({ almacen, pasos })), comoSeDejo, 'el mapa no visitado no vuelve como se dejó');

    // Y no hay ninguna operación de caducidad, decaimiento ni penalización por ausencia.
    const codigo = fuente(MODULO);
    for (const palabra of ['caduca', 'decae', 'penaliza', 'expira', 'olvida']) {
      assert.ok(!new RegExp(`function \\w*${palabra}`, 'i').test(codigo), `este módulo trae una operación de "${palabra}"`);
    }
  });
});

describe('Los mapas antiguos se leen y no se juegan', () => {
  test('Los mapas antiguos se leen desde el diario', async () => {
    const almacen = almacenEnMemoria();
    const casa = await guardadoEn(almacen, CASA);
    const vacaciones = await guardadoEn(almacen, VACACIONES);

    // La lista de mapas es lo que alimenta el capítulo por mapa del diario: uno por mapa.
    const lista = await listaDeMapas({ almacen });
    assert.equal(lista.length, 2, 'un capítulo por mapa, y la lista no trae los dos');
    for (const m of lista) assert.ok(m.titulo, `el mapa ${m.id} llega a la lista sin título con el que titular su capítulo`);
    assert.deepEqual(lista.map((m) => m.id), [casa.id, vacaciones.id].sort(), 'la lista de mapas no va en orden estable');

    // Y no se puede jugar en el mapa antiguo desde casa: el activo lo decide dónde
    // estás, y estando en casa el de vacaciones no es el activo por ninguna vía.
    const enCasa = resuelveMapaActivo([casa, vacaciones], { ...coordenadaDe(CASA), tramoM: TRAMO_M });
    assert.equal(enCasa.mapaId, casa.id, 'desde casa se ha podido activar el mapa de vacaciones');
  });
});

describe('Determinismo', () => {
  test('Dos mapas de la misma partida siembran distinto la misma celda', async () => {
    const casa = (await mapaDe(CASA)).mapa;
    const vacaciones = (await mapaDe(VACACIONES)).mapa;
    const celda = { i: 0, j: 0 };
    assert.notEqual(
      semillaDeCelda(SEMILLA_A, casa.id, celda),
      semillaDeCelda(SEMILLA_A, vacaciones.id, celda),
      'la misma celda de dos mapas de la misma partida se siembra igual',
    );
    // Y la misma celda del mismo mapa en dos partidas distintas, también.
    assert.notEqual(semillaDeCelda(SEMILLA_A, casa.id, celda), semillaDeCelda(SEMILLA_B, casa.id, celda));
  });

  test('El módulo del mapa activo no usa azar del sistema, ni el reloj, ni orden de inserción', () => {
    const codigo = fuente(MODULO)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
      .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, "''");
    for (const prohibido of ['Math.random', 'Date.now', 'new Date', 'performance.now']) {
      assert.ok(!codigo.includes(prohibido), `${MODULO} usa ${prohibido}`);
    }
    // El desempate del solapamiento va por identificador y no por posición en la lista.
    assert.ok(/mapa\.id/.test(codigo), 'el desempate no cita el identificador del mapa');
  });

  test('Resolver el mapa activo dos veces con el mismo estado da lo mismo y no escribe nada', async () => {
    const almacen = almacenEnMemoria();
    const casa = await guardadoEn(almacen, CASA);
    const vacaciones = await guardadoEn(almacen, VACACIONES);
    const escrituras = almacen.operaciones('escribe').length;

    const donde = { ...coordenadaDe(CASA), tramoM: TRAMO_M };
    const una = resuelveMapaActivo([casa, vacaciones], donde);
    const otra = resuelveMapaActivo([casa, vacaciones], donde);
    assert.equal(una.mapaId, otra.mapaId);
    assert.equal(una.clave, otra.clave);
    assert.equal(almacen.operaciones('escribe').length, escrituras, 'resolver el mapa activo ha escrito en el almacén');
    assert.deepEqual(almacen.operaciones('borra'), [], 'resolver el mapa activo ha borrado algo');
  });
});
