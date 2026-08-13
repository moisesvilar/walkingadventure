// SPEC-046 · El motor de pasos **del mapa activo**, que es la pieza que la app no armaba.
//
// `creaMotorDeLaPartida` estaba escrito, probado y sin llamador: el paquete sabía colgarle la
// propagación de rumores y la cola de entregas, y desde `app/` no lo montaba nadie. Sin él no
// había dónde acreditar los metros del día a día, así que la reserva no se llenaba nunca y el
// zurrón era inalcanzable — es decir, tres piezas de tres filas distintas que no protestaban
// porque ninguna estaba conectada a la siguiente.
//
// `app/salida/motor.js` **se ejecuta de verdad aquí**: no importa nada, ni siquiera el
// paquete, porque el generador entra por la puerta (SPEC-020 §6u). Eso es lo que permite
// afirmar las dos cosas que importan sin dispositivo: que **sin mapa levantado no se monta
// ningún motor** y que lo que un paso produce entra en las **áreas vivas** de la partida, las
// mismas que se congelan.
//
// Los casos con nombre de escenario son los de `docs/testing.md`: «Los metros que la app de
// salud da al abrir llenan la reserva del mapa activo», «Sin mapa levantado no se acredita
// ningún metro» y «El contenido de un paso lo decide su número». El resto va marcado como
// hueco de batería en `test/spec-test-map.json`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DEL_NUCLEO, MOTIVOS_SIN_MOTOR, creaMotorDelMapaActivo } from '../../app/salida/motor.js';
import { PRODUCTORES_DE_LA_PARTIDA, creaMotorDeLaPartida } from '../../packages/nucleo/partida/motor.js';
import { congelaEstado, estadoInicial, levantaEstado, textoDeEstado } from '../../packages/nucleo/partida/estado.js';
import { kilometrosDeFondo, tamanoDeLaReserva } from '../../packages/nucleo/partida/kilometros.js';
import { mundoLineal } from './rumor-de-prueba.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';

const MAPA = '42.40,-8.81';
const OTRO_MAPA = '43.36,-8.41';
const TRAMO = 2000;
const NUCLEOS = ['Albariza', 'Bermeda', 'Cobreira', 'Dorna', 'Ermida'];

/** El núcleo que `creaMotorDelMapaActivo` enumera, ni una función más. */
const nucleo = { creaMotorDeLaPartida, PRODUCTORES_DE_LA_PARTIDA };

/** El mapa levantado tal como se lo pasa la raíz: identificador y documento. */
function mapa(mapaId = MAPA) {
  return { mapaId, documento: mundoLineal(NUCLEOS) };
}

/** Una partida abierta. El tramo personal viaja aparte, como lo pasa la raíz. */
function partida({ semilla = SEMILLA_A } = {}) {
  return estadoInicial({ semilla });
}

function armado({ estado = partida(), mundo = mapa() } = {}) {
  return creaMotorDelMapaActivo({ nucleo, estado, mundo });
}

// ── El motor, montado una vez y sobre las áreas vivas ───────────────────────────

