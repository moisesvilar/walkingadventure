// SPEC-042 · Los pasos del día a día: el interruptor que no miente, la lectura al abrir y
//            lo que la app declara **no** hacer con la app cerrada.
//
// La mitad de privacidad de esta fila es bloqueante (`@privacidad`, RF-PRIV-003) y se
// cumple **no haciendo nada**, que es exactamente la clase de criterio que nadie ve
// romperse: el permiso permanente no se pide porque no está declarado, y una tarea
// periódica se cuela sin pedir ningún permiso nuevo. Por eso lo declarado vive como dato en
// `app/plataforma/permisos.js` y se contrasta aquí contra `app/app.json`, en `node --test`,
// en lugar de leerse a ojo en una revisión.
//
// El lector de salud es la frontera nueva de la fila y se dobla como todo aquí: se pasa
// otra fuente. El reloj real también entra inyectado —es de la app y no del núcleo—, así
// que ninguna prueba de este fichero espera a que pase el tiempo ni mira el reloj de
// verdad.
//
// Los casos con nombre de escenario son los de `docs/testing.md`, literales: «Los pasos de
// fondo vienen apagados», «La app no pide el permiso de ubicación permanente», «Estar un
// mes sin salir no acumula mundo pendiente», «La reserva de pasos de fondo tiene tope de
// cinco», «El contenido de un paso lo decide su número» y «Nada del personaje afecta al
// cuerpo». El resto va marcado como hueco en `test/spec-test-map.json`: la propia spec
// declara que el permiso de salud, la declaración de capacidades de fondo y el no contar
// dos veces los mismos metros no tienen escenario en la batería.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLAVE_DE_LA_MARCA,
  ESTADOS_DE_PERMISO,
  MOTIVOS_DE_LECTURA,
  VENTANA_INICIAL_MS,
  ZANCADA_M,
  creaLectorDeSalud,
  creaMarcaDeAgua,
  exigeEstadoDePermiso,
  exigeVentana,
  metrosDeLaLectura,
  metrosDePasos,
  solapeDeVentanas,
  ventanaSinSalidas,
} from '../../app/plataforma/lector-de-salud.js';
import {
  LO_QUE_NUNCA_SE_DECLARA,
  MODOS_DE_FONDO,
  MODULOS_DE_FONDO_QUE_NO_SE_MONTAN,
  PERMISOS_QUE_SE_PIDEN,
  TAREAS_PERIODICAS,
  revisaLaDeclaracion,
} from '../../app/plataforma/permisos.js';
import {
  AJUSTE,
  AVISO_SIN_PERMISO,
  DEL_NUCLEO,
  FILA_DE_AJUSTES,
  MOTIVOS_DE_APAGADO,
  TESTIDS,
  creaPasosDeFondo,
} from '../../app/salida/pasos-de-fondo.js';
import {
  AJUSTES_DE_ORIGEN,
  FILAS_DE_AJUSTES,
  IDS_DE_AJUSTE,
  cambiaAjuste,
  congelaAjustes,
  estadoDeAjustes,
} from '../../packages/nucleo/partida/ajustes.js';
import { TOPE_DE_RESERVA, kilometrosDeFondo, tamanoDeLaReserva } from '../../packages/nucleo/partida/kilometros.js';
import { congelaPasos, creaMotorDePasos, estadoDePasos } from '../../packages/nucleo/partida/pasos.js';
import { congelaRegistro, registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { almacenEnMemoria } from './partida-de-prueba.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import {
  METROS_POR_VENTANA,
  fuenteDeSalud,
  saludQueDaMetros,
  saludQueDaPasos,
  saludQueDeniega,
  saludQueDevuelveInvalido,
  saludQueNoResponde,
} from '../dobles/salud.mjs';

const MAPA = '42.40,-8.81';
const OTRO_MAPA = '43.36,-8.41';
const TRAMO = 2000;

/** Un instante de partida cualquiera, redondo y lejos de cero. Es reloj de la app, no del mundo. */
const T0 = 1_700_000_000_000;
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

/** El reloj real, inyectado: se mueve a mano y nunca lo mueve el sistema. */
function relojFalso(inicio = T0) {
  let t = inicio;
  return { ahora: () => t, avanza: (ms) => { t += ms; return t; }, pon: (v) => { t = v; return t; } };
}

function motorDe({ estado = estadoDePasos(), mapaId = MAPA } = {}) {
  return creaMotorDePasos({
    semilla: SEMILLA_A,
    mapaId,
    estado,
    productores: [{ id: 'rumores', produce: (n) => [{ tipo: 'rumor', nucleo: 'Monfrida', asunto: `lo del paso ${n}` }] }],
  });
}

/**
 * El código de un módulo sin sus comentarios.
 *
 * Hace falta porque varias afirmaciones de esta fila son **negativas** —«no pide nada con
 * recorrido», «no usa datos del cuerpo»— y los comentarios del módulo dicen exactamente
 * esas palabras para explicar que no lo hace. Buscar sobre el texto entero convertiría una
 * buena explicación en un fallo.
 */
