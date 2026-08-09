// SPEC-009 · El índice del mapa, el almacén inyectado, y lo que pasa al cargar
// cuando lo que hay está vacío, roto o falla.
//
// La partición en dos documentos —un índice por mapa y un documento por celda— no
// es estética, y aquí se ve por qué: el escenario «Abrir una celda vecina no toca
// la celda propia» exige que la celda propia siga idéntica **byte a byte**, y eso
// no se puede afirmar si las dos viven en el mismo fichero.
//
// Los mundos son sintéticos a propósito donde hace falta llegar al borde: los
// cuatro fixtures caben en menos de un kilómetro y nunca alcanzan el borde de una
// celda de cuatro. Nada de aquí toca la red ni el reloj del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CLAVES,
  abreCelda,
  cargaCelda,
  cargaMapa,
  celdaAbierta,
  celdasAbiertas,
  congelaIndice,
  costuras,
  creaMapa,
  estaCargada,
  exigeAlmacen,
  guardaCelda,
  guardaIndice,
  guardaMapa,
  levantaIndice,
  listaMapas,
  mundoDeCelda,
  pisa,
  textoDeIndice,
} from '../../packages/nucleo/partida/mapa.js';
import { congelaCelda, levantaCelda, textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { CLASES, VERSION_FORMATO, VERSION_GENERADOR, texto } from '../../packages/nucleo/partida/formato.js';
import { declaraTramo, cambiaTramo } from '../../packages/nucleo/partida/tramo.js';
import { incorporaMedida, mideRitmoDeSalida } from '../../packages/nucleo/partida/ritmo.js';
import { limitesDeCelda, proyectorDeRejilla } from '../../packages/nucleo/world/rejilla.js';
import { PRECISION_M } from '../../packages/nucleo/core/geo.js';
// El catálogo de estilos vive en el PROTOTIPO web, que SPEC-020 mudó de app/ a
// prototipo/: app/ es ahora la app de Expo. Solo se mueve la ruta — lo que se
// verifica con estos estilos no cambia.
import { STYLES, getStyle } from '../../prototipo/js/render/styles.js';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import { simulaRecorrido } from '../dobles/gps-simulado.mjs';
import { SEMILLA_A, consultaDeFixture, consultaSintetica, coordenadaDe, serializado } from './celda-de-prueba.mjs';
import {
  KB,
  almacenEnMemoria,
  almacenQueFallaAlEscribir,
  bytesDe,
  celdaDeFixture,
  recorreDocumento,
  trazaDesdeRecorrido,
} from './partida-de-prueba.mjs';

const ARRANQUE = { lat: 42.407163, lon: -8.809274 };

/** Un mapa con su consulta sintética, que es la que llega al borde de la celda. */
function mapaSintetico({ semilla = SEMILLA_A, tramoM = 2000, arranque = ARRANQUE } = {}) {
  const mapa = creaMapa({ semilla, ...arranque, tramoM });
  return { mapa, consultaOsm: consultaSintetica(mapa.rejilla) };
}

/** Un mapa con dos celdas contiguas abiertas y guardadas. */
async function mapaConDosCeldas(opciones = {}) {
  const { mapa, consultaOsm } = mapaSintetico(opciones);
  const almacen = almacenEnMemoria();
  await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
  await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm });
  await guardaMapa(mapa, { almacen });
  return { mapa, almacen, consultaOsm };
}

