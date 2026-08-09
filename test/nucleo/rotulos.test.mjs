// SPEC-022 · La colocación de rótulos: ninguno pisa a otro, y lo que se sacrifica
// cuando no caben todos.
//
// Se afirma en dos alturas, y las dos hacen falta:
//
//   1 · Contra `core/rotulos.js` con un **medidor de mentira** declarado y estable —un
//       ancho por letra y un alto por rol— y un estilo de mentira con las cinco
//       métricas que la colocación lee. Es lo que permite construir el conflicto
//       exacto que cada criterio describe: un racimo que no cabe, dos protegidos que
//       se disputan el único hueco, un texto más ancho que el marco. Sin medidor de
//       mentira estos casos dependerían de qué fuentes tenga la máquina.
//   2 · Contra escenas de verdad, componiendo los cuatro mundos congelados con los
//       cinco estilos y el colocador real. Es donde «ninguna pareja se solapa» deja
//       de ser una propiedad de un caso inventado y pasa a ser una propiedad del mapa.
//
// Escenarios de docs/testing.md que se reutilizan aquí, con su nombre literal: los
// ocho de la característica «Ningún rótulo del mapa pisa a otro», que cerró el hueco
// de RF-MAPA-003, más «Cambiar el estilo de pintado no resiembra nada» (@determinismo,
// bloqueante), del que esta fila sostiene la mitad que faltaba —recolocar es pintar—.
//
// El resto de criterios de la spec no tienen escenario en la batería y van marcados
// como hueco declarado en test/spec-test-map.json. Los dos escenarios @manual que la
// spec propone —el mapa del día uno con siete núcleos, y pueblo y paraje distinguidos
// sin leer el nombre— no están en docs/testing.md y no se automatizan aquí: el primero
// además no es afirmable tal cual, porque las granjas no llevan rótulo y el máximo por
// mundo son cuatro rótulos de núcleo, no siete.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CRECIMIENTO_MAXIMO,
  HOLGURA,
  LARGO_MINIMO_DE_TRAZADO,
  MOTIVOS,
  PASO_DE_ZOOM,
  POSICIONES,
  PRESUPUESTO_DE_COMPROBACIONES,
  PRIORIDAD_DE_ROL,
  REJILLA_DE_CENTRO,
  SEPARACION_BASE,
  TOPE_DE_CANDIDATOS,
  TOPE_DE_TIRADOR,
  colocarRotulos,
  comparaCandidatos,
  cuantizaEncuadre,
  tamanoDeCaja,
  vaSobrePlaca,
} from '../../packages/nucleo/core/rotulos.js';
import { cajaDentroDe, creaCaja, diagonalDeCaja, envolventeDeCaja, seSolapan } from '../../packages/nucleo/core/cajas.js';
import { componeEscena } from '../../packages/nucleo/render/escena.js';
import { ESTILOS, ESTILO_POR_DEFECTO, estiloParaLamina } from '../../packages/nucleo/render/estilos.js';
import { COLOCADOR, colocadorDeRotulos } from '../../packages/nucleo/render/colocador.js';
import { medidorNominal } from '../../packages/nucleo/render/medidor-nominal.js';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { LOS_CUATRO, generaMundo, semillaDe } from './mundo-de-prueba.mjs';

// ── el andamiaje de mentira ─────────────────────────────────────────────────────

/** El hueco de una pantalla de móvil, que es donde vive la lámina. */
const TAMANO = { ancho: 390, alto: 780 };

/** Un ancho por letra y un alto por rol: declarado, estable y del todo independiente
 *  de qué tipografías tenga la máquina. Es lo que hace que estos casos afirmen
 *  geometría y no metrología. */
const ANCHO_POR_LETRA = 10;
const ALTO_POR_ROL = Object.freeze({ nucleo: 20, paraje: 12, servicio: 14, calzada: 12 });

function medidorDeMentira(texto, rol) {
  return { ancho: [...texto].length * ANCHO_POR_LETRA, alto: ALTO_POR_ROL[rol] ?? 12 };
}

/** El medidor plano: todos los rótulos miden lo mismo, valga el rol que valga. Solo lo
 *  usan los casos del racimo, donde lo que se afirma es el **orden** del sacrificio y
 *  cajas de tamaños distintos lo enturbiarían. */
function medidorPlano() {
  return { ancho: 30, alto: 12 };
}

/** El estilo de mentira: solo las métricas que la colocación lee. Ni un color. */
const ESTILO_DE_MENTIRA = Object.freeze({
  id: 'de-mentira',
  label: Object.freeze({ placa: Object.freeze(['nucleo']), haloW: 4, tracking: 0 }),
  placa: Object.freeze({ padX: 6, padY: 4, lw: 1 }),
});

/** El mismo estilo sin ninguna placa: todos los roles se resuelven con halo. */
const ESTILO_SIN_PLACA = Object.freeze({
  id: 'sin-placa',
  label: Object.freeze({ placa: Object.freeze([]), haloW: 4, tracking: 0 }),
  placa: null,
});

const MARCO = Object.freeze({ modo: 'rect', x0: 0, y0: 0, x1: 400, y1: 800 });
const LIENZO = Object.freeze({ ancho: 400, alto: 800 });

function marcoDe(x1, y1) {
  return { modo: 'rect', x0: 0, y0: 0, x1, y1 };
}

function coloca(candidatos, opciones = {}) {
  const {
    marco = MARCO, estilo = ESTILO_DE_MENTIRA, medidor = medidorDeMentira,
    glifos = [], reservadas = [], lienzo = LIENZO,
  } = opciones;
  return colocarRotulos({ candidatos, encuadre: { lienzo, marco }, estilo, medidor, glifos, reservadas });
}

function candidato(id, rol, x, y, extra = {}) {
  return { id, rol, texto: 'Abc', ancla: { x, y }, radio: 4, ...extra };
}

/** Un estorbo del tamaño y en el sitio que se pida, como zona reservada. */
function estorbo(nombre, cx, cy, ancho, alto) {
  return { nombre, caja: { cx, cy, ancho, alto, rot: 0 } };
}

/** Todas las parejas de cajas que se pisan, con la holgura que exige el criterio. */
function parejasQueSePisan(cajas) {
  const pares = [];
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      if (seSolapan(cajas[i].caja, cajas[j].caja, HOLGURA)) pares.push(`${cajas[i].id} ↔ ${cajas[j].id}`);
    }
  }
  return pares;
}

function porId(lista) {
  return new Map(lista.map((x) => [x.id, x]));
}

// ── las escenas de verdad ───────────────────────────────────────────────────────

const cache = new Map();
async function documentoDe(nombre, s = '1') {
  const clave = `${nombre}#${s}`;
  if (!cache.has(clave)) cache.set(clave, await generaMundo(nombre, semillaDe(nombre, s)));
  return cache.get(clave);
}

/**
 * Compone una escena con el colocador real y devuelve, además de la escena, lo que
 * la composición le pasó: los glifos, las zonas reservadas y el marco. Sin eso no se
 * puede afirmar «ninguna caja pisa un glifo» sobre un mundo de verdad, porque la
 * escena no publica los obstáculos que consumió.
 */
function componeConDeclutter(documento, estiloId = ESTILO_POR_DEFECTO, extra = {}) {
  const visto = {};
  const medidas = [];
  const medidor = (texto, tipografia) => {
    medidas.push(texto);
    return medidorNominal(texto, tipografia);
  };
  const escena = componeEscena({
    documento,
    estilo: estiloId,
    tamano: extra.tamano ?? TAMANO,
    medidor,
    colocador: (rotulos, contexto) => {
      visto.rotulos = rotulos;
      visto.contexto = contexto;
      visto.medidasAlColocar = medidas.length;
      const salida = colocadorDeRotulos(rotulos, contexto);
      visto.salida = salida;
      return salida;
    },
    ...extra,
  });
  return { escena, medidas, ...visto };
}