function codigoDe(ruta) {
  return fuente(ruta)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .join('\n');
}

/** El núcleo que `creaPasosDeFondo` enumera, sin una función más. */
const nucleoDeLosPasos = { kilometrosDeFondo, tamanoDeLaReserva, AJUSTES_DE_ORIGEN, cambiaAjuste };

/**
 * Los pasos del día a día ya cableados, con su lector y su almacén.
 *
 * @param {object} opciones  `salud` la fuente doblada; `pedido` si el ajuste llega
 *   encendido en la partida; `marca` el instante hasta el que ya se leyó, si lo hay.
 */
function cableado({ salud = saludQueDaMetros(), pedido = false, marca = null, reloj = relojFalso(), ventanaInicialMs } = {}) {
  const almacen = almacenEnMemoria();
  if (marca != null) almacen.datos.set(CLAVE_DE_LA_MARCA, JSON.stringify({ leidoHasta: marca }));
  const lector = creaLectorDeSalud({
    fuente: salud,
    marca: creaMarcaDeAgua(almacen),
    ahora: reloj.ahora,
    ...(ventanaInicialMs === undefined ? {} : { ventanaInicialMs }),
  });
  const ajustes = estadoDeAjustes();
  if (pedido) cambiaAjuste(ajustes, AJUSTE, true);
  return { almacen, lector, ajustes, reloj, salud, pasos: creaPasosDeFondo({ nucleo: nucleoDeLosPasos, lector, ajustes }) };
}

// ── El modo, que viene apagado y no insiste ─────────────────────────────────────

