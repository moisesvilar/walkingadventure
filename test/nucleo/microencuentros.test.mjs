// SPEC-019 · El micro-encuentro: cuándo salta, contra qué sitio resuelve su lugar
// diferido, por qué nunca cuesta un metro de desvío y por qué nunca interrumpe una
// escena de la aventura principal.
//
// El mundo, el trazado vigente, la llegada y el estado del beat entran **todos
// inyectados**: esta capa no mira el GPS, no calcula geofences y no deduce que hay un
// beat en curso por la posición ni por el tiempo parado. Por eso ninguna prueba de
// aquí necesita dispositivo, red ni reloj: se le pasa por dónde va pasando.
//
// Los sitios se escriben a mano en `entrega-de-prueba.mjs` porque lo que se afirma es
// contra cuál resuelve el lugar, y eso depende de qué escenas admite cada uno.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PESO_MINIMO_DE_ESCENA } from '../../packages/nucleo/world/escenas.js';
import { repartoDeAventuras } from '../../packages/nucleo/partida/aventuras.js';
import {
  ESTADOS_DE_ENTRADA,
  congelaEntregas,
  encola,
  entradaDe,
  estadoDeEntregas,
  pendientes,
} from '../../packages/nucleo/partida/entregas.js';
import {
  BEATS_DEL_MICROENCUENTRO,
  admiteLaEscena,
  creaMicroEncuentros,
  retieneElAviso,
  sitiosDelMundo,
} from '../../packages/nucleo/partida/microencuentros.js';
import * as moduloDeMicroencuentros from '../../packages/nucleo/partida/microencuentros.js';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { MAPA, colaCon, colaDe, mundoDeSitios, oportunidad } from './entrega-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import { mundoDeReferencia } from './prologo-de-prueba.mjs';
import { codigoDe } from './rumor-de-prueba.mjs';

/** El tramo con el que se dimensionan las salidas de estas pruebas. */
const TRAMO = 2000;

/** Los dos sitios que admiten «encuentro» en el mundo escrito a mano, y el que no. */
const FONTE = 'A Fonte Vella';
const CRUCEIRO = 'O Cruceiro Branco';
const LAXES = 'As Laxes da Moura';
const POZO = 'O Pozo Cego';

/** Un micro-encuentro colgado de una cola con las oportunidades que se le pidan. */
function conCola(producciones, { mundo = mundoDeSitios(), mapaId = MAPA } = {}) {
  const estado = colaCon(producciones, { mapaId });
  return { estado, mundo, micro: creaMicroEncuentros({ mundo, mapaId, estado }) };
}

