// B2 · Las costuras entre filas: lo que ninguna prueba de una sola fila veía.
//
// Las ocho filas del bloque cerraron con mil casos en verde y la simulación de
// partida completa —el entregable que el PRD promete para B2— destapó cuatro
// defectos igualmente. Los cuatro vivían **entre** filas, y cada fila probaba su
// lado: el contrato del día se declaraba en dos sitios distintos, la procedencia de
// un objeto era un objeto para quien lo entregaba y un texto para quien lo guardaba,
// el prólogo alimentaba un cálculo que no era suyo, y dos módulos llevaban bytes NUL
// dentro de sus literales.
//
// De ahí la forma de este fichero, que es su única razón de existir: **recorre el
// camino entero y no llama a ninguna pieza por dentro**. La prueba que habría cazado
// el defecto del congelado no es una de `congelaObjetos`: es una que cierra una
// salida de verdad y congela el sobre. Las que ya existían llamaban a
// `congelaObjetos` directamente y se saltaban el sobre, que es justo donde estaba el
// choque.
//
// Todo lo de aquí va declarado como hueco de la batería en test/spec-test-map.json:
// docs/testing.md no tiene características de costura, porque una costura no es de
// nadie. Nada toca la red, el reloj del sistema ni el azar: el día y el paso los
// escribe la prueba, y el mundo del prólogo es sintético.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { entradaDeDiario, apunta, entradasDe } from '../../packages/nucleo/partida/diario.js';
import { congelaEstado, estadoInicial, levantaEstado, textoDeEstado } from '../../packages/nucleo/partida/estado.js';
import { congelaObjetos, objetoPersistente, objetosDe, tieneObjeto } from '../../packages/nucleo/partida/objetos.js';
import { cierraSalidaDeProgresion, saldoDe } from '../../packages/nucleo/partida/oro.js';
import { loQueSeCuentaEn } from '../../packages/nucleo/partida/nucleos.js';
import { correPrologo } from '../../packages/nucleo/partida/prologo.js';
import { arbolDeCalzadas } from '../../packages/nucleo/partida/rumores.js';
import { escalonPara, rangoEn } from '../../packages/nucleo/partida/rango.js';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { SEMILLA, MAPA, SIGNOS, CLASES_DE_ENTRADA, FUENTES, hechosDe } from './diario-de-prueba.mjs';
import { PARTIDA, TRAMO, SEMILLA_A, mundoSintetico } from './prologo-de-prueba.mjs';
import { avanza, desenlaceEn, propagacionSobre } from './rumor-de-prueba.mjs';

/** El día del calendario de la partida en el que ocurre todo lo de aquí. */
const DIA = 3;

/**
 * El desenlace que rompía el congelado: entrega un objeto y **no declara su
 * procedencia**, que es el caso normal —la pone quien cierra la salida— y el que
 * ninguna prueba de la fila 15 pasaba por el sobre.
 */
const DESENLACE = {
  id: 'd1',
  oro: 17,
  plantilla: 'entrega-sospechosa',
  lugar: { id: 'Monfrida' },
  objetos: [{ id: 'paquete', clase: 'llave' }],
};

/** Una partida en curso: se cierra una salida de verdad y se apunta lo que se oyó. */
function partidaJugada() {
  const partida = estadoInicial({ semilla: SEMILLA });
  const cierre = cierraSalidaDeProgresion({
    oro: partida.oro,
    objetos: partida.objetos,
    motes: partida.motes,
    mapaId: MAPA,
    desenlace: DESENLACE,
    dia: DIA,
  });
  apunta(partida.diario, entradaDeDiario({
    mapa: MAPA,
    clase: CLASES_DE_ENTRADA.PROPIO,
    suceso: 'lo-del-paquete',
    fuente: { tipo: FUENTES.NUCLEO, sitio: 'Monfrida' },
    lugar: 'Monfrida',
    dia: DIA,
    paso: 12,
    hechos: hechosDe({ asunto: 'llevaste el paquete', veces: 1 }),
    nivel: 0,
    signo: SIGNOS.BUENO,
    plantilla: 'entrega-sospechosa',
    origen: 'Monfrida',
  }));
  return { partida, cierre };
}

