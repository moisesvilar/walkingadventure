// SPEC-019 · La cola de entregas: sus dos tipos, la noticia que sedimenta dentro del
// mismo paso, el ciclo de dos ofertas de la oportunidad, su sedimentación sin
// reproche y el segundo productor del motor de pasos.
//
// Todo entra inyectado: el mapa, el estado de la cola, lo que se cuenta en los
// núcleos y la fuente de producciones del mundo. **Ninguna prueba de aquí lee el
// reloj del sistema ni espera a que pase el tiempo**: el cooldown de esta capa se
// cuenta en pasos del mundo precisamente para que el calendario no entre, así que una
// prueba con reloj estaría afirmando lo contrario de lo que la spec promete.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás
// van declarados como huecos de la batería en test/spec-test-map.json: la propia
// SPEC-019 enumera ocho, y RF-QUEST-016 no tiene ni uno.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../../packages/nucleo/core/rng.js';
import {
  ESTADOS_DE_ENTRADA,
  IDS_DE_ENTREGA,
  ID_DEL_PRODUCTOR,
  TIPOS_DE_ENTREGA,
  TOPE_DE_OFERTAS,
  VIAS_DE_OFERTA,
  admiteOferta,
  aceptaRecado,
  atiende,
  cierraSalida,
  congelaEntregas,
  creaColaDeEntregas,
  encola,
  entradaDe,
  entradaDeEntrega,
  entregasDeMapa,
  estadoDeEntregas,
  levantaEntregas,
  noticias,
  pendientes,
  registraOferta,
  registraOfertaDeLista,
  siembraLaCola,
  yaSaltoEnElPaso,
} from '../../packages/nucleo/partida/entregas.js';
import * as moduloDeEntregas from '../../packages/nucleo/partida/entregas.js';
import { IDS_DE_EFECTO, TIPOS_DE_EFECTO } from '../../packages/nucleo/partida/efectos.js';
import { AREAS_CON_ESTADO, congelaEstado, estadoInicial } from '../../packages/nucleo/partida/estado.js';
import { entradasDe } from '../../packages/nucleo/partida/diario.js';
import { estadoDeNucleos, loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { creaMotorDePasos, estadoDePasos } from '../../packages/nucleo/partida/pasos.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { generaCelda } from '../../packages/nucleo/world/celda.js';
import { SEMILLA_A, consultaDeFixture } from './celda-de-prueba.mjs';
import { MAPA, OTRO_MAPA, colaCon, colaDe, noticia, oportunidad } from './entrega-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import { rejillaDe } from './partida-de-prueba.mjs';
import { codigoDe } from './rumor-de-prueba.mjs';

/** Los tres módulos que SPEC-019 entrega. Varias pruebas los inspeccionan como texto. */
const MODULOS_DE_LA_COLA = [
  'packages/nucleo/partida/entregas.js',
  'packages/nucleo/partida/microencuentros.js',
  'packages/nucleo/partida/recados.js',
];

/** Un productor espía que no produce nada y guarda el azar que le dieron. */
function productorEspia(id, sorteos = []) {
  return {
    id,
    produce: (n, azar) => {
      sorteos.push(azar());
      return [];
    },
  };
}

/** Las dos ofertas de una oportunidad, en salidas y sitios distintos, hasta que sedimenta. */
function ofreceDosVeces(estado, id, { mapaId = MAPA } = {}) {
  registraOferta(estado, { mapaId, id, salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1 });
  cierraSalida(estado, { mapaId, salida: 'salida-1', paso: 1 });
  registraOferta(estado, { mapaId, id, salida: 'salida-2', sitio: 'O Cruceiro Branco', paso: 2 });
  return cierraSalida(estado, { mapaId, salida: 'salida-2', paso: 2 });
}

describe('La cola y sus dos tipos', () => {
  test('Un mapa recién creado y sin prólogo devuelve la cola vacía y no falla', () => {
    const estado = estadoDeEntregas();
    assert.deepEqual(pendientes(estado, { mapaId: 'nuevo' }), []);
    assert.deepEqual(noticias(estado, { mapaId: 'nuevo' }), []);
    assert.deepEqual(entregasDeMapa(estado, 'nuevo').entradas, []);
  });

  test('Un paso que produce una entrega deja una entrada con su tipo, su procedencia y su escena', () => {
    const estado = estadoDeEntregas();
    const entrada = encola(estado, { mapaId: MAPA, produccion: oportunidad({ asunto: 'tejas-que-tiró-el-viento', escena: 'misterio', paso: 7 }) });
    assert.equal(entrada.tipo, TIPOS_DE_ENTREGA.OPORTUNIDAD);
    assert.equal(entrada.escena, 'misterio');
    assert.deepEqual(entrada.procedencia, { mapa: MAPA, paso: 7 });
  });

  test('La procedencia de una entrada nombra el mapa y el paso que la produjo', () => {
    const estado = colaDe(1, { desde: 4 });
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    assert.equal(entrada.procedencia.mapa, MAPA);
    assert.equal(entrada.procedencia.paso, 4);
  });

  test('El enumerado de tipos de entrega tiene exactamente dos valores', () => {
    assert.deepEqual(IDS_DE_ENTREGA, ['noticia', 'oportunidad']);
    assert.equal(Object.keys(TIPOS_DE_ENTREGA).length, 2);
    assert.ok(Object.isFrozen(TIPOS_DE_ENTREGA), 'el enumerado se puede ampliar en caliente');
  });

  test('Una entrada con un tipo que no está en el enumerado falla nombrando el tipo y los dos válidos', () => {
    const estado = estadoDeEntregas();
    assert.throws(
      () => encola(estado, { mapaId: MAPA, produccion: { tipo: 'aviso', asunto: 'algo', paso: 1 } }),
      (e) => e instanceof Error && e.message.includes('aviso') && e.message.includes('noticia') && e.message.includes('oportunidad'),
    );
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('Una oportunidad sin escena declarada falla nombrando la entrada en vez de suponerle una', () => {
    const estado = estadoDeEntregas();
    assert.throws(
      () => encola(estado, { mapaId: MAPA, produccion: { tipo: 'oportunidad', asunto: 'setas-de-temporada', paso: 1 } }),
      (e) => e instanceof Error && e.message.includes('setas-de-temporada') && /escena/.test(e.message),
    );
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('Una oportunidad recién encolada está pendiente y con cero ofertas', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    assert.equal(entrada.estado, ESTADOS_DE_ENTRADA.PENDIENTE);
    assert.deepEqual(entrada.ofertas, []);
  });

  test('Lo pendiente devuelve solo oportunidades, en un orden declarado', () => {
    const nucleos = estadoDeNucleos();
    const estado = estadoDeEntregas();
    encola(estado, { mapaId: MAPA, produccion: noticia({ asunto: 'burro-perdido', paso: 3 }), nucleos });
    encola(estado, { mapaId: MAPA, produccion: oportunidad({ asunto: 'zeta', paso: 5 }) });
    encola(estado, { mapaId: MAPA, produccion: oportunidad({ asunto: 'alfa', paso: 2 }) });

    const cola = pendientes(estado, { mapaId: MAPA });
    assert.deepEqual(cola.map((e) => e.tipo), ['oportunidad', 'oportunidad']);
    // El orden es el declarado —primero el paso, después la identidad—, no el de
    // inserción ni el de recorrido de ningún Set.
    assert.deepEqual(cola.map((e) => e.asunto), ['alfa', 'zeta']);
  });

  test('Dos consultas de lo pendiente desde el mismo estado dan el mismo orden', () => {
    const estado = colaDe(6);
    const una = pendientes(estado, { mapaId: MAPA }).map((e) => e.id);
    const otra = pendientes(estado, { mapaId: MAPA }).map((e) => e.id);
    assert.deepEqual(una, otra);
  });

  test('La cola es por mapa y lo que produjo un mundo no sale al paso en el otro', () => {
    const estado = colaDe(2);
    colaDe(1, { mapaId: OTRO_MAPA, estado, desde: 50 });
    assert.equal(pendientes(estado, { mapaId: MAPA }).length, 2);
    assert.equal(pendientes(estado, { mapaId: OTRO_MAPA }).length, 1);
    assert.equal(pendientes(estado, { mapaId: OTRO_MAPA })[0].asunto, 'encargo-50');
  });

  test('La cola viaja con la partida y nunca dentro del documento congelado de una celda', async () => {
    assert.ok(AREAS_CON_ESTADO.includes('entregas'), 'la cola no es un área del estado de la partida');
    const rejilla = rejillaDe('barrio-tres-calles');
    const registro = await generaCelda({
      rejilla,
      semilla: SEMILLA_A,
      mapaId: rejilla.id,
      celda: { i: 0, j: 0 },
      consultaOsm: consultaDeFixture('barrio-tres-calles'),
    });
    const documento = textoDeCelda(registro);
    for (const palabra of ['entregas', 'oportunidad', 'sedimentada', 'ofertas']) {
      assert.ok(!documento.includes(palabra), `el documento de la celda habla de "${palabra}"`);
    }
  });

  test('Una cola serializada y vuelta a cargar conserva estados, ofertas y orden', () => {
    const estado = colaDe(3);
    const ids = pendientes(estado, { mapaId: MAPA }).map((e) => e.id);
    registraOferta(estado, { mapaId: MAPA, id: ids[0], salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1 });
    aceptaRecado(estado, { mapaId: MAPA, id: ids[1], salida: 'salida-1' });
    atiende(estado, { mapaId: MAPA, id: ids[2] });

    const doc = congelaEntregas(estado);
    const vuelto = levantaEntregas(JSON.parse(JSON.stringify(doc)));
    assert.equal(JSON.stringify(congelaEntregas(vuelto)), JSON.stringify(doc));
    assert.deepEqual(pendientes(vuelto, { mapaId: MAPA }).map((e) => e.id), pendientes(estado, { mapaId: MAPA }).map((e) => e.id));
    assert.deepEqual(entradaDe(vuelto, { mapaId: MAPA, id: ids[0] }).ofertas, entradaDe(estado, { mapaId: MAPA, id: ids[0] }).ofertas);
  });

  test('Una entrada que vuelve con un tipo o un estado que no existen falla nombrándolo', () => {
    const doc = congelaEntregas(colaDe(1));
    const conTipo = JSON.parse(JSON.stringify(doc));
    conTipo.mapas[MAPA].entradas[0].tipo = 'aviso';
    assert.throws(() => levantaEntregas(conTipo), /aviso/);
    const conEstado = JSON.parse(JSON.stringify(doc));
    conEstado.mapas[MAPA].entradas[0].estado = 'fallada';
    assert.throws(() => levantaEntregas(conEstado), /fallada/);
  });

  test('Una entrada que no existe se pide por su identidad y falla nombrándola', () => {
    const estado = colaDe(1);
    assert.throws(() => entradaDe(estado, { mapaId: MAPA, id: 'no-existe' }), /no-existe/);
  });
});

describe('Las noticias sedimentan de inmediato', () => {
  /** Una noticia encolada con lo que se cuenta en los núcleos ya puesto. */
  function conNoticia({ asunto = 'burro-perdido', nucleo = 'Vilaboa', paso = 1 } = {}) {
    const estado = estadoDeEntregas();
    const nucleos = estadoDeNucleos();
    const entrada = encola(estado, { mapaId: MAPA, produccion: noticia({ asunto, nucleo, paso }), nucleos });
    return { estado, nucleos, entrada };
  }

  test('Una noticia ya está sedimentada al terminar el paso que la produjo', () => {
    const { entrada } = conNoticia();
    assert.equal(entrada.estado, ESTADOS_DE_ENTRADA.SEDIMENTADA);
  });

  test('Una noticia sedimentada no aparece en lo pendiente', () => {
    const { estado } = conNoticia();
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('Una noticia sedimentada sigue disponible en lo que se cuenta en su núcleo', () => {
    const { nucleos } = conNoticia({ nucleo: 'Vilaboa' });
    assert.equal(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilaboa' }).length, 1);
  });

  test('Un mapa con cincuenta noticias y ninguna oportunidad deja lo pendiente vacío', () => {
    const estado = estadoDeEntregas();
    const nucleos = estadoDeNucleos();
    for (let k = 0; k < 50; k++) {
      encola(estado, { mapaId: MAPA, produccion: noticia({ asunto: 'burro-perdido', nucleo: `Aldea ${k % 5}`, paso: k }), nucleos });
    }
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
    assert.equal(noticias(estado, { mapaId: MAPA }).length, 50);
  });

  test('Una noticia no tiene ninguna oferta registrada y el ciclo de dos ofertas no le aplica', () => {
    const { estado, entrada } = conNoticia();
    assert.deepEqual(entrada.ofertas, []);
    assert.equal(admiteOferta(entrada, { salida: 'salida-1', sitio: 'A Fonte Vella' }), false);
    assert.equal(entradaDe(estado, { mapaId: MAPA, id: entrada.id }).ofertas.length, 0);
  });

  test('Intentar ofrecer una noticia falla nombrando el tipo en vez de ofrecerla', () => {
    const { estado, entrada } = conNoticia();
    assert.throws(
      () => registraOferta(estado, { mapaId: MAPA, id: entrada.id, salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1 }),
      (e) => e instanceof Error && e.message.includes('noticia'),
    );
  });

  test('Un mes sin abrir la app deja todas las noticias sedimentadas y consultables, sin ninguna caducada', () => {
    // Un mes no es ningún dato para esta capa: no hay operación que reciba días y no
    // hay ninguna marca de tiempo dentro de una entrada. Se afirma sobre las dos
    // cosas, porque una caducidad se cuela por cualquiera de ellas.
    const estado = estadoDeEntregas();
    const nucleos = estadoDeNucleos();
    for (let k = 0; k < 12; k++) encola(estado, { mapaId: MAPA, produccion: noticia({ asunto: 'burro-perdido', nucleo: 'Vilaboa', paso: k }), nucleos });
    const todas = noticias(estado, { mapaId: MAPA });
    assert.equal(todas.length, 12);
    for (const n of todas) {
      assert.equal(n.estado, ESTADOS_DE_ENTRADA.SEDIMENTADA);
      assert.ok(!('caduca' in n) && !('expira' in n) && !('fecha' in n), `la noticia ${n.id} lleva una caducidad`);
    }
    const codigo = codigoDe(fuente('packages/nucleo/partida/entregas.js'));
    for (const reloj of ['Date.now', 'new Date', 'setTimeout', 'setInterval']) {
      assert.ok(!codigo.includes(reloj), `la cola usa ${reloj}`);
    }
  });
});

describe('Una oportunidad ignorada se ofrece una segunda vez', () => {
  test('Una oportunidad ignorada se ofrece una segunda vez', () => {
    // El escenario de la batería, literal, en la mitad que es de núcleo: se ofrece,
    // se ignora, se le ofrece una vez más en otra salida y en otro sitio, y si
    // vuelve a ignorarla sedimenta sin volver a ofrecerse. El aviso y su háptico son
    // de la fila 29.
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });

    registraOferta(estado, { mapaId: MAPA, id: entrada.id, salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1 });
    cierraSalida(estado, { mapaId: MAPA, salida: 'salida-1', paso: 1 });
    const trasLaPrimera = entradaDe(estado, { mapaId: MAPA, id: entrada.id });
    assert.equal(trasLaPrimera.ofertas.length, 1);
    assert.equal(trasLaPrimera.estado, ESTADOS_DE_ENTRADA.PENDIENTE, 'una oferta ignorada ya la ha sacado de la cola');

    // Otro día y otro sitio: las dos condiciones, y las dos por separado.
    assert.equal(admiteOferta(trasLaPrimera, { salida: 'salida-1', sitio: 'O Cruceiro Branco' }), false, 'se le ofrece dos veces en la misma salida');
    assert.equal(admiteOferta(trasLaPrimera, { salida: 'salida-2', sitio: 'A Fonte Vella' }), false, 'se le ofrece dos veces en el mismo sitio');
    assert.equal(admiteOferta(trasLaPrimera, { salida: 'salida-2', sitio: 'O Cruceiro Branco' }), true);

    registraOferta(estado, { mapaId: MAPA, id: entrada.id, salida: 'salida-2', sitio: 'O Cruceiro Branco', paso: 2 });
    const sedimentadas = cierraSalida(estado, { mapaId: MAPA, salida: 'salida-2', paso: 2 });
    assert.deepEqual(sedimentadas.map((e) => e.id), [entrada.id]);
    assert.equal(entradaDe(estado, { mapaId: MAPA, id: entrada.id }).estado, ESTADOS_DE_ENTRADA.SEDIMENTADA);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('Una oportunidad con una oferta vuelve a estar pendiente hasta que sale otro día', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    registraOferta(estado, { mapaId: MAPA, id: entrada.id, salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1 });
    cierraSalida(estado, { mapaId: MAPA, salida: 'salida-1', paso: 1 });
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }).map((e) => e.id), [entrada.id]);
    assert.equal(pendientes(estado, { mapaId: MAPA })[0].ofertas.length, 1);
  });

  test('El sitio de la primera oferta no es candidato para la segunda, y sin otro no se ofrece', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    registraOferta(estado, { mapaId: MAPA, id: entrada.id, salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1 });
    cierraSalida(estado, { mapaId: MAPA, salida: 'salida-1', paso: 1 });

    const tras = entradaDe(estado, { mapaId: MAPA, id: entrada.id });
    assert.equal(admiteOferta(tras, { salida: 'salida-2', sitio: 'A Fonte Vella' }), false);
    // Y sigue pendiente con la que tenía: no se le gasta la segunda por pasar por
    // donde ya se le ofreció.
    assert.equal(tras.estado, ESTADOS_DE_ENTRADA.PENDIENTE);
    assert.equal(tras.ofertas.length, 1);
  });

  test('Una oportunidad sedimentada no se ofrece nunca más y no aparece en lo pendiente', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    ofreceDosVeces(estado, entrada.id);
    const sedimentada = entradaDe(estado, { mapaId: MAPA, id: entrada.id });
    assert.equal(admiteOferta(sedimentada, { salida: 'salida-9', sitio: 'As Laxes da Moura' }), false);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('Ofrecer una tercera vez falla nombrando el estado en lugar de ofrecerla', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    ofreceDosVeces(estado, entrada.id);
    assert.throws(
      () => registraOferta(estado, { mapaId: MAPA, id: entrada.id, salida: 'salida-3', sitio: 'As Laxes da Moura', paso: 3 }),
      (e) => e instanceof Error && e.message.includes(ESTADOS_DE_ENTRADA.SEDIMENTADA),
      'la tercera oferta tiene que fallar nombrando el estado de la entrada',
    );
  });

  test('Atender una sedimentada falla nombrando el estado y no cambia el estado de la partida', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    ofreceDosVeces(estado, entrada.id);
    const antes = JSON.stringify(congelaEntregas(estado));
    assert.throws(
      () => atiende(estado, { mapaId: MAPA, id: entrada.id }),
      (e) => e instanceof Error && e.message.includes(ESTADOS_DE_ENTRADA.SEDIMENTADA),
    );
    assert.equal(JSON.stringify(congelaEntregas(estado)), antes, 'el intento de atender una sedimentada ha tocado la cola');
  });

  test('Una oportunidad atendida en su primera oferta tiene una sola oferta y no se ofrece otra', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    registraOferta(estado, { mapaId: MAPA, id: entrada.id, salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1 });
    const atendida = atiende(estado, { mapaId: MAPA, id: entrada.id });
    assert.equal(atendida.estado, ESTADOS_DE_ENTRADA.ATENDIDA);
    assert.equal(atendida.ofertas.length, 1);
    assert.equal(admiteOferta(atendida, { salida: 'salida-2', sitio: 'O Cruceiro Branco' }), false);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('El tope de ofertas sale de una sola constante con valor dos', () => {
    assert.equal(TOPE_DE_OFERTAS, 2);
    for (const modulo of MODULOS_DE_LA_COLA) {
      const codigo = codigoDe(fuente(modulo));
      // Ni un dos suelto comparando ofertas: quien cuenta ofertas lee la constante.
      assert.ok(!/ofertas[^\n]*[<>=]=?\s*2\b/.test(codigo), `${modulo} compara ofertas contra un dos escrito a mano`);
    }
  });

  test('Una oferta sin salida o sin sitio falla nombrando el campo que falta', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    assert.throws(() => registraOferta(estado, { mapaId: MAPA, id: entrada.id, sitio: 'A Fonte Vella', paso: 1 }), /salida/);
    assert.throws(() => registraOferta(estado, { mapaId: MAPA, id: entrada.id, salida: 'salida-1', paso: 1 }), /sitio/);
    assert.throws(() => registraOfertaDeLista(estado, { mapaId: MAPA, id: entrada.id, paso: 1 }), /salida/);
    assert.equal(entradaDe(estado, { mapaId: MAPA, id: entrada.id }).ofertas.length, 0, 'ha quedado una oferta a medias');
  });

  test('Una oferta registrada en la última salida antes de guardar vuelve con su salida y su sitio', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    registraOferta(estado, { mapaId: MAPA, id: entrada.id, salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1 });
    cierraSalida(estado, { mapaId: MAPA, salida: 'salida-1', paso: 1 });

    const vuelto = levantaEntregas(JSON.parse(JSON.stringify(congelaEntregas(estado))));
    const recargada = entradaDe(vuelto, { mapaId: MAPA, id: entrada.id });
    assert.deepEqual(recargada.ofertas, [{ salida: 'salida-1', sitio: 'A Fonte Vella', paso: 1, via: VIAS_DE_OFERTA.MARCHA }]);
    assert.equal(admiteOferta(recargada, { salida: 'salida-1', sitio: 'O Cruceiro Branco' }), false, 'la segunda oferta ya no exige otra salida');
    assert.equal(admiteOferta(recargada, { salida: 'salida-2', sitio: 'A Fonte Vella' }), false, 'la segunda oferta ya no exige otro sitio');
    assert.equal(admiteOferta(recargada, { salida: 'salida-2', sitio: 'O Cruceiro Branco' }), true);
  });

  test('El cooldown de un paso se lee de las ofertas registradas y no de un contador aparte', () => {
    const estado = colaDe(2);
    const [una] = pendientes(estado, { mapaId: MAPA });
    assert.equal(yaSaltoEnElPaso(estado, { mapaId: MAPA, paso: 4 }), false);
    registraOferta(estado, { mapaId: MAPA, id: una.id, salida: 'salida-1', sitio: 'A Fonte Vella', paso: 4 });
    assert.equal(yaSaltoEnElPaso(estado, { mapaId: MAPA, paso: 4 }), true);
    assert.equal(yaSaltoEnElPaso(estado, { mapaId: MAPA, paso: 5 }), false);
    // Una oferta de lista no gasta el paso: no es un aviso en marcha.
    const [, otra] = pendientes(estado, { mapaId: MAPA });
    registraOfertaDeLista(estado, { mapaId: MAPA, id: otra.id, salida: 'salida-1', paso: 5 });
    assert.equal(yaSaltoEnElPaso(estado, { mapaId: MAPA, paso: 5 }), false);
  });
});

