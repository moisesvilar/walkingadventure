// SPEC-039 · La cadena de migraciones del formato: el registro explícito de pasos, la
// comprobación de que no tiene huecos, la aplicación en orden y la idempotencia.
//
// Este fichero existe con una condición que es la mitad del diseño del módulo: **tiene
// que poder ponerse rojo hoy**, con o sin migraciones reales que hacer. Un criterio que
// dice «migrar funciona» y que no se puede poner rojo no mide nada. Por eso casi todo lo
// de aquí arma una cadena de prueba —con su paso, con su hueco, con su salto imposible—
// en vez de mirar la cadena de verdad.
//
// ## Lo que este fichero codificaba mal, y que SPEC-049 puso rojo
//
// Escrito en SPEC-039, cuando `VERSION_FORMATO` era 1 y la cadena real estaba vacía, este
// fichero **codificó ese estado de las cosas como si fuera un invariante del diseño**. Tres
// de sus casos se pusieron rojos al abrirse la primera migración de verdad del proyecto
// —`1→2`, la huella de descartes contra la que se casteó la aventura en curso— y ninguno
// de los tres señalaba un defecto de lo escrito:
//
// - «hoy la versión actual es la mínima: la cadena real tiene que estar vacía» era una
//   descripción, no un criterio. Se sustituye por su inverso: **que la cadena declare el
//   tramo que cubre y que ese tramo llegue exactamente hasta la constante**, que es lo que
//   de verdad hay que proteger y lo que sigue poniéndose rojo si alguien sube la versión
//   sin registrar el paso.
// - Los dos casos que migraban un documento de juguete «a una versión que ningún esquema
//   describe» **clavaban el número 2** para conseguirlo. Funcionaba porque 2 era mayor que
//   `VERSION_FORMATO`; en cuanto dejó de serlo, `esquemaDe('documento-de-prueba')` empezó a
//   lanzar. El arreglo no es subir el número: es **derivarlo**, que es lo que hace la banda
//   sintética de abajo, para que la próxima migración no vuelva a romperlos.
//
// Es la misma forma que la guarda que SPEC-044 dejó puesta y que SPEC-049 retiró: **una
// descripción del estado de las cosas disfrazada de invariante**. Queda escrito aquí porque
// el hallazgo vale más que el arreglo.
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
import { congelaEstado, estadoInicial, levantaEstado } from '../../packages/nucleo/partida/estado.js';
import { congelaRegistro, levantaRegistro, registroInicial } from '../../packages/nucleo/partida/hechos.js';
import { SEMILLA_A } from './copia-de-prueba.mjs';

/** Un documento cualquiera con su versión, que es lo único que la cadena mira. */
const doc = (version, extra = {}) => ({ version, generador: VERSION_GENERADOR, clase: 'documento-de-prueba', ...extra });

/**
 * **La banda sintética: de `VERSION_FORMATO` hacia arriba.**
 *
 * Todo lo que este fichero migra sale de aquí, y la razón es exactamente la que rompió a
 * dos de sus casos cuando llegó la primera migración de verdad: `migra` valida el resultado
 * contra el esquema cerrado **solo cuando el destino es `VERSION_FORMATO`**, y la clase de
 * juguete que se usa aquí —`documento-de-prueba`— no la describe ningún esquema. Con los
 * números clavados en 1, 2, 3 y 4, el día que `VERSION_FORMATO` alcanzó el 2 la validación
 * empezó a aplicarse y `esquemaDe` lanzó.
 *
 * Derivándola, ese día no vuelve: `V` es la versión real y `V + 1` es siempre la primera que
 * ningún esquema describe, suba lo que suba la constante. Lo que este fichero ejercita es el
 * **mecanismo** de la cadena, y el mecanismo no depende de qué número tenga hoy el formato.
 */
const V = VERSION_FORMATO;

/** Un salto de la banda sintética, tal como lo nombra la cadena. */
const salto = (n) => `${V + n}→${V + n + 1}`;

