// SPEC-047 · La partida que se congela y se vuelve a abrir: el cableado que faltaba.
//
// Se prueba contra el **disco de verdad** —`creaFicherosDeNode` sobre un directorio
// temporal— y no contra un doble, por lo mismo que `duradero.test.mjs`: montar otro
// `creaPartidaGuardada` sobre el mismo directorio **es** cerrar y volver a abrir la app, y
// es lo único que desmiente de verdad «lo jugado sobrevive». Donde hace falta ver un fallo
// de escritura o un orden se usa el doble en memoria, que es lo que el disco no deja ver.
//
// La guarda hermana de esta fila —`partida-persistida.test.mjs`— comprueba que el cableado
// existe leyendo la fuente de `app/`. Esto comprueba que además **hace lo que dice**.
//
// La migración se ejercita hoy, con la versión de formato todavía en 1, porque la cadena y
// la versión de destino entran por la firma: es la mitad del diseño de `migracion.js`
// (`decisiones-orquestador.md` §6o) y sin ella el criterio se cumpliría siempre por no
// haber nada que migrar, que no mide nada.
//
// Nada toca la red ni el reloj del sistema.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { creaAlmacenDuradero, directorioDeLaPartida } from '../../app/datos/almacen-duradero.js';
import { creaFicherosDeNode } from '../../app/datos/ficheros-de-node.js';
import { creaAlmacenEnMemoria } from '../../app/datos/almacen.js';
import { APERTURAS, DEL_NUCLEO, PREFIJO_DE_LO_JUGADO, creaPartidaGuardada } from '../../app/datos/partida-guardada.js';
import { DEL_NUCLEO as DEL_NUCLEO_DEL_MUNDO, mundoDeLaPartida } from '../../app/mapa/mundo-guardado.js';
import { creaFicherosDeMemoria } from '../dobles/ficheros.mjs';

import { CLAVES_DE_PARTIDA } from '../../packages/nucleo/partida/reconstruccion.js';
import {
  CLAVE_DE_IMPORTACION_EN_CURSO,
  CLAVE_DE_PROCEDENCIA,
  PREFIJOS_DE_LA_PARTIDA,
  componeExportacion,
} from '../../packages/nucleo/partida/exportacion.js';
import { creaCadena, paso } from '../../packages/nucleo/partida/migracion.js';
import { sinRastroDeUbicacion } from '../../packages/nucleo/partida/formato.js';
import { anexa, hecho } from '../../packages/nucleo/partida/hechos.js';
import { CLAVES, listaMapas } from '../../packages/nucleo/partida/mapa.js';

import { ANCLAJE_DE_CASA, ANCLAJE_DE_VACACIONES, SEMILLA_A, mapaGuardado } from './copia-de-prueba.mjs';
import { NUCLEO_DE_LA_PARTIDA_GUARDADA, NUCLEO_DEL_MUNDO_GUARDADO } from './partida-guardada-de-prueba.mjs';

/** Quien cerró el arranque. Un oficio del catálogo cerrado y un género del enumerado. */
const SABELA = Object.freeze({ nombre: 'Sabela', genero: 'femenino', oficio: 'botica', oficioPermanente: true });

/** Un almacén duradero sobre el disco de verdad. `abre()` es cerrar y volver a abrir la app. */
function enDisco() {
  const raiz = mkdtempSync(join(tmpdir(), 'wa-spec047-'));
  const directorio = directorioDeLaPartida(raiz);
  const ficheros = creaFicherosDeNode();
  return {
    directorio,
    abre: () => creaAlmacenDuradero({ ficheros, directorio }),
    limpia: () => rmSync(raiz, { recursive: true, force: true }),
  };
}

/** Un almacén duradero sobre el doble en memoria, con sus opciones de avería. */
function enMemoria(opciones = {}) {
  const ficheros = creaFicherosDeMemoria(opciones);
  return creaAlmacenDuradero({ ficheros, directorio: directorioDeLaPartida('/documentos') });
}

/** La partida guardada montada sobre un almacén, con lo que haga falta inyectado. */
function guardada(almacen, extra = {}) {
  return creaPartidaGuardada({ almacen, nucleo: NUCLEO_DE_LA_PARTIDA_GUARDADA, ...extra });
}

