// SPEC-028 · La portada (A2P1) y el registro de la salida abierta.
//
// Lo que se afirma aquí es, sobre todo, **una lista de ausencias**. El diseño descartó
// por escrito el panel del estado del mundo, el medidor de reputación, la barra de
// pestañas y el selector de mapas, y una ausencia solo se puede poner roja contra una
// enumeración de lo que sí hay: comprobada a ojo es un criterio que se cumple casi
// siempre y no mide nada (`pipeline/decisiones-orquestador.md` §6o). Por eso todo lo de
// aquí se afirma contra `BLOQUES_DE_PORTADA` —igualdades, no inspecciones— y por eso
// estas pruebas corren en Node sin ningún dispositivo.
//
// La otra mitad es el registro de la salida abierta, que esta fila entrega porque es la
// primera que lo necesita: sin él la tarjeta de a medias no se puede componer. Sus dos
// ausencias son requisito y no descuido —ninguna coordenada y ninguna marca de tiempo,
// RF-PRIV-002— y tienen caso propio.
//
// Los escenarios que ya existían en `docs/testing.md` llevan su nombre literal; los
// demás van marcados como hueco de la batería en `test/spec-test-map.json`.
//
// Nada de aquí toca la red, el reloj del sistema ni el azar: el día se inyecta.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCIONES_DE_A_MEDIAS,
  ACCIONES_DE_SALIR,
  BLOQUES_DE_PORTADA,
  BLOQUES_QUE_LA_PORTADA_NO_TIENE,
  DESTINOS_DE_VER,
  NIVEL_DE_LAS_ACCIONES,
  PUERTAS,
  TINTAS_DE_LA_MINIATURA,
  componePortada,
  exigeBloqueDePortada,
  hayZurronQueVaciar,
} from '../../packages/nucleo/partida/portada.js';
import {
  IDS_DE_VIA,
  VIAS_DE_CIERRE,
  abreSalida,
  aceptaAventuraEnLaSalida,
  anotaDondeSeQuedo,
  cierraLaSalida,
  congelaSalidaAbierta,
  estadoDeSalidaAbierta,
  haySalidaAbierta,
  levantaSalidaAbierta,
  salidaAbierta,
} from '../../packages/nucleo/partida/salida-abierta.js';
import { PIEZA_DEL_CALENDARIO, diaDe, exigeCalendario } from '../../packages/nucleo/partida/calendario.js';
import { cifrasDeTexto } from '../../packages/nucleo/partida/guion-de-arranque.js';
import { MUNDO, PERSONAJE, calendarioEn, textosDe } from './antes-de-salir-de-prueba.mjs';

/** La portada de una partida sin nada abierto, que es el caso normal. */
function portadaLimpia(extra = {}) {
  return componePortada({
    calendario: calendarioEn(),
    personaje: PERSONAJE,
    mundo: MUNDO,
    salidas: estadoDeSalidaAbierta(),
    ...extra,
  });
}

/** Un registro con una salida abierta y su sitio anotado. */
function conSalidaAbierta({ aventura = 'tres-pistas', sitio = 'o camiño do Torreón' } = {}) {
  const salidas = estadoDeSalidaAbierta();
  abreSalida(salidas, { salida: 'casa/d23/s1', mapaId: 'casa', aventura });
  if (sitio) anotaDondeSeQuedo(salidas, { sitio });
  return salidas;
}

// ── El vocabulario cerrado ──────────────────────────────────────────────────────

