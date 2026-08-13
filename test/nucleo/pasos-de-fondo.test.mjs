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
  PERMISOS_QUE_UNA_LIBRERIA_EXIGE,
  TAREAS_PERIODICAS,
  TAREAS_QUE_LA_APP_DEFINE,
  exigeTareaDeclarada,
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
import { leeMetrosDeFondo } from '../../app/plataforma/gancho.js';
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

  test('Encender los pasos del día a día sin fuente es imposible', async () => {
    // SPEC-046. **Imposible por construcción y no un interruptor que miente**: sin fuente de
    // salud —iOS, el gancho de capacidad ausente, o una compilación sin la dependencia
    // resuelta— el lector devuelve `sin-fuente`, la orquestación lo traduce a su motivo y la
    // fila se queda en «no» con la línea que dice que no se puede.
    //
    // Se dobla con `fuente: null`, que es exactamente lo que devuelve `creaFuenteDeSalud` en
    // iOS y lo que la raíz pasa cuando el gancho pide «salud» ausente: los dos caminos entran
    // por aquí y por eso dan lo mismo.
    const almacen = almacenEnMemoria();
    const ajustes = estadoDeAjustes();
    const lector = creaLectorDeSalud({ fuente: null, marca: creaMarcaDeAgua(almacen), ahora: relojFalso().ahora });
    const pasos = creaPasosDeFondo({ nucleo: nucleoDeLosPasos, lector, ajustes });

    const tocado = await pasos.pide(FILA_DE_AJUSTES, true);
    assert.equal(tocado.atendida, true);
    assert.equal(tocado.encendido, false, 'el interruptor se ha encendido sin fuente de la que leer');
    assert.equal(tocado.motivo, MOTIVOS_DE_APAGADO.SIN_FUENTE, 'sin fuente se dice «denegado», que es otra cosa y se arregla en otro sitio');
    assert.equal(tocado.aviso, AVISO_SIN_PERMISO, 'la fila que no se puede encender no dice por qué');
    assert.equal(ajustes[AJUSTE], false, 'el ajuste de la partida quedó encendido con un modo que no puede leer nada');

    // Y no se ha pedido ningún permiso: sin fuente no hay a quién pedírselo, y un diálogo del
    // sistema aquí sería pedir algo que no serviría de nada.
    assert.equal((await pasos.efectivo()).encendido, false);
    // Ni siquiera con el ajuste puesto a mano: el valor que se lee es el **efectivo**.
    cambiaAjuste(ajustes, AJUSTE, true);
    const conElAjustePuesto = await pasos.efectivo();
    assert.equal(conElAjustePuesto.encendido, false, 'con el ajuste puesto a mano y sin fuente la fila dice que sí');
    assert.equal(conElAjustePuesto.motivo, MOTIVOS_DE_APAGADO.SIN_FUENTE);
  });

  test('El interruptor cambia de valor sin salir y volver a entrar', async () => {
    // SPEC-046. El valor que se pinta sale de `efectivo()`, que **se vuelve a leer** sin
    // reabrir nada: eso es lo que la pantalla necesita para repintar lo que acabas de tocar.
    // Lo que aquí se afirma es que la orquestación lo permite; que la pantalla lo haga es la
    // otra mitad y vive en `consulta-montado.jsx`, comprobada abajo.
    const salud = fuenteDeSalud({ permiso: 'sin-preguntar', alPedir: 'concedido' });
    const { pasos } = cableado({ salud });
    assert.equal((await pasos.efectivo()).encendido, false);

    const tocado = await pasos.pide(FILA_DE_AJUSTES, true);
    assert.equal(tocado.encendido, true);
    assert.equal(tocado.aviso, null, 'la fila encendida trae línea de aviso, y no hay nada que avisar');

    // Sin salir y volver a entrar: la misma orquestación, releída, ya dice «sí».
    const releida = await pasos.efectivo();
    assert.equal(releida.encendido, true, 'la fila no cambia de valor hasta salir y volver a entrar');
    assert.equal(releida.aviso, null);
    assert.equal(salud.peticiones(), 1, 'releer la fila ha vuelto a pedir el permiso: consultar no es preguntar');

    // Y la pantalla que la pinta fuerza el repintado, que es la mitad que no vive aquí: el
    // núcleo muta el área de ajustes en sitio y React no se entera solo.
    const montado = fuente('app/pantallas/consulta-montado.jsx');
    assert.match(montado, /repinta\(\(n\) => n \+ 1\)/, 'la pantalla de ajustes no fuerza el repintado tras tocar el interruptor');
    assert.match(montado, /pasosDeFondo\.efectivo\(\)/, 'la pantalla de ajustes no lee el valor efectivo al abrirse: un permiso revocado desde fuera seguiría pintándose como «sí»');
  });

  test('El interruptor atiende su fila y no la de al lado', async () => {
    // SPEC-046, §6h. «Solo de día» es de otra fila del checklist: hacer que su toque entrara
    // por aquí cambiaría un ajuste ajeno sin que nadie lo hubiera decidido. Lo que no se
    // atiende **se declara y se devuelve sin tocar nada**, que es lo que distingue no
    // atenderlo de atenderlo mal.
    const { pasos, ajustes, salud } = cableado({ salud: fuenteDeSalud({ permiso: 'sin-preguntar', alPedir: 'concedido' }) });
    const antes = JSON.stringify(congelaAjustes(ajustes));

    const ajena = FILAS_DE_AJUSTES.find((f) => f.id !== FILA_DE_AJUSTES && f.tipo === 'interruptor');
    assert.ok(ajena, 'no hay ninguna otra fila de interruptor en el catálogo, y este caso dejaría de medir nada');

    const respuesta = await pasos.pide(ajena.id, true);
    assert.equal(respuesta.atendida, false, `la orquestación de los pasos de fondo ha atendido la fila "${ajena.id}", que es de otra fila del checklist`);
    assert.equal(respuesta.fila, ajena.id, 'no dice qué fila no atendió, y sin nombrarla quien llama no sabe qué hacer con la respuesta');
    assert.equal(respuesta.encendido, null);
    assert.equal(JSON.stringify(congelaAjustes(ajustes)), antes, 'atender una fila ajena cambió algún ajuste por el camino');
    assert.equal(salud.peticiones(), 0, 'tocar una fila ajena pidió el permiso de salud');
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

    // REEXPRESADO en SPEC-048 por partida doble, y las dos mitades hay que contarlas
    // enteras porque las dos contradicen lo que este caso daba por hecho.
    //
    // **Uno: el sustituto se cambia por la propiedad.** Hasta esta fila la guarda decía
    // «ninguna dependencia de la app está en `MODULOS_DE_FONDO_QUE_NO_SE_MONTAN`», y esa
    // lista contenía `expo-task-manager`. La fila 48 lo mete —es con lo que se define la
    // tarea del servicio en primer plano que sostiene «mientras se usa» con la pantalla
    // apagada, que es exactamente lo que `seguridad-privacidad.md` §2 nombra como la razón
    // de **no** pedir el permiso permanente—, así que el caso se ponía rojo por
    // aritmética. Igual que el caso del modo de fondo dos más abajo, lo que estaba mal era
    // el instrumento: la lista de módulos era un **sustituto** de la propiedad que importa
    // —«no hay trabajo periódico que lea con la app cerrada»— y valía mientras nada
    // legítimo necesitara el módulo. Se cambia por la propiedad, y queda más fuerte: las
    // tareas se enumeran **una a una** con su motivo y su dueña, y registrar una sin
    // declararla es error de construcción y no un descuido silencioso.
    //
    // **Dos: `RECEIVE_BOOT_COMPLETED` está en el manifiesto y no lo trajo esta fila.**
    // Este caso lo buscaba en `app.json` y no lo encontraba nunca, y mientras tanto el
    // permiso llevaba **desde SPEC-023** dentro del APK: lo inyecta el
    // `AndroidManifest.xml` de `expo-notifications` al fusionarse. O sea que la guarda
    // pasaba en verde sobre una promesa rota, porque miraba el fichero de entrada en lugar
    // de lo que va al binario. Lo que la fila 48 hace es **sacarlo a la luz declarándolo**
    // con su motivo en `PERMISOS_QUE_UNA_LIBRERIA_EXIGE`, y quien mira donde hay que mirar
    // es la guarda nueva, `test/nucleo/manifiesto-generado.test.mjs`. Aquí el patrón sale
    // —seguir buscándolo en `app.json` sería exigir que el permiso siga escondido— y a
    // cambio se exige que **esté declarado con lo que se hace a cambio**: un permiso que
    // una librería impone y que nadie justifica vuelve a ser un permiso colado.
    const texto = fuente('app/app.json');
    for (const patron of [/BGTaskScheduler/, /background-fetch/, /backgroundFetch/, /SCHEDULE_EXACT_ALARM/]) {
      assert.equal(patron.test(texto), false, `app.json declara trabajo periódico (${patron})`);
    }
    // Y los módulos que lo traerían no están montados: la dependencia también es una
    // declaración, y esta es la que no se ve en el manifiesto.
    const dependencias = Object.keys(JSON.parse(fuente('app/package.json')).dependencies ?? {});
    for (const modulo of MODULOS_DE_FONDO_QUE_NO_SE_MONTAN) {
      assert.equal(dependencias.includes(modulo), false, `la app monta "${modulo}", que es fondo con otro nombre`);
    }
    // Los dos que quedan prohibidos son los dos que son fondo de verdad. Que la lista no
    // se pueda vaciar es parte de la guarda: con cero entradas el bucle de arriba pasa
    // trivialmente, que es la forma barata de callar esto.
    assert.deepEqual([...MODULOS_DE_FONDO_QUE_NO_SE_MONTAN], ['expo-background-fetch', 'expo-background-task']);

    // Las tareas que la app define, una a una. Exactamente una, y muere con la salida.
    assert.deepEqual(TAREAS_QUE_LA_APP_DEFINE.map((t) => t.id), ['salida-abierta']);
    for (const tarea of TAREAS_QUE_LA_APP_DEFINE) {
      assert.ok(tarea.porque && tarea.porque.length > 20, `la tarea "${tarea.id}" no dice para qué está`);
      assert.ok(tarea.dueña, `la tarea "${tarea.id}" no dice de quién es`);
    }
    // Y registrar una sin declararla es error de construcción, no un descuido: es la
    // puerta que la lista de módulos cerraba de refilón y esta cierra de frente.
    assert.throws(
      () => exigeTareaDeclarada('lo-que-sea'),
      /no está declarada en TAREAS_QUE_LA_APP_DEFINE/,
      'una tarea sin declarar se puede registrar: la guarda no está cerrando nada',
    );
    assert.equal(exigeTareaDeclarada('salida-abierta').id, 'salida-abierta');
    // El registro pasa de verdad por ahí, y no es un adorno que nadie llame: la
    // suscripción exige la guarda y se niega a montarse sin ella.
    const posiciones = fuente('app/plataforma/posiciones.js');
    assert.match(posiciones, /declaraTarea\(tarea, /, 'la suscripción registra la tarea sin pasar por la guarda');
    assert.match(fuente('app/marcha/salida-montada.js'), /declaraTarea: exigeTareaDeclarada/);

    // El permiso que la librería impone: declarado, con quién lo exige, por qué no se
    // quita y qué se hace a cambio. Sin las cuatro cosas es un permiso colado con nota.
    for (const permiso of PERMISOS_QUE_UNA_LIBRERIA_EXIGE) {
      for (const campo of ['quienLoExige', 'porQueNoSeQuita', 'aCambio', 'dueña']) {
        assert.ok(permiso[campo] && String(permiso[campo]).length > 10, `el permiso impuesto "${permiso.id}" no dice "${campo}"`);
      }
    }
    // Y la lista de lo que nunca se declara **no se puede vaciar ni adelgazar en
    // silencio**: lo que salga de ella tiene que aparecer en la de permisos impuestos,
    // con su motivo. Es la misma regla que la de módulos, un nivel más arriba.
    assert.ok(LO_QUE_NUNCA_SE_DECLARA.length > 0, 'la lista de lo que nunca se declara está vacía: así no puede ponerse roja nunca');
    const nombrados = new Set([...LO_QUE_NUNCA_SE_DECLARA, ...PERMISOS_QUE_UNA_LIBRERIA_EXIGE.map((p) => p.id)]);
    for (const peligroso of ['ACCESS_BACKGROUND_LOCATION', 'RECEIVE_BOOT_COMPLETED']) {
      assert.equal(nombrados.has(peligroso), true, `"${peligroso}" ha desaparecido de las dos listas: es de los dos que esta fila hace peligrosos y no puede dejar de estar nombrado`);
    }
    // El permanente sigue en la lista dura y **no** puede mudarse a la de impuestos: ese
    // es el único que no tiene ninguna librería que lo justifique.
    assert.equal(LO_QUE_NUNCA_SE_DECLARA.includes('ACCESS_BACKGROUND_LOCATION'), true);
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

// ── Lo que cruza al núcleo, y el gancho que lo alimenta (SPEC-046) ──────────────

describe('Del lector de salud al núcleo solo cruzan metros', () => {
  /**
   * La orquestación con un núcleo **espía**: registra con qué se llama a `kilometrosDeFondo`
   * y devuelve lo que devolvería el de verdad.
   *
   * Es la única manera de afirmar una negativa —«nada más cruza»— sin suponerla: mirar el
   * estado de después no distingue lo que se pasó de lo que se usó.
   */
  function conNucleoEspia(opciones = {}) {
    const llamadas = [];
    const espia = {
      ...nucleoDeLosPasos,
      kilometrosDeFondo(argumentos) {
        llamadas.push(argumentos);
        return kilometrosDeFondo(argumentos);
      },
    };
    const base = cableado(opciones);
    return { ...base, llamadas, pasos: creaPasosDeFondo({ nucleo: espia, lector: base.lector, ajustes: base.ajustes }) };
  }

  test('Del lector de salud al núcleo solo cruzan metros', () => {
    // Bloqueante (`@privacidad`, RF-PRIV-003). La comprobación se hace en dos sitios porque
    // la promesa tiene dos mitades: lo que la lectura **entrega** y lo que el núcleo
    // **recibe**. Esta es la segunda; la primera es el caso de abajo.
    const espiado = conNucleoEspia({ salud: saludQueDaMetros(3 * TRAMO), pedido: true });
    return espiado.pasos.alAbrirLaApp({ motor: motorDe(), tramo: TRAMO }).then(() => {
      assert.equal(espiado.llamadas.length, 1, 'la lectura al abrir no ha llamado al núcleo una sola vez');
      const [argumentos] = espiado.llamadas;
      assert.deepEqual(
        Object.keys(argumentos).sort(),
        ['activos', 'metros', 'motor', 'tramo'],
        `al núcleo le cruzan campos que no son metros: ${Object.keys(argumentos).join(', ')}`,
      );
      assert.equal(typeof argumentos.metros, 'number', 'los metros no cruzan como número');
      assert.equal(argumentos.metros, 3 * TRAMO);
      // `activos` es un booleano de la partida y no un permiso: el núcleo no sabe qué es un
      // permiso de salud y no consulta ninguna capa de la plataforma.
      assert.equal(argumentos.activos, true);
      // Y ni una ventana, ni un instante, ni ninguna marca del reloj real.
      const texto = JSON.stringify({ metros: argumentos.metros, activos: argumentos.activos, tramo: argumentos.tramo });
      for (const prohibido of ['desde', 'hasta', 'ventana', 'leidoHasta', 'instante']) {
        assert.equal(texto.includes(prohibido), false, `"${prohibido}" cruza del lector al núcleo`);
      }
    });
  });

  test('Lo que la lectura entrega es un número de metros y su motivo', async () => {
    // La primera mitad: la propia lectura. Hueco de batería —el escenario habla de lo que
    // llega al núcleo—, y va aquí porque sin ella la promesa se cumpliría por casualidad,
    // porque a la orquestación se le olvidó pasar algo.
    const { lector } = cableado({ salud: saludQueDaMetros(2 * TRAMO), pedido: true });
    const lectura = await lector.lee({ activo: true });
    assert.equal(typeof lectura.metros, 'number');
    // La ventana viaja de vuelta al lector, que es de la app; lo que no puede es seguir
    // camino. Que la lectura la traiga es lo que permite afirmar arriba que no cruza.
    assert.ok(lectura.ventana, 'la lectura no dice qué ventana miró, y sin eso no se puede afirmar que no cruza');
  });
});

describe('El gancho de metros de fondo es una fuente de metros, no un atajo', () => {
  test('El gancho acredita por el mismo camino que una lectura real', async () => {
    const { pasos } = cableado({ salud: saludQueDaMetros(0), pedido: true });
    const motor = motorDe();
    const leido = leeMetrosDeFondo('walkingadventure://andamiaje?metrosDeFondo=6000', true);
    assert.deepEqual(leido, { metros: 6000, motivo: null });

    const lectura = await pasos.alAbrirLaApp({ motor, tramo: TRAMO, metrosDeMas: leido.metros });
    assert.equal(lectura.metros, 6000, 'los metros del gancho no entran por el mismo camino que los de una lectura real');
    assert.equal(tamanoDeLaReserva(motor), 3, 'seis mil metros con tramo de dos mil no han dejado tres pasos en la reserva');
  });

  test('El gancho respeta el interruptor y no lo salta', async () => {
    // Es lo que impide que una prueba verifique un camino que el juego no tiene: con el modo
    // apagado o sin fuente, el valor efectivo es «no» y no se acredita ni un metro.
    const apagado = cableado({ salud: saludQueDaMetros(0), pedido: false });
    const motorApagado = motorDe();
    const sinModo = await apagado.pasos.alAbrirLaApp({ motor: motorApagado, tramo: TRAMO, metrosDeMas: 6000 });
    assert.equal(sinModo.pasos.length, 0, 'el gancho ha acreditado metros con el modo apagado');
    assert.equal(tamanoDeLaReserva(motorApagado), 0);

    const almacen = almacenEnMemoria();
    const ajustes = estadoDeAjustes();
    cambiaAjuste(ajustes, AJUSTE, true);
    const sinFuente = creaPasosDeFondo({
      nucleo: nucleoDeLosPasos,
      lector: creaLectorDeSalud({ fuente: null, marca: creaMarcaDeAgua(almacen), ahora: () => T0 }),
      ajustes,
    });
    const motorSinFuente = motorDe();
    await sinFuente.alAbrirLaApp({ motor: motorSinFuente, tramo: TRAMO, metrosDeMas: 6000 });
    assert.equal(tamanoDeLaReserva(motorSinFuente), 0, 'el gancho ha acreditado metros sin fuente de salud');
  });

  test('Un valor que no es un número finito y no negativo no acredita nada y se declara', async () => {
    for (const crudo of ['', 'muchos', '-1', 'NaN', 'Infinity']) {
      const leido = leeMetrosDeFondo(`walkingadventure://andamiaje?metrosDeFondo=${encodeURIComponent(crudo)}`, true);
      assert.equal(leido.metros, null, `"${crudo}" se ha leído como metros`);
      assert.match(leido.motivo, /finitos y no negativos/, `"${crudo}" no se declara: acreditar cero como si se hubiera leído es lo que esto evita`);
    }
    // Y el enlace sin el parámetro no es un error: no traía ninguno y no hay nada que decir.
    assert.deepEqual(leeMetrosDeFondo('walkingadventure://andamiaje', true), { metros: null, motivo: null });

    // Un valor inválido que llegue igual hasta la orquestación falla nombrándolo, con la
    // misma validación que la de una lectura real: dos validaciones darían dos mensajes
    // distintos para el mismo defecto según por dónde entrara.
    const { pasos } = cableado({ salud: saludQueDaMetros(0), pedido: true });
    await assert.rejects(() => pasos.alAbrirLaApp({ motor: motorDe(), tramo: TRAMO, metrosDeMas: -5 }), /gancho de metros de fondo/);
  });

  test('En producción el gancho de metros es inerte', () => {
    // La regla de `gancho.js` que esta fila **no** relaja: un gancho que llega a producción
    // es una puerta trasera que cambia el comportamiento de la app.
    assert.deepEqual(leeMetrosDeFondo('walkingadventure://andamiaje?metrosDeFondo=6000', false), { metros: null, motivo: null });
    assert.deepEqual(leeMetrosDeFondo('walkingadventure://andamiaje?metrosDeFondo=nada', false), { metros: null, motivo: null });
  });
});
