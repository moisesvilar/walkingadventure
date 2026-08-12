// SPEC-050 · Que el prólogo llegue al estado de la partida, que es lo que hasta esta fila
// no pasaba.
//
// El prólogo se componía entero y se tiraba: `App.js` recibía el resultado y no lo usaba en
// ninguna línea, así que el mundo nacía sin rumores sedimentados, sin nada que contar en sus
// núcleos, sin par y con la cola vacía. `siembraLaCola` no tenía ningún llamador de
// producción y en un teléfono no podía saltar ni un micro-encuentro. Es §6h en su variante
// de cableado, y lo que estas pruebas fijan es la mitad que faltaba.
//
// Van en `@nucleo` porque lo que se afirma es del estado y no de ninguna pantalla: qué queda
// escrito en las áreas de la partida y qué sobrevive a congelarla y volverla a abrir.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { congelaEstado, estadoInicial, levantaEstado } from '../../packages/nucleo/partida/estado.js';
import { pendientes } from '../../packages/nucleo/partida/entregas.js';
import { loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { correPrologo, guardaElPrologo, tienePrologo } from '../../packages/nucleo/partida/prologo.js';
import { MAPA, PARTIDA, SEMILLA_A, TRAMO, mundoSintetico } from './prologo-de-prueba.mjs';

/** El otro mapa de la partida, el de vacaciones. Su nombre es su anclaje, como en el juego. */
const OTRO_MAPA = 'vacaciones';

/** Un mundo con cadena suficiente para que el prólogo tenga dónde sembrar y a quién contárselo. */
function mundo() {
  return mundoSintetico({ cadenas: [['Monfrida', 'Vilanova', 'Riba', 'Cotarelo']] });
}

/** El prólogo de un mapa, corrido sobre áreas frescas como lo hace el arranque. */
function prologoDe(mapaId = MAPA, opciones = {}) {
  return correPrologo({
    semilla: SEMILLA_A,
    mapaId,
    mundo: mundo(),
    tramoM: TRAMO,
    partida: PARTIDA,
    ...opciones,
  });
}

describe('El prólogo llega a la partida y no se tira', () => {
  test('La partida guarda las entradas que el prólogo dejó, y quedan pendientes en su cola', () => {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const prologo = prologoDe();
    assert.ok(prologo.entregas.length > 0, 'el prólogo de este mundo tiene que sembrar algo, o la prueba no mide nada');

    const sembradas = guardaElPrologo(estado, prologo);

    assert.equal(sembradas.length, prologo.entregas.length, 'se encolan todas las que el prólogo dejó, ni una menos');
    assert.equal(pendientes(estado.entregas, { mapaId: MAPA }).length, sembradas.length);
  });

  test('La partida guarda los rumores sedimentados y lo que se cuenta en cada núcleo', () => {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const prologo = prologoDe();

    assert.equal(tienePrologo({ rumores: estado.rumores, mapaId: MAPA }), false, 'antes de guardarlo, el mapa no tiene pasado');
    guardaElPrologo(estado, prologo);
    assert.equal(tienePrologo({ rumores: estado.rumores, mapaId: MAPA }), true);

    // Y lo que se cuenta en los núcleos, que es lo que `app/marcha/llegadas.js` lee al llegar
    // a uno: hasta esta fila era **siempre** una lista vacía, porque nadie lo trasladaba.
    const conAlgoQueContar = mundo().settlements.filter(
      (n) => loQueSeCuentaEn(estado.nucleos, { mapaId: MAPA, nucleo: n.name }).length > 0,
    );
    assert.ok(conAlgoQueContar.length > 0, 'algún núcleo del mapa tiene que tener algo que contar tras el prólogo');
  });

  test('El par compuesto por el prólogo queda en el arranque de la partida', () => {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const prologo = prologoDe();
    guardaElPrologo(estado, prologo);
    assert.deepEqual(estado.arranque.par, prologo.par, 'el par del arranque es el que compuso el prólogo, o su ausencia');
  });

  test('Un mapa marcado sin contenido jugable se guarda sin sembrar nada y sin fallar', () => {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    const prologo = prologoDe(MAPA, { sinContenidoJugable: true });

    const sembradas = guardaElPrologo(estado, prologo);

    assert.deepEqual(sembradas, [], 'sin contenido jugable no hay nada que encolar');
    assert.deepEqual(pendientes(estado.entregas, { mapaId: MAPA }), []);
  });

  test('El prólogo de un mapa no se guarda dos veces', () => {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    guardaElPrologo(estado, prologoDe());
    // Es la misma negativa que `asienta` hace dentro del prólogo: una partida cargada de un
    // respaldo no vuelve a ejecutarlo, y sin esto «se cargó» y «se volvió a correr» serían
    // indistinguibles desde fuera.
    assert.throws(() => guardaElPrologo(estado, prologoDe()), /ya tiene su prólogo guardado/);
  });

  test('Guardar el prólogo sobre algo que no es el estado de la partida falla nombrándolo', () => {
    assert.throws(() => guardaElPrologo(null, prologoDe()), /estado vivo de la partida/);
    assert.throws(() => guardaElPrologo({ semilla: SEMILLA_A }, prologoDe()), /estado vivo de la partida/);
  });

  test('Guardar algo que no es un prólogo corrido falla nombrando lo que llegó', () => {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    assert.throws(() => guardaElPrologo(estado, null), /correPrologo/);
    assert.throws(() => guardaElPrologo(estado, { mapaId: MAPA }), /correPrologo/);
  });

  test('Lo que el prólogo dejó sobrevive a congelar la partida y volver a abrirla', () => {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    guardaElPrologo(estado, prologoDe());

    const devuelta = levantaEstado(congelaEstado(estado), 'la partida recién abierta');

    assert.equal(pendientes(devuelta.entregas, { mapaId: MAPA }).length, pendientes(estado.entregas, { mapaId: MAPA }).length);
    assert.equal(tienePrologo({ rumores: devuelta.rumores, mapaId: MAPA }), true);
    assert.deepEqual(devuelta.arranque.par, estado.arranque.par);
  });

  test('Dos partidas con la misma semilla encolan lo mismo y en el mismo orden', () => {
    const unaCola = () => {
      const estado = estadoInicial({ semilla: SEMILLA_A });
      guardaElPrologo(estado, prologoDe());
      return pendientes(estado.entregas, { mapaId: MAPA }).map((e) => `${e.tipo}:${e.asunto}:${e.escena}`);
    };
    assert.deepEqual(unaCola(), unaCola(), 'la siembra es determinista o el mundo no lo es');
  });
});

describe('El segundo mapa de una partida también tiene pasado', () => {
  /** Una partida con su primer mapa ya vivido, que es sobre la que se levanta el segundo. */
  function conElMapaDeCasa() {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    guardaElPrologo(estado, prologoDe(MAPA));
    return estado;
  }

  test('El prólogo del mapa nuevo no toca lo sedimentado en el de casa', () => {
    const estado = conElMapaDeCasa();
    const deCasa = pendientes(estado.entregas, { mapaId: MAPA }).length;

    guardaElPrologo(estado, prologoDe(OTRO_MAPA, { primerMapa: false }));

    assert.equal(pendientes(estado.entregas, { mapaId: MAPA }).length, deCasa, 'la cola de casa se queda como estaba');
    assert.equal(tienePrologo({ rumores: estado.rumores, mapaId: MAPA }), true);
    assert.equal(tienePrologo({ rumores: estado.rumores, mapaId: OTRO_MAPA }), true);
  });

  test('Cada mapa tiene su cola y ninguna entrada cruza de mapa', () => {
    const estado = conElMapaDeCasa();
    guardaElPrologo(estado, prologoDe(OTRO_MAPA, { primerMapa: false }));

    const deCasa = pendientes(estado.entregas, { mapaId: MAPA });
    const deFuera = pendientes(estado.entregas, { mapaId: OTRO_MAPA });

    assert.ok(deFuera.length > 0, 'el mapa nuevo tiene que traer su propia cola');
    // La identidad de una entrada **se repite entre mapas a propósito** —se compone del asunto
    // y del núcleo de origen, y los dos mundos sintéticos comparten núcleos—, así que lo que se
    // afirma no es que los identificadores sean únicos sino que cada entrada declara de qué
    // mapa viene. Es lo que sostiene que la cola de casa no se ofrezca estando de vacaciones.
    assert.deepEqual([...new Set(deCasa.map((e) => e.procedencia.mapa))], [MAPA]);
    assert.deepEqual([...new Set(deFuera.map((e) => e.procedencia.mapa))], [OTRO_MAPA]);
  });

  test('Un mapa que no es el primero no compone par y no pisa el del arranque', () => {
    const estado = conElMapaDeCasa();
    const delArranque = estado.arranque.par;

    const prologo = prologoDe(OTRO_MAPA, { primerMapa: false });
    assert.equal(prologo.par, null, 'la puesta en escena es del arranque y solo del arranque');

    guardaElPrologo(estado, prologo);
    assert.deepEqual(estado.arranque.par, delArranque, 'levantar un mapa de vacaciones no reescribe el par de casa');
  });
});
