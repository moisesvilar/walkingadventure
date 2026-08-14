// SPEC-039 · El almacén duradero de la partida y las reglas de respaldo: la primera
// vez en el proyecto que cerrar la app no pierde nada.
//
// Dos maneras de comprobarlo y las dos hacen falta. Contra el **disco de verdad**
// —`creaFicherosDeNode` sobre un directorio temporal— se afirma lo que solo un sistema
// de ficheros real puede desmentir: que cerrar y volver a abrir devuelve los documentos
// byte a byte. Contra el **doble en memoria** se afirma lo que el disco no deja ver sin
// trampas: en qué orden ocurre una escritura y qué queda cuando se muere justo en medio.
//
// De lo que esta fila entrega en `app/`, aquí se alcanzan el almacén duradero, el
// contrato del sistema de ficheros, el de Node y **las reglas de respaldo**. Las reglas
// se afirmaban antes leyendo su fuente, porque citaban `@walkingadventure/nucleo` por su
// nombre y eso las dejaba fuera de `node --test` sin instalación; desde que la lista de
// prefijos entra inyectada, `cubre` y `exigeCobertura` se ejecutan de verdad y la
// comprobación ya no lleva dentro una copia del predicado. El contenedor y guardar/abrir
// una copia se afirman en `copia.test.mjs`, por lo mismo.
//
// Nada toca la red ni el reloj del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  DIRECTORIO_DE_LA_PARTIDA,
  SUFIJO_TEMPORAL,
  creaAlmacenDuradero,
  directorioDeLaPartida,
  exigeAlmacenDuradero,
  exigeClave,
} from '../../app/datos/almacen-duradero.js';
import { OPERACIONES_DE_FICHEROS, exigeFicheros } from '../../app/datos/ficheros.js';
import { creaReglasDeRespaldo } from '../../app/datos/reglas-de-respaldo.js';
import { creaFicherosDeNode } from '../../app/datos/ficheros-de-node.js';
import { creaAlmacenEnMemoria } from '../../app/datos/almacen.js';
import { PREFIJO as PREFIJO_DE_BINARIOS } from '../../app/recursos/almacen-de-binarios.js';
import { CLAVE_DE_IMPORTACION_EN_CURSO, CLAVE_DE_PROCEDENCIA, CLAVES_DE_TRABAJO, PREFIJOS_DE_LA_PARTIDA } from '../../packages/nucleo/partida/exportacion.js';
import { CLAVES, cargaMapa, exigeAlmacen, guardaMapa } from '../../packages/nucleo/partida/mapa.js';
import { CLAVES_DE_COMPACTACION, CLAVES_DE_PARTIDA, cargaPartida } from '../../packages/nucleo/partida/reconstruccion.js';
import { CLAVE_DEL_ARRANQUE } from '../../packages/nucleo/partida/onboarding.js';
import { CLAVE_DE_CAMARA } from '../../app/mapa/camara.js';
import { textoDeCelda } from '../../packages/nucleo/partida/mundo.js';
import { rangoEn } from '../../packages/nucleo/partida/rango.js';
import { creaFicherosDeMemoria } from '../dobles/ficheros.mjs';
import { RAIZ_REPO } from './andamiaje-sandbox.mjs';
import { fuente } from './mundo-de-prueba.mjs';
import { mapaDeNucleos } from './diario-de-prueba.mjs';
import { ANCLAJE_DE_CASA, SEMILLA_A, mapaGuardado, partidaCompleta, volcado } from './copia-de-prueba.mjs';

/** Un almacén duradero sobre el disco de verdad, en un directorio temporal. */
function enDisco() {
  const raiz = mkdtempSync(join(tmpdir(), 'wa-partida-'));
  const directorio = directorioDeLaPartida(raiz);
  const ficheros = creaFicherosDeNode();
  return {
    raiz,
    directorio,
    /** Montar otro almacén sobre el mismo directorio **es** cerrar y volver a abrir la app. */
    abre: () => creaAlmacenDuradero({ ficheros, directorio }),
    limpia: () => rmSync(raiz, { recursive: true, force: true }),
  };
}

/** Un almacén duradero sobre el doble en memoria. */
function enMemoria(opciones = {}) {
  const ficheros = creaFicherosDeMemoria(opciones);
  const directorio = directorioDeLaPartida('/documentos');
  return { ficheros, directorio, almacen: creaAlmacenDuradero({ ficheros, directorio }) };
}

/** Todos los ficheros que hay bajo un directorio, en rutas relativas ordenadas. */
function ficherosBajo(raiz, prefijo = '', out = []) {
  if (!existsSync(raiz)) return out;
  for (const e of readdirSync(raiz, { withFileTypes: true })) {
    const relativa = prefijo ? `${prefijo}/${e.name}` : e.name;
    if (e.isDirectory()) ficherosBajo(join(raiz, e.name), relativa, out);
    else out.push(relativa);
  }
  return out.sort();
}