describe('La portada se compone sobre un vocabulario cerrado', () => {
  test('La portada trae exactamente sus bloques y ninguno más', () => {
    const portada = portadaLimpia();
    // Sin salida abierta, cuatro: la miniatura con su día, la identidad, las acciones de
    // salir y las tres puertas. Es la enumeración entera del criterio.
    assert.deepEqual(portada.bloques, ['miniatura', 'identidad', 'acciones-de-salir', 'puertas']);

    const conSalida = portadaLimpia({ salidas: conSalidaAbierta() });
    assert.deepEqual(conSalida.bloques, ['miniatura', 'identidad', 'a-medias', 'acciones-de-salir', 'puertas']);

    // Y todo lo que sale está en el vocabulario: no hay ningún bloque compuesto al vuelo.
    for (const bloque of conSalida.bloques) {
      assert.ok(BLOQUES_DE_PORTADA.includes(bloque), `el bloque "${bloque}" no está en el vocabulario cerrado`);
    }
    assert.deepEqual([...BLOQUES_DE_PORTADA], ['miniatura', 'identidad', 'a-medias', 'acciones-de-salir', 'puertas']);
  });

  test('Un bloque que el vocabulario no declara falla enumerando los que hay y los que no puede haber', () => {
    // Es el sitio donde se quiere que salte: añadir un panel obligaría a ampliar la
    // lista, y ampliarla se ve en el diff.
    assert.throws(() => exigeBloqueDePortada('panel-del-mundo'), (e) => {
      assert.match(e.message, /panel-del-mundo/);
      for (const bloque of BLOQUES_DE_PORTADA) assert.ok(e.message.includes(bloque), `el error no enumera "${bloque}"`);
      for (const bloque of BLOQUES_QUE_LA_PORTADA_NO_TIENE) assert.ok(e.message.includes(bloque), `el error no nombra la ausencia "${bloque}"`);
      return true;
    });
    for (const bloque of BLOQUES_DE_PORTADA) assert.equal(exigeBloqueDePortada(bloque), bloque);
  });

  test('No existe ningún bloque de estado del mundo', () => {
    const portada = portadaLimpia({ salidas: conSalidaAbierta() });
    // Las dos mitades: ni aparece compuesto, ni el vocabulario tiene forma de expresarlo.
    assert.ok(BLOQUES_QUE_LA_PORTADA_NO_TIENE.includes('panel-del-mundo'));
    assert.equal(portada.bloques.includes('panel-del-mundo'), false);
    assert.equal(BLOQUES_DE_PORTADA.includes('panel-del-mundo'), false);
    // Y las dos listas no se tocan: un bloque de la de abajo en la de arriba sería un
    // rediseño con nombre y apellidos.
    const solape = BLOQUES_DE_PORTADA.filter((b) => BLOQUES_QUE_LA_PORTADA_NO_TIENE.includes(b));
    assert.deepEqual(solape, [], 'el vocabulario de la portada declara un bloque que el diseño descartó');
  });

  test('No hay ninguna barra ni lista de reputación', () => {
    const portada = portadaLimpia({ salidas: conSalidaAbierta() });
    assert.ok(BLOQUES_QUE_LA_PORTADA_NO_TIENE.includes('marcador-de-reputacion'));
    assert.equal(portada.bloques.includes('marcador-de-reputacion'), false);
    assert.equal(BLOQUES_DE_PORTADA.includes('marcador-de-reputacion'), false);

    // Y el rango no se cuela por la identidad, que es el único sitio donde cabría: bajo
    // el nombre sería una etiqueta permanente, que es un medidor con otro nombre.
    assert.deepEqual(Object.keys(portada.identidad).sort(), ['nombre', 'oficio']);
    const serializada = JSON.stringify(portada);
    for (const palabra of ['rango', 'reputaci', 'forastera', 'alguien de aquí', 'puntuaci']) {
      assert.equal(serializada.toLowerCase().includes(palabra.toLowerCase()), false, `la portada dice "${palabra}"`);
    }
  });

  test('No existe ningún selector de mapas', () => {
    const portada = portadaLimpia();
    assert.ok(BLOQUES_QUE_LA_PORTADA_NO_TIENE.includes('selector-de-mapas'));
    assert.equal(BLOQUES_DE_PORTADA.includes('selector-de-mapas'), false);
    // El mapa activo se declara, y no hay ninguna manera de cambiarlo desde aquí: la
    // miniatura enseña el suyo y ni siquiera es tocable.
    assert.equal(portada.miniatura.mapa, MUNDO.mapaId);
    assert.equal(portada.miniatura.tocable, false);
    const acciones = portada.acciones.map((a) => a.id);
    assert.deepEqual(acciones, [...ACCIONES_DE_SALIR], 'las acciones de salir no son las dos declaradas');
    assert.equal(acciones.some((id) => /mapa/.test(id)), false);
  });

  test('Los tres destinos cuelgan de la portada y no de una barra de pestañas', () => {
    const portada = portadaLimpia();
    assert.equal(portada.puertas.length, 3, 'los destinos de navegación no son tres');
    assert.deepEqual(portada.puertas.map((p) => p.id), [...PUERTAS]);
    assert.deepEqual(portada.puertas.map((p) => p.id), ['diario', 'repisa', 'ajustes']);
    // La fila al pie se declara, y su negación también: cuatro destinos de igual peso
    // convertirían el juego en una aplicación con secciones.
    assert.equal(portada.enBarraDePestanas, false);
    assert.equal(BLOQUES_DE_PORTADA.includes('barra-de-pestanas'), false);
    assert.ok(BLOQUES_QUE_LA_PORTADA_NO_TIENE.includes('barra-de-pestanas'));
    for (const puerta of portada.puertas) assert.ok(puerta.texto.length > 0, `la puerta "${puerta.id}" no tiene texto`);
  });

  test('Salir a andar sin nada es una opción de primer nivel', () => {
    const portada = portadaLimpia();
    const sinMas = portada.acciones.find((a) => a.id === 'salir-sin-mas');
    const verQueSeCuenta = portada.acciones.find((a) => a.id === 'ver-que-se-cuenta');

    assert.ok(sinMas, 'no hay ninguna acción para salir a andar sin aventura');
    assert.equal(sinMas.texto, 'Salir a andar sin más');
    // El mismo nivel que la otra, y no un enlace pequeño debajo: ponerlo como nota al pie
    // diría lo contrario de lo que el diseño decidió, y lo diría más alto que un texto.
    assert.equal(sinMas.nivel, verQueSeCuenta.nivel);
    assert.equal(sinMas.nivel, NIVEL_DE_LAS_ACCIONES);
    assert.equal(NIVEL_DE_LAS_ACCIONES, 'primero');
    assert.deepEqual(new Set(portada.acciones.map((a) => a.nivel)), new Set(['primero']), 'las acciones de salir no van todas al mismo nivel');
  });
});