describe('Un documento por celda, un índice por mapa', () => {
  test('Abrir una celda vecina no toca la celda propia', async () => {
    // El escenario, afirmado aquí **sobre el documento**: no basta con que la celda
    // en memoria no cambie, tiene que seguir siendo el mismo texto en el almacén.
    const { mapa, consultaOsm } = mapaSintetico();
    const almacen = almacenEnMemoria();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    await guardaCelda(mapa, { i: 0, j: 0 }, { almacen });
    const propiaAntes = almacen.datos.get(CLAVES.celda(mapa.id, '0,0'));
    assert.ok(propiaAntes, 'no se ha escrito el documento de la celda propia');

    const destino = limitesDeCelda(mapa.rejilla, { i: 1, j: 0 }).centro;
    const pisada = await pisa(mapa, destino.lat, destino.lon, { consultaOsm });
    assert.equal(pisada.generada, true, 'pisar la celda vecina no la ha generado');
    await guardaCelda(mapa, { i: 1, j: 0 }, { almacen });

    assert.equal(almacen.datos.get(CLAVES.celda(mapa.id, '0,0')), propiaAntes, 'el documento de la celda propia ha cambiado al abrirse la vecina');
    assert.equal(textoDeCelda(celdaAbierta(mapa, { i: 0, j: 0 })), propiaAntes, 'la celda propia ya no se congela igual que antes');
    assert.notEqual(almacen.datos.get(CLAVES.celda(mapa.id, '1,0')), propiaAntes, 'las dos celdas dan el mismo documento: no se está comprobando nada');

    // Y las dos celdas viven en documentos distintos, que es lo que hace afirmable
    // el «byte a byte»: con un solo fichero por mapa, cada celda nueva lo reescribe.
    assert.notEqual(CLAVES.celda(mapa.id, '0,0'), CLAVES.celda(mapa.id, '1,0'));
    assert.equal(CLAVES.indice(mapa.id).startsWith(CLAVES.prefijoDeMapa(mapa.id)), true);
  });

  test('El índice declara las dos celdas abiertas y la costura del borde que comparten', async () => {
    const { mapa, almacen } = await mapaConDosCeldas();
    const indice = JSON.parse(almacen.datos.get(CLAVES.indice(mapa.id)));

    assert.equal(indice.clase, CLASES.INDICE);
    assert.equal(indice.version, VERSION_FORMATO);
    assert.equal(indice.generador, VERSION_GENERADOR);
    assert.deepEqual(indice.celdas.map((c) => c.clave), ['0,0', '1,0']);
    for (const ficha of indice.celdas) {
      assert.ok(['pisada', 'acontecimiento'].includes(ficha.motivo), `motivo desconocido en el índice: ${ficha.motivo}`);
      assert.equal(typeof ficha.sinContenidoJugable, 'boolean');
    }
    assert.equal(indice.costuras.length, 1, 'el índice no declara la costura del borde compartido');
    const [costura] = indice.costuras;
    assert.deepEqual(costura.celdas, ['0,0', '1,0']);
    assert.equal(costura.contiguas, true);
    assert.ok(costura.aristas.length > 0, 'la costura no lleva ni una arista de calzada cosida en el borde');
    assert.equal(costura.borde.eje, 'x');
    for (const arista of costura.aristas) {
      assert.equal(typeof arista.metros, 'number');
      assert.equal(typeof arista.suposicion, 'boolean', 'una arista de costura no declara si es suposición');
    }

    // El índice es pequeño y el mundo no está dentro: se lee siempre.
    assert.equal(Object.prototype.hasOwnProperty.call(indice, 'mundo'), false, 'el índice lleva el mundo dentro');
    assert.ok(bytesDe(almacen.datos.get(CLAVES.indice(mapa.id))) < bytesDe(almacen.datos.get(CLAVES.celda(mapa.id, '0,0'))), 'el índice no es más pequeño que una celda');
  });

  test('El identificador del índice es el anclaje redondeado del mapa', async () => {
    const { mapa, almacen } = await mapaConDosCeldas();
    const indice = JSON.parse(almacen.datos.get(CLAVES.indice(mapa.id)));

    assert.equal(indice.id, '42.41,-8.81', 'el identificador del mapa no es su anclaje redondeado');
    assert.deepEqual(indice.anclaje, { lat: 42.41, lon: -8.81 });
    assert.equal(indice.id, mapa.id);
    // Y la coordenada exacta del arranque no está en ningún campo del índice.
    for (const dato of [String(ARRANQUE.lat), String(ARRANQUE.lon)]) {
      assert.equal(almacen.datos.get(CLAVES.indice(mapa.id)).includes(dato), false, `la coordenada exacta del arranque (${dato}) está en el índice`);
    }
    // Dos jugadores que arrancan en portales distintos del mismo paso de redondeo
    // dejan el mismo índice: es la manera fuerte de decir que no se guarda dónde
    // estaban.
    const otroPortal = await mapaConDosCeldas({ arranque: { lat: 42.4119, lon: -8.8140 } });
    assert.equal(
      otroPortal.almacen.datos.get(CLAVES.indice(mapa.id)),
      almacen.datos.get(CLAVES.indice(mapa.id)),
      'el índice distingue dos portales del mismo paso de redondeo',
    );
  });

  test('En el índice del mapa no aparece la semilla de la partida', async () => {
    const { mapa, almacen } = await mapaConDosCeldas();
    const crudo = almacen.datos.get(CLAVES.indice(mapa.id));

    assert.equal(crudo.includes(SEMILLA_A), false, 'la semilla de la partida está en el índice del mapa');
    for (const costura of JSON.parse(crudo).costuras) {
      assert.equal(Object.prototype.hasOwnProperty.call(costura, 'semilla'), false, 'una costura guarda su semilla, que se deriva de la de la partida');
    }
    // Y se recompone al cargar, con la semilla que ya tiene quien abre la partida.
    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    assert.equal(typeof cargado.costuras[0].semilla, 'string');
    assert.ok(cargado.costuras[0].semilla.length > 0, 'la semilla de la costura no se ha recompuesto al cargar');
  });

  test('Cargar un mapa de veinte celdas lee el índice y ninguna celda', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    const almacen = almacenEnMemoria();
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) await abreCelda(mapa, { i, j }, { consultaOsm });
    assert.equal(celdasAbiertas(mapa).length, 20);
    await guardaMapa(mapa, { almacen });

    almacen.registro.length = 0;
    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    assert.deepEqual(almacen.operaciones('lee'), [CLAVES.indice(mapa.id)], 'cargar el mapa ha leído algo más que el índice');
    assert.equal(cargado.celdas.length, 20);
    for (const ficha of cargado.celdas) {
      assert.equal(estaCargada(ficha), false, `la celda ${ficha.clave} se ha cargado sin que hiciera falta`);
      assert.throws(() => mundoDeCelda(cargado, ficha.celda), /no se ha cargado todavía/, 'una ficha ha pasado por un registro con mundo');
    }

    // Y la celda que haga falta se lee entonces, y solo esa.
    almacen.registro.length = 0;
    const registro = await cargaCelda(cargado, { i: 2, j: 1 }, { almacen });
    assert.deepEqual(almacen.operaciones('lee'), [CLAVES.celda(mapa.id, '2,1')], 'cargar una celda ha leído más de un documento');
    assert.equal(estaCargada(registro), true);
    assert.ok(mundoDeCelda(cargado, { i: 2, j: 1 }).settlements.length > 0, 'la celda cargada no trae su mundo');
    assert.equal(cargado.celdas.filter((c) => estaCargada(c)).length, 1, 'se ha cargado más de una celda');

    // El índice de un mapa de veinte celdas cabe de sobra en su presupuesto.
    const bytes = bytesDe(textoDeIndice(mapa));
    assert.ok(bytes < 100 * KB, `el índice de veinte celdas ocupa ${(bytes / KB).toFixed(1)} KB y el presupuesto es 100 KB`);
  });

  test('Un índice que declara una celda que el almacén no tiene falla nombrando la celda', async () => {
    const { mapa, almacen } = await mapaConDosCeldas();
    almacen.datos.delete(CLAVES.celda(mapa.id, '1,0'));

    await assert.rejects(
      () => cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A }),
      (e) => {
        assert.match(e.message, /1,0/, `el error no nombra la celda que falta: ${e.message}`);
        return true;
      },
      'se ha cargado un mapa al que le falta el documento de una celda',
    );
  });

  test('Un mapa recién creado sin ninguna celda congelada se carga con cero celdas y ningún error', async () => {
    const mapa = creaMapa({ semilla: SEMILLA_A, ...ARRANQUE, tramoM: 2000 });
    const almacen = almacenEnMemoria();

    const indice = congelaIndice(mapa);
    assert.deepEqual(indice.celdas, []);
    assert.deepEqual(indice.costuras, []);
    assert.equal(indice.titulo, null, 'un mapa sin celdas declara un título que nadie ha generado');
    assert.equal(indice.idioma, null);

    await guardaMapa(mapa, { almacen });
    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    assert.deepEqual(cargado.celdas, []);
    assert.deepEqual(cargado.costuras, []);
    assert.equal(cargado.id, mapa.id);
    assert.deepEqual(cargado.anclaje, mapa.anclaje);
    assert.equal(cargado.rejilla.ladoM, mapa.rejilla.ladoM, 'la rejilla del mapa cargado no es la que se guardó');
  });

  test('El título y el idioma del mapa sobreviven a cargarlo y volver a guardarlo', async () => {
    // Un mapa cargado se vuelve a guardar cada vez que se abre una celda nueva. Si
    // el índice se reescribe sin lo que solo estaba en él, la partida pierde en
    // silencio la respuesta a «¿en qué mapa estoy?» sin cargar geometría.
    const { mapa, almacen } = await mapaConDosCeldas();
    const original = almacen.datos.get(CLAVES.indice(mapa.id));
    assert.ok(JSON.parse(original).titulo, 'el índice guardado no lleva título: el caso no comprueba nada');

    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    assert.equal(cargado.titulo, JSON.parse(original).titulo, 'el mapa cargado no recupera su título');

    await guardaIndice(cargado, { almacen });
    const reescrito = almacen.datos.get(CLAVES.indice(mapa.id));
    assert.equal(JSON.parse(reescrito).titulo, JSON.parse(original).titulo, 'volver a guardar el índice de un mapa cargado ha perdido su título');
    assert.equal(JSON.parse(reescrito).idioma, JSON.parse(original).idioma, 'volver a guardar el índice de un mapa cargado ha perdido su idioma');
    assert.equal(reescrito, original, 'el índice reescrito no es el mismo documento');
  });
});

