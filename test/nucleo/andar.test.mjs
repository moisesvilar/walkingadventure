// SPEC-041 · Andar por los mapas de la partida desde dentro del móvil: qué mapa toca
// donde estás, qué pasa al pisar una celda vecina y qué se dice cuando no se puede abrir.
//
// Es la mitad que vive en `app/mapa/levantamiento.js` y no en el paquete, porque
// encadenar consulta, generación y escritura es la frontera. Se ejercita desde Node y
// sin simulador por lo mismo que el resto de la orquestación: el generador entra por la
// puerta, así que estas pruebas no resuelven ningún especificador instalado.
//
// Nada de aquí toca la red ni el reloj: el traedor sirve extractos congelados, el
// almacén es el de memoria y el cronómetro es el inyectable de `test/dobles/`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DEL_NUCLEO_PARA_ANDAR } from '../../app/mapa/levantamiento.js';
import { ESTADOS_DE_APERTURA, SIN_MAPA_ACTIVO } from '../../packages/nucleo/partida/mapas.js';
import { celdasAbiertas } from '../../packages/nucleo/partida/mapa.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { proyectorDeRejilla } from '../../packages/nucleo/world/rejilla.js';
import { creaMotorDePasos, estadoDePasos } from '../../packages/nucleo/partida/pasos.js';
import { consultaQueFalla, coordenadaDe } from './celda-de-prueba.mjs';
import {
  NUCLEO_DEL_LEVANTAMIENTO,
  NUCLEO_PARA_ANDAR,
  SEMILLA_DE_PRUEBA,
  TAMANO,
  TRAMO_M,
  levantaFixture,
  montaLevantamiento,
} from './levantamiento-de-prueba.mjs';

const CASA = 'costero';
const VACACIONES = 'barrio-tres-calles';

/** Un levantamiento con las piezas de andar cableadas, y su mapa de casa ya levantado. */
async function conMapaDeCasa(opciones = {}) {
  return levantaFixture(CASA, { nucleo: NUCLEO_PARA_ANDAR, ...opciones });
}

/** La coordenada de un punto en metros desde el anclaje de un mapa levantado. */
function puntoEn(mapa, x, y) {
  return proyectorDeRejilla(mapa.rejilla).toLatLon({ x, y });
}

describe('El mapa activo dentro del móvil', () => {
  test('El mapa activo lo decide dónde estás', async () => {
    const banco = await conMapaDeCasa();
    // El segundo mapa se levanta en el mismo almacén y con el mismo traedor de
    // vacaciones: son dos mapas de la misma partida.
    const otro = await levantaFixture(VACACIONES, { nucleo: NUCLEO_PARA_ANDAR, almacen: banco.almacen });

    const enCasa = await banco.levantamiento.mapaActivo({ ...coordenadaDe(CASA), semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M });
    assert.equal(enCasa.mapaId, banco.resultado.mapaId, 'abriendo la app en casa no se abre el mapa de casa');
    assert.equal(enCasa.mapas.length, 2, 'la resolución no ha mirado los dos mapas de la partida');

    const deVacaciones = await banco.levantamiento.mapaActivo({ ...coordenadaDe(VACACIONES), semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M });
    assert.equal(deVacaciones.mapaId, otro.resultado.mapaId, 'abriendo la app de vacaciones no se abre el de vacaciones');

    // Y lejos de los dos no hay ninguno, que no es un error: es lo que se contesta con
    // el ofrecimiento de levantar uno.
    const lejos = await banco.levantamiento.mapaActivo({ ...coordenadaDe('urbano-denso'), semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M });
    assert.equal(lejos.mapaId, SIN_MAPA_ACTIVO);
    assert.equal(lejos.mapa, null);

    // Resolver no ha generado nada ni ha consultado a nadie: saber dónde estás no
    // cuesta un documento de mundo por mapa.
    const recuento = banco.levantamiento.recuento();
    assert.equal(recuento.generaciones, 1, 'resolver el mapa activo ha generado un mundo');
  });

  test('Los mapas de la partida se listan con lo que cada uno declara', async () => {
    const banco = await conMapaDeCasa();
    await levantaFixture(VACACIONES, { nucleo: NUCLEO_PARA_ANDAR, almacen: banco.almacen });

    const pasos = estadoDePasos();
    creaMotorDePasos({ semilla: SEMILLA_DE_PRUEBA, mapaId: banco.resultado.mapaId, estado: pasos }).avanza(3);

    const mapas = await banco.levantamiento.mapasDeLaPartida({ pasos });
    assert.equal(mapas.length, 2);
    assert.equal(mapas.find((m) => m.id === banco.resultado.mapaId).pasos, 3, 'el contador que declara el mapa no es el suyo');
    for (const m of mapas) assert.ok(m.titulo, `el mapa ${m.id} llega sin título con el que titular su capítulo del diario`);
  });
});