describe('Cuándo salta un micro-encuentro', () => {
  test('Una salida entera con la cola vacía no hace saltar ningún micro-encuentro', () => {
    const { micro } = conCola([]);
    const trazado = [FONTE, CRUCEIRO, LAXES, POZO];
    for (const [k, sitio] of trazado.entries()) {
      assert.equal(micro.atraviesa({ sitio, salida: 'salida-1', paso: k + 1, trazado }), null);
    }
  });

  test('Con una oportunidad pendiente, atravesar un sitio apto hace saltar el micro-encuentro', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const aviso = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [FONTE] });
    assert.ok(aviso, 'no ha saltado el micro-encuentro');
    assert.equal(aviso.asunto, 'aceite-para-la-botica');
    assert.equal(aviso.sitio.nombre, FONTE);
  });

  test('Un mundo cuyo motor no ha producido nada no inventa micro-encuentros en tres salidas', () => {
    const { micro, estado } = conCola([]);
    const trazado = [FONTE, CRUCEIRO, LAXES];
    let paso = 0;
    for (const salida of ['salida-1', 'salida-2', 'salida-3']) {
      for (const sitio of trazado) assert.equal(micro.atraviesa({ sitio, salida, paso: ++paso, trazado }), null);
      micro.cierraSalida({ salida, paso });
    }
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
    assert.deepEqual(micro.cola(), []);
  });

  test('No existe ninguna vía por la que un micro-encuentro nazca sin una entrada de la cola detrás', () => {
    const codigo = codigoDe(fuente('packages/nucleo/partida/microencuentros.js'));
    // Lo que devuelve `atraviesa` sale siempre de una entrada elegida de lo
    // pendiente: no hay ningún sorteo ni ninguna lista de encuentros de relleno.
    assert.ok(codigo.includes('pendientes('), 'el disparo no consulta lo pendiente');
    for (const relleno of ['Math.random', 'shuffle', 'aleatorio', 'relleno']) {
      assert.ok(!codigo.includes(relleno), `el disparo usa "${relleno}"`);
    }
    // Y sin entradas no devuelve nada, con trazado apto y sin ninguna otra guarda.
    const { micro } = conCola([]);
    assert.equal(micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [FONTE] }), null);
  });

  test('Como mucho un micro-encuentro por paso del mundo', () => {
    const { micro } = conCola([
      oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro', paso: 1 }),
      oportunidad({ asunto: 'carta-que-nadie-echó', escena: 'encuentro', paso: 2 }),
    ]);
    const trazado = [FONTE, CRUCEIRO];
    assert.ok(micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado }));
    assert.equal(micro.atraviesa({ sitio: CRUCEIRO, salida: 'salida-1', paso: 1, trazado }), null, 'han saltado dos en el mismo paso');
  });

  test('Con el mundo un paso más adelante sí puede saltar el siguiente', () => {
    const { micro } = conCola([
      oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro', paso: 1 }),
      oportunidad({ asunto: 'carta-que-nadie-echó', escena: 'encuentro', paso: 2 }),
    ]);
    const trazado = [FONTE, CRUCEIRO];
    assert.ok(micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado }));
    const segundo = micro.atraviesa({ sitio: CRUCEIRO, salida: 'salida-1', paso: 2, trazado });
    assert.ok(segundo, 'el paso siguiente no ha dejado saltar el siguiente');
    assert.equal(segundo.asunto, 'carta-que-nadie-echó');
  });

  test('Una salida que completa la cola entera la deja vacía sin más de un encuentro por paso', () => {
    const { micro, estado } = conCola([
      oportunidad({ asunto: 'uno', escena: 'encuentro', paso: 1 }),
      oportunidad({ asunto: 'dos', escena: 'encuentro', paso: 2 }),
    ]);
    const trazado = [FONTE, CRUCEIRO];
    const uno = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado });
    micro.atiende(uno.entrada);
    const dos = micro.atraviesa({ sitio: CRUCEIRO, salida: 'salida-1', paso: 2, trazado });
    micro.atiende(dos.entrada);
    micro.cierraSalida({ salida: 'salida-1', paso: 2 });

    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
    const ofertasPorPaso = JSON.parse(JSON.stringify(congelaEntregas(estado))).mapas[MAPA].entradas
      .flatMap((e) => e.ofertas.filter((o) => o.via === 'marcha').map((o) => o.paso));
    assert.deepEqual(ofertasPorPaso.slice().sort(), [...new Set(ofertasPorPaso)].sort(), 'dos micro-encuentros en el mismo paso del mundo');
  });

  test('Una oportunidad ya ofrecida en esta salida no se vuelve a ofrecer en la misma salida', () => {
    const { micro, estado } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const trazado = [FONTE, CRUCEIRO];
    const uno = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado });
    assert.ok(uno);
    assert.equal(micro.atraviesa({ sitio: CRUCEIRO, salida: 'salida-1', paso: 2, trazado }), null);
    assert.equal(entradaDe(estado, { mapaId: MAPA, id: uno.entrada }).ofertas.length, 1);
  });

  test('Un micro-encuentro entrega el sitio y la escena, y ni un texto destinado a mostrarse', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const aviso = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [FONTE] });
    assert.deepEqual(
      Object.keys(aviso).sort(),
      ['asunto', 'beats', 'clase', 'cuentaEnElPresupuesto', 'enElTrazado', 'entrada', 'escena', 'franja', 'limite', 'sitio'],
    );
    for (const campo of ['texto', 'titulo', 'mensaje', 'notificacion', 'cuerpo']) {
      assert.ok(!(campo in aviso), `el micro-encuentro entrega "${campo}"`);
    }
    // Lo que sale son claves de catálogo, no frases redactadas.
    assert.ok(!/\s/.test(aviso.asunto) && !/\s/.test(aviso.escena));
  });

  test('Un micro-encuentro atendido queda «atendida» y no vuelve a ofrecerse ni a aparecer', () => {
    const { micro, estado } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const aviso = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [FONTE] });
    const atendida = micro.atiende(aviso.entrada);
    assert.equal(atendida.estado, ESTADOS_DE_ENTRADA.ATENDIDA);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA }), []);
    assert.equal(micro.atraviesa({ sitio: CRUCEIRO, salida: 'salida-2', paso: 2, trazado: [CRUCEIRO] }), null);
  });
});

