// SPEC-039 · Guardar una copia y abrir una copia: el contenedor del fichero, el aviso de
// sustitución y las cuatro causas por las que un fichero no se abre.
//
// Todo lo de aquí vive en `app/datos/` —`empaquetador.js` y `copia.js`— y hasta esta
// iteración **no se podía ejecutar**: los dos citaban `@walkingadventure/nucleo` por su
// nombre y eso los dejaba fuera de `node --test` sin instalación, así que el fichero de
// partida entero, el fichero truncado y el aviso de sustitución solo se podían afirmar
// leyendo su fuente. Desde que el núcleo entra por la puerta se ejercitan de verdad,
// armando el generador con rutas relativas igual que hace `levantamiento-de-prueba.mjs`.
//
// La frontera con `exportacion.test.mjs` es la de siempre: allí se afirma lo que produce
// el paquete —la lista de partes, el manifiesto, la importación—; aquí lo que la app
// hace con ello —empaquetar, desempaquetar, avisar y sustituir—.
//
// Nada toca la red, el reloj ni el disco: la hoja de compartir y el selector de ficheros
// son dobles, y la partida la monta `copia-de-prueba.mjs`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CABECERA,
  CAUSAS,
  creaEmpaquetador,
  desempaqueta,
} from '../../app/datos/empaquetador.js';
import {
  CAUSAS_DE_ERROR,
  DEL_NUCLEO,
  ESTADOS_DE_ABRIR,
  ESTADOS_DE_GUARDAR,
  TEXTOS_DE_ERROR,
  creaCopia,
} from '../../app/datos/copia.js';
import { creaAlmacenDeBinarios } from '../../app/recursos/almacen-de-binarios.js';
import {
  CLASES_DE_PARTE,
  EXTENSION_DE_PARTIDA,
  NOMBRE_DEL_MANIFIESTO,
  componeExportacion,
} from '../../packages/nucleo/partida/exportacion.js';
import { CLASES, VERSION_FORMATO } from '../../packages/nucleo/partida/formato.js';
import { CLAVES } from '../../packages/nucleo/partida/mapa.js';
import { CLAVES_DE_PARTIDA, cargaPartida } from '../../packages/nucleo/partida/reconstruccion.js';
import {
  ANCLAJE_DE_CASA,
  ANCLAJE_DE_VACACIONES,
  NUCLEO_DEL_CONTENEDOR,
  NUCLEO_DE_LA_COPIA,
  almacenEnMemoria,
  mapaGuardado,
  partidaCompleta,
  volcado,
} from './copia-de-prueba.mjs';

const { empaqueta } = creaEmpaquetador(NUCLEO_DEL_CONTENEDOR);

/** El fichero de una partida ya montada, tal cual saldría del móvil. */
async function ficheroDe(partida) {
  const { partes } = await componeExportacion({ almacen: partida.almacen, binarios: partida.binarios });
  return empaqueta(partes);
}

/**
 * La hoja de compartir del sistema, doblada.
 *
 * Apunta lo que recibe y nada más, que es todo lo que la app sabe de ella: ni carpeta,
 * ni servicio, ni ruta. `falla` es la hoja que se cae, para poder afirmar qué queda.
 */
function hojaDeCompartir({ falla = false } = {}) {
  const compartido = [];
  const comparte = async ({ nombre, contenido }) => {
    if (falla) throw new Error('la hoja de compartir del sistema se ha caído');
    compartido.push({ nombre, contenido });
    return { compartida: true };
  };
  comparte.compartido = compartido;
  return comparte;
}

/** El selector de ficheros del sistema, doblado. Devuelve un contenido o una cancelación. */
function selector(contenido, { nombre = `copia${EXTENSION_DE_PARTIDA}`, cancelada = false } = {}) {
  const elige = async () => {
    elige.veces += 1;
    return cancelada ? { cancelada: true } : { cancelada: false, nombre, contenido };
  };
  elige.veces = 0;
  return elige;
}

