// SPEC-039 · La compactación, que es la palanca de tamaño que SPEC-016 dejó anotada
// para esta fila: sellar un estado y empezar el registro desde el sello.
//
// Dos cosas se afirman aquí y las dos son propiedades, no comportamientos amables:
// **nunca se poda un hecho suelto** —o están todos desde el sello, o está el sello— y
// **una compactación interrumpida deja una partida entera**, porque compactar cambia
// dos claves a la vez y el almacén solo promete la atomicidad de una.
//
// La compactación no tiene escenario en `docs/testing.md`: todo lo de aquí va marcado
// como hueco de batería en el mapa de cobertura. Nada toca la red ni el reloj.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLAVES_DE_COMPACTACION,
  PRESUPUESTO_DE_ESTADO_BYTES,
  PRESUPUESTO_DE_REGISTRO_BYTES,
  compacta,
  medidaDeLaPartida,
  sella,
} from '../../packages/nucleo/partida/compactacion.js';
import * as compactacion from '../../packages/nucleo/partida/compactacion.js';
import { CLAVES_DE_PARTIDA, cargaPartida, guardaPartida, recuperaCompactacion } from '../../packages/nucleo/partida/reconstruccion.js';
import { aplicaHechos } from '../../packages/nucleo/partida/reconstruccion.js';
import { congelaEstado, estadoInicial, levantaEstado, textoDeEstado } from '../../packages/nucleo/partida/estado.js';
import { anexa, congelaRegistro, cuantosHechos, hecho, levantaRegistro, registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { texto as textoCanonico } from '../../packages/nucleo/partida/formato.js';
import { hechosDeUnaSalida } from './diario-de-prueba.mjs';
import { SEMILLA_A, almacenEnMemoria } from './copia-de-prueba.mjs';

const MAPA = '42.41,-8.81';

/** Una partida con un lote de hechos aplicados y guardada. */
async function partidaConSalida({ almacen = almacenEnMemoria(), dia = 1 } = {}) {
  const estado = estadoInicial({ semilla: SEMILLA_A });
  const registro = registroInicial();
  const lote = hechosDeUnaSalida({ mapa: MAPA, dia, paso: dia });
  anexa(registro, lote);
  aplicaHechos(estado, lote.map((h) => hecho(h)));
  await guardaPartida({ estado, registro, almacen });
  return { almacen, estado, registro };
}

/** Anexa otra salida y la deja guardada. */
async function otraSalida({ almacen, estado, registro }, dia) {
  const lote = hechosDeUnaSalida({ mapa: MAPA, dia, paso: dia });
  anexa(registro, lote);
  aplicaHechos(estado, lote.map((h) => hecho(h)));
  await guardaPartida({ estado, registro, almacen });
  return { almacen, estado, registro };
}

/** Un almacén que se cae al escribir **una clave exacta**, para morir en un punto. */
function almacenQueMuereEn(clave, { datos } = {}) {
  const almacen = almacenEnMemoria({ datos });
  const escribe = almacen.escribe.bind(almacen);
  almacen.escribe = async (c, v) => {
    if (c === clave) throw new Error(`el disco está lleno al escribir ${c}`);
    return escribe(c, v);
  };
  return almacen;
}

describe('La compactación, que es la palanca de tamaño', () => {
  test('Sellar un estado deja el registro empezando desde el sello', async () => {
    const partida = await partidaConSalida();
    const antes = cuantosHechos(partida.registro);
    assert.ok(antes > 0, 'la partida de prueba no tiene hechos que sellar');

    const sellado = sella(partida);
    assert.equal(sellado.sellados, antes, 'el sello no declara cuántos hechos absorbió');
    assert.equal(cuantosHechos(sellado.registro), 0, 'el registro no empieza desde el sello');
    assert.equal(sellado.estado.aplicadoHasta, -1, 'el estado sellado no declara que no queda nada por aplicar');
    assert.equal(sellado.registro.reglas, partida.registro.reglas, 'sellar ha perdido las reglas con las que nació el registro');
  });

  test('Compactar sella el estado en el almacén y retira las claves de trabajo', async () => {
    const partida = await partidaConSalida();
    const resultado = await compacta(partida);

    assert.equal(await partida.almacen.lee(CLAVES_DE_COMPACTACION.sello), null, 'ha quedado el sello sin retirar');
    assert.equal(await partida.almacen.lee(CLAVES_DE_COMPACTACION.registroAnterior), null, 'ha quedado el registro anterior sin retirar');
    assert.equal(await partida.almacen.lee(CLAVES_DE_PARTIDA.estado), textoCanonico(congelaEstado(resultado.estado)));
    assert.equal(await partida.almacen.lee(CLAVES_DE_PARTIDA.registro), textoCanonico(congelaRegistro(resultado.registro)));
    assert.ok(resultado.bytes.registroAnterior > resultado.bytes.registro, 'el registro no ha menguado al compactar');
  });

  test('Una partida compactada se reconstruye desde el sello y da lo mismo que sin compactar', async () => {
    // La propiedad entera: sello + hechos posteriores === todos los hechos desde cero.
    const compactada = await partidaConSalida({ dia: 1 });
    const sellado = await compacta(compactada);
    // Vivos y no congelados: lo que devuelve compactar es un documento, y seguir jugando
    // sobre una partida compactada es levantarla otra vez, que es lo que hace la app.
    const estado = levantaEstado(congelaEstado(sellado.estado));
    const registro = levantaRegistro(congelaRegistro(sellado.registro));
    await otraSalida({ almacen: compactada.almacen, estado, registro }, 2);
    const abierta = await cargaPartida({ almacen: compactada.almacen, semilla: SEMILLA_A });

    const entera = await partidaConSalida({ dia: 1 });
    await otraSalida(entera, 2);
    const referencia = await cargaPartida({ almacen: entera.almacen, semilla: SEMILLA_A });

    // Todas las áreas, byte a byte. Lo único que difiere es `aplicadoHasta`, y difiere
    // porque tiene que hacerlo: es la marca de cuántos hechos quedan por delante del
    // sello, y compactar existe justamente para que sean menos.
    const areasDe = (estado) => JSON.stringify(JSON.parse(textoDeEstado(estado)).areas);
    assert.equal(areasDe(abierta.estado), areasDe(referencia.estado), 'la partida compactada no da el mismo estado que la que nunca se compactó');
    assert.ok(abierta.estado.aplicadoHasta < referencia.estado.aplicadoHasta, 'el sello no ha absorbido ningún hecho');
    assert.equal(cuantosHechos(abierta.registro) < cuantosHechos(referencia.registro), true, 'el registro compactado no es más corto: no se ha compactado nada');
  });

  test('Compactar no poda ningún hecho suelto: o están todos desde el sello o está el sello', async () => {
    const partida = await partidaConSalida();

    // Sellar un estado que va por detrás del registro perdería los hechos que le
    // faltan, y por eso no se puede: es la forma que tiene «nunca se poda» de ser
    // comprobable en lugar de ser una promesa.
    const atrasado = { ...partida.estado, aplicadoHasta: 0 };
    assert.throws(() => sella({ estado: atrasado, registro: partida.registro }), /no se puede sellar.*nunca poda hechos/s);
    await assert.rejects(() => compacta({ estado: atrasado, registro: partida.registro, almacen: partida.almacen }), /no se puede sellar/);

    // Y no hay ninguna función de podar en el módulo, que es lo que impide que aparezca.
    assert.deepEqual(Object.keys(compactacion).filter((n) => /poda/i.test(n)), [], 'el módulo de compactación ha estrenado una poda');
  });

  test('Una compactación interrumpida deja el registro anterior entero y ningún sello a medias', async () => {
    const partida = await partidaConSalida();
    const registroAntes = await partida.almacen.lee(CLAVES_DE_PARTIDA.registro);
    const estadoAntes = await partida.almacen.lee(CLAVES_DE_PARTIDA.estado);

    // Se muere justo entre escribir el registro nuevo y escribir el estado sellado,
    // que es la única combinación que no abre.
    const muerto = almacenQueMuereEn(CLAVES_DE_PARTIDA.estado, { datos: partida.almacen.datos });
    await assert.rejects(() => compacta({ estado: partida.estado, registro: partida.registro, almacen: muerto }), /disco está lleno/);

    const recuperada = await recuperaCompactacion({ almacen: partida.almacen });
    assert.deepEqual({ ...recuperada }, { habia: true, resultado: 'deshecha' });
    assert.equal(await partida.almacen.lee(CLAVES_DE_PARTIDA.registro), registroAntes, 'el registro anterior no ha vuelto entero');
    assert.equal(await partida.almacen.lee(CLAVES_DE_PARTIDA.estado), estadoAntes, 'el estado ha cambiado pese a la interrupción');
    assert.equal(await partida.almacen.lee(CLAVES_DE_COMPACTACION.sello), null, 'ha quedado un sello a medias');
    assert.equal(await partida.almacen.lee(CLAVES_DE_COMPACTACION.registroAnterior), null);
  });

  test('Una compactación que llegó a cambiar el estado se remata y no se reproduce dos veces', async () => {
    const partida = await partidaConSalida();
    const sellado = sella(partida);
    const textoDelSello = textoCanonico(congelaEstado(sellado.estado));

    // El punto de compromiso: el estado que hay es idéntico al sello guardado.
    await partida.almacen.escribe(CLAVES_DE_COMPACTACION.sello, textoDelSello);
    await partida.almacen.escribe(CLAVES_DE_COMPACTACION.registroAnterior, textoCanonico(congelaRegistro(partida.registro)));
    await partida.almacen.escribe(CLAVES_DE_PARTIDA.registro, textoCanonico(congelaRegistro(sellado.registro)));
    await partida.almacen.escribe(CLAVES_DE_PARTIDA.estado, textoDelSello);

    const recuperada = await recuperaCompactacion({ almacen: partida.almacen });
    assert.deepEqual({ ...recuperada }, { habia: true, resultado: 'terminada' });
    assert.equal(await partida.almacen.lee(CLAVES_DE_PARTIDA.registro), textoCanonico(congelaRegistro(sellado.registro)), 'recuperar ha devuelto el registro entero sobre un estado ya sellado');
    assert.equal(await partida.almacen.lee(CLAVES_DE_COMPACTACION.sello), null);
  });

  test('Abrir la partida deshace o remata una compactación a medias antes de leer nada', async () => {
    const partida = await partidaConSalida();
    const registroAntes = await partida.almacen.lee(CLAVES_DE_PARTIDA.registro);
    const muerto = almacenQueMuereEn(CLAVES_DE_PARTIDA.estado, { datos: partida.almacen.datos });
    await assert.rejects(() => compacta({ estado: partida.estado, registro: partida.registro, almacen: muerto }), /disco está lleno/);

    // Sin llamar a recuperaCompactacion a mano: abrir la partida ya lo hace, porque una
    // pieza que hay que acordarse de llamar es una pieza que un día no se llama.
    const abierta = await cargaPartida({ almacen: partida.almacen, semilla: SEMILLA_A });
    assert.deepEqual({ ...abierta.compactacion }, { habia: true, resultado: 'deshecha' });
    assert.equal(await partida.almacen.lee(CLAVES_DE_PARTIDA.registro), registroAntes);
    assert.equal(abierta.colaAplicada, 0, 'ha habido que aplicar hechos: la partida no quedó entera');
  });

  test('El presupuesto de SPEC-016 se mide y es el que decide cuándo hay que compactar', async () => {
    const partida = await partidaConSalida();
    const medida = medidaDeLaPartida(partida);

    assert.equal(PRESUPUESTO_DE_REGISTRO_BYTES, 6 * 1024 * 1024, 'el presupuesto del registro no es el de SPEC-016');
    assert.equal(PRESUPUESTO_DE_ESTADO_BYTES, 2 * 1024 * 1024, 'el presupuesto del estado no es el de SPEC-016');
    assert.deepEqual({ ...medida.presupuesto }, { estado: PRESUPUESTO_DE_ESTADO_BYTES, registro: PRESUPUESTO_DE_REGISTRO_BYTES });
    assert.equal(medida.hechos, cuantosHechos(partida.registro));
    assert.equal(medida.pasaElPresupuesto, false, 'una partida de una salida no puede pasar del presupuesto');

    // Y la medida crece con los hechos: si no, no estaría midiendo el registro.
    await otraSalida(partida, 2);
    assert.ok(medidaDeLaPartida(partida).registro > medida.registro, 'el registro no crece al anexar hechos');

    // Compactar es la palanca: después de sellar, el registro mide menos.
    const despues = await compacta(partida);
    assert.ok(medidaDeLaPartida(despues).registro < medida.registro, 'compactar no ha reducido el registro');
  });

  test('Sin almacén inyectado no se compacta ni se recupera nada', async () => {
    const partida = await partidaConSalida();
    await assert.rejects(() => compacta({ estado: partida.estado, registro: partida.registro }), /almac[eé]n/i);
    await assert.rejects(() => recuperaCompactacion({}), /almac[eé]n/i);
  });
});
