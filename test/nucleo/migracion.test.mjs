// SPEC-039 · La cadena de migraciones del formato: el registro explícito de pasos, la
// comprobación de que no tiene huecos, la aplicación en orden y la idempotencia.
//
// Este fichero existe con una condición que es la mitad del diseño del módulo: **tiene
// que poder ponerse rojo hoy**, con la versión de formato todavía en 1 y sin ninguna
// migración real que hacer. Un criterio que dice «migrar funciona» y que no se puede
// poner rojo no mide nada. Por eso casi todo lo de aquí arma una cadena de prueba —con
// su paso, con su hueco, con su salto imposible— en vez de mirar la cadena de verdad,
// que hoy está vacía y tiene que estarlo.
//
// RF-PERS-008 no tiene escenario en `docs/testing.md`: todo lo de aquí va marcado como
// hueco de batería en el mapa de cobertura.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CADENA_DEL_FORMATO,
  VERSION_MINIMA_SOPORTADA,
  compruebaCadena,
  creaCadena,
  migra,
  paso,
} from '../../packages/nucleo/partida/migracion.js';
import { CLASES, VERSION_FORMATO, VERSION_GENERADOR } from '../../packages/nucleo/partida/formato.js';
import { estadoInicial, congelaEstado } from '../../packages/nucleo/partida/estado.js';
import { SEMILLA_A } from './copia-de-prueba.mjs';

/** Un documento cualquiera con su versión, que es lo único que la cadena mira. */
const doc = (version, extra = {}) => ({ version, generador: VERSION_GENERADOR, clase: 'documento-de-prueba', ...extra });

/** La cadena de prueba: tres pasos seguidos, de la 1 a la 4. */
const CADENA_DE_PRUEBA = creaCadena([
  paso({ de: 1, a: 2, introduce: { 'cabecera.idioma': 'gl' }, porque: 'el idioma pasa a estar declarado' }),
  paso({ de: 2, a: 3, renombra: { apodo: 'mote' }, porque: 'el apodo se llama mote desde SPEC-036' }),
  paso({ de: 3, a: 4, quita: ['provisional'], porque: 'el campo provisional deja de existir' }),
]);