describe('El lugar diferido se resuelve en marcha', () => {
  test('Una oportunidad recién encolada declara una escena y no tiene lugar', () => {
    const estado = colaDe(1);
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    assert.equal(entrada.escena, 'encuentro');
    assert.equal(entrada.sitio, null, 'la entrada nace con lugar resuelto');
  });

  test('El lugar se resuelve contra el primer sitio apto del trazado y no contra ninguno posterior', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    // El trazado empieza por un sitio que no admite la escena: el primero **apto** es
    // el segundo, y a partir de ahí no se sigue mirando.
    const trazado = [POZO, FONTE, CRUCEIRO];
    assert.equal(micro.atraviesa({ sitio: POZO, salida: 'salida-1', paso: 1, trazado }), null);
    const aviso = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado });
    assert.equal(aviso.sitio.nombre, FONTE);
  });

  test('Un sitio cuyas afinidades no admiten la escena declarada no resuelve el lugar', () => {
    const sitios = sitiosDelMundo(mundoDeSitios());
    assert.equal(admiteLaEscena(sitios.get(POZO), 'encuentro'), false, 'un peso por debajo del mínimo admite la escena');
    assert.equal(admiteLaEscena(sitios.get(FONTE), 'encuentro'), true);
    // El mínimo es el mismo con el que el casting da una escena por cubierta: si
    // aquí fuera más laxo, el micro-encuentro caería donde el casting no lo pone.
    assert.equal(admiteLaEscena({ escenas: { encuentro: PESO_MINIMO_DE_ESCENA } }, 'encuentro'), true);
    assert.equal(admiteLaEscena({ escenas: { encuentro: PESO_MINIMO_DE_ESCENA - 0.01 } }, 'encuentro'), false);
  });

  test('Un núcleo o un servicio del trazado no resuelve un lugar diferido, y se dice por qué', () => {
    const mundo = mundoDeSitios({ nucleos: ['Vilaboa'], servicios: ['A Ferraría'] });
    const sitios = sitiosDelMundo(mundo);
    assert.ok(sitios.has('Vilaboa') && sitios.has('A Ferraría'), 'el trazado no puede nombrar núcleos ni servicios');
    assert.equal(admiteLaEscena(sitios.get('Vilaboa'), 'encuentro'), false);
    const { micro } = conCola([oportunidad({ asunto: 'x', escena: 'encuentro' })], { mundo });
    assert.equal(micro.atraviesa({ sitio: 'Vilaboa', salida: 'salida-1', paso: 1, trazado: ['Vilaboa'] }), null);
  });

  test('Una salida sin ningún sitio apto no hace saltar nada y deja la oportunidad como estaba', () => {
    const { micro, estado } = conCola([oportunidad({ asunto: 'setas-de-temporada', escena: 'misterio' })]);
    const trazado = [FONTE, CRUCEIRO, POZO];
    assert.deepEqual(micro.sitiosAptos({ trazado, escena: 'misterio' }), []);
    let paso = 0;
    for (const sitio of trazado) assert.equal(micro.atraviesa({ sitio, salida: 'salida-1', paso: ++paso, trazado }), null);
    micro.cierraSalida({ salida: 'salida-1', paso });
    const [entrada] = pendientes(estado, { mapaId: MAPA });
    assert.equal(entrada.estado, ESTADOS_DE_ENTRADA.PENDIENTE);
    assert.deepEqual(entrada.ofertas, []);
  });

  test('El sitio resuelto es una localización del mundo con nombre y anclaje, nunca una coordenada', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const aviso = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [FONTE] });
    assert.equal(aviso.sitio.nombre, FONTE);
    assert.equal(aviso.sitio.tipo, 'paraje');
    assert.ok(aviso.sitio.anclaje && aviso.sitio.anclaje.osmId, 'el sitio resuelto llega sin anclaje');
    for (const coordenada of ['lat', 'lon', 'x', 'y']) assert.ok(!(coordenada in aviso.sitio), `el sitio trae "${coordenada}"`);
  });

  test('Una oferta contra un sitio que no existe en el mapa falla nombrando el sitio', () => {
    const { micro, estado } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    assert.throws(
      () => micro.atraviesa({ sitio: 'A Taberna Inventada', salida: 'salida-1', paso: 1, trazado: ['A Taberna Inventada'] }),
      (e) => e instanceof Error && e.message.includes('A Taberna Inventada'),
    );
    assert.deepEqual(pendientes(estado, { mapaId: MAPA })[0].ofertas, []);
  });

  test('El contenido de una oportunidad es el mismo se resuelva donde se resuelva', () => {
    const contenido = (sitio) => {
      const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro', clase: 'encargo' })]);
      const aviso = micro.atraviesa({ sitio, salida: 'salida-1', paso: 1, trazado: [FONTE, CRUCEIRO] });
      return { entrada: aviso.entrada, asunto: aviso.asunto, clase: aviso.clase, escena: aviso.escena, beats: aviso.beats };
    };
    assert.deepEqual(contenido(FONTE), contenido(CRUCEIRO), 'lo que se entrega depende de por dónde pasa la jugadora');
  });

  test('Sin trazado y sin llegada declarada falla nombrando lo que falta, en vez de elegir un sitio cualquiera', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    assert.throws(
      () => micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1 }),
      (e) => e instanceof Error && /trazado/.test(e.message) && /llegada/.test(e.message),
    );
  });

  test('Sin aventura aceptada el lugar se resuelve por llegada real y el micro-encuentro puede saltar', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const aviso = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, porLlegada: true });
    assert.ok(aviso, 'salir a andar sin aventura deja al mundo sin nada que entregar');
    assert.equal(aviso.enElTrazado, false);
  });

  test('Los sitios aptos de un trazado se buscan sobre la lista de sitios y no sobre otra cosa', () => {
    const { micro } = conCola([]);
    assert.deepEqual(micro.sitiosAptos({ trazado: [FONTE, POZO, CRUCEIRO], escena: 'encuentro' }), [FONTE, CRUCEIRO]);
    assert.throws(() => micro.sitiosAptos({ trazado: FONTE, escena: 'encuentro' }), /trazado|lista/);
    assert.throws(() => micro.sitiosAptos({ trazado: [FONTE] }), /escena/);
  });
});