describe('Sedimentar no se reprocha', () => {
  /** Una partida con `cuantas` oportunidades ya sedimentadas, y otra que no recibió ninguna. */
  function dosPartidas(cuantas) {
    const conCola = estadoInicial({ semilla: SEMILLA_A });
    const sinNada = estadoInicial({ semilla: SEMILLA_A });
    colaDe(cuantas, { estado: conCola.entregas });
    pendientes(conCola.entregas, { mapaId: MAPA }).forEach((e, k) => {
      registraOferta(conCola.entregas, { mapaId: MAPA, id: e.id, salida: `salida-${k}-a`, sitio: 'A Fonte Vella', paso: 2 * k });
      registraOferta(conCola.entregas, { mapaId: MAPA, id: e.id, salida: `salida-${k}-b`, sitio: 'O Cruceiro Branco', paso: 2 * k + 1 });
      cierraSalida(conCola.entregas, { mapaId: MAPA, salida: `salida-${k}-b`, paso: 2 * k + 1 });
    });
    return { conCola, sinNada };
  }

  test('Sedimentar no se reprocha', () => {
    // El escenario de la batería, en todo lo que no es leer un texto: veinte
    // sedimentaciones frente a una partida que no recibió ninguna oportunidad, y la
    // única diferencia son las entradas de la cola. Rango, relación, oro, objetos,
    // motes y diario son las seis cosas donde un reproche podría esconderse.
    const { conCola, sinNada } = dosPartidas(20);
    assert.equal(pendientes(conCola.entregas, { mapaId: MAPA }).length, 0, 'no han sedimentado las veinte');

    const a = congelaEstado(conCola);
    const b = congelaEstado(sinNada);
    const distintas = AREAS_CON_ESTADO.filter((id) => JSON.stringify(a.areas[id]) !== JSON.stringify(b.areas[id]));
    assert.deepEqual(distintas, ['entregas'], 'sedimentar veinte oportunidades ha movido algo más que la cola');

    for (const area of ['oro', 'objetos', 'motes', 'relaciones', 'nucleos', 'diario']) {
      assert.equal(JSON.stringify(a.areas[area]), JSON.stringify(b.areas[area]), `sedimentar ha tocado ${area}`);
    }
    assert.equal(entradasDe(conCola.diario).length, 0, 'una sedimentación ha escrito en el diario');
  });

  test('Sedimentar veinte no reduce las dos ofertas de la siguiente', () => {
    const { conCola } = dosPartidas(20);
    colaDe(1, { estado: conCola.entregas, desde: 100 });
    const [nueva] = pendientes(conCola.entregas, { mapaId: MAPA });
    assert.equal(nueva.ofertas.length, 0);
    assert.equal(admiteOferta(nueva, { salida: 'salida-nueva', sitio: 'As Laxes da Moura' }), true);

    registraOferta(conCola.entregas, { mapaId: MAPA, id: nueva.id, salida: 'salida-nueva', sitio: 'As Laxes da Moura', paso: 900 });
    cierraSalida(conCola.entregas, { mapaId: MAPA, salida: 'salida-nueva', paso: 900 });
    const tras = entradaDe(conCola.entregas, { mapaId: MAPA, id: nueva.id });
    assert.equal(tras.estado, ESTADOS_DE_ENTRADA.PENDIENTE, 'la veintiuna ha sedimentado con una sola oferta');
    assert.equal(TOPE_DE_OFERTAS - tras.ofertas.length, 1, 'a la veintiuna le queda menos de una oferta');
  });

  test('La sedimentación no produce ningún efecto, ni siquiera aditivo', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    const sedimentadas = ofreceDosVeces(estado, entrada.id);
    // Lo que devuelve el cierre son las entradas que sedimentaron, no efectos: no
    // hay ningún `tipo` del catálogo de SPEC-011 dentro.
    for (const e of sedimentadas) {
      assert.equal(e.estado, ESTADOS_DE_ENTRADA.SEDIMENTADA);
      assert.ok(!IDS_DE_EFECTO.includes(e.tipo) || e.tipo === TIPOS_DE_ENTREGA.OPORTUNIDAD);
      assert.ok(!('efectos' in e), 'la sedimentación devuelve efectos');
    }
  });

  test('Ningún estado de una entrada significa fallada, y ninguno castiga', () => {
    const declarados = Object.values(ESTADOS_DE_ENTRADA);
    assert.deepEqual(declarados.slice().sort(), ['atendida', 'pendiente', 'sedimentada']);
    for (const estado of declarados) {
      assert.ok(!/(fallad|perdid|caducad|olvidad|ignorad)/i.test(estado), `el estado "${estado}" reprocha`);
    }
  });

  test('Ningún texto que esta capa expone menciona lo no atendido ni lo perdido', () => {
    const estado = colaDe(2);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    ofreceDosVeces(estado, entrada.id);
    const texto = JSON.stringify(congelaEntregas(estado)).toLowerCase();
    for (const reproche of ['no fuiste', 'perdiste', 'no atendiste', 'te lo perdiste', 'ignoraste', 'olvidaste', 'no hiciste']) {
      assert.ok(!texto.includes(reproche), `la cola dice "${reproche}"`);
    }
  });

  test('No existe ninguna consulta que devuelva cuántas oportunidades se dejaron pasar', () => {
    const exportado = Object.keys(moduloDeEntregas);
    for (const nombre of exportado) {
      assert.ok(
        !/(ignorad|perdid|desaprovech|cuantasSedimenta|sedimentadas)/i.test(nombre),
        `la cola exporta "${nombre}", que cuenta lo que no se hizo`,
      );
    }
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    ofreceDosVeces(estado, entrada.id);
    const doc = congelaEntregas(estado);
    // El documento tampoco lleva la cuenta: un número que no existe no lo puede
    // pintar ninguna pantalla por descuido.
    assert.ok(!JSON.stringify(doc).includes('"ignoradas"'));
  });
});