/** Las cajas ya colocadas de una escena, listas para comprobarse dos a dos. */
function cajasDe(escena) {
  return escena.colocacion.map((c) => ({ id: c.id, rol: c.rol, caja: c.caja }));
}

/** Los cuatro mundos por su primera semilla, con los cinco estilos: la muestra sobre
 *  la que se miden la salud y el coste, y la misma que midió quien implementó. */
const LA_MUESTRA = [];
async function muestra() {
  if (LA_MUESTRA.length) return LA_MUESTRA;
  for (const nombre of LOS_CUATRO) {
    const documento = await documentoDe(nombre, '1');
    for (const estilo of ESTILOS) {
      LA_MUESTRA.push({ nombre, estilo: estilo.id, ...componeConDeclutter(documento, estilo.id) });
    }
  }
  return LA_MUESTRA;
}

// ════════════════════════════════════════════════════════════════════════════════
// Los ocho escenarios de la batería, con su nombre literal
// ════════════════════════════════════════════════════════════════════════════════

describe('Ningún rótulo del mapa pisa a otro', () => {
  test('Ninguna pareja de rótulos se solapa en un mundo denso', async () => {
    // El escenario habla del urbano denso con el estilo por defecto, que es el caso
    // que lo motiva; se afirma además sobre los cuatro mundos y los cinco estilos,
    // porque una propiedad binaria que solo se comprueba en un mundo no es una
    // propiedad, es una anécdota.
    const denso = componeConDeclutter(await documentoDe('urbano-denso', '1'), ESTILO_POR_DEFECTO);
    assert.ok(denso.escena.colocacion.length > 0, 'el mundo urbano denso no ha colocado ni un rótulo');
    assert.deepEqual(parejasQueSePisan(cajasDe(denso.escena)), [], 'dos rótulos se pisan en el mundo urbano denso');

    for (const caso of await muestra()) {
      assert.deepEqual(
        parejasQueSePisan(cajasDe(caso.escena)), [],
        `dos rótulos se pisan en ${caso.nombre} con el estilo ${caso.estilo}`,
      );
    }
  });

  test('Ningún rótulo pisa un glifo ni la cartela ni la brújula', async () => {
    for (const caso of await muestra()) {
      const obstaculos = [
        ...caso.contexto.glifos.map((g) => ({ id: `glifo ${g.id}`, caja: g.caja })),
        ...caso.contexto.reservadas.map((z) => ({ id: `zona ${z.nombre}`, caja: z.caja })),
      ];
      // La cartela sale en los cinco estilos; la brújula, en los que no la pintan
      // detrás del papel. Que la lista no venga vacía es parte de lo que se afirma:
      // si dejara de reservarse, la comprobación pasaría sin comprobar nada.
      assert.ok(
        caso.contexto.reservadas.some((z) => z.nombre === 'cartela'),
        `la escena de ${caso.nombre} con ${caso.estilo} no reserva la cartela`,
      );
      for (const puesto of cajasDe(caso.escena)) {
        for (const obstaculo of obstaculos) {
          assert.equal(
            seSolapan(puesto.caja, obstaculo.caja, HOLGURA), false,
            `el rótulo "${puesto.id}" pisa ${obstaculo.id} en ${caso.nombre} con ${caso.estilo}`,
          );
        }
      }
    }
  });

  test('Ningún rótulo se sale del marco', async () => {
    for (const caso of await muestra()) {
      for (const puesto of cajasDe(caso.escena)) {
        assert.ok(
          cajaDentroDe(puesto.caja, caso.contexto.marco),
          `el rótulo "${puesto.id}" se sale del marco en ${caso.nombre} con ${caso.estilo}`,
        );
      }
    }
    // Y el motivo existe de verdad: un texto más ancho que el marco entero no se pinta
    // recortado, se retira diciéndolo.
    const enorme = coloca([candidato('nucleo:0', 'nucleo', 200, 400, { texto: 'A'.repeat(60), rango: 'ciudad' })]);
    assert.deepEqual(enorme.colocados, []);
    assert.equal(enorme.retirados[0].motivo, MOTIVOS.noCabeEnElMarco);
  });

  test('El rótulo de un núcleo no se retira mientras quepa en algún sitio', async () => {
    // Un núcleo y un paraje se disputan el mismo hueco: el que se queda con él es el
    // núcleo, porque va antes en la tupla de prioridad.
    const disputa = coloca([
      candidato('paraje:0', 'paraje', 200, 400),
      candidato('nucleo:0', 'nucleo', 200, 400, { rango: 'pueblo' }),
    ]);
    const puestos = porId(disputa.colocados);
    assert.ok(puestos.has('nucleo:0'), 'el núcleo se ha quedado sin nombre teniendo dónde ponerlo');
    assert.equal(puestos.get('nucleo:0').posicion, POSICIONES[0], 'el núcleo no se ha quedado con la posición preferida');
    assert.deepEqual(disputa.retirados, [], 'se ha retirado algo teniendo sitio los dos');

    // Y con las ocho posiciones ocupadas todavía queda el tirador: mientras exista
    // alguna colocación posible, un núcleo no se calla.
    const cercado = coloca(
      [candidato('nucleo:0', 'nucleo', 200, 400, { radio: 6, rango: 'pueblo' })],
      { reservadas: [estorbo('cerco', 200, 400, 110, 82)] },
    );
    assert.equal(cercado.retirados.length, 0, 'un núcleo cercado se ha retirado en lugar de alejarse con tirador');
    assert.ok(cercado.colocados[0].alejado > 0, 'el núcleo cercado no se ha alejado');
  });

  test('Cuando dos no caben, se retira el de menor prioridad y su pueblo se sigue dibujando', async () => {
    // Dos protegidos en un marco donde solo cabe una placa, ni reubicada ni alejada.
    // El identificador del de rango mayor va **después** en orden lexicográfico a
    // propósito: lo que decide es el rango, no el nombre ni el orden de la lista.
    const marco = marcoDe(60, 60);
    const resultado = coloca([
      candidato('nucleo:a-aldea', 'nucleo', 30, 15, { radio: 3, rango: 'aldea' }),
      candidato('nucleo:z-ciudad', 'nucleo', 30, 15, { radio: 3, rango: 'ciudad' }),
    ], { marco });
    assert.deepEqual(resultado.colocados.map((c) => c.id), ['nucleo:z-ciudad'], 'no se ha quedado el de rango mayor');
    assert.deepEqual(
      resultado.retirados.map((r) => ({ id: r.id, motivo: r.motivo })),
      [{ id: 'nucleo:a-aldea', motivo: MOTIVOS.sinHueco }],
      'el retirado no declara su identificador y su motivo',
    );

    // Y su glifo se dibuja igual: lo que se pierde es el nombre en la lámina, no el
    // pueblo. En una escena de verdad, el elemento retirado sigue teniendo su bulto
    // entre los glifos que se pintaron.
    for (const caso of await muestra()) {
      for (const retirado of caso.escena.retirados) {
        if (retirado.rol === 'calzada') continue; // una calzada es un trazo, no un bulto
        assert.ok(
          caso.contexto.glifos.some((g) => g.id === retirado.id),
          `el elemento "${retirado.id}" perdió su glifo al perder su nombre (${caso.nombre}, ${caso.estilo})`,
        );
      }
    }
  });

  test('Ningún rótulo se encoge ni se recorta para caber', async () => {
    // El mismo rótulo, solo y en conflicto: la caja mide lo mismo y el texto es el
    // mismo. No se encoge —el tamaño es la jerarquía— y no se abrevia.
    const texto = 'Vilanova';
    const solo = coloca([candidato('nucleo:0', 'nucleo', 200, 400, { texto, rango: 'pueblo' })]);
    const enConflicto = coloca(
      [candidato('nucleo:0', 'nucleo', 200, 400, { texto, radio: 6, rango: 'pueblo' })],
      { reservadas: [estorbo('cerco', 200, 400, 160, 90)] },
    );
    assert.equal(enConflicto.colocados.length, 1, 'el rótulo en conflicto no llegó a colocarse');
    assert.equal(enConflicto.colocados[0].caja.ancho, solo.colocados[0].caja.ancho, 'la caja se ha encogido de ancho');
    assert.equal(enConflicto.colocados[0].caja.alto, solo.colocados[0].caja.alto, 'la caja se ha encogido de alto');
    assert.equal(enConflicto.colocados[0].texto, texto, 'el texto se ha recortado');

    // Y en las escenas de verdad, la caja de cada rótulo es la que pide su estilo:
    // ni un texto abreviado, ni una caja que no case con lo que se midió.
    for (const caso of await muestra()) {
      const medidos = porId(caso.rotulos);
      for (const puesto of caso.escena.colocacion) {
        const original = medidos.get(puesto.id);
        assert.ok(original, `el colocador devolvió un rótulo que no se le dio: ${puesto.id}`);
        assert.equal(puesto.caja.ancho >= original.medida.ancho, true, `la caja de "${puesto.id}" es más estrecha que su texto`);
        assert.equal(/[…]|\.\.\./.test(original.texto), false, `el texto de "${puesto.id}" viene abreviado: ${original.texto}`);
      }
    }
  });

  test('La misma colocación para el mismo mundo, el mismo estilo y el mismo encuadre', async () => {
    for (const nombre of LOS_CUATRO) {
      const documento = await documentoDe(nombre, '1');
      const una = componeConDeclutter(documento, ESTILO_POR_DEFECTO);
      const otra = componeConDeclutter(documento, ESTILO_POR_DEFECTO);
      assert.equal(
        JSON.stringify(una.escena.colocacion), JSON.stringify(otra.escena.colocacion),
        `dos colocaciones del mismo encuadre difieren en ${nombre}`,
      );
      assert.equal(JSON.stringify(una.escena.retirados), JSON.stringify(otra.escena.retirados));
    }
  });

  test('El orden de los candidatos no cambia la colocación', async () => {
    for (const caso of await muestra()) {
      const alReves = colocadorDeRotulos(caso.rotulos.slice().reverse(), caso.contexto);
      const ordena = (lista) => lista.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      assert.equal(
        JSON.stringify(ordena(alReves.colocados)), JSON.stringify(ordena(caso.salida.colocados)),
        `invertir la lista de candidatos ha cambiado la colocación en ${caso.nombre} con ${caso.estilo}`,
      );
      assert.equal(JSON.stringify(ordena(alReves.retirados)), JSON.stringify(ordena(caso.salida.retirados)));
    }

    // Y en el núcleo, con la lista barajada de forma declarada: el orden de proceso
    // sale de la prioridad y del identificador, nunca del orden de inserción.
    const lista = [
      candidato('nucleo:0', 'nucleo', 100, 100, { rango: 'pueblo' }),
      candidato('paraje:0', 'paraje', 105, 100),
      candidato('servicio:0', 'servicio', 100, 110),
      candidato('calzada:0', 'calzada', 110, 110),
      candidato('nucleo:1', 'nucleo', 108, 104, { rango: 'aldea' }),
    ];
    const derecho = coloca(lista);
    for (const permutacion of [lista.slice().reverse(), [lista[2], lista[4], lista[0], lista[3], lista[1]]]) {
      const otro = coloca(permutacion);
      assert.equal(JSON.stringify(otro.colocados), JSON.stringify(derecho.colocados), 'la permutación ha cambiado la colocación');
      assert.equal(JSON.stringify(otro.retirados), JSON.stringify(derecho.retirados), 'la permutación ha cambiado lo retirado');
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Lo generado no se resiembra jamás — la mitad que sostiene esta fila
// ════════════════════════════════════════════════════════════════════════════════

describe('Lo generado no se resiembra jamás', () => {
  test('Cambiar el estilo de pintado no resiembra nada', async () => {
    // Recolocar es pintar, y pintar jamás resiembra. La otra mitad —que la geometría
    // del terreno no se mueve al repintar— la afirma test/nucleo/render.test.mjs; la
    // que se añade aquí es que el declutter recoloca con las métricas del estilo nuevo
    // y el documento sigue idéntico byte a byte.
    const documento = await documentoDe('costero', '1');
    const antes = JSON.stringify(documento);

    const reino = componeConDeclutter(documento, 'reino');
    const pergamino = componeConDeclutter(documento, 'pergamino');

    assert.equal(JSON.stringify(documento), antes, 'recolocar con otro estilo ha tocado el documento de celda');
    assert.equal(reino.escena.documentoId, pergamino.escena.documentoId);

    // Las métricas de caja son distintas —reino rotula sobre placa y pergamino no—,
    // así que las colocaciones pueden diferir; lo que no puede es que alguna se pise.
    assert.notEqual(vaSobrePlaca(reino.contexto.estilo, 'nucleo'), vaSobrePlaca(pergamino.contexto.estilo, 'nucleo'));
    for (const caso of [reino, pergamino]) assert.deepEqual(parejasQueSePisan(cajasDe(caso.escena)), []);

    // Y volver a reino da exactamente lo de antes: el estilo es una preferencia de
    // pintado y no deja rastro en la colocación siguiente.
    const devuelta = componeConDeclutter(documento, 'reino');
    assert.equal(JSON.stringify(devuelta.escena.colocacion), JSON.stringify(reino.escena.colocacion));
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Ninguna caja pisa a otra — los criterios que la batería no nombra
// ════════════════════════════════════════════════════════════════════════════════

describe('Ninguna caja pisa a otra', () => {
  test('Entre cualquier par hay al menos la holgura mínima, y dos cajas que se tocan cuentan como que se pisan', () => {
    assert.equal(HOLGURA, 2, 'la holgura declarada ha cambiado sin que nadie lo diga');
    const a = creaCaja(0, 0, 20, 10, 0);
    assert.equal(seSolapan(a, creaCaja(20, 0, 20, 10, 0), HOLGURA), true, 'dos cajas que se tocan no cuentan como que se pisan');
    assert.equal(seSolapan(a, creaCaja(21.9, 0, 20, 10, 0), HOLGURA), true, 'dos cajas a menos de la holgura no cuentan como que se pisan');
    assert.equal(seSolapan(a, creaCaja(22.1, 0, 20, 10, 0), HOLGURA), false);
  });

  test('Ningún rótulo pisa el glifo de su propio elemento ni el de ningún otro', () => {
    const glifos = [
      { id: 'nucleo:0', caja: { cx: 200, cy: 400, ancho: 24, alto: 24, rot: 0 } },
      { id: 'paraje:0', caja: { cx: 230, cy: 400, ancho: 20, alto: 20, rot: 0 } },
    ];
    const resultado = coloca([
      candidato('nucleo:0', 'nucleo', 200, 400, { glifo: glifos[0].caja, rango: 'pueblo' }),
      candidato('paraje:0', 'paraje', 230, 400, { glifo: glifos[1].caja }),
    ], { glifos });
    assert.equal(resultado.colocados.length, 2, 'no se han colocado los dos rótulos');
    for (const puesto of resultado.colocados) {
      for (const glifo of glifos) {
        assert.equal(seSolapan(puesto.caja, glifo.caja, HOLGURA), false, `"${puesto.id}" pisa el glifo "${glifo.id}"`);
      }
    }
  });

  test('Ninguna caja invade una zona reservada', () => {
    const reservadas = [
      estorbo('cartela', 200, 40, 300, 60),
      estorbo('brujula', 350, 100, 70, 70),
      estorbo('escala', 100, 760, 220, 60),
      estorbo('marca', 200, 400, 36, 36),
    ];
    const candidatos = [];
    for (let i = 0; i < 40; i++) {
      candidatos.push(candidato(`paraje:${i}`, 'paraje', 30 + (i % 8) * 45, 40 + Math.floor(i / 8) * 150));
    }
    const resultado = coloca(candidatos, { reservadas });
    for (const puesto of resultado.colocados) {
      for (const zona of reservadas) {
        assert.equal(seSolapan(puesto.caja, zona.caja, HOLGURA), false, `"${puesto.id}" invade la zona "${zona.nombre}"`);
      }
    }
  });

  test('El solape de un rótulo girado se mide sobre el rectángulo orientado y no sobre su envolvente', () => {
    // Dos cintas largas y paralelas, giradas 45° y separadas 70 px en perpendicular:
    // sus envolventes alineadas a la pantalla se pisan de sobra y ellas no se tocan.
    // Medir sobre la envolvente retiraría rótulos de calzada que sí caben.
    const a = creaCaja(0, 0, 100, 12, Math.PI / 4);
    const b = creaCaja(50, -50, 100, 12, Math.PI / 4);
    const ea = envolventeDeCaja(a);
    const eb = envolventeDeCaja(b);
    assert.ok(ea.x0 < eb.x1 && eb.x0 < ea.x1 && ea.y0 < eb.y1 && eb.y0 < ea.y1, 'las envolventes no se pisan: el caso no prueba nada');
    assert.equal(seSolapan(a, b, HOLGURA), false, 'el solape se está midiendo sobre la envolvente');
  });

  test('Un encuadre sin ningún candidato devuelve dos listas vacías y no un error', () => {
    const resultado = coloca([]);
    assert.deepEqual([...resultado.colocados], []);
    assert.deepEqual([...resultado.retirados], []);
    assert.equal(resultado.coste.comprobaciones, 0);
  });

  test('Un único candidato queda en la primera posición de su lista y no se retira nada', () => {
    const resultado = coloca([candidato('paraje:0', 'paraje', 200, 400)]);
    assert.equal(resultado.colocados.length, 1);
    assert.equal(resultado.colocados[0].posicion, POSICIONES[0]);
    assert.deepEqual([...resultado.retirados], []);
  });

  test('Donde todo cabe a la primera, ningún rótulo se mueve de su posición preferida', () => {
    const candidatos = [];
    for (let i = 0; i < 8; i++) candidatos.push(candidato(`paraje:${i}`, 'paraje', 60 + (i % 2) * 250, 80 + Math.floor(i / 2) * 180));
    const resultado = coloca(candidatos);
    assert.equal(resultado.colocados.length, 8);
    for (const puesto of resultado.colocados) assert.equal(puesto.posicion, POSICIONES[0], `"${puesto.id}" se ha movido sin necesidad`);
    assert.deepEqual([...resultado.retirados], []);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Las posiciones que se prueban, en el orden que se prueban
// ════════════════════════════════════════════════════════════════════════════════

describe('Las posiciones que se prueban, en el orden que se prueban', () => {
  test('Las ocho posiciones son las declaradas y en el orden declarado', () => {
    assert.deepEqual([...POSICIONES], [
      'debajo', 'encima', 'derecha', 'izquierda',
      'abajo-derecha', 'abajo-izquierda', 'arriba-derecha', 'arriba-izquierda',
    ]);
  });

  test('Un rótulo puntual sin conflicto queda debajo de su glifo', () => {
    const resultado = coloca([candidato('paraje:0', 'paraje', 200, 400)]);
    const puesto = resultado.colocados[0];
    assert.equal(puesto.posicion, 'debajo');
    assert.ok(puesto.y > 400, 'la caja no ha quedado debajo del glifo');
    assert.equal(Math.round(puesto.x), 200, 'la caja no ha quedado centrada sobre el glifo');
  });

  test('Con la preferida ocupada se prueban las ocho alrededor del ancla y se toma la primera libre', () => {
    const uno = coloca([candidato('paraje:0', 'paraje', 200, 400, { texto: 'Aa' })], {
      reservadas: [estorbo('tapa-debajo', 200, 419, 24, 8)],
    });
    assert.equal(uno.colocados[0].posicion, 'encima', 'con "debajo" ocupada no se ha tomado "encima"');

    const dos = coloca([candidato('paraje:0', 'paraje', 200, 400, { texto: 'Aa' })], {
      reservadas: [estorbo('tapa-debajo', 200, 419, 24, 8), estorbo('tapa-encima', 200, 381, 24, 8)],
    });
    assert.equal(dos.colocados[0].posicion, 'derecha', 'con las dos primeras ocupadas no se ha tomado la tercera');
  });

  test('El mismo rótulo con la misma entrada cae siempre en la misma de las ocho posiciones', () => {
    const entrada = () => ({
      candidatos: [candidato('paraje:0', 'paraje', 200, 400, { texto: 'Aa' })],
      reservadas: [estorbo('tapa-debajo', 200, 419, 24, 8)],
    });
    const a = coloca(entrada().candidatos, { reservadas: entrada().reservadas });
    const b = coloca(entrada().candidatos, { reservadas: entrada().reservadas });
    assert.equal(a.colocados[0].posicion, b.colocados[0].posicion);
    assert.equal(JSON.stringify(a.colocados), JSON.stringify(b.colocados));
  });

  test('Un rótulo de calzada con el punto medio ocupado se desliza por el trazado y el texto sigue derecho', () => {
    const trazado = [{ x: 20, y: 400 }, { x: 380, y: 400 }];
    const libre = coloca([candidato('calzada:0', 'calzada', 200, 400, { rol: 'calzada', texto: 'Camiño', trazado, radio: 0 })]);
    assert.equal(libre.colocados[0].posicion, 'trazado:0', 'una calzada libre no se rotula en su punto medio');

    const deslizada = coloca(
      [candidato('calzada:0', 'calzada', 200, 400, { rol: 'calzada', texto: 'Camiño', trazado, radio: 0 })],
      { reservadas: [estorbo('tapa-el-medio', 200, 389, 64, 16)] },
    );
    assert.equal(deslizada.colocados.length, 1, 'la calzada no se ha deslizado: se ha retirado');
    assert.notEqual(deslizada.colocados[0].posicion, 'trazado:0');
    assert.match(deslizada.colocados[0].posicion, /^trazado:-?\d+$/);
    assert.notEqual(deslizada.colocados[0].x, libre.colocados[0].x, 'la calzada no se ha movido del punto medio');

    // Texto derecho en todas las posiciones probadas, valga lo que valga el ángulo del
    // trazado: un rótulo de calzada nunca se lee del revés.
    const quebrado = [{ x: 20, y: 700 }, { x: 200, y: 500 }, { x: 40, y: 300 }, { x: 340, y: 120 }];
    for (const reservadas of [[], [estorbo('tapa', 120, 600, 80, 40)], [estorbo('tapa', 120, 600, 200, 200)]]) {
      const r = coloca([candidato('calzada:0', 'calzada', 120, 600, { rol: 'calzada', texto: 'Vieiro', trazado: quebrado, radio: 0 })], { reservadas });
      for (const puesto of r.colocados) {
        assert.ok(Math.abs(puesto.giro) <= Math.PI / 2 + 1e-9, `el texto de "${puesto.id}" se lee del revés: ${puesto.giro}`);
      }
    }
  });

  test('Una calzada cuyo trazado visible es más corto que el mínimo no se rotula, y se declara el motivo', () => {
    assert.equal(LARGO_MINIMO_DE_TRAZADO, 150, 'el mínimo declarado ha cambiado sin que nadie lo diga');
    const corto = [{ x: 100, y: 400 }, { x: 200, y: 400 }];
    const resultado = coloca([candidato('calzada:0', 'calzada', 150, 400, { rol: 'calzada', texto: 'Atallo', trazado: corto, radio: 0 })]);
    assert.deepEqual([...resultado.colocados], []);
    assert.deepEqual(
      resultado.retirados.map((r) => ({ id: r.id, motivo: r.motivo })),
      [{ id: 'calzada:0', motivo: MOTIVOS.trazadoCorto }],
    );
  });

  test('Un protegido para el que ninguna de las ocho sirve se aleja del ancla hasta el tope declarado', () => {
    const resultado = coloca(
      [candidato('nucleo:0', 'nucleo', 200, 400, { radio: 6, rango: 'pueblo' })],
      { reservadas: [estorbo('cerco', 200, 400, 110, 82)] },
    );
    const puesto = resultado.colocados[0];
    assert.ok(puesto.alejado > 0, 'el protegido no se ha alejado');
    const tope = TOPE_DE_TIRADOR * diagonalDeCaja(creaCaja(0, 0, puesto.caja.ancho, puesto.caja.alto, 0));
    assert.ok(puesto.alejado <= tope, `se ha alejado ${puesto.alejado}, por encima del tope ${tope}`);
    assert.ok(POSICIONES.includes(puesto.posicion), 'se ha alejado en una dirección que no es una de las ocho');
  });

  test('Un rótulo alejado trae el tirador que lo une a su glifo, con sus dos extremos calculados', () => {
    const resultado = coloca(
      [candidato('nucleo:0', 'nucleo', 200, 400, { radio: 6, rango: 'pueblo' })],
      { reservadas: [estorbo('cerco', 200, 400, 110, 82)] },
    );
    const tirador = resultado.colocados[0].tirador;
    assert.ok(tirador, 'un rótulo alejado por encima de la separación base no trae tirador');
    for (const clave of ['x0', 'y0', 'x1', 'y1']) assert.ok(Number.isFinite(tirador[clave]), `el tirador no trae ${clave}`);
    assert.ok(Math.hypot(tirador.x1 - tirador.x0, tirador.y1 - tirador.y0) > SEPARACION_BASE, 'el tirador no llega a verse');

    // Y un rótulo que no se aleja no lo lleva: la cercanía ya explica de quién es.
    const cerca = coloca([candidato('nucleo:0', 'nucleo', 200, 400, { rango: 'pueblo' })]);
    assert.equal(cerca.colocados[0].alejado, 0);
    assert.equal(cerca.colocados[0].tirador, null);
  });

  test('Un rótulo no protegido no se aleja con tirador: se retira', () => {
    const resultado = coloca(
      [candidato('paraje:0', 'paraje', 200, 400, { radio: 6 })],
      { reservadas: [estorbo('cerco', 200, 400, 110, 82)] },
    );
    assert.deepEqual([...resultado.colocados], []);
    assert.deepEqual(
      resultado.retirados.map((r) => ({ id: r.id, motivo: r.motivo })),
      [{ id: 'paraje:0', motivo: MOTIVOS.sinHueco }],
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// El orden de sacrificio, que es lo que se decide aquí
// ════════════════════════════════════════════════════════════════════════════════

describe('El orden de sacrificio, que es lo que se decide aquí', () => {
  /** El racimo canónico: cuatro roles en el mismo punto, con cajas del mismo tamaño y
   *  un marco donde solo caben dos. Las cajas iguales son a propósito: lo que se
   *  afirma es el orden, y tamaños distintos lo enturbiarían. */
  function racimo(extras = []) {
    return coloca([
      candidato('calzada:0', 'calzada', 30, 30, { radio: 3 }),
      candidato('servicio:0', 'servicio', 30, 30, { radio: 3 }),
      candidato('paraje:0', 'paraje', 30, 30, { radio: 3 }),
      candidato('nucleo:0', 'nucleo', 30, 30, { radio: 3, rango: 'pueblo' }),
      ...extras,
    ], { marco: marcoDe(60, 60), estilo: ESTILO_SIN_PLACA, medidor: medidorPlano });
  }

  test('En un racimo se retiran los de menor prioridad, por el orden declarado', () => {
    const resultado = racimo();
    assert.ok(resultado.retirados.length > 0, 'el racimo no ha forzado ningún sacrificio: el caso no prueba nada');
    const peorColocado = Math.max(...resultado.colocados.map((c) => PRIORIDAD_DE_ROL[c.rol]));
    const mejorRetirado = Math.min(...resultado.retirados.map((r) => PRIORIDAD_DE_ROL[r.rol]));
    assert.ok(peorColocado <= mejorRetirado, 'se ha retirado un rótulo más importante que otro que sí se puso');
    assert.deepEqual(resultado.colocados.map((c) => c.rol), ['nucleo', 'paraje']);
    assert.deepEqual(resultado.retirados.map((r) => r.rol), ['servicio', 'calzada']);
  });

  test('Cada rótulo retirado declara su identificador y su motivo', () => {
    const resultado = racimo();
    for (const retirado of resultado.retirados) {
      assert.equal(typeof retirado.id, 'string');
      assert.notEqual(retirado.id, '');
      assert.ok(Object.values(MOTIVOS).includes(retirado.motivo), `motivo no declarado: ${retirado.motivo}`);
    }
  });

  test('Un núcleo y un paraje que se disputan el mismo hueco lo gana el núcleo', () => {
    const resultado = coloca([
      candidato('paraje:0', 'paraje', 30, 30, { radio: 3 }),
      candidato('nucleo:0', 'nucleo', 30, 30, { radio: 3, rango: 'aldea' }),
    ], { marco: marcoDe(60, 60), estilo: ESTILO_SIN_PLACA, medidor: medidorPlano });
    assert.equal(resultado.colocados[0].id, 'nucleo:0');
    assert.equal(resultado.colocados[0].posicion, POSICIONES[0], 'el núcleo no se ha quedado con el hueco preferido');
  });

  test('El sitio encargado va rotulado aunque no se haya pisado, y si compite con un paraje conocido gana él', () => {
    const resultado = coloca([
      candidato('paraje:conocido', 'paraje', 30, 30, { radio: 3 }),
      candidato('paraje:encargado', 'paraje', 30, 30, { radio: 3, encargado: true }),
      candidato('nucleo:0', 'nucleo', 30, 30, { radio: 3, rango: 'aldea' }),
    ], { marco: marcoDe(60, 60), estilo: ESTILO_SIN_PLACA, medidor: medidorPlano });
    const puestos = porId(resultado.colocados);
    assert.ok(puestos.has('paraje:encargado'), 'el sitio encargado no va rotulado');
    assert.equal(puestos.get('paraje:encargado').protegido, true, 'el sitio encargado no es protegido');
    assert.equal(puestos.get('paraje:encargado').posicion, POSICIONES[0], 'el encargado no va delante de todo');
    assert.deepEqual(resultado.retirados.map((r) => r.id), ['paraje:conocido'], 'no ha ganado el encargado al paraje conocido');
  });

  test('Entre dos núcleos que no caben se retira el de rango menor', () => {
    const marco = marcoDe(60, 60);
    for (const orden of [['aldea', 'ciudad'], ['ciudad', 'aldea']]) {
      const resultado = coloca(orden.map((rango, i) => candidato(`nucleo:${i}`, 'nucleo', 30, 15, { radio: 3, rango })), { marco });
      const gana = orden.indexOf('ciudad');
      assert.deepEqual(resultado.colocados.map((c) => c.id), [`nucleo:${gana}`], 'no ha conservado el nombre el de rango mayor');
      assert.deepEqual(resultado.retirados.map((r) => r.id), [`nucleo:${1 - gana}`]);
    }
  });

  test('Entre dos núcleos del mismo rango el desempate es por identificador y no por el orden de la lista', () => {
    const marco = marcoDe(60, 60);
    const lista = [
      candidato('nucleo:zzz', 'nucleo', 30, 15, { radio: 3, rango: 'pueblo' }),
      candidato('nucleo:aaa', 'nucleo', 30, 15, { radio: 3, rango: 'pueblo' }),
    ];
    for (const entrada of [lista, lista.slice().reverse()]) {
      const resultado = coloca(entrada, { marco });
      assert.deepEqual(resultado.colocados.map((c) => c.id), ['nucleo:aaa']);
      assert.deepEqual(resultado.retirados.map((r) => r.id), ['nucleo:zzz']);
    }
    assert.ok(comparaCandidatos({ rol: 'nucleo', rango: 'pueblo', id: 'a' }, { rol: 'nucleo', rango: 'pueblo', id: 'z' }) < 0);
  });

  test('Un protegido cuyo texto es más ancho que el marco se retira declarando que no cabe', () => {
    const resultado = coloca([candidato('nucleo:0', 'nucleo', 200, 400, { texto: 'A'.repeat(60), rango: 'ciudad' })]);
    assert.deepEqual([...resultado.colocados], []);
    assert.deepEqual(
      resultado.retirados.map((r) => ({ id: r.id, motivo: r.motivo })),
      [{ id: 'nucleo:0', motivo: MOTIVOS.noCabeEnElMarco }],
    );
  });

  test('Con más candidatos que el tope, los que sobran se descartan por prioridad sin intentarlo', () => {
    assert.equal(TOPE_DE_CANDIDATOS, 300, 'el tope declarado ha cambiado sin que nadie lo diga');
    const candidatos = [];
    for (let i = 0; i < TOPE_DE_CANDIDATOS; i++) {
      candidatos.push(candidato(`nucleo:${String(i).padStart(3, '0')}`, 'nucleo', 100 + (i % 50) * 70, 100 + Math.floor(i / 50) * 600, { rango: 'aldea' }));
    }
    for (let i = 0; i < 5; i++) {
      candidatos.push(candidato(`calzada:${i}`, 'calzada', 200 + i * 40, 300));
    }
    const resultado = coloca(candidatos, { marco: marcoDe(4000, 4000), lienzo: { ancho: 4000, alto: 4000 } });
    const porTope = resultado.retirados.filter((r) => r.motivo === MOTIVOS.topeDeCandidatos);
    assert.equal(porTope.length, 5, 'no se han descartado exactamente los cinco que sobran del tope');
    assert.deepEqual(porTope.map((r) => r.rol), ['calzada', 'calzada', 'calzada', 'calzada', 'calzada'], 'lo descartado no es lo de menor prioridad');
    // Y no llegan a intentarlo: no aparecen en el desglose de coste.
    const conCoste = new Set(resultado.coste.porRotulo.map((r) => r.id));
    for (const r of porTope) assert.equal(conCoste.has(r.id), false, `"${r.id}" ha gastado comprobaciones pese a estar fuera del tope`);
  });

  test('En el mundo mínimo, de un núcleo y tres parajes, no se retira ningún rótulo', () => {
    const resultado = coloca([
      candidato('nucleo:0', 'nucleo', 200, 400, { rango: 'pueblo', texto: 'Vilar' }),
      candidato('paraje:0', 'paraje', 80, 150, { texto: 'Fonte' }),
      candidato('paraje:1', 'paraje', 320, 200, { texto: 'Cruce' }),
      candidato('paraje:2', 'paraje', 150, 650, { texto: 'Muíño' }),
    ]);
    assert.deepEqual([...resultado.retirados], []);
    assert.equal(resultado.colocados.length, 4);
    assert.deepEqual(parejasQueSePisan(resultado.colocados), []);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// La misma colocación siempre
// ════════════════════════════════════════════════════════════════════════════════

describe('La misma colocación siempre', () => {
  test('En el módulo de colocación no hay azar, ni reloj, ni red, ni nada de plataforma', () => {
    for (const ruta of ['packages/nucleo/core/rotulos.js', 'packages/nucleo/core/cajas.js']) {
      const fuente = readFileSync(join(RAIZ_REPO, ruta), 'utf8');
      const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
      for (const prohibido of ['Math.random', 'Date.now', 'new Date', 'performance.now', 'fetch(', 'require(', 'process.env']) {
        assert.equal(sinComentarios.includes(prohibido), false, `${ruta} usa ${prohibido}`);
      }
      for (const [, especificador] of sinComentarios.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
        assert.match(especificador, /^\.\//, `${ruta} importa "${especificador}", que no es del propio núcleo`);
      }
    }
  });

  test('Un encuadre que se mueve menos que el paso de cuantización da el mismo resultado', () => {
    assert.equal(REJILLA_DE_CENTRO, 8, 'la rejilla del centro ha cambiado sin que nadie lo diga');
    const uno = cuantizaEncuadre({ centro: { x: 96, y: 240 }, escala: 1, lienzo: LIENZO });
    const otro = cuantizaEncuadre({ centro: { x: 98, y: 241 }, escala: 1.02, lienzo: LIENZO });
    assert.deepEqual(otro.centro, uno.centro, 'un arrastre por debajo del paso ha movido el encuadre');
    assert.equal(otro.escala, uno.escala, 'un zoom por debajo del paso ha movido la escala');
    assert.equal(PASO_DE_ZOOM, 0.25);

    const candidatos = [candidato('nucleo:0', 'nucleo', 200, 400, { rango: 'pueblo' })];
    const a = colocarRotulos({ candidatos, encuadre: { ...uno, marco: MARCO }, estilo: ESTILO_DE_MENTIRA, medidor: medidorDeMentira });
    const b = colocarRotulos({ candidatos, encuadre: { ...otro, marco: MARCO }, estilo: ESTILO_DE_MENTIRA, medidor: medidorDeMentira });
    assert.equal(JSON.stringify(a.colocados), JSON.stringify(b.colocados));
  });

  test('Un arrastre que cruza un paso de cuantización recoloca entero y no depende de la colocación anterior', () => {
    const antes = cuantizaEncuadre({ centro: { x: 96, y: 240 }, escala: 1, lienzo: LIENZO });
    const despues = cuantizaEncuadre({ centro: { x: 105, y: 240 }, escala: 1, lienzo: LIENZO });
    assert.notDeepEqual(despues.centro, antes.centro, 'el arrastre no ha cruzado ningún paso: el caso no prueba nada');

    const candidatos = [
      candidato('nucleo:0', 'nucleo', 200, 400, { rango: 'pueblo' }),
      candidato('paraje:0', 'paraje', 205, 405),
    ];
    const enCadena = [antes, despues].map((encuadre) => colocarRotulos({
      candidatos, encuadre: { ...encuadre, marco: MARCO }, estilo: ESTILO_DE_MENTIRA, medidor: medidorDeMentira,
    }));
    const aSolas = colocarRotulos({
      candidatos, encuadre: { ...despues, marco: MARCO }, estilo: ESTILO_DE_MENTIRA, medidor: medidorDeMentira,
    });
    assert.equal(JSON.stringify(enCadena[1].colocados), JSON.stringify(aSolas.colocados), 'la colocación depende de cuál fuera la anterior');
  });

  test('Dos estilos con métricas distintas pueden colocar distinto, y ninguno con solapes', async () => {
    const documento = await documentoDe('urbano-denso', '1');
    const porEstilo = ESTILOS.map((estilo) => componeConDeclutter(documento, estilo.id));
    for (const caso of porEstilo) assert.deepEqual(parejasQueSePisan(cajasDe(caso.escena)), []);
    const firmas = new Set(porEstilo.map((caso) => JSON.stringify(caso.escena.colocacion)));
    assert.ok(firmas.size > 1, 'los cinco estilos colocan exactamente igual: las métricas no se están leyendo');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Antes de pintar, y a un coste acotado
// ════════════════════════════════════════════════════════════════════════════════

describe('Antes de pintar, y a un coste acotado', () => {
  test('Cuando empieza el pintado la colocación ya está resuelta y el pintado no mide ni un texto de rótulo', async () => {
    const caso = componeConDeclutter(await documentoDe('costero', '1'), ESTILO_POR_DEFECTO);
    assert.ok(caso.medidasAlColocar > 0, 'no se midió nada antes de colocar');
    const textosDeRotulo = new Set(caso.rotulos.map((r) => r.texto));
    const despues = caso.medidas.slice(caso.medidasAlColocar);
    for (const texto of despues) {
      assert.equal(textosDeRotulo.has(texto), false, `el pintado ha vuelto a medir el rótulo "${texto}"`);
    }
    // Y no queda ningún rótulo sin resolver: o está colocado o está retirado con motivo.
    const resueltos = new Set([...caso.escena.colocacion.map((c) => c.id), ...caso.escena.retirados.map((r) => r.id)]);
    for (const r of caso.rotulos) assert.ok(resueltos.has(r.id), `el rótulo "${r.id}" llegó al pintado sin resolver`);
  });

  test('Cada rótulo colocado trae posición, tamaño, caja, rol, si va sobre placa y su tirador', () => {
    const resultado = coloca([
      candidato('nucleo:0', 'nucleo', 200, 400, { rango: 'pueblo' }),
      candidato('paraje:0', 'paraje', 100, 200),
    ]);
    for (const puesto of resultado.colocados) {
      for (const clave of ['id', 'rol', 'texto', 'posicion', 'x', 'y', 'giro', 'caja', 'placa', 'medida', 'alejado']) {
        assert.ok(clave in puesto, `el rótulo colocado no trae "${clave}"`);
      }
      assert.ok(Object.hasOwn(puesto, 'tirador'), 'el rótulo colocado no declara su tirador, aunque sea nulo');
      assert.equal(typeof puesto.placa, 'boolean');
      assert.ok(puesto.caja.ancho > 0 && puesto.caja.alto > 0);
    }
    assert.equal(porId(resultado.colocados).get('nucleo:0').placa, true, 'el núcleo no va sobre placa con un estilo que la declara');
    assert.equal(porId(resultado.colocados).get('paraje:0').placa, false);
  });

  test('Con el tope de candidatos, las comprobaciones por rótulo no superan el máximo declarado', async () => {
    assert.equal(PRESUPUESTO_DE_COMPROBACIONES, 64, 'el presupuesto declarado ha cambiado sin que nadie lo diga');
    const candidatos = [];
    for (let i = 0; i < TOPE_DE_CANDIDATOS; i++) {
      // Un racimo apretado de verdad: es donde el presupuesto puede desbordarse.
      candidatos.push(candidato(`paraje:${String(i).padStart(3, '0')}`, 'paraje', 40 + (i % 20) * 16, 40 + Math.floor(i / 20) * 48));
    }
    const resultado = coloca(candidatos);
    assert.ok(resultado.coste.maximoPorRotulo <= PRESUPUESTO_DE_COMPROBACIONES,
      `un rótulo ha gastado ${resultado.coste.maximoPorRotulo} comprobaciones`);

    for (const caso of await muestra()) {
      assert.ok(
        caso.salida.coste.maximoPorRotulo <= PRESUPUESTO_DE_COMPROBACIONES,
        `${caso.nombre} con ${caso.estilo} ha gastado ${caso.salida.coste.maximoPorRotulo} comprobaciones en un rótulo`,
      );
    }
  });

  test('Doblar los candidatos no dobla el coste al cuadrado', () => {
    // Misma densidad y el doble de rótulos: si el barrido fuera cuadrático, el coste
    // se multiplicaría por cuatro. El índice de rejilla es lo que lo deja en lineal.
    const rejilla = (cuantos) => {
      const lista = [];
      for (let i = 0; i < cuantos; i++) {
        lista.push(candidato(`paraje:${String(i).padStart(3, '0')}`, 'paraje', 30 + (i % 10) * 24, 40 + Math.floor(i / 10) * 20));
      }
      return lista;
    };
    const pocos = coloca(rejilla(60));
    const dobles = coloca(rejilla(120));
    assert.ok(pocos.coste.comprobaciones > 0, 'el caso base no gasta ninguna comprobación: no prueba nada');
    const crecimiento = dobles.coste.comprobaciones / pocos.coste.comprobaciones;
    assert.ok(crecimiento < 4, `doblar los candidatos ha multiplicado el coste por ${crecimiento.toFixed(2)}: es cuadrático`);
    assert.ok(crecimiento <= CRECIMIENTO_MAXIMO, `el coste ha crecido ×${crecimiento.toFixed(2)}, por encima del presupuesto ×${CRECIMIENTO_MAXIMO}`);
  });

  test('Un candidato cuya ancla queda fuera del encuadre no entra en el reparto ni cuesta una comprobación', () => {
    const dentro = [candidato('paraje:0', 'paraje', 200, 400), candidato('paraje:1', 'paraje', 205, 404)];
    const solos = coloca(dentro);
    const conForastero = coloca([...dentro, candidato('paraje:9', 'paraje', 9000, 9000)]);
    assert.equal(conForastero.coste.comprobaciones, solos.coste.comprobaciones, 'el candidato de fuera ha costado comprobaciones');
    assert.equal(conForastero.coste.porRotulo.some((r) => r.id === 'paraje:9'), false);
    assert.deepEqual(
      conForastero.retirados.map((r) => ({ id: r.id, motivo: r.motivo })),
      [{ id: 'paraje:9', motivo: MOTIVOS.fueraDelEncuadre }],
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Lo que se rechaza en la entrada
// ════════════════════════════════════════════════════════════════════════════════

describe('Lo que se rechaza en la entrada', () => {
  test('Un candidato sin texto falla nombrando el campo y el identificador', () => {
    assert.throws(() => coloca([{ id: 'paraje:0', rol: 'paraje', ancla: { x: 10, y: 10 } }]), (e) => {
      assert.match(e.message, /paraje:0/);
      assert.match(e.message, /texto/);
      return true;
    });
  });

  test('Un candidato sin ancla falla nombrando el campo', () => {
    assert.throws(() => coloca([{ id: 'paraje:0', rol: 'paraje', texto: 'Fonte' }]), (e) => {
      assert.match(e.message, /paraje:0/);
      assert.match(e.message, /ancla/);
      return true;
    });
  });

  test('Un rol que no es núcleo, paraje, servicio ni calzada falla nombrando el rol recibido', () => {
    assert.throws(() => coloca([candidato('x:0', 'monolito', 10, 10)]), (e) => {
      assert.match(e.message, /monolito/);
      return true;
    });
  });

  test('Dos candidatos con el mismo identificador fallan nombrando el repetido', () => {
    assert.throws(() => coloca([candidato('paraje:0', 'paraje', 10, 10), candidato('paraje:0', 'paraje', 50, 50)]), (e) => {
      assert.match(e.message, /paraje:0/);
      assert.match(e.message, /dos veces|repetid/i);
      return true;
    });
  });

  test('Sin medidor de texto inyectado falla, y no estima el ancho por el número de letras', () => {
    assert.throws(
      () => colocarRotulos({ candidatos: [candidato('paraje:0', 'paraje', 10, 10)], encuadre: { lienzo: LIENZO, marco: MARCO }, estilo: ESTILO_DE_MENTIRA }),
      /medidor/,
    );
    // Y el colocador del render tampoco estima: mide antes de colocar y el medidor que
    // le pasa al núcleo solo existe para gritar si alguien llega sin medida.
    assert.equal(COLOCADOR.puedeSolapar, false);
    assert.doesNotThrow(() => colocadorDeRotulos(
      [{ id: 'paraje:0', rol: 'paraje', texto: 'Fonte', ancla: { x: 100, y: 100 }, medida: { ancho: 30, alto: 12 } }],
      { estilo: ESTILO_DE_MENTIRA, marco: MARCO, tamano: LIENZO, extras: {} },
    ));
    assert.throws(() => colocadorDeRotulos(
      [{ id: 'paraje:0', rol: 'paraje', texto: 'Fonte', ancla: { x: 100, y: 100 }, medida: { ancho: 0, alto: 0 } }],
      { estilo: ESTILO_DE_MENTIRA, marco: MARCO, tamano: LIENZO, extras: {} },
    ), /paraje:0/);
  });

  test('Un medidor que devuelve un ancho o un alto que no es un número positivo falla nombrando el rótulo', () => {
    for (const malo of [{ ancho: 0, alto: 12 }, { ancho: 30, alto: -1 }, { ancho: NaN, alto: 12 }, null]) {
      assert.throws(
        () => coloca([candidato('paraje:malo', 'paraje', 100, 100)], { medidor: () => malo }),
        (e) => {
          assert.match(e.message, /paraje:malo/);
          return true;
        },
      );
    }
  });

  test('Un estilo al que le falta la métrica de un rol que hay que colocar falla nombrando el rol y la métrica', () => {
    const sinHalo = { id: 'cojo', label: { placa: [], tracking: 0 }, placa: null };
    assert.throws(() => coloca([candidato('paraje:0', 'paraje', 100, 100)], { estilo: sinHalo }), (e) => {
      assert.match(e.message, /haloW/);
      assert.match(e.message, /paraje/);
      return true;
    });
    const sinPad = { id: 'cojo2', label: { placa: ['nucleo'], tracking: 0, haloW: 4 }, placa: { padY: 4 } };
    assert.throws(() => coloca([candidato('nucleo:0', 'nucleo', 100, 100)], { estilo: sinPad }), (e) => {
      assert.match(e.message, /padX/);
      assert.match(e.message, /nucleo/);
      return true;
    });
  });

  test('Dos candidatos con el ancla en el mismo punto no fallan: se resuelven por prioridad e identificador', () => {
    const resultado = coloca([
      candidato('paraje:b', 'paraje', 200, 400),
      candidato('paraje:a', 'paraje', 200, 400),
      candidato('nucleo:0', 'nucleo', 200, 400, { rango: 'pueblo' }),
    ]);
    assert.equal(resultado.colocados.length + resultado.retirados.length, 3);
    assert.deepEqual(parejasQueSePisan(resultado.colocados), []);
    assert.equal(resultado.colocados[0].id, 'nucleo:0', 'el orden de proceso no sale de la prioridad');
    const parajes = resultado.colocados.filter((c) => c.rol === 'paraje').map((c) => c.id);
    if (parajes.length === 2) assert.deepEqual(parajes, ['paraje:a', 'paraje:b'], 'el desempate no es por identificador');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// El escalado por lámina conserva la jerarquía
// ════════════════════════════════════════════════════════════════════════════════

describe('El escalado por lámina conserva la jerarquía', () => {
  test('Un núcleo se lee más grande que un paraje en cualquier tamaño de lámina', async () => {
    const documento = await documentoDe('urbano-denso', '1');
    for (const ancho of [390, 780, 1300]) {
      const caso = componeConDeclutter(documento, 'reino', { tamano: { ancho, alto: ancho * 2 } });
      const altos = (rol) => caso.escena.colocacion.filter((c) => c.rol === rol).map((c) => c.caja.alto);
      const nucleos = altos('nucleo');
      const parajes = altos('paraje');
      assert.ok(nucleos.length > 0 && parajes.length > 0, `en una lámina de ${ancho} no hay de los dos roles que comparar`);
      assert.ok(
        Math.min(...nucleos) > Math.max(...parajes),
        `en una lámina de ${ancho} un paraje se lee tan grande como un núcleo`,
      );
    }
  });

  test('Placa y halo siguen distinguiendo pueblo de paraje después de escalar', () => {
    const reino = ESTILOS.find((e) => e.id === 'reino');
    for (const ancho of [390, 1300]) {
      const escalado = estiloParaLamina(reino, ancho);
      assert.equal(vaSobrePlaca(escalado, 'nucleo'), true, `el núcleo ha perdido la placa en una lámina de ${ancho}`);
      assert.equal(vaSobrePlaca(escalado, 'paraje'), false, `el paraje ha ganado placa en una lámina de ${ancho}`);
      // Y la caja del núcleo lleva el acolchado de la placa, no el del halo.
      const conPlaca = tamanoDeCaja({ medida: { ancho: 60, alto: 20 }, rol: 'nucleo', estilo: escalado, letras: 6 });
      const conHalo = tamanoDeCaja({ medida: { ancho: 60, alto: 20 }, rol: 'paraje', estilo: escalado, letras: 6 });
      assert.equal(conPlaca.placa, true);
      assert.equal(conHalo.placa, false);
      assert.ok(conPlaca.alto > conHalo.alto, `la placa no engorda la caja en una lámina de ${ancho}`);
    }
  });

  test('En una lámina de móvil ningún rótulo se retira por no caber en el marco', async () => {
    // La deuda que el escalado cerró: con las métricas del prototipo en 390 px, 61
    // rótulos de 162 no cabían en el marco. El presupuesto es cero, y es afirmable.
    let sinCaber = 0;
    let nucleos = 0;
    let nucleosRetirados = 0;
    for (const caso of await muestra()) {
      sinCaber += caso.escena.retirados.filter((r) => r.motivo === MOTIVOS.noCabeEnElMarco).length;
      nucleos += caso.rotulos.filter((r) => r.rol === 'nucleo').length;
      nucleosRetirados += caso.escena.retirados.filter((r) => r.rol === 'nucleo').length;
    }
    assert.equal(sinCaber, 0, `${sinCaber} rótulos no caben en el marco de una lámina de móvil`);
    assert.ok(nucleos > 0, 'la muestra no tiene ni un rótulo de núcleo: no prueba nada');
    // Medido al entregar: 69 de 70 núcleos conservan su nombre. El suelo se declara con
    // holgura porque es un indicador de salud, no una cifra congelada.
    assert.ok(
      nucleosRetirados / nucleos <= 0.1,
      `se han callado ${nucleosRetirados} de ${nucleos} núcleos, por encima del 10 % que la jerarquía tolera`,
    );
  });
});
