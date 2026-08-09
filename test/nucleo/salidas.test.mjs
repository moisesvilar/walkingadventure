// SPEC-030 · El rótulo del sistema y la vida de una salida: sus cuatro situaciones,
// el telón que echa volver, el telón que espera a que lo lean y la salida que sigue
// viva cuando su rótulo ya no está.
//
// **Todo lo que esta fila entrega se puede poner rojo en Node, y no por casualidad.**
// La spec parte el riesgo 4 del PRD en dos: el contrato común —las situaciones, los
// literales, el plazo, los motivos de retirada, que estado y presencia real coincidan—
// y el ciclo de vida de cada sistema, que solo se ve en un dispositivo. Este fichero es
// el primero entero; del segundo solo se afirma lo que está escrito en la configuración
// de las dos plataformas, que es lo que sí se lee sin simulador.
//
// Tres decisiones de este fichero que no son de estilo:
//
// - **No hay reloj y no hay espera.** El plazo son noventa minutos de tiempo del
//   sensor, y el tiempo del sensor es la marca que trae cada posición: afirmarlo cuesta
//   dos números, no noventa minutos. Ninguna prueba de aquí llama a `Date.now()`, y hay
//   un caso que comprueba que el módulo tampoco.
// - **Las ausencias se afirman contra una enumeración.** «El rótulo no lleva cifras» a
//   ojo es un criterio que se cumple siempre; contra la lista de palabras de esfuerzo y
//   contra un cribado de dígitos, no. Igual con «el regreso no mira la clasificación»:
//   se lee lo que el módulo importa, porque una firma sin clasificación no impide
//   colarla por dentro.
// - **Los dobles del rótulo son cuatro y no uno con banderas.** Los cuatro casos que la
//   spec separa —funciona, no montado, montado y no disponible, se retira solo— tienen
//   consecuencias distintas, y el que más importa es el último: es el único que
//   reproduce la Actividad en Vivo que caduca sin avisar a nadie.
//
// Escenarios de `docs/testing.md` reutilizados con su nombre literal: «Volver a casa
// cierra la salida», «El telón espera a que lo leas», «Se puede cerrar la salida desde
// el rótulo del sistema», «El rótulo se retira pero la salida no se cierra» (de «El
// telón se echa solo al cerrarse la salida»), «Volver a casa en autobús echa el telón
// igual», «La salida sigue viva con el móvil bloqueado» y «La tarjeta de a medias solo
// existe con la salida abierta». Los demás casos van marcados como hueco de la batería
// en `test/spec-test-map.json`, y la spec ya los nombra uno a uno.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  ESTADOS_DEL_ROTULO,
  ESTADOS_DE_SALIDA,
  IDS_DE_MOTIVO_DE_CIERRE,
  IDS_DE_MOTIVO_DE_RETIRADA,
  MOTIVOS_DE_CIERRE,
  MOTIVOS_DE_RETIRADA,
  QUE_OFRECE,
  SITUACIONES,
  SITUACIONES_ABIERTAS,
  SIN_SALIDA,
  abreSalida,
  cambiaElDestino,
  cierraLaSalida,
  congelaSalidas,
  dejarloAqui,
  disponibilidadDelRotulo,
  estadoDeSalidas,
  estadoDelRotulo,
  exigeFuenteDePosiciones,
  exigePosicion,
  exigeRotulo,
  haySalidaEnCurso,
  hayTelonPendiente,
  levantaSalidas,
  marcaElTelonComoLeido,
  queOfreceAlAbrirLaApp,
  recibePosicion,
  reconciliaConElRotulo,
  retiraElRotulo,
  retomaLaSalida,
  salidaEnCurso,
  situacionDeSalida,
  telonPendiente,
  terminaDesdeElRotulo,
  terminaLaAventura,
} from '../../packages/nucleo/partida/salidas.js';
import {
  LO_QUE_EL_REGRESO_NO_MIRA,
  PERMANENCIA_MS,
  PERMANENCIA_S,
  RADIO_DE_REGRESO_M,
  TRAMOS_DE_ALEJAMIENTO,
  avanzaElRegreso,
  distanciaDeAlejamientoM,
  estadoDeRegreso,
  metrosEntre,
} from '../../packages/nucleo/partida/regreso.js';
import {
  ACCION_DEL_ROTULO,
  ACCIONES_QUE_EL_ROTULO_NO_TIENE,
  LO_QUE_EL_ROTULO_NO_LLEVA,
  PALABRAS_DE_ESFUERZO,
  PLAZO_DE_RETIRADA_MS,
  TOPES_DE_PLATAFORMA_MS,
  TOPE_MAS_CORTO_MS,
  componeRotulo,
  plazoAgotado,
  reiniciaElPlazo,
  revisaElPlazo,
  revisaLineaDelRotulo,
} from '../../packages/nucleo/partida/rotulo.js';
import { SUELO_TRAMO_M } from '../../packages/nucleo/partida/tramo.js';
import { CLASIFICACIONES } from '../../packages/nucleo/partida/ritmo.js';
import { POSICIONES_DECLARADAS, escribe, sinRastroDeUbicacion } from '../../packages/nucleo/partida/formato.js';
import { AREAS_CON_ESTADO, AREAS_QUE_NO_REPRODUCEN, IDS_DE_AREA, areaDe } from '../../packages/nucleo/partida/estado.js';
import { creaMotorDePasos } from '../../packages/nucleo/partida/pasos.js';
import { exigeNombres } from '../../packages/nucleo/names/index.js';
import { makeRng } from '../../packages/nucleo/core/rng.js';
import {
  fuenteDePosiciones,
  fuenteSinCablear,
  rotuloNoDisponible,
  rotuloQueFunciona,
  rotuloQueSeRetiraSolo,
  rotuloSinMontar,
} from '../dobles/rotulo-del-sistema.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import { SEMILLA_A } from './celda-de-prueba.mjs';

// ── El decorado: un punto de partida, un tramo y unas cuantas marcas ────────────
//
// El punto está en Galicia a propósito: es lo que hace que el caso del rótulo en
// gallego use el mismo mundo que los demás y no uno inventado para él.

const PARTIDA = { lat: 42.88, lon: -8.545 };
const TRAMO_M = 2000;
const MINUTO = 60 * 1000;
const T0 = 1_000_000;

/** Un punto a `norteM` metros al norte del de partida. Grados, no magia. */
function alNorte(metros) {
  return { lat: PARTIDA.lat + metros / 111320, lon: PARTIDA.lon };
}

/** Una posición para la transición, con su marca del sensor y su clasificación. */
function posicion(metros, minutos, clasificacion = null) {
  return { ...alNorte(metros), tMs: T0 + minutos * MINUTO, clasificacion, precisionM: 8 };
}

/**
 * Abre una salida sobre un estado nuevo y devuelve todo lo que hace falta para
 * seguir tirando de ella. Sin `destino` la salida es de «salir a andar sin más».
 */
function abierta({ destino = 'Monfrida', mundo = 'O Val de Arriba', aventura = 'aventura-1', rotulo = rotuloQueFunciona() } = {}) {
  const estado = estadoDeSalidas();
  const fuentePos = fuenteDePosiciones();
  const abre = abreSalida(estado, {
    salida: 'salida-1',
    mapa: 'mapa-1',
    partida: PARTIDA,
    tMs: T0,
    aventura,
    destino,
    mundo,
    rotulo,
    fuente: fuentePos,
  });
  assert.equal(abre.abierta, true, 'el decorado no ha conseguido abrir la salida');
  return { estado, rotulo, fuente: fuentePos, abre };
}

/** Pasa la salida por una secuencia de posiciones y devuelve el último resultado. */
function recorre(estado, rotulo, pasos) {
  let ultimo = null;
  for (const p of pasos) ultimo = recibePosicion(estado, { posicion: p, tramo: TRAMO_M, rotulo });
  return ultimo;
}

