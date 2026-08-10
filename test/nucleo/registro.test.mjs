// SPEC-016 · El sobre del estado, el registro de hechos y la reconstrucción: **lo
// que se apunta, lo que manda y lo que se puede reconstruir**.
//
// Todo lo que le pasa a la jugadora se guarda dos veces —el estado, que es su
// partida ahora mismo, y el registro de hechos, que es la red de seguridad— y dos
// verdades en paralelo es el bug clásico. Aquí se afirma la regla que lo cierra:
// **manda el estado**, el registro solo se reproduce cuando alguien lo pide, y la
// reproducción avisa siempre de que el resultado puede diferir.
//
// Lo que se mide con números, porque es lo que hace preciso «manda el estado»: un
// apagón entre las dos escrituras deja una **cola** de hechos posteriores a la marca
// de aplicación, y terminarla al cargar no es reconstruir, es terminar una escritura.
// Con el orden al revés —el estado primero— el apagón perdería hechos sin que nada
// se pusiera rojo.
//
// Los dos escenarios de la batería que esta spec existe para hacer verdad —«El
// estado manda sobre el registro» y «El registro basta para reconstruir»— llevan
// aquí su nombre literal, igual que «El rastro de ubicación no se guarda nunca», que
// es **bloqueante** (`@privacidad`, RF-PRIV-002). Los demás casos van declarados como
// huecos de la batería en `test/spec-test-map.json`.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: el almacén es el doble
// en memoria de SPEC-009 y el momento de cada hecho lo escribe la prueba.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as moduloDeHechos from '../../packages/nucleo/partida/hechos.js';
import { entradasDe } from '../../packages/nucleo/partida/diario.js';
import {
  AREAS_CON_ESTADO,
  AREAS_SIN_ESTADO,
  ESQUEMA_ESTADO,
  IDS_DE_AREA,
  areaDe,
  congelaEstado,
  declaraArea,
  estadoInicial,
  levantaEstado,
  pisaSitio,
  textoDeEstado,
} from '../../packages/nucleo/partida/estado.js';
import { CLASES, VERSION_FORMATO, VERSION_GENERADOR, lee, texto as textoCanonico } from '../../packages/nucleo/partida/formato.js';
import {
  TIPOS_DE_HECHO,
  anexa,
  areaDeTipo,
  bytesDeHecho,
  congelaRegistro,
  cuantosHechos,
  esquemaDeCarga,
  hecho,
  hechosDe as hechosDelRegistro,
  hechosDesde,
  levantaRegistro,
  ordenDeHechos,
  registroInicial,
  tiposDelArea,
} from '../../packages/nucleo/partida/hechos.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { npcsDeMapa } from '../../packages/nucleo/partida/npcs.js';
import { loQueSeCuentaEn, nucleosDeMapa, sedimenta } from '../../packages/nucleo/partida/nucleos.js';
import { objetosDe } from '../../packages/nucleo/partida/objetos.js';
import { ingresa, saldoDe } from '../../packages/nucleo/partida/oro.js';
import { estadoDeMapa } from '../../packages/nucleo/partida/pasos.js';
import { rangoEn } from '../../packages/nucleo/partida/rango.js';
import {
  CLAVES_DE_PARTIDA,
  aplicaHechos,
  cargaPartida,
  diagnosticoDeDiscrepancia,
  guardaPartida,
  reconstruye,
} from '../../packages/nucleo/partida/reconstruccion.js';
import { MB, almacenEnMemoria, almacenQueFallaAlEscribir, bytesDe, celdaDeFixture, recorreDocumento } from './partida-de-prueba.mjs';
import {
  MAPA,
  OTRA_SEMILLA,
  SEMILLA,
  SUCESO,
  hechoDeCaraConocida,
  hechoDeObjeto,
  hechosDeUnaSalida,
  mapaDeNucleos,
  versionDe,
} from './diario-de-prueba.mjs';

/**
 * Los tres presupuestos que esta capa mide. Los dos agregados son los de la spec y no
 * se tocan: son los que deciden si esto cabe en un móvil. El de un hecho suelto pasa de
 * 300 a 500 B por veredicto §6q de `pipeline/decisiones-orquestador.md`.
 */
const PRESUPUESTO_DE_HECHO = 500;
const PRESUPUESTO_DE_REGISTRO = 6 * MB;
const PRESUPUESTO_DE_ESTADO = 2 * MB;

/** Las cuatro rutas que entrega la spec, para lo que se afirma sobre sus imports. */
const RUTAS = ['estado.js', 'hechos.js', 'diario.js', 'reconstruccion.js'].map((f) => `packages/nucleo/partida/${f}`);

/** Un hecho de versión oída, escrito por su carga para no depender del diario. */
function hechoOido({ mapa = MAPA, dia = 1, paso = 1, nucleo = 'Monfrida', suceso = SUCESO, nivel = 1, veces = 3 } = {}) {
  return hechosDeUnaSalida({ mapa, dia, paso, nucleo, suceso, nivel, veces })[2];
}

/** Una partida en marcha: el estado y el registro que la prueba va a guardar. */
function partida({ semilla = SEMILLA } = {}) {
  return { estado: estadoInicial({ semilla }), registro: registroInicial(), almacen: almacenEnMemoria() };
}

