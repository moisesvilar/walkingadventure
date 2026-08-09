// SPEC-003 · El mapa de la partida: qué celdas están abiertas, por cuál de las
// dos vías se abrieron y qué pasa cuando el jugador pisa o completa una.
//
// Aquí vive la afirmación de la que cuelga el crecimiento del mundo: crecer es
// abrir otra celda, nunca regenerar la tuya. La vía de pisarla la cubre el
// escenario «Abrir una celda vecina no toca la celda propia»; **la de completar
// la celda no tiene escenario en docs/testing.md** —hueco detectado al escribir la
// spec— y sus casos van marcados como hueco en test/spec-test-map.json.
//
// Los mundos sintéticos se usan a propósito donde hace falta llegar al borde: los
// cuatro fixtures caben en menos de un kilómetro y nunca alcanzan el borde de una
// celda de cuatro.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  abreCelda,
  celdaAbierta,
  celdasAbiertas,
  completaCelda,
  costuras,
  creaMapa,
  pisa,
  resuelvePosicion,
} from '../../packages/nucleo/partida/mapa.js';
import { celdaEnPosicion, celdasContiguas, limitesDeCelda } from '../../packages/nucleo/world/rejilla.js';
// Los estilos son del prototipo web, que SPEC-020 mudó de app/ a prototipo/.
import { STYLES, getStyle } from '../../prototipo/js/render/styles.js';
import { creaInspectorDeRed } from '../dobles/inspector-red.mjs';
import {
  SEMILLA_A,
  SEMILLA_B,
  consultaDeFixture,
  consultaSintetica,
  coordenadaDe,
  serializado,
  sinMotivo,
} from './celda-de-prueba.mjs';

const ARRANQUE = { lat: 42.407163, lon: -8.809274 };

/** Un mapa con su consulta sintética, que es la que llega al borde de la celda. */
function mapaSintetico({ semilla = SEMILLA_A, tramoM = 2000, retranqueoM = 40 } = {}) {
  const mapa = creaMapa({ semilla, ...ARRANQUE, tramoM });
  return { mapa, consultaOsm: consultaSintetica(mapa.rejilla, { retranqueoM }) };
}

/** La coordenada del centro de una celda, que es la manera de «pisarla» en una prueba. */
function centroDe(mapa, celda) {
  return limitesDeCelda(mapa.rejilla, celda).centro;
}