describe('Una partida completa se congela y se levanta', () => {
  test('Una partida en la que un desenlace entregó un objeto se congela y se levanta entera', () => {
    const { partida, cierre } = partidaJugada();
    assert.equal(cierre.objetos.length, 1, 'el desenlace no ha entregado nada y el caso no afirma nada');
    assert.equal(tieneObjeto(partida.objetos, 'paquete'), true);

    // El sobre entero, que es la puerta por la que se guarda de verdad. Lo que fallaba
    // era esto y no `congelaObjetos`: la repisa se escribe bien y el esquema del
    // estado la rechazaba.
    const doc = congelaEstado(partida);
    const texto = textoDeEstado(partida);
    const vuelta = levantaEstado(JSON.parse(JSON.stringify(doc)));

    // Y vuelve entera: el objeto con la procedencia que le puso quien cerró la salida,
    // su día, la bolsa y la entrada del diario.
    const repisa = objetosDe(vuelta.objetos);
    assert.equal(repisa.length, 1, 'el objeto no ha sobrevivido al guardado');
    assert.deepEqual(repisa[0].procedencia, { desenlace: 'd1', plantilla: 'entrega-sospechosa', lugar: 'Monfrida' });
    assert.equal(repisa[0].dia, DIA);
    assert.equal(saldoDe(vuelta.oro), 17);
    assert.equal(entradasDe(vuelta.diario, { mapaId: MAPA }).length, 1);

    // Byte a byte: guardar lo levantado da el mismo documento que guardar lo vivo.
    assert.equal(textoDeEstado(vuelta), texto, 'la ida y vuelta por el sobre ha cambiado el documento');
  });

  test('Congelar la repisa por su cuenta no demuestra que la partida se pueda guardar', () => {
    // El caso que explica por qué mil pruebas en verde no vieron el defecto, escrito
    // como afirmación para que nadie vuelva a confundir una cosa con la otra: la
    // repisa sola se congela sin quejarse, y el sobre es quien valida contra el
    // esquema cerrado. Probar la pieza no es probar el camino.
    const { partida } = partidaJugada();
    const soloLaRepisa = congelaObjetos(partida.objetos);
    assert.equal(soloLaRepisa.objetos.length, 1);
    assert.equal(typeof soloLaRepisa.objetos[0].procedencia, 'object');

    const doc = congelaEstado(partida);
    assert.deepEqual(doc.areas.objetos, soloLaRepisa, 'el sobre guarda una repisa distinta de la que entrega objetos.js');

    // Y el sobre sí rechaza una procedencia que no sea la estructurada, nombrando el
    // campo en lugar de perderlo.
    const roto = JSON.parse(JSON.stringify(doc));
    roto.areas.objetos.objetos[0].procedencia = 'Monfrida';
    assert.throws(() => levantaEstado(roto), /procedencia/);
  });
});

describe('Un solo contrato para el día', () => {
  test('El día es un entero no negativo en los dos consumidores', () => {
    // El defecto era exactamente este: `objetoPersistente` pedía texto y
    // `entradaDeDiario` pedía entero, y el primero que cruzara de un lado al otro se
    // rompía. Se afirma sobre los dos a la vez, que es la única manera de que un solo
    // contrato signifique algo.
    const objetoCon = (dia) => objetoPersistente({ id: 'paquete', clase: 'llave', dia });
    const entradaCon = (dia) => entradaDeDiario({
      mapa: MAPA,
      suceso: 'lo-del-paquete',
      fuente: { tipo: FUENTES.NUCLEO, sitio: 'Monfrida' },
      lugar: 'Monfrida',
      dia,
      paso: 1,
      hechos: hechosDe({}),
      nivel: 0,
      signo: SIGNOS.BUENO,
    });

    for (const dia of [0, 1, 3, 999]) {
      assert.equal(objetoCon(dia).dia, dia, `el objeto no acepta el día ${dia}`);
      assert.equal(entradaCon(dia).dia, dia, `la entrada del diario no acepta el día ${dia}`);
    }
    for (const malo of ['2026-08-08', '3', -1, 1.5, null, undefined, true, {}]) {
      const cual = JSON.stringify(malo) ?? String(malo);
      assert.throws(() => objetoCon(malo), `el objeto acepta el día ${cual}`);
      assert.throws(() => entradaCon(malo), `la entrada del diario acepta el día ${cual}`);
    }

    // Y el documento lo declara igual en los dos sitios: el día del objeto y el día de
    // la entrada salen los dos como número.
    const { partida } = partidaJugada();
    const doc = congelaEstado(partida);
    assert.equal(typeof doc.areas.objetos.objetos[0].dia, 'number');
    assert.equal(typeof doc.areas.diario.entradas[0].dia, 'number');

    const roto = JSON.parse(JSON.stringify(doc));
    roto.areas.objetos.objetos[0].dia = '2026-08-08';
    assert.throws(() => levantaEstado(roto), /dia/);
  });
});