describe('El sobre del estado y su versión', () => {
  test('El estado lleva la versión de formato de la constante única y no una propia', () => {
    const doc = congelaEstado(estadoInicial({ semilla: SEMILLA }));
    assert.equal(doc.version, VERSION_FORMATO);
    assert.equal(doc.clase, CLASES.ESTADO);
    assert.equal(doc.generador, VERSION_GENERADOR);
  });

  test('La cabecera declara la semilla de la partida y la versión de las reglas', () => {
    const doc = congelaEstado(estadoInicial({ semilla: SEMILLA }));
    assert.deepEqual(Object.keys(doc).sort(), ['aplicadoHasta', 'areas', 'clase', 'generador', 'reconstruido', 'semilla', 'version']);
    assert.equal(doc.semilla, SEMILLA);
    assert.equal(doc.generador, VERSION_GENERADOR);
    assert.equal(doc.aplicadoHasta, -1, 'una partida recién creada no ha aplicado ningún hecho');
    assert.equal(doc.reconstruido, null);
    assert.throws(() => estadoInicial({}), /semilla/i, 'una partida sin semilla no se podría volver a abrir');
  });

  test('Cada área del estado es la de la spec que la posee y ninguna se declara dos veces', () => {
    const doc = congelaEstado(estadoInicial({ semilla: SEMILLA }));
    assert.deepEqual(Object.keys(doc.areas), [...AREAS_CON_ESTADO], 'las áreas se escriben en el orden en que se declararon');
    for (const id of ['pasos', 'nucleos', 'npcs', 'memorias', 'relaciones', 'diario']) {
      assert.ok(AREAS_CON_ESTADO.includes(id), `falta el área "${id}", que es de la spec que la posee`);
    }
    // Las que solo aportan tipos de hecho no ocupan campo del estado.
    for (const id of AREAS_SIN_ESTADO) assert.ok(!(id in doc.areas), `el área "${id}" no tiene estado todavía y no puede ocupar un campo`);
    assert.deepEqual([...IDS_DE_AREA].sort(), [...AREAS_CON_ESTADO, ...AREAS_SIN_ESTADO].sort());
    assert.throws(() => declaraArea({ id: 'diario' }), /ya está declarada/);
    assert.ok(areaDe('diario').tipos.includes('version-oida'), 'el diario declara su tipo de hecho junto con su área');
  });

  test('Un campo que ninguna área declara hace fallar la validación nombrándolo', () => {
    const doc = { ...congelaEstado(estadoInicial({ semilla: SEMILLA })), posicionDeLaJugadora: 'x' };
    assert.throws(() => levantaEstado(doc), /posicionDeLaJugadora/);
    const conAreaInventada = congelaEstado(estadoInicial({ semilla: SEMILLA }));
    const roto = { ...conAreaInventada, areas: { ...conAreaInventada.areas, brujula: {} } };
    assert.throws(() => levantaEstado(roto), /brujula/);
  });

  test('Dos escrituras del mismo estado dan el mismo documento byte a byte', () => {
    const estado = estadoInicial({ semilla: SEMILLA });
    sedimenta(estado.nucleos, { mapaId: MAPA, nucleo: 'Monfrida', loQueLlego: versionDe({}) });
    pisaSitio(estado.sitios, { mapaId: MAPA, sitio: 'Monfrida' });
    assert.equal(textoDeEstado(estado), textoDeEstado(estado));
    const vuelto = levantaEstado(congelaEstado(estado));
    assert.equal(textoDeEstado(vuelto), textoDeEstado(estado), 'el ida y vuelta no mueve ni un byte');
  });

  test('Un estado sin campo de versión de formato se rechaza nombrando el campo que falta', () => {
    const doc = congelaEstado(estadoInicial({ semilla: SEMILLA }));
    const { version, ...sinVersion } = doc;
    assert.equal(version, VERSION_FORMATO);
    assert.throws(() => levantaEstado(sinVersion), /no declara el campo "version"/);
  });

  test('Un estado de una versión mayor no se abre y el error declara las dos versiones', () => {
    const doc = { ...congelaEstado(estadoInicial({ semilla: SEMILLA })), version: VERSION_FORMATO + 1 };
    assert.throws(() => levantaEstado(doc), new RegExp(`${VERSION_FORMATO + 1}.*${VERSION_FORMATO}`));
    assert.throws(() => levantaEstado(doc), /no se abre/);
  });

  test('Un estado de una versión menor declara que hace falta migrarlo', () => {
    const doc = { ...congelaEstado(estadoInicial({ semilla: SEMILLA })), version: VERSION_FORMATO - 1 };
    assert.throws(() => levantaEstado(doc), /migrarlo/);
  });

  test('Ningún dato de la jugadora está en el documento de celda y ningún dato del mundo en el estado', async () => {
    const registroDeCelda = await celdaDeFixture('barrio-tres-calles');
    const celda = textoDeCelda(registroDeCelda);
    for (const rastro of ['aplicadoHasta', 'reconstruido', '"diario"', '"entradas"', '"triangulado"']) {
      assert.ok(!celda.includes(rastro), `el documento de celda lleva "${rastro}", que es estado de la jugadora`);
    }
    const estado = estadoInicial({ semilla: SEMILLA });
    const doc = congelaEstado(estado);
    for (const delMundo of ['settlements', 'routes', 'parajes', 'polilinea', 'osmId']) {
      assert.ok(!JSON.stringify(doc).includes(delMundo), `el estado lleva "${delMundo}", que es del mundo congelado`);
    }
    assert.ok(!celda.includes(SEMILLA), 'la semilla vive en el estado y no en los documentos del mundo');
  });

  test('Cien salidas no mueven el documento congelado del mundo', async () => {
    const registroDeCelda = await celdaDeFixture('barrio-tres-calles');
    const antes = textoDeCelda(registroDeCelda);
    const { estado, registro } = partida();
    for (let dia = 1; dia <= 100; dia++) {
      const lote = hechosDeUnaSalida({ dia, paso: dia, nucleo: 'Monfrida', suceso: `s${dia}` });
      anexa(registro, lote);
      aplicaHechos(estado, lote.map((h) => hecho(h)));
    }
    assert.equal(textoDeCelda(registroDeCelda), antes, 'lo que crece está en el estado y en el registro, nunca en el mundo');
    assert.equal(cuantosHechos(registro), 300);
    assert.equal(entradasDe(estado.diario).length, 100, 'y todo lo que ha crecido se puede leer en el estado');
  });
});