describe('Lo generado no se resiembra jamás', () => {
  test('Cambiar el tramo del jugador no redimensiona un mundo ya generado', async () => {
    // Afirmado sobre el documento: el tramo con el que se dimensionó la celda vive
    // congelado en su cabecera, así que recalibrar no puede moverlo.
    const { mapa, almacen } = await mapaConDosCeldas({ tramoM: 2000 });
    const antes = almacen.datos.get(CLAVES.celda(mapa.id, '0,0'));
    assert.equal(JSON.parse(antes).celda.tramoM, 2000);
    assert.equal(JSON.parse(antes).celda.ladoM, 4000);

    const tramo = cambiaTramo(declaraTramo('pueblo-de-al-lado'), 'vuelta-de-la-esquina');
    assert.equal(tramo.declaradoM, 300, 'el tramo no ha bajado: el caso no comprueba nada');

    await guardaCelda(mapa, { i: 0, j: 0 }, { almacen });
    assert.equal(almacen.datos.get(CLAVES.celda(mapa.id, '0,0')), antes, 'el documento de una celda ya generada ha cambiado al recalibrar el tramo');
    assert.equal(textoDeCelda(celdaAbierta(mapa, { i: 0, j: 0 })), antes, 'la celda ya generada se congela distinta después de recalibrar');
  });

  test('Cambiar el estilo de pintado no resiembra nada', async () => {
    // El estilo es solo pintado y vive fuera del paquete: lo que se puede afirmar
    // desde aquí es que recorrer los cinco no toca ni un byte del documento.
    const { mapa, almacen } = await mapaConDosCeldas();
    const antes = almacen.datos.get(CLAVES.celda(mapa.id, '0,0'));

    const ids = STYLES.map((s) => s.id);
    assert.ok(ids.includes('reino') && ids.includes('pergamino'), `faltan los estilos del escenario: ${ids.join(', ')}`);
    for (const id of ids) {
      assert.ok(getStyle(id), `el estilo ${id} no existe`);
      assert.equal(textoDeCelda(celdaAbierta(mapa, { i: 0, j: 0 })), antes, `leer el estilo ${id} ha cambiado el documento de la celda`);
    }
    assert.equal(almacen.datos.get(CLAVES.celda(mapa.id, '0,0')), antes, 'el documento guardado ha cambiado al cambiar de estilo');
  });

  test('El rastro de ubicación no se guarda nunca', async () => {
    // Cien salidas andadas, con el inspector delante: los documentos del mundo
    // antes y después son los mismos byte a byte, y en ninguno de sus campos hay
    // una posición ni un histórico de posiciones.
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const { mapa, almacen } = await mapaConDosCeldas();
      const antes = { indice: almacen.datos.get(CLAVES.indice(mapa.id)), celda: almacen.datos.get(CLAVES.celda(mapa.id, '0,0')) };

      const proy = proyectorDeRejilla(mapa.rejilla);
      const limites = limitesDeCelda(mapa.rejilla, { i: 0, j: 0 });
      const y = (limites.metros.minY + limites.metros.maxY) / 2;
      const polilinea = [proy.toLatLon({ x: limites.metros.minX + 100, y }), proy.toLatLon({ x: limites.metros.minX + 900, y })];

      let tramo = declaraTramo('otro-barrio');
      for (let salida = 0; salida < 100; salida++) {
        const posiciones = simulaRecorrido({ polilinea, velocidadKmH: 4.5, origenTiempoMs: salida * 3_600_000 });
        const medida = mideRitmoDeSalida(trazaDesdeRecorrido(posiciones));
        tramo = incorporaMedida(tramo, medida);
      }
      assert.ok(tramo.salidasMedidas > 0, 'no se ha medido ni una salida: el caso no comprueba nada');

      // Ni el mundo crece al andar ni lo que se guardó cambia.
      await guardaMapa(mapa, { almacen });
      assert.equal(almacen.datos.get(CLAVES.celda(mapa.id, '0,0')), antes.celda, 'el documento de la celda ha cambiado después de cien salidas');
      assert.equal(almacen.datos.get(CLAVES.indice(mapa.id)), antes.indice, 'el índice del mapa ha cambiado después de cien salidas');

      // Y ningún campo de ninguno de los dos documentos guarda una posición.
      const PROHIBIDAS = ['posicion', 'posiciones', 'ubicacion', 'ubicaciones', 'historico', 'rastro', 'traza', 'gps', 'salidas', 'recorrido'];
      for (const [donde, crudo] of Object.entries(antes)) {
        const encontradas = [];
        recorreDocumento(JSON.parse(crudo), (ruta) => {
          const ultima = ruta.split('.').pop();
          if (ultima && !ultima.includes('[') && PROHIBIDAS.includes(ultima)) encontradas.push(ruta);
        });
        assert.deepEqual(encontradas, [], `${donde}: hay campos de rastro de ubicación: ${encontradas.join(', ')}`);
      }
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico del móvil al andar cien salidas');
    } finally {
      inspector.suelta();
    }
  });
});