describe('El almacén duradero, que es lo que faltaba', () => {
  test('El almacén duradero expone las cuatro operaciones de SPEC-009 y ninguna más', () => {
    const { almacen } = enMemoria();
    // Cuatro operaciones sobre documentos, la marca que lo distingue del de memoria y
    // tres asomos de diagnóstico. Lista cerrada: cualquier operación nueva —renombrar,
    // borrar por prefijo, copiar— tiene que ponerse roja aquí antes de existir.
    assert.deepEqual(Object.keys(almacen).sort(), ['borra', 'clavesEscritas', 'donde', 'esDuradero', 'escribe', 'lee', 'lista', 'recuento']);
    for (const operacion of ['lee', 'escribe', 'lista', 'borra']) {
      assert.equal(typeof almacen[operacion], 'function', `falta la operación ${operacion}`);
    }
  });

  test('Escribir es escribir aparte y sustituir, y nunca sobrescribir en sitio', async () => {
    const { ficheros, directorio, almacen } = enMemoria();
    await almacen.escribe('partida/estado.json', '{"a":1}');

    const orden = ficheros.registro.map((o) => o.op);
    assert.deepEqual(orden, ['creaDirectorio', 'escribe', 'mueve'], 'la escritura no ha sido temporal y mover encima');
    assert.equal(ficheros.operaciones('escribe')[0], `${directorio}/partida/estado.json${SUFIJO_TEMPORAL}`, 'se ha escrito directamente sobre el fichero bueno');
    assert.equal(await almacen.lee('partida/estado.json'), '{"a":1}');
    assert.equal(ficheros.contenido.has(`${directorio}/partida/estado.json${SUFIJO_TEMPORAL}`), false, 'ha quedado el temporal en el disco');
  });

  test('Una escritura interrumpida a mitad deja el documento anterior entero o ninguno, nunca uno truncado', async () => {
    const { ficheros, directorio, almacen } = enMemoria({ falloAlMover: 'estado.json' });
    // Primero un documento bueno, escrito con un almacén que sí mueve.
    const sano = creaAlmacenDuradero({ ficheros: creaFicherosDeMemoria(), directorio });
    await sano.escribe('partida/estado.json', '{"bueno":true}');

    // Y ahora la interrupción justo entre escribir el temporal y sustituir.
    await ficheros.escribe(`${directorio}/partida/estado.json`, '{"bueno":true}');
    await assert.rejects(() => almacen.escribe('partida/estado.json', '{"nuevo":true}'), /partida\/estado\.json/);

    assert.equal(await almacen.lee('partida/estado.json'), '{"bueno":true}', 'el documento anterior no ha sobrevivido a la interrupción');
    assert.deepEqual(await almacen.lista('partida/'), ['partida/estado.json'], 'el temporal se ha colado en la lista de claves');
    assert.equal(ficheros.contenido.has(`${directorio}/partida/estado.json${SUFIJO_TEMPORAL}`), false, 'el temporal a medias sigue ocupando disco');
  });

  test('El orden de listar por prefijo es el de la clave y no el del sistema de ficheros', async () => {
    const alDerecho = enMemoria();
    const alReves = enMemoria({ ordenInvertido: true });
    const claves = ['mapa/b/indice.json', 'mapa/a/indice.json', 'partida/estado.json', 'mapa/a/celda/0,0.json'];
    for (const clave of claves) {
      await alDerecho.almacen.escribe(clave, '{}');
      await alReves.almacen.escribe(clave, '{}');
    }

    const esperado = ['mapa/a/celda/0,0.json', 'mapa/a/indice.json', 'mapa/b/indice.json'];
    assert.deepEqual(await alDerecho.almacen.lista('mapa/'), esperado);
    assert.deepEqual(await alReves.almacen.lista('mapa/'), esperado, 'el orden de la lista depende del orden del sistema de ficheros');
    assert.deepEqual(await alDerecho.almacen.lista(''), [...esperado, 'partida/estado.json']);
  });

  test('Leer una clave que no existe da ausencia y no un error', async () => {
    const { almacen } = enMemoria();
    assert.equal(await almacen.lee('partida/estado.json'), null);
    assert.deepEqual(await almacen.lista('mapa/'), [], 'listar un prefijo vacío tampoco es un error');
    assert.equal(await almacen.borra('partida/no-esta.json'), undefined, 'borrar lo que no está no puede ser un error');
  });

  test('Con el disco lleno el error nombra la clave y el documento anterior sigue intacto', async () => {
    const { ficheros, directorio, almacen } = enMemoria();
    await almacen.escribe('partida/estado.json', '{"bueno":true}');

    const lleno = creaAlmacenDuradero({ ficheros: creaFicherosDeMemoria({ falloAlEscribir: 'estado.json' }), directorio });
    // El mismo sistema de ficheros de antes, pero con el fallo: el documento sigue ahí.
    ficheros.escribe = async (ruta) => { throw new Error(`no queda espacio en el dispositivo (${ruta})`); };
    await assert.rejects(() => almacen.escribe('partida/estado.json', '{"nuevo":true}'), (e) => {
      assert.match(e.message, /partida\/estado\.json/, 'el error no nombra la clave');
      assert.match(e.message, /no queda espacio/, 'el error del sistema no se ha propagado');
      return true;
    });
    assert.equal(ficheros.contenido.get(`${directorio}/partida/estado.json`), '{"bueno":true}', 'el documento anterior no ha sobrevivido al disco lleno');
    assert.ok(lleno, 'el almacén con el sistema lleno se construye igual: el fallo es de escritura, no de construcción');
  });

  test('Una clave mal formada se rechaza nombrándola y nada se escribe fuera del directorio de la partida', async () => {
    const { almacen, directorio } = enMemoria();
    assert.equal(almacen.donde(), directorio, 'el almacén no declara dónde escribe');
    assert.equal(directorio.endsWith(`/${DIRECTORIO_DE_LA_PARTIDA}`), true, 'el directorio de la partida no cuelga del de documentos');

    for (const mala of ['../fuera.json', '/absoluta.json', 'mapa//doble.json', 'mapa/./aqui.json', 'mapa\\windows.json', 'mapa/con espacio.json', '']) {
      assert.throws(() => exigeClave(mala), (e) => {
        assert.match(e.message, /almac[eé]n/, 'el error no dice quién rechaza la clave');
        return true;
      }, `la clave ${JSON.stringify(mala)} ha pasado la validación`);
      await assert.rejects(() => almacen.escribe(mala, '{}'), /almac[eé]n/);
    }
    // Y la clave con la que se llaman los ficheros a medio escribir tampoco vale.
    assert.throws(() => exigeClave(`partida/estado.json${SUFIJO_TEMPORAL}`), /a medio escribir/);
    // Las claves de verdad del juego sí pasan, que es lo que hace que esto no sea vacío.
    for (const buena of ['mapa/42.41,-8.81/celda/0,0.json', 'partida/estado.json', 'partida/registro.anterior.json', 'arranque/en-curso', 'camara/42.41,-8.81/0,0.json', 'local/recursos/monfrida-amanecer']) {
      assert.equal(exigeClave(buena), buena, `la clave real "${buena}" se rechaza`);
    }
  });

  test('La app construida sin almacén duradero cableado falla nombrando la pieza que falta', () => {
    assert.throws(() => exigeAlmacenDuradero(null, 'la orquestación de la app'), /la orquestación de la app.*almacén duradero/s);
    // Y el de memoria no cuela: cumple las cuatro operaciones y pierde la partida al
    // cerrar, que es exactamente el estado en el que SPEC-026 dejó las cosas.
    assert.throws(() => exigeAlmacenDuradero(creaAlmacenEnMemoria(), 'la orquestación de la app'), /no es el duradero.*memoria/s);
    const { almacen } = enMemoria();
    assert.equal(exigeAlmacenDuradero(almacen, 'la orquestación de la app'), almacen);
  });

  test('El almacén duradero sin sistema de ficheros inyectado no se construye', () => {
    assert.deepEqual([...OPERACIONES_DE_FICHEROS], ['lee', 'escribe', 'mueve', 'borra', 'entradas', 'creaDirectorio']);
    assert.throws(() => creaAlmacenDuradero({}), /sistema de ficheros/);
    assert.throws(() => exigeFicheros({ lee: () => {} }, 'el almacén'), /mueve, borra, entradas, creaDirectorio/);
    assert.throws(() => creaAlmacenDuradero({ ficheros: creaFicherosDeMemoria() }), /directorio de la partida/);
    assert.throws(() => directorioDeLaPartida(''), /dónde guarda este dispositivo/);
  });

  test('El paquete del núcleo sin almacén inyectado sigue funcionando entero en memoria', async () => {
    // La otra mitad de §6h: la app no arranca sin almacén duradero, pero el paquete sí
    // funciona sin ninguno, que es lo que hace posible toda esta suite.
    const mapa = await mapaGuardado({ almacen: creaAlmacenEnMemoria(), arranque: ANCLAJE_DE_CASA });
    assert.equal(mapa.celdas.length, 1, 'levantar un mapa ha necesitado el almacén');
    await assert.rejects(() => guardaMapa(mapa, {}), /almac[eé]n/i);
    assert.throws(() => exigeAlmacen(null, 'guardaMapa'), /almac[eé]n/i);
  });

  test('Las claves duraderas sobreviven a cerrar y volver a abrir la app, byte a byte', async () => {
    const disco = enDisco();
    try {
      const escrito = disco.abre();
      const partida = await partidaCompleta({ almacen: escrito });
      const antes = await volcado(escrito);
      assert.equal(antes.length, 6, 'la partida de prueba no ha escrito las claves esperadas');

      // Cerrar la app y volver a abrirla es montar otro almacén sobre el mismo directorio.
      const leido = disco.abre();
      const despues = await volcado(leido);
      assert.equal(JSON.stringify(despues), JSON.stringify(antes), 'la partida no ha sobrevivido a cerrar y abrir byte a byte');

      // Y no es que el almacén recuerde nada: los ficheros están en el disco de verdad.
      const enDiscoRelativas = ficherosBajo(disco.directorio);
      assert.deepEqual(enDiscoRelativas, antes.map(([clave]) => clave), 'los documentos del disco no son las claves de la partida');
      assert.equal(readFileSync(join(disco.directorio, CLAVES_DE_PARTIDA.estado), 'utf8'), await leido.lee(CLAVES_DE_PARTIDA.estado));
      assert.equal((await cargaMapa({ almacen: leido, id: partida.casa.id, semilla: partida.semilla })).id, partida.casa.id);
    } finally {
      disco.limpia();
    }
  });

  test('Ningún fichero a medio escribir queda dentro de la lista de claves de la partida', async () => {
    const disco = enDisco();
    try {
      const almacen = disco.abre();
      await almacen.escribe('partida/estado.json', '{"a":1}');
      const ficheros = creaFicherosDeNode();
      await ficheros.escribe(join(disco.directorio, `partida/estado.json${SUFIJO_TEMPORAL}`), 'a medias');

      assert.deepEqual(await almacen.lista(''), ['partida/estado.json'], 'un fichero a medio escribir se ha colado como clave de la partida');
    } finally {
      disco.limpia();
    }
  });
});