/** Guardar y abrir una copia sobre un almacén, con las dos piezas del sistema dobladas. */
function copiaSobre({ almacen, binarios = creaAlmacenDeBinarios(), comparte = hojaDeCompartir(), elige = selector(null) } = {}) {
  return { comparte, elige, copia: creaCopia({ almacen, binarios, comparte, elige, nucleo: NUCLEO_DE_LA_COPIA }) };
}

describe('El contenedor de un fichero de partida', () => {
  test('Un fichero desempaquetado devuelve exactamente las partes que se empaquetaron', async () => {
    const partida = await partidaCompleta();
    const { partes } = await componeExportacion({ almacen: partida.almacen, binarios: partida.binarios });
    const vueltas = desempaqueta(empaqueta(partes));

    // Byte a byte y en el mismo orden: el orden es canónico y lo pone el núcleo, así que
    // un contenedor que lo alterase rompería «dos exportaciones dan el mismo fichero».
    assert.equal(
      JSON.stringify(vueltas.map((p) => [p.nombre, p.clase, p.codificacion, p.contenido])),
      JSON.stringify(partes.map((p) => [p.nombre, p.clase, p.codificacion, p.contenido])),
      'las partes que salen del contenedor no son las que entraron',
    );
    assert.equal(vueltas[0].nombre, NOMBRE_DEL_MANIFIESTO, 'el manifiesto no es la primera parte del fichero');
    // Y el binario sigue siendo texto en base64 dentro del fichero, que es lo que
    // permite leer el contenedor entero como texto y no como bytes.
    const recurso = vueltas.find((p) => p.clase === CLASES_DE_PARTE.RECURSO);
    assert.equal(recurso.nombre, partida.referencia);
    assert.match(recurso.contenido, /^[A-Za-z0-9+/=]+$/, 'el recurso no viaja en base64');
  });

  test('Un fichero truncado falla diciendo que está incompleto y nombra la parte que se corta', async () => {
    const fichero = await ficheroDe(await partidaCompleta());

    // Cortado por el cuerpo: la última parte declara más de lo que queda.
    assert.throws(() => desempaqueta(fichero.slice(0, fichero.length - 200)), (e) => {
      assert.equal(e.causa, CAUSAS.INCOMPLETO, 'un fichero truncado no se distingue de uno que no es una partida');
      assert.match(e.message, /incompleto/, 'el error no dice que el fichero está incompleto');
      assert.match(e.message, /declara \d+ y solo quedan \d+/, 'el error no dice cuánto falta');
      return true;
    });
    // Cortado por la cabecera: ni siquiera se llega a saber qué partes trae.
    assert.throws(() => desempaqueta(fichero.slice(0, 40)), (e) => {
      assert.equal(e.causa, CAUSAS.INCOMPLETO);
      assert.match(e.message, /la cabecera no termina/);
      return true;
    });
    // Y sobrando bytes, que es la otra mitad de «entero»: nadie los declara.
    assert.throws(() => desempaqueta(`${fichero}de más`), /caracteres que ninguna parte declara/);
    // Con una cabecera que miente sobre cuántas partes hay tampoco se interpreta nada.
    const lineas = fichero.split('\n');
    lineas[1] = String(Number(lineas[1]) + 1);
    assert.throws(() => desempaqueta(lineas.join('\n')), /anuncia \d+ partes y describe \d+/);
  });

  test('Un fichero que no es una partida se rechaza por su primera línea y no se interpreta', async () => {
    for (const ajeno of ['', 'hola', '{"version":1}', 'PK', `${CABECERA.slice(0, -1)}\n1\n\na`]) {
      assert.throws(() => desempaqueta(ajeno), (e) => {
        assert.equal(e.causa, CAUSAS.NO_ES_PARTIDA, `${JSON.stringify(ajeno.slice(0, 20))} no se rechaza como «no es una partida»`);
        assert.match(e.message, /no es una partida de Walking Adventure/);
        return true;
      });
    }
    for (const nada of [null, undefined, 42, {}]) {
      assert.throws(() => desempaqueta(nada), /no es una partida/);
    }
  });

  test('El contenedor sin el nombre del manifiesto inyectado no se construye', () => {
    // Un contenedor que empaquetara sin saber cuál es la primera parte escribiría
    // ficheros que nadie puede volver a abrir, y no protestaría al hacerlo.
    assert.throws(() => creaEmpaquetador(), /NOMBRE_DEL_MANIFIESTO/);
    assert.throws(() => creaEmpaquetador({ NOMBRE_DEL_MANIFIESTO: '' }), /NOMBRE_DEL_MANIFIESTO/);

    assert.throws(() => empaqueta([]), /al menos su manifiesto/);
    assert.throws(() => empaqueta([{ nombre: 'partida/estado.json', contenido: '{}' }]), new RegExp(NOMBRE_DEL_MANIFIESTO));
    // Un nombre de parte con un salto de línea rompería la cabecera entera, así que se
    // rechaza al empaquetar y no al leer un fichero que ya nadie puede arreglar.
    assert.throws(
      () => empaqueta([{ nombre: NOMBRE_DEL_MANIFIESTO, clase: CLASES_DE_PARTE.MANIFIESTO, codificacion: 'texto', contenido: '{}' }, { nombre: 'con\nsalto', contenido: '{}' }]),
      /tabuladores ni saltos de l/,
    );
  });
});