describe('Cargar: lo vacío, lo roto y lo que falla', () => {
  test('Un almacén sin ningún mapa devuelve una lista vacía y no un error', async () => {
    const almacen = almacenEnMemoria();
    assert.deepEqual(await listaMapas({ almacen }), []);

    const { mapa } = await mapaConDosCeldas();
    const conMapas = almacenEnMemoria();
    await guardaMapa(mapa, { almacen: conMapas });
    assert.deepEqual(await listaMapas({ almacen: conMapas }), [mapa.id]);
    await assert.rejects(() => cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A }), /no tiene el índice/, 'se ha cargado un mapa que el almacén no tiene');
  });

  test('Un documento truncado a la mitad falla nombrando el documento y no devuelve nada a medias', async () => {
    const { mapa, almacen } = await mapaConDosCeldas();
    const entero = almacen.datos.get(CLAVES.celda(mapa.id, '0,0'));
    almacen.datos.set(CLAVES.celda(mapa.id, '0,0'), entero.slice(0, Math.floor(entero.length / 2)));

    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    await assert.rejects(
      () => cargaCelda(cargado, { i: 0, j: 0 }, { almacen }),
      (e) => {
        assert.match(e.message, /0,0/, `el error no nombra el documento: ${e.message}`);
        assert.match(e.message, /roto o truncado/, e.message);
        return true;
      },
      'un documento truncado ha devuelto un mundo a medias',
    );
    assert.equal(estaCargada(cargado.celdas.find((c) => c.clave === '0,0')), false, 'ha quedado registrada una celda cargada a medias');

    // Y el índice truncado tampoco se abre.
    almacen.datos.set(CLAVES.indice(mapa.id), '{"version":1,"generador":"0.1.0","clase":"indice-de-map');
    await assert.rejects(() => cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A }), /roto o truncado/, 'un índice truncado se ha abierto');
  });

  test('Un documento al que le falta un campo obligatorio falla nombrando el campo', async () => {
    const { mapa, almacen } = await mapaConDosCeldas();
    const doc = JSON.parse(almacen.datos.get(CLAVES.celda(mapa.id, '0,0')));
    delete doc.cupos;
    almacen.datos.set(CLAVES.celda(mapa.id, '0,0'), JSON.stringify(doc));

    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    await assert.rejects(
      () => cargaCelda(cargado, { i: 0, j: 0 }, { almacen }),
      /falta el campo obligatorio "cupos"/,
      'un documento sin un campo obligatorio se ha levantado igual',
    );

    const indice = JSON.parse(almacen.datos.get(CLAVES.indice(mapa.id)));
    delete indice.ladoM;
    assert.throws(() => levantaIndice(indice, { semilla: SEMILLA_A }), /falta el campo obligatorio "ladoM"/, 'un índice sin un campo obligatorio se ha levantado');
  });

  test('Un almacén que falla al escribir propaga el error y deja intacto el documento anterior', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    const almacen = almacenEnMemoria();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    await guardaCelda(mapa, { i: 0, j: 0 }, { almacen });
    const bueno = almacen.datos.get(CLAVES.celda(mapa.id, '0,0'));

    // El mismo almacén, ahora roto: escribir se cae y no toca lo que había.
    almacen.escribe = async () => { throw new Error('el disco está lleno'); };
    await assert.rejects(() => guardaCelda(mapa, { i: 0, j: 0 }, { almacen }), /el disco está lleno/, 'el error del almacén no se ha propagado');
    assert.equal(almacen.datos.get(CLAVES.celda(mapa.id, '0,0')), bueno, 'el documento anterior ha cambiado al fallar la escritura');

    // Y el mapa entero: si falla al escribir una celda, no se escribe un índice que
    // declare lo que no está.
    const roto = almacenQueFallaAlEscribir({ soloClavesQueContengan: '/celda/' });
    await assert.rejects(() => guardaMapa(mapa, { almacen: roto }), /el disco está lleno/);
    assert.equal(roto.datos.has(CLAVES.indice(mapa.id)), false, 'se ha escrito el índice de un mapa cuyas celdas no se guardaron');
  });

  test('La misma celda congelada dos veces da documentos idénticos byte a byte', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });

    const primero = almacenEnMemoria();
    const segundo = almacenEnMemoria();
    await guardaCelda(mapa, { i: 0, j: 0 }, { almacen: primero });
    await guardaCelda(mapa, { i: 0, j: 0 }, { almacen: segundo });
    assert.equal(segundo.datos.get(CLAVES.celda(mapa.id, '0,0')), primero.datos.get(CLAVES.celda(mapa.id, '0,0')));

    // Y sobre el mismo almacén, sobrescribiendo: el texto es el mismo.
    const antes = primero.datos.get(CLAVES.celda(mapa.id, '0,0'));
    await guardaCelda(mapa, { i: 0, j: 0 }, { almacen: primero });
    assert.equal(primero.datos.get(CLAVES.celda(mapa.id, '0,0')), antes);
    assert.equal(textoDeIndice(mapa), textoDeIndice(mapa), 'dos congelaciones del índice dan textos distintos');
  });

  test('Sin almacén inyectado el mundo se congela igual y no se escribe en ningún sitio', async () => {
    const registro = await celdaDeFixture('barrio-tres-calles');
    const doc = congelaCelda(registro);
    assert.equal(doc.clase, CLASES.CELDA);
    assert.equal(typeof texto(doc), 'string');

    // Guardar sí necesita almacén, y lo dice: el núcleo no sabe dónde guarda el móvil.
    const { mapa, consultaOsm } = mapaSintetico();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    await assert.rejects(() => guardaCelda(mapa, { i: 0, j: 0 }, {}), /almacén/, 'se ha guardado una celda sin almacén');
    await assert.rejects(() => guardaMapa(mapa, {}), /almacén/);
    await assert.rejects(() => cargaMapa({ id: mapa.id, semilla: SEMILLA_A }), /almacén/);
    assert.throws(() => exigeAlmacen({ lee: () => null }, 'la prueba'), /escribe, lista, borra/, 'un almacén incompleto no dice qué operaciones le faltan');
    assert.equal(exigeAlmacen(almacenEnMemoria(), 'la prueba').datos instanceof Map, true);
  });
});