describe('Un paso solo añade', () => {
  /** Un motor con la cola colgada y la fuente de producciones que se le dé. */
  function motorConCola({ producciones = null, estado = estadoDeEntregas(), nucleos = null, mapaId = MAPA, otros = [] } = {}) {
    const cola = creaColaDeEntregas({ mapaId, estado, nucleos, producciones });
    return {
      cola,
      estado,
      motor: creaMotorDePasos({ semilla: SEMILLA_A, mapaId, estado: estadoDePasos(), productores: [...otros, cola] }),
    };
  }

  test('Un paso solo añade', () => {
    // El escenario de la batería en la mitad que esta capa sostiene: la cola es el
    // segundo productor, y ni sedimentar ni ofrecer quitan nada. Diez pasos con la
    // cola colgada producen solo efectos del catálogo cerrado, y todos añaden.
    const estado = estadoDeEntregas();
    const { motor } = motorConCola({
      estado,
      producciones: (n) => (n % 3 === 0 ? [oportunidad({ asunto: `encargo-${n}`, escena: 'encuentro' })] : []),
    });
    motor.avanza(40);
    const antes = JSON.stringify(congelaEntregas(estado));

    const diez = motor.avanza(10);
    assert.equal(motor.contador(), 50);
    for (const paso of diez) {
      for (const efecto of paso.efectos) {
        assert.ok(IDS_DE_EFECTO.includes(efecto.tipo), `el efecto "${efecto.tipo}" no está en el catálogo`);
        assert.equal(TIPOS_DE_EFECTO[efecto.tipo].anade, true);
      }
    }
    // Y nada de lo que ya había en la cola se ha ido: los diez pasos solo suman.
    const despues = JSON.parse(JSON.stringify(congelaEntregas(estado)));
    const previas = JSON.parse(antes).mapas[MAPA].entradas.map((e) => e.id);
    for (const id of previas) assert.ok(despues.mapas[MAPA].entradas.some((e) => e.id === id), `la entrada ${id} ha desaparecido`);
    assert.ok(despues.mapas[MAPA].entradas.length > previas.length, 'diez pasos no han añadido nada');
  });

  test('El productor de la cola se registra con su identificador y produce efectos del catálogo', () => {
    const { cola, motor } = motorConCola({ producciones: () => [oportunidad({ asunto: 'setas-de-temporada', escena: 'misterio' })] });
    assert.equal(cola.id, ID_DEL_PRODUCTOR);
    const [paso] = motor.avanza(1);
    assert.deepEqual(paso.efectos.map((e) => e.tipo), ['oportunidad']);
    for (const efecto of paso.efectos) {
      assert.ok(!('quita' in efecto) && !('retira' in efecto) && !('caduca' in efecto));
    }
  });

  test('Una noticia producida por un paso entra como efecto de rumor y sedimenta en su núcleo', () => {
    const estado = estadoDeEntregas();
    const nucleos = estadoDeNucleos();
    const { motor } = motorConCola({ estado, nucleos, producciones: (n) => (n === 1 ? [noticia({ asunto: 'burro-perdido', nucleo: 'Vilaboa' })] : []) });
    const [paso] = motor.avanza(1);
    assert.deepEqual(paso.efectos.map((e) => e.tipo), ['rumor']);
    assert.equal(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: 'Vilaboa' }).length, 1);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('Un paso en el que el mundo no produce nada no encola nada y no falla', () => {
    const estado = estadoDeEntregas();
    const { motor } = motorConCola({ estado, producciones: () => [] });
    const pasos = motor.avanza(5);
    assert.deepEqual(pasos.map((p) => p.efectos), [[], [], [], [], []]);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('Sin fuente de producciones la cola no inventa nada y el motor sigue entero', () => {
    // Es lo que hace estructural «sin producción del mundo no hay encuentro»: no
    // existe ninguna vía por la que esta capa se invente una entrada.
    const estado = estadoDeEntregas();
    const { motor } = motorConCola({ estado });
    motor.avanza(20);
    assert.equal(motor.contador(), 20);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
  });

  test('Una producción de un tipo que no está en el enumerado hace fallar el paso y deja la cola igual', () => {
    const estado = colaDe(1);
    const antes = JSON.stringify(congelaEntregas(estado));
    const { motor } = motorConCola({ estado, producciones: () => [{ tipo: 'maldicion', asunto: 'algo' }] });
    assert.throws(() => motor.avanza(1), (e) => e instanceof Error && e.message.includes('maldicion'));
    assert.equal(JSON.stringify(congelaEntregas(estado)), antes, 'un paso fallido ha tocado la cola');
    assert.equal(motor.contador(), 0);
  });

  test('Una fuente de producciones que no es una función o que no devuelve una lista falla nombrándolo', () => {
    assert.throws(() => creaColaDeEntregas({ mapaId: MAPA, producciones: 'una lista' }), /producciones/);
    const { motor } = motorConCola({ producciones: () => ({ asunto: 'x' }) });
    assert.throws(() => motor.avanza(1), /lista/);
  });

  test('Las entradas sembradas por el prólogo entran por la misma puerta y sin ningún campo propio', () => {
    const estado = estadoDeEntregas();
    const sembradas = siembraLaCola(estado, {
      mapaId: MAPA,
      entradas: [
        { tipo: 'oportunidad', asunto: 'setas-de-temporada', clase: 'oportunidad', lugar: 'Vilaboa' },
        { tipo: 'oportunidad', asunto: 'aceite-para-la-botica', clase: 'encargo', lugar: 'Vilaboa' },
      ],
    });
    assert.equal(sembradas.length, 2);
    const cola = pendientes(estado, { mapaId: MAPA });
    // La escena sale del catálogo cerrado que declaró el asunto, no de una
    // suposición, y la entrada no lleva ninguna marca de venir del prólogo.
    assert.deepEqual(cola.map((e) => e.escena).sort(), ['encuentro', 'misterio']);
    for (const e of cola) {
      assert.equal(e.estado, ESTADOS_DE_ENTRADA.PENDIENTE);
      assert.equal(e.ofertas.length, 0);
      assert.equal(e.procedencia.paso, 0);
      assert.ok(!('prologo' in e) && !('sembrada' in e) && !('deArranque' in e), 'la entrada del prólogo es distinguible');
    }
  });

  test('Una siembra que no es una lista falla nombrando lo que llegó', () => {
    const estado = estadoDeEntregas();
    assert.throws(() => siembraLaCola(estado, { mapaId: MAPA, entradas: null }), /lista|entradas/);
  });
});

describe('Determinismo, y nada que se degrade en silencio', () => {
  test('Los módulos de la cola no usan azar, ni reloj, ni temporizadores', () => {
    for (const modulo of MODULOS_DE_LA_COLA) {
      const codigo = codigoDe(fuente(modulo));
      for (const prohibido of ['Math.random', 'Date.now', 'new Date', 'setTimeout', 'setInterval', 'performance.now']) {
        assert.ok(!codigo.includes(prohibido), `${modulo} usa ${prohibido}`);
      }
    }
  });

  test('Colgar la cola del motor no desplaza el azar de la propagación de rumores', () => {
    const solo = [];
    const conCola = [];
    creaMotorDePasos({
      semilla: SEMILLA_A,
      mapaId: MAPA,
      estado: estadoDePasos(),
      productores: [productorEspia('rumores', solo)],
    }).avanza(50);
    creaMotorDePasos({
      semilla: SEMILLA_A,
      mapaId: MAPA,
      estado: estadoDePasos(),
      productores: [productorEspia('rumores', conCola), creaColaDeEntregas({ mapaId: MAPA, producciones: () => [oportunidad({ asunto: 'x' })] })],
    }).avanza(50);
    assert.deepEqual(conCola, solo, 'añadir la cola ha movido el azar de los rumores');
    assert.equal(solo.length, 50);
    // Y el azar del productor cuelga de su identificador, que es de dónde sale la
    // separación: cambiarlo resiembra la cola y no toca a nadie más.
    assert.notEqual(makeRng(`${SEMILLA_A}#${ID_DEL_PRODUCTOR}`)(), makeRng(`${SEMILLA_A}#rumores`)());
  });

  test('El mismo paso ejecutado dos veces desde el mismo estado encola lo mismo y en el mismo orden', () => {
    const producciones = (n) => [oportunidad({ asunto: `encargo-${n}`, escena: 'encuentro' }), oportunidad({ asunto: `otro-${n}`, escena: 'misterio' })];
    const huella = () => {
      const estado = estadoDeEntregas();
      const cola = creaColaDeEntregas({ mapaId: MAPA, estado, producciones });
      creaMotorDePasos({ semilla: SEMILLA_A, mapaId: MAPA, estado: estadoDePasos(), productores: [cola] }).avanza(10);
      return JSON.stringify(congelaEntregas(estado));
    };
    assert.equal(huella(), huella());
  });

  test('El documento de cada celda sigue idéntico byte a byte después de cincuenta pasos con la cola colgada', async () => {
    const rejilla = rejillaDe('barrio-tres-calles');
    const registro = await generaCelda({
      rejilla,
      semilla: SEMILLA_A,
      mapaId: rejilla.id,
      celda: { i: 0, j: 0 },
      consultaOsm: consultaDeFixture('barrio-tres-calles'),
    });
    const antes = textoDeCelda(registro);

    const cola = creaColaDeEntregas({ mapaId: rejilla.id, producciones: (n) => [oportunidad({ asunto: `encargo-${n}` })] });
    const motor = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: rejilla.id, estado: estadoDePasos(), productores: [cola] });
    motor.avanza(50);

    assert.equal(motor.contador(), 50);
    assert.equal(textoDeCelda(registro), antes, 'cincuenta pasos con la cola colgada han cambiado el documento del mundo');
  });

  test('La superficie pública de la cola no expone ninguna cifra de distancia, tiempo, ritmo ni progreso', () => {
    for (const nombre of Object.keys(moduloDeEntregas)) {
      assert.ok(!/(metros|km|minutos|distancia|ritmo|progreso|velocidad)/i.test(nombre), `la cola exporta "${nombre}"`);
    }
    const estado = colaDe(2);
    const doc = congelaEntregas(estado);
    for (const campo of ['metros', 'distancia', 'minutos', 'ritmo', 'progreso']) {
      assert.ok(!JSON.stringify(doc).includes(`"${campo}"`), `el documento de la cola trae "${campo}"`);
    }
  });

  test('La cola no exporta ningún texto destinado a mostrarse dentro del juego', () => {
    for (const [nombre, valor] of Object.entries(moduloDeEntregas)) {
      if (typeof valor !== 'string') continue;
      // Lo que se exporta son claves de catálogo, no frases: sin espacios y sin
      // mayúscula inicial de frase.
      assert.ok(!/\s/.test(valor), `la cola exporta el texto "${valor}" en "${nombre}"`);
    }
  });

  test('Una entrada construida con un paso que no es un entero no negativo falla nombrándolo', () => {
    assert.throws(() => entradaDeEntrega({ tipo: 'oportunidad', asunto: 'x', escena: 'encuentro', mapa: MAPA, paso: -1 }), /paso/);
    assert.throws(() => entradaDeEntrega({ tipo: 'oportunidad', asunto: 'x', escena: 'encuentro', mapa: MAPA, paso: 1.5 }), /paso/);
    assert.throws(() => entradaDeEntrega({ tipo: 'oportunidad', asunto: '', escena: 'encuentro', mapa: MAPA, paso: 1 }), /asunto/);
  });

  test('Un estado de cola mal formado falla nombrando lo que se esperaba', () => {
    assert.throws(() => entregasDeMapa({}, MAPA), /mapas|estadoDeEntregas/);
    assert.throws(() => entregasDeMapa(estadoDeEntregas(), ''), /mapa/i);
  });
});