// ── La miniatura, la identidad y el día ─────────────────────────────────────────

describe('Lo que la portada enseña de un vistazo', () => {
  test('La miniatura enseña lo entintado contra lo que sigue a lápiz, y ningún porcentaje', () => {
    const portada = portadaLimpia();
    assert.deepEqual(portada.miniatura.tintas, [...TINTAS_DE_LA_MINIATURA]);
    assert.deepEqual([...TINTAS_DE_LA_MINIATURA], ['de-hoy', 'asentado', 'a-lapiz']);
    // Ni una cifra de progreso en la miniatura: lo que no sale de aquí no se puede
    // pintar por descuido.
    for (const campo of ['porcentaje', 'progreso', 'entintadoPct', 'completado']) {
      assert.equal(campo in portada.miniatura, false, `la miniatura declara "${campo}"`);
    }
    assert.equal(portada.miniatura.titulo, MUNDO.titulo);
  });

  test('La identidad trae el nombre del personaje y su oficio, y ninguna cifra', () => {
    const portada = portadaLimpia();
    assert.deepEqual(portada.identidad, { nombre: 'Sabela', oficio: 'tabernera' });
    // El oficio se dice con la palabra que concuerda con quien juega; sin ella se enseña
    // la clave, que es fea pero cierta, y nunca nada inventado.
    const sinDecir = componePortada({
      calendario: calendarioEn(),
      personaje: { nombre: 'Xan', oficio: 'forja' },
      mundo: MUNDO,
      salidas: estadoDeSalidaAbierta(),
    });
    assert.deepEqual(sinDecir.identidad, { nombre: 'Xan', oficio: 'forja' });

    for (const { ruta, texto } of textosDe(portada.identidad)) {
      assert.deepEqual(cifrasDeTexto(texto), [], `la identidad lleva una cifra en ${ruta}: «${texto}»`);
    }
  });

  test('El día llega del calendario, entero y al lado del encabezado', () => {
    const portada = componePortada({
      calendario: calendarioEn(41),
      personaje: PERSONAJE,
      mundo: MUNDO,
      salidas: estadoDeSalidaAbierta(),
    });
    assert.equal(portada.dia, 41);
    assert.equal(portada.miniatura.dia, 41);
    // La única cifra de la portada, y no es una cifra de esfuerzo: vive fuera de todo
    // texto, así que la revisión de cifras sigue siendo total sobre el guion.
    assert.equal(portada.miniatura.encabezado, 'Tu mapa');
    assert.deepEqual(cifrasDeTexto(portada.miniatura.encabezado), []);
    // Y nunca una fecha: un calendario que devuelva otra cosa falla nombrando la pieza.
    for (const roto of [{ dia: () => 1.5 }, { dia: () => -1 }, { dia: () => Date.now() / 1e12 }, { dia: () => '3' }]) {
      assert.throws(() => diaDe(roto, 'la portada'), /entero no negativo/);
    }
    assert.equal(diaDe({ dia: () => 0 }), 0, 'el día cero es el de la partida recién empezada y no un error');
  });

  test('Una portada sin calendario cableado falla nombrando la pieza y no supone el día uno', () => {
    for (const sin of [undefined, null, {}, { dia: 3 }]) {
      assert.throws(
        () => componePortada({ calendario: sin, personaje: PERSONAJE, mundo: MUNDO, salidas: estadoDeSalidaAbierta() }),
        (e) => {
          assert.ok(e.message.includes(PIEZA_DEL_CALENDARIO), `el error no nombra la pieza: ${e.message}`);
          return true;
        },
        `la portada se compuso con el calendario ${JSON.stringify(sin) ?? String(sin)}`,
      );
    }
    // La frontera entera: nadie deduce el día de ningún sitio.
    assert.throws(() => exigeCalendario(null, 'la portada'), new RegExp(PIEZA_DEL_CALENDARIO));
  });

  test('La portada sin personaje ni mapa falla nombrando lo que falta', () => {
    const base = { calendario: calendarioEn(), personaje: PERSONAJE, mundo: MUNDO, salidas: estadoDeSalidaAbierta() };
    assert.throws(() => componePortada({ ...base, personaje: null }), /personaje/);
    assert.throws(() => componePortada({ ...base, personaje: { oficio: 'taberna' } }), /nombre del personaje/);
    assert.throws(() => componePortada({ ...base, personaje: { nombre: 'Sabela' } }), /oficio del personaje/);
    assert.throws(() => componePortada({ ...base, mundo: null }), /mapa levantado/);
  });
});