describe('Abrir una celda vecina desde el móvil', () => {
  test('Abrir una celda vecina no toca la celda propia', async () => {
    const banco = await conMapaDeCasa();
    const mapa = banco.resultado.mapa;
    const propia = celdasAbiertas(mapa)[0];
    const antes = textoDeCelda(propia);
    const consultasAntes = banco.consultaOsm.llamadas.length;

    const estados = [];
    const cruce = puntoEn(mapa, mapa.rejilla.ladoM, 0);
    const resultado = await banco.levantamiento.anda({
      mapa,
      ...cruce,
      tramoM: TRAMO_M,
      onApertura: (estado) => estados.push(estado),
    });

    assert.equal(resultado.generada, true, 'pisar una celda cerrada no la ha abierto');
    assert.equal(resultado.apertura, 'abierta');
    assert.deepEqual(estados, ['abriendo', 'abierta'], 'el estado de la apertura no ha recorrido el vocabulario cerrado');
    for (const estado of estados) assert.ok(ESTADOS_DE_APERTURA.includes(estado), `"${estado}" no está en el vocabulario de celda-apertura`);
    assert.equal(textoDeCelda(propia), antes, 'abrir la vecina ha cambiado el documento de la celda propia');
    assert.ok(banco.consultaOsm.llamadas.length > consultasAntes, 'abrir una celda nueva no ha pedido datos');

    // Y volver a pisarla se lee del almacén: ni una consulta más, y nada que enseñar.
    const consultasTrasAbrir = banco.consultaOsm.llamadas.length;
    const otraVez = [];
    const segunda = await banco.levantamiento.anda({ mapa, ...cruce, tramoM: TRAMO_M, onApertura: (e) => otraVez.push(e) });
    assert.equal(segunda.generada, false, 'se ha regenerado una celda ya abierta');
    assert.equal(segunda.apertura, 'inactiva', 'pisar una celda ya abierta tiene que dejar la apertura inactiva');
    assert.deepEqual(otraVez, ['inactiva']);
    assert.equal(banco.consultaOsm.llamadas.length, consultasTrasAbrir, 'volver a pisar una celda abierta ha consultado OSM');
  });

  test('La apertura de una celda sin conexión no deja media celda', async () => {
    const banco = await conMapaDeCasa();
    const mapa = banco.resultado.mapa;
    const abiertas = celdasAbiertas(mapa).length;
    const enElAlmacen = banco.almacen.volcado().length;

    // El traedor se cae a partir de aquí: no hay documento a medias ni celda registrada.
    const caido = montaLevantamiento({ consultaOsm: consultaQueFalla(), almacen: banco.almacen, nucleo: NUCLEO_PARA_ANDAR });
    const estados = [];
    const resultado = await caido.levantamiento.anda({
      mapa,
      ...puntoEn(mapa, mapa.rejilla.ladoM, 0),
      tramoM: TRAMO_M,
      onApertura: (e) => estados.push(e),
    });

    assert.equal(resultado.apertura, 'no-se-pudo', 'una apertura que falla tiene que decirlo con su palabra del vocabulario');
    assert.equal(resultado.registro, null, 'ha quedado media celda');
    assert.deepEqual(estados, ['abriendo', 'no-se-pudo']);
    assert.equal(celdasAbiertas(mapa).length, abiertas, 'ha quedado registrada una celda que no llegó a existir');
    assert.equal(banco.almacen.volcado().length, enElAlmacen, 'una apertura que falló ha escrito algo en el almacén');
  });

  test('La vecina que se abre como acontecimiento sale de la semilla', async () => {
    const una = await conMapaDeCasa();
    const otra = await conMapaDeCasa();
    const evento = await una.levantamiento.completa({ mapa: una.resultado.mapa, celda: { i: 0, j: 0 }, tramoM: TRAMO_M });
    const repetido = await otra.levantamiento.completa({ mapa: otra.resultado.mapa, celda: { i: 0, j: 0 }, tramoM: TRAMO_M });

    assert.equal(evento.apertura, 'abierta', 'completar la celda no ha abierto ninguna vecina');
    assert.equal(evento.registro.motivo, 'acontecimiento', 'la celda abierta por acontecimiento no registra su motivo');
    assert.equal(repetido.registro.clave, evento.registro.clave, 'dos ejecuciones iguales han abierto vecinas distintas');
    assert.equal(textoDeCelda(repetido.registro), textoDeCelda(evento.registro), 'la misma vecina no ha salido idéntica byte a byte');
  });

  test('Sin las piezas de andar la orquestación lo dice nombrando las que faltan', async () => {
    // La otra mitad de §6h: un núcleo a medias no degrada en silencio. Se comprueba al
    // usarse y no al construir, porque pintar una lámina ya levantada no necesita nada
    // de esto y exigírselo dejaría sin arrancar a quien solo quiere dibujar.
    const banco = await levantaFixture(CASA, { nucleo: NUCLEO_DEL_LEVANTAMIENTO });
    assert.equal(banco.resultado.estado, 'pintado', 'sin las piezas de andar tampoco se ha podido levantar y pintar');

    await assert.rejects(
      () => banco.levantamiento.mapaActivo({ ...coordenadaDe(CASA), semilla: SEMILLA_DE_PRUEBA, tramoM: TRAMO_M }),
      (e) => DEL_NUCLEO_PARA_ANDAR.every((pieza) => e.message.includes(pieza)) && /mapa activo/.test(e.message),
      'resolver el mapa activo sin las piezas tenía que fallar enumerándolas',
    );
    await assert.rejects(
      () => banco.levantamiento.anda({ mapa: banco.resultado.mapa, ...coordenadaDe(CASA), tramoM: TRAMO_M }),
      (e) => e.message.includes('resuelvePosicion'),
    );
    assert.throws(() => banco.levantamiento.estadosDeApertura(), /ESTADOS_DE_APERTURA/);
  });
});

describe('La lámina que se pinta sigue siendo la del mundo congelado', () => {
  test('Andar por un mapa no vuelve a generar la celda que ya estaba', async () => {
    const banco = await conMapaDeCasa();
    const mapa = banco.resultado.mapa;
    const generacionesAntes = banco.levantamiento.recuento().generaciones;

    // Dentro de la celda del anclaje, a un cuarto del lado: la misma celda de siempre.
    const dentro = puntoEn(mapa, mapa.rejilla.ladoM / 4, 0);
    const resultado = await banco.levantamiento.anda({ mapa, ...dentro, tramoM: TRAMO_M });
    assert.equal(resultado.generada, false, 'andar dentro de la celda propia la ha regenerado');
    assert.equal(banco.levantamiento.recuento().generaciones, generacionesAntes, 'se ha llamado al generador para una celda que ya estaba');

    // Y la escena se sigue pintando del documento, sin pasar por el traedor.
    const escena = banco.levantamiento.pinta({ documento: resultado.registro.mundo, camara: banco.resultado.camara, tamano: TAMANO });
    assert.ok(escena.primitivas.length > 0, 'la lámina del mundo congelado no se ha pintado');
  });
});