describe('El modo de pasos de fondo, apagado de origen', () => {
  test('Los pasos de fondo vienen apagados', async () => {
    assert.equal(AJUSTES_DE_ORIGEN.pasosDelDiaADia, false, 'contar los pasos del día a día viene encendido');
    assert.deepEqual([...IDS_DE_AJUSTE], ['soloDeDia', 'pasosDelDiaADia']);

    // Y con el modo apagado no se lee nada: **cero ventanas pedidas a la app de salud**,
    // ningún paso ejecutado y el motivo declarado en lugar de un cero mudo.
    const { pasos, salud } = cableado();
    const motor = motorDe();
    const estado = await pasos.efectivo();
    assert.equal(estado.encendido, false);
    assert.equal(estado.motivo, MOTIVOS_DE_APAGADO.NO_PEDIDO);
    assert.equal(estado.aviso, null, 'con el modo simplemente apagado no hay nada que avisar');

    const lectura = await pasos.alAbrirLaApp({ motor, tramo: TRAMO });
    assert.equal(lectura.leyo, false);
    assert.equal(lectura.motivo, MOTIVOS_DE_LECTURA.MODO_APAGADO);
    assert.deepEqual([...lectura.pasos], []);
    assert.equal(lectura.metros, 0);
    assert.deepEqual(salud.ventanas(), [], 'con el modo apagado se ha leído la app de salud');
    assert.equal(salud.peticiones(), 0, 'con el modo apagado se ha pedido el permiso de salud');
    assert.equal(motor.contador(), 0, 'el mundo ha avanzado con el modo apagado');
  });

  test('El juego es completo sin activarlo y ninguna pantalla insiste', () => {
    // «Y el juego es completo sin activarlo» no tiene aserción posible tal como está
    // escrito en la batería —es una frase que nada persigue—, así que se mecaniza en las
    // dos formas verificables: **ninguna pantalla fuera de la fila de ajustes lo menciona**
    // y **ninguna aventura depende de él**.
    const filas = FILAS_DE_AJUSTES.filter((f) => f.ajuste === AJUSTE || f.id === FILA_DE_AJUSTES);
    assert.equal(filas.length, 1, 'el modo aparece en más de una fila de ajustes, o en ninguna');
    assert.equal(filas[0].tipo, 'interruptor');

    const donde = ['packages/nucleo/quests/catalogo.js', 'packages/nucleo/quests/casting.js', 'packages/nucleo/partida/guion-de-antes-de-salir.js', 'packages/nucleo/partida/guion-de-arranque.js'];
    for (const ruta of donde) {
      const texto = fuente(ruta);
      for (const patron of [/pasos del día a día/i, /pasosDelDiaADia/, /podómetro/i, /app de salud/i]) {
        assert.equal(patron.test(texto), false, `${ruta} menciona el modo de pasos de fondo: el juego tiene que ser completo sin él`);
      }
    }
  });

  test('El interruptor pide el permiso al encenderse, y solo entonces', async () => {
    const { pasos, salud, ajustes } = cableado({ salud: fuenteDeSalud({ permiso: 'sin-preguntar', alPedir: 'concedido' }) });
    assert.equal(salud.peticiones(), 0, 'se ha pedido el permiso sin tocar el interruptor');

    const encendido = await pasos.enciende();
    assert.equal(encendido.encendido, true);
    assert.equal(salud.peticiones(), 1, 'el permiso se pide en contexto y una sola vez');
    assert.equal(ajustes[AJUSTE], true);
    assert.equal(encendido.aviso, null);
    assert.equal(encendido.testid, TESTIDS.fila);
  });

  test('Denegar deja el interruptor apagado, se dice una vez y no se reintenta', async () => {
    const { pasos, salud, ajustes } = cableado({ salud: saludQueDeniega() });
    const resultado = await pasos.enciende();

    assert.equal(resultado.encendido, false);
    assert.equal(resultado.motivo, MOTIVOS_DE_APAGADO.DENEGADO);
    assert.equal(resultado.aviso, AVISO_SIN_PERMISO);
    assert.equal(resultado.testid, TESTIDS.aviso);
    assert.equal(ajustes[AJUSTE], false, 'la fila no volvió a «no» tras denegar');
    // La línea no ofrece ir a los ajustes del sistema ni insiste después.
    for (const patron of [/ajustes del sistema/i, /configuración/i, /vuelve a intentar/i, /reintenta/i]) {
      assert.equal(patron.test(AVISO_SIN_PERMISO), false, `el aviso insiste: ${patron}`);
    }

    // Volver a los ajustes más tarde no vuelve a pedirlo solo.
    const luego = await pasos.efectivo();
    assert.equal(luego.encendido, false);
    assert.equal(salud.peticiones(), 1, 'el permiso se ha vuelto a pedir solo');
  });

  test('El interruptor refleja lo que ocurre y nunca lo que se pidió', async () => {
    // Un permiso revocado desde el sistema lo apaga y lo dice, en lugar de seguir
    // encendido sin leer nada: un interruptor así es la degradación silenciosa de §6h.
    const salud = fuenteDeSalud({ permiso: 'concedido' });
    const { pasos, ajustes } = cableado({ salud, pedido: true });
    assert.equal((await pasos.efectivo()).encendido, true);

    salud.revoca('denegado');
    const tras = await pasos.efectivo();
    assert.equal(tras.encendido, false);
    assert.equal(tras.motivo, MOTIVOS_DE_APAGADO.REVOCADO);
    assert.equal(tras.aviso, AVISO_SIN_PERMISO);
    assert.equal(ajustes[AJUSTE], false, 'el ajuste sigue encendido con el permiso revocado');

    // Y no poder preguntar no es haber denegado: se declara aparte.
    const sinFuente = cableado({ salud: fuenteDeSalud({ permiso: 'no-disponible' }), pedido: true });
    assert.equal((await sinFuente.pasos.efectivo()).motivo, MOTIVOS_DE_APAGADO.SIN_FUENTE);
  });

  test('Apagar el modo no borra ni ejecuta la reserva pendiente', async () => {
    const { pasos, ajustes } = cableado({ salud: saludQueDaMetros(3 * TRAMO), pedido: true });
    const motor = motorDe();
    await pasos.alAbrirLaApp({ motor, tramo: TRAMO });
    assert.equal(tamanoDeLaReserva(motor), 3);

    pasos.apaga();
    assert.equal(ajustes[AJUSTE], false);
    assert.equal(tamanoDeLaReserva(motor), 3, 'apagar el modo se llevó la reserva por delante');
    assert.equal(motor.contador(), 3, 'apagar el modo ejecutó los pasos pendientes de narrar');

    // Y con el modo apagado deja de leerse: la reserva se queda como estaba.
    const despues = await pasos.alAbrirLaApp({ motor, tramo: TRAMO });
    assert.equal(despues.motivo, MOTIVOS_DE_LECTURA.MODO_APAGADO);
    assert.equal(tamanoDeLaReserva(motor), 3);
  });

  test('Apagar y volver a encender no recupera los kilómetros del tiempo apagado', async () => {
    // El tiempo apagado no se lee, y volver a encender no puede abrir una ventana hacia
    // atrás: lo del tiempo apagado no ocurrió para el juego, y traerlo luego sería
    // acumular mundo pendiente por la puerta de atrás.
    const reloj = relojFalso();
    const salud = fuenteDeSalud({ permiso: 'concedido', metros: (v) => (v.hasta - v.desde) / HORA * TRAMO });
    const { pasos, ajustes } = cableado({ salud, pedido: true, reloj, ventanaInicialMs: HORA });
    const motor = motorDe();

    await pasos.alAbrirLaApp({ motor, tramo: TRAMO });
    const trasLaPrimera = motor.contador();
    assert.equal(trasLaPrimera, 1);

    // Diez días apagado, y al volver solo cuenta la hora que se anduvo con el modo puesto.
    pasos.apaga();
    reloj.avanza(10 * DIA);
    cambiaAjuste(ajustes, AJUSTE, true);
    reloj.avanza(HORA);

    const vuelta = await pasos.alAbrirLaApp({ motor, tramo: TRAMO });
    const [ultima] = salud.ventanas().slice(-1);
    assert.equal(
      ultima.hasta - ultima.desde,
      HORA,
      `al volver a encender se abrió una ventana de ${(ultima.hasta - ultima.desde) / DIA} días hacia atrás: el tiempo apagado no se lee`,
    );
    assert.equal(vuelta.pasos.length, 1, `volver a encender recuperó ${vuelta.pasos.length} pasos de los diez días apagado`);
    assert.equal(motor.contador(), trasLaPrimera + 1);
  });

  test('La orquestación de los pasos de fondo no arranca sin sus piezas', () => {
    assert.deepEqual([...DEL_NUCLEO], ['kilometrosDeFondo', 'tamanoDeLaReserva', 'AJUSTES_DE_ORIGEN', 'cambiaAjuste']);
    assert.throws(() => creaPasosDeFondo({ nucleo: null, lector: {}, ajustes: {} }), /sin el núcleo/);
    assert.throws(() => creaPasosDeFondo({ nucleo: { kilometrosDeFondo }, lector: {}, ajustes: {} }), /le falta "tamanoDeLaReserva"/);
    assert.throws(() => creaPasosDeFondo({ nucleo: nucleoDeLosPasos, lector: null, ajustes: {} }), /lector de la app de salud/);
    assert.throws(() => creaPasosDeFondo({ nucleo: nucleoDeLosPasos, lector: {}, ajustes: null }), /ajustes de la partida/);
  });
});