describe('Guardar una copia', () => {
  test('Guardar una copia entrega el fichero entero a la hoja de compartir y no toca la partida', async () => {
    const partida = await partidaCompleta();
    const antes = await volcado(partida.almacen);
    const { comparte, copia } = copiaSobre(partida);
    partida.almacen.registro.length = 0;

    const resultado = await copia.guarda();

    assert.equal(resultado.estado, ESTADOS_DE_GUARDAR.GUARDADA);
    assert.equal(comparte.compartido.length, 1, 'la hoja de compartir no ha recibido el fichero');
    const { nombre, contenido } = comparte.compartido[0];
    // El nombre sale del título del mundo, sin fecha y sin nada de quien juega.
    assert.equal(nombre, `marcas-de-vaeloria${EXTENSION_DE_PARTIDA}`);
    assert.doesNotMatch(nombre, /\d/, 'el nombre del fichero lleva un número, que es por donde entraría una fecha');
    // Y lo que recibe es el fichero **entero**: se desempaqueta y trae la partida.
    assert.equal(contenido, await ficheroDe(partida), 'lo compartido no es el fichero de la partida');
    assert.equal(resultado.bytes, contenido.length, 'lo que se declara guardado no mide lo que se ha compartido');
    assert.equal(desempaqueta(contenido).length, resultado.manifiesto.partes.length + 1, 'el fichero compartido no trae las partes del manifiesto más él mismo');
    assert.equal(resultado.medida.total > 0, true, 'guardar no declara cuánto ocupa lo que se ha guardado');

    // Guardar no toca la partida y no marca nada en ella: no hay «última copia».
    assert.deepEqual(partida.almacen.operaciones('escribe'), [], 'guardar una copia ha escrito en la partida');
    assert.deepEqual(partida.almacen.operaciones('borra'), [], 'guardar una copia ha borrado algo de la partida');
    assert.equal(JSON.stringify(await volcado(partida.almacen)), JSON.stringify(antes), 'la partida no es idéntica byte a byte después de guardar una copia');
  });

  test('Una exportación que falla a mitad no deja ningún fichero a medias', async () => {
    // Dos maneras de fallar y las dos terminan igual: sin fichero que nadie pueda
    // encontrarse a medias. El contenido no sale de aquí hasta que está entero, así que
    // si la partida no se puede leer, la hoja de compartir no llega a abrirse.
    const partida = await partidaCompleta();
    const antes = await volcado(partida.almacen);
    const rotos = { ...partida, almacen: { ...partida.almacen, lee: async () => { throw new Error('el almacén se ha caído a mitad'); } } };
    const { comparte, copia } = copiaSobre(rotos);

    await assert.rejects(() => copia.guarda(), /se ha caído a mitad/);
    assert.deepEqual(comparte.compartido, [], 'se ha compartido un fichero compuesto a medias');

    // Y si es la hoja del sistema la que se cae, el error sube y la partida sigue igual.
    const caida = copiaSobre({ ...partida, comparte: hojaDeCompartir({ falla: true }) });
    await assert.rejects(() => caida.copia.guarda(), /hoja de compartir/);
    assert.equal(JSON.stringify(await volcado(partida.almacen)), JSON.stringify(antes), 'la partida ha cambiado al fallar la copia');
  });

  test('Una partida sin ningún mapa se guarda igual y el fichero se llama partida', async () => {
    const almacen = almacenEnMemoria();
    const { comparte, copia } = copiaSobre({ almacen });

    const resultado = await copia.guarda();
    assert.equal(resultado.estado, ESTADOS_DE_GUARDAR.GUARDADA);
    assert.equal(comparte.compartido[0].nombre, `partida${EXTENSION_DE_PARTIDA}`, 'sin mundo que dé nombre, el fichero tiene que llamarse "partida"');
    assert.equal(desempaqueta(comparte.compartido[0].contenido).length, 1, 'una partida vacía tiene que producir su manifiesto y nada más');
    assert.equal(await copia.hayPartida(), false);
  });
});

