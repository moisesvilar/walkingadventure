// SPEC-011 · El motor de pasos: el contador por mapa, la semilla de cada paso, el
// catálogo cerrado de efectos y la frontera con la tubería de generación.
//
// Todo entra inyectado: la semilla, el identificador del mapa, el estado de pasos y
// los productores. **Ninguna prueba de aquí lee el reloj del sistema ni espera a que
// pase el tiempo**, y no es una precaución de estilo: el mundo avanza con los
// kilómetros y no con el calendario, así que una prueba que dependiera de la hora
// estaría afirmando justo lo contrario de lo que la spec promete.
//
// Los casos con nombre de escenario son los de docs/testing.md, literales. Los demás
// van declarados como huecos de la batería en test/spec-test-map.json: la propia
// SPEC-011 enumera seis, y el resto son criterios que la batería nunca llegó a
// escribir porque el motor no existía.
//
// La conversión de metros a pasos y la reserva de fondo viven en kilometros.test.mjs:
// aquí solo el reloj, no su cuerda.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { congelaHondo } from '../../packages/nucleo/core/congelar.js';
import { makeRng } from '../../packages/nucleo/core/rng.js';
import {
  SUFIJOS_DE_FASE,
  SUFIJO_DE_PASO,
  semillaDeMapa,
  semillaDePaso,
  semillasDeFase,
} from '../../packages/nucleo/core/semilla.js';
import {
  IDS_DE_EFECTO,
  TIPOS_DE_EFECTO,
  esTipoDeEfecto,
  validaEfecto,
} from '../../packages/nucleo/partida/efectos.js';
import * as moduloDePasos from '../../packages/nucleo/partida/pasos.js';
import {
  congelaPasos,
  creaMotorDePasos,
  estadoDeMapa,
  estadoDePasos,
  levantaPasos,
} from '../../packages/nucleo/partida/pasos.js';
import { kilometrosDeFondo } from '../../packages/nucleo/partida/kilometros.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { generaCelda } from '../../packages/nucleo/world/celda.js';
import { SEMILLA_A, SEMILLA_B, consultaDeFixture } from './celda-de-prueba.mjs';
import { rejillaDe } from './partida-de-prueba.mjs';
import { fuente, modulosDelPaquete } from './mundo-de-prueba.mjs';

/** Dos identificadores de mapa de la misma partida: el de casa y el de lejos. */
const CASA = '42.40,-8.81';
const LEJOS = '43.36,-8.41';

/** Los tres módulos que SPEC-011 entrega. Se inspeccionan como texto en varias pruebas. */
const MODULOS_DEL_MOTOR = [
  'packages/nucleo/partida/pasos.js',
  'packages/nucleo/partida/kilometros.js',
  'packages/nucleo/partida/efectos.js',
];

function motorDe({ semilla = SEMILLA_A, mapaId = CASA, estado = estadoDePasos(), productores = [] } = {}) {
  return creaMotorDePasos({ semilla, mapaId, estado, productores });
}

/**
 * Un productor que apunta con qué lo llamaron y devuelve un rumor que depende de su
 * azar. Sirve para las dos cosas que hay que afirmar de un productor: que recibe el
 * número y el azar del paso, y que su azar no lo desplaza nadie.
 */
function productorEspia(id, tipo = 'rumor') {
  const llamadas = [];
  return {
    id,
    llamadas,
    produce(n, azar) {
      const sorteo = azar();
      llamadas.push({ n, sorteo, hayAzar: typeof azar === 'function' });
      if (tipo === 'rumor') return [{ tipo: 'rumor', nucleo: `nucleo-${n}`, asunto: `${id}-${sorteo.toFixed(6)}` }];
      if (tipo === 'oportunidad') return [{ tipo: 'oportunidad', asunto: `${id}-${sorteo.toFixed(6)}` }];
      return [{ tipo: 'razon-para-volver', lugar: `${id}-${sorteo.toFixed(6)}` }];
    },
  };
}

/** El productor que no produce nada, que es el caso vacío declarado. */
const productorMudo = (id) => ({ id, produce: () => [] });

/**
 * El estado de una partida que un paso podría estropear si no fuera solo aditivo.
 * No hay todavía módulos de NPCs, rango, oro ni diario —son de las filas 14, 15 y
 * 16—, así que lo que se afirma es lo afirmable hoy y lo que seguirá siendo cierto
 * cuando existan: **el motor no escribe fuera del estado de pasos**.
 */