describe('El registro de hechos', () => {
  test('Una partida recién creada tiene el registro vacío y no es un error', () => {
    const registro = registroInicial();
    assert.equal(cuantosHechos(registro), 0);
    assert.deepEqual(hechosDelRegistro(registro), []);
    assert.deepEqual(hechosDesde(registro, -1), []);
    assert.equal(congelaRegistro(registro).hechos.length, 0);
    assert.equal(registro.reglas, VERSION_GENERADOR, 'con la versión de reglas con la que nació grabada dentro');
  });

  test('El catálogo de tipos de hecho es el de partida-guardada.md §2, más la versión oída', () => {
    // `anclaje-devuelto` entra con SPEC-035 y **no es evitable ni ablandable**: la spec
    // exige que deshacer un descarte se anote detrás y no borre el hecho del descarte
    // —el registro es la bitácora de lo que pasó y no el estado, y borrar es la única
    // operación que no tiene—. Sin este tipo, «se reconstruye desde el registro y salen
    // los mismos descartes» sería falso: al reproducir, los descartes deshechos
    // resucitarían y la partida reconstruida mandaría otra vez a la casa de alguien.
    // Los tres de SPEC-036 entran por la misma puerta y **tampoco son ablandables**:
    // sin `conocimiento-subido` una partida reconstruida amanecería con el mapa en
    // blanco, sin `arranque-cerrado` volvería a enseñar la cartela del hito —que es lo
    // que «una sola vez» prohíbe— y sin `hoja-propia` el diario reconstruido perdería
    // justo lo que escribió quien juega.
    assert.deepEqual([...TIPOS_DE_HECHO], [
      'anclaje-descartado',
      'anclaje-devuelto',
      'arranque-cerrado',
      'aventura-abandonada',
      'aventura-aceptada',
      'aventura-cerrada',
      'cara-conocida',
      'conocimiento-subido',
      'decision-en-aventura',
      'entrega-atendida',
      'entrega-ignorada',
      'hoja-propia',
      'objeto-obtenido',
      'paso-ejecutado',
      // SPEC-042, y **tampoco es ablandable**: sin `reserva-vaciada` el vaciado del
      // zurrón no dejaría rastro, así que una partida reconstruida amanecería con la
      // reserva llena y volvería a enseñar lo que ya se leyó —que es exactamente lo que
      // «se vacía al leerse» prohíbe—. Es además la mitad que hace atómico el vaciado:
      // el hecho se escribe primero y la reserva se vacía detrás.
      'reserva-vaciada',
      'sitio-pisado',
      'version-oida',
    ]);
    assert.deepEqual([...tiposDelArea('diario')], ['hoja-propia', 'version-oida']);
    assert.equal(areaDeTipo('sitio-pisado'), 'sitios');
    assert.equal(areaDeTipo('entrega-atendida'), 'entregas');
    assert.equal(areaDeTipo('conocimiento-subido'), 'conocimiento');
    assert.equal(areaDeTipo('arranque-cerrado'), 'arranque');
  });

  test('Un hecho declara su tipo, su mapa, su momento y su carga inerte', () => {
    const h = hecho(hechoOido({ dia: 22, paso: 40 }));
    assert.deepEqual(Object.keys(h).sort(), ['carga', 'dia', 'mapa', 'paso', 'tipo']);
    assert.equal(h.tipo, 'version-oida');
    assert.equal(h.mapa, MAPA);
    assert.deepEqual({ dia: h.dia, paso: h.paso }, { dia: 22, paso: 40 });
    // La carga se valida contra el esquema de su propio tipo y no contra la unión.
    assert.throws(() => hecho({ tipo: 'sitio-pisado', mapa: MAPA, dia: 1, paso: 1, carga: { sitio: 'Monfrida', lat: 42.4 } }), /lat/);
    assert.ok(esquemaDeCarga('sitio-pisado').mapa.sitio);
  });

  test('Lo que se oye en un sitio deja también su hecho en el registro', () => {
    const { registro } = partida();
    anexa(registro, [hechoOido({ dia: 3, paso: 9 })]);
    const [h] = hechosDelRegistro(registro);
    assert.equal(h.tipo, 'version-oida');
    assert.equal(h.carga.suceso, SUCESO);
    assert.equal(h.carga.nivel, 1);
    assert.equal(h.carga.hechos.escala.veces, 3, 'la versión deformada viaja verbatim en la carga');
  });

  test('Un hecho recién escrito queda al final y ningún hecho anterior cambia', () => {
    const { registro } = partida();
    anexa(registro, hechosDeUnaSalida({ dia: 1, paso: 1 }));
    const antes = JSON.stringify(hechosDelRegistro(registro));
    anexa(registro, [hechoDeObjeto({ dia: 2, paso: 4 })]);
    const ahora = hechosDelRegistro(registro);
    assert.equal(ahora.length, 4);
    assert.equal(ahora[3].tipo, 'objeto-obtenido', 'el hecho nuevo está al final');
    assert.equal(JSON.stringify(ahora.slice(0, 3)), antes, 'y ninguno de los anteriores ha cambiado');
  });

  test('Un hecho ya escrito no se reescribe cuando el estado cambia después', () => {
    const { estado, registro } = partida();
    const lote = hechosDeUnaSalida({ dia: 1, paso: 1 });
    anexa(registro, lote);
    const antes = JSON.stringify(congelaRegistro(registro));
    aplicaHechos(estado, lote.map((h) => hecho(h)));
    ingresa(estado.oro, { oro: 40, quien: 'un desenlace posterior' });
    pisaSitio(estado.sitios, { mapaId: MAPA, sitio: 'Vilanova' });
    assert.equal(JSON.stringify(congelaRegistro(registro)), antes, 'el registro solo crece: nada lo reescribe');
    // Y no hay ninguna operación que borre ni sustituya un hecho: no es una
    // convención, es la ausencia deliberada de la función que lo haría.
    for (const nombre of Object.keys(moduloDeHechos)) {
      assert.ok(!/borra|elimina|reescribe|sustituye|corrige/i.test(nombre), `"${nombre}" sería la puerta por la que el registro deja de ser solo crecer`);
    }
  });

  test('Dos hechos del mismo paso salen en un orden declarado y no en el de inserción', () => {
    const dos = [hechoDeObjeto({ dia: 1, paso: 7 }), hechoDeCaraConocida({ dia: 1, paso: 7 })];
    const unOrden = registroInicial();
    const otroOrden = registroInicial();
    anexa(unOrden, dos);
    anexa(otroOrden, dos.slice().reverse());
    assert.equal(JSON.stringify(congelaRegistro(unOrden)), JSON.stringify(congelaRegistro(otroOrden)));
    assert.deepEqual(hechosDelRegistro(unOrden).map((h) => h.tipo), ['cara-conocida', 'objeto-obtenido']);
    assert.ok(ordenDeHechos(hecho(dos[1]), hecho(dos[0])) < 0, 'el criterio es declarado: día, paso, mapa, tipo y carga');
  });

  test('Un hecho de un tipo que ninguna área declara falla nombrando el tipo', () => {
    assert.throws(() => hecho({ tipo: 'rango-subido', mapa: MAPA, dia: 1, paso: 1, carga: {} }), /"rango-subido".*ninguna área declara/s);
    const doc = { version: VERSION_FORMATO, generador: VERSION_GENERADOR, clase: CLASES.REGISTRO, hechos: [{ tipo: 'rango-subido', mapa: MAPA, dia: 1, paso: 1, carga: {} }] };
    assert.throws(() => levantaRegistro(doc), /"rango-subido"/);
  });

  test('Un hecho sin momento falla nombrando el campo', () => {
    assert.throws(() => hecho({ tipo: 'sitio-pisado', mapa: MAPA, paso: 1, carga: { sitio: 'Monfrida' } }), /falta el campo "dia"/);
    assert.throws(() => hecho({ tipo: 'sitio-pisado', mapa: MAPA, dia: 1, carga: { sitio: 'Monfrida' } }), /falta el campo "paso"/);
    assert.throws(() => hecho({ tipo: 'sitio-pisado', mapa: MAPA, dia: 1, paso: 1.5, carga: { sitio: 'Monfrida' } }), /nunca una marca del reloj real/);
  });

  test('Una escritura de hechos que falla a mitad no deja hechos a medias', () => {
    const { registro } = partida();
    anexa(registro, [hechoDeObjeto({ dia: 1, paso: 1 })]);
    const antes = JSON.stringify(hechosDelRegistro(registro));
    const lote = [
      hechoDeCaraConocida({ dia: 1, paso: 2 }),
      { tipo: 'sitio-pisado', mapa: MAPA, dia: 1, paso: 2, carga: { sitio: 'Vilanova' } },
      { tipo: 'no-declarado', mapa: MAPA, dia: 1, paso: 2, carga: {} },
    ];
    assert.throws(() => anexa(registro, lote), /"no-declarado"/);
    assert.equal(JSON.stringify(hechosDelRegistro(registro)), antes, 'se anexan todos o ninguno');
    assert.equal(cuantosHechos(registro), 1);
  });

  test('Un almacén que falla al escribir deja el estado y el registro anteriores intactos', async () => {
    const { estado, registro } = partida();
    const almacen = almacenEnMemoria();
    anexa(registro, hechosDeUnaSalida({ dia: 1, paso: 1 }));
    await guardaPartida({ estado, registro, almacen });
    const estadoGuardado = await almacen.lee(CLAVES_DE_PARTIDA.estado);
    const registroGuardado = await almacen.lee(CLAVES_DE_PARTIDA.registro);

    const caido = almacenQueFallaAlEscribir({ mensaje: 'el disco está lleno' });
    caido.datos.set(CLAVES_DE_PARTIDA.estado, estadoGuardado);
    caido.datos.set(CLAVES_DE_PARTIDA.registro, registroGuardado);
    anexa(registro, [hechoDeObjeto({ dia: 2, paso: 5 })]);
    await assert.rejects(() => guardaPartida({ estado, registro, almacen: caido }), /el disco está lleno/);
    assert.equal(await caido.lee(CLAVES_DE_PARTIDA.estado), estadoGuardado, 'el estado anterior sigue intacto');
    assert.equal(await caido.lee(CLAVES_DE_PARTIDA.registro), registroGuardado, 'y el registro anterior también');
  });

  test('Sin almacén inyectado todo ocurre en memoria y no se escribe nada en ningún sitio', async () => {
    const { estado, registro } = partida();
    const lote = hechosDeUnaSalida({ dia: 1, paso: 1 });
    anexa(registro, lote);
    aplicaHechos(estado, lote.map((h) => hecho(h)));
    assert.equal(entradasDe(estado.diario).length, 1, 'la salida se cierra entera en memoria');
    await assert.rejects(() => guardaPartida({ estado, registro }), /almac[eé]n/i);
    await assert.rejects(() => cargaPartida({}), /almac[eé]n/i);
  });
});