// ── La puerta del zurrón ────────────────────────────────────────────────────────

describe('La puerta del zurrón', () => {
  test('El zurrón solo aparece si hay reserva que vaciar', () => {
    // Con el modo de pasos de fondo apagado —que es como llega de origen, SPEC-027— la
    // puerta no existe, y «ver qué se cuenta» lleva directamente a la lista.
    const apagado = portadaLimpia({ zurron: { modoDeFondo: false, reserva: 12 } });
    assert.equal(apagado.acciones.find((a) => a.id === 'ver-que-se-cuenta').destino, DESTINOS_DE_VER.LISTA);
    assert.equal(hayZurronQueVaciar({ modoDeFondo: false, reserva: 12 }), false);
    assert.equal(hayZurronQueVaciar(), false, 'de origen el modo está apagado y la puerta no puede aparecer');

    // Encendido pero con la reserva vacía, tampoco: la pantalla enseñaría un resumen de nada.
    const vacia = portadaLimpia({ zurron: { modoDeFondo: true, reserva: 0 } });
    assert.equal(vacia.acciones.find((a) => a.id === 'ver-que-se-cuenta').destino, DESTINOS_DE_VER.LISTA);
    assert.equal(hayZurronQueVaciar({ modoDeFondo: true, reserva: 0 }), false);

    // Las dos condiciones a la vez, y entonces sí.
    const hay = portadaLimpia({ zurron: { modoDeFondo: true, reserva: 4 } });
    assert.equal(hay.acciones.find((a) => a.id === 'ver-que-se-cuenta').destino, DESTINOS_DE_VER.ZURRON);
    assert.equal(hayZurronQueVaciar({ modoDeFondo: true, reserva: ['a', 'b'] }), true, 'la reserva se cuenta igual venga como número o como lista');

    // Y la puerta no es un bloque de la portada: es el destino de una acción que ya existe.
    assert.equal(hay.bloques.includes('zurron'), false);
    assert.deepEqual(hay.bloques, apagado.bloques, 'la puerta del zurrón cambia los bloques de la portada');
  });

  test('Una reserva que no se cuenta en pasos guardados falla nombrando lo que llegó', () => {
    for (const mal of [-1, 1.5, 'tres', null]) {
      assert.throws(() => hayZurronQueVaciar({ modoDeFondo: true, reserva: mal }), /reserva del zurrón/);
    }
  });
});