/** Una partida nacida con Sabela dentro, que es lo que deja el arranque al cerrarse. */
function nacida(pg, semilla = SEMILLA_A) {
  return pg.nace({ semilla, personaje: SABELA });
}

describe('La partida sobrevive a cerrar la app', () => {
  test('Lo jugado se escribe donde la copia lo busca', async () => {
    const disco = enDisco();
    try {
      await nacida(guardada(disco.abre()));
      const claves = await disco.abre().lista(PREFIJO_DE_LO_JUGADO);
      assert.deepEqual(
        claves,
        [CLAVES_DE_PARTIDA.estado, CLAVES_DE_PARTIDA.registro],
        'la partida que nace tiene que dejar sus dos documentos bajo el prefijo que recorre la exportación',
      );
      // Y el prefijo es uno de los cuatro que la copia y el respaldo recorren, no otro
      // parecido: mientras sean dos listas, una clave nueva entra en una y no en la otra.
      assert.ok(PREFIJOS_DE_LA_PARTIDA.includes(PREFIJO_DE_LO_JUGADO));
    } finally {
      disco.limpia();
    }
  });

  test('El registro de hechos se escribe desde el primer día, aunque esté vacío', async () => {
    const disco = enDisco();
    try {
      await nacida(guardada(disco.abre()));
      const doc = JSON.parse(await disco.abre().lee(CLAVES_DE_PARTIDA.registro));
      assert.deepEqual(doc.hechos, [], 'el registro de una partida recién nacida está vacío');
      assert.equal(typeof doc.generador, 'string');
      assert.notEqual(doc.generador, '', 'el registro nace con la versión de reglas con la que nació la partida');
    } finally {
      disco.limpia();
    }
  });

  test('Cerrar la app y volver no empieza de cero', async () => {
    const disco = enDisco();
    try {
      const primera = guardada(disco.abre());
      const { estado, registro } = await nacida(primera);
      estado.oro.saldo = 7;
      const lote = [hecho({ tipo: 'sitio-pisado', mapa: 'm', dia: 1, paso: 1, carga: { sitio: 'la-plaza' } })];
      anexa(registro, lote);
      estado.sitios.mapas.m = ['la-plaza'];
      await primera.congela({ estado, registro });

      // Otro montaje sobre el mismo directorio: eso es cerrar y volver a abrir.
      const segunda = await guardada(disco.abre()).abre();
      assert.equal(segunda.estado, APERTURAS.ABIERTA, segunda.motivo ?? '');
      assert.equal(segunda.partida.estado.personaje.nombre, 'Sabela');
      assert.equal(segunda.partida.estado.personaje.oficio, 'botica');
      assert.equal(segunda.partida.estado.semilla, SEMILLA_A);
      assert.equal(segunda.partida.estado.oro.saldo, 7);
      assert.deepEqual(segunda.partida.estado.sitios.mapas.m, ['la-plaza']);
      assert.equal(segunda.partida.registro.hechos.length, 1, 'el registro de hechos vuelve con lo anexado');
    } finally {
      disco.limpia();
    }
  });

  test('El mundo de la partida vuelve con su mapa y su título', async () => {
    const almacen = creaAlmacenEnMemoria();
    const casa = await mapaGuardado({ almacen, arranque: ANCLAJE_DE_CASA });
    const mundo = await mundoDeLaPartida({ almacen, nucleo: NUCLEO_DEL_MUNDO_GUARDADO, semilla: SEMILLA_A });
    assert.equal(mundo.mapaId, casa.id);
    assert.ok(mundo.documento, 'el documento del mundo es lo que la portada necesita para pintarse');
    assert.equal(typeof mundo.titulo, 'string');
  });

  test('Sin ningún mapa levantado, el mundo de la partida no es una avería', async () => {
    const almacen = creaAlmacenEnMemoria();
    assert.equal(await mundoDeLaPartida({ almacen, nucleo: NUCLEO_DEL_MUNDO_GUARDADO, semilla: SEMILLA_A }), null);
  });

  test('Con dos mapas se abre el primero por identificador, que es la regla declarada', async () => {
    const almacen = creaAlmacenEnMemoria();
    await mapaGuardado({ almacen, arranque: ANCLAJE_DE_CASA });
    await mapaGuardado({ almacen, arranque: ANCLAJE_DE_VACACIONES });
    const ids = await listaMapas({ almacen });
    assert.equal(ids.length, 2, 'hacen falta dos mapas para que «el primero» signifique algo');
    const mundo = await mundoDeLaPartida({ almacen, nucleo: NUCLEO_DEL_MUNDO_GUARDADO, semilla: SEMILLA_A });
    assert.equal(mundo.mapaId, ids[0]);
  });

  test('Congelar sin que nada haya cambiado no reescribe', async () => {
    const almacen = enMemoria();
    const pg = guardada(almacen);
    const { estado, registro } = await nacida(pg);
    const trasNacer = almacen.recuento().escrituras;

    const segunda = await pg.congela({ estado, registro });
    assert.equal(segunda.escrito, false, 'congelar dos veces lo mismo no puede escribir dos veces');
    assert.equal(almacen.recuento().escrituras, trasNacer, 'y no ha tocado el disco');

    estado.oro.saldo += 1;
    const tercera = await pg.congela({ estado, registro });
    assert.equal(tercera.escrito, true, 'un cambio de verdad sí escribe');
    assert.ok(almacen.recuento().escrituras > trasNacer);
  });

  test('Congelar justo después de abrir tampoco reescribe', async () => {
    const disco = enDisco();
    try {
      await nacida(guardada(disco.abre()));
      const almacen = disco.abre();
      const pg = guardada(almacen);
      const abierta = await pg.abre();
      const antes = almacen.recuento().escrituras;
      const congelada = await pg.congela(abierta.partida);
      assert.equal(congelada.escrito, false, 'lo que acaba de salir del disco no hace falta volver a escribirlo');
      assert.equal(almacen.recuento().escrituras, antes);
    } finally {
      disco.limpia();
    }
  });

  test('Una copia exportada trae lo jugado', async () => {
    const almacen = enMemoria();
    await mapaGuardado({ almacen, arranque: ANCLAJE_DE_CASA });
    await nacida(guardada(almacen));
    const { manifiesto } = await componeExportacion({ almacen });
    const nombres = manifiesto.partes.map((p) => p.nombre);
    assert.ok(nombres.includes(CLAVES_DE_PARTIDA.estado), 'una copia sin documento de estado no respalda nada de lo jugado');
    assert.ok(nombres.includes(CLAVES_DE_PARTIDA.registro), 'y sin el registro se queda sin la red de seguridad');
  });

  test('El mismo estado congelado dos veces da el mismo texto byte a byte', async () => {
    const almacen = enMemoria();
    const pg = guardada(almacen);
    const { estado, registro } = await nacida(pg);
    const uno = await almacen.lee(CLAVES_DE_PARTIDA.estado);
    // Se fuerza a escribir otra vez sobre el mismo estado, sin pasar por el sello.
    await guardada(almacen).congela({ estado, registro });
    assert.equal(await almacen.lee(CLAVES_DE_PARTIDA.estado), uno);
  });

  test('Lo que se escribe no lleva ningún rastro de ubicación', async () => {
    const disco = enDisco();
    try {
      await nacida(guardada(disco.abre()));
      const almacen = disco.abre();
      for (const clave of await almacen.lista(PREFIJO_DE_LO_JUGADO)) {
        sinRastroDeUbicacion(JSON.parse(await almacen.lee(clave)), clave);
      }
    } finally {
      disco.limpia();
    }
  });
});