describe('El mundo se congela entero', () => {
  test('El estado manda sobre el registro', async () => {
    // El estado guardado dice que a «Monfrida» han llegado tres rumores —eso es
    // pertenencia— y el registro solo tiene el hecho de uno, que reproducido daría
    // nombradía. Al cargar vale el estado guardado, sin excepción.
    const { estado, registro, almacen } = partida();
    for (const rumor of ['s1', 's2', 's3']) {
      sedimenta(estado.nucleos, { mapaId: MAPA, nucleo: 'Monfrida', loQueLlego: versionDe({ rumor }) });
    }
    anexa(registro, [hechoOido({ suceso: 's1', dia: 1, paso: 1 })]);
    await guardaPartida({ estado, registro, almacen });

    const abierta = await cargaPartida({ almacen, semilla: SEMILLA });
    const mapa = mapaDeNucleos(['Monfrida']);
    assert.equal(rangoEn(abierta.estado.nucleos, { mapaId: MAPA, nucleo: 'Monfrida', mapa }).escalon, 'pertenencia', 'vale el estado guardado');
    assert.equal(abierta.colaAplicada, 0, 'y el registro no se reproduce al cargar');

    const candidato = reconstruye({ registro, semilla: SEMILLA });
    assert.equal(rangoEn(candidato.estado.nucleos, { mapaId: MAPA, nucleo: 'Monfrida', mapa }).escalon, 'nombradia', 'el registro reconstruiría otro rango');
    assert.notEqual(rangoEn(candidato.estado.nucleos, { mapaId: MAPA, nucleo: 'Monfrida', mapa }).escalon, 'pertenencia');
  });

  test('El registro basta para reconstruir', async () => {
    // Con el estado corrompido, reproducir el registro devuelve las cuatro cosas que
    // el escenario exige: los rangos, lo oído, la repisa y los NPCs conocidos. Y
    // **avisa siempre** de que el resultado puede diferir.
    const { registro } = partida();
    anexa(registro, [
      hechoOido({ suceso: 's1', nucleo: 'Monfrida', dia: 1, paso: 1 }),
      hechoOido({ suceso: 's2', nucleo: 'Monfrida', dia: 2, paso: 5 }),
      hechoOido({ suceso: 's3', nucleo: 'Vilanova', dia: 3, paso: 9 }),
      hechoDeObjeto({ dia: 3, paso: 9 }),
      hechoDeCaraConocida({ dia: 3, paso: 9 }),
      { tipo: 'paso-ejecutado', mapa: MAPA, dia: 3, paso: 9, carga: { n: 9, restoM: 12, restoFondoM: 3 } },
    ]);

    const resultado = reconstruye({ registro, semilla: SEMILLA });
    const { estado } = resultado;
    const mapa = mapaDeNucleos(['Monfrida', 'Vilanova']);
    // Los rangos: salen de lo que sedimentó, sin reproducir la propagación.
    assert.equal(rangoEn(estado.nucleos, { mapaId: MAPA, nucleo: 'Monfrida', mapa }).escalon, 'nombradia');
    assert.equal(rangoEn(estado.nucleos, { mapaId: MAPA, nucleo: 'Vilanova', mapa }).escalon, 'nombradia');
    assert.equal(Object.keys(nucleosDeMapa(estado.nucleos, MAPA)).length, 2, 'lo oído sedimenta en los dos núcleos');
    assert.equal(loQueSeCuentaEn(estado.nucleos, { mapaId: MAPA, nucleo: 'Monfrida' }).length, 2);
    // Lo oído: las tres entradas del diario, con su nivel intacto.
    assert.equal(entradasDe(estado.diario).length, 3);
    assert.deepEqual(entradasDe(estado.diario).map((e) => e.suceso), ['s1', 's2', 's3']);
    // La repisa y los NPCs conocidos.
    assert.equal(objetosDe(estado.objetos).length, 1);
    assert.equal(npcsDeMapa(estado.npcs, MAPA).conocidas.length, 1);
    assert.equal(estadoDeMapa(estado.pasos, MAPA).n, 9, 'y el contador de pasos vuelve donde estaba');
    // Y se avisa de que el resultado puede diferir, sin condicionarlo a ninguna versión.
    assert.equal(resultado.aviso.puedeDiferir, true);
    assert.equal(resultado.aviso.reglasCambiaron, false);
    // Las áreas se declaran por el área **del tipo de hecho**: lo que sedimenta en
    // los núcleos entra por el hecho del diario, que es lo que hace que los rangos
    // vuelvan sin reproducir la propagación.
    assert.deepEqual([...resultado.areas.reproducidas], ['diario', 'npcs', 'objetos', 'pasos']);
    assert.deepEqual([...resultado.areas.sinEstadoTodavia], []);
    assert.equal(resultado.hechos, 6);
  });

  test('El diagnóstico de la discrepancia dice qué campo difiere y con qué valor a cada lado', () => {
    const { estado, registro } = partida();
    for (const rumor of ['s1', 's2', 's3']) {
      sedimenta(estado.nucleos, { mapaId: MAPA, nucleo: 'Monfrida', loQueLlego: versionDe({ rumor }) });
    }
    anexa(registro, [hechoOido({ suceso: 's1', dia: 1, paso: 1 })]);

    const diagnostico = diagnosticoDeDiscrepancia({ estado, registro });
    assert.equal(diagnostico.manda, 'estado', 'que gane el guardado no es una opción: es lo que devuelve');
    assert.equal(diagnostico.hayDiscrepancia, true);
    assert.ok(diagnostico.diferencias.length > 0);
    for (const d of diagnostico.diferencias) {
      assert.deepEqual(Object.keys(d).sort(), ['campo', 'guardado', 'registro'], 'los dos lados siempre');
      assert.ok(d.campo.startsWith('areas.'));
    }
    assert.ok(diagnostico.diferencias.some((d) => d.campo.includes('nucleos')), 'la diferencia está en lo que se cuenta en cada núcleo');
  });

  test('Consultar el diagnóstico no cambia ni el estado ni el registro', () => {
    const { estado, registro } = partida();
    sedimenta(estado.nucleos, { mapaId: MAPA, nucleo: 'Monfrida', loQueLlego: versionDe({ rumor: 's1' }) });
    anexa(registro, [hechoOido({ suceso: 's2', dia: 1, paso: 1 })]);
    const estadoAntes = textoDeEstado(estado);
    const registroAntes = textoCanonico(congelaRegistro(registro));
    diagnosticoDeDiscrepancia({ estado, registro });
    diagnosticoDeDiscrepancia({ estado, registro });
    assert.equal(textoDeEstado(estado), estadoAntes);
    assert.equal(textoCanonico(congelaRegistro(registro)), registroAntes);
  });

  test('Un apagón entre el registro y el estado deja una cola que se termina al cargar', async () => {
    // El registro se anexa primero y el estado después, declarando hasta qué hecho
    // está aplicado. Si el apagón cae entre las dos escrituras, al cargar se aplican
    // los posteriores a la marca y **jamás** los anteriores o iguales.
    const { estado, registro, almacen } = partida();
    const diez = [];
    for (let n = 1; n <= 10; n++) diez.push({ tipo: 'paso-ejecutado', mapa: MAPA, dia: 1, paso: n, carga: { n, restoM: 0, restoFondoM: 0 } });
    anexa(registro, diez);
    aplicaHechos(estado, hechosDesde(registro, -1));
    ingresa(estado.oro, { oro: 40, quien: 'un desenlace' });
    await guardaPartida({ estado, registro, almacen });
    assert.equal(lee(await almacen.lee(CLAVES_DE_PARTIDA.estado), 'el estado').aplicadoHasta, 9);

    // El apagón: el registro se escribe y el estado no llega a escribirse.
    anexa(registro, [{ tipo: 'sitio-pisado', mapa: MAPA, dia: 1, paso: 11, carga: { sitio: 'Vilanova' } }]);
    await almacen.escribe(CLAVES_DE_PARTIDA.registro, textoCanonico(congelaRegistro(registro)));

    const abierta = await cargaPartida({ almacen, semilla: SEMILLA });
    assert.equal(abierta.colaAplicada, 1, 'terminar la cola no es reconstruir: es terminar una escritura');
    assert.equal(abierta.estado.aplicadoHasta, 10);
    assert.equal(saldoDe(abierta.estado.oro), 40, 'y el saldo del estado guardado sigue intacto');
    assert.deepEqual([...abierta.estado.sitios.mapas[MAPA]], ['Vilanova']);
    assert.equal(estadoDeMapa(abierta.estado.pasos, MAPA).n, 10);

    // Con el estado al día, la segunda carga no reaplica nada.
    await guardaPartida({ estado: { ...abierta.estado }, registro, almacen });
    const otra = await cargaPartida({ almacen, semilla: SEMILLA });
    assert.equal(otra.colaAplicada, 0);
    assert.equal(otra.estado.aplicadoHasta, 10);
    assert.equal(estadoDeMapa(otra.estado.pasos, MAPA).n, 10, 'ningún hecho anterior o igual a la marca se vuelve a aplicar');
  });

  test('Un estado legible con el registro ilegible abre la partida y declara el fallo', async () => {
    const { estado, registro, almacen } = partida();
    anexa(registro, hechosDeUnaSalida({ dia: 1, paso: 1 }));
    aplicaHechos(estado, hechosDesde(registro, -1));
    await guardaPartida({ estado, registro, almacen });
    await almacen.escribe(CLAVES_DE_PARTIDA.registro, '{"version":1,"clase":"registro-de-hechos"');

    const abierta = await cargaPartida({ almacen, semilla: SEMILLA });
    assert.ok(abierta.estado, 'lo que se pierde es la red de seguridad, no la partida');
    assert.equal(abierta.registro, null);
    assert.ok(abierta.falloDelRegistro, 'y el fallo del registro se declara sin impedir jugar');
    assert.equal(entradasDe(abierta.estado.diario).length, 1);
  });

  test('Con el estado corrompido la carga falla, dice cuántos hechos hay y no reconstruye sola', async () => {
    const { estado, registro, almacen } = partida();
    anexa(registro, hechosDeUnaSalida({ dia: 1, paso: 1 }));
    await guardaPartida({ estado, registro, almacen });
    await almacen.escribe(CLAVES_DE_PARTIDA.estado, '{"version":1,');
    await assert.rejects(() => cargaPartida({ almacen, semilla: SEMILLA }), /no se puede leer[\s\S]*3 hechos/);
    await assert.rejects(() => cargaPartida({ almacen, semilla: SEMILLA }), /se pide aparte/);
  });

  test('Con el estado y el registro corrompidos no se ofrece ninguna partida a medias', async () => {
    const almacen = almacenEnMemoria();
    await almacen.escribe(CLAVES_DE_PARTIDA.estado, 'no soy un documento');
    await almacen.escribe(CLAVES_DE_PARTIDA.registro, 'yo tampoco');
    await assert.rejects(() => cargaPartida({ almacen, semilla: SEMILLA }), /el estado de la partida no se puede leer/);
    await assert.rejects(() => cargaPartida({ almacen, semilla: SEMILLA }), /el registro tampoco se puede leer/);
  });
});