describe('Abrir una copia', () => {
  test('Sobre una partida existente se avisa de que se va a sustituir, y sobre un móvil limpio no', async () => {
    // La decisión de `partida-guardada.md` §4 puesta donde se puede poner roja: avisar
    // cuando hay algo que perder, y no avisar cuando no lo hay —avisar por sistema es
    // como los avisos dejan de leerse—. Validar **no toca nada** en ninguno de los dos.
    const fichero = await ficheroDe(await partidaCompleta());

    const conPartida = await partidaCompleta();
    const suya = copiaSobre(conPartida);
    conPartida.almacen.registro.length = 0;
    const aviso = await suya.copia.valida(fichero);

    assert.equal(aviso.estado, ESTADOS_DE_ABRIR.SUSTITUIR, 'no se avisa de que la partida actual se pierde');
    assert.equal(aviso.sustituye, true);
    assert.equal(aviso.error, null);
    assert.equal(aviso.manifiesto.version, VERSION_FORMATO);
    assert.deepEqual(conPartida.almacen.operaciones('escribe'), [], 'validar ha escrito en la partida antes de que nadie confirme nada');

    const limpio = almacenEnMemoria();
    const nueva = copiaSobre({ almacen: limpio });
    const sinAviso = await nueva.copia.valida(fichero);
    assert.equal(sinAviso.estado, ESTADOS_DE_ABRIR.VALIDANDO, 'se avisa de sustituir en un móvil donde no hay nada que perder');
    assert.equal(sinAviso.sustituye, false);
    assert.deepEqual(await limpio.lista(''), [], 'validar ha escrito en un almacén vacío');
  });

  test('En un móvil limpio abrir una copia la abre sin preguntar, y sobre una partida se queda en el aviso', async () => {
    const original = await partidaCompleta();
    const fichero = await ficheroDe(original);

    const limpio = almacenEnMemoria();
    const binarios = creaAlmacenDeBinarios();
    const nueva = copiaSobre({ almacen: limpio, binarios, elige: selector(fichero) });
    const abierta = await nueva.copia.abre();

    assert.equal(abierta.estado, ESTADOS_DE_ABRIR.ABIERTA, 'en un móvil limpio abrir una copia tendría que abrirla');
    assert.equal(nueva.elige.veces, 1, 'no se ha abierto el selector del sistema');
    const partida = await cargaPartida({ almacen: limpio, semilla: original.semilla });
    assert.equal(partida.estado.personaje.nombre, 'Sabela', 'no ha vuelto el personaje de la copia');
    assert.ok((await limpio.lista('mapa/')).includes(CLAVES.indice(original.casa.id)), 'no ha vuelto el mundo de la copia');
    assert.equal(binarios.tiene(original.referencia), true, 'no ha vuelto el recurso binario residente');

    // Y con partida existente, abrir se detiene en el aviso: la decisión es de quien juega.
    const mia = await partidaCompleta();
    const antes = await volcado(mia.almacen);
    const suya = copiaSobre({ ...mia, elige: selector(fichero) });
    const parada = await suya.copia.abre();
    assert.equal(parada.estado, ESTADOS_DE_ABRIR.SUSTITUIR);
    assert.equal(JSON.stringify(await volcado(mia.almacen)), JSON.stringify(antes), 'abrir ha sustituido la partida sin que nadie confirmara el aviso');
  });

  test('Confirmar el aviso sustituye la partida y no deja rastro de la anterior', async () => {
    const original = await partidaCompleta();
    const fichero = await ficheroDe(original);

    // La destinataria tiene su propio mundo, distinto del de la copia.
    const destino = almacenEnMemoria();
    const suyo = await mapaGuardado({ almacen: destino, arranque: ANCLAJE_DE_VACACIONES });
    const { copia } = copiaSobre({ almacen: destino });

    const aviso = await copia.valida(fichero);
    assert.equal(aviso.sustituye, true);
    const abierta = await copia.sustituye(aviso);

    assert.equal(abierta.estado, ESTADOS_DE_ABRIR.ABIERTA);
    assert.equal(abierta.sustituye, false, 'después de sustituir se sigue anunciando que hay algo que sustituir');
    const mapas = await destino.lista('mapa/');
    assert.equal(mapas.includes(CLAVES.indice(original.casa.id)), true, 'no ha entrado el mundo de la copia');
    assert.equal(mapas.some((c) => c.includes(suyo.id) && suyo.id !== original.vacaciones.id), false, 'queda algo del mundo anterior: habría que elegir entre dos partidas');
    assert.ok((await destino.lee(CLAVES_DE_PARTIDA.estado)).includes('Sabela'), 'no ha entrado el personaje de la copia');
  });

  test('Un fichero truncado se rechaza con la causa cerrada y la partida sigue intacta', async () => {
    // El criterio entero: la causa viaja en el resultado y no se deduce leyendo el
    // texto, y la partida de quien abre el fichero no se toca ni un byte.
    const mia = await partidaCompleta();
    const antes = await volcado(mia.almacen);
    const fichero = await ficheroDe(await partidaCompleta());
    const { copia } = copiaSobre(mia);

    const fallo = await copia.valida(fichero.slice(0, fichero.length - 500));
    assert.equal(fallo.estado, ESTADOS_DE_ABRIR.NO_SE_PUDO);
    assert.equal(fallo.error.causa, CAUSAS_DE_ERROR.INCOMPLETO, 'un fichero truncado no se distingue de uno que no es una partida');
    assert.equal(fallo.error.texto, TEXTOS_DE_ERROR[CAUSAS_DE_ERROR.INCOMPLETO]);
    assert.match(fallo.error.texto, /sigue como estaba/, 'la línea de error no dice que la partida actual sigue intacta');
    assert.match(fallo.error.detalle, /incompleto/, 'el detalle no explica qué le pasa al fichero');
    assert.equal(JSON.stringify(await volcado(mia.almacen)), JSON.stringify(antes), 'la partida ha cambiado al rechazar un fichero truncado');
  });

  test('Las cuatro causas por las que un fichero no se abre se distinguen entre ellas', async () => {
    const partida = await partidaCompleta();
    const { copia } = copiaSobre({ almacen: almacenEnMemoria() });
    const { partes } = await componeExportacion({ almacen: partida.almacen, binarios: partida.binarios });
    // Los ficheros manipulados se vuelven a empaquetar en vez de retocarse a mano: así
    // las longitudes de la cabecera siguen cuadrando y cada caso rompe **una** cosa.
    const con = (cambia) => {
      const doc = JSON.parse(partes[0].contenido);
      cambia(doc);
      return empaqueta([{ ...partes[0], contenido: JSON.stringify(doc) }, ...partes.slice(1)]);
    };

    // No es una partida: se mira la primera línea y no se interpreta nada más.
    assert.equal((await copia.valida('esto es una foto')).error.causa, CAUSAS_DE_ERROR.NO_ES_PARTIDA);
    // Una versión que este juego todavía no entiende, con las dos versiones en el detalle.
    const futura = await copia.valida(con((doc) => { doc.version = VERSION_FORMATO + 7; }));
    assert.equal(futura.error.causa, CAUSAS_DE_ERROR.VERSION_MAYOR, 'una copia del futuro no se distingue de un fichero cualquiera');
    assert.match(futura.error.detalle, new RegExp(String(VERSION_FORMATO + 7)), 'el detalle no declara la versión que trae el fichero');
    assert.match(futura.error.detalle, new RegExp(`\\b${VERSION_FORMATO}\\b`), 'el detalle no declara la versión que se esperaba');
    // Y un manifiesto que no es un manifiesto tampoco cuela por ser la primera parte.
    assert.equal((await copia.valida(con((doc) => { doc.clase = CLASES.ESTADO; }))).error.causa, CAUSAS_DE_ERROR.NO_ES_PARTIDA);
    assert.equal((await copia.valida(empaqueta([{ ...partes[0], contenido: 'esto no es JSON' }, ...partes.slice(1)]))).error.causa, CAUSAS_DE_ERROR.NO_ES_PARTIDA);

    // Y un salto de versión sin paso registrado: no se interpreta con las reglas nuevas,
    // se dice que falta la migración. Es la cuarta causa, y hoy se puede provocar con la
    // versión de formato todavía en 1 porque nada por debajo de la mínima tiene cadena.
    const estado = partes.find((p) => p.nombre === CLAVES_DE_PARTIDA.estado);
    const antigua = empaqueta(partes.map((p) => (p === estado
      ? { ...p, contenido: JSON.stringify({ ...JSON.parse(p.contenido), version: 0 }) }
      : p)));
    const falta = await copia.valida(antigua);
    assert.equal(falta.error.causa, CAUSAS_DE_ERROR.FALTA_MIGRACION, 'un documento de una versión sin paso registrado se abre con las reglas nuevas');
    assert.match(falta.error.detalle, new RegExp(CLAVES_DE_PARTIDA.estado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'el detalle no nombra la parte que no se puede migrar');

    // Las cuatro causas tienen su línea, y ninguna menciona rutas, códigos ni la red.
    assert.deepEqual(Object.keys(TEXTOS_DE_ERROR).sort(), Object.values(CAUSAS_DE_ERROR).sort(), 'hay causas sin línea que enseñar, o líneas sin causa');
    for (const [causa, texto] of Object.entries(TEXTOS_DE_ERROR)) {
      assert.match(texto, /Tu partida sigue como estaba\.$/, `la línea de "${causa}" no dice que la partida actual sigue intacta`);
      assert.doesNotMatch(texto, /\/|https?:|error|c[oó]digo|red/i, `la línea de "${causa}" habla de rutas, códigos o de la red`);
    }
  });

  test('Cancelar el selector de ficheros no es un error y no toca nada', async () => {
    const mia = await partidaCompleta();
    const antes = await volcado(mia.almacen);
    const { copia } = copiaSobre({ ...mia, elige: selector(null, { cancelada: true }) });

    const resultado = await copia.abre();
    assert.equal(resultado.estado, ESTADOS_DE_ABRIR.INACTIVA, 'cancelar deja la pantalla en un estado que no es el de reposo');
    assert.equal(resultado.cancelada, true);
    assert.equal(resultado.error, null, 'cancelar se cuenta como un error');
    assert.equal(JSON.stringify(await volcado(mia.almacen)), JSON.stringify(antes));
  });
});

describe('Guardar y abrir una copia se construyen enteras o no se construyen', () => {
  test('Sin las piezas del sistema o sin núcleo no se construye, y el error nombra la que falta', async () => {
    const partida = await partidaCompleta();
    const completo = { almacen: partida.almacen, binarios: partida.binarios, comparte: hojaDeCompartir(), elige: selector(null), nucleo: NUCLEO_DE_LA_COPIA };

    assert.throws(() => creaCopia({ ...completo, almacen: null }), /almac[eé]n/i);
    assert.throws(() => creaCopia({ ...completo, comparte: null }), /hoja de compartir/);
    assert.throws(() => creaCopia({ ...completo, elige: null }), /selector de ficheros/);
    assert.throws(() => creaCopia({ ...completo, nucleo: null }), /n[uú]cleo inyectado/);
    assert.throws(() => creaCopia(), /almac[eé]n/i);

    // Y una pieza del generador a la vez: al construir, no al abrir el fichero de otra
    // persona, que es cuando ya no hay a quién decírselo.
    assert.equal(DEL_NUCLEO.length, 13, `el núcleo de la copia enumera ${DEL_NUCLEO.length} piezas y la comprobación esperaba 13`);
    assert.deepEqual([...DEL_NUCLEO].sort(), Object.keys(NUCLEO_DE_LA_COPIA).sort(), 'el bundle de prueba y lo que la copia exige han dejado de ser lo mismo');
    for (const pieza of DEL_NUCLEO) {
      assert.throws(
        () => creaCopia({ ...completo, nucleo: { ...NUCLEO_DE_LA_COPIA, [pieza]: undefined } }),
        new RegExp(pieza),
        `guardar y abrir una copia se ha construido con un núcleo sin "${pieza}"`,
      );
    }
  });

  test('Los estados de guardar y de abrir son vocabulario cerrado', async () => {
    // Lo consumen `guardar-copia-estado` y `abrir-copia-estado`: una pantalla que
    // decidiera comparando cadenas sueltas se rompería al corregir una tilde.
    assert.deepEqual(Object.values(ESTADOS_DE_GUARDAR).sort(), ['empaquetando', 'guardada', 'inactiva', 'no-se-pudo']);
    assert.deepEqual(Object.values(ESTADOS_DE_ABRIR).sort(), ['abierta', 'inactiva', 'no-se-pudo', 'sustituir', 'validando']);
    assert.deepEqual(Object.values(CAUSAS_DE_ERROR).sort(), ['falta-migracion', 'incompleto', 'no-es-partida', 'version-mayor']);
    for (const vocabulario of [ESTADOS_DE_GUARDAR, ESTADOS_DE_ABRIR, CAUSAS_DE_ERROR, TEXTOS_DE_ERROR]) {
      assert.equal(Object.isFrozen(vocabulario), true, 'un vocabulario cerrado que se puede ampliar en caliente no es cerrado');
    }

    // Y lo que la copia expone es esto y nada más: cualquier acción nueva —borrar la
    // partida, exportar solo el mundo— tiene que ponerse roja aquí antes de existir.
    const { copia } = copiaSobre({ almacen: almacenEnMemoria() });
    assert.deepEqual(Object.keys(copia).sort(), ['abre', 'guarda', 'hayPartida', 'sustituye', 'valida']);
  });
});