describe('El motor del mapa activo lo arma la app', () => {
  test('El motor se arma con la semilla, el mapa activo y las áreas de la partida', () => {
    const estado = partida();
    const el = armado({ estado });
    assert.ok(el.motor, `no se ha armado ningún motor y el motivo declarado es "${el.motivo}"`);
    assert.equal(el.mapaId, MAPA, 'el motor no dice a qué mapa acredita, y la reserva es por mapa');
    assert.equal(el.motivo, null, 'hay motor y además motivo: uno de los dos sobra y quien lea no sabrá cuál creer');
    // La propagación y la cola vuelven porque tienen operaciones propias que el motor no
    // expone; esconderlas obligaría a montarlas dos veces sobre el mismo estado.
    assert.ok(el.propagacion, 'el motor del mapa activo no devuelve la propagación de rumores');
    assert.ok(el.cola, 'el motor del mapa activo no devuelve la cola de entregas');
  });

  test('Los productores son los dos que el paquete declara y en su orden', () => {
    // **Se leen, no se eligen.** Si esta capa pudiera decidir el orden, habría dos sitios
    // opinando sobre en qué orden salen los efectos de un paso.
    assert.deepEqual(armado().productores, ['rumores', 'entregas']);
    assert.deepEqual([...PRODUCTORES_DE_LA_PARTIDA], ['rumores', 'entregas'], 'el paquete ha cambiado sus productores y esta capa seguiría copiándolos sin enterarse');
    assert.deepEqual([...DEL_NUCLEO], ['creaMotorDeLaPartida', 'PRODUCTORES_DE_LA_PARTIDA'], 'lo que esta orquestación le pide al núcleo ha cambiado sin decirlo');
  });

  test('El motor del mapa activo no arranca sin sus piezas', () => {
    // Salir adelante sin el núcleo haría que «nadie lo cableó» y «no hay mapa levantado»
    // dieran el mismo resultado, que es exactamente la confusión que este módulo evita.
    assert.throws(() => creaMotorDelMapaActivo({ nucleo: null, estado: partida(), mundo: mapa() }), /núcleo/);
    assert.throws(
      () => creaMotorDelMapaActivo({ nucleo: { creaMotorDeLaPartida }, estado: partida(), mundo: mapa() }),
      /PRODUCTORES_DE_LA_PARTIDA/,
      'falta una pieza del núcleo y el motor se arma igual: la pieza que no está tiene que protestar',
    );
  });

  test('Lo que produce un paso entra en las áreas vivas y sobrevive a congelar', () => {
    const estado = partida();
    const el = armado({ estado });
    el.motor.avanza(3);

    // Las áreas son **las mismas**, no copias: el motor las muta en sitio y son las que se
    // congelan. Con copias, un paso del día a día se perdería al cerrar la app.
    assert.equal(el.motor.registro().n, 3, 'el contador del mapa activo no se ha movido');
    assert.equal(estado.pasos.mapas[MAPA].n, 3, 'el contador de la partida no se ha movido: el motor está avanzando otras áreas');

    const vuelta = levantaEstado(congelaEstado(estado));
    assert.equal(vuelta.pasos.mapas[MAPA].n, 3, 'el contador no sobrevive a congelar y volver a abrir');
    assert.deepEqual(congelaEstado(vuelta).areas.rumores, congelaEstado(estado).areas.rumores, 'lo que la propagación dejó en el área de rumores no sobrevive a congelar');
  });
});

// ── Sin mapa no hay dónde acreditar ─────────────────────────────────────────────

describe('Sin mapa levantado no se acredita ningún metro', () => {
  test('Sin mapa levantado no se acredita ningún metro', () => {
    // El identificador de relleno con el que la raíz espera mientras no hay mapa. Acreditarle
    // pasos movería el mundo de casa mientras andas fuera, que es lo que `exigeMapaId` dice
    // en su propio error.
    for (const mundo of [null, {}, { mapaId: 'sin-mapa', documento: mundoLineal(NUCLEOS) }, { mapaId: MAPA, documento: null }]) {
      const el = creaMotorDelMapaActivo({ nucleo, estado: partida(), mundo });
      assert.equal(el.motor, null, `se ha armado un motor con ${JSON.stringify(mundo)} como mapa levantado`);
      assert.equal(el.mapaId, null, 'un motor que no existe declara a qué mapa acredita');
      assert.equal(el.motivo, MOTIVOS_SIN_MOTOR.SIN_MAPA, 'no se dice por qué no hay motor, y sin motivo esto no se distingue de que nadie lo cableara');
    }
  });

  test('Sin partida abierta el motivo es otro, y por eso son dos y no uno', () => {
    // Dos motivos porque se arreglan en sitios distintos: uno se cierra levantando un mapa y
    // el otro abriendo una partida. Uno solo los haría indistinguibles en el sitio donde más
    // se parecen, que es la pantalla que dice que no se pudo.
    const el = creaMotorDelMapaActivo({ nucleo, estado: null, mundo: mapa() });
    assert.equal(el.motor, null);
    assert.equal(el.motivo, MOTIVOS_SIN_MOTOR.SIN_PARTIDA);
    assert.notEqual(MOTIVOS_SIN_MOTOR.SIN_PARTIDA, MOTIVOS_SIN_MOTOR.SIN_MAPA);
  });
});