// ── La aventura a medias ────────────────────────────────────────────────────────

describe('La aventura a medias', () => {
  test('La tarjeta de a medias solo existe con la salida abierta', () => {
    // Quien abandonó y llegó a casa no tiene ninguna salida abierta: el cierre en corto se
    // disparó al llegar, y la portada no enseña ninguna tarjeta.
    const salidas = conSalidaAbierta();
    cierraLaSalida(salidas, { via: VIAS_DE_CIERRE.VOLVER });

    const cerrada = portadaLimpia({ salidas });
    assert.equal(cerrada.aMedias, null, 'hay tarjeta de a medias sin ninguna salida abierta');
    assert.equal(cerrada.bloques.includes('a-medias'), false);
    assert.equal(haySalidaAbierta(salidas), false, 'la aventura no quedó cerrada al llegar a casa');

    // Y con una salida todavía abierta, la tarjeta aparece arriba, antes de las acciones.
    const abierta = portadaLimpia({ salidas: conSalidaAbierta() });
    assert.ok(abierta.aMedias, 'no hay tarjeta de a medias con una salida abierta');
    assert.equal(abierta.bloques.indexOf('a-medias'), 2);
    assert.ok(abierta.bloques.indexOf('a-medias') < abierta.bloques.indexOf('acciones-de-salir'));
  });

  test('La tarjeta dice dónde se dejó y ofrece seguir o dejarlo aquí', () => {
    const portada = portadaLimpia({ salidas: conSalidaAbierta() });
    assert.equal(portada.aMedias.titulo, 'Lo dejaste a medias');
    assert.equal(portada.aMedias.aventura, 'tres-pistas');
    assert.equal(portada.aMedias.donde, 'o camiño do Torreón');
    assert.deepEqual(portada.aMedias.acciones.map((a) => a.id), [...ACCIONES_DE_A_MEDIAS]);
    assert.equal(portada.aMedias.acciones[0].nivel, 'primero');
    assert.equal(portada.aMedias.acciones[1].nivel, 'segundo');
    // No pide confirmación: cerrar una salida no destruye nada, produce un desenlace.
    assert.equal(portada.aMedias.pideConfirmacion, false);

    // Sin sitio anotado no se inventa uno.
    const sinSitio = portadaLimpia({ salidas: conSalidaAbierta({ sitio: null }) });
    assert.equal(sinSitio.aMedias.donde, null);
  });

  test('Con la tarjeta en pantalla el resto de bloques siguen todos ahí', () => {
    const portada = portadaLimpia({ salidas: conSalidaAbierta() });
    // No es una pantalla que se interponga: se puede mirar el diario o salir a andar sin
    // ella (`bucle-jugable.md` §4, «no secuestra la app»).
    assert.equal(portada.aMedias.secuestraLaPortada, false);
    assert.deepEqual(portada.puertas.map((p) => p.id), [...PUERTAS]);
    assert.deepEqual(portada.acciones.map((a) => a.id), [...ACCIONES_DE_SALIR]);
    const limpia = portadaLimpia();
    assert.deepEqual(
      portada.bloques.filter((b) => b !== 'a-medias'),
      limpia.bloques,
      'la tarjeta de a medias se ha llevado por delante algún bloque',
    );
  });

  test('Una salida abierta desde hace días se lee igual y ningún texto dice cuánto lleva', () => {
    const salidas = conSalidaAbierta();
    const primerDia = componePortada({ calendario: calendarioEn(3), personaje: PERSONAJE, mundo: MUNDO, salidas });
    const muchoDespues = componePortada({ calendario: calendarioEn(97), personaje: PERSONAJE, mundo: MUNDO, salidas });

    assert.deepEqual(muchoDespues.aMedias, primerDia.aMedias, 'la tarjeta cambia con el paso de los días');
    // La identidad de la salida no se lee en pantalla: es la clave del registro, y lleva
    // el día dentro por construcción (`casa/d23/s1`). Lo que se revisa es lo que se pinta.
    for (const { ruta, texto } of textosDe(muchoDespues.aMedias).filter((t) => t.ruta !== 'salida')) {
      assert.deepEqual(cifrasDeTexto(texto), [], `la tarjeta lleva una cifra en ${ruta}: «${texto}»`);
      for (const palabra of ['hace', 'días', 'ayer', 'lleva']) {
        assert.equal(new RegExp(`\\b${palabra}\\b`, 'i').test(texto), false, `la tarjeta menciona el tiempo que lleva en ${ruta}: «${texto}»`);
      }
    }
  });

  test('«Dejarlo aquí» cierra por la misma vía que llegar a casa, con el mismo cierre en corto', () => {
    const aMano = conSalidaAbierta();
    const volviendo = conSalidaAbierta();

    const porLaTarjeta = cierraLaSalida(aMano, { via: VIAS_DE_CIERRE.DEJARLO_AQUI });
    const porVolver = cierraLaSalida(volviendo, { via: VIAS_DE_CIERRE.VOLVER });

    // Lo único que las distingue es la vía, que se guarda porque el diario querrá
    // contarla: todo lo demás —incluido el cierre en corto— es idéntico.
    assert.equal(porLaTarjeta.cierreEnCorto, true);
    assert.equal(porVolver.cierreEnCorto, true);
    assert.deepEqual({ ...porLaTarjeta, via: null }, { ...porVolver, via: null }, 'las dos vías no entregan lo mismo al telón');
    assert.deepEqual([...IDS_DE_VIA].sort(), ['dejarlo-aqui', 'volver'], 'hay más de dos vías de cierre');

    // Y por las dos la tarjeta desaparece y no queda ninguna salida abierta.
    for (const salidas of [aMano, volviendo]) {
      assert.equal(haySalidaAbierta(salidas), false);
      assert.equal(portadaLimpia({ salidas }).aMedias, null);
    }
  });

  test('Una vía de cierre que no está declarada falla enumerando las dos que hay', () => {
    const salidas = conSalidaAbierta();
    assert.throws(() => cierraLaSalida(salidas, { via: 'descartar' }), (e) => {
      assert.match(e.message, /descartar/);
      for (const via of IDS_DE_VIA) assert.ok(e.message.includes(via), `el error no enumera la vía "${via}"`);
      return true;
    });
    assert.equal(haySalidaAbierta(salidas), true, 'una vía inválida ha cerrado la salida igualmente');
    // Y cerrar dos veces echaría el telón dos veces sobre la misma salida.
    cierraLaSalida(salidas, { via: VIAS_DE_CIERRE.VOLVER });
    assert.throws(() => cierraLaSalida(salidas, { via: VIAS_DE_CIERRE.VOLVER }), /ninguna salida abierta que cerrar/);
  });
});