// ── Lo que la app declara, y lo que no declara nunca ────────────────────────────

describe('Lo que la app declara pedir y lo que nunca declara', () => {
  const manifiesto = () => JSON.parse(fuente('app/app.json'));

  test('La app no pide el permiso de ubicación permanente', () => {
    // La mitad de siempre: ni el manifiesto ni las piezas que esta fila añade nombran el
    // permiso permanente, que es la exclusión 12 del PRD y el más caro de todos.
    const permanentes = [
      /ACCESS_BACKGROUND_LOCATION/,
      /NSLocationAlwaysAndWhenInUseUsageDescription/,
      /NSLocationAlwaysUsageDescription/,
      /allowsBackgroundLocationUpdates/,
      /backgroundLocation/,
    ];
    for (const ruta of ['app/app.json', 'app/plataforma/lector-de-salud.js', 'app/salida/pasos-de-fondo.js']) {
      const texto = fuente(ruta);
      for (const patron of permanentes) {
        assert.equal(patron.test(texto), false, `${ruta} nombra un permiso de ubicación permanente (${patron})`);
      }
    }
    // Los permisos declarados son tres y la ubicación es «mientras se usa» y solo esa.
    const ids = PERMISOS_QUE_SE_PIDEN.map((p) => p.id);
    assert.deepEqual(ids, ['ubicacion-mientras-se-usa', 'notificaciones', 'salud-lectura']);
    for (const permiso of PERMISOS_QUE_SE_PIDEN) assert.ok(permiso.cuando && permiso.dueña, `el permiso "${permiso.id}" no dice cuándo se pide ni de quién es`);
    // Y el de salud se pide al encender el interruptor, nunca al instalar ni al abrir.
    assert.match(PERMISOS_QUE_SE_PIDEN.find((p) => p.id === 'salud-lectura').cuando, /al encender/);

    // La lista de lo que nunca se declara, contrastada contra el manifiesto de verdad.
    for (const prohibido of LO_QUE_NUNCA_SE_DECLARA) {
      assert.equal(fuente('app/app.json').includes(prohibido), false, `app.json declara "${prohibido}"`);
    }
    assert.deepEqual(revisaLaDeclaracion(manifiesto()), [], 'el manifiesto no cuadra con lo declarado en permisos.js');
    // Y la revisión reconoce lo que busca: un manifiesto con el permiso permanente falla.
    const roto = manifiesto();
    roto.expo.android.permissions.push('ACCESS_BACKGROUND_LOCATION');
    assert.equal(revisaLaDeclaracion(roto).length, 1);
  });

  test('La app no declara ninguna tarea periódica que lea con la app cerrada', () => {
    // Es la puerta por la que se cuela trabajo de fondo **sin pedir ningún permiso
    // nuevo**, así que la lista existe justamente para poder poner roja su ausencia.
    assert.deepEqual([...TAREAS_PERIODICAS], []);
    const texto = fuente('app/app.json');
    for (const patron of [/BGTaskScheduler/, /background-fetch/, /backgroundFetch/, /RECEIVE_BOOT_COMPLETED/, /SCHEDULE_EXACT_ALARM/]) {
      assert.equal(patron.test(texto), false, `app.json declara trabajo periódico (${patron})`);
    }
    // Y los módulos que lo traerían no están montados: la dependencia también es una
    // declaración, y esta es la que no se ve en el manifiesto.
    const dependencias = Object.keys(JSON.parse(fuente('app/package.json')).dependencies ?? {});
    for (const modulo of MODULOS_DE_FONDO_QUE_NO_SE_MONTAN) {
      assert.equal(dependencias.includes(modulo), false, `la app monta "${modulo}", que es fondo con otro nombre`);
    }
  });

  test('El único modo de fondo declarado es el que sostiene «mientras se usa»', () => {
    // REEXPRESADO respecto al criterio literal de la spec, y la reexpresión es el
    // contenido del caso. El AC dice «no declara ningún modo de fondo de ubicación», y eso
    // **choca de frente con SPEC-030 y con `seguridad-privacidad.md` §2**: lo que hace que
    // el permiso permanente no haga falta es precisamente que una salida abierta cuente
    // como «en uso» con la pantalla apagada, y en iOS eso es `UIBackgroundModes:
    // ["location"]`. Cumplir el AC al pie de la letra obligaría a pedir el permiso más
    // invasivo que existe, que es lo contrario de lo que la fila protege.
    //
    // Así que se afirma lo verificable y lo que la fila de verdad cierra: el modo es
    // **exactamente uno, con su motivo y su dueña**, y no hay ninguno nuevo por los pasos
    // del día a día. Un `processing`, un `fetch` o un `remote-notification` colados ahí
    // siguen poniendo esto rojo, que es la puerta real.
    assert.deepEqual(MODOS_DE_FONDO.map((m) => m.id), ['location']);
    assert.match(MODOS_DE_FONDO[0].porque, /SPEC-030/);
    assert.deepEqual(JSON.parse(fuente('app/app.json')).expo.ios.infoPlist.UIBackgroundModes, ['location']);

    // Y nada de lo que esta fila añade monta ningún modo ni tarea: los pasos se leen al
    // abrir, y con la app cerrada no se lee nada.
    for (const ruta of ['app/plataforma/lector-de-salud.js', 'app/salida/pasos-de-fondo.js']) {
      const texto = fuente(ruta);
      for (const patron of [/UIBackgroundModes/, /TaskManager/, /defineTask/, /setInterval/, /setTimeout/]) {
        assert.equal(patron.test(texto), false, `${ruta} programa trabajo de fondo (${patron})`);
      }
    }
  });

  test('Una lectura de salud pide metros o pasos en una ventana, y nada con recorrido', () => {
    // Se afirma por la **superficie que el lector usa de la fuente**, y no buscando
    // palabras en el fichero: el módulo nombra «rutas» y «recorrido» justo para decir que
    // no los pide, y buscar la palabra convertiría esa explicación en un fallo. Lo que
    // importa es qué le llega a pedir de verdad a la app de salud, y son cuatro cosas.
    const usadas = [...new Set([...codigoDe('app/plataforma/lector-de-salud.js').matchAll(/fuente\.(\w+)/g)].map((m) => m[1]))].sort();
    assert.deepEqual(usadas, ['estadoDelPermiso', 'metrosEnVentana', 'pasosEnVentana', 'pideElPermiso']);
    // Y lo que se le pasa es una ventana `{ desde, hasta }` y nada más: sin ventana no hay
    // manera de pedir un recorrido aunque alguien quisiera.
    const salud = fuenteDeSalud();
    assert.ok(salud.metrosEnVentana);
    // Y una fuente que no sepa dar ninguna de las dos se declara en lugar de suponerse.
    assert.deepEqual([...ESTADOS_DE_PERMISO], ['concedido', 'denegado', 'sin-preguntar', 'no-disponible']);
    assert.throws(() => exigeEstadoDePermiso('quizá'), /los declarados son/);
  });

  test('Nada del personaje afecta al cuerpo', () => {
    // La zancada con la que se convierten pasos en metros es **constante, única y no
    // personalizable**: personalizarla exigiría la altura o la longitud de zancada de
    // quien juega, que es pedir datos del cuerpo para mover un contador.
    assert.equal(typeof ZANCADA_M, 'number');
    assert.equal(metrosDePasos(1000), 1000 * ZANCADA_M);
    // Sobre el código sin comentarios: el módulo explica por qué **no** pide la altura, y
    // buscar la palabra sobre el texto entero convertiría esa explicación en un fallo.
    const codigo = codigoDe('app/plataforma/lector-de-salud.js');
    for (const patron of [/altura/i, /peso\b/i, /edad/i, /sexo/i, /género/i, /personaje/i]) {
      assert.equal(patron.test(codigo), false, `el lector usa un dato del cuerpo (${patron})`);
    }
    // Y la zancada es una constante del módulo, no un parámetro que alguien pueda ajustar.
    assert.equal(/ZANCADA_M\s*=/.test(codigo), true);
    assert.equal(/zancada\s*[=:]\s*(opciones|ajustes|personaje)/i.test(codigo), false, 'la zancada se puede personalizar');
    assert.throws(() => metrosDePasos(-1), /pasos finitos y no negativos/);
  });
});