describe('Coste cero de desvío', () => {
  /** Una salida real: el reparto de aventuras de un mundo congelado, con su lazo y su presupuesto. */
  async function salidaReal() {
    const mundo = await mundoDeReferencia('costero', '1');
    const reparto = repartoDeAventuras({ mundo, tramo: TRAMO, tamano: 'aventura' });
    const huella = () => JSON.stringify(reparto.aventuras.map((a) => ({
      plantilla: a.plantilla,
      beats: a.beats.map((b) => b.lugar.nombre),
      metros: a.lazo.metros,
      cabe: a.cabe,
    })));
    return { mundo, reparto, huella };
  }

  test('Atender un micro-encuentro deja la cadena de beats, el presupuesto y el tamaño de la aventura como estaban', async () => {
    const { mundo, reparto, huella } = await salidaReal();
    const antes = huella();
    const alcanceAntes = { alcanceM: reparto.alcanceM, alcanceEnTramos: reparto.alcanceEnTramos };

    const estado = estadoDeEntregas();
    encola(estado, { mapaId: MAPA, produccion: oportunidad({ asunto: 'setas-de-temporada', escena: 'misterio' }) });
    const micro = creaMicroEncuentros({ mundo, mapaId: MAPA, estado });
    const aptos = micro.sitiosAptos({ trazado: [...sitiosDelMundo(mundo).keys()], escena: 'misterio' });
    assert.ok(aptos.length, 'el mundo costero no tiene ningún sitio de misterio y la prueba no mide nada');
    const aviso = micro.atraviesa({ sitio: aptos[0], salida: 'salida-1', paso: 1, trazado: aptos });
    micro.atiende(aviso.entrada);

    const despues = repartoDeAventuras({ mundo, tramo: TRAMO, tamano: 'aventura' });
    assert.equal(
      JSON.stringify(despues.aventuras.map((a) => ({ plantilla: a.plantilla, beats: a.beats.map((b) => b.lugar.nombre), metros: a.lazo.metros, cabe: a.cabe }))),
      antes,
      'atender un micro-encuentro ha movido la cadena de beats, los metros o si cabe',
    );
    assert.deepEqual({ alcanceM: despues.alcanceM, alcanceEnTramos: despues.alcanceEnTramos }, alcanceAntes, 'el presupuesto de la aventura ha cambiado');
  });

  test('El lazo recorrido con un micro-encuentro atendido es el mismo que sin él', async () => {
    const { mundo } = await salidaReal();
    const lazo = (con) => {
      const estado = estadoDeEntregas();
      if (con) encola(estado, { mapaId: MAPA, produccion: oportunidad({ asunto: 'setas-de-temporada', escena: 'misterio' }) });
      const micro = creaMicroEncuentros({ mundo, mapaId: MAPA, estado });
      const trazado = micro.sitiosAptos({ trazado: [...sitiosDelMundo(mundo).keys()], escena: 'misterio' });
      // El trazado que se recorre es el mismo objeto en los dos casos: el
      // micro-encuentro no puede añadirle ni quitarle un sitio.
      const recorrido = [];
      trazado.forEach((sitio, k) => {
        recorrido.push(sitio);
        micro.atraviesa({ sitio, salida: 'salida-1', paso: k + 1, trazado });
      });
      return recorrido;
    };
    assert.deepEqual(lazo(true), lazo(false), 'el micro-encuentro ha cambiado el lazo recorrido');
  });

  test('Un sitio apto que exige salirse del trazado vigente no es candidato', () => {
    const { micro, estado } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    // CRUCEIRO admite la escena, pero no está en el trazado: nunca hay metros de ida
    // ni de vuelta porque nunca se sale del lazo.
    assert.equal(micro.atraviesa({ sitio: CRUCEIRO, salida: 'salida-1', paso: 1, trazado: [FONTE, POZO] }), null);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA })[0].ofertas, []);
  });

  test('Un micro-encuentro ignorado no cambia nada de la aventura principal', async () => {
    const { mundo, huella } = await salidaReal();
    const antes = huella();
    const estado = estadoDeEntregas();
    encola(estado, { mapaId: MAPA, produccion: oportunidad({ asunto: 'setas-de-temporada', escena: 'misterio' }) });
    const micro = creaMicroEncuentros({ mundo, mapaId: MAPA, estado });
    const aptos = micro.sitiosAptos({ trazado: [...sitiosDelMundo(mundo).keys()], escena: 'misterio' });
    micro.atraviesa({ sitio: aptos[0], salida: 'salida-1', paso: 1, trazado: aptos });
    micro.cierraSalida({ salida: 'salida-1', paso: 1 });

    const despues = repartoDeAventuras({ mundo, tramo: TRAMO, tamano: 'aventura' });
    assert.equal(
      JSON.stringify(despues.aventuras.map((a) => ({ plantilla: a.plantilla, beats: a.beats.map((b) => b.lugar.nombre), metros: a.lazo.metros, cabe: a.cabe }))),
      antes,
    );
  });

  test('Un micro-encuentro tiene exactamente un beat y no se contabiliza en ningún presupuesto', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const aviso = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [FONTE] });
    assert.equal(BEATS_DEL_MICROENCUENTRO, 1);
    assert.equal(aviso.beats, 1);
    assert.equal(aviso.cuentaEnElPresupuesto, false);
  });

  test('Un micro-encuentro no tiene disparador de franja ni tiempo límite', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const aviso = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [FONTE] });
    assert.equal(aviso.franja, null);
    assert.equal(aviso.limite, null);
    const codigo = codigoDe(fuente('packages/nucleo/partida/microencuentros.js'));
    for (const temporizador of ['setTimeout', 'setInterval', 'Date.now', 'new Date']) {
      assert.ok(!codigo.includes(temporizador), `el micro-encuentro usa ${temporizador}`);
    }
  });
});

