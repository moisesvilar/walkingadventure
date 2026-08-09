// SPEC-019 · El recado suelto: la entrada de la cola que comparte la lista de hoy con
// las aventuras para que un día sin aventura del oficio propio no sea un día vacío
// (RF-QUEST-016, que el PRD marca «⚠ sin escenario»).
//
// RF-QUEST-016 no tiene ni un escenario en docs/testing.md, así que casi todo lo de
// aquí va declarado como hueco de la batería en test/spec-test-map.json. Los dos
// nombres que sí son de la batería —«Se ofrecen tres aventuras como mucho» y «Un día
// con una sola aventura no es un día roto»— son `@app` y de aquí sale solo la mitad
// que decide cuántas entradas hay y cuál cae fuera.
//
// El precalentamiento se mide **donde puede ponerse rojo**: en los mundos pequeños,
// que es donde el catálogo no llega y donde el recado tiene que salvar el día. Y el
// último caso comprueba que mide algo, poniendo la cola a cero.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ESTADOS_DE_ENTRADA,
  aceptaRecado,
  atiende,
  cierraSalida,
  entradaDe,
  estadoDeEntregas,
  pendientes,
  registraOferta,
  siembraLaCola,
} from '../../packages/nucleo/partida/entregas.js';
import { MEDIDA_DEL_RECADO, TOPE_DE_LA_LISTA, listaDeHoy, recadoSuelto } from '../../packages/nucleo/partida/recados.js';
import * as moduloDeRecados from '../../packages/nucleo/partida/recados.js';
import { creaMicroEncuentros } from '../../packages/nucleo/partida/microencuentros.js';
import { correPrologo } from '../../packages/nucleo/partida/prologo.js';
import { IDS_DE_TAMANO } from '../../packages/nucleo/partida/salida.js';
import { OFICIOS } from '../../packages/nucleo/quests/oficios.js';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { MAPA, colaDe, mundoDeSitios, oportunidad } from './entrega-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import { LOS_CUATRO, PARTIDA, TRAMO, mundoDeReferencia } from './prologo-de-prueba.mjs';
import { codigoDe } from './rumor-de-prueba.mjs';

/** El mapa sobre el que se corre el prólogo de un mundo de referencia. */
const REFERENCIA = 'referencia';

/** La cola que dejó sembrada el prólogo de un mundo congelado. */
async function colaSembradaDe(nombre, semilla = '1') {
  const mundo = await mundoDeReferencia(nombre, semilla);
  const resultado = correPrologo({ semilla: SEMILLA_A, mapaId: REFERENCIA, mundo, tramoM: TRAMO, partida: PARTIDA });
  const estado = estadoDeEntregas();
  siembraLaCola(estado, { mapaId: REFERENCIA, entradas: resultado.entregas });
  return { mundo, resultado, estado };
}