describe('La apertura de celdas vecinas', () => {
  test('Abrir una celda vecina no toca la celda propia', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    const propia = (await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm })).registro;
    const antes = serializado(propia);

    const destino = centroDe(mapa, { i: 1, j: 0 });
    const pisada = await pisa(mapa, destino.lat, destino.lon, { consultaOsm });
    assert.deepEqual(pisada.celda, { i: 1, j: 0 }, 'la posición pisada no cae en la celda 1,0');
    assert.equal(pisada.generada, true, 'pisar una celda cerrada no la ha generado');
    assert.equal(pisada.registro.motivo, 'pisada', 'la celda no consta abierta por pisarla');

    assert.equal(serializado(celdaAbierta(mapa, { i: 0, j: 0 })), antes, 'la celda 0,0 ha cambiado al abrirse la vecina');
    assert.equal(serializado(propia), antes, 'la celda 0,0 entregada antes ha cambiado');

    // Y la segunda mitad del escenario: las dos comparten la costura del borde.
    const [costura] = costuras(mapa);
    assert.ok(costura, 'no se ha calculado ninguna costura entre las dos celdas');
    assert.deepEqual(costura.celdas, ['0,0', '1,0']);
    assert.ok(costura.aristas.length > 0, 'las calzadas de las dos celdas no han quedado cosidas en el borde');
  });

  test('Completar una celda abre una vecina y la registra como abierta por acontecimiento', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });

    const evento = await completaCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    assert.equal(evento.acontecimiento, true, 'completar la celda no ha abierto ninguna vecina');
    assert.ok(
      celdasContiguas({ i: 0, j: 0 }).some((v) => v.i === evento.celda.i && v.j === evento.celda.j),
      `la celda abierta por acontecimiento (${evento.celda.i},${evento.celda.j}) no es contigua a la completada`,
    );
    assert.equal(evento.registro.motivo, 'acontecimiento', 'la celda no consta abierta por acontecimiento');
    assert.equal(celdasAbiertas(mapa).length, 2);
    assert.equal(celdaAbierta(mapa, evento.celda).motivo, 'acontecimiento');
  });

  test('La misma celda abierta por las dos vías tiene el mismo contenido y solo difiere el motivo', async () => {
    const porAcontecimiento = mapaSintetico();
    await abreCelda(porAcontecimiento.mapa, { i: 0, j: 0 }, { consultaOsm: porAcontecimiento.consultaOsm });
    const evento = await completaCelda(porAcontecimiento.mapa, { i: 0, j: 0 }, { consultaOsm: porAcontecimiento.consultaOsm });

    const porPisada = mapaSintetico();
    const { registro: pisada } = await abreCelda(porPisada.mapa, evento.celda, { motivo: 'pisada', consultaOsm: porPisada.consultaOsm });

    assert.equal(sinMotivo(pisada), sinMotivo(evento.registro), 'la celda nace distinta según por dónde se abra');
    assert.notEqual(pisada.motivo, evento.registro.motivo, 'el motivo tenía que ser lo único distinto');
    assert.equal(pisada.motivo, 'pisada');
    assert.equal(evento.registro.motivo, 'acontecimiento');
  });

  test('La vecina que abre el acontecimiento la elige la semilla y sale igual en dos ejecuciones', async () => {
    const elegidas = [];
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const { mapa, consultaOsm } = mapaSintetico();
      await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
      elegidas.push((await completaCelda(mapa, { i: 0, j: 0 }, { consultaOsm })).celda);
    }
    for (const elegida of elegidas) assert.deepEqual(elegida, elegidas[0], 'el acontecimiento elige una vecina distinta en cada ejecución');

    // Y sale de la semilla: con otra semilla de partida, la elección puede cambiar,
    // y desde luego no puede depender de nada que no sea la semilla y el índice.
    const otra = mapaSintetico({ semilla: SEMILLA_B });
    await abreCelda(otra.mapa, { i: 0, j: 0 }, { consultaOsm: otra.consultaOsm });
    const conOtraSemilla = (await completaCelda(otra.mapa, { i: 0, j: 0 }, { consultaOsm: otra.consultaOsm })).celda;
    assert.ok(
      celdasContiguas({ i: 0, j: 0 }).some((v) => v.i === conOtraSemilla.i && v.j === conOtraSemilla.j),
      'con otra semilla la elección se va fuera de las contiguas',
    );

    // La elección tampoco depende del orden en que se abrieron otras celdas: se
    // sortea entre las contiguas cerradas, que llegan en orden canónico.
    const conVecinaAbierta = mapaSintetico();
    await abreCelda(conVecinaAbierta.mapa, { i: 0, j: 0 }, { consultaOsm: conVecinaAbierta.consultaOsm });
    await abreCelda(conVecinaAbierta.mapa, { i: 5, j: 5 }, { consultaOsm: conVecinaAbierta.consultaOsm });
    const conRuido = (await completaCelda(conVecinaAbierta.mapa, { i: 0, j: 0 }, { consultaOsm: conVecinaAbierta.consultaOsm })).celda;
    assert.deepEqual(conRuido, elegidas[0], 'abrir una celda lejana ha cambiado a quién elige el acontecimiento');
  });

  test('Una celda con las cuatro vecinas abiertas no anuncia ningún acontecimiento', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    for (const vecina of celdasContiguas({ i: 0, j: 0 })) await abreCelda(mapa, vecina, { consultaOsm });
    assert.equal(celdasAbiertas(mapa).length, 5);
    const antes = serializado(celdasAbiertas(mapa));

    const evento = await completaCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    assert.equal(evento.acontecimiento, false, 'se ha anunciado un acontecimiento sin vecinas que abrir');
    assert.equal(evento.registro, null);
    assert.equal(evento.celda, null);
    assert.equal(celdasAbiertas(mapa).length, 5, 'se ha abierto una celda nueva sin vecinas cerradas');
    assert.equal(serializado(celdasAbiertas(mapa)), antes, 'las celdas abiertas han cambiado');
  });

  test('Entrar en una celda ya abierta no genera nada', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    const consultasTrasAbrir = consultaOsm.llamadas.length;
    const antes = serializado(celdasAbiertas(mapa));

    const dentro = limitesDeCelda(mapa.rejilla, { i: 0, j: 0 });
    for (const posicion of [dentro.centro, ARRANQUE]) {
      const r = await pisa(mapa, posicion.lat, posicion.lon, { consultaOsm });
      assert.equal(r.estado, 'abierta', `la posición ${posicion.lat},${posicion.lon} no cae en una celda abierta`);
      assert.equal(r.generada, false, 'pisar una celda abierta ha generado algo');
    }
    assert.equal(consultaOsm.llamadas.length, consultasTrasAbrir, 'pisar una celda abierta ha pedido datos');
    assert.equal(serializado(celdasAbiertas(mapa)), antes, 'pisar una celda abierta ha cambiado el mapa');
  });

  test('Una posición que este mapa no contiene se responde sin abrir nada', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    const consultasTrasAbrir = consultaOsm.llamadas.length;

    // Ni abierta ni contigua a una abierta: el jugador se ha ido lejos.
    const lejos = { lat: ARRANQUE.lat + 1.5, lon: ARRANQUE.lon - 1.5 };
    const donde = resuelvePosicion(mapa, lejos.lat, lejos.lon);
    assert.equal(donde.estado, 'fuera', 'una posición lejana no se responde como fuera del mapa');
    assert.deepEqual(donde.celda, celdaEnPosicion(mapa.rejilla, lejos.lat, lejos.lon));

    const r = await pisa(mapa, lejos.lat, lejos.lon, { consultaOsm });
    assert.equal(r.generada, false, 'se ha generado una celda para una posición que este mapa no contiene');
    assert.equal(r.registro, null);
    assert.match(r.mensaje, /ninguna celda de este mapa/, `el mensaje no dice qué pasa: ${r.mensaje}`);
    assert.equal(consultaOsm.llamadas.length, consultasTrasAbrir, 'se han pedido datos para una posición fuera del mapa');
    assert.equal(celdasAbiertas(mapa).length, 1);

    // Y una contigua a una abierta sí se abre: el mundo tiene que existir donde
    // estás, y eso incluye a quien vive pegado a un borde.
    assert.equal(resuelvePosicion(mapa, centroDe(mapa, { i: 1, j: 0 }).lat, centroDe(mapa, { i: 1, j: 0 }).lon).estado, 'contigua');
  });

  test('Un mapa sin ninguna celda abierta devuelve una lista vacía y no un error', () => {
    const mapa = creaMapa({ semilla: SEMILLA_A, ...ARRANQUE, tramoM: 2000 });
    assert.deepEqual(celdasAbiertas(mapa), []);
    assert.deepEqual(costuras(mapa), []);
    assert.equal(celdaAbierta(mapa, { i: 0, j: 0 }), null);
    assert.equal(resuelvePosicion(mapa, ARRANQUE.lat, ARRANQUE.lon).estado, 'inicial');
    // El mapa existe aunque esté vacío: tiene rejilla, anclaje e identificador.
    assert.equal(mapa.id, '42.41,-8.81');
    assert.deepEqual(mapa.anclaje, { lat: 42.41, lon: -8.81 });
  });

  test('De una celda abierta consta por cuál de las dos vías se abrió', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    const evento = await completaCelda(mapa, { i: 0, j: 0 }, { consultaOsm });

    for (const registro of celdasAbiertas(mapa)) {
      assert.ok(['pisada', 'acontecimiento'].includes(registro.motivo), `motivo desconocido: ${registro.motivo}`);
    }
    assert.equal(celdaAbierta(mapa, { i: 0, j: 0 }).motivo, 'pisada');
    assert.equal(celdaAbierta(mapa, evento.celda).motivo, 'acontecimiento');

    // Un motivo que no es ninguna de las dos vías no se registra en silencio.
    await assert.rejects(
      () => abreCelda(mapa, { i: 3, j: 3 }, { motivo: 'regalo', consultaOsm }),
      (e) => {
        assert.match(e.message, /motivo de apertura desconocido/, e.message);
        return true;
      },
    );
    assert.equal(celdaAbierta(mapa, { i: 3, j: 3 }), null, 'ha quedado registrada una celda con un motivo inválido');
  });

  test('Las celdas abiertas salen en un orden estable que no depende del de apertura', async () => {
    const orden = [{ i: 0, j: 0 }, { i: 1, j: 0 }, { i: 0, j: 1 }, { i: -1, j: 0 }];
    const claves = [];
    for (const secuencia of [orden, [...orden].reverse()]) {
      const { mapa, consultaOsm } = mapaSintetico();
      for (const celda of secuencia) await abreCelda(mapa, celda, { consultaOsm });
      claves.push(celdasAbiertas(mapa).map((c) => c.clave));
    }
    assert.deepEqual(claves[1], claves[0], 'la lista de celdas abiertas depende del orden en que se abrieron');
    assert.deepEqual(claves[0], [...claves[0]].sort(), 'la lista de celdas abiertas no sale ordenada por su clave');
  });
});