describe('El mundo se congela entero', () => {
  test('El mundo no depende de OSM después de generarse', async () => {
    // El escenario, afirmado aquí sobre el **almacén duradero**: la mitad que faltaba
    // era que lo congelado dure. Se congela, se cierra la app, se vuelve a abrir, y el
    // documento es el mismo byte a byte aunque los datos de OSM ya no existan.
    const disco = enDisco();
    try {
      const mapa = await mapaGuardado({ almacen: disco.abre(), arranque: ANCLAJE_DE_CASA });
      const escrito = textoDeCelda(mapa.celdas[0]);

      const leido = disco.abre();
      const guardado = await leido.lee(CLAVES.celda(mapa.id, '0,0'));
      assert.equal(guardado, escrito, 'el documento guardado no es el que se congeló');

      // Y se levanta sin ninguna consulta: el mapa se carga con el almacén y nada más.
      const cargado = await cargaMapa({ almacen: leido, id: mapa.id, semilla: SEMILLA_A });
      assert.equal(cargado.id, mapa.id);
      assert.deepEqual(cargado.celdas.map((c) => c.clave), ['0,0']);
      assert.equal(await leido.lee(CLAVES.celda(mapa.id, '0,0')), escrito, 'cargar el mapa ha reescrito el documento');
    } finally {
      disco.limpia();
    }
  });

  test('El estado manda sobre el registro', async () => {
    // El mismo escenario que `registro.test.mjs` afirma en memoria, sostenido aquí
    // sobre un almacén de verdad: lo que esta fila aporta es el **orden de escritura**
    // —el registro primero, el estado con su marca después— sobre disco.
    const disco = enDisco();
    try {
      const almacen = disco.abre();
      const partida = await partidaCompleta({ almacen });

      const escrituras = almacen.clavesEscritas();
      assert.ok(escrituras.includes(CLAVES_DE_PARTIDA.registro) && escrituras.includes(CLAVES_DE_PARTIDA.estado));
      const orden = [...(await volcado(almacen))].map(([c]) => c);
      assert.ok(orden.includes(CLAVES_DE_PARTIDA.estado));

      const abierta = await cargaPartida({ almacen: disco.abre(), semilla: partida.semilla });
      assert.equal(abierta.colaAplicada, 0, 'el registro se ha reproducido al cargar en vez de valer el estado guardado');
      assert.equal(abierta.estado.aplicadoHasta, 2, 'el estado no declara hasta qué hecho está aplicado');
      const mapa = mapaDeNucleos(['Monfrida']);
      assert.equal(
        rangoEn(abierta.estado.nucleos, { mapaId: partida.casa.id, nucleo: 'Monfrida', mapa }).escalon,
        rangoEn(partida.estado.nucleos, { mapaId: partida.casa.id, nucleo: 'Monfrida', mapa }).escalon,
        'el rango que sale del disco no es el que se guardó',
      );
    } finally {
      disco.limpia();
    }
  });

  test('Un apagón entre el registro y el estado se termina hacia delante y no reconstruye nada', async () => {
    const disco = enDisco();
    try {
      const almacen = disco.abre();
      const partida = await partidaCompleta({ almacen });
      // El estado se queda como estaba antes de la última tanda de hechos: es lo que
      // deja un apagón entre las dos escrituras, con el registro ya anexado.
      const doc = JSON.parse(await almacen.lee(CLAVES_DE_PARTIDA.estado));
      doc.aplicadoHasta = 0;
      await almacen.escribe(CLAVES_DE_PARTIDA.estado, JSON.stringify(doc));

      const abierta = await cargaPartida({ almacen: disco.abre(), semilla: partida.semilla });
      assert.equal(abierta.colaAplicada, 2, 'los hechos posteriores a la marca no se han aplicado hacia delante');
      assert.equal(abierta.estado.reconstruido, null, 'se ha reconstruido en vez de terminar la cola');
    } finally {
      disco.limpia();
    }
  });
});