/** El código de un módulo del paquete, sin comentarios: lo que de verdad se ejecuta. */
function codigoSinComentarios(ruta) {
  return fuente(ruta).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ── La vida de una salida ──────────────────────────────────────────────────────

describe('La vida de una salida', () => {
  test('Las situaciones de una salida son exactamente cuatro', () => {
    assert.deepEqual([...SITUACIONES], ['abierta-con-rotulo', 'abierta-sin-rotulo', 'cerrada-sin-leer', 'cerrada-leida']);
    assert.equal(SITUACIONES.length, 4, 'una quinta situación sería un estado del que ninguna transición sabría salir');
    assert.deepEqual([...SITUACIONES_ABIERTAS], ['abierta-con-rotulo', 'abierta-sin-rotulo']);
    // El vocabulario del momento es el de las cuatro más la nada, y la nada tiene
    // palabra propia porque no tener salida no es un error.
    assert.deepEqual([...ESTADOS_DE_SALIDA], [SIN_SALIDA, ...SITUACIONES]);
  });

  test('Una partida sin ninguna salida lo dice y no es un error', () => {
    const estado = estadoDeSalidas();
    assert.equal(situacionDeSalida(estado), SIN_SALIDA);
    assert.equal(salidaEnCurso(estado), null);
    assert.equal(haySalidaEnCurso(estado), false);
    assert.equal(telonPendiente(estado), null);
    assert.equal(queOfreceAlAbrirLaApp(estado), QUE_OFRECE.PORTADA);
  });

  test('Abrir una salida la deja abierta con el rótulo puesto y el punto de partida anotado', () => {
    const { estado, rotulo, abre } = abierta();
    assert.equal(abre.abierta, true);
    assert.equal(abre.motivo, null);
    assert.equal(abre.rotulo, 'puesto');
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo');
    assert.deepEqual({ ...salidaEnCurso(estado).partida }, PARTIDA);
    // Y el rótulo se puso de verdad, con su línea: la situación del estado y lo que
    // hay en la pantalla de bloqueo nacen ya coincidiendo.
    assert.equal(rotulo.cuentas().puestas, 1);
    assert.equal(rotulo.presente(), true);
    assert.equal(rotulo.linea(), 'Vas hacia Monfrida.');
  });

  test('Abrir otra salida con una abierta falla nombrando la que sigue abierta', () => {
    const { estado } = abierta();
    assert.throws(
      () => abreSalida(estado, { salida: 'salida-2', mapa: 'mapa-1', partida: PARTIDA, tMs: T0, rotulo: rotuloQueFunciona(), fuente: fuenteDePosiciones() }),
      /salida-1/,
      'sustituir la salida abierta perdería el punto de partida de la que estaba en curso',
    );
    assert.equal(salidaEnCurso(estado).salida, 'salida-1');
  });

  test('Una salida abierta vuelve de su documento en la misma situación y con el mismo punto de partida', () => {
    const { estado, rotulo } = abierta();
    recorre(estado, rotulo, [posicion(1500, 20, 'andando')]);
    const antes = salidaEnCurso(estado);

    const vuelta = levantaSalidas(JSON.parse(JSON.stringify(congelaSalidas(estado))));
    const despues = salidaEnCurso(vuelta);
    assert.equal(despues.situacion, antes.situacion);
    assert.deepEqual({ ...despues.partida }, { ...antes.partida });
    assert.equal(despues.ultimoPropioMs, antes.ultimoPropioMs, 'la marca del último metro propio no ha sobrevivido');
    assert.equal(despues.ultimaMarcaMs, antes.ultimaMarcaMs);
    assert.equal(despues.rotulo, 'puesto');
  });

  test('Una salida cerrada sin leer sigue sin leer después de ir y volver del documento', () => {
    const { estado, rotulo } = abierta();
    terminaDesdeElRotulo(estado, { rotulo });
    const vuelta = levantaSalidas(JSON.parse(JSON.stringify(congelaSalidas(estado))));
    assert.equal(situacionDeSalida(vuelta), 'cerrada-sin-leer');
    assert.equal(hayTelonPendiente(vuelta), true);
    assert.equal(telonPendiente(vuelta).motivo, MOTIVOS_DE_CIERRE.ROTULO);
  });

  test('Con una salida cerrada leída no hay salida en curso y se puede abrir otra', () => {
    const { estado, rotulo } = abierta();
    terminaDesdeElRotulo(estado, { rotulo });
    marcaElTelonComoLeido(estado);
    assert.equal(situacionDeSalida(estado), 'cerrada-leida');
    assert.equal(salidaEnCurso(estado), null);
    assert.equal(hayTelonPendiente(estado), false);
    assert.equal(queOfreceAlAbrirLaApp(estado), QUE_OFRECE.PORTADA);

    const otra = abreSalida(estado, { salida: 'salida-2', mapa: 'mapa-1', partida: PARTIDA, tMs: T0, destino: 'Ourés', rotulo: rotuloQueFunciona(), fuente: fuenteDePosiciones() });
    assert.equal(otra.abierta, true);
    assert.equal(salidaEnCurso(estado).salida, 'salida-2');
  });

  test('Una transición que la situación no admite falla nombrando las dos', () => {
    const { estado, rotulo } = abierta();
    terminaDesdeElRotulo(estado, { rotulo });

    // Cerrar una salida ya cerrada.
    assert.throws(() => cierraLaSalida(estado, { motivo: MOTIVOS_DE_CIERRE.PORTADA }), (e) => {
      assert.match(e.message, /cerrada-sin-leer/);
      assert.match(e.message, /cerrar la salida/);
      return true;
    });
    // Retirar el rótulo de una salida cerrada.
    assert.throws(() => retiraElRotulo(estado, { motivo: MOTIVOS_DE_RETIRADA.PLAZO }), /cerrada-sin-leer[\s\S]*retirar el rótulo/);
    // Retomar una que nunca se abrió.
    assert.throws(() => retomaLaSalida(estadoDeSalidas(), { tMs: T0, rotulo: rotuloQueFunciona() }), new RegExp(SIN_SALIDA));
    // Y marcar como leído un telón que ya se leyó.
    marcaElTelonComoLeido(estado);
    assert.throws(() => marcaElTelonComoLeido(estado), /cerrada-leida[\s\S]*marcar el telón como leído/);
  });

  test('Ninguna operación pública recibe una fecha, una hora ni un número de días', () => {
    // El tiempo entra como marca de cada posición y aquí solo se comparan marcas. Un
    // parámetro con nombre de fecha sería la puerta por la que volvería el reloj.
    const codigo = codigoSinComentarios('packages/nucleo/partida/salidas.js');
    for (const sospechoso of [/\bfecha\b/i, /\bhoras?\b/i, /\bdias?\b/i, /\bdías?\b/i, /\btimestamp\b/i]) {
      assert.doesNotMatch(codigo, sospechoso, `la superficie de salidas.js nombra ${sospechoso}`);
    }
    // Lo que sí recibe son marcas, y se llaman así.
    assert.match(codigo, /tMs/);
  });

  test('El módulo de la salida no lee el reloj del sistema ni siembra ningún azar', () => {
    for (const ruta of ['packages/nucleo/partida/salidas.js', 'packages/nucleo/partida/regreso.js', 'packages/nucleo/partida/rotulo.js']) {
      const codigo = codigoSinComentarios(ruta);
      for (const prohibido of [/Date\.now/, /new Date\b/, /performance\.now/, /Math\.random/, /makeRng/]) {
        assert.doesNotMatch(codigo, prohibido, `${ruta} usa ${prohibido}: el determinismo del generador no se negocia`);
      }
    }
  });

  test('Cerrar una salida no mueve el contador de pasos del mundo', () => {
    // Cerrar una salida no es andar. Si el cierre ejecutara un paso, la partida
    // avanzaría por volver a casa, que es lo contrario de lo que el juego pide.
    const motor = creaMotorDePasos({ semilla: SEMILLA_A, mapaId: 'mapa-1' });
    motor.avanza(3);
    const antes = motor.registro().n;

    const { estado, rotulo } = abierta();
    recorre(estado, rotulo, [posicion(1500, 20, 'andando')]);
    terminaDesdeElRotulo(estado, { rotulo });

    assert.equal(motor.registro().n, antes, 'el cierre ha movido el contador de pasos');
    // Y no hay por dónde: el módulo no importa el motor de pasos.
    assert.doesNotMatch(fuente('packages/nucleo/partida/salidas.js'), /from '\.\/pasos\.js'/);
  });

  test('El área de la salida se registra con el mecanismo que ya existe y no se reproduce', () => {
    assert.ok(IDS_DE_AREA.includes('salidas'), 'el área nueva no está declarada');
    assert.ok(AREAS_CON_ESTADO.includes('salidas'));
    // No se reproduce desde el registro a propósito: sus hechos no llevan dentro el
    // punto de partida, y reconstruirlo sería inventárselo.
    assert.ok(AREAS_QUE_NO_REPRODUCEN.includes('salidas'));
    const area = areaDe('salidas');
    for (const pieza of ['esquema', 'inicial', 'congela', 'levanta']) {
      assert.ok(area[pieza], `el área "salidas" no declara "${pieza}"`);
    }
  });
});

// ── El telón lo echa volver ────────────────────────────────────────────────────

describe('El telón se echa solo al cerrarse la salida', () => {
  test('Volver a casa cierra la salida', () => {
    const { estado, rotulo } = abierta();
    // Alejarse más de la distancia de alejamiento y volver, quedándose el minuto.
    const fin = recorre(estado, rotulo, [
      posicion(1500, 20, 'andando'),
      posicion(20, 60, 'andando'),
      posicion(15, 60 + PERMANENCIA_S / 60, 'andando'),
    ]);
    assert.equal(fin.haVuelto, true);
    assert.equal(situacionDeSalida(estado), 'cerrada-sin-leer');
    assert.equal(fin.cierre.salida.motivo, MOTIVOS_DE_CIERRE.REGRESO);

    // Y no salta ninguna notificación ni se pone la app en primer plano: el telón se
    // echa solo y esperar es el comportamiento correcto.
    assert.equal(fin.cierre.notifica, false);
    assert.equal(fin.cierre.ponePrimerPlano, false);
    assert.equal(fin.cierre.pideConfirmacion, false);
  });

  test('Volver a casa en autobús echa el telón igual', () => {
    // Las mismas posiciones que el caso anterior, clasificadas como vehículo. Volver
    // es dónde estás, no cuántos kilómetros pusiste tú.
    const { estado, rotulo } = abierta();
    const fin = recorre(estado, rotulo, [
      posicion(6000, 20, 'andando'),
      posicion(20, 60, 'vehiculo'),
      posicion(15, 61, 'vehiculo'),
    ]);
    assert.equal(fin.haVuelto, true);
    assert.equal(situacionDeSalida(estado), 'cerrada-sin-leer');
    assert.equal(telonPendiente(estado).motivo, MOTIVOS_DE_CIERRE.REGRESO);
  });

  test('La comprobación del regreso no consulta la clasificación de la traza en ningún punto', () => {
    // La firma no la lleva —`avanzaElRegreso` recibe dónde y cuándo, y nada más— y
    // el módulo tampoco importa nada del detector: una firma limpia con un import
    // dentro no garantiza nada.
    //
    // La lista `LO_QUE_EL_REGRESO_NO_MIRA` se descuenta antes de buscar: es la
    // declaración de lo que no se mira y nombra a propósito lo que se persigue.
    const codigo = codigoSinComentarios('packages/nucleo/partida/regreso.js')
      .replace(/export const LO_QUE_EL_REGRESO_NO_MIRA[\s\S]*?\]\);/, '');
    assert.doesNotMatch(codigo, /from '\.\/ritmo\.js'/, 'el regreso importa el módulo de la clasificación');
    for (const palabra of ['clasificacion', 'vehiculo', 'andando', 'ambiguo', 'cuentaParaElMotorDePasos']) {
      assert.equal(codigo.includes(palabra), false, `regreso.js nombra "${palabra}" en su código`);
    }
    assert.deepEqual([...LO_QUE_EL_REGRESO_NO_MIRA], ['clasificacion-de-la-traza', 'deteccion-de-vehiculo', 'metros-andados', 'ritmo']);

    // Y la prueba de que da igual: la misma secuencia con cada una de las cuatro
    // clasificaciones cierra exactamente igual.
    for (const clasificacion of CLASIFICACIONES) {
      const { estado, rotulo } = abierta();
      const fin = recorre(estado, rotulo, [
        posicion(3000, 20, clasificacion),
        posicion(20, 60, clasificacion),
        posicion(15, 61, clasificacion),
      ]);
      assert.equal(fin.haVuelto, true, `con la traza clasificada "${clasificacion}" el telón no se ha echado`);
      assert.equal(situacionDeSalida(estado), 'cerrada-sin-leer');
    }
  });

  test('Sin haberse alejado, pasar por el punto de partida no cierra la salida', () => {
    // Es el caso más fácil de romper y el más embarazoso: abrir la salida en casa la
    // cerraría al instante.
    const { estado, rotulo } = abierta();
    const fin = recorre(estado, rotulo, [
      posicion(10, 1, 'andando'),
      posicion(30, 20, 'andando'),
      posicion(10, 40, 'andando'),
    ]);
    assert.equal(fin.haVuelto, false);
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo');
  });

  test('Pasar por delante de casa sin quedarse el tiempo de permanencia no cierra la salida', () => {
    const { estado, rotulo } = abierta();
    const fin = recorre(estado, rotulo, [
      posicion(1500, 20, 'andando'),
      posicion(20, 40, 'andando'),                 // entra en el radio
      posicion(20, 40.5, 'andando'),               // medio minuto dentro: no basta
      posicion(400, 41, 'andando'),                // y se va
      posicion(20, 50, 'andando'),                 // vuelve a entrar: el reloj empieza de cero
      posicion(20, 50.5, 'andando'),
    ]);
    assert.equal(fin.haVuelto, false, 'dos medios minutos no suman el minuto de permanencia');
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo');
  });

  test('La distancia de alejamiento va en tramos, con el suelo de moverse como mínimo', () => {
    assert.equal(TRAMOS_DE_ALEJAMIENTO, 0.5);
    // Quien anda 2 km en media hora se tiene que alejar 1 km; quien anda 300 m se
    // alejaría 150, y eso no es haber salido de casa en ningún barrio: sube al suelo.
    assert.equal(distanciaDeAlejamientoM(2000), 1000);
    assert.equal(distanciaDeAlejamientoM(300), SUELO_TRAMO_M);
    assert.ok(distanciaDeAlejamientoM(300) >= SUELO_TRAMO_M);
    // El radio de regreso, en cambio, va en metros y no se escala: es tolerancia de
    // sensor y no unidad de juego.
    assert.equal(RADIO_DE_REGRESO_M, 50);
    assert.equal(PERMANENCIA_S, 60);
    assert.equal(PERMANENCIA_MS, 60_000);
    assert.doesNotMatch(codigoSinComentarios('packages/nucleo/partida/regreso.js'), /RADIO_DE_REGRESO_M\s*\*/, 'el radio de regreso se escala con algo');
  });

  test('Dos jugadoras con tramos distintos se alejan distancias distintas y proporcionales', () => {
    const corta = distanciaDeAlejamientoM(700);
    const larga = distanciaDeAlejamientoM(2000);
    assert.notEqual(corta, larga);
    assert.equal(larga / 2000, corta / 700, 'las dos distancias no son proporcionales a su tramo');

    // Y se ve en el cierre: 500 m alejan de verdad a quien anda 700 y no a quien anda 2000.
    const cerca = (tramoM) => {
      const estado = estadoDeSalidas();
      const rotulo = rotuloQueFunciona();
      abreSalida(estado, { salida: 's', mapa: 'm', partida: PARTIDA, tMs: T0, destino: 'Monfrida', rotulo, fuente: fuenteDePosiciones() });
      let ultimo = null;
      for (const p of [posicion(500, 10, 'andando'), posicion(20, 30, 'andando'), posicion(20, 31, 'andando')]) {
        ultimo = recibePosicion(estado, { posicion: p, tramo: tramoM, rotulo });
      }
      return ultimo.haVuelto;
    };
    assert.equal(cerca(700), true, 'quien anda 700 m en media hora se alejó de verdad a los 500 m');
    assert.equal(cerca(2000), false, 'quien anda 2 km en media hora no se ha alejado a los 500 m');
  });

  test('Se puede cerrar la salida desde el rótulo del sistema', () => {
    const porRotulo = abierta();
    recorre(porRotulo.estado, porRotulo.rotulo, [posicion(3000, 20, 'andando')]);
    const cierre = terminaDesdeElRotulo(porRotulo.estado, { rotulo: porRotulo.rotulo });

    const porRegreso = abierta();
    const fin = recorre(porRegreso.estado, porRegreso.rotulo, [
      posicion(3000, 20, 'andando'),
      posicion(20, 60, 'andando'),
      posicion(20, 61, 'andando'),
    ]);

    // Igual que si hubiera vuelto: la única diferencia de **estado** es el motivo.
    // Las dos marcas del sensor se descuentan porque no son estado del cierre sino
    // del recorrido —una salida cerrada a mano se cierra antes de dar el último
    // paso—, y compararlas mediría el paseo y no la transición.
    const comparable = (v) => ({ ...v, motivo: null, ultimaMarcaMs: null, ultimoPropioMs: null });
    assert.deepEqual(comparable(cierre.salida), comparable(fin.cierre.salida));
    assert.equal(cierre.salida.situacion, 'cerrada-sin-leer');
    assert.equal(cierre.salida.rotulo, 'retirado-por-cierre');
    assert.equal(cierre.salida.motivo, MOTIVOS_DE_CIERRE.ROTULO);
    assert.equal(fin.cierre.salida.motivo, MOTIVOS_DE_CIERRE.REGRESO);
    assert.equal(cierre.notifica, false);
    assert.equal(cierre.ponePrimerPlano, false);
    // Y no se confirma: una confirmación convierte una decisión libre en algo que hay
    // que defender.
    assert.equal(cierre.pideConfirmacion, false);
  });

  test('El motivo de cierre sale de un vocabulario cerrado de tres', () => {
    assert.deepEqual([...IDS_DE_MOTIVO_DE_CIERRE].sort(), ['a-mano-desde-el-rotulo', 'dejarlo-aqui', 'regreso']);
    const { estado, rotulo } = abierta();
    assert.throws(() => cierraLaSalida(estado, { motivo: 'aburrimiento', rotulo }), /aburrimiento[\s\S]*regreso/);
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo', 'un motivo inventado ha cerrado la salida igual');
  });

  test('Una salida con aventura sin terminar se cierra marcada como en corto por las tres vías', () => {
    for (const cierra of [
      (e, r) => cierraLaSalida(e, { motivo: MOTIVOS_DE_CIERRE.REGRESO, rotulo: r }),
      (e, r) => terminaDesdeElRotulo(e, { rotulo: r }),
      (e, r) => dejarloAqui(e, { rotulo: r }),
    ]) {
      const { estado, rotulo } = abierta({ aventura: 'aventura-1' });
      const cierre = cierra(estado, rotulo);
      assert.equal(cierre.salida.cierreEnCorto, true, 'el cierre en corto depende de la aventura, no de la vía');
    }
  });

  test('Una salida sin ninguna aventura aceptada no se cierra en corto', () => {
    const { estado, rotulo } = abierta({ aventura: null, destino: null });
    const cierre = terminaDesdeElRotulo(estado, { rotulo });
    assert.equal(cierre.salida.aventura, null);
    assert.equal(cierre.salida.cierreEnCorto, false, 'sin aventura no hay nada que quedara a medias');
  });

  test('Una salida con la aventura terminada no se cierra en corto', () => {
    const { estado, rotulo } = abierta({ aventura: 'aventura-1' });
    terminaLaAventura(estado);
    const cierre = terminaDesdeElRotulo(estado, { rotulo });
    assert.equal(cierre.salida.cierreEnCorto, false);
  });

  test('El rótulo queda retirado en la misma transición del cierre y no en una posterior', () => {
    const { estado, rotulo } = abierta();
    assert.equal(rotulo.presente(), true);
    const cierre = terminaDesdeElRotulo(estado, { rotulo });
    // Una salida cerrada con el rótulo todavía puesto es un servicio corriendo sin salida.
    assert.equal(rotulo.presente(), false);
    assert.deepEqual(rotulo.retiradas, [MOTIVOS_DE_RETIRADA.CIERRE]);
    assert.equal(cierre.salida.rotulo, 'retirado-por-cierre');
    assert.equal(estadoDelRotulo(estado), 'retirado-por-cierre');
  });

  test('La vigilancia del regreso no se muta y sale del documento con sus dos campos', () => {
    const inicial = estadoDeRegreso();
    const paso = avanzaElRegreso(inicial, { partida: PARTIDA, alejamientoM: 1000, ...alNorte(1500), tMs: T0 });
    assert.deepEqual(inicial, { seAlejo: false, dentroDesdeMs: null }, 'avanzar el regreso ha mutado la vigilancia recibida');
    assert.equal(paso.seAlejo, true);
    assert.ok(Math.abs(paso.distanciaM - 1500) < 20, `la distancia medida fue ${paso.distanciaM}`);
    assert.ok(Math.abs(metrosEntre(PARTIDA, alNorte(1500)) - 1500) < 20);
  });
});