// ── El registro de la salida abierta ────────────────────────────────────────────

describe('El registro de la salida abierta', () => {
  test('El registro no guarda ninguna coordenada ni ninguna marca de tiempo', () => {
    const salidas = conSalidaAbierta();
    const abierta = salidaAbierta(salidas);
    // Lo mínimo, y las dos ausencias son requisito (RF-PRIV-002): el sitio va con el
    // nombre del mundo, que es lo único que la tarjeta enseña.
    assert.deepEqual(Object.keys(abierta).sort(), ['aventura', 'mapa', 'salida', 'sitio']);
    const serializado = JSON.stringify(congelaSalidaAbierta(salidas));
    for (const campo of ['lat', 'lon', 'latitud', 'longitud', 'coord', 'x', 'y', 'ts', 'timestamp', 'instante', 'fecha', 'hora']) {
      assert.equal(new RegExp(`"${campo}"`).test(serializado), false, `el registro guarda "${campo}"`);
    }
    assert.equal(/\d{4}-\d{2}-\d{2}/.test(serializado), false, 'el registro guarda algo con forma de fecha');
  });

  test('El registro va y vuelve de su documento sin perder nada', () => {
    const salidas = conSalidaAbierta();
    const ida = congelaSalidaAbierta(salidas);
    const vuelta = levantaSalidaAbierta(JSON.parse(JSON.stringify(ida)));
    assert.equal(JSON.stringify(congelaSalidaAbierta(vuelta)), JSON.stringify(ida));
    assert.deepEqual(salidaAbierta(vuelta), salidaAbierta(salidas));

    // Sin salida abierta el documento dice `null`, que es su estado normal.
    const limpio = estadoDeSalidaAbierta();
    assert.deepEqual(congelaSalidaAbierta(limpio), { abierta: null });
    assert.deepEqual(levantaSalidaAbierta({ abierta: null }), estadoDeSalidaAbierta());
    assert.deepEqual(levantaSalidaAbierta(undefined), estadoDeSalidaAbierta());
  });

  test('Dos salidas a la vez y dos aventuras en la misma salida fallan nombrando la que ya estaba', () => {
    const salidas = conSalidaAbierta({ aventura: null, sitio: null });
    assert.throws(
      () => abreSalida(salidas, { salida: 'casa/d24/s1', mapaId: 'casa' }),
      (e) => {
        assert.match(e.message, /casa\/d23\/s1/);
        assert.match(e.message, /una salida y una aventura/);
        return true;
      },
    );

    aceptaAventuraEnLaSalida(salidas, { aventura: 'tres-pistas' });
    assert.throws(() => aceptaAventuraEnLaSalida(salidas, { aventura: 'peregrinaje' }), (e) => {
      assert.match(e.message, /tres-pistas/);
      assert.match(e.message, /peregrinaje/);
      return true;
    });
    assert.equal(salidaAbierta(salidas).aventura, 'tres-pistas', 'la segunda aventura ha pisado a la primera');

    // Y sin salida abierta no se acepta nada: la salida se abre antes de coger nada.
    const limpio = estadoDeSalidaAbierta();
    assert.throws(() => aceptaAventuraEnLaSalida(limpio, { aventura: 'tres-pistas' }), /ninguna salida abierta/);
    assert.throws(() => anotaDondeSeQuedo(limpio, { sitio: 'o camiño' }), /ninguna salida abierta/);
  });
});