describe('No se avisa durante un beat en curso', () => {
  test('No se avisa durante un beat en curso', () => {
    // El escenario de la batería, en la mitad que es de núcleo: con la escena abierta
    // el mundo produce igual, pero no se ofrece nada; cuando la escena termina, el
    // micro-encuentro retenido puede ofrecerse. El aviso es de la fila 29.
    const { micro, estado } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const trazado = [FONTE, CRUCEIRO];

    assert.equal(micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado, beatEnCurso: true }), null);
    const retenida = pendientes(estado, { mapaId: MAPA })[0];
    assert.equal(retenida.estado, ESTADOS_DE_ENTRADA.PENDIENTE);
    assert.deepEqual(retenida.ofertas, [], 'estar dentro de una escena le ha costado una oferta');

    const aviso = micro.atraviesa({ sitio: CRUCEIRO, salida: 'salida-1', paso: 1, trazado, beatEnCurso: false });
    assert.ok(aviso, 'terminada la escena, el micro-encuentro retenido no se ofrece');
    assert.equal(aviso.sitio.nombre, CRUCEIRO);
  });

  test('Manda el beat cuando la jugadora atraviesa un sitio apto justo al entrar en su geofence', () => {
    const { micro, estado } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    // El mismo sitio, el mismo paso y el mismo instante: el beat comienza y el
    // micro-encuentro no se ofrece.
    assert.equal(micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [FONTE], beatEnCurso: true }), null);
    assert.deepEqual(pendientes(estado, { mapaId: MAPA })[0].ofertas, []);
  });

  test('Una salida entera dentro de escenas encadenadas no consume ninguna oferta', () => {
    const { micro, estado } = conCola([
      oportunidad({ asunto: 'uno', escena: 'encuentro', paso: 1 }),
      oportunidad({ asunto: 'dos', escena: 'encuentro', paso: 2 }),
    ]);
    const trazado = [FONTE, CRUCEIRO];
    let paso = 0;
    for (const sitio of [...trazado, ...trazado, ...trazado]) {
      assert.equal(micro.atraviesa({ sitio, salida: 'salida-1', paso: ++paso, trazado, beatEnCurso: true }), null);
    }
    micro.cierraSalida({ salida: 'salida-1', paso });
    const cola = pendientes(estado, { mapaId: MAPA });
    assert.equal(cola.length, 2, 'una salida entera dentro de escenas ha sedimentado algo');
    for (const e of cola) assert.deepEqual(e.ofertas, [], `${e.id} ha consumido oferta estando retenida`);
  });

  test('Un beat que nunca declara su fin deja las oportunidades retenidas pendientes y no pierde ninguna', () => {
    const { micro, estado } = conCola([oportunidad({ asunto: 'uno', escena: 'encuentro' })]);
    const antes = JSON.stringify(congelaEntregas(estado));
    for (let paso = 1; paso <= 30; paso++) {
      assert.equal(micro.atraviesa({ sitio: FONTE, salida: 'salida-larga', paso, trazado: [FONTE], beatEnCurso: true }), null);
    }
    const sedimentadas = micro.cierraSalida({ salida: 'salida-larga', paso: 30 });
    assert.deepEqual(sedimentadas, [], 'un beat que no cierra ha sedimentado lo retenido');
    assert.equal(JSON.stringify(congelaEntregas(estado)), antes, 'un beat que no cierra ha movido la cola');
  });

  test('El estado del beat llega como dato de dos valores y no se deduce de la posición ni del tiempo parado', () => {
    assert.equal(retieneElAviso(true), true);
    assert.equal(retieneElAviso(false), false);
    for (const valor of [null, undefined, 'sí', 1, 0, {}]) {
      assert.throws(() => retieneElAviso(valor), (e) => e instanceof Error && /beat/.test(e.message));
    }
    const codigo = codigoDe(fuente('packages/nucleo/partida/microencuentros.js'));
    for (const deducido of ['posicion', 'posición', 'gps', 'geofence', 'parado', 'Date']) {
      assert.ok(!codigo.includes(deducido), `el micro-encuentro deduce el beat de "${deducido}"`);
    }
  });

  test('La regla de no avisar durante un beat está escrita en un solo sitio', () => {
    // Es la comprobación que hace que quitarla ponga en rojo el caso: si el estado
    // del beat se interpretara en dos sitios, el día que cuelgue otro aviso de esta
    // capa protegería la escena solo la mitad de las veces.
    const codigo = codigoDe(fuente('packages/nucleo/partida/microencuentros.js'));
    const definiciones = codigo.match(/function\s+retieneElAviso\b/g) ?? [];
    assert.equal(definiciones.length, 1, 'la regla está definida más de una vez');

    // Fuera de su definición, `beatEnCurso` solo aparece como parámetro recibido y
    // como argumento de la regla: no hay ninguna segunda comparación.
    const cuerpo = codigo.split('function retieneElAviso')[1];
    const usos = (cuerpo.match(/beatEnCurso/g) ?? []).length;
    const dentroDeLaRegla = (cuerpo.split('const atraviesa')[0].match(/beatEnCurso/g) ?? []).length;
    assert.equal(usos - dentroDeLaRegla, 2, 'beatEnCurso se interpreta fuera de la regla');
    assert.ok(/if\s*\(\s*retieneElAviso\(\s*beatEnCurso\s*\)\s*\)/.test(codigo), 'el disparo no consulta la regla');

    // Y ningún otro módulo del paquete implementa su propia versión.
    for (const modulo of ['packages/nucleo/partida/entregas.js', 'packages/nucleo/partida/recados.js']) {
      assert.ok(!codigoDe(fuente(modulo)).includes('beatEnCurso'), `${modulo} tiene su propia guarda de beat`);
    }
  });

  test('La regla se consulta antes que ninguna otra guarda, así que durante una escena ni se mira la cola', () => {
    // Con la cola vacía y un sitio que no está en el trazado, la regla sigue mandando:
    // devuelve `null` sin llegar a mirar nada más, y lo hace también cuando el estado
    // del beat es inválido, que es lo que delata el orden.
    const { micro } = conCola([]);
    assert.throws(() => micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [], beatEnCurso: 'sí' }), /beat/);
  });
});