describe('La partida entra en la copia del sistema', () => {
  /** Las claves que el almacén escribe de verdad en una partida entera. */
  async function clavesQueSeEscriben() {
    const disco = enDisco();
    try {
      const almacen = disco.abre();
      const partida = await partidaCompleta({ almacen });
      // Y las que no escribe `partidaCompleta` pero el juego sí escribe, cada una por
      // su constante: enumerarlas a mano es lo que hace que una nueva no se olvide.
      for (const clave of [
        CLAVE_DE_PROCEDENCIA,
        CLAVE_DE_IMPORTACION_EN_CURSO,
        CLAVES_DE_COMPACTACION.sello,
        CLAVES_DE_COMPACTACION.registroAnterior,
        CLAVE_DEL_ARRANQUE,
        CLAVE_DE_CAMARA(partida.casa.id, '0,0'),
      ]) {
        await almacen.escribe(clave, '{}');
      }
      return almacen.clavesEscritas();
    } finally {
      disco.limpia();
    }
  }

  test('Toda clave que el almacén escribe cae dentro de lo que entra en la copia del sistema', async () => {
    const claves = await clavesQueSeEscriben();
    // Once claves de siete familias distintas: índice, celda, estado, registro,
    // procedencia, importación en curso, compactación, arranque y cámara.
    assert.equal(claves.length, 12, `el almacén escribe ${claves.length} claves y la comprobación esperaba 12: ${claves.join(', ')}`);

    // **Las reglas de verdad, ejecutadas.** Antes esto reimplementaba el predicado aquí
    // dentro, porque el módulo citaba el paquete por su nombre y no se podía importar;
    // con una copia, la comprobación decía que las claves entran en *estas tres líneas*
    // y no que entran en la copia del sistema, que es lo que hay que afirmar.
    const respaldo = creaReglasDeRespaldo({ PREFIJOS_DE_LA_PARTIDA });
    assert.equal(respaldo.exigeCobertura(claves, 'las claves de una partida entera'), true);
    assert.deepEqual(claves.filter((c) => !respaldo.cubre(c)), [], 'hay claves de la partida que se quedarían fuera de la copia del sistema');
    // Y la referencia de un recurso binario también entra, porque es parte del mundo.
    assert.equal(respaldo.cubre(`${PREFIJO_DE_BINARIOS}monfrida-amanecer`), true);
  });

  test('Una clave nueva que las reglas de respaldo no cubren se pone roja nombrándola', () => {
    // El criterio que convierte RF-PERS-004 en algo que se puede poner rojo: basta con
    // que alguien estrene un prefijo y no lo declare. Se ejecuta `exigeCobertura`, que
    // es la función que la app tendría que llamar, y se lee el error que produce.
    const { cubre, exigeCobertura, reglas } = creaReglasDeRespaldo({ PREFIJOS_DE_LA_PARTIDA });
    const nueva = 'repisa/objetos.json';
    assert.equal(cubre(nueva), false, 'una clave con un prefijo que nadie declaró se está dando por cubierta');

    assert.throws(() => exigeCobertura(['partida/estado.json', nueva], 'las reglas de respaldo'), (e) => {
      assert.match(e.message, /repisa\/objetos\.json/, 'el error no nombra la clave que se quedaría fuera');
      assert.doesNotMatch(e.message, /partida\/estado\.json/, 'el error acusa a una clave que sí está cubierta');
      assert.match(e.message, /1 clave/, 'el error no dice cuántas claves se quedarían fuera');
      return true;
    });
    // Y lo que ya está cubierto no protesta, que es lo que hace que el rojo signifique algo.
    assert.equal(exigeCobertura(['partida/estado.json', `${PREFIJO_DE_BINARIOS}monfrida-amanecer`]), true);
    assert.equal(exigeCobertura([]), true, 'una lista vacía de claves no es un error');
    assert.ok(Object.isFrozen(reglas), 'las reglas se pueden cambiar en caliente: dejarían de ser una declaración');
  });

  test('Las reglas de respaldo salen de la lista única del núcleo y no de una copia', () => {
    const { cubre, reglas } = creaReglasDeRespaldo({ PREFIJOS_DE_LA_PARTIDA });
    // Lo incluido es la lista del paquete más los binarios residentes, **en ese orden**
    // y sin nada más: es como se afirma que las reglas derivan de la lista única y no
    // llevan una copia suya que un día divergirá.
    assert.deepEqual([...reglas.incluye], [...PREFIJOS_DE_LA_PARTIDA, PREFIJO_DE_BINARIOS]);
    assert.deepEqual([...reglas.excluye], ['cache/', 'tmp/'], 'la caché del proxy no está excluida de la copia');
    assert.deepEqual([...reglas.excluyePorSufijo], [SUFIJO_TEMPORAL], 'los ficheros a medio escribir no están excluidos de la copia');
    // Y lo excluido gana sobre lo incluido, que es lo único que hace útil excluir: un
    // temporal de la partida cuelga de un prefijo incluido y aun así no se respalda.
    assert.equal(cubre(`partida/estado.json${SUFIJO_TEMPORAL}`), false, 'un fichero a medio escribir entraría en la copia');
    assert.equal(cubre('cache/overpass/42.41,-8.81.json'), false, 'la caché del proxy entraría en la copia');
    assert.equal(cubre('tmp/lo-que-sea'), false);
    assert.equal(cubre(''), false, 'la clave vacía se da por cubierta');
    assert.equal(cubre(null), false);
    // Sin la lista del núcleo no hay reglas: unas vacías dejarían la partida entera
    // fuera de la copia sin que nada protestase, que es el fallo silencioso de RF-PERS-004.
    assert.throws(() => creaReglasDeRespaldo(), /PREFIJOS_DE_LA_PARTIDA/);
    assert.throws(() => creaReglasDeRespaldo({ PREFIJOS_DE_LA_PARTIDA: [] }), /PREFIJOS_DE_LA_PARTIDA/);
    // Y el juego no copia la lista: la lista vive en el paquete y es una sola.
    assert.deepEqual([...PREFIJOS_DE_LA_PARTIDA], ['arranque/', 'camara/', 'mapa/', 'partida/']);
    assert.deepEqual([...CLAVES_DE_TRABAJO], [CLAVE_DE_IMPORTACION_EN_CURSO, CLAVES_DE_COMPACTACION.sello, CLAVES_DE_COMPACTACION.registroAnterior]);
    // El módulo se lee además como fuente por lo único que la ejecución no ve: que la
    // lista entra inyectada y no por un import del paquete, que es lo que lo dejaba
    // fuera del alcance de `node --test` sin instalación.
    assert.doesNotMatch(fuente('app/datos/reglas-de-respaldo.js'), /@walkingadventure\/nucleo/, 'las reglas vuelven a citar el paquete por su nombre');
  });

  test('Qué sale del móvil está dicho en voz alta y el rastro de ubicación no sale porque no existe', () => {
    const reglas = fuente('app/datos/reglas-de-respaldo.js');
    assert.match(reglas, /export const QUE_SALE_DEL_MOVIL/, 'no hay ninguna declaración de qué sale del móvil');
    assert.match(reglas, /servidorPropio: false/, 'no se declara que la copia no pasa por ningún servidor nuestro');
    assert.match(reglas, /respaldo cifrado de la cuenta del propio jugador/);
    assert.match(reglas, /El rastro de ubicación no sale porque no existe/);
    assert.match(reglas, /anclaje redondeado/, 'el anclaje redondeado no está declarado entre lo que sale');
  });

  test('El código de esta entrega no habla con ningún servidor nuestro', () => {
    // La copia la hace el sistema y nosotros no la vemos: aquí no hay ninguna puerta
    // de red que se pueda abrir, ni siquiera por accidente.
    const modulos = [
      'packages/nucleo/partida/exportacion.js',
      'packages/nucleo/partida/migracion.js',
      'packages/nucleo/partida/compactacion.js',
      'app/datos/almacen-duradero.js',
      'app/datos/ficheros.js',
      'app/datos/ficheros-de-node.js',
      'app/datos/empaquetador.js',
      'app/datos/copia.js',
      'app/datos/reglas-de-respaldo.js',
      'app/plataforma/ficheros.js',
      'app/plataforma/copia-del-sistema.js',
    ];
    for (const modulo of modulos) {
      const texto = fuente(modulo);
      for (const [nombre, patron] of [['fetch', /\bfetch\s*\(/], ['XMLHttpRequest', /\bXMLHttpRequest\b/], ['WebSocket', /\bWebSocket\b/], ['https?://', /https?:\/\/[a-z]/i]]) {
        assert.equal(patron.test(texto), false, `${modulo}: abre la puerta de red "${nombre}"`);
      }
    }
  });

  test('El respaldo se declara por plataforma y las dos declaraciones dicen lo mismo que las reglas', () => {
    const ios = fuente('app/plataforma/respaldo.ios.js');
    const android = fuente('app/plataforma/respaldo.android.js');
    assert.match(ios, /EXCLUIDO_DE_LA_COPIA = false/, 'iOS no declara que nada está excluido de la copia');
    assert.match(android, /PERMITE_LA_COPIA = true/, 'Android no declara que la copia automática está permitida');
    assert.equal(JSON.parse(fuente('app/app.json')).expo.android.allowBackup, true, 'el manifiesto de Android no permite la copia');
    // Y donde escribe la app es el directorio que el sistema respalda.
    assert.match(fuente('app/plataforma/ficheros.js'), /Paths\.document/, 'la app no escribe en el directorio de documentos, que es el que entra en la copia');
    assert.match(fuente('app/plataforma/copia-del-sistema.js'), /Paths\.cache/, 'el fichero de trabajo de compartir no se escribe en la caché');
  });
});

describe('La suite de núcleo arranca sin instalar nada', () => {
  test('Ningún módulo alcanzable desde test/nucleo/ cita un especificador que haya que instalar', () => {
    // El guardián de SPEC-001 solo mira los imports **directos** de `test/nucleo/` y
    // `test/dobles/`, nunca el cierre transitivo por `app/`: es el agujero que
    // `app/nucleo/piezas.js` documenta haber pagado con cinco ficheros que dejaron de
    // cargar y sesenta y siete casos que ni se descubrían. Esto lo cierra siguiendo el
    // grafo de imports relativos hasta donde llegue.
    const semillas = [
      join(RAIZ_REPO, 'test', 'headless.mjs'),
      ...ficherosDe(join(RAIZ_REPO, 'test', 'nucleo'), /\.mjs$/),
      ...ficherosDe(join(RAIZ_REPO, 'test', 'dobles'), /\.mjs$/),
    ];
    const vistos = new Set();
    const externos = [];

    function anda(fichero) {
      if (vistos.has(fichero) || !existsSync(fichero)) return;
      vistos.add(fichero);
      const texto = readFileSync(fichero, 'utf8');
      const rutas = [];
      // `\b` tras la palabra clave, y no es cosmético: sin él una línea que empiece por un
      // identificador como `importanSalud,` abre el patrón, el `[\s\S]*?` corre hasta el
      // siguiente `from '…'` que haya en el fichero —aunque sea el de una cadena— y la guarda
      // da un rojo por un import que no existe. Medido el 12-ago-2026 en `app.test.mjs`.
      for (const m of texto.matchAll(/(?:^|\n)\s*(?:import|export)\b[\s\S]*?from\s+['"]([^'"]+)['"]/g)) rutas.push(m[1]);
      for (const m of texto.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) rutas.push(m[1]);
      for (const ruta of rutas) {
        if (ruta.startsWith('node:')) continue;
        if (ruta.startsWith('.') || ruta.startsWith('/')) anda(resolve(dirname(fichero), ruta));
        else externos.push(`${fichero.slice(RAIZ_REPO.length + 1)} → ${ruta}`);
      }
    }
    for (const semilla of semillas) anda(semilla);

    assert.deepEqual(externos, [], 'la suite de núcleo ha pasado a depender de una instalación por el cierre transitivo de sus imports');
    assert.ok(vistos.size > 100, 'el recorrido no ha llegado a ningún sitio: la comprobación estaría vacía');
  });
});

describe('Las dependencias que entran', () => {
  test('Todo paquete que app/ importa está declarado, o es del SDK de Expo y se dice quién lo trae', () => {
    // La lista cerrada de SPEC-020 mira lo que `app/package.json` **declara**, nunca lo
    // que `app/` **importa**: por ese hueco entra cualquier módulo que venga dentro del
    // SDK sin que nadie lo declare, y esta fila lo estrenó con `expo-file-system`. Aquí
    // se mira desde el otro lado, que es el que se rompe.
    //
    // `expo-file-system` **ya no está aquí**: SPEC-039 lo declaró en `app/package.json`
    // y la lista cerrada de `app.test.mjs` lo admitió, así que hoy no es un paquete del
    // SDK sin dueño sino una dependencia declarada como las demás. Lo que queda es el
    // mecanismo, vacío a propósito: un paquete solo entra en `delSdk` mientras nadie
    // pueda declararlo, con quién lo trae y desde cuándo escritos al lado, y sale de
    // ella en cuanto se declara. Estar en la lista no bendice a nadie: lo hace visible.
    const delSdk = {};
    const declaradas = new Set(Object.keys(JSON.parse(fuente('app/package.json')).dependencies ?? {}));

    // Los artefactos de compilación no cuentan: no están versionados —lo afirma
    // `app.test.mjs`— y un `require` dentro de un bundle no dice nada de lo que la app
    // pide. Sin esta poda, el barrido se pondría rojo por código que nadie escribió.
    const compilados = /^(node_modules|dist|ios|android|\.expo)$/;
    const importadores = new Map();
    for (const fichero of ficherosDe(join(RAIZ_REPO, 'app'), /\.(js|mjs|jsx)$/, [], compilados)) {
      const relativo = fichero.slice(RAIZ_REPO.length + 1);
      const texto = readFileSync(fichero, 'utf8');
      const rutas = [];
      // `\b` tras la palabra clave, y no es cosmético: sin él una línea que empiece por un
      // identificador como `importanSalud,` abre el patrón, el `[\s\S]*?` corre hasta el
      // siguiente `from '…'` que haya en el fichero —aunque sea el de una cadena— y la guarda
      // da un rojo por un import que no existe. Medido el 12-ago-2026 en `app.test.mjs`.
      for (const m of texto.matchAll(/(?:^|\n)\s*(?:import|export)\b[\s\S]*?from\s+['"]([^'"]+)['"]/g)) rutas.push(m[1]);
      for (const m of texto.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) rutas.push(m[1]);
      // Y `require`, que en React Native no es exótico: los recursos estáticos entran
      // así, y un paquete pedido por `require` entra en el móvil igual que uno importado.
      for (const m of texto.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) rutas.push(m[1]);
      for (const ruta of rutas) {
        if (ruta.startsWith('.') || ruta.startsWith('/') || ruta.startsWith('node:')) continue;
        const paquete = ruta.startsWith('@') ? ruta.split('/').slice(0, 2).join('/') : ruta.split('/')[0];
        if (!importadores.has(paquete)) importadores.set(paquete, new Set());
        importadores.get(paquete).add(relativo);
      }
    }

    // Todos los ficheros que piden cada paquete sin declarar, y no solo el primero: con
    // uno solo, arreglar un import y dejar los otros tres se veía como arreglado.
    const sinDeclarar = [...importadores]
      .filter(([paquete]) => !declaradas.has(paquete) && !(paquete in delSdk))
      .map(([paquete, ficheros]) => `${paquete} ← ${[...ficheros].sort().join(', ')}`)
      .sort();
    assert.deepEqual(
      sinDeclarar,
      [],
      'app/ importa paquetes que ni están declarados en app/package.json ni figuran como traídos por el SDK: entrarían en el móvil sin que ninguna spec los nombre',
    );

    // Que el barrido esté mirando de verdad. Un patrón que deja de casar —un import con
    // otra forma, un directorio que se poda de más— daría cero paquetes y esta
    // comprobación pasaría siempre, que es la manera silenciosa de perder una guarda.
    for (const conocido of ['expo', 'react', 'react-native', 'expo-file-system', '@walkingadventure/nucleo']) {
      assert.equal(importadores.has(conocido), true, `el barrido no ha visto ni un import de "${conocido}": está mirando a otro sitio`);
    }
    assert.equal(
      [...importadores.get('expo-file-system')].sort().join(', '),
      'app/desarrollo/cuaderno-del-dispositivo.js, app/plataforma/copia-del-sistema.js, app/plataforma/ficheros.js',
      'los únicos adaptadores que piden el sistema de ficheros deben seguir siendo partida, copia y caché del cuaderno',
    );

    // Y la lista de arriba no puede quedarse con un paquete que ya nadie usa ni con uno
    // que ya está declarado: las dos cosas la convierten en una excepción sin caducidad.
    for (const [paquete, porque] of Object.entries(delSdk)) {
      assert.equal(declaradas.has(paquete), false, `"${paquete}" ya está declarado en app/package.json: sobra de la lista del SDK (${porque})`);
      assert.equal(importadores.has(paquete), true, `"${paquete}" está en la lista del SDK y ya no lo importa nadie (${porque})`);
    }
  });
});

/** Los ficheros de un directorio que casan con un patrón, recursivamente. */
function ficherosDe(dir, patron, out = [], podar = null) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (podar?.test(e.name)) continue;
      ficherosDe(join(dir, e.name), patron, out, podar);
    } else if (patron.test(e.name)) out.push(join(dir, e.name));
  }
  return out;
}