describe('El versionado y la migración', () => {
  test('La versión de formato que el juego escribe sale de la constante única y no de una copia', () => {
    // La cadena real se comprueba contra la constante, no contra un literal: si alguien
    // sube la versión sin registrar el paso, esto es lo que se pone rojo.
    assert.equal(VERSION_MINIMA_SOPORTADA, 1, 'la mínima soportada tiene que ser la primera que existió');
    assert.ok(VERSION_FORMATO >= VERSION_MINIMA_SOPORTADA);
    const tramo = compruebaCadena(CADENA_DEL_FORMATO);
    assert.equal(tramo.desde, VERSION_MINIMA_SOPORTADA);
    assert.equal(tramo.hasta, VERSION_FORMATO);
    assert.deepEqual([...tramo.saltos], [], 'hoy la versión actual es la mínima: la cadena real tiene que estar vacía');
  });

  test('La cadena cubre sin huecos desde la versión mínima hasta la actual y cada paso declara su salto', () => {
    const tramo = compruebaCadena(CADENA_DE_PRUEBA, { desde: 1, hasta: 4 });
    assert.deepEqual([...tramo.saltos], ['1→2', '2→3', '3→4']);
    for (const p of tramo.pasos) assert.equal(p.a, p.de + 1, 'un paso no declara de qué versión a cuál va');
  });

  test('Una cadena con un hueco entre dos versiones falla nombrando el salto que falta', () => {
    // El criterio que hace que esto no sea un mecanismo vacío: se pone rojo hoy mismo.
    const conHueco = creaCadena([
      paso({ de: 1, a: 2 }),
      paso({ de: 3, a: 4 }),
    ]);
    assert.throws(() => compruebaCadena(conHueco, { desde: 1, hasta: 4 }), /hueco.*falta el paso 2→3/s);
  });

  test('Un paso que salta más de una versión no se puede ni declarar', () => {
    assert.throws(() => paso({ de: 1, a: 3 }), /salta más de una versión/);
    assert.throws(() => paso({ de: 1 }), /a qué versión llega/);
    assert.throws(() => paso({ a: 2 }), /de qué versión sale/);
  });

  test('Dos pasos que salen de la misma versión dejarían la migración sin un solo resultado', () => {
    const ambigua = creaCadena([paso({ de: 1, a: 2 }), paso({ de: 1, a: 2, introduce: { otro: 1 } })]);
    assert.throws(() => compruebaCadena(ambigua, { desde: 1, hasta: 2 }), /dos pasos que salen de la versión 1/);
  });

  test('Un documento de una versión menor con todos los pasos registrados se migra en orden', () => {
    const original = doc(1, { apodo: 'la del farol', provisional: true });
    const resultado = migra(original, { cadena: CADENA_DE_PRUEBA, hasta: 4 });

    assert.equal(resultado.migrado, true);
    assert.equal(resultado.desde, 1);
    assert.equal(resultado.hasta, 4);
    assert.deepEqual([...resultado.saltos], ['1→2', '2→3', '3→4']);
    assert.equal(resultado.doc.version, 4, 'el documento migrado no declara la versión de destino');
    assert.equal(resultado.doc.cabecera.idioma, 'gl', 'el paso 1→2 no ha introducido lo que declara');
    assert.equal(resultado.doc.mote, 'la del farol', 'el paso 2→3 no ha renombrado');
    assert.equal('apodo' in resultado.doc, false, 'el nombre viejo sigue ahí');
    assert.equal('provisional' in resultado.doc, false, 'el paso 3→4 no ha quitado lo que declara');
  });

  test('Un documento de una versión menor sin paso registrado para ese salto falla nombrando el salto', () => {
    const sinPaso = creaCadena([paso({ de: 2, a: 3 })]);
    assert.throws(() => migra(doc(1), { cadena: sinPaso, hasta: 3 }), /falta el paso 1→2/);
    // Y no se interpreta con las reglas nuevas: no devuelve nada, falla.
    assert.throws(() => migra(doc(1), { cadena: creaCadena([]), hasta: 2 }), /hueco/);
  });

  test('Una migración que introduce un campo nuevo declara el valor y no lo deduce', () => {
    // Por aquí no puede pasar nada ejecutable: si pudiera, el valor de un campo nuevo
    // dependería de la versión del juego que ejecutara la migración.
    assert.throws(() => paso({ de: 1, a: 2, introduce: { idioma: () => 'gl' } }), /declara el valor que introduce y no lo calcula/);
    assert.throws(() => paso({ de: 1, a: 2, introduce: { 'cabecera.idioma': undefined } }), /no es un valor declarado/);
    assert.throws(() => paso({ de: 1, a: 2, introduce: { lista: [1, () => 2] } }), /"lista"\[1\]/);

    const conValor = creaCadena([paso({ de: 1, a: 2, introduce: { idioma: 'gl' } })]);
    assert.equal(migra(doc(1), { cadena: conValor, hasta: 2 }).doc.idioma, 'gl');
  });

  test('Migrar el mismo documento dos veces desde el mismo origen da resultados idénticos byte a byte', () => {
    const original = doc(1, { apodo: 'la del farol', provisional: true });
    const primera = migra(original, { cadena: CADENA_DE_PRUEBA, hasta: 4 });
    const segunda = migra(original, { cadena: CADENA_DE_PRUEBA, hasta: 4 });
    assert.equal(JSON.stringify(segunda.doc), JSON.stringify(primera.doc), 'dos migraciones del mismo documento difieren');
  });

  test('La original sigue sin tocar después de migrarla', () => {
    const original = doc(1, { apodo: 'la del farol', provisional: true });
    const antes = JSON.stringify(original);
    migra(original, { cadena: CADENA_DE_PRUEBA, hasta: 4 });
    assert.equal(JSON.stringify(original), antes, 'migrar ha tocado el documento de origen');
  });

  test('Un documento ya en la versión actual sale idéntico y ningún paso se aplica', () => {
    const actual = doc(VERSION_FORMATO, { algo: 1 });
    const resultado = migra(actual, { cadena: CADENA_DE_PRUEBA });
    assert.equal(resultado.migrado, false);
    assert.deepEqual([...resultado.saltos], []);
    assert.equal(resultado.doc, actual, 'el documento no ha salido tal cual entró');
  });

  test('Una partida migrada declara desde qué versión se migró y con qué versión de reglas', () => {
    const hastaLaTres = creaCadena([paso({ de: 1, a: 2 }), paso({ de: 2, a: 3, renombra: { apodo: 'mote' } })]);
    const resultado = migra(doc(1, { apodo: 'x' }), { cadena: hastaLaTres, hasta: 3 });
    assert.equal(resultado.desde, 1);
    assert.equal(resultado.hasta, 3);
    assert.equal(resultado.reglas, VERSION_GENERADOR, 'no queda dicho con qué versión de reglas se migró');
  });

  test('Un documento de una versión mayor que la del juego no se abre y el error declara las dos', () => {
    assert.throws(() => migra(doc(VERSION_FORMATO + 3)), (e) => {
      assert.match(e.message, new RegExp(String(VERSION_FORMATO + 3)));
      assert.match(e.message, new RegExp(`\\b${VERSION_FORMATO}\\b`));
      assert.match(e.message, /no se abre/);
      return true;
    });
  });

  test('Un documento sin campo de versión no se migra a ciegas', () => {
    assert.throws(() => migra({ clase: 'lo-que-sea' }), /no declara el campo "version"/);
    assert.throws(() => migra(null), /no es un documento que se pueda migrar/);
    assert.throws(() => migra([1, 2]), /no es un documento que se pueda migrar/);
    assert.throws(() => migra({ version: '1' }), /no es un entero/);
  });

  test('Migrar hasta la versión real valida el resultado contra el esquema cerrado actual', () => {
    // Con la cadena vacía y un documento ya actual no se aplica nada, así que la
    // comprobación de esquema se ejercita con lo que sí describe un esquema: el estado.
    const estado = congelaEstado(estadoInicial({ semilla: SEMILLA_A }));
    const resultado = migra(estado, { cadena: CADENA_DEL_FORMATO });
    assert.equal(resultado.migrado, false);
    assert.equal(resultado.doc.clase, CLASES.ESTADO);

    // Y una migración de prueba a una versión que ningún esquema describe no se valida
    // contra él, que es lo que permite ejercitar el mecanismo hoy sin tocar el formato.
    const deJuguete = migra(doc(1), { cadena: creaCadena([paso({ de: 1, a: 2, introduce: { nuevo: 'sí' } })]), hasta: 2 });
    assert.equal(deJuguete.doc.nuevo, 'sí');
  });

  test('La comprobación de la cadena se puede poner roja con un paso de prueba mal declarado', () => {
    // El criterio literal de la spec: el mecanismo se ejercita aunque hoy solo exista
    // la versión 1. Tres maneras de ponerlo rojo, y las tres nombran qué pasa.
    assert.throws(() => compruebaCadena(creaCadena([]), { desde: 1, hasta: 2 }), /falta el paso 1→2/);
    assert.throws(() => compruebaCadena(CADENA_DE_PRUEBA, { desde: 1, hasta: 2 }), /fuera del tramo 1→2/);
    assert.throws(() => compruebaCadena(CADENA_DE_PRUEBA, { desde: 4, hasta: 1 }), /es anterior a/);
  });

  test('Un paso que renombra lo que el documento no trae no se inventa nada', () => {
    const cadena = creaCadena([paso({ de: 1, a: 2, renombra: { apodo: 'mote' } })]);
    assert.throws(() => migra(doc(1), { cadena, hasta: 2 }), /no puede inventarse lo que no estaba/);
  });
});