// ── La lectura al abrir, y la marca que evita contar dos veces ──────────────────

describe('Los pasos se leen al abrir, y nunca de fondo', () => {
  test('Con el modo encendido se leen los metros acumulados y se convierten en pasos', async () => {
    const { pasos, salud } = cableado({ salud: saludQueDaMetros(3 * TRAMO), pedido: true });
    const motor = motorDe();
    const lectura = await pasos.alAbrirLaApp({ motor, tramo: TRAMO });

    assert.equal(lectura.leyo, true);
    assert.equal(lectura.metros, 3 * TRAMO);
    assert.equal(lectura.pasos.length, 3);
    assert.equal(lectura.enLaReserva, 3);
    assert.equal(salud.ventanas().length, 1, 'se ha leído la app de salud más de una vez al abrir');
  });

  test('Dos aperturas seguidas no cuentan dos veces los mismos metros', async () => {
    // La ventana inicial se acorta a una hora **para que la reserva no llegue llena a la
    // segunda lectura**: con la reserva en su tope no se ejecutaría ningún paso y el caso
    // pasaría por la razón equivocada.
    const reloj = relojFalso();
    const salud = fuenteDeSalud({ metros: (v) => (v.hasta - v.desde) / HORA * TRAMO });
    const { pasos } = cableado({ salud, pedido: true, reloj, ventanaInicialMs: HORA });
    const motor = motorDe();

    await pasos.alAbrirLaApp({ motor, tramo: TRAMO });
    const primera = motor.contador();
    assert.equal(primera, 1);
    reloj.avanza(2 * HORA);
    const segunda = await pasos.alAbrirLaApp({ motor, tramo: TRAMO });

    const ventanas = salud.ventanas();
    assert.equal(ventanas.length, 2);
    assert.equal(ventanas[1].desde, ventanas[0].hasta, 'la segunda lectura vuelve a mirar metros ya contados');
    assert.equal(segunda.pasos.length, 2, 'la segunda apertura contó más que las dos horas nuevas');
    assert.equal(motor.contador(), primera + 2);
  });

  test('Los metros de una salida activa no se cuentan dos veces', async () => {
    // Se resta **por tiempo**, que es lo único que se puede hacer sin pedirle a la app de
    // salud nada con recorrido: los metros que ya movieron el mundo andando no lo mueven
    // otra vez como pasos de fondo.
    const reloj = relojFalso();
    const salud = fuenteDeSalud({ metros: (v) => (v.hasta - v.desde) / HORA * TRAMO });
    const { pasos } = cableado({ salud, pedido: true, reloj, marca: T0 - 4 * HORA });
    const motor = motorDe();

    // De las cuatro horas de ventana, dos las cubre una salida abierta.
    const salidas = [{ desde: T0 - 3 * HORA, hasta: T0 - HORA }];
    const lectura = await pasos.alAbrirLaApp({ motor, tramo: TRAMO, salidas });
    assert.equal(lectura.metros, 2 * TRAMO, 'los metros de la ventana de la salida se contaron como pasos de fondo');
    assert.equal(lectura.pasos.length, 2);
    assert.deepEqual(salud.ventanas(), [
      { desde: T0 - 4 * HORA, hasta: T0 - 3 * HORA },
      { desde: T0 - HORA, hasta: T0 },
    ]);

    // Y una ventana cubierta entera no lee nada, pero **la marca avanza igual**: si no, la
    // siguiente apertura volvería a mirar lo mismo.
    const todo = cableado({ salud: fuenteDeSalud(), pedido: true, reloj: relojFalso(), marca: T0 - HORA });
    const sinNada = await todo.pasos.alAbrirLaApp({ motor: motorDe(), tramo: TRAMO, salidas: [{ desde: T0 - 2 * HORA, hasta: T0 }] });
    assert.equal(sinNada.leyo, true);
    assert.equal(sinNada.motivo, MOTIVOS_DE_LECTURA.SIN_VENTANA);
    assert.equal(JSON.parse(todo.almacen.datos.get(CLAVE_DE_LA_MARCA)).leidoHasta, T0);
  });

  test('La marca de la última lectura vive fuera del estado de la partida', async () => {
    // SPEC-016 afirma que ni el estado ni el registro llevan ninguna marca del reloj real,
    // y ese criterio es lo que hace la partida comparable byte a byte. Así que lo que cruza
    // la frontera hacia el núcleo son **metros ya acotados**, un número.
    assert.ok(CLAVE_DE_LA_MARCA.startsWith('cache/'), 'la marca de agua no cuelga de un prefijo excluido de la copia');

    const reloj = relojFalso();
    const { pasos, almacen } = cableado({ salud: saludQueDaMetros(2 * TRAMO), pedido: true, reloj });
    const estado = estadoDePasos();
    const motor = motorDe({ estado });
    const registro = registroInicial();
    await pasos.alAbrirLaApp({ motor, tramo: TRAMO });

    assert.equal(JSON.parse(almacen.datos.get(CLAVE_DE_LA_MARCA)).leidoHasta, T0);
    const serializado = JSON.stringify({ pasos: congelaPasos(estado), registro: congelaRegistro(registro), ajustes: congelaAjustes(estadoDeAjustes()) });
    assert.equal(serializado.includes(String(T0)), false, 'el instante de la lectura entró en la partida');
    // Y ningún número del estado tiene pinta de milisegundos del reloj real.
    for (const n of serializado.match(/\d{10,}/g) ?? []) {
      assert.fail(`la partida guarda un número con pinta de marca del reloj real: ${n}`);
    }
  });

  test('Una marca ilegible se trata como no haberla, y no como contar desde el principio', async () => {
    const almacen = almacenEnMemoria();
    almacen.datos.set(CLAVE_DE_LA_MARCA, 'esto no es json');
    const marca = creaMarcaDeAgua(almacen);
    assert.equal(await marca.lee(), null);
    assert.throws(() => creaMarcaDeAgua({}), /lee\(clave\) y escribe\(clave, texto\)/);
    assert.throws(() => creaLectorDeSalud({ fuente: saludQueDaMetros(), marca: null }), /necesita su marca de agua/);
    await assert.rejects(() => marca.escribe(-1), /instante en milisegundos/);
  });

  test('Estar un mes sin salir no acumula mundo pendiente', () => {
    // El escenario literal: cero kilómetros en treinta días no mueven el mundo. Lo que
    // esta fila entrega es la mitad que faltaba —la fuente real de los kilómetros—, así
    // que se afirma sobre ella: abrir la app tras un mes sin andar no ejecuta ningún paso.
    const motor = motorDe();
    const resultado = kilometrosDeFondo({ motor, metros: 0, activos: true, tramo: TRAMO });
    assert.deepEqual([...resultado.pasos], []);
    assert.equal(motor.contador(), 0);
    assert.equal(tamanoDeLaReserva(motor), 0);
  });

  test('Volver tras tres meses enseña lo mismo que volver tras tres días', async () => {
    // La promesa entera: la reserva contiene cinco pasos como mucho y el contador ha
    // avanzado cinco, no noventa. Lo que se compara no es el número: es lo que se ve.
    const deTresMeses = cableado({
      salud: fuenteDeSalud({ metros: (v) => (v.hasta - v.desde) / DIA * 5 * TRAMO }),
      pedido: true, marca: T0 - 90 * DIA,
    });
    const deTresDias = cableado({
      salud: fuenteDeSalud({ metros: (v) => (v.hasta - v.desde) / DIA * 5 * TRAMO }),
      pedido: true, marca: T0 - 3 * DIA,
    });

    const motorLargo = motorDe();
    const motorCorto = motorDe();
    const largo = await deTresMeses.pasos.alAbrirLaApp({ motor: motorLargo, tramo: TRAMO });
    const corto = await deTresDias.pasos.alAbrirLaApp({ motor: motorCorto, tramo: TRAMO });

    assert.equal(largo.enLaReserva, TOPE_DE_RESERVA);
    assert.equal(corto.enLaReserva, TOPE_DE_RESERVA);
    assert.equal(motorLargo.contador(), 5, 'el contador ha avanzado más de cinco tras tres meses');
    assert.equal(motorCorto.contador(), 5);
    assert.deepEqual(
      largo.pasos.map((p) => p.n),
      corto.pasos.map((p) => p.n),
      'volver tras tres meses no enseña lo mismo que volver tras tres días',
    );
    // Y lo que no cupo no deja deuda apuntada en ninguno de los dos.
    assert.ok(largo.descartadosM > 0);
    assert.equal(deTresMeses.almacen.datos.has(CLAVE_DE_LA_MARCA), true);
  });

  test('La reserva de pasos de fondo tiene tope de cinco', async () => {
    const { pasos } = cableado({ salud: saludQueDaMetros(12 * TRAMO), pedido: true });
    const motor = motorDe();
    const lectura = await pasos.alAbrirLaApp({ motor, tramo: TRAMO });

    assert.equal(lectura.enLaReserva, 5, 'la reserva tiene que contener cinco pasos');
    assert.equal(motor.contador(), 5, 'el contador del mundo ha avanzado cinco, no doce');
    assert.equal(lectura.descartadosM, 14000);
  });

  test('El contenido de un paso lo decide su número', async () => {
    // Los mismos metros leídos se convierten en los mismos pasos, con los mismos números
    // y el mismo contenido: la lectura no mete azar ni reloj por el camino.
    const uno = await cableado({ salud: saludQueDaMetros(3 * TRAMO), pedido: true }).pasos.alAbrirLaApp({ motor: motorDe(), tramo: TRAMO });
    const dos = await cableado({ salud: saludQueDaMetros(3 * TRAMO), pedido: true }).pasos.alAbrirLaApp({ motor: motorDe(), tramo: TRAMO });
    assert.equal(JSON.stringify(uno.pasos), JSON.stringify(dos.pasos));
  });

  test('Los kilómetros de fondo van al mapa activo al abrir la app', async () => {
    // Frontera de SPEC-041, que aquí se consume y no se redecide: repartirlos por dónde se
    // anduvieron exigiría un histórico de posiciones, que RF-PRIV-002 prohíbe.
    const estado = estadoDePasos();
    const activo = motorDe({ estado, mapaId: MAPA });
    const otro = motorDe({ estado, mapaId: OTRO_MAPA });
    const { pasos } = cableado({ salud: saludQueDaMetros(2 * TRAMO), pedido: true });

    await pasos.alAbrirLaApp({ motor: activo, tramo: TRAMO });
    assert.equal(tamanoDeLaReserva(activo), 2);
    assert.equal(tamanoDeLaReserva(otro), 0, 'los kilómetros de fondo se acreditaron a un mapa que no era el activo');
    assert.equal(otro.contador(), 0);
  });
});