describe('Reconstruir desde el registro', () => {
  test('El aviso declara las dos versiones de reglas cuando el registro trae otra', () => {
    const registro = registroInicial();
    registro.reglas = '0.0.9';
    anexa(registro, [hechoOido({ dia: 1, paso: 1 })]);
    const resultado = reconstruye({ registro, semilla: SEMILLA });
    assert.equal(resultado.aviso.puedeDiferir, true);
    assert.equal(resultado.aviso.reglasCambiaron, true);
    assert.equal(resultado.aviso.reglasDelRegistro, '0.0.9');
    assert.equal(resultado.aviso.reglasDeLaReproduccion, VERSION_GENERADOR);
  });

  test('Una reconstrucción no toca el registro y dos reconstrucciones dan el mismo estado byte a byte', () => {
    const { registro } = partida();
    anexa(registro, [...hechosDeUnaSalida({ dia: 1, paso: 1 }), hechoDeObjeto({ dia: 2, paso: 4 }), hechoDeCaraConocida({ dia: 2, paso: 4 })]);
    const antes = textoCanonico(congelaRegistro(registro));
    const una = reconstruye({ registro, semilla: SEMILLA });
    const otra = reconstruye({ registro, semilla: SEMILLA });
    assert.equal(textoCanonico(congelaRegistro(registro)), antes, 'el registro sigue idéntico byte a byte');
    assert.equal(textoDeEstado(una.estado), textoDeEstado(otra.estado));
  });

  test('Un registro vacío se reconstruye como el estado inicial de una partida y no es un error', () => {
    const resultado = reconstruye({ registro: registroInicial(), semilla: SEMILLA });
    assert.equal(resultado.hechos, 0);
    assert.equal(resultado.estado.aplicadoHasta, -1);
    const inicial = estadoInicial({ semilla: SEMILLA });
    inicial.reconstruido = resultado.estado.reconstruido;
    assert.equal(textoDeEstado(resultado.estado), textoDeEstado(inicial));
  });

  test('Un registro con un hecho corrupto a la mitad falla nombrando el hecho', () => {
    const buenos = hechosDeUnaSalida({ dia: 1, paso: 1 }).map((h) => hecho(h));
    const doc = {
      version: VERSION_FORMATO,
      generador: VERSION_GENERADOR,
      clase: CLASES.REGISTRO,
      hechos: [buenos[0], { ...buenos[1], carga: { sitio: 42 } }, buenos[2]],
    };
    assert.throws(() => levantaRegistro(doc), /el hecho 2 de 3 del registro está corrupto/);
  });

  test('Un hecho de un área que esta versión del juego ya no tiene falla nombrando el tipo', () => {
    // Se construye a mano a propósito: por la puerta de `hecho()` un tipo así ya no
    // entra, y lo que se afirma es que reproducirlo **falla** en lugar de saltárselo.
    const registro = { reglas: VERSION_GENERADOR, hechos: [{ tipo: 'rango-subido', mapa: MAPA, dia: 1, paso: 1, carga: {} }] };
    assert.throws(() => reconstruye({ registro, semilla: SEMILLA }), /"rango-subido"/);
    assert.throws(() => reconstruye({ registro, semilla: SEMILLA }), /el hecho 1 de 1 no se puede reproducir/);
  });

  test('Un hecho de un área que todavía no tiene estado se reconoce y se declara', () => {
    const registro = registroInicial();
    anexa(registro, [{ tipo: 'entrega-atendida', mapa: MAPA, dia: 1, paso: 1, carga: { entrega: 'e1', quien: null } }]);
    const resultado = reconstruye({ registro, semilla: SEMILLA });
    assert.deepEqual([...resultado.areas.sinEstadoTodavia], ['entregas']);
    assert.deepEqual([...resultado.areas.reproducidas], [], 'no altera nada, pero tampoco se pierde en silencio');
  });

  test('Un estado reconstruido declara de dónde salió y con qué versión de reglas', () => {
    const registro = registroInicial();
    registro.reglas = '0.0.9';
    anexa(registro, [hechoOido({ dia: 1, paso: 1 })]);
    const doc = congelaEstado(reconstruye({ registro, semilla: SEMILLA }).estado);
    assert.deepEqual(doc.reconstruido, { reglasDelRegistro: '0.0.9', reglasDeLaReproduccion: VERSION_GENERADOR, hechos: 1 });
    assert.equal(levantaEstado(doc).reconstruido.hechos, 1, 'y sobrevive al ida y vuelta');
    assert.equal(congelaEstado(estadoInicial({ semilla: SEMILLA })).reconstruido, null, 'un estado normal no lo declara');
  });

  test('Una partida guardada con otra semilla no se abre como esta', async () => {
    const { estado, registro, almacen } = partida({ semilla: SEMILLA });
    await guardaPartida({ estado, registro, almacen });
    await assert.rejects(() => cargaPartida({ almacen, semilla: OTRA_SEMILLA }), new RegExp(SEMILLA));
  });
});