describe('El prólogo no infla el rango antes de jugar', () => {
  /** Diez núcleos en cadena: el mapa sobre el que se midió el defecto. */
  const NUCLEOS = ['Albariza', 'Bermeda', 'Cobreira', 'Dorna', 'Ermida', 'Fontela', 'Grixoa', 'Herbón', 'Illas', 'Xuvia'];

  function mapaConPrologo() {
    const mundo = mundoSintetico({
      nucleos: NUCLEOS,
      casting: [{ id: 'a1', en: ['Albariza', 'Cobreira'] }, { id: 'a2', en: ['Dorna', 'Ermida'] }],
    });
    const corrido = correPrologo({ semilla: SEMILLA_A, mapaId: MAPA, mundo, tramoM: TRAMO, partida: PARTIDA });
    return { mundo, arbol: arbolDeCalzadas(mundo), ...corrido };
  }

  /** Cuántos núcleos hay en cada escalón, que es la cifra con la que se midió. */
  function reparto(escalonDe) {
    const cuenta = { forasteria: 0, nombradia: 0, pertenencia: 0 };
    for (const nucleo of NUCLEOS) cuenta[escalonDe(nucleo)]++;
    return cuenta;
  }

  test('Los diez núcleos amanecen en el escalón de partida el día 1', () => {
    const { nucleos, arbol } = mapaConPrologo();

    // Lo que el prólogo sembró llegó: no es que el mapa esté vacío.
    const oido = NUCLEOS.filter((n) => loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo: n }).length > 0);
    assert.equal(oido.length, NUCLEOS.length, 'el prólogo no ha contado nada en algún núcleo y el caso no afirma nada');

    // Sin mirar de quién se habla, los diez pueblos amanecerían conociéndote: nueve en
    // nombradía y uno en pertenencia. Es la cifra del defecto, y se mide aquí para que
    // el caso siga significando algo si alguien quita el filtro.
    const sinMirarProtagonista = (nucleo) => escalonPara(
      new Set(loQueSeCuentaEn(nucleos, { mapaId: MAPA, nucleo }).map((v) => v.rumor)).size,
    );
    assert.deepEqual(reparto(sinMirarProtagonista), { forasteria: 0, nombradia: 9, pertenencia: 1 });

    // Y mirándolo, que es lo que hace el rango: los diez en el escalón de partida,
    // porque nada de lo que se cuenta es de la jugadora.
    const conElRango = (nucleo) => rangoEn(nucleos, { mapaId: MAPA, nucleo, mapa: arbol }).escalon;
    assert.deepEqual(reparto(conElRango), { forasteria: 10, nombradia: 0, pertenencia: 0 });
  });

  test('El rango sube solo después de un desenlace de la jugadora', () => {
    const { mundo, arbol, rumores, nucleos } = mapaConPrologo();
    const conElRango = (nucleo) => rangoEn(nucleos, { mapaId: MAPA, nucleo, mapa: arbol }).escalon;
    assert.deepEqual(reparto(conElRango), { forasteria: 10, nombradia: 0, pertenencia: 0 });

    // La jugadora cierra una salida en «Albariza» y la noticia viaja por las calzadas.
    const { prop } = propagacionSobre(mundo, { tramo: TRAMO, mapaId: MAPA, estado: rumores, nucleos, arbol });
    prop.nace(desenlaceEn('Albariza', { id: 'lo-mio' }), 0);
    avanza(prop, 10);

    const despues = reparto(conElRango);
    assert.ok(despues.nombradia > 0, 'un desenlace de la jugadora no ha movido ningún rango');
    assert.ok(despues.forasteria < 10, 'el rango no ha subido en ningún núcleo');
    assert.equal(conElRango('Albariza'), 'nombradia', 'donde ocurrió no ha subido');
  });
});

describe('Los ficheros del paquete son texto', () => {
  test('Ningún fichero de packages/ contiene un byte NUL', () => {
    // Barato y estructural: un NUL dentro de un literal de plantilla hace que `file` y
    // `grep` traten el módulo como binario, y no hay ninguna prueba de comportamiento
    // que se ponga roja por eso. Se comprueba el paquete entero y no los dos módulos
    // donde apareció, porque lo que hay que impedir es que vuelva a cualquier sitio.
    const raiz = join(RAIZ_REPO, 'packages');
    const sucios = [];
    let vistos = 0;

    const recorre = (dir) => {
      for (const nombre of readdirSync(dir).sort()) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) {
          recorre(ruta);
          continue;
        }
        vistos++;
        if (readFileSync(ruta).includes(0)) sucios.push(relative(RAIZ_REPO, ruta));
      }
    };
    recorre(raiz);

    assert.ok(vistos > 0, 'no se ha inspeccionado ni un fichero del paquete');
    assert.deepEqual(sucios, [], 'algún fichero del paquete lleva un byte NUL dentro');
  });
});