// ── Determinismo ────────────────────────────────────────────────────────────────

describe('La portada es determinista', () => {
  test('La misma partida, el mismo mundo y el mismo día componen la misma portada', () => {
    const salidas = conSalidaAbierta();
    const una = componePortada({ calendario: calendarioEn(), personaje: PERSONAJE, mundo: MUNDO, salidas, zurron: { modoDeFondo: true, reserva: 2 } });
    const otra = componePortada({ calendario: calendarioEn(), personaje: PERSONAJE, mundo: MUNDO, salidas, zurron: { modoDeFondo: true, reserva: 2 } });
    // Serialización completa, no campo a campo: es lo único que afirma «idéntica» de verdad.
    assert.equal(JSON.stringify(otra), JSON.stringify(una));
    // Y componerla no toca el registro: mirar la portada no abre ni cierra nada.
    assert.equal(haySalidaAbierta(salidas), true);
    assert.deepEqual(salidaAbierta(salidas), { salida: 'casa/d23/s1', mapa: 'casa', aventura: 'tres-pistas', sitio: 'o camiño do Torreón' });
  });

  test('La portada compuesta llega congelada, y nadie la puede tocar por detrás', () => {
    const portada = portadaLimpia({ salidas: conSalidaAbierta() });
    assert.throws(() => { portada.bloques.push('panel-del-mundo'); }, TypeError);
    assert.throws(() => { portada.identidad.nombre = 'otro'; }, TypeError);
    assert.throws(() => { portada.puertas[0].texto = 'Ajustes'; }, TypeError);
  });
});