// ── Lo que la lectura hace cuando algo va mal ───────────────────────────────────

describe('Cuando la lectura de salud va mal', () => {
  test('Una lectura con metros negativos o no numéricos falla nombrando el valor', async () => {
    for (const mal of [-1, NaN, Infinity, 'muchos', null]) {
      assert.throws(() => metrosDeLaLectura(mal), (e) => {
        assert.match(e.message, /metros finitos y no negativos/);
        return true;
      });
      const { pasos } = cableado({ salud: saludQueDevuelveInvalido(mal), pedido: true });
      const motor = motorDe();
      await assert.rejects(() => pasos.alAbrirLaApp({ motor, tramo: TRAMO }), /devolvió/);
      assert.equal(motor.contador(), 0, `con ${JSON.stringify(mal)} metros se ejecutó algún paso`);
    }
  });

  test('La app de salud que no responde no es un fallo y el juego sigue igual', async () => {
    const { pasos, almacen } = cableado({ salud: saludQueNoResponde(), pedido: true });
    const motor = motorDe();
    const lectura = await pasos.alAbrirLaApp({ motor, tramo: TRAMO });

    assert.equal(lectura.leyo, false);
    assert.equal(lectura.motivo, MOTIVOS_DE_LECTURA.NO_RESPONDE);
    assert.deepEqual([...lectura.pasos], []);
    assert.equal(motor.contador(), 0);
    // La marca **no se mueve**, para que lo de esta ventana se cuente la próxima vez.
    assert.equal(almacen.datos.has(CLAVE_DE_LA_MARCA), false, 'la marca avanzó sin haber leído nada');
    // Y el motivo es una clave, nunca una frase que una pantalla pueda enseñar como error.
    assert.equal(/[A-Z]/.test(lectura.motivo), false);
  });

  test('Una ventana mal formada se dice en lugar de leerse', () => {
    assert.throws(() => exigeVentana(null), /se espera \{ desde, hasta \}/);
    assert.throws(() => exigeVentana({ desde: T0, hasta: T0 - HORA }), /termina antes de empezar/);
    assert.throws(() => exigeVentana({ desde: 'ayer', hasta: T0 }), /instante en milisegundos/);
    assert.equal(solapeDeVentanas({ desde: 0, hasta: 10 }, { desde: 20, hasta: 30 }), 0);
    assert.equal(solapeDeVentanas({ desde: 0, hasta: 10 }, { desde: 5, hasta: 30 }), 5);

    // Y restar salidas de una ventana deja los trozos en orden, sin solapes ni vacíos.
    const trozos = ventanaSinSalidas({ desde: 0, hasta: 100 }, [{ desde: 20, hasta: 40 }, { desde: 60, hasta: 80 }]);
    assert.deepEqual(trozos.map((t) => [t.desde, t.hasta]), [[0, 20], [40, 60], [80, 100]]);
    assert.deepEqual([...ventanaSinSalidas({ desde: 0, hasta: 100 }, [{ desde: 0, hasta: 100 }])], []);
  });

  test('Sin fuente de salud no se degrada en silencio', async () => {
    const almacen = almacenEnMemoria();
    const lector = creaLectorDeSalud({ fuente: null, marca: creaMarcaDeAgua(almacen), ahora: () => T0 });
    assert.equal(await lector.permiso(), 'no-disponible');
    assert.equal(await lector.pideElPermiso(), 'no-disponible');
    const lectura = await lector.lee({ activo: true });
    assert.equal(lectura.leyo, false);
    assert.equal(lectura.motivo, MOTIVOS_DE_LECTURA.SIN_FUENTE, 'no tener de dónde leer se confunde con no tener permiso');
  });

  test('Una fuente que solo da pasos se convierte con la zancada constante', async () => {
    const { pasos } = cableado({ salud: saludQueDaPasos(5000), pedido: true });
    const motor = motorDe();
    const lectura = await pasos.alAbrirLaApp({ motor, tramo: TRAMO });
    assert.equal(lectura.metros, 5000 * ZANCADA_M);
    assert.equal(lectura.pasos.length, 1);
  });

  test('La primera lectura sin marca mira un día atrás y no un trimestre', async () => {
    // Sin marca no se sabe qué se contó ya, y mirar atrás sin límite regalaría de golpe el
    // mundo de un trimestre; acotarlo aquí es lo que hace que estrenar móvil y volver tras
    // tres meses enseñen lo mismo.
    assert.equal(VENTANA_INICIAL_MS, DIA);
    const salud = fuenteDeSalud({ metros: () => METROS_POR_VENTANA });
    const { pasos } = cableado({ salud, pedido: true });
    await pasos.alAbrirLaApp({ motor: motorDe(), tramo: TRAMO });
    const [ventana] = salud.ventanas();
    assert.equal(ventana.hasta - ventana.desde, VENTANA_INICIAL_MS);
  });
});