// ── El telón espera a que lo leas ──────────────────────────────────────────────

describe('El telón espera a que lo leas', () => {
  test('El telón espera a que lo leas', () => {
    const { estado, rotulo } = abierta();
    terminaDesdeElRotulo(estado, { rotulo });
    assert.equal(situacionDeSalida(estado), 'cerrada-sin-leer');
    assert.equal(queOfreceAlAbrirLaApp(estado), QUE_OFRECE.TELON, 'lo primero que se ofrece no es el telón');

    // Dos días con la app cerrada en medio: se serializa, se levanta y sigue ahí. El
    // «dos días» no es una espera: es que nada del paso del tiempo lo toca.
    const vuelta = levantaSalidas(JSON.parse(JSON.stringify(congelaSalidas(estado))));
    assert.equal(queOfreceAlAbrirLaApp(vuelta), QUE_OFRECE.TELON);
    assert.equal(telonPendiente(vuelta).salida, 'salida-1');

    // Y se marca leído con una acción explícita, no con el paso de nada.
    marcaElTelonComoLeido(vuelta);
    assert.equal(situacionDeSalida(vuelta), 'cerrada-leida');
    assert.equal(hayTelonPendiente(vuelta), false);
    assert.equal(queOfreceAlAbrirLaApp(vuelta), QUE_OFRECE.PORTADA);
  });

  test('Nada salvo marcarlo lo marca como leído', () => {
    const { estado, rotulo } = abierta();
    terminaDesdeElRotulo(estado, { rotulo });
    // Ni consultar, ni serializar, ni levantar, ni preguntar qué se ofrece.
    for (const consulta of [
      () => situacionDeSalida(estado),
      () => telonPendiente(estado),
      () => queOfreceAlAbrirLaApp(estado),
      () => congelaSalidas(estado),
      () => estadoDelRotulo(estado),
    ]) {
      consulta();
      assert.equal(situacionDeSalida(estado), 'cerrada-sin-leer', 'una consulta ha marcado el telón como leído');
    }
  });

  test('No se puede abrir una salida nueva con un telón sin leer, y el fallo lo nombra', () => {
    const { estado, rotulo } = abierta();
    terminaDesdeElRotulo(estado, { rotulo });
    assert.throws(
      () => abreSalida(estado, { salida: 'salida-2', mapa: 'mapa-1', partida: PARTIDA, tMs: T0, rotulo: rotuloQueFunciona(), fuente: fuenteDePosiciones() }),
      /salida-1[\s\S]*sin leer/,
      'dos telones pendientes obligarían a elegir cuál se enseña',
    );
    assert.equal(hayTelonPendiente(estado), true);
  });

  test('Al cerrarse, la capa no emite ninguna notificación ni ninguna petición de primer plano', () => {
    // La ausencia se afirma sobre lo que el cierre devuelve declarado, y además sobre
    // el código: el módulo no tiene por dónde avisar porque no importa ningún canal.
    const { estado, rotulo } = abierta();
    const cierre = dejarloAqui(estado, { rotulo });
    assert.deepEqual(
      { notifica: cierre.notifica, ponePrimerPlano: cierre.ponePrimerPlano, pideConfirmacion: cierre.pideConfirmacion },
      { notifica: false, ponePrimerPlano: false, pideConfirmacion: false },
    );
    const codigo = codigoSinComentarios('packages/nucleo/partida/salidas.js');
    for (const canal of [/notificaciones/, /notifica\(/, /avisa\(/, /primerPlano\(/, /haptico/]) {
      assert.doesNotMatch(codigo, canal, `salidas.js habla con ${canal} al cerrar`);
    }
  });
});

// ── La salida que espera, y el rótulo que se retira ────────────────────────────

describe('El rótulo se retira pero la salida no se cierra', () => {
  test('El rótulo se retira pero la salida no se cierra', () => {
    const { estado, rotulo } = abierta();
    // Noventa minutos de tiempo del sensor sin un solo metro propio. No se esperan:
    // se comparan dos marcas.
    const fin = recorre(estado, rotulo, [posicion(1200, PLAZO_DE_RETIRADA_MS / MINUTO, 'parada')]);

    assert.equal(fin.retirada, MOTIVOS_DE_RETIRADA.PLAZO);
    assert.equal(situacionDeSalida(estado), 'abierta-sin-rotulo', 'retirar el rótulo ha cerrado la salida');
    assert.equal(haySalidaEnCurso(estado), true);
    assert.equal(hayTelonPendiente(estado), false);
    assert.equal(estadoDelRotulo(estado), 'retirado-por-plazo');
    assert.equal(rotulo.presente(), false);
    // Y al abrir la app aparece la tarjeta de a medias, no el telón.
    assert.equal(queOfreceAlAbrirLaApp(estado), QUE_OFRECE.A_MEDIAS);
  });

  test('Una parada de veinte minutos no retira el rótulo, y el plazo cuenta desde el último metro propio', () => {
    // Las paradas son de quien juega y una comida no puede tener consecuencias.
    const { estado, rotulo } = abierta();
    const parada = recorre(estado, rotulo, [
      posicion(800, 10, 'andando'),
      posicion(800, 30, 'parada'),
      posicion(1200, 35, 'andando'),
    ]);
    assert.equal(parada.retirada, null);
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo');

    // Y el plazo vuelve a contar desde ese último metro: a los 100 min del arranque
    // —pero solo 65 desde el último metro propio— el rótulo sigue puesto.
    const despues = recorre(estado, rotulo, [posicion(1250, 100, 'parada')]);
    assert.equal(despues.retirada, null, 'el plazo no se reinició con el último metro propio');
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo');
  });

  test('El plazo entero a velocidad de vehículo retira el rótulo igual', () => {
    // Si el plazo se reiniciara con cualquier movimiento, un trayecto de tres horas
    // dejaría el servicio corriendo tres horas sin que nadie ande.
    const { estado, rotulo } = abierta();
    const fin = recorre(estado, rotulo, [
      posicion(20_000, 30, 'vehiculo'),
      posicion(40_000, 60, 'vehiculo'),
      posicion(60_000, 90, 'vehiculo'),
    ]);
    assert.equal(fin.retirada, MOTIVOS_DE_RETIRADA.PLAZO);
    assert.equal(situacionDeSalida(estado), 'abierta-sin-rotulo');
  });

  test('La velocidad ambigua reinicia el plazo, y la regla se lee del motor de pasos', () => {
    // En la duda, cuenta: un falso ambiguo mantiene el rótulo puesto un rato de más,
    // que no le quita nada a nadie; un falso vehículo lo retiraría antes de tiempo.
    const { estado, rotulo } = abierta();
    const fin = recorre(estado, rotulo, [
      posicion(3000, 60, 'ambiguo'),
      posicion(4000, 120, 'parada'),
    ]);
    assert.equal(fin.retirada, null, 'el tramo ambiguo no reinició el plazo');
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo');

    // Y la regla no se reimplementa: es la misma del motor de pasos, exactamente.
    assert.deepEqual(
      CLASIFICACIONES.map(reiniciaElPlazo),
      CLASIFICACIONES.map((c) => reiniciaElPlazo(c)),
    );
    assert.deepEqual(
      Object.fromEntries(CLASIFICACIONES.map((c) => [c, reiniciaElPlazo(c)])),
      { andando: true, parada: false, vehiculo: false, ambiguo: true },
    );
    assert.match(fuente('packages/nucleo/partida/rotulo.js'), /cuentaParaElMotorDePasos/);
  });

  test('Con el rótulo retirado, el estado ofrece la salida a medias y «seguir» vuelve a ponerlo', () => {
    const { estado, rotulo } = abierta();
    recorre(estado, rotulo, [posicion(1200, PLAZO_DE_RETIRADA_MS / MINUTO, 'parada')]);
    assert.equal(queOfreceAlAbrirLaApp(estado), QUE_OFRECE.A_MEDIAS);

    const retoma = retomaLaSalida(estado, { tMs: T0 + 200 * MINUTO, rotulo });
    assert.equal(retoma.retomada, true);
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo');
    assert.equal(rotulo.presente(), true);
    assert.equal(salidaEnCurso(estado).ultimoPropioMs, T0 + 200 * MINUTO, 'el plazo no cuenta de nuevo desde el momento de retomar');

    // Y el plazo cuenta de nuevo: a los 60 min de retomar sigue puesto.
    const despues = recorre(estado, rotulo, [posicion(1200, 260, 'parada')]);
    assert.equal(despues.retirada, null);
  });

  test('Con el rótulo retirado, «dejarlo aquí» cierra con el motivo de la portada', () => {
    const { estado, rotulo } = abierta({ aventura: 'aventura-1' });
    recorre(estado, rotulo, [posicion(1200, PLAZO_DE_RETIRADA_MS / MINUTO, 'parada')]);
    const cierre = dejarloAqui(estado, { rotulo });
    assert.equal(cierre.salida.motivo, MOTIVOS_DE_CIERRE.PORTADA);
    assert.equal(cierre.salida.cierreEnCorto, true, 'había aventura sin terminar y el cierre no quedó marcado en corto');
    assert.equal(situacionDeSalida(estado), 'cerrada-sin-leer');
  });

  test('La tarjeta de a medias solo existe con la salida abierta', () => {
    // Con el rótulo puesto y con el rótulo retirado, la tarjeta existe: depende de que
    // la salida esté abierta y no de dónde esté el rótulo.
    const conRotulo = abierta();
    assert.equal(queOfreceAlAbrirLaApp(conRotulo.estado), QUE_OFRECE.A_MEDIAS);

    const sinRotulo = abierta();
    recorre(sinRotulo.estado, sinRotulo.rotulo, [posicion(1200, PLAZO_DE_RETIRADA_MS / MINUTO, 'parada')]);
    assert.equal(situacionDeSalida(sinRotulo.estado), 'abierta-sin-rotulo');
    assert.equal(queOfreceAlAbrirLaApp(sinRotulo.estado), QUE_OFRECE.A_MEDIAS);

    // Y cerrada, no: quien abandonó y llegó a casa no tiene tarjeta ninguna, porque el
    // cierre en corto se disparó al llegar.
    const cerrada = abierta({ aventura: 'aventura-1' });
    const fin = recorre(cerrada.estado, cerrada.rotulo, [
      posicion(3000, 20, 'andando'),
      posicion(20, 60, 'andando'),
      posicion(20, 61, 'andando'),
    ]);
    assert.equal(fin.cierre.salida.cierreEnCorto, true);
    assert.equal(haySalidaEnCurso(cerrada.estado), false);
    assert.notEqual(queOfreceAlAbrirLaApp(cerrada.estado), QUE_OFRECE.A_MEDIAS);
  });

  test('Una salida con el rótulo retirado hace tres semanas sigue abierta', () => {
    // La salida no se cierra sola nunca, por nada: adivinar mal echa el telón sobre
    // una aventura viva. Lo único que se para solo es el servicio.
    const { estado, rotulo } = abierta();
    recorre(estado, rotulo, [posicion(1200, PLAZO_DE_RETIRADA_MS / MINUTO, 'parada')]);

    let vuelta = estado;
    for (let semana = 0; semana < 3; semana++) {
      vuelta = levantaSalidas(JSON.parse(JSON.stringify(congelaSalidas(vuelta))));
    }
    assert.equal(situacionDeSalida(vuelta), 'abierta-sin-rotulo');
    assert.equal(haySalidaEnCurso(vuelta), true);
    assert.equal(queOfreceAlAbrirLaApp(vuelta), QUE_OFRECE.A_MEDIAS);
  });

  test('Los motivos de retirada del rótulo son tres y se distinguen', () => {
    assert.deepEqual([...IDS_DE_MOTIVO_DE_RETIRADA].sort(), ['cierre', 'plazo', 'sistema']);
    assert.deepEqual(
      [...ESTADOS_DEL_ROTULO],
      ['puesto', 'retirado-por-plazo', 'retirado-por-cierre', 'retirado-por-el-sistema', 'no-disponible'],
    );
    // El del cierre no se puede pedir aparte: ocurre dentro del cierre y no como una
    // retirada suelta, y pedirlo así lo dice.
    const { estado, rotulo } = abierta();
    assert.throws(() => retiraElRotulo(estado, { motivo: MOTIVOS_DE_RETIRADA.CIERRE, rotulo }), /cierre[\s\S]*dentro del cierre/);
  });

  test('El rótulo que retira el sistema queda con su propio motivo y la salida sigue abierta', () => {
    // Es el corazón del riesgo 4: la Actividad en Vivo que caduca sola, el servicio
    // que Android mata al recuperar memoria. Nadie llama para decirlo.
    const rotulo = rotuloQueSeRetiraSolo();
    const { estado } = abierta({ rotulo });
    rotulo.caduca();

    const reconciliado = reconciliaConElRotulo(estado, { rotulo });
    assert.equal(reconciliado.coincidian, false, 'el estado creía sostenida una salida que no lo estaba');
    assert.equal(reconciliado.corregido, true);
    assert.equal(reconciliado.motivo, MOTIVOS_DE_RETIRADA.SISTEMA);
    assert.equal(situacionDeSalida(estado), 'abierta-sin-rotulo');
    assert.equal(estadoDelRotulo(estado), 'retirado-por-el-sistema');
    assert.notEqual(estadoDelRotulo(estado), 'retirado-por-plazo', 'la retirada del sistema se ha confundido con el plazo del juego');
    // Y no se le vuelve a pedir nada a un rótulo que ya no está.
    assert.deepEqual(rotulo.retiradas, []);
  });

  test('El plazo del juego cabe por debajo del tope de vida más corto de las dos plataformas', () => {
    // Escrito como comprobación y no como comentario: si alguien sube el plazo, el
    // sistema apagaría el rótulo antes que el juego y la retirada por el sistema
    // pasaría a ser el caso normal en lugar de la excepción.
    assert.equal(PLAZO_DE_RETIRADA_MS, 90 * 60 * 1000);
    assert.ok(PLAZO_DE_RETIRADA_MS < TOPE_MAS_CORTO_MS);
    assert.equal(TOPE_MAS_CORTO_MS, TOPES_DE_PLATAFORMA_MS.ios, 'el tope más corto no es el de la Actividad en Vivo');
    assert.equal(TOPES_DE_PLATAFORMA_MS.android, null, 'el servicio de Android no tiene tope de reloj: lo mata la memoria');
    assert.equal(revisaElPlazo().cabe, true);
    assert.ok(revisaElPlazo().holguraMs > 0);
    assert.throws(() => revisaElPlazo({ plazoMs: TOPE_MAS_CORTO_MS + 1 }), /no cabe por debajo del tope/);
    assert.throws(() => revisaElPlazo({ plazoMs: 0 }), /milisegundos positivos/);
    // Y se ejecuta al importar, que es lo que hace que no dependa de que alguien la llame.
    assert.match(fuente('packages/nucleo/partida/rotulo.js'), /^revisaElPlazo\(\);$/m);
  });

  test('El plazo se mide comparando dos marcas del sensor y no admite otra cosa', () => {
    assert.equal(plazoAgotado({ ultimoPropioMs: T0, tMs: T0 + PLAZO_DE_RETIRADA_MS }), true);
    assert.equal(plazoAgotado({ ultimoPropioMs: T0, tMs: T0 + PLAZO_DE_RETIRADA_MS - 1 }), false);
    assert.throws(() => plazoAgotado({ ultimoPropioMs: T0, tMs: '2026-08-09' }), /dos marcas del sensor/);
    assert.throws(() => plazoAgotado({ ultimoPropioMs: null, tMs: T0 }), /dos marcas del sensor/);
  });
});

// ── El rótulo: contenido y acción ──────────────────────────────────────────────

describe('El rótulo, contenido y acción', () => {
  test('Con destino, el rótulo trae una línea que lo nombra y una sola acción', () => {
    const compuesto = componeRotulo({ destino: 'Monfrida', mundo: 'O Val' });
    assert.equal(compuesto.linea, 'Vas hacia Monfrida.');
    assert.deepEqual({ ...compuesto.accion }, { ...ACCION_DEL_ROTULO });
    assert.equal(compuesto.accion.texto, 'Dar la salida por terminada');
    assert.equal(compuesto.acciones.length, 1);
    assert.equal(compuesto.tocables, 1, 'cualquier segunda acción convierte el rótulo en un panel');
  });

  test('Ninguna línea del rótulo lleva un dígito', () => {
    for (const compuesto of [
      componeRotulo({ destino: 'Monfrida' }),
      componeRotulo({ destino: null, mundo: 'O Val de Arriba' }),
      componeRotulo({ destino: 'A Fonte do Solpor' }),
    ]) {
      assert.doesNotMatch(compuesto.linea, /\d/, `«${compuesto.linea}» lleva una cifra`);
    }
    // Y el cribado se aplica de verdad: un destino con un número no llega a la
    // pantalla de bloqueo, falla donde nace.
    assert.throws(() => componeRotulo({ destino: 'Ponte 3' }), /dígito/);
    assert.throws(() => revisaLineaDelRotulo('Vas hacia el kilómetro dos.'), /cifra|esfuerzo/);
  });

  test('Ninguna línea del rótulo dice una palabra de esfuerzo', () => {
    for (const palabra of PALABRAS_DE_ESFUERZO) {
      assert.throws(
        () => revisaLineaDelRotulo(`Vas hacia el ${palabra} de allá.`),
        /palabra de esfuerzo|cifra|dígito/,
        `la línea con "${palabra}" ha pasado el cribado`,
      );
    }
    // Y la lista no está vacía ni es decorativa.
    assert.ok(PALABRAS_DE_ESFUERZO.length >= 15);
    for (const obligatoria of ['kilómetros', 'metros', 'minutos', 'ritmo', 'pasos', 'progreso', 'restante', 'faltan']) {
      assert.ok(PALABRAS_DE_ESFUERZO.includes(obligatoria), `la lista no cierra "${obligatoria}"`);
    }
  });

  test('Sin aventura, el rótulo dice por dónde se anda en voz de mundo y con la misma acción', () => {
    const compuesto = componeRotulo({ destino: null, mundo: 'O Val de Arriba' });
    assert.equal(compuesto.linea, 'Andando por O Val de Arriba.');
    assert.equal(compuesto.tocables, 1);
    assert.deepEqual({ ...compuesto.accion }, { ...ACCION_DEL_ROTULO });
    // Y sin destino y sin mundo no hay línea que componer: un rótulo sin línea es un
    // servicio corriendo sin decir para qué.
    assert.throws(() => componeRotulo({}), /título del mundo/);
    assert.throws(() => componeRotulo({ destino: '' }), /destino del rótulo/);
  });

  test('Cambiar el beat cambia el sitio de la línea y nada más', () => {
    const { estado, rotulo } = abierta({ destino: 'Monfrida' });
    const antes = salidaEnCurso(estado);
    const compuesto = cambiaElDestino(estado, { destino: 'A Fonte do Solpor', rotulo });

    assert.equal(compuesto.linea, 'Vas hacia A Fonte do Solpor.');
    assert.deepEqual({ ...compuesto.accion }, { ...ACCION_DEL_ROTULO });
    assert.equal(compuesto.tocables, 1);
    assert.equal(rotulo.linea(), 'Vas hacia A Fonte do Solpor.');
    assert.equal(rotulo.cuentas().puestas, 1, 'recomponer la línea ha vuelto a poner el rótulo');

    const despues = salidaEnCurso(estado);
    assert.equal(despues.situacion, antes.situacion);
    assert.equal(despues.rotulo, antes.rotulo);
    assert.equal(despues.ultimoPropioMs, antes.ultimoPropioMs, 'cambiar el destino ha tocado el plazo');
    assert.equal(despues.cierreEnCorto, antes.cierreEnCorto);
  });

  test('El rótulo no compone ningún dato del mundo, de la reputación ni del oro', () => {
    assert.deepEqual(
      [...LO_QUE_EL_ROTULO_NO_LLEVA],
      ['distancia-recorrida', 'distancia-que-falta', 'tiempo', 'ritmo', 'numero-de-beats', 'progreso', 'oro', 'reputacion', 'estado-de-un-nucleo', 'miniatura-del-mapa'],
    );
    // El módulo no tiene por dónde: no importa nada de esas capas.
    const codigo = codigoSinComentarios('packages/nucleo/partida/rotulo.js');
    for (const capa of [/oro\.js/, /reputacion\.js/, /nucleos\.js/, /kilometros\.js/, /pasos\.js/, /mapa\.js/]) {
      assert.doesNotMatch(codigo, capa, `rotulo.js importa ${capa}`);
    }
    // Y lo que compone son exactamente estas claves, ninguna más.
    assert.deepEqual(Object.keys(componeRotulo({ destino: 'Monfrida' })).sort(), ['accion', 'acciones', 'dibuja', 'linea', 'tocables']);
  });

  test('El rótulo devuelve datos y no dibuja: quien lo pinta es la plataforma', () => {
    assert.equal(componeRotulo({ destino: 'Monfrida' }).dibuja, false);
    const codigo = codigoSinComentarios('packages/nucleo/partida/rotulo.js');
    for (const pintura of [/react/i, /Skia/, /StyleSheet/, /<[A-Z]/, /createElement/]) {
      assert.doesNotMatch(codigo, pintura, `rotulo.js dibuja (${pintura}) y su trabajo es entregar datos`);
    }
    // Y las acciones que no tiene están nombradas para que su ausencia se pueda poner roja.
    assert.deepEqual([...ACCIONES_QUE_EL_ROTULO_NO_TIENE], ['pausar', 'ver-el-mapa', 'descartar', 'abrir-la-app', 'saltar-el-beat']);
    const acciones = componeRotulo({ destino: 'Monfrida' }).acciones.map((a) => a.id);
    for (const prohibida of ACCIONES_QUE_EL_ROTULO_NO_TIENE) {
      assert.equal(acciones.includes(prohibida), false, `el rótulo trae la acción "${prohibida}"`);
    }
  });

  test('En un mundo gallego el rótulo dice el nombre que produjo su paquete de idioma', () => {
    // El nombre llega hecho: lo produjo el paquete del mundo, y este módulo no sabe en
    // qué idioma está — que es justo lo que hace que no haya que traducir nada aquí.
    const gl = exigeNombres('gl');
    const destino = gl.townName(makeRng('42.88,-8.545#1:rotulo'));
    const compuesto = componeRotulo({ destino, mundo: 'O Val de Arriba', locale: 'gl' });
    assert.equal(compuesto.linea, `Vas hacia ${destino}.`);
    assert.ok(compuesto.linea.includes(destino), 'el nombre gallego no ha llegado literal a la línea');
    assert.doesNotMatch(compuesto.linea, /\d/);
    // Y el mismo mundo en castellano compone igual: lo que cambia es el nombre, no la frase.
    const es = exigeNombres('es');
    const enCastellano = componeRotulo({ destino: es.townName(makeRng('40.4,-3.7#1:rotulo')), mundo: 'El Valle' });
    assert.match(enCastellano.linea, /^Vas hacia .+\.$/);
  });
});

// ── Nada se abre en silencio sin rótulo ────────────────────────────────────────

describe('Nada se abre en silencio sin rótulo', () => {
  test('Sin la capacidad del rótulo la salida no se abre, y el resultado la nombra', () => {
    for (const [doble, esperado] of [
      [rotuloNoDisponible(), /montado y no disponible/],
      [rotuloSinMontar(), /no está montado en esta compilación/],
    ]) {
      const estado = estadoDeSalidas();
      const abre = abreSalida(estado, { salida: 's', mapa: 'm', partida: PARTIDA, tMs: T0, destino: 'Monfrida', rotulo: doble, fuente: fuenteDePosiciones() });
      assert.equal(abre.abierta, false, 'la salida se ha abierto sin rótulo que la sostenga');
      assert.equal(abre.rotulo, 'no-disponible');
      assert.match(abre.motivo, esperado);
      // Y no lanza: no poder abrir es una respuesta que la portada tiene que enseñar,
      // no una avería.
      assert.equal(situacionDeSalida(estado), SIN_SALIDA);
    }
  });

  test('El motivo distingue «no montada» de «no disponible»', () => {
    // Son dos problemas distintos y se arreglan en sitios distintos: uno es una
    // compilación sin el módulo nativo, el otro un permiso o un ajuste del sistema.
    const sinMontar = disponibilidadDelRotulo(rotuloSinMontar());
    const noDisponible = disponibilidadDelRotulo(rotuloNoDisponible());
    assert.equal(sinMontar.hay, false);
    assert.equal(noDisponible.hay, false);
    assert.match(sinMontar.motivo, /no está montado/);
    assert.match(noDisponible.motivo, /montado y no disponible/);
    assert.notEqual(sinMontar.motivo, noDisponible.motivo);
    assert.deepEqual({ ...disponibilidadDelRotulo(rotuloQueFunciona()) }, { hay: true, motivo: null });
  });

  test('Un rótulo que desaparece sin que nadie lo pida se detecta en cualquier momento', () => {
    // La comprobación no vive solo en las transiciones: en Android hay que reconciliar
    // al arrancar, después de que el sistema haya matado el proceso.
    const rotulo = rotuloQueSeRetiraSolo();
    const { estado } = abierta({ rotulo });
    const antes = reconciliaConElRotulo(estado, { rotulo });
    assert.equal(antes.coincidian, true, 'con el rótulo puesto, estado y realidad tienen que coincidir');
    assert.equal(antes.corregido, false);
    assert.equal(antes.presente, true);

    rotulo.caduca();
    const despues = reconciliaConElRotulo(estado, { rotulo });
    assert.equal(despues.coincidian, false);
    assert.equal(despues.presente, false);
    assert.equal(despues.situacion, 'abierta-sin-rotulo');

    // Y reconciliar dos veces no vuelve a corregir nada: ya coinciden.
    const tercera = reconciliaConElRotulo(estado, { rotulo });
    assert.equal(tercera.coincidian, true);
    assert.equal(tercera.corregido, false);
  });

  test('El contrato del rótulo exige las cuatro operaciones y la consulta de presencia', () => {
    assert.throws(() => exigeRotulo(null), /no está cableado/);
    for (const falta of ['pone', 'actualiza', 'retira', 'presente']) {
      const cojo = rotuloQueFunciona();
      delete cojo[falta];
      assert.throws(() => exigeRotulo(cojo), new RegExp(falta), `un rótulo sin ${falta}() ha pasado`);
    }
    assert.equal(exigeRotulo(rotuloQueFunciona()).montado, true);
  });

  test('Sin la fuente de posiciones cableada, abrir falla nombrando la fuente', () => {
    const estado = estadoDeSalidas();
    assert.throws(
      () => abreSalida(estado, { salida: 's', mapa: 'm', partida: PARTIDA, tMs: T0, destino: 'Monfrida', rotulo: rotuloQueFunciona(), fuente: fuenteSinCablear() }),
      /fuente de posiciones[\s\S]*nunca recibirá una posición/,
    );
    assert.throws(() => exigeFuenteDePosiciones(null), /no está cableada/);
    assert.equal(situacionDeSalida(estado), SIN_SALIDA);
  });

  test('Una posición sin marca o con una marca anterior a la última falla nombrándola', () => {
    assert.throws(() => exigePosicion({ ...PARTIDA }), /sin marca de tiempo/);
    assert.throws(() => exigePosicion({ ...PARTIDA, tMs: 1.5 }), /sin marca de tiempo/);
    assert.throws(() => exigePosicion({ ...PARTIDA, tMs: T0 }, { ultimaMarcaMs: T0 + 1 }), /anterior a la última recibida/);
    assert.throws(() => exigePosicion(null), /la posición recibida/);
    assert.throws(() => exigePosicion({ lat: 'norte', lon: 0, tMs: T0 }), /coordenada/);

    // Y en la transición, igual: una traza que va hacia atrás mide cualquier cosa.
    const { estado, rotulo } = abierta();
    recorre(estado, rotulo, [posicion(1000, 30, 'andando')]);
    assert.throws(() => recibePosicion(estado, { posicion: posicion(1000, 10, 'andando'), tramo: TRAMO_M, rotulo }), /anterior a la última recibida/);
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo', 'una posición rechazada ha cambiado la situación');
  });

  test('Un punto de partida que no es una coordenada falla nombrando lo recibido', () => {
    for (const malo of [null, 'casa', { lat: 42.88 }, { lat: 200, lon: 0 }, { lat: 0, lon: 999 }]) {
      const estado = estadoDeSalidas();
      assert.throws(
        () => abreSalida(estado, { salida: 's', mapa: 'm', partida: malo, tMs: T0, destino: 'Monfrida', rotulo: rotuloQueFunciona(), fuente: fuenteDePosiciones() }),
        /punto de partida/,
        `el punto de partida ${JSON.stringify(malo)} ha pasado`,
      );
    }
    // Y la marca con la que se abre también es una marca del sensor.
    assert.throws(
      () => abreSalida(estadoDeSalidas(), { salida: 's', mapa: 'm', partida: PARTIDA, tMs: null, destino: 'Monfrida', rotulo: rotuloQueFunciona(), fuente: fuenteDePosiciones() }),
      /esta capa no lee ningún reloj/,
    );
  });
});

// ── Lo que difiere entre las dos plataformas ───────────────────────────────────

describe('Lo que difiere entre las dos plataformas es el ciclo de vida, nunca el texto', () => {
  const IOS = 'app/plataforma/rotulo.ios.js';
  const ANDROID = 'app/plataforma/rotulo.android.js';

  test('Hay una implementación del rótulo por plataforma y las dos exportan los mismos nombres', () => {
    const nombresDe = (ruta) => [...fuente(ruta).matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]).sort();
    assert.deepEqual(nombresDe(IOS), nombresDe(ANDROID));
    assert.deepEqual(nombresDe(IOS), ['DECLARACION', 'MECANISMO', 'creaRotulo', 'rotulo', 'rotuloSinMontar']);
  });

  test('Las dos sondas responden al mismo contrato de montado, disponible y motivo', () => {
    for (const ruta of [IOS, ANDROID]) {
      const texto = fuente(ruta);
      assert.match(texto, /nombre:\s*'rotulo'/);
      assert.match(texto, /capa:\s*'ninguna'/);
      assert.match(texto, /async sonda\(\)/);
      for (const campo of ['montado', 'disponible', 'motivo']) {
        assert.match(texto, new RegExp(`${campo}:`), `${ruta}: la sonda no responde "${campo}"`);
      }
      // Las cuatro operaciones y la consulta de presencia, en las dos.
      for (const operacion of ['pone', 'actualiza', 'retira', 'presente']) {
        assert.match(texto, new RegExp(`${operacion}\\s*\\(`), `${ruta}: falta ${operacion}()`);
      }
    }
    // Y el mecanismo sí difiere: si fuera el mismo, la partición sería decorativa.
    assert.notEqual(
      fuente(IOS).match(/export const MECANISMO = '([^']+)'/)[1],
      fuente(ANDROID).match(/export const MECANISMO = '([^']+)'/)[1],
    );
  });

  test('Ningún fichero de la app fuera de app/plataforma bifurca por sistema operativo por el rótulo', () => {
    const infracciones = [];
    const raiz = new URL('../../app/', import.meta.url);
    const barre = (dir) => {
      for (const entrada of readdirSync(dir, { withFileTypes: true })) {
        if (entrada.name === 'node_modules' || entrada.name.startsWith('.')) continue;
        const ruta = new URL(`${entrada.name}${entrada.isDirectory() ? '/' : ''}`, dir);
        if (entrada.isDirectory()) {
          if (entrada.name === 'plataforma') continue; // es donde la partición vive a propósito
          barre(ruta);
          continue;
        }
        if (!/\.(jsx?|mjs)$/.test(entrada.name)) continue;
        const texto = readFileSync(ruta, 'utf8');
        if (!/rotulo|rótulo/i.test(texto)) continue;
        for (const bifurcacion of [/Platform\.OS/, /Platform\.select/, /isAndroid/, /isIOS/]) {
          if (bifurcacion.test(texto)) infracciones.push(`${entrada.name} → ${bifurcacion}`);
        }
      }
    };
    barre(raiz);
    assert.deepEqual(infracciones, [], 'la partición por plataforma tiene que vivir solo en app/plataforma/');
  });

  test('El manifiesto declara el servicio en primer plano de Android y la Actividad en Vivo de iOS', () => {
    const manifiesto = JSON.parse(fuente('app/app.json'));

    // Android: el servicio en primer plano con el tipo de ubicación, y su canal.
    const permisos = manifiesto.expo.android.permissions ?? [];
    for (const permiso of ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS']) {
      assert.ok(permisos.includes(permiso), `el manifiesto de Android no declara "${permiso}"`);
    }
    const android = fuente(ANDROID);
    assert.match(android, /tipoDeServicio:\s*'location'/, 'Android no declara el tipo de servicio de ubicación');
    assert.match(android, /canal:/, 'Android no declara su canal de notificación');
    // Una notificación que se puede tirar deslizando deja la app leyendo la ubicación
    // sin decirlo: no es una preferencia.
    assert.match(android, /descartable:\s*false/);

    // iOS: la Actividad en Vivo y el modo de ubicación en segundo plano.
    const infoPlist = manifiesto.expo.ios.infoPlist ?? {};
    assert.equal(infoPlist.NSSupportsLiveActivities, true, 'iOS no declara la Actividad en Vivo');
    assert.deepEqual(infoPlist.UIBackgroundModes, ['location'], 'iOS no declara el modo de ubicación en segundo plano, y solo ese');
    assert.match(fuente(IOS), /actividadEnVivo:\s*true/);
    assert.match(fuente(IOS), /modosDeFondo:.*'location'/);

    // Y ninguna de las dos declara el permiso permanente. Es la exclusión 12, y la
    // mitad de esta fila que se entrega **no declarando** nada.
    // Se mira el código y no los comentarios: los comentarios nombran a propósito lo
    // que NO se declara, que es como una ausencia se documenta.
    for (const ruta of [IOS, ANDROID]) {
      assert.match(fuente(ruta), /permisoPermanente:\s*false/);
      assert.doesNotMatch(codigoSinComentarios(ruta), /ACCESS_BACKGROUND_LOCATION|NSLocationAlways/);
    }
    assert.deepEqual(Object.keys(infoPlist).filter((k) => /^NSLocation/.test(k)), ['NSLocationWhenInUseUsageDescription']);
    assert.equal(permisos.includes('ACCESS_BACKGROUND_LOCATION'), false);
  });

  test('Los literales del rótulo son los mismos en las dos plataformas', () => {
    // Ninguna de las dos escribe texto: los literales los compone el paquete y llegan
    // hechos, que es cómo se garantiza que sean el mismo.
    for (const ruta of [IOS, ANDROID]) {
      const codigo = codigoSinComentarios(ruta);
      assert.doesNotMatch(codigo, /Vas hacia|Andando por|Dar la salida por terminada/, `${ruta} escribe un literal del rótulo por su cuenta`);
    }
    assert.equal(ACCION_DEL_ROTULO.texto, 'Dar la salida por terminada');
    // Y el literal es el que la pantalla A3P1 dibuja, que es por donde Maestro lo
    // localizará en la pantalla de bloqueo de las dos.
    assert.equal(componeRotulo({ destino: 'Monfrida' }).linea, 'Vas hacia Monfrida.');
  });

  test('La salida sigue viva con el móvil bloqueado', () => {
    // La mitad de este escenario que se puede afirmar sin dispositivo: veinte minutos
    // de posiciones sin que nadie toque la app dejan la salida abierta, el rótulo
    // puesto y la línea diciendo hacia dónde se va, sin ninguna cifra. La otra mitad
    // —que el sistema no mate el proceso— es de dispositivo y no se ejecuta aquí.
    const { estado, rotulo } = abierta({ destino: 'Monfrida' });
    for (let minuto = 1; minuto <= 20; minuto++) {
      const paso = recibePosicion(estado, { posicion: posicion(60 * minuto, minuto, 'andando'), tramo: TRAMO_M, rotulo });
      assert.equal(paso.situacion, 'abierta-con-rotulo', `al minuto ${minuto} la salida ya no está abierta`);
      assert.equal(paso.retirada, null);
    }
    assert.equal(situacionDeSalida(estado), 'abierta-con-rotulo');
    assert.equal(rotulo.presente(), true);
    assert.equal(rotulo.linea(), 'Vas hacia Monfrida.');
    assert.doesNotMatch(rotulo.linea(), /\d/, 'el rótulo muestra una cifra');
    // Y nadie ha tocado nada: la única acción tocable sigue siendo una.
    assert.equal(componeRotulo({ destino: 'Monfrida' }).tocables, 1);
  });
});