describe('La red, solo en dos momentos', () => {
  test('Cargar un mapa entero desde su almacén no abre ninguna conexión de red', async () => {
    const { mapa, almacen } = await mapaConDosCeldas();
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
      for (const ficha of cargado.celdas) await cargaCelda(cargado, ficha.celda, { almacen });
      assert.equal(cargado.celdas.every((c) => estaCargada(c)), true, 'no se han cargado todas las celdas');
      assert.ok(mundoDeCelda(cargado, { i: 0, j: 0 }).routes.length > 0, 'el mundo cargado no trae calzadas');
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico al cargar un mapa entero desde el almacén');
    } finally {
      inspector.suelta();
    }
  });

  test('Una celda ya abierta se lee del almacén y no se consulta OSM', async () => {
    const { lat, lon } = coordenadaDe('costero');
    const mapa = creaMapa({ semilla: SEMILLA_A, lat, lon, tramoM: 2000 });
    const consulta = consultaDeFixture('costero');
    const almacen = almacenEnMemoria();
    await pisa(mapa, lat, lon, { consultaOsm: consulta });
    await guardaMapa(mapa, { almacen });
    const consultasAlGenerar = consulta.llamadas.length;
    assert.ok(consultasAlGenerar > 0, 'generar la celda no ha pedido datos: el caso no comprueba nada');

    // Otra sesión: el mapa se levanta del almacén y el jugador vuelve a pisar la
    // misma celda.
    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    const donde = await pisa(cargado, lat, lon, { consultaOsm: consulta });
    assert.equal(donde.estado, 'abierta', 'la celda ya abierta no consta abierta al volver a pisarla');
    assert.equal(donde.generada, false, 'volver a pisar una celda abierta la ha generado otra vez');
    assert.equal(consulta.llamadas.length, consultasAlGenerar, 'volver a pisar una celda ya abierta ha consultado OSM');

    const registro = await cargaCelda(cargado, donde.celda, { almacen });
    assert.equal(consulta.llamadas.length, consultasAlGenerar, 'leer la celda del almacén ha consultado OSM');
    assert.equal(textoDeCelda(registro), almacen.datos.get(CLAVES.celda(mapa.id, '0,0')), 'la celda leída del almacén no es la que se guardó');
    assert.equal(serializado(registro.mundo.settlements.map((s) => s.name)), serializado(celdaAbierta(mapa, { i: 0, j: 0 }).mundo.settlements.map((s) => s.name)));
  });

  test('Congelar una celda ya generada no registra ninguna petición', async () => {
    const registro = await celdaDeFixture('costero');
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const almacen = almacenEnMemoria();
      const mapa = creaMapa({ semilla: SEMILLA_A, ...coordenadaDe('costero'), tramoM: 2000 });
      mapa.celdas.push(registro);
      await guardaMapa(mapa, { almacen });
      assert.equal(almacen.datos.size, 2, 'no se han escrito el índice y la celda');
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico al congelar una celda ya generada');

      const levantado = levantaCelda(almacen.datos.get(CLAVES.celda(mapa.id, registro.clave)), { semilla: SEMILLA_A });
      assert.equal(textoDeCelda(levantado), almacen.datos.get(CLAVES.celda(mapa.id, registro.clave)));
      assert.deepEqual(inspector.peticiones(), []);
    } finally {
      inspector.suelta();
    }
  });
});