/** La cadena de prueba: tres pasos seguidos por la banda sintética. */
const CADENA_DE_PRUEBA = creaCadena([
  paso({ de: V, a: V + 1, introduce: { 'cabecera.idioma': 'gl' }, porque: 'el idioma pasa a estar declarado' }),
  paso({ de: V + 1, a: V + 2, renombra: { apodo: 'mote' }, porque: 'el apodo se llama mote desde SPEC-036' }),
  paso({ de: V + 2, a: V + 3, quita: ['provisional'], porque: 'el campo provisional deja de existir' }),
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

    // **La cadena real declara el tramo que cubre, y ese tramo llega exactamente hasta la
    // constante.** Hasta SPEC-049 este caso exigía la lista vacía, que era cierto y no era un
    // criterio: describía que la versión actual era la mínima. Lo que hay que proteger es que
    // subir la versión **obligue** a registrar el paso, y eso es esto: un salto de menos y
    // `compruebaCadena` falla nombrando el que falta; uno de más y el tramo pasa de largo.
    const esperados = [];
    for (let n = VERSION_MINIMA_SOPORTADA; n < VERSION_FORMATO; n += 1) esperados.push(`${n}→${n + 1}`);
    assert.deepEqual([...tramo.saltos], esperados, 'la cadena real no cubre paso a paso desde la mínima soportada hasta la versión actual');
    assert.equal(tramo.pasos.length, VERSION_FORMATO - VERSION_MINIMA_SOPORTADA, 'la cadena real tiene más pasos que saltos declara');
    // Y cada paso dice **por qué** existe: una migración sin motivo escrito es un cambio de
    // esquema que nadie podrá explicar dentro de un año.
    for (const p of tramo.pasos) assert.ok(p.porque, `el paso ${p.de}→${p.a} de la cadena real no dice por qué existe`);
  });

  test('La cadena cubre sin huecos desde la versión mínima hasta la actual y cada paso declara su salto', () => {
    const tramo = compruebaCadena(CADENA_DE_PRUEBA, { desde: V, hasta: V + 3 });
    assert.deepEqual([...tramo.saltos], [salto(0), salto(1), salto(2)]);
    for (const p of tramo.pasos) assert.equal(p.a, p.de + 1, 'un paso no declara de qué versión a cuál va');
  });

  test('Una cadena con un hueco entre dos versiones falla nombrando el salto que falta', () => {
    // El criterio que hace que esto no sea un mecanismo vacío: se pone rojo hoy mismo.
    const conHueco = creaCadena([
      paso({ de: V, a: V + 1 }),
      paso({ de: V + 2, a: V + 3 }),
    ]);
    assert.throws(() => compruebaCadena(conHueco, { desde: V, hasta: V + 3 }), new RegExp(`hueco.*falta el paso ${salto(1)}`, 's'));
  });

  test('Un paso que salta más de una versión no se puede ni declarar', () => {
    assert.throws(() => paso({ de: 1, a: 3 }), /salta más de una versión/);
    assert.throws(() => paso({ de: 1 }), /a qué versión llega/);
    assert.throws(() => paso({ a: 2 }), /de qué versión sale/);
  });

  test('Dos pasos que salen de la misma versión dejarían la migración sin un solo resultado', () => {
    const ambigua = creaCadena([paso({ de: V, a: V + 1 }), paso({ de: V, a: V + 1, introduce: { otro: 1 } })]);
    assert.throws(() => compruebaCadena(ambigua, { desde: V, hasta: V + 1 }), new RegExp(`dos pasos que salen de la versión ${V}`));
  });

  test('Un documento de una versión menor con todos los pasos registrados se migra en orden', () => {
    const original = doc(V, { apodo: 'la del farol', provisional: true });
    const resultado = migra(original, { cadena: CADENA_DE_PRUEBA, hasta: V + 3 });

    assert.equal(resultado.migrado, true);
    assert.equal(resultado.desde, V);
    assert.equal(resultado.hasta, V + 3);
    assert.deepEqual([...resultado.saltos], [salto(0), salto(1), salto(2)]);
    assert.equal(resultado.doc.version, V + 3, 'el documento migrado no declara la versión de destino');
    assert.equal(resultado.doc.cabecera.idioma, 'gl', `el paso ${salto(0)} no ha introducido lo que declara`);
    assert.equal(resultado.doc.mote, 'la del farol', `el paso ${salto(1)} no ha renombrado`);
    assert.equal('apodo' in resultado.doc, false, 'el nombre viejo sigue ahí');
    assert.equal('provisional' in resultado.doc, false, `el paso ${salto(2)} no ha quitado lo que declara`);
  });

  test('Un documento de una versión menor sin paso registrado para ese salto falla nombrando el salto', () => {
    const sinPaso = creaCadena([paso({ de: V + 1, a: V + 2 })]);
    assert.throws(() => migra(doc(V), { cadena: sinPaso, hasta: V + 2 }), new RegExp(`falta el paso ${salto(0)}`));
    // Y no se interpreta con las reglas nuevas: no devuelve nada, falla.
    assert.throws(() => migra(doc(V), { cadena: creaCadena([]), hasta: V + 1 }), /hueco/);
  });

  test('Una migración que introduce un campo nuevo declara el valor y no lo deduce', () => {
    // Por aquí no puede pasar nada ejecutable: si pudiera, el valor de un campo nuevo
    // dependería de la versión del juego que ejecutara la migración.
    assert.throws(() => paso({ de: V, a: V + 1, introduce: { idioma: () => 'gl' } }), /declara el valor que introduce y no lo calcula/);
    assert.throws(() => paso({ de: V, a: V + 1, introduce: { 'cabecera.idioma': undefined } }), /no es un valor declarado/);
    assert.throws(() => paso({ de: V, a: V + 1, introduce: { lista: [1, () => 2] } }), /"lista"\[1\]/);

    // El destino sale de la banda sintética y no de un número clavado: hasta SPEC-049 aquí
    // ponía `hasta: 2`, que funcionaba solo mientras 2 fuera mayor que `VERSION_FORMATO`.
    const conValor = creaCadena([paso({ de: V, a: V + 1, introduce: { idioma: 'gl' } })]);
    assert.equal(migra(doc(V), { cadena: conValor, hasta: V + 1 }).doc.idioma, 'gl');
  });

  test('Migrar el mismo documento dos veces desde el mismo origen da resultados idénticos byte a byte', () => {
    const original = doc(V, { apodo: 'la del farol', provisional: true });
    const primera = migra(original, { cadena: CADENA_DE_PRUEBA, hasta: V + 3 });
    const segunda = migra(original, { cadena: CADENA_DE_PRUEBA, hasta: V + 3 });
    assert.equal(JSON.stringify(segunda.doc), JSON.stringify(primera.doc), 'dos migraciones del mismo documento difieren');
  });

  test('La original sigue sin tocar después de migrarla', () => {
    const original = doc(V, { apodo: 'la del farol', provisional: true });
    const antes = JSON.stringify(original);
    migra(original, { cadena: CADENA_DE_PRUEBA, hasta: V + 3 });
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
    const dosPasos = creaCadena([paso({ de: V, a: V + 1 }), paso({ de: V + 1, a: V + 2, renombra: { apodo: 'mote' } })]);
    const resultado = migra(doc(V, { apodo: 'x' }), { cadena: dosPasos, hasta: V + 2 });
    assert.equal(resultado.desde, V);
    assert.equal(resultado.hasta, V + 2);
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
    const deJuguete = migra(doc(V), { cadena: creaCadena([paso({ de: V, a: V + 1, introduce: { nuevo: 'sí' } })]), hasta: V + 1 });
    assert.equal(deJuguete.doc.nuevo, 'sí');
  });

  test('La comprobación de la cadena se puede poner roja con un paso de prueba mal declarado', () => {
    // El criterio literal de la spec: el mecanismo se ejercita aunque hoy solo exista
    // la versión 1. Tres maneras de ponerlo rojo, y las tres nombran qué pasa.
    assert.throws(() => compruebaCadena(creaCadena([]), { desde: V, hasta: V + 1 }), new RegExp(`falta el paso ${salto(0)}`));
    assert.throws(() => compruebaCadena(CADENA_DE_PRUEBA, { desde: V, hasta: V + 1 }), new RegExp(`fuera del tramo ${salto(0)}`));
    assert.throws(() => compruebaCadena(CADENA_DE_PRUEBA, { desde: V + 3, hasta: V }), /es anterior a/);
  });

  test('Un paso que renombra lo que el documento no trae no se inventa nada', () => {
    const cadena = creaCadena([paso({ de: V, a: V + 1, renombra: { apodo: 'mote' } })]);
    assert.throws(() => migra(doc(V), { cadena, hasta: V + 1 }), /no puede inventarse lo que no estaba/);
  });
});