describe('Lo generado no se resiembra jamás', () => {
  test('Cambiar el tramo del jugador no redimensiona un mundo ya generado', async () => {
    const { mapa, consultaOsm } = mapaSintetico({ tramoM: 2000 });
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    const antes = serializado(celdasAbiertas(mapa));
    assert.equal(mapa.rejilla.ladoM, 4000);

    // El jugador se vuelve a medir y su tramo baja a 600 m: eso levanta mapas
    // nuevos con otro lado, pero no toca ni un metro de lo ya generado.
    const nuevo = creaMapa({ semilla: SEMILLA_A, lat: 40.4168, lon: -3.7038, tramoM: 600 });
    assert.equal(nuevo.rejilla.ladoM, 1200);

    assert.equal(serializado(celdasAbiertas(mapa)), antes, 'el mundo ya generado ha cambiado al cambiar el tramo');
    assert.equal(mapa.rejilla.ladoM, 4000, 'el lado de celda del mapa ya levantado ha cambiado');
    // Y una celda que se abra después sigue midiendo lo mismo.
    const tardia = (await abreCelda(mapa, { i: 2, j: 0 }, { consultaOsm })).registro;
    assert.equal(tardia.ladoM, 4000, 'una celda abierta después del cambio de tramo se ha dimensionado con el tramo nuevo');
    assert.equal(serializado(celdaAbierta(mapa, { i: 0, j: 0 })), serializado(JSON.parse(antes)[0]), 'la celda de antes ha cambiado');
  });

  test('Cambiar el estilo de pintado no resiembra nada', async () => {
    // El estilo es solo pintado y vive fuera del paquete: la afirmación que se
    // puede hacer desde el núcleo es que el mundo no le da al pintor por dónde
    // tocarlo —está congelado— y que ningún estilo entra en la generación.
    const { mapa, consultaOsm } = mapaSintetico();
    const registro = (await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm })).registro;
    const antes = serializado(registro);

    const ids = STYLES.map((s) => s.id);
    for (const id of ids) {
      assert.ok(getStyle(id), `el estilo ${id} no existe`);
      assert.equal(serializado(registro), antes, `leer el estilo ${id} ha cambiado la celda`);
    }
    assert.ok(ids.includes('reino') && ids.includes('pergamino'), `faltan los estilos del escenario: ${ids.join(', ')}`);
    assert.throws(() => { registro.mundo.title = 'Otro reino'; }, TypeError, 'el pintor podría cambiar el mundo por debajo');
    assert.equal(serializado(celdaAbierta(mapa, { i: 0, j: 0 })), antes);
  });

  test('Una partida guardada y vuelta a cargar tiene las celdas idénticas byte a byte', async () => {
    // La persistencia de verdad es de la fila 9; lo que se puede afirmar aquí es
    // que lo generado sobrevive al ida y vuelta por JSON, que es por donde va a
    // pasar cuando exista, y que no lleva nada colgado de un array que se pierda
    // por el camino.
    const { mapa, consultaOsm } = mapaSintetico();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm });

    const guardado = serializado({ celdas: celdasAbiertas(mapa), costuras: costuras(mapa), rejilla: mapa.rejilla, semilla: mapa.semilla, id: mapa.id });
    const cargado = JSON.parse(guardado);
    assert.equal(serializado(cargado), guardado, 'la partida no vuelve igual de JSON');
    assert.equal(cargado.semilla, SEMILLA_A, 'la semilla no sobrevive al guardado');
    assert.deepEqual(cargado.rejilla.anclaje, { lat: 42.41, lon: -8.81 });

    const colgadas = [];
    const recorre = (valor, ruta) => {
      if (Array.isArray(valor)) {
        const propias = Object.keys(valor).filter((k) => !/^\d+$/.test(k));
        if (propias.length) colgadas.push(`${ruta}: ${propias.join(', ')}`);
        valor.forEach((v, i) => recorre(v, `${ruta}[${i}]`));
      } else if (valor && typeof valor === 'object' && !ArrayBuffer.isView(valor)) {
        for (const [k, v] of Object.entries(valor)) recorre(v, `${ruta}.${k}`);
      }
    };
    recorre(celdasAbiertas(mapa), 'celdas');
    assert.deepEqual(colgadas, [], 'hay propiedades colgadas de arrays, que el guardado se lleva por delante en silencio');
  });

  test('Ninguna operación que no sea abrir una celda nueva vuelve a generar nada', async () => {
    const { mapa, consultaOsm } = mapaSintetico();
    await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
    await abreCelda(mapa, { i: 1, j: 0 }, { consultaOsm });
    const consultasTrasAbrir = consultaOsm.llamadas.length;
    const antes = serializado({ celdas: celdasAbiertas(mapa), costuras: costuras(mapa) });

    // Todo lo que la partida puede hacer sin abrir celda: mirar, resolver, pisar
    // lo ya abierto, pisar fuera, completar una celda sin vecinas cerradas.
    celdasAbiertas(mapa);
    costuras(mapa);
    celdaAbierta(mapa, { i: 0, j: 0 });
    resuelvePosicion(mapa, ARRANQUE.lat, ARRANQUE.lon);
    await pisa(mapa, ARRANQUE.lat, ARRANQUE.lon, { consultaOsm });
    await pisa(mapa, ARRANQUE.lat + 1.5, ARRANQUE.lon - 1.5, { consultaOsm });
    const cerradas = celdasContiguas({ i: 0, j: 0 }).filter((v) => !celdaAbierta(mapa, v));
    for (const v of cerradas) await abreCelda(mapa, v, { consultaOsm });
    const consultasConTodoAbierto = consultaOsm.llamadas.length;
    const sinVecinas = await completaCelda(mapa, { i: 0, j: 0 }, { consultaOsm });

    assert.equal(sinVecinas.acontecimiento, false, 'quedaba alguna vecina cerrada: el caso no prueba lo que dice');
    assert.equal(consultaOsm.llamadas.length, consultasConTodoAbierto, 'completar una celda sin vecinas cerradas ha pedido datos');
    assert.ok(consultasConTodoAbierto > consultasTrasAbrir, 'abrir las vecinas tenía que pedir datos');
    const ahora = serializado({ celdas: celdasAbiertas(mapa).filter((c) => ['0,0', '1,0'].includes(c.clave)), costuras: costuras(mapa).filter((c) => c.celdas.join('|') === '0,0|1,0') });
    assert.equal(ahora, antes, 'algo de lo ya generado ha cambiado');
  });

  test('Levantar y crecer un mapa entero no abre ninguna conexión de red', async () => {
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const { mapa, consultaOsm } = mapaSintetico();
      await abreCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
      await completaCelda(mapa, { i: 0, j: 0 }, { consultaOsm });
      const destino = centroDe(mapa, { i: 1, j: 0 });
      await pisa(mapa, destino.lat, destino.lon, { consultaOsm });
      assert.deepEqual(inspector.peticiones(), []);
    } finally {
      inspector.suelta();
    }
  });

  test('El rastro de ubicación no se guarda nunca', async () => {
    // Sobre lo que la rejilla registra, y con el inspector delante: ni sale del
    // móvil ni se queda dentro. Dos jugadores que arrancan en portales distintos
    // del mismo paso de redondeo dejan exactamente el mismo registro, que es la
    // manera fuerte de decir que del registro no se saca dónde estaban.
    const inspector = creaInspectorDeRed({ estricto: true });
    try {
      const portales = [ARRANQUE, { lat: 42.4119, lon: -8.8140 }];
      const registros = [];
      for (const portal of portales) {
        const mapa = creaMapa({ semilla: SEMILLA_A, ...portal, tramoM: 2000 });
        const consultaOsm = consultaSintetica(mapa.rejilla);
        await pisa(mapa, portal.lat, portal.lon, { consultaOsm });
        registros.push(serializado({ rejilla: mapa.rejilla, celdas: celdasAbiertas(mapa), costuras: costuras(mapa) }));
      }
      assert.equal(registros[1], registros[0], 'el registro del mapa distingue dos portales del mismo paso: guarda dónde estabas');

      for (const portal of portales) {
        for (const dato of [String(portal.lat), String(portal.lon)]) {
          assert.equal(registros[0].includes(dato), false, `la coordenada exacta (${dato}) está registrada`);
        }
      }
      assert.deepEqual(inspector.peticiones(), [], 'ha salido tráfico del móvil al levantar y crecer el mapa');
    } finally {
      inspector.suelta();
    }
  });

  test('Un mundo real generado en celda no cambia porque se vuelva a mirar', async () => {
    // Con datos de verdad y no sintéticos, que es donde una dependencia del orden
    // o del reloj se nota: dos mapas iguales sobre el mismo fixture dan lo mismo.
    const { lat, lon } = coordenadaDe('costero');
    const serializados = [];
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      const mapa = creaMapa({ semilla: SEMILLA_A, lat, lon, tramoM: 2000 });
      await pisa(mapa, lat, lon, { consultaOsm: consultaDeFixture('costero') });
      serializados.push(serializado(celdasAbiertas(mapa)));
    }
    assert.equal(serializados[1], serializados[0], 'el mismo mapa sobre los mismos datos da dos mundos distintos');
    assert.ok(serializados[0].length > 1000, 'el mundo comparado está vacío: no se ha comparado nada');
  });
});