// ── La reserva del mapa activo, y solo la de ese ────────────────────────────────

describe('La reserva de fondo va al mapa activo', () => {
  test('Los metros que la app de salud da al abrir llenan la reserva del mapa activo', () => {
    const estado = partida();
    const el = armado({ estado });
    const dados = kilometrosDeFondo({ motor: el.motor, metros: 3 * TRAMO, activos: true, tramo: TRAMO });

    assert.equal(dados.pasos.length, 3, 'tres tramos de metros no han dado tres pasos');
    assert.equal(tamanoDeLaReserva(el.motor), 3, 'los pasos no han quedado en la reserva del mapa activo');
    assert.equal(tamanoDeLaReserva(armado({ estado, mundo: mapa(OTRO_MAPA) }).motor), 0, 'la reserva del otro mapa de la partida se ha movido');
  });

  test('Los kilómetros de fondo no tocan la reserva del mapa que no es el activo', () => {
    // Dos mapas en la misma partida y **un solo motor**, el del activo en el momento de abrir
    // la app. La reserva es por mapa: acreditar al otro sería mover el mundo de donde no
    // estás, que es la misma razón por la que sin mapa no se acredita nada.
    const estado = partida();
    kilometrosDeFondo({ motor: armado({ estado, mundo: mapa(OTRO_MAPA) }).motor, metros: 2 * TRAMO, activos: true, tramo: TRAMO });
    assert.equal(tamanoDeLaReserva(armado({ estado, mundo: mapa(OTRO_MAPA) }).motor), 2);
    assert.equal(tamanoDeLaReserva(armado({ estado }).motor), 0);

    kilometrosDeFondo({ motor: armado({ estado }).motor, metros: 1 * TRAMO, activos: true, tramo: TRAMO });
    assert.equal(tamanoDeLaReserva(armado({ estado }).motor), 1, 'el mapa que pasa a ser el activo no recibe sus propios kilómetros');
    assert.equal(tamanoDeLaReserva(armado({ estado, mundo: mapa(OTRO_MAPA) }).motor), 2, 'la reserva del otro mapa ha cambiado al acreditar en el activo');
  });

  test('El contenido de un paso lo decide su número', () => {
    // Bloqueante (`@determinismo`). Dos aperturas con la misma semilla, el mismo mapa y los
    // mismos metros leídos dan los mismos pasos, con los mismos números y los mismos efectos.
    const uno = partida();
    const otro = partida();
    kilometrosDeFondo({ motor: armado({ estado: uno }).motor, metros: 4 * TRAMO, activos: true, tramo: TRAMO });
    kilometrosDeFondo({ motor: armado({ estado: otro }).motor, metros: 4 * TRAMO, activos: true, tramo: TRAMO });

    // Por serialización completa y no campo a campo, que es lo único que afirma «idéntico».
    assert.equal(textoDeEstado(uno), textoDeEstado(otro));
  });

  test('En el motor del mapa activo no aparece ninguna fuente de azar ni de reloj', () => {
    const codigo = fuente('app/salida/motor.js');
    for (const prohibido of [/Math\.random/, /Date\.now/, /new Date\b/]) {
      assert.doesNotMatch(codigo, prohibido, `app/salida/motor.js usa ${prohibido}: el mundo dejaría de ser una función de la semilla`);
    }
    // Y las producciones entran **declaradas en nulo**, que es distinto de olvidadas: la cola
    // no inventa entradas en un paso sin fuente de producciones, y esa fuente es de otra fila.
    assert.match(codigo, /producciones: null/, 'las producciones han dejado de entrar declaradas en nulo, y sin declaración nadie sabrá si faltan o sobran');
  });
});