describe('La frontera del micro-encuentro no admite dos formas en el mismo parámetro', () => {
  test('Un sitio suelto en lugar de un trazado falla nombrando lo recibido', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    assert.throws(
      () => micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: FONTE }),
      (e) => e instanceof Error && e.message.includes(FONTE) && /trazado/.test(e.message),
    );
  });

  test('Una salida, un paso o una llegada mal formados fallan nombrando lo que llegó', () => {
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    assert.throws(() => micro.atraviesa({ sitio: FONTE, paso: 1, trazado: [FONTE] }), /salida/);
    assert.throws(() => micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: -1, trazado: [FONTE] }), /paso/);
    assert.throws(() => micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, porLlegada: 'sí' }), /llegada/);
    assert.throws(() => micro.atraviesa({ sitio: 42, salida: 'salida-1', paso: 1, trazado: [FONTE] }), /sitio|coordenada/);
  });

  test('Un mundo con un sitio sin nombre falla al indexarlo, porque el nombre es su identificador', () => {
    const mundo = mundoDeSitios();
    mundo.parajes[0].name = '';
    assert.throws(() => sitiosDelMundo(mundo), /nombre/);
  });

  test('El micro-encuentro no expone ninguna cifra de distancia, tiempo, ritmo ni progreso', () => {
    for (const nombre of Object.keys(moduloDeMicroencuentros)) {
      assert.ok(!/(metros|km|minutos|distancia|ritmo|progreso|velocidad)/i.test(nombre), `el micro-encuentro exporta "${nombre}"`);
    }
    const { micro } = conCola([oportunidad({ asunto: 'aceite-para-la-botica', escena: 'encuentro' })]);
    const aviso = micro.atraviesa({ sitio: FONTE, salida: 'salida-1', paso: 1, trazado: [FONTE] });
    for (const cifra of ['metros', 'distancia', 'minutos', 'tiempo']) assert.ok(!(cifra in aviso), `el aviso trae "${cifra}"`);
  });

  test('El micro-encuentro no importa la generación ni habla con la plataforma', () => {
    const texto = fuente('packages/nucleo/partida/microencuentros.js');
    const importa = texto.split('\n').filter((l) => /^import\s/.test(l.trim()));
    for (const linea of importa) {
      assert.ok(!/react|expo|navigator|window/i.test(linea), `el micro-encuentro importa la plataforma: ${linea.trim()}`);
      assert.ok(!/world\/(build|celda|rejilla|osm)/.test(linea), `el micro-encuentro importa la generación: ${linea.trim()}`);
    }
    assert.ok(SEMILLA_A, 'la semilla de las pruebas se lee del andamiaje y no del reloj');
  });
});