// ── La primera migración de verdad: 1→2 ───────────────────────────────────────
//
// SPEC-049. Todo lo de arriba ejercita el **mecanismo** sobre la banda sintética; esto mira
// la cadena de verdad, que hasta esta fila estaba vacía. El paso introduce
// `areas.aventuras.descartesDelCasting` —contra qué sitios marcados se casteó la aventura en
// curso— con el valor declarado y no deducido: la lista vacía, que es la que esas partidas
// tenían de verdad, porque antes de esta fila el casting no se rehacía nunca.

describe('El paso 1→2 de la cadena real', () => {
  /** Un estado de partida escrito en la versión anterior: el de hoy, menos el campo nuevo. */
  function estadoEnLaUno({ conAventura = false } = {}) {
    const estado = estadoInicial({ semilla: SEMILLA_A });
    if (conAventura) {
      estado.aventuras.enCurso = { aventura: 'la-posada-sin-sitio#1', plantilla: 'la-posada-sin-sitio', mapa: 'casa', beatEnCurso: 2, resueltos: [{ n: 1, via: 'llegada', variante: null, objeto: null }] };
    }
    const doc = JSON.parse(JSON.stringify(congelaEstado(estado)));
    doc.version = 1;
    delete doc.areas.aventuras.descartesDelCasting;
    return doc;
  }

  test('El paso 1→2 declara su valor, su clase y por qué existe', () => {
    const tramo = compruebaCadena(CADENA_DEL_FORMATO, { desde: 1, hasta: 2 });
    assert.deepEqual([...tramo.saltos], ['1→2'], 'la cadena real no cubre el salto 1→2');
    const [suyo] = tramo.pasos;

    assert.deepEqual({ ...suyo.introduce }, { 'areas.aventuras.descartesDelCasting': [] }, 'el paso no introduce el campo nuevo con su valor declarado');
    assert.deepEqual([...suyo.quita], [], 'el paso quita algo, y este solo añade');
    assert.deepEqual({ ...suyo.renombra }, {}, 'el paso renombra algo, y este solo añade');
    assert.ok(suyo.porque.length > 0, 'el paso no dice por qué existe');

    // **La clase, que no es cosmética.** La versión de formato es una sola para las ocho
    // clases de documento y los campos no lo son: un paso sin clase le metería un `areas` al
    // índice de mapa, a la celda y al registro, y como `migra` valida contra el esquema
    // cerrado de cada una, una copia antigua dejaría de poder abrirse entera.
    assert.equal(suyo.clase, CLASES.ESTADO, 'el paso no declara sobre qué clase de documento se aplica');
  });

  test('Una partida de la versión 1 migra a la 2 con la huella vacía y la aventura intacta', () => {
    const resultado = migra(estadoEnLaUno({ conAventura: true }), { cadena: CADENA_DEL_FORMATO, hasta: 2 });
    assert.equal(resultado.migrado, true);
    assert.deepEqual([...resultado.saltos], ['1→2']);
    assert.equal(resultado.doc.version, 2);
    assert.deepEqual(resultado.doc.areas.aventuras.descartesDelCasting, [], 'el campo nuevo no llega con el valor que el paso declara');
    // Y lo que ya estaba cruza el salto entero: la aventura en curso sigue siendo la suya, por
    // el beat donde iba. Migrar no puede perder lo jugado.
    assert.equal(resultado.doc.areas.aventuras.enCurso.plantilla, 'la-posada-sin-sitio');
    assert.equal(resultado.doc.areas.aventuras.enCurso.beatEnCurso, 2, 'la aventura ha vuelto al principio al migrar');
    assert.equal(resultado.doc.areas.aventuras.enCurso.resueltos.length, 1);

    // Y el resultado se valida contra el esquema cerrado de su clase, que es lo que hace que
    // una migración mal escrita se vea al migrar y no tres pantallas más tarde.
    assert.equal(resultado.doc.clase, CLASES.ESTADO);
    assert.ok(levantaEstado(resultado.doc, 'la partida migrada'), 'la partida migrada no se puede levantar');
  });

  test('Una partida sin aventura en curso migra con enCurso en nulo y no en un objeto', () => {
    // El motivo por el que el campo va **al lado** de `enCurso` y no dentro: la cadena
    // introduce campos por su ruta y no sabe bifurcar, así que una ruta dentro le habría
    // puesto un objeto a toda partida que lo tenía en nulo —o sea a casi todas— y las habría
    // dejado fuera del esquema. Es la mitad que un paso mal colocado rompería en silencio.
    const resultado = migra(estadoEnLaUno(), { cadena: CADENA_DEL_FORMATO, hasta: 2 });
    assert.equal(resultado.doc.areas.aventuras.enCurso, null, 'migrar ha convertido una aventura en curso nula en un objeto');
    assert.deepEqual(resultado.doc.areas.aventuras.descartesDelCasting, []);
    assert.equal(levantaEstado(resultado.doc, 'la partida migrada').aventuras.enCurso, null);
  });

  test('Un documento de la versión 1 que no pasa por la migración da la cara nombrando el campo', () => {
    // Lo que se protege es que no se abra **a medias**: sin la huella, la cadena de la
    // aventura se recuperaría contra los sitios marcados de ahora en vez de contra los suyos,
    // que es exactamente el defecto que la migración vino a cerrar.
    const viejo = estadoEnLaUno({ conAventura: true });
    assert.throws(() => levantaEstado({ ...viejo, version: VERSION_FORMATO }, 'un documento sin migrar'), /descartesDelCasting/);
  });

  test('Un documento de otra clase sube de versión y no gana ningún campo', () => {
    // La versión se sube **siempre**, aplique el paso o no: lo que la cadena promete es que
    // todo documento de la versión N llega a la N+1. Lo que no puede es ganar un `areas` que
    // su esquema no declara, que es lo que pasaría sin la clase declarada — y como `migra`
    // valida el resultado contra el esquema cerrado de cada clase, **el documento migrado
    // dejaría de poder abrirse entero**. Se mide sobre el registro de hechos, que es la otra
    // clase que toda partida escribe y la más barata de fabricar de verdad; que la clase se
    // declara para las ocho lo afirma el caso de arriba sobre el propio paso.
    const registro = JSON.parse(JSON.stringify(congelaRegistro(registroInicial())));
    registro.version = 1;
    assert.equal(registro.clase, CLASES.REGISTRO);

    const resultado = migra(registro, { cadena: CADENA_DEL_FORMATO, hasta: 2 });
    assert.equal(resultado.migrado, true);
    assert.equal(resultado.doc.version, 2, 'el registro de hechos no ha subido de versión');
    assert.equal('areas' in resultado.doc, false, 'el paso 1→2 le ha metido un "areas" al registro de hechos, que no lo declara');
    assert.deepEqual(resultado.doc.hechos, registro.hechos, 'el paso 1→2 ha tocado el contenido del registro de hechos');
    // Y sigue abriéndose: es lo que la validación contra el esquema garantiza al migrar.
    assert.ok(levantaRegistro(resultado.doc), 'el registro migrado no se puede levantar');
  });
});