// ── SPEC-009-iter-1 · El índice guarda lo suyo ──────────────────────────────────
//
// El defecto era de una celda que no estaba: `congelaIndice` sacaba el título y el
// idioma de `primera?.mundo?.title`, y las celdas de un mapa cargado son fichas sin
// mundo. El encadenamiento opcional atravesaba la ausencia sin ruido y el `?? null`
// la escribía en disco como un valor legítimo. Bastaba abrir una celda para perder
// el título del mapa, para siempre y sin una sola excepción.
//
// Es la degradación silenciosa de `pipeline/decisiones-orquestador.md` §6h por
// quinta vez: una pieza que, al no estar, no protesta. Estos casos son los que
// impiden que vuelva, y el que la cierra como clase es el último: al **escribir** un
// documento, un campo ausente es un error y no un `null`.

const FUENTE_DE_MAPA = readFileSync(new URL('../../packages/nucleo/partida/mapa.js', import.meta.url), 'utf8');

/** Una copia de un objeto a la que le falta un campo, para probar la ausencia. */
const sinCampo = (objeto, campo) => {
  const copia = { ...objeto };
  delete copia[campo];
  return copia;
};

describe('El índice guarda lo suyo, y volver a guardarlo nunca lo empobrece', () => {
  test('Cargar el mapa, abrir una celda y volver a guardarlo deja el índice idéntico byte a byte', async () => {
    // La secuencia de todos los días, y la que producía la pérdida: se abre el
    // juego, se carga el mapa sin ninguna celda, se pisa una que ya estaba abierta
    // y algo llama a `guardaMapa`, que llama siempre a `guardaIndice`.
    const { mapa, almacen } = await mapaConDosCeldas();
    const original = almacen.datos.get(CLAVES.indice(mapa.id));

    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    assert.equal(cargado.celdas.some(estaCargada), false, 'cargar el mapa ha leído alguna celda: el caso no reproduce la secuencia');

    await cargaCelda(cargado, { i: 0, j: 0 }, { almacen });
    assert.equal(estaCargada(celdaAbierta(cargado, { i: 0, j: 0 })), true, 'la celda no se ha cargado');
    assert.equal(estaCargada(celdaAbierta(cargado, { i: 1, j: 0 })), false, 'se ha cargado una celda que nadie pidió');

    await guardaMapa(cargado, { almacen });
    assert.equal(almacen.datos.get(CLAVES.indice(mapa.id)), original, 'volver a guardar un mapa cargado ha empobrecido su índice');
  });

  test('Un mapa cargado cuyas celdas son fichas sin mundo declara el mismo título y el mismo idioma', async () => {
    const { mapa, almacen } = await mapaConDosCeldas();
    const antes = JSON.parse(almacen.datos.get(CLAVES.indice(mapa.id)));
    assert.ok(antes.titulo && antes.idioma, 'el índice guardado no lleva título ni idioma: el caso no comprueba nada');

    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    assert.equal(cargado.celdas.some(estaCargada), false, 'alguna celda ha llegado cargada');
    assert.throws(() => mundoDeCelda(cargado, { i: 0, j: 0 }), /no se ha cargado/, 'las fichas no son fichas: el caso no prueba lo que dice');

    const doc = congelaIndice(cargado);
    assert.equal(doc.titulo, antes.titulo, 'el índice de un mapa de fichas ha perdido el título');
    assert.equal(doc.idioma, antes.idioma, 'el índice de un mapa de fichas ha perdido el idioma');
  });

  test('Ningún campo del índice se deriva del mundo de una celda', async () => {
    // Se lee el cuerpo de `congelaIndice` y de la ficha que construye: si un campo
    // vuelve a derivarse atravesando `celda.mundo`, la carga perezosa vuelve a poder
    // escribir un nulo. La comprobación es de código porque el fallo era de código:
    // con las celdas cargadas, la versión mala también pasaba.
    //
    // Se afirma sobre el código y no sobre la prosa: los comentarios de ese módulo
    // hablan de `celda.mundo` a propósito, para decir que de ahí no se saca nada.
    const codigoDe = (nombre, declaracion) => {
      const trozo = FUENTE_DE_MAPA.split(declaracion)[1];
      assert.ok(trozo, `no se ha encontrado ${nombre}: el caso no lee lo que cree`);
      return trozo.split('\n}')[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    };

    const cuerpo = codigoDe('congelaIndice', 'export function congelaIndice(');
    assert.equal(/\.mundo\b/.test(cuerpo), false, 'congelaIndice vuelve a derivar un campo del mundo de una celda');
    assert.equal(/\?\./.test(cuerpo.split('celdas')[1] ?? ''), false, 'congelaIndice atraviesa una ausencia con encadenamiento opcional');
    for (const campo of ['titulo', 'idioma']) {
      assert.match(cuerpo, new RegExp(`${campo}: exigeCampo\\(mapa, '${campo}'`), `congelaIndice no exige el campo ${campo} al propio mapa`);
    }
    assert.equal(/\.mundo\b/.test(codigoDe('fichaDeCelda', 'function fichaDeCelda(')), false, 'la ficha de una celda se deriva de su mundo');

    // Y el efecto, medido: un mapa entero de fichas se congela sin error.
    const { mapa, almacen } = await mapaConDosCeldas();
    const cargado = await cargaMapa({ almacen, id: mapa.id, semilla: SEMILLA_A });
    assert.doesNotThrow(() => congelaIndice(cargado), 'un mapa de fichas ya no se puede congelar');
  });

  test('Al escribir el índice, un campo ausente falla nombrándolo en vez de escribir un null', async () => {
    const { mapa } = await mapaConDosCeldas();

    for (const campo of ['titulo', 'idioma']) {
      assert.throws(
        () => congelaIndice(sinCampo(mapa, campo)),
        (e) => new RegExp(`"${campo}"`).test(e.message) && /null/.test(e.message),
        `un mapa con celdas abiertas y sin ${campo} escribe un documento en vez de fallar nombrando el campo`,
      );
    }

    // Y no es una guarda solo para esos dos: cualquier campo obligatorio de la ruta
    // de congelado se exige igual, que es lo que cierra la clase.
    const conFichaRota = { ...mapa, celdas: [sinCampo(mapa.celdas[0], 'motivo'), ...mapa.celdas.slice(1)] };
    assert.throws(() => congelaIndice(conFichaRota), /"motivo"/, 'una ficha sin motivo escribe un nulo en vez de fallar');

    // Lo que sí sigue pasando es el nulo que es un estado del mundo: un mapa recién
    // creado no tiene ninguna celda de la que sacar título, y ahí el nulo es verdad.
    const recien = creaMapa({ semilla: SEMILLA_A, ...ARRANQUE, tramoM: 2000 });
    const doc = congelaIndice(recien);
    assert.deepEqual({ titulo: doc.titulo, idioma: doc.idioma, celdas: doc.celdas }, { titulo: null, idioma: null, celdas: [] });
  });

  test('El título y el idioma del índice son los de la celda que ordena primero, se abran en el orden que se abran', async () => {
    const abriendo = async (orden) => {
      const { mapa, consultaOsm } = mapaSintetico();
      for (const celda of orden) await abreCelda(mapa, celda, { consultaOsm });
      return mapa;
    };
    const enOrden = await abriendo([{ i: 0, j: 0 }, { i: 1, j: 0 }]);
    const alReves = await abriendo([{ i: 1, j: 0 }, { i: 0, j: 0 }]);

    // Que la comparación diga algo: las dos celdas tienen títulos distintos.
    const titulos = enOrden.celdas.map((r) => r.mundo.title);
    assert.notEqual(titulos[0], titulos[1], 'las dos celdas dan el mismo título: el caso no comprueba nada');

    const primero = enOrden.celdas.find((r) => r.clave === '0,0').mundo;
    for (const [donde, mapa] of [['abriendo en orden', enOrden], ['abriendo al revés', alReves]]) {
      const doc = congelaIndice(mapa);
      assert.equal(doc.titulo, primero.title, `${donde}: el título del índice no es el de la celda que ordena primero`);
      assert.equal(doc.idioma, primero.locale, `${donde}: el idioma del índice no es el de la celda que ordena primero`);
    }
    assert.equal(textoDeIndice(enOrden), textoDeIndice(alReves), 'el orden de apertura cambia el índice');
  });

  test('Guardar dos veces seguidas sin tocar nada escribe el mismo índice byte a byte', async () => {
    const { mapa, almacen } = await mapaConDosCeldas();
    const primero = almacen.datos.get(CLAVES.indice(mapa.id));
    await guardaMapa(mapa, { almacen });
    assert.equal(almacen.datos.get(CLAVES.indice(mapa.id)), primero, 'guardar dos veces seguidas da dos índices distintos');
  });

  test('Los grados de las costuras del índice no los toca la rejilla del metro', async () => {
    // El índice es el otro sitio donde viven grados, y por lo mismo que la cabecera
    // de una celda: son los extremos reales de una costura y redondearlos movería el
    // punto donde dos celdas se cosen. Sus metros sí están en la rejilla.
    const { mapa } = await mapaConDosCeldas();
    const doc = congelaIndice(mapa);
    const aristas = doc.costuras.flatMap((c) => c.aristas);
    assert.ok(aristas.length > 0, 'el índice no declara ninguna arista de costura: el caso no comprueba nada');

    const decimalesDe = (v) => (String(v).split('.')[1] ?? '').length;
    let finos = 0;
    for (const a of aristas) {
      for (const extremo of [a.desde, a.hasta]) {
        // Un metro de longitud son ~1,2e-5 grados: con seis decimales o más, nadie
        // los ha llevado a la rejilla.
        if (decimalesDe(extremo.lat) >= 6 || decimalesDe(extremo.lon) >= 6) finos++;
      }
      assert.equal(a.metros / PRECISION_M, Math.round(a.metros / PRECISION_M), `los metros de la costura ${a.desde.clave} → ${a.hasta.clave} valen ${a.metros}, que no está en la rejilla`);
    }
    assert.ok(finos > 0, 'todos los grados de las costuras vienen redondeados a menos de un metro de precisión');
    assert.deepEqual(doc.anclaje, { lat: mapa.anclaje.lat, lon: mapa.anclaje.lon }, 'el anclaje del índice no es el de la rejilla');
  });
});