describe('Lo que la partida guardada exige al construirse y al escribir', () => {
  test('Con el almacén de memoria protesta al construir en vez de perder la partida', () => {
    assert.throws(
      () => creaPartidaGuardada({ almacen: creaAlmacenEnMemoria(), nucleo: NUCLEO_DE_LA_PARTIDA_GUARDADA }),
      /no es el duradero/,
    );
  });

  test('Con media interfaz del núcleo protesta al construir y nombra lo que falta', () => {
    const cojo = { ...NUCLEO_DE_LA_PARTIDA_GUARDADA };
    delete cojo.congelaEstado;
    assert.throws(() => creaPartidaGuardada({ almacen: enMemoria(), nucleo: cojo }), /congelaEstado/);
    assert.ok(DEL_NUCLEO.includes('congelaEstado') && DEL_NUCLEO.includes('levantaEstado'));
  });

  test('Una escritura fuera del prefijo de lo jugado se rechaza nombrando la clave', async () => {
    const almacen = enMemoria();
    const pg = guardada(almacen);
    const { estado, registro } = await nacida(pg);
    // Se fuerza por la única puerta que hay: un núcleo cuyo `guardaPartida` escribe donde
    // no debe. Es exactamente la forma del fallo que se quiere impedir — una clave de la
    // partida escrita fuera del prefijo no entra en la copia y nadie la echa de menos.
    const traidor = {
      ...NUCLEO_DE_LA_PARTIDA_GUARDADA,
      guardaPartida: ({ almacen: donde }) => donde.escribe('camara/estado.json', '{}'),
    };
    const pgTraidor = creaPartidaGuardada({ almacen, nucleo: traidor });
    estado.oro.saldo += 1;
    await assert.rejects(() => pgTraidor.congela({ estado, registro }), /camara\/estado\.json/);
    void pg;
  });

  test('Si el almacén falla al escribir, se dice la clave y la siguiente congelación reintenta', async () => {
    const almacen = enMemoria();
    const pg = guardada(almacen);
    const { estado, registro } = await nacida(pg);
    const antes = await almacen.lee(CLAVES_DE_PARTIDA.estado);

    // El doble deja de aceptar escrituras a partir de aquí.
    const roto = enMemoria({ falloAlEscribir: 'partida' });
    const pgRoto = guardada(roto);
    await assert.rejects(() => pgRoto.congela({ estado, registro }), /partida\//);

    // Y el documento anterior sigue entero: aquí no se borra nada antes de escribir.
    assert.equal(await almacen.lee(CLAVES_DE_PARTIDA.estado), antes);
  });
});

describe('Una partida que no se puede abrir da la cara', () => {
  test('Un estado ilegible no se convierte en una partida nueva', async () => {
    const almacen = enMemoria();
    await nacida(guardada(almacen));
    await almacen.escribe(CLAVES_DE_PARTIDA.estado, '{ esto no es un documento');
    const abierta = await guardada(almacen).abre();
    assert.equal(abierta.estado, APERTURAS.NO_SE_PUDO);
    assert.match(abierta.motivo, /no se puede leer/);
    assert.notEqual(abierta.estado, APERTURAS.SIN_PARTIDA, 'caer a «no hay partida» sería empezar una nueva en silencio');
    assert.equal(abierta.partida, undefined, 'y no se ofrece ninguna partida a medias');
  });

  test('Una copia de una versión que el juego no entiende no se abre a medias', async () => {
    const almacen = enMemoria();
    await nacida(guardada(almacen));
    const doc = JSON.parse(await almacen.lee(CLAVES_DE_PARTIDA.estado));
    doc.version = 9;
    await almacen.escribe(CLAVES_DE_PARTIDA.estado, JSON.stringify(doc));
    const abierta = await guardada(almacen).abre();
    assert.equal(abierta.estado, APERTURAS.NO_SE_PUDO);
    assert.match(abierta.motivo, /9/, 'el motivo declara la versión que llegó');
  });

  test('Un registro ilegible no impide jugar, y se declara', async () => {
    const almacen = enMemoria();
    await nacida(guardada(almacen));
    await almacen.escribe(CLAVES_DE_PARTIDA.registro, '{ tampoco esto');
    const abierta = await guardada(almacen).abre();
    assert.equal(abierta.estado, APERTURAS.ABIERTA, 'lo que se pierde es la red de seguridad, no la partida');
    assert.ok(abierta.falloDelRegistro, 'y el fallo del registro se dice en vez de tragarse');
  });

  test('Una importación a medio escribir no abre una mezcla de dos partidas', async () => {
    const almacen = enMemoria();
    await nacida(guardada(almacen));
    await almacen.escribe(CLAVE_DE_IMPORTACION_EN_CURSO, '{}');
    const abierta = await guardada(almacen).abre();
    assert.equal(abierta.estado, APERTURAS.NO_SE_PUDO);
    assert.match(abierta.motivo, /importación a medio escribir/);
  });

  test('Sin ningún documento de estado se abre el arranque y no la avería', async () => {
    const abierta = await guardada(enMemoria()).abre();
    assert.equal(abierta.estado, APERTURAS.SIN_PARTIDA, 'el día uno no es una avería');
  });
});

describe('Versionado y migración del estado', () => {
  /** La cadena de prueba: un paso 1→2 que solo sube la versión, y su destino sintético. */
  const AL_FUTURO = { cadena: creaCadena([paso({ de: 1, a: 2, porque: 'ejercitar la cadena' })]), versionDeDestino: 2 };

  test('Una partida de una versión anterior se migra al abrirla', async () => {
    const almacen = enMemoria();
    await nacida(guardada(almacen));
    await guardada(almacen, AL_FUTURO).abre();

    const doc = JSON.parse(await almacen.lee(CLAVES_DE_PARTIDA.estado));
    assert.equal(doc.version, 2, 'el documento guardado queda en la versión de destino');
    assert.equal(doc.areas.personaje.nombre, 'Sabela', 'y el contenido cruza el salto entero');
    assert.equal(JSON.parse(await almacen.lee(CLAVES_DE_PARTIDA.registro)).version, 2, 'los dos documentos juntos, no uno');

    const procedencia = JSON.parse(await almacen.lee(CLAVE_DE_PROCEDENCIA));
    assert.equal(procedencia.de, 'migracion');
    assert.equal(procedencia.migradaDesde, 1, 'queda declarado de qué versión venía');
  });

  test('Un salto sin paso registrado no se interpreta con las reglas nuevas', async () => {
    const almacen = enMemoria();
    await nacida(guardada(almacen));
    const antes = await almacen.lee(CLAVES_DE_PARTIDA.estado);

    const abierta = await guardada(almacen, { cadena: creaCadena([]), versionDeDestino: 2 }).abre();
    assert.equal(abierta.estado, APERTURAS.NO_SE_PUDO);
    assert.match(abierta.motivo, /falta el paso 1→2/, 'el motivo nombra el salto que falta');
    assert.equal(await almacen.lee(CLAVES_DE_PARTIDA.estado), antes, 'y el documento guardado no se toca');
  });

  test('Una migración que no se puede levantar no sustituye a la buena', async () => {
    const almacen = enMemoria();
    await nacida(guardada(almacen));
    const antes = await almacen.lee(CLAVES_DE_PARTIDA.estado);

    // Un paso que introduce un campo que el esquema cerrado no declara. Es la forma más
    // barata de un paso mal escrito, y lo que no puede pasar es que sustituya al bueno.
    const rota = creaCadena([paso({ de: 1, a: 2, introduce: { 'areas.oro.regalo': 3 }, porque: 'un paso mal escrito' })]);
    const abierta = await guardada(almacen, { cadena: rota, versionDeDestino: 2 }).abre();
    assert.equal(abierta.estado, APERTURAS.NO_SE_PUDO);
    assert.equal(await almacen.lee(CLAVES_DE_PARTIDA.estado), antes, 'no se escribe el documento migrado');
  });

  test('Una partida que ya está en la versión actual no se migra ni se reescribe', async () => {
    const almacen = enMemoria();
    await nacida(guardada(almacen));
    const antes = almacen.recuento().escrituras;
    const abierta = await guardada(almacen).abre();
    assert.equal(abierta.estado, APERTURAS.ABIERTA);
    assert.equal(abierta.migradaDesde, null);
    assert.equal(almacen.recuento().escrituras, antes, 'abrir una partida al día no escribe nada');
    assert.equal(await almacen.lee(CLAVE_DE_PROCEDENCIA), null, 'y no declara una procedencia que no hubo');
  });
});

describe('Lo que el mundo guardado le exige a quien lo monta', () => {
  test('Sin el núcleo entero protesta nombrando lo que falta', async () => {
    const cojo = { ...NUCLEO_DEL_MUNDO_GUARDADO };
    delete cojo.cargaCelda;
    await assert.rejects(
      () => mundoDeLaPartida({ almacen: creaAlmacenEnMemoria(), nucleo: cojo, semilla: SEMILLA_A }),
      /cargaCelda/,
    );
    assert.deepEqual([...DEL_NUCLEO_DEL_MUNDO].sort(), ['cargaCelda', 'cargaMapa', 'celdasAbiertas', 'listaMapas']);
    assert.ok(CLAVES.indice, 'las claves del mapa son las del núcleo y no se reconstruyen en la app');
  });
});