// ── RF-PRIV-002: un punto no es un histórico ───────────────────────────────────

describe('El estado de la partida no guarda ningún rastro de ubicación', () => {
  test('La única posición declarada es el punto de partida, y es una ruta exacta', () => {
    // RF-PRIV-002 prohíbe el **histórico**, no el ancla: sin el punto de partida la
    // salida no se puede cerrar por regreso después de que el sistema haya matado el
    // proceso — se vuelve a casa andando y el telón no cae. Es una ruta y una sola.
    assert.deepEqual([...POSICIONES_DECLARADAS], ['areas.salidas.salida.partida']);
    assert.equal(POSICIONES_DECLARADAS.length, 1, 'una segunda ruta declarada tiene que verse en su propio diff');
    // Y el motivo está escrito donde vive la excepción, no en otro fichero.
    assert.match(fuente('packages/nucleo/partida/formato.js'), /un punto, no un histórico/);
  });

  test('La ruta declarada pasa y todo lo demás sigue fallando', () => {
    // La exención es de la ruta exacta, no del área: las posiciones de esa misma área
    // que no sean esta siguen fallando, que es lo que impide que declararla se
    // convierta en un permiso para guardar la traza.
    const conElAncla = { areas: { salidas: { salida: { partida: { lat: 42.88, lon: -8.545 } } } } };
    assert.doesNotThrow(() => sinRastroDeUbicacion(conElAncla));

    const prohibidos = [
      { areas: { salidas: { salida: { ultima: { lat: 1, lon: 2 } } } } },
      { areas: { salidas: { salida: { traza: [] } } } },
      { areas: { salidas: { salida: { partidas: { lat: 1, lon: 2 } } } } },
      { areas: { salidas: { partida: { lat: 1, lon: 2 } } } },
      { areas: { otra: { salida: { partida: { lat: 1, lon: 2 } } } } },
      { areas: { salidas: { salida: { recorrido: [{ lat: 1, lon: 2 }] } } } },
      { areas: { salidas: { salida: { capturadoEn: 123 } } } },
    ];
    for (const doc of prohibidos) {
      assert.throws(() => sinRastroDeUbicacion(doc), /RF-PRIV-002|reloj real/, `este documento ha pasado el filtro: ${JSON.stringify(doc)}`);
    }

    // La exención devuelve el subárbol entero, así que lo que cuelgue de `partida` no
    // lo caza este filtro: **lo cierra el esquema del área**, que es la otra mitad del
    // argumento y por eso se afirma aquí al lado. Un histórico colgado del ancla no
    // llega a escribirse.
    const esquema = areaDe('salidas').esquema;
    const conAncla = congelaSalidas(abierta().estado);
    assert.doesNotThrow(() => escribe(conAncla, esquema, 'salidas'));
    const conHistorico = JSON.parse(JSON.stringify(conAncla));
    conHistorico.salida.partida.historico = [{ lat: 1, lon: 2 }];
    assert.throws(() => escribe(conHistorico, esquema, 'salidas'), /historico/, 'el esquema del área deja colgar un histórico del punto de partida');
  });

  test('Lo que la salida escribe en su documento es el punto de partida y ninguna posición más', () => {
    const { estado, rotulo } = abierta();
    recorre(estado, rotulo, [posicion(1500, 20, 'andando'), posicion(2000, 40, 'andando')]);
    const doc = congelaSalidas(estado);

    // Se recorre el documento entero buscando coordenadas: la única que puede haber es
    // la del punto de partida, y está donde se declaró.
    const encontradas = [];
    const busca = (valor, ruta) => {
      if (!valor || typeof valor !== 'object') return;
      if (Array.isArray(valor)) return valor.forEach((v, i) => busca(v, `${ruta}[${i}]`));
      if ('lat' in valor || 'lon' in valor) encontradas.push(ruta);
      for (const clave of Object.keys(valor)) busca(valor[clave], `${ruta}.${clave}`);
    };
    busca(doc, 'salidas');
    assert.deepEqual(encontradas, ['salidas.salida.partida'], 'el documento de la salida guarda más de una posición');
    assert.doesNotThrow(() => sinRastroDeUbicacion({ areas: { salidas: doc } }));
  });
});