describe('El recado suelto comparte lista', () => {
  test('Con al menos una oportunidad pendiente, el recado suelto devuelve exactamente una entrada', () => {
    const estado = colaDe(1);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    assert.ok(recado, 'la cola tiene una pendiente y no sale recado');
    assert.equal(typeof recado.entrada, 'string');
    assert.ok(!Array.isArray(recado), 'el recado suelto devuelve una lista');
  });

  test('El recado declara la medida «un momento» y ninguna cifra', () => {
    const estado = colaDe(1);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    assert.equal(recado.medida, MEDIDA_DEL_RECADO);
    assert.equal(MEDIDA_DEL_RECADO, 'un-momento');
    for (const cifra of ['tiempo', 'tiempoAprox', 'minutos', 'distancia', 'metros', 'km']) {
      assert.ok(!(cifra in recado), `el recado trae "${cifra}"`);
    }
  });

  test('La medida del recado no entra en el enumerado de tamaños de salida', () => {
    // Un recado no es una aventura y no tiene presupuesto de beats: meterlo en el
    // enumerado obligaría a inventarle un rango que después alguien comprobaría.
    assert.ok(!IDS_DE_TAMANO.includes(MEDIDA_DEL_RECADO), 'la medida del recado ha entrado en los tamaños de salida');
    assert.deepEqual(IDS_DE_TAMANO.slice().sort(), ['aventura', 'jornada', 'paseo']);
  });

  test('Con doce oportunidades pendientes el recado sigue siendo uno solo', () => {
    const estado = colaDe(12);
    assert.equal(pendientes(estado, { mapaId: MAPA }).length, 12);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    assert.equal(typeof recado.entrada, 'string');
  });

  test('La cola sin ninguna oportunidad pendiente devuelve vacío y no un error', () => {
    const estado = estadoDeEntregas();
    assert.equal(recadoSuelto({ estado, mapaId: MAPA, dia: 1 }), null);
  });

  test('El recado no se filtra por oficio', () => {
    const estado = colaDe(1);
    // No hay por dónde filtrarlo: la firma no recibe oficio, y el módulo no lo
    // nombra. Filtrarlo lo dejaría vacío justo los días que existe para salvar.
    const codigo = codigoDe(fuente('packages/nucleo/partida/recados.js'));
    assert.ok(!codigo.includes('oficio'), 'el recado suelto conoce el oficio');
    for (const oficio of OFICIOS) {
      const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
      assert.ok(recado, `el oficio "${oficio}" se queda sin recado`);
    }
  });

  test('Un día con una sola aventura no es un día roto', () => {
    // La mitad de núcleo del escenario: sin ninguna plantilla que castee para este
    // oficio, la lista de hoy no sale vacía —la ocupa el recado suelto— y nada de lo
    // que sale de aquí se disculpa por ello. La pantalla es de la fila 28.
    const estado = colaDe(1);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    const lista = listaDeHoy({ aventuras: [], recado });
    assert.equal(lista.entradas.length, 1);
    assert.equal(lista.entradas[0].entrada, recado.entrada);

    const texto = JSON.stringify(lista).toLowerCase();
    for (const disculpa of ['no se pudo', 'lo sentimos', 'no hay aventuras', 'vuelve mañana', 'faltó']) {
      assert.ok(!texto.includes(disculpa), `la lista dice "${disculpa}"`);
    }
  });

  test('Se ofrecen tres aventuras como mucho', () => {
    // La mitad de núcleo: el recado **ocupa** un sitio del tope y nunca añade un
    // cuarto. Con ocho aventuras que castean y un recado salen tres, no cuatro.
    const estado = colaDe(1);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    const ocho = Array.from({ length: 8 }, (_, k) => ({ plantilla: `plantilla-${k}` }));

    assert.equal(TOPE_DE_LA_LISTA, 3);
    assert.equal(listaDeHoy({ aventuras: ocho }).entradas.length, 3);
    const conRecado = listaDeHoy({ aventuras: ocho, recado });
    assert.equal(conRecado.entradas.length, 3, 'el recado ha añadido un cuarto sitio');
    assert.equal(conRecado.entradas[2].entrada, recado.entrada);
    assert.equal(conRecado.tope, 3);
    assert.equal(recado.ocupaSitioDeLaLista, true);
  });

  test('Aparecer en la lista y no elegirse no consume ninguna oferta', () => {
    const estado = colaDe(2);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    const entrada = entradaDe(estado, { mapaId: MAPA, id: recado.entrada });
    assert.equal(entrada.estado, ESTADOS_DE_ENTRADA.PENDIENTE);
    assert.deepEqual(entrada.ofertas, [], 'aparecer en la lista ha quemado una oferta');
  });

  test('Un recado que apareció y no se eligió rota, y al día siguiente se ofrece la otra', () => {
    const estado = colaDe(2);
    const primero = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    const segundo = recadoSuelto({ estado, mapaId: MAPA, dia: 2 });
    assert.notEqual(segundo.entrada, primero.entrada, 'la misma tarjeta se repite dos días seguidos');
    // Y pedirlo dos veces el mismo día devuelve el mismo, que es lo que hace
    // idempotente componer la lista.
    assert.equal(recadoSuelto({ estado, mapaId: MAPA, dia: 2 }).entrada, segundo.entrada);
  });

  test('Un recado aceptado y no atendido consume una oferta al cerrar la salida', () => {
    const estado = colaDe(1);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    aceptaRecado(estado, { mapaId: MAPA, id: recado.entrada, salida: 'salida-1' });
    const sedimentadas = cierraSalida(estado, { mapaId: MAPA, salida: 'salida-1', paso: 1 });
    assert.deepEqual(sedimentadas, [], 'una sola oferta ha sedimentado la entrada');
    const entrada = entradaDe(estado, { mapaId: MAPA, id: recado.entrada });
    assert.equal(entrada.ofertas.length, 1);
    assert.equal(entrada.ofertas[0].via, 'lista');
    assert.equal(entrada.ofertas[0].sitio, null, 'una lista no tiene sitio y se le ha inventado uno');
    assert.equal(entrada.estado, ESTADOS_DE_ENTRADA.PENDIENTE);
  });

  test('Un recado aceptado y atendido queda «atendida» y sale de la cola', () => {
    const estado = colaDe(1);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    aceptaRecado(estado, { mapaId: MAPA, id: recado.entrada, salida: 'salida-1' });
    const atendida = atiende(estado, { mapaId: MAPA, id: recado.entrada });
    assert.equal(atendida.estado, ESTADOS_DE_ENTRADA.ATENDIDA);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('Un recado aceptado dos días seguidos y nunca atendido sedimenta a la segunda', () => {
    const estado = colaDe(1);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    aceptaRecado(estado, { mapaId: MAPA, id: recado.entrada, salida: 'salida-1' });
    cierraSalida(estado, { mapaId: MAPA, salida: 'salida-1', paso: 1 });
    aceptaRecado(estado, { mapaId: MAPA, id: recado.entrada, salida: 'salida-2' });
    const sedimentadas = cierraSalida(estado, { mapaId: MAPA, salida: 'salida-2', paso: 2 });
    assert.deepEqual(sedimentadas.map((e) => e.id), [recado.entrada]);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('El lugar de un recado aceptado se resuelve en marcha con las reglas del micro-encuentro', () => {
    // Aceptarlo desde la lista no le da lugar: lo resuelve el mismo disparo, con el
    // mismo coste cero —un sitio fuera del trazado vigente no es candidato— y la
    // misma escena declarada.
    const estado = colaDe(1);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    aceptaRecado(estado, { mapaId: MAPA, id: recado.entrada, salida: 'salida-1' });
    assert.equal(entradaDe(estado, { mapaId: MAPA, id: recado.entrada }).sitio, null, 'aceptar un recado le ha resuelto el lugar');

    const mundo = mundoDeSitios();
    const micro = creaMicroEncuentros({ mundo, mapaId: MAPA, estado });
    assert.equal(micro.atraviesa({ sitio: 'O Cruceiro Branco', salida: 'salida-1', paso: 1, trazado: ['A Fonte Vella'] }), null, 'ha resuelto el lugar fuera del trazado');
    const aviso = micro.atraviesa({ sitio: 'A Fonte Vella', salida: 'salida-1', paso: 1, trazado: ['A Fonte Vella'] });
    assert.equal(aviso.entrada, recado.entrada);
    assert.equal(aviso.escena, recado.escena);
    assert.equal(aviso.cuentaEnElPresupuesto, false);
  });

  test('El recado entrega la referencia a su texto de plantilla y ninguna cadena redactada', () => {
    const estado = colaDe(1);
    const recado = recadoSuelto({ estado, mapaId: MAPA, dia: 1 });
    assert.deepEqual(Object.keys(recado.texto), ['referencia']);
    assert.ok(!/\s/.test(recado.texto.referencia), `el recado redacta el texto "${recado.texto.referencia}"`);
    for (const [nombre, valor] of Object.entries(moduloDeRecados)) {
      if (typeof valor === 'string') assert.ok(!/\s/.test(valor), `el recado exporta el texto "${valor}" en "${nombre}"`);
    }
  });

  test('El día del recado es del calendario de la partida y nunca una marca del reloj real', () => {
    const estado = colaDe(1);
    for (const dia of [null, undefined, -1, 1.5, '1', Date.now()]) {
      if (Number.isInteger(dia) && dia >= 0) continue;
      assert.throws(() => recadoSuelto({ estado, mapaId: MAPA, dia }), /día|dia/i);
    }
    const codigo = codigoDe(fuente('packages/nucleo/partida/recados.js'));
    for (const reloj of ['Date.now', 'new Date', 'setTimeout']) assert.ok(!codigo.includes(reloj), `el recado usa ${reloj}`);
  });

  test('La lista de hoy se compone sobre una lista de aventuras y un tope entero positivo', () => {
    assert.throws(() => listaDeHoy({ aventuras: 'tres' }), /aventuras|lista/);
    assert.throws(() => listaDeHoy({ aventuras: [], tope: 0 }), /tope/);
    assert.throws(() => listaDeHoy({ aventuras: [], tope: 2.5 }), /tope/);
    assert.deepEqual(listaDeHoy({ aventuras: [] }).entradas, []);
  });
});

describe('El precalentamiento tiene que medirse', () => {
  for (const nombre of LOS_CUATRO) {
    test(`El prólogo de ${nombre} deja al menos una oportunidad pendiente en la cola`, async () => {
      const { estado } = await colaSembradaDe(nombre);
      const cola = pendientes(estado, { mapaId: REFERENCIA });
      assert.ok(cola.length >= 1, `${nombre} corre su prólogo y no deja ni una oportunidad: el día sin aventura se queda vacío`);
      for (const e of cola) assert.ok(e.escena, `${e.id} llega sin escena declarada y no podrá resolver lugar`);
    });
  }

  test('En barrio-tres-calles el recado suelto sale para cada uno de los cuatro oficios', async () => {
    const { estado } = await colaSembradaDe('barrio-tres-calles');
    for (const oficio of OFICIOS) {
      const recado = recadoSuelto({ estado, mapaId: REFERENCIA, dia: 1 });
      assert.ok(recado, `el oficio "${oficio}" se queda sin recado en el mundo más pobre`);
      assert.equal(recado.medida, MEDIDA_DEL_RECADO);
      assert.equal(recado.ocupaSitioDeLaLista, true);
    }
  });

  test('En suelo-250m la lista de hoy no sale vacía para un oficio sin ninguna plantilla que castee', async () => {
    const { estado } = await colaSembradaDe('suelo-250m');
    const recado = recadoSuelto({ estado, mapaId: REFERENCIA, dia: 1 });
    const lista = listaDeHoy({ aventuras: [], recado });
    assert.ok(lista.entradas.length >= 1, 'el mínimo del proyecto deja el día vacío');
  });

  test('Un mapa cuyo prólogo no dejó ninguna oportunidad compone la lista vacía, y el criterio se pone rojo', async () => {
    // Es la comprobación de que los tres criterios anteriores miden algo: con la cola
    // a cero no hay recado, y la lista sin aventuras casteadas sale vacía.
    const estado = estadoDeEntregas();
    const recado = recadoSuelto({ estado, mapaId: REFERENCIA, dia: 1 });
    assert.equal(recado, null);
    assert.deepEqual(listaDeHoy({ aventuras: [], recado }).entradas, []);
  });

  test('Las entradas sembradas por el prólogo tienen la misma forma que las de un paso', async () => {
    const { estado } = await colaSembradaDe('costero');
    const sembrada = pendientes(estado, { mapaId: REFERENCIA })[0];
    const deUnPaso = pendientes(colaDe(1), { mapaId: MAPA })[0];
    assert.deepEqual(Object.keys(sembrada).sort(), Object.keys(deUnPaso).sort(), 'la entrada del prólogo tiene otra forma');
    assert.equal(sembrada.estado, deUnPaso.estado);
    assert.deepEqual(sembrada.ofertas, deUnPaso.ofertas);
  });

  test('Una entrada sembrada por el prólogo sigue el mismo ciclo de dos ofertas y la misma sedimentación', async () => {
    const { estado } = await colaSembradaDe('costero');
    const [entrada] = pendientes(estado, { mapaId: REFERENCIA });
    registraOferta(estado, { mapaId: REFERENCIA, id: entrada.id, salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1 });
    cierraSalida(estado, { mapaId: REFERENCIA, salida: 'salida-1', paso: 1 });
    assert.equal(entradaDe(estado, { mapaId: REFERENCIA, id: entrada.id }).estado, ESTADOS_DE_ENTRADA.PENDIENTE);
    registraOferta(estado, { mapaId: REFERENCIA, id: entrada.id, salida: 'salida-2', sitio: 'O Cruceiro Branco', paso: 2 });
    const sedimentadas = cierraSalida(estado, { mapaId: REFERENCIA, salida: 'salida-2', paso: 2 });
    assert.deepEqual(sedimentadas.map((e) => e.id), [entrada.id]);
  });

  test('El prólogo del mismo mundo con la misma semilla siembra una cola idéntica', async () => {
    const una = await colaSembradaDe('costero');
    const otra = await colaSembradaDe('costero');
    assert.deepEqual(
      pendientes(una.estado, { mapaId: REFERENCIA }).map((e) => e.id),
      pendientes(otra.estado, { mapaId: REFERENCIA }).map((e) => e.id),
    );
    assert.deepEqual(una.resultado.entregas, otra.resultado.entregas);
  });

  test('Una cola sembrada que se vacía vuelve a llenarse con lo que producen los pasos, sin resiembra del prólogo', async () => {
    const { estado } = await colaSembradaDe('costero');
    const sembradas = pendientes(estado, { mapaId: REFERENCIA }).map((e) => e.id);
    for (const id of sembradas) atiende(estado, { mapaId: REFERENCIA, id });
    assert.deepEqual(pendientes(estado, { mapaId: REFERENCIA }), []);

    colaDe(2, { mapaId: REFERENCIA, estado, desde: 40 });
    const nuevas = pendientes(estado, { mapaId: REFERENCIA });
    assert.equal(nuevas.length, 2);
    for (const e of nuevas) assert.ok(!sembradas.includes(e.id), 'el prólogo ha resembrado la cola');
  });
});