describe('Del móvil no sale nada del jugador', () => {
  test('El rastro de ubicación no se guarda nunca', () => {
    // **Bloqueante** (`@privacidad`, RF-PRIV-002). Cien salidas andadas, y se
    // recorren todos los campos del estado y del registro: ni una posición de quien
    // juega, ni un camino entre dos sitios, ni una marca del reloj real.
    const { estado, registro } = partida();
    const sitios = ['Monfrida', 'Vilanova', 'Cadaval', 'Peiteiro'];
    for (let dia = 1; dia <= 100; dia++) {
      const lote = hechosDeUnaSalida({ dia, paso: dia, nucleo: sitios[dia % sitios.length], suceso: `s${dia}` });
      anexa(registro, lote);
      aplicaHechos(estado, lote.map((h) => hecho(h)));
      pisaSitio(estado.sitios, { mapaId: MAPA, sitio: sitios[dia % sitios.length] });
    }

    const nombresProhibidos = /^(lat|lon|lng|latitud|longitud|coord|coords|coordenada|coordenadas|posicion|posiciones|gps|rastro|traza|trayecto|recorrido|camino|ruta)$/i;
    const relojProhibido = /^(timestamp|epoch|reloj|hora|ahora|now|fechaReal|capturado|capturadoEn|capturadaEn|utc|fecha)$/i;
    for (const [donde, doc] of [['estado', congelaEstado(estado)], ['registro', congelaRegistro(registro)]]) {
      recorreDocumento(doc, (ruta, valor) => {
        const clave = ruta.split('.').pop().replace(/\[\d+\]$/, '');
        assert.ok(!nombresProhibidos.test(clave), `${donde}: ${ruta} guarda una posición de quien juega`);
        assert.ok(!relojProhibido.test(clave), `${donde}: ${ruta} guarda una marca del reloj real`);
        if (typeof valor === 'number') {
          assert.ok(!/^-?\d{1,3}\.\d{4,}$/.test(String(valor)), `${donde}: ${ruta} tiene pinta de coordenada (${valor})`);
        }
      });
    }
    assert.equal(entradasDe(estado.diario).length, 100, 'y las cien salidas sí están, contadas por lo que se oyó');
  });

  test('Un hecho de sitio pisado declara el sitio y el momento, y ninguna coordenada', () => {
    const h = hecho({ tipo: 'sitio-pisado', mapa: MAPA, dia: 4, paso: 12, carga: { sitio: 'Monfrida' } });
    assert.deepEqual(Object.keys(h.carga), ['sitio']);
    assert.deepEqual({ dia: h.dia, paso: h.paso }, { dia: 4, paso: 12 });
    assert.throws(() => hecho({ tipo: 'sitio-pisado', mapa: MAPA, dia: 4, paso: 12, carga: { sitio: 'Monfrida', lat: 42.4, lon: -8.8 } }), /no está declarado/);
    assert.throws(() => pisaSitio({ mapas: {} }, { mapaId: MAPA, sitio: { lat: 42.4, lon: -8.8 } }), /nunca por su coordenada/);
  });

  test('El registro no guarda por dónde se fue de un sitio a otro', () => {
    for (const tipo of TIPOS_DE_HECHO) {
      assert.ok(!/camino|ruta|trayecto|recorrido|posicion|tramo/i.test(tipo), `el tipo "${tipo}" guardaría un camino recorrido`);
      const campos = Object.keys(esquemaDeCarga(tipo).mapa);
      for (const campo of campos) {
        assert.ok(!/^(lat|lon|lng|coord|posicion|camino|ruta|desde|hasta)$/i.test(campo), `la carga de "${tipo}" declara "${campo}"`);
      }
    }
  });

  test('Un campo con la posición de la jugadora lo rechaza el esquema cerrado nombrándolo', () => {
    const doc = congelaEstado(estadoInicial({ semilla: SEMILLA }));
    assert.throws(() => levantaEstado({ ...doc, posicion: { lat: 42.4, lon: -8.8 } }), /posicion/);
    const registro = congelaRegistro(registroInicial());
    assert.throws(() => levantaRegistro({ ...registro, hechos: [{ tipo: 'sitio-pisado', mapa: MAPA, dia: 1, paso: 1, carga: { sitio: 'x', gps: [1, 2] } }] }), /gps/);
  });

  test('La semilla de la partida vive en el estado y no arrastra ninguna coordenada', () => {
    const doc = congelaEstado(estadoInicial({ semilla: SEMILLA }));
    assert.equal(doc.semilla, SEMILLA);
    assert.ok(/^[0-9A-Z]+$/.test(doc.semilla), 'la semilla es la de SPEC-003 tal cual');
    assert.ok(!/-?\d+\.\d+/.test(doc.semilla), 'y no lleva dentro la coordenada de la que salió');
    assert.equal(Object.keys(doc).filter((k) => /coord|lat|lon/i.test(k)).length, 0);
  });

  test('Las cuatro rutas de esta capa no leen ningún sensor, el reloj ni la red', () => {
    for (const ruta of RUTAS) {
      const fuente = readFileSync(ruta, 'utf8');
      const imports = [...fuente.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      for (const dependencia of imports) {
        assert.ok(dependencia.startsWith('.'), `${ruta} importa "${dependencia}", que no es del paquete`);
        assert.ok(!/geoloc|sensor|red|http|fetch/i.test(dependencia), `${ruta} importa "${dependencia}"`);
      }
      const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
      for (const prohibido of ['Date.now', 'new Date', 'Math.random', 'fetch(', 'navigator', 'process.env', 'require(']) {
        assert.ok(!codigo.includes(prohibido), `${ruta} usa ${prohibido}`);
      }
    }
  });
});

describe('El tamaño, que se mide', () => {
  test('Un hecho del registro ocupa menos de 500 bytes', () => {
    // 500 y no 300 por el veredicto §6q: `version-oida` **lleva dentro los hechos
    // estructurados enteros**, que es una decisión declarada de la spec —sin ellos «lo
    // oído» no se puede reconstruir sin reproducir la propagación con reglas que pueden
    // haber cambiado—, así que su tamaño es consecuencia directa de lo que hace
    // funcionar la reconstrucción. Es el tipo caro, y mide 444-471 B contra los 90-140 B
    // de los otros once.
    //
    // Sigue siendo un **tope, no una medida**: si mañana un tipo engorda hasta rozar los
    // 500, este caso se pone rojo y la decisión —subir el número, partir la carga o
    // aceptarlo— vuelve a ser de quien orquesta, no de quien escribe la prueba.
    const ejemplos = {
      'paso-ejecutado': { tipo: 'paso-ejecutado', mapa: MAPA, dia: 1, paso: 1, carga: { n: 1, restoM: 120.5, restoFondoM: 40 } },
      // El vaciado del zurrón (SPEC-042). Es de los baratos y lo es por decisión: no
      // repite los pasos de la reserva, que ya están en el registro con su
      // `paso-ejecutado`, sino entre cuáles iba y cuántas entradas se llegaron a narrar.
      'reserva-vaciada': { tipo: 'reserva-vaciada', mapa: MAPA, dia: 1, paso: 5, carga: { narrados: 5, primerPaso: 1, ultimoPaso: 5 } },
      'sitio-pisado': { tipo: 'sitio-pisado', mapa: MAPA, dia: 1, paso: 1, carga: { sitio: 'Monfrida' } },
      'cara-conocida': hechoDeCaraConocida({}),
      'objeto-obtenido': hechoDeObjeto({}),
      'version-oida': hechoOido({}),
      'aventura-aceptada': { tipo: 'aventura-aceptada', mapa: MAPA, dia: 1, paso: 1, carga: { aventura: 'a1', plantilla: 'entrega-sospechosa' } },
      'aventura-cerrada': { tipo: 'aventura-cerrada', mapa: MAPA, dia: 1, paso: 1, carga: { aventura: 'a1', desenlace: 'bueno' } },
      'aventura-abandonada': { tipo: 'aventura-abandonada', mapa: MAPA, dia: 1, paso: 1, carga: { aventura: 'a1', motivo: 'se dejó' } },
      'decision-en-aventura': { tipo: 'decision-en-aventura', mapa: MAPA, dia: 1, paso: 1, carga: { aventura: 'a1', beat: 'b2', opcion: 'la otra' } },
      'entrega-atendida': { tipo: 'entrega-atendida', mapa: MAPA, dia: 1, paso: 1, carga: { entrega: 'e1', quien: 'regencia' } },
      'entrega-ignorada': { tipo: 'entrega-ignorada', mapa: MAPA, dia: 1, paso: 1, carga: { entrega: 'e1', porque: 'no dio tiempo' } },
      'anclaje-descartado': { tipo: 'anclaje-descartado', mapa: MAPA, dia: 1, paso: 1, carga: { anclaje: 'x1', rol: 'contacto', porque: 'es una casa' } },
      // El deshacer de SPEC-035, que se anota detrás del descarte en lugar de borrarlo.
      // Es el tipo más barato del catálogo justamente porque no repite el motivo: lleva
      // el anclaje y el rol para que la línea se lea sola, y nada más.
      'anclaje-devuelto': { tipo: 'anclaje-devuelto', mapa: MAPA, dia: 1, paso: 1, carga: { anclaje: 'x1', rol: 'contacto' } },
      // Los tres de SPEC-036. El del conocimiento es el que más se repite —uno por
      // elemento que sube y por salida—, así que se mide con la clave más larga que
      // el mundo puede dar: la de un servicio con nombre de verdad, y no con un `x1`.
      'conocimiento-subido': { tipo: 'conocimiento-subido', mapa: MAPA, dia: 1, paso: 1, carga: { elemento: 'servicio:Pousada do Caldeiro Durmido', via: 'boca-de-otro', escalon: 'lo-conoces-bien' } },
      'arranque-cerrado': { tipo: 'arranque-cerrado', mapa: MAPA, dia: 1, paso: 1, carga: { via: 'te-cuentan', marcado: true } },
      'hoja-propia': { tipo: 'hoja-propia', mapa: MAPA, dia: 1, paso: 1, carga: { hoja: 'salida:s-42', asunto: 'entrega-sospechosa@42.40,-8.81#1', lugar: 'Lamivella do Corvo', signo: 'bueno' } },
    };
    assert.deepEqual(Object.keys(ejemplos).sort(), [...TIPOS_DE_HECHO], 'se mide un ejemplo de cada tipo declarado');
    const medidas = Object.entries(ejemplos).map(([tipo, h]) => [tipo, bytesDeHecho(hecho(h))]);
    const pasados = medidas.filter(([, bytes]) => bytes >= PRESUPUESTO_DE_HECHO);
    assert.deepEqual(pasados, [], `estos tipos pasan del presupuesto de ${PRESUPUESTO_DE_HECHO} bytes: ${pasados.map(([t, b]) => `${t} ${b} B`).join(', ')}`);
  });

  test('El registro de una partida de mil días con veinte hechos por día ocupa menos de 6 MB', () => {
    const registro = registroInicial();
    for (const h of milDiasDeHechos()) registro.hechos.push(hecho(h));
    assert.equal(cuantosHechos(registro), 20000);
    const bytes = bytesDe(textoCanonico(congelaRegistro(registro)));
    assert.ok(bytes < PRESUPUESTO_DE_REGISTRO, `el registro de mil días ocupa ${(bytes / MB).toFixed(2)} MB y el presupuesto son 6 MB`);
  });

  test('El estado de esa partida sin los textos del narrador ocupa menos de 2 MB', () => {
    const registro = registroInicial();
    for (const h of milDiasDeHechos()) registro.hechos.push(hecho(h));
    const { estado } = reconstruye({ registro, semilla: SEMILLA });
    const doc = congelaEstado(estado);
    assert.deepEqual(doc.areas.textos, { textos: {} }, 'se mide sin los textos del narrador, que viven aparte');
    const bytes = bytesDe(textoCanonico(doc));
    assert.ok(bytes < PRESUPUESTO_DE_ESTADO, `el estado de mil días ocupa ${(bytes / MB).toFixed(2)} MB y el presupuesto son 2 MB`);
    assert.equal(entradasDe(estado.diario).length, 1000, 'con mil entradas de diario dentro');
  });
});

/**
 * Mil días de veinte hechos: dieciséis pasos, dos sitios pisados, una cara conocida
 * y una versión oída. Es el reparto de una salida normal y no el peor caso: lo que
 * se mide es una partida larga, no una partida rara.
 */
function milDiasDeHechos() {
  const sitios = ['Monfrida', 'Vilanova', 'Cadaval', 'Peiteiro', 'Cambados'];
  const puestos = ['regencia', 'vigilancia', 'vecindad'];
  const lote = [];
  for (let dia = 1; dia <= 1000; dia++) {
    const sitio = sitios[dia % sitios.length];
    for (let k = 0; k < 16; k++) {
      const n = (dia - 1) * 16 + k + 1;
      lote.push({ tipo: 'paso-ejecutado', mapa: MAPA, dia, paso: n, carga: { n, restoM: 120.5, restoFondoM: 40 } });
    }
    lote.push({ tipo: 'sitio-pisado', mapa: MAPA, dia, paso: dia * 16, carga: { sitio } });
    lote.push({ tipo: 'sitio-pisado', mapa: MAPA, dia, paso: dia * 16, carga: { sitio: sitios[(dia + 1) % sitios.length] } });
    lote.push(hechoDeCaraConocida({ dia, paso: dia * 16, sitio, puesto: puestos[dia % puestos.length] }));
    lote.push(hechoOido({ dia, paso: dia * 16, nucleo: sitio, suceso: `s${dia}` }));
  }
  return lote;
}