function estadoDePartidaDePrueba() {
  return {
    aventuras: [
      { id: 'a-1', estado: 'ofrecida', beats: 8 },
      { id: 'a-2', estado: 'en-curso', beats: 4 },
    ],
    npcs: [{ id: 'informante-1', nucleo: 'Vilaboa' }, { id: 'artesana-2', nucleo: 'Marín' }],
    rangos: { Vilaboa: 2, Marín: 1 },
    oro: 140,
    objetos: ['farol', 'cuerda'],
    diario: [{ dia: 1, entrada: 'la primera salida' }],
  };
}

describe('El contador y su semilla', () => {
  test('Una partida recién creada marca cero pasos', () => {
    const estado = estadoDePasos();
    assert.deepEqual(estado, { mapas: {} }, 'una partida recién creada no debería traer ningún mapa con pasos dados');
    assert.equal(motorDe({ estado }).contador(), 0);
  });

  test('El primer paso es el número uno y deja el contador en uno', () => {
    const motor = motorDe();
    const paso = motor.paso(1);
    assert.equal(paso.n, 1);
    assert.equal(motor.contador(), 1);
  });

  test('Avanzar siete pasos los ejecuta consecutivos desde el actual más uno, sin saltos ni repeticiones', () => {
    const motor = motorDe();
    motor.avanza(3);
    const dados = motor.avanza(7);
    assert.deepEqual(dados.map((p) => p.n), [4, 5, 6, 7, 8, 9, 10], 'la tanda tiene un salto o una repetición');
    assert.equal(motor.contador(), 10);
  });

  test('Avanzar cero pasos no ejecuta ninguno y no mueve el contador', () => {
    const motor = motorDe();
    motor.avanza(4);
    const dados = motor.avanza(0);
    assert.deepEqual(dados, []);
    assert.equal(motor.contador(), 4);
  });

  test('Avanzar un número que no es entero no negativo falla nombrando lo recibido', () => {
    const motor = motorDe();
    for (const malo of [-1, 2.5, '7', null]) {
      assert.throws(
        () => motor.avanza(malo),
        (e) => e instanceof Error && e.message.includes(JSON.stringify(malo) ?? String(malo)),
        `avanzar ${JSON.stringify(malo)} debería fallar nombrando lo que llegó`,
      );
    }
    assert.equal(motor.contador(), 0, 'un número inválido no puede haber movido el contador');
    // El número de paso suelto tiene la misma exigencia, y además el cero: los pasos
    // se numeran desde uno porque el cero es «todavía no ha ocurrido nada».
    for (const malo of [0, -3, 1.5]) assert.throws(() => motor.paso(malo), /número de paso inválido/);
  });

  test('La semilla de un paso se deriva de la semilla de la partida, del mapa y del sufijo ":tick:" con su número', () => {
    assert.equal(SUFIJO_DE_PASO, ':tick:', 'el sufijo es lo que la decisión de diseño fija de verdad');
    const motor = motorDe();
    assert.equal(motor.semillaDelPaso(7), `${semillaDeMapa(SEMILLA_A, CASA)}${SUFIJO_DE_PASO}7`);
    assert.equal(motor.semillaDelPaso(7), semillaDePaso(SEMILLA_A, CASA, 7));
    // Cuelga de la semilla del mapa, no de la de una celda: el contador es del mapa.
    assert.ok(!motor.semillaDelPaso(7).includes('#'), 'la semilla del paso no cuelga de ninguna celda');
  });

  test('El contenido de un paso lo decide su número', () => {
    // El escenario de la batería, reexpresado sobre la semilla de SPEC-003: el
    // "42.40,-8.81#1" del texto original filtraba la ubicación y por eso se sustituyó.
    const unaVez = motorDe({ productores: [productorEspia('rumores'), productorEspia('oportunidades', 'oportunidad')] });
    const otraVez = motorDe({ productores: [productorEspia('rumores'), productorEspia('oportunidades', 'oportunidad')] });

    const a = unaVez.avanza(7)[6];
    const b = otraVez.avanza(7)[6];
    assert.equal(a.n, 7);
    assert.equal(JSON.stringify(a), JSON.stringify(b), 'dos ejecuciones del paso 7 desde cero no producen lo mismo');

    // Y el azar del paso, pedido dos veces desde cero, da la misma secuencia.
    const azarA = unaVez.azarDelPaso(7);
    const azarB = otraVez.azarDelPaso(7);
    assert.deepEqual([azarA(), azarA(), azarA()], [azarB(), azarB(), azarB()]);
  });

  test('El paso 7 de dos mapas de la misma partida no comparte semilla', () => {
    const estado = estadoDePasos();
    const casa = motorDe({ estado, mapaId: CASA });
    const lejos = motorDe({ estado, mapaId: LEJOS });
    assert.notEqual(casa.semillaDelPaso(7), lejos.semillaDelPaso(7));
  });

  test('El paso 7 del mismo mapa en dos partidas con semillas distintas no comparte semilla', () => {
    const una = motorDe({ semilla: SEMILLA_A });
    const otra = motorDe({ semilla: SEMILLA_B });
    assert.notEqual(una.semillaDelPaso(7), otra.semillaDelPaso(7));
  });

  test('Dos partidas que llegan al paso 12 producen lo mismo, una de un tirón y otra en cuatro tandas', () => {
    const deUnTiron = motorDe({ productores: [productorEspia('rumores')] });
    const enTandas = motorDe({ productores: [productorEspia('rumores')] });

    const doceDeGolpe = deUnTiron.avanza(12);
    // Las tandas de la spec: 5 + 0 + 4 + 3. La de cero está a propósito, porque abrir
    // la app sin andar es exactamente lo que no puede mover nada.
    const aTrozos = [...enTandas.avanza(5), ...enTandas.avanza(0), ...enTandas.avanza(4), ...enTandas.avanza(3)];

    assert.equal(enTandas.contador(), 12);
    assert.equal(deUnTiron.contador(), 12);
    assert.equal(JSON.stringify(aTrozos), JSON.stringify(doceDeGolpe), 'llegar al paso 12 en tandas produce otro mundo');
    assert.equal(JSON.stringify(aTrozos[11]), JSON.stringify(doceDeGolpe[11]));
  });

  test('En la semilla de un paso no entra ninguna fecha, ninguna hora ni cuándo se ejecutó', () => {
    const motor = motorDe();
    const semilla = motor.semillaDelPaso(9);
    // Es exactamente la composición declarada y nada más: cualquier marca de reloj
    // sería un trozo de cadena que aquí no cabe.
    assert.equal(semilla, `${SEMILLA_A}@${CASA}${SUFIJO_DE_PASO}9`);
    assert.equal(semilla.replace(`${SEMILLA_A}@${CASA}${SUFIJO_DE_PASO}`, ''), '9');
    // Y pedirla dos veces con lo que sea que haya pasado entre medias da lo mismo.
    assert.equal(motor.semillaDelPaso(9), semilla);
  });

  test('El motor no lee el reloj del sistema: ni Date.now, ni new Date, ni temporizadores, ni Math.random', () => {
    // La prohibición general de la batería habla de la generación, y el motor es
    // capa y no fase: por su letra no lo cubre. Aquí se afirma sobre los tres
    // módulos que SPEC-011 entrega.
    const prohibido = [/Math\.random\s*\(/, /Date\.now\s*\(/, /new\s+Date\s*\(/, /setTimeout\s*\(/, /setInterval\s*\(/, /performance\.now\s*\(/, /\bhrtime\b/];
    for (const modulo of MODULOS_DEL_MOTOR) {
      const texto = fuente(modulo);
      for (const patron of prohibido) {
        assert.ok(!patron.test(texto), `${modulo} usa ${patron}: el reloj del mundo son los kilómetros, no el calendario`);
      }
    }
  });

  test('El contador vuelve del documento con el mismo valor', () => {
    const estado = estadoDePasos();
    motorDe({ estado, mapaId: CASA }).avanza(23);
    motorDe({ estado, mapaId: LEJOS }).avanza(4);

    const doc = congelaPasos(estado);
    const vuelta = levantaPasos(JSON.parse(JSON.stringify(doc)));
    assert.equal(estadoDeMapa(vuelta, CASA).n, 23);
    assert.equal(estadoDeMapa(vuelta, LEJOS).n, 4);
    assert.equal(motorDe({ estado: vuelta, mapaId: CASA }).contador(), 23);
  });

  test('El contador viaja con la partida y nunca dentro del documento congelado de una celda', async () => {
    const estado = estadoDePasos();
    const motor = motorDe({ estado, mapaId: CASA });
    motor.avanza(12);

    // Está en el documento de la partida...
    assert.equal(congelaPasos(estado).mapas[CASA].n, 12);

    // ...y no en el del mundo, que ni siquiera conoce la palabra.
    const rejilla = rejillaDe('barrio-tres-calles');
    const registro = await generaCelda({
      rejilla,
      semilla: SEMILLA_A,
      mapaId: rejilla.id,
      celda: { i: 0, j: 0 },
      consultaOsm: consultaDeFixture('barrio-tres-calles'),
    });
    const documento = textoDeCelda(registro);
    assert.ok(!documento.includes(SUFIJO_DE_PASO), 'el documento de la celda habla de pasos del mundo');
    assert.ok(!/"n"\s*:/.test(documento) || !documento.includes('"reserva"'), 'el documento de la celda trae estado de la jugadora');
    assert.ok(!documento.includes('reserva'), 'la reserva de pasos de fondo no puede vivir en el documento del mundo');
  });
});

describe('El calendario no mueve nada', () => {
  test('Estar un mes sin salir no acumula mundo pendiente', () => {
    // Treinta días sin andar son, para el núcleo, exactamente ningún metro: ni de la
    // salida ni del fondo. No hay ninguna operación que reciba «treinta días».
    const estado = estadoDePasos();
    const motor = motorDe({ estado, productores: [productorEspia('rumores')] });

    const abre = kilometrosDeFondo({ motor, metros: 0, activos: true, tramo: 2000 });
    assert.deepEqual(abre.pasos, []);
    assert.equal(motor.contador(), 0, 'el mundo ha avanzado sin que nadie ande');
    assert.equal(abre.enLaReserva, 0);
  });

  test('Quien vuelve tras tres meses y quien vuelve tras tres días con los mismos metros tienen el mismo contador', () => {
    const enTresDias = motorDe({ productores: [productorEspia('rumores')] });
    const enTresMeses = motorDe({ productores: [productorEspia('rumores')] });

    enTresDias.avanza(9);
    // La misma cantidad de mundo, repartida en muchas más aperturas de la app.
    for (let k = 0; k < 9; k++) enTresMeses.avanza(1);

    assert.equal(enTresDias.contador(), enTresMeses.contador());
    assert.equal(enTresDias.semillaDelPaso(), enTresMeses.semillaDelPaso());
  });

  test('Ninguna operación de la superficie pública del motor recibe una fecha, un intervalo ni un número de días', () => {
    const delReloj = /(fecha|dia|día|hora|semana|mes|calendario|timestamp|instante|desde|hasta|intervalo)/i;
    const motor = motorDe();

    for (const nombre of Object.keys(moduloDePasos)) {
      assert.ok(!delReloj.test(nombre), `el motor exporta "${nombre}", que suena a calendario`);
    }
    for (const nombre of Object.keys(motor)) {
      assert.ok(!delReloj.test(nombre), `el motor expone "${nombre}", que suena a calendario`);
      if (typeof motor[nombre] !== 'function') continue;
      const firma = motor[nombre].toString().slice(0, motor[nombre].toString().indexOf(')') + 1);
      assert.ok(!delReloj.test(firma), `la operación "${nombre}" recibe algo del calendario: ${firma}`);
    }
  });

  test('Al abrir la app sin metros de ninguna de las dos fuentes no se ejecuta ningún paso', () => {
    const motor = motorDe({ productores: [productorEspia('rumores')] });
    const fondo = kilometrosDeFondo({ motor, metros: 0, activos: true, tramo: 2000 });
    const apagado = kilometrosDeFondo({ motor, metros: 0, activos: false, tramo: 2000 });
    assert.deepEqual(fondo.pasos, []);
    assert.deepEqual(apagado.pasos, []);
    assert.equal(motor.contador(), 0);
  });

  test('Una partida guardada hace un año carga con el mismo contador', () => {
    // El documento es texto: da igual cuánto lleve guardado, porque no trae ninguna
    // marca de tiempo con la que nadie pueda calcular nada.
    const estado = estadoDePasos();
    motorDe({ estado }).avanza(31);
    const guardado = JSON.stringify(congelaPasos(estado));

    const vuelta = levantaPasos(JSON.parse(guardado));
    assert.equal(estadoDeMapa(vuelta, CASA).n, 31);
    assert.equal(JSON.stringify(congelaPasos(vuelta)), guardado, 'el documento no vuelve a escribirse igual');
  });

  test('Un paso ejecutado no lleva ninguna marca de tiempo del reloj real', () => {
    const motor = motorDe({ productores: [productorEspia('rumores')] });
    const [paso] = motor.avanza(1);
    assert.deepEqual(Object.keys(paso).sort(), ['efectos', 'n']);

    const delReloj = /(fecha|hora|tiempo|timestamp|ms|instante|cuando)/i;
    const visita = (valor, ruta) => {
      if (valor === null || typeof valor !== 'object') return;
      for (const [clave, hijo] of Object.entries(valor)) {
        assert.ok(!delReloj.test(clave), `${ruta}.${clave} parece una marca de tiempo`);
        visita(hijo, `${ruta}.${clave}`);
      }
    };
    visita(paso, 'paso');
  });
});

describe('Un paso solo añade', () => {
  test('Un paso solo añade', () => {
    // El escenario de la batería, literal: un mundo en el paso 40, diez pasos sin
    // que la jugadora actúe, y nada de lo suyo se toca. Las aventuras, los NPCs y
    // los rangos son de las filas 14 y 15 y todavía no tienen módulo; lo que se
    // afirma es la garantía que los cubrirá a todos: el motor no escribe ahí.
    const estado = estadoDePasos();
    const motor = motorDe({ estado, productores: [productorEspia('rumores'), productorEspia('oportunidades', 'oportunidad')] });
    motor.avanza(40);

    const partida = estadoDePartidaDePrueba();
    const antes = JSON.stringify(partida);

    const diez = motor.avanza(10);

    assert.equal(motor.contador(), 50);
    assert.equal(JSON.stringify(partida), antes, 'diez pasos han tocado el estado de la jugadora');
    assert.deepEqual(partida.aventuras.map((a) => a.estado), ['ofrecida', 'en-curso'], 'ha caducado una aventura');
    assert.equal(partida.npcs.length, 2, 'se ha retirado un NPC');
    assert.deepEqual(partida.rangos, { Vilaboa: 2, Marín: 1 }, 'ha bajado un rango');
    assert.equal(partida.oro, 140, 'se ha restado oro');
    assert.deepEqual(partida.objetos, ['farol', 'cuerda'], 'se ha retirado un objeto');
    assert.equal(partida.diario.length, 1, 'se ha borrado una entrada del diario');

    // Y todo lo que los diez pasos produjeron es del catálogo, que solo añade.
    for (const paso of diez) for (const efecto of paso.efectos) assert.ok(TIPOS_DE_EFECTO[efecto.tipo].anade === true);
  });

  test('El catálogo de tipos de efecto es cerrado y todos sus tipos añaden', () => {
    assert.deepEqual(IDS_DE_EFECTO, ['oportunidad', 'razon-para-volver', 'rumor'], 'el catálogo ha dejado de ser el de la decisión 4');
    assert.equal(Object.keys(TIPOS_DE_EFECTO).length, 3, 'el catálogo tiene que ser cerrado');

    const quita = /(quita|retira|caduca|resta|elimina|borra|baja|penaliza|revoca|expira|descuenta)/i;
    for (const tipo of IDS_DE_EFECTO) {
      assert.equal(TIPOS_DE_EFECTO[tipo].anade, true, `el tipo "${tipo}" no declara que añade`);
      assert.ok(!quita.test(tipo), `el tipo "${tipo}" nombra algo que quita`);
      for (const campo of TIPOS_DE_EFECTO[tipo].campos) {
        assert.ok(!quita.test(campo), `el tipo "${tipo}" declara el campo "${campo}", que quita`);
      }
    }
    assert.ok(!esTipoDeEfecto('caducidad'));
    assert.ok(Object.isFrozen(TIPOS_DE_EFECTO), 'el catálogo se puede ampliar en caliente');
  });

  test('Un efecto de un tipo que no está en el catálogo hace fallar el paso nombrando el tipo', () => {
    const motor = motorDe({
      productores: [{ id: 'inventor', produce: () => [{ tipo: 'maldicion', asunto: 'algo' }] }],
    });
    assert.throws(
      () => motor.avanza(1),
      (e) => e instanceof Error && e.message.includes('maldicion') && e.message.includes('inventor'),
      'el fallo tiene que nombrar el tipo y el productor',
    );
    assert.equal(motor.contador(), 0);
  });

  test('Un efecto que resta se rechaza nombrando el efecto y el estado de la partida no cambia', () => {
    const partida = estadoDePartidaDePrueba();
    const antes = JSON.stringify(partida);
    const motor = motorDe({
      productores: [{ id: 'castigador', produce: () => [{ tipo: 'retira-npc', nucleo: 'Vilaboa', asunto: 'se marchó' }] }],
    });

    assert.throws(
      () => motor.avanza(1),
      (e) => e instanceof Error && e.message.includes('retira-npc') && /quita/.test(e.message),
      'un efecto que resta tiene que rechazarse diciendo que quita, no como «tipo desconocido»',
    );
    assert.equal(JSON.stringify(partida), antes);
    assert.equal(motor.contador(), 0);

    // Y también por la puerta de atrás: un tipo del catálogo con un campo que quita,
    // o con una cantidad negativa.
    assert.throws(() => validaEfecto({ tipo: 'rumor', nucleo: 'Vilaboa', asunto: 'x', caduca: 3 }), /caduca/);
    assert.throws(() => validaEfecto({ tipo: 'rumor', nucleo: 'Vilaboa', asunto: 'x', nivel: -2 }), /negativa/);
  });

  test('Un paso que falla al aplicarse no mueve el contador', () => {
    const motor = motorDe({
      productores: [
        productorEspia('bueno'),
        { id: 'malo', produce: (n) => (n === 4 ? [{ tipo: 'no-existe' }] : []) },
      ],
    });
    motor.avanza(3);
    assert.equal(motor.contador(), 3);
    assert.throws(() => motor.avanza(5), /no está en el catálogo/);
    assert.equal(motor.contador(), 3, 'un paso a medias ha gastado su número');
    // Y el número sigue disponible: arreglado el productor, el paso 4 se ejecuta.
    const sano = motorDe({ productores: [productorEspia('bueno')] });
    sano.avanza(4);
    assert.equal(sano.contador(), 4);
  });

  test('Un paso puede aplicar la consecuencia de un acto de la jugadora aunque sea mala', () => {
    // La regla protege contra penalizar la ausencia, no contra propagar lo que se
    // hizo: un rumor con signo malo es un efecto legítimo y viaja igual.
    const motor = motorDe({
      productores: [{ id: 'consecuencias', produce: () => [{ tipo: 'rumor', nucleo: 'Marín', asunto: 'dejó tirada a la panadera', signo: 'malo', nivel: 2 }] }],
    });
    const [paso] = motor.avanza(1);
    assert.equal(paso.efectos.length, 1);
    assert.equal(paso.efectos[0].signo, 'malo');
    assert.equal(motor.contador(), 1);
  });
});

describe('Un contador por mapa', () => {
  test('Cada mapa de la partida tiene su propio contador', () => {
    const estado = estadoDePasos();
    const casa = motorDe({ estado, mapaId: CASA });
    const lejos = motorDe({ estado, mapaId: LEJOS });

    casa.avanza(6);
    lejos.avanza(2);

    assert.equal(casa.contador(), 6);
    assert.equal(lejos.contador(), 2);
    assert.deepEqual(Object.keys(congelaPasos(estado).mapas).sort(), [CASA, LEJOS].sort());
  });

  test('El mundo de casa no avanza en tu ausencia', () => {
    // Tres semanas andando en el mapa nuevo: el de casa se queda donde estaba.
    const estado = estadoDePasos();
    const casa = motorDe({ estado, mapaId: CASA, productores: [productorEspia('rumores')] });
    casa.avanza(11);
    const semillaDeCasaAntes = casa.semillaDelPaso();

    const lejos = motorDe({ estado, mapaId: LEJOS, productores: [productorEspia('rumores')] });
    lejos.avanza(30);

    assert.equal(casa.contador(), 11, 'el mundo de casa ha avanzado con kilómetros andados en otro mapa');
    assert.equal(casa.semillaDelPaso(), semillaDeCasaAntes);
    assert.equal(lejos.contador(), 30);
  });

  test('Un mapa nuevo levantado en otro sitio marca cero', () => {
    const estado = estadoDePasos();
    motorDe({ estado, mapaId: CASA }).avanza(40);
    assert.equal(motorDe({ estado, mapaId: LEJOS }).contador(), 0);
  });

  test('Sin mapa activo el motor falla nombrando el mapa que falta, en lugar de avanzar un contador por defecto', () => {
    for (const malo of [undefined, null, '', 42]) {
      assert.throws(
        () => creaMotorDePasos({ semilla: SEMILLA_A, mapaId: malo }),
        (e) => e instanceof Error && /falta el mapa activo/.test(e.message),
        `sin mapa (${JSON.stringify(malo)}) debería fallar nombrando el mapa`,
      );
    }
  });
});

describe('Capa sobre el mundo, nunca fase de la tubería', () => {
  test('El documento de cada celda sigue idéntico byte a byte después de cincuenta pasos', async () => {
    const rejilla = rejillaDe('barrio-tres-calles');
    const registro = await generaCelda({
      rejilla,
      semilla: SEMILLA_A,
      mapaId: rejilla.id,
      celda: { i: 0, j: 0 },
      consultaOsm: consultaDeFixture('barrio-tres-calles'),
    });
    const antes = textoDeCelda(registro);

    const estado = estadoDePasos();
    const motor = creaMotorDePasos({
      semilla: SEMILLA_A,
      mapaId: rejilla.id,
      estado,
      productores: [productorEspia('rumores'), productorEspia('oportunidades', 'oportunidad')],
    });
    motor.avanza(50);

    assert.equal(motor.contador(), 50);
    assert.equal(textoDeCelda(registro), antes, 'cincuenta pasos han cambiado el documento del mundo');
  });

  test('Volver a generar la celda tras cincuenta pasos da un documento idéntico', async () => {
    const rejilla = rejillaDe('barrio-tres-calles');
    const genera = () => generaCelda({
      rejilla,
      semilla: SEMILLA_A,
      mapaId: rejilla.id,
      celda: { i: 0, j: 0 },
      consultaOsm: consultaDeFixture('barrio-tres-calles'),
    });

    const antes = textoDeCelda(await genera());
    creaMotorDePasos({ semilla: SEMILLA_A, mapaId: rejilla.id, productores: [productorEspia('rumores')] }).avanza(50);
    const despues = textoDeCelda(await genera());

    assert.equal(despues, antes, 'los pasos han entrado en la generación');
  });

  test('El motor no importa buildWorld ni ninguna fase de la generación', () => {
    const deLaGeneracion = /from\s+'[^']*(world\/|buildWorld|build\.js|osm\.js|settlements|parajes|routes|grafo|rejilla|celda|seamask)/;
    for (const modulo of MODULOS_DEL_MOTOR) {
      const texto = fuente(modulo);
      const importa = texto.split('\n').filter((l) => /^import\s/.test(l.trim()));
      for (const linea of importa) {
        assert.ok(!deLaGeneracion.test(linea), `${modulo} importa la generación: ${linea.trim()}`);
      }
    }
  });

  test('El paso del mundo no es una fase de la tubería de generación', () => {
    for (const fase of Object.keys(SUFIJOS_DE_FASE)) {
      assert.ok(!/(paso|tick)/i.test(fase), `"${fase}" ha entrado en el catálogo de fases`);
      assert.notEqual(SUFIJOS_DE_FASE[fase], SUFIJO_DE_PASO);
    }
    const deUnaCelda = semillasDeFase(SEMILLA_A, CASA, { i: 0, j: 0 });
    for (const semilla of Object.values(deUnaCelda)) {
      assert.ok(!semilla.includes(SUFIJO_DE_PASO), 'una semilla de fase promete pasos por celda');
    }
  });

  test('Un paso ejecutado escribe solo en el estado de la partida', () => {
    const estado = estadoDePasos();
    const motor = motorDe({ estado, productores: [productorEspia('rumores')] });
    const partida = estadoDePartidaDePrueba();
    const antes = JSON.stringify(partida);

    const [paso] = motor.avanza(1);

    assert.equal(JSON.stringify(partida), antes);
    assert.equal(estadoDeMapa(estado, CASA).n, 1, 'lo único que cambia es el estado de pasos de la partida');
    assert.ok(Object.isFrozen(paso), 'el paso sale sin congelar y alguien lo puede reescribir');
    assert.ok(Object.isFrozen(paso.efectos[0]));
  });

  test('Sin ningún productor el motor avanza diez pasos y no ocurre nada más', () => {
    const motor = motorDe({ productores: [] });
    const diez = motor.avanza(10);
    assert.equal(motor.contador(), 10);
    assert.deepEqual(diez.map((p) => p.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const paso of diez) assert.deepEqual(paso.efectos, []);
    // Y un productor que no produce nada tampoco es un error.
    const mudo = motorDe({ productores: [productorMudo('callado')] });
    assert.deepEqual(mudo.avanza(1)[0].efectos, []);
  });

  test('Dos productores se invocan en un orden declarado y estable, con el número del paso y su azar', () => {
    const primero = productorEspia('rumores');
    const segundo = productorEspia('oportunidades', 'oportunidad');
    const motor = motorDe({ productores: [primero, segundo] });

    const [uno, dos] = motor.avanza(2);

    assert.deepEqual(primero.llamadas.map((l) => l.n), [1, 2], 'el productor no recibe el número del paso');
    assert.deepEqual(segundo.llamadas.map((l) => l.n), [1, 2]);
    assert.ok(primero.llamadas.every((l) => l.hayAzar), 'el productor no recibe azar');
    // El orden de los efectos es el de la lista declarada, paso a paso.
    assert.deepEqual(uno.efectos.map((e) => e.tipo), ['rumor', 'oportunidad']);
    assert.deepEqual(dos.efectos.map((e) => e.tipo), ['rumor', 'oportunidad']);
  });

  test('El mismo paso ejecutado dos veces desde el mismo estado produce los mismos efectos en el mismo orden', () => {
    const construye = () => motorDe({ productores: [productorEspia('rumores'), productorEspia('oportunidades', 'oportunidad')] });
    const a = construye();
    const b = construye();
    a.avanza(5);
    b.avanza(5);
    assert.equal(JSON.stringify(a.avanza(1)), JSON.stringify(b.avanza(1)));
  });

  test('Añadir un productor no desplaza el azar de los demás', () => {
    const solo = productorEspia('rumores');
    const conCompania = productorEspia('rumores');
    motorDe({ productores: [solo] }).avanza(4);
    motorDe({ productores: [productorEspia('oportunidades', 'oportunidad'), conCompania, productorEspia('vuelta', 'razon')] }).avanza(4);

    assert.deepEqual(
      conCompania.llamadas.map((l) => l.sorteo),
      solo.llamadas.map((l) => l.sorteo),
      'colgar otro productor le ha cambiado el azar a los rumores ya sembrados',
    );
    // Y el azar de cada uno se deriva del suyo, no del generador del paso a secas.
    const motor = motorDe();
    const base = motor.semillaDelPaso(3);
    const derivado = makeRng(`${base}#rumores`);
    assert.notEqual(derivado(), makeRng(base)());
  });

  test('El motor no exporta ningún texto destinado a mostrarse dentro del juego', () => {
    for (const [nombre, valor] of Object.entries(moduloDePasos)) {
      if (typeof valor !== 'string') continue;
      assert.ok(!/\s/.test(valor), `el motor exporta "${nombre}" = ${JSON.stringify(valor)}, que parece prosa`);
      assert.ok(valor.length <= 16, `el motor exporta "${nombre}", demasiado largo para ser un identificador técnico`);
    }
    const congelado = congelaHondo(moduloDePasos.estadoDePasos());
    assert.deepEqual(congelado, { mapas: {} });
  });

  test('El valor del contador no lo devuelve ninguna consulta del núcleo a la capa de presentación', () => {
    // Lo que no sale del núcleo no se puede pintar por descuido: fuera de `partida/`
    // nadie importa el motor, así que ninguna consulta de mundo o de mapa lo arrastra.
    const importadores = modulosDelPaquete()
      .filter((m) => !m.endsWith('partida/pasos.js'))
      .filter((m) => /from\s+'[^']*pasos\.js'/.test(fuente(m)));
    const fuera = importadores.filter((m) => !m.includes('/partida/'));
    assert.deepEqual(fuera, [], `el motor de pasos se importa fuera de partida/: ${fuera.join(', ')}`);
  });
});
